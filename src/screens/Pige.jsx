// Pige — retour d'antenne réel. Deux vues internes (P36c) :
//  · Import : dépôt d'un fichier de pige → BROUILLON en mémoire → revue à
//    pleine largeur → « Enregistrer dans l'historique » (persistance +
//    intégration annuler/rétablir, écran 'PIGE').
//  · Historique : liste des piges enregistrées (filtres Tout/Jour/Semaine/
//    Mois), détail en lecture seule, undo/redo, suppression.
// L'import est réservé à l'Admin de chaîne / au Super Admin (peutImporterPige) ;
// les autres rôles n'ont que l'Historique.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Upload, Undo2, Redo2, Trash2, Save, X, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  listerImportsPigeParChaine,
  listerDiffusionsReellesParImport,
  supprimerImportPige,
  obtenirImportPigeActif,
  creerImportPige,
  mettreAJourImportPige,
  creerDiffusionsReelles,
} from '../lib/db.js'
import { etatPile, annulerDerniereAction, retablirAction, enregistrerAction } from '../lib/undoManager.js'
import { lireUtilisateur } from '../lib/session.js'
import {
  aujourdHuiISO,
  formaterDateLongue,
  formaterDateJJMMAAAA,
  bornesPeriode,
  labelPeriode,
  decalerRefPeriode,
} from '../lib/semaine.js'
import { LIBELLES_TYPE_ELEMENT } from '../lib/importPige.js'
import { peutImporterPige } from '../lib/roles.js'
import { useNotification } from '../components/NotificationProvider.jsx'
import PanneauImportPige from '../components/PanneauImportPige.jsx'
import TableauLignesPige from '../components/TableauLignesPige.jsx'

const PILE_VIDE = { peutAnnuler: false, libelleAnnuler: null, peutRetablir: false, libelleRetablir: null }

const GRANULARITES = [
  { code: 'TOUT', label: 'Tout' },
  { code: 'JOUR', label: 'Jour' },
  { code: 'SEMAINE', label: 'Semaine' },
  { code: 'MOIS', label: 'Mois' },
]

// `bornesPeriode` / `labelPeriode` / `decalerRefPeriode` vivent désormais dans
// semaine.js (P40) — partagés avec le Rapport de volume horaire.

