import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type ProjectionControlState,
  UNINITIALIZED_CONTROL_STATE,
  integritaetsMarkerFuer,
} from "../../knowledge-object";
import {
  type SuchprojektionStartDienst,
  starteSuchprojektion,
  stelleSuchprojektionBereit,
} from "./search-projection-startup";

// ================================================================================================
// G27 R2 — DER GEMEINSAME STARTUPVERTRAG (KW-ARCH-G27-SEED-UND-SCHEMAVERTRAG-15 §A)
// ================================================================================================
//
// WAS DIESE DATEI IST. Die Gegenprobe zu dem Befund, den PRO in R1 belegt und als STOP-Zweig
// gemeldet hat: der CLI-Seed lief an der Startorchestrierung vorbei und brach mit
// `SEARCH_PROJECTION_NOT_READY (UNINITIALIZED)` ab, weil `seedDemo()` die Standardsuche braucht und
// die seit R1 fail-closed ist. Entscheidung 15 §A verlangt daraufhin EINEN kanonischen Helper für
// App-Ready und `runSeed()` — und Pflichttests über alle sechs Zustände.
//
// WARUM MIT EINEM DOPPELGÄNGER UND NICHT MIT DEM ECHTEN DIENST. Der Vertrag, der hier geprüft
// wird, ist „welche Operation ruft die Orchestrierung in welchem Zustand" — eine Aussage über die
// Betriebsfolge, nicht über die Projektionslogik. Der Doppelgänger macht genau diese Folge
// beobachtbar und lässt sich in jeden der sechs Zustände versetzen, auch in die, die ein echter
// Dienst nur über einen Absturz erreichte (`V2_BUILDING`, `V2_READY`). Dass die Operationen selbst
// stimmen, ist in `tests/ko/g27-welle1-single-active-projection*.test.ts` und im echten
// PostgreSQL-Lauf belegt; dass App und Seed DIESEN Helper benutzen, in `build-app.test.ts` bzw.
// über den Quelltextvertrag ganz unten.

function control(over: Partial<ProjectionControlState> = {}): ProjectionControlState {
  return { ...UNINITIALIZED_CONTROL_STATE, ...over };
}

/**
 * Zeichnet auf, WELCHE Operation die Orchestrierung gerufen hat — mehr braucht der Vertrag nicht.
 *
 * G27 R3: `bestand` sagt, was die VOLLSTÄNDIGE Bestandsprüfung des Dienstes meldet. Standard ist
 * ein gesunder Bestand; die Gegenproben unten setzen ihn gezielt auf einen Befund und bilden damit
 * genau den Fall ab, den BEN gegen echtes PostgreSQL reproduziert hat: Control-Zeile und Marker
 * formal gültig, der tatsächliche Bestand aber beschädigt.
 */
function dienst(
  start: ProjectionControlState,
  danach?: ProjectionControlState,
  bestand: { alle: boolean; befunde: string[] } = { alle: true, befunde: [] },
) {
  const gerufen: string[] = [];
  let jetzt = start;
  const fertig = (zustand: ProjectionControlState) => {
    jetzt = zustand;
    return Promise.resolve({ control: zustand, readiness: { alle: true } as never });
  };
  const ziel = danach ?? bereit(7);
  const api: SuchprojektionStartDienst = {
    searchProjectionControl: () => Promise.resolve(jetzt),
    activateSearchProjectionV2: () => {
      gerufen.push("activate");
      return fertig(ziel);
    },
    continueSearchProjectionBuild: () => {
      gerufen.push("continue");
      return fertig(ziel);
    },
    releaseSearchProjectionVersion: (generation) => {
      gerufen.push(`release:${generation}`);
      jetzt = ziel;
      return Promise.resolve(ziel);
    },
    recoverSearchProjectionV2: (grund) => {
      gerufen.push(`recover:${grund}`);
      return fertig(ziel);
    },
    searchProjectionReadiness: () => {
      gerufen.push("readiness");
      return Promise.resolve(bestand as never);
    },
  };
  return { api, gerufen };
}

/** Ein sauber freigegebener Zustand: Fassung 2, Generation gesetzt, Marker für GENAU sie gültig. */
function bereit(generation: number): ProjectionControlState {
  return control({
    projectionState: "V2_ACTIVE",
    activeProjectionVersion: 2,
    targetProjectionVersion: 2,
    buildGeneration: generation,
    activeGeneration: generation,
    integrityMarker: integritaetsMarkerFuer(generation),
  });
}

