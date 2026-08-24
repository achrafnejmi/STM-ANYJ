import { useId, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Upload, TriangleAlert } from 'lucide-react'
import { creerPlanMedia, creerElementsSecondaires } from '../lib/db.js'
import { enregistrerAction } from '../lib/undoManager.js'
import { lireUtilisateur } from '../lib/session.js'
import { estFichierPlanMedia, parserFeuillePlanMedia, apparierProposition, revaliderLignes } from '../lib/importPlanMedia.js'
import { heureHMSEnSecondes, secondesEnHeureHMS } from '../lib/planMedia.js'
import { aujourdHuiISO, parserDateFrancaiseLongue } from '../lib/semaine.js'
import Modal from './Modal.jsx'

const LIBELLES_TYPE = {
  BANDE_ANNONCE: 'Bande-annonce',
  ECRAN_PUBLICITAIRE: 'Écran publicitaire',
  HABILLAGE: 'Habillage',
  AUTOPROMOTION: 'Autopromotion',
  SPOT: 'Spot',
}
const TYPES_CHOIX = ['BANDE_ANNONCE', 'SPOT', 'AUTOPROMOTION']

// Import Plan média Excel (P26) — étape FICHIER (dépôt + date/nom du nouveau
// document) puis étape APERCU (propose → modifiable → confirme, jamais une
// écriture directe). L'import crée TOUJOURS un nouveau document plan média,
// jamais live par défaut — jamais destructif pour l'existant. Toute
// l'écriture finale passe par un seul enregistrerAction (annulable en bloc,
// Ctrl+Z une fois le nouveau document actif).
export default function PanneauImportPlanMedia({ chaineActive, diffusions, campagnes, programmesParId, onFermer, onImporte }) {
  const [etape, setEtape] = useState('FICHIER')
  const [nomFichier, setNomFichier] = useState(null)
  const [coupuresFichier, setCoupuresFichier] = useState([])
  const [dateCible, setDateCible] = useState(aujourdHuiISO())
  const [nomDocument, setNomDocument] = useState('')
  const [lignes, setLignes] = useState([])
  const [intervallesParAncre, setIntervallesParAncre] = useState(new Map())
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const idFichier = useId()
  const idDate = useId()
  const idNom = useId()

  async function choisirFichier(e) {
    const fichier = e.target.files?.[0]
    if (!fichier) return
    setErreur(null)
    try {
      const donnees = await fichier.arrayBuffer()
      const workbook = XLSX.read(donnees, { type: 'array' })
      if (!estFichierPlanMedia(workbook)) {
        setErreur("Ce fichier ne semble pas être un plan média (feuille « PM » introuvable).")
        return
      }
      const { titre, coupures } = parserFeuillePlanMedia(workbook)
      setNomFichier(fichier.name)
      setCoupuresFichier(coupures)
      setNomDocument(titre ?? fichier.name.replace(/\.xlsx?$/i, ''))
      const dateDevinee = parserDateFrancaiseLongue(titre)
      if (dateDevinee) setDateCible(dateDevinee)
    } catch (err) {
      setErreur(`Lecture du fichier impossible : ${err.message}`)
    }
  }

  function analyser() {
    const diffusionsCible = diffusions.filter((d) => d.date === dateCible)
    const resultat = apparierProposition({ coupuresFichier, dateCible, diffusionsCible, campagnes, programmesParId })
    setLignes(resultat.lignes)
    setIntervallesParAncre(resultat.intervallesParAncre)
    setEtape('APERCU')
  }

  const invalides = useMemo(() => revaliderLignes(lignes, intervallesParAncre), [lignes, intervallesParAncre])
  const nbAppariees = lignes.filter((l) => l.statutCoupure === 'APPARIEE').length
  const nbRattachables = lignes.filter((l) => l.statutCoupure === 'NON_APPARIEE_RATTACHABLE').length
  const nbInapariables = lignes.filter((l) => l.statutCoupure === 'NON_APPARIABLE').length
  const nbCocheesInvalides = lignes.filter((l) => l.coche && invalides.has(l.id)).length
  const nbRetenues = lignes.filter((l) => l.coche && !invalides.has(l.id)).length

  function majLigne(id, champs) {
    setLignes((prev) => prev.map((l) => (l.id === id ? { ...l, ...champs } : l)))
  }

  async function confirmer() {
    if (nbRetenues === 0 || nbCocheesInvalides > 0) return
    setEnregistrement(true)
    setErreur(null)
    try {
      const nouveauDocument = await creerPlanMedia({ chaine_id: chaineActive.id, nom: nomDocument.trim() || 'Import sans nom', est_live: false, cree_par: lireUtilisateur() })
      const retenues = lignes.filter((l) => l.coche && !invalides.has(l.id))
      const champs = retenues.map((l) => {
        const debutSecondes = heureHMSEnSecondes(l.heureDebut)
        return {
          chaine_id: chaineActive.id,
          plan_media_id: nouveauDocument.id,
          date: dateCible,
          heure_debut: l.heureDebut,
          heure_fin: secondesEnHeureHMS(debutSecondes + l.dureeSec),
          duree_secondes: l.dureeSec,
          apres_transmission_id: l.apresTransmissionId,
          type: l.type,
          libelle: l.libelle,
          campagne_id: l.type === 'BANDE_ANNONCE' ? l.campagneId : null,
          origine: 'MANUELLE',
          run_id: null,
        }
      })
      const creees = await creerElementsSecondaires(champs)
      await enregistrerAction({
        chaineId: chaineActive.id,
        ecran: 'PLAN_MEDIA',
        documentId: nouveauDocument.id,
        libelle: `Import « ${nomFichier ?? 'plan média'} » (${creees.length} élément${creees.length > 1 ? 's' : ''})`,
        operations: creees.map((e) => ({ table: 'element_secondaire', type: 'INSERT', id: e.id, apres: e })),
      })
      onImporte(nouveauDocument, creees)
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  return (
    <Modal titre="Importer un plan média" onFermer={onFermer} large={etape === 'APERCU'}>
      {etape === 'FICHIER' && (
        <div className="space-y-4 text-sm">
          <div>
            <label htmlFor={idFichier} className="mb-1 block text-xs font-medium text-slate-700">
              Fichier Excel (feuille « PM »)
            </label>
            <input
              id={idFichier}
              type="file"
              accept=".xlsx,.xls"
              onChange={choisirFichier}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
            {nomFichier && <p className="mt-1 text-xs text-slate-500">{nomFichier} — {coupuresFichier.reduce((n, c) => n + c.lignes.length, 0)} élément(s) lus.</p>}
          </div>

          {coupuresFichier.length > 0 && (
            <>
              <div>
                <label htmlFor={idDate} className="mb-1 block text-xs font-medium text-slate-700">
                  Date cible dans la grille live
                </label>
                <input
                  id={idDate}
                  type="date"
                  value={dateCible}
                  onChange={(e) => setDateCible(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                <p className="mt-1 text-xs text-slate-500">Préremplie depuis le titre du fichier — à vérifier avant d'analyser.</p>
              </div>
              <div>
                <label htmlFor={idNom} className="mb-1 block text-xs font-medium text-slate-700">
                  Nom du nouveau plan média
                </label>
                <input
                  id={idNom}
                  type="text"
                  value={nomDocument}
                  onChange={(e) => setNomDocument(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={analyser}
                className="w-full rounded-md bg-snrt-navy px-3 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover"
              >
                Analyser
              </button>
            </>
          )}

          {erreur && <p className="text-xs text-red-600">{erreur}</p>}
        </div>
      )}

      {etape === 'APERCU' && (
        <div className="space-y-4 text-sm">
          <p className="text-xs text-slate-600">
            {nbAppariees} ligne{nbAppariees > 1 ? 's' : ''} appariée{nbAppariees > 1 ? 's' : ''} (cochée{nbAppariees > 1 ? 's' : ''} par défaut)
            {nbRattachables > 0 && ` · ${nbRattachables} non appariée${nbRattachables > 1 ? 's' : ''} mais rattachable${nbRattachables > 1 ? 's' : ''} (décochée${nbRattachables > 1 ? 's' : ''})`}
            {nbInapariables > 0 && ` · ${nbInapariables} non rattachable${nbInapariables > 1 ? 's' : ''} (aucune transmission ce jour-là)`}
          </p>

          <div className="max-h-[55vh] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="w-6 py-1.5"></th>
                  <th className="py-1.5 pr-2">Heure</th>
                  <th className="py-1.5 pr-2">Type</th>
                  <th className="py-1.5 pr-2">Libellé</th>
                  <th className="py-1.5 pr-2">Campagne</th>
                  <th className="py-1.5 pr-2">Coupure</th>
                  <th className="py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => {
                  const enConflit = l.coche && invalides.has(l.id)
                  const desactivee = l.statutCoupure === 'NON_APPARIABLE'
                  return (
                    <tr
                      key={l.id}
                      className={`border-b border-slate-100 ${desactivee ? 'opacity-40' : l.statutCoupure === 'NON_APPARIEE_RATTACHABLE' ? 'bg-amber-50' : ''}`}
                    >
                      <td className="py-1">
                        <input
                          type="checkbox"
                          checked={l.coche}
                          disabled={desactivee}
                          onChange={(e) => majLigne(l.id, { coche: e.target.checked })}
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          type="time"
                          step="1"
                          value={l.heureDebut.slice(0, 8)}
                          disabled={desactivee}
                          onChange={(e) => majLigne(l.id, { heureDebut: `${e.target.value}` })}
                          className="w-24 rounded border border-slate-300 px-1 py-0.5 text-xs disabled:bg-slate-100"
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <select
                          value={l.type}
                          disabled={desactivee}
                          onChange={(e) => majLigne(l.id, { type: e.target.value })}
                          className="rounded border border-slate-300 px-1 py-0.5 text-xs disabled:bg-slate-100"
                        >
                          {TYPES_CHOIX.map((t) => (
                            <option key={t} value={t}>{LIBELLES_TYPE[t]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          type="text"
                          value={l.libelle}
                          disabled={desactivee}
                          onChange={(e) => majLigne(l.id, { libelle: e.target.value })}
                          className="w-40 rounded border border-slate-300 px-1 py-0.5 text-xs disabled:bg-slate-100"
                        />
                      </td>
                      <td className="py-1 pr-2">
                        {l.type === 'BANDE_ANNONCE' ? (
                          <select
                            value={l.campagneId ?? ''}
                            disabled={desactivee}
                            onChange={(e) => majLigne(l.id, { campagneId: e.target.value || null })}
                            className="rounded border border-slate-300 px-1 py-0.5 text-xs disabled:bg-slate-100"
                          >
                            <option value="">—</option>
                            {campagnes.map((c) => (
                              <option key={c.id} value={c.id}>{programmesParId.get(c.programme_id)?.titre ?? '—'}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-1 pr-2">
                        {l.statutCoupure === 'NON_APPARIEE_RATTACHABLE' ? (
                          <select
                            value={l.apresTransmissionId ?? ''}
                            onChange={(e) => majLigne(l.id, { apresTransmissionId: e.target.value })}
                            className="w-48 rounded border border-amber-300 bg-white px-1 py-0.5 text-xs"
                          >
                            {l.alternativesCoupure.map((alt) => (
                              <option key={alt.apresTransmissionId} value={alt.apresTransmissionId}>{alt.label}</option>
                            ))}
                          </select>
                        ) : l.statutCoupure === 'NON_APPARIABLE' ? (
                          <span className="text-slate-400">Aucune transmission ce jour-là</span>
                        ) : (
                          <span className="text-emerald-600">appariée</span>
                        )}
                      </td>
                      <td className="py-1">
                        {enConflit && (
                          <span title="Chevauchement ou hors des bornes de la coupure — ajustez l'heure ou décochez.">
                            <TriangleAlert size={13} className="text-red-600" />
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {nbCocheesInvalides > 0 && (
            <p className="text-xs text-red-600">
              {nbCocheesInvalides} ligne{nbCocheesInvalides > 1 ? 's' : ''} cochée{nbCocheesInvalides > 1 ? 's' : ''} en conflit — corrigez l'heure/la coupure ou décochez-la{nbCocheesInvalides > 1 ? 's' : ''} avant de confirmer.
            </p>
          )}
          {erreur && <p className="text-xs text-red-600">{erreur}</p>}

          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <button type="button" onClick={() => setEtape('FICHIER')} className="text-xs text-slate-500 hover:text-slate-700">
              ← Revenir au fichier
            </button>
            <button
              type="button"
              onClick={confirmer}
              disabled={nbRetenues === 0 || nbCocheesInvalides > 0 || enregistrement}
              className="flex items-center gap-1.5 rounded-md bg-snrt-navy px-3 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
            >
              <Upload size={14} />
              {enregistrement ? 'Import…' : `Confirmer l'import (${nbRetenues})`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
