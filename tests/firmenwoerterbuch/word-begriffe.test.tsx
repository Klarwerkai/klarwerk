// @vitest-environment jsdom
// ================================================================================================
// FIRMENWÖRTERBUCH IN WORD (`begriffe.js`) — K2 und K4 am Word-Panel, gegen eine Word-Attrappe.
// ================================================================================================
//
// WAS HIER LÄUFT: die ausgelieferte Datei `apps/web/public/word-addin/begriffe.js`, unverändert,
// über dem ECHTEN Markup des Blocks aus `taskpane.html`. Die Antwort des Servers rechnet der echte
// Fachkern (`begriffsHinweise`) aus genau den Absätzen, die das Panel sendet.
//
// WAS HIER NICHT LÄUFT, und das gehört zur Aussage: kein echtes Word. Die Attrappe bildet die
// Office.js-Aufrufe nach, die das Panel benutzt (`body.paragraphs`, `Paragraph.search` mit
// `matchCase`/`matchWholeWord`, `Range.insertText(…, "Replace")`), und hält jeden Absatz als Folge
// formatierter Läufe. Dass Word beim Ersetzen die Zeichenformatierung der Stelle übernimmt, ist
// Words dokumentiertes Verhalten und wird hier NACHGEBILDET, nicht gemessen. Gemessen wird, dass
// das Panel genau EINE Stelle ersetzt — die gemeinte — und sonst nichts anfasst.
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type BegriffFassung, begriffsHinweise } from "../../services/app/src/firmenwoerterbuch";
import { repoPfad } from "../support/repoPfad";

interface Lauf {
  text: string;
  fett: boolean;
}

const KONTO: BegriffFassung = {
  id: "b-konto",
  version: 3,
  geltungsbereich: "Vertrieb",
  verantwortlich: "Vertriebsinnendienst",
  definition: { de: "Das Konto eines Kunden im Abrechnungssystem." },
  bezeichnungen: {
    de: { vorzug: "Kundenkonto", synonyme: ["Debitorenkonto"], unerwuenscht: ["Kundenaccount"] },
  },
  geaendertVon: "u-carla",
  geaendertAm: "2026-10-06T08:00:00.000Z",
};

// --- Die Word-Attrappe ---------------------------------------------------------------------------

let absaetze: Lauf[][] = [];
const ersetzungen: { absatz: number; alt: string; neu: string; ort: string }[] = [];
let suchtGanzeWoerter = true;

function absatzText(laeufe: Lauf[]): string {
  return laeufe.map((l) => l.text).join("");
}

function istWortzeichen(z: string | undefined): boolean {
  return z !== undefined && /[\p{L}\p{N}_]/u.test(z);
}

/** Ein Bereich im Absatz: ersetzt seinen Text im Lauf, in dem er beginnt — Formatierung bleibt. */
function bereich(absatz: number, start: number, laenge: number) {
  const laeufe = absaetze[absatz] as Lauf[];
  return {
    text: absatzText(laeufe).slice(start, start + laenge),
    insertText(neu: string, ort: string) {
      let pos = 0;
      for (const lauf of laeufe) {
        if (start >= pos && start + laenge <= pos + lauf.text.length) {
          const i = start - pos;
          const alt = lauf.text.slice(i, i + laenge);
          lauf.text = lauf.text.slice(0, i) + neu + lauf.text.slice(i + laenge);
          ersetzungen.push({ absatz, alt, neu, ort });
          return;
        }
        pos += lauf.text.length;
      }
      throw new Error("Attrappe: Bereich über Laufgrenzen");
    },
  };
}

function absatzObjekt(index: number) {
  return {
    get text() {
      return absatzText(absaetze[index] as Lauf[]);
    },
    search(begriff: string, optionen: { matchCase?: boolean; matchWholeWord?: boolean }) {
      const text = absatzText(absaetze[index] as Lauf[]);
      const items: ReturnType<typeof bereich>[] = [];
      const heu = optionen.matchCase ? text : text.toLowerCase();
      const nadel = optionen.matchCase ? begriff : begriff.toLowerCase();
      let i = heu.indexOf(nadel);
      while (i >= 0) {
        const ganz = !istWortzeichen(text[i - 1]) && !istWortzeichen(text[i + begriff.length]);
        if (ganz || !(optionen.matchWholeWord && suchtGanzeWoerter)) {
          items.push(bereich(index, i, begriff.length));
        }
        i = heu.indexOf(nadel, i + 1);
      }
      return { items, load() {} };
    },
  };
}

function wordAttrappe() {
  return {
    run(arbeit: (kontext: unknown) => Promise<unknown>) {
      const paragraphs = {
        items: absaetze.map((_, i) => absatzObjekt(i)),
        load() {},
      };
      const kontext = { document: { body: { paragraphs } }, sync: () => Promise.resolve() };
      return Promise.resolve().then(() => arbeit(kontext));
    },
  };
}

