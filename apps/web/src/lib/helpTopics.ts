// SCRUM-219: produktnahe Hilfekapitel + DOM-freie Suche. Die Kapitel verweisen nur auf echte
// App-Routen (kein Fremd-Link). Titel/Text liegen als i18n-Keys vor; die Suche arbeitet auf den
// bereits aufgelösten Texten (DOM-frei, testbar ohne i18n/React).

export interface HelpTopicDef {
  id: string;
  titleKey: string;
  bodyKey: string;
  to: string; // echte App-Route (aus navigation/routes)
  tags: readonly string[];
  /**
   * JOB 3468: Verlangt dieses Kapitel die GELTENDEN Upload-Grenzen auf seiner Karte?
   *
   * Die Zahlen stehen bewusst NICHT im Kapiteltext: sie kommen vom Server
   * (`GET /api/upload-limits`) und werden von der EINEN Anzeige dafür gezeigt
   * (`components/UploadLimitsHint.tsx` — dort ist ausgeschrieben, warum fest verdrahtete Zahlen im
   * Frontend verboten sind). Ein Text, der eine Zahl nennt, wäre beim nächsten Admin-Wechsel
   * falsch.
   *
   * ALS MERKMAL DER DATEN und nicht als Sonderfall der Seite: `Help.tsx` soll den Zusatz an dieser
   * Eigenschaft entscheiden, nicht an einer Kapitel-Kennung — genauso, wie ein ISO-Kapitel dort an
   * seinen externen Quellen erkannt wird und nicht an seiner ID (`Help.tsx:127`).
   */
  uploadLimits?: boolean;
}

// ================================================================================================
// JOB 4071 · WARUM DIE MERKMALE DER ZEHN ALTKAPITEL GEWACHSEN SIND — SUCHERHALT.
// ================================================================================================
//
// DER BEFUND (Prüfer BEN, Runde 1, mit der echten `filterHelpTopics` vor und nach der Änderung
// gemessen): Die Umformulierung der zehn Altkapitel hat die Fachwörter aus den TEXTEN genommen —
// und damit auch aus dem HEUHAUFEN, den `filterHelpTopics` durchsucht (`:327`: Titel + Text +
// Merkmale). Wer „single-source", „modelrun", „bus factor", „demo-seed" oder „revalidierungen"
// eintippte, fand danach nichts mehr. Das ist eine stille Verschlechterung: der Text wurde besser,
// die Auffindbarkeit schlechter.
//
// DIE TRENNUNG, DIE DAS LÖST:
//   · TITEL UND TEXT sind, was ein Mensch LIEST, um die Seite zu verstehen. Dort ist das Fachwort
//     verboten; der Wächter
//     `tests/hilfe-altkapitel-anwendersprache/altkapitel-sprechen-anwendersprache.test.ts` (B1)
//     prüft ausschliesslich diese beiden Felder.
//   · MERKMALE sind die Suchbegriffsliste des Kapitels — was ein Mensch TIPPT. Hier gehört das
//     abgelöste Fachwort hin: Wer es aus einer älteren Unterlage, aus dem Gespräch oder aus der
//     Oberfläche einer Nachbarseite kennt, landet weiter beim richtigen Kapitel und liest DORT den
//     Satz in Anwendersprache.
//
// WAS DAS SICHTBAR KOSTET — ehrlich, weil GEMESSEN und nicht angenommen: Die Merkmale sind NICHT
// unsichtbar. `pages/Help.tsx:222-229` zeichnet sie unter jeder Karte als kleine Pillenreihe
// (`:268` für die Kapitel hier, `:261-266` mit Überschrift für die ISO-Kapitel). Die Fachwörter
// stehen also weiter auf `/hilfe` — als Suchbegriffe unter der Karte, nicht mehr als Erklärung IM
// Text. Das war schon vor diesem Auftrag so: `bus-faktor`, `qm`, `evidence`, `provenance`, `asset`,
// `peer` und `seed` standen am Basisstand als Merkmale in genau dieser Reihe. Dieser Auftrag ändert
// den Charakter der Reihe nicht, er verlängert sie. Ob die Pillenreihe auf einer Fläche, die als
// Demo-Zugang ausgehändigt wird, überhaupt Bauleutewörter zeigen soll, ist eine Frage an
// `pages/Help.tsx` — ein eigener Schnitt, nicht dieser (die Datei ist hier gesperrt).
//
// WAS HIER NICHT NACHGEFÜHRT WIRD, und warum das kein Versäumnis ist: Eine Umformulierung ändert
// zwangsläufig Wortformen („zeigt" → „zeigen", „sind" → „ist"). Wollte man jede verlorene Wortform
// erhalten, dürfte kein Text je umgeschrieben werden. Nachgeführt sind deshalb genau zwei Klassen,
// beide gemessen und in `altkapitel-sprechen-anwendersprache.test.ts` (Gruppe D) einzeln gepinnt:
//   (1) die von diesem Auftrag ABGELÖSTEN FACHWÖRTER — sie sind absichtlich aus dem Text
//       verschwunden, also müssen sie hier stehen;
//   (2) die SACHWÖRTER des Kapitels (Substantive seines Gegenstands), die die neue Fassung nicht
//       mehr wörtlich trägt.
// Füllwörter und gebeugte Verbformen sind BEWUSST nicht dabei.
//
// EINE GRENZE BLEIBT GEPINNT: „bibliothek" muss GENAU `library` treffen
// (`tests/review26-hilfe-import/hilfe-findet-dateiimport.test.ts:311`), „pwa" genau `mobile`
// (`:312`). Kein Merkmal unten trägt eines dieser beiden Wörter in ein fremdes Kapitel.

