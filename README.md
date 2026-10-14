# Football Hub

Plateforme de football (site web + application installable PWA) : matchs du jour, calendriers, résultats, classements, buteurs, fiches de matchs et de clubs, favoris sans compte. Trois langues (français, arabe avec interface de droite à gauche, anglais), thème clair, sombre ou système.

**Aucune donnée n'est inventée.** Tout provient d'API gratuites ; ce qu'une source ne fournit pas est affiché comme « non disponible ». Les scores de l'offre gratuite de football-data.org sont **différés** et l'application l'indique.

L'audit des sources et l'architecture sont détaillés dans [`docs/AUDIT.md`](docs/AUDIT.md).

---

## Ce qui fonctionne gratuitement

| Compétition | Source | Contenu |
|---|---|---|
| Ligue 1, Premier League, Liga, Serie A, Bundesliga, Ligue des champions, Coupe du monde, Euro, Championship, Eredivisie, Liga Portugal, Brasileirão | football-data.org (clé gratuite) | Matchs, résultats, classements, buteurs, clubs, effectifs, face-à-face |
| Botola Pro | TheSportsDB (sans clé) | Matchs du jour, calendrier et classement (listes tronquées en gratuit, signalé à l'écran) |
| Ligue Europa, Ligue des champions CAF, CAN | API-Football (clé gratuite, optionnelle) | Affichées seulement si la clé est fournie et si l'offre gratuite donne accès à la saison |

Compositions et statistiques détaillées de match : uniquement avec API-Football (100 requêtes/jour).

---

## 1. Obtenir les clés gratuites

### football-data.org (indispensable)
1. Allez sur https://www.football-data.org/client/register
2. Saisissez votre e-mail. Aucune carte bancaire n'est demandée.
3. Vous recevez votre clé (« API token ») par e-mail.

### API-Football (facultatif)
1. Allez sur https://dashboard.api-football.com/register
2. Créez un compte gratuit (100 requêtes par jour, sans carte).
3. Copiez votre clé dans **Account → My Access**.

### TheSportsDB
Rien à faire : la clé publique gratuite est utilisée par défaut.

---

## 2. Installer et lancer sur votre ordinateur

Prérequis : [Node.js](https://nodejs.org) version 20 ou plus.

```bash
npm install
cp .env.example .env        # puis ouvrez .env et collez votre clé football-data.org
npm install -g netlify-cli  # une seule fois : sert à lancer les fonctions serveur en local
npm run dev:netlify         # ouvre http://localhost:8888
```

> `npm run dev` lance uniquement l'interface (port 5173) ; les données ne s'affichent que si `netlify dev` tourne en parallèle.

Autres commandes :

| Commande | Rôle |
|---|---|
| `npm test` | Tests unitaires (adaptateurs, cache, quotas, routeur) |
| `npm run typecheck` | Vérification TypeScript |
| `npm run build` | Version de production dans `dist/` |
| `npm run icons` | Régénère les icônes PWA depuis `public/favicon.svg` |

---

## 3. Mettre en ligne gratuitement (Netlify)

1. Créez un compte gratuit sur https://app.netlify.com (sans carte bancaire).
2. Déposez ce dossier sur GitHub, puis dans Netlify : **Add new site → Import an existing project** et choisissez le dépôt. Les réglages de compilation sont lus dans `netlify.toml`.
3. Dans **Site configuration → Environment variables**, ajoutez `FOOTBALL_DATA_TOKEN` (et `API_FOOTBALL_KEY` si vous en avez une).
4. Relancez le déploiement. Votre site est disponible sur une adresse gratuite du type `https://votre-site.netlify.app`, en HTTPS.

Les clés ne quittent jamais le serveur : le navigateur n'appelle que `/api/…`.

---

## 4. Installer l'application (PWA)

- **iPhone / iPad** : ouvrez le site dans Safari → bouton Partager → « Sur l'écran d'accueil ».
- **Android** : ouvrez le site dans Chrome → menu ⋮ → « Installer l'application ».
- **Ordinateur** : dans Chrome ou Edge, cliquez sur l'icône d'installation dans la barre d'adresse.

Hors connexion, l'application affiche les dernières données consultées. Quand une nouvelle version est publiée, un bandeau propose de la charger.

---

## 5. Comment les quotas sont respectés

- Toutes les requêtes passent par **une seule fonction serveur** qui partage un cache entre tous les visiteurs (Netlify Blobs) : cent visiteurs sur la même page = un seul appel à la source.
- Durée de cache selon l'état des matchs : 1 min s'il y a un match en cours, 2 min le jour J, 1 h pour les jours futurs, 24 h pour les résultats anciens.
- Compteurs partagés par source : 9 appels/min pour football-data.org (limite 10), 25/min pour TheSportsDB, et un budget journalier (90 par défaut, réglable) pour API-Football.
- En cas d'erreur ou de réponse 429, la dernière copie connue est servie avec la mention « données possiblement obsolètes », et la source est mise en pause le temps indiqué.
- Le navigateur ne rafraîchit pas les données quand l'onglet est en arrière-plan.

---

## 6. Structure du projet

```
server/                 Logique serveur (indépendante de l'hébergeur)
  model.ts              Modèle de données normalisé
  cache.ts / quota.ts   Cache partagé, déduplication, limites et 429
  providers/            Un adaptateur par source (football-data, TheSportsDB, API-Football)
  registry.ts           Quelle source pour quelle compétition (sans doublon)
  service.ts, router.ts Routes /api et validation des paramètres
netlify/functions/api.mts  Point d'entrée serverless
src/                    Application React (pages, composants, i18n, favoris)
tests/                  Tests unitaires (données fictives clairement identifiées)
docs/AUDIT.md           Audit des API et architecture
```

Les identifiants sont préfixés par la source (`fd:524`, `tsdb:4520`, `af:200`). Deux équipes ou deux matchs de sources différentes ne sont jamais fusionnés sur la ressemblance de leurs noms.

---

## 7. Prochaines étapes (phase 3)

- Fiches joueurs enrichies et statistiques avancées (API-Football).
- Comptes facultatifs et synchronisation des favoris (Supabase, offre gratuite).
- Notifications de match (Web Push) — désactivées par défaut, avec votre accord. Sur iPhone, elles exigent que l'application soit installée sur l'écran d'accueil (iOS 16.4 ou plus).
- Rubrique actualités à partir de flux RSS autorisés (titre, date, source et lien vers l'article original).

## Mentions

Données football fournies par football-data.org, TheSportsDB et API-Football. Les écussons et logos appartiennent à leurs détenteurs respectifs et sont affichés via les URL fournies par les sources. Football Hub n'est affilié à aucune de ces organisations.
