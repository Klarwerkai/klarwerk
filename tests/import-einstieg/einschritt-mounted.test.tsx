// @vitest-environment jsdom
// ================================================================================================
// JOB 3341 · UX-18-R1 — DIE ZIELSEITE DES EINEN SCHRITTS, AN DER ECHTEN `/erfassen`-FLÄCHE.
// ================================================================================================
//
// WAS HIER GEMESSEN WIRD, UND WAS NICHT. Der volle Weg (Maus, Tab/Enter, schmale Fenster,
// Browser-Rückweg) steht in `einschritt-chromium.test.ts` — dort führt die Plattform die Navigation
// wirklich aus. Diese Datei misst die andere Hälfte, und zwar schnell und ohne Browser: was die
// Adresse `/erfassen?weg=…` am ZIEL bewirkt. Genau dort lag der Mangel (`Blatt.tsx` las bis hierher
// nur `?draft=`), und genau dort sitzen die Fälle, die ein Browserlauf nur teuer wiederholen würde:
// die Bereinigung der Adresse, der Rückweg aus dem Arbeitsraum, der unbekannte Wert.
//
// MONTIERT WIRD DIE ECHTE SEITE: `Capture` — also das Blatt mit dem Arbeitsraum aus
// `pages/Capture.tsx` als hereingereichtem Bauteil, genau so, wie die Route `/erfassen` es tut.
// Ein nachgebauter Wirt hätte hier nichts belegt: die Ansicht gehört dem Blatt, der Dateiimport dem
// Arbeitsraum, und die Aussage liegt an der Naht zwischen beiden (dieselbe Bauform und derselbe
// Grund wie in `tests/editor-r26/erfassen-rueckwege-mounted.test.tsx`).
//
// VORHER (gemessen, Gegenprobe „Lieferung 2 zurückgenommen", siehe RUECKGABE): rot mit
// `AssertionError: /erfassen?weg=datei zeigt keinen Arbeitsraum: expected null not to be null`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Alle Netzwege stillgelegt, OHNE Liste — dieselbe Begründung wie in `erfassen-rueckwege-mounted`:
// eine von Hand gepflegte Attrappe müsste jede Gruppe kennen, die `Capture` und `Blatt` anfassen,
// und wäre morgen still unvollständig. Kein Fall dieser Datei behauptet etwas über Serververhalten;
// ein Blatt ohne Netz ist genau die Lage, in der der Deep-Link trotzdem tragen muss.
//
// RUNDE 2 — MIT EINER EINZIGEN AUSNAHME: `drafts.get`. Codex' Befund (fc454b48) hängt am
// ZUSAMMENSPIEL von `?draft=` und `?weg=`, und beide Ausgänge gehören dazu: der gescheiterte Abruf
// (den der Proxy oben ohnehin liefert) UND der gelungene. Ohne den gelungenen bliebe „der
// Arbeitsraum öffnet über einem GELADENEN Blatt" eine Behauptung. Gesteuert wird er über einen
// einzigen Haken, den jeder Fall selbst setzt — keine zweite Attrappenlandschaft.
const entwurfsAbruf = vi.hoisted(() => ({
  antwort: async (kennung: string): Promise<unknown> => {
    throw new Error(`kein Netz in dieser Probe (${kennung})`);
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const gruppe = (name: string): unknown =>
    new Proxy(
      {},
      {
        get: (_ziel, weg) => {
          if (name === "drafts" && weg === "get") {
            return (kennung: string): Promise<unknown> => entwurfsAbruf.antwort(kennung);
          }
          return async (): Promise<never> => {
            throw new Error("kein Netz in dieser Probe");
          };
        },
      },
    );
  return { endpoints: new Proxy({}, { get: (_ziel, name) => gruppe(String(name)) }) };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, useLocation } from "../../apps/web/node_modules/react-router-dom";
import "../../apps/web/src/i18n";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { BLATT_WEG_PARAMETER } from "../../apps/web/src/components/erfassen/wege";
import { Capture } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
// Die Adresse, auf der der Router gerade WIRKLICH steht. `window.location` taugt dafür nicht: der
// MemoryRouter fasst es nicht an, eine Messung daran wäre eine Behauptung ohne Gegenstand.
let adresseJetzt = "";

function Adresssonde(): null {
  const ort = useLocation();
  adresseJetzt = `${ort.pathname}${ort.search}`;
  return null;
}

function mount(adresse: string): void {
  const el = document.createElement("div");
  document.body.appendChild(el);
  container = el;
  const r = createRoot(el);
  root = r;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    r.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ToastProvider,
          null,
          createElement(
            AuthProvider,
            null,
            createElement(
              MemoryRouter,
              { initialEntries: [adresse] },
              createElement(
                RoleProvider,
                null,
                createElement(
                  ImageDescribeProvider,
                  null,
                  createElement(
                    NavGuardProvider,
                    null,
                    createElement(Adresssonde),
                    createElement(Capture),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
}

/**
 * Bis das angestossene Laden WIRKLICH durch ist — samt `.catch` und `.finally`. Codex' Befund an
 * Runde 1: Z7/Z8 massen den Zustand VOR dem Ergebnis und belegten damit nur, was die Adresse sagt,
 * nicht was das Blatt tut. Mehrere Runden, weil die Ladefolge über mehrere Mikroschritte läuft
 * (Abruf → Zustand → `finally`), und jede Runde zugleich die anstehenden Effekte abarbeitet.
 */
async function bisDasLadenDurchIst(): Promise<void> {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

beforeEach(() => {
  entwurfsAbruf.antwort = async (kennung: string): Promise<unknown> => {
    throw new Error(`kein Netz in dieser Probe (${kennung})`);
  };
});

afterEach(() => {
  if (root) {
    const r = root;
    act(() => {
      r.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
  adresseJetzt = "";
  vi.clearAllMocks();
});

function suche(selektor: string): HTMLElement | null {
  const el = container?.querySelector(selektor);
  return el instanceof HTMLElement ? el : null;
}

function fordere(selektor: string): HTMLElement {
  const el = suche(selektor);
  if (!el) {
    throw new Error(
      `${selektor} ist nicht da. Sichtbar: ${(container?.textContent ?? "").slice(0, 400)}`,
    );
  }
  return el;
}

/** Das Schreibfeld des Blattes — daran erkennt man, dass die Fläche wieder dem Blatt gehört. */
function schreibfeldDa(): boolean {
  return suche('[data-testid="blatt-huelle"] [role="textbox"]') !== null;
}

/** Der „Abbrechen"-Knopf des Dateiimports, über sein sichtbares Wort — so findet ihn der Mensch. */
function abbrechenKnopf(): HTMLElement {
  const treffer = [...(container?.querySelectorAll("button") ?? [])].find((b) =>
    (b.textContent ?? "").includes("Abbrechen"),
  );
  if (!(treffer instanceof HTMLElement)) {
    throw new Error("Der Knopf Abbrechen ist im Dateiimport nicht da");
  }
  return treffer;
}

const DEEP_LINK = `/erfassen?${BLATT_WEG_PARAMETER}=datei`;

describe("JOB 3341 · UX-18-R1 — `/erfassen?weg=datei` öffnet den Dateiimport beim Aufbau", () => {
  it("Z1 · EIN Aufbau, und die Dateiauswahl steht da — ohne einen weiteren Griff", () => {
    mount(DEEP_LINK);
    // Der Arbeitsraum hat die Fläche, das Schreibfeld ist es nicht.
    expect(
      suche('[data-testid="blatt-arbeitsraum"]'),
      `${DEEP_LINK} zeigt keinen Arbeitsraum`,
    ).not.toBeNull();
    expect(schreibfeldDa()).toBe(false);
    // Und es ist wirklich der DATEIIMPORT, nicht irgendein Arbeitsraum: der sichtbare Knopf der
    // Dateiauswahl und der versteckte Eingang mit seinem `accept` sind da.
    expect(
      suche('[data-testid="capture-file-pick"]'),
      "der Dateiimport ist nicht offen — dann war der eine Schritt keiner",
    ).not.toBeNull();
    const eingang = container?.querySelector('input[type="file"]');
    expect(eingang?.getAttribute("accept")).toContain(".docx");
    expect(eingang?.getAttribute("accept")).toContain(".pdf");
  });

  it("Z2 · der Parameter ist danach aus der Adresse verschwunden", () => {
    // Er hat seine eine Aufgabe getan. Bliebe er stehen, überschriebe er jeden Rückweg (Z3) und
    // stünde als Zwischenadresse im Browser-Verlauf.
    mount(DEEP_LINK);
    expect(adresseJetzt, "der Weg-Parameter steht noch in der Adresse").toBe("/erfassen");
  });

  it("Z3 · „Abbrechen“ zeigt wieder das Blatt — und der Arbeitsraum geht NICHT erneut auf", () => {
    mount(DEEP_LINK);
    act(() => {
      abbrechenKnopf().click();
    });
    expect(suche('[data-testid="blatt-arbeitsraum"]')).toBeNull();
    expect(schreibfeldDa(), "nach dem Abbruch fehlt das Schreibfeld").toBe(true);
    // Die Gegenprobe zur Adressbereinigung: ein weiterer Bildaufbau darf ihn nicht wiederholen.
    act(() => {
      fordere('[data-testid="blatt-titel"]').focus();
    });
    expect(
      suche('[data-testid="blatt-arbeitsraum"]'),
      "der Arbeitsraum ist von selbst wieder aufgegangen",
    ).toBeNull();
  });

  it("Z4 · der Fokus steht am Ziel im Arbeitsraum und nicht am Seitenanfang", () => {
    mount(DEEP_LINK);
    const flaeche = fordere('[data-testid="blatt-arbeitsraum"]');
    expect(document.activeElement, "der Fokus ist auf `body` liegengeblieben").toBe(flaeche);
    // Programmatisch fokussierbar, aber NICHT im Tab-Lauf — die Reihenfolge der Seite bleibt.
    expect(flaeche.getAttribute("tabindex")).toBe("-1");
  });

  it("Z5 · fail-closed: ein unbekannter Wert zeigt das Blatt, ohne Fehlermeldung", () => {
    mount(`/erfassen?${BLATT_WEG_PARAMETER}=quatsch`);
    expect(suche('[data-testid="blatt-arbeitsraum"]')).toBeNull();
    expect(schreibfeldDa(), "das Blatt fehlt").toBe(true);
    // Kein erfundener Zustand und keine Beschwerde über eine Adresse, die der Mensch nicht getippt
    // hat: die Fläche schweigt darüber. Die Adresse bleibt, wie sie war — bereinigt wird nur, was
    // wirklich ausgeführt wurde.
    expect(container?.textContent ?? "").not.toContain("quatsch");
    expect(adresseJetzt).toBe(`/erfassen?${BLATT_WEG_PARAMETER}=quatsch`);
  });

  it("Z6 · ein leerer Wert ebenso — und `/erfassen` ohne Parameter bleibt genau wie bisher", () => {
    mount(`/erfassen?${BLATT_WEG_PARAMETER}=`);
    expect(suche('[data-testid="blatt-arbeitsraum"]')).toBeNull();
    expect(schreibfeldDa()).toBe(true);
  });

  it("Z7 · der `?draft=`-Weg allein bleibt unberührt — bis zum Ergebnis gemessen", async () => {
    // Prüflücke 6(a) des Auftrags. Zuerst allein: eine Adresse mit Entwurf öffnet keinen
    // Arbeitsraum. RUNDE 2 (Codex): und zwar bis zum AUSGANG des Ladens gemessen, nicht nur bis zur
    // Adresse — der erfundene Entwurf scheitert hier bewusst, und das Blatt sagt es.
    mount("/erfassen?draft=abc-123");
    await bisDasLadenDurchIst();
    expect(suche('[data-testid="blatt-arbeitsraum"]')).toBeNull();
    expect(adresseJetzt).toBe("/erfassen?draft=abc-123");
    expect(suche('[data-testid="blatt-lage"]'), "der Ladefehler bleibt stumm").not.toBeNull();
  });

  it("Z8 · und zusammen, mit GELADENEM Entwurf: Weg fällt aus der Adresse, Entwurf bleibt stehen", async () => {
    // Die eigentliche Falle der Bereinigung: `setSearchParams({})` hätte hier den fortgesetzten
    // Entwurf mitgenommen — das nächste Speichern legte dann einen ZWEITEN an (derselbe Befund,
    // den JOB 3282 C2 für den Abbruch festhält).
    //
    // RUNDE 2 (Codex fc454b48): der Entwurf wird jetzt WIRKLICH geladen, und der Fall wartet auf das
    // Ergebnis. Runde 1 mass hier einen Arbeitsraum über einem gescheiterten Ladevorgang und nannte
    // das grün — die Adresse stimmte, die Lage nicht.
    entwurfsAbruf.antwort = async (kennung: string) => ({
      id: kennung,
      payload: { title: "Der fortgesetzte Entwurf", bodyHtml: "<p>Sein gesicherter Absatz.</p>" },
      originalAuthor: "pedi",
      lastEditor: "pedi",
      createdAt: "2026-09-08T10:00:00.000Z",
      updatedAt: "2026-09-08T10:00:00.000Z",
    });
    mount(`/erfassen?draft=abc-123&${BLATT_WEG_PARAMETER}=datei`);
    await bisDasLadenDurchIst();
    expect(suche('[data-testid="capture-file-pick"]')).not.toBeNull();
    expect(adresseJetzt, "der Entwurf ist bei der Bereinigung mit verschwunden").toBe(
      "/erfassen?draft=abc-123",
    );

    // UND DAS BLATT DARUNTER TRÄGT WIRKLICH DEN ENTWURF (Codex: „ein erfolgreicher Entwurf-Inhalt
    // nach Abbruch"). Der Arbeitsraum liegt ÜBER einem geladenen Blatt, nicht über einem leeren —
    // sichtbar wird das erst nach „Abbrechen", und genau dort wäre der Verlust aufgefallen.
    act(() => {
      abbrechenKnopf().click();
    });
    expect(schreibfeldDa(), "nach dem Abbruch fehlt das Schreibfeld").toBe(true);
    const titel = fordere('[data-testid="blatt-titel"]');
    expect(
      (titel as HTMLInputElement).value,
      "das Blatt unter dem Arbeitsraum ist leer — der Entwurf ist verloren",
    ).toBe("Der fortgesetzte Entwurf");
    expect(container?.textContent ?? "").toContain("Sein gesicherter Absatz.");
  });

  it("Z9 · scheitert der Entwurf, überdeckt der Arbeitsraum die Meldung NICHT — sie steht mit ihrem Wiederholweg da", async () => {
    // ============================================================================================
    // CODEX fc454b48 — DER BEFUND DIESER RUNDE, ALS FALL.
    // ============================================================================================
    // Runde 1 riss den Arbeitsraum sofort auf; sein früher return (`Blatt.tsx:2132`) kommt an
    // `BlattLage` (`:2633`) gar nicht vorbei, während der Ladefehler nur `setErr` setzt (`:753`).
    // Der Mensch stand also im Dateiimport, und dass sein fortgesetzter Entwurf gar nicht geladen
    // wurde, sagte ihm niemand. §9 des Auftrags verspricht das Gegenteil.
    mount(`/erfassen?draft=abc-123&${BLATT_WEG_PARAMETER}=datei`);
    await bisDasLadenDurchIst();
    expect(
      suche('[data-testid="capture-file-pick"]'),
      "der Arbeitsraum steht über einem gescheiterten Ladevorgang",
    ).toBeNull();
    const lage = suche('[data-testid="blatt-lage"]');
    expect(lage, "die Ladefehlermeldung ist überdeckt").not.toBeNull();
    expect((lage?.textContent ?? "").length, "die Meldung ist leer").toBeGreaterThan(0);
    // §9: JEDER Fehler bekommt seinen Wiederholweg — auch dieser.
    expect(suche('[data-testid="blatt-erneut"]'), "kein Weg aus dem Fehler heraus").not.toBeNull();
    // Der Befehl ist NICHT ausgeführt und bleibt deshalb in der Adresse stehen.
    expect(adresseJetzt).toBe(`/erfassen?draft=abc-123&${BLATT_WEG_PARAMETER}=datei`);
  });

  it("Z10 · und „Erneut versuchen“ führt den aufgeschobenen einen Schritt doch noch zu Ende", async () => {
    // Der Wunsch wird aufgeschoben, nicht weggeworfen: gelingt der zweite Ladeversuch, öffnet der
    // Dateiimport über dem jetzt geladenen Blatt — und erst dann fällt der Parameter.
    mount(`/erfassen?draft=abc-123&${BLATT_WEG_PARAMETER}=datei`);
    await bisDasLadenDurchIst();
    entwurfsAbruf.antwort = async (kennung: string) => ({
      id: kennung,
      payload: { title: "Beim zweiten Versuch da", bodyHtml: "<p>Inhalt.</p>" },
      originalAuthor: "pedi",
      lastEditor: "pedi",
      createdAt: "2026-09-08T10:00:00.000Z",
      updatedAt: "2026-09-08T10:00:00.000Z",
    });
    act(() => {
      fordere('[data-testid="blatt-erneut"]').click();
    });
    await bisDasLadenDurchIst();
    expect(
      suche('[data-testid="capture-file-pick"]'),
      "der aufgeschobene Weg ist verlorengegangen",
    ).not.toBeNull();
    expect(suche('[data-testid="blatt-lage"]'), "die alte Meldung steht noch").toBeNull();
    expect(adresseJetzt).toBe("/erfassen?draft=abc-123");
  });

  it("Z11 · das Warten hält auch über einen AUSSTEHENDEN zweiten Abruf und einen zweiten Fehler", async () => {
    // ============================================================================================
    // CODEX 63d4453e (RUNDE 3) — DER AUGENBLICK ZWISCHEN „ERNEUT VERSUCHEN" UND DEM NEUEN LADEN.
    // ============================================================================================
    // Z10 misst nur den SOFORT gelingenden zweiten Abruf und entscheidet damit nichts über das
    // Fenster dazwischen: „Erneut versuchen" löscht `err` und erhöht `reloadNonce`, und im Render
    // unmittelbar danach ist `err` schon null, `loadingDraft` aber noch nicht wieder true. Wer die
    // Wartebedingung aus diesen zwei Merkern zusammensetzt, sieht in genau diesem Render „geklärt",
    // reisst den Arbeitsraum auf — und ein ZWEITER Fehlschlag verschwindet wieder darunter.
    //
    // DESHALB EIN AUSSTEHENDES PROMISE statt einer Wartezeit: der Abruf wird von aussen aufgelöst,
    // der Zustand ist also an einer benannten Stelle gemessen und nicht zu einem geratenen Zeitpunkt.
    let loesen: ((wert: unknown) => void) | null = null;
    let ablehnen: ((grund: unknown) => void) | null = null;
    const ausstehend = (): Promise<unknown> =>
      new Promise((res, rej) => {
        loesen = res;
        ablehnen = rej;
      });

    // 1 · Der erste Abruf scheitert sofort (Vorgabe aus `beforeEach`).
    mount(`/erfassen?draft=abc-123&${BLATT_WEG_PARAMETER}=datei`);
    await bisDasLadenDurchIst();
    expect(suche('[data-testid="blatt-lage"]'), "der erste Ladefehler fehlt").not.toBeNull();
    expect(suche('[data-testid="capture-file-pick"]')).toBeNull();

    // 2 · „Erneut versuchen" — und der zweite Abruf bleibt OFFEN.
    entwurfsAbruf.antwort = ausstehend;
    act(() => {
      fordere('[data-testid="blatt-erneut"]').click();
    });
    await bisDasLadenDurchIst();
    expect(
      suche('[data-testid="capture-file-pick"]'),
      "der Arbeitsraum ist aufgegangen, während der zweite Abruf noch läuft",
    ).toBeNull();
    expect(
      adresseJetzt,
      "der Weg-Parameter ist verbraucht worden, bevor der Entwurf geklärt war",
    ).toBe(`/erfassen?draft=abc-123&${BLATT_WEG_PARAMETER}=datei`);

    // 3 · Der zweite Abruf scheitert ebenfalls: Meldung UND Wiederholweg stehen wieder da.
    await act(async () => {
      ablehnen?.(new Error("auch der zweite Versuch scheitert"));
      await Promise.resolve();
    });
    await bisDasLadenDurchIst();
    const lage = suche('[data-testid="blatt-lage"]');
    expect(lage, "der ZWEITE Ladefehler ist unter dem Arbeitsraum verschwunden").not.toBeNull();
    expect((lage?.textContent ?? "").length, "die Meldung ist leer").toBeGreaterThan(0);
    expect(suche('[data-testid="blatt-erneut"]'), "kein Weg aus dem zweiten Fehler").not.toBeNull();
    expect(suche('[data-testid="capture-file-pick"]')).toBeNull();

    // 4 · Der dritte Abruf gelingt — jetzt erst geht der aufgeschobene Weg zu Ende, und das Blatt
    //     darunter trägt wirklich den Entwurf.
    entwurfsAbruf.antwort = async (kennung: string) => ({
      id: kennung,
      payload: { title: "Beim dritten Versuch da", bodyHtml: "<p>Sein gesicherter Absatz.</p>" },
      originalAuthor: "pedi",
      lastEditor: "pedi",
      createdAt: "2026-09-08T10:00:00.000Z",
      updatedAt: "2026-09-08T10:00:00.000Z",
    });
    act(() => {
      fordere('[data-testid="blatt-erneut"]').click();
    });
    await bisDasLadenDurchIst();
    expect(
      suche('[data-testid="capture-file-pick"]'),
      "der aufgeschobene Weg ist verlorengegangen",
    ).not.toBeNull();
    expect(adresseJetzt).toBe("/erfassen?draft=abc-123");
    act(() => {
      abbrechenKnopf().click();
    });
    expect(schreibfeldDa(), "nach dem Abbruch fehlt das Schreibfeld").toBe(true);
    expect((fordere('[data-testid="blatt-titel"]') as HTMLInputElement).value).toBe(
      "Beim dritten Versuch da",
    );
    expect(container?.textContent ?? "").toContain("Sein gesicherter Absatz.");
    // `loesen` bleibt ungenutzt, wenn der Fall durchläuft — es steht da, damit das ausstehende
    // Promise auch auflösbar WÄRE; ein hängendes Promise ohne Ausweg wäre eine Falle für den
    // nächsten Leser.
    void loesen;
  });
});
