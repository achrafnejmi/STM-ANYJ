// Droits d'auteur — comptage des diffusions payantes pour la finance (P37b).
// ASSISTANT, PAS AUTORITÉ : l'app ne calcule aucun montant. Elle rapproche la
// pige (diffusion_reelle) des programmes EXTERNES par le NOM (approximatif,
// rapprochementPige.js), compte les diffusions réelles et les diffusions
// payantes (au-delà de `seuil_gratuit`, 3 par défaut). La Gestion des droits et
// du stock (Oumnia) vérifie chaque programme (décoche les faux positifs,
// corrige, valide) avant l'export finance. Réservé à GESTION_DROITS_STOCK +
// SUPER_ADMIN.
import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Coins, FileSpreadsheet, CheckCircle2, Circle, TriangleAlert } from 'lucide-react'
import {
  listerProgrammesParChaine,
  listerDroitsAuteur,
  listerDiffusionsReellesProgrammesActives,
  enregistrerDroitAuteur,
} from '../lib/db.js'
import { pigeCorrespondAuTitre, natureDepuisLibelle } from '../lib/rapprochementPige.js'
import { calculerDroitProgramme, annoterRangs, SEUIL_GRATUIT_DEFAUT } from '../lib/droitsAuteur.js'
import {
  construireDonneesDroitsAuteur,
  construireFeuilleRecap,
  construireFeuilleDetail,
  nomFichierDroitsAuteur,
} from '../lib/exportDroitsAuteur.js'
import { aujourdHuiISO, formaterDateLongue } from '../lib/semaine.js'
import { lireUtilisateur } from '../lib/session.js'
import { peutCalculerDroitsAuteur } from '../lib/roles.js'
import { CHAINES } from '../lib/chaines.js'
import { useNotification } from '../components/NotificationProvider.jsx'
import Modal from '../components/Modal.jsx'

function nomChaineProgramme(p) {
  if (!p.chaine_id) return 'Partagé'
  return CHAINES.find((c) => c.id === p.chaine_id)?.nom ?? '—'
}

