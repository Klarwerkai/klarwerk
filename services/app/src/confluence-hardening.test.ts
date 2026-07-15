import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "./build-app";

// SCRUM-470 (ben-Review-Härtung) über die ECHTEN HTTP-Routen:
//  #1 — Herkunfts-/Vertrauensanker (`sources`) dürfen NUR über den Import-Pfad gesetzt werden; auf den
//       öffentlichen Schreibpfaden (create, revise, capture-promote) werden Client-`sources` verworfen.
//  #2 — Ungültige Review-Aktion → 400, KEIN KO-Write (statt still als Accept behandelt).

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

// Ein gefälschter, „peer-validierter" Herkunfts-Anker, wie ihn ein Client mitschicken könnte.
const forgedSources = [
  {
    id: "forged-1",
    label: "Gefälschte Quelle",
    kind: "external",
    peerValidated: true,
    externalId: "forged-page-42",
    spaceKey: "HACK",
    sourceVersion: 99,
    provider: "Confluence",
  },
];

describe("SCRUM-470 (#1): Client-sources werden auf öffentlichen Schreibpfaden verworfen", () => {
  it("create: sources aus dem Body landen NICHT am KO", async () => {
    const { app, headers } = await adminApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Handbuch",
        statement: "Inhalt.",
        type: "best_practice",
        category: "Doku",
        sources: forgedSources,
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().sources).toEqual([]);
  });

  it("revise: sources aus den changes werden ignoriert (Bestand bleibt leer)", async () => {
    const { app, headers } = await adminApp();
    const created = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: { title: "Handbuch", statement: "Inhalt.", type: "best_practice", category: "Doku" },
    });
    const id = created.json().id as string;
    const revised = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "revise", changes: { statement: "Neuer Inhalt.", sources: forgedSources } },
    });
    expect(revised.statusCode).toBe(200);
    expect(revised.json().statement).toBe("Neuer Inhalt."); // Revise selbst wirkt
    expect(revised.json().sources).toEqual([]); // aber der Anker wurde NICHT gesetzt
  });

  it("capture-promote: sources aus dem Draft-Payload landen NICHT am KO", async () => {
    const { app, headers } = await adminApp();
    const draft = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: {
        title: "Aus Entwurf",
        statement: "Entwurfsinhalt.",
        type: "best_practice",
        category: "Doku",
        sources: forgedSources,
      },
    });
    const draftId = draft.json().id as string;
    const promoted = await app.inject({
      method: "POST",
      url: `/api/drafts/${draftId}/promote`,
      headers,
      payload: {},
    });
    expect(promoted.statusCode).toBe(201);
    expect(promoted.json().sources).toEqual([]);
  });
});

describe("SCRUM-470 (#2): ungültige Review-Aktion → 400, kein KO-Write", () => {
  it('action "foo" wird abgewiesen, der Kandidat bleibt „neu" (kein KO erzeugt)', async () => {
    const { app, headers } = await adminApp();
    const created = await app.inject({
      method: "POST",
      url: "/api/library/import/candidates",
      headers,
      payload: {
        items: [
          { title: "Kandidat A", statement: "Aussage A.", type: "best_practice", category: "Import" },
        ],
      },
    });
    const candId = created.json()[0].id as string;

    const bad = await app.inject({
      method: "PUT",
      url: `/api/library/import/candidates/${candId}`,
      headers,
      payload: { action: "foo" },
    });
    expect(bad.statusCode).toBe(400);

    // Kandidat unverändert „neu", kein KO angelegt.
    const list = await app.inject({
      method: "GET",
      url: "/api/library/import/candidates",
      headers,
    });
    const cand = (list.json() as { id: string; status: string; koId: string | null }[]).find(
      (c) => c.id === candId,
    );
    expect(cand?.status).toBe("neu");
    expect(cand?.koId).toBeNull();

    // Gegenprobe: eine gültige Aktion greift danach normal.
    const ok = await app.inject({
      method: "PUT",
      url: `/api/library/import/candidates/${candId}`,
      headers,
      payload: { action: "accept" },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().status).toBe("angenommen");
  });
});
