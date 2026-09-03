import { useCallback, useEffect, useId, useState } from 'react'
import { ArrowLeft, Paperclip, Loader2, Trash2 } from 'lucide-react'
import {
  obtenirProgramme,
  creerProgramme,
  mettreAJourProgramme,
  supprimerProgramme,
  televerserAttestation,
  urlAttestation,
  listerEpisodes,
  listerDemandesProgrammationParProgramme,
  creerDemandeProgrammation,
  creerNotifications,
} from '../lib/db.js'
import { lireUtilisateur } from '../lib/session.js'
import { CHAINES } from '../lib/chaines.js'
import { GENRES } from '../lib/genres.js'
import { messageNouveauProgramme, messageDemandeProgAT } from '../lib/notifications.js'
import { peutGererCatalogue, peutDemanderProgrammation } from '../lib/roles.js'
import { chaineAutoriseeProgramme, estExclusifAutreChaine } from '../lib/exclusivite.js'
import EpisodesPanel from './EpisodesPanel.jsx'
import FenetresDroitsPanel from '../components/FenetresDroitsPanel.jsx'
import HistoriqueTitrePanel from '../components/HistoriqueTitrePanel.jsx'
import Toggle from '../components/Toggle.jsx'
import { useNotification, useGardeModifications, useSignalerModifications } from '../components/NotificationProvider.jsx'

const TAILLE_MAX_ATTESTATION = 5 * 1024 * 1024 // 5 Mo

const ONGLETS = [
  { id: 'GENERAL', label: 'Général', requiertId: false },
  { id: 'METADONNEES', label: 'Métadonnées', requiertId: false },
  { id: 'EPISODES', label: 'Épisodes', requiertId: true },
  { id: 'DROITS', label: 'Droits', requiertId: true },
  { id: 'HISTORIQUE', label: 'Historique', requiertId: true },
]

// Colonne de sélection de la langue (§4.7.3) : FR réutilise les champs
// titre/description existants (pas de titre_fr séparé, le champ « nu » est
// le français — même convention que titre_ar) ; AR/EN sont les nouveaux
// champs multilingues de P14b (EXG-M6-03).
const LANGUES = [
  { id: 'FR', label: 'Français', champTitre: 'titre', champDescription: 'description', rtl: false },
  { id: 'AR', label: 'العربية', champTitre: 'titre_ar', champDescription: 'description_ar', rtl: true },
  { id: 'EN', label: 'English', champTitre: 'titre_en', champDescription: 'description_en', rtl: false },
]

const FORM_VIDE = {
  titre: '',
  titre_ar: '',
  titre_en: '',
  genre: '',
  sous_genre: '',
  date_production: '',
  code: '',
  description: '',
  description_ar: '',
  description_en: '',
  auteur: '',
  // P22 — modèle d'exclusivité : chaine_id NULL = partagé toutes chaînes
  // (par défaut). `exclusif` pilote l'interrupteur ; `chaineExclusiveId`
  // reste renseigné même quand `exclusif` est faux (mémorise le dernier choix
  // si l'utilisateur active/désactive l'interrupteur plusieurs fois).
  exclusif: false,
  chaineExclusiveId: '',
  reference_contrat: '',
}

// `chaineExclusiveId` garde toujours une valeur (jamais '') même pour un
// programme partagé : le menu « Chaîne exclusive » reste masqué tant que
// `exclusif` est faux, mais préremplir avec `chaineActive.id` (au lieu de '')
// évite un faux « modifications non enregistrées » au chargement — sinon ce
// champ divergerait de `valeurVide` (P22, cf. useGardeModifications).
function versFormulaire(programme, chaineActive) {
  return {
    titre: programme.titre ?? '',
    titre_ar: programme.titre_ar ?? '',
    titre_en: programme.titre_en ?? '',
    genre: programme.genre ?? '',
    sous_genre: programme.sous_genre ?? '',
    date_production: programme.date_production ?? '',
    code: programme.code ?? '',
    description: programme.description ?? '',
    description_ar: programme.description_ar ?? '',
    description_en: programme.description_en ?? '',
    auteur: programme.auteur ?? '',
    exclusif: programme.chaine_id != null,
    chaineExclusiveId: programme.chaine_id ?? chaineActive.id,
    reference_contrat: programme.reference_contrat ?? '',
  }
}

