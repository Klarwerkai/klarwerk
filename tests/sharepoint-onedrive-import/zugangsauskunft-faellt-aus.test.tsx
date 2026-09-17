// @vitest-environment jsdom
// ================================================================================================
// JOB 4125 · Z — SCHEITERT DIE ZUGANGSAUSKUNFT, STEHT DORT EIN SATZ. NICHT NICHTS.
// ================================================================================================
//
// DER BEFUND, GEGEN DEN DIESE DATEI STEHT, ist nicht erfunden, sondern bestellt. Codex hat ihn an
// Paket 1 (JOB 4086) gemessen und als Folgeauftrag herausgegeben (`archiv/4086/runde-2/ben.md`,
// Prüfpunkt 6; `LEHREN.md:5441` wörtlich): „Prüfe auch den Ausfall der Zugangsauskunft im
// montierten SharePoint-Bereich: Fehler müssen sichtbar und in de/en/nl übersetzt sein; ein
// erneuter Versuch muss erreichbar bleiben."
//
// Die Stelle war `SharePointImportBereich.tsx:104`:
//
//     if (!istVerwalter || !zugang.data) { return null; }
//
// Ein Fehler der Auskunft lässt `zugang.data` undefiniert — der ganze Bereich verschwand, ohne ein
// Wort. Für den Menschen sieht das aus wie „diesen Import gibt es hier nicht", und es gibt keinen
// Weg zurück: der einzige Knopf, der die Auskunft neu holen könnte, hing INNERHALB des Bereichs,
// der gerade nicht da ist.
//
// ================================================================================================
// WAS HIER ECHT IST UND WAS ATTRAPPE.
// ================================================================================================
//
// Attrappe ist GENAU die Drahtgrenze (`components/sharepoint-import/api.ts`) — und sie wirft einen
// ECHTEN `ApiError`, denn genau daran hängt die Fehlerdeutung der Fläche (`fehlercode()`:
// `err instanceof ApiError`). Ein selbstgebauter Fehler mit `code`-Feld würde die Naht
// überspringen, um die es geht.
//
// Echt sind: der Bereich selbst, react-query (eigener `QueryClient`, `retry: false` wie im
// Betrieb), i18n mit den WIRKLICHEN Sätzen aus `i18n.ts`, und die Abbildung Fehlercode → Satz aus
// `fehlerlagen.ts`. KEIN durchgehender Browserlauf wird behauptet: die Serverhälfte dieses Auftrags
// liegt am Draht (`wiederholimport-am-draht.test.ts`), diese Hälfte an der montierten Fläche.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  /** Der Fehlercode, mit dem die Zugangsauskunft scheitert — `null` heisst „sie gelingt". */
  fehler: null as null | { status: number; code: string },
  /** Wie oft die Auskunft WIRKLICH gerufen wurde. Der erneute Versuch wird daran gemessen. */
  rufe: 0,
}));

vi.mock("../../apps/web/src/components/sharepoint-import/api", async () => {
  // Der echte `ApiError` — die Fehlerdeutung der Fläche prüft auf genau diese Klasse.
  const { ApiError } = await vi.importActual<typeof import("../../apps/web/src/api/client")>(
    "../../apps/web/src/api/client",
  );
  return {
    sharepointApi: {
      zugang: async () => {
        d.rufe += 1;
        if (d.fehler) {
          throw new ApiError(d.fehler.status, d.fehler.code, "Serverantwort");
        }
        return {
          system: "sharepoint",
          enabled: true,
          credentials: [{ name: "KLARWERK_SHAREPOINT_TOKEN", present: true }],
          credentialsUsable: true,
          blocker: null,
          lastConnectedAt: null,
        };
      },
      dateien: async () => ({ dateien: [], truncated: false }),
      uebernehmen: async () => ({
        imported: 0,
        alreadyQueued: 0,
        neuerStand: [],
        failed: [],
        notFound: [],
        // JOB 4232: die Antwort führt dieses Feld immer — die Attrappe bildet den echten Vertrag ab.
        ohneInhalt: [],
        dateien: [],
      }),
    },
  };
});

vi.mock("../../apps/web/src/app/RoleContext", () => ({ useRole: () => ({ role: "admin" }) }));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { SharePointImportBereich } from "../../apps/web/src/components/sharepoint-import/SharePointImportBereich";
import { SHAREPOINT_FEHLER_TEXT } from "../../apps/web/src/components/sharepoint-import/fehlerlagen";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;
/** Der Abfragehalter des montierten Baums — Z3 braucht ihn, um eine AUFFRISCHUNG anzustossen. */
let halter: QueryClient | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const neu = createRoot(container);
  root = neu;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  halter = qc;
  await act(async () => {
    neu.render(
      createElement(QueryClientProvider, { client: qc }, createElement(SharePointImportBereich)),
    );
    await flush();
  });
  await act(flush);
}

function abbauen(): void {
  if (root) {
    act(() => root?.unmount());
  }
  container?.remove();
  root = null;
  halter = null;
}

const knoten = (testid: string): HTMLElement | null =>
  container.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
