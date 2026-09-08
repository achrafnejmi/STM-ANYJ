import { useState } from 'react';
import { Settings, Plus, Trash2, Edit3, Database, Search } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import { creerPlanMediaStock, mettreAJourPlanMediaStock, supprimerPlanMediaStock } from '../lib/db.js';

export default function PlanMediaAdministration({ planMediaId, stockAnnonces, setStockAnnonces, programmes = [], episodes = [] }) {
  const [modalOuverte, setModalOuverte] = useState(false);
  const [rechercheAdmin, setRechercheAdmin] = useState('');
  const [actionEnCours, setActionEnCours] = useState(false);
  
  // État pour savoir si on modifie un élément existant (contient l'objet ou null)
  const [elementEnEdition, setElementEnEdition] = useState(null);
  
  // Champs du formulaire d'insertion / modification de stock
  const [nom, setNom] = useState('');
  const [metadonne, setMetadonne] = useState('');
  const [client, setClient] = useState('');
  const [type, setType] = useState('spot');
  const [duration, setDuration] = useState('30');
  const [pricePerSec, setPricePerSec] = useState('0');
  const [budget, setBudget] = useState('0');
  
  const [programmeid, setProgrammeid] = useState('');
  const [episodeid, setEpisodeid] = useState('');
  
  // Pourcentages de cibles
  const [enfantpercentage, setEnfantpercentage] = useState('0');
  const [jeunepercentage, setJeunepercentage] = useState('0');
  const [grandPercentage, setGrandPercentage] = useState('0');

  // Ouvrir la modale en mode Création
  const ouvrirModalAjout = () => {
    setElementEnEdition(null);
    setNom('');
    setMetadonne('');
    setClient('');
    setType('spot');
    setDuration('30');
    setPricePerSec('0');
    setBudget('0');
    setProgrammeid('');
    setEpisodeid('');
    setEnfantpercentage('0');
    setJeunepercentage('0');
    setGrandPercentage('0');
    setModalOuverte(true);
  };

  // Ouvrir la modale en mode Édition avec les données de l'élément sélectionné
  const ouvrirModalEdition = (item) => {
    setElementEnEdition(item);
    setNom(item.nom || item.title || '');
    setMetadonne(item.metadonne || '');
    setClient(item.client || '');
    setType(item.type || 'spot');
    setDuration(String(item.duration ?? 30));
    setPricePerSec(String(item.price_per_sec ?? item.pricePerSec ?? 0));
    setBudget(String(item.budget ?? 0));
    setProgrammeid(item.programme_id || '');
    setEpisodeid(item.episode_id || '');
    setEnfantpercentage(String(item.enfantpercentage ?? item.pourcentages?.enfant ?? 0));
    setJeunepercentage(String(item.jeunepercentage ?? item.pourcentages?.jeune ?? 0));
    setGrandPercentage(String(item.grand_percentage ?? item.grandPercentage ?? item.pourcentages?.grand ?? 0));
    setModalOuverte(true);
  };

  // Gestion des calculs automatiques
  const handleDurationChange = (val) => {
    setDuration(val);
    const d = Number(val) || 0;
    const p = Number(pricePerSec) || 0;
    setBudget((d * p).toFixed(2));
  };

  const handlePricePerSecChange = (val) => {
    setPricePerSec(val);
    const d = Number(duration) || 0;
    const p = Number(val) || 0;
    setBudget((d * p).toFixed(2));
  };

  const handleBudgetChange = (val) => {
    setBudget(val);
    const b = Number(val) || 0;
    const d = Number(duration) || 1;
    if (d > 0) {
      setPricePerSec((b / d).toFixed(2));
    }
  };

  const handleEpisodeChange = (e) => {
    const selectedEpisodeId = e.target.value;
    setEpisodeid(selectedEpisodeId);

    if (selectedEpisodeId) {
      const epTrouve = episodes.find(ep => ep.id === selectedEpisodeId);
      if (epTrouve && epTrouve.programme_id) {
        setProgrammeid(epTrouve.programme_id);
      }
    }
  };

  const soumettreFormulaire = async (e) => {
    e.preventDefault();
    if (!nom.trim() || !planMediaId) return;

    setActionEnCours(true);
    
    const payload = {
      plan_media_id: planMediaId,
      nom: nom.trim(),
      metadonne: metadonne.trim(),
      client: client.trim(),
      price_per_sec: Number(pricePerSec) || 0,
      budget: Number(budget) || 0,
      type: type,
      episode_id: episodeid.trim() ? episodeid.trim() : null,
      programme_id: programmeid.trim() ? programmeid.trim() : null,
      enfantpercentage: Number(enfantpercentage) || 0,
      jeunepercentage: Number(jeunepercentage) || 0,
      grand_percentage: Number(grandPercentage) || 0,
      title: nom.trim(),
      duration: Number(duration) || 30, 
      pourcentages: {
        enfant: Number(enfantpercentage) || 0,
        jeune: Number(jeunepercentage) || 0,
        grand: Number(grandPercentage) || 0,
        budget: Number(budget) || 0,
      }
    };

    try {
      if (elementEnEdition) {
        // Mode Mise à Jour
        const elementMisAJour = await mettreAJourPlanMediaStock(elementEnEdition.id, payload);
        setStockAnnonces((prev) =>
          prev.map((item) => (item.id === elementEnEdition.id ? elementMisAJour : item))
        );
      } else {
        // Mode Création
        const nouvelleDonnee = {
          ...payload,
          date_debut: new Date().toISOString()
        };
        const elementCree = await creerPlanMediaStock(nouvelleDonnee);
        setStockAnnonces((prev) => [elementCree, ...prev]);
      }
      
      setModalOuverte(false);
      setElementEnEdition(null);
    } catch (erreur) {
      console.error("Erreur lors de l'enregistrement de l'annonce :", erreur);
    } finally {
      setActionEnCours(false);
    }
  };

  const supprimerDuStock = async (id) => {
    try {
      await supprimerPlanMediaStock(id);
      setStockAnnonces((prev) => prev.filter((item) => item.id !== id));
    } catch (erreur) {
      console.error("Erreur lors de la suppression de l'élément :", erreur);
    }
  };

  const stockFiltre = stockAnnonces.filter((item) =>
    (item.nom || item.title || '').toLowerCase().includes(rechercheAdmin.toLowerCase()) ||
    (item.type || '').toLowerCase().includes(rechercheAdmin.toLowerCase()) ||
    (item.client || '').toLowerCase().includes(rechercheAdmin.toLowerCase())
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 min-h-[500px] space-y-6">
      
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Administration — Stock d'annonces</h2>
          <p className="text-sm text-slate-500">Gérez le catalogue des annonces, leurs tarifs, budgets et répartitions de cibles.</p>
        </div>
        <button
          type="button"
          onClick={ouvrirModalAjout}
          className="flex items-center gap-1.5 rounded-md bg-snrt-navy px-3 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover transition-colors"
        >
          <Plus size={16} />
          Ajouter au stock
        </button>
      </div>

      <div className="relative max-w-md flex items-center">
        <Search size={16} className="absolute left-3 text-slate-400 pointer-events-none" />
        <input 
          type="text" 
          value={rechercheAdmin}
          onChange={(e) => setRechercheAdmin(e.target.value)}
          placeholder="Rechercher par nom, client ou type..." 
          className="w-full rounded-md border border-slate-200 py-2 pl-10 pr-3 text-sm text-slate-700 transition-colors focus:border-snrt-accent focus:outline-none focus:ring-1 focus:ring-snrt-accent"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
          <Database size={16} className="text-snrt-navy" />
          <span>Éléments enregistrés ({stockFiltre.length})</span>
        </div>

        {stockFiltre.length === 0 ? (
          <p className="text-sm text-slate-400 italic py-8 text-center">Aucun élément trouvé dans le stock.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {stockFiltre.map((item) => (
              <div 
                key={item.id} 
                className="flex flex-col justify-between rounded-md border border-slate-200 p-4 transition-colors hover:border-snrt-accent/50 bg-slate-50/50 gap-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded bg-snrt-navy/10 px-1.5 py-0.5 text-[10px] font-semibold text-snrt-navy capitalize">
                        {item.type}
                      </span>
                      {item.client && (
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                          Client: {item.client}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Bouton Modifier */}
                      <button
                        type="button"
                        onClick={() => ouvrirModalEdition(item)}
                        className="rounded-md border border-slate-200 p-1 text-slate-600 hover:bg-slate-100 transition-colors"
                        title="Modifier l'annonce"
                      >
                        <Edit3 size={14} />
                      </button>
                      {/* Bouton Supprimer */}
                      <button
                        type="button"
                        onClick={() => supprimerDuStock(item.id)}
                        className="rounded-md border border-red-200 p-1 text-red-600 hover:bg-red-50 transition-colors"
                        title="Supprimer du stock"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <h4 className="text-sm font-medium text-slate-800">{item.nom || item.title}</h4>
                  <span className="text-xs text-slate-400">Durée : {item.duration ?? 30}s</span>
                  {item.metadonne && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{item.metadonne}</p>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 border-t border-slate-200 pt-2">
                  <span>Prix/s: <strong>{item.price_per_sec ?? item.pricePerSec ?? 0} DH</strong></span>
                  <span>Budget: <strong>{item.budget ?? 0} DH</strong></span>
                </div>

                <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-200 text-center">
                  <div className="rounded bg-white p-1 border border-slate-100">
                    <span className="block text-[10px] text-slate-400">Enfant</span>
                    <span className="text-xs font-semibold text-slate-700">{item.enfantpercentage ?? item.pourcentages?.enfant}%</span>
                  </div>
                  <div className="rounded bg-white p-1 border border-slate-100">
                    <span className="block text-[10px] text-slate-400">Jeune</span>
                    <span className="text-xs font-semibold text-slate-700">{item.jeunepercentage ?? item.pourcentages?.jeune}%</span>
                  </div>
                  <div className="rounded bg-white p-1 border border-slate-100">
                    <span className="block text-[10px] text-slate-400">Grand</span>
                    <span className="text-xs font-semibold text-slate-700">{item.grand_percentage ?? item.grandPercentage ?? item.pourcentages?.grand}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOuverte && (
        <Modal 
          titre={elementEnEdition ? "Modifier l'annonce" : "Ajouter une annonce au stock"} 
          onFermer={() => { setModalOuverte(false); setElementEnEdition(null); }}
        >
          <form onSubmit={soumettreFormulaire} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Nom de l'annonce</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="ex. Spot Été"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-snrt-accent focus:outline-none focus:ring-1 focus:ring-snrt-accent"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Client</label>
                <input
                  type="text"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  placeholder="ex. Nom du client"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Métadonnée / Description</label>
              <textarea
                value={metadonne}
                onChange={(e) => setMetadonne(e.target.value)}
                placeholder="Détails supplémentaires..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm h-16"
              />
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm capitalize"
                >
                  <option value="spot">Spot</option>
                  <option value="bande danonce">Bande d'annonce</option>
                  <option value="ecrant publicitare">Écran publicitaire</option>
                  <option value="jingle">Jingle</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Durée (s)</label>
                <input
                  type="number"
                  min="1"
                  value={duration}
                  onChange={(e) => handleDurationChange(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Prix / s</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={pricePerSec}
                  onChange={(e) => handlePricePerSecChange(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Budget</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={budget}
                  onChange={(e) => handleBudgetChange(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
{/*
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Programme (Optionnel)</label>
                <select
                  value={programmeid}
                  onChange={(e) => setProgrammeid(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="">Sélectionner un programme...</option>
                  {programmes.map((prog) => (
                    <option key={prog.id} value={prog.id}>
                      {prog.titre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Épisode (Optionnel)</label>
                <select
                  value={episodeid}
                  onChange={handleEpisodeChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="">Sélectionner un épisode...</option>
                  {episodes
                    .filter(ep => !programmeid || ep.programme_id === programmeid)
                    .map((ep) => (
                      <option key={ep.id} value={ep.id}>
                        {ep.titre || `Épisode ${ep.numero || ''}`}
                      </option>
                    ))}
                </select>
              </div>
            </div>
*/}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Pourcentages de cibles (%)</label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-xs text-slate-500">Enfant (def: 0)</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={enfantpercentage}
                    onChange={(e) => setEnfantpercentage(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm text-center"
                  />
                </div>
                <div>
                  <span className="text-xs text-slate-500">Jeune</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={jeunepercentage}
                    onChange={(e) => setJeunepercentage(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm text-center"
                  />
                </div>
                <div>
                  <span className="text-xs text-slate-500">Grand</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={grandPercentage}
                    onChange={(e) => setGrandPercentage(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm text-center"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => { setModalOuverte(false); setElementEnEdition(null); }}
                disabled={actionEnCours}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={actionEnCours}
                className="rounded-md bg-snrt-navy px-4 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover"
              >
                {actionEnCours ? 'Enregistrement...' : elementEnEdition ? 'Mettre à jour' : 'Ajouter au stock'}
              </button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}