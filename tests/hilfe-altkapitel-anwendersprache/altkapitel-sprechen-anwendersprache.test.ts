// ================================================================================================
// JOB 4071 · DIE ZEHN ALTKAPITEL DER HILFE SPRECHEN ANWENDERSPRACHE — IN DE, EN UND NL.
// ================================================================================================
//
// DER BEFUND, am Basisstand `abc60e4` in `apps/web/src/i18n.ts` selbst aufgeschlagen: die elf
// Kapitel aus SCRUM-219/JOB 3468 tragen Wörter, die nur die Bauleute kennen — „Bus-Faktor und
// Single-Source-Bereiche" (`:5032`), „Evidence- und Provenance-Index, ModelRun-Protokoll" (`:5041`),
// „fällige Revalidierungen (z. B. nach Asset-Änderungen) … Nach dem Demo-Seed" (`:5035`). Wer den
// Demo-Zugang in die Hand bekommt, schlägt genau diese Kapitel auf.
//
// DER MASSSTAB IST NICHT ERFUNDEN, sondern steht seit JOB 3741 im Haus (`i18n.ts:5073-5076`):
// „Jeder Text beantwortet drei Fragen — was ist das hier, was kann ich tun, was ist der nächste
// Schritt — ohne Fachwort, ohne Zahl und ohne eine Aussage über den Datenstand."
//
// WAS DIESE DATEI MISST UND WAS NICHT. Mechanisch prüfbar ist die ABWESENHEIT der Fachwörter und
// die Länge. Dass ein Mensch ohne Vorwissen den Text versteht, misst kein Lauf — das belegt die
// Rückgabe Kapitel für Kapitel mit alter und neuer Fassung nebeneinander. Dieser Wächter allein
// wäre der Nachweis nicht; er hält fest, dass die Fachwörter nicht zurückkommen.
//
// ZWEI BAUVORSCHRIFTEN AUS PRÜFERLEHREN:
//   (a) DIE SOLLMENGE KOMMT AUS `HELP_TOPICS`, nicht aus einer hier abgeschriebenen Liste (Fall A1
//       und A2). Eine abgeschriebene Kapitelliste wäre die zweite Wahrheit, vor der
//       `lib/navHilfe.ts:13-16` warnt: wer ein Kapitel entfernt, entfernte damit auch die eigene
//       Sollmenge, und der Lauf prüfte still eines weniger.
//   (b) DER VERGLEICH STEHT IM CALLBACK jedes Falles, nicht als erwarteter Text in der
//       `it.each`-Tabelle („Bei `it.each` genügt der erwartete Text in der Tabelle nicht als
//       Deckungsbeleg"). Die Tabelle trägt ausschließlich Sprache und Kapitelkennung.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  HELP_TOPICS,
  type HelpSearchItem,
  filterHelpTopics,
} from "../../apps/web/src/lib/helpTopics";
import { ISO_HELP_TOPICS, isoHelpSprache } from "../../apps/web/src/lib/helpTopics.iso";

/** Die drei Sprachen, die `i18n.ts` als eigene Blöcke führt — `nl` fällt NICHT auf `de` zurück. */
const SPRACHEN = ["de", "en", "nl"] as const;
type Sprache = (typeof SPRACHEN)[number];

/** Die zehn Kapitel dieses Auftrags. Fall A1/A2 hält sie gegen `HELP_TOPICS`. */
const ALTKAPITEL = [
  "firststart",
  "capture",
  "ask",
  "library",
  "validation",
  "tasks",
  "risk",
  "lifecycle",
  "stufe2",
  "mobile",
] as const;

/**
 * Die begründete Ausnahme: `fileimport` steht zwischen den zehn, ist aber seit JOB 3468 schon eine
 * Anleitung in Anwendersprache und von `tests/review26-hilfe-import/hilfe-karte-dateiimport.test.tsx`
 * (D3) auf die echten Beschriftungen gepinnt. Es wird gelesen, nicht geändert.
 */
const AUSNAHME = "fileimport";

/** Das erste Kapitel des JOB-3741-Blocks — die Grenze, hinter der die zweite Garnitur beginnt. */
const ERSTES_NEUES_KAPITEL = "wissensnetz";

