import { describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// ==============================================================================================
// AUFTRAG-mega22 Blöcke A, B, C und D — DER ABDRUCK MUSS DECKEN, WAS GESCHRIEBEN WIRD.
// ==============================================================================================
//
// bens SB-A, SB-B und SB-D sind DERSELBE Mangel aus drei Richtungen, und diese Datei belegt sie
// deshalb gemeinsam — nach EINER Regel und nicht als drei Reparaturen:
//
//     DECKT DER ABDRUCK GENAU DAS AB, WAS DIESER REQUEST SCHREIBEN WIRD?
//
//   SB-A — die Kanonisierung löschte einen Unterschied, den der Entwurfs-Merge sehr wohl macht:
//          `fehlt` heisst „Altwert behalten", `""` heisst „Altwert löschen", und K2 machte beides
//          gleich. Zwei semantisch verschiedene Anfragen wurden unter demselben Vorgang als
//          identisch adoptiert; bei Parallelität entschied der GEWINNER über Erhalt oder Verlust.
//   SB-B — `anchor.thumbnail` blieb aus dem Abdruck und wurde anschliessend PERSISTIERT.
//   SB-D — der Altweg schickte den Entwurfsinhalt gar nicht mit, und `draftId` stand nicht im
//          Abdruck: verschiedene Entwürfe trugen denselben.
//
// Und Block D (bens SB-E) daneben, weil er dieselbe Fläche betrifft: `applyAndLoad` etikettierte
// JEDE Exception als Nutzer-Formfehler.
//
// Die Kanonisierungsregel selbst (K1–K8) ist in mega21-abdruck-kanon.test.ts gepinnt. HIER läuft
// alles gegen die ECHTE Route, mit echtem Objektspeicher und echtem Entwurfsdienst.

type App = ReturnType<typeof buildApp>;

const PDF_DATA_URL = `data:application/pdf;base64,${Buffer.from("%PDF-1.4 Pruefbericht").toString("base64")}`;

const INHALT = {
  title: "Dichtungswechsel L4",
  statement: "Dichtung vor jedem Anlauf prüfen.",
  type: "best_practice",
  category: "Instandhaltung",
  bodyHtml: "<p>Dichtung nach 500 h tauschen.</p>",
};

async function login(app: App, email: string, password: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  expect(res.statusCode).toBe(200);
  return { authorization: `Bearer ${res.json().token}` };
}

async function setup() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  return { app, headers: await login(app, "a@x.de", "secret123"), services };
}

async function objektAnlegen(app: App, headers: Record<string, string>, name = "Pruefbericht.pdf") {
  const obj = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers,
    payload: { name, mime: "application/pdf", data: PDF_DATA_URL },
  });
  expect(obj.statusCode).toBeLessThan(300);
  return obj.json().id as string;
}

async function entwurfAnlegen(
  app: App,
  headers: Record<string, string>,
  payload: Record<string, unknown> = INHALT,
) {
  const res = await app.inject({ method: "POST", url: "/api/drafts", headers, payload });
  expect(res.statusCode).toBeLessThan(300);
  return res.json().id as string;
}

function ausDokument(app: App, headers: Record<string, string>, payload: Record<string, unknown>) {
  return app.inject({ method: "POST", url: "/api/kos/from-document", headers, payload });
}

function bündel(objectId: string, extra: Record<string, unknown> = {}) {
  return [
    {
      anchor: { objectId, name: "Pruefbericht.pdf", mime: "application/pdf", ...extra },
      points: [{ label: "Pruefbericht.pdf", excerpt: "Dichtung nach 500 h tauschen." }],
    },
  ];
}

async function bestand(app: App, headers: Record<string, string>) {
  const res = await app.inject({ method: "GET", url: "/api/kos", headers });
  expect(res.statusCode).toBe(200);
  return res.json() as Record<string, unknown>[];
}

