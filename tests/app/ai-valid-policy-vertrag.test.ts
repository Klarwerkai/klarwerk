// ================================================================================================
// JOB 738 D3 — DER IST-STAND DER KI-VALIDIERUNG, GEMESSEN STATT BEHAUPTET
// ================================================================================================
//
// DER BEFUND, den BEN3 im D2-Vollurteil als tragend benennt:
//
//   > „Die aktuelle Base wurde fuer Route, Worker, Statuskarte und Badge nicht nachgemessen; die
//   > sieben Policy-Status sowie Persistenz und Audit bleiben unerhoben; und Start nach Antwort,
//   > Timeout, `no-model`, Versionsbindung und Retry besitzen weiterhin keinen unabhaengigen
//   > Wirkungsbeleg."
//
// und in den drei offenen Sachfragen:
//
//   1. „Aktuelle Ist-Evidenz aus Route, Worker, Statuskarte und Badge auf der gebundenen Base
//      vervollstaendigen."
//   2. „Sieben Policy-Status, Persistenz und Audit erheben."
//   3. „In autorisierter Umgebung den unabhaengigen Wirkungsbeleg fuer Queue, Frist, Modell,
//      Datenbank, Versionsbindung und Retry fuehren."
//
// DIESE DATEI IST DIE ERHEBUNG — und zwar als DAUERHAFTER Vertrag statt als Bericht. Ein Bericht
// veraltet mit dem naechsten Commit; genau daran ist D1 gescheitert (Belege von einer
// Vorgaengerbase, aus einem fremden Job uebernommen). Was hier steht, misst bei jedem Lauf neu.
//
// ==============================================================================================
// ZUR BEHAUPTUNG „NICHT ERBRINGBAR" — SIE TRIFFT NUR FUER EINEN TEIL
// ==============================================================================================
//
// D2 schrieb zu Mangel 3: „Der verlangte unabhängige Wirkbeleg braucht einen Lauf mit
// Warteschlange, Frist, Modell und Datenbank … Dieser Beleg ist in dieser Umgebung nicht
// erbringbar — nicht schwer, sondern unmöglich."
//
// AM CODE NACHGEMESSEN STIMMT DAS SO NICHT. `createAiCheckWorker` nimmt `run`, `now`, `log` und
// `jobTimeoutMs` als Abhaengigkeiten (`ai-check-worker.ts:215-223`) und bietet `idle()`
// ausdruecklich „fuer Tests" an (`:211-212`). Warteschlange und Frist leben vollstaendig
// IN-PROCESS; `no-model` entsteht aus `reasoner.status().active === false` und braucht deshalb
// gerade KEIN Modell; die Versionsbindung ist ein bedingter Feld-Patch am KO.
//
// Ein Modell und eine echte Datenbank braucht nur EINE Aussage: dass ein ECHTER Providerfehler
// (auth/rate-limit/unreachable/bad-response) im Live-Betrieb entsteht. Die ZUORDNUNG solcher Fehler
// ist dagegen eine reine Funktion und hier direkt geprueft.
//
// WAS HIER AUSDRUECKLICH NICHT ENTSCHIEDEN WIRD: `OF-1` bis `OF-3` — ob die gebaute Automatik die
// Policy-Empfehlung „manueller Knopf zuerst" abloest, wie „erst in Validierung" zu lesen ist und ob
// die Policy-Status vollstaendig abgebildet werden sollen. Das sind Ownerfragen. Diese Datei sagt
// nur, WAS HEUTE IST.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AI_CHECK_CONCURRENCY,
  AI_CHECK_STALE_PENDING_MS,
  type AiCheckFailureReason,
  MAX_AI_CHECK_QUEUE,
  classifyAiCheckFailure,
  createAiCheckRunner,
  createAiCheckWorker,
  reasonFromModelFailure,
  shouldReEnqueueAiCheck,
} from "../../services/app/src/ai-check-worker";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";

afterEach(() => {
  vi.unstubAllGlobals();
});

