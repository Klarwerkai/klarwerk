// JOB 3915 — DER MENSCHLICHE VERMERK ÜBERLEBT DIE KO-REVISION.
//
// DER GEPRÜFTE SATZ: `apps/web/src/i18n.ts:5043-5044` (`help.konflikte.body`) — „Deine Wahl wird als
// Vermerk festgehalten, gelöscht wird nichts." Seit dem Versionswächter (D-AISTATE PAKET 4) ist der
// Lesepfad fail-closed: `ConflictService.get` blendet einen Befund aus, dessen gebundene KO-Version
// nicht mehr der aktuellen entspricht (`services/conflicts/src/service.ts:579-593`). Genau EIN
// Zweig rettet die Zusage — `conflict.status === "geloest"` in der Frühausstiegs-Bedingung
// `service.ts:582` reicht den entschiedenen Befund VOR dem Wächter durch. Diese Datei misst allein
// diesen Zweig: wer entscheidet und danach ein beteiligtes Wissensobjekt überarbeitet, findet seine
// Entscheidung samt Freitext unverändert wieder — statt vor einem 404 zu stehen.
//
// WAS HIER NICHT NOCH EINMAL AUFGEBAUT WIRD (Zuordnung statt Nachbau): die SYSTEMISCHE Hälfte — ein
// OFFENER stale gebundener Befund wird ausgeblendet (404), vom Lese-GC geschlossen und trägt danach
// `superseded`/`decidedBy: null` — ist bereits gemessen in `tests/app/aistate-fix5.test.ts:44-87`
// (Dienst), `:89-117` (nicht ermittelbare Version) und `:211-320` (echte Detail-Routen). Das Race
// zwischen Lese-GC und menschlicher Entscheidung misst `tests/app/aistate-fix6.test.ts:109-163`.
// Hier steht AUSSCHLIESSLICH die menschliche Hälfte (`decidedBy: <Mensch>`, `decision: <Freitext>`,
// `resolutionReason: "decided"`/`"dismissed"`) nach einer Revision.
//
// GEMESSEN, NICHT BEHAUPTET (Lieferung 1 des Auftrags): `buildServices()` verdrahtet dem
// `ConflictService` SEHR WOHL eine Versions-Autorität — `services/app/src/build-app.ts:604-610`
// (`const koVersion = async (koId) => (await ko.get(koId))?.version` → `currentVersion: koVersion`).
// Deshalb sagt die HTTP-Hälfte (H1) über den Wächter etwas aus und wird gebaut. Die Bestandsfälle
// von JOB 3887 (`services/conflicts/src/service.test.ts:21`) bauen ihren Dienst dagegen OHNE
// Autorität; dort greift in `get()` schon `!lookup` bei `:582`, der Wächterzweig wird nie betreten.
//
// WIE STARK DIE EINZELNEN ZUSICHERUNGEN WIRKLICH SIND (gemessen, nicht angenommen):
//  · Entfernt man `conflict.status === "geloest"` in `service.ts:582`, werden ALLE fünf Fälle dieser
//    Datei rot (gemessen). Rot werden dabei AUCH zwei Fälle von `tests/app/aistate-fix5.test.ts`
//    (:81 und :285 — der zweite Read auf den systemischen Grabstein). Der Zweig ist also nicht
//    gänzlich unbewacht; unbewacht war allein die MENSCHLICHE Hälfte, und genau sie steht hier.
//  · Die `flushGc`-Zusicherungen unten (der Vermerk steht nach einem Timer-Durchlauf unverändert)
//    sind eine REICHWEITEN-Aussage, keine CAS-Aussage: auf einem entschiedenen Befund ist der
//    Lese-GC gar nicht erreichbar — `get()` steigt bei `:582` vorher aus und `unresolved()` filtert
//    `geloest` bei `:550` vor dem Wächter weg. Gemessen: verstellt man den CAS in `gcStaleOpen`
//    (`service.ts:613-617`) auf ein unbedingtes Schreiben, bleiben alle fünf Fälle hier GRÜN und
//    rot werden die zwei zuständigen Fälle in `tests/app/aistate-fix6.test.ts:53/109`. Der Schutz
//    der menschlichen Entscheidung gegen den GC gehört dort hin und wird hier nicht nachgebaut.
//
// EINE MATRIX FÜR ALLE DREI WEGE (Runde 2, Korrekturpflicht des Prüfers an Runde 1): `resolve`,
// `dismiss` mit Notiz und `dismiss` ohne Notiz laufen durch denselben Helfer `matrixNachRevision` —
// vier Vermerkfelder, Listenabwesenheit gegen einen offen bleibenden Kontrollbefund, Badge-Zahl,
// vollständiges Rücklesen nach dem Timer-Durchlauf und Audit-Aktion/Ziel/Anzahl. In Runde 1 fehlten
// dem Weg „ohne Notiz" Status, Liste, Badge und das halbe Rücklesen; ein Helfer statt drei
// Abschriften macht dieses Auseinanderlaufen unmöglich.
//
// BELEGGRENZE (in Pedis Sprache): gemessen ist der Dienst und der HTTP-Weg gegen die Ablage im
// Arbeitsspeicher (`buildServices()`). NICHT gemessen sind die Postgres-Ablage (eigener Auftrag
// JOB 3914), die Oberfläche, EN/NL und die Aufräumwege (`onKoRemoved`/`closeOpenForKo`, JOB 3899).
import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { type Conflict, ConflictService, InMemoryConflictRepo } from "../../services/conflicts";

