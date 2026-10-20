// Der tatsächliche Caller: buildApp -> objectRoutes -> /raw, Daten-URL und /traeger.
// Echter lokaler Speicher-/Fassungsweg, reguläre Anmeldung, ausschließlich fiktive Bestände.
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { AufbauPlan } from "../../services/app/src/praesentation-aufbau";
import { decodeDataUrl } from "../../services/object-store";
import { PPTX, vorlage } from "./pp05-welt";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";
async function welt() {
  const services = buildServices();
  const app = buildApp(services, { log: { stufe: "silent" } });
  const adminReg = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      name: "Ada Snapshot Fiktiv",
      email: "ada@pp05-snapshot.test",
      password: "fiktiv-snapshot-2026",
    },
  });
  expect(adminReg.statusCode, adminReg.body).toBe(201);
  async function login(email: string) {
    const r = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "fiktiv-snapshot-2026" },
    });
    expect(r.statusCode).toBe(200);
    return { authorization: `Bearer ${r.json().token}` };
  }
  const admin = await login("ada@pp05-snapshot.test");
  const viewerReg = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin,
    payload: {
      name: "Bert Snapshot Fiktiv",
      email: "bert@pp05-snapshot.test",
      password: "fiktiv-snapshot-2026",
      role: "viewer",
    },
  });
  expect(viewerReg.statusCode, viewerReg.body).toBe(201);
  const viewer = await login("bert@pp05-snapshot.test");
  const adminId = adminReg.json().id as string;
  for (const headers of [admin, viewer])
    await app.inject({ method: "POST", url: "/api/auth/notice", headers });
  const source = await services.ko.create({
    title: "Fiktive Originalquelle Nord",
    statement: "Kontrollierter Umsatz Nord: 400 T€.",
    type: "best_practice",
    category: "Test",
    author: adminId,
    confidentiality: "intern",
  });
  const target = await services.ko.create({
    title: "Fiktives PP05-Zieldeck",
    statement: "Kontrollierte Präsentation",
    type: "best_practice",
    category: "Test",
    author: adminId,
    confidentiality: "intern",
  });
  const original = await vorlage();
  const ref = await services.objects.put({
    name: "Vorlage.pptx",
    mime: PPTX,
    data: `data:${PPTX};base64,${original.toString("base64")}`,
    purpose: "attachment",
    owner: adminId,
    confidentiality: "intern",
  });
  const attached = await services.ko.addAttachment(target.id, adminId, {
    name: ref.name,
    mime: PPTX,
    objectId: ref.id,
    size: ref.size,
  });
  const anhangId = attached.attachments[0]!.id;
  const basis = `/api/kos/${target.id}/office/${anhangId}`;
  async function capture(payload: Record<string, unknown>) {
    const r = await app.inject({
      method: "POST",
      url: `/api/kos/${target.id}/datenpunkte`,
      headers: admin,
      payload,
    });
    expect(r.statusCode, r.body).toBe(201);
    return r.json<{ id: string; fassung: number }>();
  }
  const a = await capture({
    art: "zahl",
    wert: "400 T€",
    einheit: "T€",
    waehrung: "EUR",
    zeitraum: "Q4 2025",
    bezugsgroesse: "Nord",
    erfassung: "direkt",
    quelleKoId: source.id,
    zitat: "Kontrollierter Umsatz Nord: 400 T€.",
  });
  const b = await capture({
    art: "zahl",
    wert: "600 T€",
    einheit: "T€",
    waehrung: "EUR",
    zeitraum: "Q4 2025",
    bezugsgroesse: "Süd",
    erfassung: "manuell",
    beleg: "Fiktiver kontrollierter Südwert",
  });
  const sum = await capture({
    art: "zahl",
    wert: "1.000 T€",
    einheit: "T€",
    waehrung: "EUR",
    zeitraum: "Q4 2025",
    bezugsgroesse: "Gesamtumsatz",
    erfassung: "berechnet",
    rechenweg: { art: "summe", eingaben: [a.id, b.id], stellen: 0 },
  });
  async function build() {
    const current = await services.ko.get(target.id);
    const request = {
      expectedVersion: current!.version,
      titel: "Kontrolliertes Deck",
      ziel: "Daten prüfen",
      publikum: "Fiktive Geschäftsführung",
      dauerMinuten: 12,
      design: "vorlage",
      diagramm: false,
      datenpunkte: [sum],
    };
    const preview = await app.inject({
      method: "POST",
      url: `${basis}/folienaufbau/vorschau`,
      headers: admin,
      payload: request,
    });
    expect(preview.statusCode, preview.body).toBe(200);
    const plan = preview.json<AufbauPlan>();
    const apply = await app.inject({
      method: "POST",
      url: `${basis}/folienaufbau/uebernehmen`,
      headers: admin,
      payload: { ...request, planId: plan.planId },
    });
    expect(apply.statusCode, apply.body).toBe(200);
    expect(apply.json().bindungenOffen).toEqual([]);
    const currentTarget = await services.ko.get(target.id);
    const objectId = currentTarget!.attachments.find((x) => x.id === anhangId)!.objectId!;
    return { objectId, dateiFassung: apply.json().dateiFassung as string };
  }
  const built = await build();
  const get = (id: string, suffix = "", headers = viewer) =>
    app.inject({ method: "GET", url: `/api/objects/${id}${suffix}`, headers });
  return { app, services, source, target, adminId, admin, viewer, a, b, sum, build, get, built };
}