export default function FicheProgramme({ programmeId: idInitial, chaineActive, onRetour, ongletInitial = 'GENERAL', onModifieChange, onNotificationCreee, roleUtilisateur }) {
  const [id, setId] = useState(idInitial)
  const valeurVide = { ...FORM_VIDE, chaineExclusiveId: chaineActive.id }
  const [form, setForm] = useState(() => (idInitial ? FORM_VIDE : valeurVide))
  const [valeurInitiale, setValeurInitiale] = useState(() => (idInitial ? FORM_VIDE : valeurVide))
  const [programme, setProgramme] = useState(null)
  const [chargement, setChargement] = useState(Boolean(idInitial))
  const [onglet, setOnglet] = useState(ongletInitial)
  const [langueActive, setLangueActive] = useState('FR')
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [nombreEpisodes, setNombreEpisodes] = useState(0)
  const [televersementEnCours, setTeleversementEnCours] = useState(false)
  const [demandesProg, setDemandesProg] = useState([])
  const [envoiDemandeProg, setEnvoiDemandeProg] = useState(false)
  const idDescription = useId()
  const idExclusif = useId()
  const notifier = useNotification()

  useEffect(() => {
    if (!idInitial) return
    obtenirProgramme(idInitial).then((p) => {
      setProgramme(p)
      setForm(versFormulaire(p, chaineActive))
      setValeurInitiale(versFormulaire(p, chaineActive))
      setChargement(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chaineActive sert juste de valeur par défaut pour un champ masqué (P22) ; un changement de chaîne active pendant l'édition ne doit pas relancer le chargement du programme
  }, [idInitial])

  useEffect(() => {
    if (!id) return
    listerEpisodes(id)
      .then((lignes) => setNombreEpisodes(lignes.length))
      .catch(() => {})
  }, [id])

  const rafraichirDemandesProg = useCallback(() => {
    if (!id) return
    listerDemandesProgrammationParProgramme(id)
      .then(setDemandesProg)
      .catch(() => {})
  }, [id])

  useEffect(() => {
    rafraichirDemandesProg()
  }, [rafraichirDemandesProg])

  // Garde-fou "modifications non enregistrées" (P21 Lot G) — reporté à
  // Programmes.jsx pour protéger une réouverture externe (recherche globale,
  // Contrats & droits) pendant que cette fiche est en cours d'édition.
  const { estModifie, demanderConfirmation } = useGardeModifications(form, valeurInitiale)
  useSignalerModifications(estModifie, onModifieChange)

  async function gererRetour() {
    if (!(await demanderConfirmation())) return
    onRetour()
  }

  async function enregistrer(e) {
    e.preventDefault()
    setErreur(null)
    const chaineExclusive = form.exclusif ? CHAINES.find((c) => c.id === form.chaineExclusiveId) : null
    if (form.exclusif && !chaineExclusive) {
      setErreur('Sélectionnez la chaîne exclusive.')
      return
    }
    const champs = {
      titre: form.titre.trim(),
      titre_ar: form.titre_ar.trim() || null,
      titre_en: form.titre_en.trim() || null,
      genre: form.genre.trim() || null,
      sous_genre: form.sous_genre.trim() || null,
      chaine: chaineExclusive?.nom ?? null,
      chaine_id: chaineExclusive?.id ?? null,
      date_production: form.date_production || null,
      code: form.code.trim() || null,
      description: form.description.trim() || null,
      description_ar: form.description_ar.trim() || null,
      description_en: form.description_en.trim() || null,
      auteur: form.auteur.trim() || null,
      reference_contrat: form.reference_contrat.trim() || null,
    }
    if (!champs.titre) {
      setErreur('Le titre (français) est obligatoire.')
      return
    }
    if (id && !estModifie) {
      notifier.info('Aucune modification à enregistrer.')
      return
    }
    setEnregistrement(true)
    try {
      if (id) {
        const maj = await mettreAJourProgramme(id, champs)
        setProgramme(maj)
        setValeurInitiale(versFormulaire(maj, chaineActive))
        notifier.succes('Programme modifié.')
      } else {
        const cree = await creerProgramme({ ...champs, cree_par: lireUtilisateur() })
        setProgramme(cree)
        setId(cree.id)
        setValeurInitiale(versFormulaire(cree, chaineActive))
        notifier.succes('Programme créé.')
        // P29 : notification persistante « nouveau programme » — partagé
        // (chaine_id null, modèle P22) → une ligne par chaîne (fan-out, le
        // catalogue est commun) ; exclusif → une seule ligne. Best-effort :
        // une erreur ici ne doit jamais faire échouer la création déjà
        // réussie du programme.
        const chainesCibles = cree.chaine_id ? [cree.chaine_id] : CHAINES.map((c) => c.id)
        creerNotifications(
          chainesCibles.map((chaineId) => ({
            chaine_id: chaineId,
            type: 'NOUVEAU_PROGRAMME',
            programme_id: cree.id,
            message: messageNouveauProgramme(cree),
            lu: false,
          }))
        )
          .then(() => onNotificationCreee?.())
          .catch((err) => console.error('Notification « nouveau programme » impossible :', err))
      }
    } catch (err) {
      if (err.code === '23505') {
        setErreur('Un programme avec ce titre existe déjà (partagé, ou déjà exclusif à cette chaîne).')
      } else {
        setErreur(err.message)
      }
    } finally {
      setEnregistrement(false)
    }
  }

  // Suppression (retouche post-P29) : toutes les FK vers programme(id) sont
  // déjà en cascade (episode, diffusion_lineaire, publication_reseau,
  // publication_vod, fenetre_droits, campagne, notification) — le message de
  // confirmation doit donc être explicite sur tout ce qui disparaît avec, et
  // rappeler que ce n'est PAS couvert par Annuler/Rétablir (aucun
  // enregistrerAction ici, contrairement aux écritures de grille).
  async function supprimer() {
    if (!id || !programme) return
    const ok = await notifier.confirmer({
      titre: 'Supprimer le programme',
      message: `Supprimer « ${programme.titre} » ? Cette action est irréversible et supprimera aussi : ${nombreEpisodes} épisode${nombreEpisodes > 1 ? 's' : ''}, ses fenêtres de droits, et toutes ses diffusions programmées (grilles linéaire et non-linéaire). Cette suppression n'est PAS annulable (Ctrl+Z ne la couvre pas).`,
      labelConfirmer: 'Supprimer définitivement',
    })
    if (!ok) return
    try {
      await supprimerProgramme(id)
      notifier.succes('Programme supprimé.')
      onRetour()
    } catch (err) {
      setErreur(err.message)
    }
  }

  async function handleAttestation(e) {
    const fichier = e.target.files?.[0]
    e.target.value = ''
    if (!fichier || !id) return
    if (fichier.size > TAILLE_MAX_ATTESTATION) {
      setErreur('Fichier trop volumineux (5 Mo maximum).')
      return
    }
    setErreur(null)
    setTeleversementEnCours(true)
    try {
      const chemin = await televerserAttestation(id, fichier)
      const maj = await mettreAJourProgramme(id, { attestation_chemin: chemin })
      setProgramme(maj)
    } catch (err) {
      setErreur(err.message)
    } finally {
      setTeleversementEnCours(false)
    }
  }

  // Exclusivité inter-chaînes (P37) : ce titre est-il exclusif à une AUTRE
  // chaîne que celle active, et cette chaîne a-t-elle déjà l'autorisation ?
  const estExclusifAutre = !!programme && estExclusifAutreChaine(programme, chaineActive.id)
  const dejaAutorise = !!programme && chaineAutoriseeProgramme(programme, chaineActive.id)
  const demandeProgActive = demandesProg.find(
    (d) => d.chaine_demandeuse_id === chaineActive.id && ['A_TRANSMETTRE', 'SOUMISE'].includes(d.statut)
  )
  const nomChaineExclu = estExclusifAutre ? CHAINES.find((c) => c.id === programme.chaine_id)?.nom ?? 'autre chaîne' : null

  async function demanderProgrammation() {
    if (!programme) return
    const motif = window.prompt('Motif de la demande de programmation (optionnel) :', '')
    if (motif === null) return
    setEnvoiDemandeProg(true)
    setErreur(null)
    try {
      await creerDemandeProgrammation({
        programme_id: programme.id,
        chaine_demandeuse_id: chaineActive.id,
        chaine_exclusive_id: programme.chaine_id,
        demandeur: lireUtilisateur(),
        motif: motif.trim() || null,
      })
      await creerNotifications([
        {
          chaine_id: chaineActive.id,
          type: 'DEMANDE_PROG_A_TRANSMETTRE',
          destinataire_role: 'ADMIN_CHAINE',
          programme_id: programme.id,
          message: messageDemandeProgAT(programme.titre, chaineActive.nom),
          lu: false,
        },
      ])
      onNotificationCreee?.()
      notifier.succes('Demande de programmation envoyée à votre administrateur de chaîne.')
      rafraichirDemandesProg()
    } catch (err) {
      setErreur(err.message)
      notifier.erreur(err.message)
    } finally {
      setEnvoiDemandeProg(false)
    }
  }

  if (chargement) {
    return <p className="text-sm text-slate-500">Chargement…</p>
  }

  // Un rôle sans gestion du catalogue ne crée pas de programme (P37).
  if (!id && !peutGererCatalogue(roleUtilisateur)) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={onRetour} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={16} />
          Retour à la liste
        </button>
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          La création d'un programme est réservée au catalogage (Acquisitions), à l'administrateur de chaîne et au
          super administrateur.
        </p>
      </div>
    )
  }

  const langueInfo = LANGUES.find((l) => l.id === langueActive)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={gererRetour}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={16} />
          Retour à la liste
        </button>
        {id && peutGererCatalogue(roleUtilisateur) && (
          <button
            type="button"
            onClick={supprimer}
            className="flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 size={14} />
            Supprimer le programme
          </button>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Définition de programme</h2>

        <div className="mb-4 flex max-w-2xl gap-1 rounded-md bg-slate-100 p-1 text-sm">
          {ONGLETS.map((o) => {
            const desactive = o.requiertId && !id
            return (
              <button
                key={o.id}
                type="button"
                disabled={desactive}
                onClick={() => setOnglet(o.id)}
                title={desactive ? "Enregistrez d'abord le programme (onglet Général)" : undefined}
                className={`flex-1 rounded px-2 py-1.5 font-medium transition-colors ${
                  onglet === o.id
                    ? 'bg-white text-snrt-navy shadow-sm'
                    : desactive
                      ? 'cursor-not-allowed text-slate-300'
                      : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {o.label}
              </button>
            )
          })}
        </div>

        {onglet === 'GENERAL' && (
          <form onSubmit={enregistrer} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Champ label="Titre *" required value={form.titre} onChange={(v) => setForm({ ...form, titre: v })} />
              <Champ
                label="Titre (arabe)"
                dir="rtl"
                value={form.titre_ar}
                onChange={(v) => setForm({ ...form, titre_ar: v })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <ChampSelect
                label="Genre"
                value={form.genre}
                onChange={(v) => setForm({ ...form, genre: v })}
                options={GENRES.map((g) => ({ valeur: g.fr, libelle: `${g.fr} — ${g.ar}` }))}
                vide="— Choisir un genre —"
              />
              <Champ label="Sous-genre" value={form.sous_genre} onChange={(v) => setForm({ ...form, sous_genre: v })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Champ label="Date de production" type="date" value={form.date_production} onChange={(v) => setForm({ ...form, date_production: v })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Champ label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v })} />
              <Champ label="Auteur" value={form.auteur} onChange={(v) => setForm({ ...form, auteur: v })} />
            </div>
            <div>
              <label htmlFor={idDescription} className="mb-1 block text-sm font-medium text-slate-700">
                Description
              </label>
              <textarea
                id={idDescription}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            {estExclusifAutre ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-medium text-slate-700">Exclusif à {nomChaineExclu}</p>
                {dejaAutorise ? (
                  <p className="mt-1 text-sm text-emerald-700">
                    ✓ {chaineActive.nom} est autorisée à programmer ce titre.
                  </p>
                ) : demandeProgActive ? (
                  <p className="mt-1 text-sm text-amber-700">
                    Demande de programmation en cours —{' '}
                    {demandeProgActive.statut === 'A_TRANSMETTRE'
                      ? 'en attente de votre administrateur de chaîne'
                      : "transmise, en attente de l'administrateur de " + nomChaineExclu}
                    .
                  </p>
                ) : (
                  <>
                    <p className="mt-1 text-xs text-slate-500">
                      Ce titre n'est pas programmable par {chaineActive.nom} sans l'accord de {nomChaineExclu}.
                    </p>
                    {peutDemanderProgrammation(roleUtilisateur) && (
                      <button
                        type="button"
                        onClick={demanderProgrammation}
                        disabled={envoiDemandeProg}
                        className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                      >
                        {envoiDemandeProg ? 'Envoi…' : 'Demander à bénéficier de ce programme'}
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3">
                  <Toggle
                    id={idExclusif}
                    checked={form.exclusif}
                    onChange={(v) =>
                      setForm({
                        ...form,
                        exclusif: v,
                        chaineExclusiveId: form.chaineExclusiveId || chaineActive.id,
                      })
                    }
                    label="Exclusif à cette chaîne"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        exclusif: !form.exclusif,
                        chaineExclusiveId: form.chaineExclusiveId || chaineActive.id,
                      })
                    }
                    className="text-sm font-medium text-slate-700"
                  >
                    Exclusif à cette chaîne
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Programme partagé par toutes les chaînes par défaut ; activez pour le réserver à une chaîne.
                </p>
                {form.exclusif && (
                  <div className="mt-3 max-w-xs">
                    <ChampSelect
                      label="Chaîne exclusive"
                      required
                      value={form.chaineExclusiveId}
                      onChange={(v) => setForm({ ...form, chaineExclusiveId: v })}
                      options={CHAINES.map((c) => ({ valeur: c.id, libelle: c.nom }))}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm text-slate-500">
              <div>Créé par : {programme?.cree_par || '—'}</div>
              <div>Créé le : {programme?.cree_le ? new Date(programme.cree_le).toLocaleString('fr-FR') : '—'}</div>
              <div>Nombre d'épisodes : {nombreEpisodes}</div>
            </div>

            {erreur && <p className="text-sm text-red-600">{erreur}</p>}
            <button
              type="submit"
              disabled={enregistrement}
              className="rounded-md bg-snrt-navy px-4 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
            >
              {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </form>
        )}

        {onglet === 'METADONNEES' && (
          <form onSubmit={enregistrer} className="space-y-4">
            <div className="grid grid-cols-[10rem_1fr] gap-6">
              <div className="flex flex-col gap-1">
                {LANGUES.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLangueActive(l.id)}
                    className={`rounded-md px-3 py-2 text-left text-sm font-medium ${
                      langueActive === l.id ? 'bg-snrt-navy/5 text-snrt-navy' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <div className="space-y-4" dir={langueInfo.rtl ? 'rtl' : 'ltr'}>
                <Champ
                  label={`Titre (${langueInfo.label})`}
                  required={langueInfo.id === 'FR'}
                  dir={langueInfo.rtl ? 'rtl' : undefined}
                  value={form[langueInfo.champTitre]}
                  onChange={(v) => setForm({ ...form, [langueInfo.champTitre]: v })}
                />
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Description ({langueInfo.label})</label>
                  <textarea
                    value={form[langueInfo.champDescription]}
                    onChange={(e) => setForm({ ...form, [langueInfo.champDescription]: e.target.value })}
                    dir={langueInfo.rtl ? 'rtl' : undefined}
                    rows={5}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
            {erreur && <p className="text-sm text-red-600">{erreur}</p>}
            <button
              type="submit"
              disabled={enregistrement}
              className="rounded-md bg-snrt-navy px-4 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
            >
              {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </form>
        )}
      </div>

      {onglet === 'EPISODES' && id && (
        <EpisodesPanel
          programmeId={id}
          programmeTitre={form.titre}
          chaineActive={chaineActive}
          roleUtilisateur={roleUtilisateur}
          onNotificationCreee={onNotificationCreee}
          onEpisodesChange={(episodes) => setNombreEpisodes(episodes.length)}
        />
      )}
      {onglet === 'DROITS' && id && (
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Contrat</h2>
            <form onSubmit={enregistrer} className="mb-4 flex items-end gap-3">
              <div className="max-w-xs flex-1">
                <Champ
                  label="Référence"
                  value={form.reference_contrat}
                  onChange={(v) => setForm({ ...form, reference_contrat: v })}
                />
              </div>
              <button
                type="submit"
                disabled={enregistrement}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </form>
            <div className="flex items-center gap-3">
              <label
                className={`flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white ${
                  televersementEnCours ? 'opacity-60' : 'cursor-pointer hover:bg-slate-700'
                }`}
              >
                {televersementEnCours ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
                {televersementEnCours ? 'Envoi…' : 'Choisir un fichier'}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleAttestation}
                  disabled={televersementEnCours}
                />
              </label>
              {programme?.attestation_chemin && (
                <a
                  href={urlAttestation(programme.attestation_chemin)}
                  target="_blank"
                  rel="noreferrer"
                  title={programme.attestation_chemin.split('/').pop()}
                  className="text-sm text-snrt-blue hover:underline"
                >
                  Consulter le contrat
                </a>
              )}
            </div>
            {erreur && <p className="mt-4 text-sm text-red-600">{erreur}</p>}
          </div>
          <FenetresDroitsPanel programmeId={id} />
        </div>
      )}
      {onglet === 'HISTORIQUE' && id && <HistoriqueTitrePanel programmeId={id} />}
    </div>
  )
}

function Champ({ label, type = 'text', value, onChange, required, dir }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        dir={dir}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
    </div>
  )
}

function ChampSelect({ label, value, onChange, required, options, vide }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        id={id}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      >
        {!required && <option value="">{vide ?? '—'}</option>}
        {options.map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle}
          </option>
        ))}
      </select>
    </div>
  )
}
