import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// @vitest-environment jsdom
// ================================================================================================
// JOB 2621 · D1 — DREI SAETZE, DIE PEDI IN DIE IRRE FUEHRTEN (Befunde 26.08., je einzeln gepinnt)
// ================================================================================================
//
// Quelle: 00_CONTROL/BEFUNDE_KLARA_PANEL_20260826.md — drei Anzeigen, technisch richtig und in der
// Wirkung falsch. Gemessen wird am AUSGELIEFERTEN Panel ueber die Klara-Panel-Fixture (das echte
// Inline-Skript laeuft; kein Zwilling, keine Kopie). Machart wie heute mehrfach getragen:
// je Befund ein Fall, einzeln behauptet, mit Gegenprobe/Kalibrierung daneben.
import { afterEach, describe, expect, it } from "vitest";
import { type KlaraPanel, createKlaraPanel, reply, splitTaskpane } from "./klara-panel-fixture";

let panel: KlaraPanel | null = null;
afterEach(() => {
  panel?.restore();
  panel = null;
});

// Vertragsformen wortgleich zur Consent-UI-Suite (klara-session-consent-ui.test.ts) — kein
// erfundener Serverdialekt.
const SITZUNG = {
  sessionId: "sess-vom-server",
  tenantId: "t1",
  actorId: "a1",
  addinInstanceId: "inst-1",
  documentContextId: "doc-1",
  createdAt: "2026-08-28T12:00:00.000Z",
  lastActivityAt: "2026-08-28T12:00:00.000Z",
  expiresAt: "2026-08-28T12:15:00.000Z",
  policyVersion: "p1",
  configurationVersion: "c1",
  consentState: "granted",
  closed: false,
  resolution: { resolutionId: "res-1", effectiveMode: "deterministic", executionAllowed: true },
};
// Pedis zweites Bild: Zustimmung ERTEILT, und der externe Weg projektseitig nicht freigeschaltet.
const AUFLOESUNG_GESPERRT_TROTZ_ZUSTIMMUNG = {
  resolutionId: "res-1",
  mode: "external",
  provider: "Klarwerk (deterministisch)",
  model: "ohne generatives Modell",
  adminConfiguredMode: "external",
  effectiveMode: "external",
  deviation: false,
  deviationReason: null,
  externalConsentRequired: true,
  externalConsentGranted: true,
  executionAllowed: false,
  blockedReason: "external_not_migrated",
  resolvedAt: "2026-08-28T12:00:00.000Z",
  // JOB 3056 Runde 8: die Frist der Aufloesung muss in der ZUKUNFT liegen — seit Runde 8 verwirft
  // klaraS4Anzeige eine abgelaufene Aufloesung ganz (Pflicht 9: „–" statt Cache-Wert), und die
  // Faelle hier pruefen den Zustimmungs- und Sperrsatz eines GUELTIGEN Stands. Das feste Datum
  // 2026-08-28 war am 05.09.2026 abgelaufen und bestand nur, weil das Panel bis dahin abgelaufene
  // Werte weiterzeigte.
  expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  policyVersion: "p1",
  configurationVersion: "c1",
};

describe("JOB 2621 · Befund 2 — ohne Sitzung nennt die Zeile die URSACHE, nie den Scheinverlust", () => {
  it("W1 — keine Sitzung: die Ursache-Zeile (nicht verloren!) statt des Kein-Stand-Satzes, dreisprachig", async () => {
    panel = createKlaraPanel({
      routes: { "/api/klara/sessions": reply(401, { error: "UNAUTHENTICATED" }) },
    });
    await panel.flush();

    const zeile = panel.text("#klara-s4-session");
    expect(zeile).toBe(panel.t("s4SitzungNichtAngemeldet"));
    expect(zeile).toContain("Nicht angemeldet");
    expect(zeile).toContain("geht dabei nicht verloren");
    // DER ALTE SATZ ERSCHEINT IN DIESEM ZUSTAND GAR NICHT MEHR (Auftrag §1, letzter Satz).
    expect(zeile).not.toContain("kein Stand vor");
    // Drei Sprachen, dieselbe Ursache-Aussage (mega35: jeder Schluessel dreisprachig UND lebendig).
    panel.setLang("en");
    expect(panel.text("#klara-s4-session")).toContain("it is not lost");
    panel.setLang("nl");
    expect(panel.text("#klara-s4-session")).toContain("gaat daarbij niet verloren");
  });

  it("W1-GEGENPROBE — mit Sitzung und Aufloesung traegt die Zeile den Zustimmungsstand, nicht die Anmelde-Ursache", async () => {
    panel = createKlaraPanel({
      routes: {
        "/api/klara/sessions": reply(200, SITZUNG),
        "/api/klara/ai-status": reply(200, AUFLOESUNG_GESPERRT_TROTZ_ZUSTIMMUNG),
      },
    });
    await panel.flush();

    const zeile = panel.text("#klara-s4-session");
    expect(zeile).toBe(panel.t("s4Sitzung", { stand: panel.t("s4ConsentGranted") }));
    expect(zeile).not.toContain("Nicht angemeldet");
  });
});

