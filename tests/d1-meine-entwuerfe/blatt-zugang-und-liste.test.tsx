// @vitest-environment jsdom
// ================================================================================================
// JOB 3266 · D1 — DER DAUERHAFTE, BENANNTE ZUGANG ZU DEN EIGENEN ENTWÜRFEN (Erfassungsseite).
// ================================================================================================
//
// PEDIS BEFUND (Vorführung 07.09., Live 1.0.0-beta.1.177): Ein importiertes Dokument war als
// Entwurf gesichert — und beim späteren Besuch nicht wiederzufinden. Der Weg EXISTIERTE (im
// „…"-Menü der Erfassung), aber:
//   · der Knopf trug kein Wort und keinen zugänglichen Namen (`wort=""`, nur ein Symbol),
//   · der einzige BESCHRIFTETE Weg dorthin stand in der Bestätigungszeile nach dem Sichern
//     (`blatt-entwurf-gespeichert`, JOB 3106) — also genau dann NICHT, wenn man ihn braucht:
//     beim neuen Besuch ist nichts gerade gesichert.
//
// GEMESSEN WIRD AN DER ECHTEN FLÄCHE, mit dem echten Entwurfsdienst (CaptureService +
// InMemoryDraftRepo) hinter den Endpunkten — dieselbe Bauform wie
// `tests/entwurf-fortsetzen/blatt-entwurf-fortsetzen.test.tsx`. Kein Netz, kein Modelllauf; die
// Kennungen, Titel und `updatedAt` stammen aus echten Serverantworten, nicht aus Attrappen.
//
// B1 das „…"-Werkzeug hat einen übersetzten zugänglichen Namen (DE/EN)
// B2 der benannte Zugang „Meine Entwürfe" steht OHNE gesicherte Zeile da und klappt die Liste auf
// C  Lade-, Leer- und Fehlerzustand sind drei unterscheidbare, benannte Lagen
// D  ein Klick auf den Titel öffnet GENAU diesen Entwurf (Kennungsvergleich)
// E  die Adresse `/erfassen?entwuerfe=1` (der Weg von der Startseite) öffnet die Liste beim Aufbau
// F  der Zugang ist ein echtes Bedienelement im Tabulatorlauf
// G  ungesicherter Text bleibt beim Aufklappen unangetastet — der Zugang lädt nichts
// H  jeder Eintrag nennt neben dem Titel sein Datum
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  zaehler: { get: 0, list: 0 },
  seed: async (_p: Record<string, unknown>): Promise<string> => "",
  liste: async (): Promise<{ id: string; payload: Record<string, unknown> }[]> => [],
  /** Wie sich der Listenabruf verhält — die drei Lagen aus Lieferung 3. */
  listenLage: "ok" as "ok" | "fehler" | "haengt",
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
    box.zaehler.get = 0;
    box.zaehler.list = 0;
    box.listenLage = "ok";
  };
  box.seed = async (p: P) => (await svc.createDraft(p, "u1")).id;
  box.liste = async () => (await svc.listDrafts()) as unknown as { id: string; payload: P }[];
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      drafts: {
        list: vi.fn(async () => {
          box.zaehler.list += 1;
          if (box.listenLage === "fehler") {
            throw new Error("Entwürfe nicht erreichbar.");
          }
          if (box.listenLage === "haengt") {
            // Ein Abruf, der NICHT antwortet: genau der Zustand „lädt". Er wird nie aufgelöst —
            // die Abfrage bleibt damit im Ladezustand, solange die Fläche steht.
            await new Promise(() => {});
          }
          return svc.listDrafts();
        }),
        get: vi.fn(async (id: string) => {
          box.zaehler.get += 1;
          return svc.getDraft(id);
        }),
        create: vi.fn(async (p: P) => svc.createDraft(p, "u1")),
        update: vi.fn(async (id: string, p: P) => svc.continueDraft(id, p, "u1")),
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
  useLocation,
} from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { formatKoTimestamp } from "../../apps/web/src/lib/koDates";
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

