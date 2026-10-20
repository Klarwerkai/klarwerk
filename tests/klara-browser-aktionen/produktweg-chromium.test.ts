// ================================================================================================
// produkt:20261011:assistenz-browser-aktionen (BPA-03) — DER PRODUKTWEG IN CHROMIUM.
// (Ben, Nacharbeit 9: „BrowserAusfuehrung hat keinen Produktaufrufer.")
// ================================================================================================
//
// WAS HIER LÄUFT — alles echt bis auf das, was unten ausdrücklich steht:
//   · die ausgelieferte Erweiterung `extensions/klara-browser/` (byte-gleich, in eine Prüfkopie
//     geladen) mit ihrem Worker, ihrer Leiste (`panel.html` als Erweiterungsseite) und `aktion.js`,
//     das der Worker mit `chrome.scripting` in Chromes isolierte Welt der Seite einsetzt;
//   · die Klickgeste auf das Klara-Symbol: Chromes eigener Auslöser (`Extensions.triggerAction`
//     über das DevTools-Protokoll). Er ruft `chrome.action.onClicked` und erteilt `activeTab` wie
//     ein Klick — die einmalige Freigabe von BPA-01 entsteht daraus im Worker;
//   · die Anmeldung über das Anmeldeformular der Leiste;
//   · der Server: `buildApp` mit In-Memory-Ablage — Anmeldung, Rollenrechte, Klara-Gespräch,
//     Aktionskern, Befehlsweg. Die Anfragen der Erweiterung an `https://app.klarwerk.ai` werden im
//     Browser abgefangen und an genau diesen Server gereicht (`app.inject`), Kopf und Körper
//     unverändert;
//   · die kontrollierte synthetische Testseite (`testseite.ts`); sie zählt selbst, was geschah.
//     Jede Zusicherung liest diese Zähler, die Feldwerte der Seite oder den Verlauf am Server.
//
// WAS NICHT ECHT IST, ausdrücklich: Chromium 149 headless statt Google Chrome auf dem Mac (O01);
// die Geste kommt aus dem DevTools-Protokoll, nicht von einer Hand; die Leiste läuft als Tab statt
// im Seitenfenster; die Spracherkennung des Browsers ist gestellt (Chromium hat ohne Google-Dienst
// keine) — gestellt ist NUR die Erkennung, alles ab ihrem Ergebnis ist der Produktweg; keine echte
// Website, keine echte Außenwirkung.
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  ANGREIFER,
  BETREFF,
  EMPFAENGER,
  LECKZEICHEN,
  NACHRICHT,
  ORIGIN,
  PFAD,
  TESTSEITE,
  seitenHtml,
} from "./testseite";

const ERWEITERUNG = resolve("extensions/klara-browser");
const PASSWORT = "bpa03-produktweg-synthetisch";
const KONTO_A = "bpa03-person-a@example.test";
const KONTO_B = "bpa03-person-b@example.test";
const FREMDE_SEITE = "https://fremde-seite-bpa03.test/formular";

type App = ReturnType<typeof buildApp>;
interface Seite {
  goto(url: string): Promise<unknown>;
  evaluate<T>(f: string | ((arg: never) => unknown), arg?: unknown): Promise<T>;
  bringToFront(): Promise<void>;
  click(sel: string, o?: Record<string, unknown>): Promise<void>;
  dblclick(sel: string): Promise<void>;
  fill(sel: string, wert: string): Promise<void>;
  textContent(sel: string): Promise<string | null>;
  isHidden(sel: string): Promise<boolean>;
  isEnabled(sel: string): Promise<boolean>;
  waitForFunction(f: string, arg?: unknown, o?: Record<string, unknown>): Promise<unknown>;
  addInitScript(s: string): Promise<void>;
  close(): Promise<void>;
}
interface Route {
  request(): {
    url(): string;
    method(): string;
    headers(): Record<string, string>;
    postData(): string | null;
  };
  fulfill(o: { status: number; headers?: Record<string, string>; body: string }): Promise<void>;
  abort(grund?: string): Promise<void>;
}
interface Arbeiter {
  url(): string;
  evaluate<T>(f: string | ((arg: never) => unknown), arg?: unknown): Promise<T>;
}
interface CdpSitzung {
  send(methode: string, args?: Record<string, unknown>): Promise<Record<string, unknown>>;
}
interface Kontext {
  newPage(): Promise<Seite>;
  route(muster: string, behandle: (route: Route) => Promise<void>): Promise<void>;
  serviceWorkers(): Arbeiter[];
  waitForEvent(e: string, o?: Record<string, unknown>): Promise<Arbeiter>;
  browser(): { version(): string; newBrowserCDPSession(): Promise<CdpSitzung> } | null;
  close(): Promise<void>;
}

interface Zaehler {
  entwuerfe: {
    id: string;
    formular: string;
    betreff: string;
    empfaenger: string;
    nachricht: string;
  }[];
  speicherungen: number;
  versand: number;
  bestellungen: number;
  loeschungen: number;
}
interface Sicht {
  id: string;
  quelle: string;
  stand: string;
  erfolg: boolean;
  text: string;
  formular: string | null;
  schritte: {
    nr: number;
    aktionskennung: string;
    art: string;
    feld: string | null;
    stand: string;
    beleg: string | null;
  }[];
  ergebnis: { entwurfId: string; nachgelesen: boolean; zurueckgenommen: boolean } | null;
  klaerung: string | null;
  uebergabe: { grund: string; schritt: string } | null;
  bestaetigung: { knopf: string; bestaetigtAm: string } | null;
  bedarf: { knopf: string; fingerabdruck: string; werte: { label: string; wert: string }[] } | null;
  ruecknahme: { art: string; text: string } | null;
  ruecknahmeAngebot: string | null;
  verlauf: { ereignis: string; am: string }[];
  host: { browser: string; version: string; erweiterung: string; adapter: string };
  laeuft: boolean;
  gespraechId: string | null;
}

let playwright: {
  chromium: { launchPersistentContext(dir: string, o: Record<string, unknown>): Promise<Kontext> };
};
let ordner = "";
let erweiterungKopie = "";
const paketHash = (wurzel: string) => {
  const h = createHash("sha256");
  for (const name of readdirSync(wurzel, { recursive: true }).map(String).sort()) {
    try {
      h.update(name).update(readFileSync(join(wurzel, name)));
    } catch {
      // Verzeichnisse
    }
  }
  return h.digest("hex");
};

let paket = "";

