export function localToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function itemYearError(year, currentYear = new Date().getFullYear()) {
  if (year === '' || year == null) return ''
  if (!/^\d{1,4}$/.test(String(year)) || Number(year) < 1) return 'Geçerli bir yıl gir.'
  return Number(year) > currentYear ? `Yıl ${currentYear} yılından büyük olamaz.` : ''
}

export function displayDate(value) {
  return value ? value.split('-').reverse().join('/') : ''
}

export function maskDate(value) {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/')
}

export function dateInputError(value, { min, max } = {}) {
  const [day = '', month = '', year = ''] = value.split('/')
  if (Number(day) > 31 || day === '00') return 'Gün 01–31 arasında olmalı.'
  if (Number(month) > 12 || month === '00') return 'Ay 01–12 arasında olmalı.'
  if (year === '0000') return 'Yıl 0000 olamaz.'
  if (day && Number(month) >= 1 && Number(month) <= 12) {
    const leap = year.length < 4 || (Number(year) % 4 === 0 && (Number(year) % 100 !== 0 || Number(year) % 400 === 0))
    const limit = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][Number(month) - 1]
    if (Number(day) > limit) return `Bu ay için gün en fazla ${limit} olabilir.`
  }
  if (day.length === 2 && month.length === 2 && year.length === 4) {
    const iso = parseDate(value)
    if (max && iso > max) return 'Tarih bugünden sonra olamaz.'
    if (min && iso < min) return 'Bitiş tarihi başlangıç tarihinden önce olamaz.'
  }
  return ''
}

export function parseDate(value) {
  if (!value) return null
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) throw new Error('Tarihi dd/mm/yyyy biçiminde tam olarak gir.')
  const [day, month, year] = value.split('/').map(Number)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) throw new Error('Geçerli bir gün, ay ve yıl gir.')
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function validateItemDates({ start_date, end_date }, today = localToday()) {
  for (const value of [start_date, end_date]) {
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || parseDate(displayDate(value)) !== value)) throw new Error('Geçerli bir tarih gir.')
  }
  if (start_date && start_date > today) throw new Error('Başlangıç tarihi bugünden sonra olamaz.')
  if (end_date && end_date > today) throw new Error('Bitiş tarihi bugünden sonra olamaz.')
  if (start_date && end_date && end_date < start_date) throw new Error('Bitiş tarihi başlangıç tarihinden önce olamaz.')
}

export function datesFromForm(form) {
  const dates = { start_date: parseDate(form.start_date), end_date: parseDate(form.end_date) }
  validateItemDates(dates)
  return dates
}
