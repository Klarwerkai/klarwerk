// @vitest-environment jsdom
// ==================================================================================================
// JOB 3196 · UX-19 — DIE ANLEITUNG SAGT, WAS DER GEWÄHLTE IMPORTWEG WIRKLICH TUT.
// ==================================================================================================
//
// Ausgangslage (am lebenden System belegt, `gespraech/nutzerpruefung/belege/
// 2026-09-06T02-45-34-integrationen/24-ganzes-dokument.json:8`): „Ganzes Dokument übernehmen“ ist
// `[pressed]` — und DARUNTER steht Wort für Wort die Anleitung des Punkte-Wegs („Du wählst aus, was
// übernommen wird"). `Capture.tsx` rendert dort einen FESTEN Schlüssel (`CAPTURE_FILE_TEXT.hint`),
// ohne jede Abhängigkeit von `fileImportMode`. Derselbe Fehler wiederholt sich in der
// Einlese-Quittung („… und starte die Wissenssuche“, Beleg 26) und im Erfolgskasten, der den nackten
// Entwickler-String „Frontdoor bereit“ trägt — unübersetzt, in jeder Sprache gleich.
//
// Diese Datei fährt den ECHTEN Klickpfad auf der gemounteten Erfassen-Fläche: Modus wählen, Datei
// einlesen, Entwurf speichern. Kein Quelltext-Pin — geprüft wird, was ein Mensch liest.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const draftId = vi.hoisted(() => ({ wert: "d-42" as string | null }));

/**
 * JOB 3196 R2 — DIE BREMSE FÜR DAS EINLESEN.
 *
 * bens erste Gegenprobe braucht einen Zustand, den ein `.txt` von 240 Zeichen nie erreicht: eine
 * Extraktion, die LÄUFT, während der Mensch die Importart wechselt. Im Betrieb ist das der
 * Regelfall bei PDF, PPTX und grossen DOCX — dort vergehen Sekunden. Statt eine solche Datei
 * nachzubauen (und damit halb den Extraktor zu testen), wird der EINE Lesevorgang angehalten:
 * `readTextFile` ist die Stelle, an der `onExtractFile` auf die Datei wartet.
 *
 * Standardmässig ist die Bremse offen — alle übrigen Fälle laufen unverändert durch.
 */
const bremse = vi.hoisted(() => ({
  aktiv: false,
  loesen: null as null | (() => void),
}));

