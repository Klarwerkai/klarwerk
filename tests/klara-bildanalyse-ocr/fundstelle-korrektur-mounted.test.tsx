// @vitest-environment jsdom
// ================================================================================================
// OCR-E01/E02 · FUNDSTELLE AM ORIGINAL UND BERICHTIGTER BILDTEXT — an der gemounteten Komponente,
// die JEDER RichTextEditor trägt (`BildBefundeImRumpf`).
// ================================================================================================
//
// Auftrag produkt:20261012:klara-ocr-fundstellen-korrekturen, Kriterien K1–K9 (mit K10/K11).
//
// Ersetzt sind: die Texterkennung (liest die Marke aus den Bildbytes und liefert bekannten Text MIT
// Wortrahmen), der Frage-/Beschreibungsweg der Fläche (Test-Naht `ImageDescribeValueProvider`, samt
// der gespeicherten Quelle `ko:<id>`), der Draht des Assistenzprofils und der Draht der
// Berichtigungen (je ein kleiner Server im Speicher, je Konto). Echt sind Analyse, Zuordnung,
// Markierung, Ansicht, Berichtigungsstand, Klaras Kontext und die Oberfläche. Den echten Server
// misst `korrekturen-am-server.test.ts`, die echte Engine im Browser
// `tests-smoke/klara-ocr-fundstelle-korrektur-browser.spec.ts`.
//
//   E1  K1/K2 — Zahl, Name, Datum: Klick öffnet IHR Bild mit dem gemessenen Bereich; das zweite Bild
//       desselben Textes öffnet SEIN Original. Bedienbar per Tastatur (ein Tab-Stopp, Pfeiltasten).
//   E2  K3 — Drehen und Vergrößern: Bild und Markierung liegen im selben Rahmen.
//   E3  K4 — ohne Positionsdaten: das Bild wird gezeigt, nichts markiert, der Grund steht da.
//   E4  K5/K6/K7 — berichtigen; Klaras Frage und Zusammenfassung bekommen die Berichtigung;
//       Neuladen und erneutes Einlesen behalten sie; rückgängig und zurücksetzen bringen den
//       Rohbefund zurück; das Originalbild bleibt unverändert.
//   E5  K8 — verändertes Bild und andere Quelle: keine Übertragung, sichtbar benannt.
//   E6  K9 — Rolle ohne Schreibrecht: keine Bearbeitung; Kontowechsel: nichts vom anderen Konto;
//       ohne gespeicherte Quelle: keine Berichtigung, und das steht da.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OcrResult, OcrWort } from "../../apps/web/src/lib/ocr";

const steuerung = vi.hoisted(() => ({
  ocr: vi.fn(async (_src: unknown): Promise<OcrResult> => ({ status: "success", text: "" })),
}));

vi.mock("../../apps/web/src/lib/files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/lib/files")>()),
  runImageOcr: steuerung.ocr,
}));

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  type AssistenzProfilAntwort,
  assistenzProfilApi,
} from "../../apps/web/src/api/assistenzProfil";
import {
  type BildKorrekturAenderung,
  type BildKorrekturAntwort,
  bildKorrekturApi,
} from "../../apps/web/src/api/bildKorrekturen";
import { ApiError } from "../../apps/web/src/api/client";
import type { AssistResult, DescribeImageResult } from "../../apps/web/src/api/types";
import {
  type ImageDescribeValue,
  ImageDescribeValueProvider,
} from "../../apps/web/src/app/ImageDescribeContext";
import { BildBefundeImRumpf } from "../../apps/web/src/components/BildBefundeImRumpf";
import i18n from "../../apps/web/src/i18n";
import {
  ladeAssistenzProfil,
  verwerfeAssistenzProfil,
} from "../../apps/web/src/lib/assistenzProfil";
import { bildInhaltskennung } from "../../apps/web/src/lib/bildAutomatik";
import type { BildKorrekturDaten } from "../../apps/web/src/lib/bildKorrektur";
import { verwerfeBildKorrekturen } from "../../apps/web/src/lib/bildKorrekturenStand";
import { bildMit, bildMitMassen, dataUrl, markeAus } from "./deck";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

// ------------------------------------------------------------------------------------------------
// Kontrollierte Bilder: bekannter Text, bekannte Stellen, ein absichtlicher Erkennungsfehler.
// ------------------------------------------------------------------------------------------------

function wort(text: string, x0: number, y0: number, x1: number, y1: number): OcrWort {
  return { text, confidence: 95, bbox: { x0, y0, x1, y1 } };
}

