// ================================================================================================
// JOB 2551 · DER BILDVERLUST-SATZ — GEMESSEN AM LAUFENDEN PANEL, NICHT AM QUELLTEXT.
// ================================================================================================
//
// DER GEGENSTAND. `sendImagesMissing` erscheint, wenn Word HTML geliefert hat, darin aber
// `<img>`-Tags stehen, deren Bytes Word nicht herausgegeben hat (`taskpane.html`:
// `prepared.usedHtml && prepared.undeliveredImages > 0`). Denselben Schluessel benutzt der
// .docx-Weg (`sendeDocxDatei`, `gesamt > da`). Der Text gilt also fuer BEIDE Wege — wer ihn
// aendert, aendert beide.
//
// WAS D2 GEBAUT HAT UND WARUM ES ROT WURDE. D2 hat den alten Satz („{n} Bilder konnte Word nicht
// uebergeben — sie fehlen im Entwurf.") gegen eine Fassung getauscht, die Word benennt, die
// Vollstaendigkeit des Textes zusichert und einen Weg gibt. Die Zahl fiel dabei weg. BEN hat das
// am 30.08. mit ROT beantwortet, und zwar zu Recht:
//
//   BEN-PRUEFUNG-JOB-2551-D2 `:9` — „bei `n = 1` erscheint 'die Bilder / Sie', 'the images / They'
//   beziehungsweise 'de afbeeldingen / Ze'; das ist nicht zahlneutral, sondern Plural fuer einen
//   einzelnen Gegenstand."
//
// Der Wegfall der ZAHL macht einen Satz noch nicht zahlneutral. „Die Bilder … sie" setzt bei genau
// einem fehlenden Bild immer noch Mehrzahl voraus — nur eben unsichtbar.
//
//   BEN-PRUEFUNG-JOB-2551-D2 `:10` — „B1 verbietet nur das Muster `1 (Bilder|images|afbeeldingen)`.
//   Eine pluralische Meldung ohne ausgegebene Zahl besteht den Test."
//
// Genau das war der Fall: Der D2-Test sah nur auf die ZAHLFORM. Deshalb steht die Numerusprobe
// hier auf zwei Beinen — der Zeichenfolge UND den Pluralmarkern (B1), und das Merkmal selbst wird
// kalibriert (B5).
//
// WARUM DIESER TEST MOUNTED IST. BEN hat bei 2552 D1 eine Satzzeichenzaehlung ausdruecklich als
// SCHEINBELEG zurueckgewiesen. Hier wird deshalb nichts gezaehlt und keine Quelltextzeile geprueft.
// Gemessen wird, was im Statusfeld STEHT, nachdem das Panel im jsdom gelaufen ist, die Sprache
// gewechselt wurde und der ECHTE Renderweg der Datei gelaufen ist: `t()` loest den Schluessel und
// die Platzhalter auf, `showSendStatus()` schreibt in `#send-status`. Beide Funktionen sind die des
// Panels — sie werden hier nicht nachgebaut.
//
// DIE NOTIZ WIRD ALLEIN GEMESSEN, IMMER. In D2 trug der vorangestellte Erfolgssatz `sendOk` einen
// Teil der Aussage mit; BEN `:10`: „`satz.length > 0` wird zudem bereits durch den vorangestellten
// Erfolgssatz getragen." Ein geleerter oder entfernter Schluessel waere so nicht aufgefallen.
// Deshalb steht in jedem Fall dieser Datei NUR die Notiz im Feld — und B1 verlangt von ihr Ursache,
// Vollstaendigkeitszusage und Weg, nicht bloss Laenge. Faellt der Schluessel weg, gibt `t()` den
// SCHLUESSELNAMEN zurueck; auch das faengt B1 ausdruecklich ab.
//
// GRENZE, ausdruecklich: Geprueft wird der GERENDERTE Satz, nicht seine Verstaendlichkeit. Ob ein
// Mensch ihn als Word-Fehler liest, entscheidet Pedi — dieser Test haelt nur, dass Word benannt
// ist, ein Weg dasteht und die Grammatik in beiden Zahlfaellen traegt.
//
// JOB 3057 K2 (Zielbild Erfassen.dc.html, §5.5) — UMGEZOGEN, NICHT ABGESCHALTET. Der Bilder-Satz
// steht nach dem Senden nicht mehr im Statusfeld hinter `sendOk`, sondern als EINE Zeile in der
// Karte: `#capture-bilder-satz` (der Satz) plus `#capture-bilder-link` („In KLARWERK ergaenzen",
// der WEG — als Link auf den Entwurf, nicht mehr als Halbsatz im Text). Einzahl und Mehrzahl sind
// jetzt getrennte Schluessel (`sendImagesMissingOne` / `sendImagesMissing`), die Wahl trifft
// `bilderSatz(nichtHerausgegeben, zuGross)` im Panel — dieselbe Funktion, die beide Sendewege
// (Auswahl und .docx) benutzen. Gemessen wird deshalb weiter am ECHTEN Renderweg: `bilderSatz()`
// waehlt, `zeigeEntwurfsErgebnis()` rendert ueber `t()`, gelesen wird aus dem DOM. B1 verlangt von
// Satz UND Link zusammen Ursache, Vollstaendigkeitszusage und Weg.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = resolve(__dirname, "..", "..");
const TASKPANE = resolve(WURZEL, "apps/web/public/word-addin/taskpane.html");
const HTML = readFileSync(TASKPANE, "utf8");

