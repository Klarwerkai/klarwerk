// ==================================================================================================
// JOB 3618 (Q3 c) — DER MASSSTAB UND DIE GRENZEN FÜR „EIN VERSÄUMNIS, EIN NAME".
// ==================================================================================================
//
// WAS DIESE DATEI IST. Der vermessene Vertrag, dass `POST /api/kos/from-document` für EIN
// Versäumnis — „niemand hat die Vertraulichkeitsstufe gewählt" — EINEN Namen trägt, gleich über
// welchen seiner beiden Zweige (frisch aus dem Rumpf, oder aus einem fortgesetzten Entwurf).
//
// WARUM ES SIE GIBT. JOB 3569 hat den frischen Zweig auf `MISSING_CONFIDENTIALITY` gestellt und in
// derselben Runde gemessen, dass der Entwurfs-Zweig weiterhin `INCOMPLETE` sagt — er bricht vorher
// in `capture.toKoInput` ab und erreicht den Routen-Wächter nie. Der damalige Test hat den
// IST-Zustand festgehalten (`tests/q3c-stufenpflicht-dokumentweg/stufenpflicht-am-dokumentweg.test.ts`,
// Fall „der fortgesetzte ENTWURF überlebt die Abweisung"), damit der Wechsel auffällt. Hier ist der
// Wechsel. Ein Client, der auf dieses Versäumnis reagieren will („bitte Stufe wählen" statt
// „Entwurf unvollständig"), musste bis hierher zwei Namen kennen und raten, welcher kommt.
//
// WIE SIE GEBAUT IST:
//
//   F1-F3 Der eine Name: beide Zweige, derselbe Code UND derselbe Satz — auch dann, wenn ausser der
//      Stufe noch der Titel fehlt (RANGFOLGE, gemessen am frischen Zweig, nicht angenommen).
//   F4 Die Grenze zwischen „fehlt" und „ist falsch": ein VORHANDENER, aber ungültiger Wert ist kein
//      fehlender und wird NICHT mit umbenannt.
//   F5 Die Abweisung ist folgenlos und umkehrbar: sie legt nichts an, der Entwurf überlebt
//      unverändert, und DERSELBE Entwurf geht nach dem Nachtragen der Stufe durch.
//
// WIE GEMESSEN WIRD. An der ECHTEN App (`buildApp(buildServices())`, `app.inject`), nicht an einer
// Attrappe: die Aussage ist eine über die ANTWORT der Route, und zwischen `toKoInput` und der
// Antwort liegen `build-app.ts` (`applyAndLoad`) und `http.ts` (`sendError`). Der Endzustand wird
// beim Server ERFRAGT (`GET /api/kos`), nicht aus dem Statuscode geraten. Kein Regex über
// Quelltext, kein Kommentar-Wächter — nur Verhalten.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { InMemoryDraftRepo } from "../../services/capture/src/repo";
import { CaptureService } from "../../services/capture/src/service";
import type { DraftPayload } from "../../services/capture/src/types";

type App = ReturnType<typeof buildApp>;

const PDF_DATA_URL = `data:application/pdf;base64,${Buffer.from("%PDF-1.4 Pruefbericht").toString("base64")}`;

/**
 * DER SATZ, zeichengleich aus `services/app/src/routes/ko-routes.ts` (`sendMissingConfidentiality`).
 *
 * ER STEHT HIER ALS LITERAL UND NICHT ALS IMPORT. Ein gemeinsamer Export über die Modulgrenze
 * `services/app` → `services/capture` wäre die falsche Abhängigkeitsrichtung (dependency-cruiser);
 * und ein Test, der denselben Ausdruck importiert, den er prüfen soll, prüfte nichts.
 */
const SATZ =
  "Vertraulichkeitsstufe fehlt — ein Wissensobjekt entsteht nur mit ausdrücklicher Einstufung.";

/** Der Inhalt OHNE Stufe und OHNE Titel — jeder Fall setzt beides ausdrücklich (oder eben nicht). */
const KERN = {
  statement: "Dichtung vor jedem Anlauf prüfen.",
  type: "best_practice",
  category: "Instandhaltung",
} as const;

/** Die vier übrigen Pflichtfelder — es fehlt genau die Stufe. */
const INHALT = { ...KERN, title: "Dichtungswechsel L4" } as const;

async function setup() {
  const services = buildServices();
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
  const headers = { authorization: `Bearer ${login.json().token}` };
  const obj = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers,
    payload: { name: "Pruefbericht.pdf", mime: "application/pdf", data: PDF_DATA_URL },
  });
  expect(obj.statusCode).toBeLessThan(300);
  return { app, headers, services, objectId: obj.json().id as string };
}

