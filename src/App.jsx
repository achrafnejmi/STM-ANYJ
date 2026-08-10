import { useEffect, useState } from 'react'
import { lireUtilisateur, deconnecter } from './lib/session.js'
import { sectionVersHash, hashVersSection } from './lib/navigation.js'
import Login from './screens/Login.jsx'
import Sidebar from './components/Sidebar.jsx'
import TopBar from './components/TopBar.jsx'
import Accueil from './screens/Accueil.jsx'
import Programmes from './screens/Programmes.jsx'
import Contrats from './screens/Contrats.jsx'
import PreGrille from './screens/PreGrille.jsx'
import GrilleLineaire from './screens/GrilleLineaire.jsx'
import GrilleNonLineaire from './screens/GrilleNonLineaire.jsx'
import Conducteur from './screens/Conducteur.jsx'
import Administration from './screens/Administration.jsx'

const ECRANS = {
  ACCUEIL: Accueil,
  PROGRAMMES: Programmes,
  CONTRATS: Contrats,
  PRE_GRILLE: PreGrille,
  GRILLE_LINEAIRE: GrilleLineaire,
  GRILLE_NON_LINEAIRE: GrilleNonLineaire,
  CONDUCTEUR: Conducteur,
  ADMINISTRATION: Administration,
}

function App() {
  const [utilisateur, setUtilisateur] = useState(() => lireUtilisateur())
  const [section, setSection] = useState(() => hashVersSection(window.location.hash) ?? 'ACCUEIL')
  const [sidebarOuverte, setSidebarOuverte] = useState(false)

  useEffect(() => {
    function onHashChange() {
      const id = hashVersSection(window.location.hash)
      if (id) setSection(id)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  if (!utilisateur) {
    return <Login onConnexion={setUtilisateur} />
  }

  function naviguer(id) {
    setSection(id)
    window.location.hash = sectionVersHash(id)
    setSidebarOuverte(false)
  }

  function handleDeconnexion() {
    deconnecter()
    setUtilisateur(null)
  }

  const Ecran = ECRANS[section]

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        section={section}
        onNaviguer={naviguer}
        ouverte={sidebarOuverte}
        onFermer={() => setSidebarOuverte(false)}
      />
      <div className="flex flex-1 flex-col">
        <TopBar
          utilisateur={utilisateur}
          onDeconnexion={handleDeconnexion}
          onToggleSidebar={() => setSidebarOuverte((v) => !v)}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <Ecran />
        </main>
      </div>
    </div>
  )
}

export default App
