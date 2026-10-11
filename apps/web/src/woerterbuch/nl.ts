// GRUNDWÖRTERBUCH `nl` — I18N-AUFTEILUNG (Aufnahme 20260922, zentrale-module-aufteilen).
//
// Dieser Block stand bis zur Aufteilung in `apps/web/src/i18n.ts`. Er ist Zeile für Zeile hierher
// verschoben; kein Schlüssel und kein Wert ist geändert (Beleg:
// `tests/i18n-woerterbuch/aufteilung-unveraendert.test.ts`). Neue Texte gehören in ein Textmodul
// unter `apps/web/src/texte/` (docs/i18n-textmodule.md), nicht hierher.
import { lesevarianteTexteNl } from "../lib/lesevariante";
import type { de } from "./de";

const nl: typeof de = {
  // SCRUM-488: eerste tranche contextuele hulpteksten (spiegel van de DE-sleutels).
  "ask.help.sources.title": "Waarom alleen onderbouwde antwoorden?",
  "ask.help.sources.body":
    "Klarwerk antwoordt uitsluitend uit jullie eigen kennisobjecten — nooit uit algemene modelkennis. Bij elk antwoord zie je welke bronnen het gedragen hebben en in welke staat ze zijn. Ontbreekt de basis, dan zegt het dat eerlijk in plaats van te gokken. Controleer de genoemde bronnen voordat je erop vertrouwt.",
  "dup.help.detection.title": "Hoe duplicaten worden herkend",
  "dup.help.detection.body":
    "„Tekstidentiek“ vindt de heuristiek zonder AI; „waarschijnlijk“ beoordeelt het model inhoudelijk. Beslissen moet je zelf — en jouw beslissing legt alleen een afsluitreden vast: aan de twee objecten verandert ze niets, geen van beide wordt verwijderd, beide blijven.",
  "extpage.help.scope.title": "Wat externe zoekopdracht mag",
  "extpage.help.scope.body":
    "Externe treffers zijn onderzoekshulp, geen geverifieerde kennis: niets wordt automatisch geïmporteerd of door collega’s gevalideerd. Heeft de beheerder externe opvraging uitgeschakeld, dan blijft het gebied leeg.",
  "app.name": "KLARWERK",
  "app.subtitle": "Reasoning System",
  "app.staleBundle":
    "Er is een nieuwe versie van de app beschikbaar — laad de pagina opnieuw (Cmd+R of Ctrl+R).",
  "version.neu.hinweis": "Nieuwe versie beschikbaar",
  "version.neu.neuLaden": "Opnieuw laden",
  "nav.group.workspace": "Werkruimte",
  "nav.group.quality": "Kwaliteit & onderhoud",
  "nav.group.control": "Aansturing",
  "nav.group.advanced": "Geavanceerd",
  "gliederung.arbeiten": "Werken",
  "gliederung.qualitaet": "Kwaliteit",
  "gliederung.verwaltung": "Beheer",
  "gliederung.persoenlich": "Persoonlijk en help",
  "nav.start": "Start",
  "nav.tasks": "Open taken",
  "nav.capture": "Kennis vastleggen",
  "nav.ask": "Vragen",
  "nav.library": "Bibliotheek",
  "nav.wissensnetz": "Themakaart",
  "wissensnetz.kicker": "Kennisnetwerk",
  "wissensnetz.title": "Themakaart",
  "wissensnetz.karte.label": "Thema's en hun overlap",
  "wissensnetz.karte.alt": "Themakaart met {{count}} thema's",
  "wissensnetz.knoten.alt": "{{thema}} — {{count}} zichtbare kennisobjecten, thema kiezen",
  "wissensnetz.farbe.belegt": "vrijgegeven en onderbouwd",
  "wissensnetz.farbe.freigegeben": "vrijgegeven, zonder bron",
  "wissensnetz.farbe.offen": "in beoordeling",
  "wissensnetz.legende.ubiquitaer":
    "Gestippelde rand: komt voor in de meerderheid van de zichtbare verzameling en krijgt daarom geen verbindingen.",
  "wissensnetz.legende.keineKanten":
    "In deze verzameling deelt geen enkel vrijgegeven kennisobject twee van deze thema's — daarom zijn er geen lijnen te zien.",
  "wissensnetz.legende.kantenUnterdrueckt":
    "Een vrijgegeven kennisobject verbindt hier wel twee thema's — maar minstens één daarvan komt voor in de meerderheid van de zichtbare verzameling en krijgt daarom geen lijnen.",
  "wissensnetz.alle.schalter": "Alle thema's ({{count}} meer)",
  "wissensnetz.alle.abgeschnitten": "Deze lijst is ingekort.",
  "wissensnetz.leer": "In deze verzameling zijn geen trefwoorden toegekend.",
  // JOB 3052 D6 — spiegel van de DE-sleutels, zie de toelichting daar.
  "wissensnetz.legende.groesse": "Grootte = zichtbare kennis · lijn = samen vrijgegeven",
  "wissensnetz.leiste.alt": "Over het thema {{thema}}",
  "wissensnetz.leiste.zaehlung":
    "{{frei}} vrijgegeven kennisobjecten · {{pruefung}} in beoordeling",
  "wissensnetz.leiste.status.validiert": "vrijgegeven",
  "wissensnetz.leiste.status.offen": "in beoordeling",
  "wissensnetz.leiste.alle": "Alle {{count}} objecten openen",
  "wissensnetz.leiste.oeffnen": "In de bibliotheek openen",
  "wissensnetz.leiste.leer": "Bij dit thema is voor jou niets zichtbaar.",
  "wissensnetz.leiste.fehler": "De objecten bij dit thema konden niet worden geladen.",
  "wissensnetz.stand.fehlgeschlagen": "Stand van {{stand}} · vernieuwen mislukt",
  "wissensnetz.keineAntwort": "Nog geen antwoord van de server.",
  // JOB 3067 V4 — de afleeskaart onder het netwerk. Elk opschrift draagt het woord „zichtbaar",
  // elk voor zich: wie een enkel getal leest, leest precies die ene regel.
  "wissensnetz.metrik.titel": "Zichtbare verzameling",
  "wissensnetz.metrik.objekte": "Zichtbare objecten",
  "wissensnetz.metrik.ohneThema": "Zichtbare objecten zonder trefwoord",
  "wissensnetz.metrik.beitragende": "Zichtbare bijdragers",
  "wissensnetz.metrik.hinweis":
    "Geteld is wat voor jou zichtbaar is. Wat je niet mag zien, is vóór het tellen verwijderd — wat deze getallen betekenen, bepaal jij.",
  "wissensnetz.metrik.ohneThemaHinweis": "Daarvoor is er geen ingang in de bibliotheek.",
  "wissensnetz.metrik.themenTitel": "Thema's op zichtbare bijdragers, de minste eerst",
  "wissensnetz.metrik.zeile.objekte": "{{count}} zichtbare objecten",
  "wissensnetz.metrik.zeile.beitragende": "{{count}} zichtbare bijdragers",
  "wissensnetz.metrik.zeile.beitragendeMindestens": "minstens {{count}} zichtbare bijdragers",
  "wissensnetz.metrik.mehr": "Nog {{count}} thema's tonen",
  "wissensnetz.metrik.weniger": "Overige thema's verbergen",
  // JOB 3070 V6 — de leesweg, spiegel van de DE-sleutels; zie de toelichting daar.
  "wissensnetz.lesen.gruppe": "Weergave van de themakaart",
  "wissensnetz.lesen.netz": "Netwerk",
  "wissensnetz.lesen.lesen": "Lezen",
  "wissensnetz.lesen.ubiquitaer":
    "Komt voor in de meerderheid van de zichtbare verzameling; gezamenlijk voorkomen wordt daarvoor niet vermeld.",
  "wissensnetz.lesen.zusammen": "Komt samen voor met {{themen}}.",
  // JOB 4155 WG-LUECKEN — spiegel van de DE-sleutels; zie de toelichting daar.
  "wissensnetz.lesen.verknuepfung":
    "{{verknuepft}} daarvan hebben een gelegde relatie, {{unverknuepft}} niet.",
  "wissensnetz.verknuepfung.grundsatz":
    "Als er voor een item geen relatie is gelegd, betekent dat niet dat het is gecontroleerd en vrij van tegenspraak bevonden — het betekent alleen dat niemand een relatie heeft gelegd.",
  "wissensnetz.verknuepfung.ausgelassen.kein-kantenport":
    "De gelegde relaties zijn voor dit overzicht niet opgevraagd; daarom staat hier geen getal daarover.",
  "wissensnetz.verknuepfung.ausgelassen.zu-viele-objekte":
    "De gelegde relaties zijn voor deze verzameling niet geteld omdat er te veel items zichtbaar zijn; daarom staat hier geen getal daarover.",
  "wissensnetz.lesen.zustand": "Status: {{wort}}.",
  "wissensnetz.lesen.nichtInListe":
    "De tekening toont {{count}} thema's waarvoor deze lijst geen regel heeft.",
  "nav.external": "Externe kennis",
  "nav.validation": "Validatie",
  "nav.conflicts": "Conflicten",
  "nav.duplicates": "Duplicaten",
  "nav.badge.tasks": "{{count}} openstaande taken",
  "nav.badge.loading": "Teller wordt geladen …",
  "nav.badge.error": "Teller kon niet worden geladen – opnieuw proberen",
  "nav.badge.stale": "Teller verouderd – verversen mislukt, opnieuw proberen",
  "loadstate.error.title": "Kon niet worden geladen.",
  "loadstate.error.retry": "Opnieuw proberen",
  "loadstate.stale": "Verouderd – verversen mislukt",
  "nav.badge.validation": "{{count}} wachten op beoordeling",
  "nav.badge.conflicts": "{{count}} openstaande tegenstrijdigheden",
  "nav.badge.duplicates": "{{count}} mogelijke duplicaten",
  "nav.risk": "Risico & hiaten",
  "nav.lifecycle": "Levenscyclus",
  "nav.analytics": "Analytics & audit",
  "nav.admin": "Admin",
  "nav.output": "Rapportages",
  "nav.import": "Import & bronnen",
  "nav.graph": "Kennisgraaf",
  "nav.capital": "Kapitaalweergaven",
  "nav.help": "Help",
  "nav.profile": "Profiel",
  "role.viewAs": "Weergave als rol",
  "role.previewNote": "Voorbeeld als {{role}} — je blijft admin.",
  "role.backToAdmin": "Naar adminweergave",
  "role.stage2": "Uitgebreide modules · Fase 2",
  "role.stage2Hint":
    "Fase 2 zijn extra modules naast de kernstroom — kwaliteitsborging, kenniskapitaal en uitvoerformaten. Een beheerder schakelt ze vrij.",
  "role.short.viewer": "Viewer",
  "role.short.experte": "Expert",
  "role.short.controller": "Contr.",
  "role.short.admin": "Admin",
  "role.name.viewer": "Kijker",
  "role.name.experte": "Expert",
  "role.name.controller": "Controller",
  "role.name.admin": "Administrator",
  "action.logout": "Afmelden",
  // JOB 1119 (D-002) — zie de Duitse regel.
  "topbar.search": "Kennis in de bibliotheek zoeken…",
  "topbar.mobile": "Mobiel",
  "topbar.design.classic": "Klassiek",
  "topbar.design.modern": "Modern",
  "kopfband.suchen": "Zoeken",
  "kopfband.erfassen": "Vastleggen",
  "kopfband.pruefen": "Controleren",
  "kopfband.navigation": "Hoofdnavigatie",
  "kopfband.menue": "Menu",
  "kopfband.konto": "Account",
  "kopfband.ungelesen": "{{count}} ongelezen meldingen",
  "menue.einstellungen": "Instellingen",
  "menue.status": "Status",
  "menue.seitenhilfe": "Paginahulp",
  "menue.seitenhilfe.leer": "Voor deze pagina is er geen uitleg.",
  // JOB 3669 — paginahulp voor de eerste weg: Start → Bibliotheek → Mijn taken → kennisobject.
  "seitenhilfe.start.title": "Startpagina: vragen en zien wat er wacht",
  "seitenhilfe.start.body":
    "Dit is de startpagina: hier stel je een vraag aan de kennis en zie je wat er op je wacht. Typ je vraag in het veld — het antwoord staat op de pagina “Vragen”; de kaart “VOOR JOU” toont je openstaande punten, “RECENT” de laatste wijzigingen in de voorraad, de verwijzing “Mijn concepten” onder het veld leidt naar je begonnen vastleggingen (alleen als je mag vastleggen), en het menu “…” rechtsboven opent verdere overzichten. Volgende stap: typ je vraag en druk op Enter — of klik een regel in “VOOR JOU” aan, die brengt je direct naar de plek waar de zaak wordt afgehandeld.",
  "seitenhilfe.bibliothek.title": "Bibliotheek: de hele voorraad",
  "seitenhilfe.bibliothek.body":
    "Dit is de volledige kennisvoorraad. Op een breed scherm staat links de lijst en rechts het item dat je leest; op een smal apparaat vult telkens maar één van beide het vlak — zonder keuze de lijst, met keuze het item, en bovenaan brengt de knop “Terug naar Bibliotheek” je weer in de lijst (op een tablet schuift “Resultatenlijst tonen” hem als lade OVER het item, “Resultatenlijst verbergen” haalt hem weer weg). Zoeken doe je met het zoekveld bovenin de kopbalk; filters, sortering, opgeslagen weergaven en export zitten in het menu “…” boven de lijst. Volgende stap: klik een item aan en lees het — is de lijst leeg, dan leidt de knop “Vastleggen” naar de plek waar nieuwe kennis ontstaat, voor zover je rol vastleggen toestaat; anders staat er “Geen toegang”.",
  "seitenhilfe.aufgaben.title": "Open taken: wat hier te doen is",
  "seitenhilfe.aufgaben.body":
    "Hier staat het openstaande werk op één plek: validaties, conflicten, openstaande hervalidaties, open kennishiaten en objecten die voor nawerk bij jou terugkwamen. De gekleurde stip toont de urgentie (rood “Kritiek”, geel “Vandaag”, groen “Later”), de knoppenrij erboven filtert op soort en noemt het aantal, en de “i” bij een regel zegt wat daar te doen is. Volgende stap: klik de bovenste regel aan — die brengt je naar de plek waar de taak wordt afgerond, voor zover dat gebied is vrijgegeven voor jouw rol; anders blijft de weg dicht (conflicten, risico en levenscyclus zijn niet voor elke rol open). Staat er “Niets open.”, dan toont “Hoe gaat het verder?” de mogelijke volgende wegen.",
  "seitenhilfe.wissen.title": "Kennisobject: één uitspraak en haar bewijs",
  "seitenhilfe.wissen.body":
    "Je leest één kennisobject — hetzelfde vlak als de bibliotheek, alleen met dit item voorgeselecteerd: op een breed scherm links de lijst en rechts de uitspraak met status en bron, op een smal apparaat vult het item het vlak alleen en brengt de knop “Terug naar Bibliotheek” bovenaan je naar de lijst. Al het overige — bronnen en bijlagen, versies, historie, opmerkingen, conflicten — zit achter de regel “Meer”; staat je interface op een andere taal en bestaat er een leesvertaling, dan staat die bovenaan, uitdrukkelijk als vertaling benoemd. Volgende stap: lees de uitspraak, kijk naar status en bron, en open “Meer” als je wilt weten waarop ze steunt.",
  // JOB 3768 — de vijfde pagina van dezelfde weg; zie de Duitse regel voor de grondslag per zin.
  "seitenhilfe.entwuerfe.title": "Mijn concepten: verder met wat je begon",
  "seitenhilfe.entwuerfe.body":
    "Hier staan de vastleggingen die als concept zijn opgeslagen en nog geen kennisobject zijn geworden — dezelfde concepten die ook de editor en de werkruimte tonen, alleen op een eigen plek; een tweede conceptopslag is dit niet. Hier staan alleen je eigen concepten: ze zijn privé, niemand anders ziet ze, ook geen beheerder. Het zoekveld boven de lijst doorzoekt uitsluitend deze concepten en geen kennis uit de bibliotheek, “Sorteren” ordent ze op moment van opslaan of op titel. Verwijderde concepten gaan naar de “Prullenbak” onder de lijst: “Herstellen” haalt er een terug, “Definitief verwijderen” haalt hem er echt af, en de prullenbak leegt zichzelf niet. Volgende stap: klik “Hervatten” bij een regel — het concept opent in de editor, en nog niet opgeslagen invoer wordt eerst gevraagd; staat de lijst leeg, dan leidt “Vastleggen” naar de plek waar een nieuw concept ontstaat.",
  "menue.weitereBereiche": "Gebieden",
  "menue.schnellnavigation": "Ga naar …",
  "menue.darstellung": "Weergave",
  "topbar.design.hint": "Ontwerp wisselen — verandert alleen het uiterlijk, geen inhoud of invoer.",
  "topbar.openMenu": "Menu openen",
  "topbar.closeMenu": "Menu sluiten",
  "topbar.menuLabel": "Navigatiemenu",
  "topbar.menuShort": "Menu",
  "topbar.toDesktop": "Naar volledige versie",
  "topbar.notifications": "Meldingen",
  "topbar.notificationsPlaceholder": "Nog geen meldingen. Echte bron volgt (#63).",
  "topbar.reasonerActive": "AI-model antwoordt",
  "topbar.reasonerOffline": "Geen AI-model",
  "topbar.reasonerActiveHint": "Een AI-model heeft onlangs bereikbaar geantwoord.",
  "topbar.reasonerUnverified": "AI-model ongeverifieerd",
  "topbar.reasonerUnverifiedHint":
    "Een AI-model is geconfigureerd, maar de bereikbaarheid is nog niet gecontroleerd.",
  "topbar.reasonerUnreachable": "AI-model onbereikbaar",
  "topbar.reasonerUnreachableHint":
    "Een AI-model is geconfigureerd maar was onlangs niet bereikbaar (bijv. sleutel verlopen, dienst uit). Aanroepen draaien deterministisch.",
  "topbar.reasonerOfflineHint":
    "Geen AI-model beschikbaar — de deterministische reservemodus draait.",
  "topbar.external.blocked": "Webzoeken: geblokkeerd",
  "topbar.external.search": "Webzoeken: toegestaan",
  "topbar.external.open": "Webzoeken: open",
  "topbar.external.hint":
    "Externe kennisopvraging (webzoekopdracht) — een APARTE as, niet het AI-model. Regelt alleen webzoeken/openbare verrijking, niet de reasoner.",
  "topbar.plain.ki":
    "Laat zien waar de AI die Klarwerk gebruikt rekent — in eigen huis of bij een aanbieder op internet.",
  "topbar.plain.reasoner":
    "Laat zien of de AI op dit moment antwoordt. „Ongeverifieerd“ betekent alleen: sinds de start is er nog geen antwoord teruggekomen — het is geen fout.",
  "topbar.plain.external":
    "Laat zien of Klarwerk bij het antwoorden ook op het open internet mag kijken. „Geblokkeerd“ betekent: nee, het blijft bij jullie eigen kennis.",
  "topbar.extern.blockiert": "Extern: Geblokkeerd",
  "topbar.extern.frei": "Extern: Vrijgegeven",
  "topbar.extern.freiVertraulich": "Extern: Vrijgegeven, ook vertrouwelijke inhoud",
  "topbar.extern.hinweis":
    "De beheerder bepaalt of inhoud naar een openbare AI mag. Standaard: geblokkeerd.",
  "topbar.kiExternal": "AI rekent in de cloud",
  "topbar.kiInternal": "AI rekent in eigen huis",
  "topbar.kiMixed": "AI rekent in de cloud en in eigen huis",
  "topbar.kiNone": "Geen AI",
  "topbar.kiNoneSubtitle": "deterministische fallbackmodus",
  "topbar.kiDsgvoYes": "AVG: ja",
  "topbar.kiDsgvoNo": "AVG: nee",
  "topbar.kiExternalHint":
    "Je AI-taken lopen via een cloudmodel buitenshuis — AVG-bevestiging daarom: nee. Een ja krijg je alleen bij een interne AI uit Europa. Details per taak: Beheer → AI.",
  "topbar.kiInternalHint":
    "Je AI-taken lopen volledig via een lokaal model in huis. AVG: ja krijg je alleen hier — en alleen als de AI uit Europa komt. Herkomst wordt nu afgeleid uit de aanbieder-identificatie; in de toekomst geeft de centrale AI-toegangsaansturing die door.",
  "topbar.kiMixedHint":
    "Gemengd gebruik: sommige taken lopen via de externe cloud-AI, andere in huis. De strengste categorie telt — AVG-bevestiging: nee. Details per taak: Beheer → AI.",
  "topbar.kiNoneHint":
    "Er is geen AI-model actief voor een taak. Klarwerk werkt in de deterministische fallbackmodus.",
  "country.us": "VS",
  "country.de": "Duitsland",
  "country.fr": "Frankrijk",
  "country.cn": "China",
  "country.unknown": "Herkomst onbekend",
  "country.ownSystem": "eigen systeem (EU)",
  "topbar.notificationsEmpty": "Geen meldingen.",
  "topbar.notifMarkAll": "Alles gelezen",
  "topbar.notifMarkRead": "Als gelezen markeren",
  // JOB 2709 D4: zie de Duitse versies hierboven — opvangzin en handelingsinformatie.
  "topbar.notifSeenFailed": "De meldingen konden niet als gelezen worden opgeslagen.",
  "topbar.notifSeenReverted": "Ze blijven ongelezen.",
  "topbar.notifOpen": "Openen",
  "topbar.notifAssignment": "Beoordeling voor jou",
  "topbar.notifImpact": "Jouw kennis heeft geholpen",
  "topbar.notifDuplicate": "Mogelijk duplicaat",
  "topbar.notifGapRedacted": "Openstaande kennislacune",
  "cmd.open": "„Ga naar …“ openen",
  "cmd.close": "Sluiten",
  "cmd.placeholder": "Ga naar … (⌘K)",
  "cmd.empty": "Geen resultaat.",
  "cmd.suchfeld": "Doel zoeken",
  "cmd.treffer_one": "{{count}} doel",
  "cmd.treffer_other": "{{count}} doelen",
  "cmd.audit": "Audit-log (in Analytics)",
  "toast.dismiss": "Sluiten",
  "einblendung.erledigt": "Gereed.",
  "page.placeholder":
    "Dit scherm wordt in een latere taak gebouwd. App-shell, navigatie en rollogica staan er al.",
  "status.entwurf": "Concept",
  "status.offen": "Open",
  "status.pruefung": "In beoordeling",
  "status.validiert": "Gevalideerd",
  "status.abgelehnt": "Afgewezen",
  "status.revalidierung": "Hervalidatie",
  "status.konflikt": "Conflict",
  "quality.preliminary": "Voorlopig",
  "quality.reliable": "Betrouwbaar",
  "quality.assured": "Geborgd",
  "evidence.percentSure": "Beoordelingsstand: {{pct}} %",
  "evidence.confidenceLabel": "Beoordelingsstand: {{pct}} van 100",
  "evidence.sourceDate": "Bron van {{date}}",
  "evidence.noDate": "geen brondatum",
  "evidence.noSource": "geen bron vastgelegd",
  "evidence.internalSource": "interne bron",
  "evidence.more": "+{{count}} meer",
  "ko.read.evidenceZone": "Bewijs",
  "ko.read.released": "Vrijgave",
  "ko.read.category": "Categorie",
  "ko.read.responsible": "Verantwoordelijk",
  "ko.read.version": "Versie",
  "ko.read.captured": "Vastgelegd op",
  "ko.read.moreDetails": "Meer details (voorwaarden · maatregelen · tags)",
  "intake.question": "Wat weet jij dat anderen zouden moeten weten?",
  "intake.calming": "Begin gewoon te schrijven — Klarwerk helpt met de structuur.",
  "intake.fieldPlaceholder": "Begin gewoon te schrijven …",
  "intake.removeStarter": "Type verwijderen",
  "intake.exampleLabel": "Zoiets — maar dan van jou.",
  "intake.sampleBadge": "Voorbeeld",
  "intake.starter.decision": "Een beslissing die we hebben genomen",
  "intake.starter.mistake": "Een fout die je makkelijk maakt",
  "intake.starter.howItWorks": "Hoe iets bij ons echt werkt",
  "intake.starter.changed": "Iets dat is veranderd",
  "intake.prefill.decision": "We hebben besloten dat ",
  "intake.prefill.mistake": "Een veelgemaakte fout is ",
  "intake.prefill.howItWorks": "Zo werkt het bij ons: ",
  "intake.prefill.changed": "Wat is veranderd, is dat ",
  "intake.sample.title": "Trek de noodstop vóór elk onderhoud",
  "intake.sample.statement":
    "Trek vóór elk onderhoud aan lijn 3 eerst de noodstop en beveilig deze tegen herinschakelen.",
  "intake.live.idle": "Ik luister …",
  "intake.live.checking": "Controleren tegen jullie kennis …",
  "intake.live.new": "Dit is nieuw — er is nog niets over. Jij bent de eerste.",
  "intake.live.similarLead": "Iets soortgelijks bestaat al:",
  "intake.live.similarAsk": "Aanvullen of nieuw?",
  "intake.live.conflictLead": "Let op — dit kan in tegenspraak zijn met:",
  "intake.live.fundort": "Staat in:",
  "intake.live.pruefstand.offen": "nog niet beoordeeld",
  "intake.live.pruefstand.validiert": "Gevalideerd",
  "intake.live.openKo": "Bekijken",
  "intake.live.unavailable": "Controle momenteel niet beschikbaar.",
  "intake.structure.heading": "Klarwerk stelt voor — tik aan wat niet klopt:",
  "intake.structure.title": "Titel",
  "intake.structure.category": "Categorie",
  "intake.structure.source": "Vermoedelijke bron",
  "intake.structure.derived": "afgeleid uit je tekst",
  "intake.structure.categoryPlaceholder": "bijv. onderhoud, veiligheid …",
  "intake.done.heading": "Klaar.",
  "intake.done.checked": "Opgenomen in jullie gedeelde kennis.",
  "intake.done.credited": "Je naam ({{name}}) staat als auteur vermeld.",
  "intake.done.findable": "Wie er de volgende keer naar vraagt, vindt het — niet jou.",
  "intake.done.viewKo": "Kennisobject bekijken",
  "intake.done.followUp": "Waarschuw me bij vervolgvragen",
  "intake.submit": "Kennis opslaan",
  "dcmp.noValue": "Geen waarde",
  "dcmp.none": "geen",
  "dcmp.trustStatus": "Vertrouwen {{trust}}; status {{status}}; vereiste controles {{needed}}",
  "dcmp.tagsCategory": "Categorie {{category}}; kennistype {{type}}; tags {{tags}}",
  "dcmp.note.koMissing": "Geen score: minstens één kennisobject ontbreekt.",
  "audit.action.ko_created": "Aangemaakt",
  "audit.action.ko_revised": "Herzien",
  "audit.action.ko_rated": "Beoordeeld",
  "audit.action.ko_admin_validated": "Admin-gevalideerd",
  "audit.action.ko_deleted": "Verwijderd",
  "audit.action.ko_purged": "Definitief verwijderd",
  "audit.action.ko_restored": "Hersteld",
  "audit.action.ko_assigned": "Toegewezen",
  "audit.action.ko_attached": "Bijlage toegevoegd",
  "audit.action.ko_detached": "Bijlage verwijderd",
  "audit.action.ko_author_transferred": "Auteur overgedragen",
  "audit.action.ko_category_changed": "Categorie gewijzigd",
  "audit.action.ko_commented": "Becommentarieerd",
  "audit.action.ko_comment_resolved": "Discussie opgelost",
  "audit.action.ko_comment_reopened": "Discussie heropend",
  "audit.action.ko_confidentiality": "Vertrouwelijkheid gewijzigd",
  "audit.action.ko_conflict_review": "Conflictreview",
  "audit.action.ko_returned_to_author": "Terug naar auteur",
  // JOB 557 D8 — zie de Duitse regel voor de bevinding en de tweenamenregel.
  "audit.action.ko_returned_to_owner": "Terug naar eigenaar",
  "audit.action.ko_source_added": "Bron toegevoegd",
  "audit.action.ko_source_removed": "Bron verwijderd",
  // JOB 3384 (UX-26) — s. die Begründung im deutschen Block.
  "audit.action.ask_query": "Vraag gesteld",
  "audit.action.answer_helpful": "Antwoord als nuttig beoordeeld",
  "audit.action.ko_document_appended": "Document toegevoegd",
  "audit.action.ko_ownership": "Verantwoordelijkheden gewijzigd",
  "audit.action.ko_ownership_role": "Verantwoordelijkheid van één rol gewijzigd",
  "audit.action.ko_tags_changed": "Trefwoorden gewijzigd",
  "audit.action.ko_create_followup_failed": "Nawerk na het aanmaken mislukt",
  "audit.action.ko_create_rollback_failed": "Terugdraaien van het aanmaken mislukt",
  // JOB 3140 (UX-11) — zie het Duitse blok voor de toelichting.
  "audit.action.user_role_change": "Rol gewijzigd",
  "audit.action.user_approve": "Account vrijgegeven",
  "audit.action.user_account_corrected": "Accountgegevens gecorrigeerd",
  "audit.action.auth_login": "Aangemeld",
  "audit.action.auth_logout": "Afgemeld",
  "audit.action.notice_acknowledged": "Kennisgeving bevestigd",
  "audit.action.user_oidc_provisioned": "SSO-account aangemaakt",
  "audit.action.user_role_synced": "Rol met provider gesynchroniseerd",
  "audit.action.user_role_claim_missing": "Rolgegeven van provider ontbreekt",
  "audit.detail.event": "Gebeurtenis",
  "audit.detail.actor": "Uitgevoerd door",
  "audit.detail.target": "Betrokken",
  "audit.detail.targetObject": "Betrokken object",
  "audit.detail.systemActor": "Systeem (automatisch)",
  "audit.detail.roleBefore": "Rol daarvoor",
  "audit.detail.roleAfter": "Rol daarna",
  "audit.detail.notStored": "niet opgeslagen",
  "audit.detail.accountGone": "Account bestaat niet meer",
  "audit.detail.nameLoading": "Naam wordt geladen",
  "audit.detail.nameUnavailable": "Naam niet beschikbaar",
  "ktype.bauchgefuehl": "Intuïtie",
  "ktype.best_practice": "Best practice",
  "ktype.lernkurve": "Leercurve",
  "ktype.technik": "Techniek",
  "ktype.negativwissen": "Negatieve kennis",
  "reasoner.draftLabel": "AI-concept · niet gevalideerd",
  "reasoner.taskInfo.title": "Welke AI werkt hier?",
  "reasoner.taskInfo.cloud": "Cloud-AI",
  "reasoner.taskInfo.local": "Lokaal model",
  "reasoner.taskInfo.rule": "Regelgebaseerd (zonder AI-model)",
  "reasoner.taskInfo.unknown": "Wordt bepaald …",
  "reasoner.taskInfo.bodyCloud":
    "Deze taak loopt via een cloud-AI. Inhoud wordt daarvoor naar de externe aanbieder gestuurd.",
  "reasoner.taskInfo.bodyLocal":
    "Deze taak loopt via een lokaal model op jullie eigen hardware — de inhoud verlaat het huis niet.",
  "reasoner.taskInfo.bodyRule":
    "Deze taak loopt puur regelgebaseerd, zonder AI-taalmodel — deterministisch en zonder externe verzending.",
  "reasoner.taskInfo.bodyUnknown":
    "De huidige AI-toewijzing wordt geladen. Details vind je in het AI-beheer.",
  "reasoner.taskInfo.modelLabel": "Model",
  "reasoner.taskInfo.dsgvoInhouse": "AVG-conform",
  "reasoner.taskInfo.dsgvoInhouseBody":
    "Loopt in huis (lokaal of regelgebaseerd) — de gegevens blijven hier en worden niet aan derden doorgegeven.",
  "reasoner.taskInfo.dsgvoExternal": "Externe verwerking",
  "reasoner.taskInfo.dsgvoExternalBody":
    "Maakt gebruik van een externe cloudaanbieder — de AVG-conformiteit hangt af van de verwerkersovereenkomst met de aanbieder.",
  "ai.unavailable.hint": "AI niet beschikbaar — voor deze taak is geen model actief.",
  "ai.statusUnknown.hint":
    "AI-status onbekend — het ophalen van de status is mislukt. Daarom blijft het AI-antwoord uit voorzorg geblokkeerd.",
  "provenance.original": "oorspronkelijk",
  "uikit.sampleStatement": "Drukverlies bij pers P2 zit meestal aan ventiel V4, niet aan de pomp.",
  "state.loading": "Laden …",
  "state.error": "Er is iets misgegaan.",
  "state.staleRefetchFailed": "Stand van {{zeit}} · verversen mislukt",
  "modal.close": "Sluiten",
  "nav.guard.title": "Niet-opgeslagen invoer",
  "nav.guard.body": "Je hebt bij het vastleggen nog niet-opgeslagen inhoud. Wat wil je doen?",
  "nav.guard.stay": "Hier blijven",
  "nav.guard.discard": "Verwerpen en wisselen",
  "nav.guard.save": "Concept opslaan en wisselen",
  "nav.guard.unsavableTitle": "Niet alles kan worden opgeslagen",
  "nav.guard.unsavableLead":
    "Deze inhoud kan het concept niet opslaan — bij wisselen gaat die verloren:",
  "nav.guard.unsavableHint":
    "Blijf hier om die te gebruiken of te verwijderen; „Verwerpen en wisselen” geeft die bewust op. Een opslaan dat deze inhoud meeneemt, bestaat niet.",
  "error.title": "Deze weergave kon niet worden geladen.",
  "error.body":
    "Dit is een weergavefout, geen gegevensverlies. Laad de pagina opnieuw. Treedt het opnieuw op, dan helpt de detailtekst hieronder bij het melden.",
  "error.reload": "Opnieuw laden",
  "error.detail": "Detail",
  "state.empty": "Niets aanwezig.",
  "auth.tagline": "Ervaringskennis die binnen het bedrijf blijft.",
  "auth.taglineSub": "Vastleggen · Valideren · Verhelderen · Beantwoorden · Onderhouden.",
  "auth.title.login": "Aanmelden",
  "auth.title.register": "Account aanmaken",
  "auth.title.waiting": "Bijna klaar",
  "auth.title.setup": "Eerste installatie",
  "auth.sub.login": "Meld je aan met je account.",
  "auth.sub.register": "Maak een account aan — een admin geeft je vrij.",
  "auth.sub.waiting": "Je account wacht op goedkeuring.",
  "auth.sub.setup": "Het eerste account wordt administrator.",
  "auth.waitingNote":
    "Een administrator moet je toegang vrijschakelen. Je krijgt bericht zodra het zover is.",
  "auth.backToLogin": "Terug naar aanmelden",
  "auth.name": "Naam",
  "auth.email": "E-mail",
  "auth.password": "Wachtwoord",
  "auth.passwordRule": "min. 8 tekens",
  "auth.passwordRepeat": "Wachtwoord herhalen",
  "auth.passwordMismatch": "De wachtwoorden komen niet overeen.",
  // WP-VIP2-GATE: zelfregistratie server-side uitgeschakeld (alleen op uitnodiging).
  "auth.registrationDisabled":
    "Registreren kan alleen op uitnodiging — neem contact op met je admin.",
  // JOB 4081: de afwijzing als informatie in plaats van een doodlopende weg (zie de Duitse tekst).
  "auth.registrationClosed.fact":
    "In deze installatie wordt toegang toegekend. Zelf een account aanmaken kan hier niet.",
  "auth.registrationClosed.next":
    "Vraag iemand met beheerdersrechten binnen je bedrijf om een uitnodiging — die richt je toegang in.",
  // JOB 4105: dezelfde situatie, maar ZONDER voorafgaande poging.
  "auth.registrationClosed.upfrontFact":
    "Op deze installatie wordt toegang toegekend en niet zelf aangemaakt. Registreren kan hier niet.",
  "auth.registrationClosed.upfrontNext":
    "Neem contact op met iemand met beheerdersrechten binnen je bedrijf — die maakt je account aan en nodigt je uit.",
  "auth.submit.login": "Aanmelden",
  "auth.submit.register": "Registreren",
  "auth.submit.setup": "Admin aanmaken & starten",
  "auth.toRegister": "Nog geen account? Registreren",
  "auth.toLogin": "Al een account? Aanmelden",
  "auth.toForgot": "Wachtwoord vergeten?",
  "auth.title.forgot": "Wachtwoord opnieuw instellen",
  "auth.sub.forgot": "We sturen je een link om het opnieuw in te stellen.",
  "auth.submit.forgot": "Link sturen",
  "auth.title.forgotSent": "E-mail onderweg",
  "auth.sub.forgotSent": "Controleer je postvak.",
  "auth.forgotNote":
    "Als er een account met dit e-mailadres bestaat, hebben we een link gestuurd om het wachtwoord opnieuw in te stellen. De link is 1 uur geldig.",
  "auth.title.reset": "Nieuw wachtwoord",
  "auth.sub.reset": "Kies een nieuw wachtwoord voor je account.",
  "auth.newPassword": "Nieuw wachtwoord",
  "auth.submit.reset": "Wachtwoord opslaan",
  "auth.resetDone": "Je wachtwoord is gewijzigd. Je kunt je nu aanmelden.",
  "auth.resetInvalid": "Deze link is ongeldig of verlopen.",
  "auth.toSignIn": "Naar aanmelden",
  "auth.or": "of",
  "auth.ssoButton": "Aanmelden met SSO",
  // R-0541: de aanmeldpagina wanneer alleen de bedrijfslogin geldt (KLARWERK_SSO_ONLY).
  "auth.ssoOnlyNote":
    "Op deze installatie meld je je aan met je bedrijfsaccount. Een apart wachtwoord voor Klara is hier niet nodig.",
  // R-0541 (herwerking 2): aanmelden met wachtwoord is uit, maar de bedrijfslogin ontbreekt nog.
  "auth.ssoOnlyMissing":
    "Aanmelden met een wachtwoord is uitgeschakeld, maar de bedrijfslogin is nog niet ingericht. Neem contact op met je IT-afdeling.",
  // R-0560: de bedrijfslogin via SAML.
  "auth.samlButton": "Aanmelden met bedrijfsaccount (SAML)",
  "auth.ssoUnavailable": "SSO is niet geconfigureerd voor deze instantie.",
  "auth.ssoTitle": "SSO-aanmelding",
  "auth.ssoBusy": "Aanmelding wordt afgerond …",
  "auth.ssoIncomplete": "Onvolledig SSO-antwoord. Meld je opnieuw aan.",
  "cycle.title": "De Klarwerk-kenniscyclus",
  "cycle.subtitle": "Kennis wordt vastgelegd, gevalideerd, gebruikt en actueel gehouden.",
  "demo.title": "Demo-/pilotpad in 3 stappen",
  "demo.subtitle":
    "Een klein echt proces: bronvast vragen, bron/vertrouwen/status/versie bekijken, ongecontroleerde kennis ter validatie aanbieden.",
  "demo.proof.label": "Bewijsketen",
  "demo.proof.find": "Kennis vinden",
  "demo.proof.usability": "Bruikbaarheid herkennen",
  "demo.proof.verify": "Bron/vertrouwen/versie controleren",
  "demo.badge.label": "Demovoorbeeld",
  "demo.badge.hint":
    "Voorbeeld-/pilotkennis uit de demo-seed. Alleen herkomst — vervangt geen status, vertrouwen, bron of validatie. Gevalideerd blijft gevalideerd, open blijft open.",
  "ko.externalUnchecked.label": "Bevat externe, ongecontroleerde kennis",
  "ko.externalUnchecked.hint":
    "In dit artikel is kennis overgenomen uit een publieke AI of websearch. Die is extern en ongecontroleerd — controleer het inhoudelijk; het vervangt status/vertrouwen/validatie niet.",
  // JOB 679 / D2 (K1.2): herkomstmarkering voor kennis die via de Word-invoegtoepassing is
  // vastgelegd. Net als het demolabel ALLEEN herkomst — geen kwaliteits- of statussignaal.
  "ko.originWordAddin.label": "Uit Word",
  "ko.originWordAddin.hint":
    "Deze bijdrage is vastgelegd via de Word-invoegtoepassing. Alleen herkomst — vervangt geen status, vertrouwen, bron of validatie.",
  // JOB 3027 · Station 4: klare tekst voor de overige vier vastlegroutes.
  "ko.origin.tell": "Uit het vertellen",
  "ko.origin.studio": "Uit de studio",
  "ko.origin.expert": "Uit het expertformulier",
  "ko.origin.frontdoor": "Uit de vastlegging",
  // R-0180/R-2108: door een mens uit de importcontrolewachtrij overgenomen.
  "ko.origin.import": "Geïmporteerd",
  // JOB 3027 · Station 4: de drie standen per opgave. „niet ingedeeld“ zegt iets over het OBJECT,
  // „niet in dit antwoord“ iets over het ANTWOORD — wie ze samenvoegt, laat de lezer gokken.
  "val.stufe.nichtEingestuft": "niet ingedeeld",
  "val.stufe.auskunftFehlt": "Indeling niet in dit antwoord",
  // JOB 3112 · V3: de vraag naar de vertrouwelijkheidsgraad vóór het vrijgeven — vragen, niet dwingen.
  "val.stufenfrage.frage": "Welke vertrouwelijkheidsgraad geldt voor dit item?",
  "val.stufenfrage.ohneStufe": "Vrijgeven zonder graad",
  "val.stufenfrage.abbrechen": "Annuleren",
  "val.stufenfrage.fehler": "Niet opgeslagen — er is niets vrijgegeven. Probeer het opnieuw.",
  // Ronde 2: de derde uitkomst van de tweetrapsweg — de graad staat er, de vrijgave niet.
  "val.stufenfrage.nurNochFreigeben": "De graad is opgeslagen — alleen de vrijgave ontbreekt nog.",
  "val.stufenfrage.fehlerNachStufe":
    "De graad „{{stufe}}“ is opgeslagen. De vrijgave zelf mislukte — het item is NIET vrijgegeven.",
  "val.stufenfrage.wiederholen": "Vrijgave opnieuw proberen",
  // JOB 3112 · V3: de paarmelding op de beoordelingskaart. Zij zegt DAT, nooit WAT.
  "val.doppel.satz": "Van dit item ligt een tweede exemplaar in de voorraad: {{beziehung}}.",
  "val.doppel.satzMehrere":
    "Van dit item liggen {{n}} overlappende exemplaren in de voorraad — sterkste overlap: {{beziehung}}.",
  "val.doppel.vergleich": "Vergelijking openen",
  // R-0247: uitdrukkelijke bevestiging vóór het valideren zolang er een open duplicaat is.
  "val.doppel.bestaetigung.frage":
    "Voor dit item ligt een open duplicaat. Bevestig dat u het hebt gezien voordat u valideert.",
  "val.doppel.bestaetigung.ja": "Duplicaat gezien — toch valideren",
  "val.doppel.bestaetigung.abbrechen": "Annuleren",
  "val.herkunft.label": "Vastlegroute",
  "val.herkunft.unbekannt": "Herkomst onbekend",
  "val.herkunft.auskunftFehlt": "Herkomst niet in dit antwoord",
  // JOB 3027 R2: de stand blijft staan als een verversing mislukt — en zegt dat ook.
  "val.refreshFailed":
    "De verversing is mislukt. Je ziet de laatst geladen stand — die kan verouderd zijn.",
  "demo.ask.label": "1 · Vragen",
  "demo.ask.desc":
    "Stel een onderbouwde vraag (ventiel X / overdruk) — het antwoord komt bronvast met vertrouwen en status, niet uit de lucht gegrepen.",
  "demo.library.label": "2 · Kennis bekijken",
  "demo.library.desc":
    "Zie in de kennisvoorraad bron, vertrouwen, status en rijpheid — een object openen toont onderbouwing en versie.",
  "demo.validation.label": "3 · Valideren",
  "demo.validation.desc":
    "Open/ongecontroleerde kennis hoort in de validatie — beoordeel het tot het geborgd en bruikbaar is.",
  "demo.captureEntry": "Actief uitproberen: Vastleggen → Controleren → Gebruiken",
  "demo.banner.capture.title": "Ervaringsnotitie vastleggen",
  "demo.banner.capture.body":
    "Er wordt een OPEN kennisobject opgeslagen — nog niet gevalideerd. Volgende stap: naar de beoordeling/validatie. Pas na voldoende beoordeling is het bronvast bruikbaar; niets wordt automatisch gevalideerd.",
  "demo.banner.capture.next": "Verder: naar de beoordeling",
  "demo.banner.tag": "Demopad",
  "demo.banner.ask.title": "Stap 1: Bronvast vragen",
  "demo.banner.ask.body":
    "Het antwoord komt met vertrouwen en bron — niet uit de lucht gegrepen. Let op status/vertrouwen en bekijk daarna de bron/het object.",
  "demo.banner.ask.next": "Verder: kennis bekijken",
  "demo.banner.library.title": "Stap 2: Bron, vertrouwen, status, rijpheid bekijken",
  "demo.banner.library.body":
    "Hier zie je per object bron, vertrouwen, status en rijpheid/versie. Bij een open/ongecontroleerde bron gaat het verder naar de validatie.",
  "demo.banner.library.next": "Verder: valideren",
  "demo.banner.detail.title": "Kennisobject: status, vertrouwen, versie, bronnen controleren",
  "demo.banner.detail.body":
    "Hier zie je waarop de bruikbaarheid berust: status, vertrouwen, versie en onderbouwing. Als het bruikbaar is, staat onderaan „Kennis gebruiken” — de vraag blijft bronvast, niets wordt automatisch geborgd.",
  "demo.banner.validation.title": "Stap 3: Open kennis beoordelen",
  "demo.banner.validation.body":
    "Hier wordt open/ongecontroleerde kennis beoordeeld. Doel: van beoordelingswerk geborgde, bruikbare kennis maken.",
  "cycle.capture.label": "Vastleggen",
  "cycle.capture.desc": "Ervaringskennis borgen als kennisobject.",
  "cycle.validate.label": "Valideren",
  "cycle.validate.desc": "In het team beoordelen tot vertrouwen en status betrouwbaar zijn.",
  "cycle.use.label": "Gebruiken",
  "cycle.use.desc": "Bronvast inzetten in antwoorden en output.",
  "cycle.maintain.label": "Actueel houden",
  "cycle.maintain.desc": "Bij wijzigingen hervalideren — kennis blijft geldig.",
  "kg.start.title": "Zo lees je Klarwerk",
  "kg.start.body":
    "Klarwerk scheidt bruikbare kennis consequent van beoordelingswerk: eerst controleren, dan gebruiken.",
  "kg.library.title": "Rijpheid van de treffers",
  "kg.library.body":
    "De rijpheidsbadge laat zien of een treffer direct bruikbaar is of in de beoordeling thuishoort.",
  "kg.ask.title": "Antwoorden zijn bronvast",
  "kg.ask.body":
    "De vragenpagina gebruikt de kennisvoorraad; open of ongecontroleerde bronnen worden gemarkeerd en naar de validatie geleid.",
  "kg.secured.label": "Geborgd",
  "kg.secured.body":
    "Gevalideerde kennis is bruikbaar en blijft via bronnen, vertrouwen en versie navolgbaar.",
  "kg.review.label": "Te controleren",
  "kg.review.body":
    "Open of in beoordeling zijnde kennis hoort in de validatie, niet in het gebruik.",
  "kg.sourceBound.label": "Bronvast",
  "kg.sourceBound.body":
    "Antwoorden ontstaan uit kennisobjecten — zonder grondslag wordt er een hiaat aangemaakt.",
  // JOB 3015 D5 — zie het DE-blok.
  "start.konsole.frage": "Wat wil je weten?",
  "start.konsole.feld": "Vraag of zoekterm",
  "start.konsole.leitsatz": "Geen AI-antwoord zonder bewijs · Vertrouwelijk blijft vertrouwelijk",
  // JOB 3064 H5 — zie het DE-blok.
  "start.fuerdich.kicker": "VOOR JOU",
  "start.fuerdich.art.conflict": "Conflict",
  "start.fuerdich.art.duplicate": "Duplicaat",
  "start.fuerdich.art.gap": "Kennishiaat",
  "start.fuerdich.art.assignment": "Toewijzing",
  "start.fuerdich.art.impact": "Effect",
  "start.zuletzt.kicker": "RECENT",
  "start.zuletzt.heute": "vandaag",
  "start.zuletzt.gestern": "gisteren",
  "start.zuletzt.leer": "Nog niets vastgelegd.",
  "start.leer.ersterSchritt": "Nog geen kennis in de collectie — leg de eerste vast",
  "start.leer.auffrischung": "wordt ververst …",
  "start.menu.label": "Meer over deze pagina",
  "start.menu.ueber": "Over KLARWERK",
  "start.menu.klara": "Klara in Word",
  "start.menu.kreis": "Kenniscyclus",
  "start.menu.demo": "Demopad",
  "start.menu.erst": "Eerste inrichting",
  "start.menu.gerade": "Nu",
  "start.menu.kapital": "Kenniskapitaal",
  "start.menu.kollision": "Eigen objecten",
  "start.menu.stufe2": "Stap 2",
  "start.menu.hilfe": "Hulp bij deze pagina",
  // AUFTRAG-mega38 BLOCK G1 — zie het DE-blok.
  "start.purpose":
    "Klarwerk verzamelt wat je collega's in het bedrijf hebben geleerd, zodat je ernaar kunt vragen en ziet waar elk antwoord vandaan komt.",
  "start.ctaAsk": "Vraag stellen",
  "start.ctaCapture": "Kennis vastleggen",
  "start.ctaValidate": "Validatie openen",
  "klara.path.ariaLabel": "Klara — aankomende begeleide route",
  "klara.path.kicker": "Met Klara",
  "klara.path.soon": "Binnenkort",
  "klara.path.start.title": "Klara begeleidt kennis vanaf het begin.",
  "klara.path.start.body":
    "Binnenkort kun je kennis direct met Klara vastleggen, structureren en voorbereiden op beoordeling.",
  "klara.path.start.cta": "Kennis vastleggen met Klara",
  "klara.path.capture.title": "Vertel het Klara — zij maakt er een helder concept van.",
  "klara.path.capture.body":
    "Je deelt je ervaring in je eigen woorden. Klara helpt structureren; jij controleert en beslist.",
  "klara.path.capture.cta": "Starten met Klara",
  "klara.path.import.title": "Klara helpt geïmporteerde kennis voor te bereiden.",
  "klara.path.import.body":
    "Na het uploaden helpt Klara straks met ordenen, verduidelijken en voorbereiden op beoordeling.",
  "klara.path.import.cta": "Import met Klara begeleiden",
  "klara.path.helpLink": "Klara helpt je nu al in de webapp — ga hier naar de hulppagina.",
  "klara.path.m365.summary": "Wat Klara in Microsoft 365 gaat doen",
  "klara.path.m365.body":
    "Klara is gepland als bidirectionele add-in voor Microsoft 365. Zij neemt kennis op waar je toch al werkt, bereidt die gestructureerd voor Klarwerk voor en stelt gecontroleerde bedrijfskennis uit Klarwerk rechtstreeks in Microsoft 365 beschikbaar — controleren en beslissen blijft bij jou. Beschikbaar is dit nog niet.",
  "shelp.cycle.title": "De Knowledge-OS-cyclus",
  "shelp.cycle.body":
    "De vier tegels vormen de cyclus van jouw kennis: Vastleggen → Valideren → Gebruiken → Actueel houden. Elke tegel brengt je direct naar het juiste onderdeel. Je hoeft niet alles tegelijk te doen — begin met wat er nu speelt. Er start niets vanzelf.",
  "shelp.work.title": "Jouw werkoverzicht",
  "shelp.work.body":
    "Hier staat wat er nu echt op je wacht — uit echte data (open beoordelingen, conflicten, kennishiaten), geen verzonnen to-dolijst. Het getal rechts zegt hoeveel het er zijn. Klik op een regel om daar direct verder te werken. Doe je niets, dan gebeurt er niets automatisch.",
  "shelp.severity.title": "De gekleurde stippen",
  "shelp.severity.body":
    "De stip links geeft de urgentie aan: Rood = nu aan de beurt (geblokkeerd of kritiek), Geel = vandaag zinvol, Grijs = kan wachten. Dat is alleen een houvast, geen dwang — jij bepaalt de volgorde, en er wordt niets automatisch afgehandeld.",
  "work.conflicts": "Conflicten oplossen",
  "work.criticalGaps": "Kritieke kennishiaten",
  "work.revalidation": "Hervalidaties verschuldigd",
  "work.validation": "Open validaties",
  "work.learning": "Open leerpad-stappen",
  "roleLink.noReach": "Geen toegang",
  "roleLink.noReachHint":
    "Dit gebied is niet vrijgegeven voor jouw rol. Het gegeven blijft staan omdat het klopt — alleen de weg ernaartoe is voor jou dicht.",
  "start.stufe2.title": "Uitgebreide functies (Fase 2)",
  "start.stufe2.body":
    "Fase 2 zijn extra modules naast de kernstroom. Als admin heb je uitgebreide functies tot je beschikking: {{features}}. Zet daarvoor „{{toggle}}' onderaan in de zijbalk aan.",
  "task.kicker": "Taken",
  "task.critical": "Kritiek",
  "task.today": "Vandaag",
  "task.later": "Later",
  "task.none": "Niets open.",
  "task.weiter": "Hoe gaat het verder?",
  "task.erklaerung": "Wat moet er gebeuren?",
  "task.noneFiltered": "Geen item voor dit filter.",
  "task.filter.all": "Alle",
  "task.filter.validation": "Validatie",
  "task.filter.returned": "Nawerk",
  "task.filter.conflict": "Conflicten",
  "task.filter.gap": "Kennishiaten",
  "task.filter.revalidation": "Hervalidatie",
  "task.conflict": "Conflict",
  "task.validation": "Validatie",
  "task.revalidation": "Hervalidatie",
  "task.gap": "Kennishiaat",
  "task.gapRedacted": "Vertrouwelijk kennishiaat",
  "task.returned": "Nawerk",
  "task.action.returned": "Concept herzien",
  "task.action.conflict": "Conflict beslissen",
  "task.action.validation": "Kennis beoordelen",
  "task.action.revalidation": "Geldigheid controleren",
  "task.action.gap": "Hiaat prioriteren",
  "task.action.open": "Openen",
  "task.explain.returned":
    "Een beoordelaar heeft jouw kennis teruggegeven voor nawerk. Open het, verwerk de terugkoppeling en dien het opnieuw in.",
  "task.explain.conflict":
    "Twee uitspraken spreken elkaar tegen. Open het conflict en beslis welke geldt (of leg beide vast).",
  "task.explain.validation":
    "Beoordeel deze kennis en geef een oordeel: Goedkeuren (groen), Navraag (geel) of Afwijzen (rood). Vanaf voldoende groene oordelen geldt het als gevalideerd.",
  "task.explain.revalidation":
    "Er is iets veranderd — bevestig of deze kennis nog geldig is, of geef het terug voor herziening.",
  "task.explain.gap":
    "Voor deze vraag ontbreekt geborgde kennis. Prioriteer het hiaat of leg er zelf een bijdrage voor vast.",
  "task.explain.open": "Open deze taak om de volgende stap te zien.",
  "task.phaseLabel": "Fase:",
  "capture.kicker": "Kennis vastleggen",
  "capture.title": "Ervaringskennis vastleggen",
  "capture.rescue.kicker": "Kennis redden",
  "capture.rescue.title": "Borg ervaringskennis voordat die verloren gaat.",
  "capture.rescue.subtitle":
    "Je hoeft geen formulier perfect in te vullen — vertel gewoon wat je weet. Klarwerk en de AI helpen je het helder en bruikbaar te maken.",
  "capture.rescue.step.tell.label": "1. Vertellen",
  "capture.rescue.step.tell.hint":
    "Schrijf of dicteer in je eigen woorden wat je uit ervaring weet — ruw is prima.",
  "capture.rescue.step.structure.label": "2. AI structureert",
  "capture.rescue.step.structure.hint":
    "De AI maakt er een helder concept van; in de Knowledge Studio kun je alles rustig nabewerken.",
  "capture.rescue.step.validate.label": "3. Laten controleren",
  "capture.rescue.step.validate.hint":
    "Opslaan is genoeg — daarna beoordelen collega's de kennis voordat die betrouwbaar wordt gebruikt.",
  "capture.rescue.impactTitle": "Waarom jouw bijdrage telt",
  "capture.rescue.impact.secure": "Redt ervaring die anders verloren zou gaan",
  "capture.rescue.impact.improve": "Verbetert de gedeelde kennisbasis",
  "capture.rescue.impact.honest": "Wordt pas na beoordeling als betrouwbaar gemarkeerd",
  "capture.rescue.showLess": "Minder",
  "capture.rescue.showMore": "Handleiding",
  "capture.flow.railKicker": "Zo ga je te werk",
  "capture.flow.step.raw.label": "Ruwe kennis vastleggen",
  "capture.flow.step.raw.hint":
    "Vertel in je eigen woorden wat je weet — steekwoorden zijn genoeg.",
  "capture.flow.step.studio.label": "Structureren in de Studio",
  "capture.flow.step.studio.hint":
    "De grote werkruimte met AI-hulp maakt er een helder artikel van — jij neemt bewust over.",
  "capture.flow.step.review.label": "Controleren & indienen",
  "capture.flow.step.review.hint":
    "Opslaan en ter beoordeling geven — pas daarna geldt het als betrouwbaar.",
  "capture.flow.railKickerHint":
    "De Knowledge Studio is de aanbevolen weg — niets wordt afgedwongen.",
  "capture.flow.studioRecommended": "Aanbevolen",
  "capture.flow.studioLead":
    "Aanbevolen volgende stap: rustig structureren in de Knowledge Studio. Het formulier blijft voor je bewaard.",
  "capture.flow.submitValue":
    "Jouw ervaringskennis wordt vastgelegd voordat die verloren gaat — pas na de beoordeling geldt die als betrouwbaar. Er wordt niets automatisch gevalideerd.",
  "capture.wizard.back": "Terug naar vertellen",
  "capture.wizard.structuring": "De AI structureert jouw kennis …",
  "capture.wizard.condMeasures": "Voorwaarden & maatregelen",
  "capture.wizard.condMeasuresHint":
    "Gestructureerd afgeleid uit jouw kennis — belangrijk voor de beoordeling en later gebruik. Pas dit hier zo nodig aan.",
  "capture.wizard.helpers": "Hulpmiddelen, sjablonen & context van bijlagen",
  "capture.wizard.helpersHint": "Optionele ondersteuning — niets hiervan is verplicht.",
  "capture.wizard.docLabel": "Jouw kennispagina",
  "capture.wizard.pageTitle": "Kennispagina bewerken",
  "start.orientation.title": "Oriëntatie: zo lees je Klarwerk & het demopad",
  "start.orientation.hint":
    "Bij het eerste bezoek open — daarna hier ingeklapt en altijd weer uit te klappen.",
  "capture.wizard.titleLabel": "Titel",
  "capture.wizard.structData": "Kernuitspraak, voorwaarden & maatregelen",
  "capture.wizard.discard": "Verwerpen",
  // JOB 1154 D2 — zie het Duitse blok: drie vergrendelde toestanden, drie eigen zinnen.
  "capture.wizard.step.lockedCurrent": "Je bent al in deze stap.",
  "capture.wizard.step.lockedNeedDraft":
    "Nog geen concept: vertel eerst je kennis en laat die structureren.",
  "capture.wizard.step.lockedViaSubmit": "Deze stap opent via „Controleren & indienen”.",
  "ko.couple.title": "Koppeling met installatie",
  "ko.deleteButton": "Kennisobject verwijderen",
  "ko.deleteQ":
    "Verwijderen? De bijdrage gaat naar de prullenbak en is daar 30 dagen door de admin te herstellen. Demogegevens worden meteen definitief verwijderd.",
  "ko.deleteKeep": "Behouden",
  "ko.deleteYes": "Ja, verwijderen",
  "ko.deleteDone": "Kennisobject verwijderd.",
  "ko.deleteAlreadyGone": "Kennisobject bestond al niet meer. Lijst bijgewerkt.",
  "adm.ai.title": "AI-beheer",
  "adm.purgeButton": "Demogegevens verwijderen",
  "adm.purgeQ":
    "Weet je zeker dat je ALLE demogegevens wilt verwijderen (ook door testers gewijzigde)? Je eigen kennis blijft onaangeroerd.",
  "adm.purgeKeep": "Annuleren",
  "adm.purgeYes": "Ja, definitief verwijderen",
  "adm.purgeDone":
    "Demogegevens verwijderd: {{kos}} kennisobjecten, {{conflicts}} conflicten + {{duplicates}} duplicaten opgelost, {{gaps}} kennishiaten, {{users}} demogebruikers.",
  "adm.seedSkippedInline":
    "Niet geladen: de demovoorraad is al aanwezig (geen duplicaten). Gebruik „Demogegevens verwijderen“ om deze te verwijderen en daarna opnieuw te laden.",
  "adm.seedForce": "Demovoorraad opnieuw laden",
  // AUFTRAG-mega64 Block A — zie de Duitse versie voor de onderbouwing.
  "adm.seedCredsTitle": "Eenmalige wachtwoorden van de nieuwe demoaccounts",
  "adm.seedCredsHint":
    "Deze wachtwoorden zijn net willekeurig gegenereerd en worden ALLEEN HIER weergegeven. De server bewaart ze niet en kan ze niet herhalen. Noteer ze of geef ze nu door — bij het opnieuw laden van deze pagina zijn ze weg en hebben de accounts een wachtwoordreset nodig.",
  "adm.factory.title": "Fabrieksinstellingen",
  "adm.factory.help":
    "Zet de lokale instantie volledig terug: alle kennisobjecten, gebruikers, conflicten, hiaten en instellingen worden verwijderd. Daarna sluit het programma zich af; bij de volgende start begint de eerste installatie en wordt de eerste gebruiker weer admin. Alleen beschikbaar in de lokale desktopversie.",
  "adm.factory.hint":
    "Voor herhaalde tests: alles verwijderen en het programma afsluiten. Na de herstart is alles weer zoals bij de eerste installatie.",
  "adm.factory.button": "Terugzetten naar fabrieksinstellingen",
  "adm.factory.confirm1":
    "Weet je zeker dat je ALLE gegevens wilt verwijderen en het programma wilt afsluiten?",
  "adm.factory.passwordLabel": "Ter bevestiging je admin-wachtwoord",
  "adm.factory.confirm2": "Laatste waarschuwing: deze stap is onomkeerbaar.",
  "adm.factory.warnBody":
    "ALLE kennisobjecten, accounts en instellingen worden verwijderd en het programma wordt afgesloten. Dit kan niet ongedaan worden gemaakt.",
  "adm.factory.wrongPassword": "Onjuist wachtwoord — de fabrieksreset is niet uitgevoerd.",
  "adm.factory.cancel": "Annuleren",
  "adm.factory.continue": "Verder",
  "adm.factory.execute": "Terugzetten & afsluiten",
  "adm.factory.restartHint":
    "Teruggezet. Het programma wordt afgesloten — start de KLARWERK-app opnieuw. De eerste gebruiker wordt dan weer admin.",
  "adm.factoryDone": "Fabrieksreset gestart — het programma wordt afgesloten.",
  "capture.tellResetQ": "Wil je de tekst en bijlagen echt verwerpen?",
  "capture.diktatListening": "Opname loopt — praat gewoon, de tekst verschijnt onderin het veld.",
  "capture.diktatIdleHint": "Klik op de knop en vertel — geen formulier, geen voorbereiding.",
  "adm.ai.help":
    "Bepaal globaal of per taak welke AI werkt. „Auto” gebruikt het model als er een sleutel is ingesteld; „Deterministisch” werkt bewust zonder model. Sleutels blijven uitsluitend op de server — nooit in de browser.",
  "adm.ai.internExtern":
    "Je kunt intern (On-Premise Enterprise AI, eigen LLM) of extern (cloud) laten werken — globaal als standaard of fijn per taak. De interne optie verschijnt zodra een eigen LLM bereikbaar is; beide zijn met „Sleutel testen” / „Lokale LLM testen” live te controleren.",
  "adm.ai.status": "Actieve provider: {{provider}} · Modus: {{mode}}",
  "adm.ai.modeModel": "Model",
  "adm.ai.modeDemo": "Deterministisch",
  "adm.sec.konten": "Gebruikers en rollen",
  "adm.sec.ki": "AI",
  "adm.sec.quellen": "Bronnen en gegevens",
  "adm.sec.vorfuehrdaten": "Demo- en voorbeeldgegevens",
  "adm.sec.sicherheit": "Beveiliging en bewijs",
  "adm.sec.berichte": "Rapportages en analyse",
  "adm.sec.system": "Systeem",
  "adm.ziel.demo": "Demogegevens",
  "adm.ziel.demo.syn": "Demo, voorbeeldgegevens, demo data",
  "adm.ziel.protokoll": "Auditlog",
  "adm.ziel.papierkorb.syn": "Prullenbak, verwijderde items, trash, Papierkorb",
  "adm.ziel.ki.syn": "AI-aanbieders en modellen, model, provider, KI",
  "adm.sec.bereitschaft": "Gereedheid",
  "adm.print": "Afdrukken",
  "adm.factory.unavailable":
    "Niet beschikbaar in deze installatie — de fabrieksreset bestaat alleen in desktopmodus.",
  "adm.removeQ": "Account verwijderen?",
  "adm.removeKeep": "Behouden",
  "adm.removeYes": "Ja, verwijderen",
  "einst.titel": "Instellingen",
  "einst.zurueck": "Terug",
  "einst.zeile.nurLesbar": "Alleen lezen",
  "einst.detail.unbekannt": "Deze kaart bestaat niet.",
  "einst.detail.offline": "Offline — de stand kan nu niet worden opgehaald.",
  "einst.an": "aan",
  "einst.aus": "uit",
  "einst.pfad": "Pad",
  "einst.modul.aus": "Module uit",
  "einst.modul.weg": "Inschakelen bij Systeem · Uitgebreide modules",
  "einst.wert.unbekannt": "–",
  "einst.wert.nichtAbrufbar": "niet op te halen",
  "einst.wert.keine": "geen",
  "einst.wert.stand": "stand van {{zeit}}",
  "einst.wert.nichtAktualisiert": "niet bijgewerkt",
  "einst.konten.nutzer": "Gebruikers",
  "einst.konten.leer": "nog geen gebruikers",
  "einst.konten.wartet": "wacht op vrijgave",
  "einst.konten.befristet": "beperkt tot {{datum}}",
  "einst.konten.abgelaufen": "verlopen op {{datum}}",
  "einst.konten.fristUnlesbar": "vervalwaarde onleesbaar",
  "einst.konten.hinzufuegen": "Gebruiker toevoegen",
  "einst.konten.ansichtAus": "uit",
  "einst.konten.nutzerWeg": "Dit account bestaat niet meer.",
  "einst.rollen.kicker": "ROLLEN",
  "einst.rollen.kiWahl": "vrije AI-keuze",
  "einst.rollen.wort.fragen": "vragen",
  "einst.rollen.wort.lesen": "lezen",
  "einst.rollen.wort.erfassen": "vastleggen",
  "einst.rollen.wort.pruefen": "toetsen",
  "einst.rollen.wort.konflikte": "Conflicten",
  "einst.rollen.wort.duplikate": "Duplicaten",
  "einst.ki.grenzen": "Controles en grenzen",
  "einst.ki.aktivZahl": "{{count}} actief",
  "einst.ki.grenzeWert": "{{mb}} MB per bijlage",
  "einst.ki.dupWert": "vanaf {{prozent}} %",
  "einst.daten.demoDa": "{{count}} objecten",
  "einst.daten.demoBestand": "Demo-bestand",
  "einst.daten.werkVerfuegbar": "beschikbaar",
  "einst.daten.werkNicht": "niet beschikbaar",
  "einst.sich.punkte": "{{count}} punten",
  "einst.sich.bereitWert": "{{ok}} van {{gesamt}} zonder waarschuwing",
  "adm.firstrun.kicker": "Eerste start",
  "adm.firstrun.title": "Welkom — je werkruimte staat klaar.",
  "adm.firstrun.lead":
    "Als eerste account ben je admin. Alles wat nodig is, is voorbereid — hier zijn drie rustige eerste stappen. Deze kaart verschijnt alleen bij het eerste bezoek.",
  "adm.firstrun.dismiss": "Verbergen",
  "adm.firstrun.done": "Begrepen — verbergen",
  "adm.firstrun.note":
    "Geen dwang, geen volgorde: je kunt altijd vrij aan de slag. Eenmaal verborgen blijft ze verborgen.",
  "adm.firstrun.ki.loading": "AI-status wordt gecontroleerd …",
  "adm.firstrun.ki.both": "Beide AI's verbonden: cloud-AI en je On-Premise Enterprise AI.",
  "adm.firstrun.ki.cloudOnly":
    "Cloud-AI verbonden. De On-Premise Enterprise AI is nog niet aangesloten (Admin → AI).",
  "adm.firstrun.ki.localOnly":
    "Lokale LLM verbonden. De cloud-AI is nog niet geconfigureerd (Admin → AI).",
  "adm.firstrun.ki.none":
    "Nog geen AI verbonden — de deterministische vervangmodus blijft werken (Admin → AI).",
  "adm.firstrun.step.capture.t": "Kennis vastleggen",
  "adm.firstrun.step.capture.b":
    "Vertel het aan de AI of upload een document — de AI structureert, jij controleert.",
  "adm.firstrun.step.validate.t": "Kennis controleren",
  "adm.firstrun.step.validate.b":
    "In het beoordelingsgedeelte wordt ervaringskennis goedgekeurd — pas dan is die „bruikbaar”.",
  "adm.firstrun.step.admin.t": "Beheer openen",
  "adm.firstrun.step.admin.b": "Accounts, AI-koppeling, gegevens en beveiliging op één plek.",
  "adm.firstrun.doneBadge": "klaar",
  "adm.ready.title": "VIP-gereedheid",
  "adm.ready.help":
    "Een eerlijke status in één oogopslag vóór de test: wat staat er, wat ontbreekt. Elke regel uit echte cijfers, niets mooier gemaakt.",
  "adm.ready.intro":
    "Snelle controleblik vóór de VIP-test — groen betekent klaar, geel controleren.",
  "adm.ready.note":
    "„Openstaande beoordelingen” en het niveau van de externe kennisopvraag zijn neutrale gegevens — geen tekortkoming, alleen context.",
  "adm.ready.ki": "Verbonden AI's",
  "adm.ready.ki.both": "Beide verbonden",
  "adm.ready.ki.partial": "Gedeeltelijk verbonden",
  "adm.ready.ki.none": "Geen verbonden",
  "adm.ready.validated": "Gevalideerde kennis",
  "adm.ready.openReviews": "Openstaande beoordelingen",
  "adm.ready.count": "{{n}}",
  "adm.ready.upload": "Uploadlimieten",
  "adm.ready.upload.val": "{{n}} bijlagen · {{mb}} MB",
  "adm.ready.unknown": "onbekend",
  "adm.ready.loading": "wordt geladen …",
  // JOB 4363 (H6-D1b) — zie het Duitse blok voor de motivering.
  "adm.ready.stand.offline": "niet bijgewerkt — geen netwerkverbinding",
  "adm.ready.stand.netzluecke": "sinds de onderbreking is er geen nieuw antwoord binnengekomen",
  "adm.ready.stand.laeuft": "wordt nu ververst",
  "adm.ready.demo": "Demogegevens",
  "adm.ready.demo.loaded": "{{n}} geladen — te verwijderen onder Gegevens",
  "adm.ready.demo.none": "geen geladen",
  "adm.ready.demo.goto": "Naar Gegevens",
  "adm.ready.external": "Externe kennisopvraag",
  "adm.ready.ext.blocked": "Geblokkeerd",
  "adm.ready.ext.searchOnClick": "Zoeken op klik",
  "adm.ready.ext.searchAttach": "Zoeken & bijvoegen",
  "adm.ready.ext.open": "Open",
  // JOB 4025 — de kaart met de back-upinformatie (spiegel van de DE-sleutels). `none` is een
  // AANGETOONDE negatieve uitspraak (met succes gelezen, map leeg); `unknown` betekent „niet vast
  // te stellen" en mag nooit klinken als `none`; `honesty` benoemt wat de lijst niet bewijst.
  "adm.backup.title": "Back-up",
  "adm.backup.help":
    "Wat ligt er in de back-upmap van deze installatie? De kaart leest die zodra je haar opent: per bestand het tijdstip, de grootte en of het controlesombestand ernaast ligt dat het back-upscript meeschrijft. Ze start geen back-up, verwijdert er geen en downloadt er geen — ze zegt alleen wat er is.",
  "adm.backup.honesty":
    "Dit overzicht toont per gevonden back-upbestand de controlesomstatus. Een controlesomvergelijking en een herstel vinden hier niet plaats — dat controleert de herstelproef allebei.",
  "adm.backup.none": "Geen back-up gevonden in de map {{verzeichnis}}.",
  "adm.backup.unknown": "Niet vast te stellen of er een back-up is.",
  "adm.backup.reason.missing": "De back-upmap bestaat niet.",
  "adm.backup.reason.unreadable": "De back-upmap was niet leesbaar ({{grund}}).",
  "adm.backup.certified": "controlesombestand aanwezig",
  "adm.backup.uncertified": "geen geldig controlesombestand — herstel niet aangetoond",
  "adm.backup.dir": "Map: {{verzeichnis}}",
  "adm.backup.readAt": "Gelezen op {{zeit}}",
  "adm.backup.time.unknown": "Tijdstip onbekend",
  "adm.backup.size.unknown": "Grootte niet meetbaar",
  "adm.backup.size.b": "{{n}} bytes",
  "adm.backup.size.kb": "{{n}} KB",
  "adm.backup.size.mb": "{{n}} MB",
  "adm.backup.age.now": "minder dan een uur geleden",
  "adm.backup.age.hours_one": "{{count}} uur geleden",
  "adm.backup.age.hours_other": "{{count}} uur geleden",
  "adm.backup.age.days_one": "{{count}} dag geleden",
  "adm.backup.age.days_other": "{{count}} dagen geleden",
  // JOB 4109 — siehe den deutschen Block: „2e", aber „20ste"; die Endung hängt an der Zahl, deshalb
  // wird die Nummer als Nummer genannt.
  "adm.backup.seq": "back-up nr. {{n}} van dezelfde seconde",
  "adm.backup.row.none": "geen",
  "adm.backup.row.unknown": "niet vast te stellen",
  "adm.sich.auditTitle": "Auditlog — hash-geschakeld, afwijkingen aantoonbaar",
  "adm.sich.auditHelp":
    "Elke beveiligingsrelevante actie wordt alleen toegevoegd en via een hashketen aan de vorige vermelding gekoppeld. Wordt een vermelding achteraf gewijzigd of verwijderd, dan klopt de hash niet meer — de afwijking is rekenkundig vast te stellen en wordt bij de integriteitscontrole met nummer, datum en actie benoemd. De keten heeft daarbij geen extern verankerd begin: wie volledige schrijftoegang tot de database heeft, kan een vermelding samen met alle volgende hashes opnieuw opbouwen. Het log is dus verifieerbaar (tamper-evident) — de keten houdt een wijziging niet tegen, ze maakt die opvallend.",
  "adm.sich.auditIntro":
    "Append-only, hash-geschakeld: een verifieerbaar spoor van alle beveiligingsrelevante acties. Een latere afwijking op een vermelding is rekenkundig vast te stellen.",
  "adm.sich.auditCount": "{{count}} vermeldingen in de keten",
  "adm.sich.verify.button": "Integriteit controleren",
  "adm.sich.verify.ok": "Integriteit gecontroleerd ✓ — {{count}} vermeldingen, keten sluitend",
  "adm.sich.verify.serialisation":
    "Keten sluitend — {{count}} vermeldingen, geen breuk. Bij {{n}} vermeldingen is de controlesom van de gegevensvelden niet na te rekenen, omdat de database de volgorde van die velden normaliseert. De aanwezige waarden passen bij de opgeslagen hash; geen enkele afwijking blijft onopgelost.",
  "adm.sich.verify.unconfirmed":
    "Keten niet bevestigd — eerste afwijking bij vermelding {{seq}} van {{at}} ({{action}}). Soort: {{kind}}. De oorzaak moet worden onderzocht.",
  "adm.sich.verify.unconfirmedPlain": "Keten niet bevestigd — de oorzaak moet worden onderzocht.",
  "adm.sich.verify.kind.linkage": "keten verbroken",
  "adm.sich.verify.kind.serialisation": "veldvolgorde van de database",
  "adm.sich.verify.kind.unresolved": "controlesom niet op te lossen",
  "adm.sich.verify.kind.unchecked": "controlesom niet onderzocht (te veel veldvolgordes)",
  "adm.sich.dataTitle": "Privacy & beveiliging",
  "adm.sich.dataHelp":
    "Een eerlijk overzicht van de systeemeigenschappen — geen beloftes, maar hoe KLARWERK is gebouwd.",
  "adm.sich.keys.t": "Sleutels blijven in de sleutelhanger",
  "adm.sich.keys.b":
    "API-sleutels staan uitsluitend aan de serverkant of in de macOS-sleutelhanger — nooit in de browser, nooit in de code of repository.",
  "adm.sich.localAi.t": "On-Premise Enterprise AI mogelijk",
  "adm.sich.localAi.b":
    "Naast de cloud-AI kun je een eigen lokale LLM aansluiten. De lokale AI is alleen via een private tunnel bereikbaar, nooit openbaar.",
  "adm.sich.external.t": "Externe kennisopvraag standaard beperkt",
  "adm.sich.external.b":
    "Public-AI en webzoekopdrachten worden door de admin aangestuurd en zijn standaard niet open. Niets verlaat ongecontroleerd het systeem.",
  "adm.sich.audit.t": "Hash-geschakeld auditlog",
  "adm.sich.audit.b":
    "Alle beveiligingsrelevante acties worden append-only en hash-geschakeld vastgelegd. Een latere afwijking op een vermelding is rekenkundig aantoonbaar en wordt bij de integriteitscontrole benoemd (tamper-evident).",
  "adm.sich.trash.t": "Verwijderen met prullenbak",
  "adm.sich.trash.b":
    "Verwijderde items gaan eerst naar de prullenbak (te herstellen); de definitieve verwijdering gebeurt pas na 30 dagen. Geen stil gegevensverlies.",
  "adm.sich.roles.t": "Rollen & minimale rechten",
  "adm.sich.roles.b":
    "Vier rollen (Kijker, Expert, Controller, Admin). Elke actie controleert aan de serverkant het benodigde recht.",
  "adm.sich.noCustomerData.t": "Geen klantgegevens in tests",
  "adm.sich.noCustomerData.b":
    "Kwaliteitsborging en evaluaties verlopen zonder echte klantgegevens.",
  "adm.sich.evidenceNote":
    "Alle cijfers hier zijn live-waarden van deze instantie — gemeten, niet beweerd. Streefwaarden of rekenvoorbeelden worden altijd uitdrukkelijk als zodanig aangeduid.",
  "adm.ai.test": "Sleutel testen",
  "adm.ai.testRunning": "testen …",
  "adm.conflictSelfTest.button": "Conflictdetectie testen",
  "adm.conflictSelfTest.running": "detectie testen …",
  "adm.conflictSelfTest.ok": "Conflict + botsingsvelden + letterlijk bewijs herkend",
  "adm.conflictSelfTest.noModel": "geen model (deterministische vervangmodus) — geen detectie",
  "adm.conflictSelfTest.noConflict":
    "model actief, maar geen conflict herkend (modelfout of oordeel: geen tegenspraak)",
  "adm.conflictSelfTest.noKollision": "conflict herkend, maar botsingsvelden leeg",
  "adm.conflictSelfTest.provider": "Provider: {{provider}}",
  "adm.conflictSelfTest.streitpunkt": "Geschilpunt: {{streitpunkt}}",
  "adm.conflictSelfTest.label": "Conflict",
  "adm.selfTest.button": "Detectie testen (conflict + duplicaat)",
  "adm.selfTest.running": "detectie testen …",
  "adm.dupSelfTest.label": "Duplicaat",
  "adm.dupSelfTest.ok": "Duplicaat herkend (semantisch gelijk, lexicaal verschillend)",
  "adm.dupSelfTest.noModel": "geen model (deterministische vervangmodus) — geen detectie",
  "adm.dupSelfTest.noDuplicate":
    "model actief, maar geen duplicaat herkend (modelfout of oordeel: geen duplicaat)",
  "adm.dupSelfTest.relation": "Relatie: {{relation}}",
  "adm.ai.testOk": "Verbinding oké — {{provider}} heeft geantwoord. De sleutel werkt.",
  "adm.ai.testLocal": "Lokale LLM testen",
  "adm.ai.testLocalOk": "Lokale LLM heeft geantwoord ({{provider}}).",
  // JOB 3420 (UX-10b): de algemene sleuteltip is vervallen — zie de toelichting in het DE-blok.
  "adm.ai.testFail": "Test mislukt: {{detail}}",
  "adm.ai.wiederholen": "Test opnieuw uitvoeren",
  "adm.ai.befund.aelter": "Oudere uitslag van {{zeit}} · een nieuwe test loopt.",
  "adm.ai.befund.aelterOhneZeit": "Oudere uitslag · een nieuwe test loopt.",
  "adm.ai.befund.zitat": "Toelichting van de aanbieder (letterlijk): „{{grund}}”",
  "adm.ai.befund.zugang":
    "De aanbieder heeft de toegang geweigerd (HTTP {{status}}) — de opgeslagen toegangsgegevens werden niet aanvaard.",
  "adm.ai.befund.kontingent":
    "De aanbieder heeft geweigerd wegens quotum of aanvraagsnelheid (HTTP 429).",
  "adm.ai.befund.abgelehnt":
    "De aanbieder heeft de aanvraag afgewezen (HTTP 400) — het bezwaar geldt de aanvraag zelf, niet de toegang.",
  "adm.ai.befund.nichtErreichbar":
    "De aanbieder was niet bereikbaar: netwerkfout of een storing aan zijn kant.",
  "adm.ai.befund.zeitlimit": "De tijdslimiet verstreek voordat de aanbieder antwoordde.",
  "adm.ai.befund.unbrauchbar":
    "De aanbieder heeft geantwoord, maar zonder bruikbare inhoud (leeg of afgebroken).",
  "adm.ai.befund.unbestimmt":
    "Reden niet ingedeeld — deze fout liet zich aan geen enkele gemeten oorzaak toewijzen.",
  "adm.ai.befund.anfrage":
    "De aanvraag aan KLARWERK kwam niet door — er is helemaal geen testresultaat.",
  "adm.ai.befund.lokal.zugang": "De eigen LLM-server heeft de toegang geweigerd (HTTP {{status}}).",
  "adm.ai.befund.lokal.kontingent":
    "De eigen LLM-server heeft geweigerd wegens belasting (HTTP 429).",
  "adm.ai.befund.lokal.abgelehnt":
    "De eigen LLM-server heeft de aanvraag afgewezen (HTTP 400) — het bezwaar geldt de aanvraag zelf.",
  "adm.ai.befund.lokal.nichtErreichbar":
    "De eigen LLM-server was niet bereikbaar: tunnel of server uit, of een netwerkfout ertussen.",
  "adm.ai.befund.lokal.zeitlimit":
    "De tijdslimiet verstreek voordat de eigen LLM-server antwoordde.",
  "adm.ai.befund.lokal.unbrauchbar":
    "De eigen LLM-server heeft geantwoord, maar zonder bruikbare inhoud.",
  "adm.ai.befund.lokal.unbestimmt":
    "Reden niet ingedeeld — deze fout van de eigen LLM-server liet zich aan geen enkele gemeten oorzaak toewijzen.",
  "adm.ai.rat.zugang":
    "Volgende stap: vernieuw de opgeslagen toegangsgegevens van deze aanbieder en start de app opnieuw.",
  "adm.ai.rat.zugangKonto.openai":
    "Volgende stap: vernieuw de sleutel in het startdialoogvenster of de sleutelhanger (service Klarwerk, account OPENAI_API_KEY) en start de app opnieuw.",
  "adm.ai.rat.zugangKonto.anthropic":
    "Volgende stap: vernieuw de sleutel in het startdialoogvenster of de sleutelhanger (service Klarwerk, account ANTHROPIC_API_KEY) en start de app opnieuw.",
  "adm.ai.rat.kontingent":
    "Volgende stap: later opnieuw testen. Een andere sleutel verandert hier niets aan.",
  "adm.ai.rat.abgelehnt":
    "Volgende stap: controleer de model- en parameterkeuze. Een nieuwe sleutel helpt in dit geval niet.",
  "adm.ai.rat.nichtErreichbar":
    "Volgende stap: probeer het nog eens; blijft het zo, dan ligt de storing bij de aanbieder of in het netwerk.",
  "adm.ai.rat.zeitlimit":
    "Volgende stap: start de test opnieuw; blijft het zo, controleer dan modelgrootte en belasting.",
  "adm.ai.rat.unbrauchbar": "Volgende stap: opnieuw testen en de modelkeuze controleren.",
  "adm.ai.rat.anfrage": "Volgende stap: controleer de verbinding en start de controle opnieuw.",
  "adm.ai.rat.lokal.zugang":
    "Volgende stap: controleer adres en toegangsgegevens van de eigen LLM-server (KLARWERK_LOCAL_LLM_URL/_MODEL).",
  "adm.ai.rat.lokal.kontingent":
    "Volgende stap: later opnieuw testen — de eigen LLM-server is momenteel belast.",
  "adm.ai.rat.lokal.abgelehnt":
    "Volgende stap: controleer de modelnaam en parameters van de eigen LLM-server.",
  "adm.ai.rat.lokal.nichtErreichbar":
    "Volgende stap: controleer de tunnel en de eigen LLM-server, test daarna opnieuw.",
  "adm.ai.rat.lokal.zeitlimit":
    "Volgende stap: opnieuw testen; antwoordt de eigen LLM-server structureel te traag, controleer dan model of hardware.",
  "adm.ai.rat.lokal.unbrauchbar":
    "Volgende stap: opnieuw testen en de modelnaam van de eigen LLM-server controleren.",
  "adm.ai.global": "Globaal (standaard voor alle taken)",
  "adm.ai.choice.inherit": "— zoals globaal —",
  "adm.ai.choice.auto": "Auto (model indien beschikbaar)",
  "adm.ai.choice.anbieter": "Extern · {{name}}",
  "adm.ai.choice.anbieterUnavailable": "Extern · {{name}} (niet ingericht)",
  "adm.ai.choice.autoMit": "momenteel {{name}}",
  "adm.ai.choice.local": "Intern · eigen LLM (on-prem)",
  "adm.ai.choice.localUnavailable": "Intern · eigen LLM (niet verbonden)",
  "adm.ai.choice.deterministic": "Deterministisch (zonder model)",
  "adm.ai.envLocked":
    "De AI-toewijzing is vastgelegd via de deploy-configuratie (KLARWERK_REASONER_POLICY) en kan hier niet worden gewijzigd.",
  "adm.ai.migrated":
    "Oude waarde „{{von}}” is overgezet naar {{nach}} — controleer en klik op ‘Toewijzing toepassen’.",
  "adm.ai.dirtyActive": "Gekozen: {{gewaehlt}} · tot het toepassen blijft actief: {{aktiv}}.",
  "adm.ai.deviation": "Afwijkend van de standaard: {{list}}",
  "adm.ai.task.structure": "Structureren",
  "adm.ai.task.assist": "Schrijfpalet (AI-hulp)",
  "adm.ai.task.interview": "Begeleid interview",
  "adm.ai.task.answer": "Vragen beantwoorden",
  "adm.ai.task.select": "Kandidaatselectie",
  "adm.ai.task.extract": "Kennis uit bestand",
  "adm.ai.task.describe": "Afbeeldingsbeschrijving (voorstel)",
  "adm.ai.task.group": "Importkandidaten groeperen",
  "adm.ai.effModel": "Model",
  "adm.ai.effDet": "deterministisch",
  "adm.ai.eff.cloud": "extern",
  "adm.ai.eff.openai": "extern · ChatGPT (OpenAI)",
  "adm.ai.eff.anthropic": "extern · Claude (Anthropic)",
  "adm.ai.eff.local": "intern",
  "adm.ai.eff.deterministic": "deterministisch",
  "adm.ai.save": "Toewijzing toepassen",
  "adm.ai.detail": "Fijnafstemming per taak",
  "adm.ai.detailHint": "optioneel — standaard volstaat meestal",
  "adm.ai.saved": "AI-toewijzing toegepast.",
  "adm.ai.dirtyHint": "Nog niet toegepast — klik op ‘Toewijzing toepassen’.",
  "adm.ai.applied": "Toegepast ✓",
  "adm.ai.persistNote":
    "Wordt op de server opgeslagen en geldt vanaf de volgende aanvraag — ook na herladen, opnieuw aanmelden en herstart.",
  "adm.presets.title": "Eigen AI-functies",
  "adm.presets.help":
    "Het AI-palet in de editor biedt fabrieksfuncties (Helderder, Structureren, Uitbreiden, Spelling, Opmaken). Hier leg je EXTRA, eigen functies voor je organisatie aan — een naam voor de knop en de instructie die de AI krijgt (bijv. „Vat samen voor de dienstoverdracht in 5 steekwoorden”). De instructie is in het palet bij het ?-teken open zichtbaar; zoals altijd geldt: de AI doet alleen een voorstel ter voorbeeld, overnemen doe je bewust met een klik. Fabrieksfuncties kun je niet verwijderen.",
  "adm.presets.hint":
    "Extra functies voor het AI-palet in de editor — telkens een knopnaam en een instructie aan de AI. Zichtbaar voor alle rollen; maximaal 12.",
  "adm.presets.empty": "Nog geen eigen functies — het fabriekspalet geldt ongewijzigd.",
  "adm.presets.name": "Naam van de knop (bijv. Dienstoverdracht)",
  "adm.presets.instruction": "Instructie aan de AI (bijv. Vat samen in 5 steekwoorden …)",
  "adm.presets.add": "Functie toevoegen",
  "adm.presets.save": "Functies opslaan",
  "adm.presets.saved": "Eigen AI-functies opgeslagen.",
  "adm.val.title": "Beoordelingen",
  "adm.val.help":
    "Het standaardaantal beoordelaars geldt voor nieuwe inzendingen zonder eigen opgave. Toegestaan is 1 tot 5. Bestaande bijdragen blijven ongewijzigd; wijzigingen komen in het auditlog.",
  "adm.val.hint":
    "Zoveel beoordelingsbevestigingen heeft een nieuwe bijdrage standaard nodig totdat die als gevalideerd geldt.",
  "adm.val.label": "Standaardaantal beoordelaars (1–5)",
  "adm.val.save": "Opslaan",
  "adm.val.invalid": "Voer een geheel getal tussen 1 en 5 in.",
  "adm.val.saved": "Standaardaantal beoordelaars opgeslagen.",
  "adm.upload.title": "Uploadlimieten",
  "adm.upload.help":
    "Bepaalt hoeveel bijlagen een object mag hebben en hoe groot een afzonderlijke bijlage mag zijn. Geldt voor nieuwe bijlagen; bestaande blijven. Wijzigingen komen in het auditlog.",
  "adm.upload.hint":
    "Deze limieten verschijnen overal waar een bestand kan worden gekozen en worden bij het toevoegen aan de serverkant afgedwongen. De grootte meet het overgedragen bestand inclusief transportcodering (ongeveer 1,34× de zuivere bestandsgrootte).",
  "adm.upload.maxAttachments": "Bijlagen per object (max.)",
  "adm.upload.maxMb": "Grootte per bijlage (MB, max.)",
  "adm.upload.rawHint": "komt overeen met ongeveer {{raw}} MB zuivere bestandsgrootte",
  "adm.upload.save": "Opslaan",
  "adm.upload.saved": "Uploadlimieten opgeslagen.",
  "adm.ext.title": "Externe kennisopvraag",
  "adm.ext.help":
    "Bepaalt of de app externe bronnen (web) en de Public-AI mag gebruiken voor verrijking. Vier niveaus van volledig geblokkeerd tot open. Standaard bewust restrictief. Wijzigingen komen in het auditlog.",
  "adm.ext.hint":
    "Geldt voor het extern bronnen zoeken bij het vastleggen/beoordelen en de Public-AI-verrijking.",
  "adm.ext.save": "Opslaan",
  "adm.ext.saved": "Regelaar voor externe kennisopvraag opgeslagen.",
  "adm.ext.note": "Werkt meteen voor iedereen; de server dwingt de blokkering bovendien af.",
  "adm.dup.title": "Duplicaatdetectie",
  "adm.dup.help":
    "Vanaf welke AI-waarschijnlijkheid een vermoedelijk duplicaat wordt getoond. Lager betekent meer treffers, maar ook meer valse meldingen om weg te klikken.",
  "adm.dup.hint":
    "De AI vergelijkt elke nieuwe bijdrage inhoudelijk met het hele bestand. Deze waarde bepaalt vanaf welke waarschijnlijkheid een treffer op de duplicatenpagina verschijnt.",
  "adm.dup.threshold": "Drempel (%)",
  "adm.dup.save": "Opslaan",
  "adm.dup.saved": "Duplicaatdrempel opgeslagen.",
  "adm.ext.stage.blocked": "Geblokkeerd",
  "adm.ext.stage.search_on_click": "Alleen zoeken op klik",
  "adm.ext.stage.search_attach": "Zoeken + bijvoegen",
  "adm.ext.stage.open": "Open",
  "adm.ext.stageHint.blocked":
    "Externe kennisopvraag volledig geblokkeerd — niets zichtbaar of oproepbaar.",
  "adm.ext.stageHint.search_on_click": "Extern zoeken alleen op uitdrukkelijke klik (standaard).",
  "adm.ext.stageHint.search_attach": "Extern zoeken en resultaten als bron bijvoegen toegestaan.",
  "adm.ext.stageHint.open": "Open: zoeken, bijvoegen en Public-AI-verrijking toegestaan.",
  "enrich.title": "Public-AI-verrijking",
  "enrich.help":
    "Haal extra achtergrondinformatie op bij de Public-AI — uit de modelkennis of uit een onderbouwde webzoekopdracht. Resultaten zijn extern en ongecontroleerd; ze worden alleen op jouw klik in het concept overgenomen en nooit automatisch gevalideerd.",
  "enrich.disclaimer":
    "Extern & ongecontroleerd — controleer inhoudelijk voordat je het overneemt.",
  "enrich.modeModel": "Modelkennis",
  "enrich.modeWeb": "Webzoekopdracht",
  "enrich.placeholder": "Waarnaar zoeken? (bijv. begrip, vraag)",
  "enrich.run": "Verrijken",
  "enrich.running": "Zoeken loopt …",
  "enrich.externBadge": "Extern · ongecontroleerd",
  "enrich.take": "In concept overnemen",
  "enrich.noModel":
    "Geen AI-model verbonden — de Public-AI-verrijking heeft een actief model nodig.",
  "enrich.empty": "Geen externe treffers gevonden.",
  "enrich.disabledHint":
    "Public-AI-verrijking is beschikbaar zodra een admin de externe kennisopvraag op „Open” zet (Admin → Externe kennisopvraag).",
  "enrich.openAdmin": "Naar de admin-instellingen",
  "adm.trash.title": "Prullenbak",
  "adm.trash.help":
    "Verwijderde bijdragen komen hier terecht en blijven 30 dagen te herstellen. Daarna worden ze automatisch definitief verwijderd. Demogegevens verschijnen hier nooit — die worden altijd meteen definitief verwijderd.",
  "adm.trash.empty": "De prullenbak is leeg.",
  "adm.trash.restore": "Herstellen",
  "adm.trash.purge": "Definitief verwijderen",
  "adm.trash.purgeQ": "Deze bijdrage nu definitief verwijderen?",
  "adm.trash.keep": "Behouden",
  "adm.trash.restored": "Bijdrage hersteld.",
  "adm.trash.purged": "Bijdrage definitief verwijderd.",
  "adm.trash.deletedMeta": "Verwijderd door {{name}} op {{date}}",
  "adm.trash.expires": "Definitieve verwijdering over {{days}} dagen",
  "adm.presets.remove": "Functie verwijderen",
  "adm.presets.note":
    "Wordt op de server opgeslagen en overleeft de herstart; sleutels en modellen blijven daardoor onaangeroerd.",
  "adm.ai.accessTitle": "Beschikbare AI's",
  "adm.ai.accessHelp":
    "Toont alle AI-toegangen van deze instantie met een eerlijke status: de twee externe aanbieders ChatGPT (OpenAI) en Claude (Anthropic) afzonderlijk (sleutels alleen aan de serverkant; ‘Actief’ is de in het AI-beheer gekozen, ‘Klaar’ een ingerichte maar niet gekozen), de deterministische vervangmodus die zonder model inspringt, en de geplande lokale LLM-server van Team 2. Welke toegang per taak echt werkt, staat boven in het AI-beheer.",
  "adm.ai.access.openai": "ChatGPT (OpenAI)",
  "adm.ai.access.anthropic": "Claude (Anthropic)",
  "adm.ai.access.fallback": "Deterministische vervangmodus",
  "adm.ai.access.local": "Lokale LLM-server (Team 2)",
  "adm.ai.accessNote":
    "De aansluiting van de lokale LLM-server op de app is gepland (KLLM-61); tot dan draait die alleen op de testbank van Team 2.",
  "adm.ai.state.active": "Actief",
  "adm.ai.state.available": "Klaar",
  "adm.ai.state.missing": "Niet geconfigureerd",
  "adm.ai.state.planned": "Gepland",
  "ko.couple.help":
    "Koppel je deze kennis aan een installatie, dan wordt die bij „Installatie gewijzigd” (levenscyclus) automatisch ter beoordeling gemarkeerd — kennis blijft actueel.",
  "ko.couple.empty": "Nog aan geen enkele installatie gekoppeld.",
  "ko.couple.placeholder": "Installatie-aanduiding, bijv. Lijn L4",
  "ko.couple.cta": "Aan installatie koppelen",
  "ko.couple.done": "Installatie gekoppeld — de levenscyclus bewaakt deze kennis nu gericht.",
  "capture.wizard.discardQ": "Concept echt verwerpen? Je verteltekst blijft bewaard.",
  "capture.wizard.discardKeep": "Behouden",
  "capture.wizard.discardYes": "Ja, verwerpen",
  "capture.wizard.discardDone": "Concept verworpen — je verteltekst is er nog.",
  "capture.wizard.upload": "Tekst uit bestand of afbeelding invoegen",
  "capture.wizard.attach": "Bestand of afbeelding bijvoegen",
  "capture.wizard.attached":
    "{{count}} bestand(en) bijgevoegd — zichtbaar onder „Uitgebreide details”.",
  "capture.wizard.uploadCount":
    "{{count}} bijlage(n) erbij — tekst uit documenten staat al bovenin het veld, details onder „Uitgebreide details”.",
  "capture.gapContextTitle": "Uit openstaand kennishiaat",
  "capture.gapContextBody":
    "Dit is een openstaande vraag, nog geen kennis — die dient alleen als startcontext. Vul je ervaring/waarneming aan; de AI structureert daaruit een concept, jij controleert en dient in.",
  "capture.gapDraftQuestion": "Openstaande vraag",
  "capture.gapDraftExperience": "Eigen ervaring/waarneming aanvullen",
  "capture.gapStepsTitle": "Jouw werkopdracht:",
  "capture.gapSavedNote":
    "Na de validatie kan de kennisbasis deze vraag voortaan beter beantwoorden. Het kennishiaat wordt niet automatisch gesloten — de beoordeling beslist.",
  "capture.savedTitle": "Kennisobject opgeslagen.",
  "capture.savedStatusBadge": "Status: open — nog niet gevalideerd",
  // AUFTRAG-mega70 BLOCK C: beschrijft het proces in plaats van een handeling te vragen die de
  // rol niet kan uitvoeren (/validierung vereist controller).
  "capture.savedBody":
    "Opgeslagen als je eigen kennis (geen demovoorbeeld), maar nog niet gevalideerd. Bruikbare kennis wordt het pas wanneer het in de validatie voldoende beoordeeld is. Er wordt niets automatisch gevalideerd.",
  "capture.savedFromDraft":
    "Je voortgezette concept is als openstaande kennis ingediend en uit je concepten verwijderd.",
  // WP-SHIP9-S1 (Pedis B3): de ECHTE controlestatus op de bevestigingskaart.
  // D-AISTATE PAKET 2 (bens V3): zonder AI loopt alleen de deterministische duplicaat-/overlapcontrole —
  // er is geen deterministische conflictcontrole (alleen AI vindt conflicten). De "(met AI)"-varianten
  // noemen conflicten.
  "capture.aiCheck.running":
    "Duplicaat-/overlapcontrole loopt … het resultaat verschijnt hier zodra deze is afgerond.",
  "capture.aiCheck.runningAi":
    "Duplicaat-/conflictcontrole (met AI) loopt … het resultaat verschijnt hier zodra deze is afgerond.",
  "capture.aiCheck.done":
    "Duplicaat-/overlapcontrole afgerond (zonder AI) — details in de validatie.",
  "capture.aiCheck.doneAi":
    "Duplicaat-/conflictcontrole (met AI) afgerond — details in de validatie.",
  "capture.aiCheck.failed":
    "Controle mislukt: {{reason}} Je kunt deze in de validatie opnieuw starten.",
  "capture.savedFilesNote":
    "{{count}} bijlage(n) zijn nu als veilige objectreferentie opgeslagen en in de editor van het kennisobject als bewijs te koppelen. Bewijs is context — het vervangt de validatie niet.",
  "capture.attachTooLarge":
    "„{{name}}“ is te groot voor een bijlage (uploadlimiet overschreden) — het bestand is niet opgeslagen; de tekstimport blijft behouden.",
  "capture.originalAttachFailed":
    "Origineel bestand „{{name}}“ kon niet als bijlage worden veiliggesteld — de tekstimport blijft behouden.",
  "capture.attachFailedTitle": "Niet alle bijlagen konden worden veiliggesteld",
  "capture.attachFailedBody":
    "Je kennisobject is open opgeslagen. Dit bestand/deze bestanden zijn NIET bijgevoegd: {{names}}. De opgeslagen kennis blijft daardoor onaangeroerd — bewijs vervangt de validatie niet.",
  "capture.attachFailedNext":
    "Volgende stap: kennisobject openen en het bestand/de bestanden daar opnieuw bijvoegen.",
  "capture.sourceMissingTitle": "Overgenomen inhoud zonder herkomstvermelding",
  "capture.sourceMissingBody":
    "Je kennisobject is opgeslagen en bevat de uit het document overgenomen tekst. De bijbehorende herkomstvermelding kon NIET worden vastgelegd ({{count}}): {{names}}. Daarmee staat er inhoud zonder bewijs — precies wat dit product niet stilzwijgend accepteert.",
  // JOB 4367: `capture.sourceMissingNext` staat nu in `texte/ux08.ts`.
  // AUFTRAG-mega21 Block C-1 / C-2 — zie het Duitse blok voor de onderbouwing.
  "capture.followUpsFailedTitle": "Opgeslagen — maar een vervolgstap liep niet",
  "capture.followUpsFailedBody":
    "Je kennisobject is volledig opgeslagen en onderbouwd. NA het opslaan is het volgende niet doorlopen: {{steps}}. Dat verandert niets aan de opgeslagen kennis — er blijft wel iets openstaan, en niemand anders vertelt het je.",
  "capture.followUp.draftDiscard": "concept verwijderen",
  "capture.followUp.draftDiscardNext":
    "Het concept staat nog in je conceptenlijst. Je kunt het daar verwijderen — het ingediende kennisobject blijft ongemoeid.",
  "capture.followUp.validationAssign": "beoordelaars toewijzen",
  "capture.followUp.validationAssignNext":
    "Er wacht niemand op dit kennisobject. Open Validatie en wijs de beoordelaars daar opnieuw toe.",
  "capture.followUp.notifyAssignment": "beoordelaars informeren",
  "capture.followUp.notifyAssignmentNext":
    "De toewijzing staat, alleen het bericht ging niet uit. Laat het de toegewezen beoordelaars weten.",
  "capture.followUp.aiCheck": "duplicaat-/conflictcontrole starten",
  "capture.followUp.aiCheckNext":
    "De controle staat als mislukt genoteerd en kan op de validatiepagina opnieuw worden gestart.",
  // AUFTRAG-mega23 Block B (bens SB-G): de regel hierboven veronderstelt een GESCHREVEN notitie.
  // Ontbreekt het bewijs, dan geldt deze — hij belooft geen herhaling die het endpoint zou weigeren.
  "capture.followUp.aiCheckUnrecordedNext":
    "Ook de mislukking-notitie zelf kon niet worden opgeslagen — er staat voor dit kennisobject dus GEEN herhaalbare controletaak klaar. Bekijk het object in Validatie handmatig op duplicaten en tegenstrijdigheden.",
  "capture.followUp.unknown": "een stap die deze interface nog niet kent",
  "capture.followUp.unknownNext":
    "Deze versie van de interface kent de stap niet bij naam. Hij staat in het auditspoor van het kennisobject — kijk daar.",
  "capture.anchorsMissingTitle":
    "Een beveiligd origineel ontbreekt — overgenomen tekst is niet geladen",
  "capture.anchorsMissingBody":
    "Bij dit concept horen {{count}} beveiligde originele document(en) die er niet meer zijn. De daaruit overgenomen tekst en de bijbehorende bronvermeldingen zijn daarom NIET geladen: dat zou inhoud zonder herkomst zijn, en dat slaat dit product niet stilzwijgend op. Je eigen werk — titel, uitspraak, voorwaarden, maatregelen, beoordelaarskeuze — is volledig aanwezig.",
  "capture.anchorsMissingNext":
    "Zolang deze melding staat, is „Als concept opslaan“ geblokkeerd: opslaan zou nu de uitgedunde stand over de opgeslagen stand schrijven.",
  "capture.anchorsMissingReselect": "Origineel opnieuw kiezen",
  "capture.anchorsMissingAck": "Zonder het origineel verdergaan",
  "capture.restartOfferTitle": "Deze bewerking kan niet worden herhaald",
  "capture.restartOfferBody":
    "De bewerkingssleutel van deze indiening hoort al bij een afgeronde bewerking met andere inhoud. Je huidige tekst staat er onveranderd en gaat niet verloren. Om hem op te slaan is een NIEUWE bewerking nodig — dat beslis jij, niet de interface.",
  "capture.restartOfferAction": "Nieuwe bewerking beginnen",
  "capture.appendUnclearTitle": "Overname met onduidelijke uitkomst",
  "capture.appendUnclearBody":
    "Je kennisobject is opgeslagen. Bij de overname uit {{names}} brak de verbinding af voordat de server antwoordde: die kan wel of niet zijn voltooid. Er is NIETS teruggenomen — blind opruimen zou hier de schade juist hebben aangericht. Open het kennisobject en kijk na of de overgenomen inhoud met herkomst er staat.",
  "own.empty.title": "Nog geen eigen kennis hier",
  "own.empty.hint":
    "Je filtert op eigen kennis (geen demovoorbeelden). Zelf vastgelegde kennis verschijnt hier na het opslaan en wacht dan op de beoordeling.",
  "own.empty.cta": "Eigen kennis vastleggen",
  "studio.open": "Bewerken in de Knowledge Studio",
  "studio.title": "Knowledge Studio",
  "studio.subtitle":
    "Ruime werkomgeving met AI-hulp. Wijzigingen worden pas naar het concept geschreven als je ze overneemt — geen automatisch opslaan, geen automatische validatie.",
  "studio.apply": "Overnemen in het concept",
  "studio.cancel": "Verwerpen",
  "studio.close": "Sluiten",
  "studio.viewSimple": "Eenvoudig",
  "studio.viewStructured": "Gestructureerd",
  "studio.viewSwitch": "Weergave: eenvoudig of gestructureerd",
  "studio.attachFromDisk": "Bestand/afbeelding van je computer toevoegen",
  "studio.d44.gliederung": "Overzicht",
  "studio.d44.keineUeberschriften": "Geen koppen in dit artikel",
  "studio.state.dirty": "Niet overgenomen",
  "studio.state.clean": "Geen wijzigingen in de studio",
  "studio.confirmDiscard.q": "Niet-overgenomen wijzigingen verwerpen?",
  "studio.confirmDiscard.keep": "Verder bewerken",
  "studio.confirmDiscard.discard": "Verwerpen",
  "studio.fremdfassung.hinweis":
    "Buiten is een nieuwere versie ontstaan. Overnemen schrijft jouw versie eroverheen.",
  "studio.applied":
    "Uitgebreide inhoud uit de studio overgenomen in het concept. Opslaan of een revisie doe je pas via de bestaande knop — er wordt niets automatisch opgeslagen of gevalideerd.",
  "studio.save.capture.title": "Studio-inhoud in het concept — nog niet opgeslagen",
  "studio.save.capture.hint":
    "De inhoud die je in de studio hebt overgenomen staat in het concept, maar is nog niet opgeslagen of gevalideerd.",
  "studio.save.capture.next":
    "Volgende stap: opslaan/indienen — daarna volgt de beoordeling (review/validatie). Er wordt niets automatisch gevalideerd.",
  "studio.save.revision.title": "Studio-inhoud in het revisieconcept — nog niet opgeslagen",
  "studio.save.revision.hint":
    "De inhoud die je in de studio hebt overgenomen staat in het revisieconcept, maar is nog niet opgeslagen.",
  "studio.save.revision.next":
    "Opslaan maakt een nieuwe versie aan en start de beoordeling opnieuw — geen automatische goedkeuring.",
  "studio.fromDraft.cta": "Concept als artikel structureren in de studio",
  "studio.fromDraft.hint":
    "Maakt van je concept (uitspraak, voorwaarden, maatregelen, tags) een gestructureerd artikelvoorstel — controleer en vul het aan. Bestaande inhoud wordt toegevoegd, niet overschreven; er wordt niets automatisch gevalideerd.",
  "studio.section.context": "Structuur & context",
  "studio.section.editor": "Inhoud bewerken",
  "studio.section.assist": "AI-hulp",
  "studio.guide.structure.label": "Structureren",
  "studio.guide.structure.hint": "Structureer met koppen, stappen en accenten.",
  "studio.guide.assist.label": "AI laten controleren",
  "studio.guide.assist.hint":
    "Laat de AI het duidelijker maken/structureren — controleer het voorstel, neem het niet blind over.",
  "studio.guide.preview.label": "Voorbeeld",
  "studio.guide.preview.hint": "Bekijk hoe de bijdrage er straks uitziet.",
  "studio.guide.apply.label": "Overnemen",
  "studio.guide.apply.hint":
    "Neem het bewust over in het concept — er wordt niets automatisch opgeslagen.",
  "studio.guide.thenSave": "daarna opslaan & laten beoordelen",
  "studio.coach.story":
    "Je redt ervaringskennis. De AI helpt bij het structureren — pas door de beoordeling van je collega's wordt het geborgd.",
  "studio.coach.firstRun":
    "Begin hier: vertel je kennis in je eigen woorden. Structuur, AI-hulp en voorbeeld komen stap voor stap.",
  "studio.coach.nextPrefix": "Volgende stap",
  "studio.coach.reason.start": "Begin met je ervaring — zelfs een ruwe aanzet is waardevol.",
  "studio.coach.reason.improve":
    "Laat de AI helpen met structureren en aanscherpen, of voeg zelf koppen en stappen toe.",
  "studio.coach.reason.preview": "Bekijk in het voorbeeld hoe je bijdrage straks overkomt.",
  "studio.coach.reason.apply":
    "Ziet het er goed uit? Neem het concept bewust over — opslaan en beoordelen gebeurt daarna.",
  "studio.contrib.title": "Jouw bijdrage",
  "studio.contrib.level.empty.label": "Leeg",
  "studio.contrib.level.empty.hint": "Begin met schrijven — zelfs een ruwe aanzet is waardevol.",
  "studio.contrib.level.draft.label": "Concept",
  "studio.contrib.level.draft.hint":
    "Goed begin. Een paar stappen maken het duidelijker en nuttiger.",
  "studio.contrib.level.solid.label": "Solide",
  "studio.contrib.level.solid.hint":
    "Duidelijk gestructureerd — klaar om over te nemen en te laten beoordelen.",
  "studio.contrib.strengthsTitle": "Al goed",
  "studio.contrib.strength.text": "Echte inhoud aanwezig",
  "studio.contrib.strength.headings": "Met koppen gestructureerd",
  "studio.contrib.strength.steps": "Stappen als lijst",
  "studio.contrib.strength.highlights": "Belangrijke punten uitgelicht",
  "studio.contrib.strength.links": "Verwijzingen/links aanwezig",
  "studio.contrib.strength.evidence": "Bewijs/bijlagen aanwezig",
  "studio.contrib.suggestionsTitle": "Maakt het sterker",
  "studio.contrib.suggestion.detail": "Wat meer detail toevoegen",
  "studio.contrib.suggestion.headings": "Koppen voor secties",
  "studio.contrib.suggestion.steps": "Stappen als lijst toevoegen",
  "studio.contrib.suggestion.referenceAttachments": "Bijlagen in de tekst benoemen",
  "studio.contrib.valueNote":
    "Jouw ervaringskennis telt — pas na de beoordeling door collega's wordt het geborgd.",
  "studio.tips.title": "Zo werk je in de studio",
  "studio.tips.select.label": "Selecteren → opmaken",
  "studio.tips.select.hint":
    "Selecteer tekst en zet die dan via de werkbalk vet/cursief — of gebruik de vertrouwde toetsen.",
  "studio.tips.structure.label": "Structuur via H2/H3",
  "studio.tips.structure.hint":
    "Structureer secties met kop 2 en 3, stappen als lijsten — dat maakt de inhoud leesbaar.",
  "studio.tips.ai.label": "AI-voorstel controleren",
  "studio.tips.ai.hint":
    "De AI-hulp rechts maakt een voorstel — eerst controleren, dan bewust overnemen. Er wordt niets automatisch opgeslagen.",
  "studio.tips.blocks.label": "Templates & blokken gericht inzetten",
  "studio.tips.blocks.hint":
    "Sjablonen geven een structuur; info-/opmerking-/waarschuwing-/succesblokken lichten belangrijke punten uit.",
  "studio.view.edit": "Bewerken",
  "studio.view.preview": "Voorbeeld",
  "studio.preview.empty":
    "Nog geen inhoud — schrijf in de editor en bekijk hier daarna het voorbeeld.",
  "studio.preview.note":
    "Het voorbeeld toont het huidige concept, geen gevalideerde kennis. Overnemen schrijft alleen naar het lokale concept; opslaan/indienen/reviseren volgt daarna via de bestaande knoppen.",
  "capture.savedViewKo": "Object bekijken",
  "capture.savedViewLibrary": "Bekijken in de bibliotheek (eigen kennis)",
  "capture.savedValidate": "Ter beoordeling aanbieden",
  "capture.savedAgain": "Nog iets vastleggen",
  "capture.mode.freitext": "Vrije tekst",
  "capture.mode.formular": "Formulier",
  "capture.mode.diktat": "Dictaat",
  "capture.mode.interview": "Begeleid interview",
  "capture.mode.datei": "Uit bestand",
  "capture.file.hint":
    "Upload een document — de AI toont welke kennis erin zit, telkens met een letterlijke bewijsplaats. Jij kiest wat wordt overgenomen; er wordt niets automatisch opgeslagen.",
  // JOB 3196 (UX-19): de uitleg van de WEG „hele document" — inlezen, precies één concept met de
  // volledige inhoud, daarna zelf openen en beoordelen. Geen AI-keuze, geen validatie, geen indiening.
  "capture.file.hintWhole":
    "Upload een document — Klarwerk leest het in en maakt er precies één concept van met de volledige inhoud. Daarna open je het concept en beoordeel je het zelf; er wordt niets automatisch gecontroleerd of ingediend.",
  "capture.file.upload": "Document selecteren",
  "capture.file.replace": "Ander document kiezen",
  "capture.file.remove": "Document verwijderen",
  "capture.file.dropHint": "Sleep een bestand hierheen — of kies er hieronder een.",
  // AUFTRAG-mega34 D1: de knop zegt wat hij doet.
  "capture.file.pick": "Bestand kiezen",
  "capture.file.dropActive": "Laat het bestand hier los …",
  "capture.file.dropReject":
    "„{{name}}“ wordt hier nog niet ondersteund — sleep een tekst-, Word-, PDF-, PPTX- of afbeeldingsbestand.",
  "capture.file.extracting": "„{{name}}“ lezen …",
  "capture.file.loaded": "„{{name}}“ gelezen — klaar voor het zoeken naar kennis.",
  "capture.file.empty": "In „{{name}}“ is geen tekst gevonden.",
  "capture.file.emptyPdf":
    "In „{{name}}“ is geen tekst gevonden — een gescande PDF zonder tekstlaag wordt nog niet ondersteund.",
  "capture.file.emptyPptx":
    "In „{{name}}“ zijn geen overneembare teksten gevonden (presentatie met alleen afbeeldingen). Er is niets opgeslagen — je kunt het origineel indien nodig handmatig als bestand toevoegen.",
  "capture.file.pdfTruncated": "Alleen de eerste {{count}} pagina's geïmporteerd.",
  "capture.file.pptxTruncated": "Alleen de eerste {{count}} dia's geïmporteerd.",
  "capture.slides.toggle": "Dia's als afbeeldingen overnemen.",
  "capture.slides.toggleHint":
    "Bij PowerPoint-bestanden wordt elke dia extra als afbeelding aan de bijdrage toegevoegd (sectie diaweergave). De omzetting draait op de server en kan even duren.",
  "capture.slides.heading": "Diaweergave",
  "capture.slides.converting": "Dia's van {{name}} worden op de server naar afbeeldingen omgezet …",
  "capture.slides.done": "{{count}} dia('s) als afbeelding toegevoegd.",
  "capture.slides.truncated": "Alleen de eerste {{max}} dia's zijn omgezet (harde limiet).",
  "capture.slides.dropped":
    "{{count}} dia-afbeelding(en) pasten niet meer in het bijdragebudget en zijn weggelaten.",
  "capture.slides.busy":
    "De server zet momenteel een andere presentatie om — probeer het importeren zo dadelijk opnieuw. De tekstimport is volledig.",
  "capture.slides.unavailable":
    "De diaweergave is op deze server momenteel niet beschikbaar. De tekstimport is volledig.",
  "capture.slides.timeout":
    "De server is nog bezig of niet bereikbaar — het omzetten van de dia's is aan de clientzijde afgebroken; de tekstimport blijft volledig behouden.",
  "capture.slides.failed":
    "De dia's konden niet naar afbeeldingen worden omgezet. De tekstimport is volledig.",
  // JOB 2687 D1: „te lang" en „kapot" zijn twee meldingen — elk zegt wat je kunt doen.
  "capture.slides.serverTimeout":
    "De omzetting duurde te lang en is afgebroken — probeer een kleinere presentatie (minder dia's of kleinere afbeeldingen). De tekstimport is volledig.",
  "capture.slides.invalid":
    "De presentatie kon niet als dia-afbeeldingen worden gelezen — het bestand is beschadigd of geen leesbaar .pptx. Probeer een ander bestand. De tekstimport is volledig.",
  "capture.file.pptxTooLarge":
    "„{{name}}“ is te groot of te sterk gecomprimeerd voor een veilige import en is NIET gelezen. Verklein of splits de presentatie.",
  // JOB 2700 D1: de PDF-grens vóór de parser en de tijdslimiet van de parser — beide gezegd, niet blijven hangen.
  "capture.file.pdfTooLarge":
    "„{{name}}“ is met {{mb}} MB te groot voor de import (grens {{limitMb}} MB) en is NIET gelezen. Splits het document — het origineel blijft onaangeroerd.",
  "capture.file.pdfTimeout":
    "„{{name}}“ kon niet binnen {{s}} seconden worden gelezen — de import is afgebroken. Verklein of splits het document.",
  "capture.file.pptxImagesFormat":
    "{{count}} afbeeldingen konden niet worden overgenomen — formaat niet ondersteund.",
  "capture.file.pptxImagesBudget":
    "{{count}} afbeeldingen konden niet worden overgenomen — te groot om in te sluiten.",
  "capture.file.imagesOnlyNoText":
    "Afbeeldingen overgenomen — zonder tekst zijn er geen KI-voorstellen mogelijk.",
  "capture.file.imagesAllDropped":
    "De afbeeldingen konden niet in het artikel worden overgenomen (te groot of formaat niet ondersteund) — het origineel gaat bij het opslaan mee als bijlage.",
  // JOB 513/D3B — zie het Duitse blok: de regel hierboven zegt een bijlage toe; zonder veiliggesteld
  // origineel heeft die toezegging geen dekking.
  "capture.file.imagesAllDroppedNoOriginal":
    "{{dropped}} afbeelding(en) konden niet in het artikel worden overgenomen, en het origineel kon NIET als bijlage worden veiliggesteld — die afbeeldingen zijn verloren.",
  "capture.file.imagesDefect":
    "{{count}} afbeelding(en) konden niet worden gelezen — de verwijzing in het bestand is defect of het afbeeldingsbestand ontbreekt.",
  "capture.file.imagesOutsidePath":
    "{{count}} afbeelding(en) liggen buiten het overgenomen diagebied (bijvoorbeeld achtergrondafbeeldingen) en zijn niet overgenomen.",
  "capture.file.imagesBudgetBodyHtml":
    "Grens „artikeltekst”: {{count}} afbeelding(en) pasten niet meer in het artikel (hoogstens {{limitBytes}} byte; nodig waren {{actualBytes}}).",
  "capture.file.imagesBudgetSingleImage":
    "Grens „losse afbeelding”: {{count}} afbeelding(en) zijn op zichzelf te groot (hoogstens {{limitBytes}} byte per afbeelding; de grootste had {{actualBytes}}).",
  "capture.file.imagesBudgetTotalImages":
    "Grens „som van alle afbeeldingen”: {{count}} afbeelding(en) zouden de totale omvang van alle afbeeldingen hebben overschreden (hoogstens {{limitBytes}} byte; nodig waren {{actualBytes}}).",
  "capture.file.imageCaptionPlaceholder": "Nog geen afbeeldingsbeschrijving",
  "capture.file.captionsBalance":
    "{{assigned}} afbeeldingsonderschrift(en) uit het document overgenomen · {{ambiguous}} niet eenduidig toe te wijzen (leeg gelaten).",
  "capture.file.captionsBalanceAssigned":
    "{{assigned}} afbeeldingsonderschrift(en) uit het document overgenomen.",
  "capture.file.captionsBalanceAmbiguous":
    "{{ambiguous}} afbeeldingsonderschrift(en) in het document gevonden, maar niet eenduidig toe te wijzen (leeg gelaten).",
  "capture.file.imagesKept":
    "{{kept}} afbeeldingen overgenomen, waarvan {{compressed}} gecomprimeerd voor de tekstweergave; het ongewijzigde origineel zit in de bijlage.",
  "capture.file.imagesKeptDropped":
    "{{kept}} afbeeldingen overgenomen, waarvan {{compressed}} gecomprimeerd; {{dropped}} weggelaten vanwege de grootte. Het ongewijzigde origineel zit in de bijlage.",
  "capture.file.imagesNoOriginal":
    "{{kept}} afbeeldingen overgenomen, waarvan {{compressed}} gecomprimeerd; het origineel kon NIET als bijlage worden veiliggesteld.",
  "capture.file.imagesLost":
    "{{kept}} afbeeldingen overgenomen, waarvan {{compressed}} gecomprimeerd; {{dropped}} weggelaten. Het origineel kon NIET worden veiliggesteld — {{dropped}} afbeeldingen zijn verloren.",
  "capture.file.tooLargeForImport":
    "Zelfs na beeldcompressie is het document te groot voor tekstimport — splits het op. Het origineel blijft ongewijzigd.",
  "capture.file.importNote.docx":
    "Structuur en afbeeldingen overgenomen (best effort) — de exacte layout kan afwijken.",
  "capture.file.importNote.pdf":
    "Best-effort tekstimport — layout en afbeeldingen zijn niet overgenomen.",
  "capture.file.importNote.pptx":
    "Best-effort import uit PowerPoint — tekst, lijsten en tabellen per dia overgenomen, voor zover aanwezig; layout, animaties, overgangen en notities gaan verloren.",
  "capture.file.importNote.text":
    "Best-effort tekstimport — koppen, opsommingen en eenvoudige tabellen overgenomen; opmaak (vet, cursief, code), verwijzingen en afbeeldingen blijven als tekens staan. Koppen en opsommingen hebben een lege regel erboven nodig, anders blijven ze lopende tekst.",
  "capture.file.parseError": "„{{name}}“ kon niet worden gelezen.",
  "capture.file.unsupported":
    "„{{name}}“ wordt hier niet ondersteund — lever het aan als TXT/MD, DOCX, PDF of PPTX. Afbeeldingen gaan alleen via OCR.",
  "capture.file.ocrCta": "Tekst in de afbeelding herkennen (OCR)",
  "capture.file.ocrBusy": "Tekstherkenning loopt …",
  "capture.file.queryLabel": "Waarnaar moet de AI zoeken? (optioneel)",
  "capture.file.queryPlaceholder":
    "bijv. „grenswaarden en controle-intervallen“ — laat leeg om alle kennis te vinden",
  "capture.file.queryHelp.title": "Gericht zoeken",
  "capture.file.queryHelp.body":
    "Zonder opgave toont de AI alle kennispunten in het document. Met een zoekopdracht beperkt ze zich tot jouw focus. In beide gevallen wordt er niets verzonnen — elk punt draagt een letterlijke bewijsplaats uit het document.",
  "capture.file.langLabel": "Resultaat in",
  "capture.file.langSystem": "Systeemtaal",
  "capture.file.langSource": "Oorspronkelijke taal",
  "capture.file.langHelp.title": "Resultaattaal",
  "capture.file.langHelp.body":
    "Systeemtaal: titels en samenvattingen verschijnen in je interfacetaal (Duits/Engels) — een Engels document wordt daarbij feitelijk vertaald. Oorspronkelijke taal: de AI vertaalt niets, de punten blijven in de taal van het document. Letterlijke bewijsplaatsen blijven in beide gevallen ongewijzigd.",
  "capture.file.importMode.label": "Importsoort",
  "capture.file.importMode.points": "In punten analyseren",
  "capture.file.importMode.pointsDesc":
    "Klarwerk haalt losse uitspraken uit het bestand. Bestaande weg, er wordt niets automatisch opgeslagen.",
  "capture.file.importMode.whole": "Hele document overnemen",
  "capture.file.importMode.wholeDesc":
    "Klarwerk maakt precies één concept aan met het volledige document. Geen automatische validatie.",
  "capture.file.searchCta": "Bestand analyseren",
  "capture.file.searching": "De AI leest het document …",
  "capture.file.wholeCta": "Hele document als concept opslaan",
  "capture.file.wholeSaving": "Concept wordt opgeslagen …",
  "capture.file.wholeSaved":
    "„{{name}}“ als één concept opgeslagen — bron: bestandsnaam, volledig document.",
  "capture.file.wholeSourceNote":
    "De bron wordt zichtbaar vermeld in het concept: {{name}}, volledig document. Het concept blijft open en onbeoordeeld.",
  "capture.file.wholeSavedTitle": "Document als concept opgeslagen",
  // JOB 3196 (UX-19): vervangt de kale ontwikkelaarsterm „Frontdoor bereit". Zegt wat de toestand
  // IS — en claimt uitdrukkelijk geen beoordelings- of goedkeuringsstatus.
  "capture.file.wholeSavedBadge":
    "Klaar om te openen — het concept is onbeoordeeld en niet ingediend.",
  "capture.file.wholeSavedSource": "Bron: {{name}}, volledig document.",
  "capture.file.wholeOpenDraft": "Concept openen",
  "capture.file.wholeOpenMissing":
    "Het concept is opgeslagen, maar kon niet direct worden geopend.",
  "capture.file.wholeImportAnother": "Nog een document importeren",
  "capture.file.formatTitle": "Informatie over bestandsformaten en opmaak",
  "capture.file.formatHint":
    "TXT/MD en andere tekstbestanden worden als tekst overgenomen. DOCX: structuur (koppen, lijsten, tabellen) en afbeeldingen worden best effort overgenomen; de exacte layout kan afwijken. PDF loopt als best-effort tekstimport; layout en afbeeldingen gaan verloren. PPTX: tekst, structuur en foto's per dia worden best effort overgenomen; layout, animaties, vectorafbeeldingen/vormen en notities gaan verloren.",
  "capture.file.supportedTitle": "Actief selecteerbaar:",
  "capture.file.supportedFormats":
    "TXT, MD/Markdown, CSV, LOG, JSON, DOCX, PDF, PPTX en afbeeldingen voor OCR.",
  "capture.file.unsupportedFormats":
    "RTF wordt momenteel niet ondersteund. Lever het indien mogelijk aan als TXT/MD, DOCX, PDF of PPTX.",
  "capture.file.cancel": "Annuleren",
  "capture.file.pointsTitle": "Gevonden kennis — kies wat wordt overgenomen",
  "capture.file.pointsHint":
    "Elk punt draagt zijn bewijsplaats uit het document. Vink af wat je niet nodig hebt — overnemen gebeurt pas op klik.",
  "capture.file.excerptLabel": "Bewijsplaats",
  "capture.file.pointCount": "{{selected}} van {{total}} punten geselecteerd",
  "capture.file.applyCta": "Geselecteerde overnemen",
  "capture.file.queueBadge": "Punt {{current}} van {{total}} uit „{{name}}“",
  "capture.file.queueHint":
    "Elk punt wordt afzonderlijk als kennispagina beoordeeld en ingediend — er wordt niets automatisch opgeslagen.",
  "capture.file.queueSkip": "Punt overslaan",
  "capture.file.queueDone": "Alle punten uit „{{name}}“ zijn verwerkt.",
  "capture.file.sourceNote": "De bron „{{name}}“ wordt bij het kennisobject vermeld.",
  "capture.file.loadedStats":
    "„{{name}}“ ingelezen ({{chars}} tekens). Geef optioneel aan waarnaar gezocht moet worden en start het zoeken naar kennis.",
  // JOB 3196 (UX-19): dezelfde ontvangstbevestiging voor de weg „hele document" — dezelfde eerlijke
  // omvang, maar de volgende stap is die welke hier daadwerkelijk bestaat.
  "capture.file.loadedStatsWhole":
    "„{{name}}“ ingelezen ({{chars}} tekens). Maak er nu het concept met het volledige document van.",
  "capture.file.saveDraftsCta": "Als concepten opslaan",
  "capture.file.draftsSaved":
    "{{count}} concepten uit „{{name}}“ opgeslagen — elk met bronvermelding. Je vindt ze bovenaan onder „Concepten hervatten“.",
  "capture.file.draftsPartial":
    "Niet alle punten konden als concept worden opgeslagen: {{failed}}. Reeds aangemaakte concepten blijven behouden.",
  "capture.file.mergeCta": "Geselecteerde tot één item samenvoegen",
  "capture.file.mergedNote":
    "{{count}} punten uit „{{name}}“ samengevoegd tot één item — alle bewijsplaatsen staan in het document, de bronnen worden bij het indienen vermeld.",
  "capture.file.connectHint":
    "Meerdere aanvinken en „Verbinden“ voegt ze samen tot ÉÉN item · „Als concepten opslaan“ maakt per punt een eigen concept · „Overnemen“ verwerkt ze een voor een.",
  "capture.file.connectDisabledHint": "Vink minstens 2 inzichten aan om ze te verbinden.",
  "capture.file.selectAll": "Alles selecteren",
  "capture.file.deselectAll": "Alles deselecteren",
  "capture.file.mergedInList":
    "{{count}} inzichten samengevoegd tot één punt — blijft in de lijst.",
  "capture.file.applyDisabledHint":
    "Vink precies één inzicht aan — er wordt altijd maar één tegelijk verwerkt.",
  "capture.file.purgeUnselectedQ":
    "Moeten de {{count}} niet-geselecteerde inzichten worden verwijderd?",
  "capture.file.purgeUnselectedYes": "Niet-geselecteerde verwijderen",
  "capture.file.purgeUnselectedKeep": "Behouden",
  "capture.entry.narrateKicker": "Vertel je kennis — de AI structureert, jij controleert",
  "capture.entry.recommendedBadge": "Aanbevolen",
  "capture.entry.expertToggle": "Expertmodus: formulier direct invullen",
  "capture.entry.expertHint":
    "Voor routiniers: alle velden direct invullen — dezelfde velden, dezelfde beoordelingsweg. De begeleide verteleinstap blijft altijd bereikbaar.",
  "capture.entry.expertActive":
    "Expertmodus: je vult het formulier direct in. Opslaan en beoordelen gaat net als bij de begeleide weg — er wordt niets automatisch gevalideerd.",
  "capture.entry.backToGuided": "Terug naar de begeleide weg",
  "capture.raw": "Ervaringsnotitie",
  "capture.rawPlaceholder":
    "Leg je ervaring vormvrij vast — de AI maakt er een concept van. Jij controleert en dient het in.",
  "capture.structure": "Structureren met AI",
  "capture.assist": "AI-hulp",
  "capture.advanced.title": "Uitgebreide details (optioneel)",
  "capture.advanced.hint":
    "Categorie, installatie, aantal beoordelingen, trefwoorden, documenten & afbeeldingen — niets daarvan is verplicht. Vertel eerst je kennis; de details kun je op elk moment uitklappen en aanvullen.",
  "capture.advanced.filled": "{{count}} ingevuld",
  "capture.ai.title": "AI-nabewerking (bèta)",
  "capture.ai.hint":
    "De AI doet een voorstel — jij controleert het en neemt het bewust over. Geen automatische opslag, geen validatie; inhoud/feiten worden niet verzonnen.",
  "capture.ai.bodyHint":
    "AI-hulp voor de uitgebreide inhoud: voorstel controleren en bewust overnemen (vervangen/toevoegen). Geen automatische opslag, geen validatie; controleer inhoud en bronnen zelf.",
  "capture.ai.applyAsLabel": "Als structuur overnemen",
  "capture.ai.applyAs.section": "Als sectie toevoegen",
  "capture.ai.applyAs.info": "Als info toevoegen",
  "capture.ai.applyAs.note": "Als opmerking toevoegen",
  "capture.ai.applyAs.warning": "Als waarschuwing toevoegen",
  "capture.ai.applyAs.success": "Als succes toevoegen",
  "capture.ai.action.clarify": "Duidelijker",
  "capture.ai.action.structure": "Structureren",
  "capture.ai.action.expand": "Uitbreiden",
  "capture.ai.action.spelling": "Spelling",
  "capture.ai.action.format": "Opmaken",
  "capture.ai.instr.clarify":
    "Formuleer duidelijker en preciezer, zonder de betekenis te veranderen.",
  "capture.ai.instr.structure":
    "Structureer de tekst in duidelijke, beknopte zinnen of opsommingspunten.",
  "capture.ai.instr.expand":
    "Formuleer wat uitgebreider en vollediger — zonder nieuwe feiten te verzinnen.",
  "capture.ai.instr.spelling": "Corrigeer alleen spelling en grammatica.",
  "capture.ai.instr.format":
    "Verbeter alleen de leesbaarheid met nette alinea's en interpunctie. Gebruik GEEN markdown-tekens zoals #, ## of * — geen koptekens. Laat inhoud en bewoording ongewijzigd, voeg niets toe en laat niets weg.",
  "capture.ai.help.clarify": "Formuleert begrijpelijker en preciezer — de betekenis blijft gelijk.",
  "capture.ai.help.structure": "Ordent de tekst in beknopte zinnen of opsommingspunten.",
  "capture.ai.help.expand": "Formuleert uitgebreider — verzint daarbij geen nieuwe feiten.",
  "capture.ai.help.spelling": "Corrigeert alleen spelling en grammatica, verder niets.",
  "capture.ai.help.format":
    "Verbetert alleen de leesbaarheid (alinea's, interpunctie) — zonder markdown-tekens; de inhoud blijft letterlijk.",
  "capture.ai.customHelp":
    "Eigen AI-functie van je organisatie (aangemaakt door de admin). Instructie aan de AI: „{{instruction}}“. Zoals bij alle AI-acties ontstaat er alleen een voorstel ter voorbeeld — overgenomen wordt uitsluitend wat jij bewust met een klik overneemt.",
  "capture.ai.presetsFailed": "De eigen AI-functies van je organisatie konden niet worden geladen.",
  "capture.ai.freeLabel": "Eigen AI-instructie",
  "capture.ai.freePlaceholder": "bijv. „korter en zakelijker formuleren“",
  "capture.ai.run": "Uitvoeren",
  "capture.ai.previewTitle": "AI-voorstel (voorbeeld)",
  "capture.ai.replace": "Vervangen",
  "capture.ai.append": "Toevoegen",
  "capture.ai.discard": "Verwerpen",
  "capture.author": "Auteur",
  "capture.documents": "Documenten (context / bijlage)",
  "capture.documentsUpload": "Bestanden uploaden",
  "capture.uploadLimits":
    "Tot {{count}} bestanden, elk max. {{mb}} MB overdrachtsgrootte (ongeveer {{raw}} MB zuiver bestand).",
  "capture.attachLimitReached":
    "{{taken}} van {{total}} bestanden geaccepteerd voor verwerking — de bijlagegrens is {{limit}}.",
  "capture.documentsHint":
    "txt, md, csv, json, log, docx, pdf → volledige tekst · afbeeldingen: optioneel via OCR",
  "capture.images": "Afbeeldingen (bijlage)",
  "capture.imagesUpload": "Afbeeldingen toevoegen",
  "capture.imagesHint": "Ook vanuit de mobiele app. Worden bij het object gevoegd.",
  "capture.videoAdded": "{{name}} toegevoegd. Transcriptie op klik — er gebeurt niets automatisch.",
  "capture.videoTranscribe": "Transcriberen",
  "capture.videoBusy": "loopt …",
  "capture.videoRunning": "{{name}} transcriberen — korte clips gaan snel.",
  "capture.videoDone":
    "Transcript van {{name}} overgenomen — controleer het (concept, geen waarheid).",
  "capture.saveDraft": "Als concept opslaan",
  "capture.draftSaved": "Concept opgeslagen.",
  "capture.draftUpdated": "Concept bijgewerkt.",
  "capture.bereitsGespeichert":
    "Dit document was al opgeslagen; er is geen tweede vermelding aangemaakt.",
  "capture.bereitsGespeichertFortgeschrieben":
    "Dit document was al opgeslagen; er is geen tweede vermelding aangemaakt. De bestaande vermelding bevat nu je gewijzigde versie.",
  "capture.bereitsGespeichertOeffnen": "Bestaande vermelding openen: “{{title}}”",
  "capture.teilerfolg.dateiAusstehend":
    "Nog niet alles opgeslagen: het concept is opgeslagen, het bestand “{{name}}” wordt nog opgeslagen.",
  "capture.teilerfolg.dateiGescheitert":
    "Slechts gedeeltelijk opgeslagen: het concept is opgeslagen, het bestand “{{name}}” niet. Het staat hier nog — “Als concept opslaan” probeert het opnieuw.",
  "capture.draftDiscarded": "Concept verwijderd.",
  // JOB 3768 — zie de Duitse regel: sinds JOB 3668 gaat het concept naar de prullenbak.
  "capture.discardDraftQ":
    "Verwijderen? Het concept gaat naar de prullenbak en is te herstellen onder “Mijn concepten”.",
  "capture.discardDraftKeep": "Behouden",
  "capture.discardDraftYes": "Verwijderen",
  "capture.imageError": "„{{name}}“ kon niet als afbeelding worden gelezen.",
  "capture.draftFallbackTitle": "Concept",
  "capture.resumeTitle": "Concepten hervatten",
  "capture.resumeExpand": "Concepten tonen ({{count}})",
  "capture.resumeCollapse": "Concepten inklappen",
  // AUFTRAG-mega38 BLOCK J4: `capture.resumeCollapsedHint` verwijderd — zie het DE-blok.
  "capture.resume": "Hervatten",
  "capture.discardDraft": "Verwerpen",
  // AUFTRAG-sortfilter · Punt 2: filter + sortering van de conceptenlijst.
  "capture.draftSearch": "Concepten doorzoeken",
  "capture.draftSortLabel": "Sorteren",
  "capture.draftSort.recent": "Laatst opgeslagen (nieuw→oud)",
  "capture.draftSort.oldest": "Laatst opgeslagen (oud→nieuw)",
  "capture.draftSort.title": "Titel A→Z",
  "capture.draftAuthorLabel": "Maker",
  "capture.draftAuthorAll": "Alle makers",
  // AUFTRAG-BASIC-u2 — zie de Duitse regel voor de bevinding.
  "capture.draftScope.note":
    "Deze zoekopdracht doorzoekt alleen jouw opgeslagen concepten — geen kennis uit de bibliotheek.",
  "capture.draftScope.noteAdmin":
    "Deze zoekopdracht doorzoekt alleen opgeslagen concepten (adminweergave: alle) — geen kennis uit de bibliotheek.",
  "capture.draftScope.toLibrary": "In de Klarwerk-kennis zoeken",
  "capture.draftEmptyFiltered":
    "Geen opgeslagen concepten passen bij je zoekopdracht. Alleen concepten zijn doorzocht — gevalideerde kennis staat in de bibliotheek.",
  "capture.draftJustSaved": "zojuist opgeslagen",
  "capture.draftCreatorMeta": "Maker: {{name}}",
  "capture.draftSavedMeta": "Opgeslagen: {{date}}",
  "capture.draftStatusMeta": "Status: concept",
  "capture.editingDraft": "Concept geladen — wijzigingen worden in hetzelfde concept opgeslagen.",
  "capture.editingBadge": "in bewerking",
  "capture.fileImportJump": "Bestand importeren",
  "capture.loadExample": "Voorbeeld laden",
  "capture.exampleLoaded":
    "Ervaringsnotitie geladen — structureer die nu met AI en controleer het concept.",
  "capture.docAdded": "{{name}} als context overgenomen.",
  "capture.docExtracting": "{{name}} wordt gelezen …",
  "capture.docEmpty":
    "{{name}}: geen tekst gevonden — een gescande PDF zonder tekstlaag wordt nog niet ondersteund.",
  "capture.docParseError": "{{name}} kon niet worden gelezen.",
  "capture.docUnsupported":
    "{{name}}: alleen txt/md/csv/json/log, docx en pdf worden als volledige tekst gelezen.",
  "capture.ocr": "OCR → tekst",
  "capture.ocrRunningShort": "OCR …",
  "capture.ocrRunning":
    "De tekst in {{name}} wordt gelezen … De eerste keer duurt dit iets langer.",
  "capture.ocrDone": "OCR-tekst uit {{name}} overgenomen.",
  "capture.ocrEmpty": "{{name}}: OCR heeft geen tekst herkend.",
  "capture.ocrFailed": "OCR voor {{name}} mislukt.",
  "capture.ocrUnavailable": "OCR is momenteel niet beschikbaar.",
  "capture.help.category.title": "Categorie & #tags",
  "capture.help.category.body":
    "De categorie is een vrij te kiezen inhoudelijke indeling (bijv. „Onderhoud“, „Kwaliteit“, „Inkoop“). Tags zijn vrije trefwoorden om iets terug te vinden.",
  "capture.help.validations.title": "Benodigde validaties",
  "capture.reviewers.title": "Beoordelaars voorstellen (optioneel)",
  "capture.reviewers.helpTitle": "Beoordelaars voorstellen",
  "capture.reviewers.helpBody":
    "Kies collega's die jouw bijdrage moeten beoordelen. Zij krijgen de beoordeling als open toewijzing en een melding. Zonder keuze blijft de bijdrage open voor alle beoordelaars.",
  "capture.reviewers.none": "Nog geen andere personen in de directory.",
  "capture.reviewers.selected": "Geselecteerd: {{n}}",
  "capture.reviewers.defaultPlaceholder": "Standaard: {{n}}",
  "capture.help.validations.body":
    "Hoeveel onafhankelijke bevestigingen het object nodig heeft voordat het als „gevalideerd“ geldt (1–5, standaard 3). Meer = hogere drempel, betrouwbaarder.",
  "capture.modeSoon": "Deze modus volgt nog.",
  "capture.fTitle": "Kernuitspraak",
  "capture.fStatement": "Uitspraak",
  "capture.fBody": "Uitgebreide inhoud (optioneel)",
  "editor.bold": "Vet",
  "editor.bodyLabel": "Kennispagina — bodytekst",
  "editor.italic": "Cursief",
  "editor.h2": "Kop",
  "editor.h3": "Subkop",
  "editor.ul": "Opsomming",
  "editor.ol": "Genummerde lijst",
  "editor.link": "Link",
  "editor.panel": "Paneel/opmerking",
  "editor.guidance.title": "Zo gebruik je de uitgebreide inhoud",
  "editor.guidance.structure": "Structuur: koppen (H2/H3) en alinea's structureren de inhoud.",
  "editor.guidance.action": "Praktijkkennis: lijsten voor stappen, links als bewijs.",
  "editor.guidance.blocks":
    "Blokken: markeer belangrijke punten als info/opmerking/waarschuwing/succes.",
  "editor.guidance.ai":
    "AI-hulp: levert voorstellen — jij controleert en neemt bewust over, geen automatische validatie.",
  "editor.attach.title": "Bijlagen in de editor",
  "editor.attach.images": "Afbeelding(en)",
  "editor.attach.files": "Bestand(en)",
  "editor.attach.imageHint": "in te voegen in de uitgebreide inhoud via de afbeeldingsknop.",
  "editor.attach.fileHint":
    "blijven zichtbaar als bijlage/bewijs en worden niet inline ingesloten — verwijs ernaar in de tekst.",
  "editor.media.title": "Afbeeldingen, bestanden & bewijs",
  "editor.media.images": "Afbeelding(en)",
  "editor.media.imageHint":
    "illustreren je kennis — in te voegen in de inhoud via de afbeeldingsknop.",
  "editor.media.linkable": "linkbare bestand(en)",
  "editor.media.linkableHint":
    "als bewijs/context veilig in de tekst te linken (interne objectreferentie, geen ruwe downloadtruc).",
  "editor.media.evidence": "bestand(en) als bijlage",
  "editor.media.evidenceHint":
    "blijven bewijs/onderbouwing — na het opslaan in de tekst te linken; tot dan geen nood-/neplink.",
  "editor.media.note":
    "Bewijs verbetert de navolgbaarheid, maar is geen goedkeuring — de validatie beslist.",
  "editor.quality.title": "Inhoudscheck",
  "editor.quality.hint":
    "Controleert de structuur, niet de inhoudelijke juistheid. Geen validatie.",
  "editor.quality.empty": "Nog geen uitgebreide inhoud vastgelegd.",
  "editor.quality.thin": "Erg korte inhoud — vul indien nodig context of stappen aan.",
  "editor.quality.headings": "Koppen",
  "editor.quality.lists": "Lijsten",
  "editor.quality.blocks": "Blokken",
  "editor.quality.links": "Links",
  "editor.quality.attachmentsUnreferenced":
    "Bijlagen aanwezig, maar niet genoemd in de tekst — verwijs er eventueel naar.",
  "editor.template.title": "Structuursjabloon starten",
  "editor.template.hint":
    "Sjabloon kiezen, voorbeeld controleren en bewust overnemen. Startstructuur/voorstel — bestaande inhoud wordt bij het toevoegen niet vervangen; er wordt niets automatisch opgeslagen of gevalideerd.",
  "editor.template.selected": "Gekozen sjabloon",
  "editor.template.preview": "Voorbeeld",
  "editor.template.procedure.label": "Werkwijze",
  "editor.template.procedure.description": "Voorwaarden en stappen voor herhaalbaar werk.",
  "editor.template.troubleshooting.label": "Storing",
  "editor.template.troubleshooting.description":
    "Symptoom, oorzaak en maatregel gestructureerd vastleggen.",
  "editor.template.safety.label": "Veiligheid",
  "editor.template.safety.description": "Waarschuwing, veilige controle en gewenste toestand.",
  "editor.template.checklist.label": "Checklist",
  "editor.template.checklist.description":
    "Af te vinken controlepunten plus „wat te doen als er niet aan voldaan is”.",
  "editor.template.handover.label": "Overdracht/training",
  "editor.template.handover.description":
    "Het belangrijkste voor de volgende persoon: kernpunten, typische fouten, contactpersonen.",
  "editor.template.decision.label": "Beslishulp",
  "editor.template.decision.description":
    "Als-dan-regels voor een terugkerende beslissing, incl. escalatiegrens.",
  "editor.template.applySet": "Sjabloon inzetten",
  "editor.template.applyAppend": "Sjabloon onderaan toevoegen",
  "editor.template.applyHelp":
    "Voegt de getoonde startstructuur in de kennispagina in: is de pagina leeg, dan wordt die ingevoegd; staat er al iets in, dan wordt die ONDERAAN toegevoegd — er wordt niets vervangen of opgeslagen. De plaatshouders („… aanvullen”) vervang je daarna door je eigen kennis.",
  "editor.template.mode.set": "Lege inhoud: het sjabloon wordt ingevoegd.",
  "editor.template.mode.append":
    "Bestaande inhoud: het sjabloon wordt toegevoegd, er wordt niets vervangen.",
  "editor.applySafety.replaceWarning":
    "Let op: vervangen overschrijft de huidige inhoud. Toevoegen laat het bestaande staan.",
  "editor.block.info": "Info",
  "editor.block.note": "Aanwijzing",
  "editor.block.warning": "Waarschuwing",
  "editor.block.success": "Succes",
  "editor.image": "Afbeelding uit bijlage",
  "editor.para": "Alinea",
  "editor.imageLabel": "Afbeelding",
  "editor.fileLabel": "Bestand",
  "editor.aiLabel": "AI",
  "editor.aiToggle": "AI-hulp bij het schrijven — opent het AI-palet",
  "editor.noImages": "Geen afbeeldingsbijlagen aanwezig.",
  "editor.imageFromDisk": "Afbeelding van je computer …",
  "editor.fileFromDisk": "Bestand van je computer toevoegen …",
  "editor.imageFromAttachment": "Uit bijlagen",
  "editor.imageSearch.open": "Afbeelding uit de bibliotheek …",
  "editor.imageSearch.title": "Afbeelding uit de bibliotheek",
  "editor.imageSearch.label": "Zoek op onderschrift of beschrijving",
  "editor.imageSearch.placeholder": "bijv. schroefverbinding",
  "editor.imageSearch.submit": "Zoeken",
  "editor.imageSearch.idle":
    "Voer een trefwoord in — gezocht wordt in de onderschriften van de items die je mag lezen.",
  "editor.imageSearch.loading": "Bezig met zoeken …",
  "editor.imageSearch.refreshing": "Stand van {{zeit}} · vernieuwen …",
  "editor.imageSearch.checked": "gecontroleerd {{zeit}}",
  "editor.imageSearch.empty":
    "Geen afbeelding met deze beschrijving in de bibliotheek (gecontroleerd {{zeit}})",
  "editor.imageSearch.error": "Zoeken niet mogelijk",
  "editor.imageSearch.offline": "Zoeken niet mogelijk — geen verbinding",
  "editor.imageSearch.stale": "Stand van {{zeit}} · vernieuwen mislukt",
  "editor.imageSearch.capped": "Meer resultaten dan getoond — verfijn de zoekopdracht.",
  "editor.imageSearch.herkunft": "uit „{{quelle}}”, versie {{version}}, {{pruefstand}}",
  "editor.imageSearch.noCaption": "zonder beschrijving",
  "editor.imageSearch.nameLabel": "Naam: {{name}}",
  "editor.imageSearch.foundVia": "Gevonden via: {{felder}}",
  "editor.imageSearch.via.beschreibung": "beschrijving",
  "editor.imageSearch.via.name": "naam",
  "editor.imageSearch.thumbAlt": "Afbeelding uit de bibliotheek: {{caption}}",
  "editor.imageSearch.use": "Overnemen",
  "editor.imageSearch.useLabel": "Afbeelding „{{caption}}” met onderschrift en herkomst overnemen",
  "editor.imageSearch.close": "Sluiten",
  "editor.captionPlaceholder": "✎ Afbeeldingsbeschrijving toevoegen …",
  "editor.captionAmbiguous": "Onderschrift in het document, maar niet eenduidig toe te wijzen",
  "editor.captionUnassigned": "nog niet aan een afbeelding gekoppeld",
  "editor.captionUnassignedLabel":
    "Afbeeldingsbeschrijving, nog niet aan een afbeelding gekoppeld — opent het beschrijvingsformulier",
  "editor.assignHeading": "Bij welke afbeelding hoort deze beschrijving?",
  "editor.assignImageName": "Afbeelding {{n}}",
  "editor.assignOptionLabel": "Deze afbeeldingsbeschrijving koppelen aan afbeelding {{n}}",
  "editor.assignNoImage": "In deze tekst staat geen afbeelding waaraan zij gekoppeld kan worden.",
  "editor.assignAllDescribed":
    "Elke afbeelding in deze tekst heeft al een afbeeldingsbeschrijving.",
  "editor.assignUnclear_one":
    "Bij {{count}} afbeelding in deze tekst is niet vastgesteld welke beschrijving erbij hoort — zij wordt daarom niet aangeboden.",
  "editor.assignUnclear_other":
    "Bij {{count}} afbeeldingen in deze tekst is niet vastgesteld welke beschrijving erbij hoort — zij worden daarom niet aangeboden.",
  "editor.assignFailed":
    "Deze koppeling is niet meer mogelijk; de tekst is sinds het openen gewijzigd. De keuze hieronder is opnieuw verzameld.",
  "editor.assignPreviewMissing": "Voorbeeld niet beschikbaar",
  "editor.captionNoAnchor":
    "Voor deze afbeelding kan nu geen afbeeldingsbeschrijving worden aangemaakt. Voeg de afbeelding opnieuw in.",
  "editor.kennungGetrennt_one":
    "Meerdere afbeeldingen droegen dezelfde kenmerkcode. {{count}} koppeling is losgemaakt — controleer de betrokken afbeeldingsbeschrijvingen.",
  "editor.kennungGetrennt_other":
    "Meerdere afbeeldingen droegen dezelfde kenmerkcode. {{count}} koppelingen zijn losgemaakt — controleer de betrokken afbeeldingsbeschrijvingen.",
  "editor.kennungGetrenntClose": "Melding over losgemaakte afbeeldingskenmerken sluiten",
  "editor.kennungUngueltig_one":
    "Bij {{count}} afbeelding of afbeeldingsbeschrijving was het kenmerk ongeldig. Het is verwijderd en vervangen — controleer de koppeling.",
  "editor.kennungUngueltig_other":
    "Bij {{count}} afbeeldingen of afbeeldingsbeschrijvingen was het kenmerk ongeldig. Het is verwijderd en vervangen — controleer de koppeling.",
  "editor.kennungUngueltigClose": "Melding over ongeldige afbeeldingskenmerken sluiten",
  "editor.fremdfassungVerworfen":
    "Tijdens het schrijven is van buitenaf een nieuwere versie binnengekomen. De eigen tekst is behouden; de andere versie is verworpen.",
  "editor.fremdfassungVerworfenClose": "Melding over de verworpen versie sluiten",
  "editor.captionAi.suggest": "AI-beschrijving voorstellen",
  "editor.captionAi.loading": "AI-beschrijving wordt gemaakt …",
  "editor.captionAi.panelTitle": "Voorstel",
  "editor.captionAi.aiBadge": "AI-gegenereerd. Graag controleren.",
  "editor.captionAi.withContext": "Gemaakt met documentcontext (titel, kop en omringende tekst).",
  "editor.captionAi.apply": "Overnemen",
  "editor.captionAi.discard": "Verwerpen",
  "editor.captionAi.tooLarge":
    "De afbeelding is te groot voor een beschrijvingsvoorstel (max. 5 MB).",
  "editor.captionAi.imageUnreadable": "De afbeelding van dit onderschrift kon niet worden gelezen.",
  "editor.captionAi.fallbackNoModel":
    "Er is geen AI-model geconfigureerd of vrijgegeven — zonder model is er geen beschrijvingsvoorstel (er wordt niets verzonnen).",
  "editor.captionAi.fallbackTimeout":
    "De cloud-AI overschreed de tijdslimiet — er is daarom geen voorstel. Probeer het later opnieuw.",
  "editor.captionAi.fallbackError":
    "De cloud-AI is momenteel niet bereikbaar of meldt een fout — er is daarom geen voorstel. Probeer het later opnieuw.",
  "editor.captionAi.fallbackConfidential":
    "Deze afbeelding is als vertrouwelijk aangemerkt — de cloud-AI is daarvoor uitgesloten en er is geen lokaal vision-model aangesloten. Er is daarom geen voorstel (er verlaat niets de server).",
  // JOB 2402 D1 (TV1 Scheibe b) — zie de Duitse regel voor de bevinding.
  "editor.titleSuggest.label": "Titelvoorstel",
  "editor.titleSuggest.apply": "Als titel overnemen",
  "editor.titleSuggest.none":
    "Uit deze afbeelding kon geen titel worden afgeleid — je titel blijft zoals hij is.",
  // JOB 2489 D1 (TV1 rang 1) — zie de Duitse regel voor de bevinding.
  "editor.titleSuggest.sourceText": "Uit de tekst van deze bijdrage.",
  "editor.titleSuggest.sourceImage":
    "Uit de afbeeldingsbeschrijving — je bijdrage heeft nog geen tekst.",
  "editor.captionForm.open": "Afbeeldingsbeschrijving bewerken",
  "editor.captionForm.title": "Afbeeldingsbeschrijving",
  "editor.captionForm.label": "Beschrijving van de afbeelding",
  "editor.captionForm.placeholder": "Wat is er op de afbeelding te zien, en waarom staat die hier?",
  "editor.captionForm.limit": "{{n}} van {{max}} tekens",
  "editor.captionForm.limitReached": "Maximale lengte bereikt ({{max}} tekens).",
  "editor.captionForm.append": "Aan de tekst toevoegen",
  "editor.captionForm.save": "Beschrijving opslaan",
  "editor.captionForm.cancel": "Annuleren",
  "editor.captionForm.imageAlt": "Afbeelding die wordt beschreven",
  "editor.captionForm.noSuggestionYet":
    "Nog geen voorstel aangevraagd. De tekst blijft van jou — een voorstel wordt nooit automatisch overgenomen.",
  "editor.captionForm.stale":
    "Deze afbeelding is intussen gewijzigd — het bijschrift is NIET opgeslagen, zodat het niet bij de verkeerde afbeelding terechtkomt. Kopieer de tekst, sluit het formulier en open het opnieuw bij de huidige afbeelding.",
  "editor.captionForm.openLabel": "Afbeeldingsbeschrijving bewerken (opent het invoerformulier)",
  "editor.captionForm.formatLabel": "Opmaak",
  "editor.captionForm.bold": "Vet (Ctrl/Cmd + B)",
  "editor.captionForm.italic": "Cursief (Ctrl/Cmd + I)",
  "editor.captionForm.lineBreak": "Regeleinde (Shift + Enter)",
  "editor.captionForm.selectFirst":
    "Selecteer eerst de tekst die je wilt opmaken — vet of cursief werkt dan daarop.",
  "editor.file": "Bestand koppelen",
  "editor.insertFile": "Bestandsbijlage als link invoegen",
  "editor.noFiles":
    "Nog geen koppelbare bestanden — geüploade bestanden worden pas na het opslaan koppelbaar (met objectreferentie). Tot dan blijven ze als bijlage/bewijs bewaard; geen tijdelijke link.",
  "editor.drop.hint":
    "Afbeeldingen hierheen slepen of plakken (Ctrl/⌘+V). Bestanden blijven bewijs/onderbouwing.",
  "editor.drop.hintImagesOnly": "Afbeeldingen hierheen slepen of plakken (Ctrl/⌘+V).",
  "editor.drop.imageActive":
    "Media loslaten — afbeeldingen worden ingevoegd, bestanden blijven bewijs",
  "editor.drop.fileNotice":
    "Alleen afbeeldingen worden inline ingevoegd. Bestanden blijven bijlage/bewijs — een veilige body-link ontstaat pas met een opgeslagen objectreferentie (geen nep-link). De validatie beslist.",
  "editor.preview": "Voorbeeld",
  "editor.edit": "Bewerken",
  "editor.previewBadge": "Voorbeeld — zo zien lezers de pagina",
  "editor.previewEmpty": "Nog geen inhoud — ga naar „Bewerken” en schrijf het eerste onderdeel.",
  "editor.linkPrompt": "Link-URL invoeren:",
  "editor.linkUrl": "URL",
  "editor.linkUrlPlaceholder": "https://… of interne route",
  "editor.linkLabel": "Linktekst optioneel",
  "editor.linkLabelPlaceholder": "Als leeg, wordt de URL getoond",
  "editor.linkInsert": "Link invoegen",
  "editor.linkCancel": "Annuleren",
  "editor.linkInvalid": "Gebruik een veilige URL (https, mailto, / of #).",
  "capture.fType": "Kennissoort",
  "capture.fCategory": "Domein / categorie",
  "capture.submit": "Controleren & indienen",
  "capture.submitBusy": "Wordt ingediend … (concept, bijlagen, indiening)",
  "capture.submitStageCreating": "Kennisobject wordt aangemaakt …",
  "capture.submitStageUploading": "Origineel & bijlagen worden veiliggesteld ({{mb}} MB) …",
  "capture.submitStageLinking": "Bronnen worden gekoppeld …",
  "capture.submitTiming.title": "Details over de duur",
  "capture.submitTiming.create": "Kennisobject aanmaken",
  "capture.submitTiming.upload": "Origineel & bijlagen uploaden",
  "capture.submitTiming.link": "Koppelen & bronnen",
  "capture.submitTiming.seconds": "{{s}} s",
  "capture.submitTiming.mb": "{{mb}} MB",
  "capture.readyTitle": "Opslagcheck",
  "capture.ready.title": "Titel",
  "capture.ready.content": "Uitspraak / inhoud",
  "capture.ready.category": "Categorie",
  "capture.ready.type": "Kennissoort",
  "capture.ready.attachments": "Bijlagen",
  "capture.readyDone": "ok",
  "capture.readyMissing": "ontbreekt",
  "capture.readyOptional": "optioneel",
  "capture.readyHint": "Titel en uitspraak/inhoud zijn nodig om te kunnen opslaan.",
  "capture.draftHint":
    "Voer eerst je ervaringsnotitie in en structureer die met AI — het concept verschijnt hier.",
  "capture.fConditions": "Voorwaarden",
  "capture.fMeasures": "Maatregelen",
  "capture.fTags": "Trefwoorden",
  "capture.fAsset": "Installatie / apparaat",
  "conf.field": "Vertrouwelijkheid",
  "conf.confirmPending": "— vertrouwelijkheid bevestigen —",
  "conf.requiredHint": "Kies een vertrouwelijkheidsniveau voordat u indient.",
  "conf.help":
    "Hoe vertrouwelijk is deze kennis? Openbaar-intern is de standaard (geen beperking). Vertrouwelijk en Streng vertrouwelijk markeren gevoelige kennis: zulke objecten worden nooit in externe contexten gegeven (Output Factory/export). Het niveau kun je vanaf het vastleggen instellen en later altijd wijzigen — elke wijziging wordt in het audit-log vastgelegd. Let op: deze markering beperkt (nog) niet WIE het object ziet.",
  "conf.level.intern": "Openbaar-intern",
  "conf.level.vertraulich": "Vertrouwelijk",
  "conf.level.streng_vertraulich": "Streng vertrouwelijk",
  "conf.level.nichtEingestuft": "Niet geclassificeerd",
  "capture.fRevalidation": "Hervalidatie na (aantal)",
  "capture.listAdd": "Item toevoegen",
  "capture.listRemove": "Verwijderen",
  "capture.tagPlaceholder": "Tag invoeren, Enter om over te nemen",
  "capture.formularHint":
    "Kernuitspraak en uitspraak zijn genoeg om te beginnen — de overige gegevens hieronder zijn optioneel.",
  "capture.diktatStart": "Dicteren starten",
  "capture.diktatStop": "Dicteren stoppen",
  "capture.diktatUnsupported":
    "Spraakinvoer wordt door deze browser niet ondersteund. Gebruik Chrome/Edge of typ de tekst handmatig in.",
  "capture.diktatNa": "niet beschikbaar",
  "capture.ivStep": "Vraag {{n}} van {{total}}",
  "capture.ivBack": "Terug",
  "capture.ivNext": "Volgende",
  "capture.ivFinish": "Concept aanmaken",
  "capture.ivDone": "Interview afgerond — controleer het concept rechts en dien het in.",
  "capture.ivStart": "Interview starten",
  "capture.ivStartLead":
    "Het geleide interview gebruikt AI om vervolgvragen te stellen. Pas als je op „Interview starten“ klikt, gaat de eerste vraag naar het model — daarvoor wordt niets verzonden. Provider en regio zie je via het (!)-symbool.",
  "capture.ivTurn": "Vraag {{n}}",
  "capture.ivThinking": "De AI formuleert de volgende vraag …",
  "capture.ivResumeLead":
    "Je interviewvoortgang is hersteld. De volgende vraag wordt pas na jouw klik geladen.",
  "capture.ivResumeLoad": "Volgende vraag laden",
  "capture.unsavable.images_one": "{{count}} ingevoegde afbeelding",
  "capture.unsavable.images_other": "{{count}} ingevoegde afbeeldingen",
  "capture.unsavable.docs_one": "{{count}} bijgevoegd bestand (document/video/audio)",
  "capture.unsavable.docs_other": "{{count}} bijgevoegde bestanden (documenten/video/audio)",
  "capture.unsavable.file": "het geüploade bestand „{{name}}” — de verwerking is nog niet afgerond",
  "capture.unsavable.fileQueue":
    "de lopende bestandsverwerking uit „{{name}}” (punt {{current}} van {{total}})",
  "capture.unsavable.extResults":
    "de geladen trefferlijst van de externe zoekopdracht — de zoekopdracht zelf blijft in het concept bewaard",
  // AUFTRAG-mega6 Block A
  "capture.unsavable.sourceUrl":
    "het onvolledige webadres „{{urls}}” — het concept bewaart alleen volledige adressen die met https:// of http:// beginnen; de naam en het fragment van de bron blijven behouden",
  "capture.sourceUrlLimit":
    "Dit adres kan het concept niet meenemen. Zet er https:// of http:// voor — of maak het veld leeg als je het niet nodig hebt.",
  // AUFTRAG-mega6 Block D
  "capture.limit.chars":
    "Maximale lengte bereikt ({{max}} tekens) — verdere tekst wordt niet bewaard.",
  "capture.limit.reviewers":
    "Het concept kan niet meer dan {{max}} beoordelaars bewaren — deselecteer iemand om te wisselen.",
  "capture.limit.sources":
    "Het concept kan niet meer dan {{max}} bronnen bewaren — verwijder er een om ruimte te maken.",
  "capture.limit.interviewAnswers":
    "Het concept kan niet meer dan {{max}} antwoorden bewaren — rond het interview af of sla het concept op.",
  "capture.saveLimit.title": "Het concept kan niet alles opslaan",
  "capture.saveLimit.lead":
    "Tekst, metadata en bronnen worden opgeslagen. Deze inhoud kan het concept echter niet opslaan — bij het opslaan wordt die verworpen:",
  "capture.saveLimit.cancel": "Annuleren — inhoud behouden",
  "capture.saveLimit.confirm": "Toch opslaan en deze inhoud verwerpen",
  "capture.leaveDraft.action": "Concept verlaten",
  "capture.leaveDraft.keepsDraftHint":
    "Verwerpt de wijzigingen sinds het openen. Het opgeslagen concept blijft ongewijzigd bestaan.",
  "capture.leaveDraft.busy": "Niet mogelijk zolang er een bewerking aan dit concept loopt.",
  "capture.leaveDraft.done":
    "Concept verlaten. De wijzigingen sinds het openen zijn verworpen, het opgeslagen concept is ongewijzigd.",
  "capture.leaveDraft.doneSaved":
    "Concept verlaten. De wijzigingen sinds het openen zijn opgeslagen in het bewaarde concept.",
  "capture.leaveDraft.doneUnchanged": "Concept verlaten. Het opgeslagen concept is ongewijzigd.",
  "capture.ivAnswerHint": "Jouw antwoord …",
  "capture.ivSend": "Antwoord versturen",
  "capture.ivReadAloud": "Voorlezen",
  "capture.ivReadStop": "Stop",
  "capture.ivDictNa": "Dicteren is in deze browser niet beschikbaar — typ het alsjeblieft.",
  "capture.ivModel": "AI-model",
  // JOB 3276: s. die deutsche Fassung — Alltagssprache statt „Deterministische fallback".
  "capture.ivFallback": "Vaste reservevragen, geen antwoord van de AI",
  "capture.ivQ.title": "Waar gaat het over? Formuleer een korte kernuitspraak.",
  "capture.ivQ.statement": "Beschrijf de ervaring/uitspraak nauwkeuriger.",
  "capture.ivQ.conditions": "Onder welke voorwaarden geldt dit? Eén per regel.",
  "capture.ivQ.measures": "Welke concrete maatregelen/stappen? Eén per regel.",
  "capture.ivQ.tags": "Trefwoorden voor de vindbaarheid? Kommagescheiden.",
  "capture.ivQHint.title": "bijv. Pomp P-12 bij vorst voorverwarmen",
  "capture.ivQHint.statement": "Wat precies, waarom, met welk effect?",
  "capture.ivQHint.conditions": "Eén voorwaarde per regel",
  "capture.ivQHint.measures": "Eén maatregel per regel",
  "capture.ivQHint.tags": "Vorst, pomp, winter",
  "ask.kicker": "Vragen en antwoorden",
  "ask.title": "Vraag het fabriekskennis",
  "ask.intro":
    "Het antwoord is brongebonden: je ziet waarop het steunt — en in welke staat elk van die bronnen is. Is er geen basis, dan wordt het hiaat open benoemd.",
  "ask.placeholder": "bijv. Wanneer moet klep X bij overdruk gesloten worden?",
  "ask.emptyHint": "Voer eerst een vraag in.",
  "ask.submit": "Vragen",
  // JOB 3038: dicteren bij het vraagveld — zie de toelichting bij de DE-sleutels.
  "ask.diktatStart": "Vraag inspreken",
  "ask.diktatStop": "Opname stoppen",
  "ask.diktatUnsupported":
    "Spraakinvoer is in deze browser niet beschikbaar. Gebruik Chrome/Edge of typ je vraag.",
  // AUFTRAG-mega38 BLOCK A: wachten en mislukken staan DAAR waar het antwoord verschijnt.
  "ask.pending.title": "De vraag loopt tegen de fabriekskennis.",
  "ask.pending.body":
    "Er wordt naar passende bronnen gezocht. Is er geen draagkrachtige basis, dan zegt Klarwerk dat open — er wordt niets verzonnen.",
  "ask.error.title": "De vraag kon niet worden beantwoord.",
  "ask.error.body":
    "Het verzoek is onderweg blijven steken. Dit is GEEN uitspraak over de kennis — het betekent niet dat er geen antwoord is. Probeer het opnieuw.",
  "ask.error.retry": "Opnieuw proberen",
  "ask.gebremst.titel": "Even geduld.",
  "ask.offline": "Geen verbinding.",
  "ask.wiederaufnahme.entwurf":
    "Hier kun je verdergaan: je nog niet verzonden concept staat weer in het vraagveld.",
  "ask.wiederaufnahme.antwort":
    "Hier kun je verdergaan: dit is het antwoord dat je het laatst zag, van {{zeit}}, met de bronnen. Het is niet opnieuw gegenereerd — stel de vraag opnieuw om het te vernieuwen.",
  "ask.wiederaufnahme.beides":
    "Hier kun je verdergaan: je nog niet verzonden concept staat weer in het vraagveld, daarboven het antwoord dat je het laatst zag, van {{zeit}}. Het is niet opnieuw gegenereerd.",
  "ask.wiederaufnahme.verwerfen": "Concept verwerpen",
  "ask.pruefungGestoert": "Klara kon de bedrijfskennis nu niet betrouwbaar controleren.",
  "ask.rueckmeldungAbgelaufen":
    "Feedback is alleen mogelijk tot 30 minuten na het antwoord. Stel de vraag opnieuw om het te geven.",
  "ask.rueckmeldungAbgelehnt":
    "Je feedback is niet aangenomen. Stel de vraag opnieuw en probeer het dan nog eens.",
  "ask.refreshFailed": "Vernieuwen mislukt — dit antwoord komt van het vorige verzoek.",
  "ask.demoPrefillHint":
    "Startvraag overgenomen uit het kennisobject — klik op „Vragen”. Het antwoord blijft brongebonden; status en vertrouwen beslissen, er wordt niets automatisch opgeslagen.",
  "ask.examplesLabel": "Voorbeelden:",
  "ask.examplesSendHint": "Eén klik vraagt meteen — de vraag wordt direct verstuurd.",
  "ask.example.valve": "Wat te doen als klep X bij overdruk moet sluiten?",
  "ask.example.filter": "Hoe vaak moet filter F3 gecontroleerd worden?",
  "ask.example.dosing": "Waarom schommelt de doseerwaarde bij lijn L4 na elke ploegwissel?",
  "ask.expect.answer": "vindt passende kennis",
  "ask.expect.gap": "toont kennishiaat",
  "ask.reasoner.model": "Modelmodus",
  "ask.reasoner.deterministic": "Deterministische modus",
  "ask.reasoner.loading": "Modus laadt …",
  "ask.reasoner.unknown": "Modus onbekend",
  "ask.reasoner.hint":
    "Toont of antwoorden via een geconfigureerd model of de op regels gebaseerde fallback lopen. Bronnen en validatie blijven gelijk.",
  "ask.fromValidated": "Uit brongebonden kennis",
  "ask.evidence": "Bewijs",
  "ask.knowledgeClass.gesichert": "Geborgd",
  "ask.knowledgeClass.ungeprueft": "Ongecontroleerd",
  "ask.knowledgeClass.meinung": "Mening/ervaring",
  "ask.knowledgeClass.extern": "Externe bron",
  "ask.knowledgeClass.annahme": "Aanname",
  "ask.knowledgeClass.unbekannt": "Onbekend",
  "ask.steps": "Geraadpleegde contextbronnen",
  // AUFTRAG-mega38 BLOCK F — zie het DE-blok: de lijst is de volledige top-K-set, niet de set
  // bronnen die het antwoord daadwerkelijk heeft gebruikt.
  "ask.sources": "Geraadpleegde bronnen",
  // JOB 3064 H5 — zie het DE-blok.
  "ask.menu.label": "Meer over dit antwoord",
  "ask.menu.mehr": "Meer …",
  "ask.export.copy": "Kopiëren",
  "ask.export.download": "Als Markdown",
  "ask.export.print": "Afdrukken / PDF",
  "ask.export.docx": "Als Word (.docx)",
  "ask.export.pptx": "Als PowerPoint (.pptx)",
  "ask.export.pdfDatei": "Als PDF-bestand",
  "ask.export.pdfZeichen":
    "Het PDF-bestand kan deze tekens niet ongewijzigd weergeven: {{zeichen}}. Er is niets gedownload — Word of Markdown geven de tekst zonder verlies door.",
  "ask.export.copied": "Antwoord incl. bronnen gekopieerd.",
  "ask.export.answer": "Antwoord",
  "ask.export.footer":
    "Brongebonden antwoord uit KLARWERK · gemaakt op {{date}}. Alleen zo betrouwbaar als de gebruikte bronnen (status/vertrouwen). Geen belofte van waarheid.",
  // R-1643: beslissingsprotocol — tijdstip en persoon van de export.
  "ask.export.protocol.heading": "Beslissingsprotocol",
  "ask.export.protocol.time": "Tijdstip (UTC)",
  "ask.export.protocol.user": "Gebruikers-ID",
  "ask.export.protocol.userUnknown": "niet aangemeld – geen kenmerk beschikbaar",
  "ask.export.protocol.argumentation": "Redeneerketen",
  "ask.export.protocol.supportedBy": "onderbouwd door",
  "ask.export.protocol.argumentationMissing":
    "Voor dit antwoord is geen redeneerketen beschikbaar. De bronnenlijst vervangt die niet.",
  "ask.sourcesHint":
    "Dit antwoord is brongebonden — het is alleen zo betrouwbaar als de gebruikte bron (status, vertrouwen, bruikbaarheid). Vermeld zijn alle bronnen die voor de vraag zijn geraadpleegd; welke daarvan het antwoord gedragen hebben, is gemarkeerd. Naar het kennisobject voor details.",
  // AUFTRAG-mega52 A3/A5 — het antwoord zegt waarop het steunt. Onbruikbare markeringen betekenen "onbekend".
  "ask.attribution.known":
    "De eerstgenoemde bronnen hebben het antwoord gedragen; de overige zijn geraadpleegd maar niet gebruikt.",
  "ask.attribution.unknown":
    "Welke van deze bronnen het antwoord gedragen heeft, was niet toe te wijzen — de AI leverde geen bruikbare bronverwijzingen. De lijst toont daarom alle geraadpleegde bronnen zonder markering, en „Heeft geholpen” is hier niet mogelijk.",
  // R-0310/R-0325: het antwoord wordt achtergehouden omdat geen alinea aan een bron toe te wijzen was.
  "ask.quellen.weitere": "Nog {{count}} bronnen tonen",
  "ask.zuordnungUnbekannt":
    "Er wordt geen antwoord getoond: het kon aan geen enkele bron worden toegewezen. Een alinea zonder bron wordt niet uitgegeven.",
  // JOB 3267 Q1 — drie toestanden, drie woorden, plus een vierde voor de toetsingsstand
  // (zie de Duitse ingang voor de bevinding die hiermee is verholpen).
  "ask.attribution.carrying.badge": "gebruikt",
  "ask.attribution.carrying.hint":
    "Gebruikt: de AI heeft zich in de antwoordtekst uitdrukkelijk op deze bron beroepen — haar voetnoot staat in de tekst.",
  "ask.attribution.consulted.badge": "niet gebruikt",
  "ask.attribution.consulted.hint":
    "Geraadpleegd, niet gebruikt: deze bron was beschikbaar voor de AI; in de antwoordtekst staat geen voetnoot naar haar.",
  "ask.attribution.unclear.badge": "onbekend",
  "ask.attribution.unclear.hint":
    "Toewijzing onbekend: of deze bron het antwoord gedragen heeft, is niet aan te tonen — de AI leverde daarvoor geen bruikbare of een tegenstrijdige toewijzing.",
  "ask.pruefstand.hint":
    "Toetsingsstand van deze bron: {{stand}}. Dat zegt niets over de vraag of het antwoord haar gebruikt heeft.",
  "ask.pruefstand.unbekannt": "Toetsingsstand onbekend",
  // Pakket 4 (nacht24): bronnen zoals in het document — status/trust per bron + fragment in origineel formaat.
  "answerSource.trust": "Vertrouwen {{n}}",
  "answerSource.excerptShow": "Fragment in documentformaat tonen",
  "answerSource.excerptHide": "Fragment verbergen",
  // JOB 4224 D5: de weg van het bewijs naar het origineel.
  "answerSource.originalsTitle": "Origineel",
  "answerSource.noOriginal": "Voor deze bron is geen origineel opgeslagen.",
  "answerSource.originalFile": "Opgeslagen origineel openen",
  "answerSource.originalAddress": "Origineel adres openen (nieuw venster)",
  "answerSource.originalReference": "Vindplaats zonder opvraagbaar adres",
  // JOB 4224 R3: de DERDE toestand — niet „geblokkeerd" en niet „geen origineel", maar „niet bevestigd".
  "answerSource.originalUnconfirmed":
    "De stand van deze bron is nu niet bevestigd — het bewijs wordt pas weer aangeboden als het vernieuwen lukt.",
  // JOB 4224 D5 (levering 5): zonder model noemt het scherm ook de toegestane weg.
  "ask.aiUnavailable.adminPfad":
    "Als beheerder kun je hier een AI-model koppelen of AI inschakelen:",
  "ask.aiUnavailable.toAdmin": "AI-instellingen openen",
  "ask.aiUnavailable.path":
    "Zonder model blijft de kennisbank open — daarvoor wordt niets automatisch vrijgegeven:",
  "ask.aiUnavailable.toLibrary": "Kennisbank doorzoeken",
  "ask.aiUnavailable.toCapture": "Kennis vastleggen",
  "ask.helpful": "Heeft geholpen",
  "ask.thanked": "Bedankt!",
  "ask.status.verified": "Geborgd",
  "ask.status.unverified": "Nog ongecontroleerd",
  "ask.reviewGuard.openLabel": "Nog niet als geborgde kennis gebruiken",
  "ask.reviewGuard.openHint":
    "Minstens één bron is open of nog in beoordeling. Eerst controleren/beoordelen voordat deze uitspraak als geborgd wordt gebruikt.",
  "ask.reviewGuard.unverifiedLabel": "Antwoord is nog ongecontroleerd",
  "ask.reviewGuard.unverifiedHint":
    "Dit antwoord is niet als geborgd ingeschaald. Controleer bronnen en beoordeling voordat je het verder gebruikt.",
  "ask.reviewGuard.cta": "Naar de validatie",
  "ask.gapBadge": "Kennishiaat",
  // AUFTRAG-mega54 BLOK E — de ene volgende stap bij een hiaat (zie de Duitse tekst). De
  // volgorde is inhoud: eerst de gratis stap, dan kennis vastleggen, pas daarna het risicobord.
  "ask.gapNext":
    "Volgende stap: stel de vraag opnieuw met de vakwoorden uit jullie eigen bedrijf — leg anders de kennis vast of prioriteer het hiaat op het risicobord.",
  "ask.noBasisTitle": "Geen betrouwbare basis.",
  "ask.noBasisBody":
    "Geen enkele bron past nauw genoeg bij deze vraag. In plaats van een verzonnen antwoord is er een kennishiaat aangemaakt. Beide zijn mogelijk: de kennis ontbreekt nog — of ze staat onder andere begrippen in de basis.",
  "ask.gap.rescueTitle": "Kennishiaat redden",
  "ask.gap.rescueImpact":
    "Misschien ontbreekt deze ervaringskennis nog, misschien is ze alleen niet vindbaar. Je kunt helpen om die te borgen — voor iedereen die de vraag in de toekomst stelt.",
  "ask.gap.noInvent":
    "Er is geen antwoord verzonnen: zonder betrouwbare bron blijft de vraag eerlijk open.",
  "ask.gap.rescueCta": "Kennis vastleggen & redden",
  // AUFTRAG-mega54 BLOK E3: kop aangescherpt — de stappen zijn de route voor wie het antwoord al
  // kent. De volgorde van de stappen blijft ongewijzigd.
  "ask.gap.stepsTitle": "Ken jij het antwoord? Zo draag je het bij:",
  "ask.gap.step.answer.label": "Vraag beantwoorden",
  "ask.gap.step.answer.hint": "Formuleer wat je hier uit ervaring over weet.",
  "ask.gap.step.experience.label": "Eigen ervaring aanvullen",
  "ask.gap.step.experience.hint": "Voorwaarden, maatregelen, context.",
  "ask.gap.step.structure.label": "AI laten structureren",
  "ask.gap.step.structure.hint": "De AI ordent alleen — verzint er niets bij.",
  "ask.gap.step.review.label": "Laten controleren",
  "ask.gap.step.review.hint": "Pas na validatie geldt het als geborgd.",
  "ask.contract.label": "Antwoordbasis",
  // JOB 2626 D1: waarom er geen antwoord was — de gesloten poorten, per document.
  "ask.verschlossen.titel": "Hier is inhoud over — Klara kon er geen antwoord op baseren.",
  "ask.verschlossen.grund.freigabe": "Minstens één van deze documenten is nog niet vrijgegeven.",
  "ask.verschlossen.grund.stufe":
    "Minstens één van deze documenten heeft nog geen vertrouwelijkheidsniveau.",
  "ask.verschlossen.grund.volltext":
    "Uit documenten zonder doorzoekbare tekst kan Klara niets onderbouwen. Je kunt ze lezen en de tekst daar aanvullen.",
  "ask.verschlossen.pruefPfad.beides": "Vrijgeven of classificeren:",
  "ask.verschlossen.pruefPfad.freigabe": "Vrijgeven:",
  "ask.verschlossen.pruefPfad.stufe": "Classificeren:",
  "ask.verschlossen.zurPruefung": "Naar beoordeling",
  "ask.verschlossen.label": "Gevonden — maar deze poorten zijn gesloten:",
  "ask.verschlossen.freigabe": "Vrijgave ontbreekt",
  "ask.verschlossen.freigabeHint": "Het document is nog niet vrijgegeven.",
  "ask.verschlossen.stufe": "Niveau ontbreekt",
  "ask.verschlossen.vertraulichkeitsstufe": "Vertrouwelijkheidsniveau ontbreekt",
  "ask.verschlossen.stufeHint": "Voor het document is geen vertrouwelijkheidsniveau ingesteld.",
  "ask.verschlossen.volltext": "Geen doorzoekbare tekst",
  "ask.verschlossen.volltextHint": "Van dit document is nog geen doorzoekbare tekst beschikbaar.",
  // JOB 3109 UX-09: toegankelijke naam van de leeslink en de ene zin die „vrijgegeven" scheidt van
  // „mocht dit antwoord dragen".
  "ask.verschlossen.lesen": "Rapport lezen: {{titel}}",
  "ask.verschlossen.trennung":
    "Vrijgegeven en bruikbaar als antwoordbasis zijn niet hetzelfde: een vrijgegeven document kan hier toch niet dragen — en een document dat je mag openen, hoeft deze vraag niet te hebben beantwoord.",
  "ask.contract.verified.title": "Brongebonden antwoord",
  "ask.contract.verified.body":
    "Dit antwoord steunt op gevalideerde kennis uit jouw kennisbasis — geen generiek chatbot-antwoord.",
  "ask.contract.verified.next": "Volgende stap: bron bekijken of de kennis gebruiken.",
  "ask.contract.unverified.title": "Brongebonden, maar nog ongecontroleerd",
  "ask.contract.unverified.body":
    "Het antwoord steunt op aanwezige, maar nog niet geborgde kennis. Het is als ongecontroleerd gemarkeerd, geen chatbot-veronderstelling.",
  "ask.contract.unverified.next":
    "Veiligere volgende stap: ter controle geven of in de validatie laten controleren.",
  "ask.contract.gap.title": "Kennishiaat, geen chatbot-antwoord",
  "ask.contract.gap.body":
    "Geen enkele bron past nauw genoeg bij deze vraag om een antwoord te dragen. Dat betekent niet per se dat de kennis ontbreekt — misschien staat ze alleen onder andere woorden in de basis. Hoe dan ook is het een hiaat dat jullie kunnen dichten, geen fout.",
  "ask.contract.trustNote":
    "Vertrouwen en bruikbaarheid tonen hoe betrouwbaar een bron is — geen belofte van waarheid.",
  // AUFNAHME 20260922 · Antwort-Erklärung (Begründung im deutschen Block).
  "ask.belastbarkeit.titel": "Hoe betrouwbaar is dit?",
  "ask.belastbarkeit.lage.belegt": "Onderbouwd",
  "ask.belastbarkeit.lage.belegt_zustaendig_fehlt":
    "Onderbouwd — verantwoordelijke niet bereikbaar",
  "ask.belastbarkeit.lage.belegt_mit_konflikt": "Onderbouwd — met tegenstrijdigheid",
  "ask.belastbarkeit.lage.wissensluecke": "Kennishiaat",
  "ask.belastbarkeit.lage.technischer_fehler": "Technische fout",
  "ask.belastbarkeit.lage.geschwaerzt": "Afgeschermd",
  "ask.belastbarkeit.anzahl":
    "{{tragend}} van {{herangezogen}} geraadpleegde bronnen dragen het antwoord",
  "ask.belastbarkeit.vertrauenswert":
    "Vertrouwenswaarde {{wert}} — zo betrouwbaar als de zwakste dragende bron („{{quelle}}”). De bibliotheek toont hetzelfde getal bij die vermelding.",
  "ask.belastbarkeit.vertrauenswertKeiner":
    "Geen vertrouwenswaarde: er is geen dragende bron bekend.",
  "ask.belastbarkeit.vertrauenswertKurz": "Vertrouwenswaarde {{wert}}",
  "ask.belastbarkeit.stand": "Stand {{datum}}",
  "ask.belastbarkeit.quelle.validiert": "gevalideerd",
  "ask.belastbarkeit.quelle.nichtValidiert": "niet gevalideerd",
  "ask.belastbarkeit.verantwortung.eigentuemer": "Verantwoordelijk",
  "ask.belastbarkeit.verantwortung.autor": "Geen verantwoordelijke genoemd, de auteur geldt",
  "ask.belastbarkeit.erreichbar.ja": "bereikbaar",
  "ask.belastbarkeit.erreichbar.nein": "niet bereikbaar",
  "ask.belastbarkeit.erreichbar.unbekannt": "bereikbaarheid onbekend",
  "ask.belastbarkeit.grund.keine_tragfaehige_quelle":
    "Geen enkele bron draagt een antwoord op deze vraag.",
  "ask.belastbarkeit.grund.zuordnung_unbekannt": "Welke bron het antwoord draagt, is niet bekend.",
  "ask.belastbarkeit.grund.alle_tragenden_quellen_validiert":
    "Alle dragende bronnen zijn gevalideerd.",
  "ask.belastbarkeit.grund.tragende_quelle_nicht_validiert":
    "Minstens één dragende bron is niet gevalideerd.",
  "ask.belastbarkeit.grund.pruefnachweis_unvollstaendig":
    "Voor minstens één dragende bron is de conflictcontrole niet volledig aangetoond.",
  "ask.belastbarkeit.grund.offener_konflikt":
    "Een dragende bron staat in een open tegenstrijdigheid.",
  "ask.belastbarkeit.grund.konfliktlage_unbekannt":
    "De conflictstatus kon niet worden opgevraagd — dat betekent niet dat er geen is.",
  "ask.belastbarkeit.grund.zustaendig_nicht_erreichbar":
    "De verantwoordelijke is niet bereikbaar (geen goedgekeurd account). De kennis blijft bruikbaar; vervolgvragen hebben een nieuwe verantwoordelijke nodig.",
  "ask.belastbarkeit.grund.erreichbarkeit_unbekannt":
    "Of de verantwoordelijke bereikbaar is, kon niet worden vastgesteld.",
  "ask.belastbarkeit.grund.verantwortung_nur_autor":
    "Voor minstens één bron is geen verantwoordelijke genoemd; de auteur geldt.",
  "ask.belastbarkeit.konflikt.titel": "Tegenstrijdigheid — beide kanten",
  "ask.belastbarkeit.konflikt.seite": "Kant {{nummer}}",
  "ask.belastbarkeit.konflikt.traegt": "draagt dit antwoord",
  "ask.belastbarkeit.konflikt.nichtEinsehbar": "Deze kant kun je niet inzien.",
  "ask.belastbarkeit.konflikt.keinGewinner":
    "Er wordt geen kant gekozen. Mensen beslissen over de tegenstrijdigheid onder „Conflicten”.",
  "ask.belastbarkeit.hinweis":
    "De vertrouwenswaarde zegt hoe betrouwbaar de bronnen zijn. Ze zegt niets over of iets waar is.",
  "ask.belastbarkeit.argumentation.titel": "Zo komt het antwoord tot stand",
  "ask.belastbarkeit.argumentation.belegstelle": "Bewijsplaats: „{{stelle}}”",
  "ask.belastbarkeit.argumentation.art.aussage": "Bewering",
  "ask.belastbarkeit.woerterbuch.titel":
    "Begrippen aangevuld uit het bedrijfswoordenboek — geen deel van de bronnentelling en zonder vertrouwenswaarde:",
  "ask.belastbarkeit.woerterbuch.eintrag": "Woordenboekitem {{id}}, versie {{fassung}}",
  "ask.belastbarkeit.woerterbuch.verantwortlich": "Verantwoordelijk: {{wer}}",
  "ask.belastbarkeit.woerterbuch.ohneVerantwortung": "Geen verantwoordelijke opgegeven",
  "ask.belastbarkeit.woerterbuch.nichtBewertet": "Betrouwbaarheid niet beoordeeld",
  "ask.belastbarkeit.argumentation.art.beziehung": "Vastgelegde relatie",
  "ask.belastbarkeit.argumentation.beziehung.gehoert_zu": "hoort bij",
  "ask.belastbarkeit.argumentation.beziehung.ergaenzt": "vult aan",
  "ask.belastbarkeit.argumentation.beziehung.ersetzt": "vervangt",
  "ask.belastbarkeit.argumentation.beziehung.widerspricht": "spreekt tegen",
  "ask.belastbarkeit.argumentation.beziehung.beispiel_fuer": "is een voorbeeld van",
  "ask.belastbarkeit.argumentation.gesetztVon": "Relatie vastgelegd door {{wer}}",
  "ask.belastbarkeit.argumentation.gestuetztAuf": "Gebaseerd op: {{quellen}}",
  "ask.belastbarkeit.argumentation.unabhaengig":
    "Tussen deze bronnen is geen relatie vastgelegd — ze staan onafhankelijk naast elkaar.",
  "ask.belastbarkeit.argumentation.art.einwand": "Bezwaar uit een open tegenstrijdigheid",
  "ask.belastbarkeit.argumentation.art.vorbehalt": "Voorbehoud",
  "ask.belastbarkeit.argumentation.art.schluss": "Conclusie",
  "ask.belastbarkeit.argumentation.einstufung.verified": "Inschaling: onderbouwd",
  "ask.belastbarkeit.argumentation.einstufung.unverified": "Inschaling: niet volledig onderbouwd",
  "ask.belastbarkeit.argumentation.einstufung.gap": "Inschaling: kennishiaat",
  "ask.belastbarkeit.wissensart.bauchgefuehl": "Onderbuikgevoel",
  "ask.belastbarkeit.wissensart.best_practice": "Beproefde werkwijze",
  "ask.belastbarkeit.wissensart.lernkurve": "Leercurve",
  "ask.belastbarkeit.wissensart.technik": "Techniek",
  "ask.belastbarkeit.wissensart.negativwissen": "Negatieve kennis",
  "ask.belastbarkeit.zuschnitt":
    "Antwoord en uitleg afgestemd op: {{rolle}}, aanleiding {{anlass}}.",
  "ask.belastbarkeit.rolle.viewer": "lezer",
  "ask.belastbarkeit.rolle.experte": "expert",
  "ask.belastbarkeit.rolle.controller": "beoordelaar",
  "ask.belastbarkeit.rolle.admin": "beheer",
  "ask.belastbarkeit.rolle.unbekannt": "onbekende rol",
  "ask.belastbarkeit.anlass.dokument": "werken aan een document",
  "ask.belastbarkeit.anlass.frage": "vrije vraag",
  "ask.pruefrahmen.satz":
    "Gecontroleerd tegen {{umfang}}: {{verglichen}} passende vermeldingen zijn vergeleken (hoogstens {{hoechstens}} per vraag), geen enkele draagt een antwoord.",
  "ask.pruefrahmen.umfang.validiert": "alleen gevalideerde, niet-vertrouwelijke kennis",
  "ask.pruefrahmen.umfang.nicht_vertraulich": "alle niet-vertrouwelijke kennis",
  "ask.pruefrahmen.woertlich": "Er is letterlijk gezocht, zonder AI-samenvatting.",
  // JOB 3366: der Satz an einer abgeschnittenen KI-Antwort (Begründung im deutschen Block).
  "ai.truncated.hint": "Dit antwoord is bij de lengtelimiet afgebroken en kan onvolledig zijn.",
  "ask.contract.sumTotal_one": "{{count}} bron geraadpleegd",
  "ask.contract.sumTotal_other": "{{count}} bronnen geraadpleegd",
  "ask.contract.sumValidated": "{{count}} gevalideerd",
  "ask.contract.sumOpen": "{{count}} open/ongecontroleerd",
  "ask.contract.sumConflict": "{{count}} met conflict",
  "ask.checkCaveat.title": "Voor dit antwoord is niet aangetoond dat het conflictvrij is.",
  "ask.checkCaveat.badge": "controle onbewezen",
  "ask.checkCaveat.incomplete":
    "Bij {{unproven}} van {{total}} gebruikte bronnen is de conflict- en duplicaatcontrole niet volledig gelopen. Er is dus niet overal gezocht — onbekende tegenstrijdigheden zijn daarmee niet uitgesloten.",
  "ask.checkCaveat.noCoverage":
    "Bij {{unproven}} van {{total}} gebruikte bronnen is wel een controle vastgelegd, maar het bereik ervan is niet aangetoond. Hoe ver er is gezocht, is dus onbekend.",
  "ask.checkCaveat.unchecked":
    "Bij {{unproven}} van {{total}} gebruikte bronnen is helemaal geen controle vastgelegd. Daar is nooit naar tegenstrijdigheden gezocht.",
  "ask.checkCaveat.unknown":
    "{{unproven}} van {{total}} gebruikte bronnen zijn niet in de collectie te vinden. Over hun controle valt niets te zeggen.",
  // AUFTRAG-mega53 B2: de vijfde reden — er kon helemaal geen bron aan dit antwoord worden
  // toegewezen.
  "ask.checkCaveat.unattributed":
    "Dit antwoord noemt geen van de {{total}} gebruikte bronnen als bewijs. Welke bron het werkelijk draagt, is daarmee onbekend — controlestand en vertrouwenswaarde zijn aan geen enkele bron toe te wijzen.",
  "ask.trust.unattributed": "vertrouwenswaarde niet toewijsbaar",
  // AUFTRAG-mega34 A2: de onbekende conflictstand.
  "ask.conflictCaveat.title": "De conflictstand is op dit moment niet op te halen.",
  "ask.conflictCaveat.pending":
    "De bekende tegenstrijdigheden worden nog geladen. Tot ze er zijn geldt dit antwoord als ongecontroleerd — niet omdat er iets is gevonden, maar omdat er nog niet gekeken kon worden.",
  "ask.conflictCaveat.failed":
    "De bekende tegenstrijdigheden konden niet worden opgehaald. Of een van de bronnen in een open conflict staat, is daarmee onbekend; dit antwoord geldt daarom als ongecontroleerd.",
  "gap.privacyNotice":
    "De vraag wordt als kennishiaat opgeslagen — geen antwoord en geen gevalideerde kennis. Leg alsjeblieft geen gevoelige of persoonsgebonden details vast; vul later gecontroleerde ervaring aan.",
  "gap.originalfrage": "Oorspronkelijke vraag",
  "gap.askCount": "{{count}}× gevraagd",
  "gap.ausgangsfrage": "Vraag achter dit kennishiaat",
  "gap.belegbedarf.label": "Ontbrekend bewijs",
  "gap.belegbedarf.wissensobjekt":
    "Geen passend kennisobject gevonden — er ontbreekt er een dat de vraag beantwoordt",
  "gap.belegbedarf.unbestimmt": "Onbepaald — welk bewijs ontbreekt, valt niet af te leiden",
  "nulltreffer.titel": "Jouw zoekopdrachten zonder resultaat",
  "nulltreffer.hinweis":
    "Voor deze termen vond je zoekopdracht niets wat je mag zien — een aanwijzing waar kennis kan ontbreken. Alleen jij ziet deze lijst.",
  "nulltreffer.anzahl": "{{count}}× gezocht",
  "nulltreffer.erfassen": "Kennis vastleggen",
  "nulltreffer.eingegrenzt":
    "Alleen binnen deze afbakening gezocht ({{filter}}) — geen bevinding over het hele bestand.",
  "nulltreffer.feld.type": "Kennissoort",
  "nulltreffer.feld.status": "Status",
  "nulltreffer.feld.category": "Categorie",
  "nulltreffer.feld.tag": "Trefwoord",
  "einzelquelle.titel": "Kennis die alleen bij jou ligt",
  "einzelquelle.satz":
    "Onderwerpen met busfactor 1 waarvan de zichtbare kennis alleen van jou komt: {{count}}",
  "einzelquelle.zeile": "„{{thema}}” — wil je er nu vijf minuten over vertellen?",
  "einzelquelle.einstieg": "Interview starten",
  "einzelquelle.themaLabel": "Onderwerp",
  "ask.toGaps": "Naar de kennishiaten",
  "ask.toCapture": "Kennis vastleggen",
  "ko.use.ready": "Bruikbaar in de praktijk",
  "ko.use.in-review": "In beoordeling",
  "ko.use.needs-work": "Nog in bewerking",
  "use.ready.label": "Bruikbaar",
  "use.ready.hint": "Gevalideerd — brongebonden bruikbaar (status/vertrouwen dragen).",
  "use.review.label": "In beoordeling",
  "use.review.hint": "Beoordeling loopt — nog niet als geborgd gebruiken.",
  "use.open.label": "Te controleren",
  "use.open.hint": "Open/ongecontroleerd — eerst laten controleren/beoordelen.",
  "ko.ovTrust": "Vertrouwen",
  "ko.ovSources_one": "{{count}} bron",
  "ko.ovSources_other": "{{count}} bronnen",
  "ko.ovAttachments_one": "{{count}} bijlage",
  "ko.ovAttachments_other": "{{count}} bijlagen",
  "trust.explain.title": "Wat betekent vertrouwen?",
  "trust.explain.meta":
    "Vertrouwen is een review-/bewijssignaal uit peerbeoordelingen (0–99) — geen belofte dat de uitspraak waar is.",
  "trust.explain.band.high":
    "Hoog vertrouwen: meermaals positief gecontroleerd. Gebruik het toch met je eigen oordeel.",
  "trust.explain.band.mid":
    "Middelmatig vertrouwen: pas deels gecontroleerd of met voorbehoud (geel). Controleer voor kritisch gebruik nog eens tegen.",
  "trust.explain.band.low":
    "Laag vertrouwen: nauwelijks gecontroleerd of rode beoordeling/conflict. Eerst controleren of naschaven.",
  "trust.explain.review":
    "Geel, rood of een open conflict betekent: controleren of naschaven voordat je erop vertrouwt.",
  "ko.nextLabel": "Volgende actie:",
  "ko.next.use": "gevalideerde kennis — kan in antwoorden/output worden gebruikt.",
  "ko.next.review": "Validatie loopt — open beoordeling afronden.",
  "ko.next.addSource": "Bron/bewijs aanvullen voordat er gevalideerd wordt.",
  "ko.next.validate": "ter goedkeuring laten beoordelen (validatie).",
  "ko.cta.use": "In vragen gebruiken",
  "ko.cta.review": "Beoordeling afronden",
  "ko.cta.addSource": "Naar bronnen & bewijs",
  "ko.cta.validate": "Naar de validatie",
  "ko.statement": "Uitspraak",
  "ko.createdAt": "Aangemaakt op",
  // WP-SHIP9-S2 Paket 3 (E2): korte-voorbeeld-uitklapper per kennisobject/kandidaat.
  "ko.preview.show": "Snel voorbeeld",
  "ko.preview.hide": "Voorbeeld sluiten",
  "ko.preview.label": "Voorbeeld",
  // JOB 3326 · leesvariant — de teksten staan in `lib/lesevariante.ts` (toelichting daar).
  ...lesevarianteTexteNl,
  "ko.createdByName": "door {{name}}",
  "ko.gallery": "Afbeeldingengalerij",
  "ko.galleryCount": "Afbeelding {{n}} van {{m}}",
  "ko.galleryClose": "Sluiten",
  "ko.galleryOpen": "Afbeelding {{n}} vergroten",
  "ko.galleryPrev": "Vorige afbeelding",
  "ko.galleryNext": "Volgende afbeelding",
  "ko.galleryEditCaption": "Afbeeldingsbeschrijving bewerken",
  "ko.galleryLoss": "{{n}} van {{m}} afbeeldingen uit het bronbestand ontbreken in dit concept.",
  "ko.body.readTitle": "Uitgebreide inhoud uit de Knowledge-Editor",
  "ko.body.readNote":
    "Blokken en AI-voorstellen zijn redactionele structuur. Bepalend blijven status, vertrouwen en bronnen van dit kennisobject.",
  "ko.body.readBlocksChip": "gestructureerde inhoud",
  "ko.conditions": "Voorwaarden",
  "ko.measures": "Maatregel",
  "ko.validate": "Positief beoordelen",
  "ko.stillValid": "Nog geldig",
  "ko.conditional": "Terugvraag",
  "ko.reject": "Afwijzen",
  "ko.edit": "Bewerken",
  "ko.mehr.konflikt": "Conflict",
  "ko.mehr.quellen": "Bronnen en bewijs",
  "ko.mehr.extern": "Externe kennis",
  "ko.mehr.beitrag": "Bron of bijdrage melden",
  "ko.mehr.provenienz": "Herkomst",
  "ko.mehr.kopplung": "Koppeling en installaties",
  "ko.mehr.herkunftskette": "Herkomstketen",
  "ko.mehr.historie": "Historie",
  "ko.mehr.belege": "Bewijs",
  "ko.mehr.schnappschuesse": "Momentopnamen",
  "ko.mehr.anhaenge": "Bijlagen",
  "ko.mehr.nachbarschaft": "Omgeving",
  "ko.returnedBanner":
    "Dit kennisobject is uit de beoordeling teruggegeven voor naschaving. Werk de reviewfeedback af en sla een revisie op.",
  "ko.rework.title": "Review-naschaving",
  "ko.rework.hint":
    "Aangestoten vanuit een reviewbeslissing (terugkoppeling/afwijzing). Bewerken maakt een nieuwe versie aan en start de beoordeling opnieuw — geen automatische goedkeuring, geen automatische teruggave.",
  "ko.rework.edit": "Bewerken / revisie",
  "ko.rework.back": "Terug naar de validatie",
  "ko.rework.savedTitle": "Revisie opgeslagen",
  "ko.rework.savedHint":
    "Er is een nieuwe versie ontstaan die opnieuw in de beoordeling gaat — geen automatische goedkeuring, geen automatische teruggave.",
  "ko.rework.toValidation": "Naar de validatie van de revisie",
  "ko.rework.feedbackTitle": "Reviewfeedback",
  "ko.rework.feedback.warn": "Terugkoppeling",
  "ko.rework.feedback.down": "Afwijzing",
  "ko.rework.editTitle": "Naschaving: deze feedback afwerken",
  "ko.rework.editHint":
    "Werk de feedback gericht in. Opslaan maakt een nieuwe versie aan en start de beoordeling opnieuw — geen automatische goedkeuring.",
  "ko.rework.stepsTitle": "Volgende werkstappen",
  "ko.rework.step.feedback": "Reviewfeedback afwerken",
  "ko.rework.step.revise": "Revisie opslaan (nieuwe versie, hernieuwde beoordeling)",
  "ko.rework.step.back": "Terug in de validatiefocus „herzien”",
  "ko.saveEdit": "Opslaan",
  "ko.cancelEdit": "Annuleren",
  // JOB 4075 — de onderbouwing per zin staat in het Duitse blok.
  "ko.revise.saved": "Opgeslagen. Het item draagt nu jouw wijziging.",
  "ko.revise.stale":
    "Iemand anders heeft dit item inmiddels gewijzigd — er is niets opgeslagen. Je tekst staat hier onveranderd.",
  "ko.revise.staleVersion":
    "Iemand anders heeft dit item inmiddels gewijzigd, het staat nu op versie {{n}} — er is niets opgeslagen. Je tekst staat hier onveranderd.",
  "ko.revise.reload": "Item opnieuw lezen",
  "ko.revise.again": "Opslaan op de huidige versie",
  "ko.revise.partialTags": "Je tekst is opgeslagen. De trefwoorden zijn niet doorgekomen.",
  "ko.revise.partialTagsCategory":
    "Je tekst is opgeslagen. De trefwoorden en de categorie zijn niet doorgekomen.",
  "ko.revise.partialCategory":
    "Je tekst en de trefwoorden zijn opgeslagen. De categorie is niet doorgekomen.",
  "ko.revise.partialAgain":
    "Druk nog een keer op „{{knopf}}” — alleen wat ontbreekt gaat opnieuw de deur uit. Je tekst blijft precies zoals hij hier staat.",
  "ko.revise.serverNote": "Melding van de server: {{text}}",
  "ko.revise.partialOlder":
    "Een eerdere versie van je tekst is opgeslagen — je laatste wijziging nog niet. Je tekst staat hier onveranderd.",
  "ko.revise.partialForbidden":
    "Verder gaat het nu niet: je mag dit item niet meer wijzigen. De rest wordt pas opgeslagen zodra je het recht weer hebt.",
  "ko.revise.forbidden":
    "Je mag dit item op dit moment niet wijzigen — er is niets opgeslagen. Je tekst staat hier onveranderd.",
  "ko.revise.stalePartial":
    "Iemand anders heeft dit item inmiddels gewijzigd — je laatste wijziging is niet opgeslagen. Een eerdere versie van je tekst van zojuist staat al in het item. Je tekst staat hier onveranderd.",
  "ko.revise.stalePartialVersion":
    "Iemand anders heeft dit item inmiddels gewijzigd, het staat nu op versie {{n}} — je laatste wijziging is niet opgeslagen. Een eerdere versie van je tekst van zojuist staat al in het item. Je tekst staat hier onveranderd.",
  // JOB 4251 — de onderbouwing van deze drie zinnen staat in het Duitse blok.
  "ko.revise.staleEinordnungTags":
    "Je tekst is opgeslagen. Iemand anders heeft de indeling van dit item inmiddels gewijzigd — je trefwoorden zijn niet doorgekomen. Je invoer staat hier onveranderd.",
  "ko.revise.staleEinordnungTagsCategory":
    "Je tekst is opgeslagen. Iemand anders heeft de indeling van dit item inmiddels gewijzigd — je trefwoorden en je categorie zijn niet doorgekomen. Je invoer staat hier onveranderd.",
  "ko.revise.staleEinordnungCategory":
    "Je tekst en je trefwoorden zijn opgeslagen. Iemand anders heeft de indeling van dit item inmiddels gewijzigd — je categorie is niet doorgekomen. Je invoer staat hier onveranderd.",
  // JOB 3667 R3 — de onderbouwing per zin staat in het Duitse blok.
  "ko.propose.mustReview":
    "Dit kennisobject is vrijgegeven. Je wijziging wordt als voorstel ingediend en geldt pas wanneer iemand anders haar overneemt.",
  "ko.propose.optIn": "Eerst iemand anders laten meekijken in plaats van direct vrijgeven",
  "ko.propose.submit": "Wijziging indienen",
  "ko.propose.done":
    "Ingediend. Het item houdt de vrijgegeven versie totdat iemand anders je voorstel overneemt.",
  "ko.propose.stale":
    "Het item is gewijzigd terwijl je schreef — er is niets ingediend. Je tekst staat hier onveranderd.",
  "ko.propose.staleVersion":
    "Het item staat nu op versie {{n}} — er is niets ingediend. Je tekst staat hier onveranderd.",
  "ko.propose.reload": "Item opnieuw lezen",
  "ko.propose.again": "Indienen op de huidige versie",
  "ko.propose.openTitle": "Open wijzigingsvoorstellen ({{n}})",
  "ko.propose.fromVersion": "uit versie {{n}}",
  "ko.propose.take": "Overnemen en vrijgeven",
  "ko.propose.reject": "Afwijzen",
  "ko.propose.rejectReason": "Waarom afgewezen?",
  "ko.propose.rejectConfirm": "Afwijzing opslaan",
  "ko.propose.own": "Je eigen voorstel — iemand anders moet het beoordelen, niet jij.",
  "ko.propose.body.neu": "Uitgebreide inhoud van het voorstel — overnemen vervangt de huidige:",
  "ko.propose.body.gleich": "Uitgebreide inhoud van het voorstel — gelijk aan de huidige:",
  "ko.propose.body.bleibt":
    "Het voorstel wijzigt alleen de uitspraak. De uitgebreide inhoud van het item blijft ongewijzigd bestaan:",
  "ko.propose.body.entfernt":
    "Het voorstel WIST de uitgebreide inhoud: de indiener heeft die leeggemaakt. Overnemen verwijdert de huidige; de uitspraak blijft.",
  "ko.propose.body.keiner": "Geen uitgebreide inhoud — niet in het voorstel en niet in het item.",
  "ko.propose.onlyFields":
    "Ingediend worden uitspraak en uitgebreide inhoud. Kernuitspraak, kennissoort, domein/categorie, voorwaarden, maatregelen en trefwoorden zijn op deze weg niet te wijzigen — ze blijven zoals ze zijn.",
  "ko.propose.droppedFields": "Deze wijzigingen gaan NIET mee en blijven ongewijzigd: {{felder}}.",
  "ko.editNote":
    "Opslaan verhoogt de versie, zet de beoordeling terug en stuurt het object opnieuw in de beoordeling.",
  "ko.revision.title": "Wijzigingsoverzicht",
  "ko.revision.none": "Nog geen wijzigingen herkend.",
  "ko.revision.note":
    "Herkent gewijzigde velden/structuur, niet de inhoudelijke juistheid. Reviseren maakt een nieuwe versie aan en vereist review — geen automatische goedkeuring.",
  "ko.revision.field.title": "Titel",
  "ko.revision.field.statement": "Uitspraak",
  "ko.revision.field.body": "Uitgebreide inhoud",
  "ko.revision.field.conditions": "Voorwaarden",
  "ko.revision.field.measures": "Maatregelen",
  "ko.revision.field.tags": "Tags",
  "ko.revision.field.category": "Categorie",
  "ko.revision.field.type": "Type",
  "ko.reportConflict": "Conflict melden",
  "ko.conflictTitle": "Tegenspraak met een ander kennisobject melden",
  "ko.conflictTarget": "Tegensprekend object",
  "ko.conflictTargetPlaceholder": "Object kiezen …",
  "ko.conflictType": "Conflictsoort",
  "ko.conflictDesc": "Waarin bestaat de tegenspraak?",
  "ko.conflictSubmit": "Conflict openen",
  "ko.conflictTargetSearch": "Kennisobject zoeken …",
  "ko.conflictTargetEmpty": "Geen treffers",
  "ko.conflictTargetChoose": "Kiezen",
  "ko.conflictTargetShow": "Voorbeeld",
  "ko.conflictTargetHide": "Voorbeeld sluiten",
  "ko.provenance": "Herkomst",
  "ko.helpfulTitle": "Bewezen waarde",
  "ko.helpfulHint": "Heeft deze kennis je in de praktijk geholpen?",
  "ko.helpful": "Heeft geholpen",
  "ko.helpfulDone": "Bedankt voor je signaal!",
  "ko.helpfulThanks": "Bedankt — als nuttig genoteerd.",
  "ko.sourceTitle": "Bron/bijdrage melden",
  "ko.sourceContribution": "Jouw bijdrage / jouw onderbouwing (verplicht)",
  "ko.sourceRef": "Bron / URL / referentie (optioneel)",
  "ko.sourceHint":
    "Wordt ter controle als commentaar bij het object opgeslagen — nog geen peer-gevalideerde bron.",
  "ko.sourceSubmit": "Bijdrage indienen",
  "ko.sourceSaved": "Bijdrage als commentaar opgeslagen.",
  "ko.sourcesTitle": "Bronnen",
  "ko.sourcesEmpty": "Nog geen externe bronnen.",
  "ko.sourcesHint": "Externe bronnen zijn niveau 2 en niet peer-gevalideerd.",
  "ext.title": "Externe bron zoeken",
  "ext.hint":
    "Server-proxy-zoekopdracht. Treffers worden nooit automatisch overgenomen; als externe, niet peer-gevalideerde bron toevoegen — geen vervanging voor interne validatie.",
  "ext.placeholder": "Zoekterm …",
  "ext.search": "Zoeken",
  "ext.attach": "Als bron toevoegen",
  // JOB 4367: `ext.attachBlocked` en `ext.gate.how` staan nu in `texte/ux08.ts`.
  // AUFTRAG-mega16 Block A (bens SB-4): het niveau is nu een echte grens — het geldt voor ELK
  // openbaar webadres, niet alleen voor herkende aanbieders.
  "ext.gate.publicUrl":
    "Op het ingestelde niveau kan geen bron met een openbaar webadres worden toegevoegd — dat geldt voor elk adres van het internet, niet alleen voor zoekresultaten.",
  "ext.gate.unanchored":
    "Op het ingestelde niveau kan een bron zonder adres alleen worden toegevoegd als het een passage is uit een document dat bij dit kennisobject is opgeslagen. Zonder adres en zonder opgeslagen document kan de server niet vaststellen of het om een extern zoekresultaat gaat.",
  "ext.unavailable": "Externe zoekopdracht is niet beschikbaar.",
  "ext.resumeHint":
    "De trefferlijst wordt niet met het concept opgeslagen. Je zoekopdracht is terug — voer de zoekopdracht opnieuw uit om de treffers opnieuw te laden.",
  "extpage.kicker": "Onderzoek",
  "extpage.title": "Externe kennis",
  "extpage.intro": "Externe bronnen doorzoeken — zonder eerst een kennisobject te openen.",
  "extpage.note":
    "Alleen-lezen onderzoek via de server-proxy. Hier wordt niets bijgevoegd of geïmporteerd; om iets over te nemen voeg je een bron toe in het kennisobject-detail. Geen peer-validatie.",
  "extpage.idle": "Voer een zoekterm in om externe bronnen te vinden.",
  "extpage.disabled":
    "Externe zoekfunctie is aan de serverkant uitgeschakeld (EXTERNAL_SEARCH=off). Neem contact op met Beheer/Codex.",
  "extpage.noResults": "Geen resultaten voor deze zoekopdracht.",
  "extpage.resultsTitle": "{{n}} resultaten",
  "ko.sourceLabel": "Naam van de bron (verplicht)",
  "ko.sourceUrl": "URL / referentie (optioneel)",
  "ko.sourceExcerpt": "Fragment / notitie (optioneel)",
  "ko.sourceAdd": "Externe bron toevoegen",
  "ko.sourceAdded": "Externe bron toegevoegd.",
  "ko.sourceRemove": "Bron verwijderen",
  "ko.sourceUnvalidated": "extern · niet peer-gevalideerd",
  "ko.sourceValidated": "peer-gevalideerd",
  "ko.sourceExternUnchecked": "Extern · ongecontroleerd",
  "ko.lineageTitle": "Herkomst & verloop",
  "ko.lineageOrigin": "Oorsprong",
  "ko.lineageTransferred": "(overgedragen)",
  "ko.lineageVersions": "Versie",
  "ko.lineageChanges_one": "{{count}} wijziging",
  "ko.lineageChanges_other": "{{count}} wijzigingen",
  "ko.lineageRelated": "Verwant",
  "ko.lineageAudit": "Laatste gebeurtenissen",
  // JOB 3384 · UX-26 — s. die Begründung im deutschen Block.
  "ko.lineageEventsEmpty": "Voor dit object zijn hier geen gebeurtenissen vastgelegd.",
  "ko.lineageGraphLink": "Bekijken in de kennisgraaf",
  "nb.title": "Kennisnetwerk — buurt",
  "nb.hint":
    "In het midden het artikel dat je leest; eromheen wat er via gedeelde tags bij hoort. Eén klik maakt de buur het nieuwe midden.",
  "nb.empty": "Geen buren via betekenisvolle tags.",
  "nb.back": "Terug naar „{{title}}”",
  "nb.open": "Artikel openen",
  "nb.makeCenter": "„{{title}}” het nieuwe midden maken",
  "nb.svgLabel": "Buurt van „{{title}}”",
  "nb.countAll_one": "{{count}} buur in het netwerk",
  "nb.countAll_other": "{{count}} buren in het netwerk",
  "nb.countTruncated": "De {{shown}} sterkste van {{total}} buren",
  "nb.excluded":
    "Geen verbindingen via alledaagse tags: {{tags}} — meer dan de helft van alle objecten draagt ze, dus de verbinding zegt niets.",
  // JOB 4153 (WG-ANZEIGE) — de uitdrukkelijk gezette vakrelaties.
  "wb.titel": "Gezette vakrelaties",
  "wb.hinweis":
    "Uitdrukkelijk gezet en verantwoord door een mens. Niet afgeleid uit gedeelde tags.",
  "wb.herkunft.gesetzt": "gezet",
  "wb.herkunft.abgeleitet": "afgeleid uit tags",
  "wb.leer": "Voor dit item zijn geen relaties gezet.",
  "wb.leerHinweis":
    "Dat zegt niets over de vraag of er tegenspraak bestaat — het betekent alleen dat niemand een relatie heeft gezet.",
  "wb.fehler": "De gezette relaties konden niet worden geladen.",
  "wb.erneut": "Relaties opnieuw laden",
  "wb.standFrisch": "Stand van {{zeit}}",
  "wb.standAuffrischung": "Stand van {{zeit}} · verversen loopt",
  "wb.art.gehoert_zu": "hoort bij",
  "wb.art.ergaenzt": "vult aan",
  "wb.art.ersetzt": "vervangt",
  "wb.art.widerspricht": "spreekt tegen",
  "wb.art.beispiel_fuer": "voorbeeld van",
  "wb.satz.gehoert_zu.quelle": "Dit item hoort bij „{{title}}”.",
  "wb.satz.gehoert_zu.ziel": "„{{title}}” hoort bij dit item.",
  "wb.satz.ergaenzt.quelle": "Dit item vult „{{title}}” aan.",
  "wb.satz.ergaenzt.ziel": "„{{title}}” vult dit item aan.",
  "wb.satz.ersetzt.quelle": "Dit item vervangt „{{title}}”.",
  "wb.satz.ersetzt.ziel": "Dit item wordt vervangen door „{{title}}”.",
  "wb.satz.widerspricht.quelle": "Dit item spreekt „{{title}}” tegen.",
  "wb.satz.widerspricht.ziel": "„{{title}}” spreekt dit item tegen.",
  "wb.satz.beispiel_fuer.quelle": "Dit item is een voorbeeld van „{{title}}”.",
  "wb.satz.beispiel_fuer.ziel": "„{{title}}” is een voorbeeld van dit item.",
  "wb.satz.ohneRichtung": "„{{title}}” · {{art}} · relatie zonder richting",
  "wb.satz.richtungUnbekannt": "„{{title}}” · {{art}} · richting niet bekend",
  "wb.urheber": "gezet door {{urheber}}",
  "wb.gesetztAm": "op {{zeit}}",
  "wb.gesetztAmUnbekannt": "Tijdstip onbekend",
  "wb.fassung.geaendert":
    "De relatie is beoordeeld bij versie {{beurteiltDieser}} van dit item en versie {{beurteiltGegen}} van de tegenhanger; vandaag staat dit item op versie {{aktuellDieser}} en de tegenhanger op versie {{aktuellGegen}}.",
  "wb.fassung.geaendertOhneRolle":
    "De relatie is beoordeeld bij de versies {{beurteiltErste}} en {{beurteiltZweite}} van de twee items; vandaag zijn het versie {{aktuellErste}} en versie {{aktuellZweite}}. Welke versie bij welk van de twee items hoort, staat niet in de informatie.",
  "wb.fassung.unbekannt": "Verband met de versie onbekend.",
  "wb.fassung.unveraendert":
    "Sinds het zetten is geen van beide versies gewijzigd (versie {{aktuellDieser}} van dit item en versie {{aktuellGegen}} van de tegenhanger).",
  "wb.fassung.unveraendertOhneRolle":
    "Sinds het zetten is geen van beide versies gewijzigd (versie {{aktuellErste}} en versie {{aktuellZweite}}).",
  "wb.grenze.widerspricht":
    "„Spreekt tegen” is een verantwoorde aantekening van een mens en geen bewijs.",
  "wb.grenze.ersetzt": "„Vervangt” wijzigt geen vrijgave en publiceert geen opvolger.",
  "wb.widerruf.knopf": "Intrekken",
  "wb.widerruf.frage": "Deze relatie intrekken?",
  "wb.widerruf.frageText":
    "De relatie blijft navolgbaar bewaard en wordt niet verwijderd. Zij geldt daarna als ingetrokken.",
  "wb.widerruf.ja": "Ja, intrekken",
  "wb.widerruf.nein": "Annuleren",
  "wb.widerruf.laeuft": "Wordt verzonden …",
  "wb.widerruf.erfolg": "Ingetrokken. De relatie blijft navolgbaar bewaard.",
  "wb.setzen.titel": "Relatie zetten",
  "wb.setzen.suche": "Doel zoeken",
  "wb.setzen.sucheHinweis": "Zoek op titel of op een woord uit het item.",
  "wb.setzen.sucheLaedt": "Zoekt …",
  "wb.setzen.sucheLeer": "Geen item gevonden dat je mag zien.",
  "wb.setzen.sucheFehler": "De zoekopdracht kon niet worden uitgevoerd.",
  "wb.setzen.zielWaehlen": "„{{title}}” als doel kiezen",
  "wb.setzen.zielGewaehlt": "Doel: „{{title}}” · versie {{version}}",
  "wb.setzen.zielAendern": "Een ander doel kiezen",
  "wb.setzen.art": "Soort relatie",
  "wb.setzen.richtung": "Richting",
  "wb.richtung.gerichtet": "gericht — van dit item naar het doel",
  "wb.richtung.ungerichtet": "ongericht — zonder richting",
  "wb.richtung.symmetrisch": "symmetrisch — in beide richtingen gelijk",
  "wb.richtungKurz.gerichtet": "gericht",
  "wb.richtungKurz.ungerichtet": "zonder richting",
  "wb.richtungKurz.symmetrisch": "symmetrisch",
  "wb.setzen.knopf": "Relatie zetten",
  "wb.setzen.laeuft": "Wordt verzonden …",
  "wb.setzen.erfolg": "De relatie is gezet — de server heeft haar bevestigd.",
  "wb.setzen.fassungUnbekannt":
    "De versie van dit item is nog niet bekend. Zolang zij ontbreekt wordt er niets verzonden.",
  "wb.setzen.zielFehlt": "Kies eerst een doel.",
  "wb.fehler.keinRecht":
    "Je mag hier niets zetten, of een van beide items is voor jou niet zichtbaar. Er is niets opgeslagen, je invoer blijft bewaard.",
  "wb.fehler.standVeraltet":
    "De stand is gewijzigd: dit item is nu versie {{quelle}}, het doel versie {{ziel}}. Er is niets gezet, je invoer blijft bewaard.",
  "wb.fehler.standVeraltetOhneZahlen":
    "De stand is gewijzigd. De nieuwe stand wordt opgehaald; er is niets gezet, je invoer blijft bewaard.",
  "wb.fehler.konflikt":
    "De relatie is intussen gewijzigd. Er is niets geschreven, je invoer blijft bewaard.",
  "wb.fehler.abgelehnt":
    "De server heeft de handeling afgewezen. Er is niets gezet, je invoer blijft bewaard.",
  "wb.fehler.unklar":
    "Er is geen antwoord aangekomen. Of de relatie is gezet, is daarmee onduidelijk — de lijst is daarna opnieuw geladen en toont die stand. Je invoer blijft bewaard; verzend je die ongewijzigd opnieuw, dan ontstaat er geen tweede relatie.",
  "wb.fehler.unklarLaedt":
    "Er is geen antwoord aangekomen. Of de relatie is gezet, is daarmee onduidelijk. De lijst wordt nu opnieuw geladen; tot zij er is, toont de lijst hierboven een oudere stand. Je invoer blijft bewaard; verzend je die ongewijzigd opnieuw, dan ontstaat er geen tweede relatie.",
  "wb.fehler.unklarNichtGeladen":
    "Er is geen antwoord aangekomen, en de lijst kon niet opnieuw worden geladen. Of de relatie is gezet, is daarmee onduidelijk; de lijst hierboven toont een oudere stand. Je invoer blijft bewaard; verzend je die ongewijzigd opnieuw, dan ontstaat er geen tweede relatie.",
  "wb.widerruf.unklar":
    "Er is geen antwoord aangekomen. Of de intrekking is aangekomen, is daarmee onduidelijk — de lijst is daarna opnieuw geladen en toont die stand.",
  "wb.widerruf.unklarLaedt":
    "Er is geen antwoord aangekomen. Of de intrekking is aangekomen, is daarmee onduidelijk. De lijst wordt nu opnieuw geladen; tot zij er is, toont de lijst hierboven een oudere stand.",
  "wb.widerruf.unklarNichtGeladen":
    "Er is geen antwoord aangekomen, en de lijst kon niet opnieuw worden geladen. Of de intrekking is aangekomen, is daarmee onduidelijk; de lijst hierboven toont een oudere stand.",
  "wb.fehler.andereAntwort":
    "De server heeft een andere relatie teruggemeld dan gevraagd. Je opdracht is daarmee NIET bevestigd. Je invoer blijft bewaard; verzend opnieuw als je haar nog wilt.",
  "wb.fehler.widerrufeneAntwort":
    "De server heeft bij deze poging een ingetrokken relatie teruggemeld. Zij geldt daarmee niet als gezet. Je invoer blijft bewaard; verzend opnieuw als de relatie moet gelden.",
  "wb.widerruf.nichtBestaetigt":
    "De server meldt de relatie na de intrekking nog steeds als actief. De intrekking is daarmee niet bevestigd. Probeer het opnieuw.",
  "graph.legendKuratiert": "gezette vakrelatie",
  "graph.kuratiertCount_one": "{{count}} gezette vakrelatie",
  "graph.kuratiertCount_other": "{{count}} gezette vakrelaties",
  "graph.kuratiertKante": "gezet: {{art}} · {{richtung}}",
  "graph.kuratiertGeladen":
    "{{geladen}} van {{gesamt}} vakrelaties zijn geladen. De graaf toont een beperkte selectie.",
  "ko.transferTitle": "Auteur overdragen",
  "ko.transferOriginal": "Oorspronkelijke auteur",
  "ko.author": "Auteur",
  "ko.authorUnknown": "Onbekende persoon ({{ref}})",
  "ko.authorLoading": "Auteursnaam wordt geladen …",
  "ko.authorUnavailable": "Auteursnaam niet beschikbaar",
  "ko.originalAuthor": "Origineel",
  "ko.transferPick": "Nieuwe auteur kiezen …",
  "ko.transfer": "Overdragen",
  "ko.transferDone": "Auteur overgedragen. Oorspronkelijke auteur blijft zichtbaar.",
  "ko.history": "Versies",
  "ko.evidenceTitle": "Bewijs",
  // JOB 3384 · UX-26 — s. die Begründung im deutschen Block.
  "ko.evidenceEmpty": "Voor dit object is nog geen bewijs vastgelegd.",
  "ko.evidenceEmptyCta": "Bron toevoegen",
  "ko.evidenceEmptyCtaHint":
    "Toevoegen in het gedeelte ‘Bronnen en bewijs’ — daaruit ontstaat het eerste bewijs",
  "ko.evidenceKind.source": "Bewijs voor een bron",
  "ko.evidenceKind.attachment": "Bewijs voor een bijlage",
  "ko.evidenceToOriginal": "Origineel tonen",
  "ko.evidenceToOriginalHint": "Het origineel tonen in het gedeelte ‘Bijlagen’",
  // JOB 4367: `ko.evidenceOriginalDetached` staat nu in `texte/ux26.ts`.
  "ko.evCons.title": "Evidence-consistentie",
  "ko.evCons.status.ok": "kloppend",
  "ko.evCons.status.warning": "controleren",
  // JOB 3384 · UX-26: auch hier stand das englische „Evidence" als Hauptaussage — s. den deutschen
  // Block. Gleiche Sache, niederländisches Wort.
  "ko.evCons.counts": "Bronnen {{sources}} · Bijlagen {{attachments}} · Bewijs {{evidence}}",
  // JOB 4367: `ko.evCons.allOk` staat nu in `texte/ux26.ts`.
  "ko.evCons.finding.source-without-evidence": "Bron zonder bewijs",
  "ko.evCons.finding.attachment-without-evidence": "Bijlage zonder bewijs",
  "ko.evCons.finding.evidence-without-source": "Bewijs zonder bron",
  "ko.evCons.finding.evidence-without-attachment": "Bewijs zonder bijlage",
  "ko.evCons.finding.legacy-inline-attachment": "Oude inline-bijlage (zonder bewijs)",
  "ko.evVer.title": "Evidence per versie",
  "ko.evVer.version": "v{{n}}",
  "ko.evVer.counts": "Bronnen {{sources}} · Bijlagen {{attachments}}",
  "ko.evVer.latest": "laatst {{at}}",
  "ko.evVer.without": "Zonder bewijs: {{versions}}",
  "ko.evFresh.title": "Evidence-actualiteit",
  "ko.evFresh.current": "actueel onderbouwd",
  "ko.evFresh.outdated": "alleen oudere versies",
  // JOB 4367: `ko.evFresh.missing` en `ko.evFresh.neutral` staan nu in `texte/ux26.ts`.
  "ko.evFresh.counts": "v{{version}} · actueel {{current}} · ouder {{older}}",
  // JOB 3627: die niederländische Seite der festen Dienst-Vermerke (de `:3038-3042`).
  "ko.historyNote.created": "aangemaakt",
  "ko.historyNote.createdFromDocument": "aangemaakt (documentinhoud overgenomen)",
  "ko.historyNote.createdBackfilled": "aangemaakt (nagetrokken)",
  "ko.historyNote.revised": "herzien",
  "ko.historyNote.revisedFromDocument": "herzien (documentinhoud overgenomen)",
  "ko.snapshotsTitle": "Versie-snapshots",
  "ko.snapshotsEmpty": "Nog geen opgeslagen volledige snapshots aanwezig.",
  "ko.snapshotInitial": "Beginversie — geen diff met voorganger.",
  "ko.snapshotNoChanges": "Geen wijziging in de hoofdvelden.",
  "ko.snapshotField.title": "Titel",
  "ko.snapshotField.statement": "Uitspraak",
  "ko.snapshotField.conditions": "Voorwaarden",
  "ko.snapshotField.measures": "Maatregelen",
  "ko.snapshotField.type": "Soort",
  "ko.snapshotField.status": "Status",
  "ko.snapshotField.bodyHtml": "Uitgebreide inhoud",
  "ko.snapshotOpen": "Versie openen",
  "ko.snapshotClose": "Versie sluiten",
  "ko.snapshotBodyChars": "{{anzahl}} tekens tekst",
  "ko.snapshotBodyMissing": "Voor deze versie is geen uitgebreide inhoud opgeslagen.",
  "ko.snapshotReadOnly": "Oudere versie v{{version}} · deze blijft ongewijzigd staan",
  "ko.snapshotBackToCurrent": "Terug naar de huidige versie",
  "ko.snapshotCompareTitle": "Twee versies vergelijken",
  "ko.snapshotCompareFrom": "oudere versie",
  "ko.snapshotCompareTo": "nieuwere versie",
  "ko.snapshotCompareNeedsTwo":
    "Vergelijken vraagt twee opgeslagen versies — tot nu toe is er maar één.",
  "ko.snapshotCompareChoose": "kies een versie",
  "ko.snapshotCompareHint":
    "Kies twee versies — dan staat hier veld voor veld wat tussen beide verschilt.",
  "ko.snapshotCompareNone": "In de vergeleken velden verschillen deze twee versies niet.",
  "ko.snapshotCompareSame": "Dit is twee keer dezelfde versie — kies er twee verschillende.",
  "ko.snapshotCompareUnknown":
    "Een van beide versies is nu niet beschikbaar — de vergelijking blijft open.",
  "ko.snapshotFieldEmpty": "niets opgeslagen",
  "ko.snapshotRestore": "Als werkversie overnemen",
  "ko.snapshotRestoreHint":
    "maakt daaruit een nieuwe, open versie; deze versie blijft ongewijzigd staan",
  "ko.snapshotRestoreRunning": "Wordt overgenomen …",
  "ko.snapshotRestoreDone":
    "Overgenomen. De inhoud van v{{version}} staat nu als nieuwste versie — open en ongecontroleerd; de eerdere vrijgave is niet meegekomen.",
  "ko.snapshotRestoreStale":
    "Iemand anders heeft dit item intussen gewijzigd — er is niets overgenomen, hun werk staat ongewijzigd.",
  "ko.snapshotRestoreAgain": "Toch overnemen, op de huidige stand",
  "ko.snapshotRestoreOffline":
    "Zonder verbinding valt er niets over te nemen — je keuze blijft staan.",
  "ko.snapshotRestoreNoRight":
    "Je kunt deze versie lezen, maar niet terughalen — daarvoor ontbreekt het bewerkingsrecht.",
  "ko.snapshotRestoreNeedsRelease":
    "Dit item is vrijgegeven — een eerdere stand kan hier alleen iemand terughalen die mag vrijgeven. Jouw wijziging gaat als voorstel via „Bewerken”.",
  "ko.snapshotRestoreIsCurrent": "Dit is de huidige stand — hier valt niets terug te halen.",
  "ko.snapshotRestoreNoContent":
    "Voor deze versie is geen opgeslagen stand beschikbaar om over te nemen.",
  "ko.snapshotRestoredFrom": "overgenomen uit versie v{{version}}",
  "ko.comments": "Reacties",
  "ko.commentsEmpty": "Nog geen reacties.",
  "ko.commentPlaceholder": "Reactie schrijven …",
  "ko.commentAdd": "Reageren",
  // JOB 4146: „opgelost" — nooit „goedgekeurd"/„vrijgegeven"/„gecontroleerd" (zie het Duitse blok).
  "ko.diskussion.titel": "Discussie",
  "ko.diskussion.version": "bij versie v{{version}}",
  "ko.diskussion.versionVeraltet":
    "bij versie v{{version}} · het item staat inmiddels op v{{aktuell}}",
  "ko.diskussion.versionUnbekannt": "Versieverwijzing onbekend",
  "ko.diskussion.antworten": "Antwoorden",
  "ko.diskussion.antwortAn": "Antwoord aan {{name}}",
  "ko.diskussion.antwortSenden": "Antwoord versturen",
  "ko.diskussion.antwortAbbrechen": "Annuleren",
  "ko.diskussion.erledigtVon": "opgelost · {{name}} · {{datum}}",
  "ko.diskussion.wiederGeoeffnetVon": "weer open · {{name}} · {{datum}}",
  "ko.diskussion.alsGeklaertMarkieren": "Als opgelost markeren",
  "ko.diskussion.wiederOeffnen": "Weer openen",
  "ko.diskussion.sendeFehler":
    "Je bijdrage is niet opgeslagen. Je tekst staat nog in het veld — met „Opnieuw versturen“ gaat hij meteen nog eens de deur uit.",
  "ko.diskussion.sendeFehlerVeraltet":
    "Iemand anders schreef op hetzelfde moment. Je tekst staat nog in het veld — „Opnieuw versturen“ hangt hem aan de nieuwste stand.",
  "ko.diskussion.sendeFehlerUnklar":
    "Of je bijdrage is opgeslagen, is onduidelijk — de verbinding brak af voordat er antwoord kwam. Je tekst staat nog in het veld. „Opnieuw versturen“ legt hem geen tweede keer neer.",
  "ko.diskussion.erneutSenden": "Opnieuw versturen",
  "ko.attachments": "Bijlagen / foto's",
  "ko.attachmentsEmpty": "Nog geen bijlagen.",
  "ko.attachmentAdd": "Foto toevoegen",
  "ko.attachmentUploading": "Wordt geüpload …",
  "ko.attachmentRemove": "Bijlage verwijderen",
  "ko.attachmentOpenNewTab": "Origineel openen in nieuw tabblad",
  "ko.attachmentPreviewUnavailable": "Geen voorbeeld beschikbaar",
  "ko.attachmentOriginalUnavailable": "Origineel niet beschikbaar",
  "pruefen.title": "Controleren",
  "pruefen.handeltAls": "Je controleert als {{role}}",
  "pruefen.tab.offen": "Open",
  "pruefen.tab.konflikte": "Conflicten",
  "pruefen.tab.duplikate": "Duplicaten",
  "pruefen.tab.erneut": "Opnieuw",
  "pruefen.menu.actions": "Acties",
  "pruefen.menu.filter": "Filter en focus",
  "pruefen.menu.help": "Hulp bij dit scherm",
  "pruefen.more": "Meer",
  "pruefen.images": "{{n}} afbeeldingen",
  "pruefen.kVonN": "{{k}} van {{n}}",
  "pruefen.prev": "Vorige item",
  "pruefen.next": "Volgende item",
  "pruefen.reload": "Opnieuw laden",
  "pruefen.loadError": "Kon niet worden geladen.",
  "pruefen.refreshFailed": "Getoonde stand · verversen mislukt.",
  "pruefen.lastDecision": "Laatst",
  "pruefen.mehr.status": "Controlestand",
  "pruefen.mehr.aiCheck": "AI-controle",
  "pruefen.mehr.reviewContext": "Controlecontext",
  "pruefen.mehr.zustand": "Status",
  "pruefen.mehr.evidence": "Bewijslast",
  "pruefen.mehr.effect": "Effect van de beslissing",
  "pruefen.mehr.recommendation": "Aanbeveling",
  "dup.redacted.title": "Inhoud achtergehouden",
  "dup.redacted.body": "Je mag ten minste één kant van deze bevinding niet lezen.",
  "con.redacted.title": "Bewijs achtergehouden",
  "con.redacted.body": "Je mag ten minste één van beide uitspraken niet lezen.",
  "val.kicker": "Validation Board",
  "val.intro":
    "Peer-beoordeling groen / geel / rood. Vanaf de drempel (standaard 3× groen, 0× rood) geldt een object als gevalideerd.",
  // JOB 3290: noemt dezelfde grens als het Duitse/Engelse label — de uitgebreide inhoud wordt
  // niet doorzocht.
  "val.filter": "Filteren (zonder uitgebreide inhoud) …",
  "val.filterAllTypes": "Alle kennissoorten",
  "val.filterAllCategories": "Alle categorieën",
  "val.filterAllTags": "Alle tags",
  "val.filterMine": "Aan mij toegewezen",
  // WP-SUBMIT-ASYNC: status van de achtergrond-AI-controle op de kaart + filter.
  "val.filterAiPending": "AI-controle loopt",
  "val.aiCheck.pending": "Duplicaat-/overlapcontrole loopt",
  "val.aiCheck.pendingAi": "Duplicaat-/conflictcontrole (met AI) loopt",
  "val.aiCheck.pendingHint":
    "De deterministische duplicaat-/overlapcontrole draait op de achtergrond. Het resultaat verschijnt hier zodra deze klaar is.",
  "val.aiCheck.pendingHintAi":
    "De duplicaat-/conflictcontrole (met AI) op conflicten en overlappingen draait op de achtergrond. Het resultaat verschijnt hier zodra deze klaar is.",
  "val.aiCheck.failed": "Controle mislukt",
  "val.aiCheck.retry": "Opnieuw controleren",
  "val.aiCheck.retryStarted": "Controle opnieuw ingepland — deze draait nu op de achtergrond.",
  "val.aiCheck.locked":
    "Duplicaat-/overlapcontrole loopt … beoordelingsacties zijn geblokkeerd totdat het resultaat er is.",
  "val.aiCheck.lockedAi":
    "Duplicaat-/conflictcontrole (met AI) loopt … beoordelingsacties zijn geblokkeerd totdat het resultaat er is.",
  "val.aiCheck.reason.no-model":
    "Geen AI-model actief — er is niets gecontroleerd. Configureer een model en controleer opnieuw.",
  "val.aiCheck.reason.model-error":
    "De AI-controle is met een fout gestopt. Opnieuw controleren start een nieuwe run.",
  "val.aiCheck.reason.timeout":
    "De AI-controle heeft de tijdslimiet overschreden en is afgebroken. Opnieuw controleren start een nieuwe run.",
  "val.aiCheck.reason.model-timeout":
    "Het AI-model heeft niet op tijd geantwoord. Opnieuw controleren start een nieuwe run.",
  "val.aiCheck.reason.queue-overflow":
    "De controlewachtrij was vol — deze taak is verdrongen. Opnieuw controleren plant hem opnieuw in.",
  // D-AISTATE PAKET 1 (bens V1): vertrouwelijk → cloud-AI uitgesloten, geen lokaal model.
  "val.aiCheck.reason.confidential":
    "Vertrouwelijk — de cloud-AI is uitgesloten en er is geen lokaal model beschikbaar. Alleen de deterministische duplicaat-/overlapcontrole liep; er is geen inhoudelijke AI-controle uitgevoerd.",
  // AUFTRAG-mega11 Block A (bens SB-1): neutraal — geen uitspraak over beschermde inhoud.
  "val.aiCheck.reason.privacy-no-cloud":
    "Voor deze controle is de cloud-AI om privacyredenen niet beschikbaar en er is geen lokaal model gereed. Alleen de deterministische duplicaat-/overlapcontrole liep; er is geen inhoudelijke AI-controle uitgevoerd.",
  // RT-001 (Pedi): eerlijke classificatie van echte providerfouten — nooit een providernaam/sleutel/
  // endpoint/ruwe fouttekst, alleen een begrijpelijke oorzaak plus wat de gebruiker kan doen.
  "val.aiCheck.reason.auth":
    "De AI kon niet inloggen — de inloggegevens ontbreken of zijn geweigerd. Controleer de modelinloggegevens in de instellingen en controleer opnieuw.",
  "val.aiCheck.reason.rate-limit":
    "De AI-aanbieder heeft het verzoek geweigerd vanwege een snelheidslimiet. Wacht even en controleer opnieuw.",
  "val.aiCheck.reason.unreachable":
    "De AI-aanbieder was niet bereikbaar — waarschijnlijk een netwerk- of verbindingsprobleem. Controleer de verbinding en controleer opnieuw.",
  "val.aiCheck.reason.bad-response":
    "Het AI-model gaf een onbegrijpelijk antwoord dat niet kon worden verwerkt. Opnieuw controleren start een nieuwe run.",
  // AUFTRAG-mega23 Block B: TECHNISCHE inplanning mislukt — het model is nooit geraadpleegd en heeft
  // niets aangemerkt. De tekst zegt precies dat en doet zich niet voor als een modelfout.
  "val.aiCheck.reason.submit-followup-failed":
    "De controle kon bij het indienen om technische redenen niet worden ingepland — het AI-model is daarbij niet geraadpleegd en heeft niets aangemerkt. Opnieuw controleren plant hem opnieuw in.",
  // AUFTRAG-mega28 A2/A3: met de kandidaat-limiet mag een run niet meer suggereren dat hij de hele
  // bibliotheek heeft gezien. Deze teksten noemen de aantallen en zeggen wat een leeg resultaat NIET betekent.
  "val.aiCheck.reason.capacity":
    "De controle is afgebroken omdat het AI-model overbelast was — hij is niet tot het einde gelopen. Opnieuw controleren start een nieuwe run.",
  "val.aiCheck.boardCaveat":
    "Dat betekent niet “gecontroleerd en vrij”: van {{total}} kennisobjecten hebben er {{incomplete}} een onvolledige controle en {{unchecked}} helemaal geen. De detectie vergelijkt elke bijdrage alleen met een beperkte groep kandidaten.",
  // AUFTRAG-mega31 A4: “helemaal geen run” en “geen dekking aangetoond” zijn TWEE uitspraken.
  "val.aiCheck.boardCaveat.noCoverage":
    "Bij {{noCoverage}} andere is een controle vastgelegd, maar geen dekking aangetoond — over hun bereik is niets vastgesteld.",
  "val.aiCheck.coverage.partial": "DEELS GECONTROLEERD",
  "val.aiCheck.coverage.capped":
    "Vergeleken met ten minste {{completed}} van {{available}} mogelijke buren — geen volledige vergelijking. Het getal is de conservatieve minimumdekking van beide controles (conflict en duplicaat); de zwakste van de twee bepaalt het. Geen bevinding betekent: niets gevonden binnen die groep, niet “vrij van conflicten en duplicaten”.",
  "val.aiCheck.coverage.skipped":
    "Vergeleken met ten minste {{completed}} van {{available}} mogelijke buren; {{skipped}} vergelijkingen zijn door fouten overgeslagen — de run is onvolledig. Geen bevinding betekent niet “vrij van conflicten en duplicaten”.",
  "val.aiCheck.coverage.aborted":
    "Afgebroken na ten minste {{completed}} van {{available}} mogelijke buren — de rest is niet gecontroleerd. Geen bevinding betekent niet “vrij van conflicten en duplicaten”.",
  "val.aiCheck.coverage.unproven":
    "Deze run is niet als volledig aangetoond: het protocol vermeldt {{completed}} afgeronde vergelijkingen bij {{available}} mogelijke buren. Geen bevinding betekent niet “vrij van conflicten en duplicaten”.",
  "val.feedback.condTitle": "Terugvraag – onderbouwing voor de auteur (verplicht)",
  "val.feedback.rejTitle": "Afwijzing – onderbouwing voor de auteur (verplicht)",
  "val.feedback.placeholder": "Wat moet er worden herzien? …",
  "val.feedback.submit": "Versturen",
  "val.feedback.cancel": "Annuleren",
  "val.feedback.error": "Kon niet worden opgeslagen.",
  "val.feedback.helpHint":
    "Jouw feedback helpt de auteur om de volgende versie gericht bij te werken.",
  "val.empty": "Geen openstaande objecten.",
  "val.target": "Doel: {{n}}× groen",
  "val.trust": "Vertrouwen",
  "val.votes": "{{have}} van {{need}} groen",
  "val.votesTitle": "Validatie-voortgang",
  "val.votesHint":
    "Zo veel groene (positieve) beoordelingen zijn er vastgelegd — van de {{need}} die nodig zijn tot aan de validatie. Vanaf voldoende groene en 0 rode geldt het object als gevalideerd; rode beoordelingen blokkeren de goedkeuring.",
  "val.votesBlocked": "{{count}}× rood",
  "val.staleVotes": "{{count}}× verouderd",
  "val.staleVotesHint":
    "Deze beoordelingen komen uit een eerdere revisie (vóór v{{version}}) en tellen niet meer mee. Het object heeft nieuwe beoordelingen van de huidige versie nodig.",
  "val.markTrue": "Als waar markeren",
  "val.markTrueConfirm": "Als waar markeren en volledig valideren?",
  "val.markTrueCancel": "Annuleren",
  "val.markTrueYes": "Ja, valideren",
  "val.markTrueDone": "Als waar gemarkeerd — object is nu gevalideerd.",
  "val.more": "Signalen & context tonen",
  "val.editKo": "Bewerken",
  "val.transferred": "Auteur overgedragen",
  "val.assigned": "toegewezen",
  "val.decisionLabel": "Beslissing open:",
  "val.reviewContext.new": "Nieuw",
  "val.reviewContext.revision": "Herzien",
  "val.reviewContext.hint.new": "Eerste beoordeling: bron, uitspraak en structuur controleren.",
  "val.reviewContext.hint.revision":
    "Wijziging controleren: versie en inhoud opnieuw beoordelen — geen automatische goedkeuring.",
  "val.reviewFocus.label": "Review-focus",
  "val.reviewFocus.all": "Alle",
  "val.reviewFocus.new": "Nieuw",
  "val.reviewFocus.revision": "Herzien",
  "val.focusActive.label": "Actieve filters",
  "val.focusReset": "Filters resetten",
  "val.focusEmpty.filtered": "Geen resultaten met de huidige filters.",
  "val.focusEmpty.otherFilters": "Pas zoekterm, type, categorie of tag aan.",
  "val.mineFocus.title": "Aan jou toegewezen review-werk",
  "val.mineFocus.hint": "Dit is jouw persoonlijke review-lijst. Je kunt hem nu afwerken.",
  "val.mineFocus.count": "{{n}} voor jou",
  "val.mineFocus.reset": "Alle openstaande tonen",
  "val.mineEmpty.title": "Geen aan jou toegewezen review-werk",
  "val.mineEmpty.hint":
    "Zodra er iets aan je wordt toegewezen, verschijnt het hier. Tot dan staat hier niets voor je open.",
  "val.mineEmpty.cta": "Alle openstaande objecten bekijken",
  "val.decision.low": "weinig onderbouwd — zorgvuldig controleren, bronnen/bewijs bekijken.",
  "val.decision.mid": "gedeeltelijk onderbouwd — uitspraak en bronnen tegen elkaar controleren.",
  "val.decision.high": "goed onderbouwd — een korte controle volstaat meestal.",
  "val.reviewState.new": "Nieuw vastgelegd · open",
  "val.reviewState.assigned": "Toegewezen · beoordeling loopt",
  "val.reviewState.inReview": "Beoordeling begonnen",
  "val.reviewState.validated": "Gevalideerd",
  "val.reviewHint.new": "Nog geen beoordeling — nu inhoudelijk controleren.",
  "val.reviewHint.assigned": "Toegewezen — de verantwoordelijke persoon beoordeelt als volgende.",
  "val.reviewHint.inReview": "Beoordeling loopt — bronnen en uitspraak tegen elkaar controleren.",
  "val.reviewHint.validated": "Al gevalideerd.",
  "val.confirm": "Bevestigen",
  "val.conditional": "Voorwaardelijk",
  "val.reject": "Afwijzen",
  "val.actionApprove": "Goedkeuren",
  "val.actionQuery": "Terugvraag",
  "val.actionReject": "Afwijzen",
  "val.feedbackRequiredHint": "* Terugvraag en afwijzing hebben een onderbouwing nodig.",
  "val.guide.title": "Wat controleer ik nu?",
  "val.guide.statement": "Uitspraak",
  "val.guide.statement.hint": "Klopt de kernuitspraak inhoudelijk?",
  "val.guide.evidence": "Bron & bewijs",
  "val.guide.evidence.hint": "Zijn er bron of bewijs aanwezig en houdbaar?",
  "val.guide.context": "Context",
  "val.guide.context.hint": "Is duidelijk wanneer en waar dit geldt?",
  "val.guide.traceable": "Navolgbaarheid",
  "val.guide.traceable.hint": "Is het begrijpelijk en navolgbaar beschreven?",
  "val.guide.focus.revision":
    "Herzien — controleer gericht wat er sinds de vorige versie is veranderd.",
  "val.guide.focus.transfer": "Auteur is overgedragen — kijk extra goed naar uitspraak en bewijs.",
  "val.guide.trustNote":
    "Vertrouwen is een review-signaal, geen waarheidsgarantie. Pas voldoende goedkeuringen — het afgesproken minimum aantal controleurs — maken kennis geborgd.",
  "val.guide.impactTitle": "Wat bewerkstelligt de beslissing?",
  "val.impact.up.title": "Goedkeuren",
  "val.impact.up.body":
    "Telt als één goedkeuringsstem. Kennis wordt pas bruikbaar als status, het aantal goedkeuringen en vertrouwen het dragen — er wordt niets automatisch goedgekeurd.",
  "val.impact.warn.title": "Terugvraag",
  "val.impact.warn.body":
    "Vereist een korte onderbouwing. Blijft review-werk en helpt de auteur om gericht bij te werken.",
  "val.impact.down.title": "Afwijzen",
  "val.impact.down.body":
    "Vereist een korte onderbouwing. Leidt tot herwerking — er wordt niets automatisch afgesloten.",
  "val.decisionSaved": "Beoordeling vastgelegd.",
  "val.outcome.up":
    "Positief beoordeeld. Als status en vertrouwen het dragen, kan het als volgende stap brongebonden worden gebruikt of gecontroleerd — automatisch gevalideerd wordt er daardoor niets.",
  "val.outcome.warn":
    "Terugvraag gedocumenteerd. Blijft review-werk totdat de openstaande punten zijn opgehelderd.",
  "val.outcome.down": "Afwijzing gedocumenteerd. Blijft review-/feedback-werk.",
  "val.nextViewKo": "Object bekijken",
  "val.nextUse": "Kennis gebruiken (vragen)",
  "val.nextRework": "In het object bijwerken",
  "val.assign": "Toewijzen …",
  "val.openDetails": "Details bekijken — bewerken & verwijderen in het object",
  // AUFTRAG-mega38 BLOCK E — zie het DE-blok: de wand toont recent VASTGELEGDE kennis, geen
  // geborgde; ze filtert niet op status.
  "start.livewall.title": "Wat er nu gebeurt",
  "start.livewall.subtitle": "Recent vastgelegde kennis en kennis die anderen heeft geholpen.",
  "start.livewall.saved": "Recent vastgelegd",
  "start.livewall.helped": "Heeft geholpen",
  "start.livewall.helpedToday": "vandaag geholpen: {{n}}",
  "start.livewall.savedEmpty": "Nog niets vastgelegd — de eerste bijdrage verschijnt hier.",
  "start.livewall.helpedEmpty": "Nog geen „heeft geholpen”-terugkoppeling.",
  "start.livewall.validated": "Nieuw gevalideerd",
  "start.livewall.validatedEmpty": "Nog geen gevalideerde kennis.",
  "start.livewall.nameConsent":
    "Mijn naam hier bij mijn gevalideerde kennis tonen. Vrijwillig en altijd intrekbaar; zonder toestemming verschijnt geen naam.",
  "start.livewall.photoConsent":
    "Mijn foto hier bij mijn gevalideerde kennis tonen. Vrijwillig; „Foto verwijderen” wist hem direct.",
  "start.livewall.photoAdd": "Foto kiezen",
  "start.livewall.photoReplace": "Foto vervangen",
  "start.livewall.photoRevoke": "Foto verwijderen",
  "start.livewall.photoError":
    "De foto kon niet worden opgeslagen. Kies een PNG-, JPEG- of WebP-afbeelding.",
  "start.livewall.consentError":
    "De naamtoestemming is niet opgeslagen — de getoonde stand blijft gelden. Schakel opnieuw om.",
  "start.livewall.photoRevokeError":
    "De foto is niet verwijderd — hij blijft gedeeld. Trek de toestemming opnieuw in.",
  "start.livewall.photoAlt": "Foto van de auteur",
  "start.livewall.photoOwnAlt": "Mijn foto voor de wand",
  "start.livewall.beamerOpen": "Als beamerweergave openen",
  "start.livewall.beamerFullscreen": "Volledig scherm",
  "start.livewall.beamerLoading": "Laden …",
  "start.livewall.beamerError":
    "De wand is momenteel niet bereikbaar. Bij de volgende cyclus wordt het opnieuw geprobeerd.",
  "start.livewall.beamerStale":
    "Geen actuele verbinding — namen en foto's zijn verborgen tot de wand weer actueel is.",
  "con.kicker": "Conflictoverzicht",
  "con.title": "Conflicten oplossen — zonder kennis te verliezen",
  "con.intro":
    "Tegenstrijdigheden worden naast elkaar gezet en geclassificeerd. Alleen waarheidsconflicten activeren het menselijke escalatiepad.",
  "con.empty": "Geen openstaande conflicten.",
  "conflict.impact.title": "Openstaand conflict — bruikbaarheid beperkt",
  "conflict.impact.hint":
    "Bij deze kennis staat een conflict open. Het is niet automatisch onjuist, maar zou vóór onbeperkt gebruik moeten worden gecontroleerd.",
  "conflict.impact.truthTitle": "Openstaand waarheidsconflict — controleren vóór gebruik",
  "conflict.impact.truthHint":
    "Bij deze kennis staat een waarheidsconflict open. Tot de opheldering geldt het als te controleren, niet als onbeperkt geborgd.",
  "conflict.impact.badge": "Conflict open",
  "conflict.impact.cta": "Conflict bekijken",
  "kollision.detail.title": "Botsing bij dit object",
  "kollision.detail.dublette":
    "Dit object overlapt met bestaande kennis. Je kunt je bijdrage aanscherpen of afbakenen; of er wordt samengevoegd, beslist de controle.",
  "kollision.detail.konflikt":
    "Bij dit object staat een tegenspraak open. Je kunt je uitspraak preciezer maken en onderbouwen; de opheldering ligt bij de controle.",
  "kollision.detail.beides":
    "Dit object overlapt met bestaande kennis en er staat een tegenspraak open. Je kunt aanscherpen en onderbouwen; samenvoegen en ophelderen liggen bij de controle.",
  "kollision.detail.keine": "Geen openstaande botsing bij dit object.",
  "kollision.start.title": "Botsingen bij jouw objecten",
  "kollision.start.dublette": "{{n}} van jouw kennisobjecten: overlap met bestaande kennis.",
  "kollision.start.konflikt": "{{n}} van jouw kennisobjecten: openstaande tegenspraak.",
  "kollision.start.beides": "{{n}} van jouw kennisobjecten: overlap of openstaande tegenspraak.",
  "kollision.start.keine": "Geen openstaande botsing bij jouw kennisobjecten.",
  "kollision.lage.laedt": "Wordt gecontroleerd — de botsingscontrole laadt nog.",
  "kollision.lage.erstfehler": "Nu niet controleerbaar: de gegevens konden niet worden geladen.",
  "kollision.lage.auffrischungLaeuft":
    "Stand van de laatste keer — de gegevens worden nu ververst.",
  "kollision.lage.auffrischungGescheitert": "Stand van de laatste keer — het verversen is mislukt.",
  "kollision.lage.pausiert":
    "Stand van de laatste keer — zonder netwerkverbinding niet actueel controleerbaar.",
  "kollision.lage.pausiertOhneStand": "Zonder netwerkverbinding niet controleerbaar.",
  "kollision.wiederholen": "Opnieuw controleren",
  "kollision.wegKonflikte": "Conflicten bekijken",
  "kollision.wegDuplikate": "Duplicaten bekijken",
  "kollision.keineGegenseite": "Het andere object wordt hier niet genoemd.",
  // JOB 3068 / N5 — zie het Duitse blok: elke zin benoemt WAT er geteld wordt (items in de
  // bibliotheek waartegen dit item is gecontroleerd); de twee onbewezen gevallen noemen geen getal.
  "kollision.deckung.vollstaendig":
    "Gecontroleerd tegen {{geprueft}} van {{bestand}} items in de bibliotheek — de controleronde is als volledig aangetoond.",
  "kollision.deckung.unvollstaendig":
    "Gecontroleerd tegen {{geprueft}} van {{bestand}} items in de bibliotheek — de controleronde is niet als volledig aangetoond.",
  "kollision.deckung.unvollstaendigOhneZahlen":
    "De controleronde voor dit item is niet als volledig aangetoond; tegen hoeveel items in de bibliotheek het is gecontroleerd, is onbekend.",
  "kollision.deckung.ohneProtokoll":
    "Een controleronde heeft dit item bekeken; tegen hoeveel items in de bibliotheek het is gecontroleerd, is niet vastgelegd.",
  "kollision.deckung.keinLauf":
    "Voor dit item is geen controleronde vastgelegd; tegen hoeveel items in de bibliotheek het is gecontroleerd, is daarmee onbekend.",
  "con.type.truth": "Waarheid",
  "con.type.experience": "Ervaring",
  "con.type.context": "Context",
  "con.type.temporal": "Tijd",
  "con.type.role": "Rol",
  "con.status.offen": "Open",
  "con.status.eskaliert": "Geëscaleerd",
  "con.status.zweitmeinung": "Tweede mening",
  "con.status.geloest": "Opgelost",
  "con.escPath": "Escalatiepad",
  "con.escalate": "Escaleren",
  "con.resolve": "Oplossen",
  "con.origin.auto": "Automatisch herkend",
  "con.origin.manual": "Handmatig aangemaakt",
  "con.autoConfidence": "Zekerheid {{percent}} %",
  "con.autoConfidenceCaption": "AI-zekerheid van de herkenning — geen bewezen tegenstrijdigheid",
  "con.collision.at": "Botsing bij",
  "con.collision.verbatim": "letterlijk uit het bewijs",
  "con.collision.point": "Botsingspunt",
  "con.autoWhy": "Onderbouwing",
  "con.autoQuoteA": "Bewijs A",
  "con.autoQuoteB": "Bewijs B",
  "con.dismiss": "Vals alarm – geen tegenstrijdigheid",
  "con.side.left": "Links geldt",
  "con.side.right": "Rechts geldt",
  "con.side.both": "Beide gelden, afhankelijk van context",
  "con.side.none": "Geen tegenstrijdigheid",
  "con.prefill.side": "Doorslaggevend is: {{title}}.",
  "con.prefill.both": "Beide uitspraken gelden, afhankelijk van de context.",
  "con.resolveConfirm": "Beslissing opslaan",
  "con.decision": "Beslissing",
  "con.decisionPlaceholder": "Hoe wordt de tegenstrijdigheid opgelost? (onderbouwing/resultaat)",
  "con.versus": "vs",
  "con.conditions": "Voorwaarden",
  "con.measures": "Maatregelen",
  "con.sources": "Bronnen",
  "con.openKo": "Object openen",
  "con.compareOpen": "Beide naast elkaar zetten",
  "con.readonlyCompare": "Alleen-lezen vergelijking",
  "con.caseList": "Alle openstaande conflicten ({{count}})",
  "con.detectedOn": "Herkend op {{date}}",
  "con.evidenceSideLabel": "Bewijs van deze kant",
  "con.evidenceBalance.neither":
    "Geen van beide uitspraken is met een bron onderbouwd. Deze tegenstrijdigheid is daarom niet op de formulering te beslissen, alleen op bewijs — de volgende stap is voor ten minste één kant een bron toe te voegen.",
  "con.evidenceBalance.oneSided":
    "Slechts één van beide uitspraken is met een bron onderbouwd: “{{title}}”. Dat is een verschil in bewijslast, geen oordeel over welke uitspraak klopt — een onderbouwde uitspraak kan onjuist zijn. De volgende stap is de andere kant te onderbouwen of in te trekken.",
  "con.compareTitle": "Vergelijking",
  "con.koMissing": "Bijdrage is verwijderd.",
  "con.resolveEffect":
    "De beslissing wordt gedocumenteerd en geregistreerd. Vertrouwen/status van de objecten worden NIET automatisch gewijzigd (geen stil overschrijven).",
  "con.resolveRevalidate": "Betrokken objecten zo nodig handmatig hervalideren.",
  "con.secondOpinion": "Tweede mening",
  "con.secondOpinionAdd": "Tweede mening",
  "con.secondOpinionConfirm": "Tweede mening opslaan",
  "con.secondOpinionPlaceholder": "Inschatting van een tweede vakpersoon …",
  "con.nextLabel": "Volgende stap",
  "con.next.escalate": "Escaleren naar een mens (waarheidsconflict).",
  "con.next.secondOpinion": "Een tweede mening van een tweede vakpersoon inwinnen.",
  "con.next.resolve": "Beslissen en de oplossing documenteren.",
  "con.next.done": "Conflict is opgelost — geen openstaande actie.",
  "dup.kicker": "Duplicaten-Board",
  "dup.title": "Dubbelingen oplossen — één thema, één bron",
  "dup.intro":
    "Automatisch herkende overlappingen tussen bijdragen. Zeer hoge tekstdekking wordt ook zonder AI gevonden; de subtielere gevallen controleert het model. Jij beslist: als verwant noteren, gescheiden laten of als vals alarm sluiten. (Elk van deze beslissingen legt alleen haar reden vast; aan de twee bijdragen verandert ze niets.)",
  "dup.empty": "Geen openstaande overlappingen.",
  "dup.relation.identisch": "Identiek",
  "dup.relation.a_enthaelt_b": "A bevat B",
  "dup.relation.b_enthaelt_a": "B bevat A",
  "dup.relation.teilweise": "Gedeeltelijke overlap",
  "dup.relation.verwandt": "Verwant",
  "dup.status.offen": "Open",
  "dup.status.in_bearbeitung": "In behandeling",
  "dup.status.geschlossen": "Gesloten",
  "dup.method.model": "AI-controle",
  "dup.method.deterministic": "Tekstvergelijking",
  "dup.probable": "Vermoedelijk duplicaat",
  "dup.textIdentical": "Tekstgelijk duplicaat",
  "dup.overlap": "{{percent}} % tekstdekking",
  "dup.confidence": "Zekerheid {{percent}} %",
  // REVIEW26 (JOB 3469): het leidende percentage draagt nu de naam van wat het meet.
  "dup.lead.modelConfidence": "{{percent}} % AI-zekerheid",
  "dup.lead.textOverlap": "{{percent}} % tekstdekking",
  "dup.lead.sectionAverage": "{{percent}} % gemiddelde veldgelijkenis",
  "dup.leadCaptionModel": "AI-waarschijnlijkheid — geen bewezen duplicaat",
  "dup.leadCaptionText": "Woord-/tekstgelijkenis — geen bewezen duplicaat",
  "dup.why": "Onderbouwing",
  "dup.shared": "Gemeenschappelijke uitspraken",
  "dup.quoteA": "In A",
  "dup.quoteB": "In B",
  "dup.onlyA": "Alleen in A",
  "dup.onlyB": "Alleen in B",
  "dup.recommendation": "Aanbeveling",
  "dup.rec.zusammenfuehren": "Sterke overlap — koppelen of één versie bijhouden",
  "dup.rec.zusammenfuehren_pruefen": "Overlap controleren — koppelen of gescheiden laten",
  "dup.rec.getrennt_lassen": "Gescheiden laten",
  "dup.rec.verwandt_verlinken": "Als verwant koppelen",
  "dup.versus": "vs",
  "dup.openKo": "Object openen",
  "dup.compareReadonly": "Alleen-lezen vergelijking",
  "dup.compareOpen": "Beide naast elkaar zetten",
  "dup.compareTitle": "Vergelijking",
  "dup.koMissing": "Bijdrage is verwijderd.",
  "dup.closed": "Afgerond",
  "dup.setStatus": "Status instellen",
  "dup.closeReasonLabel": "Afsluitreden (verplicht)",
  "dup.closeNoteLabel": "Notitie (optioneel)",
  "dup.closeSubmit": "Afsluiten",
  "dup.reason.merged": "Samengevoegd",
  "dup.reason.kept_separate": "Bewust gescheiden gelaten",
  "dup.reason.linked_related": "Als verwant genoteerd",
  "dup.reason.dismissed": "Vals alarm — geen duplicaat",
  "dup.reason.participant_deleted": "Betrokken bijdrage verwijderd",
  "dup.reason.superseded": "Niet meer van toepassing geworden",
  "dup.action.dismiss": "Vals alarm – geen duplicaat",
  "dup.action.keepSeparate": "Gescheiden laten",
  "dup.action.linkRelated": "Als verwant koppelen",
  "dup.side.left": "Links behouden",
  "dup.side.right": "Rechts behouden",
  "dup.side.both": "Beide behouden, als verwant noteren",
  "dup.side.none": "Geen duplicaat",
  "dup.keepNote": "Gescheiden laten; doorslaggevend is: {{title}}.",
  // JOB 3671 — paginahulp van het duplicatenbord; de onderbouwing staat bij de DE-sleutels.
  "dup.seitenhilfe.flaeche.titel": "Duplicaten: wat dit scherm laat zien",
  "dup.seitenhilfe.flaeche.text":
    "Je ziet een paar bijna gelijke kennisobjecten naast elkaar; op smalle vensters staan de twee kaarten onder elkaar — dan bedoelt „Links behouden“ de bovenste kaart en „Rechts behouden“ de onderste. Geel gemarkeerd is het deel dat niet bij de gemeenschappelijke uitspraken hoort: het eigen deel als dat letterlijk in de tekst staat, anders de rest rond de gemeenschappelijke citaten; is geen van beide te vinden, dan blijft de tekst ongemarkeerd in plaats van geraden. De procentpil is gelijkenis of modelwaarschijnlijkheid en geen bewijs van een duplicaat. Getallen, gemeenschappelijke uitspraken, eigen delen, aanbeveling en status staan in de uitklapper „{{mehr}}“ bij elke kaart; hoe duplicaten überhaupt gevonden worden, legt het „?“ naast de kop uit. Zijn er meer paren, dan blader je met de pijlen in de kopregel.",
  "dup.seitenhilfe.entscheidung.titel": "Wat jouw beslissing doet — en wat als ze verkeerd was",
  "dup.seitenhilfe.entscheidung.text":
    "Alle vier knoppen doen hetzelfde ene: ze sluiten deze bevinding met de gekozen reden en leggen die vast met jouw naam en de tijd. Aan de twee kennisobjecten verandert geen van hen iets — er wordt niets samengevoegd, niets verwijderd, en ook „Beide behouden, als verwant noteren“ legt geen koppeling in de objecten aan, maar houdt die reden vast. Een gesloten bevinding kan hier niet opnieuw worden geopend: ze verdwijnt uit de lijst en uit het getal op het tabblad. Daarmee is niets verloren, want beide objecten staan onveranderd in „{{bibliothek}}“ — wie zich vergist heeft, wijzigt ze daar. Wil je nog niet beslissen, kies dan in het menu „···“ bij de kaart „Status instellen“ → „In behandeling“ zolang de bevinding nog open is; dat houdt ze open. Beslissen mag wie kennis mag controleren; met een zwakkere rol leidt de weg hierheen niet naar dit scherm, maar naar een melding welke rol ervoor nodig is.",
  "board.koRemoved": "Object verwijderd",
  "board.detailsShow": "Details bekijken",
  "con.leadKicker": "Tegenstrijdigheid",
  "dup.leadKicker": "Overlap",
  // D-BIB (nacht24 pakket 5): dynamische facetten + subgroepen + opgeslagen weergaven (lokaal).
  "lib.facet.category": "Afdeling/categorie",
  "lib.facet.language": "Taal",
  "lib.facet.status": "Status",
  "lib.facet.author": "Auteur",
  "lib.facet.age": "Leeftijd",
  "lib.facet.trust": "Vertrouwen",
  "lib.facet.maturity": "Rijpheid",
  "val.facet.pruefstand": "Toetsingsfase",
  "lib.facet.origin": "Herkomst",
  "lib.facet.type": "Kennissoort",
  "lib.facet.tag": "Trefwoord",
  "facet.active": "Actieve filters",
  "facet.reset": "Alles opnieuw instellen",
  "facet.remove": "{{label}} verwijderen",
  "facet.result": "Treffers: {{shown}} van {{total}}",
  "facet.filtered": "gefilterd",
  "facet.more": "+{{n}} meer",
  "facet.moreFilters": "Meer filters",
  "facet.noMatch": "geen treffers (tegenstrijdige opgeslagen weergave)",
  "lib.facet.lang.de": "Duits",
  "lib.facet.lang.en": "Engels",
  "lib.facet.lang.nl": "Nederlands",
  "lib.facet.lang.other": "zonder taalmarkering",
  "lib.facet.ageBucket.d30": "≤ 30 dagen",
  "lib.facet.ageBucket.d180": "≤ 180 dagen",
  "lib.facet.ageBucket.y1": "≤ 1 jaar",
  "lib.facet.ageBucket.older": "ouder dan 1 jaar",
  "lib.facet.ageBucket.unknown": "leeftijd onbekend",
  "lib.facet.trustBucket.t0": "Vertrouwen 0",
  "lib.facet.trustBucket.t1": "Vertrouwen 1–39",
  "lib.facet.trustBucket.t40": "Vertrouwen 40–69",
  "lib.facet.trustBucket.t70": "Vertrouwen 70+",
  "lib.facet.more": "+{{n}} meer",
  "lib.facet.none": "zonder waarde",
  // AUFTRAG-mega10 blok B: de chipmuur wordt een zoekmasker (rail, zoeken per dimensie,
  // opengaande limiet, plakkende teller, bereikfilter, filterblad).
  "facet.searchLabel": "Zoeken in {{label}}",
  "facet.searchPlaceholder": "{{label}} zoeken …",
  "facet.searchNoHit": "Geen waarde past bij „{{query}}”.",
  "facet.showAll": "Alle {{n}} tonen",
  "facet.showLess": "Minder tonen",
  "facet.restricted": "alleen waarden uit de gekozen categorie",
  "facet.showResults_one": "{{count}} treffer tonen",
  "facet.showResults_other": "{{count}} treffers tonen",
  "facet.countFiltered": "van {{total}} gefilterd",
  "facet.countAll": "volledige voorraad",
  "facet.openFilters": "Filters",
  "facet.closeFilters": "Filters sluiten",
  "facet.sheetTitle": "Filters",
  "facet.rangeLabel": "Periode",
  "facet.rangeFrom": "van",
  "facet.rangeTo": "tot",
  "facet.rangeFromPill": "vanaf {{date}}",
  "facet.rangeToPill": "tot {{date}}",
  "facet.rangeContradictory":
    "De begindatum ligt na de einddatum — deze combinatie levert niets op.",
  "lib.facet.confidentiality": "Vertrouwelijkheid",
  "lib.facet.showResults_one": "{{count}} bijdrage tonen",
  "lib.facet.showResults_other": "{{count}} bijdragen tonen",
  "lib.facet.rangeLabel": "Laatst gewijzigd",
  "lib.views.remember": "Deze zoekopdracht onthouden",
  // AUFTRAG-sortfilter · Punt 1: sortering van de resultatenlijst.
  "lib.sort.label": "Sorteren",
  "lib.sort.relevance": "Relevantie",
  "lib.sort.title": "Titel A→Z",
  "lib.sort.trust": "Vertrouwen (hoog→laag)",
  "lib.sort.recent": "Laatst gewijzigd (nieuw→oud)",
  "lib.groupBy.label": "Subgroepen",
  "lib.groupBy.none": "geen",
  "lib.views.label": "Weergaven",
  "lib.views.pick": "Opgeslagen weergave laden …",
  "lib.views.namePlaceholder": "Naam van de weergave",
  "lib.views.save": "Weergave opslaan",
  "lib.views.remove": "Weergave verwijderen",
  "lib.views.storageHint":
    "Weergaven blijven alleen in deze browser. {{ownership}} Ze worden niet op de server opgeslagen en niet overgedragen naar andere apparaten of browsers. Wie browsergegevens wist, wist ook de weergaven. Opgeslagen: {{dimensions}}. Niet opgeslagen: sortering en venstergrootte (“Meer laden”). De sortering blijft bij het laden ongewijzigd; de venstergrootte begint opnieuw.",
  "lib.views.ownershipSignedIn": "Ze horen bij je huidige aanmelding.",
  "lib.views.ownershipAnon":
    "Zonder aanmelding geldt de lijst voor iedereen die deze browser zonder aanmelding gebruikt.",
  "lib.views.dimension.q": "Zoekterm",
  "lib.views.dimension.facetSel": "Filterselectie",
  "lib.views.dimension.range": "Periode",
  "lib.views.dimension.groupBy": "Groepering",
  "lib.views.dimension.segment": "Segment",
  "lib.views.dimension.scope": "Bereik",
  "imp.select.deselectLang": "Alle {{lang}} deselecteren · {{n}}",
  // SCRUM-486 (nacht24 pakket 3): één rustige bevindingsweergave — wat, detectiepad (eerlijk),
  // beide kanten gelinkt, gegroepeerd per bijdrage.
  "finding.kind.konflikt": "Conflict",
  "finding.kind.duplikat": "Duplicaat",
  "finding.kind.ueberschneidung": "Overlap",
  "finding.way.ki": "met AI",
  "finding.way.deterministisch": "zonder AI (deterministisch)",
  "finding.way.manuell": "handmatig aangemaakt",
  "finding.versus": "vs",
  "finding.groupKicker": "Bijdrage",
  "finding.groupCount": "{{n}} bevinding(en)",
  // FUNKE (nacht24 pakket 6): impactlus — waardig, geen puntencircus.
  "funke.sourceAuthor": "uit de kennis van {{name}}",
  "funke.impact.title": "Mijn impact",
  "funke.impact.contributions": "Mijn bijdragen",
  "funke.impact.validated": "waarvan gevalideerd",
  "funke.impact.cited": "geciteerd in antwoorden",
  "funke.impact.helpful": "als nuttig gemarkeerd",
  "funke.impact.hint":
    "Eerlijke telling uit bestaand bewijs: „geciteerd” telt de leidende antwoordbron — niets wordt geschat of verzonnen.",
  "funke.gaps.title": "Open kennislacunes",
  "funke.gaps.count": "{{n}} open",
  "funke.gaps.answerCta": "In 2 minuten beantwoorden",
  "funke.gaps.more": "+{{n}} meer open lacunes — volledige lijst onder Risico & lacunes.",
  "funke.capital.title": "Kenniskapitaal",
  "funke.capital.secured": "vastgelegde kennisobjecten",
  "funke.capital.validated": "waarvan gevalideerd",
  "funke.capital.open": "waarvan open",
  "funke.capital.categories": "beantwoordbare themavelden",
  "funke.capital.authors": "actieve kennisdragers",
  "funke.capital.gaps": "open kennislacunes",
  "funke.capital.hint": "Alleen echte cijfers uit het bestand — geen schattingen.",
  "lib.export": "Export",
  "lib.format.json": "JSON",
  "lib.format.markdown": "Tekst (Markdown)",
  "lib.format.mediawiki": "MediaWiki",
  "lib.format.html": "HTML (Print/PDF)",
  "lib.format.paket": "Kennispakket (ZIP met versies en bijlagen)",
  // JOB 1119 (D-002) — zie de Duitse regel voor de bevinding en de gemeten zoekruimte.
  "lib.searchLabel": "Bibliotheek doorzoeken",
  "lib.ownScope.label": "Bereik",
  "lib.ownScope.meine": "Mijn verzameling",
  "lib.ownScope.alle": "Alle inhoud",
  "lib.segment.label": "Status",
  "lib.segment.alle": "Alle",
  "lib.menue.weitere": "Meer acties",
  "lib.menue.bereich": "Gebied",
  "lib.menue.filter": "Filter",
  "lib.menue.sichten": "Weergaven",
  "lib.menue.sichtSpeichern": "Weergave opslaan",
  "lib.liste.eintraege_one": "{{count}} item",
  "lib.liste.eintraege_other": "{{count}} items",
  "lib.liste.eintraegeUnbekannt": "–",
  "lib.liste.leer": "Nog geen items.",
  "lib.liste.leerSuche": "Niets gevonden.",
  "lib.liste.fehler": "De lijst kon niet worden geladen.",
  "lib.liste.erneut": "Opnieuw proberen",
  "lib.liste.erfassen": "Vastleggen",
  "lib.liste.offline": "Zonder verbinding kan er nu niet worden gezocht.",
  "lib.liste.offlineWeiter": "Zodra de verbinding er weer is, gaat het zoeken vanzelf verder.",
  // JOB 3335 · UX-21 — zie de Duitse regel.
  "lib.lesemodus.listeEinblenden": "Resultatenlijst tonen",
  "lib.lesemodus.listeAusblenden": "Resultatenlijst verbergen",
  "lib.lesen.mehr": "Meer",
  "lib.lesen.belegstelle.markiert": "Bewijspassage gemarkeerd.",
  "lib.lesen.belegstelle.nichtGefunden":
    "De geciteerde passage staat in deze versie niet letterlijk in de tekst.",
  "lib.lesen.belegstelle.andereFassung":
    "De passage hoort bij versie {{fassung}}; dit is versie {{aktuell}}. Er is niets gemarkeerd.",
  "lib.lesen.bilder_one": "{{count}} afbeelding",
  "lib.lesen.bilder_other": "{{count}} afbeeldingen",
  "lib.lesen.fehler": "Het item kon niet worden geladen.",
  // JOB 3108 · UX-03 — zie de Duitse regel voor de toelichting.
  "lib.lesen.sprung.quellen": "Bronnen en bewijs · {{count}}",
  "lib.lesen.sprung.quellenLeer": "Bronnen en bewijs · geen",
  "lib.lesen.sprung.anhaenge": "Bijlagen · {{count}}",
  "lib.lesen.sprung.anhaengeLeer": "Bijlagen · geen",
  // JOB 3474 · REVIEW26 — zie de Duitse regel voor de bevinding. Zelfde woord als de bestandsimport
  // (`capture.originalAttachFailed`: „Origineel bestand“).
  "lib.lesen.sprung.originaldatei": "Origineel bestand · {{name}}",
  "lib.lesen.sprung.originaldateien": "Originele bestanden · {{count}}",
  "lib.lesen.sprung.originaldateienNamen": "Originele bestanden · {{count}}: {{names}}",
  "lib.lesen.sprung.anhaengeLeerNebenDatei": "Overige bijlagen · geen",
  // JOB 4145 · WIKI-ORIENTIERUNG — zie de Duitse regel voor de toelichting.
  "lib.lesen.gliederung.titel": "Overzicht van het document",
  // AUFTRAG-BASIC-u2 — zie de Duitse regel voor de bevinding.
  "lib.allStatus": "Alle statussen",
  "lib.allTypes": "Alle kennissoorten",
  "lib.allCategories": "Alle categorieën",
  "lib.allTags": "Alle tags",
  "lib.revalidate": "Hervalidatie starten",
  "lib.ask": "Vragen",
  "lib.review": "Controleren",
  "lib.revalidateDone": "Hervalidatie gestart.",
  "lib.reimport": "Opnieuw importeren (JSON)",
  // AUFTRAG-BASIC-u2: de nulstand noemt de ZOEKRUIMTE — zie de Duitse regel.
  // JOB 1119 (D-002) — zie de Duitse regel.
  // AUFTRAG-mega59 BLOCK D — zie de Duitse regel voor de bevinding.
  "lib.matchIn": "Resultaat in",
  "lib.match.title": "Titel",
  // JOB 1119 (D-002) — zie de Duitse regel: hetzelfde woord als de facet ernaast.
  "lib.match.tag": "Trefwoord",
  "lib.match.category": "Categorie",
  "lib.match.type": "Kennissoort",
  "lib.match.text": "Tekst",
  "lib.match.caption": "Afbeeldingsbeschrijving",
  "lib.maturity.all": "Alle",
  "lib.originLabel": "Herkomst",
  "lib.demoFilter.all": "Alle herkomsten",
  "lib.demoFilter.demo": "Demovoorbeelden",
  "lib.demoFilter.nonDemo": "Eigen kennis",
  "lib.maturity.usable": "Bruikbaar",
  "lib.maturity.review": "In beoordeling",
  "lib.maturity.open": "Te controleren",
  "lib.resultCount": "Resultaten: {{n}}",
  "imp.explore.title": "Bron verkennen",
  "imp.explore.hint":
    "Bekijk eerst wat er in de bron zit — aantallen, auteurs, thema's en periode. Er wordt niets geïmporteerd.",
  "imp.explore.active": "actief",
  "imp.explore.soon": "binnenkort",
  "imp.explore.cta": "Verder: verkennen",
  "imp.explore.exploring": "Verkennen …",
  "imp.explore.pages": "Pagina's",
  "imp.explore.sources": "Bronnen",
  "imp.explore.period": "Periode",
  "imp.explore.authors": "Auteurs",
  "imp.explore.themes": "Thema's",
  "imp.explore.more": "+{{n}} meer",
  "imp.explore.withImages": "{{n}} pagina's bevatten afbeeldingen.",
  "imp.explore.noAuthor": "(zonder auteur)",
  "imp.explore.noTheme": "(zonder thema)",
  "imp.explore.empty": "In deze bron is niets gevonden.",
  "imp.explore.truncated": "Alleen de eerste {{n}} pagina's geteld — de bron is groter.",
  "imp.explore.abbruch.timeout":
    "Resultaat onvolledig: Confluence heeft niet op tijd geantwoord (time-out). {{n}} pagina's waren tot dan gelezen.",
  "imp.explore.abbruch.zu_gross":
    "Resultaat onvolledig: Een antwoord van Confluence was te groot en is verworpen. {{n}} pagina's waren tot dan gelezen.",
  "imp.explore.abbruch.zeitbudget":
    "Resultaat onvolledig: De leestijd voor de space was op. {{n}} pagina's waren tot dan gelezen.",
  "imp.explore.failedPages": "{{n}} pagina's konden niet worden gelezen.",
  "imp.explore.topOf": "top {{n}} van {{total}}",
  "imp.explore.derivedTag": "afgeleid",
  "imp.explore.derivedHint":
    "Thema deterministisch afgeleid uit de paginatitels — de bron heeft voor deze pagina's geen labels.",
  "imp.explore.spaces": "Ruimtes (spaces)",
  "imp.explore.alreadyImported": "Waarvan al geïmporteerd: {{n}}",
  "imp.explore.alreadyQueued": "Waarvan al in de wachtrij voor beoordeling: {{n}}",
  // AUFTRAG-ic7-import-vision: eerlijke bronnengalerij „waar de reis heen gaat".
  // AUFTRAG-mega67 BLOCK C+D — de toegangstoestand (zie het Duitse blok voor de onderbouwing).
  "imp.access.title": "Toegang",
  "imp.access.ready.title": "Ingeschakeld, toegangsgegevens aanwezig",
  "imp.access.ready.body":
    "De import is voor deze installatie ingeschakeld en alle benodigde toegangsgegevens staan op de server. Of ze ook geldig zijn, blijkt bij de eerste import — dat is van hieruit niet te controleren zonder Confluence aan te roepen.",
  "imp.access.noCredentials.title": "Ingeschakeld, maar zonder toegangsgegevens",
  "imp.access.noCredentials.body":
    "De import is ingeschakeld, maar er ontbreekt nog iets. Zolang dat zo is, kan er geen import starten.",
  "imp.access.disabled.title": "In deze installatie niet ingeschakeld",
  "imp.access.disabled.body":
    "De Confluence-import is hier niet ingeschakeld. Dat gebeurt op de server; vanuit de interface is het niet om te zetten.",
  "imp.access.blocker.missing": "Ten minste één van de benodigde gegevens ontbreekt.",
  "imp.access.blocker.insecureBaseUrl":
    "Alle gegevens staan er, maar het adres is geen https-adres. Toegangsgegevens worden alleen over versleutelde verbindingen verstuurd — daarom komt er geen toegang tot stand.",
  "imp.access.varsTitle": "Wat dit systeem nodig heeft",
  "imp.access.varPresent": "aanwezig",
  "imp.access.varMissing": "niet aanwezig",
  "imp.access.whereSet":
    "Deze waarden worden als omgevingsvariabelen op de server gezet — niet hier. Klarwerk laat alleen zien of ze er staan, nooit hun inhoud.",
  "imp.access.whoMay":
    "Dit kan worden gewijzigd door wie toegang heeft tot de server van deze installatie.",
  "imp.access.switchedOff.title": "Door de beheerder uitgeschakeld",
  "imp.access.switchedOff.body":
    "De Confluence-import is in deze installatie vrijgegeven, maar uitgeschakeld. Zolang dat zo is, weigert de server elke import. Met de knop hieronder schakel je hem in.",
  "imp.access.schalter.an": "Import inschakelen",
  "imp.access.schalter.aus": "Import uitschakelen",
  "imp.access.schalter.hinweis":
    "Werkt direct en zonder herstart. Toegangsgegevens worden hier niet ingevoerd.",
  "imp.access.schalter.nichtFreigegeben":
    "De import is in deze installatie niet vrijgegeven — de schakelaar werkt pas na vrijgave op de server.",
  "imp.access.schalter.fehler": "De schakelaar kon niet worden omgezet. Probeer het opnieuw.",
  "imp.access.lastConnectedUnknown": "Er is nog geen succesvol afgeronde import vastgelegd.",
  "imp.access.lastConnected":
    "Laatste succesvol afgeronde import: {{date}}. Of het nu werkt, zegt deze terugblik niet.",
  // JOB 4086 — SharePoint/OneDrive. Ook hier: vier eigen zinnen, geen getal en geen serverwoord.
  "imp.sharepoint.titel": "SharePoint / OneDrive",
  "imp.sharepoint.was":
    "Kies een bestand uit de gekoppelde bibliotheek. Klarwerk haalt het op en zet het hieronder in de controle — met de naam, het oorspronkelijke adres en de stand ervan.",
  "imp.sharepoint.ohneInhalt":
    "De inhoud van het bestand wordt daarbij niet gelezen. Overgenomen worden naam, adres en stand van de bron; wie de tekst nodig heeft, opent het bestand via het adres.",
  "imp.sharepoint.listeTitel": "Bestanden die je mag zien",
  "imp.sharepoint.neuLaden": "Lijst opnieuw laden",
  "imp.sharepoint.laedt": "De bestanden worden geladen …",
  "imp.sharepoint.nichtFrisch":
    "Deze lijst is de stand van zojuist — hij wordt op dit moment ververst.",
  "imp.sharepoint.leer": "In deze bibliotheek staat nu geen bestand dat je mag zien.",
  "imp.sharepoint.gedeckelt":
    "Er zijn meer bestanden dan hier staan — deze lijst is ingekort. Baken de bibliotheek af als het gezochte ontbreekt.",
  "imp.sharepoint.stand": "stand {{zeit}}",
  "imp.sharepoint.uebernehmen": "Gekozen bestanden importeren",
  "imp.sharepoint.uebernahmeLaeuft": "Wordt opgehaald …",
  "imp.sharepoint.ergebnisTitel": "Uit SharePoint opgehaald",
  "imp.sharepoint.quelleOeffnen": "Bron openen",
  "imp.sharepoint.schonVorgemerkt": "Stond in deze stand al in de controle: {{n}}.",
  "imp.sharepoint.verschwunden": "Niet meer aanwezig in SharePoint: {{n}}.",
  "imp.sharepoint.gescheitert": "Niet overgenomen: {{n}}.",
  "imp.sharepoint.nichtsNeu": "Uit deze selectie is niets nieuws overgenomen.",
  "imp.sharepoint.neuerStand":
    "Nieuwere versie van de bron: {{n}}. Het oudere item staat nog in de controle — neem het nieuwere aan.",
  // JOB 4232 — dezelfde tien zinnen, hetzelfde contract: geen getal, geen statuscode, geen servertaal.
  "imp.sharepoint.inhaltRegel":
    "Bij zuivere tekstbestanden (.txt) haalt Klarwerk de tekst mee op. Bij elk ander bestandstype worden alleen de naam, het adres en de stand overgenomen — heb je dan de tekst nodig, open het bestand dan via zijn adres. Wat voor welk bestand geldt, staat in de lijst.",
  // JOB 4232 R2 — dezelfde scheiding: aankondiging vóór de meting, toezegging pas erna.
  // JOB 4232 R3 — de reden waarom de knop dicht is. Geen dichte knop zonder zin.
  "imp.sharepoint.pruefungLaeuft":
    "De inhoud van de gekozen bestanden wordt nu gecontroleerd. Het overnemen wacht daarop — zo wordt niets overgenomen op een grondslag die nog niemand kent.",
  "imp.sharepoint.pruefungFehlt":
    "Voor ten minste één gekozen bestand is er geen controleresultaat. Zolang dat zo is, wordt er niets overgenomen. Laad de lijst opnieuw of kies een ander bestand.",
  "imp.sharepoint.vorschau.textdatei":
    "tekstbestand — inhoud wordt vóór het importeren gecontroleerd",
  "imp.sharepoint.vorschau.laeuft": "inhoud wordt gecontroleerd …",
  "imp.sharepoint.vorschau.unlesbar": "niet als tekst leesbaar",
  "imp.sharepoint.vorschau.text": "inhoud komt mee",
  "imp.sharepoint.vorschau.leer": "leeg",
  "imp.sharepoint.vorschau.nurMerkmale": "alleen kenmerken",
  "imp.sharepoint.vorschau.zuGross": "te groot voor de inhoud",
  "imp.sharepoint.uebernommen.text": "met inhoud",
  "imp.sharepoint.uebernommen.nurMerkmale": "alleen kenmerken, geen volledige tekst",
  "imp.sharepoint.nichtUebernommen.leer":
    "Dit bestand is leeg — er is niets over te nemen, dus is er niets aangemaakt.",
  "imp.sharepoint.nichtUebernommen.zuGross":
    "Dit bestand is te groot voor een kennisitem. Het is niet overgenomen; splits het op of open het via zijn adres.",
  "imp.sharepoint.nichtUebernommen.unlesbar":
    "De inhoud van dit bestand was niet als tekst te lezen. Het is niet overgenomen — een halve tekst zou erger zijn dan geen.",
  "imp.sharepoint.zugangErneut": "Toegang opnieuw opvragen",
  "imp.sharepoint.weiterInDerPruefung":
    "De bestanden staan nu verderop in de controle. Pas als een mens ze daar aanneemt, ontstaat er een kennisobject uit.",
  "imp.sharepoint.zugang.ready.titel": "Ingeschakeld, toegangsgegevens aanwezig",
  "imp.sharepoint.zugang.ready.text":
    "De SharePoint-import is voor deze installatie ingeschakeld en alle benodigde toegangsgegevens staan op de server. Of ze ook geldig zijn, blijkt bij de eerste ophaalpoging — dat valt van hieruit niet te controleren zonder SharePoint te bellen.",
  "imp.sharepoint.zugang.ohneDaten.titel": "Ingeschakeld, maar zonder toegangsgegevens",
  "imp.sharepoint.zugang.ohneDaten.text":
    "De SharePoint-import is ingeschakeld, maar er ontbreekt nog iets. Zolang dat zo is, kan er geen bestand worden opgehaald.",
  "imp.sharepoint.zugang.aus.titel": "In deze installatie niet ingeschakeld",
  "imp.sharepoint.zugang.aus.text":
    "De SharePoint-import is hier niet ingeschakeld. Hij wordt op de server vrijgegeven; vanuit de interface is hij niet om te zetten.",
  "imp.sharepoint.fehler.nichtEingerichtet":
    "De verbinding met SharePoint is in deze installatie niet ingericht. Wie toegang heeft tot de machine van deze installatie, kan hem daar vastleggen.",
  "imp.sharepoint.fehler.keineBerechtigung":
    "Het opgeslagen account mag dit bestand of deze bibliotheek niet lezen. Laat de rechten in SharePoint controleren of kies een ander bestand.",
  "imp.sharepoint.fehler.nichtVorhanden":
    "Dit bestand bestaat niet meer in SharePoint. Laad de lijst opnieuw en kies een bestand dat er nog is.",
  "imp.sharepoint.fehler.verbindungWeg":
    "De verbinding met SharePoint geldt niet meer — hij is verlopen of op dit moment niet bereikbaar. Probeer het later opnieuw; vernieuwen kan alleen wie toegang heeft tot de machine van deze installatie.",
  "imp.gallery.planned": "gepland",
  "imp.gallery.plannedGroup": "Gepland ({{count}})",
  "imp.gallery.systemsTitle": "Systemen",
  "imp.gallery.filesTitle": "Bestanden",
  "imp.gallery.hintSoon": "In ontwikkeling — deze bron komt binnenkort.",
  "imp.gallery.hintPlanned": "Gepland — komt later.",
  "imp.gallery.unconfigured": "niet geconfigureerd",
  "imp.gallery.hintUnconfigured":
    "Aanwezig, maar niet bruikbaar: er is geen dienst ingesteld voor transcriptie. Een beheerder kan die in het beheer inrichten.",
  "imp.gallery.elsewhere": "in Vastleggen",
  "imp.gallery.hintElsewhere":
    "Dit formaat wordt al ingelezen — niet op deze pagina, maar in Kennis vastleggen. Deze pagina zelf importeert alleen JSON.",
  "imp.gallery.src.confluence": "Confluence",
  "imp.gallery.src.jsonImport": "JSON-import",
  "imp.gallery.src.jira": "Jira",
  "imp.gallery.src.wordSource": "Word-documentbron (koppeling)",
  "imp.gallery.src.pdfSource": "PDF-documentbron (koppeling)",
  "imp.gallery.src.sharepoint": "SharePoint",
  "imp.gallery.src.teams": "MS Teams",
  "imp.gallery.src.gdrive": "Google Drive",
  "imp.gallery.src.dms": "DMS",
  "imp.gallery.src.plm": "PLM",
  "imp.gallery.src.servicenow": "ServiceNow",
  "imp.gallery.src.sap": "SAP",
  "imp.gallery.src.notion": "Notion",
  "imp.gallery.src.slack": "Slack",
  "imp.gallery.src.email": "E-mail",
  "imp.gallery.file.json": "JSON",
  "imp.gallery.file.docx": "Word-bestand (.docx)",
  "imp.gallery.file.pdf": "PDF-bestand (.pdf)",
  "imp.gallery.file.xlsx": "Excel (.xlsx)",
  "imp.gallery.file.pptx": "PowerPoint (.pptx)",
  "imp.gallery.file.csv": "Tekst/CSV",
  "imp.gallery.file.ocr": "OCR (scan/afbeelding)",
  "imp.gallery.file.avtranscript": "Audio-/videotranscript",
  "imp.select.title": "Selectie verfijnen",
  "imp.select.hint":
    "Klik thema's aan OF beschrijf in één zin wat er geïmporteerd moet worden — allebei samen kan ook. De voorbeeldweergave toont wat past — er wordt nog niets geïmporteerd.",
  "imp.select.promptPlaceholder": "bijv. „alles over onderhoud en foutcodes“",
  "imp.select.promptConfidentialLabel": "Bevat deze tekst vertrouwelijke informatie?",
  "imp.select.promptConfidentialYes": "Ja/onzeker",
  "imp.select.promptConfidentialNo": "Nee, onbezwaarlijk",
  "imp.select.limit": "Hoogstens",
  "imp.select.previewCta": "Verder: inperken",
  "imp.select.previewing": "Bezig …",
  "imp.select.matched": "{{matched}} van {{total}} treffers",
  "imp.select.limitedNote": "afgekapt op de limiet",
  "imp.select.critAll": "Geen verfijning — alles zou passen.",
  "imp.select.critThemes": "Thema's",
  "imp.select.critAuthors": "Auteurs",
  "imp.select.critKeywords": "Trefwoorden",
  "imp.select.critYears": "Jaren",
  "imp.select.critLimit": "Limiet",
  "imp.select.critSpaces": "Ruimtes",
  // JOB 3356 (IMPORT-FREITEXT-TITEL): Parität zum deutschen Wörterbuch (typeof de).
  "imp.select.critTitle": "Titel bevat",
  "imp.select.titleFallbackInterpreted":
    "Zo heeft de AI je zin gelezen (criteria hierboven) — geen van de geladen pagina's past daarbij.",
  "imp.select.titleFallbackFound_one": "1 pagina draagt „{{query}}“ in de titel.",
  "imp.select.titleFallbackFound_other": "{{count}} pagina's dragen „{{query}}“ in de titel.",
  "imp.select.titleFallbackStale": "Resultaat voor: „{{query}}“.",
  "imp.select.titleFallbackStalePending":
    "De nieuwe voorvertoning loopt nog — de cijfers hieronder komen uit de vorige run.",
  "imp.select.titleFallbackStaleError":
    "De nieuwe voorvertoning is mislukt — de cijfers hieronder komen uit de vorige run.",
  "imp.select.titleFallbackStaleChanged":
    "De zin in het veld is inmiddels een andere — de cijfers hieronder komen uit de vorige run.",
  "imp.select.titleFallbackNone":
    "Ook in de titel staat „{{query}}“ op geen van de geladen pagina's.",
  "imp.select.titleFallbackCta_one": "Deze 1 pagina tonen",
  "imp.select.titleFallbackCta_other": "Deze {{count}} pagina's tonen",
  "imp.select.yearFrom": "van (jaar)",
  "imp.select.yearTo": "tot (jaar)",
  "imp.select.alreadyImported": "{{n}} al geïmporteerd",
  "imp.select.alreadyQueued": "{{n}} al in de wachtrij voor beoordeling",
  "imp.select.selectedCount": "{{n}} geselecteerd",
  "imp.select.importedDeselected":
    "Al geïmporteerde pagina's zijn uitgevinkt; vink ze bewust weer aan indien nodig.",
  "imp.select.queuedDeselected":
    "Pagina's die al in de wachtrij voor beoordeling staan zijn uitgevinkt; vink ze bewust weer aan indien nodig.",
  // WP-SHIP9-S2 Paket 2 (D2–D7): bediening van de treffer­lijst.
  "imp.select.searchPlaceholder": "Zoek in treffers (titel, auteur) …",
  "imp.select.selectAll": "Alles selecteren",
  "imp.select.deselectAll": "Alles deselecteren",
  "imp.select.groupBy": "Groeperen:",
  "imp.select.groupNone": "geen",
  "imp.select.groupTheme": "op thema",
  "imp.select.groupLanguage": "op taal",
  "imp.select.groupFolder": "op map",
  "imp.select.noFolder": "Zonder broncontainer",
  "imp.select.folderFallbackNoPath":
    "Deze bron levert geen mapstructuur (geen bovenliggende keten) — de vorige weergave wordt getoond.",
  "imp.select.folderFallbackSingle":
    "De bronstructuur levert hier maar één enkele map op — de vorige weergave wordt getoond.",
  "imp.select.facet.folder": "Map",
  "imp.select.facet.status": "Status",
  "imp.select.facet.theme": "Thema",
  "imp.select.facet.author": "Auteur",
  "imp.select.facet.language": "Taal",
  "imp.select.facetCount_one": "{{count}} treffer tonen",
  "imp.select.facetCount_other": "{{count}} treffers tonen",
  "imp.select.rangeLabel": "Brondatum",
  "imp.select.bulkLabel": "Selectie",
  "imp.select.groupCount": "{{n}} treffers",
  "imp.select.langDe": "Duits",
  "imp.select.langEn": "Engels",
  "imp.select.langNl": "Nederlands",
  "imp.select.langOther": "Zonder taalkenmerk",
  "imp.select.noTheme": "Zonder thema",
  "imp.select.chipNew": "Nieuw",
  "imp.select.chipImported": "Al geïmporteerd",
  "imp.select.chipQueued": "Voorgemerkt",
  "imp.select.summary": "{{selected}} van {{total}} geselecteerd",
  "imp.select.emptyFiltered": "Geen treffer voor zoeken/filter — pas het zoeken of filter aan.",
  "imp.preview.imported": "al geïmporteerd",
  "imp.preview.queued": "al in de wachtrij voor beoordeling",
  "imp.groups.cta": "Verder: groeperen & overnemen",
  "imp.groups.needSelection": "Selecteer minstens één item in het voorbeeld om verder te gaan.",
  "imp.groups.grouping": "De bijdragen worden thematisch gegroepeerd …",
  "imp.groups.retry": "Opnieuw proberen",
  "imp.groups.willGroupWithoutAi":
    "Geen AI-model actief — er wordt zonder AI op thema gegroepeerd (deterministisch).",
  "imp.groups.noAi": "Zonder AI gegroepeerd",
  "imp.groups.noAiReason": "Zonder AI gegroepeerd — {{reason}}",
  "imp.groups.reason.confidential": "vertrouwelijke kandidaten — cloud-AI uitgesloten",
  // AUFTRAG-mega59 BLOCK F1/F2 — zie de Duitse regels voor de bevinding.
  "imp.groups.reason.noModel": "geen AI-model actief",
  "imp.groups.reason.timeout": "het AI-model heeft niet tijdig geantwoord",
  "imp.groups.reason.error": "het AI-model heeft een fout gemeld",
  "imp.groups.willGroupWithoutAiConfidential":
    "Deze stapel bevat vertrouwelijke of niet-vrijgegeven items — er wordt zonder cloud-AI op thema gegroepeerd (deterministisch).",
  "imp.groups.aiGrouped": "AI-gegroepeerd",
  "imp.groups.groupCount": "{{n}} bijdragen",
  "imp.groups.approve": "Vrijgeven",
  "imp.groups.exclude": "Uitsluiten",
  "imp.groups.selectedCount": "{{x}} van {{y}} geselecteerd",
  "imp.groups.catchall": "Overige bijdragen",
  "imp.groups.noTheme": "Zonder onderwerp",
  "imp.groups.hintImported": "al geïmporteerd",
  "imp.groups.hintQueued": "al in de wachtrij voor beoordeling",
  "imp.groups.hintStale": "ouder dan 1 jaar",
  "imp.groups.hintShort": "weinig inhoud",
  "imp.groups.applyCta": "Selectie overnemen ({{n}})",
  "imp.groups.applying": "Bezig met overnemen: {{x}} van {{y}} …",
  "imp.groups.bilanzTitle": "Resultaat van de overname",
  "imp.groups.bilanzImported": "{{n}} overgenomen",
  "imp.groups.bilanzSkipped": "{{n}} overgeslagen (al geïmporteerd)",
  "imp.groups.bilanzSkippedQueued": "{{n}} overgeslagen (al in de wachtrij voor beoordeling)",
  "imp.groups.bilanzExcluded": "{{n}} uitgesloten",
  "imp.groups.bilanzFailed": "{{n}} mislukt",
  "imp.groups.bilanzReview":
    "De overgenomen bijdragen staan nu in de importreview — daar beslist een mens over elke toevoeging aan de kennisbank.",
  "imp.groups.toReview": "Verder naar de importreview ({{n}} open)",
  "imp.groups.failNotFound": "niet meer in de huidige selectie",
  "imp.groups.bilanzQueued": "{{n}} al in de wachtrij (stond al in de review)",
  "imp.groups.bilanzNotAttempted": "{{n}} niet geprobeerd (run gestopt na een fout)",
  "imp.groups.retryRest": "Rest overnemen ({{n}})",
  "imp.groups.failHttp": "overdracht mislukt",
  "imp.groups.hintSourceNewer": "bron bijgewerkt sinds import",
  "imp.groups.bilanzUpdates": "waarvan actualiseringen: {{n}}",
  "imp.groups.expired":
    "De gegevensbasis van deze groepering is inmiddels verlopen — de overname is gestopt en de selectie teruggezet. Groepeer opnieuw.",
  "imp.groups.regroup": "Opnieuw groeperen",
  "imp.groups.refreshGrouping": "Groepering bijwerken",
  // JOB 3357: het kenmerk van deze overname plus de uitkomst uit het uitvoeringsdossier.
  "imp.groups.runHeading": "Uitvoering van deze overname",
  "imp.groups.runIdLabel": "Uitvoeringskenmerk",
  "imp.groups.runCall": "Aanroep {{n}}",
  "imp.groups.runIdNone": "Voor deze aanroep heeft de server geen uitvoering vastgelegd.",
  "imp.groups.runOutcomeLoading": "De uitkomst van deze uitvoering wordt geladen …",
  "imp.groups.runOutcomeUnavailable":
    "De uitkomst van deze uitvoering is nu niet op te vragen. Het kenmerk hierboven blijft geldig.",
  "imp.groups.runOutcomeStale": "Stand van de laatste geslaagde opvraging — niet de actuele.",
  "imp.groups.runOutcomeStaleFailed": "Het bijwerken is mislukt.",
  "imp.groups.runOutcomeStalePaused": "Zonder verbinding wacht het bijwerken.",
  "imp.groups.runOutcomeRefreshing": "Het bijwerken loopt op dit moment.",
  "imp.groups.runOutcomeOffline":
    "Geen verbinding — de uitkomst van deze uitvoering is nog niet gelezen. Het kenmerk hierboven blijft geldig.",
  // WP-COCKPIT-LINIE: begeleide vijf-stappen-balk + ingeklapte geschiedenis (eenvoudige taal).
  "imp.step.barLabel": "Import in vijf stappen",
  "imp.step.source": "Bron",
  "imp.step.sourceHint":
    "Kies waar de bijdragen vandaan moeten komen — vandaag: pagina's uit Confluence.",
  "imp.step.explore": "Verkennen",
  "imp.step.exploreHint": "Bekijk eerst wat er in de bron zit — er wordt nog niets overgenomen.",
  "imp.step.narrow": "Inperken",
  "imp.step.narrowHint":
    "Klik thema's aan of beschrijf in één zin wat je wilt overnemen — het voorbeeld toont wat past.",
  "imp.step.groups": "Groepen vrijgeven",
  "imp.step.groupsHint":
    "Geef hele groepen vrij of sluit ze uit — losse bijdragen kun je nog steeds aan- en afvinken.",
  "imp.step.apply": "Overnemen & balans",
  "imp.step.applyHint":
    "De vrijgegeven bijdragen worden ter controle overgenomen — de balans toont eerlijk wat er is gebeurd.",
  "imp.step.done": "klaar",
  "imp.explore.ctaAgain": "Opnieuw verkennen",
  "imp.select.previewAgain": "Voorbeeld verversen",
  "imp.history.title": "Review-geschiedenis: openstaande en overgenomen bijdragen",
  "imp.history.count": "{{open}} open · {{total}} totaal",
  "imp.history.hint":
    "Hier staat de geschiedenis van eerdere overnames — bijdragen in de wachtrij voor controle, geaccepteerde en afgewezen bijdragen. Voor de lopende import heb je dit gedeelte niet nodig.",
  // WP-UX-WOW-1 (Kopfs live-UX-bevindingen U1-U9): polijstwerk voor de eerste VIP2-indruk.
  "ask.koQuestion": "Wat geldt voor: {{title}}?",
  "ask.confidentialPrefillHint":
    "Vertrouwelijke inhoud — controleer de vraag voor het verzenden. Ze is alleen vooraf ingevuld, niet automatisch verzonden.",
  "ask.expect.neutral": "Voorbeeld proberen",
  "lib.confidenceNone": "Zekerheid nog niet beoordeeld",
  "lib.confidenceNoneHint":
    "De zekerheid zegt hoe draagkrachtig een inhoud is ingeschat (0 tot 100). 0 betekent: nog niet beoordeeld — niet dat de inhoud fout is.",
  "con.emptyWhat":
    "Een conflict ontstaat wanneer twee bijdragen elkaar inhoudelijk tegenspreken — bijvoorbeeld twee verschillende grenswaarden voor dezelfde installatie.",
  "con.emptyHow":
    "Klarwerk herkent zulke tegenstrijdigheden bij het controleren en vergelijken; een mens beslist hier vervolgens welke uitspraak geldt.",
  "con.emptyExamplesHint":
    "Om het uit te proberen is er het voorbeeldpakket „Tegenstrijdige uitspraken“ in het importgedeelte.",
  "con.emptyExamplesCta": "Voorbeeldpakketten openen",
  "role.gate.title": "Dit gedeelte hoort bij een andere rol",
  "role.gate.body":
    "Dit gedeelte vereist de rol {{owner}}. Jouw huidige rol is {{own}} — daarom is deze weg voor jou gesloten. Rollen worden door de beheerder toegewezen; er valt hier dus niets in te schakelen.",
  "stage2.gate.title": "Uitgebreide functies (fase 2)",
  "stage2.gate.body":
    "Deze module hoort bij de uitgebreide functies — intern „fase 2“ genoemd: extra modules naast de kernstroom. Die staan nu uit, daarom is dit gedeelte nog niet zichtbaar.",
  "stage2.gate.enable": "Fase 2 nu inschakelen",
  "stage2.gate.adminOnly": "Een admin kan fase 2 inschakelen via de schakelaar in de zijbalk.",
  "stage2.gate.back": "Terug naar start",
  "imp.cleanup.title": "Testgegevens opruimen",
  "imp.cleanup.desc":
    "Verwijdert alle items uit de importwachtrij en verplaatst alle uit Confluence of Jira geïmporteerde bijdragen naar de prullenbak. Zelf gemaakte bijdragen, gebruikers en instellingen blijven onaangeroerd.",
  "imp.cleanup.previewCta": "Voorbeeld laden",
  "imp.cleanup.previewLoading": "Omvang wordt bepaald …",
  "imp.cleanup.previewResult":
    "Dit zou {{n}} kandidaten en {{m}} geïmporteerde bijdragen verwijderen.",
  "imp.cleanup.confirmHint":
    "De kandidatenlijst wordt definitief geleegd; de geïmporteerde bijdragen gaan naar de prullenbak en kunnen daar worden hersteld.",
  "imp.cleanup.confirmCta": "Nu opruimen",
  "imp.cleanup.cancel": "Annuleren",
  "imp.cleanup.running": "Opruimen loopt …",
  "imp.cleanup.doneCandidates": "{{n}} kandidaten verwijderd",
  "imp.cleanup.doneKos": "{{n}} geïmporteerde bijdragen naar de prullenbak verplaatst",
  "imp.cleanup.doneSkipped": "{{n}} overgeslagen (fout bij het verplaatsen)",
  "imp.cleanup.drift":
    "De gegevens zijn sinds het voorbeeld gewijzigd — het voorbeeld is opnieuw geladen, controleer en bevestig opnieuw.",
  "imp.cleanup.auditFailed":
    "Let op: de afsluitende audit-logregel kon niet worden geschreven — het opruimen zelf is voltooid.",
  "imp.cleanup.newSince": "{{n}} nieuwe kandidaten sinds het voorbeeld — niet aangeraakt.",
  "imp.cleanup.claimedKos":
    "{{n}} bijdrage(n) in een lopende reviewactie — uitgesloten van het opruimen.",
  "imp.cleanup.auditPendingCandidates":
    "{{n}} kandidaat/kandidaten met een openstaand actiebewijs — uitgesloten van het opruimen totdat het bewijs is geschreven.",
  "exp.title": "Voorbeeldpakketten",
  "exp.hint":
    "Gecureerde kleine scenario's voor testers — elk pakket laadt afzonderlijk en maakt duidelijk gemarkeerde voorbeeldbijdragen aan. Het opruimen van de import verwijdert ze NIET; ze verdwijnen via het verwijderen van de demogegevens.",
  "exp.load": "Laden",
  "exp.loading": "Wordt geladen …",
  "exp.result": "{{created}} aangemaakt, {{skipped}} overgeslagen (al aanwezig)",
  "exp.pkg.konflikte.title": "Tegenstrijdige uitspraken",
  "exp.pkg.konflikte.desc":
    "Zes bijdragen in drie paren die elkaar tegenspreken — ideaal om conflictdetectie en validatie uit te proberen.",
  "exp.pkg.bilder.title": "Kennis met afbeeldingen",
  "exp.pkg.bilder.desc":
    "Drie bijdragen met afbeeldingen en beschrijvende bijschriften — ideaal voor de galerij en het zoeken in bijschriften.",
  "exp.pkg.qualitaet.title": "Gemengde kwaliteit",
  "exp.pkg.qualitaet.desc":
    "Vijf bijdragen van goed tot te kort tot verouderd — ideaal om review en kwaliteitsbeoordeling te oefenen.",
  "dpk.title": "Demopakketten",
  "dpk.hint":
    "Volledige demonstratiebestanden: lees eerst wat erin zit, laad daarna. Elk pakket kan afzonderlijk worden teruggezet en verwijderd — andere demogegevens en echte bijdragen blijven onaangeroerd. Het verwijderen van alle demogegevens neemt de pakketten nog steeds mee.",
  "dpk.fictional": "verzonnen demogegevens",
  "dpk.scope": "{{items}} objecten · {{areas}} · inhoud in {{language}}",
  "dpk.stateNone": "nog niet geladen",
  "dpk.stateLoaded": "{{loaded}} van {{items}} geladen",
  "dpk.stateEdited": "{{n}} daarvan bewerkt",
  "dpk.load": "Laden",
  "dpk.reset": "Terugzetten",
  "dpk.remove": "Pakket verwijderen",
  "dpk.removeConfirm": "Echt verwijderen",
  "dpk.cancel": "Annuleren",
  "dpk.busy": "Bezig …",
  "dpk.resultLoad": "{{created}} aangemaakt, {{skipped}} ongewijzigd (al aanwezig)",
  "dpk.resultReset":
    "{{updated}} bijgewerkt, {{skipped}} ongewijzigd, {{created}} nieuw aangemaakt",
  "dpk.resultRemove":
    "{{removed}} verwijderd · {{conflicts}} conflicten en {{duplicates}} doublures gesloten",
  "dpk.resultTrash": "{{n}} in de prullenbak — niet opnieuw aangemaakt",
  "dpk.resultFailures": "{{n}} niet uitgevoerd",
  "dpk.stale": "Stand van de laatste ophaalactie · vernieuwen mislukt",
  "dpk.stateDuplicates": "{{n}} overtollige kopieën",
  "dpk.resultDuplicates": "{{n}} overtollige kopieën verwijderd",
  "dpk.resetConfirm": "Echt terugzetten",
  "dpk.previewLoading": "Voorbeeld wordt opgehaald …",
  "dpk.previewError":
    "Voorbeeld niet beschikbaar — zolang het ontbreekt wordt er niets gewijzigd. Probeer opnieuw.",
  "dpk.previewNone": "Aan dit pakket is momenteel geen object toegewezen.",
  "dpk.previewCounts": "Toegewezen: {{list}}",
  "dpk.previewIds": "Kenmerken: {{ids}}",
  "dpk.artSeed": "basisbestand",
  "dpk.artUnregistered": "zonder registervermelding",
  "dpk.previewRestore": "wordt hersteld ({{n}}): {{ids}}",
  "dpk.previewRemove": "wordt verwijderd ({{n}}): {{ids}}",
  "dpk.previewMissing": "{{n}} ontbrekende basisbijdragen worden aangemaakt",
  "dpk.resultAssigned": "{{n}} toegewezen objecten verwijderd",
  "imp.preview.sourceNewer": "bron nieuwer dan import",
  "imp.select.empty": "Geen treffer voor deze verfijning.",
  "imp.select.aiUnavailable":
    "AI-selectie is momenteel niet beschikbaar — alleen je klikfilters gelden.",
  "imp.select.aiConfidential":
    "Cloud-AI uitgesloten vanwege vertrouwelijke inhoud — de vrije-tekstzin is niet geëvalueerd; alleen je klikfilters gelden.",
  "imp.uploadTitle": "JSON opnieuw importeren",
  "imp.uploadHint":
    "Kies een JSON-bestand — de items komen als bijdragen in de controlelijst (geen stille overname).",
  "imp.jsonOnlyReason":
    "Import accepteert momenteel alleen JSON. Office-bestanden (DOCX, PDF, PPTX) graag via „Kennis vastleggen → uit bestand“ — daar worden ze echt gelezen.",
  "imp.dropHint": "Sleep een JSON-bestand hierheen — of kies er hieronder een.",
  "imp.dropActive": "Laat het JSON-bestand hier los …",
  "imp.dropReject": "„{{name}}“ is geen JSON-bestand — import accepteert momenteel alleen JSON.",
  "imp.upload": "JSON-bestand kiezen",
  "imp.parsed": "{{n}} bijdragen ter controle in de wachtrij gezet.",
  "imp.parseError": "Ongeldig JSON-bestand.",
  "imp.json.syntax":
    "De JSON-syntaxis is ongeldig. Open het bestand in een editor, controleer haakjes, aanhalingstekens en komma’s en kies het gecorrigeerde bestand opnieuw.",
  "imp.json.notArray":
    "De JSON is geldig, maar geen lijst. Zet de items in een lijst met [ en ], ook bij één item; gebruik het sjabloon in het JSON-vak.",
  "imp.json.notObject":
    "Item {{n}} is geen object. Vervang het door een object met de verplichte velden zoals in het sjabloon in het JSON-vak en kies het bestand opnieuw.",
  "imp.json.fields":
    "Item {{n}}: {{fields}} ontbreken of zijn ongeldig. Open het bestand in een editor en vul deze velden aan of corrigeer ze als tekst; toegestane waarden voor type: {{types}}. Gebruik het sjabloon in het JSON-vak.",
  "imp.json.format":
    "Er wordt een JSON-lijst (array) met objecten verwacht. Verplichte velden per item, elk als tekst: {{fields}}.",
  "imp.json.types": "Toegestane waarden voor type: {{types}}.",
  "imp.json.example": "Minimaal sjabloon voor één item",
  "imp.json.exampleHint":
    "Selecteer en kopieer het sjabloon, vervang de voorbeeldteksten in een editor en sla het op als .json-bestand. Kies daarna het bestand hieronder.",
  "imp.json.exportPath":
    "Passend bestand uit de bibliotheek: Bibliotheek → „…“ (Meer acties) → Export → JSON",
  "imp.queueTitle": "Controlelijst van imports",
  "imp.queueEmpty": "Geen bijdragen te controleren.",
  // JOB 4293 (§ 9) — de toelichting staat in het Duitse blok.
  "imp.stand.auffrischungLaeuft":
    "Stand van de laatste keer — de controlelijst wordt ververst. „Aannemen“ is weer vrij zodra ze opnieuw is gelezen.",
  "imp.stand.auffrischungGescheitert":
    "Stand van de laatste keer — het verversen is mislukt. „Aannemen“ blijft geblokkeerd tot deze bijdrage opnieuw is gelezen.",
  "imp.stand.pausiert":
    "Stand van de laatste keer — zonder netwerkverbinding nu niet controleerbaar. „Aannemen“ blijft geblokkeerd tot deze bijdrage opnieuw is gelezen.",
  "imp.stand.pausiertOhneStand":
    "Zonder netwerkverbinding is de controlelijst niet op te halen — daarmee is niets gezegd over openstaande bijdragen.",
  "imp.stand.netzluecke":
    "Stand van vóór de netwerkonderbreking — sindsdien is er geen nieuw antwoord binnengekomen. „Aannemen“ blijft geblokkeerd tot deze bijdrage opnieuw is gelezen.",
  "ext.pipeline.title": "Importpijplijn & bevindingen",
  "ext.pipeline.upload": "Uploaden",
  "ext.pipeline.extract": "Extraheren",
  "ext.pipeline.structure": "Structureren",
  "ext.pipeline.review": "Controleren",
  "ext.pipeline.validate": "Valideren",
  "ext.pipeline.release": "Goedkeuren",
  "ext.pipeline.reuse": "Hergebruiken",
  "ext.queue.total": "Totaal: {{n}}",
  "ext.queue.open": "Open: {{n}}",
  "ext.queue.accepted": "Aangenomen: {{n}}",
  "ext.queue.rejected": "Afgewezen: {{n}}",
  "ext.queue.infoRequested": "Info opgevraagd: {{n}}",
  "ext.queue.duplicates": "Duplicaten: {{n}}",
  "ext.finding.duplicate": "Duplicaat",
  "ext.finding.missingInfo": "Gegevens ontbreken",
  "ext.finding.infoRequested": "Info opgevraagd",
  "ext.finding.acceptedKo": "KO aangemaakt",
  "ext.finding.inTrash": "ligt in de prullenbak, kenmerk {{id}}",
  "ext.finding.reusedKo": "bestaat al, kenmerk {{id}} hergebruikt",
  "ext.finding.rejected": "Afgewezen",
  "ext.validity.title": "Geldigheid & bescherming",
  "ext.validity.freshness": "Actualiteit",
  "ext.validity.outputEligible": "Geschiktheid voor output",
  "ext.validity.recommendation": "Aanbeveling",
  "ext.freshness.validiert": "gevalideerd",
  "ext.freshness.revalidierung-faellig": "hervalidatie nodig",
  "ext.freshness.offen": "open",
  "ext.freshness.konflikt": "conflict",
  "ext.freshness.unbekannt": "onbekend",
  "ext.protection.ip": "IP-gevoeligheid",
  "ext.protection.notRated": "niet beoordeeld",
  "ext.outputEligible.yes": "ja",
  "ext.outputEligible.no": "nee",
  "ext.recommendation.clarify-conflict": "Conflict oplossen",
  "ext.recommendation.start-revalidation": "Hervalidatie starten",
  "ext.recommendation.finish-validation": "Validatie afronden",
  "ext.recommendation.output-ready": "Bruikbaar voor output",
  "ext.recommendation.unknown": "onbekend",
  "imp.duplicate": "Duplicaat",
  // JOB 3288 · IMPORT-VOLLTEXT: volledige tekst en bron op de controlekaart, vóór „Aannemen".
  "imp.fullText.show": "Volledige geïmporteerde tekst tonen",
  "imp.fullText.hide": "Volledige tekst verbergen",
  "imp.fullText.label": "Volledige geïmporteerde inhoud",
  "imp.fullText.missing":
    "Voor deze bijdrage is geen volledige tekst overgedragen — hier staat alleen de kernuitspraak.",
  "imp.fullText.more": "Meer tonen",
  "imp.fullText.less": "Minder tonen",
  "imp.fullText.truncated": "Ingekort weergegeven — „Meer tonen” laat de hele tekst zien.",
  "imp.source.open": "Bron openen",
  "imp.source.newTab": "opent een nieuw tabblad",
  "imp.source.space": "Ruimte {{name}}",
  "imp.source.unlinkable":
    "Het opgeslagen bronadres is geen veilig webadres — het is daarom niet aanklikbaar.",
  "imp.source.none": "Voor deze bijdrage is geen bronadres opgeslagen.",
  "imp.note": "Notitie",
  "imp.accept": "Aannemen",
  "imp.reject": "Afwijzen",
  "imp.info": "Info opvragen",
  "imp.infoSend": "Verzenden",
  "imp.notePlaceholder": "Welke informatie ontbreekt?",
  "imp.reviewed": "Bijdrage bijgewerkt.",
  "imp.status.neu": "Voorgemerkt voor controle",
  "imp.status.in_bearbeitung": "In behandeling",
  "imp.status.angenommen": "Aangenomen",
  "imp.status.abgelehnt": "Afgewezen",
  "imp.status.info-angefragt": "Info opgevraagd",
  "imp.status.unknown": "Status onbekend",
  "risk.kicker": "Risico & hiaten",
  "risk.summary": "Cockpit-overzicht",
  "risk.kpiOpenGaps": "Open hiaten",
  "risk.kpiHigh": "Hoge prioriteit",
  "risk.kpiUnassigned": "Niet toegewezen",
  "risk.kpiAssigned": "Toegewezen",
  "risk.kpiOpenConflicts": "Open conflicten",
  "risk.kpiClosedGaps": "Gesloten hiaten",
  "risk.cockpit": "Risicocockpit per domein",
  "risk.cockpitEmpty": "Geen domeingegevens.",
  "risk.level.kritisch": "kritiek",
  "risk.level.mittel": "middel",
  "risk.level.gut": "stabiel",
  "risk.koCount": "Objecten",
  "risk.validated": "gevalideerd",
  "risk.openKo": "open",
  "risk.singleSource": "Enkele bron — klontrisico",
  "risk.singleSourceExplain":
    "Alle kennis van dit domein komt van één enkele persoon. Valt die weg (ziekte, opzegging, pensioen), dan is de kennis verdwenen — dat is het grootste kennisrisico. Tegenmaatregel: meer mensen betrekken, kennis dubbel laten controleren (valideren) en bronnen aanvullen.",
  "risk.bearer": "Gedragen door: {{names}}",
  "risk.viewObjects": "Objecten van dit domein bekijken",
  "risk.vsPlant.above": "Gevalideerd aandeel boven het fabrieksgemiddelde ({{avg}}%)",
  "risk.vsPlant.below": "Gevalideerd aandeel onder het fabrieksgemiddelde ({{avg}}%)",
  "risk.vsPlant.equal": "Gevalideerd aandeel gelijk aan het fabrieksgemiddelde ({{avg}}%)",
  "risk.staleByAssetChange_one": "{{count}} object na een installatiewijziging te controleren",
  "risk.staleByAssetChange_other": "{{count}} objecten na een installatiewijziging te controleren",
  "risk.horizon.title": "Mijn gebied · Kennis borgen vóór het pensioen",
  "risk.horizon.filterLabel": "Pensioenhorizon",
  "risk.horizon.filter": "komende {{months}} maanden",
  "risk.horizon.notCountable":
    "Wat iemand weet dat nog niet in het systeem staat, valt niet te tellen. Getoond wordt wat van de persoon afhangt — en wat vóór de termijn geborgd moet worden.",
  "risk.horizon.noAreas": "Er is nog geen gebied onderhouden.",
  "risk.horizon.noOwnArea":
    "Aan u is nog geen gebied toegewezen. De toewijzing wordt door de beheerder onderhouden.",
  "risk.horizon.busFactorOne": "Busfactor 1",
  "risk.horizon.criticality": "Kritikaliteit: {{level}}",
  "risk.horizon.level.niedrig": "laag",
  "risk.horizon.level.mittel": "middel",
  "risk.horizon.level.hoch": "hoog",
  "risk.horizon.noManager": "Nog geen verantwoordelijke persoon ingevoerd",
  "risk.horizon.manager": "Verantwoordelijk: {{name}}",
  "risk.horizon.noneInHorizon":
    "Volgens de onderhouden gegevens gaat niemand uit dit gebied in de komende {{months}} maanden met pensioen.",
  "risk.horizon.bearer":
    "{{name}} · pensioen in de komende {{months}} maanden · kennis borgen vóór {{due}}",
  "risk.horizon.todo.soleBearer":
    "Enige bron in dit gebied — valt die weg, dan gaat de kennis verloren.",
  "risk.horizon.todo.openKos_one": "{{count}} eigen object nog niet gevalideerd",
  "risk.horizon.todo.openKos_other": "{{count}} eigen objecten nog niet gevalideerd",
  "risk.horizon.todo.openGaps_one": "{{count}} open vraag toegewezen",
  "risk.horizon.todo.openGaps_other": "{{count}} open vragen toegewezen",
  "risk.horizon.todo.koCount_one": "{{count}} object in dit gebied vastgelegd",
  "risk.horizon.todo.koCount_other": "{{count}} objecten in dit gebied vastgelegd",
  "risk.pflege.title": "Gebiedsprofielen en pensioenhorizonten onderhouden",
  "risk.pflege.intro":
    "Per categorie: wie verantwoordelijk is voor het gebied en de inschatting van kritikaliteit, procesnabijheid, herhalingsfrequentie en schadepotentieel (leeg = geen invoergegevens). Per persoon: pensioen in de komende 24 of 36 maanden — alleen horizon en termijn worden opgeslagen.",
  "risk.pflege.manager": "Verantwoordelijk voor {{category}}",
  "risk.pflege.noManager": "Geen verantwoordelijke persoon",
  "risk.pflege.save": "Opslaan",
  "risk.pflege.error": "Opslaan is niet gelukt.",
  "risk.pflege.retirementTitle": "Pensioenhorizonten",
  "risk.pflege.retirement": "Pensioenhorizon van {{name}}",
  "risk.pflege.noRetirement": "Geen pensioen ingevoerd",
  "risk.pflege.retirementSaved": "Pensioenhorizon van {{name}} opgeslagen.",
  "risk.pflege.retirementNotRefreshed":
    "Opgeslagen. De weergave voor {{name}} is nog niet ververst — de keuze toont de opgeslagen waarde.",
  "risk.pflege.profileSaved": "Gebiedsprofiel „{{category}}” opgeslagen.",
  "risk.pflege.profileError":
    "Gebiedsprofiel „{{category}}” is niet opgeslagen. Je invoer blijft staan — „Opslaan” probeert het opnieuw.",
  "risk.pflege.retirementError":
    "Pensioenhorizon van {{name}} is niet opgeslagen. Je keuze blijft staan — „Opnieuw proberen” slaat die nog een keer op.",
  "risk.busLegendSingle": "rood = enkele bron (uitvalrisico)",
  "risk.busLegendOk": "groen = meerdere bronnen",
  "risk.help.summary":
    "Overzicht in cijfers: Open hiaten (vragen zonder geborgde kennis), Hoge prioriteit (dringend), Niet toegewezen/Toegewezen (of iemand het hiaat oppakt), Open conflicten (tegenstrijdige uitspraken) en Gesloten hiaten (al beantwoord). Rode cijfers geven aan waar actie nodig is.",
  "risk.help.cockpit":
    "Risico per domein (categorie): KRITIEK/MIDDEL/GOED vat samen hoe goed het domein is afgedekt. Objecten = hoeveel kennis; gevalideerd % = hoeveel daarvan gecontroleerd is; open = nog ongecontroleerd; Experts = hoeveel mensen het domein dragen. Eén expert + weinig gevalideerd = hoog risico.",
  "risk.help.busfactor":
    "Hoe sterk hangt een domein af van afzonderlijke personen? Een rode balk betekent: de kennis komt maar uit ÉÉN bron — valt die weg, dan is ze verloren. Groen = meerdere bronnen, dus robuuster. De balk toont daarnaast de hoeveelheid kennis van het domein.",
  "risk.help.gaps":
    "Open kennishiaten zijn gestelde vragen waarop (nog) geen geborgd antwoord bestaat. Prioriteer ze, wijs ze aan een persoon toe of leg zelf gecontroleerde ervaring erover vast. Schrijf om privacyredenen geen gevoelige details in de vraag.",
  "health.title": "Knowledge Health",
  "health.band.gut": "goed",
  "health.band.mittel": "middel",
  "health.band.kritisch": "kritiek",
  "health.explain.gut": "Hoge validatiegraad, weinig verouderde kennis en geringe klontrisico's.",
  "health.explain.mittel":
    "Solide basis, maar open hiaten/conflicten of hervalidatiebehoefte remmen af.",
  "health.explain.kritisch":
    "Lage validatie en/of veel verouderde kennis, open conflicten of single-source-risico's.",
  "health.factor.validatedRatio": "Validatiepercentage",
  "health.factor.staleRatio": "Hervalidatiebehoefte (stale)",
  "health.factor.singleSourceShare": "Single-source-aandeel",
  "health.factor.openGaps": "Open kennishiaten",
  "health.factor.openConflicts": "Open conflicten",
  "health.band.unproven": "indeling niet aangetoond",
  "health.unknown": "onbekend",
  "health.unknownExplain":
    "Voor deze waarde ontbreken op dit moment live-signalen (kennisobjecten, lacunes, conflicten, hervalidaties of busfactor zijn niet geladen of niet bereikbaar). Daarom staat hier geen getal — er wordt niets geschat.",
  "health.range.explain":
    "{{worst}} van 100 in het slechtste geval, {{best}} in het beste. Zolang niet is aangetoond dat er volledig naar conflicten is gezocht, geldt de slechtere waarde — daarom staat hier geen band.",
  "health.conflictUnproven.title":
    "De score rekent met de volledige conflictaftrek: {{worst}} in plaats van {{best}} van 100.",
  "health.conflictUnproven.detection-incomplete":
    "De conflict- en duplicaatdetectie is niet overal volledig gelopen. Het is daarom niet uitgesloten dat er meer conflicten zijn dan gevonden — en een aftrek van nul zou een aanname over iets onbekends zijn.",
  "health.conflictUnproven.detection-unknown":
    "Over het bereik van de conflict- en duplicaatdetectie is niets vastgesteld. Zolang volledige controle niet is aangetoond, zegt het aantal gevonden conflicten niets over de collectie.",
  "health.conflictUnproven.known":
    "Bekend zijn {{count}} open conflicten ({{penalty}} van maximaal {{max}} punten aftrek). Die aftrek staat vast; de rest tot het maximum is de onzekerheid.",
  "risk.busfactor": "Enkele-bron-risico (busfactor)",
  "risk.busEmpty": "Geen risicogegevens.",
  "risk.experts": "Experts",
  "risk.expertsCount_one": "{{count}} expert",
  "risk.expertsCount_other": "{{count}} experts",
  "expertise.title": "Wie erbij betrekken",
  "expertise.intro":
    "Deze mensen hebben al aan een onderwerp bijgedragen. Je kunt ze om een korte inschatting vragen — geen rangorde, alleen wie zou kunnen helpen.",
  "expertise.help":
    "Afgeleid uit bestaande kennisobjecten (wie aan een onderwerp heeft bijgedragen). Volgorde alfabetisch, zonder beoordeling — als hulp bij wie je zou kunnen aanspreken.",
  "expertise.invite": "Je hebt ervaring met {{topic}} — kun je dat kort inschatten?",
  "expertise.thanks": "Bedankt, dat helpt het team.",
  "risk.gaps": "Open kennishiaten",
  "risk.gapsEmpty": "Geen open hiaten.",
  "risk.gapStatus.offen": "open",
  "risk.gapStatus.geschlossen": "gesloten",
  "risk.priorityLabel": "Prioriteit",
  "risk.priority.hoch": "hoog",
  "risk.priority.mittel": "middel",
  "risk.priority.niedrig": "laag",
  "risk.close": "Sluiten",
  "risk.closeWithTitle": "Sluiten met het kennisobject dat dit hiaat beantwoordt",
  "risk.closeFailed": "Niet gesloten — het kennisobject ontbreekt of staat in de prullenbak.",
  "risk.gapToast.closed": "Lacune gesloten.",
  "risk.gapToast.assigned": "Lacune toegewezen.",
  "risk.gapToast.assignFailed": "Niet toegewezen — kies opnieuw.",
  "risk.gapToast.removed": "Lacune verwijderd.",
  "risk.gapToast.removeFailed": "Niet verwijderd — de lacune blijft bestaan. Probeer het opnieuw.",
  "risk.gapToast.prioritySaved": "Prioriteit opgeslagen.",
  "risk.gapToast.priorityFailed": "Prioriteit niet opgeslagen — kies opnieuw.",
  "risk.assign": "Expert …",
  "risk.delete": "Verwijderen",
  "risk.gapNextLabel": "Volgende stap",
  "risk.gapNext.prioritize": "Urgentie inschatten en indelen.",
  "risk.gapNext.assign": "Aan een vakpersoon toewijzen.",
  "risk.gapNext.capture": "Kennis vastleggen om het hiaat te dichten.",
  "risk.gapNext.done": "Gesloten — afgehandeld.",
  "risk.gapCapture": "Kennis vastleggen",
  "risk.gapRedacted": "Vertrouwelijk hiaat (vraag verborgen)",
  "lcy.kicker": "Levenscyclus",
  "lcy.banner":
    "„Klopt dit nog?“ — gekoppelde objecten na wijziging aan de installatie controleren.",
  "lcy.empty": "Niets voor hervalidatie.",
  "lcy.stillValid": "Nog geldig → nieuwe versie",
  "lcy.assetTitle": "Installatiewijziging melden",
  "lcy.assetToggle": "Installatie gewijzigd …",
  "lcy.assetHint":
    "Voer de referentie van de gewijzigde installatie/het proces in — gekoppelde kennisobjecten worden ter controle gemarkeerd.",
  "lcy.assetPlaceholder": "Installatie-/procesreferentie (bijv. Pers-P2)",
  "lcy.assetTrigger": "Hervalidatie starten",
  "lcy.assetMarked": "{{n}} object(en) voor „{{asset}}“ ter controle gemarkeerd.",
  "lcy.toast.revalidateFailed": "Niet bevestigd — het item blijft openstaan. Probeer het opnieuw.",
  "lcy.toast.stepDone": "Leerstap als afgerond opgeslagen.",
  "lcy.toast.stepFailed": "Leerstap niet opgeslagen — vink opnieuw aan.",
  "lcy.pendingTitle": "Voor hervalidatie",
  "lcy.revalAsset": "Installatieverwijzing",
  "lcy.revalNextLabel": "Volgende stap",
  "lcy.revalNext.review":
    "Controleer of het na de wijziging nog geldig is — bevestig het dan als gecontroleerd.",
  "lcy.revalNext.validate": "Object is niet goedgekeurd — eerst valideren.",
  "lcy.revalCta.review": "Naar controle",
  "lcy.revalCta.validate": "Naar validatie",
  "lcy.revalNext.openKo": "Object openen — details zijn momenteel niet beschikbaar.",
  "lcy.revalMissing": "Objectdetails niet in de geladen voorraad.",
  "lcy.revalSaved": "Hervalidatie vastgelegd.",
  "lcy.nextViewKo": "Object bekijken",
  "lcy.nextUse": "Kennis gebruiken (vragen)",
  "lcy.pathTitle": "Leertraject · {{role}}",
  "lcy.pathEmpty": "Voor jouw rol is nog geen leertraject vastgelegd.",
  "lcy.stepComplete": "Als afgehandeld markeren",
  "lcy.stepDone": "Afgehandeld",
  "ana.kicker": "Analytics & audit",
  "ana.exec.title": "Executive-blik",
  "ana.exec.validated": "Gevalideerde kennis",
  "ana.exec.validatedHint": "gecontroleerde, geborgde objecten",
  "ana.exec.openReviews": "Open beoordelingen",
  "ana.exec.openReviewsHint": "wachten op validatie",
  "ana.exec.busFactor": "Enkele-bron-risico",
  "ana.exec.busFactorHint": "categorieën met slechts één bron",
  "ana.exec.rescued": "Geredde hiaten",
  "ana.exec.rescuedHint": "gesloten kennishiaten",
  "ana.help.exec":
    "Vier kerngetallen uit live-gegevens: gevalideerde kennis, open beoordelingen, busfactor-risico en geredde hiaten. Een rustig overzicht voor beslissers — hoe hoger de validatiegraad en hoe lager het risico, des te gezonder de kennisbasis.",
  "ana.help.health":
    "De health-score (0–100) vat validatiegraad, actualiteit en bronbreedte samen. De band (bijv. goed of kritiek) toont de toestand in één oogopslag; daaronder zie je welke factoren de waarde verhogen of verlagen.",
  "ana.help.impact":
    "Impact toont wat het systeem echt oplevert: gevalideerde objecten totaal, gestelde vragen, zonder hiaat beantwoorde vragen en het daaruit berekende antwoordpercentage. Het weekverloop maakt zichtbaar of gevalideerde kennis groeit.",
  "ana.help.audit":
    "Het auditlog legt elke relevante actie vast — wie (actor), wat (actie) en waaraan (doel). Vermeldingen worden alleen toegevoegd en hash-geschakeld; een latere afwijking is rekenkundig aantoonbaar. Met de filters beperk je snel tot een persoon, een soort actie of een object.",
  "ana.total": "Totaal",
  "ana.categories": "Categorieën",
  "ana.byType": "Verdeling per kennissoort",
  "ana.audit": "Auditlog (hash-geschakeld)",
  "ana.auditEmpty": "Geen vermeldingen.",
  "ana.avgTrust": "Ø vertrouwen",
  "ana.validationRate": "Validatiepercentage",
  "ana.openTasks": "Open taken",
  "ana.doneTasks": "Afgehandeld",
  "ana.impact": "Impact",
  "ana.impactValidated": "Gevalideerd totaal",
  "ana.impactAsk": "Vragen totaal",
  "ana.impactAnswered": "Zonder hiaat beantwoord",
  "ana.impactRate": "Antwoordpercentage",
  "ana.weekly": "Gevalideerd per week",
  "ana.filterActor": "Actor",
  "ana.filterAction": "Actie",
  "ana.filterTarget": "Doel filteren …",
  "ana.filterAll": "alle",
  "ana.auditCount": "{{shown}} van {{total}}",
  "ana.auditNoMatch": "Geen resultaten voor dit filter.",
  "adm.kicker": "Gebruikersbeheer",
  "adm.empty": "Geen gebruikers.",
  "adm.approve": "Goedkeuren",
  "adm.remove": "Verwijderen",
  "adm.createTitle": "Gebruiker aanmaken",
  "adm.name": "Naam",
  "adm.email": "E-mail",
  "adm.password": "Wachtwoord",
  "adm.role": "Rol",
  "adm.create": "Aanmaken",
  "adm.created": "Gebruiker aangemaakt.",
  "adm.createInvalid": "Vul nog aan:",
  "adm.createHint": "Vereist: naam, geldig e-mailadres en wachtwoord (min. 8 tekens).",
  "adm.field.name": "Naam",
  "adm.field.email": "geldig e-mailadres",
  "adm.field.password": "Wachtwoord (min. 8 tekens)",
  "adm.reset": "Wachtwoord resetten",
  "adm.newPassword": "Nieuw wachtwoord",
  "adm.newPasswordRepeat": "Wachtwoord herhalen",
  "adm.passwordMismatch": "De wachtwoorden komen niet overeen.",
  "adm.resetConfirm": "Resetten",
  "adm.resetCancel": "Annuleren",
  "adm.resetDone": "Wachtwoord gereset; alle sessies beëindigd.",
  "adm.correct": "Accountgegevens corrigeren",
  "adm.correctSave": "Accountgegevens opslaan",
  "adm.correctDone": "Accountgegevens gecorrigeerd.",
  "adm.gastfrist.titel": "Toegang geldig tot",
  "adm.gastfrist.unbefristet": "Onbeperkt — deze toegang verloopt niet vanzelf.",
  "adm.gastfrist.gueltigBis": "Geldig tot {{datum}}.",
  "adm.gastfrist.abgelaufen": "Verlopen op {{datum}} — deze toegang geldt niet meer.",
  "adm.gastfrist.unlesbar":
    "De opgeslagen vervalwaarde is onleesbaar; ze beëindigt de toegang niet.",
  "adm.gastfrist.hinweis":
    "De beperking geldt naast de goedkeuring — aan beide voorwaarden moet zijn voldaan.",
  "adm.gastfrist.setzen": "Beperking instellen",
  "adm.gastfrist.verlaengern": "Beperking wijzigen of verlengen",
  "adm.gastfrist.beenden": "Beperking beëindigen",
  "adm.gastfrist.datum": "Toegang eindigt aan het eind van deze dag",
  "adm.gastfrist.speichern": "Beperking opslaan",
  "adm.gastfrist.abbrechen": "Annuleren",
  "adm.gastfrist.gespeichert": "Beperking opgeslagen.",
  "adm.gastfrist.beendet": "Beperking beëindigd; de toegang is weer onbeperkt.",
  "adm.gastfrist.datumFehlt": "Kies eerst een dag.",
  "adm.gastfrist.fehlerHilfe": "Er is niets gewijzigd. Kies een dag en sla opnieuw op.",
  "adm.gastfrist.fehlerOffen":
    "Of de beperking is opgeslagen, is niet bevestigd. De stand hierboven wordt opnieuw opgehaald — lees die voordat je nogmaals opslaat.",
  "adm.gastfrist.anlageHinweis":
    "Zonder dag ontstaat een toegang zonder einde. Met een dag ontstaat de toegang beperkt — of, als er iets misgaat, helemaal niet.",
  "adm.gastfrist.anlageFehlerHilfe":
    "Er is geen account aangemaakt. Corrigeer de gegevens en maak het opnieuw aan.",
  "adm.gastfrist.anlageFehlerOffen":
    "Of het account is aangemaakt, is niet bevestigd. Kijk in de accountlijst voordat je het opnieuw aanmaakt.",
  "adm.seedTitle": "Demogegevens laden",
  "adm.seedHint":
    "Laadt een kleine, echte demovoorraad (KO's, validatie, hiaat, conflict, duplicaat, bijlage) — ook naast bestaande gegevens. Je echte bestand blijft onaangeroerd en wordt nooit overschreven. Gericht te verwijderen via „Demogegevens verwijderen“. (Conflict-/duplicaatbevinding verschijnt met een actieve AI-reasoner.)",
  "adm.seedButton": "Demogegevens laden",
  "adm.seedDone": "Demogegevens geladen: {{kos}} kennisobjecten, {{users}} gebruikers.",
  "adm.seedSkipped": "Overgeslagen: instantie is niet leeg (voorraad aanwezig).",
  "empty.cta.capture": "Kennis vastleggen",
  "empty.cta.import": "Importeren",
  "empty.cta.admin": "Demogegevens (Admin)",
  "empty.cta.library": "Naar de bibliotheek",
  "empty.cta.validation": "Naar de validatie",
  "empty.cta.tasks": "Naar mijn taken",
  "empty.cta.wissensnetz": "Naar het kennisnetwerk",
  "empty.cta.ask": "Een vraag stellen",
  "story.rescue.title": "Klarwerk borgt ervaringskennis voordat ze verloren gaat.",
  "story.honest":
    "Niets wordt automatisch gevalideerd — kennis geldt pas na de controle in het team als geborgd.",
  "story.surface.start.lead":
    "Nog niets openstaand — geen doodlopende weg, maar het begin. Start de cyclus en leg ervaringskennis vast die anders na verloop van tijd verdwijnt.",
  "story.surface.tasks.lead":
    "Momenteel niets te doen. Zodra kennis gecontroleerd of bijgewerkt moet worden, komt het hier terecht — of je legt zelf de volgende bijdrage vast.",
  "story.surface.library.lead":
    "Nog geen kennis om op te zoeken. Leg de eerste bijdrage vast — na de controle is die hier met bronvermelding bruikbaar.",
  "story.surface.validation.lead":
    "Niets te controleren. Vastgelegde kennis verschijnt hier voor teamcontrole, voordat ze als geborgd geldt en gebruikt kan worden.",
  "story.surface.gaps.lead":
    "Een lacune ontstaat wanneer een vraag geen geborgd antwoord vindt. Er staat er nu geen open — wie vraagt, brengt nieuwe aan het licht; wie vastlegt, sluit ze.",
  "story.surface.lifecycle.lead":
    "Bijdragen worden hier opnieuw te controleren wanneer hun controletermijn afloopt of een gemelde installatiewijziging ze raakt. Er staat nu niets open — een installatiewijziging kan hieronder worden gemeld.",
  "story.surface.duplicates.lead":
    "Een overlapping ontstaat wanneer twee bijdragen hetzelfde zeggen. Er staat er nu geen open — nieuwe verschijnen hier zodra vastgelegde kennis wordt gecontroleerd.",
  "story.surface.audit.lead":
    "Nog geen vastgelegde acties. Het logboek houdt bij wie in de kenniscyclus vastlegt, controleert en wijzigt — het vult zich met de eerste vastgelegde of gecontroleerde bijdrage.",
  "story.surface.neighborhood.lead":
    "Deze bijdrage deelt nog geen betekenisvolle tag met een andere. Het kennisnetwerk toont welke thema's al verbonden zijn; nieuwe kennis met passende tags verbindt haar met buren.",
  "story.surface.risk.lead":
    "Nog geen risicogegevens — daarvoor is vastgelegde kennis per gebied nodig. Leg ervaringskennis vast of importeer die; daarna toont deze lijst waar die van één persoon afhangt.",
  "story.surface.objekt.lead":
    "Bij deze bijdrage staat hier nog niets. Aanvullingen zoals bronnen, bijlagen en opmerkingen maken haar betrouwbaarder — open haar om aan te vullen of vraag wat ontbreekt.",
  "story.surface.entwuerfe.lead":
    "Nog geen concepten. Een concept bewaart wat je vastlegt voordat het team het controleert — begin met een nieuwe bijdrage.",
  "story.surface.verwaltung.lead":
    "Hier is nog niets ingericht. Het beheer houdt Klarwerk actueel — items verschijnen zodra er iets wordt ingericht, geback-upt of verwijderd.",
  "story.surface.auswertung.lead":
    "Voor deze analyse is nog niets beschikbaar. Ze ontstaat uit gecontroleerde kennis — de volgende stap is bijdragen vastleggen en laten controleren.",
  "story.surface.import.lead":
    "Nog niets om over te nemen. Een import haalt bestaande kennis uit een bron in de cyclus — kies een bron of upload een bestand.",
  "story.surface.anleitung.lead":
    "Hier staat nog geen inhoud. Werkinstructies bundelen gecontroleerde kennis tot stappen — vul ze aan met bouwstenen uit de bibliotheek.",
  "story.surface.spaces.lead":
    "Deze ruimte is nog leeg. Ruimtes ordenen bijdragen naar verantwoordelijkheid — verplaats een bijdrage hierheen of leg een nieuwe vast.",
  "story.surface.ausgang.lead":
    "Er wacht niets op de uitgaande controle. Hier komt terecht wat Klarwerk naar buiten moet geven — zodra iemand een bijdrage ter vrijgave voorlegt.",
  "story.surface.wissensnetz.lead":
    "Nog geen verbindingen. Het kennisnetwerk toont hoe bijdragen via tags samenhangen — geef bij het vastleggen passende tags.",
  "story.surface.meldungen.lead":
    "Op dit moment niets te melden. Hier verschijnt wat je aandacht nodig heeft — conflicten, lacunes en geplande controles.",
  "story.surface.horizont.lead":
    "In de gekozen periode gaat niemand met unieke kennis met pensioen. Houd de pensioenhorizonten in het beheer actueel, zodat dit overzicht klopt.",
  "story.surface.lernpfad.lead":
    "Voor jouw rol is nog geen leerpad ingesteld. Het leidt door de belangrijkste gecontroleerde kennis — tot die tijd helpt de bibliotheek.",
  "story.surface.hilfe.lead":
    "Voor deze pagina is nog geen eigen paginahulp. De hulp legt Klarwerk stap voor stap uit — je bereikt haar via het hulphoofdstuk in het menu.",
  "story.surface.gliederung.lead":
    "Deze bijdrage heeft nog geen koppen. Koppen structureren kennis, zodat anderen die snel vinden — voeg ze toe in de editor.",
  "story.surface.conflicts.lead":
    "Conflicten lost het team op bij het controleren. Er staat er nu geen open — nieuwe verschijnen hier zodra twee bijdragen elkaar tegenspreken.",
  "adm.auditTitle": "Recente gebruikers-/auth-activiteiten (audit)",
  "adm.auditEmpty": "Geen gebruikers-auditvermeldingen.",
  "prof.kicker": "Account",
  "prof.language": "Taal",
  "prof.passwordTitle": "Wachtwoord wijzigen",
  "prof.oldPassword": "Huidig wachtwoord",
  "prof.newPassword": "Nieuw wachtwoord",
  "prof.passwordSubmit": "Wachtwoord wijzigen",
  "prof.passwordChanged":
    "Wachtwoord gewijzigd. Om veiligheidsredenen ben je overal afgemeld — meld je opnieuw aan.",
  "prof.correctTitle": "Accountgegevens corrigeren",
  "prof.correctPassword": "Huidig wachtwoord (alleen bij nieuw e-mailadres)",
  "prof.correctSubmit": "Accountgegevens opslaan",
  "prof.correctSaved": "Accountgegevens opgeslagen.",
  "prof.correctUnchanged": "Niets gewijzigd.",
  "prof.correctSso": "In plaats daarvan bevestigen met SSO",
  "prof.correctSaml": "In plaats daarvan bevestigen met SAML-bedrijfsaanmelding",
  "prof.correctSsoConfirmed": "Identiteit bevestigd via SSO — sla nu je accountgegevens op.",
  "prof.correctSsoKontoGewechselt":
    "Tijdens de SSO-bevestiging is een ander account aangemeld. Het concept van het vorige account is verworpen; hier staan de gegevens van het account dat nu is aangemeld.",
  "help.kicker": "Help",
  "help.open": "Help openen",
  "help.openCenter": "In het Help-Center openen",
  "help.search": "Help doorzoeken …",
  "help.intro":
    "Korte startgids voor de belangrijkste Klarwerk-processen. Zoek op trefwoord of spring direct naar het juiste onderdeel.",
  "help.noResults": "Geen help gevonden voor dit trefwoord.",
  "help.openRoute": "Onderdeel openen",
  "help.support.title": "Support voor deze installatie",
  "help.support.configured": "De beheerder van deze installatie heeft dit supportkanaal ingesteld:",
  "help.support.linkDefault": "Supportpagina openen",
  "help.support.mailDefault": "E-mail naar support sturen",
  "help.support.newTab": "nieuw tabblad",
  "help.support.notConfigured":
    "Voor deze installatie is nog geen supportkanaal ingesteld. Neem met vragen contact op met de beheerders van je omgeving.",
  "help.support.invalid":
    "Voor deze installatie is een supportkanaal ingevoerd, maar het is ongeldig en wordt daarom niet getoond. Laat het de beheerders van je omgeving weten.",
  "help.support.loadError":
    "Het supportkanaal kon nu niet worden geladen. De help op deze pagina werkt gewoon.",
  "help.support.loading": "Supportkanaal wordt geladen …",
  "klara.title": "Klara",
  "klara.subtitle": "Jouw hulp in KLARWERK",
  "klara.open": "Klara openen — hulp bij deze pagina",
  "klara.intro":
    "Ik leg je pagina's, velden en begrippen uit. Mijn antwoorden komen uit de help-bibliotheek — wat daar ontbreekt, verzin ik niet.",
  "klara.pageLabel": "Je bent hier",
  "klara.fieldLabel": "Actief element",
  "klara.fieldHint":
    "Klik in een veld of een onderdeel met ?-hulp — dan leg ik het hier automatisch uit.",
  "klara.aiSearch": "Zoeken met AI-ondersteuning",
  "klara.aiBusy": "De AI leest de passende help-vermeldingen …",
  "klara.aiAnswerTitle": "AI-antwoord uit de help",
  "klara.aiDisclaimer": "AI-gegenereerd — niet voor 100 % gecontroleerd",
  "klara.helpAnswerTitle": "Antwoord uit de help",
  "klara.ohneModell": "Regelgebaseerd, zonder AI-model",
  "klara.aiGoto": "Naar onderdeel: {{target}}",
  "klara.aiSources": "Grondslag",
  "klara.aiEmpty":
    "De AI heeft in de passende help-vermeldingen geen zeker antwoord gevonden — een eerlijk help-hiaat. Formuleer de vraag anders of kijk op de helppagina.",
  "klara.speak": "Voorlezen",
  "klara.speakStop": "Voorlezen stoppen",
  "klara.inspect": "Element uitleggen",
  "klara.inspectHint":
    "Aanwijsmodus actief: klik op een willekeurig element (knop, kengetal, kop) — de actie wordt daarbij NIET uitgevoerd. Esc sluit de modus af.",
  "klara.inspectFor": "Uitleg over: {{label}}",
  "klara.selectionExplain": "Selectie uitleggen",
  "klara.selectionEmpty":
    "Selecteer eerst een begrip op de pagina — dan zoek ik de passende uitleg.",
  "klara.searchPlaceholder": "Help doorzoeken … bijv. validatie, busfactor, concept",
  "klara.resultsFor": "Resultaten voor: {{q}}",
  "klara.noResults":
    "Daarover heb ik nog geen vermelding — een eerlijk help-hiaat. De bibliotheek groeit volop; op de helppagina vind je de begeleide startpunten.",
  "klara.moreHelp": "Naar de helppagina",
  "klara.page.start":
    "Jouw overzicht: wat er net is geborgd, wat er vandaag heeft geholpen en wat er op je wacht. Van hieruit spring je direct naar elk onderdeel.",
  "klara.page.tasks":
    "Open taken: openstaande beoordelingen, hiaten en vervaldata — met een directe sprong naar het bijbehorende werk.",
  "klara.page.capture":
    "Hier borg je ervaringskennis: vertellen, dicteren, in een interview of uit een bestand. De AI structureert alleen — jij controleert en dient in.",
  "klara.page.ask":
    "Stel een vraag. Het antwoord is brongebonden en laat zien waarop het steunt en in welke staat die bronnen zijn — is er geen basis, dan ontstaat een eerlijk kennishiaat.",
  "klara.page.library":
    "Alle kennisobjecten met status, vertrouwen en filters. Vanaf hier ga je naar elk detail.",
  "klara.page.external":
    "Externe kennis (bijv. webbronnen) — altijd niveau 2: nooit peer-gevalideerd en duidelijk gescheiden van de gecontroleerde voorraad.",
  "klara.page.validation":
    "Het beoordelingsbord: je beoordeelt ingediende kennis. Pas met genoeg groene goedkeuringen (en zonder rode) geldt een object als gevalideerd.",
  "klara.page.conflicts":
    "Tegenstrijdigheden tussen kennisobjecten: bekijken, een tweede mening halen, oplossen — zodat de bibliotheek eenduidig blijft.",
  "klara.page.duplicates":
    "Mogelijke dubbelingen: controleren en samenvoegen, zodat kennis niet versplintert.",
  "klara.page.risk":
    "Waar is kennis dun of hangt die aan één persoon? Openstaande hiaten, busfactor en domeinrisico — met links naar de betrokken objecten.",
  "klara.page.lifecycle":
    "Kennis veroudert: hier zie je verlopen hervalidaties en leerpaden, zodat gecontroleerde kennis gecontroleerd blijft.",
  "klara.page.analytics":
    "Kengetallen uit echte data plus het hash-geschakelde auditlog — wie heeft wat wanneer gedaan.",
  "klara.page.admin":
    "Accounts, KI-toewijzing, data en beveiliging op één plek. Alleen zichtbaar voor admins.",
  "klara.page.help":
    "Begeleide instappunten, thema's en zoeken. Ik ben de snelle weg — voor de diepte loont deze pagina zich.",
  "klara.page.profile": "Jouw account: naam, taal, afmelden.",
  "klara.page.koDetail":
    "De detailpagina van een kennisobject: inhoud, versies, bronnen, bijlagen, beoordelingshistorie en acties afhankelijk van je rol.",
  // JOB 1151 (KA3) — zie de Duitse regel voor de bevinding en het dubbele woordenboekpatroon.
  "klara.offer.label": "Klara's suggesties",
  "klara.offer.lead": "Hierover is al iets:",
  "klara.offer.open": "Bekijken",
  // JOB 1153 (KA6 fase 1) — zie het Duitse blok voor de onderbouwing en het dubbele
  // woordenboekpatroon.
  "klara.write.title": "Schrijven op verzoek",
  "klara.write.hint":
    "Klara maakt een voorstel. Het komt in het antwoordveld hierboven en gaat pas op jouw klik het document in.",
  "klara.write.create": "Opstellen",
  "klara.write.complete": "Aanvullen",
  "klara.write.rephrase": "Herformuleren",
  "klara.write.busy": "Klara stelt een voorstel op ...",
  "klara.write.ready":
    "Het voorstel staat in het antwoordveld — er is niets in het document geschreven.",
  "klara.write.empty":
    "Selecteer eerst tekst in het document of typ hierboven waar het over moet gaan.",
  "klara.write.noBasis":
    "Geen voorstel: hiervoor is geen betrouwbare basis. Er wordt niets verzonnen.",
  "klara.write.insertCta": "Voorstel in Word invoegen",
  "klara.write.insertOk": "Voorstel ingevoegd — met herkomstregel.",
  "klara.write.provenance":
    "AI-geformuleerd — geen geciteerde KLARWERK-kennis. Controleer dit vakinhoudelijk vóór gebruik.",
  "klara.write.blockedNotMigrated":
    "Formuleren staat hier uit: de externe weg is nog niet vrijgegeven. Dat is een bedrijfsbeslissing — daar kun jij niets aan veranderen.",
  "klara.write.blockedConsentMissing":
    "Formuleren is geblokkeerd omdat jouw toestemming voor de externe weg ontbreekt. Je kunt die hierboven in het toestemmingsvak geven.",
  "klara.write.blockedOther":
    "Formuleren is voor deze sessie geblokkeerd. De server noemt als reden: {{grund}}",
  "klara.write.blockedUnknown":
    "Of er geformuleerd mag worden is nog niet bekend — de sessiestand wordt opgehaald. Tot dan wordt er geen verzoek aangeboden.",
  "shelp.adm.seedTitle":
    "Hier laad je kant-en-klare voorbeelddata waarmee je KLARWERK gevaarloos kunt uitproberen. Dat kan alleen zolang de instantie nog leeg is — zo vermengen echte data en voorbeelden zich nooit. Alle voorbeelddata is als zodanig gemarkeerd en laat zich later met één klik spoorloos verwijderen.",
  "shelp.adm.createTitle":
    "In dit gedeelte maak je een nieuw gebruikersaccount aan en geef je het een rol. Kijkers lezen, experts leggen kennis vast, controllers controleren die, en admins beheren alles. De rol bepaalt dus welke knoppen de persoon later ziet. Elke accountwijziging wordt in het auditprotocol vastgelegd.",
  "shelp.adm.auditTitle":
    "Dit protocol toont de laatste aanmeldingen en gebruikersacties. Elke regel is via een hash aan de vorige gekoppeld: wordt er achteraf iets gewijzigd of verwijderd, dan klopt de hash niet meer. Met de controleknop kun je de keten op elk moment laten narekenen; het resultaat vertelt je eerlijk of er een afwijking is gevonden — en zo ja, bij welke vermelding.",
  "shelp.ana.byType":
    "De balken tonen hoe jullie kennis over de vijf kennissoorten verdeeld is — van onderbuikgevoel via beproefde werkwijzen tot negatieve kennis, oftewel de kennis over wat je niet mag doen. Ontbreekt een soort bijna helemaal, dan is dat een signaal: daar wordt tot nu toe weinig vastgelegd. Gebruik het beeld om gericht door te vragen, niet om personen te beoordelen.",
  "shelp.ana.weekly":
    "Dit overzicht telt hoeveel kennisobjecten in elke week de beoordeling hebben doorstaan. Het toont het tempo waarin geborgde kennis ontstaat — niet hoe ijverig afzonderlijke personen waren. Wordt de curve vlak, dan blijven meestal beoordelingen liggen; een blik in het beoordelingsgedeelte laat dan zien waar het hapert.",
  "shelp.ask.steps":
    "Hier staan de kennisobjecten die voor jouw vraag uit de voorraad zijn geraadpleegd — met een fragment uit de vindplaats. Het is GEEN afleiding: KLARWERK legt niet vast welke zin van het antwoord uit welke bron komt. De lijst zegt waarop is gezocht; nagaan doe je door de genoemde bron te openen.",
  "shelp.ask.sources":
    "Elk antwoord in KLARWERK steunt uitsluitend op jullie eigen kennisobjecten — en precies die staan hier. De eerstgenoemde hebben het antwoord gedragen; de overige zijn geraadpleegd maar niet gebruikt. Tik op een bron om het volledige object met bewijs en beoordelingsstatus te openen. Staat hier niets, dan is er over jouw vraag geen passende kennis, en KLARWERK zegt dat eerlijk in plaats van iets te verzinnen.",
  "shelp.capture.resumeTitle":
    "Hier liggen je opgeslagen concepten — alles wat je begonnen bent, maar nog niet ingediend hebt. Niets daarvan is verloren, en niets daarvan zien de beoordelaars zolang je het niet indient. Tik op een concept om verder te werken, of verwerp het als het niet meer nodig is.",
  "shelp.ext.title":
    "Hier kun je gericht naar externe bronnen zoeken en ze aan je kennis koppelen, bijvoorbeeld een vakartikel. Belangrijk: externe bronnen zijn aanvullend materiaal van niveau twee — ze gelden als ongecontroleerd en vervangen nooit de beoordeling door je collega's. Of deze zoekfunctie beschikbaar is, bepaalt het beheer via een eigen goedkeuringsniveau.",
  "shelp.extpage.resultsTitle":
    "Deze lijst toont de treffers van de externe zoekopdracht. Alles hier komt van buitenaf en is ongecontroleerd — daarom wordt het duidelijk als extern gemarkeerd en nooit automatisch overgenomen. Je beslist zelf of je een treffer als bron van niveau twee koppelt. Geborgde kennis ontstaat daaruit pas wanneer mensen het controleren.",
  "shelp.ko.statement":
    "Dit is de kern van het kennisobject: één enkele, heldere uitspraak over wat geldt. Al het andere op deze pagina — voorwaarden, maatregelen, bewijs — hangt aan die zin. Lees de uitspraak eerst en controleer daarna daaronder wanneer die geldt en waarop die zich baseert.",
  "shelp.ko.conditions":
    "Voorwaarden vertellen je wanneer de uitspraak geldt — en daarmee ook wanneer niet. Een voorbeeld: een regel voor het winterbedrijf helpt je in de zomer niets. Controleer voor het toepassen altijd of jouw situatie bij de genoemde voorwaarden past.",
  "shelp.ko.measures":
    "Maatregelen beschrijven wat er concreet te doen valt wanneer de uitspraak van toepassing is — stap voor stap. Ze zijn bewust kort gehouden zodat ze in de praktijk toepasbaar blijven. Mis je een stap of is iets onduidelijk, laat dan een opmerking achter; zo wordt de kennis mettertijd beter.",
  "shelp.ko.provenance":
    "Hier staat waar deze kennis vandaan komt: wie die heeft vastgelegd, wanneer die is ontstaan en of die ooit is overgedragen. Herkomst is in KLARWERK geen bijzaak — een navolgbare herkomst is een deel van het vertrouwen. Bij vragen weet je hier bij wie je terechtkunt.",
  "shelp.ko.lineageTitle":
    "Dit gedeelte toont de verwantschap van deze kennis: waaruit die is voortgekomen en met welke andere objecten die samenhangt. Zo herken je of het deel is van een groter thema. Gebruik de koppelingen om je verder te hangelen in plaats van geïsoleerde losse stukken te lezen.",
  "shelp.nb.title":
    "Het kennisnetwerk toont de buurt van het artikel dat je leest: in het midden het artikel, eromheen wat er via gedeelde tags bij hoort — en bij elke verbinding staat waarom. Eén klik op een buur maakt die het nieuwe midden; „Artikel openen” brengt je ernaartoe. Tags die bijna elk artikel draagt, tellen niet als verwantschap — dat staat er dan eerlijk bij.",
  "shelp.ko.history":
    "Elke inhoudelijke wijziging maakt een nieuwe versie aan, en hier zie je het verloop: wie wanneer wat heeft gewijzigd en met welke notitie. Oudere versies blijven bewaard, niets wordt stilletjes overschreven. Zo kun je nagaan hoe de kennis zich heeft ontwikkeld.",
  "shelp.ko.evidenceTitle":
    "Bewijs zijn de onderbouwingen achter de uitspraak: gekoppelde bronnen, documenten en bewijsstukken, telkens toegewezen aan de versie waarbij ze horen. Hoe beter de bewijslast, hoe steviger de kennis — vertrouwen ontstaat in KLARWERK uit onderbouwing, niet uit beweringen. Een object zonder bewijs is niet automatisch fout, maar verdient wel een kritischer blik.",
  "shelp.ko.snapshotsTitle":
    "Een momentopname is de volledige, bevroren versie van een eerdere stand. Hier kun je nalezen hoe het object er op een bepaald moment precies uitzag. De momentopnames zijn er alleen om te lezen — niemand kan ze wijzigen, en juist dat maakt ze als bewijs waardevol.",
  "shelp.ko.comments":
    "Hier wisselen collega's van gedachten over dit object: vragen, aanvullingen, bezwaren. Een opmerking wijzigt de kennis zelf niet — het is een gesprek in de marge dat vaak tot een betere volgende versie leidt. Als je iets weet dat hier ontbreekt, schrijf het erbij.",
  "shelp.ko.attachments":
    "Hier liggen documenten en afbeeldingen die bij deze kennis horen — bijvoorbeeld een foto van de installatie of een handleiding. Bijlagen zijn illustratiemateriaal en onderbouwing, geen gecontroleerde uitspraken. Bij het uploaden gelden groottelimieten die jullie beheer vaststelt.",
  "shelp.lcy.assetTitle":
    "Sommige kennis hangt aan een bepaalde machine of installatie. Wanneer daar iets verandert — een verbouwing, een vervanging, een nieuwe instelling — kun je dat hier melden. De betrokken kennisobjecten komen dan opnieuw ter beoordeling, zodat niemand met een verouderde stand werkt.",
  "shelp.lcy.pendingTitle":
    "Kennis veroudert. In deze lijst staan objecten waarvan de beoordeling een opfrissing nodig heeft — bijvoorbeeld omdat ze lang niet zijn aangeraakt of omdat hun omgeving is veranderd. Opnieuw gecontroleerde kennis blijft betrouwbaar; blijven liggen opfrissingen zijn een stil risico.",
  "shelp.lcy.pathTitle":
    "Een leerpad is een zinvolle leesvolgorde door de aanwezige kennis, toegesneden op een rol. Nieuwe collega's werken het stap voor stap door en vinken af wat ze hebben gelezen. Zo wordt van afzonderlijke kennisobjecten een begeleide instap.",
  "shelp.out.kindTitle":
    "Hier kies je welke soort document uit jullie geborgde kennis moet ontstaan — bijvoorbeeld een werkinstructie, een checklist of lesmateriaal. Het type bepaalt opbouw en toon van het resultaat. Gegenereerd wordt er pas wanneer je het activeert; vanzelf gebeurt hier niets.",
  "shelp.out.sourcesTitle":
    "Voor een document komen alleen gecontroleerde kennisobjecten in aanmerking, en precies die kies je hier. Wat niet gevalideerd is, staat bewust niet ter keuze — een gegenereerd document mag zich alleen op geborgde kennis baseren. Kies de objecten die inhoudelijk bij elkaar horen.",
  "shelp.out.composeTitle":
    "Hier breng je de gekozen kennisobjecten in de volgorde waarin ze in het document moeten verschijnen. De volgorde draagt de logica van het resultaat — van overzicht naar detail of langs een verloop. Verschuif de items tot de rode draad klopt.",
  "shelp.out.previewTitle":
    "De voorbeeldweergave toont het document zoals het uit jouw bouwstenen gegenereerd zou worden, in het tekstformaat Markdown. Controleer hier rustig of inhoud en volgorde passen, voordat je het resultaat downloadt of kopieert. Een export als PDF is er momenteel niet.",
  "shelp.out.provenanceTitle":
    "Bij elk gegenereerd document hoort het bewijs uit welke kennisobjecten het is opgebouwd. Dit gedeelte legt de herkomst vast, zodat elke uitspraak in het document herleidbaar blijft naar haar bron. Dat is hetzelfde principe als overal in KLARWERK: pas de onderbouwing maakt een uitspraak stevig.",
  "shelp.imp.uploadTitle":
    "Hier speel je een eerder gemaakte export in het JSON-formaat weer in. De items worden niet blind overgenomen: ze belanden eerst als kandidaten ter beoordeling, zodat er niets ongecontroleerd in de voorraad glipt. Bekijk de kandidatenlijst voordat je iets overneemt — ook om dubbelingen te voorkomen.",
  "shelp.ext.pipeline.title":
    "Dit gedeelte toont wat er bij het inlezen van externe inhoud is gebeurd: wat herkend werd, wat opviel en wat nog op een beslissing wacht. De pipeline neemt niets uit zichzelf over — die bereidt voor, mensen beslissen. Werk de bevindingen het best van boven naar beneden af.",
  "shelp.imp.queueTitle":
    "In deze wachtrij staan ingelezen bronnen die nog een menselijk oordeel nodig hebben: overnemen, herzien of verwerpen. Niets daaruit wordt zonder jouw beslissing deel van de kennisvoorraad. Hier scheidt zich ruw materiaal van geborgde kennis.",
  "shelp.mgmt.jumpTitle":
    "Deze balk is de inhoudsopgave van de managementweergave. Een tik op een item springt direct naar het betreffende gedeelte verderop. Die wijzigt niets aan de data — die helpt alleen bij het snel navigeren.",
  "shelp.mgmt.overview":
    "Dit overzicht vat de huidige toestand van jullie kennisvoorraad samen in een paar kengetallen — bijvoorbeeld hoeveel kennis aanwezig, gecontroleerd of in bewerking is. Het is een momentopname ter oriëntatie, geen rapportcijfer. Voor bijzonderheden open je de gedeelten daaronder.",
  "shelp.mgmt.capital":
    "Deze waarde verdicht de toestand van jullie kennisvoorraad tot één enkel getal — die houdt bijvoorbeeld rekening met hoeveel kennis gecontroleerd is en hoe goed die is onderbouwd. Lees hem als een grove indeling en let vooral op zijn ontwikkeling in de tijd. Eén enkel getal vervangt nooit de blik in de details.",
  "shelp.mgmt.valuation":
    "Dit gedeelte maakt de waarde van jullie kennis tastbaarder: een indeling van welke voorraden bijzonder veel bijdragen aan veiligheid en handelingsvermogen. De getallen zijn oriëntatiewaarden uit de voorraad, geen gecontroleerde balans. Gebruik ze om prioriteiten te bespreken, niet als boekhouding.",
  "shelp.mgmt.statement":
    "Het Knowledge Statement is een samenvattend rapport over jullie kennisvoorraad, bedoeld voor directie en gremia. Het beantwoordt in het kort: wat hebben we, hoe stevig is het, en waar zitten hiaten. Het rapport put uit de echte voorraden — wat het niet kan onderbouwen, beweert het niet.",
  "shelp.mgmt.maturity":
    "De volwassenheidsreis geeft aan hoe ver jullie organisatie is in de omgang met kennis — van de eerste geborgde items tot de ingespeelde cyclus van vastleggen, controleren en onderhouden. Die toont de volgende zinvolle etappe, geen cijfer. Volwassenheid groeit met het gebruik, niet op knopdruk.",
  "shelp.mgmt.house":
    "Het kennishuis is een beeld van jullie themalandschap: kamers staan voor kennisgebieden, en je ziet in één oogopslag welke goed gevuld en welke bijna leeg zijn. Lege kamers zijn geen schande, maar een uitnodiging — daar loont het volgende vastleggen. Tik op een gedeelte om erin te kijken.",
  "shelp.mgmt.recommendations":
    "Hier stelt KLARWERK vervolgstappen voor die uit jullie voorraad voortkomen — bijvoorbeeld blijven liggen beoordelingen of een kennisgebied dat maar uit één bron gevoed wordt. Het zijn voorstellen, geen opdrachten: jij beslist wat daarvan aan de beurt is. Elk voorstel brengt je direct naar de juiste plek.",
  "shelp.mgmt.priorities":
    "Deze lijst rangschikt kennisthema's naar hoe dringend ze aandacht nodig hebben — beoordeeld op negen gezichtspunten, zoals risico, ouderdom en de afhankelijkheid van afzonderlijke kennisbronnen. Bovenaan staat wat als eerste aan de beurt zou moeten zijn. De volgorde is een aanbeveling als gespreksbasis, geen automatische beslissing.",
  "shelp.mgmt.pilot":
    "Dit rapport bundelt wat er in de eerste dertig, zestig en negentig dagen van een pilotbedrijf is gebeurd en wat er als volgende aanstaat. Het maakt de voortgang voor alle betrokkenen zichtbaar — eerlijk, met behaalde en openstaande punten. Bedoeld als gemeenschappelijke basis voor het gesprek met de directie.",
  "shelp.mrun.title":
    "Deze lijst protocolleert de laatste inzetten van de KI: welke taak liep, welk model antwoordde, hoe lang het duurde en of een uitwijkroute nodig was. De inhoud van je teksten staat hier bewust niet — alleen technische kerngegevens. Zo blijft navolgbaar wat de KI wanneer heeft gedaan.",
  "shelp.rcfg.title":
    "Hier zie je welke KI voor welke taak is ingesteld — de cloud-KI, jullie On-Premise Enterprise AI of de op regels gebaseerde modus helemaal zonder model. De toewijzing laat zich per taak wijzigen, en de app toont eerlijk wat er op dit moment werkzaam is. KI-sleutels blijven daarbij altijd op de server; in de browser belandt er nooit een.",
  "shelp.evx.title":
    "De bewijs-index is de kwaliteitsweergave op de bewijslast: die toont welke kennisobjecten goed onderbouwd zijn en waar onderbouwing ontbreekt. Daarmee vind je gericht de items die vóór de volgende inzet onderbouwing nodig hebben. Goed onderbouwde kennis is de ruggengraat van elk betrouwbaar antwoord.",
  "shelp.prov.title":
    "Deze index controleert de herkomstkant van de kwaliteit: is bij elk kennisobject navolgbaar waar het vandaan komt en hoe het is ontstaan? Bijzonderheden staan bovenaan, zodat je ze als eerste ziet. Een sluitende herkomst is de basis waarop je kennis later nog kunt duiden.",
  "shelp.readiness.title":
    "Dit gedeelte schat in hoe startklaar jullie kennissysteem als geheel is — van de databasis via de beoordelingsprocessen tot de KI-koppeling. De stoplichten tonen waar het nog hapert en wat er als volgende zinvol is. Het is een positiebepaling, geen oplevering.",
  "shelp.kos.hintsTitle":
    "Hier verzamelt de kwaliteitsborging concrete aanwijzingen uit de voorraad: dingen die opvallen en een blik verdienen — bijvoorbeeld dun onderbouwde objecten of verweesde thema's. Elke aanwijzing noemt de vindplaats, zodat je er direct naartoe kunt springen en de oorzaak kunt verhelpen.",
  "shelp.evFresh.title":
    "Onderbouwing veroudert net als kennis. Deze weergave toont hoe vers het bewijs achter jullie kennisobjecten is en waar oude onderbouwing een opfrissing nodig heeft. Zo herken je items die formeel onderbouwd zijn, maar inhoudelijk mogelijk achterhaald.",
  // JOB 4022: zie het Duitse blok — de oude belofte gold voor vier van de vijf stappen niet, en de
  // woorden waren systeemtaal („Stage-1", „review/beslissing", „peers"). Dezelfde toezeggingen,
  // gewone woorden.
  "pilot.access.title": "Jouw eerste werkweg: zo begin je",
  "pilot.access.subtitle":
    "De zeven stappen van een eerste ronde. Elke stap leidt naar zijn gedeelte of noemt de rol die hij vraagt.",
  "pilot.access.summary":
    "Jouw rol ({{rolle}}) kan {{offen}} van de {{gesamt}} stappen zelf lopen. De overige blijven staan, zodat je het hele pad kent.",
  "pilot.access.locked": "Alleen met de rol {{rolle}}",
  "pilot.access.roleUnknown":
    "Jouw rol staat nog niet vast. Welke stappen voor jou open zijn, staat hier zodra die bekend is.",
  "pilot.check.start": "De instap toont wat er nu ligt — vanaf hier begint elke werkweg.",
  "pilot.check.library":
    "De bibliotheek toont wat er al is: met bron, stand en verloop — lezen staat voor elke rol open.",
  "pilot.check.capture":
    "Wat je vastlegt wordt eerst open opgeslagen: het is nog niet gecontroleerd.",
  "pilot.check.validation":
    "Bij het controleren beoordelen collega's jouw item tot het als geborgd geldt — er wordt niets automatisch vrijgegeven.",
  "pilot.check.use":
    "Vragen en bibliotheek tonen bij elk antwoord de bron en haar stand — een antwoord is niet betrouwbaarder dan zijn bron.",
  "pilot.check.gap":
    "Ontbreekt de basis, dan zegt het antwoord dat eerlijk en leidt het naar het vastleggen — er wordt niets verzonnen.",
  "pilot.check.maintain":
    "„Actueel houden“ betekent: items waarvan de controle verloopt, worden opnieuw bekeken — niets blijft automatisch voor altijd geldig.",
  // SCRUM-306/307 / JOB 4067: dezelfde toezeggingen, in de woorden die de gebruiker op het scherm
  // ziet (`nav.*`, `pilot.access.title`). De sleutelnamen blijven `pilot.next.*`/`pilot.obs.*`.
  "pilot.next.title": "Volgende stap",
  "pilot.next.hint":
    "Demodata zijn voorbeelden, geen productief bewijs. Bekijk nu Start of open in de help de eerste werkweg.",
  "pilot.next.start": "Start openen",
  "pilot.next.checklist": "„Jouw eerste werkweg: zo begin je“ openen",
  "pilot.next.ask": "Voorbeeldvraag openen",
  "pilot.obs.title": "Loopt iets vast? Hier staat waar het thuishoort",
  "pilot.obs.subtitle":
    "Vijf situaties uit het dagelijks werk — ernaast staat in welk onderdeel je verder komt. Er wordt niets opgeslagen, er wordt geen proces gestart; pure opmerkingen over de bediening horen niet in het product.",
  "pilot.obs.mapLabel": "Hoort in",
  "pilot.obs.missing.label": "Het ontbreekt volledig: over de vraag is nog geen item.",
  "pilot.obs.missing.map":
    "Risico & hiaten — noteer wat ontbreekt en hoe dringend het is; leg het daarna vast.",
  "pilot.obs.unverified.label": "Een item is onaf of nog niet gecontroleerd.",
  "pilot.obs.unverified.map": "Validatie — collega's beoordelen het daar tot het geborgd is.",
  "pilot.obs.outdated.label": "Een item lijkt verouderd of geldt zo niet meer.",
  "pilot.obs.outdated.map": "Levenscyclus — daar wordt het opnieuw bekeken („actueel houden“).",
  "pilot.obs.source.label":
    "Bij een item is onduidelijk waar het vandaan komt of hoe betrouwbaar het is.",
  "pilot.obs.source.map": "Bibliotheek — daar staan bron, stand, versie en status van elk item.",
  "pilot.obs.uxnote.label": "Het gaat om de bediening zelf: woordkeuze, verloop, route.",
  "pilot.obs.uxnote.map":
    "Geen onderdeel — dat noteer je erbuiten; het wordt niet in het product opgeslagen en start geen proces.",
  "pilot.obs.openFlow": "Onderdeel openen",
  // JOB 4071 (ALTKAPITEL-ANWENDERSPRACHE) — zie het Duitse blok voor de onderbouwing. De
  // beschrijvingen dragen de echte opschriften van deze taal: „Demogegevens laden"/„Demogegevens
  // verwijderen" (`adm.seedButton`/`adm.purgeButton`), „Ruwe kennis vastleggen"/„Controleren &
  // indienen" (`capture.flow.step.raw.label`/`capture.submit`), „Goedkeuren"/„Terugvraag"/
  // „Afwijzen" (`val.action*`), „Kennis vastleggen" (`risk.gapCapture`), „Installatie gewijzigd
  // …"/„Nog geldig → nieuwe versie"/„Als afgehandeld markeren" (`lcy.assetToggle`/`lcy.stillValid`/
  // `lcy.stepComplete`), „Uitgebreide modules" (`role.stage2`), „Rapportages" (`nav.output`), de
  // tabbladen `mob.tab*` en „Naar volledige versie" (`topbar.toDesktop`).
  "help.firststart.title": "Eerste start & demodata",
  "help.firststart.body":
    "Een pas opgezette installatie brengt geen kennis mee — er is dan niets te lezen, niets te controleren en niets te vinden. Om toch te laten zien hoe KLARWERK werkt, maakt „Demogegevens laden“ onder Admin een voorbeeldvoorraad aan: kennisobjecten, openstaande controles op de Validatie, kennishiaten en tegenstrijdigheden waarop je elk onderdeel rustig kunt uitproberen. „Demogegevens verwijderen“ haalt die er weer af; je echte voorraad blijft onaangeroerd. Voor beide heb je beheerrechten nodig. Volgende stap: Admin openen, „Demogegevens laden“ aanklikken en daarna verder met „Kennis vastleggen“.",
  "help.library.title": "Bibliotheek & kennisobject",
  "help.library.body":
    "De bibliotheek is de volledige kennisvoorraad op één plek. Met het zoekveld erboven vind je een item; filters, sortering, opgeslagen weergaven en export zitten in het menu „…“ boven de lijst. Eén klik opent het kennisobject: de uitspraak, de stand en de bron staan er meteen; bronnen en bijlagen, versies, historie, opmerkingen en gemelde tegenstrijdigheden zitten achter „Meer“. Op een smal apparaat draagt steeds maar één van beide het scherm — of de lijst, of het item. Volgende stap: een item aanklikken, de uitspraak lezen en „Meer“ openen.",
  "help.tasks.title": "Open taken",
  "help.tasks.body":
    "Hier staat het openstaande werk op één plek: objecten die op jouw controle in de Validatie wachten, terugvragen aan jou, gemelde tegenstrijdigheden, open kennishiaten en objecten die na een wijziging aan een installatie of proces nog eens bevestigd moeten worden. Een gekleurde stip toont de urgentie, de knoppenrij erboven perkt de lijst in tot één soort, en de „i“ bij een regel zegt wat daar te doen is. Elke regel leidt precies naar de plek waar de zaak wordt afgehandeld — voor zover jouw rol dat onderdeel mag zien. Volgende stap: de bovenste regel aanklikken en afwerken.",
  "help.risk.title": "Risico & hiaten",
  "help.risk.body":
    "Deze pagina laat zien waar kennis ontbreekt en waar zij aan één mens hangt. Bij elk open kennishiaat staat de volgende stap erbij: de urgentie inschatten, het aan een vakgenoot toewijzen of het met „Kennis vastleggen“ sluiten. Daarnaast zijn de vakgebieden gekleurd naar van hoeveel personen de daar vastgelegde kennis komt — rood betekent: alles komt van één enkele persoon, niemand anders heeft er tot nu toe aan bijgedragen. Wat daartegen helpt, staat bij de rode regel zelf. Volgende stap: een rode regel bekijken, de bijbehorende objecten openen en het dringendste hiaat aan iemand toewijzen.",
  "help.lifecycle.title": "Levenscyclus & leerpaden",
  "help.lifecycle.body":
    "Kennis veroudert wanneer de installatie verandert. Met „Installatie gewijzigd …“ meld je zo’n wijziging en noem je de installatie- of procesverwijzing; alle objecten die eraan hangen worden voor een nieuwe controle gemarkeerd en verschijnen in de lijst met openstaande controles. Wie die doorloopt, beslist per object: „Nog geldig → nieuwe versie“ — of het gaat de nabewerking in; is een object nog helemaal niet goedgekeurd, dan leidt de weg eerst naar de Validatie. Daarnaast staat het leertraject van jouw rol: stappen om in te werken die je met „Als afgehandeld markeren“ afvinkt. Volgende stap: een installatiewijziging melden of het bovenste punt van je leertraject afvinken.",
  "help.validation.title": "Validatie",
  "help.validation.body":
    "Hier liggen de kennisobjecten die op een controle wachten. Je leest de uitspraak en beslist: „Goedkeuren“, „Terugvraag“ of „Afwijzen“ — de laatste twee vragen om een toelichting, en het object gaat terug in de nabewerking in plaats van te worden vrijgegeven. Gevalideerd is een object pas als er genoeg groene beoordelingen zijn en geen rode ertegenin staat; hoeveel er nog ontbreken, staat op elke kaart. Volgende stap: het bovenste object openen, de uitspraak lezen en beslissen — twijfel je, dan is de terugvraag de juiste weg.",
  "help.stufe2.title": "Uitgebreide modules (Fase 2): kapitaalweergaven & rapportages",
  "help.stufe2.body":
    "Naast de kernstroom zijn er extra onderdelen. Een beheerder zet ze vrij met „Uitgebreide modules“; zonder die schakelaar blijven ze onzichtbaar, ook als jouw rol zou volstaan. De kapitaalweergaven lezen de voorraad als cijfers: hoeveel kennis er is, hoeveel daarvan gecontroleerd is, wat nog openstaat — plus een schatting van de waarde, waarvan je de aannames zelf invult. De cijfers tonen alleen; aan de kennis zelf verandert er daardoor niets. Onder „Rapportages“ ontstaat uit gevalideerde kennisobjecten een document. Volgende stap: een kengetal bekijken of een documentsoort kiezen.",
  "help.mobile.title": "Mobiel & offline",
  "help.mobile.body":
    "De mobiele weergave toont KLARWERK op telefoonbreedte, met de tabbladen „Vastleggen“, „Vragen“ en „Zoeken“: onderweg iets noteren, iets vragen, iets opzoeken. Een concept aanmaken mag alleen wie daar de rechten voor heeft; wie mag lezen, kan hier vragen en zoeken. Zonder verbinding wordt alleen het opslaan van een concept in de wachtrij gezet en later nagestuurd — vragen en zoeken zeggen dan open dat zij een verbinding nodig hebben. Controleren, vrijgeven en tegenstrijdigheden uitklaren bestaan hier niet; daarvoor leidt „Naar volledige versie“ bovenaan terug. Volgende stap: een tabblad aantikken.",
  "help.capture.title": "Kennis vastleggen",
  "help.capture.body":
    "Hier leg je vast wat je weet: typen, dicteren, fotograferen of een bestand meebrengen dat je al hebt. De KI brengt het ruwe materiaal in vorm — zij stelt voor, jij beslist, en er wordt niets vanzelf opgeslagen. De weg loopt in stappen van „Ruwe kennis vastleggen“ via het structureren naar „Controleren & indienen“; afgeronde stappen blijven aanklikbaar, dus je kunt terug zonder iets kwijt te raken. Wat je indient, wordt een kennisobject dat collega’s controleren — tot dan blijft het jouw concept. Volgende stap: „Kennis vastleggen“ openen en in eigen woorden beginnen.",
  "help.fileimport.title": "Bestand importeren: Word, PDF, PowerPoint, tekst en afbeeldingen",
  "help.fileimport.body":
    "De weg begint onder „Kennis vastleggen“: kies in het gereedschap „Bestand“ het item „Bestand importeren“ en open daar met „Bestand kiezen“ een document — of sleep het naar het neerzetvlak.\n\nDaarna beslis je wat ervan wordt: „In punten analyseren“ stelt afzonderlijke kennispunten met bronfragment voor en jij selecteert wat wordt overgenomen; „Hele document overnemen“ maakt precies één volledig concept aan. Er wordt niets opgeslagen zonder jouw toedoen; een aangemaakt concept is ongecontroleerd en niet ingediend.\n\nGeaccepteerd worden tekstbestanden (.txt, .md, .markdown, .csv, .log, .json), Word (.docx), PDF, PowerPoint (.pptx) en afbeeldingen.",
  "help.validate.title": "Valideren",
  "help.validate.body":
    "Beoordeel objecten groen/geel/rood. Vanaf de drempel geldt een object als gevalideerd; rode beoordelingen gaan terug naar de auteur.",
  "help.ask.title": "Vragen stellen",
  "help.ask.body":
    "Stel je vraag in je eigen woorden. Het antwoord wordt samengesteld uit de aanwezige kennis en noemt de kennisobjecten waarop het steunt. Bij elk daarvan staat de stand, zodat je ziet hoe stevig de basis is. Ontbreekt die basis, dan wordt er niets verzonnen: er ontstaat een kennishiaat, dat onder „Risico & hiaten“ verschijnt en daar aan iemand kan worden toegewezen. Volgende stap: een vraag typen en vanuit het antwoord doorspringen naar een van de genoemde kennisobjecten.",
  "help.conflict.title": "Conflicten",
  "help.conflict.body":
    "Tegenstrijdigheden worden zichtbaar gemaakt en begeleid opgelost. Alleen waarheidsconflicten escaleren naar een mens.",
  "help.roles.title": "Rollen",
  "help.roles.body":
    "Viewer leest en vraagt, expert legt vast, controller valideert en klaart uit, admin beheert. Je ziet alleen wat je rol toelaat.",
  "help.trust.title": "Vertrouwen",
  "help.trust.body":
    "Elke uitspraak draagt een rijpheidsgraad uit validatie en gebruik. Vertrouwen is bewijs, geen waarheid.",
  // JOB 3741 (SEITENHILFE-LUECKEN) — zie het Duitse blok voor de onderbouwing.
  "help.wissensnetz.title": "Themakaart",
  "help.wissensnetz.body":
    "De themakaart toont de kennisvoorraad van bovenaf: welke thema's er zijn en welke daarvan samen in dezelfde vrijgegeven kennisobjecten voorkomen. Op een breed venster kies je bovenaan tussen „Netwerk“ en „Lezen“ — het netwerk tekent elk thema als cirkel en zet de bijbehorende kennisobjecten ernaast zodra je op een cirkel klikt; is het venster smal, dan is er geen tekening en valt er ook niets te kiezen, maar staat er meteen de leesweergave. In beide gevallen staat daaronder per thema een zin met de weg naar de objecten: zoek het thema dat jou aangaat en ga van daaruit verder.",
  "help.extern.title": "Externe kennis",
  "help.extern.body":
    "Hier doorzoek je bronnen buiten Klarwerk, zonder eerst een kennisobject te hoeven openen. Je typt een zoekterm in en krijgt de treffers met hun adres terug; is het externe zoeken uitgeschakeld of onbereikbaar, dan zegt de pagina dat eerlijk in plaats van een lege lijst te tonen. Wat je vindt, komt niet vanzelf in de voorraad — wat je nodig hebt, leg je daarna zelf als kennisobject vast.",
  "help.konflikte.title": "Conflicten",
  "help.konflikte.body":
    "Een conflict is een tegenspraak: twee kennisobjecten zeggen iets over dezelfde zaak, en samen kunnen ze niet allebei kloppen. De pagina zet de twee uitspraken naast elkaar en laat je kiezen welke geldt, of ze allebei gelden afhankelijk van de context, of dat er helemaal geen tegenspraak is. Je keuze wordt als notitie vastgelegd, er wordt niets verwijderd; neem een paar en lees beide uitspraken voordat je beslist.",
  "help.duplikate.title": "Duplicaten",
  // JOB 3890 — zie het Duitse blok: de halve zin zegt nu wat de knop zegt; de woorden komen uit
  // `dup.side.both` en `dup.seitenhilfe.entscheidung.text` van deze taal.
  // Ronde 3: de plek staat hier NIET — zie het Duitse blok voor de twee gemeten redenen (de
  // hulpzoekfunctie zoekt op deelreeks, en Klara knipt elk fragment bij 700 tekens af). Op
  // `/duplikate` noemt de zin onder het hoofdstuk de plek nog steeds.
  "help.duplikate.body":
    "Twee kennisobjecten die grotendeels hetzelfde zeggen, komen hier als paar terecht. Anders dan bij een conflict spreken ze elkaar niet tegen, ze overlappen. Jij bepaalt welke kant leidend is, of ze allebei blijven en als verwant genoteerd worden, of dat het helemaal geen duplicaat is; er wordt niets samengevoegd en niets verwijderd, er komt een notitie, en ook „als verwant noteren“ legt geen koppeling in de objecten aan. De besliste bevinding verdwijnt uit de lijst en uit het getal op het tabblad; daarmee is niets verloren, want beide kennisobjecten blijven ongewijzigd bestaan. Neem een paar en vergelijk de twee teksten.",
  "help.analytics.title": "Analytics & audit",
  "help.analytics.body":
    "Deze pagina bundelt de analyse over de hele voorraad en daarnaast het logboek van wat er gebeurd is: kengetallen over validatie, vertrouwen, hiaten en werklast aan de ene kant, de navolgbare lijst met gebeurtenissen aan de andere. Je kunt het logboek filteren op soort gebeurtenis en op de persoon die handelde, om één vraag te volgen. Kies een kengetal en zoek de herkomst ervan in het logboek.",
  "help.output.title": "Rapportages",
  "help.output.body":
    "Hier ontstaat een document uit kennis die er al is. Je kiest de soort document, stelt de kennisobjecten samen die erin horen en zet ze in de volgorde waarin ze moeten verschijnen; een voorbeeld toont de samenstelling voordat het document wordt aangemaakt. Begin met de soort document, daarna kies je de bronnen erbij.",
  "help.import.title": "Import & bronnen",
  "help.import.body":
    "Hier loopt het importeren van externe bronnen: bovenaan kies je een bron, kijk je wat erin staat en maak je daar voorstellen van — alleen wat jij selecteert wordt ingelezen. De voorstellen zelf liggen daaronder in het dichtgeklapte gedeelte „Review-geschiedenis“, waarvan de teller zegt hoeveel ervan openstaan; klap het open en beslis er een met „Aannemen“ of „Afwijzen“, of zet er een notitie bij. Besliste voorstellen verdwijnen niet en schuiven niets door — ze blijven met hun stand in de lijst staan, en het volgende openstaande zoek je zelf uit.",
  "help.graph.title": "Kennisgraaf",
  // JOB 3889 — siehe den Kommentar an der deutschen Fassung: die Bedingung aus `graphNav.ts:12`
  // steht jetzt auch hier, mit derselben Wendung, die die Schwesterhilfe „uit het bestand" benutzt.
  "help.graph.body":
    "De kennisgraaf tekent de afzonderlijke kennisobjecten en hun verbindingen als een net — dichter bij het object dan de themakaart, die per thema groepeert. Hoort een knooppunt bij een object uit het bestand, dan leidt een klik erop naar dat kennisobject, en met het toetsenbord bereik je het net zo goed; een knooppunt zonder zo’n object is geen link en ligt niet in de toetsenbordvolgorde. Begin bij een object dat je kent en volg zijn lijnen.",
  "help.gesamtanweisungen.title": "Werkinstructies samenstellen",
  "help.gesamtanweisungen.body":
    "Werkinstructies zijn leesbare stap-voor-stap-documenten uit bestaande kennis – bijvoorbeeld voor het inwerken van nieuwe collega’s. Het overzicht toont alle instructies die je mag lezen; een klik op de titel opent er een. Een nieuwe begin je met een titel en „Nieuwe werkinstructie maken”. In de geopende instructie beschrijf je doel, toepassingsgebied en voorwaarden, zoek je bestaande items op titel en neem je van elk één vaste versie als onderdeel op – een latere wijziging aan het item vervangt die niet stilzwijgend. De leesversie toont het resultaat; met „Omhoog” en „Omlaag” wijzig je de volgorde. Tot slot leg je de hele instructie ter beslissing voor; personen met beoordelingsrecht beslissen. „Wat is er veranderd?” vergelijkt twee opgeslagen standen. Een automatische inhoudelijke controle is nog niet aangesloten, en voor dit alles is geen AI nodig.",
  "help.hilfe.title": "Help",
  "help.hilfe.body":
    "Op deze pagina staan alle helphoofdstukken bij elkaar, met een zoekveld erboven; elk hoofdstuk heeft een link naar de pagina waar het over gaat. Er wordt gezocht in titel, tekst en trefwoorden van de hoofdstukken — typ dus gerust het woord in waarmee je je probleem zou omschrijven. Is er niets over, dan zegt de pagina dat eerlijk in plaats van een onpassend hoofdstuk te tonen.",
  "help.profil.title": "Profiel",
  "help.profil.body":
    "In het profiel staan je eigen gegevens: naam en rol, e-mailadres, de taal van de interface en de weg om af te melden. Je kunt hier de taal omzetten en je wachtwoord wijzigen; onder „Mijn impact“ zie je uitsluitend getallen over je eigen bijdragen. Mis je onderdelen in je menu, dan kan dat aan je rol liggen — die staat hier naast je naam — of eraan dat de uitgebreide modules uitgeschakeld zijn; die schakelaar staat onder „Instellingen“ en vraagt beheerdersrechten.",
  "mob.title": "Snel vastleggen",
  "mob.sub": "Bij de installatie. In minder dan twee minuten.",
  "mob.dictate": "Dictaat opnemen",
  "mob.dictateSub": "Spreken — de AI structureert",
  "mob.note": "Notitie",
  "mob.photo": "Foto",
  "mob.interview": "Interview",
  "mob.lookup": "Opzoeken",
  "mob.modusGruppe": "Vastlegwijze",
  "mob.modusGesperrt": "Eerst opslaan of leegmaken, dan de vastlegwijze wisselen.",
  "mob.iv.frage1": "Waar gaat het over? Formuleer de kernboodschap in één zin.",
  "mob.iv.frage2": "Onder welke voorwaarden of vanaf wanneer geldt dat?",
  "mob.iv.frage3": "Welke maatregel of consequentie volgt daaruit?",
  "mob.iv.frage4": "Welke trefwoorden/tags helpen bij het terugvinden? (komma-gescheiden)",
  "mob.iv.fortschritt": "Vraag {{nummer}} van {{gesamt}}",
  "mob.iv.weiter": "Volgende vraag",
  "mob.iv.zurueck": "Vorige vraag",
  "mob.iv.hinweis": "Elk antwoord staat meteen in het concept — opslaan kan na elke vraag.",
  "mob.foto.kamera": "Camera",
  "mob.foto.mediathek": "Fotobibliotheek",
  "mob.foto.entfernen": "Foto verwijderen",
  "mob.foto.fehler": "De foto kon niet worden gelezen.",
  "mob.foto.max": "Maximaal {{max}} foto's per concept.",
  "mob.foto.inArbeit": "Foto wordt voorbereid … opslaan kan zo meteen.",
  "mob.editing": "Concept wordt voortgezet.",
  "mob.formTitle": "Kernuitspraak",
  "mob.formStatement": "Wat is er gebeurd / wat geldt?",
  "mob.save": "Als concept opslaan",
  "mob.saved": "Concept opgeslagen.",
  "mob.update": "Concept bijwerken",
  "mob.updated": "Concept bijgewerkt.",
  "mob.new": "Nieuw",
  "mob.drafts": "Mijn concepten",
  "mob.draftsEmpty": "Nog geen concepten.",
  "mob.resume": "Voortzetten",
  "mob.discard": "Verwerpen",
  "mob.discarded": "Concept verworpen.",
  "mob.discardConfirmHint": "Verwerpen?",
  "mob.confirmDiscard": "Ja, verwerpen",
  "mob.cancelDiscard": "Annuleren",
  "mob.tabCapture": "Vastleggen",
  "mob.tabAsk": "Vragen",
  "mob.tabLookup": "Zoeken",
  "mob.searchPlaceholder": "Kennis doorzoeken …",
  "mob.searchEmpty": "Geen treffers.",
  "mob.online": "online",
  "mob.offline": "offline",
  "mob.queued": "Offline opgeslagen – wordt gesynchroniseerd.",
  "mob.queue": "Wachtrij",
  "mob.syncNow": "Synchroniseren",
  "mob.syncOk": "Gesynchroniseerd",
  "mob.syncFail": "Synchronisatie mislukt",
  "mob.offlineSaveHint": "Offline – opslaan wordt lokaal genoteerd.",
  "mob.offlineAsk": "Offline – vragen hebben een verbinding nodig.",
  "mob.offlineSearch": "Offline – zoeken heeft een verbinding nodig.",
  "mob.offlineNeedsConn": "Zodra er weer verbinding is, is dit beschikbaar.",
  "mob.status.queued": "wacht",
  "mob.status.pending": "loopt",
  "mob.status.synced": "klaar",
  "mob.status.failed": "Fout",
  // JOB 4354 — alleen de NAAM van de melding, nooit de inhoud (dat is de zin van de server).
  "mob.vorgang.grund": "Afgewezen — {{titel}}",
  // JOB 4193 — de navraag bij een verouderde versie (mobiel).
  "mob.stand.laedt": "De opgeslagen versie wordt opgehaald …",
  "mob.stand.pruefungFehlt":
    "De opgeslagen versie kan nu niet worden gecontroleerd. Je tekst blijft staan — probeer het opnieuw voordat je opslaat.",
  "mob.stand.erneutPruefen": "Opnieuw controleren",
  "mob.stand.titelSpeichern":
    "Dit concept is intussen elders gewijzigd. Jouw versie is NIET opgeslagen en er is niets overschreven.",
  "mob.stand.titelOffline":
    "Van dit concept staat een offline opgeslagen versie klaar — en op de server staat intussen een andere.",
  "mob.stand.felder": "Verschilt in",
  "mob.stand.feld.title": "Titel",
  "mob.stand.feld.statement": "Kernuitspraak",
  "mob.stand.feld.body": "Tekst",
  "mob.stand.holen": "Nieuwe versie ophalen",
  "mob.stand.behalten": "Mijn versie behouden",
  "mob.stand.offlineFassung": "Offline opgeslagen",
  "mob.stand.serverFassung": "Huidige serverversie",
  "mob.stand.meineFassung": "Je vorige versie — niet opgeslagen",
  "mob.stand.verwerfen": "Verwerpen",
  "mob.stand.offlineHinweis":
    "Zonder verbinding wordt er niets vergeleken. Of iemand anders dit concept heeft gewijzigd, blijkt bij het opnieuw openen met verbinding.",
  "mob.stand.syncAbgewiesen":
    "Niet nagestuurd: het concept is elders gewijzigd. Open het om te beslissen welke versie geldt.",
  "mob.stand.erstAufloesen":
    "Los eerst de navraag op: van dit concept staat nog open welke versie geldt. Kies „Nieuwe versie ophalen“ of „Mijn versie behouden“ — tot dan wordt er niets opgeslagen.",
  "mob.stand.syncBrauchtStand":
    "Niet nagestuurd: bij dit oudere item ontbreekt de versie waartegen het moet gelden. Het blijft staan — open het concept, dan wordt het vergeleken en verstuurd.",
  "mob.ausgangUnklar":
    "Er kwam geen antwoord — of er is opgeslagen is onduidelijk. Herlaad de concepten en kijk na voordat je opnieuw opslaat.",
  // JOB 4249 — de wachtrij staat op het apparaat, maar hoort bij een account.
  "mob.konto.laedt": "Er staan nog items klaar. Van wie ze zijn, wordt gecontroleerd …",
  "mob.konto.unbekannt":
    "Er staan nog items klaar. Wie is aangemeld, is nu niet vast te stellen — daarom wordt er niets verstuurd en niets verwijderd. Meld je opnieuw aan om verder te gaan.",
  "mob.konto.eigeneLeer": "Van jou wacht er niets.",
  "mob.konto.fremdeWarten":
    "Er staan items van een ander account klaar. Ze worden niet verstuurd en niet verwijderd — ze wachten tot dat account zich weer aanmeldt.",
  "mob.konto.ohneBindungWarten":
    "Bij deze oudere items is geen account vastgelegd. Ze worden aan niemand toegewezen en niet verwijderd — meld je aan met het account waarvan ze afkomstig zijn.",
  "mob.konto.fremdeNichtGesendet": "Niet verstuurd: hoort bij een ander account.",
  "mob.konto.ohneBindungNichtGesendet":
    "Niet verstuurd: bij deze oudere items is geen account vastgelegd. Ze blijven staan.",
  "mob.konto.syncWartet":
    "Er is niets verstuurd: wie is aangemeld, staat nu niet vast. Alles blijft staan.",
  "mob.konto.speichernWartet":
    "Nog niet opgeslagen: wie is aangemeld, staat nu niet vast. Je tekst blijft staan — probeer het zo nog eens.",
  "mob.konto.laufAngehalten":
    "Het versturen is gestopt omdat het account is gewisseld. De overige items blijven staan en horen nog steeds bij het account dat ze heeft vastgelegd.",
  "mob.konto.auffrischung":
    "Wie is aangemeld, wordt op dit moment bevestigd. Tot het antwoord er is, wordt er niets verstuurd — het gaat vanzelf verder.",
  "mob.sitzung.unbeantwortet":
    "Geen netwerk — uw aanmelding kon niet worden gecontroleerd. Wat u hier hebt vastgelegd, staat nog op dit apparaat. Er wordt pas verzonden als er weer netwerk is en vaststaat wie er is aangemeld.",
  "mob.sitzung.nurLokal":
    "Zonder bevestigde aanmelding wordt hier niets van de server getoond — ook niets uit een eerdere aanvraag. U ziet alleen wat op dit apparaat staat.",
  "s2.kicker": "Uitgebreid · Niveau 2",
  "s2.output":
    "Uit gevalideerde objecten werkinstructies/checklists genereren — actief zodra de output-logica staat.",
  "out.kindTitle": "Output-type",
  "out.sourcesTitle": "Gevalideerde bronnen",
  "out.noValidated": "Nog geen gevalideerde kennisobjecten aanwezig.",
  "out.generate": "Output genereren",
  "out.composeTitle": "Volgorde & compositie",
  "out.composeHint":
    "Volgorde van de bouwstenen vastleggen — die wordt bij het genereren precies zo overgenomen.",
  "out.moveUp": "Naar boven",
  "out.moveDown": "Naar beneden",
  "out.removeFromOrder": "Uit selectie verwijderen",
  "out.previewCompositionTitle": "Compositievoorbeeld",
  "out.previewSummary": "{{kind}} uit {{n}} gevalideerde bouwstenen in deze volgorde.",
  "out.previewProvenance":
    "De volledige herkomst per bouwsteen wordt in het gegenereerde document vermeld.",
  "out.previewUncertain":
    "{{n}} bouwsteen/-stenen met laag vertrouwen — in het document als onzeker gemarkeerd.",
  "out.previewDisclaimer":
    "Voorbeeld van de compositie, niet het voltooide document. Generatie gebeurt bij het genereren.",
  "out.previewTitle": "Voorbeeld (Markdown)",
  "out.copy": "Kopiëren",
  "out.copied": "Markdown gekopieerd.",
  "out.download": "Download .md",
  "out.provenanceTitle": "Herkomst & bewijs",
  "out.uncertain": "laag vertrouwen",
  "out.genError": "Output kon niet worden gegenereerd.",
  "out.kind.instruction": "Werkinstructie",
  "out.kind.checklist": "Checklist",
  "out.kind.troubleshooting": "Storingshulp",
  "out.kind.training": "Training",
  "out.kind.management_summary": "Management-summary",
  "out.kindDesc.instruction": "Stap-voor-stap-handleiding (SOP).",
  "out.kindDesc.checklist": "Afvinkbare punten voor de praktijk.",
  "out.kindDesc.troubleshooting": "Symptoom → oorzaak → maatregel.",
  "out.kindDesc.training": "Leereenheden met kernuitspraken.",
  "out.kindDesc.management_summary": "Verdicht overzicht met vertrouwen.",
  "s2.import":
    "Documenten importeren en controleren — actief zodra de import-/source-review-API staat.",
  "s2.capital":
    "Kenniskapitaal-kengetallen op echte live-data — actief zodra de kengetallen-logica staat.",
  "mgmt.jumpTitle": "Gedeelten",
  "mgmt.overview": "Operationele snapshot",
  "mgmt.kpiTotal": "Objecten",
  "mgmt.kpiValidated": "Gevalideerd",
  "mgmt.kpiOpen": "Open",
  "mgmt.kpiGaps": "Hiaten",
  "mgmt.kpiConflicts": "Conflicten",
  "mgmt.kpiTrust": "Ø vertrouwen",
  "mgmt.capital": "Kenniskapitaal-score",
  "mgmt.band.gut": "goed",
  "mgmt.band.mittel": "gemiddeld",
  "mgmt.band.kritisch": "kritiek",
  "mgmt.part.validatedRatio": "Validatiegraad",
  "mgmt.part.avgTrust": "Ø vertrouwen",
  "mgmt.part.coverage": "Dekking domeinen",
  "mgmt.part.singleSourceInv": "Bronspreiding",
  "mgmt.part.freshnessInv": "Actualiteit",
  "mgmt.valuation": "Kenniswaardering",
  "mgmt.valuationDisclaimer":
    "Schattingsmodel op basis van transparante aannames — geen balanswaardering.",
  "mgmt.assumeRate": "€ per uur",
  "mgmt.assumeHours": "uur/object bespaard",
  "mgmt.assumeReuse": "Hergebruik",
  "mgmt.basis": "Basis: {{n}} gevalideerde objecten · Ø vertrouwen {{trust}}",
  "mgmt.statement": "Kennisbalans",
  "mgmt.assets": "Activa",
  "mgmt.risks": "Risico's",
  "mgmt.net": "Netto-index",
  "mgmt.riskBreakdown":
    "Single-source-domeinen: {{ss}} · verouderd: {{stale}} · openstaande hiaten: {{gaps}} · conflicten: {{conf}}",
  "mgmt.maturity": "Volwassenheidspad",
  "mgmt.stage": "Fase",
  "mgmt.stageName.leer": "Geen voorraad",
  "mgmt.stageName.erfassen": "Vastleggen",
  "mgmt.stageName.strukturieren": "Structureren",
  "mgmt.stageName.validieren": "Valideren",
  "mgmt.stageName.wiederverwenden": "Hergebruiken",
  "mgmt.stageName.skalieren": "Schalen",
  "mgmt.house": "Kennishuis",
  "mgmt.fragile": "fragiel",
  "mgmt.stable": "geborgd",
  "mgmt.empty": "Nog geen voorraad — kengetallen verschijnen zodra kennis is vastgelegd.",
  "mrun.title": "Reasoner-runs (laatste)",
  "mrun.empty": "Nog geen Reasoner-runs geprotocolleerd.",
  "mrun.total": "Totaal: {{n}}",
  "mrun.errors": "Fouten: {{n}}",
  "mrun.fallbacks": "Fallbacks: {{n}}",
  "mrun.demo": "Demo: {{n}}",
  "mrun.fallback": "Fallback",
  "mrun.demoTag": "Demo",
  "mrun.model": "Model: {{m}}",
  "mrun.duration": "Duur: {{d}}",
  "mrun.runtimeTotal": "Totale looptijd: {{d}} (uit {{n}} van {{total}} runs)",
  "mrun.tokens": "Tokens: {{ein}} in · {{aus}} uit",
  "mrun.tokensTotal": "Tokens totaal: {{ein}} in · {{aus}} uit (uit {{n}} van {{total}} runs)",
  "mrun.refreshFailed": "Verversen mislukt — getoond wordt de laatst geladen stand.",
  "mrun.offline": "Geen verbinding — getoond wordt de laatst geladen stand.",
  "evx.title": "Bewijs-index (KM)",
  "evx.empty": "Nog geen bewijs-records aanwezig.",
  "evx.total": "Totaal: {{n}}",
  "evx.sources": "Bronnen: {{n}}",
  "evx.attachments": "Bijlagen: {{n}}",
  "evx.kos": "Kennisobjecten: {{n}}",
  "evx.kind.source": "Bron",
  "evx.kind.attachment": "Bijlage",
  "evx.koRef": "KO {{id}}",
  "evx.providerPill": "Aanbieder: {{v}}",
  "evx.objectPill": "Object: {{v}}",
  "prov.title": "Herkomst-index (KM)",
  "prov.empty": "Nog geen kennisobjecten aanwezig.",
  "prov.total": "KO's: {{n}}",
  "prov.transfer": "Overdracht: {{n}}",
  "prov.multiVersion": "Meervoudige versie: {{n}}",
  "prov.withEvidence": "met bewijs: {{n}}",
  "prov.noEvidence": "zonder bewijs: {{n}}",
  "prov.version": "v{{n}}",
  "prov.counts": "B {{sources}} · Bij {{attachments}} · Bw {{evidence}}",
  "prov.badge.no-evidence": "geen bewijs",
  "prov.badge.transferred-author": "auteursoverdracht",
  "prov.badge.multi-version": "meervoudige versie",
  "kos.hintsTitle": "Knowledge-OS KM-aanwijzingen",
  "kos.sevCount.critical": "kritiek: {{n}}",
  "kos.sevCount.warning": "Waarschuwingen: {{n}}",
  "kos.sevCount.info": "Aanwijzingen: {{n}}",
  "kos.sev.critical": "kritiek",
  "kos.sev.warning": "Waarschuwing",
  "kos.sev.info": "Info",
  "kos.sev.ok": "OK",
  "kos.hints.none": "Geen aanwijzingen uit de geladen signalen.",
  "kos.hints.unknown": "Niet geladen (onbekend, geen fout): {{sources}}",
  "kos.hint.modelrun-errors.title": "ModelRun-fouten ({{n}})",
  "kos.hint.modelrun-errors.detail": "Reasoner-aanroepen met foutstatus — protocol controleren.",
  "kos.hint.modelrun-fallbacks.title": "ModelRun-fallbacks ({{n}})",
  "kos.hint.modelrun-fallbacks.detail":
    "Runs gebruikten de deterministische vervanging in plaats van een model.",
  "kos.hint.reasoner-demo.title": "Reasoner in demo-/fallback-modus",
  "kos.hint.reasoner-demo.detail":
    "Geen echt model geconfigureerd — antwoorden zijn deterministisch.",
  "kos.hint.provenance-no-evidence.title": "KO's zonder bewijs ({{n}})",
  "kos.hint.provenance-no-evidence.detail": "Bronnen/bijlagen aanwezig, maar geen bewijs-records.",
  "kos.hint.evidence-outdated.title": "Bewijs verouderd ({{n}})",
  "kos.hint.evidence-outdated.detail":
    "Actuele KO-versie zonder bewijs — alleen oudere versies onderbouwd.",
  "kos.hint.evidence-missing.title": "Bewijs ontbreekt ({{n}})",
  "kos.hint.evidence-missing.detail":
    "Bronnen/object-bijlagen aanwezig, maar geen bewijs voor welke versie dan ook.",
  "kos.hint.provenance-lineage.title": "Overdracht/meervoudige versie ({{n}})",
  "kos.hint.provenance-lineage.detail": "KO's met auteursoverdracht of meerdere versies.",
  "kos.hint.evidence-empty.title": "Geen bewijs-records",
  "kos.hint.evidence-empty.detail":
    "Tot nu toe zijn er geen bronnen/bijlagen als bewijs vastgelegd.",
  // AUFTRAG-mega34 G.
  "kos.hint.health-detection-unproven.title": "Knowledge-Health niet aangetoond ({{n}})",
  "kos.hint.health-detection-unproven.detail":
    "De conflictdetectie is niet volledig aangetoond. De getoonde waarde is daarom de ongunstigst mogelijke, geen gemeten graad — zolang dat zo is, valt noch een sein-veilig noch een alarm eerlijk te geven.",
  "kos.hint.health-critical.title": "Knowledge-Health kritiek ({{n}})",
  "kos.hint.health-critical.detail": "Totaalscore in het kritieke bereik.",
  "kos.hint.health-mittel.title": "Knowledge-Health gemiddeld ({{n}})",
  "kos.hint.health-mittel.detail": "Totaalscore in het gemiddelde bereik.",
  "kos.hint.all-clear.title": "Geen bijzonderheden",
  "kos.hint.all-clear.detail": "De geladen Foundation-signalen tonen geen waarschuwingen.",
  "evFresh.title": "Actualiteit van bewijs (QM)",
  "evFresh.subtitle": "KO's waarvan de huidige versie geen bewijs heeft.",
  "evFresh.empty": "Geen KO's met verouderd of ontbrekend bewijs.",
  "evFresh.summary.outdated": "verouderd: {{n}}",
  "evFresh.summary.missing": "ontbrekend: {{n}}",
  "evFresh.summary.current": "actueel: {{n}}",
  // UX-26 (arbeit:ux26-beleg-original-20260921): `evFresh.summary.neutral` staat nu in `texte/ux26.ts`.
  "evFresh.version": "v{{n}}",
  "evFresh.counts": "actueel {{current}} · ouder {{older}}",
  "evFresh.openKo": "KO openen",
  "qmWindow.within": "binnen het geladen venster",
  "qmWindow.limited": "mogelijk afgekapt",
  "qmWindow.modelRuns": "Venster: {{n}} meest recente ModelRuns",
  "qmWindow.evidence": "Venster: {{n}} meest recente EvidenceRecords",
  "readiness.title": "Knowledge-OS Readiness",
  "readiness.ready": "gereed",
  "readiness.attention": "aandachtig",
  "readiness.critical": "kritiek",
  "readiness.incomplete": "onvolledig geladen",
  "readiness.reason.critical": "kritieke aanwijzingen",
  "readiness.reason.warning": "waarschuwingen",
  "readiness.reason.window": "datavenster mogelijk afgekapt",
  "readiness.reason.unknown": "signalen niet geladen",
  "mrun.task.structure": "Structureren",
  "mrun.task.assist": "Bijschaven",
  "mrun.task.interview": "Interview",
  "mrun.task.answer": "Antwoorden",
  "mrun.task.select": "Selecteren",
  // JOB 3069: spiegel van de DE-sleutels — zie de toelichting daar.
  "mrun.task.extract": "Extraheren",
  "mrun.task.describe": "Afbeelding beschrijven",
  "mrun.task.group": "Groeperen",
  "mrun.task.enrich": "Verrijken",
  "mrun.task.conflict": "Conflictcontrole",
  "mrun.task.duplicate": "Duplicaatcontrole",
  "mrun.task.probe": "Aanbiedertest",
  "mrun.cost": "Kosten: {{k}}",
  "mrun.costStand": "Prijslijst per: {{s}}",
  "mrun.produced": "Gemaakt: {{n}} × {{art}}",
  "mrun.erzeugnis.vorschlag": "voorstel",
  "mrun.erzeugnis.text": "tekst",
  "mrun.erzeugnis.frage": "vraag",
  "mrun.erzeugnis.antwort": "antwoord",
  "mrun.erzeugnis.punkt": "punt",
  "mrun.erzeugnis.beschreibung": "beschrijving",
  "mrun.erzeugnis.gruppe": "groep",
  "mrun.erzeugnis.kriterien": "selectiecriteria",
  "mrun.erzeugnis.urteil": "oordeel",
  "mrun.report.title": "AI-overzicht (periode)",
  "mrun.report.period": "Periode:",
  "mrun.report.days": "Laatste {{n}} dagen",
  "mrun.report.costSum": "Totale kosten: {{k}} (uit {{n}} van {{total}} runs)",
  "mrun.report.priceList": "Prijslijst: per {{s}}, {{w}}",
  "mrun.report.noPriceList": "Geen prijslijst ingesteld — kosten worden niet berekend.",
  "mrun.report.withoutPrice":
    "{{n}} runs met modelaanroep zonder berekenbare kosten (prijs of verbruik ontbreekt)",
  "mrun.report.capped": "Zeer veel runs — berekend over de meest recente 10000.",
  "mrun.report.empty": "Geen AI-runs in deze periode.",
  "mrun.taskUnknown": "Taaktype onbekend",
  "mrun.status.success": "OK",
  "mrun.status.error": "Fout",
  "rcfg.title": "Reasoner-configuratie",
  "rcfg.mode": "Modus",
  "rcfg.modeLabel.model": "Model actief",
  "rcfg.modeLabel.fallback": "Fallback",
  "rcfg.modeLabel.demo": "Demo (deterministisch)",
  "rcfg.provider": "Provider",
  "rcfg.model": "Model",
  "rcfg.notConfigured": "niet geconfigureerd",
  "rcfg.locales": "Talen",
  "rcfg.tasks": "Taken",
  "rcfg.fallbackHint": "Geen model geconfigureerd — deterministische fallback is actief.",
  "mgmt.recommendations": "Aanbevelingen",
  "mgmt.noRecs": "Geen dringende maatregelen.",
  "mgmt.sev.hoch": "hoog",
  "mgmt.sev.mittel": "gemiddeld",
  "mgmt.rec.secureSingleSource":
    "{{count}} single-source-domein(en) beveiligen (kennis verspreiden).",
  "mgmt.rec.revalidate": "{{count}} openstaande hervalidatie(s) afhandelen.",
  "mgmt.rec.closeGaps": "{{count}} open kennishiaat/-hiaten sluiten.",
  "mgmt.rec.resolveConflicts": "{{count}} open conflict(en) oplossen.",
  "mgmt.rec.validateBacklog": "{{count}} open objecten valideren.",
  "mgmt.priorities": "Kennisprioritering (9 factoren)",
  "mgmt.prio.filterLabel": "Prioritering filteren",
  "mgmt.prio.filter.all": "Alles",
  "mgmt.prio.filter.busFactorOne": "Busfactor 1",
  "mgmt.prio.filter.stale": "Verouderd",
  "mgmt.prio.filter.highProtection": "Hoge beschermingswaarde",
  "mgmt.prio.flag.busFactorOne": "busfactor 1",
  "mgmt.prio.flag.stale": "verouderd",
  "mgmt.prio.flag.highProtection": "hoge beschermingswaarde",
  "mgmt.prio.factor.busFactor": "Busfactor",
  "mgmt.prio.factor.criticality": "Kritikaliteit",
  "mgmt.prio.factor.processProximity": "Procesnabijheid",
  "mgmt.prio.factor.age": "Leeftijd",
  "mgmt.prio.factor.sourceQuality": "Bronkwaliteit",
  "mgmt.prio.factor.conflictDensity": "Conflictdichtheid",
  "mgmt.prio.factor.repetition": "Herhalingsfrequentie",
  "mgmt.prio.factor.damagePotential": "Schadepotentieel",
  "mgmt.prio.factor.protection": "Beschermingswaarde",
  "mgmt.prio.noData": "geen invoergegevens",
  "mgmt.prio.noDataNote":
    "Voor {{factors}} zijn er in het bestand geen invoergegevens. Deze factoren worden niet geschat; de score komt uit de overige.",
  "mgmt.prio.detail": "Factordetail · berekend uit {{known}} van 9 factoren",
  "mgmt.prio.emptyFilter": "Geen categorie in dit filter.",
  "mgmt.pilot": "Pilotrapport 30/60/90",
  "mgmt.print": "Afdrukken / PDF",
  "mgmt.pilotNote": "Afdruk-/HTML-weergave (via browserafdruk), geen gecertificeerde PDF.",
  "mgmt.window": "Venster",
  "mgmt.created": "Vastgelegd",
  "mgmt.validatedCol": "Gevalideerd",
  "mgmt.days": "Dagen",
  "s2.graphEmpty": "Geen graafgegevens.",
  "s2.graphCount": "{{nodes}} knopen · {{edges}} verbindingen",
  "graph.truncated": "Weergave beperkt tot de {{n}} sterkst verbonden knopen",
  "graph.legendValidated": "gevalideerd",
  "graph.legendOpen": "open / in beoordeling",
  "graph.legendTag": "tag-relatie",
  "graph.legendConflict": "conflict",
  "graph.clickHint": "Klik op een knoop om het kennisobject te openen",
  "graph.openNode": "Kennisobject openen: {{title}}",
  "vhelp.originFilter.title": "Herkomst filteren",
  "vhelp.originFilter.body":
    "Toont de lijst gefilterd op herkomst: demovoorbeelden of eigen kennis van jouw organisatie. Dit is alleen een weergave om dingen terug te vinden — het verandert geen controlestatus en gooit niets weg. Het getal achter elk filter geeft aan hoeveel vermeldingen het bevat.",
  "vhelp.reviewFocus.title": "Review-focus",
  "vhelp.reviewFocus.body":
    "Maakt onderscheid tussen nieuwe indieningen en herziene (versie groter dan 1). Herziene objecten verdienen een gerichte blik op de wijziging — wat was de vraag, wat is aangepast? Ook dit is alleen een weergave: het verandert geen status en vervangt geen beslissing.",
  "vhelp.filters.title": "Zoeken & filteren",
  "vhelp.filters.body":
    "Beperkt de controlelijst op volledige tekst, kennissoort, categorie of trefwoord. Gebruik dit als de lijst lang is en je gericht je vakgebied wilt controleren. Er gaat niets verloren: filters veranderen alleen wat je op dit moment ziet — alle objecten blijven in beoordeling.",
  "vhelp.mineOnly.title": "Alleen aan mij toegewezen",
  "vhelp.mineOnly.body":
    "Toont jouw persoonlijke review-lijst: objecten die iemand bewust aan jou heeft toegewezen. Gebruik dit om eerst het werk te doen waar collega's op wachten. De toewijzing is een verzoek, geen verplichte controle — de beslissing valt pas als je zelf beoordeelt.",
  "vhelp.signals.title": "Review-signalen lezen",
  "vhelp.signals.body":
    'De regel toont hoe betrouwbaar het object NU is: vertrouwensbalk en trust-waarde (uit controlestemmen en bewezen praktijk), versie, „Doel n" (zoveel goedkeuringen zijn er nodig tot GEVALIDEERD), plus markeringen zoals OVERGEDRAGEN (auteur gewisseld — extra blik) of TOEGEWEZEN. Niets daarvan is een beoordeling door jou — het is de eerlijke uitgangssituatie voor jouw beslissing.',
  "vhelp.approve.title": "Goedkeuren",
  "vhelp.approve.body":
    "Je bevestigt na eigen controle: deze uitspraak is vakinhoudelijk juist en zo toepasbaar. Gebruik dit pas als je kernuitspraak, voorwaarden en maatregelen echt hebt beoordeeld — jouw goedkeuring telt als een van meerdere benodigde controlestemmen. Daarna stijgt het vertrouwen van het object; GEVALIDEERD wordt het pas als genoeg beoordelaars hebben goedgekeurd. Er wordt niets automatisch gepubliceerd of gewijzigd — jouw stem wordt geteld, meer niet.",
  "vhelp.query.title": "Vraag stellen",
  "vhelp.query.body":
    "Je vindt de kennis bruikbaar, maar iets is onduidelijk, onvolledig of alleen onder voorwaarden juist. Een korte opmerking is verplicht — het is jouw hulp aan de auteur: wat ontbreekt er precies, wat moet hij aanvullen? Daarna blijft het object in beoordeling en ziet de auteur jouw vraag als opmerking bij het kennisobject. Er wordt niets afgewezen, niets goedgekeurd en niets automatisch gewijzigd — de herziening doet de auteur bewust zelf.",
  "vhelp.reject.title": "Afwijzen",
  "vhelp.reject.body":
    'Je vindt de uitspraak onjuist, verouderd of riskant. Ook hier is de motivatie verplicht — zonder die kan de auteur niets leren en niets corrigeren. Daarna vloeit jouw afwijzing mee in de beoordeling van het object; het wordt daardoor NIET verwijderd en NIET geblokkeerd, maar blijft zichtbaar in beoordeling tot de auteur of controller reageert. Als twee zekere uitspraken elkaar tegenspreken, is „Conflict melden" de betere weg dan een afwijzing.',
  "vhelp.feedbackForm.title": "Motivatie (verplicht)",
  "vhelp.feedbackForm.body":
    "Vraag en afwijzing hebben altijd een motivatie nodig — die wordt als opmerking bij het kennisobject opgeslagen, zichtbaar voor auteur en beoordelaar. Schrijf concreet wat ontbreekt of onjuist is en wat de auteur moet aanvullen. Pas met tekst kun je versturen; annuleren gooit alleen je invoer weg, geen beoordeling.",
  "vhelp.assign.title": "Beoordelaar toewijzen",
  "vhelp.assign.body":
    'Je vraagt een bepaalde collega om de beoordeling van dit object. Die persoon ziet het daarna in haar persoonlijke review-lijst („Aan mij toegewezen") en krijgt een melding via de bel. De toewijzing is een uitnodiging, geen beoordeling: het verandert status noch vertrouwen, en beoordeeld wordt er pas als de persoon zelf beslist.',
  "vhelp.markTrue.title": "Als waar markeren (alleen admin)",
  "vhelp.markTrue.body":
    'Als admin sluit je de validatie van dit object in één stap af — onafhankelijk van de peer-beoordelingen. De status wordt op „gevalideerd" gezet en het vertrouwen naar de hoogste trap getild. Gebruik dit bewust en alleen als je de uitspraak echt kunt verantwoorden, want je slaat daarmee de meervoudige tegencontrole door anderen over. De handeling wordt in het audit-log met jouw naam vastgelegd en kan later via een nieuwe bewerking/revisie weer in beoordeling worden teruggehaald.',
  "vhelp.stillValid.title": "Nog geldig",
  "vhelp.stillValid.body":
    "Je bevestigt dat deze reeds gecontroleerde kennis wat jou betreft nog steeds klopt — een versheidssignaal, geen nieuwe controleprocedure. Gebruik het als je de kennis net hebt toegepast of bewust hebt nagelezen. Daarna wordt de bevestiging met datum vermeld en geldt het object als recent bevestigd. Het vervangt geen peer-controle en heft geen vragen of conflicten op.",
  "vhelp.reportConflict.title": "Conflict melden",
  "vhelp.reportConflict.body":
    "Je geeft aan dat deze kennis een ANDER kennisobject tegenspreekt — bijvoorbeeld twee verschillende grenswaarden voor hetzelfde geval. Daarna verschijnt de kwestie op de conflictenpagina en wordt daar bewust opgelost (tweede mening, escalatie, gedocumenteerde beslissing). Beide objecten blijven ongewijzigd bestaan — er wordt niets automatisch gecorrigeerd, overschreven of verwijderd.",
  "vhelp.conflictForm.title": "Conflict beschrijven",
  "vhelp.conflictForm.body":
    "Drie gegevens maken de melding oplosbaar: het TEGEN-object (waarmee spreekt deze kennis zichzelf tegen?), het CONFLICTTYPE (bijv. tegenspraak in de inhoud of in de bevoegdheid) en een korte BESCHRIJVING van de tegenspraak met jouw context. Na het versturen ontstaat een open conflictzaak — beide objecten blijven als bruikbaar gemarkeerd tot het conflict bewust is opgelost.",
  "vhelp.sourcesLevel2.title": "Externe bronnen (niveau 2)",
  "vhelp.sourcesLevel2.body":
    "Hier hangen externe bewijzen aan het kennisobject: normen, handboeken, artikelen, interne documenten. De badge „Niveau 2\" betekent eerlijk: deze bron is NIET door collega's peer-gecontroleerd — hij ondersteunt de kennis, maar vervangt geen enkele controlestem. Op de vragenpagina telt een niveau-2-bron daarom niet als controlestem; hij kan een antwoord ondersteunen, maar niet borgen. Het kruisje verwijdert alleen de koppeling — kennis, status en vertrouwen blijven ongewijzigd.",
  "vhelp.sourceFields.title": "Bron beschrijven",
  "vhelp.sourceFields.body":
    'Drie gegevens maken een bron bruikbaar: de BENAMING zegt wat het is („DIN EN 1090, hoofdstuk 7"), de URL leidt ernaartoe (leeg laten bij papieren of interne bronnen), het CITAAT haalt de ene doorslaggevende passage woordelijk aan — zo hoeft niemand het hele document te lezen om de uitspraak te controleren. Hoe concreter het citaat, hoe meer de bron de beoordelaars helpt.',
  "vhelp.sourceAdd.title": "Bron toevoegen",
  "vhelp.sourceAdd.body":
    "Hangt de beschreven bron als niveau-2-bewijs aan dit kennisobject. Hij blijft over versies heen bewaard en is voor iedereen zichtbaar. Er gebeurt verder niets automatisch: de inhoud van de bron wordt niet in de kennis overgenomen, niet gecontroleerd en niet beoordeeld — hij staat als bewijs ernaast.",
  "vhelp.sourceSearch.title": "Bronnen zoeken",
  "vhelp.sourceSearch.body":
    'Zoekt naar externe bewijzen over dit onderwerp. Het zoeken loopt via de KLARWERK-server — je aanvraag gaat niet rechtstreeks van je browser naar externe diensten. De treffers zijn vrijblijvende suggesties: niets daarvan wordt automatisch aangehangen. Controleer titel en fragment, open in geval van twijfel de link — en pas „Aanhangen" neemt een treffer bewust over als niveau-2-bron.',
  "vhelp.contribution.title": "Bijdrage of vindplaats melden",
  "vhelp.contribution.body":
    'Ken je een aanvulling, correctie of vindplaats, maar wil je niet zelf aan het object werken? Beschrijf het hier — je tip wordt als opmerking bij het kennisobject opgeslagen, zichtbaar voor auteur en beoordelaar. Anders dan bij „Bron toevoegen" ontstaat hierbij GEEN bronvermelding; het is een bericht aan de mensen, geen bewijs bij het object.',
  "vhelp.helpful.title": "Heeft geholpen",
  "vhelp.helpful.body":
    "Een praktijksignaal van bewezen waarde: je hebt deze kennis toegepast en het werkte. Dat versterkt het vertrouwen van het object een stukje en wordt in het verloop vermeld. Het is GEEN controlestem — validatie ontstaat nog steeds alleen door bewuste controlebeslissingen van collega's.",
  "vhelp.validity.title": "Geldigheid & bescherming",
  "vhelp.validity.body":
    "Deze waarden worden eerlijk uit de huidige toestand AFGELEID, niet opgeslagen: versheid (wanneer voor het laatst bevestigd of gewijzigd), output-geschiktheid (mag deze kennis in gegenereerde documenten?) en een aanbeveling wat als volgende stap zinvol is. Wijzigen kun je ze alleen indirect — door de kennis zelf te controleren, te bevestigen of te herzien.",
  "vhelp.transfer.title": "Auteur overdragen",
  "vhelp.transfer.body":
    "Draagt de verantwoordelijkheid voor deze kennis over aan een andere persoon — bijvoorbeeld als iemand het bedrijf verlaat of de bevoegdheid wisselt. De oorspronkelijke auteur blijft blijvend zichtbaar (herkomst gaat nooit verloren). Overgedragen objecten krijgen in de review een extra blik, omdat de kennis nu iemand verantwoordt die het niet zelf heeft vastgelegd.",
  "vhelp.deleteKo.title": "Kennisobject verwijderen",
  "vhelp.deleteKo.body":
    "Verwijdert dit kennisobject definitief — alleen toegestaan voor de auteur zelf en voor controller en admin; de server dwingt dezelfde regel af. Vóór het verwijderen vraagt de inline-bevestiging bewust na. De verwijdering wordt in de audit vastgelegd. Als de kennis alleen verouderd is, is herzien of een conflict de eerlijkere weg dan verwijderen.",
  "vhelp.conflictEscalate.title": "Escaleren",
  "vhelp.conflictEscalate.body":
    "Tilt een open inhoudelijk conflict een trap hoger als de betrokkenen het niet zelf kunnen oplossen — dan beslist de vakinhoudelijk bevoegde instantie. Gebruik dit als twee gevalideerde uitspraken elkaar hard tegenspreken en geen van beide kan toegeven. Het conflict blijft open en zichtbaar tot een gedocumenteerde beslissing valt.",
  "vhelp.conflictSecondOpinion.title": "Tweede mening inwinnen",
  "vhelp.conflictSecondOpinion.body":
    "Vraagt nog een deskundige om zijn inschatting van het conflict en legt die schriftelijk vast. Een goede tweede mening noemt feiten en bronnen, niet alleen een onderbuikgevoel. Ze beslist het conflict niet automatisch — ze is materiaal voor de latere oplossing.",
  "vhelp.conflictResolve.title": "Conflict oplossen",
  "vhelp.conflictResolve.body":
    "Legt de beslissing vast hoe met de tegenspraak om te gaan — welke uitspraak geldt, onder welke voorwaarden, en waarom. De oplossing DOCUMENTEERT alleen: ze wijzigt geen van de betrokken kennisobjecten automatisch. Als een object daarna herzien of opnieuw bevestigd zou moeten worden, toont de app een hervalidatie-aanbeveling — ook dat blijft een bewuste menselijke handeling.",
  "chelp.modes.title": "De vier vertelwegen",
  "chelp.modes.body":
    "Vier wegen leiden naar hetzelfde doel: VRIJE TEKST (gewoon losschrijven), DICTEREN (spreken in plaats van typen), INTERVIEW (de KI stelt je gerichte vragen) en UIT BESTAND (kennispunten uit een document halen). Kies wat voor jou natuurlijk aanvoelt — alle wegen monden uit in hetzelfde concept op de kennispagina, en bij het wisselen gaat niets verloren.",
  "chelp.expertPath.title": "Formulier direct (expertpad)",
  "chelp.expertPath.body":
    "Het klassieke formulier met alle velden in één oogopslag — voor iedereen die precies weet wat hij wil invullen. Het is dezelfde datastand als de begeleide weg, geen extra functie en geen sluiproute langs de controle. De terugweg naar de begeleide weg is altijd één klik verwijderd.",
  "chelp.wizardSteps.title": "De drie stappen",
  "chelp.wizardSteps.body":
    "Vastleggen verloopt in drie stappen: SCHRIJVEN (titel en tekst op het blad — of via „Bestand” als interview, uit een bestand of in het formulier; „Dicteren” schrijft mee), OPSLAAN (als concept, alleen voor jou zichtbaar) en INDIENEN (in de peer-beoordeling geven). Je kunt altijd verder schrijven — daarbij gaat niets verloren. Pas het indienen maakt van je concept een kennisobject voor de collega's.",
  "chelp.loadExample.title": "Voorbeeld laden",
  "chelp.loadExample.body":
    "Vult de velden met een demovoorbeeld, zodat je de volledige weg gevaarloos kunt uitproberen. Let op: het overschrijft je huidige invoer — gebruik het op een lege pagina. Ook een voorbeeld wordt pas ingediend als je het bewust indient.",
  "chelp.tellRaw.title": "Gewoon vertellen",
  "chelp.tellRaw.body":
    "Schrijf je kennis op zoals je die aan een nieuwe collega zou vertellen — ongeordend is helemaal prima. Structuur (titel, kernuitspraak, voorwaarden, maatregelen) maakt de KI in de volgende stap als VOORSTEL, dat je controleert en aanpast. Er wordt niets automatisch opgeslagen of ingediend.",
  "chelp.dictate.title": "Dicteren",
  "chelp.dictate.body":
    "Spreken in plaats van typen: je browser zet spraak lokaal om in tekst, die hier in het veld stroomt. Start en stop bewust; daarna kun je de tekst gewoon corrigeren. Kan je browser geen spraakherkenning, dan zegt de app je dat eerlijk in plaats van stilletjes te falen.",
  "chelp.tellUpload.title": "Bestand bijvoegen bij het vertellen",
  "chelp.tellUpload.body":
    "Upload je hier documenten (PDF, Word, tekst), dan stroomt hun tekst rechtstreeks in je vertelveld; afbeeldingen en video's worden bijlagen van het latere kennisobject. Bij afbeeldingen start tekstherkenning (OCR) alleen op jouw klik. Er wordt niets geüpload dat je niet ziet — alles blijft onderdeel van je concept.",
  "chelp.structureNow.title": "Structuur voorstellen",
  "chelp.structureNow.body":
    "De KI leest je ruwe tekst en stelt titel, kernuitspraak, voorwaarden en maatregelen voor — als CONCEPT op de kennispagina, paars gemarkeerd. Ze verzint er niets bij; zonder KI-sleutel werkt een eerlijk, regelgebaseerd alternatief en zegt dat duidelijk. Jij controleert, wijzigt en beslist — automatisch opgeslagen wordt er nooit.",
  "chelp.interview.title": "Het kennis-interview",
  "chelp.interview.body":
    "De KI stelt je de ene vraag na de andere en boort gericht door — naar grenswaarden, uitzonderingen, redenen. Antwoord in je eigen woorden (typen of dicteren); de vraag kun je je laten voorlezen. Pas als je het interview afsluit, wordt uit alle antwoorden een concept voor de kennispagina gebouwd — niets daarvan is vooraf opgeslagen.",
  "chelp.filePoints.title": "Kennis uit bestand",
  "chelp.filePoints.body":
    "Je uploadt een document, de KI haalt daaruit afzonderlijke kennispunten — elk MET woordelijke bewijsplaats uit het document (verzonnen punten zijn daarmee uitgesloten; vindt ze niets onderbouwds, dan zegt ze dat eerlijk). Je kiest met vinkjes wat wordt overgenomen: alleen geselecteerde punten worden concepten. Als alternatief kun je een zoekopdracht aan een expert formuleren.",
  "chelp.captureTitle.title": "De titel",
  "chelp.captureTitle.body":
    "De titel is het eerste wat collega's in bibliotheek en antwoorden zien — hij bepaalt of je kennis wordt gevonden. Goed: concreet en actiegericht („Lasnaad bij aluminium onder 5 mm controleren\"). Je kunt hem altijd wijzigen, ook het KI-voorstel is maar een startpunt.",
  "chelp.saveDraftHelp.title": "Concept opslaan",
  "chelp.saveDraftHelp.body":
    "Bewaart je tussenstand privé op de server — je kunt altijd verdergaan, op elk van je apparaten en ook na een herstart. Een concept is NIET ingediend: alleen jij ziet het, en het duikt in geen enkele beoordeling en geen enkel antwoord op. Je opgeslagen concepten vind je om verder te gaan onder „Meer” → Concepten en in het menu onder Mijn concepten.",
  "chelp.discardHelp.title": "Verwerpen",
  "chelp.discardHelp.body":
    "Verwerpt de huidige invoer — tekst, structuur en bijlagen van deze vastlegging. Het betreft ALLEEN deze invoer: reeds ingediende kennisobjecten en opgeslagen concepten blijven onaangetast. Vooraf vraagt de app bewust na.",
  "chelp.submitReview.title": "Controleren & indienen",
  "chelp.submitReview.body":
    "Maakt van je concept een kennisobject en geeft het in de peer-beoordeling: collega's controleren, stellen vragen of keuren goed. Vanaf nu is het voor anderen zichtbaar — maar eerlijk als „in beoordeling\" gemarkeerd, NIET als zeker. Gevalideerd wordt het door genoeg goedkeuringen. Voor antwoorden bruikbaar is het al eerder — maar dan zichtbaar als ongecontroleerd gemarkeerd.",
  "chelp.readiness.title": "Opslag-check",
  "chelp.readiness.body":
    "Toont eerlijk wat er voor het indienen nog ontbreekt: verplichte velden (zonder die blijft de knop uit) en optionele zaken die je kennis versterken (bijv. categorie of bijlagen). Groen betekent gereed — niet perfect: verbeteren kun je ook na het indienen nog, dan als nieuwe versie.",
  "chelp.savedNext.title": "Opgeslagen — wat nu?",
  "chelp.savedNext.body":
    "Je kennis is als object aangelegd en wacht op de peer-beoordeling — het is ZICHTBAAR, maar eerlijk als open gemarkeerd, niet als zeker. Je hoeft verder niets te doen: beoordelaars vinden het op het validatie-board. Wil je het bekijken of aanvullen, dan leidt de link er direct heen.",
  "chelp.advancedDetails.title": "Uitgebreide details",
  "chelp.advancedDetails.body":
    "Alles hier is OPTIONEEL — je kennis wordt ook zonder ingediend. Toch loont het: categorie en trefwoorden maken het vindbaar, de installatie koppelt het aan machines/objecten, het controle-aantal stuurt hoeveel goedkeuringen nodig zijn, documenten en afbeeldingen leveren bewijsmateriaal. De badge toont hoeveel er al is ingevuld.",
  "chelp.knowledgeType.title": "Kennissoort",
  "chelp.knowledgeType.body":
    'Deelt je kennis in: ervaringskennis, proceskennis, feitenkennis — en bijzonder waardevol: NEGATIEVE KENNIS („dat hebben we geprobeerd, het werkt NIET, omdat …"). De kennissoort helpt beoordelaars en zoekers je kennis juist in te delen; ze verandert niets aan de controleweg.',
  "chelp.assetField.title": "Installatie / object",
  "chelp.assetField.body":
    'Koppelt je kennis aan een concrete installatie, machine of een object („Pers 3", „Klant XY"). Verandert er later iets aan deze installatie, dan vindt de levenscyclus precies de gekoppelde kennisobjecten voor controle. Vrije tekst volstaat — als collega\'s de installatie maar herkennen.',
  "chelp.tagsField.title": "Trefwoorden",
  "chelp.tagsField.body":
    'Korte steekwoorden waarmee je kennis in zoeken en filters opduikt („aluminium", „termijn", „hygiëne"). Gebruik termen waar collega\'s echt op zouden zoeken, en blijf consistent met bestaande trefwoorden. Ze zijn altijd te wijzigen en beïnvloeden de controle niet.',
  "chelp.docsImages.title": "Documenten & afbeeldingen",
  "chelp.docsImages.body":
    "Hangt bewijsmateriaal aan je kennis: foto's van het resultaat, het controleprotocol, de werkinstructie. Bijlagen gaan bij het indienen mee naar het kennisobject en zijn daar voor beoordelaars zichtbaar. Hun inhoud wordt niet automatisch kennis — wat in de tekst moet, beslis jij.",
  "chelp.expertForm.title": "Het expertformulier",
  "chelp.expertForm.body":
    "Hier vul je alle velden direct in: titel, kennissoort, inhoud, kernuitspraak, voorwaarden (wanneer geldt het?) en maatregelen (wat moet er gebeuren?). Dezelfde regels gelden als in de begeleide weg — dezelfde opslag-check, dezelfde controle. De KI helpt desgewenst aan de tekst, maar beslist niets.",
  "chelp.sourcesPanel.title": "Externe bronnen (niveau 2)",
  "chelp.sourcesPanel.body":
    "Hangt externe bewijzen aan je kennis — norm, handboek, fabrikantpagina. Met de hand (benaming, link, citaat) of via het bronnen-zoeken, net als in het controlegebied. Bij het vastleggen verzamel je ze in een zichtbare wachtlijst; aangehangen worden ze pas bij het indienen, samen met je kennisobject. Belangrijk: externe bronnen zijn niveau 2 — ze gelden nooit als peer-gevalideerd en vervangen geen controle door collega's. Er wordt niets automatisch overgenomen.",
  "capture.sourcesTitle": "Externe bronnen",
  "capture.sourcesHint":
    "Bronnen belanden eerst in deze wachtlijst. Bij het indienen worden ze aan het opgeslagen kennisobject gehangen — als niveau 2, nooit peer-gevalideerd.",
  "xtr.title": "Uit document aanvullen",
  "xtr.hint":
    "Upload nog een document — de KI leest het en stelt kennispunten MET bewijsplaats voor. Alleen wat je aankruist, wordt als sectie aan het einde van je artikel toegevoegd; niets wordt vervangen.",
  "xtr.applyCta": "Geselecteerde toevoegen",
  "xtr.applying": "{{count}} punt(en) worden overgenomen — inhoud en herkomst samen …",
  "xtr.appended":
    '{{count}} punt(en) uit „{{name}}" overgenomen — inhoud EN herkomst zijn samen opgeslagen; bestaande inhoud bleef ongewijzigd.',
  "xtr.append.button": "Aan bestaand artikel toevoegen",
  "xtr.append.title": "Aan bestaand artikel toevoegen",
  "xtr.append.intro":
    '{{count}} geselecteerde inzicht(en) uit „{{name}}" als sectie aan een bestaand artikel toevoegen. Het doelartikel wordt herzien (daarna opnieuw te beoordelen); de bron wordt per punt vermeld.',
  "xtr.append.searchPlaceholder": "Artikel zoeken (titel) …",
  "xtr.append.none": "Geen passend artikel gevonden.",
  "xtr.append.busy": "Wordt toegevoegd …",
  "xtr.append.done":
    '{{count}} inzicht(en) aan „{{title}}" toegevoegd — het artikel is nu opnieuw te beoordelen.',
  "xtr.append.missingAnchor":
    "Zonder het originele document als bewijs wordt de inhoud niet overgenomen. Het artikel is NIET gewijzigd. Dat geldt ongeacht de instelling „Externe kennis“: overgenomen documentinhoud moet aan zijn origineel hangen.",
  "xtr.append.blockedByStage":
    "Op het ingestelde niveau „Externe kennis“ mag deze bron niet aan een kennisobject worden gehangen. Het artikel is NIET gewijzigd. Een beheerder kan het niveau wijzigen onder Beheer → Externe kennis.",
  "xtr.append.unclear":
    "De uitkomst is onduidelijk — de verbinding brak af voordat de server antwoordde. Er is NIETS teruggenomen: de overname kan wel of niet zijn voltooid. Open het artikel en kijk na; opnieuw proberen met dezelfde bewerking legt niets dubbel aan.",
  "xtr.append.stateUnchanged":
    "Het artikel is NIET gewijzigd — er is geen inhoud zonder herkomst opgeslagen. Je kunt het overnemen gewoon opnieuw proberen.",
  "xtr.append.followUpsFailed":
    "De overname is opgeslagen (inhoud en herkomst). Een vervolgstap liep niet: {{steps}}. De nieuwe KI-controle kan daardoor ontbreken — die kan op de validatiepagina opnieuw worden gestart.",
  "xtr.help.title": "Uit document aanvullen",
  "xtr.help.body":
    "De KI leest een door jou geüpload document en stelt kennispunten voor — elk punt draagt zijn bewijsplaats uit het document (zonder bewijs geen overname). Je kiest met vinkjes; het geselecteerde wordt als sectie aan je artikel TOEGEVOEGD, niets wordt vervangen of overschreven. De herkomst (bestandsnaam + bewijsplaats) wordt als niveau-2-bron bij het kennisobject vermeld — het geldt niet als peer-gevalideerd en vervangt geen controle.",
  "fd.kicker": "Vastleggen",
  "fd.title": "Documenteditor",
  "fd.backToCapture": "Terug naar kennis vastleggen",
  "fd.allModes": "Alle vastleg-modi",
  "fd.submitted": "Ter beoordeling ingediend:",
  "fd.submittedBody":
    "De editor is afgerond en geleegd. Opslaan of opnieuw indienen van dezelfde inhoud is geblokkeerd; een nieuwe vermelding start alleen bewust via de knop.",
  "fd.openValidation": "Validatie openen",
  "fd.viewObject": "Object bekijken",
  "fd.newEntry": "Nieuwe vermelding",
  "fd.titleOptional": "Titel optioneel",
  "fd.content": "Inhoud",
  "fd.draftLoading": "Concept wordt geladen ...",
  "fd.draftOpen": "Voordeur-concept geopend. Wijzigingen blijven in dit concept.",
  "fd.editorPlaceholder":
    "Beschrijf hier je kennis zoals je die aan een collega zou uitleggen — de KI structureert daaruit een concept, dat je controleert en indient.",
  "fd.structureSuggest": "KI-structuur voorstellen",
  "fd.needContentFirst": "Schrijf eerst inhoud, dan kan er een voorstel worden gegenereerd.",
  "fd.optionalAiHint": "Optioneel KI-voorstel. Er wordt niets automatisch opgeslagen.",
  "fd.aiHelp": "KI-hulp",
  "fd.aiHelpApply": "KI-hulp toepassen",
  "fd.aiHelpModes": "Verduidelijken, structureren, uitbreiden, spelling of opmaken.",
  "fd.structureGenerating": "KI-voorstel wordt gegenereerd ...",
  "fd.assistGenerating": "KI-hulp-voorstel wordt gegenereerd ...",
  "fd.originalUnchanged": "Originele tekst blijft ongewijzigd.",
  "fd.structureAccepted":
    "KI-voorstel overgenomen. Controleer het; opgeslagen wordt er pas bij je volgende actie.",
  "fd.structureKeptRichBodyTitle":
    "Structuurvoorstel: titel overgenomen. De opgemaakte inhoud met afbeeldingen en opmaak blijft ongewijzigd behouden.",
  "fd.structureKeptRichBodyNoTitle":
    "De opgemaakte inhoud blijft behouden; het structuurvoorstel is niet in de inhoud overgenomen.",
  "fd.structureRichTitleOnly":
    "Opgemaakte inhoud met afbeeldingen blijft behouden — de AI stelt alleen een titel voor.",
  "fd.assistAccepted":
    "KI-hulp overgenomen. Controleer het; opgeslagen wordt er pas bij je volgende actie.",
  "fd.aiProposal": "KI-voorstel",
  "fd.aiProposalCheck": "KI-gegenereerd. Controleer voordat je iets overneemt.",
  "fd.fallback": "Fallback",
  "fd.fallbackNoModel":
    "KI is niet geconfigureerd of uitgeschakeld — dit voorstel is een eenvoudige automatische afleiding, geen modelantwoord.",
  "fd.fallbackModelError":
    "KI meldde een fout of was niet bereikbaar — dit voorstel is een eenvoudige automatische afleiding, geen modelantwoord.",
  "fd.fallbackModelTimeout":
    "KI antwoordde niet op tijd (time-out) — dit voorstel is een eenvoudige automatische afleiding, geen modelantwoord.",
  "fd.fallbackConfidential":
    "De tekst is als vertrouwelijk aangemerkt — de cloud-KI is daarvoor uitgesloten en er is geen lokaal model aangesloten. Dit voorstel is een eenvoudige automatische afleiding, geen modelantwoord.",
  "fd.fieldTitle": "Titel",
  "fd.fieldStatement": "Uitspraak / kernuitspraak",
  "fd.fieldConditions": "Voorwaarden",
  "fd.noConditions": "Geen voorwaarden voorgesteld.",
  "fd.fieldMeasures": "Maatregelen",
  "fd.noMeasures": "Geen maatregelen voorgesteld.",
  "fd.fieldTags": "Aanwijzingen / tags",
  "fd.aiHelpProposal": "KI-hulp-voorstel",
  "fd.assistProposalCheck": "{{action}}: KI-gegenereerd. Controleer voordat je iets overneemt.",
  "fd.accept": "Overnemen",
  "fd.discardProposal": "Voorstel verwerpen",
  "fd.submitReview": "Controleren & indienen",
  "fd.saveDraft": "Als concept opslaan",
  "fd.discardInput": "Invoer verwerpen",
  "fd.back": "Terug",
  "fd.writeToSubmit": "Schrijf of plak inhoud, dan kun je controleren en indienen.",
  "fd.validate.lead": "Indienen is zo nog niet mogelijk:",
  "fd.validate.needBody": "De inhoud is leeg. Om in te dienen heeft het kennisobject tekst nodig.",
  "fd.validate.hint": "Je kunt de lege stand nog steeds als concept opslaan en later voortzetten.",
  "fd.unsavable.proposal":
    "Het weergegeven KI-voorstel is nog niet overgenomen en wordt niet meegeslagen.",
  "fd.unsavable.confidentialityOnly":
    "De gekozen vertrouwelijkheid zonder titel en zonder inhoud — daarvoor bestaat nog geen concept dat die kan vasthouden.",
  "fd.statusLabel": "Status",
  "fd.titleOnSave": "Titel bij het opslaan",
  "fd.author": "Auteur",
  "fd.whatOnSave": "Wat er bij het opslaan gebeurt",
  "fd.whatOnSaveBody":
    "Wordt als concept bewaard — altijd voort te zetten. Ter beoordeling gaat het pas als je „Indienen” kiest; er wordt niets automatisch gevalideerd.",
  "fd.moreWays": "Meer vastleg-wegen",
  "fd.moreWaysBody":
    "Heb je het klassieke formulier, dictaat of het begeleide interview nodig? Het volledige vastleg-gebied heeft alle wegen — dit vlak hier is de snelle instap.",
  "fd.options.show": "Meer invoeropties tonen",
  "fd.options.hide": "Meer invoeropties inklappen",
  "fd.options.hint.freitext":
    "Vertel vrijuit; de AI maakt er een structuurvoorstel van dat jij controleert.",
  "fd.options.hint.diktat": "Spreken in plaats van typen — de tekst komt in hetzelfde vertelveld.",
  "fd.options.hint.interview": "Begeleide vervolgvragen als je niet weet waar je moet beginnen.",
  "fd.options.hint.datei": "Kennis uit een bestaand bestand overnemen.",
  "fd.options.hint.formular": "Expertmodus: dezelfde velden direct invullen, zonder vertelstap.",
  "fd.toastSaved": "Concept opgeslagen.",
  "fd.saved.line": "Concept opgeslagen: {{titel}} — je schrijft hier verder in dit concept.",
  "fd.saved.toDrafts": "Mijn concepten",
  "fd.toastSubmitted": "Ter beoordeling ingediend.",
  "fd.confirmDiscard": "Invoer verwerpen? Niet-opgeslagen inhoud gaat verloren.",
  "fd.confirmOpenDraft":
    "Een ander concept openen? De niet-opgeslagen inhoud van dit blad wordt vervangen.",
  "fd.errSaveFailed": "Opslaan mislukt.",
  "fd.errLoadFailed": "Het concept kon niet worden geladen. Er is niets opgeslagen.",
  "erfassen.laden.nichtBereit":
    "Het concept wordt opgehaald. Tot het er is, neemt dit blad niets aan — anders zou de geladen tekst overschrijven wat jij hebt geschreven.",
  "fd.draftStale":
    "Dit concept is intussen elders gewijzigd — bijvoorbeeld in een tweede tabblad. Jouw versie hier is NIET opgeslagen en er is niets overschreven. „Opnieuw laden“ haalt de andere versie op; wat je hier hebt getypt gaat daarbij verloren — kopieer het eerst als je het wilt bewaren.",
  "fd.draftStaleReload": "Opnieuw laden",
  "fd.errAssist": "Ik kan deze KI-hulp op dit moment niet betrouwbaar uitvoeren.",
  "fd.errSpelling": "Spellingcontrole kan de opmaak op dit moment niet zeker behouden.",

  // JOB 3062 · H3 — het blad (Pages).
  "erfassen.werkzeug.diktieren": "Dicteren",
  "sprachaufnahme.start": "Opnemen",
  "sprachaufnahme.stop": "Opname stoppen",
  "sprachaufnahme.frage": "Vraag opnemen en uitschrijven",
  "sprachaufnahme.verarbeitet": "Wordt uitgeschreven …",
  "sprachaufnahme.keinMikrofon":
    "Geen toegang tot de microfoon. Sta het toe in de browser of typ de tekst.",
  "sprachaufnahme.fehler": "De opname kon niet worden uitgeschreven.",
  "erfassen.werkzeug.bild": "Beeld",
  "erfassen.werkzeug.datei": "Bestand",
  "erfassen.werkzeug.ki": "AI",
  "erfassen.werkzeug.bereich": "Gebied",
  "erfassen.werkzeug.vertraulichkeit": "Vertrouwelijkheid",
  "erfassen.werkzeug.hilfe": "?",
  "erfassen.werkzeug.mehr": "Meer",
  "erfassen.weg.datei": "Bestand importeren",
  "erfassen.weg.interview": "Interview voeren",
  "erfassen.weg.formular": "Formulier (experts)",
  "erfassen.ki.struktur": "Structuur voorstellen",
  "erfassen.ki.pille": "AI",
  "erfassen.mehr.entwuerfe": "Concepten",
  "erfassen.mehr.anhaenge": "Bijlagen",
  "erfassen.mehr.status": "Status",
  "erfassen.mehr.beispiel": "Voorbeeld bekijken",
  "erfassen.mehr.klara": "Klara in Word",
  "erfassen.mehr.zurueck": "Terug",
  "erfassen.bereich.leeren": "Geen gebied",
  "erfassen.entwuerfe.keine": "Nog geen concepten.",
  "erfassen.anhaenge.keine": "Nog geen bijlagen in de tekst.",
  "erfassen.anhaenge.anzahl": "{{n}} beeld(en) in de tekst.",
  "erfassen.anhaenge.verwalten": "Bijlagen beheren",
  "erfassen.beispiel.keins": "Er is nog geen passend voorbeeld in de voorraad.",
  "erfassen.platzhalter.titel": "Titel",
  "erfassen.platzhalter.text": "Tekst",
  "erfassen.entwurfSichern": "Concept opslaan",
  "erfassen.einreichen": "Indienen",
  "erfassen.eingereicht": "Ingediend:",
  "erfassen.live.aehnlich": "Lijkt op:",
  "erfassen.live.widerspruch": "Kan tegenspreken:",
  "erfassen.live.neu": "Dit is nieuw",
  "erfassen.status.livePruefung": "Live-controle",
  "erfassen.hilfe.bilder": "Afbeeldingen invoegen",
  "erfassen.erneutVersuchen": "Opnieuw proberen",
  "dcmp.kicker": "Read-only vergelijking",
  "dcmp.titleDuplicate": "Duplicaten vergelijken",
  "dcmp.titleConflict": "Conflict vergelijken",
  "dcmp.back": "Terug",
  "dcmp.loading": "Vergelijking wordt geladen.",
  "dcmp.loadError": "Vergelijking kon niet worden geladen.",
  "dcmp.notFound": "Vergelijking niet gevonden of al gesloten.",
  "dcmp.textSimilarity": "Tekstgelijkenis",
  "dcmp.noProvenContradiction": "geen bewezen tegenspraak — alleen woord-/veldgelijkenis",
  // REVIEW26 (JOB 3469): de brugzin; alleen zichtbaar bij werkelijk verschillende metrieken.
  "dcmp.metricBridge":
    "Hetzelfde paar, twee metingen: het bord „Duplicaten“ toont {{board}}, hier staat {{compare}}. Geen tegenspraak — beide getallen meten iets anders.",
  "dcmp.moreValues": "Meer waarden",
  "dcmp.uncertainty": "Onzekerheid",
  "dcmp.textDifference": "Tekstverschil",
  "dcmp.similarity": "Gelijkenis",
  "dcmp.scoresHint": "Scores zijn een beslissingshulp, geen waarheid. Geen automatische merge.",
  "dcmp.viewDetails": "Details bekijken",
  "dcmp.objectRemoved": "Object verwijderd",
  "dcmp.left": "Links",
  "dcmp.right": "Rechts",
  "dcmp.koA": "Kennisobject A",
  "dcmp.koB": "Kennisobject B",
  "dcmp.sectionSignals": "Sectiestoplichten",
  "dcmp.compareByAreas": "Vergelijking per kennisgebied",
  "dcmp.legendHelpTitle": "Wat betekenen de stoplichtkleuren?",
  "dcmp.legendHelpBody":
    "Elke sectie krijgt een kleur uit de tekstvergelijking: groen = de inhoud komt grotendeels overeen, geel = gedeeltelijk of onduidelijk (nauwkeuriger bekijken), rood = de teksten wijken af. Rood betekent alleen verschil, geen bewezen tegenspraak — de kleuren zijn een leeshulp, geen oordeel, en er wordt niets automatisch samengevoegd.",
  "dcmp.onlyForComparison":
    "Alleen ter vergelijking: er wordt niets samengevoegd, verwijderd of gevalideerd, en geen beslissing wordt opgeslagen.",
  // JOB 3671 — paginahulp van de vergelijkingspagina. Ze VERWIJST naar de bestaande kleurenlegenda
  // in plaats van die te herhalen; de titel van de legenda komt als {{legende}} mee.
  "dcmp.seitenhilfe.titel": "Vergelijken, niet beslissen",
  "dcmp.seitenhilfe.text":
    "Hier staan dezelfde twee objecten als op het bord tegenover elkaar; op smalle vensters onder elkaar — de bovenste kaart is die welke in de vergelijking veld voor veld „Links“ heet. In de uitklapper „{{mehr}}“ staan gelijkenis, onzekerheid, tekstverschil en die veldvergelijking; wat de drie stoplichtkleuren betekenen, legt daar de legenda „{{legende}}“ uit — dat wordt hier niet herhaald. Op deze pagina wordt niets opgeslagen: ze voegt niet samen, verwijdert niet, valideert niet en houdt geen beslissing vast. Verkeerd doen kun je hier dus niets; beslist wordt op het bord „{{brett}}“, en het tabblad met dezelfde naam bovenaan leidt daarheen terug.",
  "dcmp.sourceDuplicate": "Duplicaatvergelijking: {{relation}}",
  "dcmp.sourceConflict": "Conflictvergelijking: {{type}}",
  "dcmp.sectionCompareUnavailable":
    "Sectievergelijking niet mogelijk, omdat een kennisobject ontbreekt.",
  "dcmp.relation.identisch": "identiek",
  "dcmp.relation.a_enthaelt_b": "A bevat B",
  "dcmp.relation.b_enthaelt_a": "B bevat A",
  "dcmp.relation.teilweise": "gedeeltelijke overlap",
  "dcmp.relation.verwandt": "verwant",
  "dcmp.conflictType.truth": "waarheidsconflict",
  "dcmp.conflictType.experience": "ervaringsconflict",
  "dcmp.conflictType.context": "contextconflict",
  "dcmp.conflictType.temporal": "tijdsconflict",
  "dcmp.conflictType.role": "rolconflict",
  "dcmp.tone.green.label": "Overeenkomst",
  "dcmp.tone.green.meaning": "Tekst en velden komen grotendeels overeen.",
  "dcmp.tone.yellow.label": "Onzeker",
  "dcmp.tone.yellow.meaning": "Gedeeltelijk of onduidelijk — nauwkeuriger bekijken.",
  "dcmp.tone.red.label": "Verschil",
  "dcmp.tone.red.meaning": "Tekst wijkt af — alleen een verschil, geen bewezen tegenspraak.",
  "dcmp.section.title": "Titel",
  "dcmp.section.statement": "Kernuitspraak / inhoud",
  "dcmp.section.conditions": "Voorwaarden",
  "dcmp.section.measures": "Maatregelen",
  "dcmp.section.hints": "Aanwijzingen",
  "dcmp.section.sources": "Bronnen / bewijs",
  "dcmp.section.tags": "Tags / categorie",
  "dcmp.section.trust": "Vertrouwen / validatiestatus",
  "dcmp.note.bothEmpty":
    "Voorlopige veldheuristiek; geen echte detector-scores voor dit onderdeel.",
  "dcmp.note.exactMatch": "Voorlopige veldheuristiek; exacte veldovereenkomst.",
  "dcmp.note.oneMissing": "Voorlopige veldheuristiek; één waarde ontbreekt.",
  "dcmp.note.heuristic": "Voorlopige veldheuristiek; geen inhoudelijk oordeel.",
  "dcmp.note.noScore":
    "Geen score beschikbaar: totaalwaarden zijn een voorlopige veldheuristiek zonder detector-percentages.",
  "dcmp.note.mixedOverlap":
    "Overeenkomst uit de bestaande detector; conflict/onzekerheid blijven een voorlopige weergavehulp.",
  "dcmp.note.mixedConflict":
    "Conflictwaarde uit de bestaande detector; overeenkomst blijft een voorlopige veldheuristiek.",
  "dcmp.reason.bothEmpty": "Beide kanten hebben geen bruikbare waarde.",
  "dcmp.reason.identical": "De waarden zijn identiek.",
  "dcmp.reason.oneMissing": "Eén waarde ontbreekt, daarom is er geen echt conflict af te leiden.",
  "dcmp.reason.strongDiff":
    "De veldwaarden verschillen sterk en moeten vakinhoudelijk worden gecontroleerd.",
  "dcmp.reason.partialDiff":
    "De veldwaarden verschillen gedeeltelijk en moeten worden gecontroleerd.",
  "cfd.fallbackTitle": "Naamloos kennisobject",
  "cfd.structuringUnavailable": "Ik kan dit op dit moment niet betrouwbaar ordenen.",

  // AUFTRAG-mega61: rechtspagina's, kennisgevingsbanner, AI-transparantie. Betekenisgetrouwe
  // vertaling van de Duitse bron, die juridisch maatgevend blijft.
  "legal.pending": "— wordt aangevuld —",
  "legal.tbd.company": "— wordt aangevuld —",
  "legal.tbd.address": "— wordt aangevuld —",
  "legal.tbd.representative": "— wordt aangevuld —",
  "legal.tbd.email": "— wordt aangevuld —",
  "legal.tbd.phone": "— wordt aangevuld —",
  "legal.tbd.register": "— wordt aangevuld —",
  "legal.tbd.vatId": "— wordt aangevuld —",
  "legal.tbd.responsible": "— wordt aangevuld —",
  "legal.tbd.supervisoryAuthority": "— wordt aangevuld —",
  "legal.tbd.dataProtectionContact": "— wordt aangevuld —",
  "legal.tbd.dataProtectionOfficer": "— wordt aangevuld —",
  "legal.tbd.retention": "— wordt aangevuld —",
  "legal.tbd.serverLogs": "— wordt aangevuld —",
  "legal.tbd.modelProvider": "— wordt aangevuld —",
  "legal.tbd.mailProvider": "— wordt aangevuld —",
  "legal.tbd.hostingProvider": "— wordt aangevuld —",
  "legal.tbd.thirdCountry": "— wordt aangevuld —",
  "legal.tbd.version": "— wordt aangevuld —",

  "legal.draftNotice.title": "Conceptversie",
  "legal.draftNotice.body":
    "Deze toepassing bevindt zich in een gesloten testfase en is niet openbaar toegankelijk. De nog openstaande gegevens worden vóór publicatie aangevuld.",
  "legal.footer.title": "Juridisch",
  "legal.footer.imprint": "Colofon",
  "legal.footer.privacy": "Privacy",
  "legal.back": "Terug naar de toepassing",

  "legal.imprint.title": "Colofon",
  "legal.imprint.ddg": "Gegevens conform § 5 DDG (Duitse wet digitale diensten)",
  "legal.imprint.representedBy": "Vertegenwoordigd door",
  "legal.imprint.contact": "Contact",
  "legal.imprint.contactEmail": "E-mail",
  "legal.imprint.contactPhone": "Telefoon",
  "legal.imprint.register": "Registerinschrijving",
  "legal.imprint.registerNote":
    "Dit onderdeel vervalt volledig zolang er geen registerinschrijving bestaat. Het wordt dan geschrapt en niet met een vervangende waarde gevuld.",
  "legal.imprint.vat": "Btw-identificatienummer",
  "legal.imprint.vatText": "Btw-identificatienummer conform § 27a van de Duitse omzetbelastingwet:",
  "legal.imprint.responsible": "Verantwoordelijk voor de inhoud",
  "legal.imprint.supervisory": "Toezichthoudende instantie",
  "legal.imprint.supervisoryNote":
    "Dit onderdeel vervalt. Het geldt alleen bij vergunningplichtige activiteiten; het aanbieden van kennismanagementsoftware is naar de huidige stand niet vergunningplichtig.",
  "legal.imprint.status": "Opmerking over de stand van dit aanbod",
  "legal.imprint.statusBody":
    "Dit aanbod bevindt zich in een gesloten testfase en is uitsluitend bestemd voor uitgenodigde gebruikers. Het richt zich niet op consumenten en vormt geen openbaar aanbod.",

  "legal.privacy.title": "Privacyverklaring",
  "legal.privacy.label.purpose": "Doel",
  "legal.privacy.label.basis": "Rechtsgrondslag",
  "legal.privacy.label.retention": "Bewaartermijn",
  "legal.privacy.label.recipient": "Ontvanger",
  "legal.privacy.s1.title": "1. Verwerkingsverantwoordelijke",
  "legal.privacy.s1.body":
    "Verwerkingsverantwoordelijke voor de verwerking van persoonsgegevens in de zin van de Algemene verordening gegevensbescherming is:",
  "legal.privacy.s1.dpo": "Functionaris voor gegevensbescherming:",
  "legal.privacy.s2.title": "2. Uitgangspunt",
  "legal.privacy.s2.body":
    "Wij verwerken persoonsgegevens uitsluitend voor zover dat nodig is voor de werking van deze toepassing. Wij gebruiken geen analyse-, tracking- of advertentiediensten, laden geen inhoud van externe servers in uw browser en gebruiken geen telpixels. Het beveiligingsbeleid van onze server verhindert technisch dat uw browser verbinding maakt met externe aanbieders.",
  "legal.privacy.s3.title": "3. Gebruikersaccount en aanmelden",
  "legal.privacy.s3.body":
    "Om de toepassing te gebruiken hebt u een account nodig. Daarbij verwerken wij uw naam, uw e-mailadres en uw wachtwoord. Het wachtwoord wordt uitsluitend opgeslagen in een vorm die niet terug te rekenen is.",
  "legal.privacy.s3.purpose": "Toegang bieden, uw bijdragen toewijzen, de toegang beveiligen.",
  "legal.privacy.s3.basis":
    "Uitvoering van de overeenkomst respectievelijk de gebruiksrelatie, artikel 6, lid 1, onder b, AVG.",
  "legal.privacy.s3.retention": "Voor de duur van de gebruiksrelatie.",
  "legal.privacy.s3.reset":
    "Als u uw wachtwoord opnieuw instelt, maken wij een eenmalige code aan die één uur geldig is en daarna vervalt.",
  "legal.privacy.s4.title": "4. Opslag op uw apparaat",
  "legal.privacy.s4.p1":
    "Bij het aanmelden plaatsen wij één cookie met de naam kw_session. Het bevat uitsluitend een willekeurige code, geen gegevens over u. Het is niet leesbaar voor scripts in de browser, wordt alleen via een versleutelde verbinding verzonden, is veertien dagen geldig en wordt bij het afmelden verwijderd. Op onze server is daarvan alleen een controlewaarde opgeslagen, niet de code zelf.",
  "legal.privacy.s4.p2":
    "Zonder dit cookie is aangemeld gebruik technisch niet mogelijk. Het is daarmee strikt noodzakelijk voor de door u uitdrukkelijk gewenste dienst; toestemming is daarvoor conform § 25, lid 2, TDDDG niet vereist.",
  "legal.privacy.s4.p3":
    "Meldt u zich aan via de aanmeldprocedure van uw organisatie, dan plaatsen wij voor de duur van dat proces drie extra codes, die tien minuten geldig zijn en direct na afloop worden verwijderd.",
  "legal.privacy.s4.p4":
    "Daarnaast onthoudt de toepassing in uw browser uw weergave-instellingen — bijvoorbeeld sortering, gekozen filters, opgeslagen weergaven, het gekozen uiterlijk en welke introductietips u al hebt gezien. Deze gegevens verlaten uw browser niet en worden niet aan ons doorgegeven. Ze ontstaan pas wanneer u de betreffende functie gebruikt. De toepassing werkt ook volledig als uw browser deze opslag verhindert.",
  "legal.privacy.s4.p5":
    "Een opmerking die voor u van belang kan zijn: legt u inhoud vast terwijl er geen verbinding met onze server is, dan bewaart de toepassing deze concepten in uw browser totdat ze kunnen worden verzonden. In deze tussenopslag kan daarom door u geschreven inhoud staan. Die wordt daar na verzending verwijderd.",
  "legal.privacy.s4.p6":
    "Gebruikt u de toepassing als geïnstalleerde app, dan legt uw browser programmabestanden in een buffer zodat de app sneller start. Antwoorden van onze server en uw inhoud worden daar niet opgeslagen.",
  "legal.privacy.s4.p7":
    "Mislukt het beëindigen van uw sessie, dan noteert de toepassing dat in uw browser onder de naam kw_signout_pending, zodat het gebruik geblokkeerd blijft totdat onze server de beëindiging heeft bevestigd. Omdat uw sessie voor alle vensters en tabbladen van dezelfde browser geldt, staat deze markering in de blijvende browseropslag en werkt zij ook in alle vensters en tabbladen — een tweede, al geopend venster zou anders inhoud blijven tonen terwijl de beëindiging nog openstaat. De markering bevat geen gegevens over u en wordt niet aan ons doorgegeven. Zij blijft staan totdat onze server de beëindiging heeft bevestigd of vaststaat dat uw sessie niet meer bestaat; dan wordt zij verwijderd. Vanzelf vervalt zij niet. Om dat niet bij u te laten liggen, probeert de toepassing de beëindiging zelf opnieuw — zodra uw verbinding weer bestaat en bij elke nieuwe start van de toepassing; u kunt het ook op elk moment zelf in gang zetten. Zij is technisch noodzakelijk voor de door u gewenste afmelding.",
  "legal.privacy.s4.p8":
    "Op de pagina „Vragen” bewaart de toepassing in uw browser uw nog niet verzonden concept en de laatst getoonde vraag en het antwoord met de bronvermeldingen, zodat u na het verlaten van de pagina, opnieuw laden of opnieuw aanmelden verder kunt werken. De vermelding is aan uw gebruikersaccount gekoppeld; wie zich in dezelfde browser met een ander account aanmeldt, krijgt haar niet te zien. Zij kan inhoud uit de kennisbank van uw organisatie bevatten en blijft ook na het afmelden in deze browser bewaard. Een verworpen concept wordt direct verwijderd; het getoonde antwoord wordt vervangen zodra u een nieuwe vraag stelt. De vermelding zelf wordt niet aan ons doorgegeven; u kunt haar altijd verwijderen door de websitegegevens van deze toepassing in uw browser te wissen.",
  "legal.privacy.s5.title": "5. Uw inhoud",
  "legal.privacy.s5.body":
    "De toepassing dient om kennis vast te leggen, te toetsen en terug te vinden. De inhoud die u invoert of uploadt, wordt samen met het tijdstip en uw code als auteur opgeslagen, zodat bijdragen navolgbaar blijven en vragen mogelijk zijn.",
  "legal.privacy.s5.basis": "Uitvoering van de overeenkomst, artikel 6, lid 1, onder b, AVG.",
  "legal.privacy.s6.title": "6. Navolgbaarheid van wijzigingen",
  "legal.privacy.s6.body":
    "Om wijzigingen aan getoetste kennis navolgbaar te houden, voeren wij een doorlopend logboek dat is beveiligd tegen wijziging achteraf. Daarin staan het tijdstip, de code van de handelende persoon, de aard van de handeling en het betrokken object. IP-adres en browserkenmerk worden in dit logboek niet opgeslagen. Ook aan- en afmelden worden op deze wijze vastgelegd.",
  "legal.privacy.s6.basis":
    "Gerechtvaardigd belang bij de integriteit en navolgbaarheid van getoetste kennis, artikel 6, lid 1, onder f, AVG.",
  "legal.privacy.s7.title": "7. Bescherming tegen misbruik",
  "legal.privacy.s7.body":
    "Om geautomatiseerde aanmeldpogingen af te weren, tellen wij mislukte pogingen kortstondig in het werkgeheugen, gerelateerd aan het IP-adres en het ingevoerde e-mailadres. Deze tellers worden niet duurzaam opgeslagen.",
  "legal.privacy.s7.basis":
    "Gerechtvaardigd belang bij de beveiliging van de toepassing, artikel 6, lid 1, onder f, AVG.",
  "legal.privacy.s7.logs": "Bedrijfslogboeken van de webserver:",
  "legal.privacy.s8.title": "8. Kunstmatige intelligentie",
  "legal.privacy.s8.p1":
    "Bepaalde functies van de toepassing gebruiken een AI-model — bijvoorbeeld het beantwoorden van vragen, het structureren van notities, het voorstellen van beeldbeschrijvingen en het groeperen van geïmporteerde inhoud. Om zo'n resultaat te laten ontstaan, wordt de daarvoor benodigde inhoud aan de exploitant van het model doorgegeven en daar verwerkt.",
  "legal.privacy.s8.p2":
    "De toepassing toont u op elke betrokken plek dat een AI-model werkt en welk soort model dat is. Resultaten van een AI-model kunnen onjuist zijn en vervangen geen vakinhoudelijke toetsing.",
  "legal.privacy.s8.p3":
    "Kennisobjecten die als vertrouwelijk of streng vertrouwelijk zijn ingedeeld, worden uit de context verwijderd voordat een vraag naar een model gaat — zij bereiken het model niet. De tekst van uw vraag wordt daarentegen wel doorgegeven: voer daar alstublieft geen vertrouwelijke inhoud in.",
  "legal.privacy.s8.thirdCountry": "Doorgifte naar een derde land:",
  "legal.privacy.s9.title": "9. Verzending van e-mail",
  "legal.privacy.s9.body":
    "Voor uitnodigingen en het opnieuw instellen van wachtwoorden versturen wij e-mails.",
  "legal.privacy.s9.basis": "Uitvoering van de overeenkomst, artikel 6, lid 1, onder b, AVG.",
  "legal.privacy.s10.title": "10. Hosting",
  "legal.privacy.s10.body": "De toepassing draait op gehuurde servers.",
  "legal.privacy.s10.basis":
    "Gerechtvaardigd belang bij een economische bedrijfsvoering, artikel 6, lid 1, onder f, AVG.",
  "legal.privacy.s11.title": "11. Aansluiting van verdere systemen",
  "legal.privacy.s11.body":
    "Richt uw organisatie een import uit een eigen systeem in, dan wordt de daarvoor benodigde inhoud daar opgehaald. Welke systemen dat zijn, bepaalt uw organisatie.",
  "legal.privacy.s12.title": "12. Geen geautomatiseerde besluitvorming in individuele gevallen",
  "legal.privacy.s12.body":
    "Er vindt geen geautomatiseerde besluitvorming, met inbegrip van profilering, plaats die voor u rechtsgevolgen heeft of u op vergelijkbare wijze aanmerkelijk treft. Voorstellen van het AI-model zijn voorstellen; over het opnemen en toetsen van kennis beslissen mensen.",
  "legal.privacy.s13.title": "13. Uw rechten",
  "legal.privacy.s13.body":
    "U hebt recht op inzage in de over u opgeslagen gegevens, op rectificatie van onjuiste gegevens, op wissing, op beperking van de verwerking, op gegevensoverdraagbaarheid en op bezwaar tegen een verwerking die op een gerechtvaardigd belang berust. Hebt u toestemming gegeven, dan kunt u die te allen tijde voor de toekomst intrekken; de rechtmatigheid van de tot dan toe verrichte verwerking blijft onaangetast.",
  "legal.privacy.s13.contact": "Contact voor al deze verzoeken:",
  "legal.privacy.s13.authority":
    "Onafhankelijk daarvan hebt u het recht een klacht in te dienen bij een toezichthoudende autoriteit voor gegevensbescherming, in het bijzonder bij de autoriteit van uw verblijfplaats of de voor ons bevoegde autoriteit:",
  "legal.privacy.s14.title": "14. Noodzaak van de gegevens",
  "legal.privacy.s14.body":
    "Het opgeven van naam, e-mailadres en wachtwoord is noodzakelijk om toegang in te richten. Zonder deze gegevens kunnen wij geen toegang bieden. Een wettelijke verplichting tot verstrekking bestaat niet.",
  "legal.privacy.s15.title": "15. Wijzigingen",
  "legal.privacy.s15.body":
    "Wij passen deze verklaring aan wanneer de toepassing of de rechtssituatie verandert. Stand van deze versie:",

  // JOB 3761: derselbe eine Schlüssel, s. die deutsche Fassung.
  "demo.kennzeichen": "Demo-omgeving",
  "notice.banner.aria": "Kennisgeving over het gebruik van deze toepassing",
  "notice.banner.title": "Kort ter kennisname",
  "notice.banner.ai":
    "Deze toepassing werkt met kunstmatige intelligentie. Wanneer u een vraag stelt, notities laat structureren of een beeldbeschrijving laat voorstellen, wordt een AI-model gebruikt en wordt de daarvoor benodigde inhoud aan de exploitant ervan doorgegeven. Resultaten van een AI-model kunnen onjuist zijn en vervangen geen vakinhoudelijke toetsing. Op elke betrokken plek ziet u welk model werkt.",
  "notice.banner.cookie":
    "Voor het aanmelden wordt een technisch noodzakelijk sessiecookie geplaatst. Zonder dit cookie is aangemeld gebruik niet mogelijk.",
  "notice.banner.ack": "Begrepen — verder",
  "notice.banner.decline": "Niet akkoord",
  "notice.decline.title": "Uw sessie wordt beëindigd",
  "notice.decline.body":
    "Het sessiecookie is al geplaatst — zonder dat cookie is aangemeld gebruik technisch niet mogelijk. Wij beëindigen daarom nu uw sessie en verwijderen het cookie. U kunt zich op elk moment opnieuw aanmelden.",
  "notice.decline.confirm": "Sessie nu beëindigen",
  "notice.decline.cancel": "Terug naar de kennisgeving",
  "notice.decline.loginHint":
    "Uw sessie is beëindigd omdat u niet akkoord ging met de kennisgeving. U kunt zich op elk moment opnieuw aanmelden.",

  "notice.signOutFailed.title": "Uw sessie is niet bevestigd beëindigd",
  "notice.signOutFailed.body":
    "U ging niet akkoord met de kennisgeving en wij wilden uw sessie beëindigen — de server heeft dat echter niet bevestigd. Mogelijk bestaat uw sessie nog. Zolang dat niet duidelijk is, tonen wij u geen inhoud, en wel in alle vensters en tabbladen van deze browser. De toepassing probeert de beëindiging zelf opnieuw — zodra uw verbinding weer bestaat en bij elke nieuwe start van de toepassing; u kunt het ook direct opnieuw proberen.",
  "notice.signOutFailed.retry": "Beëindiging opnieuw proberen",
  "notice.signOutFailed.again": "Ook deze poging kwam niet door. Controleer uw netwerkverbinding.",

  "ai.generatedNotice":
    "Door kunstmatige intelligentie gegenereerd — controleer dit vakinhoudelijk.",
  "ai.surfaceNotice": "Hier kan een AI meewerken — door haar gegenereerde inhoud wordt gemarkeerd.",
  "ergebnisStufe.entwurf": "Reasoner-concept, niet gevalideerd",
  "ergebnisStufe.empfehlung": "Aanbeveling, ongetoetst",
  "ergebnisStufe.validiert": "Gevalideerd",
  "ai.costHint": "Eén klik kan een echte, betaalde cloud-AI-aanvraag veroorzaken.",
  "ai.exportNotice":
    "Door kunstmatige intelligentie gegenereerd (KLARWERK, {{task}}, {{date}}). Inhoudelijk te controleren.",
  "ai.task.answer": "vraag beantwoord",

  "w2.result.heading": "Importresultaat",
  "w2.run.heading": "Uitvoering",
  "w2.run.start": "Import starten",
  "w2.run.idle":
    "In dit venster is geen volledige uitvoering gestart. De startknop maakt er een aan; de status verschijnt dan hier. Een import via „Selectie overnemen” wordt ook vastgelegd, maar verschijnt niet hier: hij staat hierboven in de regel „Laatste succesvol afgeronde import”.",
  "w2.run.progress": "{{verarbeitet}} van {{gesamt}} elementen verwerkt",
  "w2.run.status.QUEUED": "In de wachtrij",
  "w2.run.status.FETCHING": "Bron wordt opgehaald",
  "w2.run.status.PERSISTING_SOURCE": "Origineel wordt vastgelegd",
  "w2.run.status.EXTRACTING": "Uitspraken worden ontleend",
  "w2.run.status.CREATING_KNOWLEDGE": "Kenniseenheden ontstaan",
  "w2.run.status.ANALYZING": "Controle loopt",
  "w2.run.status.COMPLETED": "Afgerond",
  "w2.run.status.PARTIAL": "Gedeeltelijk mislukt",
  "w2.run.status.FAILED": "Mislukt",
  "w2.run.status.unknown": "Toestand onbekend",
  "w2.run.hint.QUEUED": "De uitvoering is nog niet begonnen. Er is nog geen resultaat.",
  "w2.run.hint.FETCHING": "De uitvoering loopt nog. Wat hier staat, is een tussenstand.",
  "w2.run.hint.PERSISTING_SOURCE": "De uitvoering loopt nog. Wat hier staat, is een tussenstand.",
  "w2.run.hint.EXTRACTING": "De uitvoering loopt nog. Wat hier staat, is een tussenstand.",
  "w2.run.hint.CREATING_KNOWLEDGE": "De uitvoering loopt nog. Wat hier staat, is een tussenstand.",
  "w2.run.hint.ANALYZING": "De uitvoering loopt nog. Wat hier staat, is een tussenstand.",
  "w2.run.hint.COMPLETED": "De uitvoering is volledig doorlopen.",
  "w2.run.hint.PARTIAL":
    "Een deel van de uitvoering is mislukt. Wat u ziet is onvolledig — het is geen afgeronde import.",
  "w2.run.hint.FAILED":
    "De uitvoering is mislukt. Wat hieronder staat, is daarom niet het beoogde resultaat.",
  "w2.run.hint.unknown":
    "De server meldde een toestand die deze versie niet kent. Wat u ziet mag niet als afgerond worden gelezen.",
  "w2.run.failureCode": "Foutcode",
  "w2.run.failureReason": "Reden",
  "w2.run.gesperrt.disabled":
    "De Confluence-import is in deze installatie uitgeschakeld. Daarom kan hier geen uitvoering worden gestart. Inschakelen gebeurt op de server (zie Toegang hierboven).",
  "w2.run.gesperrt.noCredentials":
    "De Confluence-import is ingeschakeld, maar de toegangsgegevens zijn onvolledig of onbruikbaar. Pas als ze aanwezig zijn, kan een uitvoering worden gestart (zie Toegang hierboven).",
  "w2.run.startFehler.zeitlimit":
    "Confluence heeft niet op tijd geantwoord (time-out). Probeer het later opnieuw.",
  "w2.run.startFehler.nichtKonfiguriert":
    "De import is niet startklaar: de toegangsgegevens voor Confluence ontbreken of zijn onbruikbaar.",
  "w2.run.startFehler.ausgeschaltet":
    "De Confluence-import is in deze installatie uitgeschakeld — starten is niet beschikbaar.",
  "w2.run.startFehler.keinRecht": "Je hebt geen recht om een import te starten.",
  "w2.run.startFehler.betreiberAus":
    "De Confluence-import is door de beheerder uitgeschakeld — inschakelen kan hierboven bij Toegang.",
  "w2.run.gesperrt.switchedOff":
    "De Confluence-import is door de beheerder uitgeschakeld. Inschakelen kan hierboven bij Toegang.",
  "w2.run.failureText.CONFLUENCE_TIMEOUT":
    "Confluence heeft niet op tijd geantwoord (time-out). De uitvoering is afgebroken; opnieuw starten is mogelijk.",
  "w2.run.failureText.CONFLUENCE_BUDGET":
    "Het tijdsbudget voor het lezen van de ruimte was op. De ruimte is niet volledig gelezen.",
  "w2.run.failureText.CONFLUENCE_RESPONSE_TOO_LARGE":
    "Een antwoord van Confluence was te groot en is niet gelezen.",
  "w2.run.failureText.IMPORT_UNAVAILABLE":
    "De import was niet startklaar: de toegangsgegevens voor Confluence ontbreken of zijn onbruikbaar.",
  "w2.source.heading": "Origineel",
  "w2.source.lead": "Het geïmporteerde document in precies de versie waaruit de kennis ontstond.",
  "w2.source.missing": "Voor deze uitvoering is geen origineel geleverd.",
  "w2.source.missingRequired": "Bij dit origineel ontbreken verplichte gegevens.",
  "w2.source.title": "Titel",
  "w2.source.system": "Systeem",
  "w2.source.version": "Versie",
  "w2.source.url": "Adres",
  "w2.source.importedAt": "Geïmporteerd op",
  "w2.source.externalId": "Kenmerk in het bronsysteem",
  "w2.knowledge.heading": "Kenniseenheden",
  "w2.knowledge.lead": "Zelfstandige eenheden die uit dit ene origineel zijn ontstaan.",
  "w2.knowledge.count": "{{count}} eenheden",
  "w2.knowledge.empty":
    "Deze uitvoering heeft geen kenniseenheid opgeleverd. Dat is geen geslaagde import.",
  "w2.item.position": "Eenheid {{position}}",
  "w2.item.statementMissing": "Voor deze eenheid is geen uitspraak geleverd.",
  "w2.item.locator": "Vindplaats",
  "w2.item.locatorMissing": "Vindplaats ontbreekt",
  "w2.item.status": "Validatie",
  "w2.item.statusMissing": "Validatiestatus ontbreekt",
  "w2.item.conflicts": "Conflicten: {{count}}",
  "w2.item.conflictsNone": "Geen conflicten gemeld",
  "w2.item.gaps": "Kennishiaten: {{count}}",
  "w2.item.gapsNone": "Geen kennishiaten gemeld",
  // AUFTRAG-81: spiegel van de DE-sleutels — zie de toelichting daar.
  "w2.value.missing": "Verplichte gegevens ontbreken",
  "w2.value.none": "Niet geleverd",
  // JOB 3511 — demo-uiterlijk (bedrijfs-CI); spiegel van de DE-sleutels. NL steht hier, weil
  // `nl: typeof de` jeden Schlüssel verlangt — ein fehlender wäre ein Typfehler, kein Rückfall.
  "einst.marke.titel": "Demo-uiterlijk",
  "einst.marke.erklaerung":
    "De keuze geldt voor alle gebruikers van deze installatie en staat los van de demo-datapakketten. Omschakelen laadt geen gegevens, verwijdert geen gegevens en start geen AI-verwerking.",
  "einst.marke.profil": "Bedrijfsprofiel",
  "einst.marke.profilKeines": "Geen bedrijfsprofiel",
  "einst.marke.profilAdvisor": "Advisor",
  "einst.marke.schalter": "Bedrijfs-CI gebruiken",
  "einst.marke.ohneProfil": "Zonder bedrijfsprofiel valt er niets te gebruiken.",
  "einst.marke.gespeichert": "Uiterlijk overgenomen.",
  // JOB 3742 — paginahulp voor de zes stille vlakken; spiegel van de DE-sleutels (zie de
  // toelichting daar). NL steht hier vollständig, weil `nl: typeof de` jeden Schlüssel verlangt.
  "seitenhilfe.wissensnetz.titel": "Een thema kiezen en zijn objecten bekijken",
  "seitenhilfe.wissensnetz.text":
    "Kies een thema: ernaast verschijnt welke kennisobjecten erbij horen, en één link opent ze allemaal in de bibliotheek. Is het venster te smal voor de tekening, dan staat dezelfde informatie in zinnen. Volgende stap: een thema aanklikken en een van de genoemde objecten openen.",
  "seitenhilfe.profil.titel": "Taal, wachtwoord en afmelden",
  "seitenhilfe.profil.text":
    "Hier staan je naam, je e-mailadres en je rol. Je kunt de taal van de interface omzetten, je wachtwoord wijzigen, je eigen bijdragen bekijken en je afmelden. Volgende stap: klik op de regel die je wilt wijzigen — de taal wissel je direct in haar eigen regel.",
  "seitenhilfe.kapital.titel": "Het bestand in cijfers lezen",
  "seitenhilfe.kapital.text":
    "Deze pagina vat samen hoeveel kennis er is, hoeveel daarvan gecontroleerd is en wat nog open staat — plus een schatting van wat dat waard is. De aannames achter die schatting vul je zelf in. Volgende stap: een aanname wijzigen en aflezen hoe de schatting meebeweegt.",
  "seitenhilfe.graph.titel": "Van een punt naar het kennisobject springen",
  "seitenhilfe.graph.text":
    "Elk punt is een kennisobject; een grijze lijn betekent dat twee objecten hetzelfde trefwoord dragen, een rode stippellijn staat voor een gemelde tegenspraak. Volgende stap: klik op een punt — hoort het bij een object uit het bestand, dan brengt het je daarheen.",
  "seitenhilfe.import.titel": "Kennis van buiten binnenhalen en controleren",
  "seitenhilfe.import.text":
    "Hier haal je kennis uit andere systemen binnen: kies een JSON-bestand of sleep het op het vlak; met de nodige rechten kun je ook een Confluence-import starten. Elke bijdrage komt als voorstel in de controlelijst, met volledige tekst en bron. Volgende stap: een voorstel lezen en het aannemen, afwijzen of een vraag stellen.",
  "seitenhilfe.output.titel": "Een document uit gecontroleerde kennis maken",
  "seitenhilfe.output.text":
    "Kies de soort document, vink de kennisobjecten aan die erin horen en zet ze in de volgorde waarin ze moeten staan. Het gemaakte document kun je kopiëren of als Markdown-bestand downloaden; eronder staat uit welke objecten het is ontstaan. Volgende stap: een soort kiezen en de eerste bron aanvinken.",
  // JOB 3670 — paginahulp van de vier beheerschermen; spiegel van de DE-sleutels. De drie
  // nagekeken feiten staan bij het DE-blok: de route is alleen voor beheerders, de themabalk
  // verschuift op smalle vensters naar boven, en een ontbrekend gebied ligt aan trap 2, niet
  // aan de rol.
  "seitenhilfe.admin.uebersicht.titel": "Beheer — wat je hier instelt",
  "seitenhilfe.admin.uebersicht.text":
    "Zeven thema's: gebruikers en rollen, AI, bronnen en gegevens, demogegevens, veiligheid en bewijs, rapporten en analyse, systeem. Elke regel noemt rechts haar huidige waarde; een klik opent de kaart erachter, en thema en kaart staan daarna in het adres — een bladwijzer of een herlaadbeurt komt precies hier terug. Op smalle vensters staat de themabalk boven de inhoud in plaats van links ernaast. Staat er bij een gebied „Module uit“, dan ligt dat niet aan je rol maar aan de schakelaar „Uitgebreide modules“ onder Systeem. Voor een demotoegang begin je bij gebruikers en rollen en laad je daarna de demogegevens onder demogegevens.",
  "seitenhilfe.admin.nutzer.titel": "Eén account beheren",
  "seitenhilfe.admin.nutzer.text":
    "Dit ene account beheer je hier: wacht het nog op vrijgave, dan staat de vrijgaveknop er; is het vrijgegeven, dan in plaats daarvan de rolkeuze. Daarbij een nieuw wachtwoord en het verwijderen. Een nieuw wachtwoord beëindigt alle open sessies van die persoon — hij moet zich daarna opnieuw aanmelden. De laatste vrijgegeven beheerder beschermt de server: verlagen en verwijderen weigert hij, zodat niemand zichzelf buitensluit. Wat een rol überhaupt mag, staat in haar eigen kaart onder „Gebruikers en rollen“.",
  "seitenhilfe.admin.nutzerNeu.titel": "Een account aanmaken",
  "seitenhilfe.admin.nutzerNeu.text":
    "Naam, e-mail, een wachtwoord van minstens acht tekens met een herhaalveld tegen typefouten, en de rol. Een hier aangemaakt account is meteen vrijgegeven en kan zich aanmelden — anders dan een account dat zichzelf heeft geregistreerd en op jouw vrijgave wacht. Ontbreekt er iets, dan noemt een klik op „Aanmaken“ de ontbrekende velden bij naam; de knop is nooit stil uitgegrijsd. Daarna staat het account in de lijst onder „Gebruikers en rollen“.",
  "seitenhilfe.admin.ansichtRolle.titel": "Weergave als rol",
  "seitenhilfe.admin.ansichtRolle.text":
    "Je ziet de interface zoals een andere rol die ziet; je echte rechten op de server blijven beheerder. Het gevolg waar niemand op rekent: het beheer is alleen voor beheerders zichtbaar. Kies je hier een andere rol, dan verdwijnt het op datzelfde moment, en deze kaart gaat mee. De weg terug loopt daarom niet via deze kaart maar via „Naar adminweergave“ in het tandwielmenu.",
  "seitenhilfe.admin.rolle.titel": "Wat deze rol mag",
  "seitenhilfe.admin.rolle.text":
    "Een inlichting, geen schakelaar: bovenaan de vrijheden van deze rol in woorden, daaronder per groep de gebieden die haar rol vrijgeeft. Een „·2“ markeert een gebied dat daarnaast de schakelaar „Uitgebreide modules“ onder Systeem nodig heeft — zonder die blijft het onzichtbaar, ook als de rol volstaat. De rol van een mens wijzig je niet hier, maar in zijn account onder „Gebruikers en rollen“.",
  "seitenhilfe.admin.demo.titel": "Demogegevens laden en verwijderen",
  "seitenhilfe.admin.demo.text":
    "Twee knoppen, twee verschillende voorraden: „Demogegevens laden“ maakt de algemene demovoorraad aan, de pakketknop eronder laadt precies het genoemde demopakket. Maakt de algemene run nieuwe accounts aan, dan staan hun eenmalige wachtwoorden hier precies één keer — een herlaadbeurt verliest ze, de server noemt ze geen tweede keer. „Alle demogegevens verwijderen“ ruimt beide tegelijk op, ook de bouwstenen van het pakket. Het demo-uiterlijk onderaan wisselt alleen logo en kleuren, voor alle gebruikers van deze installatie; het laadt en verwijdert geen gegevens.",
  "seitenhilfe.admin.werk.titel": "Fabrieksinstellingen",
  "seitenhilfe.admin.werk.text":
    "De fabrieksreset verwijdert alle gegevens en sluit daarna de server af; de toepassing moet met de hand opnieuw worden gestart. Vandaar twee trappen: eerst je eigen wachtwoord, dan de uitdrukkelijke waarschuwing. Hij bestaat niet in elke installatie — staat hier „In deze installatie niet beschikbaar“, dan is de weg op deze server niet ingebouwd, en geen enkele schakelaar verandert daar iets aan. Alleen de demogegevens raak je in plaats daarvan kwijt onder demogegevens.",
  "seitenhilfe.admin.papierkorb.titel": "Prullenbak",
  "seitenhilfe.admin.papierkorb.text":
    "Verwijderde kennisobjecten liggen hier tussen. Per regel staan de mens die verwijderde, de datum en het aantal resterende dagen. „Herstellen“ haalt het object terug in de bibliotheek; „Definitief verwijderen“ vraagt één keer na en is daarna niet meer terug te draaien. Doe je niets, dan verwijdert de server de regel na afloop van de termijn vanzelf — bij de volgende opruimronde, niet op de minuut precies.",
  "seitenhilfe.admin.audit.titel": "Gebruikerswijzigingen",
  "seitenhilfe.admin.audit.text":
    "Een zuivere inlichting zonder bedieningselementen: de jongste regels over accounts en aanmelding, per regel tijdstip, actie en de kenmerk van wie handelde. Hier valt niets te wijzigen en niets te verwijderen — de lijst is het resultaat van wat elders is gedaan. De volledige, hash-geketende keten met haar controleknop staat onder „Veiligheid en bewijs“ in het controleprotocol.",
  "seitenhilfe.admin.protokoll.titel": "Controleprotocol",
  "seitenhilfe.admin.protokoll.text":
    "Het hash-geketende protocol van deze installatie, hier met de jongste regels in gewone woorden: gebeurtenis, uitgevoerd door, betrokkene. „Keten controleren“ rekent de keten werkelijk na en meldt één van drie uitkomsten — bevestigd, sluitend maar niet na te rekenen, of niet bevestigd; „Afdrukken“ geeft precies dit uittreksel. Staat er in plaats van een naam alleen een kenmerk, dan zegt de regel ernaast waarom — en die redenen betekenen iets verschillends: „Account bestaat niet meer“ is een uitspraak over het account, en die valt pas na een volledig geladen directory waarin het kenmerk ontbreekt. „Naam wordt geladen“ en „Naam niet beschikbaar“ zeggen daarentegen niets over het account, alleen over het ophalen. Bij een betrokken object staat het kenmerk zonder enige toevoeging: daar wordt in de accountdirectory helemaal niet opgezocht.",
  "seitenhilfe.admin.datenschutz.titel": "Privacy en veiligheid",
  "seitenhilfe.admin.datenschutz.text":
    "Een lijst van de eigenschappen die deze installatie werkelijk heeft — geen belofte en geen schakelaar; er valt hier niets in te stellen. Het kader onderaan scheidt uitdrukkelijk gemeten waarden van streef- en voorbeeldwaarden, zodat niemand in een gesprek het een voor het ander houdt. „Afdrukken“ geeft de lijst als uittreksel, bijvoorbeeld voor een vraag van de juridische afdeling.",
  "seitenhilfe.admin.bereitschaft.titel": "Gereedheid",
  "seitenhilfe.admin.bereitschaft.text":
    "De checklist vóór een demonstratie: AI, gevalideerde objecten, openstaande toetsingen, uploadgrenzen, extern onderzoek en demogegevens — per regel een stoplicht uit echte getallen. Ze stelt niets in; ze leest zes bronnen en zegt wat ontbreekt. Valt er één uit, dan staat er „niet opvraagbaar“ met een knop die alle zes opnieuw ophaalt, in plaats van een geraden nul. De regel „Demogegevens“ leidt rechtstreeks naar de kaart waar je ze laadt.",
  // JOB 4025 — paginahulp van de back-upkaart.
  "seitenhilfe.admin.sicherung.titel": "Back-up",
  "seitenhilfe.admin.sicherung.text":
    "De informatie over de back-upmap van deze installatie: welke dumps daar liggen, wanneer ze zijn ontstaan, hoe groot ze zijn en of het controlesombestand ernaast ligt dat het back-upscript meeschrijft. Alleen informatie — er wordt hier niets gestart, verwijderd of gedownload. Ontbreekt de map of is ze niet leesbaar, dan lees je „niet vast te stellen“ met de reden; dat is uitdrukkelijk iets anders dan „geen back-up“. En ook een volle lijst zegt niets over de vraag of er uit hersteld kan worden: dat controleert alleen de herstelproef.",
  // JOB 3786 — paginahulp van het telefoonscherm (/mobile); spiegel van de DE-sleutels. De drie
  // nagekeken feiten staan bij het DE-blok: de route heeft geen rolbewaking, maar de drie
  // tabbladen vragen verschillende rechten (concepten `ko.create`, vragen en zoeken `ko.read`);
  // het scherm heeft alleen drie tabbladen in een telefoonlijst van 340 px plus de uitgang
  // erboven; en offline wordt alleen het opslaan van een concept in de wachtrij gezet — vragen en
  // zoeken melden de ontbrekende verbinding.
  "seitenhilfe.mobil.titel": "Onderweg vastleggen, vragen en opzoeken",
  "seitenhilfe.mobil.text":
    "Dit scherm toont KLARWERK op telefoonbreedte en heeft drie tabbladen: „Vastleggen“ maakt van een titel en een tekst een concept — daarvoor heb je het recht om aan te maken nodig, een kijker kan hier alleen lezen; „Vragen“ en „Zoeken“ staan voor elke rol open en leiden van een antwoord of een treffer naar het kennisobject. Zonder verbinding wordt alleen het opslaan van een concept in de wachtrij gezet en later nagestuurd; vragen en zoeken zeggen dan dat ze een verbinding nodig hebben. Toetsen, vrijgeven, tegenstrijdigheden oplossen en tekstopmaak met afbeeldingen en tabellen zijn hier NIET mogelijk — een voortgezet concept toont zijn vaste blokken alleen als genummerde plaatsaanduidingen. Volgende stap: tik op een tabblad; voor al het andere ga je bovenaan via „Naar volledige versie“ terug naar het grote venster.",
  // JOB 3863: die Seitenhilfe der KI-Freigabe. Belege je Zusage stehen im deutschen Block.
  "seitenhilfe.admin.kiFreigabe.titel": "De twee schakelaars van de AI-vrijgave",
  "seitenhilfe.admin.kiFreigabe.text":
    "Twee schakelaars, en de tweede hangt aan de eerste. „Openbare AI toestaan“ is de basisvrijgave: pas die laat toe dat er tekst naar een externe aanbieder gaat, en alleen een uitdrukkelijk ja telt — „niet ingesteld“ blokkeert net zo goed als nee. „Ook vertrouwelijke inhoud naar de openbare AI“ breidt haar uit met teksten die als vertrouwelijk zijn aangemerkt; zonder de basisvrijgave heeft deze tweede schakelaar geen effect, en de kaart schrijft dat er dan ook onder. Vóór het inschakelen vraagt het scherm één keer uitdrukkelijk na, omdat er dan vertrouwelijke teksten naar de externe aanbieder gaan; het terugnemen gaat de veilige kant op en vraagt niets. Alleen een beheerder mag schakelen. Een uitbreiding wordt alleen verleend als zij ook kan worden vastgelegd — anders wijst de server haar af in plaats van haar stilzwijgend te verlenen. Een terugname heeft vooraf geen vastlegging nodig: mislukt na een geslaagde terugname het vastleggen ervan, dan blijft de terugname toch van kracht. Kan de terugname helemaal niet worden opgeslagen, dan meldt de server de fout en blijft de tot dan opgeslagen stand gelden. Wat geldt, staat in de regel onder de schakelaars: die toont de door de server bevestigde stand, niet het zojuist aangevinkte vakje.",
  "seitenhilfe.admin.kiOhneFreigabe.titel": "Zolang er niets is vrijgegeven",
  "seitenhilfe.admin.kiOhneFreigabe.text":
    "Op het webscherm hangt het ervan af of een eigen intern model is verbonden. Is er een verbonden, dan rekent dat verder en blijven de AI-knoppen bedienbaar. Is alleen de openbare AI ingericht, dan valt die zonder vrijgave uit de keten en blijft er voor de taak geen model over: de AI-knoppen zijn dan grijs en dragen de zin „AI niet beschikbaar — voor deze taak is geen model actief.“ Geen stille vervangingsrun wendt een model voor. Klara in het Word-venster neemt de externe weg helemaal niet: zij meldt de blokkade als een onvolledig vastgelegde regel, en geen enkele toestemming van de gebruiker heft die op — een beslissing van de beheerder kan niemand wegklikken. Is de AI-toewijzing vastgelegd via de deploy-configuratie (KLARWERK_REASONER_POLICY), dan hebben ook deze twee schakelaars geen effect: ze zijn geblokkeerd, de server zou een opslag weigeren, en omdat de deploy-toewijzing zelf geen vrijgave draagt, blijft de openbare AI zolang geblokkeerd. De volgende stap loopt dan niet via deze kaart, maar via de deploy-configuratie van de server; zonder de variabele geldt weer de hier opgeslagen keuze.",
  // JOB 4154 (WIKI-GESAMTANWEISUNG): spiegel van de DE-sleutels. „ongewijzigd" blijft
  // „ongewijzigd" — nooit „juist", „gecontroleerd" of „vrijgegeven".
  "ga.titel": "Werkinstructie",
  "ga.laedt": "Laadt …",
  "ga.leer":
    "Deze werkinstructie heeft nog geen onderdelen. Voeg hierboven het eerste toe uit bestaande kennis.",
  "ga.fehler":
    "De werkinstructie kon niet worden geladen. Laad de pagina opnieuw of probeer het later nog eens.",
  "ga.ablageFluechtig":
    "Deze installatie kan instructies niet blijvend opslaan. Er is niets aangemaakt — neem contact op met je systeembeheerder.",
  "ga.offline": "Geen verbinding. Je invoer blijft behouden; er is niets opgeslagen.",
  "ga.standVon": "Stand van {{zeit}}",
  "ga.auffrischungLaeuft": "Stand van {{zeit}} · wordt ververst",
  "ga.auffrischungGescheitert": "Stand van {{zeit}} · verversen mislukt",
  "ga.gesperrt": "Voorleggen en beslissen zijn geblokkeerd: de getoonde stand is niet zeker.",
  "ga.unvollstaendig": "Delen van deze werkinstructie zijn voor jou niet toegankelijk.",
  "ga.verborgene": "Niet toegankelijke onderdelen: {{anzahl}}",
  "ga.pruefanbindung":
    "Controle-aansluiting: nog niet aangesloten – er vindt geen automatische inhoudelijke controle van deze instructie plaats.",
  "ga.stand.entwurf": "Concept",
  "ga.stand.vorgelegt": "Voorgelegd",
  "ga.stand.entschieden": "Goedgekeurd",
  "ga.stand.abgelehnt": "Afgewezen",
  "ga.bausteine": "Onderdelen",
  "ga.baustein.fassung": "Gebonden versie {{version}}",
  "ga.baustein.herkunft": "{{titel}} · {{autor}}",
  "ga.baustein.herkunftUnbekannt": "De gebonden versie is niet vindbaar.",
  "ga.baustein.fassungAmUnbekannt": "Versiedatum onbekend",
  "ga.baustein.aktualisierung":
    "Er is een nieuwere versie ({{version}}). De gebonden versie blijft staan.",
  "ga.baustein.nachweisFehlt": "Voor deze versie is geen bewijsstuk aanwezig.",
  "ga.baustein.tabellen": "Tabelkoppen: {{werte}}",
  "ga.baustein.abbildungen": "Afbeeldingen: {{werte}}",
  "ga.baustein.unbekannt": "niet vast te stellen",
  "ga.baustein.keine": "geen",
  "ga.baustein.textUnbelegt": "De inhoud van deze versie is niet vastgelegd.",
  "ga.baustein.gliederung": "Overzicht van deze versie",
  "ga.aufnahme.titel": "Onderdeel uit bestaande kennis toevoegen",
  "ga.aufnahme.koId": "Item",
  "ga.aufnahme.koVersion": "Versie",
  "ga.aufnahme.nachweis": "Bewijsstuk (optioneel)",
  "ga.aufnahme.knopf": "Opnemen",
  "ga.aufnahme.fassungUnbekannt":
    "Deze versie bestaat niet (meer). Kies een van de getoonde versies.",
  "ga.ordnen.hoch": "Omhoog",
  "ga.ordnen.runter": "Omlaag",
  "ga.voraussetzung.label": "Voorwaarde",
  "ga.voraussetzung.knopf": "Voorwaarde overnemen",
  "ga.vergleich.titel": "Wat is er veranderd?",
  "ga.vergleich.von": "Oudere stand",
  "ga.vergleich.bis": "Nieuwere stand",
  "ga.vergleich.knopf": "Vergelijken",
  "ga.vergleich.unveraendert": "Ongewijzigd. Dat zegt niets over juistheid.",
  "ga.vergleich.geaendert": "Gewijzigd.",
  "ga.vergleich.unbekannt": "Gevolg niet vast te stellen — vakinhoudelijk uit te zoeken.",
  "ga.vergleich.unbekannte": "Niet vast te stellen bevindingen: {{anzahl}}",
  "ga.vergleich.keineAussage": "Geen vergelijking mogelijk — er wordt geen gelijkheid beweerd.",
  "ga.feld.kopf": "Titel en doel",
  "ga.feld.geltung": "Toepassing",
  "ga.feld.voraussetzungen": "Voorwaarden",
  "ga.feld.bausteinbestand": "Verzameling bouwstenen",
  "ga.feld.reihenfolge": "Volgorde",
  "ga.feld.fassung": "Gebonden versie",
  "ga.feld.tabellenueberschriften": "Tabelkoppen",
  "ga.feld.abbildungen": "Afbeeldingen",
  "ga.entscheidung.titel": "Ter beslissing voorleggen",
  "ga.entscheidung.vorlegen": "Voorleggen",
  "ga.entscheidung.annehmen": "Aannemen",
  "ga.entscheidung.ablehnen": "Afwijzen",
  "ga.entscheidung.konflikt":
    "De werkinstructie is intussen gewijzigd. Laad de pagina opnieuw en probeer het nog eens.",
  "ga.kopf.titel": "Titel",
  "ga.kopf.zweck": "Doel",
  "ga.kopf.geltungsbereich": "Toepassingsgebied",
  "ga.kopf.voraussetzungen": "Voorwaarden",
  "ga.bereich.titel": "Werkinstructies",
  "ga.bereich.einleitung":
    "Stel bestaande kennis samen tot een leesbare stap-voor-stap-instructie – bijvoorbeeld voor het inwerken van nieuwe collega’s.",
  "ga.bereich.anlegen": "Nieuwe werkinstructie maken",
  // JOB 4357 — de opgeslagen voorraad. „Niets opgeslagen" en „kon niet kijken" zijn twee
  // verschillende uitspraken en delen nooit één zin (zie het DE-blok voor de onderbouwing).
  "ga.liste.titel": "Bestaande werkinstructies",
  "ga.liste.laedt": "De bestaande werkinstructies worden geladen …",
  "ga.liste.fehler":
    "De bestaande werkinstructies konden niet worden geladen. Laad de pagina opnieuw of probeer het later nog eens – een nieuwe instructie kun je toch maken.",
  "ga.liste.leer":
    "Er is nog geen werkinstructie. Maak hieronder je eerste – daarna verschijnt ze hier.",
  "ga.liste.stand": "Status",
  "ga.liste.urheber": "Gemaakt door",
  "ga.liste.geaendert": "Laatst gewijzigd",
  "ga.liste.bausteine": "Onderdelen: {{anzahl}}",
  "ga.liste.unvollstaendig": "Onvolledig voor jou – niet toegankelijke onderdelen: {{anzahl}}",
  // Werkpaden bij hetzelfde artikel (produkt:20261007:arbeitswege-objekt) — zie de.ts.
  "arbeitsweg.pruefen.sucht": "Het opgevraagde item wordt in de controlelijst gezocht …",
  "arbeitsweg.pruefen.fehlt":
    "Het opgevraagde item staat in deze weergave niet ter controle (al besloten of weggefilterd). Het volgende open item wordt getoond.",
  "arbeitsweg.pruefen.lesen": "Opgevraagd item openen",
  "arbeitsweg.pruefen.entschieden": "Besloten: „{{titel}}” –",
  "arbeitsweg.pruefen.oeffnen": "Item met actuele status openen",
  "arbeitsweg.pruefen.standOffen":
    "Status volgens de server: nog in controle, {{gruen}} van {{noetig}} goedkeuringen.",
  "arbeitsweg.pruefen.standRaus": "Status volgens de server: niet meer in de controlelijst.",
  "arbeitsweg.pruefen.weiter": "nu in controle: „{{titel}}”",
  "arbeitsweg.fassung": "Versie {{fassung}}",
  "arbeitsweg.fragen.bezug": "Vraag over het item „{{titel}}”",
  "arbeitsweg.fragen.zurueck": "Terug naar het item",
  "arbeitsweg.lesen.fassungAbweichend":
    "Je komt van versie {{genannt}}; dit item staat inmiddels op versie {{aktuell}}.",
  "arbeitsweg.klara.label": "Item",
  "arbeitsweg.klara.chat": "In „Vragen” verder vragen over dit item",
  // produkt:20261010:fragen-pruefen-einstieg — zie de.ts.
  "fragenEinstieg.erklaerung":
    "Hier stel je vragen aan jullie gecontroleerde kennis. Elk antwoord toont zijn bronnen en hun controlestatus – ontbreekt een basis, dan wordt het hiaat open benoemd.",
  "fragenEinstieg.ersterSchritt":
    "Eerste stap: typ je vraag in het veld hieronder (of dicteer hem) en verstuur hem met de pijl.",
  "fragenEinstieg.beispieleZeigen": "Fictieve voorbeelden tonen",
  "fragenEinstieg.beispieleVerbergen": "Voorbeelden verbergen",
  "fragenEinstieg.fiktiv": "fictief",
  "fragenEinstieg.fiktivTitel": "Fictief voorbeeld – verzonnen situatie, geen echte gegevens.",
  "fragenEinstieg.optionalTitel": "Optioneel – alleen indien nodig",
  "pruefgrund.label.warum": "Waarom bij jou",
  "pruefgrund.label.was": "Wat controleren",
  "pruefgrund.label.wirkung": "Effect",
  "pruefgrund.label.sichtbar": "Zichtbaarheid",
  "pruefgrund.anlass.new": "Nieuw ingediend.",
  "pruefgrund.anlass.revision": "Herzien (versie {{version}}).",
  "pruefgrund.warum.mir": "Aan jou toegewezen.",
  "pruefgrund.warum.andere":
    "Aan anderen toegewezen ({{anzahl}}) – staat in de open controlelijst van je rol.",
  "pruefgrund.warum.offen": "Niet toegewezen – staat in de open controlelijst van je rol.",
  "pruefgrund.wirkung":
    "Goedkeuren is één van {{need}} benodigde stemmen ({{have}} aanwezig). Terugvraag en afwijzen vragen een reden en leiden tot nawerk; niets wordt automatisch goedgekeurd.",
};

export { nl };
