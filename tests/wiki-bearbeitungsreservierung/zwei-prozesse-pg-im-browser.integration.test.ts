// ================================================================================================
// WIKI-BEARBEITUNGSRESERVIERUNG · K6 — ZWEI ECHTE BROWSER, ZWEI APP-PROZESSE, EINE POSTGRESQL.
// ================================================================================================
//
// DIE KETTE, die diese Datei misst:
//
//     Chromium (Anna) → App-Prozess 1 (`node … services/app/src/server.ts`) ─┐
//                                                                             ├→ PostgreSQL
//     Chromium (Bernd, Lea) → App-Prozess 2 (`node … server.ts`, eigener Port) ┘
//
// Zwei ECHTE Serverprozesse — nicht zwei `buildApp` in einem Prozess — gegen DIESELBE Wegwerf-
// Datenbank. Was Anna über Prozess 1 anmeldet, muss Bernd über Prozess 2 sehen: das geht nur, wenn
// der Hinweis in der Datenbank liegt. Eine prozesslokale Ablage bliebe hier unsichtbar.
//
//   P1  Beginn und Anzeige über Prozessgrenzen: Anna beginnt über den gewöhnlichen Bearbeitungsweg
//       (Menü „…" → „Bearbeiten", nur Tastatur); Bernd (schmal, Englisch) und Lea (Leserin, schmal,
//       Niederländisch) sehen den Hinweis — ohne Kontaktdaten, ohne waagrechten Überlauf. Die Zeile
//       wird unabhängig am Pool nachgelesen.
//   P2  Kohärenz-Gegenprobe: die Zeile wird AM POOL entfernt → Bernds Prozess meldet das Ende (er
//       liest also die Datenbank, nicht sein Gedächtnis); Annas nächste Erneuerung setzt sie wieder.
//   P3  Paralleles Speichern: Anna und Bernd bearbeiten, beide drücken im selben Augenblick
//       „Speichern" — genau eine Fassung gewinnt, die andere bekommt den Konflikt und behält ihren
//       Text; am Pool steht nur der Gewinner, die Fassung stieg um genau eins. Abbrechen nimmt den
//       Hinweis des Verlierers, der Gewinner sieht das Ende.
//   P4  Ablauf: Annas Verbindung reisst ab (Profil offline). Ihre Fläche sagt es, ihr Text bleibt;
//       Bernd sieht den Hinweis nach Ablauf (Serverzeit, 120 s) verschwinden. Verbindung zurück:
//       Anna meldet sich neu an, ihr Text steht noch da, Bernd sieht sie wieder.
//   P5  Neustart von Prozess 1: gespeicherte Inhalte überleben, Annas Seite liest sie neu.
//   P6  Rollenentzug: Bernd bearbeitet, wird zum Leser gemacht → seine Erneuerung wird abgewiesen,
//       die Fläche sagt es, sein Text bleibt; aus seiner Seite heraus ist Anmelden 403. Danach
//       Zugang beendet → auch Lesen des Hinweises ist 401.
//
// PRÜFGRENZE, LAUT GEMELDET (Bauform `tests/wiki-diskussion-nutzerweg/…pg-im-browser…`): ohne
// erreichbare PostgreSQL wird der Grund SICHTBAR gemeldet und übersprungen — dann ist K6 NICHT
// belegt. KEINE PRODUKTIVDATEN: ausschliesslich eine Wegwerf-Datenbank mit `test` im Namen.
import { type ChildProcess, spawn } from "node:child_process";
import { createServer } from "node:net";
import { join } from "node:path";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  anmelden,
  browserKennung,
  mitTaste,
  stelleFlaecheBereit,
  zuElement,
} from "../fassungsrueckholung-echter-browser/weg";
import {
  type Browser,
  type Kontext,
  SCHMAL,
  type Seite,
  fn,
  profil,
  starteChromium,
  tippeMitTastatur,
  warte,
} from "../gast-nutzerweg/browserweg";
import { PASSWORT, Sitzung, gastAnlegen, mussGelingen } from "../gast-nutzerweg/strecke";
import { stelleTrigrammErweiterungSicher } from "../office-pg-abnahme/rueckweg-erwartung";

