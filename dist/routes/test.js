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
exports.initializeGenerationRoutes = initializeGenerationRoutes;
const express_1 = __importDefault(require("express"));
const uuid_1 = require("uuid");
const adm_zip_1 = __importDefault(require("adm-zip"));
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const azure_deploy_fullstack_1 = require("../services/azure-deploy_fullstack");
const newparser_1 = require("../utils/newparser");
const promt_1 = require("../defaults/promt");
const supabase_js_1 = require("@supabase/supabase-js");
const router = express_1.default.Router();
// FIXED: Better cleanup with proper error handling and timing
function cleanupTempDirectory(buildId) {
    return __awaiter(this, void 0, void 0, function* () {
        const tempBuildDir = path_1.default.join(__dirname, "../../temp-builds", buildId);
        try {
            if (fs.existsSync(tempBuildDir)) {
                yield fs.promises.rm(tempBuildDir, { recursive: true, force: true });
                console.log(`[${buildId}] 🧹 Temp directory cleaned up`);
            }
            else {
                console.log(`[${buildId}] 🧹 Temp directory already cleaned or doesn't exist`);
            }
        }
        catch (error) {
            console.warn(`[${buildId}] ⚠️ Failed to cleanup temp directory:`, error);
        }
    });
}
// ADDED: Schedule cleanup with better timing control
function scheduleCleanup(buildId, delayInHours = 1) {
    const delayMs = delayInHours * 60 * 60 * 1000; // Convert hours to milliseconds
    setTimeout(() => __awaiter(this, void 0, void 0, function* () {
        console.log(`[${buildId}] 🕐 Scheduled cleanup starting after ${delayInHours} hour(s)`);
        yield cleanupTempDirectory(buildId);
    }), delayMs);
    console.log(`[${buildId}] ⏰ Cleanup scheduled for ${delayInHours} hour(s) from now`);
}
function initializeGenerationRoutes(anthropic, messageDB, sessionManager) {
    router.post("/", (req, res) => __awaiter(this, void 0, void 0, function* () {
        const { prompt, projectId, supabaseToken, databaseUrl, supabaseUrl, supabaseAnonKey, } = req.body;
        if (!prompt) {
            res.status(400).json({
                success: false,
                error: "Prompt is required"
            });
            return;
        }
        const buildId = (0, uuid_1.v4)();
        const sessionId = sessionManager.generateSessionId();
        console.log(`[${buildId}] Starting generation for prompt: "${prompt.substring(0, 100)}..."`);
        console.log(`[${buildId}] Session: ${sessionId}`);
        const sourceTemplateDir = path_1.default.join(__dirname, "../../react-base");
        const tempBuildDir = path_1.default.join(__dirname, "../../temp-builds", buildId);
        try {
            // Save initial session context
            yield sessionManager.saveSessionContext(sessionId, {
                buildId,
                tempBuildDir: '',
                lastActivity: Date.now()
            });
            // 1. Setup temp directory
            yield fs.promises.mkdir(tempBuildDir, { recursive: true });
            yield fs.promises.cp(sourceTemplateDir, tempBuildDir, { recursive: true });
            console.log(`[${buildId}] 📁 Temp directory created: ${tempBuildDir}`);
            // Update session with temp directory
            yield sessionManager.updateSessionContext(sessionId, { tempBuildDir });
            // 2. Generate code with Claude
            console.log(`[${buildId}] 🚀 Generating frontend code...`);
            const frontendResult = yield anthropic.messages
                .stream({
                model: "claude-sonnet-4-0",
                max_tokens: 50000,
                temperature: 1,
                system: promt_1.pro5Enhanced2,
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
            const resp = yield frontendResult.finalMessage();
            console.log(`[${buildId}] ✅ Code generation completed`);
            // 3. Parse generated files with enhanced error handling
            const claudeResponse = resp.content[0].text;
            let parsedFrontend;
            try {
                console.log(`[${buildId}] 📝 Parsing generated code with robust parser...`);
                parsedFrontend = (0, newparser_1.parseFrontendCodeRobust)(claudeResponse);
                console.log(`[${buildId}] ✅ Code parsing successful with robust parser`);
            }
            catch (parseError) {
                console.error(`[${buildId}] ❌ Robust parser failed, analyzing input...`);
                (0, newparser_1.debugInput)(claudeResponse);
                try {
                    console.log(`[${buildId}] 🔄 Attempting fallback to original parser...`);
                    parsedFrontend = (0, newparser_1.parseFrontendCode)(claudeResponse);
                    console.log(`[${buildId}] ✅ Fallback parser succeeded`);
                }
                catch (fallbackError) {
                    console.error(`[${buildId}] ❌ All parsing attempts failed`);
                    console.error(`[${buildId}] Parse error details:`, parseError);
                    console.error(`[${buildId}] Fallback error details:`, fallbackError);
                    console.error(`[${buildId}] Claude response preview:`, claudeResponse.substring(0, 500));
                    throw new Error(`Failed to parse Claude response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
                }
            }
            let parsedFiles = parsedFrontend.codeFiles;
            console.log(`[${buildId}] 🔧 Processing ${parsedFiles.length} generated files...`);
            // Validate file structure before processing
            const structureValidation = (0, newparser_1.validateFileStructure)(parsedFiles);
            if (!structureValidation.isValid) {
                console.warn(`[${buildId}] ⚠️ File structure issues found:`, structureValidation.errors);
            }
            parsedFiles = (0, newparser_1.correctFilePaths)(parsedFiles);
            parsedFiles = (0, newparser_1.ensureTailwindConfigFirst)(parsedFiles);
            console.log(`[${buildId}] 📁 Final file structure:`);
            parsedFiles.forEach((file, index) => {
                console.log(`[${buildId}]   ${index + 1}. ${file.path} (${file.content.length} chars)`);
            });
            // Extract project summary
            let projectSummary;
            console.log(`[${buildId}] Response has ${resp.content.length} content blocks`);
            if (resp.content.length > 1 && resp.content[1]) {
                projectSummary = resp.content[1].text;
                console.log(`[${buildId}] 📋 Using Claude summary from content[1]`);
            }
            else if (parsedFrontend.structure) {
                projectSummary = parsedFrontend.structure;
                console.log(`[${buildId}] 📋 Using parser-generated summary`);
            }
            else {
                console.log(`[${buildId}] 📋 Using fallback summary`);
                projectSummary = parsedFiles.reduce((acc, file) => {
                    const pathParts = file.path.split('/');
                    let current = acc;
                    for (let i = 0; i < pathParts.length - 1; i++) {
                        if (!current[pathParts[i]]) {
                            current[pathParts[i]] = {};
                        }
                        current = current[pathParts[i]];
                    }
                    current[pathParts[pathParts.length - 1]] = 'file';
                    return acc;
                }, {});
            }
            if (!parsedFiles || parsedFiles.length === 0) {
                throw new Error('No files generated from Claude response');
            }
            // Validate Tailwind config
            const tailwindConfig = (0, newparser_1.getTailwindConfig)(parsedFiles);
            if (tailwindConfig) {
                const configLines = tailwindConfig.content.split('\n').slice(0, 10);
                console.log(`[${buildId}] 🔍 Tailwind config preview:`, configLines.join('\n'));
                const isValidConfig = (0, newparser_1.validateTailwindConfig)(tailwindConfig.content);
                if (isValidConfig) {
                    console.log(`[${buildId}] ✅ Tailwind config validation passed`);
                }
                else {
                    console.warn(`[${buildId}] ⚠️ Tailwind config validation failed - this may cause build issues`);
                    const configContent = tailwindConfig.content;
                    const issues = [];
                    if (!configContent.includes('export default'))
                        issues.push('Missing export default');
                    if (!configContent.includes('content:'))
                        issues.push('Missing content array');
                    if (!configContent.includes('theme:'))
                        issues.push('Missing theme configuration');
                    if (configContent.includes('var(--'))
                        issues.push('Contains CSS variables (not allowed)');
                    console.warn(`[${buildId}] 🔍 Config issues found:`, issues);
                }
            }
            else {
                console.warn(`[${buildId}] ⚠️ No tailwind.config.ts found in generated files`);
            }
            console.log(`[${buildId}] 💾 Writing ${parsedFiles.length} files...`);
            const fileMap = {};
            // Write files with error handling
            for (const file of parsedFiles) {
                try {
                    const fullPath = path_1.default.join(tempBuildDir, file.path);
                    yield fs.promises.mkdir(path_1.default.dirname(fullPath), { recursive: true });
                    yield fs.promises.writeFile(fullPath, file.content, "utf8");
                    fileMap[file.path] = file.content;
                    console.log(`[${buildId}] ✅ Written: ${file.path}`);
                }
                catch (writeError) {
                    console.error(`[${buildId}] ❌ Failed to write ${file.path}:`, writeError);
                    throw new Error(`Failed to write file ${file.path}: ${writeError}`);
                }
            }
            // Cache all files in session
            yield sessionManager.cacheProjectFiles(sessionId, fileMap);
            console.log(`[${buildId}] 📦 Cached ${Object.keys(fileMap).length} files in session`);
            // FIXED: Proper delay for file system operations
            console.log(`[${buildId}] ⏳ Allowing file system operations to complete...`);
            yield new Promise(resolve => setTimeout(resolve, 2000));
            console.log(`[${buildId}] 📦 Creating zip and uploading to Azure...`);
            const zip = new adm_zip_1.default();
            zip.addLocalFolder(tempBuildDir);
            const zipBuffer = zip.toBuffer();
            const zipBlobName = `${buildId}/source.zip`;
            const zipUrl = yield (0, azure_deploy_fullstack_1.uploadToAzureBlob)(process.env.AZURE_STORAGE_CONNECTION_STRING, "source-zips", zipBlobName, zipBuffer);
            console.log(`[${buildId}] 📤 Source uploaded:`, zipUrl);
            // Update session context with project summary
            yield sessionManager.updateSessionContext(sessionId, {
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
            const DistUrl = yield (0, azure_deploy_fullstack_1.triggerAzureContainerJob)(zipUrl, buildId, {
                resourceGroup: process.env.AZURE_RESOURCE_GROUP,
                containerAppEnv: process.env.AZURE_CONTAINER_APP_ENV,
                acrName: process.env.AZURE_ACR_NAME,
                storageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
                storageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
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
            const previewUrl = yield (0, azure_deploy_fullstack_1.runBuildAndDeploy)(builtZipUrl, buildId, {
                VITE_SUPABASE_URL: supabaseUrl,
                VITE_SUPABASE_ANON_KEY: supabaseAnonKey,
            });
            console.log(`[${buildId}] 🌐 Deployed to:`, previewUrl);
            // 8. Save assistant response to message history
            try {
                const assistantMessageId = yield messageDB.addMessage(
                //@ts-ignore
                projectSummary, 'assistant', {
                    promptType: 'frontend_generation',
                    requestType: 'claude_response',
                    success: true,
                    buildId: buildId,
                    sessionId: sessionId,
                    previewUrl: previewUrl,
                    downloadUrl: urls.downloadUrl,
                    zipUrl: zipUrl,
                });
                console.log(`[${buildId}] 💾 Saved summary to messageDB (ID: ${assistantMessageId})`);
            }
            catch (dbError) {
                console.warn(`[${buildId}] ⚠️ Failed to save summary to messageDB:`, dbError);
            }
            // 9. Update Supabase database if projectId provided
            if (projectId && supabaseUrl && supabaseAnonKey) {
                try {
                    const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey);
                    yield supabase
                        .from('projects')
                        .update({
                        deployment_url: previewUrl,
                        download_url: urls.downloadUrl,
                        zip_url: zipUrl,
                        status: 'deployed'
                    })
                        .eq('id', projectId);
                    console.log(`[${buildId}] ✅ Updated project ${projectId} in Supabase`);
                }
                catch (dbError) {
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
        }
        catch (error) {
            console.error(`[${buildId}] ❌ Build process failed:`, error);
            if (error instanceof Error) {
                console.error(`[${buildId}] Error name:`, error.name);
                console.error(`[${buildId}] Error message:`, error.message);
                console.error(`[${buildId}] Error stack:`, error.stack);
            }
            // Save error to messageDB
            try {
                yield messageDB.addMessage(`Frontend generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'assistant', {
                    promptType: 'frontend_generation',
                    requestType: 'claude_response',
                    success: false,
                    buildId: buildId,
                    sessionId: sessionId,
                });
            }
            catch (dbError) {
                console.warn(`[${buildId}] ⚠️ Failed to save error to messageDB:`, dbError);
            }
            // Cleanup session on error
            yield sessionManager.cleanup(sessionId);
            // FIXED: Only cleanup temp directory on error, not on success
            yield cleanupTempDirectory(buildId);
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
    }));
    return router;
}
//# sourceMappingURL=test.js.map