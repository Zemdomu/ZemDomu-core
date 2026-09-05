"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceDiagnostics = void 0;
class PerformanceDiagnostics {
    static getLatestMetrics() {
        return this.latestMetrics;
    }
    static resetMetrics() {
        this.latestMetrics.clear();
    }
    record(filePath, timings) {
        PerformanceDiagnostics.latestMetrics.set(filePath, { ...timings });
    }
    getAsJSON() {
        return JSON.stringify(Object.fromEntries(PerformanceDiagnostics.latestMetrics), null, 2);
    }
    /**
     * Log slowest file and phase to console for debugging.
     */
    logSlowest() {
        var _a, _b;
        let slowFile = '';
        let slowTime = 0;
        let slowPhase = '';
        let slowPhaseTime = 0;
        for (const [file, times] of PerformanceDiagnostics.latestMetrics.entries()) {
            if (((_a = times.total) !== null && _a !== void 0 ? _a : 0) > slowTime) {
                slowTime = (_b = times.total) !== null && _b !== void 0 ? _b : 0;
                slowFile = file;
            }
            for (const [phase, t] of Object.entries(times)) {
                if (phase !== 'total' && t > slowPhaseTime) {
                    slowPhaseTime = t;
                    slowPhase = phase;
                }
            }
        }
        if (slowFile) {
            console.log(`Slowest file: ${slowFile} ${slowTime.toFixed(2)}ms`);
        }
        if (slowPhase) {
            console.log(`Slowest phase: ${slowPhase} ${slowPhaseTime.toFixed(2)}ms`);
        }
    }
}
exports.PerformanceDiagnostics = PerformanceDiagnostics;
PerformanceDiagnostics.latestMetrics = new Map();