export default function DroitsAuteur({ chaineActive, roleUtilisateur }) {
  const autorise = peutCalculerDroitsAuteur(roleUtilisateur)
  const { confirmer } = useNotification()

  const [programmes, setProgrammes] = useState([])
  const [droits, setDroits] = useState([])
  const [diffusions, setDiffusions] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [panneauId, setPanneauId] = useState(null)

  function recharger() {
    setChargement(true)
    setErreur(null)
    Promise.all([
      listerProgrammesParChaine(chaineActive.id),
      listerDroitsAuteur(),
      listerDiffusionsReellesProgrammesActives(),
    ])
      .then(([progs, dr, diff]) => {
        setProgrammes(progs.filter((p) => p.production === 'EXTERNE'))
        setDroits(dr)
        setDiffusions(diff)
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- ne réagit qu'au changement de chaîne
  useEffect(() => recharger(), [chaineActive])

  const droitParProg = useMemo(() => new Map(droits.map((d) => [d.programme_id, d])), [droits])

  // Rapprochement par nom (même logique que la sous-vue « Antenne ») —
  // approximatif, corrigé ensuite par Oumnia dans le panneau de vérification.
  const rapprocheesParProg = useMemo(() => {
    const m = new Map()
    for (const p of programmes) {
      const rows = diffusions
        .filter((d) => pigeCorrespondAuTitre(d.programme, [p.titre, p.titre_ar]))
        .sort((a, b) => a.date.localeCompare(b.date) || (a.heure_debut ?? '').localeCompare(b.heure_debut ?? ''))
      m.set(p.id, rows)
    }
    return m
  }, [programmes, diffusions])

  const lignes = useMemo(
    () =>
      programmes
        .map((p) => {
          const droit = droitParProg.get(p.id) ?? null
          const rapprochees = rapprocheesParProg.get(p.id) ?? []
          return { p, droit, rapprochees, calc: calculerDroitProgramme({ rapprochees, droit }) }
        })
        .sort((a, b) => a.p.titre.localeCompare(b.p.titre)),
    [programmes, droitParProg, rapprocheesParProg]
  )

  function construireBundle(brouillon) {
    const inclus = lignes.filter((l) => brouillon || l.droit?.valide)
    return construireDonneesDroitsAuteur({
      chaineNom: chaineActive.nom,
      dateISO: aujourdHuiISO(),
      utilisateur: lireUtilisateur(),
      brouillon,
      programmes: inclus.map((l) => {
        const exclues = new Set(l.droit?.exclusions ?? [])
        const seuil = l.droit?.seuil_gratuit ?? SEUIL_GRATUIT_DEFAUT
        let rang = 0
        return {
          titre: l.p.titre,
          chaineNom: nomChaineProgramme(l.p),
          note: l.droit?.note ?? '',
          valide: Boolean(l.droit?.valide),
          calc: l.calc,
          diffusions: l.rapprochees.map((d) => {
            const exclue = exclues.has(d.id)
            if (!exclue) rang += 1
            return {
              date: d.date,
              heure: d.heure_debut,
              chaineNom: d.chaine_nom,
              libelle: d.libelle_complementaire,
              comptee: !exclue && rang > seuil,
            }
          }),
        }
      }),
    })
  }

  function exporter(brouillon) {
    try {
      if (lignes.filter((l) => brouillon || l.droit?.valide).length === 0) {
        setErreur(brouillon ? 'Aucun programme externe à exporter.' : 'Aucun programme validé à exporter.')
        return
      }
      const donnees = construireBundle(brouillon)
      const classeur = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(classeur, XLSX.utils.aoa_to_sheet(construireFeuilleRecap(donnees)), 'Récapitulatif')
      XLSX.utils.book_append_sheet(classeur, XLSX.utils.aoa_to_sheet(construireFeuilleDetail(donnees)), 'Détail diffusions')
      XLSX.writeFile(classeur, nomFichierDroitsAuteur(chaineActive.nom, aujourdHuiISO()))
    } catch (err) {
      setErreur(`Échec de l'export : ${err.message}`)
    }
  }

  async function exporterTout() {
    const ok = await confirmer({
      titre: 'Exporter tout (brouillon)',
      message:
        "Exporter TOUS les programmes externes, y compris ceux non encore validés ? Le fichier portera la mention « BROUILLON ». À ne pas transmettre en l'état à la finance.",
      labelConfirmer: 'Exporter le brouillon',
    })
    if (ok) exporter(true)
  }

  const ligneActive = lignes.find((l) => l.p.id === panneauId) ?? null
  const nbValides = lignes.filter((l) => l.droit?.valide).length

  if (!autorise) {
    return <p className="text-sm text-slate-500">Accès réservé à la Gestion des droits et du stock.</p>
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Coins size={18} /> Droits d'auteur — {chaineActive.nom}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Nombre de diffusions payantes (à partir de la 4ᵉ) des programmes externes, pour la finance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exporter(false)}
              disabled={nbValides === 0}
              className="flex items-center gap-1.5 rounded-md bg-snrt-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-50"
            >
              <FileSpreadsheet size={15} />
              Exporter (Excel) — validés{nbValides > 0 ? ` (${nbValides})` : ''}
            </button>
            <button
              type="button"
              onClick={exporterTout}
              className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Exporter tout (brouillon)
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <TriangleAlert size={15} className="mt-0.5 shrink-0" />
          <span>
            Le rapprochement pige ↔ programme se fait <strong>par le nom</strong>, il est <strong>approximatif</strong>.
            Vérifiez les diffusions et les dates avant de valider. Cet outil <strong>assiste le comptage</strong> ; les
            montants sont calculés par la finance.
          </span>
        </div>
        {erreur && <p className="mt-2 text-xs text-red-600">{erreur}</p>}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        {chargement ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : lignes.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun programme externe pour cette chaîne.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-4 font-medium">Programme</th>
                  <th className="py-2 pr-4 font-medium">Nb diffusions réelles</th>
                  <th className="py-2 pr-4 font-medium">Nb payantes (&gt; {SEUIL_GRATUIT_DEFAUT})</th>
                  <th className="py-2 pr-4 font-medium">Validé</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {lignes.map(({ p, droit, calc }) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4 text-slate-800">
                      {p.titre}
                      <span className="ml-2 text-[11px] text-slate-400">{nomChaineProgramme(p)}</span>
                    </td>
                    <td className="py-2 pr-4 text-slate-700">
                      {calc.nbReelles}
                      {calc.manuel ? (
                        <span className="ml-1 text-[11px] text-amber-600">(manuel)</span>
                      ) : calc.nbExclues > 0 ? (
                        <span className="ml-1 text-[11px] text-slate-400">
                          ({calc.nbRapprochees} rapprochées − {calc.nbExclues} exclues)
                        </span>
                      ) : (
                        <span className="ml-1 text-[11px] text-slate-400">rapprochées par nom</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 font-medium text-slate-800">{calc.nbPayantes}</td>
                    <td className="py-2 pr-4">
                      {droit?.valide ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 size={14} /> Validé
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                          <Circle size={14} /> {droit ? 'À revalider' : 'À vérifier'}
                        </span>
                      )}
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => setPanneauId(p.id)}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:border-snrt-navy hover:bg-snrt-navy/5 hover:text-snrt-navy"
                      >
                        Vérifier
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {ligneActive && (
        <PanneauVerification
          key={ligneActive.p.id}
          ligne={ligneActive}
          onFermer={() => setPanneauId(null)}
          onEnregistre={() => {
            setPanneauId(null)
            recharger()
          }}
        />
      )}
    </div>
  )
}

function PanneauVerification({ ligne, onFermer, onEnregistre }) {
  const { p, droit, rapprochees } = ligne
  const [seuil, setSeuil] = useState(String(droit?.seuil_gratuit ?? SEUIL_GRATUIT_DEFAUT))
  const [exclusions, setExclusions] = useState(new Set(droit?.exclusions ?? []))
  const [nbManuel, setNbManuel] = useState(droit?.nb_reelles_manuel != null ? String(droit.nb_reelles_manuel) : '')
  const [note, setNote] = useState(droit?.note ?? '')
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)

  const droitForm = useMemo(
    () => ({
      seuil_gratuit: Number(seuil) || 0,
      exclusions: [...exclusions],
      nb_reelles_manuel: nbManuel.trim() === '' ? null : Number(nbManuel),
    }),
    [seuil, exclusions, nbManuel]
  )
  const calc = calculerDroitProgramme({ rapprochees, droit: droitForm })
  const annotees = annoterRangs(rapprochees, droitForm)

  function basculerExclusion(id) {
    setExclusions((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function enregistrer(valide) {
    setEnregistrement(true)
    setErreur(null)
    try {
      await enregistrerDroitAuteur(p.id, {
        seuil_gratuit: Number(seuil) || SEUIL_GRATUIT_DEFAUT,
        exclusions: [...exclusions],
        nb_reelles_manuel: nbManuel.trim() === '' ? null : Number(nbManuel),
        note: note.trim() || null,
        valide,
        valide_le: valide ? new Date().toISOString() : null,
        valide_par: valide ? lireUtilisateur() : null,
        cree_par: droit?.cree_par ?? lireUtilisateur(),
      })
      onEnregistre()
    } catch (err) {
      setErreur(err.message)
      setEnregistrement(false)
    }
  }

  return (
    <Modal titre={`Vérifier — ${p.titre}`} onFermer={onFermer} large>
      <div className="space-y-4 text-sm">
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <TriangleAlert size={15} className="mt-0.5 shrink-0" />
          <span>
            Rapprochement <strong>par le nom</strong>, approximatif. Décochez les lignes qui ne correspondent pas à ce
            programme. Rien n'est transmis à la finance sans votre validation.
          </span>
        </div>

        {rapprochees.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucune diffusion de pige rapprochée à « {p.titre} ». Si le programme a été diffusé, utilisez l'override
            manuel ci-dessous.
          </p>
        ) : (
          <div className="max-h-[45vh] overflow-y-auto rounded-md border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="w-6 py-1.5"></th>
                  <th className="py-1.5 pr-2">Rang</th>
                  <th className="py-1.5 pr-2">Date</th>
                  <th className="py-1.5 pr-2">Heure</th>
                  <th className="py-1.5 pr-2">Chaîne</th>
                  <th className="py-1.5 pr-2">Libellé</th>
                  <th className="py-1.5 pr-2">Nature</th>
                </tr>
              </thead>
              <tbody>
                {annotees.map((d) => (
                  <tr
                    key={d.id}
                    className={`border-b border-slate-100 ${d.exclue ? 'opacity-40' : d.payante ? '' : 'bg-slate-50'}`}
                  >
                    <td className="py-1">
                      <input type="checkbox" checked={!d.exclue} onChange={() => basculerExclusion(d.id)} />
                    </td>
                    <td className="py-1 pr-2 text-slate-500">
                      {d.exclue ? '—' : d.rang}
                      {!d.exclue && !d.payante && <span className="ml-1 text-[10px] text-slate-400">non payante</span>}
                    </td>
                    <td className="whitespace-nowrap py-1 pr-2 text-slate-700">{formaterDateLongue(d.date)}</td>
                    <td className="whitespace-nowrap py-1 pr-2 text-slate-600">{(d.heure_debut ?? '').slice(0, 8)}</td>
                    <td className="py-1 pr-2 text-slate-600">{d.chaine_nom}</td>
                    <td className="py-1 pr-2 text-slate-500">{d.libelle_complementaire || '—'}</td>
                    <td className="py-1 pr-2 text-slate-500">{natureDepuisLibelle(d.libelle_complementaire)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Seuil (diffusions non payantes)</label>
            <input
              type="number"
              min="0"
              value={seuil}
              onChange={(e) => setSeuil(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Nombre total (override manuel) <span className="font-normal text-slate-400">— si le rapprochement a raté</span>
            </label>
            <input
              type="number"
              min="0"
              value={nbManuel}
              onChange={(e) => setNbManuel(e.target.value)}
              placeholder="auto"
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
            {nbManuel.trim() !== '' && (
              <p className="mt-1 text-[11px] text-amber-600">Force le nombre total, ignore la liste ci-dessus.</p>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Note (visible dans l'export)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {calc.nbRapprochees} rapprochées − {calc.nbExclues} exclues ={' '}
          <strong>{calc.nbReelles}</strong> diffusions réelles{calc.manuel ? ' (manuel)' : ''} ·{' '}
          {calc.nbReelles} − {calc.seuil} = <strong className="text-slate-900">{calc.nbPayantes}</strong> payantes.
        </div>

        {erreur && <p className="text-xs text-red-600">{erreur}</p>}

        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <button type="button" onClick={onFermer} className="text-xs text-slate-500 hover:text-slate-700">
            Annuler
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => enregistrer(false)}
              disabled={enregistrement}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              Enregistrer (sans valider)
            </button>
            <button
              type="button"
              onClick={() => enregistrer(true)}
              disabled={enregistrement}
              className="flex items-center gap-1.5 rounded-md bg-snrt-navy px-3 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
            >
              <CheckCircle2 size={14} />
              {enregistrement ? 'Enregistrement…' : 'Valider'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
