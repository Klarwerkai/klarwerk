// ==================================================================================================
// JOB 3569 (Q3 c) — DIE STUFENPFLICHT AM DOKUMENTWEG, DER VIERTEN TÜR.
// ==================================================================================================
//
// WAS DIESE DATEI IST. Der vermessene Vertrag von `POST /api/kos/from-document` in Sachen
// Vertraulichkeitsstufe — und die Beobachtung, dass eine Abweisung nicht nur kein OBJEKT, sondern
// auch keine WIRKUNG hinterlässt.
//
// WARUM ES SIE GIBT. `tests/q3c-stufenpflicht/stufenpflicht-am-schreibweg.test.ts:7-10` zählt drei
// Anlagewege auf und nennt sie „alle drei zu". Die Zählung war unvollständig: neben
// `POST /api/kos` steht mit `POST /api/kos/from-document` eine ZWEITE authentifizierte Anlageroute
// mit demselben Recht (`ko.create`) und demselben Ergebnis (ein neues Wissensobjekt). Sie legte
// ohne Stufe an. Diese Datei schliesst den vierten Weg und lässt den Vertrag des Vorgängers
// unangetastet — er steht unverändert in seinem eigenen Ordner.
//
// WARUM DIE BEOBACHTUNG UND NICHT DIE BEHAUPTUNG. `archiv/3429/runde-3/ben.md:31` und `:39`:
// „Der Fall ‚vor jeder Wirkung' prüft lediglich Antwort und Objektbestand. Ergänzungsvorschlag:
// Zuweisungen und Benachrichtigungen direkt beobachten." Hier werden deshalb Prüfer-Zuweisung,
// Benachrichtigung, KI-Prüf-Vermerk, Einreihung und Entwurfs-Löschung EINZELN beobachtet — und
// jede Beobachtung hat im selben Lauf einen POSITIVEN Gegenfall, in dem sie tatsächlich anschlägt.
// Eine Beobachtung, die nie feuert, beweist nichts.
import { describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;

const PDF_DATA_URL = `data:application/pdf;base64,${Buffer.from("%PDF-1.4 Pruefbericht").toString("base64")}`;

/** Der Inhalt OHNE die Stufe — jeder Fall setzt (oder unterschlägt) sie ausdrücklich. */
const INHALT = {
  title: "Dichtungswechsel L4",
  statement: "Dichtung vor jedem Anlauf prüfen.",
  type: "best_practice",
  category: "Instandhaltung",
  bodyHtml: "<p>Dichtung nach 500 h tauschen.</p>",
} as const;

async function login(app: App, email: string, password: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  return { authorization: `Bearer ${res.json().token}` };
}

/**
 * Ein angemeldeter Admin, ein zweiter echter Nutzer als Prüfer — der zweite ist keine Zierde: der
 * Benachrichtiger (`services/app/src/notify.ts`) schlägt jede Empfängerkennung in `auth.listUsers`
 * nach und überspringt Unbekannte stillschweigend. Mit einer erfundenen Kennung könnte der
 * POSITIVE Gegenfall gar nicht anschlagen, und die negative Beobachtung wäre wertlos.
 */
async function setup() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const headers = await login(app, "a@x.de", "secret123");
  const pruefer = await app.inject({
    method: "POST",
    url: "/api/users",
    headers,
    payload: { name: "Bea", email: "b@x.de", password: "secret123", role: "experte" },
  });
  expect(pruefer.statusCode).toBeLessThan(300);
  return { app, headers, services, prueferId: pruefer.json().id as string };
}

/**
 * Die fünf Wirkungen, die am Dokumentweg HINTER der Anlage hängen
 * (`services/app/src/routes/ko-routes.ts:1530-1555`). Beobachtet wird an den Diensten selbst, nicht
 * an einer Attrappe der Route: `aiCheckWorker` wird erst in `buildApp` erzeugt und danach an
 * `services` zurückgeschrieben (`build-app.ts:1913`) — es ist dasselbe Objekt, das die Route hält.
 */
