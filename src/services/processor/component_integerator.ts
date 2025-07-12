// ============================================================================
// STEP 2: ENHANCED INTEGRATION ENGINE WITH PROPER NAMING & ROUTE DETECTION
// ============================================================================

import { join, dirname, resolve } from 'path';
import { promises as fs } from 'fs';
import { 
  GenerationResult, 
  ProjectFile, 
  ComponentTypeAnalysis 
} from '../filemodifier/component_analysis';

export interface NavigationLinkAnalysis {
  link: string;
  type: 'page-route' | 'in-page-section' | 'external' | 'unknown';
  isPageRoute: boolean;
  isInPageSection: boolean;
  normalizedPath?: string; // Added for route comparison
  displayName?: string;    // Added for display name extraction
}

export interface NavigationFileInfo {
  filePath: string;
  type: 'header' | 'footer' | 'navbar' | 'sidebar' | 'menu' | 'custom';
  priority: number;
  existingLinks: string[];
  linkAnalysis: NavigationLinkAnalysis[];
  pageRouteCount: number;
  inPageSectionCount: number;
  canAddMorePages: boolean;
  needsRouteUpdate: boolean;
  existingRoutes: string[]; // NEW: Normalized route paths for comparison
  hasMatchingRoute?: boolean; // NEW: If component route already exists
}

export interface NavigationAnalysis {
  hasNavigation: boolean;
  navigationFiles: NavigationFileInfo[];
  hasHeader: boolean;
  hasFooter: boolean;
  hasNavbar: boolean;
  existingLinks: string[];
  headerCanAddPages: boolean;
  shouldUpdateAppOnly: boolean;
  existingPageRoutes: string[]; // NEW: All existing page routes found in navigation
  routeAlreadyExists: boolean;  // NEW: If the component route already exists
  matchingNavigationFile?: string; // NEW: Which nav file already has the route
}

export interface IntegrationPlan {
  filePath: string;
  exists: boolean;
  purpose: string;
  required: boolean;
  priority: number;
  integrationType: 'routing' | 'import' | 'context' | 'config' | 'creation' | 'navigation' | 'usage';
  navigationFileType?: 'header' | 'footer' | 'navbar' | 'sidebar' | 'menu' | 'custom';
  modifications?: string[];
  skipReason?: string; // NEW: Why this integration step was skipped
}

export interface PageFileInfo {
  filePath: string;
  type: 'page' | 'layout' | 'component';
  priority: number;
  isMainPage: boolean;
  componentImports: string[];
  aiReason?: string;
}

export interface UsageAnalysis {
  hasPages: boolean;
  pageFiles: PageFileInfo[];
  targetPages: string[];
  aiAnalysis?: string;
}

export interface IntegrationAnalysis {
  mainComponentFile: IntegrationPlan;
  integrationFiles: IntegrationPlan[];
  navigationAnalysis: NavigationAnalysis;
  usageAnalysis: UsageAnalysis;
  projectPatterns: {
    exportPattern: 'default' | 'named' | 'mixed';
    importPattern: 'default' | 'named' | 'mixed';
    routingPattern: 'react-router' | 'next' | 'reach-router' | 'basic';
    appFilePath?: string;
    routeFilePath?: string;
  };
  existingRoutes: string[];
  componentMap: Map<string, string>;
  isPageComponent: boolean;
  componentDisplayName: string; // NEW: Clean display name for UI
  componentRoutePath: string;   // NEW: Clean route path
}

export interface IntegrationResult {
  success: boolean;
  createdFiles: string[];
  modifiedFiles: string[];
  skippedFiles: string[]; // NEW: Files that were skipped with reasons
  integrationResults: {
    routingUpdated: boolean;
    appFileUpdated: boolean;
    navigationUpdated: boolean;
    headerUpdated: boolean;
    footerUpdated: boolean;
    dependenciesResolved: boolean;
    usageExampleAdded: boolean;
    pagesUpdated: string[];
    routeAlreadyExisted: boolean; // NEW: If route was already present
    navigationAlreadyExists: boolean; // NEW: If nav link already exists
  };
  error?: string;
  warnings?: string[]; // NEW: Non-fatal warnings
}

// ============================================================================
// ENHANCED INTEGRATION ENGINE
// ============================================================================

export class IntegrationEngine {
  private anthropic: any;
  private reactBasePath: string;
  private streamCallback?: (message: string) => void;

  constructor(anthropic: any, reactBasePath: string) {
    this.anthropic = anthropic;
    this.reactBasePath = resolve(reactBasePath);
  }

  setStreamCallback(callback: (message: string) => void): void {
    this.streamCallback = callback;
  }

  private streamUpdate(message: string): void {
    if (this.streamCallback) {
      this.streamCallback(message);
    }
    console.log(message);
  }

  /**
   * 🔥 NEW: GENERATE CLEAN COMPONENT NAMES AND PATHS
   */
  private generateCleanNaming(componentType: ComponentTypeAnalysis, userPrompt: string): {
    displayName: string;
    routePath: string;
    fileName: string;
  } {
    const originalName = componentType.name;
    
    // 🔥 FIX: Remove "Page" suffix and common redundant words
    let cleanName = originalName
      .replace(/Page$/i, '')           // ContactPage -> Contact
      .replace(/Component$/i, '')      // HeaderComponent -> Header
      .replace(/Section$/i, '')        // AboutSection -> About
      .replace(/View$/i, '')           // ProfileView -> Profile
      .replace(/^(.)/, (match) => match.toUpperCase()); // Ensure first letter is capitalized

    // Extract meaningful names from user prompt if available
    const promptWords = userPrompt
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !['page', 'component', 'create', 'make', 'build', 'add'].includes(word));
    
    // If user prompt has meaningful words, use the first one as basis
    if (promptWords.length > 0 && !cleanName.toLowerCase().includes(promptWords[0])) {
      const promptBasedName = promptWords[0].charAt(0).toUpperCase() + promptWords[0].slice(1);
      // Only use prompt-based name if it's different and meaningful
      if (promptBasedName.length > 2) {
        cleanName = promptBasedName;
      }
    }

    // Generate clean route path (lowercase, no special chars)
    const routePath = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // File name should match the clean component name
    const fileName = `${cleanName}.${componentType.fileExtension || 'tsx'}`;