function bündel(objectId: string) {
  return [
    {
      anchor: { objectId, name: "Pruefbericht.pdf", mime: "application/pdf" },
      points: [{ label: "Pruefbericht.pdf", excerpt: "Dichtung nach 500 h tauschen." }],
    },
  ];
}

function ausDokument(app: App, headers: Record<string, string>, payload: Record<string, unknown>) {
  return app.inject({ method: "POST", url: "/api/kos/from-document", headers, payload });
}

async function entwurfAnlegen(
  app: App,
  headers: Record<string, string>,
  payload: Record<string, unknown>,
) {
  const res = await app.inject({ method: "POST", url: "/api/drafts", headers, payload });
  expect(res.statusCode).toBeLessThan(300);
  return res.json().id as string;
}

async function entwurfsStand(app: App, headers: Record<string, string>, draftId: string) {
  const d = await app.inject({ method: "GET", url: `/api/drafts/${draftId}`, headers });
  expect(d.statusCode).toBe(200);
  return (d.json() as { updatedAt: string }).updatedAt;
}

/** Einen BESTEHENDEN Entwurf einreichen, wahlweise mit Nachtrag auf dem Weg. */
async function einreichen(
  app: App,
  headers: Record<string, string>,
  objectId: string,
  draftId: string,
  draftPayload: Record<string, unknown>,
  operationId: string,
) {
  const res = await ausDokument(app, headers, {
    operationId,
    draftId,
    expectedUpdatedAt: await entwurfsStand(app, headers, draftId),
    draftPayload,
    documents: bündel(objectId),
  });
  return { draftId, res, body: res.json() as { error: string; message: string } };
}

/** Der Entwurfs-Zweig: Entwurf anlegen, unverändert fortsetzen, einreichen. */
async function überEntwurf(
  app: App,
  headers: Record<string, string>,
  objectId: string,
  entwurfsInhalt: Record<string, unknown>,
  operationId: string,
) {
  const draftId = await entwurfAnlegen(app, headers, entwurfsInhalt);
  return einreichen(app, headers, objectId, draftId, {}, operationId);
}

/** Der frische Zweig: derselbe Inhalt direkt im Rumpf. */
async function frisch(
  app: App,
  headers: Record<string, string>,
  objectId: string,
  create: Record<string, unknown>,
  operationId: string,
) {
  const res = await ausDokument(app, headers, {
    operationId,
    create,
    documents: bündel(objectId),
  });
  return { res, body: res.json() as { error: string; message: string } };
}

async function bestand(app: App, headers: Record<string, string>) {
  const res = await app.inject({ method: "GET", url: "/api/kos", headers });
  expect(res.statusCode).toBe(200);
  return res.json() as Record<string, unknown>[];
}

// ==================================================================================================
// F. DER EINE NAME — F1, F2, F3: zwei Zweige, ein Versäumnis, eine Antwort.
// ==================================================================================================
describe("JOB 3618 (Q3 c) F: beide Zweige des Dokumentwegs nennen die fehlende Stufe gleich", () => {
  it("F1 — der ENTWURFS-Zweig ohne Stufe: 400 MISSING_CONFIDENTIALITY mit dem Satz des frischen Zweigs", async () => {
    const { app, headers, objectId } = await setup();
    const { res, body } = await überEntwurf(app, headers, objectId, INHALT, "job3618-f1");

    expect(res.statusCode).toBe(400);
    expect(body.error).toBe("MISSING_CONFIDENTIALITY");
    expect(body.message).toBe(SATZ);
  });

  it("F2 — derselbe Mangel am FRISCHEN Zweig: Code UND Satz sind dieselben wie in F1", async () => {
    // DIE EIGENTLICHE AUSSAGE DIESER DATEI. Nicht „der neue String steht im Code", sondern: zwei
    // verschiedene Routenzweige antworten auf DENSELBEN Mangel mit DERSELBEN Antwort. Verglichen
    // werden die beiden gemessenen Antworten MITEINANDER — nicht jede für sich gegen ein Literal.
    // Diese Form trägt auch dann noch, wenn jemand den Satz eines Tages an beiden Stellen ändert.
    const { app, headers, objectId } = await setup();
    const ausEntwurf = await überEntwurf(app, headers, objectId, INHALT, "job3618-f2-entwurf");
    const ausRumpf = await frisch(app, headers, objectId, INHALT, "job3618-f2-frisch");

    expect(ausRumpf.res.statusCode).toBe(ausEntwurf.res.statusCode);
    expect(ausRumpf.body.error).toBe(ausEntwurf.body.error);
    expect(ausRumpf.body.message).toBe(ausEntwurf.body.message);
    // Und der gemeinsame Wert ist der benannte, nicht zweimal derselbe Irrtum.
    expect(ausRumpf.body.error).toBe("MISSING_CONFIDENTIALITY");
    expect(ausRumpf.body.message).toBe(SATZ);
  });

  it("F3 — RANGFOLGE: fehlt ausser der Stufe auch der Titel, antworten beide Zweige gleich", async () => {
    // GEMESSEN, NICHT ANGENOMMEN (Auftrag Lieferung 1c): am frischen Zweig steht der Stufen-Wächter
    // VOR `ko.create`, das Fehlen der Stufe schlägt dort also zuerst an — auch wenn ein weiteres
    // Pflichtfeld fehlt. Der Entwurfs-Zweig hat dieselbe Rangfolge, sonst hinge der Name des
    // Versäumnisses davon ab, was SONST noch fehlt, und der Client bekäme für denselben Entwurf mal
    // den einen, mal den anderen Namen. Wieder werden die beiden Zweige MITEINANDER verglichen.
    const { app, headers, objectId } = await setup();
    const ausEntwurf = await überEntwurf(app, headers, objectId, KERN, "job3618-f3-entwurf");
    const ausRumpf = await frisch(app, headers, objectId, KERN, "job3618-f3-frisch");

    expect(ausEntwurf.res.statusCode).toBe(400);
    expect(ausRumpf.res.statusCode).toBe(400);
    expect(ausEntwurf.body.error).toBe(ausRumpf.body.error);
    expect(ausEntwurf.body.message).toBe(ausRumpf.body.message);
    expect(ausRumpf.body.error).toBe("MISSING_CONFIDENTIALITY");
    expect(ausRumpf.body.message).toBe(SATZ);
  });
});

