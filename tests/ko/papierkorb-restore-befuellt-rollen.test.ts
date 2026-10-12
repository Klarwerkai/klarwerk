// ==================================================================================================
// AUFNAHME 20260922 · gesamt-papierkorb — DER BEFÜLLTE MEHRROLLENWEG AM DRAHT.
// ==================================================================================================
//
// package:papierkorb nennt als nicht belegte Abschlussfälle: vollständiger Mehrrollenweg,
// Wiederherstellung befüllter Anhänge/Quellen/Beziehungen und Rechteentzug vor Restore („Nach
// Rechteentzug darf Restore keine entzogenen Rechte wiederbeleben"). Bens Befund (Nacharbeit 2):
// fallgleiche vorhandene Belege zuordnen, nur die Lücke schließen.
//
// ZUGEORDNET, NICHT WIEDERHOLT: `tests/security/g26-matrix-laufzeit.test.ts` R2/R3 (Betrachter
// ohne `users.manage`: restore/trash-delete abgelehnt, Objekt unverändert) und
// `tests/ko/trash-e2e.test.ts` (Experte 403 auf Liste/Restore/Endlöschung, Version und Historie).
// HIER NEU, in einem Lauf über die echte Komposition:
//   · ein Objekt mit Anhang, Quelle und Beziehung — Kennung, Inhalt, Version und alle drei
//     Verknüpfungen nach dem Wiederherstellen Feld für Feld gegen den Vorzustand,
//   · Autor (Experte) löscht, Betrachter und Autor scheitern am Wiederherstellen, ein ZURÜCKGESTUFTER
//     Admin scheitert an Wiederherstellen und Endlöschung, der Admin stellt her,
//   · eine VOR dem Löschen entzogene Lesesicht (Hochstufung auf „vertraulich") lebt durch das
//     Wiederherstellen nicht wieder auf — weder für das Objekt noch für seinen Anhang.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const PASSWORT = "geheim12345";

async function login(app: App, email: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: PASSWORT },
  });
  expect(res.statusCode, `Anmeldung ${email}: ${res.body}`).toBe(200);
  return { authorization: `Bearer ${res.json().token}` };
}

async function aufbau() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@papierkorb.test", password: PASSWORT },
  });
  const admin = await login(app, "admin@papierkorb.test");
  for (const [email, role] of [
    ["autor@papierkorb.test", "experte"],
    ["leser@papierkorb.test", "viewer"],
    ["zweitadmin@papierkorb.test", "admin"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: email, email, password: PASSWORT, role },
    });
    expect(res.statusCode, `Konto ${email}: ${res.body}`).toBe(201);
  }
  return {
    app,
    admin,
    autor: await login(app, "autor@papierkorb.test"),
    leser: await login(app, "leser@papierkorb.test"),
    zweitadmin: await login(app, "zweitadmin@papierkorb.test"),
  };
}

