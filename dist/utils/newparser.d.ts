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
declare function parseFrontendCode(input: string): ParsedResult;
declare function flattenStructure(structure: StructureNode, basePath?: string): string[];
declare function getFileStatus(structure: StructureNode, filePath: string): string | null;
declare function getCodeFileByPath(codeFiles: CodeFile[], path: string): CodeFile | null;
export { parseFrontendCode, flattenStructure, getFileStatus, getCodeFileByPath, CodeFile, StructureNode, ParsedResult, };