describe("G27 R2 · der Startupvertrag deckt alle sechs Zustände (15 §A)", () => {
  it("UNINITIALIZED → vollständige V2-Aktivierung", async () => {
    const { api, gerufen } = dienst(control({ projectionState: "UNINITIALIZED" }));
    expect((await starteSuchprojektion(api)).projectionState).toBe("V2_ACTIVE");
    expect(gerufen).toEqual(["activate"]);
  });

  it("V1_ACTIVE → Migration über denselben vollständigen Weg", async () => {
    const { api, gerufen } = dienst(
      control({
        projectionState: "V1_ACTIVE",
        activeProjectionVersion: 1,
        targetProjectionVersion: 1,
      }),
    );
    expect((await starteSuchprojektion(api)).projectionState).toBe("V2_ACTIVE");
    expect(gerufen).toEqual(["activate"]);
  });

  it("V2_BUILDING → kontrolliert FORTSETZEN, nicht neu beginnen", async () => {
    const { api, gerufen } = dienst(
      control({ projectionState: "V2_BUILDING", targetProjectionVersion: 2, buildGeneration: 4 }),
    );
    await starteSuchprojektion(api);
    // Der Unterschied ist der ganze Punkt: `activate` würde eine NEUE Generation aufmachen und den
    // halbfertigen Bestand des abgestürzten Laufs entwerten — bei einer Absturzschleife käme die
    // Instanz nie an.
    expect(gerufen).toEqual(["continue"]);
    expect(gerufen).not.toContain("activate");
  });

  it("V2_READY → nur Gate und atomare Freigabe DERSELBEN Generation, kein Rebuild", async () => {
    const { api, gerufen } = dienst(
      control({ projectionState: "V2_READY", targetProjectionVersion: 2, buildGeneration: 9 }),
    );
    await starteSuchprojektion(api);
    expect(gerufen).toEqual(["release:9"]);
  });

  it("V2_ACTIVE mit gültigem Marker UND gesundem Bestand → nur lesen, nichts verändern", async () => {
    const { api, gerufen } = dienst(bereit(3));
    const nachher = await starteSuchprojektion(api);
    // G27 R3: die Bestandsprüfung läuft — und sie ist das EINZIGE, was läuft. Sie ist rein lesend.
    // 06 §6 nennt „Rebuild bei jedem App-Start" ausdrücklich als No-Go; Akzeptanz 4 verlangt, dass
    // ein gültiger Bestand keinen unnötigen Rebuild auslöst.
    expect(gerufen).toEqual(["readiness"]);
    for (const mutierend of ["activate", "continue"]) {
      expect(gerufen).not.toContain(mutierend);
    }
    expect(gerufen.some((g) => g.startsWith("recover:"))).toBe(false);
    expect(gerufen.some((g) => g.startsWith("release:"))).toBe(false);
    // Und der Zustand ist unverändert — dieselbe Generation, derselbe Marker.
    expect(nachher).toEqual(bereit(3));
  });

  it("V2_ACTIVE mit gefallenem Marker → vollständige V2-Recovery", async () => {
    const { api, gerufen } = dienst({ ...bereit(3), integrityMarker: null }, bereit(4));
    expect((await starteSuchprojektion(api)).activeGeneration).toBe(4);
    expect(gerufen).toEqual(["recover:Integritätsmarker beim Start ungültig"]);
  });

  it("V2_ACTIVE mit FREMDEM Marker (andere Generation) → ebenfalls Recovery", async () => {
    // Der schärfere Fall: der Marker ist da, gilt aber für eine andere Generation. Eine reine
    // „ist gesetzt"-Prüfung ginge hier durch.
    const { api, gerufen } = dienst(
      { ...bereit(3), integrityMarker: integritaetsMarkerFuer(2) },
      bereit(4),
    );
    await starteSuchprojektion(api);
    expect(gerufen).toEqual(["recover:Integritätsmarker beim Start ungültig"]);
  });

  it("FAILED → regulärer Recovery-/Rebuildpfad", async () => {
    const { api, gerufen } = dienst(control({ projectionState: "FAILED", lastFailure: "Störung" }));
    expect((await starteSuchprojektion(api)).projectionState).toBe("V2_ACTIVE");
    expect(gerufen).toEqual(["activate"]);
  });
});

