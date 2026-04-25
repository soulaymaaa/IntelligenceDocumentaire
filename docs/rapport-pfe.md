# Rapport de PFE - Intelligence Documentaire

> Brouillon de rapport basé sur la structure du document de référence, adapté au projet **DocIntel**.
>
> Les champs marqués `[...]` sont à personnaliser avec tes informations réelles
> `nom de l'encadrant`, `nom de l'entreprise`, `période du stage`, `nom de l'établissement`, etc.

## Page de garde

**République Tunisienne**  
**Ministère de l'Enseignement Supérieur et de la Recherche Scientifique**  
**[Nom de l'établissement]**

**Rapport de Projet de Fin d'Études**

# DocIntel
## Plateforme d'intelligence documentaire

Réalisé par : **[Ton nom]**  
Encadré par : **[Nom encadrant académique]**  
Encadrant professionnel : **[Nom encadrant entreprise]**  
Organisme d'accueil : **[Nom de l'entreprise]**  
Année universitaire : **2025 / 2026**

---

## Dédicaces

À mes chers parents, pour leur soutien constant, leur patience et leurs encouragements tout au long de mon parcours.

À ma famille et à mes proches, pour leur confiance et leur présence à chaque étape de ce projet.

À mes amis et collègues, pour leur aide, leurs échanges et les moments partagés pendant cette période de travail.

---

## Remerciements

Je tiens à exprimer ma profonde gratitude à toutes les personnes qui ont contribué à la réalisation de ce projet.

Je remercie d'abord mon encadrant pédagogique, **[Nom]**, pour sa disponibilité, ses conseils et son accompagnement durant la rédaction et le développement de ce projet.

Je remercie également mon encadrant professionnel, **[Nom]**, pour sa confiance, son suivi régulier et ses remarques constructives qui ont fortement contribué à l'amélioration de la solution proposée.

Enfin, je remercie l'ensemble des enseignants, collègues et membres de ma famille qui m'ont soutenu moralement et académiquement tout au long de ce travail.

---

## Résumé

La gestion des documents numériques est devenue un enjeu majeur dans les organisations qui manipulent quotidiennement des fichiers PDF, des images scannées et des archives textuelles. La recherche manuelle dans de grands volumes de documents reste lente, imprécise et coûteuse en temps.

Dans ce contexte, **DocIntel** est une plateforme web conçue pour centraliser les documents, extraire automatiquement leur contenu grâce à l'OCR, générer des index vectoriels, effectuer une recherche sémantique et répondre à des questions en s'appuyant sur les sources extraites des documents.

La solution repose sur une architecture full-stack moderne avec un frontend **Next.js**, un backend **Express.js**, une base de données **MongoDB**, ainsi que des services dédiés à l'OCR, aux embeddings et à l'assistance IA. Ce rapport présente le contexte du projet, l'analyse des besoins, l'architecture adoptée et les principales réalisations fonctionnelles.

**Mots-clés**: intelligence documentaire, OCR, recherche sémantique, RAG, Next.js, Express, MongoDB.

---

## Abstract

Managing digital documents has become a critical need for organizations dealing with large volumes of PDF files, scanned images, and text archives. Manual search within such repositories is often slow, inaccurate, and time-consuming.

In this context, **DocIntel** is a web platform designed to centralize documents, automatically extract their content using OCR, generate vector indexes, perform semantic search, and answer questions based on document-derived sources.

The solution relies on a modern full-stack architecture built with **Next.js**, **Express.js**, **MongoDB**, and dedicated services for OCR, embeddings, and AI assistance. This report describes the project context, requirements analysis, chosen architecture, and main implemented features.

---

## Table des matières

1. Introduction générale
2. Contexte général et étude préalable
3. Analyse et spécification des besoins
4. Release 1 - Socle fonctionnel
5. Release 2 - Intelligence documentaire
6. Conclusion générale
7. Annexes

---

# Introduction générale

