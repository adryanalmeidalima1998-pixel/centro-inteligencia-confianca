export const clampScore = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0))

export function rankPercentile(value, values = [], higherIsBetter = true) {
  const present = item => item !== null && item !== undefined && item !== '' && item !== '-' && Number.isFinite(Number(item))
  if (!present(value)) return null
  const numericValue = Number(value)
  const valid = values.filter(present).map(Number).sort((a, b) => a - b)
  if (!valid.length) return null
  const lower = valid.filter(item => item < numericValue).length
  const equal = valid.filter(item => item === numericValue).length
  const raw = ((lower + equal * .5) / valid.length) * 100
  return higherIsBetter ? raw : 100 - raw
}

export function adaptiveRolePool(players = [], role = {}) {
  const candidates = players.filter(player => (role.suitability ? role.suitability(player) : 1) > 0)
  if (!candidates.length) return { candidates:[], minimumMinutes:0, maxMinutes:0, factor:0, sampleTarget:0 }

  const maxMinutes = Math.max(...candidates.map(player => Number(player.minutos) || 0))
  const targetSize = role.slot === 'GK' ? 5 : 10
  let hardFloor = 90
  if (maxMinutes >= 720) hardFloor = role.slot === 'GK' ? 360 : 270
  else if (maxMinutes >= 450) hardFloor = role.slot === 'GK' ? 270 : 180
  else if (maxMinutes >= 270) hardFloor = role.slot === 'GK' ? 180 : 135

  const factors = [.40,.35,.30,.25,.20]
  for (const factor of factors) {
    const threshold = Math.max(hardFloor, Math.round((maxMinutes * factor) / 45) * 45)
    const eligible = candidates.filter(player => (Number(player.minutos) || 0) >= threshold)
    if (eligible.length >= targetSize) {
      return {
        candidates:eligible,
        minimumMinutes:threshold,
        maxMinutes:Math.round(maxMinutes),
        factor,
        sampleTarget:Math.max(threshold * 2.15, Math.min(maxMinutes * .78, role.slot === 'GK' ? 1080 : 990)),
      }
    }
  }

  const floorEligible = candidates.filter(player => (Number(player.minutos) || 0) >= hardFloor)
  const selected = floorEligible.length ? floorEligible : candidates
  return {
    candidates:selected,
    minimumMinutes:floorEligible.length ? hardFloor : 0,
    maxMinutes:Math.round(maxMinutes),
    factor:maxMinutes ? (floorEligible.length ? hardFloor / maxMinutes : 0) : 0,
    sampleTarget:Math.max((floorEligible.length ? hardFloor : 90) * 2.15, Math.min(maxMinutes * .78, role.slot === 'GK' ? 1080 : 990)),
  }
}

export function reliabilityFromSample({ minutes = 0, sampleTarget = 900, coverage = 1, suitability = 1 }) {
  const minuteShare = clampScore((Number(minutes) || 0) / Math.max(1, sampleTarget), 0, 1)
  const coverageShare = clampScore(Number(coverage), 0, 1)
  const suitabilityShare = clampScore(Number(suitability), 0, 1)
  // O desempenho continua sendo o centro da nota. Amostra/cobertura não dão pontos;
  // apenas controlam quanto um percentil extremo pode se afastar da média.
  return clampScore(.47 + .34 * Math.sqrt(minuteShare) + .14 * coverageShare + .05 * suitabilityShare, .47, 1)
}

export function shrinkPercentile(percentile, reliability) {
  if (!Number.isFinite(Number(percentile))) return null
  const rel = clampScore(reliability, 0, 1)
  return 50 + (Number(percentile) - 50) * rel
}

export function displayScoutingScore(internalScore) {
  // Escala editorial do CIC: mantém a ordem estatística, mas evita que um top-8
  // de uma posição pareça mediano apenas porque os percentis foram promediados.
  // 50 interno ~= 70 exibido; 80 interno ~= 85; 100 interno = 95.
  return clampScore(45 + clampScore(internalScore) * .50, 45, 95)
}

export function calibrateRoleCandidates(candidates = []) {
  if (!candidates.length) return []

  const adjustedValues = candidates.map(candidate => {
    const coverage = clampScore((Number(candidate._coverage) || 0) / 100, 0, 1)
    const suitability = clampScore((Number(candidate._suitability) || 0) / 100, 0, 1)
    const reliability = reliabilityFromSample({
      minutes:candidate.minutos,
      sampleTarget:candidate._sample_target || Math.max(540, Number(candidate._sample_minimum || 0) * 2.15),
      coverage,
      suitability,
    })
    const adjustedPerformance = shrinkPercentile(candidate._raw_performance ?? candidate._performance_score ?? candidate._score, reliability)
    return { candidate, reliability, adjustedPerformance }
  })

  const pool = adjustedValues.map(item => item.adjustedPerformance).filter(Number.isFinite)

  return adjustedValues.map(item => {
    const rolePct = rankPercentile(item.adjustedPerformance, pool, true) ?? 50
    const rankAdjusted = shrinkPercentile(rolePct, item.reliability)
    const suitability = clampScore(Number(item.candidate._suitability) || 100)
    const internal = item.adjustedPerformance * .72 + rankAdjusted * .23 + suitability * .05
    const score = displayScoutingScore(internal)
    return {
      ...item.candidate,
      _score:Number(score.toFixed(1)),
      _internal_score:Number(internal.toFixed(1)),
      _performance_score:Number(item.adjustedPerformance.toFixed(1)),
      _role_percentile:Number(rolePct.toFixed(1)),
      _sample_confidence:Math.round(item.reliability * 100),
      _reliability:Number(item.reliability.toFixed(3)),
      _provisional:item.reliability < .64,
    }
  }).sort((a, b) =>
    b._score - a._score ||
    b._performance_score - a._performance_score ||
    b._sample_confidence - a._sample_confidence ||
    (Number(b.minutos) || 0) - (Number(a.minutos) || 0)
  )
}
