// @vitest-environment jsdom
// ================================================================================================
// Ben Nacharbeit 2 — R-0625 / R-0703 / R-1020 / R-1695, GEMESSEN AM ECHTEN EXPORTAUFRUF.
// ================================================================================================
//
// Montiert wird die echte Fragenseite (`pages/Ask.tsx`) mit vier Antwortkörpern:
//   modell        gültige Servermarke                    → Herkunft „ki"
//   rueckfall     `demo: true`, keine Marke               → Herkunft „ohne-ki" (belegt modellfrei)
//   ohneMarke     `demo: false`, keine Marke              → Herkunft „unbekannt"
//   kaputteMarke  `demo: false`, `aiGenerated: true` nackt → Herkunft „unbekannt" (G24)
//
// Für jede Lage wird das „…"-Menü der Antwortkarte bedient, jeder Download ausgelöst und die
// HERUNTERGELADENE Datei geöffnet — nicht der Helfer gerufen:
//   · Markdown   Kopfblock `ai-generated: true`
//   · .docx/.pptx  ZIP entpackt (eigener Leser, eigene CRC-Prüfung), `docProps/custom.xml` mit
//                  `ai-generated`, `docProps/core.xml` mit Beschreibung; jedes XML wohlgeformt
//   · .pdf       `/Info` mit `/AIGenerated true`, `/Subject` (UTF-16BE) = der Kennzeichnungssatz
// Erwartung (R-0625, Ben): NUR „ohne-ki" schaltet die Kennzeichnung aus; „unbekannt" behält sie.
//
// Dazu die Stufe der Antwortkarte (R-1020 / R-1695): Entwurf (gestrichelte violette Fläche über
// `data-reasoner-entwurf`, Beschriftung „Reasoner-Entwurf, nicht validiert"), Empfehlung,
// Validiert — gelesen am gerenderten DOM.
//
// GRENZE, AUSDRÜCKLICH: jsdom rechnet kein CSS. Dass `data-reasoner-entwurf` WIRKLICH gestrichelt
// und violett malt, belegt hier nur die Regel in `index.css` (Quelltext); das Öffnen der Dateien in
// Word, PowerPoint und einem PDF-Betrachter ist eine Menschenprobe und hier nicht ersetzt.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// Ben Nacharbeit 4: `kaputteMarkeRueckfall` = ungültige Marke UND `demo: true` — widersprüchliche
// Angaben, die bis dahin als „ohne-ki" galten und die Exportkennzeichnung abschalteten.
type Lage = "modell" | "rueckfall" | "ohneMarke" | "kaputteMarke" | "kaputteMarkeRueckfall";

