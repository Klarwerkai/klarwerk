// ================================================================================================
// MR-SELECT-1 / R-1567 · Ben-Befund P1 (Restrunde gesamt-ki-laufprotokoll:2, Runde 3) —
// DIE NEUE select-ID IN DER LAUFKARTE, OHNE MAUS ERREICHT, IM ECHTEN CHROMIUM.
// ================================================================================================
//
// BENS BEFUND ZU RUNDE 2: `kette-anfrage-bis-laufkarte.test.tsx` (K5) verbindet die ID-Kette, mountet
// die Seite aber direkt und drückt keine einzige Taste. Seine Sichtprüfung las nur Attribute und
// `style.display`; mit `[data-testid="mrun-card"] { display: none !important; }` aus einem
// Stylesheet blieb K5 grün. Tastaturzugang und Lesbarkeit waren damit nicht belegt.
//
// WAS HIER ECHT IST:
//   · eine echte Fastify-Instanz auf einem echten Port, mit der GEBAUTEN Fläche (`apps/web/dist`,
//     `registerWebStatic` wie `server.ts`) und der echten Auswahl-Route; ersetzt sind nur der
//     Modell-Client und die Confluence-Quelle (dieselbe Lage wie `route-einstieg.test.ts`);
//   · die Auswahl-Anfrage geht über HTTP mit dem Sitzungskeks der Ersteinrichtung. Die neue
//     select-ID wird über `GET /api/model-runs` derselben Instanz gelesen — sie war vorher nicht da;
//   · ein echtes Chromium, angemeldet über die echte Maske, AUSSCHLIESSLICH per Tastatur: Tab,
//     sichtbarer Fokus, Enter. Weg: Zahnrad → „Bereiche“ → „Kapital-Sichten“ (in der Sprache der
//     Anwenderin) → `/kapital`. In dieser Datei steht kein `.click(`;
//   · LESBAR heißt: die Zeile genau dieser ID trägt die übersetzte Art und das Modell SICHTBAR, je
//     Textknoten gemessen (`mussSichtbarTragen`: `checkVisibility` samt Deckkraft, Fläche des
//     Textes). Danach wird per Tab bis zur Zeitraumwahl der Auswertungskarte direkt darunter
//     weitergegangen; dabei rollt Chromium die Seite. Die Zeile muss dann im Fenster stehen und an
//     ihrem Mittelpunkt von nichts verdeckt sein.
//
// KALIBRIERUNG IM SELBEN LAUF (K7, K8): Bens Stylesheet-Verstellung muss die Sichtprüfung rot
// machen, und ein aus der Tab-Folge genommener Menüpunkt muss den Tastaturweg rot machen. Bleibt
// eine der beiden Verstellungen grün, misst der Nachweis nichts.
//
// DIE ROLLE: der Administrator der Ersteinrichtung; „Kapital-Sichten“ verlangt `admin` und Stufe 2
// (`navigation.ts`, `kw.stufe2.v1`). Die Stufe-2-Wahl wird im Profil gesetzt — sie ist eine
// gespeicherte Einstellung der Anwenderin und nicht Gegenstand dieses Wegs.
//
// NICHT GEMESSEN: PostgreSQL (`PgModelRunRepo`; die Instanz läuft mit den Speicherfassungen),
// echte Anbieter-API, andere Browser, Bildschirmleser. Kein Überspringen: fehlt `apps/web/dist`, wird
// es gebaut oder der Lauf wird rot (`stelleFlaecheBereit`, `starteChromium`).
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { makeGuards } from "../../services/app/src/http";
import { confluenceImportRoutes } from "../../services/app/src/routes/confluence-import-routes";
import { registerWebStatic } from "../../services/app/src/web-static";
import type { Sprache } from "../../services/auth/src/meldungen";
import type { ConfluenceSourceAdapter } from "../../services/confluence";
import type { ImportItem } from "../../services/library-analytics";
import {
  InMemoryModelRunRepo,
  type ModelRunRecord,
  ModelRunService,
} from "../../services/model-runs";
import { DeterministicProvider, ModelProvider, Reasoner } from "../../services/reasoner";
import { cappedModelClient } from "../../services/reasoner/src/model-concurrency";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";
import {
  type Browser,
  DIST,
  type Kontext,
  type Seite,
  fn,
  starteChromium,
  tabBisZu,
  warte,
} from "../gast-nutzerweg/browserweg";
import {
  PASSWORT,
  Sitzung,
  type Strecke,
  ersteinrichtung,
  mussGelingen,
} from "../gast-nutzerweg/strecke";
import {
  meldeAnMitTastatur,
  mussSichtbarTragen,
  stelleFlaecheBereit,
  tabBisBeschriftungUndEnter,
} from "../gesamtanweisung-nutzerweg/weg";
import {
  FLAECHE_STEHT_AUF,
  SPRACHEN,
  klappeBereicheAuf,
  oeffneZahnrad,
  profilFuer,
} from "../gesamtanweisung-tastaturweg/weg";
import { sprachbestand } from "../support/i18nBestand";

