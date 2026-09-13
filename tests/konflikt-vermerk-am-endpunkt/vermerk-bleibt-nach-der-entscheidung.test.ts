// JOB 3888 — „GELÖSCHT WIRD NICHTS" AN DER ECHTEN HTTP-GRENZE.
//
// Der geprüfte Satz: `apps/web/src/i18n.ts:5043-5044` (`help.konflikte.body`) — „Deine Wahl wird
// als Vermerk festgehalten, gelöscht wird nichts". Er besteht aus zwei Hälften, und die Fläche
// zeigt nur die erste: das entschiedene Paar verschwindet.
//   · Hälfte 1 „aus der Liste weg": `GET /api/conflicts` (conflicts-routes.ts:222-238) liest über
//     `conflicts.unresolved()` (:227), das `status === "geloest"` hart wegfiltert
//     (services/conflicts/src/service.ts:549-566). Gemessen in H2/H4.
//   · Hälfte 2 „trotzdem da": `GET /api/conflicts/:id` (conflicts-routes.ts:240-258) liest über
//     `conflicts.get()` (:245), das einen gelösten Befund ohne Versionsfilter zurückgibt
//     (service.ts:579-593, früher Zweig :582). Gemessen in H3/H4.
// Entschieden wird über `POST /api/conflicts/:id/dismiss` (conflicts-routes.ts:274-289) und —
// BEFUND: in conflicts-routes.ts gibt es KEINEN Entscheidungsweg — über den KO-Dispatcher
// `PUT /api/kos/:id` mit `action: "resolve-conflict"` (services/app/src/routes/ko-routes.ts:2421-2431).
//
// WARUM DER BESTANDSTEST DIE FRAGE NICHT BEANTWORTET: `tests/pruefseite/entscheidungswege-mounted.test.tsx:196`
// (Fall K1) mountet die Seite gegen ein `vi.mock` auf `apps/web/src/api/endpoints`. Hinter dem Mock
// läuft weder Route noch Dienst; gemessen wird nur, welcher Client-Weg gerufen wird.
//
// GRENZE: In-Memory-Ablage (`buildServices()`), keine Postgres-Messung, keine Oberfläche.
import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { Conflict } from "../../services/conflicts";

