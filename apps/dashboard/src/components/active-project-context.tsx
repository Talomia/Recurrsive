'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { getApiErrorMessage, getProjects, type Project } from '@/lib/api';
import { isProjectScopedPath, isPublicDashboardPath } from '@/lib/project-scope';

interface ActiveProjectContextType {
  projects: Project[];
  activeProject: Project | null;
  loading: boolean;
  switchProject: (id: string) => void;
}

const ActiveProjectContext = createContext<ActiveProjectContextType | undefined>(undefined);

export function ActiveProjectProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const isPublicRoute = isPublicDashboardPath(pathname);

  // Load all projects on mount
  useEffect(() => {
    if (isPublicRoute) {
      setProjectsLoading(false);
      return;
    }
    let active = true;
    setProjectsLoading(true);
    setProjectsError(null);
    getProjects()
      .then((data) => {
        if (!active) return;
        setProjects(data);
        setProjectsLoading(false);
      })
      .catch((caught) => {
        if (active) {
          setProjectsError(getApiErrorMessage(caught, 'Failed to load projects.'));
          setProjectsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [isPublicRoute, loadVersion]);

  const projectId = searchParams.get('projectId');

  const isProjectScopedRoute = useMemo(
    () => isProjectScopedPath(pathname),
    [pathname],
  );

  // A scoped screen is never rendered until its project ID is valid. This
  // prevents a request from briefly using the previous/default project while
  // the router is resolving a project switch.
  useEffect(() => {
    if (projectsLoading || isPublicRoute) return;
    if (projects.length === 0) {
      setActiveProject(null);
      if (isProjectScopedRoute) router.replace('/projects?create=1');
      return;
    }

    if (projectId) {
      const found = projects.find((p) => p.id === projectId || p.slug === projectId);
      if (found) {
        setActiveProject(found);
        return;
      }
    }

    setActiveProject(null);
    if (isProjectScopedRoute) {
      const sorted = [...projects].sort((a, b) => a.name.localeCompare(b.name));
      const firstProject = sorted[0];
      if (firstProject) {
        const current = new URLSearchParams(Array.from(searchParams.entries()));
        current.set('projectId', firstProject.id);
        const search = current.toString();
        const query = search ? `?${search}` : '';
        
        router.replace(`${pathname}${query}`);
      }
    }
  }, [projects, projectId, pathname, projectsLoading, isProjectScopedRoute, isPublicRoute, router, searchParams]);

  const switchProject = useCallback((id: string) => {
    if (!projects.some((project) => project.id === id)) return;
    setActiveProject(null);
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    current.set('projectId', id);
    const search = current.toString();
    const query = search ? `?${search}` : '';
    router.push(`${pathname}${query}`);
  }, [pathname, projects, searchParams, router]);

  const loading = projectsLoading || (isProjectScopedRoute && !activeProject);

  return (
    <ActiveProjectContext.Provider value={{ projects, activeProject, loading, switchProject }}>
      {loading && !isPublicRoute ? (
        <div className="min-h-screen flex flex-1 items-center justify-center" role="status" aria-live="polite">
          <div className="flex items-center gap-3 text-sm text-text-secondary">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent-blue border-t-transparent" aria-hidden="true" />
            Resolving project…
          </div>
        </div>
      ) : projectsError && !isPublicRoute ? (
        <div className="min-h-screen flex flex-1 items-center justify-center p-6" role="alert">
          <div className="w-full max-w-lg rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-6 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-red-400" aria-hidden="true" />
            <h1 className="mt-3 text-lg font-semibold text-text-primary">Unable to load projects</h1>
            <p className="mt-2 text-sm text-text-secondary">{projectsError}</p>
            <button
              type="button"
              onClick={() => setLoadVersion((version) => version + 1)}
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/20"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retry connection
            </button>
          </div>
        </div>
      ) : <React.Fragment key={activeProject?.id ?? 'global'}>{children}</React.Fragment>}
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
