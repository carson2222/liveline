import type { LivelinePalette, ChartLayout } from '../types'

export interface MultiSeriesHoverEntry {
  color: string
  label: string
  value: number
}

export function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  palette: LivelinePalette,
  hoverX: number,
  hoverValue: number,
  hoverTime: number,
  formatValue: (v: number) => string,
  formatTime: (t: number) => string,
  scrubOpacity: number,
  tooltipY?: number,
  liveDotX?: number,
  tooltipOutline?: boolean,
) {
  if (scrubOpacity < 0.01) return

  const { h, pad, toY } = layout
  const y = toY(hoverValue)

  // Vertical line (solid, like Kalshi)
  ctx.save()
  ctx.globalAlpha = scrubOpacity * 0.5
  ctx.strokeStyle = palette.crosshairLine
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(hoverX, pad.top)
  ctx.lineTo(hoverX, h - pad.bottom)
  ctx.stroke()
  ctx.restore()

  // Dot at intersection — solid accent color, always fully opaque.
  // Radius scales with scrubOpacity for smooth appear/disappear.
  const dotRadius = 4 * Math.min(scrubOpacity * 3, 1)
  if (dotRadius > 0.5) {
    ctx.globalAlpha = 1
    ctx.beginPath()
    ctx.arc(hoverX, y, dotRadius, 0, Math.PI * 2)
    ctx.fillStyle = palette.line
    ctx.fill()
  }

  // Top label: "$VALUE - TIME" — fixed at top, moves horizontally only
  // Skip text for small containers (text is ~200px wide)
  if (scrubOpacity < 0.1 || layout.w < 300) return

  const valueText = formatValue(hoverValue)
  const timeText = formatTime(hoverTime)
  const separator = '  /  '

  ctx.save()
  ctx.globalAlpha = scrubOpacity
  ctx.font = '400 13px "SF Mono", Menlo, monospace'

  const valueW = ctx.measureText(valueText).width
  const sepW = ctx.measureText(separator).width
  const timeW = ctx.measureText(timeText).width
  const totalW = valueW + sepW + timeW

  // Center on crosshair, clamp to chart bounds
  // Right edge of tooltip text aligns with the right edge of the live dot circle
  let tx = hoverX - totalW / 2
  const minX = pad.left + 4
  const dotRightEdge = liveDotX != null ? liveDotX + 7 : layout.w - pad.right
  const maxX = dotRightEdge - totalW
  if (tx < minX) tx = minX
  if (tx > maxX) tx = maxX

  const ty = pad.top + (tooltipY ?? 14) + 10 // offset from top

  ctx.textAlign = 'left'

  // Text outline for readability against the chart
  if (tooltipOutline) {
    ctx.strokeStyle = palette.tooltipBg
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.strokeText(valueText, tx, ty)
    ctx.strokeText(separator + timeText, tx + valueW, ty)
  }

  // Value (dark)
  ctx.fillStyle = palette.tooltipText
  ctx.fillText(valueText, tx, ty)

  // Separator + time (lighter)
  ctx.fillStyle = palette.gridLabel
  ctx.fillText(separator + timeText, tx + valueW, ty)

  ctx.restore()
}

