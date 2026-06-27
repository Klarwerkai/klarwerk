import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "./build-app";

// SCRUM-238: Import-/Review-Workflow über die ECHTEN HTTP-Routen absichern (kein Service-Direktaufruf,
// keine Repo-Manipulation). Kandidaten erzeugen via POST /api/library/import/candidates (ko.create),
// listen via GET (ko.read), prüfen via PUT …/:id {action} (ko.validate). Accept einer Nicht-Dublette
// erzeugt ein echtes KO (koId gesetzt, Status "offen" im normalen Fluss); Dublette erzeugt keins.
describe("SCRUM-238: Import-/Review-Workflow (HTTP end-to-end)", () => {
  async function login(app: ReturnType<typeof buildApp>, email: string, password: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    return { authorization: `Bearer ${res.json().token}` };
  }

  async function setup() {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const admin = await login(app, "a@x.de", "secret123");
    // Demo-Seed legt Erik (experte, kein ko.validate) für den Review-Guard an.
    await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers: admin });
    const erik = await login(app, "erik@demo.klarwerk", "demo-pass-erik");
    return { app, admin, erik };
  }

  const item = (title: string) => ({
    title,
    statement: `Aussage zu ${title}`,
    type: "best_practice" as const,
    category: "Import",
  });

  const createCandidates = (
    app: ReturnType<typeof buildApp>,
    headers: Record<string, string>,
    items: ReturnType<typeof item>[],
  ) =>
    app.inject({
      method: "POST",
      url: "/api/library/import/candidates",
      headers,
      payload: { items },
    });

  const review = (
    app: ReturnType<typeof buildApp>,
    headers: Record<string, string>,
    id: string,
    action: "accept" | "reject" | "info",
    note?: string,
  ) =>
    app.inject({
      method: "PUT",
      url: `/api/library/import/candidates/${id}`,
      headers,
      payload: note ? { action, note } : { action },
    });

  it("erzeugen → listen → akzeptieren erzeugt echtes KO; Doppel-Review wird abgewiesen", async () => {
    const { app, admin, erik } = await setup();

    // 1) Kandidaten erzeugen (ko.create) → 201, Status "neu", keine Dublette, koId null.
    const created = await createCandidates(app, admin, [item("Alpha 238"), item("Beta 238")]);
    expect(created.statusCode).toBe(201);
    const candidates = created.json();
    expect(candidates).toHaveLength(2);
    expect(candidates[0].status).toBe("neu");
    expect(candidates[0].duplicate).toBe(false);
    expect(candidates[0].koId).toBeNull();
    const candId = candidates[0].id as string;

    // 2) Liste enthält die neuen Kandidaten (ko.read).
    const list = await app.inject({
      method: "GET",
      url: "/api/library/import/candidates",
      headers: admin,
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().some((c: { id: string }) => c.id === candId)).toBe(true);

    // 3) Guard: Erik (experte) darf NICHT prüfen (kein ko.validate).
    const erikReview = await review(app, erik, candId, "accept");
    expect(erikReview.statusCode).toBeGreaterThanOrEqual(400);

    // 4) Annehmen (ko.validate) → Status "angenommen", echtes KO erzeugt (koId gesetzt).
    const accepted = await review(app, admin, candId, "accept");
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().status).toBe("angenommen");
    const koId = accepted.json().koId as string;
    expect(koId).toBeTruthy();

    // 5) Das erzeugte KO existiert im normalen Wissensfluss (Status "offen").
    const ko = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers: admin });
    expect(ko.statusCode).toBe(200);
    expect(ko.json().title).toBe("Alpha 238");
    expect(ko.json().status).toBe("offen");

    // 6) Erneutes Prüfen desselben Kandidaten → abgewiesen (ALREADY_REVIEWED).
    const again = await review(app, admin, candId, "reject");
    expect(again.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("ablehnen und Info-anfragen setzen Status/Note nachvollziehbar, ohne KO zu erzeugen", async () => {
    const { app, admin } = await setup();
    const created = (
      await createCandidates(app, admin, [item("Gamma 238"), item("Delta 238")])
    ).json() as { id: string }[];
    const a = created[0] as { id: string };
    const b = created[1] as { id: string };

    const rejected = await review(app, admin, a.id, "reject");
    expect(rejected.json().status).toBe("abgelehnt");
    expect(rejected.json().koId).toBeNull();

    const info = await review(app, admin, b.id, "info", "Quelle bitte ergänzen.");
    expect(info.json().status).toBe("info-angefragt");
    expect(info.json().note).toBe("Quelle bitte ergänzen.");
  });

  it("Dublette: Annehmen erzeugt KEIN neues KO (koId bleibt null)", async () => {
    const { app, admin } = await setup();
    // Erst ein echtes KO anlegen, dann denselben Inhalt als Kandidat importieren.
    const dup = item("Epsilon 238");
    await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: admin,
      payload: {
        title: dup.title,
        statement: dup.statement,
        type: dup.type,
        category: dup.category,
      },
    });

    const created = (await createCandidates(app, admin, [dup])).json();
    expect(created[0].duplicate).toBe(true);

    const accepted = await review(app, admin, created[0].id, "accept");
    expect(accepted.json().status).toBe("angenommen");
    expect(accepted.json().koId).toBeNull();
  });

  it("Guards/Fehler: anonym abgewiesen, Review auf unbekannten Kandidaten scheitert", async () => {
    const { app, admin } = await setup();

    const anon = await app.inject({
      method: "POST",
      url: "/api/library/import/candidates",
      payload: { items: [item("Zeta 238")] },
    });
    expect(anon.statusCode).toBeGreaterThanOrEqual(400);

    const unknown = await review(app, admin, "does-not-exist", "accept");
    expect(unknown.statusCode).toBeGreaterThanOrEqual(400);
  });
});
