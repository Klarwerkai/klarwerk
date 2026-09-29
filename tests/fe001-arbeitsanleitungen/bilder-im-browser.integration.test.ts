// ================================================================================================
// FE-001 E2/E5/E9/E10 · PFLICHTBILDER UND BEISPIELABLAUF IM ECHTEN BROWSER GEGEN POSTGRESQL.
// ================================================================================================
//
// Ben, Lauf 3 Runde 2: das Bildskript `scripts/fe001/arbeitsanleitungen-belege.mjs` hatte keinen
// Aufrufer im Prüfweg — der gezielte Serverlauf sammelt nur `*.test.ts`. Diese Datei IST der
// Aufrufer: sie nimmt die Pflichtbilder mit den exportierten Schritten DES SKRIPTS auf (keine
// Kopie der Bildlogik) und geht dabei den FE-001-Beispielablauf (E5) gegen einen echten
// Serverprozess (`server.ts`) auf einer Wegwerf-Datenbank aus `KLARWERK_PG_TEST_URL`.
//
//   · drei Ansichten — Einstieg, Inhalts-/Fassungsauswahl, gefüllter Lesestand — je 1280, 1024 und
//     360 px Breite; der Viewport ist Parameter jeder Aufnahme,
//   · Ablage in EINEM festen Ordner (`KLARWERK_FE001_BILDER` oder `.local/run/fe001-bilder-im-browser`)
//     mit `MANIFEST.json`: Commit aus `git HEAD`, URL, Browser/Version, Viewport, Zeitpunkt,
//     SHA-256 je PNG,
//   · jede Datei wird hier nachgeprüft: vorhanden, nicht leer, PNG, Maße = gesetzter Viewport,
//   · Beispielablauf: benennen → Kopf → drei Inhalte über ihren Titel finden und Fassung 1 binden →
//     Reihenfolge ändern → Reload → Lesestand mit Herkunft/Fassung → vorlegen → Reload; das
//     Gespeicherte wird zusätzlich IN DER DATENBANK nachgesehen.
//
// KEIN STILLER SKIP (E10): fehlt `KLARWERK_PG_TEST_URL` oder Chromium, SCHEITERT der Fall mit dem
// Grund. Eine fehlende gebaute Fläche wird gebaut oder wirft (`stelleFlaecheBereit`).
//
// KEINE PRODUKTIVDATEN: ausschliesslich eine Wegwerf-Datenbank mit `test` im Namen.
import { type ChildProcessWithoutNullStreams, execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Browser } from "@playwright/test";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  BEISPIELBESTAND,
  BREITEN,
  type Bild,
  KOPF,
  SUCHBEGRIFFE,
  anleitungAnlegen,
  aufBreite,
  auswahlbild,
  einstiegsbild,
  kandidat,
  kopfSpeichern,
  lesestandbild,
  neuesProtokoll,
  nimmAuf,
  oeffneEinstieg,
  pngMasse,
  richteEin,
  sha256,
  starteBrowser,
} from "../../scripts/fe001/arbeitsanleitungen-belege.mjs";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { hatBrowser, starteBrowserOderBefund } from "../gesamtanweisung-nutzerweg/browserbefund";
import {
  type Verbindung,
  WURZEL,
  freierPort,
  pgUrl,
  schneideMit,
  serverUmgebung,
  stelleFlaecheBereit,
  warteAufGesund,
  zerlege,
} from "../gesamtanweisung-nutzerweg/weg";
import { sprachbestand } from "../support/i18nBestand";
import {
  type Laufzustand,
  befundsatz,
  zaehltAlsBestanden,
} from "../wiki-gesamtanweisung-abnahme/laufzustand";

const MARKE = "FE-001 BILDER IM BROWSER";
const AUS = resolve(
  WURZEL,
  process.env.KLARWERK_FE001_BILDER ?? ".local/run/fe001-bilder-im-browser",
);
const TITEL = "Start im Homeoffice";
/** So lange hält der Test die Antwort auf `GET /api/auth/notice` zurück (BEN-04: später Hinweis). */
const HINWEIS_VERZUG_MS = 4000;

