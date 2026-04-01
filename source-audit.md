# Atlas Nav / WorldLayer - Audit complet des sources de donnees

Date de verification: 2026-03-29

Statut: document de reference de decision

Portee:
- evaluer les sources de donnees et APIs utiles au produit
- privilegier le zero cout recurrent, le zero secret quand possible, et l'absence de self-hosting lourd
- ne pas sacrifier la qualite, la fiabilite, la performance ou l'utilite produit
- distinguer ce qui est vraiment viable en production de ce qui est seulement pratique en prototype

## 1. Resume executif

Conclusion nette:

- Il n'existe pas aujourd'hui de stack mondiale qui soit en meme temps gratuite, sans cle, illimitee, avec SLA, riche, et fiable a grande echelle.
- La meilleure strategie "zero cout long terme" n'est pas de multiplier les APIs publiques. C'est de reduire au maximum les dependances runtime.
- La base la plus solide pour tenir la promesse produit est une architecture `dataset-first`, avec quelques APIs publiques officielles choisies avec discipline.
- Les services publics OSM sont precieux, mais ils ne doivent pas devenir le backend principal d'une app orientee grand public et scalable.
- Les couches "temps reel spectaculaire" comme avions, navires, LLM distants, EV live, transit mondial live sont exactement les couches qui font exploser la promesse `zero cout + zero complexite`.

Decision proposee:

- `CORE_ZERO_COST`: Overture Maps, OpenFreeMap avec fallback PMTiles, MET Norway ou Open-Meteo selon la tolerance produit, Wikipedia/Wikidata/Wikimedia Commons, USGS, EONET, OpenFEMA, datasets statiques pays/urgence, Transformers.js.
- `CONDITIONAL`: MeteoAlarm, NASA FIRMS, GBIF, iNaturalist, Navitia, CityBikes, OpenChargeMap, Walk Score, OpenAQ, BAN France.
- `FALLBACK_ONLY`: Nominatim public, Overpass public, OpenStreetMap tile server.
- `EXPERIMENTAL_OR_PHASE_3`: OpenSky, AISStream, WebLLM, Groq, Hugging Face Inference.
- `DROP_FROM_CORE`: disease.sh, SoilGrids runtime, OpenTripPlanner 2, Transitous comme backbone global, Open Notify ISS, Sunrise-Sunset API, AQICN, OpenAQ si deja couvert par une source plus simple.

## 2. Etat actuel du repo

Le depot appelle deja plusieurs APIs publiques directement depuis le frontend:

- `src/lib/geocoder.ts`: Photon en direct
- `src/lib/weather.ts`: Open-Meteo en direct
- `src/lib/enrichment.ts`: Wikipedia, Wikimedia Commons, Rest Countries, Overpass, USGS, etc. en direct

Implication:

- aujourd'hui, l'application depend encore du navigateur pour contacter des services externes
- cette approche simplifie le prototype
- elle est faible en production des qu'il faut du cache partage, du rate limiting, du circuit breaker, des headers d'identification, ou des remplacements a chaud

Regle recommandee:

- toute source importante doit passer par une couche proxy/cache/BFF ou etre remplacee par un dataset snapshot

## 3. Contraintes non negociables

Les contraintes produit retenues pour cet audit sont les suivantes:

1. Zero cout recurrent si possible.
2. Zero cle ou zero secret si possible.
3. Zero self-hosting lourd obligatoire.
4. Fallback documente pour toute source critique.
5. Pas de dependance critique sur un service public "best effort" si une alternative dataset existe.
6. Toute source doit servir un vrai besoin produit.
7. On prefere des donnees stables et reutilisables a des integrations live fragiles.

## 4. Verites dures a accepter

### 4.1 "gratuit" ne veut pas dire "production"

Beaucoup de services gratuits sont:

- faits pour le prototypage
- soumis a fair use
- sans SLA
- sans engagement de continuite
- susceptibles de changer de politique sans prevenir

### 4.2 "sans cle" ne veut pas dire "sans limite"

Exemples:

- Nominatim public: max 1 req/s et pas d'autocomplete public
- Overpass public: guideline de moderation, pas fait pour servir de backend d'app grand public
- OSM tiles: best effort, pas d'offline, pas de SLA
- MET Norway: identification obligatoire, proxy recommande, pas de SLA

### 4.3 Le bon compromis zero cout est souvent "dataset + cache"

Quand une source change lentement ou est dataset-friendly:

- pays
- divisions admin
- POI generalistes
- batiments
- prix immo historiques
- donnees socio-eco

... il vaut souvent mieux snapshotter la data dans R2/PMTiles/Parquet plutot que taper un endpoint public a chaque clic.

## 5. Grille de decision

### 5.1 Classes de decision

- `CORE_ZERO_COST`: acceptable comme brique importante d'une version zero cout
- `CONDITIONAL`: utile, mais seulement avec garde-fous clairs
- `DATASET_FIRST`: a consommer par snapshots, pas en runtime principal
- `FALLBACK_ONLY`: ne jamais en faire un backend principal
- `EXPERIMENTAL`: interessant, mais non critique
- `DROP`: hors scope, trop fragile, trop cher en complexite, ou remplace par mieux

### 5.2 Axes d'evaluation

- utilite produit
- cout recurrent
- cle / secret / token
- charge operations
- risque legal / policy
- fiabilite reelle
- performance
- capacite de fallback

## 6. Stack cible recommandee

### 6.1 Stack stricte "zero cout long terme"

