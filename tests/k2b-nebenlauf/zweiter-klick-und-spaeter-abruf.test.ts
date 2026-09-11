// @vitest-environment jsdom
// ================================================================================================
// JOB 3594 · K2b NEBENLAUF — ZWEI KLICKS, EIN ENTWURF. UND: DER JUENGSTE ABRUF GEWINNT.
// ================================================================================================
//
// DIE ZWEI RESTE DER ZEILE K2b, beide von JOB 3555 woertlich weitergereicht
// (`archiv/3555/runde-6/RUECKGABE.md:54`, Urherkunft `archiv/3057/runde-4/RUECKGABE.md:30`):
//
//   (A) DER SENDEN-KNOPF SPERRT SICH NICHT. `sendeEntwurf` (taskpane.html) zaehlt bei jedem Aufruf
//       `captureSendeLauf` hoch und prueft die Nummer an DREI Stellen — aber alle drei liegen
//       HINTER dem `fetch("/api/drafts", …)`. Sie unterdruecken die Anzeige eines aelteren Laufs;
//       den POST verhindern sie nicht. Pedi klickt zweimal, weil es dauert, und hat danach ZWEI
//       Entwuerfe auf dem Server — sichtbar ist nur einer, also raeumt niemand den zweiten weg.
//       A1 misst das als ZAHL der wirklich abgesetzten POSTs, nicht als Vermutung.
//
//   (B) DIE BEREICHS-VERWERFUNG IST NIE AUSGEFUEHRT WORDEN. `captureBereicheLesen` traegt drei
//       Laufnummer-Pruefungen und darueber den Satz „Ein spaeter Ruecklauf eines aelteren Abrufs
//       veraendert nichts (Laufnummer)". Gemessen war bisher nur, DASS der Abruf beim Betreten
//       genau einmal laeuft (`tests/design/k2-funktionsinventar.test.ts`, I16) — nie, was ein
//       ueberholter Abruf tut, wenn er sich spaeter meldet. N1–N4 fahren genau das.
//
// WIE HIER GEMESSEN WIRD — und warum ohne Chromium: die Fragen dieses Jobs sind REIHENFOLGE-Fragen
// (wer antwortet wann, welcher Lauf schreibt zuletzt). Dafuer braucht es keinen echten Browser,
// sondern die Hand am Antwortzeitpunkt. Gefahren wird deshalb auf der VORHANDENEN Panel-Fixture
// (`tests/app/klara-panel-fixture.ts`): sie schneidet Rumpf und Inline-Skript aus dem
// AUSGELIEFERTEN `apps/web/public/word-addin/taskpane.html` und fuehrt das Skript wirklich aus.
// Kein Nachbau, keine zweite Wahrheit, KEINE neue Chromium-Startstelle (Auftrag §10).
//
// DAS TOR (`torAuf`) ist die Bauform von `tests/word-vergleich/zwei-laeufe-und-spaete-antworten.
// test.ts:121`: es wird UM den Fetch der Fixture gelegt, nicht an seine Stelle. Gezaehlt wird beim
// EINTRITT — sonst waere eine festgehaltene Anfrage unsichtbar, und „ein zweiter POST ging hinaus"
// nicht von „er steht noch an" zu unterscheiden.
//
// DER WAECHTER, DEN EIN KOMMENTAR NICHT BEFRIEDIGT (Auftrag §5.6): jeder Fall hier fuehrt das
// Skript AUS. Ersetzt man eine der vier Entscheidungsstellen durch einen Kommentar gleichen
// Wortlauts, faellt genau der benannte Fall — gemessen als Gegenprobe (a)–(d) der Rueckgabe. Ein
// Zeichenkettenvergleich auf den Quelltext steht hier bewusst NIRGENDS.
//
// RED-FIRST (11.09.2026, Basisstand e2cb078): A1 faellt („2 statt 1"). N1–N4 sind auf diesem Stand
// bereits gruen — das ist kein Erfolg dieses Jobs, sondern der Beleg, dass die drei vorhandenen
// Verwerfungen wirklich tragen; ihr Wert steht in den Gegenproben (a)–(c).
//
// RUNDE 2 (BEN) — ZWEI LUECKEN IN DER MESSUNG SELBST, beide hier geschlossen:
//   A3b: der Office-Fake antwortet synchron, also war die Spanne zwischen Klick und Word-Antwort
//        unsichtbar. In genau dieser Spanne stand bis Runde 1 ein gesperrter Knopf OHNE Erklaersatz.
//        `wordAnhalten()` haelt den Rueckruf fest und misst sie.
//   N5:  das Tor gab Antwortkopf UND Inhalt in einem Zug heraus, also konnte kein ueberholter Lauf
//        je die dritte Verwerfung (nach `res.json()`) erreichen. Sie sah redundant aus und war es
//        nicht. Der Ausgang `kopf` trennt beides; N5 stellt den Fall her.
// BEIDE sind KEIN neuer Anspruch an das Produkt, der hier nachtraeglich erfunden wuerde — A3b misst
// das Zustandsmodell des Auftrags (§9: *laedt* → nicht bedienbar, Satz `sendBusy`), N5 die Zusage
// im Quelltext („Ein spaeter Ruecklauf eines aelteren Abrufs veraendert nichts").
import { afterEach, describe, expect, it } from "vitest";
import { type KlaraPanel, createKlaraPanel, reply } from "../app/klara-panel-fixture";

