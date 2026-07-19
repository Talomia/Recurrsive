import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '../../components/sidebar';

// ── Mock useActiveProject (two-tier scope model) ──────────────────────────────
//
// The sidebar renders WORKSPACE sections when scope === 'workspace' and
// PROJECT sections when scope === 'project'. Tests flip the mock per case.

const PROJECTS = [
  { id: 'proj-1', name: 'Service A', slug: 'service-a', language: 'TypeScript' },
  { id: 'proj-2', name: 'Service B', slug: 'service-b', language: 'Python' },
];

const workspaceContext = {
  projects: PROJECTS,
  activeProject: null,
  scope: 'workspace' as const,
  loading: false,
  switchProject: vi.fn(),
  enterWorkspace: vi.fn(),
  refresh: vi.fn(),
};

const projectContext = {
  ...workspaceContext,
  activeProject: PROJECTS[0],
  scope: 'project' as const,
};

let activeProjectContext: typeof workspaceContext | typeof projectContext = workspaceContext;

vi.mock('../../components/active-project-context', () => ({
  useActiveProject: () => activeProjectContext,
}));

// Mock useAssistant (AI availability context)
vi.mock('../../components/assistant-context', () => ({
  useAssistant: () => ({
    availability: 'unknown',
    reason: null,
    reportStatus: vi.fn(),
  }),
  AssistantProvider: ({ children }: { children: unknown }) => children,
}));

describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.clear();
    activeProjectContext = workspaceContext;
  });

  it('renders the Recurrsive brand', () => {
    render(<Sidebar />);
    expect(screen.getByText('Recurrsive')).toBeInTheDocument();
  });

  describe('workspace scope', () => {
    it('renders the workspace section headers', () => {
      render(<Sidebar />);
      expect(screen.getByText('Portfolio')).toBeInTheDocument();
      expect(screen.getByText('Team & Governance')).toBeInTheDocument();
      expect(screen.getByText('Platform')).toBeInTheDocument();
    });

    it('does not render project-scope section headers', () => {
      render(<Sidebar />);
      expect(screen.queryByText('Insights')).not.toBeInTheDocument();
      expect(screen.queryByText('Delivery')).not.toBeInTheDocument();
    });

    it('shows portfolio links by default (Portfolio section expanded)', () => {
      render(<Sidebar />);
      expect(screen.getByRole('link', { name: /Overview/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Projects/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Comparisons/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Batch Analysis/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Intelligence Packs/i })).toBeInTheDocument();
      // Only the Portfolio section's 5 links are visible by default.
      expect(screen.getAllByRole('link').length).toBe(5);
    });

    it('reveals governance and platform links when expanded', () => {
      render(<Sidebar />);

      fireEvent.click(screen.getByRole('button', { name: /Team & Governance/i }));
      expect(screen.getByRole('link', { name: /Users/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Policies/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Audit Trail/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /SSO/i })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Platform/i }));
      expect(screen.getByRole('link', { name: /Settings/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Secrets/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Webhooks/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Marketplace/i })).toBeInTheDocument();

      // Portfolio (5) + Governance (6) + Platform (9) links all visible.
      expect(screen.getAllByRole('link').length).toBe(20);
    });
  });

  describe('project scope', () => {
    beforeEach(() => {
      activeProjectContext = projectContext;
    });

    it('renders the project section headers', () => {
      render(<Sidebar />);
      // "Project" also appears as the scope-selector label, so target the
      // collapsible section toggle buttons specifically.
      expect(screen.getByRole('button', { name: /^Project$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Insights$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Delivery$/i })).toBeInTheDocument();
    });

    it('shows project and insights links by default', () => {
      render(<Sidebar />);
      // Project section
      expect(screen.getByRole('link', { name: /Overview/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Findings/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Opportunities/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /System Map/i })).toBeInTheDocument();
      // Insights section
      expect(screen.getByRole('link', { name: /Health/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Timeline/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Forecasting/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Confidence/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Analytics/i })).toBeInTheDocument();
      // Project (4) + Insights (5) links visible by default.
      expect(screen.getAllByRole('link').length).toBe(9);
    });

    it('reveals delivery links when expanded', () => {
      render(<Sidebar />);
      fireEvent.click(screen.getByRole('button', { name: /Delivery/i }));
      expect(screen.getByRole('link', { name: /Reports/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Snapshots/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Scheduling/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Simulation/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Experiments/i })).toBeInTheDocument();
      // Project (4) + Insights (5) + Delivery (5) links all visible.
      expect(screen.getAllByRole('link').length).toBe(14);
    });

    it('keeps project links scoped with the active projectId', () => {
      render(<Sidebar />);
      const findingsLink = screen.getByRole('link', { name: /Findings/i });
      expect(findingsLink).toHaveAttribute('href', '/findings?projectId=proj-1');
      // The Overview item resolves to the project home.
      const overviewLink = screen.getByRole('link', { name: /Overview/i });
      expect(overviewLink).toHaveAttribute('href', '/projects/proj-1');
    });
  });
});