const ERKANNT: Record<string, { text: string; woerter?: OcrWort[] }> = {
  // Rechnung 1000 × 500: Name mit absichtlichem Fehler („Mül1er“), Betrag, Datum.
  R: {
    text: "Herr Mül1er zahlt 4.250 EUR\nam 12.10.2026",
    woerter: [
      wort("Herr", 40, 40, 160, 90),
      wort("Mül1er", 180, 40, 400, 90),
      wort("zahlt", 420, 40, 560, 90),
      wort("4.250", 600, 40, 760, 90),
      wort("EUR", 780, 40, 880, 90),
      wort("am", 40, 300, 110, 350),
      wort("12.10.2026", 130, 300, 430, 350),
    ],
  },
  // Lageraushang 600 × 200 — und dieselbe Stelle in einer veränderten Fassung.
  L: {
    text: "LAGER 29",
    woerter: [wort("LAGER", 20, 50, 260, 150), wort("29", 300, 50, 400, 150)],
  },
  N: {
    text: "LAGER 30",
    woerter: [wort("LAGER", 20, 50, 260, 150), wort("30", 300, 50, 400, 150)],
  },
  // Ein Bild ohne Wortrahmen (die Erkennung liefert nur Text).
  X: { text: "OHNE POSITION" },
};

const BILD_R = dataUrl(bildMitMassen("R", 1000, 500));
const BILD_L = dataUrl(bildMitMassen("L", 600, 200));
const BILD_N = dataUrl(bildMitMassen("N", 600, 200));
const BILD_X = dataUrl(bildMit("X"));

function rumpf(zweites = BILD_L, zusatz = ""): string {
  return [
    "<p>Rechnung und Aushang zur Wartung.</p>",
    `<figure><img data-image-id="kw-1" src="${BILD_R}"></figure>`,
    `<figure><img data-image-id="kw-2" src="${zweites}"></figure>`,
    zusatz,
  ].join("");
}

// ------------------------------------------------------------------------------------------------
// Zwei kleine Server im Speicher: Profil und Berichtigungen, je Konto.
// ------------------------------------------------------------------------------------------------

const server = { konto: "konto-a" };

interface Gespeichert {
  daten: Omit<BildKorrekturDaten, "schritte">;
  vorher: string[];
}

const korrekturServer = {
  konten: new Map<string, Gespeichert[]>(),
  /** Konten ohne Schreibrecht (Rolle viewer). */
  ohneRecht: new Set<string>(),
  aufrufe: [] as { konto: string; aenderung: BildKorrekturAenderung }[],
  uhr: 0,
};

function sicht(konto: string): BildKorrekturAntwort {
  return {
    darfBearbeiten: !korrekturServer.ohneRecht.has(konto),
    korrekturen: (korrekturServer.konten.get(konto) ?? []).map((g) => ({
      ...g.daten,
      schritte: g.vorher.length,
    })),
  };
}

function aendernAmServer(a: BildKorrekturAenderung): BildKorrekturAntwort {
  const konto = server.konto;
  if (korrekturServer.ohneRecht.has(konto)) {
    throw new ApiError(403, "FORBIDDEN", "Keine Berechtigung.");
  }
  korrekturServer.aufrufe.push({ konto, aenderung: a });
  const liste = korrekturServer.konten.get(konto) ?? [];
  const bisher = liste.find(
    (g) => g.daten.quelle === a.quelle && g.daten.inhaltskennung === a.inhaltskennung,
  );
  const rest = liste.filter((g) => g !== bisher);
  korrekturServer.uhr += 1;
  const geaendertAm = `2026-10-12T10:00:${String(korrekturServer.uhr).padStart(2, "0")}.000Z`;
  if (a.aktion === "setzen") {
    const daten = {
      quelle: a.quelle,
      inhaltskennung: a.inhaltskennung,
      ort: a.ort ?? null,
      text: a.text,
      geaendertAm,
    };
    rest.push({ daten, vorher: bisher ? [...bisher.vorher, bisher.daten.text] : [] });
  } else if (a.aktion === "rueckgaengig" && bisher && bisher.vorher.length > 0) {
    const text = bisher.vorher[bisher.vorher.length - 1] ?? "";
    const vorher = bisher.vorher.slice(0, -1);
    rest.push({ daten: { ...bisher.daten, text, geaendertAm }, vorher });
  }
  korrekturServer.konten.set(konto, rest);
  return sicht(konto);
}

/** Nacharbeit 2: hängende Lesezugriffe auf die gespeicherten Berichtigungen. */
const lesenSteuerung = {
  warten: false,
  offen: [] as { ok: () => void; fehl: (e: Error) => void }[],
};

const describeBild = vi.fn(
  async (_src: string): Promise<DescribeImageResult> => ({ text: "Ein Dokument", demo: false }),
);

