import { colorFor, ROOT_COLOR } from '../graph/nodeColors.js'

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

// Slim detail panel. One lead line, lineage crumbs, and a compact branch list —
// no walls of labelled text. All from loaded data, no extra API calls.
export default function NodeDrawer({ node, nodes, originalIdea, onClose, onSelect }) {
  if (!node) return null

  const isRoot = !node.parent_id
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
  const parent = node.parent_id ? byId[node.parent_id] : null
  const children = nodes.filter((n) => n.parent_id === node.id)
  const color = isRoot ? ROOT_COLOR : colorFor(node.category)

  const lineage = []
  let cur = node
  while (cur) {
    lineage.unshift(cur)
    cur = cur.parent_id ? byId[cur.parent_id] : null
  }

  return (
    <aside className="drawer">
      <div className="drawer-head">
        <h3><i className="cat-dot lg" style={{ background: color }} />{node.label}</h3>
        <button className="drawer-close" onClick={onClose} title="Close">✕</button>
      </div>

      {lineage.length > 1 && (
        <nav className="lineage">
          {lineage.map((n, i) => (
            <span key={n.id}>
              {i > 0 && <span className="sep">›</span>}
              <button
                className={`crumb${n.id === node.id ? ' current' : ''}`}
                onClick={() => onSelect(n.id)}
              >
                {n.label}
              </button>
            </span>
          ))}
        </nav>
      )}

      {isRoot ? (
        <p className="drawer-lead">“{originalIdea || node.label}”</p>
      ) : (
        <p className="drawer-lead">
          {cap(node.relation) || 'A branch'}
          {parent && (
            <> of <button className="link" onClick={() => onSelect(parent.id)}>{parent.label}</button></>
          )}.
        </p>
      )}

      <div className="drawer-branches">
        <span className="drawer-label">
          {children.length ? `Branches · ${children.length}` : 'No branches yet'}
        </span>
        {children.length ? (
          <ul>
            {children.map((ch) => (
              <li key={ch.id}>
                <i className="cat-dot" style={{ background: colorFor(ch.category) }} />
                <button className="link" onClick={() => onSelect(ch.id)}>{ch.label}</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Click the dot to explore related ideas.</p>
        )}
      </div>
    </aside>
  )
}
