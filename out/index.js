"use strict";
// Exposes the core lint function and types
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectLinter = exports.ComponentPathResolver = exports.ComponentAnalyzer = exports.lint = void 0;
var linter_1 = require("./linter");
Object.defineProperty(exports, "lint", { enumerable: true, get: function () { return linter_1.lint; } });
var component_analyzer_1 = require("./component-analyzer");
Object.defineProperty(exports, "ComponentAnalyzer", { enumerable: true, get: function () { return component_analyzer_1.ComponentAnalyzer; } });
var component_path_resolver_1 = require("./component-path-resolver");
Object.defineProperty(exports, "ComponentPathResolver", { enumerable: true, get: function () { return component_path_resolver_1.ComponentPathResolver; } });
var project_linter_1 = require("./project-linter");
Object.defineProperty(exports, "ProjectLinter", { enumerable: true, get: function () { return project_linter_1.ProjectLinter; } });
