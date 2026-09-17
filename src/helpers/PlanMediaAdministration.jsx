import { useState } from 'react';
import { Settings, Plus, Trash2, Edit3, Database, Search } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import { creerPlanMediaStock, data_annonce_refrech, mettreAJourPlanMediaStock, supprimerPlanMediaStock } from '../lib/db.js';
import { MdCloudSync } from "react-icons/md";
import toast from 'react-hot-toast';

export default function PlanMediaAdministration({ planMediaId, stockAnnonces, setStockAnnonces, programmes = [], episodes = [], setdatachanged, datachanged, setIsLoading }) {
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

  // NOUVEAUX CHAMPS
  const [validiteDebut, setValiditeDebut] = useState('');
  const [validiteFin, setValiditeFin] = useState('');
  const [isPad, setIsPad] = useState(false);

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
    setValiditeDebut('');
    setValiditeFin('');
    setIsPad(false);
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

    // FORMATAGE DES DATES POUR L'INPUT type="datetime-local" (ou type="date")
    // Note: Si validite_debut contient une heure (timestamptz), on gère ici pour un input simple (Date uniquement ou Date+Time)
    // Pour simplifier on va utiliser un input type="date" donc on coupe à 10 caractères (YYYY-MM-DD)
    setValiditeDebut(item.validite_debut ? String(item.validite_debut).substring(0, 10) : '');
    setValiditeFin(item.validite_fin ? String(item.validite_fin).substring(0, 10) : '');
    setIsPad(item.PAD ?? false);

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

    if (!nom.trim() || !planMediaId) {
      toast.error("Le nom de l'annonce est requis.");
      return;
    }

    // ==========================================
    // VALIDATIONS DES DONNÉES
    // ==========================================

    // 1. Validation des pourcentages
    const totalPourcentages = Number(enfantpercentage) + Number(jeunepercentage) + Number(grandPercentage);
    if (totalPourcentages !== 100) {
      toast.error(`La somme des cibles est de ${totalPourcentages}%. Elle doit etre 100%.`);
      return; // Bloque la soumission
    }

    // 2. Validation des dates de validité
    if (validiteDebut && validiteFin) {
      const dateDebut = new Date(validiteDebut);
      const dateFin = new Date(validiteFin);
      if (dateDebut > dateFin) {
        toast.error("La date de fin de validité ne peut pas être antérieure à la date de début.");
        return; // Bloque la soumission
      }
    }

    // ==========================================

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
      validite_debut: validiteDebut ? new Date(validiteDebut).toISOString() : null,
      validite_fin: validiteFin ? new Date(validiteFin).toISOString() : null,
      PAD: isPad,
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
        toast.success("Annonce mise à jour avec succès.");
      } else {
        // Mode Création
        const nouvelleDonnee = {
          ...payload,
          date_debut: new Date().toISOString()
        };
        const elementCree = await creerPlanMediaStock(nouvelleDonnee);
        setStockAnnonces((prev) => [elementCree, ...prev]);
        toast.success("Annonce ajoutée au stock.");
      }

      setModalOuverte(false);
      setElementEnEdition(null);
    } catch (erreur) {
      console.error("Erreur lors de l'enregistrement de l'annonce :", erreur);
      toast.error("Une erreur est survenue lors de l'enregistrement.");
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
    <div className="rounded-lg border border-slate-300 bg-white p-6 min-h-[500px] space-y-6">

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-300 pb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Stock d'annonces</h2>
          <p className="text-sm text-slate-500">Gérez le catalogue des annonces, leurs tarifs, budgets et répartitions de cibles.</p>
        </div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px" }} >
          <button
            type="button"
            onClick={ouvrirModalAjout}
            className="flex items-center gap-1.5 rounded-md bg-snrt-navy px-3 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover transition-colors"
          >
            <Plus size={16} />
            Ajouter au stock
          </button>



        </div>
      </div>

      <div className="relative max-w-md flex items-center">
        <Search size={16} className="absolute left-3 text-slate-500 pointer-events-none" />
        <input
          type="text"
          value={rechercheAdmin}
          onChange={(e) => setRechercheAdmin(e.target.value)}
          placeholder="Rechercher par nom, client ou type..."
          className="w-full rounded-md border border-slate-300 py-2 pl-10 pr-3 text-sm text-slate-700 transition-colors focus:border-snrt-accent focus:outline-none focus:ring-1 focus:ring-snrt-accent"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
          <Database size={16} className="text-snrt-navy" />
          <span>Éléments enregistrés ({stockFiltre.length})</span>
        </div>

        {stockFiltre.length === 0 ? (
          <p className="text-sm text-slate-500 italic py-8 text-center">Aucun élément trouvé dans le stock.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {stockFiltre.map((item) => (
              <div
                key={item.id}
                className="
        group
        flex items-center gap-1
        min-h-[40px]
        rounded-md
        border border-slate-300
        bg-white
        px-2 py-1
        transition-all duration-150
        hover:border-snrt-accent/30
        hover:bg-slate-50/50
        hover:shadow-sm
      "
              >
                {/* Type & PAD */}
                <div className="w-[85px] shrink-0">
                  <div className="flex items-center gap-1">
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
                      <span className="text-[9px] font-bold text-green-600 bg-green-100 rounded px-1" title="Prêt à diffuser">PAD</span>
                    )}

                    {!item.PAD && (
                      <span className="text-[9px] font-bold  rounded px-1
            text-red-600 bg-red-100
            " title="Prêt à diffuser">NO PAD</span>




                    )}
                  </div>


                  {item.client && (
                    <div
                      className="mt-0.5 max-w-[80px] truncate text-[9px] text-slate-500"
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
              text-[12px] font-semibold
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

                  <div className="flex items-center gap-2 mt-0.5">
                    {item.metadonne && (
                      <p
                        className="truncate text-[9px] text-slate-500"
                        title={item.metadonne}
                      >
                        {item.metadonne}
                      </p>
                    )}

                  </div>
                </div>
                <div className="hidden w-[180px] shrink-0 sm:block">
                  <div className="text-[9px] uppercase tracking-wide text-slate-500">
                    {/* Affichage des dates de validité */}
                    {(item.validite_debut || item.validite_fin) && (
                      <span className="text-[9px] text-slate-500 bg-slate-50 px-1 rounded border border-slate-300">
                        Validité: {item.validite_debut ? new Date(item.validite_debut).toLocaleDateString() : '...'} au {item.validite_fin ? new Date(item.validite_fin).toLocaleDateString() : '...'}
                      </span>
                    )}
                  </div>
                </div>
                {/* Price */}
                <div className="hidden w-[75px] shrink-0 sm:block">
                  <div className="text-[9px] uppercase tracking-wide text-slate-500">
                    Prix/s
                  </div>
                  <div className="text-[11px] font-semibold text-slate-600">
                    {item.price_per_sec ?? item.pricePerSec ?? 0} DH
                  </div>
                </div>

                {/* Budget */}
                <div className="hidden w-[75px] shrink-0 md:block">
                  <div className="text-[9px] uppercase tracking-wide text-slate-500">
                    Budget
                  </div>
                  <div className="text-[11px] font-semibold text-slate-600">
                    {item.budget ?? 0} DH
                  </div>
                </div>

                {/* Audience */}
                <div className="hidden w-[150px] shrink-0 lg:flex items-center gap-1">
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
                    G {item.grand_percentage ??
                      item.grandPercentage ??
                      item.pourcentages?.grand ??
                      0}%
                  </span>
                </div>

                {/* Actions */}
                <div
                  className="
          flex shrink-0 items-center gap-1
          border-l border-slate-300
          pl-2
        "
                >
                  <button
                    type="button"
                    onClick={() => ouvrirModalEdition(item)}
                    className="
            flex h-6 w-6
            items-center justify-center
            rounded
            text-slate-500
            transition-colors
            hover:bg-snrt-accent/10
            hover:text-snrt-navy
          "
                    title="Modifier l'annonce"
                  >
                    <Edit3 size={12} />
                  </button>

                  <button
                    type="button"
                    onClick={() => supprimerDuStock(item.id)}
                    className="
            flex h-6 w-6
            items-center justify-center
            rounded
            text-slate-500
            transition-colors
            hover:bg-red-50
            hover:text-red-600
          "
                    title="Supprimer du stock"
                  >
                    <Trash2 size={12} />
                  </button>
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

            {/* NOUVEAUX CHAMPS : VALIDITE ET PAD */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Début de validité</label>
                <input
                  type="date"
                  value={validiteDebut}
                  onChange={(e) => setValiditeDebut(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Fin de validité</label>
                <input
                  type="date"
                  value={validiteFin}
                  onChange={(e) => setValiditeFin(e.target.value)}
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

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Pourcentages de cibles (%)</label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-xs text-slate-500">Enfant </span>
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

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-300">
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