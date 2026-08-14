// @vitest-environment jsdom
// ================================================================================================
// GAP-SPRACHHERKUNFT · AUFLAGE 2 DES DESIGN-LEADS — DAS ETIKETT MUSS DA BLEIBEN, WO ES ZÄHLT.
// ================================================================================================
//
// DER BEFUND (Design-Lead zu Commit 5e8b4c6): Das Sprach-Etikett wurde als Text an den Titel
// gehängt und landete damit INNERHALB des einzeiligen, abgeschnittenen Titels (`truncate`). Weil
// es am Ende stand, wurde es als Erstes weggeschnitten — bei genau den langen Titeln, die der
// Anlass des ganzen Baus waren. Ergebnis: sichtbar bei kurzen Titeln (wo es niemand braucht),
// verschwunden bei langen (wo es der ganze Zweck ist).
//
// 14 grüne Funktionstests haben das nicht bemerkt, weil `gapLocaleTag("en","de") === "Englisch"`
// grün ist, während der Nutzer nichts sieht. Genau diese Lücke schließt dieser Test.
//
// WIE HIER GEMESSEN WIRD — UND WAS DAS NICHT BEWEIST: jsdom hat keine Layout-Engine; ob Text
// wirklich abgeschnitten wird, kann hier NIEMAND messen. Geprüft wird deshalb die Struktur, die
// darüber entscheidet: Das Etikett darf kein Nachkomme des `truncate`-Trägers sein und muss
// `shrink-0` tragen. Solange das gilt, kürzt der Titel und das Etikett bleibt stehen. Die
// optische Endabnahme bleibt beim Design-Lead.
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Gap } from "../../apps/web/src/api/types";

const LANGER_TITEL =
  "Are countersunk screws allowed in food contact zones and splash zones of filling lines?";

const GAPS: Gap[] = [
  {
    id: "g-en",
    question: LANGER_TITEL,
    status: "offen",
    assignee: null,
    priority: "hoch",
    createdAt: "2026-08-15T00:00:00.000Z",
    locale: "en",
  },
];

// Nur `useGaps` traegt echte Daten; alles Uebrige antwortet leer. Die Liste ist bewusst
// AUSGESCHRIEBEN: Ein Proxy, der jeden unbekannten Haken automatisch bedient, trieb React hier in
// eine Endlosschleife (der Testlauf hing 300 s ohne Ergebnis). Fehlt kuenftig ein Haken, bricht der
// Mount mit klarer Meldung — das ist der ehrlichere Fehlermodus.
vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useGaps: () => ok(GAPS),
    useKos: () => ok([]),
    useAudit: () => ok([]),
    useConflicts: () => ok([]),
    useLifecyclePending: () => ok([]),
    useValidationBoard: () => ok([]),
    useDirectory: () => ok([]),
    useRisks: () => ok([]),
    useCaptureDrafts: () => ok([]),
    // zusaetzlich von Risk.tsx und seinen Unterkomponenten gezogen
    useBusFactor: () => ok([]),
    useExpertise: () => ok([]),
    useAiCheckCoverageSummary: () => ok(null),
  };
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", role: "experte" } }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({ useRole: () => ({ role: "experte" }) }));
vi.mock("../../apps/web/src/app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
// i18n MUSS geladen werden: ohne die initialisierte Instanz traegt `i18n.language` keinen Wert,
// `Intl.DisplayNames` wirft, und das Etikett faellt auf den rohen Code zurueck ("EN" statt
// "Englisch"). Im Browser ist die Instanz immer initialisiert — der Test bildet das nach.
import i18n from "../../apps/web/src/i18n";
import { MyTasks } from "../../apps/web/src/pages/MyTasks";
import { Risk } from "../../apps/web/src/pages/Risk";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(seite: () => JSX.Element): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: ["/aufgaben"] }, createElement(seite)),
      ),
    );
  });
}

afterEach(() => {
  // Nicht jeder Fall mountet (die Vorbedingung prueft nur die Spracheinstellung) — ohne diese
  // Wache riesse das Aufraeumen einen gruenen Fall mit "Cannot read properties of undefined".
  if (root) act(() => root.unmount());
  container?.remove();
});

/** Das Element, das die Sprachangabe trägt — gesucht über seinen sichtbaren Text. */
function etikett(): HTMLElement | null {
  const alle = Array.from(container.querySelectorAll("span, div"));
  return (alle.find((e) => e.textContent?.trim() === "Englisch") as HTMLElement) ?? null;
}

describe("Sprach-Etikett an der Wissenslücke (Aufgabenliste)", () => {
  it("VORBEDINGUNG: die Oberflaeche laeuft auf Deutsch", () => {
    // Sonst prueften die folgenden Faelle gegen einen Sprachnamen, den niemand erwartet.
    expect(i18n.language).toBe("de");
  });

  it("KALIBRIERUNG: der fremdsprachige Lückentitel steht überhaupt in der Liste", () => {
    // Ohne diesen Fall wären die folgenden auch dann grün, wenn die Liste leer bliebe.
    mount(MyTasks);
    expect(container.textContent).toContain("countersunk screws");
  });

  it("das Etikett wird angezeigt", () => {
    mount(MyTasks);
    expect(etikett()).not.toBeNull();
  });

  it("das Etikett steht NICHT im abgeschnittenen Titel — sonst fällt es als Erstes weg", () => {
    mount(MyTasks);
    const el = etikett();
    expect(el).not.toBeNull();
    expect(el?.closest(".truncate")).toBeNull();
  });

  it("das Etikett schrumpft nicht mit: es trägt shrink-0", () => {
    mount(MyTasks);
    expect(etikett()?.className).toContain("shrink-0");
  });

  it("der Titel selbst bleibt der kürzende Teil (`truncate` sitzt am Titel)", () => {
    // Gegenprobe zur vorigen Zusage: Verschwände `truncate` ganz, wäre der Etikett-Test trivial
    // grün und die Zeile bräche stattdessen um.
    mount(MyTasks);
    const titel = Array.from(container.querySelectorAll(".truncate")).find((e) =>
      e.textContent?.includes("countersunk screws"),
    );
    expect(titel).toBeDefined();
  });
});

// AUFLAGE 1 DES DESIGN-LEADS: Dieselben offenen Luecken erscheinen auf "Risiko & Luecken". Ohne
// diese Stelle saehe jeder den alten Zustand, der ueber diese Seite geht statt ueber die
// Aufgabenliste — die halbe Wirkung des Baus.
describe("Sprach-Etikett an der Wissensluecke (Risiko & Luecken)", () => {
  it("KALIBRIERUNG: der fremdsprachige Lueckentitel steht ueberhaupt in der Liste", () => {
    mount(Risk);
    expect(container.textContent).toContain("countersunk screws");
  });

  it("das Etikett wird auch hier angezeigt", () => {
    mount(Risk);
    expect(etikett()).not.toBeNull();
  });

  it("das Etikett steht NICHT im abgeschnittenen Titel", () => {
    mount(Risk);
    expect(etikett()?.closest(".truncate")).toBeNull();
  });

  it("das Etikett schrumpft nicht mit: es traegt shrink-0", () => {
    mount(Risk);
    expect(etikett()?.className).toContain("shrink-0");
  });
});
