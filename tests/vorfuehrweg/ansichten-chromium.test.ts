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
  /**
   * Texte, die vor der Aufnahme IM BILDAUSSCHNITT stehen müssen — vollständig innerhalb des
   * Fensters und an ihrer Stelle zuoberst, also nicht von einem Banner oder einer Karte verdeckt.
   * Das ist das Demo-Ergebnis der Station; Text irgendwo im Dokument genügt nicht.
   */
  beweis: string[];
  /** Bedienelemente, die vor der Aufnahme der Reihe nach geklickt werden (reguläre Bedienung). */
  klicks?: string[];
  /**
   * Wohin der Ausschnitt gerückt wird: ein Selektor (oberer Rand) — ohne Angabe der erste
   * Nachweistext (mittig).
   */
  zeigen?: string;
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
      // Karls Erfahrung selbst, nicht nur der Titel in der Trefferliste: der Kern seiner Aussage
      // steht nur in der geöffneten Lesefläche.
      kennung: "lagerfall",
      pfad: `/bibliothek?q=${q(de ? "Hauptlager" : "main bearing")}`,
      warteAuf: '[data-testid="bib-suche"]',
      beweis: [
        de
          ? "legt er die Hand auf das Gehäuse des Hauptlagers der Presse 3"
          : "he puts his hand on the housing of the main bearing of press 3",
      ],
    },
    {
      // Der geöffnete Fassungsverlauf: „Mehr“ → Abschnitt „schnappschuesse“, darin V1, V2, V3.
      kennung: "schweissnaht",
      pfad: `/bibliothek?q=${q(de ? "Schweißnaht" : "Weld seam")}`,
      warteAuf: '[data-testid="bib-suche"]',
      klicks: ['[data-testid="bib-mehr"]', '[data-bib-abschnitt="schnappschuesse"] > summary'],
      // V2 zuerst: ausgerichtet wird mittig auf den ersten Nachweis, und die mittlere Fassung
      // liegt in der Liste zwischen den beiden anderen — gleich, wie die Liste sortiert ist.
      beweis: [t.koSchweissV2.title, t.koSchweissV1.title, t.koSchweiss.title],
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
      ...(de ? {} : { klicks: ['label[for="language-en"]'] }),
    },
  ];
}

/**
 * In der Seite: steht jeder Text IM BILD?
 *
 * ERST AUSRICHTEN, DANN PRÜFEN — BEI JEDEM BLICK. Die Lesefläche lädt nach (Kenntnisnahme-Karte,
 * Fassungsliste) und verschiebt dabei ihren Inhalt; ein einmaliges `scrollIntoView` vor dem Laden
 * zeigte danach daneben. Ausgerichtet wird an `selektor` (oberer Rand) oder am ersten Nachweistext
 * (mittig), und zwar vor jeder Prüfung neu.
 *
 * SICHTBAR HEISST: je Text das tiefste Element, das ihn ganz enthält, liegt vollständig im Fenster,
 * und an seiner OBEREN LINKEN und UNTEREN RECHTEN Ecke liegt es zuoberst (`elementFromPoint`).
 * Ein Banner oder eine Karte darüber zählt damit als verdeckt, ein vom scrollenden Lesebereich
 * abgeschnittener Text als nicht im Bild — die Fenstergrenze allein sieht diesen Schnitt nicht.
 */
const IM_BILD = `({ texte, selektor }) => {
  const enthaelt = (text) => (el) => (el.textContent || '').includes(text);
  const tiefste = (text) => [...document.querySelectorAll('body *')].filter(
    (el) => enthaelt(text)(el) && ![...el.children].some(enthaelt(text)),
  );
  const anker = selektor
    ? document.querySelector(selektor)
    : texte.length > 0
      ? tiefste(texte[0]).find((el) => el.getBoundingClientRect().height > 0) || null
      : null;
  if (anker) anker.scrollIntoView({ block: selektor ? 'start' : 'center' });
  const oben = (el, x, y) => {
    const treffer = document.elementFromPoint(x, y);
    return treffer !== null && (treffer === el || el.contains(treffer) || treffer.contains(el));
  };
  return texte.every((text) => tiefste(text).some((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    if (r.top < 0 || r.left < 0 || r.bottom > innerHeight || r.right > innerWidth) return false;
    return oben(el, r.left + 2, r.top + 2) && oben(el, r.right - 2, r.bottom - 2);
  }));
}`;

/** Der Nutzungshinweis wird regulär bestätigt (`legal/NoticeBanner.tsx`, Knopf `notice-ack`). */
async function hinweisBestaetigen(stand: Stand): Promise<void> {
  const seite = stand.seite;
  if (seite === null) return;
  const knopf = seite.getByTestId("notice-ack");
  if ((await knopf.count()) > 0 && (await knopf.isVisible())) {
    await knopf.click();
    await seite.getByTestId("notice-banner").waitFor({ state: "hidden" });
  }
}

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
      if (stand.fehler === null) {
        await hinweisBestaetigen(stand);
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
        // Kein Nutzungshinweis über der Aufnahme — er wurde beim Aufbau bestätigt.
        expect(await seite.getByTestId("notice-banner").count(), "Nutzungshinweis offen").toBe(0);
        for (const selektor of ansicht.klicks ?? []) {
          await seite.locator(selektor).click();
        }
        const imBild = { texte: ansicht.beweis, selektor: ansicht.zeigen ?? null };
        await seite.waitForFunction(fn(IM_BILD), imBild, { timeout: 30_000 });
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
