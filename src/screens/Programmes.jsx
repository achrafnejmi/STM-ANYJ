import ImportSTM from './ImportSTM.jsx'

export default function Programmes() {
  return (
    <div className="space-y-6">
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        La fiche programme et les segments arrivent en Phase 7 — en attendant,
        l'import de grille ci-dessous alimente déjà Programmes et la Grille
        linéaire.
      </div>
      <ImportSTM />
    </div>
  )
}
