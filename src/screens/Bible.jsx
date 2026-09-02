import { useEffect, useMemo, useState } from 'react'
import { FileText, Sparkles, Upload } from 'lucide-react'
import { listerProgrammesParChaine, obtenirBible, enregistrerBible, televerserBible, urlBible } from '../lib/db.js'
import { lireUtilisateur } from '../lib/session.js'
import { genererOcrFactice } from '../lib/bibleDemo.js'

const TAILLE_MAX = 10 * 1024 * 1024

// Écran Bible (P35b, rôle Documentaliste) : par programme, dépôt d'un PDF
// descriptif + zone d'analyse OCR SIMULÉE (résultat pré-rempli montrable, pas
// de vraie reconnaissance de caractères).
export default function Bible({ chaineActive }) {
  const [programmes, setProgrammes] = useState([])
  const [programmeId, setProgrammeId] = useState('')
  const [bible, setBible] = useState(null)
  const [ocr, setOcr] = useState('')
  const [chargement, setChargement] = useState(true)
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    setChargement(true)
    listerProgrammesParChaine(chaineActive.id)
      .then((lignes) => {
        setProgrammes(lignes)
        setProgrammeId((prev) => (lignes.some((p) => p.id === prev) ? prev : (lignes[0]?.id ?? '')))
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
  }, [chaineActive])

  useEffect(() => {
    if (!programmeId) {
      setBible(null)
      setOcr('')
      return
    }
    obtenirBible(programmeId)
      .then((b) => {
        setBible(b)
        setOcr(b?.ocr_texte ?? '')
      })
      .catch((err) => setErreur(err.message))
  }, [programmeId])

  const programme = useMemo(() => programmes.find((p) => p.id === programmeId) ?? null, [programmes, programmeId])

  async function deposer(e) {
    const fichier = e.target.files?.[0]
    e.target.value = ''
    if (!fichier) return
    if (fichier.size > TAILLE_MAX) {
      setErreur('Fichier trop volumineux (max 10 Mo).')
      return
    }
    setEnregistrement(true)
    setErreur(null)
    try {
      const chemin = await televerserBible(programmeId, fichier)
      const maj = await enregistrerBible(programmeId, { fichier_chemin: chemin, cree_par: lireUtilisateur() })
      setBible(maj)
      setMessage('PDF déposé.')
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  async function lancerOcr() {
    setEnregistrement(true)
    setErreur(null)
    try {
      const texte = genererOcrFactice(programme)
      setOcr(texte)
      const maj = await enregistrerBible(programmeId, { ocr_texte: texte, cree_par: lireUtilisateur() })
      setBible(maj)
      setMessage('Analyse OCR simulée effectuée.')
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  async function enregistrerTexte() {
    setEnregistrement(true)
    setErreur(null)
    try {
      const maj = await enregistrerBible(programmeId, { ocr_texte: ocr, cree_par: lireUtilisateur() })
      setBible(maj)
      setMessage('Texte enregistré.')
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Bible — {chaineActive.nom}</h1>
        <p className="text-sm text-slate-500">
          Dépôt du descriptif PDF par programme et analyse OCR. <span className="font-medium">OCR simulé</span> pour la
          démonstration — la reconnaissance réelle sera branchée en production.
        </p>
      </div>

      {chargement ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : programmes.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun programme sur cette chaîne.</p>
      ) : (
        <>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Programme</label>
            <select
              value={programmeId}
              onChange={(e) => setProgrammeId(e.target.value)}
              className="w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {programmes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.titre}
                </option>
              ))}
            </select>
          </div>

          {erreur && <p className="text-sm text-red-600">{erreur}</p>}
          {message && <p className="text-sm text-emerald-600">{message}</p>}

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Descriptif PDF</h2>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
              <Upload size={15} />
              {bible?.fichier_chemin ? 'Remplacer le PDF' : 'Déposer un PDF'}
              <input type="file" accept="application/pdf" className="hidden" onChange={deposer} disabled={enregistrement} />
            </label>
            {bible?.fichier_chemin && (
              <a
                href={urlBible(bible.fichier_chemin)}
                target="_blank"
                rel="noreferrer"
                className="ml-3 inline-flex items-center gap-1 text-sm text-snrt-navy hover:underline"
              >
                <FileText size={15} />
                Ouvrir le PDF
              </a>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Texte OCR</h2>
              <button
                type="button"
                onClick={lancerOcr}
                disabled={enregistrement}
                className="flex items-center gap-1.5 rounded-md bg-snrt-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
              >
                <Sparkles size={14} />
                Lancer l'analyse OCR (démo)
              </button>
            </div>
            <textarea
              value={ocr}
              onChange={(e) => setOcr(e.target.value)}
              rows={12}
              placeholder="Aucun texte pour l'instant. Déposez un PDF puis lancez l'analyse OCR (démo)."
              className="w-full rounded-md border border-slate-300 p-2 font-mono text-xs"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={enregistrerTexte}
                disabled={enregistrement || ocr === (bible?.ocr_texte ?? '')}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Enregistrer le texte
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
