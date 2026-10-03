// @vitest-environment jsdom
// ================================================================================================
// FE-001 E4 · HTTP 403 BEIM FASSUNGSABRUF — MIT UND OHNE ZWISCHENSPEICHER GLEICH.
// ================================================================================================
//
// Befund der unabhängigen Browser-Gegenprobe (27.09.2026, Kandidat b7d1e0b7): war ein Eintrag
// vorher schon geladen, verschwieg die Fläche eine 403 beim erneuten Fassungsabruf — Radios,
// Vorschau und „Als Abschnitt aufnehmen" blieben bedienbar. Nach einem Reload zeigte dasselbe
// Objekt mit derselben 403 den Zugriffshinweis und sperrte die Aufnahme.
//
// Geprüft wird hier genau diese Anforderung:
//   · Absage sichtbar als fehlender Zugriff, unabhängig vom Zwischenspeicher,
//   · keine Fassungswahl, keine Vorschau, Aufnahme gesperrt mit genanntem Grund,
//   · kein widersprüchlicher Resthinweis „Wähle jetzt die Fassung …",
//   · erst ein erfolgreicher NEUER Abruf plus eine neue bewusste Wahl gibt die Aufnahme frei,
//   · mit Cache und ohne Cache (frischer Client = Reload) dasselbe Bild.
//
// `retry: 1` wie im Betrieb (`main.tsx`), mit kurzer Wartezeit — so ist auch die Spanne zwischen
// erster Absage und automatischer Wiederholung abgedeckt. Kein Netz: `fetch` ist festgelegt.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { BausteinAufnahme } from "../../apps/web/src/components/gesamtanweisung/BausteinAufnahme";
import "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let echtesFetch: typeof globalThis.fetch;

/** Welche Eintragskennungen gerade 403 auf `/versions` bekommen. */
const abgesagt = new Set<string>();
/** Welche Eintragskennungen gerade 500 auf `/versions` bekommen. */
const kaputt = new Set<string>();
let versionsAbrufe: string[] = [];

const TREFFER = [
  { id: "ko-a", title: "Arbeitsplatz einrichten", statement: "Kurz A.", version: 1 },
  { id: "ko-b", title: "Arbeitsplatz absichern", statement: "Kurz B.", version: 1 },
];

function fassungen(id: string) {
  const titel = TREFFER.find((t) => t.id === id)?.title ?? id;
  return [
    {
      koId: id,
      version: 1,
      at: "2026-09-25T08:00:00.000Z",
      author: "u-pia",
      note: "",
      snapshot: { id, title: titel, statement: `Alter Inhalt von ${titel}`, version: 1 },
    },
  ];
}

beforeEach(() => {
  echtesFetch = globalThis.fetch;
  abgesagt.clear();
  kaputt.clear();
  versionsAbrufe = [];
  globalThis.fetch = (async (eingabe: unknown) => {
    const adresse = String(eingabe);
    let status = 404;
    let rumpf: unknown = { error: "NOT_FOUND", message: adresse };
    const version = /^\/api\/kos\/([^/]+)\/versions$/.exec(adresse);
    if (adresse.startsWith("/api/library/search")) {
      status = 200;
      rumpf = TREFFER;
    } else if (version) {
      const id = version[1] as string;
      versionsAbrufe.push(id);
      if (abgesagt.has(id)) {
        status = 403;
        rumpf = { error: "FORBIDDEN", message: "Keine Berechtigung: ko.read" };
      } else if (kaputt.has(id)) {
        status = 500;
        rumpf = { error: "INTERNAL", message: "Serverfehler" };
      } else {
        status = 200;
        rumpf = fassungen(id);
      }
    }
    return {
      status,
      ok: status >= 200 && status < 300,
      statusText: String(status),
      text: async () => JSON.stringify(rumpf),
    } as unknown as Response;
  }) as typeof globalThis.fetch;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  globalThis.fetch = echtesFetch;
});

const marke = (id: string) => container.querySelector(`[data-testid="${id}"]`);
const knopf = () => marke("ga-aufnahme-knopf") as HTMLButtonElement;

async function warteBis(bedingung: () => boolean, was: string): Promise<void> {
  for (let i = 0; i < 300 && !bedingung(); i += 1) {
    await act(async () => {
      await new Promise((fertig) => setTimeout(fertig, 10));
    });
  }
  expect(bedingung(), `Die Fläche hat nie erreicht: ${was}`).toBe(true);
}

function neuerClient(staleTime = 0): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 1, retryDelay: 150, refetchOnWindowFocus: false, staleTime },
    },
  });
}