const bestand = vi.hoisted(() => ({
  kos: [] as unknown[],
  lage: "modell" as Lage,
  // Nacharbeit 4: ein abweichender Antworttext (PDF-Inhaltserhaltung); `null` = der Standardtext.
  antwort: null as string | null,
}));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: { list: vi.fn(async () => bestand.kos) },
    conflicts: { list: vi.fn(async () => []) },
    directory: { list: vi.fn(async () => []) },
    reasoner: {
      status: vi.fn(async () => ({
        active: true,
        mode: "cloud",
        reachable: "active",
        tasks: { answer: true },
      })),
    },
    ask: {
      ask: vi.fn(async () => {
        const marke =
          bestand.lage === "modell"
            ? {
                aiGenerated: {
                  aiGenerated: true,
                  task: "answer",
                  mode: "model",
                  at: "2026-10-08T00:00:00.000Z",
                },
              }
            : bestand.lage === "kaputteMarke" || bestand.lage === "kaputteMarkeRueckfall"
              ? { aiGenerated: true }
              : {};
        return {
          result: {
            answered: true,
            answer: bestand.antwort ?? "Ventil V4 wird jährlich geprüft.",
            knowledgeClass: "gesichert",
            trust: 90,
            sources: ["k1"],
            citedSources: ["k1"],
            steps: [],
            demo: bestand.lage === "rueckfall" || bestand.lage === "kaputteMarkeRueckfall",
            captionSources: [],
            ...marke,
          },
          gap: null,
          receipt: "r",
        };
      }),
      helpful: vi.fn(),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { ErgebnisStufeMarke, ReasonerDraft } from "../../apps/web/src/components/trust";
import i18n from "../../apps/web/src/i18n";
import {
  ergebnisStufeFuerAntwort,
  ergebnisStufeFuerVorschlag,
  kiHerkunftAus,
} from "../../apps/web/src/lib/kiHerkunft";
import { Ask } from "../../apps/web/src/pages/Ask";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const WURZEL = join(__dirname, "..", "..");
const lies = (pfad: string): string => readFileSync(join(WURZEL, pfad), "utf8");

const BELEGT = {
  available: 4,
  selected: 4,
  alreadyOpen: 0,
  attempted: 4,
  completed: 4,
  skipped: 0,
  capped: false,
  aborted: false,
};

function ko() {
  return {
    id: "k1",
    title: "Ventilprüfung",
    statement: "Ventil V4 wird jährlich geprüft.",
    type: "best_practice",
    category: "Betrieb",
    status: "validiert",
    trust: 90,
    author: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    aiCheck: { status: "done", coverage: BELEGT },
  };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

interface Flaeche {
  container: HTMLElement;
  unmount: () => void;
}

async function montiereIn(lage: Lage): Promise<Flaeche> {
  await i18n.changeLanguage("de");
  bestand.lage = lage;
  bestand.kos = [ko()];
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          { initialEntries: ["/fragen?q=Ventil&ask=1"] },
          // Nacharbeit 5: der Provider hält Meldungen nur im Zustand — angezeigt werden sie von der
          // App-Hülle (`ToastViewport`). Ohne sie wäre jede Meldung unsichtbar, auch eine richtige.
          createElement(ToastProvider, null, createElement(Ask), createElement(ToastViewport)),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  expect(
    container.querySelector('[data-testid="ask-answer"]'),
    `${lage}: die Antwortkarte wurde nicht montiert — die Messung wäre leer`,
  ).not.toBeNull();
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/** Blob → Bytes über den FileReader der Umgebung (jsdom), ohne Annahme über `Blob.text()`. */
function bytesAus(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const leser = new FileReader();
    leser.onload = () => resolve(new Uint8Array(leser.result as ArrayBuffer));
    leser.onerror = () => reject(leser.error);
    leser.readAsArrayBuffer(blob);
  });
}

/** Bedient „…" → Menüpunkt und fängt die heruntergeladene Datei samt Namen und Typ ab. */
async function herunterladen(
  f: Flaeche,
  punkt: string,
): Promise<{ name: string; typ: string; bytes: Uint8Array }> {
  const { gefangen, namen } = await menuepunktBedienen(f, punkt);
  expect(gefangen.length, `„${punkt}“ hat keine Datei erzeugt`).toBe(1);
  const blob = gefangen[0] as Blob;
  return { name: namen[0] ?? "", typ: blob.type, bytes: await bytesAus(blob) };
}

/** Bedient „…" → Menüpunkt und gibt zurück, was dabei heruntergeladen wurde (auch: nichts). */
async function menuepunktBedienen(
  f: Flaeche,
  punkt: string,
): Promise<{ gefangen: Blob[]; namen: string[] }> {
  const gefangen: Blob[] = [];
  const namen: string[] = [];
  const echtesCreate = URL.createObjectURL;
  const echtesRevoke = URL.revokeObjectURL;
  const echterKlick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = (b: Blob | MediaSource) => {
    gefangen.push(b as Blob);
    return "blob:probe";
  };
  URL.revokeObjectURL = () => undefined;
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    namen.push(this.download);
  };
  try {
    const griff = f.container.querySelector<HTMLButtonElement>('[data-testid="ask-menu"]');
    expect(griff, "es gibt keinen „…“-Griff an der Antwortkarte").not.toBeNull();
    if (griff?.getAttribute("aria-expanded") !== "true") {
      await act(async () => {
        griff?.click();
        await flush();
      });
    }
    const knopf = f.container.querySelector<HTMLButtonElement>(
      `[data-testid="ask-menu-punkt-${punkt}"]`,
    );
    expect(knopf, `Menüpunkt „${punkt}“ fehlt`).not.toBeNull();
    await act(async () => {
      knopf?.click();
      await flush();
    });
  } finally {
    URL.createObjectURL = echtesCreate;
    URL.revokeObjectURL = echtesRevoke;
    HTMLAnchorElement.prototype.click = echterKlick;
  }
  return { gefangen, namen };
}

