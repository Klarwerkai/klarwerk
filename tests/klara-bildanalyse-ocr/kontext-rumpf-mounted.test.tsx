// @vitest-environment jsdom
// ================================================================================================
// OCR-03 · KLARA NUTZT DIE ERKANNTEN BILDER, UND DIE EINSTELLUNG WIRKT — an der gemounteten
// Komponente, die JEDER RichTextEditor trägt (`BildBefundeImRumpf`).
// ================================================================================================
//
// Ersetzt sind: die Texterkennung (liest die Marke aus den Bildbytes), der Beschreibungs- und der
// Fragenweg der Fläche (Test-Naht `ImageDescribeValueProvider`, `frage` = der assist-Weg) und der
// Draht des Assistenzprofils (`assistenzProfilApi`, ein kleiner Server je Konto im Speicher). Der
// bestätigte Profilstand, die Analyse, der Kontextbau und die Oberfläche sind echt.
//
//   M1  K1/K2/K3/K5 — ohne Klick gelesen; die Frage zu Text, der nur im Bild steht, geht mit Text
//       UND Bildtext an Klara; Antwort und Fundstelle (Bild) stehen da; die Zusammenfassung nennt
//       die berücksichtigten Bilder; das Bild wurde mit seinen Originalbytes gelesen.
//   M2  Während das Lesen läuft: Stand sichtbar, Anweisung und Antwort sagen „unvollständig“.
//   M3  K4 — Einstellung aus: keine Erkennung; an: Erkennung; „Neuladen“ liest denselben Stand und
//       wirkt; wieder aus: vorhandene Ergebnisse bleiben, ein neues Bild wird nicht gelesen.
//   M4  K6 — Kontowechsel: nichts aus der Analyse des vorigen Kontos wird wiederverwendet; ist das
//       Profil nicht lesbar, wird nicht automatisch gelesen, und das steht da.
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
  type AssistenzProfilAenderung,
  type AssistenzProfilAntwort,
  assistenzProfilApi,
} from "../../apps/web/src/api/assistenzProfil";
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
import { speichereBildAutomatik } from "../../apps/web/src/lib/bildAutomatikEinstellung";
import { TEXT_JE_MARKE, bildMit, dataUrl, markeAus } from "./deck";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

// ------------------------------------------------------------------------------------------------
// Ein kleiner Profilserver je Konto (nur der Draht ist ersetzt; die Fassungsregel bleibt einfach).
// ------------------------------------------------------------------------------------------------
const server = {
  konto: "konto-a",
  profile: new Map<string, AssistenzProfilAntwort>(),
  lesenScheitert: false,
};

function profilMit(bildAutomatik: boolean, fassung: number): AssistenzProfilAntwort {
  return {
    profil: {
      name: null,
      avatar: null,
      bewegung: "standard",
      eingerichtetAm: null,
      fassung,
      geaendertAm: "2026-10-12T10:00:00.000Z",
      bildAutomatik,
    },
    einrichtungOffen: true,
  };
}

const BILD_A = dataUrl(bildMit("A"));
const BILD_C = dataUrl(bildMit("C"));
const BILD_E = dataUrl(bildMit("E"));

function rumpf(zusatz = ""): string {
  return [
    "<p>Einleitung zur Wartung der Anlage.</p>",
    `<figure><img data-image-id="kw-1" src="${BILD_A}"></figure>`,
    "<p>Weiter im Text.</p>",
    `<figure><img data-image-id="kw-2" src="${BILD_C}"></figure>`,
    zusatz,
  ].join("");
}

const describeBild = vi.fn(
  async (_src: string): Promise<DescribeImageResult> => ({ text: "Ein Schild", demo: false }),
);

