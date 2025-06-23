import * as fs from 'fs/promises';
import * as path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { LintResult, LinterOptions } from './linter';
import { ComponentPathResolver } from './component-path-resolver';
import { getJsxAttr } from './rules/utils';

interface PerformanceRecorder {
  record(filePath: string, timings: Record<string, number>): void;
}

interface ComponentReference {
  name: string;
  path: string | null;
  rawImportPath: string | null;
  sourceLocation: {
    line: number;
    column: number;
  };
  // Track JSX usage locations
  usageLocations: Array<{
    line: number;
    column: number;
  }>;
}

interface HeadingInfo {
  level: number;
  line: number;
  column: number;
  filePath: string;
}

interface IdInfo {
  id: string;
  line: number;
  column: number;
  filePath: string;
}

interface NavInfo {
  filePath: string;
  line: number;
  column: number;
  hasLocalLink: boolean;
  childComponents: ComponentReference[];
}

interface ComponentDefinition {
  name: string;
  filePath: string;
  issues: Map<string, LintResult[]>;
  usesComponents: ComponentReference[];
  headings: HeadingInfo[];
  ids: IdInfo[];
  navs: NavInfo[];
  hasLocalAnchor: boolean;
}

export class ComponentAnalyzer {
  private componentRegistry = new Map<string, ComponentDefinition>();
  private importToComponentMap = new Map<string, Map<string, string>>();
  private options: LinterOptions & { crossComponentAnalysis?: boolean };
  private processingComponentStack = new Set<string>(); // To prevent circular references
  private perf?: PerformanceRecorder;
  private resolver = new ComponentPathResolver();

  constructor(options: LinterOptions & { crossComponentAnalysis?: boolean }, perf?: PerformanceRecorder) {
    this.options = options;
    this.perf = perf;
  }

  async analyzeFile(filePath: string): Promise<ComponentDefinition | null> {
    const start = Date.now();
    try {
      filePath = path.resolve(filePath);
      const content = await fs.readFile(filePath, 'utf8');
      if (!/\.(jsx|tsx)$/.test(filePath)) return null;
      const { component, timings } = await this.extractComponentInfo(content, filePath);
      timings.total = Date.now() - start;
      this.perf?.record(filePath, timings);
      return component;
    } catch (e) {
      console.error(`[ZemDomu] Error analyzing file ${filePath}:`, e);
      return null;
    }
  }

