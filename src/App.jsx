import { useEffect, useState } from 'react'
import { lireUtilisateur, deconnecter } from './lib/session.js'
import { lireChaineActive, definirChaineActive, chargerChaines, CHAINES } from './lib/chaines.js'
import { SECTIONS, sectionVersHash, hashVersSection } from './lib/navigation.js'
import { peutVoirSection, premiereSection, chaineVerrouillee, libelleRole, notificationVisible, langueRedacteur } from './lib/roles.js'
import { get as lireStockage, set as ecrireStockage } from './lib/storage.js'
import { chargerGenres } from './lib/genres.js'
import { chargerTranches } from './lib/tranches.js'
import { aujourdHuiISO } from './lib/semaine.js'
import {
  listerProgrammesParChaine,
  listerToutesLesFenetresDroits,
  listerNotificationsParChaine,
  creerNotifications,
  marquerNotificationLue,
  marquerToutesNotificationsLues,
  obtenirUtilisateur,
} from './lib/db.js'
import { calculerNotificationsDroitsManquantes, SECTIONS_CIBLE_NOTIFICATION } from './lib/notifications.js'
import Login from './screens/Login.jsx'
import Sidebar from './components/Sidebar.jsx'
import TopBar from './components/TopBar.jsx'
import RechercheGlobale from './components/RechercheGlobale.jsx'
import PanneauNotifications from './components/PanneauNotifications.jsx'
import Accueil from './screens/Accueil.jsx'
import Programmes from './screens/Programmes.jsx'
import Contrats from './screens/Contrats.jsx'
import Bible from './screens/Bible.jsx'
import Synopsis from './screens/Synopsis.jsx'
import BiblesSynopsis from './screens/BiblesSynopsis.jsx'
import TableauBordRedaction from './screens/TableauBordRedaction.jsx'
import GrilleType from './screens/GrilleType.jsx'
import GrilleLineaire from './screens/GrilleLineaire.jsx'
import AutoProgrammation from './screens/AutoProgrammation.jsx'
import PlanMedia from './screens/PlanMedia.jsx'
import GrilleNonLineaire from './screens/GrilleNonLineaire.jsx'
import Conducteur from './screens/Conducteur.jsx'
import DemandesProgrammation from './screens/DemandesProgrammation.jsx'
import PilotageDroitsStock from './screens/PilotageDroitsStock.jsx'
import SuiviPad from './screens/SuiviPad.jsx'
import ControlePad from './screens/ControlePad.jsx'
import Administration from './screens/Administration.jsx'

const ECRANS = {
  ACCUEIL: Accueil,
  PROGRAMMES: Programmes,
  CONTRATS: Contrats,
  BIBLE: Bible,
  SYNOPSIS_FR: Synopsis,
  SYNOPSIS_AR: Synopsis,
  BIBLES_SYNOPSIS: BiblesSynopsis,
  TABLEAU_BORD_REDACTION: TableauBordRedaction,
  GRILLE_TYPE: GrilleType,
  GRILLE_LINEAIRE: GrilleLineaire,
  AUTO_PROGRAMMATION: AutoProgrammation,
  PLAN_MEDIA: PlanMedia,
  GRILLE_NON_LINEAIRE: GrilleNonLineaire,
  CONDUCTEUR: Conducteur,
  DEMANDES_PROGRAMMATION: DemandesProgrammation,
  PILOTAGE_DROITS_STOCK: PilotageDroitsStock,
  SUIVI_PAD: SuiviPad,
  CONTROLE_PAD: ControlePad,
  ADMINISTRATION: Administration,
}

