# Megabox Conquest — remake web

Remake jouable dans le navigateur de **Megabox Conquest**, le jeu préinstallé sur les Sagem myX (MyX-1, MyX-3, MyX-5…) au début des années 2000. Projet perso de Fabien, joué surtout sur iPhone (tactile), aussi au clavier.

Tout le jeu tient dans **un seul fichier `index.html`** (HTML + CSS + JS vanilla, aucune dépendance, aucune étape de build). Seule ressource externe : les polices Google Fonts (Silkscreen, IBM Plex Sans Condensed), avec des polices de secours.

Langue : **toute l'interface est en français**. Fabien tutoie et parle familièrement.

---

## Source de référence

Le jeu d'origine a été conçu par **Dominique Sciamma** pour Sagem Mobile (1999-2001), graphismes de Cédric Cossart, son d'Eugène Lledo. Il s'inspire de **Xonix**.

- Page du jeu : https://dominique.sciamma.com/?page_id=781
- Document de conception original « XONIX for SAGEM » V4, janvier 2001 (PDF) : http://dominique.sciamma.com/wp-content/uploads/2013/01/Xonix-design-4.pdf

Consigne de Fabien : **s'inspirer de l'original autant que possible**. Les écarts sont volontaires et listés plus bas.

---

## Principe du jeu

Terrain en grille de **50 × 66 cases** (portrait), bordure conquise de 2 cases au départ. Le joueur part en haut au milieu, sur son terrain. Il entre dans la zone à conquérir en traçant un **fil**. Quand il revient sur son terrain, le fil devient terrain, et toute zone vide **sans ennemi « de mer »** (boule, perforateur, rongeur) est conquise par remplissage (flood fill). Objectif : atteindre le pourcentage cible de la difficulté.

États de case dans `grid` (`Uint8Array`) : `0` à conquérir, `1` conquis, `2` fil.

### Joueur
- Déplacement par cases, inertiel : une direction le fait avancer jusqu'à un changement ou un mur. Il s'arrête automatiquement en refermant un fil. Pas de demi-tour sur son propre fil.
- Rendu interpolé entre les cases (fluide). Vitesse de base : 17 cases/s (`STEP = 1/17`).
- Apparence (d'après le doc original) : **carré** sur son terrain, **petit vaisseau** (nez pointu + deux oreillettes à l'arrière, « vidéo inversée ») dans la zone à conquérir, avec un morph animé entre les deux. Le fil a un centre en pointillés.
- Croiser son propre fil = crash.

### Crash
Gel de la scène, écran inversé 3 fois (`invert` CSS), explosion et « CRASH ! », −1 vie. Puis le joueur repart en haut au milieu, **le terrain conquis est conservé**, et l'écran d'info s'affiche. Courte invulnérabilité au respawn (contre les ennemis du terrain uniquement).

### Onde de choc
Quand un ennemi touche le fil, une onde part du point d'impact et efface le fil dans les deux sens. Le joueur est **figé** et crashe quand l'onde l'atteint. Onde normale : 30 cases/s. Onde du perforateur : 65 cases/s.

---

## Difficultés et niveaux

| Difficulté | Objectif | Vitesse ennemis | Perforateurs max | Bonus mobiles à partir de la paire |
|---|---|---|---|---|
| Débutant | **75 %** | ×0,85 | 2 | jamais |
| Confirmé | **80 %** | ×1 | 2 | 6 |
| Expert | **85 %** | ×1,2 | 3 | 3 |

Les objectifs 75/80/85 ont été **choisis par Fabien**. L'original avait 75/65/55.