const JOB = "[KLARWERK] BEARBEITUNGSRESERVIERUNG K6";
const WURZEL = join(__dirname, "..", "..");
const PG_SCHEMA = "postgresql:";
const BREIT = { width: 1280, height: 900 };

const TITEL = "Druckprobe Leitung 7 (Bearbeitungshinweis)";
const ANNA = { name: "Anna Reservierung", email: "anna@reservierung-k6.test" };
const BERND = { name: "Bernd Reservierung", email: "bernd@reservierung-k6.test" };
const LEA = { name: "Lea Leserin", email: "lea@reservierung-k6.test" };
const MARKE_A = " ᚨᚾᚾᚨK6";
const MARKE_B = " ᛒᛖᚱᚾᛞK6";
const MARKE_A2 = " ᚨᛒᛚᚨᚢᚠK6";

const T = {
  de: i18n.getFixedT("de"),
  en: i18n.getFixedT("en"),
  nl: i18n.getFixedT("nl"),
};

function ohneGeheimnis(url: string): string {
  return url.replace(/\/\/[^@/]*@/, "//<anmeldung>@");
}

function mitDatenbank(url: string, datenbank: string): string {
  if (!datenbank.toLowerCase().includes("test")) {
    throw new Error(`${JOB}: „${datenbank}" trägt kein „test" im Namen.`);
  }
  const u = new URL(url.replace(/^postgres(ql)?:/, "http:"));
  u.pathname = `/${datenbank}`;
  return `${PG_SCHEMA}${u.toString().slice("http:".length)}`;
}

function freierPort(): Promise<number> {
  return new Promise((ok, fehler) => {
    const s = createServer();
    s.once("error", fehler);
    s.listen(0, "127.0.0.1", () => {
      const adresse = s.address();
      const port = typeof adresse === "object" && adresse ? adresse.port : 0;
      s.close(() => ok(port));
    });
  });
}

// ------------------------------------------------------------------------------------------------
// DER ECHTE SERVERPROZESS — `server.ts`, wie im Betrieb, mit einer von Hand gebauten Umgebung.
// ------------------------------------------------------------------------------------------------

interface Prozess {
  name: string;
  port: number;
  basis: string;
  kind: ChildProcess;
  ausgabe: () => string;
}

