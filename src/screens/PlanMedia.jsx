import { useState } from 'react';
import { Clock, List as ListIcon, Search, Upload, Settings } from 'lucide-react';
import { VerticalTimeline } from '../helpers/VerticalTimeline';
import PlanMediaAdministration from '../helpers/PlanMediaAdministration.jsx';
import './PlanMedia.css';
import { MdCloudSync } from "react-icons/md";
import { Edit3 } from 'lucide-react';
import { Megaphone } from 'lucide-react';

import { useEffect } from 'react';
import {
  listerPlanMediaParChaine,
  creerPlanMedia,
  listerPlanMediaStockParPlanMedia,
  listerGrillesParChaine,
  listerGrillesTypeParChaine,
  listerProgrammesParChaine,
  listerTousLesEpisodes, listerDiffusionsLineairesParChaine,
  insererPlanificationsMedia, listerPlanificationsMedia,
  data_refrech, listerClassificationsProgrammes, data_annonce_refrech, creerDemandePad, sauvegarderConducteur, listerConducteurs, supprimerConducteur
} from '../lib/db.js';
import { Plus, Trash2, X } from 'lucide-react';
// Remplacez import * as XLSX from 'xlsx'; par :
import * as XLSX from 'xlsx-js-style';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; // <-- Modification ici
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, AlignmentType, WidthType } from 'docx';
import { saveAs } from 'file-saver';
import toast from 'react-hot-toast';
import PigeValidation from '../helpers/PigeValidation.jsx';
import AnalyseurPDF from '../helpers/AnalyseurPDF.jsx';

