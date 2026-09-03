import { useEffect, useMemo, useState } from 'react'
import { Sparkles, FileDown } from 'lucide-react'
import { listerProgrammesParChaine, obtenirBible, enregistrerBible } from '../lib/db.js'
import { lireUtilisateur } from '../lib/session.js'
import { genererSynopsisFactice } from '../lib/bibleDemo.js'
import { exporterSynopsisPdf } from '../lib/exportSynopsisPdf.js'

// Écran Synopsis (P35b, rôle Rédacteur) : génère un synopsis FR/AR à partir de
// la bible du programme. Génération SIMULÉE (gabarit, pas d'IA) — résultat
// éditable puis enregistré dans la table `bible`.
export default function Synopsis({ chaineActive }) {
  const [programmes, setProgrammes] = useState([])
  const [programmeId, setProgrammeId] = useState('')
  const [bible, setBible] = useState(null)
  const [fr, setFr] = useState('')
  const [ar, setAr] = useState('')
  const [chargement, setChargement] = useState(true)
  const [enregistrement, setEnregistrement] = useState(false)
  const [exportEnCours, setExportEnCours] = useState(null)
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
      setFr('')
      setAr('')
      return
    }
    obtenirBible(programmeId)
      .then((b) => {
        setBible(b)
        setFr(b?.synopsis_fr ?? '')
        setAr(b?.synopsis_ar ?? '')
      })
      .catch((err) => setErreur(err.message))
  }, [programmeId])

  const programme = useMemo(() => programmes.find((p) => p.id === programmeId) ?? null, [programmes, programmeId])

  function generer() {
    const { fr: nfr, ar: nar } = genererSynopsisFactice(programme, bible?.ocr_texte)
    setFr(nfr)
    setAr(nar)
    setMessage('Synopsis généré (démo) — relisez / ajustez puis enregistrez.')
  }

  async function telecharger(langue) {
    setExportEnCours(langue)
    setErreur(null)
    try {
      await exporterSynopsisPdf({
        programme,
        chaineNom: chaineActive.nom,
        synopsisFr: fr,
        synopsisAr: ar,
        langue,
      })
    } catch (err) {
      setErreur(`Échec de l'export PDF : ${err.message}`)
    } finally {
      setExportEnCours(null)
    }
  }

  async function enregistrer() {
    setEnregistrement(true)
    setErreur(null)
    try {
      const maj = await enregistrerBible(programmeId, { synopsis_fr: fr, synopsis_ar: ar, cree_par: lireUtilisateur() })
      setBible(maj)
      setMessage('Synopsis enregistré.')
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Synopsis — {chaineActive.nom}</h1>
        <p className="text-sm text-slate-500">
          Rédaction du synopsis FR / AR à partir de la bible. <span className="font-medium">Génération simulée</span> pour
          la démonstration.
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

          {!bible?.ocr_texte && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              La bible de ce programme n'a pas encore été analysée — voir l'écran <strong>Bible</strong>. La génération
              reste possible mais sera moins précise.
            </p>
          )}
          {erreur && <p className="text-sm text-red-600">{erreur}</p>}
          {message && <p className="text-sm text-emerald-600">{message}</p>}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={generer}
              className="flex items-center gap-1.5 rounded-md bg-snrt-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-snrt-navy-hover"
            >
              <Sparkles size={15} />
              Générer le synopsis (démo)
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-900">Synopsis (français)</h2>
              <textarea
                value={fr}
                onChange={(e) => setFr(e.target.value)}
                rows={10}
                className="w-full rounded-md border border-slate-300 p-2 text-sm"
              />
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-900">Synopsis (العربية)</h2>
              <textarea
                value={ar}
                onChange={(e) => setAr(e.target.value)}
                dir="rtl"
                rows={10}
                className="w-full rounded-md border border-slate-300 p-2 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-500">Télécharger&nbsp;:</span>
              {[
                { code: 'FR', label: 'PDF français', off: !fr.trim() },
                { code: 'AR', label: 'PDF arabe', off: !ar.trim() },
                { code: 'BILINGUE', label: 'PDF bilingue', off: !fr.trim() && !ar.trim() },
              ].map((b) => (
                <button
                  key={b.code}
                  type="button"
                  onClick={() => telecharger(b.code)}
                  disabled={b.off || exportEnCours !== null}
                  className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:border-snrt-navy hover:text-snrt-navy disabled:opacity-50 disabled:hover:border-slate-300 disabled:hover:text-slate-600"
                >
                  <FileDown size={15} />
                  {exportEnCours === b.code ? 'Génération…' : b.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={enregistrer}
              disabled={enregistrement || (fr === (bible?.synopsis_fr ?? '') && ar === (bible?.synopsis_ar ?? ''))}
              className="rounded-md bg-snrt-navy px-4 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
            >
              {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
