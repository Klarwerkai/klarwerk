// ================================================================================================
// AUFNAHME 20260922 · GESAMT-DEMO-ERKLAERMODUS — DIE BILDSCHIRMANSICHTEN DES VORFÜHRWEGS.
// ================================================================================================
//
// Der Vorführweg (`apps/web/public/demonstration/vorfuehrweg.html`) verlinkt je Station eine
// Bildschirmansicht `vorfuehrweg-ansichten/<station>.png` (Deutsch) bzw. `<station>-en.png`
// (Englisch). Diese Datei NIMMT SIE AUF — an der GEBAUTEN App (`apps/web/dist`) in echtem Chromium,
// über den vorhandenen Prüfstand `tests/design/h6-chromium.ts`, mit Demodaten, die über die echte
// Route `POST /api/admin/demo-seed` geladen wurden (Betriebsschalter `KLARWERK_DEMO_SEED`, nur für
// diesen Prüfstand gesetzt). Je Sprache eine eigene Instanz: Demodaten in dieser Sprache geladen,
// Oberfläche über die Sprachwahl des Produkts in dieser Sprache.
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
import {
  type Stand,
  WURZEL,
  beende,
  fn,
  setzeSprache,
  starte,
  wechsle,
} from "../design/h6-chromium";

// Der Schalter wird beim Aufbau der App gelesen (`feature-flags.ts`, `schalterAn`) — also vor
// `starte`, das die App erst in `beforeAll` baut.
process.env.KLARWERK_DEMO_SEED = "1";

const SCHREIBEN = process.env.KLARWERK_VORFUEHRWEG_ANSICHTEN === "schreiben";
const ZIEL = SCHREIBEN
  ? join(WURZEL, "apps", "web", "public", "demonstration", "vorfuehrweg-ansichten")
  : join(WURZEL, ".local", "run", "vorfuehrweg-ansichten");

const q = (wert: string): string => encodeURIComponent(wert);

type Sprache = "de" | "en";

interface Ansicht {
  /** Dieselbe Kennung wie `data-station` im Vorführweg; der Bildname hängt davon ab. */
  kennung: string;
  pfad: string;
  warteAuf: string;
  /** Texte, die sichtbar sein müssen, bevor aufgenommen wird — das Demo-Ergebnis der Station. */
  beweis: string[];
  /** Ein Bedienelement, das vor der Aufnahme geklickt wird (die Sprachwahl der Erklärseite). */
  klick?: string;
  /**
   * Die Station zeigt einen bestimmten Konflikt: die Konfliktseite zeigt immer genau EINEN, den
   * jüngsten zuerst (`lib/findingGroups.ts`, nach `createdAt` absteigend). Welcher der beiden
   * Demo-Konflikte das ist, hängt davon ab, ob sie in derselben Millisekunde entstanden — die
   * Vorwahl über `?fall=<id>` (derselbe Weg wie aus der Aufgabenliste, `lib/fallAbsprung.ts`)
   * macht die Ansicht davon unabhängig.
   */
  mitFall?: true;
}

/** Der Bildname je Sprache — derselbe, den der Vorführweg verlinkt. */
function bildname(kennung: string, sprache: Sprache): string {
  return sprache === "de" ? `${kennung}.png` : `${kennung}-en.png`;
}

function ansichten(sprache: Sprache): readonly Ansicht[] {
  const t = DEMO_TEXTS[sprache];
  const de = sprache === "de";
  const frage = de
    ? "Wie oft muss Filter F3 geprüft werden?"
    : "How often does filter F3 have to be checked?";
  return [
    {
      kennung: "demodaten",
      pfad: "/admin?bereich=vorfuehrdaten&detail=demo",
      warteAuf: '[data-testid="detail-demodaten"]',
      beweis: [],
    },
    { kennung: "start", pfad: "/start", warteAuf: '[data-testid="page-start"]', beweis: [] },
    {
      kennung: "bibliothek",
      pfad: `/bibliothek?q=${q(de ? "Lieferanten" : "Suppliers")}`,
      warteAuf: '[data-testid="bib-suche"]',
      beweis: [t.koLieferantFrei.title, t.koLieferantSchutz.title],
    },
    {
      kennung: "fragen",
      pfad: `/fragen?q=${q(frage)}`,
      warteAuf: '[data-testid="page-fragen"]',
      beweis: [],
    },
    {
      kennung: "lagerfall",
      pfad: `/bibliothek?q=${q(de ? "Hauptlager" : "main bearing")}`,
      warteAuf: '[data-testid="bib-suche"]',
      beweis: [t.koLagerKarl.title],
    },
    {
      kennung: "schweissnaht",
      pfad: `/bibliothek?q=${q(de ? "Schweißnaht" : "Weld seam")}`,
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
      // Beide Seiten des Vorwärmungs-Konflikts, so wie die Station sie beschreibt.
      beweis: [t.koWarm.title, t.koNoWarm.title],
      mitFall: true,
    },
    {
      kennung: "importwege",
      pfad: "/demonstration/importwege.html",
      warteAuf: "h1",
      beweis: [
        de
          ? "Aus Jira und Confluence wird nutzbares Wissen"
          : "Turn Jira and Confluence content into usable knowledge",
      ],
      ...(de ? {} : { klick: 'label[for="language-en"]' }),
    },
  ];
}

