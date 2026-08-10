// AUFTRAG-mega85 Block A — DER VIERTE LESER, UND DIE GRUNDMENGE SELBST ERHOBEN.
//
// DER BEFUND (ben, sammel83-mega84, ROT-Punkt 1): mega84 hat an drei Stellen geschlossen, dass eine
// ausgezeichnete Fußnote anders gelesen wird als dieselbe unausgezeichnete — aus
// „<em>Ventil V2</em>," wurde „Ventil V2 ,", und eine Suche über die Wortgrenze fand die formatierte
// Fußnote nicht mehr. `lib/draftListView.ts` war ein VIERTER Leser derselben Klasse und blieb übrig:
// die Suche der Entwurfsliste ersetzte jedes Tag durch ein Leerzeichen. `lib/duplicateCompare.ts`
// war ein fünfter — dort trägt der Zwischenraum in die ANGEZEIGTEN Vergleichswerte hinein.
//
// WARUM DIESE DATEI NICHT EINE LISTE VON FÜNF DATEIEN PRÜFT: genau das war der Fehler. mega84 hat
// drei genannte Stellen korrigiert und die vierte nicht gesehen, weil niemand die Menge ERHOBEN
// hat. Diese Datei erhebt sie: sie liest den Quellbaum und findet JEDE Stelle, die HTML per Regex
// zu Text reduziert. Jeder Fund braucht genau ein Urteil in der Tabelle unten. Eine neue Stelle
// ohne Urteil macht diesen Wächter ROT — nicht, weil sie falsch wäre, sondern weil niemand
// hingesehen hat. Das ist der Unterschied zwischen „repariert" und „ausgeschlossen".
//
// BENANNTE BLINDHEIT: die Erhebung sieht Regex-Reduktionen. Eine Reduktion über das DOM
// (`el.textContent`, so in `lib/captionContext.ts` und `lib/editorFigures.ts`) sieht sie nicht —
// sie braucht dort auch nicht hinzusehen: `textContent` fügt zwischen Inline-Auszeichnung und
// folgendem Satzzeichen baulich KEIN Zeichen ein, das ist die Definition der Eigenschaft. Eine
// Reduktion über einen HTML-Parser (DOMParser) gäbe es hier nicht; käme sie, entginge sie der
// Erhebung — das ist die Grenze, und sie steht hier, damit sie benannt ist.
import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";
import type { Draft, KnowledgeObject } from "../../apps/web/src/api/types";
import { extractBodyImages } from "../../apps/web/src/lib/bodyImages";
import { filterDrafts } from "../../apps/web/src/lib/draftListView";
import { buildDuplicateCompareSections } from "../../apps/web/src/lib/duplicateCompare";
import { koPreviewText } from "../../apps/web/src/lib/koPreview";
import { imageCaptionTexts } from "../../apps/web/src/lib/librarySearch";
import { htmlToPlainText } from "../../apps/web/src/lib/richText";
import { wordHtmlToPlainText } from "../../apps/web/src/lib/wordAddin";
import { htmlToPlainText as serverPlainText } from "../../services/structure";
import { imageCaptionTexts as serverCaptionTexts } from "../../services/structure/src/captions";

// ── Stufe 1: die Grundmenge ERHEBEN ─────────────────────────────────────────────────────────────

const WURZEL = process.cwd();
const BAEUME = [join("apps", "web", "src"), "services"];

// Die Reduktion, um die es geht: ein Regex, der ALLE Tags trifft. Format-Umschreibungen wie
// `<\/?ac:[a-z-]+>` (Confluence) sind keine Reduktion auf Klartext und stehen bewusst nicht drin.
const REDUKTION = /\.replace\(\s*\/<\[\^>\][*+]>\/[gim]*\s*,/;

function istQuelldatei(pfad: string): boolean {
  if (!pfad.endsWith(".ts") && !pfad.endsWith(".tsx")) {
    return false;
  }
  return !pfad.endsWith(".test.ts") && !pfad.endsWith(".test.tsx");
}

function quelldateien(verzeichnis: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(join(WURZEL, verzeichnis), { withFileTypes: true })) {
    if (
      eintrag.name === "node_modules" ||
      eintrag.name === "dist" ||
      eintrag.name.startsWith(".")
    ) {
      continue;
    }
    const relativ = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      gefunden.push(...quelldateien(relativ));
    } else if (istQuelldatei(relativ)) {
      gefunden.push(relativ);
    }
  }
  return gefunden;
}