// Der Gate-tsc laeuft ohne DOM-lib (`tsconfig.json`: `lib: ["ES2022"]`), und `@types/jsdom` gibt es
// hier nicht. Deshalb jsdom und die Knoten ueber schmale Struktur-Typen — dasselbe Muster wie
// `word-addin-taskpane-cache.test.ts`. Ein gewoehnliches `import { JSDOM } from "jsdom"` bricht das
// Tor mit TS7016.
interface ElLike {
  readonly textContent: string | null;
  click(): void;
}
interface DokLike {
  getElementById(id: string): ElLike | null;
}
interface BilderWahl {
  key: string;
  vars: Record<string, string>;
}
interface FensterLike {
  readonly document: DokLike;
  t(key: string, vars?: Record<string, string>): string;
  /** JOB 3057 K2: die Wahl des EINEN Bilder-Satzes (null = nichts fehlt). */
  bilderSatz(nichtHerausgegeben: number, zuGross: number): BilderWahl | null;
  /** JOB 3057 K2: rendert Ergebniszeile und — im Fall — Bilder-Satz samt Link in die Karte. */
  zeigeEntwurfsErgebnis(url: string, bilder: BilderWahl | null): void;
  close(): void;
}
interface DomLike {
  readonly window: FensterLike;
}
interface Antwort {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}
interface JsdomOptionen {
  runScripts: string;
  url: string;
  beforeParse(window: { fetch: (u: unknown) => Promise<Antwort> }): void;
}
const { JSDOM } = createRequire(resolve(WURZEL, "package.json"))("jsdom") as {
  JSDOM: new (html: string, opt: JsdomOptionen) => DomLike;
};

const SPRACHEN = ["de", "en", "nl"] as const;
type Sprache = (typeof SPRACHEN)[number];
const warte = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function json(o: unknown): Antwort {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(o),
    text: () => Promise.resolve(JSON.stringify(o)),
  };
}

function antwortFuer(url: string): Antwort {
  if (url.includes("/api/auth/me"))
    return json({ id: "u1", email: "pruefung@klarwerk.test", role: "admin" });
  return json({});
}

/** Was ein Mensch in der Karte liest: der Bilder-Satz und der Link daneben (der Weg). */
interface Notiz {
  satz: string;
  link: string;
}

