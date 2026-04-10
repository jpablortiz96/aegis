import { useState } from "react";
import { SeverityBadge, StatusBadge } from "./badges.jsx";
import { formatDateTime } from "../utils/time.js";
import NotificationPreview from "./NotificationPreview.jsx";

const STEP_META = {
  intake:                   { label: "Input Validation",        emoji: "🔍" },
  guardrails:               { label: "Security Check",          emoji: "🛡️" },
  deduplication:            { label: "Deduplication Check",     emoji: "🔄" },
  triage:                   { label: "AI Triage",               emoji: "🧠" },
  ticket:                   { label: "Ticket Creation",         emoji: "🎫" },
  notifier:                 { label: "Team Notification",       emoji: "📢" },
  "resolution-notification":{ label: "Resolution Notification", emoji: "✅" },
  trace_info:               { label: "Langfuse Trace",          emoji: "📡" },
};

// ---------------------------------------------------------------------------
// Individual step card
// ---------------------------------------------------------------------------
function StepCard({ step, incident }) {
  const [expanded, setExpanded] = useState(false);
  const meta = STEP_META[step.step] || { label: step.step, emoji: "⚙️" };

  const isSuccess = step.status === "success" || step.status === "warning";
  const isError   = step.status === "error";
  const isNotifStep = step.step === "notifier" || step.step === "resolution-notification";
  const isDedupStep = step.step === "deduplication";

  // trace_info is rendered separately — skip here
  if (step.step === "trace_info") return null;

  return (
    <div className="relative pl-8 pb-5 last:pb-0">
      {/* Connector line */}
      <div className="absolute left-[10px] top-5 bottom-0 w-px bg-slate-700/70" />

      {/* Status dot */}
      <div className={`absolute left-0 top-0.5 w-5 h-5 rounded-full flex items-center justify-center
        ${isError   ? "bg-red-500/20 border border-red-500/40"
        : isSuccess ? "bg-emerald-500/20 border border-emerald-500/40"
        : "bg-slate-700 border border-slate-600"}`}
      >
        {isError ? (
          <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : isSuccess ? (
          <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <span className="w-2 h-2 rounded-full bg-slate-500" />
        )}
      </div>

      <div className="card p-4">
        <button
          className="flex items-center justify-between w-full gap-3 text-left"
          onClick={() => setExpanded(p => !p)}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-base leading-none">{meta.emoji}</span>
            <span className={`font-medium text-sm ${isError ? "text-red-300" : isSuccess ? "text-slate-200" : "text-slate-400"}`}>
              {meta.label}
            </span>
            {step.status === "warning" && (
              <span className="badge bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30 text-[10px]">
                flagged
              </span>
            )}
            {/* Dedup: show similar count badge */}
            {isDedupStep && step.result?.similar_count > 0 && (
              <span className="badge bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30 text-[10px]">
                {step.result.similar_count} similar
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {step.duration_ms !== undefined && (
              <span className="text-xs font-mono text-slate-600">{step.duration_ms}ms</span>
            )}
            <svg
              className={`w-4 h-4 text-slate-600 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </button>

        {expanded && (
          <>
            {/* Notification steps: show visual preview */}
            {isNotifStep ? (
              <NotificationPreview step={step} incident={incident} />
            ) : step.result ? (
              <div className="mt-3 pt-3 border-t border-slate-700/70">
                <pre className="text-xs text-slate-400 overflow-auto max-h-52 font-mono leading-relaxed whitespace-pre-wrap">
                  {JSON.stringify(step.result, null, 2)}
                </pre>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Similar incidents banner
// ---------------------------------------------------------------------------
function SimilarIncidentsBanner({ similar, onSelect }) {
  const [open, setOpen] = useState(false);
  if (!similar?.length) return null;

  return (
    <div className="card p-4 mb-5 border-yellow-500/30 bg-yellow-500/5">
      <button
        className="flex items-center justify-between w-full gap-3 text-left"
        onClick={() => setOpen(p => !p)}
      >
        <div className="flex items-center gap-2.5">
          <svg className="w-4 h-4 text-yellow-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span className="text-sm font-semibold text-yellow-300">
            ⚠️ Similar incidents detected ({similar.length})
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-yellow-600 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="mt-3 space-y-2 pt-3 border-t border-yellow-500/20">
          <p className="text-xs text-slate-500 mb-2">
            These existing incidents share similar keywords. This may be a recurrence.
          </p>
          {similar.map(sim => (
            <button
              key={sim.id}
              onClick={() => onSelect(sim.id)}
              className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-slate-700/40 hover:bg-slate-700/60 transition-colors text-left"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                sim.severity === "critical" ? "bg-red-500" :
                sim.severity === "high"     ? "bg-orange-500" :
                sim.severity === "medium"   ? "bg-yellow-400" :
                sim.severity === "low"      ? "bg-green-400" : "bg-slate-500"
              }`} />
              <span className="flex-1 text-xs text-slate-300 truncate">{sim.title}</span>
              <span className="text-[10px] font-mono text-slate-500 shrink-0">
                {Math.round(sim.similarity_score * 100)}% match
              </span>
              <span className={`text-[10px] shrink-0 capitalize ${
                sim.status === "resolved" ? "text-slate-500" : "text-emerald-400"
              }`}>{sim.status}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main timeline
// ---------------------------------------------------------------------------
export default function IncidentTimeline({ incident, onBack, onRefresh, onSelectIncident }) {
  const [resolving, setResolving]         = useState(false);
  const [resolveResult, setResolveResult] = useState(null);
  const [reprocessing, setReprocessing]   = useState(false);
  const [exporting, setExporting]         = useState(false);

  // Extract Langfuse trace info
  const traceInfo = incident.pipeline_log?.find(s => s.step === "trace_info")?.result;
  const traceUrl  = traceInfo?.trace_url;

  // Extract similar incidents from deduplication step
  const dedupStep = incident.pipeline_log?.find(s => s.step === "deduplication");
  const similarIncidents = dedupStep?.result?.similar_incidents || [];

  const visibleSteps = (incident.pipeline_log || []).filter(s => s.step !== "trace_info");

  const handleResolve = async () => {
    setResolving(true);
    try {
      const res = await fetch(`/api/incidents/${incident.id}/resolve`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setResolveResult(data);
        await onRefresh();
      }
    } finally {
      setResolving(false);
    }
  };

  const handleReprocess = async () => {
    setReprocessing(true);
    try {
      const res = await fetch(`/api/incidents/${incident.id}/reprocess`, { method: "POST" });
      if (res.ok) {
        const poll = setInterval(async () => {
          const r = await fetch(`/api/incidents/${incident.id}`);
          const d = await r.json();
          if (d.status !== "processing") {
            clearInterval(poll);
            setReprocessing(false);
            await onRefresh();
          }
        }, 1000);
      } else {
        setReprocessing(false);
      }
    } catch {
      setReprocessing(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/incidents/${incident.id}/report`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const report = await res.json();
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${report.report_id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
        <button onClick={onBack} className="btn-ghost p-1.5">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {traceUrl && (
            <a
              href={traceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-xs gap-1.5"
            >
              <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              <span className="text-purple-300">Langfuse</span>
            </a>
          )}
          <button
            className="btn-secondary text-xs"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            ) : "📄"}
            Export Report
          </button>
          {incident.status !== "resolved" && (
            <button className="btn-secondary text-sm" onClick={handleReprocess} disabled={reprocessing || resolving}>
              {reprocessing ? (
                <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Reprocessing…</>
              ) : "Reprocess"}
            </button>
          )}
          {incident.status !== "resolved" && (
            <button className="btn-primary text-sm" onClick={handleResolve} disabled={resolving || reprocessing}>
              {resolving ? (
                <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Resolving…</>
              ) : (
                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Mark as Resolved</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Header card */}
      <div className="card p-6 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <SeverityBadge severity={incident.severity} />
              <StatusBadge status={incident.status} />
              {incident.ticket_id && (
                <span className="font-mono text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                  {incident.ticket_id}
                </span>
              )}
            </div>
            <h1 className="text-lg font-bold text-white leading-snug">{incident.title}</h1>
            {incident.reporter_email && (
              <p className="text-sm text-slate-500 mt-1">{incident.reporter_email}</p>
            )}
          </div>

          {incident.severity && (
            <div className={`shrink-0 px-4 py-3 rounded-xl text-center min-w-[80px]
              ${incident.severity === "critical" ? "bg-red-500/15"
              : incident.severity === "high"     ? "bg-orange-500/15"
              : incident.severity === "medium"   ? "bg-yellow-500/15"
              : "bg-green-500/15"}`}
            >
              <div className={`text-2xl font-black uppercase
                ${incident.severity === "critical" ? "text-red-400"
                : incident.severity === "high"     ? "text-orange-400"
                : incident.severity === "medium"   ? "text-yellow-400"
                : "text-green-400"}`}
              >
                {incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">Severity</div>
            </div>
          )}
        </div>

        {incident.summary && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <p className="text-sm text-slate-300 leading-relaxed">{incident.summary}</p>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-slate-700 flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-slate-500">
          <span>ID: <span className="font-mono text-slate-400">{incident.id.slice(0, 8)}</span></span>
          <span>Created: <span className="text-slate-400">{formatDateTime(incident.created_at)}</span></span>
          {incident.category && (
            <span>Category: <span className="text-slate-400 capitalize">{incident.category}</span></span>
          )}
        </div>
      </div>

      {/* Similar incidents banner */}
      {similarIncidents.length > 0 && (
        <SimilarIncidentsBanner
          similar={similarIncidents}
          onSelect={onSelectIncident || (() => {})}
        />
      )}

      {/* Description */}
      <div className="card p-5 mb-5">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Description</h2>
        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{incident.description}</p>
      </div>

      {/* Screenshot */}
      {incident.image_path && (
        <div className="card p-4 mb-5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Screenshot</h2>
          <img
            src={incident.image_path}
            alt="Incident screenshot"
            className="rounded-lg max-h-80 object-contain mx-auto"
          />
        </div>
      )}

      {/* Pipeline timeline */}
      {visibleSteps.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pipeline Execution
            </h2>
            {traceUrl && (
              <a
                href={traceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                View in Langfuse
              </a>
            )}
          </div>

          <div className="relative">
            {visibleSteps.map((step, idx) => (
              <StepCard key={idx} step={step} incident={incident} />
            ))}
          </div>
        </div>
      )}

      {/* Resolve confirmation banner */}
      {(resolveResult || incident.status === "resolved") && (
        <div className="card p-5 border-emerald-500/20 bg-emerald-500/5 mb-5">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-emerald-300">Incident resolved</p>
              <p className="text-xs text-slate-400 mt-1">
                {resolveResult
                  ? `Notification sent to ${resolveResult.email_notification?.to || incident.reporter_email} and posted to ${resolveResult.slack_notification?.channel || "#sre-incidents"}.`
                  : "This incident has been marked as resolved."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
