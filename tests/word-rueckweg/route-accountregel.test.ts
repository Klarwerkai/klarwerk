// ================================================================================================
// JOB 3667 · WORD-RÜCKWEG — PEDIS ACCOUNTREGEL AM SERVER, NICHT IN DER OBERFLÄCHE.
// ================================================================================================
//
// PEDIS WORTLAUT (`gespraech/UEBERGABE-20260911-ABSCHLUSS/AKTEN/SICHTBARES-GESPRAECH.jsonl:693`):
//
//   „Es kommt dabei aber darauf an, wer angemeldet ist. Hat er die Freigabe gleich das als geprüft
//    zu hinterlegen Oder muss es noch geprüft werden? … Dass sie aber auch sagen kann, dies muss
//    nochmal von jemand anders überprüft werden"
//
// WARUM DIESE DATEI EXISTIERT — die vier Befunde der Prüfung von Runde 1, jeder mit seinem Fall:
//
//  1. DIE PFLICHTPRÜFUNG WAR SERVERSEITIG NICHT DURCHGESETZT. Runde 1 hat den Einreichweg nur im
//     Word-Fenster gebaut; derselbe `experte` konnte die Route direkt rufen und den freigegebenen
//     Text per `revise` ersetzen. Eine Regel, die ein Aufruf mit curl aushebelt, ist keine Regel.
//     → B1 (abgewiesen, Inhalt unverändert) und B1b (die Regel ist ENG: ein nicht freigegebenes
//       Objekt bearbeitet der Experte weiter wie bisher).
//  2. DIE FREIWILLIGE PRÜFUNG WAR KEINE FREMDE. Jeder Admin konnte jeden Vorschlag freigeben, auch
//     seinen eigenen. → B4.
//  3. DIE FREIGABE HING NICHT AN DER GEPRÜFTEN FASSUNG. Zwei Aufrufe (`revise`, dann
//     `admin-validate`) mit einer Spanne dazwischen. → B7: die Freigabe IST der Schreibvorgang,
//     und mit einem veralteten Stand passiert GAR NICHTS — weder Fassung noch Freigabe.
//  4. VORSCHLÄGE HATTEN KEINEN ENTSCHIEDENEN ZUSTAND (sie lagen als Kommentar). → B5 (zweimal
//     entscheiden geht nicht) und B6 (die Ablehnung ist ein Zustand, mit Begründung).
//
// GEMESSEN WIRD AN DER ECHTEN ROUTE: echtes Login, echte Rollen über `POST /api/users`, echter PUT.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Antwort = Awaited<ReturnType<App["inject"]>>;
type Kopf = Record<string, string>;

interface Vorschlag {
  id: string;
  author: string;
  baseVersion: number;
  statement: string;
  status: string;
  origin?: string;
  decidedBy?: string;
  decidedAt?: string;
  resultVersion?: number;
  note?: string;
}

async function flaeche(): Promise<{ app: App; admin: Kopf }> {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@klarwerk.test", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@klarwerk.test", password: "secret123" },
  });
  return { app, admin: { authorization: `Bearer ${(login.json() as { token: string }).token}` } };
}

/**
 * Ein ZWEITES Konto mit einer gewählten Rolle — über den Weg des Produkts (`POST /api/users`:
 * anlegen, freischalten, Rolle). Eine von Hand gesetzte Rolle im Speicher würde einen Zustand
 * messen, den die Anwendung so nie erzeugt.
 */
async function konto(app: App, admin: Kopf, rolle: string, email: string): Promise<Kopf> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin,
    payload: { name: `Konto ${rolle}`, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  expect((angelegt.json() as { role: string }).role).toBe(rolle);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
}

async function anlegen(app: App, headers: Kopf): Promise<{ id: string; version: number }> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      confidentiality: "intern",
      title: "Ventil X schließt bei Überdruck",
      statement: "Bei Überdruck Ventil X manuell schließen.",
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(angelegt.statusCode).toBe(201);
  return angelegt.json() as { id: string; version: number };
}

