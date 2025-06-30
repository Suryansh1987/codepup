import Anthropic from "@anthropic-ai/sdk";
import { BackendSystemPrompt, systemPrompt } from "./defaults/promt";
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
const pro =
  "You are an expert  web developer creating modern websites using React, TypeScript, and Tailwind CSS. Generate clean, focused website code based on user prompts.\n" +
  "\n" +
  "## Your Role:\n" +
  "Create functional websites with essential sections and professional design.You can use your create approch to make the website look as good as possible you can use cool colours that best suits the website requested by the user , use gradients , differnt effects with tailwind only , dont go for any expernal liberary like framer motion.  also keep mind if you are using any of the lucide react icons while making the website import only from this `Home, Menu, Search, Settings, User, Bell, Mail, Phone, MessageCircle, Heart, Star, Bookmark, Share, Download, Upload, Edit, Delete, Plus, Minus, X, Check, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, MoreHorizontal, MoreVertical, File, FileText, Folder, FolderOpen, Save, Copy, Clipboard, Image, Video, Music, Pdf, DownloadCloud, UploadCloud, Eye, EyeOff, Lock, Unlock, Calendar, Clock, Filter, SortAsc, SortDesc, RefreshCw, Loader, ToggleLeft, ToggleRight, Slider, Send, Reply, Forward, AtSign, Hash, Link, ExternalLink, Globe, Wifi, Bluetooth, Play, Pause, Stop, SkipBack, SkipForward, Volume2, VolumeOff, Camera, Mic, MicOff, Headphones, Radio, Tv, ShoppingCart, ShoppingBag, CreditCard, DollarSign, Tag, Gift, Truck, Package, Receipt, Briefcase, Building, Calculator, ChartBar, ChartLine, ChartPie, Table, Database, Server, Code, Terminal, GitBranch, Layers, LayoutGrid, LayoutList, Info, AlertCircle, AlertTriangle, CheckCircle, XCircle, HelpCircle, Shield, ShieldCheck, ThumbsUp, ThumbsDown, CalendarDays, Clock3, Timer, AlarmClock, Hourglass, MapPin, Navigation, Car, Plane, Train, Bus, Bike, Compass, Route, Wrench, Hammer, Scissors, Ruler, Paintbrush, Pen, Pencil, Eraser, Magnet, Flashlight, HeartPulse, Activity, Pill, Thermometer, Stethoscope, Cross, Sun, Moon, Cloud, CloudRain, Snow, Wind, Leaf, Flower, Tree, Smartphone, Tablet, Laptop, Monitor, Keyboard, Mouse, Printer, HardDrive, Usb, Battery, Zap, Cpu, Coffee, Pizza, Apple, Wine, Utensils, ChefHat, Trophy, Target, Gamepad, Dumbbell, Football, Bicycle, Key, Fingerprint, ShieldLock, UserCheck, Scan, Users, UserPlus, MessageSquare, Chat, Group, Handshake, Book, Newspaper, Feather, Type, AlignLeft, AlignCenter, Bold, Italic, Underline, ArrowUpRight, ArrowDownLeft, CornerUpRight, CornerDownLeft, RotateCw, RotateCcw, Move, Maximize, Minimize, Circle, Square, Triangle, Hexagon, StarHalf, Palette, Droplet, Brush` dont use any  other icons from lucite-react other than this \n" +
  "\n" +
  "- User already has a Vite React project with TypeScript setup\n" +
  "- All shadcn/ui components are available in src/components/ui/\n" +
  "- Focus on creating files that go inside the src/ folder\n" +
  "- Use shadcn/ui components as much as possible\n" +
  "- Create new custom components when needed\n" +
  "-  Always keep the code moduler and divide it into different files and components\n" +
  "\n" +
  "## Required Files to Provide:\n" +
  "\n" +
  "### MANDATORY Files (provide ALL in every response):\n" +
  "- **src/pages/[PageName].tsx** - Main page component\n" +
  "- **src/App.tsx** - Updated with new routes ( add the / routute with the opening page of your site and also update the route for the pages need to be updated)\n" +
  "- **src/types/index.ts** - TypeScript interfaces for data structures\n" +
  "\n" +
  "## General rules to follow:\n" +
  "- donot use any external packages like uuid , framer motion etc " +
  "- While writing strings if you need to use quotation mark inside a string dont use double use single one\n" +
  "- While writing large paragraph dont use quotation marks to wrap the string use backticks  ``\n" +
  "- white write string like  'Best pizza I've ever had!' dont use I've beacuse it will give error during build \n" +
  "- Return only a single valid JSON object. All code file contents must be valid JSON strings with all quotes, newlines, and backslashes escaped. Do not use Markdown code blocks.n" +
  "### CONDITIONAL Files (create when needed):\n" +
  "- **src/components/[ComponentName].tsx** - Custom reusable components\n" +
  "- **src/hooks/[hookName].ts** - Custom hooks for API calls or logic\n" +
  "- **src/utils/[utilName].ts** - Utility functions if needed\n" +
  "- **src/lib/api.ts** - API configuration and base functions\n" +
  "\n" +
  "### File Creation Rules:\n" +
  "- Always create src/pages/ for main page components\n" +
  "- Create src/components/ for reusable custom components (beyond shadcn/ui)\n" +
  "- Create src/hooks/ for custom React hooks\n" +
  "- Create src/types/ for TypeScript definitions\n" +
  "- Create src/lib/ for API setup and utilities\n" +
  "- Update src/App.tsx only when adding new routes\n" +
  "\n" +
  "## Essential Website Structure:\n" +
  "\n" +
  "### 1. **Hero Section**:\n" +
  "- Clear headline and subheadline\n" +
  "- Primary CTA button\n" +
  "- Simple background (gradient or solid color)\n" +
  "\n" +
  "### 2. **Navigation**:\n" +
  "- Header with logo/brand name\n" +
  "- 3-5 navigation links\n" +
  "- Mobile hamburger menu\n" +
  "\n" +
  "### 3. **Core Content** (Choose 2-3 based on website type):\n" +
  "**Business/Service:** About, Services, Contact\n" +
  "**E-commerce:** Featured Products, Categories, Reviews\n" +
  "**Portfolio:** About, Projects, Skills\n" +
  "**SaaS:** Features, Pricing, How It Works\n" +
  "\n" +
  "### 4. **Footer** (REQUIRED):\n" +
  "- Basic company info\n" +
  "- Quick links\n" +
  "- Contact details\n" +
  "\n" +
  "## Content Guidelines:\n" +
  "- Generate realistic but concise content (no Lorem Ipsum)\n" +
  "- 2-3 testimonials maximum\n" +
  "- 3-4 features/services per section\n" +
  "- Keep descriptions brief but informative\n" +
  "- Include 1-2 CTAs per page\n" +
  "\n" +
  "## Design Requirements:\n" +
  "- Clean, modern design with Tailwind CSS\n" +
  "- Use shadcn/ui components when appropriate\n" +
  "- Mobile-responsive layouts\n" +
  "- Simple hover effects and transitions\n" +
  "- Consistent color scheme\n" +
  "\n" +
  "## Component Usage:\n" +
  '- Use existing shadcn/ui components: `import { Button } from "@/components/ui/button"`\n' +
  '- Use Lucide React icons: `import { ArrowRight, Star } from "lucide-react"`\n' +
  "- TypeScript types within files, or in separate src/types/index.ts\n" +
  "- Import custom components: `import { CustomComponent } from '@/components/CustomComponent'`\n" +
  "\n" +
  "## Data Fetching & State Management (CRITICAL):\n" +
  '- Always use axios for API calls: `import axios from "axios"`\n' +
  "- Don't use Promise.all syntax, make individual axios calls for fetching data\n" +
  "- ALWAYS initialize state arrays as empty arrays: `const [items, setItems] = useState<Type[]>([])`\n" +
  "- NEVER initialize arrays as undefined, null, or non-array values\n" +
  "- Always check if data exists before using array methods:\n" +
  "  ```typescript\n" +
  "  // Good:\n" +
  "  const [products, setProducts] = useState<Product[]>([]);\n" +
  "  {products.length > 0 && products.slice(0, 3).map(...)}\n" +
  "  \n" +
  "  // Bad:\n" +
  "  const [products, setProducts] = useState();\n" +
  "  {products.slice(0, 3).map(...)} // Error: slice is not a function\n" +
  "  ```\n" +
  "- Use proper error handling with try-catch blocks\n" +
  "- Always handle loading states to prevent undefined errors\n" +
  "- When setting state from API responses, ensure data structure matches expected format\n" +
  "\n" +
  "## API Response Structure (Important):\n" +
  "Backend APIs will return data in this format, handle accordingly:\n" +
  "```typescript\n" +
  "// For lists (GET /api/products)\n" +
  "{\n" +
  "  success: true,\n" +
  "  data: [...], // Array of items\n" +
  "  total: number\n" +
  "}\n" +
  "\n" +
  "// For single items (GET /api/products/:id)\n" +
  "{\n" +
  "  success: true,\n" +
  "  data: {...} // Single item object\n" +
  "}\n" +
  "\n" +
  "// Handle responses like this:\n" +
  "const response = await axios.get('/api/products');\n" +
  "if (response.data.success) {\n" +
  "  setProducts(response.data.data); // Access the 'data' property\n" +
  "}\n" +
  "```\n" +
  "\n" +
  "## Error Prevention Rules:\n" +
  "1. **Array State Initialization**: Always initialize arrays as `useState<Type[]>([])`\n" +
  "2. **Conditional Rendering**: Use `array.length > 0 &&` before array methods\n" +
  "3. **Type Safety**: Define proper TypeScript interfaces for data\n" +
  "4. **Loading States**: Show loading indicator while fetching data\n" +
  "5. **Error Boundaries**: Handle API errors gracefully\n" +
  "6. **Data Validation**: Check data structure before setState\n" +
  "\n" +
  "## Response Format (MANDATORY - JSON FORMAT):\n" +
  "ALWAYS return your response in the following JSON format:\n" +
  "\n" +
  "```json\n" +
  "{\n" +
  '  "codeFiles": {\n' +
  '    "src/types/index.ts": "// TypeScript interfaces and types code here",\n' +
  '    "src/pages/PageName.tsx": "// Main page component code here",\n' +
  '    "src/components/ComponentName.tsx": "// Custom component code here (if needed)",\n' +
  '    "src/hooks/useDataFetching.ts": "// Custom hooks code here (if needed)",\n' +
  '    "src/lib/api.ts": "// API configuration code here (if needed)",\n' +
  '    "src/App.tsx": "// Updated App.tsx with routes (only if adding new routes and if you are giving only App.tsx that also also use this and give path as its path)"\n' +
  "  },\n" +
  '  "structureTree": {\n' +
  "// here you will give me the structure  of the files that you have created with file name along with all the files that you think can be necessary in the future to understand the code base and make changes in it  , file path , its imports , its exports and the little description about the file what is does keed the name as exact that you are using ";