/**
 * Das Panel starten, die Sprache KLICKEN und die Bildverlustnotiz fuer die verlangten Zahlfaelle
 * ueber den echten Renderweg der Datei erzeugen: `bilderSatz()` waehlt den Schluessel (Einzahl/
 * Mehrzahl), `zeigeEntwurfsErgebnis()` rendert ueber `t()` in `#capture-bilder-satz` und den Link
 * `#capture-bilder-link`, und von dort wird gelesen.
 *
 * Die Notiz steht dabei ALLEIN in ihrer Zeile — die Ergebniszeile `sendOk` ist ein eigenes
 * Element. Grund: gemessen in D2 (BEN `:10`), der Nachbarsatz trug sonst Laenge und
 * Sprachverschiedenheit mit und haette einen geleerten Schluessel verdeckt.
 */
async function notizen(sprache: Sprache, zahlen: number[]): Promise<Notiz[]> {
  const dom = new JSDOM(HTML, {
    runScripts: "dangerously",
    url: "https://app.klarwerk.ai/word-addin/taskpane.html",
    beforeParse(window) {
      window.fetch = (u) => Promise.resolve(antwortFuer(String(u)));
    },
  });
  const fenster = dom.window;
  try {
    await warte(300);
    const knopf = fenster.document.getElementById(`lang-${sprache}`);
    if (knopf === null) throw new Error(`Sprachknopf lang-${sprache} gibt es nicht`);
    knopf.click();
    await warte(20);
    const feld = fenster.document.getElementById("capture-bilder-satz");
    const link = fenster.document.getElementById("capture-bilder-link");
    if (feld === null) throw new Error("#capture-bilder-satz gibt es nicht");
    if (link === null) throw new Error("#capture-bilder-link gibt es nicht");
    return zahlen.map((n) => {
      fenster.zeigeEntwurfsErgebnis(
        "https://app.klarwerk.ai/capture/frontdoor?draft=d1",
        fenster.bilderSatz(n, 0),
      );
      return { satz: (feld.textContent ?? "").trim(), link: (link.textContent ?? "").trim() };
    });
  } finally {
    fenster.close();
  }
}

async function notiz(sprache: Sprache, n: number): Promise<Notiz> {
  const [erste] = await notizen(sprache, [n]);
  if (erste === undefined) throw new Error(`keine Notiz fuer ${sprache}/${n}`);
  return erste;
}

// ------------------------------------------------------------------------------------------------
// DAS NUMERUS-MERKMAL — BENs Korrekturpflicht 2, woertlich:
//
//   „B1 so schaerfen, dass nicht nur die Zeichenfolge '1 + Pluralwort', sondern auch eine
//    pluralische, zahlenlose Fassung bei `n = 1` scheitert."
//
// Verboten ist bei `n = 1` deshalb BEIDES:
//   (a) ZAHLFORM — eine „1" unmittelbar vor einem Mehrzahlwort („1 Bilder"). Das war der alte
//       Basisstand.
//   (b) PLURALMARKER — Mehrzahlnomen und Mehrzahlpronomen, auch OHNE ausgegebene Zahl. Das war
//       der D2-Stand, den BEN rot gemacht hat.
//
// Was das Merkmal NICHT tut: es schreibt keinen Wortlaut vor. Jede Fassung besteht es, die bei
// einem einzelnen Gegenstand ohne Mehrzahlwort auskommt — eine echte Singularvariante ebenso wie
// eine kollektive Fassung („das Bildmaterial … es"). Genau diese beiden Wege laesst die Auflage zu.
//
// Die Pronomenverbote sind sprachlich eng gefasst und hier begruendet: Das Panel DUZT durchgehend
// („in deinem Word-Dokument"), eine Hoeflichkeitsform „Sie" kann im Deutschen also nicht gemeint
// sein; im Niederlaendischen sind `ze`/`zij` in dieser Meldung nur als Mehrzahl denkbar, weil der
// Gegenstand eine Sache ist. B5 kalibriert genau das.
const PLURALMARKER: Record<Sprache, { zahlform: RegExp; marker: RegExp }> = {
  de: {
    zahlform: /\b1\s+Bilder\b/i,
    marker: /\b(?:Bilder|Bildern|sie|ihnen|diese)\b/i,
  },
  en: {
    zahlform: /\b1\s+images\b/i,
    marker: /\b(?:images|they|them|these)\b/i,
  },
  nl: {
    zahlform: /\b1\s+afbeeldingen\b/i,
    marker: /\b(?:afbeeldingen|ze|zij|deze)\b/i,
  },
};

