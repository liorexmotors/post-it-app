import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getSettings, saveSettings, getSession, saveSession, deleteSession } from '../api'

export default function Settings() {
  const [form, setForm] = useState({
    claude_api_key: '',
    min_delay_seconds: '45',
    max_delay_seconds: '120',
    max_groups_per_day: '15',
    quiet_hours_start: '2',
    quiet_hours_end: '7',
  })
  const [hasApiKey, setHasApiKey] = useState(false)
  const [apiKeyMasked, setApiKeyMasked] = useState('')
  const [saving, setSaving] = useState(false)
  const [showKey, setShowKey] = useState(false)

  // Facebook Session
  const [sessionStatus, setSessionStatus] = useState(null) // null | { has_session, is_valid, last_verified }
  const [sessionCookies, setSessionCookies] = useState('')
  const [sessionUserAgent, setSessionUserAgent] = useState('')
  const [savingSession, setSavingSession] = useState(false)
  const [showCookieHelp, setShowCookieHelp] = useState(false)

  useEffect(() => {
    getSettings().then(({ data }) => {
      setHasApiKey(data.has_api_key)
      setApiKeyMasked(data.claude_api_key_masked || '')
      setForm(f => ({
        ...f,
        min_delay_seconds: data.min_delay_seconds || '45',
        max_delay_seconds: data.max_delay_seconds || '120',
        max_groups_per_day: data.max_groups_per_day || '15',
        quiet_hours_start: data.quiet_hours_start || '2',
        quiet_hours_end: data.quiet_hours_end || '7',
      }))
    }).catch(() => toast.error('שגיאה בטעינת הגדרות'))

    getSession().then(({ data }) => setSessionStatus(data)).catch(() => {})
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form }
      if (!payload.claude_api_key) delete payload.claude_api_key
      await saveSettings(payload)
      toast.success('ההגדרות נשמרו!')
      if (payload.claude_api_key) {
        setHasApiKey(true)
        setForm(f => ({ ...f, claude_api_key: '' }))
        setShowKey(false)
      }
    } catch {
      toast.error('שגיאה בשמירה')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveSession = async () => {
    if (!sessionCookies.trim()) {
      toast.error('הדבק את ה-Cookies JSON')
      return
    }
    setSavingSession(true)
    try {
      await saveSession({
        cookies: sessionCookies.trim(),
        user_agent: sessionUserAgent.trim() || undefined,
      })
      toast.success('Session נשמר ואומת בהצלחה! ✓')
      setSessionCookies('')
      const { data } = await getSession()
      setSessionStatus(data)
    } catch (err) {
      const msg = err.response?.data?.error || 'שגיאה בשמירת Session'
      toast.error(msg)
    } finally {
      setSavingSession(false)
    }
  }

  const handleDeleteSession = async () => {
    await deleteSession().catch(() => {})
    setSessionStatus({ has_session: false })
    toast.success('Session נמחק')
  }

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const cookieScript = `copy(JSON.stringify([...document.cookie.split(';').map(c=>{const[n,...v]=c.trim().split('=');return{name:n,value:v.join('='),domain:'.facebook.com',path:'/',secure:true}})]))
// Then paste with Ctrl+V`

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">הגדרות</h1>
        <p className="text-slate-400 text-sm mt-1">הגדרות מערכת ופרמטרים</p>
      </div>

      {/* Facebook Session */}
      <div className="glass rounded-2xl p-5 mb-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-white">🔐 חיבור לפייסבוק</h2>
          {sessionStatus?.has_session && (
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full border border-green-500/20">
              ✓ מחובר
            </span>
          )}
        </div>
        <p className="text-slate-400 text-xs mb-4">
          כדי לפרסם בפייסבוק מהענן, המערכת צריכה את ה-Cookies שלך מהדפדפן
        </p>

        {sessionStatus?.has_session ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
              <div className="text-green-400 text-sm flex-1">
                ✅ Session פעיל — המערכת יכולה לפרסם בפייסבוק
                {sessionStatus.last_verified && (
                  <div className="text-xs text-slate-500 mt-0.5">
                    אומת לאחרונה: {new Date(sessionStatus.last_verified).toLocaleString('he-IL')}
                  </div>
                )}
              </div>
              <button
                onClick={handleDeleteSession}
                className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg transition-colors"
              >
                מחק
              </button>
            </div>
            <button
              onClick={() => setSessionStatus(null)}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              עדכן Session חדש →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Help toggle */}
            <button
              onClick={() => setShowCookieHelp(!showCookieHelp)}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
            >
              {showCookieHelp ? '▲' : '▼'} איך מקבלים את ה-Cookies?
            </button>

            {showCookieHelp && (
              <div className="bg-slate-800/50 border border-white/10 rounded-xl p-4 text-xs text-slate-300 space-y-2">
                <p className="font-semibold text-white">שלבים לקבלת Facebook Cookies:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-400">
                  <li>פתח <span className="text-white">Chrome</span> והיכנס לפייסבוק בצורה רגילה</li>
                  <li>התקן את התוסף <span className="text-white font-medium">"Cookie Editor"</span> מה-Chrome Web Store</li>
                  <li>לחץ על אייקון התוסף בזמן שאתה בfacebook.com</li>
                  <li>לחץ <span className="text-white">"Export"</span> → <span className="text-white">"Export as JSON"</span></li>
                  <li>הדבק את ה-JSON בשדה למטה</li>
                </ol>
                <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400">
                  ⚠️ ה-Cookies הם סיסמה לחשבונך. אל תשתף אותם עם אף אחד!
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Cookies JSON (מ-Cookie Editor)</label>
              <textarea
                value={sessionCookies}
                onChange={e => setSessionCookies(e.target.value)}
                placeholder='[{"name":"c_user","value":"...","domain":".facebook.com",...}]'
                rows={4}
                dir="ltr"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 text-xs font-mono resize-none"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">User-Agent (אופציונלי)</label>
              <input
                type="text"
                value={sessionUserAgent}
                onChange={e => setSessionUserAgent(e.target.value)}
                placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64) ..."
                dir="ltr"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 text-xs font-mono"
              />
              <p className="text-slate-500 text-xs mt-1">השאר ריק לשימוש ב-User-Agent ברירת מחדל</p>
            </div>

            <button
              onClick={handleSaveSession}
              disabled={savingSession || !sessionCookies.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
            >
              {savingSession ? (
                <>
                  <span className="animate-spin">⏳</span>
                  מאמת ושומר... (עשוי לקחת 15-20 שניות)
                </>
              ) : '🔑 שמור ואמת Session'}
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* AI Key */}
        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold text-white mb-1">✨ Claude AI</h2>
          <p className="text-slate-400 text-xs mb-4">
            מפתח API לשדרוג טקסט עם AI. קבל מפתח בחינם ב-console.anthropic.com
          </p>

          {hasApiKey && !showKey && (
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2.5 text-green-400 text-sm font-mono">
                {apiKeyMasked}
              </div>
              <button type="button" onClick={() => setShowKey(true)}
                className="text-xs text-slate-400 hover:text-white px-3 py-2 bg-white/5 rounded-xl transition-colors">
                החלף
              </button>
            </div>
          )}

          {(!hasApiKey || showKey) && (
            <input
              type="password"
              value={form.claude_api_key}
              onChange={e => set('claude_api_key', e.target.value)}
              placeholder="sk-ant-..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm font-mono"
            />
          )}

          {!hasApiKey && (
            <p className="text-yellow-400/80 text-xs mt-2">
              ⚠️ ללא מפתח API, פיצ׳ר שדרוג הטקסט עם AI לא יעבוד
            </p>
          )}
        </div>

        {/* Anti-block */}
        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold text-white mb-1">🛡️ מניעת חסימות</h2>
          <p className="text-slate-400 text-xs mb-4">
            הגדרות לדמיית התנהגות אנושית ומניעת חסימת חשבון
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">עיכוב מינימלי (שניות)</label>
              <input
                type="number" min="10" max="300"
                value={form.min_delay_seconds}
                onChange={e => set('min_delay_seconds', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">עיכוב מקסימלי (שניות)</label>
              <input
                type="number" min="10" max="600"
                value={form.max_delay_seconds}
                onChange={e => set('max_delay_seconds', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">מקס׳ קבוצות ביום</label>
              <input
                type="number" min="1" max="50"
                value={form.max_groups_per_day}
                onChange={e => set('max_groups_per_day', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300">
            💡 מומלץ: עיכוב 45-120 שניות ועד 15 קבוצות ביום למניעת חסימה
          </div>
        </div>

        {/* Quiet hours */}
        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold text-white mb-1">🌙 שעות שקט</h2>
          <p className="text-slate-400 text-xs mb-4">בשעות אלו המערכת לא תשלח פוסטים</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">מ-שעה</label>
              <select
                value={form.quiet_hours_start}
                onChange={e => set('quiet_hours_start', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">עד שעה</label>
              <select
                value={form.quiet_hours_end}
                onChange={e => set('quiet_hours_end', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-all shadow-lg shadow-blue-500/20"
        >
          {saving ? '⏳ שומר...' : '💾 שמור הגדרות'}
        </button>
      </form>
    </div>
  )
}