Dans les organisations modernes, la quantité croissante de documents rend la consultation manuelle de l'information de plus en plus difficile. Les utilisateurs doivent souvent parcourir des dizaines de PDF ou d'images scannées pour retrouver une donnée précise, ce qui entraîne une perte de temps et une baisse de productivité.

Le projet **DocIntel** répond à cette problématique en proposant une plateforme documentaire intelligente permettant de déposer des fichiers, d'extraire automatiquement leur texte, de les indexer et de les interroger via une recherche sémantique et un assistant IA fondé sur les sources.

L'objectif principal de ce travail est de concevoir et de développer une solution web qui:

- centralise les documents dans un espace de travail unique;
- automatise l'extraction du texte à partir des fichiers PDF et images;
- améliore la recherche d'information par des mécanismes sémantiques;
- fournit des réponses argumentées grâce à une approche RAG;
- sécurise l'accès aux données par authentification et isolement par utilisateur.

Ce rapport est structuré de la manière suivante:

- le premier chapitre présente le contexte général, la problématique et la solution proposée;
- le deuxième chapitre expose les besoins fonctionnels et non fonctionnels, ainsi que le modèle architectural;
- le troisième chapitre décrit la première release centrée sur le socle fonctionnel;
- le quatrième chapitre détaille la seconde release consacrée à l'intelligence documentaire;
- enfin, une conclusion générale synthétise les apports du projet.

# Chapitre 1 - Contexte général et étude préalable

## 1.1 Introduction

Ce chapitre situe le projet dans son contexte. Il présente l'environnement général du travail, les limites des solutions classiques de gestion documentaire et l'approche retenue pour construire DocIntel.

## 1.2 Présentation de l'organisme d'accueil

> À compléter avec le nom de l'entreprise, son activité et son rôle dans le projet.

L'organisme d'accueil est une structure spécialisée dans le développement de solutions numériques. Le projet DocIntel s'inscrit dans une logique de transformation des processus documentaires par l'apport de l'automatisation, de la recherche intelligente et de l'assistance IA.

## 1.3 Présentation du projet

DocIntel est une plateforme web de gestion et d'intelligence documentaire. Elle permet de charger des documents, d'extraire leur contenu, d'indexer le texte obtenu, puis d'interroger les documents via une recherche sémantique ou un assistant conversationnel.

### 1.3.1 Problématique

Les solutions traditionnelles de gestion documentaire reposent souvent sur des recherches textuelles basiques. Elles sont peu efficaces lorsque les documents sont scannés, mal structurés ou volumineux. De plus, la consultation manuelle reste chronophage et ne permet pas toujours de retrouver rapidement l'information utile.

La problématique traitée dans ce projet peut être formulée ainsi:

> Comment concevoir une plateforme documentaire capable d'extraire automatiquement le contenu de fichiers hétérogènes, d'en améliorer l'exploration et de fournir des réponses fiables à partir de leurs sources?

### 1.3.2 Étude de l'existant

Les solutions existantes se répartissent généralement en trois catégories:

- les stockages de fichiers simples, qui se limitent à l'archivage sans intelligence de recherche;
- les outils d'OCR isolés, qui extraient le texte sans proposer de suivi, d'indexation ou de recherche avancée;
- les solutions de recherche documentaire génériques, qui ne fournissent pas de réponses contextualisées ni de citations.

Ces limites motivent la mise en place d'une plateforme intégrée comme DocIntel.

### 1.3.3 Solution proposée

La solution proposée repose sur:

- un espace sécurisé d'authentification;
- un module d'envoi et de gestion des documents;
- un pipeline OCR adapté aux PDF et aux images;
- un service d'embeddings pour créer des vecteurs de recherche;
- une recherche sémantique fondée sur la similarité cosinus;
- un module RAG pour générer des réponses sourcées;
- un tableau de bord de suivi des documents et des usages IA.

## 1.4 Méthodologie de travail

Le projet est organisé de manière incrémentale selon une approche agile. Chaque itération apporte un ensemble cohérent de fonctionnalités testables.

