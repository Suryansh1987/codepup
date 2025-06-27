// This file contains helper functions for Azure deployment
// fuck this
import { BlobServiceClient } from "@azure/storage-blob";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
const execPromise = promisify(exec);

// Upload files to Azure Blob Storage
export async function uploadToAzureBlob(
  connectionString: string,
  containerName: string,
  blobName: string,
  data: Buffer
): Promise<string> {
  const blobServiceClient =
    BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.upload(data, data.length);
  return blockBlobClient.url;
}

// Trigger Azure Container App Job to build the project
export async function triggerAzureContainerJob(
  sourceZipUrl: string,
  buildId: string,
  config: {
    resourceGroup: string;
    containerAppEnv: string;
    acrName: string;
    storageConnectionString: string;
    storageAccountName: string;
  }
): Promise<string> {
  const buildJobName = `build-${buildId.substring(0, 8)}`;
  const deployJobName = `deploy-${buildId.substring(0, 8)}`;

  try {
    // Stage 1: Build Job
    console.log(`[${buildId}] Creating build job...`);
    await execPromise(`az containerapp job create \
      --name ${buildJobName} \
      --resource-group ${config.resourceGroup} \
      --environment ${config.containerAppEnv} \
      --image ${config.acrName}.azurecr.io/react-builder:m2 \
      --cpu 2.0 --memory 4.0Gi \
      --trigger-type Manual \
      --registry-server ${config.acrName}.azurecr.io \
      --registry-username ${process.env.ACR_USERNAME} \
      --registry-password ${process.env.ACR_PASSWORD} \
      --env-vars \
        SOURCE_ZIP_URL="${sourceZipUrl}" \
        BUILD_ID="${buildId}" \
        STORAGE_CONNECTION_STRING="${config.storageConnectionString}" \
        STORAGE_ACCOUNT_NAME="${config.storageAccountName}" \
      --replica-timeout 900 \
      --parallelism 1 \
      --replica-completion-count 1 \
      --replica-retry-limit 0`);

    // Start build job
    console.log(`[${buildId}] Starting build job...`);
    await execPromise(
      `az containerapp job start --name ${buildJobName} --resource-group ${config.resourceGroup}`
    );

    // Monitor build job
    let buildCompleted = false;
    let attempts = 0;
    while (attempts < 30 && !buildCompleted) {
      await new Promise((resolve) => setTimeout(resolve, 10000));

      const { stdout } = await execPromise(
        `az containerapp job execution list --name ${buildJobName} --resource-group ${config.resourceGroup} --query "[0].properties.status" -o tsv`
      );

      const status = stdout.trim();
      console.log(`[${buildId}] Build job status: ${status}`);

      if (status === "Succeeded") {
        buildCompleted = true;
      } else if (status === "Failed") {
        throw new Error("Build job failed");
      }
      attempts++;
    }

    if (!buildCompleted) {
      throw new Error("Build job timeout");
    }

    // Clean up build job
    await execPromise(
      `az containerapp job delete --name ${buildJobName} --resource-group ${config.resourceGroup} --yes`
    );

    // Stage 2: Deploy Job
    console.log(`[${buildId}] Creating deploy job...`);
    await execPromise(`az containerapp job create \
      --name ${deployJobName} \
      --resource-group ${config.resourceGroup} \
      --environment ${config.containerAppEnv} \
      --image ${config.acrName}.azurecr.io/react-deployer:m2 \
      --cpu 1.0 --memory 2.0Gi \
      --trigger-type Manual \
      --registry-server ${config.acrName}.azurecr.io \
      --registry-username ${process.env.ACR_USERNAME} \
      --registry-password ${process.env.ACR_PASSWORD} \
      --env-vars \
        BUILD_ID="${buildId}" \
        STORAGE_CONNECTION_STRING="${config.storageConnectionString}" \
        STORAGE_ACCOUNT_NAME="${config.storageAccountName}" \
        SWA_DEPLOYMENT_TOKEN="${process.env.AZURE_SWA_DEPLOYMENT_TOKEN}" \
        SWA_DEFAULT_HOSTNAME="${process.env.AZURE_SWA_DEFAULT_HOSTNAME}" \
      --replica-timeout 600 \
      --parallelism 1 \
      --replica-completion-count 1 \
      --replica-retry-limit 0`);

    // Start deploy job
    console.log(`[${buildId}] Starting deploy job...`);
    await execPromise(
      `az containerapp job start --name ${deployJobName} --resource-group ${config.resourceGroup}`
    );

    // Monitor deploy job
    let deployCompleted = false;
    attempts = 0;
    while (attempts < 20 && !deployCompleted) {
      await new Promise((resolve) => setTimeout(resolve, 10000));

      const { stdout } = await execPromise(
        `az containerapp job execution list --name ${deployJobName} --resource-group ${config.resourceGroup} --query "[0].properties.status" -o tsv`
      );

      const status = stdout.trim();
      console.log(`[${buildId}] Deploy job status: ${status}`);

      if (status === "Succeeded") {
        deployCompleted = true;
      } else if (status === "Failed") {
        throw new Error("Deploy job failed");
      }
      attempts++;
    }

    if (!deployCompleted) {
      throw new Error("Deploy job timeout");
    }

    // Clean up deploy job
    await execPromise(
      `az containerapp job delete --name ${deployJobName} --resource-group ${config.resourceGroup} --yes`
    );

    // Return URLs
    const previewUrl = `https://${process.env.AZURE_SWA_DEFAULT_HOSTNAME}`;
    const downloadUrl = `https://${config.storageAccountName}.blob.core.windows.net/build-outputs/${buildId}/build_${buildId}.zip`;

    return JSON.stringify({
      previewUrl,
      downloadUrl,
    });
  } catch (error) {
    console.error(`[${buildId}] Job execution failed:`, error);

    // Clean up jobs on error
    try {
      await execPromise(
        `az containerapp job delete --name ${buildJobName} --resource-group ${config.resourceGroup} --yes`
      ).catch(() => {});
      await execPromise(
        `az containerapp job delete --name ${deployJobName} --resource-group ${config.resourceGroup} --yes`
      ).catch(() => {});
    } catch (cleanupError) {
      console.error("Cleanup error:", cleanupError);
    }

    throw error;
  }
}