  private async extractComponentInfo(content: string, filePath: string): Promise<{ component: ComponentDefinition; timings: Record<string, number> }> {
    const timings: Record<string, number> = {};
    let t0 = Date.now();
    const ast = parse(content, { sourceType: 'module', plugins: ['typescript','jsx'] });
    timings.parse = Date.now() - t0;
    const componentName = path.basename(filePath, path.extname(filePath));
    const componentDef: ComponentDefinition = {
      name: componentName,
      filePath,
      issues: new Map(),
      usesComponents: [],
      headings: [],
      ids: [],
      navs: [],
      hasLocalAnchor: false,
    };

    // Track imported components
    const importedComponents = new Map<string, string>();
    
    // Collect imports
    t0 = Date.now();
    traverse(ast, {
      ImportDeclaration(path) {
        const source = path.node.source.value as string;
        path.node.specifiers.forEach(spec => {
          if (t.isImportSpecifier(spec) || t.isImportDefaultSpecifier(spec)) {
            const name = spec.local.name;
            if (/^[A-Z]/.test(name)) {
              importedComponents.set(name, source);
            }
          }
        });
      }
    });
    timings.collectImports = Date.now() - t0;

    // Collect JSX usages, headings, ids and nav info
    t0 = Date.now();
    const navStack: NavInfo[] = [];
    traverse(ast, {
      JSXElement: {
        enter(path) {
          const elt = path.node.openingElement.name;
          if (!t.isJSXIdentifier(elt)) return;
          const name = elt.name;
          const tag = name.toLowerCase();

          // Record headings
          if (/^h[1-6]$/.test(tag)) {
            const level = parseInt(tag.charAt(1), 10);
            const loc = path.node.openingElement.loc?.start;
            if (loc) {
              componentDef.headings.push({
                level,
                line: loc.line - 1,
                column: loc.column,
                filePath,
              });
            }
          }

          // Track <nav> elements
          if (tag === 'nav') {
            const loc = path.node.openingElement.loc?.start;
            const navInfo: NavInfo = {
              filePath,
              line: loc ? loc.line - 1 : 0,
              column: loc ? loc.column : 0,
              hasLocalLink: false,
              childComponents: [],
            };
            navStack.push(navInfo);
            componentDef.navs.push(navInfo);
          }

          // Track <a> elements
          if (tag === 'a') {
            componentDef.hasLocalAnchor = true;
            navStack.forEach(n => (n.hasLocalLink = true));
          }

          // Track id attributes
          const idAttr = getJsxAttr(path.node.openingElement, 'id');
          if (idAttr) {
            const loc = path.node.openingElement.loc?.start;
            componentDef.ids.push({
              id: idAttr,
              line: loc ? loc.line - 1 : 0,
              column: loc ? loc.column : 0,
              filePath,
            });
          }

          // Record component usage (only for capitalized components)
          if (/^[A-Z]/.test(name)) {
            const existingRef = componentDef.usesComponents.find(c => c.name === name);
            const loc = elt.loc?.start;
            const location = loc ? { line: loc.line - 1, column: loc.column } : { line: 0, column: 0 };

            let ref: ComponentReference;
            if (existingRef) {
              existingRef.usageLocations.push(location);
              ref = existingRef;
            } else {
              const rawImportPath = importedComponents.get(name) || null;
              ref = {
                name,
                path: null,
                rawImportPath,
                sourceLocation: location,
                usageLocations: [location],
              };
              componentDef.usesComponents.push(ref);
            }

            if (navStack.length) {
              navStack[navStack.length - 1].childComponents.push(ref);
            }
          }
        },
        exit(path) {
          const elt = path.node.openingElement.name;
          if (t.isJSXIdentifier(elt) && elt.name.toLowerCase() === 'nav') {
            navStack.pop();
          }
        },
      },
    });
    timings.jsxCollect = Date.now() - t0;

    // Store import mappings for this file
    this.importToComponentMap.set(filePath, importedComponents);

    // Resolve import paths
    t0 = Date.now();
    for (const ref of componentDef.usesComponents) {
      if (ref.rawImportPath) {
        const t1 = Date.now();
        ref.path = await this.resolveComponentPath(ref.rawImportPath, filePath);
        timings[`resolve:${ref.rawImportPath}`] = Date.now() - t1;
      }
    }
    timings.resolvePaths = Date.now() - t0;

    // Check for heading order issues within this component
    t0 = Date.now();
    if (this.options.rules?.enforceHeadingOrder) {
      let lastHeadingLevel = 0;
      const sortedHeadings = [...componentDef.headings].sort((a, b) => {
        if (a.line !== b.line) return a.line - b.line;
        return a.column - b.column;
      });
      
      for (const heading of sortedHeadings) {
        if (lastHeadingLevel && heading.level > lastHeadingLevel + 1) {
          componentDef.issues.set('enforceHeadingOrder', [
            ...(componentDef.issues.get('enforceHeadingOrder') || []),
            {
              line: heading.line,
              column: heading.column,
              message: `Heading level skipped: <h${heading.level}> after <h${lastHeadingLevel}>`,
              rule: 'enforceHeadingOrder'
            }
          ]);
        }
        lastHeadingLevel = heading.level;
      }
    }

    // Synthetic single-H1 issues
    if (this.options.rules?.singleH1) {
      const h1Results: LintResult[] = componentDef.headings
        .filter(h => h.level === 1)
        .map(h => ({ line: h.line, column: h.column, message: '<h1>', rule: 'singleH1' }));
      if (h1Results.length > 0) {
        componentDef.issues.set('singleH1', h1Results);
      }
    }

    timings.headingAnalysis = Date.now() - t0;

    // Register component
    this.componentRegistry.set(filePath, componentDef);
    return { component: componentDef, timings };
  }

  private async resolveComponentPath(importPath: string, currentPath: string): Promise<string | null> {
    return this.resolver.resolve(importPath, currentPath);
  }

