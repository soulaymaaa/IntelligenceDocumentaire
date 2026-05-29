# DocIntel — Plateforme d'Intelligence Documentaire

## Description
DocIntel est une plateforme d'intelligence documentaire intégrant la reconnaissance optique de caractères (OCR), la recherche augmentée par génération (RAG), ainsi que des fonctionnalités d'analyse, de résumé, de traduction et de visualisation de cartes mentales. Elle repose sur un front **Next.js** moderne et un back **Node.js/Express** avec MongoDB.

## Fonctionnalités complètes
| Module | Fonctionnalité | Description |
|---|---|---|
| Authentification | Login / Logout, JWT, protection des routes, gestion des rôles (user, admin) | Authentification sécurisée avec rafraîchissement de token. |
| Gestion des utilisateurs | Liste, recherche, pagination, création / modification / suppression | Interface admin avec tableau interactif (TanStack Table). |
| Gestion des administrateurs | Attribution des droits, création / suppression d'administrateurs | Séparation des privilèges. |
| Documents | Upload PDF / image, visualisation, métadonnées, recherche plein texte | Stockage dans MongoDB GridFS ou S3 (configurable). |
| OCR | Extraction texte via Tesseract.js, support multi‑langues (fra, eng) | Transformation d'images en texte exploitable. |
| Vectorisation | Embeddings avec **all‑MiniLM‑L6‑v2** via LangChain | Indexation vectorielle dans MongoDB Atlas. |
| RAG | Recherche augmentée, génération de réponses contextuelles via OpenAI | Fusion recherche sémantique + LLM. |
| Résumé | Génération automatique de résumés de documents | Utilise OpenAI `gpt‑3.5‑turbo`.
| Traduction | Traduction multilingue (fr ↔ en) | OpenAI + prompt spécialisé. |
| Carte mentale | Visualisation des concepts extraits sous forme de mind‑map | D3‑force / react‑flow.
| Dashboard / KPI | Graphiques (Recharts) présentant métriques d'utilisation, performances OCR, nombre de documents, etc. |
| Planning / Scheduler | Rappels et tâches planifiées (node‑cron) pour nettoyage, notifications. |
| Sécurité | Helmet, cors, rate‑limit, validation des entrées. |
| QR‑Code | Génération d’un QR‑code pointant vers l’application déployée. |

## Stack technique
| Couche | Technologies |
|---|---|
| Frontend | **Next.js 14**, React 18, TypeScript, TailwindCSS, TanStack Table, Recharts, lucide‑react, SWR, axios |
| Backend | **Node.js 22**, Express 4, TypeScript, Mongoose 7, Tesseract.js, LangChain, OpenAI SDK, node‑cron |
| Base de données | MongoDB Atlas (cluster partagé), GridFS (stockage fichiers) |
| IA / NLP | Tesseract OCR, all‑MiniLM‑L6‑v2 (sentence‑transformers), OpenAI `gpt‑3.5‑turbo` |
| Déploiement | Front : Vercel, Back : Railway, Docker (optionnel) |

## Architecture
```mermaid
flowchart LR
    subgraph Frontend[Next.js Frontend]
        FE[UI] -->|API Calls| BE[Backend API]
    end
    subgraph Backend[Express API]
        BE -->|MongoDB Driver| DB[(MongoDB Atlas)]
        BE -->|OpenAI SDK| AI[OpenAI]
        BE -->|Tesseract| OCR[OCR Service]
        BE -->|LangChain| RAG[Vector Search / RAG]
    end
    DB -->|Documents| Storage[GridFS / S3]
    style Frontend fill:#e0f7ff,stroke:#0099cc,stroke-width:2px;
    style Backend fill:#fff0e0,stroke:#ff6600,stroke-width:2px;
```

## Installation locale
```bash
# Clone le repository
git clone https://github.com/<username>/docintel.git
cd docintel

# Installe les dépendances
npm ci   # front
cd backend && npm ci && cd ..

# Crée un fichier .env (exemple fourni) et ajuste les valeurs
cp .env.example .env

# Lance les services en mode développement
# Backend
cd backend && npm run dev &
# Frontend
cd ../frontend && npm run dev
```

## Variables d'environnement
| Variable | Description | Exemple |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL du backend reachable depuis le front | `http://localhost:3002` |
| `MONGODB_URI` | Connexion à MongoDB Atlas | `mongodb+srv://user:pwd@cluster0.mongodb.net/docintel` |
| `JWT_SECRET` | Clé secrète pour les tokens JWT (≥32 chars) | `supersecretkey...` |
| `OPENAI_API_KEY` | Clé d'API OpenAI | `sk-xxxx` |
| `GROQ_API_KEY` | (optionnel) clé Groq pour recherche vectorielle | `gsk_...` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Config SMTP pour les emails | `smtp.gmail.com` … |
| `PORT` | Port du serveur backend (défaut 3002) | `3002` |

## Déploiement
### Frontend – Vercel
1. Crée un nouveau projet sur **vercel.com** → **Import Git Repository** → sélectionne ce dépôt.
2. Laisse Vercel détecter **Next.js** automatiquement.
3. Dans **Settings → Environment Variables**, ajoute les variables ci‑dessus (préfixées `NEXT_PUBLIC_`).
4. Déploie – Vercel exécutera `npm run build` puis `npm start`.

### Backend – Railway
1. Crée un compte sur **railway.app** et démarre un nouveau projet.
2. Choisis **Deploy from GitHub** → lie le même dépôt et sélectionne le dossier **backend**.
3. Railway détectera le `package.json` et exécutera `npm install` + `npm run start`.
4. Ajoute les variables d’environnement listées ci‑dessus (sans le préfixe `NEXT_PUBLIC_`).
5. Note l’URL du service (ex. `https://docintel-backend.up.railway.app`).

## Lien de démo live
> 🔗 **[À remplacer après déploiement]**

---
*Ce README constitue la source de vérité du projet et doit être maintenu à jour.*
