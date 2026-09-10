// @vitest-environment jsdom
// JOB 3427: echtes Blatt, echter Hook und API-Serializer; nur der HTTP-Transport ist gestellt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  antwort: { status: "done", similar: [], conflicts: [] } as unknown,
  fehler: false,
  /** Die Uhr des Dienstes — jeder Entwurf bekommt seinen eigenen, gemessenen Zeitpunkt. */
  zeit: 0,
  zaehler: { get: 0, list: 0, remove: 0 },
  seed: async (_p: Record<string, unknown>): Promise<string> => "",
  // JOB 3556: derselbe Entwurfsbestand, den die Fläche bearbeitet — für den SERVER lesbar gemacht.
  // Ohne diese Brücke kennt die Route den Entwurf nicht, den der Editor gerade lädt; „kein Judge"
  // käme dann vom unauflösbaren Anker statt von der gespeicherten Stufe, und F3b wäre ein
  // Scheingrün. Nur Lesezugriff, genau wie der echte Backstop.
  getDraft: async (_id: string): Promise<{ payload: { confidentiality?: unknown } } | undefined> =>
    undefined,
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
  const bauen = (): InstanceType<typeof CaptureService> =>
    new CaptureService({ repo: new InMemoryDraftRepo(), now: () => box.zeit });
  let svc = bauen();
  box.reset = () => {
    box.zeit = Date.parse("2026-09-01T08:00:00.000Z");
    svc = bauen();
    box.zaehler.get = 0;
    box.zaehler.list = 0;
    box.zaehler.remove = 0;
  };
  box.seed = async (p: P) => {
    // Jeder Entwurf eine Minute später als der vorige: die Ordnung „neueste zuerst" ist damit
    // eine Tatsache des Bestands, nicht eine Folge der Einfügereihenfolge.
    box.zeit += 60_000;
    return (await svc.createDraft(p, "u1")).id;
  };
  box.getDraft = async (id: string) => svc.getDraft(id);
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      drafts: {
        list: vi.fn(async () => {
          box.zaehler.list += 1;
          return svc.listDrafts();
        }),
        get: vi.fn(async (id: string) => {
          box.zaehler.get += 1;
          return svc.getDraft(id);
        }),
        create: vi.fn(async (p: P) => {
          box.zeit += 60_000;
          return svc.createDraft(p, "u1");
        }),
        update: vi.fn(async (id: string, p: P) => {
          box.zeit += 60_000;
          return svc.continueDraft(id, p, "u1");
        }),
        remove: vi.fn(async (id: string) => {
          box.zaehler.remove += 1;
          return svc.deleteDraft(id);
        }),
        promote: vi.fn(async () => ({ id: "ko-1", title: "egal" })),
      },
      ko: { list: ok([]) },
      knowledge: (
        await vi.importActual<typeof import("../../apps/web/src/api/endpoints")>(
          "../../apps/web/src/api/endpoints",
        )
      ).endpoints.knowledge,
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
  useLocation,
} from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";
import { DRAFT, appWith, conflictVerdict } from "./fixture";

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

function Adresse(): JSX.Element {
  const ort = useLocation();
  return createElement("span", { "data-testid": "adresse" }, `${ort.pathname}${ort.search}`);
}

async function mount(url = "/erfassen"): Promise<QueryClient> {
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
                    createElement(Adresse),
                  ),
                ),
              ),
              createElement(ToastViewport),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  return qc;
}

function unmount(): void {
  act(() => root.unmount());
  container.remove();
}

const TEXT = DRAFT;
let server: Awaited<ReturnType<typeof appWith>>;
let drahtAntwort: { status: string; similar: unknown[]; conflicts: unknown[] } | undefined;
const MATCH = {
  id: "kc",
  title: "Kaltstart Vorwärmung",
  score: 0.8,
  koStatus: "offen",
  koCategory: "Anlage",
};