/**
 * DER SCHNITT DER ANWENDUNG, nicht ein hier erfundener Wert: Klara reicht jeden Hilfetext bei 700
 * Zeichen beschnitten an die Modellkante (`apps/web/src/components/KlaraAssistant.tsx:310`,
 * `body: e.body.slice(0, 700)`). Was darüber hinausgeht, kommt am Modell als Rumpf an — belegt im
 * Kommentarblock `i18n.ts:5108-5111` und gemessen an der echten Kante von
 * `tests/app/f0304-klara-assistenzflaeche.test.tsx` (A3).
 */
const SCHNITT = 700;

// ------------------------------------------------------------------------------------------------
// DIE FACHWORTLISTE — ERHOBEN, NICHT ERFUNDEN.
// ------------------------------------------------------------------------------------------------
//
// Jeder Eintrag nennt seine Fundstelle am Basisstand `abc60e4`. Wo ein Fachwort in einer Sprache
// eine eigene Gestalt hat, steht diese Gestalt als eigener Eintrag — sonst prüfte der Lauf Deutsch
// dreimal und Niederländisch nie (die Halbheit, gegen die §4 des Auftrags steht).
//
// ZWEI ARTEN, UND DER GRUND DAFÜR:
//   · `teil`       — der Fund ist ein Teilstring. Für Stämme („revalidier…") und für zusammen-
//                    gesetzte Fachwörter, die als Teilstring eindeutig sind.
//   · `wortanfang` — der Fund muss an einer Wortgrenze BEGINNEN (`\b`). Für kurze und für in
//                    Alltagswörtern steckende Formen: `peer` als Teilstring träfe „appear", `km`
//                    träfe „werkmap", `asset` soll aber auch „assets" treffen. Kalibriert in B0.
type Art = "teil" | "wortanfang";

interface Fachwort {
  wort: string;
  art: Art;
  fundstelle: string;
}

const FACHWOERTER: readonly Fachwort[] = [
  { wort: "bus-faktor", art: "teil", fundstelle: "de help.risk.body i18n.ts:5032" },
  { wort: "bus factor", art: "teil", fundstelle: "en help.risk.body i18n.ts:10545" },
  { wort: "busfactor", art: "teil", fundstelle: "nl help.risk.body i18n.ts:15634" },
  {
    wort: "single-source",
    art: "teil",
    fundstelle: "de/en/nl help.risk.body i18n.ts:5032, :10545, :15634",
  },
  { wort: "evidenz", art: "teil", fundstelle: "de help.library.body i18n.ts:5026" },
  {
    wort: "evidence",
    art: "teil",
    fundstelle: "en help.library.body i18n.ts:10539 und help.stufe2.body :10554",
  },
  {
    wort: "bewijs",
    art: "teil",
    fundstelle: "nl help.library.body i18n.ts:15628 und help.stufe2.body :15643",
  },
  {
    wort: "provenance",
    art: "teil",
    fundstelle: "de/en help.stufe2.body i18n.ts:5041, :10554",
  },
  { wort: "herkomstindex", art: "teil", fundstelle: "nl help.stufe2.body i18n.ts:15643" },
  {
    wort: "modelrun",
    art: "teil",
    fundstelle: "de/en/nl help.stufe2.body i18n.ts:5041, :10554, :15643",
  },
  { wort: "revalidier", art: "teil", fundstelle: "de help.lifecycle.body i18n.ts:5035" },
  { wort: "revalidat", art: "teil", fundstelle: "en help.lifecycle.body i18n.ts:10548" },
  { wort: "hervalidat", art: "teil", fundstelle: "nl help.lifecycle.body i18n.ts:15637" },
  {
    wort: "read-only",
    art: "teil",
    fundstelle: "de/en/nl help.stufe2.body i18n.ts:5041, :10554, :15643",
  },
  { wort: "fensterbasiert", art: "teil", fundstelle: "de help.stufe2.body i18n.ts:5041" },
  { wort: "window-based", art: "teil", fundstelle: "en help.stufe2.body i18n.ts:10554" },
  { wort: "venstergebaseerd", art: "teil", fundstelle: "nl help.stufe2.body i18n.ts:15643" },
  { wort: "demo-seed", art: "teil", fundstelle: "de/nl help.lifecycle.body i18n.ts:5035, :15637" },
  { wort: "seed", art: "wortanfang", fundstelle: "en help.lifecycle.body i18n.ts:10548" },
  {
    wort: "asset",
    art: "wortanfang",
    fundstelle: "de/en help.lifecycle.body i18n.ts:5035, :10548",
  },
  { wort: "qm", art: "wortanfang", fundstelle: "de help.stufe2.title/body i18n.ts:5039, :5041" },
  { wort: "qa", art: "wortanfang", fundstelle: "en help.stufe2.title/body i18n.ts:10552, :10554" },
  { wort: "km", art: "wortanfang", fundstelle: "nl help.stufe2.title/body i18n.ts:15641, :15643" },
  { wort: "review", art: "wortanfang", fundstelle: "de help.firststart.body i18n.ts:5023" },
  {
    wort: "peer",
    art: "wortanfang",
    fundstelle: "Hausvokabular: ko.sourceValidated i18n.ts:3027, val.intro :3217",
  },
  {
    wort: "stage-1",
    art: "teil",
    fundstelle: "Hausvokabular: pilot.next.start i18n.ts:5000, pilot.next.body :4999",
  },
];

