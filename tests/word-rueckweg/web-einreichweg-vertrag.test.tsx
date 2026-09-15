// @vitest-environment jsdom
// ================================================================================================
// JOB 3667 R3 · DER BROWSER-VERTRAG — DIE WEB-FLÄCHE UND DER SERVER SAGEN DASSELBE.
// ================================================================================================
//
// WARUM DIESE DATEI EXISTIERT. Runde 2 hat Pedis Accountregel am SERVER durchgesetzt und dort
// belegt. Sie hat dabei eine Folge erzeugt, die sie selbst unter ABWEICHUNGEN benannt hat: die neue
// Sperre wirkt PRODUKTWEIT. Ein `experte` kann seither auch über die Web-Fläche ein freigegebenes
// Wissensobjekt nicht mehr direkt überschreiben — 403 `PROPOSAL_REQUIRED`. Nur bot die Web-Fläche
// für diesen Fall keinen Einreichweg an: der Client-Vertrag (`apps/web/src/api/endpoints.ts`) kannte
// `propose` und `decide-proposal` nicht. Wer im Browser arbeitete, stand vor einer Sperre ohne
// Ausweg.
//
// WAS HIER GEMESSEN WIRD, UND WAS DAS VON RUNDE 2 UNTERSCHEIDET. Runde 2 hat die ROUTE mit
// handgeschriebenen Nutzlasten gefahren. Diese Datei fährt den ECHTEN WEB-CLIENT — `endpoints.ko.act`
// aus `apps/web/src/api/endpoints.ts`, samt `apiFetch`/`ApiError` aus `api/client.ts` — gegen die
// ECHTE Fastify-Anwendung. Damit ist nicht nur belegt, dass der Server die Regel hält, sondern dass
// der Browser sie mit SEINEN Aufrufen auch erreicht: Adresse, Methode, Rumpf und Fehlerlesung
// stammen aus dem Produktcode, nicht aus diesem Test.
//
// DIE EINZIGE ERSETZTE STELLE IST DER TRANSPORT: `globalThis.fetch` reicht an `app.inject` weiter.
// Alles davor (der Vertrag) und alles danach (Rechte, Dienst, Ablage) ist Produktcode.
//
// BENANNTE PRÜFLÜCKE: die Anwendung läuft auf den In-Memory-Ablagen (`buildServices()`), nicht auf
// PostgreSQL, und es ist kein echter Browser beteiligt. Was hier steht, gilt für den Vertrag und die
// Regel — nicht als Abnahme des Betriebs.
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "../../apps/web/src/api/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;

interface Vorschlag {
  id: string;
  author: string;
  baseVersion: number;
  statement: string;
  bodyHtml?: string | null;
  status: string;
  origin?: string;
  decidedBy?: string;
  resultVersion?: number;
  note?: string;
}

let app: App;
/** Das Konto, in dessen Namen der Client gerade spricht — der Transport hängt den Bearer an. */
let alsKonto = "";

/**
 * Der Transport, und NUR er, ist ersetzt.
 *
 * `api/client.ts` baut die Adresse (`/api` + Pfad), die Methode, die Kopfzeilen und den JSON-Rumpf
 * selbst; hier wird das Ergebnis genau so an `app.inject` weitergegeben und die Antwort in die
 * schmale Form zurückgegeben, die `apiFetch` liest (`status`, `ok`, `statusText`, `text()`). Ein
 * eigener Nachbau des Rumpfs wäre genau die zweite Wahrheit, die diese Datei ausschliessen soll.
 */
function transportEinhaengen(): void {
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const kopf: Record<string, string> = {};
    if (init?.headers) {
      new Headers(init.headers as HeadersInit).forEach((wert, name) => {
        kopf[name] = wert;
      });
    }
    if (alsKonto) {
      kopf.authorization = `Bearer ${alsKonto}`;
    }
    const antwort = await app.inject({
      method: (init?.method ?? "GET") as "GET",
      url,
      headers: kopf,
      ...(init?.body === undefined || init?.body === null
        ? {}
        : { payload: String(init.body as string) }),
    });
    return {
      status: antwort.statusCode,
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      statusText: String(antwort.statusCode),
      text: async () => antwort.body,
    };
  }) as unknown as typeof fetch;
}

