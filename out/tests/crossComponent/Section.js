"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Section;
const jsx_runtime_1 = require("react/jsx-runtime");
const SubSection_1 = __importDefault(require("@alias/SubSection"));
function Section() {
    return ((0, jsx_runtime_1.jsxs)("section", { children: [(0, jsx_runtime_1.jsx)("h2", { children: "Section Title" }), (0, jsx_runtime_1.jsx)(SubSection_1.default, {})] }));
}
