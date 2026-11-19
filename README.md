# Minuit — crée ton copain IA

Application web mobile (HTML/CSS/JS, sans build) : un onboarding sous forme de conversation où l'utilisatrice « construit » son copain IA, puis un chat avec lui.

## Lancer

Ouvre `index.html` dans un navigateur, ou :

```bash
python3 -m http.server 8000   # puis http://localhost:8000
```

## Parcours (6 étapes, barre de progression)

1. Choisir son visage (grille de 4 personnages)
2. Garder ou changer son prénom
3. Son caractère : protecteur / taquin / mystérieux / doux
4. Ton prénom
5. Comment il t'appelle
6. Comment vous vous êtes rencontrés

Ensuite : chat libre. Le profil est gardé dans `localStorage`. Le bouton ⏭ en haut à gauche passe l'intro (ou recommence une fois dans le chat).

## Photos

Mets tes images dans `assets/` : `dante.jpg`, `kai.jpg`, `knox.jpg`, `ezra.jpg` (format carré conseillé). Sans image, un dégradé avec l'initiale s'affiche. Modifie `PERSONAS` dans `app.js` pour changer noms, étiquettes et photos.

## Brancher une vraie IA

Les réponses sont aujourd'hui des phrases prédéfinies (`reply()` dans `app.js`). Pour de vraies réponses, remplace `reply()` par un appel à ton propre serveur qui interroge un modèle de langage avec un prompt système construit à partir du profil (`state.name`, `state.vibe`, `state.nickname`, `state.meet`…). Ne mets jamais de clé API dans le code côté navigateur.