- Carte: OpenFreeMap en primaire, PMTiles snapshot en fallback
- Backbone geospatial: Overture Maps snapshots mensuels
- Recherche de lieux: index local derive de Overture + GeoNames + datasets regionaux
- Reverse geocode leger: GeoNames ou Nominatim uniquement en fallback utilisateur et avec cache
- Meteo:
  - option A la plus stricte: MET Norway pour le coeur forecast
  - option B la plus riche mais moins "zero cout prod commercial": Open-Meteo
- Alertes:
  - Europe: MeteoAlarm Atom feeds
  - Etats-Unis: api.weather.gov
  - mondial evenementiel: USGS + EONET
- Connaissance: Wikipedia + Wikidata + Wikimedia Commons
- Risques et crises: USGS + EONET + OpenFEMA + ReliefWeb faible frequence
- Nature: GBIF en primaire, iNaturalist en secondaire
- Intelligence locale: Transformers.js
- Datasets statiques: urgence, ambassades, pays, macro indicateurs, adresses specialistes

### 6.2 Ce qui ne doit pas etre dans le chemin critique

- OpenSky
- AISStream
- Groq
- Hugging Face Inference
- Walk Score
- OpenChargeMap live sans cache lourd
- Navitia global si la couverture n'est pas explicitement validee

## 7. Master table

| Source | Categorie | Cle | Cout recurrent | Realite production | Role recommande | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| OpenFreeMap | tuiles | non | zero | service as-is, sans garanties, peut disparaitre | primaire avec PMTiles fallback | CONDITIONAL |
| OpenStreetMap tile server | tuiles | non | zero | best effort, pas d'offline, policy stricte | jamais comme backend principal | DROP |
| Overture Maps | dataset geo | non | zero | excellent pour snapshots versionnes | backbone principal | CORE_ZERO_COST |
| GeoNames datasets | gazetteer | username public | zero | bon en dataset, services publics modestes | dataset d'indexation et utilitaires | CONDITIONAL |
| Nominatim public | geocoding | non | zero | 1 req/s max, pas d'autocomplete public | fallback reverse / requete utilisateur | FALLBACK_ONLY |
| Photon public | search | non | zero | utile mais sans garanties fortes | prototype ou fallback | FALLBACK_ONLY |
| Overpass public | POI OSM | non | zero | pas fait pour backend d'app grand public | fallback cible, pas primaire | FALLBACK_ONLY |
| MET Norway | meteo | non | zero | tres serieux mais pas de SLA, identification obligatoire | coeur meteo zero cout | CORE_ZERO_COST |
| Open-Meteo free/open-access | meteo | non | zero | excellent, mais free non-commercial et limite | coeur meteo si on accepte cette contrainte | CONDITIONAL |
| MeteoAlarm Atom feeds | alertes EU | non | zero | bon pour l'Europe, backward compatible | alertes Europe | CONDITIONAL |
| MeteoAlarm EDR API | alertes EU | token | zero ou token gere | endpoints proteges, plus robuste mais plus de friction | usage institutionnel/reuse lourd | CONDITIONAL |
| api.weather.gov | alertes US | non | zero | tres bon pour les US | alertes US | CONDITIONAL |
| Wikipedia API | culture | non | zero | solide avec etiquette et cache | enrichment textuel | CORE_ZERO_COST |
| Wikidata | facts | non | zero | tres utile, a cacher | facts structures | CORE_ZERO_COST |
| Wikimedia Commons | photos | non | zero | bon enrichissement, non critique | media geolocalise | CONDITIONAL |
| REST Countries | pays | non | zero | mieux en snapshot qu'en runtime | dataset statique | DATASET_FIRST |
| BAN / Geoplateforme | geocoding FR | non | zero | excellent mais France seulement | specialiste France | CONDITIONAL |
| USGS Earthquake | risques | non | zero | tres solide | source primaire seismes | CORE_ZERO_COST |
| EONET | risques | non | zero | bon agregateur evenements naturels | source primaire secondaire | CORE_ZERO_COST |
| OpenFEMA | risques US | non | zero | bon complement US | source US specifique | CONDITIONAL |
| ReliefWeb | crises ONU | appname / regles | zero | faible frequence seulement | couches crise edito | CONDITIONAL |
| NASA FIRMS | incendies | MAP_KEY gratuite | zero | excellent, mais cle requise | incendies actifs | CONDITIONAL |
| OpenAQ | air quality | selon usage | zero | service serieux mais ajoute de la complexite | secondaire si besoin specifique | CONDITIONAL |
| GBIF | biodiversite | non | zero | tres bon, 429 possible sous charge | primaire nature | CONDITIONAL |
| iNaturalist | biodiversite communautaire | non | zero | bon complement, non critique | secondaire / fallback qualite | CONDITIONAL |
| CityBikes | micro-mobilite | non | zero | 300 req/heure public | usage opportuniste | CONDITIONAL |
| Navitia | transit | cle gratuite | zero | utile, mais coverage par zone et auth requise | transit conditionnel | CONDITIONAL |
| OpenChargeMap | EV | cle gratuite | zero | cle obligatoire, pas pour heavy prod, pas de SLA | EV avec cache lourd | CONDITIONAL |
| Walk Score | urbanisme | cle gratuite | zero | 5000/jour free, consumer only, cache premium | non-core / benchmark | CONDITIONAL |
| OpenSky | aviation | OAuth2 | zero | quotas serres, auth obligatoire depuis 2026-03-18 | mode data uniquement | EXPERIMENTAL |
| AISStream | maritime | cle gratuite | zero | beta, pas de SLA, backend websocket requis | maritime phase 3 | EXPERIMENTAL |
| Transformers.js | IA locale | non | zero | excellent pour taches locales | intelligence locale | CORE_ZERO_COST |
| WebLLM | IA locale LLM | non | zero | fort potentiel mais depend du device/WebGPU | phase 3 offline | EXPERIMENTAL |
| Groq | LLM distant | cle gratuite | zero | quotas et dependance distante | resume a la demande seulement | EXPERIMENTAL |
| Hugging Face Inference | LLM/NLP distant | cle gratuite | zero | fallback pratique, pas socle critique | fallback manuel | EXPERIMENTAL |
| disease.sh | sante | non | zero | trop faible institutionnellement pour le core | hors core | DROP |
| SoilGrids REST | sols | non | zero | beta, 5 appels/min, pas de garantie | dataset ou futur mode niche | DROP |
| OpenTripPlanner 2 | transit | self-host | non zero | hors contraintes | elimine | DROP |
| Transitous | transit | non | zero | communautaire, moins fiable comme base | eventuel complement | DROP |
| Open Notify ISS | fun | non | zero | gadget | hors scope | DROP |
| Sunrise-Sunset API | astro | non | zero | redundant | inutile si provider meteo couvre deja | DROP |
| AQICN | air quality | cle | zero | plus de friction que le gain | eviter si Open-Meteo/OpenAQ suffisent | DROP |

