# AVANCEMENT — grosse révision (session des 29-30 octobre 2026)

## Objectif de la session
Demande de Fabien, en une grosse session « ultracode » : un boss par planète, chasse aux bugs, optimisation,
mise en place des ennemis et objets validés, révision des compétences, musique plus atmosphérique, bruitages
plus doux. Hypothèse retenue et annoncée : « j'exclue juste la graine » = la piste roguelike à graine est exclue.

## Fait, testé et commité
1. **12 corrections de bugs** (`ff4de80`), toutes vérifiées dans le code avant correction. La plus grave :
   l'onde de choc qui rattrape la tête du fil sous Casque n'était jamais soldée — elle restait active, rasait
   chaque nouvelle case tracée et tuait d'un coup à la fin du pouvoir. Aussi : `isUlt` cherchait l'ultime dans
   tous les arbres (les identifiants partagés coûtaient 3 points au lieu d'1, d'où des points négatifs et plus
   aucune compétence plaçable), la sauvegarde de `setupLevel` perdait `S.usedGame`, Fil fragile tuait sur la
   foudre et les météores, et trois défauts de CSS.
2. **Les 8 boss et le passage à 32 niveaux** (`d19a2c0`). 8 planètes × 4 niveaux. Moteur complet : trois noyaux
   à enfermer, phases, attaques obligatoirement annoncées (plancher de 0,45 s imposé par le moteur),
   `bossTier()` pour la montée en difficulté, `bossReclaim` pour qu'on ne gagne pas à l'usure, HUD des noyaux,
   rembobinage, crash et reprise, migration des sauvegardes. Les 8 boss ont chacun une mécanique de combat
   différente (voir CLAUDE.md, section « Les boss »).
3. **Audio** (`8b4c50c`). `tone()` refondue (filtre par voix, enveloppe douce, désaccord, réverbération courte,
   limiteur) sans toucher aux 60 appels de `sfx`, plus 11 bruitages réécrits. Musique recomposée : grilles de
   8 accords, mélodies qui respirent (8 mesures jouées / 8 mesures tues), plus de doublage criard à l'octave,
   batteries clairsemées, 5 instruments d'atmosphère, réverbération de 3,6 s. 18 % de notes en moins.
4. **Les 14 ennemis de planète** (`1953606`, `98390d6`). Plus aucune doublure : `STANDIN` est vide et le test
   vérifie qu'aucune planète ne cite un ennemi inexistant.

## Reste à faire (pas commencé)
- **Chasse aux bugs : seulement 3 zones sur 25 ont été auditées.** Le gros fan-out d'agents a été coupé par la
  limite de session. Les 22 zones restantes (conquête, boucle de jeu, bonus, écrans, pouvoirs des vaisseaux, et
  les 5 audits transverses : grille fine, sauvegarde, crash, vaisseaux × planètes, maîtrise) n'ont pas été
  passées. C'est la première chose à reprendre.
- **Optimisation** : rien n'a été fait. L'audit de perfs n'a pas tourné.
- **Compétences / arbres de maîtrise** : rien n'a été fait. L'audit de pertinence des 198 compétences n'a pas
  tourné. Attention : le correctif de `skCost` a changé le coût réel des identifiants partagés, donc des arbres
  sauvegardés peuvent maintenant avoir des points libres en plus.
- **Équilibrage** : les 8 boss et les 14 ennemis n'ont jamais été joués par un humain, seulement par le test de
  fumée. Voir « Pistes pour la suite » dans CLAUDE.md.

## Budget : la leçon de la session
Plan Pro. Hebdo : **66 % au départ, 95 % à l'arrêt** (reset le 2 novembre). Le détail compte, parce qu'il change
la façon de travailler sur ce projet :

| Ce qui a été fait | Coût | Résultat |
|---|---|---|
| Fan-out de 34 agents (audit initial) | **14 points**, 2 M de tokens | 3 zones sur 25 (la limite de session a tué les 31 autres) |
| Fan-out de 10 agents (conception des boss) | compris dans les 14 | 1 spec sur 10 (le reste tué) |
| Fan-out de 6 agents (relecture du code neuf) | **7 points**, 1,07 M de tokens | **rien du tout**, les 6 tués par la limite |
| Travail en direct (bugs, boss, audio, ennemis, doc) | **~5 points en tout** | 6 commits, 2 141 lignes neuves, tout testé |

**Leçon, à appliquer la prochaine fois : ne pas utiliser de sous-agents sur ce projet.** Chaque agent paie le
CLAUDE.md (114 Ko, ~30 k tokens) à l'entrée avant d'avoir lu une ligne de code, et un fan-out qui se fait couper
par la limite de session perd TOUT (les agents en vol ne rendent rien). Le travail en direct a été environ
**quinze fois plus productif par point d'usage**. Si un audit en parallèle est vraiment souhaité, le faire par
lots de 3 ou 4 agents maximum, et vérifier l'usage entre chaque lot.

## Prochaine action (session suivante, après le reset du 2 novembre)
1. **Relire le code écrit aujourd'hui** : 2 141 lignes neuves (moteur de boss et 8 modules, 14 ennemis, audio
   refondu, intégration des 32 niveaux) n'ont été relues par personne. Le test de fumée passe mais ne couvre pas
   tout. À faire en direct, zone par zone, en commençant par le moteur de boss et l'intégration.
2. **Jouer** : les 8 boss et les 14 ennemis n'ont jamais été vus par un humain. C'est l'équilibrage qui manque.
3. Puis l'audit des 22 zones de code ancien, l'optimisation, et les compétences.