function posix(pfad: string): string {
  return pfad.split(sep).join("/");
}

const ALLE_QUELLEN = BAEUME.flatMap((baum) => quelldateien(baum)).map((datei) => ({
  datei: posix(datei),
  quelle: readFileSync(join(WURZEL, datei), "utf8"),
}));

const ERHOBEN: string[] = ALLE_QUELLEN.filter((f) => REDUKTION.test(f.quelle))
  .map((f) => f.datei)
  .sort();

// ── Stufe 2: JE FUND GENAU EIN URTEIL ───────────────────────────────────────────────────────────
//
// „korrigiert" = Inline-Auszeichnung veränderte das Ergebnis, die Stelle wurde geschlossen.
// „unkritisch" = sie verändert es nachweislich nicht — die Begründung steht dabei, und der Fall
// darunter FÄHRT sie, statt sie zu glauben.

const URTEILE: Record<string, string> = {
  // Die kanonische Reduktion, Client und Server: Block-ENDEN werden zum Leerzeichen, Inline-Tags
  // verschwinden spurlos. Genau diese Bauform ist die Wahrheit, an die die Korrekturen binden.
  "apps/web/src/lib/richText.ts": "kanonisch (htmlToPlainText, Client)",
  "services/structure/src/sanitize.ts": "kanonisch (htmlToPlainText, Server-Zwilling)",
  // mega84: Fußnotenleser, dort bereits geschlossen.
  "apps/web/src/lib/librarySearch.ts": "mega84 korrigiert (Suche, Client)",
  "services/structure/src/captions.ts": "mega84 korrigiert (Suche, Server-Spiegel)",
  "apps/web/src/lib/bodyImages.ts": "mega84 korrigiert (Galerie)",
  // Unkritisch, mit Beleg im Fall „die unkritischen Funde sind wirklich unkritisch".
  "apps/web/src/lib/koPreview.ts": "unkritisch: eigene Satzzeichen-Glättung (koPreview.ts:22)",
  "apps/web/src/lib/wordAddin.ts": "unkritisch: Inline-Tags spurlos, Block-Enden → Zeilenumbruch",
  "services/external-search/src/wikipedia.ts":
    "ausserhalb: reduziert Wikipedia-Snippets, nie Fussnote/Fliesstext eines Wissensobjekts — und Inline-Tags ohnehin spurlos",
};

describe("mega85 Block A · Stufe 1+2: die Grundmenge wird erhoben, jeder Fund hat ein Urteil", () => {
  it("der Quellbaum wird wirklich gelesen (ein leerer Sammler wäre ein grüner Sammler)", () => {
    expect(ALLE_QUELLEN.length).toBeGreaterThan(200);
    expect(ERHOBEN.length).toBeGreaterThan(4);
  });

  it("FAIL-CLOSED: eine Reduktionsstelle ohne Urteil ist ein Befund, kein grüner Lauf", () => {
    const ohneUrteil = ERHOBEN.filter((datei) => !URTEILE[datei]);
    expect(
      ohneUrteil,
      "Diese Dateien reduzieren HTML per Regex zu Text, ohne dass jemand entschieden hätte, ob " +
        "Inline-Auszeichnung das Ergebnis verändert. Genau so ist der vierte Leser " +
        "(draftListView.ts) durch mega84 gerutscht. Urteil in URTEILE eintragen — und den Fall " +
        "darunter fahren, statt das Urteil zu behaupten.",
    ).toEqual([]);
  });

  it("FAIL-CLOSED: ein Urteil ohne Fund ist genauso ein Befund (die Tabelle verwahrlost sonst)", () => {
    const ohneFund = Object.keys(URTEILE).filter((datei) => !ERHOBEN.includes(datei));
    expect(
      ohneFund,
      "Für diese Dateien steht ein Urteil in der Tabelle, aber sie reduzieren gar kein HTML mehr. " +
        "Entweder wurde die Stelle umgebaut — dann gehört das Urteil weg — oder die Erhebung " +
        "sieht sie nicht mehr (neue Bauform), und dann ist die Erhebung der Befund.",
    ).toEqual([]);
  });

  it("die beiden mega85-Korrekturen tauchen NICHT mehr als Rohreduktion auf", () => {
    // Sie lesen jetzt über `htmlToPlainText`. Fiele jemand auf die Rohreduktion zurück, wären sie
    // sofort wieder Funde ohne Urteil — und der Fall oben würde rot.
    expect(ERHOBEN).not.toContain("apps/web/src/lib/draftListView.ts");
    expect(ERHOBEN).not.toContain("apps/web/src/lib/duplicateCompare.ts");
  });
});