const MARKE = "MR-SELECT-1 TASTATURWEG";
const ADMIN = "laufkarte-admin@mr-select-1.test";

const KAPITAL_EINTRAG = '[data-testid="bereich-kapital"]';
const KAPITAL_PFAD = "/kapital";
const ZEITRAUM = '[data-testid="mrun-auswertung-zeitraum"]';
const KARTE = '[data-testid="mrun-card"]';

// Dieselbe Lage wie in `route-einstieg.test.ts`: vollständig „intern" eingestuft, damit der Satz
// nicht vertraulich ist und das Modell in der Kette bleibt.
const ITEMS: ImportItem[] = [
  {
    title: "Wartung Pumpe",
    statement: "Die Pumpe wird jährlich gewartet.",
    type: "best_practice",
    category: "K",
    author: "Anna",
    tags: ["wartung"],
    sourceScope: "SPACE-K",
    updatedAt: "2020-01-01T00:00:00.000Z",
    confidentiality: "intern",
  },
];

const quelle = {
  source: "Confluence",
  collect: async () => ITEMS,
  collectAll: async () => ({ items: ITEMS, failed: [], truncated: false }),
} as unknown as ConfluenceSourceAdapter;

// Wie `route-einstieg.test.ts`: diese Schalter würden eine zweite Import-Route verdrahten.
const SCHALTER = ["KLARWERK_CONFLUENCE_IMPORT", "KLARWERK_ADDON_API"];
const gesichert: Record<string, string | undefined> = {};

/** Die echte Instanz: EIN Protokoll-Repo für den Reasoner (schreibt) und die Lese-Route. */
async function starteKettenStrecke(): Promise<Strecke> {
  const repo = new InMemoryModelRunRepo();
  const services = buildServices();
  const reasoner = new Reasoner(
    new ModelProvider(
      cappedModelClient(
        {
          name: "anthropic:auswahl-modell",
          model: "auswahl-modell",
          complete: async () => '{"themes":["wartung"]}',
        },
        { rejectsConfidential: true },
      ),
    ),
    new DeterministicProvider(),
    repo,
  );
  await erteileKiFreigabe(reasoner);
  const mutable = services as unknown as { reasoner: Reasoner; modelRuns: ModelRunService };
  mutable.reasoner = reasoner;
  mutable.modelRuns = new ModelRunService({ repo });
  const app = buildApp(services);
  app.register(
    confluenceImportRoutes({
      library: services.library,
      koService: services.ko,
      guards: makeGuards(services.auth),
      reasoner,
      makeAdapter: () => quelle,
    }),
  );
  await registerWebStatic(app, DIST);
  await app.listen({ port: 0, host: "127.0.0.1" });
  const adresse = app.server.address() as AddressInfo | null;
  if (adresse === null || typeof adresse === "string") {
    await app.close();
    throw new Error(`${MARKE}: der Server hat keinen Port gemeldet.`);
  }
  const basis = `http://127.0.0.1:${adresse.port}`;
  return {
    app,
    basis,
    profil: (name, sprache) => new Sitzung(basis, name, sprache),
    schliessen: () => app.close(),
  };
}

