import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Upload, TriangleAlert, CornerDownRight, Check } from 'lucide-react'
import { CHAINES } from '../lib/chaines.js'
import { estFichierPige, parserFichierPige } from '../lib/importPige.js'
import {
  obtenirImportPigeActif,
  creerImportPige,
  mettreAJourImportPige,
  creerDiffusionsReelles,
} from '../lib/db.js'
import { enregistrerAction } from '../lib/undoManager.js'
import { lireUtilisateur } from '../lib/session.js'
import { formaterDateJJMMAAAA } from '../lib/semaine.js'
import Modal from './Modal.jsx'

const LIBELLES_TYPE = {
  PROGRAMME: 'Programme',
  BA: 'Bande-annonce',
  SPOT: 'Spot',
  AUTO_PROMO: 'Auto-promo',
  COMMUNIQUE: 'Communiqué',
  AUTRE: 'Autre',
}
const TYPES_CHOIX = ['PROGRAMME', 'BA', 'SPOT', 'AUTO_PROMO', 'COMMUNIQUE', 'AUTRE']

function cleGroupe(g) {
  return `${g.chaineNom}__${g.date}`
}

// Import de la pige (P36a) — miroir de PanneauImportPlanMedia : étape FICHIER
// (dépôt + choix des groupes chaîne/date + nom) puis étape APERCU
// (propose → modifiable → confirme, jamais d'écriture directe). Chaque groupe
// retenu devient un import pige nommé (non destructif : un ré-import de la même
// chaîne/date archive le précédent). Toute l'écriture passe par un seul
// enregistrerAction par import (annulable en bloc, écran 'PIGE').
export default function PanneauImportPige({ chaineActive, onFermer, onImporte, onRafraichir }) {
  const [etape, setEtape] = useState('FICHIER') // FICHIER | APERCU | TERMINE
  const [nomFichier, setNomFichier] = useState(null)
  const [meta, setMeta] = useState({})
  const [groupes, setGroupes] = useState([])
  const [config, setConfig] = useState({}) // cleGroupe → { retenue, nom, chaineIdChoisie }
  const [apercu, setApercu] = useState([]) // groupes retenus, lignes éditables
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [resultat, setResultat] = useState(null) // { imports: [...] } après enregistrement
  const [reinitCle, setReinitCle] = useState(0) // force le reset de l'<input type=file>

  // Vide tout l'état de saisie pour enchaîner un autre fichier sans fermer la
  // modale (les imports déjà faits sont conservés en base et rafraîchis côté
  // écran via onRafraichir).
  function reinitialiser() {
    setEtape('FICHIER')
    setNomFichier(null)
    setMeta({})
    setGroupes([])
    setConfig({})
    setApercu([])
    setErreur(null)
    setResultat(null)
    setEnregistrement(false)
    setReinitCle((n) => n + 1)
  }

  async function choisirFichier(e) {
    const fichier = e.target.files?.[0]
    if (!fichier) return
    setErreur(null)
    try {
      const donnees = await fichier.arrayBuffer()
      const workbook = XLSX.read(donnees, { type: 'array' })
      if (!estFichierPige(workbook)) {
        setErreur("Ce fichier ne ressemble pas à une pige (feuille « Data » avec les colonnes Chaîne / H.Début / Code Genre introuvable).")
        return
      }
      const { meta: metaLue, groupes: groupesLus } = parserFichierPige(workbook, CHAINES)
      if (groupesLus.length === 0) {
        setErreur('Aucune ligne exploitable trouvée dans la feuille « Data ».')
        return
      }
      const configInitiale = {}
      for (const g of groupesLus) {
        configInitiale[cleGroupe(g)] = {
          retenue: Boolean(g.chaineId), // chaîne non SNRT (ex. 2M) → décochée par défaut
          nom: `Pige ${g.chaineNom} — ${formaterDateJJMMAAAA(g.date)}`,
          chaineIdChoisie: g.chaineId,
        }
      }
      setNomFichier(fichier.name)
      setMeta(metaLue)
      setGroupes(groupesLus)
      setConfig(configInitiale)
      setEtape('FICHIER')
    } catch (err) {
      setErreur(`Lecture du fichier impossible : ${err.message}`)
    }
  }

  function majConfig(cle, champs) {
    setConfig((prev) => ({ ...prev, [cle]: { ...prev[cle], ...champs } }))
  }

  function analyser() {
    const retenus = groupes
      .filter((g) => config[cleGroupe(g)]?.retenue)
      .map((g) => {
        const c = config[cleGroupe(g)]
        return {
          cle: cleGroupe(g),
          chaineNom: g.chaineNom,
          chaineId: c.chaineIdChoisie ?? g.chaineId,
          date: g.date,
          jour: g.jour,
          nom: c.nom.trim() || `Pige ${g.chaineNom}`,
          lignes: g.lignes.map((l) => ({ ...l, retenue: true })),
        }
      })
      .filter((g) => g.chaineId)
    if (retenus.length === 0) {
      setErreur('Sélectionnez au moins un groupe rattaché à une chaîne SNRT.')
      return
    }
    setErreur(null)
    setApercu(retenus)
    setEtape('APERCU')
  }

  function majLigne(cleG, ordre, champs) {
    setApercu((prev) =>
      prev.map((g) =>
        g.cle === cleG ? { ...g, lignes: g.lignes.map((l) => (l.ordre === ordre ? { ...l, ...champs } : l)) } : g
      )
    )
  }

  const totalRetenues = useMemo(
    () => apercu.reduce((n, g) => n + g.lignes.filter((l) => l.retenue).length, 0),
    [apercu]
  )

  async function confirmer() {
    if (totalRetenues === 0) return
    setEnregistrement(true)
    setErreur(null)
    try {
      const importsCrees = []
      for (const g of apercu) {
        const lignesRetenues = g.lignes.filter((l) => l.retenue)
        if (lignesRetenues.length === 0) continue

        const operations = []
        const ancienActif = await obtenirImportPigeActif(g.chaineId, g.date)
        if (ancienActif) {
          const ancienDesactive = await mettreAJourImportPige(ancienActif.id, { actif: false })
          operations.push({
            table: 'import_pige',
            type: 'UPDATE',
            id: ancienActif.id,
            avant: ancienActif,
            apres: ancienDesactive,
          })
        }

        const nouvelImport = await creerImportPige({
          nom: g.nom,
          chaine_id: g.chaineId,
          chaine_nom: g.chaineNom,
          date: g.date,
          jour: g.jour ?? null,
          source_fichier: nomFichier,
          analyse_le: meta.analyseLe ?? null,
          nb_lignes: lignesRetenues.length,
          actif: true,
          cree_par: lireUtilisateur(),
        })
        operations.push({ table: 'import_pige', type: 'INSERT', id: nouvelImport.id, apres: nouvelImport })

        const champs = lignesRetenues.map((l) => ({
          import_pige_id: nouvelImport.id,
          chaine_id: g.chaineId,
          chaine_nom: g.chaineNom,
          date: g.date,
          jour: g.jour ?? null,
          ordre: l.ordre,
          code_ecran: l.codeEcran ?? null,
          code_program: l.codeProgram ?? null,
          programme: (l.programme ?? '').trim() || '(sans titre)',
          heure_debut: l.heureDebutHorloge,
          heure_fin: l.heureFinHorloge,
          debut_secondes: l.debutSecondes,
          fin_secondes: l.finSecondes,
          duree_secondes: l.dureeSecondes,
          libelle_complementaire: l.libelleComplementaire ?? null,
          code_genre: l.codeGenre ?? null,
          genre_niv1: l.genreNiv1 ?? null,
          genre_niv2: l.genreNiv2 ?? null,
          genre_niv3: l.genreNiv3 ?? null,
          type_element: l.typeElement,
          est_sous_ligne: l.estSousLigne,
          parent_ordre: l.parentOrdre ?? null,
          chevauchement: l.chevauchement,
        }))
        const creees = await creerDiffusionsReelles(champs)
        operations.push(...creees.map((d) => ({ table: 'diffusion_reelle', type: 'INSERT', id: d.id, apres: d })))

        await enregistrerAction({
          chaineId: g.chaineId,
          ecran: 'PIGE',
          documentId: nouvelImport.id,
          libelle: `Import pige « ${nomFichier ?? 'pige'} » — ${g.chaineNom} ${formaterDateJJMMAAAA(g.date)} (${creees.length} ligne${creees.length > 1 ? 's' : ''})`,
          operations,
        })
        importsCrees.push(nouvelImport)
      }
      // Les imports sont en base : on rafraîchit l'écran derrière la modale et
      // on affiche l'étape TERMINE (fermer, ou enchaîner un autre fichier).
      onRafraichir?.(importsCrees)
      setResultat({ imports: importsCrees })
      setEtape('TERMINE')
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  return (
    <Modal titre="Importer une pige" onFermer={onFermer} large={etape === 'APERCU'}>
      {etape === 'FICHIER' && (
        <div className="space-y-4 text-sm">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Fichier Excel de pige (feuille « Data »)</label>
            <input
              key={reinitCle}
              type="file"
              accept=".xlsx,.xls"
              onChange={choisirFichier}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
            {meta.analyseLe && <p className="mt-1 text-xs text-slate-500">Analyse effectuée le {meta.analyseLe}{meta.user ? ` par ${meta.user}` : ''}.</p>}
          </div>

          {groupes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-700">Groupes détectés (une chaîne + une date = un import)</p>
              {groupes.map((g) => {
                const cle = cleGroupe(g)
                const c = config[cle] ?? {}
                return (
                  <div key={cle} className={`rounded-md border p-3 ${g.chaineId ? 'border-slate-200' : 'border-amber-300 bg-amber-50'}`}>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(c.retenue)}
                        onChange={(e) => majConfig(cle, { retenue: e.target.checked })}
                      />
                      <span className="font-medium text-slate-800">{g.chaineNom}</span>
                      <span className="text-slate-500">· {formaterDateJJMMAAAA(g.date)}{g.jour ? ` (${g.jour})` : ''}</span>
                      <span className="text-slate-400">· {g.lignes.length} ligne{g.lignes.length > 1 ? 's' : ''}</span>
                      {!g.chaineId && (
                        <span className="ml-auto rounded bg-amber-200 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                          chaîne non reconnue
                        </span>
                      )}
                    </label>
                    {c.retenue && (
                      <div className="mt-2 space-y-2 pl-6">
                        {!g.chaineId && (
                          <div>
                            <label className="mb-0.5 block text-[11px] font-medium text-slate-600">Rattacher à une chaîne SNRT</label>
                            <select
                              value={c.chaineIdChoisie ?? ''}
                              onChange={(e) => majConfig(cle, { chaineIdChoisie: e.target.value || null })}
                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            >
                              <option value="">— choisir —</option>
                              {CHAINES.map((ch) => (
                                <option key={ch.id} value={ch.id}>{ch.nom}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div>
                          <label className="mb-0.5 block text-[11px] font-medium text-slate-600">Nom de l'import</label>
                          <input
                            type="text"
                            value={c.nom ?? ''}
                            onChange={(e) => majConfig(cle, { nom: e.target.value })}
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              {chaineActive && !groupes.some((g) => g.chaineId === chaineActive.id) && (
                <p className="text-xs text-slate-500">
                  Note : ce fichier ne concerne pas la chaîne active ({chaineActive.nom}). L'import sera rattaché à la chaîne du fichier.
                </p>
              )}
              <button
                type="button"
                onClick={analyser}
                className="w-full rounded-md bg-snrt-navy px-3 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover"
              >
                Analyser
              </button>
            </div>
          )}

          {erreur && <p className="text-xs text-red-600">{erreur}</p>}
        </div>
      )}

      {etape === 'APERCU' && (
        <div className="space-y-5 text-sm">
          {apercu.map((g) => {
            const retenues = g.lignes.filter((l) => l.retenue)
            const parType = TYPES_CHOIX.reduce((acc, t) => {
              acc[t] = retenues.filter((l) => l.typeElement === t).length
              return acc
            }, {})
            const nbChev = g.lignes.filter((l) => l.chevauchement).length
            const nbSous = g.lignes.filter((l) => l.estSousLigne).length
            return (
              <div key={g.cle} className="space-y-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-sm font-semibold text-slate-900">{g.chaineNom} · {formaterDateJJMMAAAA(g.date)}</h3>
                  <p className="text-xs text-slate-500">
                    {retenues.length} ligne{retenues.length > 1 ? 's' : ''} retenue{retenues.length > 1 ? 's' : ''}
                    {' · '}{parType.PROGRAMME} prog. · {parType.SPOT} spots · {parType.AUTO_PROMO} auto-promos · {parType.COMMUNIQUE} comm.
                    {nbSous > 0 && ` · ${nbSous} sous-ligne${nbSous > 1 ? 's' : ''}`}
                    {nbChev > 0 && ` · ${nbChev} chevauchement${nbChev > 1 ? 's' : ''} signalé${nbChev > 1 ? 's' : ''}`}
                  </p>
                </div>
                <div className="max-h-[50vh] overflow-y-auto rounded-md border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="w-6 py-1.5"></th>
                        <th className="py-1.5 pr-2">Heure</th>
                        <th className="py-1.5 pr-2">Durée</th>
                        <th className="py-1.5 pr-2">Programme</th>
                        <th className="py-1.5 pr-2">Type</th>
                        <th className="py-1.5 pr-2">Genre</th>
                        <th className="py-1.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.lignes.map((l) => (
                        <tr key={l.ordre} className={`border-b border-slate-100 ${l.chevauchement ? 'bg-amber-50' : ''}`}>
                          <td className="py-1">
                            <input
                              type="checkbox"
                              checked={l.retenue}
                              onChange={(e) => majLigne(g.cle, l.ordre, { retenue: e.target.checked })}
                            />
                          </td>
                          <td className="whitespace-nowrap py-1 pr-2 text-slate-600">
                            {l.heureDebutHorloge} – {l.heureFinHorloge}
                          </td>
                          <td className="whitespace-nowrap py-1 pr-2 text-slate-600">{l.dureeTexte}</td>
                          <td className="py-1 pr-2">
                            <div className="flex items-center gap-1">
                              {l.estSousLigne && <CornerDownRight size={12} className="shrink-0 text-slate-400" />}
                              <input
                                type="text"
                                value={l.programme}
                                onChange={(e) => majLigne(g.cle, l.ordre, { programme: e.target.value })}
                                className="w-48 rounded border border-slate-300 px-1 py-0.5 text-xs"
                              />
                            </div>
                          </td>
                          <td className="py-1 pr-2">
                            <select
                              value={l.typeElement}
                              onChange={(e) => majLigne(g.cle, l.ordre, { typeElement: e.target.value })}
                              className="rounded border border-slate-300 px-1 py-0.5 text-xs"
                            >
                              {TYPES_CHOIX.map((t) => (
                                <option key={t} value={t}>{LIBELLES_TYPE[t]}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1 pr-2 text-slate-500">
                            {[l.codeGenre, l.genreNiv1, l.genreNiv2].filter(Boolean).join(' · ') || '—'}
                          </td>
                          <td className="py-1">
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
              </div>
            )
          })}

          {erreur && <p className="text-xs text-red-600">{erreur}</p>}

          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <button type="button" onClick={() => setEtape('FICHIER')} className="text-xs text-slate-500 hover:text-slate-700">
              ← Revenir au fichier
            </button>
            <button
              type="button"
              onClick={confirmer}
              disabled={totalRetenues === 0 || enregistrement}
              className="flex items-center gap-1.5 rounded-md bg-snrt-navy px-3 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
            >
              <Upload size={14} />
              {enregistrement ? 'Import…' : `Confirmer l'import (${totalRetenues})`}
            </button>
          </div>
        </div>
      )}

      {etape === 'TERMINE' && (
        <div className="space-y-4 text-sm">
          <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
            <Check size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">
                {resultat.imports.length} pige{resultat.imports.length > 1 ? 's' : ''} importée{resultat.imports.length > 1 ? 's' : ''}.
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
                {resultat.imports.map((imp) => (
                  <li key={imp.id}>{imp.nom} · {imp.nb_lignes} ligne{imp.nb_lignes > 1 ? 's' : ''}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={reinitialiser}
              className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <Upload size={14} />
              Importer une autre pige
            </button>
            <button
              type="button"
              onClick={() => onImporte(resultat.imports)}
              className="rounded-md bg-snrt-navy px-3 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover"
            >
              Terminé
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