async function token(email: string, password = "secret123"): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  expect(login.statusCode).toBe(200);
  return (login.json() as { token: string }).token;
}

/** Ein zweites Konto über den Weg des Produkts — nicht durch eine von Hand gesetzte Rolle. */
async function konto(adminToken: string, rolle: string, email: string): Promise<string> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: `Konto ${rolle}`, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  expect((angelegt.json() as { role: string }).role).toBe(rolle);
  return token(email);
}

/** Der Stand, wie ihn ein LESER sieht — über denselben Client, den die Fläche benutzt. */
async function stand(id: string): Promise<{
  version: number;
  status: string;
  statement: string;
  proposals?: Vorschlag[];
}> {
  return (await endpoints.ko.get(id)) as unknown as {
    version: number;
    status: string;
    statement: string;
    proposals?: Vorschlag[];
  };
}

let adminToken = "";
let experteToken = "";
let zweiterAdminToken = "";
let adminId = "";
let experteId = "";

/** Ein FREIGEGEBENES Objekt — genau der Zustand, den Pedis Regel schützt. */
async function freigegebenesObjekt(): Promise<{ id: string; text: string }> {
  alsKonto = adminToken;
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      confidentiality: "intern",
      title: "Ventil X schließt bei Überdruck",
      statement: "Bei Überdruck Ventil X manuell schließen.",
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(angelegt.statusCode).toBe(201);
  const id = (angelegt.json() as { id: string }).id;
  const frei = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { action: "admin-validate" },
  });
  expect(frei.statusCode).toBe(200);
  return { id, text: "Bei Überdruck Ventil X manuell schließen." };
}

beforeEach(async () => {
  app = buildApp(buildServices());
  transportEinhaengen();
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@klarwerk.test", password: "secret123" },
  });
  adminToken = await token("pedi@klarwerk.test");
  experteToken = await konto(adminToken, "experte", "experte@klarwerk.test");
  zweiterAdminToken = await konto(adminToken, "admin", "admin2@klarwerk.test");
  const ichAdmin = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { authorization: `Bearer ${adminToken}` },
  });
  adminId = (ichAdmin.json() as { id: string }).id;
  const ichExperte = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { authorization: `Bearer ${experteToken}` },
  });
  experteId = (ichExperte.json() as { id: string }).id;
});

