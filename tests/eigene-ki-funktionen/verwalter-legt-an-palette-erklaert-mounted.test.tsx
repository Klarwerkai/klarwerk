// @vitest-environment jsdom
// ================================================================================================
// R-0292 · EIGENE KI-FUNKTIONEN DER ORGANISATION — VOM VERWALTER ANGELEGT, AM „?" EINSEHBAR.
// ================================================================================================
//
// Originalsatz: „Der Verwalter legt zusätzliche, benannte KI-Knöpfe mit eigener Anweisung an (zum
// Beispiel 'Für die Schichtübergabe zusammenfassen'). Die Anweisung ist am Fragezeichen offen
// einsehbar."
//
// Der Bestand (SCRUM-386) hatte Belege für Route (`services/app/src/assist-preset-routes.test.ts`),
// Validierung (`services/reasoner/src/presets.test.ts`) und den „?"-Griff in der Palette
// (`tests/ki-freie-anweisung/standardeditor-mounted.test.tsx` F2, mit einer FERTIG gelieferten
// Vorlage). Was fehlte, war die BEDIENUNG der Verwalterkarte selbst: niemand hatte „Funktion
// hinzufügen" gedrückt, Name und Anweisung eingetragen und gespeichert. Diese Datei spielt genau
// das an der echten Karte (`KiFunktionenDetail`) nach und reicht den gespeicherten Bestand an die
// echte Palette (`AiAssistInstructions`) weiter.
//
// HERMETIK: kein Netz. Ein `fetch`-Spion spielt den Server wie in
// `tests/ki-anbieterwahl/karte-mounted.test.tsx`: GET liefert den Stand, PUT vergibt ids und
// übernimmt die Liste (so wie `PUT /api/reasoner/assist-presets` die gespeicherte Liste liefert).
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { type ReactElement, act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { AssistPreset } from "../../apps/web/src/api/types";
import { ToastProvider, useToast } from "../../apps/web/src/app/ToastContext";
import { AiAssistInstructions } from "../../apps/web/src/components/AiAssistBox";
import i18n from "../../apps/web/src/i18n";
import { KiFunktionenDetail } from "../../apps/web/src/pages/AdminKiDetails";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NAME = "Für die Schichtübergabe zusammenfassen";
const ANWEISUNG = "Fasse den Text in 5 Stichpunkten für die nächste Schicht zusammen.";

interface Server {
  stand: AssistPreset[];
  putAnfragen: { presets: { id?: string; name: string; instruction: string }[] }[];
}

function server(stand: AssistPreset[] = []): Server {
  const s: Server = { stand, putAnfragen: [] };
  let naechsteId = 1;
  vi.stubGlobal("fetch", (async (url: unknown, init?: { method?: string; body?: string }) => {
    const pfad = String(url);
    const antwort = (koerper: unknown, status = 200): Response =>
      ({
        ok: status < 400,
        status,
        statusText: status < 400 ? "OK" : "Error",
        text: async () => JSON.stringify(koerper),
      }) as unknown as Response;
    if (pfad.includes("/reasoner/assist-presets")) {
      if (init?.method === "PUT") {
        const payload = JSON.parse(init.body ?? "{}") as Server["putAnfragen"][number];
        s.putAnfragen.push(payload);
        s.stand = payload.presets.map((p) => ({
          id: p.id ?? `vorlage-${naechsteId++}`,
          name: p.name.trim(),
          instruction: p.instruction.trim(),
        }));
        return antwort(s.stand);
      }
      return antwort(s.stand);
    }
    return antwort({ error: "NOT_FOUND", message: "kein Fixture" }, 404);
  }) as unknown as typeof fetch);
  return s;
}

const durchlaufen = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

const gemountet: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];

