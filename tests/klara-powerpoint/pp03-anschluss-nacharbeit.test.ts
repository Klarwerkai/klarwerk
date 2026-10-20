// ================================================================================================
// produkt:20261015:klara-powerpoint-validierung (PP-03) · ANSCHLUSS — NACHARBEIT NACH UNABHÄNGIGER PRÜFUNG.
// ================================================================================================
//
// Die Szenarien B1–B7 stammen aus der unabhängigen Prüfung des Anschlusses (CHAT-67,
// unabhaengig/PATCH-BEWERTUNG.md). Dort belegten sie das Fehlverhalten; hier sind sie umgedreht und
// halten das richtige Verhalten fest. Harness wie `pp03-anschluss.test.ts`: echte PP-02-Routen, echte
// `.pptx` (`pp03-pruefdeck.ts`), Speicherablage; ersetzt ist nur die Anmeldung. Fiktive Daten.
//
//   N1 (B1)  Geänderte Eingabe: die Arbeit ist „Neu berechnen …“ (PP-02), nicht das wirkungslose
//            „Berechnung für Fassung 1 erneut prüfen.“; Neuberechnen hebt die Überholung auf.
//   N2 (B2)  Neue Quelle einer Eingabe: „… an ihrer aktuellen Herkunft aktualisieren …“.
//   N3 (B3)  Eine Eingabe mit abweichender Folie (Klärungsbedarf) lässt den berechneten Wert nicht
//            „validiert“ — Bindungen zählen auch im Eingabezustand.
//   N4 (B4)  Überholte Freigabe UND nicht validierte Eingaben: beide Arbeiten, kein Versprechen.
//   N5 (B5)  Eine für den Handelnden unsichtbare Bindung erzeugt keinen Vergleichskontext; mit
//            Leserecht schon.
//   N6 (B6)  Dieselbe Datenfassung trägt in der Eingabebeurteilung und in ihrer Herkunftsansicht
//            denselben Zustand.
//   N7 (B7)  Keine Arbeit, die der Prüfweg ablehnt („Berechnung prüfen.“ bei nicht nachrechenbarer Summe).
//   N8       Eine früher bestandene, durch eine später erfasste unsichere Gegenangabe wieder
//            geöffnete Prüfung ist in der Datenlage als `wiedergeoeffnet` gekennzeichnet.
import Fastify, { type FastifyInstance } from "fastify";
import { beforeAll, describe, expect, it } from "vitest";
import type { Guards, SessionUser } from "../../services/app/src/http";
import { SpeicherDatenpunktAblage } from "../../services/app/src/praesentation-daten-ablage";
import { praesentationDatenRoutes } from "../../services/app/src/routes/praesentation-daten-routes";
import {
  InMemoryEvidenceRepo,
  InMemoryKoRepo,
  InMemoryKoVersionRepo,
} from "../../services/knowledge-object/src/repo";
import { KoService } from "../../services/knowledge-object/src/service";
import { InMemoryObjectRepo, ObjectStore } from "../../services/object-store";
import { can } from "../../services/rbac";
import { BILD_KENNUNG, OCR_TEXT, PPTX, pruefdeck } from "./pp03-pruefdeck";

const KONTEN = [
  { id: "anna", name: "Anna Beispiel", role: "experte" as const },
  { id: "chef", name: "Chefin Beispiel", role: "admin" as const },
];
// biome-ignore lint/suspicious/noExplicitAny: Antwortkörper der Routen, im Test frei gelesen.
type K = any;

let app: FastifyInstance;
let ko: KoService;
let objekte: ObjectStore;