// ── Stufe 3: das VERHALTEN je Fund ──────────────────────────────────────────────────────────────

// Dieselbe Aussage einmal ausgezeichnet, einmal nicht. Kein Klartext-Leser darf die zwei
// unterscheiden können.
const MIT = "Der <strong>Dichtring</strong> am <em>Ventil V2</em>, sichtbar gerissen.";
const OHNE = "Der Dichtring am Ventil V2, sichtbar gerissen.";

const BODY_MIT = `<p>${MIT}</p>`;
const BODY_OHNE = `<p>${OHNE}</p>`;

function entwurf(bodyHtml: string): Draft {
  return {
    id: "d1",
    payload: { title: "Wartungsnotiz", bodyHtml },
    originalAuthor: "u1",
    lastEditor: "u1",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  } as Draft;
}

function ko(bodyHtml: string): KnowledgeObject {
  return {
    id: "k1",
    title: "Wartungsnotiz",
    statement: "",
    bodyHtml,
    conditions: [],
    measures: [],
    type: "technik",
    category: "Betrieb",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "a",
    author: "a",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-01-01",
    history: [],
    sources: [],
    attachments: [],
    comments: [],
  } as unknown as KnowledgeObject;
}

const t = (key: string): string => key;

function inhaltsWert(bodyHtml: string): string {
  const abschnitt = buildDuplicateCompareSections(ko(bodyHtml), ko(bodyHtml), t).find(
    (s) => s.label === "Kernaussage / Inhalt",
  );
  if (!abschnitt) {
    throw new Error("Der Vergleich hat keinen Inhalts-Abschnitt mehr");
  }
  return abschnitt.leftValue;
}

describe("mega85 Block A · Stufe 3: der vierte Leser — die Suche der Entwurfsliste", () => {
  it("eine Suche über die Wortgrenze findet die formatierte Fußnote (bens ROT-Punkt 1)", () => {
    const treffer = filterDrafts(
      [entwurf(BODY_MIT)],
      { query: "Ventil V2, sichtbar", author: "" },
      "Entwurf",
    );
    expect(
      treffer,
      "Die Suche der Entwurfsliste liest „Ventil V2 ,“ statt „Ventil V2,“ — dieselbe Regression, " +
        "die mega84 an drei anderen Lesern geschlossen hat, auf einer vierten Suchfläche.",
    ).toHaveLength(1);
  });

  it("formatiert und unformatiert sind für die Suche derselbe Entwurf", () => {
    const anfrage = { query: "Ventil V2, sichtbar gerissen", author: "" };
    expect(filterDrafts([entwurf(BODY_MIT)], anfrage, "Entwurf")).toHaveLength(1);
    expect(filterDrafts([entwurf(BODY_OHNE)], anfrage, "Entwurf")).toHaveLength(1);
  });

  it("ein Absatzwechsel bleibt eine Wortgrenze — Wörter dürfen nicht zusammenwachsen", () => {
    // Die naheliegende „alle Tags weg"-Korrektur wäre hier falsch: aus „<p>Ende</p><p>Anfang</p>"
    // würde „EndeAnfang", und die Suche fände plötzlich Wörter, die es nicht gibt.
    const d = entwurf("<p>Dichtring</p><p>Ventil</p>");
    expect(filterDrafts([d], { query: "dichtringventil", author: "" }, "Entwurf")).toHaveLength(0);
    expect(filterDrafts([d], { query: "dichtring ventil", author: "" }, "Entwurf")).toHaveLength(1);
  });
});

