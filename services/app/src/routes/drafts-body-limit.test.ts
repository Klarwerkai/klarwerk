import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../build-app";
import { DRAFTS_BODY_LIMIT, DRAFT_BODY_TOO_LARGE } from "./capture-routes";

// WP-D1c: POST/PUT /api/drafts tragen einen dokument-tauglichen bodyLimit (DRAFTS_BODY_LIMIT, 5 MiB)
// statt des globalen 1-MiB-Fastify-Defaults — ein bildreicher Entwurf (viele komprimierte Inline-Bilder)
// wird NICHT mehr mit 413 abgewiesen.

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

// ~2 MiB bodyHtml — unter dem globalen 1-MiB-Default NICHT möglich, unter DRAFTS_BODY_LIMIT problemlos.
function bigBodyHtml(): string {
  const img = `<img src="data:image/jpeg;base64,${"Q".repeat(200_000)}">`;
  return `<h2>Handbuch</h2>${img.repeat(10)}`;
}

describe("WP-D1d: /api/drafts akzeptiert dokument-große Bodies (5-MiB-Ceiling)", () => {
  it("Ceiling = 5 MiB (klein, aber deutlich über 1 MiB)", () => {
    expect(DRAFTS_BODY_LIMIT).toBe(5 * 1024 * 1024);
  });

  it("anonymer POST mit Body → 401 (Auth VOR Body-Parsing)", async () => {
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "POST",
      url: "/api/drafts",
      payload: {
        title: "Anon",
        statement: "x",
        type: "best_practice",
        category: "Allgemein",
        bodyHtml: bigBodyHtml(),
        origin: "frontdoor",
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /api/drafts mit ~2 MiB bodyHtml → 201 (kein 413)", async () => {
    const { app, headers } = await adminApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: {
        title: "Wartungshandbuch",
        statement: "Handbuch mit vielen Diagrammen.",
        type: "best_practice",
        category: "Allgemein",
        bodyHtml: bigBodyHtml(),
        origin: "frontdoor",
      },
    });
    expect(res.statusCode).toBe(201);
  });

  it("PUT /api/drafts/:id mit großem bodyHtml → 200 (derselbe Cap greift)", async () => {
    const { app, headers } = await adminApp();
    const created = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: {
        title: "Entwurf",
        statement: "Kurz.",
        type: "best_practice",
        category: "Allgemein",
        origin: "frontdoor",
      },
    });
    expect(created.statusCode).toBe(201);
    const put = await app.inject({
      method: "PUT",
      url: `/api/drafts/${created.json().id}`,
      headers,
      payload: {
        title: "Entwurf",
        statement: "Kurz.",
        type: "best_practice",
        category: "Allgemein",
        bodyHtml: bigBodyHtml(),
        origin: "frontdoor",
      },
    });
    expect(put.statusCode).toBe(200);
  });
});

// ================================================================================================
// JOB 511 · D1 — DIE 413-ANTWORT SAGT DIE WAHRHEIT ÜBER DEN VERLUST.
// ================================================================================================
//
// DER BEFUND (JOB 506 · R5, von BEN bestätigt): Oberhalb des Caps endet der Ganzdokument-Import in
// Fastifys GENERISCHER 413-Antwort (FST_ERR_CTP_BODY_TOO_LARGE / "Payload Too Large"). Die sagt
// weder, dass KEIN Entwurf entstanden ist, noch dass die BILDÜBERNAHME nicht abgeschlossen wurde.
// Genau das ist der Serveranteil des unbelegten Versprechens „nichts geht still verloren": der
// Aufrufer kann aus der Antwort nicht entscheiden, ob er wiederholen, verkleinern oder aufgeben
// muss — und eine Oberfläche kann daraus keinen ehrlichen Verlustzustand bauen.
//
// GEPRÜFT WIRD DER SERVERANTEIL, NICHT DIE OBERFLÄCHE: Statuscode, maschinenlesbare Felder,
// Stabilität der Feldmenge (kein Rohstack, keine Zusatzfelder), der Create-Zähler bei 413 und die
// Unversehrtheit der Nachbarverträge (401 vor dem Parsen, 400 bei Formfehler, 201 klein/gültig).
function payloadMitGenauerGroesse(bytes: number): string {
  const grundgeruest = {
    title: "Wartungshandbuch",
    statement: "Ganzes Dokument aus Word.",
    type: "best_practice",
    category: "Allgemein",
    origin: "frontdoor",
    bodyHtml: "",
  };
  // Reines ASCII → Zeichenlänge == Bytelänge; die Füllung trifft die Zielgröße exakt.
  const leer = JSON.stringify(grundgeruest).length;
  return JSON.stringify({ ...grundgeruest, bodyHtml: "Q".repeat(bytes - leer) });
}

