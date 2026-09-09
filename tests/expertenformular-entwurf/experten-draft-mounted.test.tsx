// @vitest-environment jsdom
// ================================================================================================
// JOB 3414 — WER SEINEN ENTWURF OFFEN HAT, FINDET IHN AUCH IM EXPERTEN-FORMULAR.
// ================================================================================================
//
// DER BEFUND (Codex, 09.09., gemessen an Live 1.203). Pedi hat einen gespeicherten Entwurf offen
// (`?draft=<id>`) und wechselt über „Datei ▾" → „Formular (Experten)". Das Formular stand LEER da:
// `Capture.tsx` las die Entwurfskennung der Adresse nicht (kein einziges `params.get("draft")`),
// also lief `loadDraft` auf diesem Weg nie und `draftId` blieb `null`.
//
// WAS DIESER TEST PRÜFT — UND WAS ER BEWUSST NICHT PRÜFT. Nicht „ein Feld ist nicht leer": das
// wäre schon durch die Rohtext-Übernahme von `switchMode` zu bestehen. Geprüft wird der
// GESPEICHERTE TEXT, Zeichen für Zeichen, im Feld, das ihn tragen muss.
//
// UND DER EIGENTLICHE PRÜFSTEIN IST FALL B, NICHT FALL A. Der Schaden war nie die leere Fläche,
// sondern das Speichern von dort: ohne `draftId` ist `isDraftUpdate` falsch, `saveDraft` ruft
// `drafts.create` statt `drafts.update` — Pedi hätte danach ZWEI Entwürfe. Ein Bau, der nur die
// Felder füllt und `draftId` nicht setzt, sieht richtig aus und erzeugt die Dublette weiter; Fall B
// schliesst genau diese Halbheit aus.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