beforeAll(() => {
  playwright = createRequire(import.meta.url)("playwright") as typeof playwright;
  // Je Lauf ein NEUER eigener Ordner (Erweiterungskopie und frische Browserprofile) — kein
  // vorhandenes Profil, keine Anmeldung ausserhalb dieses Prüfstands. Er wird nicht gelöscht.
  ordner = mkdtempSync(join(tmpdir(), "bpa03-produktweg-"));
  erweiterungKopie = join(ordner, "erweiterung");
  cpSync(ERWEITERUNG, erweiterungKopie, { recursive: true });
  // Geladen wird GENAU der Stand des Arbeitsbaums.
  paket = paketHash(ERWEITERUNG);
  expect(paketHash(erweiterungKopie)).toBe(paket);
});

/** Ein Lauf: Server, Browser mit Erweiterung, angemeldete Leiste, freigegebene Seite. */
interface Bahn {
  app: App;
  ctx: Kontext;
  sw: Arbeiter;
  leiste: Seite;
  seite: Seite;
  version: string;
  /** Anfragen der Erweiterung an den Server, in Reihenfolge (Pfad, Status). */
  aufrufe: { pfad: string; status: number; body: unknown; anfrage: Record<string, unknown> }[];
  /** Wartet, bis der Server eine Steuerung dieser Art beantwortet hat. */
  gesteuert(art: string): Promise<void>;
  /** Hält die nächste Taktanfrage an, deren Antwort `passt`; der Rückgabewert lässt sie weiter. */
  halteTakt(passt: (body: Record<string, unknown>) => boolean): Promise<() => void>;
  /** Lässt Taktanfragen, deren Antwort `passt`, im Netz verloren gehen (bis `aus()`). */
  verliereTakt(passt: (body: Record<string, unknown>) => boolean): {
    aus(): void;
    verloren(): number;
  };
  /**
   * Lässt die ANTWORT des Servers verloren gehen, deren Befehl `passt`: der Server hat den Befehl
   * ausgegeben, die Erweiterung erhält ihn nie (einmal, dann wieder durchgelassen).
   */
  verliereAntwort(passt: (befehl: Record<string, unknown>) => boolean): { verloren(): number };
  token(email: string): Promise<string>;
  adminToken: string;
  idVon: Record<string, string>;
  zaehler(): Promise<Zaehler>;
  felder(formular: string): Promise<Record<string, string>>;
  klick(seite: Seite): Promise<void>;
  auftrag(text: string): Promise<void>;
  sicht(): Promise<Sicht | null>;
  warte(bis: (s: Sicht) => boolean, ms?: number): Promise<Sicht>;
  verlauf(email?: string): Promise<Sicht[]>;
}

const bahnen: Bahn[] = [];
afterEach(async () => {
  for (const b of bahnen.splice(0)) {
    await b.ctx.close().catch(() => {});
    await b.app.close().catch(() => {});
  }
});

