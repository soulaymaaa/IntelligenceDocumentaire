# Prompt pour compléter le Rapport de Projet de Fin d'Études (PFE) — DocIntel

Ce document contient un prompt complet et structuré prêt à être copié-collé dans un assistant de génération ou d'édition de documents (comme ChatGPT, Claude ou un agent d'édition) pour enrichir et finaliser ton document Word de rapport PFE (`rapport-pfe.md`).

---

```markdown
Rôle : Rédacteur technique et expert en ingénierie logicielle.
Mission : Compléter et enrichir le document de rapport de PFE de la plateforme "DocIntel" en y intégrant les fonctionnalités réelles, les architectures de données (modèles MongoDB), les pipelines de traitement et les structures d'interface (UX/UI) qui existent dans la base de code mais qui sont absentes ou incomplètes dans le brouillon actuel.

Consignes de rédaction :
1. Conserver le ton académique, rigoureux et professionnel du rapport.
2. Utiliser des termes techniques précis (Mongoose, Next.js App Router, JWT, Similarité Cosinus, OCR Hybride, etc.).
3. Rédiger les ajouts en français (langue principale du rapport).
4. Insérer des descriptions détaillées des schémas de base de données (modèles de données) et des logiques de contrôleurs correspondantes.

Voici les sections spécifiques à modifier et à ajouter dans le document du rapport :

---

### 1. Chapitre 2 — Spécifications Fonctionnelles (Backlog Produit & Sprints)
Dans la section "2.3.1 Besoins fonctionnels", "2.6 Composition du backlog produit" et "2.7 Découpage des sprints", ajouter et détailler les besoins suivants :
- **Sous-système Planificateur (Planner)** : Gestion du calendrier de travail personnel, création de tâches documentaires avec des priorités (Basse, Moyenne, Haute), des plages de dates (`startDate` et `endDate`), rappels automatiques programmés (`reminderAt`) avec exécution en arrière-plan (cron job), et import de masse de tâches à partir de fichiers Excel/CSV.
- **Organisation à double niveau (Dossiers projets & Classeurs)** : Possibilité pour l'utilisateur de regrouper ses documents de deux façons complémentaires :
  - **Classeurs (Folders)** : Chemins d'accès logiques classiques pour classer les documents.
  - **Dossiers projets (Dossiers)** : Espaces projets dédiés avec des identités visuelles (couleurs personnalisées) pour agréger et analyser les documents par thématique.
- **Console d'Administration (Admin Portal)** : Portail privé permettant aux administrateurs de gérer les comptes utilisateurs (recherche par mot-clé, activation/désactivation de la vérification par email, élévation de rôles entre 'user' et 'admin', suppression définitive de comptes avec cascade).
- **Suppression de compte par l'utilisateur (RGPD / Droit à l'oubli)** : Option autonome dans les paramètres permettant à chaque utilisateur de supprimer définitivement son propre compte, déclenchant un nettoyage complet et en cascade de ses données.
- **Accès Mobile Express (QR Code)** : Génération dynamique de QR code pour chaque page de document ou recherche sémantique afin de basculer instantanément de l'interface PC à un navigateur mobile.

---

### 2. Chapitre 3 & 4 — Spécifications Techniques & Modèles de Données (MongoDB)
Ajouter une sous-section détaillant le modèle de données physique (MongoDB/Mongoose). Rédiger les structures de schémas pour chacun des modèles suivants :

#### A. Modèle Utilisateur (User)
- **Rôle** : Gère l'authentification et les droits d'accès.
- **Champs clés** :
  - `name` (String, obligatoire, 2-100 caractères)
  - `email` (String, unique, minuscule)
  - `passwordHash` (String, masqué par défaut dans les requêtes)
  - `passwordHistory` (Array de String, historique des hashs pour éviter la réutilisation)
  - `role` (Enum : 'user', 'admin')
  - `isVerified` (Boolean, statut de vérification)
  - `verificationCode` / `verificationCodeExpiresAt` (OTP temporaire de validation)
  - `resetPasswordCode` / `resetPasswordCodeExpiresAt` (OTP pour réinitialisation)

#### B. Modèle Document (Document)
- **Rôle** : Métadonnées du fichier et caches des analyses IA.
- **Champs clés** :
  - `ownerId` (ObjectId, référence User)
  - `folderId` (ObjectId, référence DocumentFolder, optionnel)
  - `dossierId` (ObjectId, référence Dossier, optionnel)
  - `filename` (String, nom physique unique sur le serveur)
  - `originalName` (String, nom d'origine)
  - `mimeType` (String)
  - `size` (Number, taille en octets)
  - `storagePath` (String, chemin relatif de stockage)
  - `status` (Enum : 'pending', 'processing_ocr', 'indexed', 'error', 'archived')
  - `extractedText` (String, cache textuel complet)
  - `pageCount` (Number, nombre total de pages)
  - `summaryShort` / `summaryDetailed` / `summaryBullets` (Résumés générés par l'IA)
  - `mindMap` (Schema.Types.Mixed, structure hiérarchique JSON générée par l'IA pour la carte mentale)
  - `translations` (Array de { language: String, text: String }, cache des traductions multilingues)
  - `ocrPdfPath` (String, chemin vers le fichier PDF généré par l'OCR si l'original était une image)

#### C. Modèle Segment Documentaire (DocumentChunk)
- **Rôle** : Unités textuelles fragmentées pour la recherche vectorielle (Embeddings).
- **Champs clés** :
  - `documentId` (ObjectId, référence Document)
  - `ownerId` (ObjectId, référence User)
  - `chunkIndex` (Number)
  - `pageNumber` (Number)
  - `text` (String, portion de texte extrait)
  - `embedding` (Array de Number, vecteur dense de 384 dimensions)
  - `tokenCount` (Number)
- **Index** : Index composé `{ documentId: 1, chunkIndex: 1 }` et index simple `{ ownerId: 1 }` pour la suppression rapide.

#### D. Modèle Tâche (PlannerTask)
- **Rôle** : Gère les entrées du planificateur de tâches.
- **Champs clés** :
  - `userId` (ObjectId, référence User)
  - `text` (String, libellé de la tâche)
  - `completed` (Boolean)
  - `startDate` / `endDate` (String au format YYYY-MM-DD)
  - `priority` (Enum : 'low', 'medium', 'high')
  - `category` (String, tag facultatif)
  - `source` (Enum : 'manual', 'excel', indique la provenance de la tâche)
  - `importBatchId` (String, identifiant du lot d'import Excel pour suppression groupée)
  - `reminderAt` (Date, planification optionnelle du rappel)
  - `reminderSent` (Boolean)

#### E. Modèle Journal d'Audit (AuditLog)
- **Rôle** : Assure la traçabilité des opérations de sécurité et d'accès aux documents.
- **Champs clés** :
  - `userId` (ObjectId, référence User, obligatoire)
  - `action` (String, ex: `USER_LOGIN`, `DOCUMENT_UPLOAD`, `RAG_QUERY`, `USER_DELETE_ACCOUNT`, `ADMIN_DELETE_USER`)
  - `resourceType` (String, ex: 'User', 'Document', 'Dossier')
  - `resourceId` (String, identifiant de la ressource concernée)
  - `ip` / `userAgent` (Métadonnées de connexion réseau, optionnel)
  - `details` (Schema.Types.Mixed, paramètres complémentaires anonymisés)

---

### 3. Chapitre 4 — Analyse & Fonctionnalités Avancées d'Intelligence Artificielle
Détailler la logique fonctionnelle et algorithmique des modules IA suivants :

1. **Pipeline OCR Hybride (Tesseract + PDF Native Extraction)** :
   - Expliquer comment le système détecte le format de fichier.
   - Si c'est un PDF textuel natif, il extrait directement les flux textuels via `pdf-parse` (gain de performance).
   - Si le PDF contient des images scannées ou si le fichier est une image (PNG, JPEG), il lance un OCR dynamique avec `Tesseract.js` avec optimisation automatique des contrastes (fallback intelligent).

2. **Moteur RAG (Retrieval-Augmented Generation) & Recherche Sémantique** :
   - Détailler la vectorisation de la requête utilisateur (génération d'embedding de dimension 384).
   - Expliquer le calcul de similarité cosinus effectué en base de données pour trier les passages les plus pertinents.
   - Présentation de la construction du Prompt Contextuel envoyé au LLM pour générer des réponses étayées, accompagnées de citations précises avec indicateurs de pertinence et niveau de confiance (high, medium, low).

3. **Visualisation Interactive de Tableaux et Graphiques (Spreadsheet Viewer & Charts)** :
   - Décrire comment la plateforme gère les formats Excel (`.xlsx`, `.xls`) et CSV.
   - L'application convertit ces fichiers en structures JSON tabulaires affichées dynamiquement sous forme de grilles de feuilles de calcul réactives (Spreadsheet Grid).
   - Le système extrait automatiquement les données numériques pour tracer des graphiques interactifs en temps réel (Barres, Courbes, Camemberts) afin de visualiser les données financières ou comptables des rapports financiers stockés.

4. **Génération de Cartes Mentales (Mind Maps)** :
   - L'IA produit une carte conceptuelle structurée (JSON structuré) reprenant l'architecture logique du document (titres, thèmes principaux, sous-idées, relations).
   - Le frontend utilise cette structure pour afficher un arbre heuristique interactif en 2D facilitant la navigation visuelle dans la thématique du document.

5. **Traduction Intelligente avec Cache Local** :
   - L'utilisateur peut traduire le contenu d'un document vers une autre langue (Anglais, Français, Arabe, Espagnol, Allemand, Italien).
   - Pour optimiser les appels d'API externes, le résultat traduit est mis en cache directement dans le tableau `translations` du modèle Document, évitant ainsi des coûts de génération inutiles lors des lectures successives.

---

### 4. Chapitre 3 & 4 — Architecture Logicielle, Sécurité et RGPD (Droit à l'oubli)
Ajouter des explications techniques sur la gestion de la sécurité :
1. **Droit à l'oubli (Cascading Account Deletion)** :
   - Expliquer la logique du contrôleur de suppression de compte (`deleteAccount`) :
     - Suppression de tous les fichiers physiques sur le disque (fichiers originaux et fichiers optimisés pour l'OCR).
     - Nettoyage des index vectoriels (`DocumentChunkModel`) rattachés à l'utilisateur.
     - Suppression des dossiers (`DocumentFolderModel`) et des espaces de projets (`DossierModel`).
     - Nettoyage du calendrier du planificateur (`PlannerTask`) et des fils de discussions RAG (`ConversationModel`).
     - Suppression finale du document `User` dans la collection.
     - Révocation du cookie de session `token` (vidage du jeton de sécurité JWT côté navigateur).
     - Enregistrement de l'action de suppression dans les logs d'audit généraux à des fins de conformité de sécurité.

2. **Modals en React Portals (Amélioration UI/UX)** :
   - Décrire comment le problème d'empilement (stacking context) de la fenêtre QR Code mobile a été résolu. Le composant `Modal` a été encapsulé dans un `createPortal` de React pour être monté directement au niveau de la racine `document.body`. Ceci élimine tout conflit de style CSS de type `fixed` ou de filtres d'effet de verre (glassmorphism) présents sur les barres d'outils parentes.

---

Veuillez réorganiser le rapport en intégrant ces compléments techniques et fonctionnels afin qu'il décrive fidèlement l'ensemble de l'application DocIntel.
```

---
**Note d'utilisation** : Copie l'intégralité du texte ci-dessus et utilise-le dans ton outil de complétion de rapport pour modifier le fichier de rapport Word original.