function beobachter(services: ReturnType<typeof buildServices>) {
  const worker = services.aiCheckWorker;
  // Kein `!`: fehlte der Worker, würden „Vermerk" und „Einreihung" als Beobachtung stillschweigend
  // wegfallen und die Nebenwirkungsfälle blieben grün, ohne etwas zu decken.
  expect(worker, "buildApp muss den KI-Prüf-Worker gesetzt haben").toBeDefined();
  return {
    zuweisung: vi.spyOn(services.validation, "assign"),
    benachrichtigung: vi.spyOn(services.mailer, "send"),
    pruefVermerk: vi.spyOn(services.ko, "markAiCheckPending"),
    einreihung: vi.spyOn(worker as NonNullable<typeof worker>, "enqueue"),
    // JOB 3668 RUNDE 2: DERSELBE VORGANG, NEUER NAME. Die Dokumentübernahme nimmt den Entwurf
    // nicht mehr über `deleteDraft` (weich, Papierkorb) zurück, sondern über `entwurfVerbraucht`
    // (hart) — ein übernommener Entwurf ist verbraucht und darf nicht wiederherstellbar sein,
    // sonst stünde er als Dublette neben dem Wissensobjekt aus ihm. Was dieser Beobachter misst,
    // bleibt unverändert: DASS der Entwurf zurückgenommen wurde und mit welcher Kennung.
    entwurfsRuecknahme: vi.spyOn(services.capture, "entwurfVerbraucht"),
  };
}

async function objektAnlegen(app: App, headers: Record<string, string>) {
  const obj = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers,
    payload: { name: "Pruefbericht.pdf", mime: "application/pdf", data: PDF_DATA_URL },
  });
  expect(obj.statusCode).toBeLessThan(300);
  return obj.json().id as string;
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

async function bestand(app: App, headers: Record<string, string>) {
  const res = await app.inject({ method: "GET", url: "/api/kos", headers });
  expect(res.statusCode).toBe(200);
  return res.json() as Record<string, unknown>[];
}

// ==================================================================================================
// 1. DIE GRENZE — ohne Stufe entsteht auch über den Dokumentweg kein Wissensobjekt.
// ==================================================================================================
describe("JOB 3569 (Q3 c): der Dokumentweg legt ohne Stufe nichts an", () => {
  it("OHNE Stufe wird abgewiesen — benannter Eingabefehler, NICHT 500, und kein Objekt entsteht", async () => {
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const res = await ausDokument(app, headers, {
      operationId: "job3569-ohne-stufe-1",
      create: INHALT,
      documents: bündel(objectId),
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: string; message: string };
    expect(body.error).toBe("MISSING_CONFIDENTIALITY");
    // Derselbe lesbare Satz wie am ersten Weg — keine maskierte Interna-Meldung, kein zweiter Wortlaut.
    expect(body.message).toContain("Vertraulichkeitsstufe");
    expect(body.error).not.toBe("INTERNAL");
    // Fail-closed: der Endzustand wird beim Server ERFRAGT, nicht aus dem Status geraten.
    expect(await bestand(app, headers)).toHaveLength(0);
  });

  it("MIT Stufe legt an — und die Stufe steht am Objekt (kein Verlust auf dem Weg)", async () => {
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const res = await ausDokument(app, headers, {
      operationId: "job3569-mit-stufe-1",
      create: { ...INHALT, confidentiality: "vertraulich" },
      documents: bündel(objectId),
    });
    expect(res.statusCode).toBe(201);
    expect((res.json() as { confidentiality?: string }).confidentiality).toBe("vertraulich");
  });

  it("NUR DAS FEHLEN steht an der Route — ein ungültiger Wert bleibt Sache des Dienstes", async () => {
    // Keine zweite Auslegung desselben Wertes: `INVALID_CONFIDENTIALITY` kommt weiterhin aus dem
    // Dienst (`ko-routes.ts:1065-1067` beschreibt dieselbe Arbeitsteilung am ersten Weg). Auch
    // `null` gehört dorthin — ein Leerwert ist eine falsche Angabe, keine fehlende.
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);
    let lauf = 0;
    for (const wert of ["geheim", "INTERN", "", null]) {
      const res = await ausDokument(app, headers, {
        operationId: `job3569-ungueltig-${++lauf}`,
        create: { ...INHALT, confidentiality: wert },
        documents: bündel(objectId),
      });
      expect(res.statusCode, `Wert ${JSON.stringify(wert)}`).toBe(400);
      expect((res.json() as { error: string }).error, `Wert ${JSON.stringify(wert)}`).toBe(
        "INVALID_CONFIDENTIALITY",
      );
    }
    expect(await bestand(app, headers)).toHaveLength(0);
  });
});

