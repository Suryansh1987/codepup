"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadToAzureBlob = uploadToAzureBlob;
exports.triggerAzureContainerJob = triggerAzureContainerJob;
exports.deployToSWA = deployToSWA;
// This file contains helper functions for Azure deployment
// fuck this
const storage_blob_1 = require("@azure/storage-blob");
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const execPromise = (0, util_1.promisify)(child_process_1.exec);
// Upload files to Azure Blob Storage
function uploadToAzureBlob(connectionString, containerName, blobName, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const blobServiceClient = storage_blob_1.BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        yield blockBlobClient.upload(data, data.length);
        return blockBlobClient.url;
    });
}
// Trigger Azure Container App Job to build the project
function triggerAzureContainerJob(sourceZipUrl, buildId, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const buildJobName = `build-${buildId.substring(0, 8)}`;
        const deployJobName = `deploy-${buildId.substring(0, 8)}`;
        try {
            // Stage 1: Build Job
            console.log(`[${buildId}] Creating build job...`);
            yield execPromise(`az containerapp job create \
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
            yield execPromise(`az containerapp job start --name ${buildJobName} --resource-group ${config.resourceGroup}`);
            // Monitor build job
            let buildCompleted = false;
            let attempts = 0;
            while (attempts < 30 && !buildCompleted) {
                yield new Promise((resolve) => setTimeout(resolve, 10000));
                const { stdout } = yield execPromise(`az containerapp job execution list --name ${buildJobName} --resource-group ${config.resourceGroup} --query "[0].properties.status" -o tsv`);
                const status = stdout.trim();
                console.log(`[${buildId}] Build job status: ${status}`);
                if (status === "Succeeded") {
                    buildCompleted = true;
                }
                else if (status === "Failed") {
                    throw new Error("Build job failed");
                }
                attempts++;
            }
            if (!buildCompleted) {
                throw new Error("Build job timeout");
            }
            // Clean up build job
            yield execPromise(`az containerapp job delete --name ${buildJobName} --resource-group ${config.resourceGroup} --yes`);
            // Stage 2: Deploy Job
            console.log(`[${buildId}] Creating deploy job...`);
            yield execPromise(`az containerapp job create \
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
            yield execPromise(`az containerapp job start --name ${deployJobName} --resource-group ${config.resourceGroup}`);
            // Monitor deploy job
            let deployCompleted = false;
            attempts = 0;
            while (attempts < 20 && !deployCompleted) {
                yield new Promise((resolve) => setTimeout(resolve, 10000));
                const { stdout } = yield execPromise(`az containerapp job execution list --name ${deployJobName} --resource-group ${config.resourceGroup} --query "[0].properties.status" -o tsv`);
                const status = stdout.trim();
                console.log(`[${buildId}] Deploy job status: ${status}`);
                if (status === "Succeeded") {
                    deployCompleted = true;
                }
                else if (status === "Failed") {
                    throw new Error("Deploy job failed");
                }
                attempts++;
            }
            if (!deployCompleted) {
                throw new Error("Deploy job timeout");
            }
            // Clean up deploy job
            yield execPromise(`az containerapp job delete --name ${deployJobName} --resource-group ${config.resourceGroup} --yes`);
            // Return URLs
            const previewUrl = `https://${process.env.AZURE_SWA_DEFAULT_HOSTNAME}`;
            const downloadUrl = `https://${config.storageAccountName}.blob.core.windows.net/build-outputs/${buildId}/build_${buildId}.zip`;
            return JSON.stringify({
                previewUrl,
                downloadUrl,
            });
        }
        catch (error) {
            console.error(`[${buildId}] Job execution failed:`, error);
            // Clean up jobs on error
            try {
                yield execPromise(`az containerapp job delete --name ${buildJobName} --resource-group ${config.resourceGroup} --yes`).catch(() => { });
                yield execPromise(`az containerapp job delete --name ${deployJobName} --resource-group ${config.resourceGroup} --yes`).catch(() => { });
            }
            catch (cleanupError) {
                console.error("Cleanup error:", cleanupError);
            }
            throw error;
        }
    });
}
function deployToSWA(zipUrl, buildId) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[${buildId}] Starting SWA deployment from ZIP: ${zipUrl}`);
        const tempDir = path_1.default.join(__dirname, "../../temp", buildId);
        const tempZipPath = path_1.default.join(tempDir, "build.zip");
        const extractDir = path_1.default.join(tempDir, "extract");
        try {
            // Create temp directory
            yield fs.promises.mkdir(tempDir, { recursive: true });
            // Download ZIP
            console.log(`[${buildId}] Downloading ZIP...`);
            const response = yield fetch(zipUrl);
            if (!response.ok) {
                throw new Error(`Failed to download ZIP: ${response.statusText}`);
            }
            const zipBuffer = yield response.arrayBuffer();
            yield fs.promises.writeFile(tempZipPath, Buffer.from(zipBuffer));
            // Extract ZIP
            console.log(`[${buildId}] Extracting ZIP...`);
            yield fs.promises.mkdir(extractDir, { recursive: true });
            const zip = new adm_zip_1.default(tempZipPath);
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
            yield fs.promises.writeFile(path_1.default.join(extractDir, "staticwebapp.config.json"), JSON.stringify(swaConfig, null, 2));
            // List files for debugging
            console.log(`[${buildId}] Files to deploy:`);
            const files = yield fs.promises.readdir(extractDir);
            console.log(files);
            // Deploy using SWA CLI
            console.log(`[${buildId}] Deploying to SWA...`);
            const deployCommand = `npx @azure/static-web-apps-cli@latest deploy "${extractDir}" --deployment-token "${process.env.AZURE_SWA_DEPLOYMENT_TOKEN}" --env production --verbose`;
            const { stdout, stderr } = yield execPromise(deployCommand, {
                env: Object.assign(Object.assign({}, process.env), { FORCE_COLOR: "0" }),
            });
            console.log(`[${buildId}] SWA Deploy output:`, stdout);
            if (stderr) {
                console.error(`[${buildId}] SWA Deploy stderr:`, stderr);
            }
            // Wait a bit for deployment to propagate
            console.log(`[${buildId}] Waiting for deployment to propagate...`);
            yield new Promise((resolve) => setTimeout(resolve, 10000));
            const previewUrl = `https://${process.env.AZURE_SWA_DEFAULT_HOSTNAME}`;
            return {
                previewUrl,
                downloadUrl: zipUrl,
            };
        }
        finally {
            // Cleanup
            console.log(`[${buildId}] Cleaning up temporary files...`);
            yield fs.promises
                .rm(tempDir, { recursive: true, force: true })
                .catch(() => { });
        }
    });
}
// Helper function to fetch deployment info
function fetchDeploymentInfo(storageAccountName, buildId) {
    return __awaiter(this, void 0, void 0, function* () {
        const url = `https://${storageAccountName}.blob.core.windows.net/build-outputs/${buildId}/deployment-info.json`;
        const response = yield fetch(url);
        if (!response.ok) {
            // Fallback URLs if deployment info not found
            return {
                previewUrl: `https://${process.env.AZURE_SWA_DEFAULT_HOSTNAME}`,
                downloadUrl: `https://${storageAccountName}.blob.core.windows.net/build-outputs/${buildId}/build_${buildId}.zip`,
            };
        }
        return response.json();
    });
}
//# sourceMappingURL=azure-deploy.js.map