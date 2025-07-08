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
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
require("dotenv/config");
const fs = __importStar(require("fs"));
const express_1 = __importDefault(require("express"));
const anthropic = new sdk_1.default();
const app = (0, express_1.default)();
const cors_1 = __importDefault(require("cors"));
const child_process_1 = require("child_process");
const uuid_1 = require("uuid");
const users_1 = __importDefault(require("./routes/users"));
const projects_1 = __importDefault(require("./routes/projects"));
const messages_1 = __importDefault(require("./routes/messages"));
const azure_deploy_1 = require("./services/azure-deploy");
app.use((0, cors_1.default)());
app.use(express_1.default.json());
console.log(process.env.DATABASE_URL);
app.get("/", (req, res) => {
    res.json("bckend is up");
});
app.use("/api/users", users_1.default);
app.use("/api/projects", projects_1.default);
app.use("/api/messages", messages_1.default);
app.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        version: "1.0.0",
    });
});
//@ts-ignore
app.post("/api/projects/generate", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { prompt, projectId, supabaseToken, databaseUrl, supabaseUrl, supabaseAnonKey, } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
    }
    const buildId = (0, uuid_1.v4)();
    // console.log(`[${buildId}] Starting Azure build for prompt: "${prompt}"`);
    // const sourceTemplateDir = path.join(__dirname, "../react-base");
    // const tempBuildDir = path.join(__dirname, "../temp-builds", buildId);
    try {
        // //  1. Copy template and generate code
        // await fs.promises.mkdir(tempBuildDir, { recursive: true });
        // await fs.promises.cp(sourceTemplateDir, tempBuildDir, { recursive: true });
        // console.log(`[${buildId}] Generating code from LLM...`);
        // const frontendResult = await anthropic.messages
        //   .stream({
        //     model: "claude-sonnet-4-0",
        //     max_tokens: 50000,
        //     temperature: 1,
        //     system: pro5Enhanced2,
        //     messages: [
        //       {
        //         role: "user",
        //         content: [{ type: "text", text: prompt }],
        //       },
        //     ],
        //   })
        //   .on("text", (text) => {
        //     console.log(text);
        //   });
        // const resp = await frontendResult.finalMessage();
        // const parsedFrontend = parseFrontendCode((resp.content[0] as any).text);
        // // Write generated files
        // for (const file of parsedFrontend.codeFiles) {
        //   const fullPath = path.join(tempBuildDir, file.path);
        //   await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
        //   await fs.promises.writeFile(fullPath, file.content, "utf8");
        // }
        // setTimeout(() => {
        //   Promise.resolve(true);
        // }, 4000);
        // // 2. Create zip and upload to Azure (instead of Supabase)
        // console.log(`[${buildId}] Creating zip and uploading to Azure...`);
        // const zip = new AdmZip();
        // zip.addLocalFolder(tempBuildDir);
        // const zipBuffer = zip.toBuffer();
        // const zipBlobName = `${buildId}/source.zip`;
        // const zipUrl = await uploadToAzureBlob(
        //   process.env.AZURE_STORAGE_CONNECTION_STRING!,
        //   "source-zips",
        //   zipBlobName,
        //   zipBuffer
        // );
        // console.log(zipUrl, "this is the url that is send for deployment");
        // // 3. Trigger Azure Container Job (instead of local Docker + Vercel)
        // console.log(`[${buildId}] Triggering Azure Container Job...`);
        const DistUrl = yield (0, azure_deploy_1.triggerAzureContainerJob)("https://reactstore0823.blob.core.windows.net/source-zips/dcb59060-52ab-491d-8626-4ce95c5fbc83/source.zip", buildId, {
            resourceGroup: process.env.AZURE_RESOURCE_GROUP,
            containerAppEnv: process.env.AZURE_CONTAINER_APP_ENV,
            acrName: process.env.AZURE_ACR_NAME,
            storageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
            storageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
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
        const data = yield (0, azure_deploy_1.runBuildAndDeploy)(builtZipUrl, buildId, {
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
    }
    catch (error) {
        console.error(`[${buildId}] Build process failed:`, error);
        res.status(500).json({
            success: false,
            error: "Build process failed",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
    finally {
        console.log("done");
        //Clean up temp directory
        yield fs.promises;
        // .rm(tempBuildDir, { recursive: true, force: true })
        // .catch(() => {});
    }
}));
function execPromise(command, options) {
    return new Promise((resolve, reject) => {
        (0, child_process_1.exec)(command, options, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            }
            else {
                //@ts-ignore
                resolve({ stdout, stderr });
            }
        });
    });
}
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
//# sourceMappingURL=index.js.map