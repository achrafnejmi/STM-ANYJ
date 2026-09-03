import { useEffect, useMemo, useState } from 'react'
import {
  listerProgrammesParChaine,
  listerTousLesEpisodes,
  listerToutesLesFenetresDroits,
  listerDemandesPadParChaine,
} from '../lib/db.js'
import { aujourdHuiISO } from '../lib/semaine.js'
import {
  calculerIndicateursTete,
  calculerTitresFinsDeDroits,
  calculerRepartitionParGenre,
  formaterVolumeHeures,
} from '../lib/bilans.js'
import { couleurGenre } from '../lib/couleursGenre.js'
import CarteIndicateur from '../components/CarteIndicateur.jsx'

// Tableau de bord du rôle « Gestion des droits et du stock » (P36) : uniquement
// les statistiques droits / stock / PAD dont ce rôle a la charge. Lecture seule
// — le suivi actif des demandes est sur l'écran « Suivi PAD ». Réutilise les
// calculs purs de bilans.js (mêmes définitions que l'écran Accueil), sans
// charger la grille / le plan média / le non-linéaire (hors périmètre du rôle).
export default function PilotageDroitsStock({ chaineActive }) {
  const [programmes, setProgrammes] = useState([])
  const [episodes, setEpisodes] = useState([])
  const [fenetres, setFenetres] = useState([])
  const [demandes, setDemandes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    setChargement(true)
    setErreur(null)
    Promise.all([
      listerProgrammesParChaine(chaineActive.id),
      listerTousLesEpisodes(),
      listerToutesLesFenetresDroits(),
      listerDemandesPadParChaine(chaineActive.id),
    ])
      .then(([p, e, f, d]) => {
        setProgrammes(p)
        setEpisodes(e)
        setFenetres(f)
        setDemandes(d)
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
  }, [chaineActive])

  const dateReference = aujourdHuiISO()
  const idsProgrammes = useMemo(() => new Set(programmes.map((p) => p.id)), [programmes])

  const episodesParProgrammeId = useMemo(() => {
    const map = new Map()
    for (const ep of episodes) {
      if (!idsProgrammes.has(ep.programme_id)) continue
      if (!map.has(ep.programme_id)) map.set(ep.programme_id, [])
      map.get(ep.programme_id).push(ep)
    }
    return map
  }, [episodes, idsProgrammes])

  const indicateurs = useMemo(
    () => calculerIndicateursTete(programmes, episodesParProgrammeId, fenetres, dateReference),
    [programmes, episodesParProgrammeId, fenetres, dateReference]
  )
  const finsDeDroits = useMemo(
    () => calculerTitresFinsDeDroits(programmes, episodesParProgrammeId, fenetres, dateReference),
    [programmes, episodesParProgrammeId, fenetres, dateReference]
  )
  const repartition = useMemo(
    () => calculerRepartitionParGenre(programmes, episodesParProgrammeId, fenetres, dateReference),
    [programmes, episodesParProgrammeId, fenetres, dateReference]
  )

  const droits = useMemo(() => {
    const fenetresChaine = fenetres.filter((f) => idsProgrammes.has(f.programme_id))
    const passagesRestantsCumul = fenetresChaine
      .filter((f) => !f.illimite)
      .reduce((s, f) => s + Math.max(0, (f.passages_autorises ?? 0) - (f.passages_consommes ?? 0)), 0)
    const nbFenetresIllimitees = fenetresChaine.filter((f) => f.illimite).length
    return { passagesRestantsCumul, nbFenetresIllimitees }
  }, [fenetres, idsProgrammes])

  const stock = useMemo(() => {
    const episodesChaine = episodes.filter((e) => idsProgrammes.has(e.programme_id))
    const nbEpisodesTotal = episodesChaine.length
    const nbEpisodesPad = episodesChaine.filter((e) => e.pad).length
    const tauxPad = nbEpisodesTotal ? Math.round((nbEpisodesPad / nbEpisodesTotal) * 100) : 0
    const nbTitresDormants = programmes.filter(
      (p) => !(episodesParProgrammeId.get(p.id) ?? []).some((e) => e.pad)
    ).length
    return { nbEpisodesTotal, nbEpisodesPad, tauxPad, nbTitresDormants }
  }, [episodes, idsProgrammes, programmes, episodesParProgrammeId])

  const pad = useMemo(() => {
    const enAttente = demandes.filter((d) => d.statut === 'EN_ATTENTE')
    const joursDepuis = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
    const ancienneteMax = enAttente.length ? Math.max(...enAttente.map((d) => joursDepuis(d.cree_le))) : 0
    const relancesEnvoyees = demandes.reduce((s, d) => s + (d.relances ?? 0), 0)
    const decisionsRendues = demandes.filter((d) => d.statut !== 'EN_ATTENTE').length
    return { nbEnAttente: enAttente.length, ancienneteMax, relancesEnvoyees, decisionsRendues }
  }, [demandes])

  const volumeMaxGenre = Math.max(1, ...repartition.map((r) => r.volumeMinutes))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Pilotage droits &amp; stock — {chaineActive.nom}</h1>
        <p className="text-sm text-slate-500">
          Vue de synthèse des droits, du stock disponible et du circuit de validation PAD.
        </p>
      </div>

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      {chargement ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : (
        <>
          <Bloc couleur="bg-snrt-blue" titre="Droits">
            <CarteIndicateur
              libelle="Volume disponible"
              valeur={formaterVolumeHeures(indicateurs.volumeMinutes)}
              ton="favorable"
              sousTexte="épisodes prêts, titres avec droits ouverts"
            />
            <CarteIndicateur
              libelle="Fins de droits (< 45 j)"
              valeur={indicateurs.nbTitresFinsDeDroits}
              ton="vigilance"
              sousTexte={indicateurs.nbTitresFinsDeDroits > 0 ? 'à consommer en priorité' : 'aucune échéance proche'}
            />
            <CarteIndicateur
              libelle="Titres hors droits"
              valeur={indicateurs.nbTitresHorsDroits}
              ton="alerte"
              sousTexte={indicateurs.nbTitresHorsDroits > 0 ? 'à régulariser' : 'catalogue couvert'}
            />
            <CarteIndicateur
              libelle="Passages restants (droits)"
              valeur={droits.passagesRestantsCumul.toLocaleString('fr-FR')}
              ton="info"
              sousTexte={
                droits.nbFenetresIllimitees > 0
                  ? `+ ${droits.nbFenetresIllimitees} fenêtre(s) illimitée(s)`
                  : 'cumul de toutes les fenêtres'
              }
            />
          </Bloc>

          <Bloc couleur="bg-snrt-orange" titre="Stock">
            <CarteIndicateur
              libelle="Titres au catalogue"
              valeur={programmes.length}
              ton="info"
              sousTexte={`${indicateurs.nbTitresRetenus} retenus par le stock disponible`}
            />
            <CarteIndicateur
              libelle="Épisodes prêts (PAD)"
              valeur={`${stock.nbEpisodesPad} / ${stock.nbEpisodesTotal}`}
              ton="favorable"
              sousTexte="sur l'ensemble des épisodes de la chaîne"
            />
            <CarteIndicateur
              libelle="Taux PAD"
              valeur={`${stock.tauxPad} %`}
              ton={stock.tauxPad >= 80 ? 'favorable' : stock.tauxPad >= 50 ? 'vigilance' : 'alerte'}
              sousTexte="maturité du stock"
            />
            <CarteIndicateur
              libelle="Titres dormants"
              valeur={stock.nbTitresDormants}
              ton="vigilance"
              sousTexte="aucun épisode prêt à diffuser"
            />
          </Bloc>

          <Bloc couleur="bg-snrt-navy" titre="Circuit PAD">
            <CarteIndicateur
              libelle="Demandes en attente"
              valeur={pad.nbEnAttente}
              ton={pad.nbEnAttente > 0 ? 'vigilance' : 'favorable'}
              sousTexte="auprès du Contrôle PAD"
            />
            <CarteIndicateur
              libelle="Ancienneté max"
              valeur={`${pad.ancienneteMax} j`}
              ton={pad.ancienneteMax >= 7 ? 'alerte' : 'info'}
              sousTexte="demande en attente la plus ancienne"
            />
            <CarteIndicateur
              libelle="Relances envoyées"
              valeur={pad.relancesEnvoyees}
              ton="info"
              sousTexte="cumul sur les demandes en cours"
            />
            <CarteIndicateur
              libelle="Décisions rendues"
              valeur={pad.decisionsRendues}
              ton="favorable"
              sousTexte="demandes acceptées ou refusées"
            />
          </Bloc>

          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-snrt-green" />
              <h2 className="text-base font-semibold text-slate-900">Répartition par genre (stock disponible)</h2>
            </div>
            <div className="space-y-3">
              {repartition.map((r) => {
                const { fond } = couleurGenre(r.genre.fr)
                const pct = Math.round((r.volumeMinutes / volumeMaxGenre) * 100)
                return (
                  <div key={r.genre.fr}>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                      <span>
                        {r.genre.fr} / {r.genre.ar}
                      </span>
                      <span>
                        {formaterVolumeHeures(r.volumeMinutes)} · {r.nbEpisodesPrets} ép. prêts · {r.nbTitres} titres
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100">
                      <div className={`h-2.5 rounded-full ${fond}`} style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-snrt-red" />
              <h2 className="text-base font-semibold text-slate-900">À consommer avant expiration</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-4 font-medium">Titre</th>
                    <th className="py-2 pr-4 font-medium">Échéance</th>
                    <th className="py-2 pr-4 font-medium">Épisodes prêts</th>
                    <th className="py-2 pr-4 font-medium">Passages restants</th>
                  </tr>
                </thead>
                <tbody>
                  {finsDeDroits.map((f) => (
                    <tr key={f.programmeId} className="border-b border-slate-100">
                      <td className="py-2 pr-4 text-slate-700">{f.titre}</td>
                      <td className="py-2 pr-4 text-slate-700">{f.dateFin}</td>
                      <td className="py-2 pr-4 text-slate-700">{f.nbEpisodesPrets}</td>
                      <td className="py-2 pr-4 text-slate-700">{f.passagesRestants}</td>
                    </tr>
                  ))}
                  {finsDeDroits.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-3 text-sm text-slate-500">
                        Aucun titre en fin de droits proche.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Bloc({ couleur, titre, children }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-4 w-1 rounded-full ${couleur}`} />
        <h2 className="text-sm font-semibold text-slate-900">{titre}</h2>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{children}</div>
    </div>
  )
}