// ==================================================================================================
// 2. DIE NEBENWIRKUNGSFREIHEIT — beobachtet, nicht behauptet (ben, archiv/3429/runde-3/ben.md:31).
// ==================================================================================================
describe("JOB 3569 (Q3 c): die Abweisung am Dokumentweg löst KEINE Nacharbeit aus", () => {
  it("weder Zuweisung noch Benachrichtigung noch KI-Prüf-Vermerk noch Einreihung", async () => {
    const { app, headers, services, prueferId } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const spione = beobachter(services);
    const res = await ausDokument(app, headers, {
      operationId: "job3569-wirkungsfrei-1",
      create: INHALT,
      documents: bündel(objectId),
      reviewerIds: [prueferId],
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: string }).error).toBe("MISSING_CONFIDENTIALITY");
    expect(spione.zuweisung).not.toHaveBeenCalled();
    expect(spione.benachrichtigung).not.toHaveBeenCalled();
    expect(spione.pruefVermerk).not.toHaveBeenCalled();
    expect(spione.einreihung).not.toHaveBeenCalled();
    expect(await bestand(app, headers)).toHaveLength(0);
  });

  it("POSITIVER GEGENFALL: derselbe Aufruf MIT Stufe lässt genau diese vier anschlagen", async () => {
    // Ohne diesen Fall bewiese der vorige nichts: vier Beobachtungen, die auch bei richtiger
    // Verdrahtung nie feuern könnten, wären vier immer-grüne Zeilen.
    const { app, headers, services, prueferId } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const spione = beobachter(services);
    const res = await ausDokument(app, headers, {
      operationId: "job3569-wirkung-positiv-1",
      create: { ...INHALT, confidentiality: "intern" },
      documents: bündel(objectId),
      reviewerIds: [prueferId],
    });
    expect(res.statusCode).toBe(201);
    expect(spione.zuweisung).toHaveBeenCalledTimes(1);
    expect(spione.benachrichtigung).toHaveBeenCalledTimes(1);
    expect(spione.pruefVermerk).toHaveBeenCalledTimes(1);
    expect(spione.einreihung).toHaveBeenCalledTimes(1);
    await services.aiCheckWorker?.idle();
  });

  it("der fortgesetzte ENTWURF überlebt die Abweisung — POSITIVER GEGENFALL: sonst wird er verbraucht", async () => {
    // Die fünfte Wirkung, die nur der Entwurfs-Zweig hat: der gelungene Vorgang LÖSCHT den Entwurf
    // (`ko-routes.ts:1533-1535`). Beide Richtungen in einem Fall, damit die Beobachtung nachweislich
    // feuern kann.
    const { app, headers, services } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const ohneStufe = await entwurfAnlegen(app, headers, INHALT);
    const spione = beobachter(services);
    const abgewiesen = await ausDokument(app, headers, {
      operationId: "job3569-entwurf-ohne-stufe-1",
      draftId: ohneStufe,
      expectedUpdatedAt: await entwurfsStand(app, headers, ohneStufe),
      draftPayload: {},
      documents: bündel(objectId),
    });
    expect(abgewiesen.statusCode).toBe(400);
    // GEMESSEN (JOB 3569 Lieferung 1b), nicht angenommen: dieser Zweig war SCHON ZU — aber unter
    // einem anderen Namen. `applyAndLoad` → `capture.toKoInput` wirft seit JOB 3082 `INCOMPLETE`
    // (`services/capture/src/service.ts`, `KO_PFLICHTFELDER`); der neue Routen-Wächter liegt
    // dahinter und feuert hier nie. Der Test hält den IST-Zustand fest, damit ein späterer Wechsel
    // des Namens auffällt, statt unbemerkt zu bleiben.
    expect((abgewiesen.json() as { error: string }).error).toBe("INCOMPLETE");
    expect(spione.entwurfsRuecknahme).not.toHaveBeenCalled();
    expect(await bestand(app, headers)).toHaveLength(0);
    // Der Entwurf steht unverändert im Bestand — nichts wurde nebenbei vernichtet.
    expect((await app.inject({ method: "GET", url: "/api/drafts", headers })).json()).toHaveLength(
      1,
    );

    const mitStufe = await entwurfAnlegen(app, headers, {
      ...INHALT,
      confidentiality: "intern",
    });
    const angelegt = await ausDokument(app, headers, {
      operationId: "job3569-entwurf-mit-stufe-1",
      draftId: mitStufe,
      expectedUpdatedAt: await entwurfsStand(app, headers, mitStufe),
      draftPayload: {},
      documents: bündel(objectId),
    });
    expect(angelegt.statusCode).toBe(201);
    expect(spione.entwurfsRuecknahme).toHaveBeenCalledWith(mitStufe);
    await services.aiCheckWorker?.idle();
  });
});