/** Montiert die Auswahl — mit einem mitgegebenen Client wie beim erneuten Öffnen ohne Reload. */
async function montiere(aufnahmen: unknown[], qc: QueryClient = neuerClient()): Promise<void> {
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(BausteinAufnahme, {
          aufnehmen: async (eingabe: unknown) => {
            aufnahmen.push(eingabe);
            return true;
          },
          gesperrt: false,
          grund: null,
        }),
      ),
    );
  });
}

async function suche(begriff: string): Promise<void> {
  const feld = container.querySelector("#ga-aufnahme-suche") as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(feld, begriff);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    marke("ga-aufnahme-suche-form")?.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
  await warteBis(() => marke("ga-aufnahme-treffer-eintrag") !== null, "die Treffer");
}

async function waehleEintrag(id: string): Promise<void> {
  const treffer = container.querySelector(`[data-ko="${id}"]`) as HTMLButtonElement;
  await act(async () => {
    treffer.click();
  });
}

async function waehleFassung1(): Promise<void> {
  await warteBis(() => marke("ga-aufnahme-fassung") !== null, "die Fassungswahl");
  await act(async () => {
    (marke("ga-aufnahme-fassung") as HTMLInputElement).click();
  });
}

/** Das Bild, das eine Zugangsabsage an der Fassungswahl zeigen MUSS. */
function erwarteAbsagebild(lage: string): void {
  const alarm = marke("ga-aufnahme-fassungen-fehler");
  expect(alarm, `${lage}: Zugriffshinweis fehlt`).not.toBeNull();
  expect(alarm?.getAttribute("role")).toBe("alert");
  expect(alarm?.textContent).toContain("nicht (mehr) zugänglich");
  expect(alarm?.textContent).toContain("Erneut laden");
  expect(marke("ga-aufnahme-fassung"), `${lage}: Radio trotz 403`).toBeNull();
  expect(marke("ga-aufnahme-vorschau"), `${lage}: Vorschau trotz 403`).toBeNull();
  expect(knopf().disabled, `${lage}: Aufnahme trotz 403 bedienbar`).toBe(true);
  const sperre = marke("ga-aufnahme-sperre");
  expect(sperre?.textContent).toContain("Aufnehmen ist gesperrt");
  expect(sperre?.textContent).not.toContain("Wähle jetzt die Fassung");
  expect(sperre?.getAttribute("role")).toBe("alert");
  expect(knopf().getAttribute("aria-describedby")).toBe(sperre?.id);
  // Auch die Trefferkarte fordert nicht mehr zur Fassungswahl auf.
  const aktiv = container.querySelector(
    '[data-testid="ga-aufnahme-treffer-eintrag"][aria-pressed="true"]',
  );
  expect(aktiv?.textContent).toContain("nicht zugänglich");
  expect(aktiv?.textContent).not.toContain("wähle unten die Fassung");
}

