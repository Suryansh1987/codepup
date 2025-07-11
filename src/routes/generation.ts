import express, { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import {
  triggerAzureContainerJob,
  runBuildAndDeploy,
} from "../services/azure-deploy_fullstack";
import { DrizzleMessageHistoryDB } from '../db/messagesummary';
import { StatelessSessionManager } from './session';
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

export function initializeGenerationRoutes(
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
    
 
    const hardcodedZipUrl = "https://reactstore0823.blob.core.windows.net/build-outputs/e4f6176a-1299-40e2-a238-0a6cc00bd4f8/build_e4f6176a-1299-40e2-a238-0a6cc00bd4f8.zip";
    
    console.log(`[${buildId}] Starting generation for prompt: "${prompt.substring(0, 100)}..."`);
    console.log(`[${buildId}] Session: ${sessionId}`);
    console.log(`[${buildId}] Using hardcoded ZIP: ${hardcodedZipUrl}`);

    try {
      // 1. Trigger Azure Container Job with hardcoded ZIP
      console.log(`[${buildId}] 🔧 Triggering Azure Container Job...`);
      const DistUrl = await triggerAzureContainerJob(hardcodedZipUrl, buildId, {
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

      // 2. Deploy to Azure Static Web Apps
      console.log(`[${buildId}] 🚀 Deploying to SWA...`);
      const previewUrl = await runBuildAndDeploy(builtZipUrl, buildId, {
        VITE_SUPABASE_URL: supabaseUrl,
        VITE_SUPABASE_ANON_KEY: supabaseAnonKey,
      });
      console.log(`[${buildId}] 🌐 Deployed to:`, previewUrl);

      // 3. Save to message history
      try {
        const assistantMessageId = await messageDB.addMessage(
          `Generated project from prompt: ${prompt}`,
          'assistant',
          {
            promptType: 'frontend_generation',
            requestType: 'claude_response', 
            success: true,
            buildId: buildId,
            sessionId: sessionId,
            previewUrl: previewUrl,
            downloadUrl: urls.downloadUrl,
            zipUrl: hardcodedZipUrl,
          }
        );
        console.log(`[${buildId}] 💾 Saved to messageDB (ID: ${assistantMessageId})`);
      } catch (dbError) {
        console.warn(`[${buildId}] ⚠️ Failed to save to messageDB:`, dbError);
      }

      // 4. Update Supabase database if projectId provided
      if (projectId && supabaseUrl && supabaseAnonKey) {
        try {
          const supabase = createClient(supabaseUrl, supabaseAnonKey);
          await supabase
            .from('projects')
            .update({ 
              deployment_url: previewUrl,
              download_url: urls.downloadUrl,
              zip_url: hardcodedZipUrl,
              status: 'deployed'
            })
            .eq('id', projectId);
          console.log(`[${buildId}] ✅ Updated project ${projectId} in Supabase`);
        } catch (dbError) {
          console.warn(`[${buildId}] ⚠️ Failed to update Supabase:`, dbError);
        }
      }

      console.log(`[${buildId}] ✅ Build process completed successfully`);
      
      res.json({
        success: true,
        files: [], // Empty since we're not generating files
        previewUrl: previewUrl, 
        downloadUrl: urls.downloadUrl,
        zipUrl: hardcodedZipUrl,
        buildId: buildId,
        sessionId: sessionId,
        summary: `Generated project from prompt: ${prompt}`,
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

      res.status(500).json({
        success: false,
        error: 'Build process failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        buildId: buildId,
        sessionId: sessionId,
      });
    }
  });

  return router;
}