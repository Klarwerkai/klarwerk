// ================================================================================================
// produkt:20261011:assistenz-browser-aktionen (BPA-03) — BERECHTIGTE BROWSERAKTIONEN IN CHROMIUM.
// ================================================================================================
//
// WAS HIER LÄUFT: der ausgelieferte Seitenausführer `extensions/klara-browser/aktion.js` in einer
// echten Chromium-Seite, gesteuert vom Vertrag `services/app/src/klara-browser-aktion.ts`. Die
// Seite ist die kontrollierte synthetische Testseite (`testseite.ts`); sie zählt selbst, was
// wirklich geschah. Jede Zusicherung liest diese Zähler bzw. die Feldwerte der Seite — nicht
// Klaras eigene Meldung.
//
// WAS HIER NICHT LÄUFT, ausdrücklich: die installierte Chrome-Erweiterung mit Worker und
// `chrome.scripting` (der Seitenausführer wird per `page.evaluate` in die Hauptwelt geladen, nicht
// in Chromes isolierte Welt), eine echte Website, eine echte Anmeldung, eine echte Spracheingabe
// (der Sprachauftrag ist ein Transkript mit Quelle `gesprochen`, wie im vorhandenen Aktionskern)
// und eine echte Außenwirkung. Das sind die offenen Host-/Produktivbelege dieses Auftrags.
//
// Startet Playwright selbst (eine eigene Startstelle, `tor-bestand-vollstaendig` B4 lässt neue
// passende Browserproben zu): EIN Browser, je Fall ein frischer Kontext, kein `apps/web/dist`.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type BrowserAnsicht,
  type BrowserAuftrag,
  type BrowserAuftragEingabe,
  BrowserAusfuehrung,
  type BrowserEntwurfsliste,
  BrowserFaehigkeitsregister,
  type BrowserSchrittArt,
  type BrowserSeitenadapter,
  type SeitenAntwort,
  type SeitenFehler,
  type SeitenLage,
  neuerBrowserAuftrag,
} from "../../services/app/src/klara-browser-aktion";
import {
  ANGREIFER,
  BETREFF,
  EMPFAENGER,
  INJEKTION,
  LECKZEICHEN,
  NACHRICHT,
  ORIGIN,
  PFAD,
  TESTSEITE,
  eingabe,
  seitenHtml,
} from "./testseite";

type BrowserFn = (arg: unknown) => unknown;
const fn = (quelle: string): BrowserFn =>
  new Function("arg", `return (${quelle})(arg);`) as BrowserFn;

interface Route {
  request(): { url(): string };
  fulfill(o: { status: number; contentType: string; body: string }): Promise<void>;
}
interface Seite {
  goto(url: string): Promise<unknown>;
  evaluate<T>(f: BrowserFn | string, arg?: unknown): Promise<T>;
  bringToFront(): Promise<void>;
  isClosed(): boolean;
}
interface Kontext {
  newPage(): Promise<Seite>;
  route(muster: string, behandle: (route: Route) => Promise<void>): Promise<void>;
  close(): Promise<void>;
}
interface Browser {
  newContext(o?: Record<string, unknown>): Promise<Kontext>;
  version(): string;
  close(): Promise<void>;
}

const AKTION = readFileSync(resolve("extensions/klara-browser/aktion.js"), "utf8");
const AKTION_SHA = createHash("sha256").update(AKTION).digest("hex");
const REGISTER = new BrowserFaehigkeitsregister([TESTSEITE]);

interface SeitenEntwurfVoll {
  id: string;
  formular: string;
  betreff: string;
  empfaenger: string;
  nachricht: string;
}

interface SeitenZustand {
  entwuerfe: SeitenEntwurfVoll[];
  speicherungen: number;
  versand: number;
  bestellungen: number;
  loeschungen: number;
}

/** Die Brücke wie der Worker sie bauen wird: je Aufruf Seitenausführer laden, dann rufen. */
class ChromiumSeitenadapter implements BrowserSeitenadapter {
  readonly fassung = `aktion.js@1.0.0 sha256:${AKTION_SHA.slice(0, 12)}`;
  readonly tabs = new Map<number, Seite>();
  readonly aufrufe: string[] = [];
  /** Eine eingespeiste Störung des nächsten Klicks: Antwort fehlt VOR bzw. NACH der Wirkung. */
  stoerung: { wann: "vor" | "nach"; grund: SeitenFehler } | null = null;

