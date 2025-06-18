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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectLinter = void 0;
const fs = __importStar(require("fs/promises"));
const linter_1 = require("./linter");
const component_analyzer_1 = require("./component-analyzer");
class ProjectLinter {
    constructor(options = {}) {
        this.opts = options;
        this.analyzer = new component_analyzer_1.ComponentAnalyzer(this.opts);
    }
    clear() {
        this.analyzer = new component_analyzer_1.ComponentAnalyzer(this.opts);
    }
    async lintFile(filePath, content) {
        if (!content) {
            content = await fs.readFile(filePath, 'utf8');
        }
        const results = (0, linter_1.lint)(content, this.opts);
        const byFile = new Map();
        byFile.set(filePath, [...results]);
        const xmlMode = /\.(jsx|tsx)$/.test(filePath);
        if (xmlMode) {
            const component = await this.analyzer.analyzeFile(filePath);
            if (component) {
                this.analyzer.registerComponent(component, results);
            }
            if (this.opts.crossComponentAnalysis) {
                const cross = this.analyzer.analyzeComponentTree();
                for (const r of cross) {
                    if (!r.filePath)
                        continue;
                    if (!byFile.has(r.filePath))
                        byFile.set(r.filePath, []);
                    byFile.get(r.filePath).push(r);
                }
            }
        }
        return byFile;
    }
    async lintFiles(filePaths) {
        const aggregated = new Map();
        for (const filePath of filePaths) {
            const fileMap = await this.lintFile(filePath);
            for (const [fp, res] of fileMap.entries()) {
                if (!aggregated.has(fp))
                    aggregated.set(fp, []);
                aggregated.get(fp).push(...res);
            }
        }
        return aggregated;
    }
}
exports.ProjectLinter = ProjectLinter;
