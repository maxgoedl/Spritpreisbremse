export const policyDate = '2026-04-01'
// Germany introduced its own Spritpreisbremse around the start of May 2026.
// From this date on Germany is no longer a clean control group, so the
// diff-in-diff effect is only estimated over the window in which Austria
// alone had a price brake: [policyDate, germanyPolicyDate).
export const germanyPolicyDate = '2026-05-01'

function mean(values) {
  if (!values.length) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function variance(values, avg) {
  if (values.length <= 1 || avg == null) return null
  return values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (values.length - 1)
}

export function estimateDidDailyFE(rows, cfg) {
  const comparable = rows
    .filter((row) => row[cfg.atKey] != null && row[cfg.deKey] != null)
    .map((row) => ({
      date: row.date,
      spread: row[cfg.atKey] - row[cfg.deKey],
    }))

  const pre = comparable
    .filter((row) => row.date < policyDate)
    .map((row) => row.spread)
  // Only count days where Austria had the brake but Germany did not yet —
  // once Germany also intervenes, the AT−DE spread stops isolating AT's effect.
  const post = comparable
    .filter((row) => row.date >= policyDate && row.date < germanyPolicyDate)
    .map((row) => row.spread)

  if (pre.length < 2 || post.length < 2) {
    return {
      nDays: comparable.length,
      nPre: pre.length,
      nPost: post.length,
      beta: null,
      ciLow: null,
      ciHigh: null,
    }
  }

  const meanPre = mean(pre)
  const meanPost = mean(post)
  const beta = meanPost - meanPre

  const varPre = variance(pre, meanPre)
  const varPost = variance(post, meanPost)

  const pooledVar =
    (((pre.length - 1) * varPre) + ((post.length - 1) * varPost)) /
    (pre.length + post.length - 2)

  const se = Math.sqrt(pooledVar * (1 / pre.length + 1 / post.length))
  const z = 1.96

  return {
    nDays: comparable.length,
    nPre: pre.length,
    nPost: post.length,
    beta,
    ciLow: beta - z * se,
    ciHigh: beta + z * se,
  }
}
