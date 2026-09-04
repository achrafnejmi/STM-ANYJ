// Suivi rédaction (P39) : état bible / synopsis par programme + agrégats, pour
// l'espace du rôle Rédacteur (tableau « Bibles & synopsis » + tableau de bord).
// Calcul pur, aucun accès Supabase. « traité » = un synopsis existe (FR ou AR).

function estRempli(valeur) {
  return typeof valeur === 'string' && valeur.trim().length > 0
}

export function calculerSuiviRedaction(programmes, bibles) {
  const bibleParProgrammeId = new Map((bibles ?? []).map((b) => [b.programme_id, b]))

  const lignes = (programmes ?? []).map((programme) => {
    const bible = bibleParProgrammeId.get(programme.id) ?? null
    const bibleDeposee = !!bible?.fichier_chemin
    const ocrAnalyse = estRempli(bible?.ocr_texte)
    const synopsisFr = estRempli(bible?.synopsis_fr)
    const synopsisAr = estRempli(bible?.synopsis_ar)
    const traite = synopsisFr || synopsisAr
    return {
      programme,
      bible,
      bibleDeposee,
      ocrAnalyse,
      synopsisFr,
      synopsisAr,
      traite,
      complet: synopsisFr && synopsisAr,
      aRediger: bibleDeposee && !traite,
    }
  })

  const total = lignes.length
  const avecBible = lignes.filter((l) => l.bibleDeposee).length
  const traites = lignes.filter((l) => l.traite).length

  return {
    lignes,
    stats: {
      total,
      avecBible,
      sansBible: total - avecBible,
      traites,
      traitesFr: lignes.filter((l) => l.synopsisFr).length,
      traitesAr: lignes.filter((l) => l.synopsisAr).length,
      aRediger: lignes.filter((l) => l.aRediger).length,
      aRedigerFr: lignes.filter((l) => l.bibleDeposee && !l.synopsisFr).length,
      aRedigerAr: lignes.filter((l) => l.bibleDeposee && !l.synopsisAr).length,
      frSeul: lignes.filter((l) => l.synopsisFr && !l.synopsisAr).length,
      arSeul: lignes.filter((l) => l.synopsisAr && !l.synopsisFr).length,
      complets: lignes.filter((l) => l.complet).length,
    },
  }
}

// Statut d'une ligne pour une langue donnée (P40) — `langue` nulle ⇒ statut
// combiné (au moins une des deux langues).
export function traiteEnLangue(ligne, langue) {
  if (langue === 'FR') return ligne.synopsisFr
  if (langue === 'AR') return ligne.synopsisAr
  return ligne.traite
}

export function aRedigerEnLangue(ligne, langue) {
  return ligne.bibleDeposee && !traiteEnLangue(ligne, langue)
}

// Pourcentage entier borné (0 si dénominateur nul).
export function pourcentage(partie, total) {
  return total > 0 ? Math.round((partie / total) * 100) : 0
}