// ==================================================================================================
// F4. DIE GRENZE — „fehlt" ist nicht „ist falsch". Was beim Umbenennen NICHT mitgehen darf.
// ==================================================================================================
describe("JOB 3618 (Q3 c) F4: ein VORHANDENER Wert ist kein fehlender und wird nicht umbenannt", () => {
  it("F4a — am DIENST: ein vorhandener, aber ungültiger Wert bricht mit INCOMPLETE ab", async () => {
    // Die naheliegende Halbheit wäre gewesen, `!isValidConfidentiality(...)` pauschal
    // umzubenennen. Dann trüge auch ein ungültiger Wert den Namen „fehlt" — und der frische Zweig
    // sagte für denselben Wert `INVALID_CONFIDENTIALITY`. Zwei Auslegungen desselben Wertes, genau
    // das, was Q3c abschafft. Deshalb steht der neue Ausgang auf `=== undefined`, und dieser Pin
    // hält die Grenze.
    const service = new CaptureService({ repo: new InMemoryDraftRepo() });
    for (const wert of ["geheim", "INTERN", "", null]) {
      const draft = await service.createDraft(
        {
          ...INHALT,
          confidentiality: wert as unknown as NonNullable<DraftPayload["confidentiality"]>,
        },
        "anna",
      );
      await expect(
        service.toKoInput(draft.id),
        `Wert ${JSON.stringify(wert)}`,
      ).rejects.toMatchObject({ code: "INCOMPLETE" });
    }
  });

  it("F4c — über die Fläche erreicht der ungültige Wert den Dokumentweg gar nicht", async () => {
    // WARUM F4a am Dienst und nicht an der App gemessen wird — gemessen, nicht gewählt:
    // `POST /api/drafts` weist einen ungültigen Wert BEREITS AN DER FLÄCHE mit 400 `BAD_REQUEST`
    // ab, es entsteht gar kein Entwurf, der ihn trüge. Die Unterscheidung „fehlt" vs. „ist falsch"
    // lebt aber in `toKoInput` — also wird sie dort gepinnt, wo sie steht.
    const { app, headers } = await setup();
    for (const wert of ["geheim", "INTERN", "", null]) {
      const res = await app.inject({
        method: "POST",
        url: "/api/drafts",
        headers,
        payload: { ...INHALT, confidentiality: wert },
      });
      expect(res.statusCode, `Wert ${JSON.stringify(wert)}`).toBe(400);
      expect((res.json() as { error: string }).error, `Wert ${JSON.stringify(wert)}`).toBe(
        "BAD_REQUEST",
      );
    }
    expect((await app.inject({ method: "GET", url: "/api/drafts", headers })).json()).toHaveLength(
      0,
    );
  });

  it("F4b — Stufe vorhanden, dafür fehlt der Titel: INCOMPLETE, und das bleibt so", async () => {
    // Die zweite Hälfte der Grenze: der Sammelcode gehört weiterhin den ÜBRIGEN Pflichtfeldern. Wer
    // den Stufenfall umbenennt, darf diesen Fall nicht mitnehmen.
    const { app, headers, objectId } = await setup();
    const { res, body } = await überEntwurf(
      app,
      headers,
      objectId,
      { ...KERN, confidentiality: "intern" },
      "job3618-f4b",
    );

    expect(res.statusCode).toBe(400);
    expect(body.error).toBe("INCOMPLETE");
    expect(await bestand(app, headers)).toHaveLength(0);
  });
});

