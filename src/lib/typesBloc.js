// Types de bloc de grille type — préréglages métier (nom, créneau et genre
// par défaut). La couleur n'est PAS ici : voir couleursType.js, même
// séparation que genres.js (liste)/couleursGenre.js (couleur).
export const TYPES_BLOC = [
  { nom: 'Matinale', heure_debut: '06:00', heure_fin: '09:00', genre_defaut: 'Magazine' },
  { nom: 'Jeunesse', heure_debut: '09:00', heure_fin: '11:00', genre_defaut: 'Jeunesse' },
  { nom: 'Mi-journée', heure_debut: '11:00', heure_fin: '13:30', genre_defaut: 'Documentaire' },
  { nom: 'Info midi', heure_debut: '12:45', heure_fin: '13:30', genre_defaut: 'Information' },
  { nom: 'Après-midi', heure_debut: '14:00', heure_fin: '17:00', genre_defaut: 'Série' },
  { nom: 'Religieux', heure_debut: '17:00', heure_fin: '17:30', genre_defaut: 'Religieux' },
  { nom: 'Access', heure_debut: '18:30', heure_fin: '20:00', genre_defaut: 'Magazine' },
  { nom: 'Prime', heure_debut: '20:45', heure_fin: '23:00', genre_defaut: 'Série' },
  { nom: 'Deuxième partie', heure_debut: '23:30', heure_fin: '00:30', genre_defaut: 'Documentaire' },
]