describe("mega85 Block A · Stufe 3: der fünfte Leser — die angezeigten Vergleichswerte", () => {
  it("der Duplikat-Vergleich zeigt für beide Fassungen DENSELBEN Text", () => {
    expect(
      inhaltsWert(BODY_MIT),
      "Der angezeigte Vergleichswert trägt den Zwischenraum der entfernten Auszeichnung weiter — " +
        "der Mensch sieht „Ventil V2 ,“ und vergleicht etwas, das so nirgends steht.",
    ).toBe(inhaltsWert(BODY_OHNE));
    expect(inhaltsWert(BODY_MIT)).toBe(OHNE);
  });
});

describe("mega85 Block A · Stufe 3: die unkritischen Funde sind wirklich unkritisch", () => {
  const figur = (caption: string): string =>
    `<figure><img src="/api/objects/x/raw" data-image-id="kw-a"><figcaption data-image-id="kw-a">${caption}</figcaption></figure>`;

  it("koPreview: die eigene Satzzeichen-Glättung trägt (Urteil „unkritisch“ gefahren, nicht geglaubt)", () => {
    expect(koPreviewText({ bodyHtml: BODY_MIT })).toBe(koPreviewText({ bodyHtml: BODY_OHNE }));
    expect(koPreviewText({ bodyHtml: BODY_MIT })).toBe(OHNE);
  });

  it("wordAddin: Inline-Tags verschwinden spurlos (Urteil „unkritisch“ gefahren)", () => {
    expect(wordHtmlToPlainText(BODY_MIT)).toBe(wordHtmlToPlainText(BODY_OHNE));
  });

  it("die mega84-Leser bleiben geschlossen (Regressionsschutz für die drei bereits grünen)", () => {
    expect(imageCaptionTexts(figur(MIT))).toEqual(imageCaptionTexts(figur(OHNE)));
    expect(serverCaptionTexts(figur(MIT))).toEqual(serverCaptionTexts(figur(OHNE)));
    expect(extractBodyImages(figur(MIT))[0]?.caption).toBe(
      extractBodyImages(figur(OHNE))[0]?.caption,
    );
    expect(htmlToPlainText(BODY_MIT)).toBe(htmlToPlainText(BODY_OHNE));
    expect(serverPlainText(BODY_MIT)).toBe(serverPlainText(BODY_OHNE));
  });
});

// ── Stufe 4: BESTANDSDATEN — und der VERENGTE SUCHVERTRAG ───────────────────────────────────────
//
// AUFTRAG-mega86 Block A (bens ROT aus sammel84, vom Kopf nachgerechnet und bestätigt): hier stand
// die Zusage „jede Anfrage, die vorher traf, trifft weiterhin". Sie ist in dieser Allgemeinheit
// FALSCH. `htmlToPlainText` dekodiert Entities und normalisiert `\s+` zu einem Leerzeichen; die
// alte Fassung tat beides nicht. Bens vier Anfragen trafen alt und treffen jetzt nicht mehr — sie
// stehen unten EINZELN als ausdrücklich ausgenommen, damit niemand später glaubt, sie seien
// vergessen worden.
//
// Was stattdessen gilt, wörtlich derselbe Satz wie an der Fundstelle (draftListView.ts):
//
//   SICHTBARER KLARTEXT BLEIBT SUCHBAR. Jede Wortfolge, die ein Mensch im Entwurf lesen kann, wird
//   weiterhin gefunden — Wortgrenzen (Absatz, Listenpunkt, Zeilenumbruch, entfernte Auszeichnung)
//   gelten dabei als GENAU EIN Leerzeichen. Nicht mehr gefunden werden vier Klassen technischer
//   Altanfragen, und zwar bewusst: gegen HTML-Entitätsschreibweisen, gegen mehrfachen Whitespace,
//   gegen einen Zeilenumbruch als Zeichen und gegen die Leerzeichen-Artefakte der alten Reduktion.
//   Keine dieser vier war je sichtbarer Text.
//
// UND DIE ZAHL IST JETZT EINE ZUSAGE: mega85 pinnte `gefahren > 10` und schrieb „44" in den
// Bericht — eine Zahl, die kein Test hielt. Unten steht eine FESTE Zahl, gegen die geprüft wird.

