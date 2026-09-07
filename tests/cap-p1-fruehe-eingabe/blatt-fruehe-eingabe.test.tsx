// @vitest-environment jsdom
// ================================================================================================
// JOB 3141 (CAP-P1) — WAS WÄHREND DER ENTWURFSLADUNG GETIPPT ODER EINGEFÜGT WIRD, GEHT NICHT MEHR
// STILL VERLOREN.
// ================================================================================================
//
// DER BEFUND (Auftrag §2, Codex CODEX-ANTWORT-51 §2): Wer `/erfassen?draft=<id>` öffnet und sofort
// losschreibt, verliert seinen Satz wortlos — `Blatt.tsx:611-612` setzt Titel und Rumpf
// BEDINGUNGSLOS auf den Serverstand. Die Sperre während des Ladens war HALB da: das Titelfeld trug
// `disabled={loadingDraft}` (`:1764`), die Schreibfläche (`:1847`) trug nichts.
//
// DER GEWÄHLTE WEG IST B — „Bedienung bis Bereitschaft verhindern": Solange der Entwurf geholt wird,
// gibt es auf dem Blatt GAR KEINE Schreibfläche, und an ihrer Stelle steht der übersetzte Grund.
// Damit kann keine Eingabe entstehen, die danach zu verwerfen wäre.
//
// DIESE DATEI MISST DEN LAUFZEITFALL, nicht ein Attribut: das Ladeversprechen wird vom Test SELBST
// aufgelöst (`box.gebremst`), das Fenster steht also wirklich offen. Die Entwurfs-Endpunkte laufen
// gegen den ECHTEN Dienst (CaptureService + InMemoryDraftRepo), derselbe Aufbau wie
// `tests/entwurf-fortsetzen/blatt-entwurf-fortsetzen.test.tsx`.
//
// F1 Tastatur: im Ladefenster nimmt nichts an — kein Schreibfeld, ein sichtbarer Grund, kein Fokus
// F2 Einfügen (HTML und Klartext): der eingefügte Satz entsteht gar nicht erst
// F3 Ladefehler: das Blatt ist danach wieder bedienbar, die Meldung steht
// F3b Die Adresse verliert den Entwurf MITTEN im Laden: die Sperre endet trotzdem
// F4 Entwurf mit Bild + Beschreibung: die Paarung steht, keine verwaiste Beschreibung
// F5 Vergleichsstand: nach dem Laden ist nichts „ungespeichert", und Sichern ist ein `update`
// F6 DE/EN/NL für den neuen Satz
// F7 Diktat: der dritte Eingabeweg wird im Ladefenster ebenfalls angehalten
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  zaehler: { create: 0, update: 0, get: 0 },
  seed: async (_p: Record<string, unknown>): Promise<string> => "",
  liste: async (): Promise<{ id: string; payload: Record<string, unknown> }[]> => [],
  // Das gebremste Ladeversprechen: `gebremst` hält `drafts.get` an, `aufloesen`/`ablehnen` sind die
  // beiden Ausgänge, die der Test selbst zieht. Ohne das stünde das Ladefenster nie offen und der
  // Befund wäre nicht messbar.
  gebremst: false,
  aufloesen: null as null | (() => void),
  ablehnen: null as null | ((grund: unknown) => void),
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", async () => {
  const { InMemoryDraftRepo } = await import("../../services/capture/src/repo");
  const { CaptureService } = await import("../../services/capture/src/service");
  type P = Record<string, unknown>;
  let svc = new CaptureService({ repo: new InMemoryDraftRepo() });
  box.reset = () => {
    svc = new CaptureService({ repo: new InMemoryDraftRepo() });
    box.zaehler.create = 0;
    box.zaehler.update = 0;
    box.zaehler.get = 0;
    box.gebremst = false;
    box.aufloesen = null;
    box.ablehnen = null;
  };
  box.seed = async (p: P) => (await svc.createDraft(p, "u1")).id;
  box.liste = async () => (await svc.listDrafts()) as unknown as { id: string; payload: P }[];
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      drafts: {
        list: vi.fn(async () => svc.listDrafts()),
        get: vi.fn(async (id: string) => {
          box.zaehler.get += 1;
          if (box.gebremst) {
            await new Promise<void>((res, rej) => {
              box.aufloesen = res;
              box.ablehnen = rej;
            });
          }
          return svc.getDraft(id);
        }),
        create: vi.fn(async (p: P) => {
          box.zaehler.create += 1;
          return svc.createDraft(p, "u1");
        }),
        update: vi.fn(async (id: string, p: P) => {
          box.zaehler.update += 1;
          return svc.continueDraft(id, p, "u1");
        }),
        remove: vi.fn(async (id: string) => svc.deleteDraft(id)),
        promote: vi.fn(async () => ({ id: "ko-1", title: "egal" })),
      },
      ko: { list: ok([]) },
      knowledge: { check: ok({ status: "pending" }) },
      directory: { list: ok([{ id: "u1", name: "Pia", email: "p@x.de", role: "editor" }]) },
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ stage: "search_on_click" }) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      gaps: { list: ok([]) },
      reasoner: {
        status: ok({ active: false, mode: "off", reachable: "unknown" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
        assist: vi.fn(async () => ({})),
      },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  MemoryRouter,
  Route,
  Routes,
  useNavigate,
} from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Echte Zeit verstreichen lassen — die Galerie unter dem Blatt ist entprellt (300 ms). */
const warten = async (ms: number): Promise<void> => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
    await flush();
  });
};

