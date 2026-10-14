# Audit des sources de données et architecture — Football Hub

*Audit réalisé le 14 octobre 2026. Les offres gratuites changent : revérifier les pages officielles avant toute mise en production.*

## 1. Matrice de couverture et de faisabilité

| Critère | football-data.org (gratuit) | API-Football (gratuit) | TheSportsDB (clé publique) |
|---|---|---|---|
| Inscription | E-mail, sans carte | E-mail, sans carte | Aucune (clé publique `123`) |
| Quota | 10 appels / minute, pas de plafond journalier | 100 appels / jour (remise à zéro 00:00 UTC) + 10 / minute | ~30 appels / minute, réponses tronquées |
| Compétitions | 12 : Premier League, Championship, Ligue 1, Liga, Serie A, Bundesliga, Eredivisie, Primeira Liga, Brasileirão, Ligue des champions, Coupe du monde, Euro | Toutes (plus de 1 000), **mais saisons limitées sur l'offre gratuite** | Plusieurs centaines, données communautaires |
| Botola Pro | ❌ (non couverte, même en payant) | ✅ (ligue n° 200) — saison courante à vérifier avec une clé réelle | ✅ ligue n° **4520**, nommée « Moroccan Championship » (alias « Botola Pro Inwi ») — **vérifié le 14/10/2026** |
| Ligue Europa / CAF / CAN | ❌ en gratuit (offres payantes) | ✅ | Partiel, à vérifier |
| Scores | **Différés** en gratuit | En direct (rafraîchi ~15 s) mais quota de 100/jour | Direct réservé aux abonnés |
| Classements | ✅ | ✅ | ✅ |
| Buteurs | ✅ | ✅ | ❌ |
| Compositions, stats de match | ❌ en gratuit | ✅ | Partiel |
| Effectifs | ✅ (selon compétition) | ✅ | ✅ partiel |
| Fiches joueurs / transferts / blessures | Basique | ✅ | Basique |
| Historique | Saison courante + quelques saisons | Limité en gratuit | Limité (100 événements/saison en gratuit) |
| Logos / photos | URL fournies ; droits appartenant aux clubs | URL fournies ; droits appartenant aux clubs | Images communautaires, droits variables |
| Usage public web/PWA | Toléré pour projets non commerciaux avec attribution — **relire les conditions** | Clé à usage personnel ; redistribution massive interdite — **relire les CGU** | Usage gratuit avec attribution ; clé publique déconseillée en production |

### Ce qui n'est pas faisable gratuitement (et comment l'application le gère)

- **Direct réel sur toutes les compétitions** : impossible à 0 €. L'interface affiche « scores différés » pour football-data.org et n'annonce jamais de temps réel.
- **Statistiques détaillées et compositions** : uniquement via API-Football (100 appels/jour). Les onglets correspondants sont masqués si la source ne les fournit pas.
- **Ligue Europa, CAF, CAN** : non couvertes par la source principale gratuite. Elles ne sont pas affichées comme couvertes ; l'architecture permet de les ajouter via API-Football ou un plan payant.
- **Actualités** : nécessitent des flux RSS dont la licence autorise la reprise (titre + lien). Prévu en phase 3.
- **Notifications push** : faisables gratuitement (Web Push + VAPID) mais nécessitent un stockage des abonnements et une tâche planifiée ; prévu en phase 3. iOS ne les accepte que si la PWA est installée sur l'écran d'accueil (iOS 16.4+).

### Vérifications réelles effectuées sur TheSportsDB (clé publique, 14/10/2026)

- `lookupleague.php?id=4520` → « Moroccan Championship », alias « Botola Pro Inwi, Botola Pro », saison 2026-2027.
- ⚠️ `search_all_leagues.php?c=Morocco` renvoie aussi « Moroccan Botola 2 » (id 4657) : c'est la **2e division**. Une recherche par nom « botola » aurait affiché la mauvaise compétition. L'application utilise donc l'identifiant 4520, vérifié par son nom à chaque résolution.
- `eventsday.php?d=…&l=4520` fonctionne (matchs du jour Botola disponibles).
- `lookuptable.php` est **tronqué à 5 lignes** et `eventsseason.php` à **15 matchs** : l'interface affiche « liste incomplète » sur ces vues.
- Les horaires (`strTimestamp`) sont en UTC sans suffixe `Z` ; l'adaptateur les convertit explicitement.