// Wörtlich die Fassung von vor mega85 (draftListView.ts:42 bzw. duplicateCompare.ts:43).
const ALT_LEER = (html: string): string => html.replace(/<[^>]*>/g, " ");
const ALT_KOMPAKT = (html: string): string =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Der SUCHTEXT von vor mega85 — `draftSearchText` mit der alten Rohreduktion, samt der beiden
// Titelteile, die `entwurf()` unten erzeugt. Ein Nachbau, kein Import: das Original gibt es nicht
// mehr, und genau gegen dieses Original muss „traf alt" gemessen werden.
const ALT_SUCHTEXT = (html: string): string =>
  ["Wartungsnotiz", "Wartungsnotiz", "", ALT_LEER(html)].join(" ").toLowerCase();

// Bestandsformen, wie sie der Sanitizer heute speichert — ohne Inline-Auszeichnung.
const BESTAND = [
  "<p>Der Dichtring am Ventil V2, sichtbar gerissen.</p>",
  "<p>Absatz eins.</p><p>Absatz zwei.</p>",
  "<h2>Überschrift</h2><p>Fließtext dazu.</p>",
  "<ul><li>Erstens</li><li>Zweitens</li></ul>",
  "<p>Nur ein Satz ohne alles</p>",
  "",
];

// Die Anfragen des BLEIBENDEN Teils, erhoben aus dem SICHTBAREN Klartext: jedes Wort und jedes
// benachbarte Wortpaar mit genau einem Leerzeichen dazwischen. Das ist wörtlich die Menge, über die
// der verengte Vertrag etwas zusagt — „was ein Mensch lesen kann".
function anfragenAus(html: string): string[] {
  const sichtbar = htmlToPlainText(html).toLowerCase();
  const woerter = sichtbar.split(" ").filter((w) => w.length > 1);
  return woerter.flatMap((wort, i) =>
    i + 1 < woerter.length ? [wort, `${wort} ${woerter[i + 1]}`] : [wort],
  );
}

const ANFRAGEN: { html: string; anfrage: string }[] = BESTAND.flatMap((html) =>
  anfragenAus(html).map((anfrage) => ({ html, anfrage })),
);

// FESTE ZAHLEN, keine Untergrenzen. Ändert sich BESTAND, ändern sich diese Zahlen und der Fall wird
// rot — dann gehört die neue Zahl hier UND im Bericht hin, statt dass beide auseinanderlaufen.
const ERWARTETE_ANFRAGEN = 37;
// Davon der Teil, der auch im ALTEN Suchtext vorkam. Nur über diese Teilmenge macht die alte
// Implikation überhaupt eine Aussage — und für sie gilt sie weiterhin vollständig.
const ALT_UND_NEU = ANFRAGEN.filter(({ html, anfrage }) => ALT_SUCHTEXT(html).includes(anfrage));
const ERWARTETE_ALT_UND_NEU = 34;

// BENS VIER GEGENBEISPIELE, wörtlich aus `_relay/ben/outbox/BERICHT-ben-sammel84-mega85.md`. Sie
// trafen ALT und treffen NEU nicht mehr. Das ist kein Versehen, sondern die Grenze des Vertrags —
// und sie steht hier einzeln, damit sie niemand später für vergessen hält.
const AUSGENOMMEN = [
  {
    klasse: "(1) HTML-Entitätsschreibweise",
    html: "<p>Ventil &amp; Pumpe</p>",
    anfrage: "ventil &amp; pumpe",
    grund: "der Klartext heißt jetzt „Ventil & Pumpe“ — die Entity war nie sichtbarer Text",
  },
  {
    klasse: "(2) mehrfacher Whitespace",
    html: "<p>A</p><p>B</p>",
    anfrage: "a  b",
    grund: "der Absatzwechsel ist GENAU EIN Leerzeichen — zwei waren ein Reduktionsartefakt",
  },
  {
    klasse: "(3) Zeilenumbruch als Zeichen",
    html: "<p>Dichtring\nVentil</p>",
    anfrage: "dichtring\nventil",
    grund: "jede Wortgrenze wird zum Leerzeichen vereinheitlicht, auch der Quelltext-Umbruch",
  },
  {
    klasse: "(4) Leerzeichen-Artefakt der alten Reduktion",
    html: "<p>Der <em>Ventil V2</em>, gerissen.</p>",
    anfrage: "v2 ,",
    grund: "GENAU dieses Artefakt zu beseitigen war der Zweck von mega84/mega85",
  },
] as const;

