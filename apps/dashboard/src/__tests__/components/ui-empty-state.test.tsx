/**
 * Tests for the shared EmptyState component.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FolderGit2 } from 'lucide-react';
import EmptyState from '../../components/ui/empty-state';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState icon={FolderGit2} title="No projects yet" description="Create one." />);
    expect(screen.getByText('No projects yet')).toBeInTheDocument();
    expect(screen.getByText('Create one.')).toBeInTheDocument();
  });

  it('renders a link action when href is provided', () => {
    render(
      <EmptyState icon={FolderGit2} title="Empty" action={{ label: 'Go to Projects', href: '/projects' }} />,
    );
    const link = screen.getByText('Go to Projects').closest('a');
    expect(link).toHaveAttribute('href', '/projects');
  });

  it('fires onClick action for button actions', () => {
    const onClick = vi.fn();
    render(<EmptyState icon={FolderGit2} title="Empty" action={{ label: 'Create', onClick }} />);
    fireEvent.click(screen.getByText('Create'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders without an action', () => {
    render(<EmptyState icon={FolderGit2} title="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});
