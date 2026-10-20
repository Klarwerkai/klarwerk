import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import type { DeckVertrag } from "../../services/app/src/office-datenfolien";
import type { AufbauPlan } from "../../services/app/src/praesentation-aufbau";
import { leseFolienDaten } from "../../services/app/src/praesentation-daten";
import { decodeDataUrl } from "../../services/object-store";
import { welt } from "./pp05-welt";

describe("PP-05 kontrollierter Datei-/API-Weg (keine Hostabnahme)", () => {
  it("Vorschau schreibt nichts; editierbare Ausgabe, Quellen, Rechenwege, getrennte Prüfungen, PP02-Bindungen und Rücknahme", async () => {
    const w = await welt();
    try {
      const p = await w.app.inject({
        method: "POST",
        url: `${w.basis}/folienaufbau/vorschau`,
        payload: w.auftrag,
      });
      expect(p.statusCode, p.body).toBe(200);
      const plan = p.json<AufbauPlan>();
      expect((await w.ko.get(w.article.id))?.version).toBe(w.auftrag.expectedVersion);
      expect(plan.fakten.map((f) => f.wert)).toEqual(["400 T€", "600 T€", "1.000 T€"]);
      expect(plan.diagramm).toEqual({ minimum: 0, maximum: 1000, einheit: "T€" });
      expect(plan.fakten[2]!.belege.join("\n")).toContain("400 T€ + 600 T€");
      expect(plan.fakten[2]!.belege.join("\n")).toContain("Fachliche Freigabe");
      expect(plan.fakten[0]!.belege.join("\n")).toContain("400 T€ im Norden");
      expect(plan.fakten.every((f) => !f.zustand.startsWith("Validiert"))).toBe(true);
      const r = await w.app.inject({
        method: "POST",
        url: `${w.basis}/folienaufbau/uebernehmen`,
        payload: { ...w.auftrag, planId: plan.planId },
      });
      expect(r.statusCode, r.body).toBe(200);
      const ergebnis = r.json<{
        fassung: number;
        status: string;
        bindungenOffen: string[];
        deck: DeckVertrag;
        dateiFassung: string;
      }>();
      expect(ergebnis.bindungenOffen).toEqual([]);
      expect(ergebnis.status).toBe("offen");
      const ko = await w.ko.get(w.article.id);
      const objekt = await w.objekte.read(ko!.attachments[0]!.objectId!);
      const bytes = decodeDataUrl(objekt!.data)!.bytes;
      const zip = await JSZip.loadAsync(bytes);
      const original = await JSZip.loadAsync(w.original);
      for (const name of Object.keys(original.files).filter(
        (n) =>
          !original.files[n]?.dir &&
          ![
            "ppt/presentation.xml",
            "ppt/_rels/presentation.xml.rels",
            "[Content_Types].xml",
          ].includes(n),
      )) {
        expect(await zip.file(name)!.async("nodebuffer"), name).toEqual(
          await original.file(name)!.async("nodebuffer"),
        );
      }
      const folien = await leseFolienDaten(bytes);
      expect(folien.fassung).toBe(ergebnis.dateiFassung);
      expect(ergebnis.deck.folien.some((f) => f.rolle === "detail")).toBe(true);
      expect(
        ergebnis.deck.folien.some(
          (f) => f.rolle === "einzelfolie" && f.datenpunkte[0]?.id === w.a.id,
        ),
      ).toBe(true);
      const chart = await zip.file(ergebnis.deck.diagramme[0]!.teil)!.async("string");
      expect(chart).toContain('<c:min val="0"/>');
      expect(chart).toContain('<c:max val="1000"/>');
      const workbook = Object.keys(zip.files).find((n) => n.endsWith(".xlsx"))!;
      const wb = await JSZip.loadAsync(await zip.file(workbook)!.async("nodebuffer"));
      const sheet = await wb.file("xl/worksheets/sheet1.xml")!.async("string");
      expect(sheet).toContain("<v>400</v>");
      expect(sheet).toContain("<v>1000</v>");
      const detail = folien.folien.map((f) => f.elemente.map((e) => e.text).join("\n")).join("\n");
      expect(detail).toContain("Rundung 0 Stellen");
      expect(detail.replace(/\s+/g, " ")).toContain("keine Klarwerkrechte");
      const sicht = await w.app.inject({ method: "GET", url: `/api/datenpunkte/${w.sum.id}` });
      expect(
        sicht
          .json()
          .bindungen.filter(
            (b: { objectId: string }) => b.objectId === ko!.attachments[0]!.objectId,
          ),
      ).toHaveLength(2);
      // Native Texte lassen sich als OOXML-Text ändern und wieder lesen, ohne Bildersatz.
      const einzel = ergebnis.deck.bindungen.find((b) => b.datenpunktId === w.sum.id && !b.zeile)!;
      const path = Object.keys(zip.files).find((n) => n.endsWith(`klaraPP05_${einzel.sldId}.xml`))!;
      zip.file(path, (await zip.file(path)!.async("string")).replace("1.000 T€", "1.050 T€"));
      expect(
        (await leseFolienDaten(await zip.generateAsync({ type: "nodebuffer" }))).folien
          .find((f) => f.sldId === einzel.sldId)
          ?.elemente.find((e) => e.shapeId === einzel.shapeId)?.text,
      ).toBe("1.050 T€");
      const back = await w.app.inject({
        method: "POST",
        url: `${w.basis}/zurueckholen`,
        payload: { expectedVersion: ergebnis.fassung, ausFassung: w.auftrag.expectedVersion },
      });
      expect(back.statusCode, back.body).toBe(200);
      const restored = await w.ko.get(w.article.id);
      expect(restored!.attachments[0]!.objectId).toBe(w.article.attachments[0]!.objectId);
    } finally {
      await w.app.close();
    }
  });
  it("Datenkorrektur nach Vorschau verhindert Übernahme und überträgt keinen alten Prüfstand", async () => {
    const w = await welt();
    try {
      const plan = (
        await w.app.inject({
          method: "POST",
          url: `${w.basis}/folienaufbau/vorschau`,
          payload: w.auftrag,
        })
      ).json<AufbauPlan>();
      const korrektur = await w.app.inject({
        method: "POST",
        url: `/api/datenpunkte/${w.b.id}/korrektur`,
        payload: { fassung: 1, grund: "Fiktive Korrektur", wert: "650 T€" },
      });
      expect(korrektur.statusCode, korrektur.body).toBe(200);
      const r = await w.app.inject({
        method: "POST",
        url: `${w.basis}/folienaufbau/uebernehmen`,
        payload: { ...w.auftrag, planId: plan.planId },
      });
      expect(r.statusCode).toBe(409);
      expect((await w.ko.get(w.article.id))?.version).toBe(w.auftrag.expectedVersion);
    } finally {
      await w.app.close();
    }
  });
  it("Rechteentzug an der Quelle nach Vorschau: keine Weitergabe; Viewer darf keinen Aufbau starten", async () => {
    const w = await welt();
    try {
      const source = await w.ko.create({
        title: "Separate Quelle",
        statement: "Nord 400 T€",
        author: "bea",
        type: "best_practice",
        category: "Test",
        confidentiality: "intern",
      });
      const dp = await w.capture({
        art: "zahl",
        wert: "400 T€",
        einheit: "T€",
        zeitraum: "2025",
        bezugsgroesse: "Nord",
        erfassung: "direkt",
        quelleKoId: source.id,
        zitat: "Nord 400 T€",
      });
      const auftrag = { ...w.auftrag, datenpunkte: [{ id: dp.id, fassung: 1 }] };
      const p = await w.app.inject({
        method: "POST",
        url: `${w.basis}/folienaufbau/vorschau`,
        payload: auftrag,
      });
      expect(p.statusCode, p.body).toBe(200);
      await w.ko.setConfidentiality(source.id, "streng_vertraulich", "bea");
      const r = await w.app.inject({
        method: "POST",
        url: `${w.basis}/folienaufbau/uebernehmen`,
        payload: { ...auftrag, planId: p.json().planId },
      });
      expect(r.statusCode).toBe(404);
      expect(r.body).not.toContain(source.title);
      expect(
        (
          await w.app.inject({
            method: "POST",
            url: `${w.basis}/folienaufbau/vorschau`,
            headers: { "x-test-viewer": "1" },
            payload: auftrag,
          })
        ).statusCode,
      ).toBe(403);
    } finally {
      await w.app.close();
    }
  });
  it("Unvergleichbarer Zeitraum und fehlender Zeitraum bleiben offen, ohne erfundenes Diagramm", async () => {
    const w = await welt();
    try {
      const offen = await w.capture({
        art: "zahl",
        wert: "12 %",
        einheit: "%",
        bezugsgroesse: "Markt",
        erfassung: "manuell",
      });
      const r = await w.app.inject({
        method: "POST",
        url: `${w.basis}/folienaufbau/vorschau`,
        payload: {
          ...w.auftrag,
          datenpunkte: [
            { id: w.a.id, fassung: 1 },
            { id: offen.id, fassung: 1 },
          ],
        },
      });
      expect(r.statusCode, r.body).toBe(200);
      const p = r.json<AufbauPlan>();
      expect(p.diagramm).toBeNull();
      expect(p.hinweise.join(" ")).toContain("nicht vergleichbar");
      expect(p.fakten[1]!.zeitraum).toBe("offen");
      expect(p.fakten[1]!.zustand).toContain("Klärungsbedarf");
    } finally {
      await w.app.close();
    }
  });
});