beforeEach(async () => {
  await i18n.changeLanguage("de");
  localStorage.clear();
  box.reset();
  box.fehler = false;
  box.antwort = undefined;
  drahtAntwort = undefined;
  server = await appWith({
    active: true,
    verdict: conflictVerdict,
    // Der Server liest DENSELBEN Entwurfsbestand wie die Fläche — sonst misst F3b nichts.
    capture: { getDraft: (id: string) => box.getDraft(id) },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("/api/knowledge/check");
      if (box.fehler) throw new Error("offline");
      if (box.antwort !== undefined) return new Response(JSON.stringify(box.antwort));
      const response = await server.app.inject({
        method: "POST",
        url,
        payload: JSON.parse(String(init?.body)),
      });
      drahtAntwort = response.json();
      return new Response(response.body, { status: response.statusCode });
    }),
  );
});
afterEach(async () => {
  if (container?.isConnected) unmount();
  await server.app.close();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// JOB 3556: die Stufe des GESPEICHERTEN Entwurfs ist ab jetzt Teil des Aufbaus — sie entscheidet,
// was der Editor an die Route weitergibt. „ohne" heißt: der Entwurf trägt gar kein Feld
// `confidentiality`. BEWUSST ein Wort und nicht `undefined`: ein ausdrücklich übergebenes
// `undefined` löst in JavaScript den Vorgabewert aus — der Fall „ohne Einstufung" wäre dann
// stillschweigend der Fall „intern" gewesen (in Runde 1 genau so gemessen).
//
// Gibt die Kennung des gesäten Entwurfs ZURÜCK: sie ist der Anker, an dem der Server die
// gespeicherte Stufe hebt, und die Nutzlast-Prüfungen nennen genau sie statt „irgendeine
// Zeichenkette". Ein `expect.any(String)` liesse einen falschen Anker durchgehen.
async function gespeichertesBlatt(
  stufe: "intern" | "vertraulich" | "ohne" = "intern",
): Promise<string> {
  const id = await box.seed({
    title: "Kaltstart",
    bodyHtml: `<p>${TEXT}</p>`,
    ...(stufe === "ohne" ? {} : { confidentiality: stufe }),
  });
  await mount(`/erfassen?draft=${id}`);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 650));
  });
  expect(fetch).toHaveBeenCalledWith(
    "/api/knowledge/check",
    expect.objectContaining({
      method: "POST",
      body: expect.stringContaining(TEXT),
    }),
  );
  return id;
}

function chip(): Element | null {
  return container.querySelector('[data-testid="blatt-live-chip"]');
}
function hinweis(): Element | null {
  return container.querySelector('[data-testid="blatt-live-ausfall"]');
}

// JOB 3556: die ZULETZT abgesendete Nutzlast, so wie sie am Draht steht. Gemessen wird das
// vollständige Objekt (`toEqual`), nicht „enthält ein Feld": nur so fällt auf, wenn ein Feld
// erfunden dazukommt (ein Vorgabewert „nicht vertraulich") oder eines still verschwindet.
function nutzlast(): Record<string, unknown> {
  const aufrufe = vi.mocked(fetch).mock.calls;
  const letzter = aufrufe[aufrufe.length - 1];
  if (!letzter) {
    throw new Error("Es gab keine Anfrage an /knowledge/check.");
  }
  return JSON.parse(String((letzter[1] as RequestInit).body));
}

// Der Mensch wählt im Blatt eine Stufe — über das echte Menü, nicht über einen gesetzten Zustand.
async function stufeWaehlen(stufe: "intern" | "vertraulich"): Promise<void> {
  await act(async () => {
    const werkzeug = container.querySelector('[data-testid="blatt-werkzeug-vertraulichkeit"]');
    if (!(werkzeug instanceof HTMLButtonElement)) {
      throw new Error("Das Menü Vertraulichkeit ist nicht auf dem Blatt.");
    }
    werkzeug.click();
    await flush();
  });
  await act(async () => {
    const flaeche = container.querySelector('[data-testid="blatt-menue-vertraulichkeit"]');
    if (!(flaeche instanceof HTMLElement)) {
      throw new Error("Das Menü Vertraulichkeit hat sich nicht geöffnet.");
    }
    const eintrag = [...flaeche.querySelectorAll("button")].find(
      (b) => (b.textContent ?? "").trim() === i18n.t(`conf.level.${stufe}`),
    );
    if (!(eintrag instanceof HTMLButtonElement)) {
      throw new Error(`Stufe '${stufe}' nicht im Menü.`);
    }
    eintrag.click();
    await flush();
  });
  // Der Wechsel der Einstufung ist eine neue Frage an den Server — der Debounce muss ablaufen.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 650));
  });
}

