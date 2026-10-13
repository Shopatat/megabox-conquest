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

Terrain en grille de **50 × 66 cases** (portrait), bordure conquise de 2 cases au départ. Le joueur part en haut au milieu, sur son terrain. Il entre dans la zone à conquérir en traçant un **fil**. Quand il revient sur son terrain, le fil devient terrain, et toute zone vide **sans ennemi « de mer »** (boule, perforateur, pulsar, chasseur, diviseur, spectre) est conquise par remplissage (flood fill). Objectif : atteindre le pourcentage cible de la difficulté.

États de case dans `grid` (`Uint8Array`) : `0` à conquérir, `1` conquis, `2` fil.

### Joueur
- Déplacement par cases, inertiel : une direction le fait avancer jusqu'à un changement ou un mur. Il s'arrête automatiquement en refermant un fil. Pas de demi-tour sur son propre fil.
- Rendu interpolé entre les cases (fluide). Vitesse de base : 17 cases/s (`STEP = 1/17`).
- Apparence (d'après le doc original) : **carré** sur son terrain, **petit vaisseau** (nez pointu + deux oreillettes à l'arrière, « vidéo inversée ») dans la zone à conquérir, avec un morph animé entre les deux. Le fil a un centre en pointillés.
- Croiser son propre fil = crash.

### Crash
Gel de la scène, écran inversé 3 fois (`invert` CSS), explosion et « CRASH ! », −1 vie. Puis le joueur **repart là où il est mort**, sur la case conquise la plus proche (`respawnCell`, en évitant si possible les cases proches de **tout** ennemi), **le terrain conquis est conservé**, et l'écran d'info s'affiche.

### Ennemis coincés
Un ennemi de mer peut se retrouver dans le terrain conquis (perforateur ou ennemi sous Casque posé sur le fil au moment de la capture). `unstick()`, appelé à chaque mouvement d'ennemi, le replace sur la case libre la plus proche de son milieu (ou le supprime s'il n'y en a plus). Avant ce correctif, Fabien est mort en boucle en réapparaissant sur un ennemi coincé.

