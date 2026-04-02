# Spécifications UI/UX & Design Système - Atlas Nav (V2 Polish)

Ce document centralise toutes les décisions de design, d'ergonomie et d'architecture front-end validées pour le "Polish" de l'application Atlas Nav. L'objectif est de passer d'une interface "dashboard généré" à une expérience organique, premium et immersive (Editorial Utility).

---

## 1. Philosophie Visuelle : L'Editorial Utility
*   **La guerre aux "Boîtes" :** Suppression systématique des conteneurs fermés (`border`, `bg-card`, `shadow`) pour les groupes de contenu. L'information doit flotter sur le canvas (`var(--background)`).
*   **La Hiérarchie par le Vide (Gestalt) :** Les séparations entre les sections ne se font plus par des lignes ou des boîtes, mais par des espaces blancs massifs (`margin-bottom: 32px` ou `48px`).
*   **La loi de Proximité :** Les éléments intimement liés (ex: une icône météo et sa valeur) doivent être collés (`gap-1` ou `gap-2`).
*   **Typographie structurante :** 
    *   *Instrument Serif* : Uniquement pour les grands titres (Identité du lieu, Titres de sections majeures).
    *   *JetBrains Mono* : Uniquement pour les métadonnées (Coordonnées, Distances, Chiffres précis).
    *   *SF Pro* : Pour tout le texte de lecture (Contexte SIS, Wiki, Avis).

---

## 2. Refonte du Location Drawer (La Fiche Lieu)
Le `LocationDrawer.tsx` abandonne son architecture empilée pour une lecture continue.

### A. La Tête (Hero)
*   **Suppression du Hero Météo massif :** La température `5xl` disparaît du haut.
*   **Nouvelle composition :**
    *   **Titre :** Nom du lieu en très grand (`Instrument Serif`).
    *   **Context Bar :** Juste en dessous, une ligne de texte (Mono/Sans) : `48.85°N, 2.35°E • Ouvert • 24°C`.
    *   **Audio :** Un simple bouton icône discret à droite du titre (plus de "pilule" avec bordure).

### B. Le Contexte SIS (L'Intelligence)
*   **Plus de carte grise (`bg-card/70`) :** Le module devient une "Section Nue".
*   **Texte éditorial :** Le résumé généré (ex: "Le lieu est analysé comme un contexte naturel...") s'affiche comme le chapeau introductif d'un article de magazine.
*   **Badges :** Les signaux (Assistance, Zone Sauvage) deviennent de petits "tags" textuels alignés en bas du paragraphe, sans couleurs de fond criardes (juste du texte coloré ou un très léger `bg-muted/30`).

