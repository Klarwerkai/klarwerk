import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";
import { leseDeckVertraege } from "../../services/app/src/office-daten-aenderungen";
import { lesePraesentation } from "../../services/app/src/office-nachbearbeitung";
import { PPTX } from "./pp05-welt";
import { dateiwelt } from "./pp07-dateiwelt";

type Welt = Awaited<ReturnType<typeof dateiwelt>>;
async function vorschau(w: Welt, korrektur: Record<string, unknown> = { wert: "700 T€" }) {
  const d = await w.datei();
  const body = {
    expectedVersion: d.ko.version,
    dateiFassung: d.satz.fassung,
    aenderungen: [
      {
        datenpunktId: w.b.id,
        fassung: (await w.services.datenpunkte.lesen(w.b.id))!.fassung,
        korrektur: { ...korrektur, grund: "Kontrollierte fiktive Änderung für PP07." },
      },
    ],
  };
  const r = await w.app.inject({
    method: "POST",
    url: `${w.basis}/datenaktualisierung/vorschau`,
    headers: w.admin,
    payload: body,
  });
  expect(r.statusCode, r.body).toBe(200);
  return { r, body };
}
async function uebernehmen(
  w: Welt,
  p: Awaited<ReturnType<typeof vorschau>>,
  bestaetigteKonflikte: string[] = [],
) {
  return w.app.inject({
    method: "POST",
    url: `${w.basis}/datenaktualisierung/uebernehmen`,
    headers: w.admin,
    payload: { ...p.body, vorschauId: p.r.json().vorschauId, bestaetigteKonflikte },
  });
}
async function manuellSpeichern(w: Welt, zip: JSZip) {
  const d = await w.datei();
  const bytes = await zip.generateAsync({ type: "nodebuffer" });
  const ref = await w.services.objects.put({
    name: "Manuelle-Fassung.pptx",
    mime: PPTX,
    data: `data:${PPTX};base64,${bytes.toString("base64")}`,
    purpose: "attachment",
    owner: w.adminId,
    confidentiality: "intern",
  });
  await w.services.ko.uebernimmOfficeFassung(
    w.ziel.id,
    { anhangId: w.anhangId, objectId: ref.id, size: ref.size, expectedVersion: d.ko.version },
    w.adminId,
  );
}

