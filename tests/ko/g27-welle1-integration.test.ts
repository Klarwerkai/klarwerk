// ================================================================================================
// JOB 527 / D3 — DIE ATOMARE LAUFZEITKETTE, MIT DEM ECHTEN DIENST GEFAHREN.
// ================================================================================================
//
// Das rote Vollurteil `_relay/kopf/outbox/BEN4-PRUEFUNG-JOB-527-D2.md` verlangt (Prüflücke 2):
//
//   „Atomare Laufzeitkette: Composition Root starten und die Zustände
//    `UNINITIALIZED → V2_BUILDING → V2_READY` über reale Startup-, Migrations- und
//    Repositoryverdrahtung beobachten. Erwartet: Suche bleibt bis `V2_READY` fail-closed und
//    verwendet danach ausschließlich die aktive V2-Projektion."
//
// WARUM DIESE DATEI NÖTIG IST, OBWOHL ES SCHON ZWEI NACHBARN GIBT — und das ist der Unterschied,
// auf den es ankommt:
//
//   `services/app/src/search-projection-startup.test.ts` fährt die Betriebsfolge gegen einen
//   ATTRAPPEN-Dienst. Er belegt, dass die Orchestrierung je Zustand das Richtige RUFT — nicht, dass
//   der echte Dienst danach wirklich suchbereit IST.
//
//   `tests/ko/g27-welle1-single-active-projection.test.ts` fährt die Zustandsmaschine des echten
//   Dienstes — aber ohne die Startorchestrierung, also ohne die Naht, an der beide zusammenkommen.
//
// GENAU DIESE NAHT läuft hier: der ECHTE `KoService` durch den ECHTEN `starteSuchprojektion`. Wer
// eine der beiden Seiten ändert, ohne die andere mitzunehmen, wird ab hier rot.
//
// EINE PRÄZISIERUNG ZUM URTEILSTEXT, die ich melde statt sie zu glätten: der Endzustand der Kette
// heisst `V2_ACTIVE`, nicht `V2_READY`. `V2_READY` bedeutet „gebaut und geprüft, aber noch NICHT
// freigegeben" — die Suche ist dort noch fail-closed. Die vollständige Folge lautet
// `UNINITIALIZED → V2_BUILDING → V2_READY → V2_ACTIVE`, und genau so wird sie hier beobachtet.
import { describe, expect, it } from "vitest";
import {
  starteSuchprojektion,
  stelleSuchprojektionBereit,
} from "../../services/app/src/search-projection-startup";
import {
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  KoService,
  SEARCH_PROJECTION_VERSION,
} from "../../services/knowledge-object";

const EINGABE = {
  title: "Hydraulikzylinder HZ7 entlüften",
  statement: "Vor dem Entlüften den Systemdruck ablassen.",
  type: "best_practice" as const,
  category: "Wartung",
  author: "anna",
};

/** Eine FRISCHE, NICHT in Betrieb genommene Instanz — der Ausgangspunkt der Kette. */
function frisch() {
  const repo = new InMemoryKoRepo();
  const projections = new InMemoryKoSearchProjectionRepo(repo);
  const versions = new InMemoryKoVersionRepo();
  const ko = new KoService({
    repo,
    versions,
    searchProjections: projections,
    now: () => Date.parse("2026-08-17T09:00:00.000Z"),
  });
  return { repo, projections, versions, ko };
}

/** Sucht — und sagt, ob die Suche fail-closed geblieben ist. */
async function suchtNicht(ko: KoService): Promise<boolean> {
  try {
    await ko.findSearchHits({ terms: ["hydraulikzylinder"] });
    return false;
  } catch (error) {
    // Fail-closed heisst NICHT „irgendein Fehler": der Grund muss der benannte sein.
    return String((error as { code?: string }).code) === "SEARCH_PROJECTION_NOT_READY";
  }
}