async function rufe(nutzer: string, method: "GET" | "POST", url: string, payload?: unknown) {
  const r = await app.inject({
    method,
    url,
    headers: { "x-test-nutzer": nutzer },
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });
  return { status: r.statusCode, body: r.body ? (JSON.parse(r.body) as K) : undefined };
}
async function datei(nord = "400 T€") {
  const bytes = await pruefdeck(nord);
  return objekte.put({
    name: "Kennzahlen.pptx",
    mime: PPTX,
    data: `data:${PPTX};base64,${bytes.toString("base64")}`,
    purpose: "attachment",
  });
}
async function artikelMitDeck(autor: string, titel: string) {
  const ref = await datei();
  const a = await ko.create({
    title: titel,
    statement: "Fiktiv.",
    type: "best_practice",
    category: "Testbestand",
    author: autor,
    confidentiality: "intern",
  });
  const mit = await ko.addAttachment(a.id, autor, {
    name: "Kennzahlen.pptx",
    mime: PPTX,
    objectId: ref.id,
    size: ref.size,
  });
  return { koId: a.id, anhangId: mit.attachments?.[0]?.id ?? "" };
}
async function neueDateifassung(koId: string, anhangId: string, nord: string) {
  const neu = await datei(nord);
  const artikel = await ko.get(koId);
  await ko.uebernimmOfficeFassung(
    koId,
    { anhangId, objectId: neu.id, size: neu.size, expectedVersion: artikel?.version ?? 0 },
    "anna",
  );
}
async function erfasse(nutzer: string, koId: string, auftrag: Record<string, unknown>) {
  const r = await rufe(nutzer, "POST", `/api/kos/${koId}/datenpunkte`, auftrag);
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body as K;
}
const lies = async (nutzer: string, id: string) =>
  (await rufe(nutzer, "GET", `/api/datenpunkte/${id}`)).body as K;
async function pruefe(nutzer: string, id: string, dimension: string, fassung: number) {
  const r = await rufe(nutzer, "POST", `/api/datenpunkte/${id}/pruefungen`, {
    dimension,
    ergebnis: "bestanden",
    grund: "fiktiv geprüft",
    fassung,
  });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body as K;
}
/** Alle erforderlichen Dimensionen (PP-02) als bestanden prüfen; Freigabe durch chef. */
async function allesPruefen(id: string) {
  const s = await lies("chef", id);
  for (const d of s.pruefstand.erforderlich as string[]) {
    await pruefe("chef", id, d, s.fassung);
  }
  return lies("chef", id);
}
async function korrigiere(id: string, rumpf: Record<string, unknown>) {
  const r = await rufe("anna", "POST", `/api/datenpunkte/${id}/korrektur`, rumpf);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body as K;
}
const rahmen = (bezug: string) => ({ einheit: "T€", zeitraum: "Q4 2025", bezugsgroesse: bezug });
const dim = (s: K, d: string) => s.kontrolle.dimensionen.find((x: K) => x.dimension === d);
const ids = (s: K): string[] => s.kontrolle.befunde.map((b: K) => b.id);

beforeAll(async () => {
  objekte = new ObjectStore({ repo: new InMemoryObjectRepo() });
  ko = new KoService({
    repo: new InMemoryKoRepo(),
    versions: new InMemoryKoVersionRepo(),
    evidence: new InMemoryEvidenceRepo(),
  });
  const guards: Guards = {
    async requireUser(request, reply) {
      const k = KONTEN.find((x) => x.id === request.headers["x-test-nutzer"]);
      const u: SessionUser | undefined = k
        ? { id: k.id, role: k.role, spaceLesbar: new Set() }
        : undefined;
      if (!u) {
        reply.code(401).send({ error: "UNAUTHORIZED" });
      }
      return u;
    },
    async requirePermission(permission, request, reply) {
      const u = await this.requireUser(request, reply);
      if (u && !can(u.role, permission)) {
        reply.code(403).send({ error: "FORBIDDEN" });
        return undefined;
      }
      return u;
    },
  };
  let uhr = Date.now();
  app = Fastify();
  await app.register(
    praesentationDatenRoutes(
      {
        ko,
        objekte,
        ablage: new SpeicherDatenpunktAblage(),
        konten: async () => KONTEN,
        jetzt: () => {
          uhr += 1000;
          return uhr;
        },
      },
      guards,
    ),
  );
  await app.ready();
});