// ----------------------------------------------------------------------------------------------
// BLOCK A — `fehlt` GEGEN `leer`, an der echten Route.
// ----------------------------------------------------------------------------------------------
describe("mega22 A: derselbe Schlüssel, andere Schreibsemantik ⇒ IDEMPOTENCY_PAYLOAD_MISMATCH", () => {
  it('TEXTFELD — `bodyHtml` fehlt gegen `bodyHtml: ""`: der zweite Aufruf wird ABGEWIESEN', async () => {
    // DER VERLUSTPFAD, den das bis mega21 nicht sah. Der erste Aufruf lässt `bodyHtml` weg, der
    // Merge bewahrt also den gespeicherten Body. Der zweite schickt `bodyHtml: ""` — das LÖSCHT
    // ihn. Zwei verschiedene Schreibvorgänge unter EINEM Schlüssel: bis mega21 trugen sie denselben
    // Abdruck, der zweite bekam 200 mit dem Objekt des ersten, und niemand erfuhr, dass eine
    // Löschung stillschweigend nicht stattgefunden hat (oder, beim Rennen, doch).
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const draftId = await entwurfAnlegen(app, headers);

    const behalten = await ausDokument(app, headers, {
      operationId: "abdruck-text-1",
      draftId,
      draftPayload: { title: "Dichtungswechsel L4" },
      documents: bündel(objectId),
    });
    expect(behalten.statusCode).toBe(201);

    const zweiterEntwurf = await entwurfAnlegen(app, headers);
    const loeschen = await ausDokument(app, headers, {
      operationId: "abdruck-text-1",
      draftId: zweiterEntwurf,
      draftPayload: { title: "Dichtungswechsel L4", bodyHtml: "" },
      documents: bündel(objectId),
    });
    expect(loeschen.statusCode).toBe(409);
    expect(loeschen.json().error).toBe("IDEMPOTENCY_PAYLOAD_MISMATCH");
    // Kein zweites Objekt, und keines des ersten Vorgangs ausgeliefert.
    expect(await bestand(app, headers)).toHaveLength(1);
    expect(JSON.stringify(loeschen.json())).not.toContain("Dichtungswechsel L4");
  });

  it("LISTE — `pendingSources` fehlt gegen `pendingSources: []`: der zweite Aufruf wird ABGEWIESEN", async () => {
    // Dieselbe Regel für Listen. Fehlt `pendingSources`, bleiben die gespeicherten Belegstellen;
    // `pendingSources: []` löscht sie (normalizeDraftPayload setzt eine leere Liste nicht wieder
    // ein). Für den Belegvertrag dieses Produkts ist genau das der teure Unterschied.
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const draftId = await entwurfAnlegen(app, headers);

    const behalten = await ausDokument(app, headers, {
      operationId: "abdruck-liste-1",
      draftId,
      draftPayload: { title: "Dichtungswechsel L4" },
      documents: bündel(objectId),
    });
    expect(behalten.statusCode).toBe(201);

    const zweiterEntwurf = await entwurfAnlegen(app, headers);
    const loeschen = await ausDokument(app, headers, {
      operationId: "abdruck-liste-1",
      draftId: zweiterEntwurf,
      draftPayload: { title: "Dichtungswechsel L4", pendingSources: [] },
      documents: bündel(objectId),
    });
    expect(loeschen.statusCode).toBe(409);
    expect(loeschen.json().error).toBe("IDEMPOTENCY_PAYLOAD_MISMATCH");
    expect(await bestand(app, headers)).toHaveLength(1);
  });

  it("DIE KALIBRIERUNG — byte-identische Wiederholung wird weiterhin ADOPTIERT (200, kein Konflikt)", async () => {
    // Ohne diesen Fall wäre die Regel wertlos: sie darf nur ECHTE Unterschiede melden. Eine
    // wortgleiche Wiederholung — genau das, was ein Browser-Retry schickt — ist derselbe Vorgang.
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const draftId = await entwurfAnlegen(app, headers);
    const payload = {
      operationId: "abdruck-kalibrierung-1",
      draftId,
      draftPayload: { title: "Dichtungswechsel L4", bodyHtml: "" },
      documents: bündel(objectId),
    };

    const erst = await ausDokument(app, headers, payload);
    expect(erst.statusCode).toBe(201);
    const zweit = await ausDokument(app, headers, payload);
    expect(zweit.statusCode).toBe(200);
    expect(zweit.json().id).toBe(erst.json().id);
    expect(await bestand(app, headers)).toHaveLength(1);
  });
});

