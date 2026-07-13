/** Process-local coordinator for the singleton graph analysis worker. */

let activeJobId: string | null = null;

export function tryAcquireAnalysisWorker(jobId: string): boolean {
  if (activeJobId) return false;
  activeJobId = jobId;
  return true;
}

export function releaseAnalysisWorker(jobId: string): void {
  if (activeJobId === jobId) activeJobId = null;
}

export function getActiveAnalysisJobId(): string | null {
  return activeJobId;
}