describe("FE-001 · Pflichtbilder und Beispielablauf im echten Browser gegen PostgreSQL", () => {
  let adminPool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let browser: Browser | undefined;
  let laufzustand: Laufzustand | undefined;
  let flaeche = "nicht hergestellt";
  const db = `klarwerk_fe001bilder_test_${`${Date.now()}`.slice(-9)}`;

  beforeAll(async () => {
    const url = guardedLocalPgTestUrl();
    if (!url) {
      laufzustand = {
        gelaufen: false,
        grund:
          "keine gesicherte KLARWERK_PG_TEST_URL — Bilder und Beispielablauf sind nicht bewertbar",
      };
      process.stderr.write(befundsatz(MARKE, laufzustand));
      return;
    }
    verbindung = zerlege(url);
    if (!verbindung) {
      laufzustand = { gelaufen: false, grund: "KLARWERK_PG_TEST_URL nennt keinen Rechnernamen" };
      process.stderr.write(befundsatz(MARKE, laufzustand));
      return;
    }
    adminPool = new Pool({ connectionString: url });
    await adminPool.query(`CREATE DATABASE ${db}`);
    flaeche = stelleFlaecheBereit();
    const start = await starteBrowserOderBefund(starteBrowser, () =>
      existsSync(join(WURZEL, "apps/web/dist/index.html")),
    );
    if (!hatBrowser(start)) {
      laufzustand = start.zustand;
      process.stderr.write(befundsatz(MARKE, laufzustand));
      return;
    }
    browser = start.browser;
    laufzustand = { gelaufen: true, quelle: `${verbindung.host}:${verbindung.port}/${db}` };
    process.stderr.write(befundsatz(MARKE, laufzustand));
  }, 900_000);

  afterAll(async () => {
    await browser?.close();
    if (adminPool) {
      await adminPool.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => undefined);
      await adminPool.end();
    }
  }, 120_000);

  it("Einstieg, Auswahl und Lesestand je 1280/1024/360 px — Beispielablauf gespeichert und nach Reload erhalten", async () => {
    // Nicht bewertbar ist NICHT bestanden: der Fall scheitert mit dem Grund.
    expect(zaehltAlsBestanden(laufzustand), befundsatz(MARKE, laufzustand)).toBe(true);
    if (!browser || !verbindung) {
      throw new Error(`${MARKE}: Laufzustand gelaufen, aber Browser oder Verbindung fehlen.`);
    }
    const zugang = pgUrl(verbindung, db);
    const port = await freierPort();
    const basis = `http://127.0.0.1:${port}`;
    const { zeilen: protokoll, log } = neuesProtokoll();
    log(`${MARKE}: Fläche ${flaeche} · Socket ${basis} · Datenbank ${db}`);

    // Ein fester Ordner, vorher geleert: kein Bild aus einem früheren Lauf zählt mit.
    rmSync(AUS, { recursive: true, force: true });
    mkdirSync(AUS, { recursive: true });

    const prozess: ChildProcessWithoutNullStreams = spawn(
      "node",
      ["--import", "tsx", "services/app/src/server.ts"],
      { cwd: WURZEL, env: serverUmgebung(zugang, port) },
    );
    const prozesstext: string[] = [];
    schneideMit(prozess, prozesstext);
    const pool = new Pool({ connectionString: zugang });
    const kontext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: "de-DE",
    });
    try {
      await warteAufGesund(basis, prozess, prozesstext, "Start");
      const pgFassung = (await pool.query<{ v: string }>("SELECT version() AS v")).rows[0]?.v ?? "";
      expect(pgFassung, `${MARKE}: PostgreSQL nennt seine Fassung nicht`).toContain("PostgreSQL");
      const seite = await kontext.newPage();
      const bilder: Bild[] = [];

      // ── Nutzungshinweis ABSICHTLICH VERZÖGERT (Ben, Lauf 4 Runde 3, BEN-04) ────────────────────
      // Der Hinweis erscheint erst, wenn der Vermerk `GET /api/auth/notice` im Browser ankommt. Die
      // Antwort wird hier um HINWEIS_VERZUG_MS zurückgehalten (unverändert weitergereicht, nur
      // später) — der späte Fall, den eine einmalige Existenzabfrage übersah und der die
      // Einstiegsaktion auf den Bildern verdeckte. `richteEin` muss ihn trotzdem über „Verstanden —
      // weiter" bestätigen; `einstiegsbild` & Co. werfen, wenn er noch sichtbar ist.
      let verzoegert = 0;
      await seite.route("**/api/auth/notice", async (route) => {
        if (route.request().method() === "GET") {
          verzoegert += 1;
          await new Promise((fertig) => setTimeout(fertig, HINWEIS_VERZUG_MS));
        }
        await route.continue();
      });

      // ── Testbestand: Ersteinrichtung + drei Wissenseinträge (nur in dieser Wegwerf-DB) ──────────
      const ids = await richteEin(seite, basis, log);
      expect(ids).toHaveLength(BEISPIELBESTAND.length);
      await seite.unroute("**/api/auth/notice");
      expect(verzoegert, `${MARKE}: der Vermerk wurde nicht verzögert abgefragt`).toBeGreaterThan(
        0,
      );
      expect(
        protokoll.some((z) => z.startsWith("Nutzungshinweis über")),
        `${MARKE}: der verspätete Nutzungshinweis wurde nicht über die Oberfläche bestätigt`,
      ).toBe(true);
      expect(
        await seite.locator('[data-testid="notice-banner"]:visible').count(),
        `${MARKE}: Nutzungshinweis nach der Einrichtung noch sichtbar`,
      ).toBe(0);
      // Nachprüfung am Server AUS DER ANGEMELDETEN SEITE (dieselbe Sitzung wie die Oberfläche; Ben,
      // Lauf 5 Runde 1: die Anfrage über `kontext.request` trug die Sitzung nicht und lieferte keinen
      // Vermerk). Geprüft werden Status UND Antwortstruktur — ein fehlendes `due` ist kein „false“.
      const vermerk = await seite.evaluate(async () => {
        const a = await fetch("/api/auth/notice", { credentials: "include" });
        return { status: a.status, rumpf: (await a.json().catch(() => null)) as unknown };
      });
      expect(vermerk.status, `${MARKE}: GET /api/auth/notice nicht angemeldet beantwortet`).toBe(
        200,
      );
      expect(vermerk.rumpf, `${MARKE}: Antwortstruktur des Vermerks`).toMatchObject({
        due: expect.any(Boolean),
        currentVersion: expect.anything(),
      });
      expect(
        (vermerk.rumpf as { due: boolean }).due,
        `${MARKE}: der Server führt den Hinweis weiter als fällig`,
      ).toBe(false);
      const [idEins, idZwei, idDrei] = ids as [string, string, string];
      const [begriffEins, begriffZwei, begriffDrei] = SUCHBEGRIFFE as [string, string, string];

      // ── 1 · Einstieg je Breite ──────────────────────────────────────────────────────────────────
      await oeffneEinstieg(seite, basis);
      for (const breite of BREITEN) {
        bilder.push(await einstiegsbild(seite, AUS, breite, log));
      }

      // ── 2 · Anleitung benennen und Kopf speichern ──────────────────────────────────────────────
      await aufBreite(seite, 1280);
      const adresse = await anleitungAnlegen(seite, TITEL);
      log(`Angelegt: ${adresse}`);
      await kopfSpeichern(seite, log);

      // ── 3 · Inhalts-/Fassungsauswahl je Breite ─────────────────────────────────────────────────
      for (const breite of BREITEN) {
        bilder.push(await auswahlbild(seite, AUS, breite, begriffEins, idEins, log));
      }

      // ── 4 · Drei Inhalte über ihren Titel finden und Fassung 1 aufnehmen (Tastatur) ─────────────
      await aufBreite(seite, 1280);
      await nimmAuf(seite, begriffEins, idEins, log);
      await nimmAuf(seite, begriffZwei, idZwei, log);
      await nimmAuf(seite, begriffDrei, idDrei, log);

      // ── 5 · Reihenfolge ändern: den dritten Abschnitt nach oben ────────────────────────────────
      const dritter = seite.locator('[data-testid="ga-lesestand-baustein"]').nth(2);
      await dritter.getByRole("button", { name: /nach oben verschieben/ }).focus();
      await seite.keyboard.press("Enter");
      await seite
        .locator('[data-testid="ga-lesestand-baustein"]')
        .nth(1)
        .filter({ hasText: BEISPIELBESTAND[2]?.[0] ?? "" })
        .waitFor();

      // ── 6 · Reload: Lesestand mit Herkunft und gebundener Fassung ──────────────────────────────
      await seite.reload();
      await seite.getByTestId("ga-lesestand-dokument").waitFor();
      const erwarteteFolge = [BEISPIELBESTAND[0], BEISPIELBESTAND[2], BEISPIELBESTAND[1]].map(
        (b) => b?.[0] ?? "",
      );
      const abschnitte = seite.locator('[data-testid="ga-lesestand-baustein"]');
      expect(await abschnitte.count(), `${MARKE}: Abschnitte nach Reload`).toBe(3);
      const fassungstext = (sprachbestand("de")["ga.baustein.fassung"] ?? "").replace(
        "{{version}}",
        "1",
      );
      expect(fassungstext, `${MARKE}: Katalogtext der gebundenen Fassung fehlt`).not.toBe("1");
      for (const [i, titel] of erwarteteFolge.entries()) {
        const abschnitt = abschnitte.nth(i);
        expect(await abschnitt.innerText(), `${MARKE}: Platz ${i + 1} nach Reload`).toContain(
          titel,
        );
        const herkunft = await abschnitt.getByTestId("ga-lesestand-herkunft").innerText();
        expect(herkunft, `${MARKE}: Herkunft an Platz ${i + 1}`).toContain(fassungstext);
        expect(herkunft, `${MARKE}: Herkunftstitel an Platz ${i + 1}`).toContain(titel);
      }
      const dokument = await seite.getByTestId("ga-lesestand-dokument").innerText();
      expect(dokument, `${MARKE}: Zweck im Lesestand`).toContain(KOPF.zweck);
      expect(dokument, `${MARKE}: keine rohe ISO-Zeit im Lesestand`).not.toMatch(
        /\d{4}-\d{2}-\d{2}T\d{2}:/,
      );

      // ── 7 · Gefüllter Lesestand je Breite ──────────────────────────────────────────────────────
      for (const breite of BREITEN) {
        bilder.push(await lesestandbild(seite, AUS, breite, log));
      }

      // ── 8 · Vorlegen (Tastatur) und Reload ─────────────────────────────────────────────────────
      await aufBreite(seite, 1280);
      await seite.getByTestId("ga-entscheidung-vorlegen").focus();
      await seite.keyboard.press("Enter");
      await seite.getByTestId("ga-entscheidung-stand").filter({ hasText: "Vorgelegt" }).waitFor();
      await seite.reload();
      await seite.getByTestId("ga-lesestand-dokument").waitFor();
      expect(
        await seite.getByTestId("ga-entscheidung-stand").innerText(),
        `${MARKE}: Stand nach Reload`,
      ).toContain("Vorgelegt");
      expect(await abschnitte.count(), `${MARKE}: Abschnitte nach Vorlegen und Reload`).toBe(3);

      // ── 9 · Und es steht in der Datenbank ──────────────────────────────────────────────────────
      const kopf = await pool.query<{ id: string; stand: string; zweck: string }>(
        "SELECT id, stand, zweck FROM gesamtanweisungen WHERE titel = $1",
        [TITEL],
      );
      expect(kopf.rows, `${MARKE}: genau eine gespeicherte Anleitung`).toHaveLength(1);
      expect(kopf.rows[0]?.stand).toBe("vorgelegt");
      expect(kopf.rows[0]?.zweck).toBe(KOPF.zweck);
      expect(adresse, `${MARKE}: die Adresse trägt die gespeicherte Anleitung`).toContain(
        kopf.rows[0]?.id ?? "(keine)",
      );
      const folge = await pool.query<{ ko_id: string; ko_version: number }>(
        "SELECT ko_id, ko_version FROM gesamtanweisung_bausteine WHERE anweisung_id = $1 ORDER BY pos",
        [kopf.rows[0]?.id],
      );
      expect(
        folge.rows.map((z) => [z.ko_id, z.ko_version]),
        `${MARKE}: gespeicherte Reihenfolge und Fassungen`,
      ).toEqual([
        [idEins, 1],
        [idDrei, 1],
        [idZwei, 1],
      ]);

      // ── 10 · Manifest und Nachprüfung jeder Datei ──────────────────────────────────────────────
      const kopfCommit = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: WURZEL,
        encoding: "utf8",
      }).trim();
      const eintraege = bilder.map((b) => {
        const groesse = existsSync(b.datei) ? statSync(b.datei).size : 0;
        expect(groesse, `${MARKE}: ${b.datei} fehlt oder ist leer`).toBeGreaterThan(0);
        const masse = pngMasse(b.datei);
        expect(masse, `${MARKE}: ${b.datei} ist kein PNG`).not.toBeNull();
        expect(masse, `${MARKE}: ${b.datei} hat nicht die Maße des Viewports`).toEqual(b.viewport);
        return {
          datei: b.datei.slice(AUS.length + 1),
          ansicht: b.name,
          url: b.url,
          viewport: b.viewport,
          bytes: groesse,
          sha256: sha256(b.datei),
        };
      });
      expect(eintraege, `${MARKE}: drei Ansichten × drei Breiten`).toHaveLength(9);
      expect(new Set(eintraege.map((e) => `${e.ansicht}@${e.viewport.width}`)).size).toBe(9);
      const bindung = kandidat();
      expect(bindung.commit, `${MARKE}: Commit der Bindung ≠ git HEAD`).toBe(kopfCommit);
      const manifest = {
        marke: MARKE,
        kandidat: bindung,
        testumgebung: {
          server: basis,
          prozess: "node --import tsx services/app/src/server.ts (NODE_ENV=production)",
          datenhaltung: `${pgFassung.split(" ").slice(0, 2).join(" ")} · Wegwerf-Datenbank ${db}`,
          health: await (await fetch(`${basis}/health`)).json().catch(() => ({})),
        },
        browser: `Chromium ${browser.version()} (headless)`,
        breiten: BREITEN,
        aufgenommen: new Date().toISOString(),
        bilder: eintraege,
      };
      writeFileSync(join(AUS, "MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`);
      writeFileSync(join(AUS, "protokoll.txt"), `${protokoll.join("\n")}\n`);
      process.stderr.write(
        `[KLARWERK] ${MARKE}: ${eintraege.length} Bilder in ${AUS} · Commit ${bindung.commit}\n${JSON.stringify(manifest, null, 2)}\n`,
      );
    } finally {
      await kontext.close();
      await pool.end();
      prozess.kill("SIGTERM");
    }
  }, 900_000);
});
