// O-1-Delta: tatsächlicher buildApp-Caller, reguläre Anmeldung, echte PP06/W10-Dateiwirkung.
// Ausschließlich fiktive In-Memory-Bestände. Kein Browser/Office/PG/Live-Nachweis.
import { createHash } from "node:crypto";
import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { NachbearbeitungsErgebnis } from "../../services/app/src/office-nachbearbeitung";
import { type Datenpunkt, erforderlich } from "../../services/app/src/praesentation-daten";
import type { ErgaenzungsVorschau } from "../../services/app/src/praesentation-ergaenzung";
import { decodeDataUrl } from "../../services/object-store";
import { PPTX, pruefdeck } from "./pp03-pruefdeck";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";
const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const enden = ["", "/raw", "/traeger"];

async function welt(berechnet = false) {
  const services = buildServices();
  const app = buildApp(services, { log: { stufe: "silent" } });
  const password = "fiktiv-pp06-o1-2026";
  const reg = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Quelle Fiktiv", email: "ada@pp06-o1.test", password },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  const adminId = reg.json().id as string;
  async function login(email: string) {
    const r = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    expect(r.statusCode, r.body).toBe(200);
    const headers = { authorization: `Bearer ${r.json().token}` };
    await app.inject({ method: "POST", url: "/api/auth/notice", headers });
    return headers;
  }
  const admin = await login("ada@pp06-o1.test");
  async function konto(name: string, role: "experte" | "viewer") {
    const email = `${name}@pp06-o1.test`;
    const r = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: `${name} Fiktiv`, email, password, role },
    });
    expect(r.statusCode, r.body).toBe(201);
    return { id: r.json().id as string, headers: await login(email) };
  }
  const editor = await konto("bert", "experte");
  const viewer = (await konto("clea", "viewer")).headers;
  async function artikel(title: string, author = adminId) {
    return services.ko.create({
      title,
      statement: "Fiktiver Umsatz: 900 T€; Teilwert: 400 T€.",
      type: "best_practice",
      category: "Test",
      author,
      confidentiality: "intern",
    });
  }
  const quelle = await artikel("O1 fiktive Quelle Q");
  const eingabeQuelle = await artikel("O1 fiktive Eingabequelle E");
  const ziel = await artikel("O1 fiktives Ziel Z", editor.id);
  const zip = await JSZip.loadAsync(await pruefdeck());
  zip.file(
    "[Content_Types].xml",
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>',
  );
  const xml = await zip.file("ppt/slides/slide1.xml")!.async("string");
  zip.file("ppt/slides/slide1.xml", xml.replace("Umsatz 2024: 900 T€", "Vergleichswert offen"));
  const bytes = await zip.generateAsync({ type: "nodebuffer" });
  const original = await services.objects.put({
    name: "Fiktive-Luecke.pptx",
    mime: PPTX,
    data: `data:${PPTX};base64,${bytes.toString("base64")}`,
    purpose: "attachment",
    owner: editor.id,
    confidentiality: "intern",
  });
  const attached = await services.ko.addAttachment(ziel.id, editor.id, {
    name: original.name,
    mime: PPTX,
    objectId: original.id,
    size: original.size,
  });
  const anhangId = attached.attachments[0]!.id;
  const basis = `/api/kos/${ziel.id}/office/${anhangId}`;
  const rahmen = {
    einheit: "T€",
    waehrung: "EUR",
    zeitraum: "Q3 2025",
    bezugsgroesse: "Umsatz netto Europa",
  };
  async function capture(payload: Record<string, unknown>, koId = quelle.id) {
    const r = await app.inject({
      method: "POST",
      url: `/api/kos/${koId}/datenpunkte`,
      headers: admin,
      payload: {
        art: "zahl",
        wert: "900 T€",
        erfassung: "direkt",
        quelleKoId: quelle.id,
        zitat: "Fiktiver Umsatz: 900 T€",
        ...rahmen,
        ...payload,
      },
    });
    expect(r.statusCode, r.body).toBe(201);
    return r.json<{ id: string; fassung: number }>();
  }
  let input: { id: string; fassung: number } | undefined;
  let punkt: { id: string; fassung: number };
  if (berechnet) {
    input = await capture(
      {
        wert: "400 T€",
        quelleKoId: eingabeQuelle.id,
        zitat: "Teilwert: 400 T€",
        bezugsgroesse: "Nord",
      },
      eingabeQuelle.id,
    );
    const b = await capture({
      wert: "500 T€",
      erfassung: "manuell",
      beleg: "Fiktiver Südwert",
      bezugsgroesse: "Süd",
    });
    // Der bestehende PP03-Weg verlangt geprüfte Eingaben, bevor eine Summe verwendbar ist.
    // Fiktive unabhängige Testannahme über reguläre Prüf-API, keine gespeicherten Status ersetzen.
    for (const eingabe of [input, b]) {
      const dp = (await services.datenpunkte.lesen(eingabe.id))!;
      for (const dimension of erforderlich(dp)) {
        const r = await app.inject({
          method: "POST",
          url: `/api/datenpunkte/${dp.id}/pruefungen`,
          headers: admin,
          payload: {
            fassung: dp.fassung,
            dimension,
            ergebnis: "bestanden",
            grund: "Fiktive Eingabe einzeln kontrolliert",
          },
        });
        expect(r.statusCode, r.body).toBe(200);
      }
    }
    punkt = await capture({
      erfassung: "berechnet",
      rechenweg: { art: "summe", eingaben: [input.id, b.id], stellen: 0 },
    });
  } else punkt = await capture({});
  const suche = {
    ort: { anhangId, sldId: "256", shapeId: "7" },
    luecke: { ...rahmen, verwendung: "beobachtet" },
    quellArtikelIds: [quelle.id],
  };
  async function uebernehmen() {
    const preview = await app.inject({
      method: "POST",
      url: `${basis}/ergaenzung/vorschau`,
      headers: editor.headers,
      payload: suche,
    });
    expect(preview.statusCode, preview.body).toBe(200);
    const k = preview
      .json<ErgaenzungsVorschau>()
      .kandidaten.find((k) => k.datenpunkt.id === punkt.id)!;
    expect(k.passend, JSON.stringify(k.gruende)).toBe(true);
    return app.inject({
      method: "POST",
      url: `${basis}/ergaenzung/uebernehmen`,
      headers: editor.headers,
      payload: { ...suche, kandidatId: punkt.id, token: k.token },
    });
  }
  async function gebaut() {
    const r = await uebernehmen();
    expect(r.statusCode, r.body).toBe(200);
    const dokument = r.json<{ dokument: NachbearbeitungsErgebnis }>().dokument;
    expect(dokument.pruefung?.ok).toBe(true);
    const jetzt = await services.ko.get(ziel.id);
    return { objectId: jetzt!.attachments.find((a) => a.id === anhangId)!.objectId!, dokument };
  }
  const get = (id: string, ende = "", headers = viewer) =>
    app.inject({ method: "GET", url: `/api/objects/${id}${ende}`, headers });
  async function status(id: string, erwartet: number, headers = viewer) {
    for (const ende of enden) {
      const r = await get(id, ende, headers);
      expect(r.statusCode, `${ende}: ${r.body.slice(0, 300)}`).toBe(erwartet);
      if (erwartet === 404) {
        const fehlt = await get("o1-nicht-vorhanden", ende, headers);
        expect(r.body).toBe(fehlt.body);
        expect(r.headers["cache-control"]).toBe("no-store");
        expect(r.body).not.toContain(quelle.id);
      }
    }
  }
  return {
    services,
    app,
    adminId,
    admin,
    editor,
    viewer,
    quelle,
    eingabeQuelle,
    ziel,
    original,
    anhangId,
    punkt,
    input,
    uebernehmen,
    gebaut,
    get,
    status,
  };
}

