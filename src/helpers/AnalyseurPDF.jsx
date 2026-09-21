import React, { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { sauvegarderConducteur, listerConducteurs, supprimerConducteur } from '../lib/db.js';
// Configuration du worker 100% compatible avec VITE (via chargement local)
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
import { CheckCircle, Save, Trash2, FileText, Database } from 'lucide-react';
export default function AnalyseurPDF({ chaineActive }) {
    const [isReading, setIsReading] = useState(false);
    const [donneesExtraites, setDonneesExtraites] = useState([]);
    const [erreur, setErreur] = useState(null);

    // On stocke directement l'ID de la chaîne active
    const [infoFichier, setInfoFichier] = useState({
        date: new Date().toISOString().split('T')[0],
        chaine_id: chaineActive?.id || ''
    }); const [isSaving, setIsSaving] = useState(false);
    const [listeConducteurs, setListeConducteurs] = useState([]);

    // NOUVEAU : Permet de savoir si on regarde un fichier de la base ou un nouveau PDF
    const [conducteurActifId, setConducteurActifId] = useState(null);

    useEffect(() => {
        if (chaineActive?.id) {
            chargerHistorique(chaineActive.id); // On passe l'ID
        }
    }, [chaineActive]);

    const chargerHistorique = async () => {
        try {
            const data = await listerConducteurs(chaineActive.id);
            setListeConducteurs(data || []);
        } catch (error) {
            console.error("Erreur lors du chargement de l'historique", error);
        }
    };
    // Calcule la somme de tous les spots d'un conducteur
    const calculerTotalSpots = (donnees) => {
        if (!donnees) return 0;
        return donnees.reduce((total, bloc) => total + (bloc.nb_spots || 0), 0);
    };

    // Calcule la durée totale (additionne les MM:SS)
    const calculerDureeTotale = (donnees) => {
        if (!donnees) return "00:00";
        const totalSecondes = donnees.reduce((total, bloc) => {
            if (!bloc.duree) return total;
            // Gère le format "00:47" ou "00:47"
            const cleanDuree = bloc.duree.replace(/[^0-9:]/g, '');
            const [minutes, secondes] = cleanDuree.split(':').map(Number);
            return total + ((minutes || 0) * 60) + (secondes || 0);
        }, 0);

        const mins = Math.floor(totalSecondes / 60);
        const secs = totalSecondes % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    const analyserConducteurPDF = (texteBrut) => {
        // Nettoyage des sauts de ligne pour éviter les cassures de mots
        const txt = texteBrut.replace(/\s+/g, ' ');

        const ecrans = [...txt.matchAll(/Ecran[^\d]+(\d{2}[:hH]\d{2})/gi)].map(m => m[1]);
        const heures = [...txt.matchAll(/Heure[^\d]+(\d{2}[:hH]\d{2}[:hH]\d{2})/gi)].map(m => m[1]);
        const contextes = [...txt.matchAll(/Contexte[^\w]+(.*?)(?=Nb de spots)/gi)].map(m => m[1].trim());
        const spots = [...txt.matchAll(/Nb de spots[^\d]+(\d+)/gi)].map(m => parseInt(m[1]));

        // 🎯 LA CORRECTION EST ICI : 
        // On exclut "Durée Tranche" pour ne garder QUE la vraie "Durée" finale
        const durees = [...txt.matchAll(/Dur[éèe]e(?!\s*Tranche)[^\d]+(\d{2}[:hH]\d{2})/gi)].map(m => m[1]);

        const planifications = [];
        const nbLignes = Math.max(ecrans.length, heures.length, contextes.length);

        for (let i = 0; i < nbLignes; i++) {
            planifications.push({
                id: `pdf_ecran_${i + 1}`,
                ecran: ecrans[i] || 'N/C',
                heure_prev: heures[i] || '00:00:00',
                contexte: contextes[i] || 'Sans contexte',
                nb_spots: spots[i] || 0,
                // Grâce à la correction, durees[i] correspondra parfaitement à l'écran i
                duree: durees[i] || '00:00'
            });
        }

        return planifications;
    };
    const handleFileUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file || file.type !== 'application/pdf') {
            setErreur("Veuillez sélectionner un fichier PDF valide.");
            return;
        }

        const nomFichier = file.name;
        const segments = nomFichier.split('_');
        let dateDetectee = new Date().toISOString().split('T')[0];

        if (segments.length >= 2) {
            const d = segments[0];
            if (d.length === 8 && !isNaN(d)) {
                dateDetectee = `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`;
            }
        }

        setInfoFichier({ date: dateDetectee, chaine_id: chaineActive?.id }); setIsReading(true);
        setErreur(null);
        setDonneesExtraites([]);
        setConducteurActifId(null); // On réinitialise l'état car c'est un NOUVEAU fichier

        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const typedarray = new Uint8Array(e.target.result);
                const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;

                let texteComplet = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const textePage = textContent.items.map(item => item.str).join(' ');
                    texteComplet += textePage + ' ';
                }

                const donneesStructurees = analyserConducteurPDF(texteComplet);
                setDonneesExtraites(donneesStructurees);

            } catch (error) {
                setErreur("Impossible de lire ce PDF. Le format n'est peut-être pas supporté.");
            } finally {
                setIsReading(false);
            }
        };

        reader.readAsArrayBuffer(file);
    };

    const gererSauvegarde = async (e) => {
        e.preventDefault();
        if (!infoFichier.date || !infoFichier.chaine_id || donneesExtraites.length === 0) return;

        setIsSaving(true);
        try {
            await sauvegarderConducteur(infoFichier.date, infoFichier.chaine_id, donneesExtraites);

            setDonneesExtraites([]);
            setInfoFichier({ date: new Date().toISOString().split('T')[0], chaine: '' });

            await chargerHistorique();

        } catch (error) {
            alert("Erreur lors de la sauvegarde du conducteur.");
        } finally {
            setIsSaving(false);
        }
    };

    const gererSuppression = async (id) => {
        if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce conducteur ?")) return;

        try {
            await supprimerConducteur(id);
            if (conducteurActifId === id) {
                // Si on regardait le fichier qu'on vient de supprimer, on vide l'écran
                setDonneesExtraites([]);
                setConducteurActifId(null);
            }
            await chargerHistorique();
        } catch (error) {
            alert("Erreur lors de la suppression.");
        }
    };

    // NOUVEAU : Affiche les données du conducteur cliqué
    const afficherDetailsConducteur = (conducteur) => {
        setDonneesExtraites(conducteur.donnees || []);
        setInfoFichier({ date: conducteur.date, chaine: conducteur.chaine_id });
        setConducteurActifId(conducteur.id);
        setErreur(null);
    };

    return (
        <div className="p-3 bg-white rounded-xl  mx-auto mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* COLONNE GAUCHE */}
            <div className="lg:col-span-2">
                <div className="mb-6 border-b border-slate-100 pb-4">
                    <h2 className="text-xl font-bold text-[#5C5C5C] flex items-center gap-2">
                        <FileText size={24} /> Importation Conducteur PDF
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Sélectionnez un PDF ou consultez un historique à droite.</p>
                </div>

                <div className="mb-6">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <FileText className="w-8 h-8 mb-3 text-slate-400" />
                            <p className="mb-2 text-sm text-slate-500"><span className="font-semibold">Cliquez pour uploader</span> ou glissez un nouveau PDF</p>
                        </div>
                        <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} />
                    </label>
                </div>

                {isReading && (
                    <div className="flex items-center justify-center gap-2 text-emerald-600 mb-6 p-4 bg-emerald-50 rounded-lg">
                        <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm font-medium">Lecture et extraction en cours...</span>
                    </div>
                )}

                {erreur && (
                    <div className="mb-6 p-4 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg">
                        {erreur}
                    </div>
                )}

                {donneesExtraites.length > 0 && (
                    <div className="mt-6 animate-in fade-in duration-300">

                        <form onSubmit={gererSauvegarde} className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-end gap-4 shadow-sm">
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Date de diffusion</label>
                                <input
                                    type="date"
                                    required
                                    disabled={true}
                                    value={infoFichier.date}
                                    onChange={(e) => setInfoFichier({ ...infoFichier, date: e.target.value })}
                                    className="w-full text-sm border border-slate-300 rounded-md py-2 px-3 disabled:bg-slate-100"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Chaîne</label>
                                <div className="w-full text-sm border border-slate-200 bg-slate-100 text-slate-600 rounded-md py-2 px-3 uppercase font-medium">
                                    {chaineActive?.nom || 'Chaîne inconnue'}
                                </div>
                            </div>

                            {/* Changement du bouton si on est en mode "Consultation" */}
                            {conducteurActifId ? (
                                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-md font-medium text-sm">
                                    <CheckCircle size={16} /> Sauvegardé
                                </div>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex items-center gap-2 bg-[#243c54] hover:bg-slate-800 text-white px-5 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50"
                                >
                                    <Save size={16} /> {isSaving ? '...' : 'Sauvegarder'}
                                </button>
                            )}
                        </form>

                        <h3 className="text-sm font-bold text-[#5C5C5C] mb-3 flex items-center justify-between">
                            <span>{conducteurActifId ? "Aperçu de l'archive" : "Aperçu de l'extraction"}</span>
                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs border border-slate-200">
                                {donneesExtraites.length} écrans
                            </span>
                        </h3>

                        <div className="overflow-x-auto border border-slate-200 rounded-lg" style={{maxHeight:"230px",overflow:"auto"}}>
                            <table className="w-full text-sm text-left text-slate-600">
                                <thead className="text-xs text-slate-600 uppercase bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3">Heure - Ecran</th>
                                        <th className="px-4 py-3">Contexte (Programme ciblé)</th>
                                        <th className="px-4 py-3 text-center">Spots</th>
                                        <th className="px-4 py-3 text-right">Durée</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100" >
                                    {donneesExtraites.map((bloc) => (
                                        <tr key={bloc.id} className="bg-white hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs">{bloc.heure_prev} - {bloc.ecran}</td>
                                            <td className="px-4 py-3 font-medium text-[#5C5C5C]">{bloc.contexte}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="bg-indigo-50 text-indigo-700 py-0.5 px-2 rounded-full text-xs font-bold">{bloc.nb_spots}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-xs text-slate-500">{bloc.duree}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* COLONNE DROITE : HISTORIQUE */}
            <div className="border-l border-slate-200 pl-8 flex flex-col " style={{maxHeight:"630px",overflow:"auto"}}>
                <div className="mb-4 border-b border-slate-100 pb-4">
                    <h2 className="text-lg font-bold text-[#5C5C5C] flex items-center gap-2">
                        <Database size={20} /> Base de données
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1" >
                    {listeConducteurs.length === 0 ? (
                        <p className="text-sm text-slate-400 italic text-center mt-10">Aucun conducteur enregistré.</p>
                    ) : (
                        listeConducteurs.map(conducteur => (
                            <div
                                key={conducteur.id}
                                onClick={() => afficherDetailsConducteur(conducteur)}
                                className={`p-3 bg-white border rounded-lg shadow-sm group transition-colors cursor-pointer 
        ${conducteurActifId === conducteur.id
                                        ? 'border-emerald-500 ring-1 ring-emerald-500'
                                        : 'border-slate-200 hover:border-slate-300'}`}
                            >
                                <div className="flex justify-between items-start">
                                    <div>

                                        {/* Date formatée */}
                                        <div className="text-xs text-slate-500 mt-0.5 font-mono">
                                         conducteur - {new Date(conducteur.date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                                        </div>
                                    </div>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation(); // ⚠️ Empêche le clic d'ouvrir le conducteur
                                            gererSuppression(conducteur.id);
                                        }}
                                        className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-1.5 rounded transition-colors"
                                        title="Supprimer ce conducteur"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                {/* Badges de statistiques alignés */}
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <div className="text-[11px] font-medium text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                        <span className="font-bold text-[#243c54]">{conducteur.donnees?.length || 0}</span> écrans
                                    </div>

                                    <div className="text-[11px] font-medium text-slate-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                                        <span className="font-bold text-indigo-700">{calculerTotalSpots(conducteur.donnees)}</span> spots
                                    </div>

                                    <div className="text-[11px] font-medium text-slate-600 bg-amber-50 px-2 py-1 rounded border border-amber-100">
                                        ⏱ <span className="font-bold text-amber-700">{calculerDureeTotale(conducteur.donnees)}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}