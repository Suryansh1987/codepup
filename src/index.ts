import Anthropic from "@anthropic-ai/sdk";
import {
  BackendSystemPrompt,
  pro,
  pro2,
  pro3,
  pro4,
  pro5,
  pro5Enhanced,
  pro5Enhanced2,
  systemPrompt,
} from "./defaults/promt";
import "dotenv/config";
import * as fs from "fs";
import express from "express";
import path, { dirname } from "path";
const anthropic = new Anthropic();
const app = express();
import AdmZip from "adm-zip";
import cors from "cors";
import { FileContentParser } from "./defaults/classes";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";
import { IntelligentFileModifier } from "./services/filemodifier";
import { exec, execSync } from "child_process";
import { drizzle } from "drizzle-orm/neon-http";
import { v4 as uuidv4 } from "uuid";
import userRoutes from "./routes/users";
import projectRoutes from "./routes/projects";
import messageRoutes from "./routes/messages";
import { parseFrontendCode } from "./utils/newparser";
import { Request, Response } from "express";
import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import {
  uploadToAzureBlob,
  triggerAzureContainerJob,
  deployToSWA,
  runBuildAndDeploy,
} from "./services/azure-deploy";
app.use(cors());
app.use(express.json());
interface FileData {
  path: string;
  content: string;
}

console.log(process.env.DATABASE_URL);

app.get("/", (req, res) => {
  res.json("bckend is up");
});
app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/messages", messageRoutes);

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: "1.0.0",
  });
});

//@ts-ignore
app.post("/api/projects/generate", async (req: Request, res: Response) => {
  const {
    prompt,
    projectId,
    supabaseToken,
    databaseUrl,
    supabaseUrl,
    supabaseAnonKey,
  } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  const buildId = uuidv4();
  console.log(`[${buildId}] Starting Azure build for prompt: "${prompt}"`);

  const sourceTemplateDir = path.join(__dirname, "../react-base");
  const tempBuildDir = path.join(__dirname, "../temp-builds", buildId);

  try {
    //  1. Copy template and generate code
    await fs.promises.mkdir(tempBuildDir, { recursive: true });
    await fs.promises.cp(sourceTemplateDir, tempBuildDir, { recursive: true });

    console.log(`[${buildId}] Generating code from LLM...`);
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
    const parsedFrontend = parseFrontendCode((resp.content[0] as any).text);

    // Write generated files
    for (const file of parsedFrontend.codeFiles) {
      const fullPath = path.join(tempBuildDir, file.path);
      await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.promises.writeFile(fullPath, file.content, "utf8");
    }

    setTimeout(() => {
      Promise.resolve(true);
    }, 4000);
    // 2. Create zip and upload to Azure (instead of Supabase)
    console.log(`[${buildId}] Creating zip and uploading to Azure...`);
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
    console.log(zipUrl, "this is the url that is send for deployment");

    // 3. Trigger Azure Container Job (instead of local Docker + Vercel)
    console.log(`[${buildId}] Triggering Azure Container Job...`);

    const DistUrl = await triggerAzureContainerJob(zipUrl, buildId, {
      resourceGroup: process.env.AZURE_RESOURCE_GROUP!,
      containerAppEnv: process.env.AZURE_CONTAINER_APP_ENV!,
      acrName: process.env.AZURE_ACR_NAME!,
      storageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
      storageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME!,
      // ✅ Pass Supabase credentials from request body
      supabaseToken: supabaseToken,
      databaseUrl: databaseUrl,
      supabaseUrl: supabaseUrl,
      supabaseAnonKey: supabaseAnonKey,
    });

    const urls = JSON.parse(DistUrl);
    console.log(urls, "urll");
    const builtZipUrl = urls.downloadUrl;
    console.log(`[${buildId}] Deploying to SWA...`);
    const data = await runBuildAndDeploy(builtZipUrl, buildId, {
      VITE_SUPABASE_URL: supabaseUrl,
      VITE_SUPABASE_ANON_KEY: supabaseAnonKey,
    });
    console.log(data);
    if (projectId) {
      // Update your database with the new URL
    }

    res.json({
      success: true,
      previewUrl: data, // SWA preview URL
      downloadUrl: urls.downloadUrl, // ZIP download URLz
      buildId: buildId,
      hosting: "Azure Static Web Apps",
      features: [
        "Global CDN",
        "Auto SSL/HTTPS",
        "Custom domains support",
        "Staging environments",
      ],
    });

    // res.json({ parsedFrontend });
  } catch (error) {
    console.error(`[${buildId}] Build process failed:`, error);
    res.status(500).json({
      success: false,
      error: "Build process failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    console.log("done");
    //Clean up temp directory
    await fs.promises;
    // .rm(tempBuildDir, { recursive: true, force: true })
    // .catch(() => {});
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
