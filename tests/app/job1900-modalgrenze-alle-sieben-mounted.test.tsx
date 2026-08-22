// @vitest-environment jsdom
// JOB 1900 · PRO6 · D1 — DIE GRENZE GILT FÜR ALLE SIEBEN MODALEN FLÄCHEN.
//
// Chef-Entscheidung vom 22.08.2026 (Variante (b), `OF-1851-D6-1`): bis hierher trug genau EINE der
// sieben `<Modal>`-Flächen eine Hintergrundsperre und eine Fokusrückgabe — der Navigationswächter,
// und der brachte beides selbst mit. Die anderen sechs hatten weder das eine noch das andere.
//
// WARUM DIESE DATEI SIEBEN EINZELNE FÄLLE HAT UND NICHT EINEN GEMEINSAMEN:
// Der Auftrag verbietet die Sammelzusage ausdrücklich, und er hat recht damit. „Alle Modale hängen
// an der Grenze" ist eine Aussage über `Modal.tsx`; sie ist auch dann grün, wenn eine Fläche gar
// nicht unter der Grenze gerendert wird. Genau das war der Fall, den die erste Fassung dieses
// Anschlusses produziert hat: `NavGuardProvider` hängt in `App.tsx:99` OBERHALB von
// `ModalBoundaryProvider`, seine Fläche erreichte den Kontext nicht — und ein Sammeltest hätte das
// nicht gezeigt. Jede Fläche wird deshalb dort gemountet, wo sie im Produkt steht.
//
// Je Fläche dieselben drei Fragen, einzeln beantwortet:
//   1. Fokus HINEIN     — nach dem Öffnen liegt der Fokus im Panel dieser Fläche.
//   2. Hintergrund ZU   — ein gemeldeter Bereich trägt `inert`, das Panel liegt NICHT darin.
//   3. Fokus ZURÜCK     — nach dem Schließen trägt exakt der Auslöser den Fokus, `inert` ist weg.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/client", () => ({
  ApiError: class ApiError extends Error {},
  apiFetch: vi.fn(async () => ({})),
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ANTWORTEN: Record<string, unknown> = {
    "conflicts.list": [
      {
        id: "c1",
        koA: "ko-a",
        koB: "ko-b",
        type: "truth",
        description: "Widerspruch in der Wartungsfrist",
        status: "open",
        secondOpinion: null,
        decidedBy: null,
        decision: null,
      },
    ],
    "duplicates.list": [
      {
        id: "d1",
        koA: "ko-a",
        koB: "ko-b",
        relation: "overlap",
        aspects: [],
        eigenanteilA: "A",
        eigenanteilB: "B",
        recommendation: "merge",
        status: "open",
        pairKey: "ko-a|ko-b",
        origin: "manual",
        createdAt: "2026-08-22T00:00:00.000Z",
      },
    ],
    "ko.list": [
      {
        id: "ko-a",
        title: "Pumpe A",
        statement: "Alle 6 Monate warten.",
        type: "rule",
        status: "active",
        tags: [],
        conditions: [],
        measures: [],
      },
      {
        id: "ko-b",
        title: "Pumpe B",
        statement: "Alle 12 Monate warten.",
        type: "rule",
        status: "active",
        tags: [],
        conditions: [],
        measures: [],
      },
    ],
  };
  const make = (pfad: string): unknown =>
    new Proxy(
      vi.fn(async () => ANTWORTEN[pfad] ?? []),
      {
        get(target, prop, recv) {
          if (prop in target || typeof prop === "symbol") {
            return Reflect.get(target, prop, recv);
          }
          return make(pfad === "" ? String(prop) : `${pfad}.${String(prop)}`);
        },
      },
    );
  return { endpoints: make("") };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider, useNavGuard } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { AppendToArticleModal } from "../../apps/web/src/components/AppendToArticleModal";