// --- Fenster-Globale, Server und Panel -----------------------------------------------------------

const anfragen: { url: string; body: unknown }[] = [];
const g = globalThis as unknown as Record<string, unknown>;
const echtesFetch = g.fetch;

function serverAntwort(url: string, init?: { body?: string }) {
  const body = init?.body ? JSON.parse(init.body) : undefined;
  anfragen.push({ url, body });
  if (url === "/api/begriffe/pruefen") {
    const daten = begriffsHinweise([KONTO], body.segmente, body.kontext);
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(daten) });
  }
  if (url === "/api/begriffe") {
    const daten = { begriffe: [KONTO] };
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(daten) });
  }
  return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
}

function blockMarkup(): string {
  const html = readFileSync(repoPfad("apps/web/public/word-addin/taskpane.html"), "utf8");
  const treffer = html.match(/<div id="begriffe-block"[^\n]*<\/ul><\/div>/);
  if (!treffer) {
    throw new Error("taskpane.html: #begriffe-block nicht gefunden");
  }
  return treffer[0];
}

async function ruhe(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

function panelStarten(): void {
  document.body.innerHTML = `<div id="ask-ruhe"></div>${blockMarkup()}`;
  g.lang = "de";
  g.signedIn = true;
  g.bestandSitzung = "id:u-erik";
  g.officeUsable = () => true;
  g.bestandRuheSichtbar = () => true;
  g.bestandZeichnen = () => {};
  g.setLang = (next: string) => {
    g.lang = next;
  };
  g.Word = wordAttrappe();
  g.fetch = serverAntwort;
  const quelle = readFileSync(repoPfad("apps/web/public/word-addin/begriffe.js"), "utf8");
  // Wie ein klassisches Skript: es liest und überschreibt die Globalen des Fensters. Seine eigenen
  // Namen bleiben im Funktionsrumpf — jeder Fall startet mit frischem Zustand.
  new Function(quelle)();
  if (document.readyState === "loading") {
    document.dispatchEvent(new Event("DOMContentLoaded"));
  }
}

function knoepfe(klasse: string): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>(`#begriffe-liste .${klasse}`)];
}

function hinweisZeilen(): string[] {
  return [...document.querySelectorAll("#begriffe-liste li")].map((li) => li.textContent ?? "");
}

beforeEach(() => {
  absaetze = [
    [
      { text: "Bitte das ", fett: false },
      { text: "Kundenaccount", fett: true },
      { text: " prüfen.", fett: false },
    ],
    [{ text: "Kundenaccount und Kundenaccount.", fett: false }],
    [{ text: "Das Debitorenkonto ist korrekt.", fett: false }],
  ];
  ersetzungen.length = 0;
  anfragen.length = 0;
  suchtGanzeWoerter = true;
});

afterEach(() => {
  g.fetch = echtesFetch;
  for (const name of ["lang", "signedIn", "bestandSitzung", "officeUsable", "Word"]) {
    delete g[name];
  }
  for (const name of ["bestandRuheSichtbar", "bestandZeichnen", "setLang"]) {
    delete g[name];
  }
  document.body.innerHTML = "";
});

describe("K2 · Word-Host: unerwünschte Varianten mit nachvollziehbarer Vorzugsbezeichnung", () => {
  it("der Block steht nur angemeldet mit offenem Dokument im Bild", async () => {
    panelStarten();
    const block = document.getElementById("begriffe-block") as HTMLElement;
    expect(block.className).toBe("");
    g.signedIn = false;
    (g.bestandZeichnen as () => void)();
    expect(block.className).toBe("hidden");
  });

  it("„Begriffe prüfen“ sendet die Absätze und den gewählten Bereich, zeigt Herkunft und Bedeutung", async () => {
    panelStarten();
    const auswahl = document.getElementById("begriffe-bereich") as HTMLSelectElement;
    // Die Bereiche werden erst geholt, wenn jemand die Auswahl anfasst — vorher kein Abruf.
    expect(anfragen).toEqual([]);
    auswahl.dispatchEvent(new Event("mousedown"));
    await ruhe();
    expect([...auswahl.options].map((o) => o.value)).toEqual(["", "Vertrieb"]);
    auswahl.value = "Vertrieb";

    (document.getElementById("begriffe-btn") as HTMLButtonElement).click();
    await ruhe();

    const pruefung = anfragen.find((a) => a.url === "/api/begriffe/pruefen");
    expect(pruefung?.body).toEqual({
      segmente: [
        "Bitte das Kundenaccount prüfen.",
        "Kundenaccount und Kundenaccount.",
        "Das Debitorenkonto ist korrekt.",
      ],
      kontext: "Vertrieb",
    });
    const zeilen = hinweisZeilen();
    // Drei Fundstellen; das zugelassene Synonym „Debitorenkonto“ ist keine.
    expect(zeilen).toHaveLength(3);
    expect(zeilen[0]).toContain("„Kundenaccount“ → im Haus heißt es „Kundenkonto“");
    expect(zeilen[0]).toContain("Bedeutung: Das Konto eines Kunden im Abrechnungssystem.");
    expect(zeilen[0]).toContain("Geltungsbereich „Vertrieb“, Fassung 3");
    expect(document.getElementById("begriffe-grenze")?.textContent).toContain(
      "nicht, ob die Aussage sachlich stimmt",
    );
    expect(ersetzungen).toEqual([]);
  });
});

