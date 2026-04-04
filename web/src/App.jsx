import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useState, useEffect } from 'react'
import { getStatus } from './api'

import Dashboard from './pages/Dashboard'
import CreatePost from './pages/CreatePost'
import Campaigns from './pages/Campaigns'
import Groups from './pages/Groups'
import Settings from './pages/Settings'

function Sidebar({ extensionConnected }) {
  const links = [
    { to: '/', icon: '📊', label: 'לוח בקרה' },
    { to: '/create', icon: '✏️', label: 'פוסט חדש' },
    { to: '/campaigns', icon: '📋', label: 'קמפיינים' },
    { to: '/groups', icon: '👥', label: 'קבוצות' },
    { to: '/settings', icon: '⚙️', label: 'הגדרות' },
  ]

  return (
    <aside className="w-56 shrink-0 glass border-l border-white/5 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-5 border-b border-white/5">
        <div className="text-2xl font-black text-white">
          POST<span className="text-blue-400">-IT</span>
        </div>
        <div className="text-xs text-slate-500 mt-0.5">פרסום חכם לפייסבוק</div>
      </div>

      {/* Extension Status */}
      <div className="px-4 py-3 border-b border-white/5">
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
          extensionConnected
            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          <span className={`w-2 h-2 rounded-full ${extensionConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          {extensionConnected ? 'תוסף מחובר' : 'תוסף לא מחובר'}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {links.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <span className="text-base">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 text-xs text-slate-600 border-t border-white/5">
        v1.0 · כל הזכויות שמורות
      </div>
    </aside>
  )
}

function AppInner() {
  const [extensionConnected, setExtensionConnected] = useState(false)

  useEffect(() => {
    const check = async () => {
      try {
        const { data } = await getStatus()
        setExtensionConnected(data.extension_connected)
      } catch {
        setExtensionConnected(false)
      }
    }
    check()
    const interval = setInterval(check, 8000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex min-h-screen">
      <Sidebar extensionConnected={extensionConnected} />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/create" element={<CreatePost />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
      <Toaster
        position="bottom-left"
        toastOptions={{
          style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.1)' },
          success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
    </BrowserRouter>
  )
}