async function appMitNutzer(mutate?: (services: AppServices) => void) {
  const services = buildServices();
  mutate?.(services);
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "p738@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "p738@x.de", password: "secret123" },
  });
  return {
    app,
    services,
    headers: { authorization: `Bearer ${(login.json() as { token: string }).token}` },
  };
}

async function reicheEin(
  app: Awaited<ReturnType<typeof appMitNutzer>>["app"],
  headers: Record<string, string>,
  title: string,
) {
  return app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: { title, statement: `Aussage zu ${title}.`, type: "best_practice", category: "K" },
  });
}

/** Wartet auf eine Bedingung, ohne feste Zeit zu raten (die Queue arbeitet in Microtasks). */
async function bisWahr(pruefung: () => boolean, versuche = 200): Promise<boolean> {
  for (let i = 0; i < versuche; i += 1) {
    if (pruefung()) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 1));
  }
  return pruefung();
}

// ================================================================================================
// A · MANGEL 1 — ROUTE UND WORKER AUF DIESER BASE
// ================================================================================================

describe("JOB 738 D3 · A · die Einreich-Route und der Worker, hier gemessen", () => {
  it("die 201-Antwort trägt den PRÜFVERMERK, nicht das Prüfergebnis", async () => {
    const { app, headers } = await appMitNutzer();

    const antwort = await reicheEin(app, headers, "Vermerk in der Antwort");

    expect(antwort.statusCode).toBe(201);
    const ko = antwort.json() as {
      version: number;
      aiCheck?: { status?: string; koVersion?: number; finishedAt?: string };
    };
    // DAS IST DER KERN VON „Start NACH Antwort": Der Nutzer bekommt seine Antwort, während die
    // Prüfung noch aussteht. Stünde hier schon `done`, hätte die Route synchron geprüft.
    expect(ko.aiCheck?.status, "die Antwort meldet einen laufenden Job").toBe("pending");
    expect(ko.aiCheck?.finishedAt, "ein laufender Job hat kein Ende").toBeUndefined();
    // Die harte Bindung an die Inhaltsversion reist im Vermerk mit.
    expect(ko.aiCheck?.koVersion).toBe(ko.version);
  });

  it("erst NACH der Antwort schließt der Worker den Job ab — und er wird endgültig", async () => {
    const { app, services, headers } = await appMitNutzer();

    const antwort = await reicheEin(app, headers, "Abschluss nach der Antwort");
    const id = (antwort.json() as { id: string }).id;
    expect((antwort.json() as { aiCheck?: { status?: string } }).aiCheck?.status).toBe("pending");

    await services.aiCheckWorker?.idle();

    const danach = await services.ko.get(id);
    expect(["done", "failed"], "nach idle() ist der Job endgültig").toContain(
      danach?.aiCheck?.status,
    );
    expect(danach?.aiCheck?.finishedAt, "ein endgültiger Job trägt sein Ende").toBeTruthy();
  });

  it("der Worker arbeitet genau EINEN Job gleichzeitig", async () => {
    const services = buildServices();
    let gleichzeitig = 0;
    let hoechstens = 0;
    const worker = createAiCheckWorker({
      ko: services.ko,
      log: () => undefined,
      run: async () => {
        gleichzeitig += 1;
        hoechstens = Math.max(hoechstens, gleichzeitig);
        await new Promise((r) => setTimeout(r, 2));
        gleichzeitig -= 1;
        return { ok: true };
      },
    });

    for (const id of ["a", "b", "c", "d"]) {
      worker.enqueue(id, 1);
    }
    await worker.idle();

    expect(hoechstens, "mehr Parallelität staut nur das Modellkontingent gegen sich selbst").toBe(
      AI_CHECK_CONCURRENCY,
    );
    expect(AI_CHECK_CONCURRENCY).toBe(1);
  });

  it("derselbe Job steht nie doppelt an", async () => {
    const services = buildServices();
    let laeufe = 0;
    const worker = createAiCheckWorker({
      ko: services.ko,
      log: () => undefined,
      run: async () => {
        laeufe += 1;
        return { ok: true };
      },
    });

    worker.enqueue("doppelt", 1);
    worker.enqueue("doppelt", 1);
    worker.enqueue("doppelt", 1);
    await worker.idle();

    expect(laeufe, "die Einreihung dedupliziert gegen Queue UND laufenden Job").toBe(1);
  });
});

