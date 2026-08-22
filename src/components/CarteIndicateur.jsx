export default function CarteIndicateur({ libelle, valeur, description }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4" title={description}>
      <div className="text-xs font-medium text-slate-500">{libelle}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{valeur}</div>
    </div>
  )
}
