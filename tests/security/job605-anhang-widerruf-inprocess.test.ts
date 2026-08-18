// ================================================================================================
// JOB 605 · D5 — DER WIDERRUF NACH EINEM ERFOLGREICHEN ZUGRIFF
// ================================================================================================
//
// WAS DIESER TEST MISST — und warum es ihn noch nicht gab.
//
// `tests/security/mega74-anhang-vertraulich.test.ts` pinnt bereits, dass ein Betrachter den Anhang
// eines VERTRAULICHEN Objekts nicht bekommt (404), dass Autor und Admin ihn weiterhin bekommen und
// dass ein interner Anhang erreichbar bleibt. Das ist der STATISCHE Zustand: Dort ist das Objekt
// bereits hochgestuft, BEVOR es zum ersten Mal abgerufen wird (`koMitAnhang(..., true)` stuft im
// Aufbau hoch).
//
// UNGEDECKT WAR DER ÜBERGANG: erst ein erfolgreicher Abruf, DANN die Hochstufung, dann erneut. Das
// ist ein anderer Fall, und der Unterschied ist nicht akademisch. Eine Umsetzung, die das
// Berechtigungsurteil je Objekt einmal bildet und behält, besteht den statischen Test und fällt
// beim Übergang durch. Genau das ist die Frage, die JOB 605 stellt: Wird ein einmal gewährter
// Zugang WIDERRUFEN?
//
// ================================================================================================
// WAS DIESER TEST AUSDRÜCKLICH NICHT MISST.
// ================================================================================================
//
// **Keinen einzigen Cache-Wert.** Das Vollurteil zu D4 hält zwei Ownerfragen offen — O2 (welches
// maximale Widerrufsfenster gilt) und O3 (welche Baukette den Cachevertrag trägt) — und verbietet
// bis zu ihrer Entscheidung ausdrücklich jeden Productwrite auf den kollidierenden Cachezeilen
// (`object-routes.ts:84-85, :228`). Dieser Test hält deshalb ausschliesslich den STATUS fest.
// Würde er `max-age=300` oder `no-cache` festnageln, nähme er Pedi die Entscheidung ab. Er tut es
// nicht, und er wird durch keine der drei Optionen rot.
//
// **Und keinen Browser.** Auflage 3 des Urteils verlangt Viewer-Fixture und B1–B5 gemountet — aber
// ausdrücklich „nach der Ownerwahl". Diese Datei ist die IN-PROCESS-Schicht darunter: dieselbe
// Zusage am selben Draht, ohne den Browserlauf vorwegzunehmen, den das Urteil terminiert hat.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function login(app: App, email: string, password: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return { authorization: `Bearer ${res.json().token}` };
}

