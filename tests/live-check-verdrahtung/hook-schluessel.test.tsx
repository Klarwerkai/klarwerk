// @vitest-environment jsdom
// ==================================================================================================
// JOB 3556 R3 · WAS EINE NEUE FRAGE IST — der Schlüssel des Live-Hakens.
// ==================================================================================================
// BEN, Befund 4 (Runde 2): „`draftId` fehlt im Herkunftsschlüssel, obwohl sie die Serverentscheidung
// beeinflusst. Meine Hook-Gegenprobe wechselt ausschließlich A → B: keine zweite Anfrage, weiterhin
// `done`." Und Befund 1: nach erfolgreichem Sichern einer neuen Stufe blieb der alte Befund stehen.
//
// Beides ist DIESELBE Frage: woran erkennt der Haken, dass seine Antwort nicht mehr gilt? Nicht am
// Text allein — der Server entscheidet am ANKER und am GESPEICHERTEN Stand. Hier steht der Haken
// nackt, ohne Blatt: nur er, sein echter Serializer und ein gezählter Transport.
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const zaehler = vi.hoisted(() => ({
  nutzlasten: [] as Record<string, unknown>[],
  antwort: { status: "done", similar: [], conflicts: [] } as
    | Record<string, unknown>
    | Promise<Record<string, unknown>>,
  fehler: null as Error | null,
  renderLagen: [] as string[],
}));

// Nur der Transport ist gestellt; der echte `endpoints.knowledge.check`-Serializer bleibt in Kraft
// (er baut die Nutzlast aus der Herkunft) — gezählt wird, was er wirklich absendet.
vi.mock("../../apps/web/src/api/client", async () => {
  const echt = await vi.importActual<typeof import("../../apps/web/src/api/client")>(
    "../../apps/web/src/api/client",
  );
  return {
    ...echt,
    api: {
      ...echt.api,
      post: vi.fn(async (_pfad: string, body: Record<string, unknown>) => {
        zaehler.nutzlasten.push(body);
        if (zaehler.fehler) throw zaehler.fehler;
        return zaehler.antwort;
      }),
    },
  };
});

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { ReasonerProvenance } from "../../apps/web/src/api/endpoints";
import { useLiveKnowledgeCheck } from "../../apps/web/src/hooks/useLiveKnowledgeCheck";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TEXT = "Bei Kaltstart keine Vorwärmung aktivieren und sichern.";
const DEBOUNCE = 5;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function Sonde(props: {
  text: string;
  herkunft?: ReasonerProvenance;
  stand?: number;
}): JSX.Element {
  const { verdict, checkStatus } = useLiveKnowledgeCheck(
    props.text,
    props.herkunft,
    props.stand,
    DEBOUNCE,
  );
  zaehler.renderLagen.push(`${checkStatus}/${verdict.status}`);
  return createElement("span", { "data-testid": "lage" }, `${checkStatus}/${verdict.status}`);
}

async function zeigen(props: {
  text: string;
  herkunft?: ReasonerProvenance;
  stand?: number;
}): Promise<void> {
  zaehler.renderLagen = [];
  await act(async () => {
    root.render(createElement(Sonde, props));
  });
}

// Nur die virtuelle Uhr löst die Entprellung aus. Kein langsamer Prüfkasten kann sie während
// zeigen() schlagen. Danach zählt der beobachtete Zustand; 5000 ms sind nur die Abbruchschwelle.
async function abwarten(erwartet = "done/new"): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
  });
  await vi.waitFor(() => expect(lage()).toBe(erwartet), { timeout: 5000 });
}

function lage(): string {
  return container.querySelector('[data-testid="lage"]')?.textContent ?? "";
}

const HERKUNFT = (draftId: string): ReasonerProvenance => ({
  source: "draft",
  confidentiality: "intern",
  draftId,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  zaehler.fehler = null;
  zaehler.nutzlasten = [];
  zaehler.antwort = { status: "done", similar: [], conflicts: [] };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
  vi.useRealTimers();
});

it("H1 · NUR die Entwurfskennung wechselt: das ist eine neue Frage", async () => {
  await zeigen({ text: TEXT, herkunft: HERKUNFT("d-a"), stand: 1 });
  await abwarten();
  expect(zaehler.nutzlasten).toHaveLength(1);
  await zeigen({ text: TEXT, herkunft: HERKUNFT("d-b"), stand: 1 });
  // Der alte Befund gilt SOFORT nicht mehr — vor der Antwort steht „wird geprüft", nie „done"
  // (Zustandsmodell §9: keine Aussage ohne frische Grundlage).
  expect(lage()).toBe("checking/checking");
  expect(zaehler.renderLagen[0]).toBe("checking/checking");
  await abwarten();
  expect(zaehler.nutzlasten).toHaveLength(2);
  expect(zaehler.nutzlasten[1]?.draftId).toBe("d-b");
});