// ------------------------------------------------------------------------------------------------
// Ein UNABHÄNGIGER ZIP-Leser: Zentralverzeichnis → lokale Köpfe → Daten, CRC bitweise nachgerechnet
// (nicht über die Tabelle des Erzeugers — sonst prüfte der Erzeuger sich selbst).
// ------------------------------------------------------------------------------------------------
function crcBitweise(daten: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of daten) {
    c ^= byte;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function entpacke(bytes: Uint8Array): Map<string, string> {
  const sicht = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let ende = bytes.length - 22;
  while (ende >= 0 && sicht.getUint32(ende, true) !== 0x06054b50) {
    ende--;
  }
  expect(ende, "kein Ende-des-Zentralverzeichnisses — keine ZIP-Datei").toBeGreaterThanOrEqual(0);
  const anzahl = sicht.getUint16(ende + 10, true);
  let pos = sicht.getUint32(ende + 16, true);
  const dekodierer = new TextDecoder();
  const dateien = new Map<string, string>();
  for (let i = 0; i < anzahl; i++) {
    expect(sicht.getUint32(pos, true), "Zentralverzeichniseintrag beschädigt").toBe(0x02014b50);
    const methode = sicht.getUint16(pos + 10, true);
    const crc = sicht.getUint32(pos + 16, true);
    const groesse = sicht.getUint32(pos + 20, true);
    const namenslaenge = sicht.getUint16(pos + 28, true);
    const zusatz = sicht.getUint16(pos + 30, true);
    const kommentar = sicht.getUint16(pos + 32, true);
    const versatz = sicht.getUint32(pos + 42, true);
    const name = dekodierer.decode(bytes.subarray(pos + 46, pos + 46 + namenslaenge));
    expect(sicht.getUint32(versatz, true), `${name}: lokaler Kopf fehlt`).toBe(0x04034b50);
    expect(methode, `${name}: unerwartete Kompression`).toBe(0);
    const start =
      versatz + 30 + sicht.getUint16(versatz + 26, true) + sicht.getUint16(versatz + 28, true);
    const daten = bytes.subarray(start, start + groesse);
    expect(crcBitweise(daten), `${name}: Prüfsumme stimmt nicht`).toBe(crc);
    dateien.set(name, dekodierer.decode(daten));
    pos += 46 + namenslaenge + zusatz + kommentar;
  }
  return dateien;
}

function wohlgeformt(name: string, xml: string): Document {
  const dok = new DOMParser().parseFromString(xml, "application/xml");
  expect(dok.getElementsByTagName("parsererror").length, `${name} ist kein wohlgeformtes XML`).toBe(
    0,
  );
  return dok;
}

/** Die Eigenschaften eines Office-Pakets: benutzerdefiniert und Kern. */
function officeEigenschaften(
  bytes: Uint8Array,
  hauptteil: string,
): { custom: Map<string, string>; beschreibung: string | null; hauptText: string } {
  const dateien = entpacke(bytes);
  for (const [name, inhalt] of dateien) {
    if (name.endsWith(".xml") || name.endsWith(".rels")) {
      wohlgeformt(name, inhalt);
    }
  }
  const typen = dateien.get("[Content_Types].xml") ?? "";
  expect(typen, "der Hauptteil ist nicht im Inhaltstyp-Verzeichnis").toContain(`/${hauptteil}`);
  const haupt = dateien.get(hauptteil);
  expect(haupt, `${hauptteil} fehlt im Paket`).toBeDefined();
  const custom = new Map<string, string>();
  const customXml = dateien.get("docProps/custom.xml");
  if (customXml) {
    expect(typen).toContain("/docProps/custom.xml");
    expect(dateien.get("_rels/.rels") ?? "").toContain("docProps/custom.xml");
    for (const p of Array.from(wohlgeformt("custom", customXml).getElementsByTagName("property"))) {
      custom.set(p.getAttribute("name") ?? "", (p.textContent ?? "").trim());
    }
  }
  const core = wohlgeformt("core", dateien.get("docProps/core.xml") ?? "");
  const beschreibung = core.getElementsByTagName("dc:description")[0]?.textContent ?? null;
  const hauptText = wohlgeformt(hauptteil, haupt ?? "").documentElement.textContent ?? "";
  return { custom, beschreibung, hauptText };
}

/** Das /Info-Verzeichnis einer PDF-Datei — gelesen, nicht gerechnet. */
function pdfInfo(bytes: Uint8Array): { info: string; subject: string | null; text: string } {
  const roh = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  expect(roh.startsWith("%PDF-1.")).toBe(true);
  expect(roh.trimEnd().endsWith("%%EOF")).toBe(true);
  const infoNummer = /\/Info (\d+) 0 R/.exec(roh)?.[1];
  expect(infoNummer, "der Trailer verweist auf kein /Info-Verzeichnis").toBeDefined();
  const muster = new RegExp(`\\n${infoNummer} 0 obj\\n(<<[\\s\\S]*?>>)\\nendobj`);
  const info = muster.exec(roh)?.[1] ?? "";
  // xref-Versatz stimmt: an der genannten Stelle beginnt wirklich das Info-Objekt.
  const xref = Number(/startxref\n(\d+)/.exec(roh)?.[1]);
  expect(roh.slice(xref, xref + 4)).toBe("xref");
  const hex = /\/Subject <FEFF([0-9A-F]*)>/.exec(info)?.[1];
  let subject: string | null = null;
  if (hex !== undefined) {
    subject = "";
    for (let i = 0; i < hex.length; i += 4) {
      subject += String.fromCharCode(Number.parseInt(hex.slice(i, i + 4), 16));
    }
  }
  return { info, subject, text: roh };
}

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
  bestand.antwort = null;
});

