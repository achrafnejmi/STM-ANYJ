import { useEffect, useState } from 'react'
import ListeProgrammes from './ListeProgrammes.jsx'
import FicheProgramme from './FicheProgramme.jsx'

export default function Programmes({ chaineActive, programmeCible }) {
  const [vue, setVue] = useState('LISTE')
  const [programmeId, setProgrammeId] = useState(null)

  function ouvrir(id) {
    setProgrammeId(id)
    setVue('FICHE')
  }

  // Résultat de recherche globale (EXG-M10-04, App.jsx) : `programmeCible`
  // change de référence à chaque sélection (même id inclus), donc cet effet
  // se redéclenche systématiquement.
  useEffect(() => {
    if (programmeCible?.id) ouvrir(programmeCible.id)
  }, [programmeCible])

  function nouveau() {
    setProgrammeId(null)
    setVue('FICHE')
  }

  function retourListe() {
    setVue('LISTE')
    setProgrammeId(null)
  }

  if (vue === 'FICHE') {
    return <FicheProgramme programmeId={programmeId} chaineActive={chaineActive} onRetour={retourListe} />
  }

  return <ListeProgrammes chaineActive={chaineActive} onOuvrir={ouvrir} onNouveau={nouveau} />
}
