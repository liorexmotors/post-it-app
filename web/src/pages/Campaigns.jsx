import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getCampaigns, createCampaign, deleteCampaign, getPosts, sendPostNow, deletePost } from '../api'

const STATUS_LABELS = {
  pending: { label: 'ממתין', color: 'bg-slate-500/20 text-slate-300' },
  scheduled: { label: 'מתוזמן', color: 'bg-blue-500/20 text-blue-300' },
  sending: { label: 'שולח...', color: 'bg-yellow-500/20 text-yellow-300' },
  sent: { label: 'נשלח ✓', color: 'bg-green-500/20 text-green-300' },
  failed: { label: 'נכשל', color: 'bg-red-500/20 text-red-300' },
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([])
  const [posts, setPosts] = useState([])
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [newName, setNewName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const [cRes, pRes] = await Promise.all([getCampaigns(), getPosts({ limit: 100 })])
      setCampaigns(cRes.data)
      setPosts(pRes.data)
    } catch {
      toast.error('שגיאה בטעינה')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      await createCampaign({ name: newName.trim() })
      setNewName('')
      setShowCreate(false)
      toast.success('קמפיין נוצר!')
      load()
    } catch {
      toast.error('שגיאה')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('למחוק קמפיין זה? הפוסטים ישמרו.')) return
    try {
      await deleteCampaign(id)
      if (selectedCampaign?.id === id) setSelectedCampaign(null)
      toast.success('נמחק')
      load()
    } catch {
      toast.error('שגיאה')
    }
  }

  const handleSendNow = async (id) => {
    try {
      await sendPostNow(id)
      toast.success('נשלח לתוסף!')
      load()
    } catch (e) {
      toast.error(e.response?.data?.error || 'שגיאה')
    }
  }

  const handleDeletePost = async (id) => {
    if (!confirm('למחוק פוסט זה?')) return
    try {
      await deletePost(id)
      toast.success('נמחק')
      load()
    } catch {
      toast.error('שגיאה')
    }
  }

  const filteredPosts = selectedCampaign
    ? posts.filter(p => p.campaign_id === selectedCampaign.id)
    : posts

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">קמפיינים ופוסטים</h1>
          <p className="text-slate-400 text-sm mt-1">{posts.length} פוסטים בסך הכל</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all"
        >
          + קמפיין חדש
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="glass rounded-2xl p-4 mb-4 flex gap-3">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="שם הקמפיין..."
            autoFocus
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
          />
          <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all">
            צור
          </button>
          <button type="button" onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white px-3 py-2 text-sm">
            ביטול
          </button>
        </form>
      )}

      <div className="flex gap-4">
        {/* Campaigns sidebar */}
        <div className="w-48 shrink-0 space-y-1">
          <button
            onClick={() => setSelectedCampaign(null)}
            className={`w-full text-right px-3 py-2.5 rounded-xl text-sm transition-all ${
              !selectedCampaign ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            <div className="font-medium">כל הפוסטים</div>
            <div className="text-xs opacity-70">{posts.length} פוסטים</div>
          </button>
          {campaigns.map(c => (
            <div
              key={c.id}
              onClick={() => setSelectedCampaign(c)}
              className={`group w-full text-right px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer ${
                selectedCampaign?.id === c.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium truncate">{c.name}</div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(c.id) }}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs"
                >✕</button>
              </div>
              <div className="text-xs opacity-70">{c.post_count} פוסטים</div>
            </div>
          ))}
        </div>

        {/* Posts list */}
        <div className="flex-1 glass rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500">טוען...</div>
          ) : filteredPosts.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-slate-400">אין פוסטים כאן</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredPosts.map(post => {
                const status = STATUS_LABELS[post.status] || STATUS_LABELS.pending
                return (
                  <div key={post.id} className="px-5 py-4 hover:bg-white/3 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                            {status.label}
                          </span>
                          {post.media_type && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                              {post.media_type === 'image' ? '🖼️' : '🎬'}
                            </span>
                          )}
                          {post.recurring && post.recurring !== 'none' && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300">🔄</span>
                          )}
                          {post.campaign_name && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300">
                              {post.campaign_name}
                            </span>
                          )}
                        </div>
                        <p className="text-white text-sm font-medium truncate">
                          {post.title || post.content.slice(0, 70)}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          {post.scheduled_at && (
                            <span>📅 {new Date(post.scheduled_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}</span>
                          )}
                          <span>👥 {post.sent_groups}/{post.total_groups}</span>
                          <span>{new Date(post.created_at).toLocaleDateString('he-IL')}</span>
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
                          onClick={() => handleDeletePost(post.id)}
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
    </div>
  )
}