/**
 * Was Satz und Link je Sprache benennen muessen — Ursache und Vollstaendigkeitszusage im SATZ,
 * der Weg im LINK (JOB 3057 K2: „In KLARWERK ergaenzen" fuehrt auf den Entwurf).
 */
const ERWARTUNG: Record<Sprache, { ursache: RegExp; weg: RegExp; vollstaendig: RegExp }> = {
  de: {
    ursache: /\bWord hat\b/,
    weg: /\bKLARWERK\b.*\bergänzen\b/i,
    vollstaendig: /\bText ist vollständig\b/,
  },
  en: {
    ursache: /\bWord did not\b/,
    weg: /\badd\b.*\bKLARWERK\b/i,
    vollstaendig: /\btext is complete\b/,
  },
  nl: {
    ursache: /\bWord heeft\b/,
    weg: /\bKLARWERK\b.*\baanvullen\b/i,
    vollstaendig: /\btekst is volledig\b/,
  },
};

function pruefeSubstanz(notiz: Notiz, s: Sprache, wo: string): void {
  const e = ERWARTUNG[s];
  const { satz, link } = notiz;
  // Faellt der Schluessel weg, gibt `t()` den SCHLUESSELNAMEN zurueck — der ist nicht leer und
  // haette eine reine Laengenpruefung bestanden. BEN `:16` verlangt genau diesen Fall.
  expect(
    satz,
    `${s}/${wo}: im Feld steht der blanke Schluesselname statt einer Meldung`,
  ).not.toMatch(/^sendImages/);
  expect(satz, `${s}/${wo}: es steht ueberhaupt nichts in der Bilder-Zeile`).not.toBe("");
  expect(satz, `${s}/${wo}: der Satz benennt WORD nicht als Ursache`).toMatch(e.ursache);
  expect(satz, `${s}/${wo}: der Satz sagt nicht, dass der TEXT vollstaendig ist`).toMatch(
    e.vollstaendig,
  );
  expect(link, `${s}/${wo}: der Link sagt dem Menschen keinen Weg`).toMatch(e.weg);
}

