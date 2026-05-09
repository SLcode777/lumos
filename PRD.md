# PRD — Lumos

## Un navigateur PostgreSQL web, simple, élégant et agréable à utiliser.

**Domaine** éventuel : lumos-maxima.dev

---

## 1. Vision produit

**Lumos** est une application web permettant de se connecter à n'importe quelle base de données PostgreSQL et d'en explorer visuellement le contenu : tables, colonnes, relations, données. L'objectif est d'offrir une expérience de navigation fluide et intuitive, comparable à ce que propose [Simpl.sh](https://www.simpl.sh/) en app macOS native, mais accessible depuis n'importe quel navigateur et n'importe quel OS.

### Pourquoi ce projet ?

- **Besoin personnel** : disposer d'un outil agréable pour parcourir ses propres bases PostgreSQL au quotidien, sans dépendre d'un OS spécifique.
- **Projet open-source auto-hébergeable** : conçu pour être déployé par n'importe qui via Docker, sans dépendance à un service tiers. Code source ouvert sous licence MIT.
- **Projet portfolio** : démontrer des compétences avancées en développement web full-stack (SQL dynamique, sécurité, UX soignée, architecture propre).

### Public cible

- Développeurs et développeuses qui veulent explorer rapidement le contenu de leurs bases PostgreSQL sans écrire de SQL.
- Petites équipes qui veulent partager l'accès en lecture à certaines BDD sans distribuer les credentials.
- Utilisateurs en mode solo (1 instance = 1 personne) ou multi-user (1 instance = équipe), au choix de l'admin de l'instance.

---

## 2. Stack technique

### Frontend

| Technologie | Rôle |
|---|---|
| **Next.js 15** (App Router) | Framework full-stack, SSR, API Routes / Server Actions |
| **TypeScript** | Typage statique sur toute la codebase |
| **Tailwind CSS** | Styling utilitaire |
| **shadcn/ui** | Composants UI (tables, dialogs, inputs, command palette, toasts) |
| **React Flow** | Visualisation interactive du schéma de base de données (diagramme) |

### Backend & données

| Technologie | Rôle |
|---|---|
| **Prisma** | ORM pour la BDD applicative (users, connexions sauvegardées, préférences) |
| **PostgreSQL** via docker | BDD applicative hébergée |
| **node-postgres (`pg`)** | Client PostgreSQL brut pour les connexions dynamiques aux BDD des utilisateurs |
| **Node.js `crypto`** | Chiffrement AES-256-GCM des connection strings stockées |

### Auth

| Technologie | Rôle |
|---|---|
| **Better Auth** | Authentification : email/password local par défaut + OAuth GitHub/GitLab optionnel (activable via variables d'env) |

### Déploiement

| Technologie | Rôle |
|---|---|
| **Docker / Docker Compose** | Hébergement auto-hébergeable. Une seule commande `docker compose up` pour démarrer une instance complète (app + BDD applicative). |

### Futur (optionnel)

| Technologie | Rôle |
|---|---|
| **Tauri** | Encapsulation en app desktop native si souhaité |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────┐
│                   Navigateur                     │
│         Next.js App (React + TypeScript)         │
└────────────────────┬────────────────────────────┘
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────┐
│             Next.js Server (API Routes)          │
│                                                  │
│  ┌──────────────┐       ┌─────────────────────┐ │
│  │   Prisma      │       │   pg (node-postgres)│ │
│  │   ORM         │       │   Client dynamique  │ │
│  └──────┬───────┘       └──────────┬──────────┘ │
│         │                          │             │
└─────────┼──────────────────────────┼─────────────┘
          │                          │
          ▼                          ▼
┌──────────────────┐    ┌──────────────────────────┐
│  BDD Applicative │    │   BDD(s) de l'utilisateur │
│  (pg Docker)     │    │   (n'importe quel lien PG)│
│                  │    │                           │
│  - users         │    │  Connexion avec les       │
│  - connections   │    │  credentials fournis      │
│  - preferences   │    │  par l'utilisateur        │
│  - layouts       │    │                           │
└──────────────────┘    └──────────────────────────┘
```

### Principes clés

- **Deux bases distinctes** : la BDD applicative (gérée par Prisma, contient les comptes, connexions sauvegardées, partages, préférences) est séparée des BDD clientes (accédées dynamiquement via `pg`).
- **Le serveur est un proxy** : toutes les requêtes vers les BDD clientes passent par les API routes Next.js. Les credentials ne sont jamais exposés côté client, ni aux users avec qui une connexion est partagée.
- **Connection pooling** : un `pg.Pool` par connexion utilisateur active, avec timeout et nettoyage automatique pour éviter les fuites de connexion.
- **Multi-user avec isolation** : chaque user ne voit que ses propres connexions, plus celles qui lui ont été explicitement partagées par leur owner. Aucune connexion n'est visible globalement par défaut, même pour les admins de l'instance.

### Types de BDD supportées comme cibles

Lumos peut se connecter à **n'importe quelle BDD PostgreSQL joignable depuis la machine où il tourne**. Concrètement, la machine où tourne Lumos a la même connectivité réseau que celle d'un client `psql` lancé depuis cette même machine. Quelques cas typiques :

| Cas | Exemple de connection string | Pré-requis |
|---|---|---|
| **BDD cloud managée** (Neon, Supabase, Railway, RDS, Heroku Postgres…) | `postgresql://user:pass@ep-xxx.aws.neon.tech:5432/db?sslmode=require` | Accès internet depuis Lumos |
| **BDD Postgres en Docker sur la même machine que Lumos** | `postgresql://postgres:secret@localhost:5432/db` (si le container expose `-p 5432:5432`) | Lumos déployé localement |
| **BDD sur une autre machine du réseau local** (homelab, VM, collègue) | `postgresql://user:pass@192.168.1.42:5432/db` | Réseau local accessible, firewall ouvert |
| **BDD derrière un VPN / Tailscale / Cloudflare Tunnel** | `postgresql://user:pass@<hostname-du-tunnel>:5432/db` | Lumos connecté au même tunnel |

> **Recommandation pour usage perso** : si tu veux explorer à la fois des BDD cloud (Neon…) et des Postgres locaux en Docker, déploie Lumos en local sur ta machine (`docker compose up`). Lumos atteindra les BDD cloud via internet ET les Postgres locaux via `localhost`, sans configuration supplémentaire.

> **Limite importante** : si Lumos est déployé sur un serveur distant (VPS, homeserver), il ne pourra pas atteindre une BDD qui tourne uniquement sur le laptop d'un user. Solutions possibles : tunnel (Tailscale, Cloudflare Tunnel), ou déployer Lumos en local.

---

## 4. Modèle de données applicatif (Prisma)

```prisma
model User {
  id              String              @id @default(cuid())
  email           String              @unique
  name            String?
  passwordHash    String?             // null si OAuth uniquement
  image           String?
  role            String              @default("user") // "admin" | "user"
  connections     Connection[]        // Connexions dont l'user est owner
  sharedAccess    ConnectionAccess[]  // Connexions partagées avec cet user
  invitationsSent Invitation[]        @relation("InvitedBy")
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt
}

model Connection {
  id                  String             @id @default(cuid())
  name                String             // Nom affiché (ex: "Prod AllyMeal", "Dev local")
  encryptedConnString String             // Connection string chiffrée AES-256-GCM
  iv                  String             // Vecteur d'initialisation pour le déchiffrement
  authTag             String             // Tag d'authentification AES-GCM
  sslEnabled          Boolean            @default(true)
  isReadOnly          Boolean            @default(true)
  userId              String             // Owner de la connexion
  user                User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  sharedAccess       ConnectionAccess[]  // Users avec qui la connexion est partagée
  layouts             TableLayout[]
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt
}

// Partage d'une connexion entre l'owner et d'autres users de l'instance.
// Pour le MVP, seul le rôle "viewer" est supporté (lecture seule).
model ConnectionAccess {
  id           String     @id @default(cuid())
  connectionId String
  connection   Connection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  userId       String
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  role         String     @default("viewer") // "viewer" pour le MVP, "editor" prévu plus tard
  sharedById   String     // ID de l'user qui a partagé (typiquement l'owner)
  createdAt    DateTime   @default(now())

  @@unique([connectionId, userId])
}

// Invitation d'un nouvel user à rejoindre l'instance.
// L'admin génère un lien (token) qu'il transmet hors-app (Signal, mail, etc.).
// Le token est stocké hashé en BDD.
model Invitation {
  id           String    @id @default(cuid())
  tokenHash    String    @unique // Hash du token (jamais en clair)
  email        String?            // Optionnel : pré-remplit l'email à l'inscription
  invitedById  String
  invitedBy    User      @relation("InvitedBy", fields: [invitedById], references: [id], onDelete: Cascade)
  expiresAt    DateTime
  consumedAt   DateTime?          // Marqueur d'usage unique
  createdAt    DateTime  @default(now())
}

model TableLayout {
  id            String     @id @default(cuid())
  connectionId  String
  connection    Connection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  tableName     String
  columnOrder   Json       // Array des noms de colonnes dans l'ordre souhaité
  hiddenColumns Json       // Array des colonnes masquées
  columnWidths  Json?      // Largeurs personnalisées { colName: width }
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  @@unique([connectionId, tableName])
}
```

> **Note sur les layouts** : pour le MVP, `TableLayout` est lié à une connexion (pas à un user). Les viewers d'une connexion partagée verront donc le layout configuré par l'owner. Une évolution future pourra permettre des layouts personnels par user.

---

## 5. Fonctionnalités — Détail et priorisation

### Phase 1 — Fondations

**Objectif** : un utilisateur peut s'inscrire (via invitation ou ouverture publique), se connecter, et sauvegarder une connexion PostgreSQL. L'admin de l'instance peut gérer les inscriptions et les users.

| Fonctionnalité | Détail |
|---|---|
| Inscription / login | Géré via **Better Auth**. Email + mot de passe (hash via bcrypt/argon2 selon Better Auth) **ET** OAuth GitHub/GitLab. L'OAuth est activable via variables d'env (`GITHUB_CLIENT_ID`, `GITLAB_CLIENT_ID`, etc.) — si non configuré, seul email/password est disponible. |
| First-user-is-admin | Le premier compte créé sur une instance fraîche reçoit automatiquement le rôle `admin`. Tous les comptes suivants sont `user` par défaut. |
| Mode d'inscription | Variable d'env `REGISTRATION_MODE` avec 3 valeurs : `open` (n'importe qui peut créer un compte), `invite-only` (inscription possible uniquement avec un token d'invitation valide — **valeur recommandée par défaut**), `closed` (aucune nouvelle inscription, l'admin doit changer la config). |
| Invitations (admin) | Dans l'UI admin, un bouton "Générer un lien d'invitation" produit une URL contenant un token (cryptographiquement aléatoire, 32 bytes, single-use, expirable 7 jours par défaut). Le token est stocké **hashé** en BDD. L'admin transmet le lien hors-app (Signal, password manager, mail, etc.). À la consommation, le token est marqué consumé et ne peut plus servir. |
| Gestion des users (admin) | Page admin listant tous les users : voir leur rôle, désactiver/réactiver un compte, supprimer un compte. Promouvoir un user en admin (un admin ne peut pas se rétrograder lui-même s'il est le dernier admin). |
| Dashboard connexions | Liste des connexions de l'user (owner + partagées), avec un badge distinguant ses connexions et celles partagées (et par qui). Bouton "Nouvelle connexion". |
| Formulaire de connexion | Champ pour la connection string OU champs séparés (host, port, user, password, database). Toggle SSL. Toggle read-only. |
| Test de connexion | Avant de sauvegarder, on teste que la connexion fonctionne. Feedback visuel (succès/échec). |
| Chiffrement | La connection string est chiffrée côté serveur avec AES-256-GCM avant stockage. Clé de chiffrement dans une variable d'environnement (`ENCRYPTION_KEY`). |
| Isolation par user | Toutes les requêtes API filtrent par `userId` côté serveur. Un user ne peut accéder qu'à ses propres connexions ou à celles partagées avec lui — vérifié à chaque requête, jamais en se fiant au client. |

### Phase 2 — Introspection du schéma

**Objectif** : une fois connecté à une BDD, afficher la structure complète (tables, colonnes, types, relations).

| Fonctionnalité | Détail |
|---|---|
| Découverte automatique | Requêtes sur `information_schema.tables`, `information_schema.columns`, `information_schema.key_column_usage`, `information_schema.table_constraints` pour extraire tables, colonnes, types, clés primaires, clés étrangères. |
| Sidebar | Liste des tables avec le nombre de lignes (via `pg_stat_user_tables` ou `COUNT(*)`). Recherche rapide pour filtrer les tables. |
| Cache du schéma | Le schéma est mis en cache côté client (React state/context) pour éviter de le re-fetcher à chaque navigation. Bouton "Refresh" pour forcer la mise à jour. |

### Phase 3 — Browsing des données

**Objectif** : afficher les données d'une table dans un data grid navigable.

| Fonctionnalité | Détail |
|---|---|
| Data grid | Affichage tabulaire des records avec colonnes redimensionnables. |
| Pagination | Pagination côté serveur (LIMIT/OFFSET ou cursor-based). Taille de page configurable (25, 50, 100). |
| Tri | Clic sur un header de colonne pour trier ASC/DESC. Envoi d'un `ORDER BY` côté serveur. |
| Affichage type-aware | Rendu adapté selon le type : dates formatées, booleans en badges, JSON en code block collapsible, URLs cliquables, images en preview si c'est une URL d'image. |
| Vue détail | Clic sur un record → panneau latéral ou modal affichant tous les champs du record, y compris les champs longs (texte, JSON). |

### Phase 4 — Partage de connexions

**Objectif** : un owner peut partager une de ses connexions à d'autres users de l'instance, qui pourront alors la browse en lecture seule sans jamais voir les credentials.

| Fonctionnalité | Détail |
|---|---|
| Partage par owner | Sur la page de paramètres d'une connexion, section "Partage". L'owner peut ajouter un user en sélectionnant son email dans une liste autocomplétée des users existants de l'instance. Bouton "Inviter". |
| Rôle viewer (MVP) | Le viewer peut : voir la connexion dans son dashboard, browser le schéma et les données, exporter (Phase 9). Le viewer **ne peut pas** : voir/modifier les credentials, modifier les paramètres de la connexion, re-partager, supprimer la connexion, éditer les données (même si Phase 7 dispo). |
| Liste des partages | L'owner voit la liste des users avec qui il a partagé sa connexion, avec la date de partage. Bouton "Révoquer l'accès" pour chaque user. |
| Vue côté viewer | Dans le dashboard, badge "Partagé par [nom de l'owner]" sur les connexions reçues. Pas d'accès aux paramètres de connexion (formulaire credentials caché). |
| Sécurité serveur | À chaque requête sur une connexion, le serveur vérifie que l'user est soit l'owner, soit présent dans `ConnectionAccess` pour cette connexion. Sinon → 403. La vérification du rôle (`viewer` vs `owner`) gate les actions d'édition et de partage. |
| Évolution future | Le rôle `editor` (peut browse + éditer les données mais pas re-partager) est prévu pour une phase ultérieure, en lien avec l'édition inline (Phase 7). |

### Phase 5 — Filtrage et recherche

**Objectif** : pouvoir filtrer les données sans écrire de SQL.

| Fonctionnalité | Détail |
|---|---|
| Recherche globale | Champ de recherche qui fait un `ILIKE` sur les colonnes textuelles de la table courante. |
| Filtres type-aware | UI de filtrage avec opérateurs adaptés au type de colonne : `text` → contains, starts with, equals, is empty ; `integer/float` → =, !=, >, <, >=, <=, between ; `boolean` → is true, is false, is null ; `date/timestamp` → before, after, between, today, this week ; `uuid` → equals ; `jsonb` → contains key, is empty. |
| Filtres combinés | Possibilité d'empiler plusieurs filtres (AND logique). |
| Construction SQL sécurisée | Les clauses WHERE sont construites côté serveur avec des requêtes paramétrées (`$1`, `$2`…). Les noms de colonnes sont validés contre le schéma introspected (whitelist). |

### Phase 6 — Navigation relationnelle

**Objectif** : suivre les foreign keys naturellement entre les tables.

| Fonctionnalité | Détail |
|---|---|
| Détection des FK | À l'introspection, on identifie toutes les foreign keys et leurs tables cibles. |
| Lien cliquable | Dans la vue détail d'un record, chaque champ FK affiche le nom de la table cible et le record lié. Clic → navigation vers ce record. |
| Records liés | Dans la vue détail, section "Related records" montrant les tables qui référencent le record courant (reverse FK). Avec le count et un lien pour voir la liste. |
| Breadcrumb | Fil d'Ariane montrant le chemin de navigation entre les tables (ex: Products → Orders → Customers). |

### Phase 7 — Édition inline

**Objectif** : pouvoir modifier les données directement dans l'interface.

| Fonctionnalité | Détail |
|---|---|
| Mode read-only par défaut | L'édition est désactivée par défaut. L'utilisateur doit explicitement activer le mode édition pour une connexion (toggle dans les paramètres de connexion). |
| Édition dans la vue détail | Double-clic sur un champ → input adapté au type (text input, number input, date picker, toggle boolean, JSON editor). |
| Sauvegarde | Bouton "Save" ou Entrée → `UPDATE table SET column = $1 WHERE pk = $2` avec requête paramétrée. |
| Optimistic update | Mise à jour immédiate de l'UI, rollback en cas d'erreur serveur. Toast de confirmation ou d'erreur. |
| Identification du record | Utilisation de la clé primaire (détectée à l'introspection). Si pas de PK → édition désactivée pour cette table. |
| Validation | Validation côté client basique (type check) + gestion des erreurs PostgreSQL côté serveur (contraintes, types invalides). |

### Phase 8 — Diagramme de schéma

**Objectif** : visualiser la structure de la base sous forme de diagramme interactif.

| Fonctionnalité | Détail |
|---|---|
| Diagramme ERD | Chaque table = un nœud React Flow. Affiche le nom de la table, les colonnes (avec types et icônes PK/FK). |
| Relations | Les foreign keys sont représentées par des edges (flèches) entre les nœuds. |
| Interactivité | Nœuds draggables, zoom, pan, minimap. Clic sur une table → navigation vers le browsing de cette table. |
| Auto-layout | Disposition automatique initiale des nœuds (algorithme de type dagre ou elkjs). |

### Phase 9 — Export

**Objectif** : exporter les données de la vue courante.

| Fonctionnalité | Détail |
|---|---|
| Export CSV | Exporter les données affichées (avec filtres appliqués) en CSV. |
| Export JSON | Idem en JSON. |
| Scope | Export de la page courante ou de toute la table (avec avertissement si >10k lignes). |

### Phase 10 — Personnalisation des layouts (bonus)

| Fonctionnalité | Détail |
|---|---|
| Ordre des colonnes | Drag & drop pour réordonner les colonnes d'une table. Sauvegardé en BDD (model `TableLayout`). |
| Colonnes masquées | Possibilité de cacher des colonnes. |
| Persistance | Les layouts sont sauvegardés par connexion + table. |

---

## 6. Sécurité

### Chiffrement des credentials

- Les connection strings sont chiffrées avec **AES-256-GCM** côté serveur avant d'être stockées en base.
- La clé de chiffrement est stockée dans une **variable d'environnement** (`ENCRYPTION_KEY`), jamais dans le code.
- Le vecteur d'initialisation (IV) et le tag d'authentification sont stockés séparément pour chaque connexion.

### Protection contre l'injection SQL

- **Requêtes paramétrées** : toutes les valeurs utilisateur passent par des paramètres (`$1`, `$2`…), jamais par concaténation de strings.
- **Whitelist d'identifiants** : les noms de tables et colonnes sont validés contre le schéma introspected. Si un nom n'existe pas dans le schéma, la requête est rejetée.
- **Échappement PostgreSQL** : les identifiants sont quotés avec `"` (double quotes) pour gérer les noms avec des caractères spéciaux.

### Transport

- Toutes les connexions aux BDD clientes doivent utiliser **SSL/TLS** par défaut (configurable).
- L'application elle-même doit être servie en HTTPS en production (responsabilité de l'admin de l'instance — typiquement via un reverse proxy type Caddy/Traefik/nginx avec Let's Encrypt).

### Isolation des credentials et partage

- Les credentials d'une connexion ne sont **jamais exposés aux viewers**, ni côté client ni dans l'UI. Seul l'owner peut voir/modifier la connection string. Les API routes vérifient explicitement le rôle (`owner` vs `viewer`) avant tout retour de données sensibles.
- Lors d'un partage, **seul l'ID de la connexion** est associé au viewer. Les credentials restent chiffrés et déchiffrés uniquement côté serveur, en mémoire, le temps de proxy la requête PostgreSQL.
- L'autorisation d'accès à une connexion (owner ou via `ConnectionAccess`) est vérifiée **à chaque requête API**, jamais en se fiant à un état client.

### Invitations et tokens

- Les tokens d'invitation (rejoindre l'instance) et les tokens de session sont stockés **hashés** en BDD (jamais en clair).
- Les tokens d'invitation sont **single-use** (consommés à la première utilisation) et **expirent** après un délai configurable (7 jours par défaut).
- Les invitations consommées ou expirées sont conservées en BDD pour audit, mais ne peuvent plus être réutilisées.

### Bonnes pratiques

- Les credentials ne sont **jamais loggés** (ni côté serveur, ni dans les outils de monitoring).
- Les credentials déchiffrés ne sont gardés **en mémoire que le temps de la requête**.
- Rate limiting sur les endpoints d'API sensibles (login, test de connexion, consommation de token d'invitation).

---

## 7. UX / Design

### Principes

- **Clarté** : l'interface doit rendre les données lisibles sans effort. Typographie soignée, espacement généreux, contrastes suffisants.
- **Rapidité** : les interactions doivent être instantanées (optimistic updates, cache du schéma, pagination serveur).
- **Navigation fluide** : passer d'une table à une autre, suivre une relation, revenir en arrière — tout doit être naturel.

### Navigation

- **Sidebar gauche** : liste des tables (avec recherche), info sur la connexion active.
- **Zone principale** : data grid ou vue détail.
- **Header** : breadcrumb de navigation, switch de connexion, bouton settings.

### Raccourcis clavier

| Raccourci | Action |
|---|---|
| `Cmd/Ctrl + K` | Ouvrir la command palette (recherche de tables, actions) |
| `Cmd/Ctrl + F` | Focus sur la recherche dans la table courante |
| `Escape` | Fermer un panneau / annuler l'édition |
| `↑ / ↓` | Naviguer entre les records |
| `Enter` | Ouvrir la vue détail du record sélectionné |

### Responsive

- Conçu pour desktop en priorité (usage principal).
- Layout adaptable tablette (sidebar collapsible).
- Mobile : vue lecture seule simplifiée (pas d'édition inline).

---

## 8. Contraintes et limites connues

| Contrainte | Détail |
|---|---|
| PostgreSQL uniquement | Pas de support MySQL, SQLite ou autres pour le MVP. |
| Pas de requêtes SQL custom | L'utilisateur ne peut pas écrire de SQL brut dans l'interface (scope volontairement réduit). |
| Pas de migrations | L'app ne gère pas les modifications de schéma (CREATE TABLE, ALTER, DROP). C'est un browser, pas un outil d'administration. |
| Pas de collaboration temps réel | Pas de curseurs partagés ni d'édition simultanée. Un user = une session. Le partage de connexions permet plusieurs lecteurs concurrents, mais sans synchro live de l'UI. |
| Pas de SMTP requis | Les invitations passent par lien manuel transmis hors-app. Aucun serveur mail à configurer. Conséquence : pas de "mot de passe oublié" par email automatique dans le MVP — l'admin doit reset manuellement le mot de passe d'un user. |
| Lumos remote ↔ BDD locale d'un user | Si l'instance Lumos est déployée sur un VPS, elle ne peut pas atteindre une BDD qui tourne uniquement sur le laptop d'un user (pas joignable depuis internet). Solutions : tunnel (Tailscale, Cloudflare Tunnel) ou déploiement local de Lumos. Voir §3 Architecture. |
| Limites runtime | Les requêtes lourdes sur de très grosses tables peuvent dépasser le timeout par défaut du runtime Next.js. Côté self-hosted Docker, ce timeout est configurable. À surveiller pour les exports de larges volumes. |

---

## 9. Métriques de succès

### Critères techniques

- [ ] **Setup en moins de 5 minutes** : `git clone` + `docker compose up` + premier compte créé en moins de 5 minutes sur une machine sans pré-requis (autre que Docker installé).
- [ ] **Première connexion en moins de 2 minutes** après inscription : du dashboard vide à la première table affichée.
- [ ] **Introspection robuste** : fonctionne correctement sur des schémas réels avec 10+ tables, relations complexes, types variés (jsonb, arrays, enums).
- [ ] **Édition inline fiable** : aucune corruption de données après usage régulier. Validation côté serveur des contraintes PostgreSQL.
- [ ] **Diagramme lisible** : utile pour comprendre la structure d'une base inconnue en quelques minutes.
- [ ] **Partage sécure** : un viewer ne peut techniquement pas obtenir les credentials d'une connexion partagée, ni via l'UI, ni via l'API.

### Critères projet open-source

- [ ] **README clair** : présentation, captures d'écran, instructions de setup, exemples de configuration.
- [ ] **Variables d'env documentées** dans un `.env.example` commenté.
- [ ] **`docker-compose.yml` fonctionnel** sans config supplémentaire pour le cas par défaut.
- [ ] **CHANGELOG** maintenu à chaque release tagguée.
- [ ] **Code propre, typé** : zéro `any` non justifié, ESLint/Prettier configurés, CI qui vérifie type-check + lint + tests à chaque PR.
- [ ] **Première contribution externe** : un PR ou une issue de qualité ouverte par quelqu'un qui n'est pas l'autrice.

---

## 10. Roadmap résumée

| Phase | Contenu | Priorité |
|---|---|---|
| **Phase 1** | Auth (Better Auth, OAuth GitHub/GitLab inclus) + invitations admin + dashboard connexions + chiffrement | 🔴 Critique |
| **Phase 2** | Introspection du schéma + sidebar | 🔴 Critique |
| **Phase 3** | Data grid + pagination + tri + vue détail | 🔴 Critique |
| **Phase 4** | Partage de connexions (rôle viewer) + isolation par user | 🔴 Critique |
| **Phase 5** | Filtrage type-aware + recherche | 🟠 Haute |
| **Phase 6** | Navigation relationnelle (FK) + breadcrumb | 🟠 Haute |
| **Phase 7** | Édition inline | 🟡 Moyenne |
| **Phase 8** | Diagramme de schéma (React Flow) | 🟡 Moyenne |
| **Phase 9** | Export CSV / JSON | 🟢 Basse |
| **Phase 10** | Personnalisation des layouts | 🟢 Basse |

---

## 11. Déploiement et contribution

### Déploiement self-hosted (cas par défaut)

Lumos est conçu pour être déployé en une commande via Docker Compose. Le repo fournit un `docker-compose.yml` prêt à l'emploi qui démarre :

- L'app Next.js (Lumos)
- La BDD applicative PostgreSQL (séparée des BDD que les users vont explorer)
- Optionnel : un reverse proxy (Caddy) pour le HTTPS automatique en prod

```bash
git clone https://github.com/<owner>/lumos.git
cd lumos
cp .env.example .env
# éditer .env (au minimum, générer ENCRYPTION_KEY et changer les mots de passe)
docker compose up -d
# ouvrir http://localhost:3000 → créer le premier compte → devient admin
```

### Variables d'environnement

| Variable | Requis | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | URL de la BDD applicative (préfilé pour Docker Compose) |
| `ENCRYPTION_KEY` | ✅ | Clé AES-256 pour chiffrer les connection strings (32 bytes en base64). À générer avec `openssl rand -base64 32`. |
| `BETTER_AUTH_SECRET` | ✅ | Secret pour signer les sessions Better Auth |
| `BETTER_AUTH_URL` | ✅ | URL publique de l'instance (ex: `https://lumos.mondomaine.fr`) |
| `REGISTRATION_MODE` | optionnel | `open` / `invite-only` / `closed` (défaut : `invite-only`) |
| `INVITATION_TTL_DAYS` | optionnel | Durée de vie d'un token d'invitation (défaut : 7) |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | optionnel | Active OAuth GitHub si fournis |
| `GITLAB_CLIENT_ID`, `GITLAB_CLIENT_SECRET` | optionnel | Active OAuth GitLab si fournis |

Toutes les variables sont documentées dans `.env.example` à la racine du repo.

### Licence

**MIT License**. Lumos est librement utilisable, modifiable, redistribuable, y compris à des fins commerciales. La seule obligation est de conserver la mention de copyright et de licence.

### Contribution

- **Issues** : pour signaler un bug ou proposer une feature, ouvrir une issue sur le repo GitHub. Templates fournis (bug report, feature request).
- **Pull Requests** : forker, créer une branche, ouvrir une PR. La CI vérifie type-check, lint, et tests. Code review obligatoire avant merge.
- **CONTRIBUTING.md** : guide à la racine du repo expliquant le setup local de dev, la convention de commits, le process de PR.
- **Code of Conduct** : Contributor Covenant standard.

### Releases

- Tags Git suivant **SemVer** (`v0.1.0`, `v0.2.0`, etc.).
- Images Docker publiées sur GHCR à chaque tag : `ghcr.io/<owner>/lumos:vX.Y.Z` et `ghcr.io/<owner>/lumos:latest`.
- CHANGELOG.md mis à jour à chaque release.

---

## 12. Nom du projet

**Nom** : **Lumos**
**Domaine** éventuel : lumos-maxima.dev
**Référence** : sort d'illumination dans l'univers Harry Potter — "éclairer" le contenu d'une base de données.

### Notes de branding

- Toggle thème clair/sombre : "Lumos" (clair) / "Nox" (sombre)
- Logo : typographie épurée avec un élément lumineux (étoile, étincelle, point lumineux)
- Ton : élégant, minimaliste, un brin magique