let strecke: Strecke | undefined;
let browser: Browser | undefined;
let selectLauf: ModelRunRecord | undefined;

beforeAll(async () => {
  for (const k of SCHALTER) {
    gesichert[k] = process.env[k];
    delete process.env[k];
  }
  process.stderr.write(`${MARKE}: gebaute Fläche — ${stelleFlaecheBereit()}\n`);
  browser = await starteChromium();
  strecke = await starteKettenStrecke();
  const { sitzung } = await ersteinrichtung(strecke, ADMIN);
  // Der Rechtshinweis wird wie von einer wiederkehrenden Nutzerin quittiert — ein Band, das sonst
  // unter dem Seitenhauptbereich steht und nicht Gegenstand dieses Wegs ist.
  mussGelingen("Rechtshinweis quittieren", await sitzung.sende("POST", "/api/auth/notice"));

  const vorher = mussGelingen(
    "Laufliste vor der Auswahl",
    await sitzung.sende("GET", "/api/model-runs"),
  ).json as ModelRunRecord[];
  const auswahl = mussGelingen(
    "die echte Auswahl-Anfrage",
    await sitzung.sende("POST", "/api/admin/import/confluence/select", {
      prompt: "alles zum Thema Wartung",
      promptConfidential: false,
    }),
  );
  expect((auswahl.json as { inferenceStatus?: string }).inferenceStatus).toBe("ok");
  const nachher = mussGelingen(
    "Laufliste nach der Auswahl",
    await sitzung.sende("GET", "/api/model-runs"),
  ).json as ModelRunRecord[];
  const bekannt = new Set(vorher.map((r) => r.id));
  const neu = nachher.filter((r) => !bekannt.has(r.id));
  expect(neu, `${MARKE}: die Auswahl hat nicht genau einen neuen Lauf geschrieben`).toHaveLength(1);
  selectLauf = neu[0];
}, 900_000);