// Der gespeicherte Entwurf, wie ihn der Server liefert. `origin: "frontdoor"` ist mit Absicht
// gewählt und nicht beiläufig: das ist der Herkunfts-Marker, der „Fortsetzen" per
// `resumeTargetForDraft` ans Blatt zurückschickt (Capture.tsx, `guardedNavigate`). Der
// ausdrückliche Moduswunsch des Menschen muss ihn auf DIESEM Weg schlagen — ohne den Marker selbst
// anzutasten (SCRUM-457 bleibt unberührt, s. Fall A2).
//
// `vi.hoisted`, weil `vi.mock` an den Dateianfang gezogen wird: eine gewöhnliche Konstante wäre
// beim Bauen des Mocks noch nicht initialisiert.
const { GESPEICHERT, draftsGet, draftsCreate, draftsUpdate, reasonerAssist } = vi.hoisted(() => {
  const gespeichert = {
    id: "d-3414",
    updatedAt: "2026-09-09T10:00:00.000Z",
    payload: {
      title: "Zahlungsziel",
      statement: "Bei Neukunden gilt Vorkasse, bis die erste Rechnung beglichen ist.",
      bodyHtml: "<p>Die Ausnahme genehmigt allein die Geschäftsführung.</p>",
      conditions: ["Neukunde ohne Bonitätsauskunft"],
      measures: ["Vorkasse im Angebot vermerken"],
      category: "Vertrieb",
      confidentiality: "intern",
      origin: "frontdoor",
    },
  };
  return {
    GESPEICHERT: gespeichert,
    draftsGet: vi.fn(async (_id: string) => gespeichert),
    draftsCreate: vi.fn(async () => ({ id: "neu-1" })),
    draftsUpdate: vi.fn(async () => ({ id: gespeichert.id })),
    reasonerAssist: vi.fn(async () => ({ text: "" })),
  };
});

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  const arrFn = () => vi.fn(async () => []);
  const base: Record<string, unknown> = {
    validation: { settings: ok({ defaultNeededValidations: 3 }) },
    external: { policy: vi.fn(async () => ({ stage: "off" })), search: vi.fn(async () => []) },
    uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
    directory: { list: arrFn() },
    gaps: { list: arrFn() },
    drafts: {
      list: arrFn(),
      get: draftsGet,
      create: draftsCreate,
      update: draftsUpdate,
      remove: vi.fn(async () => {}),
      promote: vi.fn(async () => ({ id: "ko-1", title: "egal" })),
    },
    reasoner: {
      status: ok({ active: true, mode: "cloud", reachable: "active" }),
      config: ok(null),
      structure: vi.fn(async () => ({})),
      interview: vi.fn(async () => ({ question: "", done: true, demo: false })),
      assist: reasonerAssist,
      describeImage: vi.fn(async () => ({ text: "", demo: false })),
    },
    notifications: { list: arrFn(), markSeen: vi.fn(async () => ({})) },
  };
  const endpoints = new Proxy(base, {
    get(target, prop) {
      if (prop in target) {
        return target[prop as string];
      }
      return new Proxy({}, { get: () => arrFn() });
    },
  });
  return { endpoints };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { Fragment, act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "../../apps/web/node_modules/react-router-dom";
import { ApiError } from "../../apps/web/src/api/client";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import type { CaptureMode } from "../../apps/web/src/lib/captureEntry";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let startUrl = "/erfassen";
/** Wohin die Fläche zwischenzeitlich navigiert ist — für „keine Rücknavigation ans Blatt". */
let letzteAdresse = "";
/**
 * Die Adresse WECHSELN, ohne neu zu montieren — genau der Fall aus bens Korrekturpflicht 1: die
 * Fläche bleibt stehen, nur die Kennung in der Adresse ist eine andere, und die noch laufende
 * Antwort auf die ALTE Kennung darf danach nichts mehr bewirken.
 */
let navigiere: (ziel: string) => void = () => {
  throw new Error("Pfadsonde nicht montiert");
};

function Pfadsonde(): null {
  const loc = useLocation();
  const nav = useNavigate();
  letzteAdresse = `${loc.pathname}${loc.search}`;
  navigiere = (ziel) => nav(ziel);
  return null;
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Derselbe Aufbau, den das Blatt benutzt: es öffnet den Arbeitsraum mit einem `modus`. */
function baum(modus: CaptureMode | undefined): ReturnType<typeof createElement> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(
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
            { initialEntries: [startUrl] },
            createElement(
              ImageDescribeProvider,
              null,
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  Fragment,
                  null,
                  createElement(Pfadsonde),
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: startUrl.split("?")[0] as string,
                      // JOB 3062 · H3: der Expertenmodus wird nicht mehr auf der Fläche
                      // umgeschaltet — er wird über das Menü „Datei ▾" des Blattes betreten, und
                      // das setzt genau diesen `modus`. Der Test öffnet den Arbeitsraum deshalb
                      // SO, wie das Blatt ihn öffnet (identisch zu dateizusage-mounted.test.tsx).
                      element: createElement(CaptureArbeitsraum, { modus }),
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

async function mount(url: string, modus: CaptureMode | undefined): Promise<void> {
  startUrl = url;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(baum(modus));
    await flush();
  });
  await act(flush);
}

/**
 * Den Modus wechseln, wie es das Blatt tut: NEUER Prop-Wert, KEINE Neumontage. Genau darum geht
 * es — der Arbeitsraum bleibt stehen und muss selbst merken, was jetzt gilt.
 */
async function wechsleModus(modus: CaptureMode | undefined): Promise<void> {
  await act(async () => {
    root.render(baum(modus));
    await flush();
  });
  await act(flush);
}

function text(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

/** Ein Feld des Experten-Formulars, an seiner sichtbaren Beschriftung gefunden (ui.tsx `Field`). */
function feld(label: string): HTMLInputElement | HTMLTextAreaElement {
  const l = [...container.querySelectorAll("label")].find(
    (x) => (x.querySelector("span")?.textContent ?? "").trim() === label,
  );
  const el = l?.querySelector("input, textarea");
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) {
    throw new Error(`Feld „${label}" nicht gefunden`);
  }
  return el;
}

function rohtextfeld(): HTMLTextAreaElement {
  const el = [...container.querySelectorAll("textarea")].find(
    (x) => x.placeholder === i18n.t("capture.rawPlaceholder"),
  );
  if (!(el instanceof HTMLTextAreaElement)) {
    throw new Error("Rohtext-Feld nicht gefunden");
  }
  return el;
}

function knopf(teil: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(teil),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${teil}" nicht gefunden`);
  }
  return btn;
}

/** Tippen wie ein Mensch: React hört auf das native `input`-Ereignis, nicht auf `.value =`. */
async function tippe(el: HTMLTextAreaElement, wert: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  if (!setter) {
    throw new Error("kein value-Setter");
  }
  await act(async () => {
    setter.call(el, wert);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

type Entwurf = typeof GESPEICHERT;

/** Ein ZWEITER gespeicherter Entwurf — gleiche Gestalt, anderer Inhalt, andere Kennung. */
const ZWEITER: Entwurf = {
  ...GESPEICHERT,
  id: "d-zweiter",
  updatedAt: "2026-09-09T11:00:00.000Z",
  payload: {
    ...GESPEICHERT.payload,
    title: "Lieferzeit",
    statement: "Zusagen unter vier Wochen gehen nur mit Bestätigung der Fertigung.",
  },
};

/** Ein vorhandener, aber INHALTLICH LEERER Entwurf (Auftrag §9, Zustand „erfolgreich leer"). */
const LEERER: Entwurf = {
  ...GESPEICHERT,
  id: "d-leer",
  updatedAt: "2026-09-09T12:00:00.000Z",
  payload: {
    ...GESPEICHERT.payload,
    title: "",
    statement: "",
    bodyHtml: "",
    conditions: [],
    measures: [],
    category: "",
  },
};

/**
 * `drafts.get` von Hand auflösen. Ohne das lässt sich nicht prüfen, WELCHE Antwort wann eintrifft —
 * und genau daran hing bens Befund: die Antwort auf die alte Kennung kam nach dem Adresswechsel an
 * und zeigte (und speicherte) den falschen Entwurf.
 */
function antwortenVonHand(): {
  erfuelle: (id: string, d: Entwurf) => Promise<void>;
  scheitere: (id: string, e: unknown) => Promise<void>;
} {
  const offen = new Map<string, { res: (d: Entwurf) => void; rej: (e: unknown) => void }>();
  draftsGet.mockImplementation(
    (id: string) =>
      new Promise<Entwurf>((res, rej) => {
        offen.set(id, { res, rej });
      }),
  );
  const nimm = (id: string): { res: (d: Entwurf) => void; rej: (e: unknown) => void } => {
    const p = offen.get(id);
    if (!p) {
      throw new Error(`keine offene Anfrage für „${id}"`);
    }
    offen.delete(id);
    return p;
  };
  return {
    erfuelle: async (id, d) => {
      await act(async () => {
        nimm(id).res(d);
        await flush();
      });
    },
    scheitere: async (id, e) => {
      await act(async () => {
        nimm(id).rej(e);
        await flush();
      });
    },
  };
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
  letzteAdresse = "";
  draftsGet.mockImplementation(async () => GESPEICHERT);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("JOB 3414 · der gespeicherte Entwurf im Experten-Formular", () => {
  it("A · der Wechsel ins Experten-Formular trägt den GESPEICHERTEN Text — nicht irgendeinen", async () => {
    await mount(`/erfassen?draft=${GESPEICHERT.id}`, "formular");

    // Der Ladeweg hat den Entwurf geholt, und zwar genau diesen.
    expect(draftsGet).toHaveBeenCalledWith(GESPEICHERT.id);
    // Zeichen für Zeichen: „nicht leer" hätte schon die Rohtext-Übernahme von `switchMode` erfüllt.
    expect(feld(i18n.t("capture.fTitle")).value).toBe(GESPEICHERT.payload.title);
    expect(feld(i18n.t("capture.fStatement")).value).toBe(GESPEICHERT.payload.statement);
    // Die erweiterten Felder kommen über DENSELBEN Füllweg (`loadDraft`) mit.
    expect(feld(i18n.t("capture.fCategory")).value).toBe(GESPEICHERT.payload.category);
  });

  it("A2 · der ausdrückliche Moduswunsch schlägt den Herkunfts-Marker — ohne Rücknavigation", async () => {
    // `origin: "frontdoor"` schickt „Fortsetzen" ans Blatt zurück (guardedNavigate). Genau das darf
    // hier NICHT passieren: der Mensch hat die Ansicht ausdrücklich gewählt. Der Marker im Entwurf
    // bleibt dabei unverändert — dieser Weg liest ihn nur nicht.
    await mount(`/erfassen?draft=${GESPEICHERT.id}`, "formular");

    expect(letzteAdresse).toBe(`/erfassen?draft=${GESPEICHERT.id}`);
    expect(text()).not.toContain(i18n.t("fd.title"));
    expect(feld(i18n.t("capture.fTitle")).value).toBe(GESPEICHERT.payload.title);
  });

  it("A3 · je Kennung genau EIN Ladeweg — Sprachwechsel, Rendern, Formular→Freitext→Formular", async () => {
    await mount(`/erfassen?draft=${GESPEICHERT.id}`, "formular");
    expect(draftsGet).toHaveBeenCalledTimes(1);

    // erneutes Rendern mit demselben Prop
    await wechsleModus("formular");
    // Sprachwechsel (erzeugt `t` neu und rendert die ganze Seite)
    await act(async () => {
      await i18n.changeLanguage("en");
      await flush();
    });
    await wechsleModus("formular");
    // und der Rundweg über den Erzähl-Einstieg zurück ins Formular
    await wechsleModus("freitext");
    await wechsleModus("formular");

    expect(draftsGet).toHaveBeenCalledTimes(1);
    expect(feld(i18n.t("capture.fTitle")).value).toBe(GESPEICHERT.payload.title);
  });

  it("B · DER PRÜFSTEIN: Speichern trifft denselben Entwurf, es entsteht keine Dublette", async () => {
    await mount(`/erfassen?draft=${GESPEICHERT.id}`, "formular");
    expect(feld(i18n.t("capture.fTitle")).value).toBe(GESPEICHERT.payload.title);

    await act(async () => {
      knopf(i18n.t("capture.saveDraft")).click();
      await flush();
    });

    // Die Kennung reist mit — und der gesehene Stand als Konfliktschutz gleich daneben.
    expect(draftsUpdate).toHaveBeenCalledTimes(1);
    const [id, payload, opts] = draftsUpdate.mock.calls[0] as unknown as [
      string,
      { title: string },
      { expectedUpdatedAt?: string } | undefined,
    ];
    expect(id).toBe(GESPEICHERT.id);
    expect(payload.title).toBe(GESPEICHERT.payload.title);
    expect(opts?.expectedUpdatedAt).toBe(GESPEICHERT.updatedAt);
    // KEIN zweiter Entwurf.
    expect(draftsCreate).not.toHaveBeenCalled();
    // Und die Rückmeldung sagt, was wirklich geschah.
    expect(text()).toContain(i18n.t("capture.draftUpdated"));
    expect(text()).not.toContain(i18n.t("capture.draftSaved"));
  });

  it("C · GEGENPROBE: getippter Text wird nicht überschrieben — mit und ohne Adress-Kennung", async () => {
    const EIGENER = "Mein eigener, noch ungespeicherter Gedanke.";

    // C1 · ohne `?draft=`: es gibt nichts zu holen, und es wird nichts geholt.
    await mount("/erfassen", undefined);
    await tippe(rohtextfeld(), EIGENER);
    await wechsleModus("formular");
    expect(draftsGet).not.toHaveBeenCalled();
    expect(feld(i18n.t("capture.fStatement")).value).toBe(EIGENER);

    act(() => root.unmount());
    container.remove();

    // C2 · MIT `?draft=`, aber die Fläche trägt schon Inhalt. DAS ist der Fall, den die
    // Schutzbedingung deckt: der ungespeicherte Gedanke wiegt schwerer als der gespeicherte
    // Entwurf. Ohne die Bedingung würde hier geladen und „Zahlungsziel" stünde im Feld.
    await mount(`/erfassen?draft=${GESPEICHERT.id}`, undefined);
    await tippe(rohtextfeld(), EIGENER);
    await wechsleModus("formular");

    expect(draftsGet).not.toHaveBeenCalled();
    expect(feld(i18n.t("capture.fStatement")).value).toBe(EIGENER);
    expect(feld(i18n.t("capture.fTitle")).value).not.toBe(GESPEICHERT.payload.title);
  });

  it("E · die Herkunft reist mit: die KI-Palette des Formulars trägt den Entwurfs-Anker", async () => {
    // Auftrag §5.6. `draftId` ist für die KI kein Freigabe-, sondern ein HEBENDER Anker
    // (reasonerProvenance.ts): ohne ihn behandelt der Server `source:"draft"` als vertraulich, und
    // die Palette scheitert an der Sperre — auch für einen ausdrücklich als „intern" eingestuften,
    // gespeicherten Entwurf. Vorher konnte der Anker hier nicht mitreisen, weil `draftId` null war.
    await mount(`/erfassen?draft=${GESPEICHERT.id}`, "formular");
    expect(feld(i18n.t("capture.fTitle")).value).toBe(GESPEICHERT.payload.title);

    await act(async () => {
      knopf(i18n.t("capture.ai.action.clarify")).click();
      await flush();
    });

    expect(reasonerAssist).toHaveBeenCalled();
    const [, , , provenance] = reasonerAssist.mock.calls[0] as unknown as [
      string,
      string,
      string | undefined,
      { source: string; confidentiality: string; draftId?: string },
    ];
    expect(provenance).toEqual({
      source: "draft",
      confidentiality: "intern",
      draftId: GESPEICHERT.id,
    });
  });

  it("D · FEHLERWEG: 404 sagt einen Satz, hält das Formular bedienbar und schreibt in KEINEN fremden Entwurf", async () => {
    draftsGet.mockImplementation(async () => {
      throw new ApiError(404, "NOT_FOUND", "Entwurf nicht gefunden.");
    });

    await mount(`/erfassen?draft=${GESPEICHERT.id}`, "formular");

    // Ein Satz, keine leere Fläche, die so tut, als sei nichts gewesen.
    expect(text()).toContain("Entwurf nicht gefunden.");
    // Das Formular bleibt bedienbar.
    const titel = feld(i18n.t("capture.fTitle"));
    expect(titel.disabled).toBe(false);
    await tippe(feld(i18n.t("capture.fStatement")) as HTMLTextAreaElement, "Ein neuer Gedanke.");

    await act(async () => {
      knopf(i18n.t("capture.saveDraft")).click();
      await flush();
    });

    // `draftId` blieb leer ⇒ ein NEUER Entwurf, nicht ein Schreiben in den verschwundenen.
    expect(draftsCreate).toHaveBeenCalledTimes(1);
    expect(draftsUpdate).not.toHaveBeenCalled();
  });

  // ============================================================================================
  // RUNDE 2 — bens Korrekturpflicht 1: EINE ANTWORT GILT NUR, SOLANGE IHRE FRAGE NOCH GILT.
  // ============================================================================================
  // Runde 1 startete den Abruf richtig, prüfte beim EINTREFFEN aber nur noch, ob die Fläche
  // inzwischen schmutzig ist. Wer die Adresse wechselte, bekam die zuerst eintreffende — also
  // womöglich die ALTE — Antwort zu sehen UND zu speichern; die richtige lief danach in die
  // Schutzbedingung und verpuffte. Der sichtbare Titel und die gespeicherte Kennung gehörten
  // dann zu einem Entwurf, den die Adresse gar nicht mehr nannte.

  it("F · Adresswechsel während des Ladens: die ALTE Antwort trifft zuerst ein und bleibt wirkungslos", async () => {
    const antwort = antwortenVonHand();
    await mount(`/erfassen?draft=${GESPEICHERT.id}`, "formular");
    expect(draftsGet).toHaveBeenCalledWith(GESPEICHERT.id);

    // Der Mensch ist weitergezogen, bevor die erste Antwort da war.
    await act(async () => {
      navigiere(`/erfassen?draft=${ZWEITER.id}`);
      await flush();
    });
    expect(draftsGet).toHaveBeenCalledWith(ZWEITER.id);

    // Jetzt kommt die ÜBERHOLTE Antwort. Sie darf nichts anfassen: keinen Inhalt, keine Kennung —
    // und auch nicht den Ladezustand, den die noch laufende zweite Anfrage führt.
    await antwort.erfuelle(GESPEICHERT.id, GESPEICHERT);
    expect(feld(i18n.t("capture.fTitle")).value).toBe("");
    expect(knopf(i18n.t("capture.saveDraft")).disabled).toBe(true);

    // Und dann die gültige.
    await antwort.erfuelle(ZWEITER.id, ZWEITER);
    expect(feld(i18n.t("capture.fTitle")).value).toBe(ZWEITER.payload.title);

    await act(async () => {
      knopf(i18n.t("capture.saveDraft")).click();
      await flush();
    });
    expect(draftsCreate).not.toHaveBeenCalled();
    expect(draftsUpdate).toHaveBeenCalledTimes(1);
    const [id, , opts] = draftsUpdate.mock.calls[0] as unknown as [
      string,
      unknown,
      { expectedUpdatedAt?: string } | undefined,
    ];
    // Gespeichert wird, was die Adresse nennt — samt DESSEN gesehenem Stand.
    expect(id).toBe(ZWEITER.id);
    expect(opts?.expectedUpdatedAt).toBe(ZWEITER.updatedAt);
  });

  it("F2 · dieselbe Lage in der anderen Reihenfolge: die NEUE Antwort zuerst, die alte danach", async () => {
    const antwort = antwortenVonHand();
    await mount(`/erfassen?draft=${GESPEICHERT.id}`, "formular");
    await act(async () => {
      navigiere(`/erfassen?draft=${ZWEITER.id}`);
      await flush();
    });

    await antwort.erfuelle(ZWEITER.id, ZWEITER);
    expect(feld(i18n.t("capture.fTitle")).value).toBe(ZWEITER.payload.title);
    // Die verspätete alte Antwort darf den bereits gezeigten Entwurf nicht verdrängen.
    await antwort.erfuelle(GESPEICHERT.id, GESPEICHERT);
    expect(feld(i18n.t("capture.fTitle")).value).toBe(ZWEITER.payload.title);

    await act(async () => {
      knopf(i18n.t("capture.saveDraft")).click();
      await flush();
    });
    expect(draftsUpdate).toHaveBeenCalledTimes(1);
    expect((draftsUpdate.mock.calls[0] as unknown as [string])[0]).toBe(ZWEITER.id);
  });

  it("G · Moduswechsel während des Ladens: der zuletzt geäußerte Wunsch gilt, nicht die Antwort", async () => {
    const antwort = antwortenVonHand();
    await mount(`/erfassen?draft=${GESPEICHERT.id}`, "formular");

    // Der Mensch wechselt zurück zum Erzähl-Feld, während der Abruf noch läuft.
    await wechsleModus("freitext");
    await antwort.erfuelle(GESPEICHERT.id, GESPEICHERT);

    // Die Fläche steht dort, wo er sie zuletzt hingestellt hat — mit leerem Feld, nicht im
    // Formular mit fremdem Inhalt.
    expect(rohtextfeld().value).toBe("");

    // Und die Kennung wurde NICHT übernommen: was er jetzt schreibt, ist ein neuer Entwurf.
    await tippe(rohtextfeld(), "Etwas ganz anderes.");
    await act(async () => {
      knopf(i18n.t("capture.saveDraft")).click();
      await flush();
    });
    expect(draftsCreate).toHaveBeenCalledTimes(1);
    expect(draftsUpdate).not.toHaveBeenCalled();
  });

  it("I · der Fehler einer überholten Anfrage bleibt stumm — gemeldet wird nur die gültige Lage", async () => {
    const antwort = antwortenVonHand();
    await mount(`/erfassen?draft=${GESPEICHERT.id}`, "formular");
    await act(async () => {
      navigiere(`/erfassen?draft=${ZWEITER.id}`);
      await flush();
    });

    // Der erste Entwurf ist inzwischen weg — aber danach fragt niemand mehr.
    await antwort.scheitere(
      GESPEICHERT.id,
      new ApiError(404, "NOT_FOUND", "Entwurf nicht gefunden."),
    );
    expect(text()).not.toContain("Entwurf nicht gefunden.");

    await antwort.erfuelle(ZWEITER.id, ZWEITER);
    expect(feld(i18n.t("capture.fTitle")).value).toBe(ZWEITER.payload.title);
    expect(text()).not.toContain("Entwurf nicht gefunden.");
  });

  // ============================================================================================
  // RUNDE 2 — bens Korrekturpflicht 2: „ERFOLGREICH LEER" IST EIN ERFOLG, KEINE SACKGASSE.
  // ============================================================================================
  // Auftrag §9: „Entwurf existiert, Felder sind leer ⇒ Felder leer, aber `draftId` gesetzt und
  // ‚Speichern' AKTUALISIERT". Runde 1 lud den leeren Entwurf zwar, aber der Knopf blieb an der
  // Angebotsfrage „ist überhaupt etwas getippt?" hängen — der Mensch konnte den geladenen Entwurf
  // nicht mehr speichern, obwohl die Fläche ihn führte.

  it("H · ein vorhandener, leerer Entwurf ist speicherbar — und wird AKTUALISIERT, nicht verdoppelt", async () => {
    draftsGet.mockImplementation(async () => LEERER);
    await mount(`/erfassen?draft=${LEERER.id}`, "formular");

    // Die Fläche behauptet nichts über Inhalt: die Felder sind leer, weil der Entwurf leer ist.
    expect(draftsGet).toHaveBeenCalledWith(LEERER.id);
    expect(feld(i18n.t("capture.fTitle")).value).toBe("");
    expect(feld(i18n.t("capture.fStatement")).value).toBe("");
    // Aber er GEHÖRT dieser Fläche — also ist er speicherbar.
    expect(knopf(i18n.t("capture.saveDraft")).disabled).toBe(false);

    await act(async () => {
      knopf(i18n.t("capture.saveDraft")).click();
      await flush();
    });
    expect(draftsCreate).not.toHaveBeenCalled();
    expect(draftsUpdate).toHaveBeenCalledTimes(1);
    expect((draftsUpdate.mock.calls[0] as unknown as [string])[0]).toBe(LEERER.id);
    expect(text()).toContain(i18n.t("capture.draftUpdated"));
  });
});