export default function PlanMedia({ chaineActive, Utilisateur, isReadOnly = false }) {

  const [isLoading, setIsLoading] = useState(false);
  // États pour le formulaire d'insertion d'annonces
  const [formProgrammeId, setFormProgrammeId] = useState('');
  const [formEpisodeId, setFormEpisodeId] = useState('');
  // Nouvel état pour le filtre par grille
  const [filtreGrilleId, setFiltreGrilleId] = useState('');
  // Tableau dynamique pour gérer plusieurs annonces simultanément
  // Chaque élément contient l'ID de l'annonce et son heure de début
  /*const [formAnnonces, setFormAnnonces] = useState([
    { idUnique: Date.now(), annonceId: '', heureDebut: '00:00:00' }
  ]);
*/const [selectedEpisodeId, setSelectedEpisodeId] = useState(null);
  // Gestion des changements dans la liste dynamique d'annonces
  const [page, setPage] = useState("promos");
  // Tableau dynamique pour gérer plusieurs annonces simultanément
  const [formAnnonces, setFormAnnonces] = useState([
    { idUnique: Date.now(), annonceId: '', mode: 'offset', offsetSeconds: '0', timeExact: '00:00:00' }
  ]);

  const ajouterAnnonceAuFormulaire = () => {
    setFormAnnonces(prev => [
      ...prev,
      { idUnique: Date.now(), annonceId: '', mode: 'offset', offsetSeconds: '0', timeExact: '00:00:00' }
    ]);
  };
  const handleAnnonceChange = (idUnique, champ, valeur) => {
    setFormAnnonces(prev =>
      prev.map(item => item.idUnique === idUnique ? { ...item, [champ]: valeur } : item)
    );
  };

  /* const ajouterAnnonceAuFormulaire = () => {
     setFormAnnonces(prev => [
       ...prev,
       { idUnique: Date.now(), annonceId: '', heureDebut: '00:00:00' }
     ]);
   };
 */
  const supprimerAnnonceDuFormulaire = (idUnique) => {
    setFormAnnonces(prev => prev.filter(item => item.idUnique !== idUnique));
  };

  // États pour piloter la génération par date
  // États pour piloter la génération par le Conducteur sélectionné
  const [selectedConducteurId, setSelectedConducteurId] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [planningEdite, setPlanningEdite] = useState([]);
  /**
   * Algorithme de génération automatique du planning publicitaire
   */


  const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    return (parts[0] * 60) + (parts[1] || 0);
  };
  const genererPlanningAuto = (ecransPdf, diffusions, stockAnnonces, classificationsIA, episodes = []) => {
    const planningFinal = [];

    // 🧠 Mémoire de l'algorithme (anti-répétition)
    const compteursUtilisation = {};

    ecransPdf.forEach((ecran) => {
      const nombreDeSpotsRequis = ecran.nb_spots;
      if (nombreDeSpotsRequis <= 0) return;

      const minutesEcran = timeToMinutes(ecran.heure_prev);

      let diffusionAssociee = null;
      let plusPetiteDifference = Infinity;

      diffusions.forEach(d => {
        if (!d.heure_debut) return;

        const minutesDiffusion = timeToMinutes(d.heure_debut);

        // Le programme doit avoir commencé AVANT ou EXACTEMENT À l'heure prévue (heure_prev)
        if (minutesDiffusion <= minutesEcran) {
          const difference = minutesEcran - minutesDiffusion;

          // On cherche le programme le plus proche dans le passé
          if (difference < plusPetiteDifference) {
            plusPetiteDifference = difference;
            diffusionAssociee = d;
          }
        }
      });

      console.log(`Recherche pour ${ecran.heure_prev} -> Trouvé :`, diffusionAssociee?.programme_id || diffusionAssociee?.episode_id);

      let progIdAssocie = null;

      // 2. Vérification et récupération sécurisée du programme_id
      if (diffusionAssociee) {
        if (diffusionAssociee.programme_id) {
          progIdAssocie = diffusionAssociee.programme_id;
        }
        else if (diffusionAssociee.episode_id) {
          const ep = episodes.find(e => e.id === diffusionAssociee.episode_id);
          if (ep) progIdAssocie = ep.programme_id;
        }
      }

      // 🚨 NOUVELLE RÈGLE : Pas d'association = On ignore cet écran
      // Si aucune diffusion n'est trouvée OU qu'aucun programme n'y est lié, on ne génère rien.
      if (!diffusionAssociee || !progIdAssocie) {
        console.warn(`[IGNORÉ] Écran ${ecran.ecran} : Aucune diffusion ou programme associé trouvé.`);
        const msg = `[IGNORÉ] Écran ${ecran.ecran} : Aucune diffusion ou programme associé trouvé.`;
        toast.error(msg)
      }

      // 3. Calcul des cibles via l'IA
      let cibleE = 0, cibleJ = 0, cibleG = 0;

      const classification = classificationsIA.find(c => c.programme_id === progIdAssocie);
      console.log(progIdAssocie)
      console.log(classificationsIA)
      if (classification) {
        cibleE = classification.enfant_point ?? 0;
        cibleJ = classification.adult_point ?? 0;
        cibleG = classification.senior_point ?? 0;
      }

      console.log(`[${ecran.ecran} MATCH] Cibles retenues - E:${cibleE}, J:${cibleJ}, G:${cibleG}`);

      // 4. Filtrage et Tri des annonces (Affinité + Mémoire anti-doublon)
      let annoncesEligibles = stockAnnonces.filter(annonce => annonce.PAD);

      annoncesEligibles.sort((a, b) => {
        const a_E = a.enfantpercentage ?? 0, a_J = a.jeunepercentage ?? 0, a_G = a.grand_percentage ?? a.grandPercentage ?? 0;
        const b_E = b.enfantpercentage ?? 0, b_J = b.jeunepercentage ?? 0, b_G = b.grand_percentage ?? b.grandPercentage ?? 0;

        const diffA = Math.abs(cibleE - a_E) + Math.abs(cibleJ - a_J) + Math.abs(cibleG - a_G);
        const diffB = Math.abs(cibleE - b_E) + Math.abs(cibleJ - b_J) + Math.abs(cibleG - b_G);

        // Pénalité de répétition (+1000 points par utilisation précédente)
        const malusA = (compteursUtilisation[a.id] || 0) * 1000;
        const malusB = (compteursUtilisation[b.id] || 0) * 1000;

        return (diffA + malusA) - (diffB + malusB);
      });

      // 5. Sélection des spots et mise à jour de la mémoire
      const spotsSelectionnes = annoncesEligibles.slice(0, nombreDeSpotsRequis);

      spotsSelectionnes.forEach(spot => {
        compteursUtilisation[spot.id] = (compteursUtilisation[spot.id] || 0) + 1;
      });

      // 6. Enregistrement dans le planning
      planningFinal.push({
        ecran_id: ecran.id,
        heure_ecran: ecran.ecran,
        contexte: ecran.contexte,
        nb_spots_requis: nombreDeSpotsRequis,
        spots_assignes: spotsSelectionnes,
        heure_prev: ecran.heure_prev,
        // 🔗 Données relationnelles requises pour l'insertion en BDD (ON DELETE CASCADE)
        episode_id: diffusionAssociee.episode_id || null,
        grille_id: diffusionAssociee.grille_id || null,

        duree_totale_spots: spotsSelectionnes.reduce((acc, spot) => acc + (spot.duration || 30), 0),
        cible_enfant: cibleE,
        cible_adulte: cibleJ,
        cible_senior: cibleG
      });
    });

    return planningFinal;
  };



  const handleGenererAuto = async () => {
    if (!selectedConducteurId) {
      alert("Veuillez sélectionner un conducteur (CPB).");
      return;
    }

    // 1. Récupérer le conducteur sélectionné et sa date
    const conducteurSelectionne = conducteurpub.find(c => c.id === selectedConducteurId);
    if (!conducteurSelectionne || !conducteurSelectionne.donnees) {
      alert("Données du conducteur introuvables.");
      return;
    }

    const dateCible = conducteurSelectionne.date; // La date est auto-sélectionnée ici !

    setIsGenerating(true);
    setPlanningEdite([]);

    // Délai artificiel pour l'animation de chargement
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      // 2. Filtrer les diffusions en utilisant la date auto-sélectionnée
      // 1. Filtrer par date
      const diffusionsFiltrees = diffusions.filter(d =>
        (d.date === dateCible) || (d.date_diffusion === dateCible)
      );

      // 2. Garder uniquement les diffusions avec une `heure_debut` unique
      const heuresVues = new Set();
      const diffusionsDuJour = diffusionsFiltrees.filter(d => {
        if (heuresVues.has(d.heure_debut)) {
          return false; // On l'a déjà vu, on l'ignore (doublon)
        }
        heuresVues.add(d.heure_debut); // On le mémorise
        return true; // On le garde
      });

      // 3. Filtrer les annonces (PAD OK + Validité à cette date)
      const annoncesValides = stockAnnonces.filter(annonce => {
        if (!annonce.PAD) return false;

        const dateDebut = annonce.validite_debut || "2000-01-01";
        const dateFin = annonce.validite_fin || "2099-12-31";

        return dateCible >= dateDebut && dateCible <= dateFin;
      });

      if (annoncesValides.length === 0) {
        alert(`Aucune annonce valide trouvée pour la date du ${dateCible}.`);
        setIsGenerating(false);
        return;
      }

      // 4. Lancement de l'algorithme avec les données filtrées
      console.log("diffusuin du jours  ")
      console.log(diffusionsDuJour)
      const planning = genererPlanningAuto(
        conducteurSelectionne.donnees,
        diffusionsDuJour,
        annoncesValides,
        ProgrammeClassification
      );
      console.log("generation .............")
      console.log(planning);
      setPlanningEdite(planning);
    } catch (error) {
      console.error("Erreur lors de la génération :", error);
      toast.error("Une erreur est survenue lors de l'analyse.");
    } finally {
      setIsGenerating(false);
    }
  };
  // Fonction pour sauvegarder le résultat final en base de données
  // N'oubliez pas d'importer votre fonction :
  // import { insererPlanificationsMedia } from '../lib/db.js';

  const validerEtSauvegarderPlanning = async () => {
    try {
      if (!selectedConducteurId) {
        alert("Erreur : Aucun conducteur n'est sélectionné.");
        return;
      }

      const conducteurSelectionne = conducteurpub.find(c => c.id === selectedConducteurId);
      const dateCible = conducteurSelectionne?.date;

      // On récupère l'ID de la chaîne active (depuis vos props ou contexte global)
      const chaineIdActuelle = chaineActive?.id || conducteurSelectionne?.chaine_id;

      const planificationsAInserer = [];

      planningEdite.forEach((ecran) => {
        let heureCouranteStr = ecran.heure_prev || ecran.heure_ecran;
        if (heureCouranteStr.length === 5) heureCouranteStr += ":00";

        let [h, m, s] = heureCouranteStr.split(':').map(Number);
        let dateCourante = new Date(2000, 0, 1, h, m, s || 0);

        if (ecran.spots_assignes && ecran.spots_assignes.length > 0) {
          ecran.spots_assignes.forEach((spot, index) => {
            if (spot && spot.id) {
              const durationSec = spot.duration || 30;

              // 1. Si l'utilisateur a forcé une heure, on recalibre l'horloge
              const heureForcee = ecran.heures_personnalisees?.[index];
              if (heureForcee) {
                const [fh, fm, fs] = heureForcee.split(':').map(Number);
                dateCourante = new Date(2000, 0, 1, fh, fm, fs || 0);
              }

              const heureDebutStr = dateCourante.toTimeString().split(' ')[0];

              // 2. On avance l'horloge de la durée du spot pour avoir la fin
              dateCourante.setSeconds(dateCourante.getSeconds() + durationSec);
              const heureFinStr = dateCourante.toTimeString().split(' ')[0];

              planificationsAInserer.push({
                episode_id: ecran.episode_id,
                annonce_id: spot.id,
                grille_id: ecran.grille_id,
                chaine_id: chaineIdActuelle,
                date: dateCible,
                timestart: heureDebutStr,
                timeend: heureFinStr
              });
            }
          });
        }
      });

      if (planificationsAInserer.length === 0) {
        alert("Le planning est vide. Assignez au moins une annonce.");
        return;
      }

      // Appel direct de votre fonction db.js
      await insererPlanificationsMedia(planificationsAInserer);

      alert("Planning enregistré avec succès !");
      setPlanningEdite([]); // Nettoyage de l'interface
      setdatachanged(!datachanged);

    } catch (error) {
      console.error("Erreur lors de la sauvegarde :", error);
      alert("Erreur lors de l'enregistrement du planning.");
    }
  };

  // Fonction pour forcer manuellement l'heure d'un spot
  const modifierHeureSpot = (ecranId, indexSpot, nouvelleHeure) => {
    const nouveauPlanning = [...planningEdite];
    const ecranIndex = nouveauPlanning.findIndex(e => e.ecran_id === ecranId);

    // On crée un dictionnaire des heures personnalisées s'il n'existe pas
    if (!nouveauPlanning[ecranIndex].heures_personnalisees) {
      nouveauPlanning[ecranIndex].heures_personnalisees = {};
    }

    // On enregistre l'heure forcée pour cet index précis
    nouveauPlanning[ecranIndex].heures_personnalisees[indexSpot] = nouvelleHeure;

    setPlanningEdite(nouveauPlanning);
  };
  const getHeureSpot = (indexSpot) => {
    // Si l'utilisateur a forcé l'heure, on l'affiche directement
    if (ecran.heures_personnalisees?.[indexSpot]) {
      return ecran.heures_personnalisees[indexSpot];
    }

    const heureBase = ecran.heure_prev || ecran.heure_ecran;
    if (!heureBase) return "00:00:00";

    let [h, m, s] = heureBase.split(':').map(Number);
    let dateTemp = new Date(2000, 0, 1, h, m, s || 0);

    // On cascade en prenant en compte les temps des spots ET les forçages précédents
    for (let i = 0; i < indexSpot; i++) {
      if (ecran.heures_personnalisees?.[i]) {
        const [fh, fm, fs] = ecran.heures_personnalisees[i].split(':').map(Number);
        dateTemp = new Date(2000, 0, 1, fh, fm, fs || 0);
      }
      const duration = ecran.spots_assignes?.[i]?.duration || 30;
      dateTemp.setSeconds(dateTemp.getSeconds() + duration);
    }

    return dateTemp.toTimeString().split(' ')[0];
  }; // 2. Fonction déclenchée quand l'utilisateur choisit un programme dans la liste

  const getclassifications = () => {
    const diffusionActuelle = diffusions.find(
      d => d.episode_id === formEpisodeId
    );

    const classificationIA = diffusionActuelle
      ? ProgrammeClassification.find(
        c => c.programme_id === diffusionActuelle.programme_id
      )
      : null;


    if (!classificationIA) {
      return (
        <div className="classification-unavailable">
          <span className="classification-unavailable-icon">ℹ</span>
          <span>La classification n'est pas encore disponible</span>
        </div>
      );
    }

    return (
      <div className="classification-container">
        <div className="classification-title">
          Classification du programme
        </div>

        <div className="classification-items">

          <div className="classification-card classification-enfant">
            <span className="classification-label">Enfant</span>
            <span className="classification-score">
              {classificationIA.enfant_point ?? 0}%
            </span>
          </div>

          <div className="classification-card classification-adulte">
            <span className="classification-label">Adulte</span>
            <span className="classification-score">
              {classificationIA.adult_point ?? 0}%
            </span>
          </div>

          <div className="classification-card classification-senior">
            <span className="classification-label">Grand</span>
            <span className="classification-score">
              {classificationIA.senior_point ?? 0}%
            </span>
          </div>

        </div>
      </div>
    );
  };
  // Utilitaire pour ajouter des secondes à une heure au format "HH:MM:SS"
  const ajouterSecondesHeure = (timeStr, secondsToAdd) => {
    if (!timeStr) return '00:00:00';
    const parts = timeStr.split(':');
    let hours = parseInt(parts[0] || 0, 10);
    let minutes = parseInt(parts[1] || 0, 10);
    let seconds = parseInt(parts[2] || 0, 10);

    let totalSeconds = hours * 3600 + minutes * 60 + seconds + parseInt(secondsToAdd, 10);

    let h = Math.floor(totalSeconds / 3600) % 24;
    let m = Math.floor((totalSeconds % 3600) / 60);
    let s = totalSeconds % 60;

    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const gererSoumissionFormulaire = async (e) => {
    e.preventDefault();

    try {
      // 1. Trouver la diffusion correspondante à l'épisode sélectionné pour récupérer la date, grille et chaîne
      const diffusionActuelle = diffusions.find(d => d.episode_id === formEpisodeId);

      if (!diffusionActuelle) {
        toast.error("Aucune diffusion trouvée pour cet épisode.");
        return;
      }

      // 2. Préparer le tableau des planifications à insérer
      const planificationsPayload = formAnnonces.map(annonceItem => {
        let timestart = '00:00:00';

        if (annonceItem.mode === 'exact') {
          timestart = annonceItem.timeExact.length === 5 ? `${annonceItem.timeExact}:00` : annonceItem.timeExact;
        } else {
          // Mode décalage : ajoute les secondes par rapport à l'heure de début de l'épisode
          const heureDebutEpisode = diffusionActuelle.heure_debut || '00:00:00';
          timestart = ajouterSecondesHeure(heureDebutEpisode, annonceItem.offsetSeconds);
        }

        // Calculer l'heure de fin en fonction de la durée de l'annonce (par défaut 30s)
        const stockAnnonce = stockAnnonces.find(s => s.id === annonceItem.annonceId);
        const dureeSec = stockAnnonce?.duration || 30;
        const timeend = ajouterSecondesHeure(timestart, dureeSec);
        if (!filtreGrilleId) { toast.error("ooops no grille id"); }
        return {
          episode_id: formEpisodeId,
          annonce_id: annonceItem.annonceId,
          grille_id: filtreGrilleId,
          chaine_id: diffusionActuelle.chaine_id || null,
          date: diffusionActuelle.date_diffusion || diffusionActuelle.date,
          timestart: timestart,
          timeend: timeend
        };
      });


      const heuresDeDebut = planificationsPayload.map(planification => planification.timestart);
      const heuresUniques = new Set(heuresDeDebut);

      if (heuresUniques.size !== heuresDeDebut.length) {
        toast.error("Impossible d'insérer : Plusieurs annonces sont programmées exactement à la même heure.");
        return; // Bloque la requête vers la base de données
      }
      // 3. Appel de la fonction d'insertion en base de données
      await insererPlanificationsMedia(planificationsPayload);

      toast.success("Planifications enregistrées avec succès !");
      fermerModal();

      // Optionnel : Recharger vos données de planifications ici si nécessaire
    } catch (error) {
      console.error("Erreur lors de l'enregistrement des planifications :", error);
      toast.error("Erreur lors de l'enregistrement des planifications");

    }
  };


  // Navigation principale entre Gestion Plan Média, Validation Pige et Administration Plan Média
  const [vuePrincipale, setVuePrincipale] = useState('PLAN_MEDIA');

  // Stock d'annonces centralisé partagé entre la liste de droite et l'administration
  const [chargement, setChargement] = useState(false);
  const [planMediaActif, setPlanMediaActif] = useState(null);
  const [grilles, setGrilles] = useState([]);
  const [grilleTypes, setGrilleTypes] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [diffusions, setDiffusions] = useState([]);
  const [planificationsMedia, setPlanificationsMedia] = useState([]);  // Le stock d'annonces démarre vide, il sera peuplé par Supabase via plan_media_stock
  const [stockAnnonces, setStockAnnonces] = useState([]);
  // États pour les filtres et la recherche de la timeline (colonne gauche)
  const [filtresTimeline, setFiltresTimeline] = useState(['annonce', 'episode']);
  const [rechercheTimeline, setRechercheTimeline] = useState('');
  const [conducteurpub, setConducteurpub] = useState([]);
  // États pour la recherche et les 4 boutons de la liste (colonne droite)
  const [filtreOrdre, setFiltreOrdre] = useState('enfant');
  const [rechercheListe, setRechercheListe] = useState('');
  const [ProgrammeClassification, setProgrammeClassification] = useState([]);
  // État pour la Pige Validation (upload fichier excel)
  const [fichierPige, setFichierPige] = useState(null);

  const toggleFiltreTimeline = (filtre) => {
    setFiltresTimeline(prev =>
      prev.includes(filtre)
        ? prev.filter(f => f !== filtre)
        : [...prev, filtre]
    );
  };
  const [dateFiltreTimeline, setDateFiltreTimeline] = useState(
    new Date().toISOString().split('T')[0]
  );
  // Fake data for the timeline
  const mockEvents = [
  ];

  // Filtrage dynamique du stock d'annonces pour la colonne de droite
  const listeFiltree = stockAnnonces.filter((item) => {
    const titreItem = item.nom || item.title || '';
    const matchRecherche = rechercheListe.trim() === '' || titreItem.toLowerCase().includes(rechercheListe.toLowerCase());
    return matchRecherche;
  }).sort((a, b) => {
    const scoreA = a.pourcentages?.[filtreOrdre] || a[`${filtreOrdre}percentage`] || a.grand_percentage || 0;
    const scoreB = b.pourcentages?.[filtreOrdre] || b[`${filtreOrdre}percentage`] || b.grand_percentage || 0;
    return scoreB - scoreA;
  });
  const [isModalOuvert, setIsModalOuvert] = useState(false);
  const [datachanged, setdatachanged] = useState(false);



  useEffect(() => {
    if (!chaineActive?.id) return;

    let actif = true;
    setChargement(true);

    async function chargerDonnees() {
      try {
        // 1. Récupérer ou créer le plan_media associé à la chaîne active
        let plans = await listerPlanMediaParChaine(chaineActive.id);
        let planCourant = plans && plans.length > 0 ? plans[0] : null;

        if (!planCourant) {
          planCourant = await creerPlanMedia({
            chaine_id: chaineActive.id,
            nom: `Plan Média - ${chaineActive.nom || 'Chaîne'}`,
            est_live: true
          });
        }

        if (actif) {
          setPlanMediaActif(planCourant);
        }

        // 2. Charger en parallèle le stock lié au plan média et les autres tables de référence
        // 2. Charger en parallèle le stock lié au plan média et les autres tables de référence
        const [
          stockDb,
          grillesDb,
          grillesTypesDb,
          programmesDb,
          episodesDb,
          diffusionsDb,
          planificationsMediaDb,
          programmeclassificationDb,
          conducteurpubDb
          // <-- Ajoutez ceci
        ] = await Promise.all([
          planCourant?.id ? listerPlanMediaStockParPlanMedia(planCourant.id) : Promise.resolve([]),
          listerGrillesParChaine(chaineActive.id),
          listerGrillesTypeParChaine(chaineActive.id),
          listerProgrammesParChaine(chaineActive.id),
          listerTousLesEpisodes(),
          listerDiffusionsLineairesParChaine(chaineActive.id), // <-- Ajoutez l'appel API ici
          listerPlanificationsMedia(),
          listerClassificationsProgrammes(),
          listerConducteurs(chaineActive.id)]);


        if (actif) {
          setStockAnnonces(stockDb || []);
          setGrilles(grillesDb || []);
          setGrilleTypes(grillesTypesDb || []);
          setProgrammes(programmesDb || []);
          setEpisodes(episodesDb || []);
          setDiffusions(diffusionsDb || []);
          setPlanificationsMedia(planificationsMediaDb || []);
          setProgrammeClassification(programmeclassificationDb)// <-- Stockez le résultat ici
            , setConducteurpub(conducteurpubDb)

        }
      } catch (erreur) {
        toast.error("Erreur lors du chargement des données Plan Média :", erreur);
      } finally {
        if (actif) setChargement(false);
      }
    }

    chargerDonnees();

    return () => {
      actif = false;
    };
  }, [chaineActive?.id, filtreGrilleId, isModalOuvert, datachanged]);




  async function update_clasification() {
    try {
      setIsLoading(true);
      if (vuePrincipale === "PLAN_MEDIA") {
        await data_refrech(filtreGrilleId);
        setdatachanged(!datachanged);
      } else if (vuePrincipale === "PLAN_MEDIA_ADMIN") {
        await data_annonce_refrech();
        setdatachanged(!datachanged);
      }

    } catch (err) {
      toast.error("Problèmes lors de la génération des classifications ! Contactez l’administrateur.");
    } finally {
      setIsLoading(false);
      toast.success("Le calcul des classifications est terminé.");
    }
  }



  // Construction dynamique des événements pour la Timeline

  const genererEvenementsTimeline = () => {
    let eventsGenerees = [];

    // 1. Sécurisation de la variable de recherche
    const rechercheSafe = (rechercheTimeline || '').trim().toLowerCase();

    // 2. Sécurisation de diffusions (protection si undefined)
    const diffusionsFiltrees = (diffusions || []).filter(diff => {
      if (!diff) return false; // Ignore les éléments nuls du tableau
      if (!filtreGrilleId) return true;
      return diff.grille_id === filtreGrilleId;
    });

    // 3. Sécurisation de l'accès à filtresTimeline
    const filtresSafe = filtresTimeline || [];

    // --- PROGRAMMES ET ÉPISODES ---
    if (diffusionsFiltrees.length > 0 && filtresSafe.includes('episode')) {
      const diffusionsParDate = diffusionsFiltrees.reduce((groupes, diff) => {
        const dateStr = diff?.date || 'Sans date';
        if (!groupes[dateStr]) groupes[dateStr] = [];
        groupes[dateStr].push(diff);
        return groupes;
      }, {});

      Object.entries(diffusionsParDate).forEach(([date, listeDiffusions]) => {
        (listeDiffusions || []).forEach((diff) => {
          if (!diff) return;

          // Sécurisation de la recherche dans episodes et programmes
          const ep = (episodes || []).find(e => e && e.id === diff.episode_id);
          const prog = (programmes || []).find(p => p && (p.id === diff.programme_id || (ep && ep.programme_id === p.id)));

          const titreEp = ep?.titre || ep?.nom || (ep?.numero ? `Épisode ${ep.numero}` : null);
          const titreProg = prog?.titre || prog?.nom || 'Programme Inconnu';
          const nomAffichage = titreEp || titreProg;
          const descParent = prog ? `Programme : ${titreProg}` : '';

          if (rechercheSafe === '' || nomAffichage.toLowerCase().includes(rechercheSafe)) {
            eventsGenerees.push({
              id: diff.id || `diff-${Math.random()}`, // Fallback ID unique
              date_tri: date,
              time: diff.heure_debut || '00:00',
              name: nomAffichage,
              details: {
                type: ep ? 'Épisode' : 'Programme',
                programme: titreProg,
                date: date,
                duree: diff.duree || (ep?.duree ? `${ep.duree} min` : '00:00:00'),
                description: descParent || diff.description || ''
              }
            });
          }
        });
      });
    }

    // --- ANNONCES ET PLANIFICATIONS MEDIA ---
    if ((planificationsMedia || []).length > 0 && filtresSafe.includes('annonce')) {
      (planificationsMedia || []).forEach((plan) => {
        if (!plan) return;

        // Filtrer par grille si un filtre de grille est actif
        if (filtreGrilleId && plan.grille_id !== filtreGrilleId) return;

        // Récupérer l'annonce liée avec sécurisation
        const stockAnnonce = (stockAnnonces || []).find(s => s && s.id === plan.annonce_id);
        const titreAnnonce = stockAnnonce?.nom || stockAnnonce?.title || 'Annonce planifiée';

        if (rechercheSafe === '' || titreAnnonce.toLowerCase().includes(rechercheSafe)) {
          const dateStr = plan.date || new Date().toISOString().split('T')[0];
          const timeStr = plan.timestart ? plan.timestart.substring(0, 5) : '00:00';

          eventsGenerees.push({
            id: plan.id || `plan-${Math.random()}`, // Fallback ID unique
            date_tri: dateStr,
            time: timeStr,
            name: titreAnnonce,
            details: {
              type: stockAnnonce?.type || 'Annonce', // <-- Protection ici (évite le crash "Cannot read properties of undefined")
              duree: stockAnnonce?.duration ? `${stockAnnonce.duration}s` : '30s',
              description: stockAnnonce?.client ? `Client : ${stockAnnonce.client}` : ''
            }
          });
        }
      });
    }

    // 4. Application du filtre par date sélectionnée (sécurisé)
    if (dateFiltreTimeline) {
      eventsGenerees = eventsGenerees.filter(event => event && event.date_tri === dateFiltreTimeline);
    }

    // 5. Tri chronologique global sécurisé (Date puis Heure)
    eventsGenerees.sort((a, b) => {
      const dateA = a?.date_tri || '';
      const dateB = b?.date_tri || '';

      if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }

      const timeA = a?.time || '';
      const timeB = b?.time || '';
      return timeA.localeCompare(timeB);
    });

    // 6. Retour sécurisé
    return eventsGenerees.length > 0 ? eventsGenerees : (mockEvents || []);
  };







  //get pige events 
  const genererEvenementsPige = () => {
    let eventsGenerees = [];

    // Sécurisation de la chaîne de recherche (évite le crash si rechercheTimeline est null/undefined)
    const rechercheSafe = (rechercheTimeline || '').trim().toLowerCase();

    // 1. Sécurisation du tableau de base: (diffusions || [])
    const diffusionsFiltrees = (diffusions || []).filter(diff => {
      if (!diff) return false; // Protection contre un objet vide/null dans le tableau
      //if (!filtreGrilleId) return true;
      //return diff.grille_id === filtreGrilleId;
      return true;
    });

    const diffusionsParDate = diffusionsFiltrees.reduce((groupes, diff) => {
      const dateStr = diff.date || 'Sans date';
      if (!groupes[dateStr]) groupes[dateStr] = [];
      groupes[dateStr].push(diff);
      return groupes;
    }, {});

    Object.entries(diffusionsParDate).forEach(([date, listeDiffusions]) => {
      (listeDiffusions || []).forEach((diff) => {
        if (!diff) return;

        // Sécurisation des recherches dans les tableaux (episodes et programmes)
        const ep = (episodes || []).find(e => e && e.id === diff.episode_id);
        const prog = (programmes || []).find(p => p && (p.id === diff.programme_id || (ep && ep.programme_id === p.id)));

        const titreEp = ep?.titre || ep?.nom || (ep?.numero ? `Épisode ${ep.numero}` : null);
        const titreProg = prog?.titre || prog?.nom || 'Programme Inconnu';
        const nomAffichage = titreEp || titreProg;
        const descParent = prog ? `Programme : ${titreProg}` : '';

        if (rechercheSafe === '' || nomAffichage.toLowerCase().includes(rechercheSafe)) {
          eventsGenerees.push({
            id: diff.id || `diff-${Math.random()}`,
            date_tri: date,
            time: diff.heure_debut || '00:00',
            name: nomAffichage,
            details: {
              type: ep ? 'Épisode' : 'Programme',
              programme: titreProg,
              date: date,
              duree: diff.duree || (ep?.duree ? `${ep.duree} min` : '00:00:00'),
              description: descParent || diff.description || ''
            }
          });
        }
      });
    });

    // 2. Sécurisation de planificationsMedia
    (planificationsMedia || []).forEach((plan) => {
      if (!plan) return;

      //if (filtreGrilleId && plan.grille_id !== filtreGrilleId) return;

      // Sécurisation de la recherche dans stockAnnonces
      const stockAnnonce = (stockAnnonces || []).find(s => s && s.id === plan.annonce_id);
      const titreAnnonce = stockAnnonce?.nom || stockAnnonce?.title || 'Annonce planifiée';

      if (rechercheSafe === '' || titreAnnonce.toLowerCase().includes(rechercheSafe)) {
        const dateStr = plan.date || new Date().toISOString().split('T')[0];
        const timeStr = plan.timestart ? plan.timestart.substring(0, 5) : '00:00';

        eventsGenerees.push({
          id: plan.id || `plan-${Math.random()}`,
          date_tri: dateStr,
          time: timeStr,
          name: titreAnnonce,
          details: {
            // Utilisation de l'optional chaining pour type (évite l'erreur "Cannot read properties of undefined (reading 'type')")
            type: stockAnnonce?.type || 'Annonce',
            duree: stockAnnonce?.duration ? `${stockAnnonce.duration}s` : '30s',
            description: stockAnnonce?.client ? `Client : ${stockAnnonce.client}` : ''
          }
        });
      }
    });

    // 3. Sécurisation du tri (localeCompare plante si la variable n'est pas une string)
    eventsGenerees.sort((a, b) => {
      const dateA = a.date_tri || '';
      const dateB = b.date_tri || '';
      if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }
      const timeA = a.time || '';
      const timeB = b.time || '';
      return timeA.localeCompare(timeB);
    });

    // Sécurisation du retour (au cas où mockEvents n'existerait pas)
    return eventsGenerees.length > 0 ? eventsGenerees : (mockEvents || []);
  };




  const [rechercheEpisodeForm, setRechercheEpisodeForm] = useState('');
  const handleEpisodeSelection = (episodeId, df_id) => {
    setFormEpisodeId(episodeId);
    setSelectedEpisodeId(df_id);
    setFormAnnonces([{ idUnique: Date.now(), annonceId: '', mode: 'offset', offsetSeconds: '0', timeExact: '00:00:00' }]);

    if (episodeId) {
      const epTrouve = episodes.find(ep => ep.id === episodeId);
      if (epTrouve && epTrouve.programme_id) {
        setFormProgrammeId(epTrouve.programme_id);
      }
      setIsModalOuvert(true); // Ouvre la modale
    } else {
      setFormProgrammeId('');
    }
  };
  const fermerModal = () => {
    setIsModalOuvert(false);
    setTimeout(() => {
      setFormEpisodeId('');
      setFormProgrammeId('');
      setFormAnnonces([{ idUnique: Date.now(), annonceId: '', mode: 'offset', offsetSeconds: '0', timeExact: '00:00:00' }]);
    }, 200); // Petit délai pour laisser l'animation de fermeture (optionnel)
  };
  // 1. Obtenir la date du jour au format YYYY-MM-DD
  const dateDuJour = new Date().toISOString().split('T')[0];

  // 2. Fonction pour générer le titre basé sur la date
  const genererTitreParDefaut = (dateString) => {
    const dateObj = new Date(dateString);
    const options = { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' };
    let formatted = dateObj.toLocaleDateString('fr-FR', options);
    // Transforme "jeudi 17 sept. 2026" en "PM JEUDI 17 SEPT 2026"
    return `PM ${formatted.replace('.', '').toUpperCase()}`;
  };


  const [modalExportOuvert, setModalExportOuvert] = useState(false);
  const [exportTitre, setExportTitre] = useState(genererTitreParDefaut(dateDuJour));
  const [exportDate, setExportDate] = useState(dateDuJour);
  const [exportGrilleId, setExportGrilleId] = useState('');

  useEffect(() => {
    setExportTitre(genererTitreParDefaut(exportDate));
  }, [exportDate]);

  const preparerDonneesExport = () => {
    const donneesFiltrees = planificationsMedia.filter(plan => {
      if (exportDate) {
        if (!plan.date) return false;
        const planDateSeule = String(plan.date).split('T')[0].trim().substring(0, 10);
        if (planDateSeule !== exportDate) return false;
      }
      return true;
    });

    if (donneesFiltrees.length === 0) {
      toast.error("Aucune annonce planifiée pour cette date et cette grille.");
      return null;
    }

    const joursFrancais = ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'];
    const planificationsGroupees = donneesFiltrees.reduce((acc, plan) => {
      if (!acc[plan.episode_id]) acc[plan.episode_id] = [];
      acc[plan.episode_id].push(plan);
      return acc;
    }, {});

    const lignesExport = [];

    Object.values(planificationsGroupees).forEach(groupe => {
      groupe.sort((a, b) => (a.timestart || '').localeCompare(b.timestart || ''));
      groupe.forEach((plan, index) => {
        const dateStr = String(plan.date).trim().substring(0, 10);
        const [annee, mois, jour] = dateStr.split('-');
        const dateObj = new Date(annee, mois - 1, jour);
        const jourTexte = joursFrancais[dateObj.getDay()];

        const episode = episodes.find(e => e.id === plan.episode_id) || {};
        const programme = programmes.find(p => p.id === episode.programme_id) || {};
        const stockAnnonce = stockAnnonces.find(a => a.id === plan.annonce_id) || plan.plan_media_stock || {};

        const estPremiereLigne = index === 0;
        const titreContexte = programme.titre || programme.nom || episode.titre || episode.nom || `Épisode ${episode.numero || ''}`;

        const dureeSec = stockAnnonce.duration || 0;
        const h = Math.floor(dureeSec / 3600);
        const m = Math.floor((dureeSec % 3600) / 60);
        const s = dureeSec % 60;

        lignesExport.push({
          JOUR: jourTexte,
          H: estPremiereLigne && plan.timestart ? plan.timestart.substring(0, 5) : '',
          CONTEXTE: estPremiereLigne ? titreContexte : '',
          CONTENU: stockAnnonce.nom || stockAnnonce.title || 'Annonce Inconnue',
          DUREE: `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        });
      });
    });

    return lignesExport;
  };


  const exporterVersPDF = (e) => {
    e.preventDefault();
    const lignesExport = preparerDonneesExport();
    if (!lignesExport) return;

    // Création du document
    const doc = new jsPDF('landscape');
    const titreFinal = exportTitre || `Conducteur d'antenne du ${exportDate}`;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(titreFinal, doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });

    const tableData = lignesExport.map(row => [row.JOUR, row.H, row.CONTEXTE, row.CONTENU, row.DUREE]);

    // ATTENTION ICI : doc doit absolument être le premier paramètre !
    autoTable(doc, {
      startY: 25,
      head: [['JOUR', 'H.', 'CONTEXTE', 'CONTENU', 'DUREE']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'left' },
      styles: { fontStyle: 'bold', valign: 'middle', textColor: [20, 20, 20] },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 20 },
        2: { cellWidth: 70 },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 25 }
      }
    });

    doc.save(`PM_${exportDate || 'Export'}.pdf`);
    setModalExportOuvert(false);
  };

  const exporterVersWord = async (e) => {
    e.preventDefault();
    const lignesExport = preparerDonneesExport();
    if (!lignesExport) return;

    const titreFinal = exportTitre || `Conducteur d'antenne du ${exportDate}`;

    // En-têtes du tableau avec fond gris clair
    const headerRow = new TableRow({
      tableHeader: true,
      children: ['JOUR', 'H.', 'CONTEXTE', 'CONTENU', 'DUREE'].map(text =>
        new TableCell({
          shading: { fill: "F3F4F6" },
          children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 24 })] })]
        })
      )
    });

    // Lignes de données (Texte en gras / bold = true)
    const dataRows = lignesExport.map(row =>
      new TableRow({
        children: [row.JOUR, row.H, row.CONTEXTE, row.CONTENU, row.DUREE].map(text =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: text || '', bold: true, size: 22 })] })]
          })
        )
      })
    );

    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows]
    });

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [new TextRun({ text: titreFinal, bold: true, size: 32 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 } // Espace sous le titre
          }),
          table
        ]
      }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `PM_${exportDate || 'Export'}.docx`);
    setModalExportOuvert(false);
  };

  const exporterVersExcel = (e) => {
    e.preventDefault();

    // 1. Filtrer les planifications selon la grille et la date sélectionnées



    const donneesFiltrees = planificationsMedia.filter(plan => {
      let correspond = true;
      if (exportDate && plan.date !== exportDate) correspond = false;

      return correspond;
    });

    if (donneesFiltrees.length === 0) {
      toast.error("Aucune donnée ne correspond à cette grille et cette date.");
      return;
    }

    const joursFrancais = ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'];

    // 2. Grouper par épisode
    const planificationsGroupees = donneesFiltrees.reduce((acc, plan) => {
      if (!acc[plan.episode_id]) acc[plan.episode_id] = [];
      acc[plan.episode_id].push(plan);
      return acc;
    }, {});

    const lignesExcel = [];

    // 3. Construire les lignes
    Object.values(planificationsGroupees).forEach(groupe => {
      groupe.sort((a, b) => (a.timestart || '').localeCompare(b.timestart || ''));

      groupe.forEach((plan, index) => {
        // Extraction du jour en gérant la conversion de date
        const dateStr = String(plan.date).trim().substring(0, 10);
        const [annee, mois, jour] = dateStr.split('-');
        const dateObj = new Date(annee, mois - 1, jour);
        const jourTexte = joursFrancais[dateObj.getDay()];

        // Résolution manuelle depuis les tableaux (pas de relations Supabase directes)
        const episode = episodes.find(e => e.id === plan.episode_id) || {};
        const programme = programmes.find(p => p.id === episode.programme_id) || {};
        const stockAnnonce = stockAnnonces.find(a => a.id === plan.annonce_id) || plan.plan_media_stock || {};

        const estPremiereLigne = index === 0;

        // Affichage prioritaire : Titre Programme -> Titre Épisode -> Numéro Épisode
        const titreContexte = programme.titre || programme.nom || episode.titre || episode.nom || `Épisode ${episode.numero || ''}`;
        const contexteTexte = estPremiereLigne ? titreContexte : '';

        const heureTexte = estPremiereLigne && plan.timestart ? plan.timestart.substring(0, 5) : '';

        const dureeSec = stockAnnonce.duration || 0;
        const h = Math.floor(dureeSec / 3600);
        const m = Math.floor((dureeSec % 3600) / 60);
        const s = dureeSec % 60;
        const dureeFormatee = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

        lignesExcel.push({
          'JOUR': jourTexte,
          'H.FIN': heureTexte,
          'CONTEXTE': contexteTexte,
          'CONTENU': stockAnnonce.nom || stockAnnonce.title || 'Annonce Inconnue',
          'DUREE': dureeFormatee
        });
      });
    });

    // 4. Création de la feuille (Décalage à la ligne 3 pour laisser place au titre)
    const worksheet = XLSX.utils.json_to_sheet(lignesExcel, { origin: "A3" });
    // 5. Ajout du Titre personnalisé en A1
    const titreFinal = exportTitre || `Conducteur d'antenne du ${exportDate}`;
    XLSX.utils.sheet_add_aoa(worksheet, [[titreFinal]], { origin: "A1" });

    // Fusionner les cellules (A1 à E1) pour que le titre soit centré visuellement
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }
    ];

    // Ajustement de la largeur des colonnes
    worksheet['!cols'] = [
      { wch: 15 }, // JOUR
      { wch: 10 }, // H.
      { wch: 40 }, // CONTEXTE
      { wch: 55 }, // CONTENU
      { wch: 12 }  // DUREE
    ];


    // 6. Application des styles (Titre, En-têtes, Contenu)
    for (const cellAddress in worksheet) {
      // Ignorer les métadonnées de la feuille (qui commencent par '!')
      if (cellAddress.startsWith('!')) continue;

      const rowNum = parseInt(cellAddress.replace(/\D/g, ''), 10);

      // Initialiser l'objet style pour la cellule
      worksheet[cellAddress].s = {};

      if (rowNum === 1) {
        // Titre principal (Ligne 1) : Grand et centré
        worksheet[cellAddress].s = {
          font: { sz: 16, bold: true },
          alignment: { horizontal: 'center', vertical: 'center' }
        };
      }
      else if (rowNum === 3) {
        // En-têtes de colonnes (Ligne 3) : En gras et fond léger
        worksheet[cellAddress].s = {
          font: { bold: true, sz: 12 },
          fill: { fgColor: { rgb: "F3F4F6" } }, // Gris très clair pour détacher l'en-tête
          alignment: { horizontal: 'left', vertical: 'center' }
        };
      }
      else if (rowNum > 3) {
        // Contenu des données (Lignes > 3) : En gras ("bald") comme demandé
        worksheet[cellAddress].s = {
          font: { bold: true, sz: 11 },
          alignment: { vertical: 'center' }
        };
      }
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Conducteur PM");

    XLSX.writeFile(workbook, `PM_${exportDate || 'Export'}.xlsx`);

    // Fermer le modal
    setModalExportOuvert(false);
  };

  const [exportFormat, setExportFormat] = useState('excel');
  const [dateFiltreEpisodes, setDateFiltreEpisodes] = useState("");
  const gererSoumissionExport = (e) => {
    e.preventDefault();

    if (exportFormat === 'excel') {
      exporterVersExcel(e);
    } else if (exportFormat === 'word') {
      exporterVersWord(e);
    } else if (exportFormat === 'pdf') {
      exporterVersPDF(e);
    }
  };



  // --- NOUVEAUX ÉTATS POUR L'ÉDITION DES ANNONCES EXISTANTES ---
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [editPlanForm, setEditPlanForm] = useState({ timestart: "", duree: 30 });

  // --- FONCTIONS DE GESTION (MODIFICATION & SUPPRESSION) ---
  const gererSuppressionPlanification = async (idPlan) => {
    if (window.confirm("Êtes-vous sûr de vouloir retirer cette annonce de l'épisode ?")) {
      try {
        // TODO: Ajoutez votre appel API ici (ex: await supprimerPlanificationMedia(idPlan); )

        // Mise à jour de l'interface immédiatement
        setPlanificationsMedia(prev => prev.filter(p => p.id !== idPlan));
        toast.success("Annonce supprimée avec succès !");
      } catch (error) {
        toast.error("Erreur lors de la suppression.");
      }
    }
  };

  const gererModificationPlanification = async (idPlan) => {
    try {
      // Recalcule l'heure de fin en fonction de la nouvelle durée
      const timeend = ajouterSecondesHeure(editPlanForm.timestart, editPlanForm.duree);

      // TODO: Ajoutez votre appel API ici (ex: await modifierPlanificationMedia(idPlan, { timestart: editPlanForm.timestart, timeend }); )

      // Mise à jour de l'interface
      setPlanificationsMedia(prev => prev.map(p =>
        p.id === idPlan ? { ...p, timestart: editPlanForm.timestart, timeend: timeend } : p
      ));
      setEditingPlanId(null);
      toast.success("Horaires mis à jour !");
    } catch (error) {
      toast.error("Erreur lors de la modification.");
    }
  };

  async function send_pad_demande(id) {

    const demande = {
      chaine_id: chaineActive.id,
      demandeur: Utilisateur.nom_affiche,
      statut: "EN_ATTENTE",
      relances: 0,
      spot_bibliotheque_id: id
    }
    try {
      const result = await creerDemandePad(demande);
      toast.success("Demande PAD envoyée ")

    } catch (error) {

      toast.error("Erreur création demande");
    }


  }


  return (
    <div className="space-y-6">
      {isLoading && <div className="modern-overlay">
        <div className="modern-loader-card">
          <div className="modern-spinner"></div>
          <div className="modern-loader-text">Chargement...</div>
        </div>
      </div>}
      {/* MODAL D'EXPORTATION EXCEL */}
      {modalExportOuvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">

            {/* Header Modal */}
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className=" text-slate-800 text-lg">Exporter le conducteur</h3>
              <button onClick={() => setModalExportOuvert(false)} className="text-slate-500 hover:text-slate-600 transition-colors p-1">
                <X size={20} />
              </button>
            </div>

            {/* Formulaire */}
            <form onSubmit={gererSoumissionExport} className="p-5 flex flex-col gap-5">

              {/* Titre du document */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Titre du document Excel</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: PM VENDREDI 04 SEPT 2026"
                  className="w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  value={exportTitre}
                  onChange={(e) => setExportTitre(e.target.value)}
                />
              </div>



              {/* Sélection de la Date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date de programmation</label>
                <input
                  type="date"
                  required
                  className="w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  value={exportDate}
                  onChange={(e) => setExportDate(e.target.value)}
                />
              </div>

              {/* Actions */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Format d'exportation</label>
                <select
                  required
                  className="w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                >
                  <option value="excel">Excel (.xlsx)</option>
                  <option value="word">Word (.docx)</option>
                  <option value="pdf">PDF (.pdf)</option>
                </select>
              </div>

              {/* Actions */}
              <div className="mt-2 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setModalExportOuvert(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  Générer le fichier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barre d'outils globale (Top) avec les 3 boutons de navigation */}
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <header className="mb-2 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
          <h1 className="text-lg font-semibold text-slate-800" style={{ color: "#00607a" }}>Plan Média — {chaineActive?.nom || 'Workspace'}</h1>
        </header>
        <div className="flex flex-wrap items-end justify-between gap-4">
          {/* Navigation 3 boutons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setVuePrincipale('PLAN_MEDIA')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${vuePrincipale === 'PLAN_MEDIA'
                ? 'bg-snrt-navy text-white'
                : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                }`}
            >
              Gestion Plan Média
            </button>
            <button
              type="button"
              onClick={() => setVuePrincipale('PIGE_VALIDATION')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${vuePrincipale === 'PIGE_VALIDATION'
                ? 'bg-snrt-navy text-white'
                : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                }`}
            >
              Validation Pige
            </button>
            <button
              type="button"
              onClick={() => setVuePrincipale('PLAN_MEDIA_ADMIN')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${vuePrincipale === 'PLAN_MEDIA_ADMIN'
                ? 'bg-snrt-navy text-white'
                : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                }`}
            >
              Administration Plan Média
            </button>

            {vuePrincipale === 'PLAN_MEDIA' && <div>
              <select
                className="w-full rounded-md border border-slate-300 py-1.5 px-3 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                value={filtreGrilleId}
                onChange={(e) => setFiltreGrilleId(e.target.value)}
              >
                <option value="">-- Toutes les grilles --</option>
                {grilles.map(grille => {
                  // Formatage propre de la date si elle existe (ex: JJ/MM/AAAA ou format lisible)
                  const dateFormatee = grille.cree_le
                    ? new Date(grille.cree_le).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : '';

                  // Libellé intelligent : Nom -> Date formatée -> ID par défaut
                  const libelle = grille.nom + "🕒" + dateFormatee || grille.titre || (dateFormatee ? `Grille du ${dateFormatee}` : `Grille #${grille.id.substring(0, 5)}`);

                  return (
                    <option key={grille.id} value={grille.id}>
                      {libelle}
                    </option>
                  );
                })}
              </select>
            </div>}

            <button
              onClick={() => { setModalExportOuvert(true) }}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-1.5 px-3 rounded shadow-sm transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Exporter
            </button>


            {vuePrincipale !== 'PIGE_VALIDATION' && <button type="button" className="flex items-center gap-1.5 rounded-md bg-snrt-navy px-3 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover transition-colors" style={{ color: "orange", cursor: "pointer" }} title='refrech classifications'

              onClick={async () => {
                if (!filtreGrilleId && vuePrincipale !== "PLAN_MEDIA_ADMIN") {
                  toast.error("Veuillez sélectionner une grille d'abord.");
                  return;
                }

                try {
                  await update_clasification();

                  toast.success("Classifications actualisées !");
                } catch (error) {
                  toast.error(error);
                  toast.error("Erreur lors de l'actualisation.");
                }
              }}
            >
              <MdCloudSync size={20} />

            </button>}
          </div>
        </div>
      </div>

      {/* Affichage conditionnel selon la vue principale choisie */}
      <div className={((vuePrincipale === 'PLAN_MEDIA') && (page == "promos")) ? 'block' : 'hidden'}>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'stretch', height: 'calc(100vh - 300px)' }}>

          {/* 1. Colonne Gauche : Timeline */}
          <aside
            className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col relative z-30"
            style={{ flex: '0 0 250px', overflowY: 'auto', overflowX: 'hidden' }}
          >
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700 shrink-0">
              <Clock size={16} className="text-snrt-navy" />
              <span>Déroulé du jour</span>
            </div>

            {/* Filtres multi-sélection */}
            <div className="mb-3 flex flex-wrap gap-1.5 shrink-0">
              {['annonce', 'episode'].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleFiltreTimeline(f)}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium capitalize transition-colors ${filtresTimeline.includes(f)
                    ? 'bg-snrt-navy text-white'
                    : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                >
                  {f}
                </button>
              ))}
            </div>
            {/* Filtre par date */}
            <div className="mb-3 shrink-0">
              <input
                type="date"
                value={dateFiltreTimeline}
                onChange={(e) => setDateFiltreTimeline(e.target.value)}
                className="w-full rounded-md border border-slate-200 py-1.5 px-3 text-xs text-slate-700 transition-colors focus:border-snrt-accent focus:outline-none focus:ring-1 focus:ring-snrt-accent"
              />
            </div>
            {/* Barre de recherche */}
            <div className="relative mb-6 shrink-0">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={rechercheTimeline}
                onChange={(e) => setRechercheTimeline(e.target.value)}
                placeholder="Rechercher..."
                className="w-full rounded-md border border-slate-200 py-1.5 pl-8 pr-3 text-xs text-slate-700 transition-colors focus:border-snrt-accent focus:outline-none focus:ring-1 focus:ring-snrt-accent"
              />
            </div>

            {/* Composant Timeline */}
            <VerticalTimeline events={genererEvenementsTimeline()} />
          </aside>

          {/* 2. Colonne Milieu : Formulaire */}{/* 2. Colonne Milieu : Liste des épisodes (Pleine largeur) */}
          <main
            className="rounded-lg border border-slate-200 bg-white flex flex-col w-full overflow-hidden"
            style={{ flex: '1 1 auto' }}
          >
            <div className="flex flex-col flex-1 overflow-hidden w-full">

              {/* En-tête : fixe en haut (Padding appliqué uniquement ici) */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-300 p-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-800">Planifier les annonces</h2>
                  <p className="pm-form-subtitle mt-1 text-sm text-slate-500">Recherchez et sélectionnez un épisode pour y attacher des annonces.</p>
                </div>





                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px" }} >


                  <button
                    onClick={() => setPage('promos')} // <-- Corrigé (sans 's')
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${page === 'promos'
                      ? 'bg-[#243c54] text-white border-[#243c54] shadow-sm'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    style={{ cursor: "pointer" }}
                  >
                    Annonces / Promos
                  </button>
                  <button
                    onClick={() => setPage('auto-promos')} // <-- Corrigé (sans 's')
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${page === 'auto-promos'
                      ? 'bg-[#243c54] text-white border-[#243c54] shadow-sm'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    style={{ cursor: "pointer" }}
                  >
                    Auto annonces
                  </button>


                </div>




              </div>
              {/* Conteneur de recherche et liste (Pleine largeur, touche les bords) */}
              <div className="flex flex-col flex-1 overflow-hidden w-full">

                {/* Barre de recherche */}
                <div className="p-3 border-b border-slate-200 bg-slate-50/80 shrink-0">
                  <div className="relative" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px" }}>
                    <Search size={16} className="absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Rechercher par titre, numéro ou programme..."
                      className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-shadow"
                      value={rechercheEpisodeForm}
                      onChange={(e) => setRechercheEpisodeForm(e.target.value)}
                    />
                    <input
                      type="date"

                      style={{ maxWidth: "200px", height: "40px", fontSize: "14px" }}
                      value={dateFiltreTimeline}
                      onChange={(e) => setDateFiltreTimeline(e.target.value)}
                      className="w-full rounded-md border border-slate-200 py-1.5 px-3 text-xs text-slate-700 transition-colors focus:border-snrt-accent focus:outline-none focus:ring-1 focus:ring-snrt-accent "
                    />
                  </div>
                </div>

                {/* Liste défilante des épisodes */}
                <div className="flex-1 overflow-y-auto pm-slim-scroll bg-slate-50/30 w-full">
                  {diffusions
                    // 1. On part de "diffusions" et on y attache l'épisode et le programme
                    .map(diffusion => {
                      const ep = episodes.find(e => e.id === diffusion.episode_id);
                      const prog = ep ? programmes.find(p => p.id === ep.programme_id) : null;

                      return {

                        ...ep, // Inclut toutes les propriétés de l'épisode s'il est trouvé
                        episode_id_reel: ep?.id, // Sécurité pour vérifier si l'épisode existe
                        diffusion_id: diffusion.id, // Identifiant unique de la diffusion
                        programme: prog,
                        grille_id: diffusion.grille_id,
                        date_diffusion: diffusion.date || '',
                        heure_debut: diffusion.heure_debut || '00:00'
                      };
                    })
                    // 2. INNER JOIN : On exclut toutes les diffusions dont l'épisode n'existe pas dans le state
                    .filter(item => item.episode_id_reel)
                    .filter(item => !filtreGrilleId || item.grille_id === filtreGrilleId)
                    .filter(item => !dateFiltreTimeline || item.date_diffusion === dateFiltreTimeline)

                    // 3. Filtrage par recherche utilisateur
                    .filter(item => {
                      const titreProg = item.programme?.titre || '';
                      const titreEp = item.titre || item.nom || `Épisode ${item.numero || ''}`;
                      const recherche = rechercheEpisodeForm.toLowerCase();
                      return titreEp.toLowerCase().includes(recherche) || titreProg.toLowerCase().includes(recherche);
                    })


                    // 4. Tri chronologique strict
                    .sort((a, b) => {
                      if (a.date_diffusion !== b.date_diffusion) {
                        return a.date_diffusion.localeCompare(b.date_diffusion);
                      }
                      return a.heure_debut.localeCompare(b.heure_debut);
                    })
                    // 5. Rendu de la liste
                    .map(item => {
                      // On utilise item.episode_id_reel car "item" est maintenant un mix diffusion/épisode
                      return (
                        <div
                          key={`diff-${item.diffusion_id}-ep-${item.episode_id_reel}`}
                          onClick={() => handleEpisodeSelection(item.episode_id_reel, item.diffusion_id)}
                          className={`border-b border-slate-100 cursor-pointer px-5 py-3 transition-colors border-l-4 flex items-center justify-between group
    ${selectedEpisodeId === item.diffusion_id
                              ? 'bg-amber-30 border-l-amber-500'
                              : 'bg-white border-l-transparent hover:bg-amber-10 hover:border-l-amber-500'
                            }
`}                        >
                          <div className="pr-4">
                            <div
                              className={`text-sm font-semibold transition-colors line-clamp-1 ${selectedEpisodeId === item.diffusion_id
                                ? 'text-amber-700'
                                : 'text-slate-700 group-hover:text-amber-700'
                                }`}                             >
                              {item.titre || item.nom || `Épisode ${item.numero || 'N/C'}`}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                              {item.programme ? (item.programme.titre || item.programme.nom) : 'Programme Inconnu'}
                            </div>
                          </div>

                          {/* Bloc Date et Heure direct depuis la diffusion */}
                          <div className="flex flex-col items-end shrink-0 gap-1">
                            {item.date_diffusion && (
                              <div className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                                {item.date_diffusion}
                              </div>
                            )}
                            <div className="text-xs font-mono font-medium text-slate-500 bg-slate-100/80 px-2 py-0.5 rounded border border-slate-200">
                              {item.heure_debut}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  {/* Message si aucun résultat */}
                  {diffusions.length > 0 && diffusions
                    .map(diffusion => ({
                      ...episodes.find(e => e.id === diffusion.episode_id),
                      programme: programmes.find(p => p.id === episodes.find(e => e.id === diffusion.episode_id)?.programme_id)
                    }))
                    .filter(item => item.id) // Inner join check
                    .filter(item => {
                      const titreProg = item.programme?.titre || '';
                      const titreEp = item.titre || item.nom || `Épisode ${item.numero || ''}`;
                      return titreEp.toLowerCase().includes(rechercheEpisodeForm.toLowerCase()) || titreProg.toLowerCase().includes(rechercheEpisodeForm.toLowerCase());
                    }).length === 0 && (
                      <div className="p-8 text-center text-sm text-slate-500 italic">
                        Aucun épisode programmé ne correspond à votre recherche.
                      </div>
                    )}

                  {/* Message si aucun résultat */}
                  {episodes.length > 0 && episodes.filter(ep => {
                    const titreProg = programmes.find(p => p.id === ep.programme_id)?.titre || '';
                    const titreEp = ep.titre || ep.nom || `Épisode ${ep.numero || ''}`;
                    return titreEp.toLowerCase().includes(rechercheEpisodeForm.toLowerCase()) || titreProg.toLowerCase().includes(rechercheEpisodeForm.toLowerCase());
                  }).length === 0 && (
                      <div className="p-8 text-center text-sm text-slate-500 italic">
                        Aucun épisode ne correspond à votre recherche.
                      </div>
                    )}
                </div>
              </div>

            </div>
          </main>









          {/* ----------------- MODALE D'INSERTION DES ANNONCES ----------------- */}
          {isModalOuvert && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm  gap-5" style={{ flexWrap: "wrap", overflow: "auto" }}>



              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", gap: "10px", minWidth: "800px" }}>

                <div
                  className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                  onClick={(e) => e.stopPropagation()} // Empêche le clic à l'intérieur de fermer la modale
                >
                  {/* En-tête de la modale */}
                  <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50 shrink-0">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-800">
                        Insertion d'annonces
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Épisode sélectionné : <span className="font-medium" style={{ color: "orange" }}>
                          {episodes.find(ep => ep.id === formEpisodeId)?.titre || `Épisode ${episodes.find(ep => ep.id === formEpisodeId)?.numero || 'N/C'}`}
                        </span>
                      </p>
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide" style={{backgroundColor:"transparent"}}>Conducteur :</label>
                        <select
                          className="rounded border border-slate-300 py-0.5 px-2 text-xs bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                          value={selectedConducteurId}
                          onChange={(e) => setSelectedConducteurId(e.target.value)}
                        >
                          <option value="">-- Aucun conducteur lié --</option>
                          {conducteurpub.map(c => (
                            <option key={c.id} value={c.id}>
                              CPB du {c.date ? new Date(c.date).toLocaleDateString('fr-FR') : 'N/C'}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* NOUVEAU : Indicateur dynamique des spots requis par le Conducteur */}
                      {(() => {
                        if (!selectedConducteurId || !formEpisodeId) return null;

                        const cpb = conducteurpub.find(c => c.id === selectedConducteurId);
                        const currentDiff = diffusions.find(d => d.episode_id === formEpisodeId);

                        if (!cpb || !cpb.donnees || !currentDiff) return null;

                        // On utilise la même logique infaillible que l'IA pour trouver le bon écran
                        const minutesDiff = timeToMinutes(currentDiff.heure_debut);
                        let ecranAssocie = null;
                        let minDiff = Infinity;

                        cpb.donnees.forEach(ecran => {
                          const minEcran = timeToMinutes(ecran.heure_prev);
                          if (minutesDiff <= minEcran) {
                            const difference = minEcran - minutesDiff;
                            if (difference < minDiff) {
                              minDiff = difference;
                              ecranAssocie = ecran;
                            }
                          }
                        });

                        if (!ecranAssocie) return null;

                        // On compare ce qui est requis avec ce que l'utilisateur a déjà ajouté dans le formulaire
                        const spotsRequis = ecranAssocie.nb_spots;
                        const spotsAjoutes = formAnnonces.length;
                        const isComplet = spotsAjoutes === spotsRequis;

                        return (
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded w-fit border
                                ${isComplet ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}
                              `}>
                              ⏱️ Conducteur ({ecranAssocie.heure_prev}) : {spotsRequis} spots requis
                            </span>

                            <span className={`text-[10px] font-bold ${isComplet ? 'text-emerald-600' : 'text-slate-500'}`}>
                              ({spotsAjoutes} / {spotsRequis} insérés)
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                    <button
                      onClick={fermerModal}
                      className="text-slate-500 hover:text-slate-600 bg-white hover:bg-slate-100 p-1.5 rounded-full transition-colors border border-slate-200"
                    >


                      <X size={18} />
                    </button>
                  </div>

                  {/* Corps de la modale avec défilement */}
                  <form onSubmit={gererSoumissionFormulaire} className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-5 pm-slim-scroll bg-slate-50/30">
                      <div className="flex items-center justify-between mb-4" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                        </div>
                        <>{getclassifications()}</>
                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>

                          <button
                            type="button"
                            onClick={ajouterAnnonceAuFormulaire}
                            className="flex items-center gap-1 text-xs font-medium text-white bg-snrt-navy hover:bg-snrt-navy-hover px-3 py-1.5 rounded transition-colors shadow-sm"
                          >
                            <Plus size={14} /> Ajouter une annonce
                          </button>
                        </div>

                      </div>

                      <div className="flex flex-col gap-1" style={{ maxHeight: "200px", overflow: "auto" }}>
                        {formAnnonces.map((annonceItem) => (
                          <div key={annonceItem.idUnique} className="flex flex-wrap items-end gap-1 p-1.5 bg-white   rounded-md " style={{ fontSize: "11px" }}>

                            <div className="flex-1 min-w-[250px] pm-form-group mb-0">
                              <label className="pm-label text-xs" style={{ fontSize: "12px", color: "", fontWeight: "none" }}>Annonce depuis le stock</label>
                              <select
                                className="pm-select py-1 text-sm"
                                style={{ height: "35px", fontSize: "12px" }}

                                value={annonceItem.annonceId}
                                onChange={(e) => handleAnnonceChange(annonceItem.idUnique, 'annonceId', e.target.value)}
                                required
                              >
                                <option value="">-- Sélectionner une annonce --</option>
                                {stockAnnonces
                                  .filter(stock => {
                                    // 1. Récupérer la date de diffusion de l'épisode au lieu de la date du jour
                                    const diffusionActuelle = diffusions.find(d => d.episode_id === formEpisodeId);

                                    // Si on a la date de la grille/diffusion, on l'utilise. Sinon, on prend aujourd'hui.
                                    const dateReference = diffusionActuelle?.date_diffusion || diffusionActuelle?.date
                                      ? new Date(diffusionActuelle.date_diffusion || diffusionActuelle.date)
                                      : new Date();

                                    dateReference.setHours(0, 0, 0, 0); // On remet à minuit

                                    // 2. Préparer la date de début
                                    let dateDebut = null;
                                    if (stock.validite_debut) {
                                      dateDebut = new Date(stock.validite_debut);
                                      dateDebut.setHours(0, 0, 0, 0);
                                    }
                                    // 3. Préparer la date de fin
                                    let dateFin = null;
                                    if (stock.validite_fin) {
                                      dateFin = new Date(stock.validite_fin);
                                      dateFin.setHours(0, 0, 0, 0);
                                    }

                                    // Comparaison avec la date de l'épisode (dateReference)
                                    if (dateDebut && dateDebut > dateReference) return false;
                                    if (dateFin && dateFin < dateReference) return false;
                                    if (!stock.PAD) return false;
                                    return true;
                                  }).sort((a, b) => {


                                    const diffusionActuelle = (diffusions || []).find(
                                      d => d && d.episode_id === formEpisodeId
                                    );
                                    const classificationTrouvee = diffusionActuelle && ProgrammeClassification
                                      ? ProgrammeClassification.find(c => c && c.programme_id === diffusionActuelle.programme_id)
                                      : null;

                                    // On crée un objet de référence 100% sûr, avec 0 par défaut si introuvable
                                    const classificationIA = {
                                      enfant_point: classificationTrouvee?.enfant_point ?? 0,
                                      adult_point: classificationTrouvee?.adult_point ?? 0,
                                      senior_point: classificationTrouvee?.senior_point ?? 0
                                    };

                                    const a_E = a.enfantpercentage ?? 0;
                                    const a_J = a.jeunepercentage ?? 0;
                                    const a_G = a.grand_percentage ?? a.grandPercentage ?? 0;

                                    // Extraire les stats de l'annonce B
                                    const b_E = b.enfantpercentage ?? 0;
                                    const b_J = b.jeunepercentage ?? 0;
                                    const b_G = b.grand_percentage ?? b.grandPercentage ?? 0;

                                    // Calcul de la différence absolue (plus c'est bas, plus c'est proche)
                                    const diffA = Math.abs(classificationIA.enfant_point - a_E) + Math.abs(classificationIA.adult_point - a_J) + Math.abs(classificationIA.senior_point - a_G);
                                    const diffB = Math.abs(classificationIA.enfant_point - b_E) + Math.abs(classificationIA.adult_point - b_J) + Math.abs(classificationIA.senior_point - b_G);

                                    return diffA - diffB;

                                  })
                                  .map(stock => (
                                    // ... votre code option habituel.map(stock => (
                                    <option key={stock.id} value={stock.id} style={{ backgroundColor: stock.pad ? "red" : "" }}>
                                      {stock.nom || stock.title} · {stock.duration || 30}s · E{stock.enfantpercentage}% · J{stock.jeunepercentage}% · G{stock.grand_percentage}% · PAD{JSON.stringify(stock.pad)}
                                    </option>
                                  ))}
                              </select>
                            </div>

                            <div className="w-36 pm-form-group mb-0 shrink-0">
                              <label className="pm-label text-xs" style={{ fontSize: "12px", color: "", fontWeight: "none" }}>Type de départ</label>
                              <select
                                className="pm-select py-1 text-sm"
                                style={{ height: "35px", fontSize: "12px" }}
                                value={annonceItem.mode}
                                onChange={(e) => handleAnnonceChange(annonceItem.idUnique, 'mode', e.target.value)}
                              >
                                <option value="offset">Décalage (secondes)</option>
                                <option value="exact">Heure fixe</option>
                              </select>
                            </div>

                            <div className="w-32 pm-form-group mb-0 shrink-0">
                              <label className="pm-label text-xs" style={{ fontSize: "12px", color: "", fontWeight: "none" }}>
                                {annonceItem.mode === 'offset' ? 'Secondes après' : 'Heure exacte'}
                              </label>
                              {annonceItem.mode === 'offset' ? (
                                <input
                                  type="number"
                                  min="0"
                                  className="pm-input py-1.5 text-sm"
                                  value={annonceItem.offsetSeconds}
                                  style={{ height: "35px", fontSize: "12px" }}
                                  onChange={(e) => handleAnnonceChange(annonceItem.idUnique, 'offsetSeconds', e.target.value)}
                                  required
                                />
                              ) : (
                                <input
                                  type="time"
                                  step="1"
                                  className="pm-input py-1.5 text-sm"
                                  style={{ height: "35px", fontSize: "12px" }}
                                  value={annonceItem.timeExact}
                                  onChange={(e) => handleAnnonceChange(annonceItem.idUnique, 'timeExact', e.target.value)}
                                  required
                                />
                              )}
                            </div>

                            {formAnnonces.length > 1 && (
                              <button
                                type="button"
                                onClick={() => supprimerAnnonceDuFormulaire(annonceItem.idUnique)}
                                className="p-2 mb-[2px] text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 rounded transition-colors"
                                title="Retirer cette annonce"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                    </div>














                    {/* Pied de la modale (Boutons d'action) */}
                    <div className="p-4 border-t border-slate-100 bg-white shrink-0 flex justify-end gap-3">
                      <button
                        type="button"
                        className="pm-btn pm-btn-secondary"
                        onClick={fermerModal}
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        className="pm-btn pm-btn-primary"
                        disabled={!formEpisodeId || formAnnonces.some(a => !a.annonceId)}
                      >
                        Enregistrer les planifications
                      </button>
                    </div>
                  </form>
                </div>


                <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                  onClick={(e) => e.stopPropagation()} // Empêche le clic à l'intérieur de fermer la modale
                >



                  {planificationsMedia.filter(p => p.episode_id === formEpisodeId).length > 0 && (
                    <div
                      className="border-t border-slate-200 p-5"
                      style={{ maxHeight: "400px", overflow: "auto" }}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                          <span className="flex items-center justify-center w-6 h-6 rounded-md bg-amber-50 text-amber-600">
                            <Megaphone size={13} />
                          </span>

                          <span>
                            Annonces déjà planifiées
                            <span className="ml-1.5 text-[10px] font-medium text-slate-500">
                              ({planificationsMedia.filter(p => p.episode_id === formEpisodeId).length})
                            </span>
                          </span>
                        </h3>
                      </div>

                      <div className="flex flex-col gap-1">
                        {planificationsMedia.filter(p => p.episode_id === formEpisodeId).map(plan => {
                          const stockAnnonce = stockAnnonces.find(s => s.id === plan.annonce_id);
                          const isEditing = editingPlanId === plan.id;

                          return (
                            <div
                              key={plan.id}
                              className={`group rounded-md border transition-all duration-150 ${isEditing
                                ? "border-amber-300 bg-amber-50/40"
                                : "border-slate-200 bg-white hover:border-amber-200 hover:bg-slate-50/70"
                                }`}
                            >

                              {!isEditing ? (
                                <div className="flex items-center min-h-[30px] px-3 py-1" style={{ cursor: "pointer" }}>

                                  {/* Time */}
                                  <div className="w-[58px] shrink-0 text-center">
                                    <div className="text-xs font-semibold font-mono text-slate-700">
                                      {plan.timestart}
                                    </div>

                                    <div className="text-[9px] font-mono text-slate-500 mt-0.5">
                                      → {plan.timeend}
                                    </div>
                                  </div>

                                  <div className="w-px h-7 bg-slate-200 mx-3" />

                                  {/* Content */}
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium text-slate-700 truncate">
                                      {stockAnnonce?.nom || stockAnnonce?.title || "Annonce Inconnue"}
                                    </div>

                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                      {stockAnnonce?.duration || 30}s
                                    </div>
                                  </div>

                                  {/* Actions */}
                                  <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingPlanId(plan.id);
                                        setEditPlanForm({
                                          timestart: plan.timestart,
                                          duree: stockAnnonce?.duration || 30
                                        });
                                      }}
                                      className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                      title="Modifier l'heure"
                                      style={{ cursor: "pointer" }}
                                    >
                                      <Edit3 size={14} />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => gererSuppressionPlanification(plan.id)}
                                      className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-red-500 hover:bg-red-50 transition-colors"
                                      title="Retirer l'annonce"
                                      style={{ cursor: "pointer" }}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex w-full items-end gap-2 p-2.5">
                                  <div className="flex-1">
                                    <label className="text-[9px] text-slate-500 uppercase tracking-wide font-semibold mb-1 block">
                                      Heure de début
                                    </label>

                                    <input
                                      type="time"
                                      step="1"
                                      value={editPlanForm.timestart}
                                      onChange={e => setEditPlanForm({
                                        ...editPlanForm,
                                        timestart: e.target.value
                                      })}
                                      className="w-full h-8 border border-slate-200 bg-white rounded-md px-2 text-xs outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 font-mono"
                                    />
                                  </div>

                                  <div className="flex gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setEditingPlanId(null)}
                                      className="h-8 px-2.5 text-[10px] font-medium text-slate-500 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
                                      style={{ cursor: "pointer" }}
                                    >
                                      Annuler
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => gererModificationPlanification(plan.id)}
                                      className="h-8 px-3 text-[10px] font-medium text-white bg-amber-500 rounded-md hover:bg-amber-600 transition-colors shadow-sm"
                                      style={{ cursor: "pointer" }}
                                    >
                                      Sauver
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              </div>








              {/* 3. Colonne Droite : Liste connectée au stock global d'administration */}
              <aside
                className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col"
                style={{ flex: '0 0 600px', overflowY: 'auto', height: "750px" }}
              >
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700 shrink-0">
                  <ListIcon size={16} className="text-snrt-navy" />
                  <span>Éléments disponibles ({listeFiltree.length})</span>
                </div>

                {/* 4 Boutons de filtres (enfant, jeune, grand, budget) */}
                <div className="mb-3 grid grid-cols-2 gap-1.5 shrink-0">
                  {['enfant', 'jeune', 'grand', 'budget'].map((btn) => (
                    <button
                      key={btn}
                      type="button"
                      onClick={() => setFiltreOrdre(btn)}
                      className={`rounded-md px-2 py-1 text-[11px] font-medium capitalize transition-colors ${filtreOrdre === btn
                        ? 'bg-snrt-navy text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                      {btn}
                    </button>
                  ))}
                </div>

                {/* Barre de recherche de la liste */}
                <div className="relative mb-4 shrink-0">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={rechercheListe}
                    onChange={(e) => setRechercheListe(e.target.value)}
                    placeholder="Rechercher dans la liste..."
                    className="w-full rounded-md border border-slate-200 py-1.5 pl-8 pr-3 text-xs text-slate-700 transition-colors focus:border-snrt-accent focus:outline-none focus:ring-1 focus:ring-snrt-accent"
                  />
                </div>

                {/* Contenu de la liste dynamique */}
                <div className="space-y-0.5 overflow-y-auto flex-1">
                  {listeFiltree.length === 0 ? (
                    <p className="text-xs text-slate-500 italic text-center py-6">Aucun élément trouvé.</p>
                  ) : (
                    listeFiltree.map((item) => (
                      <div
                        key={item.id}
                        className="
        group
        flex flex-col
        min-h-[40px]
        rounded-md
        border border-slate-200
        bg-white
        px-2 py-1
        transition-all duration-150
        hover:border-snrt-accent/30
        hover:bg-slate-50/50
        hover:shadow-sm
    "
                      >
                        {/* Main row */}
                        <div
                          className="flex items-center gap-1 w-full"
                          style={{
                            justifyContent: "space-between",
                            gap: "5px"
                          }}
                        >
                          {/* Type */}
                          <div className="w-[85px] shrink-0">
                            <span
                              className="
                    inline-flex items-center
                    rounded
                    bg-snrt-navy/5
                    px-1.5 py-0.5
                    text-[9px] font-semibold uppercase
                    tracking-wide
                    text-snrt-navy
                "
                              style={{ backgroundColor: "orange" }}
                            >
                              {item.type}
                            </span>

                            {item.PAD && (
                              <span
                                className="
                        inline-flex items-center
                        rounded
                        px-1.5 py-0.5 ml-1
                        text-[9px] font-semibold uppercase
                        tracking-wide
                        text-green-600 bg-green-100
                    "
                                title="Prêt à diffuser"
                              >
                                PAD
                              </span>
                            )}

                            {!item.PAD && (
                              <span
                                className="
                        inline-flex items-center
                        rounded
                        px-1.5 py-0.5 ml-1
                        text-[9px] font-semibold uppercase
                        tracking-wide
                        text-red-600 bg-red-100
                    "
                                title="PAD non disponible"
                              >
                                NO PAD
                              </span>
                            )}

                            {item.client && (
                              <div
                                className="
                        mt-0.5
                        max-w-[80px]
                        truncate
                        text-[9px]
                        text-slate-500
                    "
                                title={item.client}
                              >
                                {item.client}
                              </div>
                            )}
                          </div>

                          {/* Main information */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4
                                className="
                        min-w-0 truncate
                        text-[12px]
                        text-slate-700
                        group-hover:text-slate-900
                    "
                                title={item.nom || item.title}
                              >
                                {item.nom || item.title}
                              </h4>

                              <span
                                className="
                        shrink-0
                        rounded bg-slate-100
                        px-1.5 py-0.5
                        text-[9px] font-medium
                        text-slate-500
                    "
                              >
                                ⌚ {item.duration ?? 30}s
                              </span>
                            </div>

                            {item.metadonne && (
                              <p
                                className="
                        mt-0.5
                        truncate
                        text-[9px]
                        text-slate-500
                    "
                                title={item.metadonne}
                              >
                                {item.metadonne}
                              </p>
                            )}
                          </div>

                          {/* Budget */}
                          <div className="hidden w-[45px] shrink-0 md:block">
                            <div className="text-[8px] uppercase tracking-wide text-slate-500">
                              Budget
                            </div>

                            <div className="text-[11px] text-slate-600">
                              {item.budget ?? 0} DH
                            </div>
                          </div>

                          {/* Audience */}
                          <div className="hidden w-[100px] shrink-0 lg:flex items-center gap-1">
                            <span
                              className="
                    rounded bg-blue-50
                    px-1.5 py-1
                    text-[9px] font-medium
                    text-blue-600
                "
                              title="Enfant"
                            >
                              E {item.enfantpercentage ?? item.pourcentages?.enfant ?? 0}%
                            </span>

                            <span
                              className="
                    rounded bg-violet-50
                    px-1.5 py-1
                    text-[9px] font-medium
                    text-violet-600
                "
                              title="Jeune"
                            >
                              J {item.jeunepercentage ?? item.pourcentages?.jeune ?? 0}%
                            </span>

                            <span
                              className="
                    rounded bg-orange-50
                    px-1.5 py-1
                    text-[9px] font-medium
                    text-orange-600
                "
                              title="Grand"
                            >
                              G {
                                item.grand_percentage ??
                                item.grandPercentage ??
                                item.pourcentages?.grand ??
                                0
                              }%
                            </span>
                          </div>
                        </div>

                        {/* PAD request - full width underneath */}
                        {!item.PAD && (
                          <div className="w-full mt-1">
                            <button
                              type="button"
                              className="
                    w-full
                    rounded-md
                    border border-amber-200
                    bg-amber-50
                    px-2 py-1
                    text-[10px]
                    font-medium
                    text-amber-700
                    transition-all duration-150
                    hover:bg-amber-100
                    hover:border-amber-300
                    hover:text-amber-800
                "
                              style={{ cursor: "pointer" }}
                              onClick={() => { send_pad_demande(item.id) }}
                            >
                              Demander PAD
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}



                </div>
              </aside>






            </div>
          )}
        </div>
      </div>


      <div className={((vuePrincipale === 'PLAN_MEDIA') && (page == "auto-promos")) ? 'block' : 'hidden'}>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'stretch', height: 'calc(100vh - 300px)' }}>

          {/* COLONNE GAUCHE */}
          <main
            className={`rounded-lg border border-slate-200 bg-white flex flex-col overflow-hidden transition-all duration-300 ${(planningEdite.length > 0 || isGenerating) ? 'w-1/3' : 'w-full'}`}
            style={{ flex: (planningEdite.length > 0 || isGenerating) ? '0 0 auto' : '1 1 auto' }}
          >
            <div className="flex flex-col flex-1 overflow-hidden w-full">

              {/* En-tête : fixe en haut */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-300 p-4 shrink-0">
                <div>
                  <h2 className="text-base font-semibold text-slate-800">Planifier les annonces</h2>
                  <p className="pm-form-subtitle mt-1 text-sm text-slate-500">Recherchez et sélectionnez un épisode pour y attacher des annonces.</p>
                </div>

                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px" }}>
                  <button
                    onClick={() => setPage('promos')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${page === 'promos' ? 'bg-[#243c54] text-white border-[#243c54] shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                  >
                    Annonces / Promos
                  </button>
                  <button
                    onClick={() => setPage('auto-promos')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${page === 'auto-promos' ? 'bg-[#243c54] text-white border-[#243c54] shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                  >
                    Auto annonces
                  </button>
                </div>
              </div>

              {/* ZONE DE CONTRÔLE IA : Sélection de la Date et Génération */}
              {/* ZONE DE CONTRÔLE IA : Sélection du Conducteur et Génération */}
              <div className="p-4 border-b border-emerald-100 bg-emerald-50/50 shrink-0">
                <label className="block text-xs font-bold text-[#243c54] mb-2 uppercase tracking-wide">
                  Configuration de l'IA (Auto-Génération)
                </label>
                <div className="flex flex-wrap items-center gap-3">

                  {/* Le menu déroulant pour choisir le conducteur */}
                  <select
                    className="rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white min-w-[250px]"
                    value={selectedConducteurId}
                    onChange={(e) => setSelectedConducteurId(e.target.value)}
                  >
                    <option value="">-- Sélectionner un conducteur --</option>
                    {conducteurpub.map(c => (
                      <option key={c.id} value={c.id}>
                        Conducteur du {c.date ? new Date(c.date).toLocaleDateString('fr-FR') : 'N/C'}
                      </option>
                    ))}
                  </select>

                  {/* Badge visuel affichant la date auto-déduite */}
                  {selectedConducteurId && (
                    <div className="text-xs font-medium text-emerald-800 bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-md flex items-center gap-1.5">
                      <span>📅</span> Date cible : <strong>{conducteurpub.find(c => c.id === selectedConducteurId)?.date}</strong>
                    </div>
                  )}

                  {/* Le bouton d'action */}
                  <button
                    onClick={handleGenererAuto}
                    disabled={isGenerating || !selectedConducteurId}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-md text-sm font-bold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ml-auto"
                  >
                    {isGenerating ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Analyse...</>
                    ) : (
                      "Lancer l'assignation automatique"
                    )}
                  </button>
                </div>
              </div>

              {/* Liste défilante des épisodes (Identique à votre version précédente) */}
              <div className="flex-1 overflow-y-auto pm-slim-scroll bg-slate-50/30 w-full">
                {/* ... (Votre map et filter existant des épisodes/diffusions) ... */}
              </div>
            </div>
          </main>

          {/* COLONNE DROITE : ÉCRAN DE CHARGEMENT IA */}
          {isGenerating && (
            <aside className="w-2/3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col items-center justify-center shadow-inner animate-in fade-in">
              <div className="w-16 h-16 border-4 border-[#243c54] border-t-emerald-500 rounded-full animate-spin mb-6 shadow-md"></div>
              <h3 className="text-xl font-bold text-[#243c54] mb-2">Croisement des données en cours</h3>
              <p className="text-sm text-slate-500 max-w-md text-center">
                L'IA recherche le conducteur, filtre les annonces actives,
                et maximise l'audience en fonction de la démographie des programmes...
              </p>
            </aside>
          )}

          {/* COLONNE DROITE : VALIDATION DU PLANNING (S'affiche quand terminé) */}
          {!isGenerating && planningEdite.length > 0 && (
            <aside className="w-2/3 bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden shadow-sm animate-in slide-in-from-right-4">

              {/* CORRECTION 2 : Affichage d'une date lisible au lieu de l'UUID */}
              <div className="bg-[#243c54] p-4 flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-white">Validation du Planning IA</h2>
                  <p className="text-xs text-slate-300">
                    Résultat généré pour le {conducteurpub.find(c => c.id === selectedConducteurId)?.date || "jour sélectionné"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setPlanningEdite([])} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-md transition-colors">
                    Annuler
                  </button>
                  <button onClick={validerEtSauvegarderPlanning} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-md transition-colors shadow-sm">
                    Confirmer & Enregistrer
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
                {planningEdite.map((ecran) => {
                  const epAssocie = episodes.find(e => e.id === ecran.episode_id);
                  const progAssocie = epAssocie ? programmes.find(p => p.id === epAssocie.programme_id) : null;

                  const nomProgramme = progAssocie ? (progAssocie.titre || progAssocie.nom) : "Programme Inconnu";
                  const nomEpisode = epAssocie ? (epAssocie.titre || epAssocie.nom || `Épisode ${epAssocie.numero}`) : "";

                  const cibleE = ecran.cible_enfant || 0;
                  const cibleJ = ecran.cible_adulte || 0;
                  const cibleG = ecran.cible_senior || 0;

                  // 🚨 CORRECTION 1 : Le getHeureSpot intelligent (qui lit la saisie utilisateur)
                  const getHeureSpot = (indexSpot) => {
                    // Si l'utilisateur a tapé une heure manuelle, on l'affiche prioritairement !
                    if (ecran.heures_personnalisees?.[indexSpot]) {
                      return ecran.heures_personnalisees[indexSpot];
                    }

                    const heureBase = ecran.heure_prev || ecran.heure_ecran;
                    if (!heureBase) return "00:00:00";

                    let [h, m, s] = heureBase.split(':').map(Number);
                    let dateTemp = new Date(2000, 0, 1, h, m, s || 0);

                    // Calcul en cascade
                    for (let i = 0; i < indexSpot; i++) {
                      // Si un spot PRÉCÉDENT a été forcé manuellement, la cascade repart de cette nouvelle heure !
                      if (ecran.heures_personnalisees?.[i]) {
                        const [fh, fm, fs] = ecran.heures_personnalisees[i].split(':').map(Number);
                        dateTemp = new Date(2000, 0, 1, fh, fm, fs || 0);
                      }
                      const duration = ecran.spots_assignes?.[i]?.duration || 30;
                      dateTemp.setSeconds(dateTemp.getSeconds() + duration);
                    }

                    return dateTemp.toTimeString().split(' ')[0];
                  };

                  return (
                    <div key={ecran.ecran_id} className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                      <div className="bg-slate-100/80 border-b border-slate-200 px-4 py-3 flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-mono font-bold text-[#243c54] mr-2">{ecran.heure_prev || ecran.heure_ecran}</span>
                            <span className="text-sm font-medium text-slate-700">{ecran.contexte}</span>
                          </div>
                          <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-1 rounded shrink-0">
                            {ecran.nb_spots_requis} Spots
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-600 bg-white p-2 rounded border border-slate-200">
                          <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-50 text-indigo-600">📺</span>
                          <span>
                            Lié à : <strong className="text-slate-800">{nomProgramme}</strong>
                            {nomEpisode ? ` - ${nomEpisode}` : ''}
                          </span>
                          {(!progAssocie) && (
                            <span className="text-rose-500 font-bold ml-auto">⚠️ Aucun programme détecté</span>
                          )}
                        </div>
                      </div>

                      <div className="p-4 space-y-3">
                        {Array.from({ length: ecran.nb_spots_requis }).map((_, index) => {
                          const spotActuel = ecran.spots_assignes?.[index];
                          const heurePassageExacte = getHeureSpot(index);

                          return (
                            <div key={index} className="flex items-center gap-3">
                              <div className="shrink-0">
                                <input
                                  type="time"
                                  step="1"
                                  className="w-24 text-center rounded border border-slate-300 py-1.5 px-1 text-xs font-mono font-bold text-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors hover:bg-slate-50"
                                  value={heurePassageExacte}
                                  onChange={(e) => modifierHeureSpot(ecran.ecran_id, index, e.target.value)}
                                  title="Modifier l'heure d'insertion de ce spot"
                                />
                              </div>

                              <div className="flex-1">
                                <select
                                  className={`w-full text-sm rounded border py-1.5 px-3 focus:outline-none transition-colors
                                  ${spotActuel ? 'border-slate-300 focus:border-indigo-500' : 'border-rose-300 bg-rose-50 text-rose-700'}`}
                                  value={spotActuel?.id || ""}
                                  onChange={(e) => modifierSpot(ecran.ecran_id, index, e.target.value)}
                                >
                                  <option value="">-- Spot manquant, veuillez sélectionner --</option>
                                  {stockAnnonces
                                    .filter(stock => stock.PAD)
                                    .sort((a, b) => {
                                      const diffA = Math.abs(cibleE - (a.enfantpercentage ?? 0)) + Math.abs(cibleJ - (a.jeunepercentage ?? 0)) + Math.abs(cibleG - (a.grand_percentage ?? 0));
                                      const diffB = Math.abs(cibleE - (b.enfantpercentage ?? 0)) + Math.abs(cibleJ - (b.jeunepercentage ?? 0)) + Math.abs(cibleG - (b.grand_percentage ?? 0));
                                      return diffA - diffB;
                                    })
                                    .map(stock => {
                                      const diffTotale = Math.abs(cibleE - (stock.enfantpercentage ?? 0)) + Math.abs(cibleJ - (stock.jeunepercentage ?? 0)) + Math.abs(cibleG - (stock.grand_percentage ?? 0));
                                      const affinite = Math.max(0, Math.round(100 - (diffTotale / 2)));

                                      return (
                                        <option key={stock.id} value={stock.id}>
                                          {stock.nom || stock.title} ({stock.duration || 30}s) {cibleE > 0 ? `- Match: ${affinite}%` : ''}
                                        </option>
                                      );
                                    })
                                  }
                                </select>
                              </div>

                              <div className="w-16 text-right shrink-0">
                                {spotActuel ? (
                                  <span className="text-xs font-mono text-slate-500">{spotActuel.duration || 30}s</span>
                                ) : (
                                  <span className="text-xs font-bold text-rose-500">Vide</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>
          )}
        </div>
      </div>




























      <div className={vuePrincipale === 'PIGE_VALIDATION' ? 'block' : 'hidden'}>
        <PigeValidation events={genererEvenementsPige()} chaineId={chaineActive.id} setVuePrincipale={setVuePrincipale} chaine={chaineActive} />
      </div>
      <div className={vuePrincipale === 'PLAN_MEDIA_ADMIN' ? 'block' : 'hidden'}>

        <PlanMediaAdministration
          planMediaId={planMediaActif?.id}
          chaineId={chaineActive?.id}
          stockAnnonces={stockAnnonces}
          setStockAnnonces={setStockAnnonces}
          programmes={programmes}
          episodes={episodes}
          setdatachanged={setdatachanged}
          datachanged={datachanged}
          setIsLoading={setIsLoading}
          chaineActive={chaineActive}
        />
      </div>


    </div>
  );
}