/** Ein FREIGEGEBENES Objekt — der Zustand, den Pedis Regel schützt. */
async function freigegebenesObjekt(app: App, admin: Kopf): Promise<string> {
  const angelegt = await anlegen(app, admin);
  const frei = await app.inject({
    method: "PUT",
    url: `/api/kos/${angelegt.id}`,
    headers: admin,
    payload: { action: "admin-validate" },
  });
  expect(frei.statusCode).toBe(200);
  return angelegt.id;
}

function put(
  app: App,
  headers: Kopf,
  id: string,
  payload: Record<string, unknown>,
): Promise<Antwort> {
  return app.inject({ method: "PUT", url: `/api/kos/${id}`, headers, payload });
}

async function stand(
  app: App,
  headers: Kopf,
  id: string,
): Promise<{ version: number; status: string; statement: string; proposals?: Vorschlag[] }> {
  const antwort = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers });
  expect(antwort.statusCode).toBe(200);
  return antwort.json() as {
    version: number;
    status: string;
    statement: string;
    proposals?: Vorschlag[];
  };
}

async function einreichen(
  app: App,
  headers: Kopf,
  id: string,
  text: string,
  baseVersion: number,
): Promise<Antwort> {
  return put(app, headers, id, {
    action: "propose",
    proposal: { statement: text, baseVersion, origin: "word_addin" },
  });
}

describe("JOB 3667 · Fall 2: wer nicht freigeben darf, ersetzt den freigegebenen Stand NICHT", () => {
  it("B1: der `experte` bekommt an einem freigegebenen Objekt 403 — und der Text steht unverändert da", async () => {
    const { app, admin } = await flaeche();
    const id = await freigegebenesObjekt(app, admin);
    const experte = await konto(app, admin, "experte", "experte@klarwerk.test");

    const versuch = await put(app, experte, id, {
      action: "revise",
      changes: { statement: "Direkt ersetzt, ohne jede Prüfung." },
    });
    expect(versuch.statusCode).toBe(403);
    const koerper = versuch.json() as { error: string; message: string };
    expect(koerper.error).toBe("PROPOSAL_REQUIRED");
    // Die Ablehnung nennt den Weg — eine Sackgasse wäre keine Antwort.
    expect(koerper.message).toContain("propose");

    const jetzt = await stand(app, admin, id);
    expect(jetzt.version).toBe(1);
    expect(jetzt.status).toBe("validiert");
    expect(jetzt.statement).toBe("Bei Überdruck Ventil X manuell schließen.");
  });

  it("B1b: die Regel ist ENG — ein NICHT freigegebenes Objekt bearbeitet derselbe `experte` weiter", async () => {
    const { app, admin } = await flaeche();
    const angelegt = await anlegen(app, admin); // frisch angelegt: Status „offen"
    const experte = await konto(app, admin, "experte", "experte@klarwerk.test");

    const revidiert = await put(app, experte, angelegt.id, {
      action: "revise",
      changes: { statement: "Fortgeschrieben, solange nichts freigegeben ist." },
    });
    expect(revidiert.statusCode).toBe(200);
    expect((revidiert.json() as { version: number }).version).toBe(2);
  });

  it("B1c: auch `revise-release` bleibt ihm verwehrt — das Recht steht am Zweig, nicht am Fenster", async () => {
    const { app, admin } = await flaeche();
    const id = await freigegebenesObjekt(app, admin);
    const experte = await konto(app, admin, "experte", "experte@klarwerk.test");

    const versuch = await put(app, experte, id, {
      action: "revise-release",
      changes: { statement: "Selbst freigegeben." },
    });
    expect(versuch.statusCode).toBe(403);
    expect((await stand(app, admin, id)).version).toBe(1);
  });

  it("B2: sein Weg ist der Vorschlag — er hängt am Objekt und ändert an ihm NICHTS", async () => {
    const { app, admin } = await flaeche();
    const id = await freigegebenesObjekt(app, admin);
    const experte = await konto(app, admin, "experte", "experte@klarwerk.test");

    const eingereicht = await einreichen(app, experte, id, "So müsste es heißen.", 1);
    expect(eingereicht.statusCode).toBe(200);

    const jetzt = await stand(app, admin, id);
    // DER KERN VON §4.5(2): Inhalt, Version UND Prüfstand sind unangetastet.
    expect(jetzt.version).toBe(1);
    expect(jetzt.status).toBe("validiert");
    expect(jetzt.statement).toBe("Bei Überdruck Ventil X manuell schließen.");
    const offene = jetzt.proposals ?? [];
    expect(offene).toHaveLength(1);
    expect(offene[0]?.status).toBe("offen");
    expect(offene[0]?.statement).toBe("So müsste es heißen.");
    expect(offene[0]?.baseVersion).toBe(1);
    // Die feste Herkunft (Prüferbefund 4): woher der Vorschlag kam, steht am Vorschlag.
    expect(offene[0]?.origin).toBe("word_addin");
  });

  it("B2b: ein Vorschlag auf einen überholten Stand wird abgewiesen — er hinge sonst an einer Fassung, die es nicht mehr gibt", async () => {
    const { app, admin } = await flaeche();
    const angelegt = await anlegen(app, admin);
    const experte = await konto(app, admin, "experte", "experte@klarwerk.test");
    await put(app, admin, angelegt.id, { action: "revise", changes: { statement: "Inzwischen." } });

    const spaet = await einreichen(app, experte, angelegt.id, "Aus einer alten Fassung.", 1);
    expect(spaet.statusCode).toBe(409);
    expect((spaet.json() as { error: string }).error).toBe("KO_STALE");
    expect((await stand(app, admin, angelegt.id)).proposals ?? []).toHaveLength(0);
  });
});