## 8. Audit detaille par categorie

### 8.1 Cartographie, geographie, geocodage

#### OpenFreeMap - CONDITIONAL

Pourquoi c'est interessant:

- sans cle
- sans inscription
- simple a brancher
- bien aligne avec une strategie open

Pourquoi ce n'est pas suffisant seul:

- les CGU indiquent un service fourni "as-is"
- aucune garantie de disponibilite
- le service peut etre modifie ou arrete sans preavis

Decision:

- oui comme primaire MVP / prototype / small scale
- non comme dependance unique
- fallback obligatoire via PMTiles snapshot dans R2

Sources:
- https://openfreemap.org/
- https://openfreemap.org/tos/

#### OpenStreetMap tile server - DROP

Pourquoi non:

- les tuiles OSM sont communautaires et best effort
- policy stricte
- pas d'offline
- pas de scraping
- pas de SLA
- la policy recommande clairement de pouvoir changer de fournisseur sans update applicatif

Decision:

- ne pas l'utiliser comme backend de tuiles de production

Sources:
- https://operations.osmfoundation.org/policies/tiles/

#### Overture Maps - STRONG KEEP

Pourquoi c'est la meilleure brique open a long terme:

- releases mensuelles
- GeoParquet distribue sur S3 et Azure
- pas besoin de signer les requetes pour les chemins publics
- themes utiles: addresses, buildings, places, transportation, divisions, base
- PMTiles generes a chaque release
- GERS + bridge files + changelog pour suivre la stabilite des entites

Limite:

- ce n'est pas un moteur de recherche "pret a brancher"
- il faut construire ses snapshots, indexes et vues derivees

Decision:

- backbone principal des donnees geospatiales
- priorite haute

Sources:
- https://docs.overturemaps.org/
- https://docs.overturemaps.org/getting-data/cloud-sources/
- https://docs.overturemaps.org/gers/registry/

#### GeoNames - CONDITIONAL

Points forts:

- gazetteer mondial libre
- data telechargeable
- bon pour lieux admin, populations, noms alternatifs, pays, subdivisions, ocean, elevation
- un simple username suffit pour les web services publics

Points faibles:

- le site recommande explicitement les services commerciaux pour les usages professionnels et mission critical
- meilleur en dataset qu'en service runtime central

Decision:

- oui comme dataset et utilitaire
- oui pour petits appels de reverse/country subdivision avec cache
- non comme moteur principal de recherche global en production grand public

Sources:
- https://www.geonames.org/about.html
- https://www.geonames.org/services.html
- https://www.geonames.org/export/web-services.html
- https://www.geonames.org/export/credits.html

#### Nominatim public - FALLBACK_ONLY

Politique officielle importante:

- maximum absolu: 1 req/s
- pas d'autocomplete cote client
- usage end-user modere seulement
- cache et capacite de switch obligatoires

Decision:

- bon fallback reverse
- interdit comme moteur d'autocomplete public
- interdit comme backbone runtime d'une app qui scale

Sources:
- https://operations.osmfoundation.org/policies/nominatim/

#### Photon public - FALLBACK_ONLY

Etat:

- pratique pour l'autocomplete
- tres bien pour un prototype
- mais pas assez defendable comme dependance centrale zero risque

Decision:

- usage prototype acceptable
- en cible, preferer index local derive de dataset

Sources:
- https://photon.komoot.io/
- https://github.com/komoot/photon

#### Overpass public - FALLBACK_ONLY

Ce que dit la doc:

- les instances publiques se defendent contre l'abus
- guideline de moderation autour de 10k req/jour et 1 GB/jour
- la doc cite explicitement comme comportement problematique le fait de construire une app grand public qui depend de l'instance publique comme backend

Decision:

- excellent pour requetes ponctuelles
- non comme source POI principale
- utiliser Overture snapshots d'abord

Sources:
- https://dev.overpass-api.de/overpass-doc/en/preface/commons.html

### 8.2 Meteo et alertes

#### MET Norway - CORE_ZERO_COST

Atouts:

- pas de cle
- donnees serieuses
- autorise l'usage commercial sous conditions
- bonne capacite

Contraintes officielles:

- identification obligatoire via User-Agent / Origin / Referer
- cache local obligatoire
- le navigateur ne doit pas contacter directement l'API en usage non trivial
- pas de SLA
- accord special au-dela de 20 req/s par application

Decision:

- meilleure option "coeur meteo zero cout" si on veut minimiser l'ambiguite commerciale
- a mettre derriere un BFF/proxy

Sources:
- https://docs.api.met.no/doc/TermsOfService.html
- https://api.met.no/.License

#### Open-Meteo - CONDITIONAL

Atouts:

