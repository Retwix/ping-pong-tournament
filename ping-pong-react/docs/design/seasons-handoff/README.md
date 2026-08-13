# Handoff : « Les saisons »

## Overview
Ajout d'une **période compétitive de trois mois** à l'app ping-pong du bureau. Trois surfaces sont touchées :

1. **Accueil** (`src/components/Home.tsx`) — un **bandeau de saison** sous le LiveHero, qui porte les 6 états de vie d'une saison.
2. **« Le classement »** (`src/components/Ratings.tsx`) — un **en-tête de saison** + un **sélecteur de portée** (saison en cours / saison passée / tous les temps), et une carte de rail **« Course au titre »** qui rend le seuil des 10 parties découvrable pendant la saison.
3. **« Les stats »** (`src/components/Stats.tsx`) — une chip de période supplémentaire, « Cette saison ».

Aucun changement backend : tout mappe sur des données déjà calculées. Spec moteur : `docs/superpowers/specs/2026-08-12-seasons-design.md`.

## About the Design Files
Les fichiers de ce dossier sont des **références de design réalisées en HTML** — des prototypes qui montrent l'apparence et le comportement attendus. **Ce n'est pas du code de production à copier tel quel.**

La tâche est de **recréer ces designs dans le codebase cible** (React/TypeScript) avec ses patterns et ses librairies existantes.

Détails techniques du prototype, à titre indicatif seulement :
- petit runtime maison (`support.js`) avec `<sc-if>`, `<sc-for>` et une classe `Component extends DCLogic`. **Ne pas porter ce runtime.**
- tout le style est en `style="…"` inline, volontairement. Le prototype duplique l'arbre entier en clair et en sombre (`sc-if isLight` / `isDark`) — **ne pas reproduire cette duplication** : dans le codebase, un seul arbre + les tokens de thème.
- les données sont des seeds en dur. À remplacer par l'API réelle.