// ==================================================================================================
// C. DIE ABWEISUNG IST FOLGENLOS UND UMKEHRBAR — F5 und F6.
// ==================================================================================================
describe("JOB 3618 (Q3 c) C: die Abweisung legt nichts an und der Entwurf bleibt nachtragbar", () => {
  it("F5 — abgewiesen: 0 Objekte, der Entwurf lebt unverändert · DERSELBE Entwurf mit nachgetragener Stufe: 201", async () => {
    // Ohne den positiven Gegenfall bewiese die Zählung nichts: „0 Objekte" wäre auch dann grün,
    // wenn der Dokumentweg überhaupt nichts mehr anlegte.
    //
    // UND ES IST DERSELBE ENTWURF, nicht ein zweiter (Prüflücke aus der Vorrunde): ein neuer
    // Entwurf bewiese nur, dass IRGENDETWAS durchgeht — nicht, dass genau der abgewiesene nach dem
    // Nachtragen der Stufe durchgeht. Erst das ist das Versprechen aus §9 des Auftrags: die
    // Abweisung verbraucht nichts, der Mensch trägt die Stufe nach und kommt durch.
    const { app, headers, services, objectId } = await setup();
    const abgewiesen = await überEntwurf(app, headers, objectId, INHALT, "job3618-f5-ohne");

    expect(abgewiesen.res.statusCode).toBe(400);
    expect(abgewiesen.body.error).toBe("MISSING_CONFIDENTIALITY");
    // Der Endzustand wird ERFRAGT, nicht aus dem Statuscode geschlossen.
    expect(await bestand(app, headers)).toHaveLength(0);

    // Der Entwurf steht unangetastet da — Inhalt vollständig, KEINE Nacharbeit angestossen und vor
    // allem keine still gesetzte Stufe (das wäre die erfundene Einstufung, die Q3 abgeschafft hat).
    const nachher = await app.inject({
      method: "GET",
      url: `/api/drafts/${abgewiesen.draftId}`,
      headers,
    });
    expect(nachher.statusCode).toBe(200);
    const stand = nachher.json() as { payload: Record<string, unknown>; status?: string };
    expect(stand.payload.title).toBe(INHALT.title);
    expect(stand.payload.statement).toBe(INHALT.statement);
    expect(stand.payload.type).toBe(INHALT.type);
    expect(stand.payload.category).toBe(INHALT.category);
    expect(stand.payload.confidentiality).toBeUndefined();
    // Der Entwurf ist weiterhin in der Liste des Menschen — nichts wurde verbraucht oder entfernt.
    expect((await app.inject({ method: "GET", url: "/api/drafts", headers })).json()).toHaveLength(
      1,
    );

    // DERSELBE Entwurf, Stufe nachgetragen: er geht durch.
    const angelegt = await einreichen(
      app,
      headers,
      objectId,
      abgewiesen.draftId,
      { confidentiality: "intern" },
      "job3618-f5-nachgetragen",
    );
    expect(angelegt.res.statusCode).toBe(201);
    const gebaut = await bestand(app, headers);
    expect(gebaut).toHaveLength(1);
    expect((gebaut[0] as { title: string }).title).toBe(INHALT.title);
    expect((gebaut[0] as { confidentiality: string }).confidentiality).toBe("intern");
    await services.aiCheckWorker?.idle();
  });

  it("F6 — die Auskunft hängt an der Feldliste, nicht am Namen des Abbruchs", async () => {
    // Die Auskunft („nächster sinnvoller Schritt") wird aus `KO_PFLICHTFELDER` /
    // `fehlendePflichtfelder` abgeleitet, nicht aus dem Fehlercode. Ein umbenannter Ausgang darf sie
    // deshalb nicht verschieben — sonst verlangte sie plötzlich andere Nacharbeit, als das
    // Einreichen wirklich vermisst: ein Entwurf ohne Stufe meldet weiterhin genau
    // `payload.confidentiality` als fehlendes Pflichtfeld.
    const { app, headers, objectId } = await setup();
    const { draftId, res } = await überEntwurf(app, headers, objectId, INHALT, "job3618-c2");
    expect(res.statusCode).toBe(400);

    const auskunft = await app.inject({
      method: "GET",
      url: `/api/drafts/${draftId}/naechster-schritt`,
      headers,
    });
    expect(auskunft.statusCode).toBe(200);
    const schritt = (auskunft.json() as { naechsterSchritt?: { art: string; herkunft: string[] } })
      .naechsterSchritt;
    expect(schritt?.art).toBe("vervollstaendigen");
    expect(schritt?.herkunft).toEqual(["payload.confidentiality"]);
  });
});