Dans ce cadre, la méthode retenue peut être présentée comme une adaptation de **SCRUM**:

- un backlog produit regroupe les fonctionnalités prioritaires;
- les releases sont découpées en sprints;
- chaque sprint livre un sous-ensemble fonctionnel;
- les retours obtenus permettent d'ajuster les priorités de la suite du projet.

## 1.5 Conclusion

Ce chapitre a permis de présenter le contexte du projet, la problématique traitée et la solution globale retenue. Le chapitre suivant détaille les besoins et l'architecture du système.

# Chapitre 2 - Analyse et spécification des besoins

## 2.1 Introduction

L'objectif de ce chapitre est d'identifier les acteurs, de formaliser les besoins et de présenter le modèle architectural qui guide l'implémentation de DocIntel.

## 2.2 Identification des acteurs

Les principaux acteurs du système sont:

- **Utilisateur authentifié**: charge les documents, consulte ses fichiers, effectue des recherches et pose des questions;
- **Administrateur**: peut superviser les documents, les journaux d'audit et les indicateurs de fonctionnement;
- **Services techniques**: OCR, embeddings, moteur IA, base de données, utilisés par la plateforme en arrière-plan.

## 2.3 Identification des besoins

### 2.3.1 Besoins fonctionnels

Les besoins fonctionnels du système sont:

1. créer un compte et se connecter de manière sécurisée;
2. vérifier l'adresse email lors de l'inscription;
3. envoyer un document PDF ou image;
4. extraire automatiquement le texte du document;
5. indexer le contenu sous forme de chunks vectoriels;
6. rechercher les passages pertinents dans les documents;
7. générer des résumés assistés par IA;
8. poser des questions sur un document ou sur l'ensemble des documents;
9. archiver, supprimer ou reindexer un document;
10. consulter un tableau de bord de suivi.

### 2.3.2 Besoins non fonctionnels

Les besoins non fonctionnels sont:

- sécurité: authentification, cookies httpOnly, validation des entrées;
- performance: indexation par lots et recherche optimisée;
- traçabilité: journalisation des actions critiques;
- modularité: séparation frontend/backend/services;
- maintenabilité: code TypeScript structuré en modules;
- évolutivité: architecture pouvant accueillir un moteur vectoriel plus robuste à terme.

## 2.4 Diagrammes de cas d'utilisation globale

Le diagramme de cas d'utilisation global présente les interactions entre l'utilisateur et la plateforme: authentification, dépôt de fichiers, recherche, résumé, questions IA et gestion documentaire.

> Les diagrammes Mermaid correspondants sont regroupés dans `[docs/pfe-diagrams.md](docs/pfe-diagrams.md)`.

## 2.5 Planification du travail

Le projet a été organisé en deux releases successives, chacune regroupant plusieurs sprints:

- **Release 1**: mise en place du socle applicatif, de l'authentification et de la gestion documentaire;
- **Release 2**: ajout de l'intelligence documentaire, de la recherche sémantique et de l'assistance IA.

## 2.6 Composition du backlog produit

| Priorité | Fonctionnalité | Valeur métier |
|---|---|---|
| Haute | Authentification | Accès sécurisé à la plateforme |
| Haute | Upload de documents | Alimentation du référentiel |
| Haute | OCR et extraction de texte | Rendre les fichiers exploitables |
| Haute | Indexation vectorielle | Améliorer la recherche |
| Haute | Recherche sémantique | Retrouver les informations pertinentes |
| Moyenne | Résumés IA | Accélérer la lecture |
| Moyenne | RAG conversationnel | Répondre aux questions des utilisateurs |
| Moyenne | Tableau de bord | Suivre l'activité et l'état des documents |
| Moyenne | Archivage / suppression | Gérer le cycle de vie documentaire |

## 2.7 Découpage des sprints

