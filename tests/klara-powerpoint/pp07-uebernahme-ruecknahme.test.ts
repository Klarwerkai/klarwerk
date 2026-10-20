import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  erforderlich,
  leseFolienDaten,
  pruefe,
  pruefstand,
} from "../../services/app/src/praesentation-daten";
import { datenUmgebung } from "../../services/app/src/routes/praesentation-daten-routes";
import { decodeDataUrl } from "../../services/object-store";
import { welt } from "./pp05-welt";

async function aufgebaut() {
  const w = await welt();
  const p = await w.app.inject({
    method: "POST",
    url: `${w.basis}/folienaufbau/vorschau`,
    payload: w.auftrag,
  });
  expect(p.statusCode, p.body).toBe(200);
  const r = await w.app.inject({
    method: "POST",
    url: `${w.basis}/folienaufbau/uebernehmen`,
    payload: { ...w.auftrag, planId: p.json().planId },
  });
  expect(r.statusCode, r.body).toBe(200);
  const datei = async () => {
    const ko = await w.ko.get(w.article.id);
    const obj = await w.objekte.read(ko!.attachments[0]!.objectId!);
    const bytes = decodeDataUrl(obj!.data)!.bytes;
    return { ko: ko!, bytes, satz: await leseFolienDaten(bytes) };
  };
  const vorschau = async (wert = "700 T€") => {
    const d = await datei();
    const body = {
      expectedVersion: d.ko.version,
      dateiFassung: d.satz.fassung,
      aenderungen: [
        {
          datenpunktId: w.b.id,
          fassung: (await w.datenpunkte.lesen(w.b.id))!.fassung,
          korrektur: { wert, grund: "Neue kontrollierte Quellangabe (fiktiv)." },
        },
      ],
    };
    const r = await w.app.inject({
      method: "POST",
      url: `${w.basis}/datenaktualisierung/vorschau`,
      payload: body,
    });
    return { r, body };
  };
  return { w, datei, vorschau };
}

describe("PP07 · tatsächliche bewusste Übernahme und Rücknahme am vorhandenen Office-Dateiversionsweg", () => {
  it("aktualisiert bestehende Texte/Tabellen, Diagramm samt Arbeitsmappe und Belege, erhält unabhängigen Inhalt", async () => {
    const { w, datei, vorschau } = await aufgebaut();
    try {
      const vorher = await datei();
      const p = await vorschau();
      expect(p.r.statusCode, p.r.body).toBe(200);
      expect(p.r.json().konflikte).toEqual([]);
      expect(p.r.json().dateikonflikte).toEqual([]);
      const r = await w.app.inject({
        method: "POST",
        url: `${w.basis}/datenaktualisierung/uebernehmen`,
        payload: { ...p.body, vorschauId: p.r.json().vorschauId, bestaetigteKonflikte: [] },
      });
      expect(r.statusCode, r.body).toBe(200);
      expect(r.json().zustand).toBe("uebernommen");
      expect(r.json().status).toBe("offen");
      expect((await w.datenpunkte.lesen(w.b.id))?.wert).toBe("700 T€");
      expect((await w.datenpunkte.lesen(w.sum.id))?.wert).toBe("1.100 T€");
      const neu = await datei();
      expect(neu.ko.version).toBe(vorher.ko.version + 1);
      const text = neu.satz.folien.flatMap((f) => f.elemente.map((e) => e.text)).join("\n");
      expect(text).toContain("700 T€");
      expect(text).toContain("1.100 T€");
      expect(text).toContain("Neue kontrollierte Quellangabe");
      const zip = await JSZip.loadAsync(neu.bytes);
      const old = await JSZip.loadAsync(vorher.bytes);
      expect(await zip.file("ppt/slides/slide1.xml")!.async("string")).toBe(
        await old.file("ppt/slides/slide1.xml")!.async("string"),
      );
      const chart = Object.keys(zip.files).find((s) => /^ppt\/charts\/[^/]+\.xml$/.test(s))!;
      expect(await zip.file(chart)!.async("string")).toContain("<c:v>700</c:v>");
      expect(await zip.file(chart)!.async("string")).toContain('<c:max val="1100"/>');
      const wb = await JSZip.loadAsync(
        await zip
          .file(Object.keys(zip.files).find((s) => s.endsWith(".xlsx"))!)!
          .async("nodebuffer"),
      );
      expect(await wb.file("xl/worksheets/sheet1.xml")!.async("string")).toContain(
        '<c r="B3"><v>700</v></c>',
      );
      const stand = await w.app.inject({
        method: "GET",
        url: `${w.basis}/datenaktualisierung/stand`,
      });
      expect(stand.statusCode, stand.body).toBe(200);
      expect(stand.json().uebernahme.ruecknahmeMoeglich).toBe(true);
      const doppelt = await w.app.inject({
        method: "POST",
        url: `${w.basis}/datenaktualisierung/uebernehmen`,
        payload: { ...p.body, vorschauId: p.r.json().vorschauId },
      });
      expect(doppelt.statusCode, doppelt.body).toBe(200);
      expect(doppelt.json().wiederholt).toBe(true);
      expect((await datei()).ko.version).toBe(neu.ko.version);
    } finally {
      await w.app.close();
    }
  });

  it("Rücknahme restauriert ursprüngliche Werte in neuen Fassungen, ohne alte fachliche Freigabe zu reaktivieren", async () => {
    const { w, datei, vorschau } = await aufgebaut();
    try {
      // Kontrollierter fiktiver vorheriger Freigabebeleg. Hier wird die Statusbindung, keine Rollenabnahme geprüft.
      let dp = (await w.datenpunkte.lesen(w.b.id))!;
      const h = {
        nutzerId: "controller-fiktiv",
        jetzt: new Date().toISOString(),
        kennung: () => `test-${Math.random()}`,
      };
      for (const dimension of erforderlich(dp))
        dp = pruefe(
          dp,
          {
            dimension,
            ergebnis: "bestanden",
            grund: "Kontrollierte Freigabe der Ausgangsfassung (fiktiv).",
          },
          h,
        );
      await w.datenpunkte.ersetzen({ ...dp, stand: dp.stand + 1 }, dp.stand);
      const p = await vorschau();
      expect(p.r.statusCode, p.r.body).toBe(200);
      expect(p.r.json().dateikonflikte).toEqual([]);
      const r = await w.app.inject({
        method: "POST",
        url: `${w.basis}/datenaktualisierung/uebernehmen`,
        payload: { ...p.body, vorschauId: p.r.json().vorschauId, bestaetigteKonflikte: [] },
      });
      expect(r.statusCode, r.body).toBe(200);
      const rueck = await w.app.inject({
        method: "POST",
        url: `${w.basis}/datenaktualisierung/ruecknahme`,
        payload: { expectedVersion: r.json().fassung, vorschauId: p.r.json().vorschauId },
      });
      expect(rueck.statusCode, rueck.body).toBe(200);
      const alt = (await w.datenpunkte.lesen(w.b.id))!;
      expect(alt).toMatchObject({ wert: "600 T€", fassung: 3 });
      expect((await w.datenpunkte.lesen(w.sum.id))?.wert).toBe("1.000 T€");
      const u = datenUmgebung(
        { ko: w.ko, objekte: w.objekte, ablage: w.datenpunkte, konten: async () => [] },
        { id: "anna", role: "experte", spaceLesbar: new Set() },
      );
      const status = await pruefstand(alt, u);
      expect(status.zustand).not.toBe("validiert");
      expect(status.dimensionen.find((d) => d.dimension === "fachliche_freigabe")?.stand).toBe(
        "klaerung",
      );
      const text = (await datei()).satz.folien
        .flatMap((f) => f.elemente.map((e) => e.text))
        .join("\n");
      expect(text).toContain("600 T€");
      expect(text).toContain("Nach Rücknahme erneut prüfen");
      expect(text).toContain("Unabhängiger Text bleibt erhalten");
    } finally {
      await w.app.close();
    }
  });

  it("veraltete Vorschau und Leserkonto verändern weder Datei noch Daten", async () => {
    const { w, datei, vorschau } = await aufgebaut();
    try {
      const p = await vorschau();
      expect(p.r.statusCode, p.r.body).toBe(200);
      const vorher = await datei();
      const k = await w.app.inject({
        method: "POST",
        url: `/api/datenpunkte/${w.b.id}/korrektur`,
        payload: { fassung: 1, wert: "650 T€", grund: "Zwischenzeitliche fiktive Korrektur" },
      });
      expect(k.statusCode, k.body).toBe(200);
      const r = await w.app.inject({
        method: "POST",
        url: `${w.basis}/datenaktualisierung/uebernehmen`,
        payload: { ...p.body, vorschauId: p.r.json().vorschauId },
      });
      expect(r.statusCode, r.body).toBe(409);
      const viewer = await w.app.inject({
        method: "POST",
        url: `${w.basis}/datenaktualisierung/vorschau`,
        headers: { "x-test-viewer": "1" },
        payload: p.body,
      });
      expect(viewer.statusCode).toBe(403);
      expect((await datei()).satz.fassung).toBe(vorher.satz.fassung);
      expect((await w.datenpunkte.lesen(w.b.id))?.wert).toBe("650 T€");
    } finally {
      await w.app.close();
    }
  });
});
