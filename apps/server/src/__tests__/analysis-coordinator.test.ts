import { afterEach, describe, expect, it } from 'vitest';
import {
  getActiveAnalysisJobId,
  releaseAnalysisWorker,
  tryAcquireAnalysisWorker,
} from '../analysis-coordinator.js';

afterEach(() => {
  const active = getActiveAnalysisJobId();
  if (active) releaseAnalysisWorker(active);
});

describe('analysis coordinator', () => {
  it('allows exactly one owner at a time', () => {
    expect(tryAcquireAnalysisWorker('job-a')).toBe(true);
    expect(tryAcquireAnalysisWorker('job-b')).toBe(false);
    expect(getActiveAnalysisJobId()).toBe('job-a');
  });

  it('only lets the current owner release the worker', () => {
    tryAcquireAnalysisWorker('job-a');
    releaseAnalysisWorker('job-b');
    expect(getActiveAnalysisJobId()).toBe('job-a');
    releaseAnalysisWorker('job-a');
    expect(getActiveAnalysisJobId()).toBeNull();
  });
});
