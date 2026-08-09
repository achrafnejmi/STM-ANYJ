# Snomark

PoC « STM nouvelle génération » pour la SNRT — voir `CLAUDE.md` et `PLAN.md`.

## ⚠️ Avertissement sécurité (Supabase)

Ce projet utilise la clé **anon** de Supabase directement depuis le client
(navigateur), avec la Row Level Security **activée mais une policy permissive
(« allow all ») pour le rôle anon**. Concrètement, **toute personne disposant
de cette clé (visible dans le bundle JS livré au navigateur) peut lire et
écrire l'ensemble des données**.

C'est un choix assumé pour ce **PoC de démonstration** — pas d'authentification
Supabase réelle branchée à ce stade. En conséquence :
- **N'y mettez aucune donnée sensible ou réelle.**
- **Ne déployez pas cette configuration en production** telle quelle : il
  faudra une vraie authentification + des policies RLS restrictives avant tout
  usage au-delà de la démo.

## Démarrer

```
npm install
npm run dev
```

Nécessite un fichier `.env` (voir `.env.example`) avec les clés Supabase du
projet — non fourni dans le repo (`.env` est dans `.gitignore`).