describe("Live-Prüfung im gemounteten Editor", () => {
  it("pending mit Ähnlichkeit sagt sichtbar nicht geprüft, ohne falsche Nulltrefferaussage", async () => {
    box.antwort = { status: "pending", similar: [MATCH], conflicts: [] };
    await gespeichertesBlatt();
    expect(chip()?.getAttribute("data-lage")).toBe("similar");
    expect(hinweis()?.textContent).toBe("Auf Widerspruch noch nicht geprüft.");
    expect(container.textContent).not.toContain("Ähnliches gefunden? Nein.");
  });
  it("failed mit Treffern zeigt den Ausfall vor der Ähnlichkeit", async () => {
    box.antwort = { status: "failed", similar: [MATCH], conflicts: [MATCH] };
    await gespeichertesBlatt();
    expect(chip()?.getAttribute("data-lage")).toBe("similar");
    expect(hinweis()?.textContent).toBe("Prüfung derzeit nicht verfügbar.");
  });
  it("Netzwerkfehler ist ohne Öffnen des Statusmenüs sichtbar", async () => {
    box.fehler = true;
    await gespeichertesBlatt();
    expect(chip()).toBeNull();
    expect(hinweis()?.textContent).toBe("Prüfung derzeit nicht verfügbar.");
  });
  it("Darstellungsvertrag: kalibriertes Konfliktergebnis zeigt Treffer, Fundort und Link", async () => {
    // Das sichtbare Ergebnis kommt aus der echten Konfliktkette mit lokalem Fixture-Judge.
    // Die Kalibrieranfrage ist kein Beleg für die noch fehlende Entwurfsbindung im Editor.
    const response = await server.app.inject({
      method: "POST",
      url: "/api/knowledge/check",
      payload: {
        text: TEXT,
        source: "draft",
        confidentiality: "intern",
        koId: "kc",
      },
    });
    expect(server.judgeConflict).toHaveBeenCalled();
    box.antwort = response.json();
    await gespeichertesBlatt();
    expect(chip()?.getAttribute("data-lage")).toBe("conflict");
    await act(async () => {
      (chip()?.querySelector("button") as HTMLButtonElement).click();
    });
    expect(chip()?.textContent).toContain("Kaltstart Vorwärmung");
    expect(chip()?.textContent).toContain("Anlage");
    expect(chip()?.querySelector("a")?.getAttribute("href")).toBe("/wissen/kc");
    expect(hinweis()).toBeNull();
  });
  it("Darstellungsvertrag (Stub, kein Teil-A-Beleg): abgeschlossene Ähnlichkeit", async () => {
    box.antwort = { status: "done", similar: [MATCH], conflicts: [] };
    await gespeichertesBlatt();
    expect(chip()?.getAttribute("data-lage")).toBe("similar");
  });
  it("Darstellungsvertrag (Stub, kein Teil-A-Beleg): nur done ohne Treffer zeigt neu", async () => {
    box.antwort = { status: "done", similar: [], conflicts: [] };
    await gespeichertesBlatt();
    expect(chip()?.getAttribute("data-lage")).toBe("new");
  });
});

it.each([
  ["de", "Auf Widerspruch noch nicht geprüft."],
  ["en", "Conflict check not yet run."],
  ["nl", "Nog niet op tegenstrijdigheid gecontroleerd."],
])("echte Route ohne Modell sagt auf %s ehrlich nicht geprüft", async (locale, sentence) => {
  await i18n.changeLanguage(locale);
  await server.app.close();
  server = await appWith({ active: false });
  await gespeichertesBlatt();
  expect(server.judgeConflict).not.toHaveBeenCalled();
  expect(hinweis()?.textContent).toBe(sentence);
  await pruefeAehnlichenFundort();
});

