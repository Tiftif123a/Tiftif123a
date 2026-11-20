# Minuit — crée ton copain IA

Application mobile (web installable) : un écran d'accueil, un onboarding en conversation où l'utilisatrice « construit » son copain, puis un chat où il répond avec Claude.

## Lancer

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # ta clé, sur console.anthropic.com
npm start                             # puis http://localhost:8000
```

Sans clé, l'appli marche quand même : il répond avec ses phrases prédéfinies.

## Ce qu'il y a dedans

| Fichier | Rôle |
|---|---|
| `index.html`, `style.css`, `app.js` | L'appli : accueil (+ case 18 ans), 6 étapes de création, chat |
| `server.mjs` | Petit serveur Node : sert l'appli et relaie le chat vers Claude (`POST /api/chat`) |
| `manifest.webmanifest`, `sw.js`, `icons/` | Version installable (PWA) : icône sur l'écran d'accueil, plein écran, ouverture hors-ligne |
| `assets/` | Tes photos : `dante.jpg`, `kai.jpg`, `knox.jpg`, `ezra.jpg` (carrées). Sans photo : dégradé + initiale |

## L'IA

- Modèle : `claude-opus-5-5` (changeable avec `MINUIT_MODEL`), effort `low` pour des réponses rapides façon texto.
- Le prompt système (dans `server.mjs`) est construit à partir du profil : prénom, caractère, surnom, rencontre.
- Il reçoit les 40 derniers messages, donc il se souvient de la conversation. L'historique est gardé sur le téléphone (`localStorage`).
- Garde-fous intégrés au prompt : pas de contenu sexuel explicite, il dit la vérité si on lui demande sincèrement s'il est une IA, il n'encourage jamais l'isolement, et en cas de détresse il donne le 3114 / 112.
- La clé API reste sur le serveur. Limite : 20 messages / minute / adresse IP.
- Repli de sécurité activé (`fallbacks: "default"`) : si le modèle refuse une demande, l'API réessaie automatiquement sur un autre modèle.

## Installer sur le téléphone

L'appli doit être en ligne en **HTTPS** (Render, Railway, Fly.io… n'importe quel hébergeur Node ; ajoute `ANTHROPIC_API_KEY` dans ses variables d'environnement).

- **Android (Chrome)** : bouton « installer l'appli » sur l'écran d'accueil, ou menu ⋮ → *Installer l'application*.
- **iPhone (Safari)** : *Partager* → *Sur l'écran d'accueil*.

## Personnaliser

- Personnages : `PERSONAS` dans `app.js`.
- Phrases de secours et caractères : `VIBES` dans `app.js` ; description envoyée à l'IA : `VIBE_TEXT` dans `server.mjs`.
- Bouton ⏭ en haut à gauche : passe l'intro, ou recommence à zéro une fois dans le chat.