describe("JOB 3667 · die Entscheidung über einen Vorschlag", () => {
  it("B3: erst die FREMDE Übernahme macht den Vorschlag zum Stand — neue Fassung und Freigabe in einem Vorgang", async () => {
    const { app, admin } = await flaeche();
    const id = await freigegebenesObjekt(app, admin);
    const experte = await konto(app, admin, "experte", "experte@klarwerk.test");
    await einreichen(app, experte, id, "Der Wortlaut des Gastkontos.", 1);
    const offen = (await stand(app, admin, id)).proposals ?? [];

    const uebernommen = await put(app, admin, id, {
      action: "decide-proposal",
      proposalId: offen[0]?.id,
      decision: "uebernehmen",
      expectedVersion: 1,
    });
    expect(uebernommen.statusCode).toBe(200);

    const jetzt = await stand(app, admin, id);
    expect(jetzt.statement).toBe("Der Wortlaut des Gastkontos.");
    expect(jetzt.version).toBe(2);
    // „Gilt erst nach fremder Freigabe als geprüft" — jetzt gilt es, und zwar in EINEM Vorgang.
    expect(jetzt.status).toBe("validiert");
    const entschieden = (jetzt.proposals ?? [])[0];
    expect(entschieden?.status).toBe("uebernommen");
    expect(entschieden?.resultVersion).toBe(2);
    expect(entschieden?.decidedBy).toBeTruthy();
    expect(entschieden?.decidedAt).toBeTruthy();

    // Beide Stände stehen in der Fassungsliste, und beide Belege sind da.
    const fassungen = await app.inject({
      method: "GET",
      url: `/api/kos/${id}/versions`,
      headers: admin,
    });
    expect((fassungen.json() as { version: number }[]).map((v) => v.version).sort()).toEqual([
      1, 2,
    ]);
    const audit = await app.inject({ method: "GET", url: "/api/audit", headers: admin });
    const aktionen = (audit.json() as { action: string }[]).map((e) => e.action);
    expect(aktionen).toContain("ko.proposed");
    expect(aktionen).toContain("ko.revised");
    expect(aktionen).toContain("ko.admin-validated");
  });

  it("B4 (Prüferbefund 2): den EIGENEN Vorschlag gibt niemand selbst frei — auch kein Admin", async () => {
    const { app, admin } = await flaeche();
    const id = await freigegebenesObjekt(app, admin);
    const zweiterAdmin = await konto(app, admin, "admin", "admin2@klarwerk.test");
    // Ein freigabeberechtigtes Konto reicht selbst ein (Fall 3: es hat den Prüfweg gewählt).
    await einreichen(app, zweiterAdmin, id, "Mein eigener Vorschlag.", 1);
    const offen = (await stand(app, admin, id)).proposals ?? [];

    const selbst = await put(app, zweiterAdmin, id, {
      action: "decide-proposal",
      proposalId: offen[0]?.id,
      decision: "uebernehmen",
    });
    expect(selbst.statusCode).toBe(403);
    expect((selbst.json() as { error: string }).error).toBe("PROPOSAL_OWN");
    // Nichts geschrieben: weder Fassung noch Zustand des Vorschlags.
    const jetzt = await stand(app, admin, id);
    expect(jetzt.version).toBe(1);
    expect((jetzt.proposals ?? [])[0]?.status).toBe("offen");

    // Ein ANDERES berechtigtes Konto darf — das ist der Unterschied, um den es geht.
    const fremd = await put(app, admin, id, {
      action: "decide-proposal",
      proposalId: offen[0]?.id,
      decision: "uebernehmen",
    });
    expect(fremd.statusCode).toBe(200);
    expect((await stand(app, admin, id)).statement).toBe("Mein eigener Vorschlag.");
  });

  it("B5 (Prüferbefund 4): ein entschiedener Vorschlag wirkt kein zweites Mal", async () => {
    const { app, admin } = await flaeche();
    const id = await freigegebenesObjekt(app, admin);
    const experte = await konto(app, admin, "experte", "experte@klarwerk.test");
    await einreichen(app, experte, id, "Einmal übernommen.", 1);
    const offen = (await stand(app, admin, id)).proposals ?? [];
    const proposalId = offen[0]?.id;

    expect(
      (
        await put(app, admin, id, {
          action: "decide-proposal",
          proposalId,
          decision: "uebernehmen",
        })
      ).statusCode,
    ).toBe(200);
    const zweimal = await put(app, admin, id, {
      action: "decide-proposal",
      proposalId,
      decision: "uebernehmen",
    });
    expect(zweimal.statusCode).toBe(409);
    expect((zweimal.json() as { error: string }).error).toBe("PROPOSAL_DECIDED");
    // Und die Wiederholung hat KEINE zweite Fassung erzeugt.
    expect((await stand(app, admin, id)).version).toBe(2);
  });

  it("B6: die ABLEHNUNG ist ein Zustand mit Begründung — und sie fasst den Eintrag nicht an", async () => {
    const { app, admin } = await flaeche();
    const id = await freigegebenesObjekt(app, admin);
    const experte = await konto(app, admin, "experte", "experte@klarwerk.test");
    await einreichen(app, experte, id, "Das wollen wir nicht.", 1);
    const offen = (await stand(app, admin, id)).proposals ?? [];

    const abgelehnt = await put(app, admin, id, {
      action: "decide-proposal",
      proposalId: offen[0]?.id,
      decision: "ablehnen",
      note: "Widerspricht der Anlagenordnung.",
    });
    expect(abgelehnt.statusCode).toBe(200);

    const jetzt = await stand(app, admin, id);
    expect(jetzt.version).toBe(1);
    expect(jetzt.statement).toBe("Bei Überdruck Ventil X manuell schließen.");
    const entschieden = (jetzt.proposals ?? [])[0];
    expect(entschieden?.status).toBe("abgelehnt");
    expect(entschieden?.note).toBe("Widerspricht der Anlagenordnung.");
    expect(entschieden?.decidedBy).toBeTruthy();
  });

  it("B6b: ein fremder Vorschlagsschlüssel ist ein 404, keine stille Nichtwirkung", async () => {
    const { app, admin } = await flaeche();
    const id = await freigegebenesObjekt(app, admin);
    const daneben = await put(app, admin, id, {
      action: "decide-proposal",
      proposalId: "gibt-es-nicht",
      decision: "ablehnen",
    });
    expect(daneben.statusCode).toBe(404);
    expect((daneben.json() as { error: string }).error).toBe("PROPOSAL_NOT_FOUND");
  });
});

