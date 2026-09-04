// @vitest-environment jsdom
// ================================================================================================
// JOB 687 · D6 — DIE QUITTUNG DER PRÜFENTSCHEIDUNG: DIAGNOSE UND SOLLVERTRAG GETRENNT.
// ================================================================================================
//
// Vorgeschichte: D4 fuhr diese Fälle in einem Prüfbaum unter `/private/tmp` (12 grün, 3 rot), D5
// überführte sie in diese Produktdatei. BEN hat D5 mit PRODUKT ROT beurteilt — mit einem Vorwurf,
// der sitzt (`BEN-PRUEFUNG-JOB-687-D5.md:8`, `:11`):
//
//   > „Nicht tragfähig als dauerhafter Sollvertrag sind dagegen Validation I1 („kein Toast") neben
//   > dem gegenläufigen Ziel R1 … Ein stummer Fehler … darf nicht als gewünschtes Grün erscheinen."
//
// D5 schrieb `expect(toasts.list).toEqual([])` als GRÜNE Dauererwartung — und daneben stand R1, das
// genau das Gegenteil verlangte. Wer den Erfolgstoast baut, machte damit einen grünen Test ROT. Ein
// Testbestand, der Verbesserung wie Regression bestraft, verteidigt den Mangel.
//
// WAS SICH IN D6 ÄNDERT — die Trennlinie läuft nicht zwischen „grün" und „rot", sondern zwischen
// ZWEI ARTEN VON AUSSAGE:
//
//   * `it(...)`       = der gewünschte Nutzerzustand, HEUTE SCHON ERFÜLLT. Er darf nie wieder
//                       fallen. Hier: die Quittungskarte erscheint, der Knopf sperrt gegen
//                       Doppelklick, die Toast-Sonde funktioniert.
//   * `it.fails(...)` = der gewünschte Nutzerzustand, HEUTE NOCH NICHT GEBAUT. Der Fall behauptet
//                       das Ziel und schlägt kausal fehl. Wird D-011 gebaut, besteht die Erwartung,
//                       `it.fails` meldet das — und der Bauende stellt auf `it` um.
//
// KEIN Fall behauptet mehr einen Mangel als Wunsch. Die Diagnose ist nicht verloren: Sie steht im
// erwarteten Fehlschlag, wo sie zur Forderung wird statt zur Zusage.
//
// DIE ZWEITE HÄLFTE DER AUFLAGE — und sie ist die schwerere (`:18`):
//
//   > „… kausal als erwarteten Fehlschlag mit AUSSERHALB DES FEHLSCHLAGS GEPRÜFTEN Mount-/
//   > Interaktionsvoraussetzungen."
//
// Ein `it.fails` ist auch dann grün, wenn die Seite gar nicht rendert oder der Klick nie ankommt.
// Dann misst er nichts und sieht trotzdem gut aus. Deshalb steht vor dem Sollvertrag der Block `V`:
// Er beweist mit REGULÄREN Fällen, dass die Seite mountet, der Knopf existiert, der Klick den
// Serverweg wirklich erreicht (`lage.actAufrufe`) — und zwar für den Erfolgs- UND den Fehlerweg.
// Erst dadurch ist der Fehlschlag in `S` ein Befund über das Produkt und kein Messartefakt.
//
// DIE TRAGENDE KALIBRIERUNG BLEIBT K1. Ohne sie wäre „kein Toast" auch dann eine Aussage, wenn die
// Sonde kaputt ist. K1 klickt den vorhandenen Admin-Weg (`adminValidate`, `Validation.tsx:371`), der
// nachweislich einen Toast auslöst.
//
// ALLE ZEILENANGABEN SIND AUF DIESER BASE NEU GEMESSEN. `Validation.tsx` trägt hier
// `90fc5d89…3e37f` und ist NICHT mehr D5s Stand (`833dd3f5…216c`); die Fundstellen haben sich um
// rund 30 Zeilen verschoben. Die Befunde selbst stehen unverändert — `rate` (`:314-322`) hat
// weiterhin kein `onError`, gemessen über den Rotlauf dieses Durchgangs.
//
// KEINE ZEILE PRODUKTCODE. `Validation.tsx` ist in diesem Durchgang Null-Diff; die Mängel werden
// sichtbar gemacht, nicht behoben.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../api/types";

