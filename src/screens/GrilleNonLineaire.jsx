// Grille non-linéaire (extension hors cahier, PLAN.md §9, P20) — 2 onglets,
// chacun sa propre table (publication_reseau/publication_vod) et son propre
// calendrier générique (CalendrierPublications.jsx). Outil de planification
// éditoriale, aucune intégration API de publication réelle.
import { useEffect, useState } from 'react'
import { Share2, Tv } from 'lucide-react'
import {
  listerProgrammesParChaine,
  listerPublicationsReseauParChaine,
  creerPublicationReseau,
  mettreAJourPublicationReseau,
  supprimerPublicationReseau,
  listerPublicationsVodParChaine,
  creerPublicationVod,
  mettreAJourPublicationVod,
  supprimerPublicationVod,
} from '../lib/db.js'
import { PLATEFORMES_RESEAU, FORMATS_RESEAU } from '../lib/publicationsReseau.js'
import { PLATEFORME_VOD } from '../lib/publicationsVod.js'
import CalendrierPublications from '../components/CalendrierPublications.jsx'

const CONFIG_RESEAUX = {
  table: 'publication_reseau',
  lister: listerPublicationsReseauParChaine,
  creer: creerPublicationReseau,
  mettreAJour: mettreAJourPublicationReseau,
  supprimer: supprimerPublicationReseau,
  plateformes: PLATEFORMES_RESEAU,
  formats: FORMATS_RESEAU,
  libelleExport: 'Réseaux sociaux',
}

const CONFIG_VOD = {
  table: 'publication_vod',
  lister: listerPublicationsVodParChaine,
  creer: creerPublicationVod,
  mettreAJour: mettreAJourPublicationVod,
  supprimer: supprimerPublicationVod,
  plateformes: PLATEFORME_VOD,
  formats: null,
  libelleExport: 'Streaming VOD',
}

export default function GrilleNonLineaire({ chaineActive }) {
  const [onglet, setOnglet] = useState('RESEAUX')
  const [programmes, setProgrammes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    setChargement(true)
    listerProgrammesParChaine(chaineActive.id)
      .then(setProgrammes)
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
  }, [chaineActive])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Grille non-linéaire</h1>
        <p className="text-sm text-slate-500">
          Planification éditoriale des publications hors antenne — extension Snomark, aucune EXG associée.
        </p>
      </div>

      <div className="flex gap-1 rounded-md bg-slate-100 p-1 text-sm">
        <button
          type="button"
          onClick={() => setOnglet('RESEAUX')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 font-medium transition-colors ${
            onglet === 'RESEAUX' ? 'bg-white text-snrt-navy shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Share2 size={15} />
          Réseaux sociaux
        </button>
        <button
          type="button"
          onClick={() => setOnglet('VOD')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 font-medium transition-colors ${
            onglet === 'VOD' ? 'bg-white text-snrt-navy shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Tv size={15} />
          Streaming VOD
        </button>
      </div>

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}

      {!chargement && (
        <CalendrierPublications
          key={onglet}
          chaineActive={chaineActive}
          programmes={programmes}
          config={onglet === 'RESEAUX' ? CONFIG_RESEAUX : CONFIG_VOD}
        />
      )}
    </div>
  )
}
