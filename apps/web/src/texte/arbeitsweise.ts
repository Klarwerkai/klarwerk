// ================================================================================================
// Aufnahme `gesamt-hilfen` · R-0443 — DIE EIGENE SEITE „SO ARBEITET KLARWERK“.
// ================================================================================================
//
// Originalwortlaut: „Eine eigene Seite zeigt dem Anwender, wie das Wissensnetz aufgebaut ist und
// wie mit Klarwerk gearbeitet wird.“ Die Seite steht unter `/so-arbeitet-klarwerk`
// (`pages/Arbeitsweise.tsx`) für alle angemeldeten Rollen; ihre Texte stehen hier.
//
// WAS SIE WIEDERVERWENDET, statt es neu zu sagen: die kuratierte Sicht der gesetzten
// Fachbeziehungen (`SoArbeitetKlarwerk` in `pages/Stufe2.tsx`, R-1983) und die Bereichsnamen der
// Navigation (`nav.*`). Jeder Satz hier beschreibt, was die Anwendung heute tut — keine neue Funktion.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "arbeitsweise.",
  legacySchluessel: [],
  de: {
    "arbeitsweise.kicker": "Hilfe",
    "arbeitsweise.titel": "So arbeitet Klarwerk",
    "arbeitsweise.lead":
      "Wie das Wissensnetz aufgebaut ist und wie ihr damit arbeitet — auf einer Seite.",
    "arbeitsweise.netz.titel": "Wie das Wissensnetz aufgebaut ist",
    "arbeitsweise.netz.objekt":
      "Wissensobjekte sind die Knoten: jede Aussage mit Bedingungen, Maßnahmen, Belegen, Herkunft und Stand.",
    "arbeitsweise.netz.themen":
      "Schlagwörter verbinden Wissensobjekte zu Themen. Die Themenkarte zeigt, welche Themen es gibt und welche zusammen in denselben freigegebenen Wissensobjekten vorkommen — das ist abgeleitete Nähe, keine Fachaussage.",
    "arbeitsweise.netz.beziehungen":
      "Gesetzte Fachbeziehungen verantwortet ein Mensch — etwa dass ein Eintrag einen anderen ersetzt. Sie stehen unten in der Liste.",
    "arbeitsweise.netz.stand":
      "Jeder Knoten trägt seinen Stand: in Prüfung oder validiert. Widersprüche und Doppelungen werden sichtbar gemacht, nicht still aufgelöst.",
    "arbeitsweise.netz.karte": "Themenkarte öffnen",
    "arbeitsweise.arbeit.titel": "Wie mit Klarwerk gearbeitet wird",
    "arbeitsweise.arbeit.erfassen":
      "Erfassen: Wissen in eigenen Worten festhalten — tippen, diktieren oder aus einer Datei. Bis zum Einreichen bleibt es dein Entwurf.",
    "arbeitsweise.arbeit.pruefen":
      "Prüfen: Kolleginnen und Kollegen geben frei, stellen eine Rückfrage oder lehnen begründet ab. Validiert ist ein Eintrag erst mit genug Freigaben.",
    "arbeitsweise.arbeit.nutzen":
      "Nutzen: in der Bibliothek nachschlagen oder eine Frage stellen. Jede Antwort nennt die Einträge, auf die sie sich stützt.",
    "arbeitsweise.arbeit.pflegen":
      "Aktuell halten: Widersprüche klären und nach einer Änderung an einer Anlage erneut prüfen.",
    "arbeitsweise.arbeit.luecken":
      "Lücken schließen: wo eine Frage ohne Antwort bleibt, entsteht eine Wissenslücke, die jemand mit neuem Wissen schließt.",
    "arbeitsweise.arbeit.hinweis":
      "Nicht jeder Bereich steht jeder Rolle offen; wo deine Rolle nicht reicht, steht der Bereich ohne Link da.",
    "arbeitsweise.sicht.titel": "Die gesetzten Fachbeziehungen",
    "arbeitsweise.hilfe": "Zur Hilfe mit Kapiteln, häufigen Fragen und ausführlichen Artikeln",
    "arbeitsweise.einstieg":
      "So arbeitet Klarwerk — wie das Wissensnetz aufgebaut ist und wie ihr damit arbeitet",
  },
  en: {
    "arbeitsweise.kicker": "Help",
    "arbeitsweise.titel": "How Klarwerk works",
    "arbeitsweise.lead":
      "How the knowledge network is built and how you work with it — on one page.",
    "arbeitsweise.netz.titel": "How the knowledge network is built",
    "arbeitsweise.netz.objekt":
      "Knowledge objects are the nodes: each statement with conditions, measures, evidence, origin and status.",
    "arbeitsweise.netz.themen":
      "Tags connect knowledge objects into topics. The topic map shows which topics exist and which occur together in the same approved knowledge objects — that is derived closeness, not a subject-matter statement.",
    "arbeitsweise.netz.beziehungen":
      "Set subject-matter relations are the responsibility of a person — for example that one entry replaces another. They are listed below.",
    "arbeitsweise.netz.stand":
      "Every node carries its status: being checked or validated. Contradictions and duplicates are made visible, not silently resolved.",
    "arbeitsweise.netz.karte": "Open topic map",
    "arbeitsweise.arbeit.titel": "How you work with Klarwerk",
    "arbeitsweise.arbeit.erfassen":
      "Capture: record knowledge in your own words — type, dictate or from a file. Until you submit, it stays your draft.",
    "arbeitsweise.arbeit.pruefen":
      "Check: colleagues approve, ask a question or reject with a reason. An entry is only validated with enough approvals.",
    "arbeitsweise.arbeit.nutzen":
      "Use: look things up in the library or ask a question. Every answer names the entries it relies on.",
    "arbeitsweise.arbeit.pflegen":
      "Keep up to date: settle contradictions and check again after a change to equipment.",
    "arbeitsweise.arbeit.luecken":
      "Close gaps: where a question stays unanswered, a knowledge gap arises that someone closes with new knowledge.",
    "arbeitsweise.arbeit.hinweis":
      "Not every area is open to every role; where your role is not sufficient, the area is shown without a link.",
    "arbeitsweise.sicht.titel": "The set subject-matter relations",
    "arbeitsweise.hilfe":
      "To the help with chapters, frequently asked questions and detailed articles",
    "arbeitsweise.einstieg":
      "How Klarwerk works — how the knowledge network is built and how you work with it",
  },
  nl: {
    "arbeitsweise.kicker": "Help",
    "arbeitsweise.titel": "Zo werkt Klarwerk",
    "arbeitsweise.lead":
      "Hoe het kennisnetwerk is opgebouwd en hoe jullie ermee werken — op één pagina.",
    "arbeitsweise.netz.titel": "Hoe het kennisnetwerk is opgebouwd",
    "arbeitsweise.netz.objekt":
      "Kennisobjecten zijn de knopen: elke uitspraak met voorwaarden, maatregelen, bewijzen, herkomst en status.",
    "arbeitsweise.netz.themen":
      "Trefwoorden verbinden kennisobjecten tot onderwerpen. De themakaart toont welke onderwerpen er zijn en welke samen voorkomen in dezelfde vrijgegeven kennisobjecten — dat is afgeleide nabijheid, geen inhoudelijke uitspraak.",
    "arbeitsweise.netz.beziehungen":
      "Vastgelegde inhoudelijke relaties zijn de verantwoordelijkheid van een mens — bijvoorbeeld dat een vermelding een andere vervangt. Ze staan hieronder in de lijst.",
    "arbeitsweise.netz.stand":
      "Elke knoop draagt zijn status: in beoordeling of gevalideerd. Tegenstrijdigheden en dubbelingen worden zichtbaar gemaakt, niet stil opgelost.",
    "arbeitsweise.netz.karte": "Themakaart openen",
    "arbeitsweise.arbeit.titel": "Hoe je met Klarwerk werkt",
    "arbeitsweise.arbeit.erfassen":
      "Vastleggen: kennis in je eigen woorden noteren — typen, dicteren of uit een bestand. Tot je indient, blijft het je concept.",
    "arbeitsweise.arbeit.pruefen":
      "Controleren: collega’s geven vrij, stellen een vraag of wijzen gemotiveerd af. Een vermelding is pas gevalideerd met genoeg vrijgaven.",
    "arbeitsweise.arbeit.nutzen":
      "Gebruiken: in de bibliotheek opzoeken of een vraag stellen. Elk antwoord noemt de vermeldingen waarop het steunt.",
    "arbeitsweise.arbeit.pflegen":
      "Actueel houden: tegenstrijdigheden ophelderen en na een wijziging aan een installatie opnieuw controleren.",
    "arbeitsweise.arbeit.luecken":
      "Hiaten sluiten: waar een vraag onbeantwoord blijft, ontstaat een kennishiaat dat iemand met nieuwe kennis sluit.",
    "arbeitsweise.arbeit.hinweis":
      "Niet elk onderdeel staat open voor elke rol; waar je rol niet volstaat, staat het onderdeel er zonder link.",
    "arbeitsweise.sicht.titel": "De vastgelegde inhoudelijke relaties",
    "arbeitsweise.hilfe":
      "Naar de help met hoofdstukken, veelgestelde vragen en uitgebreide artikelen",
    "arbeitsweise.einstieg":
      "Zo werkt Klarwerk — hoe het kennisnetwerk is opgebouwd en hoe jullie ermee werken",
  },
} satisfies Textmodul;