describe("PP-03 · Anschluss — Nacharbeit nach unabhängiger Prüfung", () => {
  it("N1 (B1) · geänderte Eingabe: „Neu berechnen“ statt wirkungsloser Arbeit; Neuberechnen wirkt", async () => {
    const { koId } = await artikelMitDeck("anna", "N1 (fiktiv)");
    const i = await erfasse("anna", koId, {
      art: "zahl",
      wert: "400 T€",
      erfassung: "manuell",
      ...rahmen("N1 Nord"),
    });
    const j = await erfasse("anna", koId, {
      art: "zahl",
      wert: "600 T€",
      erfassung: "manuell",
      ...rahmen("N1 Süd"),
    });
    const c = await erfasse("anna", koId, {
      art: "zahl",
      wert: "1.000 T€",
      erfassung: "berechnet",
      ...rahmen("N1 Gesamt"),
      rechenweg: { art: "summe", eingaben: [i.id, j.id], stellen: 0 },
    });
    await korrigiere(i.id, { fassung: 1, zeitraum: "Q4/2025", grund: "fiktiv" });
    const s = await lies("anna", c.id);
    expect(dim(s, "berechnung").stand).toBe("ueberholt");
    expect(s.kontrolle.naechsteArbeit).toContain("Neu berechnen und den Rechenweg erneut prüfen.");
    expect(s.kontrolle.naechsteArbeit).not.toContain("Berechnung für Fassung 1 erneut prüfen.");
    expect(dim(s, "berechnung").arbeit).toEqual(["Neu berechnen und den Rechenweg erneut prüfen."]);
    // Die genannte Arbeit tun: neu berechnen — die Berechnung ist nicht mehr überholt.
    const neu = await korrigiere(c.id, {
      fassung: 1,
      neuBerechnen: true,
      grund: "fiktiv neu berechnet",
    });
    expect(dim(neu, "berechnung").stand).not.toBe("ueberholt");
    expect(neu.kontrolle.naechsteArbeit).not.toContain(
      "Neu berechnen und den Rechenweg erneut prüfen.",
    );
  });

  it("N2 (B2) · neue Quelle einer Eingabe: Eingabe an ihrer Herkunft aktualisieren", async () => {
    const { koId, anhangId } = await artikelMitDeck("anna", "N2 (fiktiv)");
    const i = await erfasse("anna", koId, {
      art: "zahl",
      wert: "300 T€",
      erfassung: "direkt",
      ...rahmen("N2 Kosten Nord"),
      ort: { anhangId, sldId: "256", shapeId: "5", zeile: 2, spalte: 2 },
    });
    const j = await erfasse("anna", koId, {
      art: "zahl",
      wert: "200 T€",
      erfassung: "manuell",
      ...rahmen("N2 Kosten Süd"),
    });
    const c = await erfasse("anna", koId, {
      art: "zahl",
      wert: "500 T€",
      erfassung: "berechnet",
      ...rahmen("N2 Kosten gesamt"),
      rechenweg: { art: "summe", eingaben: [i.id, j.id], stellen: 0 },
    });
    await neueDateifassung(koId, anhangId, "450 T€");
    const s = await lies("anna", c.id);
    expect(dim(s, "aktualitaet").stand).toBe("ueberholt");
    expect(s.kontrolle.naechsteArbeit).toContain(
      "Die betroffene Eingabe an ihrer aktuellen Herkunft aktualisieren, dann neu berechnen.",
    );
    expect(s.kontrolle.naechsteArbeit).not.toContain("Aktualität für Fassung 1 erneut prüfen.");
  });

  it("N3 (B3) · Eingabe mit abweichender Folie: berechneter Wert nicht validiert", async () => {
    const { koId, anhangId } = await artikelMitDeck("anna", "N3 (fiktiv)");
    const i = await erfasse("anna", koId, {
      art: "zahl",
      wert: "400 T€",
      erfassung: "manuell",
      ...rahmen("N3 Umsatz Nord"),
      ort: { anhangId, sldId: "256", shapeId: "4", zeile: 2, spalte: 2 },
    });
    const j = await erfasse("anna", koId, {
      art: "zahl",
      wert: "600 T€",
      erfassung: "manuell",
      ...rahmen("N3 Umsatz Süd"),
    });
    const c = await erfasse("anna", koId, {
      art: "zahl",
      wert: "1.000 T€",
      erfassung: "berechnet",
      ...rahmen("N3 Umsatz gesamt"),
      rechenweg: { art: "summe", eingaben: [i.id, j.id], stellen: 0 },
    });
    expect((await allesPruefen(i.id)).kontrolle.zustand).toBe("validiert");
    expect((await allesPruefen(j.id)).kontrolle.zustand).toBe("validiert");
    expect((await allesPruefen(c.id)).kontrolle.zustand).toBe("validiert");
    await neueDateifassung(koId, anhangId, "450 T€");
    const lage = await rufe("anna", "GET", `/api/kos/${koId}/office/${anhangId}/folien-daten`);
    const von = (id: string) => lage.body.datenpunkte.find((d: K) => d.id === id);
    expect(von(i.id).kontrolle.zustand).toBe("klaerung");
    expect(ids(von(i.id))).toContain("konsistenz.folie_abweichend");
    expect(von(c.id).kontrolle.zustand).not.toBe("validiert");
    expect(ids(von(c.id))).toContain("freigabe.eingaben_nicht_validiert");
    expect(dim(von(c.id), "fachliche_freigabe").grund).toContain("„400 T€“ (Klärungsbedarf)");
  });

  it("N4 (B4) · überholte Freigabe + nicht validierte Eingaben: beide Arbeiten, kein Versprechen", async () => {
    const { koId } = await artikelMitDeck("anna", "N4 (fiktiv)");
    const i = await erfasse("anna", koId, {
      art: "zahl",
      wert: "400 T€",
      erfassung: "manuell",
      ...rahmen("N4 Nord"),
    });
    const j = await erfasse("anna", koId, {
      art: "zahl",
      wert: "600 T€",
      erfassung: "manuell",
      ...rahmen("N4 Süd"),
    });
    const c = await erfasse("anna", koId, {
      art: "zahl",
      wert: "1.000 T€",
      erfassung: "berechnet",
      ...rahmen("N4 Gesamt"),
      rechenweg: { art: "summe", eingaben: [i.id, j.id], stellen: 0 },
    });
    await pruefe("chef", c.id, "fachliche_freigabe", 1);
    const vorher = await korrigiere(c.id, { fassung: 1, zeitraum: "Q4/2025", grund: "fiktiv" });
    expect(dim(vorher, "fachliche_freigabe").stand).toBe("ueberholt");
    expect(vorher.kontrolle.naechsteArbeit).toContain(
      "Fachliche Freigabe für Fassung 2 erneut prüfen.",
    );
    expect(vorher.kontrolle.naechsteArbeit).toContain(
      "Die genannten Eingaben prüfen; erst danach kann dieser Wert validiert sein.",
    );
    expect(vorher.kontrolle.naechsteArbeit.join(" ")).not.toContain("gilt die Freigabe");
    const punkt = (await rufe("anna", "GET", `/api/kos/${koId}/datenpunkte`)).body;
    expect(punkt.datenpunkte.length).toBeGreaterThan(0);
  });

  it("N5 (B5) · unsichtbare Bindung erzeugt keinen Vergleichskontext, sichtbare schon", async () => {
    const a = await artikelMitDeck("anna", "N5 Heimat A (fiktiv)");
    const b = await artikelMitDeck("anna", "N5 Heimat B (fiktiv)");
    const q = await artikelMitDeck("chef", "N5 Vorstandsdeck Q (fiktiv)");
    await ko.setConfidentiality(q.koId, "vertraulich", "chef");
    expect((await rufe("anna", "GET", `/api/kos/${q.koId}/datenpunkte`)).status).toBe(404);
    const dp = await erfasse("anna", a.koId, {
      art: "zahl",
      wert: "1.000 T€",
      erfassung: "manuell",
      ...rahmen("N5 Umsatz Konzern"),
    });
    const x = await erfasse("anna", b.koId, {
      art: "zahl",
      wert: "900 T€",
      erfassung: "manuell",
      ...rahmen("N5 Umsatz Konzern"),
    });
    for (const [id, shapeId] of [
      [dp.id, "6"],
      [x.id, "7"],
    ]) {
      const r = await rufe("chef", "POST", `/api/datenpunkte/${id}/bindungen`, {
        koId: q.koId,
        ort: { anhangId: q.anhangId, sldId: "256", shapeId },
      });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
    }
    const fuerAnna = await lies("anna", dp.id);
    expect(fuerAnna.bindungen).toHaveLength(0);
    expect(ids(fuerAnna)).not.toContain("konsistenz.widerspruch");
    const fuerChef = await lies("chef", dp.id);
    const w = fuerChef.kontrolle.befunde.find((y: K) => y.id === "konsistenz.widerspruch");
    expect(w?.gegenstellen.map((g: K) => g.datenpunktId)).toEqual([x.id]);
  });

  it("N6 (B6) · dieselbe Datenfassung: gleicher Zustand in Eingabebeurteilung und Herkunftsansicht", async () => {
    const { koId, anhangId } = await artikelMitDeck("anna", "N6 (fiktiv)");
    const i = await erfasse("anna", koId, {
      art: "zahl",
      wert: "1.100 T€",
      erfassung: "direkt",
      ...rahmen("N6 Umsatz Konzern"),
      ort: { anhangId, sldId: "256", shapeId: "4", zeile: 4, spalte: 2 },
    });
    const j = await erfasse("anna", koId, {
      art: "zahl",
      wert: "100 T€",
      erfassung: "manuell",
      ...rahmen("N6 Sonstiges"),
    });
    const c = await erfasse("anna", koId, {
      art: "zahl",
      wert: "1.200 T€",
      erfassung: "berechnet",
      ...rahmen("N6 Gesamt"),
      rechenweg: { art: "summe", eingaben: [i.id, j.id], stellen: 0 },
    });
    const iGeprueft = await allesPruefen(i.id);
    expect(iGeprueft.pruefstand.zustand).toBe("validiert");
    expect(iGeprueft.kontrolle.zustand).toBe("klaerung");
    await korrigiere(i.id, { fassung: 1, zeitraum: "Q4/2025", grund: "fiktiv" });
    const sc = await lies("anna", c.id);
    expect(dim(sc, "fachliche_freigabe").grund).toContain("„1.100 T€“ (Klärungsbedarf)");
    const eingabe = sc.rechenweg.eingaben[0];
    expect(eingabe.verwendet.fassung).toBe(1);
    const damals = (await rufe("anna", "GET", `/api/datenpunkte/${i.id}?fassung=1`)).body as K;
    expect(damals.historisch).toEqual({ aktuelleFassung: 2 });
    expect(damals.kontrolle.datenFassung).toBe(1);
    expect(damals.kontrolle.zustand).toBe("klaerung");
    expect(ids(damals)).toContain("berechnung.summe_falsch");
  });

  it("N7 (B7) · keine Arbeit, die der Prüfweg ablehnt", async () => {
    const { koId, anhangId } = await artikelMitDeck("anna", "N7 (fiktiv)");
    const sum = await erfasse("anna", koId, {
      art: "zahl",
      wert: "500 T€",
      erfassung: "direkt",
      ...rahmen("N7 Kosten Konzern"),
      ort: { anhangId, sldId: "256", shapeId: "5", zeile: 4, spalte: 2 },
    });
    await neueDateifassung(koId, anhangId, "450 T€");
    const s = await lies("anna", sum.id);
    expect(dim(s, "berechnung").stand).toBe("offen");
    expect(s.kontrolle.naechsteArbeit).not.toContain("Berechnung prüfen.");
    expect(s.kontrolle.naechsteArbeit).toContain(
      "Wert an der aktuellen Quellfassung neu lesen; danach wird die Summe nachgerechnet.",
    );
    const lage = await rufe("anna", "GET", `/api/kos/${koId}/office/${anhangId}/folien-daten`);
    const arbeiten = lage.body.datenlage.offenePunkte
      .filter((p: K) => p.datenpunktId === sum.id)
      .map((p: K) => p.naechsteArbeit);
    expect(arbeiten).not.toContain("Berechnung prüfen.");
  });

  it("N8 · wieder geöffnete Prüfung ist in der Datenlage gekennzeichnet", async () => {
    const { koId, anhangId } = await artikelMitDeck("anna", "N8 (fiktiv)");
    const dp = await erfasse("anna", koId, {
      art: "zahl",
      wert: "90",
      erfassung: "manuell",
      einheit: "Personen",
      zeitraum: "2025",
      bezugsgroesse: "N8 Belegschaft",
    });
    await pruefe("anna", dp.id, "konsistenz", 1);
    expect(dim(await lies("anna", dp.id), "konsistenz").stand).toBe("bestanden");
    // Später: eine unsicher erkannte, abweichende Gegenangabe aus dem Folienbild.
    await erfasse("anna", koId, {
      art: "zahl",
      wert: "85",
      erfassung: "ocr",
      einheit: "Personen",
      zeitraum: "2025",
      bezugsgroesse: "N8 Belegschaft",
      ocr: { text: OCR_TEXT, bildKennung: BILD_KENNUNG, unsicher: true },
      ort: { anhangId, sldId: "256", shapeId: "9" },
    });
    const s = await lies("anna", dp.id);
    expect(dim(s, "konsistenz")).toMatchObject({ stand: "offen", herkunft: "kontrolle" });
    const lage = await rufe("anna", "GET", `/api/kos/${koId}/office/${anhangId}/folien-daten`);
    const punkt = lage.body.datenlage.offenePunkte.find(
      (p: K) => p.datenpunktId === dp.id && p.dimension === "konsistenz",
    );
    expect(punkt).toMatchObject({ stand: "offen", wiedergeoeffnet: true });
    // Ein noch nie geprüfter offener Punkt trägt die Kennzeichnung nicht.
    const nieGeprueft = lage.body.datenlage.offenePunkte.find(
      (p: K) => p.datenpunktId === dp.id && p.dimension === "struktur",
    );
    expect(nieGeprueft?.wiedergeoeffnet).toBeUndefined();
  });
});
