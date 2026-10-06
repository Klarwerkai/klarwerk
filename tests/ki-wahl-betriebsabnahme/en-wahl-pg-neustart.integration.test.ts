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
//   · „Prozessneustart" ist hier ein vollständiger Neuaufbau von Pool, Diensten, Reasoner und
//     Server im SELBEN Node-Prozess. Ein Betriebssystem-Neustart des Containers ist das nicht;
//     modulweite Zustände (z. B. die Modell-Semaphore) überleben ihn. Für die Frage „liegt die
//     Wahl in der Datenbank oder im Gedächtnis" ist das unerheblich — beide Instanzen teilen
//     ausschliesslich die Datenbank.
//   · Keine Produktivdaten: eine eigene Wegwerf-Datenbank (`tests/ko/pg-pruefplatz.ts`), am Ende
//     entfernt. Ohne Datenbank wirft der Aufbau (`FEHLENDER_NACHWEIS`) — kein stiller Skip.
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
const KARTE = "/admin?bereich=ki&detail=ki";

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
function stelleTransport(): void {
  const echt = globalThis.fetch;
  vi.stubGlobal("fetch", (async (url: unknown, init?: RequestInit) => {
    const pfad = String(url);
    if (pfad !== OPENAI_URL && pfad !== ANTHROPIC_URL) {
      return echt(url as Parameters<typeof fetch>[0], init);
    }
    rufe.push({ url: pfad, rumpf: typeof init?.body === "string" ? init.body : "" });
    const antwort =
      pfad === OPENAI_URL
        ? {
            choices: [{ message: { content: "VON-OPENAI" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 3, completion_tokens: 2 },
          }
        : {
            content: [{ type: "text", text: "VON-ANTHROPIC" }],
            usage: { input_tokens: 3, output_tokens: 2 },
          };
    return {
      ok: true,
      status: 200,
      json: async () => antwort,
      text: async () => JSON.stringify(antwort),
    } as unknown as Response;
  }) as unknown as typeof fetch);
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
/** Steht dieser Text irgendwo sichtbar auf der Seite? (`arg` = der Sollsatz aus dem Katalog) */
const SEITE_ENTHAELT = "(t) => document.body.innerText.includes(t)";
const STATUSZEILE = `() => { const e = document.querySelector('[data-testid="ki-status"]'); return e ? (e.textContent || "").replace(/\\s+/g, " ").trim() : ""; }`;

describe("KI-WAHL K1 · EN-Wahl in Chromium steuert den Empfänger — und überlebt PostgreSQL-Neustart", () => {
  let pg: IsoliertePg | undefined;
  let browser: Browser | undefined;
  let erste: Instanz | undefined;
  let zweite: Instanz | undefined;
  let anthropicName = "";

  beforeAll(async () => {
    // Beide Anbieter eingerichtet — Testwerte, kein Schlüsselbund, kein lokaler LLM, keine Sperre.
    vi.stubEnv("KLARWERK_SKIP_KEYCHAIN", "1");
    vi.stubEnv("OPENAI_API_KEY", "sk-test-ki-wahl-pg");
    vi.stubEnv("OPENAI_MODEL", "gpt-4o-mini");
    vi.stubEnv("OPENAI_BASE_URL", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "ant-test-ki-wahl-pg");
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
    } finally {
      await pg?.abraeumen();
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  }, 120_000);

  it("W1–W6 · Gegenprobe auto→OpenAI, EN-Wahl Claude per Tastatur, Zeile in PG, Empfänger Anthropic, Neustart, dieselbe Wahl", async () => {
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

    // ── Aufbau: Ersteinrichtung, Grundfreigabe, Regler für Weltwissen. ───────────────────────────
    const setup = new Sitzung(eins.basis, "admin-setup", "en");
    const angelegt = await setup.sende("POST", "/api/auth/setup", {
      name: "Admin",
      email: ADMIN,
      // Dasselbe Passwort, mit dem `anmelden` (weg.ts) die Maske ausfüllt.
      password: PASSWORT,
    });
    expect(angelegt.status, angelegt.text).toBe(201);
    const freigabe = await setup.sende("PUT", "/api/reasoner/config", {
      global: "auto",
      perTask: {},
      kiFreigabe: { oeffentlicheKi: true },
    });
    expect(freigabe.status, freigabe.text).toBe(200);
    await eins.services.externalKnowledge.setStage("open");
    const konfig = (await setup.sende("GET", "/api/reasoner/config")).json as {
      cloudProviders: Record<string, { configured: boolean; name?: string }>;
    };
    expect(konfig.cloudProviders.openai?.configured).toBe(true);
    expect(konfig.cloudProviders.anthropic?.configured).toBe(true);
    anthropicName = konfig.cloudProviders.anthropic?.name ?? "";
    expect(anthropicName).toMatch(/^anthropic:/);

    // ── W1 · GEGENPROBE: unter „auto" geht die Aufgabe an OpenAI. ───────────────────────────────
    let marke = rufe.length;
    expect((await anreichern(setup)).text).toBe("VON-OPENAI");
    expect(
      aufgabenRufe(marke),
      "unter auto ging die Aufgabe nicht an den Vorgabe-Anbieter",
    ).toEqual([OPENAI_URL]);

    // ── W2 · Chromium, ENGLISCH, nur Tastatur. ────────────────────────────────────────────────
    const tastatur: Record<string, number> = {};
    const p1 = await profil(chromium, BREIT, "en");
    try {
      await anmelden(p1.seite, eins.basis, ADMIN, "en_vorher", tastatur);
      await oeffneKarte(p1.seite, eins.basis);
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
        "das Speichern der Wahl hat die erteilte Freigabe verloren",
      ).toEqual({ oeffentlicheKi: true });

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
    expect(konfigNachher.text).not.toMatch(/sk-test-ki-wahl-pg|ant-test-ki-wahl-pg/);
    for (const ruf of rufe) {
      expect(ruf.rumpf).not.toMatch(/sk-test-ki-wahl-pg|ant-test-ki-wahl-pg/);
    }
    process.stderr.write(`${JOB} · Tastaturschritte: ${JSON.stringify(tastatur)}\n`);
  }, 1_800_000);
});
