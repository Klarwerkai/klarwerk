// ================================================================================================
// AUFTRAG-mega78 BLOCK B — IST `openGaps` DER SIEBTE EXAKTE AUSKUNFTSZÄHLER?
// ================================================================================================
//
// DIE FRAGE. Der Management-Snapshot gibt `overview.openGaps` aus dem VOLLSTÄNDIGEN Lückenbestand
// heraus (services/management/src/service.ts:55). Die sechs KO-Aggregate daneben filtern seit
// mega76 an der Grundmenge. Verrät dieser Zähler etwas, das der Betrachter sonst nicht bekäme?
//
// DIE MESSUNG, und sie beantwortet die Frage negativ. Wissenslücken haben KEINE
// Existenz-Sichtbarkeitsregel — sie haben eine FREITEXT-Redaktion (`redactGapForViewer`,
// ask/src/gap-visibility.ts:38). Existenz, Status, Priorität und Zeitpunkt jeder Lücke gehen
// AUSDRÜCKLICH an jeden `ko.read`-Inhaber, und `/api/gaps/summary` liefert denselben exakten
// Offen-Zähler an dieselbe Rolle (ask-routes.ts:236, `summarizeGaps`). Der Management-Snapshot
// verlangt genau dieses eine Recht (management-routes.ts:13).
//
// Der Zähler ist damit kein siebter Leckpfad, sondern eine ZWEITE AUSGABE derselben, bewusst
// öffentlichen Zahl. Ihn nur hier zu filtern oder zu entfernen wäre Theater, solange
// `/api/gaps/summary` und `/api/gaps` unverändert danebenstehen — und die drei zusammen zu
// schliessen ist eine PRODUKTENTSCHEIDUNG über die Sichtbarkeit von Lücken, keine Bauaufgabe
// (der Auftrag sagt es selbst: „Erfinde keine Schwelle").
//
// WAS DIESER TEST DESHALB IST: ein WÄCHTER über die Gleichheit. Er hält fest, dass die drei
// Auskünfte über offene Lücken heute EINE Zahl sind. Wer eine davon künftig adressatenbezogen
// filtert, ohne die anderen mitzunehmen, wird hier rot — und muss die Entscheidung dann für alle
// drei treffen statt für eine.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

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

async function setup(marke: string) {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: `admin@${marke}.test`, password: "geheim12345" },
  });
  const admin = await login(app, `admin@${marke}.test`, "geheim12345");
  for (const [email, role] of [
    [`frager@${marke}.test`, "experte"],
    [`viewer@${marke}.test`, "viewer"],
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
    frager: await login(app, `frager@${marke}.test`, "geheim12345"),
    viewer: await login(app, `viewer@${marke}.test`, "geheim12345"),
  };
}

/**
 * Eine offene Wissenslücke entsteht aus einer unbeantworteten Frage — der Fragetext ist reiner
 * Nutzer-Freitext ohne Vertraulichkeitsstufe, genau der Fall aus der Redaktionsbegründung.
 */
async function offeneLuecke(app: App, wer: Auth, frage: string): Promise<void> {
  const res = await app.inject({
    method: "POST",
    url: "/api/ask",
    headers: wer,
    payload: { question: frage },
  });
  expect(res.statusCode, `Frage abgesetzt? ${res.body}`).toBe(200);
}

describe("mega78 B · der Offen-Zähler der Wissenslücken ist EINE Zahl an drei Ausgängen", () => {
  it("die kleinste aussagekräftige Zelle: n = 1, und der Betrachter bekommt sie ohnehin", async () => {
    const { app, frager, viewer } = await setup("mega78b1");
    await offeneLuecke(
      app,
      frager,
      "Wie ist die Anzugsreihenfolge an der Kesselflanschverbindung?",
    );

    const summary = await app.inject({
      method: "GET",
      url: "/api/gaps/summary",
      headers: viewer,
    });
    expect(summary.statusCode, `Der Zusammenfassungs-Endpunkt. ${summary.body}`).toBe(200);
    const offenLautSummary = summary.json().open as number;
    expect(
      offenLautSummary,
      "VORBEDINGUNG: genau eine offene Lücke — die Zelle, in der ein Zähler am meisten verrät",
    ).toBe(1);

    const snapshot = await app.inject({
      method: "GET",
      url: "/api/management/snapshot",
      headers: viewer,
    });
    expect(snapshot.statusCode, `Der Management-Snapshot. ${snapshot.body}`).toBe(200);
    expect(
      snapshot.json().overview.openGaps,
      `DER BEFUND: der Snapshot-Zähler ist DIESELBE Zahl, die /api/gaps/summary demselben
      Betrachter mit demselben Recht (ko.read) bereits nennt. Er verrät nichts Zusätzliches —
      er wiederholt eine bewusst öffentliche Auskunft.`,
    ).toBe(offenLautSummary);
  });

  it("die Existenz einer Lücke ist öffentlich, ihr FREITEXT nicht — das ist die geltende Regel", async () => {
    const { app, frager, viewer } = await setup("mega78b2");
    const frage = "Welche Sonderfreigabe gilt für den Lieferanten mit dem Preisnachlass?";
    await offeneLuecke(app, frager, frage);

    const liste = await app.inject({ method: "GET", url: "/api/gaps", headers: viewer });
    expect(liste.statusCode, liste.body).toBe(200);
    const gaps = liste.json() as { status: string; question: string; redacted?: boolean }[];
    expect(
      gaps,
      "die Liste nennt die Lücke — Existenz und Status sind nicht geschützt",
    ).toHaveLength(1);
    expect(gaps[0]?.status).toBe("offen");
    expect(
      gaps[0]?.redacted,
      "geschützt ist der Fragetext (FUNKE-FIX2 P0), nicht die Tatsache, dass es die Lücke gibt",
    ).toBe(true);
    expect(gaps[0]?.question, "kein Freitext an den Unberechtigten").toBe("");

    // Der Wächter-Schluss: solange die Existenz öffentlich ist, ist ihre Anzahl es auch. Ein
    // adressatenbezogener Zähler an EINER der drei Stellen wäre inkonsistent, kein Schutz.
    const snapshot = await app.inject({
      method: "GET",
      url: "/api/management/snapshot",
      headers: viewer,
    });
    expect(snapshot.json().overview.openGaps).toBe(1);
  });
});
