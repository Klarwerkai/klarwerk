// ================================================================================================
// JOB 4357 · DIE KALIBRIERUNG DES LISTENWEGS — VIER VERSTELLUNGEN, DIE IHN ROT MACHEN MÜSSEN.
// ================================================================================================
//
// WOZU DIESE DATEI DA IST. Ein grüner Nachweis sagt nichts, solange niemand gezeigt hat, dass er
// auch scheitern KANN. REGELN.md 9 sagt es für die Sichtbarkeit wörtlich: „Kalibriere jede
// Sichtbarkeitsbehauptung durch gezieltes Ausblenden genau dieses Elements … der unveränderte Test
// MUSS daran mit konkretem Feldnamen scheitern." Und Abnahmekriterium 2 dieses Auftrags verlangt die
// Tastaturprobe ausdrücklich: „Gegenprobe: Eintrag ohne Fokussierbarkeit → rot."
//
//   L1  ZEILE        · `display:none` auf der Zeile DIESER Anweisung → die Sichtbarkeitsmessung
//                      scheitert mit „hat keine Fläche auf dem Bildschirm". Sie ist damit keine
//                      Prüfung auf blosse Anwesenheit: `querySelector` und `textContent` fänden sie
//                      weiterhin.
//   L2  TITELTEXT    · die Zeile behält Platz und Rahmen, aber ihr texttragendes KIND (der Link)
//                      bekommt `color: transparent` → rot. Das ist NICHT dieselbe Probe wie L1:
//                      der Behälter bleibt sichtbar, und genau darauf ist JOB 4295 dreimal
//                      hereingefallen (LEHREN.md, Korrekturpflicht wörtlich: „Sichtbarkeit der
//                      gelesenen Textteile prüfen, einschließlich ihrer Nachkommen, statt
//                      Container-Sichtbarkeit auf dessen gesamten Text zu übertragen").
//   L3  TASTATUR     · `tabindex="-1"` auf dem Eintrag → der Tab-Weg scheitert. Der Eintrag bleibt
//                      SICHTBAR und mit der Maus bedienbar: das ist die Halbheit „nur mit der Maus",
//                      die Abnahmekriterium 2 ausschliesst.
//   L4  BESTAND      · zwischen SIGTERM und Neustart werden die Zeilen gelöscht → die Liste zeigt
//                      die Anweisung nicht mehr, und der Nachweis wird rot. Ohne L4 bewiese das Grün
//                      des Nachweises nur, dass eine Liste gezeichnet wird — nicht, dass sie den
//                      HALTBAREN Bestand zeigt.
//
// WARUM SIE HINTER EINEM SCHALTER STEHT. Vier dauerhaft rote Fälle wären ein dauerhaft rotes Tor und
// damit nach kurzer Zeit ein ignoriertes. `KLARWERK_KALIBRIERUNG=1` schaltet sie an; ohne die
// Variable wird jeder Fall mit SICHTBAREM Grund übersprungen — kein stiller Skip, dieselbe Regel und
// derselbe Schalter wie in `menueweg-kalibrierung.integration.test.ts`.
//
// SIE FÄHRT DIESELBEN STATIONEN wie der Nachweis (`./liste-weg.ts`, `./weg.ts`) und keine Kopie
// davon. Eine Kopie wäre eine Aussage über sich selbst.
//
// KEINE PRODUKTIVDATEN: ausschliesslich eine Wegwerf-Datenbank mit `test` im Namen.
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  type Browser,
  type Kontext,
  type Seite,
  starteChromium,
  warte,
} from "../gast-nutzerweg/browserweg";
import { PASSWORT, Sitzung, mussGelingen, wissensobjektAnlegen } from "../gast-nutzerweg/strecke";
import { sprachbestand } from "../support/i18nBestand";
import { type Laufzustand, befundsatz } from "../wiki-gesamtanweisung-abnahme/laufzustand";
import {
  MARKE as LISTE_MARKE,
  eintragOeffnenMitTastatur,
  stelleFrischeFlaecheBereit,
  zeileMussSichtbarSein,
} from "./liste-weg";
import {
  type Verbindung,
  WURZEL,
  anweisungAnlegen,
  bausteinAufnehmen,
  freierPort,
  frischesProfil,
  meldeAnMitTastatur,
  menuewegOhneMaus,
  pgUrl,
  schneideMit,
  serverUmgebung,
  warteAufGesund,
  zerlege,
} from "./weg";

