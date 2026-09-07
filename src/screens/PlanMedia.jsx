import { useState } from 'react';
import { Clock, List as ListIcon, Search, Upload, Settings } from 'lucide-react';
import { VerticalTimeline } from '../helpers/VerticalTimeline';
import './PlanMedia.css';

export default function PlanMedia({ chaineActive, utilisateur, isReadOnly = false }) {
  // Navigation principale entre Gestion Plan Média, Validation Pige et Administration Plan Média
  const [vuePrincipale, setVuePrincipale] = useState('PLAN_MEDIA');

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

  // Fake data for the right-hand list
  const mockList = [
    { id: 101, type: 'Spot', title: 'Campagne SNRT', duration: '30s', categorie: 'enfant' },
    { id: 102, type: 'Bande-annonce', title: 'BA Soirée Cinéma', duration: '45s', categorie: 'jeune' },
    { id: 103, type: 'Habillage', title: 'Jingle Pub', duration: '05s', categorie: 'grand' },
    { id: 104, type: 'Autopromotion', title: 'Promo Rentrée', duration: '20s', categorie: 'budget' },
  ];

  return (
    <div className="space-y-6">
      
      {/* Barre d'outils globale (Top) avec les 3 boutons de navigation */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <header className="mb-4 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
          <h1 className="text-lg font-semibold text-slate-800">Plan Média — {chaineActive?.nom || 'Workspace'}</h1>
        </header>
        <div className="flex flex-wrap items-end justify-between gap-4">
          {/* Navigation 3 boutons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setVuePrincipale('PLAN_MEDIA')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                vuePrincipale === 'PLAN_MEDIA'
                  ? 'bg-snrt-navy text-white'
                  : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Gestion Plan Média
            </button>
            <button
              type="button"
              onClick={() => setVuePrincipale('PIGE_VALIDATION')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                vuePrincipale === 'PIGE_VALIDATION'
                  ? 'bg-snrt-navy text-white'
                  : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Validation Pige
            </button>
            <button
              type="button"
              onClick={() => setVuePrincipale('PLAN_MEDIA_ADMIN')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                vuePrincipale === 'PLAN_MEDIA_ADMIN'
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
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'stretch', height: 'calc(100vh - 250px)' }}>
          
          {/* 1. Colonne Gauche : Timeline */}
          <aside 
            className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col" 
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
                  className={`rounded-md px-2 py-1 text-[11px] font-medium capitalize transition-colors ${
                    filtresTimeline.includes(f)
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
            <VerticalTimeline events={mockEvents} />
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

          {/* 3. Colonne Droite : Liste avec filtres et recherche */}
          <aside 
            className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col" 
            style={{ flex: '0 0 320px', overflowY: 'auto' }}
          >
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700 shrink-0">
              <ListIcon size={16} className="text-snrt-navy" />
              <span>Éléments disponibles</span>
            </div>
            
            {/* 4 Boutons de filtres (enfant, jeune, grand, budget) */}
            <div className="mb-3 grid grid-cols-2 gap-1.5 shrink-0">
              {['enfant', 'jeune', 'grand', 'budget'].map((btn) => (
                <button
                  key={btn}
                  type="button"
                  onClick={() => setFiltreOrdre(btn)}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium capitalize transition-colors ${
                    filtreOrdre === btn
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

            {/* Contenu de la liste */}
            <div className="space-y-3 overflow-y-auto flex-1">
              {mockList.map((item) => (
                <div 
                  key={item.id} 
                  className="group cursor-pointer rounded-md border border-slate-200 p-3 transition-colors hover:border-snrt-accent hover:bg-snrt-accent/5"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold text-snrt-navy">{item.type}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 group-hover:bg-white">
                      {item.duration}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-800">{item.title}</p>
                </div>
              ))}
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
        /* Vue Administration Plan Média */
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center min-h-[500px] flex flex-col items-center justify-center space-y-4">
          <div className="rounded-full bg-slate-100 p-4 text-snrt-navy">
            <Settings size={32} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800">Administration Plan Média</h2>
            <p className="text-sm text-slate-500 mt-1">Paramètres avancés, règles de génération et gestion des privilèges.</p>
          </div>
        </div>
      )}

    </div>
  );
}