// Abweichung vom übernommenen Aufbau (tests/conflicts/manual-conflict-author.test.ts:2): der
// `Conflict`-Typ kommt hier aus dem DIENST, nicht aus `apps/web/src/api/types`. Grund: der
// Web-Typ (types.ts:567-582) kennt `resolutionReason` nicht, und genau dieses Feld unterscheidet
// „Fehlalarm" von „entschieden". Anmeldung, Bearer-Kopf und KO-Anlageweg sind unverändert
// übernommen (dort :21-52).
describe("JOB 3888: der entschiedene Konflikt fällt aus der Liste und bleibt im Einzelabruf", () => {
  type App = ReturnType<typeof buildApp>;
  type Kopf = Record<string, string>;

  async function umgebung() {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "admin@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@x.de", password: "secret123" },
    });
    const headers = { authorization: `Bearer ${login.json().token}` };
    return { app, headers, adminId: login.json().user.id as string };
  }

  async function neuesKo(app: App, headers: Kopf, titel: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        confidentiality: "intern",
        title: titel,
        statement: `${titel} — Aussage.`,
        type: "best_practice",
        category: "Anlage 3",
        neededValidations: 1,
      },
    });
    return (res.json() as KnowledgeObject).id;
  }

  /** Legt ein Paar an und darüber einen Wahrheitskonflikt — der Weg der Fläche, nicht der Dienst. */
  async function neuerKonflikt(app: App, headers: Kopf, marke: string) {
    const koA = await neuesKo(app, headers, `${marke} A`);
    const koB = await neuesKo(app, headers, `${marke} B`);
    const res = await app.inject({
      method: "PUT",
      url: `/api/kos/${koA}`,
      headers,
      payload: {
        action: "conflict",
        conflict: {
          koA,
          koB,
          type: "truth",
          description: `${marke}: die Angaben widersprechen sich.`,
        },
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json() as Conflict;
  }

  async function liste(app: App, headers: Kopf): Promise<Conflict[]> {
    const res = await app.inject({ method: "GET", url: "/api/conflicts", headers });
    expect(res.statusCode).toBe(200);
    return res.json() as Conflict[];
  }

  // H1 — Der Fehlalarm kommt am Endpunkt an: nicht der Client-Aufruf, sondern die Antwort des
  // echten Dienstes hinter der echten Route (service.ts:153-165).
  it("H1: dismiss am Endpunkt schreibt Entscheider, Freitext und Grund in den Befund", async () => {
    const { app, headers, adminId } = await umgebung();
    const konflikt = await neuerKonflikt(app, headers, "H1");

    const verworfen = await app.inject({
      method: "POST",
      url: `/api/conflicts/${konflikt.id}/dismiss`,
      headers,
      payload: { note: "Fehlalarm: andere Anlage" },
    });

    expect(verworfen.statusCode).toBe(200);
    const körper = verworfen.json() as Conflict;
    expect(körper.status).toBe("geloest");
    expect(körper.decidedBy).toBe(adminId);
    expect(körper.decision).toBe("Fehlalarm: andere Anlage");
    expect(körper.resolutionReason).toBe("dismissed");
  });

  // H2 — Die erste Hälfte des Hilfesatzes: das Paar verschwindet von der Fläche. Der Fall misst
  // ZUERST, dass die Kennung in der Liste stand — sonst belegte er nur eine ohnehin leere Liste.
  it("H2: nach dem dismiss ist das Paar aus GET /api/conflicts verschwunden — vorher stand es drin", async () => {
    const { app, headers } = await umgebung();
    const konflikt = await neuerKonflikt(app, headers, "H2");

    const vorher = await liste(app, headers);
    expect(vorher.map((c) => c.id)).toContain(konflikt.id);

    const verworfen = await app.inject({
      method: "POST",
      url: `/api/conflicts/${konflikt.id}/dismiss`,
      headers,
      payload: { note: "Fehlalarm: andere Anlage" },
    });
    expect(verworfen.statusCode).toBe(200);

    const nachher = await liste(app, headers);
    expect(nachher.map((c) => c.id)).not.toContain(konflikt.id);
  });

  // H3 — DIE ZWEITE HÄLFTE, und die tragende Aussage dieser Datei. `help.konflikte.body`
  // (apps/web/src/i18n.ts:5043-5044) sagt wörtlich: „Deine Wahl wird als Vermerk festgehalten,
  // gelöscht wird nichts". H2 belegt „festgehalten … und von der Fläche genommen"; dieser Fall
  // belegt „gelöscht wird nichts" — der Einzelabruf antwortet 200 und trägt den Vermerk, nicht 404.
  it("H3: derselbe Befund ist über GET /api/conflicts/:id weiter abrufbar — mit seinem Vermerk", async () => {
    const { app, headers, adminId } = await umgebung();
    const konflikt = await neuerKonflikt(app, headers, "H3");
    await app.inject({
      method: "POST",
      url: `/api/conflicts/${konflikt.id}/dismiss`,
      headers,
      payload: { note: "Fehlalarm: andere Anlage" },
    });

    const einzeln = await app.inject({
      method: "GET",
      url: `/api/conflicts/${konflikt.id}`,
      headers,
    });

    expect(einzeln.statusCode).toBe(200);
    const körper = einzeln.json() as Conflict;
    expect(körper.decidedBy).toBe(adminId);
    expect(körper.decision).toBe("Fehlalarm: andere Anlage");
    expect(körper.resolutionReason).toBe("dismissed");
  });

  // H4 — Dasselbe für die ENTSCHEIDUNG, nicht nur für den Fehlalarm. Der Weg dorthin ist der
  // KO-Dispatcher `PUT /api/kos/:id` mit `action: "resolve-conflict"` (ko-routes.ts:2421-2431);
  // in conflicts-routes.ts steht er nicht (dort nur escalate :260, dismiss :274, second-opinion :291).
  it("H4: der entschiedene Konflikt verhält sich gleich — weg aus der Liste, da im Einzelabruf", async () => {
    const { app, headers, adminId } = await umgebung();
    const konflikt = await neuerKonflikt(app, headers, "H4");
    expect((await liste(app, headers)).map((c) => c.id)).toContain(konflikt.id);

    const entschieden = await app.inject({
      method: "PUT",
      url: `/api/kos/${konflikt.koA}`,
      headers,
      payload: {
        action: "resolve-conflict",
        conflictId: konflikt.id,
        decision: "Aussage A gilt; B galt nur für die alte Baureihe.",
      },
    });
    expect(entschieden.statusCode).toBe(200);

    expect((await liste(app, headers)).map((c) => c.id)).not.toContain(konflikt.id);

    const einzeln = await app.inject({
      method: "GET",
      url: `/api/conflicts/${konflikt.id}`,
      headers,
    });
    expect(einzeln.statusCode).toBe(200);
    const körper = einzeln.json() as Conflict;
    expect(körper.status).toBe("geloest");
    expect(körper.decidedBy).toBe(adminId);
    expect(körper.decision).toBe("Aussage A gilt; B galt nur für die alte Baureihe.");
    expect(körper.resolutionReason).toBe("decided");
  });

  // H5 — DIE HERKUNFTSLÜCKE, festgenagelt, nicht bewertet. Die Oberfläche bietet „Fehlalarm" nur
  // bei automatisch erkannten Konflikten an: `apps/web/src/lib/conflictBoard.ts:43-45`
  // (`canDismiss` verlangt `origin === "auto"`). Der Endpunkt kennt diese Bedingung nicht — er
  // prüft allein das Recht `conflict.resolve` (conflicts-routes.ts:277). Ein von Hand angelegter
  // Konflikt ist über HTTP also verwerfbar. Der Fall hält den IST-Zustand fest und verlangt keine
  // Richtung; welche Seite recht hat, entscheidet Pedi.
  it("H5: ein origin=manual-Konflikt wird vom Endpunkt trotzdem mit 200 verworfen", async () => {
    const { app, headers } = await umgebung();
    const konflikt = await neuerKonflikt(app, headers, "H5");
    expect(konflikt.origin).toBe("manual");

    const verworfen = await app.inject({
      method: "POST",
      url: `/api/conflicts/${konflikt.id}/dismiss`,
      headers,
      payload: { note: "Fehlalarm: andere Anlage" },
    });

    expect(verworfen.statusCode).toBe(200);
    expect((verworfen.json() as Conflict).resolutionReason).toBe("dismissed");
  });

  // H6 — Ohne Berechtigung entsteht kein Vermerk, auch kein halber. Der gemessene Wert ist 401
  // (services/app/src/http.ts:178, fehlender Bearer-Kopf), nicht geraten.
  it("H6: dismiss ohne Bearer-Kopf wird abgewiesen und lässt den Befund unverändert offen", async () => {
    const { app, headers } = await umgebung();
    const konflikt = await neuerKonflikt(app, headers, "H6");

    const abgewiesen = await app.inject({
      method: "POST",
      url: `/api/conflicts/${konflikt.id}/dismiss`,
      payload: { note: "Fehlalarm: andere Anlage" },
    });
    expect(abgewiesen.statusCode).toBe(401);

    const einzeln = await app.inject({
      method: "GET",
      url: `/api/conflicts/${konflikt.id}`,
      headers,
    });
    expect(einzeln.statusCode).toBe(200);
    const körper = einzeln.json() as Conflict;
    expect(körper.status).toBe("offen");
    expect(körper.decidedBy).toBeNull();
    expect(körper.decision).toBeNull();
    expect(körper.resolutionReason).toBeUndefined();
    // Und er steht weiterhin auf der Fläche — der abgewiesene Aufruf hat nichts halb geschrieben.
    expect((await liste(app, headers)).map((c) => c.id)).toContain(konflikt.id);
  });
});