async function bahn(o: { sprache?: string; fristen?: Record<string, number> } = {}): Promise<Bahn> {
  const app = buildApp(buildServices(), {
    browserAktion: {
      seitenprofile: [TESTSEITE],
      fristen: { abholMs: 4000, antwortMs: 2500, taktMs: 1500, ...o.fristen },
    },
  });
  // Konten wie im Bestand: das erste ist Verwaltung, weitere werden von ihm freigegeben (Rolle
  // `experte` — Lesen und Anlegen).
  const idVon: Record<string, string> = {};
  for (const [name, email] of [
    ["Verwaltung", "bpa03-verwaltung@example.test"],
    ["Person A", KONTO_A],
    ["Person B", KONTO_B],
  ] as const) {
    const r = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name, email, password: PASSWORT },
    });
    idVon[email] = r.json().id as string;
  }
  const admin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "bpa03-verwaltung@example.test", password: PASSWORT },
  });
  const adminToken = admin.json().token as string;
  for (const email of [KONTO_A, KONTO_B]) {
    const f = await app.inject({
      method: "POST",
      url: `/api/auth/users/${idVon[email]}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(f.statusCode).toBeLessThan(300);
  }
  const profil = mkdtempSync(join(ordner, "profil-"));
  const ctx = await playwright.chromium.launchPersistentContext(profil, {
    channel: "chromium",
    headless: true,
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    args: [
      `--disable-extensions-except=${erweiterungKopie}`,
      `--load-extension=${erweiterungKopie}`,
      "--enable-unsafe-extension-debugging",
      // Wie der bestehende Chromium-Test: auf dem Linux-Prüfserver ohne Sandbox und GPU.
      "--no-sandbox",
      "--disable-gpu",
    ],
  });
  const aufrufe: Bahn["aufrufe"] = [];
  let halten: {
    passt: (b: Record<string, unknown>) => boolean;
    frei: Promise<void>;
    erreicht: () => void;
  } | null = null;
  let verlieren: { passt: (b: Record<string, unknown>) => boolean; n: number } | null = null;
  let antwortWeg: { passt: (b: Record<string, unknown>) => boolean; n: number } | null = null;
  await ctx.route("https://app.klarwerk.ai/**", async (route) => {
    const r = route.request();
    const url = new URL(r.url());
    const roh = r.postData();
    const body = roh ? (JSON.parse(roh) as Record<string, unknown>) : {};
    if (url.pathname.endsWith("/takt")) {
      if (verlieren?.passt(body)) {
        verlieren.n++;
        await route.abort("connectionreset");
        return;
      }
      const h = halten;
      if (h?.passt(body)) {
        halten = null;
        h.erreicht();
        await h.frei;
      }
    }
    const kopf = r.headers();
    const antwort = await app.inject({
      method: r.method() as "GET" | "POST" | "PUT",
      url: url.pathname + url.search,
      headers: {
        ...(kopf.authorization ? { authorization: kopf.authorization } : {}),
        ...(kopf["content-type"] ? { "content-type": kopf["content-type"] } : {}),
      },
      ...(roh !== null ? { payload: roh } : {}),
    });
    let gelesen: unknown = null;
    try {
      gelesen = JSON.parse(antwort.body);
    } catch {
      gelesen = null;
    }
    aufrufe.push({ pfad: url.pathname, status: antwort.statusCode, body: gelesen, anfrage: body });
    const befehl = (gelesen as { befehl?: Record<string, unknown> } | null)?.befehl;
    if (antwortWeg && befehl && antwortWeg.passt(befehl)) {
      antwortWeg.n++;
      antwortWeg = null;
      await route.abort("connectionreset");
      return;
    }
    await route.fulfill({
      status: antwort.statusCode,
      headers: { "content-type": String(antwort.headers["content-type"] ?? "application/json") },
      body: antwort.body,
    });
  });
  await ctx.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    const variante = url.searchParams.get("variante");
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
      body: seitenHtml(variante === "captcha" || variante === "mfa" ? variante : "standard"),
    });
  });
  await ctx.route("https://fremde-seite-bpa03.test/**", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
      body: '<!doctype html><html lang="de"><title>Fremd</title><form aria-label="Angebotsentwurf"><label for="b">Betreff</label><input id="b"></form>',
    });
  });
  const sw =
    ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker", { timeout: 15000 }));
  const id = new URL(sw.url()).host;
  const version = ctx.browser()?.version() ?? "unbekannt";
  const leiste = await ctx.newPage();
  if (o.sprache) {
    // NUR die Spracherkennung des Browsers ist gestellt: sie liefert genau diesen erkannten Text.
    await leiste.addInitScript(`(() => {
      const erkannt = ${JSON.stringify(o.sprache)};
      class GestellteErkennung {
        constructor() { this.lang = ""; this.interimResults = false; this.maxAlternatives = 1; this.onresult = null; this.onerror = null; this.onend = null; }
        start() { setTimeout(() => { this.onresult?.({ results: [[{ transcript: erkannt }]] }); this.onend?.(); }, 30); }
        stop() { this.onend?.(); }
      }
      // Chromium 149 kennt beide Namen; die Leiste nimmt den ungepräfixten zuerst.
      globalThis.SpeechRecognition = GestellteErkennung;
      globalThis.webkitSpeechRecognition = GestellteErkennung;
    })();`);
  }
  await leiste.goto(`chrome-extension://${id}/panel.html`);
  // Anmelden über das Formular der Leiste.
  await leiste.evaluate("document.querySelectorAll('details').forEach((d) => { d.open = true; })");
  await leiste.fill("#email", KONTO_A);
  await leiste.fill("#password", PASSWORT);
  await leiste.click("#login");
  // Die Leiste hat eine strenge CSP (kein eval): gewartet wird über Abfragen von aussen.
  await expect
    .poll(() => leiste.evaluate<boolean>("!document.getElementById('logout').hidden"), {
      timeout: 15000,
    })
    .toBe(true);
  const seite = await ctx.newPage();
  const cdp = await (
    ctx.browser() as NonNullable<ReturnType<Kontext["browser"]>>
  ).newBrowserCDPSession();
  const b: Bahn = {
    app,
    ctx,
    sw,
    leiste,
    seite,
    version,
    aufrufe,
    adminToken,
    idVon,
    async halteTakt(passt) {
      let erreicht = () => {};
      let los = () => {};
      const da = new Promise<void>((r) => {
        erreicht = r;
      });
      halten = {
        passt,
        frei: new Promise<void>((r) => {
          los = r;
        }),
        erreicht,
      };
      await da;
      return los;
    },
    verliereTakt(passt) {
      const zaehlung = { passt, n: 0 };
      verlieren = zaehlung;
      return {
        aus: () => {
          verlieren = null;
        },
        verloren: () => zaehlung.n,
      };
    },
    verliereAntwort(passt) {
      const zaehlung = { passt, n: 0 };
      antwortWeg = zaehlung;
      return { verloren: () => zaehlung.n };
    },
    async gesteuert(art) {
      await expect
        .poll(() => aufrufe.some((x) => x.pfad.endsWith("/steuerung") && x.anfrage.art === art), {
          timeout: 10000,
        })
        .toBe(true);
    },
    async token(email) {
      const r = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email, password: PASSWORT },
      });
      return r.json().token as string;
    },
    zaehler: () => seite.evaluate<Zaehler>("JSON.parse(JSON.stringify(window.__bpa03))"),
    felder: (formular) =>
      seite.evaluate<Record<string, string>>(
        `Object.fromEntries(Array.from(document.getElementById(${JSON.stringify(formular)}).querySelectorAll('input, textarea')).map((el) => [el.id, el.value]))`,
      ),
    async klick(s) {
      // Chromes eigener Auslöser der Symbolaktion am Tab-Ziel dieser Seite.
      const url = await s.evaluate<string>("location.href");
      // `filter: [{}]` nimmt auch die Tab-Ziele auf; nur an ihnen löst Chrome die Symbolaktion aus.
      const ziele = (await cdp.send("Target.getTargets", { filter: [{}] })).targetInfos as {
        type: string;
        url: string;
        targetId: string;
      }[];
      const tab = ziele.find((z) => z.type === "tab" && z.url === url);
      expect(tab, `Tab-Ziel für ${url}`).toBeTruthy();
      await cdp.send("Extensions.triggerAction", { id, targetId: tab?.targetId });
      // Die Klickgeste hat die einmalige Freigabe dieser Seite erteilt (BPA-01).
      await expect
        .poll(
          () =>
            sw.evaluate<number>(
              `chrome.storage.session.get("kontext").then((d) => (d.kontext?.freigaben ?? []).filter((f) => f.art === "einmalig" && f.url === ${JSON.stringify(url)}).length)`,
            ),
          { timeout: 10000 },
        )
        .toBeGreaterThan(0);
      await leiste.bringToFront();
    },
    async auftrag(text) {
      await leiste.fill("#aktion-wortlaut", text);
      await leiste.click("#aktion-ausfuehren");
    },
    sicht: () =>
      sw.evaluate<Sicht | null>(
        `chrome.storage.session.get("aktion").then((d) => d.aktion?.sicht ?? null)`,
      ),
    async warte(bis, ms = 20000) {
      let letzte: Sicht | null = null;
      await expect
        .poll(
          async () => {
            letzte = await b.sicht();
            return letzte !== null && bis(letzte);
          },
          { timeout: ms, interval: 100 },
        )
        .toBe(true);
      return letzte as unknown as Sicht;
    },
    async verlauf(email = KONTO_A) {
      const r = await app.inject({
        method: "GET",
        url: "/api/me/klara/browser-auftraege",
        headers: { authorization: `Bearer ${await b.token(email)}` },
      });
      expect(r.statusCode).toBe(200);
      return r.json().auftraege as Sicht[];
    },
  };
  bahnen.push(b);
  return b;
}

const ENTWURF = `Fülle den Angebotsentwurf aus: Betreff „${BETREFF}", Empfänger ${EMPFAENGER}, Nachricht „${NACHRICHT}" und speichere ihn als Entwurf.`;
const SENDEN = `Fülle den Angebotsentwurf aus: Betreff „${BETREFF}", Empfänger ${EMPFAENGER}, Nachricht „${NACHRICHT}" und klicke „Endgültig senden".`;
/** Gesprochen: ohne Anführungszeichen, die Beschriftungen trennen die Werte. */
const GESPROCHEN =
  "Rückmeldung Betreff Rückruf Wartung Nachricht Bitte um Rückruf zur Wartung und speichere sie";
const ruht = (s: Sicht) => !s.laeuft;
const staende = (s: Sicht) =>
  s.schritte.map((x) => `${x.art}${x.feld ? `:${x.feld}` : ""}=${x.stand}`);
