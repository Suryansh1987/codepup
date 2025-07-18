// dependencyManager.ts - Complete module for managing component dependencies

import { ProjectFile } from './types';

export class DependencyManager {
  private projectFiles: Map<string, ProjectFile>;
  private streamCallback?: (message: string) => void;

  constructor(projectFiles: Map<string, ProjectFile>) {
    this.projectFiles = projectFiles;
  }

  setStreamCallback(callback: (message: string) => void) {
    this.streamCallback = callback;
  }

  private streamUpdate(message: string) {
    if (this.streamCallback) {
      this.streamCallback(message);
    }
  }

  /**
   * Plan dependency updates for a new component
   */
  async planDependencyUpdates(
    newComponentPath: string,
    componentName: string,
    componentType: 'component' | 'page' | 'app'
  ): Promise<string[]> {
    this.streamUpdate(`🔗 Planning dependency updates for ${componentName}...`);
    
    const filesToUpdate: string[] = [];

    switch (componentType) {
      case 'page':
        // New pages typically need routing updates in App.tsx
        if (this.projectFiles.has('src/App.tsx')) {
          filesToUpdate.push('src/App.tsx');
          this.streamUpdate('📄 App.tsx will be updated for new page routing');
        }
        
        // Check for layout components that might need updates
        const layoutFiles = this.findLayoutComponents();
        filesToUpdate.push(...layoutFiles);
        break;
        
      case 'component':
        // New components might need imports in parent components
        const parentComponents = await this.findPotentialParentComponents(componentName, componentType);
        filesToUpdate.push(...parentComponents);
        break;
        
      case 'app':
        // App updates don't typically need dependency updates
        this.streamUpdate('🏠 App.tsx updates typically don\'t require other file changes');
        break;
    }

    this.streamUpdate(`📋 Identified ${filesToUpdate.length} files needing dependency updates`);
    return filesToUpdate;
  }

  /**
   * Get modification order based on dependency hierarchy
   */
  getModificationOrder(files: string[]): string[] {
    const priority = {
      component: 1,
      page: 2,
      app: 3,
      util: 0,
      config: 0
    };

    return files.sort((a, b) => {
      const aType = this.getFileType(a);
      const bType = this.getFileType(b);
      return priority[aType] - priority[bType];
    });
  }

  /**
   * Analyze import relationships between files
   */
  analyzeImportRelationships(): Map<string, string[]> {
    const relationships = new Map<string, string[]>();
    
    for (const [filePath, file] of this.projectFiles.entries()) {
      const imports = this.extractImports(file.content);
      relationships.set(filePath, imports);
    }
    
    return relationships;
  }

  /**
   * Find circular dependencies in the project
   */
  findCircularDependencies(): Array<{ cycle: string[]; severity: 'warning' | 'error' }> {
    const relationships = this.analyzeImportRelationships();
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: Array<{ cycle: string[]; severity: 'warning' | 'error' }> = [];

    const detectCycle = (file: string, path: string[]): boolean => {
      if (recursionStack.has(file)) {
        // Found a cycle
        const cycleStart = path.indexOf(file);
        const cycle = path.slice(cycleStart);
        cycle.push(file); // Complete the cycle
        
        cycles.push({
          cycle,
          severity: cycle.length <= 3 ? 'error' : 'warning'
        });
        return true;
      }

      if (visited.has(file)) {
        return false;
      }

      visited.add(file);
      recursionStack.add(file);

      const imports = relationships.get(file) || [];
      for (const importFile of imports) {
        if (detectCycle(importFile, [...path, file])) {
          // Continue searching for more cycles
        }
      }

      recursionStack.delete(file);
      return false;
    };

    for (const file of relationships.keys()) {
      if (!visited.has(file)) {
        detectCycle(file, []);
      }
    }

    return cycles;
  }

  /**
   * Calculate dependency depth for each file
   */
  calculateDependencyDepth(): Map<string, number> {
    const relationships = this.analyzeImportRelationships();
    const depths = new Map<string, number>();
    const calculating = new Set<string>();

    const calculateDepth = (file: string): number => {
      if (depths.has(file)) {
        return depths.get(file)!;
      }

      if (calculating.has(file)) {
        // Circular dependency detected
        return 0;
      }

      calculating.add(file);
      const imports = relationships.get(file) || [];
      
      let maxDepth = 0;
      for (const importFile of imports) {
        if (relationships.has(importFile)) {
          maxDepth = Math.max(maxDepth, calculateDepth(importFile) + 1);
        }
      }

      calculating.delete(file);
      depths.set(file, maxDepth);
      return maxDepth;
    };

    for (const file of relationships.keys()) {
      calculateDepth(file);
    }

    return depths;
  }