describe("JOB 527 · I — die Kette UNINITIALIZED → V2_BUILDING → V2_READY → V2_ACTIVE", () => {
  it("I1 · jeder Zwischenzustand wird einzeln beobachtet, und die Suche ist bis zur Freigabe tot", async () => {
    const { ko, projections } = frisch();

    // ---- UNINITIALIZED: eine frische Instanz ist NICHT suchbereit ----------------------------
    expect((await ko.searchProjectionControl()).projectionState).toBe("UNINITIALIZED");
    expect(await suchtNicht(ko)).toBe(true);

    // Bestand anlegen, BEVOR gebaut wird — sonst prüfte der Bau eine leere Menge.
    const erstellt = await ko.create({ ...EINGABE, bodyHtml: "<p>Projektionswort</p>" });

    // ---- V2_BUILDING: ab hier beantwortet die Instanz KEINE Suche mehr -----------------------
    const bauend = await ko.beginSearchProjectionBuild();
    expect(bauend.projectionState).toBe("V2_BUILDING");
    // Die Zusage aus 03 §3, wörtlich gemessen: während des Baus gibt es keine aktive Fassung.
    expect(bauend.activeProjectionVersion).toBeNull();
    expect(await suchtNicht(ko)).toBe(true);

    // ---- DAS GATE IST KEINE FORMSACHE: ohne Bau gibt es kein `V2_READY` ----------------------
    //
    // Dieser Zwischenschritt stand nicht im Urteil und ist trotzdem der wichtigste dieses Falles:
    // Er wurde beim ersten Lauf ROT und hat mir gezeigt, dass `finishSearchProjectionBuild` NICHT
    // baut, sondern PRÜFT. Ein Bau, der nie lief, kommt am Gate nicht vorbei — die Instanz bleibt
    // im Bau (wiederholbar) und rutscht weder nach `FAILED` noch gar nach `V2_READY`.
    const ohneBau = await ko.finishSearchProjectionBuild();
    expect(ohneBau.readiness.alle).toBe(false);
    expect(ohneBau.readiness.befunde.join(" ")).toContain("Rebuild");
    expect((await ko.searchProjectionControl()).projectionState).toBe("V2_BUILDING");
    expect(await suchtNicht(ko)).toBe(true);

    // ---- V2_READY: erst NACH echtem Rebuild und Reconcile — und noch nicht freigegeben --------
    //
    // Bis unmittelbar vor die Freigabe fahren — dasselbe Vorgehen wie im Nachbarn
    // `g27-welle1-single-active-projection.integration.test.ts:256-269`. Der Rebuildvermerk gehört
    // zum Bau und wird sonst von `continueSearchProjectionBuild` gesetzt; hier wird er einzeln
    // gesetzt, weil dieser Fall die Zwischenzustände EINZELN beobachten soll.
    await ko.rebuildSearchProjections();
    const nachRebuild = await projections.controlState();
    await projections.compareAndSetControlState("V2_BUILDING", {
      ...nachRebuild,
      lastSuccessfulRebuild: new Date(Date.parse("2026-08-17T09:00:00.000Z")).toISOString(),
    });
    await ko.reconcileSearchProjections();
    const { readiness } = await ko.finishSearchProjectionBuild();
    expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);
    const geprueft = await ko.searchProjectionControl();
    expect(geprueft.projectionState).toBe("V2_READY");
    // DER ENTSCHEIDENDE PUNKT DIESES FALLES: `V2_READY` sucht noch NICHT. Wer die Kette bei
    // „ready" für fertig hält, hält eine ungeprüfte Freigabe für eine Freigabe.
    expect(geprueft.activeProjectionVersion).toBeNull();
    expect(await suchtNicht(ko)).toBe(true);

    // ---- V2_ACTIVE: erst die Freigabe macht die Instanz suchfähig ----------------------------
    const aktiv = await ko.releaseSearchProjectionVersion(geprueft.buildGeneration);
    expect(aktiv.projectionState).toBe("V2_ACTIVE");
    expect(aktiv.activeProjectionVersion).toBe(SEARCH_PROJECTION_VERSION);
    expect(aktiv.activeGeneration).toBe(geprueft.buildGeneration);
    const treffer = await ko.findSearchHits({ terms: ["projektionswort"] });
    expect(treffer.map((h) => h.koId)).toEqual([erstellt.id]);
  });

  it("I2 · der ECHTE Startweg führt eine frische Instanz von UNINITIALIZED bis V2_ACTIVE", async () => {
    // Hier läuft die Orchestrierung aus `services/app/src/search-projection-startup.ts` gegen den
    // ECHTEN Dienst — nicht gegen eine Attrappe. Genau diese Naht verlangt das Urteil.
    const { ko } = frisch();
    await ko.create({ ...EINGABE, bodyHtml: "<p>Startwort</p>" });
    expect((await ko.searchProjectionControl()).projectionState).toBe("UNINITIALIZED");

    const nachStart = await starteSuchprojektion(ko);
    expect(nachStart.projectionState).toBe("V2_ACTIVE");
    expect(nachStart.activeProjectionVersion).toBe(SEARCH_PROJECTION_VERSION);
    expect((await ko.findSearchHits({ terms: ["startwort"] })).length).toBe(1);
  });

  it("I3 · `stelleSuchprojektionBereit` liefert den Zustand — und wirft nie ein stilles „nicht bereit“", async () => {
    const { ko } = frisch();
    const control = await stelleSuchprojektionBereit(ko);
    expect(control.projectionState).toBe("V2_ACTIVE");
    // Zweiter Aufruf auf einer gesunden Instanz: rein lesend, kein Rebuild, keine neue Generation.
    const vorher = await ko.searchProjectionControl();
    const nochmal = await stelleSuchprojektionBereit(ko);
    expect(nochmal.projectionState).toBe("V2_ACTIVE");
    expect(nochmal.buildGeneration).toBe(vorher.buildGeneration);
    expect(nochmal.activeGeneration).toBe(vorher.activeGeneration);
  });

  it("I4 · Wiederanlauf aus V2_BUILDING setzt DIESELBE Generation fort — er beginnt nicht neu", async () => {
    // Der Absturz mitten im Bau. Ein Neustart, der `beginSearchProjectionBuild` riefe, machte eine
    // neue Generation auf und entwertete den halbfertigen Bestand — in einer Absturzschleife käme
    // die Instanz nie an. Der echte Startweg setzt fort.
    const { ko } = frisch();
    await ko.create({ ...EINGABE, bodyHtml: "<p>Fortsetzungswort</p>" });
    const abgebrochen = await ko.beginSearchProjectionBuild();
    expect(abgebrochen.projectionState).toBe("V2_BUILDING");

    const nachStart = await starteSuchprojektion(ko);
    expect(nachStart.projectionState).toBe("V2_ACTIVE");
    expect(nachStart.buildGeneration).toBe(abgebrochen.buildGeneration);
    expect(nachStart.activeGeneration).toBe(abgebrochen.buildGeneration);
  });

  it("I5 · aus FAILED führt derselbe vollständige Weg zurück — mit einer NEUEN Generation", async () => {
    const { ko } = frisch();
    await ko.create({ ...EINGABE, bodyHtml: "<p>Erholungswort</p>" });
    await stelleSuchprojektionBereit(ko);
    const gesund = await ko.searchProjectionControl();

    await ko.failSearchProjectionBuild("Gegenprobe: erzwungener Fehlschlag");
    const gefallen = await ko.searchProjectionControl();
    expect(gefallen.projectionState).toBe("FAILED");
    expect(gefallen.activeProjectionVersion).toBeNull();
    expect(await suchtNicht(ko)).toBe(true);

    const erholt = await starteSuchprojektion(ko);
    expect(erholt.projectionState).toBe("V2_ACTIVE");
    // Eine Generation wird NIE wiederverwendet — nur so ist ein Marker aus einem abgebrochenen
    // Zyklus für den nächsten wertlos.
    expect(erholt.buildGeneration).toBeGreaterThan(gesund.buildGeneration);
    expect((await ko.findSearchHits({ terms: ["erholungswort"] })).length).toBe(1);
  });

  it("I6 · nach der Freigabe sucht die Instanz über GENAU die aktive Generation", async () => {
    const { ko } = frisch();
    const eins = await ko.create({ ...EINGABE, title: "Erstes", bodyHtml: "<p>Alphawort</p>" });
    await stelleSuchprojektionBereit(ko);
    const aktiv = await ko.searchProjectionControl();

    // Ein NACH der Freigabe angelegtes Objekt gehört ebenfalls in die aktive Projektion — die
    // laufende Fortschreibung ist Teil der Zusage, nicht nur der Bau.
    const zwei = await ko.create({ ...EINGABE, title: "Zweites", bodyHtml: "<p>Betawort</p>" });
    expect((await ko.findSearchHits({ terms: ["alphawort"] })).map((h) => h.koId)).toEqual([
      eins.id,
    ]);
    expect((await ko.findSearchHits({ terms: ["betawort"] })).map((h) => h.koId)).toEqual([
      zwei.id,
    ]);
    // Und die Freigabe hat sich dadurch NICHT verschoben: dieselbe Generation, dieselbe Fassung.
    const danach = await ko.searchProjectionControl();
    expect(danach.projectionState).toBe("V2_ACTIVE");
    expect(danach.activeGeneration).toBe(aktiv.activeGeneration);
    expect(danach.activeProjectionVersion).toBe(SEARCH_PROJECTION_VERSION);
  });
});
