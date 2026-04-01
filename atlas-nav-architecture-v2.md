# Atlas Nav - Vision & Spécifications Architecturales (V2.0)

Ce document consolide toutes les réflexions, brainstormings et décisions UX/UI concernant l'évolution de l'application Atlas Nav. Il sert de plan de vol avant toute implémentation technique.

---

## 1. Philosophie & Principes Directeurs
*   **Utilitaire & Actionnable** : L'application n'est pas qu'une encyclopédie passive. Elle doit guider l'utilisateur et lui proposer des actions concrètes et *pertinentes* (appeler, réserver, horaires) comme Google Maps.
*   **Intelligence Situationnelle (SIS)** : L'application ne "devine" plus. Elle utilise des données factuelles (Overpass API, Wikipédia) pour s'adapter précisément au contexte du lieu (Archétypes).
*   **Délégation & Deep Linking (Ne pas réinventer la roue)** : Atlas Nav est un hub d'exploration intelligent, pas un calculateur d'itinéraires complexe. Pour la mobilité lourde (VTC, transports en commun, GPS turn-by-turn), l'application délègue via des **Deep Links** vers les apps spécialisées (Uber, Citymapper, Google Maps, Waze), en laissant le choix à l'utilisateur.
*   **Data Storytelling (Fini la donnée brute)** : Une liste de séismes avec leurs magnitudes ou une liste d'insectes avec leurs noms latins n'est pas utile. Les données complexes (biodiversité, risques naturels, épidémies) doivent être "traduites" visuellement (carrousels, jauges, cartes de chaleur) et accompagnées de texte explicatif pour être comprises instantanément par le grand public.
*   **Exploration "Master-Detail"** : Permettre à l'utilisateur de chercher des intentions ("Parcs", "Musées") et de naviguer fluidement d'une liste de résultats vers une fiche détaillée.
*   **Design Aéré & Immersif** : Exploiter pleinement la verticalité des tiroirs (Vaul) pour éviter la compacité. Utiliser de grandes images et des cartes aérées.
*   **Universalité & Adaptabilité** : **⚠️ POINT CRUCIAL :** Tous les exemples cités dans ce document (ex: le Serengeti, les horaires d'ouverture, les animaux) ne sont *que* des illustrations. La logique du SIS et la modularité de l'UI s'appliquent à **l'ensemble du globe et à tous les contextes**. L'application est conçue pour ne jamais afficher de données aberrantes (ex: pas d'horaires d'ouverture pour le milieu de l'Océan Pacifique, pas de densité de faune pour le centre de Tokyo). Le système est 100% agnostique et s'adapte à ce qu'il "lit" dans la donnée.

---

## 2. Le Moteur d'Intelligence Situationnelle (SIS 2.0)

Le SIS abandonne les traits binaires (`WILD`, `URBAN`) pour une structure hiérarchique basée sur la donnée.

### A. Architecture du Moteur
1.  **Macro-Domaines** : `NATURE`, `URBAN`, `MARITIME`, `CULTURAL`, `TRANSIT`, `ISOLATED`.
2.  **Archétypes (Sous-domaines)** : Ex: Pour `NATURE` ➔ `SAVANNAH`, `DESERT`, `JUNGLE`, `ALPINE`, `FOREST`.
3.  **Signaux (Modificateurs dynamiques)** : Ex: `EXTREME_WEATHER`, `HIGH_BIODIVERSITY`, `NIGHT_TIME`, `HISTORICAL_SIGNIFICANCE`.

### B. Mécanique de Détection (Data Cross-Referencing)
Le SIS ne s'appuie plus uniquement sur le nom du lieu, mais calcule un **Score de Confiance** basé sur :
*   **Overpass API (OSM Tags)** : Requêtes `is_in` pour détecter les polygones englobants (`boundary=national_park`, `natural=desert`, `tourism=museum`). *Source de vérité principale.*
*   **Wikipédia (Text Mining)** : Analyse lexicale (NLP basique) de l'extrait (`extract`) pour repérer des clusters sémantiques (ex: "écosystème", "bataille", "empire").
*   **Météo & Topographie** : Utilisation de l'altitude, température et précipitations (classification climatique) pour confirmer un biome.
*   **GBIF / Biodiversité** : Densité et type d'espèces renvoyées (ex: 80% de coraux = `CORAL_REEF`).

