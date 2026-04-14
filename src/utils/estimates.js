export const policyDate = '2026-04-01'

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
      post: row.date >= policyDate ? 1 : 0,
      spread: row[cfg.atKey] - row[cfg.deKey],
    }))

  const pre = comparable.filter((row) => row.post === 0).map((row) => row.spread)
  const post = comparable.filter((row) => row.post === 1).map((row) => row.spread)

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