Fichiers : `Tournoi ping-pong app.dc.html` (prototype complet de l'app, saisons incluses), `StatsPage.dc.html` (page stats, chip « Cette saison »), `PlayersPage.dc.html`, `support.js` (runtime, à ne pas porter), `DESIGN-SYSTEM.md` (source de vérité des valeurs), `RESPONSIVE.md` (paliers).

**Comment voir les états :** le prototype expose une prop `seasonState` (`pre` · `noleader` · `running` · `final` · `closed` · `nochamp` · `empty`), section « Saisons » du panneau de tweaks. La portée du classement (`current` / `s0…s5` / `all`) se pilote en cliquant le sélecteur sur la page Classement.

## Fidelity
**High-fidelity.** Aucune valeur nouvelle : couleurs, typos, rayons, ombres viennent du design system existant (`DESIGN-SYSTEM.md`). Un seul ajout de palette : **l'or `#E8B53A`**, déjà utilisé dans l'app pour la 1re place, promu ici en accent de titre (anneau d'avatar, filet 3px, badge CHAMPION).

---

## Décisions prises (les 3 questions ouvertes)

1. **Bandeau = bande pleine largeur sous le LiveHero, pas une carte de rail.**
   Le rail porte déjà trois cartes denses (Top joueurs, Séries & records, et maintenant rien de plus). Surtout, la saison a besoin de **place horizontale** : nom + fenêtre + meneur + Elo + progression + compte à rebours tiennent sur une ligne, et l'état champion a besoin d'un podium.
   **Il ne concurrence jamais un match en direct** : le hero est plus haut, coral saturé, avec un point qui pulse ; la bande est un aplat lavande calme, posée **dessous**. Hiérarchie : direct > saison > le reste. Quand il n'y a pas de match, la bande devient naturellement le premier objet de la page — ce qui est correct.
   Implémentation : la bande est la **première rangée de la grille 2fr/1fr** (`grid-column: 1 / -1`), pas un élément séparé — elle hérite du gap de 20px.

2. **L'état champion a son propre traitement, pas celui du tournoi.**
   Pas de confettis, pas de `Champion.tsx`, pas de `FinalStandingsCard`. Un tournoi se gagne devant témoins et se célèbre pendant dix minutes ; une saison se gagne à minuit sans personne, et le bandeau **reste à l'écran trois mois**. Des confettis seraient périmés au bout d'un jour et fatigants au bout d'une semaine.
   Le traitement retenu est une **plaque** : dégradé violet profond (`#2C1258 → #4A2AA4 → #5B39C4`), filet or de 3px en haut, avatar 64px cerclé d'or, badge `CHAMPION · PRINTEMPS 2028` en or, 2e et 3e en pastilles de verre. Ça tient le lendemain matin **et** au bout de trois mois.

3. **« Cette saison » ne rend pas « Ce mois-ci » redondant.**
   Une saison fait trois mois : c'est une granularité franchement différente du mois. Ordre retenu, du plus large au plus étroit : **Tout · Cette saison · Ce mois-ci · Cette semaine**. « Cette saison » est en 2e position parce que c'est le cadre de référence par défaut du produit une fois les saisons lancées.

---

## 1 · Bandeau de saison (Accueil)

Placé sous le LiveHero, au-dessus de la grille de contenu. Cinq formes, sept états.

### Forme A — « en cours » (états 2, 3, 4)
Bande `border-radius:18px`, `padding:14px 20px 14px 16px`, fond `linear-gradient(100deg,#F4F0FD 0%,#FBF9FE 58%,#FDF2F5 100%)`, bordure `#E8E4F2`, ombre `0 3px 12px rgba(32,10,66,.05)`.
Contenu, de gauche à droite :
- tuile 38px r12 blanche + icône trophée (stroke `#4A2AA4`) ;
- **nom de la saison** (Outfit 800 15px) + **fenêtre** (`1 mars → 31 mai 2028 · reparti de 1500`, DM Sans 600 12px `#847E96`) ;
- séparateur 1px × 36px ;
- **meneur** : avatar 36px, nom Outfit 800 15px, Elo Outfit 800 14px `#4A2AA4`, ligne d'état dessous ;
- **pastille de progression** (état 2 seulement, voir §5) ;
- **compte à rebours** + lien « Le classement → ».

| État | Ligne du meneur | Pastille compte à rebours |
|---|---|---|
| 2 · pas de meneur éligible | `En tête · 6 parties sur 10` | `J-78`, violet `#F0ECFB` / `#4A2AA4` |
| 3 · meneur connu | `Meneur · 14 parties · éligible au titre` | `J-42`, violet |
| 4 · derniers jours | `Meneur · 21 parties · éligible au titre` | `Fin dans 3 jours`, coral `#FEE7EE` / `#D74251`, bordure `#FBD4D9`, point 6px `animation:rvpulseC 2s infinite` |

**Sur l'état 4 (urgence) :** l'urgence est **contenue à la pastille**. Rien d'autre ne change — pas de bande coral, pas de compte à rebours géant. Argument : une fin de saison n'est pas un événement à la seconde ; c'est une échéance qu'on veut voir, pas subir. Une bande coral entrerait en plus en conflit direct avec le LiveHero, qui est la seule chose du produit autorisée à crier. Le point qui pulse suffit à faire tourner la tête ; le mot « Fin dans 3 jours » fait le reste.
Déclencheur : `daysLeft <= 7`.

**Vocabulaire :** en état 2 le meneur est « **En tête** », jamais « Champion », jamais « Leader » en gras doré. Le mot champion n'apparaît qu'à l'état 5.

### Forme B — « champion » (état 5)
`border-radius:20px`, dégradé `105deg,#2C1258 0%,#4A2AA4 58%,#5B39C4 100%`, ombre `0 18px 44px rgba(74,42,164,.26)`, halo `radial-gradient(70% 130% at 86% -20%, rgba(232,181,58,.28), transparent 58%)`, filet supérieur 3px `linear-gradient(90deg,#E8B53A,#F3D179,#E8B53A)`.
- avatar 64px, bordure **3px `#E8B53A`** ;
- badge `CHAMPION · PRINTEMPS 2028` — Outfit 800 9px, `.14em`, texte `#17082B` sur `#E8B53A`, r999 ;
- nom Outfit 800 26px blanc ; sous-ligne `1612 Elo · 21 parties · 17 victoires` ;
- **podium 2/3** : deux pastilles `rgba(255,255,255,.1)`, bordure `rgba(255,255,255,.16)`, r13 — rang, nom, Elo ;
- CTA blanc « Le classement final → » + ligne `Saison Été 2028 · départ le 1er juin, tout le monde à 1500`.

Cette dernière ligne est importante : elle **désamorce la stagnation**. Au bout de trois mois d'affichage, le bandeau ne dit plus seulement « Léo a gagné », il dit « et voilà quand ça repart ».

### Forme C — « terminée sans champion » (état 6)
Carte blanche neutre, r18, icône trophée grise.
> **Saison Printemps 2028 — terminée sans champion**
> Personne n'a atteint 10 parties. Le titre reste vacant : Clara finit en tête avec 1531 Elo.

**Un fait, pas un échec.** Pas de coral, pas d'icône d'alerte, pas de « malheureusement ». Le meneur est nommé et crédité — il a fini en tête, ce n'est simplement pas un titre. **Ne jamais sacrer un joueur provisoire par défaut.**

### Forme D — « avant-saison » (état 1)
Le seul état visible au lancement. Fond `linear-gradient(100deg,#F4F0FD,#FDF2F5)`, icône calendrier.
> **La première saison commence le 1er septembre**
> « Saison Automne 2026 » — trois mois, tout le monde reparti de 1500. D'ici là, le classement reste celui de tous les temps.

Pastille `Dans 12 jours`. Dans cet état, le sélecteur de portée n'a **qu'une** entrée (« Tous les temps ») et la portée y est forcée.

### Forme E — « saison sans aucune partie » (état 9)
Motif d'état vide existant : fond `rgba(255,255,255,.66)`, **bordure 1.5px pointillée `#CDBDF0`**, CTA plein « + Lancer la première ». Reprend exactement le pattern des cartes « Nouveau » de l'accueil.

### Sombre
Mêmes structures. Fonds : bande en cours `linear-gradient(100deg,#241546,#1E1138,#2A1440)`, carte neutre `#1E1138`, bordures `rgba(255,255,255,.08–.12)`, texte `#fff` / secondaire `#A99FC4`, violet clair `#C4B4F0`, coral clair `#FF8E9C`, vert `#5FD9A6`. La plaque champion passe à `241046 → 3E2190 → 5B39C4`, l'or reste **identique** (`#E8B53A`) — c'est l'ancre de la célébration dans les deux thèmes.

---

## 2 · En-tête de saison (« Le classement »)

Sous le titre `Classement Elo` (32px), une ligne : **[sélecteur de portée] + phrase d'identité**.

Le sélecteur porte un badge d'état :
- `EN COURS` — vert `#E6F6EF` / `#2BA572` (sombre `rgba(43,165,114,.18)` / `#5FD9A6`)
- `TERMINÉE` — violet `#F0ECFB` / `#4A2AA4` (saison en cours mais close)
- `ARCHIVE` — contour `#E8E4F2`, texte `#847E96`

Phrase d'identité (DM Sans 600 13px `#847E96`), une par cas — **le tableau en dessous n'est jamais ambigu** :

| Portée | Phrase |
|---|---|
| saison en cours | `1 mars → 31 mai 2028 · reparti de 1500 · J-42 · mise à jour il y a 20 min` |
| saison close (5) | `Saison terminée le 31 mai · classement final, figé` |
| saison close (6) | `Saison terminée le 31 mai · aucun joueur n'a atteint 10 parties` |
| saison sans partie | `… · aucune partie jouée pour l'instant` |
| saison passée | `Archive · 1 déc → 29 fév · champion Thibault` (ou `· aucun champion`) |
| tous les temps | `Depuis le tout premier match · 148 parties · aucune remise à zéro` |
| avant-saison | `Aucune saison en cours — le classement de tous les temps fait foi jusqu'au 1er septembre.` |

**États 7 et 8 :** une archive est en **lecture seule** — le badge `ARCHIVE`, le mot « Archive » en tête de phrase et le passé composé suffisent ; pas de bandeau d'avertissement, pas de grisé sur le tableau (un tableau grisé se lit mal, or on vient là pour le lire). En « Tous les temps », **aucune chrome de saison** : pas de badge, pas de compte à rebours, pas de carte « Course au titre » — c'est le classement d'aujourd'hui, inchangé.

---

## 3 · Sélecteur de portée

Bouton r13 (blanc / `#1E1138`), icône calendrier 16px, libellé Outfit 700 14px, badge d'état, chevron. Ouvre un **menu déroulant** en `position:absolute; top:56px; left:0`, largeur **352px**, r16, ombre `0 22px 54px rgba(32,10,66,.18)`, padding 8px, `z-index:46`, précédé d'un voile `position:fixed; inset:0; z-index:45` qui ferme au clic extérieur.

Trois zones, séparées par des filets 1px :
1. **`SAISON EN COURS`** (Outfit 700 10px `.12em` `#A49EB3`) — une entrée : nom + sous-ligne (`J-42 avant la fin` / `Terminée · classement final` / `Aucune partie`). Absente en avant-saison.
2. **`SAISONS PASSÉES`** — liste **scrollable `max-height:216px`**, plus récente en premier ; chaque ligne : nom à gauche, `Champion Thibault` ou `Aucun champion` à droite en `#847E96`. C'est ce qui fait tenir ~20 entrées : la zone qui grandit est la seule qui scrolle, les deux autres restent ancrées.
3. **`Tous les temps`** — épinglé en bas, sous-ligne `Depuis le premier match · sans remise à zéro`.

Sélection active : fond `#F0ECFB` (sombre `rgba(134,99,233,.18)`). Hover `#F7F5FD` / `rgba(255,255,255,.05)`.

**Pourquoi pas un segmenté :** 9 entrées fin 2028, ~20 en 2031, et ça ne décroît jamais. **Pourquoi pas une recherche :** à 20 entrées un scroll de 5 lignes est plus rapide qu'un champ à remplir ; ajouter la recherche le jour où la liste dépasse ~25 entrées.

Le champion affiché à droite de chaque ligne remplace le palmarès (hors scope v1) : l'archive **est** le palmarès, en un coup d'œil.

---

## 4 · Chip « Cette saison » (Stats)

`periods = [Tout, Cette saison, Ce mois-ci, Cette semaine]` — même segmenté, même style, aucun changement de composant. Le libellé de filtre actif (`pLabel`) et l'état vide reprennent la valeur.
Point d'attention implémentation : le filtre saison porte sur la **fenêtre de la saison en cours**, pas sur « les 90 derniers jours ». En avant-saison, la chip est masquée (il n'y a pas de saison).

---

## 5 · Éligibilité — le seuil des 10 parties

Le mot « provisoire » existait déjà pour « moins de 5 parties, pas encore classé ». Il porte maintenant **un second sens** : « pas éligible au titre ». Trois affordances, du plus discret au plus explicite :

**a. Carte de rail « Course au titre »** — la principale. Visible uniquement sur la portée « saison en cours ».
- titre Outfit 800 16px + badge `10 PARTIES MINIMUM` ;
- phrase : *« Le titre demande 10 parties dans la saison. En dessous, un joueur reste "provisoire" — même en tête du tableau. »* (version close : *« … Voilà où chacun a fini. »*) ;
- 4 lignes : nom (72px) · **barre de progression** 6px r999 (`width: n*10%`, remplissage `#4A2AA4`, **`#2BA572` une fois à 10**) · `14 / 10` · `Éligible` ou `4 parties`.

Une barre qui se remplit dit la règle sans l'énoncer, et le vert dit « c'est acquis ». C'est la réponse au « découvrable pendant la saison, pas appris à la fin ».

**b. Pastille dans le bandeau** (état 2 seulement) — barre 56px + `6 / 10 parties avant le titre`, `title=` en survol : *« Il faut 10 parties dans la saison pour pouvoir être sacré champion. »* Elle ne s'affiche que quand le meneur **n'est pas** éligible : le reste du temps, c'est du bruit.

**c. Ligne de pied du tableau** — remplace l'ancienne :
> Deux seuils : un joueur entre au classement après 5 parties (avant cela son Elo provisoire s'affiche en gris), et il lui en faut 10 dans la saison pour pouvoir être sacré champion.

---

## Données attendues

```ts
type SeasonPhase = 'pre' | 'running' | 'closed';

type Season = {
  id: string;
  label: string;        // « Saison Printemps 2028 »
  window: string;       // « 1 mars → 31 mai 2028 »
  startsAt: string; endsAt: string;
  championId: string | null;   // null = aucun champion (état 6)
};

type SeasonBanner = {
  phase: SeasonPhase;
  season: Season;
  daysLeft: number;            // pilote J-n, « Fin dans n jours » (<=7), « Dans n jours » (pre)
  matchCount: number;          // 0 => état 9
  leader: { id, name, initials, rating, games } | null;  // null => état 9
  podium: [P, P, P] | null;    // état 5 uniquement
  nextSeason: { label, startsAt } | null;
};

type LadderScope = { kind: 'current' | 'past' | 'lifetime'; seasonId?: string };
```

Dérivations d'état (ordre d'évaluation) :
```
phase === 'pre'                          -> état 1
matchCount === 0                         -> état 9
phase === 'running' && leader.games < 10 -> état 2
phase === 'running' && daysLeft <= 7     -> état 4
phase === 'running'                      -> état 3
phase === 'closed' && championId         -> état 5
phase === 'closed'                       -> état 6
```
`Éligible ⇔ games >= 10` (parties **de la saison**, pas à vie). Le champion est le 1er du classement **parmi les éligibles**.

## Responsive
Voir `RESPONSIVE.md` pour les paliers généraux. Spécifique aux saisons, sous **1024px** :
- le bandeau passe en colonne : ligne 1 nom + compte à rebours (`justify-content:space-between`), ligne 2 meneur, séparateur vertical supprimé, lien « Le classement → » en pleine largeur en bas ;
- la plaque champion passe en colonne : avatar + nom, puis podium 2/3 empilé, puis CTA pleine largeur ;
- le menu du sélecteur passe en `width:100%` (calé sur la largeur du conteneur, plus 352px fixes) ;
- « Course au titre » descend sous le tableau avec le reste du rail ;
- cibles tactiles : lignes du menu `min-height:44px`.

## Hors scope v1
Palmarès dédié · groupement des saisons dans « Les parties » · badges/paliers/promotion · UI d'admin (la cadence est en dur) · notifications Slack ou e-mail à la clôture.
