import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { decodeDataUrl } from "../../services/object-store";
import { PPTX } from "./pp05-welt";
import { dateiwelt } from "./pp07-dateiwelt";

describe("PP07 · zusätzliche Manifestzweige am vorhandenen Downloadtor", () => {
  it("ein erfundener Basisabdruck oder widersprüchliche Datenfassungen im Variantenmanifest erteilen kein Leserecht", async () => {
    const w = await dateiwelt();
    try {
      const d = await w.datei();
      const r = await w.app.inject({
        method: "POST",
        url: `${w.basis}/datenaktualisierung/fassungen`,
        headers: w.bert,
        payload: { expectedVersion: d.ko.version, dateiFassung: d.satz.fassung },
      });
      expect(r.statusCode, r.body).toBe(200);
      const o = await w.services.objects.read(r.json().dateien[0].objectId);
      const bytes = decodeDataUrl(o!.data)!.bytes;
      for (const manipulation of ["basis", "datenbasis"]) {
        const z = await JSZip.loadAsync(bytes);
        const pfad = "ppt/klara/pp07-variante.json";
        const m = JSON.parse(await z.file(pfad)!.async("string"));
        if (manipulation === "basis") m.basis = "0".repeat(64);
        else m.datenbasis[0].fassung++;
        z.file(pfad, JSON.stringify(m));
        const f = await w.services.objects.put({
          name: `Manipuliert-${manipulation}.pptx`,
          mime: PPTX,
          data: `data:${PPTX};base64,${(await z.generateAsync({ type: "nodebuffer" })).toString("base64")}`,
          purpose: "attachment",
          owner: w.bertId,
          privatQuelle: w.ziel.id,
          confidentiality: "vertraulich",
        });
        for (const suffix of ["/raw", "", "/traeger"]) {
          const get = await w.app.inject({
            method: "GET",
            url: `/api/objects/${f.id}${suffix}`,
            headers: w.bert,
          });
          expect(get.statusCode, get.body).toBe(404);
          expect(get.headers["cache-control"]).toBe("no-store");
        }
      }
    } finally {
      await w.app.close();
    }
  });
  it("prüft nach tatsächlicher Übernahme auch die gespeicherte Datei und ihre öffentliche Datenfläche gegen heutige Quellrechte", async () => {
    const w = await dateiwelt();
    try {
      const d = await w.datei();
      const body = {
        expectedVersion: d.ko.version,
        dateiFassung: d.satz.fassung,
        aenderungen: [
          {
            datenpunktId: w.b.id,
            fassung: 1,
            korrektur: {
              wert: "700 T€",
              grund: "Fiktive Änderung mit bestehender fremder Quellabhängigkeit.",
            },
          },
        ],
      };
      const p = await w.app.inject({
        method: "POST",
        url: `${w.basis}/datenaktualisierung/vorschau`,
        headers: w.bert,
        payload: body,
      });
      expect(p.statusCode, p.body).toBe(200);
      const r = await w.app.inject({
        method: "POST",
        url: `${w.basis}/datenaktualisierung/uebernehmen`,
        headers: w.bert,
        payload: { ...body, vorschauId: p.json().vorschauId, bestaetigteKonflikte: [] },
      });
      expect(r.statusCode, r.body).toBe(200);
      const neu = await w.datei();
      const id = neu.ko.attachments[0]!.objectId!;
      expect(
        (await w.app.inject({ method: "GET", url: `/api/objects/${id}/raw`, headers: w.bert }))
          .statusCode,
      ).toBe(200);
      await w.services.ko.setConfidentiality(w.quelle.id, "vertraulich", w.adminId);
      for (const suffix of ["/raw", "", "/traeger"]) {
        const get = await w.app.inject({
          method: "GET",
          url: `/api/objects/${id}${suffix}`,
          headers: w.bert,
        });
        expect(get.statusCode, get.body).toBe(404);
      }
      const folien = await w.app.inject({
        method: "GET",
        url: `${w.basis}/folien-daten`,
        headers: w.bert,
      });
      expect(folien.statusCode, folien.body).toBe(404);
      expect(folien.body).not.toContain(w.quelle.id);
    } finally {
      await w.app.close();
    }
  });
});