  private async rufe<T>(tabId: number, methode: string, arg: unknown): Promise<T | null> {
    const s = this.tabs.get(tabId);
    if (!s || s.isClosed()) {
      return null;
    }
    await s.evaluate(AKTION);
    return s.evaluate<T>(fn(`(a) => globalThis.KlaraBrowserAktion.${methode}(a)`), arg);
  }

  async lage(
    tabId: number,
    formular: string,
    liste: BrowserEntwurfsliste | null,
  ): Promise<SeitenLage | null> {
    this.aufrufe.push("lage");
    const roh = await this.rufe<Omit<SeitenLage, "tabId">>(tabId, "lage", { formular, liste });
    return roh ? { tabId, ...roh } : null;
  }

  async fuelle(
    tabId: number,
    a: { formular: string; fingerabdruck: string; label: string; wert: string },
  ): Promise<SeitenAntwort<{ wert: string }>> {
    this.aufrufe.push("fuelle");
    const antwort = await this.rufe<SeitenAntwort<{ wert: string }>>(tabId, "fuelle", a);
    return antwort ?? { ok: false, grund: "verbindung" };
  }

  async klicke(
    tabId: number,
    a: { formular: string; fingerabdruck: string; knopf: string },
  ): Promise<SeitenAntwort<null>> {
    this.aufrufe.push(`klicke:${a.knopf}`);
    const st = this.stoerung;
    this.stoerung = null;
    if (st?.wann === "vor") {
      return { ok: false, grund: st.grund };
    }
    const antwort = await this.rufe<SeitenAntwort<null>>(tabId, "klicke", a);
    if (st?.wann === "nach") {
      return { ok: false, grund: st.grund };
    }
    return antwort ?? { ok: false, grund: "verbindung" };
  }

  async loesche(
    tabId: number,
    a: { liste: BrowserEntwurfsliste; id: string; knopf: string },
  ): Promise<SeitenAntwort<null>> {
    this.aufrufe.push("loesche");
    const antwort = await this.rufe<SeitenAntwort<null>>(tabId, "loesche", a);
    return antwort ?? { ok: false, grund: "verbindung" };
  }

  zaehle(praefix: string): number {
    return this.aufrufe.filter((x) => x.startsWith(praefix)).length;
  }
}

let browser: Browser | undefined;
let kontext: Kontext | undefined;
let adapter: ChromiumSeitenadapter;
let aufbau: string | null = null;
let hostVersion = "unbekannt";

beforeAll(async () => {
  try {
    const require = createRequire(import.meta.url);
    const { chromium } = require("playwright") as {
      chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
    };
    // Wie `tests/gast-nutzerweg/browserweg.ts`: mehrere Kontexte und Tabs, daher ohne
    // `--single-process`.
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    hostVersion = browser.version();
    console.info(
      `BPA-03 · Chromium ${hostVersion} · ${new ChromiumSeitenadapter().fassung} · ` +
        `Zeitzone ${Intl.DateTimeFormat().resolvedOptions().timeZone} · ${new Date().toISOString()} · ` +
        `Seite ${ORIGIN}${PFAD} (synthetisch) · Profil ${TESTSEITE.id}@${TESTSEITE.fassung}`,
    );
  } catch (e) {
    aufbau = String(e).split("\n").slice(0, 3).join(" | ");
  }
}, 120_000);

afterAll(async () => {
  await browser?.close();
}, 60_000);

beforeEach(async () => {
  expect(aufbau, "Chromium-Aufbau").toBeNull();
  kontext = await (browser as Browser).newContext({ locale: "de-DE" });
  await kontext.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    const variante = url.searchParams.get("variante");
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: seitenHtml(variante === "captcha" || variante === "mfa" ? variante : "standard"),
    });
  });
  adapter = new ChromiumSeitenadapter();
});

afterEach(async () => {
  await kontext?.close();
});

async function oeffne(tabId: number, pfad = PFAD): Promise<Seite> {
  const s = await (kontext as Kontext).newPage();
  await s.goto(`${ORIGIN}${pfad}`);
  adapter.tabs.set(tabId, s);
  return s;
}

