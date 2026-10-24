const DAY = 86400000
const dateNumber = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null
  const number = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(number) && new Date(number).toISOString().slice(0,10) === value ? number : null
}
export function leaseExpiryAlerts(properties, now = new Date()) {
  const today = dateNumber(new Intl.DateTimeFormat('en-CA', {timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(now))
  return properties.flatMap(property => (property.leases || []).filter(lease => lease.status === 'active').flatMap(lease => {
    const end = dateNumber(lease.end_date)
    if (end === null || today === null) return []
    const daysLeft = Math.round((end - today) / DAY)
    if (daysLeft > 80) return []
    return [{propertyId:property.id,leaseId:lease.id,propertyName:property.name,tenantName:lease.tenant_name || 'your tenant',endDate:lease.end_date,daysLeft}]
  })).sort((a,b) => a.daysLeft-b.daysLeft)
}
