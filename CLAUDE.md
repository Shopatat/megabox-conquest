# Megabox Conquest — remake web

Remake jouable dans le navigateur de **Megabox Conquest**, le jeu préinstallé sur les Sagem myX (MyX-1, MyX-3, MyX-5…) au début des années 2000. Projet perso de Fabien, joué surtout sur iPhone (tactile), aussi au clavier.

Tout le jeu tient dans **un seul fichier `index.html`** (HTML + CSS + JS vanilla, aucune dépendance, aucune étape de build). Seule ressource externe : les polices Google Fonts (Silkscreen pour les titres et les chiffres, Rubik pour le reste), avec des polices de secours.

Autour, les fichiers de la **PWA** (installable sur l'iPhone via Safari → Partager → « Sur l'écran d'accueil », plein écran, jouable hors ligne) :
- `manifest.webmanifest` : nom, icônes, portrait, couleurs `#14111c`.
- `sw.js` : service worker. La page est servie **réseau d'abord** (repli sur le cache hors ligne ou au-delà de 3 s), donc une nouvelle version s'affiche dès le lancement suivant ; les autres fichiers sont servis depuis le cache puis mis à jour en arrière-plan. Polices Google mises en cache au premier chargement. Si on ajoute un fichier au jeu, l'ajouter à `FILES` ; changer `CACHE` (actuellement `mbc-v2`) uniquement pour forcer une purge complète.
- `icons/` : PNG générés par `node tools/icons.js icons` (mini scène de jeu dessinée en code, sans dépendance). Relancer après toute retouche de `tools/icons.js`.
- Dans `index.html` : viewport `viewport-fit=cover` + marges `env(safe-area-inset-*)` sur `.app` (encoche, barre d'accueil), barre d'état iOS `black-translucent`, et un petit `<script>` séparé en fin de fichier qui enregistre le service worker (uniquement en http(s)).

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
Gel de la scène, écran inversé 3 fois (`invert` CSS), explosion et « CRASH ! », −1 vie. Puis le joueur **repart là où il est mort**, sur la case conquise la plus proche (`respawnCell`, en évitant si possible les cases proches de **tout** ennemi), **le terrain conquis est conservé**, et l'écran d'info s'affiche.

### Ennemis coincés
Un ennemi de mer peut se retrouver dans le terrain conquis (perforateur ou ennemi sous Casque posé sur le fil au moment de la capture), un gardien peut perdre sa case (grignotée). `unstick()`, appelé à chaque mouvement d'ennemi, le replace sur la case libre la plus proche de son milieu (ou le supprime s'il n'y en a plus). Avant ce correctif, Fabien est mort en boucle en réapparaissant sur un ennemi coincé.

### Zone protégée (départ et reprise)
Demande de Fabien : tant que le joueur n'a pas bougé (début de niveau et après un crash), un **cercle blanc discret** pulse autour du vaisseau (`SHIELD_R = 3`, `drawShield`). **Tous les ennemis rebondissent dessus**, trous noirs compris (`shieldBounce` : retour à la position précédente et réflexion de la vitesse), et le trou noir n'aspire pas. Tant qu'il est actif, **aucun ennemi ne peut tuer le joueur**, même s'il est déjà dans le cercle. Le premier mouvement le lève (`dropShield`, le cercle s'évase en disparaissant), puis 1 s d'invulnérabilité contre les ennemis du terrain.

### Onde de choc
Quand un ennemi touche le fil, une onde part du point d'impact et efface le fil dans les deux sens. Le joueur **continue d'avancer** (il n'est plus figé, demande de Fabien pour la fluidité) : si l'onde rattrape la tête du fil, crash ; s'il regagne son terrain avant, il survit mais la conquête est annulée (`cancelConquest`). Un 2ᵉ impact pendant l'onde étend ses fronts (`wave.lo/hi`). Onde normale : 30 cases/s. Onde du perforateur : 65 cases/s. Avec un vaisseau à 17 cases/s, on s'en sort contre une onde normale si le chemin de retour fait moins d'environ 1,3 × la longueur de fil derrière soi (0,35 × pour le perforateur).

---

## Difficultés et niveaux

| Difficulté | Objectif | Vitesse ennemis | Décalage `shift` | Perforateurs max | Bonus mobiles à partir de la paire |
|---|---|---|---|---|---|
| Débutant | **75 %** | ×0,85 | −2 | 2 | jamais |
| Confirmé | **80 %** | ×1 | 0 | 6 | 6 |
| Expert | **85 %** | ×1,2 | +2 | 6 | 3 |

Les objectifs 75/80/85 ont été **choisis par Fabien**. L'original avait 75/65/55.

**25 niveaux par difficulté.** Les niveaux vont par paires (`p = ceil(L/2)`) : deux niveaux avec les mêmes ennemis (dans l'original, seul le niveau impair avait des bonus ; ils sont maintenant aléatoires sur tous les niveaux). Composition dans `comp(L, d)`, lue dans le tableau `ROSTER` (une colonne par paire, valeurs Confirmé) à la ligne `p + shift` ; au-delà de la paire 13, +1 boule par cran (Expert finit à 16 boules).

Fabien trouvait le jeu **beaucoup trop facile** : il veut des débuts doux mais se sentir **submergé** dans les niveaux avancés (« jusqu'à plein d'ennemis », seconde hausse). Testé à 60 images/s avec 37 ennemis sur PC ; à surveiller sur iPhone (les trous noirs à lentille sont le plus coûteux). Total d'ennemis (boules/perfos/gardiens/trous noirs/rongeurs) :

| Niveau | 1 | 5 | 9 | 13 | 17 | 21 | 25 |
|---|---|---|---|---|---|---|---|
| Débutant | 2 | 2 | 6 | 12 | 16 | 21 | 25 |
| Confirmé | 2 | 6 | 12 | 17 | 23 | 28 | 35 (14/6/8/3/4) |
| Expert | 6 | 12 | 17 | 23 | 28 | 35 | 37 (16/6/8/3/4) |

La vitesse augmente de 2 % par niveau (2,5 % avant la hausse du nombre d'ennemis).

Fin de niveau : bonus de niveau et bonus de dépassement de l'objectif. **Plus de vie offerte** en fin de niveau (retirée à la demande de Fabien) : les vies ne se gagnent qu'avec le bonus vie. Les pouvoirs actifs sont perdus. Après le niveau 25 : écran de victoire.

---

## Ennemis

| Clé | Nom | Zone | Comportement |
|---|---|---|---|
| `out` | Boule (jaune) | à conquérir | Rebondit sur le terrain et sur le fil. Toucher le fil déclenche l'onde de choc. Diagonales à 30/45/60°. |
| `perf` | Perforateur (vert, foreuse) | à conquérir | Plus rapide (8,8 contre 7,2), **transperce** le fil au lieu de rebondir, onde foudroyante. Rendu plus redoutable que la boule à la demande de Fabien. |
| `inn` | Gardien (étoile rose) | terrain conquis | Patrouille sur le terrain, angles de 30/60°, part du bas. |
| `amph` | Amphibie = **trou noir** (violet, présenté comme « TROU NOIR ») | partout | Lent (2,8). Ne rebondit que sur les bords de l'écran. De près, il **aspire le vaisseau** (rayon `PULL_R = 7.5`, `3 + 18·s²` cases/s avec `s = 1 − d/PULL_R`, `suckStep`, jamais sur son propre fil). **S'il croise le fil** (son centre sur une case de fil), **pas d'onde de choc** : il l'**avale** (`grabTrail`, état global `grab`) et ramène le vaisseau vers lui le long de son tracé (`reel()` depuis le vaisseau vers la case du fil la plus proche du trou, puis aspiration directe), **de plus en plus fort** : `GRAB_V0 + GRAB_ACC·t` = 3 + 9·t cases/s (plafond 45). Il faut regagner son terrain au plus court (ça annule l'emprise). Précision de Fabien : la « corde » dont il parlait était une métaphore, le trou n'agit sur le fil que s'il le croise. Aucun effet sous Casque, ne croise jamais le fil sous Super Casque (mur). Horizon `R_AMPH = 1.2`, collision à 1,45 (taille réduite d’un quart à la demande de Fabien : il était trop grand à côté du reste), il avale le fil dès que son horizon l'effleure. Fabien veut qu'il soit **très dangereux**. Rendu (`drawAmph`, dessiné après les autres ennemis et avant le vaisseau) : **lentille gravitationnelle** (`LENS_R = 5.5` : copie de la zone autour du trou dans `lensCv`, puis 12 anneaux concentriques de plus en plus rétrécis et tordus : l'espace tombe vers le centre en spirale, les étoiles s'étirent en arcs), anneau d'Einstein discret, puis **obscurité** qui engloutit tout jusqu’à environ 4 cases, **terrain conquis compris**, le temps de son passage, fines traînées qui tourbillonnent, poussière en spirale, anneau de photons et horizon noir absolu. Pas de disque façon Saturne ni de cercle en pointillés (retirés à la demande de Fabien). Le fil est courbé vers lui (`bend`, visuel) ; pendant l'emprise, le fil entre le trou et le vaisseau s'illumine et file vers le trou de plus en plus vite, avec un tourbillon (`drawSuck`). Horizon en couleurs inversées au-dessus du terrain. |
| `eat` | **Rongeur** (orange, création maison) | à conquérir | Lent (3,4). **Grignote une case de terrain** à chaque contact (cooldown 0,35 s). Ne touche jamais la bordure d'origine ni la case du joueur. Fait baisser le pourcentage. |

Tous les ennemis sont « polarisés » : leur dessin suit leur sens de déplacement (doc original). Rendu soigné (même niveau de finition que le vaisseau) : halo lumineux additif (`halo()`), œil qui regarde dans le sens du déplacement (`eye()`). **Boule** : orbe de plasma en dégradé, traînée de comète, légère déformation dans le sens du mouvement, reflet qui tourne. **Perforateur** : foreuse conique en dégradé, rainures en spirale qui défilent, pointe incandescente, sillage vert. **Gardien** : shuriken rose à deux couches qui tournent en sens inverse et pulsent, étincelles en orbite. **Rongeur** : croqueur en dégradé, bouche sombre bien ouverte et dents blanches (pour ne pas le confondre avec la boule), se tasse quand il mord et projette des miettes de terrain. Les ennemis de mer servent de graines au flood fill (`seaSeeds()`).

---

## Bonus

Ils apparaissent **au hasard, sur tous les niveaux** (demande de Fabien : on ne doit pas pouvoir s'y préparer, juste réagir vite) : de 0 à 3 par niveau (`bonusCount` : 15 % / 35 % / 32 % / 18 %, 1,5 en moyenne), un à la fois, après un délai aléatoire (`bonusDelay` : 2 s + loi exponentielle de moyenne 12 s pour le premier, 4 s + 14 s ensuite ; souvent quelques secondes, parfois très long). Plus de seuil de 10 % ni de règle « niveau impair » (règle de l'original abandonnée). L'écran d'info ne les annonce plus ; il prévient seulement quand les bonus commencent à se déplacer. Durée de vie limitée. Avant de disparaître, le cœur clignote 2 fois par seconde et les 6 points autour se figent (doc original). On les ramasse en passant dessus. Les bonus posés dans la zone à conquérir sont aussi ramassés si on capture leur zone.

| Clé | Bonus | Où | Effet |
|---|---|---|---|
| `inv` | **Casque** | zone à conquérir | 10 s. **Fidèle à l'original** : les ennemis n'ont aucun effet. On passe à travers, ils traversent le fil sans le toucher, et le trou noir n'aspire plus. Croiser son propre fil le dissout au lieu de crasher. |
| `sup` | **Super Casque** (rare) | zone à conquérir | 10 s. Le **fil devient un mur** (tous les ennemis rebondissent dessus, perforateur et trou noir compris). Le joueur **détruit** les ennemis qu'il touche, avec des **combos** (×2, ×3…). Gros effet visuel : ralenti, flash doré, onde géante, texte arc-en-ciel, musique en boucle, cadre arc-en-ciel, fil doré scintillant. Idée de Fabien. |
| `spd` | Vitesse | **sur le terrain conquis** (doc original) | 10 s, ×1,75. |
| `life` | Vie | zone à conquérir | +1 vie (max 9). |
| `terr` | Territoire | zone à conquérir | Conquiert d'un coup une zone ronde d'environ 10 % du terrain autour du bonus. Le joueur **n'est plus figé** pendant l'expansion (il l'était dans le doc original, retiré à la demande de Fabien), et les ennemis pris dedans sont repoussés. |
| `chr` | **Chrono** (idée de Fabien) | zone à conquérir | 10 s. Les ennemis ralentissent (×0,45, `foeSlow()`), et avec eux l'onde de choc et l'aspiration du trou noir. Le vaisseau ralentit aussi (×0,6) pour mieux viser. On peut **s'arrêter en pleine trajectoire** dans la zone à conquérir (tap ou Espace). À la fin (`chronoEnd`), si le vaisseau est arrêté dans la zone à conquérir, il repart dans sa dernière direction. Grande horloge translucide derrière le jeu (l'aiguille fait un tour sur la durée), bords teintés vert menthe, tic-tac. Perdu au crash. |

### Super bonus (cartes rares, idée de Fabien : « il faut que ce soit impressionnant »)

Chaque bonus a une version super, rare : à partir du niveau 3, poids `sup` 0,45, `sterr` 0,35, `sspd` 0,35, `schr` 0,35, `slife` 0,3 (si moins de 9 vies) contre ~10 pour les bonus normaux, soit environ 1 bonus sur 8. La table `SUPER` relie chaque super à son bonus de base (dont il reprend l'icône). Tous partagent le même look (`drawSuperItem` : rayons arc-en-ciel, halo, étincelles, icône en couleur vive + couronne ; casque doré pour `sup`) et s'annoncent à l'apparition (`announce` : carillon `sfx.rare`, « RARE ! », onde dorée). Au ramassage, `superIntro` : ralenti, flash teinté (`superTint`), tremblement, grand titre arc-en-ciel (les grands titres sont réduits pour tenir dans le terrain).

| Clé | Super bonus | Où | Effet |
|---|---|---|---|
| `sterr` | **Super Bombe** | zone à conquérir | Conquiert d'un coup ~**30 %** du terrain (`territoryBurst(it, 0.3, true)`, compte comme un « MEGA ! »). Boule de feu blanche, 3 ondes de choc (blanc, or, orange), gerbes de particules, débris, gros tremblement, révélation en vague plus lente, son d'explosion grave. |
| `sspd` | **Super Vitesse** | sur le terrain conquis | 10 s à **×4** (`power.hyp`, ~68 cases/s : traverser le terrain est quasi instantané, volontairement dur à contrôler). Éclairs qui tombent du haut sur le vaisseau (`bolts`), images fantômes, arcs électriques autour du vaisseau, traits de vitesse sur tout le terrain, fil cyan, crépitements. Remplace la Vitesse normale. |
| `slife` | **Super Vie** | zone à conquérir | **+3 vies** (max 9). Flash rose, « +1 VIE » ×3 en cascade (« MAX » si plafonné), 3 ondes, les vies du HUD s'illuminent (classe CSS `boost`), arpège montant. |
| `schr` | **Super Chrono** | zone à conquérir | 10 s, ennemis **presque figés** (×0,15), le vaisseau garde sa vitesse, arrêt possible partout. Entrée « super » (ralenti, flash menthe, 3 ondes), horloge plus marquée. |

Historique de l'invincibilité, pour mémoire : 1) les ennemis étaient pulvérisés (trop fort), 2) ils étaient assommés 4 s (code `stunFoe`/`drawStun`, encore présent mais inutilisé), 3) version actuelle : casque original + Super Casque rare.

---

## Écrans et interface

- **Menu** : choix de la difficulté, niveau de départ (jusqu'au plus haut atteint), Nouveau jeu, **Continuer** (sauvegarde), **Mode test**, record par difficulté, « Comment jouer ».
- **Écran d'info** avant chaque niveau et après un crash : niveau, difficulté, vies, objectif ou réalisé, score, présentation des nouveaux ennemis. **Pas de compte à rebours** (retiré à la demande de Fabien) : bouton PARTIR (toujours visible en bas de la carte) ou tap n'importe où.
- **Pause** uniquement via le bouton ⏸ à côté du score (ou P/Échap au clavier), plus une pause automatique si l'onglet est masqué. Boutons REPRENDRE et QUITTER LA PARTIE (retour au menu ; la partie reste sauvegardée au début du niveau). Pas de chrono : jeu « tranquillou », sans limite de temps.
- **Game over** : si le record est battu, « FÉLICITATIONS ! VOUS AVEZ BATTU LE RECORD ! » (texte de l'original).
- **Écran** : bouton pour passer du thème `COULEUR` au thème `MYX-3` (monochrome bleu rétroéclairé, comme le vrai MyX-3). Tous les dessins passent par l'objet de thème `T`.
- **Son** : WebAudio synthétisé (aucun fichier audio), bouton ON/OFF.
- **Terrain** : 7 styles ont été essayés (grille Tron, cristal, holo, planète, couchant, rétro) ; Fabien a gardé le dégradé NÉON d'origine, le sélecteur a été retiré.
- **Zoom bloqué** : viewport `maximum-scale=1, user-scalable=no`, `touch-action: manipulation`, et un script qui annule le double tap rapide (hors boutons) et les gestes de zoom iOS.
- **Style** (demande de Fabien : plus joli, moins carré, arcade mais « smooth », couleurs modernes) : fond nuit avec halos violet/bleu, HUD et cartes en verre dépoli très arrondis (18-24 px), boutons en dégradé rose → orange (`--grad`) avec relief arcade et animation à l'appui, segments et puces en pilule, jauge en dégradé cyan → violet. Police pixel Silkscreen pour titres, chiffres et boutons ; Rubik pour les libellés et les textes. Terrain : dégradé lisse bleu → violet en diagonale (`landGrad`, `landColor()`), coins arrondis et halo autour du canvas. Zone à conquérir façon **espace** (`space: true`) : nébuleuses discrètes et ~170 étoiles tirées avec une graine fixe dans `drawBg`, plus 22 étoiles qui scintillent (`drawTwinkle`, seulement sur les cases vides). Formes adoucies : fil plus épais avec un halo doux et un centre en points ronds. **Vaisseau** redessiné (Fabien veut que tout « ait la classe » et soit fluide) : gemme carrée arrondie sur le terrain ; dans la zone à conquérir, coque effilée en dégradé, deux ailerons arrondis, cockpit cyan lumineux, flamme en dégradé qui ondule (sinus, pas d'aléatoire) et traînée de particules. **Rotation lissée** (`P.ang` rattrape la direction) avec une légère inclinaison dans les virages. Particules rondes en lumière additive, tremblement d'écran fluide (sinus), score qui défile (`tweenScore`). Interface : écrans en fondu (entrée et sortie, `hideOverlay` attend 200 ms), fond assombri derrière les cartes, dégradé qui glisse sur les titres, reflet qui balaie le bouton principal et la jauge, puces de pouvoirs qui apparaissent en douceur. Tout est coupé si l'appareil demande moins d'animations. Le thème MYX-3 garde son damier rétro. Les cartes n'animent leur entrée que si aucune n'était affichée (classe `in`). Le HUD ne descend jamais sous 343 px de large. La rangée des pouvoirs du HUD a une **hauteur fixe toujours réservée** (22 px, une seule ligne, textes tronqués si besoin) : quand elle apparaissait et disparaissait, la hauteur du terrain changeait et l'écran sautait à la fin d'un bonus (signalé par Fabien). `resize()` ne fait rien si la taille du canvas ne change pas.

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
Test de fumée : `node tools/smoke.js index.html`. Il extrait le `<script>`, l'exécute dans Node avec un faux `document`, un faux canvas (Proxy), une fausse horloge et un faux `requestAnimationFrame` (le `ResizeObserver` factice doit appeler `resize()`, sinon rien ne tourne). Il affiche la composition des niveaux, vérifie l'onde de choc (on s'échappe / on se fait rattraper) et le bonus territoire, puis simule 6000 frames avec des touches aléatoires à plusieurs niveaux et difficultés. Doit finir par `OK`. Lancer aussi `node --check` sur le script extrait après chaque modification. Pour tester dans le navigateur en local, passer par un serveur http (le service worker sert sinon l'ancienne version en cache : le désenregistrer d'abord).

---

## Écarts volontaires par rapport à l'original

- Objectifs 75/80/85 % au lieu de 75/65/55.
- Beaucoup plus d'ennemis (jusqu'à 21-23 au niveau 25), et le joueur n'est jamais figé (ni par l'onde de choc, ni par le bonus territoire).
- Perforateur plus redoutable (transperce, onde foudroyante) au lieu de « coupe le fil et annule la conquête ».
- Amphibie transformé en trou noir qui aspire le vaisseau et avale le fil qu'il croise.
- Pas de vie offerte en fin de niveau.
- Nouvel ennemi : le rongeur.
- Super Casque, Super Bombe, Super Vitesse et Super Vie (n'existent pas dans l'original).
- Bonus aléatoires sur tous les niveaux (0 à 3, moments imprévisibles) au lieu d'un bonus par niveau impair, et une durée de 10 s pour casque et vitesse (non précisée dans l'original).
- Score maison, contrôles tactiles, thème MyX-3 en option, effets modernes (particules, vague de remplissage, sons).

## Publication

- Dépôt public : https://github.com/Shopatat/megabox-conquest (branche `main`)
- Jeu en ligne (GitHub Pages, déployé automatiquement à chaque push sur `main`) : https://shopatat.github.io/megabox-conquest/
- CLI GitHub installée en `C:\Program Files\GitHub CLI\gh.exe` (connectée en `Shopatat`). Commits signés avec l'adresse noreply GitHub (config locale du dépôt).

## Pistes pour la suite

- Équilibrage à affiner en jouant (vitesse du perforateur, force du trou noir, objectif Expert avec les rongeurs).
- Design général à peaufiner (Fabien l'a évoqué sans détailler).
- Éventuellement l'écran d'intro et les « slides » de crash dessinés, comme prévus dans le doc original.
