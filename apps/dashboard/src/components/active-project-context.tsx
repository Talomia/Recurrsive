'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { getProjects, type Project } from '@/lib/api';

/** The two navigation tiers. `workspace` = cross-project / account level; `project` = scoped to one repo. */
export type Scope = 'workspace' | 'project';

interface ActiveProjectContextType {
  projects: Project[];
  /** The entered project, or `null` when at workspace (cross-project) scope. */
  activeProject: Project | null;
  /** Derived tier: 'project' when a project is entered, else 'workspace'. */
  scope: Scope;
  loading: boolean;
  /** Enter project scope (navigates within the current page, carrying projectId). */
  switchProject: (id: string) => void;
  /** Leave project scope and return to the workspace (portfolio) home. */
  enterWorkspace: () => void;
  /** Re-fetch the project list (call after create/delete). */
  refresh: () => Promise<void>;
}

const ActiveProjectContext = createContext<ActiveProjectContextType | undefined>(undefined);

// ─── Route → scope classification ────────────────────────────────────────────
//
// Project-scoped routes operate on ONE repo and auto-resolve a project when the
// URL omits ?projectId. Everything else is workspace-scoped (cross-project or
// account-level) and must render at workspace scope (activeProject === null)
// without being forced into a single project's context.
const PROJECT_ROUTE_PREFIXES = [
  '/findings', '/opportunities', '/system-map', '/health', '/timeline',
  '/forecasting', '/confidence', '/analytics', '/reports', '/snapshots',
  '/scheduling', '/simulation', '/experiments',
];

/** True for routes that operate within a single project's scope. */
function isProjectRoute(pathname: string): boolean {
  // /projects is the workspace-level list; /projects/<id> is a project home.
  if (pathname === '/projects') return false;
  if (/^\/projects\/.+/.test(pathname)) return true;
  return PROJECT_ROUTE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
}

/** localStorage key remembering the last project the user scoped to. */
const LAST_PROJECT_KEY = 'recurrsive-active-project';

function readLastProject(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(LAST_PROJECT_KEY);
  } catch {
    return null;
  }
}

function writeLastProject(id: string) {
  try {
    localStorage.setItem(LAST_PROJECT_KEY, id);
  } catch {
    // storage unavailable — non-fatal
  }
}

export function ActiveProjectProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  // Load (or reload) the project list. Exposed as `refresh` so pages can call
  // it after creating/deleting a project without a full navigation.
  const refresh = useCallback(async () => {
    try {
      const data = await getProjects();
      setProjects(data);
    } catch {
      // Leave the previous list in place on a transient failure.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const projectId = searchParams.get('projectId');

  // Resolve the active project whenever the list or the URL query changes.
  //
  // Two-tier model: an explicit ?projectId (on any route) enters that project's
  // scope. Otherwise, WORKSPACE routes stay at workspace scope (activeProject =
  // null) — they are cross-project/account-level and must not be forced into a
  // single project. Only PROJECT routes auto-resolve a project (so a project
  // page reached without ?projectId still has a repo to show).
  useEffect(() => {
    if (projectId && projects.length > 0) {
      const found = projects.find((p) => p.id === projectId || p.slug === projectId);
      if (found) {
        setActiveProject(found);
        writeLastProject(found.id);
        return;
      }
    }

    // No (matching) ?projectId → workspace scope unless this is a project route.
    if (!isProjectRoute(pathname)) {
      setActiveProject(null);
      return;
    }

    if (projects.length === 0) {
      setActiveProject(null);
      return;
    }

    if (!loading) {
      // Project route without a project: auto-resolve the last-active (or
      // alphabetically-first) project so the page has real data to render.
      const remembered = readLastProject();
      const target =
        (remembered && projects.find((p) => p.id === remembered)) ||
        [...projects].sort((a, b) => a.name.localeCompare(b.name))[0];

      if (target) {
        const current = new URLSearchParams(Array.from(searchParams.entries()));
        current.set('projectId', target.id);
        const search = current.toString();
        const query = search ? `?${search}` : '';
        router.replace(`${pathname}${query}`);
      }
    }
  }, [projects, projectId, pathname, loading, router, searchParams]);

  const switchProject = useCallback((id: string) => {
    writeLastProject(id);
    // Entering a project from a workspace route would show workspace content
    // scoped to a project (confusing); land on the project home instead. From a
    // project route, stay on the same view but re-scoped to the new project.
    const onProjectRoute = isProjectRoute(pathname);
    if (onProjectRoute) {
      const current = new URLSearchParams(Array.from(searchParams.entries()));
      current.set('projectId', id);
      const search = current.toString();
      router.push(`${pathname}${search ? `?${search}` : ''}`);
    } else {
      router.push(`/projects/${encodeURIComponent(id)}`);
    }
    // A query-only navigation does not re-run server-component data fetches by
    // default, so force it — otherwise switching leaves server-rendered pages
    // showing the previous project. Client pages are remounted by the
    // projectId-keyed wrapper in the layout.
    router.refresh();
  }, [pathname, searchParams, router]);

  const enterWorkspace = useCallback(() => {
    setActiveProject(null);
    router.push('/');
    router.refresh();
  }, [router]);

  const scope: Scope = activeProject ? 'project' : 'workspace';

  return (
    <ActiveProjectContext.Provider
      value={{ projects, activeProject, scope, loading, switchProject, enterWorkspace, refresh }}
    >
      {children}
    </ActiveProjectContext.Provider>
  );
}

export function useActiveProject() {
  const context = useContext(ActiveProjectContext);
  if (context === undefined) {
    throw new Error('useActiveProject must be used within an ActiveProjectProvider');
  }
  return context;
}