const SICHTBAR = "(liste) => liste.every((text) => document.body.innerText.includes(text))";

for (const sprache of ["de", "en"] as const) {
  describe(`Vorführweg · Bildschirmansichten der gebauten Fassung mit Demodaten (${sprache})`, () => {
    let stand: Stand;
    /** Die Kennung des Vorwärmungs-Konflikts, gelesen über die echte Route. */
    let vorwaermung = "";

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
          payload: { locale: sprache },
        });
        if (laden.statusCode !== 200) {
          throw new Error(`Demodaten laden: HTTP ${laden.statusCode} ${laden.body.slice(0, 200)}`);
        }
        if ((laden.json() as { skipped: boolean }).skipped) {
          throw new Error("Demodaten laden: übersprungen — der Bestand ist nicht der erwartete");
        }
        const offen = await app.inject({
          method: "GET",
          url: "/api/conflicts",
          headers: { authorization: `Bearer ${token}` },
        });
        type Fall = { id: string; detector?: { kollision?: { streitpunkt?: string } } };
        const streitpunkt = DEMO_TEXTS[sprache].warmConflict.streitpunkt;
        const fall = (offen.json() as Fall[]).find(
          (c) => c.detector?.kollision?.streitpunkt === streitpunkt,
        );
        if (!fall) {
          throw new Error(`Konflikt „${streitpunkt}“ fehlt nach dem Laden der Demodaten`);
        }
        vorwaermung = fall.id;
      });
      if (sprache !== "de" && stand.fehler === null) {
        // Die Sprachwahl des Produkts — gewartet wird auf `<html lang>`, nicht auf eine Frist.
        await setzeSprache(stand, sprache);
      }
    }, 180_000);

    afterAll(async () => {
      await beende(stand);
    });

    it("der Prüfstand steht: gebaute App, Demodaten über die echte Route geladen", () => {
      expect(stand.fehler).toBeNull();
    });

    for (const ansicht of ansichten(sprache)) {
      it(`${ansicht.kennung}: zeigt sein Demo-Ergebnis und wird als Bild abgelegt`, async () => {
        expect(stand.fehler).toBeNull();
        const pfad = ansicht.mitFall ? `${ansicht.pfad}?fall=${q(vorwaermung)}` : ansicht.pfad;
        await wechsle(stand, pfad, ansicht.warteAuf);
        expect(stand.fehler, `${ansicht.kennung}: Station nicht erreicht`).toBeNull();
        const seite = stand.seite;
        if (seite === null) return;
        if (ansicht.klick !== undefined) {
          await seite.locator(ansicht.klick).click();
        }
        await seite.waitForFunction(fn(SICHTBAR), ansicht.beweis, { timeout: 30_000 });
        const datei = join(ZIEL, bildname(ansicht.kennung, sprache));
        await seite.screenshot({ path: datei });
        const bytes = readFileSync(datei);
        // Ein leeres oder einfarbiges Bild wäre deutlich kleiner; der Wert ist eine Untergrenze.
        expect(bytes.length, `${ansicht.kennung}: Bild zu klein`).toBeGreaterThan(5_000);
        const pruefsumme = createHash("sha256").update(bytes).digest("hex");
        console.log(
          `Ansicht ${ansicht.kennung} (${sprache}): ${datei} · ${bytes.length} B · sha256 ${pruefsumme}`,
        );
      }, 90_000);
    }
  });
}
