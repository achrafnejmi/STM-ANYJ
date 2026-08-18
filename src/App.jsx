import { useEffect, useState } from 'react'
import { lireUtilisateur, deconnecter } from './lib/session.js'
import { lireChaineActive, definirChaineActive } from './lib/chaines.js'
import { sectionVersHash, hashVersSection } from './lib/navigation.js'
import { chargerGenres } from './lib/genres.js'
import { chargerTranches } from './lib/tranches.js'
import Login from './screens/Login.jsx'
import Sidebar from './components/Sidebar.jsx'
import TopBar from './components/TopBar.jsx'
import RechercheGlobale from './components/RechercheGlobale.jsx'
import Accueil from './screens/Accueil.jsx'
import Programmes from './screens/Programmes.jsx'
import Contrats from './screens/Contrats.jsx'
import GrilleType from './screens/GrilleType.jsx'
import GrilleLineaire from './screens/GrilleLineaire.jsx'
import AutoProgrammation from './screens/AutoProgrammation.jsx'
import PlanMedia from './screens/PlanMedia.jsx'
import GrilleNonLineaire from './screens/GrilleNonLineaire.jsx'
import Conducteur from './screens/Conducteur.jsx'
import Administration from './screens/Administration.jsx'

const ECRANS = {
  ACCUEIL: Accueil,
  PROGRAMMES: Programmes,
  CONTRATS: Contrats,
  GRILLE_TYPE: GrilleType,
  GRILLE_LINEAIRE: GrilleLineaire,
  AUTO_PROGRAMMATION: AutoProgrammation,
  PLAN_MEDIA: PlanMedia,
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
  const [rechercheOuverte, setRechercheOuverte] = useState(false)
  // Bascule Programmes sur une fiche précise depuis l'extérieur de cet écran
  // (résultat de recherche globale, EXG-M10-04) — objet { id, cle } plutôt
  // qu'un id nu : une NOUVELLE référence à chaque sélection, même si le même
  // programme est rouvert deux fois de suite, pour que l'effet de
  // Programmes.jsx se redéclenche à chaque fois.
  const [programmeCible, setProgrammeCible] = useState(null)

  useEffect(() => {
    function onHashChange() {
      const id = hashVersSection(window.location.hash)
      if (id) setSection(id)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Nomenclatures administrables (P19a) : chargées une fois au démarrage,
  // indépendamment de la chaîne active (genre/tranche_antenne sont globaux).
  useEffect(() => {
    chargerGenres()
    chargerTranches()
  }, [])

  useEffect(() => {
    function onKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setRechercheOuverte(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
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

  // Résultat de recherche globale (EXG-M10-04) : bascule sur Programmes et
  // ouvre directement la fiche visée.
  function ouvrirProgrammeDepuisRecherche(id) {
    naviguer('PROGRAMMES')
    setProgrammeCible({ id, cle: crypto.randomUUID() })
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
          onOuvrirRecherche={() => setRechercheOuverte(true)}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <Ecran
            chaineActive={chaineActive}
            onAnomaliesBloquantes={setNbAnomaliesBloquantes}
            programmeCible={programmeCible}
          />
        </main>
      </div>
      <RechercheGlobale
        chaineActive={chaineActive}
        ouverte={rechercheOuverte}
        onFermer={() => setRechercheOuverte(false)}
        onOuvrirProgramme={ouvrirProgrammeDepuisRecherche}
      />
    </div>
  )
}

export default App