describe("JOB 2551 · der Bildverlust-Satz am laufenden Panel", () => {
  it("B1 · bei GENAU EINEM fehlenden Bild steht keine Mehrzahl da — Zahlform UND Pluralmarker", async () => {
    // Der Fall, an dem BEN zweimal das ROT vergeben hat. Die Notiz wird ALLEIN gemessen und muss
    // dabei trotzdem vollstaendig tragen: Ursache, Vollstaendigkeit, Weg — sonst waere „keine
    // Mehrzahl" auch mit einer leeren Meldung zu haben.
    for (const s of SPRACHEN) {
      const n1 = await notiz(s, 1);
      pruefeSubstanz(n1, s, "n=1");
      const p = PLURALMARKER[s];
      expect(n1.satz, `${s}: „1 + Mehrzahlwort" bei genau einem fehlenden Bild`).not.toMatch(
        p.zahlform,
      );
      expect(
        n1.satz,
        `${s}: Mehrzahlwort oder Mehrzahlpronomen bei genau einem fehlenden Bild`,
      ).not.toMatch(p.marker);
    }
  }, 30_000);

  it("B2 · bei mehreren fehlenden Bildern steht derselbe tragfaehige Satz", async () => {
    // Die Gegenprobe zu B1: Ein Satz, der bei n = 1 richtig ist, weil er GAR NICHTS meldet, waere
    // wertlos. Deshalb wird hier bei n = 4 dieselbe Aussage verlangt. Der NUMERUS wird hier
    // bewusst NICHT geprueft — bei n = 4 ist Mehrzahl richtig. Wer spaeter echte Singular-/
    // Pluralvarianten baut, bleibt hier gruen und muss nur B1 halten.
    for (const s of SPRACHEN) {
      pruefeSubstanz(await notiz(s, 4), s, "n=4");
    }
  }, 30_000);

  it("B3 · die drei Sprachen zeigen WIRKLICH drei verschiedene Bildverlust-Saetze", async () => {
    // Kalibrierung des Sprachwechsels. Ohne sie waeren B1/B2 auch dann gruen, wenn der Klick gar
    // nicht wirkt und dreimal derselbe deutsche Satz erschiene — `t()` faellt bei fehlendem
    // Schluessel ausdruecklich auf `STRINGS.de` zurueck.
    const saetze = (await Promise.all(SPRACHEN.map((s) => notiz(s, 2)))).map((n) => n.satz);
    expect(
      new Set(saetze).size,
      `die drei Sprachen liefern nicht drei verschiedene Bildverlust-Saetze: ${JSON.stringify(saetze)}`,
    ).toBe(3);
    // Und die Mehrzahl traegt die ZAHL — hier ist sie echt gezaehlt (JOB 2613 D1), keine stille Null.
    for (const satz of saetze) {
      expect(satz).toContain("2");
    }
  }, 30_000);

  it("B3a · nichts fehlt → KEIN Satz: `bilderSatz(0, 0)` ist null, die Zeile bleibt leer", async () => {
    // JOB 3057 K2 (§5.5): der Satz erscheint NUR im Fall. Ohne Verlust darf die Karte keinen
    // Bilder-Satz zeigen — sonst waere die Ergebniszeile eine Dauerwarnung.
    const dom = new JSDOM(HTML, {
      runScripts: "dangerously",
      url: "https://app.klarwerk.ai/word-addin/taskpane.html",
      beforeParse(window) {
        window.fetch = (u) => Promise.resolve(antwortFuer(String(u)));
      },
    });
    const fenster = dom.window;
    try {
      await warte(300);
      expect(fenster.bilderSatz(0, 0)).toBeNull();
      fenster.zeigeEntwurfsErgebnis("https://app.klarwerk.ai/capture/frontdoor?draft=d1", null);
      const feld = fenster.document.getElementById("capture-bilder-satz");
      expect((feld?.textContent ?? "").trim()).toBe("");
      // Beide Verlustarten zugleich: EIN Satz mit beiden Zahlen, nicht zwei Saetze.
      const beide = fenster.bilderSatz(2, 1);
      expect(beide?.key).toBe("sendImagesBoth");
      expect(beide?.vars).toEqual({ n: "3", a: "2", b: "1" });
      // Nur zu grosse Bilder: eigener Satz, Einzahl getrennt.
      expect(fenster.bilderSatz(0, 1)?.key).toBe("sendImagesDroppedOne");
      expect(fenster.bilderSatz(0, 3)?.key).toBe("sendImagesDropped");
    } finally {
      fenster.close();
    }
  }, 30_000);

  it("B4 · Bildverlust- und Rueckfall-Satz bleiben getrennt", async () => {
    // BENANNTE GRENZE, gemessen statt behauptet: Der Bildverlust-Satz haengt an
    // `prepared.usedHtml && prepared.undeliveredImages > 0`. Faellt Word auf reinen Text zurueck,
    // ist NICHT dieser Satz zustaendig, sondern `sendPlainFallback`. Wer den einen aendert, aendert
    // also nicht den anderen.
    const dom = new JSDOM(HTML, {
      runScripts: "dangerously",
      url: "https://app.klarwerk.ai/word-addin/taskpane.html",
      beforeParse(window) {
        window.fetch = (u) => Promise.resolve(antwortFuer(String(u)));
      },
    });
    const fenster = dom.window;
    try {
      await warte(300);
      const bild = fenster.t("sendImagesMissing");
      const rueckfall = fenster.t("sendPlainFallback");
      expect(bild.length, "der Bildverlust-Satz ist leer").toBeGreaterThan(0);
      expect(rueckfall.length, "der Rueckfall-Satz ist leer").toBeGreaterThan(0);
      expect(bild, "Bildverlust- und Rueckfall-Satz sind derselbe Text geworden").not.toBe(
        rueckfall,
      );
    } finally {
      fenster.close();
    }
  }, 30_000);

  it("B5 · das Numerus-Merkmal selbst ist kalibriert — es erkennt Mehrzahl und verbietet nicht alles", () => {
    // WARUM DIESER FALL EXISTIERT. B1 ist nur so viel wert wie sein Merkmal. Ein Muster, das nichts
    // erkennt, macht B1 zur Attrappe — genau das war der D2-Mangel. Hier wird das Merkmal deshalb
    // gegen literale Texte gehalten, in beide Richtungen.
    //
    // Die Texte stehen ABSICHTLICH literal in dieser Datei und werden NICHT aus `taskpane.html`
    // gelesen: Ein Merkmal, das man am eigenen Gegenstand kalibriert, bestaetigt nur sich selbst.
    // Diese Kalibrierung sagt nichts ueber das Produkt aus — das tut B1.
    //
    // NEGATIV: die drei D2-Texte im Wortlaut. Zahlenlos und trotzdem pluralisch; sie sind der
    // Grund fuer BENs ROT und muessen erkannt werden.
    const D2_PLURALISCH: Record<Sprache, string> = {
      de: "Word hat die Bilder nicht herausgegeben; der Text ist vollständig. Sie stehen weiter in deinem Word-Dokument — füge sie im Entwurf direkt ein.",
      en: "Word did not release the images; the text is complete. They are still in your Word document — add them directly in the draft.",
      nl: "Word heeft de afbeeldingen niet vrijgegeven; de tekst is volledig. Ze staan nog in je Word-document — voeg ze rechtstreeks in het concept toe.",
    };
    // Auch der ALTE Basisstand muss fallen — an der Zahlform, nicht erst am Marker.
    const BASIS_ZAHLFORM: Record<Sprache, string> = {
      de: "1 Bilder konnte Word nicht übergeben — sie fehlen im Entwurf.",
      en: "1 images could not be provided by Word — they are missing from the draft.",
      nl: "1 afbeeldingen kon Word niet leveren — ze ontbreken in het concept.",
    };
    // POSITIV: eine erfundene Fassung fuer genau einen Gegenstand. Sie darf NICHT anschlagen —
    // sonst verbietet das Merkmal jeden Satz und B1 waere unerfuellbar statt scharf.
    const EINZAHL_ERFUNDEN: Record<Sprache, string> = {
      de: "Word hat das Bild nicht herausgegeben; der Text ist vollständig.",
      en: "Word did not release the picture; the text is complete.",
      nl: "Word heeft de foto niet vrijgegeven; de tekst is volledig.",
    };
    for (const s of SPRACHEN) {
      const p = PLURALMARKER[s];
      expect(D2_PLURALISCH[s], `${s}: der pluralische D2-Text wird NICHT erkannt`).toMatch(
        p.marker,
      );
      expect(
        BASIS_ZAHLFORM[s],
        `${s}: die alte Zahlform „1 + Mehrzahlwort" wird NICHT erkannt`,
      ).toMatch(p.zahlform);
      expect(
        EINZAHL_ERFUNDEN[s],
        `${s}: das Merkmal schlaegt auf einen Einzahlsatz an`,
      ).not.toMatch(p.marker);
      expect(
        EINZAHL_ERFUNDEN[s],
        `${s}: die Zahlform schlaegt auf einen Einzahlsatz an`,
      ).not.toMatch(p.zahlform);
    }
  });
});
