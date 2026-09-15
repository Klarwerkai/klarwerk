import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { pflichttabellenAusDrill } from "./pflichtsatz";

const root = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const ANLEITUNGEN = ["scripts/backup/RESTORE.md", "docs/operations/restore-drill.md"] as const;

it("Skript und beide Anleitungen führen denselben eindeutigen Exitcodesatz und Startweg", () => {
  const script = read("scripts/backup/restore-drill.sh");
  const codes = [...script.matchAll(/^#\s+(\d+)\s+/gm)].map((match) => Number(match[1]));
  // JOB 4097: 62 (Aufbaufehler des Wissensnachweises) und 73 (Befund am Bestand) kommen dazu — und
  // sie stehen bewusst in ihren Familien: 6x = Aufbaufehler, 7x = Befund. Ein Aufbaufehler darf
  // nicht wie ein Befund aussehen; das ist seit JOB 517 der Kern dieses Skripts.
  expect(codes).toEqual([0, 1, 10, 11, 20, 21, 22, 23, 24, 30, 31, 60, 61, 62, 70, 71, 72, 73, 80]);
  for (const path of ANLEITUNGEN) {
    const doc = read(path);
    expect(
      [...doc.matchAll(/^\| `(\d+)` \|/gm)].map((match) => Number(match[1])),
      path,
    ).toEqual(codes);
    expect(doc).toContain("npx tsx services/app/src/server.ts");
  }
  expect(script).toContain("npx tsx services/app/src/server.ts");
});

// ==================================================================================================
// JOB 4097 — DIE ABLÖSUNG DER VIER NAMEN WIRD GEBUNDEN, NICHT NUR VOLLZOGEN.
// ==================================================================================================
//
// Bis JOB 4097 stand an dieser Stelle:
//     for (const table of ["kos","users","audit","objects"]) expect(doc).toContain(`\`${table}\``)
// Der Wächter verlangte also von beiden Anleitungen GENAU die vier Namen — er hätte eine Erweiterung
// nicht bemerkt und eine Rückkehr zur alten Enge nicht verhindert. Er fragt jetzt nach der einen
// Wahrheit: Die Anleitungen dürfen den Satz nicht abschreiben (eine dritte Abschrift von 39 Namen
// wäre der nächste Pflegeort, der ausläuft), sondern müssen auf ihn ZEIGEN.
it("beide Anleitungen verweisen auf den einen Pflichtsatz statt ihn abzuschreiben", () => {
  const script = read("scripts/backup/restore-drill.sh");
  const pflicht = pflichttabellenAusDrill(script);
  expect(pflicht.length).toBeGreaterThanOrEqual(30);

  // Die alte Liste ist WEG, nicht nebenan: kein Sonderrang der vier Namen, nirgends.
  expect(script, "KERNTABELLEN lebt weiter").not.toContain("KERNTABELLEN");
  expect(script, "die Erfolgsmeldung verspricht weiter nur vier Tabellen").not.toMatch(
    /vier Kerntabellen/i,
  );

  for (const path of ANLEITUNGEN) {
    const doc = read(path);
    expect(doc, `${path} nennt die eine Wahrheit nicht`).toContain("PFLICHTTABELLEN");
    expect(doc).toContain("services/app/src/db.ts");
    expect(doc).toContain("tests/backup-drill/tabellensatz.test.ts");
    expect(doc, `${path} behauptet weiter vier Kerntabellen`).not.toMatch(/vier Kerntabellen/i);
    // Der konkrete Fall, um den es geht, wird benannt — nicht nur die Regel.
    expect(doc).toContain("ko_evidence");
  }
});

// Was ein bestandener Drill jetzt belegt — und was er weiterhin NICHT belegt. Ohne den zweiten Satz
// wäre der erste eine Überzusage, und genau davor warnt der Auftrag (§5.5, §9).
it("beide Anleitungen sagen, was der Nutzennachweis belegt und wo seine Grenze liegt", () => {
  for (const path of ANLEITUNGEN) {
    const doc = read(path);
    // Der Nachweis selbst: Beleg UND Anhangsinhalt, über die laufende Anwendung.
    expect(doc).toContain("/api/kos/<id>/evidence");
    expect(doc).toContain("/api/objects/<id>/raw");
    // Der ehrliche Sonderfall: kein Beleg im Bestand ist NICHT gemessen — weder Erfolg noch Fehler.
    expect(doc, `${path} verschweigt den nicht gemessenen Fall`).toMatch(/NICHT gemessen/);
    // Die Grenzen, ausdrücklich.
    expect(doc).toMatch(/Coolify/);
    expect(doc).toMatch(/Dateiablage au[sß]erhalb der Datenbank/i);
  }
});

// ==================================================================================================
// JOB 4097 · RUNDE 2 — DIE ZWEI KORREKTUREN STEHEN IN BEIDEN ANLEITUNGEN, NICHT NUR IM SKRIPT.
// ==================================================================================================
//
// Beide Fehler der ersten Runde waren für den Betreiber unsichtbar: Der Drill hätte „bestanden"
// gemeldet, obwohl die Anhangszuordnung fehlte (Textsuche statt Vergleich), und er hätte einen
// vorhandenen, aber verwaisten Beleg als „nicht gemessen" ausgegeben. Wer die Ausgabe eines Drills
// liest, muss beides in der Anleitung wiederfinden — sonst ist die Regel nur im Code.
it("beide Anleitungen nennen den strukturierten Belegvergleich und den verwaisten Beleg", () => {
  const script = read("scripts/backup/restore-drill.sh");
  // Die Textsuche ist WEG, nicht nebenan — gemessen an den AUSGEFÜHRTEN Zeilen. Der Kommentar, der
  // den alten Weg zitiert und erklärt, warum er falsch war, bleibt ausdrücklich erlaubt: er ist die
  // Begründung, nicht der Weg.
  const codeZeilen = script
    .split("\n")
    .filter((zeile) => !zeile.trimStart().startsWith("#"))
    .join("\n");
  expect(codeZeilen, "die Belegantwort wird weiter nach Text durchsucht").not.toMatch(/grep -qF/);
  expect(script, "der strukturierte Vergleich fehlt").toContain("FALSCHE_ZUORDNUNG");
  for (const path of ANLEITUNGEN) {
    const doc = read(path);
    expect(doc, `${path} sagt nicht, dass ein Textvorkommen kein Nachweis ist`).toMatch(
      /Textvorkommen/,
    );
    expect(doc, `${path} kennt den Befund der verwaisten Belegzeile nicht`).toMatch(/Belegzeile/);
  }
});

// ==================================================================================================
// JOB 4010 — DIE ABLÖSUNG WIRD GEBUNDEN, NICHT NUR VOLLZOGEN.
// ==================================================================================================
//
// Bis JOB 4010 erklärte sich das Produkt an zwei Stellen selbst für nicht abnahmefähig
// (`restore-drill.sh:11-13`, `docs/operations/restore-drill.md:100-106`). Beide Stellen sind ersetzt.
// Ohne diesen Wächter könnte der Satz unbemerkt zurückkehren — oder die Betriebsanleitung könnte
// das Ergebnis nennen, ohne den Befehl zu nennen, mit dem es entsteht (Auftrag §9).
//
// JOB 4097: `scripts/backup/RESTORE.md` steht jetzt MIT unter diesem Wächter. Bis hierher war sie
// ausdrücklich ausgenommen — sie trug dieselbe, seit JOB 4010 falsche Aussage („Noch kein
// vollständiger Startnachweis … Prozesse können weiterlaufen"), lag aber außerhalb der Zielpfade
// jenes Auftrags. Dieser Auftrag zieht sie nach; damit fällt die Ausnahme weg.
it("Skript und beide Anleitungen tragen keine Abnahmegrenze mehr und nennen ihre Belege", () => {
  for (const path of ["scripts/backup/restore-drill.sh", ...ANLEITUNGEN]) {
    const text = read(path);
    expect(text, `${path} behauptet weiterhin eine offene Abnahmegrenze`).not.toMatch(
      /noch nicht abnahmef[äa]h/i,
    );
    expect(text, `${path} bestreitet weiter den Startnachweis`).not.toMatch(
      /kein vollst[äa]ndiger Startnachweis/i,
    );
    // Der Beleg wird benannt, nicht behauptet.
    expect(text).toContain("prozesszuordnung.test.ts");
    expect(text).toContain("echter-wiederanlauf.integration.test.ts");
  }
  const anleitung = read("docs/operations/restore-drill.md");
  // Nicht nur das Ergebnis, sondern die Bedingung, unter der es entsteht.
  expect(anleitung).toContain("KLARWERK_PG_TEST_URL=");
  expect(anleitung).toContain("npx vitest run --config vitest.integration.config.ts");
  // Der Skip bleibt sichtbar — ein stiller Skip sähe aus wie ein bestandener Lauf.
  expect(anleitung).toContain("sichtbar auf stderr");
});
