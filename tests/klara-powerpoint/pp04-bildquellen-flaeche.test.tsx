// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, useEffect } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { assistenzProfilApi } from "../../apps/web/src/api/assistenzProfil";
import { bildKorrekturApi } from "../../apps/web/src/api/bildKorrekturen";
import {
  type FolienDatenLage,
  praesentationDaten,
} from "../../apps/web/src/api/praesentationDaten";
import { FolienDaten } from "../../apps/web/src/components/bibliothek/FolienDaten";
import {
  PowerPointBildquellen,
  usePowerPointBildmeldung,
  usePowerPointBildtext,
} from "../../apps/web/src/components/bibliothek/PowerPointBildquellen";
import "../../apps/web/src/i18n";
import {
  ladeAssistenzProfil,
  verwerfeAssistenzProfil,
} from "../../apps/web/src/lib/assistenzProfil";
import type { BildBefund, QuellenBefund } from "../../apps/web/src/lib/bildAutomatik";
import {
  ladeBildKorrekturen,
  verwerfeBildKorrekturen,
} from "../../apps/web/src/lib/bildKorrekturenStand";

const erkenne = vi.hoisted(() => vi.fn());
vi.mock("../../apps/web/src/lib/bildAutomatikLauf", () => ({
  useBildAnalyse: () => ({ befundFuerBild: erkenne }),
}));
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const KENNUNG = `sha256:${"c".repeat(64)}`;
const element = {
  shapeId: "8",
  name: "Bildbeleg",
  art: "bild" as const,
  text: "",
  bild: { kennung: KENNUNG, bildAufFolie: 1 },
};
const lage: FolienDatenLage = {
  koId: "ko",
  anhangId: "anh",
  objectId: "obj",
  anhangName: "Fiktiv.pptx",
  artikelFassung: 1,
  dateiFassung: "a".repeat(64),
  folien: [
    { sldId: "256", position: 1, titel: "Fiktiv", ausgeblendet: false, elemente: [element] },
  ],
  datenpunkte: [],
  darfErfassen: true,
  darfFreigeben: false,
};
const roh: BildBefund = {
  fundstelle: { quelle: "Fiktiv.pptx", art: "pptx", bild: 1, folie: 1, bildAufFolie: 1 },
  status: "gelesen",
  wiederverwendet: false,
  inhaltskennung: KENNUNG,
  text: "Mitarbeitende B5",
  textGekennzeichnet: "Mitarbeitende [?B5]",
  unsicher: [{ wort: "B5", sicherheit: 40, unleserlich: false }],
  tabelle: null,
  bildinhalt: { status: "nicht-angebunden", text: "" },
};
const quelle = (b = roh): QuellenBefund => ({
  quelle: "Fiktiv.pptx",
  art: "pptx",
  status: "teilweise",
  befunde: [b],
  nichtGelesen: [],
  hinweise: [],
});

function Meldung({ befund, objectId }: { befund: QuellenBefund; objectId: string }) {
  const melde = usePowerPointBildmeldung();
  useEffect(() => melde({ id: "anh", objectId }, befund), [melde, befund, objectId]);
  return null;
}
function Probe() {
  const stand = usePowerPointBildtext(lage, 1, element, null);
  return createElement("output", { "data-probe": "" }, JSON.stringify(stand));
}
const clients: QueryClient[] = [];
let root: ReturnType<typeof createRoot> | null = null;
let ziel: HTMLDivElement;
async function zeige(b = quelle(), objectId = "obj") {
  if (!root) {
    ziel = document.createElement("div");
    document.body.append(ziel);
    root = createRoot(ziel);
  }
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(qc);
  vi.spyOn(praesentationDaten, "lage").mockResolvedValue(lage);
  await act(async () => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          {},
          createElement(
            PowerPointBildquellen,
            {},
            createElement(Meldung, { befund: b, objectId }),
            createElement(Probe),
            createElement(FolienDaten, { koId: "ko", anhangId: "anh" }),
          ),
        ),
      ),
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 15));
  });
}
function probe(): {
  ocr: { text: string; wiederverwendung: { korrekturAm: string | null } } | null;
  wartet: boolean;
} {
  return JSON.parse(ziel.querySelector("[data-probe]")?.textContent ?? "null");
}
async function konto(id: string) {
  vi.spyOn(assistenzProfilApi, "lesen").mockResolvedValue({
    profil: null,
    einrichtungOffen: false,
  });
  await act(async () => {
    await ladeAssistenzProfil(id);
  });
}
afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  document.body.innerHTML = "";
  for (const qc of clients.splice(0)) qc.clear();
  verwerfeAssistenzProfil();
  verwerfeBildKorrekturen();
  vi.restoreAllMocks();
  erkenne.mockClear();
});