| Sprint | Objectif | Livrables |
|---|---|---|
| Sprint 1 | Initialisation du socle technique | Architecture frontend/backend, configuration, navigation de base |
| Sprint 2 | Authentification et sécurité | Inscription, connexion, vérification email, reset password |
| Sprint 3 | Gestion des documents | Upload, liste, détail, archivage, suppression |
| Sprint 4 | OCR et extraction de contenu | Traitement PDF/image, extraction native, fallback Tesseract |
| Sprint 5 | Indexation et recherche sémantique | Chunking, embeddings, similarité cosinus, dashboard enrichi |
| Sprint 6 | Assistant IA et finalisation | RAG, résumés, citations de sources, ajustements UI/UX |

## 2.8 Le modèle architectural

L'application suit une architecture en couches:

- **Frontend**: interface utilisateur sous Next.js App Router;
- **Backend**: API REST sous Express.js;
- **Données**: MongoDB pour les utilisateurs, documents, chunks et journaux;
- **Services IA**: OCR, embeddings, génération de réponses et résumés.

Le schéma global est présenté dans le diagramme d'architecture fourni dans le fichier de diagrammes.

## 2.9 Environnement de travail

### 2.9.1 Environnement hardware

- poste de développement sous Windows;
- ressources de calcul locales pour le développement;
- serveur MongoDB local ou distant selon la configuration.

### 2.9.2 Environnement logiciel

| Catégorie | Outils |
|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| Backend | Express.js, TypeScript, Mongoose |
| IA / NLP | Tesseract.js, pdf-parse, embeddings, LLM |
| Base de données | MongoDB |
| Outils | Git, Docker, VS Code |

## 2.10 Conclusion

L'analyse des besoins a permis de définir les fonctionnalités clés et de structurer le travail en releases. Le chapitre suivant présente le socle fonctionnel de la plateforme.

# Chapitre 3 - Release 1 : Socle fonctionnel

## 3.1 Introduction

Cette première release met en place les fonctionnalités indispensables au fonctionnement de la plateforme: sécurité, navigation, tableau de bord et gestion initiale des documents.

## 3.2 Sprint 1 : Initialisation du socle technique

Ce sprint a servi à poser les fondations du projet:

- structuration du frontend et du backend;
- configuration de l'environnement de développement;
- mise en place du layout principal;
- intégration des providers partagés;
- préparation de la navigation et du thème visuel.

### Réalisation

Le projet a été initialisé sous forme d'une application web full-stack séparant clairement l'interface utilisateur et l'API métier. Cette étape a permis d'assurer une base stable pour les sprints suivants.

## 3.3 Sprint 2 : Authentification et sécurité

Ce sprint couvre:

- l'inscription utilisateur;
- la connexion sécurisée;
- la vérification de l'email;
- la réinitialisation du mot de passe;
- la gestion des sessions et des jetons.

### Réalisation

Le backend expose les routes d'authentification dans `backend/src/modules/auth/auth.routes.ts`. Les contrôleurs valident les entrées avec Zod, puis délèguent la logique métier au service d'authentification. Les mots de passe sont hashés avec bcrypt et l'accès est protégé via JWT.

## 3.4 Sprint 3 : Gestion documentaire

Ce sprint met en œuvre:

- l'envoi de fichiers PDF et images;
- la liste des documents;
- la consultation du détail d'un document;
- l'archivage et la suppression;
- le tableau de bord avec les métriques principales.

### Réalisation

Le module document gère le cycle de vie du document: création de l'entrée, stockage local, statut, archivage et suppression des chunks associés.

## 3.5 Diagrammes de cas d'utilisation

Les cas d'utilisation de cette release couvrent l'accès à la plateforme et l'administration documentaire de base.

## 3.6 Diagrammes de séquence

Le diagramme de séquence du sprint d'authentification illustre:

- la demande d'inscription;
- l'envoi du code de vérification;
- la validation du code;
- l'émission du jeton de session.

## 3.7 Conclusion

La première release a permis de construire un socle stable et sécurisé sur lequel reposent les fonctionnalités intelligentes de la seconde release.

# Chapitre 4 - Release 2 : Intelligence documentaire

## 4.1 Introduction

