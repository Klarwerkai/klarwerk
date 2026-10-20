// ================================================================================================
// produkt:20261015:klara-powerpoint-validierung (PP-03) · ANSCHLUSS AN DIE PP-02-ROUTEN.
// ================================================================================================
//
// Geprüft wird der Produktweg über die ECHTEN PP-02-Routen (`praesentationDatenRoutes`) mit dem
// echten Wissensobjektdienst (Speicher-Repos mit Fassungen), dem echten Objektspeicher und einer
// echten, hier gebauten `.pptx`. Ersetzt ist nur die Anmeldung (Kopfzeile `x-test-nutzer`). Die
// Kontrollen kommen aus `praesentation-pruefung.ts` über `praesentation-pruefung-anschluss.ts` —
// nichts davon wird hier nachgebaut. Fiktiver, kontrollierter Bestand:
//
//   Tabelle „Umsatz nach Region“: Nord 400 T€, Süd 600 T€, Summe 1.100 T€ (FALSCH, richtig 1.000).
//   Tabelle „Kosten nach Region“: Nord 300 T€, Süd 200 T€, Summe 500 T€ (richtig).
//   Text „Umsatz Q4 2025: 1.000 T€“, Text „Umsatz 2024: 900 T€“, Text „Marktanteil: 12 %“ (ohne
//   Zeitraum erfasst), Bild mit OCR-Text „Mitarbeitende 2025: 85“ (unsicher erkannt).
//
//   A1  Jede aktuelle Sicht trägt `kontrolle`; die Folienliste trägt die `datenlage`.
//   A2  Abnahme: fehlender Zeitraum, falsche Summe, unsichere OCR → konkrete Prüfzustände mit Grund
//       und nächster Arbeit — auch dann, wenn ein Mensch die Dimension vorher als bestanden prüfte.
//   A3  Abnahme: ein passend geprüfter Wert wird gültig angezeigt (validiert), samt Prüfvermerk.
//   A4  Abnahme: Korrektur hebt den alten Status nachvollziehbar auf; eine frühere Fassung trägt
//       die Kontrolle IHRER Fassung (nicht der aktuellen); ergänzte Pflichtangabe beseitigt die Klärung.
//   A5  Widerspruch mit beiden Fundstellen; anderer Zeitraum ist kein Widerspruch; berechneter Wert
//       mit nicht validierten Eingaben bleibt in Klärung.
//   A6  Rechte: eine Gegenangabe aus einer nicht lesbaren Quelle erscheint weder als Gegenstelle noch
//       in der Datenlage; mit Leserecht erscheint sie.
//   A7  Abnahme: veraltete Quellfassung (neue Datei am Artikel) → Überprüfung nötig mit Grund.
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

interface Konto {
  id: string;
  name: string;
  role: "viewer" | "experte" | "controller" | "admin";
}

const KONTEN: Konto[] = [
  { id: "anna", name: "Anna Beispiel", role: "experte" },
  { id: "chef", name: "Chefin Beispiel", role: "admin" },
];

interface Welt {
  app: FastifyInstance;
  ko: KoService;
  objekte: ObjectStore;
}

