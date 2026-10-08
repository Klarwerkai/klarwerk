// ================================================================================================
// AUFNAHME 20260922 · GESAMT-NAVIGATION · R-1023 (b) / R-1813 — WELCHE FLÄCHEN SIND ÜBERLADEN?
// ================================================================================================
//
// Anforderung, wörtlich aus der Auftragsquelle (R-1023, Qualifikation): „überladene Flächen
// entlasten: erst mechanisch messen, welche Flächen die meisten gleichzeitig sichtbaren
// Bedienelemente und Zustandsangaben tragen, dann die zwei schlimmsten zusammenfassen oder
// aufklappbar machen (nicht löschen), mit Beleg vorher und nachher. Kandidaten:
// Wissensobjekt-Detail/Bearbeiten (SCRUM-513) und die Konflikt-/Duplikatdarstellung (SCRUM-486)."
//
// DIESE DATEI IST DAS MESSWERKZEUG UND DIE PRÜFUNG DER ANFORDERUNG ZUGLEICH.
//
// BÜHNE: die gebaute App (`apps/web/dist`) gegen die echte Fastify-App (`tests/design/h6-chromium.ts`),
// angemeldet als Admin der Ersteinrichtung, Stufe 2 aus, Deutsch, 1280 × 800. Damit Listen- und
// Detailflächen vergleichbar gefüllt sind, wird VOR dem ersten Seitenaufbau der vorhandene
// Demobestand geladen (`POST /api/admin/demo-seed`): Wissensobjekte, Prüfvorgänge, Konflikte,
// Doppelungen. Gemessen wird jede Navigationsfläche der Rolle plus die Detailflächen, die die
// Quelle nennt (Wissensobjekt lesen und bearbeiten, Konflikt- und Doppelungsvergleich).
//
// WAS GEZÄHLT WIRD, innerhalb von `<main>` (die Hülle mit Kopfband ist auf jeder Fläche gleich und
// zählt deshalb nicht), über die ganze Seitenhöhe und OHNE eine Interaktion:
//   · BEDIENELEMENTE — Links, Knöpfe, Eingaben, Auswahlen, Reiter, Menü-/Schalterrollen,
//     editierbare Felder; sichtbar (Fläche > 0, nicht versteckt, nicht `aria-hidden`/`inert`),
//     verschachtelte nur einmal.
//   · ZUSTANDSANGABEN — Statusflächen (`role=status`, `<output>`), Pillen/Abzeichen (gerundete
//     Kästchen mit Text) und Elemente, deren Kennung Status/Zustand/Pille/Chip/Abzeichen nennt;
//     nur mit Text, nur außerhalb von Bedienelementen.
//   · LAST = Bedienelemente + Zustandsangaben.
//
// VORHER UND NACHHER IM SELBEN LAUF: eine Entlastung ist ein Schalter mit
// `data-entlastung-schalter` (aufklappbar, `aria-expanded`). „Nachher" ist die Fläche, wie sie
// erscheint; „vorher" ist dieselbe Fläche mit allen Entlastungsschaltern aufgeklappt — das ist der
// volle Bestand, also der Zustand ohne Entlastung. Dass dabei kein Bedienelement verloren geht,
// ist damit zugleich gemessen: aufgeklappt muss jede Funktion wieder da sein.
//
//   F0  Bühne und Bestand: der Demobestand trägt Wissensobjekte, Konflikte und Doppelungen
//   F1  jede Fläche ist gemessen worden (keine Fläche still ausgefallen)
//   F2  DIE ANFORDERUNG: die zwei Flächen mit der höchsten Last (vorher) sind entlastet — sie
//       tragen Entlastungsschalter, und nachher ist ihre Last kleiner als vorher
//   P   Chromium hat keinen Seitenfehler gemeldet
//
// Die vollständige Rangliste (vorher / nachher je Fläche, mit den gezählten Elementen) steht im
// Lauf unter „R-1023b · Messung" und ist der Beleg vorher/nachher.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ORIGIN, type Stand, fn, starte } from "../design/h6-chromium";

const BREITE = 1280;
const HOEHE = 800;
const KENNUNG = "R-1023b · Messung";