### Zone protégée (départ et reprise)
Demande de Fabien : tant que le joueur n'a pas bougé (début de niveau et après un crash), un **cercle blanc discret** pulse autour du vaisseau (`SHIELD_R = 3`, `drawShield`). **Tous les ennemis rebondissent dessus**, trous noirs compris (`shieldBounce` : retour à la position précédente et réflexion de la vitesse), et le trou noir n'aspire pas. Tant qu'il est actif, **aucun ennemi ne peut tuer le joueur**, même s'il est déjà dans le cercle. Le premier mouvement le lève (`dropShield`, le cercle s'évase en disparaissant), puis 1 s d'invulnérabilité contre les ennemis du terrain.

### Onde de choc
Quand un ennemi touche le fil, une onde part du point d'impact et efface le fil dans les deux sens. Le joueur **continue d'avancer** (il n'est plus figé, demande de Fabien pour la fluidité) : si l'onde rattrape la tête du fil, crash ; s'il regagne son terrain avant, il survit mais la conquête est annulée (`cancelConquest`). Un 2ᵉ impact pendant l'onde étend ses fronts (`wave.lo/hi`). Onde normale : 30 cases/s. Onde du perforateur : 65 cases/s. Avec un vaisseau à 17 cases/s, on s'en sort contre une onde normale si le chemin de retour fait moins d'environ 1,3 × la longueur de fil derrière soi (0,35 × pour le perforateur).

---

## Difficultés et niveaux

| Difficulté | Objectif | Vitesse ennemis | Nombre d'ennemis | Perforateurs max | Bonus mobiles à partir de la paire |
|---|---|---|---|---|---|
| Débutant | **75 %** | ×0,85 | environ −30 % (au moins un de chaque type prévu, deux boules) | 3 | jamais |
| Confirmé | **80 %** | ×1 | valeurs de la table | 6 | 6 |
| Expert | **85 %** | ×1,2 | +25 % et une boule de plus | 6 | 3 |

Les objectifs 75/80/85 ont été **choisis par Fabien**. L'original avait 75/65/55.

**25 niveaux par difficulté, écrits un par un** dans la table `LEVELS` (valeurs Confirmé), que `comp(L, d)` adapte à la difficulté. Refonte demandée par Fabien : les derniers niveaux étaient devenus l'enfer (jusqu'à 35-37 ennemis, impossible de tracer un long fil). Désormais **moins d'ennemis mais des ennemis plus coriaces**, **un seul trou noir au maximum** et seulement sur certains niveaux (7, 14, 19, 22, 25), et de la **variété** : des niveaux à thème (nom affiché sur l'écran d'info, `comp().name`) avec un seul type d'ennemi ou un combo. Les débuts restent doux mais chaque niveau change quelque chose (Fabien ne voyait pas la différence entre les trois premiers, à une époque).

Arrivée des ennemis (Confirmé) : boule (1), gardien (3), perforateur (4), spectre (5), trou noir (7), chasseur (8), diviseur (10), pulsar (11). Un ennemi n'est présenté (« NOUVEAU · … ») que la première fois qu'il apparaît.

| Niv. | Thème | Ennemis (Confirmé) |
|---|---|---|
| 1-2 | | 2 puis 3 boules |
| 3 | | 2 boules, 1 gardien |
| 4 | | 3 boules, 1 perforateur |
| 5 | | 2 boules, 1 spectre, 1 gardien |
| 6 | DUEL | 2 boules, 2 perforateurs, 1 gardien |
| 7 | | 3 boules, 1 trou noir |
| 8 | | 3 boules, 1 chasseur, 1 gardien |
| 9 | ESSAIM | 8 boules |
| 10 | | 3 boules, 1 diviseur, 1 gardien |
| 11 | | 3 boules, 1 pulsar, 2 gardiens |
| 12 | FANTÔMES | 4 spectres, 1 gardien |
| 13 | LA MEUTE | 3 chasseurs, 2 boules |
| 14 | | 3 boules, 2 perforateurs, 2 gardiens, 1 trou noir |
| 15 | MITOSE | 3 diviseurs, 1 gardien |
| 16 | PULSATIONS | 2 pulsars, 2 boules, 2 gardiens |
| 17 | | 3 boules, 2 chasseurs, 2 spectres, 2 gardiens |
| 18 | FOREUSES | 5 perforateurs, 2 gardiens |
| 19 | | 2 boules, 2 diviseurs, 2 spectres, 2 gardiens, 1 trou noir |
| 20 | OMBRES | 3 spectres, 2 chasseurs, 1 pulsar, 2 gardiens |
| 21 | GARDE RAPPROCHÉE | 6 gardiens, 3 boules, 1 perforateur |
| 22 | | 3 boules, 2 chasseurs, 2 pulsars, 2 gardiens, 1 trou noir |
| 23 | TEMPÊTE | 4 perforateurs, 2 diviseurs, 2 boules, 2 gardiens |
| 24 | | 2 boules, 2 chasseurs, 2 spectres, 2 pulsars, 2 diviseurs, 2 gardiens |
| 25 | BOUQUET FINAL | 3 boules, 2 perforateurs, 2 chasseurs, 2 spectres, 1 pulsar, 1 diviseur, 3 gardiens, 1 trou noir |

Totaux au départ du niveau : 2 à 15 en Confirmé, 4 à 21 en Expert, 2 à 10 en Débutant (les diviseurs se multiplient ensuite). La vitesse augmente de 2 % par niveau. L'équilibrage reste à valider en jouant.

Fin de niveau : bonus de niveau et bonus de dépassement de l'objectif. **Plus de vie offerte** en fin de niveau (retirée à la demande de Fabien) : les vies ne se gagnent qu'avec le bonus vie. Les pouvoirs actifs sont perdus. Après le niveau 25 : écran de victoire.

---

## Ennemis

| Clé | Nom | Zone | Comportement |
|---|---|---|---|
| `out` | Boule (jaune) | à conquérir | Rebondit sur le terrain et sur le fil. Toucher le fil déclenche l'onde de choc. Diagonales à 30/45/60°. |
| `perf` | Perforateur (vert, foreuse) | à conquérir | Plus rapide (8,8 contre 7,2), **transperce** le fil au lieu de rebondir, onde foudroyante. Rendu plus redoutable que la boule à la demande de Fabien. |
| `inn` | Gardien (étoile rose) | terrain conquis | Patrouille sur le terrain, angles de 30/60°, part du bas. |
| `amph` | Amphibie = **trou noir** (violet, présenté comme « TROU NOIR ») | partout | Lent (2,8). Ne rebondit que sur les bords de l'écran. De près, il **aspire le vaisseau** (rayon `PULL_R = 7.5`, `3 + 18·s²` cases/s avec `s = 1 − d/PULL_R`, `suckStep`, jamais sur son propre fil). **S'il croise le fil** (son centre sur une case de fil), **pas d'onde de choc** : il l'**avale** (`grabTrail`, état global `grab`) et ramène le vaisseau vers lui le long de son tracé (`reel()` depuis le vaisseau vers la case du fil la plus proche du trou, puis aspiration directe), **de plus en plus fort** : `GRAB_V0 + GRAB_ACC·t` = 3 + 9·t cases/s (plafond 45). Il faut regagner son terrain au plus court (ça annule l'emprise). Précision de Fabien : la « corde » dont il parlait était une métaphore, le trou n'agit sur le fil que s'il le croise. Aucun effet sous Casque, ne croise jamais le fil sous Super Casque (mur). Horizon `R_AMPH = 1.2`, collision à 1,45 (taille réduite d’un quart à la demande de Fabien : il était trop grand à côté du reste), il avale le fil dès que son horizon l'effleure. Fabien veut qu'il soit **très dangereux**. Rendu (`drawAmph`, dessiné après les autres ennemis et avant le vaisseau) : **lentille gravitationnelle** (`LENS_R = 5.5` : copie de la zone autour du trou dans `lensCv`, puis 12 anneaux concentriques de plus en plus rétrécis et tordus : l'espace tombe vers le centre en spirale, les étoiles s'étirent en arcs), anneau d'Einstein discret, puis **obscurité** qui engloutit tout jusqu’à environ 4 cases, **terrain conquis compris**, le temps de son passage, fines traînées qui tourbillonnent, poussière en spirale, anneau de photons et horizon noir absolu. Pas de disque façon Saturne ni de cercle en pointillés (retirés à la demande de Fabien). Le fil est courbé vers lui (`bend`, visuel) ; pendant l'emprise, le fil entre le trou et le vaisseau s'illumine et file vers le trou de plus en plus vite, avec un tourbillon (`drawSuck`). Horizon en couleurs inversées au-dessus du terrain. |
| `ghost` | **Spectre** (lavande, fantôme) | à conquérir | Comme une boule (6,6). Cycle de 6,4 s (`GHOST_T`, `ghostAlpha`) : visible 3,2 s, s'efface, **invisible** 2,2 s (toujours dangereux ; seul un petit scintillement le trahit), réapparaît. |
| `hunt` | **Chasseur** (rouge-rose, fléchette) | à conquérir | Tranquille (3,2) tant que le joueur est sur son terrain. Il ne le repère que s'il le **voit** (demande de Fabien, `huntSees`) : le vaisseau doit tracer, être **devant lui** (±50° autour de sa direction `e.hd`), à moins de **22 cases**, et **sans terrain conquis entre eux**. Un cône rouge très discret montre ce champ de vision. Une fois repéré (petit bip), `huntAI` : il freine et **vise** 0,6 s (il tremble, un **pointillé** file vers le vaisseau), **fonce** 0,5 s à 15 cases/s vers la position visée (images rémanentes), souffle 0,65 s, recommence. Rebondit sur le fil comme une boule (onde de choc). |
| `div` | **Diviseur** (orange, cellule) | à conquérir | Grosse cellule (5,2, rayon `DIV_R` 0,85). Chaque contact avec le fil déclenche l'onde de choc **et la coupe en deux** (`divSplit`), plus petites et 30 % plus rapides, **deux fois au plus** (4 morceaux). Deux noyaux tant qu'elle peut encore se diviser deux fois. Les morceaux naissent dans `spawned` et rejoignent `foes` après la boucle. |
| `puls` | **Pulsar** (cyan, étoile à rayons) | à conquérir | Presque immobile (1,4). Toutes les 3,6 s (`PULS_T`), il se **charge** 0,9 s (anneau qui se resserre, halo, rayons qui s'allongent), puis envoie une **onde circulaire** (12 cases/s, jusqu'à 11 cases). L'anneau **coupe le fil** qu'il traverse (onde de choc, `pulsarHits`) et **touche le vaisseau** s'il est dans la zone à conquérir (`hitPlayer(null)`). Sans effet sous Casque. |

Le **rongeur** (il grignotait le terrain) a été **retiré** et remplacé par ces quatre ennemis, à la demande de Fabien.

Tous les ennemis sont « polarisés » : leur dessin suit leur sens de déplacement (doc original). Rendu soigné (même niveau de finition que le vaisseau) : halo lumineux additif (`halo()`), œil qui regarde dans le sens du déplacement (`eye()`). **Boule** : orbe de plasma en dégradé, traînée de comète, légère déformation dans le sens du mouvement, reflet qui tourne. **Perforateur** : foreuse conique en dégradé, rainures en spirale qui défilent, pointe incandescente, sillage vert. **Gardien** : shuriken rose à deux couches qui tournent en sens inverse et pulsent, étincelles en orbite. Nouveaux ennemis : voir le tableau (dessins `drawPuls`, `drawHunt`, `drawDiv`, `drawGhost`, couleurs `T.puls/hunt/div/ghost`). Un contact avec le vaisseau passe par `hitPlayer` (Super Casque, Casque, zone protégée, Encaisseur, crash). Le Fulgurant vérifie aussi les contacts case par case pendant son éclair. Les ennemis de mer servent de graines au flood fill (`seaSeeds()`).

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

## Vaisseaux (idée de Fabien)

On choisit son vaisseau après « Nouveau jeu » (et avant le mode test), sur l'écran **VAISSEAU** (`showShips`). Le choix est mémorisé (`ship`) et sauvegardé avec la partie. Table `SHIPS` : nom, devise, vies, facteur de bonus, jauges de l'écran de choix, couleurs, et `body(g)` qui trace la coque (chaque vaisseau a sa silhouette). `SH()` donne le vaisseau en cours (`S.ship`). Base : 17 cases/s.

**Recharge des pouvoirs** (demande de Fabien) : aucun pouvoir ne se recharge avec le temps, **ni entre les niveaux** (la recharge de la frénésie, le bouclier de l'Encaisseur et la jauge du Rembobineur sont conservés d'un niveau à l'autre via `carry`, et sauvegardés dans `save.pow` via `powState()` ; une nouvelle partie repart à plein). Le bouclier de l'Encaisseur ne revient pas non plus en mourant. Ils se rechargent en **traçant dans la zone à conquérir** : chaque nouvelle case de fil appelle `seaStep()` (frénésie `FR_CELLS` = 100 cases, bouclier de l'Encaisseur `GUARD_CELLS` = 80, rembobinage `RW_CELLS` = 120). L'anneau du bouton de pouvoir montre la progression.

| Clé | Vaisseau | Vies | Particularité |
|---|---|---|---|
| `cla` | **Classique** (blanc, cockpit cyan) | 3 | Le vaisseau d'origine, sans particularité. |
| `rob` | **Robuste** (bleu, coque trapue, nez en chevron, nacelles blindées) | 4 | **25 % de bonus en moins** : chaque bonus prévu n'a que 3 chances sur 4 d'apparaître (dans `setupLevel`). |
| `fre` | **Frénétique** (corail, cockpit doré, très effilé) | 3 | **Frénésie** (`usePower`, état `ab`) : **5 s** à **+50 %** de vitesse (`stepTime`, `FR_T`), puis recharge en traçant **100 cases** (`ab.cd`, `FR_CELLS`). Pendant la frénésie, le vaisseau est **rouge vif** (« enragé », demande de Fabien) : aura rouge qui bat comme un cœur, fil et flamme rouges, bords de l'écran rougis, battements de cœur sonores qui accélèrent. **Touché par un ennemi pendant la frénésie : −2 vies** (`S.crashCost`, « −2 VIES » sous « CRASH ! »). Croiser son propre fil ne coûte qu'une vie (`crash('self')`). La frénésie s'arrête au crash (recharge lancée) et en fin de niveau. Bouton ⚡ dans le HUD, ou F / E au clavier. |
| `enc` | **Encaisseur** (violet, coque ronde, anneau de bouclier vert menthe en pointillés) | 2 | **Encaisse un coup** (`absorb`) : le premier coup d'ennemi ne le tue pas mais **l'arrête net** (l'ennemi est renvoyé, 1 s de répit `P.grace`). Le bouclier revient après **80 cases tracées** (`P.guard`, `GUARD_CELLS`) ; d'ici là, un 2ᵉ coup coûte une vie. Il revient aussi après un crash. Une **onde de choc qui rattrape la tête du fil compte comme un coup** (`waveStop`) : le fil est effacé, la conquête annulée, il s'arrête ; le bout de fil qu'il trace ensuite devient du terrain en arrivant **sans refermer de zone** (`P.noFill`). Anneau qui devient un arc rose pendant la vulnérabilité, puce « BOUCLIER », bouton bouclier (non cliquable) dans le HUD. |
| `ful` | **Fulgurant** (aiguille argentée, cockpit cyan, flamme bleu électrique) | **1, jamais plus** (`maxLives`) | Idée de Fabien. **Tracé éclair illimité** (c'est la contrepartie de la vie unique) : depuis son terrain **ou en plein vol** (le vaisseau s'arrête le temps de dessiner, le monde continue ; s'il abandonne, il reprend sa route, `planCancel`), on **dessine un trajet** (doigt posé sur le vaisseau ou à moins de 36 px, puis on glisse ; au clavier Maj, les flèches, puis Maj ou Entrée ; Échap ou Espace annule). Un pointillé cyan montre le trajet (`plan`, `planStep`, `planTo`, `drawPlan`). Au lâcher (`planLaunch`), le vaisseau le parcourt à **150 cases/s** (`DASH_V`, `updateDash` : chaque case est vérifiée, ennemis et bonus compris), soit environ un tiers de seconde pour 50 cases. Le trajet ne se croise pas, peut longer le terrain avant d'entrer dans la zone à conquérir et s'arrête à la première case de terrain qui suit (zone refermée aussitôt). S'il s'arrête dans la zone à conquérir, le vaisseau continue à vitesse normale. Traverser un ennemi = crash, donc fin de partie. Il se déplace normalement sinon. **Ni bonus Vie / Super Vie, ni Vitesse / Super Vitesse** (`noItems`, filtré dans `pickType`). |
| `fur` | **Furtif** (aile volante sombre, liserés turquoise, flamme turquoise) | 2 | Idée de Fabien. **Son fil est invisible pour les ennemis** : ils le traversent sans onde de choc (`onTrailHit` et `moveSea`), le trou noir ne l'avale pas (`grabTrail`), le diviseur ne s'y coupe pas, l'anneau du pulsar ne le coupe pas. Un ennemi qui touche le **vaisseau** le tue quand même. Contrepartie : de temps en temps (toutes les 6 à 13 s, pendant 2,5 à 4 s), **camouflage optique** façon MGS (`camo`, `updateCamo`, `camoOn`) : le vaisseau devient presque transparent et ondule comme de l'air chaud, avec un reflet qui glisse, et le chasseur ne le voit plus. Le bout du fil reste visible. Son de « cloak » / « decloak ». |
| `rew` | **Rembobineur** (cuivré, cadran autour de la coque, cockpit cyan) | **2, jamais plus** (`maxLives`) | Idée de Fabien, façon Prince of Persia. Une photo de la partie est prise toutes les 0,1 s pendant le jeu (`recordRewind`, `snap` : grille, fil, vaisseau, ennemis, onde, emprise du trou noir, bonus, pouvoirs, score, vies), sur les 3 dernières secondes. **Bouton ⏪** (ou F / E) : le temps **remonte en continu** à vitesse ×2 (phase `rewind`, `updateRewind`, `unsnap`, `RW_STEP`) avec un **effet cassette VHS** (teinte bleue, lignes de balayage, bande de bruit, ◀◀ REMBOBINAGE) ; **on rappuie pour s'arrêter** avant la fin. La **jauge** (`rw.charge`, 3 s au maximum, `RW_SPAN`) ne perd que le temps réellement remonté (0,1 s par photo). **Au crash**, si la jauge le permet (`canRewind`), le crash reste en suspens **3 s** (`RW_WIN`) avec « ◀◀ REMBOBINER ? » et un compte à rebours : appuyer sur le bouton, toucher le terrain ou F lance le rembobinage, et la vie perdue est rendue ; sinon, crash normal. Toucher le terrain pendant le rembobinage l'arrête aussi. Jauge rechargée en traçant (**120 cases** pour 3 s). Les photos sont effacées à la reprise après un crash et à chaque niveau. |
| `trap` | **Piégeur** (vert, deux pinces vers l'avant, cockpit jaune) | 3 | Proposé par Claude, retenu par Fabien. **Refermer une petite zone sur des ennemis les détruit** (`trapFoes`, appelé par `capture` avant le remplissage) : toute zone fermée qui contient des ennemis de mer, fait au plus **12 % du terrain** (`TRAP_MAX`) et n'est pas la plus grande zone restante, se referme sur eux (`trapFoe` : explosion, « PIÉGÉ ! », 300 × niveau par ennemi) et devient conquise. Les ennemis piégés sont **éliminés pour de bon** (demande de Fabien ; une première version les faisait revenir 15 s plus tard par un portail). Le trou noir et les gardiens ne se piègent pas. |

Arrêté dans la zone à conquérir (coup encaissé, Chrono), le vaisseau ne peut pas repartir en arrière sur son fil (on compare avec `P.face`).

**Interface** (atelier de 4 styles, Fabien a choisi « A · Néon Arcade » : https://claude.ai/artifact/2p9dD2ytaPYR6Lw8ughAx6) :
- **HUD** : à gauche, niveau et difficulté en petit (ou « MEGABOX CONQUEST » au menu, « MODE TEST · vaisseau »), **gros score**, vies en pilules roses horizontales ; à droite, **bouton de pouvoir rond** (`#pw`, `pwHud`, pour Frénétique, Encaisseur et Rembobineur) puis pause. Bouton de pouvoir : anneau en `conic-gradient` (variable `--p`). Frénétique : prêt (dégradé rose → orange, éclair, pulse), actif (rouge, anneau qui se vide), recharge (sombre, l'anneau se remplit en traçant). Encaisseur : bouclier vert, puis rose pendant la recharge. Rembobineur : ⏪ utilisable dès qu'il reste du temps dans la jauge (l'anneau montre la jauge), rouge pendant le rembobinage (appuyer l'arrête).
- **Écran VAISSEAU** : bouton retour, aperçu animé dans un canvas (`drawPreview`, appelée par `frame()` tant que `shipPick` existe : le vaisseau file vers le haut parmi des étoiles qui défilent), flèches ‹ ›, glisser sur l'aperçu ou ← → au clavier, nom dans la couleur du vaisseau, devise, jauges Vies / Vitesse / Bonus / Pouvoir, description, pagination, bouton « C'EST PARTI ».
- La coque est dessinée par `drawHull(g, sh, o)`, commune au jeu et à l'aperçu. Sur le terrain, la gemme carrée prend la teinte du vaisseau (`land`).
- L'écran d'info du premier niveau rappelle le pouvoir du vaisseau (`S.shipTip`) et affiche le vaisseau dans le récapitulatif.

---

## Écrans et interface

- **Menu** : choix de la difficulté, niveau de départ (jusqu'au plus haut atteint), Nouveau jeu (puis choix du vaisseau), **Continuer** (sauvegarde), **Mode test** (puis choix du vaisseau), record par difficulté, « Comment jouer ».
- **Écran d'info** avant chaque niveau et après un crash : niveau, difficulté, vies, objectif ou réalisé, score, présentation des nouveaux ennemis. **Pas de compte à rebours** (retiré à la demande de Fabien) : bouton PARTIR (toujours visible en bas de la carte) ou tap n'importe où.
- **Pause** uniquement via le bouton ⏸ en haut à droite du HUD (ou P/Échap au clavier), plus une pause automatique si l'onglet est masqué. Boutons REPRENDRE et QUITTER LA PARTIE (retour au menu ; la partie reste sauvegardée au début du niveau). Pas de chrono : jeu « tranquillou », sans limite de temps.
- **Game over** : si le record est battu, « FÉLICITATIONS ! VOUS AVEZ BATTU LE RECORD ! » (texte de l'original).
- **Écran** : bouton pour passer du thème `COULEUR` au thème `MYX-3` (monochrome bleu rétroéclairé, comme le vrai MyX-3). Tous les dessins passent par l'objet de thème `T`.
- **Son** : WebAudio synthétisé (aucun fichier audio), bouton ON/OFF.
- **Terrain** : 7 styles ont été essayés (grille Tron, cristal, holo, planète, couchant, rétro) ; Fabien a gardé le dégradé NÉON d'origine, le sélecteur a été retiré.
- **Zoom bloqué** : viewport `maximum-scale=1, user-scalable=no`, `touch-action: manipulation`, et un script qui annule le double tap rapide (hors boutons) et les gestes de zoom iOS.
- **Style** (demande de Fabien : plus joli, moins carré, arcade mais « smooth », couleurs modernes) : fond nuit avec halos violet/bleu, HUD et cartes en verre dépoli très arrondis (18-24 px), boutons en dégradé rose → orange (`--grad`) avec relief arcade et animation à l'appui, segments et puces en pilule, jauge en dégradé cyan → violet. Police pixel Silkscreen pour titres, chiffres et boutons ; Rubik pour les libellés et les textes. Terrain : dégradé lisse bleu → violet en diagonale (`landGrad`, `landColor()`), coins arrondis et halo autour du canvas. Zone à conquérir façon **espace** (`space: true`) : nébuleuses discrètes et ~170 étoiles tirées avec une graine fixe dans `drawBg`, plus 22 étoiles qui scintillent (`drawTwinkle`, seulement sur les cases vides). Formes adoucies : fil plus épais avec un halo doux et un centre en points ronds. **Vaisseau** redessiné (Fabien veut que tout « ait la classe » et soit fluide) : gemme carrée arrondie sur le terrain ; dans la zone à conquérir, coque effilée en dégradé, deux ailerons arrondis, cockpit cyan lumineux, flamme en dégradé qui ondule (sinus, pas d'aléatoire) et traînée de particules. **Rotation lissée** (`P.ang` rattrape la direction) avec une légère inclinaison dans les virages. Particules rondes en lumière additive, tremblement d'écran fluide (sinus), score qui défile (`tweenScore`). Interface : écrans en fondu (entrée et sortie, `hideOverlay` attend 200 ms), fond assombri derrière les cartes, dégradé qui glisse sur les titres, reflet qui balaie le bouton principal et la jauge, puces de pouvoirs qui apparaissent en douceur. Tout est coupé si l'appareil demande moins d'animations. Le thème MYX-3 garde son damier rétro. Les cartes n'animent leur entrée que si aucune n'était affichée (classe `in`). Le HUD ne descend jamais sous 343 px de large. La rangée des pouvoirs du HUD a une **hauteur fixe toujours réservée** (22 px, une seule ligne, textes tronqués si besoin) : quand elle apparaissait et disparaissait, la hauteur du terrain changeait et l'écran sautait à la fin d'un bonus (signalé par Fabien). `resize()` ne fait rien si la taille du canvas ne change pas.

### Contrôles (choix de Fabien, important)
- **Tactile** : **glisser** pour diriger, **un tap = s'arrêter** (sur son terrain). Un tap ne met **pas** en pause. Pas de croix directionnelle à l'écran (retirée à sa demande).
- **Clavier** : flèches ou ZQSD (AZERTY) / WASD, Espace = stop, P/Échap = pause, Entrée = valider, F ou E = pouvoir du vaisseau (frénésie, rembobinage), Maj = tracé éclair du Fulgurant (flèches pour dessiner, Maj ou Entrée pour lancer), ← → pour changer de vaisseau sur l'écran de choix.

### Mode test (bac à sable)
Bouton dans le menu. Vies infinies, pas d'objectif, pas de sauvegarde ni de record. On choisit son vaisseau. Une barre sous le terrain permet de faire apparaître chaque bonus près du joueur et d'ajouter chaque ennemi (dont pulsar, chasseur, diviseur, spectre), ainsi que Vider, Réinitialiser et Quitter. Pratique pour régler l'équilibrage.

---

## Score

10 points × niveau par case conquise, ×2 si on prend plus de 15 % d'un coup (« MEGA ! »). Fin de niveau : 1000 × (difficulté + 1) × niveau, plus 150 × niveau par point de pourcentage au-delà de l'objectif. Super Casque : 500 × niveau × combo par ennemi détruit. La formule de score de l'original était illisible dans le document : celle-ci est maison.

---

## Stockage (`localStorage`, préfixe `mbc2-`)

`theme`, `mute`, `diff` (dernière difficulté choisie), `ship` (dernier vaisseau choisi), `max0/1/2` (plus haut niveau atteint par difficulté), `best0/1/2` (record par difficulté), `save` (`{d, L, score, lives, ship, pow: {cd, guard, rw}}`, partie en cours, mise à jour au début de chaque niveau et effacée au game over ou à la victoire). Tous les accès sont protégés par `try/catch`.

---

## Organisation du code (`index.html`)

Le script est une IIFE découpée en sections commentées `/* ---------- … ---------- */` :

1. Constantes, `DIFFS`, `THEMES`, `ITEM`, `INTRO` (textes de présentation des ennemis)
2. **Stockage**, **Son** (`sfx.*`, `tone()`)
3. **Taille et dessin du terrain** : `resize()` avec un `ResizeObserver`. Trois canvas : `bg` (fond statique), `board` (cases conquises, redessiné entièrement par `drawBoard()` ou incrémentalement via `paintCellIdx()`), et le canvas principal. Le dessin se fait **en unités de case** grâce à `setTransform(scale…)`.
4. **Composition des niveaux** : `LEVELS`, `FOES`, `comp()`, `makeFoe()`
5. **Partie** : `newGame`, `continueGame`, `setupLevel`, `newPlayer`
6. **Fil** : `pushTrail`, `eraseK`, `dissolveTrail`, `cancelConquest`, `onTrailHit`, `updateWave`. Le fil est un tableau ordonné `trail` + `erased` + `trailPos` (index inverse).
7. **Joueur** : `setDir`, `stepPlayer`, `moveInto`, `updatePull` (trou noir), `playerPos` (interpolation + décalage visuel `vox/voy`)
8. **Conquête** : `capture()` (flood fill depuis les ennemis de mer, puis révélation animée en vague via `startReveal`), `awardCells`, `checkGoal`
9. **Ennemis** : `moveSea`, `huntAI`, `pulsarTick`/`pulsarHits`, `divSplit`, `ghostAlpha`, `moveLand`, `moveAmph`, `updateFoes`, `hitPlayer`, `smash` (Super Casque), `superOn`, `superMusic`
10. **Pouvoirs des vaisseaux** : `usePower`, piège (`trapFoes`, `trapFoe`), `updateAbility`, `seaStep` (recharge), `absorb`, `waveStop`, camouflage (`updateCamo`), rembobinage (`snap`, `unsnap`, `recordRewind`, `rewind`, `updateRewind`), tracé éclair (`planStart`, `planStep`, `planTo`, `planLaunch`, `updateDash`, `drawPlan`) ; **Crash** : `crash(cause)`, `updateCrash`
11. **Bonus** : `pickType`, `spawnItem`, `collect`, `territoryBurst`, `pushOut`, `updateItems`, `powersHud`, `pwHud`
12. **Boucle** : `update(dt)` (machine à états via `S.phase` : `title`, `ready`, `play`, `pause`, `crash`, `rewind`, `clearing`, `clear`, `over`) et `render()` avec les fonctions de dessin `draw*`
13. **HUD et écrans** : `hud`, `showOverlay`, `showReady`, `showClear`, `endScreen`, `titleScreen`, `showShips`, `drawPreview`, `togglePause`
14. **Mode test** : `testItem`, `testFoe`
15. **Contrôles** : clavier, swipe et tap sur le canvas

Le `dt` est plafonné à 0,05 s. Le ralenti du Super Casque multiplie `dt` dans `frame()`.

### Tester sans navigateur
Test de fumée : `node tools/smoke.js index.html`. Il extrait le `<script>`, l'exécute dans Node avec un faux `document`, un faux canvas (Proxy), une fausse horloge et un faux `requestAnimationFrame` (le `ResizeObserver` factice doit appeler `resize()`, sinon rien ne tourne). Il affiche la composition des niveaux, vérifie l'onde de choc (on s'échappe / on se fait rattraper), le bonus territoire, le trou noir, les super bonus, le chrono, la zone protégée, les 4 vaisseaux (bonus du Robuste, vitesse et vies de la frénésie, coups encaissés et onde de l'Encaisseur), les nouveaux ennemis (division, ruée du chasseur, anneau du pulsar), le Fulgurant (une vie, bonus filtrés, éclair, ennemi sur le trajet), le Furtif (fil invisible, camouflage), le Piégeur (ennemi piégé dans une petite zone, éliminé pour de bon), le Rembobineur (fenêtre de 3 s au crash, retour avec la vie rendue, arrêt anticipé qui économise la jauge, 2 vies max), les pouvoirs conservés entre les niveaux, puis simule 6000 frames avec des touches aléatoires à plusieurs niveaux, difficultés et vaisseaux, et joue les 25 niveaux un par un. Doit finir par `OK`. Lancer aussi `node --check` sur le script extrait après chaque modification. Pour tester dans le navigateur en local, passer par un serveur http (le service worker sert sinon l'ancienne version en cache : le désenregistrer d'abord).

---

## Écarts volontaires par rapport à l'original

- Objectifs 75/80/85 % au lieu de 75/65/55.
- 25 niveaux écrits un par un, avec des niveaux à thème et quatre ennemis inédits, et le joueur n'est jamais figé (ni par l'onde de choc, ni par le bonus territoire).
- Perforateur plus redoutable (transperce, onde foudroyante) au lieu de « coupe le fil et annule la conquête ».
- Amphibie transformé en trou noir qui aspire le vaisseau et avale le fil qu'il croise.
- Pas de vie offerte en fin de niveau.
- Nouveaux ennemis : spectre, chasseur, diviseur, pulsar (le rongeur, essayé un temps, a été retiré).
- Super Casque, Super Bombe, Super Vitesse et Super Vie (n'existent pas dans l'original).
- Bonus aléatoires sur tous les niveaux (0 à 3, moments imprévisibles) au lieu d'un bonus par niveau impair, et une durée de 10 s pour casque et vitesse (non précisée dans l'original).
- Score maison, contrôles tactiles, thème MyX-3 en option, effets modernes (particules, vague de remplissage, sons).

## Publication

- Dépôt public : https://github.com/Shopatat/megabox-conquest (branche `main`)
- Jeu en ligne (GitHub Pages, déployé automatiquement à chaque push sur `main`) : https://shopatat.github.io/megabox-conquest/
- CLI GitHub installée en `C:\Program Files\GitHub CLI\gh.exe` (connectée en `Shopatat`). Commits signés avec l'adresse noreply GitHub (config locale du dépôt).

## Pistes pour la suite

### Divers
- Équilibrage à affiner en jouant : nouveaux niveaux et nouveaux ennemis (rythme du pulsar, ruée du chasseur, invisibilité du spectre), vaisseaux.
- Design général à peaufiner (Fabien l'a évoqué sans détailler).
- Éventuellement l'écran d'intro et les « slides » de crash dessinés, comme prévus dans le doc original.
