// PP-06 Originalabnahme: echte Routen, KO-Fassungen, Objektspeicher, PPTX und W10.
// Fiktive Testdaten; nur Anmeldung ersetzt. Kein Browser-, Office- oder PostgreSQL-Beleg.
import Fastify from "fastify";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Guards, SessionUser } from "../../services/app/src/http";
import { SpeicherOfficeAblage } from "../../services/app/src/office-ablage";
import { leseFolienDaten } from "../../services/app/src/praesentation-daten";
import { SpeicherDatenpunktAblage } from "../../services/app/src/praesentation-daten-ablage";
import type {
  ErgaenzungsSuche,
  ErgaenzungsVorschau,
} from "../../services/app/src/praesentation-ergaenzung";
import { officeRoutes } from "../../services/app/src/routes/office-routes";
import { praesentationDatenRoutes } from "../../services/app/src/routes/praesentation-daten-routes";
import {
  InMemoryEvidenceRepo,
  InMemoryKoRepo,
  InMemoryKoVersionRepo,
} from "../../services/knowledge-object/src/repo";
import { KoService } from "../../services/knowledge-object/src/service";
import { InMemoryObjectRepo, ObjectStore, decodeDataUrl } from "../../services/object-store";
import { can } from "../../services/rbac";
import { PPTX, pruefdeck } from "./pp03-pruefdeck";

async function welt() {
  const ko = new KoService({
    repo: new InMemoryKoRepo(),
    versions: new InMemoryKoVersionRepo(),
    evidence: new InMemoryEvidenceRepo(),
  });
  const objekte = new ObjectStore({ repo: new InMemoryObjectRepo() });
  const ablage = new SpeicherDatenpunktAblage();
  const officeAblage = new SpeicherOfficeAblage();
  const konten = async () => [
    { id: "anna", name: "Anna Fiktiv", role: "experte" as const, approved: true },
    { id: "chef", name: "Chef Fiktiv", role: "admin" as const, approved: true },
    { id: "leser", name: "Leser Fiktiv", role: "viewer" as const, approved: true },
  ];
  const guards: Guards = {
    async requireUser(request, reply) {
      const k = (await konten()).find((k) => k.id === request.headers["x-test-nutzer"]);
      if (!k) {
        reply.code(401).send();
        return undefined;
      }
      return { ...k, spaceLesbar: new Set<string>() } satisfies SessionUser;
    },
    async requirePermission(permission, request, reply) {
      const u = await this.requireUser(request, reply);
      if (u && !can(u.role, permission)) {
        reply.code(403).send();
        return undefined;
      }
      return u;
    },
  };
  const app = Fastify();
  await app.register(praesentationDatenRoutes({ ko, objekte, ablage, konten }, guards));
  await app.register(
    officeRoutes(
      {
        ko,
        objekte,
        konten,
        ablage: officeAblage,
        datenpunkte: ablage,
        spaceLesbar: async () => new Set(),
        einrichtung: { eingerichtet: false, fehlt: ["Fiktive lokale Prüfung ohne Editor"] },
      },
      guards,
    ),
  );
  await app.ready();
  const zip = await JSZip.loadAsync(await pruefdeck());
  const xml = await zip.file("ppt/slides/slide1.xml")?.async("string");
  zip.file(
    "ppt/slides/slide1.xml",
    xml?.replace("Umsatz 2024: 900 T€", "Vergleichswert offen") ?? "",
  );
  const bytes = await zip.generateAsync({ type: "nodebuffer" });
  const ref = await objekte.put({
    name: "Fiktiver-Vergleich.pptx",
    mime: PPTX,
    data: `data:${PPTX};base64,${bytes.toString("base64")}`,
    purpose: "attachment",
  });
  const ohneAnhang = await ko.create({
    title: "Fiktives Deck",
    statement: "Lokaler PP06-Testbestand",
    type: "best_practice",
    category: "Test",
    author: "anna",
    confidentiality: "intern",
  });
  const ziel = await ko.addAttachment(ohneAnhang.id, "anna", {
    name: ref.name,
    mime: PPTX,
    objectId: ref.id,
    size: ref.size,
  });
  const anhangId = ziel.attachments?.[0]?.id ?? "";
  const quelle = await ko.create({
    title: "Fiktive Vertriebsdaten",
    statement: "Umsatz Q3 2025 netto Europa: 900 T€; Q4: 1.000 T€; Vorschau: 990 T€.",
    type: "best_practice",
    category: "Test",
    author: "anna",
    confidentiality: "intern",
  });
  const pfad = `/api/kos/${ziel.id}/office/${anhangId}`;
  const suche: ErgaenzungsSuche = {
    ort: { anhangId, sldId: "256", shapeId: "7" },
    luecke: {
      zeitraum: "Q3 2025",
      einheit: "T€",
      waehrung: "EUR",
      bezugsgroesse: "Umsatz netto Europa",
      verwendung: "beobachtet",
    },
    quellArtikelIds: [quelle.id],
  };
  async function call<T>(url: string, payload?: unknown, nutzer = "anna") {
    const r = await app.inject({
      method: payload === undefined ? "GET" : "POST",
      url,
      headers: { "x-test-nutzer": nutzer },
      ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
    });
    return { status: r.statusCode, body: r.body ? r.json<T>() : (undefined as T) };
  }
  async function erfasse(auftrag: Record<string, unknown> = {}, koId = quelle.id) {
    const r = await call<{ id: string }>(`/api/kos/${koId}/datenpunkte`, {
      art: "zahl",
      wert: "900 T€",
      erfassung: "direkt",
      quelleKoId: quelle.id,
      zitat: "Umsatz Q3 2025 netto Europa: 900 T€",
      einheit: "T€",
      waehrung: "EUR",
      zeitraum: "Q3 2025",
      bezugsgroesse: "Umsatz netto Europa",
      ...auftrag,
    });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    return r.body.id;
  }
  const vorschau = (s = suche, nutzer = "anna") =>
    call<ErgaenzungsVorschau>(`${pfad}/ergaenzung/vorschau`, s, nutzer);
  async function uebernehmen(v: ErgaenzungsVorschau, id: string, s = suche, nutzer = "anna") {
    return call<{
      datenpunktId: string;
      dokument: {
        neueFassung: number;
        zustand: string;
        pruefung: { ok: boolean };
        ruecknahme: { ausFassung: number };
      };
      error?: string;
      message?: string;
    }>(
      `${pfad}/ergaenzung/uebernehmen`,
      { ...s, kandidatId: id, token: v.kandidaten.find((k) => k.datenpunkt.id === id)?.token },
      nutzer,
    );
  }
  return {
    app,
    ko,
    objekte,
    ablage,
    officeAblage,
    ziel,
    quelle,
    pfad,
    suche,
    bytes,
    call,
    erfasse,
    vorschau,
    uebernehmen,
  };
}

