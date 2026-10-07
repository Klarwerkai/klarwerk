// produkt:wettbewerb:20261003:lernplattform — die Übergabe über die ECHTEN HTTP-Routen.
//
// Der Bestand entsteht über die Produktwege (anlegen, zwei Bewertungen, „Überarbeiten und
// freigeben" durch den Administrator) — keine Repo-Manipulation. Gemessen werden:
//   K4 — V2 und V3 ergeben zwei unterscheidbare Pakete; der Auditnachweis des V2-Exports steht nach
//        dem V3-Export unverändert da (append-only), die V2-Fassung bleibt in der Versionsliste.
//   K7 — Kontoregel: ohne Anmeldung kein Export; ein nicht freigegebener Empfänger und ein
//        vertrauliches Objekt erzeugen kein Paket und keinen Auditeintrag.
//   K1 — das ausgelieferte Paket ist ein ZIP mit SCORM-1.2-Manifest und benennt seine Fassung.
import JSZip from "jszip";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { demoKennwort } from "../support/demoZugang";

type App = ReturnType<typeof buildApp>;
type Kopf = Record<string, string>;

beforeAll(() => {
  vi.stubEnv("KLARWERK_LMS_EMPFAENGER", "moodle-referenz=Moodle 4.5 Referenz");
});
afterAll(() => {
  vi.unstubAllEnvs();
});

async function login(app: App, email: string, password: string): Promise<Kopf> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  return { authorization: `Bearer ${res.json().token}` };
}

async function buehne() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@lms.example", password: "secret123" },
  });
  const admin = await login(app, "a@lms.example", "secret123");
  const seed = await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers: admin });
  const carla = await login(app, "carla@demo.klarwerk", demoKennwort(seed, "carla@demo.klarwerk"));
  return { app, services, admin, carla };
}

async function validiertesKo(
  app: App,
  admin: Kopf,
  carla: Kopf,
  title: string,
  confidentiality = "intern",
): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: admin,
    payload: {
      confidentiality,
      title,
      statement: `Kernaussage zu ${title}`,
      type: "best_practice",
      category: "Lernplattform",
      measures: ["Schritt 1", "Schritt 2"],
      neededValidations: 2,
    },
  });
  const id = res.json().id as string;
  for (const h of [admin, carla]) {
    await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: h,
      payload: { action: "rate", verdict: "up" },
    });
  }
  return id;
}

const ueberarbeiten = (app: App, admin: Kopf, id: string, statement: string) =>
  app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: admin,
    payload: { action: "revise-release", changes: { statement } },
  });

const paket = (app: App, h: Kopf | undefined, body: Record<string, unknown>) =>
  app.inject({
    method: "POST",
    url: "/api/output/scorm/paket",
    ...(h ? { headers: h } : {}),
    payload: body,
  });