function auftrag(teil: Partial<BrowserAuftragEingabe> = {}): BrowserAuftrag {
  const host = { browser: "Chromium (Playwright, headless)", version: hostVersion };
  const anlage = neuerBrowserAuftrag(REGISTER, eingabe({ host, ...teil }));
  if (!anlage.ok) {
    throw new Error(`Auftrag abgewiesen: ${JSON.stringify(anlage)}`);
  }
  return anlage.auftrag;
}

type Rechte = (a: BrowserAuftrag, art: BrowserSchrittArt) => Promise<boolean>;

function lauf(a: BrowserAuftrag, rechte: Rechte = async () => true): BrowserAusfuehrung {
  return new BrowserAusfuehrung(a, {
    adapter,
    register: REGISTER,
    rechte,
    warte: async () => {},
    nachleseVersuche: 2,
  });
}

function zustand(s: Seite): Promise<SeitenZustand> {
  return s.evaluate<SeitenZustand>(fn("() => JSON.parse(JSON.stringify(window.__bpa03))"));
}

function werte(s: Seite, formular: string): Promise<Record<string, string>> {
  return s.evaluate<Record<string, string>>(
    fn(
      "(id) => Object.fromEntries(Array.from(document.getElementById(id).querySelectorAll('input, textarea')).map((el) => [el.id, el.value]))",
    ),
    formular,
  );
}

function aendere(s: Seite, quelle: string): Promise<unknown> {
  return s.evaluate(fn(`() => { ${quelle} }`));
}

const eigene = (z: SeitenZustand) => z.entwuerfe.filter((e) => !e.id.startsWith("E-alt"));
const imTab = (tabId: number, origin = ORIGIN) => ({
  tabId,
  origin,
  pfad: PFAD,
  formular: "Angebotsentwurf",
});
const benenneUm = (feld: string, neu: string) =>
  `document.querySelector('label[for="${feld}"]').textContent = '${neu}';`;
const lies = (s: Seite, ausdruck: string) => s.evaluate<string>(fn(`() => ${ausdruck}`));
const staende = (a: BrowserAnsicht) => a.schritte.map((s) => `${s.art}:${s.stand}`);
/** Setzt ein sichtbares beschriftetes Feld an den Anfang des Angebotsformulars. */
const neuesFeld = (id: string, beschriftung: string) =>
  `const p = document.createElement('p'); p.innerHTML = '<label for="${id}">${beschriftung}</label> <input id="${id}">'; document.getElementById('angebot').prepend(p);`;