### C. Gestion des Intentions et "Soft-Triggers" (Modes Thématiques & Urgences)
Le SIS ne doit pas être "intrusif" ou sauter aux conclusions trop vite (ex: cliquer sur un hôpital par curiosité ne signifie pas qu'on est en urgence vitale).
*   **Assistance Non-Intrusive (Soft-Emergency)** : Si le lieu est un hôpital ou un poste de police, le système n'affiche pas une alerte rouge géante. Il propose plutôt un "Soft-Trigger" : un bouton discret *« 🆘 Besoin d'assistance ? »*. Si l'utilisateur clique, l'UI se transforme alors en mode "Urgence" (numéros rapides, urgences à proximité).
*   **Vues Thématiques à la demande (Lenses)** : L'utilisateur peut explorer le monde selon son humeur. Le Drawer proposera des "Onglets d'intention" ou des filtres activables :
    *   **🎒 Mode Plein Air (Outdoor)** : Met en avant les sentiers de rando, les spots de bivouac, la météo précise (vent, UV).
    *   **🏛️ Mode Tourisme & Culture** : Met en avant Wikipédia, les musées, les horaires des monuments, les visites guidées.
    *   **🏡 Mode Qualité de Vie (Relocation)** : Pour quelqu'un qui cherche à s'installer. Met en avant la qualité de l'air, la proximité des écoles, les transports en commun, le bruit urbain.
Cette approche garantit que l'UI reste pertinente et ne submerge pas l'utilisateur d'informations qu'il n'a pas demandées.

---

## 3. Workflow d'Exploration & UI (L'Inspiration Google Maps)

### A. La Barre de Recherche Intelligente (Smart Search Bar)
*   **État Initial (Vide)** :
    *   Historique des recherches récentes.
    *   Lieux favoris / sauvegardés.
    *   "Pilules" de catégories rapides (ex: 🌲 Parcs, 🏛️ Musées, ☕ Cafés).
*   **Recherche Floue / Intentionnelle** : Gérer des requêtes comme "Où voir des animaux" ou "Parcs" pour déclencher une recherche de catégorie plutôt qu'une recherche géographique stricte.

### B. L'Exploration par Catégories (Master-Detail Pattern)
1.  **Vue Liste (Master)** :
    *   Clic sur "Parcs" ➔ Le Drawer s'ouvre sur une liste de cartes (Cards).
    *   Chaque carte contient : Nom, Distance, Statut (Ouvert/Fermé), et un mini-carrousel photo.
    *   *Sur la carte (Map)* : Affichage de tous les marqueurs correspondant à la catégorie. Bounding box dynamique.
2.  **Transition Fluide** :
    *   Clic sur un élément de la liste ou un marqueur ➔ Transition horizontale (Slide/Fade).
    *   La carte de l'app zoome (`flyTo`) sur le marqueur sélectionné. Les autres marqueurs s'estompent.
3.  **Vue Détail (Fiche Lieu)** :
    *   Ouverture de la fiche spécifique au lieu avec un bouton "← Retour à la liste".

### C. Le Sélecteur de Cartes et Calques (Map Layer Selector)
*   **Visuel** : Remplacer les menus textuels par des vignettes (Thumbnails) visuelles illustrant le rendu final (ex: Satellite, Rues, Topographie).
*   **Couches de Données (Data Layers)** : Séparer le "Style de base" des "Couches d'informations" activables en surimpression :
    *   Couche Météo (Radar, Températures).
    *   Couche Biodiversité (Heatmap GBIF).
    *   Couche Séismes / Alertes.
*   **Adaptabilité** : Le sélecteur doit être facilement accessible, discret, mais offrir une grande flexibilité d'usage selon le besoin de l'utilisateur (exploration urbaine vs. randonnée).

### D. Enrichissement Visuel de la Carte (Landmarks & On-Map Widgets)
L'expérience visuelle sur la carte elle-même doit être premium (inspiration Apple Maps).
*   **Marqueurs Riches (Landmarks)** : Fini les pins génériques identiques partout. Pour les lieux majeurs (monuments, grands parcs, stades), la carte affiche des marqueurs circulaires personnalisés contenant soit une illustration 3D/2D, une icône thématique forte, ou une photo miniature du lieu. Le SIS détermine l'importance du lieu pour décider de l'afficher en tant que "Landmark".
*   **Bulles d'Aperçu Flottantes (Mini-Previws)** : Au clic sur un Landmark, avant même d'avoir besoin de scroller dans le Drawer, une "bulle" flottante (Widget) apparaît directement sur la carte (ex: en bas à gauche). Cette bulle contient une photo réelle du lieu (ou un aperçu Street View / Look Around), offrant un contexte visuel immédiat pour confirmer à l'utilisateur qu'il regarde le bon endroit.

---

## 4. Refonte du LocationDrawer (La Fiche Lieu)

### A. Philosophie Visuelle
*   **Fini la ligne de flottaison fixe** : Le drawer doit être entièrement scrollable de bas en haut (exploiter `vaul` correctement).
*   **Le Hero Météo** : Réduit à une "Context Bar" collante (Sticky) et compacte (ex: Icône, Température, Statut rapide) pour libérer de l'espace.
*   **Aération (Gestalt)** : Utilisation de grandes marges, de "Cards" distinctes pour chaque type de donnée, plutôt que des grilles compactées `grid-cols-3`.

### B. Enrichissement des Données Utilitaires (Orienté Action)
*   **Barre d'Actions Primaires (Si pertinent)** : Pilules cliquables juste sous le titre : 📞 Appeler, 🌐 Site Web, 🗺️ Itinéraire, 🎟️ Réserver, ⭐ Sauvegarder.
*   **Quick Info (Bloc Pratique)** :
    *   Statut d'ouverture en temps réel (Ouvert/Fermé avec horaires).
    *   Tarifs, Accessibilité (Fauteuil roulant), Règles (Chiens, Feux).
    *   *Source : Overpass API (`opening_hours`, `fee`, `wheelchair`, etc.).*
*   **Variabilité de l'UI selon le Domaine (Le SIS en action)** : L'UI n'est pas un template figé. Elle s'adapte dynamiquement. Par exemple :
    *   **Pour un lieu URBAIN (ex: Restaurant, Musée)** : On affiche en priorité les horaires, le numéro de téléphone, l'affluence, et l'accessibilité.
    *   **Pour un lieu NATURE (ex: Serengeti, Forêt Noire)** : On affiche en priorité la saisonnalité, les espèces présentes, les règles de camping/feu, et l'altitude.
    *   **Pour un lieu OCÉAN/MARITIME** : On n'affiche PAS d'horaires d'ouverture ou de numéro de téléphone. L'UI bascule pour afficher les données maritimes (météo marine, température de l'eau, faune marine).
    *   **Pour un lieu ISOLÉ (Désert, Toundra)** : L'UI affiche principalement des données de survie, les coordonnées GPS, et supprime les modules d'actions (pas de bouton "Appeler").
*   **Activités Contextuelles ("À faire sur place")** :
    *   Générées dynamiquement via OSM (Campements, Points de vue, Randonnées, ou Lignes de métro si en ville).
    *   Clic sur une activité ➔ Filtre la carte pour afficher ces POI spécifiques.
*   **Tour Guide Virtuel** :
    *   Génération de conseils pratiques basés sur le SIS (ex: "Il fait 35°C, prévoyez de l'eau", "Zone à moustiques", "Dernier métro à 00h30").

---

## 5. Prochaines Étapes Techniques (Roadmap d'Implémentation)
1.  **Refactoring UI du Drawer** : Restructurer `LocationDrawer.tsx` pour intégrer Vaul correctement (scroll global) et réduire le Hero Météo.
2.  **Création du Smart Search Bar & List View** : Implémenter la navigation "Master-Detail" avec gestion d'état (`Index.tsx` et `LocationDrawer.tsx`).
3.  **Refonte du SIS (`priorities.ts`)** : Coder le moteur de règles hiérarchique (Domaines/Archétypes) et l'analyse de signaux.
4.  **Intégration Data (Overpass/Wiki NLP)** : Mettre en place les requêtes de croisement de données pour alimenter le SIS et les infos pratiques (Horaires, Contacts).
5.  **Refonte du Layer Selector** : Créer le composant UI avec Thumbnails pour la sélection de styles et de couches.
