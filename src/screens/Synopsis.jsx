import { useEffect, useMemo, useState } from 'react'
import { Sparkles, FileDown, FileText, ChevronDown, ChevronRight, Pencil } from 'lucide-react'
import { listerProgrammesParChaine, obtenirBible, enregistrerBible, urlBible } from '../lib/db.js'
import { lireUtilisateur } from '../lib/session.js'
import { genererSynopsisFactice } from '../lib/bibleDemo.js'
import { exporterSynopsisPdf } from '../lib/exportSynopsisPdf.js'

// Écran « Rédaction du synopsis » (P35b ; P38 : sortie PDF ; P40 : scindé par
// langue). Le journaliste consulte la bible, génère (gabarit simulé) puis
// modifie / télécharge le synopsis. La prop `langue` ('FR' | 'AR') restreint
// l'écran à cette seule langue — on n'écrit alors QUE la colonne correspondante
// de `bible`, sans toucher l'autre langue (travail de l'autre journaliste).
export default function Synopsis({ chaineActive, synopsisCible, langue }) {
  const [programmes, setProgrammes] = useState([])
  const [programmeId, setProgrammeId] = useState('')
  const [bible, setBible] = useState(null)
  const [fr, setFr] = useState('')
  const [ar, setAr] = useState('')
  const [ocrOuvert, setOcrOuvert] = useState(false)
  const [edition, setEdition] = useState(false)
  const [chargement, setChargement] = useState(true)
  const [generation, setGeneration] = useState(false)
  const [enregistrement, setEnregistrement] = useState(false)
  const [exportEnCours, setExportEnCours] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [message, setMessage] = useState(null)

  const montrerFr = langue !== 'AR'
  const montrerAr = langue !== 'FR'
  const titreLangue = langue === 'AR' ? ' (arabe)' : langue === 'FR' ? ' (français)' : ''

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
    setOcrOuvert(false)
    setEdition(false)
    setMessage(null)
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

  // Ouverture ciblée depuis l'espace de suivi (P39) : présélectionne le programme.
  useEffect(() => {
    if (synopsisCible?.id) setProgrammeId(synopsisCible.id)
  }, [synopsisCible?.cle]) // eslint-disable-line react-hooks/exhaustive-deps

  const programme = useMemo(() => programmes.find((p) => p.id === programmeId) ?? null, [programmes, programmeId])

  // Champs à écrire pour la langue courante (isolation FR / AR).
  function champsLangue(nfr, nar) {
    if (langue === 'FR') return { synopsis_fr: nfr }
    if (langue === 'AR') return { synopsis_ar: nar }
    return { synopsis_fr: nfr, synopsis_ar: nar }
  }

  async function generer() {
    setGeneration(true)
    setErreur(null)
    try {
      const { fr: nfr, ar: nar } = genererSynopsisFactice(programme, bible?.ocr_texte)
      if (montrerFr) setFr(nfr)
      if (montrerAr) setAr(nar)
      const maj = await enregistrerBible(programmeId, { ...champsLangue(nfr, nar), cree_par: lireUtilisateur() })
      setBible(maj)
      setEdition(false)
      setMessage('Synopsis généré et enregistré — modifiez si besoin, puis téléchargez le PDF.')
    } catch (err) {
      setErreur(err.message)
    } finally {
      setGeneration(false)
    }
  }

  async function enregistrerEdition() {
    setEnregistrement(true)
    setErreur(null)
    try {
      const maj = await enregistrerBible(programmeId, { ...champsLangue(fr, ar), cree_par: lireUtilisateur() })
      setBible(maj)
      setEdition(false)
      setMessage('Modifications enregistrées.')
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  function annulerEdition() {
    if (montrerFr) setFr(bible?.synopsis_fr ?? '')
    if (montrerAr) setAr(bible?.synopsis_ar ?? '')
    setEdition(false)
  }

  async function telecharger(codeLangue) {
    setExportEnCours(codeLangue)
    setErreur(null)
    try {
      await exporterSynopsisPdf({
        programme,
        chaineNom: chaineActive.nom,
        synopsisFr: fr,
        synopsisAr: ar,
        langue: codeLangue,
      })
    } catch (err) {
      setErreur(`Échec de l'export PDF : ${err.message}`)
    } finally {
      setExportEnCours(null)
    }
  }

  const bibleDeposee = Boolean(bible?.fichier_chemin)
  const texteScope = langue === 'AR' ? ar : langue === 'FR' ? fr : fr || ar
  const boutonsPdf = [
    montrerFr && { code: 'FR', label: 'PDF français', off: !fr.trim() },
    montrerAr && { code: 'AR', label: 'PDF arabe', off: !ar.trim() },
  ].filter(Boolean)

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          Rédaction du synopsis{titreLangue} — {chaineActive.nom}
        </h1>
        <p className="text-sm text-slate-500">
          Génération à partir de la bible, en PDF. <span className="font-medium">Génération simulée</span> pour la
          démonstration.
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

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Bible</h2>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  bibleDeposee ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {bibleDeposee ? 'Déposée' : 'Non déposée'}
              </span>
            </div>
            {bibleDeposee ? (
              <a
                href={urlBible(bible.fichier_chemin)}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm text-snrt-navy hover:underline"
              >
                <FileText size={15} />
                Ouvrir le PDF de la bible
              </a>
            ) : (
              <p className="mt-1 text-sm text-slate-500">
                Aucun PDF déposé — voir l'écran <strong>Bible</strong>. La génération reste possible mais sera moins
                précise.
              </p>
            )}
            {bible?.ocr_texte && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setOcrOuvert((v) => !v)}
                  className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  {ocrOuvert ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  Consulter le texte OCR de la bible
                </button>
                {ocrOuvert && (
                  <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-700">
                    {bible.ocr_texte}
                  </pre>
                )}
              </div>
            )}
          </div>

          {erreur && <p className="text-sm text-red-600">{erreur}</p>}
          {message && <p className="text-sm text-emerald-600">{message}</p>}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={generer}
              disabled={generation}
              className="flex items-center gap-1.5 rounded-md bg-snrt-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
            >
              <Sparkles size={15} />
              {generation ? 'Génération…' : 'Générer le synopsis (démo)'}
            </button>
          </div>

          {(texteScope || edition) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Synopsis</h2>
                {edition ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={enregistrerEdition}
                      disabled={enregistrement}
                      className="rounded-md bg-snrt-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
                    >
                      {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                    <button
                      type="button"
                      onClick={annulerEdition}
                      disabled={enregistrement}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  texteScope && (
                    <button
                      type="button"
                      onClick={() => setEdition(true)}
                      className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      <Pencil size={14} />
                      Modifier
                    </button>
                  )
                )}
              </div>

              <div className={`grid gap-4 ${montrerFr && montrerAr ? 'lg:grid-cols-2' : ''}`}>
                {montrerFr && (
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <h3 className="mb-1 text-sm font-semibold text-slate-900">Synopsis (français)</h3>
                    {edition ? (
                      <textarea
                        value={fr}
                        onChange={(e) => setFr(e.target.value)}
                        rows={10}
                        className="w-full rounded-md border border-slate-300 p-2 text-sm"
                      />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm text-slate-700">
                        {fr || <span className="text-slate-400">—</span>}
                      </p>
                    )}
                  </div>
                )}
                {montrerAr && (
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <h3 className="mb-1 text-sm font-semibold text-slate-900">Synopsis (العربية)</h3>
                    {edition ? (
                      <textarea
                        value={ar}
                        onChange={(e) => setAr(e.target.value)}
                        dir="rtl"
                        rows={10}
                        className="w-full rounded-md border border-slate-300 p-2 text-sm"
                      />
                    ) : (
                      <p dir="rtl" className="whitespace-pre-wrap text-sm text-slate-700">
                        {ar || <span className="text-slate-400">—</span>}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <span className="text-sm font-medium text-slate-500">Télécharger&nbsp;:</span>
            {boutonsPdf.map((b) => (
              <button
                key={b.code}
                type="button"
                onClick={() => telecharger(b.code)}
                disabled={b.off || edition || exportEnCours !== null}
                className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:border-snrt-navy hover:text-snrt-navy disabled:opacity-50 disabled:hover:border-slate-300 disabled:hover:text-slate-600"
              >
                <FileDown size={15} />
                {exportEnCours === b.code ? 'Génération…' : b.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
