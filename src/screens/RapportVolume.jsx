// Rapport de volume horaire (P40) — le volume RÉELLEMENT diffusé, depuis la
// pige (`diffusion_reelle`), jamais le programmé.
//
// ASSISTANT, PAS AUTORITÉ (même posture que P37b) : deux niveaux d'inégale
// fiabilité, affichés comme tels —
//  · par GENRE : genre porté par la pige, aucun rapprochement → fiable ;
//  · par PROGRAMME : rapprochement par le NOM → approximatif, vérifiable et
//    corrigeable ligne par ligne avant l'édition du document.
// Les lignes non attribuées ne sont jamais perdues : elles sont listées à part
// et l'égalité de contrôle (par genre = par programme + non rapprochées) reste
// visible à l'écran comme dans l'export.
//
// Aucune persistance : le rapport est recalculé à la demande depuis la pige et
// le catalogue. « Figer » = éditer le document Word, daté et attribué.
import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  WidthType,
  BorderStyle,
} from 'docx'
import { BarChart3, FileText, ChevronLeft, ChevronRight, TriangleAlert, ListChecks, CheckCircle2 } from 'lucide-react'
import { listerProgrammesParChaine, listerDiffusionsReellesParChaineEtPeriode } from '../lib/db.js'
import { construireRapport, rapprocher } from '../lib/volumeHoraire.js'
import {
  construireDonneesVolumeHoraire,
  formaterVolumeSecondes,
  libelleControle,
  nomFichierVolumeHoraire,
} from '../lib/exportVolumeHoraire.js'
import { aujourdHuiISO, formaterDateLongue, bornesPeriode, labelPeriode, decalerRefPeriode } from '../lib/semaine.js'
import { lireUtilisateur } from '../lib/session.js'
import { peutVoirRapportVolume } from '../lib/roles.js'
import Modal from '../components/Modal.jsx'

// Un rapport porte toujours sur une période bornée : pas d'option « Tout ».
const GRANULARITES = [
  { code: 'JOUR', label: 'Jour' },
  { code: 'SEMAINE', label: 'Semaine' },
  { code: 'MOIS', label: 'Mois' },
]