**25 niveaux par difficulté.** Les niveaux vont par paires (`p = ceil(L/2)`) : un niveau impair avec bonus, puis un niveau pair sans bonus avec les mêmes ennemis (règle de l'original). Composition dans `comp(L, d)` :

- `out` (boule) : 1, +1 dès p5, +1 dès p10
- `inn` (gardien) : `min(4, floor(p/2))`
- `perf` (perforateur) : `min(maxPerf, floor((p+1)/3))`
- `amph` (amphibie / trou noir) : 1 dès p4, 2 dès p9
- `eat` (rongeur) : 1 dès p8 (niveau 15), 2 dès p11 (niveau 21)
- La vitesse augmente de 2,5 % par niveau.

Fin de niveau : +1 vie (max 9), bonus de niveau et bonus de dépassement de l'objectif. Les pouvoirs actifs sont perdus. Après le niveau 25 : écran de victoire.

---

## Ennemis

| Clé | Nom | Zone | Comportement |
|---|---|---|---|
| `out` | Boule (jaune) | à conquérir | Rebondit sur le terrain et sur le fil. Toucher le fil déclenche l'onde de choc. Diagonales à 30/45/60°. |
| `perf` | Perforateur (vert, foreuse) | à conquérir | Plus rapide (8,8 contre 7,2), **transperce** le fil au lieu de rebondir, onde foudroyante. Rendu plus redoutable que la boule à la demande de Fabien. |
| `inn` | Gardien (étoile rose) | terrain conquis | Patrouille sur le terrain, angles de 30/60°, part du bas. |
| `amph` | Amphibie = **trou noir** (violet) | partout | Ne rebondit que sur les bords de l'écran. Touche le fil → onde. **Aspire le vaisseau** case par case dans un rayon `PULL_R = 4.5` : plus il est proche, plus il tire fort. Il ne tire jamais le joueur sur son propre fil (il le dévie sur le côté). S'affiche en couleurs inversées au-dessus du terrain. |
| `eat` | **Rongeur** (orange, création maison) | à conquérir | Lent (3,4). **Grignote une case de terrain** à chaque contact (cooldown 0,35 s). Ne touche jamais la bordure d'origine ni la case du joueur. Fait baisser le pourcentage. |

Tous les ennemis sont « polarisés » : leur dessin suit leur sens de déplacement (doc original). Les ennemis de mer servent de graines au flood fill (`seaSeeds()`).

---

## Bonus

Ils apparaissent sur les **niveaux impairs**, une fois **10 %** du terrain conquis, **2 par niveau** (l'original en avait 1), un à la fois. Durée de vie limitée. Avant de disparaître, le cœur clignote 2 fois par seconde et les 6 points autour se figent (doc original). On les ramasse en passant dessus. Les bonus posés dans la zone à conquérir sont aussi ramassés si on capture leur zone.

| Clé | Bonus | Où | Effet |
|---|---|---|---|
| `inv` | **Casque** | zone à conquérir | 10 s. **Fidèle à l'original** : les ennemis n'ont aucun effet. On passe à travers, ils traversent le fil sans le toucher, et le trou noir n'aspire plus. Croiser son propre fil le dissout au lieu de crasher. |
| `sup` | **Super Casque** (rare, dès le niveau 3, environ 5 % des bonus) | zone à conquérir | 10 s. Le **fil devient un mur** (tous les ennemis rebondissent dessus, perforateur et trou noir compris). Le joueur **détruit** les ennemis qu'il touche, avec des **combos** (×2, ×3…). Gros effet visuel : ralenti, flash doré, onde géante, texte arc-en-ciel, musique en boucle, cadre arc-en-ciel, fil doré scintillant. Idée de Fabien. |
| `spd` | Vitesse | **sur le terrain conquis** (doc original) | 10 s, ×1,75. |
| `life` | Vie | zone à conquérir | +1 vie (max 9). |
| `terr` | Territoire | zone à conquérir | Conquiert d'un coup une zone ronde d'environ 10 % du terrain autour du bonus. Le joueur est immobile pendant l'expansion, et les ennemis pris dedans sont repoussés (doc original). |

Historique de l'invincibilité, pour mémoire : 1) les ennemis étaient pulvérisés (trop fort), 2) ils étaient assommés 4 s (code `stunFoe`/`drawStun`, encore présent mais inutilisé), 3) version actuelle : casque original + Super Casque rare.

---

## Écrans et interface

- **Menu** : choix de la difficulté, niveau de départ (jusqu'au plus haut atteint), Nouveau jeu, **Continuer** (sauvegarde), **Mode test**, record par difficulté, « Comment jouer ».
- **Écran d'info** avant chaque niveau et après un crash : niveau, difficulté, vies, objectif ou réalisé, score, présentation des nouveaux ennemis. Compte à rebours de 5 s, tap pour partir.
- **Pause** uniquement via le bouton ⏸ à côté du score (ou P/Échap au clavier), plus une pause automatique si l'onglet est masqué. Pas de chrono : jeu « tranquillou », sans limite de temps.
- **Game over** : si le record est battu, « FÉLICITATIONS ! VOUS AVEZ BATTU LE RECORD ! » (texte de l'original).
- **Écran** : bouton pour passer du thème `COULEUR` au thème `MYX-3` (monochrome bleu rétroéclairé, comme le vrai MyX-3). Tous les dessins passent par l'objet de thème `T`.
- **Son** : WebAudio synthétisé (aucun fichier audio), bouton ON/OFF.

### Contrôles (choix de Fabien, important)
- **Tactile** : **glisser** pour diriger, **un tap = s'arrêter** (sur son terrain). Un tap ne met **pas** en pause. Pas de croix directionnelle à l'écran (retirée à sa demande).
- **Clavier** : flèches ou ZQSD (AZERTY) / WASD, Espace = stop, P/Échap = pause, Entrée = valider.

### Mode test (bac à sable)
Bouton dans le menu. Vies infinies, pas d'objectif, pas de sauvegarde ni de record. Une barre sous le terrain permet de faire apparaître chaque bonus près du joueur et d'ajouter chaque ennemi, ainsi que Vider, Réinitialiser et Quitter. Pratique pour régler l'équilibrage.

---

## Score

10 points × niveau par case conquise, ×2 si on prend plus de 15 % d'un coup (« MEGA ! »). Fin de niveau : 1000 × (difficulté + 1) × niveau, plus 150 × niveau par point de pourcentage au-delà de l'objectif. Super Casque : 500 × niveau × combo par ennemi détruit. La formule de score de l'original était illisible dans le document : celle-ci est maison.

---

## Stockage (`localStorage`, préfixe `mbc2-`)

`theme`, `mute`, `diff` (dernière difficulté choisie), `max0/1/2` (plus haut niveau atteint par difficulté), `best0/1/2` (record par difficulté), `save` (`{d, L, score, lives}`, partie en cours, mise à jour au début de chaque niveau et effacée au game over ou à la victoire). Tous les accès sont protégés par `try/catch`.

---

## Organisation du code (`index.html`)

Le script est une IIFE découpée en sections commentées `/* ---------- … ---------- */` :

1. Constantes, `DIFFS`, `THEMES`, `ITEM`, `INTRO` (textes de présentation des ennemis)
2. **Stockage**, **Son** (`sfx.*`, `tone()`)
3. **Taille et dessin du terrain** : `resize()` avec un `ResizeObserver`. Trois canvas : `bg` (fond statique), `board` (cases conquises, redessiné entièrement par `drawBoard()` ou incrémentalement via `paintCellIdx()`), et le canvas principal. Le dessin se fait **en unités de case** grâce à `setTransform(scale…)`.
4. **Composition des niveaux** : `comp()`, `makeFoe()`
5. **Partie** : `newGame`, `continueGame`, `setupLevel`, `newPlayer`
6. **Fil** : `pushTrail`, `eraseK`, `dissolveTrail`, `cancelConquest`, `onTrailHit`, `updateWave`. Le fil est un tableau ordonné `trail` + `erased` + `trailPos` (index inverse).
7. **Joueur** : `setDir`, `stepPlayer`, `moveInto`, `updatePull` (trou noir), `playerPos` (interpolation + décalage visuel `vox/voy`)
8. **Conquête** : `capture()` (flood fill depuis les ennemis de mer, puis révélation animée en vague via `startReveal`), `awardCells`, `checkGoal`
9. **Ennemis** : `moveSea`, `moveLand`, `moveAmph`, `landHit` (rongeur), `updateFoes`, `smash` (Super Casque), `superOn`, `superMusic`
10. **Crash** : `crash`, `updateCrash`
11. **Bonus** : `pickType`, `spawnItem`, `collect`, `territoryBurst`, `pushOut`, `updateItems`, `powersHud`
12. **Boucle** : `update(dt)` (machine à états via `S.phase` : `title`, `ready`, `play`, `pause`, `crash`, `clearing`, `clear`, `over`) et `render()` avec les fonctions de dessin `draw*`
13. **HUD et écrans** : `hud`, `showOverlay`, `showReady`, `showClear`, `endScreen`, `titleScreen`, `togglePause`
14. **Mode test** : `testItem`, `testFoe`
15. **Contrôles** : clavier, swipe et tap sur le canvas

Le `dt` est plafonné à 0,05 s. Le ralenti du Super Casque multiplie `dt` dans `frame()`.

### Tester sans navigateur
Un test de fumée a été utilisé en développement : extraire le `<script>`, l'exécuter dans Node avec un faux `document`, un faux canvas (Proxy) et un faux `requestAnimationFrame`, puis simuler des milliers de frames avec des touches aléatoires, au niveau 1 et aux niveaux 13 et 21 en Expert. Ça attrape les erreurs d'exécution. Lancer aussi `node --check` sur le script extrait après chaque modification.

---

## Écarts volontaires par rapport à l'original

- Objectifs 75/80/85 % au lieu de 75/65/55.
- Perforateur plus redoutable (transperce, onde foudroyante) au lieu de « coupe le fil et annule la conquête ».
- Amphibie transformé en trou noir qui aspire.
- Nouvel ennemi : le rongeur.
- Super Casque (n'existe pas dans l'original).
- 2 bonus par niveau bonus au lieu d'un, et une durée de 10 s pour casque et vitesse (non précisée dans l'original).
- Score maison, contrôles tactiles, thème MyX-3 en option, effets modernes (particules, vague de remplissage, sons).

## Publication

- Dépôt public : https://github.com/Shopatat/megabox-conquest (branche `main`)
- Jeu en ligne (GitHub Pages, déployé automatiquement à chaque push sur `main`) : https://shopatat.github.io/megabox-conquest/
- CLI GitHub installée en `C:\Program Files\GitHub CLI\gh.exe` (connectée en `Shopatat`). Commits signés avec l'adresse noreply GitHub (config locale du dépôt).

## Pistes pour la suite

- PWA installable sur l'iPhone (le jeu est déjà publié, voir « Publication »).
- Équilibrage à affiner en jouant (vitesse du perforateur, force du trou noir, objectif Expert avec les rongeurs).
- Design général à peaufiner (Fabien l'a évoqué sans détailler).
- Éventuellement l'écran d'intro et les « slides » de crash dessinés, comme prévus dans le doc original.