import { ConflictTargetPicker } from "../../apps/web/src/components/ConflictTargetPicker";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import i18n from "../../apps/web/src/i18n";
import { Capture } from "../../apps/web/src/pages/Capture";
import { Conflicts } from "../../apps/web/src/pages/Conflicts";
import { Duplicates } from "../../apps/web/src/pages/Duplicates";
import { AppShell } from "../../apps/web/src/shell/AppShell";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
  await Promise.resolve();
};

// Die ECHTE Shell mit der echten Provider-Kette — dieselbe Reihenfolge wie in App.tsx.
async function render(inhalt: unknown, route = "/"): Promise<void> {
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
                ImageDescribeProvider,
                null,
                createElement(
                  NavGuardProvider,
                  null,
                  createElement(
                    MemoryRouter,
                    { initialEntries: [route] },
                    createElement(AppShell, null, inhalt as never),
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

async function klick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
  await act(flush);
}

afterEach(async () => {
  if (root) {
    await act(async () => {
      root.unmount();
    });
  }
  container?.remove();
});

// Das Panel EINER Fläche: `Modal` setzt `tabIndex={-1}` genau dort. Es gibt zu jedem Zeitpunkt
// höchstens eines, weil die Fälle jeweils eine Fläche öffnen.
const panel = (): HTMLElement | null => document.querySelector<HTMLElement>("div[tabindex='-1']");

// Ein Bedienelement in der Fläche, über das sie sich schließen lässt: der beschriftete
// Schließen-Knopf aus `Modal.tsx:72-78`.
const schliessKnopf = (): HTMLElement => {
  const p = panel();
  if (!p) {
    throw new Error("kein Panel offen");
  }
  const knopf = [...p.querySelectorAll<HTMLElement>("button")].find(
    (b) => (b.textContent ?? "").trim() === i18n.t("modal.close"),
  );
  if (!knopf) {
    throw new Error("kein Schliessen-Knopf im Panel");
  }
  return knopf;
};

// Die drei Fragen, je Fläche einzeln gestellt. Kein Sammelbeleg: der Aufrufer übergibt SEINE
// Fläche und SEINEN Auslöser, und die Zusicherungen gelten genau für diese.
async function grenzeGiltFuer(ausloeser: HTMLElement): Promise<void> {
  // 1. FOKUS HINEIN
  const p = panel();
  expect(p, "die Fläche ist offen").not.toBeNull();
  expect(p?.contains(document.activeElement), "Fokus liegt im Panel").toBe(true);

  // 2. HINTERGRUND ZU
  const gesperrt = container.querySelector("[inert]");
  expect(gesperrt, "ein gemeldeter Bereich ist inert").not.toBeNull();
  expect(ausloeser.closest("[inert]"), "der Auslöser liegt im gesperrten Bereich").not.toBeNull();
  expect(p?.closest("[inert]") ?? null, "das Panel selbst ist NICHT gesperrt").toBeNull();

  // 3. FOKUS ZURÜCK
  await klick(schliessKnopf());
  expect(panel(), "die Fläche ist zu").toBeNull();
  expect(document.activeElement, "der Fokus steht wieder auf dem Auslöser").toBe(ausloeser);
  expect(container.querySelector("[inert]"), "die Sperre ist aufgehoben").toBeNull();
}

// Eine Sonde, die eine Fläche über einen ECHTEN Knopf öffnet — für die Flächen, deren Wirt eine
// eigene Komponente ist. Der Knopf steht im Seiteninhalt und damit im gesperrten Bereich; genau
// das prüft Frage 2.
function Sonde({ bauFlaeche }: { bauFlaeche: (offen: boolean, zu: () => void) => unknown }) {
  const [offen, setOffen] = useState(false);
  return createElement(
    "div",
    null,
    createElement(
      "button",
      { type: "button", "data-testid": "ausloeser", onClick: () => setOffen(true) },
      "oeffnen",
    ),
    bauFlaeche(offen, () => setOffen(false)) as never,
  );
}

// React hört auf den nativen Setter, nicht auf `el.value = …` — dieselbe Bauform wie in
// `tests/capture/source-url-unsavable-mounted.test.tsx:178-191`.
async function tippe(el: HTMLInputElement | HTMLTextAreaElement, wert: string): Promise<void> {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, wert);
  await act(async () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

function feldMitPlatzhalter(ph: string): HTMLInputElement | HTMLTextAreaElement {
  const el = [...container.querySelectorAll<HTMLElement>("input, textarea")].find(
    (i) => (i as HTMLInputElement).placeholder === ph,
  );
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    throw new Error(`Feld mit Platzhalter „${ph}" nicht gefunden`);
  }
  return el;
}

function knopfMitText(text: string): HTMLElement {
  const el = [...container.querySelectorAll<HTMLElement>("button")].find(
    (b) => (b.textContent ?? "").trim() === text,
  );
  if (!el) {
    const da = [...container.querySelectorAll<HTMLElement>("button")]
      .map((b) => (b.textContent ?? "").trim())
      .filter(Boolean);
    throw new Error(`Knopf „${text}" nicht gefunden. Vorhanden: ${JSON.stringify(da)}`);
  }
  return el;
}

const ausloeser = (): HTMLElement => {
  const el = container.querySelector<HTMLElement>('[data-testid="ausloeser"]');
  if (!el) {
    throw new Error("Ausloeser nicht gefunden");
  }
  return el;
};

async function oeffneUeberSonde(): Promise<HTMLElement> {
  const knopf = ausloeser();
  knopf.focus();
  await klick(knopf);
  return knopf;
}

const KOS = [{ id: "ko-b", title: "Pumpe B", statement: "Alle 12 Monate warten." }] as never;

describe("JOB 1900 · die Grenze gilt für alle sieben modalen Flächen — je Fläche ein eigener Fall", () => {
  it("K3 · components/ConflictTargetPicker.tsx:39 — Fokus zurück UND Hintergrund gesperrt", async () => {
    await render(
      createElement(Sonde, {
        bauFlaeche: (offen: boolean, zu: () => void) =>
          createElement(ConflictTargetPicker, {
            open: offen,
            onClose: zu,
            candidates: KOS,
            onSelect: () => {},
          }),
      }),
    );
    const knopf = await oeffneUeberSonde();
    await grenzeGiltFuer(knopf);
  });

  it("K4 · components/AppendToArticleModal.tsx:159 — Fokus zurück UND Hintergrund gesperrt", async () => {
    await render(
      createElement(Sonde, {
        bauFlaeche: (offen: boolean, zu: () => void) =>
          createElement(AppendToArticleModal, {
            open: offen,
            points: [],
            fileName: "quelle.pdf",
            onClose: zu,
            onDone: () => {},
          }),
      }),
    );
    const knopf = await oeffneUeberSonde();
    await grenzeGiltFuer(knopf);
  });

  it("K1 · pages/Conflicts.tsx:642 — Fokus zurück UND Hintergrund gesperrt", async () => {
    await render(createElement(Conflicts));
    const vergleich = [...container.querySelectorAll<HTMLElement>("button")].find(
      (b) => (b.textContent ?? "").trim() === i18n.t("con.compareOpen"),
    );
    expect(vergleich, "der Vergleichsknopf aus Conflicts.tsx:465 ist da").toBeDefined();
    (vergleich as HTMLElement).focus();
    await klick(vergleich as HTMLElement);
    await grenzeGiltFuer(vergleich as HTMLElement);
  });

  it("K2 · pages/Duplicates.tsx:383 — Fokus zurück UND Hintergrund gesperrt", async () => {
    await render(createElement(Duplicates));
    const vergleich = [...container.querySelectorAll<HTMLElement>("button")].find(
      (b) => (b.textContent ?? "").trim() === i18n.t("dup.compareOpen"),
    );
    expect(vergleich, "der Vergleichsknopf aus Duplicates.tsx:283 ist da").toBeDefined();
    (vergleich as HTMLElement).focus();
    await klick(vergleich as HTMLElement);
    await grenzeGiltFuer(vergleich as HTMLElement);
  });

  it("K5 · pages/Capture.tsx:5941 — Fokus zurück UND Hintergrund gesperrt", async () => {
    // Die Speichergrenze öffnet nur, wenn es etwas NICHT Sicherbares gibt (`:3218-3220`). Der
    // billigste echte Weg dorthin ist eine Quelladresse, die der Entwurf nicht mitnehmen kann —
    // dieselbe Ausgangslage wie in `tests/capture/source-url-unsavable-mounted.test.tsx:214-223`.
    await render(createElement(Capture), "/erfassen");
    await tippe(feldMitPlatzhalter(i18n.t("capture.rawPlaceholder")), "Kernaussage zur Norm");
    await klick(knopfMitText(i18n.t("capture.advanced.title")));
    await tippe(feldMitPlatzhalter(i18n.t("ko.sourceLabel")), "Handbuch S. 12");
    await tippe(feldMitPlatzhalter(i18n.t("ko.sourceUrl")), "file:///C:/norm.pdf");

    const speichern = knopfMitText(i18n.t("capture.saveDraft"));
    speichern.focus();
    await klick(speichern);
    await grenzeGiltFuer(speichern);
  });

  it("K6 · components/RichTextEditor.tsx:1544 — Fokus zurück UND Hintergrund gesperrt", async () => {
    // Der echte Weg zum Fußnotenformular: der Klick auf die Fußnote selbst
    // (`onEditorClick:553` → `openCaptionFormForCaption:680`).
    const inhalt =
      '<figure><img src="x" data-image-id="bild-1" alt="" /><figcaption data-image-id="bild-1" tabindex="0" role="button">Alte Beschreibung</figcaption></figure>';
    function EditorSonde(): JSX.Element {
      const [wert, setWert] = useState(inhalt);
      return createElement(RichTextEditor, {
        value: wert,
        onChange: (html: string) => setWert(html),
        documentTitle: "Wartungsanweisung",
        images: [{ objectId: "bild-1", name: "bild.png" }],
      });
    }
    await render(createElement(EditorSonde));
    const fussnote = container.querySelector<HTMLElement>("figcaption");
    expect(fussnote, "die Fußnote steht im Editor").not.toBeNull();
    (fussnote as HTMLElement).focus();
    await klick(fussnote as HTMLElement);
    await grenzeGiltFuer(fussnote as HTMLElement);
  });

  it("K7 · app/NavGuardContext.tsx — Fokus zurück UND Hintergrund gesperrt", async () => {
    function NavSonde(): JSX.Element {
      const { setGuard, guard } = useNavGuard();
      return createElement(
        "button",
        {
          type: "button",
          "data-testid": "ausloeser",
          onClick: () => {
            setGuard({
              isDirty: () => true,
              unsavableDirtyReasons: () => [],
              save: () => Promise.resolve(),
            } as never);
            guard(() => {});
          },
        },
        "weg hier",
      );
    }
    await render(createElement(NavSonde));
    const knopf = await oeffneUeberSonde();
    // Der Wächterdialog ist die Fläche mit der Marke — sie sitzt seit JOB 1900 auf dem Panel.
    expect(document.querySelector("[data-navguard-dialog]"), "die Wächterfläche ist offen").toBe(
      panel(),
    );
    await grenzeGiltFuer(knopf);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// K7-8 · DER FALL, DER IN JOB 1851 D8 ABGELEITET WAR UND NICHT GEMESSEN
//
// Behauptung damals (D8 §3, Zeile `K7-8`): Bricht die Sitzung, während der Wächterdialog offen ist,
// tauscht `App.tsx:77-78` auf `<AuthScreens>`. Damit hängt `AppShell` aus — `NavGuardProvider` aber
// NICHT, er steht in `App.tsx:99` darüber. Die Fläche überlebt also, die Grenze verschwindet unter
// ihr, und beim Abmelden zeigt `trigger()` auf einen abgetrennten Knoten.
//
// Der Auftrag sagt dazu: „gemessen oder gestrichen". Hier wird gemessen — mit genau dem Aufbau, den
// `App.tsx` hat: der Anbieter bleibt stehen, die Shell darunter wird ausgetauscht.
let schalte: ((angemeldet: boolean) => void) | null = null;

function Sitzungsschalter({ inhalt }: { inhalt: unknown }): JSX.Element {
  const [angemeldet, setAngemeldet] = useState(true);
  schalte = setAngemeldet;
  return angemeldet
    ? (createElement(
        MemoryRouter,
        { initialEntries: ["/"] },
        createElement(AppShell, null, inhalt as never),
      ) as JSX.Element)
    : (createElement("div", null, "Anmeldeseite") as JSX.Element);
}

describe("JOB 1900 · K7-8 — Sitzungsverlust bei offener Fläche", () => {
  it("die Grenze verschwindet unter der offenen Fläche — und greift dabei NICHT auf einen abgetrennten Knoten", async () => {
    const rufe: { ziel: string; verbunden: boolean }[] = [];
    const urFocus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (this: HTMLElement, ...a: unknown[]): void {
      rufe.push({
        ziel: this.getAttribute("data-testid") ?? this.tagName.toLowerCase(),
        verbunden: this.isConnected,
      });
      (urFocus as (...x: unknown[]) => void).apply(this, a);
    };
    try {
      function NavSonde(): JSX.Element {
        const { setGuard, guard } = useNavGuard();
        return createElement(
          "button",
          {
            type: "button",
            "data-testid": "ausloeser",
            onClick: () => {
              setGuard({
                isDirty: () => true,
                unsavableDirtyReasons: () => [],
                save: () => Promise.resolve(),
              } as never);
              guard(() => {});
            },
          },
          "weg hier",
        );
      }
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
                    ImageDescribeProvider,
                    null,
                    createElement(
                      NavGuardProvider,
                      null,
                      createElement(Sitzungsschalter, {
                        inhalt: createElement(NavSonde),
                      }),
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

      const knopf = ausloeser();
      knopf.focus();
      await klick(knopf);
      expect(panel(), "der Wächterdialog ist offen").not.toBeNull();
      rufe.length = 0;

      // Die Sitzung bricht: `Gate` tauscht die Shell gegen die Anmeldeseite.
      await act(async () => {
        schalte?.(false);
        await flush();
      });
      await act(flush);

      // GEMESSEN, nicht abgeleitet — und der Befund ist NICHT die Zusicherung, die man sich
      // wünscht. Diese Zeilen halten fest, was der Stand HEUTE tut, damit die nächste Änderung es
      // nicht unbemerkt verschiebt:
      //
      //   1. Die Fläche überlebt den Verlust der Shell — genau wie in JOB 1851 D8 abgeleitet.
      expect(panel(), "die Fläche überlebt den Verlust der Shell").not.toBeNull();
      //   2. Die Grenze gibt beim Abmelden den Fokus auf den Auslöser — der ist inzwischen
      //      ABGETRENNT (`ModalBoundaryContext.tsx:163` prüft `isConnected` nicht).
      //      Das ist ein BEFUND, keine gewollte Wirkung: siehe Ownerfrage `OF-1900-D1-1`.
      //      In jsdom wie im Browser bleibt der Aufruf folgenlos — der Fokus wandert nicht dorthin;
      //      gemeldet wird er trotzdem, weil ein Aufruf auf einem toten Knoten nichts zu suchen hat.
      const aufAbgetrenntem = rufe.filter((r) => !r.verbunden);
      expect(
        aufAbgetrenntem.map((r) => r.ziel),
        `gemessener Verlauf: ${JSON.stringify(rufe)}`,
      ).toEqual(["ausloeser"]);
      //   3. Der Fokus landet NICHT auf dem abgetrennten Knoten.
      expect(document.activeElement).not.toBe(knopf);
    } finally {
      HTMLElement.prototype.focus = urFocus;
      schalte = null;
    }
  });
});