  registerComponent(component: ComponentDefinition, issues: LintResult[]): void {
    for (const issue of issues) {
      const rule = issue.rule || this.getRuleType(issue.message);
      if (!component.issues.has(rule)) component.issues.set(rule, []);
      component.issues.get(rule)!.push(issue);
    }
    this.componentRegistry.set(component.filePath, component);
  }

  private getRuleType(msg: string): string {
    if (msg.includes('<h1>')) return 'singleH1';
    if (msg.includes('Heading level')) return 'enforceHeadingOrder';
    if (msg.includes('<section>')) return 'requireSectionHeading';
    if (msg.includes('<img>')) return 'requireAltText';
    if (msg.includes('missing title attribute')) return 'requireIframeTitle';
    if (msg.includes('missing alt attribute') && msg.includes('input type="image"')) return 'requireImageInputAlt';
    if (msg.includes('<html>')) return 'requireHtmlLang';
    if (msg.includes('<button>')) return 'requireButtonText';
    if (msg.includes('Form control')) return 'requireLabelForFormControls';
    if (msg.includes('<li>')) return 'enforceListNesting';
    if (msg.includes('<a>')) return msg.includes('href') ? 'requireHrefOnAnchors' : 'requireLinkText';
    if (msg.includes('<table>')) return 'requireTableCaption';
    if (msg.includes('should not be empty')) return 'preventEmptyInlineTags';
    return 'other';
  }

  analyzeComponentTree(): LintResult[] {
    const results: LintResult[] = [];
    const cross = (this.options as any).crossComponentAnalysis ?? true;
    const rules = this.options.rules || {};

    if (!cross) return results;

    if (rules.singleH1) this.findCrossComponentH1Issues(results);
    if (rules.enforceHeadingOrder) this.findCrossComponentHeadingOrderIssues(results);
    if (rules.uniqueIds) this.findCrossComponentDuplicateIds(results);
    if (rules.requireNavLinks) this.findCrossComponentNavLinks(results);

    return results;
  }

  private findCrossComponentH1Issues(results: LintResult[]): void {
    const entryPoints = this.findEntryPoints();
    for (const entry of entryPoints) {
      const comps = this.findComponentsWithRule(entry, 'singleH1');
      if (comps.length > 1) {
        for (let i = 1; i < comps.length; i++) {
          const comp = comps[i];
          if (!comp || !comp.name) {
            console.error('[ZemDomu] Missing component or name during cross-component analysis', comp);
            continue;
          }
          const ref = this.findReferenceForComp(entry, comp.filePath);
          if (ref) {
            // Use first JSX usage location instead of import location
            const location = ref.usageLocations[0] || ref.sourceLocation;
            results.push({
              filePath: entry.filePath,
              line: location.line,
              column: location.column,
              message: `Multiple <h1> tags: component '${comp.name}' brings an extra <h1>. Use a lower-level heading.`,
              rule: 'singleH1'
            });
          } else {
            const issue = comp.issues.get('singleH1')?.[0];
            if (issue) {
              results.push({
                filePath: comp.filePath,
                line: issue.line,
                column: issue.column,
                message: `Multiple <h1> across components - consider using lower-level headings.`,
                rule: 'singleH1'
              });
            }
          }
        }
      }
    }
  }

  private findReferenceForComp(root: ComponentDefinition, targetPath: string): ComponentReference | null {
    for (const ref of root.usesComponents) {
      if (ref.path === targetPath) return ref;
    }
    for (const ref of root.usesComponents) {
      if (ref.path && this.componentRegistry.has(ref.path)) {
        const nested = this.findReferenceForComp(this.componentRegistry.get(ref.path)!, targetPath);
        if (nested) return ref;
      }
    }
    return null;
  }

  /**
   * Improved implementation to find heading order issues across components
   */
  private findCrossComponentHeadingOrderIssues(results: LintResult[]): void {
    const entryPoints = this.findEntryPoints();
    
    for (const entry of entryPoints) {
      // Process each entry point as a document root
      this.processingComponentStack.clear();
      this.analyzeHeadingHierarchy(entry, results);
    }
  }

