// @vitest-environment jsdom
// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · BPA-06 Nacharbeit 41 — „MEINE ROUTINEN IN
// WORD“ IM WORD-FENSTER (Block KW-ROUTINEN in `vormachen.js`).
// ================================================================================================
//
// WAS HIER LÄUFT: die ausgelieferte Datei `apps/web/public/word-addin/vormachen.js`, unverändert, in
// jsdom mit den Globalen des Fensters. `bpaZielAus` (samt `bpaPruefsumme`, `bpaProgramm`) kommt
// wörtlich aus `taskpane.js`; nur der Leseweg der Markierung (`readAskSelection`) und
// `Office.context.diagnostics` sind gestellt — ein laufendes Word gibt es hier nicht. Die Abrufe gehen
// an den ECHTEN Server (`buildApp(buildServices())`) mit einer Anmeldesitzung.
//   F1 Binden und Ausführen per Klick: der Bericht entsteht mit der Markierung, Hinweis samt Link.
//   F2 Markierung zwischen Bindung und Wirkung geändert: nichts entsteht, der Grund steht da.
//   F3 Ohne Klara-Sitzung fragt der Block nichts und bleibt verborgen.
//   F4 Nacharbeit 43: mit der ausdrücklichen Freigabe beim Binden führt das gebundene Fenster den
//      fälligen Termin der Zeitsteuerung ohne Klick aus — genau einmal; ohne Freigabe nicht.
//   F5 Nacharbeit 43: die Dokumentroutine liest das ganze Dokument (`Word.run`, `body.text`).
//   F6 Nacharbeit 43: ist das Dokument nicht lesbar, läuft sie nicht (kein Ersatz durch Markierung).
//   F7 Nacharbeit 46: zwei freigegebene Routinen mit DEMSELBEN Wochentermin (gleiche Kennung
//      `zeitplan-w-<Datum>`) laufen beide ohne Klick, unabhängig und je genau einmal.
// Ein laufendes Word gibt es nicht: `Word.run` liefert nur `body.text` eines festen Textes.
import { readFileSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { baueDocx } from "../m5-docx-bildunterschriften/docx-bauen";
import { repoPfad } from "../support/repoPfad";

const QUELLE = readFileSync(repoPfad("apps/web/public/word-addin/vormachen.js"), "utf8");
const TASKPANE = readFileSync(repoPfad("apps/web/public/word-addin/lernziel.js"), "utf8");
/** `VORMACHEN_START_MS` in `vormachen.js`. */
const ERSTER_BLICK_MS = 2000;
const ADA = { name: "Ada Fiktiv", email: "ada@word-routinen.test", password: "ada-geheim-1" };
const MARKIERUNG = "Umsatz Region Nord stabil, zwei Neukunden.";
const TITEL = "Wochenbericht KW43";

let app: FastifyInstance | null = null;
/** Die Dienste des Prüfservers — F7 hinterlegt darüber einen vor acht Tagen gesetzten Zeitplan. */
let dienste: ReturnType<typeof buildServices>;
let cookie = "";
const abrufe: string[] = [];
let auswahlen: string[] = [];
let vorherigerFetch: typeof globalThis.fetch;

async function draht(
  methode: "GET" | "POST" | "PUT",
  url: string,
  payload?: Record<string, unknown>,
  kopf: Record<string, string> = {},
) {
  const r = await (app as FastifyInstance).inject({
    method: methode,
    url,
    headers: { cookie, ...kopf },
    ...(payload ? { payload } : {}),
  });
  return { status: r.statusCode, body: r.body === "" ? null : (r.json() as unknown) };
}

async function ruhe(runden = 60): Promise<void> {
  for (let i = 0; i < runden; i += 1) {
    await new Promise((r) => setImmediate(r));
  }
}

/** Die Zielfunktionen des Fensters, wörtlich aus `taskpane.js` (von bpaPruefsumme bis bpaZielAus). */
function zielfunktionenDesFensters(): Record<string, unknown> {
  const start = TASKPANE.indexOf("function bpaPruefsumme(text) {");
  const ende = TASKPANE.indexOf("// ENDE LERNZIEL");
  expect(start).toBeGreaterThan(0);
  expect(ende).toBeGreaterThan(start);
  const rueckgabe = "return { bpaZielAus: bpaZielAus, bpaPruefsumme: bpaPruefsumme };";
  return new Function(`${TASKPANE.slice(start, ende)}; ${rueckgabe}`)();
}

/** Nacharbeit 43: zwei Abschnitte; Word liefert `body.text` mit `\r` zwischen den Absätzen. */
const ABSCHNITT_A = "Abschnitt A: Umsatz Region Nord stabil.";
const ABSCHNITT_B = "Abschnitt B: Lieferzeiten Region Süd verbessert.";
let dokumentText = `${ABSCHNITT_A}\r${ABSCHNITT_B}`;

/** Gestellter Word-Host: nur das, was der Block für das ganze Dokument liest (`body.text`). */
const WORD_HOST = {
  run: (arbeit: (kontext: unknown) => Promise<unknown>) => {
    const koerper = { text: "", load: () => undefined };
    const kontext = {
      document: { body: koerper },
      sync: async () => {
        koerper.text = dokumentText;
      },
    };
    return arbeit(kontext);
  },
};

/** P06 in Word: markierten Text übernehmen, Vorschau bestätigen — die Routine der Person. */
async function wordRoutine(): Promise<string> {
  const start = await draht("POST", "/api/me/vormachen", {
    host: "word",
    vorgaenge: ["word_auswahl_uebernehmen"],
    zweck: "Wochenbericht aus der Markierung",
  });
  expect(start.status).toBe(201);
  const sitzung = (start.body as { sitzung: { id: string } }).sitzung.id;
  await draht("GET", "/api/me/vormachen?anzeige=word");
  const demo = { title: "Wochenbericht KW41", statement: "Umsatz stabil", origin: "word_addin" };
  expect((await draht("POST", "/api/drafts", demo)).status).toBe(201);
  const v = await draht("GET", `/api/me/vormachen/${sitzung}/vorschau`);
  const stand = (v.body as { vorschau: { stand: string } }).vorschau.stand;
  const b = await draht("POST", `/api/me/vormachen/${sitzung}/bestaetigung`, { stand });
  expect(b.status).toBe(201);
  return (b.body as { routine: { id: string } }).routine.id;
}

/** P06 in Word: das ganze Dokument übernehmen (Ganzdokumentweg aus dem Word-Fenster), bestätigen. */
async function wordDokumentRoutine(): Promise<string> {
  const start = await draht("POST", "/api/me/vormachen", {
    host: "word",
    vorgaenge: ["word_dokument_uebernehmen"],
    zweck: "Wochenbericht aus dem ganzen Dokument",
  });
  expect(start.status).toBe(201);
  const sitzung = (start.body as { sitzung: { id: string } }).sitzung.id;
  await draht("GET", "/api/me/vormachen?anzeige=word");
  const { bytes } = await baueDocx([{ art: "text", text: "Wochenbericht KW41" }]);
  const docx = { name: "wochenbericht.docx", data: bytes.toString("base64") };
  const herkunft = { referer: "http://localhost/word-addin/taskpane.html" };
  expect((await draht("POST", "/api/drafts/from-docx", docx, herkunft)).status).toBe(201);
  const v = await draht("GET", `/api/me/vormachen/${sitzung}/vorschau`);
  const stand = (v.body as { vorschau: { stand: string } }).vorschau.stand;
  const b = await draht("POST", `/api/me/vormachen/${sitzung}/bestaetigung`, { stand });
  expect(b.status).toBe(201);
  return (b.body as { routine: { id: string } }).routine.id;
}

async function fensterStarten(mitSitzung = true): Promise<void> {
  Object.assign(globalThis, {
    lang: "de",
    signedIn: true,
    klaraS4SessionId: mitSitzung ? "klara-sitzung-1" : null,
    klaraS4DocumentId: "dokument-1",
    Office: { context: { diagnostics: { platform: "Mac", version: "16.0.17126" } } },
    readAskSelection: (fertig: (t: string) => void) => {
      fertig(auswahlen.length > 1 ? (auswahlen.shift() as string) : (auswahlen[0] ?? ""));
    },
    Word: WORD_HOST,
  });
  Object.assign(globalThis, zielfunktionenDesFensters());
  new Function(QUELLE)();
  await ruhe();
  vi.advanceTimersByTime(ERSTER_BLICK_MS);
  await ruhe();
}

const block = (): HTMLElement | null => document.getElementById("kw-routinen");
function knopf(text: string): HTMLButtonElement {
  const k = [...(block()?.querySelectorAll("button") ?? [])].find((b) => b.textContent === text);
  if (!k) {
    throw new Error(`Knopf „${text}“ fehlt: ${block()?.textContent ?? ""}`);
  }
  return k;
}

type Entwurf = { id: string; payload: { title?: string; statement?: string } };

async function entwuerfe(): Promise<Entwurf[]> {
  const r = await draht("GET", "/api/drafts");
  return r.body as Entwurf[];
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  document.body.innerHTML = "";
  abrufe.length = 0;
  auswahlen = [MARKIERUNG];
  dokumentText = `${ABSCHNITT_A}\r${ABSCHNITT_B}`;
  Reflect.deleteProperty(globalThis, "askMitlesen");
  const services = buildServices();
  dienste = services;
  services.aiCheckWorker = {
    enqueue: () => undefined,
    has: () => false,
    laeuft: () => false,
    queuedCount: () => 0,
    idle: async () => undefined,
  };
  app = buildApp(services);
  await app.ready();
  const registriert = await app.inject({ method: "POST", url: "/api/auth/register", payload: ADA });
  expect(registriert.statusCode).toBe(201);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADA.email, password: ADA.password },
  });
  cookie = `kw_session=${(login.json() as { token: string }).token}`;
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    abrufe.push(`${methode} ${url}`);
    const kopf: Record<string, string> = { cookie };
    new Headers(init?.headers).forEach((wert, name) => {
      kopf[name] = wert;
    });
    const antwort = await (app as FastifyInstance).inject({
      method: methode as "GET",
      url,
      headers: kopf,
      ...(init?.body !== undefined && init.body !== null ? { payload: String(init.body) } : {}),
    });
    return {
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      status: antwort.statusCode,
      json: async () => antwort.json(),
    };
  }) as unknown as typeof globalThis.fetch;
});

