// ================================================================================================
// JOB 3587 R2 · DIE AUSGÄNGE DES SPRACHSCHRITTS — DAUERHAFT GEPRÜFT, NICHT EINMAL VON HAND.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. Runde 1 hat die drei Ausgänge von `setzeSprache` (h6) beschrieben und
// keinen davon geprüft. BEN hat sie daraufhin einmal von Hand mit einem Stellvertreter angefahren
// und zwei Falschaussagen gemessen (`ben.md`, Korrekturpflicht 3):
//   · ein `pageerror` WÄHREND der Navigation kam als Navigations-Zeitüberschreitung heraus, nicht
//     als Seitenfehler — die Fläche war längst kaputt, die Meldung nannte den Grund nicht;
//   · war der Warteanker nie da, verschwieg die Meldung die zuletzt GELESENE Sprache, obwohl der
//     Schritt sie gelesen hatte.
// Eine Handprobe, die nicht im Bestand liegt, ist beim nächsten Umbau weg. Diese Datei ist ihre
// dauerhafte Fassung.
//
// UND SIE IST DER NETZBODEN UNTER DEM ZUSTANDSWARTEN. Der Auftrag verlangt, dass auf einen ZUSTAND
// gewartet wird und nicht auf eine Frist (§9). Diese Zusage war bis hierher nicht messbar: in der
// Messdatei folgt auf `setzeSprache` immer ein Neuaufbau der Seite (`messe(...)`), und der wendet
// die Sprache seinerseits an — ein `setzeSprache`, das GAR NICHT wartet, blieb dort grün (BENs
// Gegenprobe A). Hier wartet nichts hinterher: Fall A1 fährt eine Seite, die die Sprache erst beim
// DRITTEN Blick anwendet, und liest allein am Rückgabewert ab, ob der Schritt den Zustand abgewartet
// hat.
//
// WIE OHNE BROWSER GEMESSEN WIRD, OHNE ETWAS NACHZUBAUEN. Die Stellvertreterseite unten führt den
// ECHTEN Browserquelltext von `h6-chromium.ts` aus — dieselben Zeichenketten, die im Betrieb an
// `fn(...)` gehen — gegen ein gestelltes `document`/`localStorage`. Nachgebaut ist damit nur die
// UMGEBUNG (eine Seite, die langsam, kaputt oder stumm ist), nicht der geprüfte Code. Der Beleg,
// dass wirklich der echte Quelltext lief, steht in Fall A6: der Sprachschlüssel des Produkts landet
// im gestellten Speicher, ohne dass diese Datei ihn dort hineinschreibt.
//
// KEIN CHROMIUM: diese Datei startet keinen Browser. Über die Importhülle von `h6-chromium.ts`
// ordnet sie sich trotzdem in die serielle Gruppe ein (`tests/tor-inventar/browser-gruppe.ts`) —
// das ist die Rechnung für den Import des echten Prüfstands und ausdrücklich in Kauf genommen: ein
// nachgebautes `setzeSprache` wäre kein Beleg über das echte.
import { afterEach, describe, expect, it } from "vitest";
import { type Seite, type SprachLage, type Stand, setzeSprache } from "../design/h6-chromium";

/** Was die gestellte Seite bei jedem Blick zeigt — die Umgebung, nicht der Prüfgegenstand. */
interface Drehbuch {
  /** `<html lang>` beim `n`-ten Leseversuch (1-basiert). */
  lang: (versuch: number) => string;
  /** Steht der Warteanker beim `n`-ten Leseversuch? */
  ankerDa: (versuch: number) => boolean;
  /** Was der Anker beim `n`-ten Leseversuch zeigt. */
  ankerText: (versuch: number) => string;
  /** Wie lange der Seitenaufbau braucht (0 = sofort). */
  gotoDauerMs?: number;
  /** Der Seitenaufbau scheitert mit diesem Text. */
  gotoFehler?: string;
}

const schlaf = (ms: number): Promise<void> =>
  new Promise((fertig) => {
    setTimeout(fertig, ms);
  });

/** Ein gestelltes `localStorage`: eine Karte mit der Fläche, die der Browserquelltext benutzt. */
class Speicher {
  readonly werte = new Map<string, string>();
  setItem(schluessel: string, wert: string): void {
    this.werte.set(schluessel, String(wert));
  }
  getItem(schluessel: string): string | null {
    return this.werte.get(schluessel) ?? null;
  }
}