// ================================================================================================
// B · MANGEL 2 — DIE STATUSFLÄCHE, PERSISTENZ UND AUDIT
// ================================================================================================

// Die zehn Ursachen des heutigen Produkts. Die Zeile darunter ist ein COMPILE-ZEIT-Wächter: kommt
// eine elfte Ursache dazu, ohne hier einzuziehen, schlägt die Typprüfung fehl — kein Textsuchlauf,
// der beim nächsten Umbau still danebenliegt.
const ALLE_URSACHEN = [
  "no-model",
  "model-error",
  "model-timeout",
  "timeout",
  "queue-overflow",
  "confidential",
  "auth",
  "rate-limit",
  "unreachable",
  "bad-response",
] as const satisfies readonly AiCheckFailureReason[];

type FehlendeUrsache = Exclude<AiCheckFailureReason, (typeof ALLE_URSACHEN)[number]>;
// Ist die Liste unvollständig, ist `FehlendeUrsache` nicht `never` und diese Zuweisung bricht.
const URSACHENLISTE_VOLLSTAENDIG: FehlendeUrsache extends never ? true : false = true;

describe("JOB 738 D3 · B · die Statusfläche, wie sie heute ist", () => {
  it("der Vertrag kennt genau DREI Jobzustände und VIER Kartenzustände", async () => {
    const { aiCheckCardState } = await import("../../apps/web/src/lib/aiCheckStatusCard");

    // Kein Vermerk → die Karte behauptet NICHTS. Weder „läuft" noch ein stilles Grün.
    expect(aiCheckCardState(undefined).kind).toBe("none");
    expect(aiCheckCardState(null).kind).toBe("none");
    expect(
      aiCheckCardState({ status: "pending", requestedAt: "2026-01-01T00:00:00.000Z" }).kind,
    ).toBe("running");
    expect(aiCheckCardState({ status: "done", requestedAt: "2026-01-01T00:00:00.000Z" }).kind).toBe(
      "done",
    );
    const gescheitert = aiCheckCardState({
      status: "failed",
      requestedAt: "2026-01-01T00:00:00.000Z",
      fallbackReason: "no-model",
    });
    expect(gescheitert.kind).toBe("failed");

    // ERHEBUNG, ausgeschrieben: vier Kartenzustände, nicht sieben. Ob das die Policy erfüllt, ist
    // `OF-3` und wird hier nicht entschieden — festgehalten wird der Istwert.
    const zustaende = new Set(
      [
        aiCheckCardState(undefined).kind,
        aiCheckCardState({ status: "pending", requestedAt: "x" }).kind,
        aiCheckCardState({ status: "done", requestedAt: "x" }).kind,
        aiCheckCardState({ status: "failed", requestedAt: "x" }).kind,
      ].map(String),
    );
    expect([...zustaende].sort()).toEqual(["done", "failed", "none", "running"]);
  });

  it("jede der zehn Ursachen hat einen EIGENEN Anzeigeschlüssel — keine fällt still auf model-error", async () => {
    const { aiCheckFailureReasonKey } = await import("../../apps/web/src/lib/aiCheckStatusCard");
    expect(URSACHENLISTE_VOLLSTAENDIG).toBe(true);

    const schluessel = ALLE_URSACHEN.map((u) => aiCheckFailureReasonKey(u));
    // Paarweise verschieden: sonst wären zwei Ursachen für den Leser dieselbe Meldung.
    expect(new Set(schluessel).size, `Schlüssel: ${schluessel.join(", ")}`).toBe(
      ALLE_URSACHEN.length,
    );
    // Und die unbekannte Ursache fällt ehrlich auf den Sammelfall zurück — DAS ist der Unterschied
    // zwischen „kein Schlüssel" und „falscher Schlüssel".
    expect(aiCheckFailureReasonKey("gibt-es-nicht")).toBe("val.aiCheck.reason.model-error");
    expect(aiCheckFailureReasonKey(undefined)).toBe("val.aiCheck.reason.model-error");
  });

  it("jeder Anzeigeschlüssel existiert im Wörterbuch — kein Rohschlüssel in der Oberfläche", async () => {
    const { aiCheckFailureReasonKey } = await import("../../apps/web/src/lib/aiCheckStatusCard");
    // Über die ECHTE i18n-Instanz, aus der die Oberfläche liest — nicht über eine zweite Liste,
    // die neben ihr her veralten könnte.
    const { default: i18n } = await import("../../apps/web/src/i18n");
    const woerterbuch = i18n.getResourceBundle("de", "translation") as
      | Record<string, string>
      | undefined;
    expect(woerterbuch, "das deutsche Wörterbuch muss auffindbar sein").toBeTruthy();
    // Kalibrierung: ohne sie wäre ein leeres Wörterbuch „alle Schlüssel fehlen" statt eines Befunds.
    expect(Object.keys(woerterbuch ?? {}).length).toBeGreaterThan(1000);

    for (const ursache of ALLE_URSACHEN) {
      const key = aiCheckFailureReasonKey(ursache);
      expect(typeof woerterbuch?.[key], `${ursache} → ${key} fehlt im Wörterbuch`).toBe("string");
    }
  });

  it("PERSISTENZ: der Abschluss steht danach am Objekt, nicht nur im Speicher des Laufs", async () => {
    const { app, services, headers } = await appMitNutzer();
    const id = (
      (await reicheEin(app, headers, "Persistenz des Abschlusses")).json() as { id: string }
    ).id;
    await services.aiCheckWorker?.idle();

    const frisch = await services.ko.get(id);
    expect(frisch?.aiCheck?.status).toBeTruthy();
    expect(frisch?.aiCheck?.requestedAt).toBeTruthy();
    expect(frisch?.aiCheck?.finishedAt).toBeTruthy();
    expect(frisch?.aiCheck?.koVersion).toBe(frisch?.version);
  });

  it("AUDIT: die Prüfung schreibt KEINEN Auditsatz — gemessen, und das ist so gewollt", async () => {
    // DIE ERHEBUNG, die zwei Durchgänge lang offen war. `service.ts:2720` sagt es im Klartext:
    // „Bewusst ohne Versions-/Audit-Pfad: reiner Job-Status, kein Wissensinhalt."
    // Hier steht der MESSWERT dazu. Ob das richtig ist, ist eine Ownerfrage — dass es so ist,
    // ist ab jetzt kein Vermuten mehr.
    const { app, services, headers } = await appMitNutzer();
    const vorher = (await services.audit.list({})).length;

    const id = ((await reicheEin(app, headers, "Audit der Pruefung")).json() as { id: string }).id;
    await services.aiCheckWorker?.idle();

    const eintraege = await services.audit.list({});
    const zurPruefung = eintraege.filter((e) => /ai-?check|ki-?pr/i.test(String(e.action)));
    expect(zurPruefung, "es gibt heute keinen Auditsatz zur KI-Pruefung").toEqual([]);
    // Gegenprobe, ohne die der Satz nichts wert wäre: das Einreichen SELBST auditiert sehr wohl.
    expect(
      eintraege.length,
      "ohne jeden neuen Auditsatz wäre die Messung oben vakuum-grün",
    ).toBeGreaterThan(vorher);
    expect(eintraege.some((e) => String(e.target) === id)).toBe(true);
  });
});