function Adresse(): JSX.Element {
  const ort = useLocation();
  return createElement("span", { "data-testid": "adresse" }, `${ort.pathname}${ort.search}`);
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
                    createElement(Adresse),
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

function adresse(): string {
  return container.querySelector('[data-testid="adresse"]')?.textContent ?? "";
}

function pruefknopf(name: string): HTMLButtonElement {
  const el = container.querySelector(`[data-testid="${name}"]`);
  if (!(el instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${name}" fehlt`);
  }
  return el;
}

function eintraege(): HTMLButtonElement[] {
  return [...container.querySelectorAll('[data-testid="blatt-entwurf-eintrag"]')].filter(
    (e): e is HTMLButtonElement => e instanceof HTMLButtonElement,
  );
}

function da(name: string): boolean {
  return container.querySelector(`[data-testid="${name}"]`) !== null;
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

function editor(): HTMLElement {
  const el = container.querySelector('[role="textbox"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error("Schreibfeld nicht gefunden");
  }
  return el;
}

async function tippeTitel(wert: string): Promise<void> {
  const feld = titelfeld();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as (
    v: string,
  ) => void;
  await act(async () => {
    setter.call(feld, wert);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

async function tippeRumpf(html: string): Promise<void> {
  const feld = editor();
  await act(async () => {
    feld.innerHTML = html;
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

const NIT = {
  title: "NIT-Prüfplan Spritzzone",
  bodyHtml: "<p>Vor jedem Anlauf die Schmierstellen prüfen.</p>",
  type: "best_practice",
  category: "Anlage 1",
};
const ZWEITER = {
  title: "Ventil bei Überdruck",
  bodyHtml: "<p>Bei Überdruck Ventil X schließen.</p>",
  type: "best_practice",
  category: "Anlage 2",
};

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.reset();
});

afterEach(async () => {
  unmount();
  await i18n.changeLanguage("de");
  vi.clearAllMocks();
});

describe("JOB 3266 D1 · die Erfassung nennt den Weg zu den eigenen Entwürfen", () => {
  it('B1: das „…"-Werkzeug trägt einen übersetzten zugänglichen Namen — DE und EN', async () => {
    await mount("/erfassen");
    const mehr = pruefknopf("blatt-werkzeug-mehr");
    // Der Knopf trägt KEIN Wort (das Zielbild will das Symbol; was er sonst noch an Text führt,
    // ist der Titel des Chevron-Zeichens „·") — genau deshalb MUSS der Name am Attribut stehen.
    // Ohne ihn sagt ein Screenreader „Schaltfläche".
    expect(/\p{L}/u.test(mehr.textContent ?? "")).toBe(false);
    expect(mehr.getAttribute("aria-label")).toBe(i18n.t("erfassen.werkzeug.mehr"));
    expect((mehr.getAttribute("aria-label") ?? "").length).toBeGreaterThan(0);
    const deutsch = mehr.getAttribute("aria-label");

    unmount();
    await i18n.changeLanguage("en");
    await mount("/erfassen");
    const enName = pruefknopf("blatt-werkzeug-mehr").getAttribute("aria-label");
    expect(enName).toBe(i18n.t("erfassen.werkzeug.mehr"));
    // Übersetzt heisst: wirklich ein anderer Wortlaut, nicht derselbe Schlüssel zweimal.
    expect(enName).not.toBe(deutsch);
    expect(enName).not.toBe("erfassen.werkzeug.mehr");
  });

  it('B2: OHNE gesicherte Zeile steht „Meine Entwürfe" da und klappt die vorhandene Liste auf', async () => {
    await box.seed(NIT);
    await mount("/erfassen");

    // Die Voraussetzung des Befundes: Es ist nichts gesichert worden. Der Weg aus JOB 3106 steht
    // also NICHT da — und trotzdem muss der Zugang zu finden sein.
    expect(container.querySelector('[data-testid="blatt-entwurf-gespeichert"]')).toBeNull();

    const zugang = pruefknopf("blatt-werkzeug-entwuerfe");
    expect((zugang.textContent ?? "").trim()).toBe(i18n.t("fd.saved.toDrafts"));
    expect(container.querySelector('[data-testid="blatt-menue-mehr"]')).toBeNull();

    await click(zugang);
    const flaeche = container.querySelector('[data-testid="blatt-menue-mehr"]');
    expect(flaeche, 'die Fläche „Entwürfe" ist nicht aufgegangen').not.toBeNull();
    expect(flaeche?.textContent ?? "").toContain(NIT.title);
    expect(eintraege()).toHaveLength(1);
  });

  it("C: lädt, leer und gestört sind drei unterscheidbare Lagen — und die Störung hat einen Rückweg", async () => {
    // LEER: der Bestand ist wirklich abgefragt und wirklich leer.
    await mount("/erfassen");
    await click(pruefknopf("blatt-werkzeug-entwuerfe"));
    expect(box.zaehler.list).toBeGreaterThan(0);
    expect(da("blatt-entwuerfe-leer")).toBe(true);
    expect(da("blatt-entwuerfe-laedt")).toBe(false);
    expect(da("blatt-entwuerfe-fehler")).toBe(false);
    expect(container.textContent).toContain(i18n.t("erfassen.entwuerfe.keine"));
    unmount();

    // LÄDT: der Abruf antwortet nicht. Kein „Noch keine Entwürfe." — das wäre eine Verneinung des
    // Bestands, die niemand geprüft hat.
    box.reset();
    box.listenLage = "haengt";
    await mount("/erfassen");
    await click(pruefknopf("blatt-werkzeug-entwuerfe"));
    expect(da("blatt-entwuerfe-laedt")).toBe(true);
    expect(da("blatt-entwuerfe-leer")).toBe(false);
    expect(da("blatt-entwuerfe-fehler")).toBe(false);
    unmount();

    // GESTÖRT: der Abruf scheitert. Auch hier keine Verneinung — und ein Weg heraus.
    box.reset();
    box.listenLage = "fehler";
    await mount("/erfassen");
    await click(pruefknopf("blatt-werkzeug-entwuerfe"));
    expect(da("blatt-entwuerfe-fehler")).toBe(true);
    expect(da("blatt-entwuerfe-leer")).toBe(false);
    expect(container.textContent).toContain(i18n.t("state.error"));

    const versuche = box.zaehler.list;
    box.listenLage = "ok";
    const wieder = await box.seed(NIT);
    await click(pruefknopf("blatt-entwuerfe-erneut"));
    // Der Knopf behebt die Störung, die er anbietet: er fragt WIRKLICH noch einmal, und die Liste
    // steht danach da.
    expect(box.zaehler.list).toBeGreaterThan(versuche);
    expect(da("blatt-entwuerfe-fehler")).toBe(false);
    expect(eintraege().map((e) => e.getAttribute("data-entwurf"))).toEqual([wieder]);
  });

  it("D: der Klick auf einen Titel öffnet GENAU diesen Entwurf — Kennung, Adresse und Inhalt", async () => {
    const ersteKennung = await box.seed(NIT);
    const zweiteKennung = await box.seed(ZWEITER);
    await mount("/erfassen");
    await click(pruefknopf("blatt-werkzeug-entwuerfe"));

    const zeilen = eintraege();
    expect(zeilen).toHaveLength(2);
    const zweite = zeilen.find((e) => e.getAttribute("data-entwurf") === zweiteKennung);
    expect(zweite, "der zweite Entwurf steht nicht in der Liste").toBeDefined();
    expect(zweite?.textContent ?? "").toContain(ZWEITER.title);

    await click(zweite as HTMLButtonElement);
    // Die Adresse trägt die Kennung des ANGEKLICKTEN Entwurfs, nicht die des ersten.
    expect(adresse()).toBe(`/erfassen?draft=${zweiteKennung}`);
    expect(adresse()).not.toContain(ersteKennung);
    // Und das Blatt trägt seinen Inhalt — vollständig, so wie er gesichert wurde.
    expect(titelfeld().value).toBe(ZWEITER.title);
    expect(editor().innerHTML).toContain("Ventil X");
  });

  it("E: die Adresse `/erfassen?entwuerfe=1` — der Weg von der Startseite — öffnet die Liste beim Aufbau", async () => {
    const kennung = await box.seed(NIT);
    await mount("/erfassen?entwuerfe=1");

    // OHNE einen einzigen Klick: wer von der Startseite kommt, sieht seine Titel.
    const flaeche = container.querySelector('[data-testid="blatt-menue-mehr"]');
    expect(flaeche, "die Liste steht nach dem Weg von Start nicht offen").not.toBeNull();
    expect(eintraege().map((e) => e.getAttribute("data-entwurf"))).toEqual([kennung]);
    expect(flaeche?.textContent ?? "").toContain(NIT.title);

    // Und der Öffnungsbefehl ist kein Ladebefehl: das Blatt hält weiterhin keinen Entwurf.
    expect(box.zaehler.get).toBe(0);
    expect(titelfeld().value).toBe("");
  });

  it("F: der Zugang und jeder Titel sind echte Bedienelemente im Tabulatorlauf", async () => {
    await box.seed(NIT);
    await mount("/erfassen");
    const zugang = pruefknopf("blatt-werkzeug-entwuerfe");
    // WAS JSDOM NICHT KANN (und was deshalb nicht vorgetäuscht wird): aus einem `keydown` mit
    // „Enter" leitet es kein Klick-Ereignis ab — das tut nur die Bedienoberfläche eines echten
    // Browsers. Gemessen wird genau das, WORAN die Enter-Bedienung dort hängt: ein natives
    // `<button>`, nicht gesperrt, im Tabulatorlauf, wirklich fokussierbar.
    expect(zugang.tagName).toBe("BUTTON");
    expect(zugang.disabled).toBe(false);
    expect(zugang.tabIndex).toBe(0);
    zugang.focus();
    expect(document.activeElement).toBe(zugang);

    await click(zugang);
    const zeile = eintraege()[0] as HTMLButtonElement;
    expect(zeile.tagName).toBe("BUTTON");
    expect(zeile.disabled).toBe(false);
    expect(zeile.tabIndex).toBe(0);
    zeile.focus();
    expect(document.activeElement).toBe(zeile);
  });

  it("G: das Aufklappen nimmt ungesicherten Text nicht weg — es lädt nichts und ändert nichts", async () => {
    await box.seed(NIT);
    await mount("/erfassen");

    const angefangen = "Halbe Notiz, noch nicht gesichert";
    await tippeTitel(angefangen);
    await tippeRumpf("<p>Der Anlauf war heute unruhig.</p>");
    const ladevorgaenge = box.zaehler.get;

    await click(pruefknopf("blatt-werkzeug-entwuerfe"));

    // Die Liste steht — und das Angefangene steht unverändert daneben. Der Zugang öffnet nur;
    // welchen Entwurf das Blatt führt, entscheidet weiterhin allein der Klick auf einen Titel
    // (`entwurfOeffnen`, EIN Weg über die Adresse). Der Schutz beim ÖFFNEN eines fremden Standes
    // ist Sache von JOB 3256 und wird hier nicht zweitgebaut.
    expect(container.querySelector('[data-testid="blatt-menue-mehr"]')).not.toBeNull();
    expect(titelfeld().value).toBe(angefangen);
    expect(editor().innerHTML).toContain("unruhig");
    expect(box.zaehler.get).toBe(ladevorgaenge);
    expect(adresse()).toBe("/erfassen");
  });

  it("H: jeder Eintrag nennt neben dem Titel sein Datum — aus dem Stand des Servers", async () => {
    const kennung = await box.seed(NIT);
    await mount("/erfassen");
    await click(pruefknopf("blatt-werkzeug-entwuerfe"));

    const gespeichert = (await box.liste()).find((d) => d.id === kennung) as unknown as {
      updatedAt: string;
    };
    const erwartet = formatKoTimestamp(gespeichert.updatedAt, i18n.language);
    expect(erwartet, "der Dienst führt keinen Zeitwert — die Prüfung liefe leer").not.toBeNull();

    const zeile = eintraege()[0] as HTMLButtonElement;
    const datum = zeile.querySelector('[data-testid="blatt-entwurf-eintrag-datum"]');
    expect(datum, "der Eintrag nennt kein Datum").not.toBeNull();
    expect((datum?.textContent ?? "").trim()).toBe(erwartet);
    expect(zeile.textContent ?? "").toContain(NIT.title);
  });
});
