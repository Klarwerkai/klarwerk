// @vitest-environment jsdom
// WP-IC-4 (Teil 2, Mounted): Gruppen-Karten der Freigabe — aufklappbare Kandidatenliste mit
// Hinweis-Badges, Gruppen-Entscheid (Freigeben/Ausschließen) setzt die Kandidaten-Vorgabe,
// Einzel-Override bleibt, der laufende Zähler stimmt. Getestet über den kontrollierten
// Präsentationsteil (GroupApprovalPanel) mit der echten Auswahl-Logik als Host-State.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { ImportGroupResponse } from "../../apps/web/src/api/types";
import { GroupApprovalPanel } from "../../apps/web/src/components/ImportGroups";
import i18n from "../../apps/web/src/i18n";
import {
  type GroupedCandidate,
  IMPORT_GROUPS_TEXT,
  type ImportGroup,
  applyGroupToggle,
  initialSelection,
  noAiReasonKey,
  toggleCandidate,
} from "../../apps/web/src/lib/importGroups";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CANDIDATES: GroupedCandidate[] = [
  { id: "a", title: "Pumpe warten", alreadyImported: false, hints: [] },
  { id: "b", title: "Ventil tauschen", alreadyImported: true, hints: ["already-imported"] },
  { id: "c", title: "Fehlercode E5", alreadyImported: false, hints: ["short"] },
  // WP-SHIP9-S1b (bens GELB): offener Kandidat — eigener Zustand „vorgemerkt", vorab abgewählt.
  { id: "d", title: "Filter reinigen", alreadyImported: false, alreadyQueued: true, hints: [] },
];
const GROUPS: ImportGroup[] = [
  { title: "Wartung", ids: ["a", "b"] },
  { title: "Störungen", ids: ["c", "d"] },
];

function Host(props: {
  demo?: boolean;
  fallbackReason?: ImportGroupResponse["fallbackReason"];
}) {
  const [selection, setSelection] = useState(() => initialSelection(CANDIDATES));
  return createElement(GroupApprovalPanel, {
    groups: GROUPS,
    candidates: CANDIDATES,
    selection,
    demo: props.demo ?? true,
    fallbackReason: props.fallbackReason,
    onToggleGroup: (group: ImportGroup, on: boolean) =>
      setSelection((prev) => applyGroupToggle(prev, group, on)),
    onToggleCandidate: (id: string) => setSelection((prev) => toggleCandidate(prev, id)),
  });
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(props: Parameters<typeof Host>[0] = {}): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(Host, props));
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function checkboxOf(title: string): HTMLInputElement {
  const box = [...container.querySelectorAll('input[type="checkbox"]')].find(
    (el) => el.getAttribute("aria-label") === title,
  );
  if (!(box instanceof HTMLInputElement)) {
    throw new Error(`Checkbox ${title} nicht gefunden`);
  }
  return box;
}

