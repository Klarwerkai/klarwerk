// ================================================================================================
// JOB 821 · D2 — WAS DER CODE ÜBER `candidateItemId` HEUTE WIRKLICH SAGT.
// ================================================================================================
//
// BEN hat D1 in einem Punkt widersprochen, und der Widerspruch trägt (BEN-PRUEFUNG-JOB-821-D1.md):
//
//   „Der bloße Feldname `candidateItemId` und ein Kommentar in der Websicht definieren nicht, auf
//    welche Domänenentität diese ID referenziert. … Im Produktcode gibt es keinen nachgewiesenen
//    Aufruf von `appendItemRefs`, der `candidateItemId` einer neuen Itementität zuordnet."
//
// Daraus folgt Mangel 1: „Referenzziel von `candidateItemId` ungeklärt. Es ist NICHT BELEGT, ob die
// ID auf den bestehenden `ImportCandidate`, eine künftige `ImportCandidateItem`-Entität oder einen
// reinen Laufbezeichner zeigt."
//
// DIESE DATEI ENTSCHEIDET DAS NICHT. Sie hält den Ist-Befund fest, aus dem die offene Frage
// überhaupt erst folgt — damit die Ownerentscheidung auf einer Messung fußt und nicht auf einer
// Namensinferenz. Wird morgen ein Erzeuger gebaut, wird dieser Wächter rot und zwingt dazu, die
// Semantik zusammen mit ihm zu benennen. Genau das ist sein Zweck.
//
// Die Entität selbst bleibt ungebaut (Mangel 2: `ENTSCHEIDUNG_NOETIG`).
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pruefeSnapshotKette } from "../../services/ask/src/repo";
// `AskError` wird in `src/repo` nur lokal importiert; exportiert ist sie in `src/types`.
import { AskError } from "../../services/ask/src/types";

const SERVICES = join(__dirname, "../../services");
const APPS = join(__dirname, "../../apps");

/** Alle Produktdateien (ohne Tests) unterhalb eines Wurzelverzeichnisses. */
function produktdateien(wurzel: string): string[] {
  const treffer: string[] = [];
  const lauf = (verzeichnis: string) => {
    for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
      if (eintrag.name === "node_modules" || eintrag.name === "dist") {
        continue;
      }
      const voll = join(verzeichnis, eintrag.name);
      if (eintrag.isDirectory()) {
        lauf(voll);
      } else if (/\.(ts|tsx)$/.test(eintrag.name) && !/\.test\.tsx?$/.test(eintrag.name)) {
        treffer.push(voll);
      }
    }
  };
  lauf(wurzel);
  return treffer;
}