/** Die Markierung, mit der die Erfassen-Flaeche ihren Ruhezustand zeigt (zwei Absaetze). */
const MARKIERUNG = "Erster Absatz der Markierung.\nZweiter Absatz der Markierung.";
/** Die Absaetze des „ganzen Dokuments" — nur der Dokument-Weg liest sie. */
const DOKUMENT = ["Dokumenttext eins.", "Dokumenttext zwei."];

let panel: KlaraPanel | null = null;
afterEach(() => {
  panel?.restore();
  panel = null;
  Reflect.deleteProperty(globalThis, "Word");
});

// ------------------------------------------------------------------------------------------------
// DAS TOR: jede Anfrage mit dem gegebenen Praefix wird festgehalten, bis der Test sie EINZELN
// beantwortet. Nur so entsteht das Fenster, in dem sich zwei Laeufe ueberholen koennen.
// ------------------------------------------------------------------------------------------------

/**
 * Wie eine festgehaltene Anfrage endet. `durch` reicht sie an die Routen der Fixture weiter.
 *
 * RUNDE 2 (BEN, Korrekturpflicht 2) — `kopf` IST DER GRUND, WARUM DIESER TYP ERWEITERT WURDE.
 * Bis Runde 1 gab `antwort` Kopf UND Inhalt in einem Zug heraus: `json()` war schon aufgeloest, als
 * die Antwort ankam. Zwischen der Pruefung nach dem Abruf und der Pruefung nach `res.json()` lag
 * damit KEIN Zeitfenster — und deshalb blieb die dritte Pruefung gruen, auch wenn man sie entfernte.
 * Das war keine Redundanz im Produkt, sondern eine Luecke in der Messung. `kopf` gibt den
 * Antwortkopf JETZT und haelt den Inhalt fest, bis `koerperGeben` ihn freigibt; erst damit ist der
 * Fall herstellbar, in dem ein Abruf beim Lesen des Inhalts von einem juengeren ueberholt wird.
 */
type Ausgang =
  | { art: "durch" }
  | { art: "antwort"; status: number; koerper: unknown }
  | { art: "kopf"; status: number }
  | { art: "wurf"; grund: string };

interface Tor {
  /** Jede eingetretene Anfrage, in Reihenfolge des EINTRITTS (nicht der Beantwortung). */
  readonly gestellt: ReadonlyArray<{ url: string; koerper: string | undefined }>;
  /** Die i-te festgehaltene Anfrage beenden. */
  beantworten(i: number, ausgang: Ausgang): void;
  /** Den zurueckgehaltenen Inhalt der i-ten Anfrage (Ausgang `kopf`) endlich herausgeben. */
  koerperGeben(i: number, koerper: unknown): void;
}

interface FetchGlobals {
  fetch: (url: string, init?: Record<string, unknown>) => Promise<unknown>;
  window: { fetch: (url: string, init?: Record<string, unknown>) => Promise<unknown> };
}