- couverture tres riche
- forecast, air quality, elevation, marine, flood, geocoding
- excellent produit et excellente DX
- customer API annonce 99.9% uptime

Point critique:

- la page pricing dit clairement que le free/open-access est pour evaluation, prototypage, developpement, et que pour la production il existe un customer API avec cle
- le free open-access est annonce non commercial et limite

Decision:

- excellent pour prototype et MVP
- acceptable si le produit n'est pas encore dans un cadre commercial strict
- moins propre que MET Norway pour une promesse "zero cout production commerciale"

Sources:
- https://open-meteo.com/en/docs
- https://open-meteo.com/en/pricing

#### MeteoAlarm - CONDITIONAL

Ce qu'il faut distinguer:

- les Atom feeds publics
- l'EDR API plus moderne

Etat officiel verifie:

- les anciens flux RSS ont ete sunsets le 2026-01-14
- l'EDR API existe, les endpoints data proteges demandent un token
- les feeds Atom restent une voie publique importante
- couverture: donnees issues de 33 pays membres EUMETNET

Decision:

- oui pour alertes Europe
- feed Atom pour usage leger / public
- token EDR seulement si besoin de requetes plus riches

Sources:
- https://api.meteoalarm.org/
- https://api.meteoalarm.org/edr/v1
- https://api.meteoalarm.org/edr/v1/authentication
- https://api.meteoalarm.org/edr/v1/faq
- https://feeds-test.meteoalarm.org/

#### api.weather.gov - CONDITIONAL

Pourquoi utile:

- excellente couche alertes et meteo pour les Etats-Unis
- source officielle

Decision:

- a utiliser comme specialiste US
- pas comme remplacement mondial

Sources:
- https://www.weather.gov/documentation/services-web-api
- https://www.weather.gov/documentation/services-web-alerts
- https://api.weather.gov/

#### NASA FIRMS - CONDITIONAL

Etat officiel:

- cle gratuite requise
- limite de 5000 transactions par tranche de 10 minutes
- tres bon pour incendies actifs

Decision:

- a garder si on accepte "cle gratuite"
- a sortir du noyau si la regle absolue est zero cle

Sources:
- https://firms.modaps.eosdis.nasa.gov/api/
- https://firms.modaps.eosdis.nasa.gov/api/map_key/
- https://firms.modaps.eosdis.nasa.gov/content/academy/data_api/firms_api_use.html

#### OpenAQ - CONDITIONAL

Pourquoi c'est a part:

- la source est utile si l'on veut une couche air quality plus specialisee
- elle devient moins prioritaire si le coeur produit prend deja Open-Meteo ou un autre fournisseur meteo enrichi

Decision:

- ne pas la mettre dans le coeur si elle ne remplace rien
- la reintroduire seulement si un besoin qualite de l'air plus fin apparait

Sources:
- https://openaq.org/
- https://docs.openaq.org/

#### AQICN - DROP

Raison:

- ajoute une cle et de la friction
- pas indispensable si la couche air quality est deja couverte ailleurs
- n'aide pas l'objectif zero complexite

Sources:
- https://aqicn.org/api/

#### Sunrise-Sunset API - DROP

Raison:

- utile en isolation
- mais completement redondant si le provider meteo principal donne deja sunrise/sunset

Sources:
- https://sunrise-sunset.org/api

### 8.3 Connaissance, culture, contexte

#### Wikipedia API - CORE_ZERO_COST

Ce que la doc officielle demande:

- identification claire
- requetes en serie de preference
- cache recommande
- pas de parallelisation agressive

Decision:

- excellent pour resumes, geosearch, enrichissement culturel
- a garder

Sources:
- https://www.mediawiki.org/wiki/API:Etiquette
- https://www.mediawiki.org/wiki/API:Main_page

#### Wikidata - CORE_ZERO_COST

Usage recommande:

- facts structures
- langues, monnaies, populations, surfaces, entites admin

Decision:

- a garder
- a combiner avec un cache et une normalisation de schemas

Sources:
- https://www.wikidata.org/wiki/Wikidata:Data_access

#### Wikimedia Commons - CONDITIONAL

Atouts:

- photos geolocalisees
- enrichissement visuel fort

Attention:

- attribution et licences media a respecter
- qualite tres variable
- non critique

Decision:

- garder comme enrichissement

Sources:
- https://commons.wikimedia.org/wiki/Commons:REST_API
- https://www.mediawiki.org/wiki/API:Etiquette

#### REST Countries - DATASET_FIRST

Decision:

- utile
- mais les 250 pays changent peu
- mieux en snapshot local que dependance runtime

Sources:
- https://restcountries.com/

### 8.4 Risques, temps reel, crise

#### USGS Earthquake - CORE_ZERO_COST

Pourquoi garder:

- source officielle
- GeoJSON simple
- utilite produit immediate
- tres bon rapport valeur/complexite

Decision:

- source primaire seismes

Sources:
- https://earthquake.usgs.gov/earthquakes/feed/v1.0/
- https://earthquake.usgs.gov/fdsnws/event/1/

#### EONET - CORE_ZERO_COST

Pourquoi garder:

- API officielle NASA
- bonne couche d'evenements naturels curates
- utile pour raconter "ce qui se passe ici"

Decision:

- complement naturel a USGS

Sources:
- https://eonet.gsfc.nasa.gov/
- https://eonet.gsfc.nasa.gov/docs/v3

#### OpenFEMA - CONDITIONAL

Pourquoi garder:

- source officielle US
- utile pour couches US risques et declarations

Decision:

- oui pour specialisation US
- non comme couche mondiale

Sources:
- https://www.fema.gov/about/openfema/developer-resources
- https://www.fema.gov/about/reports-and-data/openfema

