export function getCompletionStats(items) {
  const total = items.length
  const completed = items.filter((item) => item.status === 'bitti').length
  return {
    total,
    completed,
    percentage: total ? Math.round((completed / total) * 100) : null,
  }
}

export function getCurrentMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function getMonthlyCompletionStats(items, month = getCurrentMonth()) {
  const counts = { kitap: 0, film: 0, dizi: 0 }
  const started = items.filter((item) => item.start_date?.startsWith(month) && Object.hasOwn(counts, item.category))
  const completed = items.filter((item) => item.status === 'bitti' && item.end_date?.startsWith(month) && Object.hasOwn(counts, item.category))

  for (const item of completed) {
    counts[item.category] += 1
  }

  return { month, counts, started, completed }
}
