import type { SemanticGraph } from "./semantic-graph";
import type { SemanticPageModel } from "./page-model";
/** Render a deterministic, human-readable view of the public semantic graph. */
export declare function formatSemanticGraphInspection(graph: SemanticGraph): string;
/** Render one configured page from the public page/document model. */
export declare function formatSemanticPageInspection(model: SemanticPageModel, graph: SemanticGraph, route: string): string;