export async function deployToSWA(
  zipUrl: string,
  buildId: string
): Promise<{ previewUrl: string; downloadUrl: string }> {
  console.log(`[${buildId}] Starting SWA deployment from ZIP: ${zipUrl}`);

  const tempDir = path.join(__dirname, "../../temp", buildId);
  const tempZipPath = path.join(tempDir, "build.zip");
  const extractDir = path.join(tempDir, "extract");

  try {
    // Create temp directory
    await fs.promises.mkdir(tempDir, { recursive: true });

    // Download ZIP
    console.log(`[${buildId}] Downloading ZIP...`);
    const response = await fetch(zipUrl);
    if (!response.ok) {
      throw new Error(`Failed to download ZIP: ${response.statusText}`);
    }
    const zipBuffer = await response.arrayBuffer();
    await fs.promises.writeFile(tempZipPath, Buffer.from(zipBuffer));

    // Extract ZIP
    console.log(`[${buildId}] Extracting ZIP...`);
    await fs.promises.mkdir(extractDir, { recursive: true });

    const zip = new AdmZip(tempZipPath);
    zip.extractAllTo(extractDir, true);

    // Add SWA config
    const swaConfig = {
      navigationFallback: {
        rewrite: "/index.html",
        exclude: ["/assets/*", "/*.{css,js,ico,png,jpg,jpeg,gif,svg,json}"],
      },
      mimeTypes: {
        ".json": "application/json",
        ".js": "application/javascript",
        ".mjs": "application/javascript",
      },
      responseOverrides: {
        "404": {
          rewrite: "/index.html",
        },
      },
    };

    await fs.promises.writeFile(
      path.join(extractDir, "staticwebapp.config.json"),
      JSON.stringify(swaConfig, null, 2)
    );

    // List files for debugging
    console.log(`[${buildId}] Files to deploy:`);
    const files = await fs.promises.readdir(extractDir);
    console.log(files);

    // Deploy using SWA CLI
    console.log(`[${buildId}] Deploying to SWA...`);
    const deployCommand = `npx @azure/static-web-apps-cli@latest deploy "${extractDir}" --deployment-token "${process.env.AZURE_SWA_DEPLOYMENT_TOKEN}" --env production --verbose`;

    const { stdout, stderr } = await execPromise(deployCommand, {
      env: { ...process.env, FORCE_COLOR: "0" },
    });

    console.log(`[${buildId}] SWA Deploy output:`, stdout);
    if (stderr) {
      console.error(`[${buildId}] SWA Deploy stderr:`, stderr);
    }

    // Wait a bit for deployment to propagate
    console.log(`[${buildId}] Waiting for deployment to propagate...`);
    await new Promise((resolve) => setTimeout(resolve, 10000));

    const previewUrl = `https://${process.env.AZURE_SWA_DEFAULT_HOSTNAME}`;

    return {
      previewUrl,
      downloadUrl: zipUrl,
    };
  } finally {
    // Cleanup
    console.log(`[${buildId}] Cleaning up temporary files...`);
    await fs.promises
      .rm(tempDir, { recursive: true, force: true })
      .catch(() => {});
  }
}

// Helper function to fetch deployment info
async function fetchDeploymentInfo(
  storageAccountName: string,
  buildId: string
): Promise<any> {
  const url = `https://${storageAccountName}.blob.core.windows.net/build-outputs/${buildId}/deployment-info.json`;
  const response = await fetch(url);
  if (!response.ok) {
    // Fallback URLs if deployment info not found
    return {
      previewUrl: `https://${process.env.AZURE_SWA_DEFAULT_HOSTNAME}`,
      downloadUrl: `https://${storageAccountName}.blob.core.windows.net/build-outputs/${buildId}/build_${buildId}.zip`,
    };
  }
  return response.json();
}
