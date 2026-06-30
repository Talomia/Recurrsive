import Header from "@/components/header";
import { FileText, Download, Calendar, BarChart3, FileJson, Code2, Shield } from "lucide-react";
import { getReportUrl } from "@/lib/api";

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

const RECENT_REPORTS = [
  {
    title: "Monthly Intelligence Report — June 2026",
    description: "Comprehensive summary of code quality improvements, resolved opportunities, and performance trends.",
    date: "Jun 29, 2026",
    type: "Monthly",
    format: "html",
  },
  {
    title: "Security Audit Summary — Q2 2026",
    description: "Quarterly security assessment covering vulnerability analysis, dependency audits, and compliance checks.",
    date: "Jun 15, 2026",
    type: "Quarterly",
    format: "sarif",
  },
  {
    title: "Performance Benchmark Report",
    description: "Detailed analysis of system performance metrics, response times, and resource utilization patterns.",
    date: "Jun 10, 2026",
    type: "On-demand",
    format: "markdown",
  },
  {
    title: "Technical Debt Assessment",
    description: "Estimated technical debt cost, hotspot identification, and recommended remediation priorities.",
    date: "Jun 1, 2026",
    type: "Monthly",
    format: "json",
  },
];

export default function ReportsPage() {
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

        {/* Recent reports */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">Recent Reports</h3>
          <div className="space-y-3 stagger-children">
            {RECENT_REPORTS.map((report, i) => {
              const formatDef = REPORT_FORMATS.find((f) => f.format === report.format);
              const FormatIcon = formatDef?.icon ?? FileText;
              return (
                <div key={i} className="glass-card p-5 flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5">
                    <FormatIcon className="h-5 w-5 text-text-muted" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-text-primary">{report.title}</h4>
                    <p className="mt-1 text-xs text-text-secondary leading-relaxed">{report.description}</p>
                    <div className="mt-3 flex items-center gap-4">
                      <div className="flex items-center gap-1.5 text-xs text-text-muted">
                        <Calendar className="h-3 w-3" aria-hidden="true" />
                        {report.date}
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                        {report.type}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 font-medium">
                        Ready
                      </span>
                    </div>
                  </div>
                  <a
                    href={getReportUrl(report.format)}
                    download
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                    aria-label={`Download ${report.title}`}
                  >
                    <Download className="h-4 w-4 text-text-secondary" />
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
