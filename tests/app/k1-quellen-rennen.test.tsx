// @vitest-environment jsdom
// ================================================================================================
// JOB 3056 Runde 6 (Codex, Runde 5) — EIN VERSPAETETER QUELLEN-RUECKLAUF GEHOERT SEINER FRAGE.
// ================================================================================================
//
// CODEX' GEGENBEWEIS in Runde 5: „Nach zwei unmittelbar aufeinanderfolgenden Fragen zeigte
// ‚Antwort zwei' anschliessend den Quellen-Chip von ‚Antwort eins'." Seit JOB 3056 bleibt das
// Frage-Feld unter der Antwort stehen (es IST die neue Frage); die Quellen der Antwort werden
// NACH der Antwort aufgeloest (GET /api/kos/:id). Wer in dieser Luecke die naechste Frage stellt,
// bekam bis Runde 5 die Quellen der VORIGEN Antwort untergeschoben — Chip, Fussnote und die
// Metadaten, die Kopieren/Einfuegen in die Quellen-Zeile schreiben.
//
// Dieser Test faehrt das VOLLSTAENDIGE Aufgabenfenster (apps/web/public/word-addin/taskpane.html,
// ueber k1-panel-lauf) in jsdom: Frage 1 (Quelle ka, ihr Abruf HAENGT) → Frage 2 (Quelle kb,
// aufgeloest) → der Abruf von ka wird freigegeben. Danach muessen Chip, Fussnote, Antworttext und
// der kopierte Text ausschliesslich Frage 2 gehoeren; ein haengender Ruecklauf von Frage 1 darf
// auch das Ausgabetor (Kopieren/Einfuegen) der Frage 2 nicht oeffnen.
import { afterEach, describe, expect, it } from "vitest";
import {
  type Antwort,
  type Lauf,
  el,
  panelAbraeumen,
  panelStarten,
  ruhe,
  sichtbar,
} from "./k1-panel-lauf";

const TITEL: Record<string, string> = { ka: "Design Guide", kb: "HD Handbook" };
const ANTWORT: Record<string, string> = {
  ka: "Offene Profile sind zu bevorzugen.",
  kb: "Geschlossene Profile sind zu begruenden.",
};

interface Stand {
  /** Die Quelle der naechsten Antwort, je Frage in Reihenfolge. */
  quellen: string[];
  /** Welche Quellen-Abrufe HAENGEN (verspaeteter Ruecklauf). */
  haelt: Set<string>;
}

function starten(stand: Stand): Lauf {
  let frage = 0;
  return panelStarten((url, methode): Antwort => {
    if (url === "/api/auth/me") return { status: 200, body: { name: "Pedi" } };
    if (url === "/api/reasoner/status") {
      return { status: 200, body: { enabled: false, reachable: "none" } };
    }
    if (url === "/api/ask") {
      const quelle = stand.quellen[frage] ?? "ka";
      frage += 1;
      return {
        status: 200,
        body: {
          result: {
            answered: true,
            answer: ANTWORT[quelle],
            sources: [quelle],
            citedSources: [quelle],
            trust: 80,
            steps: [],
            evidence: { grade: "verified" },
          },
          gap: null,
          receipt: "r",
        },
      };
    }
    if (url.startsWith("/api/kos/")) {
      const id = decodeURIComponent(url.slice("/api/kos/".length));
      if (stand.haelt.has(id)) return "haengt";
      return { status: 200, body: ko(id) };
    }
    if (methode === "HEAD") return { status: 200 };
    return { status: 401 };
  });
}

function ko(id: string): Record<string, unknown> {
  return { id, title: TITEL[id] ?? id, status: "validiert", trust: 80 };
}

async function fragen(text: string): Promise<void> {
  el<HTMLTextAreaElement>("ask-input").value = text;
  el("ask-btn").click();
  await ruhe();
}

function chips(): Array<string | null> {
  return [...document.querySelectorAll("#ask-sources li.quelle-chip")].map((c) =>
    c.getAttribute("data-quelle"),
  );
}
function ziffern(): Array<string | null> {
  return [...document.querySelectorAll("#ask-fussnoten sup.fussnote")].map((s) =>
    s.getAttribute("data-quelle"),
  );
}
function chipTitel(): string[] {
  return [...document.querySelectorAll("#ask-sources li.quelle-chip")].map((c) =>
    (c.textContent ?? "").replace(/\s+/g, " ").trim(),
  );
}

/** Eine Zwischenablage, die mitschreibt — Kopieren geht ueber navigator.clipboard.writeText. */
function zwischenablage(): string[] {
  const kopiert: string[] = [];
  Object.defineProperty(window.navigator, "clipboard", {
    value: {
      writeText: (t: string) => {
        kopiert.push(t);
        return Promise.resolve();
      },
    },
    configurable: true,
  });
  return kopiert;
}

