# MEMORY.md — mémoire durable du projet

> Lecture obligatoire avant toute phase. Un agent qui débarque doit pouvoir lire ce
> fichier et savoir : ce qu'est le projet, comment il est construit, ce qui est fait,
> comment reprendre. Dense, pas de prose, 1 idée = 1 ligne.

## Maintenance

Après **chaque phase committée** : ajouter/mettre à jour **UNE** ligne dans le Journal
(§4), déplacer la phase de §6 vers §4, ajouter une puce en §5 si décision structurante.
**Ne jamais réécrire tout le fichier** — édition incrémentale (append/modify la ligne
concernée). Garder chaque entrée à 1 ligne. Si une section dépasse ~40 lignes, condenser
les vieilles entrées.

---

## 1. Projet

STM Next (nom de code **Snomark**) — PoC d'une refonte complète du STM legacy de la
**SNRT** (traffic management TV : programmation linéaire + non-linéaire, **6 chaînes** —
Al Aoula AW, Arryadia AR, Athaqafia AT, Assadissa AS, Tamazight TM, Al Maghribia AM).
Aligné sur `design-reference/Cahier_des_charges_STM_Next.docx` (modules M0–M10).
Stack : **Vite + React + Tailwind + Supabase** (Postgres, RLS). Aucun backend applicatif
écrit ; `db.js` parle directement à Supabase depuis le navigateur.

## 2. Architecture (règles non négociables)

- Accès aux données métier **UNIQUEMENT via `src/lib/db.js`** — les écrans ne touchent jamais Supabase.
- Logique métier = **fonctions pures** sans I/O (`droits.js`, `planMedia.js`, `autoprog.js`, `conducteur.js`, `bilans.js`, `rapprochementPige.js`, `droitsAuteur.js`…).
- Migrations **additives numérotées** `supabase/migration-p<N>.sql` ; **jamais** rejouer `schema.sql` ; ne pas renommer les tables physiques (mapping : `programme`=Titre, `segment`/`episode`=Épisode, `diffusion_lineaire`=Transmission).
- Principe **« le système propose, l'utilisateur décide »** : tout moteur/import = aperçu → confirme, rapport, annulable ; jamais d'écriture silencieuse.
- **Jamais de perte de données silencieuse** ; garde-fou « modifications non enregistrées » (`NotificationProvider`).
- Undo/redo via **`historique_action`** (ops `jsonb`), scopé chaîne + écran + document.
- Journée d'antenne **06:00 → 06:00** ; couleur = **genre** ; signalisation **rouge** (bloquant) / **ambre** (alerte) / **vert** (conforme) ; UI FR, métadonnées FR/AR/EN.
- Règle d'or : **une phase à la fois**, plan + ambiguïtés → validation → code → test ✅ → 1 commit `Phase P<x> — …`.

## 3. Modèle de données (`schema.sql` + migrations)

