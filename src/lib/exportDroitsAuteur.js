// Export Excel finance — droits d'auteur / diffusions payantes (P37b). PUR :
// aucune dépendance xlsx ici, on ne fait que mettre en forme le bundle en
// AOA (array-of-arrays), même convention que exportBilan.js / exportConducteur.js.
// AUCUN montant ni règle : la finance calcule les virements de son côté.
import { formaterDateLongue } from './semaine.js'
import { natureDepuisLibelle } from './rapprochementPige.js'

// `programmes` : [{ titre, chaineNom, note, valide, calc: { nbReelles,
//   nbPayantes, seuil }, diffusions: [{ date, heure, chaineNom, libelle,
//   comptee }] }]
export function construireDonneesDroitsAuteur({ chaineNom, dateISO, utilisateur, brouillon, programmes }) {
  return { chaineNom, dateISO, utilisateur: utilisateur ?? '—', brouillon: Boolean(brouillon), programmes }
}

function entete(d) {
  return [
    [`Droits d'auteur — diffusions payantes — ${d.chaineNom}`],
    ...(d.brouillon ? [['BROUILLON — non validé, ne pas transmettre en l’état']] : []),
    [`Édité le ${formaterDateLongue(d.dateISO)} par ${d.utilisateur}`],
    [
      "Comptes assistés par rapprochement de nom (approximatif), vérifiés par la Gestion des droits et du stock. Les montants sont calculés par la finance.",
    ],
    [],
  ]
}

export function construireFeuilleRecap(d) {
  const total = d.programmes.reduce(
    (acc, p) => ({ reelles: acc.reelles + p.calc.nbReelles, payantes: acc.payantes + p.calc.nbPayantes }),
    { reelles: 0, payantes: 0 }
  )
  return [
    ...entete(d),
    ['Programme', 'Chaîne', 'Nb diffusions réelles', 'Seuil', 'Nb payantes', 'Validé', 'Note'],
    ...d.programmes.map((p) => [
      p.titre,
      p.chaineNom,
      p.calc.nbReelles,
      p.calc.seuil,
      p.calc.nbPayantes,
      p.valide ? 'Oui' : 'Non',
      p.note ?? '',
    ]),
    [],
    ['Total', '', total.reelles, '', total.payantes, '', ''],
  ]
}

export function construireFeuilleDetail(d) {
  return [
    ['Programme', 'Date', 'Heure', 'Chaîne', 'Libellé', 'Nature', 'Comptée'],
    ...d.programmes.flatMap((p) =>
      p.diffusions.map((x) => [
        p.titre,
        x.date,
        (x.heure ?? '').slice(0, 8),
        x.chaineNom,
        x.libelle ?? '',
        natureDepuisLibelle(x.libelle),
        x.comptee ? 'Oui' : 'Non',
      ])
    ),
  ]
}

export function nomFichierDroitsAuteur(chaineNom, dateISO) {
  return `droits-auteur_${chaineNom}_${dateISO.replace(/-/g, '')}.xlsx`
}
