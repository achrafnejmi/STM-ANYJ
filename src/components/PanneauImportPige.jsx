import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Upload, TriangleAlert, CornerDownRight } from 'lucide-react'
import { CHAINES } from '../lib/chaines.js'
import { estFichierPige, parserFichierPige, secondesEnHms, TYPES_ELEMENT, LIBELLES_TYPE_ELEMENT } from '../lib/importPige.js'
import { formaterDateJJMMAAAA } from '../lib/semaine.js'
import Modal from './Modal.jsx'

function cleGroupe(g) {
  return `${g.chaineNom}__${g.date}`
}

// Lignes du parseur (camelCase) → format colonnes DB (diffusion_reelle), + un
// drapeau `retenue` transitoire pour la sélection dans l'aperçu.
function versLigneDb(l) {
  return {
    ordre: l.ordre,
    code_ecran: l.codeEcran ?? null,
    code_program: l.codeProgram ?? null,
    programme: l.programme,
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
    retenue: true,
  }
}

// Import de la pige (P36a, refondu P36c) — étape FICHIER (dépôt + choix des
// groupes chaîne/date + nom) puis APERCU (cases à cocher + Type / Programme
// modifiables). Le panneau NE PERSISTE RIEN : « Charger l'aperçu » renvoie des
// BROUILLONS à l'écran Pige, qui les enregistre explicitement ensuite.
export default function PanneauImportPige({ chaineActive, onFermer, onBrouillon }) {
  const [etape, setEtape] = useState('FICHIER') // FICHIER | APERCU
  const [nomFichier, setNomFichier] = useState(null)
  const [meta, setMeta] = useState({})
  const [groupes, setGroupes] = useState([])
  const [config, setConfig] = useState({}) // cleGroupe → { retenue, nom, chaineIdChoisie }
  const [apercu, setApercu] = useState([]) // groupes retenus, lignes éditables (format DB)
  const [erreur, setErreur] = useState(null)

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
          lignes: g.lignes.map(versLigneDb),
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

  // Renvoie les brouillons (retenus uniquement) à l'écran Pige ; ne touche pas
  // la base.
  function chargerApercu() {
    const brouillons = apercu
      .map((g) => ({
        chaineId: g.chaineId,
        chaineNom: g.chaineNom,
        date: g.date,
        jour: g.jour,
        nom: g.nom,
        source_fichier: nomFichier,
        analyse_le: meta.analyseLe ?? null,
        // `retenue` reste sur les lignes (transitoire, ignoré à l'écriture) —
        // l'écran Pige mappe les colonnes explicitement.
        lignes: g.lignes.filter((l) => l.retenue),
      }))
      .filter((g) => g.lignes.length > 0)
    if (brouillons.length === 0) return
    onBrouillon(brouillons)
    onFermer()
  }

  return (
    <Modal titre="Importer une pige" onFermer={onFermer} large={etape === 'APERCU'}>
      {etape === 'FICHIER' && (
        <div className="space-y-4 text-sm">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Fichier Excel de pige (feuille « Data »)</label>
            <input
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
            const parType = TYPES_ELEMENT.reduce((acc, t) => {
              acc[t] = retenues.filter((l) => l.type_element === t).length
              return acc
            }, {})
            const nbChev = g.lignes.filter((l) => l.chevauchement).length
            const nbSous = g.lignes.filter((l) => l.est_sous_ligne).length
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
                            {l.heure_debut} – {l.heure_fin}
                          </td>
                          <td className="whitespace-nowrap py-1 pr-2 text-slate-600">{secondesEnHms(l.duree_secondes)}</td>
                          <td className="py-1 pr-2">
                            <div className="flex items-center gap-1">
                              {l.est_sous_ligne && <CornerDownRight size={12} className="shrink-0 text-slate-400" />}
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
                              value={l.type_element}
                              onChange={(e) => majLigne(g.cle, l.ordre, { type_element: e.target.value })}
                              className="rounded border border-slate-300 px-1 py-0.5 text-xs"
                            >
                              {TYPES_ELEMENT.map((t) => (
                                <option key={t} value={t}>{LIBELLES_TYPE_ELEMENT[t]}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1 pr-2 text-slate-500">
                            {[l.code_genre, l.genre_niv1, l.genre_niv2].filter(Boolean).join(' · ') || '—'}
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
              onClick={chargerApercu}
              disabled={totalRetenues === 0}
              className="flex items-center gap-1.5 rounded-md bg-snrt-navy px-3 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
            >
              <Upload size={14} />
              Charger l'aperçu ({totalRetenues})
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