describe("JOB 2621 · Befund 3 — erst die Zustimmung, dann das andere Tor mit benanntem Bezug", () => {
  it("W2 — Zustimmung erteilt + projektseitig gesperrt: Trotzdem-gesperrt-Satz UNTER der Zustimmungszeile", async () => {
    panel = createKlaraPanel({
      routes: {
        "/api/klara/sessions": reply(200, SITZUNG),
        "/api/klara/ai-status": reply(200, AUFLOESUNG_GESPERRT_TROTZ_ZUSTIMMUNG),
      },
    });
    await panel.flush();

    // (1) Der Wortlaut benennt den Bezug: kein nacktes „Gesperrt" mehr neben erteilter Zustimmung.
    const sperrzeile = panel.text("#klara-s4-deviation");
    expect(sperrzeile).toBe(
      panel.t("s4BlockiertTrotzZustimmung", { grund: panel.t("s4ReasonExternalNotMigrated") }),
    );
    expect(sperrzeile).toContain("Trotzdem gesperrt");
    expect(sperrzeile).toContain("noch nicht freigeschaltet");
    expect(sperrzeile).toContain("entscheidet nicht dein Fenster");
    // (2) Die REIHENFOLGE im ausgelieferten Markup: Zustimmungszeile VOR Sperrzeile — gemessen an
    //     der Datei, nicht behauptet.
    const html = readFileSync(
      resolve(process.cwd(), "apps/web/public/word-addin/taskpane.html"),
      "utf8",
    );
    const { markup } = splitTaskpane(html);
    const posSession = markup.indexOf('id="klara-s4-session"');
    const posDeviation = markup.indexOf('id="klara-s4-deviation"');
    expect(posSession).toBeGreaterThan(0);
    expect(posDeviation).toBeGreaterThan(0);
    expect(posSession, "Zustimmungszeile muss VOR der Sperrzeile stehen").toBeLessThan(
      posDeviation,
    );
  });

  it("W2-GEGENPROBE — OHNE erteilte Zustimmung bleibt der bisherige Sperrsatz, ohne Trotzdem-Bezug", async () => {
    panel = createKlaraPanel({
      routes: {
        "/api/klara/sessions": reply(200, { ...SITZUNG, consentState: "none" }),
        "/api/klara/ai-status": reply(200, {
          ...AUFLOESUNG_GESPERRT_TROTZ_ZUSTIMMUNG,
          externalConsentGranted: false,
          blockedReason: "external_consent_missing",
        }),
      },
    });
    await panel.flush();

    const sperrzeile = panel.text("#klara-s4-deviation");
    expect(sperrzeile).toBe(
      panel.t("s4Blockiert", { grund: panel.t("s4ReasonExternalConsentMissing") }),
    );
    expect(sperrzeile).not.toContain("Trotzdem");
  });
});

// JOB 3056 K1 (Mockups 04.09.): der Stand hat wieder EINE Stelle — den Fuss der Einstellungen
// („Klara <Stand>", Einstellungen.dc.html Z.68). Der Kopf-Spiegel von JOB 2621 §3 ist mit dem alten
// Kopfband gefallen; Pedis Befund 1 („wo ist der Stand?") beantwortet jetzt das Zahnrad: die
// Einstellungen sind der eine Ort fuer alles, was nicht Frage oder Antwort ist.
describe("JOB 2621 · Befund 1 — der Stand steht dort, wo gesucht wird, aus EINER Quelle", () => {
  it("W3 — der Stand steht im Fuss der Einstellungen, aus KLARA_STAND, an genau einer Stelle", async () => {
    panel = createKlaraPanel({});
    await panel.flush();

    // Im Quellstand der Build-Platzhalter → „dev"; die Zeile traegt „Klara " davor.
    expect(panel.text("#kw-stand")).toBe("dev");
    expect(panel.text("#kw-stand-zeile").replace(/\s+/g, " ").trim()).toBe("Klara dev");
    // GENAU EINE Stelle: der Kopf-Spiegel ist weg, kein zweites Element traegt den Stand.
    expect(panel.q("#kw-stand-kopf")).toBeNull();
    const html = readFileSync(
      resolve(process.cwd(), "apps/web/public/word-addin/taskpane.html"),
      "utf8",
    );
    const { markup } = splitTaskpane(html);
    expect(markup.split('id="kw-stand"').length - 1).toBe(1);
    // Die Stelle liegt in den Einstellungen (hinter dem Zahnrad), nicht im Kopf und nicht in
    // einem Reiter-Abschnitt.
    const einstellungen = markup.slice(
      markup.indexOf('id="kw-einstellungen"'),
      markup.indexOf('id="kw-hilfe"'),
    );
    expect(einstellungen).toContain('id="kw-stand"');
    expect(markup.slice(markup.indexOf("<header"), markup.indexOf("</header>"))).not.toContain(
      "kw-stand",
    );
    // EINE Quelle: die Stelle wird aus kwStandText gespeist, und es gibt weiterhin genau EINE
    // KLARA_STAND-Deklaration.
    expect(panel.scriptSource).toContain(
      'document.getElementById("kw-stand").textContent = kwStandText',
    );
    expect(panel.scriptSource).not.toContain("kw-stand-kopf");
    expect(panel.scriptSource.split("var KLARA_STAND =").length).toBe(2);
    // KEINE Handpflege: der Wert bleibt der Build-Platzhalter-Mechanismus (Befunde-Datei, Schluss).
    expect(panel.scriptSource).toContain('"__KLARA_STAND__"');
  });
});
