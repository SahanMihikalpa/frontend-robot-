/**
 * Layered-DAG layout for the skill dependency graph.
 * Pure TypeScript — no DOM/React — so the layering and cycle-detection logic
 * can be reasoned about (and unit-tested) independently of rendering.
 *
 * Edge convention matches the backend (`GET /api/v1/skills/graph`):
 *   edge.source = prerequisite skill id, edge.target = dependent skill id
 *   ("source must be learned before target").
 */

export const NODE_W = 170
export const NODE_H = 60
export const NODE_GAP_X = 40
export const LEVEL_GAP_Y = 110
export const MARGIN = 40

export interface GraphNodeLike {
  id: number
  name: string
  category?: string | null
  prerequisites: number[]
}

export interface GraphEdge {
  source: number
  target: number
}

export interface NodePosition {
  x: number
  y: number
  level: number
}

export interface LayoutResult {
  positions: Record<number, NodePosition>
  width: number
  height: number
  /** Node ids that never resolved a level — part of a cycle in the underlying data. */
  cyclic: number[]
}

/**
 * Assigns each node a "level" = the longest path from any root (a node with
 * no prerequisites), via Kahn's algorithm. Nodes within a level are laid out
 * left-to-right, grouped/sorted by category so related skills cluster together.
 */
export function computeLayeredLayout(nodes: GraphNodeLike[], edges: GraphEdge[]): LayoutResult {
  const nodeIds = new Set(nodes.map((n) => n.id))
  const dependentsOf: Record<number, number[]> = {}
  const indegree: Record<number, number> = {}

  for (const n of nodes) indegree[n.id] = 0

  for (const e of edges) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue
    if (!dependentsOf[e.source]) dependentsOf[e.source] = []
    dependentsOf[e.source].push(e.target)
    indegree[e.target] = (indegree[e.target] || 0) + 1
  }

  const remaining: Record<number, number> = { ...indegree }
  const level: Record<number, number> = {}
  const queue: number[] = []

  for (const n of nodes) {
    if (indegree[n.id] === 0) {
      level[n.id] = 0
      queue.push(n.id)
    }
  }

  let i = 0
  while (i < queue.length) {
    const u = queue[i]
    i += 1
    for (const v of dependentsOf[u] || []) {
      level[v] = Math.max(level[v] ?? 0, level[u] + 1)
      remaining[v] -= 1
      if (remaining[v] === 0) queue.push(v)
    }
  }

  // Any node that never reached indegree 0 is part of a cycle in the data
  // (shouldn't happen given the add-time cycle guard, but render defensively).
  const cyclic: number[] = []
  for (const n of nodes) {
    if (level[n.id] === undefined) {
      cyclic.push(n.id)
      level[n.id] = 0
    }
  }

  const byLevel = new Map<number, GraphNodeLike[]>()
  for (const n of nodes) {
    const L = level[n.id]
    if (!byLevel.has(L)) byLevel.set(L, [])
    byLevel.get(L)!.push(n)
  }
  for (const group of byLevel.values()) {
    group.sort((a, b) => {
      const ca = a.category || 'Uncategorized'
      const cb = b.category || 'Uncategorized'
      if (ca !== cb) return ca < cb ? -1 : 1
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
    })
  }

  const positions: Record<number, NodePosition> = {}
  let maxNodesInLevel = 0
  let maxLevel = 0
  for (const [L, group] of byLevel.entries()) {
    maxLevel = Math.max(maxLevel, L)
    maxNodesInLevel = Math.max(maxNodesInLevel, group.length)
    group.forEach((n, idx) => {
      positions[n.id] = {
        x: MARGIN + idx * (NODE_W + NODE_GAP_X),
        y: MARGIN + L * (NODE_H + LEVEL_GAP_Y),
        level: L,
      }
    })
  }

  const width = nodes.length === 0
    ? MARGIN * 2
    : MARGIN * 2 + maxNodesInLevel * (NODE_W + NODE_GAP_X) - NODE_GAP_X
  const height = nodes.length === 0
    ? MARGIN * 2
    : MARGIN * 2 + (maxLevel + 1) * (NODE_H + LEVEL_GAP_Y) - LEVEL_GAP_Y

  return { positions, width, height, cyclic }
}

/**
 * True if adding "prerequisiteId must be learned before skillId" would close
 * a cycle — i.e. skillId is already (directly or indirectly) a prerequisite
 * of prerequisiteId. Runs a forward BFS from skillId over existing edges.
 */
export function wouldCreateCycle(edges: GraphEdge[], skillId: number, prerequisiteId: number): boolean {
  if (skillId === prerequisiteId) return true

  const adj: Record<number, number[]> = {}
  for (const e of edges) {
    if (!adj[e.source]) adj[e.source] = []
    adj[e.source].push(e.target)
  }

  const visited = new Set<number>([skillId])
  const queue = [skillId]
  let i = 0
  while (i < queue.length) {
    const cur = queue[i]
    i += 1
    for (const next of adj[cur] || []) {
      if (next === prerequisiteId) return true
      if (!visited.has(next)) {
        visited.add(next)
        queue.push(next)
      }
    }
  }
  return false
}
