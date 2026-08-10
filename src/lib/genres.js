// Liste fermée des 9 genres officiels (cahier STM Next §3.3 / §6.2), FR + AR.
// Remplace la saisie libre du champ Genre (P7) dans FicheProgramme. La valeur
// stockée en base reste le libellé FR seul (compatible avec les anciennes
// données et avec couleurGenre.js).

export const GENRES = [
  { fr: 'Information', ar: 'أخبار' },
  { fr: 'Magazine', ar: 'مجلة' },
  { fr: 'Série', ar: 'مسلسل' },
  { fr: 'Film', ar: 'فيلم' },
  { fr: 'Documentaire', ar: 'وثائقي' },
  { fr: 'Sport', ar: 'رياضة' },
  { fr: 'Jeunesse', ar: 'أطفال' },
  { fr: 'Religieux', ar: 'ديني' },
  { fr: 'Divertissement', ar: 'ترفيه' },
]