function App() {
  const [utilisateur, setUtilisateur] = useState(() => lireUtilisateur())
  const [section, setSection] = useState(() => hashVersSection(window.location.hash) ?? 'ACCUEIL')
  const [sidebarOuverte, setSidebarOuverte] = useState(false)
  // Repli desktop en rail d'icônes (retouche post-P29) — distinct du tiroir
  // mobile ci-dessus : persiste entre sessions, même patron que
  // session:chaine (storage.js, lib/chaines.js).
  const [sidebarRepliee, setSidebarRepliee] = useState(() => lireStockage('session:sidebar-repliee') ?? false)
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
  const [synopsisCible, setSynopsisCible] = useState(null)
  // Centre de notifications (P29) : persistant, lu/non lu par chaîne (pas
  // d'utilisateur durable, cf. session.js). NOUVEAU_PROGRAMME est écrit au
  // moment de la création (FicheProgramme.jsx) ; DROITS_PROCHES est
  // réconcilié ici à chaque changement de chaîne (voir effet ci-dessous).
  const [notifications, setNotifications] = useState([])
  const [notificationsOuvertes, setNotificationsOuvertes] = useState(false)
  // Rôle (P35) : simulation d'accès pour la démo, PAS une vraie barrière de
  // sécurité (connexion sans mot de passe, RLS ouvertes). Pilote le filtrage
  // de la Sidebar, la garde de route et le verrou de chaîne. Chargé une fois
  // à la connexion. `utilisateurCourant` = la ligne complète (nom_affiche,
  // chaine_id) ; `roleUtilisateur` = son rôle.
  const [utilisateurCourant, setUtilisateurCourant] = useState(null)
  const [roleUtilisateur, setRoleUtilisateur] = useState(null)

  useEffect(() => {
    if (!utilisateur) {
      setUtilisateurCourant(null)
      setRoleUtilisateur(null)
      return
    }
    let annule = false
    obtenirUtilisateur(utilisateur)
      .then((u) => {
        if (annule) return
        // P38 : identifiant inconnu (plus de création à la volée) → session
        // invalide, retour à l'écran de connexion.
        if (!u) {
          deconnecter()
          setUtilisateur(null)
          setUtilisateurCourant(null)
          setRoleUtilisateur(null)
          return
        }
        setUtilisateurCourant(u)
        setRoleUtilisateur(u.role)
      })
      .catch((err) => console.error('Chargement du rôle utilisateur impossible :', err))
    return () => {
      annule = true
    }
  }, [utilisateur])

  // Verrou de chaîne : l'Administrateur de chaîne est forcé sur SA chaîne
  // (sélecteur de chaîne verrouillé côté TopBar).
  useEffect(() => {
    if (!chaineVerrouillee(roleUtilisateur) || !utilisateurCourant?.chaine_id) return
    const cible = CHAINES.find((c) => c.id === utilisateurCourant.chaine_id)
    if (cible && cible.code !== chaineActive.code) changerChaine(cible.code)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- changerChaine/chaineActive stables ici
  }, [roleUtilisateur, utilisateurCourant])

  const sectionsVisibles = SECTIONS.filter((s) => peutVoirSection(roleUtilisateur, s.id))

  // Garde de route : si le rôle est chargé et la section courante lui est
  // interdite, rediriger vers sa première section autorisée.
  useEffect(() => {
    if (!roleUtilisateur) return
    if (!peutVoirSection(roleUtilisateur, section)) {
      naviguer(premiereSection(roleUtilisateur, SECTIONS.map((s) => s.id)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- naviguer stable
  }, [roleUtilisateur, section])

  useEffect(() => {
    function onHashChange() {
      const id = hashVersSection(window.location.hash)
      if (id) setSection(id)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Nomenclatures administrables (P19a, + chaînes en retouche post-P29) :
  // chargées une fois au démarrage, indépendamment de la chaîne active
  // (genre/tranche_antenne/chaine sont globaux).
  useEffect(() => {
    chargerGenres()
    chargerTranches()
    chargerChaines()
  }, [])

  // Recharge simple (pas de réconciliation) : utilisée après qu'un écran a
  // lui-même écrit une notification (ex. FicheProgramme.jsx à la création
  // d'un programme) — l'écriture est déjà faite, il ne manque que la
  // resynchronisation de l'état local pour que la cloche/le panneau la
  // voient sans attendre un changement de chaîne.
  function rafraichirNotifications() {
    listerNotificationsParChaine(chaineActive.id)
      .then(setNotifications)
      .catch((err) => console.error('Rafraîchissement des notifications impossible :', err))
  }

  // Réconciliation DROITS_PROCHES (P29) : compare les fenêtres actuellement
  // proches de la fermeture (RG-04, droits.js — aucune formule dupliquée) aux
  // notifications déjà connues de cette chaîne, insère les manquantes, puis
  // recharge la liste. NOUVEAU_PROGRAMME n'a pas besoin de ça (écrit une fois
  // à la création) — seule DROITS_PROCHES est une condition à réconcilier.
  useEffect(() => {
    let annule = false
    Promise.all([
      listerProgrammesParChaine(chaineActive.id),
      listerToutesLesFenetresDroits(),
      listerNotificationsParChaine(chaineActive.id),
    ])
      .then(async ([programmes, fenetresDroits, notificationsExistantes]) => {
        if (annule) return
        const programmesParId = new Map(programmes.map((p) => [p.id, p]))
        const manquantes = calculerNotificationsDroitsManquantes({
          chaineId: chaineActive.id,
          fenetresDroits,
          programmesParId,
          notificationsExistantes,
          dateReference: aujourdHuiISO(),
        })
        if (manquantes.length === 0) {
          setNotifications(notificationsExistantes)
          return
        }
        await creerNotifications(manquantes)
        if (annule) return
        setNotifications(await listerNotificationsParChaine(chaineActive.id))
      })
      .catch((err) => console.error('Chargement des notifications impossible :', err))
    return () => {
      annule = true
    }
  }, [chaineActive])

  // Sondage léger (P36) : une notification écrite par un autre utilisateur
  // (ex. une demande PAD reçue) doit apparaître dans la cloche sans attendre
  // une action de l'utilisateur courant. Simple `setInterval` — pas de canal
  // temps réel dans le PoC.
  useEffect(() => {
    const id = setInterval(() => {
      listerNotificationsParChaine(chaineActive.id)
        .then(setNotifications)
        .catch(() => {})
    }, 30000)
    return () => clearInterval(id)
  }, [chaineActive])

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

  function basculerSidebarRepliee() {
    setSidebarRepliee((v) => {
      ecrireStockage('session:sidebar-repliee', !v)
      return !v
    })
  }

  // Ouverture externe d'une fiche programme (recherche globale EXG-M10-04, ou
  // Contrats & droits vers l'onglet Droits) : bascule sur Programmes et ouvre
  // directement la fiche visée, sur l'onglet demandé (Général par défaut).
  function ouvrirProgramme(id, onglet) {
    naviguer('PROGRAMMES')
    setProgrammeCible({ id, cle: crypto.randomUUID(), onglet })
  }

  // Ouvre l'écran de rédaction du synopsis (P39/P40) présélectionné sur un
  // programme — vers la section de la langue que le rôle courant peut voir.
  function ouvrirSynopsis(id) {
    const cible = ['SYNOPSIS_FR', 'SYNOPSIS_AR'].find((s) => peutVoirSection(roleUtilisateur, s)) ?? 'SYNOPSIS_FR'
    naviguer(cible)
    setSynopsisCible({ id, cle: crypto.randomUUID() })
  }

  // Clic sur une notification : marque lue puis ouvre la fiche du programme
  // visé — sur l'onglet Droits pour une alerte de fin de droits, Général
  // sinon (même mécanisme que RechercheGlobale.jsx/Contrats.jsx).
  function allerNotification(n) {
    if (!n.lu) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, lu: true } : x)))
      marquerNotificationLue(n.id).catch((err) => console.error('Marquage lu impossible :', err))
    }
    setNotificationsOuvertes(false)
    // Routage systématique : vers la première section « source » que le rôle
    // courant peut voir (SECTIONS_CIBLE_NOTIFICATION), sinon la fiche programme.
    const cible = (SECTIONS_CIBLE_NOTIFICATION[n.type] ?? []).find((s) => peutVoirSection(roleUtilisateur, s))
    if (cible) {
      naviguer(cible)
      return
    }
    if (n.programme_id) ouvrirProgramme(n.programme_id, n.type === 'DROITS_PROCHES' ? 'DROITS' : undefined)
  }

  function marquerToutesLues() {
    setNotifications((prev) => prev.map((n) => ({ ...n, lu: true })))
    marquerToutesNotificationsLues(chaineActive.id).catch((err) => console.error('Marquage lu impossible :', err))
  }

  const Ecran = ECRANS[section]

  // Langue transmise aux écrans de rédaction (P40) : imposée par la section
  // SYNOPSIS_FR / SYNOPSIS_AR ; sinon celle du rôle Rédacteur (tableau de bord /
  // tableau « Bibles & synopsis » orientés langue), `null` pour tout autre rôle.
  const langueEcran =
    section === 'SYNOPSIS_FR' ? 'FR' : section === 'SYNOPSIS_AR' ? 'AR' : langueRedacteur(roleUtilisateur)

  // Cloche filtrée par rôle (P36) : une notification routée (destinataire_role
  // non nul) n'apparaît que pour le rôle visé (et le Super Administrateur).
  const notificationsVisibles = notifications.filter((n) => notificationVisible(n, roleUtilisateur))

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar
        section={section}
        sections={sectionsVisibles}
        onNaviguer={naviguer}
        ouverte={sidebarOuverte}
        onFermer={() => setSidebarOuverte(false)}
        badges={{ GRILLE_LINEAIRE: nbAnomaliesBloquantes }}
        repliee={sidebarRepliee}
        onBasculerReplier={basculerSidebarRepliee}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          utilisateur={utilisateur}
          nomAffiche={utilisateurCourant?.nom_affiche}
          roleLabel={libelleRole(roleUtilisateur)}
          onDeconnexion={handleDeconnexion}
          onToggleSidebar={() => setSidebarOuverte((v) => !v)}
          chaineActive={chaineActive}
          onChangerChaine={changerChaine}
          chaineVerrouillee={chaineVerrouillee(roleUtilisateur)}
          onOuvrirRecherche={() => setRechercheOuverte(true)}
          onOuvrirNotifications={() => {
            setNotificationsOuvertes(true)
            rafraichirNotifications()
          }}
          nbNotificationsNonLues={notificationsVisibles.filter((n) => !n.lu).length}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <Ecran
            chaineActive={chaineActive}
            onAnomaliesBloquantes={setNbAnomaliesBloquantes}
            programmeCible={programmeCible}
            synopsisCible={synopsisCible}
            langue={langueEcran}
            onOuvrirProgramme={ouvrirProgramme}
            onOuvrirSynopsis={ouvrirSynopsis}
            onNotificationCreee={rafraichirNotifications}
            roleUtilisateur={roleUtilisateur}
          />
        </main>
      </div>
      <RechercheGlobale
        chaineActive={chaineActive}
        ouverte={rechercheOuverte}
        onFermer={() => setRechercheOuverte(false)}
        onOuvrirProgramme={ouvrirProgramme}
      />
      {notificationsOuvertes && (
        <PanneauNotifications
          notifications={notificationsVisibles}
          onFermer={() => setNotificationsOuvertes(false)}
          onAller={allerNotification}
          onMarquerToutesLues={marquerToutesLues}
        />
      )}
    </div>
  )
}

export default App