describe("PP06 O-1 · dynamische Quellrechte am tatsächlichen Dateiabruf", () => {
  it("erlaubte echte Ergänzung → Q entzogen bei lesbarem Z → alle drei Abrufe gesperrt; Gegenleser, Wiederfreigabe und gewöhnliche Datei bleiben korrekt", async () => {
    const w = await welt();
    try {
      const gebaut = await w.gebaut();
      await w.status(gebaut.objectId, 200);
      const raw = await w.get(gebaut.objectId, "/raw");
      const data = await w.get(gebaut.objectId);
      expect(hash(decodeDataUrl(data.json().data)!.bytes)).toBe(hash(raw.rawPayload));
      const pptx = await JSZip.loadAsync(raw.rawPayload);
      expect(await pptx.file("[Content_Types].xml")!.async("string")).toContain(
        '<Default Extension="json" ContentType="application/json"/>',
      );
      const dp = (await w.services.datenpunkte.lesen(w.punkt.id))!;
      expect(
        dp.bindungen.some(
          (b) =>
            b.objectId === gebaut.objectId &&
            b.dateiFassung === hash(raw.rawPayload) &&
            /^pp06:[0-9a-f]{64}$/.test(b.id),
        ),
      ).toBe(true);
      const privat = gebaut.dokument.folgeprodukte[0]!.objectId;
      await w.status(privat, 200, w.editor.headers);
      await w.status(privat, 404, w.admin); // Normales Eigentümertor bleibt vorgeschaltet.
      await w.services.ko.setConfidentiality(w.quelle.id, "streng_vertraulich", w.adminId);
      const target = await w.app.inject({
        method: "GET",
        url: `/api/kos/${w.ziel.id}`,
        headers: w.viewer,
      });
      expect(target.statusCode).toBe(200);
      const herkunft = await w.app.inject({
        method: "GET",
        url: `/api/datenpunkte/${w.punkt.id}`,
        headers: w.viewer,
      });
      expect(herkunft.statusCode).toBe(404);
      await w.status(gebaut.objectId, 404);
      await w.status(privat, 404, w.editor.headers);
      await w.status(gebaut.objectId, 200, w.admin); // Tatsächlich berechtigter Quellautor.
      await w.status(w.original.id, 200); // Gewöhnliche Vorgängerdatei ohne übernommene Q-Werte.
      await w.services.ko.setConfidentiality(w.quelle.id, "intern", w.adminId, {
        mayDowngrade: true,
      });
      await w.status(gebaut.objectId, 200);
      await w.status(privat, 200, w.editor.headers);
    } finally {
      await w.app.close();
    }
  });

  it("prüft die tatsächlich gespeicherte historische Eingabefassung und deren heutige Quelle", async () => {
    const w = await welt(true);
    try {
      const gebaut = await w.gebaut();
      await w.status(gebaut.objectId, 200);
      const correction = await w.app.inject({
        method: "POST",
        url: `/api/datenpunkte/${w.input!.id}/korrektur`,
        headers: w.admin,
        payload: { fassung: 1, wert: "450 T€", grund: "Fiktive spätere Erhebung" },
      });
      expect(correction.statusCode, correction.body).toBe(200);
      expect((await w.services.datenpunkte.lesen(w.input!.id))?.fassung).toBe(2);
      expect(
        (await w.services.datenpunkte.lesen(w.punkt.id))?.rechenweg?.eingaben[0]?.fassung,
      ).toBe(1);
      await w.status(gebaut.objectId, 200);
      await w.services.ko.setConfidentiality(w.eingabeQuelle.id, "streng_vertraulich", w.adminId);
      await w.status(gebaut.objectId, 404);
      await w.status(gebaut.objectId, 200, w.admin);
      await w.services.ko.setConfidentiality(w.eingabeQuelle.id, "intern", w.adminId, {
        mayDowngrade: true,
      });
      await w.status(gebaut.objectId, 200);
    } finally {
      await w.app.close();
    }
  });

  it("lässt gespeicherte Teilwirkungen ohne bestätigte PP06-Bindung an allen drei URLs geschlossen", async () => {
    const w = await welt();
    try {
      vi.spyOn(w.services.datenpunkte, "ersetzen").mockResolvedValue(false);
      const r = await w.uebernehmen();
      expect(r.statusCode, r.body).toBe(409);
      expect(r.json().error).toBe("PP06_BINDUNG_OFFEN");
      const dokument = r.json<{ dokument: NachbearbeitungsErgebnis }>().dokument;
      expect(dokument.zustand).toBe("gespeichert");
      const aktuell = await w.services.ko.get(w.ziel.id);
      const id = aktuell!.attachments.find((a) => a.id === w.anhangId)!.objectId!;
      expect(await w.services.objects.read(id)).toBeDefined();
      await w.status(id, 404, w.admin);
      await w.status(dokument.folgeprodukte[0]!.objectId, 404, w.editor.headers);
      await w.status(w.original.id, 200);
    } finally {
      vi.restoreAllMocks();
      await w.app.close();
    }
  });

  it("akzeptiert kopierte Manifeste und gewöhnliche neue Bindungen nicht als echte PP06-Dateibindung", async () => {
    const w = await welt();
    try {
      const gebaut = await w.gebaut();
      const gespeichert = (await w.services.objects.read(gebaut.objectId))!;
      const clone = await w.services.objects.put({
        name: "Kopie.bin",
        mime: "application/octet-stream",
        data: gespeichert.data,
        purpose: "attachment",
        owner: w.editor.id,
        confidentiality: "intern",
      });
      const attached = await w.services.ko.addAttachment(w.ziel.id, w.editor.id, {
        name: "Kopie.pptx",
        mime: PPTX,
        objectId: clone.id,
        size: clone.size,
      });
      const id = attached.attachments.find((a) => a.objectId === clone.id)!.id;
      await w.status(clone.id, 404, w.admin);
      const bind = await w.app.inject({
        method: "POST",
        url: `/api/datenpunkte/${w.punkt.id}/bindungen`,
        headers: w.editor.headers,
        payload: { koId: w.ziel.id, ort: { anhangId: id, sldId: "256", shapeId: "7" } },
      });
      expect(bind.statusCode, bind.body).toBe(200);
      await w.status(clone.id, 404, w.admin);
      await w.status(gebaut.objectId, 200);
    } finally {
      await w.app.close();
    }
  });

  it("sperrt fehlende Herkunft, falschen SHA/Objektbezug und ungeprüft untergeschobenen Dateninhalt", async () => {
    const w = await welt();
    try {
      const gebaut = await w.gebaut();
      const originalRead = w.services.datenpunkte.lesen.bind(w.services.datenpunkte);
      const dp = (await originalRead(w.punkt.id))!;
      const spy = vi.spyOn(w.services.datenpunkte, "lesen");
      const varianten: (Datenpunkt | undefined)[] = [
        undefined,
        { ...dp, bindungen: [] },
        { ...dp, bindungen: dp.bindungen.map((b) => ({ ...b, dateiFassung: "0".repeat(64) })) },
        { ...dp, bindungen: dp.bindungen.map((b) => ({ ...b, objectId: "andere-Datei" })) },
        { ...dp, bezugsgroesse: "Anderer ungeprüfter Nenner" },
      ];
      for (const kandidat of varianten) {
        spy.mockImplementation((id) =>
          id === w.punkt.id ? Promise.resolve(kandidat) : originalRead(id),
        );
        await w.status(gebaut.objectId, 404, w.admin);
      }
      spy.mockRestore();
      await w.status(gebaut.objectId, 200);
    } finally {
      vi.restoreAllMocks();
      await w.app.close();
    }
  });

  it("sperrt fehlende tatsächliche Eingabe statt eine Manifest-Quellbehauptung zu glauben", async () => {
    const w = await welt(true);
    try {
      const gebaut = await w.gebaut();
      const lesen = w.services.datenpunkte.lesen.bind(w.services.datenpunkte);
      vi.spyOn(w.services.datenpunkte, "lesen").mockImplementation((id) =>
        id === w.input!.id ? Promise.resolve(undefined) : lesen(id),
      );
      await w.status(gebaut.objectId, 404, w.admin);
    } finally {
      vi.restoreAllMocks();
      await w.app.close();
    }
  });

  it("erhält das normale Zieltor und bindet private Folgebytes an ihren echten Dateianker", async () => {
    const w = await welt();
    try {
      const gebaut = await w.gebaut();
      const privat = gebaut.dokument.folgeprodukte[0]!.objectId;
      const lesen = w.services.objects.read.bind(w.services.objects);
      const objekt = (await lesen(privat))!;
      expect(objekt.ref.lifecycle?.praesentationAbleitung?.objectId).toBe(gebaut.objectId);
      const spy = vi.spyOn(w.services.objects, "read");
      for (const data of [
        `data:text/markdown;base64,${Buffer.from("Fiktiv verfälschte Bytes").toString("base64")}`,
        "Fiktiver defekter Speicherinhalt ohne Data-URL",
      ]) {
        spy.mockImplementation((id) =>
          id === privat ? Promise.resolve({ ...objekt, data }) : lesen(id),
        );
        await w.status(privat, 404, w.editor.headers);
      }
      spy.mockImplementation((id) =>
        id === gebaut.objectId ? Promise.resolve(undefined) : lesen(id),
      );
      await w.status(privat, 404, w.editor.headers);
      spy.mockRestore();
      await w.status(privat, 200, w.editor.headers);
      await w.services.ko.setConfidentiality(w.ziel.id, "streng_vertraulich", w.editor.id);
      await w.status(gebaut.objectId, 404);
      await w.status(gebaut.objectId, 200, w.editor.headers);
      await w.status(privat, 200, w.editor.headers);
    } finally {
      vi.restoreAllMocks();
      await w.app.close();
    }
  });

  it("übernimmt interne Herkunftsanker nie aus einem öffentlichen Upload und erhält gewöhnliche Uploadabrufe", async () => {
    const w = await welt();
    try {
      const r = await w.app.inject({
        method: "POST",
        url: "/api/objects",
        headers: w.editor.headers,
        payload: {
          name: "Fiktive normale Notiz.txt",
          mime: "text/plain",
          data: `data:text/plain;base64,${Buffer.from("Gewöhnlicher fiktiver Text").toString("base64")}`,
          purpose: "attachment",
          confidentiality: "intern",
          privatQuelle: w.quelle.id,
          praesentationAbleitung: {
            objectId: "behauptete-Datei",
            dateiFassung: "0".repeat(64),
            inhaltSha256: "0".repeat(64),
          },
          lifecycle: { praesentationAbleitung: { objectId: "behauptete-Datei" } },
        },
      });
      expect(r.statusCode, r.body).toBe(201);
      const ref = r.json<{ id: string; name: string; mime: string; size: number }>();
      const stored = (await w.services.objects.read(ref.id))!;
      expect(stored.ref.lifecycle?.praesentationAbleitung).toBeUndefined();
      expect(stored.ref.lifecycle?.privatQuelle).toBeUndefined();
      await w.services.ko.addAttachment(w.ziel.id, w.editor.id, {
        name: ref.name,
        mime: ref.mime,
        size: ref.size,
        objectId: ref.id,
      });
      await w.services.ko.setConfidentiality(w.quelle.id, "streng_vertraulich", w.adminId);
      await w.status(ref.id, 200);
    } finally {
      await w.app.close();
    }
  });
});
