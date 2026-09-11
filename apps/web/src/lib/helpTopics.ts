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

// Reihenfolge = Anzeigereihenfolge. `to` ist bewusst nur eine vorhandene interne Route.
export const HELP_TOPICS: readonly HelpTopicDef[] = [
  {
    id: "firststart",
    titleKey: "help.firststart.title",
    bodyKey: "help.firststart.body",
    to: "/admin",
    tags: ["admin", "demodaten", "seed", "erststart", "onboarding", "setup"],
  },
  {
    id: "capture",
    titleKey: "help.capture.title",
    bodyKey: "help.capture.body",
    to: "/erfassen",
    tags: ["erfassen", "wissen", "entwurf", "draft", "interview", "diktat", "ko"],
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
    tags: ["fragen", "ask", "antwort", "wissenslücke", "gap"],
  },
  {
    id: "library",
    titleKey: "help.library.title",
    bodyKey: "help.library.body",
    to: "/bibliothek",
    tags: ["bibliothek", "library", "suche", "filter", "ko-detail", "wissensobjekt"],
  },
  {
    id: "validation",
    titleKey: "help.validation.title",
    bodyKey: "help.validation.body",
    to: "/validierung",
    tags: ["validierung", "peer", "bewerten", "freigabe", "vertrauen"],
  },
  {
    id: "tasks",
    titleKey: "help.tasks.title",
    bodyKey: "help.tasks.body",
    to: "/aufgaben",
    tags: ["aufgaben", "mytasks", "zuweisung", "todo"],
  },
  {
    id: "risk",
    titleKey: "help.risk.title",
    bodyKey: "help.risk.body",
    to: "/risiko",
    tags: ["risiko", "lücken", "gaps", "konflikte", "bus-faktor", "priorität"],
  },
  {
    id: "lifecycle",
    titleKey: "help.lifecycle.title",
    bodyKey: "help.lifecycle.body",
    to: "/lebenszyklus",
    tags: ["lebenszyklus", "lernpfad", "revalidierung", "asset", "reife"],
  },
  {
    id: "stufe2",
    titleKey: "help.stufe2.title",
    bodyKey: "help.stufe2.body",
    to: "/kapital",
    tags: ["stufe 2", "qm", "kapital", "management", "output", "evidence", "provenance"],
  },
  {
    id: "mobile",
    titleKey: "help.mobile.title",
    bodyKey: "help.mobile.body",
    to: "/mobile",
    tags: ["mobile", "offline", "pwa", "unterwegs"],
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