// Der Bestand und das Verhalten von `endpoints.ko.act` werden je Fall gesetzt.
const lage = vi.hoisted(() => ({
  kos: [] as unknown[],
  /** Was `endpoints.ko.act` tun soll: auflösen, oder mit diesem Fehler scheitern. */
  actFehler: null as unknown,
  /** Hält den Aufruf offen, solange gesetzt — für den Pending-Fall. */
  actHaengt: false,
  /**
   * Zählt die tatsächlichen Serveraufrufe. D6: Das ist die Interaktionsvoraussetzung, die BEN
   * ausserhalb der erwarteten Fehlschläge geprüft sehen will — ohne sie wäre ein `it.fails` auch
   * dann grün, wenn der Klick den Weg nie erreicht hat.
   */
  actAufrufe: 0,
  /**
   * D6, Pflichtlieferung 4: Schaltet den PRODUKTIVEN Clientadapter frei. Ist er gesetzt, ruft der
   * Mock nicht mehr sein Doppel auf, sondern `endpoints.ko.act` im Original — also
   * `api.put` → `apiFetch` → `fetch` (`api/client.ts:24`) samt echtem `ApiError`-Bau aus der
   * Serverantwort (`:33-40`). Gesteuert wird dann nur noch `fetch` selbst.
   */
  durchstich: false,
}));

vi.mock("../api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useValidationBoard: () => ok(lage.kos),
    useDirectory: () => ok([]),
    useReasonerStatus: () => ok({ active: false, mode: "deterministic" }),
    // JOB 3061 · H2: der gemeinsame Reiterkopf zählt alle vier Reiter aus echten Abrufen. Sie sind
    // hier Kulisse — gemessen wird der Freigeben-Weg der Karte.
    useConflicts: () => ok([]),
    useDuplicates: () => ok([]),
    useLifecyclePending: () => ok([]),
  };
});

// Die Toast-Sonde. Jeder `push` wird mitgeschrieben — das ist die Messfläche dieses Tests.
const toasts = vi.hoisted(() => ({ list: [] as { ton: string; text: string }[] }));
vi.mock("../app/ToastContext", () => ({
  useToast: () => ({
    push: (ton: string, text: string) => {
      toasts.list.push({ ton, text });
    },
  }),
}));

const rolle = vi.hoisted(() => ({ wert: "experte" as string }));
vi.mock("../app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", role: rolle.wert } }),
}));
vi.mock("../app/RoleContext", () => ({ useRole: () => ({ role: rolle.wert }) }));

