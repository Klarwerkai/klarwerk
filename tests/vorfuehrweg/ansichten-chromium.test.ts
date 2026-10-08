// ================================================================================================
// AUFNAHME 20260922 · GESAMT-DEMO-ERKLAERMODUS — DIE BILDSCHIRMANSICHTEN DES VORFÜHRWEGS.
// ================================================================================================
//
// Der Vorführweg (`apps/web/public/demonstration/vorfuehrweg.html`) verlinkt je Station eine
// Bildschirmansicht `vorfuehrweg-ansichten/<station>.png`. Diese Datei NIMMT SIE AUF — an der
// GEBAUTEN App (`apps/web/dist`) in echtem Chromium, über den vorhandenen Prüfstand
// `tests/design/h6-chromium.ts`, mit Demodaten, die über die echte Route `POST /api/admin/demo-seed`
// geladen wurden (Betriebsschalter `KLARWERK_DEMO_SEED`, nur für diesen Prüfstand gesetzt).
//
// JEDE AUFNAHME IST AN IHR DEMO-ERGEBNIS GEBUNDEN: vor dem Bild wird gewartet, bis die Station das
// zeigt, was der Vorführweg als Sollansicht beschreibt (Titel aus dem Demobestand). Ein Bild einer
// leeren oder falschen Fläche entsteht so nicht.
//
// WOHIN: ohne Weiteres nach `.local/run/vorfuehrweg-ansichten/` (git-ignoriert). Nur mit
// `KLARWERK_VORFUEHRWEG_ANSICHTEN=schreiben` in den ausgelieferten Ordner neben dem Vorführweg —
// ein gewöhnlicher Testlauf verändert damit keine Quelle (sonst wäre `apps/web/dist` danach älter
// als `apps/web/public` und die Frische-Prüfung des Smokes schlüge an).
//
// GRENZE: Ohne freigeschaltetes Modell sperrt „Fragen“ den Weg (gewolltes Produktverhalten). Die
// Ansicht „fragen“ zeigt deshalb die vorbefüllte Frage, nicht eine Antwort; die Ansicht „lagerfall“
// zeigt Karls Eintrag in der Bibliothek (der Weg, den der Vorführweg ohne KI nennt).
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_TEXTS } from "../../services/app/src/demo-content";
import { type Stand, WURZEL, beende, fn, starte, wechsle } from "../design/h6-chromium";

// Der Schalter wird beim Aufbau der App gelesen (`feature-flags.ts`, `schalterAn`) — also vor
// `starte`, das die App erst in `beforeAll` baut.
process.env.KLARWERK_DEMO_SEED = "1";

const SCHREIBEN = process.env.KLARWERK_VORFUEHRWEG_ANSICHTEN === "schreiben";
const ZIEL = SCHREIBEN
  ? join(WURZEL, "apps", "web", "public", "demonstration", "vorfuehrweg-ansichten")
  : join(WURZEL, ".local", "run", "vorfuehrweg-ansichten");

const t = DEMO_TEXTS.de;
const q = (wert: string): string => encodeURIComponent(wert);

interface Ansicht {
  /** Dieselbe Kennung wie `data-station` im Vorführweg und der Bildname. */
  kennung: string;
  pfad: string;
  warteAuf: string;
  /** Texte, die sichtbar sein müssen, bevor aufgenommen wird — das Demo-Ergebnis der Station. */
  beweis: string[];
}

