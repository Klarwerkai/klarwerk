// @vitest-environment jsdom
// ================================================================================================
// OCR-E06 · „KLARA, WAS STEHT HIER?“ AN DER GEMOUNTETEN FLÄCHE — die Komponente, die JEDER
// RichTextEditor trägt (`BildBefundeImRumpf` → `KlaraBereichsfrage`).
// ================================================================================================
//
// Ersetzt sind: die Texterkennung (kontrollierte Lesung mit Wortrahmen je Bildmarke,
// `bereich-fixtur.ts`), der Beschreibungs- und Fragenweg der Fläche (Test-Naht
// `ImageDescribeValueProvider`, `frage` = der assist-Weg), der Draht des Assistenzprofils und — weil
// jsdom kein Layout hat — Bildgröße und Lage der Vorschau. Analyse, Automatik, Auswahl, Bereichsbau,
// Kontextbau und Oberfläche sind echt; der Bereich wird mit Zeigerereignissen aufgezogen.
//
//   M1  K1/K4 — die Automatik liest beide Bilder wie bisher; das ausgewählte Bild liefert seinen
//       Text und Klaras Erklärung, Klara bekommt nur dieses Bild (keine neue Erkennung).
//   M2  K2 — ein Bereich im Bild mit mehreren Blöcken liefert nur seinen Block; die Nachfrage geht
//       mit demselben Bereich und dem bisherigen Verlauf an Klara.
//   M3  K3 — ein anderer Bereich oder ein anderes Bild ist ein neuer Kontext; eine verspätete
//       Antwort zur alten Auswahl erscheint nie.
//   M4  K4 — Automatik aus: nichts automatisch gelesen; die Frage liest genau das eine Bild.
//   M5  leerer und unleserlicher Bereich, ohne Modell — benannt, nichts erfunden, Klara nicht gefragt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OcrResult } from "../../apps/web/src/lib/ocr";

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
import { bildKorrekturApi } from "../../apps/web/src/api/bildKorrekturen";
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
import { bildBytes, bildInhaltskennung } from "../../apps/web/src/lib/bildAutomatik";
import type { BildKorrekturDaten } from "../../apps/web/src/lib/bildKorrektur";
import {
  ladeBildKorrekturen,
  verwerfeBildKorrekturen,
} from "../../apps/web/src/lib/bildKorrekturenStand";
import type { BildBereich } from "../../apps/web/src/lib/klaraBereich";
import { BEREICH, MEHRBLOCK, MEHRBLOCK_GEKENNZEICHNET, bereichsEngine } from "./bereich-fixtur";
import { bildMitMassen, dataUrl } from "./deck";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const profile = new Map<string, AssistenzProfilAntwort>();

function profilMit(bildAutomatik: boolean): AssistenzProfilAntwort {
  return {
    profil: {
      name: null,
      avatar: null,
      bewegung: "standard",
      eingerichtetAm: null,
      fassung: 1,
      geaendertAm: "2026-10-12T10:00:00.000Z",
      bildAutomatik,
    },
    einrichtungOffen: true,
  };
}

const BILD_MB = dataUrl(bildMitMassen("MB", 1000, 600));
const BILD_LS = dataUrl(bildMitMassen("LS", 1000, 600));

const RUMPF = [
  "<p>Einleitung zur Abrechnung der Anlage.</p>",
  `<figure><img data-image-id="kw-1" src="${BILD_MB}"></figure>`,
  "<p>Weiter im Text.</p>",
  `<figure><img data-image-id="kw-2" src="${BILD_LS}"></figure>`,
].join("");

const describeBild = vi.fn(
  async (_src: string): Promise<DescribeImageResult> => ({ text: "Ein Schild", demo: false }),
);

type Frage = NonNullable<ImageDescribeValue["frage"]>;

