import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "./build-app";

// Berater-Konzept Duplikate 04.07.: Duplikat-Workflow über die ECHTEN HTTP-Routen (kein
// Service-Direktaufruf). Zwei textgleiche Beiträge lösen beim Einreichen die deterministische
// Erkennung aus (≥85 % Textdeckung, OHNE Modell — im Test ist kein Modell verbunden) und erscheinen
// als Überschneidung unter /api/duplicates. Deckt zusätzlich Abschluss (Fehlalarm), Anzeige-Schwelle
// (lesen/setzen, Bedienfehler) und die Rechte-Absicherung ab.
describe("Berater-Konzept Duplikate 04.07.: Duplikat-Workflow (HTTP end-to-end)", () => {
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
    const headers = { authorization: `Bearer ${login.json().token}` };
    return { app, headers };
  }

  async function createKo(
    app: Awaited<ReturnType<typeof adminApp>>["app"],
    headers: Record<string, string>,
    statement: string,
  ): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: { title: "Pumpe entlüften", statement, type: "best_practice", category: "Wartung" },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  it("zwei textgleiche Beiträge → automatischer Überschneidungs-Eintrag (deterministisch, ohne Modell)", async () => {
    const { app, headers } = await adminApp();
    const text = "Nach dem Anfahren 10 Sekunden warten, dann die Pumpe entlüften.";
    // Erster Beitrag: noch kein Kandidat im Bestand → kein Eintrag.
    await createKo(app, headers, text);
    // Zweiter, textgleicher Beitrag → Erkennung greift beim Einreichen.
    await createKo(app, headers, text);

    const list = await app.inject({ method: "GET", url: "/api/duplicates", headers });
    expect(list.statusCode).toBe(200);
    const entries = list.json() as Array<{
      id: string;
      origin: string;
      relation: string;
      detector: { method: string };
    }>;
    expect(entries).toHaveLength(1);
    expect(entries[0]?.origin).toBe("auto");
    expect(entries[0]?.relation).toBe("identisch");
    expect(entries[0]?.detector.method).toBe("deterministic");
  });

  it("Fehlalarm schließt den Eintrag; er fällt aus der offenen Liste", async () => {
    const { app, headers } = await adminApp();
    const text = "Vor dem Abschalten das Ventil vollständig schließen und sichern.";
    await createKo(app, headers, text);
    await createKo(app, headers, text);

    const id = (await app.inject({ method: "GET", url: "/api/duplicates", headers })).json()[0]
      .id as string;

    const dismissed = await app.inject({
      method: "POST",
      url: `/api/duplicates/${id}/dismiss`,
      headers,
      payload: { note: "Kein echtes Duplikat." },
    });
    expect(dismissed.statusCode).toBe(200);
    expect(dismissed.json().status).toBe("geschlossen");
    expect(dismissed.json().resolution.reason).toBe("dismissed");

    const after = await app.inject({ method: "GET", url: "/api/duplicates", headers });
    expect(after.json().some((e: { id: string }) => e.id === id)).toBe(false);
  });

  it("gelöschter Beitrag schließt seine offene Überschneidung (kein Geist)", async () => {
    const { app, headers } = await adminApp();
    const text = "Beim Anfahren zuerst die Kühlung prüfen, dann die Anlage starten.";
    await createKo(app, headers, text);
    const koB = await createKo(app, headers, text);

    // Überschneidung ist da …
    const before = await app.inject({ method: "GET", url: "/api/duplicates", headers });
    expect(before.json()).toHaveLength(1);

    // … einen der beiden Beiträge löschen (Papierkorb) → die Überschneidung wird geordnet geschlossen.
    const del = await app.inject({ method: "DELETE", url: `/api/kos/${koB}`, headers });
    expect(del.statusCode).toBe(204);

    const after = await app.inject({ method: "GET", url: "/api/duplicates", headers });
    expect(after.json()).toHaveLength(0);
  });

  it("Anzeige-Schwelle: Startwert 0,5, Admin setzt sie, Bedienfehler wird abgewiesen", async () => {
    const { app, headers } = await adminApp();

    const get1 = await app.inject({ method: "GET", url: "/api/duplicates/settings", headers });
    expect(get1.statusCode).toBe(200);
    expect(get1.json().minConfidence).toBe(0.5);

    const put = await app.inject({
      method: "PUT",
      url: "/api/duplicates/settings",
      headers,
      payload: { minConfidence: 0.4 },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().minConfidence).toBe(0.4);

    const get2 = await app.inject({ method: "GET", url: "/api/duplicates/settings", headers });
    expect(get2.json().minConfidence).toBe(0.4);

    // Wert außerhalb des Bandes (0,05–0,99) → 400 (Bedienfehler, kein stiller Fallback).
    const bad = await app.inject({
      method: "PUT",
      url: "/api/duplicates/settings",
      headers,
      payload: { minConfidence: 5 },
    });
    expect(bad.statusCode).toBe(400);
  });

  it("erkanntes Duplikat erscheint in der Benachrichtigungs-Glocke (kind = duplicate)", async () => {
    const { app, headers } = await adminApp();
    const text = "Filter monatlich prüfen und bei Bedarf wechseln.";
    await createKo(app, headers, text);
    await createKo(app, headers, text);

    const notifs = await app.inject({ method: "GET", url: "/api/notifications", headers });
    expect(notifs.statusCode).toBe(200);
    expect(notifs.json().some((n: { kind: string }) => n.kind === "duplicate")).toBe(true);
  });

  it("getrennt lassen / verwandt verlinken schließen den Eintrag mit passendem Grund", async () => {
    const text = "Beim Reinigen zuerst den Hauptschalter ausschalten.";

    const kept = await adminApp();
    await createKo(kept.app, kept.headers, text);
    await createKo(kept.app, kept.headers, text);
    const keptId = (
      await kept.app.inject({ method: "GET", url: "/api/duplicates", headers: kept.headers })
    ).json()[0].id as string;
    const keptRes = await kept.app.inject({
      method: "POST",
      url: `/api/duplicates/${keptId}/keep-separate`,
      headers: kept.headers,
      payload: {},
    });
    expect(keptRes.statusCode).toBe(200);
    expect(keptRes.json().resolution.reason).toBe("kept_separate");

    const linked = await adminApp();
    await createKo(linked.app, linked.headers, text);
    await createKo(linked.app, linked.headers, text);
    const linkedId = (
      await linked.app.inject({ method: "GET", url: "/api/duplicates", headers: linked.headers })
    ).json()[0].id as string;
    const linkedRes = await linked.app.inject({
      method: "POST",
      url: `/api/duplicates/${linkedId}/link-related`,
      headers: linked.headers,
      payload: {},
    });
    expect(linkedRes.statusCode).toBe(200);
    expect(linkedRes.json().resolution.reason).toBe("linked_related");
  });

  it("anonym → Duplikatliste und Schwelle sind geschützt (Guard greift)", async () => {
    const app = buildApp(buildServices());
    const list = await app.inject({ method: "GET", url: "/api/duplicates" });
    expect(list.statusCode).toBeGreaterThanOrEqual(400);
    const settings = await app.inject({
      method: "PUT",
      url: "/api/duplicates/settings",
      payload: { minConfidence: 0.4 },
    });
    expect(settings.statusCode).toBeGreaterThanOrEqual(400);
  });
});
