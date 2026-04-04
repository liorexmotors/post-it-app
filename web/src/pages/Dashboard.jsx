import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getStats, getPosts, sendPostNow, deletePost } from '../api'
import toast from 'react-hot-toast'

function StatCard({ icon, label, value, color = 'blue' }) {
  const colors = {
    blue: 'from-blue-600/20 to-blue-500/10 border-blue-500/20 text-blue-400',
    green: 'from-green-600/20 to-green-500/10 border-green-500/20 text-green-400',
    purple: 'from-purple-600/20 to-purple-500/10 border-purple-500/20 text-purple-400',
    orange: 'from-orange-600/20 to-orange-500/10 border-orange-500/20 text-orange-400',
  }
  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-2xl p-5`}>
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-3xl font-bold text-white mb-1">{value ?? '—'}</div>
      <div className="text-sm text-slate-400">{label}</div>
    </div>
  )
}

const STATUS_LABELS = {
  pending: { label: 'ממתין', color: 'bg-slate-500/20 text-slate-300' },
  scheduled: { label: 'מתוזמן', color: 'bg-blue-500/20 text-blue-300' },
  sending: { label: 'שולח...', color: 'bg-yellow-500/20 text-yellow-300' },
  sent: { label: 'נשלח ✓', color: 'bg-green-500/20 text-green-300' },
  failed: { label: 'נכשל', color: 'bg-red-500/20 text-red-300' },
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const [statsRes, postsRes] = await Promise.all([
        getStats(),
        getPosts({ limit: 10 })
      ])
      setStats(statsRes.data)
      setPosts(postsRes.data)
    } catch {
      toast.error('שגיאה בטעינת הנתונים')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSendNow = async (id) => {
    try {
      await sendPostNow(id)
      toast.success('הפוסט נשלח לתוסף לפרסום!')
      load()
    } catch (e) {
      toast.error(e.response?.data?.error || 'שגיאה בשליחה')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('למחוק את הפוסט?')) return
    try {
      await deletePost(id)
      toast.success('הפוסט נמחק')
      load()
    } catch {
      toast.error('שגיאה במחיקה')
    }
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">לוח בקרה</h1>
          <p className="text-slate-400 text-sm mt-1">סיכום פעילות המערכת</p>
        </div>
        <Link
          to="/create"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-medium transition-all text-sm shadow-lg shadow-blue-500/20"
        >
          <span>+</span> פוסט חדש
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="📤" label="נשלחו היום" value={stats?.sent_today} color="green" />
        <StatCard icon="📅" label="מתוזמנים" value={stats?.scheduled} color="blue" />
        <StatCard icon="👥" label="קבוצות פעילות" value={stats?.total_groups} color="purple" />
        <StatCard icon="✉️" label="סה״כ נשלחו" value={stats?.total_sent} color="orange" />
      </div>

      {/* Recent posts */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="font-semibold text-white">פוסטים אחרונים</h2>
          <Link to="/campaigns" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
            כל הפוסטים ←
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">טוען...</div>
        ) : posts.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-4xl mb-3">✏️</div>
            <p className="text-slate-400 mb-4">עדיין אין פוסטים</p>
            <Link to="/create" className="text-blue-400 hover:underline text-sm">צור פוסט ראשון →</Link>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {posts.map(post => {
              const status = STATUS_LABELS[post.status] || STATUS_LABELS.pending
              return (
                <div key={post.id} className="px-5 py-4 hover:bg-white/3 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                          {status.label}
                        </span>
                        {post.media_type && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                            {post.media_type === 'image' ? '🖼️ תמונה' : '🎬 וידאו'}
                          </span>
                        )}
                        {post.recurring && post.recurring !== 'none' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300">
                            🔄 מחזורי
                          </span>
                        )}
                      </div>
                      <p className="text-white text-sm font-medium truncate">
                        {post.title || post.content.slice(0, 60) + (post.content.length > 60 ? '...' : '')}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        {post.scheduled_at && (
                          <span>📅 {new Date(post.scheduled_at).toLocaleString('he-IL')}</span>
                        )}
                        <span>👥 {post.sent_groups}/{post.total_groups} קבוצות</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(post.status === 'pending' || post.status === 'scheduled') && (
                        <button
                          onClick={() => handleSendNow(post.id)}
                          className="text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          שלח עכשיו
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        מחק
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