// Horodatage court d'un import (timestamptz) → « 31/08/2026 14:23 ».
function formaterHorodatage(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function genresDe(lignes) {
  return [...new Set(lignes.map((l) => l.genre_niv1).filter(Boolean))].sort()
}
function filtrerLignes(lignes, filtreType, filtreGenre) {
  return lignes.filter(
    (l) => (!filtreType || l.type_element === filtreType) && (!filtreGenre || l.genre_niv1 === filtreGenre)
  )
}

export default function Pige({ chaineActive, roleUtilisateur, pigeCible }) {
  const lectureSeule = !peutImporterPige(roleUtilisateur)
  const { confirmer } = useNotification()

  const [vue, setVue] = useState(lectureSeule ? 'HISTORIQUE' : 'IMPORT') // IMPORT | HISTORIQUE
  const [brouillons, setBrouillons] = useState([])
  const [importOuvert, setImportOuvert] = useState(false)
  const [enregistrement, setEnregistrement] = useState(false)

  const [imports, setImports] = useState([])
  const [importActifId, setImportActifId] = useState(null)
  const [lignes, setLignes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [pile, setPile] = useState(PILE_VIDE)
  const [filtreType, setFiltreType] = useState('')
  const [filtreGenre, setFiltreGenre] = useState('')
  const [ligneFlashId, setLigneFlashId] = useState(null)
  const flashFaitPourRef = useRef(null)
  const [granularite, setGranularite] = useState('TOUT')
  const [refDate, setRefDate] = useState(() => aujourdHuiISO())

  const [debutPeriode, finPeriode] = bornesPeriode(granularite, refDate)
  const importsFiltres = useMemo(
    () => imports.filter((i) => granularite === 'TOUT' || (i.date >= debutPeriode && i.date <= finPeriode)),
    [imports, granularite, debutPeriode, finPeriode]
  )

  function decalerPeriode(sens) {
    setRefDate((d) => decalerRefPeriode(granularite, d, sens))
  }

  const importActif = useMemo(() => imports.find((i) => i.id === importActifId) ?? null, [imports, importActifId])

  function rechargerImports(selectionPreferee) {
    setChargement(true)
    setErreur(null)
    listerImportsPigeParChaine(chaineActive.id)
      .then((rows) => {
        setImports(rows)
        setImportActifId((actuel) => {
          if (selectionPreferee && rows.some((r) => r.id === selectionPreferee)) return selectionPreferee
          if (actuel && rows.some((r) => r.id === actuel)) return actuel
          return rows[0]?.id ?? null
        })
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- ne réagit qu'au changement de chaîne
  useEffect(() => rechargerImports(pigeCible?.id), [chaineActive])

  // Arrivée depuis l'historique d'un titre (P36b) : vue Historique + sélection
  // de l'import d'origine. `cle` change à chaque clic, même import inclus.
  useEffect(() => {
    if (!pigeCible?.id) return
    setVue('HISTORIQUE')
    setImportActifId(pigeCible.id)
    setFiltreType('')
    setFiltreGenre('')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne réagit qu'à un nouveau clic
  }, [pigeCible?.cle])

  // Une fois le détail chargé, fait clignoter la ligne d'origine ~2,5 s et la
  // centre dans la vue (un seul déclenchement par clic, cf. flashFaitPourRef).
  useEffect(() => {
    if (!pigeCible?.cle || !pigeCible?.ligneId) return
    if (flashFaitPourRef.current === pigeCible.cle) return
    if (!lignes.some((l) => l.id === pigeCible.ligneId)) return
    flashFaitPourRef.current = pigeCible.cle
    setLigneFlashId(pigeCible.ligneId)
    document.getElementById(`pige-ligne-${pigeCible.ligneId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const t = setTimeout(() => setLigneFlashId(null), 2500)
    return () => clearTimeout(t)
  }, [pigeCible?.cle, pigeCible?.ligneId, lignes])

  useEffect(() => {
    if (!importActifId) {
      setLignes([])
      return
    }
    listerDiffusionsReellesParImport(importActifId)
      .then(setLignes)
      .catch((err) => setErreur(err.message))
  }, [importActifId])

  useEffect(() => {
    if (!importActif) {
      setPile(PILE_VIDE)
      return
    }
    etatPile(importActif.chaine_id, 'PIGE', importActif.id).then(setPile)
  }, [importActif, lignes])

  async function gererAnnuler() {
    if (!importActif) return
    const resultat = await annulerDerniereAction(importActif.chaine_id, 'PIGE', importActif.id)
    if (!resultat.ok) {
      setErreur(resultat.motif)
      return
    }
    rechargerImports()
  }

  async function gererRetablir() {
    if (!importActif) return
    const resultat = await retablirAction(importActif.chaine_id, 'PIGE', importActif.id)
    if (!resultat.ok) {
      setErreur(resultat.motif)
      return
    }
    rechargerImports(importActif.id)
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (vue !== 'HISTORIQUE') return
      const cible = document.activeElement
      if (cible && ['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName)) return
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        gererAnnuler()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        gererRetablir()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lit vue/importActif par closure
  }, [vue, importActif])

  async function supprimer() {
    if (!importActif) return
    const ok = await confirmer({
      titre: 'Supprimer cet import',
      message: `Supprimer l'import « ${importActif.nom} » et ses ${importActif.nb_lignes} ligne(s) de pige ? Cette action ne passe pas par l'annuler/rétablir.`,
      labelConfirmer: 'Supprimer',
    })
    if (!ok) return
    try {
      await supprimerImportPige(importActif.id)
      rechargerImports()
    } catch (err) {
      setErreur(err.message)
    }
  }

  function recevoirBrouillons(nouveaux) {
    setBrouillons(nouveaux)
    setImportOuvert(false)
    setVue('IMPORT')
    setErreur(null)
  }

  function majLigneBrouillon(idx, ordre, champs) {
    setBrouillons((prev) =>
      prev.map((g, i) =>
        i === idx ? { ...g, lignes: g.lignes.map((l) => (l.ordre === ordre ? { ...l, ...champs } : l)) } : g
      )
    )
  }

  // Enregistrement explicite : c'est ici que la pige entre dans l'historique
  // (persistance + une entrée annuler/rétablir par import, écran 'PIGE').
  async function enregistrerBrouillons() {
    if (brouillons.length === 0) return
    setEnregistrement(true)
    setErreur(null)
    try {
      const crees = []
      for (const g of brouillons) {
        const operations = []
        const ancienActif = await obtenirImportPigeActif(g.chaineId, g.date)
        if (ancienActif) {
          const ancienDesactive = await mettreAJourImportPige(ancienActif.id, { actif: false })
          operations.push({ table: 'import_pige', type: 'UPDATE', id: ancienActif.id, avant: ancienActif, apres: ancienDesactive })
        }
        const nouvelImport = await creerImportPige({
          nom: g.nom,
          chaine_id: g.chaineId,
          chaine_nom: g.chaineNom,
          date: g.date,
          jour: g.jour ?? null,
          source_fichier: g.source_fichier ?? null,
          analyse_le: g.analyse_le ?? null,
          nb_lignes: g.lignes.length,
          actif: true,
          cree_par: lireUtilisateur(),
        })
        operations.push({ table: 'import_pige', type: 'INSERT', id: nouvelImport.id, apres: nouvelImport })

        const champs = g.lignes.map((l) => ({
          import_pige_id: nouvelImport.id,
          chaine_id: g.chaineId,
          chaine_nom: g.chaineNom,
          date: g.date,
          jour: g.jour ?? null,
          ordre: l.ordre,
          code_ecran: l.code_ecran ?? null,
          code_program: l.code_program ?? null,
          programme: (l.programme ?? '').trim() || '(sans titre)',
          heure_debut: l.heure_debut,
          heure_fin: l.heure_fin,
          debut_secondes: l.debut_secondes,
          fin_secondes: l.fin_secondes,
          duree_secondes: l.duree_secondes,
          libelle_complementaire: l.libelle_complementaire ?? null,
          code_genre: l.code_genre ?? null,
          genre_niv1: l.genre_niv1 ?? null,
          genre_niv2: l.genre_niv2 ?? null,
          genre_niv3: l.genre_niv3 ?? null,
          type_element: l.type_element,
          est_sous_ligne: l.est_sous_ligne,
          parent_ordre: l.parent_ordre ?? null,
          chevauchement: l.chevauchement,
        }))
        const creees = await creerDiffusionsReelles(champs)
        operations.push(...creees.map((d) => ({ table: 'diffusion_reelle', type: 'INSERT', id: d.id, apres: d })))

        await enregistrerAction({
          chaineId: g.chaineId,
          ecran: 'PIGE',
          documentId: nouvelImport.id,
          libelle: `Import pige « ${g.source_fichier ?? 'pige'} » — ${g.chaineNom} ${formaterDateJJMMAAAA(g.date)} (${creees.length} ligne${creees.length > 1 ? 's' : ''})`,
          operations,
        })
        crees.push(nouvelImport)
      }
      setBrouillons([])
      setGranularite('TOUT')
      setVue('HISTORIQUE')
      rechargerImports(crees[0]?.id ?? undefined)
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  const nbLignesBrouillon = brouillons.reduce((n, g) => n + g.lignes.length, 0)

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Pige — {chaineActive.nom}</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {lectureSeule
                ? 'Retour d’antenne réel (ce qui a réellement été diffusé) — consultation.'
                : 'Retour d’antenne réel : importez le fichier de pige, revoyez-le, puis enregistrez-le dans l’historique.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {vue === 'HISTORIQUE' && !lectureSeule && importActif && (
              <div className="flex rounded-md border border-slate-300">
                <button
                  type="button"
                  onClick={gererAnnuler}
                  disabled={!pile.peutAnnuler}
                  title={pile.peutAnnuler ? `Annuler : ${pile.libelleAnnuler}` : 'Rien à annuler'}
                  className="rounded-l-md border-r border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <Undo2 size={15} />
                </button>
                <button
                  type="button"
                  onClick={gererRetablir}
                  disabled={!pile.peutRetablir}
                  title={pile.peutRetablir ? `Rétablir : ${pile.libelleRetablir}` : 'Rien à rétablir'}
                  className="rounded-r-md p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <Redo2 size={15} />
                </button>
              </div>
            )}
            <div className="flex rounded-md border border-slate-300 text-sm">
              {!lectureSeule && (
                <button
                  type="button"
                  onClick={() => setVue('IMPORT')}
                  className={`px-3 py-1.5 ${vue === 'IMPORT' ? 'bg-snrt-navy text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  Import{brouillons.length > 0 ? ' •' : ''}
                </button>
              )}
              <button
                type="button"
                onClick={() => setVue('HISTORIQUE')}
                className={`px-3 py-1.5 ${vue === 'HISTORIQUE' ? 'bg-snrt-navy text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Historique
              </button>
            </div>
          </div>
        </div>
        {erreur && <p className="mt-2 text-xs text-red-600">{erreur}</p>}
      </div>

      {vue === 'IMPORT' && !lectureSeule && (
        <div className="space-y-4">
          {brouillons.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
              <p className="text-sm text-slate-500">Aucune pige en cours d’import.</p>
              <button
                type="button"
                onClick={() => setImportOuvert(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-snrt-navy px-3 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover"
              >
                <Upload size={15} />
                Importer une pige
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-600">
                  Brouillon — {nbLignesBrouillon} ligne{nbLignesBrouillon > 1 ? 's' : ''} en attente d’enregistrement.
                </p>
                <button
                  type="button"
                  onClick={() => setImportOuvert(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                >
                  <Upload size={13} />
                  Remplacer par un autre fichier
                </button>
              </div>

              {brouillons.map((g, idx) => {
                const genres = genresDe(g.lignes)
                const affichees = filtrerLignes(g.lignes, filtreType, filtreGenre)
                return (
                  <div key={`${g.chaineNom}__${g.date}`} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold text-slate-900">{g.nom}</h2>
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">Non enregistré</span>
                        <span className="text-xs text-slate-400">
                          {g.chaineNom} · {formaterDateLongue(g.date)} · {g.lignes.length} lignes
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={filtreType}
                          onChange={(e) => setFiltreType(e.target.value)}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
                        >
                          <option value="">Tous les types</option>
                          {Object.entries(LIBELLES_TYPE_ELEMENT).map(([code, libelle]) => (
                            <option key={code} value={code}>{libelle}</option>
                          ))}
                        </select>
                        {genres.length > 1 && (
                          <select
                            value={filtreGenre}
                            onChange={(e) => setFiltreGenre(e.target.value)}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
                          >
                            <option value="">Tous les genres</option>
                            {genres.map((ge) => (
                              <option key={ge} value={ge}>{ge}</option>
                            ))}
                          </select>
                        )}
                        <span className="text-xs text-slate-400">{affichees.length} / {g.lignes.length}</span>
                      </div>
                    </div>
                    <TableauLignesPige lignes={affichees} onMajLigne={(ordre, champs) => majLigneBrouillon(idx, ordre, champs)} />
                  </div>
                )
              })}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBrouillons([])}
                  disabled={enregistrement}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  <X size={14} />
                  Retirer
                </button>
                <button
                  type="button"
                  onClick={enregistrerBrouillons}
                  disabled={enregistrement}
                  className="inline-flex items-center gap-1.5 rounded-md bg-snrt-navy px-3 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
                >
                  <Save size={14} />
                  {enregistrement ? 'Enregistrement…' : 'Enregistrer dans l’historique'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {vue === 'HISTORIQUE' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Historique des piges</h2>
              {importsFiltres.length > 0 && <span className="text-[11px] text-slate-400">{importsFiltres.length}</span>}
            </div>

            <div className="mb-2 flex rounded-md border border-slate-300 p-0.5">
              {GRANULARITES.map((g) => (
                <button
                  key={g.code}
                  type="button"
                  onClick={() => setGranularite(g.code)}
                  className={`flex-1 rounded px-1.5 py-1 text-[11px] font-medium transition-colors ${
                    granularite === g.code ? 'bg-snrt-navy text-white' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            {granularite !== 'TOUT' && (
              <div className="mb-3 flex items-center gap-1">
                <button type="button" onClick={() => decalerPeriode(-1)} className="rounded-md border border-slate-300 p-1 text-slate-500 hover:bg-slate-50">
                  <ChevronLeft size={14} />
                </button>
                <span className="flex-1 text-center text-xs font-medium text-slate-700">{labelPeriode(granularite, refDate)}</span>
                <button type="button" onClick={() => decalerPeriode(1)} className="rounded-md border border-slate-300 p-1 text-slate-500 hover:bg-slate-50">
                  <ChevronRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setRefDate(aujourdHuiISO())}
                  className="ml-1 rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-50"
                >
                  Auj.
                </button>
              </div>
            )}

            {chargement ? (
              <p className="text-sm text-slate-500">Chargement…</p>
            ) : imports.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun import de pige pour cette chaîne.</p>
            ) : importsFiltres.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun import sur cette période.</p>
            ) : (
              <ul className="space-y-1">
                {importsFiltres.map((imp) => (
                  <li key={imp.id}>
                    <button
                      type="button"
                      onClick={() => setImportActifId(imp.id)}
                      className={`w-full rounded-md border px-2 py-1.5 text-left text-xs ${
                        imp.id === importActifId ? 'border-snrt-navy/40 bg-snrt-navy/5' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block font-medium text-slate-800">{imp.nom}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                        {formaterDateLongue(imp.date)}
                        <span className={`rounded px-1 py-0.5 font-medium ${imp.actif ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {imp.actif ? 'Actif' : 'Archivé'}
                        </span>
                        <span>· {imp.nb_lignes} lignes</span>
                      </span>
                      <span className="mt-0.5 block text-[11px] text-slate-400">
                        Importé le {formaterHorodatage(imp.cree_le)}
                        {imp.cree_par ? ` par ${imp.cree_par}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            {!importActif ? (
              <p className="text-sm text-slate-500">Sélectionnez un import pour en voir le détail.</p>
            ) : (
              (() => {
                const genres = genresDe(lignes)
                const affichees = filtrerLignes(lignes, filtreType, filtreGenre)
                return (
                  <>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={filtreType}
                          onChange={(e) => setFiltreType(e.target.value)}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
                        >
                          <option value="">Tous les types</option>
                          {Object.entries(LIBELLES_TYPE_ELEMENT).map(([code, libelle]) => (
                            <option key={code} value={code}>{libelle}</option>
                          ))}
                        </select>
                        {genres.length > 1 && (
                          <select
                            value={filtreGenre}
                            onChange={(e) => setFiltreGenre(e.target.value)}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
                          >
                            <option value="">Tous les genres</option>
                            {genres.map((ge) => (
                              <option key={ge} value={ge}>{ge}</option>
                            ))}
                          </select>
                        )}
                        <span className="text-xs text-slate-400">
                          {affichees.length} / {lignes.length} ligne{lignes.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      {!lectureSeule && (
                        <button
                          type="button"
                          onClick={supprimer}
                          className="flex items-center gap-1.5 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={13} />
                          Supprimer cet import
                        </button>
                      )}
                    </div>
                    <TableauLignesPige lignes={affichees} ligneFlashId={ligneFlashId} />
                  </>
                )
              })()
            )}
          </div>
        </div>
      )}

      {importOuvert && (
        <PanneauImportPige
          chaineActive={chaineActive}
          onFermer={() => setImportOuvert(false)}
          onBrouillon={recevoirBrouillons}
        />
      )}
    </div>
  )
}
