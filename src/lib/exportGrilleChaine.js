// Export conventionnel par chaîne (P41b) — bundle normalisé, pur (aucune
// dépendance xlsx/jspdf/docx : l'écran GrilleLineaire.jsx possède les appels
// aux 3 bibliothèques, même découpage que exportListeTransmissions.js).
//
// Le gabarit (src/lib/gabaritsGrilleChaine.js) porte `debutJourneeMinutes` :
// il ne sert QU'ICI, pour trier les lignes d'un jour dans l'ordre d'antenne de
// la chaîne (07:00 Al Aoula/Al Maghribia, 12:00 Tamazight) — pas de
// modification du modèle interne (06:00).
import { heureEnMinutes, formaterDateLongue } from './semaine.js'
import { heureHMSEnSecondes } from './planMedia.js'

// Noms marocains des mois (شتنبر, نونبر, دجنبر… — pas les mois standard) pour
// coller aux grilles réelles (Al Aoula .docx, Al Maghribia .pdf).
const JOURS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const MOIS_AR_MAGHREB = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو',
  'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر',
]

export function dateArabeMaghrebine(dateISO) {
  const d = new Date(`${dateISO}T00:00:00Z`)
  return `${JOURS_AR[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS_AR_MAGHREB[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

// Minutes d'horloge → minutes depuis le début d'antenne PARAMÉTRÉ. Copie locale
// et paramétrée du pivot de semaine.js (une heure avant le début appartient à
// la fin de la journée) — volontairement isolée pour ne pas toucher le moteur.
function minutesDepuisDebut(hhmm, debutMinutes) {
  const m = heureEnMinutes((hhmm ?? '00:00').slice(0, 5))
  return m < debutMinutes ? m + 1440 : m
}

function normaliserHMS(heure) {
  const p = (heure ?? '').split(':')
  const h = (p[0] ?? '00').padStart(2, '0')
  const m = (p[1] ?? '00').padStart(2, '0')
  const s = (p[2] ?? '00').padStart(2, '0')
  return `${h}:${m}:${s}`
}

function heurePoint(heure) {
  return (heure ?? '').slice(0, 5).replace(':', '.')
}

function dureeHMS(secondes) {
  const s = Math.max(0, Math.round(secondes))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function jjmmaaaa(dateISO) {
  const [a, m, j] = dateISO.split('-')
  return `${j}/${m}/${a}`
}

// Titre affiché : "Titre — ÉP. NN : sous-titre" (sous-titre = titre de
// l'épisode ; il n'existe pas de champ `sous_titre` dans le modèle). `ar`
// bascule sur titre_ar / episode.titre_ar avec repli sur les champs FR.
function composerTitre(programme, episode, numeroEp, ar) {
  const base = (ar ? programme?.titre_ar || programme?.titre : programme?.titre) || '—'
  const ep = numeroEp != null ? ` — ÉP. ${String(numeroEp).padStart(2, '0')}` : ''
  const sous = ar ? episode?.titre_ar || episode?.titre : episode?.titre
  return `${base}${ep}${sous ? ` : ${sous}` : ''}`
}

// `natureParDiffusionId` : Map<id, 'Diffusion'|'Rediffusion'> issue de
// historique.js:annoterNature (calculée par l'écran sur TOUTES les diffusions
// de la chaîne). Seule la rediffusion est rendue (« إعادة ») ; « مباشر » /
// « جديد » ne sont pas dérivables du modèle → colonne Observations vide sinon.
export function construireDonneesGrilleConventionnelle({
  chaineNom,
  chaineNomAr,
  gabarit,
  jours,
  diffusionsParJour,
  programmesParId,
  episodesParId,
  natureParDiffusionId,
}) {
  const debut = gabarit.debutJourneeMinutes
  const point = gabarit.formatHeure === 'HM_POINT'

  const joursBlocs = jours.map((dateISO) => {
    const lignes = [...(diffusionsParJour.get(dateISO) ?? [])]
      .sort((a, b) => minutesDepuisDebut(a.heure_debut, debut) - minutesDepuisDebut(b.heure_debut, debut))
      .map((d) => {
        const programme = programmesParId.get(d.programme_id)
        const episode = episodesParId?.get(d.episode_id)
        const dureeSec = heureHMSEnSecondes(d.heure_fin) - heureHMSEnSecondes(d.heure_debut)
        const estRediff = natureParDiffusionId?.get(d.id) === 'Rediffusion'
        return {
          heure: point ? heurePoint(d.heure_debut) : normaliserHMS(d.heure_debut),
          heureFin: point ? heurePoint(d.heure_fin) : normaliserHMS(d.heure_fin),
          duree: dureeHMS(dureeSec),
          titre: composerTitre(programme, episode, d.episode_numero, false),
          titreAr: composerTitre(programme, episode, d.episode_numero, true),
          date: jjmmaaaa(dateISO),
          obs: estRediff ? 'إعادة' : '',
        }
      })
    return {
      dateISO,
      libelleJourFr: formaterDateLongue(dateISO),
      libelleJourAr: dateArabeMaghrebine(dateISO),
      lignes,
    }
  })

  const premier = jours[0]
  const dernier = jours[jours.length - 1]
  return {
    chaineNom,
    chaineNomAr: chaineNomAr || chaineNom,
    gabarit,
    periodeLabelFr: `[ du ${formaterDateLongue(premier)} au ${formaterDateLongue(dernier)} ]`,
    periodeLabelAr: `[ من ${dateArabeMaghrebine(premier)} إلى ${dateArabeMaghrebine(dernier)} ]`,
    joursBlocs,
  }
}

export function nomFichierGrilleConventionnelle(chaineNom, premierJourISO, dernierJourISO, extension) {
  return `Grille ${chaineNom} — ${jjmmaaaa(premierJourISO)} au ${jjmmaaaa(dernierJourISO)}.${extension}`
}