/**
 * Die Flächen, die dieser Auftrag entlastet hat. Leer, solange nichts entlastet ist — F2 sagt dann
 * rot, WELCHE zwei es nach der Messung sein müssen.
 */
const ENTLASTET: readonly string[] = [];

interface Messung {
  fehler: string | null;
  steuer: number;
  zustand: number;
  schalter: number;
  steuerNamen: string[];
  zustandNamen: string[];
}

interface Flaeche {
  name: string;
  pfad: string;
}

interface Ergebnis {
  name: string;
  pfad: string;
  vorher: Messung;
  nachher: Messung;
}

/** In der Seite: Bedienelemente und Zustandsangaben in `<main>` zählen. */
const ZAEHLEN = `() => {
  const main = document.querySelector('main');
  if (!main) { return { fehler: 'kein <main>', steuer: 0, zustand: 0, schalter: 0, steuerNamen: [], zustandNamen: [] }; }
  const sichtbar = (el) => {
    if (el.closest('[aria-hidden="true"], [hidden], [inert]')) { return false; }
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) { return false; }
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0;
  };
  const aussen = (liste) => liste.filter((el) => !liste.some((o) => o !== el && o.contains(el)));
  const name = (el) => (el.getAttribute('data-testid') || el.getAttribute('aria-label') || (el.textContent || '').replace(/\\s+/g, ' ').trim() || el.tagName.toLowerCase()).slice(0, 48);
  const STEUER = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="radio"], [role="switch"], [role="combobox"], [contenteditable="true"]';
  const ZUSTAND = '[role="status"], output, [data-testid*="pille"], [data-testid*="status"], [data-testid*="zustand"], [data-testid*="chip"], [data-testid*="badge"], .rounded-full, .rounded-pill';
  const steuer = aussen([...main.querySelectorAll(STEUER)].filter(sichtbar));
  const zustand = aussen([...main.querySelectorAll(ZUSTAND)]
    .filter(sichtbar)
    .filter((el) => (el.textContent || '').trim().length > 0)
    .filter((el) => !el.closest(STEUER) && !el.querySelector(STEUER)));
  return {
    fehler: null,
    steuer: steuer.length,
    zustand: zustand.length,
    schalter: main.querySelectorAll('[data-entlastung-schalter]').length,
    steuerNamen: steuer.map(name),
    zustandNamen: zustand.map(name),
  };
}`;

/** In der Seite: jeden zugeklappten Entlastungsschalter aufklappen; Rückgabe: wie viele. */
const AUFKLAPPEN = `() => {
  const zu = [...document.querySelectorAll('main [data-entlastung-schalter][aria-expanded="false"]')];
  zu.forEach((s) => s.click());
  return zu.length;
}`;

let stand: Stand | null = null;
let token = "";
const bestand = { kos: 0, konflikte: 0, doppelungen: 0 };
const ergebnisse: Ergebnis[] = [];
const ausgefallen: string[] = [];

function s(): Stand {
  const st = stand as Stand;
  expect(st.fehler, `Prüfstand nicht bereit: ${st.fehler}`).toBeNull();
  return st;
}

async function api<T>(url: string): Promise<T> {
  const app = s().app;
  if (app === null) {
    throw new Error("keine App");
  }
  const antwort = await app.inject({
    method: "GET",
    url,
    headers: { authorization: `Bearer ${token}` },
  });
  if (antwort.statusCode >= 300) {
    throw new Error(`GET ${url}: HTTP ${antwort.statusCode} ${antwort.body.slice(0, 160)}`);
  }
  return antwort.json() as T;
}

/** Zählen, bis zwei Messungen hintereinander gleich sind — Nachladen soll nicht mitgezählt werden. */
async function zaehleStabil(): Promise<Messung> {
  const seite = s().seite;
  if (seite === null) {
    throw new Error("keine Seite");
  }
  let vorige: Messung | null = null;
  for (let i = 0; i < 24; i++) {
    await seite.waitForTimeout(500);
    const m = await seite.evaluate<Messung>(fn(ZAEHLEN));
    if (vorige !== null && m.steuer === vorige.steuer && m.zustand === vorige.zustand) {
      return m;
    }
    vorige = m;
  }
  return vorige as Messung;
}