describe("Lernplattform-Übergabe über HTTP", () => {
  it("K4 · V2 und V3: zwei unterscheidbare Pakete, der V2-Nachweis bleibt unverändert", async () => {
    const { app, services, admin, carla } = await buehne();
    const id = await validiertesKo(app, admin, carla, "Lernplattform Ventil");
    const v2Antwort = await ueberarbeiten(app, admin, id, "Fassung zwei des Lerninhalts.");
    expect(v2Antwort.statusCode).toBe(200);
    const v2Version = v2Antwort.json().version as number;
    expect(v2Antwort.json().status).toBe("validiert");

    const body = { koIds: [id], sprache: "de", empfaenger: "moodle-referenz" };
    const pruefung = await app.inject({
      method: "POST",
      url: "/api/output/scorm/pruefen",
      headers: admin,
      payload: body,
    });
    expect(pruefung.statusCode).toBe(200);
    expect(pruefung.json().exportierbar).toBe(true);
    expect(pruefung.json().format.standard).toBe("SCORM 1.2");
    expect(await services.audit.list({ action: "output.lms-export" })).toHaveLength(0);

    const exportV2 = await paket(app, admin, body);
    expect(exportV2.statusCode).toBe(200);
    expect(exportV2.headers["content-type"]).toBe("application/zip");
    const kennungV2 = String(exportV2.headers["x-klarwerk-exportfassung"]);
    expect(String(exportV2.headers["content-disposition"])).toContain(kennungV2);
    const zipV2 = await JSZip.loadAsync(exportV2.rawPayload);
    const manifestV2 = (await zipV2.file("imsmanifest.xml")?.async("string")) ?? "";
    expect(manifestV2).toContain("<schemaversion>1.2</schemaversion>");
    expect(manifestV2).toContain(`identifier="KLARWERK-SCORM12-${kennungV2}"`);
    expect((await zipV2.file("index.html")?.async("string")) ?? "").toContain(
      `data-ko-version="${v2Version}"`,
    );

    const nachweiseNachV2 = await services.audit.list({ action: "output.lms-export" });
    expect(nachweiseNachV2).toHaveLength(1);
    const v2Nachweis = structuredClone(nachweiseNachV2[0]);
    expect(v2Nachweis?.payload).toMatchObject({
      exportfassung: kennungV2,
      empfaenger: "moodle-referenz",
      objekte: [{ koId: id, version: v2Version }],
      paketSha256: String(exportV2.headers["x-klarwerk-paket-sha256"]),
    });

    // V3 — eine neue Quellfassung.
    const v3Antwort = await ueberarbeiten(app, admin, id, "Fassung drei des Lerninhalts.");
    const v3Version = v3Antwort.json().version as number;
    expect(v3Version).toBe(v2Version + 1);
    const exportV3 = await paket(app, admin, body);
    expect(exportV3.statusCode).toBe(200);
    const kennungV3 = String(exportV3.headers["x-klarwerk-exportfassung"]);
    expect(kennungV3).not.toBe(kennungV2);
    expect(String(exportV3.headers["content-disposition"])).not.toBe(
      String(exportV2.headers["content-disposition"]),
    );

    const nachweise = await services.audit.list({ action: "output.lms-export" });
    expect(nachweise).toHaveLength(2);
    // Der frühere Nachweis ist Zeichen für Zeichen derselbe — nichts wurde überschrieben.
    expect(nachweise.find((n) => n.target === `lms-export:${kennungV2}`)).toEqual(v2Nachweis);
    expect(nachweise.find((n) => n.target === `lms-export:${kennungV3}`)?.payload).toMatchObject({
      objekte: [{ koId: id, version: v3Version }],
    });

    // Die V2-Fassung des Wissensobjekts bleibt in seiner Versionsliste erhalten.
    const versionen = await app.inject({
      method: "GET",
      url: `/api/kos/${id}/versions`,
      headers: admin,
    });
    expect(versionen.statusCode).toBe(200);
    const nummern = (versionen.json() as { version: number }[]).map((v) => v.version);
    expect(nummern).toContain(v2Version);
    expect(nummern).toContain(v3Version);
  });

  it("K7 · Kontoregel und Empfängerfreigabe: kein Paket, kein Nachweis", async () => {
    const { app, services, admin, carla } = await buehne();
    const id = await validiertesKo(app, admin, carla, "Lernplattform Freigabe");
    const vertraulich = await validiertesKo(
      app,
      admin,
      carla,
      "Lernplattform Geheim",
      "vertraulich",
    );

    const anonym = await paket(app, undefined, {
      koIds: [id],
      sprache: "de",
      empfaenger: "moodle-referenz",
    });
    expect(anonym.statusCode).toBe(401);

    const fremd = await paket(app, admin, {
      koIds: [id],
      sprache: "de",
      empfaenger: "fremdes-lms",
    });
    expect(fremd.statusCode).toBe(422);
    expect(fremd.json().error).toBe("EXPORT_BLOCKED");
    expect(fremd.json().pruefung.befunde).toEqual([
      expect.objectContaining({ code: "RECIPIENT_NOT_ALLOWED", bereich: "empfaenger" }),
    ]);

    const geheim = await paket(app, admin, {
      koIds: [vertraulich],
      sprache: "de",
      empfaenger: "moodle-referenz",
    });
    expect(geheim.statusCode).toBe(422);
    expect(geheim.json().pruefung.befunde.map((b: { code: string }) => b.code)).toContain(
      "CONFIDENTIAL",
    );

    const kaputt = await paket(app, admin, {
      koIds: id,
      sprache: "de",
      empfaenger: "moodle-referenz",
    });
    expect(kaputt.statusCode).toBe(400);
    expect(kaputt.json().error).toBe("BAD_REQUEST");

    expect(await services.audit.list({ action: "output.lms-export" })).toHaveLength(0);
  });
});