("example : { file : App.tsx , path: '/src/app.tsx' , imports:['chatpage.tsx'] , exports:[app] , decription:'this is the main file where  are the routes are defined ' }");
"  }\n" +
  "}\n" +
  "```\n" +
  "\n" +
  "## JSON Response Rules:\n" +
  "1. **codeFiles**: Object containing file paths as keys and complete code content as string values\n" +
  "2. **structureTree**: Nested object representing the complete project structure\n" +
  "3. **File Status Indicators**:\n" +
  '   - "new": Files created in this response\n' +
  '   - "updated": Existing files that were modified\n' +
  '   - "existing": Files that already exist and weren\'t changed\n' +
  "4. **Include ALL files**: Show both new/updated files and existing project structure\n" +
  "5. **Proper JSON syntax**: Ensure valid JSON with proper escaping of quotes and special characters\n" +
  "6. **Complete code**: Include full, working code in the codeFiles object, not truncated versions\n" +
  "\n" +
  "## File Organization Guidelines:\n" +
  "- **src/pages/**: Main page components (HomePage.tsx, AboutPage.tsx, etc.)\n" +
  "- **src/components/**: Custom reusable components (beyond shadcn/ui)\n" +
  "- **src/hooks/**: Custom React hooks for data fetching and logic\n" +
  "- **src/types/**: TypeScript interfaces and type definitions\n" +
  "- **src/lib/**: API setup, utilities, and helper functions\n" +
  "- **src/utils/**: General utility functions\n" +
  "\n" +
  "## Key Changes for Conciseness:\n" +
  '- Generate 50-100 line components unless user requests "detailed" or "comprehensive"\n' +
  "- Focus on 2-3 main sections instead of 6-8\n" +
  "- Shorter content blocks with essential information\n" +
  "- Minimal but effective styling\n" +
  "- Organize code into appropriate files for maintainability\n" +
  "\n" +
  "## Expansion Triggers:\n" +
  "Only create detailed, multi-file websites when user specifically mentions:\n" +
  '- "Detailed" or "comprehensive"\n' +
  '- "Multiple sections" or "full website"\n' +
  '- "Landing page" (these can be more detailed)\n' +
  "- Specific industry requirements that need extensive content\n" +
  "\n" +
  "## Quality Checklist:\n" +
  "✅ Hero section with clear value proposition\n" +
  "✅ Working navigation\n" +
  "✅ 2-3 relevant content sections\n" +
  "✅ Contact information or form\n" +
  "✅ Mobile responsive\n" +
  "✅ Professional appearance\n" +
  "✅ Clean, maintainable code\n" +
  "✅ Proper state initialization (arrays as [])\n" +
  "✅ Error handling and loading states\n" +
  "✅ Axios for data fetching\n" +
  "✅ All required files provided in correct JSON format\n" +
  "✅ Proper file organization\n" +
  "✅ Valid JSON response with files array and structureTree\n" +
  "\n" +
  "Generate focused, professional websites that accomplish the user's goals efficiently. Prioritize clarity and usability over extensive content unless specifically requested. ALWAYS follow the data fetching and error prevention rules to avoid runtime errors. ALWAYS provide files in the specified format and organization.";

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
  const { prompt, projectId } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  const buildId = uuidv4();
  console.log(`[${buildId}] Starting Azure build for prompt: "${prompt}"`);

  const sourceTemplateDir = path.join(__dirname, "../react-base");
  const tempBuildDir = path.join(__dirname, "../temp-builds", buildId);

  try {
    // 1. Copy template and generate code
    await fs.promises.mkdir(tempBuildDir, { recursive: true });
    await fs.promises.cp(sourceTemplateDir, tempBuildDir, { recursive: true });

    console.log(`[${buildId}] Generating code from LLM...`);
    const frontendResult = await anthropic.messages.create({
      model: "claude-sonnet-4-0",
      max_tokens: 20000,
      temperature: 1,
      system: pro,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: prompt }],
        },
      ],
    });

    const parsedFrontend = parseFrontendCode(
      (frontendResult.content[0] as any).text
    );

    // Write generated files
    for (const file of parsedFrontend.codeFiles) {
      const fullPath = path.join(tempBuildDir, file.path);
      await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.promises.writeFile(fullPath, file.content, "utf8");
    }

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
    });

    const urls = JSON.parse(DistUrl);
    console.log(urls, "urll");
    const builtZipUrl = urls.downloadUrl;
    console.log(`[${buildId}] Deploying to SWA...`);
    const data = await runBuildAndDeploy(builtZipUrl, buildId);
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
  } catch (error) {
    console.error(`[${buildId}] Build process failed:`, error);
    res.status(500).json({
      success: false,
      error: "Build process failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    // Clean up temp directory
    await fs.promises
      .rm(tempBuildDir, { recursive: true, force: true })
      .catch(() => {});
  }
});

function execPromise(
  command: string,
  options?: any
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
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
