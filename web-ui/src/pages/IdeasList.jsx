import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getIdeas, createIdea, deleteIdea, setTelegramWebhook, getWebhookInfo } from '../api.js'
import Toast from '../components/Toast.jsx'

export default function IdeasList() {
  const [ideas, setIdeas] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [toast, setToast] = useState('')

  // selection / delete
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [confirming, setConfirming] = useState(false)

  // telegram status
  const [tg, setTg] = useState({ connected: false, busy: true })

  const navigate = useNavigate()

  useEffect(() => {
    getIdeas()
      .then((data) => setIdeas(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
    getWebhookInfo()
      .then((info) => setTg({ connected: !!info.connected, busy: false }))
      .catch(() => setTg({ connected: false, busy: false }))
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!text.trim()) return
    setCreating(true)
    setError('')
    try {
      const { idea_id } = await createIdea(text.trim())
      navigate(`/idea/${idea_id}`)
    } catch (e) {
      setError(e.message)
      setCreating(false)
    }
  }

  async function connectTelegram() {
    setTg((s) => ({ ...s, busy: true }))
    try {
      await setTelegramWebhook()
      const info = await getWebhookInfo()
      setTg({ connected: !!info.connected, busy: false })
      setToast(info.connected ? 'Telegram connected' : 'Set, but not verified')
    } catch (e) {
      setTg((s) => ({ ...s, busy: false }))
      setToast(`Telegram: ${e.message}`)
    }
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function exitSelect() {
    setSelecting(false)
    setConfirming(false)
    setSelected(new Set())
  }

  async function deleteSelected() {
    const ids = [...selected]
    try {
      await Promise.all(ids.map((id) => deleteIdea(id)))
      setIdeas((prev) => prev.filter((i) => !selected.has(i.id)))
      setToast(`Deleted ${ids.length} project${ids.length > 1 ? 's' : ''}`)
    } catch (e) {
      setToast(`Delete failed: ${e.message}`)
    }
    exitSelect()
  }

  function onCardClick(id) {
    if (selecting) toggleSelect(id)
    else navigate(`/idea/${id}`)
  }

  return (
    <div className="page">
      <div className="topbar">
        <div>
          <h1>💡 Idea Explorer</h1>
          <p className="subtitle">Start with an idea. Branch into the ideas around it.</p>
        </div>
        <div className="actions">
          {tg.connected ? (
            <span className="pill pill-ok" title="Webhook points at this backend">● Telegram connected</span>
          ) : (
            <button className="ghost" onClick={connectTelegram} disabled={tg.busy}>
              {tg.busy ? 'Checking…' : 'Connect Telegram'}
            </button>
          )}
          {ideas.length > 0 && (
            <button className="ghost" onClick={() => (selecting ? exitSelect() : setSelecting(true))}>
              {selecting ? 'Cancel' : 'Select'}
            </button>
          )}
        </div>
      </div>

      <form className="new-idea" onSubmit={handleCreate}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter an idea or topic to explore…"
          disabled={creating}
        />
        <button disabled={creating}>{creating ? 'Generating…' : 'Create'}</button>
      </form>

      {selecting && (
        <div className="select-bar">
          <span>{selected.size} selected</span>
          {confirming ? (
            <>
              <span className="muted">Delete {selected.size}?</span>
              <button className="danger" onClick={deleteSelected}>Delete</button>
              <button className="ghost sm" onClick={() => setConfirming(false)}>No</button>
            </>
          ) : (
            <button className="danger" disabled={!selected.size} onClick={() => setConfirming(true)}>
              Delete
            </button>
          )}
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="cards">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card skeleton-card">
              <div className="skeleton line lg" />
              <div className="skeleton line sm" />
            </div>
          ))
        ) : (
          <>
            {ideas.map((idea) => (
              <button
                key={idea.id}
                className={`card${selecting ? ' selectable' : ''}${selected.has(idea.id) ? ' selected' : ''}`}
                onClick={() => onCardClick(idea.id)}
              >
                {selecting && <span className="check">{selected.has(idea.id) ? '✓' : ''}</span>}
                <h3>{idea.title}</h3>
                <span>{idea.node_count} nodes</span>
              </button>
            ))}
            {ideas.length === 0 && !error && <p className="empty">No ideas yet. Create one above.</p>}
          </>
        )}
      </div>

      {creating && (
        <div className="overlay">
          <div className="overlay-card">
            <span className="spinner lg" />
            <p>Exploring your idea…</p>
            <span className="muted">Naming it and finding the first related branches.</span>
          </div>
        </div>
      )}

      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  )
}
