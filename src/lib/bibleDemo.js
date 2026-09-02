// Textes de démonstration pour les écrans Bible / Synopsis (P35b).
// AUCUN vrai OCR, AUCUNE vraie IA — gabarits déterministes dérivés du
// programme, juste de quoi montrer le workflow à la démo. À remplacer par
// un vrai service OCR + un vrai modèle de génération en production.

export function genererOcrFactice(programme) {
  const titre = programme?.titre ?? 'Programme'
  const genre = programme?.genre ?? 'genre non renseigné'
  const auteur = programme?.auteur ? `Auteur : ${programme.auteur}. ` : ''
  return [
    `BIBLE DE PRODUCTION — ${titre.toUpperCase()}`,
    ``,
    `Genre : ${genre}. ${auteur}Format : programme de flux.`,
    ``,
    `Résumé — ${titre} explore son sujet à travers une narration rythmée,`,
    `alternant séquences de terrain, entretiens et archives. Chaque numéro`,
    `est construit autour d'un fil conducteur clair, accessible au grand`,
    `public, et se conclut par une ouverture vers le numéro suivant.`,
    ``,
    `Intentions — proposer un regard incarné et documenté, fidèle à la ligne`,
    `éditoriale de la chaîne, avec un soin particulier apporté à la`,
    `contextualisation et à la pluralité des points de vue.`,
    ``,
    `Personnages / intervenants récurrents : à préciser selon les épisodes.`,
    `Lieux de tournage : Maroc, plateaux et extérieurs.`,
    ``,
    `— Texte reconnu automatiquement (OCR SIMULÉ pour la démonstration) —`,
  ].join('\n')
}

export function genererSynopsisFactice(programme, ocrTexte) {
  const titre = programme?.titre ?? 'Programme'
  const genre = (programme?.genre ?? 'programme').toLowerCase()
  const base = (ocrTexte ?? '').split('\n').find((l) => l.startsWith('Résumé')) ?? ''
  const fr =
    `${titre} est un ${genre} qui aborde son sujet avec clarté et rigueur. ` +
    `À travers reportages, témoignages et analyses, chaque épisode éclaire une facette du thème central ` +
    `et invite le téléspectateur à prolonger la réflexion. ` +
    (base ? base.replace(/^Résumé\s*[—-]\s*/, '') : '') +
    ` (Synopsis généré automatiquement pour la démonstration.)`
  const ar =
    `«${titre}» عمل تلفزيوني يتناول موضوعه بوضوح ودقة. ` +
    `من خلال الروبورتاجات والشهادات والتحليلات، تسلّط كل حلقة الضوء على جانب من الموضوع المحوري ` +
    `وتدعو المشاهد إلى مواصلة التفكير. ` +
    `(ملخص مُولَّد آليًا لأغراض العرض التوضيحي.)`
  return { fr: fr.trim(), ar: ar.trim() }
}
