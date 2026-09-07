import { useState } from 'react';
import { Settings, Plus, Trash2, Database, Search } from 'lucide-react';
import Modal from '../components/Modal.jsx';

export default function PlanMediaAdministration({ chaineId, stockAnnonces, setStockAnnonces }) {
    const [modalOuverte, setModalOuverte] = useState(false);
    const [rechercheAdmin, setRechercheAdmin] = useState('');

    // Champs du formulaire d'insertion de stock basés sur la structure exacte de la table
    const [nom, setNom] = useState('');
    const [metadonne, setMetadonne] = useState('');
    const [client, setClient] = useState('');
    const [pricePerSec, setPricePerSec] = useState('0');
    const [budget, setBudget] = useState('0');
    const [type, setType] = useState('spot');
    const [episodeid, setEpisodeid] = useState('');
    const [programmeid, setProgrammeid] = useState('');

    // Pourcentages de cibles
    const [enfantpercentage, setEnfantpercentage] = useState('0');
    const [jeunepercentage, setJeunepercentage] = useState('0');
    const [grandPercentage, setGrandPercentage] = useState('0');

    const insererAnnonceStock = (e) => {
        e.preventDefault();
        if (!nom.trim()) return;

        const nouvelleEntree = {
            id: Date.now(),
            nom: nom.trim(),
            metadonne: metadonne.trim(),
            client: client.trim(),
            pricePerSec: Number(pricePerSec) || 0,
            budget: Number(budget) || 0,
            type: type,
            episodeid: episodeid ? Number(episodeid) : null,
            programmeid: programmeid ? Number(programmeid) : null,
            enfantpercentage: Number(enfantpercentage) || 0,
            jeunepercentage: Number(jeunepercentage) || 0,
            grandPercentage: Number(grandPercentage) || 0,
            // Propriétés de compatibilité pour l'affichage dans la liste principale si besoin
            title: nom.trim(),
            duration: '30s',
            pourcentages: {
                enfant: Number(enfantpercentage) || 0,
                jeune: Number(jeunepercentage) || 0,
                grand: Number(grandPercentage) || 0,
                budget: Number(budget) || 0,
            }
        };

        setStockAnnonces((prev) => [...prev, nouvelleEntree]);

        // Réinitialisation du formulaire
        setNom('');
        setMetadonne('');
        setClient('');
        setPricePerSec('0');
        setBudget('0');
        setType('spot');
        setEpisodeid('');
        setProgrammeid('');
        setEnfantpercentage('0');
        setJeunepercentage('0');
        setGrandPercentage('0');
        setModalOuverte(false);
    };

    const supprimerDuStock = (id) => {
        setStockAnnonces((prev) => prev.filter((item) => item.id !== id));
    };

    // Filtrage du stock selon la recherche
    const stockFiltre = stockAnnonces.filter((item) =>
        (item.nom || item.title || '').toLowerCase().includes(rechercheAdmin.toLowerCase()) ||
        (item.type || '').toLowerCase().includes(rechercheAdmin.toLowerCase()) ||
        (item.client || '').toLowerCase().includes(rechercheAdmin.toLowerCase())
    );

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-6 min-h-[500px] space-y-6">

            {/* En-tête de l'administration */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                    <h2 className="text-base font-semibold text-slate-800">Administration — Stock d'annonces</h2>
                    <p className="text-sm text-slate-500">Gérez le catalogue des annonces, leurs tarifs, budgets et répartitions de cibles.</p>
                </div>
                <button
                    type="button"
                    onClick={() => setModalOuverte(true)}
                    className="flex items-center gap-1.5 rounded-md bg-snrt-navy px-3 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover transition-colors"
                >
                    <Plus size={16} />
                    Ajouter au stock
                </button>
            </div>




            {/* Barre de recherche de la liste */}
            <div className="relative mb-4 shrink-0">
                <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    value={rechercheAdmin}
                    onChange={(e) => setRechercheAdmin(e.target.value)}
                    placeholder="Rechercher dans la liste..."
                    className="w-full rounded-md border border-slate-200 py-1.5 pl-8 pr-3 text-xs text-slate-700 transition-colors focus:border-snrt-accent focus:outline-none focus:ring-1 focus:ring-snrt-accent"
                />
            </div>



            {/* Liste du stock d'annonces */}
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
                                        <button
                                            type="button"
                                            onClick={() => supprimerDuStock(item.id)}
                                            className="rounded-md border border-red-200 p-1 text-red-600 hover:bg-red-50 transition-colors"
                                            title="Supprimer du stock"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <h4 className="text-sm font-medium text-slate-800">{item.nom || item.title}</h4>
                                    {item.metadonne && (
                                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">{item.metadonne}</p>
                                    )}
                                </div>

                                <div className="flex items-center justify-between text-xs text-slate-600 border-t border-slate-200 pt-2">
                                    <span>Prix/s: <strong>{item.pricePerSec ?? item.price_per_s ?? 0} DH</strong></span>
                                    <span>Budget: <strong>{item.budget ?? 0} DH</strong></span>
                                </div>

                                {/* Affichage des pourcentages par cible */}
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
                                        <span className="text-xs font-semibold text-slate-700">{item.grandPercentage ?? item.grandpercentage ?? item.pourcentages?.grand}%</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modale avec formulaire d'insertion de stock complet */}
            {modalOuverte && (
                <Modal titre="Ajouter une annonce au stock" onFermer={() => setModalOuverte(false)} >
                    <form onSubmit={insererAnnonceStock} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1" style={{padding:"10px"}}>

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

                        <div className="grid grid-cols-3 gap-3">
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
                                <label className="mb-1 block text-sm font-medium text-slate-700">Prix / s</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={pricePerSec}
                                    onChange={(e) => setPricePerSec(e.target.value)}
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
                                    onChange={(e) => setBudget(e.target.value)}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">ID Épisode (Optionnel)</label>
                                <input
                                    type="number"
                                    value={episodeid}
                                    onChange={(e) => setEpisodeid(e.target.value)}
                                    placeholder="null"
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">ID Programme (Optionnel)</label>
                                <input
                                    type="number"
                                    value={programmeid}
                                    onChange={(e) => setProgrammeid(e.target.value)}
                                    placeholder="null"
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                />
                            </div>
                        </div>

                        {/* Saisie des pourcentages par cible */}
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
                                onClick={() => setModalOuverte(false)}
                                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                className="rounded-md bg-snrt-navy px-4 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover"
                            >
                                Ajouter au stock
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

        </div>
    );
}