// ================================================================================================
// G27 R3 — `V2_ACTIVE` PRÜFT DIE TATSÄCHLICHE INTEGRITÄT (BEN R2-Nachprüfung, ROT-1)
// ================================================================================================
//
// DER BEFUND, den diese Beschreibung festnagelt. Bis R2 prüfte der Start bei `V2_ACTIVE` nur die
// Felder der Control-Zeile. BEN hat gegen echtes PostgreSQL gezeigt, was das bedeutet: löscht
// jemand eine bedienende Projektionszeile am Repository-Adapter VORBEI (direktes `DELETE`, ein
// Restore, ein fremdes Werkzeug), bleibt die Control-Zeile unberührt — Marker gültig, Generation
// gesetzt — und der Start akzeptiert den Schaden. Danach liefert die Suche still `[]`.
//
// Gemessen wurde von BEN exakt:
//     ctrlNachStart: { projectionState: "V2_ACTIVE", activeGeneration: 1, integrityMarker: "V2-READY:1" }
//     nachTreffer: 0, startupError: null, searchError: null
//
// Die Fälle hier bilden genau diese Lage ab: Marker gültig, Bestand beschädigt.
describe("G27 R3 · V2_ACTIVE prüft Generation, Marker UND Bestand", () => {
  const beschaedigt = {
    alle: false,
    befunde: ["unvollständige Projektion (0/1 Inhalt, 1/1 Metadaten)"],
  };

  it("gültiger Marker, aber FEHLENDE aktive Zeile → Recovery statt normalem Start", async () => {
    // Die Control-Zeile ist formal tadellos — genau BENs Ausgangslage.
    const { api, gerufen } = dienst(bereit(1), bereit(2), beschaedigt);
    const nachher = await starteSuchprojektion(api);

    expect(gerufen[0]).toBe("readiness");
    expect(gerufen[1]).toMatch(/^recover:Bestandsintegrität beim Start verletzt/);
    // Der Befund reist mit — „warum?" bleibt für den Betreiber beantwortbar.
    expect(gerufen[1]).toContain("unvollständige Projektion");
    // Und es entsteht ein NEUER sauberer Zyklus, keine Reparatur an einzelnen Zeilen.
    expect(nachher.projectionState).toBe("V2_ACTIVE");
    expect(nachher.activeGeneration).toBe(2);
  });

  it("die Recovery läuft über den EINEN vorhandenen Weg — kein zweiter Startpfad", async () => {
    const { api, gerufen } = dienst(bereit(1), bereit(2), beschaedigt);
    await starteSuchprojektion(api);
    // Nicht `activate`, nicht `continue`, nicht `release`: ausschliesslich `recoverSearchProjectionV2`.
    // Der kennt intern V2_ACTIVE → FAILED → vollständiger Rebuild (Entscheidung 08 §1).
    expect(gerufen.filter((g) => g === "activate" || g === "continue")).toEqual([]);
    expect(gerufen.some((g) => g.startsWith("release:"))).toBe(false);
    expect(gerufen.filter((g) => g.startsWith("recover:"))).toHaveLength(1);
  });

  it("kommt die Instanz nach der Recovery NICHT sauber hoch, ist der Start fail-closed", async () => {
    // Akzeptanz 8: nach der Gegenprobe gilt genau eines — sauberer neuer Zyklus ODER Abbruch.
    // `V2_ACTIVE` plus fachliche Leermenge ist verboten.
    //
    // Der modellierte Ausgang ist der reale: scheitert der Rebuild innerhalb der Recovery, endet
    // `recoverSearchProjectionV2` NICHT in `V2_ACTIVE` — es gibt keinen Weg dorthin, der das Gate
    // umginge. Der Start sieht einen nicht bedienenden Zustand und wirft.
    const rebuildScheitert = control({
      projectionState: "FAILED",
      lastFailure: "2026-08-02T08:00:00.000Z Rebuild gescheitert",
    });
    const { api } = dienst(bereit(1), rebuildScheitert, beschaedigt);
    await expect(stelleSuchprojektionBereit(api)).rejects.toThrow(/nicht betriebsbereit/);
    // Die Meldung nennt den Zustand — für den Betreiber, nicht für einen HTTP-Client.
    await expect(stelleSuchprojektionBereit(api)).rejects.toThrow(/FAILED/);
  });

  it("der Marker wird ZUERST geprüft — ein gefallener Marker braucht keine Bestandsprüfung", async () => {
    // Reihenfolge ist hier eine Kostenfrage, keine Kosmetik: die Bestandsprüfung ist die teure.
    // Steht der Schaden schon in der Control-Zeile, ist sie überflüssig.
    const { api, gerufen } = dienst({ ...bereit(3), integrityMarker: null }, bereit(4));
    await starteSuchprojektion(api);
    expect(gerufen).toEqual(["recover:Integritätsmarker beim Start ungültig"]);
    expect(gerufen).not.toContain("readiness");
  });

  it("auseinanderfallende Generationen sind selbst ein Schaden — vor der Bestandsprüfung erkannt", async () => {
    // Strukturell unmöglich: die Freigabe schreibt `activeGeneration` aus `buildGeneration`.
    // Fielen sie auseinander, prüfte die Readiness die falsche Generation.
    const uneinheitlich = { ...bereit(3), buildGeneration: 4 };
    const { api, gerufen } = dienst(uneinheitlich, bereit(5));
    await starteSuchprojektion(api);
    expect(gerufen[0]).toMatch(/^recover:Generationen beim Start uneinheitlich/);
    expect(gerufen).not.toContain("readiness");
  });

  it("KEIN Vollscan auf einem Suchweg: die Bestandsprüfung läuft genau einmal je Start", async () => {
    const { api, gerufen } = dienst(bereit(3));
    await starteSuchprojektion(api);
    expect(gerufen.filter((g) => g === "readiness")).toHaveLength(1);
  });
});