function torAuf(praefix: string): Tor {
  const globals = globalThis as unknown as FetchGlobals;
  const durch = globals.fetch;
  const wartend: Array<(a: Ausgang) => void> = [];
  const koerperHaehne: Array<(k: unknown) => void> = [];
  const koerperVersprechen: Array<Promise<unknown>> = [];
  const gestellt: Array<{ url: string; koerper: string | undefined }> = [];
  const gehalten = async (url: string, init?: Record<string, unknown>): Promise<unknown> => {
    if (!String(url).startsWith(praefix)) {
      return durch(url, init);
    }
    const index = gestellt.length;
    gestellt.push({
      url: String(url),
      koerper: typeof init?.body === "string" ? init.body : undefined,
    });
    koerperVersprechen[index] = new Promise<unknown>((los) => {
      koerperHaehne[index] = los;
    });
    const ausgang = await new Promise<Ausgang>((los) => {
      wartend.push(los);
    });
    if (ausgang.art === "durch") {
      return durch(url, init);
    }
    if (ausgang.art === "wurf") {
      throw new Error(ausgang.grund);
    }
    // `kopf`: der Inhalt bleibt haengen, bis `koerperGeben` ihn gibt — sonst ist er sofort da.
    const inhalt: Promise<unknown> =
      ausgang.art === "kopf"
        ? (koerperVersprechen[index] as Promise<unknown>)
        : Promise.resolve(ausgang.koerper);
    return {
      ok: ausgang.status >= 200 && ausgang.status < 300,
      status: ausgang.status,
      headers: { get: (): string | null => null },
      json: (): Promise<unknown> => inhalt,
    };
  };
  globals.fetch = gehalten;
  globals.window.fetch = gehalten;
  return {
    gestellt,
    beantworten(i, ausgang): void {
      const los = wartend[i];
      if (los === undefined) {
        throw new Error(
          `Anfrage ${i} an ${praefix} wurde nie gestellt — der Fall ist nicht hergestellt`,
        );
      }
      los(ausgang);
    },
    koerperGeben(i, koerper): void {
      const los = koerperHaehne[i];
      if (los === undefined) {
        throw new Error(
          `Anfrage ${i} an ${praefix} wurde nie gestellt — es gibt keinen Inhalt zu geben`,
        );
      }
      los(koerper);
    },
  };
}

// ------------------------------------------------------------------------------------------------
// DER ANGEHALTENE WORD-ZUGRIFF (RUNDE 2, BEN Korrekturpflicht 1)
// ------------------------------------------------------------------------------------------------
//
// Der Office-Fake der Fixture antwortet SYNCHRON. Genau deshalb war die Spanne zwischen „Klick" und
// „Word hat geantwortet" in Runde 1 nicht messbar — und genau in dieser Spanne stand bis Runde 1 ein
// gesperrter Knopf OHNE Erklaersatz. Der Griff hier haelt den Rueckruf von `getSelectedDataAsync`
// fest, bis der Test ihn freigibt; erst danach laeuft alles wie sonst weiter (der ECHTE Rueckruf des
// Fakes wird gerufen, nicht ein Ersatz — es entsteht keine zweite Wahrheit ueber Word).

interface OfficeDokument {
  getSelectedDataAsync: (
    typ: string,
    rueckruf: (r: { status: string; value: string }) => void,
  ) => void;
}

function wordAnhalten(): { angefragt: () => number; freigeben: () => void } {
  const office = (globalThis as unknown as { Office: { context: { document: OfficeDokument } } })
    .Office;
  const dokument = office.context.document;
  const echt = dokument.getSelectedDataAsync;
  const wartend: Array<() => void> = [];
  dokument.getSelectedDataAsync = (typ, rueckruf): void => {
    wartend.push(() => {
      echt.call(dokument, typ, rueckruf);
    });
  };
  return {
    angefragt: (): number => wartend.length,
    freigeben: (): void => {
      const offen = wartend.slice();
      wartend.length = 0;
      for (const los of offen) {
        los();
      }
    },
  };
}

// ------------------------------------------------------------------------------------------------
// Handgriffe am Panel
// ------------------------------------------------------------------------------------------------

function oeffnen(opts: Parameters<typeof createKlaraPanel>[0] = {}): KlaraPanel {
  panel = createKlaraPanel({ selectionText: MARKIERUNG, ...opts });
  return panel;
}

/** Die Nutzlasten, die wirklich hinausgingen — beide Entwurfswege. */
function posts(p: KlaraPanel): Array<Record<string, unknown>> {
  return p.calls
    .filter(
      (c) => c.method === "POST" && (c.url === "/api/drafts" || c.url === "/api/drafts/from-docx"),
    )
    .map((c) => JSON.parse(c.body ?? "{}") as Record<string, unknown>);
}

/** `Word.run` fuer den Dokument-Weg — Rueckfall ohne getFileAsync (die Fixture stellt kein FileType). */
function wordStellen(): void {
  const body = {
    text: DOKUMENT.join("\n"),
    load: (): void => {},
    getHtml: () => ({
      value: `<html><body>${DOKUMENT.map((z) => `<p>${z}</p>`).join("")}</body></html>`,
    }),
  };
  const context = { document: { body }, sync: () => Promise.resolve() };
  (globalThis as unknown as { Word: unknown }).Word = {
    run: (cb: (c: typeof context) => unknown) => Promise.resolve().then(() => cb(context)),
  };
}

function waehlen(p: KlaraPanel, wert: string): void {
  const feld = p.q("#capture-bereich");
  if (feld === null) {
    throw new Error("#capture-bereich fehlt");
  }
  feld.value = wert;
  expect(feld.value, `„${wert}“ steht nicht in der Liste`).toBe(wert);
  const EventKlasse = (globalThis as unknown as { Event: new (typ: string) => { type: string } })
    .Event;
  feld.dispatchEvent(new EventKlasse("change"));
}

