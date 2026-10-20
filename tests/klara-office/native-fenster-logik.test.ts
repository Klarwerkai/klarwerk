import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { repoPfad } from "../support/repoPfad";

// Runs the actual Swift logic. Host interaction and VoiceOver remain separate acceptance steps.
it("keeps a window reachable after monitor loss and waits for the matching close acknowledgement", () => {
  expect(process.platform, "Native geometry requires the supported macOS host").toBe("darwin");
  const dir = mkdtempSync(join(tmpdir(), "klara-fenster-"));
  try {
    writeFileSync(
      join(dir, "main.swift"),
      `
import CoreGraphics
import Foundation
let klein = CGRect(x: 0, y: 24, width: 800, height: 576)
let fremd = CGRect(x: 1900, y: -500, width: 1400, height: 1100)
let passend = Lage.vollstaendigSichtbar(fremd, in: [klein])
precondition(klein.contains(passend), "monitor loss must preserve all window controls")
precondition(passend == Lage.vollstaendigSichtbar(passend, in: [klein]), "fitting is stable")
let links = CGRect(x: -1200, y: 0, width: 1200, height: 800)
let gefunden = Lage.beimZeiger(CGPoint(x: -600, y: 400), groesse: fremd.size, in: [klein, links])
precondition(links.contains(gefunden), "find must use the pointer's screen")
let figur = CGRect(x: 20, y: 50, width: 96, height: 96)
let bewegt = Lage.verschoben(figur, dx: -1000, dy: 1000, in: [klein])
precondition(klein.contains(bewegt), "keyboard movement must retain reachability")
var schliessen = Schliessvorgang()
guard case .nachfragen(let erste) = schliessen.anfordern(webflaecheBereit: true) else { fatalError() }
guard case .nachfragen(let zweite) = schliessen.anfordern(webflaecheBereit: true) else { fatalError() }
precondition(!schliessen.meldung(anzahl: 0, antwortAuf: erste), "old answers cannot hide active controls")
precondition(!schliessen.meldung(anzahl: 0, antwortAuf: nil), "unsolicited idle state is insufficient")
precondition(!schliessen.meldung(anzahl: 2, antwortAuf: zweite), "both active tasks remain stoppable")
precondition(schliessen.meldung(anzahl: 0, antwortAuf: nil), "confirmed completion permits hiding")
precondition(schliessen.anfordern(webflaecheBereit: false) == .ausblenden, "login/offline can close immediately")
let legacy = #"{"objektId":"objekt-1","herkunft":{"quelle":"finder","dateiId":"datei-1","name":"synthetisch.png","groesse":4,"sha256":"abc","aufgenommenAm":"2026-10-20"}}"#
var datei = try JSONDecoder().decode(FinderErgebnis.self, from: Data(legacy.utf8))
let server = URL(string: "https://app.klarwerk.ai")!
precondition(datei.ocrZiel(basis: server) == nil, "old responses remain compatible")
datei.ocrUrl = "/erfassen?weg=datei&finder=objekt-1"
precondition(datei.ocrZiel(basis: server)?.absoluteString == "https://app.klarwerk.ai/erfassen?weg=datei&finder=objekt-1")
for falsch in ["https://fremd.test/erfassen?weg=datei&finder=objekt-1", "//fremd.test/erfassen?weg=datei&finder=objekt-1", "/erfassen?weg=datei&finder=anderes", "/erfassen?weg=datei&finder=objekt-1&token=unzulassig", "/erfassen?weg=datei&finder=objekt-1#fremd", "/erfassen?finder=objekt-1&finder=objekt-1"] {
    datei.ocrUrl = falsch
    precondition(datei.ocrZiel(basis: server) == nil, "unbound OCR entry rejected")
}
print("native geometry, close acknowledgement and bound OCR entry passed")
`,
    );
    const source = "apps/desktop/klara-begleiter/Sources";
    const compiled = spawnSync(
      "swiftc",
      [
        repoPfad(`${source}/Lage.swift`),
        repoPfad(`${source}/Schliessen.swift`),
        repoPfad(`${source}/Server.swift`),
        join(dir, "main.swift"),
        "-o",
        join(dir, "probe"),
      ],
      { encoding: "utf8", timeout: 60_000 },
    );
    expect(compiled.status, compiled.stderr).toBe(0);
    const run = spawnSync(join(dir, "probe"), [], { encoding: "utf8", timeout: 10_000 });
    expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
