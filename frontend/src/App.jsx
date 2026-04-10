import { useState, useEffect, useCallback } from "react";
import Header from "./components/Header.jsx";
import IncidentList from "./components/IncidentList.jsx";
import IncidentForm from "./components/IncidentForm.jsx";
import IncidentTimeline from "./components/IncidentTimeline.jsx";
import SecurityTest from "./components/SecurityTest.jsx";
import Dashboard from "./components/Dashboard.jsx";

export default function App() {
  const [view, setView] = useState("list"); // list | new | detail | security | dashboard
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchIncidents = useCallback(async () => {
    try {
      const res = await fetch("/api/incidents");
      if (res.ok) setIncidents(await res.json());
    } catch (err) {
      console.error("Failed to fetch incidents:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchIncidents(); }, [fetchIncidents]);

  const handleIncidentCreated = (incident) => {
    setIncidents(prev => [incident, ...prev]);
    setSelectedIncident(incident);
    setView("detail");
  };

  const handleSelectIncident = async (id) => {
    try {
      const res = await fetch(`/api/incidents/${id}`);
      if (res.ok) { setSelectedIncident(await res.json()); setView("detail"); }
    } catch (err) { console.error(err); }
  };

  const goList = () => { setView("list"); setSelectedIncident(null); fetchIncidents(); };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Header
        onNew={() => setView("new")}
        onList={goList}
        onSecurity={() => setView("security")}
        onDashboard={() => setView("dashboard")}
        currentView={view}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {view === "list" && (
          <IncidentList incidents={incidents} loading={loading} onSelect={handleSelectIncident} onNew={() => setView("new")} />
        )}
        {view === "new" && (
          <IncidentForm onCreated={handleIncidentCreated} onCancel={goList} />
        )}
        {view === "detail" && selectedIncident && (
          <IncidentTimeline
            incident={selectedIncident}
            onBack={goList}
            onSelectIncident={handleSelectIncident}
            onRefresh={async () => {
              const res = await fetch(`/api/incidents/${selectedIncident.id}`);
              if (res.ok) setSelectedIncident(await res.json());
            }}
          />
        )}
        {view === "security" && <SecurityTest />}
        {view === "dashboard" && <Dashboard onSelectIncident={handleSelectIncident} />}
      </main>
    </div>
  );
}