async function setup() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@job605d5.test", password: "geheim12345" },
  });
  const admin = await login(app, "admin@job605d5.test", "geheim12345");
  for (const [email, role] of [
    ["viewer@job605d5.test", "viewer"],
    ["autor@job605d5.test", "experte"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: email, email, password: "geheim12345", role },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Konto ${email} nicht angelegt: ${res.statusCode} ${res.body}`);
    }
  }
  return {
    app,
    admin,
    autor: await login(app, "autor@job605d5.test", "geheim12345"),
    viewer: await login(app, "viewer@job605d5.test", "geheim12345"),
  };
}

/** Legt ein INTERNES KO mit Anhang an — bewusst ohne Hochstufung; die kommt erst im Fall selbst. */
async function koMitAnhang(app: App, autor: Auth): Promise<{ koId: string; objectId: string }> {
  const up = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers: autor,
    payload: { name: "typenschild.png", mime: "image/png", data: PNG_DATA_URL },
  });
  if (up.statusCode !== 201) {
    throw new Error(`Objekt nicht angelegt: ${up.statusCode} ${up.body}`);
  }
  const objectId = up.json().id as string;
  const ko = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: autor,
    payload: {
      title: "Typenschild Anlage 4",
      statement: "Das Typenschild sitzt hinter der Wartungsklappe.",
      type: "best_practice",
      category: "Instandhaltung",
      author: "autor@job605d5.test",
    },
  });
  if (ko.statusCode !== 201) {
    throw new Error(`KO nicht angelegt: ${ko.statusCode} ${ko.body}`);
  }
  const koId = ko.json().id as string;
  const attach = await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers: autor,
    payload: {
      action: "attach",
      attachment: { name: "typenschild.png", mime: "image/png", objectId },
    },
  });
  if (attach.statusCode !== 200) {
    throw new Error(`Anhang nicht gebunden: ${attach.statusCode} ${attach.body}`);
  }
  return { koId, objectId };
}

const roh = (app: App, objectId: string, auth: Auth) =>
  app.inject({ method: "GET", url: `/api/objects/${objectId}/raw`, headers: auth });

describe("JOB605 D5 · der Widerruf greift nach einem bereits erfolgreichen Zugriff", () => {
  it("W1: Betrachter holt den Anhang (200) → Hochstufung → derselbe Abruf ist 404", async () => {
    const { app, autor, viewer } = await setup();
    const { koId, objectId } = await koMitAnhang(app, autor);

    // VORHER: Der Zugang besteht wirklich. Ohne diese Zeile misst der Fall nur, dass etwas 404 ist
    // — und das wäre auch bei einem kaputten Anhangsweg wahr.
    const vorher = await roh(app, objectId, viewer);
    expect(vorher.statusCode, `Vorzustand. Antwort: ${vorher.statusCode}`).toBe(200);

    const hoch = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: autor,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(hoch.statusCode, hoch.body).toBe(200);

    const nachher = await roh(app, objectId, viewer);
    // GENAU EIN STATUS. Das Urteil zu D4 hat die frühere Alternative „404 oder 200 no-store" als
    // Verwechslung zweier Nutzer entlarvt: für den Betrachter ist die Hochstufung ein Rechteentzug.
    expect(nachher.statusCode, `Widerruf. Antwort: ${nachher.statusCode}`).toBe(404);
    expect(nachher.statusCode).not.toBe(403);
  });

  it("W2: GEGENPROBE — für den Admin ist dieselbe Hochstufung KEIN Rechteentzug", async () => {
    const { app, admin, autor } = await setup();
    const { koId, objectId } = await koMitAnhang(app, autor);
    expect((await roh(app, objectId, admin)).statusCode).toBe(200);

    await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: autor,
      payload: { action: "confidentiality", level: "vertraulich" },
    });

    // Ohne diesen Fall wäre W1 auch dann grün, wenn die Hochstufung den Anhang für ALLE sperrt.
    // Dann wäre es kein Rechteentzug, sondern ein Totalausfall — und die Zusage eine andere.
    const nachher = await roh(app, objectId, admin);
    expect(nachher.statusCode, `Admin nach Hochstufung. Antwort: ${nachher.statusCode}`).toBe(200);
  });

  it("W3: Löschung des Wissensobjekts widerruft den Anhang ebenso", async () => {
    const { app, autor, viewer } = await setup();
    const { koId, objectId } = await koMitAnhang(app, autor);
    expect((await roh(app, objectId, viewer)).statusCode).toBe(200);

    const weg = await app.inject({ method: "DELETE", url: `/api/kos/${koId}`, headers: autor });
    expect(weg.statusCode, weg.body).toBeLessThan(300);

    expect((await roh(app, objectId, viewer)).statusCode).toBe(404);
  });

  it("W4: KALIBRIERUNG — ohne jede Änderung bleibt derselbe Abruf 200", async () => {
    const { app, autor, viewer } = await setup();
    const { objectId } = await koMitAnhang(app, autor);
    // Ohne diese Kalibrierung wären W1 und W3 auch dann grün, wenn der Anhangsweg insgesamt nach
    // dem ersten Abruf zusammenbricht.
    expect((await roh(app, objectId, viewer)).statusCode).toBe(200);
    expect((await roh(app, objectId, viewer)).statusCode).toBe(200);
  });

  it("W5: unsichtbar und unbekannt sind am Draht NICHT unterscheidbar", async () => {
    const { app, autor, viewer } = await setup();
    const { koId, objectId } = await koMitAnhang(app, autor);
    await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: autor,
      payload: { action: "confidentiality", level: "vertraulich" },
    });

    const unsichtbar = await roh(app, objectId, viewer);
    const unbekannt = await roh(app, "gibt-es-nicht-0000", viewer);
    expect(unsichtbar.statusCode).toBe(404);
    expect(unbekannt.statusCode).toBe(404);
    // Ein unterschiedlicher Rumpf verriete, DASS es das Objekt gibt — die Existenz allein ist schon
    // eine Auskunft über vertrauliches Wissen.
    expect(unsichtbar.body).toBe(unbekannt.body);
  });
});
