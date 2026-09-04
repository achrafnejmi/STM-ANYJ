// Calendrier générique de publications (Grille non-linéaire, hors cahier,
// P20) — un seul composant pour les 2 onglets (Réseaux sociaux / Streaming
// VOD), piloté par `config` (GrilleNonLineaire.jsx). Contrairement à
// GrilleLineaire.jsx, une publication n'a pas de durée (pas de heure_fin) :
// pas d'axe minute-précis (grilleAxe.js) ici, juste une liste de cartes par
// jour triée par heure.
import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, WidthType } from 'docx'
import { ChevronLeft, ChevronRight, Plus, Undo2, Redo2, X } from 'lucide-react'
import {
  aujourdHuiISO,
  ajouterJours,
  lundiDeLaSemaine,
  joursDeLaSemaine,
  formaterJourCourt,
  formaterPlageSemaine,
  formaterDateLongue,
} from '../lib/semaine.js'
import { listerTousLesEpisodes, listerEpisodes } from '../lib/db.js'
import { enregistrerAction, etatPile, annulerDerniereAction, retablirAction, fusionnerChangements } from '../lib/undoManager.js'
import { couleurPlateforme } from '../lib/couleursPlateforme.js'
import { statutPublication } from '../lib/statutsPublication.js'
import {
  construireDonneesPublications,
  construireLignesExcelPublications,
  construireNomFichierPublications,
} from '../lib/exportPublications.js'
import LogoPlateforme from './LogosPlateformes.jsx'
import CataloguePanel from './CataloguePanel.jsx'
import PopoverHistorique from './PopoverHistorique.jsx'
import PanneauPublication from './PanneauPublication.jsx'
import BoutonExporter from './BoutonExporter.jsx'
import { useNotification } from './NotificationProvider.jsx'

// P30 rollback : deux piles annuler/rétablir indépendantes (Réseaux/VOD) —
// même helper que PanneauPublication.jsx, dupliqué volontairement (trivial,
// pas de lib partagée naturelle pour cette correspondance écran-only).
function ecranPour(config) {
  return config.table === 'publication_reseau' ? 'GRILLE_NON_LINEAIRE_RESEAUX' : 'GRILLE_NON_LINEAIRE_VOD'
}

// Sans heure = en tête de journée (confirmé) ; sinon tri chronologique.
function comparerPublications(a, b) {
  if (!a.heure_publication && !b.heure_publication) return 0
  if (!a.heure_publication) return -1
  if (!b.heure_publication) return 1
  return a.heure_publication.localeCompare(b.heure_publication)
}

