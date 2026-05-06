import type { LivelinePalette, ChartLayout, ReferenceLine } from '../types'

export function drawReferenceLine(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  palette: LivelinePalette,
  ref: ReferenceLine,
  rightAligned?: boolean,
) {
  const { w, h, pad, toY, chartW } = layout
  const y = toY(ref.value)

  if (y < pad.top - 10 || y > h - pad.bottom + 10) return

  const lineColor = ref.color ?? palette.refLine
  const labelColor = ref.color ?? palette.refLabel
  const label = ref.label ?? ''

  if (label) {
    if (rightAligned) {
      // Right-aligned label for multi-reference scenarios — avoids overlap
      ctx.font = '500 10px system-ui, sans-serif'
      const textW = ctx.measureText(label).width
      const labelX = w - pad.right - textW - 8

      ctx.strokeStyle = lineColor
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(pad.left, y)
      ctx.lineTo(labelX - 4, y)
      ctx.stroke()
      ctx.setLineDash([])

      const prevAlpha = ctx.globalAlpha
      ctx.globalAlpha = Math.min(prevAlpha, 0.7)
      ctx.fillStyle = labelColor
      ctx.textAlign = 'right'
      ctx.fillText(label, w - pad.right - 6, y - 4)
      ctx.globalAlpha = prevAlpha
    } else {
      // Centered label — original single-reference behavior
      ctx.font = '500 11px system-ui, sans-serif'
      const textW = ctx.measureText(label).width
      const centerX = pad.left + chartW / 2
      const gapPad = 8

      // Line left of text
      ctx.strokeStyle = lineColor
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(pad.left, y)
      ctx.lineTo(centerX - textW / 2 - gapPad, y)
      ctx.stroke()

      // Line right of text
      ctx.beginPath()
      ctx.moveTo(centerX + textW / 2 + gapPad, y)
      ctx.lineTo(w - pad.right, y)
      ctx.stroke()

      // Label
      ctx.fillStyle = labelColor
      ctx.textAlign = 'center'
      ctx.fillText(label, centerX, y + 4)
    }
  } else {
    // Full line, no label
    ctx.strokeStyle = lineColor
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(pad.left, y)
    ctx.lineTo(w - pad.right, y)
    ctx.stroke()
    ctx.setLineDash([])
  }
}
