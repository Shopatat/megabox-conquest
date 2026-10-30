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

## Budget
Plan Pro. Hebdo : 66 % au départ, 86 % à la fin de l'étape 4 (reset le 2 novembre). Le gros fan-out d'agents de
l'étape 1 a coûté 14 points pour 2 M de tokens (chaque agent paie le CLAUDE.md de 114 Ko à l'entrée) ; le travail
en direct a coûté 1 point par étape pour un résultat bien plus grand. **Leçon : sur ce projet, travailler en
direct, et réserver les agents aux audits en lecture seule où leur parallélisme paie vraiment.**

## Prochaine action
Reprendre l'audit de bugs sur les 22 zones restantes, en petits lots (5 agents à la fois), puis l'optimisation,
puis les compétences.