/** Eine Antwort auf `GET /api/categories` mit genau diesen Namen. */
function bereiche(...namen: string[]): { categories: Array<{ name: string; count: number }> } {
  return { categories: namen.map((name) => ({ name, count: 1 })) };
}

/** Die Flaeche verlassen und neu betreten — der Anlass, an dem `setTab` die Bereiche frisch holt. */
function neuBetreten(p: KlaraPanel): void {
  p.setTab("ask");
  p.setTab("capture");
}

// ================================================================================================
// A — DER ZWEITE KLICK AUF „SENDEN"
// ================================================================================================

describe("JOB 3594 · A · zwei Klicks auf „Senden“ duerfen keine zwei Entwuerfe machen", () => {
  it("A1 · ZAEHLFALL: waehrend der erste POST /api/drafts offen ist, macht ein zweiter Klick KEINEN zweiten POST", async () => {
    const p = oeffnen({
      routes: {
        "/api/categories": reply(200, bereiche()),
        "/api/drafts": reply(201, { id: "d-1" }),
      },
    });
    const tor = torAuf("/api/drafts");
    await p.flush();
    p.setTab("capture");
    await p.flush();
    expect(p.q("#send-btn")?.disabled, "der Knopf ist vor dem Klick frei").toBe(false);

    // Zwei Klicks, waehrend das Tor den ersten POST festhaelt — Pedis Fall.
    p.sendSelection();
    p.sendSelection();
    await p.flush();

    // Die Zahl ist die Aussage dieses Falls; sie steht wortgleich in der Rueckgabe.
    console.info(
      `JOB 3594 A1 · abgesetzte POST /api/drafts nach zwei Klicks: ${tor.gestellt.length}`,
    );
    expect(tor.gestellt.length, "zwei Klicks = zwei Entwuerfe auf dem Server").toBe(1);
  });

  it("A2 · derselbe Riegel gilt fuer „Ganzes Dokument uebernehmen“ — derselbe POST, anderer Eingang", async () => {
    wordStellen();
    const p = oeffnen({
      routes: {
        "/api/categories": reply(200, bereiche()),
        "/api/drafts": reply(201, { id: "d-1" }),
        "/api/drafts/from-docx": reply(201, { id: "d-2" }),
      },
    });
    const tor = torAuf("/api/drafts");
    await p.flush();
    p.setTab("capture");
    await p.flush();

    p.sendSelection();
    await p.flush();
    expect(tor.gestellt.length, "der Auswahl-POST steht offen").toBe(1);

    // (a) Der Textlink ist waehrend des Laufs sichtbar nicht bedienbar — dieselbe vorhandene
    //     Anzeige wie ohne Anmeldung, kein neuer Text, keine neue Farbe.
    expect(p.q("#capture-dokument-link")?.getAttribute("aria-disabled")).toBe("true");
    p.q("#capture-dokument-link")?.click();
    await p.flush();

    // (b) UND die Entscheidung sitzt in `sendeEntwurf`, nicht am Link: der direkte Aufruf des
    //     Dokument-Wegs (der Weg des „Erneut senden"-Knopfs) kommt genauso wenig durch.
    p.sendDocument();
    await p.flush();
    expect(tor.gestellt.length, "der Dokument-Weg hat am Riegel vorbei gesendet").toBe(1);
    expect(posts(p), "kein POST darf die Fixture-Routen erreicht haben").toHaveLength(0);
  });

  it("A3 · die Sperre luegt nicht: der gesperrte Knopf traegt den vorhandenen Satz `sendBusy` und keinen neuen", async () => {
    const p = oeffnen({
      routes: {
        "/api/categories": reply(200, bereiche()),
        "/api/drafts": reply(201, { id: "d-1" }),
      },
    });
    const tor = torAuf("/api/drafts");
    await p.flush();
    p.setTab("capture");
    await p.flush();
    p.sendSelection();
    await p.flush();

    expect(p.q("#send-btn")?.disabled, "der Knopf ist waehrend des Laufs nicht bedienbar").toBe(
      true,
    );
    // Kein neuer Satz am Knopf: der Titel bleibt leer (er traegt nur Office-Gruende, JOB 3018).
    expect(p.q("#send-btn")?.title).toBe("");
    // Der Statussatz ist der VORHANDENE laufende Satz, ruhig (kein „warn"), ohne Knopf.
    expect(p.text("#send-status")).toBe(p.t("sendBusy"));
    expect(p.q("#send-status")?.className).toBe("status");
    expect(p.q("#send-status-btn")?.className).toBe("ghost capture-knopf hidden");
    // Und der Satz ist wirklich der Bestandsschluessel, keine neue Erfindung.
    expect(p.t("sendBusy").length).toBeGreaterThan(0);
    tor.beantworten(0, { art: "durch" });
    await p.flush();
  });

  it("A3b · der Satz steht, BEVOR Word geantwortet hat — ein grauer Knopf ohne Erklaerung waere die halbe Sperre", async () => {
    // RUNDE 2 (BEN, Korrekturpflicht 1): zwischen Klick und POST liegt der Word-Zugriff. Bei einem
    // langsamen Word ist das die Spanne, in der Pedi ein zweites Mal klickt — und bis Runde 1 sah er
    // darin einen gesperrten Knopf ohne jeden Grund (`sendBusy` wurde erst in `finish` gesetzt,
    // gemessen als `expected '' to be 'Sende …'`). Hier wird genau diese Spanne angehalten.
    const p = oeffnen({
      routes: {
        "/api/categories": reply(200, bereiche()),
        "/api/drafts": reply(201, { id: "d-1" }),
      },
    });
    const tor = torAuf("/api/drafts");
    await p.flush();
    p.setTab("capture");
    await p.flush();
    expect(p.q("#send-btn")?.disabled, "der Knopf ist vor dem Klick frei").toBe(false);

    const word = wordAnhalten();
    p.sendSelection();
    await p.flush();

    // Word haelt — also ist noch nichts hinausgegangen, es gibt ja noch keinen Inhalt.
    expect(word.angefragt(), "der Word-Zugriff steht offen — der Fall ist hergestellt").toBe(1);
    expect(tor.gestellt.length, "ohne Word-Antwort gibt es nichts zu senden").toBe(0);
    // UND TROTZDEM: beide Eingaenge sind zu, und der Grund steht sichtbar da.
    expect(p.q("#send-btn")?.disabled, "der Knopf ist waehrend des Word-Zugriffs frei").toBe(true);
    expect(p.q("#capture-dokument-link")?.getAttribute("aria-disabled")).toBe("true");
    expect(p.text("#send-status"), "die Sperre steht ohne Erklaerung da").toBe(p.t("sendBusy"));
    expect(p.q("#send-status")?.className).toBe("status");
    expect(p.q("#send-status-btn")?.className).toBe("ghost capture-knopf hidden");
    expect(p.q("#send-btn")?.title).toBe("");

    // Ein zweiter Klick in genau dieser Spanne greift nicht einmal mehr in Word.
    p.sendSelection();
    await p.flush();
    expect(word.angefragt(), "der zweite Klick hat ein zweites Mal in Word gegriffen").toBe(1);

    // Regulaerer Abschluss: Word antwortet, EIN POST geht hinaus, danach ist alles wieder offen.
    word.freigeben();
    await p.flush();
    expect(tor.gestellt.length, "nach der Word-Antwort geht genau ein POST hinaus").toBe(1);
    tor.beantworten(0, { art: "durch" });
    await p.flush();
    await p.flush();
    expect(p.text("#capture-ergebnis")).toBe(`${p.t("sendOk")}${p.t("openLink")}`);
    expect(p.q("#send-btn")?.disabled, "der Knopf haengt nach dem Abschluss").toBe(false);
    expect(p.q("#capture-dokument-link")?.getAttribute("aria-disabled")).toBeNull();
  });

  it("A4 · Erfolg loest die Sperre: danach geht ein zweiter Versand wirklich hinaus", async () => {
    const p = oeffnen({
      routes: {
        "/api/categories": reply(200, bereiche()),
        "/api/drafts": reply(201, { id: "d-1" }),
      },
    });
    const tor = torAuf("/api/drafts");
    await p.flush();
    p.setTab("capture");
    await p.flush();

    p.sendSelection();
    await p.flush();
    tor.beantworten(0, { art: "durch" });
    await p.flush();
    await p.flush();
    expect(p.text("#capture-ergebnis")).toBe(`${p.t("sendOk")}${p.t("openLink")}`);
    expect(p.q("#send-btn")?.disabled, "nach dem Erfolg ist der Knopf wieder frei").toBe(false);
    expect(p.q("#capture-dokument-link")?.getAttribute("aria-disabled")).toBeNull();

    p.sendSelection();
    await p.flush();
    expect(tor.gestellt.length, "der zweite, GEWOLLTE Versand geht hinaus").toBe(2);
  });

  it("A5 · ein abgelehnter Entwurf (413) loest die Sperre — mit „Erneut senden“, und das Erneut geht hinaus", async () => {
    const p = oeffnen({
      routes: {
        "/api/categories": reply(200, bereiche()),
        "/api/drafts": reply(201, { id: "d-1" }),
      },
    });
    const tor = torAuf("/api/drafts");
    await p.flush();
    p.setTab("capture");
    await p.flush();

    p.sendSelection();
    await p.flush();
    tor.beantworten(0, { art: "antwort", status: 413, koerper: {} });
    await p.flush();
    await p.flush();
    expect(p.q("#send-status")?.className).toBe("status warn");
    expect(p.text("#send-status-btn")).toBe(p.t("captureRetry"));
    expect(p.q("#send-btn")?.disabled, "nach dem Fehlschlag ist der Knopf wieder frei").toBe(false);

    // Der EINE Knopf am Fehlersatz fuehrt durch dieselbe Funktion — er muss jetzt durchkommen.
    p.q("#send-status-btn")?.click();
    await p.flush();
    expect(tor.gestellt.length, "„Erneut senden“ haengt an einer haengengebliebenen Sperre").toBe(
      2,
    );
  });

  it("A6 · ein Wurf (offline) loest die Sperre — ein Knopf, der nach einem Netzfehler gesperrt bliebe, waere schlimmer als die Luecke", async () => {
    const p = oeffnen({
      routes: {
        "/api/categories": reply(200, bereiche()),
        "/api/drafts": reply(201, { id: "d-1" }),
      },
    });
    const tor = torAuf("/api/drafts");
    await p.flush();
    p.setTab("capture");
    await p.flush();

    p.sendSelection();
    await p.flush();
    tor.beantworten(0, { art: "wurf", grund: "Failed to fetch" });
    await p.flush();
    await p.flush();
    expect(p.text("#send-status")).toBe(p.t("sendOffline"));
    expect(p.q("#send-btn")?.disabled).toBe(false);

    p.sendSelection();
    await p.flush();
    expect(tor.gestellt.length).toBe(2);
  });

  it("A7 · der fruehe Ausgang ohne Text (`sendEmpty`) loest die Sperre — obwohl gar kein POST lief", async () => {
    // Word gibt HTML OHNE Text heraus (`selectionHtml: ""`), die Karte traegt aber eine Markierung
    // (`selectionText`) — also ist der Knopf frei, und `finish` steigt bei der Leerpruefung aus,
    // lange vor dem `fetch`. Auch dieser Ausgang hat einen offenen Lauf zu schliessen.
    const p = oeffnen({
      selectionHtml: "",
      routes: {
        "/api/categories": reply(200, bereiche()),
        "/api/drafts": reply(201, { id: "d-1" }),
      },
    });
    const tor = torAuf("/api/drafts");
    await p.flush();
    p.setTab("capture");
    await p.flush();
    expect(p.q("#send-btn")?.disabled).toBe(false);

    p.sendSelection();
    await p.flush();
    expect(tor.gestellt.length, "ohne Text geht nichts hinaus").toBe(0);
    expect(p.text("#send-status")).toBe(p.t("sendEmpty"));
    expect(p.q("#send-btn")?.disabled, "der Knopf haengt nach dem Leerfall").toBe(false);
    expect(p.q("#capture-dokument-link")?.getAttribute("aria-disabled")).toBeNull();
  });

  it("A8 · ein Fehlschlag der Word-API OHNE jeden POST loest die Sperre — sonst bliebe der Knopf fuer immer grau", async () => {
    // KEIN `Word` im Fenster: `sendDocument` faellt ueber `holeGanzeDatei` auf `readWholeDocument`,
    // und das steigt dort mit einem ehrlichen Satz aus, OHNE seinen Rueckruf zu rufen. Genau dieser
    // Ausgang hat keinen Ruecklauf, an dem eine Sperre von selbst fiele.
    const p = oeffnen({
      routes: {
        "/api/categories": reply(200, bereiche()),
        "/api/drafts": reply(201, { id: "d-1" }),
      },
    });
    const tor = torAuf("/api/drafts");
    await p.flush();
    p.setTab("capture");
    await p.flush();

    p.sendDocument();
    await p.flush();
    expect(tor.gestellt.length).toBe(0);
    expect(p.text("#send-status")).toBe(p.t("sendError", { detail: "Word-API" }));
    expect(p.q("#send-btn")?.disabled, "der Knopf haengt nach einem Word-Fehlschlag").toBe(false);
    expect(p.q("#capture-dokument-link")?.getAttribute("aria-disabled")).toBeNull();

    // Und der Auswahl-Weg ist danach wirklich wieder offen.
    p.sendSelection();
    await p.flush();
    expect(tor.gestellt.length).toBe(1);
  });
});