async function baueWelt(): Promise<Welt> {
  const objekte = new ObjectStore({ repo: new InMemoryObjectRepo() });
  const ko = new KoService({
    repo: new InMemoryKoRepo(),
    versions: new InMemoryKoVersionRepo(),
    evidence: new InMemoryEvidenceRepo(),
  });
  const nutzer = (id: string | undefined): SessionUser | undefined => {
    const k = KONTEN.find((x) => x.id === id);
    return k ? { id: k.id, role: k.role, spaceLesbar: new Set() } : undefined;
  };
  const guards: Guards = {
    async requireUser(request, reply) {
      const u = nutzer(request.headers["x-test-nutzer"] as string | undefined);
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
  // Die Uhr läuft vom echten Jetzt aus weiter: die Frische (V03) der frisch angelegten Quelle
  // rechnet gegen ihr echtes Anlagedatum.
  let uhr = Date.now();
  const app = Fastify();
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
  return { app, ko, objekte };
}

async function legeObjektAb(w: Welt, bytes: Buffer) {
  return w.objekte.put({
    name: "Kennzahlen.pptx",
    mime: PPTX,
    data: `data:${PPTX};base64,${bytes.toString("base64")}`,
    purpose: "attachment",
  });
}

// biome-ignore lint/suspicious/noExplicitAny: Antwortkörper der Routen, im Test frei gelesen.
type Koerper = any;

async function rufe(
  w: Welt,
  nutzer: string,
  method: "GET" | "POST",
  url: string,
  payload?: unknown,
): Promise<{ status: number; body: Koerper }> {
  const r = await w.app.inject({
    method,
    url,
    headers: { "x-test-nutzer": nutzer },
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });
  return { status: r.statusCode, body: r.body ? JSON.parse(r.body) : undefined };
}

const dim = (s: Koerper, d: string) =>
  s.kontrolle.dimensionen.find((x: { dimension: string }) => x.dimension === d);
const befundIds = (s: Koerper): string[] => s.kontrolle.befunde.map((b: { id: string }) => b.id);

describe("PP-03 · Anschluss der Datenkontrolle an die PP-02-Routen", () => {
  let w: Welt;
  let koId: string;
  let anhangId: string;
  const ids: Record<string, string> = {};

  const ort = (shapeId: string, zeile?: number, spalte?: number) => ({
    anhangId,
    sldId: "256",
    shapeId,
    ...(zeile === undefined ? {} : { zeile, spalte }),
  });
  const erfasse = async (nutzer: string, auftrag: Record<string, unknown>) => {
    const r = await rufe(w, nutzer, "POST", `/api/kos/${koId}/datenpunkte`, auftrag);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    return r.body;
  };
  const pruefe = async (nutzer: string, id: string, dimension: string, fassung = 1) => {
    const r = await rufe(w, nutzer, "POST", `/api/datenpunkte/${id}/pruefungen`, {
      dimension,
      ergebnis: "bestanden",
      grund: `${dimension} am Testbestand geprüft (fiktiv).`,
      fassung,
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    return r.body;
  };
  const lies = async (nutzer: string, id: string) =>
    (await rufe(w, nutzer, "GET", `/api/datenpunkte/${id}`)).body;

  beforeAll(async () => {
    w = await baueWelt();
    const ref = await legeObjektAb(w, await pruefdeck());
    const ko = await w.ko.create({
      title: "Kennzahlen Q4 2025 (fiktiv)",
      statement: "Fiktive Kennzahlen mit Präsentation.",
      type: "best_practice",
      category: "Testbestand",
      author: "anna",
      confidentiality: "intern",
    });
    const mit = await w.ko.addAttachment(ko.id, "anna", {
      name: "Kennzahlen.pptx",
      mime: PPTX,
      objectId: ref.id,
      size: ref.size,
    });
    koId = ko.id;
    anhangId = mit.attachments?.[0]?.id ?? "";

    const rahmen = { einheit: "T€", waehrung: "EUR", zeitraum: "Q4 2025" };
    ids.summeFalsch = (
      await erfasse("anna", {
        art: "zahl",
        wert: "1.100 T€",
        ...rahmen,
        bezugsgroesse: "Umsatz Konzern",
        erfassung: "direkt",
        ort: ort("4", 4, 2),
      })
    ).id;
    ids.kosten = (
      await erfasse("anna", {
        art: "zahl",
        wert: "500 T€",
        ...rahmen,
        bezugsgroesse: "Kosten Konzern",
        erfassung: "direkt",
        ort: ort("5", 4, 2),
      })
    ).id;
    ids.umsatzText = (
      await erfasse("anna", {
        art: "zahl",
        wert: "1.000 T€",
        ...rahmen,
        bezugsgroesse: "Umsatz Konzern",
        erfassung: "direkt",
        ort: ort("6"),
      })
    ).id;
    ids.vorjahr = (
      await erfasse("anna", {
        art: "zahl",
        wert: "900 T€",
        einheit: "T€",
        waehrung: "EUR",
        zeitraum: "2024",
        bezugsgroesse: "Umsatz Konzern",
        erfassung: "direkt",
        ort: ort("7"),
      })
    ).id;
    ids.ohneZeitraum = (
      await erfasse("anna", {
        art: "zahl",
        wert: "12 %",
        einheit: "%",
        bezugsgroesse: "Markt DACH",
        erfassung: "direkt",
        ort: ort("8"),
      })
    ).id;
    ids.ocr = (
      await erfasse("anna", {
        art: "zahl",
        wert: "85",
        einheit: "Personen",
        zeitraum: "2025",
        bezugsgroesse: "Belegschaft",
        erfassung: "ocr",
        ocr: { text: OCR_TEXT, bildKennung: BILD_KENNUNG, unsicher: true },
        ort: ort("9"),
      })
    ).id;
  });

  it("A1 · jede aktuelle Sicht trägt ihre Kontrolle, die Folienliste die Datenlage", async () => {
    const lage = await rufe(w, "anna", "GET", `/api/kos/${koId}/office/${anhangId}/folien-daten`);
    expect(lage.status).toBe(200);
    expect(lage.body.datenpunkte).toHaveLength(6);
    for (const s of lage.body.datenpunkte) {
      expect(s.kontrolle, s.wert).toMatchObject({ datenpunktId: s.id, datenFassung: s.fassung });
      expect(typeof s.kontrolle.gepruefAm).toBe("string");
    }
    const dl = lage.body.datenlage;
    expect(dl.anzahl).toBe(6);
    const summe = Object.values(dl.jeZustand as Record<string, number>).reduce((a, b) => a + b, 0);
    expect(summe).toBe(6);
    expect(dl.offenePunkte.length).toBeGreaterThan(0);
    // Jeder offene Punkt nennt seinen Datenpunkt, die Dimension, den Grund und die Arbeit.
    for (const p of dl.offenePunkte) {
      expect(ids).toSatisfy((x: Record<string, string>) =>
        Object.values(x).includes(p.datenpunktId),
      );
      expect(p.grund.length).toBeGreaterThan(0);
      expect(p.naechsteArbeit.length).toBeGreaterThan(0);
    }
    // Die Einzelabfrage trägt dieselbe Kontrolle.
    const einzeln = await lies("anna", ids.summeFalsch ?? "");
    expect(einzeln.kontrolle.zustand).toBe(
      lage.body.datenpunkte.find((d: Koerper) => d.id === ids.summeFalsch).kontrolle.zustand,
    );
  });

  it("A2 · fehlender Zeitraum, falsche Summe, unsichere OCR → konkrete Prüfzustände, nicht wegbestätigbar", async () => {
    const ohne = await lies("anna", ids.ohneZeitraum ?? "");
    expect(ohne.kontrolle.zustand).toBe("klaerung");
    expect(befundIds(ohne)).toContain("struktur.zeitraum_fehlt");
    expect(dim(ohne, "struktur").stand).toBe("klaerung");
    expect(ohne.kontrolle.naechsteArbeit).toContain(
      "Bezugszeitraum ergänzen (Korrektur am Datenpunkt).",
    );

    const falsch = await lies("anna", ids.summeFalsch ?? "");
    expect(falsch.kontrolle.zustand).toBe("klaerung");
    const summe = dim(falsch, "berechnung");
    expect(summe.stand).toBe("klaerung");
    expect(summe.grund).toContain("= 1.000");
    expect(summe.grund).toContain("1.100 T€");
    expect(befundIds(falsch)).toContain("berechnung.summe_falsch");

    const ocr = await lies("anna", ids.ocr ?? "");
    expect(ocr.kontrolle.zustand).toBe("klaerung");
    expect(dim(ocr, "erkennung").stand).toBe("klaerung");
    expect(befundIds(ocr)).toContain("erkennung.ocr_unsicher");

    // Ein Mensch prüft die Struktur der falschen Summe als „bestanden“: die Berechnung bleibt
    // Klärungsbedarf — ein konkreter Mangel lässt sich nicht wegbestätigen (Regel 2).
    const nachPruefung = await pruefe("anna", ids.summeFalsch ?? "", "struktur");
    expect(nachPruefung.kontrolle.zustand).toBe("klaerung");
    expect(dim(nachPruefung, "struktur").stand).toBe("bestanden");
    expect(dim(nachPruefung, "berechnung").stand).toBe("klaerung");
    // PP-02 allein hätte die Berechnung nicht einmal als erforderlich geführt.
    expect(nachPruefung.pruefstand.erforderlich).not.toContain("berechnung");

    // Die richtige Summe ist maschinell nachgerechnet.
    const kosten = await lies("anna", ids.kosten ?? "");
    expect(dim(kosten, "berechnung")).toMatchObject({ stand: "bestanden", herkunft: "kontrolle" });
    expect(befundIds(kosten)).toContain("berechnung.summe_stimmt");

    // Die unsichere OCR: ein Mensch bestätigt den Wert am Bild — die Unsicherheit ist erledigt.
    const bestaetigt = await pruefe("anna", ids.ocr ?? "", "erkennung");
    expect(dim(bestaetigt, "erkennung").stand).toBe("bestanden");
    expect(befundIds(bestaetigt)).not.toContain("erkennung.ocr_unsicher");
    expect(dim(bestaetigt, "erkennung").pruefung).toMatchObject({
      von: "anna",
      name: "Anna Beispiel",
    });
  });

  it("A3 · ein passend geprüfter Wert wird gültig angezeigt", async () => {
    const id = ids.kosten ?? "";
    for (const d of ["erkennung", "struktur", "konsistenz"]) {
      await pruefe("anna", id, d);
    }
    const ohneFreigabe = await lies("anna", id);
    expect(ohneFreigabe.kontrolle.zustand).toBe("in_pruefung");
    expect(dim(ohneFreigabe, "fachliche_freigabe").stand).toBe("offen");
    // Die fachliche Freigabe braucht ko.validate.
    const verboten = await rufe(w, "anna", "POST", `/api/datenpunkte/${id}/pruefungen`, {
      dimension: "fachliche_freigabe",
      ergebnis: "bestanden",
      fassung: 1,
    });
    expect(verboten.status).toBe(403);
    const frei = await pruefe("chef", id, "fachliche_freigabe");
    expect(frei.kontrolle.zustand).toBe("validiert");
    expect(frei.kontrolle.grund).toContain("Validiert für Datenfassung 1");
    expect(dim(frei, "aktualitaet")).toMatchObject({ stand: "bestanden", herkunft: "kontrolle" });
    expect(dim(frei, "fachliche_freigabe").pruefung).toMatchObject({
      von: "chef",
      name: "Chefin Beispiel",
      datenFassung: 1,
    });
    expect(frei.kontrolle.naechsteArbeit).toEqual([]);
    const lage = await rufe(w, "anna", "GET", `/api/kos/${koId}/office/${anhangId}/folien-daten`);
    expect(lage.body.datenlage.jeZustand.validiert).toBe(1);
    expect(lage.body.datenlage.offenePunkte.some((p: Koerper) => p.datenpunktId === id)).toBe(
      false,
    );
  });

  it("A4 · Korrektur hebt den alten Status nachvollziehbar auf", async () => {
    const id = ids.kosten ?? "";
    const korrigiert = await rufe(w, "anna", "POST", `/api/datenpunkte/${id}/korrektur`, {
      fassung: 1,
      zeitraum: "Geschäftsjahr Q4 2025",
      grund: "Bezugsrahmen präzisiert (fiktiv)",
    });
    expect(korrigiert.status, JSON.stringify(korrigiert.body)).toBe(200);
    const k = korrigiert.body;
    expect(k.fassung).toBe(2);
    expect(k.kontrolle.datenFassung).toBe(2);
    expect(k.kontrolle.zustand).toBe("ueberpruefung_noetig");
    expect(k.kontrolle.zustand).not.toBe("validiert");
    // Die alte Freigabe bleibt sichtbar — als überholt, mit Grund.
    const freigabe = dim(k, "fachliche_freigabe");
    expect(freigabe.stand).toBe("ueberholt");
    expect(freigabe.pruefung).toMatchObject({ von: "chef", datenFassung: 1 });
    expect(freigabe.grund).toContain("Bezugszeitraum");
    expect(k.kontrolle.naechsteArbeit).toContain("Fachliche Freigabe für Fassung 2 erneut prüfen.");

    // Die frühere Fassung ist Herkunft, kein Arbeitsstand: sie trägt die Kontrolle IHRER Fassung —
    // dieselbe, mit der ein berechneter Wert sie als Eingabe beurteilt (Nacharbeit, Befund B6).
    const frueher = await rufe(w, "anna", "GET", `/api/datenpunkte/${id}?fassung=1`);
    expect(frueher.status).toBe(200);
    expect(frueher.body.historisch).toEqual({ aktuelleFassung: 2 });
    expect(frueher.body.kontrolle.datenFassung).toBe(1);
    expect(frueher.body.kontrolle.zustand).toBe("validiert");

    // Ergänzte Pflichtangabe: die Klärung „Bezugszeitraum fehlt“ entfällt.
    const ergaenzt = await rufe(
      w,
      "anna",
      "POST",
      `/api/datenpunkte/${ids.ohneZeitraum}/korrektur`,
      { fassung: 1, zeitraum: "2025", grund: "Zeitraum ergänzt (fiktiv)" },
    );
    expect(ergaenzt.status, JSON.stringify(ergaenzt.body)).toBe(200);
    expect(befundIds(ergaenzt.body)).not.toContain("struktur.zeitraum_fehlt");
    expect(dim(ergaenzt.body, "struktur").stand).not.toBe("klaerung");
    expect(ergaenzt.body.kontrolle.zustand).not.toBe("klaerung");
    expect(ergaenzt.body.korrekturen).toHaveLength(1);
  });

  it("A5 · Widerspruch mit beiden Fundstellen, anderer Zeitraum kein Widerspruch, Eingaben ohne Freigabe", async () => {
    const text = await lies("anna", ids.umsatzText ?? "");
    const widerspruch = text.kontrolle.befunde.find(
      (b: Koerper) => b.id === "konsistenz.widerspruch",
    );
    expect(widerspruch).toBeDefined();
    expect(widerspruch.hier).toContain("Folie 1");
    expect(widerspruch.gegenstellen.map((g: Koerper) => [g.datenpunktId, g.wert])).toEqual([
      [ids.summeFalsch, "1.100 T€"],
    ]);
    expect(widerspruch.gegenstellen[0].fundstelle).toContain("Zeile 4");
    expect(dim(text, "konsistenz").stand).toBe("klaerung");
    const hinweis = text.kontrolle.befunde.find(
      (b: Koerper) => b.id === "konsistenz.anderer_bezugsrahmen",
    );
    expect(hinweis.ergebnis).toBe("hinweis");
    expect(hinweis.gegenstellen.map((g: Koerper) => g.datenpunktId)).toEqual([ids.vorjahr]);

    const gesamt = await erfasse("anna", {
      art: "zahl",
      wert: "1.900 T€",
      einheit: "T€",
      zeitraum: "2024 und Q4 2025",
      bezugsgroesse: "Umsatz zusammen (fiktiv)",
      erfassung: "berechnet",
      rechenweg: { art: "summe", eingaben: [ids.umsatzText, ids.vorjahr], stellen: 0 },
    });
    expect(gesamt.kontrolle.zustand).toBe("klaerung");
    expect(befundIds(gesamt)).toContain("freigabe.eingaben_nicht_validiert");
    expect(dim(gesamt, "fachliche_freigabe").grund).toContain("„1.000 T€“ (Klärungsbedarf)");
  });

  it("A6 · Rechte: eine Gegenangabe aus einer nicht lesbaren Quelle bleibt verborgen", async () => {
    const geheim = await w.ko.create({
      title: "Vorstandsvorlage (fiktiv)",
      statement: "Umsatz Konzern Q4 2025: 1.200 T€ (fiktiv).",
      type: "best_practice",
      category: "Testbestand",
      author: "chef",
    });
    await w.ko.setConfidentiality(geheim.id, "vertraulich", "chef");
    const vorlage = await erfasse("chef", {
      art: "zahl",
      wert: "1.200 T€",
      einheit: "T€",
      waehrung: "EUR",
      zeitraum: "Q4 2025",
      bezugsgroesse: "Umsatz Konzern",
      erfassung: "direkt",
      quelleKoId: geheim.id,
      zitat: "Umsatz Konzern Q4 2025: 1.200 T€",
    });

    const fuerAnna = await lies("anna", ids.umsatzText ?? "");
    const gegenAnna = fuerAnna.kontrolle.befunde
      .flatMap((b: Koerper) => b.gegenstellen ?? [])
      .map((g: Koerper) => g.datenpunktId);
    expect(gegenAnna).not.toContain(vorlage.id);
    expect(JSON.stringify(fuerAnna.kontrolle)).not.toContain("1.200 T€");
    const lageAnna = await rufe(
      w,
      "anna",
      "GET",
      `/api/kos/${koId}/office/${anhangId}/folien-daten`,
    );
    expect(lageAnna.body.datenpunkte.map((d: Koerper) => d.id)).not.toContain(vorlage.id);
    expect(JSON.stringify(lageAnna.body.datenlage)).not.toContain("1.200 T€");

    const fuerChef = await lies("chef", ids.umsatzText ?? "");
    const widerspruch = fuerChef.kontrolle.befunde.find(
      (b: Koerper) => b.id === "konsistenz.widerspruch",
    );
    expect(widerspruch.gegenstellen.map((g: Koerper) => g.datenpunktId)).toContain(vorlage.id);
  });

  it("A7 · veraltete Quellfassung: neue Datei am Artikel → Überprüfung nötig mit Grund", async () => {
    const neueDatei = await legeObjektAb(w, await pruefdeck("500 T€"));
    const artikel = await w.ko.get(koId);
    await w.ko.uebernimmOfficeFassung(
      koId,
      {
        anhangId,
        objectId: neueDatei.id,
        size: neueDatei.size,
        expectedVersion: artikel?.version ?? 0,
      },
      "anna",
    );
    const text = await lies("anna", ids.umsatzText ?? "");
    expect(text.kontrolle.zustand).toBe("ueberpruefung_noetig");
    const aktualitaet = dim(text, "aktualitaet");
    expect(aktualitaet.stand).toBe("ueberholt");
    expect(aktualitaet.befunde.map((b: Koerper) => b.id)).toContain(
      "aktualitaet.neue_quellfassung",
    );
    expect(text.kontrolle.naechsteArbeit.join(" ")).toContain("aktuellen Quellfassung");
    // Gerechnet wird nur an der verwendeten Dateifassung: die Summe ist erst nach dem Neulesen
    // wieder prüfbar — kein stilles „bestanden“ aus der alten Datei.
    const summe = await lies("anna", ids.summeFalsch ?? "");
    expect(befundIds(summe)).toContain("berechnung.summe_nicht_pruefbar");
    expect(summe.kontrolle.zustand).toBe("ueberpruefung_noetig");
  });
});