/** Multi-series crosshair: vertical line + inline text at top, matching single-series style. */
export function drawMultiCrosshair(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  palette: LivelinePalette,
  hoverX: number,
  hoverTime: number,
  entries: MultiSeriesHoverEntry[],
  formatValue: (v: number) => string,
  formatTime: (t: number) => string,
  scrubOpacity: number,
  tooltipY?: number,
  tooltipOutline?: boolean,
  liveDotX?: number,
) {
  if (scrubOpacity < 0.01 || entries.length === 0) return

  const { h, pad, toY } = layout

  // Vertical line (solid, matching single-series)
  ctx.save()
  ctx.globalAlpha = scrubOpacity * 0.5
  ctx.strokeStyle = palette.crosshairLine
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(hoverX, pad.top)
  ctx.lineTo(hoverX, h - pad.bottom)
  ctx.stroke()
  ctx.restore()

  // Dots at each series intersection — radius scales with scrubOpacity,
  // alpha stays at 1 (matching single-series crosshair dot behavior)
  const dotRadius = 4 * Math.min(scrubOpacity * 3, 1)
  if (dotRadius > 0.5) {
    ctx.globalAlpha = 1
    for (const entry of entries) {
      const y = toY(entry.value)
      ctx.beginPath()
      ctx.arc(hoverX, y, dotRadius, 0, Math.PI * 2)
      ctx.fillStyle = entry.color
      ctx.fill()
    }
  }

  if (scrubOpacity < 0.1 || layout.w < 200) return

  // ── Per-series pill labels that track the lines ──
  // Each series gets a rounded pill ("● Label 17.8%") anchored at its line's
  // y position next to the crosshair. Pills are collision-resolved so they
  // never overlap — they spread apart vertically while staying as close to
  // their lines as possible (Polymarket-style).
  void tooltipY
  void tooltipOutline
  void liveDotX

  const PILL_H = 22
  const PILL_GAP = 3
  const PILL_PAD_X = 8
  const PILL_OFFSET = 12 // gap between pill edge and the crosshair line
  const BAR_W = 3 // series color bar inside the pill
  const BAR_H = 12
  const MAX_LABEL_PX = 110

  const labelFont = '500 12px system-ui, -apple-system, sans-serif'
  const valueFont = '600 12px "SF Mono", Menlo, monospace'
  const timeFont = '400 12px "SF Mono", Menlo, monospace'

  ctx.save()
  ctx.globalAlpha = scrubOpacity
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'

  // ── Time label — fixed at the top, follows the crosshair ──
  const timeText = formatTime(hoverTime)
  ctx.font = timeFont
  const timeW = ctx.measureText(timeText).width
  let timeX = hoverX - timeW / 2
  if (timeX < pad.left + 4) timeX = pad.left + 4
  if (timeX > layout.w - pad.right - timeW - 4) timeX = layout.w - pad.right - timeW - 4
  const timeY = pad.top >= 14 ? pad.top - 6 : pad.top + 8
  ctx.fillStyle = palette.gridLabel
  ctx.fillText(timeText, timeX, timeY)

  // ── Build pills ──
  type Pill = { label: string; valueText: string; color: string; y: number; labelW: number; valueW: number; w: number }
  const truncateLabel = (text: string): string => {
    ctx.font = labelFont
    if (ctx.measureText(text).width <= MAX_LABEL_PX) return text
    let out = text
    while (out.length > 1 && ctx.measureText(`${out}…`).width > MAX_LABEL_PX) {
      out = out.slice(0, -1)
    }
    return `${out}…`
  }

  const pills: Pill[] = entries.map((e) => {
    const label = e.label ? truncateLabel(e.label) : ''
    const valueText = formatValue(e.value)
    ctx.font = labelFont
    const labelW = label ? ctx.measureText(label).width : 0
    ctx.font = valueFont
    const valueW = ctx.measureText(valueText).width
    const w = PILL_PAD_X + BAR_W + 6 + (label ? labelW + 6 : 0) + valueW + PILL_PAD_X
    return { label, valueText, color: e.color, y: toY(e.value), labelW, valueW, w }
  })

  // ── Collision resolution — keep pills near their lines, never overlapping ──
  pills.sort((a, b) => a.y - b.y)
  const minY = pad.top + PILL_H / 2 + 2
  const maxY = h - pad.bottom - PILL_H / 2 - 2
  // Forward sweep: push down so each pill clears the one above
  let cursor = minY
  for (const p of pills) {
    p.y = Math.min(Math.max(p.y, cursor), maxY)
    cursor = p.y + PILL_H + PILL_GAP
  }
  // Backward sweep: if the stack overflowed the bottom, push back up
  let ceiling = maxY
  for (let i = pills.length - 1; i >= 0; i--) {
    const p = pills[i]
    p.y = Math.min(p.y, ceiling)
    ceiling = p.y - PILL_H - PILL_GAP
  }

  // ── Side — left of the crosshair, flipping right near the left edge ──
  const maxPillW = pills.reduce((m, p) => Math.max(m, p.w), 0)
  const flipRight = hoverX - PILL_OFFSET - maxPillW < pad.left + 2

  // ── Draw ──
  for (const p of pills) {
    const px = flipRight ? hoverX + PILL_OFFSET : hoverX - PILL_OFFSET - p.w
    const py = p.y - PILL_H / 2

    // Pill background
    ctx.beginPath()
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(px, py, p.w, PILL_H, 6)
    } else {
      ctx.rect(px, py, p.w, PILL_H)
    }
    ctx.fillStyle = palette.tooltipBg
    ctx.fill()
    ctx.strokeStyle = palette.gridLine
    ctx.lineWidth = 1
    ctx.stroke()

    // Series color bar
    ctx.beginPath()
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(px + PILL_PAD_X, p.y - BAR_H / 2, BAR_W, BAR_H, 1.5)
    } else {
      ctx.rect(px + PILL_PAD_X, p.y - BAR_H / 2, BAR_W, BAR_H)
    }
    ctx.fillStyle = p.color
    ctx.fill()

    // Label + value
    let textX = px + PILL_PAD_X + BAR_W + 6
    if (p.label) {
      ctx.font = labelFont
      ctx.fillStyle = palette.tooltipText
      ctx.fillText(p.label, textX, p.y)
      textX += p.labelW + 6
    }
    ctx.font = valueFont
    ctx.fillStyle = palette.tooltipText
    ctx.fillText(p.valueText, textX, p.y)
  }

  ctx.restore()
}
