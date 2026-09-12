// @vitest-environment jsdom
// ================================================================================================
// JOB 3106 (UX-01) — NACH DEM SICHERN FÜHRT EIN BESCHRIFTETER WEG ZUM ENTWURF, UND ER ÜBERLEBT
// DAS NEULADEN.
// ================================================================================================
//
// CODEX' LIVE-BEFUNDE, die hier abgemessen werden:
//   N-0005 (v1.0.0-beta.1.101): „URL bleibt /erfassen. Nach Reload ist das Blatt leer."
//   N-0018 (v1.0.0-beta.1.107): „Über … → Entwürfe ist der gespeicherte Text vollständig
//           erreichbar. Die Speicherbestätigung nennt diesen Weg nicht."
//
// DIE ENTWURFS-ENDPUNKTE LAUFEN GEGEN DEN ECHTEN DIENST (CaptureService + InMemoryDraftRepo),
// derselbe Aufbau wie `tests/capture/frontdoor-empty-body-save-mounted.test.tsx`: die reale
// Merge-Semantik und die realen Serverantworten (Kennung, Titel, `updatedAt`) greifen mit. Kein
// Netz, kein Modelllauf. Nur so trägt der Nachweis „Fortsetzen legt nichts Zweites an" wirklich —
// gezählt wird, WELCHER Endpunkt gerufen wurde, nicht was die Oberfläche darüber behauptet.
//
// F1 Adresse trägt nach dem Sichern `?draft=<id>` (und `replace` verschmutzt den Zurück-Weg nicht)
// F2 Bestätigungszeile mit Titel + Tastaturweg zu den eigenen Entwürfen
// F3 Weiterschreiben nach dem Sichern: Text bleibt, kein zweiter Ladevorgang, Zeile verschwindet
// F4 Neuaufbau mit `?draft=<id>` (Neuladen): Inhalt da, erneutes Sichern ist ein `update`
// F5 Fortsetzen über die Fläche „Entwürfe" und Sichern: ebenfalls `update`, kein `create`
// F6 DE/EN/NL: die neuen Sätze sind dreisprachig da und unterscheiden sich
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  zaehler: { create: 0, update: 0, get: 0 },
  seed: async (_p: Record<string, unknown>): Promise<string> => "",
  liste: async (): Promise<{ id: string; payload: Record<string, unknown> }[]> => [],
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
  useLocation,
  useNavigate,
} from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";
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

// Die Sonde auf die ADRESSE: sie zeigt, was in der Leiste stünde, und sie kann zurückgehen. Beides
// braucht F1 — die Kennung UND der unverschmutzte Zurück-Weg (`replace: true`).
//
// ZWEI KNOTEN, NICHT EINER (JOB 3611; die Begründung wohnt an EINER Stelle:
// `tests/adresse-ist-kein-pfad/adresse-ist-kein-pfad.test.ts`, Ursprung
// `tests/app-sprachschalter/wechsel-ohne-verlust.test.tsx:120-138`). Bis JOB 3611 stand hier EIN
// Knoten mit `pathname` und `search` in einer Zeichenkette; `expect(adresse()).toBe("/erfassen")`
// sah damit wie eine Routenprüfung aus, behauptete aber stillschweigend „und kein Abfrageteil" —
// und genau den trägt dieses Blatt wenige Zeilen später nach. Der Wächter in
// `tests/adresse-ist-kein-pfad/` macht die Rückkehr dieser Form rot.
function Adresse(): JSX.Element {
  const ort = useLocation();
  const gehe = useNavigate();
  return createElement(
    "div",
    null,
    createElement("span", { key: "pfad", "data-testid": "adresse-pfad", children: ort.pathname }),
    createElement("span", {
      key: "abfrage",
      "data-testid": "adresse-abfrage",
      children: ort.search,
    }),
    createElement(
      "button",
      { type: "button", "data-testid": "zurueck", onClick: () => gehe(-1) },
      "‹",
    ),
  );
}

/**
 * EIN ZIEL FÜR DEN AUFBAU — entweder ein geschriebener Weg oder die zwei Teile, die die Sonde
 * GETRENNT gelesen hat. Die zwei Teile werden hier bewusst NICHT zu einer Zeichenkette gefügt:
 * `MemoryRouter` nimmt `{ pathname, search }` unmittelbar, also braucht F4 keine zusammengesetzte
 * Adresse, um das Neuladen über den Weg zu fahren, den das Blatt selbst hinterlassen hat.
 */
