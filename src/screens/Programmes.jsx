import { useEffect, useState } from 'react'
import ListeProgrammes from './ListeProgrammes.jsx'
import FicheProgramme from './FicheProgramme.jsx'

export default function Programmes({ chaineActive, programmeCible }) {
  const [vue, setVue] = useState('LISTE')
  const [programmeId, setProgrammeId] = useState(null)
  const [ongletCible, setOngletCible] = useState(undefined)

  function ouvrir(id, onglet) {
    setProgrammeId(id)
    setOngletCible(onglet)
    setVue('FICHE')
  }

  // Ouverture externe (recherche globale EXG-M10-04, ou Contrats & droits vers
  // l'onglet Droits, App.jsx) : `programmeCible` change de référence à chaque
  // sélection (même id inclus), donc cet effet se redéclenche systématiquement.
  useEffect(() => {
    if (programmeCible?.id) ouvrir(programmeCible.id, programmeCible.onglet)
  }, [programmeCible])

  function nouveau() {
    setProgrammeId(null)
    setOngletCible(undefined)
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
      />
    )
  }

  return <ListeProgrammes chaineActive={chaineActive} onOuvrir={ouvrir} onNouveau={nouveau} />
}
