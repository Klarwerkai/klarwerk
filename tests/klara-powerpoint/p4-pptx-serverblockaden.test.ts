import { performance } from "node:perf_hooks";
import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FOLIEN_ABGLEICH_GRENZEN,
  pruefeAbgleichKoerper,
} from "../../services/app/src/folien-abgleich-grenzen";
import { foliensatzLesen } from "../../services/app/src/meeting-dokumentbezug";
import {
  ersetzeImLauf,
  lesePraesentation,
  notizAbsaetze,
} from "../../services/app/src/office-nachbearbeitung";
import { leseFolienDaten } from "../../services/app/src/praesentation-daten";
import { xmlAbschnitte } from "../../services/app/src/praesentation-xml";
import {
  PRIVATE_NOTIZ,
  synthetischePraesentation,
} from "../assistenz-dokumentnachbearbeitung/praesentation";

afterEach(() => vi.restoreAllMocks());

const leser = [
  ["Meeting", (b: Buffer) => foliensatzLesen("obj-p4", b)],
  ["Nachbearbeitung", lesePraesentation],
  ["Daten", leseFolienDaten],
] as const;

async function deck(text: string, verweise = 1, compression: "STORE" | "DEFLATE" = "DEFLATE") {
  const zip = new JSZip();
  zip.file(
    "ppt/presentation.xml",
    `<p:presentation><p:sldIdLst>${Array.from(
      { length: verweise },
      (_, i) => `<p:sldId id="${256 + i}" r:id="rId2"/>`,
    ).join("")}</p:sldIdLst></p:presentation>`,
  );
  zip.file(
    "ppt/_rels/presentation.xml.rels",
    '<Relationships><Relationship Id="rId2" Type="x/slide" Target="slides/slide1.xml"/></Relationships>',
  );
  zip.file(
    "ppt/slides/slide1.xml",
    `<p:sld><p:sp><p:nvSpPr><p:cNvPr id="2" name="Text"/></p:nvSpPr><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp></p:sld>`,
  );
  return zip.generateAsync({ type: "nodebuffer", compression });
}

function beobachteStringLesen() {
  const lade = JSZip.loadAsync;
  const aufrufe: (() => string[])[] = [];
  vi.spyOn(JSZip, "loadAsync").mockImplementation(async (bytes, options) => {
    const zip = await lade(bytes, options);
    for (const [name, entry] of Object.entries(zip.files)) {
      const spy = vi.spyOn(entry, "async");
      aufrufe.push(() => spy.mock.calls.filter((args) => args[0] === "string").map(() => name));
    }
    return zip;
  });
  return () => aufrufe.flatMap((lesen) => lesen());
}

describe("P4 · lineare OOXML-Abschnitte", () => {
  it.each(["p:sp", "a:p", "a:t"])("64000 offene %s enden ohne erneute Resttextsuche", (name) => {
    const xml = `<${name}>`.repeat(64_000);
    const t0 = performance.now();
    expect(xmlAbschnitte(xml, name)).toEqual([]);
    expect(performance.now() - t0).toBeLessThan(300);
  });

  it("offene Notizformen und Textläufe bleiben unverändert und blockieren nicht", () => {
    const xml = "<p:sp>".repeat(64_000);
    const laeufe = "<a:t>".repeat(64_000);
    const t0 = performance.now();
    expect(notizAbsaetze(xml)).toEqual([]);
    expect(ersetzeImLauf(laeufe, "alt", "neu")).toBe(laeufe);
    expect(performance.now() - t0).toBeLessThan(300);
  });

  it("Attribute, Kommentar und CDATA begrenzen Elemente; Textlaufänderung erhält alle übrigen Bytes", () => {
    const xml =
      '<!-- <a:t>falsch</a:t> --><a:p><a:t xml:space="preserve">alt &amp; gut</a:t><a:t>zweiter</a:t></a:p>';
    expect(ersetzeImLauf(xml, "alt", "neu")).toBe(xml.replace("alt &amp; gut", "neu &amp; gut"));
    const cdata = "<a:t><![CDATA[<a:t>kein Tag</a:t>]]></a:t>";
    expect(xmlAbschnitte(cdata, "a:t")).toHaveLength(1);
  });
});

describe.each(leser)("P4 · %s begrenzt vor dem Stringlesen", (_name, lesen) => {
  it("die echte Verhältnisgrenze bricht den Strom ab, ohne den Folienteil als String zu laden", async () => {
    const bytes = await deck("A".repeat(2 * 1024 * 1024));
    const gelesen = beobachteStringLesen();
    await expect(lesen(bytes)).rejects.toThrow(/entpackt zu groß/);
    expect(gelesen()).toEqual([]);
  });

  it("2000 Referenzen auf denselben Teil: einmal entpackt, einmal geliefert", async () => {
    const bytes = await deck("Normaler Text", 2000, "STORE");
    const gelesen = beobachteStringLesen();
    const satz = await lesen(bytes);
    expect(satz.folien).toHaveLength(1);
    expect(gelesen().filter((p) => p === "ppt/slides/slide1.xml")).toHaveLength(1);
  });
});

it("P4 · kleiner Standardfoliensatz erhält Reihenfolge, Titel, Absätze, Notizen und Ausblendung", async () => {
  const bytes = await synthetischePraesentation();
  const office = await lesePraesentation(bytes);
  const meeting = await foliensatzLesen("standard", bytes);
  const daten = await leseFolienDaten(bytes);
  expect(office.folien.map((f) => f.folieId)).toEqual([256, 257, 258]);
  expect(daten.folien.map((f) => f.sldId)).toEqual(["256", "257", "258"]);
  expect(meeting.folien.map((f) => f.sldId)).toEqual(["256", "257", "258"]);
  expect(office.folien[0]?.titel).toBe("Pumpenwartung P1 (fiktiv)");
  expect(office.folien[0]?.absaetze).toContain("Wartungsintervall: monatlich");
  expect(meeting.folien[0]?.notizen).toContain(PRIVATE_NOTIZ);
  expect(office.folien[2]?.ausgeblendet).toBe(true);
  expect(daten.folien[2]?.ausgeblendet).toBe(true);
  expect(meeting.folien[2]?.versteckt).toBe(true);
  const notiz = await office.zip.file(office.folien[0]?.notizPfad ?? "")?.async("string");
  expect(notizAbsaetze(notiz ?? "")).toContain(PRIVATE_NOTIZ);
});

it("P4 · frühe Verhältnisabsage nennt die vorhandene Grenze statt eine falsche Gesamtgröße", async () => {
  const bytes = await deck("A".repeat(2 * 1024 * 1024));
  const befund = await pruefeAbgleichKoerper(bytes, FOLIEN_ABGLEICH_GRENZEN);
  expect(befund).toMatchObject({ status: 413, error: "PAYLOAD_TOO_LARGE" });
  expect(befund?.message).toContain("100-fache");
});
