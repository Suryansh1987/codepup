"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFrontendCode = parseFrontendCode;
exports.parseFrontendCodeRobust = parseFrontendCodeRobust;
exports.flattenStructure = flattenStructure;
exports.getFileStatus = getFileStatus;
exports.getCodeFileByPath = getCodeFileByPath;
exports.getTailwindConfig = getTailwindConfig;
exports.ensureTailwindConfigFirst = ensureTailwindConfigFirst;
exports.validateTailwindConfig = validateTailwindConfig;
exports.validateFileStructure = validateFileStructure;
exports.correctFilePaths = correctFilePaths;
exports.debugInput = debugInput;
exports.testJsonFixes = testJsonFixes;
exports.analyzeJsonStructure = analyzeJsonStructure;
exports.fixCommonJsonIssues = fixCommonJsonIssues;
exports.attemptJsonParsing = attemptJsonParsing;
exports.robustJsonParse = robustJsonParse;
function unescapeString(str) {
    return str
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t")
        .replace(/\\r/g, "\r")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
}
function fixCommonJsonIssues(jsonString) {
    let fixed = jsonString;
    // Fix 1: Remove leading commas after opening braces
    fixed = fixed.replace(/{\s*,/g, '{');
    // Fix 2: Remove trailing commas before closing braces/brackets
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
    // Fix 3: Remove multiple consecutive commas
    fixed = fixed.replace(/,\s*,+/g, ',');
    // Fix 4: Remove commas before closing brackets in arrays
    fixed = fixed.replace(/,(\s*])/g, '$1');
    // Fix 5: Fix wrong bracket types (common AI generation error)
    // Only fix obvious cases at the start
    if (fixed.startsWith('{]')) {
        fixed = fixed.replace(/^{\]/, '{');
    }
    // Fix 6: Remove leading commas in objects after newlines
    fixed = fixed.replace(/(\n\s*),(\s*")/g, '$1$2');
    // Fix 7: Fix missing quotes around property names (basic case)
    fixed = fixed.replace(/{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '{"$1":');
    return fixed;
}
function attemptJsonParsing(jsonString) {
    console.log('DEBUG: Attempting to parse JSON...');
    // First, try parsing as-is
    try {
        const result = JSON.parse(jsonString);
        console.log('DEBUG: ✅ Original JSON parsed successfully');
        return result;
    }
    catch (error) {
        //@ts-ignore
        console.log('DEBUG: ❌ Original JSON parse failed:', error.message);
        //@ts-ignore
        const errorMatch = error.message.match(/position (\d+)/);
        const errorPosition = errorMatch ? parseInt(errorMatch[1]) : 0;
        console.log('DEBUG: Character at error position:', JSON.stringify(jsonString.charAt(errorPosition)));
        console.log('DEBUG: Context around error:', JSON.stringify(jsonString.substring(Math.max(0, errorPosition - 10), errorPosition + 10)));
    }
    // Try to fix common issues
    console.log('DEBUG: Attempting to fix common JSON issues...');
    const fixedJson = fixCommonJsonIssues(jsonString);
    if (fixedJson !== jsonString) {
        console.log('DEBUG: Applied fixes to JSON');
        console.log('DEBUG: Original first 50 chars:', JSON.stringify(jsonString.substring(0, 50)));
        console.log('DEBUG: Fixed first 50 chars:', JSON.stringify(fixedJson.substring(0, 50)));
        try {
            const result = JSON.parse(fixedJson);
            console.log('DEBUG: ✅ Fixed JSON parsed successfully!');
            return result;
        }
        catch (fixError) {
            //@ts-ignore
            console.log('DEBUG: ❌ Even fixed JSON failed:', fixError.message);
            //@ts-ignore
            const fixErrorMatch = fixError.message.match(/position (\d+)/);
            const fixErrorPosition = fixErrorMatch ? parseInt(fixErrorMatch[1]) : 0;
            console.log('DEBUG: Fix error character:', JSON.stringify(fixedJson.charAt(fixErrorPosition)));
            console.log('DEBUG: Fix error context:', JSON.stringify(fixedJson.substring(Math.max(0, fixErrorPosition - 10), fixErrorPosition + 10)));
        }
    }
    else {
        console.log('DEBUG: No automatic fixes could be applied');
    }
    // If we get here, both attempts failed
    console.log('DEBUG: All parsing attempts failed');
    console.log('DEBUG: Dumping first 200 characters for manual inspection:');
    console.log(JSON.stringify(jsonString.substring(0, 200)));
    throw new Error(`JSON parsing failed after attempting automatic fixes`);
}
function extractJsonFromText(input) {
    console.log('DEBUG: Input length:', input.length);
    console.log('DEBUG: First 100 chars:', JSON.stringify(input.substring(0, 100)));
    // Remove markdown code blocks if present
    let cleanInput = input.replace(/```json\s*\n?/g, "").replace(/```\s*$/g, "");
    // Also remove other code block patterns
    cleanInput = cleanInput.replace(/```\w*\s*\n?/g, "").replace(/```\s*$/g, "");
    // Remove any leading/trailing whitespace
    cleanInput = cleanInput.trim();
    console.log('DEBUG: After cleanup, first 100 chars:', JSON.stringify(cleanInput.substring(0, 100)));
    // Find the first opening brace and last closing brace
    const firstBrace = cleanInput.indexOf("{");
    const lastBrace = cleanInput.lastIndexOf("}");
    console.log('DEBUG: First brace position:', firstBrace);
    console.log('DEBUG: Last brace position:', lastBrace);
    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
        console.error('DEBUG: No valid JSON braces found');
        console.error('DEBUG: Input sample:', cleanInput.substring(0, 500));
        throw new Error("No valid JSON object found in input");
    }
    const extracted = cleanInput.substring(firstBrace, lastBrace + 1);
    console.log('DEBUG: Extracted JSON length:', extracted.length);
    console.log('DEBUG: JSON starts with:', JSON.stringify(extracted.substring(0, 50)));
    return extracted;
}
function parseFrontendCode(input) {
    try {
        console.log('DEBUG: Starting parseFrontendCode');
        // Extract JSON from the input text
        const jsonString = extractJsonFromText(input);
        // Parse JSON with enhanced error handling and auto-fixing
        const data = attemptJsonParsing(jsonString);
        console.log('DEBUG: JSON parsed successfully');
        // Validate required properties
        if (!data.codeFiles || typeof data.codeFiles !== "object") {
            console.error('DEBUG: Invalid codeFiles:', typeof data.codeFiles);
            throw new Error("Missing or invalid codeFiles property");
        }
        if (!data.structureTree || typeof data.structureTree !== "object") {
            console.error('DEBUG: Invalid structureTree:', typeof data.structureTree);
            throw new Error("Missing or invalid structureTree property");
        }
        console.log('DEBUG: Validation passed, processing files');
        console.log('DEBUG: Number of code files found:', Object.keys(data.codeFiles).length);
        // Extract and unescape code files
        const codeFiles = Object.entries(data.codeFiles).map(([path, content]) => ({
            path,
            content: unescapeString(content),
        }));
        // Extract structure tree (no unescaping needed for structure)
        const structure = data.structureTree;
        console.log('DEBUG: Successfully created ParsedResult');
        return {
            codeFiles,
            structure,
        };
    }
    catch (error) {
        console.error('DEBUG: parseFrontendCode failed');
        console.error('DEBUG: Error details:', error);
        throw new Error(`Failed to parse frontend code data: ${error instanceof Error ? error.message : String(error)}`);
    }
}
// Test the fixes
function testJsonFixes() {
    console.log('\n=== Testing JSON Auto-Fixes ===');
    const testCases = [
        '{ , "test": "value" }', // Leading comma
        '{ "test": "value", }', // Trailing comma
        '{ "test": "value",, "other": "val" }', // Double comma
        '{ "arr": [1, 2, 3,] }', // Trailing comma in array
        '{] "test": "value" }', // Wrong bracket
        '{\n, "test": "value" }', // Leading comma after newline
        '{ test: "value" }', // Missing quotes around property name
    ];
    testCases.forEach((testJson, index) => {
        console.log(`\nTest ${index + 1}: ${JSON.stringify(testJson)}`);
        try {
            const fixed = fixCommonJsonIssues(testJson);
            console.log(`Fixed: ${JSON.stringify(fixed)}`);
            JSON.parse(fixed);
            console.log('✅ Parse successful after fix');
        }
        catch (error) {
            //@ts-ignore
            console.log('❌ Still failed after fix:', error.message);
        }
    });
}
// Helper function to flatten structure tree for easier navigation
function flattenStructure(structure, basePath = "") {
    const paths = [];
    for (const [key, value] of Object.entries(structure)) {
        const currentPath = basePath ? `${basePath}/${key}` : key;
        if (typeof value === "string") {
            // This is a file
            paths.push(currentPath);
        }
        else if (typeof value === "object" && value !== null) {
            // This is a directory, recurse
            paths.push(...flattenStructure(value, currentPath));
        }
    }
    return paths;
}
// Helper function to get file status from structure
function getFileStatus(structure, filePath) {
    const pathParts = filePath.split("/");
    let current = structure;
    for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (typeof current[part] === "object" && current[part] !== null) {
            current = current[part];
        }
        else {
            return null; // Path doesn't exist
        }
    }
    const fileName = pathParts[pathParts.length - 1];
    const fileEntry = current[fileName];
    return typeof fileEntry === "string" ? fileEntry : null;
}
// Helper function to get code file by path
function getCodeFileByPath(codeFiles, path) {
    return codeFiles.find((file) => file.path === path) || null;
}
function ensureTailwindConfigFirst(codeFiles) {
    const tailwindConfigIndex = codeFiles.findIndex(file => file.path === 'tailwind.config.ts' || file.path.endsWith('tailwind.config.ts'));
    if (tailwindConfigIndex === -1) {
        console.warn('No tailwind.config.ts file found in generated files');
        return codeFiles;
    }
    if (tailwindConfigIndex !== 0) {
        const tailwindConfig = codeFiles[tailwindConfigIndex];
        const reorderedFiles = [tailwindConfig, ...codeFiles.filter((_, index) => index !== tailwindConfigIndex)];
        console.log('Moved tailwind.config.ts to first position');
        return reorderedFiles;
    }
    return codeFiles;
}
function validateTailwindConfig(content) {
    const requiredElements = [
        'export default',
        'content:',
        'theme:',
        'extend:',
        'colors:'
    ];
    const cssVariablePatterns = [
        'hsl(var(',
        'var(--',
        'rgb(var(',
        'rgba(var(',
        'hsla(var('
    ];
    const hasCssVariables = cssVariablePatterns.some(pattern => content.includes(pattern));
    const hasRequiredElements = requiredElements.every(element => content.includes(element));
    if (!hasRequiredElements) {
        const missing = requiredElements.filter(element => !content.includes(element));
        console.warn('Missing required elements:', missing);
    }
    if (hasCssVariables) {
        const foundPatterns = cssVariablePatterns.filter(pattern => content.includes(pattern));
        console.warn('Found CSS variables (not allowed):', foundPatterns);
    }
    return hasRequiredElements && !hasCssVariables;
}
function correctFilePaths(codeFiles) {
    return codeFiles.map(file => {
        // Files that should stay at root level
        const rootLevelFiles = [
            'tailwind.config.ts',
            '.env',
            '.env.local',
            '.env.development',
            '.env.production',
            '.env.example',
            'package.json',
            'tsconfig.json',
            'next.config.js',
            'next.config.ts',
            '.gitignore',
            'README.md',
            'docker-compose.yml',
            'Dockerfile'
        ];
        // Check if this file should stay at root level
        const shouldStayAtRoot = rootLevelFiles.some(rootFile => file.path === rootFile || file.path.endsWith(`/${rootFile}`));
        if (shouldStayAtRoot) {
            return file;
        }
        // Only move to src/ if it's not already there and not a root-level file
        if (!file.path.startsWith('src/')) {
            console.log(`Correcting file path: ${file.path} -> src/${file.path}`);
            return Object.assign(Object.assign({}, file), { path: `src/${file.path}` });
        }
        return file;
    });
}
function validateFileStructure(codeFiles) {
    const errors = [];
    const tailwindConfig = codeFiles.find(f => f.path === 'tailwind.config.ts');
    if (!tailwindConfig) {
        errors.push('tailwind.config.ts not found');
    }
    else if (tailwindConfig.path !== 'tailwind.config.ts') {
        errors.push(`tailwind.config.ts should be at root level, found at: ${tailwindConfig.path}`);
    }
    const nonTailwindFiles = codeFiles.filter(f => f.path !== 'tailwind.config.ts');
    for (const file of nonTailwindFiles) {
        if (!file.path.startsWith('src/')) {
            errors.push(`File ${file.path} should be in src/ folder`);
        }
    }
    return {
        isValid: errors.length === 0,
        errors
    };
}
function getTailwindConfig(codeFiles) {
    return codeFiles.find(file => file.path === 'tailwind.config.ts' || file.path.endsWith('tailwind.config.ts')) || null;
}
// Additional debugging function for troubleshooting
function debugInput(input) {
    console.log('=== DEBUG INPUT ANALYSIS ===');
    console.log('Input type:', typeof input);
    console.log('Input length:', input.length);
    console.log('Has opening brace:', input.includes('{'));
    console.log('Has closing brace:', input.includes('}'));
    console.log('First brace position:', input.indexOf('{'));
    console.log('Last brace position:', input.lastIndexOf('}'));
    console.log('First 200 characters:');
    console.log(JSON.stringify(input.substring(0, 200)));
    console.log('Last 200 characters:');
    console.log(JSON.stringify(input.substring(input.length - 200)));
    console.log('=== END DEBUG ===');
}
// Advanced debugging function for JSON parsing issues
function analyzeJsonStructure(jsonString) {
    console.log('\n=== JSON STRUCTURE ANALYSIS ===');
    // Count different bracket types
    const openBraces = (jsonString.match(/{/g) || []).length;
    const closeBraces = (jsonString.match(/}/g) || []).length;
    const openBrackets = (jsonString.match(/\[/g) || []).length;
    const closeBrackets = (jsonString.match(/]/g) || []).length;
    const quotes = (jsonString.match(/"/g) || []).length;
    const commas = (jsonString.match(/,/g) || []).length;
    console.log('Bracket counts:');
    console.log(`  Open braces {: ${openBraces}`);
    console.log(`  Close braces }: ${closeBraces}`);
    console.log(`  Open brackets [: ${openBrackets}`);
    console.log(`  Close brackets ]: ${closeBrackets}`);
    console.log(`  Quotes ": ${quotes}`);
    console.log(`  Commas ,: ${commas}`);
    console.log('Balance check:');
    console.log(`  Braces balanced: ${openBraces === closeBraces ? '✅' : '❌'}`);
    console.log(`  Brackets balanced: ${openBrackets === closeBrackets ? '✅' : '❌'}`);
    console.log(`  Quotes even: ${quotes % 2 === 0 ? '✅' : '❌'}`);
    // Find potential problem areas
    const problemPatterns = [
        { pattern: /{\s*,/, name: 'Leading comma after {' },
        { pattern: /,\s*}/, name: 'Trailing comma before }' },
        { pattern: /,\s*]/, name: 'Trailing comma before ]' },
        { pattern: /,\s*,/, name: 'Double comma' },
        { pattern: /{\]/, name: 'Wrong bracket type' },
        { pattern: /\[}/, name: 'Mismatched brackets' },
        { pattern: /"[^"]*\n[^"]*"/, name: 'String contains unescaped newline' },
    ];
    console.log('Problem patterns found:');
    problemPatterns.forEach(({ pattern, name }) => {
        const matches = jsonString.match(pattern);
        if (matches) {
            console.log(`  ❌ ${name}: ${matches.length} occurrence(s)`);
            console.log(`     Example: ${JSON.stringify(matches[0])}`);
        }
    });
    console.log('=== END ANALYSIS ===\n');
}
// Production-ready error handler with fallback strategies
function robustJsonParse(jsonString) {
    console.log('DEBUG: Starting robust JSON parsing...');
    // Strategy 1: Try original JSON
    try {
        return JSON.parse(jsonString);
    }
    catch (originalError) {
        console.log('DEBUG: Original parse failed, trying fixes...');
        // Strategy 2: Apply automatic fixes
        const fixedJson = fixCommonJsonIssues(jsonString);
        try {
            return JSON.parse(fixedJson);
        }
        catch (fixedError) {
            console.log('DEBUG: Fixed parse failed, analyzing structure...');
            // Strategy 3: Detailed analysis for debugging
            analyzeJsonStructure(jsonString);
            // Strategy 4: Try more aggressive fixes
            let aggressivelyFixed = fixedJson;
            // Remove all trailing commas more aggressively
            aggressivelyFixed = aggressivelyFixed.replace(/,(\s*[}\]])/g, '$1');
            // Fix unquoted property names
            aggressivelyFixed = aggressivelyFixed.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
            // Fix single quotes to double quotes
            aggressivelyFixed = aggressivelyFixed.replace(/'/g, '"');
            try {
                return JSON.parse(aggressivelyFixed);
            }
            catch (finalError) {
                console.error('DEBUG: All parsing strategies failed');
                //@ts-ignore
                throw new Error(`JSON parsing failed: ${originalError.message}. Original JSON preview: ${jsonString.substring(0, 100)}`);
            }
        }
    }
}
// Updated main parse function to use robust parsing
function parseFrontendCodeRobust(input) {
    try {
        console.log('DEBUG: Starting robust parseFrontendCode');
        // Extract JSON from the input text
        const jsonString = extractJsonFromText(input);
        // Parse JSON with all fallback strategies
        const data = robustJsonParse(jsonString);
        console.log('DEBUG: JSON parsed successfully');
        // Validate required properties
        if (!data.codeFiles || typeof data.codeFiles !== "object") {
            console.error('DEBUG: Invalid codeFiles:', typeof data.codeFiles);
            throw new Error("Missing or invalid codeFiles property");
        }
        if (!data.structureTree || typeof data.structureTree !== "object") {
            console.error('DEBUG: Invalid structureTree:', typeof data.structureTree);
            throw new Error("Missing or invalid structureTree property");
        }
        console.log('DEBUG: Validation passed, processing files');
        console.log('DEBUG: Number of code files found:', Object.keys(data.codeFiles).length);
        // Extract and unescape code files
        const codeFiles = Object.entries(data.codeFiles).map(([path, content]) => ({
            path,
            content: unescapeString(content),
        }));
        // Extract structure tree (no unescaping needed for structure)
        const structure = data.structureTree;
        console.log('DEBUG: Successfully created ParsedResult');
        return {
            codeFiles,
            structure,
        };
    }
    catch (error) {
        console.error('DEBUG: parseFrontendCodeRobust failed');
        console.error('DEBUG: Error details:', error);
        throw new Error(`Failed to parse frontend code data: ${error instanceof Error ? error.message : String(error)}`);
    }
}
//# sourceMappingURL=newparser.js.map