async function miss(flaeche: Flaeche): Promise<void> {
  const seite = s().seite;
  if (seite === null) {
    throw new Error("keine Seite");
  }
  try {
    await seite.goto(`${ORIGIN}${flaeche.pfad}`, { waitUntil: "load", timeout: 60_000 });
    await seite.waitForFunction(fn("() => document.querySelector('main') !== null"), undefined, {
      timeout: 30_000,
    });
    const nachher = await zaehleStabil();
    // Vorher: alle Entlastungen aufgeklappt — so oft, bis keine mehr zu ist (verschachtelt).
    for (let i = 0; i < 5; i++) {
      const geklickt = await seite.evaluate<number>(fn(AUFKLAPPEN));
      if (geklickt === 0) {
        break;
      }
    }
    const vorher = nachher.schalter > 0 ? await zaehleStabil() : nachher;
    ergebnisse.push({ name: flaeche.name, pfad: flaeche.pfad, vorher, nachher });
  } catch (e) {
    ausgefallen.push(`${flaeche.name} (${flaeche.pfad}): ${String(e).split("\n")[0]}`);
  }
}

const last = (m: Messung): number => m.steuer + m.zustand;

describe("R-1023 (b) · überladene Flächen messen und die zwei schlimmsten entlasten", () => {
  beforeAll(async () => {
    stand = await starte("/start", "main", BREITE, HOEHE, async (app) => {
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "pedi@job3065.test", password: "geheim12345" },
      });
      token = (login.json() as { token: string }).token;
      const seed = await app.inject({
        method: "POST",
        url: "/api/admin/demo-seed",
        headers: { authorization: `Bearer ${token}` },
      });
      if (seed.statusCode >= 300) {
        throw new Error(`Demobestand: HTTP ${seed.statusCode} ${seed.body.slice(0, 200)}`);
      }
    });
    if (stand.fehler !== null) {
      return;
    }
    const kos = await api<{ id: string }[]>("/api/kos");
    const konflikte = await api<{ id: string }[]>("/api/conflicts");
    const doppelungen = await api<{ id: string }[]>("/api/duplicates");
    bestand.kos = kos.length;
    bestand.konflikte = konflikte.length;
    bestand.doppelungen = doppelungen.length;

    const flaechen: Flaeche[] = [
      { name: "Start", pfad: "/start" },
      { name: "Fragen", pfad: "/fragen" },
      { name: "Bibliothek", pfad: "/bibliothek" },
      { name: "Erfassen", pfad: "/erfassen" },
      { name: "Meine Entwürfe", pfad: "/entwuerfe" },
      { name: "Prüfen", pfad: "/validierung" },
      { name: "Offene Aufgaben", pfad: "/aufgaben" },
      { name: "Gesamtanweisungen", pfad: "/gesamtanweisungen" },
      { name: "Konflikte", pfad: "/konflikte" },
      { name: "Doppelungen", pfad: "/duplikate" },
      { name: "Risiken und Lücken", pfad: "/risiko" },
      { name: "Lebenszyklus", pfad: "/lebenszyklus" },
      { name: "Themenkarte", pfad: "/wissensnetz" },
      { name: "Externes Wissen", pfad: "/extern" },
      { name: "Analytics", pfad: "/analytics" },
      { name: "Einstellungen", pfad: "/admin" },
      { name: "Hilfe", pfad: "/hilfe" },
      { name: "Profil", pfad: "/profil" },
    ];
    const ko = kos[0]?.id;
    if (ko !== undefined) {
      flaechen.push({ name: "Wissensobjekt lesen", pfad: `/wissen/${ko}` });
      flaechen.push({ name: "Wissensobjekt bearbeiten", pfad: `/wissen/${ko}?edit=1` });
    }
    const konflikt = konflikte[0]?.id;
    if (konflikt !== undefined) {
      flaechen.push({ name: "Konfliktvergleich", pfad: `/konflikte/${konflikt}/vergleich` });
    }
    const doppelung = doppelungen[0]?.id;
    if (doppelung !== undefined) {
      flaechen.push({ name: "Doppelungsvergleich", pfad: `/duplikate/${doppelung}/vergleich` });
    }
    for (const flaeche of flaechen) {
      await miss(flaeche);
    }
    const rang = [...ergebnisse].sort((a, b) => last(b.vorher) - last(a.vorher));
    console.info(
      `${KENNUNG} · Bestand: ${bestand.kos} Wissensobjekte, ${bestand.konflikte} Konflikte, ${bestand.doppelungen} Doppelungen · ${BREITE}×${HOEHE}, de, Admin, Stufe 2 aus`,
    );
    rang.forEach((e, i) => {
      console.info(
        `${KENNUNG} · Rang ${i + 1} · ${e.name} (${e.pfad}) · vorher ${last(e.vorher)} (${e.vorher.steuer} Bedienelemente + ${e.vorher.zustand} Zustandsangaben) · nachher ${last(e.nachher)} (${e.nachher.steuer} + ${e.nachher.zustand}) · Entlastungsschalter ${e.nachher.schalter}`,
      );
    });
    for (const e of rang.slice(0, 6)) {
      console.info(
        `${KENNUNG} · Elemente ${e.name} vorher · Bedienelemente: ${e.vorher.steuerNamen.join(" | ")} · Zustandsangaben: ${e.vorher.zustandNamen.join(" | ")}`,
      );
    }
    for (const a of ausgefallen) {
      console.info(`${KENNUNG} · AUSGEFALLEN · ${a}`);
    }
  }, 900_000);

  afterAll(async () => {
    await stand?.browser?.close();
    await stand?.app?.close();
  }, 60_000);

  it("F0 · der Demobestand trägt Wissensobjekte, Konflikte und Doppelungen", () => {
    s();
    expect(bestand.kos, "keine Wissensobjekte").toBeGreaterThan(0);
    expect(
      bestand.konflikte,
      "keine Konflikte — der Konfliktvergleich wäre ungemessen",
    ).toBeGreaterThan(0);
    expect(
      bestand.doppelungen,
      "keine Doppelungen — der Doppelungsvergleich wäre ungemessen",
    ).toBeGreaterThan(0);
  });

  it("F1 · jede Fläche wurde gemessen", () => {
    s();
    expect(ausgefallen).toEqual([]);
    expect(ergebnisse.length).toBeGreaterThanOrEqual(20);
    for (const e of ergebnisse) {
      expect(e.nachher.fehler, e.name).toBeNull();
      const leer = `${e.name}: nichts gezählt — Fläche leer oder nicht geladen`;
      expect(last(e.nachher), leer).toBeGreaterThan(0);
    }
  });

  it("F2 · die zwei Flächen mit der höchsten Last sind entlastet — nachher kleiner als vorher", () => {
    s();
    const rang = [...ergebnisse].sort((a, b) => last(b.vorher) - last(a.vorher));
    const spitze = rang.slice(0, 2);
    const liste = rang.map((e) => `${e.name} ${last(e.vorher)}→${last(e.nachher)}`).join(", ");
    expect(
      spitze.map((e) => e.name).sort(),
      `die zwei am stärksten belasteten Flächen sind laut Messung ${spitze.map((e) => e.name).join(" und ")} — Rangliste vorher→nachher: ${liste}`,
    ).toEqual([...ENTLASTET].sort());
    for (const e of spitze) {
      expect(e.nachher.schalter, `${e.name}: kein Entlastungsschalter`).toBeGreaterThan(0);
      const leichter = `${e.name}: nachher nicht leichter als vorher`;
      expect(last(e.nachher), leichter).toBeLessThan(last(e.vorher));
      // Nicht gelöscht: aufgeklappt ist jede Funktion wieder da — vorher ist der aufgeklappte Stand.
      const geloescht = `${e.name}: aufgeklappt weniger Bedienelemente als eingeklappt`;
      expect(e.vorher.steuer, geloescht).toBeGreaterThanOrEqual(e.nachher.steuer);
    }
  });

  it("P · Chromium hat während der Messung keinen Seitenfehler gemeldet", () => {
    expect(s().seitenfehler).toEqual([]);
  });
});
