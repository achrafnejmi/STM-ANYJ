import { useEffect, useId, useState } from 'react'
import { ArrowLeft, Paperclip, Loader2 } from 'lucide-react'
import {
  obtenirProgramme,
  creerProgramme,
  mettreAJourProgramme,
  televerserAttestation,
  urlAttestation,
  listerEpisodes,
} from '../lib/db.js'
import { lireUtilisateur } from '../lib/session.js'
import { CHAINES, chaineParNom } from '../lib/chaines.js'
import { GENRES } from '../lib/genres.js'
import EpisodesPanel from './EpisodesPanel.jsx'
import FenetresDroitsPanel from '../components/FenetresDroitsPanel.jsx'
import HistoriqueTitrePanel from '../components/HistoriqueTitrePanel.jsx'

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
  chaine: '',
  date_production: '',
  code: '',
  description: '',
  description_ar: '',
  description_en: '',
  auteur: '',
  exclusivite: false,
  reference_contrat: '',
}

function versFormulaire(programme) {
  return {
    titre: programme.titre ?? '',
    titre_ar: programme.titre_ar ?? '',
    titre_en: programme.titre_en ?? '',
    genre: programme.genre ?? '',
    sous_genre: programme.sous_genre ?? '',
    chaine: programme.chaine ?? '',
    date_production: programme.date_production ?? '',
    code: programme.code ?? '',
    description: programme.description ?? '',
    description_ar: programme.description_ar ?? '',
    description_en: programme.description_en ?? '',
    auteur: programme.auteur ?? '',
    exclusivite: programme.exclusivite ?? false,
    reference_contrat: programme.reference_contrat ?? '',
  }
}

export default function FicheProgramme({ programmeId: idInitial, chaineActive, onRetour }) {
  const [id, setId] = useState(idInitial)
  const [form, setForm] = useState(() => (idInitial ? FORM_VIDE : { ...FORM_VIDE, chaine: chaineActive.nom }))
  const [programme, setProgramme] = useState(null)
  const [chargement, setChargement] = useState(Boolean(idInitial))
  const [onglet, setOnglet] = useState('GENERAL')
  const [langueActive, setLangueActive] = useState('FR')
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [messageSucces, setMessageSucces] = useState(null)
  const [nombreEpisodes, setNombreEpisodes] = useState(0)
  const [televersementEnCours, setTeleversementEnCours] = useState(false)
  const idDescription = useId()
  const idExclusivite = useId()

  useEffect(() => {
    if (!idInitial) return
    obtenirProgramme(idInitial).then((p) => {
      setProgramme(p)
      setForm(versFormulaire(p))
      setChargement(false)
    })
  }, [idInitial])

  useEffect(() => {
    if (!id) return
    listerEpisodes(id)
      .then((lignes) => setNombreEpisodes(lignes.length))
      .catch(() => {})
  }, [id])

  function afficherSucces(texte) {
    setMessageSucces(texte)
    setTimeout(() => setMessageSucces(null), 4000)
  }

  async function enregistrer(e) {
    e.preventDefault()
    setEnregistrement(true)
    setErreur(null)
    setMessageSucces(null)
    const champs = {
      titre: form.titre.trim(),
      titre_ar: form.titre_ar.trim() || null,
      titre_en: form.titre_en.trim() || null,
      genre: form.genre.trim() || null,
      sous_genre: form.sous_genre.trim() || null,
      chaine: form.chaine.trim(),
      chaine_id: chaineParNom(form.chaine.trim())?.id ?? null,
      date_production: form.date_production || null,
      code: form.code.trim() || null,
      description: form.description.trim() || null,
      description_ar: form.description_ar.trim() || null,
      description_en: form.description_en.trim() || null,
      auteur: form.auteur.trim() || null,
      exclusivite: form.exclusivite,
      reference_contrat: form.reference_contrat.trim() || null,
    }
    if (!champs.titre) {
      setErreur('Le titre (français) est obligatoire.')
      setEnregistrement(false)
      return
    }
    try {
      if (id) {
        const maj = await mettreAJourProgramme(id, champs)
        setProgramme(maj)
        afficherSucces('Programme modifié.')
      } else {
        const cree = await creerProgramme({ ...champs, cree_par: lireUtilisateur() })
        setProgramme(cree)
        setId(cree.id)
        afficherSucces('Programme créé.')
      }
    } catch (err) {
      if (err.code === '23505') {
        setErreur('Un programme avec ce titre existe déjà sur cette chaîne (titre + chaîne doivent être uniques).')
      } else {
        setErreur(err.message)
      }
    } finally {
      setEnregistrement(false)
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

  if (chargement) {
    return <p className="text-sm text-slate-500">Chargement…</p>
  }

  const langueInfo = LANGUES.find((l) => l.id === langueActive)

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onRetour}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={16} />
        Retour à la liste
      </button>

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
                label="Chaîne *"
                required
                value={form.chaine}
                onChange={(v) => setForm({ ...form, chaine: v })}
                options={CHAINES.map((c) => ({ valeur: c.nom, libelle: c.nom }))}
              />
              <Champ label="Date de production" type="date" value={form.date_production} onChange={(v) => setForm({ ...form, date_production: v })} />
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
            <label htmlFor={idExclusivite} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                id={idExclusivite}
                type="checkbox"
                checked={form.exclusivite}
                onChange={(e) => setForm({ ...form, exclusivite: e.target.checked })}
              />
              Exclusivité
            </label>

            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm text-slate-500">
              <div>Créé par : {programme?.cree_par || '—'}</div>
              <div>Créé le : {programme?.cree_le ? new Date(programme.cree_le).toLocaleString('fr-FR') : '—'}</div>
              <div>Nombre d'épisodes : {nombreEpisodes}</div>
            </div>

            {messageSucces && <p className="text-sm text-emerald-600">{messageSucces}</p>}
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
            {messageSucces && <p className="text-sm text-emerald-600">{messageSucces}</p>}
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
        <EpisodesPanel programmeId={id} onEpisodesChange={(episodes) => setNombreEpisodes(episodes.length)} />
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
            {messageSucces && <p className="mt-4 text-sm text-emerald-600">{messageSucces}</p>}
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