#### ReliefWeb - CONDITIONAL

Pourquoi c'est utile:

- crises humanitaires ONU
- tres bonne couche edito / contexte

Pourquoi ce n'est pas une brique de trafic massif:

- policy et quota plus contraints
- usage a faible frequence preferable

Decision:

- garder seulement pour panneaux crise / briefing

Sources:
- https://apidoc.reliefweb.int/

#### disease.sh - DROP

Raison:

- utile en prototype
- mais pas assez institutionnel pour le noyau d'un produit cartographique de confiance sur un sujet sante

Decision:

- sortir du core

Sources:
- https://disease.sh/
- https://github.com/disease-sh/API

### 8.5 Nature et biodiversite

#### GBIF - CONDITIONAL

Ce que dit la doc:

- les requetes rapides ou nombreuses peuvent etre rate-limitees
- en cas de 429, il faut ralentir ou utiliser l'API de download
- pas de garantie sur un debit fixe

Decision:

- tres bon primaire nature
- imposer cache et bornes de requetage

Sources:
- https://techdocs.gbif.org/en/openapi/

#### iNaturalist - CONDITIONAL

Pourquoi garder:

- observations communautaires
- apporte du vivant et du recent

Pourquoi rester prudent:

- source communautaire
- pas assez defendable seule comme backbone global
- durant cet audit, certaines pages officielles etaient indisponibles

Decision:

- secondaire / complement / fallback

Sources:
- https://www.inaturalist.org/pages/developers
- https://www.inaturalist.org/pages/api+reference

#### SoilGrids REST - DROP

Etat officiel:

- API REST v2 beta
- downtimes possibles
- pas de garantie d'uptime
- fair use de 5 appels par minute

Decision:

- hors runtime principal
- eventuellement dataset ou futur mode niche

Sources:
- https://rest.isric.org/
- https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html

### 8.6 Mobilite, transport, EV

#### Navitia - CONDITIONAL

Atouts:

- API utile
- journeys, places, departures, POI, coord->coverage

Limites reelles:

- authentification obligatoire
- la couverture est basee sur des regions/coverage, pas une promesse uniforme mondiale

Decision:

- garder si coverage validee zone par zone
- ne pas vendre ca comme "transports publics mondiaux sans reserve"

Sources:
- https://doc.navitia.io/

#### CityBikes - CONDITIONAL

Etat officiel:

- public API limitee a 300 requetes par heure

Decision:

- utile pour usage opportuniste
- jamais "illimite"

Sources:
- https://docs.citybik.es/api/

#### OpenChargeMap - CONDITIONAL

Etat officiel et communautaire:

- cle API obligatoire
- le mainteneur demande explicitement cache, mirror, ou import si le besoin est intensif
- pas de SLA
- le mainteneur dit clairement que l'API n'est pas faite pour heavy production use

Decision:

- garder si besoin EV mondial open
- uniquement avec cache lourd / snapshot / fallback dataset

Sources:
- https://www.openchargemap.org/about
- https://www.openchargemap.org/develop/api
- https://community.openchargemap.org/t/reminder-api-keys-are-mandatory/218
- https://community.openchargemap.org/t/poi-api-unavailable/763

#### Walk Score - CONDITIONAL

Etat officiel:

- version free: 5000 appels/jour
- reservee aux applications consumer-facing gratuites
- la capacite de cache est un avantage premium

Decision:

- pas adapte au coeur zero cout long terme
- utile seulement comme benchmark ou enrichissement faible trafic
- preferer un score maison calcule a partir des POI et de l'accessibilite

Sources:
- https://www.walkscore.com/professional/api-sign-up.php

#### OpenTripPlanner 2 - DROP

Raison:

- incompatible avec la contrainte zero self-hosting
- apporte une forte charge infra

Sources:
- https://opentripplanner.readthedocs.io/

#### Transitous - DROP

Raison:

- projet utile et interessant
- mais communautaire
- trop fragile comme socle transport mondial si l'objectif est la fiabilite production

Decision:

- eventuel complement de recherche
- jamais backbone principal

Sources:
- https://transitous.org/
- https://wiki.transitous.org/

### 8.7 Donnees live "spectaculaires"

#### OpenSky - EXPERIMENTAL

Etat officiel verifie:

- anonymes: 400 credits/jour
- comptes authentifies: 4000 credits/jour
- depuis le 2026-03-18, le basic auth est deprecie et l'acces REST passe par OAuth2 client credentials

Decision:

- mode data seulement
- pas brique critique

Sources:
- https://openskynetwork.github.io/opensky-api/rest.html

#### AISStream - EXPERIMENTAL

Etat officiel:

- service encore en beta
- pas de SLA
- pattern recommande: consommer le websocket au backend, pas directement depuis le navigateur
- cle exposee sinon

Decision:

- hors noyau MVP
- seulement phase 3

Sources:
- https://aisstream.io/documentation.html

#### Open Notify ISS - DROP

Raison:

- utile comme easter egg
- inutile comme valeur coeur

Sources:
- http://open-notify.org/

### 8.8 Intelligence artificielle

#### Transformers.js - CORE_ZERO_COST

Pourquoi c'est une excellente brique:

- tourne dans le navigateur
- pas de serveur
- pas de cle
- supporte classification, NER, summarization, translation, generation, etc.
- WebGPU possible, WASM sinon

Limite:

- poids modele
- cold start
- performance device-dependante

Decision:

- brique IA locale principale

Sources:
- https://huggingface.co/docs/transformers.js/

#### WebLLM - EXPERIMENTAL

Atouts:

- vrai LLM local possible
- bon candidat phase 3 offline

Limites:

- depend fortement de WebGPU et du device
- pas assez uniforme pour une fonction critique

