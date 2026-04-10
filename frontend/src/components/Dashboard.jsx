import { useState, useEffect } from "react";
import { formatDistanceToNow } from "../utils/time.js";

const SEV_COLORS = {
  critical: { bar: "bg-red-500",    text: "text-red-400",    dot: "bg-red-500" },
  high:     { bar: "bg-orange-500", text: "text-orange-400", dot: "bg-orange-500" },
  medium:   { bar: "bg-yellow-400", text: "text-yellow-400", dot: "bg-yellow-400" },
  low:      { bar: "bg-green-400",  text: "text-green-400",  dot: "bg-green-400" },
  unknown:  { bar: "bg-slate-500",  text: "text-slate-400",  dot: "bg-slate-500" },
};

const STATUS_COLORS = {
  triaged:    { bar: "bg-emerald-500", text: "text-emerald-400" },
  resolved:   { bar: "bg-slate-400",   text: "text-slate-400"   },
  processing: { bar: "bg-blue-500",    text: "text-blue-400"    },
  error:      { bar: "bg-red-500",     text: "text-red-400"     },
  submitted:  { bar: "bg-slate-600",   text: "text-slate-500"   },
};

const CAT_COLORS = {
  checkout:       { bar: "bg-purple-500", text: "text-purple-400" },
  payment:        { bar: "bg-pink-500",   text: "text-pink-400"   },
  inventory:      { bar: "bg-cyan-500",   text: "text-cyan-400"   },
  authentication: { bar: "bg-blue-500",   text: "text-blue-400"   },
  performance:    { bar: "bg-amber-500",  text: "text-amber-400"  },
  ui:             { bar: "bg-teal-500",   text: "text-teal-400"   },
  other:          { bar: "bg-slate-500",  text: "text-slate-400"  },
};

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------
function StatCard({ icon, label, value, sub, color = "text-white" }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
          <p className={`text-3xl font-black mt-1.5 tabular-nums ${color}`}>{value}</p>
          {sub && <p className="text-xs text-slate-600 mt-1 leading-snug">{sub}</p>}
        </div>
        <span className="text-2xl shrink-0 mt-0.5">{icon}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horizontal bar chart (div-based, no libs)
// ---------------------------------------------------------------------------
function HBarChart({ data, title, colorMap }) {
  const entries = Object.entries(data)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div className="card p-5">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">{title}</h3>
      <div className="space-y-3.5">
        {entries.map(([key, count]) => {
          const pct = (count / max) * 100;
          const c = colorMap?.[key] || { bar: "bg-slate-500", text: "text-slate-400" };
          return (
            <div key={key}>
              <div className="flex justify-between items-center mb-1.5">
                <span className={`text-xs font-medium capitalize ${c.text}`}>{key}</span>
                <span className="text-xs font-mono text-slate-500 tabular-nums">{count}</span>
              </div>
              <div className="h-2 bg-slate-700/60 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${c.bar}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        {entries.length === 0 && (
          <p className="text-xs text-slate-600 text-center py-4">No data yet</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recent incidents list
// ---------------------------------------------------------------------------
function RecentIncidents({ incidents, onSelect }) {
  if (!incidents?.length) return null;
  return (
    <div className="card p-5">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
        Recent Incidents
      </h3>
      <div className="divide-y divide-slate-700/50">
        {incidents.map(inc => {
          const sc = SEV_COLORS[inc.severity] || SEV_COLORS.unknown;
          return (
            <button
              key={inc.id}
              onClick={() => onSelect(inc.id)}
              className="w-full flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:opacity-80 transition-opacity text-left"
            >
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${sc.dot}`} />
              <span className="flex-1 text-sm text-slate-200 truncate">{inc.title}</span>
              <div className="flex items-center gap-2 shrink-0">
                {inc.category && (
                  <span className="text-[10px] text-slate-500 capitalize hidden sm:inline">
                    {inc.category}
                  </span>
                )}
                <span className={`text-[10px] font-semibold uppercase ${
                  inc.status === "resolved" ? "text-slate-500" :
                  inc.status === "triaged"  ? "text-emerald-400" :
                  "text-blue-400"
                }`}>{inc.status}</span>
                <span className="text-[10px] text-slate-600">
                  {formatDistanceToNow(inc.created_at)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------
export default function Dashboard({ onSelectIncident }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    fetch("/api/analytics")
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-5 animate-pulse">
        <div className="h-8 bg-slate-800 rounded w-40" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="card h-28" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card h-48" />
          <div className="card h-48" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="card p-6 border-red-500/20 bg-red-500/5 text-red-300 text-sm">
          Failed to load analytics: {error}
        </div>
      </div>
    );
  }

  const triageMs = data.avg_triage_time_ms;
  const triageLabel = triageMs > 0
    ? triageMs >= 1000 ? `${(triageMs / 1000).toFixed(1)}s` : `${Math.round(triageMs)}ms`
    : "—";

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Incident analytics &amp; pipeline health
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); setError(null); fetch("/api/analytics").then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(e => { setError(e.message); setLoading(false); }); }}
          className="btn-secondary text-xs"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon="📋"
          label="Total Incidents"
          value={data.total_incidents}
          sub={`${data.open_incidents} still open`}
        />
        <StatCard
          icon="⚡"
          label="Avg Triage Time"
          value={triageLabel}
          sub="LLM processing"
          color="text-blue-300"
        />
        <StatCard
          icon="✅"
          label="Success Rate"
          value={`${Math.round(data.pipeline_success_rate * 100)}%`}
          sub="Pipeline completion"
          color={data.pipeline_success_rate >= 0.8 ? "text-emerald-400" : "text-yellow-400"}
        />
        <StatCard
          icon="🔥"
          label="Open Incidents"
          value={data.open_incidents}
          sub="Awaiting resolution"
          color={data.open_incidents > 0 ? "text-orange-400" : "text-slate-400"}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HBarChart
          title="Incidents by Severity"
          data={data.by_severity || {}}
          colorMap={SEV_COLORS}
        />
        <HBarChart
          title="Incidents by Category"
          data={data.by_category || {}}
          colorMap={CAT_COLORS}
        />
      </div>

      {/* Status chart */}
      <HBarChart
        title="Incidents by Status"
        data={data.by_status || {}}
        colorMap={STATUS_COLORS}
      />

      {/* Recent incidents */}
      <RecentIncidents incidents={data.recent} onSelect={onSelectIncident} />

      {/* Resolution time footer */}
      {data.avg_resolution_time_hours > 0 && (
        <div className="card p-4 flex items-center gap-3">
          <span className="text-xl">⏱️</span>
          <div>
            <p className="text-sm text-slate-300">
              Average resolution time:{" "}
              <span className="font-bold text-white">
                {data.avg_resolution_time_hours < 1
                  ? `${Math.round(data.avg_resolution_time_hours * 60)} min`
                  : `${data.avg_resolution_time_hours.toFixed(1)} hours`}
              </span>
            </p>
            <p className="text-xs text-slate-600">Based on resolved incidents</p>
          </div>
        </div>
      )}
    </div>
  );
}