export default function RapportVolume({ chaineActive, roleUtilisateur }) {
  const autorise = peutVoirRapportVolume(roleUtilisateur)

  const [granularite, setGranularite] = useState('MOIS')
  const [refDate, setRefDate] = useState(() => aujourdHuiISO())
  const [diffusions, setDiffusions] = useState([])
  const [programmes, setProgrammes] = useState([])
  const [exclusions, setExclusions] = useState(new Set())
  const [genere, setGenere] = useState(false)
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [panneauOuvert, setPanneauOuvert] = useState(false)

  const [debut, fin] = bornesPeriode(granularite, refDate)
  const periodeLabel = labelPeriode(granularite, refDate)

  // Changer de période ou de chaîne périme le rapport affiché : on ne laisse
  // jamais des chiffres d'une période en face du libellé d'une autre.
  useEffect(() => {
    setGenere(false)
    setDiffusions([])
    setExclusions(new Set())
  }, [granularite, refDate, chaineActive])

  function generer() {
    setChargement(true)
    setErreur(null)
    Promise.all([
      listerDiffusionsReellesParChaineEtPeriode(chaineActive.id, debut, fin),
      listerProgrammesParChaine(chaineActive.id),
    ])
      .then(([lignes, progs]) => {
        setDiffusions(lignes)
        setProgrammes(progs)
        setExclusions(new Set())
        setGenere(true)
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
  }

  const rapport = useMemo(
    () => construireRapport({ diffusions, programmes, exclusions }),
    [diffusions, programmes, exclusions]
  )

  // Liste complète des rapprochements CANDIDATS (exclusions ignorées) : le
  // panneau de vérification doit pouvoir re-cocher une ligne écartée.
  const candidats = useMemo(() => {
    const { parProgramme } = rapprocher(diffusions, programmes, new Set())
    return [...parProgramme.values()]
      .flatMap(({ programme, diffusions: lignes }) => lignes.map((d) => ({ diffusion: d, programme })))
      .sort(
        (a, b) =>
          a.programme.titre.localeCompare(b.programme.titre) ||
          a.diffusion.date.localeCompare(b.diffusion.date) ||
          (a.diffusion.heure_debut ?? '').localeCompare(b.diffusion.heure_debut ?? '')
      )
  }, [diffusions, programmes])

  function basculerExclusion(id) {
    setExclusions((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function exporterWord() {
    try {
      const donnees = construireDonneesVolumeHoraire({
        chaineNom: chaineActive.nom,
        periodeLabel,
        dateISO: aujourdHuiISO(),
        utilisateur: lireUtilisateur(),
        rapport,
      })

      const trait = { style: BorderStyle.SINGLE, size: 2, color: '999999' }
      const bordures = {
        top: trait,
        bottom: trait,
        left: trait,
        right: trait,
        insideHorizontal: trait,
        insideVertical: trait,
      }
      const cellule = (texte, gras = false) =>
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(texte ?? ''), bold: gras })] })] })
      const ligne = (valeurs, gras = false) =>
        new TableRow({ children: valeurs.map((v) => cellule(v, gras)) })
      const tableau = (rows) =>
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bordures, rows })

      const sections = [
        new Paragraph({ text: donnees.titre, heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: donnees.sousTitre }),
        new Paragraph({ children: [new TextRun({ text: donnees.mention, italics: true, size: 18 })] }),
        new Paragraph({ text: '' }),

        new Paragraph({ text: donnees.tableGenre.titre, heading: HeadingLevel.HEADING_2 }),
        tableau([
          ligne(donnees.tableGenre.entete, true),
          ...donnees.tableGenre.lignes.map((l) => ligne(l)),
          ligne(donnees.tableGenre.total, true),
        ]),
        new Paragraph({ text: '' }),

        new Paragraph({ text: donnees.tableProgramme.titre, heading: HeadingLevel.HEADING_2 }),
        tableau([
          ligne(donnees.tableProgramme.entete, true),
          ...donnees.tableProgramme.groupes.flatMap((g) => [...g.lignes.map((l) => ligne(l)), ligne(g.total, true)]),
          ligne(donnees.tableProgramme.total, true),
        ]),
        new Paragraph({ text: '' }),
      ]

      if (donnees.tableNonRapprochees) {
        sections.push(
          new Paragraph({ text: donnees.tableNonRapprochees.titre, heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ children: [new TextRun({ text: donnees.tableNonRapprochees.note, italics: true, size: 18 })] }),
          tableau([
            ligne(donnees.tableNonRapprochees.entete, true),
            ...donnees.tableNonRapprochees.lignes.map((l) => ligne(l)),
            ligne(donnees.tableNonRapprochees.total, true),
          ]),
          new Paragraph({ text: '' })
        )
      }

      sections.push(
        new Paragraph({ children: [new TextRun({ text: donnees.controle, bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: donnees.pied, size: 18 })] })
      )

      const doc = new Document({ sections: [{ children: sections }] })
      const blob = await Packer.toBlob(doc)
      const url = URL.createObjectURL(blob)
      const lien = document.createElement('a')
      lien.href = url
      lien.download = nomFichierVolumeHoraire(chaineActive.nom, periodeLabel)
      lien.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setErreur(`Échec de l'export Word : ${err.message}`)
    }
  }

  if (!autorise) {
    return <p className="text-sm text-slate-500">Accès réservé au Programmateur et à l'Administrateur de chaîne.</p>
  }

  const { totaux } = rapport

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <BarChart3 size={18} /> Rapport de volume horaire — {chaineActive.nom}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Volume réellement diffusé (pige), par genre et par programme, sur la période choisie.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {genere && (
              <button
                type="button"
                onClick={() => setPanneauOuvert(true)}
                className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                <ListChecks size={15} />
                Vérifier les rapprochements{exclusions.size > 0 ? ` (${exclusions.size} écartés)` : ''}
              </button>
            )}
            <button
              type="button"
              onClick={exporterWord}
              disabled={!genere || diffusions.length === 0}
              className="flex items-center gap-1.5 rounded-md bg-snrt-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-50"
            >
              <FileText size={15} />
              Exporter (Word)
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex rounded-md border border-slate-300 p-0.5">
            {GRANULARITES.map((g) => (
              <button
                key={g.code}
                type="button"
                onClick={() => setGranularite(g.code)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  granularite === g.code ? 'bg-snrt-navy text-white' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setRefDate((d) => decalerRefPeriode(granularite, d, -1))}
              className="rounded-md border border-slate-300 p-1 text-slate-500 hover:bg-slate-50"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="min-w-[13rem] text-center text-sm font-medium text-slate-700">{periodeLabel}</span>
            <button
              type="button"
              onClick={() => setRefDate((d) => decalerRefPeriode(granularite, d, 1))}
              className="rounded-md border border-slate-300 p-1 text-slate-500 hover:bg-slate-50"
            >
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => setRefDate(aujourdHuiISO())}
              className="ml-1 rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-50"
            >
              Auj.
            </button>
          </div>
          <button
            type="button"
            onClick={generer}
            disabled={chargement}
            className="rounded-md bg-snrt-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
          >
            {chargement ? 'Génération…' : 'Générer'}
          </button>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <TriangleAlert size={15} className="mt-0.5 shrink-0" />
          <span>
            Généré depuis la <strong>pige</strong> (réel diffusé, programmes seuls). La répartition{' '}
            <strong>par genre</strong> est fiable (genre porté par la pige). La ventilation{' '}
            <strong>par programme</strong> repose sur un <strong>rapprochement de nom approximatif</strong> — vérifiez-la
            avant d'exporter. Cet outil <strong>assiste</strong> la production du rapport.
          </span>
        </div>
        {erreur && <p className="mt-2 text-xs text-red-600">{erreur}</p>}
      </div>

      {!genere ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm text-slate-500">
            Choisissez une période puis « Générer » pour calculer le volume horaire depuis les piges enregistrées.
          </p>
        </div>
      ) : diffusions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm text-slate-500">
            Aucune diffusion réelle de type Programme sur {periodeLabel} pour {chaineActive.nom}. Vérifiez qu'une pige
            est bien enregistrée dans l'historique sur cette période.
          </p>
        </div>
      ) : (
        <>
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              totaux.coherent ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-300 bg-red-50 text-red-700'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              {totaux.coherent ? <CheckCircle2 size={15} /> : <TriangleAlert size={15} />}
              {libelleControle(totaux)}
            </span>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-1 text-sm font-semibold text-slate-900">Répartition par genre</h2>
            <p className="mb-3 text-xs text-slate-500">
              Genre porté par la pige — aucun rapprochement au catalogue, chiffre fiable.
            </p>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-4 font-medium">Genre (pige)</th>
                  <th className="py-2 pr-4 font-medium">Nb diffusions</th>
                  <th className="py-2 font-medium">Volume horaire</th>
                </tr>
              </thead>
              <tbody>
                {rapport.parGenre.map((g) => (
                  <tr key={g.genre} className="border-b border-slate-100">
                    <td className="py-2 pr-4 text-slate-800">{g.genre}</td>
                    <td className="py-2 pr-4 text-slate-600">{g.nb}</td>
                    <td className="py-2 font-medium text-slate-800">{formaterVolumeSecondes(g.secondes)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300">
                  <td className="py-2 pr-4 font-semibold text-slate-900">Total</td>
                  <td className="py-2 pr-4 font-semibold text-slate-900">{totaux.genre.nb}</td>
                  <td className="py-2 font-semibold text-slate-900">{formaterVolumeSecondes(totaux.genre.secondes)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-1 text-sm font-semibold text-slate-900">Détail par programme</h2>
            <p className="mb-3 text-xs text-slate-500">
              Rapproché par le nom (approximatif), regroupé par genre du catalogue.
            </p>
            {rapport.groupes.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune diffusion rapprochée à un programme du catalogue.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-4 font-medium">Programme</th>
                    <th className="py-2 pr-4 font-medium">Nb diffusions réelles</th>
                    <th className="py-2 font-medium">Volume horaire</th>
                  </tr>
                </thead>
                <tbody>
                  {rapport.groupes.map((groupe) => (
                    <Fragment key={groupe.genre}>
                      <tr className="bg-slate-50">
                        <td colSpan={3} className="py-1.5 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {groupe.genre}
                        </td>
                      </tr>
                      {groupe.programmes.map((p) => (
                        <tr key={p.programmeId} className="border-b border-slate-100">
                          <td className="py-2 pr-4 pl-4 text-slate-800">{p.titre}</td>
                          <td className="py-2 pr-4 text-slate-600">{p.nb}</td>
                          <td className="py-2 text-slate-800">{formaterVolumeSecondes(p.secondes)}</td>
                        </tr>
                      ))}
                      <tr className="border-b border-slate-200">
                        <td className="py-1.5 pr-4 pl-4 text-xs font-medium text-slate-600">Total {groupe.genre}</td>
                        <td className="py-1.5 pr-4 text-xs font-medium text-slate-600">{groupe.total.nb}</td>
                        <td className="py-1.5 text-xs font-medium text-slate-600">
                          {formaterVolumeSecondes(groupe.total.secondes)}
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                  <tr className="border-t-2 border-slate-300">
                    <td className="py-2 pr-4 font-semibold text-slate-900">Total général</td>
                    <td className="py-2 pr-4 font-semibold text-slate-900">{totaux.programme.nb}</td>
                    <td className="py-2 font-semibold text-slate-900">
                      {formaterVolumeSecondes(totaux.programme.secondes)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {rapport.lignesNonRapprochees.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-white p-4">
              <h2 className="mb-1 text-sm font-semibold text-slate-900">
                Diffusions non rapprochées à un programme du catalogue
              </h2>
              <p className="mb-3 text-xs text-slate-500">
                Comptées dans la répartition par genre ci-dessus ; seule leur attribution à un programme manque.
              </p>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-4 font-medium">Programme (nom de pige)</th>
                    <th className="py-2 pr-4 font-medium">Genre (pige)</th>
                    <th className="py-2 pr-4 font-medium">Nb diffusions</th>
                    <th className="py-2 font-medium">Volume horaire</th>
                  </tr>
                </thead>
                <tbody>
                  {rapport.lignesNonRapprochees.map((l) => (
                    <tr key={`${l.nom}__${l.genre}`} className="border-b border-slate-100">
                      <td className="py-2 pr-4 text-slate-800">{l.nom}</td>
                      <td className="py-2 pr-4 text-slate-500">{l.genre}</td>
                      <td className="py-2 pr-4 text-slate-600">{l.nb}</td>
                      <td className="py-2 text-slate-800">{formaterVolumeSecondes(l.secondes)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-300">
                    <td className="py-2 pr-4 font-semibold text-slate-900">Total</td>
                    <td className="py-2 pr-4"></td>
                    <td className="py-2 pr-4 font-semibold text-slate-900">{totaux.nonRapprochees.nb}</td>
                    <td className="py-2 font-semibold text-slate-900">
                      {formaterVolumeSecondes(totaux.nonRapprochees.secondes)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {panneauOuvert && (
        <PanneauRapprochements
          candidats={candidats}
          exclusions={exclusions}
          onBasculer={basculerExclusion}
          onFermer={() => setPanneauOuvert(false)}
        />
      )}
    </div>
  )
}

// Panneau de vérification : une seule liste à plat de tous les rapprochements
// candidats. Décocher une ligne la retire du programme (elle bascule dans les
// non rapprochées, jamais hors du total par genre) — recalcul immédiat.
function PanneauRapprochements({ candidats, exclusions, onBasculer, onFermer }) {
  return (
    <Modal titre="Vérifier les rapprochements" onFermer={onFermer} large>
      <div className="space-y-3 text-sm">
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <TriangleAlert size={15} className="mt-0.5 shrink-0" />
          <span>
            Rapprochement <strong>par le nom</strong>, approximatif. Décochez les lignes qui ne correspondent pas au
            programme indiqué : elles rejoignent les « non rapprochées » et sortent du détail par programme — leur
            durée reste comptée dans la répartition par genre.
          </span>
        </div>

        {candidats.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune diffusion rapprochée à un programme du catalogue.</p>
        ) : (
          <div className="max-h-[55vh] overflow-y-auto rounded-md border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="w-6 py-1.5"></th>
                  <th className="py-1.5 pr-2">Date</th>
                  <th className="py-1.5 pr-2">Heure</th>
                  <th className="py-1.5 pr-2">Nom dans la pige</th>
                  <th className="py-1.5 pr-2">Rapproché à</th>
                  <th className="py-1.5 pr-2">Durée</th>
                </tr>
              </thead>
              <tbody>
                {candidats.map(({ diffusion, programme }) => {
                  const exclue = exclusions.has(diffusion.id)
                  return (
                    <tr key={diffusion.id} className={`border-b border-slate-100 ${exclue ? 'opacity-40' : ''}`}>
                      <td className="py-1">
                        <input type="checkbox" checked={!exclue} onChange={() => onBasculer(diffusion.id)} />
                      </td>
                      <td className="whitespace-nowrap py-1 pr-2 text-slate-700">{formaterDateLongue(diffusion.date)}</td>
                      <td className="whitespace-nowrap py-1 pr-2 text-slate-600">
                        {(diffusion.heure_debut ?? '').slice(0, 8)}
                      </td>
                      <td className="py-1 pr-2 text-slate-600">{diffusion.programme}</td>
                      <td className="py-1 pr-2 font-medium text-slate-800">{programme.titre}</td>
                      <td className="whitespace-nowrap py-1 pr-2 text-slate-600">
                        {formaterVolumeSecondes(diffusion.duree_secondes)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-xs text-slate-500">
            {candidats.length} rapprochement{candidats.length > 1 ? 's' : ''} · {exclusions.size} écarté
            {exclusions.size > 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={onFermer}
            className="rounded-md bg-snrt-navy px-3 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover"
          >
            Fermer
          </button>
        </div>
      </div>
    </Modal>
  )
}