it("H2 · derselbe Anker, aber ein NEU GESETZTER gespeicherter Stand: auch das ist eine neue Frage", async () => {
  // Genau der Fall, den BEN im Blatt gemessen hat: Stufe im Menü auf „intern", gesichert, kein
  // Zeichen am Text geändert. Was der Server prüft, hat sich trotzdem verändert.
  await zeigen({ text: TEXT, herkunft: HERKUNFT("d-a"), stand: 1 });
  await abwarten();
  expect(zaehler.nutzlasten).toHaveLength(1);
  await zeigen({ text: TEXT, herkunft: HERKUNFT("d-a"), stand: 2 });
  expect(lage()).toBe("checking/checking");
  expect(zaehler.renderLagen[0]).toBe("checking/checking");
  await abwarten();
  expect(zaehler.nutzlasten).toHaveLength(2);
});

it("H3 · GEGENKONTROLLE: ändert sich nichts, wird auch nicht neu gefragt", async () => {
  // Ohne diesen Fall wäre H1/H2 mit „bei jedem Rendern fragen" erfüllbar — das wäre ein Dauerfeuer
  // auf den Endpunkt und (bei aktivem Modell) auf die Cloud.
  await zeigen({ text: TEXT, herkunft: HERKUNFT("d-a"), stand: 1 });
  await abwarten();
  await zeigen({ text: TEXT, herkunft: HERKUNFT("d-a"), stand: 1 });
  await abwarten();
  await zeigen({ text: TEXT, herkunft: HERKUNFT("d-a"), stand: 1 });
  await abwarten();
  expect(zaehler.nutzlasten).toHaveLength(1);
  expect(lage()).toBe("done/new");
});

it("H4 · Transportfehler zeigt failed/unavailable", async () => {
  zaehler.fehler = new Error("Transport unterbrochen");
  await zeigen({ text: TEXT, herkunft: HERKUNFT("d-a"), stand: 1 });
  expect(lage()).toBe("checking/checking");
  await abwarten("failed/unavailable");
  expect(zaehler.nutzlasten).toHaveLength(1);
});

it("H5 · Text unter der Mindestlänge bleibt idle ohne Anfrage", async () => {
  await zeigen({ text: "kurz", herkunft: HERKUNFT("d-a"), stand: 1 });
  expect(lage()).toBe("idle/idle");
  await abwarten("idle/idle");
  expect(zaehler.nutzlasten).toHaveLength(0);
});

it.each(["erfolg", "fehler"])(
  "H6 · Wechsel bei laufender Anfrage verwirft verspäteten %s des alten Schlüssels",
  async (ausgang) => {
    let antworten!: (wert: Record<string, unknown>) => void;
    let scheitern!: (grund: Error) => void;
    zaehler.antwort = new Promise<Record<string, unknown>>((resolve, reject) => {
      antworten = resolve;
      scheitern = reject;
    });
    await zeigen({ text: TEXT, herkunft: HERKUNFT("d-a"), stand: 1 });
    await abwarten("checking/checking");
    expect(zaehler.nutzlasten).toHaveLength(1);

    zaehler.antwort = { status: "pending", similar: [], conflicts: [] };
    await zeigen({ text: TEXT, herkunft: HERKUNFT("d-b"), stand: 1 });
    expect(lage()).toBe("checking/checking");
    expect(zaehler.renderLagen[0]).toBe("checking/checking");
    await abwarten("pending/pending");
    expect(zaehler.nutzlasten).toHaveLength(2);
    expect(zaehler.nutzlasten[1]?.draftId).toBe("d-b");

    await act(async () => {
      if (ausgang === "erfolg") antworten({ status: "done", similar: [], conflicts: [] });
      else scheitern(new Error("Alter Transport gescheitert"));
    });
    expect(lage()).toBe("pending/pending");
  },
);

it("H7 · Wechsel vor der Entprellung bricht den alten Zeitgeber ab", async () => {
  await zeigen({ text: TEXT, herkunft: HERKUNFT("d-a"), stand: 1 });
  await zeigen({ text: TEXT, herkunft: HERKUNFT("d-b"), stand: 1 });
  expect(lage()).toBe("checking/checking");
  expect(zaehler.nutzlasten).toHaveLength(0);
  await abwarten();
  expect(zaehler.nutzlasten).toHaveLength(1);
  expect(zaehler.nutzlasten[0]?.draftId).toBe("d-b");
});
