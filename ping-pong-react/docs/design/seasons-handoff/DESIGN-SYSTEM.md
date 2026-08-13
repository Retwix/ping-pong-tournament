# Design system — Tournoi ping-pong (v1, figé)

Source unique : `Dashboard home.dc.html` (frames 1a–1h), validé. Rendu visuel : `Design system.dc.html`.
Toute page suivante copie ces valeurs à l'identique. Aucune nouvelle couleur, taille ou rayon.

## Couleurs — clair
Violet : `#4A2AA4` primaire · `#5B39C4` dégradé · `#3A2183` hover/lien · `#E4DDF8` fond avatar · `#F0ECFB` pastille active/ghost · `#F2EFFB` hover de ligne · `#F7F5FD` tuile stat · `#FBFAFF` fond de page
Coral (live/urgence seulement) : `#D74251` · `#BE3341` · `#93283A` · `#A82B38` (mobile) · `#F0899A` avatar · `#FBD4D9` bordure live · `#FEE7EE` fond badge
Texte/traits : `#17082B` encre · `#4A4458` corps · `#6B6480` nav inactive · `#847E96` méta · `#A49EB3` discret · `#CBC3DD` chevron · `#E8E4F2` bordure carte · `#ECE8F6` bordure glass · `#CDBDF0` pointillé
Sémantique : `#2BA572` victoire/Elo+ · `#B8E4D0` bordure « terminé » · `#E54C4C` Elo− · rangs `#E8B53A` / `#AEB6C0` / `#CB8E5E`

## Couleurs — sombre
`#130726` fond · `#1E1138` surface · halos `#2A1550` / `#3A1636` · `#C9B8FF` accent · `#A99FC4` secondaire · `#8B82A8` discret · `#4ED9A0` victoire · `#F0C84B` rang 1 · `#7A5AE0` logo
Bordures `rgba(255,255,255,.08)` (carte) / `.09` (nav) / `rgba(215,66,81,.4)` (carte live) · glass `rgba(255,255,255,.05)` · ombre `0 3px 12px rgba(0,0,0,.3)`. Le hero live est identique dans les deux thèmes.

## Dégradés
Fond clair : `radial-gradient(120% 90% at 0% 0%,#E8E1FA 0%,transparent 46%), radial-gradient(120% 90% at 100% 0%,#FDE7EE 0%,transparent 46%), #FBFAFF`
Fond sombre : mêmes radials avec `#2A1550` / `#3A1636` à 48%, base `#130726`
Hero live : `linear-gradient(105deg,#D74251 0%,#BE3341 55%,#93283A 100%)` (mobile : `linear-gradient(120deg,#D74251,#A82B38)`)
Logo : `linear-gradient(135deg,#5B39C4,#4A2AA4)` (sombre : `#7A5AE0,#4A2AA4`)
Série en cours : `linear-gradient(100deg,#FFF3E9,#FDE9EE)`

## Typographie
Outfit = titres + UI. DM Sans = phrases et méta. Casse phrase, pas d'emoji.
| Rôle | Style |
|---|---|
| Titre de page | Outfit 800 32px/1, −.02em, `#17082B` |
| Titre de section | Outfit 800 18px |
| Titre de carte / rail | Outfit 800 16px |
| Wordmark | Outfit 800 17px/1, −.01em, 2e mot `#4A2AA4` |
| Nom en ligne | Outfit 700 14px |
| Nav | Outfit 700 13.5px `#4A2AA4` actif / 600 `#6B6480` |
| Corps | DM Sans 600 14px `#4A4458` |
| Méta | DM Sans 600 12px `#847E96` (horodatage `#A49EB3`) |
| Sous-libellé | DM Sans 600 11px `#847E96` |
| Badge | Outfit 800 9px/1, .08em, majuscules |
| Libellé live | Outfit 800 12px/1, .16em, `#fff` |
| Score | Outfit 900 56px/.9 −.02em (mobile 42px) ; tiret 800 26px / 20px à .55 |

## Rayons
24 cadre · 22 hero (18 mobile) · 18 nav/liste/rail · 16 carte (14 mobile) · 13 bouton hero + tuile stat · 12 bouton primaire + ligne · 11 tuile icône + ligne de rail · 999 badges/avatars/segmenté

## Ombres
carte `0 3px 12px rgba(32,10,66,.06)` · carte hover `0 14px 30px rgba(32,10,66,.15)` · nav `0 4px 18px rgba(32,10,66,.06)` · bouton violet `0 12px 26px rgba(74,42,164,.3)` (18px : `0 10px 24px rgba(74,42,164,.28)`) · hero `0 22px 50px rgba(215,66,81,.32)` · cadre `0 30px 80px rgba(32,10,66,.14)`

## Grille
Desktop : écran 1320px, padding `20px 26px 30px`. Corps `grid-template-columns:2fr 1fr; gap:20px`. Cartes de parties : 3 colonnes, gap 12. Bloc→bloc 22, titre→contenu 12, nav→hero 16, hero→corps 20.
Mobile : 402×874, padding `52px 14px 96px`, gap 9, blocs à 14–15.

## Boutons
Primaire : Outfit 800 14px `#fff` sur `#4A2AA4`, r12, padding 12/18, ombre `0 10px 24px rgba(74,42,164,.28)`.
Secondaire : Outfit 700 14px `#4A2AA4` sur `#F0ECFB`, r12, sans ombre.
Split « + Nouveau ▾ » : `#4A2AA4`, r12, padding 11/16, séparateur 1px `rgba(255,255,255,.22)` marge 8px, chevron 14px.
Sur hero : primaire inversé Outfit 800 15px `#BE3341` sur `#fff`, r13, padding 13, ombre `0 8px 20px rgba(0,0,0,.18)` ; fantôme Outfit 700 14px `#fff`, fond `rgba(255,255,255,.14)`, bordure 1.5px `rgba(255,255,255,.55)`.
Lien d'action : Outfit 700 13px `#4A2AA4` + « → » (12px dans le rail). Liens texte : `#4A2AA4`, hover `#3A2183`.
FAB mobile : 52px `#4A2AA4`, bordure 4px `#fff`, « + » Outfit 400 30px, ombre `0 10px 22px rgba(74,42,164,.4)`, `margin-top:-22px`.