type Ziel = string | { pfad: string; abfrage: string };

async function mount(ziel: Ziel, seite: "blatt" | "arbeitsraum" = "blatt"): Promise<void> {
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
                {
                  initialEntries: [
                    "/zwischenstand",
                    typeof ziel === "string" ? ziel : { pathname: ziel.pfad, search: ziel.abfrage },
                  ],
                  initialIndex: 1,
                },
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
                        element: createElement(
                          seite === "blatt" ? CaptureFrontDoor : CaptureArbeitsraum,
                        ),
                      }),
                      createElement(Route, {
                        path: "/zwischenstand",
                        element: createElement("div", null, "zwischenstand"),
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

/** DIE ROUTE, und nur sie. Ein `?` kann hier nicht vorkommen — und wenn doch, sagt es der Wurf. */
function routenPfad(): string {
  const wert = container.querySelector('[data-testid="adresse-pfad"]')?.textContent ?? "";
  if (wert.includes("?")) {
    throw new Error(`Der Pfadknoten trägt einen Abfrageteil: „${wert}"`);
  }
  return wert;
}

/** DIE VOLLE ADRESSE — beide Teile, GETRENNT. Bewusst keine zusammengesetzte Zeichenkette. */
function adresse(): { pfad: string; abfrage: string } {
  return {
    pfad: routenPfad(),
    abfrage: container.querySelector('[data-testid="adresse-abfrage"]')?.textContent ?? "",
  };
}

function pruefknopf(name: string): HTMLButtonElement {
  const el = container.querySelector(`[data-testid="${name}"]`);
  if (!(el instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${name}" fehlt`);
  }
  return el;
}

function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${part}" nicht gefunden`);
  }
  return btn;
}

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

function editor(): HTMLElement {
  const el = container.querySelector('[role="textbox"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error("Schreibfeld nicht gefunden");
  }
  return el;
}

function titelfeld(): HTMLInputElement {
  const el = container.querySelector('[data-testid="blatt-titel"]');
  if (!(el instanceof HTMLInputElement)) {
    throw new Error("Titelfeld nicht gefunden");
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

async function sichern(): Promise<void> {
  await click(pruefknopf("blatt-entwurf-sichern"));
}

const TITEL = "Presse P4 abschmieren";
const RUMPF = "<p>Vor jedem Anlauf die Schmierstellen prüfen.</p>";

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.reset();
});

afterEach(() => {
  unmount();
  vi.clearAllMocks();
});

describe("JOB 3106 (UX-01): der gesicherte Entwurf bleibt erreichbar", () => {
  it("F1: nach dem Sichern trägt die Adresse ?draft=<kennung> — und der Zurück-Weg bleibt sauber", async () => {
    await mount("/erfassen");
    // Die Route, und GETRENNT davon die Zusage, die vorher stillschweigend mitlief: noch trägt die
    // Adresse keinen Abfrageteil. Erst sie macht den Vergleich unten zu einer echten Messung.
    expect(routenPfad()).toBe("/erfassen");
    expect(adresse().abfrage, "vor dem Sichern steht keine Kennung in der Adresse").toBe("");

    await tippeTitel(TITEL);
    await tippeRumpf(RUMPF);
    await sichern();

    const gespeichert = await box.liste();
    expect(gespeichert).toHaveLength(1);
    const kennung = gespeichert[0]?.id as string;
    // DER BEFUND N-0005, umgedreht: die Adresse trägt die Kennung aus der SERVERANTWORT — und die
    // Route hat sich dabei NICHT bewegt. Zwei Aussagen, beide ausgeschrieben.
    expect(adresse()).toEqual({ pfad: "/erfassen", abfrage: `?draft=${kennung}` });

    // `replace: true`: das Festhalten der Kennung ist kein Schritt des Menschen. Ein „Zurück"
    // führt dorthin, wo er vor dem Blatt war — nicht auf das Blatt ohne Kennung.
    await click(pruefknopf("zurueck"));
    expect(routenPfad()).toBe("/zwischenstand");
    expect(adresse().abfrage, "der Zurück-Weg hat einen Abfrageteil mitgeschleppt").toBe("");
  });

  it("F2: die Bestätigungszeile nennt den Titel und öffnet über die Tastatur die eigenen Entwürfe", async () => {
    await mount("/erfassen");
    await tippeTitel(TITEL);
    await tippeRumpf(RUMPF);
    await sichern();

    const zeile = container.querySelector('[data-testid="blatt-entwurf-gespeichert"]');
    expect(zeile).not.toBeNull();
    expect(zeile?.textContent ?? "").toContain(TITEL);
    // Und sie spricht über GENAU den Entwurf, den der Server angelegt hat.
    expect(zeile?.getAttribute("data-entwurf")).toBe((await box.liste())[0]?.id);

    // ============================================================================================
    // EIN ECHTES BEDIENELEMENT — UND ZWAR GEMESSEN, NICHT BEHAUPTET (bens Prüflücke 6).
    // ============================================================================================
    // Bis R2 stand hier nur die Attributprobe. Der Fokus wird jetzt WIRKLICH gesetzt: ein `div`
    // mit `onClick` (die naheliegende falsche Bauform) wird dabei nicht zum `activeElement` und
    // trägt `tabIndex` -1 — der Fall fiele auf.
    //
    // WAS JSDOM NICHT KANN, und was deshalb NICHT vorgetäuscht wird: aus einem `keydown` mit
    // „Enter" leitet jsdom kein Klick-Ereignis ab (das tut nur die Bedienoberfläche eines echten
    // Browsers). Ein hier von Hand nachgeschobener Klick würde die eigene Simulation prüfen, nicht
    // das Produkt. Gemessen wird deshalb genau das, woran die Enter-Bedienung im Browser hängt:
    // dass es ein natives `<button>` im Tabulator-Lauf ist, nicht gesperrt, mit dem erwarteten Wort.
    const weg = pruefknopf("blatt-entwurf-gespeichert-entwuerfe");
    expect(weg.tagName).toBe("BUTTON");
    expect(weg.disabled).toBe(false);
    expect(weg.getAttribute("tabindex")).toBeNull();
    expect(weg.tabIndex).toBe(0);
    weg.focus();
    expect(document.activeElement).toBe(weg);
    expect((weg.textContent ?? "").trim()).toBe(i18n.t("fd.saved.toDrafts"));

    await click(weg);
    // Es ist die VORHANDENE Fläche „…" → „Entwürfe" — und der gerade gesicherte Entwurf steht darin.
    const flaeche = container.querySelector('[data-testid="blatt-menue-mehr"]');
    expect(flaeche).not.toBeNull();
    expect(flaeche?.textContent ?? "").toContain(TITEL);
  });

  it("F3: Weiterschreiben nach dem Sichern — der Text bleibt, es wird nichts nachgeladen, die Zeile geht", async () => {
    await mount("/erfassen");
    await tippeTitel(TITEL);
    await tippeRumpf(RUMPF);
    await sichern();
    expect(container.querySelector('[data-testid="blatt-entwurf-gespeichert"]')).not.toBeNull();

    const getsNachSichern = box.zaehler.get;
    await tippeTitel(`${TITEL} (Stufe 2)`);

    // Der Adresswechsel hat KEINEN zweiten Ladevorgang ausgelöst — sonst käme die Serverantwort
    // über den gerade getippten Stand.
    expect(box.zaehler.get).toBe(getsNachSichern);
    expect(titelfeld().value).toBe(`${TITEL} (Stufe 2)`);
    expect(editor().innerHTML).toContain("Schmierstellen");
    // Und die Zeile behauptet nicht länger „gesichert", was gerade nicht gesichert ist.
    expect(container.querySelector('[data-testid="blatt-entwurf-gespeichert"]')).toBeNull();
  });

  it("F4: Neuaufbau mit ?draft=<kennung> zeigt denselben Text — und ein zweites Sichern aktualisiert, statt anzulegen", async () => {
    await mount("/erfassen");
    await tippeTitel(TITEL);
    await tippeRumpf(RUMPF);
    await sichern();
    const kennung = (await box.liste())[0]?.id as string;
    // DAS NEULADEN GEHT ÜBER DIE ADRESSE, DIE DAS BLATT SELBST HINTERLASSEN HAT — nicht über eine
    // im Test zusammengebaute. Genau das tut ein Mensch, der F5 drückt: er lädt, was in der Leiste
    // steht. Trüge die Adresse die Kennung nicht, stünde hier gleich ein leeres Blatt.
    // Weitergegeben werden BEIDE TEILE, getrennt (JOB 3611) — `mount` nimmt sie so, wie sie gelesen
    // wurden, und niemand muss sie dafür zu einer Zeichenkette fügen.
    const nachSichern = adresse();
    expect(nachSichern).toEqual({ pfad: "/erfassen", abfrage: `?draft=${kennung}` });
    unmount();

    box.zaehler.create = 0;
    box.zaehler.update = 0;
    await mount(nachSichern);
    expect(titelfeld().value).toBe(TITEL);
    expect(editor().innerHTML).toContain("Schmierstellen");

    await tippeRumpf(`${RUMPF}<p>Nachtrag nach dem Neuladen.</p>`);
    await sichern();

    expect(box.zaehler.update).toBe(1);
    expect(box.zaehler.create).toBe(0);
    const alle = await box.liste();
    expect(alle).toHaveLength(1);
    expect(alle[0]?.id).toBe(kennung);
    expect(String(alle[0]?.payload.bodyHtml)).toContain("Nachtrag nach dem Neuladen.");
  });

  it("F5: Fortsetzen über die Fläche Entwürfe aktualisiert denselben Entwurf", async () => {
    const kennung = await box.seed({
      title: "Wartungsfenster L4",
      statement: "Nur im Stillstand.",
      bodyHtml: "<p>Nur im Stillstand.</p>",
      origin: "frontdoor",
    });
    await mount("/erfassen");
    box.zaehler.create = 0;
    box.zaehler.update = 0;

    await click(pruefknopf("blatt-werkzeug-mehr"));
    await click(buttonByText(i18n.t("erfassen.mehr.entwuerfe")));
    await click(buttonByText("Wartungsfenster L4"));

    expect(adresse()).toEqual({ pfad: "/erfassen", abfrage: `?draft=${kennung}` });
    expect(titelfeld().value).toBe("Wartungsfenster L4");

    await tippeRumpf("<p>Nur im Stillstand, mit Freischaltung.</p>");
    await sichern();

    expect(box.zaehler.update).toBe(1);
    expect(box.zaehler.create).toBe(0);
    expect(await box.liste()).toHaveLength(1);
  });

  // ==============================================================================================
  // F8 (JOB 3106 R3, bens Korrekturpflicht 1) — WIEDERAUFNAHME IN DERSELBEN SITZUNG, NACH DEM
  // LEEREN DES BLATTES.
  // ==============================================================================================
  //
  // BENS MESSUNG AN RUNDE 2, wörtlich: „sichern → ‚Eingabe verwerfen' bestätigen → denselben
  // Entwurf über ‚Entwürfe' öffnen → richtige Adresse, leeres Blatt. Weiterschreiben und sichern:
  // create=1, update=0" — also ein ZWEITER Entwurf, genau der Schaden, den Lieferung 5 ausschliessen
  // soll. Ursache war der Lade-Merker: er überlebte die Rücksetzung, und das erneute Öffnen
  // desselben Entwurfs sprang deshalb am Laden vorbei.
  //
  // WARUM F4/F5 DAS NICHT GEFANGEN HABEN: beide beginnen mit einem FRISCHEN Aufbau — dort ist jeder
  // Merker ohnehin leer. Ein frischer Mount belegt den Lebenszyklus eines Merkers nicht (bens
  // Promptverbesserung). Dieser Fall bleibt deshalb von der ersten bis zur letzten Zeile in
  // DERSELBEN Komponenteninstanz.
  it("F8: sichern → Blatt leeren → denselben Entwurf öffnen → voller Inhalt, und Sichern aktualisiert ihn", async () => {
    await mount("/erfassen");
    await tippeTitel(TITEL);
    await tippeRumpf(RUMPF);
    await sichern();
    const kennung = (await box.liste())[0]?.id as string;
    box.zaehler.create = 0;
    box.zaehler.update = 0;

    // --- „Eingabe verwerfen" im „…"-Menü, mit der echten Rückfrage ------------------------------
    const vorherigesConfirm = window.confirm;
    window.confirm = () => true;
    try {
      await click(pruefknopf("blatt-werkzeug-mehr"));
      await click(buttonByText(i18n.t("fd.discardInput")));
    } finally {
      window.confirm = vorherigesConfirm;
    }
    // Das Blatt ist leer, und die Adresse trägt keinen Entwurf mehr. „Kein Entwurf mehr" ist hier
    // die eigentliche Zusage — sie steht deshalb als eigene Zeile da, nicht im Pfadvergleich versteckt.
    expect(routenPfad()).toBe("/erfassen");
    expect(adresse().abfrage, "die verworfene Kennung steht noch in der Adresse").toBe("");
    expect(titelfeld().value).toBe("");
    expect(container.querySelector('[data-testid="blatt-entwurf-gespeichert"]')).toBeNull();

    // --- denselben Entwurf über die Fläche „Entwürfe" wieder öffnen -----------------------------
    await click(pruefknopf("blatt-werkzeug-mehr"));
    await click(buttonByText(i18n.t("erfassen.mehr.entwuerfe")));
    await click(buttonByText(TITEL));

    // DAS IST DER BEFUND: hier stand in Runde 2 die richtige Adresse über einem leeren Blatt.
    expect(adresse()).toEqual({ pfad: "/erfassen", abfrage: `?draft=${kennung}` });
    expect(titelfeld().value).toBe(TITEL);
    expect(editor().innerHTML).toContain("Schmierstellen");

    // --- weiterschreiben und sichern: EIN Entwurf, aktualisiert --------------------------------
    await tippeRumpf(`${RUMPF}<p>Nachtrag nach dem Wiederöffnen.</p>`);
    await sichern();

    expect(box.zaehler.update).toBe(1);
    expect(box.zaehler.create).toBe(0);
    const alle = await box.liste();
    expect(alle).toHaveLength(1);
    expect(alle[0]?.id).toBe(kennung);
    expect(String(alle[0]?.payload.bodyHtml)).toContain("Nachtrag nach dem Wiederöffnen.");
  });

  it("F6: die neuen Sätze stehen dreisprachig da und unterscheiden sich", () => {
    for (const schluessel of ["fd.saved.line", "fd.saved.toDrafts"]) {
      const de = i18n.getResource("de", "translation", schluessel) as string | undefined;
      const en = i18n.getResource("en", "translation", schluessel) as string | undefined;
      const nl = i18n.getResource("nl", "translation", schluessel) as string | undefined;
      expect(typeof de).toBe("string");
      expect(typeof en).toBe("string");
      expect(typeof nl).toBe("string");
      expect((de ?? "").length).toBeGreaterThan(0);
      expect(de).not.toBe(en);
      expect(de).not.toBe(nl);
    }
    // Der Platzhalter bleibt in allen drei Sprachen erhalten — sonst stünde die Zeile ohne Titel da.
    for (const sprache of ["de", "en", "nl"]) {
      expect(i18n.getResource(sprache, "translation", "fd.saved.line") as string).toContain(
        "{{titel}}",
      );
    }
  });
});

// ================================================================================================
// F7 — DIE TOTE MARKIERUNG „GERADE GESPEICHERT" IM ARBEITSRAUM.
// ================================================================================================
// `CaptureDraftList` trägt Rahmen und Plakette seit langem; der einzige Aufrufer übergab
// `highlightId={null}`, und die Liste startete eingeklappt. Beides zusammen hiess: die Auszeichnung
// konnte in KEINEM Zustand erscheinen. Gemessen wird am echten Arbeitsraum, über den echten
// Speichern-Knopf.
describe("JOB 3106 (UX-01): der Arbeitsraum zeigt den gerade gespeicherten Entwurf", () => {
  it("F7: nach dem Speichern trägt der Eintrag die Plakette gerade gespeichert, und die Liste ist offen", async () => {
    await mount("/erfassen", "arbeitsraum");

    const feld = container.querySelector("textarea");
    if (!(feld instanceof HTMLTextAreaElement)) {
      throw new Error("Erzählfeld nicht gefunden");
    }
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set as (
      v: string,
    ) => void;
    await act(async () => {
      setter.call(feld, "Die Schmierstellen der Presse P4 vor jedem Anlauf prüfen.");
      feld.dispatchEvent(new Event("input", { bubbles: true }));
      await flush();
    });

    await click(buttonByText(i18n.t("capture.saveDraft")));

    const gespeichert = await box.liste();
    expect(gespeichert).toHaveLength(1);

    // Die Plakette steht — und sie steht an DEM Eintrag, den der Server quittiert hat.
    const plakette = [...container.querySelectorAll("span")].find(
      (s) => (s.textContent ?? "").trim() === i18n.t("capture.draftJustSaved"),
    );
    expect(plakette).toBeDefined();
    // Und sie ist wirklich zu sehen: die Liste ist aufgeklappt, nicht eingeklappt.
    const aufklapper = [...container.querySelectorAll("button")].find(
      (b) => b.getAttribute("aria-expanded") !== null && (b.textContent ?? "").includes("nklappen"),
    );
    expect(aufklapper?.getAttribute("aria-expanded")).toBe("true");
  });
});
