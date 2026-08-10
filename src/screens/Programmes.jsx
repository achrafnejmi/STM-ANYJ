import { useState } from 'react'
import ListeProgrammes from './ListeProgrammes.jsx'
import FicheProgramme from './FicheProgramme.jsx'

export default function Programmes({ chaineActive }) {
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
    return <FicheProgramme programmeId={programmeId} chaineActive={chaineActive} onRetour={retourListe} />
  }

  return <ListeProgrammes chaineActive={chaineActive} onOuvrir={ouvrir} onNouveau={nouveau} />
}