// `endpoints.ko.act` ist der einzige Serverweg dieser Fläche. Er wird hier gesteuert, damit Erfolg,
// `ApiError` und ein gewöhnlicher Fehler getrennt gefahren werden können — ohne Netz.
//
// D6: Der Mock ist NICHT mehr vollständig. Er umhüllt das ECHTE Modul (`importOriginal`) und gibt
// den produktiven Weg frei, sobald `lage.durchstich` gesetzt ist. Das ist die Grundlage von
// Pflichtlieferung 4: BEN hat an D5 gerügt, dass „nur der Clientausschnitt belegt" sei und die
// Aussage über den echten Abschlussweg fehle (`BEN-PRUEFUNG-JOB-687-D5.md:9`, Prüflücke 1).
vi.mock("../api/endpoints", async (importOriginal) => {
  const echt = await importOriginal<typeof import("../api/endpoints")>();
  return {
    ...echt,
    endpoints: {
      ...echt.endpoints,
      ko: {
        ...echt.endpoints.ko,
        act: (id: string, body: unknown) => {
          lage.actAufrufe += 1;
          if (lage.durchstich) {
            // KEIN Doppel: der echte Adapter, der echte JSON-Aufbau, der echte Fehlerpfad.
            return (echt.endpoints.ko.act as (i: string, b: unknown) => Promise<unknown>)(id, body);
          }
          return lage.actHaengt
            ? new Promise(() => undefined)
            : lage.actFehler
              ? Promise.reject(lage.actFehler)
              : Promise.resolve({});
        },
        aiCheckRetry: () => Promise.resolve({ status: "pending" }),
        remove: () => Promise.resolve(undefined),
      },
    },
  };
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "../api/client";
import i18n from "../i18n";
import { Validation } from "./Validation";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function de(key: string): string {
  return String(i18n.getResource("de", "translation", key));
}

function ko(overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Zu prüfendes Wissen",
    statement: "Eine Aussage.",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "u9",
    author: "u9",
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-08-12T00:00:00.000Z",
    history: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(bestand: KnowledgeObject[] = [ko()]): void {
  lage.kos = bestand;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          { initialEntries: ["/validierung"] },
          createElement(Validation),
        ),
      ),
    );
  });
}

/** Alle Knöpfe der gemounteten Seite, deren sichtbarer Text den gesuchten enthält. */
function knoepfe(text: string): HTMLButtonElement[] {
  return [...container.querySelectorAll("button")].filter((b) =>
    (b.textContent ?? "").includes(text),
  ) as HTMLButtonElement[];
}

function knopf(text: string): HTMLButtonElement {
  const treffer = knoepfe(text);
  if (treffer.length === 0) {
    throw new Error(`Kein Knopf mit Text „${text}" auf der gemounteten Seite.`);
  }
  return treffer[0] as HTMLButtonElement;
}

/**
 * Klicken und die Zustandsfortschreibung der Mutation wirklich abwarten.
 *
 * Zwei aufgelöste Mikrotasks genügen NICHT: React Query setzt `isPending` in einem eigenen
 * Aufrufzyklus, und der davon ausgelöste Neuaufbau der Fläche läuft erst danach. Gemessen — der
 * Pending-Fall war mit der kürzeren Fassung falsch grünlos. Ein Durchlauf der Makrotask-Schlange
 * innerhalb von `act` deckt beides ab.
 */
async function klick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
  });
}

/** Die Quittungskarte wird an ihrem Text erkannt, nicht an einer CSS-Klasse. */
function quittungDa(): boolean {
  return (container.textContent ?? "").includes(de("val.decisionSaved"));
}

beforeEach(() => {
  toasts.list = [];
  lage.actFehler = null;
  lage.actHaengt = false;
  lage.actAufrufe = 0;
  lage.durchstich = false;
  rolle.wert = "experte";
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  lage.kos = [];
});

// ------------------------------------------------------------------------------------------------
// K · KALIBRIERUNG — misst die Sonde, bevor die Sonde etwas misst.
// ------------------------------------------------------------------------------------------------
describe("K · Kalibrierung der Toast-Sonde", () => {
  it("K1 · der vorhandene Admin-Weg löst einen Erfolgstoast aus — die Sonde funktioniert", async () => {
    rolle.wert = "admin";
    mount();
    // JOB 3061 · H2: „Als wahr kennzeichnen" ist eine Nebenaktion und wohnt im „···"-Menü der
    // Karte. Die Sonde misst unverändert denselben Serverweg — nur hinter einem Klick mehr.
    await klick(document.querySelector('[data-testid="pruefen-menue-karte"]') as HTMLButtonElement);
    await klick(knopf(de("val.markTrue")));
    await klick(knopf(de("val.markTrueYes")));
    expect(toasts.list).toEqual([{ ton: "success", text: de("val.markTrueDone") }]);
  });

  it("K2 · ohne Klick entsteht kein Toast", () => {
    mount();
    expect(toasts.list).toEqual([]);
    // D6: K2 trägt zusätzlich die Aussage des D4-Falls `V-K` (Kalibrierung des Red-first-Blocks).
    // Beide behaupteten wortgleich „ohne Klick kein Toast"; D4 führte sie nur deshalb doppelt, weil
    // sie in zwei getrennten Prüfbaumdateien lagen und jede ihre eigene Kalibrierung brauchte. In
    // EINER Datei ist die zweite Fassung keine zweite Aussage. Ergänzt ist die Gegenprobe, dass auch
    // der Serverweg unberührt blieb — sonst wäre „kein Toast" mit „nichts passiert" verwechselbar.
    expect(lage.actAufrufe).toBe(0);
  });
});

