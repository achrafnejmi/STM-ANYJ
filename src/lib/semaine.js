// Helpers de date vanilla pour la grille linéaire (aucune lib de date dans le
// projet). Les dates manipulées sont des chaînes "YYYY-MM-DD" (format produit
// par stm-import.js). On utilise systématiquement les méthodes UTC de Date,
// car `new Date("YYYY-MM-DD")` parse en UTC minuit — mélanger UTC et local
// décalerait le jour affiché selon le fuseau du navigateur.

const JOURS_COURTS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

export function aujourdHuiISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function ajouterJours(dateISO, n) {
  const d = new Date(`${dateISO}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function lundiDeLaSemaine(dateISO) {
  const jour = new Date(`${dateISO}T00:00:00Z`).getUTCDay() // 0=dimanche..6=samedi
  const decalage = jour === 0 ? -6 : 1 - jour
  return ajouterJours(dateISO, decalage)
}

export function joursDeLaSemaine(lundiISO) {
  return Array.from({ length: 7 }, (_, i) => ajouterJours(lundiISO, i))
}

export function formaterJourCourt(dateISO) {
  const d = new Date(`${dateISO}T00:00:00Z`)
  return `${JOURS_COURTS[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function formaterDateLongue(dateISO) {
  const d = new Date(`${dateISO}T00:00:00Z`)
  return `${d.getUTCDate()} ${MOIS_COURTS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

export function formaterPlageSemaine(lundiISO) {
  const dimancheISO = ajouterJours(lundiISO, 6)
  const d1 = new Date(`${lundiISO}T00:00:00Z`)
  const d2 = new Date(`${dimancheISO}T00:00:00Z`)
  if (d1.getUTCMonth() === d2.getUTCMonth() && d1.getUTCFullYear() === d2.getUTCFullYear()) {
    return `${d1.getUTCDate()} – ${d2.getUTCDate()} ${MOIS_COURTS[d2.getUTCMonth()]} ${d2.getUTCFullYear()}`
  }
  return `${formaterDateLongue(lundiISO)} – ${formaterDateLongue(dimancheISO)}`
}

export function heureEnMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function minutesEnHeure(minutes) {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