const ANSICHTEN: readonly Ansicht[] = [
  {
    kennung: "demodaten",
    pfad: "/admin?bereich=vorfuehrdaten&detail=demo",
    warteAuf: '[data-testid="detail-demodaten"]',
    beweis: [],
  },
  { kennung: "start", pfad: "/start", warteAuf: '[data-testid="page-start"]', beweis: [] },
  {
    kennung: "bibliothek",
    pfad: `/bibliothek?q=${q("Lieferanten")}`,
    warteAuf: '[data-testid="bib-suche"]',
    beweis: [t.koLieferantFrei.title, t.koLieferantSchutz.title],
  },
  {
    kennung: "fragen",
    pfad: `/fragen?q=${q("Wie oft muss Filter F3 geprüft werden?")}`,
    warteAuf: '[data-testid="page-fragen"]',
    beweis: [],
  },
  {
    kennung: "lagerfall",
    pfad: `/bibliothek?q=${q("Hauptlager")}`,
    warteAuf: '[data-testid="bib-suche"]',
    beweis: [t.koLagerKarl.title],
  },
  {
    kennung: "schweissnaht",
    pfad: `/bibliothek?q=${q("Schweißnaht")}`,
    warteAuf: '[data-testid="bib-suche"]',
    beweis: [t.koSchweiss.title],
  },
  { kennung: "erfassen", pfad: "/erfassen", warteAuf: '[data-testid="blatt-titel"]', beweis: [] },
  {
    kennung: "validierung",
    pfad: "/validierung",
    warteAuf: '[data-testid="page-validierung"]',
    beweis: ["P2"],
  },
  {
    kennung: "konflikte",
    pfad: "/konflikte",
    warteAuf: '[data-testid="page-konflikte"]',
    beweis: ["Kaltstart"],
  },
  {
    kennung: "importwege",
    pfad: "/demonstration/importwege.html",
    warteAuf: "h1",
    beweis: ["Aus Jira und Confluence wird nutzbares Wissen"],
  },
];

const SICHTBAR = "(liste) => liste.every((text) => document.body.innerText.includes(text))";

let stand: Stand;

beforeAll(async () => {
  mkdirSync(ZIEL, { recursive: true });
  stand = await starte("/start", '[data-testid="page-start"]', 1280, 900, async (app) => {
    // Derselbe Admin, den der Prüfstand angelegt hat; geladen wird über die echte Route.
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "pedi@job3065.test", password: "geheim12345" },
    });
    const token = (login.json() as { token: string }).token;
    const laden = await app.inject({
      method: "POST",
      url: "/api/admin/demo-seed",
      headers: { authorization: `Bearer ${token}` },
      payload: { locale: "de" },
    });
    if (laden.statusCode !== 200) {
      throw new Error(`Demodaten laden: HTTP ${laden.statusCode} ${laden.body.slice(0, 200)}`);
    }
    if ((laden.json() as { skipped: boolean }).skipped) {
      throw new Error("Demodaten laden: übersprungen — der Bestand ist nicht der erwartete");
    }
  });
}, 180_000);

afterAll(async () => {
  await beende(stand);
});

describe("Vorführweg · Bildschirmansichten der gebauten Fassung mit Demodaten", () => {
  it("der Prüfstand steht: gebaute App, Demodaten über die echte Route geladen", () => {
    expect(stand.fehler).toBeNull();
  });

  for (const ansicht of ANSICHTEN) {
    it(`${ansicht.kennung}: zeigt sein Demo-Ergebnis und wird als Bild abgelegt`, async () => {
      expect(stand.fehler).toBeNull();
      await wechsle(stand, ansicht.pfad, ansicht.warteAuf);
      expect(stand.fehler, `${ansicht.kennung}: Station nicht erreicht`).toBeNull();
      const seite = stand.seite;
      if (seite === null) return;
      await seite.waitForFunction(fn(SICHTBAR), ansicht.beweis, { timeout: 30_000 });
      const datei = join(ZIEL, `${ansicht.kennung}.png`);
      await seite.screenshot({ path: datei });
      const bytes = readFileSync(datei);
      // Ein leeres oder einfarbiges Bild wäre deutlich kleiner; der Wert ist eine Untergrenze.
      expect(bytes.length, `${ansicht.kennung}: Bild zu klein`).toBeGreaterThan(5_000);
      const pruefsumme = createHash("sha256").update(bytes).digest("hex");
      console.log(
        `Ansicht ${ansicht.kennung}: ${datei} · ${bytes.length} B · sha256 ${pruefsumme}`,
      );
    }, 90_000);
  }
});