describe("BPA-03 · berechtigte Browseraktionen auf der synthetischen Seite (Chromium)", () => {
  it("K1 · AC01 · Text- und Sprachauftrag füllen auf derselben Seite je das beauftragte Formular und lesen den Zielzustand nach", async () => {
    const s = await oeffne(1);
    const text = await lauf(auftrag()).ausfuehren();
    expect(text.quelle).toBe("getippt");
    expect(text.stand).toBe("fertig");
    expect(text.erfolg).toBe(true);
    const z1 = await zustand(s);
    expect(eigene(z1)).toEqual([
      {
        id: text.ergebnis?.entwurfId,
        formular: "Angebotsentwurf",
        betreff: BETREFF,
        empfaenger: EMPFAENGER,
        nachricht: NACHRICHT,
      },
    ]);
    expect(text.schritte.find((x) => x.art === "nachlesen")?.beleg).toBe(
      `Entwurf ${text.ergebnis?.entwurfId}`,
    );
    // Das ähnliche Formular „Rückmeldung" (auch mit „Betreff") blieb unberührt.
    expect(await werte(s, "rueckmeldung")).toEqual({ "r-betreff": "", "r-nachricht": "" });

    const sprache = await lauf(
      auftrag({
        quelle: "gesprochen",
        wortlaut:
          "Klara, trag in die Rückmeldung als Betreff Rückruf Montag ein und speichere sie.",
        ziel: { tabId: 1, origin: ORIGIN, pfad: PFAD, formular: "Rückmeldung" },
        felder: [
          { label: "Betreff", wert: "Rückruf Montag" },
          { label: "Nachricht", wert: "Bitte am Montag zurückrufen." },
        ],
      }),
    ).ausfuehren();
    expect(sprache.quelle).toBe("gesprochen");
    expect(sprache.erfolg).toBe(true);
    const z2 = await zustand(s);
    expect(z2.entwuerfe.find((e) => e.id === sprache.ergebnis?.entwurfId)).toMatchObject({
      formular: "Rückmeldung",
      betreff: "Rückruf Montag",
    });
    expect(await werte(s, "angebot")).toEqual({
      "a-betreff": BETREFF,
      "a-empfaenger": EMPFAENGER,
      "a-nachricht": NACHRICHT,
    });
    expect([z2.speicherungen, z2.versand, z2.bestellungen]).toEqual([2, 0, 0]);
    expect(text.host).toEqual({
      browser: "Chromium (Playwright, headless)",
      version: hostVersion,
      adapter: adapter.fassung,
    });
  });

  it('K2 · AC02 · zweites „Betreff" im Formular vor dem Speichern: gezielte Klärung, nichts gespeichert, kein Schreiben ins ähnliche Feld', async () => {
    const s = await oeffne(1);
    const l = lauf(auftrag(), async (_a, art) => {
      if (art === "speichern") {
        await aendere(s, neuesFeld("a-zwei", "Betreff"));
      }
      return true;
    });
    const a = await l.ausfuehren();
    expect(a.stand).toBe("klaerung");
    expect(a.erfolg).toBe(false);
    expect(a.klaerung).toContain('„Betreff" 2-mal');
    const w = await werte(s, "angebot");
    expect(w["a-zwei"]).toBe("");
    expect(w["a-betreff"]).toBe(BETREFF);
    expect(await werte(s, "rueckmeldung")).toEqual({ "r-betreff": "", "r-nachricht": "" });
    expect((await zustand(s)).speicherungen).toBe(0);
    expect(staende(a)).toContain("speichern:offen");
  });

  it("K2 · AC02 · harmlos umgebautes Formular: Ziel aktualisiert, genau eine Speicherung, neues Feld leer", async () => {
    const s = await oeffne(1);
    const l = lauf(auftrag(), async (_a, art) => {
      if (art === "speichern") {
        await aendere(s, neuesFeld("a-notiz", "Interne Notiz"));
      }
      return true;
    });
    const a = await l.ausfuehren();
    expect(a.erfolg).toBe(true);
    expect(a.verlauf.map((v) => v.ereignis)).toContain("ziel_aktualisiert");
    expect((await werte(s, "angebot"))["a-notiz"]).toBe("");
    expect((await zustand(s)).speicherungen).toBe(1);
  });

  it("K2 · AC02 · umbenannte Beschriftung vor dem Eintragen: Klärung statt Schreiben in das umbenannte oder ein ähnliches Feld", async () => {
    const s = await oeffne(1);
    let n = 0;
    const l = lauf(auftrag(), async (_a, art) => {
      if (art === "fuellen" && n++ === 0) {
        await aendere(s, benenneUm("a-betreff", "Titel"));
      }
      return true;
    });
    const a = await l.ausfuehren();
    expect(a.stand).toBe("klaerung");
    expect(a.klaerung).toContain('„Betreff" gibt es im geänderten Formular nicht mehr');
    expect(await werte(s, "angebot")).toEqual({
      "a-betreff": "",
      "a-empfaenger": "",
      "a-nachricht": "",
    });
    expect(await werte(s, "rueckmeldung")).toEqual({ "r-betreff": "", "r-nachricht": "" });
  });

  it("K2 · AC02 · Fokuswechsel auf einen ähnlichen Tab schreibt nur in den Tab des Auftrags; Navigation weg führt zur Klärung", async () => {
    const s1 = await oeffne(1);
    const s2 = await oeffne(2);
    await s2.bringToFront();
    const a = await lauf(auftrag()).ausfuehren();
    expect(a.erfolg).toBe(true);
    expect((await werte(s1, "angebot"))["a-betreff"]).toBe(BETREFF);
    expect((await werte(s2, "angebot"))["a-betreff"]).toBe("");
    expect((await zustand(s2)).speicherungen).toBe(0);

    // Im Tab des Auftrags wird auf eine andere Seite mit gleich aussehendem Formular navigiert.
    let n = 0;
    const wegLauf = lauf(auftrag({ ziel: imTab(2) }), async (_a, art) => {
      if (art === "fuellen" && n++ === 0) {
        await s2.goto(`${ORIGIN}/andere`);
      }
      return true;
    });
    const weg = await wegLauf.ausfuehren();
    expect(weg.stand).toBe("klaerung");
    expect(weg.klaerung).toContain("nicht mehr");
    expect((await werte(s2, "angebot"))["a-betreff"]).toBe("");
    expect((await zustand(s2)).speicherungen).toBe(0);
  });

  it("K3 · AC03 · ein Entwurfsauftrag liest, füllt und speichert — und klickt nie einen Auslöseknopf", async () => {
    const s = await oeffne(1);
    const a = await lauf(auftrag()).ausfuehren();
    expect(a.erfolg).toBe(true);
    expect(staende(a)).toEqual([
      "lesen:erfolgt",
      "fuellen:erfolgt",
      "fuellen:erfolgt",
      "fuellen:erfolgt",
      "speichern:erfolgt",
      "nachlesen:erfolgt",
    ]);
    expect(adapter.aufrufe.filter((x) => x.startsWith("klicke:"))).toEqual([
      "klicke:Entwurf speichern",
    ]);
    const z = await zustand(s);
    expect([z.versand, z.bestellungen]).toEqual([0, 0]);
  });

  it("K4 · AC04 · Entwurfserlaubnis sendet und bestellt nicht; ein Sendeauftrag wirkt erst mit seiner gebundenen Bestätigung, genau einmal", async () => {
    const s = await oeffne(1);
    const entwurf = lauf(auftrag());
    await entwurf.ausfuehren();
    for (const knopf of ["Endgültig senden", "Bestellung auslösen"]) {
      expect((await entwurf.loeseAus(knopf)).uebergabe?.grund).toBe("gesperrte_handlung");
    }
    expect([(await zustand(s)).versand, (await zustand(s)).bestellungen]).toEqual([0, 0]);

    const a = auftrag({ speichern: false, ausloesen: "Endgültig senden" });
    const senden = lauf(a);
    expect((await senden.ausfuehren()).stand).toBe("bestaetigung_noetig");
    expect((await zustand(s)).versand).toBe(0);
    const bedarf = senden.bestaetigungsBedarf();
    const bestaetigung = {
      auftragId: a.id,
      knopf: "Endgültig senden",
      fingerabdruck: bedarf?.fingerabdruck ?? "",
      nutzer: a.nutzer,
      bestaetigtAm: new Date().toISOString(),
    };
    expect(senden.bestaetige({ ...bestaetigung, fingerabdruck: "f".repeat(64) })).toBe(false);
    expect((await senden.fortsetzen()).stand).toBe("bestaetigung_noetig");
    expect((await zustand(s)).versand).toBe(0);
    expect(senden.bestaetige(bestaetigung)).toBe(true);
    const fertig = await senden.fortsetzen();
    expect(fertig.erfolg).toBe(true);
    expect(fertig.bestaetigung?.bestaetigtAm).toBe(bestaetigung.bestaetigtAm);
    await senden.ausfuehren();
    const z = await zustand(s);
    expect([z.versand, z.bestellungen]).toEqual([1, 0]);
  });

  it("K4 · AC04 · eine Bestätigung gilt nur für den bestätigten Aufbau: nach Umbau wird erneut gefragt, nichts gesendet", async () => {
    const s = await oeffne(1);
    const a = auftrag({ speichern: false, ausloesen: "Endgültig senden" });
    const senden = lauf(a);
    await senden.ausfuehren();
    const bedarf = senden.bestaetigungsBedarf();
    expect(
      senden.bestaetige({
        auftragId: a.id,
        knopf: "Endgültig senden",
        fingerabdruck: bedarf?.fingerabdruck ?? "",
        nutzer: a.nutzer,
        bestaetigtAm: new Date().toISOString(),
      }),
    ).toBe(true);
    await aendere(s, neuesFeld("a-kopie", "Kopie an"));
    const nach = await senden.fortsetzen();
    expect(nach.stand).toBe("bestaetigung_noetig");
    expect((await zustand(s)).versand).toBe(0);
  });

  it("K5 · AC05 · Injection in Seitentext, Tooltip und Download bleibt Inhalt: kein fremdes Ziel, keine zusätzliche Handlung", async () => {
    const s = await oeffne(1);
    const seite = await lies(s, "document.getElementById('hinweis').textContent");
    const tooltip = await lies(s, "document.getElementById('a-empfaenger').getAttribute('title')");
    const href = await lies(s, "document.getElementById('anhang').getAttribute('href')");
    const download = decodeURIComponent(href.slice(href.indexOf(",") + 1));
    expect(seite).toBe(INJEKTION.seite);
    expect(tooltip).toBe(INJEKTION.tooltip);
    expect(download).toBe(INJEKTION.download);

    const a = auftrag();
    const vorher = JSON.stringify(a);
    const l = lauf(a);
    const befunde = [
      l.inhaltAufnehmen("seite", seite),
      l.inhaltAufnehmen("tooltip", tooltip),
      l.inhaltAufnehmen("download", download),
    ];
    expect(befunde.map((b) => b.fremdeAnweisung)).toEqual([true, true, true]);
    const ansicht = await l.ausfuehren();
    expect(ansicht.erfolg).toBe(true);
    expect(JSON.stringify(a)).toBe(vorher);
    expect((await werte(s, "angebot"))["a-empfaenger"]).toBe(EMPFAENGER);
    const z = await zustand(s);
    expect([z.versand, z.bestellungen]).toEqual([0, 0]);
    expect(eigene(z)[0]?.empfaenger).toBe(EMPFAENGER);
    expect(JSON.stringify(ansicht)).not.toContain(ANGREIFER);
    // Der Tooltip ist kein Name: die Beschriftung bleibt „Empfänger".
    const lage = await adapter.lage(1, "Angebotsentwurf", TESTSEITE.entwurfsliste);
    const beschriftungen = lage?.formular?.felder.map((f) => f.label);
    expect(beschriftungen).toEqual(["Betreff", "Empfänger", "Nachricht"]);
  });

  it("K6 · AC06 · Rechteentzug zwischen zwei Schritten stoppt den zweiten; erlaubte Teilergebnisse sichtbar, kein Leck", async () => {
    const s = await oeffne(1);
    let n = 0;
    const l = lauf(auftrag(), async () => ++n < 3);
    l.inhaltAufnehmen("seite", INJEKTION.seite);
    const a = await l.ausfuehren();
    expect(a.stand).toBe("gestoppt_recht");
    expect(a.erfolg).toBe(false);
    expect(staende(a)).toEqual([
      "lesen:erfolgt",
      "fuellen:erfolgt",
      "fuellen:uebersprungen",
      "fuellen:uebersprungen",
      "speichern:uebersprungen",
      "nachlesen:uebersprungen",
    ]);
    expect(a.text).toContain("1 von 3 Feldern eingetragen. Nichts gespeichert.");
    expect(await werte(s, "angebot")).toEqual({
      "a-betreff": BETREFF,
      "a-empfaenger": "",
      "a-nachricht": "",
    });
    expect((await zustand(s)).speicherungen).toBe(0);
    // Nach dem Entzug kein weiterer Lesezugriff; die Sicht trägt keine Seiteninhalte.
    const lesungen = adapter.zaehle("lage");
    expect(lesungen).toBe(2);
    const json = JSON.stringify(a);
    expect(json).not.toContain(LECKZEICHEN);
    expect(json).not.toContain("Gehaltsliste");
    expect(a.inhalte).toEqual([]);
    await l.fortsetzen();
    expect(adapter.zaehle("lage")).toBe(lesungen);
  });

  it("K7 · AC07 · Doppelklick auf Ausführen erzeugt genau eine Speicherung; ein späterer Lauf speichert nicht erneut", async () => {
    const s = await oeffne(1);
    const l = lauf(auftrag());
    const [x, y] = await Promise.all([l.ausfuehren(), l.ausfuehren()]);
    expect([x.erfolg, y.erfolg]).toEqual([true, true]);
    await l.ausfuehren();
    expect((await zustand(s)).speicherungen).toBe(1);
    expect(adapter.zaehle("klicke:")).toBe(1);
  });

  it("K7 · AC07 · Antwort geht NACH der Speicherung verloren: unklar, Abgleich beim Wiederanlauf, keine zweite Speicherung", async () => {
    const s = await oeffne(1);
    const l = lauf(auftrag());
    adapter.stoerung = { wann: "nach", grund: "zeitueberschreitung" };
    const erst = await l.ausfuehren();
    expect(erst.stand).toBe("unklar");
    expect(erst.erfolg).toBe(false);
    expect((await zustand(s)).speicherungen).toBe(1);
    const zweit = await l.fortsetzen();
    expect(zweit.erfolg).toBe(true);
    expect(zweit.schritte.find((x) => x.art === "speichern")?.beleg).toContain("abgeglichen");
    expect((await zustand(s)).speicherungen).toBe(1);
    expect(adapter.zaehle("klicke:")).toBe(1);
  });

  it("K7 · AC07 · Verbindung bricht VOR der Speicherung ab: Abgleich findet nichts, dann genau eine Speicherung", async () => {
    const s = await oeffne(1);
    const l = lauf(auftrag());
    adapter.stoerung = { wann: "vor", grund: "verbindung" };
    expect((await l.ausfuehren()).stand).toBe("unklar");
    expect((await zustand(s)).speicherungen).toBe(0);
    expect((await l.fortsetzen()).erfolg).toBe(true);
    expect((await zustand(s)).speicherungen).toBe(1);
  });

  it("K7 · AC07 · unklares Senden wird nie wiederholt, sondern zur Prüfung übergeben", async () => {
    const s = await oeffne(1);
    const a = auftrag({ speichern: false, ausloesen: "Endgültig senden" });
    const l = lauf(a);
    await l.ausfuehren();
    l.bestaetige({
      auftragId: a.id,
      knopf: "Endgültig senden",
      fingerabdruck: l.bestaetigungsBedarf()?.fingerabdruck ?? "",
      nutzer: a.nutzer,
      bestaetigtAm: new Date().toISOString(),
    });
    adapter.stoerung = { wann: "nach", grund: "zeitueberschreitung" };
    expect((await l.fortsetzen()).stand).toBe("unklar");
    const danach = await l.fortsetzen();
    expect(danach.stand).toBe("uebergabe");
    expect(danach.uebergabe?.grund).toBe("pruefen");
    expect(danach.erfolg).toBe(false);
    expect((await zustand(s)).versand).toBe(1);
  });

  it("K8 · AC08 · Pause hält vor dem nächsten Schritt, zeigt Erfolgtes; Fortsetzen prüft das Ziel und speichert genau einmal", async () => {
    const s = await oeffne(1);
    let n = 0;
    const l: BrowserAusfuehrung = lauf(auftrag(), async () => {
      if (++n === 3) {
        l.pausiere();
      }
      return true;
    });
    const pause = await l.ausfuehren();
    expect(pause.stand).toBe("pausiert");
    expect(staende(pause)).toEqual([
      "lesen:erfolgt",
      "fuellen:erfolgt",
      "fuellen:erfolgt",
      "fuellen:offen",
      "speichern:offen",
      "nachlesen:offen",
    ]);
    const erfolgt = pause.schritte.filter((x) => x.stand === "erfolgt");
    expect(erfolgt.every((x) => x.am !== null)).toBe(true);
    expect((await werte(s, "angebot"))["a-nachricht"]).toBe("");
    expect((await zustand(s)).speicherungen).toBe(0);
    const weiter = await l.fortsetzen();
    expect(weiter.erfolg).toBe(true);
    expect(weiter.verlauf.map((v) => v.ereignis)).toEqual(
      expect.arrayContaining(["pausiert", "fortgesetzt"]),
    );
    expect((await zustand(s)).speicherungen).toBe(1);
  });

  it("K8 · AC08 · nach der Pause umgebautes Ziel: Fortsetzen klärt statt zu schreiben; Abbruch beendet ohne weitere Wirkung", async () => {
    const s = await oeffne(1);
    let n = 0;
    const l: BrowserAusfuehrung = lauf(auftrag(), async () => {
      if (++n === 3) {
        l.pausiere();
      }
      return true;
    });
    await l.ausfuehren();
    await aendere(s, benenneUm("a-nachricht", "Mitteilung"));
    const klaerung = await l.fortsetzen();
    expect(klaerung.stand).toBe("klaerung");
    expect(klaerung.klaerung).toContain('„Nachricht"');
    expect((await werte(s, "angebot"))["a-nachricht"]).toBe("");

    l.brecheAb();
    const ab = await l.fortsetzen();
    expect(ab.stand).toBe("abgebrochen");
    expect(staende(ab)).toEqual([
      "lesen:erfolgt",
      "fuellen:erfolgt",
      "fuellen:erfolgt",
      "fuellen:uebersprungen",
      "speichern:uebersprungen",
      "nachlesen:uebersprungen",
    ]);
    expect(ab.text).toContain("Bereits Geschehenes bleibt sichtbar");
    expect((await werte(s, "angebot"))["a-betreff"]).toBe(BETREFF);
    expect((await zustand(s)).speicherungen).toBe(0);
  });

  it("K9 · AC09 · Rücknahme löscht genau den eigenen gespeicherten Entwurf; der gleichnamige ältere bleibt", async () => {
    const s = await oeffne(1);
    const l = lauf(auftrag());
    const a = await l.ausfuehren();
    const id = a.ergebnis?.entwurfId ?? "";
    expect(id).toMatch(/^E-\d+$/);
    const r = await l.ruecknahme();
    expect(r.art).toBe("zurueckgenommen");
    const z = await zustand(s);
    expect(z.entwuerfe.map((e) => e.id)).toEqual(["E-alt-1", "E-alt-2"]);
    expect(z.entwuerfe[0]?.betreff).toBe(BETREFF);
    expect(z.loeschungen).toBe(1);
    const nach = l.ansicht();
    expect(nach.ergebnis?.zurueckgenommen).toBe(true);
    expect(staende(nach)).toContain("speichern:zurueckgenommen");
    expect(nach.erfolg).toBe(false);
    expect((await l.ruecknahme()).art).toBe("nichts");
    expect((await zustand(s)).loeschungen).toBe(1);
  });

  it("K9 · AC09 · Gesendetes ist ehrlich nicht rücknehmbar; ungespeicherte Feldwerte gehen auf den vorherigen Stand", async () => {
    const s = await oeffne(1);
    const a = auftrag({ speichern: false, ausloesen: "Endgültig senden" });
    const l = lauf(a);
    await l.ausfuehren();
    l.bestaetige({
      auftragId: a.id,
      knopf: "Endgültig senden",
      fingerabdruck: l.bestaetigungsBedarf()?.fingerabdruck ?? "",
      nutzer: a.nutzer,
      bestaetigtAm: new Date().toISOString(),
    });
    await l.fortsetzen();
    const r = await l.ruecknahme();
    expect(r.art).toBe("nicht_ruecknehmbar");
    expect("text" in r && r.text).toContain("keine Rücknahme");
    const z = await zustand(s);
    expect([z.versand, z.loeschungen]).toEqual([1, 0]);

    const s2 = await oeffne(2);
    await aendere(s2, "document.getElementById('a-betreff').value = 'Alter Betreff';");
    const nurFuellen = lauf(auftrag({ speichern: false, ziel: imTab(2) }));
    expect((await nurFuellen.ausfuehren()).erfolg).toBe(true);
    expect((await nurFuellen.ruecknahme()).art).toBe("zurueckgenommen");
    expect(await werte(s2, "angebot")).toEqual({
      "a-betreff": "Alter Betreff",
      "a-empfaenger": "",
      "a-nachricht": "",
    });
  });

  it("K10 · AC10 · CAPTCHA und MFA führen zur konkreten Übergabe; nichts eingetragen, kein gemeldeter Erfolg", async () => {
    for (const variante of ["captcha", "mfa"] as const) {
      const s = await oeffne(1, `${PFAD}?variante=${variante}`);
      const a = await lauf(auftrag()).ausfuehren();
      expect(a.stand).toBe("uebergabe");
      expect(a.uebergabe?.grund).toBe(variante);
      expect(a.uebergabe?.schritt).toContain("selbst");
      expect(a.erfolg).toBe(false);
      expect(a.text.startsWith("Erledigt")).toBe(false);
      expect(a.schritte.every((x) => x.stand === "uebersprungen")).toBe(true);
      expect((await werte(s, "angebot"))["a-betreff"]).toBe("");
      expect((await zustand(s)).speicherungen).toBe(0);
    }
  });

  it("K10 · AC10 · nicht unterstützte Seite und gesperrte Handlung: Übergabe mit konkretem Schritt, die Seite bleibt unberührt", async () => {
    const s = await oeffne(1);
    const fremd = neuerBrowserAuftrag(REGISTER, eingabe({ ziel: imTab(1, "https://fremd.test") }));
    expect(!fremd.ok && "uebergabe" in fremd && fremd.uebergabe.grund).toBe("nicht_unterstuetzt");
    const bestellen = neuerBrowserAuftrag(REGISTER, eingabe({ ausloesen: "Bestellung auslösen" }));
    expect(!bestellen.ok && "uebergabe" in bestellen && bestellen.uebergabe.schritt).toContain(
      "selbst aus",
    );
    const z = await zustand(s);
    expect([z.speicherungen, z.versand, z.bestellungen]).toEqual([0, 0, 0]);
    expect(adapter.aufrufe).toEqual([]);
  });
});