describe("JOB 3667 R3 · der Einreichweg des Browsers, vom echten Client gefahren", () => {
  // ==============================================================================================
  // FALL 2 — NICHT BERECHTIGT: DIE PRÜFUNG IST PFLICHT, UND DER WEG EXISTIERT.
  // ==============================================================================================

  it("W1 · der direkte `revise` des Experten wird abgewiesen — und der freigegebene Stand steht unverändert", async () => {
    const { id, text } = await freigegebenesObjekt();
    alsKonto = experteToken;

    const fehler = await endpoints.ko
      .act(id, {
        action: "revise",
        changes: { title: "Ventil X", statement: "Ventil X bleibt offen.", type: "best_practice" },
      })
      .then(
        () => null,
        (e: unknown) => e,
      );

    // Der Client liest die Absage als das, was sie ist — mit dem Code, an dem die Fläche den
    // Einreichweg anbietet (`BibliothekLesen.tsx`, `save.onError`).
    expect(fehler, "der Aufruf ist durchgegangen").toBeInstanceOf(ApiError);
    expect((fehler as ApiError).status).toBe(403);
    expect((fehler as ApiError).code).toBe("PROPOSAL_REQUIRED");

    // UND DAS IST DER KERN: die Absage kommt VOR der Änderung. Der gültige Text ist noch da.
    const jetzt = await stand(id);
    expect(jetzt.statement).toBe(text);
    expect(jetzt.version).toBe(1);
    expect(jetzt.status).toBe("validiert");
  });

  it("W2 · `propose` gelingt — und das Objekt trägt WEITERHIN den freigegebenen Stand", async () => {
    const { id, text } = await freigegebenesObjekt();
    const vorher = await stand(id);
    alsKonto = experteToken;

    await endpoints.ko.act(id, {
      action: "propose",
      proposal: {
        statement: "Ventil X zusätzlich verplomben.",
        baseVersion: vorher.version,
        origin: "klarwerk_web",
      },
    });

    // Lieferung 3, und sie ist der Grund für Pedis Regel: wer liest, sieht den geprüften Stand.
    const nachher = await stand(id);
    expect(nachher.statement, "der eingereichte Text gilt schon als Stand").toBe(text);
    expect(nachher.version, "die Version ist gesprungen, obwohl nur eingereicht wurde").toBe(
      vorher.version,
    );
    expect(nachher.status).toBe("validiert");

    // Der Vorschlag hängt AM OBJEKT — kein zweites, eigenständiges Wissensobjekt.
    const offen = (nachher.proposals ?? []).filter((p) => p.status === "offen");
    expect(offen).toHaveLength(1);
    expect(offen[0]?.statement).toBe("Ventil X zusätzlich verplomben.");
    expect(offen[0]?.author).toBe(experteId);
    expect(offen[0]?.baseVersion).toBe(vorher.version);
    // Die Herkunft, die diese Oberfläche setzt — unterscheidbar von `word_addin`.
    expect(offen[0]?.origin).toBe("klarwerk_web");
  });

  it("W3 · erst die FREMDE Übernahme macht den Text zum Stand — mit Version und Freigabe", async () => {
    const { id } = await freigegebenesObjekt();
    const vorher = await stand(id);
    alsKonto = experteToken;
    await endpoints.ko.act(id, {
      action: "propose",
      proposal: {
        statement: "Ventil X zusätzlich verplomben.",
        baseVersion: vorher.version,
        origin: "klarwerk_web",
      },
    });
    alsKonto = adminToken;
    const eingereicht = (await stand(id)).proposals?.[0] as Vorschlag;

    await endpoints.ko.act(id, {
      action: "decide-proposal",
      proposalId: eingereicht.id,
      decision: "uebernehmen",
      expectedVersion: vorher.version,
    });

    const nachher = await stand(id);
    expect(nachher.statement).toBe("Ventil X zusätzlich verplomben.");
    expect(nachher.version).toBe(vorher.version + 1);
    expect(nachher.status, "die Übernahme lässt das Objekt ungeprüft").toBe("validiert");
    const entschieden = (nachher.proposals ?? [])[0] as Vorschlag;
    expect(entschieden.status).toBe("uebernommen");
    expect(entschieden.decidedBy).toBe(adminId);
    expect(entschieden.resultVersion).toBe(nachher.version);
    // Der entschiedene Vorschlag ist NICHT mehr offen — die Fläche zeigt ihn deshalb nicht mehr.
    expect((nachher.proposals ?? []).filter((p) => p.status === "offen")).toHaveLength(0);
  });

  // ==============================================================================================
  // FALL 3 — FREIWILLIG, UND TROTZDEM KEINE SELBSTPRÜFUNG.
  // ==============================================================================================

  it("W4 · wer freiwillig einreicht, übernimmt seinen EIGENEN Vorschlag nicht — auch als Admin", async () => {
    const { id, text } = await freigegebenesObjekt();
    const vorher = await stand(id);
    // Fall 3: das BERECHTIGTE Konto wählt den Prüfweg selbst.
    alsKonto = adminToken;
    await endpoints.ko.act(id, {
      action: "propose",
      proposal: {
        statement: "Ventil X halbjährlich prüfen.",
        baseVersion: vorher.version,
        origin: "klarwerk_web",
      },
    });
    const eigener = (await stand(id)).proposals?.[0] as Vorschlag;
    expect(eigener.author).toBe(adminId);

    const fehler = await endpoints.ko
      .act(id, {
        action: "decide-proposal",
        proposalId: eigener.id,
        decision: "uebernehmen",
        expectedVersion: vorher.version,
      })
      .then(
        () => null,
        (e: unknown) => e,
      );

    expect(fehler, "der eigene Vorschlag liess sich selbst übernehmen").toBeInstanceOf(ApiError);
    expect((fehler as ApiError).status).toBe(403);
    expect((fehler as ApiError).code).toBe("PROPOSAL_OWN");
    // Nichts ist geschehen: kein Inhalt, keine Version, der Vorschlag bleibt offen.
    const jetzt = await stand(id);
    expect(jetzt.statement).toBe(text);
    expect(jetzt.version).toBe(vorher.version);
    expect((jetzt.proposals ?? [])[0]?.status).toBe("offen");
  });

  it("W5 · ein ANDERER Berechtigter darf denselben Vorschlag übernehmen — sonst wäre Fall 3 eine Falle", async () => {
    const { id } = await freigegebenesObjekt();
    const vorher = await stand(id);
    alsKonto = adminToken;
    await endpoints.ko.act(id, {
      action: "propose",
      proposal: {
        statement: "Ventil X halbjährlich prüfen.",
        baseVersion: vorher.version,
        origin: "klarwerk_web",
      },
    });
    const eigener = (await stand(id)).proposals?.[0] as Vorschlag;

    alsKonto = zweiterAdminToken;
    await endpoints.ko.act(id, {
      action: "decide-proposal",
      proposalId: eigener.id,
      decision: "uebernehmen",
      expectedVersion: vorher.version,
    });

    const nachher = await stand(id);
    expect(nachher.statement).toBe("Ventil X halbjährlich prüfen.");
    expect(nachher.version).toBe(vorher.version + 1);
  });

  // ==============================================================================================
  // DIE VERSION REIST MIT — UND EIN KONFLIKT VERLIERT NICHTS.
  // ==============================================================================================

  it("W6 · ein veralteter `baseVersion` wird abgewiesen (409) — eingereicht wird nichts", async () => {
    const { id } = await freigegebenesObjekt();
    const gesehen = (await stand(id)).version;
    // Jemand anderes schreibt dazwischen.
    alsKonto = adminToken;
    await endpoints.ko.act(id, {
      action: "revise",
      changes: { title: "Ventil X", statement: "Fremder Text.", type: "best_practice" },
    });
    expect((await stand(id)).version).toBe(gesehen + 1);

    alsKonto = experteToken;
    const fehler = await endpoints.ko
      .act(id, {
        action: "propose",
        proposal: { statement: "Mein Text.", baseVersion: gesehen, origin: "klarwerk_web" },
      })
      .then(
        () => null,
        (e: unknown) => e,
      );

    expect(fehler).toBeInstanceOf(ApiError);
    expect((fehler as ApiError).status).toBe(409);
    expect((fehler as ApiError).code).toBe("KO_STALE");
    expect(
      (await stand(id)).proposals ?? [],
      "trotz 409 wurde ein Vorschlag angelegt",
    ).toHaveLength(0);
  });

  it("W6b · BELEG DER GRENZE: `currentVersion` aus dem 409 erreicht die Oberfläche NICHT", async () => {
    // ============================================================================================
    // DIESER FALL BEWEIST EINE LÜCKE, ER DECKT SIE NICHT ZU.
    // ============================================================================================
    //
    // Der Server sendet die jetzt gültige Version im Antwortkörper mit (`ko-routes.ts:1922`). Der
    // Client wirft sie weg: `ApiError` trägt nur `status`, `code` und `message`
    // (`api/client.ts:38-43`) — und `client.ts` ist KEIN Zielpfad dieses Auftrags. Deshalb nennt die
    // Fläche die Fassung erst, NACHDEM sie nachgelesen hat, und bis dahin sagt sie sie nicht.
    //
    // Ohne diesen Fall wäre die Begründung in `BibliothekLesen.tsx` („DIE GRENZE DES 409") eine
    // Behauptung. Wird `client.ts` später erweitert, wird dieser Fall rot und erzwingt die bewusste
    // Entscheidung, die Zahl dann direkt zu verwenden.
    const { id } = await freigegebenesObjekt();
    const gesehen = (await stand(id)).version;
    alsKonto = adminToken;
    await endpoints.ko.act(id, {
      action: "revise",
      changes: { title: "Ventil X", statement: "Fremder Text.", type: "best_practice" },
    });

    alsKonto = experteToken;
    const fehler = (await endpoints.ko
      .act(id, {
        action: "propose",
        proposal: { statement: "Mein Text.", baseVersion: gesehen, origin: "klarwerk_web" },
      })
      .then(
        () => null,
        (e: unknown) => e,
      )) as ApiError;

    // Der Server WEISS die Zahl — hier, am rohen Aufruf, steht sie im Körper.
    const roh = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: { authorization: `Bearer ${experteToken}` },
      payload: { action: "propose", proposal: { statement: "X", baseVersion: gesehen } },
    });
    expect(roh.statusCode).toBe(409);
    expect((roh.json() as { currentVersion?: number }).currentVersion).toBe(gesehen + 1);

    // Der Client gibt sie NICHT weiter — das ist die gemeldete Grenze, hier gemessen.
    expect(Object.keys(fehler)).not.toContain("currentVersion");
    expect((fehler as unknown as { currentVersion?: number }).currentVersion).toBeUndefined();
  });

  it("W7 · eine Freigabe mit veralteter Fassung nimmt fremden Text NICHT mit (409)", async () => {
    const { id } = await freigegebenesObjekt();
    const vorher = await stand(id);
    alsKonto = experteToken;
    await endpoints.ko.act(id, {
      action: "propose",
      proposal: {
        statement: "Ventil X zusätzlich verplomben.",
        baseVersion: vorher.version,
        origin: "klarwerk_web",
      },
    });
    alsKonto = adminToken;
    const eingereicht = (await stand(id)).proposals?.[0] as Vorschlag;
    // Der Prüfer hat v1 im Bild. Ein Fremder schreibt v2, WÄHREND er hinsieht.
    alsKonto = zweiterAdminToken;
    await endpoints.ko.act(id, {
      action: "revise",
      changes: { title: "Ventil X", statement: "Fremder Text v2.", type: "best_practice" },
    });
    alsKonto = adminToken;

    const fehler = await endpoints.ko
      .act(id, {
        action: "decide-proposal",
        proposalId: eingereicht.id,
        decision: "uebernehmen",
        expectedVersion: vorher.version,
      })
      .then(
        () => null,
        (e: unknown) => e,
      );

    expect(
      fehler,
      "die Freigabe griff auf einen Stand, den der Prüfer nie gesehen hat",
    ).toBeInstanceOf(ApiError);
    expect((fehler as ApiError).status).toBe(409);
    const jetzt = await stand(id);
    // Der fremde Text steht da, WEIL der Fremde ihn geschrieben hat — aber er ist nicht durch diese
    // Freigabe hindurchgegangen, und der Vorschlag wartet unverändert weiter.
    expect(jetzt.statement, "die Übernahme hat den Inhalt doch angefasst").toBe("Fremder Text v2.");
    expect((jetzt.proposals ?? [])[0]?.status, "der Vorschlag gilt als entschieden").toBe("offen");
  });

  // ==============================================================================================
  // DER ENTSCHIEDENE ZUSTAND UND DIE EINGEREICHTE FASSUNG.
  // ==============================================================================================

  it("W8 · entschieden wird über die EINGEREICHTE Fassung — zweimal gelesen, derselbe Inhalt", async () => {
    const { id } = await freigegebenesObjekt();
    const vorher = await stand(id);
    alsKonto = experteToken;
    await endpoints.ko.act(id, {
      action: "propose",
      proposal: {
        statement: "Genau dieser Satz wurde eingereicht.",
        baseVersion: vorher.version,
        origin: "klarwerk_web",
      },
    });
    alsKonto = adminToken;

    // Lieferung 8, erster Teil: derselbe Vorschlag, zweimal gelesen, trägt denselben Inhalt.
    const ersteLesung = (await stand(id)).proposals?.[0] as Vorschlag;
    const zweiteLesung = (await stand(id)).proposals?.[0] as Vorschlag;
    expect(zweiteLesung.statement).toBe(ersteLesung.statement);
    expect(zweiteLesung.id).toBe(ersteLesung.id);

    await endpoints.ko.act(id, {
      action: "decide-proposal",
      proposalId: ersteLesung.id,
      decision: "uebernehmen",
      expectedVersion: vorher.version,
    });

    // Zweiter Teil: die übernommene Fassung GLEICHT dem, was eingereicht wurde. Der Vertrag trägt
    // gar kein Inhaltsfeld (`endpoints.ts`) — etwas anderes kann hier deshalb nicht ankommen.
    expect((await stand(id)).statement).toBe(ersteLesung.statement);
  });

  it("W9 · eine Ablehnung ist ein ZUSTAND mit Begründung — und ändert am Objekt nichts", async () => {
    const { id, text } = await freigegebenesObjekt();
    const vorher = await stand(id);
    alsKonto = experteToken;
    await endpoints.ko.act(id, {
      action: "propose",
      proposal: { statement: "Falscher Vorschlag.", baseVersion: vorher.version },
    });
    alsKonto = adminToken;
    const eingereicht = (await stand(id)).proposals?.[0] as Vorschlag;

    await endpoints.ko.act(id, {
      action: "decide-proposal",
      proposalId: eingereicht.id,
      decision: "ablehnen",
      expectedVersion: vorher.version,
      note: "Widerspricht der Betriebsanweisung 4.",
    });

    const nachher = await stand(id);
    const abgelehnt = (nachher.proposals ?? [])[0] as Vorschlag;
    expect(abgelehnt.status).toBe("abgelehnt");
    expect(abgelehnt.note).toBe("Widerspricht der Betriebsanweisung 4.");
    expect(abgelehnt.decidedBy).toBe(adminId);
    // Kein Inhalt, keine Version — eine Ablehnung schreibt nichts.
    expect(nachher.statement).toBe(text);
    expect(nachher.version).toBe(vorher.version);
  });

  it("W10 · über einen entschiedenen Vorschlag wird nicht zweimal entschieden (409)", async () => {
    const { id } = await freigegebenesObjekt();
    const vorher = await stand(id);
    alsKonto = experteToken;
    await endpoints.ko.act(id, {
      action: "propose",
      proposal: { statement: "Einmal reicht.", baseVersion: vorher.version },
    });
    alsKonto = adminToken;
    const eingereicht = (await stand(id)).proposals?.[0] as Vorschlag;
    await endpoints.ko.act(id, {
      action: "decide-proposal",
      proposalId: eingereicht.id,
      decision: "ablehnen",
      expectedVersion: vorher.version,
      note: "Nein.",
    });

    const fehler = await endpoints.ko
      .act(id, {
        action: "decide-proposal",
        proposalId: eingereicht.id,
        decision: "uebernehmen",
        expectedVersion: vorher.version,
      })
      .then(
        () => null,
        (e: unknown) => e,
      );

    expect(fehler).toBeInstanceOf(ApiError);
    expect((fehler as ApiError).status).toBe(409);
    expect((fehler as ApiError).code).toBe("PROPOSAL_DECIDED");
  });

  // ==============================================================================================
  // DIE REGEL BLEIBT ENG — SONST NÄHME SIE DEM ERFASSUNGSWEG DIE GRUNDLAGE.
  // ==============================================================================================

  it("W11 · ein NICHT freigegebenes Objekt bearbeitet der Experte weiter wie bisher", async () => {
    alsKonto = adminToken;
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        confidentiality: "intern",
        title: "Noch offen",
        statement: "Erster Stand.",
        type: "best_practice",
        category: "Anlage 1",
      },
    });
    const id = (angelegt.json() as { id: string }).id;
    expect((await stand(id)).status).not.toBe("validiert");

    alsKonto = experteToken;
    // KEIN Fehler: die Sperre schützt den FREIGEGEBENEN Stand, nicht jedes Objekt.
    await endpoints.ko.act(id, {
      action: "revise",
      changes: { title: "Noch offen", statement: "Zweiter Stand.", type: "best_practice" },
    });
    expect((await stand(id)).statement).toBe("Zweiter Stand.");
  });

  it("W12 · `bodyHtml` reist mit und kommt gesäubert an — gemessen, nicht zugesagt", async () => {
    // Die Nachführung verlangt für `bodyHtml` einen BEFUND, keine Zusage. Hier steht er: der Rumpf
    // erreicht den Vorschlag, und was die Säuberung damit macht, ist ablesbar statt behauptet.
    const { id } = await freigegebenesObjekt();
    const vorher = await stand(id);
    alsKonto = experteToken;
    await endpoints.ko.act(id, {
      action: "propose",
      proposal: {
        statement: "Mit Rumpf.",
        bodyHtml: "<p>Erster Absatz <strong>fett</strong></p><script>alert(1)</script>",
        baseVersion: vorher.version,
        origin: "klarwerk_web",
      },
    });

    const eingereicht = (await stand(id)).proposals?.[0] as Vorschlag;
    const rumpf = eingereicht.bodyHtml ?? "";
    // DER BEFUND: der Absatz und die Auszeichnung überleben, das Skript nicht.
    expect(rumpf).toContain("Erster Absatz");
    expect(rumpf).toContain("<strong>");
    expect(rumpf).not.toContain("<script");
  });
});