describe("G27 R2 · fail-closed: kein partieller Erfolg (15 §A)", () => {
  it("erreicht die Instanz V2_ACTIVE, liefert der Helper den Zustand zurück", async () => {
    const { api } = dienst(control({ projectionState: "UNINITIALIZED" }), bereit(5));
    const control_ = await stelleSuchprojektionBereit(api);
    expect(control_.projectionState).toBe("V2_ACTIVE");
    expect(control_.activeGeneration).toBe(5);
  });

  it("erreicht sie ihn NICHT, wirft der Helper — er liefert nie ein stilles „nicht bereit“", async () => {
    // Der Bau läuft, kommt aber nicht durch (Gate nicht bestanden). Genau hier entschied sich
    // früher, ob `seedDemo()` trotzdem loslief.
    const bleibtImBau = control({
      projectionState: "V2_BUILDING",
      targetProjectionVersion: 2,
      buildGeneration: 2,
    });
    const { api } = dienst(bleibtImBau, bleibtImBau);
    await expect(stelleSuchprojektionBereit(api)).rejects.toThrow(/nicht betriebsbereit/);
  });

  it("die Meldung nennt den Zustand — für den Betreiber, nicht für einen HTTP-Client", async () => {
    const gescheitert = control({ projectionState: "FAILED" });
    const { api } = dienst(gescheitert, gescheitert);
    await expect(stelleSuchprojektionBereit(api)).rejects.toThrow(/FAILED/);
  });
});

// ================================================================================================
// DER NACHWEIS, DASS ES WIRKLICH EIN GEMEINSAMER HELPER IST
// ================================================================================================
//
// Entscheidung 15 §A verlangt ausdrücklich den „Nachweis, dass App und Seed denselben Helper
// verwenden". Verhaltenstests allein können das nicht: sie zeigen, dass beide Wege funktionieren,
// nicht dass sie DIESELBE Folge fahren. Zwei kopierte Zustandsmaschinen wären beide grün — und
// genau das ist das No-Go („keine zweite Seed-Zustandsmaschine").
//
// Geprüft wird deshalb am Quelltext, mit derselben Technik, die diese Testfamilie für den
// DDL-Feldvertrag schon benutzt: beide Einstiege importieren und rufen genau dieses eine Symbol,
// und keiner von beiden führt die Fallunterscheidung selbst.
describe("G27 R2 · App-Ready und CLI-Seed benutzen DENSELBEN Helper", () => {
  const lies = (pfad: string): string => readFileSync(pfad, "utf8");

  for (const datei of ["services/app/src/build-app.ts", "services/app/src/seed.ts"]) {
    it(`${datei} importiert und ruft stelleSuchprojektionBereit`, () => {
      const quelle = lies(datei);
      expect(quelle).toMatch(
        /import\s*\{[^}]*stelleSuchprojektionBereit[^}]*\}\s*from\s*"\.\/search-projection-startup"/,
      );
      expect(quelle).toMatch(/await stelleSuchprojektionBereit\(/);
    });

    it(`${datei} führt die Zustandsunterscheidung NICHT selbst`, () => {
      const quelle = lies(datei);
      // Eine zweite Zustandsmaschine würde die Zustandsnamen nebeneinander führen müssen.
      for (const zustand of ["V2_BUILDING", "V2_READY", "V1_ACTIVE"]) {
        expect(quelle, `${datei} nennt ${zustand} — zweite Zustandsmaschine?`).not.toContain(
          `"${zustand}"`,
        );
      }
      expect(quelle).not.toContain("continueSearchProjectionBuild(");
      expect(quelle).not.toContain("recoverSearchProjectionV2(");
    });
  }

  it("seed.ts ruft den Helper VOR seedDemo — sonst gäbe es einen partiellen Seed", () => {
    const quelle = lies("services/app/src/seed.ts");
    const helper = quelle.indexOf("await stelleSuchprojektionBereit(");
    const demo = quelle.indexOf("await seedDemo(services)");
    expect(helper).toBeGreaterThan(-1);
    expect(demo).toBeGreaterThan(-1);
    expect(helper).toBeLessThan(demo);
  });
});
