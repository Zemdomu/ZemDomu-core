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
  private options: LinterOptions & { crossComponentAnalysis?: boolean; crossComponentDepth?: number };
  private processingComponentStack = new Set<string>(); // To prevent circular references
  private perf?: PerformanceRecorder;
  private resolver = new ComponentPathResolver();
  private maxDepth: number | undefined;

  constructor(options: LinterOptions & { crossComponentAnalysis?: boolean; crossComponentDepth?: number }, perf?: PerformanceRecorder) {
    this.options = options;
    this.perf = perf;
    this.maxDepth = typeof options.crossComponentDepth === 'number' ? options.crossComponentDepth : undefined;
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
        if (
          lastHeadingLevel &&
          shouldWarnForHeadingOrder(heading.level, lastHeadingLevel)
        ) {
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
    const emitted = new Set<string>();

    const getDisplayName = (component: ComponentDefinition): string => {
      if (component.name) return component.name;
      return path.basename(component.filePath, path.extname(component.filePath));
    };

    const addResult = (result: LintResult) => {
      const key = `${result.rule}|${result.filePath}|${result.line}|${result.column}|${result.message}`;
      if (emitted.has(key)) return;
      emitted.add(key);
      results.push(result);
    };

    for (const entry of entryPoints) {
      const comps = this.findComponentsWithRule(entry, 'singleH1', 0);
      if (comps.length <= 1) continue;

      const conflictMap = new Map<string, string[]>();
      for (const comp of comps) {
        const conflicts = comps
          .filter(other => other.filePath !== comp.filePath)
          .map(getDisplayName);
        if (conflicts.length) conflictMap.set(comp.filePath, conflicts);
      }

      const usageMap = new Map<
        string,
        Array<{
          parent: ComponentDefinition;
          location: { filePath: string; line: number; column: number };
        }>
      >();

      const usageStack = new Set<string>();
      const collectUsage = (component: ComponentDefinition, depth = 0) => {
        if (this.maxDepth !== undefined && depth > this.maxDepth) return;
        if (usageStack.has(component.filePath)) return;
        usageStack.add(component.filePath);

        for (const ref of component.usesComponents) {
          if (!ref.path || !this.componentRegistry.has(ref.path)) continue;
          const child = this.componentRegistry.get(ref.path)!;
          if (!usageMap.has(child.filePath)) usageMap.set(child.filePath, []);
          const locations =
            ref.usageLocations.length > 0 ? ref.usageLocations : [ref.sourceLocation];
          for (const loc of locations) {
            usageMap.get(child.filePath)!.push({
              parent: component,
              location: { filePath: component.filePath, line: loc.line, column: loc.column },
            });
          }
          collectUsage(child, depth + 1);
        }

        usageStack.delete(component.filePath);
      };

      collectUsage(entry, 0);

      for (const comp of comps) {
        const conflicts = conflictMap.get(comp.filePath);
        if (!conflicts || !conflicts.length) continue;
        const compName = getDisplayName(comp);
        const issues = comp.issues.get('singleH1') ?? [];
        if (!issues.length) continue;

        const conflictText = conflicts.map(name => `'${name}'`).join(', ');
        const usageEntries = usageMap.get(comp.filePath) ?? [];
        const usageRelated = usageEntries.map(u => ({
          filePath: u.location.filePath,
          line: u.location.line,
          column: u.location.column,
          message: `Rendered via '${getDisplayName(u.parent)}'`,
        }));

        for (const issue of issues) {
          addResult({
            filePath: comp.filePath,
            line: issue.line,
            column: issue.column,
            message: `Multiple <h1> tags across components. This <h1> in '${compName}' conflicts with ${conflictText}.`,
            rule: 'singleH1',
            related: usageRelated,
          });
        }

        const childIssueLocations = issues.map(issue => ({
          filePath: comp.filePath,
          line: issue.line,
          column: issue.column,
          message: `Defined in '${compName}'`,
        }));

        for (const usage of usageEntries) {
          const parentName = getDisplayName(usage.parent);
          addResult({
            filePath: usage.location.filePath,
            line: usage.location.line,
            column: usage.location.column,
            message: `Component '${compName}' renders an extra <h1> that conflicts with ${conflictText}.`,
            rule: 'singleH1',
            related: childIssueLocations.length ? childIssueLocations : undefined,
          });
        }
      }
    }
  }

  /**
   * Improved implementation to find heading order issues across components
   */
  private findCrossComponentHeadingOrderIssues(results: LintResult[]): void {
    const entryPoints = this.findEntryPoints();
    
    for (const entry of entryPoints) {
      // Process each entry point as a document root
      this.processingComponentStack.clear();
      this.analyzeHeadingHierarchy(entry, results, 0);
    }
  }

  /**
   * Collects all headings from a component and its children in document order
   * and checks for heading level issues
   */
  private analyzeHeadingHierarchy(component: ComponentDefinition, results: LintResult[], depth = 0): void {
    if (this.maxDepth !== undefined && depth > this.maxDepth) return;
    if (this.processingComponentStack.has(component.filePath)) {
      // Avoid circular references
      return;
    }
    
    this.processingComponentStack.add(component.filePath);

    // Build a flattened view of all headings in document order
    const allHeadings = this.collectHeadingsInDocumentOrder(component, depth);
    
    // Check for heading level issues
    let lastLevel = 0;
    
    for (const heading of allHeadings) {
      if (
        lastLevel > 0 &&
        shouldWarnForHeadingOrder(heading.heading.level, lastLevel)
      ) {
        const locationFile = heading.heading.filePath;
        const locationLine = heading.heading.line;
        const locationColumn = heading.heading.column;
        const usageComponent = heading.usageLocation?.filePath
          ? this.componentRegistry.get(heading.usageLocation.filePath)
          : null;
        const usageName = usageComponent
          ? path.basename(usageComponent.filePath, path.extname(usageComponent.filePath))
          : heading.usageLocation?.filePath
            ? path.basename(heading.usageLocation.filePath, path.extname(heading.usageLocation.filePath))
            : null;
        const messageSuffix = usageName ? ` (rendered via '${usageName}')` : '';

        results.push({
          filePath: locationFile,
          line: locationLine,
          column: locationColumn,
          message: `Cross-component heading level skipped: <h${heading.heading.level}> after <h${lastLevel}>${messageSuffix}`,
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
  private collectHeadingsInDocumentOrder(component: ComponentDefinition, depth = 0): Array<{
    heading: HeadingInfo,
    usageLocation: { filePath: string, line: number, column: number } | null
  }> {
    if (this.maxDepth !== undefined && depth > this.maxDepth) {
      return [];
    }

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
        if (childRef.path && this.componentRegistry.has(childRef.path) && !this.processingComponentStack.has(childRef.path) && (this.maxDepth === undefined || depth < this.maxDepth)) {
          const childComponent = this.componentRegistry.get(childRef.path)!;
          const usageLoc = childRef.usageLocations[0] || childRef.sourceLocation;
          const usageLocation = {
            filePath: component.filePath,
            line: usageLoc.line,
            column: usageLoc.column
          };
          
          this.processingComponentStack.add(childRef.path);
          const childHeadings = this.collectHeadingsInDocumentOrder(childComponent, depth + 1)
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
          if (nextChild.path && this.componentRegistry.has(nextChild.path) && !this.processingComponentStack.has(nextChild.path) && (this.maxDepth === undefined || depth < this.maxDepth)) {
            const childComponent = this.componentRegistry.get(nextChild.path)!;
            const usageLocation = {
              filePath: component.filePath,
              line: childLoc.line,
              column: childLoc.column
            };
            
            this.processingComponentStack.add(nextChild.path);
            const childHeadings = this.collectHeadingsInDocumentOrder(childComponent, depth + 1)
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
      this.collectIds(entry, new Map(), results, new Set(), 0);
    }
  }

  private collectIds(
    component: ComponentDefinition,
    seen: Map<string, IdInfo>,
    results: LintResult[],
    stack: Set<string>,
    depth = 0
  ): void {
    if (this.maxDepth !== undefined && depth > this.maxDepth) return;
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
          this.collectIds(target, seen, results, stack, depth + 1);
        }
      }
    }

    stack.delete(component.filePath);
  }

  private findCrossComponentNavLinks(results: LintResult[]): void {
    const entryPoints = this.findEntryPoints();
    for (const entry of entryPoints) {
      this.checkNavs(entry, results, new Set(), 0);
    }
  }

  private checkNavs(component: ComponentDefinition, results: LintResult[], stack: Set<string>, depth = 0): void {
    if (this.maxDepth !== undefined && depth > this.maxDepth) return;
    if (stack.has(component.filePath)) return;
    stack.add(component.filePath);

    for (const nav of component.navs) {
      if (!this.navHasLink(nav, new Set(), depth)) {
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
        this.checkNavs(this.componentRegistry.get(ref.path)!, results, stack, depth + 1);
      }
    }

    stack.delete(component.filePath);
  }

  private navHasLink(nav: NavInfo, visited: Set<string>, depth = 0): boolean {
    if (this.maxDepth !== undefined && depth > this.maxDepth) return false;
    if (nav.hasLocalLink) return true;
    for (const ref of nav.childComponents) {
      if (ref.path && this.componentRegistry.has(ref.path)) {
        if (this.componentHasAnchor(this.componentRegistry.get(ref.path)!, visited, depth + 1)) {
          return true;
        }
      }
    }
    return false;
  }

  private componentHasAnchor(component: ComponentDefinition, visited: Set<string>, depth = 0): boolean {
    if (this.maxDepth !== undefined && depth > this.maxDepth) return false;
    if (visited.has(component.filePath)) return false;
    if (component.hasLocalAnchor) return true;
    visited.add(component.filePath);
    for (const ref of component.usesComponents) {
      if (ref.path && this.componentRegistry.has(ref.path)) {
        if (this.componentHasAnchor(this.componentRegistry.get(ref.path)!, visited, depth + 1)) {
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

  private findComponentsWithRule(root: ComponentDefinition, rule: string, depth = 0): ComponentDefinition[] {
    const res: ComponentDefinition[] = [];
    const visited = new Set<string>();
    const dfs = (c: ComponentDefinition, d: number) => {
      if (visited.has(c.filePath)) return;
      visited.add(c.filePath);
      if (c.issues.has(rule)) res.push(c);
      if (this.maxDepth !== undefined && d >= this.maxDepth) return;
      c.usesComponents.forEach(r => r.path && this.componentRegistry.has(r.path!) && dfs(this.componentRegistry.get(r.path!)!, d + 1));
    };
    dfs(root, depth);
    return res;
  }
}

function shouldWarnForHeadingOrder(newLevel: number, lastLevel: number): boolean {
  if (!lastLevel) return false;
  if (newLevel === 1 && lastLevel !== 1) return true;
  if (newLevel > lastLevel + 1) return true;
  if (lastLevel > newLevel + 1) return true;
  return false;
}