    return {
      displayName: cleanName,
      routePath,
      fileName
    };
  }

  /**
   * 🔥 ENHANCED: ANALYZE NAVIGATION WITH SMART ROUTE DETECTION & IN-PAGE UPGRADE
   */
  private async analyzeNavigation(
    projectFiles: Map<string, ProjectFile>,
    targetRoutePath: string,
    cleanDisplayName: string
  ): Promise<NavigationAnalysis> {
    const navigationFiles: NavigationFileInfo[] = [];
    const allExistingLinks: string[] = [];
    const existingPageRoutes: string[] = [];
    
    let hasHeader = false;
    let hasFooter = false;
    let hasNavbar = false;
    let headerCanAddPages = true;
    let shouldUpdateAppOnly = false;
    let routeAlreadyExists = false;
    let matchingNavigationFile: string | undefined;
    let hasInPageNavigation = false;
    let inPageNavigationFiles: string[] = [];

    // Navigation file patterns with their types and priorities
    const navPatterns = [
      { 
        patterns: [
          'src/components/Header.tsx', 'src/components/Header.jsx', 
          'src/components/layout/Header.tsx', 'src/layout/Header.tsx', 
          'Header.tsx', 'src/Header.tsx'
        ], 
        type: 'header' as const, 
        priority: 1 
      },
      { 
        patterns: [
          'src/components/Navbar.tsx', 'src/components/Navbar.jsx', 
          'src/components/layout/Navbar.tsx', 'src/layout/Navbar.tsx', 
          'Navbar.tsx'
        ], 
        type: 'navbar' as const, 
        priority: 2 
      },
      { 
        patterns: [
          'src/components/Navigation.tsx', 'src/components/Navigation.jsx', 
          'src/components/ui/navigation.tsx', 'Navigation.tsx'
        ], 
        type: 'custom' as const, 
        priority: 3 
      },
      { 
        patterns: [
          'src/components/Footer.tsx', 'src/components/Footer.jsx', 
          'src/components/layout/Footer.tsx', 'src/components/ui/footer.tsx', 
          'src/layout/Footer.tsx', 'Footer.tsx'
        ], 
        type: 'footer' as const, 
        priority: 4 
      },
      { 
        patterns: ['src/components/Sidebar.tsx', 'src/components/Sidebar.jsx'], 
        type: 'sidebar' as const, 
        priority: 5 
      },
      { 
        patterns: ['src/components/Menu.tsx', 'src/components/Menu.jsx'], 
        type: 'menu' as const, 
        priority: 6 
      }
    ];

    // Check each pattern group
    for (const patternGroup of navPatterns) {
      for (const pattern of patternGroup.patterns) {
        if (projectFiles.has(pattern)) {
          const file = projectFiles.get(pattern);
          if (file?.content) {
            const hasNavLinks = this.hasNavigationLinks(file.content);
            
            if (hasNavLinks) {
              const existingLinks = this.extractNavigationLinks(file.content);
              
              // 🔥 ENHANCED: Analyze each link with route detection
              const linkAnalysis = this.analyzeNavigationLinks(file.content, existingLinks);
              const pageRouteCount = linkAnalysis.filter(l => l.isPageRoute).length;
              const inPageSectionCount = linkAnalysis.filter(l => l.isInPageSection).length;
              
              // 🔥 NEW: Extract all normalized routes from this nav file
              const existingRoutes = linkAnalysis
                .filter(l => l.isPageRoute && l.normalizedPath)
                .map(l => l.normalizedPath!);
              
              // 🔥 NEW: Check if target route already exists in this nav file
              const hasMatchingRoute = existingRoutes.includes(targetRoutePath) || 
                                     existingRoutes.some(route => 
                                       route.includes(targetRoutePath) || 
                                       targetRoutePath.includes(route)
                                     );
              
              if (hasMatchingRoute) {
                routeAlreadyExists = true;
                matchingNavigationFile = pattern;
              }
              
              // Add to global route list
              existingRoutes.forEach(route => {
                if (!existingPageRoutes.includes(route)) {
                  existingPageRoutes.push(route);
                }
              });
              
              const canAddMorePages = pageRouteCount < 6 && !hasMatchingRoute;
              const needsRouteUpdate = canAddMorePages && !hasMatchingRoute;
              
              const navFileInfo: NavigationFileInfo = {
                filePath: pattern,
                type: patternGroup.type,
                priority: patternGroup.priority,
                existingLinks,
                linkAnalysis,
                pageRouteCount,
                inPageSectionCount,
                canAddMorePages,
                needsRouteUpdate,
                existingRoutes,
                hasMatchingRoute
              };
              
              navigationFiles.push(navFileInfo);

              if (patternGroup.type === 'header') {
                hasHeader = true;
                headerCanAddPages = canAddMorePages;
                shouldUpdateAppOnly = !canAddMorePages || hasMatchingRoute;
              }
              if (patternGroup.type === 'footer') hasFooter = true;
              if (patternGroup.type === 'navbar') hasNavbar = true;

              existingLinks.forEach(link => {
                if (!allExistingLinks.includes(link)) {
                  allExistingLinks.push(link);
                }
              });

              break; // Only take the first match from each pattern group
            }
          }
        }
      }
    }

    navigationFiles.sort((a, b) => a.priority - b.priority);

    return {
      hasNavigation: navigationFiles.length > 0,
      navigationFiles,
      hasHeader,
      hasFooter,
      hasNavbar,
      existingLinks: allExistingLinks,
      headerCanAddPages,
      shouldUpdateAppOnly,
      existingPageRoutes,
      routeAlreadyExists,
      matchingNavigationFile
    };
  }

  /**
   * 🔥 ENHANCED: ANALYZE NAVIGATION LINKS WITH BETTER ROUTE DETECTION
   */
  private analyzeNavigationLinks(fileContent: string, links: string[]): NavigationLinkAnalysis[] {
    return links.map(link => {
      const analysis: NavigationLinkAnalysis = {
        link,
        type: 'unknown',
        isPageRoute: false,
        isInPageSection: false
      };

      // 1. Check if it's an external link
      if (link.startsWith('http://') || link.startsWith('https://')) {
        analysis.type = 'external';
        return analysis;
      }

      // 2. Hash links are ALWAYS in-page sections
      if (link.startsWith('#')) {
        analysis.type = 'in-page-section';
        analysis.isInPageSection = true;
        return analysis;
      }

      // 3. Check if it's a page route pattern
      const pageRoutePatterns = [
        /^\/[a-zA-Z][a-zA-Z0-9-_]*$/, // /about, /contact, /services
        /^\/[a-zA-Z][a-zA-Z0-9-_]*\/[a-zA-Z0-9-_]*$/, // /products/laptop
        /^\.\//,  // ./about
        /^\/pages\//  // /pages/about
      ];

      const isPageRoute = pageRoutePatterns.some(pattern => pattern.test(link));
      
      if (isPageRoute) {
        analysis.type = 'page-route';
        analysis.isPageRoute = true;
        
        // 🔥 NEW: Generate normalized path for comparison
        analysis.normalizedPath = this.normalizeRoutePath(link);
        
        // 🔥 NEW: Extract display name from navigation context
        analysis.displayName = this.extractDisplayNameFromNavigation(fileContent, link);
        
        return analysis;
      }

      // 4. Additional context analysis
      const linkUsageContext = this.getLinkUsageContext(fileContent, link);
      
      if (linkUsageContext.hasScrollBehavior || linkUsageContext.hasScrollIntoView) {
        analysis.type = 'in-page-section';
        analysis.isInPageSection = true;
        return analysis;
      }

      if (linkUsageContext.hasRouterContext || linkUsageContext.hasNavigateFunction) {
        analysis.type = 'page-route';
        analysis.isPageRoute = true;
        analysis.normalizedPath = this.normalizeRoutePath(link);
        analysis.displayName = this.extractDisplayNameFromNavigation(fileContent, link);
        return analysis;
      }

      // 5. Default classification
      if (link.startsWith('/') && !link.includes('#')) {
        analysis.type = 'page-route';
        analysis.isPageRoute = true;
        analysis.normalizedPath = this.normalizeRoutePath(link);
        analysis.displayName = this.extractDisplayNameFromNavigation(fileContent, link);
      } else {
        analysis.type = 'in-page-section';
        analysis.isInPageSection = true;
      }

      return analysis;
    });
  }

  /**
   * 🔥 NEW: NORMALIZE ROUTE PATH FOR COMPARISON
   */
  private normalizeRoutePath(path: string): string {
    return path
      .replace(/^\/+/, '')  // Remove leading slashes
      .replace(/\/+$/, '')  // Remove trailing slashes
      .replace(/^\.\//, '') // Remove relative path prefix
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ''); // Remove special chars for comparison
  }

  /**
   * 🔥 NEW: EXTRACT DISPLAY NAME FROM NAVIGATION CONTEXT
   */
  private extractDisplayNameFromNavigation(fileContent: string, link: string): string {
    // Look for the text content associated with this link
    const lines = fileContent.split('\n');
    
    for (const line of lines) {
      if (line.includes(link)) {
        // Try to extract text content from JSX
        const textMatch = line.match(/>([^<]+)</);
        if (textMatch && textMatch[1].trim().length > 0) {
          return textMatch[1].trim();
        }
        
        // Try to extract from attributes like aria-label or title
        const ariaMatch = line.match(/aria-label=["']([^"']+)["']/);
        if (ariaMatch) {
          return ariaMatch[1];
        }
        
        const titleMatch = line.match(/title=["']([^"']+)["']/);
        if (titleMatch) {
          return titleMatch[1];
        }
      }
    }
    
    // Fallback: generate from path
    return link
      .replace(/^\/+/, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * GET CONTEXT AROUND HOW A LINK IS USED
   */
  private getLinkUsageContext(fileContent: string, link: string): {
    hasScrollBehavior: boolean;
    hasScrollIntoView: boolean;
    hasRouterContext: boolean;
    hasNavigateFunction: boolean;
  } {
    const lines = fileContent.split('\n');
    const linkLines = lines.filter(line => line.includes(link));
    
    let hasScrollBehavior = false;
    let hasScrollIntoView = false;
    let hasRouterContext = false;
    let hasNavigateFunction = false;

    linkLines.forEach(line => {
      if (line.includes('scroll') || line.includes('Scroll')) {
        hasScrollBehavior = true;
      }
      if (line.includes('scrollIntoView')) {
        hasScrollIntoView = true;
      }
      if (line.includes('navigate') || line.includes('Navigate')) {
        hasNavigateFunction = true;
      }
    });

    if (fileContent.includes('react-router') || 
        fileContent.includes('useNavigate') || 
        fileContent.includes('Link from') ||
        fileContent.includes('NavLink')) {
      hasRouterContext = true;
    }

    return {
      hasScrollBehavior,
      hasScrollIntoView,
      hasRouterContext,
      hasNavigateFunction
    };
  }

  /**
   * 🔥 ENHANCED: CREATE INTEGRATION PLAN WITH SMART NAMING AND ROUTE DETECTION
   */
  private async createIntegrationPlan(generationResult: GenerationResult, userPrompt: string = ''): Promise<IntegrationAnalysis> {
    const { componentType, projectPatterns, existingRoutes, componentMap, projectFiles } = generationResult;

    // 🔥 NEW: Generate clean naming
    const cleanNaming = this.generateCleanNaming(componentType, userPrompt);
    
    this.streamUpdate(`🎨 Clean naming generated:`);
    this.streamUpdate(`   Original: ${componentType.name} -> Clean: ${cleanNaming.displayName}`);
    this.streamUpdate(`   Route: /${cleanNaming.routePath}`);
    this.streamUpdate(`   File: ${cleanNaming.fileName}`);

    // Determine if this is truly a page or component
    const isPageComponent = componentType.type === 'page';

    // Always include tailwind config
    const integrationFiles: IntegrationPlan[] = [
      {
        filePath: 'tailwind.config.js',
        exists: this.fileExists('tailwind.config.js', projectFiles),
        purpose: 'Styling configuration',
        required: true,
        priority: 2,
        integrationType: 'config'
      }
    ];

    const warnings: string[] = [];

    if (isPageComponent) {
      // 🔥 ENHANCED: PAGE INTEGRATION WITH ROUTE DETECTION
      this.streamUpdate('   🎯 PAGE Integration: Checking existing routes...');
      
      // 🔥 NEW: Analyze navigation with route detection
      const navigationAnalysis = await this.analyzeNavigation(projectFiles, cleanNaming.routePath, cleanNaming.displayName);
      
      if (navigationAnalysis.routeAlreadyExists) {
        this.streamUpdate(`   ⚠️  Route /${cleanNaming.routePath} already exists in ${navigationAnalysis.matchingNavigationFile}`);
        this.streamUpdate(`   🎯 Strategy: Create component only, skip navigation updates`);
        warnings.push(`Route /${cleanNaming.routePath} already exists in navigation - component will be created but navigation won't be modified`);
        
        // Only add App.tsx routing if needed
        if (projectPatterns.appFilePath && !existingRoutes.includes(`/${cleanNaming.routePath}`)) {
          integrationFiles.push({
            filePath: projectPatterns.appFilePath,
            exists: true,
            purpose: 'Add routing for new page (route exists in nav but missing from router)',
            required: true,
            priority: 3,
            integrationType: 'routing'
          });
        } else {
          integrationFiles.push({
            filePath: projectPatterns.appFilePath || 'App.tsx',
            exists: false,
            purpose: 'Route already exists in navigation',
            required: false,
            priority: 999,
            integrationType: 'routing',
            skipReason: 'Route already exists in navigation and routing'
          });
        }
      } else {
        // Normal page integration
        if (projectPatterns.appFilePath) {
          integrationFiles.push({
            filePath: projectPatterns.appFilePath,
            exists: true,
            purpose: 'Add routing for new page',
            required: true,
            priority: 3,
            integrationType: 'routing'
          });
        }

        // Add navigation integration based on capacity
        if (navigationAnalysis.hasNavigation && !navigationAnalysis.shouldUpdateAppOnly) {
          navigationAnalysis.navigationFiles.forEach((navFile, index) => {
            if (navFile.needsRouteUpdate) {
              integrationFiles.push({
                filePath: navFile.filePath,
                exists: true,
                purpose: `Add navigation link in ${navFile.type} component`,
                required: navFile.type === 'header' || navFile.type === 'footer',
                priority: 4 + index,
                integrationType: 'navigation',
                navigationFileType: navFile.type
              });
            }
          });
        } else if (navigationAnalysis.shouldUpdateAppOnly) {
          this.streamUpdate('   🛑 Header is full (6+ routes) - Skipping navigation updates, App.tsx only');
        }
      }

      return {
        mainComponentFile: {
          filePath: `${componentType.targetDirectory}/${cleanNaming.fileName}`,
          exists: false,
          purpose: `Main ${componentType.type} file`,
          required: true,
          priority: 1,
          integrationType: 'creation'
        },
        integrationFiles,
        navigationAnalysis,
        usageAnalysis: { hasPages: false, pageFiles: [], targetPages: [] },
        projectPatterns,
        existingRoutes,
        componentMap,
        isPageComponent: true,
        componentDisplayName: cleanNaming.displayName,
        componentRoutePath: cleanNaming.routePath
      };

    } else {
      // Component integration remains the same but with clean naming
      this.streamUpdate('   🎯 COMPONENT Integration: Using AI to find best integration targets...');
      
      const usageAnalysis = await this.analyzeUsageTargets(projectFiles, componentType, userPrompt);
      
      if (usageAnalysis.hasPages) {
        usageAnalysis.pageFiles.forEach((pageFile, index) => {
          integrationFiles.push({
            filePath: pageFile.filePath,
            exists: true,
            purpose: `Add ${cleanNaming.displayName} component usage example`,
            required: pageFile.isMainPage,
            priority: 4 + index,
            integrationType: 'usage'
          });
        });
      }

      return {
        mainComponentFile: {
          filePath: `${componentType.targetDirectory}/${cleanNaming.fileName}`,
          exists: false,
          purpose: `Main ${componentType.type} file`,
          required: true,
          priority: 1,
          integrationType: 'creation'
        },
        integrationFiles,
        navigationAnalysis: { 
          hasNavigation: false, 
          navigationFiles: [], 
          hasHeader: false, 
          hasFooter: false, 
          hasNavbar: false, 
          existingLinks: [],
          headerCanAddPages: true,
          shouldUpdateAppOnly: false,
          existingPageRoutes: [],
          routeAlreadyExists: false
        },
        usageAnalysis,
        projectPatterns,
        existingRoutes,
        componentMap,
        isPageComponent: false,
        componentDisplayName: cleanNaming.displayName,
        componentRoutePath: cleanNaming.routePath
      };
    }
  }

  /**
   * COMPLETE INTEGRATION WITH PROPER TYPE DISTINCTION
   */
  async integrateComponent(generationResult: GenerationResult, userPrompt: string = ''): Promise<IntegrationResult> {
    this.streamUpdate('🔗 STEP 2: Starting Enhanced Integration with Smart Naming...');

    try {
      // 2.1: Create integration plan with proper naming and route detection
      this.streamUpdate('📋 2.1: Creating integration plan with smart naming and route detection...');
      const integrationAnalysis = await this.createIntegrationPlan(generationResult, userPrompt);

      // Clear logging of component type and strategy
      const typeIcon = integrationAnalysis.isPageComponent ? '📄' : '🧩';
      const typeLabel = integrationAnalysis.isPageComponent ? 'PAGE' : 'COMPONENT';
      
      this.streamUpdate(`${typeIcon} Type: ${typeLabel} - ${integrationAnalysis.componentDisplayName}`);
      this.streamUpdate(`📋 Integration Strategy:`);
      this.streamUpdate(`   Main File: ${integrationAnalysis.mainComponentFile.filePath}`);
      this.streamUpdate(`   Route Path: /${integrationAnalysis.componentRoutePath}`);

      if (integrationAnalysis.isPageComponent) {
        // Enhanced page integration logging
        const navAnalysis = integrationAnalysis.navigationAnalysis;
        
        if (navAnalysis.routeAlreadyExists) {
          this.streamUpdate(`   ⚠️  Route already exists in: ${navAnalysis.matchingNavigationFile}`);
          this.streamUpdate(`   🎯 Strategy: Component creation only, skip navigation`);
        } else {
          this.streamUpdate(`   🛣️  Routing: ${integrationAnalysis.projectPatterns.appFilePath ? '✅ Required' : '❌ No App File'}`);
          this.streamUpdate(`   🧭 Navigation: ${navAnalysis.hasNavigation ? '✅ Available' : '❌ None'}`);
        }
        
        if (navAnalysis.hasNavigation && !navAnalysis.routeAlreadyExists) {
          this.streamUpdate(`   📊 Navigation Files Analysis:`);
          navAnalysis.navigationFiles.forEach(navFile => {
            const status = navFile.hasMatchingRoute ? '❌ Route exists' : 
                          navFile.needsRouteUpdate ? '✅ Will update' : 
                          '⚠️  Full/Skip';
            this.streamUpdate(`      ${navFile.type.toUpperCase()}: ${status} (${navFile.pageRouteCount}/6 routes)`);
          });
        }
      } else {
        // Component integration logging
        this.streamUpdate(`   📄 Usage Integration: ${integrationAnalysis.usageAnalysis.hasPages ? '✅ Available' : '❌ No Pages Found'}`);
        
        if (integrationAnalysis.usageAnalysis.hasPages) {
          this.streamUpdate(`   🤖 AI Analysis: ${integrationAnalysis.usageAnalysis.aiAnalysis || 'Smart targeting applied'}`);
          this.streamUpdate(`   📊 AI-Recommended Pages for Component Usage:`);
          integrationAnalysis.usageAnalysis.pageFiles.forEach(pageFile => {
            const priority = pageFile.isMainPage ? ' (PRIMARY)' : '';
            const reason = pageFile.aiReason ? ` - ${pageFile.aiReason}` : '';
            this.streamUpdate(`      ${pageFile.type.toUpperCase()}: ${pageFile.filePath}${priority}${reason}`);
          });
        }
      }

      // Show all integration files
      integrationAnalysis.integrationFiles.forEach(plan => {
        if (plan.skipReason) {
          this.streamUpdate(`   ⏭️  SKIP ${plan.filePath} - ${plan.skipReason}`);
          return;
        }

        const status = plan.exists ? '✅ MODIFY' : '🆕 CREATE';
        let icon = '📄';
        if (plan.integrationType === 'navigation') {
          icon = plan.navigationFileType === 'header' ? '🔝' : 
                 plan.navigationFileType === 'footer' ? '🔻' : '🧭';
        } else if (plan.integrationType === 'usage') {
          icon = '🔗';
        } else if (plan.integrationType === 'routing') {
          icon = '🛣️';
        }
        this.streamUpdate(`   ${status} ${icon} ${plan.filePath} - ${plan.purpose}`);
      });

      // 2.2: Execute integration
      this.streamUpdate('🎯 2.2: Executing integration...');
      const result = await this.executeIntegration(generationResult, integrationAnalysis);

      this.streamUpdate('✅ STEP 2 Complete: Enhanced Integration with Smart Naming finished!');
      return result;

    } catch (error) {
      this.streamUpdate(`❌ STEP 2 Failed: ${error}`);
      return {
        success: false,
        createdFiles: [],
        modifiedFiles: [],
        skippedFiles: [],
        integrationResults: {
          routingUpdated: false,
          appFileUpdated: false,
          navigationUpdated: false,
          headerUpdated: false,
          footerUpdated: false,
          dependenciesResolved: false,
          usageExampleAdded: false,
          pagesUpdated: [],
          routeAlreadyExisted: false,
          navigationAlreadyExists: false
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 🔥 ENHANCED: EXECUTE INTEGRATION WITH SMART SKIPPING
   */
 private async executeIntegration(
  generationResult: GenerationResult,
  integrationAnalysis: IntegrationAnalysis
): Promise<IntegrationResult> {
  const maxRetries = 2;
  let currentAttempt = 0;
  
  while (currentAttempt < maxRetries) {
    this.streamUpdate(`🔄 Attempt ${currentAttempt + 1}/${maxRetries}: Generating integration files...`);
    
    try {
      // Create original files map for validation
      const originalFiles = new Map<string, string>();
      const contextFiles = [integrationAnalysis.mainComponentFile, ...integrationAnalysis.integrationFiles]
        .filter(plan => plan.exists && !plan.skipReason)
        .map(plan => {
          const fileData = generationResult.projectFiles.get(plan.filePath);
          if (fileData) {
            originalFiles.set(plan.filePath, fileData.content);
          }
          return fileData;
        })
        .filter(Boolean);

      // Generate appropriate prompt
      const batchIntegrationPrompt = integrationAnalysis.isPageComponent 
        ? this.createPageIntegrationPrompt(generationResult, integrationAnalysis, contextFiles as any[])
        : this.createComponentIntegrationPrompt(generationResult, integrationAnalysis, contextFiles as any[]);

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 8000,
        temperature: 0.1,
        messages: [{ role: 'user', content: batchIntegrationPrompt }]
      });

      const responseText = response.content[0]?.type === 'text' ? response.content[0].text : '';
      
      // Validate the response
      const validation = this.validateResponseContent(responseText, originalFiles);
      
      if (!validation.isValid) {
        this.streamUpdate(`❌ Attempt ${currentAttempt + 1} failed validation:`);
        validation.errors.forEach(error => this.streamUpdate(`   • ${error}`));
        
        if (currentAttempt < maxRetries - 1) {
          this.streamUpdate('🔄 Retrying with stricter prompt...');
          currentAttempt++;
          continue;
        } else {
          throw new Error(`Integration failed after ${maxRetries} attempts: ${validation.errors.join(', ')}`);
        }
      }

      if (validation.warnings.length > 0) {
        this.streamUpdate('⚠️ Validation warnings:');
        validation.warnings.forEach(warning => this.streamUpdate(`   • ${warning}`));
      }

      this.streamUpdate('✅ Response validation passed - proceeding with file generation');
      
      // Continue with existing integration logic...
      return await this.executeIntegration(generationResult, integrationAnalysis);
      
    } catch (error) {
      if (currentAttempt < maxRetries - 1) {
        this.streamUpdate(`❌ Attempt ${currentAttempt + 1} failed: ${error}`);
        this.streamUpdate('🔄 Retrying...');
        currentAttempt++;
        continue;
      } else {
        throw error;
      }
    }
  }

  throw new Error(`Integration failed after ${maxRetries} attempts`);
}

  /**
   * 🔥 ENHANCED: PAGE INTEGRATION PROMPT WITH CLEAN NAMING
   */
 private createComponentIntegrationPrompt(
  generationResult: GenerationResult,
  integrationAnalysis: IntegrationAnalysis,
  contextFiles: Array<{
    path: string, 
    content: string, 
    purpose: string, 
    integrationType: string, 
    contentLength: number, 
    isLargeFile: boolean
  }>
): string {
  const { componentType, generatedContent } = generationResult;
  
  const cleanDisplayName = integrationAnalysis.componentDisplayName;
  const importPath = `@/components/${cleanDisplayName}`;
  
  const contextContent = contextFiles.map(f => {
    // 🔥 CRITICAL: Add explicit warning for large files
    const sizeWarning = f.isLargeFile ? `
🚨🚨🚨 CRITICAL: THIS IS A LARGE FILE (${f.contentLength} chars)
YOU MUST OUTPUT THE COMPLETE CONTENT - NO TRUNCATION ALLOWED
DO NOT USE "..." OR "// existing content" OR ANY PLACEHOLDER COMMENTS
INCLUDE EVERY SINGLE LINE FROM THE ORIGINAL FILE
🚨🚨🚨` : '';
    
    return `FILE: ${f.path}
PURPOSE: ${f.purpose}
TYPE: ${f.integrationType}
SIZE: ${f.contentLength} chars${sizeWarning}

COMPLETE ORIGINAL CONTENT (MUST BE PRESERVED 100%):
${f.content}`;
  }).join('\n\n---\n\n');

  const filesToGenerate = [integrationAnalysis.mainComponentFile, ...integrationAnalysis.integrationFiles]
    .filter(plan => !plan.skipReason)
    .map(plan => `- ${plan.exists ? 'MODIFY' : 'CREATE'} ${plan.filePath} (${plan.purpose})`)
    .join('\n');

  const usageContext = integrationAnalysis.usageAnalysis.hasPages ? `
🎯 COMPONENT USAGE INTEGRATION:
- Clean component name: ${cleanDisplayName}
- Show practical usage examples with realistic props
- Add import statements and component usage
- PRESERVE 100% OF EXISTING PAGE CONTENT - NO EXCEPTIONS

TARGET PAGES FOR COMPONENT USAGE:
${integrationAnalysis.usageAnalysis.pageFiles.map(pageFile => `
- ${pageFile.filePath} (${pageFile.type.toUpperCase()}):
  * Priority: ${pageFile.isMainPage ? 'HIGH (Main Page)' : 'NORMAL'}
  * Strategy: Add ${cleanDisplayName} import and usage example while preserving ALL existing content
`).join('')}

🚨 CRITICAL: NO NAVIGATION LINKS for components - only usage examples!
` : 'USAGE: No suitable pages found for component integration';

  return `
TASK: COMPONENT Integration for ${cleanDisplayName} with COMPLETE content preservation

🚨🚨🚨 ABSOLUTE RULES - VIOLATION WILL CAUSE COMPLETE FAILURE:
1. NEVER WRITE "// ... (content remains unchanged)" OR ANY PLACEHOLDER COMMENTS
2. NEVER WRITE "/* ... existing content ... */" OR SIMILAR TRUNCATION
3. NEVER WRITE "// ... rest of the code" OR "// ... other imports"
4. NEVER USE "..." OR ELLIPSIS TO REPRESENT EXISTING CODE
5. INCLUDE EVERY SINGLE LINE FROM THE ORIGINAL FILE IN YOUR OUTPUT
6. IF A FILE HAS 200 LINES, YOUR OUTPUT MUST HAVE 200+ LINES (PLUS YOUR ADDITIONS)
7. COPY-PASTE MENTALITY: TREAT THIS LIKE YOU'RE COPYING THE ENTIRE FILE AND ADDING NEW CODE

🚨 EXAMPLES OF FORBIDDEN OUTPUT:
❌ import React from 'react';
❌ // ... (other imports)
❌ const Dashboard = () => {
❌   // ... (existing state)
❌   return <div>...</div>
❌ }

✅ CORRECT OUTPUT EXAMPLE:
✅ import React, { useState, useEffect } from 'react';
✅ import { useAuth } from '../contexts/AuthContext';
✅ import { useCart } from '../contexts/CartContext';
✅ import { supabase } from '../lib/supabase';
✅ import { toast } from 'sonner';
✅ import { ShoppingCart, Heart, User, Package, Star, CreditCard, Calendar, Eye, Trash2, Plus, Minus } from 'lucide-react';
✅ import ${cleanDisplayName} from "${importPath}";
✅ 
✅ const Dashboard = () => {
✅   const [activeTab, setActiveTab] = useState('overview');
✅   const [cartItems, setCartItems] = useState([]);
✅   // ... INCLUDE EVERY SINGLE LINE OF ORIGINAL CODE
✅   return (
✅     <div className="min-h-screen bg-gradient-to-br from-primary-50 via-background to-secondary-50 py-8">
✅       {/* INCLUDE EVERY SINGLE LINE OF ORIGINAL JSX */}
✅       <${cleanDisplayName} prop1="value" />
✅       {/* CONTINUE WITH ALL ORIGINAL CONTENT */}
✅     </div>
✅   );
✅ };

COMPONENT DETAILS:
- Type: COMPONENT
- Clean Name: ${cleanDisplayName} (was: ${componentType.name})
- File: ${integrationAnalysis.mainComponentFile.filePath}
- Import Path: ${importPath}

GENERATED COMPONENT CODE:
\`\`\`tsx
${generatedContent.replace(new RegExp(`export default ${componentType.name}`, 'g'), `export default ${cleanDisplayName}`)}
\`\`\`

${usageContext}

FILES TO PROCESS:
${filesToGenerate}

EXISTING FILES WITH COMPLETE CONTENT:
${contextContent}

🚨 CONTENT PRESERVATION VALIDATION CHECKLIST:
Before outputting each file, verify:
□ Does my output contain ANY placeholder comments? (If YES, REWRITE COMPLETELY)
□ Did I include EVERY import from the original file?
□ Did I include EVERY function from the original file?
□ Did I include EVERY piece of JSX from the original file?
□ Did I only ADD new code without removing anything?
□ Is my output file LONGER than the original (because I added content)?

🚨 CRITICAL NAMING RULES:
1. Component name MUST be: ${cleanDisplayName}
2. Import MUST be: import ${cleanDisplayName} from "${importPath}"
3. Usage MUST be: <${cleanDisplayName} prop="value" />

COMPONENT INTEGRATION REQUIREMENTS:
1. Add import at top with existing imports
2. Add component usage in logical places
3. Preserve EVERY SINGLE LINE of existing code
4. Show realistic component usage examples
5. NO navigation links (components don't go in navigation)

🚨 RESPONSE FORMAT - COMPLETE FILES ONLY:
=== FILE: path/to/file.tsx ===
\`\`\`tsx
[COMPLETE FILE CONTENT - EVERY SINGLE LINE FROM ORIGINAL PLUS NEW ADDITIONS]
\`\`\`

🚨 FINAL WARNING: 
If you write ANY placeholder comments or truncate ANY content, the integration will FAIL.
Your job is to be a COPY-PASTE MACHINE that includes EVERYTHING and adds new content.
Think of it as: "Take the original file, add my new import and usage, output EVERYTHING."

Generate ALL files with COMPLETE content now:
`;
}

/**
 * 🔥 FIXED: PAGE INTEGRATION PROMPT WITH ZERO TOLERANCE FOR PLACEHOLDERS
 */
private createPageIntegrationPrompt(
  generationResult: GenerationResult,
  integrationAnalysis: IntegrationAnalysis,
  contextFiles: Array<{
    path: string, 
    content: string, 
    purpose: string, 
    integrationType: string, 
    navigationFileType?: string,
    contentLength: number, 
    isLargeFile: boolean
  }>
): string {
  const { componentType, generatedContent } = generationResult;
  
  const cleanDisplayName = integrationAnalysis.componentDisplayName;
  const cleanRoutePath = integrationAnalysis.componentRoutePath;
  const importPath = `./pages/${cleanDisplayName}`;
  
  const contextContent = contextFiles.map(f => {
    // 🔥 CRITICAL: Add explicit warning for large files
    const sizeWarning = f.isLargeFile ? `
🚨🚨🚨 CRITICAL: THIS IS A LARGE FILE (${f.contentLength} chars)
YOU MUST OUTPUT THE COMPLETE CONTENT - NO TRUNCATION ALLOWED
DO NOT USE "..." OR "// existing content" OR ANY PLACEHOLDER COMMENTS
INCLUDE EVERY SINGLE LINE FROM THE ORIGINAL FILE
🚨🚨🚨` : '';
    
    const navTypeInfo = f.navigationFileType ? `\nNAVIGATION TYPE: ${f.navigationFileType.toUpperCase()}` : '';
    
    return `FILE: ${f.path}
PURPOSE: ${f.purpose}
TYPE: ${f.integrationType}${navTypeInfo}
SIZE: ${f.contentLength} chars${sizeWarning}

COMPLETE ORIGINAL CONTENT (MUST BE PRESERVED 100%):
${f.content}`;
  }).join('\n\n---\n\n');

  const filesToGenerate = [integrationAnalysis.mainComponentFile, ...integrationAnalysis.integrationFiles]
    .filter(plan => !plan.skipReason)
    .map(plan => {
      const navType = plan.navigationFileType ? ` (${plan.navigationFileType.toUpperCase()})` : '';
      return `- ${plan.exists ? 'MODIFY' : 'CREATE'} ${plan.filePath}${navType} (${plan.purpose})`;
    })
    .join('\n');

  // Navigation context with strict preservation rules
  const navigationContext = integrationAnalysis.navigationAnalysis.routeAlreadyExists ? `
🚨 ROUTE ALREADY EXISTS - COMPONENT CREATION ONLY:
- Route /${cleanRoutePath} already exists in navigation
- Strategy: Create component file only, NO navigation modifications
` : integrationAnalysis.navigationAnalysis.hasNavigation ? `
✅ NEW ROUTE INTEGRATION - WITH COMPLETE FILE PRESERVATION:
- Route /${cleanRoutePath} is NEW and can be added to navigation
- MUST preserve ALL existing navigation structure
- MUST include ALL existing routes and links
- Only ADD new route, never remove existing content
` : 'NAVIGATION: None found in project';

  return `
TASK: PAGE Integration for ${cleanDisplayName} with COMPLETE content preservation

🚨🚨🚨 ABSOLUTE RULES - VIOLATION WILL CAUSE COMPLETE FAILURE:
1. NEVER WRITE "// ... (content remains unchanged)" OR ANY PLACEHOLDER COMMENTS
2. NEVER WRITE "/* ... existing content ... */" OR SIMILAR TRUNCATION
3. NEVER WRITE "// ... rest of the JSX" OR "// ... other routes"
4. NEVER USE "..." OR ELLIPSIS TO REPRESENT EXISTING CODE
5. INCLUDE EVERY SINGLE LINE FROM THE ORIGINAL FILE IN YOUR OUTPUT
6. FOR APP.TSX: INCLUDE ALL EXISTING ROUTES + ADD NEW ROUTE
7. FOR NAVIGATION: INCLUDE ALL EXISTING LINKS + ADD NEW LINK

🚨 EXAMPLES OF FORBIDDEN OUTPUT:
❌ import React from 'react';
❌ // ... (other imports)
❌ function App() {
❌   return (
❌     <Router>
❌       <Routes>
❌         // ... (existing routes)
❌         <Route path="/${cleanRoutePath}" element={<${cleanDisplayName} />} />
❌       </Routes>
❌     </Router>
❌   );
❌ }

✅ CORRECT OUTPUT EXAMPLE:
✅ import React from 'react';
✅ import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
✅ import Home from './pages/Home';
✅ import About from './pages/About';
✅ import Contact from './pages/Contact';
✅ import ${cleanDisplayName} from "${importPath}";
✅ 
✅ function App() {
✅   return (
✅     <Router>
✅       <Routes>
✅         <Route path="/" element={<Home />} />
✅         <Route path="/about" element={<About />} />
✅         <Route path="/contact" element={<Contact />} />
✅         <Route path="/${cleanRoutePath}" element={<${cleanDisplayName} />} />
✅       </Routes>
✅     </Router>
✅   );
✅ }

COMPONENT DETAILS:
- Type: PAGE
- Clean Name: ${cleanDisplayName} (was: ${componentType.name})
- Clean Route: /${cleanRoutePath}
- File: ${integrationAnalysis.mainComponentFile.filePath}
- Import Path: ${importPath}

GENERATED PAGE CODE:
\`\`\`tsx
${generatedContent.replace(new RegExp(`export default ${componentType.name}`, 'g'), `export default ${cleanDisplayName}`)}
\`\`\`

${navigationContext}

FILES TO PROCESS:
${filesToGenerate}

EXISTING FILES WITH COMPLETE CONTENT:
${contextContent}

🚨 CONTENT PRESERVATION VALIDATION CHECKLIST:
Before outputting each file, verify:
□ Does my output contain ANY placeholder comments? (If YES, REWRITE COMPLETELY)
□ Did I include EVERY import from the original file?
□ Did I include EVERY route from the original App.tsx?
□ Did I include EVERY navigation link from the original header/navbar?
□ Did I include EVERY function and component from the original file?
□ Did I only ADD new content without removing anything?
□ Is my output file LONGER than the original (because I added content)?

🚨 CRITICAL NAMING RULES:
1. Component name MUST be: ${cleanDisplayName}
2. Route path MUST be: /${cleanRoutePath}
3. Import MUST be: import ${cleanDisplayName} from "${importPath}"

PAGE INTEGRATION REQUIREMENTS:
1. Add import to App.tsx with existing imports
2. Add route to App.tsx with existing routes
3. Add navigation link to header/navbar if space available
4. Preserve EVERY SINGLE LINE of existing code
5. Show new route alongside all existing routes

🚨 RESPONSE FORMAT - COMPLETE FILES ONLY:
=== FILE: path/to/file.tsx ===
\`\`\`tsx
[COMPLETE FILE CONTENT - EVERY SINGLE LINE FROM ORIGINAL PLUS NEW ADDITIONS]
\`\`\`

🚨 FINAL WARNING: 
If you write ANY placeholder comments or truncate ANY content, the integration will FAIL.
Your job is to be a COPY-PASTE MACHINE that includes EVERYTHING and adds new content.
Think of it as: "Take the original file, add my new import/route/link, output EVERYTHING."

Generate ALL files with COMPLETE content now:
`;
}

/**
 * 🔥 NEW: ADD RESPONSE VALIDATION TO REJECT PLACEHOLDER RESPONSES
 */
private validateResponseContent(responseText: string, originalFiles: Map<string, string>): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for forbidden placeholder patterns
  const forbiddenPatterns = [
    /\/\/\s*\.\.\.\s*\(/,  // // ... (
    /\/\*\s*\.\.\.\s*\*\//, // /* ... */
    /\/\/\s*existing/i,     // // existing
    /\/\/\s*rest\s*of/i,    // // rest of
    /\/\/\s*other/i,        // // other
    /\.\.\.\s*\)/,          // ... )
    /remains\s*unchanged/i,  // remains unchanged
    /content\s*above/i,      // content above
    /as\s*before/i          // as before
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(responseText)) {
      errors.push(`Found forbidden placeholder pattern: ${pattern.source}`);
    }
  }

  // Extract files from response
  const filePattern = /=== FILE: (.+?) ===\s*```(?:tsx|typescript|jsx|javascript)\s*([\s\S]*?)```/g;
  let match;
  const generatedFiles = new Map<string, string>();

  while ((match = filePattern.exec(responseText)) !== null) {
    const filePath = match[1].trim();
    const content = match[2].trim();
    generatedFiles.set(filePath, content);
  }

  // Validate each generated file against original
  for (const [filePath, generatedContent] of generatedFiles) {
    const originalContent = originalFiles.get(filePath);
    
    if (originalContent) {
      // Check if generated content is significantly shorter (indicating truncation)
      const originalLines = originalContent.split('\n').length;
      const generatedLines = generatedContent.split('\n').length;
      
      if (generatedLines < originalLines * 0.8) {
        errors.push(`File ${filePath}: Generated content is too short (${generatedLines} vs ${originalLines} lines) - likely truncated`);
      }

      // Check if key imports are missing
      const originalImports = originalContent.match(/^import\s+.+$/gm) || [];
      const generatedImports = generatedContent.match(/^import\s+.+$/gm) || [];
      
      if (originalImports.length > generatedImports.length) {
        warnings.push(`File ${filePath}: Some imports may be missing (${generatedImports.length} vs ${originalImports.length})`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

  // Keep existing methods for usage analysis, file detection, etc...
  // (The rest of the methods remain the same as in the original code)

  /**
   * ANALYZE USAGE TARGETS (FOR COMPONENTS ONLY) - AI-DRIVEN
   */
  private async analyzeUsageTargets(
    projectFiles: Map<string, ProjectFile>, 
    componentType: ComponentTypeAnalysis,
    userPrompt: string
  ): Promise<UsageAnalysis> {
    this.streamUpdate('🤖 Using AI to analyze best integration targets...');
    
    const allPageFiles = this.findAllPageFiles(projectFiles);
    const allLayoutComponents = this.findAllLayoutComponents(projectFiles);
    
    const allTargets = [
      ...allPageFiles.map(p => ({ ...p, targetType: 'page' as const })),
      ...allLayoutComponents.map(l => ({ ...l, targetType: 'layout-component' as const }))
    ];
    
    if (allTargets.length === 0) {
      return {
        hasPages: false,
        pageFiles: [],
        targetPages: []
      };
    }

    const aiAnalysis = await this.getAIIntegrationAnalysis(
      userPrompt,
      componentType,
      allTargets
    );

    const pageFiles: PageFileInfo[] = aiAnalysis.recommendedPages.map((rec, index) => {
      const file = projectFiles.get(rec.filePath);
      return {
        filePath: rec.filePath,
        type: rec.targetType === 'layout-component' ? 'layout' : 'page',
        priority: rec.priority,
        isMainPage: rec.isMainPage,
        componentImports: file ? this.extractComponentImports(file.content) : [],
        aiReason: rec.reason
      };
    });

    return {
      hasPages: pageFiles.length > 0,
      pageFiles: pageFiles.slice(0, 3),
      targetPages: pageFiles.map(p => p.filePath),
      aiAnalysis: aiAnalysis.reasoning
    };
  }

  private findAllLayoutComponents(projectFiles: Map<string, ProjectFile>): Array<{filePath: string, fileName: string}> {
    const layoutComponents: Array<{filePath: string, fileName: string}> = [];
    
    const layoutPatterns = [
      /header/i, /navbar/i, /navigation/i, /layout/i, /menu/i, /sidebar/i, /footer/i
    ];
    
    for (const [filePath, file] of projectFiles) {
      if (filePath.includes('/components/') || filePath.includes('\\components\\')) {
        const fileName = filePath.split('/').pop() || filePath;
        const fileNameClean = fileName.replace(/\.(tsx|jsx|ts|js)$/, '');
        
        if (layoutPatterns.some(pattern => pattern.test(fileName) || pattern.test(filePath))) {
          layoutComponents.push({
            filePath,
            fileName: fileNameClean
          });
        }
      }
    }
    
    return layoutComponents;
  }

  private findAllPageFiles(projectFiles: Map<string, ProjectFile>): Array<{filePath: string, fileName: string}> {
    const pageFiles: Array<{filePath: string, fileName: string}> = [];
    
    for (const [filePath, file] of projectFiles) {
      if (this.looksLikePage(filePath, file)) {
        const fileName = filePath.split('/').pop() || filePath;
        pageFiles.push({
          filePath,
          fileName: fileName.replace(/\.(tsx|jsx|ts|js)$/, '')
        });
      }
    }
    
    return pageFiles;
  }

  private looksLikePage(filePath: string, file: ProjectFile): boolean {
    if (file.isAppFile || file.isRouteFile) return false;
    if (filePath.includes('/components/') && !filePath.includes('/pages/')) return false;
    if (filePath.includes('/utils/') || filePath.includes('/hooks/')) return false;
    
    if (filePath.includes('/pages/')) return true;
    if (file.mainComponent && file.content.includes('export default')) return true;
    
    return false;
  }

  private async getAIIntegrationAnalysis(
    userPrompt: string,
    componentType: ComponentTypeAnalysis,
    availableTargets: Array<{filePath: string, fileName: string, targetType: 'page' | 'layout-component'}>
  ): Promise<{
    recommendedPages: Array<{
      filePath: string,
      priority: number,
      isMainPage: boolean,
      reason: string,
      targetType: 'page' | 'layout-component'
    }>,
    reasoning: string
  }> {
    const pageTargets = availableTargets.filter(t => t.targetType === 'page');
    const layoutTargets = availableTargets.filter(t => t.targetType === 'layout-component');
    
    const isNavigationComponent = this.isNavigationComponent(componentType, userPrompt);
    
    const analysisPrompt = `
TASK: Analyze where to integrate the "${componentType.name}" component

USER REQUEST: "${userPrompt}"

COMPONENT DETAILS:
- Name: ${componentType.name}
- Type: ${componentType.type}
- Category: ${componentType.category}
- Description: ${componentType.description || 'N/A'}
- Likely Navigation/Layout Component: ${isNavigationComponent ? 'YES' : 'NO'}

AVAILABLE INTEGRATION TARGETS:

LAYOUT COMPONENTS (Header, Navbar, etc.):
${layoutTargets.length > 0 ? layoutTargets.map((target, index) => `${index + 1}. ${target.fileName} (${target.filePath}) - Layout Component`).join('\n') : 'None found'}

PAGES:
${pageTargets.length > 0 ? pageTargets.map((target, index) => `${index + 1}. ${target.fileName} (${target.filePath}) - Page`).join('\n') : 'None found'}

RESPONSE FORMAT (JSON):
{
  "reasoning": "Overall analysis of integration strategy and target choices...",
  "recommendedPages": [
    {
      "filePath": "exact/file/path",
      "priority": 1,
      "isMainPage": false,
      "targetType": "layout-component",
      "reason": "Specific reason why this target is perfect for the component"
    }
  ]
}

Analyze and recommend the best integration targets:
`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 1500,
        temperature: 0.3,
        messages: [{ role: 'user', content: analysisPrompt }]
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        
        const validRecommendations = analysis.recommendedPages.filter((rec: any) => 
          availableTargets.some(target => target.filePath === rec.filePath)
        );

        return {
          recommendedPages: validRecommendations,
          reasoning: analysis.reasoning
        };
      }
    } catch (error) {
      this.streamUpdate(`⚠️ AI analysis failed, using fallback: ${error}`);
    }

    const fallbackRecommendations = this.getFallbackRecommendations(availableTargets, componentType);
    
    return {
      recommendedPages: fallbackRecommendations.map(page => ({
        ...page,
        targetType: 'page' as const
      })),
      reasoning: 'Using fallback analysis due to AI parsing issues'
    };
  }

  private isNavigationComponent(componentType: ComponentTypeAnalysis, userPrompt: string): boolean {
    const navigationPatterns = [
      /sidebar/i, /navbar/i, /navigation/i, /menu/i, /drawer/i, /panel/i, 
      /header/i, /footer/i, /layout/i, /nav/i
    ];
    
    if (navigationPatterns.some(pattern => pattern.test(componentType.name))) {
      return true;
    }
    
    if (navigationPatterns.some(pattern => pattern.test(userPrompt))) {
      return true;
    }
    
    if (navigationPatterns.some(pattern => pattern.test(componentType.description ?? ''))) {
      return true;
    }
    
    return false;
  }

  private getFallbackRecommendations(
    availablePages: Array<{filePath: string, fileName: string}>,
    componentType: ComponentTypeAnalysis
  ): Array<{filePath: string, priority: number, isMainPage: boolean, reason: string}> {
    const recommendations: Array<{filePath: string, priority: number, isMainPage: boolean, reason: string}> = [];
    
    const priorityPatterns = [
      { patterns: [/home/i, /index/i, /dashboard/i], isMain: true, reason: 'Main landing page - good for showcasing new components' },
      { patterns: [/app/i, /main/i], isMain: true, reason: 'Main application page' },
      { patterns: [/about/i, /profile/i], isMain: false, reason: 'Content page suitable for component demonstration' }
    ];

    for (const pattern of priorityPatterns) {
      const matchingPage = availablePages.find(page => 
        pattern.patterns.some(p => p.test(page.fileName) || p.test(page.filePath))
      );
      
      if (matchingPage && !recommendations.some(r => r.filePath === matchingPage.filePath)) {
        recommendations.push({
          filePath: matchingPage.filePath,
          priority: recommendations.length + 1,
          isMainPage: pattern.isMain,
          reason: pattern.reason
        });
      }
    }

    if (recommendations.length === 0 && availablePages.length > 0) {
      recommendations.push({
        filePath: availablePages[0].filePath,
        priority: 1,
        isMainPage: true,
        reason: 'First available page in project'
      });
    }

    return recommendations.slice(0, 2);
  }

  // Keep existing utility methods...
  private hasNavigationLinks(content: string): boolean {
    const navPatterns = [
      /href=["'][^"']*["']/g,
      /to=["'][^"']*["']/g,
      /<Link\s+to=/g,
      /<NavLink\s+to=/g,
      /navigate\(/g,
      /<a\s+href=/g,
      /<nav\s/g,
      /className=["'][^"']*nav[^"']*["']/g
    ];

    const contentPatterns = [
      /navigation/i,
      /menu/i,
      /navbar/i,
      /header/i,
      /footer/i
    ];

    const hasNavPatterns = navPatterns.some(pattern => pattern.test(content));
    const hasNavContent = contentPatterns.some(pattern => pattern.test(content));
    
    return hasNavPatterns || hasNavContent;
  }

  private extractNavigationLinks(content: string): string[] {
    const links: string[] = [];
    
    // Extract href attributes (including hash links)
    const hrefMatches = content.match(/href=["']([^"']+)["']/g) || [];
    hrefMatches.forEach(match => {
      const link = match.replace(/href=["']([^"']+)["']/, '$1');
      if (!links.includes(link)) {
        links.push(link);
      }
    });

    // Extract 'to' attributes from React Router Links
    const linkMatches = content.match(/to=["']([^"']+)["']/g) || [];
    linkMatches.forEach(match => {
      const link = match.replace(/to=["']([^"']+)["']/, '$1');
      if (!links.includes(link)) {
        links.push(link);
      }
    });

    return links;
  }

  private extractComponentImports(content: string): string[] {
    const imports: string[] = [];
    
    // Extract component imports (starting with capital letter)
    const importMatches = content.match(/import\s+(\w+)\s+from\s+['"][^'"]*['"]/g) || [];
    importMatches.forEach(match => {
      const nameMatch = match.match(/import\s+(\w+)\s+from/);
      if (nameMatch && /^[A-Z]/.test(nameMatch[1])) {
        imports.push(nameMatch[1]);
      }
    });

    // Extract named component imports
    const namedImportMatches = content.match(/import\s*\{([^}]+)\}\s*from\s*['"][^'"]*['"]/g) || [];
    namedImportMatches.forEach(match => {
      const namesMatch = match.match(/\{([^}]+)\}/);
      if (namesMatch) {
        const names = namesMatch[1].split(',').map(n => n.trim());
        names.forEach(name => {
          if (/^[A-Z]/.test(name)) {
            imports.push(name);
          }
        });
      }
    });

    return imports;
  }

  /**
   * PARSE GENERATED FILES FROM RESPONSE
   */
  private parseGeneratedFiles(
    responseText: string,
    plans: IntegrationPlan[]
  ): Map<string, string> {
    const results = new Map<string, string>();

    // Match file sections using the exact format
    const filePattern = /=== FILE: (.+?) ===\s*```(?:tsx|typescript|jsx|javascript)\s*([\s\S]*?)```/g;
    let match;

    while ((match = filePattern.exec(responseText)) !== null) {
      const filePath = match[1].trim();
      const content = match[2].trim();
      
      if (content && content.length > 0) {
        results.set(filePath, content);
        this.streamUpdate(`   📄 Parsed: ${filePath} (${content.length} chars)`);
      }
    }

    // If no files found with exact format, try alternative parsing
    if (results.size === 0) {
      this.streamUpdate('   ⚠️  Exact format not found, trying alternative parsing...');
      
      const codeBlocks = responseText.match(/```(?:tsx|typescript|jsx|javascript)\s*([\s\S]*?)```/g);
      if (codeBlocks && plans.length > 0) {
        codeBlocks.forEach((block, index) => {
          const content = block.replace(/```(?:tsx|typescript|jsx|javascript)\s*/, '').replace(/```$/, '').trim();
          if (content && index < plans.length) {
            const plan = plans[index];
            results.set(plan.filePath, content);
            this.streamUpdate(`   📄 Alt parsed: ${plan.filePath} (${content.length} chars)`);
          }
        });
      }
    }

    this.streamUpdate(`   📊 Total files parsed: ${results.size}`);
    return results;
  }

  /**
   * UTILITY METHODS
   */
  private async writeFile(filePath: string, content: string): Promise<void> {
    const fullPath = join(this.reactBasePath, filePath);
    const dir = dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf8');
  }

  private fileExists(filePath: string, projectFiles: Map<string, ProjectFile>): boolean {
    if (projectFiles.has(filePath)) return true;
    
    // Check variations
    const variations = [
      filePath.replace(/^src\//, ''),
      filePath.replace('.js', '.ts'),
      filePath.replace('.js', '.tsx'),
      filePath.replace('.jsx', '.tsx')
    ];
    
    return variations.some(variation => projectFiles.has(variation));
  }

  /**
   * 🔥 ENHANCED: GENERATE PROPER IMPORT PATH WITH CLEAN NAMING
   */
  private generateImportPath(componentType: ComponentTypeAnalysis, cleanName: string): string {
    if (componentType.type === 'component') {
      // Components use @/ alias: @/components/CleanName
      return `@/components/${cleanName}`;
    } else {
      // Pages use relative paths: ./pages/CleanName
      return `./pages/${cleanName}`;
    }
  }

  /**
   * 🔥 ENHANCED: GET INTEGRATION SUMMARY WITH SMART FEATURES
   */
  getIntegrationSummary(result: IntegrationResult): string {
    const summary = `
ENHANCED INTEGRATION ENGINE - SMART SUMMARY
==========================================
✅ Success: ${result.success}
📁 Created Files: ${result.createdFiles.length}
📝 Modified Files: ${result.modifiedFiles.length}
⏭️  Skipped Files: ${result.skippedFiles.length}

SMART FEATURES APPLIED:
🎨 Clean Naming: Removed redundant suffixes (Page, Component)
🔍 Route Detection: Checked existing navigation for duplicates
🧠 AI Integration: Smart targeting for component usage
🚫 Conflict Prevention: Skipped files to avoid duplicates

INTEGRATION RESULTS:
🛣️  Routing Updated: ${result.integrationResults.routingUpdated}
📱 App File Updated: ${result.integrationResults.appFileUpdated}
🧭 Navigation Updated: ${result.integrationResults.navigationUpdated}
🔝 Header Updated: ${result.integrationResults.headerUpdated}
🔻 Footer Updated: ${result.integrationResults.footerUpdated}
🔗 Dependencies Resolved: ${result.integrationResults.dependenciesResolved}
🎯 Usage Examples Added: ${result.integrationResults.usageExampleAdded}
📄 Pages Updated: ${result.integrationResults.pagesUpdated.length}

SMART DETECTION RESULTS:
🔄 Route Already Existed: ${result.integrationResults.routeAlreadyExisted ? 'YES - Skipped nav updates' : 'NO - Full integration'}
🧭 Navigation Already Exists: ${result.integrationResults.navigationAlreadyExists ? 'YES - Avoided duplicates' : 'NO - Added new links'}

CREATED FILES:
${result.createdFiles.map(f => `   🆕 ${f}`).join('\n') || '   None'}

MODIFIED FILES:
${result.modifiedFiles.map(f => `   ✏️  ${f}`).join('\n') || '   None'}

SKIPPED FILES (Smart Prevention):
${result.skippedFiles.map(f => `   ⏭️  ${f}`).join('\n') || '   None'}

${result.integrationResults.pagesUpdated.length > 0 ? `
PAGES WITH COMPONENT USAGE:
${result.integrationResults.pagesUpdated.map(f => `   🎯 ${f}`).join('\n')}
` : ''}

${result.warnings && result.warnings.length > 0 ? `
⚠️  WARNINGS:
${result.warnings.map(w => `   ⚠️  ${w}`).join('\n')}
` : ''}

${result.error ? `❌ ERROR: ${result.error}` : '✅ Smart Integration completed successfully!'}

KEY IMPROVEMENTS:
✨ Clean component/page names without redundant suffixes
🎯 Smart route detection prevents navigation conflicts  
🤖 AI-driven integration targeting for optimal placement
📋 Comprehensive skipping logic prevents file conflicts
🔗 Context-aware import path generation
`;

    return summary;
  }
}