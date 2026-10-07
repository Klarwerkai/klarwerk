import { describe, expect, it } from "vitest";
import type { AuditEntry as WebAuditEntry } from "../../apps/web/src/api/types";
import { returnedToAuthor } from "../../apps/web/src/lib/validationStatus";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// ================================================================================================
// AUTORENÜBERGABE-AUFTRAG, K3 (Ben, Nacharbeit 1) — DIE ZÄHLQUELLE DER ZURÜCKGEGEBENEN ENTWÜRFE.
// ================================================================================================
//
// Der Befund: Die Aufgabenseite führt einen eigenen zurückgegebenen Entwurf (`MyTasks.tsx`,
// `returnedToAuthor(audit, kos, user.id)`), der Kopfband-Zähler nicht: Liste=1, Badge=0.
// `GET /api/me/returned-tasks/summary` ist die textfreie Quelle, aus der der Zähler die Zahl jetzt
// holt. Diese Datei misst am HTTP-Rand, dass die Route dieselbe Regel rechnet wie die Liste:
//   · eigener sichtbarer zurückgegebener Entwurf ⇒ 1, leerer Bestand ⇒ 0,
//   · fremder Entwurf oder ein Entwurf im Papierkorb zählt für mich nicht,
//   · nach `ko.revised` gilt die frühere Rückgabe als abgearbeitet,
//   · die Antwort trägt nur die Zahl, keinen Titel, keine Kennung, keinen Protokollinhalt,
//   · GLEICHHEIT: die Zahl ist die Länge dessen, was die Liste aus `GET /api/kos` und dem
//     Protokoll mit derselben Funktion errechnet.
describe("K3: GET /api/me/returned-tasks/summary zählt, was die Aufgabenliste zeigt", () => {
  async function setup() {
    const services = buildServices();
    const app = buildApp(services);
    // Die erste Registrierung ist der Admin; Anna und Bert legt er als Expertinnen an.
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Ada Admin", email: "ada@x.de", password: "secret123" },
    });
    const adaLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "ada@x.de", password: "secret123" },
    });
    const ada = { authorization: `Bearer ${adaLogin.json().token}` };
    const konto = async (name: string, email: string) => {
      await app.inject({
        method: "POST",
        url: "/api/users",
        headers: ada,
        payload: { name, email, password: "secret123", role: "experte" },
      });
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email, password: "secret123" },
      });
      return {
        headers: { authorization: `Bearer ${login.json().token}` },
        id: login.json().user.id as string,
      };
    };
    const anna = await konto("Anna Autorin", "anna@x.de");
    const bert = await konto("Bert Autor", "bert@x.de");
    const entwurf = (author: string, title: string) =>
      services.ko.create({
        title,
        statement: "Bei Überdruck Ventil X schließen.",
        type: "best_practice",
        category: "Anlage 1",
        author,
        tags: [],
      });
    const zaehler = async (headers: Record<string, string>) =>
      app.inject({ method: "GET", url: "/api/me/returned-tasks/summary", headers });
    return { app, services, anna, bert, entwurf, zaehler };
  }

  it("leerer Bestand ⇒ 0; ein eigener zurückgegebener Entwurf ⇒ 1, nur als Zahl", async () => {
    const { services, anna, entwurf, zaehler } = await setup();
    const leer = await zaehler(anna.headers);
    expect(leer.statusCode).toBe(200);
    expect(leer.json()).toEqual({ open: 0 });

    const ko = await entwurf(anna.id, "Annas vertraulicher Titel");
    // Gelb-Feedback ohne benannte Eigentümerin: Rückgabe an die Autorin (`ko.returned-to-author`).
    await services.validation.rate(ko.id, "pruefer", "warn");
    const rueckgabe = { action: "ko.returned-to-author", target: ko.id };
    expect(await services.audit.list(rueckgabe)).toHaveLength(1);

    const eins = await zaehler(anna.headers);
    expect(eins.json(), "Liste=1, Badge=0: die Rückgabe fehlt im Zähler").toEqual({ open: 1 });
    // Textfrei: kein Titel, keine Kennung, kein Protokollinhalt.
    expect(eins.body).not.toContain("Annas vertraulicher Titel");
    expect(eins.body).not.toContain(ko.id);
    expect(Object.keys(eins.json())).toEqual(["open"]);
  });

  it("ein FREMDER zurückgegebener Entwurf zählt nur bei seiner Autorin", async () => {
    const { services, anna, bert, entwurf, zaehler } = await setup();
    const fremd = await entwurf(bert.id, "Berts Entwurf");
    await services.validation.rate(fremd.id, "pruefer", "warn");
    expect((await zaehler(anna.headers)).json()).toEqual({ open: 0 });
    expect((await zaehler(bert.headers)).json()).toEqual({ open: 1 });
  });

  it("nach der Überarbeitung (`ko.revised`) gilt die Rückgabe als abgearbeitet ⇒ 0", async () => {
    const { services, anna, entwurf, zaehler } = await setup();
    const ko = await entwurf(anna.id, "Annas Entwurf");
    await services.validation.rate(ko.id, "pruefer", "warn");
    expect((await zaehler(anna.headers)).json()).toEqual({ open: 1 });
    await services.ko.revise(ko.id, { statement: "Überarbeitet." }, anna.id);
    expect((await zaehler(anna.headers)).json()).toEqual({ open: 0 });
  });

  it("ein Entwurf, den die Liste nicht mehr sieht (Papierkorb), zählt nicht", async () => {
    const { services, anna, entwurf, zaehler } = await setup();
    const ko = await entwurf(anna.id, "Annas Entwurf");
    await services.validation.rate(ko.id, "pruefer", "warn");
    await services.ko.delete(ko.id, anna.id);
    expect((await zaehler(anna.headers)).json()).toEqual({ open: 0 });
  });

  it("GLEICHHEIT: Zahl der Route = Länge der Liste aus `GET /api/kos` und dem Protokoll", async () => {
    const { app, services, anna, bert, entwurf, zaehler } = await setup();
    const a1 = await entwurf(anna.id, "Anna 1");
    const a2 = await entwurf(anna.id, "Anna 2");
    const a3 = await entwurf(anna.id, "Anna 3");
    const b1 = await entwurf(bert.id, "Bert 1");
    for (const ko of [a1, a2, a3, b1]) {
      await services.validation.rate(ko.id, "pruefer", "warn");
    }
    // a3 ist abgearbeitet; a1 und a2 liegen weiter bei Anna, b1 bei Bert.
    await services.ko.revise(a3.id, { statement: "Überarbeitet." }, anna.id);

    // Was die Seite für Anna rechnet: ihre sichtbaren Objekte aus `GET /api/kos`, das Protokoll und
    // dieselbe Funktion. Das Protokoll wird hier über den Dienst gelesen; die Seite liest es über
    // `GET /api/audit`, das dieselben Einträge ungefiltert ausgibt.
    const kosAntwort = await app.inject({ method: "GET", url: "/api/kos", headers: anna.headers });
    const kos = kosAntwort.json() as { id: string; author: string }[];
    const protokoll = (await services.audit.list()) as unknown as WebAuditEntry[];
    const liste = returnedToAuthor(protokoll, kos, anna.id);
    expect(liste.map((r) => r.koId).sort()).toEqual([a1.id, a2.id].sort());

    expect((await zaehler(anna.headers)).json()).toEqual({ open: liste.length });
  });

  it("ohne Anmeldung: 401 — der Zähler ist nie offen", async () => {
    const { app } = await setup();
    const res = await app.inject({ method: "GET", url: "/api/me/returned-tasks/summary" });
    expect(res.statusCode).toBe(401);
  });
});