/**
 * Die gestellte Seite.
 *
 * `evaluate` erkennt am QUELLTEXT der übergebenen Funktion, welcher der beiden Browserschritte
 * gerade läuft (`new Function` trägt ihn in `toString()`) — und führt ihn dann wirklich aus.
 */
class Buehne implements Seite {
  readonly speicher = new Speicher();
  /** Jeder Handgriff in der Reihenfolge, in der er kam — der Beleg für „erst setzen, dann laden". */
  readonly handgriffe: string[] = [];
  leseVersuche = 0;
  constructor(private readonly drehbuch: Drehbuch) {}

  async evaluate<T>(browserFn: (arg: unknown) => unknown, arg?: unknown): Promise<T> {
    const quelle = String(browserFn);
    const liest = quelle.includes("documentElement.lang");
    this.handgriffe.push(liest ? "lesen" : "speichern");
    if (liest) {
      this.leseVersuche += 1;
    }
    const versuch = this.leseVersuche;
    const anker = this.drehbuch.ankerDa(versuch)
      ? { innerText: this.drehbuch.ankerText(versuch) }
      : null;
    const dokument = {
      documentElement: { lang: this.drehbuch.lang(versuch) },
      querySelector: () => anker,
    };
    const welt = globalThis as Record<string, unknown>;
    const vorher = { document: welt.document, localStorage: welt.localStorage };
    welt.document = dokument;
    welt.localStorage = this.speicher;
    try {
      return browserFn(arg) as T;
    } finally {
      welt.document = vorher.document;
      welt.localStorage = vorher.localStorage;
    }
  }

  async goto(url: string): Promise<unknown> {
    this.handgriffe.push(`goto ${new URL(url).pathname}`);
    await schlaf(this.drehbuch.gotoDauerMs ?? 0);
    if (this.drehbuch.gotoFehler !== undefined) {
      throw new Error(this.drehbuch.gotoFehler);
    }
    return null;
  }

  async waitForTimeout(ms: number): Promise<void> {
    await schlaf(Math.min(ms, 20));
  }

  async route(): Promise<void> {}
  async addInitScript(): Promise<void> {}
  async waitForFunction(): Promise<unknown> {
    return null;
  }
  on(): void {}
}

function machStand(seite: Seite | null, fehler: string | null = null): Stand {
  return {
    antworten: {},
    wirkungszahlen: async () => [],
    browser: null,
    seite,
    app: null,
    fehler,
    version: "stellvertreter",
    theme: "modern",
    seitenfehler: [],
    stoerung: null,
    abrufe: new Map<string, number>(),
  };
}

/** Immer dasselbe zeigen — die Vorlage, von der die Fälle abweichen. */
function stets(lang: string, anker: string | null): Drehbuch {
  return {
    lang: () => lang,
    ankerDa: () => anker !== null,
    ankerText: () => anker ?? "",
  };
}

const uhren: ReturnType<typeof setTimeout>[] = [];
/** Einen Seitenfehler auf denselben Kanal legen, den `starte` bedient (`h6-chromium.ts:290`). */
function meldeSeitenfehler(stand: Stand, text: string, nachMs: number): void {
  uhren.push(
    setTimeout(() => {
      stand.seitenfehler.push(text);
    }, nachMs),
  );
}

afterEach(() => {
  for (const uhr of uhren.splice(0)) {
    clearTimeout(uhr);
  }
});

async function fehlerVon(lauf: Promise<SprachLage>): Promise<string> {
  const ergebnis = await lauf.then(
    (lage) => ({ art: "grün" as const, lage }),
    (e: unknown) => ({ art: "rot" as const, text: String(e) }),
  );
  if (ergebnis.art === "grün") {
    throw new Error(
      `der Schritt kam DURCH, obwohl er hätte abbrechen müssen: ${JSON.stringify(ergebnis.lage)}`,
    );
  }
  return ergebnis.text;
}