// ----------------------------------------------------------------------------------------------
// BLOCK B — DAS PERSISTIERTE THUMBNAIL.
// ----------------------------------------------------------------------------------------------
describe("mega22 B: gleiches Original, verschiedenes Thumbnail — nicht mehr gewinnerabhängig", () => {
  it("das Thumbnail wird NICHT MEHR PERSISTIERT — es gibt nichts, worüber ein Gewinner entscheiden könnte", async () => {
    // DER BEFUND. `anchor.thumbnail` blieb bewusst aus dem Abdruck, wurde aber als Bestandteil des
    // KO-Anhangs geschrieben. Zwei parallele Anfragen mit demselben Schlüssel, demselben Original
    // und VERSCHIEDENEM Thumbnail trugen damit denselben Abdruck und erzeugten je nach Gewinner
    // verschiedenen gespeicherten Anzeigeinhalt.
    //
    // Der gewählte Weg beseitigt die Klasse statt sie zu verwalten: der Server LIEST das Feld nicht
    // mehr. Damit ist die Frage „welches Thumbnail gewinnt?" gegenstandslos.
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);

    const res = await ausDokument(app, headers, {
      operationId: "thumb-ignoriert-1",
      create: INHALT,
      documents: bündel(objectId, { thumbnail: "data:image/png;base64,AAAA" }),
    });
    expect(res.statusCode).toBe(201);
    const anhang = res.json().attachments[0];
    expect(anhang.objectId).toBe(objectId);
    // Das Original ist gebunden — nur die vom Client gelieferten Anzeigedaten sind es nicht.
    expect(anhang.thumbnail).toBeUndefined();
    expect(JSON.stringify(res.json())).not.toContain("AAAA");
  });

  it("ZWEI ANFRAGEN, ZWEI VERSCHIEDENE VORSCHAUEN, EIN Vorgang: identisches Ergebnis, egal wer gewinnt", async () => {
    // Der eigentliche Beleg: das gespeicherte Objekt ist von der mitgeschickten Vorschau
    // UNABHÄNGIG. Der zweite Aufruf trägt eine ANDERE Vorschau und ist trotzdem dieselbe
    // Wiederholung (200, kein Konflikt) — und das Objekt sieht in beiden Fällen gleich aus.
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);

    const a = await ausDokument(app, headers, {
      operationId: "thumb-rennen-1",
      create: INHALT,
      documents: bündel(objectId, { thumbnail: "data:image/png;base64,AAAA" }),
    });
    const b = await ausDokument(app, headers, {
      operationId: "thumb-rennen-1",
      create: INHALT,
      documents: bündel(objectId, { thumbnail: "data:image/png;base64,ZZZZ" }),
    });
    expect(a.statusCode).toBe(201);
    // KEIN Abdruckkonflikt: eine andere Vorschau ist keine Inhaltsänderung — der Nutzer soll für
    // etwas, das er nicht geändert hat, nicht büssen. Genau diese Zusage aus mega21 steht noch.
    expect(b.statusCode).toBe(200);
    expect(b.json().id).toBe(a.json().id);
    // Und der gespeicherte Anzeigeinhalt hängt an keinem von beiden.
    expect(JSON.stringify(b.json())).not.toContain("AAAA");
    expect(JSON.stringify(b.json())).not.toContain("ZZZZ");
    expect(await bestand(app, headers)).toHaveLength(1);
  });
});

