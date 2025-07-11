import express, { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import AdmZip from "adm-zip";
import * as fs from "fs";
import path from "path";
import {
  uploadToAzureBlob,
  triggerAzureContainerJob,
  runBuildAndDeploy,
} from "../services/azure-deploy_fullstack";
import { 
  parseFrontendCodeRobust,
  parseFrontendCode,
  validateTailwindConfig,
  getTailwindConfig,
  ensureTailwindConfigFirst,
  validateFileStructure,
  correctFilePaths,
  debugInput,
  StructureNode
} from "../utils/newparser";
import Anthropic from "@anthropic-ai/sdk";
import { pro5Enhanced2 } from "../defaults/promt";
import { createClient } from "@supabase/supabase-js";
import { DrizzleMessageHistoryDB } from '../db/messagesummary';
import { StatelessSessionManager } from './session';

const router = express.Router();

interface FileData {
  path: string;
  content: string;
}

// FIXED: Better cleanup with proper error handling and timing
async function cleanupTempDirectory(buildId: string): Promise<void> {
  const tempBuildDir = path.join(__dirname, "../../temp-builds", buildId);
  try {
    if (fs.existsSync(tempBuildDir)) {
      await fs.promises.rm(tempBuildDir, { recursive: true, force: true });
      console.log(`[${buildId}] 🧹 Temp directory cleaned up`);
    } else {
      console.log(`[${buildId}] 🧹 Temp directory already cleaned or doesn't exist`);
    }
  } catch (error) {
    console.warn(`[${buildId}] ⚠️ Failed to cleanup temp directory:`, error);
  }
}

// ADDED: Schedule cleanup with better timing control
function scheduleCleanup(buildId: string, delayInHours: number = 1): void {
  const delayMs = delayInHours * 60 * 60 * 1000; // Convert hours to milliseconds
  
  setTimeout(async () => {
    console.log(`[${buildId}] 🕐 Scheduled cleanup starting after ${delayInHours} hour(s)`);
    await cleanupTempDirectory(buildId);
  }, delayMs);
  
  console.log(`[${buildId}] ⏰ Cleanup scheduled for ${delayInHours} hour(s) from now`);
}

export function initializeGenerationRoutes(
  anthropic: Anthropic,
  messageDB: DrizzleMessageHistoryDB,
  sessionManager: StatelessSessionManager
): express.Router {
  router.post("/", async (req: Request, res: Response): Promise<void> => {
    const { 
      prompt,
      projectId,
      supabaseToken,
      databaseUrl,
      supabaseUrl,
      supabaseAnonKey,
    } = req.body;
    
    if (!prompt) {
      res.status(400).json({
        success: false,
        error: "Prompt is required"
      });
      return;
    }

    const buildId = uuidv4();
    const sessionId = sessionManager.generateSessionId();
    console.log(`[${buildId}] Starting generation for prompt: "${prompt.substring(0, 100)}..."`);
    console.log(`[${buildId}] Session: ${sessionId}`);
    
    const sourceTemplateDir = path.join(__dirname, "../../react-base");
    const tempBuildDir = path.join(__dirname, "../../temp-builds", buildId);

    try {
      // Save initial session context
      await sessionManager.saveSessionContext(sessionId, {
        buildId,
        tempBuildDir: '',
        lastActivity: Date.now()
      });

      // 1. Setup temp directory
      await fs.promises.mkdir(tempBuildDir, { recursive: true });
      await fs.promises.cp(sourceTemplateDir, tempBuildDir, { recursive: true });
      console.log(`[${buildId}] 📁 Temp directory created: ${tempBuildDir}`);

      // Update session with temp directory
      await sessionManager.updateSessionContext(sessionId, { tempBuildDir });

      // 2. Generate code with Claude
      console.log(`[${buildId}] 🚀 Generating frontend code...`);
      
      const frontendResult = await anthropic.messages
        .stream({
          model: "claude-sonnet-4-0",
          max_tokens: 50000,
          temperature: 1,
          system: pro5Enhanced2,
          messages: [
            {
              role: "user",
              content: [{ type: "text", text: prompt }],
            },
          ],
        })
        .on("text", (text) => {
          console.log(text);
        });

      const resp = await frontendResult.finalMessage();
      console.log(`[${buildId}] ✅ Code generation completed`);

      // 3. Parse generated files with enhanced error handling
      const claudeResponse = (resp.content[0] as any).text;
      
      let parsedFrontend;
      try {
        console.log(`[${buildId}] 📝 Parsing generated code with robust parser...`);
        parsedFrontend = parseFrontendCodeRobust(claudeResponse);
        console.log(`[${buildId}] ✅ Code parsing successful with robust parser`);
      } catch (parseError) {
        console.error(`[${buildId}] ❌ Robust parser failed, analyzing input...`);
        
        debugInput(claudeResponse);
        
        try {
          console.log(`[${buildId}] 🔄 Attempting fallback to original parser...`);
          parsedFrontend = parseFrontendCode(claudeResponse);
          console.log(`[${buildId}] ✅ Fallback parser succeeded`);
        } catch (fallbackError) {
          console.error(`[${buildId}] ❌ All parsing attempts failed`);
          console.error(`[${buildId}] Parse error details:`, parseError);
          console.error(`[${buildId}] Fallback error details:`, fallbackError);
          console.error(`[${buildId}] Claude response preview:`, claudeResponse.substring(0, 500));
          
          throw new Error(`Failed to parse Claude response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }
      }
    
      let parsedFiles: FileData[] = parsedFrontend.codeFiles;
      
      console.log(`[${buildId}] 🔧 Processing ${parsedFiles.length} generated files...`);
      
      // Validate file structure before processing
      const structureValidation = validateFileStructure(parsedFiles);
      if (!structureValidation.isValid) {
        console.warn(`[${buildId}] ⚠️ File structure issues found:`, structureValidation.errors);
      }
      
      parsedFiles = correctFilePaths(parsedFiles);
      parsedFiles = ensureTailwindConfigFirst(parsedFiles);
      
      console.log(`[${buildId}] 📁 Final file structure:`);
      parsedFiles.forEach((file, index) => {
        console.log(`[${buildId}]   ${index + 1}. ${file.path} (${file.content.length} chars)`);
      });

      // Extract project summary
      let projectSummary: StructureNode;
      console.log(`[${buildId}] Response has ${resp.content.length} content blocks`);

      if (resp.content.length > 1 && resp.content[1]) {
        projectSummary = (resp.content[1] as any).text;
        console.log(`[${buildId}] 📋 Using Claude summary from content[1]`);
      } else if (parsedFrontend.structure) {
        projectSummary = parsedFrontend.structure;
        console.log(`[${buildId}] 📋 Using parser-generated summary`);
      } else {
        console.log(`[${buildId}] 📋 Using fallback summary`);
        projectSummary = parsedFiles.reduce((acc, file) => {
          const pathParts = file.path.split('/');
          let current = acc;
          
          for (let i = 0; i < pathParts.length - 1; i++) {
            if (!current[pathParts[i]]) {
              current[pathParts[i]] = {};
            }
            current = current[pathParts[i]] as StructureNode;
          }
          
          current[pathParts[pathParts.length - 1]] = 'file';
          return acc;
        }, {} as StructureNode);
      }

      if (!parsedFiles || parsedFiles.length === 0) {
        throw new Error('No files generated from Claude response');
      }

      // Validate Tailwind config
      const tailwindConfig = getTailwindConfig(parsedFiles);
      if (tailwindConfig) {
        const configLines = tailwindConfig.content.split('\n').slice(0, 10);
        console.log(`[${buildId}] 🔍 Tailwind config preview:`, configLines.join('\n'));
        
        const isValidConfig = validateTailwindConfig(tailwindConfig.content);
        if (isValidConfig) {
          console.log(`[${buildId}] ✅ Tailwind config validation passed`);
        } else {
          console.warn(`[${buildId}] ⚠️ Tailwind config validation failed - this may cause build issues`);
          
          const configContent = tailwindConfig.content;
          const issues = [];
          
          if (!configContent.includes('export default')) issues.push('Missing export default');
          if (!configContent.includes('content:')) issues.push('Missing content array');
          if (!configContent.includes('theme:')) issues.push('Missing theme configuration');
          if (configContent.includes('var(--')) issues.push('Contains CSS variables (not allowed)');
          
          console.warn(`[${buildId}] 🔍 Config issues found:`, issues);
        }
      } else {
        console.warn(`[${buildId}] ⚠️ No tailwind.config.ts found in generated files`);
      }

      console.log(`[${buildId}] 💾 Writing ${parsedFiles.length} files...`);
      const fileMap: { [path: string]: string } = {};
      
      // Write files with error handling
      for (const file of parsedFiles) {
        try {
          const fullPath = path.join(tempBuildDir, file.path);
          await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.promises.writeFile(fullPath, file.content, "utf8");
          
          fileMap[file.path] = file.content;
          console.log(`[${buildId}] ✅ Written: ${file.path}`);
        } catch (writeError) {
          console.error(`[${buildId}] ❌ Failed to write ${file.path}:`, writeError);
          throw new Error(`Failed to write file ${file.path}: ${writeError}`);
        }
      }

      // Cache all files in session
      await sessionManager.cacheProjectFiles(sessionId, fileMap);
      console.log(`[${buildId}] 📦 Cached ${Object.keys(fileMap).length} files in session`);

      // FIXED: Proper delay for file system operations
      console.log(`[${buildId}] ⏳ Allowing file system operations to complete...`);
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log(`[${buildId}] 📦 Creating zip and uploading to Azure...`);
      const zip = new AdmZip();
      zip.addLocalFolder(tempBuildDir);
      const zipBuffer = zip.toBuffer();

      const zipBlobName = `${buildId}/source.zip`;
      const zipUrl = await uploadToAzureBlob(
        process.env.AZURE_STORAGE_CONNECTION_STRING!,
        "source-zips",
        zipBlobName,
        zipBuffer
      );
      console.log(`[${buildId}] 📤 Source uploaded:`, zipUrl);

      // Update session context with project summary
      await sessionManager.updateSessionContext(sessionId, {
        projectSummary: {
          //@ts-ignore
          summary: projectSummary,
          zipUrl: zipUrl,
          buildId: buildId,
          filesGenerated: parsedFiles.length
        }
      });

      // 6. Trigger Azure Container Job
      console.log(`[${buildId}] 🔧 Triggering Azure Container Job...`);
      const DistUrl = await triggerAzureContainerJob(zipUrl, buildId, {
        resourceGroup: process.env.AZURE_RESOURCE_GROUP!,
        containerAppEnv: process.env.AZURE_CONTAINER_APP_ENV!,
        acrName: process.env.AZURE_ACR_NAME!,
        storageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
        storageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME!,
        supabaseToken: supabaseToken,
        databaseUrl: databaseUrl,
        supabaseUrl: supabaseUrl,
        supabaseAnonKey: supabaseAnonKey,
      });

      const urls = JSON.parse(DistUrl);
      console.log(`[${buildId}] 🔗 Build URLs:`, urls);
      const builtZipUrl = urls.downloadUrl;

      // 7. Deploy to Azure Static Web Apps
      console.log(`[${buildId}] 🚀 Deploying to SWA...`);
      const previewUrl = await runBuildAndDeploy(builtZipUrl, buildId, {
        VITE_SUPABASE_URL: supabaseUrl,
        VITE_SUPABASE_ANON_KEY: supabaseAnonKey,
      });
      console.log(`[${buildId}] 🌐 Deployed to:`, previewUrl);

      // 8. Save assistant response to message history
      try {
        const assistantMessageId = await messageDB.addMessage(
          //@ts-ignore
          projectSummary,
          'assistant',
          {
            promptType: 'frontend_generation',
            requestType: 'claude_response', 
            success: true,
            buildId: buildId,
            sessionId: sessionId,
            previewUrl: previewUrl,
            downloadUrl: urls.downloadUrl,
            zipUrl: zipUrl,
          }
        );
        console.log(`[${buildId}] 💾 Saved summary to messageDB (ID: ${assistantMessageId})`);
      } catch (dbError) {
        console.warn(`[${buildId}] ⚠️ Failed to save summary to messageDB:`, dbError);
      }

      // 9. Update Supabase database if projectId provided
      if (projectId && supabaseUrl && supabaseAnonKey) {
        try {
          const supabase = createClient(supabaseUrl, supabaseAnonKey);
          await supabase
            .from('projects')
            .update({ 
              deployment_url: previewUrl,
              download_url: urls.downloadUrl,
              zip_url: zipUrl,
              status: 'deployed'
            })
            .eq('id', projectId);
          console.log(`[${buildId}] ✅ Updated project ${projectId} in Supabase`);
        } catch (dbError) {
          console.warn(`[${buildId}] ⚠️ Failed to update Supabase:`, dbError);
        }
      }

      // FIXED: Schedule cleanup for 1 hour later instead of immediate cleanup
      scheduleCleanup(buildId, 1); // 1 hour delay
      
      console.log(`[${buildId}] ✅ Build process completed successfully`);
      
      res.json({
        success: true,
        files: parsedFiles,
        previewUrl: previewUrl, 
        downloadUrl: urls.downloadUrl,
        zipUrl: zipUrl,
        buildId: buildId,
        sessionId: sessionId,
        //@ts-ignore
        summary: projectSummary,
        hosting: "Azure Static Web Apps",
        features: [
          "Global CDN",
          "Auto SSL/HTTPS",
          "Custom domains support",
          "Staging environments",
        ],
      });

    } catch (error) {
      console.error(`[${buildId}] ❌ Build process failed:`, error);
      
      if (error instanceof Error) {
        console.error(`[${buildId}] Error name:`, error.name);
        console.error(`[${buildId}] Error message:`, error.message);
        console.error(`[${buildId}] Error stack:`, error.stack);
      }
      
      // Save error to messageDB
      try {
        await messageDB.addMessage(
          `Frontend generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'assistant',
          {
            promptType: 'frontend_generation',
            requestType: 'claude_response',
            success: false,
            buildId: buildId,
            sessionId: sessionId,
          }
        );
      } catch (dbError) {
        console.warn(`[${buildId}] ⚠️ Failed to save error to messageDB:`, dbError);
      }

      // Cleanup session on error
      await sessionManager.cleanup(sessionId);
      
      // FIXED: Only cleanup temp directory on error, not on success
      await cleanupTempDirectory(buildId);
      
      res.status(500).json({
        success: false,
        error: 'Build process failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        buildId: buildId,
        sessionId: sessionId,
      });
    }
    // REMOVED: The finally block that was causing premature cleanup
    
    console.log(`[${buildId}] 🏁 Generation route completed`);
  });

  return router;
}