Decision:

- phase 3 uniquement

Sources:
- https://webllm.mlc.ai/

#### Groq - EXPERIMENTAL

Pourquoi non-core:

- cle requise
- quotas
- dependance distante

Decision:

- a la demande seulement
- jamais automatique

Sources:
- https://console.groq.com/docs/rate-limits

#### Hugging Face Inference - EXPERIMENTAL

Pourquoi non-core:

- free tier utile
- mais dependance distante et quotas variables

Decision:

- fallback manuel seulement

Sources:
- https://huggingface.co/docs/inference-providers/index

## 9. Sources regionales et specialistes

### BAN / Geoplateforme France - KEEP SPECIALIST

Points forts:

- service geocodage tres solide pour la France
- limite publique de 50 appels/IP/seconde
- migration officielle de l'ancienne API BAN vers le service IGN / Geoplateforme
- France seulement

Decision:

- a garder comme specialiste France
- hors backbone mondial

Sources:
- https://adresse.data.gouv.fr/outils/api-doc/adresse
- https://adresse.data.gouv.fr/blog/lapi-adresse-de-la-base-adresse-nationale-est-transferee-a-lign

### Meteo-France Open Data - CONDITIONAL SPECIALIST

Decision:

- interessant en specialiste France si besoin de precision locale tres forte
- pas un coeur mondial

Sources:
- https://portail-api.meteofrance.fr/

### Eurostat - DATASET_FIRST

Decision:

- bon pour indicateurs UE
- mieux en ingestion/snapshot qu'en panneau runtime critique

Sources:
- https://ec.europa.eu/eurostat/data/web-services

### World Bank Open Data - DATASET_FIRST

Decision:

- bon pour signaux macro pays
- pas pour evaluer un quartier fin

Sources:
- https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation

### INSEE DVF - DATASET_FIRST

Decision:

- tres utile pour la France
- uniquement en dataset local

Sources:
- https://www.data.gouv.fr/

## 10. Remplacements ou ameliorations possibles

### Si la regle reste "zero cout strict"

- remplacer le geocoding runtime par un index local derive de Overture + GeoNames
- utiliser MET Norway pour le coeur meteo
- garder Open-Meteo seulement si ses endpoints specifiques apportent une vraie valeur non remplacee
- utiliser Overture comme colonne vertebrale POI/batiments au lieu de Overpass public
- construire un score de marchabilite maison au lieu de Walk Score
- remplacer disease.sh par USGS + EONET + OpenFEMA + ReliefWeb selon le sujet

### Si on accepte une petite friction "cle gratuite"

- NASA FIRMS devient tres defendable pour incendies
- Navitia reste interessant sur zones verifiees
- OpenChargeMap reste utile si cache lourd

### Si on accepte un petit budget futur

- Geoapify devient un bon accelerateur pour geocoding + places + isolines
- un provider de tuiles gerees avec SLA peut remplacer OpenFreeMap

Mais ce n'est pas compatible avec l'objectif premier de ce document, qui est le zero cout long terme.

## 11. Architecture cible recommandee

### 11.1 Regles d'implementation

- Toute API externe importante passe par un Worker/BFF.
- Toute reponse reutilisable est mise en cache.
- Toute source lente ou fragile a un circuit breaker.
- Toute source critique a un fallback.
- Toute source stable finit en snapshot dataset.

### 11.2 Repartition recommandee

#### Runtime critique

- OpenFreeMap
- MET Norway ou Open-Meteo
- USGS
- EONET
- Wikipedia summary avec cache

#### Runtime conditionnel

- MeteoAlarm
- OpenFEMA
- GBIF
- CityBikes
- Navitia
- OpenChargeMap

#### Snapshot / ETL

- Overture Maps
- REST Countries
- GeoNames
- Eurostat
- World Bank
- INSEE DVF
- emergency numbers
- ambassades

#### Local-only / offline-first

- Transformers.js
- deep links natifs
- emergency bundle

## 12. Recommandation finale

### Si l'objectif numero 1 est reellement zero cout long terme

La meilleure stack actuellement defendable est:

- OpenFreeMap + fallback PMTiles
- Overture Maps comme backbone dataset
- GeoNames + index local pour la recherche et le reverse leger
- MET Norway comme coeur meteo
- MeteoAlarm pour l'Europe
- api.weather.gov pour les US
- USGS + EONET + OpenFEMA pour les risques
- Wikipedia + Wikidata + Wikimedia Commons pour le contexte
- GBIF pour la nature
- Transformers.js pour l'intelligence locale

### Si l'objectif numero 1 est richesse fonctionnelle MVP

La version plus riche mais moins "pure zero cout prod" est:

- OpenFreeMap
- Overture Maps
- Open-Meteo
- Wikipedia/Wikidata/Commons
- USGS + EONET + FIRMS
- Navitia
- OpenChargeMap
- GBIF + iNaturalist
- Groq a la demande

### Arbitrage recommande

- privilegier la premiere version pour l'architecture de base
- ajouter les couches plus fragiles seulement en modules optionnels

## 13. Generalite et couverture large

Si le produit veut couvrir le monde entier, le bon schema n'est pas:

- un provider unique "parfait" partout

Le bon schema est plutot:

- un generaliste mondial pour la couche de base
- des specialistes regionaux ou thematiques quand ils apportent un vrai gain
- unifier la sortie dans ton propre schema de donnees

### 13.1 Recommendation meteo

Schema recommande:

- `Open-Meteo` comme generaliste mondial si la priorite est la couverture large et la richesse d'API
- `MET Norway` comme couche de comparaison, fallback, ou specialiste de confiance pour les zones nordiques / Europe du Nord
- `MeteoAlarm` pour les alertes Europe
- `api.weather.gov` pour les alertes US

