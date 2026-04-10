export function SeverityBadge({ severity }) {
  if (!severity) return <span className="text-slate-600 text-xs">—</span>;

  const styles = {
    critical: "bg-red-500/15 text-red-400 ring-1 ring-red-500/30",
    high: "bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30",
    medium: "bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30",
    low: "bg-green-500/15 text-green-400 ring-1 ring-green-500/30",
  };

  const dots = {
    critical: "bg-red-400",
    high: "bg-orange-400",
    medium: "bg-yellow-400",
    low: "bg-green-400",
  };

  return (
    <span className={`badge ${styles[severity] || "bg-slate-700 text-slate-400"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[severity] || "bg-slate-400"}`} />
      {severity}
    </span>
  );
}

export function StatusBadge({ status }) {
  if (!status) return null;

  const styles = {
    submitted: "bg-slate-700 text-slate-300",
    processing: "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30",
    triaged: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30",
    resolved: "bg-slate-600/50 text-slate-400",
    error: "bg-red-500/15 text-red-400 ring-1 ring-red-500/30",
  };

  return (
    <span className={`badge ${styles[status] || "bg-slate-700 text-slate-400"}`}>
      {status}
    </span>
  );
}