// ================================================================================================
// N — DER SPAET ZURUECKKOMMENDE BEREICHS-ABRUF
// ================================================================================================

describe("JOB 3594 · N · ein spaeter Ruecklauf eines aelteren Abrufs veraendert nichts", () => {
  it("N1 · der juengere antwortet zuerst, der aeltere danach: Liste, Lage und Wahl bleiben die des juengeren", async () => {
    const p = oeffnen({ routes: { "/api/drafts": reply(201, { id: "d-1" }) } });
    const tor = torAuf("/api/categories");
    await p.flush();

    p.setTab("capture"); // Lauf 1 (der aeltere)
    neuBetreten(p); // Lauf 2 (der juengere)
    await p.flush();
    expect(tor.gestellt.length, "zwei ueberlappende Abrufe — der Fall ist hergestellt").toBe(2);

    // Der JUENGERE antwortet zuerst.
    tor.beantworten(1, { art: "antwort", status: 200, koerper: bereiche("Recht", "Steuer") });
    await p.flush();
    expect(p.text("#capture-bereich")).toBe(`${p.t("captureBereichWahl")}RechtSteuer`);
    waehlen(p, "Recht");

    // Der AELTERE meldet sich spaeter, mit einer anderen Liste — und aendert nichts.
    tor.beantworten(0, { art: "antwort", status: 200, koerper: bereiche("Technik") });
    await p.flush();
    expect(p.text("#capture-bereich"), "die Liste des aelteren Laufs hat sich durchgesetzt").toBe(
      `${p.t("captureBereichWahl")}RechtSteuer`,
    );
    expect(p.q("#capture-bereich")?.value).toBe("Recht");
    expect(p.q("#capture-bereich")?.disabled).toBe(false);
  });

  it("N2a · der aeltere scheitert spaet mit Nicht-200: die Liste des juengeren bleibt, die Wahl bleibt, die Lage wird nicht „fehler“", async () => {
    const p = oeffnen({ routes: { "/api/drafts": reply(201, { id: "d-1" }) } });
    const tor = torAuf("/api/categories");
    await p.flush();

    p.setTab("capture");
    neuBetreten(p);
    await p.flush();
    tor.beantworten(1, { art: "antwort", status: 200, koerper: bereiche("Recht", "Steuer") });
    await p.flush();
    waehlen(p, "Steuer");

    tor.beantworten(0, { art: "antwort", status: 500, koerper: { error: "BOOM" } });
    await p.flush();
    expect(p.text("#capture-bereich")).not.toBe(p.t("captureBereichFehler"));
    expect(p.text("#capture-bereich")).toBe(`${p.t("captureBereichWahl")}RechtSteuer`);
    expect(p.q("#capture-bereich")?.value).toBe("Steuer");
    expect(p.q("#capture-bereich")?.disabled).toBe(false);
  });

  it("N2b · der aeltere scheitert spaet mit einem Wurf: derselbe Befund — ein toter Abruf zerstoert keine frische Liste", async () => {
    const p = oeffnen({ routes: { "/api/drafts": reply(201, { id: "d-1" }) } });
    const tor = torAuf("/api/categories");
    await p.flush();

    p.setTab("capture");
    neuBetreten(p);
    await p.flush();
    tor.beantworten(1, { art: "antwort", status: 200, koerper: bereiche("Recht", "Steuer") });
    await p.flush();
    waehlen(p, "Recht");

    tor.beantworten(0, { art: "wurf", grund: "Failed to fetch" });
    await p.flush();
    expect(p.text("#capture-bereich")).not.toBe(p.t("captureBereichFehler"));
    expect(p.text("#capture-bereich")).toBe(`${p.t("captureBereichWahl")}RechtSteuer`);
    expect(p.q("#capture-bereich")?.value).toBe("Recht");
  });

  it("N3 · der aeltere liefert spaet eine LEERE Liste: die Wahl des juengeren Laufs faellt NICHT", async () => {
    const p = oeffnen({ routes: { "/api/drafts": reply(201, { id: "d-1" }) } });
    const tor = torAuf("/api/categories");
    await p.flush();

    p.setTab("capture");
    neuBetreten(p);
    await p.flush();
    tor.beantworten(1, { art: "antwort", status: 200, koerper: bereiche("Recht", "Steuer") });
    await p.flush();
    waehlen(p, "Recht");

    // Die erfolgreiche LEERE Antwort verwirft die gehaltene Wahl (JOB 3555, RUNDE 5) — aber nur im
    // AKTUELLEN Lauf. Hier gehoert sie einem ueberholten, also greift sie nicht.
    tor.beantworten(0, { art: "antwort", status: 200, koerper: bereiche() });
    await p.flush();
    expect(p.text("#capture-bereich")).not.toBe(p.t("captureBereichLeer"));
    expect(p.q("#capture-bereich")?.value, "die Wahl des juengsten Laufs ist gefallen").toBe(
      "Recht",
    );
  });

  it("N5 · der aeltere haengt beim INHALT und wird dabei ueberholt: sein spaeter Inhalt aendert nichts", async () => {
    // RUNDE 2 (BEN, Korrekturpflicht 2) — DER FALL, DEN N1–N4 NICHT HERSTELLEN KONNTEN.
    // `captureBereicheLesen` prueft die Laufnummer an drei Stellen: im `scheitern`-Verschluss, nach
    // dem Abruf und nach `res.json()`. N1 deckt die zweite ab — dort wird der aeltere Abruf schon am
    // ANTWORTKOPF abgewiesen, und weil das Tor bis Runde 1 Kopf und Inhalt gemeinsam herausgab,
    // erreichte nie ein ueberholter Lauf die dritte Pruefung. Sie sah dadurch redundant aus, war es
    // aber nicht: hier kommt der aeltere Lauf am Kopf VORBEI (er ist zu diesem Zeitpunkt noch der
    // aktuelle) und haengt dann im Inhalt fest, waehrend ihn ein juengerer ueberholt.
    const p = oeffnen({ routes: { "/api/drafts": reply(201, { id: "d-1" }) } });
    const tor = torAuf("/api/categories");
    await p.flush();

    // (1) Lauf 1 betritt die Flaeche und bekommt seinen Antwortkopf — noch ist er der aktuelle Lauf,
    //     die Pruefung nach dem Abruf laesst ihn also durch. Jetzt steht er in `res.json()`.
    p.setTab("capture");
    await p.flush();
    expect(tor.gestellt.length, "Lauf 1 ist unterwegs").toBe(1);
    tor.beantworten(0, { art: "kopf", status: 200 });
    await p.flush();
    expect(p.text("#capture-bereich"), "ohne Inhalt gibt es noch keine Liste").toBe(
      p.t("captureBereichLaedt"),
    );

    // (2) Erst jetzt verlaesst der Mensch die Flaeche und kommt zurueck: Lauf 2 ueberholt und geht
    //     ganz durch. Er ist es, der die sichtbare Liste stellt — und die Wahl.
    neuBetreten(p);
    await p.flush();
    expect(tor.gestellt.length, "zwei ueberlappende Abrufe — der Fall ist hergestellt").toBe(2);
    tor.beantworten(1, { art: "antwort", status: 200, koerper: bereiche("Recht", "Steuer") });
    await p.flush();
    expect(p.text("#capture-bereich")).toBe(`${p.t("captureBereichWahl")}RechtSteuer`);
    waehlen(p, "Recht");

    // (3) Und JETZT erst gibt Lauf 1 seinen Inhalt heraus. Zwischen ihm und der Zeile steht nur noch
    //     die dritte Pruefung.
    tor.koerperGeben(0, bereiche("Technik"));
    await p.flush();
    expect(
      p.text("#capture-bereich"),
      "die Liste des ueberholten Laufs hat sich durchgesetzt",
    ).toBe(`${p.t("captureBereichWahl")}RechtSteuer`);
    expect(
      p.q("#capture-bereich")?.value,
      "der Inhalt des ueberholten Laufs hat die Wahl geleert",
    ).toBe("Recht");

    // (4) Und die Nutzlast traegt, was sichtbar dasteht — nicht, was zuletzt eintraf.
    p.sendSelection();
    await p.flush();
    await p.flush();
    expect(posts(p)[0]?.category, "der Name des ueberholten Laufs ist mitgereist").toBe("Recht");
  });

  it("N4 · die Nutzlast traegt den Namen des juengsten Laufs — und ohne sichtbare Wahl KEINEN vierten Parameter", async () => {
    const p = oeffnen({ routes: { "/api/drafts": reply(201, { id: "d-1" }) } });
    const tor = torAuf("/api/categories");
    await p.flush();

    p.setTab("capture");
    neuBetreten(p);
    await p.flush();
    tor.beantworten(1, { art: "antwort", status: 200, koerper: bereiche("Recht", "Steuer") });
    await p.flush();

    // (a) OHNE Wahl: die Nutzlast ist die von vorher — kein Feld, nicht `""`, nicht `null`.
    p.sendSelection();
    await p.flush();
    await p.flush();
    expect(Object.keys(posts(p)[0] ?? {})).not.toContain("category");

    // (b) MIT der Wahl aus dem juengeren Lauf, und danach meldet sich der aeltere.
    waehlen(p, "Recht");
    tor.beantworten(0, { art: "antwort", status: 200, koerper: bereiche("Technik") });
    await p.flush();
    p.sendSelection();
    await p.flush();
    await p.flush();
    const zweiter = posts(p)[1] ?? {};
    expect(zweiter.category, "der Name des ueberholten Laufs ist mitgereist").toBe("Recht");
    expect(zweiter.origin).toBe("word_addin");
  });
});
