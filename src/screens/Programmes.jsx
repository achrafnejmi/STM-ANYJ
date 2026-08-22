import { useEffect, useState } from 'react'
import ListeProgrammes from './ListeProgrammes.jsx'
import FicheProgramme from './FicheProgramme.jsx'
import { useNotification } from '../components/NotificationProvider.jsx'

export default function Programmes({ chaineActive, programmeCible }) {
  const [vue, setVue] = useState('LISTE')
  const [programmeId, setProgrammeId] = useState(null)
  const [ongletCible, setOngletCible] = useState(undefined)
  const [ficheModifiee, setFicheModifiee] = useState(false)
  const { confirmer } = useNotification()

  function ouvrir(id, onglet) {
    setProgrammeId(id)
    setOngletCible(onglet)
    setFicheModifiee(false)
    setVue('FICHE')
  }

  // Ouverture externe (recherche globale EXG-M10-04, ou Contrats & droits vers
  // l'onglet Droits, App.jsx) : `programmeCible` change de référence à chaque
  // sélection (même id inclus), donc cet effet se redéclenche systématiquement.
  // Garde-fou "modifications non enregistrées" (P21 Lot G) : si la fiche
  // actuellement ouverte a des modifications non enregistrées, confirmation
  // avant de la remplacer (le remount via `key` sur FicheProgramme perdrait
  // silencieusement `form` sinon).
  useEffect(() => {
    if (!programmeCible?.id) return
    let annule = false
    ;(async () => {
      if (vue === 'FICHE' && ficheModifiee) {
        const ok = await confirmer({
          titre: 'Modifications non enregistrées',
          message: 'Modifications non enregistrées. Quitter sans enregistrer ?',
          labelConfirmer: 'Quitter sans enregistrer',
          labelAnnuler: 'Rester',
        })
        if (!ok || annule) return
      }
      ouvrir(programmeCible.id, programmeCible.onglet)
    })()
    return () => {
      annule = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne réagit qu'au changement de programmeCible, vue/ficheModifiee lus par closure au moment de l'appel
  }, [programmeCible])

  function nouveau() {
    setProgrammeId(null)
    setOngletCible(undefined)
    setFicheModifiee(false)
    setVue('FICHE')
  }

  function retourListe() {
    setVue('LISTE')
    setProgrammeId(null)
  }

  if (vue === 'FICHE') {
    return (
      <FicheProgramme
        key={`${programmeId ?? 'nouveau'}:${programmeCible?.cle ?? ''}`}
        programmeId={programmeId}
        chaineActive={chaineActive}
        onRetour={retourListe}
        ongletInitial={ongletCible ?? 'GENERAL'}
        onModifieChange={setFicheModifiee}
      />
    )
  }

  return <ListeProgrammes chaineActive={chaineActive} onOuvrir={ouvrir} onNouveau={nouveau} />
}
