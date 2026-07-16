'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { getProjects, type Project } from '@/lib/api';

interface ActiveProjectContextType {
  projects: Project[];
  activeProject: Project | null;
  loading: boolean;
  switchProject: (id: string) => void;
  /** Re-fetch the project list (call after create/delete). */
  refresh: () => Promise<void>;
}

const ActiveProjectContext = createContext<ActiveProjectContextType | undefined>(undefined);

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

  // Resolve the active project whenever the list or the URL query changes
  useEffect(() => {
    if (projects.length === 0) {
      setActiveProject(null);
      return;
    }

    if (projectId) {
      const found = projects.find((p) => p.id === projectId || p.slug === projectId);
      if (found) {
        setActiveProject(found);
        writeLastProject(found.id);
        return;
      }
    }

    // No (matching) query param. Auto-scope on scoped routes only.
    const nonScopedRoutes = ['/login', '/setup', '/invites', '/invite/'];
    const isNonScoped = nonScopedRoutes.some((route) => pathname.startsWith(route));

    if (!isNonScoped && !loading) {
      // Prefer the user's last-active project (persisted) so navigation and
      // reloads don't silently jump to the alphabetically-first project.
      const remembered = readLastProject();
      const target =
        (remembered && projects.find((p) => p.id === remembered)) ||
        [...projects].sort((a, b) => a.name.localeCompare(b.name))[0];

      if (target) {
        const current = new URLSearchParams(Array.from(searchParams.entries()));
        current.set('projectId', target.id);
        const search = current.toString();
        const query = search ? `?${search}` : '';
        // Use router.replace to avoid clogging browser history
        router.replace(`${pathname}${query}`);
      }
    }
  }, [projects, projectId, pathname, loading, router, searchParams]);

  const switchProject = useCallback((id: string) => {
    writeLastProject(id);
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    current.set('projectId', id);
    const search = current.toString();
    const query = search ? `?${search}` : '';
    router.push(`${pathname}${query}`);
  }, [pathname, searchParams, router]);

  return (
    <ActiveProjectContext.Provider value={{ projects, activeProject, loading, switchProject, refresh }}>
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