/** Alle Fachwörter, die in `text` stecken — in der Reihenfolge der Liste, damit Funde lesbar sind. */
function fachwortfunde(text: string): string[] {
  const klein = text.toLowerCase();
  return FACHWOERTER.filter((f) =>
    f.art === "teil"
      ? klein.includes(f.wort)
      : new RegExp(`\\b${f.wort.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(klein),
  ).map((f) => f.wort);
}

/** Der hinterlegte Wert EINER Sprache, ohne Rückfall auf Deutsch. */
function wert(lng: Sprache, key: string): string {
  return String(i18n.getResource(lng, "translation", key) ?? "");
}

/** Die Tabelle trägt NUR Sprache und Kennung — der Vergleich steht im Callback (Bauvorschrift b). */
const FAELLE: { lng: Sprache; id: string }[] = SPRACHEN.flatMap((lng) =>
  ALTKAPITEL.map((id) => ({ lng, id: id as string })),
);

describe("JOB 4071 · A — die Sollmenge kommt aus HELP_TOPICS, nicht aus dieser Datei", () => {
  it("A1: jede der zehn Kennungen steht in `HELP_TOPICS`", () => {
    const vorhanden = HELP_TOPICS.map((t) => t.id);
    for (const id of ALTKAPITEL) {
      expect(
        vorhanden,
        `\`${id}\` ist kein Hilfekapitel mehr — dieser Wächter prüfte sonst ein Kapitel weniger, ohne es zu sagen`,
      ).toContain(id);
    }
  });

  it("A2: vor `wissensnetz` steht kein Kapitel außer den zehn und `fileimport`", () => {
    const grenze = HELP_TOPICS.findIndex((t) => t.id === ERSTES_NEUES_KAPITEL);
    expect(
      grenze,
      `\`${ERSTES_NEUES_KAPITEL}\` ist nicht mehr das erste Kapitel des JOB-3741-Blocks — die Grenze stimmt nicht mehr`,
    ).toBeGreaterThan(0);
    const fremd = HELP_TOPICS.slice(0, grenze)
      .map((t) => t.id)
      .filter((id) => !(ALTKAPITEL as readonly string[]).includes(id) && id !== AUSNAHME);
    expect(
      fremd,
      "diese Kapitel stehen im Altbestand, werden von diesem Wächter aber nicht geprüft — Liste nachführen oder Kapitel verschieben",
    ).toEqual([]);
  });
});