### C. Les Actions Primaires
*   Garder le format scroll horizontal (`overflow-x-auto`).
*   **Seules les actions vitales** (Appel d'urgence, Itinéraire) ont un fond plein (`bg-primary` ou `bg-pastel-red-bg`).
*   Les actions secondaires (Partager, Sauvegarder) deviennent des boutons transparents (icône + texte au hover).

### D. Le Contenu (Explore Tab)
*   **Wikipédia :** Si une photo existe, elle prend toute la largeur avec des bords légèrement arrondis. Le texte s'écoule en dessous sans bordure.
*   **Mosaïque Photos :** Grille asymétrique (1 grande à gauche, 2 petites à droite empilées) pour donner un effet galerie premium.
*   **Les "Insights" (NarrativeCard) :** Deviennent des puces de texte intégrées naturellement dans le flux, sous la section météo ou contexte.

---

## 3. L'Exploration par Catégories (Le Master-Detail)
Inspiration directe de Google Maps pour donner de "l'âme" à la recherche.

### A. La Vue "Catégories" (Recherche initiale)
*   Affichage d'une grille de "Pilules" de catégories (Alimentation, À faire, Shopping) directement accessibles sous la barre de recherche ou dans le Drawer vide.
*   Bords très arrondis (`rounded-full`), léger fond de couleur, icône + texte court.

### B. La Vue "Liste des Résultats" (Le Master)
*   **Suppression des cartes :** Chaque résultat de la liste perd sa bordure fermée (`border-border/20`).
*   **Séparation :** Une simple ligne grise ultra-fine (`border-b border-border/10`) ou juste du vide.
*   **Structure d'un Résultat :**
    *   Ligne 1 : Titre (grand, Sans-serif).
    *   Ligne 2 : Catégorie + Icône d'accessibilité.
    *   Ligne 3 : Statut (Ouvert en vert / Fermé en rouge) + Horaires + Distance (mono).
    *   **Le Carrousel Visuel :** Un `flex overflow-x-auto` contenant des photos miniatures carrées/arrondies (`w-24 h-24 object-cover`). C'est l'élément clé qui donne envie de cliquer.
    *   *Si pas de photo :* Placeholder premium avec l'emoji/icône de la catégorie centré sur un fond texturé léger.

### C. Le clic (Le Detail)
*   Le clic sur un élément de la liste zoome la carte (`flyTo`) ET fait glisser l'UI du Drawer vers la "Fiche Lieu" détaillée décrite dans la section 2. L'unification visuelle est totale.

---

## 4. L'UI de la Carte (Map Elements)
Inspiration Apple Maps / Google Maps pour le côté tactile et immédiat.

### A. Les Marqueurs Riches (Landmarks)
*   Pour les musées/parcs importants, le marqueur n'est pas un pin standard.
*   C'est un cercle parfait (`rounded-full`), contenant l'image du lieu (`object-cover`).
*   Bordure blanche épaisse (`2px solid rgba(255,255,255,0.9)`).
*   Ombre portée très douce et large (`0 10px 24px rgba(0,0,0,0.15)`).

### B. Les Bulles de Preview Flottantes
*   Au clic sur un marqueur, apparition d'une bulle flottante (en bas ou au-dessus du marqueur).
*   **Layout :** Image occupant le tiers gauche (40%), texte à droite.
*   **Style :** Glassmorphism maîtrisé (`bg-card/90 backdrop-blur-md`).
*   **Typographie :** Titre très affirmé (`font-serif`), sous-titre clair.
*   Bouton "Fermer" (X) intégré à la bulle.

### C. Le Sélecteur de Calques (Layers)
*   Séparation stricte en deux groupes : "Type de carte" (Fond) et "Détails" (Surimpression).
*   **Les boutons "Type" :** Carrés aux bords arrondis (`rounded-2xl`) avec l'image satellite/plan.
    *   *État actif :* Pas de fond gris, mais une **bordure de couleur primaire épaisse** (`ring-2 ring-primary`) pour être ultra-visible.
*   **Les boutons "Détails" (3D, Risques, Nature) :** Icônes centrées dans un bouton `rounded-2xl` avec un fond très léger.
    *   *État actif :* L'icône et le texte prennent la couleur primaire (`text-primary`).

---

## 5. Plan d'Implémentation Technique (Roadmap d'Exécution)
L'implémentation suivra cet ordre strict pour ne rien casser :

1.  **CSS & Variables :** Nettoyage final des variables CSS (retirer les ombres dures, ajuster les couleurs `border` et `muted` pour des tons plus organiques).
2.  **`MapView.tsx` (Polish UI) :**
    *   Implémenter le design des *Landmarks* (CSS-in-JS des marqueurs).
    *   Refondre le *Popover* du sélecteur de calques (Bordures actives, séparation claire).
    *   Améliorer la *MapPreviewItem* (la bulle flottante avec l'image à 40%).
3.  **`LocationDrawer.tsx` (Refonte Structurelle) :**
    *   Détruire le Hero Météo. Créer le nouveau Header compact.
    *   Transformer le `SituationContextPanel` en section nue (texte éditorial).
    *   Nettoyer les actions (supprimer les boîtes des boutons secondaires).
    *   Mettre à jour les `renderModule` (Wiki, POIs) pour enlever les `border-border/15`.
4.  **`LocationDrawer.tsx` (Le Mode Liste "Master") :**
    *   Refondre totalement le `CategoryListView`.
    *   Intégrer les métadonnées (Statut, Distance).
    *   Créer le mini-carrousel horizontal de photos pour chaque item de la liste.
5.  **`Index.tsx` & Composants transverses :**
    *   S'assurer que le passage Liste ➔ Détail est fluide.
    *   Vérifier que la grille de catégories initiale s'affiche correctement quand aucune recherche n'est active.