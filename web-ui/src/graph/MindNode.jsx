import { memo, useEffect, useRef, useState } from 'react'
import { Handle, Position } from 'reactflow'

// Fixed thinking lenses, always offered alongside the AI-suggested adjacent ideas.
// The label is shown; the prompt is the hidden steer sent to the backend.
const LENSES = [
  { label: 'Broader', prompt: 'the broader theme or category this idea belongs to' },
  { label: 'More specific', prompt: 'a more specific, narrower version of this idea' },
  { label: 'Analogy', prompt: 'a parallel idea from a different field, by analogy' },
]

// A node in the left-to-right tree.
// - Hover  -> a selectable ring (it lifts slightly) so you know it's clickable.
// - Click body -> opens the detail drawer.
// - Click the dot -> a directions menu (AI suggestions + "Narrow down"); the menu is
//   controlled by the graph so only one is open and it layers above siblings.
// - Drag anywhere on the body to reposition; `.nodrag` keeps the dot/menu interactive.
function MindNode({ id, data }) {
  const [narrow, setNarrow] = useState('')
  const wrapRef = useRef(null)
  const open = data.menuOpen

  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) data.onCloseMenu()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, data])

  function pick(direction) {
    data.onCloseMenu()
    setNarrow('')
    data.onExpand(id, direction)
  }
  function submitNarrow(e) {
    e.preventDefault()
    const t = narrow.trim()
    if (t) pick(t)
  }

  const directions = data.directions || []

  return (
    <div
      ref={wrapRef}
      className={`mind-node${data.isRoot ? ' is-root' : ''}${data.dim ? ' is-dim' : ''}`}
      style={data.isRoot ? undefined : { '--node-color': data.color }}
    >
      {!data.isRoot && <Handle type="target" position={Position.Left} />}

      <div className="mind-node-body" onClick={() => data.onOpenDetail(id)}>
        {data.isRoot && <span className="root-badge">Idea</span>}
        <span className="mind-node-label">{data.label}</span>
        {!data.isRoot && data.category && (
          <span className="mind-node-cat"><i className="cat-dot" />{data.category}</span>
        )}
      </div>

      {data.loading && (
        <div className="mind-node-loading"><span className="spinner" /> Generating…</div>
      )}

      {!data.disabled && !data.loading && (
        <button
          className="expand-dot nodrag"
          title="Expand"
          onClick={(e) => { e.stopPropagation(); data.onToggleMenu(id) }}
        />
      )}

      <Handle type="source" position={Position.Right} />

      {open && (
        <div className="dir-menu nodrag" onClick={(e) => e.stopPropagation()}>
          <form className="dir-narrow" onSubmit={submitNarrow}>
            <input
              autoFocus
              value={narrow}
              onChange={(e) => setNarrow(e.target.value)}
              placeholder="Narrow down…"
            />
            <button type="submit" className="dir-go" disabled={!narrow.trim()} title="Go">→</button>
          </form>
          {directions.map((d) => (
            <button key={d} className="dir-item" onClick={() => pick(d)}>{d}</button>
          ))}
          <div className="dir-sep">lenses</div>
          {LENSES.map((l) => (
            <button key={l.label} className="dir-item dir-lens" onClick={() => pick(l.prompt)}>
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default memo(MindNode)