describe("JOB 3667 · Fall 1: überarbeiten und freigeben — und was ein veralteter Stand bewirkt", () => {
  it("B7 (Prüferbefund 3): mit der gesehenen Version gilt die Änderung sofort — mit einer überholten passiert GAR NICHTS", async () => {
    const { app, admin } = await flaeche();
    const id = await freigegebenesObjekt(app, admin);

    const direkt = await put(app, admin, id, {
      action: "revise-release",
      changes: { statement: "Direkt abgelegt und freigegeben." },
      expectedVersion: 1,
    });
    expect(direkt.statusCode).toBe(200);
    const nachher = direkt.json() as { version: number; status: string; trust: number };
    expect(nachher.version).toBe(2);
    expect(nachher.status).toBe("validiert");
    expect(nachher.trust).toBe(99);

    // Jetzt der Fall, den Runde 1 offen liess: ein zweiter Aufruf mit dem ALTEN Stand.
    const veraltet = await put(app, admin, id, {
      action: "revise-release",
      changes: { statement: "Aus einer überholten Fassung." },
      expectedVersion: 1,
    });
    expect(veraltet.statusCode).toBe(409);
    expect((veraltet.json() as { currentVersion: number }).currentVersion).toBe(2);
    const jetzt = await stand(app, admin, id);
    // WEDER Fassung NOCH Freigabe: der Vorgang ist einer, und er ist ganz unterblieben.
    expect(jetzt.version).toBe(2);
    expect(jetzt.statement).toBe("Direkt abgelegt und freigegeben.");
  });

  it("B7b (Prüfer-Szene 2): fremder Text, der ZWISCHEN Fassung und Freigabe entsteht, wird NICHT mitfreigegeben", async () => {
    const { app, admin } = await flaeche();
    const angelegt = await anlegen(app, admin); // v1, Status „offen"
    const zweiterAdmin = await konto(app, admin, "admin", "admin2@klarwerk.test");

    // Der Prüfer hat genau das gemessen: A liest v1, B schreibt dazwischen, A gibt frei — und
    // freigegeben wurde BS Text. Mit der Versionsbindung passiert jetzt gar nichts.
    const fremd = await put(app, zweiterAdmin, angelegt.id, {
      action: "revise",
      changes: { statement: "Text von jemand anderem, ungeprüft." },
    });
    expect(fremd.statusCode).toBe(200);

    const zuSpaet = await put(app, admin, angelegt.id, {
      action: "revise-release",
      changes: { statement: "Der Stand, den A gesehen hatte." },
      expectedVersion: 1,
    });
    expect(zuSpaet.statusCode).toBe(409);

    const jetzt = await stand(app, admin, angelegt.id);
    expect(jetzt.version).toBe(2);
    expect(jetzt.statement).toBe("Text von jemand anderem, ungeprüft.");
    // DER KERN: der fremde Text steht da — aber er ist NICHT freigegeben.
    expect(jetzt.status).toBe("offen");
  });

  it("B8: die Freigabe schreibt fort, WER sie getragen hat — nachvollziehbar, nicht behauptet", async () => {
    const { app, admin } = await flaeche();
    const id = await freigegebenesObjekt(app, admin);
    await put(app, admin, id, {
      action: "revise-release",
      changes: { statement: "Mit Beleg." },
    });
    const jetzt = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers: admin });
    const traeger = (jetzt.json() as { ownership?: { validators?: string[] } }).ownership;
    expect(traeger?.validators ?? []).toHaveLength(1);
    const audit = await app.inject({ method: "GET", url: "/api/audit", headers: admin });
    const belege = (audit.json() as { action: string; actor: string }[]).filter(
      (e) => e.action === "ko.admin-validated",
    );
    // Zweimal: die Anlage der Vorbedingung und dieser Vorgang — beide mit Akteur.
    expect(belege.length).toBeGreaterThanOrEqual(2);
    for (const beleg of belege) {
      expect(beleg.actor).toBeTruthy();
    }
  });
});
