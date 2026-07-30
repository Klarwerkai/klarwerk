// @vitest-environment jsdom
// AUFTRAG-mega59 BLOCK E — EINE KENNUNG IST KEIN NAME (die zwei verbliebenen Flächen).
// AUFTRAG-mega59 BLOCK F — „OHNE KI GRUPPIERT" NENNT SEINEN GRUND UND LÜGT NICHT MEHR VORHER.
//
// Beide Blöcke treffen dieselbe Komponente (`ImportGroups`), deshalb stehen sie in einer Datei und
// laufen über EINEN gemounteten Ablauf — Gruppieren, Übernehmen, Bilanz. Was hier geprüft wird, ist
// der echte DOM der echten Komponente; nur die zwei Endpunkte sind Stubs.
//
// BLOCK E: die Fehlerbilanz listete `{f.id}`, obwohl `data.candidates` mit `title` in DERSELBEN
// Komponente vorliegt. Der Titel führt ab jetzt, die Kennung bleibt über den `title`-Tooltip
// erreichbar. Fehlt ein Titel, ist die Kennung der Rückfall — ausdrücklich kein leerer Platz.
//
// BLOCK F1: `noAiReasonKey` gab einen Text NUR für "confidential"; bei no-model, model-timeout und
// model-error stand das Abzeichen nackt da. Jetzt nennt es in ALLEN vier Fällen einen Grund.
//
// BLOCK F2 — der eigentliche Befund des Chefs: die Vorwarnung VOR dem Gruppieren hing allein an
// `aiAvailable` (globaler Reasoner-Status) und wusste nichts von der Vertraulichkeit des Stapels.
// Bei aktivem Reasoner gab es also keine Vorwarnung — und danach stand „Ohne KI gruppiert" da.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    admin: { import: { group: vi.fn(), apply: vi.fn() } },
  },
}));

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { ImportGroups } from "../../apps/web/src/components/ImportGroups";
import i18n from "../../apps/web/src/i18n";
import { IMPORT_GROUPS_TEXT, noAiReasonKey } from "../../apps/web/src/lib/importGroups";
import { hatTitel, koLabel } from "../../apps/web/src/lib/koLabel";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const groupMock = endpoints.admin.import.group as unknown as ReturnType<typeof vi.fn>;
const applyMock = endpoints.admin.import.apply as unknown as ReturnType<typeof vi.fn>;

// „a" trägt einen sprechenden Titel, „b" bewusst KEINEN — damit derselbe Ablauf den Titelweg UND
// den Rückfall zeigt, ohne zwei Fixtures und zwei Wahrheiten.
const GROUP_RESPONSE = {
  groups: [{ title: "Wartung", ids: ["a", "b"] }],
  candidates: [
    {
      id: "kand-a-3f9",
      title: "Arbeitsanweisung Hallenkran",
      alreadyImported: false,
      alreadyQueued: false,
      sourceNewer: false,
      hints: [],
    },
    {
      id: "kand-b-7c2",
      title: "   ",
      alreadyImported: false,
      alreadyQueued: false,
      sourceNewer: false,
      hints: [],
    },
  ],
  demo: true,
  fallbackReason: "no-model",
  snapshotToken: 7,
};

// Beide Kandidaten laufen in „nicht gefunden" — die Bilanz listet damit beide Fehlerzeilen.
const APPLY_FAILED = {
  imported: 0,
  updates: 0,
  alreadyQueued: 0,
  failed: [],
  notFound: ["kand-a-3f9", "kand-b-7c2"],
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(props: Record<string, unknown> = {}): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      createElement(ImportGroups, {
        criteria: {},
        selectedCandidateIds: ["kand-a-3f9", "kand-b-7c2"],
        ...props,
      } as never),
    );
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
});

function text(): string {
  return container.textContent ?? "";
}

function de(key: string): string {
  return String(i18n.getResource("de", "translation", key));
}

