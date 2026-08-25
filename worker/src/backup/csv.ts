export type CsvValue = string | number | boolean | null | undefined

const csvCell = (value: CsvValue): string => {
  if (value === null || value === undefined) return ''
  const raw = String(value)
  const text = typeof value === 'string' && /^[\t ]*[=+@-]/u.test(raw) ? `'${raw}` : raw
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export const createCsv = (headers: readonly string[], rows: readonly (readonly CsvValue[])[]): string => {
  const width = headers.length
  if (rows.some((row) => row.length !== width)) throw new Error('CSV row width does not match its header.')
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(','))
  return `\uFEFF${lines.join('\r\n')}\r\n`
}
