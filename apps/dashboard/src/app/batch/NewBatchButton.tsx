"use client";

import { useEffect, useState } from "react";
import { Play, Plus, X } from "lucide-react";
import { createBatchRun } from "@/lib/api";
import { getProjects, type Project } from "@/lib/api";

/**
 * Client component wrapping the "New Batch" button + form for the server-rendered batch page.
 */
export default function NewBatchButton() {
  const [showForm, setShowForm] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (showForm) getProjects().then(setProjects);
  }, [showForm]);

  const handleSubmit = async () => {
    if (selectedIds.length === 0) {
      setError("Select at least one registered project.");
      return;
    }
    if (selectedIds.length > 10) {
      setError("Maximum 10 projects per batch.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await createBatchRun({ projectIds: selectedIds });
      setSuccess(`Batch ${result.batch_id} created (${result.status})`);
      setSelectedIds([]);
      // Reload the page to refetch server data
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create batch run");
    } finally {
      setSubmitting(false);
    }
  };

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="flex items-center gap-2 rounded-xl bg-blue-500/15 border border-blue-500/25 px-4 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/25 transition-colors shrink-0 mt-4"
      >
        <Play className="h-4 w-4" />
        New Batch
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-2xl border border-white/10 bg-[var(--color-surface,#0d0d14)] p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Plus className="h-5 w-5 text-blue-400" />
            New Batch Run
          </h2>
          <button
            onClick={() => { setShowForm(false); setError(null); setSuccess(null); }}
            className="p-1 rounded-lg hover:bg-white/10 text-text-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <p className="block text-xs text-text-muted font-medium mb-2">Registered projects (max 10)</p>
          <div className="max-h-56 overflow-y-auto space-y-2">
            {projects.length === 0 ? (
              <p className="text-xs text-text-muted">Create a project before starting a batch.</p>
            ) : projects.map((project) => (
              <label key={project.id} className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(project.id)}
                  onChange={(event) => setSelectedIds((current) => event.target.checked
                    ? [...current, project.id].slice(0, 10)
                    : current.filter((id) => id !== project.id))}
                  className="mt-1"
                />
                <span className="min-w-0"><span className="block text-sm text-text-primary">{project.name}</span><span className="block truncate text-[10px] text-text-muted">{project.repository}</span></span>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {success && (
          <p className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
            {success}
          </p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={() => { setShowForm(false); setError(null); setSuccess(null); }}
            className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm text-text-secondary hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || selectedIds.length === 0}
            className="flex-1 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-blue-600 transition-colors"
          >
            {submitting ? "Submitting…" : "Start Batch"}
          </button>
        </div>
      </div>
    </div>
  );
}
