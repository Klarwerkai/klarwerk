// ================================================================================================
// JOB 4151 · TEST 1 — DIE KANTEN-BAUSTEINE SIND ÜBER DIE ÖFFENTLICHE MODULGRENZE ERREICHBAR.
// ================================================================================================
//
// DER GEMESSENE AUSGANGSZUSTAND (Auftrag §2, am Produkt-main `9ca774f` selbst nachgelesen):
// `services/knowledge-object/index.ts` exportiert aus `service`, `repo`, `repo-pg`,
// `search-projection*`, `metadata-projection*`, `document-append`, `document-create`,
// `source-anchor`, `display-status`, `ownership`, `source-url`, `confidentiality`, `types` und
// `upload-limits` — und aus KEINER `kanten-*`-Datei. Hinter der von `dependency-cruiser`
// erzwungenen Modulgrenze (`.dependency-cruiser.cjs`, Regel `module-boundaries`: „Cross-Modul-
// Imports nur über die öffentliche index.ts des Zielmoduls") war der fertige Lesedienst für die
// Anwendung damit unerreichbar.
//
// WARUM DIESER TEST NICHT ÜBER DEN TIEFEN PFAD IMPORTIERT: genau das ist die Ausnahme, die eine
// Testdatei sich nehmen darf und die Anwendung nicht — `tests/ko/kanten-lesekette-sichtbarkeit.test.ts:25-29`
// tut es bis heute. Ein Test über `../../services/knowledge-object/src/kanten-service` wäre auch
// ohne jeden Export grün und würde die Lücke gerade verdecken. Dieser Import ist deshalb
// AUSSCHLIESSLICH der über `services/knowledge-object`.
import { describe, expect, it } from "vitest";
import {
  DeduplizierenderKantenBestand,
  InMemoryKoRepo,
  KANTEN_ARTEN,
  KANTEN_RICHTUNGEN,
  KANTEN_SCHEMA,
  KantenError,
  KantenLeseService,
  KantenSchreibService,
  KoService,
  PgKantenRepo,
  beziehungsSchluessel,
  istSelbstbeziehung,
  kanonischesPaar,
  traegtRichtungsaussage,
} from "../../services/knowledge-object";
import type {
  KantenRepo,
  KuratierteKante,
  KuratierteKanten,
} from "../../services/knowledge-object";
import { kante } from "./bestandsvertrag";

