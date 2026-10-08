// @vitest-environment jsdom
// ================================================================================================
// MOBILE ERFASSUNG (aufnahme:20260922:gesamt-mobile-erfassung) — AN DER ECHTEN HANDYFLÄCHE.
// ================================================================================================
//
// R-0092 / FR-MOB-02: Notiz UND Interview stehen bereit; „Als Entwurf speichern" ist die
// auffälligste Aktion. FR-CAP-04: Foto aus Kamera ODER Mediathek, Vorschaubild entfernbar.
//
// Gefahren wird wie in tests/entwurf-mobil-desktop/: Handyfläche mounten → erfassen → speichern →
// der ECHTE CaptureService (InMemoryDraftRepo, echte `sanitizeDraftPayload`-Grenze) wird gelesen.
// Für das Foto zusätzlich die Desktop-Fläche geöffnet: der Entwurf steht dort mit dem Bild im Editor.
//
// Einzige Attrappe am Weg: `fileToThumbDataUrl`. jsdom hat kein Canvas; verkleinert wird im echten
// Browser. Geprüft wird hier, was DANACH mit dem Bild geschieht.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  alle: async (): Promise<Record<string, unknown>[]> => [],
  seed: async (_payload: Record<string, unknown>): Promise<string> => "",
}));

/**
 * BEN (Nacharbeit 2): die Bildumwandlung lässt sich VERZÖGERN. Dann hängt sie, bis der Fall sie
 * selbst auflöst — genau die Reihenfolge „Foto gewählt → gespeichert/gewechselt → Umwandlung fertig".
 */
const thumb = vi.hoisted(() => ({
  verzoegert: false,
  aufloesen: null as null | ((dataUrl: string) => void),
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/lib/files", async (original) => ({
  ...(await original<typeof import("../../apps/web/src/lib/files")>()),
  fileToThumbDataUrl: vi.fn(
    (): Promise<string> =>
      thumb.verzoegert
        ? new Promise<string>((r) => {
            thumb.aufloesen = r;
          })
        : Promise.resolve("data:image/jpeg;base64,QUJD"),
  ),
}));

