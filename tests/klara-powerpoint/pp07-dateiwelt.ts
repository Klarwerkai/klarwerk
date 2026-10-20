import { expect } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { leseFolienDaten } from "../../services/app/src/praesentation-daten";
import { decodeDataUrl } from "../../services/object-store";
import { PPTX, vorlage } from "./pp05-welt";
process.env.KLARWERK_SKIP_KEYCHAIN = "1";

/** Vollständiger produktiver Router, reguläre fiktive Anmeldung, kein Port/Browser/PG/Modell. */
export async function dateiwelt(
  vorErsterAnfrage?: (app: ReturnType<typeof buildApp>) => Promise<void>,
) {
  const services = buildServices();
  const app = buildApp(services, { log: { stufe: "silent" } });
  await vorErsterAnfrage?.(app);
  const registriert = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      name: "Ada PP07 Fiktiv",
      email: "ada@pp07-datei.test",
      password: "fiktiv-pp07-2026",
    },
  });
  expect(registriert.statusCode, registriert.body).toBe(201);
  async function login(email: string) {
    const r = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "fiktiv-pp07-2026" },
    });
    expect(r.statusCode, r.body).toBe(200);
    const headers = { authorization: `Bearer ${r.json().token}` };
    await app.inject({ method: "POST", url: "/api/auth/notice", headers });
    return headers;
  }
  const admin = await login("ada@pp07-datei.test");
  const adminId = registriert.json().id as string;
  const benutzer = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin,
    payload: {
      name: "Bert PP07 Fiktiv",
      email: "bert@pp07-datei.test",
      password: "fiktiv-pp07-2026",
      role: "experte",
    },
  });
  expect(benutzer.statusCode, benutzer.body).toBe(201);
  const bert = await login("bert@pp07-datei.test");
  const bertId = benutzer.json().id as string;
  const quelle = await services.ko.create({
    title: "Kontrollierte Originalquelle (fiktiv)",
    statement: "Umsatz Nord beträgt 400 T€.",
    type: "best_practice",
    category: "Test",
    author: adminId,
    confidentiality: "intern",
  });
  const ziel = await services.ko.create({
    title: "PP07 Deck (fiktiv)",
    statement: "Prüfbares Zieldeck",
    type: "best_practice",
    category: "Test",
    author: adminId,
    confidentiality: "intern",
  });
  const bytes = await vorlage();
  const ref = await services.objects.put({
    name: "Vorlage.pptx",
    mime: PPTX,
    data: `data:${PPTX};base64,${bytes.toString("base64")}`,
    purpose: "attachment",
    owner: adminId,
    confidentiality: "intern",
  });
  const ko = await services.ko.addAttachment(ziel.id, adminId, {
    name: ref.name,
    mime: PPTX,
    objectId: ref.id,
    size: ref.size,
  });
  const anhangId = ko.attachments[0]?.id;
  if (!anhangId) throw new Error("Fiktiver Testanhang fehlt.");
  const basis = `/api/kos/${ziel.id}/office/${anhangId}`;
  const erfasse = async (payload: Record<string, unknown>) => {
    const r = await app.inject({
      method: "POST",
      url: `/api/kos/${ziel.id}/datenpunkte`,
      headers: admin,
      payload,
    });
    expect(r.statusCode, r.body).toBe(201);
    return r.json();
  };
  const a = await erfasse({
    art: "zahl",
    wert: "400 T€",
    einheit: "T€",
    zeitraum: "Q4 2025",
    bezugsgroesse: "Umsatz Nord",
    erfassung: "direkt",
    quelleKoId: quelle.id,
    zitat: "Umsatz Nord beträgt 400 T€.",
  });
  const b = await erfasse({
    art: "zahl",
    wert: "600 T€",
    einheit: "T€",
    zeitraum: "Q4 2025",
    bezugsgroesse: "Umsatz Süd",
    erfassung: "manuell",
    beleg: "Kontrollierte fiktive Angabe",
  });
  const sum = await erfasse({
    art: "zahl",
    wert: "1.000 T€",
    einheit: "T€",
    zeitraum: "Q4 2025",
    bezugsgroesse: "Gesamtumsatz",
    erfassung: "berechnet",
    rechenweg: { art: "summe", eingaben: [a.id, b.id], stellen: 0 },
  });
  const auftrag = {
    expectedVersion: ko.version,
    titel: "Vertrieb Q4 2025",
    ziel: "Daten kontrollieren",
    publikum: "Geschäftsführung",
    dauerMinuten: 12,
    design: "vorlage",
    diagramm: true,
    datenpunkte: [a, b, sum].map((p) => ({ id: p.id, fassung: p.fassung })),
  };
  const p = await app.inject({
    method: "POST",
    url: `${basis}/folienaufbau/vorschau`,
    headers: admin,
    payload: auftrag,
  });
  expect(p.statusCode, p.body).toBe(200);
  const r = await app.inject({
    method: "POST",
    url: `${basis}/folienaufbau/uebernehmen`,
    headers: admin,
    payload: { ...auftrag, planId: p.json().planId },
  });
  expect(r.statusCode, r.body).toBe(200);
  expect(r.json().bindungenOffen).toEqual([]);
  async function datei() {
    const ko = await services.ko.get(ziel.id);
    const objectId = ko?.attachments.find((x) => x.id === anhangId)?.objectId;
    if (!ko || !objectId) throw new Error("Fiktiver Testanhang ist nicht gespeichert.");
    const o = await services.objects.read(objectId);
    const bytes = o ? decodeDataUrl(o.data)?.bytes : undefined;
    if (!bytes) throw new Error("Fiktive Dateibytes fehlen.");
    return { ko, bytes, satz: await leseFolienDaten(bytes) };
  }
  return {
    services,
    app,
    admin,
    adminId,
    bert,
    bertId,
    quelle,
    ziel,
    anhangId,
    basis,
    a,
    b,
    sum,
    datei,
  };
}