describe("JOB 4071 · B — kein internes Fachwort in Titel und Text", () => {
  it("B0: der Prüfer greift — Kalibrierung an der Fassung VOR diesem Auftrag", () => {
    // Positivproben: die wörtlich zitierten Altfassungen fallen durch.
    expect(
      fachwortfunde("Risiko zeigt Wissenslücken, Bus-Faktor und Single-Source-Bereiche."),
    ).toEqual(["bus-faktor", "single-source"]);
    expect(
      fachwortfunde(
        "Die erweiterten QM-Sichten (Kapital/Management, Evidence- und Provenance-Index, ModelRun-Protokoll) sind read-only und fensterbasiert.",
      ),
    ).toEqual(["evidence", "provenance", "modelrun", "read-only", "fensterbasiert", "qm"]);
    expect(
      fachwortfunde(
        "Lifecycle shows due revalidations (e.g. after asset changes). After the demo seed an example learning path is visible.",
      ),
    ).toEqual(["revalidat", "seed", "asset"]);
    expect(fachwortfunde("De uitgebreide KM-weergaven met bewijs- en herkomstindex.")).toEqual([
      "bewijs",
      "herkomstindex",
      "km",
    ]);
    // Negativprobe: ein harmloser Satz fällt NICHT durch — sonst prüfte der Lauf nur Sprache an sich.
    expect(
      fachwortfunde("Ein Klick öffnet das Wissensobjekt mit seiner Aussage und seinen Quellen."),
    ).toEqual([]);
    // Und die gefährlichen Nachbarn, wegen derer `peer`, `km`, `qa` an der Wortgrenze hängen: ohne
    // `\b` wäre jeder dieser drei Sätze ein Falschalarm, und der Wächter nach zwei Tagen aus.
    expect(fachwortfunde("The list appears as soon as the page has loaded.")).toEqual([]);
    expect(fachwortfunde("Open je werkmap en kies daar een onderwerp.")).toEqual([]);
    expect(fachwortfunde("Die Anlage ist eine Presse; der Speer gehört nicht hierher.")).toEqual(
      [],
    );
  });

  it.each(FAELLE)("B1 · $lng/$id: Titel und Text tragen kein Fachwort", ({ lng, id }) => {
    const titel = wert(lng, `help.${id}.title`);
    const text = wert(lng, `help.${id}.body`);
    expect(titel.length, `help.${id}.title fehlt in ${lng}`).toBeGreaterThan(0);
    expect(text.length, `help.${id}.body fehlt in ${lng}`).toBeGreaterThan(0);
    const funde = fachwortfunde(`${titel}\n${text}`);
    expect(
      funde,
      `help.${id} (${lng}) spricht Bauleutesprache: ${funde.join(", ")} — Titel: „${titel}“`,
    ).toEqual([]);
  });
});

describe("JOB 4071 · C — kein Text läuft in den Schnitt der Klara-Kante", () => {
  it.each(FAELLE)("C1 · $lng/$id: der Text bleibt innerhalb des Schnitts", ({ lng, id }) => {
    const text = wert(lng, `help.${id}.body`);
    expect(
      text.length,
      `help.${id}.body (${lng}) ist ${text.length} Zeichen lang; ab ${SCHNITT} geht er gekürzt an die Modellkante`,
    ).toBeLessThanOrEqual(SCHNITT);
  });
});