// ------------------------------------------------------------------------------------------------
// V · VORAUSSETZUNGEN — sie tragen die erwarteten Fehlschläge in `S`.
// ------------------------------------------------------------------------------------------------
//
// Diese Fälle sind regulär und grün. Sie beweisen, dass in `S` wirklich das Produkt gemessen wird
// und nicht eine leere Seite: Kommt der Klick nie an, sind sie rot — und der Fehlschlag in `S`
// verliert seine Aussage, statt sie vorzutäuschen.
describe("V · Mount- und Interaktionsvoraussetzungen", () => {
  it("V1 · die Seite mountet und der Freigeben-Knopf ist da und bedienbar", () => {
    mount();
    const b = knopf(de("val.actionApprove"));
    expect(b.disabled).toBe(false);
    expect(lage.actAufrufe).toBe(0);
  });

  it("V2 · der Klick auf Freigeben erreicht den Serverweg wirklich — Erfolgsfall", async () => {
    mount();
    await klick(knopf(de("val.actionApprove")));
    expect(lage.actAufrufe).toBe(1);
  });

  it("V3 · der Klick erreicht den Serverweg auch dann, wenn der Server scheitert", async () => {
    lage.actFehler = new ApiError(409, "CONFLICT", "Das Objekt wurde zwischenzeitlich geändert.");
    mount();
    await klick(knopf(de("val.actionApprove")));
    // Der Aufruf IST passiert und IST gescheitert. Was danach fehlt, misst S2/S4 — nicht dieser Fall.
    expect(lage.actAufrufe).toBe(1);
  });
});

// ------------------------------------------------------------------------------------------------
// I · IST-MESSUNG — ausschliesslich das, was heute schon RICHTIG ist.
// ------------------------------------------------------------------------------------------------
//
// Was hier grün steht, ist gewünscht und muss es bleiben. D5 führte in diesem Block zusätzlich
// „kein Toast" (I1) und „vollständig unsichtbar" (I2) — beides Mängel. Sie stehen jetzt in `S` als
// Forderung.
describe("I · Ist-Messung des Freigeben-Wegs", () => {
  it("I1 · Erfolg zeigt die QUITTUNGSKARTE", async () => {
    mount();
    expect(quittungDa()).toBe(false);
    await klick(knopf(de("val.actionApprove")));
    // Die Karte entsteht in `rate.onSuccess` über `setLastDecision` (Validation.tsx:320) und rendert
    // `val.decisionSaved` (:496). Sie ist GEWÜNSCHT und darf beim Bau von D-011 nicht verschwinden:
    // Der Erfolgstoast (S1) tritt NEBEN die Karte, nicht an ihre Stelle.
    expect(quittungDa()).toBe(true);
  });

  it("I3 · während des Speicherns ist der Knopf gegen Doppelklick gesperrt", async () => {
    lage.actHaengt = true;
    mount();
    const vorher = knopf(de("val.actionApprove"));
    expect(vorher.disabled).toBe(false);
    await klick(vorher);
    // Bereits gebaut (Validation.tsx:1138): `rate.isPending` sperrt den Knopf. Das ist gewünscht.
    expect(knopf(de("val.actionApprove")).disabled).toBe(true);
    // Genau EIN Serveraufruf trotz laufender Mutation.
    expect(lage.actAufrufe).toBe(1);
  });
});

