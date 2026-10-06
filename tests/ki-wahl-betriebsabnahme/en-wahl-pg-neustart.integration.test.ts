// ================================================================================================
// KI-WAHL-BETRIEBSABNAHME · K1 — DIE EN-WAHL IM ECHTEN BROWSER, GEGEN POSTGRESQL, ÜBER EINEN NEUSTART.
// ================================================================================================
//
// KRITERIUM (wörtlich): „EN-Chrome-Anbieterwahl steuert den tatsächlichen Empfänger; nach
// PG-/Prozessneustart bleibt die bestätigte Auswahl erhalten."
//
// WAS ES SCHON GAB, und was es nicht schloss (Bestand bleibt unverändert):
//   · `tests/ki-anbieterwahl/persistenz-und-migration.test.ts` C1/C1b — Persistenz über eine neue
//     Reasoner-Instanz, aber gegen eine Speicherablage bzw. eine JSON-Zeile im Prozess.
//   · `tests/ki-anbieterwahl/karte-mounted.test.tsx` — die Karte in jsdom.
//   · Codex-Chrome-Prüfung 07.09. (ki-auswahl-chrome.json) — DEUTSCH; „EN-Anzeige und echter
//     Anbieterweg getrennt offen" (Quelle P-KI-WAHL).
// Die EN-Bedienung, die PostgreSQL-Zeile `reasoner_policy` und der Neustart standen nie in EINER
// Kette. Diese Datei fährt sie zusammen:
//
//   W0 · Ohne Grundfreigabe geht die Aufgabe an niemanden hinaus (Sperre).
//   W2a · Der Administrator setzt die Grundfreigabe in der EN-Fläche per Tastatur (Nacharbeit 2:
//        vorher setzte der Aufbau sie von Hand im Rumpf — das verbietet der Freigabe-Wächter F2).
//   W1 · Ausgangslage: Wahl „auto", beide Anbieter eingerichtet → der Empfänger ist ChatGPT
//        (OpenAI). Das ist die GEGENPROBE: ohne sie bewiese der spätere Anthropic-Empfänger nicht,
//        dass die Wahl etwas bewegt hat.
//   W2 · Chromium, Oberfläche ENGLISCH (gewählt im Profil, Gebietsschema bleibt de-DE — s.
//        `browserweg.ts` `profil`), Anmeldung und Wahl NUR mit der Tastatur: „External · Claude
//        (Anthropic) …" per Pfeiltaste, „Apply mapping" per Tab/Enter.
//   W3 · Die Zeile in PostgreSQL wird DIREKT am Pool gelesen: `global = anthropic`, die Freigabe
//        ist erhalten.
//   W4 · Empfänger: „Test key" in der EN-Fläche UND eine echte Aufgabe (`/api/reasoner/enrich`)
//        gehen ausschliesslich an `api.anthropic.com` — kein Ruf an OpenAI.
//   W5 · NEUSTART: Anwendung geschlossen, Pool beendet; neuer Pool, neue Dienste, neuer Reasoner,
//        derselbe Startschritt wie `services/app/src/server.ts:162` (`loadPersistedPolicy` VOR
//        `listen`), neuer Port. Quelle der Wahl: `persisted`.
//   W6 · Nach dem Neustart, frisches EN-Profil: die Karte zeigt die bestätigte Wahl, die
//        Statuszeile nennt Claude, und Probe wie Aufgabe gehen wieder an Anthropic.
//
// PRÜFGRENZEN, offen benannt:
//   · Der Anbieter antwortet aus einem gestellten Transport (`fetch` ist VOR dem Aufbau ersetzt —
//     die Clients binden ihn beim Bau). Gemessen ist der EMPFÄNGER (URL) und der Rumpf, nicht eine
//     echte Modellantwort; die reale Text-/Bildantwort je Anbieter ist K2 und bleibt Betriebsprobe.
//   · W5/W6 sind ein Neuaufbau von Pool, Diensten, Reasoner und Server im SELBEN Node-Prozess
//     (Instanzwechsel). Den PROZESSwechsel trägt W7 (Nacharbeit 3, BEN): Klarwerk als eigener
//     Betriebssystemprozess (`server.ts`) gegen dieselbe Datenbank, danach beendet und als beendet
//     nachgewiesen. Die PostgreSQL selbst wird NICHT neu gestartet (der Prüfplatz stellt sie über
//     `KLARWERK_PG_TEST_URL` oder einen Container); ebenso wenig ein Container auf dem Produktionshost.
//   W7 · Eigener Serverprozess gegen dieselbe Datenbank: Adminsicht (Quelle db, Wahl, Freigabe),
//        EN-Karte (Wahl, Freigabe-Kästchen, Statuszeile), Probe und Aufgabe an Anthropic.
//   · Keine Produktivdaten: eine eigene Wegwerf-Datenbank (`tests/ko/pg-pruefplatz.ts`), am Ende
//     entfernt. Ohne Datenbank wirft der Aufbau (`FEHLENDER_NACHWEIS`) — kein stiller Skip.
import { createServer as createHttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { anbieterUndModell } from "../../apps/web/src/lib/aiOverview";
import { type AppServices, buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { registerWebStatic } from "../../services/app/src/web-static";
import {
  type Instanz as Serverprozess,
  prozessLebt,
  starteKlarwerk,
} from "../beziehungs-restore-nutzerweg/vorrichtung";
import {
  BREIT,
  anmelden,
  browserKennung,
  mitPfeilWaehlen,
  stelleFlaecheBereit,
} from "../fassungsrueckholung-echter-browser/weg";
import {
  type Browser,
  DIST,
  LIES_TEXT,
  type Seite,
  fn,
  profil,
  starteChromium,
  tabBisZu,
  tastaturAusloesen,
  warte,
} from "../gast-nutzerweg/browserweg";
import { PASSWORT, Sitzung } from "../gast-nutzerweg/strecke";
import { type IsoliertePg, oeffneIsoliertePg } from "../ko/pg-pruefplatz";

const JOB = "[KLARWERK] KI-WAHL-BETRIEBSABNAHME K1";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ADMIN = "en-wahl@ki-wahl-pg.test";
const WAHLFELD = '[data-testid="ki-wahl-global"]';
/** Das Kästchen der Grundfreigabe für öffentliche KI (`AdminKiDetails.tsx`, JOB 3783). */
const FREIGABE_KASTEN = '[data-testid="ki-freigabe-oeffentlich"]';
const KARTE = "/admin?bereich=ki&detail=ki";
/** Das Vorlademodul für den eigenen Serverprozess (W7) — als Datei-URL, wie `--import` sie nimmt. */
const VORLADEN = new URL("./anbieterkante-vorladen.ts", import.meta.url).href;
const OPENAI_SCHLUESSEL = "sk-test-ki-wahl-pg";
const ANTHROPIC_SCHLUESSEL = "ant-test-ki-wahl-pg";

/** Die EN-Sollwerte kommen aus demselben Katalog, aus dem die Fläche zeichnet. */
const EN = (schluessel: string, werte: Record<string, unknown> = {}): string =>
  i18n.t(schluessel, { ...werte, lng: "en" });

interface Ruf {
  url: string;
  rumpf: string;
}

const rufe: Ruf[] = [];
/** Die Rufe nach draussen seit `marke` — nur die Anbieterkanten, kein lokaler Verkehr. */
const seit = (marke: number): string[] => rufe.slice(marke).map((r) => r.url);
/** Die Frage der echten Aufgabe — an ihr wird der Aufgabenruf vom Erreichbarkeits-Ping getrennt. */
const FRAGE = "What does grease do?";
/**
 * Die Rufe seit `marke`, die DIESE Aufgabe tragen.
 *
 * WARUM GEFILTERT WIRD (gemessen am Code, nicht vermutet): `GET /api/reasoner/status`, den die
 * Kopfzeile der Fläche abruft, stösst `refreshReachabilityIfStale` an (`service.ts:1081-1120`) — ein
 * Mini-Ping „Antworte mit genau einem Wort: OK" an JEDEN eingerichteten Anbieter, unabhängig von der
 * Wahl. Diese Pings sind kein Aufgabenweg und tragen keinen Nutzertext; sie mitzuzählen hiesse,
 * den Empfänger der Aufgabe an einer Hintergrundsonde zu messen.
 */
const aufgabenRufe = (marke: number): string[] =>
  rufe
    .slice(marke)
    .filter((r) => r.rumpf.includes(FRAGE))
    .map((r) => r.url);

/**
 * Der gestellte Transport. Er antwortet NUR an den beiden Anbieterkanten; alles andere (die
 * `Sitzung`-Abrufe dieses Tests an 127.0.0.1) geht unverändert an das echte `fetch`.
 */
function antwortFuer(ziel: string): unknown {
  return ziel === OPENAI_URL
    ? {
        choices: [{ message: { content: "VON-OPENAI" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 3, completion_tokens: 2 },
      }
    : {
        content: [{ type: "text", text: "VON-ANTHROPIC" }],
        usage: { input_tokens: 3, output_tokens: 2 },
      };
}

function stelleTransport(): void {
  const echt = globalThis.fetch;
  vi.stubGlobal("fetch", (async (url: unknown, init?: RequestInit) => {
    const pfad = String(url);
    if (pfad !== OPENAI_URL && pfad !== ANTHROPIC_URL) {
      return echt(url as Parameters<typeof fetch>[0], init);
    }
    rufe.push({ url: pfad, rumpf: typeof init?.body === "string" ? init.body : "" });
    const antwort = antwortFuer(pfad);
    return {
      ok: true,
      status: 200,
      json: async () => antwort,
      text: async () => JSON.stringify(antwort),
    } as unknown as Response;
  }) as unknown as typeof fetch);
}

/** Rufe aus dem EIGENEN Serverprozess (W7), die einen Schlüsselkopf mitbrachten — soll leer bleiben. */
const schluesselkoepfe: string[] = [];

interface Anbieterkante {
  basis: string;
  schliessen(): Promise<void>;
}

/**
 * Der Ersatz der Anbieterkanten für den EIGENEN Serverprozess (W7).
 *
 * Dort greift `stelleTransport` nicht — das ist ein anderer Prozess. `anbieterkante-vorladen.ts`
 * leitet im Serverprozess genau die beiden Anbieteradressen hierher um (ursprüngliche Adresse im
 * Kopf `x-kw-ziel`). Mitgeschrieben wird in DIESELBE Liste `rufe`, damit `seit`/`aufgabenRufe`
 * für beide Prozesse dasselbe messen.
 */
async function starteAnbieterkante(): Promise<Anbieterkante> {
  const server = createHttpServer((anfrage, antwort) => {
    const teile: Buffer[] = [];
    anfrage.on("data", (teil: Buffer) => teile.push(teil));
    anfrage.on("end", () => {
      const ziel = String(anfrage.headers["x-kw-ziel"] ?? "");
      rufe.push({ url: ziel, rumpf: Buffer.concat(teile).toString("utf8") });
      if (anfrage.headers.authorization || anfrage.headers["x-api-key"]) {
        schluesselkoepfe.push(ziel);
      }
      if (ziel !== OPENAI_URL && ziel !== ANTHROPIC_URL) {
        antwort.writeHead(404).end();
        return;
      }
      antwort
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify(antwortFuer(ziel)));
    });
  });
  await new Promise<void>((bereit) => server.listen(0, "127.0.0.1", () => bereit()));
  const adresse = server.address() as AddressInfo;
  return {
    basis: `http://127.0.0.1:${adresse.port}`,
    schliessen: () =>
      new Promise<void>((fertig) => {
        server.closeAllConnections();
        server.close(() => fertig());
      }),
  };
}

interface Instanz {
  app: FastifyInstance;
  services: AppServices;
  pool: Pool;
  basis: string;
  quelle: string;
  schliessen(): Promise<void>;
}

/**
 * Eine Instanz, wie `services/app/src/server.ts` sie startet: eigener Pool, `buildPgServices`,
 * die KI-Zuordnung wird VOR `listen` geladen (`server.ts:162`), die gebaute Fläche hängt daran.
 */
async function starteInstanz(url: string): Promise<Instanz> {
  const pool = createPool(url);
  const services = buildPgServices(pool);
  const geladen = await services.reasoner.loadPersistedPolicy({
    envGlobal: process.env.KLARWERK_REASONER_POLICY,
  });
  const app = buildApp(services);
  await registerWebStatic(app, DIST);
  await app.listen({ port: 0, host: "127.0.0.1" });
  const adresse = app.server.address() as AddressInfo | null;
  if (adresse === null || typeof adresse === "string") {
    await app.close();
    await pool.end();
    throw new Error(`${JOB}: der Server hat keinen Port gemeldet.`);
  }
  return {
    app,
    services,
    pool,
    basis: `http://127.0.0.1:${adresse.port}`,
    quelle: geladen.source,
    schliessen: async () => {
      try {
        await app.close();
      } finally {
        await pool.end();
      }
    },
  };
}

async function anmeldeSitzung(basis: string): Promise<Sitzung> {
  const sitzung = new Sitzung(basis, "admin-api", "en");
  const an = await sitzung.sende("POST", "/api/auth/login", { email: ADMIN, password: PASSWORT });
  expect(an.status, an.text).toBe(200);
  return sitzung;
}

/** Eine echte Aufgabe: die Anreicherung (Weltwissen) geht über die GLOBALE Wahl hinaus. */
async function anreichern(sitzung: Sitzung): Promise<{ text: string; provider: string }> {
  const antwort = await sitzung.sende("POST", "/api/reasoner/enrich", {
    query: FRAGE,
    locale: "en",
  });
  expect(antwort.status, antwort.text).toBe(200);
  return antwort.json as { text: string; provider: string };
}

async function oeffneKarte(seite: Seite, basis: string): Promise<void> {
  await seite.goto(`${basis}${KARTE}`, { waitUntil: "domcontentloaded" });
  await warte(
    seite,
    "(sel) => { const e = document.querySelector(sel); return !!e && !e.disabled && e.options.length > 2; }",
    "das globale Wahlfeld der KI-Karte steht bedienbar da",
    WAHLFELD,
    60_000,
  );
}

const WAHLWERT = `(sel) => { const e = document.querySelector(sel); return e ? String(e.value) : "(fehlt)"; }`;
const OPTIONSTEXT = `([sel, wert]) => {
  const e = document.querySelector(sel);
  const o = e ? [...e.options].find((x) => x.value === wert) : undefined;
  return o ? { text: (o.textContent || "").trim(), aus: o.disabled } : null;
}`;
/** Ist das Kästchen angehakt und nicht gesperrt? (`arg` = Selektor) */
const KASTEN_AN =
  "(sel) => { const e = document.querySelector(sel); return !!e && e.checked === true && !e.disabled; }";
/** Steht dieser Text irgendwo sichtbar auf der Seite? (`arg` = der Sollsatz aus dem Katalog) */
const SEITE_ENTHAELT = "(t) => document.body.innerText.includes(t)";
const STATUSZEILE = `() => { const e = document.querySelector('[data-testid="ki-status"]'); return e ? (e.textContent || "").replace(/\\s+/g, " ").trim() : ""; }`;

describe("KI-WAHL K1 · EN-Wahl in Chromium steuert den Empfänger — und überlebt PostgreSQL-Neustart", () => {
  let pg: IsoliertePg | undefined;
  let browser: Browser | undefined;
  let erste: Instanz | undefined;
  let zweite: Instanz | undefined;
  let serverprozess: Serverprozess | undefined;
  let anbieterkante: Anbieterkante | undefined;
  let anthropicName = "";

  beforeAll(async () => {
    // Beide Anbieter eingerichtet — Testwerte, kein Schlüsselbund, kein lokaler LLM, keine Sperre.
    vi.stubEnv("KLARWERK_SKIP_KEYCHAIN", "1");
    vi.stubEnv("OPENAI_API_KEY", OPENAI_SCHLUESSEL);
    vi.stubEnv("OPENAI_MODEL", "gpt-4o-mini");
    vi.stubEnv("OPENAI_BASE_URL", "");
    vi.stubEnv("ANTHROPIC_API_KEY", ANTHROPIC_SCHLUESSEL);
    vi.stubEnv("ANTHROPIC_MODEL", "claude-sonnet-4-6");
    vi.stubEnv("KLARWERK_LOCAL_LLM_URL", "");
    vi.stubEnv("KLARWERK_REASONER_POLICY", "");
    stelleTransport();
    pg = await oeffneIsoliertePg("kiwahl");
    const migration = createPool(pg.url);
    try {
      await migrate(migration);
    } finally {
      await migration.end();
    }
    const flaeche = stelleFlaecheBereit();
    browser = await starteChromium();
    process.stderr.write(
      `${JOB} · Prüfstand: ${pg.herkunft} · Chromium ${browserKennung(browser)} · Fläche: ${flaeche}\n`,
    );
  }, 1_200_000);

  afterAll(async () => {
    try {
      await browser?.close();
      await erste?.schliessen().catch(() => undefined);
      await zweite?.schliessen().catch(() => undefined);
      // Der eigene Serverprozess hält Verbindungen zur Datenbank — er muss VOR dem Abräumen weg sein.
      await serverprozess?.beende().catch(() => undefined);
      await anbieterkante?.schliessen().catch(() => undefined);
    } finally {
      await pg?.abraeumen();
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  }, 120_000);

  it("W0–W7 · Sperre, Freigabe in der Fläche, Gegenprobe auto→OpenAI, EN-Wahl Claude per Tastatur, Zeile in PG, Empfänger Anthropic, Instanz- und Prozesswechsel, dieselbe Wahl", async () => {
    if (!pg || !browser) {
      throw new Error(`${JOB}: der Aufbau hat keinen Prüfstand hinterlassen — nichts gemessen.`);
    }
    const db = pg;
    const chromium = browser;
    const eins = await starteInstanz(db.url);
    erste = eins;
    expect(eins.quelle, "eine frische Datenbank darf keine gespeicherte Wahl kennen").toBe(
      "default",
    );

    // ── Aufbau: Ersteinrichtung und Regler für Weltwissen. Die Grundfreigabe für öffentliche KI
    // setzt NICHT der Aufbau, sondern der Administrator in der EN-Fläche (W2a) — sie ist eine
    // namentliche Ausnahme (Freigabe-Wächter F2 in `routing-zwei-attrappen.test.ts`) und hier
    // Gegenstand, kein Aufbaudetail. ──────────────────────────────────────────────────────────
    const setup = new Sitzung(eins.basis, "admin-setup", "en");
    const angelegt = await setup.sende("POST", "/api/auth/setup", {
      name: "Admin",
      email: ADMIN,
      // Dasselbe Passwort, mit dem `anmelden` (weg.ts) die Maske ausfüllt.
      password: PASSWORT,
    });
    expect(angelegt.status, angelegt.text).toBe(201);
    await eins.services.externalKnowledge.setStage("open");
    const konfig = (await setup.sende("GET", "/api/reasoner/config")).json as {
      cloudProviders: Record<string, { configured: boolean; name?: string }>;
    };
    expect(konfig.cloudProviders.openai?.configured).toBe(true);
    expect(konfig.cloudProviders.anthropic?.configured).toBe(true);
    anthropicName = konfig.cloudProviders.anthropic?.name ?? "";
    expect(anthropicName).toMatch(/^anthropic:/);

    // ── W0 · SPERRE vor der Freigabe: dieselbe Aufgabe geht an NIEMANDEN hinaus. ─────────────────
    let marke = rufe.length;
    /** Der Freigabewert, wie ihn die Fläche in W2a gespeichert hat — Sollwert für W3. */
    let freigabeInDerZeile: unknown;
    await anreichern(setup);
    expect(
      aufgabenRufe(marke),
      "ohne Grundfreigabe ging die Aufgabe trotzdem an einen öffentlichen Anbieter",
    ).toEqual([]);

    // ── W2 · Chromium, ENGLISCH, nur Tastatur. ────────────────────────────────────────────────
    const tastatur: Record<string, number> = {};
    const p1 = await profil(chromium, BREIT, "en");
    try {
      await anmelden(p1.seite, eins.basis, ADMIN, "en_vorher", tastatur);
      await oeffneKarte(p1.seite, eins.basis);

      // ── W2a · die Grundfreigabe, gesetzt wie ein Administrator: Tab zum Kästchen, Leertaste. ──
      // Nur die Grundfreigabe; das Kästchen für vertrauliche Inhalte bleibt unberührt.
      expect(
        await p1.seite.evaluate<boolean>(fn(KASTEN_AN), FREIGABE_KASTEN),
        "Vorbedingung verletzt: die Grundfreigabe steht schon vor der Bedienung an",
      ).toBe(false);
      tastatur.freigabe = await tabBisZu(p1.seite, FREIGABE_KASTEN, 320, true);
      await p1.seite.keyboard.press(" ");
      // Das Kästchen zeichnet den VOM SERVER BESTÄTIGTEN Stand (`basis.freigabe`) und ist während
      // des Schreibens gesperrt — angehakt UND wieder bedienbar heisst: die Antwort ist da.
      // (Die Sätze der Freigabe registriert erst `AdminKiDetails.tsx` beim Laden; in diesem
      // Node-Lauf sind sie nicht auflösbar — deshalb der Zustand statt des Wortlauts.)
      await warte(
        p1.seite,
        KASTEN_AN,
        "die Grundfreigabe ist vom Server bestätigt und das Kästchen wieder bedienbar",
        FREIGABE_KASTEN,
      );
      const nachFreigabe = await eins.pool.query<{ data: { kiFreigabe?: unknown } }>(
        "SELECT data FROM reasoner_policy WHERE id = 1",
      );
      // Der gespeicherte Freigabewert wird hier nur FESTGEHALTEN (nicht ausgeschrieben) — W3
      // vergleicht ihn nach dem Speichern der Wahl mit dem, was dann in der Zeile steht.
      freigabeInDerZeile = nachFreigabe.rows[0]?.data.kiFreigabe;
      expect(
        freigabeInDerZeile,
        "die Freigabe aus der Fläche steht nicht in PostgreSQL",
      ).toBeDefined();

      // ── W1 · GEGENPROBE: mit Freigabe und „auto" geht die Aufgabe an OpenAI. ─────────────────
      marke = rufe.length;
      expect((await anreichern(setup)).text).toBe("VON-OPENAI");
      expect(
        aufgabenRufe(marke),
        "unter auto ging die Aufgabe nicht an den Vorgabe-Anbieter",
      ).toEqual([OPENAI_URL]);

      const seitentext = await p1.seite.evaluate<string>(fn(LIES_TEXT));
      expect(seitentext, "die Karte steht nicht auf Englisch").toContain(EN("adm.ai.global"));
      expect(seitentext).toContain(EN("adm.ai.save"));
      const option = await p1.seite.evaluate<{ text: string; aus: boolean } | null>(
        fn(OPTIONSTEXT),
        [WAHLFELD, "anthropic"],
      );
      expect(option, "die Auswahl kennt Claude (Anthropic) nicht").not.toBeNull();
      expect(option?.aus, "Claude ist trotz Schlüssel als nicht eingerichtet ausgegraut").toBe(
        false,
      );
      expect(option?.text).toBe(
        EN("adm.ai.choice.anbieter", { name: anbieterUndModell(anthropicName) }),
      );
      expect(await p1.seite.evaluate<string>(fn(WAHLWERT), WAHLFELD)).toBe("auto");
      // auto → openai → anthropic: zwei Pfeilanschläge, der Wert wird AM FELD nachgelesen.
      await mitPfeilWaehlen(p1.seite, WAHLFELD, "Global", 2, "anthropic", tastatur);
      await warte(
        p1.seite,
        SEITE_ENTHAELT,
        "der Hinweis „noch nicht übernommen“ erscheint auf Englisch",
        EN("adm.ai.dirtyHint"),
      );
      tastatur.uebernehmen = await tastaturAusloesen(p1.seite, EN("adm.ai.save"));
      await warte(
        p1.seite,
        SEITE_ENTHAELT,
        "die Übernahme wird auf Englisch bestätigt",
        EN("adm.ai.saved"),
      );

      // ── W3 · die Zeile in PostgreSQL, direkt am Pool gelesen. ───────────────────────────────
      const zeile = await eins.pool.query<{ data: { global: string; kiFreigabe?: unknown } }>(
        "SELECT data FROM reasoner_policy WHERE id = 1",
      );
      expect(zeile.rows[0]?.data.global, "in PostgreSQL steht nicht die gewählte Claude-Wahl").toBe(
        "anthropic",
      );
      expect(
        zeile.rows[0]?.data.kiFreigabe,
        "das Speichern der Wahl hat die in der Fläche erteilte Freigabe verändert",
      ).toEqual(freigabeInDerZeile);

      // ── W4 · Empfänger: die Probe aus der EN-Fläche und eine echte Aufgabe. ────────────────
      marke = rufe.length;
      tastatur.probe = await tastaturAusloesen(p1.seite, EN("adm.ai.test"));
      await warte(
        p1.seite,
        SEITE_ENTHAELT,
        "die Probe meldet auf Englisch, dass Claude geantwortet hat",
        EN("adm.ai.testOk", { provider: anbieterUndModell(anthropicName) }),
      );
      // Die Probe trägt keinen eigenen Inhalt (derselbe Ping wie die Hintergrundsonde) — ihr
      // Empfänger steht deshalb in der Antwort, die die Fläche gerade auf Englisch zeigt
      // (`probe()` meldet `provider.name` des GEPRÜFTEN Clients), und auf dem Draht muss seit dem
      // Klick mindestens ein Ruf an Anthropic stehen.
      expect(seit(marke), "seit dem Klick auf „Test key“ ging nichts an Anthropic").toContain(
        ANTHROPIC_URL,
      );
      marke = rufe.length;
      expect((await anreichern(setup)).text).toBe("VON-ANTHROPIC");
      expect(
        aufgabenRufe(marke),
        "die Aufgabe ging nach der EN-Wahl nicht (nur) an Anthropic",
      ).toEqual([ANTHROPIC_URL]);
    } finally {
      await p1.kontext.close();
    }

    // ── W5 · NEUSTART: alles weg ausser der Datenbank. ───────────────────────────────────────
    const alterPlatz = eins.basis;
    await eins.schliessen();
    erste = undefined;
    const zwei = await starteInstanz(db.url);
    zweite = zwei;
    expect(zwei.basis, "der Neustart horcht am alten Platz").not.toBe(alterPlatz);
    expect(zwei.quelle, "nach dem Neustart kam die Wahl nicht aus der Persistenz").toBe(
      "persisted",
    );
    const nachStart = zwei.services.reasoner.configStatus();
    expect(nachStart.taskConfig.global).toBe("anthropic");
    expect(nachStart.policySource).toBe("db");
    expect(nachStart.provider).toBe(anthropicName);

    // ── W6 · frisches EN-Profil an der neuen Instanz: Anzeige UND Empfänger. ───────────────────
    const p2 = await profil(chromium, BREIT, "en");
    try {
      await anmelden(p2.seite, zwei.basis, ADMIN, "en_nachher", tastatur);
      await oeffneKarte(p2.seite, zwei.basis);
      expect(
        await p2.seite.evaluate<string>(fn(WAHLWERT), WAHLFELD),
        "nach dem Neustart zeigt die Karte nicht die bestätigte Wahl",
      ).toBe("anthropic");
      const status = await p2.seite.evaluate<string>(fn(STATUSZEILE));
      expect(status, "die Statuszeile nennt nach dem Neustart nicht Claude").toContain(
        anbieterUndModell(anthropicName),
      );
      expect(
        await p2.seite.evaluate<string>(fn(LIES_TEXT)),
        "nach dem Neustart steht ein nicht übernommener Entwurf da",
      ).not.toContain(EN("adm.ai.dirtyHint"));
      // Und die in W2a erteilte Freigabe gilt nach dem Neustart weiter — das Kästchen zeichnet den
      // geladenen, bestätigten Stand der neuen Instanz.
      expect(
        await p2.seite.evaluate<boolean>(fn(KASTEN_AN), FREIGABE_KASTEN),
        "nach dem Neustart steht die Grundfreigabe nicht mehr an",
      ).toBe(true);
      marke = rufe.length;
      tastatur.probeNachher = await tastaturAusloesen(p2.seite, EN("adm.ai.test"));
      await warte(
        p2.seite,
        SEITE_ENTHAELT,
        "die Probe nach dem Neustart meldet Claude",
        EN("adm.ai.testOk", { provider: anbieterUndModell(anthropicName) }),
      );
      expect(seit(marke), "seit dem Klick nach dem Neustart ging nichts an Anthropic").toContain(
        ANTHROPIC_URL,
      );
    } finally {
      await p2.kontext.close();
    }
    marke = rufe.length;
    const sitzungNeu = await anmeldeSitzung(zwei.basis);
    expect((await anreichern(sitzungNeu)).text).toBe("VON-ANTHROPIC");
    expect(
      aufgabenRufe(marke),
      "die Aufgabe nach dem Neustart ging nicht (nur) an Anthropic",
    ).toEqual([ANTHROPIC_URL]);

    // Kein Schlüssel hat je einen Anbieterrumpf oder die Admin-Antwort erreicht.
    const konfigNachher = await sitzungNeu.sende("GET", "/api/reasoner/config");
    expect(konfigNachher.text).not.toContain(OPENAI_SCHLUESSEL);
    expect(konfigNachher.text).not.toContain(ANTHROPIC_SCHLUESSEL);

    // ── W7 · ECHTER PROZESSWECHSEL (BEN, Nacharbeit 3: „W5 belegt nur Instanzwechsel"). ────────────
    //
    // Die In-Prozess-Instanz wird geschlossen, ihr Pool beendet — danach existiert vom bisherigen
    // Lauf nur noch die PostgreSQL-Datenbank. Klarwerk startet als EIGENER Betriebssystemprozess
    // (`node --import tsx services/app/src/server.ts`, Startweg `starteKlarwerk` aus
    // `tests/beziehungs-restore-nutzerweg/vorrichtung.ts`, NODE_ENV=production) gegen DIESE Datenbank
    // und lädt die Wahl über seinen eigenen Startschritt (`server.ts:162`). Er erbt keine Umgebung
    // des Testprozesses; Schlüssel und Modelle kommen ausdrücklich mit, die Wahl NICHT
    // (`KLARWERK_REASONER_POLICY` fehlt) — sie kann nur aus der Datenbank kommen.
    // Der Anbieterweg des Prozesses endet am lokalen Ersatz (`anbieterkante-vorladen.ts`), nicht im Netz.
    await zwei.schliessen();
    zweite = undefined;
    const kante = await starteAnbieterkante();
    anbieterkante = kante;
    const prozess = await starteKlarwerk({
      datenbankUrl: db.url,
      was: "KI-WAHL W7 · eigener Serverprozess",
      zusatz: {
        importe: [VORLADEN],
        env: {
          KLARWERK_TEST_ANBIETERKANTE: kante.basis,
          OPENAI_API_KEY: OPENAI_SCHLUESSEL,
          OPENAI_MODEL: "gpt-4o-mini",
          ANTHROPIC_API_KEY: ANTHROPIC_SCHLUESSEL,
          ANTHROPIC_MODEL: "claude-sonnet-4-6",
        },
      },
    });
    serverprozess = prozess;
    expect(prozess.pid, "der „neue Prozess“ ist der Testprozess selbst").not.toBe(process.pid);
    expect(prozess.basis, "der Prozess horcht am Platz der alten Instanz").not.toBe(zwei.basis);
    process.stderr.write(`${JOB} · W7 · eigener Serverprozess pid ${prozess.pid}\n`);

    // Die Wahl, wie der NEUE Prozess sie geladen hat — über seine Adminsicht, nicht über die Zeile.
    const sitzungProzess = await anmeldeSitzung(prozess.basis);
    const konfigProzess = (await sitzungProzess.sende("GET", "/api/reasoner/config")).json as {
      taskConfig: { global: string; kiFreigabe?: unknown };
      policySource: string;
      persisted: boolean;
      provider: string;
    };
    expect(konfigProzess.policySource, "der Prozess hat die Wahl nicht aus der DB").toBe("db");
    expect(konfigProzess.persisted).toBe(true);
    expect(konfigProzess.taskConfig.global, "der Prozess kennt die Claude-Wahl nicht").toBe(
      "anthropic",
    );
    expect(
      konfigProzess.taskConfig.kiFreigabe,
      "der Prozess kennt die in der Fläche erteilte Freigabe nicht",
    ).toEqual(freigabeInDerZeile);
    expect(konfigProzess.provider).toBe(anthropicName);

    // Anzeige im frischen EN-Profil, am neuen Prozess.
    const p3 = await profil(chromium, BREIT, "en");
    try {
      await anmelden(p3.seite, prozess.basis, ADMIN, "en_prozess", tastatur);
      await oeffneKarte(p3.seite, prozess.basis);
      expect(
        await p3.seite.evaluate<string>(fn(WAHLWERT), WAHLFELD),
        "der neue Prozess zeigt nicht die bestätigte Wahl",
      ).toBe("anthropic");
      expect(
        await p3.seite.evaluate<boolean>(fn(KASTEN_AN), FREIGABE_KASTEN),
        "der neue Prozess zeigt die Grundfreigabe nicht an",
      ).toBe(true);
      expect(
        await p3.seite.evaluate<string>(fn(STATUSZEILE)),
        "die Statuszeile des neuen Prozesses nennt nicht Claude",
      ).toContain(anbieterUndModell(anthropicName));
      marke = rufe.length;
      tastatur.probeProzess = await tastaturAusloesen(p3.seite, EN("adm.ai.test"));
      await warte(
        p3.seite,
        SEITE_ENTHAELT,
        "die Probe im neuen Prozess meldet Claude",
        EN("adm.ai.testOk", { provider: anbieterUndModell(anthropicName) }),
      );
      expect(seit(marke), "seit dem Klick im neuen Prozess ging nichts an Anthropic").toContain(
        ANTHROPIC_URL,
      );
    } finally {
      await p3.kontext.close();
    }

    // Der Aufgabenempfänger des neuen Prozesses.
    marke = rufe.length;
    expect((await anreichern(sitzungProzess)).text).toBe("VON-ANTHROPIC");
    expect(
      aufgabenRufe(marke),
      "die Aufgabe im neuen Prozess ging nicht (nur) an Anthropic",
    ).toEqual([ANTHROPIC_URL]);
    const konfigProzessText = (await sitzungProzess.sende("GET", "/api/reasoner/config")).text;
    expect(konfigProzessText).not.toContain(OPENAI_SCHLUESSEL);
    expect(konfigProzessText).not.toContain(ANTHROPIC_SCHLUESSEL);
    expect(schluesselkoepfe, "ein Schlüsselkopf hat die Ersatzkante erreicht").toEqual([]);

    // Und der Prozess ist danach WIRKLICH weg — es war kein Gast im Testprozess.
    await prozess.beende();
    expect(prozessLebt(prozess.pid), "der Serverprozess lebt nach dem Beenden weiter").toBe(false);

    // Kein Schlüssel hat je einen Anbieterrumpf erreicht — beide Prozesse.
    for (const ruf of rufe) {
      expect(ruf.rumpf).not.toContain(OPENAI_SCHLUESSEL);
      expect(ruf.rumpf).not.toContain(ANTHROPIC_SCHLUESSEL);
    }
    process.stderr.write(`${JOB} · Tastaturschritte: ${JSON.stringify(tastatur)}\n`);
  }, 1_800_000);
});