  /**
   * Collects all headings from a component and its children in document order
   * and checks for heading level issues
   */
  private analyzeHeadingHierarchy(component: ComponentDefinition, results: LintResult[]): void {
    if (this.processingComponentStack.has(component.filePath)) {
      // Avoid circular references
      return;
    }
    
    this.processingComponentStack.add(component.filePath);

    // Build a flattened view of all headings in document order
    const allHeadings = this.collectHeadingsInDocumentOrder(component);
    
    // Check for heading level issues
    let lastLevel = 0;
    
    for (const heading of allHeadings) {
      if (lastLevel > 0 && heading.heading.level > lastLevel + 1) {
        // We found a heading level skip
        results.push({
          filePath: heading.usageLocation?.filePath || heading.heading.filePath,
          line: heading.usageLocation?.line || heading.heading.line,
          column: heading.usageLocation?.column || heading.heading.column,
          message: `Cross-component heading level skipped: <h${heading.heading.level}> after <h${lastLevel}>`,
          rule: 'enforceHeadingOrder'
        });
      }
      lastLevel = heading.heading.level;
    }
    
    this.processingComponentStack.delete(component.filePath);
  }

  /**
   * Collects all headings from a component and its children in document order
   */
  private collectHeadingsInDocumentOrder(component: ComponentDefinition): Array<{
    heading: HeadingInfo,
    usageLocation: { filePath: string, line: number, column: number } | null
  }> {
    // Sort headings within this component by line/column
    const localHeadings = [...component.headings].sort((a, b) => {
      if (a.line !== b.line) return a.line - b.line;
      return a.column - b.column;
    }).map(h => ({
      heading: h,
      usageLocation: null
    }));
    
    // Sort child components by their usage location
    const childComponents = component.usesComponents
      .filter(ref => ref.path && this.componentRegistry.has(ref.path))
      .sort((a, b) => {
        const aLoc = a.usageLocations[0] || a.sourceLocation;
        const bLoc = b.usageLocations[0] || b.sourceLocation;
        if (aLoc.line !== bLoc.line) return aLoc.line - bLoc.line;
        return aLoc.column - bLoc.column;
      });
    
    // Merge headings and child component headings in document order
    const allHeadings: Array<{
      heading: HeadingInfo,
      usageLocation: { filePath: string, line: number, column: number } | null
    }> = [];
    
    let headingIndex = 0;
    let childIndex = 0;
    
    // This merges the local headings with child component headings
    // based on their position in the document
    while (headingIndex < localHeadings.length || childIndex < childComponents.length) {
      if (headingIndex >= localHeadings.length) {
        // No more local headings, process remaining children
        const childRef = childComponents[childIndex++];
        if (childRef.path && this.componentRegistry.has(childRef.path) && !this.processingComponentStack.has(childRef.path)) {
          const childComponent = this.componentRegistry.get(childRef.path)!;
          const usageLoc = childRef.usageLocations[0] || childRef.sourceLocation;
          const usageLocation = {
            filePath: component.filePath,
            line: usageLoc.line,
            column: usageLoc.column
          };
          
          this.processingComponentStack.add(childRef.path);
          const childHeadings = this.collectHeadingsInDocumentOrder(childComponent)
            .map(h => ({
              heading: h.heading,
              usageLocation: h.usageLocation || usageLocation
            }));
          this.processingComponentStack.delete(childRef.path);
          
          allHeadings.push(...childHeadings);
        }
      } else if (childIndex >= childComponents.length) {
        // No more children, add remaining local headings
        allHeadings.push(localHeadings[headingIndex++]);
      } else {
        // Compare positions to decide whether to add a local heading or process a child
        const nextHeading = localHeadings[headingIndex];
        const nextChild = childComponents[childIndex];
        const childLoc = nextChild.usageLocations[0] || nextChild.sourceLocation;
        
        if (nextHeading.heading.line < childLoc.line || 
            (nextHeading.heading.line === childLoc.line && nextHeading.heading.column < childLoc.column)) {
          // Local heading comes first
          allHeadings.push(nextHeading);
          headingIndex++;
        } else {
          // Child component comes first
          childIndex++;
          if (nextChild.path && this.componentRegistry.has(nextChild.path) && !this.processingComponentStack.has(nextChild.path)) {
            const childComponent = this.componentRegistry.get(nextChild.path)!;
            const usageLocation = {
              filePath: component.filePath,
              line: childLoc.line,
              column: childLoc.column
            };
            
            this.processingComponentStack.add(nextChild.path);
            const childHeadings = this.collectHeadingsInDocumentOrder(childComponent)
              .map(h => ({
                heading: h.heading,
                usageLocation: h.usageLocation || usageLocation
              }));
            this.processingComponentStack.delete(nextChild.path);
            
            allHeadings.push(...childHeadings);
          }
        }
      }
    }
    
    return allHeadings;
  }