async function starteProzess(name: string, datenbankUrl: string, port: number): Promise<Prozess> {
  let puffer = "";
  const kind = spawn("node", ["--import", "tsx", "services/app/src/server.ts"], {
    cwd: WURZEL,
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      TMPDIR: process.env.TMPDIR ?? "/tmp",
      KLARWERK_SKIP_KEYCHAIN: "1",
      NODE_ENV: "test",
      DATABASE_URL: datenbankUrl,
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const nimm = (d: Buffer): void => {
    puffer = `${puffer}${d.toString("utf8")}`.slice(-6000);
  };
  kind.stdout?.on("data", nimm);
  kind.stderr?.on("data", nimm);
  const basis = `http://127.0.0.1:${port}`;
  const ende = Date.now() + 120_000;
  while (Date.now() < ende) {
    if (kind.exitCode !== null) {
      throw new Error(`${JOB}: ${name} endete beim Start (Code ${kind.exitCode}):\n${puffer}`);
    }
    try {
      const antwort = await fetch(`${basis}/`);
      if (antwort.status === 200) {
        return { name, port, basis, kind, ausgabe: () => puffer };
      }
    } catch {
      // noch nicht bereit
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  kind.kill("SIGKILL");
  throw new Error(`${JOB}: ${name} wurde in 120 s nicht bereit:\n${puffer}`);
}

async function beende(p: Prozess | undefined): Promise<void> {
  if (!p || p.kind.exitCode !== null) {
    return;
  }
  const weg = new Promise<void>((ok) => p.kind.once("exit", () => ok()));
  p.kind.kill("SIGTERM");
  const frist = setTimeout(() => p.kind.kill("SIGKILL"), 10_000);
  await weg;
  clearTimeout(frist);
}

// ------------------------------------------------------------------------------------------------
// SONDEN IN DER SEITE
// ------------------------------------------------------------------------------------------------

const GIBT_ES = "(sel) => !!document.querySelector(sel)";
const FEHLT = "(sel) => !document.querySelector(sel)";
const TEXT_VON = `(sel) => {
  const e = document.querySelector(sel);
  return e === null ? null : (e.textContent || "").replace(/\\s+/g, " ").trim();
}`;
const TRAEGT = `(a) => {
  const e = document.querySelector(a[0]);
  return !!e && (e.textContent || "").includes(a[1]);
}`;
const WERT_VON = `(sel) => {
  const e = document.querySelector(sel);
  return e ? String(e.value) : null;
}`;
const UEBERLAUF =
  "() => document.documentElement.scrollWidth - document.documentElement.clientWidth";
const SEITENTEXT = "() => document.body.innerText";
/** Ein Aufruf AUS der Seite, mit genau den Keksen dieses Profils. */
const AUFRUF = `(a) => fetch(a.url, { method: a.methode, credentials: "include" })
  .then((r) => r.status).catch(() => -1)`;

/** Was die Speicherfläche gerade sagt — die Diagnose, wenn ein Ausgang ausbleibt. */
const SPEICHERLAGE = `() => {
  const q = (sel) => document.querySelector(sel);
  const t = (sel) => { const e = q(sel); return e ? (e.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 300) : null; };
  const knopf = q('[data-testid="bib-speichern"]');
  const aktiv = document.activeElement;
  return JSON.stringify({
    speichernKnopf: knopf ? { disabled: knopf.disabled, text: knopf.textContent } : null,
    einreichenKnopf: !!q('[data-testid="bib-einreichen"]'),
    fokus: aktiv ? aktiv.tagName + " " + (aktiv.getAttribute("data-testid") || "") : null,
    lage: t('[data-testid="bib-speichern-lage"]'),
    lageArt: q('[data-testid="bib-speichern-lage"]')?.getAttribute("data-lage") ?? null,
    fehler: t('[data-testid="bib-speichern-fehler"]'),
    aussage: q('[data-testid="bib-lesen"] textarea')?.value ?? null,
  });
}`;
const text = (seite: Seite, sel: string): Promise<string | null> =>
  seite.evaluate<string | null>(fn(TEXT_VON), sel);
const wert = (seite: Seite, sel: string): Promise<string | null> =>
  seite.evaluate<string | null>(fn(WERT_VON), sel);

const FREMD = '[data-testid="bib-bearbeitung-fremd"]';
const BEENDET = '[data-testid="bib-bearbeitung-beendet"]';
const EIGEN = '[data-testid="bib-bearbeitung-eigen"]';
// Das Aussagefeld ist die ERSTE `textarea` der Lesefläche im Bearbeiten (vor ihr steht nur das
// Titelfeld, ein `input`). Keine eigene Kennung am Produkt: das Feld ist ein im Register
// `tests/structure/kd-capture-doppelungen.test.ts` geführter Doppelblock mit dem Erfassen.
const AUSSAGE = '[data-testid="bib-lesen"] textarea';
const SPEICHERN = '[data-testid="bib-speichern"]';
const ABBRECHEN = '[data-testid="bib-bearbeiten-abbrechen"]';
const KONFLIKT = '[data-testid="bib-speichern-lage"][data-lage="stale"]';

async function oeffneEintrag(seite: Seite, basis: string, koId: string): Promise<void> {
  await seite.goto(`${basis}/wissen/${koId}`, { waitUntil: "domcontentloaded" });
  await warte(
    seite,
    "(t) => document.body.innerText.includes(t)",
    `„${TITEL}" steht da`,
    TITEL,
    60_000,
  );
}

/** Der gewöhnliche Bearbeitungsweg: Menü „…" → „Bearbeiten", nur mit der Tastatur. */
async function beginneBearbeiten(
  seite: Seite,
  marke: string,
  tastatur: Record<string, number>,
): Promise<void> {
  await mitTaste(seite, '[data-testid="bib-eintrag-menue"]', `${marke}_menue`, tastatur);
  await warte(
    seite,
    GIBT_ES,
    `${marke}: Menüpunkt „Bearbeiten"`,
    '[data-testid="bib-menue-bearbeiten"]',
  );
  await mitTaste(seite, '[data-testid="bib-menue-bearbeiten"]', `${marke}_bearbeiten`, tastatur);
  await warte(seite, GIBT_ES, `${marke}: das Formular steht offen`, AUSSAGE);
}

interface Zeile {
  nutzer_name: string;
  abgelaufen: boolean;
}
async function zeilenAmPool(pool: Pool, koId: string): Promise<Zeile[]> {
  const res = await pool.query<Zeile>(
    "SELECT nutzer_name, (bis <= now()) AS abgelaufen FROM ko_bearbeitungen WHERE ko_id=$1 ORDER BY nutzer_name",
    [koId],
  );
  return res.rows;
}
async function stehtAmPool(
  pool: Pool,
  koId: string,
): Promise<{ statement: string; version: number }> {
  const res = await pool.query<{ data: { statement: string; version: number } }>(
    "SELECT data FROM kos WHERE id=$1",
    [koId],
  );
  const d = res.rows[0]?.data;
  if (!d) {
    throw new Error(`${JOB}: der Eintrag ${koId} steht nicht am Pool.`);
  }
  return { statement: d.statement, version: d.version };
}

type Laufzustand = { gelaufen: true; quelle: string } | { gelaufen: false; grund: string };

describe("K6 · Bearbeitungshinweis mit zwei echten Browsern, zwei App-Prozessen und PostgreSQL", () => {
  let verwaltung: Pool | undefined;
  let container: StartedTestContainer | undefined;
  let laufzustand: Laufzustand | undefined;
  let datenbankUrl = "";
  let browser: Browser | undefined;
  const prozesse: Prozess[] = [];
  const kontexte: Kontext[] = [];
  const datenbank = `klarwerk_reservierung_test_${`${Date.now()}`.slice(-9)}`;
  const protokoll: string[] = [];

  function melde(): void {
    if (!laufzustand) {
      process.stderr.write(`${JOB}: KEIN LAUFZUSTAND — beforeAll lief nicht durch.\n`);
    } else if (laufzustand.gelaufen) {
      process.stderr.write(`${JOB} GELAUFEN gegen ${laufzustand.quelle}.\n`);
    } else {
      process.stderr.write(
        `${JOB} ÜBERSPRUNGEN — Grund: ${laufzustand.grund}. K6 ist damit NICHT belegt.\n`,
      );
    }
  }

  beforeAll(async () => {
    let url = "";
    let quelle = "";
    let grund = "";
    const lokal = guardedLocalPgTestUrl();
    if (lokal) {
      url = lokal;
      quelle = `lokale Testinstanz · ${ohneGeheimnis(lokal)}`;
    } else if (process.env.KLARWERK_PG_TEST_URL) {
      grund = "KLARWERK_PG_TEST_URL wurde von der Testdatenbank-Sicherung abgelehnt";
    } else {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
        url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
        quelle = `Testcontainer postgres:16-alpine · ${ohneGeheimnis(url)}`;
      } catch (fehler) {
        grund = `weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar: ${String(fehler)}`;
      }
    }
    if (url) {
      verwaltung = new Pool({ connectionString: url });
      let erreichbar = false;
      try {
        await verwaltung.query("SELECT 1");
        erreichbar = true;
      } catch (fehler) {
        grund = `Datenbank nicht erreichbar: ${String(fehler)}`;
      }
      if (erreichbar) {
        // AB HIER WIRD NICHTS MEHR GEFANGEN.
        await verwaltung.query(`CREATE DATABASE ${datenbank}`);
        datenbankUrl = mitDatenbank(url, datenbank);
        const aufbau = new Pool({ connectionString: datenbankUrl });
        try {
          await stelleTrigrammErweiterungSicher(aufbau);
          await migrate(aufbau);
        } finally {
          await aufbau.end();
        }
        protokoll.push(`Fläche: ${stelleFlaecheBereit()}`);
        browser = await starteChromium();
        protokoll.push(`Chromium ${browserKennung(browser)}`);
        laufzustand = { gelaufen: true, quelle };
      }
    }
    if (!laufzustand) {
      laufzustand = { gelaufen: false, grund };
    }
    melde();
  }, 1_800_000);

  afterAll(async () => {
    for (const k of kontexte) {
      await k.close().catch(() => undefined);
    }
    await browser?.close();
    for (const p of prozesse) {
      await beende(p).catch(() => undefined);
    }
    await verwaltung
      ?.query(`DROP DATABASE IF EXISTS ${datenbank} WITH (FORCE)`)
      .catch(() => undefined);
    await verwaltung?.end();
    await container?.stop();
    if (protokoll.length > 0) {
      process.stderr.write(`${JOB} · PROTOKOLL:\n${protokoll.join("\n")}\n`);
    }
  }, 180_000);

  it("K0 · der Lauf bezeugt seinen Zustand — übersprungen ist von gelaufen unterscheidbar", () => {
    melde();
    expect(laufzustand).toBeDefined();
    if (laufzustand?.gelaufen) {
      expect(browser).toBeDefined();
    } else {
      expect((laufzustand as { grund: string }).grund.length).toBeGreaterThan(0);
    }
  });

  it("P1–P6 · Beginn, Anzeige, Kohärenz, paralleles Speichern, Ablauf, Neustart, Rechteentzug", async (ctx) => {
    if (!laufzustand?.gelaufen || !browser || !verwaltung) {
      melde();
      ctx.skip();
      return;
    }
    const pool = new Pool({ connectionString: datenbankUrl });
    const tastatur: Record<string, number> = {};
    try {
      // ══ ZWEI ECHTE APP-PROZESSE GEGEN DIESELBE DATENBANK ══════════════════════════════════════
      const port1 = await freierPort();
      const port2 = await freierPort();
      let p1 = await starteProzess("Prozess 1", datenbankUrl, port1);
      prozesse.push(p1);
      const p2 = await starteProzess("Prozess 2", datenbankUrl, port2);
      prozesse.push(p2);
      expect(p1.kind.pid).not.toBe(p2.kind.pid);
      protokoll.push(
        `Prozess 1 pid ${p1.kind.pid} :${port1} · Prozess 2 pid ${p2.kind.pid} :${port2}`,
      );

      // ══ KONTEN UND EINTRAG — über den echten Produktweg an Prozess 1 ═════════════════════════
      const admin = new Sitzung(p1.basis, "admin");
      mussGelingen(
        "Ersteinrichtung",
        await admin.sende("POST", "/api/auth/setup", {
          name: "Admin",
          email: "admin@reservierung-k6.test",
          password: PASSWORT,
        }),
        201,
      );
      const annaKonto = mussGelingen(
        "Anna anlegen",
        await gastAnlegen(admin, { ...ANNA, role: "experte" }),
        201,
      ).json as { id: string };
      const berndKonto = mussGelingen(
        "Bernd anlegen",
        await gastAnlegen(admin, { ...BERND, role: "experte" }),
        201,
      ).json as { id: string };
      mussGelingen("Lea anlegen", await gastAnlegen(admin, { ...LEA, role: "viewer" }), 201);
      const angelegt = mussGelingen(
        "Eintrag anlegen",
        await admin.sende("POST", "/api/kos", {
          confidentiality: "intern",
          title: TITEL,
          statement: "Leitung 7 vor der Druckprobe entlüften.",
          type: "best_practice",
          category: "Wartung",
        }),
        201,
      );
      const koId = (angelegt.json as { id: string }).id;
      const start = await stehtAmPool(pool, koId);

      // ══ DREI BROWSERPROFILE — Anna an Prozess 1, Bernd und Lea an Prozess 2 ══════════════════
      const a = await profil(browser, BREIT, "de");
      const b = await profil(browser, SCHMAL, "en");
      const l = await profil(browser, SCHMAL, "nl");
      kontexte.push(a.kontext, b.kontext, l.kontext);
      await anmelden(a.seite, p1.basis, ANNA.email, "anna", tastatur);
      await anmelden(b.seite, p2.basis, BERND.email, "bernd", tastatur);
      await anmelden(l.seite, p2.basis, LEA.email, "lea", tastatur);
      await oeffneEintrag(a.seite, p1.basis, koId);
      await oeffneEintrag(b.seite, p2.basis, koId);
      await oeffneEintrag(l.seite, p2.basis, koId);

      // ══ P1 · BEGINN UND ANZEIGE ÜBER PROZESSGRENZEN ══════════════════════════════════════════
      await beginneBearbeiten(a.seite, "anna", tastatur);
      await warte(
        b.seite,
        TRAEGT,
        "Bernd (Prozess 2) sieht Annas Bearbeitung",
        [FREMD, ANNA.name],
        20_000,
      );
      await warte(
        l.seite,
        TRAEGT,
        "Lea (Leserin, Prozess 2) sieht Annas Bearbeitung",
        [FREMD, ANNA.name],
        20_000,
      );
      const hinweisEn = (await text(b.seite, FREMD)) ?? "";
      expect(hinweisEn).toContain(T.en("bearbeitung.titel"));
      expect(hinweisEn).toContain(T.en("bearbeitung.erklaerung", { minuten: 2 }));
      const hinweisNl = (await text(l.seite, FREMD)) ?? "";
      expect(hinweisNl).toContain(T.nl("bearbeitung.erklaerung", { minuten: 2 }));
      for (const s of [b.seite, l.seite]) {
        expect(await s.evaluate<string>(fn(SEITENTEXT))).not.toContain(ANNA.email);
        expect(
          await s.evaluate<number>(fn(UEBERLAUF)),
          "schmale Ansicht ohne waagrechten Überlauf",
        ).toBeLessThanOrEqual(0);
      }
      expect(await zeilenAmPool(pool, koId)).toEqual([
        { nutzer_name: ANNA.name, abgelaufen: false },
      ]);
      protokoll.push(
        "P1 · Beginn über Prozess 1, Anzeige über Prozess 2 (EN, NL, schmal) — gemessen",
      );

      // ══ P2 · KOHÄRENZ-GEGENPROBE: DIE DATENBANK IST DIE QUELLE ═══════════════════════════════
      await pool.query("DELETE FROM ko_bearbeitungen WHERE ko_id=$1", [koId]);
      await warte(
        b.seite,
        FEHLT,
        "Prozess 2 sieht die am Pool entfernte Zeile nicht mehr",
        FREMD,
        20_000,
      );
      await warte(b.seite, GIBT_ES, "Bernd bekommt den Satz über das Ende", BEENDET, 5_000);
      // Annas nächste Erneuerung (Takt 30 s) setzt die Zeile über Prozess 1 wieder.
      await warte(
        b.seite,
        TRAEGT,
        "Annas Erneuerung erscheint wieder bei Bernd",
        [FREMD, ANNA.name],
        50_000,
      );
      protokoll.push(
        "P2 · Kohärenz-Gegenprobe: Löschung am Pool wirkt in Prozess 2, Erneuerung über Prozess 1 kommt an",
      );

      // ══ P3 · PARALLELES SPEICHERN ═════════════════════════════════════════════════════════════
      await tippeMitTastatur(a.seite, AUSSAGE, MARKE_A, "Aussage (Anna)");
      await beginneBearbeiten(b.seite, "bernd", tastatur);
      await tippeMitTastatur(b.seite, AUSSAGE, MARKE_B, "Aussage (Bernd)");
      await warte(a.seite, TRAEGT, "Anna sieht Bernds Bearbeitung", [FREMD, BERND.name], 20_000);
      tastatur.anna_speichern = await zuElement(a.seite, SPEICHERN, "Speichern (Anna)");
      tastatur.bernd_speichern = await zuElement(b.seite, SPEICHERN, "Save (Bernd)");
      await Promise.all([a.seite.keyboard.press("Enter"), b.seite.keyboard.press("Enter")]);
      const ausgang = async (s: Seite): Promise<"gespeichert" | "konflikt"> => {
        try {
          await warte(
            s,
            "(a) => !document.querySelector(a[0]) || !!document.querySelector(a[1])",
            "Speichern hat einen Ausgang",
            [AUSSAGE, KONFLIKT],
            30_000,
          );
        } catch (fehler) {
          const lage = await s.evaluate<string>(fn(SPEICHERLAGE));
          throw new Error(`${String(fehler).slice(0, 400)}\nSpeicherlage: ${lage}`);
        }
        return (await s.evaluate<boolean>(fn(GIBT_ES), KONFLIKT)) ? "konflikt" : "gespeichert";
      };
      const ausgaenge = { anna: await ausgang(a.seite), bernd: await ausgang(b.seite) };
      protokoll.push(`P3 · Ausgänge: ${JSON.stringify(ausgaenge)}`);
      expect(Object.values(ausgaenge).sort(), "genau eine Fassung gewinnt").toEqual([
        "gespeichert",
        "konflikt",
      ]);
      const gewinner = ausgaenge.anna === "gespeichert" ? a : b;
      const verlierer = gewinner === a ? b : a;
      const gewinnerMarke = gewinner === a ? MARKE_A : MARKE_B;
      const verliererMarke = gewinner === a ? MARKE_B : MARKE_A;
      const verliererName = gewinner === a ? BERND.name : ANNA.name;
      const nachP3 = await stehtAmPool(pool, koId);
      expect(nachP3.version).toBe(start.version + 1);
      expect(nachP3.statement).toContain(gewinnerMarke.trim());
      expect(nachP3.statement).not.toContain(verliererMarke.trim());
      expect(await wert(verlierer.seite, AUSSAGE), "die Eingabe des Verlierers bleibt").toContain(
        verliererMarke.trim(),
      );
      // Der Hinweis des Verlierers steht weiter — seine Arbeit ist ja noch da.
      expect((await zeilenAmPool(pool, koId)).map((z) => z.nutzer_name)).toEqual([verliererName]);
      tastatur.verlierer_abbrechen = await mitTaste(
        verlierer.seite,
        ABBRECHEN,
        "Abbrechen (Verlierer)",
        tastatur,
      );
      await warte(
        gewinner.seite,
        GIBT_ES,
        "der Gewinner sieht das Ende der anderen Bearbeitung",
        BEENDET,
        20_000,
      );
      await warte(gewinner.seite, FEHLT, "der Hinweis ist beim Gewinner fort", FREMD, 20_000);
      expect(await zeilenAmPool(pool, koId)).toEqual([]);
      protokoll.push(
        "P3 · genau ein Gewinner, Konflikt mit erhaltenem Text, Abbrechen nimmt den Hinweis — gemessen",
      );

      // ══ P4 · VERBINDUNGSABBRUCH UND ABLAUF (SERVERZEIT) ══════════════════════════════════════
      await oeffneEintrag(a.seite, p1.basis, koId);
      await oeffneEintrag(b.seite, p2.basis, koId);
      await beginneBearbeiten(a.seite, "anna2", tastatur);
      await tippeMitTastatur(a.seite, AUSSAGE, MARKE_A2, "Aussage (Anna, zweiter Gang)");
      await warte(
        b.seite,
        TRAEGT,
        "Bernd sieht Annas zweite Bearbeitung",
        [FREMD, ANNA.name],
        20_000,
      );
      const abbruch = Date.now();
      await a.kontext.setOffline(true);
      await warte(
        a.seite,
        `(sel) => { const e = document.querySelector(sel); return !!e && e.getAttribute("data-lage") === "unterbrochen"; }`,
        "Annas Fläche sagt den Abbruch",
        EIGEN,
        45_000,
      );
      expect(await text(a.seite, EIGEN)).toBe(
        T.de("bearbeitung.eigenUnterbrochen", { minuten: 2 }),
      );
      expect(await wert(a.seite, AUSSAGE)).toContain(MARKE_A2.trim());
      await warte(
        b.seite,
        FEHLT,
        "Bernd sieht den Hinweis nach Ablauf verschwinden",
        FREMD,
        170_000,
      );
      const verschwundenNach = Date.now() - abbruch;
      protokoll.push(
        `P4 · Hinweis verschwand ${Math.round(verschwundenNach / 1000)} s nach dem Abbruch`,
      );
      // Frühestens mit dem Ablauf (120 s nach der letzten Erneuerung, die höchstens 30 s vor dem
      // Abbruch lag), also nicht vor 90 s — sonst hätte nicht der Ablauf entschieden.
      expect(verschwundenNach).toBeGreaterThanOrEqual(90_000);
      await warte(b.seite, GIBT_ES, "Bernd bekommt den Satz über das Ende", BEENDET, 5_000);
      await a.kontext.setOffline(false);
      await warte(
        a.seite,
        `(sel) => { const e = document.querySelector(sel); return !!e && e.getAttribute("data-lage") === "zurueck"; }`,
        "Annas Fläche meldet die Rückkehr",
        EIGEN,
        30_000,
      );
      expect(
        await wert(a.seite, AUSSAGE),
        "Annas Text überlebt Abbruch, Ablauf und Wiederholung",
      ).toContain(MARKE_A2.trim());
      await warte(
        b.seite,
        TRAEGT,
        "Bernd sieht Anna nach ihrer Rückkehr wieder",
        [FREMD, ANNA.name],
        20_000,
      );
      await mitTaste(a.seite, ABBRECHEN, "anna2_abbrechen", tastatur);
      protokoll.push(
        "P4 · Abbruch gesagt, Ablauf nach Serverzeit, Rückkehr mit erhaltenem Text — gemessen",
      );

      // ══ P5 · NEUSTART VON PROZESS 1 ═══════════════════════════════════════════════════════════
      await beende(p1);
      prozesse.splice(prozesse.indexOf(p1), 1);
      p1 = await starteProzess("Prozess 1 (neu)", datenbankUrl, port1);
      prozesse.push(p1);
      await oeffneEintrag(a.seite, p1.basis, koId);
      await warte(
        a.seite,
        "(t) => document.body.innerText.includes(t)",
        "der gespeicherte Stand überlebt den Neustart",
        gewinnerMarke.trim(),
        30_000,
      );
      expect((await stehtAmPool(pool, koId)).version).toBe(start.version + 1);
      protokoll.push(
        "P5 · Neustart: gespeicherter Inhalt steht nach dem Neustart in der Fläche — gemessen",
      );

      // ══ P6 · ROLLENENTZUG ═════════════════════════════════════════════════════════════════════
      await oeffneEintrag(b.seite, p2.basis, koId);
      await beginneBearbeiten(b.seite, "bernd2", tastatur);
      await tippeMitTastatur(b.seite, AUSSAGE, " ᚱᛖᚲᚺᛏK6", "Aussage (Bernd, vor Rechteentzug)");
      const admin1 = new Sitzung(p1.basis, "admin-neu");
      mussGelingen(
        "Admin-Anmeldung",
        await admin1.sende("POST", "/api/auth/login", {
          email: "admin@reservierung-k6.test",
          password: PASSWORT,
        }),
      );
      mussGelingen(
        "Bernd wird Leser",
        await admin1.sende("PUT", `/api/users/${berndKonto.id}`, { role: "viewer" }),
      );
      await warte(
        b.seite,
        `(sel) => { const e = document.querySelector(sel); return !!e && e.getAttribute("data-lage") === "ohneRecht"; }`,
        "Bernds Fläche sagt den Rechteentzug",
        EIGEN,
        45_000,
      );
      expect(await wert(b.seite, AUSSAGE)).toContain("ᚱᛖᚲᚺᛏK6");
      expect(
        await b.seite.evaluate<number>(fn(AUFRUF), {
          url: `/api/kos/${koId}/bearbeitungen/bernd-nach-entzug-1`,
          methode: "PUT",
        }),
      ).toBe(403);
      mussGelingen(
        "Bernds Zugang beenden",
        await admin1.sende("PUT", `/api/users/${berndKonto.id}`, {
          accessExpiresAt: new Date(Date.now() - 60_000).toISOString(),
        }),
      );
      expect(
        await b.seite.evaluate<number>(fn(AUFRUF), {
          url: `/api/kos/${koId}/bearbeitungen`,
          methode: "GET",
        }),
      ).toBe(401);
      expect(annaKonto.id).not.toBe(berndKonto.id);
      protokoll.push(
        "P6 · Rollenentzug sperrt Erneuerung (403) und danach Lesung (401); Text bleibt — gemessen",
      );
      protokoll.push(`Tastaturschritte: ${JSON.stringify(tastatur)}`);
    } catch (fehler) {
      for (const p of prozesse) {
        protokoll.push(`── Ausgabe ${p.name} ──\n${p.ausgabe().slice(-2500)}`);
      }
      throw fehler;
    } finally {
      await pool.end();
    }
  }, 900_000);
});