describe("JOB 821 · Auflage 1 — der Ist-Befund zum Referenzziel, gemessen statt inferiert", () => {
  it("kein Produktpfad RUFT `appendItemRefs` auf — die Laufdomäne wird nie befüllt", () => {
    // Das ist der Kern von BENs Einwand. Die Methode existiert (repo-pg.ts) und ist getestet, aber
    // niemand im Produktcode übergibt ihr Referenzen. Solange das so ist, gibt es keinen Erzeuger,
    // aus dem sich die Bedeutung von `candidateItemId` ablesen ließe.
    const aufrufer = [...produktdateien(SERVICES), ...produktdateien(APPS)]
      .filter((datei) => {
        const text = readFileSync(datei, "utf8");
        // Die Definition selbst und reine Namenslisten (dev-persist führt Methodennamen als
        // Zeichenketten) sind keine Aufrufe.
        return /\bappendItemRefs\s*\(/.test(text) && !/async appendItemRefs\s*\(/.test(text);
      })
      .map((datei) => datei.slice(datei.indexOf("/services") + 1));
    expect(aufrufer).toEqual([]);
  });

  it("kein Produktpfad SETZT `candidateItemId` auf einen erzeugten Wert", () => {
    // Gelesen und durchgereicht wird das Feld (Route, Websicht, Repo-Validierung) — erzeugt nicht.
    // Ein Erzeuger wäre eine Zuweisung aus etwas anderem als einer vorhandenen Referenz.
    const erzeuger = [...produktdateien(SERVICES), ...produktdateien(APPS)]
      .flatMap((datei) => {
        const text = readFileSync(datei, "utf8");
        return [...text.matchAll(/candidateItemId:\s*([^,\n]+)/g)].map((m) => ({
          datei: datei.slice(datei.indexOf("/services") + 1),
          wert: (m[1] as string).trim(),
        }));
      })
      // Ein Wert, der selbst wieder `candidateItemId` liest, ist DURCHREICHEN — auch in der
      // Ternärform der Websicht (`geliefert(item.candidateItemId) ? item.candidateItemId : null`).
      // `string` ist die Typdeklaration. Ein Erzeuger wäre alles andere: eine neue Kennung, eine
      // Ableitung aus dem Kandidaten, ein Laufbezeichner — und genau der fehlt.
      .filter((t) => !t.wert.includes("candidateItemId") && !/^string/.test(t.wert))
      .map((t) => `${t.datei}: ${t.wert}`);
    expect(erzeuger).toEqual([]);
  });

  it("der pflichtige Verweis wird erzwungen, obwohl es nichts zu verweisen gibt", () => {
    // Beide Seiten des Befunds in einem Fall: `candidateItemId` ist NICHT optional (types.ts), und
    // das Repo lehnt eine leere Referenz ausdrücklich ab. Die Strenge ist real — nur ihr Ziel ist
    // offen. Genau diese Spannung ist der Gegenstand der Ownerentscheidung.
    const typen = readFileSync(join(SERVICES, "library-analytics/src/types.ts"), "utf8");
    expect(typen).toContain("readonly candidateItemId: string;");
    expect(typen).not.toContain("readonly candidateItemId?: string");

    const repo = readFileSync(join(SERVICES, "library-analytics/src/repo.ts"), "utf8");
    expect(repo).toContain("Eine Elementreferenz ohne candidateItemId referenziert nichts.");
  });
});

describe("JOB 821 · Z2 — die Fundstellen-Kette ist über zwei Dienste hinweg ehrlich", () => {
  // Der Import erzeugt keine Belegstelle (`excerpt: null`, s. import-fundstelle.test.ts). Der
  // Antwortweg trägt dieselbe Wahrheit weiter — und zwar MIT maschinenlesbarem Grund. Dieser Teil
  // ist funktional geprüft, nicht gelesen: `pruefeSnapshotKette` ist exportiert.
  const basis = {
    answerId: "a-1",
    snapshotRevision: 1,
    supersedesSnapshotRevision: null,
    resolutionId: null,
    resolutionIdReason: "w2a_not_wired",
    validationDecisionRef: null,
    validationDecisionRefReason: "w2a_not_wired",
  };
  const beleg = {
    knowledgeObjectId: "ko-1",
    knowledgeObjectVersion: null,
    evidenceRole: "consulted" as const,
    sourceRecordId: null,
    sourceRecordIdReason: "w2a_not_wired",
  };

  it("ein fehlender `locator` MIT Grund ist zulässig — das ist der Importfall", () => {
    // `no_locator_from_import` ist der kanonische Grund für genau diese Lage (ask/src/types.ts).
    expect(() =>
      pruefeSnapshotKette(
        {
          ...basis,
          evidence: [{ ...beleg, locator: null, locatorReason: "no_locator_from_import" }],
        } as never,
        [],
      ),
    ).not.toThrow();
  });

  it("ein fehlender `locator` OHNE Grund wird abgelehnt — Schweigen ist kein Grund", () => {
    // Die Gegenrichtung. Ohne sie belegte der Fall oben nur, dass irgendetwas durchgeht.
    expect(() =>
      pruefeSnapshotKette(
        { ...basis, evidence: [{ ...beleg, locator: null, locatorReason: null }] } as never,
        [],
      ),
    ).toThrow(AskError);
  });

  it("derselbe Vertrag gilt für die Quellsatz-Referenz", () => {
    expect(() =>
      pruefeSnapshotKette(
        {
          ...basis,
          evidence: [
            {
              ...beleg,
              sourceRecordIdReason: null,
              locator: null,
              locatorReason: "no_locator_from_import",
            },
          ],
        } as never,
        [],
      ),
    ).toThrow(AskError);
  });
});