  private findCrossComponentDuplicateIds(results: LintResult[]): void {
    const entryPoints = this.findEntryPoints();
    for (const entry of entryPoints) {
      this.collectIds(entry, new Map(), results, new Set());
    }
  }

  private collectIds(
    component: ComponentDefinition,
    seen: Map<string, IdInfo>,
    results: LintResult[],
    stack: Set<string>
  ): void {
    if (stack.has(component.filePath)) return;
    stack.add(component.filePath);

    for (const id of component.ids) {
      if (seen.has(id.id)) {
        results.push({
          filePath: id.filePath,
          line: id.line,
          column: id.column,
          message: `Duplicate id "${id.id}"`,
          rule: 'uniqueIds',
        });
      } else {
        seen.set(id.id, id);
      }
    }

    for (const ref of component.usesComponents) {
      if (ref.path && this.componentRegistry.has(ref.path)) {
        const target = this.componentRegistry.get(ref.path)!;
        const count = ref.usageLocations.length || 1;
        for (let i = 0; i < count; i++) {
          this.collectIds(target, seen, results, stack);
        }
      }
    }

    stack.delete(component.filePath);
  }

  private findCrossComponentNavLinks(results: LintResult[]): void {
    const entryPoints = this.findEntryPoints();
    for (const entry of entryPoints) {
      this.checkNavs(entry, results, new Set());
    }
  }

  private checkNavs(component: ComponentDefinition, results: LintResult[], stack: Set<string>): void {
    if (stack.has(component.filePath)) return;
    stack.add(component.filePath);

    for (const nav of component.navs) {
      if (!this.navHasLink(nav, new Set())) {
        results.push({
          filePath: nav.filePath,
          line: nav.line,
          column: nav.column,
          message: '<nav> contains no links',
          rule: 'requireNavLinks',
        });
      }
    }

    for (const ref of component.usesComponents) {
      if (ref.path && this.componentRegistry.has(ref.path)) {
        this.checkNavs(this.componentRegistry.get(ref.path)!, results, stack);
      }
    }

    stack.delete(component.filePath);
  }

  private navHasLink(nav: NavInfo, visited: Set<string>): boolean {
    if (nav.hasLocalLink) return true;
    for (const ref of nav.childComponents) {
      if (ref.path && this.componentRegistry.has(ref.path)) {
        if (this.componentHasAnchor(this.componentRegistry.get(ref.path)!, visited)) {
          return true;
        }
      }
    }
    return false;
  }

  private componentHasAnchor(component: ComponentDefinition, visited: Set<string>): boolean {
    if (visited.has(component.filePath)) return false;
    if (component.hasLocalAnchor) return true;
    visited.add(component.filePath);
    for (const ref of component.usesComponents) {
      if (ref.path && this.componentRegistry.has(ref.path)) {
        if (this.componentHasAnchor(this.componentRegistry.get(ref.path)!, visited)) {
          return true;
        }
      }
    }
    return false;
  }

  private findEntryPoints(): ComponentDefinition[] {
    const all = Array.from(this.componentRegistry.values());
    const imported = new Set<string>();
    all.forEach(c => c.usesComponents.forEach(r => r.path && imported.add(r.path!)));
    return all.filter(c => !imported.has(c.filePath));
  }

  private findComponentsWithRule(root: ComponentDefinition, rule: string): ComponentDefinition[] {
    const res: ComponentDefinition[] = [];
    const visited = new Set<string>();
    const dfs = (c: ComponentDefinition) => {
      if (visited.has(c.filePath)) return;
      visited.add(c.filePath);
      if (c.issues.has(rule)) res.push(c);
      c.usesComponents.forEach(r => r.path && this.componentRegistry.has(r.path!) && dfs(this.componentRegistry.get(r.path!)!));
    };
    dfs(root);
    return res;
  }
}