function weg(quelle: string | undefined, frage?: ImageDescribeValue["frage"]): ImageDescribeValue {
  return {
    available: true,
    describe: describeBild,
    ...(quelle ? { quelle } : {}),
    ...(frage ? { frage, frageVerfuegbar: true } : {}),
  };
}

async function abwarten(): Promise<void> {
  for (let i = 0; i < 12; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  }
}

async function zeige(html: string, w: ImageDescribeValue): Promise<void> {
  await act(async () => {
    root.render(
      createElement(ImageDescribeValueProvider, {
        value: w,
        children: createElement(BildBefundeImRumpf, { html }),
      }),
    );
  });
  await abwarten();
}

async function profilLaden(konto: string): Promise<void> {
  server.konto = konto;
  await act(async () => {
    await ladeAssistenzProfil(konto);
  });
}

/** „Neuladen“: Fläche weg, Browserstände verworfen, neu angemeldet und neu montiert. */
async function neuLaden(konto: string): Promise<void> {
  act(() => root.unmount());
  verwerfeAssistenzProfil();
  verwerfeBildKorrekturen();
  root = createRoot(container);
  await profilLaden(konto);
}

const q = (id: string): HTMLElement | null => container.querySelector(`[data-testid="${id}"]`);

function bildZeile(index: number): HTMLElement {
  const zeile = container.querySelectorAll<HTMLElement>("[data-testid=bild-befund]")[index];
  if (!zeile) {
    throw new Error(`keine Bildzeile ${index}`);
  }
  return zeile;
}

function stellen(index: number): HTMLButtonElement[] {
  const auswahl = "[data-testid=bild-befund-stelle]";
  return [...bildZeile(index).querySelectorAll<HTMLButtonElement>(auswahl)];
}

/** Trägt das Bild `index` eine wirksame Berichtigung? */
function berichtigt(index: number): string | null {
  const el = bildZeile(index).querySelector("[data-testid=bild-berichtigung]");
  return el?.getAttribute("data-berichtigt") ?? null;
}

function andereFassung(index: number): string | null {
  const el = bildZeile(index).querySelector("[data-testid=bild-berichtigung-andere-fassung]");
  return el?.textContent ?? null;
}

function stelle(index: number, text: string): HTMLButtonElement {
  const s = stellen(index).find((b) => b.textContent === text);
  if (!s) {
    throw new Error(`keine Stelle „${text}“ in Bild ${index + 1}`);
  }
  return s;
}

const bildText = (index: number): string =>
  bildZeile(index).querySelector("[data-testid=bild-befund-text]")?.textContent ?? "";

async function klick(el: HTMLElement | null): Promise<void> {
  await act(async () => {
    (el as HTMLButtonElement).click();
  });
  await abwarten();
}