// ------------------------------------------------------------------------------------------------
// S · SOLLVERTRAG — der gewünschte Nutzerzustand. Heute kausal ROT.
// ------------------------------------------------------------------------------------------------
//
// Jeder dieser Fälle beschreibt, was der Prüfer erleben SOLL. Keiner ist künstlich rot gehalten: Auf
// dieser Base hat `rate` weder ein `push` im Erfolgs- noch ein `onError` im Fehlerweg
// (`Validation.tsx:314-322`), und die Knopfbeschriftung ist im Pending-Zustand unverändert.
//
// `it.fails` statt hartem Rot, weil diese Datei ein PRODUKTTEST ist: Ein dauerhaft roter Fall bräche
// das Gate `test` für alle. `it.fails` ist ausführbar, behauptet die Zusage und zerstört sich selbst,
// sobald sie erfüllt ist — dann besteht die Erwartung und der Fall meldet es.
describe("S · Sollvertrag D-011 — was die Quittung leisten soll", () => {
  it.fails("S1 · Erfolg quittiert zusätzlich mit einem Erfolgstoast", async () => {
    mount();
    await klick(knopf(de("val.actionApprove")));
    expect(toasts.list).toEqual([{ ton: "success", text: de("val.decisionSaved") }]);
  });

  it.fails("S2 · ein ApiError zeigt die SERVERMELDUNG als Fehlertoast", async () => {
    const meldung = "Das Objekt wurde zwischenzeitlich geändert.";
    lage.actFehler = new ApiError(409, "CONFLICT", meldung);
    mount();
    await klick(knopf(de("val.actionApprove")));
    expect(toasts.list).toEqual([{ ton: "error", text: meldung }]);
  });

  it.fails("S3 · ein Fehler OHNE ApiError fällt auf `state.error` zurück", async () => {
    lage.actFehler = new Error("Netzabbruch");
    mount();
    await klick(knopf(de("val.actionApprove")));
    expect(toasts.list).toEqual([{ ton: "error", text: de("state.error") }]);
  });

  it.fails(
    "S4 · ein gescheitertes Freigeben ist für den Prüfer ÜBERHAUPT wahrnehmbar",
    async () => {
      lage.actFehler = new ApiError(409, "CONFLICT", "Das Objekt wurde zwischenzeitlich geändert.");
      mount();
      const vorher = container.textContent;
      await klick(knopf(de("val.actionApprove")));
      // Die schwächste denkbare Forderung: IRGENDEIN Zeichen, dass der Klick nicht durchging — ein
      // Toast oder eine Änderung am Seiteninhalt. Heute trifft nichts davon zu; die Seite ist
      // zeichengleich wie vor dem Klick. Der Prüfer klickt „Freigeben", nichts passiert, und er
      // glaubt, er habe freigegeben. Dieser Fall ist bewusst schwächer als S2: Er fällt auch dann
      // noch, wenn man sich über die FORM der Meldung nicht einig ist.
      const wahrnehmbar = toasts.list.length > 0 || container.textContent !== vorher;
      expect(wahrnehmbar).toBe(true);
    },
  );

  it.fails("S5 · während des Speicherns sagt die Beschriftung, dass gespeichert wird", async () => {
    lage.actHaengt = true;
    mount();
    const ruhetext = knopf(de("val.actionApprove")).textContent?.trim();
    await klick(knopf(de("val.actionApprove")));
    // Der Knopf ist gesperrt (I3) — aber er sieht aus wie vorher. Wer nicht auf die Graufärbung
    // achtet, hält die Seite für eingefroren. Gefordert ist eine Beschriftung, die sich vom
    // Ruhezustand unterscheidet; welchen Wortlaut sie trägt, entscheidet der Bau.
    expect(knopf(de("val.actionApprove")).textContent?.trim()).not.toBe(ruhetext);
  });
});