describe("WP-IC-4: Gruppen-Karten (gemountet)", () => {
  it("rendert Gruppen-Karten mit Anzahl, aufklappbarer Kandidatenliste und Hinweis-Badges", () => {
    mount();
    const cards = container.querySelectorAll("details");
    expect(cards.length).toBe(2);
    expect(container.textContent).toContain("Wartung");
    expect(container.textContent).toContain("Störungen");
    // Aufklappen: die Kandidatenliste der Karte wird sichtbar (open-Zustand des details).
    const first = cards[0] as HTMLDetailsElement;
    expect(first.open).toBe(false);
    act(() => {
      first.open = true;
      first.dispatchEvent(new Event("toggle"));
    });
    expect(first.open).toBe(true);
    expect(checkboxOf("Pumpe warten")).toBeTruthy();
    // Hinweis-Badge (deterministischer Qualitätshinweis) am Kandidaten.
    expect(container.textContent).toContain("bereits importiert");
    // Ohne-KI-Kennzeichnung ist ehrlich sichtbar (demo:true).
    expect(container.textContent).toContain("Ohne KI gruppiert");
  });

  it("Vorab-Abwahl + Zähler: Importiertes UND Vorgemerktes starten abgewählt (2 von 4)", () => {
    mount();
    expect(container.textContent).toContain("2 von 4 ausgewählt");
    expect(checkboxOf("Pumpe warten").checked).toBe(true);
    expect(checkboxOf("Ventil tauschen").checked).toBe(false);
    // WP-SHIP9-S1b: der offene Kandidat startet abgewählt (Queue-Schutz), bleibt aber anwählbar.
    expect(checkboxOf("Filter reinigen").checked).toBe(false);
  });

  // WP-SHIP9-S1b (bens GELB): der vorgemerkte Zustand ist ein EIGENES Badge mit EIGENEM Text —
  // klar unterscheidbar von „bereits importiert" (anderer Text, andere Badge-Klasse).
  it("S1b: offener Kandidat zeigt den Vorgemerkt-Text, nicht den Importiert-Text", async () => {
    await i18n.changeLanguage("de");
    mount();
    expect(container.textContent).toContain("bereits zur Prüfung vorgemerkt");
    // Der Kandidat d trägt KEINEN already-imported-Hinweis — die Texte bleiben getrennt.
    const row = checkboxOf("Filter reinigen").closest("li");
    expect(row?.textContent).toContain("bereits zur Prüfung vorgemerkt");
    expect(row?.textContent).not.toContain("bereits importiert");
  });

  // WP-SHIP9-S1 (bens T7): der Vertraulichkeitsfall zeigt am Badge den SPEZIFISCHEN Grund —
  // nicht mehr nur das generische „Ohne KI gruppiert".
  it("bens T7: fallbackReason confidential → sichtbarer spezifischer Text am Badge", async () => {
    await i18n.changeLanguage("de");
    mount({ demo: true, fallbackReason: "confidential" });
    expect(container.textContent).toContain(
      "Ohne KI gruppiert — vertrauliche Kandidaten — Cloud-KI ausgeschlossen",
    );
  });

  // WP-SHIP9-S1 (bens T9): die bestehenden Darstellungen bleiben UNVERÄNDERT — kein Grund-Zusatz
  // für no-model/model-timeout/model-error, und ohne demo weiterhin „KI-gruppiert".
  it("bens T9: no-model/model-timeout/model-error unverändert (kein Grund-Zusatz)", async () => {
    await i18n.changeLanguage("de");
    for (const reason of ["no-model", "model-timeout", "model-error", undefined] as const) {
      mount({ demo: true, fallbackReason: reason });
      expect(container.textContent, String(reason)).toContain("Ohne KI gruppiert");
      expect(container.textContent, String(reason)).not.toContain("vertrauliche Kandidaten");
      expect(container.textContent, String(reason)).not.toContain(" — ");
      act(() => {
        root.unmount();
      });
      container.remove();
    }
    mount({ demo: false });
    expect(container.textContent).toContain("KI-gruppiert");
    expect(container.textContent).not.toContain("Ohne KI gruppiert");
  });

  // WP-SHIP9-S1 (bens T8): DE/EN/NL-Abdeckung des neuen Textes + der Helfer mappt NUR confidential.
  it("bens T8: DE/EN/NL-Texte des Vertraulichkeitsgrundes lösen auf", async () => {
    expect(noAiReasonKey("confidential")).toBe(IMPORT_GROUPS_TEXT.reasonConfidential);
    for (const other of ["no-model", "model-timeout", "model-error", undefined]) {
      expect(noAiReasonKey(other as string | undefined)).toBeNull();
    }
    const expected: Record<string, string> = {
      de: "vertrauliche Kandidaten — Cloud-KI ausgeschlossen",
      en: "confidential candidates — cloud AI excluded",
      nl: "vertrouwelijke kandidaten — cloud-AI uitgesloten",
    };
    for (const lng of ["de", "en", "nl"] as const) {
      await i18n.changeLanguage(lng);
      expect(i18n.t(IMPORT_GROUPS_TEXT.reasonConfidential), lng).toBe(expected[lng]);
      // Der zusammengesetzte Badge-Text löst in allen drei Sprachen auf (kein roher Key).
      const composed = i18n.t(IMPORT_GROUPS_TEXT.noAiReason, { reason: expected[lng] });
      expect(composed, lng).not.toBe(IMPORT_GROUPS_TEXT.noAiReason);
      expect(composed, lng).toContain(expected[lng] ?? "");
    }
    await i18n.changeLanguage("de");
  });

  it("Gruppen-Entscheid setzt die Kandidaten-Vorgabe; Einzel-Override bleibt; Zähler folgt", () => {
    mount();
    // Ganze Gruppe „Wartung" ausschließen → a und b abgewählt.
    const excludeButtons = [...container.querySelectorAll("button")].filter(
      (b) => b.textContent === "Ausschließen",
    );
    act(() => {
      (excludeButtons[0] as HTMLButtonElement).click();
    });
    expect(checkboxOf("Pumpe warten").checked).toBe(false);
    expect(container.textContent).toContain("1 von 4 ausgewählt");
    // Ganze Gruppe freigeben → auch das bereits Importierte (bewusster Gruppen-Override).
    const approveButtons = [...container.querySelectorAll("button")].filter(
      (b) => b.textContent === "Freigeben",
    );
    act(() => {
      (approveButtons[0] as HTMLButtonElement).click();
    });
    expect(checkboxOf("Ventil tauschen").checked).toBe(true);
    expect(container.textContent).toContain("3 von 4 ausgewählt");
    // Einzel-Override innerhalb der Gruppe.
    act(() => {
      checkboxOf("Pumpe warten").click();
    });
    expect(checkboxOf("Pumpe warten").checked).toBe(false);
    expect(container.textContent).toContain("2 von 4 ausgewählt");
  });
});
