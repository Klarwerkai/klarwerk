// @vitest-environment jsdom
// ================================================================================================
// BPA-05 · AKTIVE BEGLEITUNG — die Leiste in der ECHTEN Hülle, das Gespräch nie geöffnet.
// ================================================================================================
//
// K3 verlangt Pause/Stopp „über Tastatur und Statusanzeige …, auch bei geschlossenem Gespräch".
// Gemessen wird deshalb am Einbauort: `AppShell` mit Anmeldung, Rollen und Router aus dem
// FE-003-Gerüst (`tests/fe003-tutorial-fragen/huelle.tsx`), das Netz auf `fetch`-Ebene
// protokolliert. Das Gespräch der Assistenz wird in diesem Fall nie geöffnet. Die Leiste erscheint
// nur, weil die Seite einen Vorgang eingerichtet hat, und sie schickt nichts ans Netz.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "../../apps/web/node_modules/react";
import i18n from "../../apps/web/src/i18n";
import {
  type Montiert,
  bis,
  klick,
  medienStub,
  montiere,
  mutationen,
  netz,
  netzStub,
  q,
  ruhe,
  tippe,
} from "../fe003-tutorial-fragen/huelle";

const GEHEIM = "KD-GEHEIM-4711";
let m: Montiert | null = null;

beforeEach(async () => {
  await i18n.changeLanguage("de");
  sessionStorage.clear();
  netz.anfragen = [];
  netz.lage = { kiAktiv: false, rolle: "experte" };
  vi.stubGlobal("fetch", vi.fn(netzStub));
  medienStub();
  const vorgang = document.createElement("form");
  vorgang.setAttribute("data-klara-begleitbereich", "pruefformular-netzteil");
  vorgang.setAttribute("data-klara-begleitbereich-name", "Prüfformular Netzteil");
  vorgang.innerHTML = `
    <label for="leistung">Leistung</label>
    <input id="leistung" name="leistung" data-klara-einheit="W,kW" value="250">
    <input id="kunde" name="kundennummer" data-klara-ausgeschlossen value="${GEHEIM}">`;
  document.body.appendChild(vorgang);
});

afterEach(() => {
  m?.abbauen();
  m = null;
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function taste(code: "KeyP" | "KeyS"): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code, altKey: true, shiftKey: true }));
  });
}

describe("K3 · Pause und Stopp in der Hülle, ohne geöffnetes Gespräch", () => {
  it("Leiste neben der Figur: starten, per Tastatur pausieren und stoppen — ohne Netzwirkung", async () => {
    m = await montiere("/start", "leer");
    await bis(() => q(document, "begleitung-angebot") !== null);
    const angebot = q(document, "begleitung-angebot");
    expect(angebot).not.toBeNull();
    expect(angebot?.closest('[role="dialog"]')).toBeNull();
    const vorher = netz.anfragen.length;

    const auftrag = q<HTMLInputElement>(document, "begleitung-auftrag") as HTMLInputElement;
    await tippe(auftrag, "Recherche");
    const starten = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent === "Begleitung starten",
    );
    await klick(starten);
    await bis(() => q(document, "begleitung-hinweis") !== null);
    expect(q(document, "begleitung-zustand")?.textContent).toMatch(
      /^Begleiten · Prüfformular Netzteil · bis /,
    );
    expect(q(document, "begleitung-hinweis")?.textContent).toContain("„Leistung“");

    taste("KeyP");
    await ruhe(3);
    expect(q(document, "begleitung-zustand")?.textContent).toMatch(/^Pausiert · /);
    taste("KeyS");
    await ruhe(3);
    expect(q(document, "begleitung-beendet")).not.toBeNull();

    expect(mutationen(vorher)).toEqual([]);
    const gesendet = JSON.stringify(netz.anfragen.slice(vorher));
    expect(gesendet).not.toContain(GEHEIM);
    expect(gesendet).not.toContain("Leistung");
    expect(gesendet).not.toContain("pruefformular");
  });
});
