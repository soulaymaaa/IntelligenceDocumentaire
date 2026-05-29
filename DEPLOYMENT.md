# DEPLOYMENT.md

## Objectif
Ce document décrit, étape par étape, le déploiement de **DocIntel** : le front‑end sur **Vercel** et le back‑end sur **Railway**.

---
### 1️⃣ Frontend – Vercel (Next.js)

1. **Créer le projet Vercel**
   - Se rendre sur <https://vercel.com> et se connecter avec GitHub.
   - Cliquer sur **New Project → Import Git Repository**.
   - Sélectionner le dépôt `docintel` (ou le fork correspondant).
   - Vercel détecte automatiquement le framework **Next.js**.
2. **Configurer les variables d’environnement**
   - Dans le tableau de bord du projet → **Settings → Environment Variables**.
   - Ajouter les variables suivantes (exemple) :
     | Variable | Valeur (exemple) |
     |---|---|
     | `NEXT_PUBLIC_API_URL` | `https://docintel-backend.up.railway.app` |
     | `NEXT_PUBLIC_GROQ_API_KEY` | `gsk_...` |
     | `NEXT_PUBLIC_OPENAI_API_KEY` | `sk-...` |
   - Cochez **Preview** et **Production**.
3. **Déploiement**
   - Vercel lance `npm ci && npm run build` puis `npm start`.
   - Après quelques minutes, l’URL live apparaît (ex. `https://docintel-frontend.vercel.app`).
4. **Vérifier**
   - Ouvrir l’URL et s’assurer que le login fonctionne et que les appels API aboutissent à l’URL du backend.

---
### 2️⃣ Backend – Railway (Node/Express)

1. **Créer le projet Railway**
   - Se rendre sur <https://railway.app> et se connecter avec GitHub.
   - Créer un nouveau projet → **Deploy from Repo** → choisir le même dépôt.
   - Sélectionner le répertoire **backend** lorsqu’on vous le demande.
2. **Variables d’environnement**
   - Dans le tableau de bord du service → **Settings → Variables**.
   - Ajouter :
     | Variable | Valeur (exemple) |
     |---|---|
     | `MONGODB_URI` | `mongodb+srv://...` |
     | `JWT_SECRET` | `superSecretKeyAtLeast32Chars` |
     | `OPENAI_API_KEY` | `sk-...` |
     | `GROQ_API_KEY` | `gsk_...` |
     | `PORT` | `3002` |
     | `SMTP_HOST` | `smtp.gmail.com` |
     | `SMTP_PORT` | `587` |
     | `SMTP_USER` | `youremail@gmail.com` |
     | `SMTP_PASS` | `yourpassword` |
   - Enregistrez.
3. **Déploiement**
   - Railway exécute automatiquement `npm ci && npm start` (ou `npm run dev` en preview).
   - L’URL du backend sera affichée, par ex. `https://docintel-backend.up.railway.app`.
4. **Tester**
   - Depuis le terminal ou postman, faire un `GET https://docintel-backend.up.railway.app/api/health` pour vérifier que le serveur répond.

---
### 3️⃣ Rewrites Frontend → Backend
Le fichier **vercel.json** (voir Phase E) indique à Vercel de router toutes les requêtes `/api/*` vers l’URL du backend Railway.

---
### 4️⃣ Récapitulatif des commandes (locales) avant le push
```bash
# Frontend – préparer le build
cd frontend
npm run build   # génère .next

# Backend – préparer le build (optional)
cd ../backend
npm run build   # si vous avez un script build

# Commit & push
git add .
git commit -m "feat: README, deployment config, QR code, missing report sections"
git push origin main
```

---
### 5️⃣ Après le push
1. **Vérifier sur Vercel** que le déploiement a bien démarré (Logs → Build & Output). 
2. **Vérifier sur Railway** que le service tourne (Logs → Runtime).
3. Copier les **URLs finales** (frontend et backend) – elles seront utilisées pour le QR‑code et le README.

---
## 📌 Notes supplémentaires
- Si le backend dépasse les limites d’une fonction serverless, Railway reste le meilleur choix (déploiement de conteneur Docker possible). 
- Les variables commençant par `NEXT_PUBLIC_` sont exposées côté client ; ne placez jamais de secrets sensibles dans celles‑ci.

---
*Ce guide doit rester synchronisé avec le README et le tableau des variables d’environnement.*