async function tippe(el: HTMLElement | null, text: string): Promise<void> {
  const feld = el as HTMLInputElement | HTMLTextAreaElement;
  const proto =
    feld instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setzer = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  await act(async () => {
    setzer?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function taste(el: Element | null, key: string): Promise<void> {
  await act(async () => {
    el?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

async function schliesseAnsicht(): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  });
  await abwarten();
  expect(q("bild-fundstelle-ansicht")).toBeNull();
}

/** Die Markierung der offenen Ansicht, in Prozent des Bildrahmens. */
function markierungImBild(): { links: number; oben: number; breite: number; hoehe: number } {
  const el = q("bild-fundstelle-markierung");
  if (!el) {
    throw new Error("keine Markierung");
  }
  return {
    links: Number.parseFloat(el.style.left),
    oben: Number.parseFloat(el.style.top),
    breite: Number.parseFloat(el.style.width),
    hoehe: Number.parseFloat(el.style.height),
  };
}

function nahe(ist: ReturnType<typeof markierungImBild>, soll: typeof ist): void {
  expect(ist.links).toBeCloseTo(soll.links, 4);
  expect(ist.oben).toBeCloseTo(soll.oben, 4);
  expect(ist.breite).toBeCloseTo(soll.breite, 4);
  expect(ist.hoehe).toBeCloseTo(soll.hoehe, 4);
}

const ansichtBild = (): string | null => q("bild-fundstelle-bild")?.getAttribute("src") ?? null;

beforeEach(async () => {
  await i18n.changeLanguage("de");
  server.konto = "konto-a";
  korrekturServer.konten.clear();
  korrekturServer.ohneRecht.clear();
  korrekturServer.aufrufe = [];
  vi.spyOn(assistenzProfilApi, "lesen").mockImplementation(
    async (): Promise<AssistenzProfilAntwort> => ({ profil: null, einrichtungOffen: true }),
  );
  lesenSteuerung.warten = false;
  lesenSteuerung.offen = [];
  vi.spyOn(bildKorrekturApi, "lesen").mockImplementation(() => {
    const konto = server.konto;
    if (!lesenSteuerung.warten) {
      return Promise.resolve(sicht(konto));
    }
    // Nacharbeit 2: das Lesen hängt, bis der Test es beantwortet oder scheitern lässt.
    return new Promise<BildKorrekturAntwort>((ok, fehl) => {
      lesenSteuerung.offen.push({ ok: () => ok(sicht(konto)), fehl });
    });
  });
  vi.spyOn(bildKorrekturApi, "aendern").mockImplementation(async (a) => aendernAmServer(a));
  steuerung.ocr.mockReset();
  steuerung.ocr.mockImplementation(async (src: unknown): Promise<OcrResult> => {
    const e = ERKANNT[markeAus(String(src)) ?? ""];
    if (!e) {
      return { status: "success", text: "" };
    }
    return e.woerter
      ? { status: "success", text: e.text, woerter: e.woerter }
      : { status: "success", text: e.text };
  });
  describeBild.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  verwerfeAssistenzProfil();
  verwerfeBildKorrekturen();
  vi.restoreAllMocks();
});

describe("E1 · K1/K2 — Zahl, Name, Datum führen zu ihrem Original und Bereich; Tastatur", () => {
  it("jede Stelle öffnet ihr Bild mit dem gemessenen Bereich; das zweite Bild seines", async () => {
    await profilLaden("konto-a");
    await zeige(rumpf(), weg("ko:fiktiv-1"));
    expect(bildText(0)).toBe(ERKANNT.R?.text);

    const soll: [string, { links: number; oben: number; breite: number; hoehe: number }][] = [
      ["4.250", { links: 60, oben: 8, breite: 16, hoehe: 10 }],
      ["Mül1er", { links: 18, oben: 8, breite: 22, hoehe: 10 }],
      ["12.10.2026", { links: 13, oben: 60, breite: 30, hoehe: 10 }],
    ];
    for (const [text, bereich] of soll) {
      await klick(stelle(0, text));
      const ansicht = q("bild-fundstelle-ansicht");
      expect(ansicht?.getAttribute("data-art")).toBe("bereich");
      expect(ansichtBild()).toBe(BILD_R);
      expect(container.querySelectorAll("[data-testid=bild-fundstelle-markierung]")).toHaveLength(
        1,
      );
      nahe(markierungImBild(), bereich);
      // Nicht nur Farbe: ein Satz sagt, was markiert ist (gestrichelter Rahmen, Nummer 1).
      expect(q("bild-fundstelle-beschreibung")?.textContent).toBe(
        i18n.t("bildfundstelle.dialog.markiert", { wort: text }),
      );
      expect(q("bild-fundstelle-markierung")?.textContent).toBe("1");
      const herkunft = { quelle: "diesem Text", ort: "Bild 1" };
      expect(ansicht?.textContent).toContain(i18n.t("bildfundstelle.dialog.quelle", herkunft));
      await schliesseAnsicht();
    }

    // Das zweite Bild desselben Textes: „29“ öffnet SEIN Original und SEINEN Bereich.
    await klick(stelle(1, "29"));
    expect(ansichtBild()).toBe(BILD_L);
    nahe(markierungImBild(), { links: 50, oben: 25, breite: 100 / 6, hoehe: 50 });
    await schliesseAnsicht();
  });

  it("Tastatur: ein Tab-Stopp je Text, Pfeiltasten wandern, die Stelle ist eine Schaltfläche", async () => {
    await profilLaden("konto-a");
    await zeige(rumpf(), weg("ko:fiktiv-1"));
    const knoepfe = stellen(0);
    expect(knoepfe.map((k) => k.tabIndex)).toEqual([0, -1, -1, -1, -1, -1, -1]);
    expect(knoepfe.every((k) => k.type === "button")).toBe(true);
    expect(knoepfe[3]?.getAttribute("aria-label")).toBe(
      i18n.t("bildfundstelle.stelle.zeigen", { wort: "4.250" }),
    );
    await act(async () => {
      knoepfe[0]?.focus();
    });
    await taste(knoepfe[0] ?? null, "ArrowRight");
    expect(document.activeElement).toBe(knoepfe[1]);
    await taste(knoepfe[1] ?? null, "End");
    expect(document.activeElement).toBe(knoepfe[6]);
    expect(stellen(0).map((k) => k.tabIndex)).toEqual([-1, -1, -1, -1, -1, -1, 0]);
    // Die gewählte Stelle (Datum) öffnet ihre Fundstelle.
    await klick(document.activeElement as HTMLElement);
    nahe(markierungImBild(), { links: 13, oben: 60, breite: 30, hoehe: 10 });
  });
});

describe("E2 · K3 — gedreht und vergrößert: die Markierung bleibt auf ihrer Stelle", () => {
  it("Drehen dreht den gemeinsamen Rahmen; Vergrößern skaliert ihn; die Prozente bleiben", async () => {
    await profilLaden("konto-a");
    await zeige(rumpf(), weg("ko:fiktiv-1"));
    await klick(stelle(0, "4.250"));
    const buehne = (): HTMLElement | null => q("bild-fundstelle-buehne");
    const rahmen = (): HTMLElement | null => q("bild-fundstelle-rahmen");
    expect([buehne()?.style.width, buehne()?.style.height]).toEqual(["640px", "320px"]);
    expect(rahmen()?.style.transform).toBe("translate(-50%, -50%) rotate(0deg)");
    // Bild und Markierung sind Kinder DESSELBEN Rahmens.
    expect(rahmen()?.contains(q("bild-fundstelle-bild"))).toBe(true);
    expect(rahmen()?.contains(q("bild-fundstelle-markierung"))).toBe(true);

    await klick(q("bild-fundstelle-drehen"));
    expect(buehne()?.getAttribute("data-drehung")).toBe("90");
    expect(rahmen()?.style.transform).toBe("translate(-50%, -50%) rotate(90deg)");
    // Gedreht: die Bühne steht hochkant (500 px breit passt ohne Verkleinern), der Rahmen behält das
    // Seitenverhältnis des Bildes — und mit ihm die Markierung.
    expect([rahmen()?.style.width, rahmen()?.style.height]).toEqual(["1000px", "500px"]);
    expect([buehne()?.style.width, buehne()?.style.height]).toEqual(["500px", "1000px"]);
    nahe(markierungImBild(), { links: 60, oben: 8, breite: 16, hoehe: 10 });

    await klick(q("bild-fundstelle-groesser"));
    expect(buehne()?.getAttribute("data-zoom")).toBe("1.5");
    expect([rahmen()?.style.width, rahmen()?.style.height]).toEqual(["1500px", "750px"]);
    nahe(markierungImBild(), { links: 60, oben: 8, breite: 16, hoehe: 10 });
  });
});

describe("E3 · K4 — ohne Positionsdaten: das Bild, kein erfundener Bereich, der Grund", () => {
  it("Bild ohne Wortrahmen öffnet das Original ohne Markierung und sagt warum", async () => {
    await profilLaden("konto-a");
    await zeige(rumpf(BILD_X), weg("ko:fiktiv-1"));
    expect(bildText(1)).toBe("OHNE POSITION");
    await klick(stelle(1, "POSITION"));
    const ansicht = q("bild-fundstelle-ansicht");
    expect(ansicht?.getAttribute("data-art")).toBe("ohne-position");
    expect(ansicht?.getAttribute("data-grund")).toBe("keine-positionen");
    expect(ansichtBild()).toBe(BILD_X);
    expect(q("bild-fundstelle-markierung")).toBeNull();
    expect(q("bild-fundstelle-beschreibung")?.textContent).toBe(
      i18n.t("bildfundstelle.dialog.ohnePosition", { wort: "POSITION" }),
    );
    expect(q("bild-fundstelle-ohne-position")?.textContent).toBe(
      i18n.t("bildfundstelle.grund.keinePositionen"),
    );
    // Bedienbar: Drehen und Vergrößern gehen auch hier; Schließen per Escape.
    await klick(q("bild-fundstelle-drehen"));
    expect(q("bild-fundstelle-buehne")?.getAttribute("data-drehung")).toBe("90");
    await schliesseAnsicht();
  });
});

describe("E4 · K5/K6/K7 — berichtigen, in Klara nutzen, behalten, zurücknehmen", () => {
  it("Berichtigung → Frage und Zusammenfassung mit „Müller“; Neuladen behält; Rücksetzen", async () => {
    await profilLaden("konto-a");
    const frage = vi.fn(
      async (_text: string, _anweisung: string): Promise<AssistResult> => ({
        text: "Herr Müller zahlt 4.250 EUR [diesem Text · Bild 1].",
        demo: false,
      }),
    );
    const html = rumpf();
    await zeige(html, weg("ko:fiktiv-1", frage));
    expect(steuerung.ocr).toHaveBeenCalledTimes(2);

    // Berichtigen: das Feld beginnt mit dem Rohbefund.
    await klick(bildZeile(0).querySelector("[data-testid=bild-berichtigung-bearbeiten]"));
    const feld = q("bild-berichtigung-feld") as HTMLTextAreaElement | null;
    expect(feld?.value).toBe(ERKANNT.R?.text);
    await tippe(feld, "Herr Müller zahlt 4.250 EUR\nam 12.10.2026");
    await klick(q("bild-berichtigung-speichern"));
    const gesetzt = korrekturServer.aufrufe[0]?.aenderung;
    expect(gesetzt).toMatchObject({
      aktion: "setzen",
      quelle: "ko:fiktiv-1",
      ort: "b1",
      text: "Herr Müller zahlt 4.250 EUR\nam 12.10.2026",
    });
    expect(gesetzt?.inhaltskennung).toMatch(/^sha256:[0-9a-f]{64}$/);
    // Nur Text und Bindung reisen — keine Bilddaten.
    expect(JSON.stringify(korrekturServer.aufrufe)).not.toContain("base64");

    // Sichtbar unterscheidbar: Berichtigung angezeigt, Rohbefund daneben.
    expect(bildText(0)).toBe("Herr Müller zahlt 4.250 EUR\nam 12.10.2026");
    expect(berichtigt(0)).toBe("true");
    expect(q("bild-berichtigung-roh")?.textContent).toBe(ERKANNT.R?.text);
    expect(q("bild-berichtigung-hinweis")?.textContent).toBe(
      i18n.t("bildfundstelle.korrektur.berichtigt"),
    );

    // E01 ↔ E02: das berichtigte Wort führt zur Stelle des erkannten.
    await klick(stelle(0, "Müller"));
    expect(q("bild-fundstelle-beschreibung")?.textContent).toBe(
      i18n.t("bildfundstelle.dialog.markiertErsetzt", { wort: "Müller", roh: "Mül1er" }),
    );
    nahe(markierungImBild(), { links: 18, oben: 8, breite: 22, hoehe: 10 });
    await schliesseAnsicht();

    // K5: Klara — Frage und Zusammenfassung bekommen die berichtigte Fassung, nicht den Fehler.
    await tippe(q("klara-bild-kontext-frage"), "Was zahlt Herr Müller?");
    await klick(q("klara-bild-kontext-fragen"));
    await klick(q("klara-bild-kontext-zusammenfassen"));
    expect(frage).toHaveBeenCalledTimes(2);
    const kennzeichen = i18n.t("bildfundstelle.kontext.textBerichtigt");
    for (const [kontext] of frage.mock.calls) {
      expect(kontext).toContain(
        `[diesem Text · Bild 1] ${kennzeichen}: Herr Müller zahlt 4.250 EUR`,
      );
      expect(kontext).not.toContain("Mül1er");
    }
    expect(q("klara-bild-kontext-antwort")?.getAttribute("data-auftrag")).toBe("zusammenfassung");

    // K6: Neuladen — neue Fläche, neue Analyse derselben Bildbytes: die Berichtigung bleibt.
    await neuLaden("konto-a");
    await zeige(html, weg("ko:fiktiv-1", frage));
    expect(steuerung.ocr).toHaveBeenCalledTimes(4);
    expect(bildText(0)).toBe("Herr Müller zahlt 4.250 EUR\nam 12.10.2026");

    // Eine zweite Berichtigung, dann rückgängig (zurück zur ersten) …
    await klick(bildZeile(0).querySelector("[data-testid=bild-berichtigung-bearbeiten]"));
    await tippe(q("bild-berichtigung-feld"), "Herr Müller zahlt 4.520 EUR\nam 12.10.2026");
    await klick(q("bild-berichtigung-speichern"));
    expect(bildText(0)).toContain("4.520");
    await klick(q("bild-berichtigung-rueckgaengig"));
    expect(bildText(0)).toBe("Herr Müller zahlt 4.250 EUR\nam 12.10.2026");

    // K7: … und zurücksetzen — es gilt wieder der Rohbefund; das Original ist unverändert.
    await klick(q("bild-berichtigung-zuruecksetzen"));
    expect(bildText(0)).toBe(ERKANNT.R?.text);
    expect(q("bild-berichtigung-meldung")?.textContent).toBe(
      i18n.t("bildfundstelle.korrektur.zurueckgesetzt"),
    );
    expect(korrekturServer.konten.get("konto-a")).toEqual([]);
    await klick(stelle(0, "Mül1er"));
    expect(ansichtBild()).toBe(BILD_R);
    expect(html).toContain(BILD_R);
  });
});

describe("E5 · K8 — keine Übertragung auf ein verändertes Bild oder eine andere Quelle", () => {
  it("Bild an derselben Stelle getauscht: Rohbefund und Hinweis; andere Quelle: nichts", async () => {
    await profilLaden("konto-a");
    await zeige(rumpf(), weg("ko:fiktiv-1"));
    await klick(bildZeile(1).querySelector("[data-testid=bild-berichtigung-bearbeiten]"));
    await tippe(q("bild-berichtigung-feld"), "LAGER 29 (geprüft)");
    await klick(q("bild-berichtigung-speichern"));
    expect(bildText(1)).toBe("LAGER 29 (geprüft)");

    // Verändertes Bild an derselben Stelle (neue Bytes): nichts übertragen, sichtbar benannt.
    await zeige(rumpf(BILD_N), weg("ko:fiktiv-1"));
    expect(bildText(1)).toBe("LAGER 30");
    expect(berichtigt(1)).toBe("false");
    expect(andereFassung(1)).toBe(i18n.t("bildfundstelle.korrektur.andereFassung"));

    // Dasselbe (unveränderte) Bild in einer ANDEREN Quelle: ebenfalls keine Berichtigung.
    await zeige(rumpf(), weg("ko:fiktiv-2"));
    expect(bildText(1)).toBe("LAGER 29");
    expect(berichtigt(1)).toBe("false");
    expect(andereFassung(1)).toBeNull();

    // Zurück in der eigenen Quelle mit dem unveränderten Bild: sie gilt.
    await zeige(rumpf(), weg("ko:fiktiv-1"));
    expect(bildText(1)).toBe("LAGER 29 (geprüft)");
  });
});

describe("E6 · K9 — Rollen, Konten und fehlende Quelle", () => {
  it("ohne Schreibrecht: keine Bearbeitung, der Grund steht da", async () => {
    korrekturServer.ohneRecht.add("konto-v");
    await profilLaden("konto-v");
    await zeige(rumpf(), weg("ko:fiktiv-1"));
    expect(container.querySelector("[data-testid=bild-berichtigung-bearbeiten]")).toBeNull();
    expect(q("bild-berichtigung-kein-recht")?.textContent).toBe(
      i18n.t("bildfundstelle.korrektur.keinRecht"),
    );
    // Die Fundstelle bleibt nutzbar (Lesen ist erlaubt).
    await klick(stelle(0, "4.250"));
    expect(ansichtBild()).toBe(BILD_R);
  });

  it("Kontowechsel: die Berichtigung des einen Kontos gilt im anderen nicht", async () => {
    await profilLaden("konto-a");
    await zeige(rumpf(), weg("ko:fiktiv-1"));
    await klick(bildZeile(1).querySelector("[data-testid=bild-berichtigung-bearbeiten]"));
    await tippe(q("bild-berichtigung-feld"), "LAGER 29 (Konto A)");
    await klick(q("bild-berichtigung-speichern"));
    expect(bildText(1)).toBe("LAGER 29 (Konto A)");

    await profilLaden("konto-b");
    await zeige(rumpf(), weg("ko:fiktiv-1"));
    expect(bildText(1)).toBe("LAGER 29");
    await profilLaden("konto-a");
    await zeige(rumpf(), weg("ko:fiktiv-1"));
    expect(bildText(1)).toBe("LAGER 29 (Konto A)");
  });

  it("ohne gespeicherte Quelle: keine Berichtigung angeboten, kein Abruf, ein Hinweis", async () => {
    await profilLaden("konto-a");
    await zeige(rumpf(), weg(undefined));
    expect(container.querySelector("[data-testid=bild-berichtigung]")).toBeNull();
    expect(q("bild-berichtigung-ohne-quelle")?.textContent).toBe(
      i18n.t("bildfundstelle.korrektur.ohneQuelle"),
    );
    expect(bildKorrekturApi.lesen).not.toHaveBeenCalled();
    // Die Fundstelle geht trotzdem.
    await klick(stelle(1, "29"));
    expect(ansichtBild()).toBe(BILD_L);
  });
});

// ================================================================================================
// Nacharbeit 2 (Bens Befund „Ladestatus“) · Klara fragt nur mit BESTÄTIGTEM Korrekturstand.
// ================================================================================================

const BERICHTIGT_R = "Herr Müller zahlt 4.250 EUR\nam 12.10.2026";

/** Am Server liegt für das Rechnungsbild schon eine Berichtigung des Kontos. */
async function gespeicherteBerichtigung(konto: string): Promise<void> {
  const kennung = await bildInhaltskennung(bildMitMassen("R", 1000, 500));
  korrekturServer.konten.set(konto, [
    {
      daten: {
        quelle: "ko:fiktiv-1",
        inhaltskennung: kennung ?? "",
        ort: "b1",
        text: BERICHTIGT_R,
        geaendertAm: "2026-10-12T09:00:00.000Z",
      },
      vorher: [],
    },
  ]);
}

const knopf = (id: string): HTMLButtonElement | null =>
  q(id) instanceof HTMLButtonElement ? (q(id) as HTMLButtonElement) : null;

describe("E7 · K5/K6 — verzögertes und fehlgeschlagenes Laden: kein Rohtext an Klara", () => {
  it("lädt noch → beide Aktionen gesperrt; Fehler → sichtbar mit Wiederholung; dann berichtigt", async () => {
    await gespeicherteBerichtigung("konto-a");
    lesenSteuerung.warten = true;
    const frage = vi.fn(
      async (_text: string, _anweisung: string): Promise<AssistResult> => ({
        text: "Antwort",
        demo: false,
      }),
    );
    await profilLaden("konto-a");
    await zeige(rumpf(), weg("ko:fiktiv-1", frage));
    expect(lesenSteuerung.offen.length).toBeGreaterThan(0);

    // Lädt: sichtbar „wartet“, beide Aktionen gesperrt — auch Eingabe per Tastatur.
    expect(q("klara-bild-kontext-korrektur-wartet")?.textContent).toBe(
      i18n.t("bildfundstelle.klara.wartet"),
    );
    await tippe(q("klara-bild-kontext-frage"), "Was zahlt Herr Müller?");
    expect(knopf("klara-bild-kontext-fragen")?.disabled).toBe(true);
    expect(knopf("klara-bild-kontext-zusammenfassen")?.disabled).toBe(true);
    await taste(q("klara-bild-kontext-frage"), "Enter");
    await klick(q("klara-bild-kontext-zusammenfassen"));
    expect(frage).not.toHaveBeenCalled();

    // Das Laden scheitert: sichtbar, mit Wiederholung; weiterhin keine Anfrage.
    await act(async () => {
      for (const o of lesenSteuerung.offen.splice(0)) {
        o.fehl(new TypeError("Failed to fetch"));
      }
    });
    await abwarten();
    expect(q("klara-bild-kontext-korrektur-fehler")?.textContent).toBe(
      i18n.t("bildfundstelle.klara.ladeFehler"),
    );
    expect(q("klara-bild-kontext-korrektur-fehler")?.getAttribute("role")).toBe("alert");
    expect(q("bild-berichtigung-erneut")).not.toBeNull();
    expect(knopf("klara-bild-kontext-zusammenfassen")?.disabled).toBe(true);
    await taste(q("klara-bild-kontext-frage"), "Enter");
    expect(frage).not.toHaveBeenCalled();
    // Angezeigt wird der Rohbefund — und das steht da.
    expect(bildText(0)).toBe(ERKANNT.R?.text);

    // Wiederholen: erst „lädt“, dann der bestätigte Stand mit der gespeicherten Berichtigung.
    await klick(q("klara-bild-kontext-korrektur-erneut"));
    expect(q("klara-bild-kontext-korrektur-wartet")).not.toBeNull();
    lesenSteuerung.warten = false;
    await act(async () => {
      for (const o of lesenSteuerung.offen.splice(0)) {
        o.ok();
      }
    });
    await abwarten();
    expect(q("klara-bild-kontext-korrektur-fehler")).toBeNull();
    expect(bildText(0)).toBe(BERICHTIGT_R);

    await klick(q("klara-bild-kontext-fragen"));
    await klick(q("klara-bild-kontext-zusammenfassen"));
    expect(frage).toHaveBeenCalledTimes(2);
    for (const [kontext] of frage.mock.calls) {
      expect(kontext).toContain("Herr Müller zahlt 4.250 EUR");
      expect(kontext).not.toContain("Mül1er");
    }
  });

  it("Kontowechsel während des Ladens: die verspätete Antwort des alten Kontos gilt nicht", async () => {
    await gespeicherteBerichtigung("konto-a");
    lesenSteuerung.warten = true;
    const frage = vi.fn(
      async (_text: string, _anweisung: string): Promise<AssistResult> => ({
        text: "Antwort",
        demo: false,
      }),
    );
    await profilLaden("konto-a");
    await zeige(rumpf(), weg("ko:fiktiv-1", frage));
    const altesKonto = lesenSteuerung.offen.splice(0);
    expect(altesKonto.length).toBeGreaterThan(0);

    // Wechsel zu Konto B (ohne Berichtigung); dessen Stand kommt sofort.
    lesenSteuerung.warten = false;
    await profilLaden("konto-b");
    await zeige(rumpf(), weg("ko:fiktiv-1", frage));
    // Jetzt erst kommt die Antwort für Konto A — sie darf nichts anwenden.
    await act(async () => {
      for (const o of altesKonto) {
        o.ok();
      }
    });
    await abwarten();
    expect(bildText(0)).toBe(ERKANNT.R?.text);
    await klick(q("klara-bild-kontext-zusammenfassen"));
    expect(frage).toHaveBeenCalledTimes(1);
    expect(frage.mock.calls[0]?.[0]).not.toContain("Herr Müller");

    // Zurück zu Konto A: dessen Berichtigung gilt (bestätigt geladen).
    await profilLaden("konto-a");
    await zeige(rumpf(), weg("ko:fiktiv-1", frage));
    expect(bildText(0)).toBe(BERICHTIGT_R);
  });
});
