import { describe, expect, it } from 'vitest';
import {
  isProjectScopedPath,
  isPublicDashboardPath,
  withProjectScope,
} from '../../lib/project-scope';

describe('dashboard project scoping', () => {
  it('distinguishes project workspaces from global administration routes', () => {
    expect(isProjectScopedPath('/')).toBe(true);
    expect(isProjectScopedPath('/findings')).toBe(true);
    expect(isProjectScopedPath('/projects/project-1')).toBe(true);
    expect(isProjectScopedPath('/projects')).toBe(false);
    expect(isProjectScopedPath('/batch')).toBe(false);
    expect(isProjectScopedPath('/users')).toBe(false);
    expect(isProjectScopedPath('/notifications/notification-1')).toBe(false);
  });

  it('recognizes all public authentication routes', () => {
    expect(isPublicDashboardPath('/login')).toBe(true);
    expect(isPublicDashboardPath('/invite/token')).toBe(true);
    expect(isPublicDashboardPath('/setup')).toBe(true);
    expect(isPublicDashboardPath('/projects')).toBe(false);
  });

  it('adds scope only to project pages and preserves other query values', () => {
    expect(withProjectScope('/findings?severity=high', 'project-1'))
      .toBe('/findings?severity=high&projectId=project-1');
    expect(withProjectScope('/projects/project-1', 'project-1'))
      .toBe('/projects/project-1?projectId=project-1');
    expect(withProjectScope('/users?projectId=stale', 'project-1')).toBe('/users');
    expect(withProjectScope('/projects?sort=name', 'project-1')).toBe('/projects?sort=name');
  });
});