/** Ein Weg, den es im Produkt gibt: irgendein Verweis führt zurück auf `/erfassen` OHNE Entwurf. */
function Wege(): JSX.Element {
  const gehe = useNavigate();
  return createElement("button", {
    type: "button",
    "data-testid": "nach-erfassen",
    onClick: () => gehe("/erfassen"),
  });
}

async function mount(url: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(
                MemoryRouter,
                { initialEntries: [url] },
                createElement(
                  ImageDescribeProvider,
                  null,
                  createElement(
                    NavGuardProvider,
                    null,
                    createElement(
                      Routes,
                      null,
                      createElement(Route, {
                        path: "/erfassen",
                        element: createElement(CaptureFrontDoor),
                      }),
                    ),
                    createElement(Wege),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

function unmount(): void {
  act(() => root.unmount());
  container.remove();
}

function pruefknopf(name: string): HTMLButtonElement {
  const el = container.querySelector(`[data-testid="${name}"]`);
  if (!(el instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${name}" fehlt`);
  }
  return el;
}

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

function titelfeld(): HTMLInputElement {
  const el = container.querySelector('[data-testid="blatt-titel"]');
  if (!(el instanceof HTMLInputElement)) {
    throw new Error("Titelfeld nicht gefunden");
  }
  return el;
}

/** Die Schreibfläche, WENN es sie gibt — `null` heisst: das Blatt nimmt gerade nichts an. */
function schreibfeld(): HTMLElement | null {
  const el = container.querySelector('[data-testid="blatt-text"] [role="textbox"]');
  return el instanceof HTMLElement ? el : null;
}

function schreibfeldPflicht(): HTMLElement {
  const el = schreibfeld();
  if (!el) {
    throw new Error("Schreibfeld nicht gefunden");
  }
  return el;
}

/** Der Bereich, in den ein Mensch schreiben oder einfügen WÜRDE — mit oder ohne Schreibfläche. */
function schreibbereich(): HTMLElement {
  const el = container.querySelector('[data-testid="blatt-text"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error("Schreibbereich nicht gefunden");
  }
  return el;
}

function hinweis(): HTMLElement | null {
  const el = container.querySelector('[data-testid="blatt-nicht-bereit"]');
  return el instanceof HTMLElement ? el : null;
}

async function tippeRumpf(html: string): Promise<void> {
  const feld = schreibfeldPflicht();
  await act(async () => {
    feld.innerHTML = html;
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

/**
 * Ein ECHTES Einfüge-Ereignis auf das Ziel, das der Mensch treffen würde. jsdom kennt keinen
 * `ClipboardEvent`-Konstruktor; die Nutzlast wird deshalb an das native Ereignis gehängt — React
 * liest genau dieses Feld (`SyntheticClipboardEvent.clipboardData`).
 */
async function einfuegen(ziel: HTMLElement, daten: { html?: string; text: string }): Promise<void> {
  const ereignis = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(ereignis, "clipboardData", {
    value: {
      items: [] as unknown[],
      getData: (art: string) => (art === "text/html" ? (daten.html ?? "") : daten.text),
    },
  });
  await act(async () => {
    ziel.dispatchEvent(ereignis);
    await flush();
  });
}

/** Die Einfügemarke ins Schreibfeld setzen — ohne sie hätte ein Einfügen im Browser kein Ziel. */
function markeSetzen(feld: HTMLElement): void {
  const bereich = document.createRange();
  bereich.selectNodeContents(feld);
  bereich.collapse(false);
  const auswahl = window.getSelection();
  auswahl?.removeAllRanges();
  auswahl?.addRange(bereich);
}

const TITEL = "Presse P4 abschmieren";
const RUMPF = "<p>Vor jedem Anlauf die Schmierstellen prüfen.</p>";
const FRUEH = "Mein früher Satz gehört mir.";

async function entwurfSaeen(zusatz: Record<string, unknown> = {}): Promise<string> {
  return box.seed({
    title: TITEL,
    statement: "Vor jedem Anlauf die Schmierstellen prüfen.",
    bodyHtml: RUMPF,
    origin: "frontdoor",
    ...zusatz,
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.reset();
});

afterEach(() => {
  unmount();
  vi.clearAllMocks();
});

describe("JOB 3141 (CAP-P1): das Ladefenster nimmt nichts an, statt es wegzuwerfen", () => {
  it("F1: während der Entwurfsladung gibt es keine Schreibfläche — und der Grund steht sichtbar da", async () => {
    const kennung = await entwurfSaeen();
    box.gebremst = true;
    await mount(`/erfassen?draft=${kennung}`);

    // Das Ladefenster steht WIRKLICH offen — sonst misst dieser Fall den Zustand danach.
    expect(box.aufloesen, "Ladeversprechen nicht angehalten").not.toBeNull();

    // ============================================================================================
    // DER LAUFZEITFALL, NICHT DAS ATTRIBUT: es gibt nichts, was eine Taste annehmen könnte.
    // ============================================================================================
    expect(schreibfeld(), "Schreibfläche im Ladefenster vorhanden").toBeNull();
    expect(container.querySelectorAll("[contenteditable]").length).toBe(0);

    // Und der Mensch erfährt WARUM — ein übersetzter Satz, kein Cursor-Stil.
    const grund = hinweis();
    expect(grund, "kein sichtbarer Grund an der Schreibfläche").not.toBeNull();
    expect((grund?.textContent ?? "").trim()).toBe(i18n.t("erfassen.laden.nichtBereit"));
    expect(schreibbereich().contains(grund as Node)).toBe(true);

    // DIESELBE REGEL FÜR DEN TITEL (Lieferung 4): auch er nimmt nichts an — gemessen daran, dass er
    // nicht einmal die Einfügemarke bekommt, und er nennt denselben Grund.
    const feld = titelfeld();
    feld.focus();
    expect(document.activeElement, "Titelfeld nimmt im Ladefenster den Fokus").not.toBe(feld);
    expect(feld.getAttribute("aria-describedby")).toBe(grund?.id);
    // Ohne Fokus öffnet das Titel-Menü nicht — die vier Starter sind damit ebenfalls unerreichbar.
    expect(container.querySelector('[data-testid="blatt-menue-titel"]')).toBeNull();

    // ---- und nach dem Laden steht der Entwurf da, bedienbar -------------------------------------
    await act(async () => {
      box.aufloesen?.();
      await flush();
    });

    expect(hinweis()).toBeNull();
    expect(titelfeld().disabled).toBe(false);
    expect(titelfeld().value).toBe(TITEL);
    expect(schreibfeldPflicht().innerHTML).toContain("Schmierstellen");
  });

  it("F2: der Einfügeweg (HTML und Klartext) findet im Ladefenster keinen Empfänger", async () => {
    const kennung = await entwurfSaeen();
    box.gebremst = true;
    await mount(`/erfassen?draft=${kennung}`);

    // Das Ziel ist das, was der Mensch trifft: die Schreibfläche, solange es sie gibt — sonst die
    // Stelle, an der sie stünde. HEUTE ist das der Editor, und er nimmt das HTML an.
    const ziel = schreibfeld() ?? schreibbereich();
    const feld = schreibfeld();
    if (feld) {
      markeSetzen(feld);
    }
    await einfuegen(ziel, { html: `<p>${FRUEH}</p>`, text: FRUEH });
    await einfuegen(titelfeld(), { text: FRUEH });
    await einfuegen(ziel, { text: FRUEH });

    // DER BEFUND, umgedreht: der Satz darf gar nicht erst auf dem Blatt stehen. Stünde er hier,
    // würde ihn `setBodyHtml(loadedBody)` gleich darauf wortlos ersetzen.
    expect(container.textContent ?? "", "Eingefügtes im Ladefenster angenommen").not.toContain(
      FRUEH,
    );

    await act(async () => {
      box.aufloesen?.();
      await flush();
    });

    expect(schreibfeldPflicht().innerHTML).toContain("Schmierstellen");
    expect(container.textContent ?? "").not.toContain(FRUEH);
    expect(titelfeld().value).toBe(TITEL);
  });

  it("F3: ein Ladefehler hinterlässt keine tote Schreibfläche", async () => {
    const kennung = await entwurfSaeen();
    box.gebremst = true;
    await mount(`/erfassen?draft=${kennung}`);
    expect(schreibfeld()).toBeNull();

    await act(async () => {
      box.ablehnen?.(new Error("Netz weg"));
      await flush();
    });

    // Der Grund für die Sperre ist weg, der Grund für den Fehler steht da.
    expect(hinweis()).toBeNull();
    expect(titelfeld().disabled).toBe(false);
    expect(container.textContent ?? "").toContain(i18n.t("fd.errLoadFailed"));

    // Und das Blatt lässt sich WIRKLICH wieder beschreiben.
    await tippeRumpf("<p>Dann schreibe ich es eben neu.</p>");
    expect(schreibfeldPflicht().textContent).toContain("Dann schreibe ich es eben neu.");
  });

  it("F3b: verliert die Adresse den Entwurf mitten im Laden, endet die Sperre trotzdem", async () => {
    const kennung = await entwurfSaeen();
    box.gebremst = true;
    await mount(`/erfassen?draft=${kennung}`);
    expect(schreibfeld()).toBeNull();

    // Ein Verweis auf `/erfassen` ohne Kennung — der Ladeeffekt läuft in seinen Verlassens-Zweig,
    // und das angehaltene Versprechen kommt nie zurück. Ohne eine Freigabe DORT bliebe das Blatt
    // für immer gesperrt.
    await click(pruefknopf("nach-erfassen"));

    expect(hinweis(), "Sperre überlebt das Verlassen des Entwurfs").toBeNull();
    expect(titelfeld().disabled).toBe(false);
    expect(pruefknopf("blatt-entwurf-sichern").disabled).toBe(true); // leeres Blatt, nichts zu sichern
    await tippeRumpf("<p>Ein neues Blatt, sofort beschreibbar.</p>");
    expect(schreibfeldPflicht().textContent).toContain("Ein neues Blatt");
    expect(pruefknopf("blatt-entwurf-sichern").disabled).toBe(false);
  });

  it("F4: ein geladener Entwurf mit Bild behält seine Beschreibung — keine verwaiste Fußnote", async () => {
    const BILD =
      '<figure><img data-image-id="kw-img-p1-1" src="data:image/png;base64,QQ=="><figcaption data-image-id="kw-img-p1-1">Schmierstelle am Exzenter</figcaption></figure>';
    const kennung = await entwurfSaeen({ bodyHtml: `${RUMPF}${BILD}` });
    box.gebremst = true;
    await mount(`/erfassen?draft=${kennung}`);
    expect(schreibfeld()).toBeNull();

    await act(async () => {
      box.aufloesen?.();
      await flush();
    });
    // Die Galerie unter dem Blatt ist entprellt — erst danach spricht sie über denselben Stand.
    await warten(400);

    const feld = schreibfeldPflicht();
    expect(feld.querySelectorAll("figure").length).toBe(1);
    expect(feld.querySelectorAll("figcaption").length).toBe(1);
    const fussnote = feld.querySelector("figcaption");
    expect(fussnote?.textContent).toContain("Schmierstelle am Exzenter");
    // Sie hängt an IHREM Bild, nicht daneben.
    expect(fussnote?.getAttribute("data-image-id")).toBe(
      feld.querySelector("figure img")?.getAttribute("data-image-id"),
    );

    // Und die Galerie zeigt genau ein Bild, das seine Beschreibung trägt.
    const kacheln = [...container.querySelectorAll("img")].filter((b) =>
      (b.getAttribute("src") ?? "").startsWith("data:image/png"),
    );
    const galerie = kacheln.filter((b) => !feld.contains(b));
    expect(galerie).toHaveLength(1);
    expect(galerie[0]?.getAttribute("alt")).toBe("Schmierstelle am Exzenter");
  });

  it("F5: nach dem Laden ist nichts ungespeichert — und Sichern aktualisiert denselben Entwurf", async () => {
    const kennung = await entwurfSaeen();
    box.gebremst = true;
    await mount(`/erfassen?draft=${kennung}`);
    await act(async () => {
      box.aufloesen?.();
      await flush();
    });
    box.zaehler.create = 0;
    box.zaehler.update = 0;

    // DER VERGLEICHSSTAND, gemessen an seiner Wirkung: der Entladewächter (`useUnloadGuard`) hängt
    // am selben Prädikat wie die Fläche. Frisch geladen gibt es nichts zu warnen.
    const ruhig = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(ruhig);
    expect(ruhig.defaultPrevented, "frisch geladen gilt als ungespeichert").toBe(false);

    await tippeRumpf(`${RUMPF}<p>Nachtrag.</p>`);
    const unruhig = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unruhig);
    expect(unruhig.defaultPrevented, "geänderter Rumpf gilt als gespeichert").toBe(true);

    await click(pruefknopf("blatt-entwurf-sichern"));
    expect(box.zaehler.update).toBe(1);
    expect(box.zaehler.create).toBe(0);
    const alle = await box.liste();
    expect(alle).toHaveLength(1);
    expect(alle[0]?.id).toBe(kennung);
    expect(String(alle[0]?.payload.bodyHtml)).toContain("Nachtrag.");
  });

  it("F6: der neue Satz steht dreisprachig da und unterscheidet sich", () => {
    for (const schluessel of ["erfassen.laden.nichtBereit"]) {
      const de = i18n.getResource("de", "translation", schluessel) as string | undefined;
      const en = i18n.getResource("en", "translation", schluessel) as string | undefined;
      const nl = i18n.getResource("nl", "translation", schluessel) as string | undefined;
      expect(typeof de).toBe("string");
      expect(typeof en).toBe("string");
      expect(typeof nl).toBe("string");
      expect((de ?? "").length).toBeGreaterThan(0);
      expect(de).not.toBe(en);
      expect(de).not.toBe(nl);
      expect(en).not.toBe(nl);
    }
  });
});

// ================================================================================================
// F7 — DER DRITTE EINGABEWEG: DAS DIKTAT.
// ================================================================================================
// Tastatur und Einfügen laufen über die Schreibfläche; das Diktat NICHT — es schreibt über
// `setBodyHtml` direkt in den Blattzustand (`Blatt.tsx`, `diktatUmschalten`). Eine Sperre, die nur
// die Fläche kennt, liesse genau diesen Weg offen. jsdom bringt keine Spracherkennung mit, also
// stellt der Test eine hin — dieselbe Schnittstelle, die `lib/speechDictation.ts` erwartet.
//
// ================================================================================================
// RUNDE 2 (bens Korrekturpflicht 2) — DAS DOPPEL HÄLT SICH AN DIE SPEZIFIKATION.
// ================================================================================================
// In Runde 1 beendete `stop()` die Sitzung SYNCHRON und lieferte danach nichts mehr. Genau das
// kann der Browser nicht zusagen: `stop()` bittet um Abschluss, das laufende Ergebnis kommt noch
// und `end` folgt danach (Web-Speech §4.1.4/§4.1.5). Das Doppel zählt deshalb nur noch, dass
// `stop()` gerufen wurde — `result` und `end` feuert der TEST, und zwar genau in den Reihenfolgen,
// die ben gemessen hat. Ohne diese Trennung war F7 ein Test über den eigenen Aufbau.
describe("JOB 3141 (CAP-P1): das Diktat wird beim Ladebeginn vom Blatt GETRENNT", () => {
  interface Sitzung {
    onresult: ((e: unknown) => void) | null;
    onend: (() => void) | null;
    gestoppt: number;
  }
  let sitzungen: Sitzung[] = [];

  class FakeRec {
    lang = "";
    continuous = false;
    interimResults = false;
    onresult: ((e: unknown) => void) | null = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    gestoppt = 0;
    start(): void {
      sitzungen.push(this as unknown as Sitzung);
    }
    // KEIN synchrones Ende: der Browser führt die laufende Erkennung nach `stop()` noch zu Ende.
    stop(): void {
      this.gestoppt += 1;
    }
  }

  /** Ein (auch verspätetes) Erkennungsergebnis dieser Sitzung. */
  async function spreche(s: Sitzung, text: string): Promise<void> {
    await act(async () => {
      s.onresult?.({ resultIndex: 0, results: [[{ transcript: text }]] });
      await flush();
    });
  }

  /** Das `end` dieser Sitzung — nach der Spezifikation kommt es NACH dem letzten Ergebnis. */
  async function beende(s: Sitzung): Promise<void> {
    await act(async () => {
      s.onend?.();
      await flush();
    });
  }

  async function diktatStarten(): Promise<Sitzung> {
    const vorher = sitzungen.length;
    await click(pruefknopf("blatt-werkzeug-diktieren"));
    expect(sitzungen.length, "Diktat nicht gestartet").toBe(vorher + 1);
    return sitzungen[sitzungen.length - 1] as Sitzung;
  }

  /** Denselben Entwurf über die vorhandene Fläche „…" → „Entwürfe" öffnen — das Laden beginnt. */
  async function entwurfOeffnen(): Promise<void> {
    await click(pruefknopf("blatt-werkzeug-mehr"));
    const eintrag = [...container.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes(i18n.t("erfassen.mehr.entwuerfe")),
    );
    await click(eintrag as HTMLButtonElement);
    const entwurf = [...container.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes(TITEL),
    );
    await click(entwurf as HTMLButtonElement);
    expect(box.aufloesen, "Ladeversprechen nicht angehalten").not.toBeNull();
  }

  beforeEach(() => {
    sitzungen = [];
    (globalThis as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRec;
  });

  afterEach(() => {
    (globalThis as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = undefined;
  });

  it("F7a: ein Ergebnis WÄHREND der Sperre wird nicht angenommen — der Knopf ist gesperrt, der Entwurf kommt sauber an", async () => {
    await entwurfSaeen();
    await mount("/erfassen");

    const alt = await diktatStarten();
    await spreche(alt, "Gesprochen");
    expect(schreibfeldPflicht().textContent).toContain("Gesprochen");

    box.gebremst = true;
    await entwurfOeffnen();

    expect(alt.gestoppt, "laufendes Diktat nicht angehalten").toBe(1);
    expect(pruefknopf("blatt-werkzeug-diktieren").disabled).toBe(true);
    expect(hinweis()).not.toBeNull();

    // DAS ABSCHLUSSERGEBNIS DER ALTEN SITZUNG, mitten im Ladefenster.
    await spreche(alt, "BEN verspätetes Ergebnis aus dem alten Blatt");
    expect(container.textContent ?? "").not.toContain("BEN verspätetes Ergebnis");

    await act(async () => {
      box.aufloesen?.();
      await flush();
    });

    // Der geladene Entwurf steht — ohne Beimischung, und ohne den eigenen Satz von vorher.
    const feld = schreibfeldPflicht();
    expect(feld.textContent).toContain("Schmierstellen");
    expect(feld.textContent).not.toContain("BEN verspätetes Ergebnis");
    expect(feld.textContent).not.toContain("Gesprochen");
    expect(pruefknopf("blatt-werkzeug-diktieren").disabled).toBe(false);
  });

  it("F7b: ein Ergebnis NACH dem Laden landet nicht im fremden Entwurf (bens Messung)", async () => {
    await entwurfSaeen();
    await mount("/erfassen");

    const alt = await diktatStarten();
    await spreche(alt, "Gesprochen");

    box.gebremst = true;
    await entwurfOeffnen();
    await act(async () => {
      box.aufloesen?.();
      await flush();
    });

    const nachDemLaden = schreibfeldPflicht().innerHTML;
    expect(nachDemLaden).toContain("Schmierstellen");

    // BENS MESSUNG, wörtlich: „`stop()` kehrt zurück, Entwurf wird geladen, anschließend trifft das
    // abschließende Diktatergebnis ein." In Runde 1 stand danach
    // „…prüfen.BEN verspätetes Ergebnis aus dem alten Blatt" im Editor.
    await spreche(alt, "BEN verspätetes Ergebnis aus dem alten Blatt");
    await beende(alt);

    expect(schreibfeldPflicht().innerHTML).toBe(nachDemLaden);
    expect(container.textContent ?? "").not.toContain("BEN verspätetes Ergebnis");
  });

  it("F7c: auch nach einem LADEFEHLER nimmt die getrennte Sitzung nichts mehr an", async () => {
    await entwurfSaeen();
    await mount("/erfassen");

    const alt = await diktatStarten();
    await spreche(alt, "Gesprochen");

    box.gebremst = true;
    await entwurfOeffnen();
    await act(async () => {
      box.ablehnen?.(new Error("Netz weg"));
      await flush();
    });

    // Der Ladefehler nimmt dem Menschen seinen Text nicht — er stand vor dem Laden da und steht noch.
    const nachDemFehler = schreibfeldPflicht().innerHTML;
    expect(nachDemFehler).toContain("Gesprochen");
    expect(container.textContent ?? "").toContain(i18n.t("fd.errLoadFailed"));

    await spreche(alt, "BEN verspätetes Ergebnis aus dem alten Blatt");
    expect(schreibfeldPflicht().innerHTML).toBe(nachDemFehler);
  });

  it("F7d: danach diktiert es wieder — und das späte Ende der alten Sitzung nimmt der neuen nichts", async () => {
    await entwurfSaeen();
    await mount("/erfassen");

    const alt = await diktatStarten();
    box.gebremst = true;
    await entwurfOeffnen();
    await act(async () => {
      box.aufloesen?.();
      await flush();
    });

    // Ein NEUES Diktat auf dem geladenen Entwurf: es schreibt.
    const neu = await diktatStarten();
    expect(neu).not.toBe(alt);
    await spreche(neu, "Neuer Satz nach dem Laden");
    expect(schreibfeldPflicht().textContent).toContain("Neuer Satz nach dem Laden");

    // Jetzt meldet die ALTE Sitzung ihr Ende. Nähme sie der neuen den Läuft-Zustand, verschwände
    // der Stoppweg, während das Mikrofon läuft (`lib/speechDictation.ts:83-98`). Gemessen wird das
    // an der Wirkung: ein Klick auf den Knopf muss die NEUE Sitzung anhalten und keine dritte
    // starten.
    await beende(alt);
    await click(pruefknopf("blatt-werkzeug-diktieren"));
    expect(sitzungen, "eine dritte Sitzung gestartet statt angehalten").toHaveLength(2);
    expect(neu.gestoppt, "die laufende Sitzung wurde nicht angehalten").toBe(1);

    // Und ihr eigenes Abschlussergebnis gehört ihr: der Mensch hat SELBST angehalten, hier wird
    // nicht getrennt.
    await spreche(neu, "Und der letzte Satz");
    expect(schreibfeldPflicht().textContent).toContain("Und der letzte Satz");
  });
});
