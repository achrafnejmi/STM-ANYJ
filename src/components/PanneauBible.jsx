import { useEffect, useState } from 'react'
import { FileText, Upload } from 'lucide-react'
import { obtenirBible, enregistrerBible, televerserBible, urlBible } from '../lib/db.js'
import { lireUtilisateur } from '../lib/session.js'
import { peutGererBible } from '../lib/roles.js'

const TAILLE_MAX = 10 * 1024 * 1024 // 10 Mo

// Panneau Bible embarqué dans l'onglet Métadonnées de la fiche programme (P37b) :
// dépôt du PDF descriptif + consultation (PDF, texte OCR, synopsis FR/AR déjà
// saisis via l'écran Bible / Synopsis dédié). L'analyse OCR et la génération de
// synopsis restent sur les écrans des rôles Documentaliste / Rédacteur.
export default function PanneauBible({ programmeId, roleUtilisateur }) {
  const [bible, setBible] = useState(null)
  const [chargement, setChargement] = useState(true)
  const [televersement, setTeleversement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [message, setMessage] = useState(null)

  const editable = peutGererBible(roleUtilisateur)

  useEffect(() => {
    if (!programmeId) return
    setChargement(true)
    obtenirBible(programmeId)
      .then(setBible)
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
  }, [programmeId])

  async function deposer(e) {
    const fichier = e.target.files?.[0]
    e.target.value = ''
    if (!fichier) return
    if (fichier.size > TAILLE_MAX) {
      setErreur('Fichier trop volumineux (10 Mo maximum).')
      return
    }
    setTeleversement(true)
    setErreur(null)
    setMessage(null)
    try {
      const chemin = await televerserBible(programmeId, fichier)
      const maj = await enregistrerBible(programmeId, { fichier_chemin: chemin, cree_par: lireUtilisateur() })
      setBible(maj)
      setMessage('PDF déposé.')
    } catch (err) {
      setErreur(err.message)
    } finally {
      setTeleversement(false)
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="mb-1 text-base font-semibold text-slate-900">Bible</h2>
      <p className="mb-4 text-sm text-slate-500">
        Descriptif PDF du programme. L'analyse OCR et le synopsis se font sur les écrans dédiés.
      </p>

      {erreur && <p className="mb-2 text-sm text-red-600">{erreur}</p>}
      {message && <p className="mb-2 text-sm text-emerald-600">{message}</p>}

      {chargement ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {editable && (
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
                <Upload size={15} />
                {bible?.fichier_chemin ? 'Remplacer le PDF' : 'Déposer un PDF'}
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={deposer}
                  disabled={televersement}
                />
              </label>
            )}
            {bible?.fichier_chemin ? (
              <a
                href={urlBible(bible.fichier_chemin)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-snrt-navy hover:underline"
              >
                <FileText size={15} />
                Ouvrir le PDF
              </a>
            ) : (
              !editable && <span className="text-sm text-slate-500">Aucun PDF déposé.</span>
            )}
          </div>

          {bible?.ocr_texte && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-900">Texte OCR</h3>
              <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-700">
                {bible.ocr_texte}
              </pre>
            </div>
          )}

          {(bible?.synopsis_fr || bible?.synopsis_ar) && (
            <div className="grid gap-4 lg:grid-cols-2">
              {bible?.synopsis_fr && (
                <div>
                  <h3 className="mb-1 text-sm font-semibold text-slate-900">Synopsis (français)</h3>
                  <p className="whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    {bible.synopsis_fr}
                  </p>
                </div>
              )}
              {bible?.synopsis_ar && (
                <div>
                  <h3 className="mb-1 text-sm font-semibold text-slate-900">Synopsis (العربية)</h3>
                  <p
                    dir="rtl"
                    className="whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
                  >
                    {bible.synopsis_ar}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
