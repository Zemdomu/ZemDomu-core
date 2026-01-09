export interface PerformanceRecorder {
    record(filePath: string, timings: Record<string, number>): void;
}
export declare class PerformanceDiagnostics implements PerformanceRecorder {
    private static latestMetrics;
    static getLatestMetrics(): Map<string, Record<string, number>>;
    static resetMetrics(): void;
    record(filePath: string, timings: Record<string, number>): void;
    getAsJSON(): string;
    /**
     * Log slowest file and phase to console for debugging.
     */
    logSlowest(): void;
}