describe("PP-04 · gemeinsamer Bildbefund an der bestehenden Folienfläche", () => {
  it("automatischer Bildtext steht im Erfassen-Formular ohne zweiten OCR-Auftrag", async () => {
    await zeige();
    expect(probe().ocr?.text).toBe("Mitarbeitende B5");
    await act(async () => {
      ziel.querySelector<HTMLButtonElement>("[data-erfassen='256:8']")?.click();
    });
    expect(ziel.querySelector("[data-ocr-text]")?.textContent).toContain("Mitarbeitende B5");
    expect(ziel.querySelector<HTMLButtonElement>("[data-bildtext-lesen]")?.disabled).toBe(true);
    expect(ziel.querySelector("[data-erfassen-formular]")?.textContent).toContain(
      "OCR allein gilt nicht als geprüft",
    );
    expect(erkenne).not.toHaveBeenCalled();
  });
  it("andere Dateifassung, Folie, Bildposition oder Bildkennung liefern keinen fremden Text", async () => {
    await zeige(quelle(), "alte-datei");
    expect(probe().ocr).toBeNull();
    await zeige(quelle({ ...roh, fundstelle: { ...roh.fundstelle, folie: 2 } }));
    expect(probe().ocr).toBeNull();
    await zeige(quelle({ ...roh, fundstelle: { ...roh.fundstelle, bildAufFolie: 2 } }));
    expect(probe().ocr).toBeNull();
    await zeige(quelle({ ...roh, inhaltskennung: `sha256:${"d".repeat(64)}` }));
    expect(probe().ocr).toBeNull();
  });
  it("laufende Automatik sperrt paralleles Lesen; fehlgeschlagene Erkennung ist kein Text", async () => {
    await zeige({ ...quelle(), status: "laeuft", befunde: [] });
    expect(probe().wartet).toBe(true);
    await zeige(quelle({ ...roh, status: "fehlgeschlagen" }));
    expect(probe().ocr).toBeNull();
    expect(erkenne).not.toHaveBeenCalled();
  });
  it("bestätigte E02-Berichtigung ersetzt den Rohtext; Rücknahme wirkt sofort", async () => {
    await konto("anna");
    const lesen = vi.spyOn(bildKorrekturApi, "lesen").mockResolvedValue({
      darfBearbeiten: true,
      korrekturen: [
        {
          quelle: "office:anh",
          inhaltskennung: KENNUNG,
          ort: "f1-b1",
          text: "Mitarbeitende 85",
          schritte: 0,
          geaendertAm: "2026-10-20T15:00:00Z",
        },
      ],
    });
    await act(async () => {
      await ladeBildKorrekturen("anna");
    });
    await zeige();
    expect(probe().ocr?.text).toBe("Mitarbeitende 85");
    expect(probe().ocr?.wiederverwendung.korrekturAm).toBe("2026-10-20T15:00:00Z");
    lesen.mockResolvedValue({ darfBearbeiten: true, korrekturen: [] });
    await act(async () => {
      await ladeBildKorrekturen("anna");
    });
    expect(probe().ocr?.text).toBe("Mitarbeitende B5");
    expect(probe().ocr?.wiederverwendung.korrekturAm).toBeNull();
    expect(erkenne).not.toHaveBeenCalled();
  });
  it("Korrekturladefehler gibt keinen Rohtext frei; Kontowechsel verwirft den alten Befund", async () => {
    await konto("anna");
    vi.spyOn(bildKorrekturApi, "lesen").mockRejectedValue(new Error("kein Zugriff"));
    await zeige();
    expect(probe().ocr).toBeNull();
    expect(probe().wartet).toBe(true);
    await konto("berta");
    expect(probe().ocr).toBeNull();
    expect(erkenne).not.toHaveBeenCalled();
  });
});