// Reihenfolge = Anzeigereihenfolge. `to` ist bewusst nur eine vorhandene interne Route.
export const HELP_TOPICS: readonly HelpTopicDef[] = [
  {
    id: "firststart",
    titleKey: "help.firststart.title",
    bodyKey: "help.firststart.body",
    to: "/admin",
    tags: [
      "admin",
      "demodaten",
      "seed",
      "erststart",
      "onboarding",
      "setup",
      // JOB 4071 · Sucherhalt: „Review" war das abgelöste Fachwort dieses Kapitels (de/nl
      // `help.firststart.body` am Basisstand), „Einarbeitung"/„inwerken" sein Sachwort.
      "review",
      "einarbeitung",
      "inwerken",
      "demo data",
      "demodata",
      // Der Beispielbestand legt auch Widersprüche an — am Basisstand fand „konflikte" deshalb
      // `firststart` UND `risk`.
      "konflikte",
      "conflicts",
      "conflicten",
    ],
  },
  {
    id: "capture",
    titleKey: "help.capture.title",
    bodyKey: "help.capture.body",
    to: "/erfassen",
    tags: [
      "erfassen",
      "wissen",
      "entwurf",
      "draft",
      "interview",
      "diktat",
      "ko",
      // JOB 4071 · Sucherhalt: Sachwörter, die die neue Fassung nicht mehr wörtlich trägt —
      // „Diktat" nur auf Deutsch, „Erfahrungswissen" und „Text" in allen drei Sprachen.
      // „review" stand am Basisstand im englischen Text („the AI structures it, you review it") —
      // der Schritt „Prüfen & einreichen" dieses Kapitels ist genau das.
      "review",
      "dictation",
      "dictaat",
      "text",
      "tekst",
      "erfahrungswissen",
      "experience",
      "ervaringskennis",
      "strukturieren",
      "structure",
      "structureren",
    ],
  },
  // ==============================================================================================
  // JOB 3468 · REVIEW26-HILFE-IMPORT — DER DATEIIMPORT WAR GEBAUT UND IN DER HILFE UNSICHTBAR.
  // ==============================================================================================
  //
  // DER BEFUND (`gespraech/advisor-freitag/NUTZERBEFUNDE-AN-CLAUDE-20260908.md:163-171`):
  // „Hilfesuche import bleibt leer, obwohl Erfassen → Datei → Datei importieren vorhanden ist." Das
  // Kapitel `capture` darüber trägt kein einziges dieser Wörter; die Suche lief also ins Leere, und
  // der Mensch schloss daraus, es gäbe die Funktion nicht.
  //
  // WARUM EIN EIGENES KAPITEL UND NICHT NUR EIN MERKMAL AN `capture`: Ein angehängtes `import`
  // hätte die Suche beruhigt, ohne die Frage zu beantworten — weder der Einstieg noch die Grenzen
  // stünden da. Genau diese Halbheit war der gemeldete Mangel.
  //
  // WARUM DIE ROUTE EINEN PARAMETER TRÄGT, und warum das KEIN neuer Deep-Link ist: `/erfassen`
  // allein landet auf dem leeren Blatt, von dem aus noch zweimal weiterzuklicken wäre. Die Adresse
  // `/erfassen?weg=datei` IST der vorhandene Weg dorthin — eingeführt in JOB 3341, gelesen aus
  // `components/erfassen/wege.ts:49/65` und genauso gebaut von der Import-Kachel
  // (`components/ImportSourceGallery.tsx:77-79`). Dass beide Adressen übereinstimmen, hält
  // `tests/review26-hilfe-import/hilfe-findet-dateiimport.test.ts` (Fall R1) fest.
  //
  // UND SIE DARF NICHT `/erfassen` SEIN: die Seitenhilfe des Zahnrads rechnet „genau EIN Kapitel je
  // Route" (JOB 3028, `lib/navHilfe.ts`). Ein zweites Kapitel auf `/erfassen` hätte dem Menüpunkt
  // still seinen Erklärsatz gekostet — derselbe Grund, aus dem die ISO-Kapitel in einem eigenen
  // Modul wohnen (`pages/Help.tsx:20-25`).
  {
    id: "fileimport",
    titleKey: "help.fileimport.title",
    bodyKey: "help.fileimport.body",
    to: "/erfassen?weg=datei",
    // Die gemeldeten Suchwörter PLUS jede Dateiart, die `lib/extract.ts` (`detectFileKind`)
    // wirklich kennt — nicht erfunden, sondern erhoben: der Wächter `Q1/Q2` in
    // `tests/review26-hilfe-import/hilfe-findet-dateiimport.test.ts` liest die Union `FileKind` aus
    // der Quelle und wird rot, sobald eine Art dazukommt, die hier fehlt.
    tags: [
      "import",
      "importieren",
      "datei",
      "dateien",
      "hochladen",
      "upload",
      "dokument",
      "text",
      "txt",
      "markdown",
      "csv",
      "json",
      "docx",
      "word",
      "pdf",
      "pptx",
      "powerpoint",
      "image",
      "bild",
      "bilder",
    ],
    uploadLimits: true,
  },
  {
    id: "ask",
    titleKey: "help.ask.title",
    bodyKey: "help.ask.body",
    to: "/fragen",
    tags: [
      "fragen",
      "ask",
      "antwort",
      "wissenslücke",
      "gap",
      // JOB 4071 · Sucherhalt: die Mehrzahlform („antworten" trifft das Merkmal „antwort" NICHT —
      // der Filter vergleicht die ganze Anfrage als Teilstring) und die Quellenbindung der Antwort.
      "antworten",
      "answers",
      "antwoorden",
      "quellen",
      "sources",
      "bronnen",
      "quellengebunden",
      "source-bound",
      "brongebonden",
    ],
  },
  {
    id: "library",
    titleKey: "help.library.title",
    bodyKey: "help.library.body",
    to: "/bibliothek",
    tags: [
      "bibliothek",
      "library",
      "suche",
      "filter",
      "ko-detail",
      "wissensobjekt",
      // JOB 4071 · Sucherhalt: „Evidenz"/„evidence"/„bewijs" war das abgelöste Fachwort dieses
      // Kapitels; Kategorie, Status und Anhänge sind seine Sachwörter.
      "evidenz",
      "evidence",
      "bewijs",
      "kategorie",
      "category",
      "categorie",
      "status",
      "anhänge",
      "attachments",
      "bijlagen",
      "durchsuchen",
      "doorzoeken",
    ],
  },
  {
    id: "validation",
    titleKey: "help.validation.title",
    bodyKey: "help.validation.body",
    to: "/validierung",
    tags: [
      "validierung",
      "peer",
      "bewerten",
      "freigabe",
      "vertrauen",
      // JOB 4071 · Sucherhalt: „Schwelle"/„threshold"/„drempel" und die Bewertungsfarben standen
      // wörtlich in der Altfassung; „Review" ist das abgelöste Fachwort für genau diese Tätigkeit.
      "review",
      "schwelle",
      "threshold",
      "drempel",
      "gelb",
      "yellow",
      "geel",
      "rood",
      "autor",
      "author",
      "auteur",
      "kommentar",
      "comment",
      "opmerking",
    ],
  },
  {
    id: "tasks",
    titleKey: "help.tasks.title",
    bodyKey: "help.tasks.body",
    to: "/aufgaben",
    tags: [
      "aufgaben",
      "mytasks",
      "zuweisung",
      "todo",
      // JOB 4071 · Sucherhalt: „Rückfrage-Aufgaben", „zugewiesen" und „Wissensobjekt" standen
      // wörtlich in der Altfassung dieses Kapitels.
      "rückfrage",
      "rückfragen",
      "follow-up",
      "navraag",
      "zugewiesen",
      "assigned",
      "toegewezen",
      "tasks",
      "taken",
      "wissensobjekt",
      "kennisobject",
    ],
  },
  {
    id: "risk",
    titleKey: "help.risk.title",
    bodyKey: "help.risk.body",
    to: "/risiko",
    tags: [
      "risiko",
      "lücken",
      "gaps",
      "konflikte",
      "bus-faktor",
      "priorität",
      // JOB 4071 · Sucherhalt: „Bus-Faktor" und „Single-Source" sind die abgelösten Fachwörter
      // dieses Kapitels — in jeder Sprache in ihrer eigenen Gestalt. „conflicts"/„conflicten" fand
      // am Basisstand kein anderes Kapitel mehr; die Widersprüche gehören sachlich hierher.
      "single-source",
      "bus factor",
      "busfactor",
      "einzelquelle",
      "enkele bron",
      "wissenslücken",
      "kennishiaten",
      "knowledge gaps",
      "widersprüche",
      "contradictions",
      "tegenstrijdigheden",
      "conflicts",
      "conflicten",
      "priorisieren",
      "prioritise",
      "prioriteren",
      "assigned",
    ],
  },
  {
    id: "lifecycle",
    titleKey: "help.lifecycle.title",
    bodyKey: "help.lifecycle.body",
    to: "/lebenszyklus",
    tags: [
      "lebenszyklus",
      "lernpfad",
      "revalidierung",
      "asset",
      "reife",
      // JOB 4071 · Sucherhalt: „Revalidierungen", „Asset-Änderungen" und „Demo-Seed" sind die
      // abgelösten Fachwörter. Die Mehrzahl- und Zusammensetzungsformen stehen EINZELN da, weil der
      // Filter die ganze Anfrage als Teilstring sucht: „revalidierungen" trifft „revalidierung"
      // nicht.
      "revalidierungen",
      "revalidation",
      "revalidations",
      "hervalidatie",
      "hervalidaties",
      "asset-änderungen",
      "assetwijzigingen",
      "demo-seed",
      "beispiel-lernpfad",
      "example learning path",
      "voorbeeldleerpad",
      "lernpfade",
      "leerpad",
      "rollenspezifisch",
      "role-specific",
      "rolspecifiek",
    ],
  },
  {
    id: "stufe2",
    titleKey: "help.stufe2.title",
    bodyKey: "help.stufe2.body",
    to: "/kapital",
    tags: [
      "stufe 2",
      "qm",
      "kapital",
      "management",
      "output",
      "evidence",
      "provenance",
      // JOB 4071 · Sucherhalt: der ganze Fachwortsatz dieses Kapitels — „ModelRun", „read-only",
      // „fensterbasiert" und die Kürzel, unter denen die Altfassung es je Sprache führte (QM/QA/KM).
      "modelrun",
      "read-only",
      "fensterbasiert",
      "window-based",
      "venstergebaseerd",
      "herkomstindex",
      "bewijs",
      "qa",
      "km",
      "index",
      "dokumente",
      "documents",
      "documenten",
      "auswertungen",
      "reports",
      "rapportages",
    ],
  },
  {
    id: "mobile",
    titleKey: "help.mobile.title",
    bodyKey: "help.mobile.body",
    to: "/mobile",
    tags: [
      "mobile",
      "offline",
      "pwa",
      "unterwegs",
      // JOB 4071 · Sucherhalt: „Entwürfe", das Nachtragen ohne Verbindung und das Nachschlagen
      // standen wörtlich in der Altfassung.
      "entwürfe",
      "drafts",
      "concepten",
      "synchronisieren",
      "sync",
      "synchroniseren",
      "lookup",
      "opzoeken",
    ],
  },
  // ==============================================================================================
  // JOB 3741 · SEITENHILFE-LÜCKEN — ZEHN MENÜPUNKTE HATTEN KEINEN ERKLÄRSATZ.
  // ==============================================================================================
  //
  // DER BEFUND (Steuerung, 12.09.2026, am main-Stand erhoben): Die Mechanik war vollständig gebaut,
  // es fehlten die KAPITEL. `shell/ZahnradMenue.tsx:39-48` holt zu der Seite, auf der jemand steht,
  // den Erklärsatz ihres Hilfekapitels; gibt es keines, steht dort die Leermeldung
  // `menue.seitenhilfe.leer` (`:57`). Genau die sah ein Neuling auf zehn Menüpunkten — auf einer
  // Fläche, die Pedi als Demo-Zugang aushändigen will, damit sich jemand „relativ schnell
  // einarbeitet" (`gespraech/UEBERGABE-20260911-ABSCHLUSS/AKTEN/SICHTBARES-GESPRAECH.jsonl:695`).
  //
  // DIE ROUTE IST NICHT ABGETIPPT, sondern gegen `app/navigation.ts` gepinnt: die Kennung jedes
  // Kapitels hier unten ist die `id` SEINES Menüpunkts, und `to` ist dessen `path`. Der Wächter
  // `tests/seitenhilfe-navkapitel/jeder-menuepunkt-hat-einen-erklaersatz.test.ts` (P1) rechnet
  // beides nach, und seine Sollmenge erhebt er aus `NAV_GROUPS`/`FOOT_ITEMS` — kommt morgen ein
  // Menüpunkt ohne Kapitel dazu, wird er von selbst rot. Eine hier abgeschriebene Routenliste wäre
  // die zweite Wahrheit, vor der `lib/navHilfe.ts:13-16` warnt.
  //
  // DREI ROUTEN BLEIBEN AUSDRÜCKLICH OHNE KAPITEL, jede mit ihrem Grund:
  //   · `/admin`     — die begründete Ausnahme seit JOB 3028 (`navHilfe.ts:29-43`): das dort
  //                    liegende `firststart` beantwortet eine ANDERE Frage.
  //   · `/start`, `/entwuerfe` — JOB 3669 baut dort die andere Hälfte (Tipps IN der Seite). Zwei
  //                    Bahnen an derselben Aussage sind verboten.
  //
  // KEIN TEXT HIER BEHAUPTET EINEN ZUSTAND. Die Kapitel sind statische Sätze aus `i18n.ts`, ohne
  // Abruf und ohne Cache; ein Satz wie „hier ist alles geprüft" wäre eine Aussage über Daten ohne
  // Datengrundlage. Sie sagen, was die Seite TUT, und nennen keine Zahl (dieselbe Regel wie oben
  // bei `uploadLimits` — Zahlen kommen vom Server, nie aus einem Kapiteltext).
  {
    id: "wissensnetz",
    titleKey: "help.wissensnetz.title",
    bodyKey: "help.wissensnetz.body",
    to: "/wissensnetz",
    // Die Merkmale tragen den Menüpunkt-Namen in allen drei Sprachen (`nav.wissensnetz`), damit die
    // Suche auf `/hilfe` die Seite unter dem Wort findet, unter dem sie im Menü steht.
    tags: ["themenkarte", "topic map", "themakaart", "wissensnetz", "themen", "topics", "netz"],
  },
  {
    id: "extern",
    titleKey: "help.extern.title",
    bodyKey: "help.extern.body",
    to: "/extern",
    tags: [
      "externes wissen",
      "external knowledge",
      "externe kennis",
      "extern",
      "quellen",
      "sources",
      "recherche",
    ],
  },
  {
    id: "konflikte",
    titleKey: "help.konflikte.title",
    bodyKey: "help.konflikte.body",
    to: "/konflikte",
    tags: [
      "konflikte",
      "conflicts",
      "conflicten",
      "widerspruch",
      "auflösen",
      "zweitmeinung",
      "gilt",
    ],
  },
  {
    id: "duplikate",
    titleKey: "help.duplikate.title",
    bodyKey: "help.duplikate.body",
    to: "/duplikate",
    tags: [
      "duplikate",
      "duplicates",
      "duplicaten",
      "doppelt",
      "dublette",
      "überschneidung",
      "verknüpfen",
    ],
  },
  {
    id: "analytics",
    titleKey: "help.analytics.title",
    bodyKey: "help.analytics.body",
    to: "/analytics",
    tags: [
      "analytics & audit",
      "analytics",
      "audit",
      "kennzahlen",
      "protokoll",
      "log",
      "statistik",
    ],
  },
  {
    id: "output",
    titleKey: "help.output.title",
    bodyKey: "help.output.body",
    to: "/output",
    tags: ["auswertungen", "reports", "rapportages", "dokument", "document", "erzeugen"],
  },
  {
    id: "import",
    titleKey: "help.import.title",
    bodyKey: "help.import.body",
    to: "/import",
    tags: [
      "import & quellen",
      "import & sources",
      "import & bronnen",
      "importkandidaten",
      "vorschläge",
      "übernehmen",
      "ablehnen",
    ],
  },
  {
    id: "graph",
    titleKey: "help.graph.title",
    bodyKey: "help.graph.body",
    to: "/graph",
    tags: ["wissensgraph", "knowledge graph", "kennisgraaf", "graph", "knoten", "verbindungen"],
  },
  {
    id: "hilfe",
    titleKey: "help.hilfe.title",
    bodyKey: "help.hilfe.body",
    to: "/hilfe",
    tags: ["hilfe", "help", "hilfekapitel", "handbuch", "anleitung", "nachschlagen"],
  },
  {
    id: "profil",
    titleKey: "help.profil.title",
    bodyKey: "help.profil.body",
    to: "/profil",
    tags: [
      "profil",
      "profile",
      "profiel",
      "konto",
      "account",
      "sprache",
      "language",
      "passwort",
      "abmelden",
      "meine wirkung",
    ],
  },
];

// Bereits aufgelöste, durchsuchbare Repräsentation eines Kapitels.
export interface HelpSearchItem {
  id: string;
  title: string;
  body: string;
  tags: readonly string[];
}

// DOM-freie Suche über Titel, Text und Tags. Leere/whitespace-Query → alle Kapitel.
export function filterHelpTopics<T extends HelpSearchItem>(
  items: readonly T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) {
    return [...items];
  }
  return items.filter((item) => {
    const haystack = `${item.title} ${item.body} ${item.tags.join(" ")}`.toLowerCase();
    return haystack.includes(q);
  });
}
