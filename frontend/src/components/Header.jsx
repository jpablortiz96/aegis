export default function Header({ onNew, onList, onSecurity, onDashboard, currentView }) {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 backdrop-blur-sm bg-slate-900/95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button onClick={onList} className="flex items-center gap-3 group">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-900/40 group-hover:bg-emerald-400 transition-colors">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-white text-lg tracking-tight">AEGIS</span>
              <span className="hidden sm:block text-xs text-slate-500 leading-none mt-0.5">
                Autonomous Engine for Guided Incident Support
              </span>
            </div>
          </button>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            {/* Incidents */}
            <button
              onClick={onList}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors
                ${currentView === "list" ? "text-emerald-400 bg-emerald-500/10" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <span className="hidden sm:inline">Incidents</span>
            </button>

            {/* Dashboard */}
            <button
              onClick={onDashboard}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors
                ${currentView === "dashboard" ? "text-blue-400 bg-blue-500/10" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              <span className="hidden sm:inline">Dashboard</span>
            </button>

            {/* Security Test */}
            <button
              onClick={onSecurity}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors
                ${currentView === "security" ? "text-purple-400 bg-purple-500/10" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              <span className="hidden sm:inline">Security</span>
            </button>

            <button onClick={onNew} className="btn-primary text-sm ml-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span className="hidden sm:inline">New Incident</span>
              <span className="sm:hidden">New</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