// ==================================================================================================
// 3. DIE REIHENFOLGE — der Wächter steht UNTER dem Wiederholungs-Nachschlag.
// ==================================================================================================
describe("JOB 3569 (Q3 c): die Wiederholung eines gelungenen Vorgangs bleibt 200", () => {
  it("frischer Weg: derselbe Vorgang zweimal ⇒ 201, dann 200 mit DEMSELBEN Objekt", async () => {
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const payload = {
      operationId: "job3569-wiederholung-frisch-1",
      create: { ...INHALT, confidentiality: "intern" },
      documents: bündel(objectId),
    };
    const erst = await ausDokument(app, headers, payload);
    expect(erst.statusCode).toBe(201);
    const zweit = await ausDokument(app, headers, payload);
    expect(zweit.statusCode).toBe(200);
    expect((zweit.json() as { id: string }).id).toBe((erst.json() as { id: string }).id);
    expect(await bestand(app, headers)).toHaveLength(1);
  });

  it("Entwurfs-Weg: die Wiederholung trägt die Stufe NICHT im Rumpf und bleibt trotzdem 200", async () => {
    // Der schärfere Fall, und der Grund, warum der Wächter `input` prüft und nicht den Rumpf: hier
    // steht die Stufe IM ENTWURF, `draftPayload` ist leer. Ein Wächter, der über dem Nachschlag
    // stünde oder `body.create` läse, machte aus der Wiederholung eines GELUNGENEN Vorgangs einen
    // 400 — für einen Entwurf, den der erste Aufruf bereits verbraucht hat.
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const draftId = await entwurfAnlegen(app, headers, { ...INHALT, confidentiality: "intern" });
    const payload = {
      operationId: "job3569-wiederholung-entwurf-1",
      draftId,
      expectedUpdatedAt: await entwurfsStand(app, headers, draftId),
      draftPayload: {},
      documents: bündel(objectId),
    };
    const erst = await ausDokument(app, headers, payload);
    expect(erst.statusCode).toBe(201);
    const zweit = await ausDokument(app, headers, payload);
    expect(zweit.statusCode).toBe(200);
    expect((zweit.json() as { id: string }).id).toBe((erst.json() as { id: string }).id);
    expect(await bestand(app, headers)).toHaveLength(1);
  });
});

// ==================================================================================================
// 4. DIESELBE BEOBACHTUNG AM ERSTEN WEG — die Lücke, die ben benannt hat (ben.md:31).
// ==================================================================================================
describe("JOB 3569 (Q3 c): auch `POST /api/kos` löst ohne Stufe keine Nacharbeit aus", () => {
  it("Prüfer-Vorschläge lösen nichts aus — beobachtet an Zuweisung, Meldung, Vermerk, Einreihung", async () => {
    const { app, headers, services, prueferId } = await setup();
    const spione = beobachter(services);
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: { ...INHALT, reviewerIds: [prueferId] },
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: string }).error).toBe("MISSING_CONFIDENTIALITY");
    expect(spione.zuweisung).not.toHaveBeenCalled();
    expect(spione.benachrichtigung).not.toHaveBeenCalled();
    expect(spione.pruefVermerk).not.toHaveBeenCalled();
    expect(spione.einreihung).not.toHaveBeenCalled();
    expect(await bestand(app, headers)).toHaveLength(0);
  });

  it("POSITIVER GEGENFALL: derselbe Aufruf MIT Stufe lässt genau diese vier anschlagen", async () => {
    const { app, headers, services, prueferId } = await setup();
    const spione = beobachter(services);
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: { ...INHALT, confidentiality: "intern", reviewerIds: [prueferId] },
    });
    expect(res.statusCode).toBe(201);
    expect(spione.zuweisung).toHaveBeenCalledTimes(1);
    expect(spione.benachrichtigung).toHaveBeenCalledTimes(1);
    expect(spione.pruefVermerk).toHaveBeenCalledTimes(1);
    expect(spione.einreihung).toHaveBeenCalledTimes(1);
    await services.aiCheckWorker?.idle();
  });
});