  /**
   * Find potential parent components for a new component
   */
  private async findPotentialParentComponents(
    componentName: string,
    componentType: 'component' | 'page' | 'app'
  ): Promise<string[]> {
    const potentialParents: string[] = [];
    
    // Look for files that might logically import this component
    for (const [filePath, file] of this.projectFiles.entries()) {
      // Skip if it's the same type in the same directory (likely siblings)
      if (this.getFileType(filePath) === componentType && 
          this.getDirectoryType(filePath) === this.getDirectoryType(`src/${componentType}s/${componentName}.tsx`)) {
        continue;
      }

      // Check if this file might need the new component based on content analysis
      if (await this.mightNeedComponent(file, componentName, componentType)) {
        potentialParents.push(filePath);
      }
    }

    return potentialParents;
  }

  /**
   * Find layout-related components
   */
  private findLayoutComponents(): string[] {
    const layoutFiles: string[] = [];
    
    for (const [filePath, file] of this.projectFiles.entries()) {
      const fileName = filePath.toLowerCase();
      const content = file.content.toLowerCase();
      
      // Check for layout-related file names
      if (fileName.includes('layout') || 
          fileName.includes('header') || 
          fileName.includes('nav') || 
          fileName.includes('sidebar')) {
        layoutFiles.push(filePath);
      }
      
      // Check for layout-related content
      if (content.includes('router') || 
          content.includes('navigation') || 
          content.includes('header') ||
          content.includes('layout')) {
        if (!layoutFiles.includes(filePath)) {
          layoutFiles.push(filePath);
        }
      }
    }
    
    return layoutFiles;
  }

  /**
   * Determine if a file might need a new component
   */
  private async mightNeedComponent(
    file: ProjectFile,
    componentName: string,
    componentType: 'component' | 'page' | 'app'
  ): Promise<boolean> {
    const content = file.content.toLowerCase();
    const componentNameLower = componentName.toLowerCase();
    
    // Simple heuristics for determining if a component might be needed
    switch (componentType) {
      case 'page':
        // Pages are usually imported in App.tsx or routing files
        return file.path.includes('App.tsx') || 
               content.includes('route') || 
               content.includes('router');
               
      case 'component':
        // Components might be needed in pages or other components
        return file.isMainFile || 
               file.path.includes('pages/') ||
               content.includes(componentNameLower) ||
               this.hasSemanticRelationship(content, componentNameLower);
               
      default:
        return false;
    }
  }

  /**
   * Check for semantic relationships between content and component
   */
  private hasSemanticRelationship(content: string, componentName: string): boolean {
    // Simple semantic analysis - could be enhanced with NLP
    const semanticMappings = {
      'contact': ['form', 'email', 'phone', 'address'],
      'auth': ['login', 'signin', 'register', 'user'],
      'nav': ['menu', 'header', 'navigation', 'link'],
      'card': ['list', 'grid', 'item', 'product'],
      'modal': ['popup', 'dialog', 'overlay'],
      'form': ['input', 'submit', 'validation']
    };

    const componentBase = componentName.replace(/form|component|page$/i, '').toLowerCase();
    const relatedTerms = semanticMappings[componentBase as keyof typeof semanticMappings];
    
    if (relatedTerms) {
      return relatedTerms.some(term => content.includes(term));
    }
    
    return false;
  }