describe("mega85 Block A · Stufe 4: für Bestandsdaten ist die Änderung ein No-op", () => {
  it("der Vergleichswert ist für unformatierten Bestand BYTE-GLEICH wie vorher", () => {
    for (const html of BESTAND) {
      // Sind beide Quellen leer, zeigt der Vergleich seinen Platzhalter — das tat er vorher auch,
      // die Reduktion ist daran unbeteiligt.
      const erwartet = ALT_KOMPAKT(html) || "dcmp.noValue";
      expect(inhaltsWert(html), html).toBe(erwartet);
    }
  });
});

describe("mega86 Block A · der verengte Suchvertrag: sichtbarer Klartext bleibt suchbar", () => {
  it(`die Zusage wird über GENAU ${ERWARTETE_ANFRAGEN} Anfragen gefahren (keine Untergrenze)`, () => {
    // mega85 pinnte `> 10` und schrieb 44 in den Bericht. Eine Zahl ist eine Zusage; diese hier
    // wird gehalten. Läuft die Erhebung leer oder wächst BESTAND, wird das hier rot statt still.
    expect(
      ANFRAGEN.length,
      "Die erhobene Anfragenmenge stimmt nicht mehr mit der zugesagten Zahl überein. BESTAND " +
        "geändert? Dann gehört die neue Zahl hierhin UND in den Bericht — nicht nur in einen davon.",
    ).toBe(ERWARTETE_ANFRAGEN);

    for (const { html, anfrage } of ANFRAGEN) {
      expect(
        filterDrafts([entwurf(html)], { query: anfrage, author: "" }, "Entwurf"),
        `„${anfrage}“ ist im Entwurf „${html}“ für einen Menschen LESBAR, wird aber nicht gefunden`,
      ).toHaveLength(1);
    }
  });

  it(`für die ${ERWARTETE_ALT_UND_NEU} Altanfragen des bleibenden Teils gilt die Implikation weiterhin`, () => {
    // Der Rest der alten Zusage, ehrlich beziffert: so viele der Anfragen oben kamen auch im alten
    // Suchtext vor. Für sie — und nur für sie — hält „was traf, trifft weiterhin".
    expect(ALT_UND_NEU.length).toBe(ERWARTETE_ALT_UND_NEU);
    for (const { html, anfrage } of ALT_UND_NEU) {
      expect(
        ALT_SUCHTEXT(html).includes(anfrage),
        `„${anfrage}“ gehört gar nicht in diese Teilmenge`,
      ).toBe(true);
      expect(
        filterDrafts([entwurf(html)], { query: anfrage, author: "" }, "Entwurf"),
        `Bestand „${html}“ wurde vorher über „${anfrage}“ gefunden, jetzt nicht mehr`,
      ).toHaveLength(1);
    }
  });

  for (const fall of AUSGENOMMEN) {
    it(`AUSDRÜCKLICH AUSGENOMMEN ${fall.klasse}: „${JSON.stringify(fall.anfrage)}“ trifft bewusst nicht mehr`, () => {
      // Erst die Vorbedingung: sie traf WIRKLICH alt. Ohne diese Hälfte wäre der Fall eine
      // Behauptung über eine Anfrage, die es nie gab.
      expect(
        ALT_SUCHTEXT(fall.html),
        "Diese Anfrage traf schon alt nicht — dann belegt der Fall nichts.",
      ).toContain(fall.anfrage);
      const beschluss = `Diese Klasse ist als ENTFALLEN beschlossen (${fall.grund}).`;
      expect(
        filterDrafts([entwurf(fall.html)], { query: fall.anfrage, author: "" }, "Entwurf"),
        `${beschluss} Findet die Suche sie wieder, hat jemand die Reduktion zurückgedreht — dann stimmt der Vertrag nicht mehr.`,
      ).toHaveLength(0);
    });
  }
});