// ================================================================================================
// GRUPPE D · SUCHERHALT — DER MANGEL, DEN RUNDE 1 GEBAUT HAT.
// ================================================================================================
//
// DER BEFUND (Prüfer BEN, Runde 1, mit der echten `filterHelpTopics` vor und nach der Änderung in
// jeder Sprache gemessen): Runde 1 nahm die Fachwörter aus den Texten — und damit aus dem
// Heuhaufen, den die Suche durchsucht (`helpTopics.ts:327`: `title body tags`). Sechs Beispiele aus
// seinem Protokoll, jeweils „vorher genau ein Kapitel, danach nichts":
//   de „single-source" → `risk` · de „modelrun" → `stufe2` · de „demo-seed" → `lifecycle`
//   de „revalidierungen" → `lifecycle` · en „bus factor" → `risk` · nl „busfactor" → `risk`
// Der Text wurde besser, die Auffindbarkeit schlechter, und KEIN Lauf sagte es. Genau diese Lücke
// schliesst diese Gruppe.
//
// WAS SIE MISST UND WAS BEWUSST NICHT. Gepinnt ist die KANONISCHE SUCHFORM jedes abgelösten
// Fachworts und jedes Sachworts, das die neue Fassung nicht mehr wörtlich trägt. NICHT gepinnt sind
// Füllwörter und gebeugte Verbformen („zeigt" → „zeigen", „sind" → „ist"): eine Umformulierung
// ändert die zwangsläufig, und wer sie alle erhalten wollte, dürfte keinen Text je umschreiben.
// Ebenfalls nicht gepinnt sind die zusammengesetzten Prosaformen der Altfassung
// („modelrun-protokoll", „single-source-bereiche", „qm-sichten"): der Filter sucht die GANZE Anfrage
// als Teilstring, und wer tippt, tippt den Stamm. Der Stamm ist gepinnt.
//
// WARUM DER FALL D0 DAVORSTEHT: Ohne ihn wäre diese Gruppe grün, sobald ein Kapitel das Wort
// zufällig doch noch im Text trägt — sie prüfte dann nicht die Merkmale, sondern nichts. D0 baut
// denselben Suchraum OHNE Merkmale und weist nach, dass genau BENs sechs Beispiele dann wieder
// unauffindbar sind. Erst damit ist belegt, dass die Merkmale die tragende Wirkung haben.

/** Der Suchraum der Hilfe, aufgelöst — dieselbe Zusammenstellung wie `pages/Help.tsx:89-108`. */
function suchraum(lng: Sprache, ohneMerkmale = false): HelpSearchItem[] {
  const isoLng = isoHelpSprache(lng);
  return [
    ...HELP_TOPICS.map((topic) => ({
      id: topic.id,
      title: wert(lng, topic.titleKey),
      body: wert(lng, topic.bodyKey),
      tags: ohneMerkmale ? [] : topic.tags,
    })),
    ...ISO_HELP_TOPICS.map((topic) => ({
      id: topic.id,
      title: topic.title[isoLng],
      body: topic.body[isoLng],
      tags: ohneMerkmale ? [] : topic.tags,
    })),
  ];
}

/** Die echte Suchfunktion der Seite, nicht eine hier nachgebaute. */
function treffer(lng: Sprache, frage: string, ohneMerkmale = false): string[] {
  return filterHelpTopics(suchraum(lng, ohneMerkmale), frage).map((i) => i.id);
}

interface Sucherhalt {
  lng: Sprache;
  id: string;
  frage: string;
}

/**
 * Was weiter gefunden werden muss. Jede Zeile stand am Basisstand `2fcc3f6` im Titel oder Text
 * IHRES Kapitels und findet es dort — nachgemessen mit derselben Funktion, die dieser Lauf ruft.
 */
