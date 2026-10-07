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
// formatierter Läufe. Nacharbeit 6: Bis hierher bildete die Attrappe ab, dass Word beim Ersetzen
// die Formatierung der Stelle übernimmt. Im ECHTEN Word im Web ist das nicht so
// (WORD-KANDIDAT/WORD-WEB-FORMAT-20261007.json): der neue Text steht in einem eigenen Lauf ohne
// fett/kursiv. Die Attrappe bildet jetzt genau dieses gemessene Verhalten nach; gemessen wird, dass
// das Panel genau EINE Stelle ersetzt und deren Formatierung selbst wiederherstellt.
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type BegriffFassung, begriffsHinweise } from "../../services/app/src/firmenwoerterbuch";
import { repoPfad } from "../support/repoPfad";

interface Lauf {
  text: string;
  fett: boolean;
  kursiv?: boolean;
}

const KONTO: BegriffFassung = {
  id: "b-konto",
  version: 3,
  geltungsbereich: "Vertrieb",
  verantwortlich: "Vertriebsinnendienst",
  definition: {
    de: "Das Konto eines Kunden im Abrechnungssystem.",
    en: "A customer's account in the billing system.",
  },
  bezeichnungen: {
    de: { vorzug: "Kundenkonto", synonyme: ["Debitorenkonto"], unerwuenscht: ["Kundenaccount"] },
    en: { vorzug: "customer account", synonyme: [], unerwuenscht: ["client account"] },
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

/** Die Läufe, die den Bereich berühren. */
function beruehrt(laeufe: Lauf[], start: number, laenge: number): Lauf[] {
  let pos = 0;
  const raus: Lauf[] = [];
  for (const lauf of laeufe) {
    if (pos < start + laenge && start < pos + lauf.text.length) {
      raus.push(lauf);
    }
    pos += lauf.text.length;
  }
  return raus;
}

/** Word.Font eines Bereichs: true/false, wenn einheitlich, sonst `null` wie in Word. */
function schriftVon(laeufe: Lauf[], start: number, laenge: number) {
  const einheitlich = (merkmal: (l: Lauf) => boolean): boolean | null => {
    const teile = beruehrt(laeufe, start, laenge);
    if (teile.every(merkmal)) {
      return true;
    }
    return teile.some(merkmal) ? null : false;
  };
  return {
    load() {},
    get bold() {
      return einheitlich((l) => l.fett);
    },
    get italic() {
      return einheitlich((l) => l.kursiv === true);
    },
  };
}

/**
 * Ein Bereich im Absatz. `insertText(…, "Replace")` verhält sich wie im echten Word im Web
 * gemessen: der neue Text steht in einem EIGENEN Lauf ohne fett/kursiv; die Läufe davor und
 * danach behalten ihre Formatierung. Zurück kommt der neue Bereich, dessen Schrift setzbar ist.
 */
function bereich(absatz: number, start: number, laenge: number) {
  const laeufe = absaetze[absatz] as Lauf[];
  return {
    text: absatzText(laeufe).slice(start, start + laenge),
    font: schriftVon(laeufe, start, laenge),
    insertText(neu: string, ort: string) {
      const alt = absatzText(laeufe).slice(start, start + laenge);
      const neuerLauf: Lauf = { text: neu, fett: false, kursiv: false };
      const raus: Lauf[] = [];
      let pos = 0;
      let eingesetzt = false;
      for (const lauf of laeufe) {
        const von = pos;
        pos += lauf.text.length;
        if (pos <= start || von >= start + laenge) {
          if (von >= start + laenge && !eingesetzt) {
            raus.push(neuerLauf);
            eingesetzt = true;
          }
          raus.push(lauf);
          continue;
        }
        const vor = lauf.text.slice(0, Math.max(0, start - von));
        const nach = lauf.text.slice(Math.min(lauf.text.length, start + laenge - von));
        if (vor) {
          raus.push({ ...lauf, text: vor });
        }
        if (!eingesetzt) {
          raus.push(neuerLauf);
          eingesetzt = true;
        }
        if (nach) {
          raus.push({ ...lauf, text: nach });
        }
      }
      if (!eingesetzt) {
        raus.push(neuerLauf);
      }
      laeufe.splice(0, laeufe.length, ...raus);
      ersetzungen.push({ absatz, alt, neu, ort });
      return {
        font: {
          set bold(wert: boolean) {
            neuerLauf.fett = wert;
          },
          set italic(wert: boolean) {
            neuerLauf.kursiv = wert;
          },
        },
      };
    },
  };
}

/** Die Läufe eines Absatzes als [Text, fett, kursiv] — fehlendes `kursiv` heisst nicht kursiv. */
function laeufeVon(absatz: number): [string, boolean, boolean][] {
  return (absaetze[absatz] as Lauf[]).map((l) => [l.text, l.fett, l.kursiv === true]);
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
    expect(laeufeVon(0)).toEqual([
      ["Bitte das ", false, false],
      ["Kundenkonto", true, false],
      [" prüfen.", false, false],
    ]);
    expect(ersetzungen).toHaveLength(1);
  });

  it("Gegenprobe zur Attrappe: Words Ersetzen allein verliert die Formatierung (wie gemessen)", () => {
    // Ohne das Panel: genau der Aufruf, den das Panel bis Nacharbeit 6 allein machte.
    absaetze = [[{ text: "Das Kundenaccount bleibt erhalten.", fett: true }]];
    bereich(0, 4, "Kundenaccount".length).insertText("Kundenkonto", "Replace");
    expect(laeufeVon(0)).toEqual([
      ["Das ", true, false],
      ["Kundenkonto", false, false],
      [" bleibt erhalten.", true, false],
    ]);
  });

  it("DE fett: der ersetzte Begriff bleibt fett, die übrigen Satzteile bleiben fett", async () => {
    absaetze = [[{ text: "Das Kundenaccount bleibt erhalten.", fett: true }]];
    panelStarten();
    (document.getElementById("begriffe-btn") as HTMLButtonElement).click();
    await ruhe();
    (knoepfe("begriffe-uebernehmen")[0] as HTMLButtonElement).click();
    await ruhe();
    expect(laeufeVon(0)).toEqual([
      ["Das ", true, false],
      ["Kundenkonto", true, false],
      [" bleibt erhalten.", true, false],
    ]);
  });

  it("EN kursiv: der ersetzte Begriff bleibt kursiv, die übrigen Satzteile bleiben kursiv", async () => {
    absaetze = [[{ text: "The QA client account remains unchanged.", fett: false, kursiv: true }]];
    panelStarten();
    (document.getElementById("begriffe-btn") as HTMLButtonElement).click();
    await ruhe();
    expect(hinweisZeilen()[0]).toContain("customer account");
    (knoepfe("begriffe-uebernehmen")[0] as HTMLButtonElement).click();
    await ruhe();
    expect(laeufeVon(0)).toEqual([
      ["The QA ", false, true],
      ["customer account", false, true],
      [" remains unchanged.", false, true],
    ]);
  });

  it("gemischt formatierte Fundstelle: keine Formatierung wird auf den ganzen Begriff ausgeweitet", async () => {
    absaetze = [
      [
        { text: "Das Kunden", fett: false },
        { text: "account", fett: true },
        { text: " bleibt.", fett: false },
      ],
    ];
    panelStarten();
    (document.getElementById("begriffe-btn") as HTMLButtonElement).click();
    await ruhe();
    (knoepfe("begriffe-uebernehmen")[0] as HTMLButtonElement).click();
    await ruhe();
    // Word meldet `bold: null`; das Panel setzt dann kein Fett. Fremde Läufe bleiben unverändert.
    expect(laeufeVon(0)).toEqual([
      ["Das ", false, false],
      ["Kundenkonto", false, false],
      [" bleibt.", false, false],
    ]);
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

  it("zwei identische Absätze: Verwerfen blendet genau einen aus — auch nach Neuzeichnen und Neuprüfen", async () => {
    absaetze = [
      [{ text: "Das Kundenaccount ist neu.", fett: false }],
      [{ text: "Das Kundenaccount ist neu.", fett: false }],
    ];
    panelStarten();
    const absatzNummern = (): string[] =>
      [...document.querySelectorAll("#begriffe-liste li")].map(
        (li) => li.getAttribute("data-absatz") ?? "",
      );
    (document.getElementById("begriffe-btn") as HTMLButtonElement).click();
    await ruhe();
    expect(absatzNummern()).toEqual(["0", "1"]);
    const vorher = JSON.stringify(absaetze);

    (knoepfe("begriffe-verwerfen")[0] as HTMLButtonElement).click();
    await ruhe();
    expect(absatzNummern()).toEqual(["1"]);
    expect(JSON.stringify(absaetze)).toBe(vorher);

    // Neu zeichnen (wie bei jeder Lage des Fensters) und neu prüfen: der fremde Hinweis bleibt.
    (g.bestandZeichnen as () => void)();
    expect(absatzNummern()).toEqual(["1"]);
    (document.getElementById("begriffe-btn") as HTMLButtonElement).click();
    await ruhe();
    expect(absatzNummern()).toEqual(["1"]);
    expect(JSON.stringify(absaetze)).toBe(vorher);
    expect(ersetzungen).toEqual([]);

    // Und der verbliebene Hinweis gehört wirklich zum ZWEITEN Absatz.
    (knoepfe("begriffe-uebernehmen")[0] as HTMLButtonElement).click();
    await ruhe();
    expect(absaetze.map((a) => absatzText(a))).toEqual([
      "Das Kundenaccount ist neu.",
      "Das Kundenkonto ist neu.",
    ]);
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
