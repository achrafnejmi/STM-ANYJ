import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { X, Trash2, SplitSquareHorizontal, Tv, Radio, Layers3 } from 'lucide-react'
import {
  listerEpisodes,
  mettreAJourDiffusionLineaire,
  creerDiffusionLineaire,
  creerDiffusionsLineaires,
  supprimerDiffusionLineaire,
} from '../lib/db.js'
import { enregistrerAction, etatPile, annulerDerniereAction } from '../lib/undoManager.js'
import { deprogrammerDiffusion } from '../lib/deprogrammation.js'
import { couleurGenre } from '../lib/couleursGenre.js'
import { ajouterJours, formaterJourCourt, formaterDateLongue, datesParPas } from '../lib/semaine.js'
import { useNotification, useGardeModifications, useSignalerModifications } from './NotificationProvider.jsx'

// Panneau flottant (pas une 3e colonne) : ancré au viewport pour ne jamais
// comprimer la grille en dessous, quelle que soit la largeur d'écran.
export default function InspecteurBloc({
  diffusion,
  programme,
  chaineActive,
  grilleId,
  diffusionsGrilleActive,
  onFermer,
  onModifie,
  onSupprime,
  onCreerPlusieurs,
  onChangementsPile,
  onModifieChange,
}) {
  const [onglet, setOnglet] = useState('BLOC')

  useEffect(() => {
    setOnglet('BLOC')
  }, [diffusion.id])

  return (
    <div className="fixed right-0 top-0 z-30 flex h-full w-96 flex-col overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Inspecteur</h3>
        <button type="button" onClick={onFermer} className="text-slate-400 hover:text-slate-600">
          <X size={18} />
        </button>
      </div>
      <div className="mb-4 flex gap-1 rounded-md bg-slate-100 p-1 text-sm">
        {[
          ['BLOC', 'Bloc'],
          ['REPETER', 'Répéter'],
          ['VECTEUR', 'Vecteur'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setOnglet(id)}
            className={`flex-1 rounded px-2 py-1.5 font-medium transition-colors ${
              onglet === id ? 'bg-white text-snrt-navy shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {onglet === 'BLOC' && (
        <OngletBloc
          diffusion={diffusion}
          programme={programme}
          chaineActive={chaineActive}
          grilleId={grilleId}
          onModifie={onModifie}
          onSupprime={onSupprime}
          onModifieChange={onModifieChange}
        />
      )}
      {onglet === 'REPETER' && (
        <OngletRepeter
          diffusion={diffusion}
          programme={programme}
          chaineActive={chaineActive}
          grilleId={grilleId}
          onCreerPlusieurs={onCreerPlusieurs}
          onChangementsPile={onChangementsPile}
        />
      )}
      {onglet === 'VECTEUR' && (
        <OngletVecteur
          diffusion={diffusion}
          chaineActive={chaineActive}
          grilleId={grilleId}
          diffusionsGrilleActive={diffusionsGrilleActive}
          onModifie={onModifie}
          onSupprime={onSupprime}
          onCreerPlusieurs={onCreerPlusieurs}
        />
      )}
    </div>
  )
}

function OngletBloc({ diffusion, programme, chaineActive, grilleId, onModifie, onSupprime, onModifieChange }) {
  const [heureDebut, setHeureDebut] = useState(diffusion.heure_debut)
  const [heureFin, setHeureFin] = useState(diffusion.heure_fin)
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const idDebut = useId()
  const idFin = useId()
  const { confirmer } = useNotification()

  useEffect(() => {
    setHeureDebut(diffusion.heure_debut)
    setHeureFin(diffusion.heure_fin)
    setErreur(null)
  }, [diffusion.id, diffusion.heure_debut, diffusion.heure_fin])

  // Garde-fou "modifications non enregistrées" (P21 Lot G) : instantané figé
  // sur les mêmes dépendances que la réinitialisation ci-dessus, reporté au
  // parent (GrilleLineaire.jsx) qui l'utilise pour garder le X rouge de la
  // grille et la fermeture de l'inspecteur.
  const valeurInitiale = useMemo(
    () => ({ heureDebut: diffusion.heure_debut, heureFin: diffusion.heure_fin }),
    [diffusion.heure_debut, diffusion.heure_fin]
  )
  const { estModifie } = useGardeModifications({ heureDebut, heureFin }, valeurInitiale)
  useSignalerModifications(estModifie, onModifieChange)

  async function enregistrerHoraire(e) {
    e.preventDefault()
    setEnregistrement(true)
    setErreur(null)
    try {
      const maj = await mettreAJourDiffusionLineaire(diffusion.id, { heure_debut: heureDebut, heure_fin: heureFin })
      await enregistrerAction({
        chaineId: chaineActive.id,
        ecran: 'GRILLE_LINEAIRE',
        documentId: grilleId,
        libelle: `Modification horaire : ${diffusion.titre_cache}`,
        operations: [{ table: 'diffusion_lineaire', type: 'UPDATE', id: diffusion.id, avant: diffusion, apres: maj }],
      })
      onModifie(maj)
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  // Chemin de suppression partagé avec le X de la grille (P21 Lot B) — voir
  // lib/deprogrammation.js. Confirmation via la modale du Lot G (plus de
  // window.confirm natif).
  async function deprogrammer() {
    setErreur(null)
    try {
      await deprogrammerDiffusion(diffusion, { chaineActive, grilleId, onSupprime, confirmer })
    } catch (err) {
      setErreur(err.message)
    }
  }

  const { fond, texte } = couleurGenre(diffusion.genre)
  const etiquetteEpisode = diffusion.episode_numero != null ? `ÉP.${String(diffusion.episode_numero).padStart(2, '0')}` : '—'

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-slate-200 p-3">
        <div className="mb-1.5 flex items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${fond} ${texte}`}>{diffusion.genre || 'Sans genre'}</span>
          <span className="font-mono text-xs text-slate-500">{etiquetteEpisode}</span>
        </div>
        <div className="text-sm font-medium text-slate-800">{diffusion.titre_cache}</div>
        <div className="mt-0.5 text-xs text-slate-500">{formaterDateLongue(diffusion.date)}</div>
        {programme && (
          <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
            {programme.titre_ar && <div dir="rtl">{programme.titre_ar}</div>}
            {programme.description && <p className="line-clamp-3">{programme.description}</p>}
          </div>
        )}
      </div>

      <form onSubmit={enregistrerHoraire} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={idDebut} className="mb-1 block text-xs font-medium text-slate-700">
              Heure début
            </label>
            <input
              id={idDebut}
              type="time"
              required
              value={heureDebut}
              onChange={(e) => setHeureDebut(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor={idFin} className="mb-1 block text-xs font-medium text-slate-700">
              Heure fin
            </label>
            <input
              id={idFin}
              type="time"
              required
              value={heureFin}
              onChange={(e) => setHeureFin(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>
        {erreur && <p className="text-xs text-red-600">{erreur}</p>}
        <button
          type="submit"
          disabled={enregistrement}
          className="w-full rounded-md bg-snrt-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
        >
          {enregistrement ? 'Enregistrement…' : "Enregistrer l'horaire"}
        </button>
      </form>

      <button
        type="button"
        onClick={deprogrammer}
        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
      >
        <Trash2 size={14} />
        Déprogrammer
      </button>
    </div>
  )
}

function OngletRepeter({ diffusion, programme, chaineActive, grilleId, onCreerPlusieurs, onChangementsPile }) {
  const [episodes, setEpisodes] = useState([])
  const [chargementEpisodes, setChargementEpisodes] = useState(true)
  const requeteId = useRef(0)

  const [dateDebut, setDateDebut] = useState(diffusion.date)
  const [dateFin, setDateFin] = useState(ajouterJours(diffusion.date, 6))
  const [pas, setPas] = useState(1)
  // Dates exclues manuellement dans l'aperçu (P27, "sauter des jours") — remis
  // à zéro dès que la plage/le pas change, une exclusion n'a de sens que pour
  // la série qui l'a proposée.
  const [exclusions, setExclusions] = useState(() => new Set())
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)
  // Id de l'entrée d'historique créée par le dernier "Appliquer" — le bandeau
  // "Annuler" ci-dessous n'est qu'un raccourci vers la pile générique
  // (undoManager.js), revérifié au clic qu'il en représente toujours le
  // sommet avant de déléguer (sinon une autre action a eu lieu depuis).
  const [derniereActionId, setDerniereActionId] = useState(null)

  // Garde anti-réponse-périmée (même pattern que FormulaireCreneau) : si le
  // bloc sélectionné change vite, une réponse arrivée en retard pour l'ancien
  // programme ne doit jamais écraser la liste du nouveau.
  useEffect(() => {
    const idAppel = ++requeteId.current
    setChargementEpisodes(true)
    listerEpisodes(programme.id)
      .then((lignes) => {
        if (idAppel !== requeteId.current) return
        setEpisodes(lignes)
      })
      .catch((err) => {
        if (idAppel !== requeteId.current) return
        setErreur(err.message)
      })
      .finally(() => {
        if (idAppel === requeteId.current) setChargementEpisodes(false)
      })
  }, [programme.id])

  useEffect(() => {
    setExclusions(new Set())
  }, [dateDebut, dateFin, pas])

  function toggleException(date) {
    setExclusions((s) => {
      const next = new Set(s)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  const apercu = useMemo(() => {
    if (chargementEpisodes || episodes.length === 0) return []
    const pasValide = Number(pas) > 0 ? Number(pas) : 1
    const dates = datesParPas(dateDebut, dateFin, pasValide)
      .filter((d) => d !== diffusion.date)
      .sort()
    const indexOrigine = episodes.findIndex((ep) => ep.id === diffusion.episode_id)
    const base = indexOrigine === -1 ? 0 : indexOrigine
    return dates.map((date, i) => {
      const indexCible = base + i + 1
      if (indexCible >= episodes.length) {
        return { date, eligible: false, motif: `plus d'épisode disponible (${episodes.length} au total)` }
      }
      return { date, eligible: true, episode: episodes[indexCible] }
    })
  }, [dateDebut, dateFin, pas, episodes, chargementEpisodes, diffusion.date, diffusion.episode_id])

  const retenues = apercu.filter((a) => a.eligible && !exclusions.has(a.date))

  async function appliquer() {
    setEnregistrement(true)
    setErreur(null)
    try {
      const lignes = retenues.map((a) => ({
        programme_id: diffusion.programme_id,
        episode_id: a.episode.id,
        episode_numero: a.episode.numero,
        chaine: chaineActive.nom,
        chaine_id: chaineActive.id,
        grille_id: grilleId,
        date: a.date,
        heure_debut: diffusion.heure_debut,
        heure_fin: diffusion.heure_fin,
        genre: diffusion.genre,
        titre_cache: diffusion.titre_cache,
        // P27 : préserve l'exception vecteur du bloc d'origine sur chaque
        // occurrence répétée — auparavant omis du payload, une répétition
        // d'un bloc déjà scindé TNT/Satellite perdait silencieusement
        // l'exception sur les copies.
        vecteur: diffusion.vecteur ?? null,
      }))
      const creees = await creerDiffusionsLineaires(lignes)
      const entree = await enregistrerAction({
        chaineId: chaineActive.id,
        ecran: 'GRILLE_LINEAIRE',
        documentId: grilleId,
        libelle: `Répétition : ${diffusion.titre_cache} (${creees.length} occurrence${creees.length > 1 ? 's' : ''})`,
        operations: creees.map((d) => ({ table: 'diffusion_lineaire', type: 'INSERT', id: d.id, apres: d })),
      })
      onCreerPlusieurs(creees)
      setDerniereActionId(entree.id)
      setExclusions(new Set())
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  async function annulerViaPile() {
    if (!derniereActionId) return
    const { entreeActiveId } = await etatPile(chaineActive.id, 'GRILLE_LINEAIRE', grilleId)
    if (entreeActiveId !== derniereActionId) {
      setErreur("Cette répétition n'est plus la dernière action sur la grille — utilisez Annuler dans la barre d'outils.")
      return
    }
    const resultat = await annulerDerniereAction(chaineActive.id, 'GRILLE_LINEAIRE', grilleId)
    if (!resultat.ok) {
      setErreur(resultat.motif)
      return
    }
    onChangementsPile(resultat.changements)
    setDerniereActionId(null)
  }

  return (
    <div className="space-y-4 text-sm">
      <p className="text-xs text-slate-500">
        La répétition part de la date du bloc sélectionné, avance d'un pas fixe (en jours), incrémente les épisodes
        et écarte les dates au-delà du nombre d'épisodes disponibles. Décochez une ligne de l'aperçu pour sauter
        cette date précise.
      </p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Du</label>
          <input
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Au</label>
          <input
            type="date"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Pas (jours)</label>
          <input
            type="number"
            min="1"
            value={pas}
            onChange={(e) => setPas(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      {chargementEpisodes ? (
        <p className="text-xs text-slate-500">Chargement des épisodes…</p>
      ) : episodes.length === 0 ? (
        <p className="text-xs text-amber-600">Ce programme n'a aucun épisode.</p>
      ) : (
        <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200">
          {apercu.length === 0 && <p className="p-2 text-xs text-slate-500">Aucune date dans cette plage.</p>}
          {apercu.map((a) => (
            <div
              key={a.date}
              className={`flex items-center justify-between border-b border-slate-100 px-2 py-1.5 text-xs last:border-0 ${
                a.eligible ? 'text-slate-700' : 'text-slate-400'
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={a.eligible && !exclusions.has(a.date)}
                  disabled={!a.eligible}
                  onChange={() => toggleException(a.date)}
                />
                {formaterJourCourt(a.date)}
              </span>
              {a.eligible ? (
                <span className="font-mono">ÉP.{String(a.episode.numero).padStart(2, '0')}</span>
              ) : (
                <span>non éligible — {a.motif}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {erreur && <p className="text-xs text-red-600">{erreur}</p>}

      <button
        type="button"
        onClick={appliquer}
        disabled={enregistrement || retenues.length === 0}
        className="w-full rounded-md bg-snrt-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
      >
        {enregistrement ? 'Application…' : `Appliquer (${retenues.length})`}
      </button>

      {derniereActionId && (
        <div className="flex items-center justify-between rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          <span>Transmissions créées.</span>
          <button type="button" onClick={annulerViaPile} className="font-medium underline hover:no-underline">
            Annuler
          </button>
        </div>
      )}
    </div>
  )
}

const LIBELLES_VECTEUR = { TNT: 'TNT', SATELLITE: 'Satellite' }

function OngletVecteur({ diffusion, chaineActive, grilleId, diffusionsGrilleActive, onModifie, onSupprime, onCreerPlusieurs }) {
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const estException = diffusion.vecteur != null
  const { confirmer } = useNotification()

  // Scission (RG-10..14) : l'original garde son id et reçoit le vecteur
  // complémentaire, une nouvelle ligne est créée avec TOUS les champs de
  // l'original (copie complète par étalement, rien n'est oublié) sauf id et
  // vecteur. Pas de colonne de liaison entre les deux — limite assumée pour
  // cette tranche (RG-14 : revenir à l'unifié se fait manuellement en
  // déprogrammant l'une des deux lignes puis en remettant l'autre à
  // vecteur=NULL via son propre Inspecteur ; un vrai lien/fusion est prévu P19).
  async function creerException(valeurNouvelle) {
    setEnregistrement(true)
    setErreur(null)
    try {
      const valeurOriginal = valeurNouvelle === 'SATELLITE' ? 'TNT' : 'SATELLITE'
      const original = await mettreAJourDiffusionLineaire(diffusion.id, { vecteur: valeurOriginal })
      const { id: _id, ...champsACopier } = diffusion
      const nouvelle = await creerDiffusionLineaire({ ...champsACopier, vecteur: valeurNouvelle })
      // Action composée (1 update + 1 insert) : une seule entrée d'historique,
      // annulée/rétablie comme un bloc (jamais la moitié d'une scission).
      await enregistrerAction({
        chaineId: chaineActive.id,
        ecran: 'GRILLE_LINEAIRE',
        documentId: grilleId,
        libelle: `Scission vecteur : ${diffusion.titre_cache}`,
        operations: [
          { table: 'diffusion_lineaire', type: 'UPDATE', id: diffusion.id, avant: diffusion, apres: original },
          { table: 'diffusion_lineaire', type: 'INSERT', id: nouvelle.id, apres: nouvelle },
        ],
      })
      onModifie(original)
      onCreerPlusieurs([nouvelle])
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  // "Retirer du Satellite/du TNT" (P27) : à la différence de creerException
  // (qui duplique toujours en 2 versions, RG-12), cette action vide vraiment
  // le vecteur ciblé sur ce créneau — 3 cas selon l'état actuel de la ligne
  // inspectée :
  //  1. Unifiée : bascule cette ligne UNIQUE vers le vecteur restant (aucune
  //     ligne créée/supprimée) — elle disparaît des vues filtrées sur
  //     `vecteurACible` (GrilleLineaire.jsx, bascule Unifié/TNT/Satellite).
  //  2. La ligne inspectée EST déjà le côté ciblé : suppression directe
  //     (même primitive que Déprogrammer) — le panneau se ferme.
  //  3. La ligne inspectée est l'exception opposée : cherche la ligne sœur
  //     exacte sur ce créneau (même date/heure — pas de colonne de liaison
  //     entre les 2 lignes scindées, limite assumée RG-14 depuis P11) et la
  //     supprime ; si introuvable (déplacée depuis), message clair plutôt
  //     qu'une suppression silencieuse d'une autre ligne.
  // Toujours 1 seul enregistrerAction (1 UPDATE ou 1 DELETE) — annulable.
  async function retirerDuVecteur(vecteurACible) {
    setErreur(null)
    const libelle = LIBELLES_VECTEUR[vecteurACible]

    if (diffusion.vecteur == null) {
      const vecteurRestant = vecteurACible === 'TNT' ? 'SATELLITE' : 'TNT'
      const confirme = await confirmer({
        titre: `Retirer du ${libelle}`,
        message: `« ${diffusion.titre_cache} » ne sera plus diffusé sur ${libelle} à cet horaire (${diffusion.heure_debut}, ${formaterDateLongue(diffusion.date)}) — il restera diffusé sur ${LIBELLES_VECTEUR[vecteurRestant]} uniquement. Cette action est annulable.`,
        labelConfirmer: `Retirer du ${libelle}`,
      })
      if (!confirme) return
      setEnregistrement(true)
      try {
        const maj = await mettreAJourDiffusionLineaire(diffusion.id, { vecteur: vecteurRestant })
        await enregistrerAction({
          chaineId: chaineActive.id,
          ecran: 'GRILLE_LINEAIRE',
          documentId: grilleId,
          libelle: `Retrait du ${libelle} : ${diffusion.titre_cache}`,
          operations: [{ table: 'diffusion_lineaire', type: 'UPDATE', id: diffusion.id, avant: diffusion, apres: maj }],
        })
        onModifie(maj)
      } catch (err) {
        setErreur(err.message)
      } finally {
        setEnregistrement(false)
      }
      return
    }

    const cible =
      diffusion.vecteur === vecteurACible
        ? diffusion
        : (diffusionsGrilleActive ?? []).find(
            (d) =>
              d.id !== diffusion.id &&
              d.date === diffusion.date &&
              d.heure_debut === diffusion.heure_debut &&
              d.heure_fin === diffusion.heure_fin &&
              d.vecteur === vecteurACible
          )
    if (!cible) {
      setErreur(
        `Aucune version ${libelle} trouvée sur ce créneau exact — si elle a été déplacée, supprimez-la depuis son propre Inspecteur.`
      )
      return
    }
    const confirme = await confirmer({
      titre: `Retirer du ${libelle}`,
      message: `La version ${libelle} de « ${cible.titre_cache} » sur ce créneau (${cible.heure_debut}, ${formaterDateLongue(cible.date)}) sera supprimée. Cette action est annulable.`,
      labelConfirmer: `Retirer du ${libelle}`,
    })
    if (!confirme) return
    setEnregistrement(true)
    try {
      await supprimerDiffusionLineaire(cible.id)
      await enregistrerAction({
        chaineId: chaineActive.id,
        ecran: 'GRILLE_LINEAIRE',
        documentId: grilleId,
        libelle: `Retrait du ${libelle} : ${cible.titre_cache}`,
        operations: [{ table: 'diffusion_lineaire', type: 'DELETE', id: cible.id, avant: cible }],
      })
      onSupprime(cible.id)
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <div>
        <div className="mb-1 text-xs font-medium text-slate-700">État actuel</div>
        {estException ? (
          <span
            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold ${
              diffusion.vecteur === 'SATELLITE' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
            }`}
          >
            {diffusion.vecteur === 'SATELLITE' ? <Radio size={12} /> : <Tv size={12} />}
            Exception {diffusion.vecteur === 'SATELLITE' ? 'Satellite' : 'TNT'}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
            <Layers3 size={12} />
            Unifié (TNT + Satellite)
          </span>
        )}
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <div className="mb-1.5 flex items-center gap-1.5 font-semibold">
          <SplitSquareHorizontal size={13} />
          Grille unique, exceptions par vecteur
        </div>
        Une seule grille est saisie. Créer une exception scinde ce bloc en une version TNT et une version Satellite,
        modifiables indépendamment.
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={estException || enregistrement}
            onClick={() => creerException('SATELLITE')}
            className="flex-1 rounded-md border border-amber-300 bg-white px-2 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            Exception satellite
          </button>
          <button
            type="button"
            disabled={estException || enregistrement}
            onClick={() => creerException('TNT')}
            className="flex-1 rounded-md border border-amber-300 bg-white px-2 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            Exception TNT
          </button>
        </div>
        {estException && (
          <p className="mt-2 text-[11px] italic">
            Ce bloc est déjà une exception — pas de fusion automatique dans cette tranche. Pour revenir à l'unifié :
            déprogrammer cette ligne puis remettre l'autre à Unifié (prévu P19).
          </p>
        )}
      </div>

      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
        <div className="mb-1.5 flex items-center gap-1.5 font-semibold">
          <SplitSquareHorizontal size={13} />
          Retirer un vecteur
        </div>
        Vide vraiment ce créneau côté vecteur choisi (à l'inverse d'une exception, rien ne s'y diffuse plus) — le
        contenu restant, s'il existe, n'est pas touché.
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={enregistrement}
            onClick={() => retirerDuVecteur('SATELLITE')}
            className="flex-1 rounded-md border border-red-300 bg-white px-2 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
          >
            Retirer du Satellite
          </button>
          <button
            type="button"
            disabled={enregistrement}
            onClick={() => retirerDuVecteur('TNT')}
            className="flex-1 rounded-md border border-red-300 bg-white px-2 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
          >
            Retirer du TNT
          </button>
        </div>
      </div>
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
    </div>
  )
}