## Header (identique partout, seule la pastille active change)
Glass `rgba(255,255,255,.72)` + blur 14px, bordure `#ECE8F6`, r18, padding `11px 16px 11px 18px`, ombre nav. Logo : tuile 34px r11 dégradé violet, ombre `0 6px 16px rgba(74,42,164,.32)`, icône 19px. Onglets figés : **Accueil · Classement · Stats · Joueurs**, gap 3, padding 8/15, actif r10 sur `#F0ECFB`. Droite : segmenté clair/sombre (pilule blanche r999 padding 3, cellules 30px) + bouton split.
Sombre : fond `rgba(255,255,255,.05)`, bordure `rgba(255,255,255,.09)`, texte `#fff`/`#A99FC4`, actif `rgba(255,255,255,.09)`, bouton `#5B39C4`.

## Mobile
Header : logo tuile 30px r9 + wordmark 17px ; à droite un rond 34px (thème) `#fff` / bordure `#E8E4F2` / icône 16px `#4A2AA4`. Pas de hamburger.
Barre sticky : `left/right/bottom:0`, `rgba(255,255,255,.92)` + blur 12px, bordure haute `#ECE8F6`, padding `8px 10px 24px`. 4 onglets flex 1 (Accueil · Classement — Stats · Joueurs), icônes 21px trait 2 (2.1 actif), libellé Outfit 10px : actif 700 `#4A2AA4`, inactif 600 `#A49EB3`. FAB central 52px. Cible tactile ≥ 44px.
Sombre : fond `rgba(19,7,38,.92)`, bordure `rgba(255,255,255,.08)`, actif `#C9B8FF`, inactif `#8B82A8`.

## Composants réutilisables
A · En-tête de section — titre 800 18 + lien 700 13, space-between, mb 12 (rail : 16 / 12, mb 14).
B · Badges — « EN COURS » plein `#FEE7EE` + point pulsé 6px ; « TERMINÉ » contour 1.5px `#B8E4D0` ; « EN DIRECT » (hero seulement) point 10px blanc pulsé.
C · Carte de partie — r16, padding 16, bordure `#E8E4F2` (`#FBD4D9` si live), badge en haut, titre 800 16 (mt 14), méta 600 12 (mt 5), corbeille 16px trait 1.9 `#A49EB3` révélée au hover → `#D74251`. Vainqueur `#2BA572`, verbe 600 `#A49EB3`. Carte « nouveau » : pointillé 1.5px `#CDBDF0`, min-height 104.
D · Liste de résultats — conteneur r18 padding 6/8 ; ligne gap 13, padding 12, r12, hover `#F2EFFB` 160ms ; avatar 30, phrase DM Sans 600 14 avec nom Outfit 800 et score Outfit 700, horodatage 600 12 `#A49EB3`, chevron 15px `#CBC3DD`.
E · Ligne de classement — rang 22px (800 podium coloré, sinon 700 `#847E96`), avatar 34, nom 700 14, Elo 800 15 (`#4A2AA4` pour le leader), delta 42px DM Sans 700 12 ▲`#2BA572` / ▼`#E54C4C`, padding 9/6, r11.
F · Avatars — 60 (hero, dégradés + bordure blanche 3px), 44 (hero mobile, 2.5px), 34 (rail), 30 (liste), 28 (mobile) ; 2 initiales Outfit 700 (800 au hero) ; mis en avant plein `#4A2AA4`, sinon `#E4DDF8`/`#4A2AA4`.
G · Tuiles & faits marquants — rangée r13 padding 11/13 sur `#F7F5FD` (dégradé chaud réservé à la série en cours), tuile d'icône 32px r10 blanche, icône 17px, titre 700 13, sous-libellé 600 11, chiffre clé 800 18 `#4A2AA4`.
H · Bande d'invitation (état vide en tête de page) — glass `rgba(255,255,255,.66)` + blur 10px, r18, padding 16/22, tuile icône 44px r13 sur `#F0ECFB`, titre 800 16 + explication 600 13, actions primaire + secondaire à droite. Le haut de page ne se vide jamais.
Hero live — r22, dégradé coral, ombre coral, overlay `radial-gradient(80% 140% at 88% -10%, rgba(255,255,255,.16), transparent 55%)`, padding 22/26 ; colonnes 150px (méta) / 1fr (matchup, gap 26) / 158px (actions, gap 9).

## Mouvement
Courbe unique `cubic-bezier(.2,.7,.2,1)`. Hover de ligne : background 160ms → `#F2EFFB`. Hover de carte : `translateY(-2px)` + ombre hover, 160ms. Corbeille : opacité .5→1, 140ms. Appui : `scale(.98)` 140ms. Entrée : opacity + `translateY(8–12px)` 220ms ease-out.
Keyframes autorisées, live uniquement : `rvpulse` (blanc, 1.8s) et `rvpulseC` (coral, 2s). Rien d'autre en boucle. Respecter `prefers-reduced-motion`.

## Ouvert
1. Footer : inexistant dans l'accueil validé ; proposition dans `Design system.dc.html` §08, à valider ou supprimer.
2. « Pronos » est supprimé du produit (juillet 2026) : plus d'onglet desktop ni mobile, aucune entrée FAB.