describe("JOB 3587 · A · der Sprachschritt wartet auf den Zustand und sagt, was fehlt", () => {
  // ==============================================================================================
  // A1 — DER ZUSTAND WIRD ABGEWARTET, UND DER RÜCKGABEWERT BELEGT ES OHNE JEDEN NEUAUFBAU.
  // ==============================================================================================
  it("A1 · eine Seite, die die Sprache erst beim dritten Blick anwendet, wird abgewartet", async () => {
    const buehne = new Buehne({
      lang: (versuch) => (versuch >= 3 ? "nl" : "de"),
      ankerDa: () => true,
      ankerText: (versuch) => (versuch >= 3 ? "Vastleggen" : "Erfassen"),
    });
    const stand = machStand(buehne);
    const lage = await setzeSprache(stand, "nl", "/start", "header", { fristMs: 5_000 });
    expect(lage.lang, "der Schritt kehrte zurück, bevor die Seite die Sprache anwandte").toBe("nl");
    expect(lage.sprache).toBe("nl");
    expect(
      lage.versuche,
      "die Sprache stand erst beim dritten Blick da — mit einem Blick ist sie nicht abgewartet",
    ).toBeGreaterThanOrEqual(3);
    expect(lage.text, "der Rückgabewert trägt den Text des Ankers nicht").toContain("Vastleggen");
    expect(lage.wartedauer).toBeGreaterThanOrEqual(0);
    // eslint-disable-next-line no-console -- die gemessene Lage ist die Lieferung dieses Falls
    console.log(
      `JOB 3587 · A1 · zurück nach ${lage.versuche} Blicken / ${lage.wartedauer} ms · lang=${lage.lang} · „${lage.text}"`,
    );
  });

  // ==============================================================================================
  // A2 — EIN SEITENFEHLER WÄHREND DER NAVIGATION BEENDET DEN SCHRITT MIT SEINEM TEXT.
  // ==============================================================================================
  //
  // Das ist BENs erster Fund. Die Seite hier hängt vier Sekunden im Aufbau und meldet nach 30 ms
  // einen Fehler: wer erst auf das Ende des Aufbaus wartet, hat den Grund verpasst und meldet eine
  // Zeitüberschreitung. Zugesichert wird deshalb BEIDES: der Text des Seitenfehlers UND dass der
  // Abbruch kommt, bevor die Navigation fertig ist.
  it("A2 · `pageerror` während der Navigation: Abbruch mit seinem Text, nicht mit einer Frist", async () => {
    const buehne = new Buehne({ ...stets("de", "Erfassen"), gotoDauerMs: 4_000 });
    const stand = machStand(buehne);
    meldeSeitenfehler(stand, "BEN_PAGEERROR: TypeError: kaputt", 30);
    const beginn = Date.now();
    const text = await fehlerVon(setzeSprache(stand, "nl", "/start", "header", { fristMs: 5_000 }));
    const dauer = Date.now() - beginn;
    // eslint-disable-next-line no-console -- die wörtliche Meldung ist der Beleg
    console.log(`JOB 3587 · A2 · nach ${dauer} ms: ${text}`);
    expect(text, "der Seitenfehler steht nicht in der Meldung").toContain("BEN_PAGEERROR");
    expect(text, "die verlangte Sprache fehlt in der Meldung").toContain("nl");
    expect(
      dauer,
      `der Schritt wartete ${dauer} ms — also bis zum Ende der Navigation, statt den Fehler zu melden`,
    ).toBeLessThan(3_000);
  });

  // ==============================================================================================
  // A3 — FRIST AB, ANKER STAND DA: erwartete Sprache, angewandte Sprache, Text, Wartedauer.
  // ==============================================================================================
  it("A3 · Frist abgelaufen mit Anker: die Meldung trägt alle vier Angaben", async () => {
    const buehne = new Buehne(stets("de", "Erfassen"));
    const stand = machStand(buehne);
    const text = await fehlerVon(setzeSprache(stand, "nl", "/start", "header", { fristMs: 200 }));
    // eslint-disable-next-line no-console -- die wörtliche Meldung ist der Beleg
    console.log(`JOB 3587 · A3 · ${text}`);
    expect(text, "die erwartete Sprache fehlt").toContain('lang="nl"');
    expect(text, "die ANGEWANDTE Sprache fehlt").toContain("de");
    expect(text, "der gelesene Text fehlt").toContain("Erfassen");
    expect(text, "die Wartedauer fehlt").toMatch(/\d+ ms/);
    expect(text, "der Anker stand da — die Lage ist NICHT lastabhängig").not.toContain(
      "lastabhaengig",
    );
  });

  // ==============================================================================================
  // A4 — FRIST AB, ANKER WAR NIE DA: dieselbe Meldung, plus „lastabhaengig" — und die GELESENE
  // Sprache bleibt drin.
  // ==============================================================================================
  //
  // BENs zweiter Fund. Ohne Anker ist über die FLÄCHE nichts gesagt, über die Sprache aber schon
  // etwas: `<html lang>` wurde gelesen. Wer diesen Wert wegwirft, nimmt dem Menschen die einzige
  // Angabe, mit der er zwischen „Seite nicht fertig" und „Sprache kam nicht an" unterscheiden kann.
  it("A4 · Frist abgelaufen ohne Anker: lastabhängig UND mit der zuletzt gelesenen Sprache", async () => {
    const buehne = new Buehne(stets("de", null));
    const stand = machStand(buehne);
    const text = await fehlerVon(setzeSprache(stand, "nl", "/start", "header", { fristMs: 200 }));
    // eslint-disable-next-line no-console -- die wörtliche Meldung ist der Beleg
    console.log(`JOB 3587 · A4 · ${text}`);
    expect(text, "die Lage ist nicht als lastabhängig gekennzeichnet").toContain("lastabhaengig");
    expect(text, "der Anker wird nicht benannt").toContain("header");
    expect(
      text,
      "die zuletzt GELESENE Sprache fehlt — der Schritt hat sie gelesen und weggeworfen",
    ).toContain("lang=de");
    expect(text, "die erwartete Sprache fehlt").toContain('lang="nl"');
  });

  // ==============================================================================================
  // A5 — EIN SEITENFEHLER IN DER WARTESCHLEIFE beendet den Schritt ebenfalls sofort.
  // ==============================================================================================
  it("A5 · `pageerror` nach dem Aufbau: Abbruch mit seinem Text, nicht erst nach der Frist", async () => {
    const buehne = new Buehne(stets("de", "Erfassen"));
    const stand = machStand(buehne);
    meldeSeitenfehler(stand, "BEN_PAGEERROR_SPAET: ReferenceError", 20);
    const text = await fehlerVon(setzeSprache(stand, "nl", "/start", "header", { fristMs: 3_000 }));
    // eslint-disable-next-line no-console -- die wörtliche Meldung ist der Beleg
    console.log(`JOB 3587 · A5 · ${text}`);
    expect(text).toContain("BEN_PAGEERROR_SPAET");
  });

  // ==============================================================================================
  // A6 — DIE REIHENFOLGE UND DER BELEG, DASS DER ECHTE QUELLTEXT LIEF.
  // ==============================================================================================
  it("A6 · erst der Speicher, dann der Neuaufbau, dann das Lesen — und der Schlüssel kommt an", async () => {
    const buehne = new Buehne(stets("nl", "Vastleggen"));
    const stand = machStand(buehne);
    await setzeSprache(stand, "nl", "/start", "header");
    expect(
      buehne.speicher.getItem("kw.sprache"),
      "der echte Browserquelltext hat den Sprachschlüssel des Produkts nicht geschrieben",
    ).toBe("nl");
    expect(buehne.handgriffe.slice(0, 3), "die Reihenfolge des Schritts stimmt nicht").toEqual([
      "speichern",
      "goto /start",
      "lesen",
    ]);
  });

  // ==============================================================================================
  // A7 — EIN GESCHEITERTER SEITENAUFBAU wird als solcher gemeldet.
  // ==============================================================================================
  it("A7 · scheitert der Neuaufbau, nennt die Meldung ihn — und nicht die Sprache als Ursache", async () => {
    const buehne = new Buehne({ ...stets("de", "Erfassen"), gotoFehler: "BEN_GOTO_KAPUTT" });
    const stand = machStand(buehne);
    const text = await fehlerVon(setzeSprache(stand, "nl", "/start", "header", { fristMs: 200 }));
    // eslint-disable-next-line no-console -- die wörtliche Meldung ist der Beleg
    console.log(`JOB 3587 · A7 · ${text}`);
    expect(text).toContain("BEN_GOTO_KAPUTT");
    expect(text, "der Pfad des Aufbaus fehlt").toContain("/start");
  });

  // ==============================================================================================
  // A8 — OHNE BÜHNE gibt es keine Messung, und der Grund steht dabei.
  // ==============================================================================================
  it("A8 · steht die Bühne nicht, bricht der Schritt mit ihrem Grund ab", async () => {
    const stand = machStand(null, "Chromium kam nicht hoch: BEN_KEIN_BROWSER");
    const text = await fehlerVon(setzeSprache(stand, "nl"));
    expect(text).toContain("BEN_KEIN_BROWSER");
  });
});
