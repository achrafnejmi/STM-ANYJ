// Système de notifications (P21 Lot G) : toasts centrés non bloquants
// (succès/erreur/info) + confirmation bloquante (remplace window.confirm),
// exposés via un contexte unique — un seul système pour les deux, monté une
// fois à la racine (main.jsx).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react'
import Modal from './Modal.jsx'

const DUREE_AFFICHAGE_MS = 4000

const STYLES_TOAST = {
  succes: { accent: 'bg-emerald-500', halo: 'bg-emerald-100 text-emerald-600', Icone: CheckCircle2 },
  erreur: { accent: 'bg-red-500', halo: 'bg-red-100 text-red-600', Icone: CircleAlert },
  info: { accent: 'bg-slate-400', halo: 'bg-slate-100 text-slate-600', Icone: Info },
}

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [confirmState, setConfirmState] = useState(null)

  const fermerToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const notifier = useCallback(
    (type, message) => {
      const id = crypto.randomUUID()
      setToasts((prev) => [...prev, { id, type, message }])
      setTimeout(() => fermerToast(id), DUREE_AFFICHAGE_MS)
    },
    [fermerToast]
  )

  const confirmer = useCallback(
    ({ titre = 'Confirmation', message, labelConfirmer = 'Confirmer', labelAnnuler = 'Annuler' } = {}) =>
      new Promise((resolve) => {
        setConfirmState({ titre, message, labelConfirmer, labelAnnuler, resolve })
      }),
    []
  )

  function repondreConfirmation(reponse) {
    confirmState?.resolve(reponse)
    setConfirmState(null)
  }

  const valeur = useMemo(
    () => ({
      succes: (msg) => notifier('succes', msg),
      erreur: (msg) => notifier('erreur', msg),
      info: (msg) => notifier('info', msg),
      confirmer,
    }),
    [notifier, confirmer]
  )

  return (
    <NotificationContext.Provider value={valeur}>
      {children}

      <div className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 p-4">
        {toasts.map((t) => {
          const { accent, halo, Icone } = STYLES_TOAST[t.type]
          return (
            <div
              key={t.id}
              className="pointer-events-auto relative flex w-full max-w-md items-start gap-4 overflow-hidden rounded-2xl bg-white px-6 py-5 shadow-2xl ring-1 ring-black/5"
            >
              <span className={`absolute inset-y-0 left-0 w-1.5 ${accent}`} />
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${halo}`}>
                <Icone size={22} />
              </span>
              <p className="flex-1 pt-2 text-[15px] font-medium leading-snug text-slate-800">{t.message}</p>
              <button
                type="button"
                onClick={() => fermerToast(t.id)}
                className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
          )
        })}
      </div>

      {confirmState && (
        <Modal titre={confirmState.titre} onFermer={() => repondreConfirmation(false)}>
          <p className="text-sm text-slate-700">{confirmState.message}</p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => repondreConfirmation(false)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {confirmState.labelAnnuler}
            </button>
            <button
              type="button"
              onClick={() => repondreConfirmation(true)}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            >
              {confirmState.labelConfirmer}
            </button>
          </div>
        </Modal>
      )}
    </NotificationContext.Provider>
  )
}

// eslint-disable-next-line react/only-export-components -- hook colocalisé avec son Provider, pattern standard (pas de fichier hooks/ séparé pour un seul hook)
export function useNotification() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotification() doit être appelé sous <NotificationProvider>.')
  return ctx
}

// Garde-fou "modifications non enregistrées" (P21 Lot G, partie 2) : compare
// l'état courant d'un formulaire à son instantané initial (figé au chargement
// par l'appelant, pas recalculé ici) ; `demanderConfirmation()` ne bloque que
// si quelque chose a réellement changé.
// eslint-disable-next-line react/only-export-components -- idem, colocalisé (utilise useNotification ci-dessus)
export function useGardeModifications(valeurActuelle, valeurInitiale) {
  const { confirmer } = useNotification()
  const estModifie = JSON.stringify(valeurActuelle) !== JSON.stringify(valeurInitiale)

  async function demanderConfirmation() {
    if (!estModifie) return true
    return confirmer({
      titre: 'Modifications non enregistrées',
      message: 'Modifications non enregistrées. Quitter sans enregistrer ?',
      labelConfirmer: 'Quitter sans enregistrer',
      labelAnnuler: 'Rester',
    })
  }

  return { estModifie, demanderConfirmation }
}

// Reporte `estModifie` d'un formulaire (panneau flottant, sous-composant) vers
// un parent qui contrôle la sélection/fermeture — remet à `false` au
// démontage pour ne jamais laisser un état "modifié" fantôme après coup.
// eslint-disable-next-line react/only-export-components -- idem, colocalisé
export function useSignalerModifications(estModifie, onModifieChange) {
  useEffect(() => {
    onModifieChange?.(estModifie)
    return () => onModifieChange?.(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onModifieChange est un setter stable (useState) côté appelants, pas une dépendance réelle
  }, [estModifie])
}
