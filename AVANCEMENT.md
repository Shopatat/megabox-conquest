# AVANCEMENT — grosse révision (session du 29 octobre 2026)

## Objectif de la session
Demande de Fabien, en une grosse session « ultracode » :
1. Un **boss thématique, classe et difficile** après la 3e étape de chaque planète → **un niveau en plus par planète** (8 planètes × 4 niveaux = 32 niveaux au lieu de 25).
2. **Chasse aux bugs** générale.
3. **Optimisation** du jeu.
4. **Mise en place des ennemis et objets** déjà validés précédemment (hypothèse retenue : la piste **roguelike à graine est exclue**).
5. **Compétences / arbres de maîtrise** : revoir l'utilité et l'échelonnage, muscler ce qui est timide, dégager l'anecdotique et le redondant.
6. **Musique dynamique plus atmosphérique**, moins entêtante.
7. **Bruitages plus doux et agréables**.

## Budget
- Plan Pro. Au départ : fenêtre 5 h à **2 %**, hebdo **66 %** (reset le 2 novembre).
- Le frein est l'hebdo : ~29 points utilisables avant le filet de sécurité à 95 %.
- Règle : remesurer `get_usage` avant chaque étape, ne jamais lancer une étape qui risque de ne pas finir.

## Plan découpé (une étape = autonome, test de fumée + commit à la fin)
| # | Étape | État |
|---|---|---|
| 1 | Audit multi-agents : bugs (chasseur + sceptique par zone), perfs, pertinence des 198 compétences | en cours |
| 2 | Corrections des bugs confirmés | à faire |
| 3 | Structure 32 niveaux (8 × 3 étapes + 1 boss) | à faire |
| 4 | Les 8 boss thématiques | à faire |
| 5 | Les 16 ennemis de planètes + universels proposés | à faire |
| 6 | Refonte des compétences | à faire |
| 7 | Audio : musique atmosphérique + bruitages plus doux | à faire |
| 8 | Optimisation, finitions, CLAUDE.md, push | à faire |

## Décisions prises
- « J'exclue juste la graine » → la piste roguelike / runs à graine est laissée de côté.
- Ordre des étapes : la demande phare (les boss) passe avant les ennemis, pour que le jeu soit livré cohérent même si le quota s'épuise.
- Un seul fichier `index.html` → les agents **conçoivent et auditent en parallèle**, l'intégration est faite en série pour éviter les conflits.

## Prochaine action
Dépouiller l'audit, trier les bugs confirmés, corriger.