function weg(frage?: Frage): ImageDescribeValue {
  return {
    available: true,
    describe: describeBild,
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

async function zeige(w: ImageDescribeValue, quelle?: string): Promise<void> {
  await act(async () => {
    root.render(
      createElement(ImageDescribeValueProvider, {
        value: { ...w, ...(quelle ? { quelle } : {}) },
        children: createElement(BildBefundeImRumpf, { html: RUMPF }),
      }),
    );
  });
  await abwarten();
}

async function profilLaden(bildAutomatik = true): Promise<void> {
  profile.set("konto-a", profilMit(bildAutomatik));
  await act(async () => {
    await ladeAssistenzProfil("konto-a");
  });
}

const q = (id: string): HTMLElement | null => container.querySelector(`[data-testid="${id}"]`);
const alle = (id: string): HTMLElement[] => [
  ...container.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`),
];

async function klick(el: Element | null): Promise<void> {
  if (!el) {
    throw new Error("Element fehlt");
  }
  await act(async () => {
    (el as HTMLButtonElement).click();
  });
  await abwarten();
}

async function tippe(el: HTMLElement | null, text: string): Promise<void> {
  const feld = el as HTMLInputElement;
  const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setzer?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function waehleBild(nr: number): Promise<void> {
  await klick(container.querySelector(`[data-testid="klara-bereich-bild"][data-bild="${nr}"]`));
}

/** Die Vorschau steht mit halber Größe da (500 × 300 für 1000 × 600 Pixel im Original). */
const MASSSTAB = 0.5;

async function vorschauGeladen(): Promise<HTMLElement> {
  const flaeche = q("klara-bereich-vorschau");
  const bild = flaeche?.querySelector("img");
  if (!flaeche || !bild) {
    throw new Error("Vorschau fehlt");
  }
  Object.defineProperty(bild, "naturalWidth", { configurable: true, value: MEHRBLOCK.breite });
  Object.defineProperty(bild, "naturalHeight", { configurable: true, value: MEHRBLOCK.hoehe });
  const breite = MEHRBLOCK.breite * MASSSTAB;
  const hoehe = MEHRBLOCK.hoehe * MASSSTAB;
  const rahmen = { left: 0, top: 0, x: 0, y: 0, width: breite, height: hoehe };
  bild.getBoundingClientRect = () => ({ ...rahmen, right: breite, bottom: hoehe }) as DOMRect;
  await act(async () => {
    bild.dispatchEvent(new Event("load"));
  });
  return flaeche;
}

/** Zieht einen Bereich (Pixel im Original) mit Zeigerereignissen auf der Vorschau auf. */
async function zieheBereich(b: BildBereich): Promise<void> {
  const flaeche = await vorschauGeladen();
  const zeiger = (art: string, x: number, y: number): void => {
    const e = new MouseEvent(art, { bubbles: true, clientX: x * MASSSTAB, clientY: y * MASSSTAB });
    flaeche.dispatchEvent(e);
  };
  await act(async () => {
    zeiger("pointerdown", b.x0, b.y0);
    zeiger("pointermove", (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
    zeiger("pointermove", b.x1, b.y1);
    zeiger("pointerup", b.x1, b.y1);
  });
  await abwarten();
}

const ORT_1 = "diesem Text · Bild 1";

beforeEach(async () => {
  await i18n.changeLanguage("de");
  profile.clear();
  vi.spyOn(bildKorrekturApi, "lesen").mockResolvedValue({ darfBearbeiten: true, korrekturen: [] });
  vi.spyOn(assistenzProfilApi, "lesen").mockImplementation(
    async () => profile.get("konto-a") ?? { profil: null, einrichtungOffen: true },
  );
  steuerung.ocr.mockReset();
  steuerung.ocr.mockImplementation(bereichsEngine);
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

describe("M1 · K1/K4 — ausgewähltes Bild: Text und Erklärung; die Automatik bleibt", () => {
  it("die Automatik liest beide Bilder; „Was steht hier?“ nutzt nur das gewählte Bild", async () => {
    await profilLaden();
    const frage = vi.fn<Frage>(async () => ({
      text: "Eine Rechnung über 1.800 EUR, zahlbar bis zum 31.10.2026.",
      demo: false,
    }));
    await zeige(weg(frage));

    // K4: ohne Auswahl liest die Automatik wie bisher, und „Klara zu diesem Inhalt fragen“ steht da.
    expect(steuerung.ocr).toHaveBeenCalledTimes(2);
    const status = alle("bild-befund").map((el) => el.getAttribute("data-status"));
    expect(status).toEqual(["gelesen", "gelesen"]);
    expect(q("klara-bild-kontext")?.getAttribute("data-vollstaendig")).toBe("true");
    expect(q("klara-bereich-host")?.textContent).toBe(i18n.t("klarabereich.host"));

    await waehleBild(1);
    expect(q("klara-bereich-auswahl")?.textContent).toBe(
      i18n.t("klarabereich.auswahl.ganz", { ort: ORT_1 }),
    );
    await klick(q("klara-bereich-was-steht-hier"));

    // K1: der Text des Bildes — aus der vorhandenen Lesung, ohne neue Erkennung.
    expect(q("klara-bereich-text")?.textContent).toBe(MEHRBLOCK_GEKENNZEICHNET);
    expect(q("klara-bereich-herkunft")?.textContent).toBe(
      i18n.t("klarabereich.herkunft.wiederverwendet"),
    );
    expect(steuerung.ocr).toHaveBeenCalledTimes(2);

    // … und Klaras Erklärung zu genau diesem Inhalt.
    expect(frage).toHaveBeenCalledTimes(1);
    const [kontext, anweisung] = frage.mock.calls[0] ?? ["", ""];
    expect(kontext).toContain(`[${ORT_1}]`);
    expect(kontext).toContain(`Erkannter Text: ${MEHRBLOCK_GEKENNZEICHNET}`);
    expect(kontext).toContain("Bildinhalt: Ein Schild");
    expect(kontext).not.toContain("Einleitung");
    expect(kontext).not.toContain("LIEFERSCHEIN");
    expect(anweisung).toContain(`[${ORT_1}]`);
    expect(anweisung).toContain("Was steht hier?");
    expect(q("klara-bereich-antwort")?.textContent).toContain("1.800 EUR");
  });
});

describe("M2 · K2 — ein Bereich liefert nur seinen Block; Nachfragen bleiben dort", () => {
  it("Block „SUMME 1.800 EUR“, dann eine Nachfrage mit demselben Bereich", async () => {
    await profilLaden();
    const antworten = ["Dort steht eine Summe: 1.800 EUR.", "Die Währung ist Euro."];
    const frage = vi.fn<Frage>(async () => ({ text: antworten.shift() ?? "", demo: false }));
    await zeige(weg(frage));
    await waehleBild(1);
    await zieheBereich(BEREICH.summe);
    expect(q("klara-bereich-auswahl")?.textContent).toBe(
      i18n.t("klarabereich.auswahl.bereich", { ort: ORT_1, ...BEREICH.summe }),
    );
    expect(q("klara-bereich-rahmen")).not.toBeNull();

    await klick(q("klara-bereich-was-steht-hier"));
    expect(q("klara-bereich-text")?.textContent).toBe("SUMME 1.800 EUR");
    const [kontext, anweisung] = frage.mock.calls[0] ?? ["", ""];
    expect(kontext).toContain("Erkannter Text: SUMME 1.800 EUR");
    for (const fremd of ["RECHNUNG", "NOTIZ", "ZAHLBAR", "PRUEFVERMERK", "Ein Schild"]) {
      expect(kontext).not.toContain(fremd);
    }
    const ortBereich = i18n.t("klarabereich.ort.bereich", { ort: ORT_1 });
    expect(anweisung).toContain(`[${ortBereich}]`);

    // Die Nachfrage: dieselbe Auswahl, ihr Text und der bisherige Verlauf.
    await tippe(q("klara-bereich-nachfrage"), "Welche Währung ist das?");
    await klick(q("klara-bereich-nachfragen"));
    expect(frage).toHaveBeenCalledTimes(2);
    const [kontext2, anweisung2] = frage.mock.calls[1] ?? ["", ""];
    expect(kontext2).toContain("Erkannter Text: SUMME 1.800 EUR");
    expect(kontext2).toContain("Frage: Was steht hier?");
    expect(kontext2).toContain("Antwort: Dort steht eine Summe: 1.800 EUR.");
    expect(kontext2).not.toContain("RECHNUNG");
    expect(anweisung2).toContain("Welche Währung ist das?");
    expect(anweisung2).toContain(`[${ortBereich}]`);
    const eintraege = alle("klara-bereich-eintrag").map((el) => el.textContent ?? "");
    expect(eintraege).toHaveLength(2);
    expect(eintraege[1]).toContain("Die Währung ist Euro.");
    // Fragen liest nichts neu.
    expect(steuerung.ocr).toHaveBeenCalledTimes(2);
  });
});

describe("M3 · K3 — der Wechsel der Auswahl wechselt den Kontext zuverlässig", () => {
  it("anderer Bereich, anderes Bild: neues Ergebnis, kein alter Verlauf", async () => {
    await profilLaden();
    const frage = vi.fn<Frage>(async () => ({ text: "Erklärung.", demo: false }));
    await zeige(weg(frage));
    await waehleBild(1);
    await zieheBereich(BEREICH.summe);
    await klick(q("klara-bereich-was-steht-hier"));
    expect(q("klara-bereich-text")?.textContent).toBe("SUMME 1.800 EUR");

    // Anderer Bereich: das alte Ergebnis ist weg, das neue gehört nur zum neuen Bereich.
    await zieheBereich(BEREICH.datum);
    expect(q("klara-bereich-ergebnis")).toBeNull();
    await klick(q("klara-bereich-was-steht-hier"));
    expect(q("klara-bereich-text")?.textContent).toBe("ZAHLBAR BIS [?31.10.2026]");
    expect(q("klara-bereich-ergebnis")?.textContent).toContain(
      i18n.t("klarabereich.unsicher", { n: 1 }),
    );
    const [kontext] = frage.mock.calls[1] ?? [""];
    expect(kontext).not.toContain("SUMME");
    expect(kontext).not.toContain("Frage:");
    expect(alle("klara-bereich-eintrag")).toHaveLength(1);

    // Anderes Bild: ganz ausgewählt, sein eigener Text.
    await waehleBild(2);
    expect(q("klara-bereich-ergebnis")).toBeNull();
    await klick(q("klara-bereich-was-steht-hier"));
    expect(q("klara-bereich-text")?.textContent).toBe("LIEFERSCHEIN 77");
    const [kontext3] = frage.mock.calls[2] ?? [""];
    expect(kontext3).toContain("[diesem Text · Bild 2]");
    expect(kontext3).not.toContain("ZAHLBAR");
  });

  it("eine verspätete Antwort zur alten Auswahl erscheint nach dem Wechsel nie", async () => {
    await profilLaden();
    const tore: ((r: AssistResult) => void)[] = [];
    const frage = vi.fn<Frage>(
      () =>
        new Promise<AssistResult>((oeffnen) => {
          tore.push(oeffnen);
        }),
    );
    await zeige(weg(frage));
    await waehleBild(1);
    await zieheBereich(BEREICH.summe);
    await klick(q("klara-bereich-was-steht-hier"));
    expect(q("klara-bereich-laeuft")?.textContent).toBe(i18n.t("klarabereich.laeuft.antwort"));

    await waehleBild(2);
    expect(q("klara-bereich-laeuft")).toBeNull();
    await act(async () => {
      tore[0]?.({ text: "Veraltete Erklärung zur Summe.", demo: false });
    });
    await abwarten();
    expect(q("klara-bereich-ergebnis")).toBeNull();
    expect(container.textContent).not.toContain("Veraltete Erklärung");
  });
});

describe("M4 · K4 — Automatik aus: die Bereichsfrage ergänzt gezielt genau ein Bild", () => {
  it("nichts automatisch gelesen; „Was steht hier?“ liest nur das gewählte Bild", async () => {
    await profilLaden(false);
    await zeige(weg());
    expect(steuerung.ocr).not.toHaveBeenCalled();
    const status = alle("bild-befund").map((el) => el.getAttribute("data-status"));
    expect(status).toEqual(["nicht-analysiert", "nicht-analysiert"]);

    await waehleBild(2);
    await klick(q("klara-bereich-was-steht-hier"));
    expect(steuerung.ocr).toHaveBeenCalledTimes(1);
    expect(steuerung.ocr.mock.calls[0]?.[0]).toBe(BILD_LS);
    expect(q("klara-bereich-text")?.textContent).toBe("LIEFERSCHEIN 77");
    expect(q("klara-bereich-herkunft")?.textContent).toBe(i18n.t("klarabereich.herkunft.gelesen"));
    // Ohne Fragenweg: der Text steht da, eine Erklärung wird nicht erfunden.
    expect(q("klara-bereich-ohne-modell")?.textContent).toBe(
      i18n.t("klarabereich.antwort.ohneModell"),
    );
  });
});

describe("M5 · leere und unleserliche Bereiche — benannt, Klara wird nicht gefragt", () => {
  it("leer und unleserlich: Hinweis statt Text, keine Erklärung", async () => {
    await profilLaden();
    const frage = vi.fn<Frage>(async () => ({ text: "darf nicht kommen", demo: false }));
    await zeige(weg(frage));
    await waehleBild(1);

    await zieheBereich(BEREICH.leer);
    await klick(q("klara-bereich-was-steht-hier"));
    expect(q("klara-bereich-ergebnis")?.getAttribute("data-status")).toBe("leer");
    expect(q("klara-bereich-status")?.textContent).toBe(i18n.t("klarabereich.status.leer"));
    expect(q("klara-bereich-text")).toBeNull();
    expect(q("klara-bereich-ohne-text")?.textContent).toBe(i18n.t("klarabereich.antwort.keinText"));

    await zieheBereich(BEREICH.unleserlich);
    await klick(q("klara-bereich-was-steht-hier"));
    expect(q("klara-bereich-ergebnis")?.getAttribute("data-status")).toBe("unleserlich");
    expect(q("klara-bereich-status")?.textContent).toBe(i18n.t("klarabereich.status.unleserlich"));
    expect(frage).not.toHaveBeenCalled();
  });
});

describe("M6 · E02 in E06: gespeicherte Berichtigung und wechselnder Stand", () => {
  it("liest denselben bestätigten Korrekturstand im ganzen Bild und im Bereich; Neuladen und Rücksetzen bewerten neu", async () => {
    await profilLaden();
    const bytes = bildBytes(BILD_MB);
    if (!bytes) throw new Error("Fixture");
    const kennung = await bildInhaltskennung(bytes);
    const korrektur: BildKorrekturDaten = {
      quelle: "entwurf:e06",
      inhaltskennung: kennung ?? "",
      ort: null,
      text: MEHRBLOCK_GEKENNZEICHNET.replace("1.800", "1.500"),
      schritte: 0,
      geaendertAm: "2026-10-20T07:00:00Z",
    };
    vi.mocked(bildKorrekturApi.lesen).mockResolvedValue({
      darfBearbeiten: true,
      korrekturen: [korrektur],
    });
    const frage = vi.fn<Frage>(async () => ({ text: "SUMME 1.500 EUR", demo: false }));
    await zeige(weg(frage), "entwurf:e06");
    await waehleBild(1);
    await zieheBereich(BEREICH.summe);
    await klick(q("klara-bereich-was-steht-hier"));
    expect(q("klara-bereich-text")?.textContent).toBe("SUMME 1.500 EUR");
    expect(frage.mock.calls[0]?.[0]).not.toContain("1.800");
    // Wie nach neuem Laden: erneut der vom Speicher bestätigte Stand.
    await act(async () => {
      await ladeBildKorrekturen("konto-a");
    });
    await klick(q("klara-bereich-ganz"));
    await klick(q("klara-bereich-was-steht-hier"));
    expect(q("klara-bereich-text")?.textContent).toContain("1.500");
    // Zurücksetzen ändert den Kontext und verwirft die bisherige Antwort.
    vi.mocked(bildKorrekturApi.lesen).mockResolvedValue({ darfBearbeiten: true, korrekturen: [] });
    await act(async () => {
      await ladeBildKorrekturen("konto-a");
    });
    expect(q("klara-bereich-ergebnis")).toBeNull();
    await klick(q("klara-bereich-was-steht-hier"));
    expect(q("klara-bereich-text")?.textContent).toContain("1.800");
    expect(steuerung.ocr).toHaveBeenCalledTimes(2);
  });

  it("fragt während ausstehendem Korrekturlesen nicht mit dem Rohtext", async () => {
    await profilLaden();
    vi.mocked(bildKorrekturApi.lesen).mockImplementation(() => new Promise(() => {}));
    const frage = vi.fn<Frage>(async () => ({ text: "verbotener Rohtext", demo: false }));
    await zeige(weg(frage), "entwurf:e06");
    await waehleBild(1);
    expect((q("klara-bereich-was-steht-hier") as HTMLButtonElement).disabled).toBe(true);
    await klick(q("klara-bereich-was-steht-hier"));
    expect(frage).not.toHaveBeenCalled();
  });
});