describe("PP05 dynamische Quellrechte am tatsächlichen Snapshotdownload", () => {
  it("Positiv -> transitive Quelle entzogen -> gleiche drei URLs 404/no-store -> berechtigte Gegenprobe und Wiederfreigabe", async () => {
    const w = await welt();
    try {
      for (const suffix of ["", "/raw", "/traeger"]) {
        const r = await w.get(w.built.objectId, suffix);
        expect(r.statusCode, r.body).toBe(200);
      }
      const raw = await w.get(w.built.objectId, "/raw");
      expect(createHash("sha256").update(raw.rawPayload).digest("hex")).toBe(w.built.dateiFassung);
      expect(raw.headers["cache-control"]).toBe("private, no-cache, must-revalidate");
      const meta = await w.get(w.built.objectId);
      expect(
        createHash("sha256").update(decodeDataUrl(meta.json().data)!.bytes).digest("hex"),
      ).toBe(w.built.dateiFassung);
      await w.services.ko.setConfidentiality(w.source.id, "vertraulich", w.adminId);
      // Ziel bleibt lesbar; ausschließlich die verwendete Eingabequelle ist nun verborgen.
      expect(
        (await w.app.inject({ method: "GET", url: `/api/kos/${w.target.id}`, headers: w.viewer }))
          .statusCode,
      ).toBe(200);
      for (const suffix of ["", "/raw", "/traeger"]) {
        const r = await w.get(w.built.objectId, suffix);
        const absent = await w.get("nicht-vorhanden", suffix);
        expect(r.statusCode).toBe(404);
        expect(r.body).toBe(absent.body);
        expect(r.headers["cache-control"]).toBe("no-store");
        expect(r.body).not.toContain(w.source.id);
      }
      const berechtigt = await w.get(w.built.objectId, "/raw", w.admin);
      expect(berechtigt.statusCode).toBe(200);
      expect(berechtigt.headers["cache-control"]).toBe("no-store");
      await w.services.ko.setConfidentiality(w.source.id, "intern", w.adminId, {
        mayDowngrade: true,
      });
      expect((await w.get(w.built.objectId, "/raw")).statusCode).toBe(200);
    } finally {
      await w.app.close();
    }
  });
  it("Historische Datenfassung und unveränderte Vorgängerdecks bleiben nutzbar, Zielentzug sperrt auch alte Snapshots", async () => {
    const w = await welt();
    try {
      const corrected = await w.app.inject({
        method: "POST",
        url: `/api/datenpunkte/${w.b.id}/korrektur`,
        headers: w.admin,
        payload: { fassung: 1, wert: "650 T€", grund: "Fiktive neue Fassung" },
      });
      expect(corrected.statusCode, corrected.body).toBe(200);
      expect((await w.get(w.built.objectId, "/raw")).statusCode).toBe(200);
      const newer = await w.build();
      expect(newer.objectId).not.toBe(w.built.objectId);
      expect((await w.get(newer.objectId, "/raw")).statusCode).toBe(200);
      expect((await w.get(w.built.objectId, "/raw")).statusCode).toBe(200);
      await w.services.ko.setConfidentiality(w.target.id, "vertraulich", w.adminId);
      expect((await w.get(w.built.objectId, "/raw")).statusCode).toBe(404);
      expect((await w.get(newer.objectId, "/raw")).statusCode).toBe(404);
    } finally {
      await w.app.close();
    }
  });
  it("Kopiertes Manifest ohne exakte gespeicherte Dateibindung gibt auch umbenannte Bytes nicht frei", async () => {
    const w = await welt();
    try {
      const stored = await w.services.objects.read(w.built.objectId);
      const clone = await w.services.objects.put({
        name: "umbenannt.bin",
        mime: "application/octet-stream",
        data: stored!.data,
        purpose: "attachment",
        owner: w.adminId,
        confidentiality: "intern",
      });
      await w.services.ko.addAttachment(w.target.id, w.adminId, {
        name: clone.name,
        mime: clone.mime,
        objectId: clone.id,
        size: clone.size,
      });
      expect((await w.get(clone.id, "/raw")).statusCode).toBe(404);
      expect((await w.get(w.built.objectId, "/raw")).statusCode).toBe(200);
    } finally {
      await w.app.close();
    }
  });
  it("Fehlender tatsächlich verwendeter Eingabedatensatz ist keine Erlaubnis aus dem Belegtext", async () => {
    const w = await welt();
    try {
      const read = w.services.datenpunkte.lesen.bind(w.services.datenpunkte);
      vi.spyOn(w.services.datenpunkte, "lesen").mockImplementation((id) =>
        id === w.a.id ? Promise.resolve(undefined) : read(id),
      );
      expect((await w.get(w.built.objectId, "/raw")).statusCode).toBe(404);
    } finally {
      vi.restoreAllMocks();
      await w.app.close();
    }
  });
});