async function neuesKo(app: App, autor: Auth, title: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: autor,
    payload: {
      confidentiality: "intern",
      title,
      statement: `${title}: Angaben stehen hinter der Wartungsklappe.`,
      bodyHtml: `<p>${title} — Klappe mit Vierkant öffnen, dann ablesen.</p>`,
      type: "best_practice",
      category: "Instandhaltung",
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

const lies = (app: App, id: string, auth: Auth) =>
  app.inject({ method: "GET", url: `/api/kos/${id}`, headers: auth });
const roh = (app: App, objectId: string, auth: Auth) =>
  app.inject({ method: "GET", url: `/api/objects/${objectId}/raw`, headers: auth });
async function imPapierkorb(app: App, admin: Auth): Promise<string[]> {
  const res = await app.inject({ method: "GET", url: "/api/kos/trash", headers: admin });
  return (res.json() as { id: string }[]).map((e) => e.id);
}

async function kantenZahl(app: App, id: string, auth: Auth): Promise<number> {
  const res = await app.inject({
    method: "GET",
    url: `/api/kos/${id}/beziehungen`,
    headers: auth,
  });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as { total: number }).total;
}

async function loesche(app: App, id: string, auth: Auth) {
  return app.inject({
    method: "DELETE",
    url: `/api/kos/${id}`,
    headers: auth,
  });
}

/** Was nach dem Wiederherstellen Feld für Feld wieder dastehen muss. */
function abdruck(ko: Record<string, unknown>) {
  const anhaenge = (ko.attachments ?? []) as { objectId?: string; name?: string }[];
  const quellen = (ko.sources ?? []) as { objectId?: string; label?: string }[];
  return {
    id: ko.id,
    title: ko.title,
    statement: ko.statement,
    bodyHtml: ko.bodyHtml,
    version: ko.version,
    confidentiality: ko.confidentiality,
    author: ko.author,
    anhaenge: anhaenge.map((a) => [a.objectId, a.name]),
    quellen: quellen.map((q) => [q.objectId, q.label]),
  };
}

describe("gesamt-papierkorb · befüllter Mehrrollenweg mit Rechteentzug (Wissensobjekt)", () => {
  it("M1 · Anhang, Quelle und Beziehung kommen mit Kennung, Inhalt und Version zurück; nur der berechtigte Admin stellt her", async () => {
    const { app, admin, autor, leser, zweitadmin } = await aufbau();

    // ── Befüllter Vorzustand ────────────────────────────────────────────────────────────────
    const up = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers: autor,
      payload: { name: "typenschild.png", mime: "image/png", data: PNG_DATA_URL },
    });
    expect(up.statusCode, up.body).toBe(201);
    const objectId = up.json().id as string;
    const id = await neuesKo(app, autor, "Typenschild Anlage 4");
    const ziel = await neuesKo(app, autor, "Wartungsklappe Anlage 4");
    for (const payload of [
      {
        action: "attach",
        attachment: { name: "typenschild.png", mime: "image/png", objectId },
      },
      { action: "add-source", source: { label: "Prüfbericht Typenschild", objectId } },
    ]) {
      const res = await app.inject({
        method: "PUT",
        url: `/api/kos/${id}`,
        headers: autor,
        payload,
      });
      expect(res.statusCode, `${payload.action}: ${res.body}`).toBe(200);
    }
    const quelleVersion = (await lies(app, id, admin)).json().version as number;
    const zielVersion = (await lies(app, ziel, admin)).json().version as number;
    const beziehung = await app.inject({
      method: "POST",
      url: `/api/kos/${id}/beziehungen`,
      headers: admin,
      payload: {
        zielId: ziel,
        art: "ergaenzt",
        richtung: "ungerichtet",
        beitragSchluessel: "papierkorb-m1",
        gesehen: { quelleVersion, zielVersion },
      },
    });
    expect(beziehung.statusCode, beziehung.body).toBe(201);

    const vorher = abdruck((await lies(app, id, admin)).json());
    expect(vorher.anhaenge, "Vorzustand ohne Anhang misst nichts").toEqual([
      [objectId, "typenschild.png"],
    ]);
    expect(vorher.quellen, "Vorzustand ohne Quelle misst nichts").toEqual([
      [objectId, "Prüfbericht Typenschild"],
    ]);
    const kantenVorher = await kantenZahl(app, id, admin);
    expect(kantenVorher).toBe(1);

    // ── Autor (Experte) löscht ─────────────────────────────────────────────────────────────
    const geloescht = await loesche(app, id, autor);
    expect(geloescht.statusCode, geloescht.body).toBe(204);
    expect(await imPapierkorb(app, admin)).toContain(id);

    // ── Unberechtigte: Leser, Autor ────────────────────────────────────────────────────────
    for (const [wer, auth] of [
      ["Leser", leser],
      ["Autor", autor],
    ] as const) {
      const versuch = await app.inject({
        method: "POST",
        url: `/api/kos/${id}/restore`,
        headers: auth,
      });
      expect([403, 404], `${wer} darf nicht wiederherstellen: ${versuch.statusCode}`).toContain(
        versuch.statusCode,
      );
    }

    // ── Rechteentzug: der zweite Admin wird Experte — Wiederherstellen UND Endlöschung zu ──
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: zweitadmin });
    const zweitadminId = me.json().id as string;
    const herab = await app.inject({
      method: "PUT",
      url: `/api/users/${zweitadminId}`,
      headers: admin,
      payload: { role: "experte" },
    });
    expect([200, 204], `Rückstufung: ${herab.body}`).toContain(herab.statusCode);
    const entzogen = await login(app, "zweitadmin@papierkorb.test");
    for (const [was, anfrage] of [
      ["restore", { method: "POST" as const, url: `/api/kos/${id}/restore` }],
      ["trash-delete", { method: "DELETE" as const, url: `/api/kos/trash/${id}` }],
    ] as const) {
      const versuch = await app.inject({ ...anfrage, headers: entzogen });
      expect([403, 404], `${was} nach Rechteentzug: ${versuch.statusCode}`).toContain(
        versuch.statusCode,
      );
    }
    expect(await imPapierkorb(app, admin), "der Entzogene hat trotzdem gewirkt").toContain(id);

    // ── Der berechtigte Admin stellt her ───────────────────────────────────────────────────
    const zurueck = await app.inject({
      method: "POST",
      url: `/api/kos/${id}/restore`,
      headers: admin,
    });
    expect(zurueck.statusCode, zurueck.body).toBe(200);
    expect(await imPapierkorb(app, admin)).not.toContain(id);

    const nachher = abdruck((await lies(app, id, admin)).json());
    expect(nachher).toEqual(vorher);
    expect(await kantenZahl(app, id, admin)).toBe(kantenVorher);
    expect((await roh(app, objectId, admin)).statusCode).toBe(200);
    // Das interne Objekt ist für den Leser wieder da — wie vor dem Löschen.
    expect((await lies(app, id, leser)).statusCode).toBe(200);
  });

  it("M2 · eine vor dem Löschen entzogene Lesesicht lebt durch das Wiederherstellen nicht wieder auf", async () => {
    const { app, admin, autor, leser } = await aufbau();
    const up = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers: autor,
      payload: { name: "schaltplan.png", mime: "image/png", data: PNG_DATA_URL },
    });
    expect(up.statusCode, up.body).toBe(201);
    const objectId = up.json().id as string;
    const id = await neuesKo(app, autor, "Schaltplan Anlage 4");
    const angehaengt = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: autor,
      payload: {
        action: "attach",
        attachment: { name: "schaltplan.png", mime: "image/png", objectId },
      },
    });
    expect(angehaengt.statusCode, angehaengt.body).toBe(200);

    // Vorzustand: der Leser darf lesen — sonst wäre der Entzug unten nichts.
    expect((await lies(app, id, leser)).statusCode).toBe(200);
    expect((await roh(app, objectId, leser)).statusCode).toBe(200);

    // Rechteentzug: Hochstufung auf „vertraulich".
    const hoch = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: autor,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(hoch.statusCode, hoch.body).toBe(200);
    expect((await lies(app, id, leser)).statusCode).toBe(404);

    // Löschen und Wiederherstellen.
    expect((await loesche(app, id, autor)).statusCode).toBe(204);
    const zurueck = await app.inject({
      method: "POST",
      url: `/api/kos/${id}/restore`,
      headers: admin,
    });
    expect(zurueck.statusCode, zurueck.body).toBe(200);

    // Der Entzug gilt weiter — für das Objekt und für seinen Anhang.
    expect((await lies(app, id, admin)).json().confidentiality).toBe("vertraulich");
    expect((await lies(app, id, leser)).statusCode).toBe(404);
    expect((await roh(app, objectId, leser)).statusCode).toBe(404);
    // Gegenprobe: der Admin sieht beides.
    expect((await lies(app, id, admin)).statusCode).toBe(200);
    expect((await roh(app, objectId, admin)).statusCode).toBe(200);
  });
});