describe("PP07 · konkrete Konflikte und tatsächliche Teilwirkungen", () => {
  it("sperrt einen manuell veränderten Prüfbeleg auch bei bewusster Bestätigung sämtlicher Konflikte", async () => {
    const w = await dateiwelt();
    try {
      const z = await JSZip.loadAsync((await w.datei()).bytes);
      const deck = (await leseDeckVertraege(z))[0]!.deck;
      const b = deck.belegfolien.find((b) => b.datenpunktId === w.b.id)!;
      const { folien } = await lesePraesentation((await w.datei()).bytes);
      const f = folien.find((f) => String(f.folieId) === b.sldIds[0])!;
      const xml = await z.file(f.pfad)!.async("string");
      expect(xml).toContain("Herkunft: manuell;");
      z.file(f.pfad, xml.replace("Herkunft: manuell;", "Herkunft: manuell; freier Prüfzusatz;"));
      await manuellSpeichern(w, z);
      const vorher = await w.datei();
      const p = await vorschau(w);
      expect(
        p.r.json().dateikonflikte.some((k: { sperrtUebernahme?: boolean }) => k.sperrtUebernahme),
      ).toBe(true);
      expect(p.r.json().uebernahme.verfuegbar).toBe(false);
      const r = await uebernehmen(
        w,
        p,
        p.r.json().dateikonflikte.map((k: { id: string }) => k.id),
      );
      expect(r.statusCode, r.body).toBe(400);
      expect((await w.datei()).satz.fassung).toBe(vorher.satz.fassung);
    } finally {
      await w.app.close();
    }
  });
  it("bestätigt die zweite Exportdatei bei währenddessen entzogenen Quellrechten nicht als verwendbar", async () => {
    const w = await dateiwelt();
    try {
      const d = await w.datei();
      const put = w.services.objects.put.bind(w.services.objects);
      vi.spyOn(w.services.objects, "put").mockImplementation(async (a) => {
        if (a.name.includes("-ausfuehrlich"))
          await w.services.ko.setConfidentiality(w.quelle.id, "vertraulich", w.adminId);
        return put(a);
      });
      const r = await w.app.inject({
        method: "POST",
        url: `${w.basis}/datenaktualisierung/fassungen`,
        headers: w.bert,
        payload: { expectedVersion: d.ko.version, dateiFassung: d.satz.fassung },
      });
      expect(r.statusCode, r.body).toBe(500);
      expect(r.json().error).toBe("PP07_FASSUNGEN_TEILWIRKUNG");
      expect(r.json().dateien).toHaveLength(2);
      expect(r.json().dateien[1].wiederoeffnet).toBe(false);
    } finally {
      vi.restoreAllMocks();
      await w.app.close();
    }
  });
  it("erhält manuell geänderten gebundenen Text und tatsächliche Notizstelle; nur einzeln bestätigte Konflikte bleiben offen", async () => {
    const w = await dateiwelt();
    try {
      const { zip, folien } = await lesePraesentation((await w.datei()).bytes);
      const deck = (await leseDeckVertraege(zip))[0]!.deck;
      const b = deck.bindungen.find((b) => b.datenpunktId === w.b.id && b.zeile === undefined)!;
      const f = folien.find((f) => String(f.folieId) === b.sldId)!;
      const xml = await zip.file(f.pfad)!.async("string");
      zip.file(f.pfad, xml.replace("600 T€", "Manuell geprüfte Sonderaussage"));
      const relPfad = f.pfad.replace(/\/([^/]+)$/, "/_rels/$1.rels");
      const rels = await zip.file(relPfad)!.async("string");
      zip.file(
        relPfad,
        rels.replace(
          "</Relationships>",
          '<Relationship Id="pp07Note" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/pp07Note.xml"/></Relationships>',
        ),
      );
      const note =
        '<p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="Sprechernotiz"/><p:cNvSpPr/><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Im Vortrag erklären: 600 T€ im Süden.</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>';
      zip.file("ppt/notesSlides/pp07Note.xml", note);
      zip.file(
        "[Content_Types].xml",
        (await zip.file("[Content_Types].xml")!.async("string")).replace(
          "</Types>",
          '<Override PartName="/ppt/notesSlides/pp07Note.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/></Types>',
        ),
      );
      await manuellSpeichern(w, zip);
      const vorher = await w.datei();
      const p = await vorschau(w);
      const konflikte = p.r.json().dateikonflikte as { id: string; art: string; grund: string }[];
      expect(konflikte.some((k) => k.art === "element" && k.grund.includes("manuell"))).toBe(true);
      expect(
        konflikte.some((k) => k.art === "notiz" && k.grund.includes("pp07Note.xml, Absatz 1")),
      ).toBe(true);
      expect((await uebernehmen(w, p)).statusCode).toBe(400);
      expect((await w.datei()).satz.fassung).toBe(vorher.satz.fassung);
      const r = await uebernehmen(
        w,
        p,
        konflikte.map((k) => k.id),
      );
      expect(r.statusCode, r.body).toBe(200);
      expect(r.json().zustand).toBe("teilweise_uebernommen");
      const neu = await w.datei();
      const z = await JSZip.loadAsync(neu.bytes);
      expect(await z.file("ppt/notesSlides/pp07Note.xml")!.async("string")).toBe(note);
      const text = neu.satz.folien.flatMap((f) => f.elemente.map((e) => e.text)).join("\n");
      expect(text).toContain("Manuell geprüfte Sonderaussage");
      expect(text).toContain("700 T€");
      expect((await w.services.datenpunkte.lesen(w.b.id))?.wert).toBe("700 T€");
      const stand = await w.app.inject({
        method: "GET",
        url: `${w.basis}/datenaktualisierung/stand`,
        headers: w.admin,
      });
      expect(stand.statusCode, stand.body).toBe(200);
      expect(stand.json().uebernahme.konflikteOffen).toHaveLength(konflikte.length);
    } finally {
      await w.app.close();
    }
  });

  it("führt veränderte Bezugsbeschriftung in Tabelle, Aussage, nativem Diagramm und Arbeitsmappe gemeinsam nach", async () => {
    const w = await dateiwelt();
    try {
      const p = await vorschau(w, { wert: "700 T€", bezugsgroesse: "Umsatz Süd & Ost" });
      expect(p.r.json().konflikte).toEqual([]);
      expect(p.r.json().dateikonflikte).toEqual([]);
      const r = await uebernehmen(w, p);
      expect(r.statusCode, r.body).toBe(200);
      const d = await w.datei();
      const z = await JSZip.loadAsync(d.bytes);
      expect(d.satz.folien.flatMap((f) => f.elemente.map((e) => e.text)).join("\n")).toContain(
        "Umsatz Süd & Ost (T€)",
      );
      const deck = (await leseDeckVertraege(z))[0]!.deck;
      const chart = await z.file(deck.diagramme[0]!.teil)!.async("string");
      expect(chart).toContain("Umsatz Süd &amp; Ost");
      const name = Object.keys(z.files).find((s) => s.endsWith(".xlsx"))!;
      const wb = await JSZip.loadAsync(await z.file(name)!.async("nodebuffer"));
      expect(await wb.file("xl/worksheets/sheet1.xml")!.async("string")).toContain(
        "Umsatz Süd &amp; Ost",
      );
    } finally {
      await w.app.close();
    }
  });

  it("überschreibt manuell vertauschte Diagrammkategorien nicht mit neuen Zahlen", async () => {
    const w = await dateiwelt();
    try {
      const z = await JSZip.loadAsync((await w.datei()).bytes);
      const c = (await leseDeckVertraege(z))[0]!.deck.diagramme[0]!;
      const manuell = (await z.file(c.teil)!.async("string")).replace(
        "Umsatz Nord",
        "Manuelle Kategorie",
      );
      z.file(c.teil, manuell);
      await manuellSpeichern(w, z);
      const p = await vorschau(w);
      const konflikte = p.r.json().dateikonflikte as { id: string; art: string }[];
      expect(konflikte.some((k) => k.art === "diagramm")).toBe(true);
      const r = await uebernehmen(
        w,
        p,
        konflikte.map((k) => k.id),
      );
      expect(r.statusCode, r.body).toBe(200);
      expect(
        await (await JSZip.loadAsync((await w.datei()).bytes)).file(c.teil)!.async("string"),
      ).toBe(manuell);
    } finally {
      await w.app.close();
    }
  });

  it("meldet echte Datei-vor-Daten-CAS-Teilwirkung und schützt eine dazwischen gespeicherte Fremdprüfung vor Rücknahme", async () => {
    const w = await dateiwelt();
    try {
      const p = await vorschau(w);
      const vorher = await w.datei();
      const original = w.services.datenpunkte.ersetzen.bind(w.services.datenpunkte);
      let ausgelost = false;
      const spy = vi
        .spyOn(w.services.datenpunkte, "ersetzen")
        .mockImplementation(async (dp, stand) => {
          if (dp.id === w.b.id && dp.fassung === 2 && !ausgelost) {
            ausgelost = true;
            const fremd = await w.app.inject({
              method: "POST",
              url: `/api/datenpunkte/${w.b.id}/pruefungen`,
              headers: w.bert,
              payload: {
                fassung: 1,
                dimension: "struktur",
                ergebnis: "klaerung",
                grund: "Unabhängige neue Prüfung während des Dateischritts (fiktiv).",
              },
            });
            expect(fremd.statusCode, fremd.body).toBe(200);
          }
          return original(dp, stand);
        });
      const r = await uebernehmen(w, p);
      spy.mockRestore();
      expect(ausgelost).toBe(true);
      expect(r.statusCode, r.body).toBe(500);
      expect(r.json().error).toBe("PP07_TEILWIRKUNG");
      expect((await w.datei()).ko.version).toBe(vorher.ko.version + 1);
      expect((await w.services.datenpunkte.lesen(w.b.id))?.wert).toBe("600 T€");
      const stand = await w.app.inject({
        method: "GET",
        url: `${w.basis}/datenaktualisierung/stand`,
        headers: w.admin,
      });
      expect(stand.statusCode, stand.body).toBe(200);
      expect(stand.json().uebernahme.ruecknahmeMoeglich).toBe(false);
      const rueck = await w.app.inject({
        method: "POST",
        url: `${w.basis}/datenaktualisierung/ruecknahme`,
        headers: w.admin,
        payload: { expectedVersion: r.json().fassung, vorschauId: p.r.json().vorschauId },
      });
      expect(rueck.statusCode, rueck.body).toBe(409);
      expect(
        (await w.services.datenpunkte.lesen(w.b.id))?.pruefungen.some((x) =>
          x.grund.includes("Unabhängige neue Prüfung"),
        ),
      ).toBe(true);
    } finally {
      vi.restoreAllMocks();
      await w.app.close();
    }
  });

  it("nennt die schon gespeicherte kurze Datei, wenn das zweite Speichern tatsächlich scheitert", async () => {
    const w = await dateiwelt();
    try {
      const d = await w.datei();
      const put = w.services.objects.put.bind(w.services.objects);
      vi.spyOn(w.services.objects, "put").mockImplementation(async (a) => {
        if (a.name.includes("-ausfuehrlich")) throw new Error("Fiktiver zweiter Speicherfehler");
        return put(a);
      });
      const r = await w.app.inject({
        method: "POST",
        url: `${w.basis}/datenaktualisierung/fassungen`,
        headers: w.bert,
        payload: { expectedVersion: d.ko.version, dateiFassung: d.satz.fassung },
      });
      expect(r.statusCode, r.body).toBe(500);
      expect(r.json().error).toBe("PP07_FASSUNGEN_TEILWIRKUNG");
      expect(r.json().dateien).toHaveLength(1);
      const f = r.json().dateien[0];
      expect(f).toMatchObject({ tiefe: "kurz", wiederoeffnet: true });
      expect(await w.services.objects.read(f.objectId)).toBeDefined();
      expect((await w.datei()).satz.fassung).toBe(d.satz.fassung);
    } finally {
      vi.restoreAllMocks();
      await w.app.close();
    }
  });
});
