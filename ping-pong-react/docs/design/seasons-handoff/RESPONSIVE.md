# Responsive — Tournoi ping-pong (spec d'implémentation)

Complète `DESIGN-SYSTEM.md` (valeurs figées) et ne les modifie pas. Sources : `Tournoi ping-pong app.dc.html` (desktop, clair + sombre) pour ≥ 1024px, `Dashboard A - mobile.dc.html` pour ≤ 767px.

Principe : **une seule base de code, trois paliers.** On ne redessine rien, on change (1) le nombre de colonnes, (2) la navigation, (3) 4 tokens de densité. Tout le reste (couleurs, rayons, ombres, typo de composant) est identique aux trois paliers.

---

## 1. Paliers

| Nom | Plage | Colonnes de contenu | Navigation |
|---|---|---|---|
| `mobile` | ≤ 767px | 1 | Barre basse sticky 4 onglets + FAB |
| `tablet` | 768 – 1023px | 2 | Header glass, 4 onglets, bouton « + » sans libellé |
| `desktop` | ≥ 1024px | 2fr / 1fr | Header glass complet (référence actuelle) |

Écriture : **mobile-first**, deux media queries montantes uniquement.

```css
/* base = mobile */
@media (min-width: 768px) { /* tablet */ }
@media (min-width: 1024px) { /* desktop */ }
```

Pas de query intermédiaire, pas de `max-width`. Largeur max du contenu **1320px**, padding latéral : 14px mobile · 20px tablet · 24px desktop.

### Tokens de densité (les seuls à varier)

| Token | mobile | tablet | desktop |
|---|---|---|---|
| `--pad-x` (gouttière de page) | 14px | 20px | 24px |
| `--gap` (grille principale) | 12px | 16px | 20px |
| `--gap-block` (bloc → bloc) | 15px | 18px | 22px |
| `--r-card` | 14px | 16px | 16px |

Rayons des grandes surfaces : hero 18px mobile → 22px dès 768px. Cadre 24px inchangé.

---

## 2. Grilles — comportement par déclaration