export default function CalendrierPublications({ chaineActive, programmes, config }) {
  const [vue, setVue] = useState('SEMAINE')
  const [dateReference, setDateReference] = useState(aujourdHuiISO())
  const [publications, setPublications] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [panneau, setPanneau] = useState(null) // { publication?, programmeId?, date? }
  const [panneauModifie, setPanneauModifie] = useState(false)
  const { confirmer } = useNotification()
  const [filtrePlateforme, setFiltrePlateforme] = useState('')
  const [filtreFormat, setFiltreFormat] = useState('')
  const [filtreProgramme, setFiltreProgramme] = useState('')
  const [filtreEpisode, setFiltreEpisode] = useState('')
  const [episodesFiltre, setEpisodesFiltre] = useState([])
  const [tousEpisodes, setTousEpisodes] = useState([])
  const [historiqueOuvert, setHistoriqueOuvert] = useState(null)
  const [pile, setPile] = useState({ peutAnnuler: false, libelleAnnuler: null, peutRetablir: false, libelleRetablir: null })
  const dragRef = useRef(null)

  useEffect(() => {
    setChargement(true)
    setErreur(null)
    setFiltrePlateforme('')
    setFiltreFormat('')
    setFiltreProgramme('')
    setFiltreEpisode('')
    config
      .lister(chaineActive.id)
      .then(setPublications)
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- config est un objet statique par onglet, pas une dépendance réactive
  }, [chaineActive, config.table])

  // Épisodes de toute la chaîne (P43) — pour le badge ÉP.NN des cartes et l'export.
  useEffect(() => {
    listerTousLesEpisodes()
      .then(setTousEpisodes)
      .catch(() => setTousEpisodes([]))
  }, [chaineActive])

  // Liste dépendante du filtre Épisode : épisodes du programme sélectionné.
  useEffect(() => {
    setFiltreEpisode('')
    if (!filtreProgramme) {
      setEpisodesFiltre([])
      return
    }
    listerEpisodes(filtreProgramme)
      .then(setEpisodesFiltre)
      .catch(() => setEpisodesFiltre([]))
  }, [filtreProgramme])

  // Pile annuler/rétablir (P30 rollback) : rafraîchie après chaque écriture.
  // Pas de documentId (un seul calendrier continu par chaîne, pas de
  // multi-document) — scope chaîne+écran seul, comme GRILLE_TYPE avant P28.
  useEffect(() => {
    etatPile(chaineActive.id, ecranPour(config)).then(setPile)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- config est un objet statique par onglet, pas une dépendance réactive
  }, [chaineActive, config.table, publications])

  useEffect(() => {
    function onKeyDown(e) {
      const cible = document.activeElement
      if (cible && ['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName)) return
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        gererAnnuler()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        gererRetablir()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gererAnnuler/gererRetablir lisent chaineActive/config par closure
  }, [chaineActive, config.table])

  const lundi = lundiDeLaSemaine(dateReference)
  const jours = useMemo(
    () => (vue === 'SEMAINE' ? joursDeLaSemaine(lundi) : [dateReference]),
    [vue, lundi, dateReference]
  )

  const programmesParId = useMemo(() => new Map(programmes.map((p) => [p.id, p])), [programmes])
  const numeroEpisodeParId = useMemo(() => new Map(tousEpisodes.map((e) => [e.id, e.numero])), [tousEpisodes])
  const etiquetteEpisode = (episodeId) => {
    if (!episodeId) return ''
    const n = numeroEpisodeParId.get(episodeId)
    return n != null ? `ÉP.${String(n).padStart(2, '0')}` : 'ÉP.'
  }

  const publicationsFiltrees = useMemo(
    () =>
      publications.filter(
        (p) =>
          (!filtrePlateforme || p.plateforme === filtrePlateforme) &&
          (!filtreFormat || p.format === filtreFormat) &&
          (!filtreProgramme || p.programme_id === filtreProgramme) &&
          (!filtreEpisode || p.episode_id === filtreEpisode)
      ),
    [publications, filtrePlateforme, filtreFormat, filtreProgramme, filtreEpisode]
  )

  const parJour = useMemo(() => {
    const map = new Map()
    for (const j of jours) map.set(j, [])
    for (const p of publicationsFiltrees) {
      if (map.has(p.date_publication)) map.get(p.date_publication).push(p)
    }
    for (const liste of map.values()) liste.sort(comparerPublications)
    return map
  }, [publicationsFiltrees, jours])

  function naviguer(delta) {
    const pas = vue === 'SEMAINE' ? 7 * delta : delta
    setDateReference((d) => ajouterJours(d, pas))
  }

  // Garde-fou "modifications non enregistrées" (P21 Lot G) : passe par ici
  // pour changer OU fermer (nouveau=null) le panneau — panneauModifie est
  // reporté par PanneauPublication.
  async function changerPanneau(nouveau) {
    if (panneau && panneauModifie) {
      const ok = await confirmer({
        titre: 'Modifications non enregistrées',
        message: 'Modifications non enregistrées. Quitter sans enregistrer ?',
        labelConfirmer: 'Quitter sans enregistrer',
        labelAnnuler: 'Rester',
      })
      if (!ok) return
    }
    setPanneau(nouveau)
    setPanneauModifie(false)
  }

  function appliquerCreation(cree) {
    setPublications((prev) => [...prev, cree])
    setPanneau(null)
  }
  function appliquerModification(maj) {
    setPublications((prev) => prev.map((p) => (p.id === maj.id ? maj : p)))
    setPanneau(null)
  }
  function appliquerSuppression(id) {
    setPublications((prev) => prev.filter((p) => p.id !== id))
    setPanneau(null)
  }

  // Suppression directe depuis la carte (bouton X) — même flux que
  // PanneauPublication.jsx (confirmation, écriture, undo) sans passer par le panneau.
  async function supprimerDirect(p) {
    const confirme = await confirmer({
      titre: 'Supprimer la publication',
      message: `Supprimer cette publication (« ${p.titre || 'sans titre'} ») ?`,
      labelConfirmer: 'Supprimer',
    })
    if (!confirme) return
    try {
      await config.supprimer(p.id)
      await enregistrerAction({
        chaineId: chaineActive.id,
        ecran: ecranPour(config),
        libelle: `Suppression : ${p.titre || 'publication'}`,
        operations: [{ table: config.table, type: 'DELETE', id: p.id, avant: p }],
      })
      appliquerSuppression(p.id)
    } catch (err) {
      setErreur(err.message)
    }
  }

  // Deux piles indépendantes (Réseaux/VOD, P30 rollback) : les changements
  // renvoyés ici concernent TOUJOURS la table de cet onglet (chaque pile
  // n'accumule que les actions enregistrées sous son propre écran) — pas de
  // filtrage supplémentaire nécessaire avant de fusionner dans l'état local.
  function appliquerChangementsPile(changements) {
    setPublications((prev) => fusionnerChangements(prev, changements))
  }

  async function gererAnnuler() {
    const resultat = await annulerDerniereAction(chaineActive.id, ecranPour(config))
    if (!resultat.ok) {
      setErreur(resultat.motif)
      return
    }
    appliquerChangementsPile(resultat.changements)
  }

  async function gererRetablir() {
    const resultat = await retablirAction(chaineActive.id, ecranPour(config))
    if (!resultat.ok) {
      setErreur(resultat.motif)
      return
    }
    appliquerChangementsPile(resultat.changements)
  }

  function deposerSurJour(jour) {
    const payload = dragRef.current
    dragRef.current = null
    if (!payload) return
    changerPanneau({ programmeId: payload.programmeId, episodeId: payload.episodeId ?? null, date: jour })
  }

  const periodeLabel = vue === 'SEMAINE' ? formaterPlageSemaine(lundi) : formaterDateLongue(dateReference)

  function donneesExport() {
    return construireDonneesPublications({
      libelleOnglet: config.libelleExport,
      chaineNom: chaineActive.nom,
      periodeLabel,
      publications: publicationsFiltrees
        .filter((p) => jours.includes(p.date_publication))
        .map((p) => ({
          ...p,
          programmeTitre: programmesParId.get(p.programme_id)?.titre,
          episodeLabel: etiquetteEpisode(p.episode_id) || '—',
        })),
      avecFormat: !!config.formats,
    })
  }

  function exporterExcel() {
    try {
      const donnees = donneesExport()
      const feuille = XLSX.utils.aoa_to_sheet(construireLignesExcelPublications(donnees))
      const classeur = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(classeur, feuille, config.libelleExport.slice(0, 31))
      XLSX.writeFile(classeur, construireNomFichierPublications(config.libelleExport, chaineActive.nom, periodeLabel, 'xlsx'))
    } catch (err) {
      setErreur(`Échec de l'export Excel : ${err.message}`)
    }
  }

  function exporterPdf() {
    try {
      const donnees = donneesExport()
      const doc = new jsPDF()
      doc.setFontSize(14)
      doc.text(donnees.titre, 14, 16)
      doc.setFontSize(9)
      doc.text(donnees.filtresLabel, 14, 22)
      autoTable(doc, { startY: 28, head: [donnees.colonnes], body: donnees.lignes })
      doc.save(construireNomFichierPublications(config.libelleExport, chaineActive.nom, periodeLabel, 'pdf'))
    } catch (err) {
      setErreur(`Échec de l'export PDF : ${err.message}`)
    }
  }

  async function exporterWord() {
    try {
      const donnees = donneesExport()
      const ligneEntete = (libelles) =>
        new TableRow({
          children: libelles.map(
            (l) =>
              new TableCell({
                width: { size: Math.round(100 / donnees.colonnes.length), type: WidthType.PERCENTAGE },
                children: [new Paragraph({ children: [new TextRun({ text: l, bold: true })] })],
              })
          ),
        })
      const ligne = (valeurs) => new TableRow({ children: valeurs.map((v) => new TableCell({ children: [new Paragraph(String(v))] })) })

      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({ text: donnees.titre, heading: HeadingLevel.HEADING_1 }),
              new Paragraph({ text: donnees.filtresLabel }),
              new Table({ rows: [ligneEntete(donnees.colonnes), ...donnees.lignes.map(ligne)] }),
            ],
          },
        ],
      })

      const blob = await Packer.toBlob(doc)
      const url = URL.createObjectURL(blob)
      const lien = document.createElement('a')
      lien.href = url
      lien.download = construireNomFichierPublications(config.libelleExport, chaineActive.nom, periodeLabel, 'docx')
      lien.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setErreur(`Échec de l'export Word : ${err.message}`)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex rounded-md border border-slate-300 text-sm">
              <button
                type="button"
                onClick={() => setVue('SEMAINE')}
                className={`px-3 py-2 ${vue === 'SEMAINE' ? 'bg-snrt-navy text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Semaine
              </button>
              <button
                type="button"
                onClick={() => setVue('JOUR')}
                className={`px-3 py-2 ${vue === 'JOUR' ? 'bg-snrt-navy text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Jour
              </button>
            </div>
            <select
              value={filtrePlateforme}
              onChange={(e) => setFiltrePlateforme(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-600"
            >
              <option value="">Toutes plateformes</option>
              {config.plateformes.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.libelle}
                </option>
              ))}
            </select>
            {config.formats && (
              <select
                value={filtreFormat}
                onChange={(e) => setFiltreFormat(e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-600"
              >
                <option value="">Tous formats</option>
                {config.formats.map((f) => (
                  <option key={f.code} value={f.code}>
                    {f.libelle}
                  </option>
                ))}
              </select>
            )}
            <select
              value={filtreProgramme}
              onChange={(e) => setFiltreProgramme(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-600"
            >
              <option value="">Tous les programmes</option>
              {programmes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.titre}
                </option>
              ))}
            </select>
            {filtreProgramme && (
              <select
                value={filtreEpisode}
                onChange={(e) => setFiltreEpisode(e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-600"
              >
                <option value="">Tous les épisodes</option>
                {episodesFiltre.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    ÉP.{String(ep.numero ?? '?').padStart(2, '0')}
                    {ep.titre ? ` — ${ep.titre}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => naviguer(-1)} className="rounded-md border border-slate-300 p-1.5 hover:bg-slate-50">
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[12rem] text-center text-sm font-medium text-slate-700">{periodeLabel}</span>
            <button type="button" onClick={() => naviguer(1)} className="rounded-md border border-slate-300 p-1.5 hover:bg-slate-50">
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => setDateReference(aujourdHuiISO())}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Aujourd'hui
            </button>
            <button
              type="button"
              onClick={() => changerPanneau({ programmeId: null, date: dateReference })}
              className="flex items-center gap-1.5 rounded-md bg-snrt-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-snrt-navy-hover"
            >
              <Plus size={15} />
              Ajouter
            </button>
            <div className="flex rounded-md border border-slate-300">
              <button
                type="button"
                onClick={gererAnnuler}
                disabled={!pile.peutAnnuler}
                title={pile.peutAnnuler ? `Annuler : ${pile.libelleAnnuler}` : 'Rien à annuler'}
                className="rounded-l-md border-r border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Undo2 size={15} />
              </button>
              <button
                type="button"
                onClick={gererRetablir}
                disabled={!pile.peutRetablir}
                title={pile.peutRetablir ? `Rétablir : ${pile.libelleRetablir}` : 'Rien à rétablir'}
                className="rounded-r-md p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Redo2 size={15} />
              </button>
            </div>
            <BoutonExporter onExcel={exporterExcel} onWord={exporterWord} onPdf={exporterPdf} />
          </div>
        </div>

        {erreur && <p className="mt-3 text-sm text-red-600">{erreur}</p>}
      </div>

      <div className="flex items-start gap-4">
        <CataloguePanel chaineActive={chaineActive} dragRef={dragRef} onOuvrirHistorique={setHistoriqueOuvert} />

        {!chargement && (
          <div className="flex-1 rounded-lg border border-slate-200 bg-white p-4">
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${jours.length}, minmax(160px, 1fr))` }}>
              {jours.map((j) => (
                <div
                  key={j}
                  className="min-h-[12rem] rounded-md border border-slate-100 bg-slate-50/50 p-2"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    deposerSurJour(j)
                  }}
                >
                  <div className="mb-2 text-center text-xs font-medium text-slate-600">{formaterJourCourt(j)}</div>
                  <div className="space-y-1.5">
                    {(parJour.get(j) ?? []).map((p) => {
                      const couleur = couleurPlateforme(p.plateforme)
                      const statut = statutPublication(p.statut)
                      const estForja = p.plateforme === 'FORJA'
                      return (
                        <div
                          key={p.id}
                          className="group relative flex w-full flex-col gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-left text-[11px] shadow-sm hover:border-snrt-navy"
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              supprimerDirect(p)
                            }}
                            title="Supprimer directement"
                            className="absolute right-1 top-1 rounded p-0.5 text-slate-300 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                          >
                            <X size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => changerPanneau({ publication: p })}
                            className="flex w-full flex-col gap-1 text-left"
                          >
                            <div className="flex items-center gap-1.5 pr-4">
                              {estForja ? (
                                <img src="/brand/forja-logo.svg" alt="Forja" className="h-5 w-auto" />
                              ) : (
                                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${couleur.fond}`}>
                                  <LogoPlateforme code={p.plateforme} size={13} className={couleur.texte} />
                                </span>
                              )}
                              {p.format && <span className="text-slate-400">{p.format}</span>}
                              {p.episode_id && (
                                <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-medium text-slate-600">
                                  {etiquetteEpisode(p.episode_id)}
                                </span>
                              )}
                              {p.heure_publication && <span className="ml-auto font-mono text-slate-500">{p.heure_publication.slice(0, 5)}</span>}
                            </div>
                            <div className="truncate font-medium text-slate-800">{p.titre || programmesParId.get(p.programme_id)?.titre || '—'}</div>
                            <span className={`self-start rounded px-1.5 py-0.5 text-[10px] font-medium ${statut.fond} ${statut.texte}`}>
                              {statut.libelle}
                            </span>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {historiqueOuvert && <PopoverHistorique programme={historiqueOuvert} onFermer={() => setHistoriqueOuvert(null)} />}

      {panneau && (
        <PanneauPublication
          key={panneau.publication?.id ?? `nouveau:${panneau.programmeId ?? ''}:${panneau.episodeId ?? ''}:${panneau.date ?? ''}`}
          publication={panneau.publication ?? null}
          programmeInitial={panneau.programmeId}
          episodeInitial={panneau.episodeId}
          dateInitiale={panneau.date}
          programmes={programmes}
          chaineActive={chaineActive}
          config={config}
          onFermer={() => changerPanneau(null)}
          onCree={appliquerCreation}
          onModifie={appliquerModification}
          onSupprime={appliquerSuppression}
          onModifieChange={setPanneauModifie}
        />
      )}
    </div>
  )
}
