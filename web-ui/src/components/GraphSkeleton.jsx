// Placeholder shown while an idea's graph loads (Vercel cold starts can be slow).
// A root shell on the left with a few child shells fanning out to the right.
export default function GraphSkeleton() {
  return (
    <div className="graph-skeleton" aria-label="Loading map…">
      <div className="gs-col">
        <div className="skeleton gs-node gs-root" />
      </div>
      <div className="gs-col">
        <div className="skeleton gs-node" />
        <div className="skeleton gs-node" />
        <div className="skeleton gs-node" />
      </div>
      <div className="gs-col">
        <div className="skeleton gs-node" />
        <div className="skeleton gs-node" />
      </div>
    </div>
  )
}
