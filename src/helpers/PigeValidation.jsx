import React, { useState, useMemo, useEffect } from 'react';
import { BarChart3,MonitorPlay, Activity, X, Upload, Trash2, FileSpreadsheet, AlertCircle, CheckCircle, Clock, ZoomIn, ZoomOut, Database } from 'lucide-react';
import { Megaphone } from 'lucide-react';

import * as XLSX from 'xlsx';
import {sauvegarderPigeEnBase, chargerHistoriquePiges, handleDeletePige, chargerPigeDetail } from '../lib/db.js';
// --- UTILITAIRES DE TEMPS ---



const timeToSec = (time) => {
    if (!time) return 0;
    // Gère les formats "HH:MM:SS"
    const parts = time.toString().split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60;
    return 0;
};

const secToTime = (sec) => {

    const totalHours = Math.floor(sec / 3600);
    const days = Math.floor(totalHours / 24); // Calcule si on a changé de jour

    const h = (totalHours % 24).toString().padStart(2, '0');
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    if (days > 0) {
        return `${h}:${m}:${s} (J+${days})`;
    }

    return `${h}:${m}:${s}`;
};



// --- PLANIFICATION THÉORIQUE (Ce qui est censé passer à l'antenne) ---
const mockPlanifie = [
    { id: 'p1', nom: 'AUTO PROMOTION', debut: '03:15:00', duree: 30 }, // Sera en retard de 37s (selon votre Excel)
    { id: 'p2', nom: 'FORJA MOBILE', debut: '03:16:46', duree: 39 },   // Match parfait
    { id: 'p3', nom: 'SPOT METEO', debut: '03:20:00', duree: 15 },     // Sera omis (n'existe pas dans la pige)
    { id: 'p4', nom: 'JINGLE PUB', debut: '14:00:00', duree: 5 },
];