  /**
   * Extract import statements from file content
   */
  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      
      // Convert relative imports to absolute paths
      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        // This would need more sophisticated path resolution
        imports.push(importPath);
      } else if (!importPath.startsWith('@/') && !importPath.includes('node_modules')) {
        imports.push(importPath);
      }
    }
    
    return imports;
  }

  /**
   * Get file type based on path and content
   */
  private getFileType(filePath: string): 'component' | 'page' | 'app' | 'util' | 'config' {
    if (filePath.includes('/components/')) return 'component';
    if (filePath.includes('/pages/')) return 'page';
    if (filePath.includes('App.tsx') || filePath.includes('App.jsx')) return 'app';
    if (filePath.includes('/utils/') || filePath.includes('/lib/')) return 'util';
    if (filePath.includes('/config/') || filePath.includes('.config.')) return 'config';
    return 'component'; // default
  }

  /**
   * Get directory type from file path
   */
  private getDirectoryType(filePath: string): string {
    const parts = filePath.split('/');
    if (parts.length >= 2) {
      return parts[parts.length - 2]; // Parent directory
    }
    return '';
  }

  /**
   * Generate import statement for a component
   */
  generateImportStatement(
    componentName: string,
    componentPath: string,
    targetFilePath: string,
    isDefaultImport: boolean = true
  ): string {
    const relativePath = this.calculateRelativePath(targetFilePath, componentPath);
    
    if (isDefaultImport) {
      return `import ${componentName} from '${relativePath}';`;
    } else {
      return `import { ${componentName} } from '${relativePath}';`;
    }
  }

  /**
   * Calculate relative path between two files
   */
  private calculateRelativePath(fromFile: string, toFile: string): string {
    // Normalize paths
    const fromParts = fromFile.replace(/\\/g, '/').split('/').filter(p => p !== '');
    const toParts = toFile.replace(/\\/g, '/').split('/').filter(p => p !== '');
    
    // Remove file names, keep only directories
    fromParts.pop();
    const toFileName = toParts.pop()?.replace(/\.tsx?$/, '') || '';
    
    // Find common path
    let commonLength = 0;
    while (commonLength < fromParts.length && 
           commonLength < toParts.length && 
           fromParts[commonLength] === toParts[commonLength]) {
      commonLength++;
    }
    
    // Build relative path
    const upLevels = fromParts.length - commonLength;
    const downPath = toParts.slice(commonLength);
    
    let relativePath = '';
    if (upLevels > 0) {
      relativePath = '../'.repeat(upLevels);
    } else {
      relativePath = './';
    }
    
    if (downPath.length > 0) {
      relativePath += downPath.join('/') + '/';
    }
    
    return relativePath + toFileName;
  }

  /**
   * Validate that all dependencies can be resolved
   */
  validateDependencies(): Array<{ file: string; missingDependencies: string[] }> {
    const issues: Array<{ file: string; missingDependencies: string[] }> = [];
    
    for (const [filePath, file] of this.projectFiles.entries()) {
      const imports = this.extractImports(file.content);
      const missingDependencies: string[] = [];
      
      for (const importPath of imports) {
        if (!this.canResolveImport(importPath, filePath)) {
          missingDependencies.push(importPath);
        }
      }
      
      if (missingDependencies.length > 0) {
        issues.push({ file: filePath, missingDependencies });
      }
    }
    
    return issues;
  }

  /**
   * Check if an import can be resolved
   */
  private canResolveImport(importPath: string, fromFile: string): boolean {
    // Skip external packages
    if (!importPath.startsWith('./') && !importPath.startsWith('../') && !importPath.startsWith('@/')) {
      return true; // Assume external packages are available
    }
    
    // For local imports, check if file exists in our project files
    const resolvedPath = this.resolveImportPath(importPath, fromFile);
    return this.projectFiles.has(resolvedPath) || this.projectFiles.has(resolvedPath + '.tsx') || this.projectFiles.has(resolvedPath + '.ts');
  }

  /**
   * Resolve import path to absolute project path
   */
  private resolveImportPath(importPath: string, fromFile: string): string {
    if (importPath.startsWith('@/')) {
      return 'src/' + importPath.substring(2);
    }
    
    const fromDir = fromFile.split('/').slice(0, -1).join('/');
    const parts = importPath.split('/');
    const resolvedParts = fromDir.split('/');
    
    for (const part of parts) {
      if (part === '..') {
        resolvedParts.pop();
      } else if (part !== '.') {
        resolvedParts.push(part);
      }
    }
    
    return resolvedParts.join('/');
  }

  /**
   * Get dependency statistics for the project
   */
  getDependencyStats(): {
    totalFiles: number;
    averageImportsPerFile: number;
    mostImportedFiles: Array<{ file: string; importCount: number }>;
    filesWithMostImports: Array<{ file: string; importCount: number }>;
    circularDependencies: number;
  } {
    const relationships = this.analyzeImportRelationships();
    const importCounts = new Map<string, number>();
    const fileCounts = new Map<string, number>();
    
    // Count imports per file and how often each file is imported
    for (const [file, imports] of relationships.entries()) {
      fileCounts.set(file, imports.length);
      
      for (const imported of imports) {
        importCounts.set(imported, (importCounts.get(imported) || 0) + 1);
      }
    }
    
    const totalImports = Array.from(fileCounts.values()).reduce((sum, count) => sum + count, 0);
    const circularDeps = this.findCircularDependencies();
    
    return {
      totalFiles: this.projectFiles.size,
      averageImportsPerFile: this.projectFiles.size > 0 ? totalImports / this.projectFiles.size : 0,
      mostImportedFiles: Array.from(importCounts.entries())
        .map(([file, count]) => ({ file, importCount: count }))
        .sort((a, b) => b.importCount - a.importCount)
        .slice(0, 10),
      filesWithMostImports: Array.from(fileCounts.entries())
        .map(([file, count]) => ({ file, importCount: count }))
        .sort((a, b) => b.importCount - a.importCount)
        .slice(0, 10),
      circularDependencies: circularDeps.length
    };
  }
}