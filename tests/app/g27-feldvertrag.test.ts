// ================================================================================================
// G27 — EIN FELDVERTRAG, EINE MIGRATION, EIN DATENRAUM
// ================================================================================================
//
// Diese Datei prüft die VERTRÄGE, nicht das Verhalten einzelner Treffer (das tun die Dateien unter
// tests/ko, tests/library und tests/ask). Sie beantwortet drei Fragen, die sonst niemand stellt:
//
//   1 Benutzen Bibliothek UND Klara wirklich DENSELBEN Weg an den durchsuchbaren Text — oder gibt
//     es zwei Umsetzungen, die auseinanderlaufen können?
//   2 Ist die additive Migration wirklich migriert (und additiv)?
//   3 Bleibt alles innerhalb der Deployment-/Mandantengrenze — keine zentrale, kundenübergreifende
//     Ablage, keine Dokumentinhalte in zentraler Telemetrie?
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  KoService,
  SEARCH_PROJECTION_FIELDS,
} from "../../services/knowledge-object";

function lies(pfad: string): string {
  return readFileSync(pfad, "utf8");
}

const DDL_DATEI = "services/knowledge-object/src/search-projection-repo-pg.ts";

// Der ROHE Rumpf einer exportierten DDL-Template-Konstante (zwischen den beiden Backticks).
function ddlKonstante(quelle: string, name: string): string {
  const anfang = quelle.indexOf(`export const ${name} = \``);
  expect(anfang, `${name} nicht gefunden`).toBeGreaterThanOrEqual(0);
  const auf = quelle.indexOf("`", anfang);
  return quelle.slice(auf + 1, quelle.indexOf("`", auf + 1));
}

// Der Quelltext ohne reine Kommentarzeilen (TypeScript wie SQL). Ein Vertrag über AUSGEFÜHRTE DDL
// darf nicht daran hängen, dass eine Erläuterung dieselben Wörter benutzt wie die Anweisung.
function ohneKommentare(quelle: string): string {
  return quelle
    .split("\n")
    .filter((zeile) => !/^\s*(\/\/|\/\*|\*|--)/.test(zeile))
    .join("\n");
}

// Die AUSFÜHRBAREN Anweisungen einer DDL-Konstante, jede auf einer Zeile normalisiert.
// SQL-Zeilenkommentare fallen weg: die Datenbank führt sie nicht aus, und ein Vertrag über das
// Ausgeführte darf nicht an einem Kommentarwort hängen. Geprüft wird damit genau das, was läuft.
function ddlAnweisungen(rumpf: string): string[] {
  return rumpf
    .split("\n")
    .filter((zeile) => !zeile.trimStart().startsWith("--"))
    .join("\n")
    .split(";")
    .map((anweisung) => anweisung.replace(/\s+/g, " ").trim())
    .filter((anweisung) => anweisung.length > 0);
}