Pourquoi:

- Open-Meteo agrège et normalise plusieurs modeles nationaux et globaux
- MET Norway est plus permissif sur l'usage, mais n'est pas le meilleur candidat comme unique facade mondiale si la priorite absolue est la largeur fonctionnelle
- la bonne architecture est donc `generaliste + specialistes`, pas `un seul fournisseur pour tout`

### 13.2 Recommendation geographie

- `Overture Maps` doit rester la base mondiale dataset
- `GeoNames` aide pour la generalisation gazetteer
- `BAN / Geoplateforme` ne doit intervenir qu'en specialiste France
- `Nominatim` et `Overpass` publics ne doivent pas etre la base mondiale

### 13.3 Recommendation produit

- generaliser via snapshots et schemas internes
- specialiser par region seulement quand le gain est prouve
- eviter de multiplier les providers live sans normalisation forte

## 14. Cout, scale, SLA, nombreux utilisateurs simultanes

### 14.1 Ce qui coute vraiment

Dans cette architecture, les couts viennent surtout de:

- la couche edge / proxy / cache
- le stockage et la distribution des snapshots
- les providers payants si tu veux des garanties ou des fonctions riches
- les couches live a fort volume comme tuiles, geocoding, routage, EV, LLM

### 14.2 Ce qui reste presque gratuit longtemps

Avec une bonne architecture, les couches suivantes peuvent rester tres peu couteuses:

- pages statiques
- frontend client-side
- snapshots Overture / GeoNames moderes
- cache KV
- D1 pour metadata / cache structuré
- Workers si la logique est legere

### 14.3 Chiffres Cloudflare officiels utiles

Cloudflare Pages:

- les requetes vers assets statiques sont gratuites et illimitees
- les Pages Functions sont facturees comme des Workers

Workers standard:

- minimum: 5 USD / mois
- 10 millions de requetes incluses / mois
- +0.30 USD par million de requetes supplementaires
- 30 millions de CPU ms inclus / mois
- +0.02 USD par million de CPU ms supplementaires
- exemple officiel: 100 millions de requetes / mois a 7 ms de CPU moyen = 45.40 USD / mois

Workers KV:

- 10 millions de reads / mois inclus
- +0.50 USD / million de reads supplementaires
- 1 million de writes / mois inclus
- +5.00 USD / million de writes supplementaires
- stockage: 1 GB inclus puis 0.50 USD / GB-mois

D1:

- 25 milliards de rows read / mois inclus
- +0.001 USD / million de rows read supplementaires
- 50 millions de rows written / mois inclus
- +1.00 USD / million de rows written supplementaires
- stockage: 5 GB inclus puis 0.75 USD / GB-mois

R2:

- 10 GB-mois de stockage inclus
- 1 million de Class A inclus / mois
- 10 millions de Class B inclus / mois
- stockage standard: 0.015 USD / GB-mois
- Class A: 4.50 USD / million
- Class B: 0.36 USD / million
- egress internet: gratuit
- exemple officiel: 10 millions de lectures d'objets par jour sur de petits assets peut deja monter a 104.40 USD / mois

Workers Analytics Engine:

- gratuit pour l'instant, mais Cloudflare affiche deja le futur pricing:
- 10 millions de data points / mois inclus sur Paid puis +0.25 USD / million
- 1 million de read queries / mois inclus puis +1.00 USD / million

Sources:
- https://developers.cloudflare.com/pages/functions/pricing/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/kv/platform/pricing/
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/analytics/analytics-engine/pricing/

### 14.4 Ce que cela veut dire pour ton app

Si tu fais bien le cache, les couts edge restent faibles beaucoup plus longtemps qu'on l'imagine.

Le vrai point de rupture n'est pas "beaucoup d'utilisateurs". C'est:

- beaucoup de requetes dynamiques non cachees
- beaucoup de petites lectures objet sur R2
- beaucoup d'appels live sur des providers externes
- beaucoup de geocoding / routage / LLM par utilisateur

### 14.5 Cout par mode

#### Mode A - best effort quasi gratuit

Hypothese:

- Pages statiques
- peu de Workers
- snapshots modestes
- APIs publiques best effort

Ordre de grandeur:

- 0 a 5 USD / mois cote edge
- 0 USD cote provider si tout reste en public/free
- pas de SLA
- risque d'instabilite si le trafic grimpe

#### Mode B - low-cost production raisonnable

Hypothese:

- Workers Paid
- bon cache
- Overture snapshots
- peu d'appels live par utilisateur

Ordre de grandeur:

- Workers: 5 a 20 USD / mois si la logique reste legere
- KV/D1: souvent quelques dollars ou moins
- R2: de quelques centimes a quelques dizaines de dollars selon lecture d'objets
- total infra maison: souvent de l'ordre de 10 a 50 USD / mois avant meme d'ajouter un provider premium

#### Mode C - production riche / plus de garanties

Hypothese:

- provider meteo payant
- geocoding/tiles plus contractuels
- trafic eleve

Ordre de grandeur:

- edge maison: toujours raisonnable
- la vraie facture vient du provider principal meteo / maps / geocoding
- Open-Meteo confirme publiquement ses paliers 1M, 5M et >50M appels/mois sur les plans payants et annonce 99.9% uptime sur son customer API, mais le prix exact est charge via Stripe embed et n'est pas expose de facon stable dans la version statique de la page
- pour les cartes, des services geres comme Stadia montrent le genre de budget a prevoir si tu veux plus de garanties: 20 USD / mois pour 1M credits, 80 USD / mois pour 7.5M credits, 250 USD / mois pour 25M credits