// ----------------------------------------------------------------------------------------------
// BLOCK C — `draftId` OHNE `draftPayload`.
// ----------------------------------------------------------------------------------------------
describe("mega22 C: der Altweg ohne draftPayload ist geschlossen", () => {
  it("RICHTUNG 1 — `draftId` ohne `draftPayload` ⇒ 400, mit einer Meldung, die den GRUND nennt", async () => {
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const draftId = await entwurfAnlegen(app, headers);

    const res = await ausDokument(app, headers, {
      operationId: "altweg-1",
      draftId,
      documents: bündel(objectId),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("draftPayload");
    // Die Meldung erklärt, WARUM — nicht nur, DASS.
    expect(res.json().message).toContain("Wiederholung");
    // Nichts ist entstanden, und der Entwurf steht unberührt.
    expect(await bestand(app, headers)).toHaveLength(0);
    const entwuerfe = await app.inject({ method: "GET", url: "/api/drafts", headers });
    expect(entwuerfe.json()).toHaveLength(1);
  });

  it("RICHTUNG 2 — mit `draftPayload` läuft der Weg, und ZWEI VERSCHIEDENE Entwürfe sind zwei Vorgänge", async () => {
    // Der eigentliche Schaden von SB-D: nach einem ersten Erfolg konnte ein Wiederholversuch mit
    // ANDERER Entwurfs-Kennung als identisch adoptiert werden — der zweite Entwurf blieb
    // unangetastet, und der Aufrufer bekam das Objekt des ersten Vorgangs, ohne es zu erfahren.
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const ersterEntwurf = await entwurfAnlegen(app, headers);
    const zweiterEntwurf = await entwurfAnlegen(app, headers);
    const ladung = { title: "Dichtungswechsel L4" };

    const erst = await ausDokument(app, headers, {
      operationId: "zwei-entwuerfe-1",
      draftId: ersterEntwurf,
      draftPayload: ladung,
      documents: bündel(objectId),
    });
    expect(erst.statusCode).toBe(201);

    // GLEICHE Ladung, GLEICHE Dokumente, GLEICHER Schlüssel — aber ein ANDERER Entwurf. Der
    // Request würde einen anderen Entwurf verbrauchen, ist also nicht derselbe Vorgang.
    const anderer = await ausDokument(app, headers, {
      operationId: "zwei-entwuerfe-1",
      draftId: zweiterEntwurf,
      draftPayload: ladung,
      documents: bündel(objectId),
    });
    expect(anderer.statusCode).toBe(409);
    expect(anderer.json().error).toBe("IDEMPOTENCY_PAYLOAD_MISMATCH");
    // Der zweite Entwurf ist unangetastet — er wurde nicht stillschweigend als „schon erledigt"
    // behandelt.
    const entwuerfe = await app.inject({ method: "GET", url: "/api/drafts", headers });
    expect((entwuerfe.json() as { id: string }[]).map((d) => d.id)).toContain(zweiterEntwurf);
  });
});

// ----------------------------------------------------------------------------------------------
// BLOCK D — FORMFEHLER GEGEN STÖRUNG.
// ----------------------------------------------------------------------------------------------
describe("mega22 D: applyAndLoad unterscheidet Formfehler von Störungen", () => {
  it("FORMFEHLER — `draftPayload: null` wird 400 mit einer SAUBEREN Meldung, nicht mit einem TypeError-Text", async () => {
    // Bis mega21 lief `mergeDraftPayload` hier in `Object.entries(null)`, und der Rohtext
    // („Cannot convert undefined or null to object") ging als 400-Meldung an den Client.
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const draftId = await entwurfAnlegen(app, headers);

    const res = await ausDokument(app, headers, {
      operationId: "formfehler-1",
      draftId,
      draftPayload: null,
      documents: bündel(objectId),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("draftPayload");
    // KEINE Rohmeldung aus der Tiefe.
    expect(res.json().message).not.toContain("Cannot convert");
    expect(res.json().message).not.toContain("undefined");
  });

  it("FORMFEHLER — falscher Typ in einem Feld wird am RAND abgewiesen und benennt das Feld", async () => {
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const draftId = await entwurfAnlegen(app, headers);

    const res = await ausDokument(app, headers, {
      operationId: "formfehler-2",
      draftId,
      draftPayload: { title: 42 },
      documents: bündel(objectId),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("draftPayload.title");
  });

  it("STÖRUNG — eine Repository-Störung wird NICHT 400 und trägt KEINE Rohmeldung nach aussen", async () => {
    // DER KERN VON SB-E. Ein Repository- oder Datenbankfehler kam beim Aufrufer als „deine Eingabe
    // ist ungültig" an. Der Client löscht daraufhin seinen Vorgangsschlüssel (4xx gilt als
    // eindeutige Ablehnung) — und wirft die Wiederholbarkeit genau dann weg, wenn er sie braucht.
    const { app, headers, services } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const draftId = await entwurfAnlegen(app, headers);

    const geheim = "PGCONN geheim-passwort@db-host:5432 kaputt";
    vi.spyOn(services.capture, "continueDraft").mockRejectedValue(new Error(geheim));

    const res = await ausDokument(app, headers, {
      operationId: "stoerung-1",
      draftId,
      draftPayload: { title: "Dichtungswechsel L4" },
      documents: bündel(objectId),
    });

    // NICHT 400 — es ist kein Formfehler.
    expect(res.statusCode).not.toBe(400);
    expect(res.statusCode).toBeGreaterThanOrEqual(500);
    // Und die Rohmeldung ist NIRGENDS in der Antwort.
    expect(res.body).not.toContain("geheim-passwort");
    expect(res.body).not.toContain("db-host");
    expect(res.body).not.toContain("PGCONN");
    // Kein halbes Wissensobjekt.
    expect(await bestand(app, headers)).toHaveLength(0);
    vi.restoreAllMocks();
  });

  it("DIE KALIBRIERUNG — ein ECHTER Fachfehler des Entwurfs bleibt 400 und behält seine Meldung", async () => {
    // `validateMetadata` wirft `INVALID_NEEDED` als CaptureError. Das IST ein Formfehler, seine
    // Meldung ist für Menschen geschrieben und darf nach aussen. Ohne diesen Fall hätte Block D
    // die Fehlerklassen nur in die andere Richtung falsch sortiert.
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const draftId = await entwurfAnlegen(app, headers);

    const res = await ausDokument(app, headers, {
      operationId: "fachfehler-1",
      draftId,
      draftPayload: { neededValidations: 99 },
      documents: bündel(objectId),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("Nötige Validierungen");
  });
});
