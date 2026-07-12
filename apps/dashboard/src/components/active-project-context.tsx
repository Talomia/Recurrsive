'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  const [loading, setLoading] = useState(true);
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  // Load all projects on mount
  useEffect(() => {
    let active = true;
    getProjects()
      .then((data) => {
        if (!active) return;
        setProjects(data);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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
        return;
      }
    }

    // Auto-scoping redirect logic: if there is no query param, or the query param doesn't match any project,
    // and we are not on a non-scoped route (like /login or /setup), auto-select the first project.
    const nonScopedRoutes = ['/login', '/setup', '/invites', '/invite/'];
    const isNonScoped = nonScopedRoutes.some((route) => pathname.startsWith(route));

    if (!isNonScoped && !loading) {
      // Sort alphabetically to guarantee consistent first selector
      const sorted = [...projects].sort((a, b) => a.name.localeCompare(b.name));
      const firstProject = sorted[0];
      if (firstProject) {
        const current = new URLSearchParams(Array.from(searchParams.entries()));
        current.set('projectId', firstProject.id);
        const search = current.toString();
        const query = search ? `?${search}` : '';
        
        // Use router.replace to avoid clogging browser history
        router.replace(`${pathname}${query}`);
      }
    }
  }, [projects, projectId, pathname, loading, router, searchParams]);

  const switchProject = useCallback((id: string) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    current.set('projectId', id);
    const search = current.toString();
    const query = search ? `?${search}` : '';
    router.push(`${pathname}${query}`);
  }, [pathname, searchParams, router]);

  return (
    <ActiveProjectContext.Provider value={{ projects, activeProject, loading, switchProject }}>
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