afterEach(async () => {
  globalThis.fetch = vorherigerFetch;
  vi.useRealTimers();
  await app?.close();
  app = null;
});

describe("BPA-06 Nacharbeit 41 · Meine Routinen im Word-Fenster", () => {
  it("F1 · binden und mit der Markierung ausführen: Bericht entsteht, Hinweis mit Link", async () => {
    const id = await wordRoutine();
    await fensterStarten();
    expect(abrufe).toContain("GET /api/me/vormachen/word-routinen");
    expect(block()?.style.display).toBe("block");
    expect(block()?.textContent).toContain("Noch an kein Word gebunden.");

    knopf("An dieses Word binden").click();
    await ruhe();
    expect(abrufe).toContain(`PUT /api/me/vormachen/routinen/${id}/host`);
    expect(block()?.textContent).toContain("Gebunden an Mac 16.0.17126.");

    const feld = block()?.querySelector<HTMLInputElement>('input[data-feld="titel"]');
    if (!feld) {
      throw new Error("Titelfeld fehlt");
    }
    feld.value = TITEL;
    knopf("Mit Markierung ausführen").click();
    await ruhe(120);
    expect(abrufe).toContain(`POST /api/me/vormachen/routinen/${id}/word-lauf`);
    const meldung = block()?.querySelector(`[data-meldung="${id}"]`);
    expect(meldung?.textContent).toContain("Bericht angelegt und geprüft.");
    const [bericht] = (await entwuerfe()).filter((d) => d.payload.title === TITEL);
    expect(bericht?.payload.statement).toBe(MARKIERUNG);
    expect(meldung?.querySelector("a")?.getAttribute("href")).toBe(
      `/erfassen?draft=${bericht?.id ?? ""}`,
    );
  });

  it("F2 · Markierung zwischen Bindung und Wirkung geändert: nichts entsteht, Grund steht da", async () => {
    const id = await wordRoutine();
    await fensterStarten();
    knopf("An dieses Word binden").click();
    await ruhe();
    const feld = block()?.querySelector<HTMLInputElement>('input[data-feld="titel"]');
    if (!feld) {
      throw new Error("Titelfeld fehlt");
    }
    feld.value = TITEL;
    // Erstes Lesen (Bindung) liefert die Markierung, das Lesen direkt vor der Wirkung eine andere.
    auswahlen = [MARKIERUNG, "Inzwischen anders markiert."];
    knopf("Mit Markierung ausführen").click();
    await ruhe(120);
    const meldung = block()?.querySelector(`[data-meldung="${id}"]`);
    expect(meldung?.textContent).toContain("Die Markierung ist nicht mehr dieselbe.");
    expect((await entwuerfe()).filter((d) => d.payload.title === TITEL)).toHaveLength(0);
  });

  it("F3 · ohne Klara-Sitzung fragt der Block nichts und bleibt verborgen", async () => {
    await wordRoutine();
    await fensterStarten(false);
    expect(abrufe).not.toContain("GET /api/me/vormachen/word-routinen");
    expect(block()?.style.display).toBe("none");
  });

  it("F4 · Nacharbeit 43: mit Freigabe holt das gebundene Fenster den fälligen Termin OHNE Klick ab", async () => {
    const id = await wordRoutine();
    const plan = await draht("PUT", `/api/me/vormachen/routinen/${id}/zeitplan`, {
      zeitplan: { art: "sofort" },
      eingaben: { titel: TITEL },
    });
    expect(plan.status).toBe(200);
    await fensterStarten();
    // Noch nicht gebunden und ohne Freigabe: der Termin wartet, das Fenster startet nichts.
    vi.advanceTimersByTime(60_000);
    await ruhe(60);
    expect(abrufe).not.toContain(`POST /api/me/vormachen/routinen/${id}/word-lauf`);

    // Die Person bindet mit der ausdrücklichen Freigabe — danach KEIN Klick auf den Termin.
    const freigabe = block()?.querySelector<HTMLInputElement>(
      'input[data-feld="zeitplan-im-host"]',
    );
    if (!freigabe) {
      throw new Error("Freigabe fehlt");
    }
    freigabe.checked = true;
    knopf("An dieses Word binden").click();
    await ruhe(200);
    expect(abrufe).toContain(`POST /api/me/vormachen/routinen/${id}/word-lauf`);
    const berichte = (await entwuerfe()).filter((d) => d.payload.title === TITEL);
    expect(berichte).toHaveLength(1);
    expect(berichte[0]?.payload.statement).toBe(MARKIERUNG);
    // Der nächste Abruf (60 s) läuft nicht noch einmal: der Termin ist erledigt.
    vi.advanceTimersByTime(60_000);
    await ruhe(120);
    expect((await entwuerfe()).filter((d) => d.payload.title === TITEL)).toHaveLength(1);
  });

  it("F7 · Nacharbeit 46: zwei Routinen mit demselben Wochentermin laufen beide ohne Klick, je einmal", async () => {
    // Nacharbeit 47: ohne gestellte Uhr. Der Wochentermin liegt eine Minute vor jetzt; fällig wird
    // er, sobald der Zeitplan (wie nach einer Woche Vorlauf) als vor acht Tagen gesetzt in der
    // Routinenablage steht — für BEIDE Routinen mit derselben Kennung `zeitplan-w-<Datum>`.
    const termin = Math.floor((Date.now() - 60_000) / 60_000) * 60_000;
    const wochentag = ((new Date(termin).getUTCDay() + 6) % 7) + 1;
    const uhrzeit = new Date(termin).toISOString().slice(11, 16);
    const zeitplan = { art: "woechentlich", wochentag, uhrzeit, zeitzone: "UTC" };
    const woechentlich = { ...zeitplan, nachholen: "einmal_nachholen" };

    const eins = await wordRoutine();
    const zwei = await wordRoutine();
    const titel: Record<string, string> = { [eins]: "Bericht Eins", [zwei]: "Bericht Zwei" };
    for (const id of [eins, zwei]) {
      const plan = await draht("PUT", `/api/me/vormachen/routinen/${id}/zeitplan`, {
        zeitplan: woechentlich,
        eingaben: { titel: titel[id] ?? "" },
      });
      expect(plan.status).toBe(200);
    }
    await fensterStarten();
    // Beide ausdrücklich mit Freigabe an dieses Word binden — vor dem Termin läuft nichts.
    for (const id of [eins, zwei]) {
      const eintrag = block()?.querySelector(`[data-routine="${id}"]`);
      const freigabe = eintrag?.querySelector<HTMLInputElement>(
        'input[data-feld="zeitplan-im-host"]',
      );
      const binden = [...(eintrag?.querySelectorAll("button") ?? [])].find(
        (b) => b.textContent === "An dieses Word binden",
      );
      if (!freigabe || !binden) {
        throw new Error(`Bindung für ${id} fehlt`);
      }
      freigabe.checked = true;
      binden.click();
      await ruhe(120);
    }
    // Gesetzt „jetzt“: der Termin eine Minute zuvor gilt nicht als versäumt — es läuft nichts.
    expect(abrufe.filter((a) => a.endsWith("/word-lauf"))).toEqual([]);
    type Eintrag = { id: string; anstehend: string | null; uebergabe: string | null };
    const sicht = async () => {
      const liste = await draht("GET", "/api/me/vormachen/word-routinen");
      return (liste.body as { routinen: Eintrag[] }).routinen;
    };
    expect((await sicht()).map((r) => r.anstehend)).toEqual([null, null]);

    // Der Zeitplan steht seit acht Tagen: der jüngste Wochentermin ist für BEIDE fällig.
    const seit = new Date(Date.now() - 8 * 24 * 60 * 60_000).toISOString();
    const ablage = dienste.vormachenRoutinen;
    for (const r of await ablage.mitZeitplan()) {
      const zl = r.zeitplanLauf;
      if (zl) {
        await ablage.lege({ ...r, zeitplanLauf: { ...zl, seit } });
      }
    }
    const faellig = await sicht();
    const kennung = `zeitplan-w-${new Date(termin).toISOString().slice(0, 10)}`;
    expect(faellig.map((r) => [r.anstehend, r.uebergabe])).toEqual([
      [kennung, "automatisch"],
      [kennung, "automatisch"],
    ]);

    // Der nächste Abruf des Fensters holt beide ab — nacheinander, ohne Klick.
    vi.advanceTimersByTime(60_000);
    await ruhe(800);
    expect(abrufe).toContain(`POST /api/me/vormachen/routinen/${eins}/word-lauf`);
    expect(abrufe).toContain(`POST /api/me/vormachen/routinen/${zwei}/word-lauf`);
    expect((await sicht()).map((r) => r.anstehend)).toEqual([null, null]);
    const berichte = async (t: string) =>
      (await entwuerfe()).filter((d) => d.payload.title === t).length;
    expect(await berichte("Bericht Eins")).toBe(1);
    expect(await berichte("Bericht Zwei")).toBe(1);

    // Weitere Abrufe starten nichts erneut — je Routine genau ein Bericht.
    vi.advanceTimersByTime(120_000);
    await ruhe(200);
    expect(await berichte("Bericht Eins")).toBe(1);
    expect(await berichte("Bericht Zwei")).toBe(1);
  });

  it("F5 · Nacharbeit 43: Dokumentroutine liest das GANZE Dokument, nicht die Markierung", async () => {
    const id = await wordDokumentRoutine();
    auswahlen = [ABSCHNITT_A];
    await fensterStarten();
    knopf("An dieses Word binden").click();
    await ruhe();
    const feld = block()?.querySelector<HTMLInputElement>('input[data-feld="titel"]');
    if (!feld) {
      throw new Error("Titelfeld fehlt");
    }
    feld.value = TITEL;
    knopf("Mit dem ganzen Dokument ausführen").click();
    await ruhe(120);
    const meldung = block()?.querySelector(`[data-meldung="${id}"]`);
    expect(meldung?.textContent).toContain("Bericht angelegt und geprüft.");
    const [bericht] = (await entwuerfe()).filter((d) => d.payload.title === TITEL);
    expect(bericht?.payload.statement).toContain(ABSCHNITT_A);
    expect(bericht?.payload.statement).toContain(ABSCHNITT_B);
  });

  it("F6 · Nacharbeit 43: ist das Dokument nicht lesbar, läuft die Dokumentroutine nicht", async () => {
    const id = await wordDokumentRoutine();
    await fensterStarten();
    knopf("An dieses Word binden").click();
    await ruhe();
    // „Mitlesen“ aus: das Dokument wird nicht gelesen — die Markierung ersetzt es nicht.
    Object.assign(globalThis, { askMitlesen: false });
    const feld = block()?.querySelector<HTMLInputElement>('input[data-feld="titel"]');
    if (!feld) {
      throw new Error("Titelfeld fehlt");
    }
    feld.value = TITEL;
    knopf("Mit dem ganzen Dokument ausführen").click();
    await ruhe(120);
    const meldung = block()?.querySelector(`[data-meldung="${id}"]`);
    expect(meldung?.textContent).toContain("Das ganze Dokument ist nicht lesbar");
    expect(abrufe).not.toContain(`POST /api/me/vormachen/routinen/${id}/word-lauf`);
    expect((await entwuerfe()).filter((d) => d.payload.title === TITEL)).toHaveLength(0);
  });
});