it("ungespeicherter Text bleibt am echten Draht pending ohne Judge; derselbe Spy ist wirksam", async () => {
  await mount();
  const editor = container.querySelector('[role="textbox"]');
  expect(editor).toBeInstanceOf(HTMLElement);
  await act(async () => {
    if (editor) {
      editor.innerHTML = `<p>${TEXT}</p>`;
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    }
    await flush();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 650));
  });
  expect(fetch).toHaveBeenCalled();
  // JOB 3556: ein frisches Blatt hat keine gewählte Einstufung — also reist auch keine. Kein
  // `source`, kein `confidentiality`: der Server entscheidet unverändert fail-safe.
  expect(nutzlast()).toEqual({ text: TEXT });
  expect(server.judgeConflict).not.toHaveBeenCalled();
  expect(hinweis()?.textContent).toBe("Auf Widerspruch noch nicht geprüft.");
  await pruefeAehnlichenFundort();
  const calibration = await server.app.inject({
    method: "POST",
    url: "/api/knowledge/check",
    payload: {
      text: TEXT,
      source: "draft",
      confidentiality: "intern",
      koId: "kc",
    },
  });
  expect(calibration.json().status).toBe("done");
  expect(server.judgeConflict).toHaveBeenCalled();
});

async function pruefeAehnlichenFundort(): Promise<void> {
  expect(chip()?.getAttribute("data-lage")).toBe("similar");
  await act(async () => {
    (chip()?.querySelector("button") as HTMLButtonElement).click();
  });
  const fundort = chip()?.querySelector('[data-testid="live-fundort"]');
  expect(fundort?.textContent).toContain("Anlage");
  expect(fundort?.textContent).toContain(i18n.t("status.offen"));
  expect(chip()?.querySelector("a")?.getAttribute("href")).toBe("/wissen/kc");
  expect(chip()?.querySelector("a")?.textContent).toBe("Kaltstart Vorwärmung");
}

// ==================================================================================================
// JOB 3556 · TEIL A — F1: DIE HERKUNFT REIST MIT, UND DER WIDERSPRUCH KOMMT AN.
// ==================================================================================================
// Bis JOB 3556 stand hier der Gegenbeweis: derselbe Aufbau (gespeicherter, als „intern" eingestufter
// Entwurf, aktives Modell) endete am echten Draht in „pending" — der Browser schickte nur `{text}`,
// die Route stufte die fehlende Herkunft fail-safe als vertraulich ein und ließ den Judge aus. Ein
// echter Widerspruch KONNTE im Editor nicht erscheinen. Genau diese Zeile dreht Teil A um.
it("F1 · gespeichert und eingestuft: Herkunft am Draht, Judge läuft, Widerspruch steht als Widerspruch", async () => {
  const entwurf = await gespeichertesBlatt("intern");
  // Genau die Felder, die die Route kennt — und KEIN erfundenes `koId`: dieses Blatt bearbeitet
  // einen Entwurf, kein Wissensobjekt. Es gibt keine KO-Kennung, also reist keine. Die
  // ENTWURFS-Kennung reist sehr wohl mit: sie ist der hebende Backstop (JOB 2692 D2), an dem der
  // Server die gespeicherte Stufe nachschlägt. Ohne sie gälte `source:"draft"` als vertraulich.
  expect(nutzlast()).toEqual({
    text: TEXT,
    source: "draft",
    confidentiality: "intern",
    draftId: entwurf,
  });
  expect(server.judgeConflict).toHaveBeenCalled();
  expect(drahtAntwort?.status).toBe("done");
  expect(drahtAntwort?.conflicts).toHaveLength(1);
  console.info(
    `LIVE-MESSUNG status=${drahtAntwort?.status} similarAnzahl=${drahtAntwort?.similar.length} konflikte=${drahtAntwort?.conflicts.length} judgeAufgerufen=${server.judgeConflict.mock.calls.length > 0}`,
  );
  // Kein „nicht geprüft" mehr — es WURDE geprüft, und das Ergebnis steht auf der Fläche.
  expect(hinweis()).toBeNull();
  expect(chip()?.getAttribute("data-lage")).toBe("conflict");
  await act(async () => {
    (chip()?.querySelector("button") as HTMLButtonElement).click();
  });
  expect(chip()?.textContent).toContain("Kaltstart Vorwärmung");
  expect(chip()?.querySelector("a")?.getAttribute("href")).toBe("/wissen/kc");
});

