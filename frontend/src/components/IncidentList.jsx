import { formatDistanceToNow } from "../utils/time.js";
import { SeverityBadge, StatusBadge } from "./badges.jsx";

const SEVERITY_ACCENT = {
  critical: "border-red-500/30 hover:border-red-500/50",
  high:     "border-orange-500/30 hover:border-orange-500/50",
  medium:   "border-yellow-500/30 hover:border-yellow-500/50",
  low:      "border-green-500/30 hover:border-green-500/50",
};

function IncidentCard({ incident, onSelect }) {
  const accent = SEVERITY_ACCENT[incident.severity] || "border-slate-700 hover:border-slate-600";

  return (
    <button
      onClick={() => onSelect(incident.id)}
      className={`card p-5 text-left w-full transition-all duration-150 hover:bg-slate-700/40 border ${accent} group`}
    >
      {/* Top row: severity + status + time */}
      <div className="flex items-center gap-2 mb-3">
        <SeverityBadge severity={incident.severity} />
        <StatusBadge status={incident.status} />
        <span className="ml-auto text-xs text-slate-600 whitespace-nowrap">
          {formatDistanceToNow(incident.created_at)}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-slate-100 group-hover:text-white transition-colors leading-snug line-clamp-2 mb-2">
        {incident.title}
      </h3>

      {/* Meta row */}
      <div className="flex items-center gap-3 flex-wrap">
        {incident.category && (
          <span className="text-xs text-slate-500 capitalize bg-slate-700/60 px-2 py-0.5 rounded-full">
            {incident.category}
          </span>
        )}
        {incident.ticket_id && (
          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
            {incident.ticket_id}
          </span>
        )}
        <span className="ml-auto">
          <svg className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </span>
      </div>
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="card p-5 animate-pulse space-y-3">
      <div className="flex gap-2">
        <div className="h-5 w-14 bg-slate-700 rounded-full" />
        <div className="h-5 w-20 bg-slate-700 rounded-full" />
      </div>
      <div className="h-4 bg-slate-700 rounded w-3/4" />
      <div className="h-3 bg-slate-700 rounded w-1/3" />
    </div>
  );
}

function ListHeader({ count, onNew }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-xl font-bold text-white">Incidents</h1>
        {count > 0 && (
          <p className="text-sm text-slate-500 mt-0.5">{count} incident{count !== 1 ? "s" : ""}</p>
        )}
      </div>
      <button onClick={onNew} className="btn-primary">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Report Incident
      </button>
    </div>
  );
}

export default function IncidentList({ incidents, loading, onSelect, onNew }) {
  if (loading) {
    return (
      <div>
        <ListHeader count={0} onNew={onNew} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (incidents.length === 0) {
    return (
      <div>
        <ListHeader count={0} onNew={onNew} />
        <div className="card p-16 flex flex-col items-center justify-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-slate-700/80 flex items-center justify-center">
            <svg className="w-7 h-7 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <div>
            <p className="text-slate-300 font-medium">No incidents yet</p>
            <p className="text-slate-500 text-sm mt-1">When incidents are reported, they will appear here.</p>
          </div>
          <button onClick={onNew} className="btn-primary mt-2">Report an incident</button>
        </div>
      </div>
    );
  }

  // Sort by most recent first (already sorted from API, but guard here too)
  const sorted = [...incidents].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  return (
    <div>
      <ListHeader count={incidents.length} onNew={onNew} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map(incident => (
          <IncidentCard key={incident.id} incident={incident} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