const MARKE = `${LISTE_MARKE} KALIBRIERUNG`;
const ADMIN = "liste-kalibrierung@gesamtanweisung-4357.test";
const KO_EINS = "Ventil oeffnen (Kalibrierung 4357)";
const ANWEISUNGSTITEL = "Kalibrierung der Bestandsliste (JOB 4357)";

/**
 * Der Schalter. Ohne ihn läuft hier nichts — und der Grund steht sichtbar auf stderr.
 *
 * ZWEI WEGE, aus demselben Grund wie nebenan: der Cloud-Wrapper der Bahnen nimmt ausschliesslich
 * Aufrufe entgegen, die mit `npx vitest run` BEGINNEN — ein vorangestelltes `VAR=1` wird abgelehnt.
 * Deshalb zählt zusätzlich eine bewusst gelegte Marke im Ordner. Wer sie liegen lässt, macht nur
 * diesen Integrationslauf rot; das Tor sieht `*.integration.test.ts` ohnehin nicht.
 */
const MARKENDATEI = join(import.meta.dirname, "KALIBRIERUNG_AN");
const ANGESCHALTET = process.env.KLARWERK_KALIBRIERUNG === "1" || existsSync(MARKENDATEI);

/**
 * Ein Init-Skript, das GENAU diese eine CSS-Regel nachlegt — sonst bleibt die Fläche unverändert.
 *
 * Es hängt den Stil ans Dokument, nicht an ein Element: React baut die Liste bei jedem
 * Zustandswechsel neu auf, ein gesetztes Attribut wäre danach fort.
 */
function stilSkript(css: string): string {
  return `(() => {
  const setze = () => {
    const s = document.createElement("style");
    s.textContent = ${JSON.stringify(css)};
    document.head.appendChild(s);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setze);
  } else {
    setze();
  }
})();`;
}

/** L1 · Die Zeile ist ganz fort — Platz, Text und alles. Sie steht weiterhin im Dokument. */
const VERSTECKE_ZEILE = stilSkript('[data-testid="ga-liste-eintrag"]{display:none !important}');

/**
 * L2 · Nur das texttragende KIND der Zeile ist unlesbar — die Zeile selbst steht noch da.
 *
 * Der Titel wohnt im Link (`GesamtanweisungBereich.tsx`, `Listeneintrag`). Bleibt der `<li>`
 * sichtbar und verschwindet nur die Schriftfarbe des Links, dann ist die Zeile für eine Prüfung auf
 * Behälter-Sichtbarkeit noch da und für einen Menschen nicht mehr lesbar.
 */
const DURCHSICHTIGER_TITEL = stilSkript(
  '[data-testid="ga-liste-oeffnen"]{color: transparent !important}',
);

/**
 * L3 · Den Eintrag aus der Tab-Reihenfolge nehmen — er bleibt sichtbar und mit der Maus nutzbar.
 *
 * Ein Beobachter setzt das Attribut nach jedem Neuzeichnen erneut: React ersetzt die Liste, sobald
 * die Abfrage antwortet, und ein einmal gesetztes Attribut wäre danach fort.
 */
const NIMM_AUS_DER_TABREIHE = `(() => {
  const setze = () => {
    for (const e of document.querySelectorAll('[data-testid="ga-liste-oeffnen"]')) {
      e.setAttribute("tabindex", "-1");
    }
  };
  const start = () => {
    setze();
    new MutationObserver(setze).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();`;