describe("JOB 4151 · Modulgrenze — die Kanten-Bausteine kommen über die öffentliche index.ts", () => {
  it("M1: jeder Baustein ist da und ist das, was er zu sein behauptet", () => {
    expect(typeof DeduplizierenderKantenBestand).toBe("function");
    expect(typeof PgKantenRepo).toBe("function");
    expect(typeof KantenLeseService).toBe("function");
    expect(typeof KantenSchreibService).toBe("function");
    expect(typeof KantenError).toBe("function");
    expect(typeof KANTEN_SCHEMA).toBe("string");
    expect(KANTEN_ARTEN).toEqual([
      "gehoert_zu",
      "ergaenzt",
      "ersetzt",
      "widerspricht",
      "beispiel_fuer",
    ]);
    expect(KANTEN_RICHTUNGEN).toEqual(["gerichtet", "ungerichtet", "symmetrisch"]);
  });

  it("M2: die Kanonisierungshelfer sind dieselben wie im Modulinneren — nicht nachgebaut", () => {
    const a: KuratierteKante = kante({ quelleId: "ko-b", zielId: "ko-a" });
    expect(traegtRichtungsaussage("gerichtet")).toBe(true);
    expect(traegtRichtungsaussage("ungerichtet")).toBe(false);
    expect(istSelbstbeziehung(kante({ quelleId: "ko-a", zielId: "ko-a" }))).toBe(true);
    // Richtungslos: die kleinere Kennung steht vorn.
    expect(kanonischesPaar(a).quelleId).toBe("ko-a");
    // Beide Leserichtungen ergeben DENSELBEN Schlüssel — das ist die Dedup-Zusage in einer Zeile.
    expect(beziehungsSchluessel(a)).toBe(
      beziehungsSchluessel(kante({ quelleId: "ko-a", zielId: "ko-b" })),
    );
  });

  it("M3: Lese- UND Schreibdienst sind über die Fassade verdrahtbar — mit echtem KO-Bestand", async () => {
    const ko = new KoService({ repo: new InMemoryKoRepo() });
    const neu = async (title: string) =>
      (
        await ko.create({
          title,
          statement: `Aussage zu ${title}`,
          type: "best_practice",
          category: "Betrieb",
          author: "u1",
          tags: [],
        })
      ).id;
    const links = await neu("Wartungsplan Halle 2");
    const rechts = await neu("Filterwechsel dokumentiert");

    const repo: KantenRepo = new DeduplizierenderKantenBestand();
    const schreiber = new KantenSchreibService({ repo, kos: ko });
    const { kante: gesetzt, ergebnis } = await schreiber.setze(
      {
        id: "k-modulgrenze",
        quelleId: links,
        zielId: rechts,
        art: "ergaenzt",
        richtung: "ungerichtet",
        urheber: "u-mensch",
        jetzt: "2026-09-15T08:00:00.000Z",
        beitragSchluessel: "b-modulgrenze",
        gesehen: { quelleVersion: 1, zielVersion: 1 },
      },
      { sichtbar: () => true },
    );
    expect(gesetzt.urheber).toBe("u-mensch");
    expect(ergebnis).toBe("angelegt");
    const nochmal: KuratierteKante = gesetzt;
    expect(nochmal.status).toBe("aktiv");

    const auskunft: KuratierteKanten = await new KantenLeseService({ repo, kos: ko }).kantenFuer(
      links,
      { sichtbar: () => true },
    );
    expect(auskunft.koId).toBe(links);
    expect(auskunft.total).toBe(1);
    expect(auskunft.kanten[0]?.gegenstueck.id).toBe(rechts);
  });

  it("M4: `KantenLeseService` trägt weiterhin GENAU eine Methode", () => {
    // Die Zusage aus `kanten-service.ts:235-241`. Sie steht auch in
    // `tests/ko/kanten-lesekette-sichtbarkeit.test.ts:252` und bleibt dort unverändert; hier wird
    // sie ein zweites Mal gemessen, weil dieser Auftrag einen SCHREIBdienst danebenstellt — und
    // genau dabei ist die naheliegende Abkürzung, eine Schreibmethode an den Lesedienst zu hängen.
    const flaeche = Object.getOwnPropertyNames(KantenLeseService.prototype).filter(
      (n) => n !== "constructor",
    );
    expect(flaeche).toEqual(["kantenFuer"]);
  });

  it("M5: die DDL-Konstante ist rein additiv — kein DROP, kein TRUNCATE, kein DELETE", () => {
    expect(KANTEN_SCHEMA).toMatch(/CREATE TABLE IF NOT EXISTS\s+ko_kanten/i);
    expect(KANTEN_SCHEMA).not.toMatch(/DROP\s+TABLE/i);
    expect(KANTEN_SCHEMA).not.toMatch(/TRUNCATE/i);
    expect(KANTEN_SCHEMA).not.toMatch(/DELETE\s+FROM/i);
    expect(KANTEN_SCHEMA).not.toMatch(/DROP\s+COLUMN/i);
    // Die Eindeutigkeit der fachlichen Beziehung hängt an einem Index, nicht an Anwendungscode.
    expect(KANTEN_SCHEMA).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS/i);
    // JOB 4151 (BEN R3): und die Eindeutigkeit des WIEDERHOLSCHLÜSSELS an einem Primärschlüssel.
    // Sie steht hier, weil sie aus dem Anwendungscode allein nicht herzustellen ist: über die
    // Elemente einer jsonb-Liste kann kein Index wachen (s. `kanten-repo-pg.ts`).
    expect(KANTEN_SCHEMA).toMatch(/CREATE TABLE IF NOT EXISTS\s+ko_kanten_beitrag/i);
    expect(KANTEN_SCHEMA).toMatch(/beitrag_schluessel text PRIMARY KEY/i);
  });
});
