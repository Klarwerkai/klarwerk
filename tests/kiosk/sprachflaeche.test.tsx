// @vitest-environment jsdom
// Adapter-/Komponentenbelege mit kontrollierter Web-Speech-API, kein reales Audio.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { SpeechRec } from "../../apps/web/src/lib/speechDictation";

const netz = vi.hoisted(() => ({ get: vi.fn(), postAbbrechbar: vi.fn() }));
vi.mock("../../apps/web/src/api/client", () => ({ api: netz }));
import "../../apps/web/src/i18n";
import Kiosk from "../../apps/web/src/kiosk/Kiosk";
import { rechtekontextZuruecksetzen } from "../../apps/web/src/lib/rechtekontext";

let root: Root;
let host: HTMLDivElement;
const rekorder: ProbeRec[] = [];
const ausgaben: ProbeAusgabe[] = [];
class ProbeRec implements SpeechRec {
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: SpeechRec["onresult"] = null;
  onend: SpeechRec["onend"] = null;
  onerror: SpeechRec["onerror"] = null;
  gestoppt = false;
  constructor() {
    rekorder.push(this);
  }
  start() {}
  stop() {
    this.gestoppt = true;
    this.onend?.();
  }
  text(text: string) {
    this.onresult?.({
      resultIndex: 0,
      results: [Object.assign([{ transcript: text }], { isFinal: true })],
    });
  }
}
class ProbeAusgabe {
  lang = "";
  voice: unknown = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly text: string) {}
}
const antwort = {
  result: {
    answered: true,
    answer: "Testpumpe KX42 entlasten.",
    evidence: {
      grade: "unverified",
      sourcesConflicted: false,
      conflictsUnproven: false,
    },
  },
  kiosk: { quellen: [{ koId: "fiktive-quelle", fassung: 3 }] },
};
function muss<T>(wert: T | undefined): T {
  if (wert === undefined) throw new Error("Erwartetes Probeobjekt fehlt");
  return wert;
}
const knop = (name: string) =>
  muss([...host.querySelectorAll("button")].find((b) => b.textContent === name));
async function montieren() {
  await act(async () => root.render(<Kiosk />));
}
async function klick(name: string) {
  await act(async () => knop(name).click());
}
beforeEach(() => {
  vi.clearAllMocks();
  rechtekontextZuruecksetzen();
  rekorder.length = 0;
  ausgaben.length = 0;
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    React,
    SpeechRecognition: ProbeRec,
    SpeechSynthesisUtterance: ProbeAusgabe,
    speechSynthesis: {
      getVoices: () => [],
      cancel: vi.fn(),
      speak: (u: ProbeAusgabe) => ausgaben.push(u),
    },
  });
  netz.get.mockResolvedValue({ profilId: "fiktiv", revision: 1, zugang: "sitzung" });
  netz.postAbbrechbar.mockResolvedValue(antwort);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("R-1648 · montierter Sprach-Leseweg", () => {
  it("gesperrtes Profil zeigt keine Aufnahme- oder Schreibfunktion", async () => {
    netz.get.mockRejectedValue(new Error("gesperrt"));
    await montieren();
    expect(host.textContent).toContain("zulässiges Zugangsprofil fehlt");
    expect(host.querySelectorAll("button,input,textarea,a")).toHaveLength(0);
    expect(rekorder).toHaveLength(0);
    expect(netz.postAbbrechbar).not.toHaveBeenCalled();
  });
  it("Frage ohne Tastatur → automatischer Abruf → Vorlesen mit Vorbehalt → nächste Frage/noch einmal/stopp", async () => {
    await montieren();
    expect(rekorder).toHaveLength(0);
    await klick("Sprachbedienung starten");
    await act(async () => muss(rekorder[0]).text("Testpumpe KX42"));
    expect(netz.postAbbrechbar.mock.calls[0]?.[0]).toBe("/kiosk/fragen");
    expect(netz.postAbbrechbar.mock.calls[0]?.[1]).toEqual({
      question: "Testpumpe KX42",
      profilId: "fiktiv",
      revision: 1,
      locale: "de",
    });
    expect(muss(rekorder[0]).gestoppt).toBe(true);
    expect(muss(ausgaben[0]).text).toContain(
      "vollständige Prüfung dieser Antwort ist nicht belegt",
    );
    expect(host.textContent).toContain("fiktive-quelle · Fassung 3");
    await act(async () => muss(ausgaben[0]).onend?.());
    expect(rekorder).toHaveLength(2);
    await act(async () => muss(rekorder[1]).text("noch einmal"));
    expect(ausgaben).toHaveLength(2);
    expect(netz.postAbbrechbar).toHaveBeenCalledTimes(1);
    await act(async () => muss(ausgaben[1]).onend?.());
    expect(rekorder).toHaveLength(3);
    await act(async () => muss(rekorder[2]).text("stopp"));
    expect(host.textContent).toContain("Bereit für Ihre Frage");
    expect(muss(rekorder[2]).gestoppt).toBe(true);
  });
  it("ein spätes Ende einer abgebrochenen Sprachausgabe startet das Mikrofon nicht während der neuen Ausgabe", async () => {
    await montieren();
    await klick("Sprachbedienung starten");
    await act(async () => muss(rekorder[0]).text("KX42"));
    const alt = muss(ausgaben[0]);
    await klick("Sprachbedienung stoppen");
    await klick("Sprachbedienung starten");
    await act(async () => muss(rekorder[1]).text("KX42"));
    expect(ausgaben).toHaveLength(2);
    await act(async () => alt.onend?.());
    expect(rekorder).toHaveLength(2);
    expect(host.textContent).toContain("Antwort wird vorgelesen");
    await act(async () => muss(ausgaben[1]).onend?.());
    expect(rekorder).toHaveLength(3);
  });
  it("Mikrofonablehnung beendet die Bedienung ohne Frageversand", async () => {
    await montieren();
    await klick("Sprachbedienung starten");
    await act(async () => muss(rekorder[0]).onerror?.({ error: "not-allowed" }));
    expect(host.textContent).toContain("Mikrofonberechtigung");
    expect(netz.postAbbrechbar).not.toHaveBeenCalled();
  });
  it("Stop verwirft eine verspätete Antwort; Unmount beendet die eigene Aufnahme", async () => {
    let liefern!: (a: typeof antwort) => void;
    netz.postAbbrechbar.mockImplementation(
      () =>
        new Promise((resolve) => {
          liefern = resolve;
        }),
    );
    await montieren();
    await klick("Sprachbedienung starten");
    await act(async () => muss(rekorder[0]).text("KX42"));
    await klick("Sprachbedienung stoppen");
    await act(async () => liefern(antwort));
    expect(ausgaben).toHaveLength(0);
    expect(host.textContent).not.toContain("entlasten");
    await klick("Sprachbedienung starten");
    const r = muss(rekorder.at(-1));
    await act(async () => root.unmount());
    expect(r.gestoppt).toBe(true);
    expect(r.onresult).toBeNull();
    root = createRoot(host);
  });
  it("fehlende Browserfähigkeit bleibt ein ehrlicher Zustand", async () => {
    Object.assign(globalThis, { SpeechRecognition: undefined });
    await montieren();
    expect(host.textContent).toContain("benötigte Spracherkennung");
    expect(host.querySelector("button")).toBeNull();
  });
});