Sources:
- https://open-meteo.com/en/pricing
- https://stadiamaps.com/pricing

### 14.6 SLA reelle

Important:

- les services publics gratuits n'offrent pratiquement jamais de SLA contractuelle
- `99.9% uptime` sur une page marketing n'est pas la meme chose qu'une SLA contractuelle avec credits / remedes
- si tu veux une vraie garantie, il faut quasiment toujours passer a un plan payant ou enterprise

### 14.7 Utilisateurs simultanes

La simultaneite n'est pas le bon axe principal de cout. L'axe utile est:

- combien de requetes uniques non cachees par fenetre de temps

Exemple:

- si 10 000 utilisateurs demandent la meteo d'une meme zone et que tu caches par cellule geographique et TTL d'une heure, tu ne fais pas 10 000 appels provider
- tu fais quelques appels par cellules utiles

Donc:

- la meteo, les facts et les panneaux textuels se compressent tres bien par cache
- les tuiles et la navigation se compressent moins bien
- les requetes LLM distantes se compressent tres mal

Conclusion pratique:

- le premier poste de cout a surveiller n'est pas forcement la meteo
- ce sont souvent les tuiles, le geocoding live, le routage et le stockage/lecture d'objets a fort volume

## 15. TODO produit concret

1. Arreter les appels critiques directement depuis le frontend.
2. Definir une couche `sources/` avec metadata de policy, TTL, fallback, attribution.
3. Construire un snapshot Overture minimal pour `places`, `buildings`, `divisions`.
4. Choisir entre `MET Norway core` et `Open-Meteo core`.
5. Releguer Nominatim et Overpass publics en fallback only.
6. Sortir du chemin critique OpenSky, AISStream, Groq, HF Inference.
7. Documenter les sources critiques dans le code avec lien policy + TTL + fallback.

## 16. References officielles verifiees pendant cet audit

- OpenFreeMap: https://openfreemap.org/ ; https://openfreemap.org/tos/
- OSM tiles policy: https://operations.osmfoundation.org/policies/tiles/
- Nominatim policy: https://operations.osmfoundation.org/policies/nominatim/
- Overpass manual commons: https://dev.overpass-api.de/overpass-doc/en/preface/commons.html
- Overture docs: https://docs.overturemaps.org/
- Overture cloud sources: https://docs.overturemaps.org/getting-data/cloud-sources/
- Overture GERS: https://docs.overturemaps.org/gers/registry/
- GeoNames about/services/webservices/credits:
  - https://www.geonames.org/about.html
  - https://www.geonames.org/services.html
  - https://www.geonames.org/export/web-services.html
  - https://www.geonames.org/export/credits.html
- MET Norway TOS: https://docs.api.met.no/doc/TermsOfService.html
- Open-Meteo docs/pricing:
  - https://open-meteo.com/en/docs
  - https://open-meteo.com/en/pricing
- MeteoAlarm:
  - https://api.meteoalarm.org/
  - https://api.meteoalarm.org/edr/v1
  - https://api.meteoalarm.org/edr/v1/authentication
  - https://api.meteoalarm.org/edr/v1/faq
  - https://feeds-test.meteoalarm.org/
- NWS:
  - https://www.weather.gov/documentation/services-web-api
  - https://www.weather.gov/documentation/services-web-alerts
- Wikipedia / MediaWiki etiquette:
  - https://www.mediawiki.org/wiki/API:Etiquette
  - https://www.mediawiki.org/wiki/API:Main_page
- REST Countries: https://restcountries.com/
- USGS:
  - https://earthquake.usgs.gov/earthquakes/feed/v1.0/
  - https://earthquake.usgs.gov/fdsnws/event/1/
- EONET:
  - https://eonet.gsfc.nasa.gov/
  - https://eonet.gsfc.nasa.gov/docs/v3
- OpenFEMA:
  - https://www.fema.gov/about/openfema/developer-resources
  - https://www.fema.gov/about/reports-and-data/openfema
- ReliefWeb: https://apidoc.reliefweb.int/
- NASA FIRMS:
  - https://firms.modaps.eosdis.nasa.gov/api/
  - https://firms.modaps.eosdis.nasa.gov/api/map_key/
  - https://firms.modaps.eosdis.nasa.gov/content/academy/data_api/firms_api_use.html
- GBIF: https://techdocs.gbif.org/en/openapi/
- iNaturalist:
  - https://www.inaturalist.org/pages/developers
  - https://www.inaturalist.org/pages/api+reference
- SoilGrids:
  - https://rest.isric.org/
  - https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html
- Navitia: https://doc.navitia.io/
- CityBikes: https://docs.citybik.es/api/
- OpenChargeMap:
  - https://www.openchargemap.org/about
  - https://www.openchargemap.org/develop/api
  - https://community.openchargemap.org/t/reminder-api-keys-are-mandatory/218
  - https://community.openchargemap.org/t/poi-api-unavailable/763
- Walk Score: https://www.walkscore.com/professional/api-sign-up.php
- OpenSky: https://openskynetwork.github.io/opensky-api/rest.html
- AISStream: https://aisstream.io/documentation.html
- Transformers.js: https://huggingface.co/docs/transformers.js/
- WebLLM: https://webllm.mlc.ai/
- Groq rate limits: https://console.groq.com/docs/rate-limits
- Hugging Face Inference Providers: https://huggingface.co/docs/inference-providers/index
- BAN / Geoplateforme:
  - https://adresse.data.gouv.fr/outils/api-doc/adresse
  - https://adresse.data.gouv.fr/blog/lapi-adresse-de-la-base-adresse-nationale-est-transferee-a-lign
- Eurostat web services: https://ec.europa.eu/eurostat/data/web-services
- World Bank indicators API: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation
