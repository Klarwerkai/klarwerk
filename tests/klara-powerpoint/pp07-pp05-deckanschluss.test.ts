import { describe, expect, it } from "vitest";
import type { GebundenerDeckVertrag } from "../../services/app/src/office-datenfolien";
import { planeAenderungen } from "../../services/app/src/praesentation-aenderungen";
import { leseFolienDaten } from "../../services/app/src/praesentation-daten";
import { verknuepfeDeckFassungen } from "../../services/app/src/praesentation-fassungen";
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
  expect(r.json().bindungenOffen).toEqual([]);
  const vertrag = r.json<GebundenerDeckVertrag>();
  const ko = await w.ko.get(w.article.id);
  const object = await w.objekte.read(ko!.attachments[0]!.objectId!);
  const satz = await leseFolienDaten(decodeDataUrl(object!.data)!.bytes);
  const u = datenUmgebung(
    { ko: w.ko, objekte: w.objekte, ablage: w.datenpunkte, konten: async () => [] },
    { id: "anna", role: "experte", spaceLesbar: new Set() },
  );
  return { w, vertrag, satz, u };
}

describe("PP-07 · Zusammensetzung mit echtem festen PP-05-Port fbc1ef39", () => {
  it("gespeicherte Bytes, ein gemeinsamer Quellenstand, Kurz-/Detailfolien und Diagrammwirkung", async () => {
    const { w, vertrag, satz, u } = await aufgebaut();
    try {
      const plan = await planeAenderungen(
        await w.datenpunkte.vonArtikel(w.article.id),
        [
          {
            datenpunktId: w.b.id,
            fassung: 1,
            korrektur: { wert: "700 T€", grund: "Neuer fiktiver Vergleichswert" },
          },
        ],
        u,
        { nutzerId: "anna", jetzt: new Date().toISOString(), kennung: () => "vorschau" },
      );
      const f = await verknuepfeDeckFassungen(vertrag, satz, u, w.datenpunkte, plan);
      expect(f.gemeinsam.dateiFassung).toBe(vertrag.dateiFassung);
      expect(f.gemeinsam.datenbasis).toHaveLength(3);
      expect(f.konflikte).toEqual([]);
      expect(f.kurz.folien.length).toBeLessThan(f.ausfuehrlich.folien.length);
      expect(f.kurz.folien.every((id) => f.ausfuehrlich.folien.includes(id))).toBe(true);
      expect(
        f.belegfolien.every((b) => b.sldIds.every((id) => f.ausfuehrlich.folien.includes(id))),
      ).toBe(true);
      expect(f.wirkungen.map((x) => x.art)).toEqual(
        expect.arrayContaining(["diagramm", "beleg", "folieninhalt"]),
      );
      expect(
        f.wirkungen.flatMap((x) => x.datenpunkte).every((p) => p.vorher === 1 && p.nachher === 2),
      ).toBe(true);
      expect((await w.datenpunkte.lesen(w.b.id))?.wert).toBe("600 T€");
      expect(f.uebernahme).toBe(false);
    } finally {
      await w.app.close();
    }
  });

  it("gemischte Quellfassungen im Deck und falsche Dateibindung werden nicht konsistent genannt", async () => {
    const { w, vertrag, satz, u } = await aufgebaut();
    try {
      await expect(
        verknuepfeDeckFassungen({ ...vertrag, dateiFassung: "andere" }, satz, u, w.datenpunkte),
      ).rejects.toThrow("Dateifassung");
      const gemischt = structuredClone(vertrag);
      const detail = gemischt.deck.folien.find((f) => f.rolle === "detail");
      detail!.datenpunkte[0]!.fassung = 2;
      await expect(verknuepfeDeckFassungen(gemischt, satz, u, w.datenpunkte)).rejects.toThrow(
        "verschiedene Datenfassungen",
      );
    } finally {
      await w.app.close();
    }
  });

  it("manuell abweichende Folie und nachträglicher Rechteentzug bleiben sichtbar getrennt", async () => {
    const { w, vertrag, satz, u } = await aufgebaut();
    try {
      const b = vertrag.deck.bindungen[0]!;
      const geaendert = {
        ...satz,
        folien: satz.folien.map((f) =>
          f.sldId !== b.sldId
            ? f
            : {
                ...f,
                elemente: f.elemente.map((e) =>
                  e.shapeId !== b.shapeId
                    ? e
                    : {
                        ...e,
                        ...(e.zellen
                          ? { zellen: e.zellen.map((z) => ({ ...z, text: "manuell abweichend" })) }
                          : {}),
                      },
                ),
              },
        ),
      };
      const f = await verknuepfeDeckFassungen(vertrag, geaendert, u, w.datenpunkte);
      expect(f.konflikte.length).toBeGreaterThan(0);
      const gesperrt = { ...u, artikel: async () => undefined };
      await expect(
        verknuepfeDeckFassungen(vertrag, satz, gesperrt, w.datenpunkte),
      ).rejects.toMatchObject({ art: "kein_zugriff" });
    } finally {
      await w.app.close();
    }
  });
});