function weg(frage?: ImageDescribeValue["frage"]): ImageDescribeValue {
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

async function zeige(html: string, w: ImageDescribeValue, warten = true): Promise<void> {
  await act(async () => {
    root.render(
      createElement(ImageDescribeValueProvider, {
        value: w,
        children: createElement(BildBefundeImRumpf, { html }),
      }),
    );
  });
  if (warten) {
    await abwarten();
  }
}

async function profilLaden(konto: string): Promise<void> {
  server.konto = konto;
  await act(async () => {
    await ladeAssistenzProfil(konto);
  });
}

function neuMontieren(): void {
  act(() => root.unmount());
  root = createRoot(container);
}

const q = (id: string): HTMLElement | null => container.querySelector(`[data-testid="${id}"]`);

function befunde(): { status: string | null; text: string; zeile: string }[] {
  return [...container.querySelectorAll<HTMLElement>("[data-testid=bild-befund]")].map((el) => ({
    status: el.getAttribute("data-status"),
    text: el.querySelector("[data-testid=bild-befund-text]")?.textContent ?? "",
    zeile: (el.textContent ?? "").replace(/\s+/g, " "),
  }));
}

async function tippe(el: HTMLElement | null, text: string): Promise<void> {
  const feld = el as HTMLInputElement;
  const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setzer?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function klick(el: HTMLElement | null): Promise<void> {
  await act(async () => {
    (el as HTMLButtonElement).click();
  });
  await abwarten();
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  server.konto = "konto-a";
  server.profile.clear();
  server.lesenScheitert = false;
  vi.spyOn(assistenzProfilApi, "lesen").mockImplementation(async () => {
    if (server.lesenScheitert) {
      throw new TypeError("Failed to fetch");
    }
    return server.profile.get(server.konto) ?? { profil: null, einrichtungOffen: true };
  });
  vi.spyOn(assistenzProfilApi, "speichern").mockImplementation(
    async (a: AssistenzProfilAenderung) => {
      const fassung = (server.profile.get(server.konto)?.profil?.fassung ?? 0) + 1;
      const neu = profilMit(a.bildAutomatik ?? true, fassung);
      server.profile.set(server.konto, neu);
      return neu;
    },
  );
  steuerung.ocr.mockReset();
  steuerung.ocr.mockImplementation(async (src: unknown): Promise<OcrResult> => {
    const marke = markeAus(String(src));
    return { status: "success", text: (marke ? TEXT_JE_MARKE[marke] : "") ?? "" };
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
  vi.restoreAllMocks();
});

describe("M1 · K1/K2/K3/K5 — Klara nutzt den Bildtext neben dem Text, mit Fundstelle", () => {
  it("Frage zu Text nur im Bild, Antwort mit Fundstelle; Zusammenfassung nennt die Bilder", async () => {
    await profilLaden("konto-a"); // ohne abweichende Präferenz
    const frage = vi.fn(
      async (_text: string, _anweisung: string): Promise<AssistResult> => ({
        text: "Auf der Prüfkarte steht die Nummer 47 [diesem Text · Bild 1].",
        demo: false,
      }),
    );
    await zeige(rumpf(), weg(frage));

    // K3: ohne Klick gelesen — aus den Originalbytes der Bilder im Text (K5).
    expect(steuerung.ocr).toHaveBeenCalledTimes(2);
    expect(steuerung.ocr.mock.calls.map((c) => c[0])).toEqual([BILD_A, BILD_C]);
    expect(befunde().map((b) => b.text)).toEqual([TEXT_JE_MARKE.A, TEXT_JE_MARKE.C]);
    expect(q("klara-bild-kontext")?.getAttribute("data-vollstaendig")).toBe("true");

    // K1: die Frage betrifft Text, der NUR im ersten Bild steht.
    await tippe(q("klara-bild-kontext-frage"), "Welche Nummer steht auf der PRUEFKARTE?");
    await klick(q("klara-bild-kontext-fragen"));
    expect(frage).toHaveBeenCalledTimes(1);
    const [kontext, anweisung] = frage.mock.calls[0] ?? ["", ""];
    expect(kontext).toContain("Einleitung zur Wartung der Anlage.");
    expect(kontext).not.toMatch(/Einleitung[^\n]*PRUEFKARTE/);
    expect(kontext).toContain(`[diesem Text · Bild 1] Bildtext: ${TEXT_JE_MARKE.A}`);
    expect(kontext).toContain(`[diesem Text · Bild 2] Bildtext: ${TEXT_JE_MARKE.C}`);
    expect(kontext).toContain("[diesem Text · Bild 1] Bildinhalt: Ein Schild");
    expect(anweisung).toContain("Welche Nummer steht auf der PRUEFKARTE?");
    expect(anweisung).toContain("[diesem Text · Bild 1]");

    const antwort = q("klara-bild-kontext-antwort");
    expect(antwort?.getAttribute("data-auftrag")).toBe("frage");
    expect(q("klara-bild-kontext-antworttext")?.textContent).toContain("Nummer 47");
    const belege = [
      ...container.querySelectorAll<HTMLElement>("[data-testid=klara-bild-kontext-beleg]"),
    ];
    expect(belege[0]?.getAttribute("data-art")).toBe("bild");
    expect(belege[0]?.textContent).toContain("diesem Text · Bild 1");
    expect(belege[0]?.textContent).toContain(TEXT_JE_MARKE.A);
    expect(q("klara-bild-kontext-unvollstaendig")).toBeNull();

    // K2: Zusammenfassung — Text und beide Bildtexte gehen an Klara, die Bilder sind benannt.
    await klick(q("klara-bild-kontext-zusammenfassen"));
    expect(frage).toHaveBeenCalledTimes(2);
    const [kontext2, anweisung2] = frage.mock.calls[1] ?? ["", ""];
    expect(kontext2).toContain("Weiter im Text.");
    expect(kontext2).toContain(TEXT_JE_MARKE.A);
    expect(kontext2).toContain(TEXT_JE_MARKE.C);
    expect(anweisung2).toContain(i18n.t("klarabildkontext.anweisung.zusammenfassung"));
    expect(q("klara-bild-kontext-bilder")?.textContent).toBe(
      i18n.t("klarabildkontext.belege.beruecksichtigt", {
        orte: "diesem Text · Bild 1; diesem Text · Bild 2",
      }),
    );
    // Fragen ändert nichts: keine weitere Erkennung, keine Beschreibung.
    expect(steuerung.ocr).toHaveBeenCalledTimes(2);
    expect(describeBild).toHaveBeenCalledTimes(2);
  });

  it("ohne Fragenweg: keine erfundene Antwort, aber die Fundstelle im Bild", async () => {
    await profilLaden("konto-a");
    await zeige(rumpf(), weg());
    await tippe(q("klara-bild-kontext-frage"), "Was steht zum LAGER?");
    await klick(q("klara-bild-kontext-fragen"));
    expect(q("klara-bild-kontext-antworttext")).toBeNull();
    expect(q("klara-bild-kontext-ohne-modell")?.textContent).toBe(
      i18n.t("klarabildkontext.antwort.ohneModell"),
    );
    const beleg = q("klara-bild-kontext-beleg");
    expect(beleg?.textContent).toContain("diesem Text · Bild 2");
    expect(beleg?.textContent).toContain(TEXT_JE_MARKE.C);
  });
});

describe("M2 · während des Lesens — Stand sichtbar, nichts als vollständig ausgegeben", () => {
  it("Stand „läuft“, Anweisung und Antwort sagen „unvollständig“; danach vollständig", async () => {
    await profilLaden("konto-a");
    const tor: { oeffnen?: () => void } = {};
    steuerung.ocr.mockImplementation(async (src: unknown): Promise<OcrResult> => {
      const marke = markeAus(String(src));
      if (marke === "C") {
        await new Promise<void>((r) => {
          tor.oeffnen = r;
        });
      }
      return { status: "success", text: (marke ? TEXT_JE_MARKE[marke] : "") ?? "" };
    });
    const frage = vi.fn(
      async (_text: string, _anweisung: string): Promise<AssistResult> => ({
        text: "Bisher gelesen: PRUEFKARTE 47 [diesem Text · Bild 1].",
        demo: false,
      }),
    );
    await zeige(rumpf(), weg(frage));
    const panel = q("klara-bild-kontext");
    expect(panel?.getAttribute("data-laeuft")).toBe("true");
    expect(panel?.getAttribute("data-vollstaendig")).toBe("false");
    expect(q("klara-bild-kontext-stand")?.textContent).toBe(
      i18n.t("klarabildkontext.stand.laeuft", { gelesen: 1, gesamt: 2 }),
    );

    await tippe(q("klara-bild-kontext-frage"), "Was steht im Lager-Bild?");
    await klick(q("klara-bild-kontext-fragen"));
    const [kontext, anweisung] = frage.mock.calls[0] ?? ["", ""];
    expect(kontext).not.toContain(TEXT_JE_MARKE.C);
    const laeuft = i18n.t("klarabildkontext.kontext.offen", {
      status: i18n.t("bildautomatik.status.laeuft"),
    });
    expect(kontext).toContain(`[diesem Text · Bild 2] ${laeuft}`);
    expect(anweisung).toContain(i18n.t("klarabildkontext.anweisung.laeuft"));
    expect(anweisung).toContain(
      i18n.t("klarabildkontext.anweisung.unvollstaendig", { offen: 1, gesamt: 2 }),
    );
    expect(q("klara-bild-kontext-unvollstaendig")?.textContent).toBe(
      i18n.t("klarabildkontext.antwort.unvollstaendig", { offen: 1, gesamt: 2 }),
    );

    tor.oeffnen?.();
    await abwarten();
    expect(q("klara-bild-kontext")?.getAttribute("data-vollstaendig")).toBe("true");
    expect(q("klara-bild-kontext-stand")?.textContent).toBe(
      i18n.t("klarabildkontext.stand.vollstaendig", { gesamt: 2 }),
    );
  });
});

describe("M3 · K4 — die Einstellung wirkt, auch nach dem Neuladen", () => {
  it("aus: nichts gelesen; an: gelesen; neu geladen bleibt der Stand; wieder aus: nichts Neues", async () => {
    server.profile.set("konto-a", profilMit(false, 1));
    await profilLaden("konto-a");
    await zeige(rumpf(), weg());
    expect(steuerung.ocr).not.toHaveBeenCalled();
    expect(container.querySelectorAll("[data-testid=bild-befund-automatik-aus]")).toHaveLength(2);
    expect(q("bild-befunde")?.getAttribute("data-status")).toBe("aus");

    // Einschalten (derselbe Speicherweg wie der Schalter in Setup › Klara) wirkt sofort.
    await act(async () => {
      expect(await speichereBildAutomatik(true)).toBe("gespeichert");
    });
    await abwarten();
    expect(steuerung.ocr).toHaveBeenCalledTimes(2);
    expect(befunde().map((b) => b.text)).toEqual([TEXT_JE_MARKE.A, TEXT_JE_MARKE.C]);

    // Neuladen: Browserstand weg, Profil neu gelesen — „an“ bleibt und wirkt (neue Fläche liest).
    neuMontieren();
    verwerfeAssistenzProfil();
    await profilLaden("konto-a");
    await zeige(rumpf(), weg());
    expect(steuerung.ocr).toHaveBeenCalledTimes(4);

    // Ausschalten: vorhandene Ergebnisse bleiben, ein NEUES Bild wird nicht gelesen.
    await act(async () => {
      expect(await speichereBildAutomatik(false)).toBe("gespeichert");
    });
    await abwarten();
    await zeige(rumpf(`<figure><img data-image-id="kw-3" src="${BILD_E}"></figure>`), weg());
    expect(steuerung.ocr).toHaveBeenCalledTimes(4);
    const nachAus = befunde();
    expect(nachAus.map((b) => b.status)).toEqual(["gelesen", "gelesen", "nicht-analysiert"]);
    expect(nachAus[0]?.zeile).toContain(i18n.t("bildautomatik.wiederverwendet"));
    expect(nachAus[2]?.zeile).toContain(i18n.t("klarabildkontext.grund.automatikAus"));

    // Neuladen: „aus“ bleibt und wirkt — die neue Fläche liest gar nichts.
    neuMontieren();
    verwerfeAssistenzProfil();
    await profilLaden("konto-a");
    await zeige(rumpf(), weg());
    expect(steuerung.ocr).toHaveBeenCalledTimes(4);
    expect(befunde().map((b) => b.status)).toEqual(["nicht-analysiert", "nicht-analysiert"]);
  });
});

describe("M4 · K6 — Ergebnisse gehören zum Konto; ohne lesbares Profil kein stilles Lesen", () => {
  it("Kontowechsel: alles wird für das neue Konto neu gelesen, nichts wiederverwendet", async () => {
    await profilLaden("konto-a");
    await zeige(rumpf(), weg());
    expect(steuerung.ocr).toHaveBeenCalledTimes(2);

    await profilLaden("konto-b");
    await zeige(rumpf(), weg());
    expect(steuerung.ocr).toHaveBeenCalledTimes(4);
    for (const b of befunde()) {
      expect(b.status).toBe("gelesen");
      expect(b.zeile).not.toContain(i18n.t("bildautomatik.wiederverwendet"));
    }
  });

  it("Profil nicht lesbar: nicht automatisch gelesen, und das steht da", async () => {
    server.lesenScheitert = true;
    await profilLaden("konto-a");
    await zeige(rumpf(), weg());
    expect(steuerung.ocr).not.toHaveBeenCalled();
    expect(container.textContent).toContain(
      i18n.t("klarabildkontext.hinweis.einstellungUnbekannt"),
    );
    expect(befunde().map((b) => b.status)).toEqual(["nicht-analysiert", "nicht-analysiert"]);
  });
});
