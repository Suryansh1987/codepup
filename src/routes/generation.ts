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
import { EnhancedProjectUrlManager } from '../db/url-manager'; // ADD THIS LINE
import { 
  parseFrontendCode,
  validateTailwindConfig,
  processTailwindProject,
  generateProjectSummary,
  ParsedResult
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
// ADD THIS ENTIRE FUNCTION
async function resolveUserId(
  messageDB: DrizzleMessageHistoryDB,
  providedUserId?: number,
  sessionId?: string
): Promise<number> {
  try {
    // Priority 1: Use provided userId if valid
    if (providedUserId && await messageDB.validateUserExists(providedUserId)) {
      return providedUserId;
    }

    // Priority 2: Get userId from session's most recent project
    if (sessionId) {
      const sessionProject = await messageDB.getProjectBySessionId(sessionId);
      if (sessionProject && sessionProject.userId) {
        return sessionProject.userId;
      }
    }

    // Priority 3: Get most recent user from any project
    const mostRecentUserId = await messageDB.getMostRecentUserId();
    if (mostRecentUserId && await messageDB.validateUserExists(mostRecentUserId)) {
      return mostRecentUserId;
    }

    // Priority 4: Create a new user with current timestamp
    const newUserId = Date.now() % 1000000;
    await messageDB.ensureUserExists(newUserId, {
      email: `user${newUserId}@buildora.dev`,
      name: `User ${newUserId}`
    });
    
    console.log(`✅ Created new user ${newUserId} as fallback`);
    return newUserId;
  } catch (error) {
    console.error('❌ Failed to resolve user ID:', error);
    throw new Error('Could not resolve or create user');
  }
}
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
  const urlManager = new EnhancedProjectUrlManager(messageDB);
  router.post("/", async (req: Request, res: Response): Promise<void> => {
    const { 
      prompt,
      projectId,
      supabaseToken,
      databaseUrl,
      supabaseUrl,
      supabaseAnonKey,
      userId: providedUserId,
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

    let userId: number;
try {
  userId = await resolveUserId(messageDB, providedUserId, sessionId);
  console.log(`[${buildId}] Resolved user ID: ${userId} (provided: ${providedUserId})`);
} catch (error) {
  res.status(500).json({
    success: false,
    error: 'Failed to resolve user for project generation',
    details: error instanceof Error ? error.message : 'Unknown error',
    buildId,
    sessionId
  });
  return;
}
    console.log(`[${buildId}] Starting generation for prompt: "${prompt.substring(0, 100)}..."`);
    console.log(`[${buildId}] Session: ${sessionId}`);
    
    const sourceTemplateDir = path.join(__dirname, "../../react-base");
    const tempBuildDir = path.join(__dirname, "../../temp-builds", buildId);
let finalProjectId: number = projectId || 0;
let projectSaved = false;
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

      // UPDATE SESSION CONTEXT CODE...

// ADD THIS ENTIRE SECTION AFTER SESSION CONTEXT UPDATE
// CREATE OR UPDATE PROJECT RECORD
if (projectId) {
  console.log(`[${buildId}] 🔄 Updating existing project ${projectId}...`);
  try {
    await messageDB.updateProject(projectId, {
      name: `Updated Project ${buildId.substring(0, 8)}`,
      description: `Updated: ${prompt.substring(0, 100)}...`,
      status: 'regenerating',
      buildId: buildId,
      lastSessionId: sessionId,
      framework:  'react',
      template: 'vite-react-ts',
      lastMessageAt: new Date(),
      updatedAt: new Date()
    });
    finalProjectId = projectId;
    projectSaved = true;
    console.log(`[${buildId}] ✅ Updated existing project record: ${finalProjectId}`);
  } catch (updateError) {
    console.error(`[${buildId}] ❌ Failed to update existing project:`, updateError);
  }
} else {
  console.log(`[${buildId}] 💾 Creating new project record...`);
  try {
    finalProjectId = await messageDB.createProject({
      userId,
      name: `Generated Project ${buildId.substring(0, 8)}`,
      description:  `React project generated from prompt: ${prompt.substring(0, 100)}...`,
      status: 'generating',
      projectType: 'generated',
      deploymentUrl: '',
      downloadUrl: '',
      zipUrl: '',
      buildId: buildId,
      lastSessionId: sessionId,
      framework: 'react',
      template:  'vite-react-ts',
      lastMessageAt: new Date(),
      messageCount: 0
    });
    projectSaved = true;
    console.log(`[${buildId}] ✅ Created new project record: ${finalProjectId}`);
  } catch (projectError) {
    console.error(`[${buildId}] ❌ Failed to create project record:`, projectError);
  }
}
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

      // 3. Parse generated files with enhanced parser
      const claudeResponse = (resp.content[0] as any).text;
      
      let parsedResult: ParsedResult;
      try {
        console.log(`[${buildId}] 📝 Parsing generated code with enhanced parser...`);
        parsedResult = parseFrontendCode(claudeResponse);
        console.log(`[${buildId}] ✅ Code parsing successful`);
        console.log(`[${buildId}] 📊 Parsed ${parsedResult.codeFiles.length} files`);
      } catch (parseError) {
        console.error(`[${buildId}] ❌ Enhanced parser failed`);
        console.error(`[${buildId}] Parse error details:`, parseError);
        console.error(`[${buildId}] Claude response preview:`, claudeResponse.substring(0, 500));
        
        throw new Error(`Failed to parse Claude response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }

      // 4. Process files with enhanced validation
      console.log(`[${buildId}] 🔧 Processing files with enhanced validation...`);
      
      const processedProject = processTailwindProject(parsedResult.codeFiles);
      const {
        processedFiles,
        validationResult,
        supabaseValidation,
        tailwindConfig,
        supabaseFiles
      } = processedProject;

      // Log validation results
      console.log(`[${buildId}] 📊 File structure validation: ${validationResult.isValid ? '✅ Valid' : '❌ Invalid'}`);
      if (!validationResult.isValid) {
        console.warn(`[${buildId}] ⚠️ File structure issues:`, validationResult.errors);
      }

      console.log(`[${buildId}] 🗄️ Supabase validation: ${supabaseValidation.isValid ? '✅ Valid' : '❌ Invalid'}`);
      if (!supabaseValidation.isValid) {
        console.warn(`[${buildId}] ⚠️ Supabase issues:`, supabaseValidation.errors);
      }

      // Log Supabase files found
      if (supabaseFiles.allSupabaseFiles.length > 0) {
        console.log(`[${buildId}] 🗄️ Found ${supabaseFiles.allSupabaseFiles.length} Supabase files:`);
        console.log(`[${buildId}]   📄 Config: ${supabaseFiles.configFile ? '✅' : '❌'}`);
        console.log(`[${buildId}]   🗃️ Migrations: ${supabaseFiles.migrationFiles.length} files`);
        console.log(`[${buildId}]   🌱 Seed file: ${supabaseFiles.seedFile ? '✅' : '❌'}`);
        
        // Validate SQL syntax in migrations
        supabaseFiles.migrationFiles.forEach((migration, index) => {
          const hasProperSyntax = migration.content.includes('$$') && !migration.content.includes('AS $\n');
          console.log(`[${buildId}]   🔍 Migration ${index + 1} SQL syntax: ${hasProperSyntax ? '✅' : '❌'}`);
        });
      } else {
        console.log(`[${buildId}] 🗄️ No Supabase files detected in project`);
      }

      // Validate and log Tailwind config
      if (tailwindConfig) {
        const isValidConfig = validateTailwindConfig(tailwindConfig.content);
        console.log(`[${buildId}] 🎨 Tailwind config validation: ${isValidConfig ? '✅ Valid' : '❌ Invalid'}`);
        
        if (!isValidConfig) {
          const configContent = tailwindConfig.content;
          const issues = [];
          
          if (!configContent.includes('export default')) issues.push('Missing export default');
          if (!configContent.includes('content:')) issues.push('Missing content array');
          if (!configContent.includes('theme:')) issues.push('Missing theme configuration');
          if (configContent.includes('var(--')) issues.push('Contains CSS variables (not allowed)');
          if (configContent.includes('hsl(var(')) issues.push('Contains HSL variables (not allowed)');
          
          console.warn(`[${buildId}] 🔍 Tailwind config issues:`, issues);
        }

        // Show config preview
        const configLines = tailwindConfig.content.split('\n').slice(0, 10);
        console.log(`[${buildId}] 🔍 Tailwind config preview:`, configLines.join('\n'));
      } else {
        console.warn(`[${buildId}] ⚠️ No tailwind.config.ts found in generated files`);
      }

      // Generate comprehensive project summary
      const projectSummary = generateProjectSummary({
        codeFiles: processedFiles,
        structure: parsedResult.structure
      });

      console.log(`[${buildId}] 📊 Project Summary:`);
      console.log(`[${buildId}]   📁 Total files: ${projectSummary.totalFiles}`);
      console.log(`[${buildId}]   📂 File types: ${JSON.stringify(projectSummary.filesByType)}`);
      console.log(`[${buildId}]   🏗️ Structure depth: ${projectSummary.structureDepth}`);
      console.log(`[${buildId}]   ✅ Valid structure: ${projectSummary.hasValidStructure}`);

      // Final file structure log
      console.log(`[${buildId}] 📁 Final processed files (${processedFiles.length} total):`);
      processedFiles.forEach((file, index) => {
        const fileSize = file.content.length;
        const fileSizeKB = (fileSize / 1024).toFixed(1);
        console.log(`[${buildId}]   ${index + 1}. ${file.path} (${fileSizeKB}KB)`);
      });

      // Use processed files instead of original parsed files
      const parsedFiles: FileData[] = processedFiles;

      if (!parsedFiles || parsedFiles.length === 0) {
        throw new Error('No files generated from Claude response');
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

      // Update session context with enhanced project summary
      await sessionManager.updateSessionContext(sessionId, {
        projectSummary: {
          structure: parsedResult.structure,
          summary: projectSummary,
          validation: {
            fileStructure: validationResult,
            supabase: supabaseValidation,
            tailwind: tailwindConfig ? validateTailwindConfig(tailwindConfig.content) : false
          },
          supabaseInfo: {
            filesFound: supabaseFiles.allSupabaseFiles.length,
            hasConfig: !!supabaseFiles.configFile,
            migrationCount: supabaseFiles.migrationFiles.length,
            hasSeedFile: !!supabaseFiles.seedFile
          },
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

      // 8. Save assistant response to message history with enhanced data
      try {
        const assistantMessageId = await messageDB.addMessage(
          JSON.stringify({
            structure: parsedResult.structure,
            summary: projectSummary,
            validation: {
              fileStructure: validationResult.isValid,
              supabase: supabaseValidation.isValid,
              tailwind: tailwindConfig ? validateTailwindConfig(tailwindConfig.content) : false
            }
          }),
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
            // Use existing properties from your type definition
            fileModifications: parsedFiles.map(f => f.path),
            modificationSuccess: validationResult.isValid && supabaseValidation.isValid,
            modificationApproach: "FULL_FILE_GENERATION"
          }
        );
        console.log(`[${buildId}] 💾 Saved enhanced summary to messageDB (ID: ${assistantMessageId})`);
        console.log(`[${buildId}] 📊 Metadata: ${parsedFiles.length} files, validation: ${validationResult.isValid && supabaseValidation.isValid}`);
      } catch (dbError) {
        console.warn(`[${buildId}] ⚠️ Failed to save summary to messageDB:`, dbError);
      }

      // 9. Update Supabase database if projectId provided
// REPLACE PROJECT UPDATE SECTION WITH ENHANCED URL MANAGER
console.log(`[${buildId}] 💾 Using Enhanced URL Manager to save project URLs...`);
let projectAction = projectId ? 'updated_existing' : 'created_new';

if (finalProjectId && projectSaved) {
  try {
    console.log(`[${buildId}] 🔧 Calling Enhanced URL Manager to update project ${finalProjectId}...`);
    
    const updatedProjectId = await urlManager.saveNewProjectUrls(
      sessionId,
      finalProjectId,
      {
        deploymentUrl: previewUrl as string,
        downloadUrl: urls.downloadUrl,
        zipUrl: zipUrl
      },
      userId,
      {
        name:   `Generated Project ${buildId.substring(0, 8)}`,
        description:   `React project with enhanced validation`,
        framework:   'react',
        template:  'vite-react-ts'
      },
      supabaseUrl,
      supabaseAnonKey
    );

    if (updatedProjectId === finalProjectId) {
      projectAction = projectId ? 'existing_project_updated' : 'new_project_created';
      console.log(`[${buildId}] ✅ Enhanced URL Manager - Successfully ${projectId ? 'updated' : 'created'} project ${finalProjectId}`);
    } else {
      projectAction = 'project_id_mismatch';
      console.warn(`[${buildId}] ⚠️ Enhanced URL Manager returned different project ID: ${updatedProjectId} vs ${finalProjectId}`);
    }
    
  } catch (projectError) {
    console.error(`[${buildId}] ❌ Enhanced URL Manager failed:`, projectError);
    projectAction = 'url_manager_failed';
    
    // Fallback: Direct update
    try {
      await messageDB.updateProject(finalProjectId, {
        deploymentUrl: previewUrl as string,
        downloadUrl: urls.downloadUrl,
        zipUrl: zipUrl,
        status: 'ready',
        updatedAt: new Date()
      });
      projectAction = projectId ? 'existing_fallback_updated' : 'new_fallback_updated';
      console.log(`[${buildId}] ✅ Fallback update successful for project ${finalProjectId}`);
    } catch (fallbackError) {
      console.error(`[${buildId}] ❌ Fallback update also failed:`, fallbackError);
      projectAction = 'all_updates_failed';
    }
  }
} else {
  console.warn(`[${buildId}] ⚠️ No valid projectId to update URLs`);
  projectAction = 'no_project_to_update';
  projectSaved = false;
}

      // FIXED: Schedule cleanup for 1 hour later instead of immediate cleanup
      scheduleCleanup(buildId, 1); // 1 hour delay
      
      console.log(`[${buildId}] ✅ Build process completed successfully with enhanced validation`);
      
      res.json({
        success: true,
        files: parsedFiles,
        previewUrl: previewUrl, 
        downloadUrl: urls.downloadUrl,
        zipUrl: zipUrl,
        buildId: buildId,
        sessionId: sessionId,
        structure: parsedResult.structure,
        summary: projectSummary,
        validation: {
          fileStructure: validationResult,
          supabase: supabaseValidation,
          tailwindConfig: tailwindConfig ? validateTailwindConfig(tailwindConfig.content) : false
        },
        supabase: {
          filesFound: supabaseFiles.allSupabaseFiles.length,
          configExists: !!supabaseFiles.configFile,
          migrationCount: supabaseFiles.migrationFiles.length,
          seedFileExists: !!supabaseFiles.seedFile
        },
        tailwind: {
          configExists: !!tailwindConfig,
          validConfig: tailwindConfig ? validateTailwindConfig(tailwindConfig.content) : false
        },
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
    
    console.log(`[${buildId}] 🏁 Generation route completed with enhanced parser`);
  });

  return router;
}