describe("PP-06 · Datenlücken passend ergänzen", () => {
  let w: Awaited<ReturnType<typeof welt>>;
  beforeEach(async () => {
    w = await welt();
  });
  afterEach(async () => {
    await w.app.close();
  });

  it("ergänzt aus vorhandener Quelle, öffnet gespeicherte Datei erneut, bindet denselben Datenpunkt und holt die vorherige Fassung zurück", async () => {
    const id = await w.erfasse();
    const vorher = await w.ablage.lesen(id);
    const v = await w.vorschau();
    expect(v.status, JSON.stringify(v.body)).toBe(200);
    expect(v.body.kandidaten[0]?.passend).toBe(true);
    expect((await w.ko.get(w.ziel.id))?.version).toBe(w.ziel.version); // Vorschau schreibt nichts.
    const r = await w.uebernehmen(v.body, id);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.dokument.pruefung.ok).toBe(true);
    const aktuell = await w.ko.get(w.ziel.id);
    const objekt = await w.objekte.read(aktuell?.attachments?.[0]?.objectId ?? "");
    const bytes = decodeDataUrl(objekt?.data ?? "")?.bytes;
    expect(bytes).toBeDefined();
    const folien = await leseFolienDaten(bytes as Buffer);
    expect(folien.folien[0]?.elemente.find((e) => e.shapeId === "7")?.text).toBe(
      "900 T€ · T€ · EUR · Q3 2025 · Umsatz netto Europa",
    );
    expect(folien.folien[0]?.elemente.find((e) => e.shapeId === "6")?.text).toBe(
      "Umsatz Q4 2025: 1.000 T€",
    );
    const nachher = await w.ablage.lesen(id);
    expect(nachher?.quelle).toEqual(vorher?.quelle);
    expect(nachher?.pruefungen).toEqual(vorher?.pruefungen);
    expect(nachher?.bindungen).toHaveLength(1);
    expect(nachher?.bindungen[0]?.shapeId).toBe("7");
    expect(await w.ablage.vonArtikel(w.ziel.id)).toHaveLength(0); // Kein paralleler Datenbestand.
    const lage = await w.call<{ datenpunkte: { id: string; kontrolle: { zustand: string } }[] }>(
      `${w.pfad}/folien-daten`,
    );
    expect(lage.body.datenpunkte[0]?.id).toBe(id);
    expect(lage.body.datenpunkte[0]?.kontrolle.zustand).not.toBe("validiert");
    const undo = await w.call(`${w.pfad}/zurueckholen`, {
      ausFassung: r.body.dokument.ruecknahme.ausFassung,
      expectedVersion: r.body.dokument.neueFassung,
    });
    expect(undo.status).toBe(200);
    const nachUndo = await w.ko.get(w.ziel.id);
    expect(nachUndo?.attachments?.[0]?.objectId).toBe(w.ziel.attachments?.[0]?.objectId);
    const wiederholung = await w.uebernehmen(v.body, id);
    expect(wiederholung.status).toBe(409);
    expect((await w.ko.get(w.ziel.id))?.version).toBe(nachUndo?.version);
  });

  it.each([
    ["zeitraum", "Q4 2025", "Zeitraum"],
    ["einheit", "€", "Einheit"],
    ["waehrung", "USD", "Währung"],
    ["bezugsgroesse", "Umsatz brutto Welt", "Bezugsgröße"],
  ])("weist abweichenden Rahmen %s zurück", async (feld, wert, grund) => {
    const id = await w.erfasse({ [feld]: wert });
    const v = await w.vorschau();
    expect(v.body.offen).toBe(true);
    expect(v.body.kandidaten[0]?.gruende.join(" ")).toContain(grund);
    expect((await w.uebernehmen(v.body, id)).status).toBe(409);
    expect((await w.ko.get(w.ziel.id))?.version).toBe(w.ziel.version);
  });

  it("diagnostiziert fehlenden Bezugsrahmen und lässt nicht verfügbare Angaben offen", async () => {
    const v = await w.vorschau({
      ...w.suche,
      luecke: { ...w.suche.luecke, zeitraum: "", bezugsgroesse: "", einheit: "", waehrung: "" },
    });
    expect(v.body.offen).toBe(true);
    expect(v.body.gruende.join(" ")).toMatch(
      /Bezugszeitraum.*Einheit.*Bezugsgröße.*Lücke bleibt offen/,
    );
    expect(v.body.kandidaten).toEqual([]);
  });

  it("verwendet eine Prognose nur auf ausdrücklichen Wunsch mit Annahmen und Modellbezug", async () => {
    const id = await w.erfasse({
      erfassung: "prognose",
      wert: "990 T€",
      annahmen: ["10 Prozent Wachstum bei unverändertem Umfang"],
      modellbezug: "Fiktives Wachstumsszenario",
    });
    const ist = await w.vorschau();
    expect(ist.body.kandidaten[0]?.passend).toBe(false);
    expect(ist.body.kandidaten[0]?.gruende.join(" ")).toContain("kein beobachteter");
    const s = { ...w.suche, luecke: { ...w.suche.luecke, verwendung: "prognose" as const } };
    const v = await w.vorschau(s);
    expect(v.body.kandidaten[0]?.passend).toBe(true);
    expect(v.body.kandidaten[0]?.neu).toMatch(/^Prognose:.*Annahmen:.*10 Prozent.*Modell:/);
    expect((await w.uebernehmen(v.body, id, s)).status).toBe(200);
    expect((await w.ablage.lesen(id))?.erfassung).toBe("prognose");
  });

  it("weist alte Vorschau nach Quellenänderung zurück", async () => {
    const id = await w.erfasse();
    const v = await w.vorschau();
    await w.ko.revise(w.quelle.id, { statement: "Neue Quellfassung: 950 T€" }, "anna", {
      expectedVersion: w.quelle.version,
    });
    expect((await w.uebernehmen(v.body, id)).status).toBe(409);
    expect((await w.vorschau()).body.kandidaten[0]?.passend).toBe(false);
  });

  it("unterscheidet passende und unpassende Quellen und schützt die Datenfassung der Vorschau", async () => {
    const id = await w.erfasse();
    await w.erfasse({ zeitraum: "Q4 2025" });
    const v = await w.vorschau();
    expect(v.body.kandidaten.filter((k) => k.passend).map((k) => k.datenpunkt.id)).toEqual([id]);
    const korrektur = await w.call(`/api/datenpunkte/${id}/korrektur`, {
      fassung: 1,
      einheit: "€",
      grund: "Fiktive Einheitenkorrektur",
    });
    expect(korrektur.status).toBe(200);
    expect((await w.uebernehmen(v.body, id)).status).toBe(409);
  });

  it("weist eine zwischenzeitlich geänderte Zielpräsentation zurück", async () => {
    const id = await w.erfasse();
    const v = await w.vorschau();
    const neu = await w.ko.revise(
      w.ziel.id,
      { statement: "Fiktive unabhängige Änderung" },
      "anna",
      { expectedVersion: w.ziel.version },
    );
    expect((await w.uebernehmen(v.body, id)).status).toBe(409);
    expect((await w.ko.get(w.ziel.id))?.version).toBe(neu.version);
  });

  it("öffnet keinen breiteren Leserkreis für eine nur kraft Autorschaft zugängliche Quelle", async () => {
    await w.ko.setConfidentiality(w.quelle.id, "streng_vertraulich", "anna");
    const id = await w.erfasse();
    const v = await w.vorschau();
    expect(v.body.kandidaten[0]?.gruende).toContain(
      "Quellenrechte lassen die Übernahme in diesen Artikel nicht zu.",
    );
    expect((await w.uebernehmen(v.body, id)).status).toBe(409);
  });

  it("schützt Spacegrenzen auch bei erneutem Abruf", async () => {
    await w.erfasse();
    await w.ko.setLeadingSpace(w.quelle.id, "fremder-fiktiver-space", "anna", null);
    const v = await w.vorschau();
    expect(v.body.kandidaten).toEqual([]);
  });

  it("diagnostiziert ungültige und nicht unterstützte Auswahl ohne Dateiwirkung", async () => {
    expect(
      (await w.vorschau({ ...w.suche, ort: { ...w.suche.ort, zeile: 1, spalte: 1 } })).status,
    ).toBe(400);
    expect((await w.vorschau({ ...w.suche, ort: { ...w.suche.ort, shapeId: "9" } })).status).toBe(
      400,
    );
    expect(
      (
        await w.vorschau({
          ...w.suche,
          quellArtikelIds: Array.from({ length: 11 }, () => w.quelle.id),
        })
      ).status,
    ).toBe(400);
    expect((await w.ko.get(w.ziel.id))?.version).toBe(w.ziel.version);
  });

  it("ignoriert unsichtbare Quellen ohne Existenzauskunft und prüft Rechte bei Übernahme erneut", async () => {
    const id = await w.erfasse();
    const v = await w.vorschau();
    await w.ko.setConfidentiality(w.quelle.id, "streng_vertraulich", "anna");
    const leser = await w.vorschau(w.suche, "leser");
    expect(leser.body.kandidaten).toEqual([]);
    expect((await w.uebernehmen(v.body, id)).status).toBe(409);
    expect((await w.ko.get(w.ziel.id))?.version).toBe(w.ziel.version);
  });

  it("erlaubt lesende Vorschau, verweigert Schreiben ohne ko.create", async () => {
    const id = await w.erfasse();
    const v = await w.vorschau(w.suche, "leser");
    expect(v.status, JSON.stringify(v.body)).toBe(200);
    expect((await w.uebernehmen(v.body, id, w.suche, "leser")).status).toBe(403);
  });

  it("nennt eine tatsächlich gespeicherte Datei bei gleichzeitig gescheiterter Herkunftsbindung als Teilwirkung", async () => {
    const id = await w.erfasse();
    const v = await w.vorschau();
    w.ablage.ersetzen = async () => false;
    const r = await w.uebernehmen(v.body, id);
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("PP06_BINDUNG_OFFEN");
    expect(r.body.dokument.zustand).toBe("gespeichert");
    expect(r.body.message).toContain("Dokument gespeichert");
    expect((await w.ko.get(w.ziel.id))?.version).toBeGreaterThan(w.ziel.version);
  });

  it("respektiert eine laufende Office-Sitzung vor jeder Dateiwirkung", async () => {
    const id = await w.erfasse();
    const v = await w.vorschau();
    await w.officeAblage.schreibe(w.suche.ort.anhangId, {
      basisFassung: w.ziel.version,
      sperre: { kennung: "fiktiver-editor", bis: Date.now() + 60_000 },
    });
    const r = await w.uebernehmen(v.body, id);
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("OFFICE_SITZUNG_LAEUFT");
    expect((await w.ko.get(w.ziel.id))?.version).toBe(w.ziel.version);
  });

  it("verschweigt eingetretene Wirkungen nicht, wenn der vorhandene Office-Weg anschließend scheitert", async () => {
    const id = await w.erfasse();
    const v = await w.vorschau();
    const put = w.objekte.put.bind(w.objekte);
    let aufrufe = 0;
    w.objekte.put = async (eingabe) => {
      aufrufe++;
      if (aufrufe === 2) throw new Error("Fiktiver Folgeprodukt-Speicherfehler");
      return put(eingabe);
    };
    const r = await w.uebernehmen(v.body, id);
    expect(r.status).toBe(500);
    expect(r.body.error).toBe("PP06_TEILFEHLER");
    const ko = await w.ko.get(w.ziel.id);
    expect(ko?.version).toBeGreaterThan(w.ziel.version);
    expect((await w.ablage.lesen(id))?.bindungen).toHaveLength(0);
  });
});