function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf mit Text ${part} nicht gefunden; DOM: ${text()}`);
  }
  return btn;
}

// Die Zeilen der Fehlerbilanz — über ihren Text, nicht über eine CSS-Klasse.
function fehlerZeilen(): HTMLLIElement[] {
  return [...container.querySelectorAll("li")].filter((li) =>
    (li.textContent ?? "").includes(de(IMPORT_GROUPS_TEXT.failNotFound)),
  ) as HTMLLIElement[];
}

async function bisZurBilanz(): Promise<void> {
  groupMock.mockResolvedValue(GROUP_RESPONSE);
  applyMock.mockResolvedValue(APPLY_FAILED);
  mount();
  await act(async () => {
    buttonByText("Gruppieren").click();
  });
  await act(async () => {
    buttonByText("Auswahl übernehmen").click();
  });
}

describe("AUFTRAG-mega59 E — die Fehlerbilanz führt den Titel, nicht die Kennung", () => {
  it("die Zeile zeigt den TITEL; die rohe Kennung ist nicht ihr führender Text", async () => {
    await bisZurBilanz();
    const zeilen = fehlerZeilen();
    expect(zeilen.length, `keine Fehlerzeilen; DOM: ${text()}`).toBe(2);
    const mitTitel = zeilen.find((li) => (li.textContent ?? "").includes("Hallenkran"));
    expect(mitTitel, "die Zeile führt den Titel nicht").toBeTruthy();
    // Die rohe Kennung steht NICHT im sichtbaren Text dieser Zeile …
    expect(mitTitel?.textContent).not.toContain("kand-a-3f9");
    // … bleibt aber erreichbar, nur nachrangig (als Tooltip).
    expect(mitTitel?.getAttribute("title")).toBe("kand-a-3f9");
  });

  it("DER RÜCKFALL: ohne Titel bleibt die Kennung stehen — kein leerer Platz", async () => {
    await bisZurBilanz();
    const ohneTitel = fehlerZeilen().find((li) => (li.textContent ?? "").includes("kand-b-7c2"));
    expect(
      ohneTitel,
      "der Kandidat ohne Titel ist unbenannt verschwunden — das wäre schlimmer als die Kennung",
    ).toBeTruthy();
    expect(ohneTitel?.getAttribute("title")).toBe("kand-b-7c2");
  });

  it("die Abbildung Kennung→Titel kommt aus den GELADENEN Kandidaten — kein zusätzlicher Aufruf", async () => {
    await bisZurBilanz();
    // Genau ein /group und genau ein /apply. Hätte die Bilanz die Titel nachgeladen, stünde hier ein
    // dritter Aufruf — das ist die Egress-Gegenprobe dieses Blocks, an der Messung statt im Text.
    expect(groupMock).toHaveBeenCalledTimes(1);
    expect(applyMock).toHaveBeenCalledTimes(1);
  });
});

describe("AUFTRAG-mega59 E — die eine Regel für den Rückfall (lib/koLabel)", () => {
  it("der Titel führt, die Kennung ist der Rückfall", () => {
    expect(koLabel("Arbeitsanweisung Hallenkran", "ko_1")).toBe("Arbeitsanweisung Hallenkran");
    expect(koLabel("  Mit Rand  ", "ko_1")).toBe("Mit Rand");
    // Alle drei Formen von „kein Titel" enden bei der Kennung — nie bei einer leeren Zeichenkette.
    for (const leer of ["", "   ", null, undefined]) {
      expect(koLabel(leer, "ko_1"), `${JSON.stringify(leer)}`).toBe("ko_1");
    }
  });

  it("hatTitel entscheidet, ob die Kennung ZUSÄTZLICH gezeigt werden darf", () => {
    // Ohne diese Unterscheidung stünde dieselbe Zeichenfolge zweimal in derselben Zeile.
    expect(hatTitel("Titel")).toBe(true);
    expect(hatTitel(" ")).toBe(false);
    expect(hatTitel(undefined)).toBe(false);
  });
});

describe("AUFTRAG-mega59 F1 — das Abzeichen nennt IMMER einen Grund", () => {
  const GRUENDE = ["no-model", "model-timeout", "model-error", "confidential"] as const;

  it("jeder der vier Gründe liefert einen Schlüssel — keiner mehr null", () => {
    for (const grund of GRUENDE) {
      expect(noAiReasonKey(grund), `${grund} ohne Grund-Schlüssel`).not.toBeNull();
    }
    // Ein unbekannter Grund bleibt bewusst leer: das Abzeichen steht dann ohne Zusatz, statt einen
    // erfundenen Grund zu behaupten.
    expect(noAiReasonKey(undefined)).toBeNull();
    expect(noAiReasonKey("etwas-neues")).toBeNull();
  });

  it("die vier Gründe sind VERSCHIEDEN — ein Sammeltext hätte nichts erklärt", () => {
    const texte = GRUENDE.map((g) => de(noAiReasonKey(g) as string));
    expect(new Set(texte).size).toBe(GRUENDE.length);
    for (const t of texte) {
      expect(t.length, "leerer Grundtext").toBeGreaterThan(5);
      expect(t).not.toBe("undefined");
    }
  });

  it("alle drei Sprachen tragen alle vier Gründe", () => {
    for (const grund of GRUENDE) {
      const key = noAiReasonKey(grund) as string;
      for (const locale of ["de", "en", "nl"]) {
        const wert = String(i18n.getResource(locale, "translation", key));
        expect(wert, `${locale}/${key} fehlt`).toBeTruthy();
        expect(wert, `${locale}/${key} ist nicht übersetzt`).not.toBe("undefined");
      }
    }
  });

  it("im echten DOM steht der Grund am Abzeichen (Fall no-model)", async () => {
    groupMock.mockResolvedValue(GROUP_RESPONSE);
    mount();
    await act(async () => {
      buttonByText("Gruppieren").click();
    });
    // Vorher stand hier das nackte „Ohne KI gruppiert" — jetzt mit dem Grund.
    expect(text()).toContain(de("imp.groups.reason.noModel"));
  });
});

describe("AUFTRAG-mega59 F2 — die Vorwarnung rechnet die Vertraulichkeit des Stapels ein", () => {
  it("bei AKTIVEM Reasoner UND vertraulichem Stapel erscheint die Vorwarnung", () => {
    // Genau der live gesehene Fall: das Modell ist da, die Warnung schwieg, und danach stand
    // „Ohne KI gruppiert" da. `aiAvailable: true` ist hier die harte Bedingung des Falls.
    mount({ aiAvailable: true, stackConfidential: true });
    expect(text()).toContain(de(IMPORT_GROUPS_TEXT.willGroupWithoutAiConfidential));
  });

  it("der Grund wird getrennt benannt — fehlendes Modell ist nicht dasselbe wie Vertraulichkeit", () => {
    mount({ aiAvailable: false, stackConfidential: false });
    expect(text()).toContain(de(IMPORT_GROUPS_TEXT.willGroupWithoutAi));
    expect(text()).not.toContain(de(IMPORT_GROUPS_TEXT.willGroupWithoutAiConfidential));
  });

  it("ohne Modell UND vertraulich: der Vertraulichkeitsgrund gewinnt — er ist der genauere", () => {
    mount({ aiAvailable: false, stackConfidential: true });
    expect(text()).toContain(de(IMPORT_GROUPS_TEXT.willGroupWithoutAiConfidential));
  });

  it("bei aktivem Reasoner und unbedenklichem Stapel schweigt sie weiter — kein Dauerhinweis", () => {
    mount({ aiAvailable: true, stackConfidential: false });
    expect(text()).not.toContain(de(IMPORT_GROUPS_TEXT.willGroupWithoutAi));
    expect(text()).not.toContain(de(IMPORT_GROUPS_TEXT.willGroupWithoutAiConfidential));
  });

  it("ohne Auswahl gibt es gar keine Vorwarnung — es ist noch nichts zu warnen", () => {
    mount({ aiAvailable: true, stackConfidential: true, selectedCandidateIds: [] });
    expect(text()).not.toContain(de(IMPORT_GROUPS_TEXT.willGroupWithoutAiConfidential));
    expect(text()).toContain(de(IMPORT_GROUPS_TEXT.needSelection));
  });

  it("der neue Hinweis liegt in DE/EN/NL vor", () => {
    for (const locale of ["de", "en", "nl"]) {
      const wert = String(
        i18n.getResource(locale, "translation", IMPORT_GROUPS_TEXT.willGroupWithoutAiConfidential),
      );
      expect(wert, `${locale} fehlt`).toBeTruthy();
      expect(wert).not.toBe("undefined");
    }
  });
});

// ------------------------------------------------------------------------------------------------
// BLOCK E, ZWEITE FLÄCHE: das Herkunfts-Panel der Stufe 2.
// ------------------------------------------------------------------------------------------------
//
// EHRLICH BENANNTE DECKUNG: diese Fläche ist STRUKTURELL gedeckt, nicht gemountet. `Stufe2` ist die
// Admin-Seite mit über zwanzig Netz-Hooks; sie zu mounten hieße, zwanzig Stubs zu bauen, deren
// Richtigkeit selbst niemand prüft — der Fall würde dann die Stubs messen. Gedeckt ist deshalb
// dreifach: (1) `koLabel` als reine Regel oben, (2) dass die Fläche wirklich `koLabel` fährt und die
// rohe Kennung nicht mehr als führenden Text setzt, (3) dass der Titel serverseitig überhaupt
// ankommt. Was NICHT gedeckt ist, steht damit auch fest: die Anordnung im gerenderten DOM.
describe("AUFTRAG-mega59 E — das Herkunfts-Panel der Stufe 2 (strukturell)", () => {
  const STUFE2 = readFileSync(resolve(process.cwd(), "apps/web/src/pages/Stufe2.tsx"), "utf8");
  // Der Ausschnitt des Herkunfts-Panels — von seiner Überschrift bis zum Ende der Liste. Ein zu weit
  // gefasster Ausschnitt würde andere `koId`-Verwendungen der Seite mit einsammeln.
  const PANEL = STUFE2.slice(
    STUFE2.indexOf('{t("out.provenanceTitle")}'),
    STUFE2.indexOf("</ul>", STUFE2.indexOf('{t("out.provenanceTitle")}')),
  );

  it("die Erhebung greift wirklich — sonst wäre alles darunter leer-grün", () => {
    expect(PANEL.length).toBeGreaterThan(100);
    expect(PANEL).toContain("doc.provenance.map");
  });

  it("das Panel führt den Titel über koLabel, nicht die rohe Kennung", () => {
    expect(PANEL).toContain("koLabel(p.title, p.koId)");
    // Die Kennung als FÜHRENDER Text ist weg …
    expect(PANEL).not.toContain(">{p.koId}<");
    // … und bleibt nachrangig erreichbar (Tooltip).
    expect(PANEL).toContain("title={p.koId}");
  });

  it("der Titel kommt serverseitig wirklich an — der Rückfall ist der Ausnahmefall, nicht die Regel", () => {
    // Ohne diesen Beleg könnte die Fläche formal richtig sein und praktisch immer die Kennung zeigen.
    const RENDER = readFileSync(resolve(process.cwd(), "services/output/src/render.ts"), "utf8");
    // `toProvenance` setzt `title: ko.title` — der Titel reist also mit jedem Herkunftseintrag.
    expect(RENDER).toContain("toProvenance");
    expect(RENDER).toMatch(/koId: ko\.id,\s*\n\s*title: ko\.title,/);
  });
});