// F2 — VERTRAULICH BLEIBT VERTRAULICH: die Herkunft reist, aber sie ÖFFNET nichts.
it("F2 · vertraulicher Bestandstext: Stufe reist mit, KEIN Judge, ehrlich „nicht geprüft“", async () => {
  const entwurf = await gespeichertesBlatt("vertraulich");
  expect(nutzlast()).toEqual({
    text: TEXT,
    source: "draft",
    confidentiality: "vertraulich",
    draftId: entwurf,
  });
  expect(server.judgeConflict).not.toHaveBeenCalled();
  expect(drahtAntwort?.status).toBe("pending");
  expect(hinweis()?.textContent).toBe("Auf Widerspruch noch nicht geprüft.");
  // Die Ähnlichkeit bleibt sichtbar — sie ist deterministisch belegt, auch ohne Judge.
  await pruefeAehnlichenFundort();
});

// F3 — UNBEKANNTE EINSTUFUNG: der Editor SCHWEIGT über sie, statt eine zu erfinden.
it("F3 · Entwurf ohne Einstufung: kein `confidentiality` am Draht, Server bleibt fail-safe", async () => {
  await gespeichertesBlatt("ohne");
  expect(nutzlast()).toEqual({ text: TEXT });
  expect(server.judgeConflict).not.toHaveBeenCalled();
  expect(drahtAntwort?.status).toBe("pending");
  expect(hinweis()?.textContent).toBe("Auf Widerspruch noch nicht geprüft.");
});

// F3b — DIE GESPEICHERTE STUFE WIRD NICHT ABGESENKT (Auftrag §5.2, ausdrückliches Verbot).
// Ein Entwurf liegt als „vertraulich" im Bestand; im Menü wird „intern" gewählt, aber NICHT
// gesichert.
//
// WO DIE SPERRE SITZT — die Aussage dieses Prüfstands: NICHT im Browser. Der Client deklariert
// ehrlich, was der Mensch gewählt hat („intern"), und legt den ANKER daneben (`draftId`). Der
// SERVER schlägt daran die gespeicherte Stufe nach und hebt — `resolveDraftConfidential` in
// `knowledge-check-routes.ts`. Genau deshalb steht hier `confidentiality: "intern"` am Draht und
// trotzdem KEIN Judge-Aufruf: eine Client-Deklaration unter der gespeicherten Stufe gibt den Text
// nicht frei. Eine Sperre, die stattdessen den Browser das richtige Wort sagen liesse, wäre keine —
// sie fiele mit dem ersten manipulierten Client. Die tragende Zeile ist deshalb
// `judgeConflict not toHaveBeenCalled`, nicht das Wort in der Nutzlast.
it("F3b · Menüwahl unter der gespeicherten Stufe senkt den Egress NICHT", async () => {
  const entwurf = await gespeichertesBlatt("vertraulich");
  await stufeWaehlen("intern");
  expect(nutzlast()).toEqual({
    text: TEXT,
    source: "draft",
    confidentiality: "intern",
    draftId: entwurf,
  });
  expect(server.judgeConflict).not.toHaveBeenCalled();
  expect(hinweis()?.textContent).toBe("Auf Widerspruch noch nicht geprüft.");
});

// ==================================================================================================
// JOB 3556 R3 · K2 — DAS SICHERN IST DIE NEUE FRAGE (BEN-Korrekturpflicht 2).
// ==================================================================================================
// BENs Messung an Runde 2: „nach Laden eines vertraulichen Entwurfs, Menüwahl ‚intern' und
// erfolgreichem Sichern bleibt der bekannte Widerspruch ungeprüft." Genau dieser Weg, Schritt für
// Schritt, im gemounteten Editor gegen die echte Route: der Server hebt vor dem Sichern an der
// GESPEICHERTEN Stufe (kein Judge), danach nicht mehr (Judge, Widerspruch auf der Fläche). Kein
// Zeichen am Text wird dabei angefasst — die einzige Handlung zwischen beiden Befunden ist der
// Klick auf „Entwurf sichern".
it("K2 · nach dem Sichern von „intern“ erscheint der Widerspruch OHNE weitere Texteingabe", async () => {
  const entwurf = await gespeichertesBlatt("vertraulich");
  await stufeWaehlen("intern");
  // Zwischenstand, der BENs Befund wörtlich festhält: die Wahl allein gibt nichts frei.
  expect(server.judgeConflict).not.toHaveBeenCalled();
  expect(hinweis()?.textContent).toBe("Auf Widerspruch noch nicht geprüft.");
  const anfragenVorher = vi.mocked(fetch).mock.calls.length;

  await act(async () => {
    const knopf = container.querySelector('[data-testid="blatt-entwurf-sichern"]');
    if (!(knopf instanceof HTMLButtonElement)) {
      throw new Error("Der Knopf 'Entwurf sichern' ist nicht auf dem Blatt.");
    }
    knopf.click();
    await flush();
  });
  // Der gespeicherte Entwurf trägt jetzt wirklich „intern" — gelesen aus demselben Bestand, den der
  // Server befragt (nicht aus dem Zustand der Fläche).
  expect((await box.getDraft(entwurf))?.payload.confidentiality).toBe("intern");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 650));
  });

  expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(anfragenVorher);
  expect(nutzlast()).toEqual({
    text: TEXT,
    source: "draft",
    confidentiality: "intern",
    draftId: entwurf,
  });
  expect(server.judgeConflict).toHaveBeenCalled();
  expect(drahtAntwort?.status).toBe("done");
  expect(hinweis()).toBeNull();
  expect(chip()?.getAttribute("data-lage")).toBe("conflict");
});

