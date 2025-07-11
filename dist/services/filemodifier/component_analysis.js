"use strict";
// ============================================================================
// STEP 1: ANALYSIS & GENERATION ENGINE
// ============================================================================
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
exports.AnalysisAndGenerationEngine = exports.EnhancedBabelAnalyzer = void 0;
const path_1 = require("path");
const fs_1 = require("fs");
const babel = __importStar(require("@babel/parser"));
const traverse_1 = __importDefault(require("@babel/traverse"));
const t = __importStar(require("@babel/types"));
// ============================================================================
// ENHANCED BABEL ELEMENT TREE ANALYZER
// ============================================================================
class EnhancedBabelAnalyzer {
    constructor() {
        this.componentMap = new Map();
    }
    analyzeFile(content, filePath) {
        try {
            const ast = babel.parse(content, {
                sourceType: 'module',
                plugins: ['typescript', 'jsx']
            });
            const result = {
                imports: [],
                exports: [],
                dependencies: [],
                mainComponent: undefined,
                elementTree: undefined,
                isAppFile: false,
                isRouteFile: false,
                routingInfo: {
                    hasRouter: false,
                    routeComponents: [],
                    routingLibrary: undefined
                }
            };
            (0, traverse_1.default)(ast, {
                ImportDeclaration: (path) => this.analyzeImport(path.node, result),
                ExportDefaultDeclaration: (path) => this.analyzeDefaultExport(path.node, result),
                ExportNamedDeclaration: (path) => this.analyzeNamedExport(path.node, result),
                FunctionDeclaration: (path) => {
                    var _a;
                    if (this.isReactComponent(path.node)) {
                        result.mainComponent = (_a = path.node.id) === null || _a === void 0 ? void 0 : _a.name;
                        result.elementTree = this.buildElementTreeFromFunction(path.node);
                    }
                },
                VariableDeclarator: (path) => {
                    if (t.isArrowFunctionExpression(path.node.init) &&
                        t.isIdentifier(path.node.id) &&
                        this.isReactArrowComponent(path.node.init)) {
                        result.mainComponent = path.node.id.name;
                        result.elementTree = this.buildElementTreeFromArrow(path.node.init);
                    }
                },
                JSXElement: (path) => this.analyzeJSXForRouting(path.node, result)
            });
            result.isAppFile = this.isAppFile(filePath, result);
            result.isRouteFile = this.isRouteFile(filePath, result);
            if (result.mainComponent) {
                this.componentMap.set(result.mainComponent, filePath);
            }
            return result;
        }
        catch (error) {
            console.log(`Error analyzing file ${filePath}:`, error);
            return {
                imports: [],
                exports: [],
                dependencies: [],
                mainComponent: undefined,
                elementTree: undefined,
                isAppFile: false,
                isRouteFile: false
            };
        }
    }
    analyzeImport(node, result) {
        const source = node.source.value;
        if (['react-router-dom', 'react-router', '@reach/router', 'next/router'].includes(source)) {
            result.routingInfo.hasRouter = true;
            result.routingInfo.routingLibrary = source;
        }
        node.specifiers.forEach(spec => {
            let importInfo;
            if (t.isImportDefaultSpecifier(spec)) {
                importInfo = {
                    name: spec.local.name,
                    source,
                    type: 'default',
                    isComponent: this.isComponentImport(source, spec.local.name)
                };
            }
            else if (t.isImportSpecifier(spec)) {
                const importedName = t.isIdentifier(spec.imported) ? spec.imported.name : spec.imported.value;
                importInfo = {
                    name: importedName,
                    source,
                    type: 'named',
                    isComponent: this.isComponentImport(source, spec.local.name)
                };
                if (['BrowserRouter', 'Router', 'Route', 'Routes', 'Switch'].includes(importedName)) {
                    result.routingInfo.hasRouter = true;
                }
            }
            else if (t.isImportNamespaceSpecifier(spec)) {
                importInfo = {
                    name: spec.local.name,
                    source,
                    type: 'namespace',
                    isComponent: false
                };
            }
            else {
                return;
            }
            result.imports.push(importInfo);
            if (source.startsWith('./') || source.startsWith('../')) {
                result.dependencies.push(source);
            }
        });
    }
    analyzeDefaultExport(node, result) {
        let name = 'default';
        if (t.isIdentifier(node.declaration)) {
            name = node.declaration.name;
        }
        else if (t.isFunctionDeclaration(node.declaration) && node.declaration.id) {
            name = node.declaration.id.name;
        }
        result.exports.push({
            name,
            type: 'default',
            isComponent: this.isComponentName(name)
        });
    }
    analyzeNamedExport(node, result) {
        if (node.specifiers) {
            node.specifiers.forEach(spec => {
                if (t.isExportSpecifier(spec)) {
                    const name = t.isIdentifier(spec.exported) ? spec.exported.name : spec.exported.value;
                    result.exports.push({
                        name,
                        type: 'named',
                        isComponent: this.isComponentName(name)
                    });
                }
            });
        }
        if (node.declaration) {
            if (t.isFunctionDeclaration(node.declaration) && node.declaration.id) {
                result.exports.push({
                    name: node.declaration.id.name,
                    type: 'named',
                    isComponent: this.isComponentName(node.declaration.id.name)
                });
            }
            else if (t.isVariableDeclaration(node.declaration)) {
                node.declaration.declarations.forEach(decl => {
                    if (t.isIdentifier(decl.id)) {
                        result.exports.push({
                            name: decl.id.name,
                            type: 'named',
                            isComponent: this.isComponentName(decl.id.name)
                        });
                    }
                });
            }
        }
    }
    analyzeJSXForRouting(node, result) {
        const openingElement = node.openingElement;
        let tagName = '';
        // Get the tag name of the JSX element
        if (t.isJSXIdentifier(openingElement.name)) {
            tagName = openingElement.name.name;
        }
        // Check for known routing components
        if (['Route', 'Switch', 'Routes', 'Router', 'BrowserRouter'].includes(tagName)) {
            result.routingInfo.hasRouter = true;
            // Special handling for <Route component={...} />
            if (tagName === 'Route') {
                const componentAttr = openingElement.attributes.find(attr => t.isJSXAttribute(attr) &&
                    t.isJSXIdentifier(attr.name) &&
                    attr.name.name === 'component');
                // Ensure it's a JSXAttribute and safely access value
                if (componentAttr &&
                    t.isJSXAttribute(componentAttr) &&
                    componentAttr.value &&
                    t.isJSXExpressionContainer(componentAttr.value) &&
                    t.isIdentifier(componentAttr.value.expression)) {
                    result.routingInfo.routeComponents.push(componentAttr.value.expression.name);
                }
            }
        }
    }
    buildElementTreeFromFunction(node) {
        if (!node.body || !t.isBlockStatement(node.body))
            return undefined;
        const returnStatement = node.body.body.find(stmt => t.isReturnStatement(stmt));
        if (!(returnStatement === null || returnStatement === void 0 ? void 0 : returnStatement.argument))
            return undefined;
        return this.parseJSXElement(returnStatement.argument);
    }
    buildElementTreeFromArrow(node) {
        if (t.isBlockStatement(node.body)) {
            const returnStatement = node.body.body.find(stmt => t.isReturnStatement(stmt));
            if (!(returnStatement === null || returnStatement === void 0 ? void 0 : returnStatement.argument))
                return undefined;
            return this.parseJSXElement(returnStatement.argument);
        }
        else {
            return this.parseJSXElement(node.body);
        }
    }
    parseJSXElement(node) {
        if (t.isJSXElement(node)) {
            return this.createElementNode(node);
        }
        else if (t.isJSXFragment(node)) {
            return {
                tag: 'Fragment',
                isComponent: false,
                children: node.children.map(child => this.parseJSXElement(child)).filter(Boolean)
            };
        }
        else if (t.isParenthesizedExpression(node)) {
            return this.parseJSXElement(node.expression);
        }
        return undefined;
    }
    createElementNode(node) {
        const openingElement = node.openingElement;
        let tag = '';
        if (t.isJSXIdentifier(openingElement.name)) {
            tag = openingElement.name.name;
        }
        else if (t.isJSXMemberExpression(openingElement.name)) {
            tag = this.getJSXMemberExpressionName(openingElement.name);
        }
        const isComponent = this.isCustomComponent(tag);
        // Extract prop names only (no values, no classes)
        const props = openingElement.attributes
            .filter(attr => t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name))
            .map(attr => attr.name.name);
        // Parse children (simplified - no text content)
        const children = node.children
            .map(child => this.parseJSXElement(child))
            .filter(Boolean);
        return {
            tag,
            isComponent,
            children,
            props: props.length > 0 ? props : undefined
        };
    }
    getJSXMemberExpressionName(node) {
        if (t.isJSXIdentifier(node.object) && t.isJSXIdentifier(node.property)) {
            return `${node.object.name}.${node.property.name}`;
        }
        return 'Unknown';
    }
    isAppFile(filePath, result) {
        const fileName = filePath.toLowerCase();
        const hasAppName = fileName.includes('app.') || fileName.endsWith('/app.tsx') || fileName.endsWith('/app.jsx');
        const hasRouting = result.routingInfo.hasRouter;
        const hasMainExport = result.exports.some((exp) => exp.name === 'App' || exp.name === 'default');
        return hasAppName || (hasRouting && hasMainExport);
    }
    isRouteFile(filePath, result) {
        const fileName = filePath.toLowerCase();
        const hasRouteInName = fileName.includes('route') || fileName.includes('routes');
        const hasRouteComponents = result.routingInfo.routeComponents.length > 0;
        return hasRouteInName || hasRouteComponents;
    }
    isReactComponent(node) {
        return node.id ? this.isComponentName(node.id.name) : false;
    }
    isReactArrowComponent(node) {
        if (t.isJSXElement(node.body) || t.isJSXFragment(node.body))
            return true;
        if (t.isBlockStatement(node.body)) {
            const returnStmt = node.body.body.find(stmt => t.isReturnStatement(stmt));
            return returnStmt && (t.isJSXElement(returnStmt.argument) || t.isJSXFragment(returnStmt.argument));
        }
        return false;
    }
    isComponentName(name) {
        return /^[A-Z]/.test(name);
    }
    isCustomComponent(tagName) {
        return /^[A-Z]/.test(tagName);
    }
    isComponentImport(source, name) {
        return (source.startsWith('./') || source.startsWith('../')) && this.isComponentName(name);
    }
    getComponentMap() {
        return this.componentMap;
    }
    createElementTreeSummary(filePath, elementTree) {
        const summary = this.elementTreeToString(elementTree, 0);
        return `FILE: ${filePath}\nSTRUCTURE:\n${summary}`;
    }
    elementTreeToString(node, depth) {
        const indent = '  '.repeat(depth);
        let result = `${indent}<${node.tag}`;
        if (node.props && node.props.length > 0) {
            result += ` props=[${node.props.join(',')}]`;
        }
        result += `${node.isComponent ? ' [COMPONENT]' : ''}>\n`;
        for (const child of node.children) {
            result += this.elementTreeToString(child, depth + 1);
        }
        return result;
    }
}
exports.EnhancedBabelAnalyzer = EnhancedBabelAnalyzer;
// ============================================================================
// ANALYSIS & GENERATION ENGINE
// ============================================================================
class AnalysisAndGenerationEngine {
    constructor(anthropic, reactBasePath) {
        this.anthropic = anthropic;
        this.reactBasePath = (0, path_1.resolve)(reactBasePath);
        this.babelAnalyzer = new EnhancedBabelAnalyzer();
    }
    setStreamCallback(callback) {
        this.streamCallback = callback;
    }
    streamUpdate(message) {
        if (this.streamCallback) {
            this.streamCallback(message);
        }
        console.log(message);
    }
    /**
     * STEP 1: COMPLETE ANALYSIS AND GENERATION
     */
    analyzeAndGenerate(userPrompt) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('🔍 STEP 1: Starting Analysis & Generation...');
            try {
                // 1.1: Scan and analyze project files
                this.streamUpdate('📂 1.1: Scanning project files with Babel analysis...');
                const projectFiles = yield this.scanProjectFiles();
                // 1.2: Determine component type
                this.streamUpdate('🧠 1.2: Analyzing component type (page vs component)...');
                const componentTypeAnalysis = yield this.analyzeComponentType(userPrompt, projectFiles);
                this.streamUpdate(`📋 Component Analysis:`);
                this.streamUpdate(`   Type: ${componentTypeAnalysis.type.toUpperCase()}`);
                this.streamUpdate(`   Name: ${componentTypeAnalysis.name}`);
                this.streamUpdate(`   Target: ${componentTypeAnalysis.targetDirectory}/${componentTypeAnalysis.fileName}`);
                this.streamUpdate(`   Needs Routing: ${componentTypeAnalysis.needsRouting}`);
                // 1.3: Generate element tree context
                this.streamUpdate('🌳 1.3: Creating element tree context...');
                const elementTreeContext = this.createElementTreeContext(projectFiles);
                // 1.4: Analyze project patterns
                this.streamUpdate('📊 1.4: Analyzing project patterns...');
                const projectPatterns = this.analyzeProjectPatterns(projectFiles);
                this.streamUpdate(`   Export Pattern: ${projectPatterns.exportPattern}`);
                this.streamUpdate(`   Import Pattern: ${projectPatterns.importPattern}`);
                this.streamUpdate(`   Routing Pattern: ${projectPatterns.routingPattern}`);
                this.streamUpdate(`   App File: ${projectPatterns.appFilePath || 'NOT FOUND'}`);
                // 1.5: Extract existing routes
                this.streamUpdate('🛣️  1.5: Extracting existing routes...');
                const existingRoutes = this.extractExistingRoutes(projectFiles);
                this.streamUpdate(`   Found Routes: ${existingRoutes.join(', ') || 'NONE'}`);
                // 1.6: Generate the component/page
                this.streamUpdate('🎨 1.6: Generating component content...');
                const generatedContent = yield this.generateComponentContent(userPrompt, componentTypeAnalysis, elementTreeContext, projectPatterns, projectFiles);
                this.streamUpdate('✅ STEP 1 Complete: Analysis & Generation finished!');
                this.streamUpdate(`   📄 Generated ${generatedContent.length} characters of code`);
                return {
                    success: true,
                    generatedContent,
                    componentType: componentTypeAnalysis,
                    elementTreeContext,
                    projectPatterns,
                    componentMap: this.babelAnalyzer.getComponentMap(),
                    projectFiles,
                    existingRoutes,
                    error: undefined
                };
            }
            catch (error) {
                this.streamUpdate(`❌ STEP 1 Failed: ${error}`);
                return {
                    success: false,
                    generatedContent: '',
                    componentType: {
                        type: 'component',
                        name: 'Unknown',
                        confidence: 0,
                        reasoning: 'Failed to analyze',
                        targetDirectory: 'src/components',
                        fileName: 'Unknown.tsx',
                        needsRouting: false
                    },
                    elementTreeContext: '',
                    projectPatterns: {
                        exportPattern: 'default',
                        importPattern: 'default',
                        routingPattern: 'basic'
                    },
                    componentMap: new Map(),
                    projectFiles: new Map(),
                    existingRoutes: [],
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        });
    }
    scanProjectFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            const projectFiles = new Map();
            const scanDirectory = (dir) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const entries = yield fs_1.promises.readdir(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        const fullPath = (0, path_1.join)(dir, entry.name);
                        const relativePath = (0, path_1.relative)(this.reactBasePath, fullPath).replace(/\\/g, '/');
                        if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
                            yield scanDirectory(fullPath);
                        }
                        else if (entry.isFile() && this.isRelevantFile(entry.name)) {
                            try {
                                const content = yield fs_1.promises.readFile(fullPath, 'utf8');
                                const patterns = this.analyzeFilePatterns(content);
                                let babelAnalysis;
                                if (this.isReactFile(entry.name)) {
                                    babelAnalysis = this.babelAnalyzer.analyzeFile(content, relativePath);
                                }
                                projectFiles.set(relativePath, {
                                    path: fullPath,
                                    relativePath,
                                    content,
                                    lines: content.split('\n').length,
                                    fileType: this.determineFileType(entry.name),
                                    exportPattern: patterns.exportPattern,
                                    importPattern: patterns.importPattern,
                                    elementTree: babelAnalysis === null || babelAnalysis === void 0 ? void 0 : babelAnalysis.elementTree,
                                    imports: babelAnalysis === null || babelAnalysis === void 0 ? void 0 : babelAnalysis.imports,
                                    exports: babelAnalysis === null || babelAnalysis === void 0 ? void 0 : babelAnalysis.exports,
                                    mainComponent: babelAnalysis === null || babelAnalysis === void 0 ? void 0 : babelAnalysis.mainComponent,
                                    dependencies: babelAnalysis === null || babelAnalysis === void 0 ? void 0 : babelAnalysis.dependencies,
                                    isAppFile: babelAnalysis === null || babelAnalysis === void 0 ? void 0 : babelAnalysis.isAppFile,
                                    isRouteFile: babelAnalysis === null || babelAnalysis === void 0 ? void 0 : babelAnalysis.isRouteFile
                                });
                            }
                            catch (readError) {
                                // Skip unreadable files
                            }
                        }
                    }
                }
                catch (error) {
                    // Skip inaccessible directories
                }
            });
            yield scanDirectory(this.reactBasePath);
            const appFiles = Array.from(projectFiles.values()).filter(f => f.isAppFile);
            const routeFiles = Array.from(projectFiles.values()).filter(f => f.isRouteFile);
            const componentFiles = Array.from(projectFiles.values()).filter(f => f.mainComponent);
            this.streamUpdate(`   📊 Total files: ${projectFiles.size}`);
            this.streamUpdate(`   📱 App files: ${appFiles.length}`);
            this.streamUpdate(`   🛣️  Route files: ${routeFiles.length}`);
            this.streamUpdate(`   🧩 Component files: ${componentFiles.length}`);
            return projectFiles;
        });
    }
    analyzeComponentType(userPrompt, projectFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const fileList = Array.from(projectFiles.entries())
                .slice(0, 20) // Limit for token efficiency
                .map(([path, file]) => {
                let summary = `${path} (${file.fileType})`;
                if (file.mainComponent)
                    summary += ` - ${file.mainComponent}`;
                if (file.isAppFile)
                    summary += ` [APP]`;
                if (file.isRouteFile)
                    summary += ` [ROUTE]`;
                return summary;
            })
                .join('\n');
            const analysisPrompt = `
TASK: Analyze user prompt to determine if they want a PAGE or COMPONENT

USER PROMPT: "${userPrompt}"

PROJECT STRUCTURE (sample):
${fileList}

ANALYSIS CRITERIA:
- PAGE: Standalone views, routes, screens, dashboards, complete forms, login pages, profile pages
- COMPONENT: Reusable UI pieces, widgets, cards, modals, buttons, inputs, headers, footers

KEYWORDS ANALYSIS:
- PAGE indicators: "page", "screen", "dashboard", "view", "route", "login", "profile", "form page"
- COMPONENT indicators: "component", "button", "modal", "card", "widget", "header", "footer", "input"

EXAMPLES:
- "create a login page" → PAGE
- "create a dashboard page" → PAGE  
- "create a button component" → COMPONENT
- "create a modal component" → COMPONENT

RESPONSE (JSON only):
{
  "type": "page|component",
  "name": "PascalCaseName",
  "confidence": 85,
  "reasoning": "explanation of decision based on keywords and context",
  "targetDirectory": "src/pages|src/components",
  "fileName": "ComponentName.tsx",
  "needsRouting": true|false
}
`;
            const response = yield this.anthropic.messages.create({
                model: 'claude-3-5-sonnet-20240620',
                max_tokens: 1000,
                temperature: 0,
                messages: [{ role: 'user', content: analysisPrompt }]
            });
            const text = ((_a = response.content[0]) === null || _a === void 0 ? void 0 : _a.type) === 'text' ? response.content[0].text : '';
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Failed to parse component type analysis');
            }
            return JSON.parse(jsonMatch[0]);
        });
    }
    createElementTreeContext(projectFiles) {
        const contextSummaries = [];
        for (const [filePath, file] of projectFiles) {
            if (file.elementTree && file.mainComponent && !this.shouldSkipUIComponentFile(filePath)) {
                const summary = this.babelAnalyzer.createElementTreeSummary(filePath, file.elementTree);
                contextSummaries.push(summary);
            }
        }
        return contextSummaries.slice(0, 10).join('\n\n---\n\n');
    }
    analyzeProjectPatterns(projectFiles) {
        let routingPattern = 'basic';
        let appFilePath;
        let routeFilePath;
        // Find app file and routing pattern
        for (const [path, file] of projectFiles) {
            if (file.isAppFile) {
                appFilePath = path;
            }
            if (file.isRouteFile) {
                routeFilePath = path;
            }
            // Detect routing library
            if (file.imports) {
                for (const imp of file.imports) {
                    if (imp.source === 'react-router-dom') {
                        routingPattern = 'react-router';
                        break;
                    }
                    else if (imp.source === '@reach/router') {
                        routingPattern = 'reach-router';
                        break;
                    }
                    else if (imp.source.includes('next')) {
                        routingPattern = 'next';
                        break;
                    }
                }
            }
            if (routingPattern !== 'basic')
                break;
        }
        return {
            exportPattern: 'default',
            importPattern: 'default',
            routingPattern,
            appFilePath,
            routeFilePath
        };
    }
    extractExistingRoutes(projectFiles) {
        const routes = [];
        for (const file of projectFiles.values()) {
            if (file.isAppFile || file.isRouteFile) {
                // Extract route paths from content
                const routeMatches = file.content.match(/path=["']([^"']+)["']/g);
                if (routeMatches) {
                    routeMatches.forEach(match => {
                        const pathMatch = match.match(/path=["']([^"']+)["']/);
                        if (pathMatch) {
                            routes.push(pathMatch[1]);
                        }
                    });
                }
            }
        }
        return [...new Set(routes)]; // Remove duplicates
    }
    generateComponentContent(userPrompt, componentType, elementTreeContext, projectPatterns, projectFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const componentMap = this.babelAnalyzer.getComponentMap();
            const tailwindFile = projectFiles.get('tailwind.config.js');
            const prompt = `
🎯 TASK: Generate a complete ${componentType.type} component called "${componentType.name}"

📌 USER PROMPT:
"${userPrompt}"

🧱 COMPONENT DETAILS:
- Type: ${componentType.type}
- Name: ${componentType.name}
- Output File: ${componentType.targetDirectory}/${componentType.fileName}

📁 PROJECT PATTERNS:
- Export style: ${projectPatterns.exportPattern}
- Import style: ${projectPatterns.importPattern}
- Routing pattern: ${projectPatterns.routingPattern}

🌲 ELEMENT TREE CONTEXT:
${elementTreeContext || 'None'}

🗺️ COMPONENT MAP:
${Array.from(componentMap.entries()).map(([name, path]) => `• ${name} → ${path}`).join('\n')}

🎨 TAILWIND CONFIG SNIPPET (colors):
${tailwindFile ? tailwindFile.content.slice(0, 1000) : 'No tailwind config found'}

🧠 STYLE & DESIGN GUIDELINES:
- Use Tailwind utility classes based on the extended theme
- Use \`bg-primary\` for key backgrounds and call-to-action elements
- Use \`bg-secondary\` or \`bg-accent\` for visually separated sections
- Use \`text-*\`, \`hover:*\`, \`focus:*\`, \`ring-*\` meaningfully
- Animate with \`pulse-glow\`, \`fade-in\`, or \`accordion-*\` if needed
- Structure layout using semantic HTML (\`main\`, \`section\`, \`header\`, etc.)
- Design should be mobile-first and fully responsive

⚙️ REQUIREMENTS:
1. Default export: \`export default ${componentType.name}\`
2. Default internal imports: \`import X from './path'\`
3. Named UI imports: \`import { Button } from "@/components/ui/button"\`
4. Use TypeScript (.tsx)
5. Use full Tailwind utility classes (no placeholders)
6. Reflect project’s existing component structure
7. Provide working UI — no lorem ipsum
8. Must be responsive and accessible (a11y-friendly)
9. Follow good UX and hierarchy
10. Apply custom color theme (primary/secondary/accent) in real UI design

${componentType.type === 'page' ? `
📄 PAGE REQUIREMENTS:
- Create full page layout with real structure
- Add navigation if needed
- Use meaningful content (not dummy text)
- Use Tailwind sections and backgrounds with primary/secondary color theming
- Mobile responsive
` : `
🧩 COMPONENT REQUIREMENTS:
- Reusable and configurable via TypeScript props
- Follow React best practices
- Make the UI flexible, readable, and type-safe
- Use props with proper validation/interfaces
`}

🧾 RESPONSE FORMAT:
Return ONLY the complete ${componentType.type} code block:

\`\`\`tsx
[COMPLETE ${componentType.type.toUpperCase()} CODE]
\`\`\`
`.trim();
            const response = yield this.anthropic.messages.create({
                model: 'claude-3-5-sonnet-20240620',
                max_tokens: 4000,
                temperature: 0.3,
                messages: [{ role: 'user', content: prompt }]
            });
            const text = ((_a = response.content[0]) === null || _a === void 0 ? void 0 : _a.type) === 'text' ? response.content[0].text : '';
            const codeMatch = text.match(/```(?:tsx|typescript|jsx|javascript)\s*([\s\S]*?)```/);
            if (!codeMatch) {
                throw new Error('Failed to extract generated component code');
            }
            return codeMatch[1].trim();
        });
    }
    // Utility methods
    analyzeFilePatterns(content) {
        const hasDefaultExport = /export\s+default/.test(content);
        const hasNamedExport = /export\s+(const|function|class)/.test(content);
        const hasDefaultImport = /import\s+\w+\s+from/.test(content);
        const hasNamedImport = /import\s*\{[^}]+\}\s*from/.test(content);
        const exportPattern = hasDefaultExport && hasNamedExport ? 'mixed' :
            hasDefaultExport ? 'default' : 'named';
        const importPattern = hasDefaultImport && hasNamedImport ? 'mixed' :
            hasDefaultImport ? 'default' : 'named';
        return { exportPattern, importPattern };
    }
    shouldSkipDirectory(name) {
        return ['node_modules', '.git', '.next', 'dist', 'build', 'coverage'].includes(name) ||
            name.startsWith('.');
    }
    isRelevantFile(fileName) {
        return ['.tsx', '.ts', '.jsx', '.js', '.json'].some(ext => fileName.endsWith(ext));
    }
    isReactFile(fileName) {
        return ['.tsx', '.jsx'].some(ext => fileName.endsWith(ext));
    }
    shouldSkipUIComponentFile(filePath) {
        return filePath.includes('/components/ui/') ||
            filePath.includes('\\components\\ui\\') ||
            filePath.includes('/ui/') ||
            filePath.includes('\\ui\\');
    }
    determineFileType(fileName) {
        if (fileName.endsWith('.tsx') || fileName.endsWith('.jsx'))
            return 'react-component';
        if (fileName.endsWith('.ts') || fileName.endsWith('.js'))
            return 'javascript';
        if (fileName.endsWith('.json'))
            return 'config';
        return 'unknown';
    }
    /**
     * PUBLIC REFRESH METHOD
     */
    refreshFileStructure() {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('🔄 Refreshing file structure...');
            yield this.scanProjectFiles();
            this.streamUpdate('✅ File structure refreshed');
        });
    }
    /**
     * GET PROJECT ANALYSIS SUMMARY
     */
    getProjectAnalysisSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('📊 Generating project analysis summary...');
            try {
                const projectFiles = yield this.scanProjectFiles();
                const summaries = [];
                let componentCount = 0;
                let pageCount = 0;
                let appFiles = 0;
                let routeFiles = 0;
                let elementTreeCount = 0;
                for (const [filePath, file] of projectFiles) {
                    if (file.mainComponent) {
                        if (file.isAppFile)
                            appFiles++;
                        if (file.isRouteFile)
                            routeFiles++;
                        const isPage = filePath.includes('/pages/') || filePath.includes('\\pages\\');
                        if (isPage)
                            pageCount++;
                        else
                            componentCount++;
                        let summary = `${isPage ? 'PAGE' : 'COMPONENT'}: ${file.mainComponent} (${filePath})`;
                        if (file.elementTree) {
                            elementTreeCount++;
                            const tagCount = this.countElementTags(file.elementTree);
                            summary += `\n  - Structure: ${tagCount} elements`;
                            if (file.elementTree.tag) {
                                summary += `\n  - Root: <${file.elementTree.tag}>`;
                            }
                        }
                        if (file.imports && file.imports.length > 0) {
                            const componentImports = file.imports.filter(imp => imp.isComponent);
                            if (componentImports.length > 0) {
                                summary += `\n  - Component Imports: ${componentImports.map(imp => imp.name).join(', ')}`;
                            }
                        }
                        if (file.isAppFile)
                            summary += '\n  - [APP FILE]';
                        if (file.isRouteFile)
                            summary += '\n  - [ROUTE FILE]';
                        summaries.push(summary);
                    }
                }
                const header = `ANALYSIS & GENERATION ENGINE - PROJECT SUMMARY
===============================================
📁 Total files: ${projectFiles.size}
🧩 Components: ${componentCount}
📄 Pages: ${pageCount}
📱 App files: ${appFiles}
🛣️  Route files: ${routeFiles}
🌳 Element trees: ${elementTreeCount}

DETAILED ANALYSIS:
`;
                return header + summaries.join('\n\n');
            }
            catch (error) {
                return `Failed to generate project analysis summary: ${error}`;
            }
        });
    }
    countElementTags(node) {
        let count = 1;
        for (const child of node.children) {
            count += this.countElementTags(child);
        }
        return count;
    }
}
exports.AnalysisAndGenerationEngine = AnalysisAndGenerationEngine;
//# sourceMappingURL=component_analysis.js.map