- **chaine** — 6 chaînes SNRT (code, nom, couleur_token, ligne éditoriale) ; UUID **fixes** dupliqués dans `src/lib/chaines.js`.
- **programme** (=Titre) — `chaine_id` **nullable** (NULL = partagé toutes chaînes, renseigné = exclusif) ; `chaines_autorisees uuid[]` (accès inter-chaînes accordé) ; `production` INTERNE/EXTERNE ; `reference_contrat`, `attestation_chemin` (fichier contrat) ; `genre`/`sous_genre`/`titre_ar`/`titre_en` ; `producteur`/`realisation`/`interpretes`/`mots_cles`.
- **episode** (ex-`segment`, renommé migration-p10) — `programme_id` FK cascade ; `numero`, `duree` (min), `pad` bool, `derniere_diffusion`, `nombre_diffusions`, `titre_ar`.
- **diffusion_lineaire** (=Transmission planifiée) — `programme_id` + `chaine_id` + `grille_id` + `episode_id` FK ; `date` + `heure_debut/fin` (`time`) ; `vecteur` TNT/SATELLITE ; `origine` MANUELLE/AUTOMATIQUE + `run_id` ; `ecart_grille_type_accepte`.
- **grille** — grilles linéaires nommées par chaîne ; `est_live` (une seule par chaîne, index partiel unique).
- **grille_type** — grilles type nommées par chaîne ; `est_live` ; `saison` (Ramadan/rentrée/été/défaut).
- **bloc_grille_type** — bloc nommé (plage, `jours[]`, `genre_attendu`, type) ; `grille_type_id` FK ; **aucun titre**.
- **fenetre_droits** — fenêtre de droits d'un programme : `date_debut/fin`, `passages_autorises/consommes`, `illimite`.
- **plan_media** — plans média nommés par chaîne ; `est_live` (une seule par chaîne).
- **element_secondaire** — BA/spot/écran pub/habillage **placé** : `plan_media_id` FK ; `apres_transmission_id` FK **NOT NULL** (ancré à une transmission) ; `type`, `duree_secondes` ; `campagne_id` ; `origine` + `run_id`.
- **campagne** — campagne de bande-annonce (`programme_id`, séparation, `tranches_ciblees[]`).
- **spot_bibliotheque** — spots réutilisables (libellé, genre, validité, `pad`) ; `chaine_id` nullable (global ou chaîne).
- **regle_plan_media** — règles de génération auto du plan média (par chaîne, `genres[]` ciblés).
- **cadre_pub_ecran** — écrans pub prévisionnels d'une journée (`chaine_id` + `date` ; `nb_spots`, `duree_tranche_secondes`) ; saisi par la Régie pub.
- **historique_action** — pile annuler/rétablir : `chaine_id` + `ecran` (check : GRILLE_LINEAIRE/GRILLE_TYPE/PLAN_MEDIA/GRILLE_NON_LINEAIRE_RESEAUX/GRILLE_NON_LINEAIRE_VOD/PIGE) + colonne document (`grille_id`/`plan_media_id`/`grille_type_id`/`import_pige_id`) ; `operations` jsonb ; `statut` ACTIVE/ANNULEE/PERIMEE.
- **notification** — cloche : `chaine_id`, `type`, `programme_id`/`fenetre_droits_id`, `lu`, `destinataire_role` (routage par rôle) ; index partiels anti-doublon.
- **utilisateur** — comptes démo : `nom_utilisateur`, `nom_affiche`, `role`, `chaine_id` (verrou de chaîne si renseigné) ; **aucun mot de passe**.
- **genre** — nomenclature (libelle_fr **unique** = clé de jointure **texte**, libelle_ar, couleur_token, ordre) ; **aucune FK** depuis `programme`/`diffusion_lineaire`.
- **tranche_antenne** — nomenclature tranches (code, libellés, `debut/fin_minutes`).
- **bible** — 1 par programme (`programme_id` unique) : `fichier_chemin`, `ocr_texte`, `synopsis_fr`, `synopsis_ar`.
- **demande_pad** — demandes de validation PAD d'un épisode (statut, décisions, relances).
- **demande_programmation** — circuit d'accès à un programme exclusif (`chaine_demandeuse_id`, `chaine_exclusive_id`, statut, transmise/traitée).
- **support** — support d'un épisode (`numero_support`, `type_support`, `tc_in`) ; `episode_id` FK.
- **evenement_secondaire** — événement d'un épisode (`type`, `start_time`, `duree_secondes`) ; `episode_id` FK.
- **publication_reseau** — post réseau social (plateforme, format, `statut` BROUILLON/PROGRAMME/PUBLIE/ANNULE) ; `programme_id` + `episode_id` nullable.
- **publication_vod** — mise en ligne VOD (plateforme, statut) ; `programme_id` + `episode_id` nullable.
- **import_pige** — un import de pige nommé = **1 chaîne + 1 date** ; `chaine_id` nullable ; `actif` bool (ré-import archive le précédent, index partiel unique `(chaine_id,date) where actif`) ; `source_fichier`, `analyse_le`, `nb_lignes`.
- **diffusion_reelle** — 1 ligne de pige = ce qui a **RÉELLEMENT** été diffusé : `import_pige_id` FK cascade ; `programme` = **nom brut, AUCUNE FK catalogue** ; `heure_debut/fin` (`time`, mod 24 : 27:00→03:00) **+** `debut/fin_secondes` (axe linéaire du fichier, peut dépasser 86400) ; `duree_secondes` ; `type_element` PROGRAMME/BA/SPOT/AUTO_PROMO/COMMUNIQUE/AUTRE ; `est_sous_ligne` + `parent_ordre` (lignes DEBUT/SUITE) ; `code_genre` + `genre_niv1/2/3` bruts ; `chevauchement` bool.
- **droit_auteur** — 1 par programme externe : `seuil_gratuit` (déf 3), `exclusions uuid[]` (faux positifs du rapprochement), `nb_reelles_manuel` (override), `note`, `valide`/`valide_le`/`valide_par`. **AUCUN montant.**
- ~~diffusion_non_lineaire~~ — table fourre-tout d'origine, **remplacée** par `publication_reseau`/`publication_vod` (P20).
- RLS : `alter table X enable row level security` + `create policy anon_all_X … using(true) with check(true)` sur **toutes** les tables (PoC, pas de vraie auth).

