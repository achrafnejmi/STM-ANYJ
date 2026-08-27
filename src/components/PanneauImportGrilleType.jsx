import { useId, useState } from 'react'
import * as XLSX from 'xlsx'
import { Upload, TriangleAlert } from 'lucide-react'
import { creerGrilleType, creerBlocsGrilleType } from '../lib/db.js'
import { enregistrerAction } from '../lib/undoManager.js'
import { lireUtilisateur } from '../lib/session.js'
import { estFichierGrilleType, parserFeuilleGrilleType, apparierProposition, calculerHeureFin } from '../lib/importGrilleType.js'
import { GENRES } from '../lib/genres.js'
import Modal from './Modal.jsx'

const JOURS_ABBR = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] // 0=lundi..6=dimanche

// Import Grille type Excel (P28b Partie E) — étape FICHIER (dépôt + nom du
// nouveau document) puis étape APERCU (propose → modifiable → confirme,
// jamais une écriture directe), même structure que PanneauImportPlanMedia.jsx
// (P26). L'import crée TOUJOURS un nouveau document grille_type, jamais live
// par défaut — jamais destructif pour l'existant.
export default function PanneauImportGrilleType({ chaineActive, onFermer, onImporte }) {
  const [etape, setEtape] = useState('FICHIER')
  const [nomFichier, setNomFichier] = useState(null)
  const [coupuresFichier, setCoupuresFichier] = useState([])
  const [nomDocument, setNomDocument] = useState('')
  const [lignes, setLignes] = useState([])
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const idFichier = useId()
  const idNom = useId()

  async function choisirFichier(e) {
    const fichier = e.target.files?.[0]
    if (!fichier) return
    setErreur(null)
    try {
      const donnees = await fichier.arrayBuffer()
      const workbook = XLSX.read(donnees, { type: 'array' })
      if (!estFichierGrilleType(workbook)) {
        setErreur("Ce fichier ne semble pas être une grille type (ligne d'en-tête avec les jours introuvable).")
        return
      }
      const { titre, coupures } = parserFeuilleGrilleType(workbook)
      setNomFichier(fichier.name)
      setCoupuresFichier(coupures)
      setNomDocument(titre ?? fichier.name.replace(/\.xlsx?$/i, ''))
    } catch (err) {
      setErreur(`Lecture du fichier impossible : ${err.message}`)
    }
  }

  function analyser() {
    setLignes(apparierProposition(coupuresFichier))
    setEtape('APERCU')
  }

  const nbAmbre = lignes.filter((l) => l.ambre).length
  const nbCocheesSansGenre = lignes.filter((l) => l.coche && !l.genre).length
  const nbRetenues = lignes.filter((l) => l.coche && l.genre).length

  function majLigne(id, champs) {
    setLignes((prev) => prev.map((l) => (l.id === id ? { ...l, ...champs } : l)))
  }

  function basculerJour(id, jour) {
    setLignes((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, jours: l.jours.includes(jour) ? l.jours.filter((j) => j !== jour) : [...l.jours, jour].sort() } : l
      )
    )
  }

  async function confirmer() {
    if (nbRetenues === 0 || nbCocheesSansGenre > 0) return
    setEnregistrement(true)
    setErreur(null)
    try {
      const nouveauDocument = await creerGrilleType({
        chaine_id: chaineActive.id,
        nom: nomDocument.trim() || 'Import sans nom',
        est_live: false,
        date_debut: null,
        date_fin: null,
        cree_par: lireUtilisateur(),
      })
      const retenues = lignes.filter((l) => l.coche && l.genre)
      const champs = retenues.map((l) => ({
        chaine_id: chaineActive.id,
        grille_type_id: nouveauDocument.id,
        nom: l.nom.trim(),
        heure_debut: l.heureDebut,
        heure_fin: calculerHeureFin(l.heureDebut, l.dureeMinutes),
        jours: l.jours,
        frequence: 'Quotidien',
        genre_attendu: l.genre,
      }))
      const creees = await creerBlocsGrilleType(champs)
      await enregistrerAction({
        chaineId: chaineActive.id,
        ecran: 'GRILLE_TYPE',
        documentId: nouveauDocument.id,
        libelle: `Import « ${nomFichier ?? 'grille type'} » (${creees.length} bloc${creees.length > 1 ? 's' : ''})`,
        operations: creees.map((b) => ({ table: 'bloc_grille_type', type: 'INSERT', id: b.id, apres: b })),
      })
      onImporte(nouveauDocument, creees)
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  return (
    <Modal titre="Importer une grille type" onFermer={onFermer} large={etape === 'APERCU'}>
      {etape === 'FICHIER' && (
        <div className="space-y-4 text-sm">
          <div>
            <label htmlFor={idFichier} className="mb-1 block text-xs font-medium text-slate-700">
              Fichier Excel (grille visuelle, jours en colonnes)
            </label>
            <input
              id={idFichier}
              type="file"
              accept=".xlsx,.xls"
              onChange={choisirFichier}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
            {nomFichier && <p className="mt-1 text-xs text-slate-500">{nomFichier} — {coupuresFichier.length} bloc(s) détecté(s).</p>}
          </div>

          {coupuresFichier.length > 0 && (
            <>
              <div>
                <label htmlFor={idNom} className="mb-1 block text-xs font-medium text-slate-700">
                  Nom du nouveau document
                </label>
                <input
                  id={idNom}
                  type="text"
                  value={nomDocument}
                  onChange={(e) => setNomDocument(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                <p className="mt-1 text-xs text-slate-500">Jamais live par défaut — à définir comme live ensuite si besoin.</p>
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
            {lignes.length} bloc{lignes.length > 1 ? 's' : ''} détecté{lignes.length > 1 ? 's' : ''}
            {nbAmbre > 0 && ` · ${nbAmbre} à vérifier (genre ou durée incertain${nbAmbre > 1 ? 's' : ''}, en ambre)`}
          </p>

          <div className="max-h-[55vh] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="w-6 py-1.5"></th>
                  <th className="py-1.5 pr-2">Nom</th>
                  <th className="py-1.5 pr-2">Début</th>
                  <th className="py-1.5 pr-2">Durée (min)</th>
                  <th className="py-1.5 pr-2">Jours</th>
                  <th className="py-1.5 pr-2">Genre</th>
                  <th className="py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => {
                  const bloque = l.coche && !l.genre
                  return (
                    <tr key={l.id} className={`border-b border-slate-100 ${l.ambre ? 'bg-amber-50' : ''}`}>
                      <td className="py-1">
                        <input
                          type="checkbox"
                          checked={l.coche}
                          disabled={!l.genre}
                          onChange={(e) => majLigne(l.id, { coche: e.target.checked })}
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          type="text"
                          value={l.nom}
                          onChange={(e) => majLigne(l.id, { nom: e.target.value })}
                          className="w-56 rounded border border-slate-300 px-1 py-0.5 text-xs"
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          type="time"
                          value={l.heureDebut}
                          onChange={(e) => majLigne(l.id, { heureDebut: e.target.value })}
                          className="w-20 rounded border border-slate-300 px-1 py-0.5 text-xs"
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          type="number"
                          min="1"
                          value={l.dureeMinutes}
                          onChange={(e) => majLigne(l.id, { dureeMinutes: Number(e.target.value) || 1 })}
                          className="w-16 rounded border border-slate-300 px-1 py-0.5 text-xs"
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <div className="flex gap-0.5">
                          {JOURS_ABBR.map((j, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => basculerJour(l.id, i)}
                              className={`h-5 w-5 rounded text-[10px] font-semibold ${
                                l.jours.includes(i) ? 'bg-snrt-navy text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              }`}
                            >
                              {j}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="py-1 pr-2">
                        <select
                          value={l.genre}
                          onChange={(e) => majLigne(l.id, { genre: e.target.value, coche: e.target.value ? l.coche : false })}
                          className="rounded border border-slate-300 px-1 py-0.5 text-xs"
                        >
                          <option value="">—</option>
                          {GENRES.map((g) => (
                            <option key={g.fr} value={g.fr}>{g.fr}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1">
                        {bloque && (
                          <span title="Genre requis avant de pouvoir cocher cette ligne.">
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

          {erreur && <p className="text-xs text-red-600">{erreur}</p>}

          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <button type="button" onClick={() => setEtape('FICHIER')} className="text-xs text-slate-500 hover:text-slate-700">
              ← Revenir au fichier
            </button>
            <button
              type="button"
              onClick={confirmer}
              disabled={nbRetenues === 0 || nbCocheesSansGenre > 0 || enregistrement}
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
