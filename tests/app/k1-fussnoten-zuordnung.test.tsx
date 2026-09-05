// @vitest-environment jsdom
// ================================================================================================
// JOB 3056 Runde 4 (Codex Pflicht 1) — WELCHE FUSSNOTENZIFFER ZU WELCHER QUELLE GEHOERT.
// ================================================================================================
//
// Die Chromium-Messung (tests/design/zielbild-k1-antwort.test.ts, Faelle N1-N4) misst Stil und Ort
// der Ziffern an der gebauten Flaeche. HIER steht die ZUORDNUNG am vollstaendigen Aufgabenfenster
// (apps/web/public/word-addin/taskpane.html, ueber k1-panel-lauf) in jsdom, mit einem
// Ask-Vertrag, den der retrieval-only-Server nie liefert (drei Quellen, zwei
// tragend): Ziffer n meint den Chip n (dieselbe `data-quelle`), eine nur herangezogene Quelle
// bekommt KEINE Ziffer, ohne `citedSources` steht keine Ziffer, und die naechste Frage raeumt die
// Ziffern der vorigen ab.
import { afterEach, describe, expect, it } from "vitest";
import { type Antwort, el, panelAbraeumen, panelStarten, ruhe, sichtbar } from "./k1-panel-lauf";

const TITEL: Record<string, string> = {
  ka: "Design Guide",
  kb: "HD Handbook",
  kc: "Randnotiz",
};

function starten(ergebnis: Record<string, unknown>) {
  return panelStarten((url, methode): Antwort => {
    if (url === "/api/auth/me") return { status: 200, body: { name: "Pedi" } };
    if (url === "/api/reasoner/status") {
      return { status: 200, body: { enabled: false, reachable: "none" } };
    }
    if (url === "/api/ask")
      return { status: 200, body: { result: ergebnis, gap: null, receipt: "r" } };
    if (url.startsWith("/api/kos/")) {
      const id = decodeURIComponent(url.slice("/api/kos/".length));
      return { status: 200, body: { id, title: TITEL[id] ?? id, status: "validiert", trust: 80 } };
    }
    if (methode === "HEAD") return { status: 200 };
    return { status: 401 };
  });
}

async function fragen(): Promise<void> {
  el<HTMLTextAreaElement>("ask-input").value = "Welche Profile sind in Spritzzonen erlaubt?";
  el("ask-btn").click();
  await ruhe();
}

function ziffern(): Array<{ text: string; quelle: string | null }> {
  return [...document.querySelectorAll("#ask-fussnoten sup.fussnote")].map((s) => ({
    text: (s.textContent ?? "").trim(),
    quelle: s.getAttribute("data-quelle"),
  }));
}

function chips(): Array<{ text: string; quelle: string | null }> {
  return [...document.querySelectorAll("#ask-sources li.quelle-chip")].map((c) => ({
    text: (c.textContent ?? "").replace(/\s+/g, " ").trim(),
    quelle: c.getAttribute("data-quelle"),
  }));
}

describe("JOB 3056 R4 · Fussnotenziffern — Zuordnung zu den Chips", () => {
  afterEach(() => {
    panelAbraeumen();
  });

  it("drei Quellen, zwei tragend: Ziffern „1“ und „2“ in Chip-Reihenfolge, dieselbe data-quelle wie ihr Chip; die herangezogene Quelle hat keine", async () => {
    starten({
      answered: true,
      answer: "Offene Profile sind zu bevorzugen.\n\nGeschlossene Profile sind zu begruenden.",
      sources: ["ka", "kb", "kc"],
      citedSources: ["ka", "kb"],
      trust: 80,
      steps: [],
      evidence: { grade: "verified" },
    });
    await ruhe();
    await fragen();
    expect(ziffern()).toEqual([
      { text: "1", quelle: "ka" },
      { text: "2", quelle: "kb" },
    ]);
    expect(sichtbar(el("ask-fussnoten"))).toBe(true);
    // Zwei Chips im Bild („+1" fuer die dritte), dieselben Quellen in derselben Reihenfolge.
    expect(chips()).toEqual([
      { text: "1 · Design Guide", quelle: "ka" },
      { text: "2 · HD Handbook", quelle: "kb" },
    ]);
    expect(el("ask-quellen-mehr-btn").textContent).toBe("+1");
    // „+1" zeigt die dritte Quelle — sie bekommt weiterhin KEINE Ziffer (nur herangezogen).
    el("ask-quellen-mehr-btn").click();
    await ruhe();
    expect(chips().map((c) => c.quelle)).toEqual(["ka", "kb", "kc"]);
    expect(ziffern().map((z) => z.quelle)).toEqual(["ka", "kb"]);
    // Jede Ziffer findet ihren Chip ueber dieselbe Quelle — und traegt dessen Nummer.
    for (const z of ziffern()) {
      const chip = document.querySelector(`#ask-sources li.quelle-chip[data-quelle="${z.quelle}"]`);
      expect(chip, `kein Chip zu ${z.quelle}`).not.toBeNull();
      expect((chip?.textContent ?? "").trim().startsWith(`${z.text} ·`)).toBe(true);
    }
  });

  it("ohne `citedSources` (alter Server) steht KEINE Ziffer — keine Rolle wird behauptet", async () => {
    starten({
      answered: true,
      answer: "Offene Profile sind zu bevorzugen.",
      sources: ["ka"],
      trust: 80,
      steps: [],
      evidence: { grade: "verified" },
    });
    await ruhe();
    await fragen();
    expect(chips().length).toBe(1);
    expect(ziffern()).toEqual([]);
    expect(sichtbar(el("ask-fussnoten"))).toBe(false);
  });

  it("die naechste Frage raeumt die Ziffern der vorigen ab; der Zurueck-Chevron ebenso", async () => {
    starten({
      answered: true,
      answer: "Offene Profile sind zu bevorzugen.",
      sources: ["ka"],
      citedSources: ["ka"],
      trust: 80,
      steps: [],
      evidence: { grade: "verified" },
    });
    await ruhe();
    await fragen();
    expect(ziffern()).toEqual([{ text: "1", quelle: "ka" }]);
    el("kw-zurueck").click();
    await ruhe();
    expect(ziffern()).toEqual([]);
    expect(sichtbar(el("ask-fussnoten"))).toBe(false);
  });
});
