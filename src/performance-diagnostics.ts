export interface PerformanceRecorder {
  record(filePath: string, timings: Record<string, number>): void;
}

export class PerformanceDiagnostics implements PerformanceRecorder {
  private static latestMetrics = new Map<string, Record<string, number>>();

  static getLatestMetrics(): Map<string, Record<string, number>> {
    return this.latestMetrics;
  }

  static resetMetrics(): void {
    this.latestMetrics.clear();
  }

  record(filePath: string, timings: Record<string, number>): void {
    PerformanceDiagnostics.latestMetrics.set(filePath, { ...timings });
  }

  getAsJSON(): string {
    return JSON.stringify(Object.fromEntries(PerformanceDiagnostics.latestMetrics), null, 2);
  }

  /**
   * Log slowest file and phase to console for debugging.
   */
  logSlowest(): void {
    let slowFile = '';
    let slowTime = 0;
    let slowPhase = '';
    let slowPhaseTime = 0;
    for (const [file, times] of PerformanceDiagnostics.latestMetrics.entries()) {
      if ((times.total ?? 0) > slowTime) {
        slowTime = times.total ?? 0;
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