// --- PLANIFICATION THÉORIQUE DES PROGRAMMES ---
const mockPlanifieProgrammes = [
    { id: 'prog_1', nom: 'JOURNAL DE 12H', debut: '12:00:00', duree: 1800 }, // 30 min
    { id: 'prog_2', nom: 'JT SPORT', debut: '12:30:00', duree: 900 },      // 15 min
    { id: 'prog_3', nom: 'JT METEO', debut: '12:45:00', duree: 300 },      // 5 min
    { id: 'prog_4', nom: 'DOCUMENTAIRE', debut: '13:00:00', duree: 3600 }, // 1 heure
];
export default function PigeValidation({ events, chaineId, setVuePrincipale }) {
    // États de base

    const [historique, setHistorique] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [fichierPige, setFichierPige] = useState(null);
    const [etape, setEtape] = useState('upload');
    const [page, setPage] = useState("annonce");
    const [rawData, setRawData] = useState([]);



    // NOUVEAU : On stocke uniquement l'extraction brute de l'Excel


    // États de Visualisation
    const [zoomCenterSec, setZoomCenterSec] = useState(timeToSec('03:15:00'));
    const [macroZoom, setMacroZoom] = useState(1);


    const ZOOM_WINDOW_SEC = page === 'annonce' ? 300 : 7200;
    const zoomStart = Math.max(0, zoomCenterSec - (ZOOM_WINDOW_SEC / 2));
    const zoomEnd = Math.min(115200, zoomCenterSec + (ZOOM_WINDOW_SEC / 2)); // Limite à 32h

    // --- EXTRACTION ET SÉPARATION DES VRAIES DONNÉES (PROPS) ---
    const { planAnnonces, planProgrammes } = useMemo(() => {

        if (!events || events.length === 0) {
            return { planAnnonces: [], planProgrammes: [] };
        }

        // Fonction pour convertir les durées textuelles ("30s", "45 min", "00:30:00") en secondes
        const parseDuree = (dureeStr) => {
            if (!dureeStr) return 30;
            const str = String(dureeStr).toLowerCase();
            if (str.includes('s')) return parseInt(str) || 30;
            if (str.includes('min')) return (parseInt(str) || 30) * 60;
            if (str.includes(':')) return timeToSec(str);
            return parseInt(str) || 30;
        };

        const formatEvent = (evt, index) => {
            const heurePropre = evt.time && evt.time.length === 5 ? `${evt.time}:00` : (evt.time || '00:00:00');
            return {
                id: evt.id || `evt_${index}`,
                nom: evt.name || 'Sans nom',
                debut: heurePropre,
                duree: parseDuree(evt.details?.duree)
            };
        };

        // Séparation selon vos types exacts :
        // - Programmes & Épisodes
        const programmesBruts = events.filter(evt =>
            evt.details?.type === 'Programme' || evt.details?.type === 'Épisode'
        );

        // - Annonces (spot, pub, auto promotion, etc.)
        const annoncesBrutes = events.filter(evt =>
            evt.details?.type !== 'Programme' && evt.details?.type !== 'Épisode'
        );

        return {
            planAnnonces: annoncesBrutes.map(formatEvent),
            planProgrammes: programmesBruts.map(formatEvent)
        };
    }, [events]);
    const { donneesPige, listeAnomalies, statsAnomalies, activePlan } = useMemo(() => {


        const planRef = page === 'annonce' ? planAnnonces : planProgrammes;

        if (rawData.length === 0) return { donneesPige: [], listeAnomalies: [], statsAnomalies: 0, activePlan: planRef };
        // 1. Filtrage brut selon la vue active
        const brutes = rawData.filter(row => {
            if (page === 'annonce') {
                return row['Programme'] === 'AUTO PROMOTION' || row['Genre Niv.2'] === 'AUTO PROMOTION' || row['Genre Niv.1'] === 'DIVERS';
            } else {
                return row['Programme'] && row['Programme'] !== 'AUTO PROMOTION' && row['Genre Niv.2'] !== 'AUTO PROMOTION';
            }
        }).map((row, index) => ({
            id: `${page}_${index}`,
            nom: row['Programme'] || (page === 'annonce' ? 'AUTO PROMO' : 'Programme'),
            debut: row['H.Début'],
            duree: timeToSec(row['Durée'] || (page === 'annonce' ? '00:00:30' : '00:30:00')),
            status: 'ghost',
            matchedPlanId: null
        }));

        // 2. Réconciliation
        let anomaliesCount = 0;
        const anomaliesList = [];
        const toleranceRecherche = page === 'annonce' ? 300 : 2700;
        const pigeAnalysee = brutes.map(spotReel => {
            const secReel = timeToSec(spotReel.debut);
            const spotPrevu = planRef.find(prevu => Math.abs(timeToSec(prevu.debut) - secReel) <= toleranceRecherche);
            if (spotPrevu) {
                const secPrevu = timeToSec(spotPrevu.debut);
                if (secPrevu === secReel) {
                    return { ...spotReel, status: 'match', matchedPlanId: spotPrevu.id };
                } else {
                    anomaliesCount++;
                    anomaliesList.push({ type: 'Retard', detail: spotReel, prevu: spotPrevu, time: secReel, ecart: secReel - secPrevu });
                    return { ...spotReel, status: 'delay', matchedPlanId: spotPrevu.id };
                }
            }
            anomaliesCount++;
            anomaliesList.push({ type: 'Fantôme', detail: spotReel, time: secReel });
            return spotReel;
        });

        // 3. Omissions
        planRef.forEach(prevu => {
            if (!pigeAnalysee.some(reel => reel.matchedPlanId === prevu.id)) {
                anomaliesCount++;
                anomaliesList.push({ type: 'Omission', detail: prevu, time: timeToSec(prevu.debut) });
            }
        });

        anomaliesList.sort((a, b) => a.time - b.time);

        return { donneesPige: pigeAnalysee, listeAnomalies: anomaliesList, statsAnomalies: anomaliesCount, activePlan: planRef };
    }, [rawData, page, events]);

    const [showManager, setShowManager] = useState(true);

    useEffect(() => {
        if (listeAnomalies.length > 0) {
            setZoomCenterSec(listeAnomalies[0].time);
        }
    }, [page, listeAnomalies.length]);

    useEffect(() => {
        const initHistory = async () => {
            const data = await chargerHistoriquePiges();
            if (data) setHistorique(data);
        };
        initHistory();
    }, []);

    // --- CALCUL DES STATISTIQUES GLOBALES POUR LE DASHBOARD ---
    // --- CALCUL DES STATISTIQUES AVANCÉES (GROUPÉES) ---
    const dashboardStats = useMemo(() => {
        if (!rawData || rawData.length === 0) return null;

        // 1. Séparation des données brutes Excel selon vos critères
        const annoncesReelles = rawData.filter(row => row['Programme'] === 'AUTO PROMOTION' || row['Genre Niv.2'] === 'AUTO PROMOTION');
        const progsReels = rawData.filter(row => row['Programme'] && row['Programme'] !== 'AUTO PROMOTION');

        // 2. Fonction d'analyse universelle pour un groupe donné
        const analyserGroupe = (typeDataReel, planRef, toleranceSec) => {
            let nbOmissions = 0, nbRetards = 0, nbFantomes = 0;

            const analysees = typeDataReel.map(spotReel => {
                // Adaptez 'debut' ou 'Heure' selon le nom de la colonne dans votre Excel
                const secReel = timeToSec(spotReel.debut || spotReel.Heure || spotReel.heure || '00:00:00');
                const spotPrevu = planRef.find(prevu => Math.abs(timeToSec(prevu.debut) - secReel) <= toleranceSec);

                if (spotPrevu) {
                    if (timeToSec(spotPrevu.debut) !== secReel) nbRetards++;
                    return { ...spotReel, matchedPlanId: spotPrevu.id };
                }
                nbFantomes++;
                return spotReel;
            });

            planRef.forEach(prevu => {
                if (!analysees.some(reel => reel.matchedPlanId === prevu.id)) nbOmissions++;
            });

            const totalPrevu = planRef.length;
            const totalReel = typeDataReel.length;
            const totalErreurs = nbOmissions + nbRetards + nbFantomes;

            // Calcul du taux de conformité (Pénalise toutes les erreurs)
            const baseCalcul = totalPrevu > 0 ? totalPrevu + nbFantomes : 1;
            const tauxReussite = totalPrevu === 0 && totalReel === 0 ? 100 : Math.max(0, 100 - ((totalErreurs / baseCalcul) * 100));

            return { totalPrevu, totalReel, nbOmissions, nbRetards, nbFantomes, totalErreurs, tauxReussite: tauxReussite.toFixed(1) };
        };

        // 3. Application avec vos tolérances (300s pour annonces, 2700s pour programmes)
        const statsAnnonces = analyserGroupe(annoncesReelles, planAnnonces, 300);
        const statsProgrammes = analyserGroupe(progsReels, planProgrammes, 2700);

        // 4. Consolidation Globale
        const totalPrevu = statsAnnonces.totalPrevu + statsProgrammes.totalPrevu;
        const totalReel = statsAnnonces.totalReel + statsProgrammes.totalReel;
        const totalErreurs = statsAnnonces.totalErreurs + statsProgrammes.totalErreurs;
        const baseCalculGlobale = totalPrevu > 0 ? totalPrevu + statsAnnonces.nbFantomes + statsProgrammes.nbFantomes : 1;
        const tauxGlobal = Math.max(0, 100 - ((totalErreurs / baseCalculGlobale) * 100)).toFixed(1);

        return {
            global: { totalPrevu, totalReel, totalErreurs, tauxReussite: tauxGlobal },
            annonces: statsAnnonces,
            programmes: statsProgrammes
        };
    }, [rawData, planAnnonces, planProgrammes]);

    // --- MOTEUR DE PARSING ET RÉCONCILIATION ---

    /*  const handleFileUpload = (e) => {
          const file = e.target.files[0];
          if (!file) return;
  
          const reader = new FileReader();
          reader.onload = (evt) => {
              const bstr = evt.target.result;
              const wb = XLSX.read(bstr, { type: 'binary' });
              const ws = wb.Sheets[wb.SheetNames[0]];
  
              // On sauvegarde juste l'extraction brute. Le useMemo gère tout le reste.
              const data = XLSX.utils.sheet_to_json(ws, { raw: false, dateNF: "hh:mm:ss" });
  
              setRawData(data);
              setFichierPige(file);
              setEtape('analyse');
          };
          reader.readAsArrayBuffer(file);
      };
  */

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const excelData = XLSX.utils.sheet_to_json(ws, { raw: false, dateNF: "hh:mm:ss" });

            // On définit une chaineId par défaut ou issue de vos props

            // 1. Sauvegarde via db.js en passant les plans actuels
            console.log(chaineId);
            const savedRecord = await sauvegarderPigeEnBase(file.name, excelData, chaineId, planAnnonces, planProgrammes);

            if (savedRecord) {
                // 2. Si succès, on met à jour l'UI avec le fichier actif
                setRawData(excelData);
                setActiveId(savedRecord.id);
                setFichierPige({ name: file.name });
                setEtape('analyse');
                setShowManager(false);

                // 3. On rafraîchit la liste de l'historique
                const newHistory = await chargerHistoriquePiges();
                if (newHistory) setHistorique(newHistory);
            }
        };
        reader.readAsArrayBuffer(file);
    };



    // --- SÉLECTION D'UNE PIGE DEPUIS LA MODALE ---
    const handleSelectPige = async (pigeId) => {
        if (!pigeId) return;

        // 1. On va chercher le contenu complet du fichier dans la base
        const details = await chargerPigeDetail(pigeId);

        if (details && details.raw_data) {
            // 2. On met à jour l'interface avec ces données
            setActiveId(pigeId);
            setRawData(details.raw_data);
            setFichierPige({ name: details.file_name });
            setEtape('analyse');

            // 3. On ferme la modale
            setShowManager(false);
        }
    };
    // --- SUPPRESSION (Appel DB + Mise à jour UI) ---
    const handleUiDeletePige = async (pigeId) => {
        if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce rapport de pige ?")) return;

        // 1. Appel DB
        const success = await handleDeletePige(pigeId);

        if (success) {
            // 2. Retirer de la liste affichée
            setHistorique(prev => prev.filter(h => h.id !== pigeId));

            // 3. Si on regarde ce fichier en ce moment, on ferme la vue
            if (activeId === pigeId) {
                setActiveId(null);
                setRawData([]);
                setEtape('upload');
            }
        }
    };
    const handleTimelineClick = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        // On multiplie par 115200 (32 heures) au lieu de 86400
        const clickedSec = Math.floor(percentage * 115200);
        setZoomCenterSec(Math.min(Math.max(clickedSec, 0), 115200));
    };

    // --- RENDU : ÉCRAN D'UPLOAD ---
    /*
    if (etape === 'upload') {
        return (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center min-h-[500px] flex flex-col items-center justify-center space-y-1 shadow-sm">
                <div className="rounded-full bg-slate-50 p-6 text-slate-600">
                    <Upload size={40} />
                </div>
                <div>
                    <h2 className="text-xl  text-slate-800">Validation de la Pige</h2>
                    <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
                        Importez le rapport de diffusion (Excel) fourni par la régie pour le confronter automatiquement à votre planification.
                    </p>
                </div>
                <div className="mt-4 w-full max-w-sm">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <FileSpreadsheet className="w-8 h-8 mb-3 text-slate-400" />
                            <p className="mb-2 text-sm text-slate-500"><span className="">Cliquez pour uploader</span> ou glissez le fichier</p>
                        </div>
                        <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                    </label>
                </div>
            </div>
        );
    }
    */

    // --- RENDU : ÉCRAN D'ACCUEIL (UPLOAD & HISTORIQUE) ---
    if (etape === 'upload') {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[500px]">
                {/* --- MODALE POP-OUT (UPLOAD & HISTORIQUE) --- */}
                {showManager && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                        <div className="bg-slate-50 rounded-xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                            {/* En-tête de la modale */}
                            <div className="flex justify-between items-center p-4 bg-white border-b border-slate-200">
                                <h2 className="text-lg  text-slate-800">Gestionnaire de Piges</h2>
                                <button onClick={() => { setShowManager(false); setVuePrincipale('PLAN_MEDIA') }} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors" style={{ cursor: "pointer" }}>
                                    <X size={20} style={{ cursor: "pointer" }} />
                                </button>
                            </div>

                            {/* Corps de la modale : Grille 2 colonnes */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 h-[500px]">

                                {/* COLONNE GAUCHE : UPLOAD */}
                                <div className="p-8 flex flex-col items-center justify-center text-center bg-white">
                                    <div className="rounded-full bg-slate-50 p-6 text-slate-600 mb-4">
                                        <Upload size={40} />
                                    </div>
                                    <h3 className="text-xl  text-slate-800">Nouvelle Pige</h3>
                                    <p className="text-sm text-slate-500 mt-2 max-w-sm mb-6">
                                        Importez le rapport Excel de la régie pour le confronter à la planification.
                                    </p>
                                    <label className="flex flex-col items-center justify-center w-full max-w-xs h-32 border-2 border-slate-200 border-dashed rounded-lg cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                        <FileSpreadsheet className="w-8 h-8 mb-2 text-slate-400" />
                                        <p className="text-sm text-slate-600 font-medium">Cliquez pour uploader</p>
                                        <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                                    </label>
                                </div>

                                {/* COLONNE DROITE : HISTORIQUE */}
                                <div className="border-l border-slate-200 bg-slate-50 flex flex-col h-full">
                                    <div className="p-4 border-b border-slate-200 bg-white">
                                        <h3 className="text-md  text-slate-800 flex items-center gap-2">
                                            <Database size={18} className="text-slate-600" />
                                            Piges Récentes
                                        </h3>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-4">
                                        {!historique || historique.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                                                <Database size={32} className="opacity-20" />
                                                <span className="text-sm">Aucune pige en mémoire</span>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {historique.map(item => (
                                                    <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-sm transition-all group">
                                                        <div className="overflow-hidden pr-2">
                                                            <p className=" text-sm text-slate-800 truncate" title={item.file_name || item.name}>
                                                                {item.file_name || item.name}
                                                            </p>
                                                            <p className="text-[11px] text-slate-500">
                                                                {item.created_at
                                                                    ? new Date(item.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
                                                                    : `Importé à ${item.uploadTime}`
                                                                }
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button
                                                                onClick={() => handleSelectPige(item.id)}
                                                                className="px-2.5 py-1.5 bg-slate-50 text-slate-700 hover:bg-slate-600 hover:text-white text-[11px]  rounded transition-colors"
                                                                style={{ cursor: "pointer" }}
                                                            >
                                                                Ouvrir
                                                            </button>
                                                            <button
                                                                onClick={() => handleUiDeletePige(item.id)}
                                                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors"
                                                                title="Supprimer"
                                                                style={{ cursor: "pointer" }}
                                                            >
                                                                <Trash2 size={14} style={{ cursor: "pointer" }} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {/* COLONNE GAUCHE : ZONE D'UPLOAD */}
                <div className="rounded-xl border border-slate-200 bg-white p-10 text-center flex flex-col items-center justify-center space-y-4 shadow-sm">
                    <div className="rounded-full bg-slate-50 p-6 text-slate-600">
                        <Upload size={40} />
                    </div>
                    <div>
                        <h2 className="text-xl  text-slate-800">Nouvelle Pige</h2>
                        <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
                            Importez le rapport Excel de diffusion pour le confronter automatiquement à votre planification.
                        </p>
                    </div>
                    <div className="mt-4 w-full max-w-sm">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-200 border-dashed rounded-lg cursor-pointer bg-slate-50/30 hover:bg-slate-50 transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <FileSpreadsheet className="w-8 h-8 mb-3 text-slate-400" />
                                <p className="mb-2 text-sm text-slate-600 font-medium">Cliquez pour uploader</p>
                                <p className="text-xs text-slate-400">.xlsx, .xls</p>
                            </div>
                            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                        </label>
                    </div>
                </div>

                {/* COLONNE DROITE : HISTORIQUE SUPABASE */}
                <div className="rounded-xl border border-slate-200 bg-white flex flex-col shadow-sm overflow-hidden h-[500px]">
                    <div className="p-5 border-b border-slate-100 bg-slate-50 shrink-0">
                        <h2 className="text-lg  text-slate-800 flex items-center gap-2">
                            <Database size={20} className="text-slate-600" />
                            Historique des Piges
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">Sélectionnez un ancien rapport pour l'analyser</p>
                    </div>

                    <div className="flex-1 p-4 overflow-y-auto bg-slate-50/30">
                        {!historique || historique.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                                <Database size={32} className="opacity-20" />
                                <span className="text-sm">Aucune pige sauvegardée</span>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {historique.map(item => (
                                    <div key={item.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-sm transition-all group">
                                        <div className="overflow-hidden pr-2">
                                            <p className=" text-sm text-slate-800 truncate">{item.file_name}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {new Date(item.created_at).toLocaleDateString('fr-FR', {
                                                    day: '2-digit', month: 'short', year: 'numeric',
                                                    hour: '2-digit', minute: '2-digit'
                                                })}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                onClick={() => handleSelectPige(item.id)}
                                                className="px-3 py-1.5 bg-slate-50 text-slate-700 hover:bg-slate-600 hover:text-white text-xs  rounded transition-colors"
                                            >
                                                Ouvrir
                                            </button>
                                            <button
                                                onClick={() => handleDeletePige(item.id)}
                                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors"
                                                title="Supprimer"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        );
    }
    // --- RENDU : ÉCRAN D'ANALYSE ---
    return (
        <div className="flex flex-col gap-1 min-h-[600px]">
            {/* --- MODALE POP-OUT (UPLOAD & HISTORIQUE) --- */}
            {showManager && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-slate-50 rounded-xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                        {/* En-tête de la modale */}
                        <div className="flex justify-between items-center p-4 bg-white border-b border-slate-200">
                            <h2 className="text-lg  text-slate-800">Gestionnaire de Piges</h2>
                            <button onClick={() => { setShowManager(false); setVuePrincipale('PLAN_MEDIA') }} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors" style={{ cursor: "pointer" }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Corps de la modale : Grille 2 colonnes */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 h-[500px]">

                            {/* COLONNE GAUCHE : UPLOAD */}
                            <div className="p-8 flex flex-col items-center justify-center text-center bg-white">
                                <div className="rounded-full bg-slate-50 p-6 text-slate-600 mb-4">
                                    <Upload size={40} />
                                </div>
                                <h3 className="text-xl  text-slate-800">Nouvelle Pige</h3>
                                <p className="text-sm text-slate-500 mt-2 max-w-sm mb-6">
                                    Importez le rapport Excel de la régie pour le confronter à la planification.
                                </p>
                                <label className="flex flex-col items-center justify-center w-full max-w-xs h-32 border-2 border-slate-200 border-dashed rounded-lg cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                    <FileSpreadsheet className="w-8 h-8 mb-2 text-slate-400" />
                                    <p className="text-sm text-slate-600 font-medium">Cliquez pour uploader</p>
                                    <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                                </label>
                            </div>

                            {/* COLONNE DROITE : HISTORIQUE */}
                            <div className="border-l border-slate-200 bg-slate-50 flex flex-col h-full">
                                <div className="p-4 border-b border-slate-200 bg-white">
                                    <h3 className="text-md  text-slate-800 flex items-center gap-2">
                                        <Database size={18} className="text-slate-600" />
                                        Piges Récentes
                                    </h3>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4">
                                    {!historique || historique.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                                            <Database size={32} className="opacity-20" />
                                            <span className="text-sm">Aucune pige en mémoire</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {historique.map(item => (
                                                <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-sm transition-all group">
                                                    <div className="overflow-hidden pr-2">
                                                        <p className=" text-sm text-slate-800 truncate" title={item.file_name || item.name}>
                                                            {item.file_name || item.name}
                                                        </p>
                                                        <p className="text-[11px] text-slate-500">
                                                            {item.created_at
                                                                ? new Date(item.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
                                                                : `Importé à ${item.uploadTime}`
                                                            }
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button
                                                            onClick={() => handleSelectPige(item.id)}
                                                            className="px-2.5 py-1.5 bg-slate-50 text-slate-700 hover:bg-slate-600 hover:text-white text-[11px]  rounded transition-colors"
                                                            style={{ cursor: "pointer" }}
                                                        >
                                                            Ouvrir
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeletePige(item.id)}
                                                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors"
                                                            title="Supprimer"
                                                            style={{ cursor: "pointer" }}
                                                        >
                                                            <Trash2 size={14} style={{ cursor: "pointer" }} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}




            {/* HEADER MINIATURISÉ */}
            <div className="bg-white rounded-lg border border-slate-200 p-3 flex justify-between items-center shadow-sm shrink-0">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 p-2 rounded-md text-emerald-700"><CheckCircle size={20} /></div>
                    <div>
                        <h3 className="text-sm  text-slate-800">Fichier chargé : {fichierPige?.name}</h3>
                        <p className="text-xs text-slate-500">{statsAnomalies} anomalies détectées sur {activePlan.length} planifications.</p>
                    </div>
                </div>

                {/* BOUTON DE BASCULE (SWITCH VUE) */}
                <div className="flex items-center gap-1">
                    <button onClick={() => setShowManager(true)} className="text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-md transition-colors">
                        Changer de Pige
                    </button>

                    <button
                        onClick={() => setPage('annonce')} // <-- Corrigé (sans 's')
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${page === 'annonce'
                            ? 'bg-[#243c54] text-white border-[#243c54] shadow-sm'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                        style={{ cursor: "pointer" }}
                    >
                        Annonces / Promos
                    </button>
                    <button
                        onClick={() => setPage('programme')} // <-- Corrigé (sans 's')
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${page === 'programme'
                            ? 'bg-[#243c54] text-white border-[#243c54] shadow-sm'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                        style={{ cursor: "pointer" }}
                    >
                        Programmes & Épisodes
                    </button>
                    <button
                        onClick={() => setPage('statistiques')} // <-- Corrigé (sans 's')
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${page === 'statistiques'
                            ? 'bg-[#243c54] text-white border-[#243c54] shadow-sm'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}

                        style={{ cursor: "pointer" }}
                    >
                        statistiques
                    </button>
                </div>
            </div>



            {/* --- VUE STATISTIQUES --- */}
            {/* --- VUE STATISTIQUES DÉTAILLÉES --- */}
            {page === 'statistiques' && dashboardStats && (
                <div className="flex-1 p-6 bg-slate-50/50 overflow-y-auto animate-in fade-in duration-300">
                    <div className="max-w-6xl mx-auto space-y-6">

                        {/* EN-TÊTE GLOBAL */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-center justify-between shadow-sm">
                            <div>
                                <h2 className="text-xl  text-[#243c54] flex items-center gap-2">
                                    <Activity size={24} /> Bilan de Conformité
                                </h2>
                                <p className="text-sm text-slate-500 mt-1">Comparaison entre la planification et la réalité de la régie</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-semibold text-slate-500">Taux Global</p>
                                <p className={`text-xl font-black ${dashboardStats.global.tauxReussite > 90 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                    {dashboardStats.global.tauxReussite}%
                                </p>
                            </div>
                        </div>

                        {/* COMPARAISON CÔTE À CÔTE */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                            {/* --- COLONNE ANNONCES --- */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                                <div className="bg-[#243c54] p-4 text-white flex items-center justify-between shrink-0">
                                    <h3 className=" flex items-center gap-2"><Megaphone size={18} /> Annonces & Promos</h3>
                                    <span className="bg-white/20 px-2 py-0.5 rounded text-sm ">{dashboardStats.annonces.tauxReussite}%</span>
                                </div>
                                <div className="p-6 flex-1 flex flex-col space-y-6">
                                    <div className="grid grid-cols-3 gap-4 text-center divide-x divide-slate-100">
                                        <div>
                                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Prévu</p>
                                            <p className="text-2xl  text-slate-700">{dashboardStats.annonces.totalPrevu}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Diffusé</p>
                                            <p className="text-2xl  text-indigo-600">{dashboardStats.annonces.totalReel}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Anomalies</p>
                                            <p className="text-2xl  text-rose-500">{dashboardStats.annonces.totalErreurs}</p>
                                        </div>
                                    </div>

                                    {/* Répartition des anomalies */}
                                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 flex-1">
                                        <h4 className="text-xs  text-slate-500 mb-3 uppercase tracking-wide">Détail des erreurs</h4>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-rose-500"></div> Omissions</span>
                                                <span className=" text-slate-700">{dashboardStats.annonces.nbOmissions}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-400"></div> Retards / Décalages</span>
                                                <span className=" text-slate-700">{dashboardStats.annonces.nbRetards}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500"></div> Fantômes (Non planifiés)</span>
                                                <span className=" text-slate-700">{dashboardStats.annonces.nbFantomes}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* --- COLONNE PROGRAMMES --- */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                                <div className="bg-slate-700 p-4 text-white flex items-center justify-between shrink-0">
                                    <h3 className=" flex items-center gap-2"><MonitorPlay size={18} /> Programmes & Épisodes</h3>
                                    <span className="bg-white/20 px-2 py-0.5 rounded text-sm ">{dashboardStats.programmes.tauxReussite}%</span>
                                </div>
                                <div className="p-6 flex-1 flex flex-col space-y-6">
                                    <div className="grid grid-cols-3 gap-4 text-center divide-x divide-slate-100">
                                        <div>
                                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Prévu</p>
                                            <p className="text-2xl  text-slate-700">{dashboardStats.programmes.totalPrevu}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Diffusé</p>
                                            <p className="text-2xl  text-indigo-600">{dashboardStats.programmes.totalReel}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Anomalies</p>
                                            <p className="text-2xl  text-rose-500">{dashboardStats.programmes.totalErreurs}</p>
                                        </div>
                                    </div>

                                    {/* Répartition des anomalies */}
                                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 flex-1">
                                        <h4 className="text-xs  text-slate-500 mb-3 uppercase tracking-wide">Détail des erreurs</h4>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-rose-500"></div> Omissions</span>
                                                <span className=" text-slate-700">{dashboardStats.programmes.nbOmissions}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-400"></div> Retards / Décalages</span>
                                                <span className=" text-slate-700">{dashboardStats.programmes.nbRetards}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500"></div> Fantômes (Non planifiés)</span>
                                                <span className=" text-slate-700">{dashboardStats.programmes.nbFantomes}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}



            {/* MINIMAP 24H AVEC ZOOM HORIZONTAL NÉGOCIABLE */}
            {(page === 'annonce' || page === 'programme') && <div className="bg-white rounded-lg border border-slate-200 p-2 shadow-sm shrink-0 flex flex-col gap-3">
                <div className="flex justify-between items-end">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px]  text-slate-500 uppercase tracking-widest">Vue Globale 32h</span>
                        <div className="flex items-center bg-slate-50 rounded-md border border-slate-200 overflow-hidden ">
                            <button
                                onClick={() => setMacroZoom(z => Math.max(1, z - 1))}
                                className="px-2.5 py-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors disabled:opacity-50"
                                disabled={macroZoom <= 1}
                            ><ZoomOut size={14} /></button>
                            <div className="px-3 py-1 bg-white  text-xs  border-x border-slate-200 w-16 text-center" style={{ color: "rgba(0,0,0,0.5)" }}>{macroZoom}x</div>
                            <button
                                onClick={() => setMacroZoom(z => Math.min(12, z + 1))}
                                className="px-2.5 py-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors disabled:opacity-50"
                                disabled={macroZoom >= 12}
                            ><ZoomIn size={14} /></button>
                        </div>
                    </div>
                    <div class="text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-md transition-colors">
                        Focus : {secToTime(zoomCenterSec)}
                    </div>
                </div>

                <div className="w-full overflow-x-auto overflow-y-hidden rounded-md border border-slate-200 shadow-inner bg-slate-50 relative pb-1">
                    <div
                        className="relative h-20 cursor-crosshair transition-[width] duration-300 ease-in-out"
                        style={{ width: `${macroZoom * 100}%`, minWidth: '100%' }}
                        onClick={handleTimelineClick}
                    >
                        <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
                            {[...Array(32)].map((_, i) => (
                                <div key={`tick-${i}`} className="absolute top-0 bottom-0 border-l border-slate-200" style={{ left: `${(i / 32) * 100}%` }}>
                                    <span className="text-[9px] text-slate-400 absolute left-1 top-0.5 font-mono select-none">{(i % 24).toString().padStart(2, '0')}:00</span>
                                </div>
                            ))}
                        </div>

                        {/* Piste 1: Planifié */}
                        <div className="absolute top-5 left-0 w-full h-[25%] border-b border-slate-200 bg-blue-50/50 z-10">
                            {activePlan.map(spot => (
                                <div
                                    key={spot.id} className="absolute h-full bg-blue-400 border-r border-blue-500"
                                    style={{ left: `${(timeToSec(spot.debut) / 115200) * 100}%`, width: `${Math.max((spot.duree / 115200) * 100, 0.05)}%` }}
                                    title={`Prévu: ${spot.nom}`}
                                />
                            ))}
                        </div>

                        {/* Piste 2: Réel */}
                        <div className="absolute bottom-1.5 left-0 w-full h-[25%] bg-white border-y border-slate-100 z-10">
                            {donneesPige.map(spot => {
                                let color = spot.status === 'match' ? "bg-emerald-400 border-emerald-500" :
                                    spot.status === 'delay' ? "bg-amber-400 border-amber-500" : "bg-rose-400 border-rose-500";
                                return (
                                    <div
                                        key={spot.id} className={`absolute h-full border-r ${color}`}
                                        style={{ left: `${(timeToSec(spot.debut) / 115200) * 100}%`, width: `${Math.max((spot.duree / 115200) * 100, 0.05)}%` }}
                                        title={`Diffusé: ${spot.nom}`}
                                    />
                                );
                            })}
                        </div>

                        {/* Curseur de Focus */}
                        <div
                            className="absolute top-0 h-full w-[2px] bg-slate-600 shadow-[0_0_5px_rgba(79,70,229,0.8)] z-20 transition-all duration-300 pointer-events-none"
                            style={{ left: `${(zoomCenterSec / 115200) * 100}%` }}
                        >
                            <div className="absolute -top-1 -left-1 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-transparent border-t-slate-600"></div>
                        </div>
                    </div>
                </div>
            </div>}
            {(page === 'annonce' || page === 'programme') && <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 overflow-hidden">

                {/* TABLEAU DE DÉTAIL DE LA FENÊTRE (5 MIN) */}
                <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-col min-h-[300px] max-h-[400px] ">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3 shrink-0">
                        <div className="flex items-center gap-2">
                            <Clock size={18} className="text-slate-600" />
                            <h3 className="text-sm  text-slate-800">Détail de la Fenêtre ({page === 'annonce' ? '5 min' : '2 heures'})</h3>
                        </div>
                        <span className="text-xs text-slate-600 font-mono bg-slate-50 px-2 py-1 rounded border border-slate-200">
                            {secToTime(zoomStart)} - {secToTime(zoomEnd)}
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto border border-slate-200 rounded-md">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0">
                                <tr>
                                    <th className="py-2 px-3 ">Type</th>
                                    <th className="py-2 px-3 ">Programme</th>
                                    <th className="py-2 px-3 ">Horaire Prévu</th>
                                    <th className="py-2 px-3 ">Horaire Réel</th>
                                    <th className="py-2 px-3 ">Écart / Statut</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 max-h-[400px]" style={{ overflow: "auto" }}>
                                {(() => {
                                    // Récupère les spots prévus et réels dans la fenêtre de zoom
                                    const prevusInView = activePlan.filter(s => timeToSec(s.debut) >= zoomStart && timeToSec(s.debut) <= zoomEnd);
                                    const reelsInView = donneesPige.filter(s => timeToSec(s.debut) >= zoomStart && timeToSec(s.debut) <= zoomEnd);

                                    if (prevusInView.length === 0 && reelsInView.length === 0) {
                                        return (
                                            <tr>
                                                <td colSpan="5" className="text-center py-8 text-slate-400">Aucun événement dans cette fenêtre de 5 minutes</td>
                                            </tr>
                                        );
                                    }

                                    return [
                                        ...prevusInView.map(p => ({ ...p, source: 'prevu', sec: timeToSec(p.debut) })),
                                        ...reelsInView.map(r => ({ ...r, source: 'reel', sec: timeToSec(r.debut) }))
                                    ]
                                        .sort((a, b) => a.sec - b.sec)
                                        .map((item, idx) => {
                                            const isReel = item.source === 'reel';
                                            let badgeStyle = "bg-blue-100 text-blue-800 border-blue-200";
                                            let labelType = "Prévu";

                                            if (isReel) {
                                                if (item.status === 'match') { badgeStyle = "bg-emerald-100 text-emerald-800 border-emerald-200"; labelType = "Diffusé (OK)"; }
                                                else if (item.status === 'delay') { badgeStyle = "bg-amber-100 text-amber-800 border-amber-200"; labelType = "Retard"; }
                                                else { badgeStyle = "bg-rose-100 text-rose-800 border-rose-200"; labelType = "Fantôme"; }
                                            }

                                            return (
                                                <tr key={`${item.source}-${item.id || idx}`} className="hover:bg-slate-50 transition-colors">
                                                    <td className="py-2.5 px-3">
                                                        <span className={`px-2 py-0.5 rounded text-[10px]  border ${badgeStyle}`}>
                                                            {labelType}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-3  text-slate-800">{item.nom}</td>
                                                    <td className="py-2.5 px-3 font-mono text-slate-600">{!isReel ? secToTime(item.sec) : '-'}</td>
                                                    <td className="py-2.5 px-3 font-mono text-slate-600">{isReel ? secToTime(item.sec) : '-'}</td>
                                                    <td className="py-2.5 px-3 text-slate-500 font-mono">
                                                        {isReel && item.status === 'delay' && (
                                                            <span className="text-amber-700 ">Décalé</span>
                                                        )}
                                                        {isReel && item.status === 'match' && (
                                                            <span className="text-emerald-700">Parfait</span>
                                                        )}
                                                        {isReel && item.status === 'ghost' && (
                                                            <span className="text-rose-700">Non planifié</span>
                                                        )}
                                                        {!isReel && !donneesPige.some(r => r.matchedPlanId === item.id) && (
                                                            <span className="text-slate-400">Omission potentielle</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        });
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* TABLEAU DES ANOMALIES GÉNÉRÉ AUTOMATIQUEMENT */}
                <div className="bg-white rounded-lg border border-slate-200 flex flex-col shadow-sm overflow-hidden min-h-[300px] max-h-[400px]">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2 shrink-0" >
                        <AlertCircle size={18} className="text-rose-500" />
                        <h3 className="text-sm  text-slate-800">Anomalies ({listeAnomalies.length})</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-0 bg-white">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-white border-b border-slate-100 text-slate-500 sticky top-0 z-20">
                                <tr>
                                    <th className=" py-2 px-3">Statut</th>
                                    <th className=" py-2 px-3">Détail (Cliquez pour centrer)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 max-h-[400px]" style={{ overflow: "auto" }}>
                                {listeAnomalies.length === 0 ? (
                                    <tr><td colSpan="2" className="text-center py-5 text-slate-400">Aucune anomalie détectée</td></tr>
                                ) : (
                                    listeAnomalies.map((anomalie, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => setZoomCenterSec(anomalie.time)}>
                                            <td className="py-3 px-3">
                                                <span className={` px-2 py-0.5 rounded text-[9px] uppercase shadow-sm border
                          ${anomalie.type === 'Retard' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                        anomalie.type === 'Omission' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                                                            'bg-rose-100 text-rose-700 border-rose-200'}`}
                                                >
                                                    {anomalie.type}
                                                </span>
                                            </td>
                                            <td className="py-3 px-3">
                                                <div className=" text-slate-700">{anomalie.detail.nom}</div>
                                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                                    {anomalie.type === 'Retard' && `Prévu ${anomalie.prevu.debut} • Réel ${anomalie.detail.debut} (${anomalie.ecart > 0 ? '+' : ''}${anomalie.ecart}s)`}
                                                    {anomalie.type === 'Omission' && `Prévu ${anomalie.detail.debut} • Non diffusé`}
                                                    {anomalie.type === 'Fantôme' && `Non planifié • Réel ${anomalie.detail.debut}`}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>}
        </div>
    );
}