const SUCHERHALT: readonly Sucherhalt[] = [
  // ---- firststart: „Review" war das Fachwort, „Einarbeitung" das Sachwort; der Beispielbestand
  //      legt auch Widersprüche an (am Basisstand fand „konflikte" firststart UND risk).
  { lng: "de", id: "firststart", frage: "review" },
  { lng: "nl", id: "firststart", frage: "review" },
  { lng: "de", id: "firststart", frage: "einarbeitung" },
  { lng: "nl", id: "firststart", frage: "inwerken" },
  { lng: "de", id: "firststart", frage: "konflikte" },
  { lng: "en", id: "firststart", frage: "conflicts" },
  { lng: "nl", id: "firststart", frage: "conflicten" },
  // ---- capture: „review" (en: „you review it") plus die Sachwörter des Erfassens.
  { lng: "en", id: "capture", frage: "review" },
  { lng: "de", id: "capture", frage: "text" },
  { lng: "en", id: "capture", frage: "text" },
  { lng: "nl", id: "capture", frage: "tekst" },
  { lng: "en", id: "capture", frage: "dictation" },
  { lng: "nl", id: "capture", frage: "dictaat" },
  { lng: "de", id: "capture", frage: "erfahrungswissen" },
  { lng: "en", id: "capture", frage: "experience" },
  { lng: "nl", id: "capture", frage: "ervaringskennis" },
  // ---- ask: die Mehrzahl von „Antwort" und die Quellenbindung der Antwort.
  { lng: "de", id: "ask", frage: "antworten" },
  { lng: "en", id: "ask", frage: "answers" },
  { lng: "nl", id: "ask", frage: "antwoorden" },
  { lng: "de", id: "ask", frage: "quellen" },
  { lng: "en", id: "ask", frage: "sources" },
  { lng: "nl", id: "ask", frage: "bronnen" },
  { lng: "de", id: "ask", frage: "quellengebunden" },
  { lng: "en", id: "ask", frage: "source-bound" },
  { lng: "nl", id: "ask", frage: "brongebonden" },
  // ---- library: „Evidenz"/„evidence"/„bewijs" war das Fachwort.
  { lng: "de", id: "library", frage: "evidenz" },
  { lng: "en", id: "library", frage: "evidence" },
  { lng: "nl", id: "library", frage: "bewijs" },
  { lng: "de", id: "library", frage: "kategorie" },
  { lng: "en", id: "library", frage: "category" },
  { lng: "nl", id: "library", frage: "categorie" },
  { lng: "de", id: "library", frage: "status" },
  { lng: "en", id: "library", frage: "status" },
  { lng: "nl", id: "library", frage: "status" },
  { lng: "de", id: "library", frage: "anhänge" },
  { lng: "en", id: "library", frage: "attachments" },
  { lng: "nl", id: "library", frage: "bijlagen" },
  // ---- validation: „Schwelle" und die Bewertungsfarben standen wörtlich in der Altfassung.
  { lng: "de", id: "validation", frage: "review" },
  { lng: "de", id: "validation", frage: "schwelle" },
  { lng: "en", id: "validation", frage: "threshold" },
  { lng: "nl", id: "validation", frage: "drempel" },
  { lng: "de", id: "validation", frage: "gelb" },
  { lng: "en", id: "validation", frage: "yellow" },
  { lng: "nl", id: "validation", frage: "geel" },
  { lng: "de", id: "validation", frage: "autor" },
  { lng: "en", id: "validation", frage: "author" },
  { lng: "nl", id: "validation", frage: "auteur" },
  { lng: "de", id: "validation", frage: "kommentar" },
  { lng: "en", id: "validation", frage: "comment" },
  { lng: "nl", id: "validation", frage: "opmerking" },
  // ---- tasks: „Rückfrage-Aufgaben", „zugewiesen", „Wissensobjekt".
  { lng: "de", id: "tasks", frage: "rückfrage" },
  { lng: "en", id: "tasks", frage: "follow-up" },
  { lng: "nl", id: "tasks", frage: "navraag" },
  { lng: "de", id: "tasks", frage: "zugewiesen" },
  { lng: "en", id: "tasks", frage: "assigned" },
  { lng: "nl", id: "tasks", frage: "toegewezen" },
  { lng: "de", id: "tasks", frage: "wissensobjekt" },
  { lng: "nl", id: "tasks", frage: "kennisobject" },
  // ---- risk: die vier Beispiele aus BENs Protokoll plus die Sachwörter der Seite.
  { lng: "de", id: "risk", frage: "bus-faktor" },
  { lng: "en", id: "risk", frage: "bus factor" },
  { lng: "nl", id: "risk", frage: "busfactor" },
  { lng: "de", id: "risk", frage: "single-source" },
  { lng: "en", id: "risk", frage: "single-source" },
  { lng: "nl", id: "risk", frage: "single-source" },
  { lng: "de", id: "risk", frage: "einzelquelle" },
  { lng: "nl", id: "risk", frage: "enkele bron" },
  { lng: "de", id: "risk", frage: "wissenslücken" },
  { lng: "nl", id: "risk", frage: "kennishiaten" },
  { lng: "de", id: "risk", frage: "widersprüche" },
  { lng: "en", id: "risk", frage: "contradictions" },
  { lng: "nl", id: "risk", frage: "tegenstrijdigheden" },
  { lng: "en", id: "risk", frage: "conflicts" },
  { lng: "nl", id: "risk", frage: "conflicten" },
  { lng: "de", id: "risk", frage: "priorisieren" },
  { lng: "en", id: "risk", frage: "prioritise" },
  { lng: "nl", id: "risk", frage: "prioriteren" },
  // ---- lifecycle: „Revalidierungen", „Asset-Änderungen", „Demo-Seed" — die drei Fachwörter, die
  //      der Auftrag in §6 als erste rote Fälle vorhergesagt hat.
  { lng: "de", id: "lifecycle", frage: "revalidierungen" },
  { lng: "en", id: "lifecycle", frage: "revalidations" },
  { lng: "nl", id: "lifecycle", frage: "hervalidaties" },
  { lng: "de", id: "lifecycle", frage: "asset-änderungen" },
  { lng: "nl", id: "lifecycle", frage: "assetwijzigingen" },
  { lng: "de", id: "lifecycle", frage: "demo-seed" },
  { lng: "en", id: "lifecycle", frage: "seed" },
  { lng: "nl", id: "lifecycle", frage: "demo-seed" },
  { lng: "de", id: "lifecycle", frage: "beispiel-lernpfad" },
  { lng: "en", id: "lifecycle", frage: "example learning path" },
  { lng: "nl", id: "lifecycle", frage: "voorbeeldleerpad" },
  { lng: "de", id: "lifecycle", frage: "rollenspezifisch" },
  { lng: "en", id: "lifecycle", frage: "role-specific" },
  { lng: "nl", id: "lifecycle", frage: "rolspecifiek" },
  // ---- stufe2: der dichteste Fachwortsatz des ganzen Bestands.
  { lng: "de", id: "stufe2", frage: "modelrun" },
  { lng: "en", id: "stufe2", frage: "modelrun" },
  { lng: "nl", id: "stufe2", frage: "modelrun" },
  { lng: "de", id: "stufe2", frage: "read-only" },
  { lng: "en", id: "stufe2", frage: "read-only" },
  { lng: "nl", id: "stufe2", frage: "read-only" },
  { lng: "de", id: "stufe2", frage: "fensterbasiert" },
  { lng: "en", id: "stufe2", frage: "window-based" },
  { lng: "nl", id: "stufe2", frage: "venstergebaseerd" },
  { lng: "de", id: "stufe2", frage: "provenance" },
  { lng: "en", id: "stufe2", frage: "provenance" },
  { lng: "nl", id: "stufe2", frage: "herkomstindex" },
  { lng: "en", id: "stufe2", frage: "evidence" },
  { lng: "nl", id: "stufe2", frage: "bewijs" },
  { lng: "de", id: "stufe2", frage: "qm" },
  { lng: "en", id: "stufe2", frage: "qa" },
  { lng: "nl", id: "stufe2", frage: "km" },
  { lng: "de", id: "stufe2", frage: "dokumente" },
  { lng: "en", id: "stufe2", frage: "documents" },
  { lng: "nl", id: "stufe2", frage: "documenten" },
  // ---- mobile: „Entwürfe" und das Nachtragen ohne Verbindung.
  { lng: "de", id: "mobile", frage: "entwürfe" },
  { lng: "en", id: "mobile", frage: "drafts" },
  { lng: "nl", id: "mobile", frage: "concepten" },
  { lng: "de", id: "mobile", frage: "synchronisieren" },
  { lng: "en", id: "mobile", frage: "sync" },
  { lng: "nl", id: "mobile", frage: "synchroniseren" },
  { lng: "en", id: "mobile", frage: "lookup" },
  { lng: "nl", id: "mobile", frage: "opzoeken" },
];

