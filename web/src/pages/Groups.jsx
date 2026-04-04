import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getGroups, syncGroups, toggleGroup, deleteGroup, deleteAllGroups } from '../api'

export default function Groups() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [search, setSearch] = useState('')

  const load = async () => {
    try {
      const { data } = await getGroups()
      setGroups(data)
    } catch {
      toast.error('שגיאה בטעינת קבוצות')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const { data } = await syncGroups()
      toast.success(data.message || 'בקשת סנכרון נשלחה')
      setTimeout(load, 5000)
    } catch (e) {
      toast.error(e.response?.data?.error || 'שגיאה בסנכרון')
    } finally {
      setTimeout(() => setSyncing(false), 3000)
    }
  }

  const handleToggle = async (id) => {
    try {
      await toggleGroup(id)
      setGroups(prev => prev.map(g => g.id === id ? { ...g, active: g.active ? 0 : 1 } : g))
    } catch {
      toast.error('שגיאה')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('למחוק קבוצה זו?')) return
    try {
      await deleteGroup(id)
      setGroups(prev => prev.filter(g => g.id !== id))
      toast.success('הקבוצה נמחקה')
    } catch {
      toast.error('שגיאה במחיקה')
    }
  }

  const handleDeleteAll = async () => {
    if (!confirm(`למחוק את כל ${groups.length} הקבוצות?`)) return
    try {
      await deleteAllGroups()
      setGroups([])
      toast.success('כל הקבוצות נמחקו')
    } catch {
      toast.error('שגיאה')
    }
  }

  const filtered = groups.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase())
  )
  const activeCount = groups.filter(g => g.active).length

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">קבוצות פייסבוק</h1>
          <p className="text-slate-400 text-sm mt-1">
            {groups.length} קבוצות · {activeCount} פעילות
          </p>
        </div>
        <div className="flex gap-3">
          {groups.length > 0 && (
            <button
              onClick={handleDeleteAll}
              className="text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded-xl transition-all"
            >
              מחק הכל
            </button>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white px-4 py-2 rounded-xl font-medium transition-all text-sm shadow-lg shadow-blue-500/20"
          >
            {syncing ? '⏳ מסנכרן...' : '🔄 סנכרן מפייסבוק'}
          </button>
        </div>
      </div>

      {/* Sync instructions */}
      {groups.length === 0 && !loading && (
        <div className="glass rounded-2xl p-8 text-center mb-6">
          <div className="text-5xl mb-4">👥</div>
          <h3 className="text-white font-semibold mb-2">אין קבוצות עדיין</h3>
          <p className="text-slate-400 text-sm mb-4">
            לחץ "סנכרן מפייסבוק" כדי לייבא את כל הקבוצות שאתה חבר בהן
          </p>
          <div className="text-xs text-slate-500 space-y-1">
            <p>⚠️ ודא שהתוסף מותקן ו-Chrome פתוח עם פייסבוק</p>
          </div>
        </div>
      )}

      {groups.length > 0 && (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חפש קבוצה..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500">טוען...</div>
          ) : (
            <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
              {filtered.map(group => (
                <div key={group.id} className="flex items-center justify-between px-5 py-3 hover:bg-white/3 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${group.active ? 'bg-green-400' : 'bg-slate-600'}`} />
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{group.name}</p>
                      {group.fb_group_id && (
                        <p className="text-slate-600 text-xs truncate">/{group.fb_group_id}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggle(group.id)}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
                        group.active
                          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                          : 'bg-white/5 text-slate-500 hover:bg-white/10'
                      }`}
                    >
                      {group.active ? 'פעיל' : 'מושבת'}
                    </button>
                    <button
                      onClick={() => handleDelete(group.id)}
                      className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="p-6 text-center text-slate-500 text-sm">לא נמצאו קבוצות</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
