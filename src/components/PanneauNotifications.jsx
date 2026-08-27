import { X, BellRing, PlusCircle, TriangleAlert, CheckCheck } from 'lucide-react'

const ICONES_TYPE = {
  NOUVEAU_PROGRAMME: { Icone: PlusCircle, classe: 'text-emerald-600' },
  DROITS_PROCHES: { Icone: TriangleAlert, classe: 'text-amber-600' },
}

function formaterHorodatage(iso) {
  const d = new Date(iso)
  const jour = String(d.getDate()).padStart(2, '0')
  const mois = String(d.getMonth() + 1).padStart(2, '0')
  const heure = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${jour}/${mois} ${heure}:${min}`
}

// Panneau flottant (même gabarit que PanneauAnomalies.jsx, P29) — déclenché
// par la cloche de TopBar.jsx (coquille globale), pas par un écran précis.
// Liste unique triée par date décroissante (déjà l'ordre de `notifications`,
// cf. listerNotificationsParChaine) plutôt que 2 sections : les deux types
// partagent un flux chronologique, chacun distingué par son icône.
export default function PanneauNotifications({ notifications, onFermer, onAller, onMarquerToutesLues }) {
  const nbNonLues = notifications.filter((n) => !n.lu).length

  return (
    <div className="fixed right-0 top-0 z-30 flex h-full w-96 flex-col overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
        <button type="button" onClick={onFermer} className="text-slate-400 hover:text-slate-600">
          <X size={18} />
        </button>
      </div>

      {nbNonLues > 0 && (
        <button
          type="button"
          onClick={onMarquerToutesLues}
          className="mb-3 flex items-center gap-1.5 self-start rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          <CheckCheck size={13} />
          Tout marquer comme lu
        </button>
      )}

      <div className="flex-1 space-y-2">
        {notifications.map((n) => {
          const { Icone, classe } = ICONES_TYPE[n.type] ?? { Icone: BellRing, classe: 'text-slate-500' }
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => onAller(n)}
              className={`flex w-full items-start gap-2 rounded-md border p-2 text-left text-xs ${
                n.lu ? 'border-slate-200 bg-white' : 'border-snrt-navy/30 bg-snrt-navy/5'
              }`}
            >
              <Icone size={15} className={`mt-0.5 shrink-0 ${classe}`} />
              <div className="min-w-0 flex-1">
                <div className={`text-slate-700 ${!n.lu ? 'font-medium' : ''}`}>{n.message}</div>
                <div className="mt-1 font-mono text-[10px] text-slate-400">{formaterHorodatage(n.cree_le)}</div>
              </div>
              {!n.lu && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-snrt-navy" />}
            </button>
          )
        })}
        {notifications.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <BellRing size={24} className="text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">Aucune notification</p>
            <p className="text-xs text-slate-500">Nouveaux programmes et fins de droits proches apparaîtront ici.</p>
          </div>
        )}
      </div>
    </div>
  )
}
