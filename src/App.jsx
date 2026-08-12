import { useEffect, useState } from 'react'
import { lireUtilisateur, deconnecter } from './lib/session.js'
import { lireChaineActive, definirChaineActive } from './lib/chaines.js'
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
  const [chaineActive, setChaineActive] = useState(() => lireChaineActive())
  // Pastille rail (EXG-M0-08/EXG-M8-02) : remontée depuis GrilleLineaire, seul
  // écran qui écrit sur diffusion_lineaire — reste affichée (dernière valeur
  // connue) en naviguant ailleurs, puisque rien d'autre ne peut la faire varier.
  const [nbAnomaliesBloquantes, setNbAnomaliesBloquantes] = useState(0)

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

  function changerChaine(code) {
    definirChaineActive(code)
    setChaineActive(lireChaineActive())
  }

  const Ecran = ECRANS[section]

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        section={section}
        onNaviguer={naviguer}
        ouverte={sidebarOuverte}
        onFermer={() => setSidebarOuverte(false)}
        badges={{ GRILLE_LINEAIRE: nbAnomaliesBloquantes }}
      />
      <div className="flex flex-1 flex-col">
        <TopBar
          utilisateur={utilisateur}
          onDeconnexion={handleDeconnexion}
          onToggleSidebar={() => setSidebarOuverte((v) => !v)}
          chaineActive={chaineActive}
          onChangerChaine={changerChaine}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <Ecran chaineActive={chaineActive} onAnomaliesBloquantes={setNbAnomaliesBloquantes} />
        </main>
      </div>
    </div>
  )
}

export default App