describe("K4 · Word-Host: Übernehmen und Verwerfen am gewählten Text", () => {
  it("Übernehmen ersetzt genau die zweite Stelle im Absatz — sonst bleibt alles, wie es war", async () => {
    panelStarten();
    (document.getElementById("begriffe-btn") as HTMLButtonElement).click();
    await ruhe();
    // Die dritte Zeile ist die ZWEITE Stelle im zweiten Absatz.
    (knoepfe("begriffe-uebernehmen")[2] as HTMLButtonElement).click();
    await ruhe();

    expect(ersetzungen).toEqual([
      { absatz: 1, alt: "Kundenaccount", neu: "Kundenkonto", ort: "Replace" },
    ]);
    expect(absatzText(absaetze[1] as Lauf[])).toBe("Kundenaccount und Kundenkonto.");
    expect(absatzText(absaetze[0] as Lauf[])).toBe("Bitte das Kundenaccount prüfen.");
    expect(absatzText(absaetze[2] as Lauf[])).toBe("Das Debitorenkonto ist korrekt.");
    expect(document.getElementById("begriffe-stand")?.textContent).toContain(
      "Übernommen: „Kundenkonto“.",
    );
  });

  it("Übernehmen an einer fett gesetzten Stelle: der Lauf bleibt fett, die Nachbarläufe bleiben", async () => {
    panelStarten();
    (document.getElementById("begriffe-btn") as HTMLButtonElement).click();
    await ruhe();
    (knoepfe("begriffe-uebernehmen")[0] as HTMLButtonElement).click();
    await ruhe();
    expect(absaetze[0]).toEqual([
      { text: "Bitte das ", fett: false },
      { text: "Kundenkonto", fett: true },
      { text: " prüfen.", fett: false },
    ]);
    expect(ersetzungen).toHaveLength(1);
  });

  it("Verwerfen blendet nur diesen Hinweis aus und ändert am Dokument nichts", async () => {
    panelStarten();
    (document.getElementById("begriffe-btn") as HTMLButtonElement).click();
    await ruhe();
    const vorher = JSON.stringify(absaetze);
    (knoepfe("begriffe-verwerfen")[1] as HTMLButtonElement).click();
    await ruhe();
    expect(JSON.stringify(absaetze)).toBe(vorher);
    expect(ersetzungen).toEqual([]);
    expect(hinweisZeilen()).toHaveLength(2);
  });

  it("hat sich der Absatz seit der Prüfung geändert, wird NICHTS ersetzt", async () => {
    panelStarten();
    (document.getElementById("begriffe-btn") as HTMLButtonElement).click();
    await ruhe();
    absaetze[1] = [{ text: "Kundenaccount wurde inzwischen umformuliert.", fett: false }];
    (knoepfe("begriffe-uebernehmen")[1] as HTMLButtonElement).click();
    await ruhe();
    expect(ersetzungen).toEqual([]);
    expect(document.getElementById("begriffe-stand")?.textContent).toContain(
      "Der Absatz hat sich seit der Prüfung geändert",
    );
  });

  it("findet Word die Stelle nicht eindeutig (andere Zählung), wird NICHTS ersetzt", async () => {
    absaetze[1] = [{ text: "Kundenaccount und Kundenaccounts.", fett: false }];
    panelStarten();
    (document.getElementById("begriffe-btn") as HTMLButtonElement).click();
    await ruhe();
    // Die Attrappe sucht jetzt NICHT als ganzes Wort — „Kundenaccounts“ zählt mit.
    suchtGanzeWoerter = false;
    (knoepfe("begriffe-uebernehmen")[1] as HTMLButtonElement).click();
    await ruhe();
    expect(ersetzungen).toEqual([]);
    expect(document.getElementById("begriffe-stand")?.textContent).toContain(
      "nicht eindeutig zu finden",
    );
  });

  it("eine andere Sitzung sieht die Hinweise der vorigen nicht", async () => {
    panelStarten();
    (document.getElementById("begriffe-btn") as HTMLButtonElement).click();
    await ruhe();
    expect(hinweisZeilen()).toHaveLength(3);
    g.bestandSitzung = "id:u-carla";
    (g.bestandZeichnen as () => void)();
    expect(hinweisZeilen()).toEqual([]);
  });
});