const KENNZEICHNUNG_ERWARTET: Readonly<Record<Lage, boolean>> = {
  modell: true,
  rueckfall: false,
  ohneMarke: true,
  kaputteMarke: true,
  // Ben Nacharbeit 4: widersprüchliche Angaben sind unbekannt — die Kennzeichnung bleibt.
  kaputteMarkeRueckfall: true,
};
const LAGEN: readonly Lage[] = [
  "modell",
  "rueckfall",
  "ohneMarke",
  "kaputteMarke",
  "kaputteMarkeRueckfall",
];

describe("R-0625 · die Herkunft ist dreiwertig — nur belegt modellfrei schaltet aus", () => {
  it("die Ableitung", () => {
    const marke = { aiGenerated: true, task: "answer", mode: "model", at: "2026-10-08" };
    expect(kiHerkunftAus({ aiGenerated: marke, demo: false })).toBe("ki");
    expect(kiHerkunftAus({ demo: true })).toBe("ohne-ki");
    expect(kiHerkunftAus({ demo: false })).toBe("unbekannt");
    expect(kiHerkunftAus({ aiGenerated: true, demo: false })).toBe("unbekannt");
    expect(kiHerkunftAus({})).toBe("unbekannt");
  });

  it("Ben Nacharbeit 4 · eine ungültige Marke neben `demo: true` ist widersprüchlich → unbekannt", () => {
    for (const kaputt of [true, null, {}, "ja", 1, { aiGenerated: true, task: "answer" }]) {
      expect(kiHerkunftAus({ aiGenerated: kaputt, demo: true }), JSON.stringify(kaputt)).toBe(
        "unbekannt",
      );
    }
    // … und kann dadurch nie „validiert" werden, auch nicht bei gesicherter Einstufung.
    const herkunft = kiHerkunftAus({ aiGenerated: true, demo: true });
    expect(ergebnisStufeFuerAntwort(herkunft, true)).toBe("empfehlung");
  });

  for (const lage of LAGEN) {
    it(`Markdown-Download über das Menü · ${lage}`, async () => {
      const f = await montiereIn(lage);
      const datei = await herunterladen(f, "download");
      const md = new TextDecoder().decode(datei.bytes);
      expect(datei.name.endsWith(".md")).toBe(true);
      expect(md.includes("ai-generated: true"), `${lage}: Kopfblock`).toBe(
        KENNZEICHNUNG_ERWARTET[lage],
      );
      expect(md).toContain("Ventil V4 wird jährlich geprüft.");
      f.unmount();
    });
  }
});

