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

// Journée d'antenne (RG-19/20 du cahier) : 06:00 → 06:00 le lendemain. La
// `date` stockée d'une transmission est celle du jour d'antenne, pas du jour
// calendaire de l'heure d'horloge — un programme entre 00:00 et 05:59
// appartient à la journée d'antenne de la veille.
export const DEBUT_JOURNEE_ANTENNE = 6 * 60 // 360 = 06:00
export const FIN_JOURNEE_ANTENNE = DEBUT_JOURNEE_ANTENNE + 24 * 60 // 1800 = 06:00 le lendemain

// Position d'une heure HH:MM sur l'axe de LA journée d'antenne à laquelle elle
// appartient (pas celle de son jour calendaire) : une heure avant 06:00 est
// comprise comme la fin de la journée d'antenne précédente (ex. "01:00" → 1500,
// pas 60). `minutesEnHeure` fait déjà l'inverse (modulo 24h) pour l'affichage.
export function minutesDepuisDebutAntenne(hhmm) {
  const m = heureEnMinutes(hhmm)
  return m < DEBUT_JOURNEE_ANTENNE ? m + 24 * 60 : m
}

// Dates ISO entre deux bornes (incluses) dont le jour de semaine figure dans
// `joursCoches` (0=lundi..6=dimanche) — pour l'onglet Répéter de l'Inspecteur.
export function joursSelonJoursSemaine(debutISO, finISO, joursCoches) {
  const coches = new Set(joursCoches)
  const resultat = []
  let d = debutISO
  while (d <= finISO) {
    const jourLundi0 = (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7 // 0=lundi..6=dimanche
    if (coches.has(jourLundi0)) resultat.push(d)
    d = ajouterJours(d, 1)
  }
  return resultat
}
