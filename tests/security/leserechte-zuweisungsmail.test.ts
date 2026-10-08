// ================================================================================================
// aufnahme:20260922:gesamt-leserechte · R-0610 — DER E-MAIL-NEBENWEG DER ZUWEISUNG.
// ================================================================================================
//
// DER BEFUND (Ben, Nacharbeit 3): die Zuweisungsmail (`services/app/src/notify.ts`) nannte die
// Objektkennung jedem zugewiesenen Konto, ohne dessen Leserecht zu fragen. Eine Zuweisung erteilt
// nach `darfSehen` aber weder Vertraulichkeits- noch Space-Leserecht — ein Prüfer ausserhalb des
// führenden Spaces erfuhr per E-Mail, dass es das Objekt gibt.
//
// Gemessen wird beides: am ECHTEN Draht (Zuweisung über `PUT /api/kos/:id`, Mail im Sammelpostfach
// des ConsoleMailer) die Stufe, und am Notifier selbst Space und fehlende Schutzabhängigkeit. Jede
// Sperre hat ihre Gegenprobe, dass der berechtigte Empfänger die Mail weiter bekommt.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { makeAssignmentNotifier } from "../../services/app/src/notify";
import { ConsoleMailer } from "../../services/notifications";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

async function login(app: App, email: string): Promise<{ kopf: Auth; id: string }> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "geheim12345" },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  const body = res.json() as { token: string; user: { id: string } };
  return { kopf: { authorization: `Bearer ${body.token}` }, id: body.user.id };
}

describe("R-0610 · die Zuweisungsmail geht nur an Empfänger mit Leserecht", () => {
  it("vertrauliches Objekt: die Prüferin bekommt die Mail, der Experte ohne Leserecht nicht", async () => {
    const services = buildServices();
    const app = buildApp(services);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "admin@mail0610.test", password: "geheim12345" },
    });
    const admin = await login(app, "admin@mail0610.test");
    for (const [email, role] of [
      ["pruefer@mail0610.test", "controller"],
      ["experte@mail0610.test", "experte"],
    ] as const) {
      const res = await app.inject({
        method: "POST",
        url: "/api/users",
        headers: admin.kopf,
        payload: { name: email, email, password: "geheim12345", role },
      });
      expect(res.statusCode, res.body).toBe(201);
    }
    const pruefer = await login(app, "pruefer@mail0610.test");
    const experte = await login(app, "experte@mail0610.test");

    const angelegt = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: admin.kopf,
      payload: {
        confidentiality: "intern",
        title: "Rezeptur nur fuer Pruefende",
        statement: "Kernaussage.",
        type: "best_practice",
        category: "Anlage 1",
      },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const koId = angelegt.json().id as string;
    const stufe = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: admin.kopf,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(stufe.statusCode, stufe.body).toBe(200);

    const postfach = services.mailer as ConsoleMailer;
    const vorher = postfach.sent.length;
    const zuweisen = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: admin.kopf,
      payload: { action: "assign", userIds: [pruefer.id, experte.id] },
    });
    expect(zuweisen.statusCode, zuweisen.body).toBe(204);

    const neu = postfach.sent.slice(vorher);
    // GEGENPROBE: die Prüferin (ko.validate) darf das Objekt sehen — sie bekommt die Mail.
    expect(neu.map((m) => m.to)).toEqual(["pruefer@mail0610.test"]);
    // Der Experte ohne Leserecht bekommt keine Zeile, die die Kennung trägt.
    expect(neu.some((m) => m.to === "experte@mail0610.test")).toBe(false);
    expect(JSON.stringify(neu.filter((m) => m.to !== "pruefer@mail0610.test"))).not.toContain(koId);
    await app.close();
  });
});

// ------------------------------------------------------------------------------------------------
// Der Notifier selbst: Space-Leserecht und fehlende Schutzabhängigkeiten.
// ------------------------------------------------------------------------------------------------
const KONTEN = [
  { id: "u-drin", name: "Drin", email: "drin@space.test", role: "controller" },
  { id: "u-draussen", name: "Draussen", email: "draussen@space.test", role: "controller" },
];
const auth = { listUsers: async () => KONTEN } as never;

describe("R-0610 · der Notifier fragt Rolle, Autorschaft und lesbare Spaces des Empfängers", () => {
  it("ein Objekt im führenden Space erreicht nur, wer den Space lesen darf", async () => {
    const postfach = new ConsoleMailer();
    const notify = makeAssignmentNotifier(auth, postfach, {
      ko: async () => ({ confidentiality: "intern", author: "jemand", spaceId: "S-1" }),
      spaceLesbar: async (user) => new Set(user.id === "u-drin" ? ["S-1"] : []),
    });
    await notify("KO-IM-SPACE", ["u-drin", "u-draussen"]);
    // GEGENPROBE und Sperre in einer Zusicherung: genau die Empfängerin mit Space-Leserecht.
    expect(postfach.sent.map((m) => m.to)).toEqual(["drin@space.test"]);
  });

  it("ein Objekt, das sich nicht auflösen lässt, nennt niemandem seine Kennung", async () => {
    const postfach = new ConsoleMailer();
    const notify = makeAssignmentNotifier(auth, postfach, {
      ko: async () => undefined,
      spaceLesbar: async () => new Set(["S-1"]),
    });
    await notify("KO-WEG", ["u-drin"]);
    expect(postfach.sent).toEqual([]);
  });

  it("ohne Schutzabhängigkeit (ein Aufrufer, den der Compiler nicht sieht) geht nichts hinaus", async () => {
    const postfach = new ConsoleMailer();
    await makeAssignmentNotifier(auth, postfach, undefined as never)("KO-1", ["u-drin"]);
    await makeAssignmentNotifier(auth, postfach, {
      ko: async () => ({ confidentiality: "intern" }),
    } as never)("KO-1", ["u-drin"]);
    expect(postfach.sent).toEqual([]);
  });
});