describe("JOB 4357 · Kalibrierung: vier Verstellungen, die den Listenweg rot machen", () => {
  let adminPool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let browser: Browser | undefined;
  let prozess: ChildProcessWithoutNullStreams | undefined;
  let port = 0;
  let basis = "";
  let zugang = "";
  let verfuegbar = false;
  let laufzustand: Laufzustand | undefined;
  /** Die bindbare Fassung — NACHGESEHEN, nicht geraten. */
  let baustein: { koId: string; fassung: number } | undefined;
  const protokoll: string[] = [];
  const db = `klarwerk_ga4357k_test_${`${Date.now()}`.slice(-9)}`;

  const starte = (): ChildProcessWithoutNullStreams =>
    spawn("node", ["--import", "tsx", "services/app/src/server.ts"], {
      cwd: WURZEL,
      env: serverUmgebung(zugang, port),
    });

  beforeAll(async () => {
    if (!ANGESCHALTET) {
      laufzustand = {
        gelaufen: false,
        grund:
          "KLARWERK_KALIBRIERUNG ist nicht 1 — die vier Verstellungen sind absichtlich abgeschaltet, sonst wäre der Integrationslauf dauerhaft rot",
      };
      process.stderr.write(befundsatz(MARKE, laufzustand));
      return;
    }
    const url = guardedLocalPgTestUrl();
    if (!url) {
      laufzustand = { gelaufen: false, grund: "keine gesicherte KLARWERK_PG_TEST_URL" };
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
    await adminPool.query("SELECT 1");
    await adminPool.query(`CREATE DATABASE ${db}`);
    zugang = pgUrl(verbindung, db);
    stelleFrischeFlaecheBereit();
    browser = await starteChromium();
    port = await freierPort();
    basis = `http://127.0.0.1:${port}`;
    prozess = starte();
    schneideMit(prozess, protokoll);
    await warteAufGesund(basis, prozess, protokoll, "erster Start");
    const api = new Sitzung(basis, "admin");
    mussGelingen(
      "POST /api/auth/setup",
      await api.sende("POST", "/api/auth/setup", {
        name: "Admin",
        email: ADMIN,
        password: PASSWORT,
      }),
      201,
    );
    const koId = await wissensobjektAnlegen(api, KO_EINS);
    const antwort = mussGelingen(
      `GET /api/kos/${koId}/versions`,
      await api.sende("GET", `/api/kos/${koId}/versions`),
    );
    const saetze = (antwort.json as { version: number }[]) ?? [];
    baustein = { koId, fassung: Math.max(...saetze.map((s) => s.version)) };
    verfuegbar = true;
    laufzustand = { gelaufen: true, quelle: `${verbindung.host}:${verbindung.port}/${db}` };
    process.stderr.write(befundsatz(MARKE, laufzustand));
  }, 900_000);

  afterAll(async () => {
    const laufender = prozess;
    if (laufender && laufender.exitCode === null && laufender.signalCode === null) {
      const aus = new Promise<void>((fertig) => laufender.once("exit", () => fertig()));
      laufender.kill("SIGTERM");
      await aus;
    }
    await browser?.close();
    if (adminPool) {
      await adminPool.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => undefined);
      await adminPool.end();
    }
  }, 120_000);

  /** Ein angemeldetes Profil mit genau dieser Verstellung im Init-Skript, auf `/start`. */
  async function angemeldet(verstellung?: string): Promise<{ kontext: Kontext; seite: Seite }> {
    const profil = await frischesProfil(browser as Browser, async (kontext) => {
      if (verstellung !== undefined) {
        await kontext.addInitScript(verstellung);
      }
    });
    await meldeAnMitTastatur(profil.seite, basis, ADMIN, PASSWORT);
    await profil.seite.goto(`${basis}/start`, { waitUntil: "domcontentloaded" });
    await warte(
      profil.seite,
      `() => !!document.querySelector('[data-testid="kopfband-zahnrad"]')`,
      "das Kopfband mit dem Zahnrad",
      undefined,
      45_000,
    );
    return profil;
  }

  function uebersprungen(ctx: { skip: () => void }): boolean {
    if (verfuegbar) {
      return false;
    }
    process.stderr.write(befundsatz(MARKE, laufzustand));
    ctx.skip();
    return true;
  }

  /** Der deutsche Menüweg auf den Einstieg — WÖRTLICH der des Nachweises. */
  async function deutscherMenueweg(seite: Seite): Promise<void> {
    await menuewegOhneMaus(
      seite,
      sprachbestand("de")["menue.weitereBereiche"] ?? "",
      sprachbestand("de")["ga.bereich.titel"] ?? "",
      "de",
    );
  }

  /** Station (a) des Nachweises, unverändert: Menüweg, anlegen, einen Baustein binden. */
  async function anweisungMitBaustein(seite: Seite): Promise<string> {
    await deutscherMenueweg(seite);
    const kennung = await anweisungAnlegen(seite, ANWEISUNGSTITEL);
    const b = baustein as { koId: string; fassung: number };
    await bausteinAufnehmen(seite, b.koId, b.fassung, "kal-4357", 1);
    return kennung;
  }

  const standwort = (): string => sprachbestand("de")["ga.stand.entwurf"] ?? "";

  // ==============================================================================================
  // L1 · DIE ZEILE IST DA UND NIEMAND SIEHT SIE.
  // ==============================================================================================
  it("L1 — mit `display:none` auf der Zeile scheitert die Sichtbarkeitsmessung NAMENTLICH an ihr", async (ctx) => {
    if (uebersprungen(ctx)) {
      return;
    }
    const anlegen = await angemeldet();
    let anweisungId = "";
    try {
      anweisungId = await anweisungMitBaustein(anlegen.seite);
    } finally {
      await anlegen.kontext.close();
    }
    const profil = await angemeldet(VERSTECKE_ZEILE);
    try {
      await deutscherMenueweg(profil.seite);
      // Die Zeile STEHT weiterhin im Dokument und trägt weiterhin ihren Text — das ist der Punkt:
      // eine Prüfung auf blosse Anwesenheit bliebe hier grün. Erwartet wird „keine Fläche".
      await zeileMussSichtbarSein(
        profil.seite,
        anweisungId,
        ANWEISUNGSTITEL,
        standwort(),
        "L1 (display:none)",
      );
      expect(
        "die ausgeblendete Zeile war als sichtbar durchgegangen",
        `${MARKE}: L1 ist nicht rot geworden — der Nachweis prüft Anwesenheit statt Sichtbarkeit`,
      ).toBe("unsichtbar");
    } finally {
      await profil.kontext.close();
    }
  }, 900_000);

  // ==============================================================================================
  // L2 · DIE ZEILE BLEIBT SICHTBAR, IHR TITEL IST UNLESBAR.
  // ==============================================================================================
  it("L2 — ist die Schrift des Eintrags durchsichtig, ist der Nachweis rot: Behälter-Sichtbarkeit trägt den Text nicht", async (ctx) => {
    if (uebersprungen(ctx)) {
      return;
    }
    const anlegen = await angemeldet();
    let anweisungId = "";
    try {
      anweisungId = await anweisungMitBaustein(anlegen.seite);
    } finally {
      await anlegen.kontext.close();
    }
    const profil = await angemeldet(DURCHSICHTIGER_TITEL);
    try {
      await deutscherMenueweg(profil.seite);
      await zeileMussSichtbarSein(
        profil.seite,
        anweisungId,
        ANWEISUNGSTITEL,
        standwort(),
        "L2 (durchsichtige Schrift)",
      );
      expect(
        "der durchsichtige Titel war als sichtbar durchgegangen",
        `${MARKE}: L2 ist nicht rot geworden — die Sichtbarkeit der Zeile wird auf ihren Text übertragen`,
      ).toBe("unlesbar");
    } finally {
      await profil.kontext.close();
    }
  }, 900_000);

  // ==============================================================================================
  // L3 · DER EINTRAG IST SICHTBAR UND KEIN TAB ERREICHT IHN (Abnahmekriterium 2, Gegenprobe).
  // ==============================================================================================
  it("L3 — mit `tabindex=-1` auf dem Eintrag scheitert der Tab-Weg: „nur mit der Maus“ zählt nicht", async (ctx) => {
    if (uebersprungen(ctx)) {
      return;
    }
    const anlegen = await angemeldet();
    let anweisungId = "";
    try {
      anweisungId = await anweisungMitBaustein(anlegen.seite);
    } finally {
      await anlegen.kontext.close();
    }
    const profil = await angemeldet(NIMM_AUS_DER_TABREIHE);
    try {
      await deutscherMenueweg(profil.seite);
      // Die Zeile ist SICHTBAR — das wird zuerst gemessen. Sonst sagte das Rot unten nichts über die
      // Tastatur, sondern nur über eine Zeile, die gar nicht da war.
      await zeileMussSichtbarSein(
        profil.seite,
        anweisungId,
        ANWEISUNGSTITEL,
        standwort(),
        "L3 (vor der Tastaturprobe)",
      );
      await eintragOeffnenMitTastatur(
        profil.seite,
        anweisungId,
        ANWEISUNGSTITEL,
        standwort(),
        "L3 (tabindex=-1)",
      );
      expect(
        "der Eintrag war trotz tabindex=-1 per Tastatur erreichbar",
        `${MARKE}: L3 ist nicht rot geworden — der Tab-Weg sieht eine zerstörte Bedienbarkeit nicht`,
      ).toBe("unerreichbar");
    } finally {
      await profil.kontext.close();
    }
  }, 900_000);

  // ==============================================================================================
  // L4 · BESTAND — ZWISCHEN SIGTERM UND NEUSTART VERSCHWINDEN DIE ZEILEN.
  // ==============================================================================================
  //
  // ER LÄUFT ZULETZT, weil er den gemeinsamen Serverprozess beendet und neu startet. Das ist Absicht:
  // ein eigener zweiter Prozess daneben wäre eine zweite Wahrheit über denselben Start.
  it("L4 — werden die Zeilen zwischen SIGTERM und Neustart gelöscht, zeigt die Liste sie nicht mehr", async (ctx) => {
    if (uebersprungen(ctx)) {
      return;
    }
    const pool = new Pool({ connectionString: zugang });
    const anlegen = await angemeldet();
    let anweisungId = "";
    try {
      anweisungId = await anweisungMitBaustein(anlegen.seite);
      // VOR der Verstellung steht die Zeile sichtbar da — sonst sagte das Rot unten nichts über den
      // Neustart, sondern nur über einen Aufbau, der schon vorher nicht trug.
      await anlegen.seite.goto(`${basis}/start`, { waitUntil: "domcontentloaded" });
      await deutscherMenueweg(anlegen.seite);
      await zeileMussSichtbarSein(
        anlegen.seite,
        anweisungId,
        ANWEISUNGSTITEL,
        standwort(),
        "L4 (vor dem Prozessneustart)",
      );
    } finally {
      await anlegen.kontext.close();
    }

    const laufender = prozess as ChildProcessWithoutNullStreams;
    const beendet = new Promise<void>((fertig) => laufender.once("exit", () => fertig()));
    laufender.kill("SIGTERM");
    await beendet;

    // ── DIE VERSTELLUNG: der Bestand verschwindet, während niemand hinsieht. ─────────────────────
    await pool.query("DELETE FROM gesamtanweisung_bausteine WHERE anweisung_id = $1", [
      anweisungId,
    ]);
    await pool.query("DELETE FROM gesamtanweisungen WHERE id = $1", [anweisungId]);

    prozess = starte();
    protokoll.length = 0;
    schneideMit(prozess, protokoll);
    await warteAufGesund(basis, prozess, protokoll, "Neustart");

    const nachher = await angemeldet();
    try {
      await deutscherMenueweg(nachher.seite);
      await zeileMussSichtbarSein(
        nachher.seite,
        anweisungId,
        ANWEISUNGSTITEL,
        standwort(),
        "L4 (nach dem Prozessneustart)",
      );
      expect(
        "die gelöschte Anweisung stand weiterhin in der Liste",
        `${MARKE}: L4 ist nicht rot geworden — die Liste zeigt etwas, das im Bestand nicht mehr steht`,
      ).toBe("verschwunden");
    } finally {
      await nachher.kontext.close();
      await pool.end();
    }
  }, 900_000);
});