describe("FE-001 E4 · 403 beim Fassungsabruf", () => {
  it("MIT Cache: gemerkte Fassung wird nach 403 gesperrt, nicht weiter angeboten", async () => {
    const aufnahmen: unknown[] = [];
    await montiere(aufnahmen);
    await suche("Arbeitsplatz");

    // A laden und Fassung 1 wählen — alles frei.
    await waehleEintrag("ko-a");
    await waehleFassung1();
    expect(knopf().disabled).toBe(false);
    expect(marke("ga-aufnahme-vorschau")).not.toBeNull();

    // Ab jetzt sagt der Server für A und B ab. B wählen, dann zurück zu A: A liegt im Cache
    // und wird neu abgerufen (veraltet), die Antwort ist 403.
    abgesagt.add("ko-a");
    abgesagt.add("ko-b");
    await waehleEintrag("ko-b");
    await warteBis(() => marke("ga-aufnahme-fassungen-fehler") !== null, "Absage an B");
    const abrufeVorA = versionsAbrufe.filter((id) => id === "ko-a").length;
    await waehleEintrag("ko-a");

    // Schon nach der ERSTEN Absage (automatische Wiederholung läuft noch) gesperrt.
    await warteBis(
      () => versionsAbrufe.filter((id) => id === "ko-a").length === abrufeVorA + 1,
      "der erste erneute Abruf von A",
    );
    await warteBis(() => marke("ga-aufnahme-fassungen-fehler") !== null, "Absage an A (Cache)");
    erwarteAbsagebild("Cache, während der Wiederholung");

    // Nach der Wiederholung weiterhin dasselbe Bild.
    await warteBis(
      () => versionsAbrufe.filter((id) => id === "ko-a").length === abrufeVorA + 2,
      "die automatische Wiederholung für A",
    );
    await act(async () => {
      await new Promise((fertig) => setTimeout(fertig, 30));
    });
    erwarteAbsagebild("Cache, nach der Wiederholung");

    // Absenden über das Formular darf nichts aufnehmen.
    await act(async () => {
      marke("ga-aufnahme-bestaetigen")?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    expect(aufnahmen).toEqual([]);

    // Zugang wieder da: „Erneut laden" holt neu — die alte Wahl gilt NICHT weiter.
    abgesagt.delete("ko-a");
    await act(async () => {
      (marke("ga-aufnahme-fassungen-fehler")?.querySelector("button") as HTMLButtonElement).click();
    });
    await warteBis(() => marke("ga-aufnahme-fassung") !== null, "die neu geladene Fassungswahl");
    expect(marke("ga-aufnahme-fassungen-fehler")).toBeNull();
    expect((marke("ga-aufnahme-fassung") as HTMLInputElement).checked).toBe(false);
    expect(knopf().disabled).toBe(true);
    expect(marke("ga-aufnahme-sperre")?.textContent).toContain("Wähle jetzt die Fassung");

    // Erst die neue bewusste Wahl gibt frei, und die Aufnahme trägt genau sie.
    await waehleFassung1();
    expect(knopf().disabled).toBe(false);
    await act(async () => {
      knopf().click();
    });
    await warteBis(() => aufnahmen.length === 1, "die Aufnahme nach neuer Wahl");
    expect(aufnahmen[0]).toEqual({ koId: "ko-a", koVersion: 1, nachweisHash: null });
  });

  it("403 → gescheiterte Wiederholung (500): gemerkte Fassungen bleiben gesperrt, bis ein Abruf gelingt", async () => {
    // Ben-Befund Lauf 2: nach 403 → 500 waren die zwischengespeicherten Fassungen wieder wählbar
    // und wurden ohne gelungenen Abruf aufgenommen. Eine gescheiterte Wiederholung bestätigt den
    // Zugang nicht.
    const aufnahmen: unknown[] = [];
    await montiere(aufnahmen);
    await suche("Arbeitsplatz");
    await waehleEintrag("ko-a");
    await waehleFassung1();
    expect(knopf().disabled).toBe(false);

    // 403 für A (A liegt im Cache, erneuter Abruf über B → A).
    abgesagt.add("ko-a");
    await waehleEintrag("ko-b");
    await warteBis(() => marke("ga-aufnahme-fassung") !== null, "Fassungswahl B");
    await waehleEintrag("ko-a");
    await warteBis(() => marke("ga-aufnahme-fassungen-fehler") !== null, "Absage an A");
    erwarteAbsagebild("nach 403");

    // Wiederholung scheitert mit 500 (samt automatischer Wiederholung).
    abgesagt.delete("ko-a");
    kaputt.add("ko-a");
    const abrufeVor500 = versionsAbrufe.filter((id) => id === "ko-a").length;
    await act(async () => {
      (marke("ga-aufnahme-fassungen-fehler")?.querySelector("button") as HTMLButtonElement).click();
    });
    await warteBis(
      () => versionsAbrufe.filter((id) => id === "ko-a").length === abrufeVor500 + 2,
      "beide gescheiterten Abrufe (500)",
    );
    await act(async () => {
      await new Promise((fertig) => setTimeout(fertig, 30));
    });
    erwarteAbsagebild("nach 403 → 500");

    // Auch ein Wechsel B → A mit weiter scheiterndem Abruf gibt nichts frei.
    await waehleEintrag("ko-b");
    await warteBis(() => marke("ga-aufnahme-fassung") !== null, "Fassungswahl B");
    await waehleEintrag("ko-a");
    await act(async () => {
      await new Promise((fertig) => setTimeout(fertig, 400));
    });
    erwarteAbsagebild("nach 403 → 500, erneut gewählt");

    await act(async () => {
      marke("ga-aufnahme-bestaetigen")?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    expect(aufnahmen).toEqual([]);

    // Erst ein GELUNGENER Abruf gibt die Wahl wieder frei — ohne alte Wahl.
    kaputt.delete("ko-a");
    await act(async () => {
      (marke("ga-aufnahme-fassungen-fehler")?.querySelector("button") as HTMLButtonElement).click();
    });
    await warteBis(() => marke("ga-aufnahme-fassung") !== null, "die neu geladene Fassungswahl");
    expect(marke("ga-aufnahme-fassungen-fehler")).toBeNull();
    expect((marke("ga-aufnahme-fassung") as HTMLInputElement).checked).toBe(false);
    expect(knopf().disabled).toBe(true);
    await waehleFassung1();
    expect(knopf().disabled).toBe(false);
    await act(async () => {
      knopf().click();
    });
    await warteBis(() => aufnahmen.length === 1, "die Aufnahme nach gelungenem Abruf");
    expect(aufnahmen[0]).toEqual({ koId: "ko-a", koVersion: 1, nachweisHash: null });
  });

  // Ben-Befund Lauf 3, Runde 1: die Absage lag nur im Komponentenzustand. Nach 200 → 403 → 500 und
  // erneutem Montieren mit DEMSELBEN QueryClient war sie weg, die gemerkten Fassungen wieder
  // wählbar und aufnehmbar. `staleTime` 0 (Abruf beim Öffnen, scheitert mit 500) und 30 s wie im
  // Betrieb (`main.tsx`: gar kein Abruf beim Öffnen, nur der Zwischenspeicher).
  for (const staleTime of [0, 30_000]) {
    it(`erneutes Öffnen mit erhaltenem Cache (staleTime ${staleTime}): Absage bleibt bis zum gelungenen Abruf`, async () => {
      const qc = neuerClient(staleTime);
      const aufnahmen: unknown[] = [];
      await montiere(aufnahmen, qc);
      await suche("Arbeitsplatz");
      await waehleEintrag("ko-a");
      await waehleFassung1();

      // 403 erzwingen: „Erneut laden" gibt es erst bei einem Fehler — also direkt nachladen.
      abgesagt.add("ko-a");
      await act(async () => {
        await qc.refetchQueries({ queryKey: ["ko", "ko-a", "versions"] });
      });
      await warteBis(() => marke("ga-aufnahme-fassungen-fehler") !== null, "Absage an A");
      erwarteAbsagebild("nach 403");

      // Wiederholung scheitert mit 500.
      abgesagt.delete("ko-a");
      kaputt.add("ko-a");
      await act(async () => {
        (
          marke("ga-aufnahme-fassungen-fehler")?.querySelector("button") as HTMLButtonElement
        ).click();
      });
      await act(async () => {
        await new Promise((fertig) => setTimeout(fertig, 400));
      });
      erwarteAbsagebild("nach 403 → 500");

      // Auswahl schließen und mit demselben Client neu öffnen (kein Reload).
      await act(async () => {
        root.unmount();
      });
      root = createRoot(container);
      await montiere(aufnahmen, qc);
      await suche("Arbeitsplatz");
      await waehleEintrag("ko-a");
      await act(async () => {
        await new Promise((fertig) => setTimeout(fertig, 400));
      });
      erwarteAbsagebild("nach erneutem Öffnen");
      await act(async () => {
        marke("ga-aufnahme-bestaetigen")?.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      });
      expect(aufnahmen).toEqual([]);

      // Erst ein gelungener Abruf plus neue Wahl gibt frei.
      kaputt.delete("ko-a");
      await act(async () => {
        (
          marke("ga-aufnahme-fassungen-fehler")?.querySelector("button") as HTMLButtonElement
        ).click();
      });
      await warteBis(() => marke("ga-aufnahme-fassung") !== null, "die neu geladene Fassungswahl");
      expect((marke("ga-aufnahme-fassung") as HTMLInputElement).checked).toBe(false);
      expect(knopf().disabled).toBe(true);
      await waehleFassung1();
      await act(async () => {
        knopf().click();
      });
      await warteBis(() => aufnahmen.length === 1, "die Aufnahme nach gelungenem Abruf");
      expect(aufnahmen[0]).toEqual({ koId: "ko-a", koVersion: 1, nachweisHash: null });
    });
  }

  it("OHNE Cache (Reload): dieselbe 403 zeigt dasselbe Bild", async () => {
    abgesagt.add("ko-a");
    await montiere([]);
    await suche("Arbeitsplatz");
    await waehleEintrag("ko-a");
    await warteBis(() => marke("ga-aufnahme-fassungen-fehler") !== null, "Absage an A (Reload)");
    erwarteAbsagebild("ohne Cache");
  });

  it("Gegenprobe: ohne Absage bleibt die gewählte Fassung auch nach erneutem Abruf gültig", async () => {
    const aufnahmen: unknown[] = [];
    await montiere(aufnahmen);
    await suche("Arbeitsplatz");
    await waehleEintrag("ko-a");
    await waehleFassung1();
    await waehleEintrag("ko-b");
    await warteBis(() => marke("ga-aufnahme-fassung") !== null, "Fassungswahl B");
    await waehleEintrag("ko-a");
    await warteBis(() => versionsAbrufe.filter((id) => id === "ko-a").length === 2, "Abruf A");
    await waehleFassung1();
    expect(marke("ga-aufnahme-fassungen-fehler")).toBeNull();
    expect(knopf().disabled).toBe(false);
  });
});
