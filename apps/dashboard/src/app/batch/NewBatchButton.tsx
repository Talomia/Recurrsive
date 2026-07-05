"use client";

import { useState } from "react";
import { Play, Plus, X } from "lucide-react";
import { createBatchRun } from "@/lib/api";

/**
 * Client component wrapping the "New Batch" button + form for the server-rendered batch page.
 */
export default function NewBatchButton() {
  const [showForm, setShowForm] = useState(false);
  const [projectPaths, setProjectPaths] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async () => {
    const paths = projectPaths
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean);

    if (paths.length === 0) {
      setError("Enter at least one project path.");
      return;
    }
    if (paths.length > 10) {
      setError("Maximum 10 projects per batch.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await createBatchRun({ projects: paths });
      setSuccess(`Batch ${result.batch_id} created (${result.status})`);
      setProjectPaths("");
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
          <label className="block text-xs text-text-muted font-medium mb-1">
            Project Paths (one per line, max 10)
          </label>
          <textarea
            value={projectPaths}
            onChange={(e) => setProjectPaths(e.target.value)}
            placeholder={"/path/to/project-a\n/path/to/project-b"}
            rows={5}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
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
            disabled={submitting || !projectPaths.trim()}
            className="flex-1 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-blue-600 transition-colors"
          >
            {submitting ? "Submitting…" : "Start Batch"}
          </button>
        </div>
      </div>
    </div>
  );
}