describe("R-0703 · Word, PowerPoint und PDF tragen die Kennzeichnung in ihren Eigenschaften", () => {
  for (const lage of LAGEN) {
    it(`.docx über das Menü · ${lage}`, async () => {
      const f = await montiereIn(lage);
      const datei = await herunterladen(f, "docx");
      expect(datei.name).toMatch(/^klarwerk-antwort-\d{4}-\d{2}-\d{2}\.docx$/);
      expect(datei.typ).toBe(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      const e = officeEigenschaften(datei.bytes, "word/document.xml");
      expect(e.hauptText).toContain("Ventil V4 wird jährlich geprüft.");
      if (KENNZEICHNUNG_ERWARTET[lage]) {
        expect(e.custom.get("ai-generated")).toBe("true");
        expect(e.custom.get("ai-system")).toBe("KLARWERK");
        expect(e.custom.get("ai-task")).toBe("answer");
        expect(e.custom.get("ai-notice")).toContain("KLARWERK");
        expect(e.beschreibung).toBe(e.custom.get("ai-notice"));
        // Sichtbar im Dokument, nicht nur in den Eigenschaften (Art. 50 Abs. 5).
        expect(e.hauptText).toContain(e.custom.get("ai-notice") ?? "—");
      } else {
        expect(e.custom.size, `${lage}: Eigenschaften behaupten KI`).toBe(0);
        expect(e.beschreibung).toBeNull();
      }
      f.unmount();
    });

    it(`.pptx über das Menü · ${lage}`, async () => {
      const f = await montiereIn(lage);
      const datei = await herunterladen(f, "pptx");
      expect(datei.name.endsWith(".pptx")).toBe(true);
      const e = officeEigenschaften(datei.bytes, "ppt/presentation.xml");
      const folie = entpacke(datei.bytes).get("ppt/slides/slide1.xml") ?? "";
      expect(folie).toContain("Ventil V4 wird jährlich geprüft.");
      expect(e.custom.get("ai-generated") ?? null).toBe(
        KENNZEICHNUNG_ERWARTET[lage] ? "true" : null,
      );
      f.unmount();
    });

    it(`.pdf über das Menü · ${lage}`, async () => {
      const f = await montiereIn(lage);
      const datei = await herunterladen(f, "pdf");
      expect(datei.typ).toBe("application/pdf");
      const p = pdfInfo(datei.bytes);
      expect(p.text).toContain("(Ventil V4 wird jährlich geprüft.)");
      if (KENNZEICHNUNG_ERWARTET[lage]) {
        expect(p.info).toContain("/AIGenerated true");
        expect(p.info).toContain("/AISystem (KLARWERK)");
        expect(p.subject ?? "").toContain("Von künstlicher Intelligenz erzeugt");
      } else {
        expect(p.info).not.toContain("/AIGenerated");
        expect(p.subject).toBeNull();
      }
      f.unmount();
    });
  }

  it("der Druckweg bleibt daneben erhalten", async () => {
    const f = await montiereIn("modell");
    const griff = f.container.querySelector<HTMLButtonElement>('[data-testid="ask-menu"]');
    await act(async () => {
      griff?.click();
      await flush();
    });
    expect(f.container.querySelector('[data-testid="ask-menu-punkt-print"]')).not.toBeNull();
    f.unmount();
  });
});

describe("R-1020 / R-1695 · die Antwortkarte trägt ihre Stufe — gemessen am DOM", () => {
  const ERWARTET: Readonly<Record<Lage, "entwurf" | "empfehlung" | "validiert">> = {
    modell: "entwurf",
    // Belegt modellfrei UND die Fixture ist voll belegt gesichert (wie job1022).
    rueckfall: "validiert",
    ohneMarke: "empfehlung",
    kaputteMarke: "empfehlung",
    // Gleiche gesicherte Fixture wie `rueckfall` — aber widersprüchliche Herkunft: nie „validiert".
    kaputteMarkeRueckfall: "empfehlung",
  };
  for (const lage of LAGEN) {
    it(`Stufe · ${lage}`, async () => {
      const f = await montiereIn(lage);
      const karte = f.container.querySelector<HTMLElement>('[data-testid="ask-answer"]');
      const marke = karte?.querySelector<HTMLElement>('[data-testid="ergebnis-stufe"]');
      expect(marke, `${lage}: die Karte trägt keine Stufe`).not.toBeNull();
      expect(marke?.getAttribute("data-stufe")).toBe(ERWARTET[lage]);
      expect(karte?.hasAttribute("data-reasoner-entwurf")).toBe(ERWARTET[lage] === "entwurf");
      if (ERWARTET[lage] === "entwurf") {
        expect(marke?.textContent ?? "").toContain("Reasoner-Entwurf, nicht validiert");
      }
      f.unmount();
    });
  }

  it("ein Modelltext wird nie „validiert“ — auch nicht bei gesicherten Quellen", () => {
    expect(ergebnisStufeFuerAntwort("ki", true)).toBe("entwurf");
    expect(ergebnisStufeFuerAntwort("unbekannt", true)).toBe("empfehlung");
    expect(ergebnisStufeFuerAntwort("ohne-ki", false)).toBe("empfehlung");
    expect(ergebnisStufeFuerAntwort("ohne-ki", true)).toBe("validiert");
    expect(ergebnisStufeFuerVorschlag(true)).toBe("entwurf");
    expect(ergebnisStufeFuerVorschlag(false)).toBe("empfehlung");
  });

  it("Marke und Entwurfsrahmen rendern den Wortlaut der Quelle — in drei Sprachen unterscheidbar", async () => {
    for (const sprache of ["de", "en", "nl"]) {
      await i18n.changeLanguage(sprache);
      const texte = new Set<string>();
      for (const stufe of ["entwurf", "empfehlung", "validiert"] as const) {
        const ziel = document.createElement("div");
        document.body.appendChild(ziel);
        const root = createRoot(ziel);
        await act(async () => {
          root.render(createElement(ErgebnisStufeMarke, { stufe }));
        });
        texte.add((ziel.textContent ?? "").replace("✦", "").trim());
        act(() => root.unmount());
        ziel.remove();
      }
      expect(texte.size, `${sprache}: zwei Stufen sehen gleich aus`).toBe(3);
    }
    await i18n.changeLanguage("de");
    const ziel = document.createElement("div");
    document.body.appendChild(ziel);
    const root = createRoot(ziel);
    await act(async () => {
      root.render(createElement(ReasonerDraft, null, "Inhalt"));
    });
    expect(ziel.textContent ?? "").toContain("Reasoner-Entwurf, nicht validiert");
    const rahmen = ziel.firstElementChild;
    for (const klasse of ["border-dashed", "border-ai-dashed", "bg-ai-surface-2"]) {
      expect(rahmen?.classList.contains(klasse), `ReasonerDraft ohne ${klasse}`).toBe(true);
    }
    act(() => root.unmount());
    ziel.remove();
  });

  it("JOB 2660 · die Empfehlung nennt kein Validierungswort — auch nicht verneint", async () => {
    // Nacharbeit 3: auf der Klara-Hilfe (Rückfall ohne Modell → Stufe „Empfehlung") stand
    // „Empfehlung, nicht validiert" — und JOB 2660 schliesst das Wort auf einer Fläche ohne
    // geprüfte Quelle aus. Hier wird der gerenderte Text der Marke in allen drei Sprachen gemessen.
    for (const sprache of ["de", "en", "nl"]) {
      await i18n.changeLanguage(sprache);
      const ziel = document.createElement("div");
      document.body.appendChild(ziel);
      const root = createRoot(ziel);
      await act(async () => {
        root.render(createElement(ErgebnisStufeMarke, { stufe: "empfehlung" }));
      });
      expect(ziel.textContent ?? "", `${sprache}: Empfehlung`).not.toMatch(
        /valid|gevalideerd|gesichert|verified|gecontroleerd/i,
      );
      act(() => root.unmount());
      ziel.remove();
    }
    await i18n.changeLanguage("de");
  });

  it("die Entwurfsoptik der Karte ist als CSS-Regel vorhanden (Quelltextprüfung)", () => {
    const css = lies("apps/web/src/index.css");
    const start = css.indexOf(".print-area[data-reasoner-entwurf]");
    expect(start, "die Regel für die Entwurfskarte fehlt").toBeGreaterThan(0);
    expect(css.slice(start, css.indexOf("}", start))).toContain(
      "@apply border-dashed border-ai-dashed bg-ai-surface-2;",
    );
  });

  it("jede übrige KI-Ergebnisfläche trägt die Stufe (Quelltextprüfung, benannte Grenze)", () => {
    // Montiert sind oben nur Fragenseite, Marke und Rahmen. Für die übrigen Flächen belegt dieser
    // Fall die Bindung im Code: Marke vorhanden, Entwurfsfläche an den Modellweg gebunden.
    const flaechen: ReadonlyArray<readonly [string, readonly string[]]> = [
      [
        "apps/web/src/components/erfassen/Blatt.tsx",
        [
          "stufe={ergebnisStufeFuerVorschlag(!structureProposal.demo)}",
          "stufe={ergebnisStufeFuerVorschlag(!assistProposal.demo)}",
        ],
      ],
      ["apps/web/src/components/RichTextEditor.tsx", ['<ErgebnisStufeMarke stufe="entwurf"']],
      [
        "apps/web/src/components/KlaraAssistant.tsx",
        // Nacharbeit 4: gebunden an die BELEGTE Modellbeteiligung (`demo === false`); die
        // Wirkung misst tests/web/r0604-klara-herkunft.test.tsx am gerenderten Panel.
        [
          "const hilfeVomModell = aiAsk.data?.demo === false;",
          "ergebnisStufeFuerVorschlag(hilfeVomModell)",
        ],
      ],
      ["apps/web/src/components/PublicAiEnrichPanel.tsx", ['<ErgebnisStufeMarke stufe="entwurf"']],
      ["apps/web/src/pages/Mobile.tsx", ["<ErgebnisStufeMarke stufe={stufe}"]],
    ];
    for (const [datei, muster] of flaechen) {
      const quelle = lies(datei);
      expect(quelle, `${datei}: keine Entwurfsfläche`).toContain("REASONER_ENTWURF_FLAECHE");
      for (const m of muster) {
        expect(quelle, `${datei}: ${m}`).toContain(m);
      }
    }
  });
});

// ================================================================================================
// Ben Nacharbeit 4 — DER PDF-EXPORT VERÄNDERT KEINEN INHALT.
// ================================================================================================
// Bis dahin wurde jedes Zeichen ausserhalb einer kleinen WinAnsi-Tabelle zu „?" („Δp" → „?p").
// Gemessen wird am ECHTEN Exportaufruf der Fragenseite: die heruntergeladene Datei wird gelesen,
// ihr sichtbarer Text aus den Textbefehlen zurückgewonnen — WinAnsi über eine eigene Tabelle dieses
// Tests, die Symbol-Schrift über die /ToUnicode-Tabelle DER DATEI — und mit dem Original verglichen.
// Zusätzlich die Bytes nach der veröffentlichten Adobe-Symbol-Kodierung (Δ = 0x44 „D", ≤ = 0xA3).

// WinAnsi-Sonderplätze, die im Prüftext vorkommen — eigene Tabelle dieses Tests.
const WIN_ANSI_ZURUECK = new Map<number, string>([
  [0x80, "€"],
  [0x84, "„"],
  [0x85, "…"],
  [0x93, "“"],
  [0x94, "”"],
  [0x96, "–"],
  [0x97, "—"],
]);

/** Die sichtbaren Zeilen einer PDF-Datei, zurückgewonnen aus `BT … ET` und den Schriftwechseln. */
function pdfZeilen(roh: string): string[] {
  const symbol = new Map<number, string>();
  for (const m of roh.matchAll(/<([0-9A-F]{2})> <([0-9A-F]{4})>/g)) {
    const ziel = String.fromCharCode(Number.parseInt(m[2] ?? "", 16));
    symbol.set(Number.parseInt(m[1] ?? "", 16), ziel);
  }
  const zeilen: string[] = [];
  for (const block of roh.matchAll(/BT 50 \d+ Td ([^\n]*?) ET/g)) {
    let zeile = "";
    const stuecke = (block[1] ?? "").matchAll(/\/(F\d) \d+ Tf \(((?:\\.|[^\\)])*)\) Tj/g);
    for (const s of stuecke) {
      const bytes = (s[2] ?? "").replace(/\\(.)/g, "$1");
      for (const b of bytes) {
        const code = b.charCodeAt(0);
        const zeichen = s[1] === "F4" ? symbol.get(code) : WIN_ANSI_ZURUECK.get(code);
        zeile += zeichen ?? (s[1] === "F4" ? "�" : b);
      }
    }
    zeilen.push(zeile);
  }
  return zeilen;
}