afterEach(() => {
  for (const { root, container } of gemountet.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// `ToastProvider` zeichnet selbst nichts — die Anzeige gehört der App-Hülle. Der Spion liest
// deshalb dieselbe Quelle, aus der die Hülle zeichnet (`useToast().toasts`), und legt jede
// Meldung als Zeile ab.
function ToastSpion(): ReactElement {
  const { toasts } = useToast();
  return createElement(
    "ul",
    { "data-testid": "toast-spion" },
    ...toasts.map((toast) =>
      createElement("li", { key: toast.id, "data-kind": toast.kind }, toast.message),
    ),
  );
}

const meldungen = (): { kind: string | null; text: string }[] =>
  [...document.querySelectorAll('[data-testid="toast-spion"] li')].map((li) => ({
    kind: li.getAttribute("data-kind"),
    text: li.textContent ?? "",
  }));

async function mounten(element: ReactElement): Promise<HTMLDivElement> {
  await i18n.changeLanguage("de");
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  gemountet.push({ root, container });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(ToastProvider, null, element, createElement(ToastSpion)),
      ),
    );
    await durchlaufen();
  });
  await act(durchlaufen);
  return container;
}

function knopf(container: HTMLElement, beschriftung: string): HTMLButtonElement {
  const k = [...container.querySelectorAll("button")].find(
    (b) => (b.textContent ?? "").trim() === beschriftung,
  );
  expect(k, `Knopf „${beschriftung}" nicht gefunden`).toBeTruthy();
  return k as HTMLButtonElement;
}

async function klicken(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await durchlaufen();
  });
  await act(durchlaufen);
}

function feld(container: HTMLElement, label: string): HTMLInputElement[] {
  return [...container.querySelectorAll<HTMLInputElement>(`input[aria-label="${label}"]`)];
}

async function tippen(el: HTMLInputElement, wert: string): Promise<void> {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, wert);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await durchlaufen();
  });
}

