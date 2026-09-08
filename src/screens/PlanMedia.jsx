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
  listerTousLesEpisodes
} from '../lib/db.js';



export default function PlanMedia({ chaineActive, utilisateur, isReadOnly = false }) {


  // Navigation principale entre Gestion Plan Média, Validation Pige et Administration Plan Média
  const [vuePrincipale, setVuePrincipale] = useState('PLAN_MEDIA');

  // Stock d'annonces centralisé partagé entre la liste de droite et l'administration
  const [chargement, setChargement] = useState(false);
  const [planMediaActif, setPlanMediaActif] = useState(null);
  const [grilles, setGrilles] = useState([]);
  const [grilleTypes, setGrilleTypes] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [episodes, setEpisodes] = useState([]);

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
        const [
          stockDb,
          grillesDb,
          grillesTypesDb,
          programmesDb,
          episodesDb
        ] = await Promise.all([
          planCourant?.id ? listerPlanMediaStockParPlanMedia(planCourant.id) : Promise.resolve([]),
          listerGrillesParChaine(chaineActive.id),
          listerGrillesTypeParChaine(chaineActive.id),
          listerProgrammesParChaine(chaineActive.id),
          listerTousLesEpisodes()
        ]);

        if (actif) {
          setStockAnnonces(stockDb || []);
          setGrilles(grillesDb || []);
          setGrilleTypes(grillesTypesDb || []);
          setProgrammes(programmesDb || []);
          setEpisodes(episodesDb || []);
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

    // 1. Intégrer les programmes si le filtre 'programme' est actif
    /*
    if (programmes && programmes.length > 0 && filtresTimeline.includes('programme')) {
      programmes.forEach((prog, index) => {
        // Filtrer par chaine_id si la table programme possède cette colonne et que chaineActive.id est défini
        if (chaineActive?.id && prog.chaine_id && prog.chaine_id !== chaineActive.id) {
          return;
        }

        const titreProg = prog.titre || prog.nom || '';
        if (rechercheTimeline.trim() === '' || titreProg.toLowerCase().includes(rechercheTimeline.toLowerCase())) {
          eventsGenerees.push({
            id: prog.id || `prog-${index}`,
            time: prog.heure_debut || '00:00',
            name: titreProg,
            details: {
              type: 'Programme',
              duree: prog.duree ? `${prog.duree} min` : '00:00:00',
              description: prog.description || 'Programme principal'
            }
          });
        }
      });
    }
*/
    // 2. Intégrer les épisodes si le filtre 'episode' est actif (avec association au programme parent)
    if (episodes && episodes.length > 0 && filtresTimeline.includes('episode')) {
      episodes.forEach((ep, index) => {
        // Retrouver le programme parent de cet épisode
        const programmeParent = programmes.find(p => p.id === ep.programme_id);

        // Filtrer par chaine_id via le programme parent ou l'épisode si disponible
        const episodeChaineId =(programmeParent ? programmeParent.chaine_id : null);
        if (chaineActive?.id && episodeChaineId && episodeChaineId !== chaineActive.id) {
          return;
        }

        const titreEp = ep.titre || ep.nom || `Épisode ${ep.numero || ''}`;
        const descParent = programmeParent ? `Programme : ${programmeParent.titre || programmeParent.nom}` : '';

        if (rechercheTimeline.trim() === '' || titreEp.toLowerCase().includes(rechercheTimeline.toLowerCase()) || descParent.toLowerCase().includes(rechercheTimeline.toLowerCase())) {
          eventsGenerees.push({
            id: ep.id || `ep-${index}`,
            time: ep.heure_debut || '00:00',
            name: titreEp,
            details: {
              type: 'Épisode',
              duree: ep.duree ? `${ep.duree} min` : '00:00:00',
              description: descParent || ep.description || ''
            }
          });
        }
      });
    }

    // 3. Intégrer le stock d'annonces si le filtre 'annonce' est actif (déjà filtré par plan_media_id lié à la chaîne)
    if (stockAnnonces && stockAnnonces.length > 0 && filtresTimeline.includes('annonce')) {
      stockAnnonces.forEach((annonce, index) => {
        const titreAnnonce = annonce.nom || annonce.title || '';
        if (rechercheTimeline.trim() === '' || titreAnnonce.toLowerCase().includes(rechercheTimeline.toLowerCase())) {
          eventsGenerees.push({
            id: annonce.id || `annonce-${index}`,
            time: annonce.date_debut ? new Date(annonce.date_debut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '00:00',
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

    // Tri chronologique des événements par heure
    eventsGenerees.sort((a, b) => a.time.localeCompare(b.time));

    return eventsGenerees.length > 0 ? eventsGenerees : mockEvents;
  };
  return (
    <div className="space-y-6">

      {/* Barre d'outils globale (Top) avec les 3 boutons de navigation */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <header className="mb-4 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
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
              {['annonce', 'episode', 'programme'].map((f) => (
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

          {/* 2. Colonne Milieu : Formulaire */}
          <main
            className="rounded-lg border border-slate-200 bg-white p-6"
            style={{ flex: '1 1 auto', overflowY: 'auto' }}
          >
            <div className="pm-form">
              <div className="pm-form-header">
                <h2 className="pm-form-title">Insérer un élément</h2>
                <p className="pm-form-subtitle">Ajoutez une bande-annonce, un spot ou un habillage dans la grille.</p>
              </div>

              <form onSubmit={(e) => e.preventDefault()}>
                <div className="pm-form-row">
                  <div className="pm-form-group">
                    <label className="pm-label" htmlFor="type-element">Type d'élément</label>
                    <select id="type-element" className="pm-select" defaultValue="BANDE_ANNONCE">
                      <option value="BANDE_ANNONCE">Bande-annonce</option>
                      <option value="ECRAN_PUBLICITAIRE">Écran publicitaire</option>
                      <option value="HABILLAGE">Habillage</option>
                      <option value="AUTOPROMOTION">Autopromotion</option>
                      <option value="SPOT">Spot</option>
                    </select>
                  </div>
                  <div className="pm-form-group">
                    <label className="pm-label" htmlFor="libelle">Libellé / Titre</label>
                    <input type="text" id="libelle" className="pm-input" placeholder="Ex: BA JT Soir" />
                  </div>
                </div>

                <div className="pm-form-row" style={{ marginTop: '1.25rem' }}>
                  <div className="pm-form-group">
                    <label className="pm-label" htmlFor="heure-debut">Heure de début</label>
                    <input type="time" id="heure-debut" className="pm-input" step="1" defaultValue="00:00:00" />
                  </div>
                  <div className="pm-form-group">
                    <label className="pm-label" htmlFor="duree">Durée (secondes)</label>
                    <input type="number" id="duree" className="pm-input" placeholder="Ex: 30" min="1" />
                  </div>
                </div>

                <div className="pm-form-group" style={{ marginTop: '1.25rem' }}>
                  <label className="pm-label" htmlFor="description">Description / Notes</label>
                  <textarea id="description" className="pm-textarea" placeholder="Informations supplémentaires..." />
                </div>

                <div className="pm-actions">
                  <button type="button" className="pm-btn pm-btn-secondary">Annuler</button>
                  <button type="submit" className="pm-btn pm-btn-primary">Insérer l'annonce</button>
                </div>
              </form>
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