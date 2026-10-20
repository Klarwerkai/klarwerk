import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { leseFolienDaten } from "../../services/app/src/praesentation-daten";
import { decodeDataUrl } from "../../services/object-store";
import { dateiwelt } from "./pp07-dateiwelt";

describe("PP07 · gespeicherte kurze/ausführliche Dateien über tatsächlichen Produkt- und Downloadport", () => {
  it("speichert zwei wiedergeöffnete native Dateien mit einer Quellenbasis und unterschiedlichen Vortragstiefen", async () => {
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
      const dateien = r.json().dateien as {
        objectId: string;
        tiefe: string;
        basis: string;
        wiederoeffnet: boolean;
      }[];
      expect(dateien).toHaveLength(2);
      expect(dateien.every((f) => f.wiederoeffnet && f.basis === d.satz.fassung)).toBe(true);
      const manifests = [];
      const sichtbar: number[] = [];
      for (const f of dateien) {
        const o = await w.services.objects.read(f.objectId);
        expect(o!.ref.lifecycle).toMatchObject({ owner: w.bertId, privatQuelle: w.ziel.id });
        const bytes = decodeDataUrl(o!.data)!.bytes;
        const zip = await JSZip.loadAsync(bytes);
        manifests.push(JSON.parse(await zip.file("ppt/klara/pp07-variante.json")!.async("string")));
        sichtbar.push((await leseFolienDaten(bytes)).folien.filter((f) => !f.ausgeblendet).length);
        for (const suffix of ["/raw", "", "/traeger"]) {
          const get = await w.app.inject({
            method: "GET",
            url: `/api/objects/${f.objectId}${suffix}`,
            headers: w.bert,
          });
          expect(get.statusCode, get.body).toBe(200);
          expect(get.headers["cache-control"]).toBe("no-store");
        }
        expect(
          (
            await w.app.inject({
              method: "GET",
              url: `/api/objects/${f.objectId}/raw`,
              headers: w.admin,
            })
          ).statusCode,
        ).toBe(404);
      }
      expect(manifests[0].datenbasis).toEqual(manifests[1].datenbasis);
      expect(sichtbar[0]).toBeLessThan(sichtbar[1]!);
      expect((await w.datei()).satz.fassung).toBe(d.satz.fassung);
    } finally {
      await w.app.close();
    }
  });

  it("erneuter Abruf prüft heutige transitive Quellenrechte vor Daten-URL, Raw und Trägern, auch mit altem ETag", async () => {
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
      const dateien = r.json().dateien as { objectId: string }[];
      const plain = await w.services.objects.put({
        name: "Unabhängig.txt",
        mime: "text/plain",
        data: "data:text/plain;base64,VGVzdA==",
        purpose: "attachment",
        owner: w.bertId,
        privatQuelle: w.ziel.id,
        confidentiality: "vertraulich",
      });
      const ok = await w.app.inject({
        method: "GET",
        url: `/api/objects/${dateien[0]!.objectId}/raw`,
        headers: w.bert,
      });
      expect(ok.statusCode, ok.body).toBe(200);
      await w.services.ko.setConfidentiality(w.quelle.id, "vertraulich", w.adminId);
      expect(
        (await w.app.inject({ method: "GET", url: `/api/kos/${w.ziel.id}`, headers: w.bert }))
          .statusCode,
      ).toBe(200);
      for (const f of dateien)
        for (const suffix of ["/raw", "", "/traeger"]) {
          const get = await w.app.inject({
            method: "GET",
            url: `/api/objects/${f.objectId}${suffix}`,
            headers: { ...w.bert, "if-none-match": String(ok.headers.etag ?? "alt") },
          });
          const absent = await w.app.inject({
            method: "GET",
            url: `/api/objects/nicht-vorhanden${suffix}`,
            headers: w.bert,
          });
          expect(get.statusCode, get.body).toBe(404);
          expect(get.body).toBe(absent.body);
          expect(get.headers["cache-control"]).toBe("no-store");
          expect(get.body).not.toContain(w.quelle.id);
        }
      expect(
        (
          await w.app.inject({
            method: "GET",
            url: `/api/objects/${plain.id}/raw`,
            headers: w.bert,
          })
        ).statusCode,
      ).toBe(200);
      const folien = await w.app.inject({
        method: "GET",
        url: `${w.basis}/folien-daten`,
        headers: w.bert,
      });
      expect(folien.statusCode, folien.body).toBe(404);
      expect(folien.body).not.toContain(w.quelle.id);
      await w.services.ko.setConfidentiality(w.quelle.id, "intern", w.adminId, {
        mayDowngrade: true,
      });
      expect(
        (
          await w.app.inject({
            method: "GET",
            url: `/api/objects/${dateien[0]!.objectId}/raw`,
            headers: w.bert,
          })
        ).statusCode,
      ).toBe(200);
    } finally {
      await w.app.close();
    }
  });
});