afterAll(async () => {
  await browser?.close();
  await strecke?.schliessen();
  for (const k of SCHALTER) {
    if (gesichert[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = gesichert[k];
    }
  }
}, 60_000);

function zeug(): { browser: Browser; strecke: Strecke; lauf: ModelRunRecord } {
  if (!browser || !strecke || !selectLauf) {
    throw new Error(
      `${MARKE}: Browser, Strecke oder select-Lauf fehlen — der Aufbau lief nicht durch.`,
    );
  }
  return { browser, strecke, lauf: selectLauf };
}

function zeileVon(id: string): string {
  // Die ID steht unverändert im Selektor; sie muss dafür eine schlichte Kennung sein.
  expect(id, `${MARKE}: die Lauf-ID ist keine schlichte Kennung`).toMatch(/^[\w-]+$/);
  return `[data-testid="mrun-row"][data-run-id="${id}"]`;
}

interface Soll {
  bereiche: string;
  kapital: string;
  art: string;
}

function soll(sprache: string): Soll {
  const bestand = sprachbestand(sprache);
  const hole = (schluessel: string): string => {
    const wert = bestand[schluessel];
    expect(wert, `${MARKE}: „${schluessel}" fehlt im Sprachkatalog „${sprache}"`).toBeTruthy();
    return wert as string;
  };
  return {
    bereiche: hole("menue.weitereBereiche"),
    kapital: hole("nav.capital"),
    art: hole("mrun.task.select"),
  };
}

/** Angemeldet (per Tastatur), Stufe 2 gespeichert, stehend auf `/start` in dieser Sprache. */
async function angemeldetAufStart(
  sprache: Sprache,
  vorbereiten?: (kontext: Kontext) => Promise<void>,
): Promise<{ kontext: Kontext; seite: Seite }> {
  const { browser: b, strecke: s } = zeug();
  const { kontext, seite } = await profilFuer(b, sprache);
  await kontext.addInitScript(`try { localStorage.setItem("kw.stufe2.v1", "1"); } catch (e) {}`);
  if (vorbereiten) {
    await vorbereiten(kontext);
  }
  await meldeAnMitTastatur(seite, s.basis, ADMIN, PASSWORT);
  await seite.goto(`${s.basis}/start`, { waitUntil: "domcontentloaded" });
  await warte(seite, FLAECHE_STEHT_AUF, `die Fläche steht auf „${sprache}"`, sprache, 45_000);
  return { kontext, seite };
}

/** Zahnrad → „Bereiche“ → „Kapital-Sichten“, nur Tab und Enter. Gibt die Anschläge zurück. */
async function zurKapitalseiteOhneMaus(seite: Seite, s: Soll, sprache: string): Promise<number> {
  const zahnrad = await oeffneZahnrad(seite, sprache);
  const bereiche = await klappeBereicheAuf(seite, s.bereiche, sprache);
  await warte(
    seite,
    "(sel) => !!document.querySelector(sel)",
    `der Menüpunkt „${s.kapital}" im aufgeklappten Untermenü (${sprache})`,
    KAPITAL_EINTRAG,
  );
  await mussSichtbarTragen(
    seite,
    KAPITAL_EINTRAG,
    s.kapital,
    `der Menüpunkt heißt in „${sprache}" nicht „${s.kapital}"`,
  );
  const eintrag = await tabBisBeschriftungUndEnter(
    seite,
    s.kapital,
    KAPITAL_EINTRAG,
    `Menüpunkt „${s.kapital}" (${sprache})`,
    120,
  );
  await warte(
    seite,
    "(p) => window.location.pathname === p",
    `die Adresse ${KAPITAL_PFAD} nach dem Menüweg (${sprache})`,
    KAPITAL_PFAD,
    45_000,
  );
  return zahnrad + bereiche + eintrag;
}

/** Die Zeile der ID ist da, und ihre Art und ihr Modell stehen SICHTBAR darin. */
async function zeileMussLesbarSein(
  seite: Seite,
  id: string,
  s: Soll,
  sprache: string,
): Promise<string> {
  const zeile = zeileVon(id);
  await warte(
    seite,
    "(sel) => !!document.querySelector(sel)",
    `die Laufzeile der neuen select-ID ${id} auf ${KAPITAL_PFAD} (${sprache})`,
    zeile,
    45_000,
  );
  const text = await mussSichtbarTragen(
    seite,
    zeile,
    s.art,
    `die Laufzeile ${id} zeigt in „${sprache}" die Art „${s.art}" nicht sichtbar`,
  );
  expect(text, `${MARKE}: roher Schlüssel in der Laufzeile (${sprache})`).not.toContain("mrun.");
  await mussSichtbarTragen(
    seite,
    zeile,
    "auswahl-modell",
    `die Laufzeile ${id} nennt in „${sprache}" das Modell nicht sichtbar`,
  );
  return text;
}

const IM_FENSTER = `(sel) => {
  const z = document.querySelector(sel);
  if (!z) return { da: false, imFenster: false, unverdeckt: false, lage: "" };
  const r = z.getBoundingClientRect();
  const oben = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return {
    da: true,
    imFenster: r.width > 0 && r.height > 0 && r.top >= 0 && r.left >= 0
      && r.bottom <= window.innerHeight && r.right <= window.innerWidth,
    unverdeckt: !!oben && z.contains(oben),
    lage: "oben=" + Math.round(r.top) + " unten=" + Math.round(r.bottom) + " fenster=" + window.innerHeight
      + " Mittelpunkt trifft <" + (oben ? oben.tagName.toLowerCase() : "nichts") + ">",
  };
}`;

describe("MR-SELECT-1 · neue select-ID → Laufkarte, ohne Maus, im echten Chromium", () => {
  for (const sprache of SPRACHEN) {
    it(`K6 · ${sprache}: per Tab und Enter zu „Kapital-Sichten“, die Zeile der neuen ID steht lesbar und im Fenster`, async () => {
      const { lauf } = zeug();
      expect(lauf.task).toBe("select");
      expect(lauf.status).toBe("success");
      const s = soll(sprache);
      const { kontext, seite } = await angemeldetAufStart(sprache);
      try {
        const anschlaege = await zurKapitalseiteOhneMaus(seite, s, sprache);
        expect(
          anschlaege,
          `${MARKE}: der Menüweg (${sprache}) bestand aus keinem Tab`,
        ).toBeGreaterThan(2);
        const text = await zeileMussLesbarSein(seite, lauf.id, s, sprache);
        expect(text).toContain(s.art);

        // Weiter per Tab bis zur Zeitraumwahl der Auswertungskarte, die direkt unter der Laufkarte
        // steht. Chromium rollt dabei den Fokus ins Bild — die Laufzeile muss dann im Fenster
        // stehen und an ihrem Mittelpunkt sichtbar sein (nicht vom Kopfband verdeckt).
        const bisZeitraum = await tabBisZu(seite, ZEITRAUM, 400, true);
        expect(bisZeitraum).toBeGreaterThan(0);
        const lage = await seite.evaluate<{
          da: boolean;
          imFenster: boolean;
          unverdeckt: boolean;
          lage: string;
        }>(fn(IM_FENSTER), zeileVon(lauf.id));
        expect(lage.da).toBe(true);
        expect(
          lage.imFenster,
          `${MARKE}: die Laufzeile steht nach dem Tab-Weg nicht im Fenster (${sprache}) — ${lage.lage}`,
        ).toBe(true);
        expect(
          lage.unverdeckt,
          `${MARKE}: die Laufzeile ist an ihrem Mittelpunkt verdeckt (${sprache}) — ${lage.lage}`,
        ).toBe(true);
      } finally {
        await kontext.close();
      }
    }, 600_000);
  }

  it("K7 · Kalibrierung: mit per Stylesheet ausgeblendeter Laufkarte (Bens Verstellung) wird die Sichtprüfung rot", async () => {
    const { lauf } = zeug();
    const s = soll("de");
    const { kontext, seite } = await angemeldetAufStart("de");
    try {
      await zurKapitalseiteOhneMaus(seite, s, "de");
      await zeileMussLesbarSein(seite, lauf.id, s, "de");
      await seite.evaluate<boolean>(
        fn(`(sel) => {
          const stil = document.createElement("style");
          stil.textContent = sel + " { display: none !important; }";
          document.head.appendChild(stil);
          return true;
        }`),
        KARTE,
      );
      // Rot genau an der Sichtmessung (`mussSichtbarTragen`: keine Fläche), nicht an etwas anderem.
      await expect(zeileMussLesbarSein(seite, lauf.id, s, "de")).rejects.toThrow(/keine Fläche/);
    } finally {
      await kontext.close();
    }
  }, 600_000);

  it("K8 · Kalibrierung: ein aus der Tab-Folge genommener Menüpunkt macht den Tastaturweg rot", async () => {
    const s = soll("de");
    const { kontext, seite } = await angemeldetAufStart("de", (k) =>
      k.addInitScript(`(() => {
        const sperre = () => {
          for (const el of document.querySelectorAll('${KAPITAL_EINTRAG}')) {
            if (el.getAttribute("tabindex") !== "-1") el.setAttribute("tabindex", "-1");
          }
        };
        new MutationObserver(sperre).observe(document, { childList: true, subtree: true, attributes: true });
      })();`),
    );
    try {
      // Rot genau am Tab-Weg zum Menüpunkt (`tabBisText`), nicht am Zahnrad oder an „Bereiche“.
      await expect(zurKapitalseiteOhneMaus(seite, s, "de")).rejects.toThrow(/nur mit der Maus/);
      expect(
        await seite.evaluate<string>(fn("() => window.location.pathname")),
        `${MARKE}: der gesperrte Menüpunkt hat trotzdem zur Kapitalseite geführt`,
      ).not.toBe(KAPITAL_PFAD);
    } finally {
      await kontext.close();
    }
  }, 600_000);
});
