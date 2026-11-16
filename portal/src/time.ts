const seoulDateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

export function formatPortalTime(value: string | null | undefined) {
  if (!value) return '-'
  const timestamp = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return value
  const parts = Object.fromEntries(seoulDateTime.formatToParts(date).map(({ type, value: part }) => [type, part]))
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`
}
