import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "./build-app";

// SCRUM-243: Capture → KO → Attachment/Evidence über die ECHTEN HTTP-Routen absichern
// (kein Service-Direktaufruf, keine Repo-Manipulation). KO via POST /api/kos (ko.create);
// Original via POST /api/objects (→ ObjectRef) + raw über GET /api/objects/:id/raw; Anhängen
// via PUT /api/kos/:id {action:"attach"/"add-source"}. Evidence-Records (kind source/attachment)
// werden vom KO-Service erzeugt (InMemoryEvidenceRepo) und über GET /api/kos/:id/evidence sichtbar.
const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("SCRUM-243: Capture/KO/Attachment/Evidence (HTTP end-to-end)", () => {
  async function adminApp() {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a@x.de", password: "secret123" },
    });
    return { app, headers: { authorization: `Bearer ${login.json().token}` } };
  }

  async function createKo(app: ReturnType<typeof buildApp>, headers: Record<string, string>) {
    return app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Lager L3 schmieren",
        statement: "Lager L3 alle 200h schmieren.",
        type: "best_practice",
        category: "Wartung",
      },
    });
  }

  it("KO-Erstellung liefert erwartete Basisfelder", async () => {
    const { app, headers } = await adminApp();
    const res = await createKo(app, headers);
    expect(res.statusCode).toBe(201);
    const ko = res.json();
    expect(ko.id).toBeTruthy();
    expect(ko.title).toBe("Lager L3 schmieren");
    expect(ko.statement).toBe("Lager L3 alle 200h schmieren.");
    expect(ko.type).toBe("best_practice");
    expect(ko.category).toBe("Wartung");
    expect(ko.status).toBe("offen");
    expect(ko.trust).toBe(0);
    expect(ko.version).toBe(1);
    expect(ko.author).toBeTruthy();
  });

  it("Object-Upload → raw abrufbar; Attach mit objectId erzeugt Attachment-Evidence", async () => {
    const { app, headers } = await adminApp();
    const koId = (await createKo(app, headers)).json().id as string;

    // 1) Original in den Object-Store legen → ObjectRef (nur Metadaten).
    const put = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers,
      payload: { name: "skizze.png", mime: "image/png", data: PNG_DATA_URL },
    });
    expect(put.statusCode).toBe(201);
    const ref = put.json();
    expect(ref.id).toBeTruthy();
    expect(ref.mime).toBe("image/png");
    const objectId = ref.id as string;

    // 2) Rohbytes sind über /raw abrufbar (Content-Type aus der Ref).
    const raw = await app.inject({ method: "GET", url: `/api/objects/${objectId}/raw`, headers });
    expect(raw.statusCode).toBe(200);
    expect(raw.headers["content-type"]).toContain("image/png");

    // 3) Object als Anhang ans KO referenzieren (objectId, kein Inline-Datenblob).
    const attach = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers,
      payload: {
        action: "attach",
        attachment: { name: "skizze.png", mime: "image/png", objectId },
      },
    });
    expect(attach.statusCode).toBe(200);
    const att = attach
      .json()
      .attachments.find((a: { objectId?: string }) => a.objectId === objectId);
    expect(att).toBeTruthy();

    // 4) Evidence (kind "attachment") ist über die Route sichtbar und verweist auf das Objekt.
    const ev = await app.inject({ method: "GET", url: `/api/kos/${koId}/evidence`, headers });
    expect(ev.statusCode).toBe(200);
    const record = ev
      .json()
      .find((e: { kind: string; objectId?: string }) => e.kind === "attachment");
    expect(record).toBeTruthy();
    expect(record.objectId).toBe(objectId);
    expect(record.label).toBe("skizze.png");
  });

  it("add-source erzeugt Source-Evidence (kind source) mit Label/URL", async () => {
    const { app, headers } = await adminApp();
    const koId = (await createKo(app, headers)).json().id as string;

    // AUFTRAG-mega15 Block B (bens SB-4): dieser Test pinnte bis mega14, dass ein vom CLIENT
    // geliefertes `provider` bis in die Evidenz durchschlägt — genau die Vertrauensbeziehung, die
    // SB-4 aufgehoben hat. Der Server liest das Feld nicht mehr; die Herkunft leitet er aus der
    // Adresse ab (services/external-search/src/provenance.ts). Eine eigene Unterlage auf
    // example.org ist kein Provider-Treffer und bekommt deshalb KEINEN Herkunftsvermerk — auch
    // dann nicht, wenn der Client einen behauptet. Die Stufen-Sperre selbst liegt in
    // tests/app/external-attach-gate-e2e.test.ts.
    //
    // AUFTRAG-mega16 Block A: seit die Stufe eine echte, fail-closed Grenze ist, wird JEDE Quelle
    // mit öffentlicher Web-Adresse auf der VORGABE-Stufe (search_on_click) abgewiesen — auch diese
    // hier, die mit dem Gate gar nichts zu tun hat. Dieser Test handelt von der EVIDENZ, also wird
    // die Stufe ausdrücklich auf „anhängen erlaubt" gestellt, statt den Vertrag aufzuweichen.
    const stage = await app.inject({
      method: "PUT",
      url: "/api/external/policy",
      headers,
      payload: { stage: "search_attach" },
    });
    expect(stage.statusCode).toBe(200);
    const add = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers,
      payload: {
        action: "add-source",
        source: {
          label: "Wartungshandbuch S. 12",
          url: "https://example.org/handbuch",
          excerpt: "Schmierintervall 200h",
          provider: "Intern",
        },
      },
    });
    expect(add.statusCode).toBe(200);
    const source = add
      .json()
      .sources.find((s: { label: string }) => s.label === "Wartungshandbuch S. 12");
    expect(source).toBeTruthy();
    expect(source.kind).toBe("external");
    expect(source.peerValidated).toBe(false);
    expect(source.provider ?? null).toBeNull();

    const ev = await app.inject({ method: "GET", url: `/api/kos/${koId}/evidence`, headers });
    const record = ev.json().find((e: { kind: string }) => e.kind === "source");
    expect(record).toBeTruthy();
    expect(record.label).toBe("Wartungshandbuch S. 12");
    expect(record.url).toBe("https://example.org/handbuch");
    expect(record.provider).toBeNull();
  });

  it("die Herkunft in der Evidenz stammt vom Server, nicht aus der Nutzlast (SB-4)", async () => {
    const { app, headers } = await adminApp();
    const koId = (await createKo(app, headers)).json().id as string;
    const stage = await app.inject({
      method: "PUT",
      url: "/api/external/policy",
      headers,
      payload: { stage: "search_attach" },
    });
    expect(stage.statusCode).toBe(200);

    const add = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers,
      payload: {
        action: "add-source",
        source: {
          label: "Dichtung (Technik)",
          url: "https://de.wikipedia.org/wiki/Dichtung_(Technik)",
          excerpt: "Eine Dichtung verhindert …",
          // Bewusst FALSCH behauptet — der Server überschreibt es mit dem, was er ableiten kann.
          provider: "Werksarchiv",
        },
      },
    });
    expect(add.statusCode).toBe(200);
    const ev = await app.inject({ method: "GET", url: `/api/kos/${koId}/evidence`, headers });
    const record = ev.json().find((e: { kind: string }) => e.kind === "source");
    expect(record.provider).toBe("Wikipedia");
  });

  it("Guards/Fehler: anonym abgewiesen; add-source ohne Label und unbekanntes Objekt scheitern", async () => {
    const { app, headers } = await adminApp();
    const koId = (await createKo(app, headers)).json().id as string;

    // anonym: KO anlegen, Objekt hochladen, raw abrufen → je ≥400.
    expect((await createKo(app, {})).statusCode).toBeGreaterThanOrEqual(400);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/objects",
          payload: { name: "x.png", mime: "image/png", data: PNG_DATA_URL },
        })
      ).statusCode,
    ).toBeGreaterThanOrEqual(400);
    expect(
      (await app.inject({ method: "GET", url: "/api/objects/does-not-exist/raw" })).statusCode,
    ).toBeGreaterThanOrEqual(400);

    // add-source ohne Label → 400 (badRequest).
    const noLabel = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers,
      payload: { action: "add-source", source: { label: "  " } },
    });
    expect(noLabel.statusCode).toBe(400);

    // unbekanntes Objekt (auth) → 404.
    const unknown = await app.inject({
      method: "GET",
      url: "/api/objects/does-not-exist/raw",
      headers,
    });
    expect(unknown.statusCode).toBe(404);
  });
});
