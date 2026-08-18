// Genres (cahier STM Next §3.3/§6.2), FR + AR — administrables depuis P19a
// (table `genre`, migration-p19a.sql). La valeur stockée en base sur les
// titres/blocs/diffusions reste le libellé FR seul (compatible avec les
// anciennes données et avec couleursGenre.js).
//
// `GENRES` reste le MÊME tableau tout au long de la vie de l'app, muté en
// place par chargerGenres() (jamais réassigné) : les ~14 fichiers qui
// l'importent déjà (`GENRES.map(...)`, `GENRES.find(...)`) continuent de
// fonctionner sans aucun changement de signature une fois le chargement
// terminé — pas de paramètre supplémentaire à faire remonter partout.
import { listerGenres as listerGenresDb } from './db.js'
import { definirTokensCouleur } from './couleursGenre.js'

// Valeurs de secours si la table est vide ou injoignable — mêmes 9 genres
// qu'avant la migration, jamais un écran sans genres.
const GENRES_SECOURS = [
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

export const GENRES = [...GENRES_SECOURS]

// Appelé une fois au démarrage (App.jsx) puis après toute modification
// depuis Administration (ajout/renommage/suppression de genre) pour
// resynchroniser GENRES et la palette de couleurs sur l'état actuel de la
// table. Si la table est vide ou la requête échoue, les valeurs de secours
// déjà en place sont conservées (jamais un écran cassé par une nomenclature
// mal chargée).
export async function chargerGenres() {
  try {
    const lignes = await listerGenresDb()
    if (lignes.length === 0) return
    const valeurs = lignes.map((g) => ({ fr: g.libelle_fr, ar: g.libelle_ar, couleurToken: g.couleur_token }))
    GENRES.length = 0
    GENRES.push(...valeurs.map(({ fr, ar }) => ({ fr, ar })))
    definirTokensCouleur(valeurs)
  } catch (erreur) {
    console.error('Chargement des genres impossible, valeurs de secours conservées.', erreur)
  }
}