Cette deuxième release transforme DocIntel en plateforme documentaire intelligente. Elle ajoute l'extraction automatique de texte, la vectorisation, la recherche sémantique et les réponses assistées par IA.

## 4.2 Sprint 4 : OCR et extraction de contenu

Ce sprint comprend:

- l'extraction de texte à partir des PDF natifs;
- le recours à Tesseract pour les fichiers scannés ou images;
- le découpage du texte en chunks;
- la génération d'embeddings;
- l'enregistrement des vecteurs dans MongoDB.

### Réalisation

Le service OCR détecte si le fichier est un PDF ou une image. Pour les PDF, il tente d'abord une extraction native via `pdf-parse`, puis bascule vers Tesseract si le texte extrait est insuffisant. Ensuite, le service d'embeddings découpe le texte en blocs, génère les vecteurs et les stocke pour la recherche.

## 4.3 Sprint 5 : Indexation et recherche sémantique

Ce sprint met en place:

- le découpage des textes en chunks;
- la génération des embeddings;
- le stockage vectoriel dans MongoDB;
- la recherche par similarité cosinus;
- la préparation du contexte pour les requêtes IA.

### Réalisation

Le service d'embeddings transforme le texte extrait en représentations vectorielles exploitables pour la recherche. Le service de recherche sémantique récupère ensuite les passages les plus proches de la question de l'utilisateur.

## 4.4 Sprint 6 : Assistant IA et finalisation

Ce sprint met en place:

- la recherche vectorielle par similarité cosinus;
- la recherche ciblée par document;
- l'interface de recherche sémantique;
- les conversations persistantes;
- les réponses RAG sourcées;
- la génération de résumés.

### Réalisation

Le service RAG récupère les chunks les plus pertinents en fonction de la question posée, construit un contexte, puis interroge un modèle de langage. La réponse générée est accompagnée des sources utilisées pour améliorer la confiance et la traçabilité.

## 4.5 Diagrammes de cas d'utilisation

Cette release couvre principalement:

- la recherche dans les documents;
- le résumé d'un document;
- la conversation globale avec sources;
- l'affichage des extraits pertinents.

## 4.6 Diagrammes de séquences

Les diagrammes de séquence montrent:

- l'envoi d'une question;
- la création de l'embedding requête;
- la récupération des chunks;
- la génération de la réponse;
- l'affichage des sources.

## 4.7 Réalisation de la release

Les interfaces frontend correspondantes se trouvent dans:

- `frontend/src/app/search/page.tsx`
- `frontend/src/app/documents/[id]/page.tsx`
- `frontend/src/components/ai/ConversationPanel.tsx`

## 4.8 Conclusion

La seconde release apporte la valeur principale de DocIntel: la transformation de documents bruts en connaissance exploitable.

# Conclusion générale

Ce projet a permis de concevoir et de développer une plateforme documentaire intelligente répondant à un besoin réel de centralisation, d'extraction et d'exploitation de documents hétérogènes.

DocIntel combine plusieurs briques techniques complémentaires:

- un frontend ergonomique avec Next.js;
- une API modulaire avec Express.js;
- une base de données MongoDB;
- un pipeline OCR et d'indexation;
- une recherche sémantique;
- un assistant IA fondé sur les sources.

Au-delà de la réalisation technique, ce projet m'a permis de consolider mes compétences en architecture logicielle, en développement full-stack, en traitement documentaire et en intégration d'outils d'intelligence artificielle.

## Perspectives d'amélioration

- adoption d'un moteur vectoriel natif pour les gros volumes;
- traitement asynchrone robuste avec une vraie file de jobs;
- stockage cloud des fichiers;
- notifications temps réel de progression OCR;
- partage et collaboration entre utilisateurs;
- export des données utilisateur.

---

## Annexes suggérées

- Figure 1 : architecture globale de DocIntel
- Figure 2 : cas d'utilisation global
- Figure 3 : pipeline d'upload, OCR et indexation
- Figure 4 : séquence de recherche sémantique et RAG
- Figure 5 : modèle de données simplifié