// F4 — ZUSTIMMUNG KANN DER CLIENT NICHT BEHAUPTEN. Die dokumentbezogene Zustimmung läuft seit
// JOB 3556 R3 über den bestehenden Riegel (KA4/Klara-Bindung an den Kopfzeilen, `ask-routes.ts::
// ka4Freigabe`), den diese Route wie `reasoner-routes.ts:287-296` befragt; gemessen wird er in
// `anker-und-zustimmung.test.ts` (K3). Ein Feld in der NUTZLAST öffnet den Judge deshalb NICHT —
// sonst wäre die Zustimmung eine Selbstauskunft des Clients.
it("F4 · ohne Zustimmung kein Judge — auch wenn die Nutzlast eine behauptet", async () => {
  // JOB 3556 R3: MIT auflösbarem Anker gefragt (ein „intern" gespeicherter Entwurf). Sonst käme das
  // „kein Judge" seit der Ankersperre schon von der fehlenden Kennung, und dieser Fall misste die
  // erfundene Zustimmung gar nicht mehr.
  const entwurf = await box.seed({
    title: "Kaltstart",
    bodyHtml: `<p>${TEXT}</p>`,
    confidentiality: "intern",
  });
  const versuch = await server.app.inject({
    method: "POST",
    url: "/api/knowledge/check",
    payload: {
      text: TEXT,
      source: "draft",
      confidentiality: "vertraulich",
      nichtEingestuft: true,
      draftId: entwurf,
      dokumentZustimmung: true,
    },
  });
  expect(versuch.statusCode).toBe(200);
  expect(versuch.json().status).toBe("pending");
  expect(server.judgeConflict).not.toHaveBeenCalled();
});

it.each(["pending", "failed"])(
  "Serializer lässt den %s-Serverbefund vollständig stehen",
  async (status) => {
    box.antwort = { status, similar: [MATCH], conflicts: [MATCH] };
    expect(await endpoints.knowledge.check(TEXT)).toEqual(box.antwort);
  },
);

it.each(["pending", "failed"])(
  "Darstellungsvertrag: %s ohne Treffer behauptet weder neu noch ähnlich",
  async (status) => {
    box.antwort = { status, similar: [], conflicts: [] };
    await gespeichertesBlatt();
    expect(chip()).toBeNull();
    expect(hinweis()?.textContent).toBe(
      status === "pending"
        ? "Auf Widerspruch noch nicht geprüft."
        : "Prüfung derzeit nicht verfügbar.",
    );
  },
);

it("eine verspätete Antwort darf nach dem Leeren weder Treffer noch Prüfstatus zurückbringen", async () => {
  let antworten: (response: Response) => void = () => {
    throw new Error("Anfrage fehlt");
  };
  vi.mocked(fetch).mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        antworten = resolve;
      }),
  );
  await gespeichertesBlatt();
  const editor = container.querySelector('[role="textbox"]');
  expect(editor).toBeInstanceOf(HTMLElement);
  await act(async () => {
    if (editor) {
      editor.innerHTML = "";
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    }
    await flush();
  });
  await act(async () => {
    antworten(new Response(JSON.stringify({ status: "pending", similar: [MATCH], conflicts: [] })));
    await flush();
  });
  expect(chip()).toBeNull();
  expect(hinweis()).toBeNull();
});
