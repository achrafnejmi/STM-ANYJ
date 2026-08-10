import { useState } from 'react'
import ListeProgrammes from './ListeProgrammes.jsx'
import FicheProgramme from './FicheProgramme.jsx'

export default function Programmes() {
  const [vue, setVue] = useState('LISTE')
  const [programmeId, setProgrammeId] = useState(null)

  function ouvrir(id) {
    setProgrammeId(id)
    setVue('FICHE')
  }

  function nouveau() {
    setProgrammeId(null)
    setVue('FICHE')
  }

  function retourListe() {
    setVue('LISTE')
    setProgrammeId(null)
  }

  if (vue === 'FICHE') {
    return <FicheProgramme programmeId={programmeId} onRetour={retourListe} />
  }

  return <ListeProgrammes onOuvrir={ouvrir} onNouveau={nouveau} />
}
