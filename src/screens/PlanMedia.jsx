import { useState } from 'react';
import { Clock, List as ListIcon, Search, Upload, Settings } from 'lucide-react';
import { VerticalTimeline } from '../helpers/VerticalTimeline';
import PlanMediaAdministration from '../helpers/PlanMediaAdministration.jsx';
import './PlanMedia.css';
import { MdCloudSync } from "react-icons/md";

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
  data_refrech, listerClassificationsProgrammes
} from '../lib/db.js';
import { Plus, Trash2, X } from 'lucide-react';
// Remplacez import * as XLSX from 'xlsx'; par :
import * as XLSX from 'xlsx-js-style';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; // <-- Modification ici
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, AlignmentType, WidthType } from 'docx';
import { saveAs } from 'file-saver';
import toast from 'react-hot-toast';

export default function PlanMedia({ chaineActive, utilisateur, isReadOnly = false }) {

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
*/
  // Gestion des changements dans la liste dynamique d'annonces

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



  // 2. Fonction déclenchée quand l'utilisateur choisit un programme dans la liste
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
              {classificationIA.enfant_point ?? 0}
            </span>
          </div>

          <div className="classification-card classification-adulte">
            <span className="classification-label">Adulte</span>
            <span className="classification-score">
              {classificationIA.adult_point ?? 0}
            </span>
          </div>

          <div className="classification-card classification-senior">
            <span className="classification-label">Grand</span>
            <span className="classification-score">
              {classificationIA.senior_point ?? 0}
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
  const [filtresTimeline, setFiltresTimeline] = useState(['annonce', 'programme']);
  const [rechercheTimeline, setRechercheTimeline] = useState('');

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
  const [dateFiltreTimeline, setDateFiltreTimeline] = useState('');

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
          programmeclassificationDb
          // <-- Ajoutez ceci
        ] = await Promise.all([
          planCourant?.id ? listerPlanMediaStockParPlanMedia(planCourant.id) : Promise.resolve([]),
          listerGrillesParChaine(chaineActive.id),
          listerGrillesTypeParChaine(chaineActive.id),
          listerProgrammesParChaine(chaineActive.id),
          listerTousLesEpisodes(),
          listerDiffusionsLineairesParChaine(chaineActive.id), // <-- Ajoutez l'appel API ici
          listerPlanificationsMedia(),
          listerClassificationsProgrammes()]);

        if (actif) {
          setStockAnnonces(stockDb || []);
          setGrilles(grillesDb || []);
          setGrilleTypes(grillesTypesDb || []);
          setProgrammes(programmesDb || []);
          setEpisodes(episodesDb || []);
          setDiffusions(diffusionsDb || []);
          setPlanificationsMedia(planificationsMediaDb || []);
          setProgrammeClassification(programmeclassificationDb)// <-- Stockez le résultat ici
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




  // Construction dynamique des événements pour la Timeline

  const genererEvenementsTimeline = () => {
    let eventsGenerees = [];
    const diffusionsFiltrees = diffusions.filter(diff => {
      if (!filtreGrilleId) return true;
      return diff.grille_id === filtreGrilleId;
    });
    // 1. Grouper par date depuis diffusion_lineaire et résoudre programme/épisode
    if (diffusions && diffusions.length > 0 && filtresTimeline.includes('episode')) {
      const diffusionsParDate = diffusionsFiltrees.reduce((groupes, diff) => {
        const dateStr = diff.date || 'Sans date';
        if (!groupes[dateStr]) groupes[dateStr] = [];
        groupes[dateStr].push(diff);
        return groupes;
      }, {});
      Object.entries(diffusionsParDate).forEach(([date, listeDiffusions]) => {
        listeDiffusions.forEach((diff) => {
          const ep = episodes.find(e => e.id === diff.episode_id);
          const prog = programmes.find(p => p.id === diff.programme_id || (ep && ep.programme_id === p.id));

          const titreEp = ep?.titre || ep?.nom || (ep?.numero ? `Épisode ${ep.numero}` : null);
          const titreProg = prog?.titre || prog?.nom || 'Programme Inconnu';
          const nomAffichage = titreEp || titreProg;
          const descParent = prog ? `Programme : ${titreProg}` : '';

          if (rechercheTimeline.trim() === '' || nomAffichage.toLowerCase().includes(rechercheTimeline.toLowerCase())) {
            eventsGenerees.push({
              id: diff.id,
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

    if (planificationsMedia && planificationsMedia.length > 0 && filtresTimeline.includes('annonce')) {
      planificationsMedia.forEach((plan) => {
        // Filtrer par grille si un filtre de grille est actif
        if (filtreGrilleId && plan.grille_id !== filtreGrilleId) return;

        // Récupérer l'annonce liée depuis le stock si nécessaire pour afficher son nom/durée
        const stockAnnonce = stockAnnonces.find(s => s.id === plan.annonce_id);
        const titreAnnonce = stockAnnonce?.nom || stockAnnonce?.title || 'Annonce planifiée';

        if (rechercheTimeline.trim() === '' || titreAnnonce.toLowerCase().includes(rechercheTimeline.toLowerCase())) {
          const dateStr = plan.date || new Date().toISOString().split('T')[0];
          const timeStr = plan.timestart ? plan.timestart.substring(0, 5) : '00:00';

          eventsGenerees.push({
            id: plan.id,
            date_tri: dateStr,
            time: timeStr,
            name: titreAnnonce,
            details: {
              type: 'Publicité',
              duree: stockAnnonce?.duration ? `${stockAnnonce.duration}s` : '30s',
              description: stockAnnonce?.client ? `Client : ${stockAnnonce.client}` : ''
            }
          });
        }
      });
    }

    // 3. Application du filtre par date sélectionnée
    if (dateFiltreTimeline) {
      eventsGenerees = eventsGenerees.filter(event => event.date_tri === dateFiltreTimeline);
    }

    // 4. Tri chronologique global (Date puis Heure)
    eventsGenerees.sort((a, b) => {
      if (a.date_tri !== b.date_tri) {
        return a.date_tri.localeCompare(b.date_tri);
      }
      return a.time.localeCompare(b.time);
    });

    return eventsGenerees.length > 0 ? eventsGenerees : mockEvents;
  };








  const [rechercheEpisodeForm, setRechercheEpisodeForm] = useState('');
  const handleEpisodeSelection = (episodeId) => {
    setFormEpisodeId(episodeId);
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



  const [modalExportOuvert, setModalExportOuvert] = useState(false);
  const [exportTitre, setExportTitre] = useState('');
  const [exportDate, setExportDate] = useState('');
  const [exportGrilleId, setExportGrilleId] = useState('');



  const preparerDonneesExport = () => {
    const donneesFiltrees = planificationsMedia.filter(plan => {
      if (exportGrilleId && plan.grille_id !== exportGrilleId) return false;
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
      if (exportGrilleId && plan.grille_id !== exportGrilleId) correspond = false;
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
  return (
    <div className="space-y-6">

      {/* MODAL D'EXPORTATION EXCEL */}
      {modalExportOuvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">

            {/* Header Modal */}
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-semibold text-slate-800 text-lg">Exporter le conducteur</h3>
              <button onClick={() => setModalExportOuvert(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
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

              {/* Sélection de la Grille */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Grille ciblée</label>
                <select
                  required
                  className="w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  value={exportGrilleId}
                  onChange={(e) => setExportGrilleId(e.target.value)}
                >
                  <option value="">-- Sélectionnez une grille --</option>
                  {grilles.map(grille => (
                    <option key={grille.id} value={grille.id}>
                      {grille.nom || grille.titre || `Grille #${grille.id.substring(0, 5)}`}
                    </option>
                  ))}
                </select>
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

            <div>
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
            </div>

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


            <button type="button" className="flex items-center gap-1.5 rounded-md bg-snrt-navy px-3 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover transition-colors" style={{ color: "orange", cursor: "pointer" }} title='refrech classifications'

              onClick={async () => {
                if (!filtreGrilleId) {
                  toast.error("Veuillez sélectionner une grille d'abord.");
                  return;
                }

                try {
                  await data_refrech(filtreGrilleId);
                  toast.success("Classifications actualisées !");
                } catch (error) {
                  toast.error(error);
                  toast.error("Erreur lors de l'actualisation.");
                }
              }}
            >
              <MdCloudSync size={20} />

            </button>
          </div>
        </div>
      </div>

      {/* Affichage conditionnel selon la vue principale choisie */}
      {vuePrincipale === 'PLAN_MEDIA' ? (
        /* Main Layout : Timeline - Formulaire - Liste */
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
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
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
              <div className="shrink-0 p-5 pb-4 border-b border-slate-100 bg-white">
                <h2 className="pm-form-title m-0 text-lg font-semibold text-slate-800">Planifier des annonces</h2>
                <p className="pm-form-subtitle mt-1 text-sm text-slate-500">Recherchez et sélectionnez un épisode pour y attacher des annonces.</p>
              </div>

              {/* Conteneur de recherche et liste (Pleine largeur, touche les bords) */}
              <div className="flex flex-col flex-1 overflow-hidden w-full">

                {/* Barre de recherche */}
                <div className="p-3 border-b border-slate-200 bg-slate-50/80 shrink-0">
                  <div className="relative" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px" }}>
                    <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
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
                      onChange={(e) => setDateFiltreEpisodes(e.target.value)}
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
                          onClick={() => handleEpisodeSelection(item.episode_id_reel)}
                          className="border-b border-slate-100 bg-white cursor-pointer px-5 py-3 transition-colors hover:bg-indigo-50/60 border-l-4 border-l-transparent hover:border-l-indigo-400 flex items-center justify-between group"
                        >
                          <div className="pr-4">
                            <div className="text-sm font-semibold text-slate-700 group-hover:text-indigo-700 transition-colors line-clamp-1">
                              {item.titre || item.nom || `Épisode ${item.numero || 'N/C'}`}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                              {item.programme ? (item.programme.titre || item.programme.nom) : 'Programme Inconnu'}
                            </div>
                          </div>

                          {/* Bloc Date et Heure direct depuis la diffusion */}
                          <div className="flex flex-col items-end shrink-0 gap-1">
                            {item.date_diffusion && (
                              <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
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
                      <div className="p-8 text-center text-sm text-slate-400 italic">
                        Aucun épisode programmé ne correspond à votre recherche.
                      </div>
                    )}

                  {/* Message si aucun résultat */}
                  {episodes.length > 0 && episodes.filter(ep => {
                    const titreProg = programmes.find(p => p.id === ep.programme_id)?.titre || '';
                    const titreEp = ep.titre || ep.nom || `Épisode ${ep.numero || ''}`;
                    return titreEp.toLowerCase().includes(rechercheEpisodeForm.toLowerCase()) || titreProg.toLowerCase().includes(rechercheEpisodeForm.toLowerCase());
                  }).length === 0 && (
                      <div className="p-8 text-center text-sm text-slate-400 italic">
                        Aucun épisode ne correspond à votre recherche.
                      </div>
                    )}
                </div>
              </div>

            </div>
          </main>
          {/* 3. Colonne Droite : Liste connectée au stock global d'administration */}
          <aside
            className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col"
            style={{ flex: '0 0 320px', overflowY: 'auto' }}
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
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
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
                <p className="text-xs text-slate-400 italic text-center py-6">Aucun élément trouvé.</p>
              ) : (
                listeFiltree.map((item) => (
                  <div
                    key={item.id}
                    className="
          group flex items-center gap-2
          h-7 px-2.5
          rounded-sm
          border border-slate-200/80
          bg-white
          cursor-pointer
          transition-all duration-150
          hover:border-snrt-accent/50
          hover:bg-slate-50
          hover:shadow-sm
        "
                  >
                    {/* Type */}
                    <span
                      className="
            shrink-0 rounded
            bg-snrt-navy/10
            px-1.5 py-0.5
            text-[9px] font-semibold uppercase tracking-wide
            text-snrt-navy
          "
                    >
                      {item.type}
                    </span>

                    {/* Name */}
                    <p
                      className="
            min-w-0 flex-1 truncate
            text-[12px] 
            text-slate-700
            group-hover:text-slate-900
          "
                      title={item.nom || item.title}
                    >
                      {item.nom || item.title}
                    </p>

                    {/* Duration */}
                    <span
                      className="
            shrink-0
            flex items-center gap-1
            text-[10px] font-medium
            text-slate-400
            group-hover:text-snrt-navy
          "
                    >

                      {item.duration}
                    </span>
                  </div>
                ))
              )}
            </div>
          </aside>








          {/* ----------------- MODALE D'INSERTION DES ANNONCES ----------------- */}
          {isModalOuvert && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
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
                  </div>
                  <button
                    onClick={fermerModal}
                    className="text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 p-1.5 rounded-full transition-colors border border-slate-200"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Corps de la modale avec défilement */}
                <form onSubmit={gererSoumissionFormulaire} className="flex flex-col flex-1 overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-5 pm-slim-scroll bg-slate-50/30">
                    <div className="flex items-center justify-between mb-4" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                        <h3 className="text-sm font-semibold text-slate-700">Liste des annonces à attacher</h3>
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

                    <div className="flex flex-col gap-1">
                      {formAnnonces.map((annonceItem) => (
                        <div key={annonceItem.idUnique} className="flex flex-wrap items-end gap-1 p-1.5 bg-white   rounded-md " style={{ fontSize: "11px" }}>

                          <div className="flex-1 min-w-[200px] pm-form-group mb-0">
                            <label className="pm-label text-xs" style={{ fontSize: "13px", color: "", fontWeight: "none" }}>Annonce depuis le stock</label>
                            <select
                              className="pm-select py-1 text-sm"
                              style={{ height: "35px", fontSize: "12px" }}
                              value={annonceItem.annonceId}
                              onChange={(e) => handleAnnonceChange(annonceItem.idUnique, 'annonceId', e.target.value)}
                              required
                            >
                              <option value="">-- Sélectionner une annonce --</option>
                              {stockAnnonces.map(stock => (
                                <option key={stock.id} value={stock.id}>
                                  {stock.nom || stock.title} ({stock.duration || 30}s)
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="w-36 pm-form-group mb-0 shrink-0">
                            <label className="pm-label text-xs" style={{ fontSize: "13px", color: "", fontWeight: "none" }}>Type de départ</label>
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
                            <label className="pm-label text-xs" style={{ fontSize: "13px", color: "", fontWeight: "none" }}>
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
            </div>
          )}
        </div>
      ) : vuePrincipale === 'PIGE_VALIDATION' ? (
        /* Vue Validation Pige : Uploader un fichier Excel pour traitement et analyse */
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center min-h-[500px] flex flex-col items-center justify-center space-y-4">
          <div className="rounded-full bg-slate-100 p-4 text-snrt-navy">
            <Upload size={32} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800">Validation Pige — Import de données</h2>
            <p className="text-sm text-slate-500 mt-1">Téléchargez un fichier Excel pour lancer le traitement et l'analyse.</p>
          </div>
          <div className="mt-4">
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={(e) => setFichierPige(e.target.files[0])}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-snrt-navy file:text-white hover:file:bg-snrt-navy-hover cursor-pointer"
            />
            {fichierPige && (
              <p className="mt-2 text-xs font-medium text-emerald-700">Fichiers sélectionnés : {fichierPige.name}</p>
            )}
          </div>





        </div>
      ) : (
        /* Vue Administration Plan Média connectée au stock global */
        <PlanMediaAdministration
          planMediaId={planMediaActif?.id}
          chaineId={chaineActive?.id}
          stockAnnonces={stockAnnonces}
          setStockAnnonces={setStockAnnonces}
          programmes={programmes}
          episodes={episodes}
          setdatachanged={setdatachanged}
          datachanged={datachanged}
        />
      )}

    </div>
  );
}