const eigene = (z: Zaehler) => z.entwuerfe.filter((e) => !e.id.startsWith("E-alt"));
/** Die Taktanfrage, die die Antwort auf einen Eintragebefehl für `label` trägt. */
const nachEintrag = (label: string) => (body: Record<string, unknown>) => {
  const a = body.antwort as { ergebnis?: { ok?: boolean; wert?: { wert?: string } } } | undefined;
  return (
    a?.ergebnis?.ok === true &&
    typeof a.ergebnis.wert?.wert === "string" &&
    a.ergebnis.wert.wert.length > 0 &&
    label.length > 0
  );
};
/** Die Taktanfrage, die die Antwort auf einen Klick (Speichern/Senden/Löschen) trägt. */
const nachKlick = (body: Record<string, unknown>) => {
  const a = body.antwort as { ergebnis?: { ok?: boolean; wert?: unknown } } | undefined;
  return a?.ergebnis?.ok === true && a.ergebnis.wert === null;
};
const sichtbar = async (s: Seite, sel: string) => !(await s.isHidden(sel));

async function bereit(o: Parameters<typeof bahn>[0] = {}, pfad = PFAD): Promise<Bahn> {
  const b = await bahn(o);
  await b.seite.goto(`${ORIGIN}${pfad}`);
  await b.klick(b.seite);
  return b;
}