describe("G27 · ein gemeinsamer Suchvertrag für Bibliothek und Klara", () => {
  it("beide Wege laufen über DIESELBE Methode des knowledge-object-Moduls", () => {
    const bibliothek = lies("services/library-analytics/src/service.ts");
    const askKandidaten = lies("services/knowledge-object/src/service.ts");
    // Die Bibliothekssuche holt ihre Treffer aus der Projektion …
    expect(bibliothek).toContain("findSearchHits");
    // … und der Ask-Kandidatenweg (KoService.findCandidates, von AskService gerufen) ebenso.
    expect(askKandidaten).toMatch(/async findCandidates\([\s\S]*?findSearchHits/);
    // Keine zweite Auslegung: das alte, kurzfeldgebundene Repo-findCandidates wird vom Dienst
    // nicht mehr als Suchweg benutzt.
    expect(askKandidaten).not.toContain("await this.repo.findCandidates(");
  });

  it("AskService fragt weiterhin über KoService.findCandidates — kein eigener Suchweg", () => {
    const ask = lies("services/ask/src/service.ts");
    expect(ask).toContain("this.koService.findCandidates(");
  });

  it("der Feldvertrag ist EIN Datum und wird von beiden Seiten geteilt", async () => {
    const repo = new InMemoryKoRepo();
    const ko = new KoService({ repo, searchProjections: new InMemoryKoSearchProjectionRepo(repo) });
    await ko.activateSearchProjectionV2();
    const erstellt = await ko.create({
      title: "Vertragsobjekt",
      statement: "Kurzfassung.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
      bodyHtml: "<p>Vertragswort</p>",
    });
    const projektion = await ko.searchProjectionOf(erstellt.id);
    expect(projektion).toBeDefined();
    expect(Object.keys(projektion as object).sort()).toEqual([...SEARCH_PROJECTION_FIELDS].sort());
  });
});

describe("G27 · die additive Migration", () => {
  it("die DDL-Konstante ist in migrate() referenziert (db.migrate.test.ts erzwingt es generisch)", () => {
    const db = lies("services/app/src/db.ts");
    expect(db).toContain("KO_SEARCH_PROJECTION_SCHEMA");
    // Reihenfolge: NACH KO_SCHEMA (pg_trgm-Extension + `kos` für den JOIN müssen vorher stehen).
    const liste = db.indexOf("const schemas = [");
    const projektion = db.indexOf("KO_SEARCH_PROJECTION_SCHEMA", liste);
    const basis = db.indexOf("KO_SCHEMA,", liste);
    expect(projektion).toBeGreaterThan(basis);
  });

  // ----------------------------------------------------------------------------------------------
  // DER DDL-VERTRAG NACH DETAILENTSCHEIDUNG J
  // ----------------------------------------------------------------------------------------------
  //
  // Die frühere Fassung dieses Tests verbot JEDES `ALTER`. Das war gegen eine Bestandsumgebung genau
  // der No-Go aus Abschnitt J: `CREATE TABLE IF NOT EXISTS` ist gegen eine bereits in Fassung 1
  // angelegte Tabelle ein reines No-op, die V2-Spalten fehlten dort weiter, und der erste V2-Insert
  // bräche ab. Abschnitt J VERLANGT deshalb eine additive, wiederholbare Nachrüststufe.
  //
  // „Additiv" wird hier nicht geglaubt, sondern gemessen: jede ALTER-Anweisung muss eine
  // Spaltennachrüstung mit `IF NOT EXISTS` sein, es dürfen GENAU die beiden gegenüber Fassung 1
  // neuen Spalten sein, und alles Wegnehmende (DROP/TRUNCATE/DELETE) sowie jede umschreibende
  // ALTER-Form (ALTER COLUMN, RENAME, nachträgliches SET NOT NULL/SET DATA TYPE) bleibt verboten.
  it("die DDL ist additiv: nur die notwendigen V2-Nachrüstungen, jede mit IF NOT EXISTS", () => {
    const anweisungen = ddlAnweisungen(
      ddlKonstante(lies(DDL_DATEI), "KO_SEARCH_PROJECTION_SCHEMA"),
    );

    const tabellen = anweisungen.filter((a) => /^CREATE TABLE/i.test(a));
    expect(tabellen).toHaveLength(1);
    expect(tabellen[0]).toContain("CREATE TABLE IF NOT EXISTS ko_search_projections");
    expect(tabellen[0]).toContain("PRIMARY KEY (ko_id, ko_version)");

    // Jede ALTER-Anweisung ist eine additive, wiederholbare Spaltennachrüstung an der
    // Projektionstabelle — nichts anderes.
    const nachgeruestet: string[] = [];
    for (const anweisung of anweisungen.filter((a) => /\bALTER\b/i.test(a))) {
      const treffer =
        /^ALTER TABLE ko_search_projections ADD COLUMN IF NOT EXISTS (\w+) (.+)$/i.exec(anweisung);
      expect(treffer, `nicht additive ALTER-Form: ${anweisung}`).not.toBeNull();
      const spalte = treffer?.[1] as string;
      nachgeruestet.push(spalte);
      // Nachgerüstet == neu angelegt: dieselbe Typ- und Defaultangabe wie in der CREATE-TABLE-Zeile.
      // Sonst wäre eine migrierte Umgebung strukturell eine andere als eine frische.
      expect(tabellen[0], `Spalte ${spalte} weicht von der Tabellendefinition ab`).toContain(
        `${spalte} ${treffer?.[2]}`,
      );
    }
    // GENAU die drei gegenüber Fassung 1 neuen Spalten — keine stille Schemaerweiterung nebenbei.
    // `generation` ist seit KW-ARCH-G27-GENERATION-UND-INTEGRITAET-09 §2 verbindlicher Bestandteil
    // der generationsgebundenen Suchprojektion; die Nachführung dieses Sollwerts ist durch
    // KW-ARCH-G27-FELDVERTRAG-11 ausdrücklich freigegeben. Geprüft wird weiterhin auf die EXAKTE,
    // sortierte Menge — nicht auf „mindestens drei".
    expect([...nachgeruestet].sort()).toEqual([
      "body_text",
      "classification_snapshot",
      "generation",
    ]);

    for (const anweisung of anweisungen) {
      // Wegnehmendes bleibt verboten: ein Drop/Rebuild ist laut Abschnitt J allenfalls ein
      // ausdrücklich benannter Entwicklungs-/Recovery-Pfad, NIE die Standardmigration.
      for (const verboten of [/\bDROP\b/i, /\bTRUNCATE\b/i, /\bDELETE\b/i]) {
        expect(anweisung, `destruktive Anweisung: ${anweisung}`).not.toMatch(verboten);
      }
      // Umschreibende ALTER-Formen ebenso: sie sind nicht additiv und gegen eine Bestandstabelle
      // mit Daten nicht wiederholbar folgenlos.
      for (const verboten of [/ALTER COLUMN/i, /\bRENAME\b/i, /SET NOT NULL/i, /SET DATA TYPE/i]) {
        expect(anweisung, `nicht additive ALTER-Form: ${anweisung}`).not.toMatch(verboten);
      }
      // Keine Vektorsuche, keine Embeddings, kein neuer externer Dienst.
      expect(anweisung).not.toMatch(/vector|embedding|pgvector/i);
    }
  });

  // ----------------------------------------------------------------------------------------------
  // DER EXAKTE FELDVERTRAG (KW-ARCH-G27-SEED-UND-SCHEMAVERTRAG-15 §B)
  // ----------------------------------------------------------------------------------------------
  //
  // WAS SICH GEÄNDERT HAT UND WARUM. Diese Zusicherung war auf EINE migrierte Konstante geschrieben
  // und zählte die Nachrüststufen dateiweit dagegen. Beides stimmte, solange die Adapterdatei nur
  // `KO_SEARCH_PROJECTION_SCHEMA` führte. Seit G27 R1 führt sie zusätzlich
  // `KO_PROJECTION_CONTROL_SCHEMA` mit den vier Steuerspalten aus Entscheidung 09 §2
  // (`build_generation`, `active_generation`, `integrity_marker`, `activated_at`) — die dateiweite
  // Zahl war damit 7, die Ein-Konstanten-Erwartung war bereits am eingefrorenen Prüfstand falsch.
  //
  // Entscheidung 15 §B führt den Sollstand deshalb exakt nach: 3 / 4 / 7 und genau ZWEI migrierte
  // Konstanten. Die Prüfung wird dadurch nicht schwächer, sondern schärfer — sie zählt jetzt JE
  // Konstante UND dateiweit, und sie belegt, dass die Summe der beiden Konstanten die dateiweite
  // Zahl vollständig erklärt. Damit kann keine ADD-COLUMN-Anweisung ausserhalb einer migrierten
  // Konstante überleben; genau das war der Zweck der ursprünglichen Zusicherung.
  it("der Feldvertrag ist exakt: 3 / 4 / 7 ADD COLUMN in genau zwei migrierten Konstanten", () => {
    const quelle = lies(DDL_DATEI);
    const suchprojektion = ddlKonstante(quelle, "KO_SEARCH_PROJECTION_SCHEMA");
    const controlState = ddlKonstante(quelle, "KO_PROJECTION_CONTROL_SCHEMA");

    const zaehle = (text: string) => (text.match(/ADD COLUMN/gi) ?? []).length;

    // (1) JE KONSTANTE exakt — keine Mindestzahl, keine Enthaltensein-Prüfung.
    expect(zaehle(suchprojektion)).toBe(3);
    expect(zaehle(controlState)).toBe(4);

    // (2) DATEIWEIT exakt. Diese Gegenprobe bleibt ausdrücklich stehen: sie ist die einzige, die
    // eine ADD-COLUMN-Anweisung ausserhalb der beiden Konstanten überhaupt sichtbar machen könnte.
    // Erläuterungen in Kommentaren zählen nicht.
    expect(zaehle(ohneKommentare(quelle))).toBe(7);

    // (3) DIE SUMME ERKLÄRT DIE DATEI VOLLSTÄNDIG. 3 + 4 = 7 heisst: es gibt keine siebte, achte
    // oder herrenlose Anweisung irgendwo dazwischen. Ohne diese Zeile wären (1) und (2) zwei
    // unabhängige Zahlen, die zufällig zusammenpassen könnten.
    expect(zaehle(suchprojektion) + zaehle(controlState)).toBe(zaehle(ohneKommentare(quelle)));

    // (4) DIE FELDER EINDEUTIG DER RICHTIGEN KONSTANTE ZUGEORDNET — nicht nur gezählt.
    const spalten = (text: string) =>
      [...text.matchAll(/ADD COLUMN IF NOT EXISTS\s+(\w+)/gi)].map((m) => m[1]).sort();
    expect(spalten(suchprojektion)).toEqual(["body_text", "classification_snapshot", "generation"]);
    expect(spalten(controlState)).toEqual([
      "activated_at",
      "active_generation",
      "build_generation",
      "integrity_marker",
    ]);

    // (5) GENAU DIESE ZWEI exportierten Schemakonstanten — keine dritte, keine unbekannte.
    expect([...quelle.matchAll(/export const (\w+_SCHEMA)\s*=\s*`/g)].map((m) => m[1])).toEqual([
      "KO_SEARCH_PROJECTION_SCHEMA",
      "KO_PROJECTION_CONTROL_SCHEMA",
    ]);

    // (6) UND BEIDE WERDEN VON migrate() AUSGEFÜHRT. Das ist der Punkt, an dem der ganze Vertrag
    // hängt: eine Nachrüststufe in einer Konstante, die niemand migriert, wäre gegen eine
    // Bestandsumgebung wirkungslos — sie stünde da und täte nichts.
    const migration = lies("services/app/src/db.ts");
    for (const konstante of ["KO_SEARCH_PROJECTION_SCHEMA", "KO_PROJECTION_CONTROL_SCHEMA"]) {
      expect(migration, `${konstante} wird nicht migriert`).toMatch(
        new RegExp(`^\\s*${konstante},\\s*$`, "m"),
      );
    }
  });

  it("die Primärschlüssel-Zusage steht auch im Adapter (append-only per ON CONFLICT DO NOTHING)", () => {
    const adapter = lies("services/knowledge-object/src/search-projection-repo-pg.ts");
    expect(adapter).toContain("ON CONFLICT (ko_id, ko_version) DO NOTHING");
  });
});

describe("G27 · Deployment-/Mandantengrenze und Telemetrie", () => {
  it("die Projektion liegt in DERSELBEN Datenbank wie der Bestand — kein zweiter Dienst, kein zentraler Cache", () => {
    const build = lies("services/app/src/build-app.ts");
    // Der Pg-Adapter bekommt GENAU den Pool, mit dem auch PgKoRepo verdrahtet ist.
    expect(build).toContain("new PgKoSearchProjectionRepo(pool)");
    const adapter = lies("services/knowledge-object/src/search-projection-repo-pg.ts");
    // Kein Netz, kein fremder Endpunkt, kein Client eines Drittdienstes.
    expect(adapter).not.toMatch(/fetch\(|http:\/\/|https:\/\//);
  });

  it("kein G27-Log trägt Dokumentinhalt, Suchtext, Snippet oder Prompt", () => {
    const quellen = [
      "services/knowledge-object/src/search-projection.ts",
      "services/knowledge-object/src/search-projection-repo.ts",
      "services/knowledge-object/src/search-projection-repo-pg.ts",
      "services/knowledge-object/src/service.ts",
      "services/library-analytics/src/service.ts",
    ].map(lies);
    for (const quelle of quellen) {
      // Alle Log-Zeilen dieser Dateien einsammeln und auf Inhaltsfelder prüfen.
      for (const zeile of quelle.split("\n")) {
        if (!/process\.stderr\.write|process\.stdout\.write|console\./.test(zeile)) {
          continue;
        }
        for (const verboten of [
          "searchText",
          "search_text",
          "bodyHtml",
          "statement",
          "captionText",
          "question",
          "prompt",
        ]) {
          expect(zeile, `Log-Zeile trägt Inhalt (${verboten}): ${zeile.trim()}`).not.toContain(
            verboten,
          );
        }
      }
    }
  });

  it("die Projektion transportiert keinen Textinhalt in die Trefferliste (nur Fundstelle + Kennzahlen)", async () => {
    const repo = new InMemoryKoRepo();
    const ko = new KoService({ repo, searchProjections: new InMemoryKoSearchProjectionRepo(repo) });
    await ko.activateSearchProjectionV2();
    await ko.create({
      title: "Transportobjekt",
      statement: "Kurzfassung.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
      bodyHtml: "<p>GEHEIMER DOKUMENTTEXT Transportwort</p>",
    });
    const [hit] = await ko.findSearchHits({ terms: ["transportwort"] });
    expect(hit).toBeDefined();
    expect(JSON.stringify(hit)).not.toContain("GEHEIMER DOKUMENTTEXT");
    expect(Object.keys(hit as object).sort()).toEqual([
      "contentHash",
      "koId",
      "koVersion",
      "language",
      "matched",
      "projectionVersion",
      "status",
    ]);
  });
});