describe("JOB 3056 R6 · Quellen-Rennen — der Ruecklauf von Frage 1 aendert Frage 2 nicht", () => {
  afterEach(() => {
    panelAbraeumen();
  });

  it("Frage 1 (Abruf haengt) → Frage 2 (aufgeloest) → Freigabe von Abruf 1: Chip, Ziffer, Text und der KOPIERTE Text gehoeren weiter Frage 2", async () => {
    const stand: Stand = { quellen: ["ka", "kb"], haelt: new Set(["ka"]) };
    const lauf = starten(stand);
    const kopiert = zwischenablage();
    await ruhe();

    await fragen("Frage eins?");
    expect(el<HTMLTextAreaElement>("ask-answer-edit").value).toBe(ANTWORT.ka);
    expect(lauf.offen(), "der Quellen-Abruf von Frage 1 haengt").toBe(1);
    expect(chips()).toEqual([]);
    expect(el<HTMLButtonElement>("ask-copy-btn").disabled).toBe(true);

    // Das Feld unten IST die neue Frage — sie geht ab, waehrend der Abruf von Frage 1 noch haengt.
    await fragen("Frage zwei?");
    expect(el<HTMLTextAreaElement>("ask-answer-edit").value).toBe(ANTWORT.kb);
    expect(chips()).toEqual(["kb"]);
    expect(chipTitel()).toEqual([`1 · ${TITEL.kb}`]);
    expect(ziffern()).toEqual(["kb"]);
    expect(el<HTMLButtonElement>("ask-copy-btn").disabled).toBe(false);

    // Jetzt trifft der verspaetete Ruecklauf von Frage 1 ein.
    lauf.freigeben(0, { status: 200, body: ko("ka") });
    await ruhe();
    expect(el<HTMLTextAreaElement>("ask-answer-edit").value).toBe(ANTWORT.kb);
    expect(chips()).toEqual(["kb"]);
    expect(chipTitel()).toEqual([`1 · ${TITEL.kb}`]);
    expect(ziffern()).toEqual(["kb"]);
    expect(sichtbar(el("ask-sources-block"))).toBe(true);
    // Und die Quellen-Zeile des kopierten Texts nennt die Quelle von Frage 2 — nicht die von Frage 1.
    el("ask-copy-btn").click();
    await ruhe();
    expect(kopiert.length).toBe(1);
    expect(kopiert[0]).toContain(ANTWORT.kb);
    expect(kopiert[0]).toContain(TITEL.kb);
    expect(kopiert[0]).not.toContain(TITEL.ka);
  });

  it("haengen BEIDE Abrufe, oeffnet der verspaetete Ruecklauf von Frage 1 das Ausgabetor der Frage 2 NICHT — erst ihr eigener", async () => {
    const stand: Stand = { quellen: ["ka", "kb"], haelt: new Set(["ka", "kb"]) };
    const lauf = starten(stand);
    await ruhe();
    await fragen("Frage eins?");
    await fragen("Frage zwei?");
    expect(el<HTMLTextAreaElement>("ask-answer-edit").value).toBe(ANTWORT.kb);
    expect(lauf.offen()).toBe(2);
    expect(el<HTMLButtonElement>("ask-copy-btn").disabled).toBe(true);

    lauf.freigeben(0, { status: 200, body: ko("ka") });
    await ruhe();
    expect(el<HTMLButtonElement>("ask-copy-btn").disabled).toBe(true);
    expect(el<HTMLButtonElement>("ask-insert-btn").disabled).toBe(true);
    expect(chips()).toEqual([]);
    expect(ziffern()).toEqual([]);

    lauf.freigeben(1, { status: 200, body: ko("kb") });
    await ruhe();
    expect(el<HTMLButtonElement>("ask-copy-btn").disabled).toBe(false);
    expect(chips()).toEqual(["kb"]);
    expect(ziffern()).toEqual(["kb"]);
  });

  it("der Zurueck-Chevron waehrend eines haengenden Abrufs: der spaete Ruecklauf bringt weder Chip noch Ziffer in die Ruhe zurueck", async () => {
    const stand: Stand = { quellen: ["ka"], haelt: new Set(["ka"]) };
    const lauf = starten(stand);
    await ruhe();
    await fragen("Frage eins?");
    expect(lauf.offen()).toBe(1);
    el("kw-zurueck").click();
    await ruhe();
    expect(sichtbar(el("ask-answer-block"))).toBe(false);
    lauf.freigeben(0, { status: 200, body: ko("ka") });
    await ruhe();
    expect(sichtbar(el("ask-answer-block"))).toBe(false);
    expect(sichtbar(el("ask-sources-block"))).toBe(false);
    expect(chips()).toEqual([]);
    expect(ziffern()).toEqual([]);
    expect(el<HTMLButtonElement>("ask-copy-btn").disabled).toBe(true);
  });

  it("KALIBRIERUNG: derselbe Ablauf OHNE Verspaetung — die Quelle von Frage 2 kommt an; der Test sieht also Chips, wenn es welche gibt", async () => {
    const stand: Stand = { quellen: ["ka", "kb"], haelt: new Set() };
    starten(stand);
    await ruhe();
    await fragen("Frage eins?");
    expect(chips()).toEqual(["ka"]);
    await fragen("Frage zwei?");
    expect(chips()).toEqual(["kb"]);
    expect(ziffern()).toEqual(["kb"]);
  });
});
