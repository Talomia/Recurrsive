import Header from "@/components/header";
import { FileText, Download, Calendar, BarChart3 } from "lucide-react";

const REPORTS = [
  {
    title: "Monthly Intelligence Report — June 2026",
    description: "Comprehensive summary of code quality improvements, resolved opportunities, and performance trends.",
    date: "Jun 29, 2026",
    type: "Monthly",
    status: "Ready",
  },
  {
    title: "Security Audit Summary — Q2 2026",
    description: "Quarterly security assessment covering vulnerability analysis, dependency audits, and compliance checks.",
    date: "Jun 15, 2026",
    type: "Quarterly",
    status: "Ready",
  },
  {
    title: "Performance Benchmark Report",
    description: "Detailed analysis of system performance metrics, response times, and resource utilization patterns.",
    date: "Jun 10, 2026",
    type: "On-demand",
    status: "Ready",
  },
  {
    title: "Technical Debt Assessment",
    description: "Estimated technical debt cost, hotspot identification, and recommended remediation priorities.",
    date: "Jun 1, 2026",
    type: "Monthly",
    status: "Ready",
  },
];

export default function ReportsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Reports" subtitle="Generated reports and analysis documents" />
      <div className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
              <BarChart3 className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Available Reports</h3>
              <p className="text-xs text-text-muted">{REPORTS.length} reports generated</p>
            </div>
          </div>
          <button className="flex items-center gap-2 rounded-xl bg-accent-blue/10 border border-blue-500/20 px-4 py-2 text-sm font-medium text-blue-400 hover:bg-accent-blue/20 transition-colors">
            <FileText className="h-4 w-4" />
            Generate New Report
          </button>
        </div>

        <div className="space-y-3 stagger-children">
          {REPORTS.map((report, i) => (
            <div key={i} className="glass-card p-5 flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5">
                <FileText className="h-5 w-5 text-text-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-text-primary">{report.title}</h4>
                <p className="mt-1 text-xs text-text-secondary leading-relaxed">{report.description}</p>
                <div className="mt-3 flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-xs text-text-muted">
                    <Calendar className="h-3 w-3" />
                    {report.date}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                    {report.type}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 font-medium">
                    {report.status}
                  </span>
                </div>
              </div>
              <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                <Download className="h-4 w-4 text-text-secondary" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