async function adminAppMitCreateZaehler() {
  const services = buildServices();
  // JOB 2697 (Pin mitgezogen, siehe Rückgabe D7): Der Zähler hing an `createDraft`. Seit JOB 2697
  // ruft `POST /api/drafts` den Anlageweg über `createDraftVorgang` — dieselbe Anlage, ein
  // Parameter mehr (die optionale Vorgangskennung) und ein Feld mehr in der Antwort (`angelegt`,
  // aus dem die Route 201 oder 200 macht). `createDraft` DELEGIERT jetzt dorthin; ein Zähler am
  // alten Namen sähe deshalb null Aufrufe, obwohl genau einer stattfand.
  //
  // WAS DIESER PIN MISST, IST UNVERÄNDERT: dass ein gültiger kleiner Rumpf GENAU EINEN
  // Anlagevorgang auslöst — und ein zu grosser keinen.
  const echterCreate = services.capture.createDraftVorgang.bind(services.capture);
  let createAufrufe = 0;
  services.capture.createDraftVorgang = async (
    payload: Parameters<typeof echterCreate>[0],
    author: Parameters<typeof echterCreate>[1],
    vorgangsId?: Parameters<typeof echterCreate>[2],
  ) => {
    createAufrufe += 1;
    return echterCreate(payload, author, vorgangsId);
  };
  const app = buildApp(services);
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
  return {
    app,
    headers: {
      authorization: `Bearer ${login.json().token}`,
      "content-type": "application/json",
    },
    createAufrufe: () => createAufrufe,
  };
}

describe("JOB 511 D1 · 413 mit Verlustwahrheit", () => {
  it("uebergross und angemeldet: 413, eigener Code, Verlustfelder", async () => {
    const { app, headers } = await adminAppMitCreateZaehler();
    const res = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: payloadMitGenauerGroesse(DRAFTS_BODY_LIMIT + 1024),
    });
    expect(res.statusCode).toBe(413);
    expect(res.headers["content-type"]).toContain("application/json");
    const body = res.json();
    expect(body.error).toBe(DRAFT_BODY_TOO_LARGE);
    expect(body.draftCreated).toBe(false);
    expect(body.imageTransfer).toBe("not_completed");
    expect(typeof body.message).toBe("string");
    expect(body.message.length).toBeGreaterThan(20);
    expect(body.message).not.toContain(DRAFT_BODY_TOO_LARGE);
    expect(Object.keys(body).sort()).toEqual(["draftCreated", "error", "imageTransfer", "message"]);
    expect(res.body).not.toContain("FST_ERR");
  });

  it("bei 413 bleibt der Create-Zaehler null und es existiert kein Entwurf", async () => {
    const { app, headers, createAufrufe } = await adminAppMitCreateZaehler();
    const res = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: payloadMitGenauerGroesse(DRAFTS_BODY_LIMIT + 1024),
    });
    expect(res.statusCode).toBe(413);
    expect(createAufrufe()).toBe(0);
    const liste = await app.inject({ method: "GET", url: "/api/drafts", headers });
    expect(liste.statusCode).toBe(200);
    expect(liste.json()).toEqual([]);
  });

  it("gueltig klein bleibt 201 und erzeugt genau einen Entwurf", async () => {
    const { app, headers, createAufrufe } = await adminAppMitCreateZaehler();
    const res = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: JSON.stringify({
        title: "Kurznotiz",
        statement: "Kurz.",
        type: "best_practice",
        category: "Allgemein",
        origin: "frontdoor",
      }),
    });
    expect(res.statusCode).toBe(201);
    expect(createAufrufe()).toBe(1);
    const liste = await app.inject({ method: "GET", url: "/api/drafts", headers });
    expect(liste.json()).toHaveLength(1);
  });

  it("exakt unter der Grenze: kein 413, die Kante verschiebt sich nicht", async () => {
    const { app, headers } = await adminAppMitCreateZaehler();
    const res = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: payloadMitGenauerGroesse(DRAFTS_BODY_LIMIT - 1024),
    });
    expect(res.statusCode).toBe(201);
  });

  it("nicht angemeldet und uebergross: 401 vor dem Parsen, ohne Groesseninformation", async () => {
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: { "content-type": "application/json" },
      payload: payloadMitGenauerGroesse(DRAFTS_BODY_LIMIT + 1024),
    });
    expect(res.statusCode).toBe(401);
    expect(res.body).not.toContain(String(DRAFTS_BODY_LIMIT));
    expect(res.body).not.toContain(DRAFT_BODY_TOO_LARGE);
    expect(res.body).not.toContain("imageTransfer");
    expect(Object.keys(res.json()).sort()).toEqual(["error", "message"]);
  });

  it("malformt klein bleibt der unveraenderte 400-Formfehler", async () => {
    const { app, headers } = await adminAppMitCreateZaehler();
    const res = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: "{ kaputt",
    });
    expect(res.statusCode).toBe(400);
    expect(res.body).not.toContain(DRAFT_BODY_TOO_LARGE);
    expect(res.body).not.toContain("imageTransfer");
  });
});
