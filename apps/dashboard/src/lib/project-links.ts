/**
 * @module project-links
 *
 * Helper for building project-scoped hrefs. The dashboard scopes data by an
 * (optional) `?projectId=` query param — the sidebar, command palette, and
 * `apiFetch` all follow this convention. Use `scopedHref` for any in-app link
 * between journey pages so navigating never silently drops the active project.
 */

/**
 * Append `?projectId=` to an internal href when a project is active.
 * Returns the href unchanged when there is no active project.
 */
export function scopedHref(href: string, projectId?: string | null): string {
  if (!projectId) return href;
  const separator = href.includes('?') ? '&' : '?';
  return `${href}${separator}projectId=${encodeURIComponent(projectId)}`;
}