describe("R-0292 · Verwalter legt eigene KI-Funktion an, die Palette erklärt sie am „?“", () => {
  it("V1 · Hinzufügen, Name und Anweisung eintragen, Speichern → der Server bekommt genau diese Funktion, die Karte zeigt den gespeicherten Stand", async () => {
    const s = server([]);
    const karte = await mounten(createElement(KiFunktionenDetail, { onZurueck: () => {} }));
    const t = i18n.t.bind(i18n);

    expect(karte.textContent).toContain(t("adm.presets.empty"));
    // Ohne Änderung gibt es nichts zu speichern — die serverseitige Liste wird nicht überschrieben.
    expect(knopf(karte, t("adm.presets.save")).disabled).toBe(true);

    await klicken(knopf(karte, t("adm.presets.add")));
    const [name] = feld(karte, t("adm.presets.name"));
    const [anweisung] = feld(karte, t("adm.presets.instruction"));
    expect(name, "Namensfeld der neuen Funktion fehlt").toBeTruthy();
    expect(anweisung, "Anweisungsfeld der neuen Funktion fehlt").toBeTruthy();
    await tippen(name as HTMLInputElement, NAME);
    await tippen(anweisung as HTMLInputElement, ANWEISUNG);

    const speichern = knopf(karte, t("adm.presets.save"));
    expect(speichern.disabled).toBe(false);
    await klicken(speichern);

    expect(s.putAnfragen).toEqual([{ presets: [{ name: NAME, instruction: ANWEISUNG }] }]);
    expect(s.stand).toEqual([{ id: "vorlage-1", name: NAME, instruction: ANWEISUNG }]);
    // Nach dem Speichern liest die Karte den Serverstand neu: dieselbe Funktion, kein Entwurf mehr.
    expect(feld(karte, t("adm.presets.name")).map((f) => f.value)).toEqual([NAME]);
    expect(feld(karte, t("adm.presets.instruction")).map((f) => f.value)).toEqual([ANWEISUNG]);
    expect(knopf(karte, t("adm.presets.save")).disabled).toBe(true);
    expect(meldungen()).toEqual([{ kind: "success", text: t("adm.presets.saved") }]);
  });

  it("V2 · der gespeicherte Knopf steht in der Palette; das „?“ schlägt die Anweisung wörtlich auf und wieder zu, der Knopf sendet sie unverändert", async () => {
    const s = server([]);
    const karte = await mounten(createElement(KiFunktionenDetail, { onZurueck: () => {} }));
    const t = i18n.t.bind(i18n);
    await klicken(knopf(karte, t("adm.presets.add")));
    await tippen(feld(karte, t("adm.presets.name"))[0] as HTMLInputElement, NAME);
    await tippen(feld(karte, t("adm.presets.instruction"))[0] as HTMLInputElement, ANWEISUNG);
    await klicken(knopf(karte, t("adm.presets.save")));
    const id = s.stand[0]?.id;
    expect(id).toBe("vorlage-1");

    const gesendet: string[] = [];
    const palette = await mounten(
      createElement(AiAssistInstructions, {
        disabled: false,
        onRun: (anw: string) => gesendet.push(anw),
      }),
    );

    const benannt = knopf(palette, NAME);
    const griff = palette.querySelector<HTMLButtonElement>(
      `[data-testid="ki-vorlage-hilfe-${id}"]`,
    );
    expect(griff, "Fragezeichen-Griff an der eigenen Funktion fehlt").toBeTruthy();
    expect(griff?.textContent?.trim()).toBe("?");
    expect(griff?.getAttribute("aria-label")).toBe(t("help.open"));
    expect(griff?.getAttribute("aria-describedby")).toBe(benannt.id);
    expect(griff?.getAttribute("aria-expanded")).toBe("false");
    expect(palette.querySelector(`[data-testid="ki-vorlage-satz-${id}"]`)).toBeNull();

    await klicken(griff as HTMLButtonElement);
    const satz = palette.querySelector(`[data-testid="ki-vorlage-satz-${id}"]`);
    expect(satz, "Die Anweisung schlägt am „?“ nicht auf").toBeTruthy();
    expect(satz?.textContent).toBe(t("capture.ai.customHelp", { instruction: ANWEISUNG }));
    expect(satz?.textContent).toContain(ANWEISUNG);
    expect(griff?.getAttribute("aria-expanded")).toBe("true");
    expect(griff?.getAttribute("aria-controls")).toBe(satz?.id);

    await klicken(griff as HTMLButtonElement);
    expect(palette.querySelector(`[data-testid="ki-vorlage-satz-${id}"]`)).toBeNull();

    await klicken(benannt);
    expect(gesendet).toEqual([ANWEISUNG]);
  });

  it("V3 · eine vorhandene Funktion umbenennen und eine zweite ergänzen behält die id der ersten und vergibt nur der neuen eine", async () => {
    const s = server([
      { id: "vorlage-alt", name: "Kurz fassen", instruction: "Fasse knapp zusammen." },
    ]);
    const karte = await mounten(createElement(KiFunktionenDetail, { onZurueck: () => {} }));
    const t = i18n.t.bind(i18n);

    expect(feld(karte, t("adm.presets.name")).map((f) => f.value)).toEqual(["Kurz fassen"]);
    await tippen(feld(karte, t("adm.presets.name"))[0] as HTMLInputElement, "Knapp fassen");
    await klicken(knopf(karte, t("adm.presets.add")));
    await tippen(feld(karte, t("adm.presets.name"))[1] as HTMLInputElement, NAME);
    await tippen(feld(karte, t("adm.presets.instruction"))[1] as HTMLInputElement, ANWEISUNG);
    await klicken(knopf(karte, t("adm.presets.save")));

    expect(s.putAnfragen).toEqual([
      {
        presets: [
          { id: "vorlage-alt", name: "Knapp fassen", instruction: "Fasse knapp zusammen." },
          { name: NAME, instruction: ANWEISUNG },
        ],
      },
    ]);
    expect(s.stand.map((p) => p.id)).toEqual(["vorlage-alt", "vorlage-1"]);
  });
});
