import { useState, useRef, useCallback, useEffect } from "react";
import { SeverityBadge } from "./badges.jsx";

const PIPELINE_STEPS = [
  { key: "intake",        emoji: "🔍", label: "Validating" },
  { key: "guardrails",    emoji: "🛡️", label: "Security" },
  { key: "deduplication", emoji: "🔄", label: "Dedup" },
  { key: "triage",        emoji: "🧠", label: "AI Triage" },
  { key: "ticket",        emoji: "🎫", label: "Ticket" },
  { key: "notifier",      emoji: "📢", label: "Notify" },
];

// ---------------------------------------------------------------------------
// Horizontal node stepper with connecting progress bar
// ---------------------------------------------------------------------------
function PipelineStepper({ pipelineLog, isRunning }) {
  const logMap = Object.fromEntries(
    (pipelineLog || []).filter(s => s.step !== "trace_info").map(s => [s.step, s])
  );

  const completedCount = PIPELINE_STEPS.filter(s => logMap[s.key]).length;
  // Active step: first step not yet in logMap
  const activeIdx = isRunning
    ? PIPELINE_STEPS.findIndex(s => !logMap[s.key])
    : -1;

  // Progress bar fill: from node 0 center to last completed node center.
  // Nodes are justify-between inside a px-3 container.
  // Track is left-3 to right-3. Width formula:
  //   (completedCount - 1) / (N - 1) as a fraction of the track length.
  const N = PIPELINE_STEPS.length;
  const fillFraction = completedCount < 1 ? 0 : (completedCount - 1) / (N - 1);

  const overallStatus = completedCount === N ? "done"
    : isRunning ? "running"
    : completedCount > 0 ? "partial"
    : "idle";

  return (
    <div className="card p-5 mt-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          {overallStatus === "running" && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
          {overallStatus === "done" && (
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          )}
          {(overallStatus === "idle" || overallStatus === "partial") && (
            <span className="w-2 h-2 rounded-full bg-slate-600" />
          )}
          <span className="text-sm font-semibold text-slate-300">
            {overallStatus === "running" ? "Pipeline running…"
              : overallStatus === "done"    ? "Pipeline complete"
              : "Preparing pipeline"}
          </span>
        </div>
        <span className="text-xs text-slate-600 tabular-nums">
          {completedCount}/{N}
        </span>
      </div>

      {/* Node stepper */}
      <div className="relative px-3">
        {/* Background track */}
        <div className="absolute top-[11px] left-3 right-3 h-0.5 bg-slate-700" />

        {/* Progress fill — width is a % of the track (left-3 to right-3) */}
        <div
          className="absolute top-[11px] left-3 h-0.5 bg-emerald-500 transition-all duration-700 ease-out"
          style={{ width: `calc(${fillFraction * 100}% * (100% - 24px) / 100%)` }}
        />

        {/* Nodes row */}
        <div className="relative flex justify-between">
          {PIPELINE_STEPS.map((step, idx) => {
            const log = logMap[step.key];
            const isActive  = idx === activeIdx;
            const isDone    = !!log && log.status !== "error";
            const isError   = log?.status === "error";
            const isPending = !log && !isActive;

            return (
              <div key={step.key} className="flex flex-col items-center gap-2" style={{ width: "20%" }}>
                {/* Circle node */}
                <div className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center z-10 bg-slate-950 transition-all duration-300
                  ${isError   ? "border-red-500 bg-red-500/10"
                  : isDone    ? "border-emerald-500 bg-emerald-500/10"
                  : isActive  ? "border-emerald-400 animate-pulse bg-emerald-500/5"
                  : "border-slate-600"}`}
                >
                  {isError ? (
                    <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : isDone ? (
                    <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : isActive ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  ) : null}
                </div>

                {/* Label */}
                <div className={`text-center leading-tight transition-colors duration-300 ${isPending ? "opacity-35" : ""}`}>
                  <div className="text-xs">{step.emoji}</div>
                  <div className={`text-[10px] font-medium mt-0.5
                    ${isError  ? "text-red-400"
                    : isDone   ? "text-emerald-400"
                    : isActive ? "text-emerald-300"
                    : "text-slate-500"}`}
                  >
                    {step.label}
                  </div>
                  {log?.duration_ms !== undefined && (
                    <div className="text-[10px] font-mono text-slate-600 mt-0.5">
                      {log.duration_ms}ms
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Warning pill for guardrails */}
      {logMap["guardrails"]?.status === "warning" && (
        <div className="mt-4 flex items-center gap-2 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          Security guardrails flagged suspicious patterns — sanitized text sent to AI.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result summary card shown after pipeline completes
// ---------------------------------------------------------------------------
function ResultSummary({ incident, onViewTimeline }) {
  const triage = incident.pipeline_log?.find(s => s.step === "triage");
  const details = triage?.result || {};

  return (
    <div className="card p-5 mt-5 border-emerald-500/20 bg-emerald-500/5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-semibold text-emerald-300">Triage complete</span>
          </div>
          <p className="text-xs text-slate-500">Incident analyzed, ticket created, team notified.</p>
        </div>
        {incident.severity && <SeverityBadge severity={incident.severity} />}
      </div>

      <div className="space-y-2 text-sm divide-y divide-slate-700/50">
        {incident.category && (
          <div className="flex gap-3 py-1.5 first:pt-0">
            <span className="text-slate-500 w-24 shrink-0">Category</span>
            <span className="text-slate-300 capitalize">{incident.category}</span>
          </div>
        )}
        {incident.ticket_id && (
          <div className="flex gap-3 py-1.5">
            <span className="text-slate-500 w-24 shrink-0">Ticket</span>
            <span className="font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-xs self-start">
              {incident.ticket_id}
            </span>
          </div>
        )}
        {incident.summary && (
          <div className="flex gap-3 py-1.5">
            <span className="text-slate-500 w-24 shrink-0 mt-0.5">Summary</span>
            <span className="text-slate-300 leading-relaxed text-xs">{incident.summary}</span>
          </div>
        )}
        {details.probable_root_cause && (
          <div className="flex gap-3 py-1.5">
            <span className="text-slate-500 w-24 shrink-0 mt-0.5">Root cause</span>
            <span className="text-slate-400 leading-relaxed text-xs">{details.probable_root_cause}</span>
          </div>
        )}
      </div>

      <button onClick={onViewTimeline} className="btn-primary w-full mt-4 text-sm">
        View Full Timeline
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main form component
// ---------------------------------------------------------------------------
export default function IncidentForm({ onCreated, onCancel }) {
  const [form, setForm] = useState({ title: "", description: "", reporter_email: "" });
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pipelineLog, setPipelineLog] = useState([]);
  const [completedIncident, setCompletedIncident] = useState(null);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleFile = (file) => {
    if (!file) return;
    setImage(file);
    const reader = new FileReader();
    reader.onload = e => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
  }, []);

  const startPolling = (incidentId) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/incidents/${incidentId}`);
        if (!res.ok) return;
        const data = await res.json();
        setPipelineLog(data.pipeline_log || []);
        if (data.status !== "processing" && data.status !== "submitted") {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setSubmitting(false);
          setCompletedIncident(data);
        }
      } catch {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setSubmitting(false);
      }
    }, 1000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    setPipelineLog([]);
    setCompletedIncident(null);

    const fd = new FormData();
    fd.append("title", form.title);
    fd.append("description", form.description);
    fd.append("reporter_email", form.reporter_email);
    if (image) fd.append("image", image);

    try {
      const res = await fetch("/api/incidents", { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || `Server error ${res.status}`);
      }
      const { id } = await res.json();
      startPolling(id);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onCancel} className="btn-ghost p-1.5" disabled={submitting}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Report Incident</h1>
        </div>
      </div>

      {/* Form card */}
      <div className="card p-6 space-y-5">
        {/* AI badge */}
        <div className="flex items-center gap-2 pb-1 border-b border-slate-700/60">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            AI-Powered Triage
          </span>
          <span className="text-xs text-slate-600">Automatic severity, category &amp; ticket — powered by Gemini</span>
        </div>

        {/* Title */}
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input
            id="title" name="title" type="text" className="input"
            placeholder="e.g. Checkout failing for all users after deploy"
            value={form.title} onChange={handleChange}
            required minLength={5} disabled={submitting}
          />
        </div>

        {/* Description */}
        <div>
          <label className="label" htmlFor="description">Description</label>
          <textarea
            id="description" name="description" className="input resize-none" rows={6}
            placeholder="Describe the issue in detail. Include error messages, affected functionality, and steps to reproduce if possible."
            value={form.description} onChange={handleChange}
            required minLength={20} disabled={submitting}
          />
        </div>

        {/* Email */}
        <div>
          <label className="label" htmlFor="reporter_email">Your Email</label>
          <input
            id="reporter_email" name="reporter_email" type="email" className="input"
            placeholder="you@company.com"
            value={form.reporter_email} onChange={handleChange}
            required disabled={submitting}
          />
        </div>

        {/* Image upload */}
        <div>
          <label className="label">Screenshot (optional)</label>
          <div
            className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer
              ${dragging ? "border-emerald-500 bg-emerald-500/5" : "border-slate-600 hover:border-slate-500 bg-slate-900/50"}
              ${submitting ? "opacity-50 pointer-events-none" : ""}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => handleFile(e.target.files[0])}
            />
            {imagePreview ? (
              <div className="relative p-3">
                <img src={imagePreview} alt="Preview" className="max-h-48 mx-auto rounded-lg object-contain" />
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setImage(null); setImagePreview(null); }}
                  className="absolute top-2 right-2 w-7 h-7 bg-slate-800/90 rounded-full flex items-center justify-center hover:bg-red-500/30 transition-colors border border-slate-700"
                >
                  <svg className="w-3.5 h-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="text-center mt-2">
                  <span className="text-xs text-slate-500">{image?.name}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 px-4 gap-2">
                <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                <p className="text-sm text-slate-400">
                  <span className="text-emerald-400 font-medium">Click to upload</span> or drag &amp; drop
                </p>
                <p className="text-xs text-slate-600">PNG, JPG, GIF, WebP · max 10 MB · sent to AI for analysis</p>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={handleSubmit} className="btn-primary flex-1" disabled={submitting || !form.title || !form.description || !form.reporter_email}>
            {submitting ? (
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Processing…</>
            ) : (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg> Submit &amp; Analyze</>
            )}
          </button>
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        </div>
      </div>

      {/* Live stepper while running */}
      {submitting && !completedIncident && (
        <PipelineStepper pipelineLog={pipelineLog} isRunning={true} />
      )}

      {/* Final state: stepper + result summary */}
      {completedIncident && (
        <>
          <PipelineStepper pipelineLog={completedIncident.pipeline_log} isRunning={false} />
          <ResultSummary
            incident={completedIncident}
            onViewTimeline={() => onCreated(completedIncident)}
          />
        </>
      )}
    </div>
  );
}