Chaque grille existante du desktop et sa version repliée. Toujours via `grid-template-columns`, jamais de `flex-wrap` sur les cartes (le wrap casse l'alignement des hauteurs).

| Où | desktop (actuel) | tablet | mobile |
|---|---|---|---|
| Corps de page Accueil / Classement | `2fr 1fr` | `1fr` empilé, le rail passe **sous** la colonne principale | `1fr` |
| Cartes de parties (composant C) | `repeat(3,1fr)` | `repeat(2,1fr)` | `1fr` |
| Tuiles de stats Classement | `repeat(3,1fr)` | `repeat(3,1fr)` (padding 14/16) | `repeat(3,1fr)` **compact** : chiffre 22px, libellé 10px |
| Podium | `1.16fr 1fr 1fr` | `1fr 1fr 1fr` | `1fr` — carte leader pleine largeur, 2 et 3 en `1fr 1fr` en dessous |
| Hero live | `150px / 1fr / 158px` | `1fr / auto` : méta en ligne au-dessus, actions pleine largeur sous le matchup | idem tablet, boutons empilés, score 42px |
| En-tête de page (titre + actions) | `flex` space-between | idem | titre au-dessus, actions en ligne dessous, `gap:8px` |
| Modale Elo | `width:600px` | `width:600px; max-width:100%` | plein écran : `inset:0`, r0, padding `20px 16px 24px`, header sticky |

Règle d'or : toute grille à colonnes fixes en px (hero, rail) devient `1fr` avant 1024px. Toute grille en `repeat(n,1fr)` perd une colonne par palier, jamais deux.

---

## 3. Navigation — les seuls composants réellement dupliqués

### Header (≥ 768px)
Le glass décrit en §Header de `DESIGN-SYSTEM.md`, inchangé. Sur tablet :
- padding `10px 14px`, gap des onglets 2
- le split « + Nouveau ▾ » perd le libellé → bouton carré 36px avec « + » seul
- le segmenté clair/sombre reste (30px)
- les 4 onglets (**Accueil · Classement · Stats · Joueurs**) tiennent sur une ligne à tous les paliers ≥ 768px — pas de menu « ⋯ »

### Barre basse (≤ 767px)
Spec figée §Mobile de `DESIGN-SYSTEM.md` : 4 onglets flex 1, FAB central 52px, `padding:8px 10px 24px` (safe-area), cible ≥ 44px. À ajouter :
```css
padding-bottom: calc(8px + env(safe-area-inset-bottom));
```
Le contenu de page réserve `padding-bottom:96px` pour ne pas passer sous la barre.

Les 4 onglets de la barre basse correspondent exactement aux 4 onglets du header : aucune section n'existe sur un palier et pas sur l'autre.

### Header mobile
Logo tuile 30px + wordmark 17px à gauche, rond 34px (thème) à droite. Pas de hamburger — la nav vit en bas.

---

## 4. Composants — quoi faire palier par palier

| Réf. | Composant | Adaptation |
|---|---|---|
| A | En-tête de section | Inchangé. Le lien « tout voir → » reste sur la même ligne (ne jamais le passer sous le titre). |
| B | Badges | Inchangés aux 3 paliers (9px/1, .08em). Ne pas réduire. |
| C | Carte de partie | mobile : padding 14, r14, titre 15px, méta 12px. La corbeille au hover devient **swipe-gauche** ou un bouton visible 24px (pas de hover sur tactile). |
| D | Liste de résultats | mobile : avatar 28, chevron conservé, `padding:11px 10px`. La phrase passe sur 2 lignes — `text-wrap:pretty`, jamais de troncature du nom. |
| E | Ligne de classement | mobile : rang 20px, avatar 28, Elo 15px, delta 38px. Sous 380px : masquer le delta, garder rang / avatar / nom / Elo. |
| F | Avatars | 60 → 44 (hero mobile) · 34 → 30 (rail/liste) · 28 (listes denses mobile). Bordure blanche 3px → 2.5px. |
| G | Tuiles & faits marquants | 1 colonne dès mobile, rangée pleine largeur, tuile d'icône 32px inchangée. |
| H | Bande d'invitation | mobile : icône + titre + explication empilés, actions pleine largeur (primaire puis secondaire), r18 conservé. Toujours présente : le haut de page ne se vide jamais. |
| — | Rail Elo | Sur < 1024px, il devient un bloc de contenu normal placé après la colonne principale, pas un panneau latéral, pas un tiroir. |
| — | Tableaux (Stats, Joueurs) | Jamais de scroll horizontal caché. mobile : conversion en **liste de cartes** (une carte par ligne, libellé + valeur en paires) — pattern déjà utilisé par la liste de résultats D. |

---

## 5. Tactile vs pointeur

- Tous les états `:hover` (ligne `#F2EFFB`, carte `translateY(-2px)`, corbeille .5→1) sont enveloppés dans `@media (hover:hover)`. Sur tactile, seul `:active` (`scale(.98)`, 140ms) subsiste.
- Aucune action ne doit être **accessible uniquement** au hover : la corbeille et les menus « ⋯ » ont un équivalent visible sous 1024px.
- Cible minimale 44×44px partout, y compris le chevron des lignes de liste (zone cliquable = la ligne entière).
- `-webkit-tap-highlight-color: transparent` sur les éléments interactifs, remplacé par le `:active` maison.

---

## 6. Type — échelle fluide, uniquement là où c'est utile

Trois valeurs seulement passent en fluide ; tout le reste est fixe (les tailles de composant sont des tokens, pas des variables d'écran).

| Rôle | Formule |
|---|---|
| Titre de page (32px) | `clamp(24px, 5vw, 32px)` |
| Score du hero (56px) | `clamp(38px, 9vw, 56px)` — tiret 20px → 26px |
| Chiffre de tuile stat (30px) | `clamp(22px, 4vw, 30px)` |

Corps 14px, méta 12px, badge 9px : **jamais réduits**. Casse phrase, pas d'emoji, `text-wrap:pretty` sur les titres et phrases longues.

---

## 7. Fonds & décors

Les deux radials de fond passent de `70% 50%` (desktop) à `120% 80%` sur mobile pour rester visibles sur un écran étroit — valeurs déjà employées dans `Dashboard A - mobile.dc.html`. Base `#FBFAFF` clair / `#130726` sombre inchangée. Le glass (blur 14px header, 12px barre basse) est conservé partout ; si `backdrop-filter` n'est pas supporté, fallback opaque `#fff` / `#130726`.

---

## 8. Ce qu'on ne fait pas

- Pas de deuxième arborescence de fichiers « mobile » : les écrans mobiles de `Dashboard A - mobile.dc.html` servent de **référence visuelle**, pas de code parallèle à maintenir.
- Pas de tiroir latéral (drawer) : navigation basse sur mobile, header sur tablet et desktop.
- Pas de scroll horizontal, sauf un cas autorisé : le rail de filtres/segments en haut des pages Parties et Classement (`overflow-x:auto`, `scrollbar-width:none`, premier élément à `--pad-x`).
- Pas de nouvelle couleur, rayon, ombre ou police. Toute valeur absente de `DESIGN-SYSTEM.md` est un bug.

---

## 9. Ordre d'implémentation conseillé

1. Extraire les 4 tokens de densité (§1) et les deux media queries — aucun changement visuel desktop attendu.
2. Grilles (§2), page par page : Accueil → Classement → Parties → Stats → Joueurs.
3. Navigation (§3) : barre basse + header tablet.
4. Composants C, D, E, H (§4) puis tableaux → cartes.
5. Hover/tactile (§5) et échelle fluide (§6) en dernier.

Validation : 375, 402, 768, 1024, 1320 et 1600px, dans les deux thèmes, avec l'état « aucun match en cours » et l'état « match en direct ».
