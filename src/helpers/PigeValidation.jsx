import React, { useState, useMemo, useEffect } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Clock, ZoomIn, ZoomOut } from 'lucide-react';
import * as XLSX from 'xlsx';

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
export default function PigeValidation({ events }) {
    // États de base
    // États de base
    const [fichierPige, setFichierPige] = useState(null);
    const [etape, setEtape] = useState('upload');
    const [page, setPage] = useState("annonce");

    // NOUVEAU : On stocke uniquement l'extraction brute de l'Excel
    const [rawData, setRawData] = useState([]);

    // États de Visualisation
    const [zoomCenterSec, setZoomCenterSec] = useState(timeToSec('03:15:00'));
    const [macroZoom, setMacroZoom] = useState(1);


    const ZOOM_WINDOW_SEC = page === 'annonce' ? 300 : 7200;
    const zoomStart = Math.max(0, zoomCenterSec - (ZOOM_WINDOW_SEC / 2));
    const zoomEnd = Math.min(115200, zoomCenterSec + (ZOOM_WINDOW_SEC / 2)); // Limite à 32h

    // --- EXTRACTION ET SÉPARATION DES VRAIES DONNÉES (PROPS) ---
    const { planAnnonces, planProgrammes } = useMemo(() => {
        console.log("----------")
        console.log(events);
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
    }, [rawData, page]);



    useEffect(() => {
        if (listeAnomalies.length > 0) {
            setZoomCenterSec(listeAnomalies[0].time);
        }
    }, [page, listeAnomalies.length]);





    // --- MOTEUR DE PARSING ET RÉCONCILIATION ---
    const handleFileUpload = (e) => {
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

    const handleTimelineClick = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        // On multiplie par 115200 (32 heures) au lieu de 86400
        const clickedSec = Math.floor(percentage * 115200);
        setZoomCenterSec(Math.min(Math.max(clickedSec, 0), 115200));
    };

    // --- RENDU : ÉCRAN D'UPLOAD ---
    if (etape === 'upload') {
        return (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center min-h-[500px] flex flex-col items-center justify-center space-y-1 shadow-sm">
                <div className="rounded-full bg-indigo-50 p-6 text-indigo-600">
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

    // --- RENDU : ÉCRAN D'ANALYSE ---
    return (
        <div className="flex flex-col gap-1 min-h-[600px]">

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
                <div className="flex items-center gap-2">
                    <button onClick={() => setEtape('upload')} className="text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-md transition-colors">
                        Changer de fichier
                    </button>

                    <button
                        onClick={() => setPage('annonce')} // <-- Corrigé (sans 's')
                        className={`text-xs font-medium text-slate-600  border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-md transition-colors ${page === 'annonce' // <-- Corrigé (sans 's')
                            ? 'bg-slate-100  shadow-sm'
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                    >
                        Annonces / Promos
                    </button>
                    <button
                        onClick={() => setPage('programme')} // <-- Corrigé (sans 's')
                        className={`text-xs font-medium text-slate-600  border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-md transition-colors ${page === 'programme' // <-- Corrigé (sans 's')
                            ? 'bg-slate-100  shadow-sm'
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                    >
                        Programmes & Épisodes
                    </button>
                </div>
            </div>

            {/* MINIMAP 24H AVEC ZOOM HORIZONTAL NÉGOCIABLE */}
            <div className="bg-white rounded-lg border border-slate-200 p-2 shadow-sm shrink-0 flex flex-col gap-3">
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
                            className="absolute top-0 h-full w-[2px] bg-indigo-600 shadow-[0_0_5px_rgba(79,70,229,0.8)] z-20 transition-all duration-300 pointer-events-none"
                            style={{ left: `${(zoomCenterSec / 115200) * 100}%` }}
                        >
                            <div className="absolute -top-1 -left-1 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-transparent border-t-indigo-600"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 overflow-hidden">

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
                            <tbody className="divide-y divide-slate-100 max-h-[400px]" style={{overflow:"auto"}}>
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

            </div>
        </div>
    );
}