import { useState } from "react";

const SEV_STYLE = {
  critical: {
    border:    "border-l-red-500",
    badgeBg:   "bg-red-500/20 text-red-400",
    emailBg:   "bg-red-50 border-red-200",
    dot:       "bg-red-500",
    emoji:     "🔴",
  },
  high: {
    border:    "border-l-orange-500",
    badgeBg:   "bg-orange-500/20 text-orange-400",
    emailBg:   "bg-orange-50 border-orange-200",
    dot:       "bg-orange-500",
    emoji:     "🟠",
  },
  medium: {
    border:    "border-l-yellow-400",
    badgeBg:   "bg-yellow-500/20 text-yellow-400",
    emailBg:   "bg-yellow-50 border-yellow-200",
    dot:       "bg-yellow-400",
    emoji:     "🟡",
  },
  low: {
    border:    "border-l-green-500",
    badgeBg:   "bg-green-500/20 text-green-400",
    emailBg:   "bg-green-50 border-green-200",
    dot:       "bg-green-500",
    emoji:     "🟢",
  },
};

// ---------------------------------------------------------------------------
// Slack mock
// ---------------------------------------------------------------------------
function SlackPreview({ incident, ticketId, summary }) {
  const sev = (incident?.severity || "medium").toLowerCase();
  const s   = SEV_STYLE[sev] || SEV_STYLE.medium;
  const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="rounded-xl overflow-hidden border border-slate-700/60 bg-[#1a1d21] text-sm">
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-700/60 bg-[#19191c]">
        <div className="flex gap-1.5">
          {["bg-red-500/60","bg-yellow-500/60","bg-green-500/60"].map(c => (
            <div key={c} className={`w-2.5 h-2.5 rounded-full ${c}`} />
          ))}
        </div>
        <span className="text-xs text-slate-500 mx-auto font-mono"># sre-incidents</span>
      </div>

      {/* Channel divider */}
      <div className="flex items-center gap-2 px-4 py-2 text-[10px] text-slate-600">
        <div className="flex-1 h-px bg-slate-700/50" />
        <span>Today</span>
        <div className="flex-1 h-px bg-slate-700/50" />
      </div>

      {/* Message */}
      <div className="px-4 pb-4">
        <div className={`rounded-lg border-l-4 ${s.border} bg-[#222529] pl-3 pr-4 py-3`}>
          <div className="flex gap-3">
            {/* Avatar */}
            <div className="w-8 h-8 rounded-md bg-emerald-600 flex items-center justify-center shrink-0 text-white font-bold text-sm mt-0.5">
              A
            </div>
            <div className="flex-1 min-w-0">
              {/* Name + timestamp */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-bold text-white text-sm">AEGIS Bot</span>
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${s.badgeBg}`}>APP</span>
                <span className="text-xs text-slate-600">{now}</span>
              </div>
              {/* Body */}
              <p className="text-slate-100 font-semibold text-sm">
                {s.emoji} [{(incident?.severity || "medium").toUpperCase()}] New Incident: {incident?.title}
              </p>
              <p className="text-slate-500 text-xs mt-1">
                ID:{" "}
                <code className="bg-slate-700/70 text-slate-300 px-1.5 py-0.5 rounded font-mono text-[10px]">
                  {incident?.id?.slice(0, 8) || "--------"}
                </code>
                {"  "}Ticket:{" "}
                <code className="bg-slate-700/70 text-emerald-400 px-1.5 py-0.5 rounded font-mono text-[10px]">
                  {ticketId || "N/A"}
                </code>
              </p>
              {summary && (
                <p className="text-slate-400 text-xs italic mt-1.5 leading-relaxed">
                  {summary.slice(0, 150)}{summary.length > 150 ? "…" : ""}
                </p>
              )}
              <p className="text-blue-400 text-xs mt-2 hover:underline cursor-pointer inline-flex items-center gap-1">
                View Ticket
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Email mock
// ---------------------------------------------------------------------------
function EmailPreview({ incident, ticketId, summary, isResolution }) {
  const sev = (incident?.severity || "medium").toLowerCase();
  const s   = SEV_STYLE[sev] || SEV_STYLE.medium;

  const subject = isResolution
    ? `[AEGIS] Incident resolved: ${incident?.title}`
    : `[AEGIS] Incident received: ${incident?.title} [${(incident?.severity || "MEDIUM").toUpperCase()}]`;

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 bg-white text-slate-900 text-sm">
      {/* Email header meta */}
      <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 space-y-0.5 text-xs">
        <div className="flex gap-2">
          <span className="text-slate-400 w-16 shrink-0 font-medium">From</span>
          <span className="text-slate-700">AEGIS Incident Management &lt;noreply@aegis.sre&gt;</span>
        </div>
        <div className="flex gap-2">
          <span className="text-slate-400 w-16 shrink-0 font-medium">To</span>
          <span className="text-slate-700">{incident?.reporter_email || "reporter@company.com"}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-slate-400 w-16 shrink-0 font-medium">Subject</span>
          <span className="font-semibold text-slate-900">{subject}</span>
        </div>
      </div>

      {/* Email body */}
      <div className="px-5 py-5">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-slate-100">
          <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">A</span>
          </div>
          <span className="font-bold text-slate-900 tracking-tight">AEGIS</span>
          <span className="text-xs text-slate-400 hidden sm:inline">Autonomous Engine for Guided Incident Support</span>
        </div>

        {isResolution ? (
          /* ── Resolution email ─────────────────────────────────── */
          <div className="space-y-3.5">
            <p className="text-slate-700">Hello,</p>
            <p className="text-slate-700">
              Good news — your incident has been{" "}
              <strong className="text-green-700">resolved</strong>.
            </p>
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 space-y-1.5 text-sm">
              <div className="flex gap-3">
                <span className="text-slate-500 w-20 shrink-0">Title</span>
                <span className="font-medium">{incident?.title}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-slate-500 w-20 shrink-0">Ticket</span>
                <span className="font-mono text-green-700 text-xs">{ticketId || "N/A"}</span>
              </div>
              {summary && (
                <div className="flex gap-3">
                  <span className="text-slate-500 w-20 shrink-0">Summary</span>
                  <span className="text-slate-600 leading-relaxed">{summary.slice(0, 200)}</span>
                </div>
              )}
            </div>
            <p className="text-slate-500 text-xs">
              If you experience further issues, please report a new incident.
            </p>
          </div>
        ) : (
          /* ── Intake notification email ────────────────────────── */
          <div className="space-y-3.5">
            <p className="text-slate-700">Hello,</p>
            <p className="text-slate-700">
              Your incident report has been received and is being processed by our SRE team.
            </p>

            {/* Severity info block */}
            <div className={`rounded-lg border p-4 ${s.emailBg}`}>
              <div className="flex items-center gap-2 mb-3">
                <span>{s.emoji}</span>
                <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${s.badgeBg}`}>
                  {(incident?.severity || "medium").toUpperCase()} severity
                </span>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex gap-3">
                  <span className="text-slate-500 w-20 shrink-0">Title</span>
                  <span className="font-medium">{incident?.title}</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-slate-500 w-20 shrink-0">Ticket</span>
                  <span className="font-mono text-emerald-700 text-xs">{ticketId || "N/A"}</span>
                </div>
                {incident?.category && (
                  <div className="flex gap-3">
                    <span className="text-slate-500 w-20 shrink-0">Category</span>
                    <span className="capitalize">{incident.category}</span>
                  </div>
                )}
                {summary && (
                  <div className="flex gap-3">
                    <span className="text-slate-500 w-20 shrink-0">Summary</span>
                    <span className="text-slate-600 leading-relaxed">{summary.slice(0, 200)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* CTA */}
            <div>
              <span className="inline-block bg-emerald-600 text-white text-xs font-semibold px-5 py-2.5 rounded-lg cursor-pointer hover:bg-emerald-700 transition-colors">
                View Incident →
              </span>
            </div>

            <p className="text-slate-500 text-xs">
              The SRE team has been notified and will investigate shortly.
            </p>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-slate-100 text-[10px] text-slate-400 text-center">
          AEGIS Incident Management &nbsp;·&nbsp; Autonomous Engine for Guided Incident Support
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported component — tabbed Slack + Email preview
// ---------------------------------------------------------------------------
export default function NotificationPreview({ step, incident }) {
  const [tab, setTab] = useState("slack");

  if (!step?.result) return null;

  const isResolution = step.step === "resolution-notification";
  const ticketId     = incident?.ticket_id || step.result?.ticket_id;
  const summary      = incident?.summary || "";

  return (
    <div className="mt-3 pt-3 border-t border-slate-700/70">
      {/* Tab switcher */}
      <div className="flex gap-1 mb-3 p-1 bg-slate-800/80 rounded-lg w-fit">
        {[
          { id: "slack", icon: "💬", label: "Slack" },
          { id: "email", icon: "📧", label: "Email" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
              tab === t.id
                ? "bg-slate-700 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "slack" && (
        <SlackPreview incident={incident} ticketId={ticketId} summary={summary} />
      )}
      {tab === "email" && (
        <EmailPreview
          incident={incident}
          ticketId={ticketId}
          summary={summary}
          isResolution={isResolution}
        />
      )}
    </div>
  );
}