// ================================================================================================
// C · MANGEL 3 — DER WIRKBELEG, DEN D2 FÜR UNMÖGLICH HIELT
// ================================================================================================

describe("JOB 738 D3 · C · Frist, no-model, Versionsbindung, Retry und Kappe", () => {
  it("FRIST: ein Lauf, der nie antwortet, endet als failed/timeout — nicht als hängender Job", async () => {
    const services = buildServices();
    const protokoll: string[] = [];
    const worker = createAiCheckWorker({
      ko: services.ko,
      jobTimeoutMs: 5,
      log: (zeile) => protokoll.push(zeile),
      // Der Erkennungslauf ist bewusst nicht abbrechbar — er läuft leer weiter. Die Frist gewinnt.
      run: () => new Promise<never>(() => undefined),
    });

    worker.enqueue("frist", 1);
    await bisWahr(() => protokoll.some((z) => z.includes("grund=timeout")));

    expect(protokoll.join("\n"), "ohne harte Frist bliebe der Job für immer pending").toContain(
      "status=failed grund=timeout",
    );
  });

  it("OHNE MODELL: der echte Runner schließt ehrlich mit no-model ab — kein stilles Grün", async () => {
    // Der ECHTE Runner mit dem ECHTEN Reasoner dieser Komposition. In dieser Umgebung ist kein
    // Modell verdrahtet — genau deshalb braucht dieser Beleg keines.
    const services = buildServices();
    expect(services.reasoner.status().active, "diese Komposition hat kein aktives Modell").toBe(
      false,
    );
    const { app, headers } = await appMitNutzer((s) => {
      s.reasoner = services.reasoner;
    });
    const id = ((await reicheEin(app, headers, "Ohne Modell")).json() as { id: string }).id;

    const runner = createAiCheckRunner({
      ko: services.ko,
      conflicts: services.conflicts,
      overlaps: services.overlaps,
      overlapSettings: services.overlapSettings,
      reasoner: services.reasoner,
    });
    const ergebnis = await runner(id);

    expect(ergebnis.ok, "ohne Modell ist der Lauf nicht 'done'").toBe(false);
    expect(ergebnis.fallbackReason).toBe("no-model");
  });

  it("VERSIONSBINDUNG: ein Abschluss für die ALTE Fassung schreibt nichts mehr", async () => {
    // DER AUFBAU IST HIER DER GANZE PUNKT. Der Abschluss ist DOPPELT bedingt: er schreibt nur,
    // solange der Vermerk `pending` ist UND die erwartete Inhaltsversion noch stimmt. Ein Aufbau,
    // in dem der Job längst abgeschlossen ist, misst deshalb NUR die pending-Bedingung — die
    // Versionsbindung käme gar nicht mehr zum Tragen und der Fall wäre grün, ohne sie zu prüfen.
    //
    // Deshalb hängt der Worker hier absichtlich: sein Lauf antwortet nie, der Vermerk bleibt
    // `pending`, und erst so entscheidet ALLEIN die Version über den Write.
    const { app, services, headers } = await appMitNutzer((s) => {
      s.aiCheckWorker = createAiCheckWorker({
        ko: s.ko,
        log: () => undefined,
        run: () => new Promise<never>(() => undefined),
      });
    });
    const eingereicht = (await reicheEin(app, headers, "Versionsbindung")).json() as {
      id: string;
      version: number;
    };
    const alteVersion = eingereicht.version;

    // Eine Überarbeitung setzt einen FRISCHEN Vermerk für die neue Fassung.
    const revidiert = await app.inject({
      method: "PUT",
      url: `/api/kos/${eingereicht.id}`,
      headers,
      payload: { action: "revise", changes: { statement: "Vollstaendig ueberarbeitete Aussage." } },
    });
    expect(revidiert.statusCode).toBe(200);
    const nachRevision = await services.ko.get(eingereicht.id);
    expect(nachRevision?.version, "die Überarbeitung erhöht die Inhaltsversion").toBeGreaterThan(
      alteVersion,
    );
    expect(nachRevision?.aiCheck?.status, "der Vermerk steht offen — nur so misst der Fall").toBe(
      "pending",
    );

    // Der späte Abschluss des ALTEN Laufs: bedingter Write auf die alte Version → No-op.
    const stale = await services.ko.resolveAiCheck(eingereicht.id, { ok: true }, alteVersion);
    expect(stale, "stale-done muss unmöglich sein").toBe(false);
    expect(
      (await services.ko.get(eingereicht.id))?.aiCheck?.status,
      "der Vermerk der neuen Fassung bleibt unangetastet",
    ).toBe("pending");

    // GEGENPROBE, ohne die der Satz oben auch von einem kaputten Aufbau getragen würde: mit der
    // RICHTIGEN Version schreibt derselbe Aufruf sehr wohl.
    const passend = await services.ko.resolveAiCheck(
      eingereicht.id,
      { ok: true },
      nachRevision?.version,
    );
    expect(passend, "mit der richtigen Version muss der Abschluss greifen").toBe(true);
    expect((await services.ko.get(eingereicht.id))?.aiCheck?.status).toBe("done");
  });

  it("RETRY: die Route reiht einen gescheiterten Job neu ein und meldet pending", async () => {
    const { app, services, headers } = await appMitNutzer();
    const id = ((await reicheEin(app, headers, "Retry der Pruefung")).json() as { id: string }).id;
    await services.aiCheckWorker?.idle();
    // In dieser Komposition endet der Lauf ohne Modell auf failed — genau der wiederholbare Fall.
    expect(await services.ko.get(id).then((k) => k?.aiCheck?.status)).toBe("failed");

    const retry = await app.inject({ method: "POST", url: `/api/kos/${id}/ai-check`, headers });

    expect(retry.statusCode).toBe(200);
    expect(retry.json()).toEqual({ status: "pending" });
    await services.aiCheckWorker?.idle();
    expect(await services.ko.get(id).then((k) => k?.aiCheck?.finishedAt)).toBeTruthy();
  });

  it("RETRY: ein Objekt ohne vermerkten Job wird abgewiesen, nicht heimlich eingereiht", async () => {
    const { app, services, headers } = await appMitNutzer();
    // Am Dienst angelegt, nicht über die Einreich-Route: dann gibt es GAR KEINEN Prüfvermerk —
    // genau der Altbestands-/Ohne-Worker-Fall, den die Karte als `none` führt.
    const ohneVermerk = await services.ko.create({
      title: "Ohne Pruefvermerk",
      statement: "Aussage ohne vermerkten Pruef-Job.",
      type: "best_practice",
      category: "K",
      author: "pedi",
    });
    expect(ohneVermerk.aiCheck, "dieses Objekt trägt keinen Prüfvermerk").toBeUndefined();

    const retry = await app.inject({
      method: "POST",
      url: `/api/kos/${ohneVermerk.id}/ai-check`,
      headers,
    });

    expect(retry.statusCode).toBe(409);
    expect((retry.json() as { error?: string }).error).toBe("AI_CHECK_NOT_RETRYABLE");
    // Und es wurde auch nichts nachgeholt: der Vermerk bleibt abwesend.
    expect((await services.ko.get(ohneVermerk.id))?.aiCheck).toBeUndefined();
  });

  it("KAPPE: über der Warteschlangengrenze wird der ÄLTESTE Job ehrlich als überlaufen gemeldet", async () => {
    const services = buildServices();
    const protokoll: string[] = [];
    const worker = createAiCheckWorker({
      ko: services.ko,
      log: (zeile) => protokoll.push(zeile),
      run: () => new Promise<never>(() => undefined), // Concurrency 1 → alles Weitere wartet
    });

    // Einer läuft, MAX warten — der nächste verdrängt den ältesten Wartenden.
    for (let i = 0; i <= MAX_AI_CHECK_QUEUE + 1; i += 1) {
      worker.enqueue(`job-${i}`, 1);
    }
    await bisWahr(() => protokoll.some((z) => z.includes("queue-overflow")));

    expect(protokoll.join("\n"), "ohne Kappe wüchse die Warteschlange still weiter").toContain(
      "grund=queue-overflow",
    );
  });

  it("STALE: ein pending-Vermerk jenseits der Frist wird neu eingereiht, ein frischer nicht", () => {
    const jetzt = Date.parse("2026-08-18T12:00:00.000Z");
    const alt = new Date(jetzt - AI_CHECK_STALE_PENDING_MS - 1).toISOString();
    const frisch = new Date(jetzt - 1000).toISOString();

    expect(shouldReEnqueueAiCheck({ status: "pending", requestedAt: alt }, jetzt)).toBe(true);
    expect(shouldReEnqueueAiCheck({ status: "pending", requestedAt: frisch }, jetzt)).toBe(false);
    // Ein abgeschlossener Job wird NIE neu eingereiht — sonst liefe die Prüfung endlos im Kreis.
    expect(shouldReEnqueueAiCheck({ status: "done", requestedAt: alt }, jetzt)).toBe(false);
    expect(shouldReEnqueueAiCheck({ status: "failed", requestedAt: alt }, jetzt)).toBe(false);
    expect(shouldReEnqueueAiCheck(undefined, jetzt)).toBe(false);
    // Defensiv: ein unlesbares Datum gilt als festhängend — lieber einmal zu viel als still liegen.
    expect(shouldReEnqueueAiCheck({ status: "pending", requestedAt: "kein Datum" }, jetzt)).toBe(
      true,
    );
  });
});