## 4. Journal des phases

Format : `Pxx | titre | statut | commit | fichiers clés | ce que ça fait + décision non-évidente`
⚠️ Deux séries de numéros : l'historique linéaire **P0→P49**, et les suffixes récents
**P36a/b/c**, **P37a/b/c** (pige & droits d'auteur) qui **réutilisent** des numéros. Le
n° de migration ≠ le n° de phase.

```
P0  | Scaffold                         | ✅ | 83a5a40 | vite/react/tailwind | squelette du projet
P1  | Mock STM + parseur xlsx          | ✅ | 34bbc6b | stm-import.js | maquette ; parseur xlsx legacy (parqué, non branché)
P2  | Modèle + persistance session     | ✅ | 4b35db3 | model.js, storage.js | modèle métier + storage localStorage (session seulement)
P3  | Login simple                     | ✅ | 35abee8 | session.js, Login.jsx | identifiant libre, aucun mot de passe
P5  | Fondation Supabase               | ✅ | 5d0e016 | db.js, supabaseClient.js, schema.sql | db.js = SEUL accès données ; RLS ouvertes anon_all_*
P6  | Coquille GUI SNRT                 | ✅ | 7e76ee8 | App.jsx, navigation.js, Sidebar/TopBar | shell nav + sélecteur chaîne + couleurs/logo SNRT
P7  | Fiche programme + épisodes       | ✅ | 46e572d | FicheProgramme.jsx, EpisodesPanel.jsx, migration-p7 | fiche titre + épisodes ; colonne attestation (→ Contrat en P21)
P8  | Grille linéaire (calendrier)     | ✅ | 4d974ce | GrilleLineaire.jsx, grilleAxe.js | calendrier hebdo proportionnel au temps
P9  | Espace de travail par chaîne     | ✅ | 7b12cd7 d9b0423 | chaines.js, migration-p9 p9b | scoping par chaine_id ; catalogue commun ; dédup alignée chaine_id
P10 | Plan de diffusion M2 1/3         | ✅ | 2f83bd7 | GrilleLineaire.jsx, migration-p10 | catalogue glissable + drag-drop + aperçu historique ; segment→episode
P11 | Inspecteur de bloc M2 2/3        | ✅ | 7d8d688 | migration-p11 | onglets Bloc/Répéter/Vecteur (TNT/SAT)
P12 | Centre d'anomalies M8            | ✅ | 5329390 | anomalies.js, PanneauAnomalies.jsx | chevauchements + matériel ; trous reportés après M3
P13 | Grille type M3                   | ✅ | 929d56c | GrilleType.jsx, grilleType.js, migration-p13 p13b | blocs nommés (genre attendu, pas de titre) en fond du plan + trous
P14a| Contrats & droits + PAD          | ✅ | 8583a9d | Contrats.jsx, FenetresDroitsPanel.jsx, droits.js, migration-p14a | fenetre_droits (passages autorisés/consommés) ; garde-fou drag
P14b| Fiche titre enrichie             | ✅ | 6421b80 | HistoriqueTitrePanel.jsx, historique.js, migration-p14b | historique complet + métadonnées FR/AR/EN
P15 | Auto-programmation M4            | ✅ | a987121 | autoprog.js, AutoProgrammation.jsx, migration-p15 | moteur déterministe + réservoir + règles + rapport annulable
P16 | Plan média M5                    | ✅ | a0f4334 a775fb3 | planMedia.js, PlanMedia.jsx, migration-p16 p16b | campagnes BA + habillage + écrans pub ; element_secondaire ancré à une transmission ; bibliothèque spots
P17 | Conducteur d'antenne M7          | ✅ | 8288cbb | conducteur.js, Conducteur.jsx | déroulé minuté, timecodes cumulés
P18 | Stock & bilans M9               | ✅ | ee267a8 | bilans.js, Accueil.jsx | volume dispo, fins de droits, répartition par genre
P19a| Recherche globale + Admin        | ✅ | 5196f28 | rechercheGlobale.js, Administration.jsx, migration-p19a | nomenclatures genre + tranche_antenne ; recherche par raccourci
P19b| Undo/Rollback ciblé              | ✅ | be277ce | undoManager.js, migration-p19b | historique_action (ops jsonb) ; annuler/rétablir par écran+chaîne+document
P20 | Grille non-linéaire              | ✅ | ffaf52e | GrilleNonLineaire.jsx, migration-p20 | EXTENSION hors cahier : publication_reseau + publication_vod par plateforme
P21 | Finitions UI/UX (7 lots A-G)     | ✅ | 87dfca8..aa3fc49 | NotificationProvider.jsx, Accueil.jsx | attestation→Contrat, durée moyenne, plein écran, graphes ; Lot G = NotificationProvider (toasts + garde modifs)
P22 | Modèle d'exclusivité             | ✅ | 144b9de | exclusivite.js, migration-p22 p22b | chaine_id nullable = partagé toutes chaînes ; renseigné = exclusif ; touche TOUT le scoping
P23 | Multi-documents grille           | ✅ | 0e4284d | grilles.js, migration-p23 | table grille (nommées, onglets) ; une seule est_live par chaîne
P24 | Multi-documents plan média       | ✅ | bd434f0 | plansMedia.js, migration-p24 | table plan_media (idem P23) ; undo intégré (ecran PLAN_MEDIA)
P25 | Vues mois/année + zoom           | ✅ | 468c7a0 | grilleAxe.js | 3 paliers de zoom (Vue d'ensemble/Standard/Précis)
P26 | Export/import grille + PM        | ✅ | dcd9c2b | exportListeTransmissions.js, importPlanMedia.js | export Excel/Word/PDF ; import PM Excel (SheetJS, aperçu→confirme)
P26b| Réorganisation Plan média        | ✅ | eca054a | PlanMedia.jsx | onglets Composition / Génération auto
P27 | Rediffusion avancée + vecteur    | ✅ | 4dc76d4 430d7a2 | deprogrammation.js | répéter (jours+heure+pas) ; exception TNT vide le créneau SAT (et inversement)
P28 | Grille type multi-docs + saison  | ✅ | c42ca22 815b1c2 | grillesType.js, importGrilleType.js, migration-p28 | grille_type nommées + gabarits Ramadan/rentrée/été ; import Excel
P29 | Centre de notifications          | ✅ | 9898566 | notifications.js, migration-p29 | table notification (cloche, lu/non lu par chaîne) ; alerte nouveau programme + droits proches
P30 | Rollback étendu                  | ✅ | 49928c6 | undoManager.js, migration-p30-rollback | annuler/rétablir grille non-linéaire (2 piles Réseaux/VOD indépendantes)
P31 | Passe de design UI/UX            | ✅ | fda7450..52649c7 | index.css, Login.jsx | polish pur ; tokens accent orange/succès vert distincts genre/chaîne ; export unifié ; historique sous-vue Non-linéaire
P32 | Règle Plan média                 | ✅ | daa8571 | migration-p32 | règle perso de génération auto + application manuelle
P33 | Bibliothèque de règles PM        | ✅ | c4ca836 | regle_plan_media, migration-p33 | plusieurs règles par chaîne (génération auto uniquement)
P34 | PM auto : annonces intra-prog    | ✅ | a866c6d | migration-p34 | campagnes retirées de la génération auto
P35 | Rôles multi-utilisateurs (PoC)   | ✅ | 050c4ce 2650563 e76bcfd | roles.js, utilisateur, migration-p35 p36 p37 | 8 rôles, nav filtrée par rôle ; AUCUNE vraie auth ; écrans Bible/Synopsis/Contrôle PAD
P36 | Espaces spécialisés droits/stock | ✅ | 3adde8e cb29a0f | SuiviPad.jsx, ControlePad.jsx, migration-p39 p40 | rôle GESTION_DROITS_STOCK (Oumnia) ; notifications routées par destinataire_role
P37 | Programmes exclusifs & demandes  | ✅ | 586353c | demande_programmation, migration-p41 | exclusif visible mais non programmable ; circuit Programmateur→Admin demandeur→Admin détenteur ; chaines_autorisees[]
P38 | Synopsis exporté PDF             | ✅ | 015a7bc a816308 | exportSynopsisPdf.js | PDF FR/AR ; arabe via html2canvas (jsPDF ne lie pas les lettres) ; rien stocké
P39 | Espace de suivi du Rédacteur     | ✅ | 35afcf8 | BiblesSynopsis.jsx, TableauBordRedaction.jsx, suiviRedaction.js | tableaux Bibles & synopsis + KPI rédaction
P40 | Rédaction synopsis FR/AR         | ✅ | 4720468 | Synopsis.jsx, migration-p42 | rôles REDACTEUR_FR / REDACTEUR_AR ; écriture ciblée synopsis_fr OU synopsis_ar
P41 | Catalogue Gestion droits/stock + Supports/Événements | ✅ | 907bf33 | support, evenement_secondaire, migration-p43 | 2 sous-onglets épisode ; peutGererCatalogue += GESTION_DROITS_STOCK
P41a| Alertes de grille (grid check)   | ✅ | 7cb0593 | anomalies.js | signalements supplémentaires sur la grille
P41b| Export conventionnel par chaîne  | ✅ | 6389e5d 69ef757 | exportGrilleChaine.js, gabaritsGrilleChaine.js | 3 gabarits fidèles (.docx/.pdf/.xlsx) par chaîne
P42 | Métadonnées de production        | ✅ | 885f26f | FicheProgramme.jsx, migration-p44 | type_production, producteur, réalisation, interprètes, mots-clés ; contrats fournisseur hors périmètre
P43 | Publications non-linéaires par épisode | ✅ | ff371f8 | migration-p45 | episode_id nullable sur publication_reseau/vod
P43b| Respect de la grille type (Dashboard audit) | ✅ | 9511c5b 23f2717 | DashboardAudit.jsx, conformiteGrilleType.js, migration-p48 | KPI conformité genre programmé vs grille type ; confirmation « genre non conforme »
P44 | Historique du titre dans un modal | ✅ | 35c8ed1 | HistoriqueTitrePanel.jsx | Modal + bascule Linéaire/Non-linéaire + filtres Épisode/Chaîne
P45 | Programmes lecture seule Marketing | ✅ | e9cd99f | roles.js | peutEditerProgramme / peutCreerProgramme (Acquisitions + Gestion droits/stock + Super Admin)
P46 | Menu « Demandes de diffusion »   | ✅ | 6b31110 | navigation.js | libellé raccourci (id DEMANDES_PROGRAMMATION inchangé)
P47 | 6e chaîne Al Maghribia           | ✅ | (migration-p47) | chaines.js, migration-p47 | passe de 5 à 6 chaînes
P48 | Verrou de chaîne pour tout utilisateur rattaché | ✅ | 1ebbd18 | roles.js | chaineVerrouillee = true dès que utilisateur.chaine_id renseigné
P49 | Sélecteurs compacts barre d'outils grilles | ✅ | 93c2c6b | GrilleLineaire.jsx, GrilleType.jsx | polish
P37a| Type de production interne/externe | ✅ | be9b7f0 4f4219d | FicheProgramme.jsx, migration-p46 | production INTERNE/EXTERNE ; interne = droits illimités, pas de contrat
P38a| BA/spots enrichis + garde-fou dur | ✅ | c52ccd3 | spot_bibliotheque, migration-p49 | genre + fenêtre de validité + PAD sur les spots
P38b| Demande de validation PAD d'un spot | ✅ | 47701b3 | migration-p50 | circuit PAD pour un spot de bibliothèque
P39a| Conducteur de publicité (Régie pub) | ✅ | adfb1e9 e6d5bd2 0877170 | ConducteurPub.jsx, cadre_pub_ecran, migration-p51 p52 | rôle REGIE_PUB (Abir) ; saisie du cadre pub quotidien ; export PDF fidèle
P36a| Import de la pige (retour d'antenne réel) | ✅ | 657c656 | importPige.js, PanneauImportPige.jsx, Pige.jsx, migration-p36a | import_pige + diffusion_reelle ; pige = RÉEL diffusé à la seconde ; nom BRUT, aucune FK catalogue ; heures 27:00→03:00 (time) + secondes linéaires ; undo (ecran PIGE)
P36b| La pige alimente l'historique fiche | ✅ | 635f9b4..f672ab1 | HistoriqueTitrePanel.jsx, rapprochementPige.js | sous-vue « Antenne » (défaut) ; rapprochement pige↔titre PAR LE NOM (normalisé + inclusion bidirectionnelle ≥4c, IMPARFAIT) ; lignes cliquables → section Pige
P36c| Section Pige : Import / Historique + save explicite | ✅ | 8144c7f | Pige.jsx, PanneauImportPige.jsx, TableauLignesPige.jsx | 2 vues internes ; brouillon EN MÉMOIRE → « Enregistrer dans l'historique » (rien en base avant) ; filtres Jour/Semaine/Mois
P37b| Droits d'auteur : nb de diffusions payantes | ✅ | f632eaf 7119a27 | droitsAuteur.js, exportDroitsAuteur.js, DroitsAuteur.jsx, migration-p37b | table droit_auteur ; comptage SEUL (aucun montant, la finance calcule) ; > 3e diffusion réelle = payante ; exclusions[] + override + valide ; rôle GESTION_DROITS_STOCK + SUPER_ADMIN
P37c| Contrat obligatoire pour production externe | ✅ | 56d37ab | FicheProgramme.jsx | EXTERNE sans référence ni fichier de contrat → blocage à l'enregistrement (édition) ET à la sortie de fiche
P40 | Rapport de volume horaire (depuis la pige) | ✅ | b2081a9 | volumeHoraire.js, exportVolumeHoraire.js, RapportVolume.jsx, semaine.js, migration-p53 | volume RÉEL diffusé par période (jour/semaine/mois) : table par GENRE pige (fiable, aucun rapprochement) + table par PROGRAMME (rapproché par nom, approximatif, corrigeable) + table des NON RAPPROCHÉES ; égalité de contrôle T1 = T2 + T3 affichée et exportée ; export Word (docx) ; aucune persistance (régénérable) ; période jour/semaine/mois/année ; bloc « Piges prises en compte » (traçabilité de la source, visible AVANT génération) ; réservé AUDIT + SUPER_ADMIN (Ilyas = AUDIT comme Taoufik, compte ilyas.audit) — l'Audit gagne au passage l'accès à l'historique des piges
P43b| Dashboard audit : tableau permanent des violations + export + lien grille | ✅ | e796b97 | DashboardAudit.jsx, GrilleLineaire.jsx, App.jsx | tableau des violations de grille type (écarts + hors bloc) toujours visible sous les KPI, 30 lignes/30 au défilement, tri plus récent d'abord ; export Excel ; action « Consulter la grille » par ligne → deep-link grilleCible (même mécanique que pigeCible/programmeCible) ouvrant Grille linéaire à la bonne semaine avec le bloc centré + surligné ~2,6 s (id grille-bloc-<id>, patron du clignotement de ligne de pige P36b) ; tableau dépliable par KPI conservé en plus
P43b| Grille linéaire accessible à l'Audit, en lecture seule | ✅ | 5eb6fa9 | roles.js, GrilleLineaire.jsx | le lien « Consulter la grille » ci-dessus rebondissait (AUDIT absent de SECTIONS_PAR_ROLE.GRILLE_LINEAIRE) → ajouté, mais en LECTURE SEULE (peutEditerGrilleLineaire, faux pour AUDIT) : CataloguePanel masqué, création/glisser-déposer/déprogrammer/sélection multiple/coller/undo-redo/+.../Enregistrer désactivés (20 points de garde), bandeau ambre de rappel ; le clignotement du bloc ciblé reste actif
P43b| Grille type accessible à l'Audit, en lecture seule | ✅ | d9b2a5c | roles.js, GrilleType.jsx | même traitement que Grille linéaire ci-dessus — l'Audit consulte aussi la Grille type (référence que la Grille linéaire est censée respecter) sans l'éditer (peutEditerGrilleType, faux pour AUDIT) : PaletteGenres masquée, dépôt/étirement de bloc/suppression directe/sélection multiple/coller/undo-redo/+.../Importer/Enregistrer désactivés, bandeau ambre ; AUDIT réordonné dans SECTIONS_PAR_ROLE (Dashboard, Grille type, Grille linéaire, Pige, Volume horaire — suit l'ordre du menu maître navigation.js)
P54 | Bouton Grille type + lien Mplanner + filtre Production | ✅ | 56e3e76 | conformiteGrilleType.js, DashboardAudit.jsx, GrilleType.jsx, App.jsx, FicheProgramme.jsx, ListeProgrammes.jsx, migration-p54 | (1) tableau des violations : bouton « Grille type » à côté de « Grille » → deep-link grilleTypeCible (blocId, pas de date — un bloc est récurrent par jour de semaine) ouvrant le bon document + surlignage (data-bloc-id, pas id : un bloc apparaît sur plusieurs colonnes) ; lignes hors-bloc = pas de blocId, ouvre sans surligner. (2) programme.lien_mplanner (migration-p54) : champ visible SEULEMENT si production=INTERNE (outil externe de ressources/coût pour les productions internes), conservé en base même masqué. (3) filtre Production (Tous/Interne/Externe) sur la liste des programmes, à côté du filtre Genre
P54b| Lien Mplanner : saisie restreinte, bouton « Ouvrir » en style bouton | ✅ | d4a4bb7 | roles.js, FicheProgramme.jsx | peutEditerLienMplanner (SUPER_ADMIN/ADMIN_CHAINE/GESTION_DROITS_STOCK, ex. Safae/Oumnia) — plus étroit que peutEditerProgramme : le Programmateur (Younes) et Acquisitions éditent le reste de la fiche mais consultent ce lien en lecture seule (rendu conditionnel séparé du fieldset général, pas de disabled en cascade) ; « Ouvrir Mplanner » devient un vrai bouton bordé (hover navy) au lieu d'un lien souligné
```

## 5. Décisions structurantes (pièges à ne pas refaire)

- **Exclusivité** : `programme.chaine_id` NULL = partagé toutes chaînes ; renseigné = exclusif ; `chaines_autorisees[]` = accès accordé par circuit de demande (P37). Auditer tout usage de `chaine_id` avant d'y toucher.
- **Multi-documents** : `grille` / `grille_type` / `plan_media` nommés, **un seul `est_live` par chaîne** (index partiel unique).
- **Undo/redo** : `historique_action` (ops jsonb), scopé chaîne+écran+document ; « annulation sur toute écriture » (une génération auto = 1 opération).
- **Journée d'antenne 06:00 → 06:00 EN DUR** (`semaine.js` `DEBUT_JOURNEE_ANTENNE`) ; heures avant 06:00 = fin de la veille ; ne se décale qu'à l'export.
- **Rôles = PoC** : aucun mot de passe, RLS toutes ouvertes `anon_all_*` ; `src/lib/roles.js` = **point unique** « qui voit quoi » ; vraie auth Supabase reportée à la production.
- **Grille non-linéaire** (réseaux + VOD) = extension **hors cahier** (le cahier STM Next est centré linéaire).
- **Pige = source du RÉEL diffusé** (à la seconde), distincte du **programmé** (`diffusion_lineaire`). Import **autonome** : `diffusion_reelle.programme` = nom **brut**, **AUCUNE FK** vers `programme`.
- **Rapprochement pige ↔ catalogue PAR LE NOM** (`rapprochementPige.js` : normalisation sans accents/casse/ponctuation/parenthèses + inclusion bidirectionnelle ≥ 4 caractères) — **imparfait**, faux positifs/négatifs assumés → toute consommation montre les diffusions rapprochées et laisse l'humain corriger/valider.
- **Droits d'auteur = assistant de COMPTAGE, pas autorité** : l'app ne calcule **aucun montant** ; > 3e diffusion réelle = payante ; la finance applique ses barèmes. Concerne **uniquement** la production EXTERNE (interne = acteurs salariés SNRT).
- **Production EXTERNE** : contrat obligatoire (référence ou fichier), blocage à l'enregistrement et à la sortie de fiche. INTERNE : droits illimités.
- **Genre** stocké comme **libellé FR en clair** (pas de FK vers table `genre`, jointure par texte). Le **genre de la pige** (`genre_niv1/2/3`) est une **autre taxonomie** : utilisé **brut**, jamais mappé vers les 9 genres internes (un mapping rendrait approximatif un chiffre par ailleurs fiable).
- **Consommer la pige sans rien perdre** (P40, patron à réutiliser) : ce qu'aucun programme ne réclame — ou que l'humain a décoché — bascule dans une table « non rapprochées » et jamais hors du total. D'où l'**égalité de contrôle affichée** `total par genre = total par programme + total non rapprochées`. Une ligne de pige est attribuée à **au plus un** programme (titre le plus long, départage alphabétique) — sinon le double comptage casse l'égalité.
- **Couleur = genre** uniquement ; signalisation rouge/ambre/vert.
- **Numérotation phases** : deux séries parallèles (linéaire P0→P49 + suffixes P36a/b/c, P37a/b/c). Le n° de fichier migration ≠ le n° de phase (ex. « P36 » PLAN.md = migration-p40 ; « P36a » = migration-p36a).

## 6. Reste à faire (planifié, non codé)

- **P39b — Comparaison Plan média (prévu) vs pige (réel)** : rapprochement d'écarts, patron `DashboardAudit.jsx`. Dépend de P36.
- **Décompte auto des passages de droits** (`fenetre_droits.passages_consommes`) à la diffusion RÉELLE (RG-06) — jamais automatique aujourd'hui. Dépend de P36.
- **« Type de bloc == Genre » (grille linéaire)** : correction de logique en attente de clarification utilisateur (PLAN.md §21).
- **Vraie auth Supabase** : mot de passe, RLS par rôle via `auth.uid()`, ciblage des notifications par utilisateur — reporté à la production.

## 7. Fichiers de référence (`design-reference/`)

- **Cahier_des_charges_STM_Next.docx** — LE contrat (modules M0–M10, exigences EXG-Mx-nn priorisées, règles RG, modèle de données). **Autorité n°1.**
- **stm-next-mockup.html** — cible visuelle GUI/UX (prototype fonctionnel).
- **stm-existant/** — captures de l'ancien STM (`01-fiche-programme` … `10-accueil-statistiques`) + logos SNRT + `README.md`.
- **Pigedu3108.xlsx** — pige réelle. Feuille `Data` (Chaîne · Date · Jour · Code Écran · Code Program · Programme · H.Début · H.Fin · Durée · Libellé · Code Genre · Genre Niv.1/2/3) + feuille `Info` (métadonnées). Format d'import **P36a**.
- **PM MARDI 07 JUIL 2026 (1).xlsx** — plan média réel (feuille `PM`). Format d'import **P26**.
- **grille du 07 au 13 09 2026.xlsx** + **Grille des programmes AL AOULA …docx** + **Grille_07-09-2026.pdf** — grilles chaîne réelles. Gabarits d'export **P41b**.
- **Porjet de Grille Ramadan 2023 V24022023.xlsx** — grille type saisonnière (import **P28**).
- **20260904_AL AOULA_20260903ai.pdf** — conducteur de pub réel (« Édité par BOA »). Cible d'export **P39a**.