describe("Ben Nacharbeit 4 · die PDF-Datei gibt den Antworttext unverändert wieder", () => {
  const TECHNIK = "Druckdifferenz Δp ≤ 5 bar, α = 30°, μ ≈ 0,3 — Ω → ∑ „Prüfung“ 12 €";

  it("Griechisch und Mathematik kommen unverändert in der Datei an — über die Menü-Handlung", async () => {
    bestand.antwort = TECHNIK;
    const f = await montiereIn("modell");
    const datei = await herunterladen(f, "pdf");
    const roh = Array.from(datei.bytes, (b) => String.fromCharCode(b)).join("");
    expect(roh, "kein Fragezeichen-Ersatz im Textstrom").not.toMatch(/\(\?p/);
    expect(pdfZeilen(roh), "der Antworttext ist in der Datei verändert").toContain(TECHNIK);
    // Die Bytes nach der veröffentlichten Symbol-Kodierung — nicht nach der Tabelle des Erzeugers.
    expect(roh).toContain("/F4 10 Tf (D) Tj");
    expect(roh).toMatch(/\/F4 10 Tf \([^)]*£/);
    expect(roh).toContain("/BaseFont /Symbol /ToUnicode");
    // Die Kennzeichnung in den Eigenschaften bleibt daneben unverändert.
    expect(pdfInfo(datei.bytes).info).toContain("/AIGenerated true");
    f.unmount();
  });

  it("nicht darstellbare Zeichen: KEINE Datei mit verändertem Inhalt, sondern eine Meldung", async () => {
    bestand.antwort = "Давление 5 бар — Druck 5 bar";
    const f = await montiereIn("modell");
    const { gefangen } = await menuepunktBedienen(f, "pdf");
    expect(gefangen.length, "es wurde trotzdem eine PDF-Datei erzeugt").toBe(0);
    // Die Meldung nennt GENAU die nicht darstellbaren Zeichen, sortiert und je einmal.
    const meldung = i18n.t("ask.export.pdfZeichen", { zeichen: "Д а б в е и л н р" });
    expect(document.body.textContent ?? "", "keine Meldung an die Nutzerin").toContain(meldung);
    // Die verlustfreien Wege bleiben: Word trägt denselben Text unverändert.
    const word = await herunterladen(f, "docx");
    expect(officeEigenschaften(word.bytes, "word/document.xml").hauptText).toContain(
      "Давление 5 бар — Druck 5 bar",
    );
    f.unmount();
  });
});