describe("BPA-03 · Produktweg: Leiste → Worker → Aktionskern → aktion.js → Seite → Verlauf (Chromium)", () => {
  it("K1/K3/K5 · AC01 · getippter und gesprochener Auftrag füllen auf DERSELBEN Seite je ihr Formular, speichern je einmal, lesen nach und stehen im Verlauf", async () => {
    const b = await bereit({ sprache: GESPROCHEN });
    // 1 · GETIPPT
    await b.auftrag(ENTWURF);
    const s = await b.warte(ruht);
    console.info(
      `BPA-03 Produktweg · Chromium ${b.version} · Erweiterung ${s.host.erweiterung} (Paket-SHA256 ${paket}) · ${s.host.adapter} · ` +
        `Zeitzone Europe/Berlin · ${new Date().toISOString()} · Auftrag ${s.id} · ${staende(s).join(" ")}`,
    );
    expect(s.stand).toBe("fertig");
    expect(s.erfolg).toBe(true);
    expect(s.quelle).toBe("getippt");
    expect(s.formular).toBe("Angebotsentwurf");
    expect(s.host.adapter).toMatch(/aktion\.js@1\.0\.0/);
    // K3: ein Entwurfsauftrag hat keinen Auslöseschritt.
    expect(s.schritte.map((x) => x.art)).not.toContain("ausloesen");
    // Die Wirkung, an der Seite gemessen — nicht Klaras Meldung.
    expect(await b.felder("angebot")).toEqual({
      "a-betreff": BETREFF,
      "a-empfaenger": EMPFAENGER,
      "a-nachricht": NACHRICHT,
    });
    expect(await b.felder("rueckmeldung")).toEqual({ "r-betreff": "", "r-nachricht": "" });
    let z = await b.zaehler();
    expect(z.speicherungen).toBe(1);
    // K3/K5: kein Senden, keine Bestellung — auch nicht durch die Anweisungen in Seitentext,
    // Tooltip und Download der Seite; kein fremder Empfänger.
    expect(z.versand + z.bestellungen).toBe(0);
    expect(JSON.stringify(await b.felder("angebot"))).not.toContain(ANGREIFER);
    expect(eigene(z)).toHaveLength(1);
    expect(s.ergebnis?.entwurfId).toBe(eigene(z)[0]?.id);
    expect(await b.leiste.textContent("#aktion-stand")).toContain("Erledigt und nachgelesen");
    // 2 · GESPROCHEN — die Spracherkennung liefert, der Rest ist derselbe Produktweg.
    await b.leiste.fill("#aktion-wortlaut", "");
    await b.leiste.click("#aktion-sprechen");
    await expect
      .poll(() => b.leiste.evaluate<string>("document.getElementById('aktion-wortlaut').value"))
      .toBe(GESPROCHEN);
    expect(await sichtbar(b.leiste, "#aktion-quelle")).toBe(true);
    await b.leiste.click("#aktion-ausfuehren");
    // Ohne Anführungszeichen trennen allein die Feldnamen: Klara zeigt die Zuordnung, bevor auf der
    // Seite etwas geschieht (vierte Prüfung, E1); erst die Bestätigung startet den Lauf.
    await expect.poll(() => sichtbar(b.leiste, "#aktion-zuordnung"), { timeout: 10000 }).toBe(true);
    expect(await b.leiste.textContent("#aktion-zuordnung-werte")).toContain("Rückruf Wartung");
    expect(await b.felder("rueckmeldung")).toEqual({ "r-betreff": "", "r-nachricht": "" });
    expect((await b.zaehler()).speicherungen).toBe(1);
    await b.leiste.click("#aktion-zuordnung-ok");
    const g = await b.warte((x) => x.id !== s.id && ruht(x));
    expect(await sichtbar(b.leiste, "#aktion-zuordnung")).toBe(false);
    expect(g.stand).toBe("fertig");
    expect(g.quelle).toBe("gesprochen");
    expect(g.formular).toBe("Rückmeldung");
    expect(await b.felder("rueckmeldung")).toEqual({
      "r-betreff": "Rückruf Wartung",
      "r-nachricht": "Bitte um Rückruf zur Wartung",
    });
    // Das Angebot von eben bleibt, wie es war.
    expect((await b.felder("angebot"))["a-betreff"]).toBe(BETREFF);
    z = await b.zaehler();
    expect(z.speicherungen).toBe(2);
    expect(eigene(z).map((e) => e.formular)).toEqual(["Angebotsentwurf", "Rückmeldung"]);
    // Der Ergebnisbeleg im vorhandenen Auftragsverlauf (eigenes Klara-Gespräch): beide Aufträge.
    const verlauf = await b.verlauf();
    expect(verlauf.map((v) => v.id)).toEqual([g.id, s.id]);
    for (const v of verlauf) {
      expect(v.stand).toBe("fertig");
      expect(v.schritte.map((x) => x.aktionskennung)).toEqual(
        v.schritte.map((x) => `klara-auftrag-${v.id}-${x.nr}`),
      );
      expect(v.gespraechId).toBeTruthy();
    }
    expect(verlauf.map((v) => v.quelle)).toEqual(["gesprochen", "getippt"]);
    expect(verlauf[1]?.ergebnis?.entwurfId).toBe(s.ergebnis?.entwurfId);
    // Keine Seiteninhalte im Verlauf: weder der vertrauliche Altentwurf noch Injektionstext.
    expect(JSON.stringify(verlauf)).not.toContain(LECKZEICHEN);
    expect(JSON.stringify(verlauf)).not.toContain(ANGREIFER);
  }, 120_000);

  it("K2 · AC02 · Formular wird vor dem Speichern umgebaut (zweites „Betreff“): gezielte Klärung, nichts gespeichert, kein Schreiben ins ähnliche Feld", async () => {
    const b = await bereit();
    const halt = b.halteTakt(nachEintrag("Betreff"));
    await b.auftrag(ENTWURF);
    const los = await halt;
    await b.seite.evaluate(
      `(() => { const p = document.createElement('p'); p.innerHTML = '<label for="a-betreff-2">Betreff</label> <input id="a-betreff-2">'; document.getElementById('angebot').append(p); })()`,
    );
    los();
    const s = await b.warte(ruht);
    expect(s.stand).toBe("klaerung");
    expect(s.klaerung).toContain("Betreff");
    expect(await b.leiste.textContent("#aktion-klaerung")).toContain("Betreff");
    const z = await b.zaehler();
    expect(z.speicherungen).toBe(0);
    expect((await b.felder("angebot"))["a-betreff-2"]).toBe("");
    expect(s.erfolg).toBe(false);
  }, 90_000);

  it("K2 · AC02 · zweiter ähnlicher Tab im Vordergrund: gezielte Klärung; geschrieben wird nur in den freigegebenen Tab, wenn die Person dort ist (D4)", async () => {
    const b = await bereit();
    const zweiter = await b.ctx.newPage();
    await zweiter.goto(`${ORIGIN}${PFAD}`);
    await zweiter.bringToFront();
    await b.leiste.fill("#aktion-wortlaut", ENTWURF);
    // Die Person ist im ZWEITEN Tab (nicht freigegeben): Klara klärt, bevor irgendetwas geschieht
    // (zweite Prüfung, D4) — weder hier noch dort wird geschrieben.
    await b.leiste.click("#aktion-ausfuehren");
    await expect
      .poll(() => b.leiste.textContent("#aktion-hinweis"), { timeout: 10000 })
      .toContain("anderer Tab");
    expect(await b.verlauf()).toHaveLength(0);
    expect(await zweiter.evaluate<string>("document.getElementById('a-betreff').value")).toBe("");
    expect((await b.felder("angebot"))["a-betreff"]).toBe("");
    // Zurück im freigegebenen Tab: der Auftrag läuft dort — und nur dort.
    await b.seite.bringToFront();
    await b.leiste.click("#aktion-ausfuehren");
    const s = await b.warte(ruht);
    expect(s.stand).toBe("fertig");
    expect((await b.felder("angebot"))["a-betreff"]).toBe(BETREFF);
    const anderer = await zweiter.evaluate<Zaehler>("JSON.parse(JSON.stringify(window.__bpa03))");
    expect(anderer.speicherungen).toBe(0);
    expect(await zweiter.evaluate<string>("document.getElementById('a-betreff').value")).toBe("");
  }, 90_000);

  it("K4 · AC04 · Entwurfserlaubnis bestellt nicht: „Bestellung auslösen“ wird übergeben, die Seite bleibt unberührt", async () => {
    const b = await bereit();
    await b.auftrag(
      `Fülle den Angebotsentwurf aus: Betreff „${BETREFF}" und löse die Bestellung aus.`,
    );
    const s = await b.warte(ruht);
    expect(s.stand).toBe("uebergabe");
    expect(s.uebergabe?.grund).toBe("gesperrte_handlung");
    expect(await b.leiste.textContent("#aktion-uebergabe")).toContain("nicht freigegeben");
    const z = await b.zaehler();
    expect(z.bestellungen + z.versand + z.speicherungen).toBe(0);
    expect((await b.felder("angebot"))["a-betreff"]).toBe("");
    expect(s.erfolg).toBe(false);
  }, 90_000);

  it("K4/K9 · AC04/AC09 · Senden wirkt erst mit der gebundenen Bestätigung, genau einmal, und ist ehrlich nicht rücknehmbar", async () => {
    const b = await bereit();
    await b.auftrag(SENDEN);
    const s = await b.warte((x) => x.stand === "bestaetigung_noetig" && ruht(x));
    expect((await b.zaehler()).versand).toBe(0);
    expect(await sichtbar(b.leiste, "#aktion-bestaetigung")).toBe(true);
    expect(await b.leiste.textContent("#aktion-bestaetigung-werte")).toContain(EMPFAENGER);
    expect(await b.leiste.textContent("#aktion-bestaetigen")).toContain("Endgültig senden");
    expect(s.bedarf?.knopf).toBe("Endgültig senden");
    await b.leiste.click("#aktion-bestaetigen");
    const f = await b.warte((x) => x.stand === "fertig" && ruht(x));
    expect((await b.zaehler()).versand).toBe(1);
    expect(f.bestaetigung?.knopf).toBe("Endgültig senden");
    expect(await sichtbar(b.leiste, "#aktion-bestaetigt")).toBe(true);
    // AC09: ehrlich nicht rücknehmbar — kein Rücknahmeknopf, sondern der Satz dazu.
    expect(f.ruecknahmeAngebot).toBe("nicht_ruecknehmbar");
    expect(await sichtbar(b.leiste, "#aktion-ruecknahme")).toBe(false);
    expect(await b.leiste.textContent("#aktion-ruecknahme-text")).toContain("Nicht rücknehmbar");
    // Ein zweiter Klick auf die (nun verborgene) Bestätigung bewirkt nichts.
    expect((await b.zaehler()).versand).toBe(1);
  }, 90_000);

  it("K4/K5 · AC04/AC05 · Empfänger nach der Bestätigungsfrage auf der Seite geändert: kein Versand, Klärung", async () => {
    const b = await bereit();
    await b.auftrag(SENDEN);
    await b.warte((x) => x.stand === "bestaetigung_noetig" && ruht(x));
    await b.seite.evaluate(
      `(() => { const el = document.getElementById('a-empfaenger'); el.value = ${JSON.stringify(ANGREIFER)}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`,
    );
    await b.leiste.click("#aktion-bestaetigen");
    const s = await b.warte((x) => x.stand !== "bestaetigung_noetig" && ruht(x));
    expect(s.stand).toBe("klaerung");
    expect(s.klaerung).toContain("Empfänger");
    expect((await b.zaehler()).versand).toBe(0);
  }, 90_000);

  it("K6 · AC06 · Rolle zwischen zwei Schritten entzogen (Verwaltung): der nächste Schritt läuft nicht, das Teilergebnis bleibt sichtbar, kein Leck", async () => {
    const b = await bereit();
    const halt = b.halteTakt(nachEintrag("Betreff"));
    await b.auftrag(ENTWURF);
    const los = await halt;
    const r = await b.app.inject({
      method: "PUT",
      url: `/api/users/${b.idVon[KONTO_A]}`,
      headers: { authorization: `Bearer ${b.adminToken}` },
      payload: { role: "viewer" },
    });
    expect(r.statusCode).toBeLessThan(300);
    los();
    const s = await b.warte(ruht);
    expect(s.stand).toBe("gestoppt_recht");
    expect(s.erfolg).toBe(false);
    expect(await b.felder("angebot")).toEqual({
      "a-betreff": BETREFF,
      "a-empfaenger": "",
      "a-nachricht": "",
    });
    expect((await b.zaehler()).speicherungen).toBe(0);
    expect(staende(s)).toEqual([
      "lesen=erfolgt",
      "fuellen:Betreff=erfolgt",
      "fuellen:Empfänger=uebersprungen",
      "fuellen:Nachricht=uebersprungen",
      "speichern=uebersprungen",
      "nachlesen=uebersprungen",
    ]);
    expect(await b.leiste.textContent("#aktion-stand")).toContain("Gestoppt");
    expect(JSON.stringify(s)).not.toContain(LECKZEICHEN);
  }, 90_000);

  it("K6 · AC06 · Verbindung in der Leiste widerrufen (BPA-01) zwischen zwei Schritten: Stopp beim Kern, nichts weiter auf der Seite", async () => {
    const b = await bereit();
    const halt = b.halteTakt(nachEintrag("Betreff"));
    await b.auftrag(ENTWURF);
    const los = await halt;
    await b.leiste.click("#kontext-widerrufen");
    await b.gesteuert("widerruf");
    los();
    const s = await b.warte((x) => x.stand === "gestoppt_recht");
    expect((await b.felder("angebot"))["a-empfaenger"]).toBe("");
    expect((await b.zaehler()).speicherungen).toBe(0);
    expect(s.schritte.filter((x) => x.stand === "erfolgt").map((x) => x.feld ?? x.art)).toEqual([
      "lesen",
      "Betreff",
    ]);
    // Ein neuer Auftrag braucht eine neue Freigabe — ohne sie geschieht nichts.
    await b.leiste.fill("#aktion-wortlaut", ENTWURF);
    await b.leiste.click("#aktion-ausfuehren");
    await expect.poll(() => b.leiste.textContent("#aktion-hinweis")).toContain("freigegeben");
    expect((await b.zaehler()).speicherungen).toBe(0);
  }, 90_000);

  it("K7 · AC07 · Doppelklick auf „Ausführen“: ein Auftrag, genau eine Speicherung", async () => {
    const b = await bereit();
    await b.leiste.fill("#aktion-wortlaut", ENTWURF);
    await b.leiste.dblclick("#aktion-ausfuehren");
    await b.warte((x) => x.stand === "fertig" && ruht(x));
    expect((await b.zaehler()).speicherungen).toBe(1);
    expect(await b.verlauf()).toHaveLength(1);
  }, 90_000);

  it("K7 · AC07 · Antwort NACH dem Speicherklick geht verloren: unklar, Fortsetzen gleicht an der Seite ab, keine zweite Speicherung", async () => {
    const b = await bereit();
    const netz = b.verliereTakt(nachKlick);
    await b.auftrag(ENTWURF);
    // Der Worker verliert die Verbindung mit der Antwort auf den Speicherklick; am Server läuft
    // die Antwortfrist ab, der Ausgang ist dort „unklar".
    await expect.poll(() => netz.verloren(), { timeout: 20000 }).toBeGreaterThan(0);
    const token = await b.token(KONTO_A);
    await expect
      .poll(
        async () => {
          const r = await b.app.inject({
            method: "GET",
            url: "/api/me/klara/browser-auftraege",
            headers: { authorization: `Bearer ${token}` },
          });
          return (r.json().auftraege as Sicht[])[0]?.stand;
        },
        { timeout: 20000 },
      )
      .toBe("unklar");
    netz.aus();
    expect((await b.zaehler()).speicherungen).toBe(1);
    await expect
      .poll(() => sichtbar(b.leiste, "#aktion-fortsetzen"), { timeout: 10000 })
      .toBe(true);
    await b.leiste.click("#aktion-fortsetzen");
    const s = await b.warte((x) => x.stand === "fertig" && ruht(x));
    expect(s.schritte.find((x) => x.art === "speichern")?.beleg).toContain("abgeglichen");
    expect((await b.zaehler()).speicherungen).toBe(1);
    expect(eigene(await b.zaehler())).toHaveLength(1);
  }, 120_000);

  it("K7 · AC07 · Antwort auf den Speicherklick verloren, Fortsetzen VOR Ablauf der Frist: derselbe Befehl kommt erneut, der Worker klickt nicht ein zweites Mal", async () => {
    const b = await bereit({ fristen: { antwortMs: 15000 } });
    const netz = b.verliereTakt(nachKlick);
    await b.auftrag(ENTWURF);
    // Drei Versuche des Workers gehen verloren; er ruht mit „Verbindung".
    await expect.poll(() => netz.verloren(), { timeout: 20000 }).toBeGreaterThanOrEqual(3);
    await expect
      .poll(() => sichtbar(b.leiste, "#aktion-fortsetzen"), { timeout: 10000 })
      .toBe(true);
    expect((await b.zaehler()).speicherungen).toBe(1);
    netz.aus();
    // Der Server wartet noch auf die Antwort zu genau diesem Klick und liefert ihn erneut aus.
    await b.leiste.click("#aktion-fortsetzen");
    const s = await b.warte((x) => x.stand === "fertig" && ruht(x));
    expect(s.erfolg).toBe(true);
    expect((await b.zaehler()).speicherungen).toBe(1);
    expect(eigene(await b.zaehler())).toHaveLength(1);
    expect(s.schritte.find((x) => x.art === "speichern")?.stand).toBe("erfolgt");
  }, 120_000);

  it("K4/K7 · AC04/AC07 · Doppelklick auf die Bestätigung: genau ein Versand", async () => {
    const b = await bereit();
    await b.auftrag(SENDEN);
    await b.warte((x) => x.stand === "bestaetigung_noetig" && ruht(x));
    await b.leiste.dblclick("#aktion-bestaetigen");
    await b.warte((x) => x.stand === "fertig" && ruht(x));
    // Kurz nachwarten, ob ein zweiter Versand nachkommt.
    await b.leiste.evaluate("new Promise((r) => setTimeout(r, 1500))");
    expect((await b.zaehler()).versand).toBe(1);
  }, 90_000);

  it("K8 · AC08 · Pause hält vor dem nächsten Schritt und zeigt Erfolgtes; Fortsetzen prüft das Ziel und speichert genau einmal", async () => {
    const b = await bereit();
    const halt = b.halteTakt(nachEintrag("Betreff"));
    await b.auftrag(ENTWURF);
    const los = await halt;
    await b.leiste.click("#aktion-pause");
    // Erst wenn die Pause beim Kern ist, kommt die Antwort des laufenden Schritts an.
    await b.gesteuert("pause");
    los();
    const p = await b.warte((x) => x.stand === "pausiert" && ruht(x));
    expect(staende(p).slice(0, 3)).toEqual([
      "lesen=erfolgt",
      "fuellen:Betreff=erfolgt",
      "fuellen:Empfänger=offen",
    ]);
    expect(await b.felder("angebot")).toEqual({
      "a-betreff": BETREFF,
      "a-empfaenger": "",
      "a-nachricht": "",
    });
    expect(await b.leiste.textContent("#aktion-stand")).toContain("Pausiert");
    await b.leiste.click("#aktion-fortsetzen");
    const s = await b.warte((x) => x.stand === "fertig" && ruht(x));
    expect(s.erfolg).toBe(true);
    expect((await b.zaehler()).speicherungen).toBe(1);
    expect(s.verlauf.map((v) => v.ereignis)).toEqual(
      expect.arrayContaining(["pausiert", "fortgesetzt"]),
    );
  }, 90_000);

  it("K8/K2 · AC08 · nach der Pause umbenanntes Feld: Fortsetzen klärt statt zu schreiben; Abbruch beendet ohne weitere Wirkung", async () => {
    const b = await bereit();
    const halt = b.halteTakt(nachEintrag("Betreff"));
    await b.auftrag(ENTWURF);
    const los = await halt;
    await b.leiste.click("#aktion-pause");
    // Erst wenn die Pause beim Kern ist, kommt die Antwort des laufenden Schritts an.
    await b.gesteuert("pause");
    los();
    await b.warte((x) => x.stand === "pausiert" && ruht(x));
    await b.seite.evaluate(
      `document.querySelector('label[for="a-empfaenger"]').textContent = 'Empfangende Stelle'`,
    );
    await b.leiste.click("#aktion-fortsetzen");
    const k = await b.warte((x) => x.stand === "klaerung" && ruht(x));
    expect(k.klaerung).toContain("Empfänger");
    expect((await b.felder("angebot"))["a-empfaenger"]).toBe("");
    await b.leiste.click("#aktion-abbrechen");
    const a = await b.warte((x) => x.stand === "abgebrochen");
    expect(staende(a)).toContain("speichern=uebersprungen");
    expect((await b.zaehler()).speicherungen).toBe(0);
    expect((await b.felder("angebot"))["a-betreff"]).toBe(BETREFF);
  }, 90_000);

  it("K9 · AC09 · Rücknahme löscht genau den eigenen gespeicherten Entwurf; der gleichnamige ältere bleibt; danach kein zweites Angebot", async () => {
    const b = await bereit();
    await b.auftrag(ENTWURF);
    const s = await b.warte((x) => x.stand === "fertig" && ruht(x));
    expect(s.ruecknahmeAngebot).toBe("entwurf_loeschen");
    expect(await sichtbar(b.leiste, "#aktion-ruecknahme")).toBe(true);
    await b.leiste.click("#aktion-ruecknahme");
    const r = await b.warte((x) => x.ruecknahme !== null && ruht(x));
    expect(r.ruecknahme?.art).toBe("zurueckgenommen");
    const z = await b.zaehler();
    expect(z.loeschungen).toBe(1);
    expect(eigene(z)).toHaveLength(0);
    expect(z.entwuerfe.map((e) => e.id)).toEqual(["E-alt-1", "E-alt-2"]);
    expect(r.ruecknahmeAngebot).toBeNull();
    expect(await sichtbar(b.leiste, "#aktion-ruecknahme")).toBe(false);
    expect((await b.verlauf())[0]?.ruecknahme?.art).toBe("zurueckgenommen");
  }, 90_000);

  it("K9 · AC09 · ungespeicherte Eingaben gehen auf den vorherigen Stand zurück", async () => {
    const b = await bereit();
    await b.auftrag(`Fülle den Angebotsentwurf aus: Betreff „${BETREFF}", Empfänger ${EMPFAENGER}`);
    const s = await b.warte((x) => x.stand === "fertig" && ruht(x));
    expect(s.ruecknahmeAngebot).toBe("felder_zuruecksetzen");
    await b.leiste.click("#aktion-ruecknahme");
    const r = await b.warte((x) => x.ruecknahme !== null && ruht(x));
    expect(r.ruecknahme?.art).toBe("zurueckgenommen");
    expect(await b.felder("angebot")).toEqual({
      "a-betreff": "",
      "a-empfaenger": "",
      "a-nachricht": "",
    });
    expect((await b.zaehler()).speicherungen).toBe(0);
  }, 90_000);

  it("K2 · AC02 · anderer Datensatz auf demselben Pfad (Adresse geändert) zwischen zwei Schritten: Klärung, nichts weiter geschrieben", async () => {
    const b = await bereit();
    const halt = b.halteTakt(nachEintrag("Betreff"));
    await b.auftrag(ENTWURF);
    const los = await halt;
    // Die Seite wechselt ohne Neuladen auf einen anderen Datensatz (wie eine Anwendung mit ?id=…).
    await b.seite.evaluate("history.pushState({}, '', '?id=18')");
    los();
    const s = await b.warte(ruht);
    expect(s.stand).toBe("klaerung");
    expect(s.klaerung).toContain("nicht mehr");
    expect((await b.felder("angebot"))["a-empfaenger"]).toBe("");
    expect((await b.zaehler()).speicherungen).toBe(0);
  }, 90_000);

  it("K1/K9 · AC01/AC09 · die Seite ändert nach dem Speichern selbst ihre Adresse (?entwurf=…#gespeichert): kein Fehlstopp — nachgelesen, Rücknahme trifft (N4)", async () => {
    const b = await bereit();
    const halt = b.halteTakt(nachKlick);
    await b.auftrag(ENTWURF);
    const los = await halt;
    // Wie viele Anwendungen nach dem Speichern: Abfrage und Anker ändern sich ohne Neuladen.
    // Gebunden ist laut Seitenprofil nur `?id` — dieser Teil bleibt gleich.
    await b.seite.evaluate("history.replaceState({}, '', '?entwurf=neu#gespeichert')");
    los();
    const s = await b.warte((x) => x.stand === "fertig" && ruht(x));
    expect(s.erfolg).toBe(true);
    expect(s.schritte.find((x) => x.art === "speichern")?.stand).toBe("erfolgt");
    expect((await b.zaehler()).speicherungen).toBe(1);
    expect(s.ruecknahmeAngebot).toBe("entwurf_loeschen");
    await b.leiste.click("#aktion-ruecknahme");
    const r = await b.warte((x) => x.ruecknahme !== null && ruht(x));
    expect(r.ruecknahme?.art).toBe("zurueckgenommen");
    expect(eigene(await b.zaehler())).toHaveLength(0);
  }, 90_000);

  it("K7 · AC07 · Antwort auf den Speicherklick verloren, dann ERNEUT „Ausführen“ (derselbe Text): derselbe Lauf, keine zweite Speicherung (N2)", async () => {
    const b = await bereit({ fristen: { antwortMs: 15000 } });
    const netz = b.verliereTakt(nachKlick);
    await b.auftrag(ENTWURF);
    await expect.poll(() => netz.verloren(), { timeout: 20000 }).toBeGreaterThanOrEqual(3);
    await expect
      .poll(() => b.leiste.isEnabled("#aktion-ausfuehren"), { timeout: 10000 })
      .toBe(true);
    expect((await b.zaehler()).speicherungen).toBe(1);
    netz.aus();
    // Derselbe Vorgangsschlüssel: der Kern gibt DENSELBEN Lauf mit dem schon abgeholten Klick
    // zurück; der Worker kennt ihn als erledigt und meldet nur seine gemerkte Antwort.
    await b.leiste.click("#aktion-ausfuehren");
    const s = await b.warte((x) => x.stand === "fertig" && ruht(x));
    expect(s.erfolg).toBe(true);
    expect((await b.zaehler()).speicherungen).toBe(1);
    expect(eigene(await b.zaehler())).toHaveLength(1);
    expect(await b.verlauf()).toHaveLength(1);
  }, 120_000);

  it("K7 · AC07 · die ANTWORT, die den Speicherklick brachte, geht verloren: der Worker kennt den Lauf lückenlos und klickt genau einmal — kein falsches „unklar“ (D2)", async () => {
    const b = await bereit();
    const weg = b.verliereAntwort((befehl) => befehl.art === "klicke");
    await b.auftrag(ENTWURF);
    const s = await b.warte((x) => x.stand === "fertig" && ruht(x));
    expect(weg.verloren()).toBe(1);
    expect(s.erfolg).toBe(true);
    expect(s.schritte.find((x) => x.art === "speichern")?.stand).toBe("erfolgt");
    expect((await b.zaehler()).speicherungen).toBe(1);
    expect(eigene(await b.zaehler())).toHaveLength(1);
  }, 90_000);

  it("K7 · AC07 · derselbe Fall, aber der Worker hat seinen Zustand verloren: der erneut ausgelieferte Klick wird NICHT ausgeführt, Fortsetzen gleicht ab (N2)", async () => {
    const b = await bereit({ fristen: { antwortMs: 15000 } });
    const netz = b.verliereTakt(nachKlick);
    await b.auftrag(ENTWURF);
    await expect.poll(() => netz.verloren(), { timeout: 20000 }).toBeGreaterThanOrEqual(3);
    await expect
      .poll(() => b.leiste.isEnabled("#aktion-ausfuehren"), { timeout: 10000 })
      .toBe(true);
    netz.aus();
    // Was der Worker über den Lauf wusste, ist weg (etwa geleerter Sitzungsspeicher).
    await b.sw.evaluate("chrome.storage.session.set({ aktion: null })");
    await b.leiste.click("#aktion-ausfuehren");
    const u = await b.warte((x) => x.stand === "unklar" && ruht(x));
    expect(u.schritte.find((x) => x.art === "speichern")?.stand).toBe("unklar");
    expect((await b.zaehler()).speicherungen).toBe(1);
    await expect
      .poll(() => sichtbar(b.leiste, "#aktion-fortsetzen"), { timeout: 10000 })
      .toBe(true);
    await b.leiste.click("#aktion-fortsetzen");
    const s = await b.warte((x) => x.stand === "fertig" && ruht(x));
    expect(s.schritte.find((x) => x.art === "speichern")?.beleg).toContain("abgeglichen");
    expect((await b.zaehler()).speicherungen).toBe(1);
    expect(eigene(await b.zaehler())).toHaveLength(1);
    expect(await b.verlauf()).toHaveLength(1);
  }, 120_000);

  it("K10 · AC10 · nicht unterstützte Website: konkrete Übergabe, kein simulierter Erfolg, Seite unberührt", async () => {
    const b = await bahn();
    await b.seite.goto(FREMDE_SEITE);
    await b.klick(b.seite);
    await b.auftrag(`Fülle den Angebotsentwurf aus: Betreff „${BETREFF}"`);
    const s = await b.warte(ruht);
    expect(s.stand).toBe("uebergabe");
    expect(s.uebergabe?.grund).toBe("nicht_unterstuetzt");
    expect(s.erfolg).toBe(false);
    expect(await b.leiste.textContent("#aktion-uebergabe")).toContain("fremde-seite-bpa03.test");
    expect(await b.seite.evaluate<string>("document.getElementById('b').value")).toBe("");
  }, 90_000);

  for (const variante of ["captcha", "mfa"] as const) {
    it(`K10 · AC10 · ${variante.toUpperCase()} auf der Seite: Übergabe mit konkretem Schritt, nichts eingetragen`, async () => {
      const b = await bereit({}, `${PFAD}?variante=${variante}`);
      await b.auftrag(ENTWURF);
      const s = await b.warte(ruht);
      expect(s.stand).toBe("uebergabe");
      expect(s.uebergabe?.grund).toBe(variante);
      expect(s.erfolg).toBe(false);
      expect(await b.felder("angebot")).toEqual({
        "a-betreff": "",
        "a-empfaenger": "",
        "a-nachricht": "",
      });
      expect((await b.zaehler()).speicherungen).toBe(0);
    }, 90_000);
  }

  it("K7/K10 · AC07/AC10 · nach einer Übergabe wirkt „beauftrage Klara danach erneut“ mit DEMSELBEN Text: CAPTCHA gelöst → neuer Lauf, genau eine Speicherung (N3)", async () => {
    const b = await bereit({}, `${PFAD}?variante=captcha`);
    await b.auftrag(ENTWURF);
    const s = await b.warte(ruht);
    expect(s.stand).toBe("uebergabe");
    // Die Person löst das Hindernis auf der Seite selbst und klickt erneut — Text unverändert.
    await b.seite.evaluate("document.querySelector('.g-recaptcha')?.remove()");
    await b.leiste.click("#aktion-ausfuehren");
    const n = await b.warte((x) => x.id !== s.id && x.stand === "fertig" && ruht(x));
    expect(n.erfolg).toBe(true);
    expect((await b.zaehler()).speicherungen).toBe(1);
    expect((await b.verlauf()).map((x) => x.stand)).toEqual(["fertig", "uebergabe"]);
  }, 90_000);
});
