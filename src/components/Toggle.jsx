// Interrupteur on/off réutilisable (P22) — bouton natif avec role="switch",
// pas un <input type="checkbox"> stylé : évite tout souci d'imbrication si un
// jour un Toggle doit vivre à côté d'un autre élément interactif.
export default function Toggle({ checked, onChange, id, label, disabled = false }) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-snrt-navy' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
