'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { getProjects, type Project } from '@/lib/api';

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
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const isPublicRoute = ['/login', '/setup', '/invite'].some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // Load all projects on mount
  useEffect(() => {
    if (isPublicRoute) {
      setProjectsLoading(false);
      return;
    }
    let active = true;
    getProjects()
      .then((data) => {
        if (!active) return;
        setProjects(data);
        setProjectsLoading(false);
      })
      .catch(() => {
        if (active) setProjectsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isPublicRoute]);

  const projectId = searchParams.get('projectId');

  const isProjectScopedRoute = useMemo(() => {
    if (isPublicRoute) return false;
    const globalPrefixes = [
      '/projects', '/batch', '/users', '/invites', '/settings',
      '/sso', '/audit', '/webhooks', '/notifications', '/secrets', '/data-masking',
      '/cloud',
    ];
    return !globalPrefixes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  }, [isPublicRoute, pathname]);

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
