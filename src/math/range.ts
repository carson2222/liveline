import type { LivelinePoint } from '../types'

/**
 * Compute visible Y range from data points + current value.
 * Returns { min, max } with margin applied.
 *
 * `minRangeOverride` replaces the built-in absolute minimum range floor
 * (0.4, or 0.04 with `exaggerate`). Bounded domains — e.g. probability
 * charts in [0, 1] — need a floor proportional to the domain, otherwise
 * quiet data gets pinned to `mid ± floor/2` and the moving midpoint
 * shifts the whole line whenever the live value ticks.
 */
export function computeRange(
  visible: LivelinePoint[],
  currentValue: number,
  referenceValue?: number | number[],
  exaggerate?: boolean,
  minRangeOverride?: number,
): { min: number; max: number } {
  let targetMin = Infinity
  let targetMax = -Infinity

  for (const p of visible) {
    if (p.value < targetMin) targetMin = p.value
    if (p.value > targetMax) targetMax = p.value
  }

  if (currentValue < targetMin) targetMin = currentValue
  if (currentValue > targetMax) targetMax = currentValue

  // Include reference line(s) so they're always visible
  if (referenceValue !== undefined) {
    const refs = Array.isArray(referenceValue) ? referenceValue : [referenceValue]
    for (const rv of refs) {
      if (rv < targetMin) targetMin = rv
      if (rv > targetMax) targetMax = rv
    }
  }

  const rawRange = targetMax - targetMin
  const marginFactor = exaggerate ? 0.01 : 0.12
  // Default floor only engages on perfectly flat data (`||` on 0), which
  // makes the first tiny move collapse the range from the floor to
  // ~rawRange — a huge lerped zoom ("breathing"). An explicit override is
  // a TRUE floor: the range never drops below it, so flat → barely-moving
  // transitions are continuous.
  const proportional = rawRange * (exaggerate ? 0.02 : 0.1)
  const minRange = minRangeOverride != null
    ? Math.max(proportional, minRangeOverride)
    : (proportional || (exaggerate ? 0.04 : 0.4))

  if (rawRange < minRange) {
    const mid = (targetMin + targetMax) / 2
    targetMin = mid - minRange / 2
    targetMax = mid + minRange / 2
  } else {
    const margin = rawRange * marginFactor
    targetMin -= margin
    targetMax += margin
  }

  return { min: targetMin, max: targetMax }
}