vi.mock("../../apps/web/src/api/endpoints", async () => {
  const { InMemoryDraftRepo } = await import("../../services/capture/src/repo");
  const { CaptureService } = await import("../../services/capture/src/service");
  type P = Record<string, unknown>;
  let svc = new CaptureService({ repo: new InMemoryDraftRepo() });
  box.reset = () => {
    svc = new CaptureService({ repo: new InMemoryDraftRepo() });
  };
  box.alle = async () => (await svc.listDrafts()).map((d) => d.payload as unknown as P);
  box.seed = async (payload: P) => (await svc.createDraft(payload, "u1")).id;
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ stage: "search_on_click" }), search: ok([]) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      ko: { list: ok([]) },
      conflicts: { list: ok([]) },
      library: { search: ok([]) },
      ask: { ask: ok({ answered: false }) },
      drafts: {
        list: vi.fn(async () => svc.listDrafts()),
        get: vi.fn(async (id: string) => (await svc.resumeDraft(id))?.draft),
        create: vi.fn(async (p: P) => svc.createDraft(p, "u1")),
        update: vi.fn(async (id: string, p: P) => svc.continueDraft(id, p, "u1")),
        remove: vi.fn(async (id: string) => svc.deleteDraft(id)),
        promote: vi.fn(async () => ({})),
      },
      reasoner: {
        status: ok({ active: true, mode: "cloud", reachable: "active" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
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
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";
import { Mobile } from "../../apps/web/src/pages/Mobile";

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

async function mount(seite: "mobile" | "desktop"): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const pfad = seite === "mobile" ? "/mobile" : "/erfassen";
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
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: [{ pathname: pfad, state: { from: "/start" } }] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, { path: "/mobile", element: createElement(Mobile) }),
                    createElement(Route, {
                      path: "/erfassen",
                      element: createElement(CaptureArbeitsraum),
                    }),
                    createElement(Route, {
                      path: "/start",
                      element: createElement("div", null, "START-SEITE"),
                    }),
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

function abbauen(): void {
  act(() => root.unmount());
  container.remove();
}

function el<T extends Element>(selektor: string): T {
  const treffer = container.querySelector(selektor);
  if (!treffer) {
    throw new Error(`„${selektor}“ nicht gefunden`);
  }
  return treffer as T;
}

function knopf(teil: string, bereich: ParentNode = container): HTMLButtonElement {
  const btn = [...bereich.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(teil),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${teil}“ nicht gefunden`);
  }
  return btn;
}

function maybeKnopf(teil: string): HTMLButtonElement | null {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(teil),
  );
  return btn instanceof HTMLButtonElement ? btn : null;
}

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

async function tippe(feld: HTMLTextAreaElement, wert: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(feld, wert);
  await act(async () => {
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

/** Eine Datei in ein (verstecktes) Dateifeld legen — so, wie Kamera oder Mediathek es tun. */
async function waehleDatei(feld: HTMLInputElement, name: string): Promise<void> {
  const datei = new File(["x"], name, { type: "image/jpeg" });
  Object.defineProperty(feld, "files", { value: [datei], configurable: true });
  await act(async () => {
    feld.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

/** Die gefüllten Knöpfe der Erfassung — Klassenmarke `bg-ink` als ganzes Wort, nicht `bg-ink/70`. */
function gefuellteKnoepfe(): HTMLButtonElement[] {
  return [...el<HTMLElement>('[data-testid="mob-erfassung"]').querySelectorAll("button")].filter(
    (b) => b.className.split(/\s+/).includes("bg-ink"),
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.reset();
  thumb.verzoegert = false;
  thumb.aufloesen = null;
});

/** Ein echtes, abbrechbares `beforeunload` am Fenster — wie in tests/app/mobile-unload-guard-mounted. */
function beforeUnloadBlocked(): boolean {
  const e = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(e);
  return e.defaultPrevented;
}

/** Die hängende Umwandlung jetzt fertigstellen — mit einem eigenen, erkennbaren Bild. */
async function umwandlungFertig(dataUrl: string): Promise<void> {
  const aufloesen = thumb.aufloesen;
  if (!aufloesen) {
    throw new Error("keine laufende Bildumwandlung");
  }
  await act(async () => {
    aufloesen(dataUrl);
    await flush();
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("R-0092 / FR-MOB-02 · Notiz und Interview, Entwurf als Hauptaktion", () => {
  it("beide Erfassungsarten stehen bereit; „Als Entwurf speichern“ ist die einzige gefüllte Aktion", async () => {
    await mount("mobile");
    const modus = el<HTMLElement>('[data-testid="mob-modus"]');
    expect(knopf(i18n.t("mob.note"), modus).getAttribute("aria-pressed")).toBe("true");
    expect(knopf(i18n.t("mob.interview"), modus).getAttribute("aria-pressed")).toBe("false");

    const gefuellt = gefuellteKnoepfe();
    expect(gefuellt).toHaveLength(1);
    expect(gefuellt[0]?.textContent).toContain("Als Entwurf speichern");

    // Dieselbe Aussage im Interview — der Wechsel macht keine zweite Hauptaktion auf.
    await click(knopf(i18n.t("mob.interview"), modus));
    expect(el('[data-testid="mob-interview"]')).toBeTruthy();
    const imInterview = gefuellteKnoepfe();
    expect(imInterview).toHaveLength(1);
    expect(imInterview[0]?.getAttribute("data-testid")).toBe("mob-primaer");
    abbauen();
  });

  it("Interview: vier Fragen nacheinander → ein Entwurf mit Kernaussage, Bedingung, Maßnahme, Stichworten", async () => {
    await mount("mobile");
    await click(knopf(i18n.t("mob.interview"), el('[data-testid="mob-modus"]')));
    const antwort = (): HTMLTextAreaElement =>
      el<HTMLTextAreaElement>('[data-testid="mob-interview-antwort"]');

    expect(el<HTMLElement>('[data-testid="mob-interview"]').textContent).toContain(
      i18n.t("mob.iv.frage1"),
    );
    await tippe(antwort(), "Ventil V3 klemmt bei Frost");
    await click(knopf(i18n.t("mob.iv.weiter")));
    expect(el<HTMLElement>('[data-testid="mob-interview"]').textContent).toContain(
      i18n.t("mob.iv.frage2"),
    );
    await tippe(antwort(), "unter 0 °C");
    await click(knopf(i18n.t("mob.iv.weiter")));
    await tippe(antwort(), "Begleitheizung vorher an");
    await click(knopf(i18n.t("mob.iv.weiter")));
    await tippe(antwort(), "Ventil, Frost");

    // Zurückblättern zeigt die gegebene Antwort wieder — nichts geht beim Blättern verloren.
    await click(knopf(i18n.t("mob.iv.zurueck")));
    expect(antwort().value).toBe("Begleitheizung vorher an");

    // Die Erfassungsart ist jetzt gesperrt: Getipptes verschwände sonst in einem unsichtbaren Feld.
    expect(knopf(i18n.t("mob.note"), el('[data-testid="mob-modus"]')).disabled).toBe(true);

    await click(el<HTMLButtonElement>('[data-testid="mob-primaer"]'));
    abbauen();

    const entwuerfe = await box.alle();
    expect(entwuerfe).toHaveLength(1);
    expect(entwuerfe[0]).toMatchObject({
      statement: "Ventil V3 klemmt bei Frost",
      conditions: ["unter 0 °C"],
      measures: ["Begleitheizung vorher an"],
      tags: ["Ventil", "Frost"],
    });
  });

  it("ein abgebrochenes Interview lässt sich nach der ersten Frage schon speichern", async () => {
    await mount("mobile");
    await click(knopf(i18n.t("mob.interview"), el('[data-testid="mob-modus"]')));
    await tippe(
      el<HTMLTextAreaElement>('[data-testid="mob-interview-antwort"]'),
      "Lager L2 läuft heiß",
    );
    await click(el<HTMLButtonElement>('[data-testid="mob-primaer"]'));
    abbauen();

    const entwuerfe = await box.alle();
    expect(entwuerfe).toHaveLength(1);
    expect(entwuerfe[0]?.statement).toBe("Lager L2 läuft heiß");
  });
});

describe("FR-CAP-04 · Foto aus Kamera oder Mediathek, entfernbar", () => {
  it("beide Quellen sind wählbar: Kamera öffnet die Rückkamera, Mediathek die Bildauswahl", async () => {
    await mount("mobile");
    const kamera = el<HTMLInputElement>('[data-testid="mob-foto-kamera"]');
    const mediathek = el<HTMLInputElement>('[data-testid="mob-foto-mediathek"]');
    expect(kamera.getAttribute("accept")).toBe("image/*");
    expect(kamera.getAttribute("capture")).toBe("environment");
    expect(mediathek.getAttribute("accept")).toBe("image/*");
    expect(mediathek.hasAttribute("capture")).toBe(false);
    // Bedient werden sie über benannte Knöpfe.
    const fotos = el<HTMLElement>('[data-testid="mob-fotos"]');
    expect(knopf(i18n.t("mob.foto.kamera"), fotos)).toBeTruthy();
    expect(knopf(i18n.t("mob.foto.mediathek"), fotos)).toBeTruthy();
    abbauen();
  });

  it("Vorschaubild erscheint, ist entfernbar — und das Entfernte kommt nicht in den Entwurf", async () => {
    await mount("mobile");
    await waehleDatei(el('[data-testid="mob-foto-mediathek"]'), "falsch.jpg");
    await waehleDatei(el('[data-testid="mob-foto-kamera"]'), "Pumpe.jpg");
    const fotos = (): HTMLElement => el<HTMLElement>('[data-testid="mob-fotos"]');
    expect(fotos().querySelectorAll("img")).toHaveLength(2);

    const entfernen = fotos().querySelector(
      `button[aria-label="${i18n.t("mob.foto.entfernen")}: falsch.jpg"]`,
    );
    expect(entfernen).toBeInstanceOf(HTMLButtonElement);
    await click(entfernen as HTMLButtonElement);
    const uebrig = [...fotos().querySelectorAll("img")].map((i) => i.getAttribute("alt"));
    expect(uebrig).toEqual(["Pumpe.jpg"]);

    await tippe(el<HTMLTextAreaElement>('[data-testid="mob-statement"]'), "Pumpe leckt");
    await click(el<HTMLButtonElement>('[data-testid="mob-primaer"]'));
    abbauen();

    const entwuerfe = await box.alle();
    expect(entwuerfe).toHaveLength(1);
    const gespeichert = entwuerfe[0] ?? {};
    expect(gespeichert.statement).toBe("Pumpe leckt");
    const body = String(gespeichert.bodyHtml);
    expect(body).toContain('src="data:image/jpeg;base64,QUJD"');
    expect(body).toContain('alt="Pumpe.jpg"');
    expect(body).not.toContain("falsch.jpg");
    expect((body.match(/<img/g) ?? []).length).toBe(1);

    // Nutzenkette bis zur Oberfläche: die Vollversion öffnet den Entwurf, das Foto steht im Editor.
    await mount("desktop");
    const aufklapper = maybeKnopf("Entwürfe anzeigen");
    if (aufklapper) {
      await click(aufklapper);
    }
    await click(knopf(i18n.t("capture.resume")));
    const editor = el<HTMLElement>(`[role="textbox"][aria-label="${i18n.t("editor.bodyLabel")}"]`);
    expect(editor.innerHTML).toContain("data:image/jpeg;base64,QUJD");
    expect(editor.textContent).toContain("Pumpe leckt");
    abbauen();
  });
});

// ================================================================================================
// BEN, Nacharbeit 2 — DIE UMWANDLUNG LÄUFT NOCH, WÄHREND GESPEICHERT ODER GEWECHSELT WIRD.
// ================================================================================================
//
// Befund (Mobile.tsx:427/434 am Kandidaten 877d2071): die Umwandlung ergänzte nach dem Warten den
// DANN aktuellen Formularzustand; der Speicherweg wartete nicht auf sie. Jeder Fall hier lässt die
// Umwandlung hängen und löst sie erst NACH der kritischen Handlung auf.
describe("FR-CAP-04 · laufende Fotoumwandlung und Speicherweg", () => {
  const BILD_P4 = "data:image/jpeg;base64,UDQ=";

  it("Knopf: gesperrt, solange das Foto umgewandelt wird — danach geht das Foto mit", async () => {
    thumb.verzoegert = true;
    await mount("mobile");
    await tippe(el<HTMLTextAreaElement>('[data-testid="mob-statement"]'), "Leck an P4");
    await waehleDatei(el('[data-testid="mob-foto-kamera"]'), "P4.jpg");

    // Die Umwandlung hängt: gesperrt, mit Begründung, und noch nichts gespeichert.
    expect(el('[data-testid="mob-foto-in-arbeit"]')).toBeTruthy();
    expect(el<HTMLButtonElement>('[data-testid="mob-primaer"]').disabled).toBe(true);
    await click(el<HTMLButtonElement>('[data-testid="mob-primaer"]'));
    expect(await box.alle()).toHaveLength(0);

    await umwandlungFertig(BILD_P4);
    expect(container.querySelector('[data-testid="mob-foto-in-arbeit"]')).toBeNull();
    await click(el<HTMLButtonElement>('[data-testid="mob-primaer"]'));

    const entwuerfe = await box.alle();
    expect(entwuerfe).toHaveLength(1);
    expect(entwuerfe[0]?.statement).toBe("Leck an P4");
    expect(String(entwuerfe[0]?.bodyHtml)).toContain(BILD_P4);
    // Das Formular ist danach leer — kein Foto bleibt für den nächsten Entwurf liegen.
    expect(el('[data-testid="mob-fotos"]').querySelectorAll("img")).toHaveLength(0);
    abbauen();
  });

  it("Dialogspeichern: der Weggeh-Wächter wartet die Umwandlung ab und speichert das Foto mit", async () => {
    thumb.verzoegert = true;
    await mount("mobile");
    await tippe(el<HTMLTextAreaElement>('[data-testid="mob-statement"]'), "Leck an P4");
    await waehleDatei(el('[data-testid="mob-foto-mediathek"]'), "P4.jpg");

    await click(knopf(i18n.t("topbar.toDesktop")));
    await click(knopf(i18n.t("nav.guard.save")));
    // Solange die Umwandlung hängt: nichts geschrieben, nicht gewechselt.
    expect(await box.alle()).toHaveLength(0);
    expect(container.textContent).not.toContain("START-SEITE");

    await umwandlungFertig(BILD_P4);
    await act(flush);

    const entwuerfe = await box.alle();
    expect(entwuerfe).toHaveLength(1);
    expect(entwuerfe[0]?.statement).toBe("Leck an P4");
    expect(String(entwuerfe[0]?.bodyHtml)).toContain(BILD_P4);
    expect(container.textContent).toContain("START-SEITE");
    abbauen();
  });

  // BEN, Nacharbeit 3: der Fall OHNE Texteingabe. Vorher trug das Formular das Foto erst nach der
  // Umwandlung — `isDirty` blieb false, der Dialog kam nicht, und Neuladen warnte nicht.
  it("alleinige Fotoauswahl: Neuladen warnt, der Dialog kommt, und sein Speichern wartet das Foto ab", async () => {
    thumb.verzoegert = true;
    await mount("mobile");
    expect(beforeUnloadBlocked()).toBe(false);
    await waehleDatei(el('[data-testid="mob-foto-kamera"]'), "P4.jpg");

    // Nur die laufende Auswahl, kein Text: beforeunload hält trotzdem an.
    expect(beforeUnloadBlocked()).toBe(true);

    await click(knopf(i18n.t("topbar.toDesktop")));
    // Der Dialog steht — ohne ihn gäbe es den Knopf nicht.
    await click(knopf(i18n.t("nav.guard.save")));
    expect(await box.alle()).toHaveLength(0);
    expect(container.textContent).not.toContain("START-SEITE");

    await umwandlungFertig(BILD_P4);
    await act(flush);

    const entwuerfe = await box.alle();
    expect(entwuerfe).toHaveLength(1);
    expect(String(entwuerfe[0]?.bodyHtml)).toContain(BILD_P4);
    // Ohne Titel und Aussage wiese der Server den Entwurf ab (EMPTY_DRAFT) — er trägt deshalb den
    // Titel, den die Fläche für titellose Entwürfe ohnehin zeigt.
    expect(entwuerfe[0]?.title).toBe(i18n.t("capture.draftFallbackTitle"));
    expect(container.textContent).toContain("START-SEITE");
    abbauen();
  });

  it("Knopf, nur Foto: der Entwurf wird angelegt (kein EMPTY_DRAFT) und trägt das Foto", async () => {
    await mount("mobile");
    await waehleDatei(el('[data-testid="mob-foto-mediathek"]'), "P4.jpg");
    await click(el<HTMLButtonElement>('[data-testid="mob-primaer"]'));
    abbauen();

    const entwuerfe = await box.alle();
    expect(entwuerfe).toHaveLength(1);
    expect(entwuerfe[0]?.title).toBe(i18n.t("capture.draftFallbackTitle"));
    expect(String(entwuerfe[0]?.bodyHtml)).toContain("data:image/jpeg;base64,QUJD");
  });

  it("Formularwechsel: ein verspätetes Foto gerät NICHT in den fortgesetzten anderen Entwurf", async () => {
    const id = await box.seed({ title: "Anderer Entwurf", statement: "Alte Aussage" });
    thumb.verzoegert = true;
    await mount("mobile");
    await waehleDatei(el('[data-testid="mob-foto-kamera"]'), "P4.jpg");

    await click(el<HTMLButtonElement>(`button[title="${i18n.t("mob.resume")}"]`));
    await umwandlungFertig(BILD_P4);
    expect(container.innerHTML).not.toContain(BILD_P4);

    await click(knopf(i18n.t("mob.update")));
    abbauen();

    const entwuerfe = await box.alle();
    // Kein zusätzlicher Entwurf, und der fortgesetzte trägt kein fremdes Foto.
    expect(entwuerfe).toHaveLength(1);
    expect(entwuerfe[0]).toMatchObject({ title: "Anderer Entwurf", statement: "Alte Aussage" });
    expect(entwuerfe[0]?.bodyHtml).toBeUndefined();
    expect(id).toBeTruthy();
  });
});
