// Pige — retour d'antenne réel (P36a). Import SEUL à ce stade : on visualise
// les imports pige de la chaîne active et le détail (diffusion_reelle) en
// lecture seule. L'import (fichier d'audience → aperçu modifiable → confirme)
// est réservé à l'Admin de chaîne / au Super Admin ; il est annulable/
// rétablissable en bloc (pile undo/redo, écran 'PIGE'), scopé sur l'import
// actuellement ouvert.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Upload, Undo2, Redo2, Trash2, CornerDownRight, TriangleAlert } from 'lucide-react'
import {
  listerImportsPigeParChaine,
  listerDiffusionsReellesParImport,
  supprimerImportPige,
} from '../lib/db.js'
import { etatPile, annulerDerniereAction, retablirAction } from '../lib/undoManager.js'
import { secondesEnHms } from '../lib/importPige.js'
import { formaterDateLongue } from '../lib/semaine.js'
import { peutImporterPige } from '../lib/roles.js'
import { useNotification } from '../components/NotificationProvider.jsx'
import PanneauImportPige from '../components/PanneauImportPige.jsx'

const LIBELLES_TYPE = {
  PROGRAMME: 'Programme',
  BA: 'Bande-annonce',
  SPOT: 'Spot',
  AUTO_PROMO: 'Auto-promo',
  COMMUNIQUE: 'Communiqué',
  AUTRE: 'Autre',
}
const PILE_VIDE = { peutAnnuler: false, libelleAnnuler: null, peutRetablir: false, libelleRetablir: null }

// Horodatage court d'un import (timestamptz) → « 31/08/2026 14:23 ».
function formaterHorodatage(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Pige({ chaineActive, roleUtilisateur, pigeCible }) {
  const lectureSeule = !peutImporterPige(roleUtilisateur)
  const { confirmer } = useNotification()

  const [imports, setImports] = useState([])
  const [importActifId, setImportActifId] = useState(null)
  const [lignes, setLignes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [importOuvert, setImportOuvert] = useState(false)
  const [pile, setPile] = useState(PILE_VIDE)
  const [filtreType, setFiltreType] = useState('')
  const [filtreGenre, setFiltreGenre] = useState('')
  const [ligneFlashId, setLigneFlashId] = useState(null)
  const flashFaitPourRef = useRef(null)

  const importActif = useMemo(
    () => imports.find((i) => i.id === importActifId) ?? null,
    [imports, importActifId]
  )

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

  // Arrivée depuis l'historique d'un titre (P36b) : sélectionne l'import
  // d'origine. `cle` change à chaque clic, même import inclus.
  useEffect(() => {
    if (!pigeCible?.id) return
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gererAnnuler/gererRetablir lisent importActif par closure
  }, [importActif])

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

  function importe(nouveaux) {
    setImportOuvert(false)
    rechargerImports(nouveaux?.[0]?.id ?? null)
  }

  const genresDisponibles = useMemo(
    () => [...new Set(lignes.map((l) => l.genre_niv1).filter(Boolean))].sort(),
    [lignes]
  )
  const lignesFiltrees = useMemo(
    () =>
      lignes.filter(
        (l) => (!filtreType || l.type_element === filtreType) && (!filtreGenre || l.genre_niv1 === filtreGenre)
      ),
    [lignes, filtreType, filtreGenre]
  )

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Pige — {chaineActive.nom}</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {lectureSeule
                ? 'Retour d’antenne réel (ce qui a réellement été diffusé) — consultation.'
                : 'Retour d’antenne réel : importez le fichier de pige, il devient la référence de la chaîne pour cette date.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!lectureSeule && importActif && (
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
            {!lectureSeule && (
              <button
                type="button"
                onClick={() => setImportOuvert(true)}
                className="flex items-center gap-1.5 rounded-md bg-snrt-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-snrt-navy-hover"
              >
                <Upload size={15} />
                Importer une pige
              </button>
            )}
          </div>
        </div>
        {erreur && <p className="mt-2 text-xs text-red-600">{erreur}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[18rem_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Imports</h2>
          {chargement ? (
            <p className="text-sm text-slate-500">Chargement…</p>
          ) : imports.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun import de pige pour cette chaîne.</p>
          ) : (
            <ul className="space-y-1">
              {imports.map((imp) => (
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
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={filtreType}
                    onChange={(e) => setFiltreType(e.target.value)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
                  >
                    <option value="">Tous les types</option>
                    {Object.entries(LIBELLES_TYPE).map(([code, libelle]) => (
                      <option key={code} value={code}>{libelle}</option>
                    ))}
                  </select>
                  {genresDisponibles.length > 1 && (
                    <select
                      value={filtreGenre}
                      onChange={(e) => setFiltreGenre(e.target.value)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
                    >
                      <option value="">Tous les genres</option>
                      {genresDisponibles.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  )}
                  <span className="text-xs text-slate-400">
                    {lignesFiltrees.length} / {lignes.length} ligne{lignes.length > 1 ? 's' : ''}
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

              <div className="max-h-[60vh] overflow-y-auto rounded-md border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-1.5 pl-3 pr-2">#</th>
                      <th className="py-1.5 pr-2">Heure</th>
                      <th className="py-1.5 pr-2">Durée</th>
                      <th className="py-1.5 pr-2">Programme</th>
                      <th className="py-1.5 pr-2">Type</th>
                      <th className="py-1.5 pr-2">Genre</th>
                      <th className="py-1.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignesFiltrees.map((l) => (
                      <tr
                        key={l.id}
                        id={`pige-ligne-${l.id}`}
                        className={`border-b border-slate-100 transition-colors duration-700 ${
                          l.id === ligneFlashId ? 'bg-snrt-navy/10' : l.chevauchement ? 'bg-amber-50' : ''
                        }`}
                      >
                        <td className="py-1 pl-3 pr-2 text-slate-400">{l.ordre}</td>
                        <td className="whitespace-nowrap py-1 pr-2 text-slate-600">
                          {(l.heure_debut ?? '').slice(0, 8)} – {(l.heure_fin ?? '').slice(0, 8)}
                        </td>
                        <td className="whitespace-nowrap py-1 pr-2 text-slate-600">{secondesEnHms(l.duree_secondes)}</td>
                        <td className="py-1 pr-2 text-slate-700">
                          <span className="flex items-center gap-1">
                            {l.est_sous_ligne && <CornerDownRight size={12} className="shrink-0 text-slate-400" />}
                            {l.programme}
                          </span>
                        </td>
                        <td className="py-1 pr-2 text-slate-600">{LIBELLES_TYPE[l.type_element] ?? l.type_element}</td>
                        <td className="py-1 pr-2 text-slate-500">
                          {[l.code_genre, l.genre_niv1, l.genre_niv2].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="py-1 pr-2">
                          {l.chevauchement && (
                            <span title="Chevauchement avec la ligne précédente — importé tel quel.">
                              <TriangleAlert size={13} className="text-amber-600" />
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {importOuvert && (
        <PanneauImportPige
          chaineActive={chaineActive}
          onFermer={() => setImportOuvert(false)}
          onImporte={importe}
          onRafraichir={(nouveaux) => rechargerImports(nouveaux?.[0]?.id ?? undefined)}
        />
      )}
    </div>
  )
}
