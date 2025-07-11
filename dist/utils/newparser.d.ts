interface CodeFile {
    path: string;
    content: string;
}
interface StructureNode {
    [key: string]: StructureNode | string;
}
interface ParsedResult {
    codeFiles: CodeFile[];
    structure: StructureNode;
}
declare function fixCommonJsonIssues(jsonString: string): string;
declare function attemptJsonParsing(jsonString: string): any;
declare function parseFrontendCode(input: string): ParsedResult;
declare function testJsonFixes(): void;
declare function flattenStructure(structure: StructureNode, basePath?: string): string[];
declare function getFileStatus(structure: StructureNode, filePath: string): string | null;
declare function getCodeFileByPath(codeFiles: CodeFile[], path: string): CodeFile | null;
declare function ensureTailwindConfigFirst(codeFiles: CodeFile[]): CodeFile[];
declare function validateTailwindConfig(content: string): boolean;
declare function correctFilePaths(codeFiles: CodeFile[]): CodeFile[];
declare function validateFileStructure(codeFiles: CodeFile[]): {
    isValid: boolean;
    errors: string[];
};
declare function getTailwindConfig(codeFiles: CodeFile[]): CodeFile | null;
declare function debugInput(input: string): void;
declare function analyzeJsonStructure(jsonString: string): void;
declare function robustJsonParse(jsonString: string): any;
declare function parseFrontendCodeRobust(input: string): ParsedResult;
export { parseFrontendCode, parseFrontendCodeRobust, flattenStructure, getFileStatus, getCodeFileByPath, getTailwindConfig, ensureTailwindConfigFirst, validateTailwindConfig, validateFileStructure, correctFilePaths, debugInput, testJsonFixes, analyzeJsonStructure, fixCommonJsonIssues, attemptJsonParsing, robustJsonParse, CodeFile, StructureNode, ParsedResult, };
