import { useState } from 'react'
import { Upload, CheckCircle2, AlertTriangle, Radio, Loader2 } from 'lucide-react'
import { parseFichierSTM } from '../lib/stm-import.js'
import { trouverProgrammeParTitreEtChaine, creerProgramme, creerDiffusionsLineaires } from '../lib/db.js'

function lireFichier(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

// Regroupe les lignes valides par (titre, chaine) — un seul `programme` Supabase
// par couple, quel que soit le nombre de créneaux (§5.1 plan Phase 5).
function cleProgrammeImport(titre, chaine) {
  return JSON.stringify([titre, chaine])
}

async function synchroniserAvecSupabase(programmesValides) {
  const groupes = new Map()
  for (const p of programmesValides) {
    const titre = p.titre.trim()
    const chaine = p.chaine.trim()
    const cle = cleProgrammeImport(titre, chaine)
    if (!groupes.has(cle)) groupes.set(cle, { titre, chaine, genre: p.genre || null })
  }

  const idParCle = new Map()
  for (const [cle, { titre, chaine, genre }] of groupes) {
    const existant = await trouverProgrammeParTitreEtChaine(titre, chaine)
    const programme = existant ?? (await creerProgramme({ titre, chaine, genre, cree_par: 'PROGRAMMATION' }))
    idParCle.set(cle, programme.id)
  }

  const lignes = programmesValides.map((p) => {
    const titre = p.titre.trim()
    const chaine = p.chaine.trim()
    return {
      programme_id: idParCle.get(cleProgrammeImport(titre, chaine)),
      chaine,
      date: p.date,
      heure_debut: p.heure_debut,
      heure_fin: p.heure_fin,
      genre: p.genre || null,
      titre_cache: titre,
    }
  })
  if (lignes.length > 0) await creerDiffusionsLineaires(lignes)

  return { programmes: groupes.size, creneaux: lignes.length }
}

export default function ImportSTM({ onImportTermine }) {
  const [chaine, setChaine] = useState('')
  const [programmes, setProgrammes] = useState(null)
  const [planMedia, setPlanMedia] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [importEnCours, setImportEnCours] = useState(false)
  const [messageImport, setMessageImport] = useState(null)

  async function handleFichier(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setErreur(null)
    setMessageImport(null)
    try {
      const donnees = await lireFichier(file)
      const resultat = parseFichierSTM(donnees, { chaine })

      if (resultat.type === 'GRILLE') {
        if (!chaine.trim()) {
          setErreur('Saisissez la chaîne avant d\'importer une grille de programmes.')
          return
        }
        setProgrammes(resultat.programmes)

        const valides = resultat.programmes.filter((p) => !p._anomalie)
        if (valides.length > 0) {
          setImportEnCours(true)
          try {
            const { programmes: nbProgrammes, creneaux } = await synchroniserAvecSupabase(valides)
            setMessageImport(`${nbProgrammes} programme(s) et ${creneaux} créneau(x) synchronisés avec Supabase.`)
            onImportTermine?.()
          } catch (err) {
            setErreur(`Erreur lors de l'enregistrement dans Supabase : ${err.message}`)
          } finally {
            setImportEnCours(false)
          }
        }
      } else {
        setPlanMedia(resultat.planMedia)
      }
    } catch {
      setErreur("Fichier illisible : vérifiez qu'il s'agit bien d'un export xlsx STM.")
    }
  }

  const valides = programmes?.filter((p) => !p._anomalie) ?? []
  const anomalies = programmes?.filter((p) => p._anomalie) ?? []

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="chaine" className="mb-1 block text-sm font-medium text-slate-700">
              Chaîne (requise pour importer une grille)
            </label>
            <input
              id="chaine"
              type="text"
              value={chaine}
              onChange={(e) => setChaine(e.target.value)}
              placeholder="ex. Tamazight"
              className="w-56 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <label
            className={`flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white ${
              importEnCours ? 'opacity-60' : 'cursor-pointer hover:bg-slate-700'
            }`}
          >
            {importEnCours ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {importEnCours ? 'Import en cours…' : 'Importer un xlsx'}
            <input type="file" accept=".xlsx" className="hidden" onChange={handleFichier} disabled={importEnCours} />
          </label>
        </div>
        {erreur && <p className="mt-3 text-sm text-red-600">{erreur}</p>}
        {messageImport && <p className="mt-3 text-sm text-emerald-600">{messageImport}</p>}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
          <CheckCircle2 size={18} className="text-emerald-600" />
          Programmes valides {programmes && `(${valides.length})`}
        </h2>
        {!programmes ? (
          <p className="text-sm text-slate-500">Aucune grille importée pour l'instant.</p>
        ) : valides.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun programme valide dans ce fichier.</p>
        ) : (
          <TableauProgrammes lignes={valides} colonnes={['titre', 'date', 'heure_debut', 'heure_fin', 'chaine']} />
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
          <AlertTriangle size={18} className="text-amber-600" />
          Anomalies {programmes && `(${anomalies.length})`}
        </h2>
        {!programmes ? (
          <p className="text-sm text-slate-500">Aucune grille importée pour l'instant.</p>
        ) : anomalies.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune anomalie détectée.</p>
        ) : (
          <TableauAnomalies lignes={anomalies} />
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
          <Radio size={18} className="text-slate-500" />
          Plan média {planMedia && `(${planMedia.length})`}
          <span className="text-xs font-normal text-slate-400">— info, non sélectionnable</span>
        </h2>
        {!planMedia ? (
          <p className="text-sm text-slate-500">Aucun plan média importé pour l'instant.</p>
        ) : (
          <TableauPlanMedia lignes={planMedia} />
        )}
      </section>
    </div>
  )
}

function TableauProgrammes({ lignes, colonnes }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            {colonnes.map((c) => (
              <th key={c} className="py-2 pr-4 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((p) => (
            <tr key={p.programme_id} className="border-b border-slate-100">
              {colonnes.map((c) => (
                <td key={c} className="py-2 pr-4 text-slate-700">
                  {p[c] || '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TableauAnomalies({ lignes }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2 pr-4 font-medium">titre</th>
            <th className="py-2 pr-4 font-medium">date</th>
            <th className="py-2 pr-4 font-medium">raison</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((p) => (
            <tr key={p.programme_id} className="border-b border-slate-100">
              <td className="py-2 pr-4 text-slate-700">{p.titre || '—'}</td>
              <td className="py-2 pr-4 text-slate-700">{p.date || '—'}</td>
              <td className="py-2 pr-4 text-amber-700">{p._anomalie}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TableauPlanMedia({ lignes }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2 pr-4 font-medium">jour</th>
            <th className="py-2 pr-4 font-medium">heure_fin</th>
            <th className="py-2 pr-4 font-medium">contexte</th>
            <th className="py-2 pr-4 font-medium">contenu</th>
            <th className="py-2 pr-4 font-medium">durée</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((entree, i) => (
            <tr key={i} className="border-b border-slate-100">
              <td className="py-2 pr-4 text-slate-700">{entree.jour || '—'}</td>
              <td className="py-2 pr-4 text-slate-700">{entree.heure_fin || '—'}</td>
              <td className="py-2 pr-4 text-slate-700">{entree.contexte || '—'}</td>
              <td className="py-2 pr-4 text-slate-700">{entree.contenu || '—'}</td>
              <td className="py-2 pr-4 text-slate-700">{entree.duree_sec != null ? `${entree.duree_sec}s` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
