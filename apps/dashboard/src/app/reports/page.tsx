import Header from "@/components/header";
import { FileText, Download, Calendar, BarChart3, FileJson, Code2, Shield, Clock } from "lucide-react";
import { getReportUrl, getReportsAnalysisHistory } from "@/lib/api";
import type { ReportsAnalysisHistoryEntry } from "@/lib/api";

// ---------------------------------------------------------------------------
// Report format definitions
// ---------------------------------------------------------------------------

const REPORT_FORMATS = [
  {
    id: "markdown",
    title: "Markdown Report",
    description: "Full analysis report in Markdown format — findings, opportunities, and recommendations.",
    icon: FileText,
    format: "markdown",
    ext: ".md",
  },
  {
    id: "html",
    title: "HTML Report",
    description: "Styled HTML report with charts and visualizations, suitable for sharing with stakeholders.",
    icon: Code2,
    format: "html",
    ext: ".html",
  },
  {
    id: "json",
    title: "JSON Export",
    description: "Raw analysis data in JSON format for programmatic consumption and integration.",
    icon: FileJson,
    format: "json",
    ext: ".json",
  },
  {
    id: "sarif",
    title: "SARIF Report",
    description: "Static Analysis Results Interchange Format (SARIF v2.1.0) for IDE and CI/CD integration.",
    icon: Shield,
    format: "sarif",
    ext: ".sarif.json",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default async function ReportsPage() {
  const history = await getReportsAnalysisHistory();

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Reports" subtitle="Generated reports and analysis documents" />
      <div className="flex-1 p-6 space-y-6">

        {/* Generate new report section */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
              <BarChart3 className="h-5 w-5 text-blue-400" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Generate Report</h3>
              <p className="text-xs text-text-muted">Download analysis results in your preferred format</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {REPORT_FORMATS.map(({ id, title, description, icon: Icon, format, ext }) => (
              <a
                key={id}
                href={getReportUrl(format)}
                download={`recurrsive-report${ext}`}
                className="group flex flex-col p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/5 hover:border-accent-blue/20 transition-all"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 group-hover:bg-accent-blue/10 transition-colors">
                    <Icon className="h-4 w-4 text-text-secondary group-hover:text-blue-400 transition-colors" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-semibold text-text-primary">{title}</span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed flex-1">{description}</p>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Download className="h-3 w-3" aria-hidden="true" />
                  Download {ext}
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Recent analysis runs */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">
            Recent Analysis Runs
            {history.length > 0 && (
              <span className="ml-2 text-xs font-normal text-text-muted">({history.length} runs)</span>
            )}
          </h3>

          {history.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <Clock className="h-10 w-10 mx-auto text-text-muted mb-3" aria-hidden="true" />
              <p className="text-sm text-text-secondary mb-1">No analysis history yet</p>
              <p className="text-xs text-text-muted">Run an analysis to generate reports. Use the CLI or POST to /api/v1/analyze.</p>
            </div>
          ) : (
            <div className="space-y-3 stagger-children">
              {history.slice(0, 10).map((entry) => {
                const formats = ["markdown", "html", "json", "sarif"] as const;
                return (
                  <div key={entry.id} className="glass-card p-5 flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5">
                      <BarChart3 className="h-5 w-5 text-text-muted" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-text-primary">
                        Analysis Report &mdash; {formatDate(entry.completedAt)}
                      </h4>
                      <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                        {entry.findingCount} findings, {entry.opportunityCount} opportunities
                      </p>
                      <div className="mt-3 flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-xs text-text-muted">
                          <Calendar className="h-3 w-3" aria-hidden="true" />
                          {formatDate(entry.startedAt)}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          entry.status === "success"
                            ? "bg-green-500/10 text-green-400 border border-green-500/20"
                            : "bg-red-500/10 text-red-400 border border-red-500/20"
                        }`}>
                          {entry.status === "success" ? "Completed" : "Failed"}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {formats.map((fmt) => {
                        const fmtDef = REPORT_FORMATS.find((f) => f.format === fmt);
                        return (
                          <a
                            key={fmt}
                            href={getReportUrl(fmt)}
                            download
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                            title={`Download ${fmtDef?.title ?? fmt}`}
                            aria-label={`Download ${fmt} report`}
                          >
                            {fmtDef ? <fmtDef.icon className="h-3.5 w-3.5 text-text-secondary" /> : <Download className="h-3.5 w-3.5 text-text-secondary" />}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