vi.mock("../../apps/web/src/lib/files", async (importActual) => {
  const echt = await importActual<typeof import("../../apps/web/src/lib/files")>();
  return {
    ...echt,
    readTextFile: async (f: File): Promise<string> => {
      if (bremse.aktiv) {
        await new Promise<void>((auf) => {
          bremse.loesen = auf;
        });
      }
      return echt.readTextFile(f);
    },
  };
});

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: {
        policy: vi.fn(async () => ({ stage: "search_on_click" })),
        search: vi.fn(async () => []),
      },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      objects: {
        upload: vi.fn(async () => ({ id: "obj-1", name: "NUTZERPRUEFUNG.txt" })),
      },
      drafts: {
        list: ok([]),
        // Die Antwort hat die Form, die `draftTitle` (lib/draftForm.ts:41) liest: Titel im `payload`.
        create: vi.fn(async (payload: { title?: string }) => ({
          ...(draftId.wert === null ? {} : { id: draftId.wert }),
          payload: { title: payload.title ?? "NUTZERPRUEFUNG.txt" },
        })),
        update: vi.fn(async () => ({})),
        remove: vi.fn(async () => {}),
        promote: vi.fn(async () => ({})),
      },
      reasoner: {
        status: ok({ active: false, mode: "cloud", reachable: "inactive" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
        interview: vi.fn(async () => ({ question: "", done: true, demo: false })),
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
import { CAPTURE_FILE_TEXT } from "../../apps/web/src/lib/captureFromFile";
import { CAPTURE_FRONT_DOOR_ROUTE } from "../../apps/web/src/lib/captureFrontDoor";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};
// jsdom kennt `crypto.randomUUID` nicht (kein sicherer Kontext) — dieselbe Bühnen-Lücke, die
// `tests/design/h3-blatt-buehne.ts:41-43` beschreibt. Die Erfolgsmeldung des Speicherwegs
// (`app/ToastContext.tsx:36`) ruft sie; ohne diesen Ersatz stürbe JEDER Schreibweg an der Bühne,
// nicht am Produkt.
if (typeof (globalThis.crypto as { randomUUID?: unknown } | undefined)?.randomUUID !== "function") {
  let n = 0;
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  });
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
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
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: ["/erfassen"] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/erfassen",
                      // Genau der Weg, den das Blatt geht: es öffnet den Arbeitsraum im Modus
                      // „Aus Datei“ (JOB 3062 · H3).
                      element: createElement(CaptureArbeitsraum, { modus: "datei" }),
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

function pageText(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

/**
 * Alles, was ein Mensch LESEN kann — sichtbarer Text plus die vorgelesenen Attribute (title,
 * aria-label, alt, placeholder). Bewusst NICHT das rohe `innerHTML`: die technische Adresse
 * `CAPTURE_FRONT_DOOR_ROUTE` (`/capture/frontdoor`) steht im `href` des Öffnen-Wegs und BLEIBT dort
 * — sie ist der bestehende Weg aus UX-01/3106 und ausdrücklich nicht Gegenstand dieses Auftrags.
 * Verschwinden muss das Wort aus dem, was jemand liest.
 */
function lesbarerText(): string {
  const attrs = [...container.querySelectorAll("*")].flatMap((el) =>
    ["title", "aria-label", "alt", "placeholder"].map((a) => el.getAttribute(a) ?? ""),
  );
  return `${pageText()} ${attrs.join(" ")}`;
}

function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${part}“ nicht gefunden`);
  }
  return btn;
}

/** Die Auswahlkarte einer Importart — eine echte `aria-pressed`-Fläche (ChoiceCards). */
function modusKarte(labelKey: string): HTMLButtonElement {
  const label = i18n.t(labelKey);
  const btn = [...container.querySelectorAll<HTMLButtonElement>("button[aria-pressed]")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(label),
  );
  if (!btn) {
    throw new Error(`Importart-Karte „${label}“ nicht gefunden`);
  }
  return btn;
}

async function click(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
}

/** Datei über die bestehende Ablagefläche einlesen — derselbe Seam wie der versteckte Eingang. */
async function dateiEinlesen(name = "NUTZERPRUEFUNG.txt", inhalt = "A".repeat(240)): Promise<void> {
  const zone = container.querySelector<HTMLElement>("[data-testid=capture-dropzone]");
  if (!zone) {
    throw new Error("Ablagefläche nicht gefunden");
  }
  const file = new File([inhalt], name, { type: "text/plain" });
  const ev = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "dataTransfer", { value: { files: [file] } });
  await act(async () => {
    zone.dispatchEvent(ev);
    await flush();
  });
}

function txt(key: string, params?: Record<string, unknown>): string {
  return String(i18n.t(key, params ?? {})).replace(/\s+/g, " ");
}

/** Startet das Einlesen, OHNE auf sein Ende zu warten — die Bremse hält es an. */
async function dateiEinlesenStarten(name = "NUTZERPRUEFUNG.txt", inhalt = "A".repeat(240)) {
  bremse.aktiv = true;
  bremse.loesen = null;
  await dateiEinlesen(name, inhalt);
  if (bremse.loesen === null) {
    throw new Error("Die Bremse hat nicht gegriffen — das Einlesen war schon fertig.");
  }
}

/** Lässt das angehaltene Einlesen zu Ende laufen. */
async function dateiEinlesenBeenden(): Promise<void> {
  const loesen = bremse.loesen;
  bremse.aktiv = false;
  bremse.loesen = null;
  await act(async () => {
    loesen?.();
    await flush();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  draftId.wert = "d-42";
  bremse.aktiv = false;
  bremse.loesen = null;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
  bremse.aktiv = false;
  bremse.loesen = null;
});

describe("UX-19 · die Anleitung unter den Auswahlkarten folgt der gewählten Importart", () => {
  it("A1 — nach „Ganzes Dokument übernehmen“ steht die Ganzdokument-Anleitung da, NICHT die des Punkte-Wegs", async () => {
    await mount();
    await click(modusKarte(CAPTURE_FILE_TEXT.importModeWhole));

    expect(modusKarte(CAPTURE_FILE_TEXT.importModeWhole).getAttribute("aria-pressed")).toBe("true");
    const text = pageText();
    // Der Satz des abgewählten Wegs ist weg …
    expect(text).not.toContain(txt(CAPTURE_FILE_TEXT.hint));
    // … und an seiner Stelle steht der Weg, der wirklich läuft.
    expect(text).toContain(txt(CAPTURE_FILE_TEXT.hintWhole));
  });

  it("A2 — im Punkte-Modus bleibt der heutige Satz Zeichen für Zeichen stehen (Schutz gegen Vertauschen)", async () => {
    await mount();

    expect(modusKarte(CAPTURE_FILE_TEXT.importModePoints).getAttribute("aria-pressed")).toBe(
      "true",
    );
    const text = pageText();
    expect(text).toContain(txt(CAPTURE_FILE_TEXT.hint));
    expect(text).not.toContain(txt(CAPTURE_FILE_TEXT.hintWhole));
  });

  it("A3 — die Einlese-Quittung im Ganzdokument-Modus fordert NICHT zur Wissenssuche auf", async () => {
    await mount();
    await click(modusKarte(CAPTURE_FILE_TEXT.importModeWhole));
    await dateiEinlesen();

    const text = pageText();
    expect(text).toContain(
      txt(CAPTURE_FILE_TEXT.loadedStatsWhole, { name: "NUTZERPRUEFUNG.txt", chars: 240 }),
    );
    expect(text).not.toContain(
      txt(CAPTURE_FILE_TEXT.loadedStats, { name: "NUTZERPRUEFUNG.txt", chars: 240 }),
    );
    // Die Quittung des Punkte-Wegs endet mit der Aufforderung zur Wissenssuche — genau der Satz,
    // den der Ganzdokument-Weg gar nicht anbietet (der Suchauftrag-Block hängt an `points`).
    expect(text).not.toContain("starte die Wissenssuche");
  });

  it("A3b — im Punkte-Modus bleibt die heutige Quittung samt Wissenssuche-Hinweis stehen", async () => {
    await mount();
    await dateiEinlesen();

    const text = pageText();
    expect(text).toContain(
      txt(CAPTURE_FILE_TEXT.loadedStats, { name: "NUTZERPRUEFUNG.txt", chars: 240 }),
    );
    expect(text).not.toContain(
      txt(CAPTURE_FILE_TEXT.loadedStatsWhole, { name: "NUTZERPRUEFUNG.txt", chars: 240 }),
    );
  });

  it("A4 — der Erfolgskasten sagt in Alltagssprache, was entstanden ist; das Wort „Frontdoor“ steht nirgends", async () => {
    await mount();
    await click(modusKarte(CAPTURE_FILE_TEXT.importModeWhole));
    await dateiEinlesen();
    await click(buttonByText(txt(CAPTURE_FILE_TEXT.wholeCta)));

    const text = pageText();
    // Die Erfolgsaussage ist DA — der Mensch verliert die Rückmeldung nicht.
    expect(text).toContain(txt(CAPTURE_FILE_TEXT.wholeSavedTitle));
    expect(text).toContain(txt(CAPTURE_FILE_TEXT.wholeSavedBadge));
    // Und der Entwickler-Begriff ist weg — im ganzen gerenderten Baum, nicht nur an einer Stelle.
    expect(lesbarerText()).not.toMatch(/frontdoor/i);
    // Der bestehende Weg „Entwurf öffnen“ (UX-01/3106) bleibt unangetastet: derselbe GuardedLink
    // auf dieselbe Zieladresse.
    const link = [...container.querySelectorAll("a")].find((a) =>
      (a.textContent ?? "").includes(txt(CAPTURE_FILE_TEXT.wholeOpenDraft)),
    );
    expect(link?.getAttribute("href")).toBe(`${CAPTURE_FRONT_DOOR_ROUTE}?draft=d-42`);
  });

  it("A4b — ohne Entwurfs-Id bleibt die ehrliche Ersatzmeldung stehen (kein toter Öffnen-Knopf)", async () => {
    draftId.wert = null;
    await mount();
    await click(modusKarte(CAPTURE_FILE_TEXT.importModeWhole));
    await dateiEinlesen();
    await click(buttonByText(txt(CAPTURE_FILE_TEXT.wholeCta)));

    const text = pageText();
    expect(text).toContain(txt(CAPTURE_FILE_TEXT.wholeOpenMissing));
    expect(text).not.toContain(txt(CAPTURE_FILE_TEXT.wholeOpenDraft));
    expect(lesbarerText()).not.toMatch(/frontdoor/i);
  });

  it("A5 — auf Englisch stehen Anleitung, Quittung und Erfolgstext auf Englisch: kein Schlüsselname, kein deutscher Rückfall", async () => {
    await i18n.changeLanguage("en");
    await mount();
    await click(modusKarte(CAPTURE_FILE_TEXT.importModeWhole));

    const anleitung = txt(CAPTURE_FILE_TEXT.hintWhole);
    expect(anleitung).not.toBe(CAPTURE_FILE_TEXT.hintWhole);
    expect(anleitung).not.toBe(
      String(i18n.getResource("de", "translation", CAPTURE_FILE_TEXT.hintWhole)),
    );
    expect(pageText()).toContain(anleitung);

    await dateiEinlesen();
    const quittung = txt(CAPTURE_FILE_TEXT.loadedStatsWhole, {
      name: "NUTZERPRUEFUNG.txt",
      chars: 240,
    });
    expect(quittung).not.toBe(CAPTURE_FILE_TEXT.loadedStatsWhole);
    expect(pageText()).toContain(quittung);

    await click(buttonByText(txt(CAPTURE_FILE_TEXT.wholeCta)));
    const badge = txt(CAPTURE_FILE_TEXT.wholeSavedBadge);
    expect(badge).not.toBe(CAPTURE_FILE_TEXT.wholeSavedBadge);
    expect(badge).not.toBe(
      String(i18n.getResource("de", "translation", CAPTURE_FILE_TEXT.wholeSavedBadge)),
    );
    expect(pageText()).toContain(badge);
    expect(lesbarerText()).not.toMatch(/frontdoor/i);
  });

  it("A5b — jeder neue Satz steht in ALLEN geführten Sprachen (DE/EN/NL), keiner fällt auf Deutsch zurück", () => {
    const sprachen = ["de", "en", "nl"] as const;
    const neu = [
      CAPTURE_FILE_TEXT.hintWhole,
      CAPTURE_FILE_TEXT.loadedStatsWhole,
      CAPTURE_FILE_TEXT.wholeSavedBadge,
    ];
    for (const key of neu) {
      const werte = sprachen.map((lng) => String(i18n.getResource(lng, "translation", key) ?? ""));
      for (const [i, wert] of werte.entries()) {
        expect(wert.length, `${sprachen[i]}:${key}`).toBeGreaterThan(0);
      }
      // EN und NL sind eigene Sätze, keine Kopie des deutschen.
      expect(werte[1], `en≠de:${key}`).not.toBe(werte[0]);
      expect(werte[2], `nl≠de:${key}`).not.toBe(werte[0]);
    }
    // Der Zeichenumfang der Quittung bleibt erhalten: Name und Zeichenzahl stehen weiter drin.
    for (const lng of sprachen) {
      const wert = String(i18n.getResource(lng, "translation", CAPTURE_FILE_TEXT.loadedStatsWhole));
      expect(wert, `${lng}:{{name}}`).toContain("{{name}}");
      expect(wert, `${lng}:{{chars}}`).toContain("{{chars}}");
    }
  });

  // ================================================================================================
  // A6 — DIE TASTATUR-VORAUSSETZUNG. DIE TASTEN SELBST DRÜCKT DER BROWSER-TEST.
  // ================================================================================================
  // In Runde 1 stand hier ein `MouseEvent("click")` und darüber das Wort „Tastatur". ben hat das
  // zu Recht beanstandet: ein Mausereignis beweist nichts über Tab, Enter oder die Leertaste.
  //
  // Gemessen, warum es in dieser Bühne auch nicht anders ginge (Sonde 07.09., jsdom 25):
  // `keydown` „Enter" und „ " auf einem `<button>` lösen NULL Klicks aus, `keydown` „Tab" bewegt
  // den Fokus nicht. jsdom führt die Standardaktion des User-Agents nicht aus — dieselbe Grenze,
  // die `tests/app/mobile-drawer-keyboard-reach-mounted.test.tsx:10-17` benennt.
  //
  // Deshalb ist die Arbeit geteilt, und beide Hälften sind echt:
  //   · HIER die Voraussetzung, die im Browser über Erreichbarkeit entscheidet — ein echtes,
  //     nicht deaktiviertes `<button type="button"]` ohne `tabindex="-1"`, das den Fokus annimmt.
  //     Ein `<div onClick>` oder ein `tabindex="-1"` liesse diesen Fall sofort scheitern.
  //   · Die TASTEN in `tastatur-importart-chromium.test.ts`: dort drückt Playwright Tab, Enter,
  //     Shift+Tab und die Leertaste an der echten gebauten Seite, und Chromium löst aus.
  it("A6 — die Auswahlkarte ist eine echte, fokussierbare Schaltfläche (die Tasten selbst drückt der Chromium-Test)", async () => {
    await mount();
    const karte = modusKarte(CAPTURE_FILE_TEXT.importModeWhole);

    expect(karte.tagName).toBe("BUTTON");
    expect(karte.getAttribute("type")).toBe("button");
    expect(karte.disabled).toBe(false);
    expect(karte.getAttribute("tabindex")).toBeNull();

    karte.focus();
    expect(document.activeElement).toBe(karte);

    // KALIBRIERUNG der Bühne, damit die Arbeitsteilung oben nachprüfbar ist und nicht behauptet:
    // ein echter Tastendruck bewirkt in jsdom nichts. Wird das eines Tages falsch, ist dieser Fall
    // rot — und der Tastaturtest gehört wieder hierher.
    let klicks = 0;
    karte.addEventListener("click", () => {
      klicks++;
    });
    await act(async () => {
      for (const key of ["Enter", " "]) {
        karte.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
        karte.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true }));
      }
      await flush();
    });
    expect(klicks, "jsdom führt jetzt doch die Standardaktion aus — Test hierher zurückholen").toBe(
      0,
    );
    expect(pageText()).toContain(txt(CAPTURE_FILE_TEXT.hint));
  });

  it("A7 — ein Moduswechsel NACH dem Einlesen führt Anleitung UND Quittung mit (in beide Richtungen)", async () => {
    await mount();
    await dateiEinlesen();
    // Nach dem Einlesen im Punkte-Modus: heutiger Satz, heutige Quittung.
    expect(pageText()).toContain(
      txt(CAPTURE_FILE_TEXT.loadedStats, { name: "NUTZERPRUEFUNG.txt", chars: 240 }),
    );

    await click(modusKarte(CAPTURE_FILE_TEXT.importModeWhole));
    let text = pageText();
    expect(text).toContain(txt(CAPTURE_FILE_TEXT.hintWhole));
    expect(text).toContain(
      txt(CAPTURE_FILE_TEXT.loadedStatsWhole, { name: "NUTZERPRUEFUNG.txt", chars: 240 }),
    );
    expect(text).not.toContain("starte die Wissenssuche");

    await click(modusKarte(CAPTURE_FILE_TEXT.importModePoints));
    text = pageText();
    expect(text).toContain(txt(CAPTURE_FILE_TEXT.hint));
    expect(text).toContain(
      txt(CAPTURE_FILE_TEXT.loadedStats, { name: "NUTZERPRUEFUNG.txt", chars: 240 }),
    );
  });

  // ================================================================================================
  // B1 / B2 — bens zwei Gegenproben aus der Prüfung von Runde 1, jetzt als Regressionstests.
  // ================================================================================================
  // Beide waren mit dem Stand von Runde 1 ROT. Sie treffen denselben Fehler aus zwei Richtungen:
  // die Quittung lag als FERTIG ÜBERSETZTER Satz im Zustand, gebildet mit der Importart vom START
  // des Lesevorgangs. B1 zeigt die Modus-Seite (Wechsel WÄHREND des Lesens), B2 die Sprach-Seite.

  it("B1 — ein Moduswechsel WÄHREND des Einlesens gilt: die Quittung folgt der Art, die am Ende gewählt ist", async () => {
    await mount();
    // Das Einlesen läuft — und hält an der Bremse. Genau der Zustand, in dem ein Mensch bei PDF,
    // PPTX oder grossem DOCX Zeit hat, es sich anders zu überlegen.
    await dateiEinlesenStarten();
    expect(pageText()).toContain(txt(CAPTURE_FILE_TEXT.extracting, { name: "NUTZERPRUEFUNG.txt" }));

    // Mitten im laufenden Vorgang auf „Ganzes Dokument übernehmen" wechseln.
    await click(modusKarte(CAPTURE_FILE_TEXT.importModeWhole));
    await dateiEinlesenBeenden();

    const text = pageText();
    expect(text).toContain(txt(CAPTURE_FILE_TEXT.hintWhole));
    expect(text).toContain(
      txt(CAPTURE_FILE_TEXT.loadedStatsWhole, { name: "NUTZERPRUEFUNG.txt", chars: 240 }),
    );
    // Der Satz des abgewählten Wegs steht nirgends — weder als Anleitung noch als Quittung.
    expect(text).not.toContain("starte die Wissenssuche");
    expect(text).not.toContain(
      txt(CAPTURE_FILE_TEXT.loadedStats, { name: "NUTZERPRUEFUNG.txt", chars: 240 }),
    );
  });

  it("B1b — und in der Gegenrichtung: wer während des Einlesens zurück auf „In Punkte analysieren“ wechselt, bekommt den Punkte-Satz", async () => {
    await mount();
    await click(modusKarte(CAPTURE_FILE_TEXT.importModeWhole));
    await dateiEinlesenStarten();
    await click(modusKarte(CAPTURE_FILE_TEXT.importModePoints));
    await dateiEinlesenBeenden();

    const text = pageText();
    expect(text).toContain(txt(CAPTURE_FILE_TEXT.hint));
    expect(text).toContain(
      txt(CAPTURE_FILE_TEXT.loadedStats, { name: "NUTZERPRUEFUNG.txt", chars: 240 }),
    );
    expect(text).not.toContain(
      txt(CAPTURE_FILE_TEXT.loadedStatsWhole, { name: "NUTZERPRUEFUNG.txt", chars: 240 }),
    );
  });

  it("B2 — nach einem Sprachwechsel steht die Quittung sofort auf Englisch, und ein Moduswechsel danach greift weiterhin", async () => {
    await mount();
    await dateiEinlesen();
    expect(pageText()).toContain(
      txt(CAPTURE_FILE_TEXT.loadedStats, { name: "NUTZERPRUEFUNG.txt", chars: 240 }),
    );

    // DE → EN, mit bereits eingelesener Datei. Die Quittung ist ein Befund, kein alter Satz:
    // sie steht danach in der neuen Sprache da, ohne dass irgendetwas angeklickt wurde.
    const deutscheQuittung = txt(CAPTURE_FILE_TEXT.loadedStats, {
      name: "NUTZERPRUEFUNG.txt",
      chars: 240,
    });
    await act(async () => {
      await i18n.changeLanguage("en");
      await flush();
    });
    expect(pageText()).toContain(
      txt(CAPTURE_FILE_TEXT.loadedStats, { name: "NUTZERPRUEFUNG.txt", chars: 240 }),
    );
    expect(pageText()).not.toContain(deutscheQuittung);

    // Und der Moduswechsel danach greift — genau der Fall, den der Textvergleich in Runde 1 blockierte.
    await click(modusKarte(CAPTURE_FILE_TEXT.importModeWhole));
    const text = pageText();
    expect(text).toContain(txt(CAPTURE_FILE_TEXT.hintWhole));
    expect(text).toContain(
      txt(CAPTURE_FILE_TEXT.loadedStatsWhole, { name: "NUTZERPRUEFUNG.txt", chars: 240 }),
    );
    expect(text).not.toContain(
      txt(CAPTURE_FILE_TEXT.loadedStats, { name: "NUTZERPRUEFUNG.txt", chars: 240 }),
    );
  });

  it("B3 — fremde Meldungen bleiben, was sie sind: ein Moduswechsel belebt keine Einlese-Quittung wieder", async () => {
    await mount();
    await dateiEinlesen();
    // „Abbrechen" räumt den Dateizustand — die Quittung ist damit weg.
    await click(buttonByText(txt(CAPTURE_FILE_TEXT.cancel)));
    expect(pageText()).not.toContain(
      txt(CAPTURE_FILE_TEXT.loadedStats, { name: "NUTZERPRUEFUNG.txt", chars: 240 }),
    );

    // Nach dem Abbruch steht der Arbeitsraum wieder im Erzählmodus; die Quittung darf durch nichts
    // zurückkehren. Gegenprobe für „fremde Fehler-/Erfolgsmeldungen bleiben erhalten".
    const text = pageText();
    expect(text).not.toContain(
      txt(CAPTURE_FILE_TEXT.loadedStatsWhole, { name: "NUTZERPRUEFUNG.txt", chars: 240 }),
    );
  });
});