// ------------------------------------------------------------------------------------------------
// P · DURCHSTICH — über den PRODUKTIVEN Clientadapter, nicht über das Doppel.
// ------------------------------------------------------------------------------------------------
//
// BEN hat an D5 die Nutzenkette als „SERVERINTERN — genauer: nur der Clientausschnitt" beurteilt
// (`BEN-PRUEFUNG-JOB-687-D5.md:9`) und in Prüflücke 1 verlangt, den „produktiven Abschlussweg über
// den öffentlichen Clientadapter" zu fahren. Der Auftrag lässt in Pflichtlieferung 4 die Wahl
// zwischen Durchstich und ausdrücklicher Begrenzung.
//
// HIER IST DER DURCHSTICH. In diesen Fällen ist `endpoints.ko.act` NICHT ersetzt: Der Klick läuft
// durch `api.put` (`api/endpoints.ts:307`), durch `apiFetch` (`api/client.ts:18-43`) — inklusive
// `Content-Type`-Setzung, `JSON.stringify` des Rumpfes, Statusauswertung und dem Bau des
// `ApiError` aus `{error, message}` — bis zurück in den Renderer. Gesteuert wird allein `fetch`,
// die äusserste Kante zum Netz.
//
// WAS DAMIT BELEGT IST: Adapter → Wiretyp → Renderer. WAS NICHT: Persistenz und Service. Es läuft
// kein Server; die Antwort ist gesetzt. Diese Grenze steht auch in der Rückgabe.
describe("P · Durchstich über den produktiven Clientadapter", () => {
  /** Die äusserste Kante: `fetch`. Alles darunter ist echter Produktcode. */
  function serverAntwortet(status: number, rumpf: unknown): ReturnType<typeof vi.fn> {
    const gerufen = vi.fn();
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
      gerufen({ url, method: init?.method, body: init?.body });
      return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        statusText: String(status),
        text: () => Promise.resolve(JSON.stringify(rumpf)),
      } as unknown as Response);
    });
    return gerufen;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("P1 · der echte Adapter trägt den Abschluss bis zur gerenderten Quittung", async () => {
    lage.durchstich = true;
    const gerufen = serverAntwortet(200, { id: "ko-1", status: "geprüft" });
    mount();
    await klick(knopf(de("val.actionApprove")));

    // Der produktive Weg ist wirklich gelaufen — Pfad, Verb und Rumpf stammen aus dem Adapter,
    // nicht aus diesem Test.
    expect(gerufen).toHaveBeenCalledTimes(1);
    const anruf = gerufen.mock.calls[0]?.[0] as { url: string; method: string; body: string };
    expect(anruf.url).toBe("/api/kos/ko-1");
    expect(anruf.method).toBe("PUT");
    expect(JSON.parse(anruf.body)).toMatchObject({ action: "rate" });
    // Und die Antwort kommt bis in die Fläche: die Quittungskarte steht da.
    expect(quittungDa()).toBe(true);
  });

  it.fails("P2 · ein echter 409 aus dem Adapter wird dem Prüfer sichtbar gemeldet", async () => {
    lage.durchstich = true;
    const gerufen = serverAntwortet(409, {
      error: "CONFLICT",
      message: "Das Objekt wurde zwischenzeitlich geändert.",
    });
    mount();
    const vorher = container.textContent;
    await klick(knopf(de("val.actionApprove")));

    // Der Aufruf IST gelaufen und der Adapter HAT einen echten `ApiError` gebaut
    // (`api/client.ts:35-39`) — das ist kein Doppel. Trotzdem erfährt der Prüfer nichts:
    // weder Toast noch Änderung an der Fläche. Derselbe Befund wie S4, diesmal auf dem
    // produktiven Weg statt am InMemory-Doppel.
    expect(gerufen).toHaveBeenCalledTimes(1);
    const wahrnehmbar = toasts.list.length > 0 || container.textContent !== vorher;
    expect(wahrnehmbar).toBe(true);
  });
});
