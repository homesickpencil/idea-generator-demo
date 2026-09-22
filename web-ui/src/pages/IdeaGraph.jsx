import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import ReactFlow, { Background, Controls } from 'reactflow'
import 'reactflow/dist/style.css'
import { getIdea, expand } from '../api.js'
import { layout } from '../graph/layout.js'
import { colorFor } from '../graph/nodeColors.js'
import MindNode from '../graph/MindNode.jsx'
import NodeDrawer from '../components/NodeDrawer.jsx'
import GraphSkeleton from '../components/GraphSkeleton.jsx'
import Toast from '../components/Toast.jsx'

// Defined once at module scope (React Flow warns if this is recreated per render).
const nodeTypes = { mind: MindNode }

export default function IdeaGraph() {
  const { id } = useParams()
  const [title, setTitle] = useState('')
  const [originalIdea, setOriginalIdea] = useState('')
  const [rawNodes, setRawNodes] = useState([])
  const [rawEdges, setRawEdges] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingNode, setLoadingNode] = useState(null)
  const [full, setFull] = useState(false)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    setLoading(true)
    getIdea(id)
      .then((data) => {
        setTitle(data.title || '')
        setOriginalIdea(data.original_idea || '')
        setRawNodes(Array.isArray(data.nodes) ? data.nodes : [])
        setRawEdges(Array.isArray(data.edges) ? data.edges : [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const handleExpand = useCallback(
    async (nodeId, direction) => {
      setLoadingNode(nodeId)
      setError('')
      try {
        const res = await expand(id, nodeId, direction)
        const added = res.new_nodes || []
        setRawNodes((prev) => [...prev, ...added])
        setRawEdges((prev) => [...prev, ...(res.new_edges || [])])
        if (added.length) setToast(`Added ${added.length} idea${added.length > 1 ? 's' : ''}`)
      } catch (e) {
        if (e.message.toLowerCase().includes('full')) setFull(true)
        setError(e.message)
      } finally {
        setLoadingNode(null)
      }
    },
    [id],
  )

  const flowNodes = useMemo(() => {
    return layout(rawNodes, rawEdges).map((n) => ({
      id: n.id,
      type: 'mind',
      position: n.position,
      sourcePosition: 'right',
      targetPosition: 'left',
      zIndex: openMenuId === n.id ? 1000 : 0,
      data: {
        label: n.label,
        category: n.category,
        color: colorFor(n.category),
        isRoot: !n.parent_id,
        directions: n.directions || [],
        loading: loadingNode === n.id,
        disabled: full,
        menuOpen: openMenuId === n.id,
        onToggleMenu: (nid) => setOpenMenuId((cur) => (cur === nid ? null : nid)),
        onCloseMenu: () => setOpenMenuId(null),
        onExpand: handleExpand,
        onOpenDetail: setSelectedId,
      },
    }))
  }, [rawNodes, rawEdges, loadingNode, full, handleExpand, openMenuId])

  const selectedNode = rawNodes.find((n) => n.id === selectedId) || null

  return (
    <div className="graph-page">
      <header>
        <Link to="/">← All ideas</Link>
        <h2>{title || (loading ? 'Loading…' : '')}</h2>
        <span className="count">{rawNodes.length}/50</span>
      </header>

      {error && <div className="banner">{error}</div>}

      <div className="flow">
        {loading ? (
          <GraphSkeleton />
        ) : (
          <ReactFlow
            nodes={flowNodes}
            edges={rawEdges}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.2}
            onPaneClick={() => { setSelectedId(null); setOpenMenuId(null) }}
          >
            <Background gap={22} color="#20242e" />
            <Controls showInteractive={false} />
          </ReactFlow>
        )}

        {selectedNode && (
          <NodeDrawer
            node={selectedNode}
            nodes={rawNodes}
            originalIdea={originalIdea}
            onClose={() => setSelectedId(null)}
            onSelect={setSelectedId}
          />
        )}
      </div>

      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  )
}
