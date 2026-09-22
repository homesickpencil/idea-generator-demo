// Give each category a stable colour so nodes read as grouped, not uniform.
// Categories are free-form strings from the AI, so we hash them into a fixed palette.
const PALETTE = [
  '#6ea8fe', // blue
  '#5fd0a8', // green
  '#f5a97f', // orange
  '#c9a0ff', // violet
  '#f191c0', // pink
  '#67c9d6', // teal
]

export const ROOT_COLOR = '#f5c451' // gold — reserved for the root idea

export function colorFor(category) {
  if (!category) return '#8a90a0' // neutral for uncategorised
  let h = 0
  for (let i = 0; i < category.length; i++) h = (h * 31 + category.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}