/** BENs sechs Beispiele, wörtlich aus seinem Protokoll — die Kalibrierung von D0. */
const BEN_BEISPIELE: readonly Sucherhalt[] = [
  { lng: "de", id: "risk", frage: "single-source" },
  { lng: "de", id: "stufe2", frage: "modelrun" },
  { lng: "de", id: "lifecycle", frage: "demo-seed" },
  { lng: "de", id: "lifecycle", frage: "revalidierungen" },
  { lng: "en", id: "risk", frage: "bus factor" },
  { lng: "nl", id: "risk", frage: "busfactor" },
];

describe("JOB 4071 · D — die Umformulierung hat keinen Suchweg gekostet", () => {
  it("D0: ohne die Merkmale wären genau BENs sechs Beispiele wieder unauffindbar", () => {
    for (const { lng, id, frage } of BEN_BEISPIELE) {
      expect(
        treffer(lng, frage, true),
        `„${frage}" (${lng}, Kapitel \`${id}\`) findet ohne Merkmale immer noch etwas — dann misst D1 nicht die Merkmale`,
      ).toEqual([]);
    }
    // Und mit Merkmalen findet jedes Beispiel wieder SEIN Kapitel — das ist der behobene Mangel.
    for (const { lng, id, frage } of BEN_BEISPIELE) {
      expect(treffer(lng, frage), `„${frage}" (${lng}) findet \`${id}\` nicht`).toContain(id);
    }
  });

  it("D0b: die Sollmenge deckt jedes der zehn Kapitel in jeder Sprache ab", () => {
    // Ohne diesen Fall könnte die Tabelle oben still auf ein Kapitel zusammenschrumpfen.
    const fehlend = FAELLE.filter(
      ({ lng, id }) => !SUCHERHALT.some((s) => s.lng === lng && s.id === id),
    ).map(({ lng, id }) => `${lng}/${id}`);
    expect(fehlend, "für diese Kapitel pinnt Gruppe D keinen einzigen Suchweg").toEqual([]);
  });

  it.each(FAELLE)("D1 · $lng/$id: jeder gepinnte Suchweg führt zum Kapitel", ({ lng, id }) => {
    const meine = SUCHERHALT.filter((s) => s.lng === lng && s.id === id);
    expect(meine.length, `keine Suchwege für ${lng}/${id}`).toBeGreaterThan(0);
    const verloren = meine
      .filter((s) => !treffer(lng, s.frage).includes(id))
      .map((s) => `„${s.frage}" → [${treffer(lng, s.frage).join(", ") || "nichts"}]`);
    expect(
      verloren,
      `diese Suchen finden \`${id}\` (${lng}) nicht mehr — Merkmal in \`helpTopics.ts\` nachführen`,
    ).toEqual([]);
  });

  it("D2: die fremd gepinnten Grenzen halten — in allen drei Sprachen", () => {
    // `tests/review26-hilfe-import/hilfe-findet-dateiimport.test.ts:311-312` pinnt beides, dort aber
    // nur auf Deutsch. Ein Merkmal, das „bibliothek" oder „pwa" in ein fremdes Kapitel trägt,
    // verwässerte die Suche still in EN oder NL, ohne dass ein Lauf es sagte.
    for (const lng of SPRACHEN) {
      expect(treffer(lng, "bibliothek"), `„bibliothek" ist in ${lng} nicht mehr eindeutig`).toEqual(
        ["library"],
      );
      expect(treffer(lng, "pwa"), `„pwa" ist in ${lng} nicht mehr eindeutig`).toEqual(["mobile"]);
    }
  });

  it("D3: die Merkmalsreihe ist sichtbar — diese Wörter stehen auf der Karte, nicht im Verborgenen", () => {
    // EHRLICHKEIT VOR OPTIK: `pages/Help.tsx` zeichnet die Merkmale unter jeder Karte als Pillen.
    // Die oben nachgeführten Fachwörter sind also weiterhin auf `/hilfe` zu SEHEN — als
    // Suchbegriffe, nicht mehr als Erklärung im Text. Dieser Fall hält diese Tatsache fest, damit
    // niemand die Merkmale für einen unsichtbaren Ablageort hält (die Datei selbst ist Zielpfad
    // eines anderen Jobs und wird hier nur gelesen).
    const quelle = readFileSync(join(__dirname, "..", "..", "apps/web/src/pages/Help.tsx"), "utf8");
    expect(
      quelle,
      "Help.tsx zeichnet die Merkmale nicht mehr — dann stimmt der Kommentar in `helpTopics.ts` nicht mehr",
    ).toContain("topic.tags.map(");
  });
});
