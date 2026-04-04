import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { createPost, getGroups, getCampaigns, enhanceText } from '../api'

const DAYS = [
  { value: 0, label: 'א׳' },
  { value: 1, label: 'ב׳' },
  { value: 2, label: 'ג׳' },
  { value: 3, label: 'ד׳' },
  { value: 4, label: 'ה׳' },
  { value: 5, label: 'ו׳' },
  { value: 6, label: 'ש׳' },
]

const AI_STYLES = [
  { value: 'friendly', label: 'חברותי' },
  { value: 'professional', label: 'מקצועי' },
  { value: 'sales', label: 'שיווקי' },
  { value: 'informative', label: 'אינפורמטיבי' },
]

export default function CreatePost() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [mediaFile, setMediaFile] = useState(null)
  const [mediaPreview, setMediaPreview] = useState(null)
  const [scheduledAt, setScheduledAt] = useState('')
  const [recurring, setRecurring] = useState('none')
  const [recurringDays, setRecurringDays] = useState([])
  const [campaignId, setCampaignId] = useState('')
  const [selectedGroups, setSelectedGroups] = useState([])
  const [groups, setGroups] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [groupSearch, setGroupSearch] = useState('')
  const [aiStyle, setAiStyle] = useState('friendly')
  const [aiLoading, setAiLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getGroups({ active: 1 }).then(r => setGroups(r.data)).catch(() => {})
    getCampaigns().then(r => setCampaigns(r.data)).catch(() => {})
  }, [])

  const onDrop = useCallback((files) => {
    const file = files[0]
    if (!file) return
    setMediaFile(file)
    const url = URL.createObjectURL(file)
    setMediaPreview({ url, type: file.type.startsWith('video') ? 'video' : 'image' })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [], 'video/*': [] },
    maxFiles: 1,
    maxSize: 200 * 1024 * 1024,
  })

  const removeMedia = () => {
    setMediaFile(null)
    if (mediaPreview) URL.revokeObjectURL(mediaPreview.url)
    setMediaPreview(null)
  }

  const handleAiEnhance = async () => {
    if (!content.trim()) return toast.error('כתוב טקסט קודם')
    setAiLoading(true)
    try {
      const { data } = await enhanceText(content, aiStyle)
      setContent(data.enhanced)
      toast.success('הטקסט שודרג בהצלחה!')
    } catch (e) {
      toast.error(e.response?.data?.error || 'שגיאה בשדרוג AI')
    } finally {
      setAiLoading(false)
    }
  }

  const toggleGroup = (id) => {
    setSelectedGroups(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    )
  }

  const toggleDay = (day) => {
    setRecurringDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(groupSearch.toLowerCase())
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!content.trim()) return toast.error('תוכן הפוסט הוא שדה חובה')
    if (selectedGroups.length === 0) return toast.error('יש לבחור לפחות קבוצה אחת')

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('content', content.trim())
      if (title) fd.append('title', title)
      if (campaignId) fd.append('campaign_id', campaignId)
      if (scheduledAt) fd.append('scheduled_at', scheduledAt)
      if (recurring !== 'none') {
        fd.append('recurring', recurring)
        if (recurring === 'custom') {
          fd.append('recurring_days', JSON.stringify(recurringDays))
        }
      }
      fd.append('group_ids', JSON.stringify(selectedGroups))
      if (mediaFile) fd.append('media', mediaFile)

      await createPost(fd)
      toast.success('הפוסט נוצר בהצלחה!')
      navigate('/')
    } catch (e) {
      toast.error(e.response?.data?.error || 'שגיאה ביצירת הפוסט')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">יצירת פוסט חדש</h1>
        <p className="text-slate-400 text-sm mt-1">מלא את הפרטים ובחר קבוצות לפרסום</p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column - content */}
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">שם לזיהוי (אופציונלי)</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="למשל: קמפיין קיץ - נדל״ן"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">תוכן הפוסט *</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="כתוב את הפוסט כאן..."
              rows={7}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm resize-none"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-slate-500">{content.length} תווים</span>
              <div className="flex items-center gap-2">
                <select
                  value={aiStyle}
                  onChange={e => setAiStyle(e.target.value)}
                  className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-slate-300 focus:outline-none"
                >
                  {AI_STYLES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAiEnhance}
                  disabled={aiLoading || !content.trim()}
                  className="flex items-center gap-1.5 text-xs bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/20 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                >
                  {aiLoading ? '⏳ מעבד...' : '✨ שדרג עם AI'}
                </button>
              </div>
            </div>
          </div>

          {/* Media upload */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">תמונה / וידאו (אופציונלי)</label>
            {!mediaPreview ? (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  isDragActive
                    ? 'border-blue-400 bg-blue-500/10'
                    : 'border-white/10 hover:border-white/20 hover:bg-white/3'
                }`}
              >
                <input {...getInputProps()} />
                <div className="text-3xl mb-2">🖼️</div>
                <p className="text-slate-400 text-sm">גרור קובץ לכאן או לחץ לבחירה</p>
                <p className="text-slate-600 text-xs mt-1">JPG, PNG, GIF, MP4 · עד 200MB</p>
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden border border-white/10">
                {mediaPreview.type === 'image' ? (
                  <img src={mediaPreview.url} alt="preview" className="w-full max-h-48 object-cover" />
                ) : (
                  <video src={mediaPreview.url} className="w-full max-h-48" controls />
                )}
                <button
                  type="button"
                  onClick={removeMedia}
                  className="absolute top-2 left-2 bg-red-500/80 hover:bg-red-500 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm transition-colors"
                >
                  ✕
                </button>
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">
                  {mediaPreview.type === 'image' ? '🖼️ תמונה' : '🎬 וידאו'}
                </div>
              </div>
            )}
          </div>

          {/* Campaign */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">קמפיין (אופציונלי)</label>
            <select
              value={campaignId}
              onChange={e => setCampaignId(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 text-sm"
            >
              <option value="">ללא קמפיין</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Right column - schedule + groups */}
        <div className="space-y-4">
          {/* Schedule */}
          <div className="glass rounded-2xl p-4 space-y-3">
            <h3 className="font-semibold text-white text-sm">⏰ תזמון</h3>

            <div>
              <label className="block text-xs text-slate-400 mb-1">תאריך ושעה</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">השאר ריק לשמירה בלבד (ללא תזמון)</p>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-2">חזרה על הפוסט</label>
              <div className="grid grid-cols-4 gap-2">
                {[['none','חד פעמי'],['daily','יומי'],['weekly','שבועי'],['custom','ימים מותאמים']].map(([val, lbl]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setRecurring(val)}
                    className={`text-xs py-2 px-1 rounded-lg font-medium transition-all ${
                      recurring === val
                        ? 'bg-blue-600 text-white'
                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {recurring === 'custom' && (
              <div>
                <label className="block text-xs text-slate-400 mb-2">בחר ימים</label>
                <div className="flex gap-1.5 flex-wrap">
                  {DAYS.map(d => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleDay(d.value)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                        recurringDays.includes(d.value)
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/5 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Group selector */}
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white text-sm">👥 בחר קבוצות</h3>
              <span className="text-xs text-blue-400">{selectedGroups.length} נבחרו</span>
            </div>

            {groups.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-slate-500 text-sm">אין קבוצות עדיין</p>
                <p className="text-slate-600 text-xs mt-1">לחץ "סנכרן קבוצות" בתוסף Chrome</p>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={groupSearch}
                  onChange={e => setGroupSearch(e.target.value)}
                  placeholder="חפש קבוצה..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm mb-2"
                />
                <div className="flex gap-2 mb-2">
                  <button type="button" onClick={() => setSelectedGroups(filteredGroups.map(g => g.id))}
                    className="text-xs text-blue-400 hover:text-blue-300">
                    בחר הכל
                  </button>
                  <span className="text-slate-600">·</span>
                  <button type="button" onClick={() => setSelectedGroups([])}
                    className="text-xs text-slate-400 hover:text-slate-300">
                    נקה
                  </button>
                </div>
                <div className="space-y-1 max-h-52 overflow-y-auto">
                  {filteredGroups.map(g => (
                    <label
                      key={g.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                        selectedGroups.includes(g.id)
                          ? 'bg-blue-600/20 border border-blue-500/30'
                          : 'hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedGroups.includes(g.id)}
                        onChange={() => toggleGroup(g.id)}
                        className="accent-blue-500"
                      />
                      <span className="text-sm text-white truncate">{g.name}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-all shadow-lg shadow-blue-500/20 text-sm"
          >
            {submitting ? '⏳ שומר...' : scheduledAt ? '📅 תזמן פוסט' : '💾 שמור פוסט'}
          </button>
        </div>
      </form>
    </div>
  )
}