const text = (testid: string): string => (knoten(testid)?.textContent ?? "").replace(/\s+/g, " ");
const satz = (lng: string, key: string): string => {
  const wert = i18n.getResource(lng, "translation", key);
  return typeof wert === "string" ? wert : "";
};

/**
 * Der Satz-Schlüssel zu einem Server-Fehlercode — als VORBEDINGUNG geprüft, nicht angenommen.
 * `SHAREPOINT_FEHLER_TEXT` ist ein offener `Record`; ein Zugriff ins Leere wäre hier eine stille
 * `undefined`-Erwartung, die jede folgende Zusicherung wertlos machte.
 */
function lageKey(code: string): string {
  const key = SHAREPOINT_FEHLER_TEXT[code];
  if (key === undefined) {
    throw new Error(`Vorbedingung verletzt: kein Satz-Schlüssel zu ${code}`);
  }
  return key;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  d.fehler = null;
  d.rufe = 0;
});

afterEach(() => {
  abbauen();
});

describe("JOB 4125 · Z — der Ausfall der Zugangsauskunft", () => {
  it("VORBEDINGUNG · gelingt die Auskunft, steht der Bereich wie bisher da (kein Fehlersatz)", async () => {
    await mount();
    expect(d.rufe, "die Auskunft wurde wirklich gerufen").toBeGreaterThanOrEqual(1);
    expect(knoten("sharepoint-zugangsfehler"), "ohne Fehler kein Fehlersatz").toBeNull();
    expect(container.textContent, "der Bereich ist da").toContain(i18n.t("imp.sharepoint.titel"));
  });

  // ------------------------------------------------------------------------------------------------
  // Z1 — DER SICHTBARE SATZ UND DER BEDIENBARE ZWEITE VERSUCH.
  // ------------------------------------------------------------------------------------------------
  it("Z1 · scheitert die Auskunft, steht ein übersetzter Satz da — und ein erneuter Versuch, der wirklich ruft", async () => {
    d.fehler = { status: 502, code: "SHAREPOINT_UNREACHABLE" };
    await mount();

    // (a) KEIN LEERES DOM. Das ist der gemessene Befund aus Paket 1.
    expect(
      container.textContent?.trim(),
      "ein leeres DOM war der Befund — er darf nicht wiederkommen",
    ).not.toBe("");
    // (b) DER SATZ, und zwar der, der zu diesem Ausgang gehört (aus `fehlerlagen.ts`, nicht neu
    //     erfunden).
    expect(text("sharepoint-zugangsfehler")).toContain(i18n.t(lageKey("SHAREPOINT_UNREACHABLE")));
    // (c) KEIN SERVERKÜRZEL auf der Fläche.
    expect(container.textContent ?? "").not.toContain("SHAREPOINT_UNREACHABLE");
    expect(container.textContent ?? "").not.toContain("502");
    // (d) KEINE DATEILISTE UND KEIN ÜBERNAHMEKNOPF daneben: ohne benutzbare Auskunft wird nichts
    //     über den Bestand in SharePoint behauptet und nichts angeboten, was nicht gehen kann.
    expect(knoten("sharepoint-uebernehmen")).toBeNull();
    expect(knoten("sharepoint-leer")).toBeNull();

    // (e) DER ERNEUTE VERSUCH IST ERREICHBAR UND RUFT WIRKLICH.
    const knopf = knoten("sharepoint-zugang-erneut");
    expect(knopf, "ohne Weg zurück ist der Satz eine Sackgasse").not.toBeNull();
    expect((knopf as HTMLButtonElement).disabled).toBe(false);
    const vorher = d.rufe;
    d.fehler = null;
    await act(async () => {
      (knopf as HTMLButtonElement).click();
      await flush();
    });
    await act(flush);
    expect(d.rufe, "der Knopf holt die Auskunft wirklich neu").toBeGreaterThan(vorher);
    // Und danach trägt der Bereich wieder sein normales Bild — der Satz ist weg.
    expect(knoten("sharepoint-zugangsfehler")).toBeNull();
    expect(container.textContent ?? "").toContain(i18n.t("imp.sharepoint.listeTitel"));
  });

  it("Z1b · jede der vier Lagen bekommt IHREN Satz, nicht einen Sammelsatz", async () => {
    for (const [code, key] of Object.entries(SHAREPOINT_FEHLER_TEXT)) {
      d.fehler = { status: 503, code };
      await mount();
      expect(text("sharepoint-zugangsfehler"), code).toContain(i18n.t(key));
      abbauen();
    }
  });

  // ------------------------------------------------------------------------------------------------
  // Z2 — DERSELBE FALL IN EN UND NL.
  // ------------------------------------------------------------------------------------------------
  //
  // „Übersetzt" heisst hier zweierlei, und beides wird gemessen: der Satz ist der der EINGESTELLTEN
  // Sprache (aufgelöst, nicht der Schlüssel), UND der deutsche Satz steht nicht daneben.
  it("Z2 · EN und NL zeigen ihren eigenen, aufgelösten Satz — kein deutscher, kein Kürzel", async () => {
    d.fehler = { status: 403, code: "SHAREPOINT_FORBIDDEN" };
    const key = lageKey("SHAREPOINT_FORBIDDEN");
    const deutsch = satz("de", key);
    expect(deutsch, "Vorbedingung: der deutsche Satz existiert").not.toBe("");

    for (const sprache of ["en", "nl"]) {
      await i18n.changeLanguage(sprache);
      await mount();
      const erwartet = satz(sprache, key);
      expect(erwartet, `Schlüssel fehlt in ${sprache}`).not.toBe("");
      expect(erwartet, `${sprache} übersetzt nicht`).not.toBe(deutsch);
      const gezeigt = text("sharepoint-zugangsfehler");
      expect(gezeigt, sprache).toContain(erwartet);
      expect(gezeigt, `${sprache} zeigt den deutschen Satz`).not.toContain(deutsch);
      expect(gezeigt, `${sprache} zeigt einen unaufgelösten Schlüssel`).not.toContain(
        "imp.sharepoint.",
      );
      expect(gezeigt, `${sprache} zeigt ein Serverkürzel`).not.toContain("SHAREPOINT_");
      // Auch der erneute Versuch ist in dieser Sprache beschriftet und bedienbar.
      const knopf = knoten("sharepoint-zugang-erneut");
      expect(knopf, sprache).not.toBeNull();
      const beschriftung = (knopf?.textContent ?? "").replace(/\s+/g, " ").trim();
      expect(beschriftung, `${sprache}: der Knopf trägt keinen aufgelösten Text`).not.toContain(
        "imp.sharepoint.",
      );
      expect(beschriftung).toContain(satz(sprache, "imp.sharepoint.zugangErneut"));
      abbauen();
    }
  });

  // ------------------------------------------------------------------------------------------------
  // Z3 — CACHE MIT GESCHEITERTER AUFFRISCHUNG: DER FEHLERSATZ STEHT VOR DEN DATEN.
  // ------------------------------------------------------------------------------------------------
  //
  // Der Fall aus §9 des Auftrags, den Z1/Z2 NICHT treffen: dort scheitert die ERSTE Auskunft, und
  // `zugang.data` ist ohnehin leer — die Verzweigungsreihenfolge im Bauteil wäre dabei gleichgültig.
  // Hier gelingt die Auskunft zuerst und scheitert erst BEI DER AUFFRISCHUNG. react-query hält die
  // alte Antwort dann fest (`zugang.data` bleibt gesetzt); stünde `!zugang.data` VOR `zugang.isError`,
  // liefe die Fläche unbeirrt weiter und gäbe einen alten Zugangszustand als aktuellen aus. Genau
  // diese Reihenfolge ist die Ehrlichkeitsregel dieses Bauteils (Kommentar bei `:139`), und ohne
  // diesen Fall wäre sie unbewacht — ein späterer Umbau könnte sie tauschen, ohne dass etwas rot wird.
  //
  // DIE AUFFRISCHUNG WIRD ECHT GEFAHREN (`refetchQueries` am Abfragehalter des montierten Baums),
  // nicht simuliert: dasselbe, was der Erfolgsweg der Übernahme im Betrieb auslöst
  // (`SharePointImportBereich.tsx`, `onSuccess` → `invalidateQueries(["sharepoint-zugang"])`).
  it("Z3 · erst erfolgreich, dann scheitert die Auffrischung: der Fehlersatz gilt, nicht der alte Zustand", async () => {
    await mount();
    // VORBEDINGUNG, gemessen: der Bereich steht mit gelungener Auskunft da.
    expect(knoten("sharepoint-zugangsfehler")).toBeNull();
    expect(container.textContent ?? "").toContain(i18n.t("imp.sharepoint.listeTitel"));
    const rufeVorher = d.rufe;

    d.fehler = { status: 502, code: "SHAREPOINT_UNREACHABLE" };
    await act(async () => {
      await halter?.refetchQueries({ queryKey: ["sharepoint-zugang"] });
      await flush();
    });
    await act(flush);

    expect(d.rufe, "die Auffrischung ist wirklich gelaufen").toBeGreaterThan(rufeVorher);
    expect(text("sharepoint-zugangsfehler")).toContain(i18n.t(lageKey("SHAREPOINT_UNREACHABLE")));
    // UND der alte Zustand wird nicht mehr als aktueller ausgegeben: weder Zugangskarte noch
    // Dateiliste noch Übernahmeknopf stehen neben dem Fehlersatz.
    expect(knoten("sharepoint-uebernehmen"), "kein Bedienweg auf veralteter Grundlage").toBeNull();
    expect(container.textContent ?? "").not.toContain(i18n.t("imp.sharepoint.listeTitel"));
    expect(container.textContent ?? "").not.toContain(i18n.t("imp.sharepoint.zugang.ready.titel"));
    // Der Weg zurück bleibt erreichbar.
    expect(knoten("sharepoint-zugang-erneut")).not.toBeNull();
  });
});
