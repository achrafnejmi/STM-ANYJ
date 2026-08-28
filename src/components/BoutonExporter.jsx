// Bouton Export unifié (P31 — passe design) : un seul déclencheur « Exporter »
// plutôt que 3 boutons Excel/Word/PDF séparés, sur tous les écrans qui
// exportent — reprend le patron déjà établi et éprouvé (GrilleLineaire.jsx/
// GrilleType.jsx, un Modal listant les formats) plutôt qu'un dropdown ancré
// inédit, maintenant partagé au lieu d'être dupliqué à l'identique dans
// chaque écran. Logique d'export INCHANGÉE : ce composant ne fait qu'appeler
// les fonctions onExcel/onWord/onPdf déjà existantes de chaque écran.
import { useState } from 'react'
import { Download, FileSpreadsheet, FileText, File } from 'lucide-react'
import Modal from './Modal.jsx'

// `optionsSupplementaires` (ex. GrilleLineaire.jsx « Excel TNT+SAT ») :
// [{ label, Icone, onClick, couleurTexte?, couleurHover?, title? }] — rendu
// après les 3 formats standards, ferme la modale au clic comme les 3 autres.
export default function BoutonExporter({
  onExcel,
  onWord,
  onPdf,
  sousTitre,
  disabled,
  optionsSupplementaires = [],
  label = 'Exporter',
  className,
}) {
  const [ouvert, setOuvert] = useState(false)

  function choisir(fn) {
    return () => {
      fn()
      setOuvert(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        disabled={disabled}
        title="Exporter (Excel/Word/PDF)"
        className={
          className ??
          'flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60'
        }
      >
        <Download size={15} />
        {label}
      </button>
      {ouvert && (
        <Modal titre="Exporter" onFermer={() => setOuvert(false)}>
          <div className="space-y-3 text-sm">
            {sousTitre && <p className="text-xs text-slate-500">{sousTitre}</p>}
            <button
              type="button"
              onClick={choisir(onExcel)}
              className="flex w-full items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50"
            >
              <FileSpreadsheet size={16} />
              Excel
            </button>
            <button
              type="button"
              onClick={choisir(onWord)}
              className="flex w-full items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
            >
              <FileText size={16} />
              Word
            </button>
            <button
              type="button"
              onClick={choisir(onPdf)}
              className="flex w-full items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
            >
              <File size={16} />
              PDF
            </button>
            {optionsSupplementaires.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={choisir(opt.onClick)}
                title={opt.title}
                className={`flex w-full items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm ${opt.couleurTexte ?? 'text-emerald-700'} ${opt.couleurHover ?? 'hover:bg-emerald-50'}`}
              >
                <opt.Icone size={16} />
                {opt.label}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  )
}