// Test-eigener KO-Versionsstand, synchron änderbar wie eine echte Revision — Muster übernommen aus
// `tests/app/aistate-fix5.test.ts:21-27` (dort nicht exportiert, deshalb hier erneut aufgeschrieben).
function versionStore(init: Record<string, number>) {
  const versions = new Map(Object.entries(init));
  return {
    versions,
    currentVersion: async (koId: string) => versions.get(koId),
  };
}

// Der Lese-GC feuert als Makrotask (`service.ts:611`) — ein Timer-Durchlauf lässt alle zuvor
// angestoßenen GC-Ketten vollständig abschließen (`tests/app/aistate-fix5.test.ts:29-33`). Ohne ihn
// belegte ein zu früh gelesener Datensatz nichts: der Vermerk könnte eine Runde später doch noch
// von `superseded` überschrieben werden.
function flushGc(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Dienst mit echtem Protokoll-Ledger — die Audit-Prüfungen zählen Aktion UND Zielkennung. */
function aufbau() {
  const repo = new InMemoryConflictRepo();
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const store = versionStore({ a: 1, b: 1, c: 1 });
  const svc = new ConflictService({ repo, audit, currentVersion: store.currentVersion });
  return { repo, audit, store, svc };
}

/** Ein versionsgebundener automatischer Befund (nur mit Bindung greift der Wächter überhaupt). */
function gebunden(koA: string, koB: string, beschreibung: string) {
  return {
    eingabe: {
      koA,
      koB,
      type: "truth" as const,
      description: beschreibung,
      koAVersion: 1,
      koBVersion: 1,
    },
    detektor: { trigger: "validation" as const, method: "model" as const },
  };
}

/** Die Protokollzeilen GENAU dieser Zielkennung, in Reihenfolge — keine „ist nicht leer"-Prüfung. */
async function protokollFuer(audit: AuditService, ziel: string): Promise<string[]> {
  return (await audit.list()).filter((e) => e.target === ziel).map((e) => e.action);
}

/** Der erwartete Vermerk eines der drei menschlichen Wege. */
type Vermerk = {
  decidedBy: string;
  decision: string | null;
  resolutionReason: "decided" | "dismissed";
  auditAktion: "conflict.resolved" | "conflict.dismissed";
};

// DIE EINE ASSERTIONSMATRIX für alle drei menschlichen Wege (Korrekturpflicht 1 des Prüfers an
// Runde 1, 13.09.: „Für resolve, dismiss mit Notiz und dismiss ohne Notiz jeweils dieselbe
// Assertionsmatrix abarbeiten: vier Vermerkfelder, Listenabwesenheit, Badge, vollständiges
// Rücklesen nach Timer-Durchlauf und Audit-Ziel/Anzahl.") Ein Helfer statt drei Abschriften: eine
// fehlende Zusicherung in einem Weg ist damit nicht mehr möglich.
async function matrixNachRevision(
  welt: ReturnType<typeof aufbau>,
  konfliktId: string,
  kontrolleId: string,
  erwartet: Vermerk,
): Promise<void> {
  const { repo, audit, svc } = welt;

  // 1. „Gelöscht wird nichts": der Einzelabruf trägt den vollständigen Vermerk — alle vier Felder
  //    einzeln, zurückgelesen und nicht am Rückgabewert der Entscheidung.
  const abgelegt = await svc.get(konfliktId);
  expect(abgelegt).toBeDefined();
  expect(abgelegt?.status).toBe("geloest");
  expect(abgelegt?.decidedBy).toBe(erwartet.decidedBy);
  expect(abgelegt?.decision).toBe(erwartet.decision); // bei „ohne Notiz": null, nie "" oder Text
  expect(abgelegt?.resolutionReason).toBe(erwartet.resolutionReason);

  // 2. Die zweite Hälfte des Hilfesatzes: von der Fläche ist das Paar weg — aber die Liste wird
  //    erfolgreich gelesen und führt den Kontrollbefund weiter (die Abwesenheit wird nie aus einem
  //    404 des Einzelabrufs abgeleitet, und die Liste ist nicht ohnehin leer).
  expect((await svc.unresolved()).map((k) => k.id)).toEqual([kontrolleId]);
  expect(await svc.badgeCount()).toBe(1);

  // 3. Der Lese-GC feuert NICHT auf den entschiedenen Befund: nach einem Timer-Durchlauf steht im
  //    Datensatz unverändert der VOLLSTÄNDIGE menschliche Vermerk, nicht `superseded`/`decidedBy:
  //    null`. Ohne diesen Durchlauf belegte der Einzelabruf oben nichts über die nächste Runde.
  await flushGc();
  const nachGc = await repo.findById(konfliktId);
  expect(nachGc?.status).toBe("geloest");
  expect(nachGc?.decidedBy).toBe(erwartet.decidedBy);
  expect(nachGc?.decision).toBe(erwartet.decision);
  expect(nachGc?.resolutionReason).toBe(erwartet.resolutionReason);

  // 4. Protokoll gegen konkrete Aktionen, Zielkennung und Anzahl: genau EINE menschliche Zeile auf
  //    DIESE Kennung, KEIN `conflict.superseded` — weder auf diese Kennung noch im ganzen Ledger.
  const zeilen = await protokollFuer(audit, konfliktId);
  expect(zeilen).toEqual(["conflict.auto-created", erwartet.auditAktion]);
  expect(zeilen.filter((a) => a === erwartet.auditAktion)).toHaveLength(1);
  expect(zeilen.filter((a) => a === "conflict.superseded")).toHaveLength(0);
  expect((await audit.list()).filter((e) => e.action === "conflict.superseded")).toHaveLength(0);
}

/**
 * Gemeinsamer Aufbau der drei Wege: ein versionsgebundener Befund auf „a"/„b" und ein zweiter,
 * aktuell gebundener Kontrollbefund auf „a"/„c", der offen bleibt. Belegt vor der Entscheidung,
 * dass die Bindung wirklich gesetzt und der Befund offen ist — sonst griffe „Altbestand ohne
 * Versionsfelder bleibt konservativ sichtbar" (`service.ts:547-548`) und der Fall wäre inhaltsleer.
 */
async function angelegt(welt: ReturnType<typeof aufbau>, beschreibung: string) {
  const { svc } = welt;
  const { eingabe, detektor } = gebunden("a", "b", beschreibung);
  const konflikt = await svc.createAuto(eingabe, detektor);
  const kontrolle = await svc.createAuto(
    gebunden("a", "c", "anderer Widerspruch").eingabe,
    detektor,
  );

  const vorher = await svc.get(konflikt.id);
  expect(vorher?.koAVersion).toBe(1);
  expect(vorher?.koBVersion).toBe(1);
  expect(vorher?.status).toBe("offen");
  expect((await svc.unresolved()).map((k) => k.id)).toEqual([konflikt.id, kontrolle.id]);

  return { konflikt, kontrolle };
}

describe("JOB 3915: der entschiedene Befund überlebt die Revision des beteiligten Wissensobjekts", () => {
  // R1 — DER KERNFALL. `resolve` schreibt den Vermerk, DANACH wird KO „b" überarbeitet. Der Wächter
  // müsste den Befund jetzt ausblenden (die gebundene Version 1 ist nicht mehr aktuell) — der Zweig
  // `service.ts:582` lässt ihn durch, weil er GESCHLOSSEN ist. Gemessen wird zurückgelesen, nie am
  // Rückgabewert von `resolve` (Vorgabe `services/conflicts/src/service.test.ts:92-95`).
  it("R1: resolve — nach der Revision liefert get() den Befund weiter, mit der vollen Matrix", async () => {
    const welt = aufbau();
    const { konflikt, kontrolle } = await angelegt(welt, "Widerspruch zur Ventilfarbe");

    await welt.svc.resolve(konflikt.id, "controller-1", "Quelle B gilt.");
    welt.store.versions.set("b", 2); // die ganz normale Überarbeitung NACH der Entscheidung

    await matrixNachRevision(welt, konflikt.id, kontrolle.id, {
      decidedBy: "controller-1",
      decision: "Quelle B gilt.",
      resolutionReason: "decided",
      auditAktion: "conflict.resolved",
    });
  });

  // R2 — Derselbe Nachweis für den Fehlalarm MIT Notiz, dieselbe Matrix.
  it("R2: dismiss mit Notiz — nach der Revision bleiben Freitext und Grund „dismissed“ erhalten", async () => {
    const welt = aufbau();
    const { konflikt, kontrolle } = await angelegt(welt, "vermeintlicher Widerspruch");

    await welt.svc.dismiss(konflikt.id, "controller-2", "Fehlalarm: andere Anlage");
    welt.store.versions.set("b", 2);

    await matrixNachRevision(welt, konflikt.id, kontrolle.id, {
      decidedBy: "controller-2",
      decision: "Fehlalarm: andere Anlage",
      resolutionReason: "dismissed",
      auditAktion: "conflict.dismissed",
    });
  });

  // R3 — Fehlalarm OHNE Notiz: `decision` bleibt `null`. Wissenslücke statt Erfindung — weder ein
  // erfundener Text noch ein leerer String, auch nicht nach der Revision und nach dem GC-Durchlauf.
  // Seit Runde 2 läuft hier dieselbe Matrix wie in R1/R2 (Status, Liste, Badge, volles Rücklesen).
  it("R3: dismiss ohne Notiz — nach der Revision bleibt decision null, kein erfundener Text", async () => {
    const welt = aufbau();
    const { konflikt, kontrolle } = await angelegt(welt, "vermeintlicher Widerspruch");

    await welt.svc.dismiss(konflikt.id, "controller-3");
    welt.store.versions.set("b", 2);

    await matrixNachRevision(welt, konflikt.id, kontrolle.id, {
      decidedBy: "controller-3",
      decision: null, // weder "" noch undefined noch ein Platzhaltertext
      resolutionReason: "dismissed",
      auditAktion: "conflict.dismissed",
    });
  });
});

// ==================================================================================================
// DIE HTTP-HÄLFTE — gebaut, WEIL `build-app.ts:604-610` die Versions-Autorität trägt (Lieferung 1).
// ==================================================================================================
describe("JOB 3915: derselbe Nachweis an der echten HTTP-Grenze", () => {
  type App = ReturnType<typeof buildApp>;
  type Kopf = Record<string, string>;

  // Anmelde- und KO-Anlageweg wörtlich übernommen aus
  // `tests/konflikt-vermerk-am-endpunkt/vermerk-bleibt-nach-der-entscheidung.test.ts:35-66`
  // (dort im describe gekapselt und nicht exportiert). Einziger Unterschied: `buildServices()` wird
  // hier festgehalten, weil der versionsGEBUNDENE Befund nur über den Dienst anlegbar ist — der
  // Weg der Fläche (`PUT /api/kos/:id` mit `action: "conflict"`) legt über `conflicts.create` einen
  // Befund OHNE Versionsfelder an (`services/conflicts/src/service.ts:79-100`), an dem der Wächter
  // gar nicht greift. Gelesen wird ausschließlich über die echten Routen — dasselbe Vorgehen wie
  // `tests/app/aistate-fix5.test.ts:231-241`.
  async function umgebung() {
    const services = buildServices();
    const app = buildApp(services);
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
    return { services, app, headers, adminId: login.json().user.id as string };
  }

  async function neuesKo(app: App, headers: Kopf, titel: string): Promise<KnowledgeObject> {
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
    return res.json() as KnowledgeObject;
  }

  async function liste(app: App, headers: Kopf): Promise<Conflict[]> {
    const res = await app.inject({ method: "GET", url: "/api/conflicts", headers });
    expect(res.statusCode).toBe(200);
    return res.json() as Conflict[];
  }

  // H1 — Der ganze Weg eines Menschen: entscheiden, danach das beteiligte Wissensobjekt ganz normal
  // überarbeiten (`PUT /api/kos/:id` mit `action: "revise"`, ko-routes.ts:1877-1914 — dort bumpt
  // `ko.revise` die Version und der Revisions-Sweep `conflicts.onKoRevised` lässt gelöste Befunde
  // bewusst aus, `service.ts:473-476`). Danach steht die eigene Entscheidung noch da.
  it("H1: entschieden, dann KO überarbeitet — GET /api/conflicts/:id antwortet 200 mit vollem Vermerk, die Liste führt das Paar nicht mehr", async () => {
    const { services, app, headers, adminId } = await umgebung();
    const koA = await neuesKo(app, headers, "H1 Ventilfarbe Anlage 3");
    const koB = await neuesKo(app, headers, "H1 Ventilkennzeichnung Halle");

    // Versionsgebundener Befund gegen den AKTUELLEN Stand beider Objekte.
    const konflikt = await services.conflicts.createAuto(
      {
        koA: koA.id,
        koB: koB.id,
        type: "truth",
        description: "H1: die Angaben widersprechen sich.",
        koAVersion: koA.version,
        koBVersion: koB.version,
      },
      { trigger: "validation", method: "model" },
    );
    // Vor der Entscheidung steht er auf der Fläche — sonst belegte die Prüfung unten nichts.
    expect((await liste(app, headers)).map((c) => c.id)).toContain(konflikt.id);

    const entschieden = await app.inject({
      method: "PUT",
      url: `/api/kos/${koA.id}`,
      headers,
      payload: {
        action: "resolve-conflict",
        conflictId: konflikt.id,
        decision: "Aussage A gilt; B galt nur für die alte Baureihe.",
      },
    });
    expect(entschieden.statusCode).toBe(200);

    // Die ganz normale Überarbeitung DANACH: KO B bekommt eine neue Version, die Bindung des
    // Befunds ist ab jetzt sicher veraltet.
    const ueberarbeitet = await app.inject({
      method: "PUT",
      url: `/api/kos/${koB.id}`,
      headers,
      payload: { action: "revise", changes: { statement: "Das Ventil ist jetzt blau lackiert." } },
    });
    expect(ueberarbeitet.statusCode).toBe(200);
    expect((ueberarbeitet.json() as KnowledgeObject).version).toBe((koB.version ?? 1) + 1);

    // „Gelöscht wird nichts" an der echten Grenze: 200 statt 404, mit dem vollständigen Vermerk.
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

    // … und gleichzeitig: die erfolgreich gelesene Liste führt das Paar nicht mehr.
    expect((await liste(app, headers)).map((c) => c.id)).not.toContain(konflikt.id);

    // Auch ein Timer-Durchlauf (Lese-GC) überschreibt den Vermerk nicht.
    await flushGc();
    const nachGc = await services.conflicts.get(konflikt.id);
    expect(nachGc?.resolutionReason).toBe("decided");
    expect(nachGc?.decidedBy).toBe(adminId);
  });

  // H2 — Dasselbe für den Fehlalarm über seinen eigenen Endpunkt
  // (`POST /api/conflicts/:id/dismiss`, conflicts-routes.ts:274-289).
  it("H2: Fehlalarm verworfen, dann KO überarbeitet — der Freitext steht unverändert im Einzelabruf", async () => {
    const { services, app, headers, adminId } = await umgebung();
    const koA = await neuesKo(app, headers, "H2 Ventilfarbe Anlage 3");
    const koB = await neuesKo(app, headers, "H2 Ventilkennzeichnung Halle");
    const konflikt = await services.conflicts.createAuto(
      {
        koA: koA.id,
        koB: koB.id,
        type: "truth",
        description: "H2: die Angaben widersprechen sich.",
        koAVersion: koA.version,
        koBVersion: koB.version,
      },
      { trigger: "validation", method: "model" },
    );
    expect((await liste(app, headers)).map((c) => c.id)).toContain(konflikt.id);

    const verworfen = await app.inject({
      method: "POST",
      url: `/api/conflicts/${konflikt.id}/dismiss`,
      headers,
      payload: { note: "Fehlalarm: andere Anlage" },
    });
    expect(verworfen.statusCode).toBe(200);

    const ueberarbeitet = await app.inject({
      method: "PUT",
      url: `/api/kos/${koA.id}`,
      headers,
      payload: { action: "revise", changes: { statement: "Das Ventil ist jetzt grün lackiert." } },
    });
    expect(ueberarbeitet.statusCode).toBe(200);
    // Die Bindung ist ab jetzt SICHER veraltet — ohne diesen Versionsanstieg sagte der Einzelabruf
    // unten über den Wächter nichts aus (Prüflücke 6 des Prüfers an Runde 1).
    expect((ueberarbeitet.json() as KnowledgeObject).version).toBe((koA.version ?? 1) + 1);

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
    expect((await liste(app, headers)).map((c) => c.id)).not.toContain(konflikt.id);
  });
});
