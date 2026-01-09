"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Page;
const jsx_runtime_1 = require("react/jsx-runtime");
const Section_1 = __importDefault(require("@alias/Section"));
function Page() {
    return ((0, jsx_runtime_1.jsxs)("main", { children: [(0, jsx_runtime_1.jsx)("h1", { children: "Hello" }), (0, jsx_runtime_1.jsx)(Section_1.default, {})] }));
}
