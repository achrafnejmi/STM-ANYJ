import { useState } from 'react';
import { Clock, List as ListIcon, Search, Upload, Settings } from 'lucide-react';
import { VerticalTimeline } from '../helpers/VerticalTimeline';
import PlanMediaAdministration from '../helpers/PlanMediaAdministration.jsx';
import './PlanMedia.css';
import { useEffect } from 'react';
import {
  listerPlanMediaParChaine,
  creerPlanMedia,
  listerPlanMediaStockParPlanMedia,
  listerGrillesParChaine,
  listerGrillesTypeParChaine,
  listerProgrammesParChaine,
  listerTousLesEpisodes, listerDiffusionsLineairesParChaine,
  insererPlanificationsMedia
} from '../lib/db.js';
import { Plus, Trash2, X } from 'lucide-react';

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
      console.error("Aucune diffusion trouvée pour cet épisode.");
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
      if(!filtreGrilleId){alert("ooops no grille id");}
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

    // 3. Appel de la fonction d'insertion en base de données
    await insererPlanificationsMedia(planificationsPayload);

    console.log("Planifications enregistrées avec succès !");
    fermerModal();
    
    // Optionnel : Recharger vos données de planifications ici si nécessaire
  } catch (error) {
    console.error("Erreur lors de l'enregistrement des planifications :", error);
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
  // Le stock d'annonces démarre vide, il sera peuplé par Supabase via plan_media_stock
  const [stockAnnonces, setStockAnnonces] = useState([]);
  // États pour les filtres et la recherche de la timeline (colonne gauche)
  const [filtresTimeline, setFiltresTimeline] = useState(['annonce', 'programme']);
  const [rechercheTimeline, setRechercheTimeline] = useState('');

  // États pour la recherche et les 4 boutons de la liste (colonne droite)
  const [filtreOrdre, setFiltreOrdre] = useState('enfant');
  const [rechercheListe, setRechercheListe] = useState('');

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
    { id: 1, time: '06:00', name: 'Début Antenne', details: { type: 'Ouverture', duree: '00:00:00' } },
    { id: 2, time: '06:15', name: 'Journal Télévisé', details: { type: 'Information', duree: '00:45:00', description: 'Édition matinale' } },
    { id: 3, time: '07:00', name: 'Coupure Libre', details: { type: 'Publicité', duree: '00:05:00' } },
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
          diffusionsDb // <-- Ajoutez ceci
        ] = await Promise.all([
          planCourant?.id ? listerPlanMediaStockParPlanMedia(planCourant.id) : Promise.resolve([]),
          listerGrillesParChaine(chaineActive.id),
          listerGrillesTypeParChaine(chaineActive.id),
          listerProgrammesParChaine(chaineActive.id),
          listerTousLesEpisodes(),
          listerDiffusionsLineairesParChaine(chaineActive.id) // <-- Ajoutez l'appel API ici
        ]);

        if (actif) {
          setStockAnnonces(stockDb || []);
          setGrilles(grillesDb || []);
          setGrilleTypes(grillesTypesDb || []);
          setProgrammes(programmesDb || []);
          setEpisodes(episodesDb || []);
          setDiffusions(diffusionsDb || []); // <-- Stockez le résultat ici
        }
      } catch (erreur) {
        console.error("Erreur lors du chargement des données Plan Média :", erreur);
      } finally {
        if (actif) setChargement(false);
      }
    }

    chargerDonnees();

    return () => {
      actif = false;
    };
  }, [chaineActive?.id]);
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

    // 2. Intégrer le stock d'annonces
    if (stockAnnonces && stockAnnonces.length > 0 && filtresTimeline.includes('annonce')) {
      stockAnnonces.forEach((annonce) => {
        const titreAnnonce = annonce.nom || annonce.title || '';

        if (rechercheTimeline.trim() === '' || titreAnnonce.toLowerCase().includes(rechercheTimeline.toLowerCase())) {
          const dateObj = annonce.date_debut ? new Date(annonce.date_debut) : new Date();
          const dateStr = dateObj.toISOString().split('T')[0];
          const timeStr = annonce.date_debut ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '00:00';

          eventsGenerees.push({
            id: annonce.id,
            date_tri: dateStr,
            time: timeStr,
            name: titreAnnonce,
            details: {
              type: annonce.type || 'Publicité',
              duree: `${annonce.duration || 30}s`,
              description: annonce.client ? `Client : ${annonce.client}` : (annonce.metadonne || '')
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
  const [isModalOuvert, setIsModalOuvert] = useState(false);
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



  return (
    <div className="space-y-6">

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
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Rechercher par titre, numéro ou programme..."
                      className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-shadow"
                      value={rechercheEpisodeForm}
                      onChange={(e) => setRechercheEpisodeForm(e.target.value)}
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
            <div className="space-y-3 overflow-y-auto flex-1">
              {listeFiltree.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">Aucun élément trouvé.</p>
              ) : (
                listeFiltree.map((item) => (
                  <div
                    key={item.id}
                    className="group cursor-pointer rounded-md border border-slate-200 p-3 transition-colors hover:border-snrt-accent hover:bg-snrt-accent/5"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-semibold text-snrt-navy">{item.type}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 group-hover:bg-white">
                        {item.duration ? `${item.duration}s` : '30s'}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-800">{item.nom || item.title}</p>
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
                      Épisode sélectionné : <span className="font-medium text-indigo-600">
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
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-slate-700">Liste des annonces à attacher</h3>
                      <button
                        type="button"
                        onClick={ajouterAnnonceAuFormulaire}
                        className="flex items-center gap-1 text-xs font-medium text-white bg-snrt-navy hover:bg-snrt-navy-hover px-3 py-1.5 rounded transition-colors shadow-sm"
                      >
                        <Plus size={14} /> Ajouter une annonce
                      </button>
                    </div>

                    <div className="flex flex-col gap-3">
                      {formAnnonces.map((annonceItem) => (
                        <div key={annonceItem.idUnique} className="flex flex-wrap items-end gap-3 p-3.5 bg-white border border-slate-200 rounded-md shadow-sm">

                          <div className="flex-1 min-w-[200px] pm-form-group mb-0">
                            <label className="pm-label text-xs">Annonce depuis le stock</label>
                            <select
                              className="pm-select py-1.5 text-sm"
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
                            <label className="pm-label text-xs">Type de départ</label>
                            <select
                              className="pm-select py-1.5 text-sm"
                              value={annonceItem.mode}
                              onChange={(e) => handleAnnonceChange(annonceItem.idUnique, 'mode', e.target.value)}
                            >
                              <option value="offset">Décalage (secondes)</option>
                              <option value="exact">Heure fixe</option>
                            </select>
                          </div>

                          <div className="w-32 pm-form-group mb-0 shrink-0">
                            <label className="pm-label text-xs">
                              {annonceItem.mode === 'offset' ? 'Secondes après' : 'Heure exacte'}
                            </label>
                            {annonceItem.mode === 'offset' ? (
                              <input
                                type="number"
                                min="0"
                                className="pm-input py-1.5 text-sm"
                                value={annonceItem.offsetSeconds}
                                onChange={(e) => handleAnnonceChange(annonceItem.idUnique, 'offsetSeconds', e.target.value)}
                                required
                              />
                            ) : (
                              <input
                                type="time"
                                step="1"
                                className="pm-input py-1.5 text-sm"
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
        />
      )}

    </div>
  );
}