// ================================================================================================
// D · DIE FEHLERZUORDNUNG — der Teil von Mangel 3, der GAR KEIN Modell braucht
// ================================================================================================
//
// D2 hat Mangel 3 vollständig für unerbringbar erklärt. Für die ZUORDNUNG eines Providerfehlers
// stimmt das nicht: sie ist eine reine Funktion. Ein echter Provider wird nur gebraucht, um zu
// zeigen, dass solche Fehler im Live-Betrieb AUFTRETEN — nicht, um zu zeigen, wie sie eingeordnet
// werden.

describe("JOB 738 D3 · D · aus einem Providerfehler wird eine ehrliche Ursache", () => {
  it("die strukturierte Reasoner-Klasse entscheidet den Ursachenschlüssel", () => {
    expect(reasonFromModelFailure({ failureClass: "timeout" })).toBe("model-timeout");
    expect(reasonFromModelFailure({ failureClass: "parse" })).toBe("bad-response");
    expect(reasonFromModelFailure({ failureClass: "network" })).toBe("unreachable");
    expect(reasonFromModelFailure({ failureClass: "http", status: 401 })).toBe("auth");
    expect(reasonFromModelFailure({ failureClass: "http", status: 403 })).toBe("auth");
    expect(reasonFromModelFailure({ failureClass: "http", status: 429 })).toBe("rate-limit");
    expect(reasonFromModelFailure({ failureClass: "http", status: 503 })).toBe("unreachable");
    // Unbekannter 4xx → ehrlich generisch statt geraten.
    expect(reasonFromModelFailure({ failureClass: "http", status: 418 })).toBe("model-error");
  });

  it("der Regex-Rückfall bleibt eng — eine beiläufige Zahl löst KEINE Klasse aus", () => {
    expect(classifyAiCheckFailure(new Error("unauthorized"))).toBe("auth");
    expect(classifyAiCheckFailure(new Error("rate limit erreicht"))).toBe("rate-limit");
    expect(classifyAiCheckFailure(new Error("ECONNREFUSED"))).toBe("unreachable");
    expect(classifyAiCheckFailure(new SyntaxError("Unexpected token"))).toBe("bad-response");
    // DER PUNKT: „500 Zeichen" ist kein HTTP-Status, „JSON" allein kein Parsefehler. Vor der
    // Verengung hätte beides eine falsche, sehr konkrete Ursache in die Anzeige gebracht.
    expect(classifyAiCheckFailure(new Error("Der Text hat 500 Zeichen"))).toBe("model-error");
    expect(classifyAiCheckFailure(new Error("JSON"))).toBe("model-error");
    expect(classifyAiCheckFailure(new Error("network"))).toBe("model-error");
    // Die interne Kapazitätsbremse ist kein Providerfehler und bleibt der Sammelfall.
    const kapazitaet = Object.assign(new Error("voll"), { name: "ModelCapacityError" });
    expect(classifyAiCheckFailure(kapazitaet)).toBe("model-error");
  });
});