## 2. Choix retenus

| Besoin | Fournisseur | Raison |
|---|---|---|
| Matchs du jour, calendriers, résultats, classements, buteurs (12 compétitions) | football-data.org | Quota par minute, durable, gratuit « pour toujours » selon son auteur |
| Botola Pro et compléments | TheSportsDB | Couvre le Maroc sans clé ; résultats et classements |
| Fiches de match détaillées (événements, compos, stats) | API-Football (optionnel) | Seule source gratuite avec ces données ; budget journalier plafonné côté serveur |
| Hébergement + fonctions + cache | Netlify (offre gratuite, sans carte) | HTTPS, URL gratuite `*.netlify.app`, fonctions serverless, stockage Netlify Blobs |
| Comptes et synchronisation (phase 3) | Supabase (offre gratuite) | Auth + Postgres avec règles d'accès par ligne (RLS) |

## 3. Architecture

```
Navigateur / PWA (React + TanStack Query + service worker)
        │  /api/*  (jamais de clé côté client)
        ▼
Fonction Netlify « api » ── routeur ── validation des paramètres
        │
        ├── Cache partagé (Netlify Blobs, TTL selon le statut du match)
        │      └── copie « périmée » conservée pour servir en cas d'erreur / 429
        ├── Limiteur par fournisseur (débit/minute + budget/jour)
        └── Adaptateurs
              ├── footballData.ts  → modèle normalisé
              ├── theSportsDb.ts   → modèle normalisé
              └── apiFootball.ts   → modèle normalisé (si clé présente)
```

### Principes

- **Identifiants préfixés par fournisseur** (`fd:524`, `tsdb:4521`, `af:200`). Deux entités ne sont jamais fusionnées sur la ressemblance de leurs noms ; un rapprochement entre fournisseurs ne pourra se faire que via une table de correspondance explicite.
- **Provenance** : chaque réponse porte `meta.provider`, `meta.fetchedAt`, `meta.delayed`, `meta.stale` et la mention d'attribution.
- **Cache adaptatif** : matchs en cours 60 s, jour J 2 min, futurs 1 h, terminés 24 h, classements 10 min, référentiels 24 h.
- **Mutualisation** : tous les visiteurs lisent la même entrée de cache ; une seule requête part vers le fournisseur par clé de cache et par période.
- **Erreurs et 429** : en cas d'échec, la dernière copie connue est servie avec `stale: true` ; l'interface l'indique.
- **Validation** : les paramètres d'entrée (dates, identifiants) sont vérifiés par expressions strictes ; les réponses externes sont normalisées champ par champ, jamais transmises brutes.

### Modèle de données normalisé (extrait)

```ts
Match { id, provider, competition, utcDate, status, minute?, venue?,
        home: TeamRef, away: TeamRef, score: { home, away, halfTime? },
        events?, lineups?, stats? }
TeamRef { id, name, shortName?, crest? }
Competition { id, provider, name, code?, area: { name, flag? }, emblem?, type, currentSeason? }
StandingRow { position, team, played, won, draw, lost, goalsFor, goalsAgainst, goalDiff, points, form? }
```
Les champs optionnels absents restent absents : l'interface affiche « non disponible » plutôt qu'une valeur inventée.

## 4. Phases

1. **Audit et architecture** — ce document. ✅
2. **MVP** — accueil (date, filtres, fuseau), compétitions (classement, calendrier, résultats, buteurs, clubs), fiches match et club, favoris locaux, 3 langues + RTL, thèmes, PWA. ✅
3. **Enrichissement** — fiches joueurs, statistiques et graphiques (API-Football), comptes Supabase, notifications Web Push, actualités RSS.
4. **Validation et déploiement** — tests, audit Lighthouse, mise en ligne Netlify.
