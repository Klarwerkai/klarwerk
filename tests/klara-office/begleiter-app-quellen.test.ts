// ================================================================================================
// KLARA-OFFICE-02 · DIE NATIVE BEGLEITAPP — QUELLENPRÜFUNG, KEIN HOSTBELEG.
// ================================================================================================
//
// Diese Fälle LESEN die Swift-Quellen, die Bündelvorlage und die Skripte. Sie starten keine App und
// bedienen kein Fenster — ob die Figur über Word, im Vollbild und auf zwei Bildschirmen tatsächlich
// erreichbar ist, zeigt allein die lokale Bedienabnahme (docs/operations/klara-office/
// begleitapp-mac.md, Abschnitt 5). Was sie festhalten, sind die Zusagen, die im Quelltext
// entschieden werden und still verloren gehen könnten:
//
//   Q1  KO-02-01/-07 · Apple Silicon, eigener App-Pfad, Fassung im Bündel, KEIN Autostart, kein sudo.
//   Q2  KO-02-04 · Schwebend, nicht aktivierend, auf allen Spaces und neben Vollbild-Apps;
//       Bildschirmwechsel wird eingepasst; Wiederfinden per Tastenkürzel.
//   Q3  KO-02-06 · Keine Bildschirmüberwachung: keine Bildschirmaufnahme-, Fensterlisten- oder
//       Bedienungshilfen-Schnittstelle; Mikrofon nur für die eigene Webfläche, mit Begründungstext.
//   Q4  Nur die eigene Webfläche im Hauptrahmen darf das Fenster steuern.
//   Q5  MACOS-20261014 · MAC-02/MAC-04: Gespräch als Mac-Fenster (Titelleiste, Schließen, Minimieren =
//       Einklappen, Größe), Schließen ohne unsichtbaren Rest, Hauptmenü Bearbeiten/Fenster.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoPfad } from "../support/repoPfad";

const APP = "apps/desktop/klara-begleiter";
const lies = (relativ: string): string => readFileSync(repoPfad(relativ), "utf8");
/** Ein Skript ohne seine Kommentarzeilen — geprüft wird, was es TUT, nicht was es erklärt. */
const befehle = (relativ: string): string =>
  lies(relativ)
    .split("\n")
    .filter((z) => !z.trimStart().startsWith("#"))
    .join("\n");
const AUTOSTART_ODER_ROOT = /\bsudo\b|launchctl|SMAppService|LoginItems|login item/i;
const swift = (): string =>
  readdirSync(repoPfad(`${APP}/Sources`))
    .filter((n) => n.endsWith(".swift"))
    .map((n) => lies(join(APP, "Sources", n)))
    .join("\n");
/**
 * BPA-01 nacharbeit-19 · O06 (QUELLEN-HOSTZUORDNUNG-O06-20261011T211410Z, Führung): die
 * BPA-04-Funktionen aus 345b4467 — Finder-Aufnahme und „Markierung in Word lesen" über die
 * Bedienungshilfe — gehören ausdrücklich in DENSELBEN Begleiter („Finder-/Word-Lesewege … in
 * demselben gewählten Begleiter erhalten/integrieren"). Das berührt KO-02-06 unten: die Figur und
 * ihr Office-Kontext bleiben ohne Bedienungshilfe; die Bedienungshilfe steht AUSSCHLIESSLICH in der
 * BPA-04-Datei und wird dort eigens begrenzt (Q3b). Diese Abgrenzung ist zur Bestätigung durch die
 * Führung offen benannt (docs/operations/klara/browser-kontextkarten.md).
 */
const BPA04_DATEIEN = new Set([
  "Bedienungshilfe.swift",
  "FinderAufnahme.swift",
  "Programme.swift",
  "Server.swift",
]);
const hostSwift = (): string =>
  readdirSync(repoPfad(`${APP}/Sources`))
    .filter((n) => n.endsWith(".swift") && !BPA04_DATEIEN.has(n))
    .map((n) => lies(join(APP, "Sources", n)))
    .join("\n");

describe("Q1 · KO-02-01/-07 — Bündel, Pfad, Fassung, kein Autostart", () => {
  it("die Vorlage ist eine Menüleisten-App für Apple Silicon mit gesetzter Fassung", () => {
    const plist = lies(`${APP}/Info.plist.vorlage`);
    expect(plist).toContain(
      "<key>CFBundleIdentifier</key><string>ai.klarwerk.klara-begleiter</string>",
    );
    expect(plist).toContain("<key>CFBundleShortVersionString</key><string>__FASSUNG__</string>");
    expect(plist).toContain("<key>CFBundleVersion</key><string>__BAU__</string>");
    expect(plist).toContain("<key>LSUIElement</key><true/>");
    expect(plist).toContain("<string>arm64</string>");
    expect(lies(`${APP}/VERSION`).trim()).toMatch(/^\d+\.\d+\.\d+$/);
    for (const autostart of ["SMLoginItem", "RunAtLoad", "LaunchAgent", "KeepAlive"]) {
      expect(plist, autostart).not.toContain(autostart);
    }
  });

  it("gebaut wird für arm64; installiert nur nach ~/Applications, ohne sudo und Autostart", () => {
    const bauen = befehle("scripts/klara-office/begleiter-bauen.sh");
    expect(bauen).toContain("-target arm64-apple-macos13.0");
    expect(bauen).toContain("codesign --force --deep --sign -");
    const installieren = befehle("scripts/klara-office/begleiter-installieren.sh");
    expect(installieren).toContain('ZIEL="$ZIELORDNER/Klara Begleiter.app"');
    expect(installieren).toContain('ZIELORDNER="$HOME/Applications"');
    const entfernen = befehle("scripts/klara-office/begleiter-entfernen.sh");
    for (const [name, text] of [
      ["bauen", bauen],
      ["installieren", installieren],
      ["entfernen", entfernen],
    ] as const) {
      expect(text, name).not.toMatch(AUTOSTART_ODER_ROOT);
    }
    // Ben N2: Metadaten werden nicht übernommen und am EIGENEN Zielbündel entfernt; die strenge
    // Signaturprüfung steht VOR dem Start (unter `set -e` bricht sie dort ab).
    expect(installieren).toContain('ditto --noextattr --noqtn "$QUELLE" "$STUFE"');
    expect(installieren).toContain('/usr/bin/xattr -cr "$STUFE"');
    const streng = installieren.indexOf('codesign --verify --strict --deep --verbose=2 "$ZIEL"');
    expect(streng).toBeGreaterThan(installieren.indexOf('/usr/bin/xattr -cr "$STUFE"'));
    expect(streng).toBeLessThan(installieren.indexOf('open "$ZIEL"'));
    expect(installieren).toContain("set -euo pipefail");
    expect(installieren).not.toMatch(/xattr -cr "\$HOME|xattr -cr "\$ZIELORDNER"/);
    // Beenden geht NUR an diese App (über ihre Kennung), nicht an Word oder andere Fenster.
    expect(installieren).toContain("app.bundleURL?.standardizedFileURL == ziel");
    expect(installieren).toContain("app.terminate()");
    expect(installieren).not.toMatch(/killall|pkill/);
    expect(entfernen).not.toMatch(/killall|pkill/);
  });

  it("die App legt selbst nichts für einen Autostart an", () => {
    const quelle = swift();
    const wege = ["SMAppService", "LaunchAgents", "SMLoginItemSetEnabled", "LSSharedFileList"];
    for (const weg of wege) {
      expect(quelle, weg).not.toContain(weg);
    }
  });
});

describe("Q2 · KO-02-04 — erreichbar über Fenstern, Spaces, Vollbild und Bildschirmen", () => {
  it("schwebendes, nicht aktivierendes Panel auf allen Spaces und neben Vollbild-Apps", () => {
    const quelle = swift();
    expect(quelle).toContain("[.borderless, .nonactivatingPanel]");
    expect(quelle).toContain(
      "collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .ignoresCycle]",
    );
    expect(quelle).toContain("level = .floating");
    expect(quelle).toContain("hidesOnDeactivate = false");
  });

  it("Bildschirmwechsel, Ziehen und Tastaturschritte enden eingepasst; Wiederfinden ohne reservierte globale Kürzel", () => {
    const quelle = swift();
    expect(quelle).toContain("NSApplication.didChangeScreenParametersNotification");
    expect(quelle).toContain("Lage.eingepasst(panel.frame, in: flaechen())");
    expect(quelle).toContain("Lage.verschoben(panel.frame");
    expect(quelle).toContain("NSScreen.screens.map(\\.visibleFrame)");
    expect(quelle).not.toContain("RegisterEventHotKey(");
    expect(quelle).toContain("Systemweiter Aufruf: nicht eingerichtet");
  });
});

describe("Q3 · KO-02-06 — keine Bildschirmüberwachung als Ersatz für den Office-Kontext", () => {
  it("keine Schnittstelle für Bildschirmaufnahme, Fensterlisten oder Bedienungshilfen", () => {
    // Die ganze App: keine Bildschirmaufnahme, keine Fensterlisten, kein Vordergrundprogramm.
    const quelle = swift();
    for (const api of [
      "CGWindowListCreateImage",
      "CGWindowListCopyWindowInfo",
      "ScreenCaptureKit",
      "SCStream",
      "CGDisplayStream",
      "NSWorkspace.shared.frontmostApplication",
    ]) {
      expect(quelle, api).not.toContain(api);
    }
    // Host (Figur, Fenster, Webfläche, Browserkarte): auch keine Bedienungshilfe.
    const host = hostSwift();
    for (const api of ["AXUIElement", "AXIsProcessTrusted"]) {
      expect(host, api).not.toContain(api);
    }
    const plist = lies(`${APP}/Info.plist.vorlage`);
    expect(plist).not.toMatch(/NSScreenCapture|NSAppleEventsUsageDescription|Accessibility/);
  });

  it("Q3b · O06: Bedienungshilfe nur im BPA-04-Weg, nur lesend, nur Word, auf Klick", () => {
    const dateien = readdirSync(repoPfad(`${APP}/Sources`)).filter((n) => n.endsWith(".swift"));
    const quelleVon = (n: string): string => lies(join(APP, "Sources", n));
    const mitAx = dateien.filter((n) => /AXUIElement|AXIsProcessTrusted/.test(quelleVon(n)));
    expect(mitAx).toEqual(["Bedienungshilfe.swift"]);
    const ax = quelleVon("Bedienungshilfe.swift");
    // Nur lesen: keine Aktion, kein Setzen, keine erzeugten Eingaben.
    for (const schreibend of [
      "AXUIElementPerformAction",
      "AXUIElementSetAttributeValue",
      "CGEvent",
      "AXUIElementPostKeyboardEvent",
    ]) {
      expect(ax, schreibend).not.toContain(schreibend);
    }
    // Nur das eingetragene Programm (Word für Mac); andere werden gar nicht gelesen.
    expect(ax).toContain('static let freigegebeneLesehosts: Set<String> = ["com.microsoft.Word"]');
    expect(ax).toContain("guard istFreigegebenerLesehost(programm) else { return nil }");
    // Die Systemfreigabe wird nur auf ausdrücklichen Klick angefragt.
    const alles = dateien.map(quelleVon).join("\n");
    expect(alles.split("Bedienungshilfe.freigabeAnfragen()")).toHaveLength(2);
    expect(quelleVon("Programme.swift")).toContain(
      'Button("Bedienungshilfe-Freigabe anfragen") { Bedienungshilfe.freigabeAnfragen() }',
    );
  });

  it("Mikrofon nur für die eigene Webfläche — mit Begründung, Texteingabe bleibt", () => {
    const quelle = swift();
    expect(quelle).toContain("vomServer(origin) && type == .microphone ? .prompt : .deny");
    const plist = lies(`${APP}/Info.plist.vorlage`);
    const begruendet = ["NSMicrophoneUsageDescription", "NSSpeechRecognitionUsageDescription"];
    for (const schluessel of begruendet) {
      const begruendung = new RegExp(`<key>${schluessel}</key><string>[^<]*Texteingabe`);
      expect(plist, schluessel).toMatch(begruendung);
    }
  });
});

describe("Q4 · nur die eigene Webfläche steuert das Fenster", () => {
  it("Nachrichten nur aus dem Hauptrahmen der eigenen Herkunft; nur bekannte Befehle hinein", () => {
    const quelle = swift();
    expect(quelle).toContain(
      "guard message.frameInfo.isMainFrame, vomServer(message.frameInfo.securityOrigin)",
    );
    expect(quelle).toContain("guard Self.befehle.contains(name) else { return }");
    // Fremde Seiten und neue Fenster öffnen im Browser, nicht in der App.
    expect(quelle).toContain("if navigationAction.targetFrame == nil {");
  });
});

// MACOS-20261014 (produkt:20261011:assistenz-minimalistische-oberflaeche r2) · MAC-02/MAC-04 —
// QUELLENPRÜFUNG, KEIN HOSTBELEG: ob Knöpfe, Größenänderung und Kürzel am echten Mac wirken, zeigt
// erst die lokale Bedienabnahme (UI-04/UI-05/UI-08).
describe("Q5 · MAC-02/MAC-04 — das Gespräch ist ein Mac-Fenster mit Systembedienung und Menü", () => {
  it("Gespräch: Titelleiste, Schließen, Minimieren, Größenänderung; die Figur bleibt randlos", () => {
    const fenster = lies(`${APP}/Sources/Fenster.swift`);
    expect(fenster).toContain(
      ".titled, .closable, .miniaturizable, .resizable, .nonactivatingPanel",
    );
    expect(fenster).toContain(
      "static let figurMaske: NSWindow.StyleMask = [.borderless, .nonactivatingPanel]",
    );
    expect(fenster).toContain("CGSize(width: 320, height: 420)");
    // Der gelbe Knopf klappt zur Figur ein — kein funktionsloser Knopf.
    expect(fenster).toMatch(
      /override func performMiniaturize\(_ sender: Any\?\) \{\s*beiEinklappen\?\(\)/,
    );
    const steuerung = lies(`${APP}/Sources/Steuerung.swift`);
    expect(steuerung).toContain('panel.alsGespraech(neu == "gespraech")');
    expect(steuerung).toContain("panel.beiEinklappen = { [weak self] in self?.einklappen() }");
  });

  it("Schließen blendet aus statt ein unsichtbares Fenster liegen zu lassen; Größe bleibt gemerkt", () => {
    const steuerung = lies(`${APP}/Sources/Steuerung.swift`);
    expect(steuerung).toMatch(
      /func windowShouldClose\(_ sender: NSWindow\) -> Bool \{[^}]*schliessen\(\)\s*return false/,
    );
    // Ausgeblendet wird mit `orderOut` — kein durchsichtiges Fenster bleibt liegen.
    expect(steuerung).toMatch(/private func ausblenden\(\) \{[^}]*panel\.orderOut\(nil\)/);
    expect(steuerung).toContain('d.set(Double(panel.frame.width), forKey: "gespraech.breite")');
    expect(steuerung).toContain("default: return gemerkteGespraechGroesse() ?? gespraechGroesse");
    // Wieder öffnen nur bewusst: Menüleiste und bewusster App-Aufruf bleiben.
    expect(steuerung).toContain('eintrag("Gespräch öffnen", #selector(gespraechOeffnen))');
  });

  it("Hauptmenü mit Bearbeiten (Widerrufen, Kopieren, Einsetzen) und Fenster (⌘M, ⌘W)", () => {
    const steuerung = lies(`${APP}/Sources/Steuerung.swift`);
    expect(steuerung).toContain("NSApp.mainMenu = haupt");
    expect(steuerung).toContain('action: Selector(("undo:")), keyEquivalent: "z"');
    expect(steuerung).toContain('action: Selector(("redo:")), keyEquivalent: "z"');
    for (const befehl of ["cut", "copy", "paste", "selectAll"]) {
      expect(steuerung, befehl).toContain(`#selector(NSText.${befehl}(_:))`);
    }
    expect(steuerung).toContain('eintrag("Einklappen", #selector(einklappenAusMenue), taste: "m")');
    expect(steuerung).toContain('eintrag("Schließen", #selector(schliessenAusMenue), taste: "w")');
  });
});

// Nacharbeit 46 (Ben) · QUELLENPRÜFUNG, KEIN HOSTBELEG.
//   Q6  UI-MIN-06/14: Schließen versteckt keinen laufenden Vorgang.
//   Q7  UI-MIN-15: Titelleiste mit persönlichem Namen bzw. „Deine Assistenz“, nie fest „Klara“.
//   Q8  MAC-01/02: übernommene Korrekturen aus BUG-KLARA-WINDOW-02 (Original 90314201).
describe("Q6 · UI-MIN-06/14 — Schließen lässt laufende Vorgänge mit Stopp sichtbar", () => {
  it("jeder Weg zum Ausblenden geht über `schliessen()`; mit Vorgang bleibt die Figur stehen", () => {
    const steuerung = lies(`${APP}/Sources/Steuerung.swift`);
    // Kein Aufruf von aussen (Menü, Rechtsklick, Webfläche, Systemknopf) blendet direkt aus.
    expect(steuerung).toContain("private func ausblenden()");
    expect(steuerung).not.toMatch(/#selector\(ausblenden\)/);
    expect(steuerung).toMatch(/case "ausblenden":[^\n]*\n[^\n]*\n\s*schliessen\(\)/);
    expect(steuerung).toMatch(/func sichtbarUmschalten\(\) \{\s*if sichtbar \{ schliessen\(\) \}/);
    expect(steuerung).toContain("panel.beiSchliessen = { [weak self] in self?.schliessen() }");
    // Bewusstes Wiederöffnen hebt ein wartendes Schließen auf.
    expect(steuerung).toMatch(
      /if neu == "gespraech" \{\s*nutzerEingeklappt = false[\s\S]*?schliessvorgang\.aufheben\(\)/,
    );
  });

  // Nacharbeit 47 (Ben): weder ein lokal gesetzter Modus noch eine Frist bestätigt einen Stopp.
  it("ausgeblendet wird nur ohne Webfläche oder nach BESTÄTIGTER 0 auf genau diese Anfrage", () => {
    const steuerung = lies(`${APP}/Sources/Steuerung.swift`);
    // Keine Frist und keine Modusabfrage als Ersatz für die Bestätigung.
    expect(steuerung).not.toContain("schliessenFrist");
    expect(steuerung).not.toContain("schliessenFortsetzen");
    expect(steuerung).not.toMatch(/withTimeInterval: 1\.5/);
    // Genau zwei Stellen blenden aus: ohne geladene Webfläche und nach bestätigter Meldung.
    const aufrufe = steuerung.match(/^\s*ausblenden\(\)$/gm) ?? [];
    expect(aufrufe).toHaveLength(2);
    expect(steuerung).toMatch(
      /switch schliessvorgang\.anfordern\(webflaecheBereit: verbunden && offline == nil\) \{\s*case \.ausblenden:[^}]*?ausblenden\(\)\s*case \.nachfragen\(let nummer\):[\s\S]*?befehl\("vorgaenge-melden", wert: nummer\)/,
    );
    expect(steuerung).toMatch(
      /if schliessvorgang\.meldung\(anzahl: anzahl, antwortAuf: antwortAuf\) \{\s*ausblenden\(\)/,
    );
    // Eine unlesbare Anzahl gilt als laufend; nach Neuladen wird die offene Anfrage neu gestellt.
    expect(steuerung).toContain('let anzahl = (n["anzahl"] as? NSNumber)?.intValue ?? 1');
    expect(steuerung).toMatch(
      /if schliessvorgang\.wartet \{[^}]*befehl\("vorgaenge-melden", wert: schliessvorgang\.anfrage\)/,
    );
    expect(steuerung).toContain('"vorgaenge-melden",');
  });

  // Nacharbeit 49 (Ben): auch das Einklappen vor der Bestätigung darf die Stopps nicht abschneiden.
  it("Einklappen verkleinert erst auf die Meldung der Webfläche; ohne Antwort bleibt die Fläche", () => {
    const steuerung = lies(`${APP}/Sources/Steuerung.swift`);
    const einklappen = /@objc func einklappen\(\) \{([\s\S]*?)\n {4}\}/.exec(steuerung)?.[1] ?? "";
    expect(einklappen).not.toBe("");
    // Mit geladener Webfläche: nur der Befehl an die Webfläche, keine lokale Grössenänderung.
    expect(einklappen).toMatch(
      /guard verbunden, offline == nil else \{\s*setzeModus\("figur", durchPerson: true\)\s*befehl\("gespraech-schliessen"\)\s*return\s*\}\s*befehl\("gespraech-schliessen"\)\s*$/,
    );
    expect(einklappen.match(/setzeModus\(/g) ?? []).toHaveLength(1);
    expect(einklappen).toContain("nutzerEingeklappt = true");
    // Die Grösse folgt der gemeldeten Lage der Webfläche (figur bzw. figur-vorgang mit Stopps).
    expect(steuerung).toContain(
      'setzeModus(n["modus"] as? String ?? "", durchPerson: panel.kuerzlichBedient)',
    );
    expect(steuerung).toContain('case "figur-vorgang": return figurVorgangGroesse');
    // Schließen klappt über denselben Weg ein — ohne eigene lokale Verkleinerung.
    expect(steuerung).toMatch(
      /case \.nachfragen\(let nummer\):\s*if modus == "gespraech" \{\s*einklappen\(\)\s*\}/,
    );
  });

  it("die Entscheidung: neue Anfrage je Schließen, veraltete Antworten und frühere Meldungen zählen nicht", () => {
    const s = lies(`${APP}/Sources/Schliessen.swift`);
    // Ohne Webfläche sofort; sonst jede Anforderung eine NEUE Nummer und unbestätigt.
    expect(s).toMatch(
      /mutating func anfordern\(webflaecheBereit: Bool\) -> Schritt \{\s*guard webflaecheBereit else \{\s*aufheben\(\)\s*return \.ausblenden\s*\}\s*wartet = true\s*bestaetigt = false\s*anfrage \+= 1\s*return \.nachfragen\(anfrage\)/,
    );
    // Nur die Antwort auf die jüngste Anfrage bestätigt; Meldungen davor zählen nicht.
    expect(s).toMatch(/guard nummer == anfrage else \{ return false \}\s*bestaetigt = true/);
    expect(s).toMatch(/\} else if !bestaetigt \{\s*[^\n]*\n\s*return false\s*\}/);
    // Ausblenden nur bei 0.
    expect(s).toMatch(/guard anzahl == 0 else \{ return false \}\s*aufheben\(\)\s*return true/);
    expect(s).not.toMatch(/Timer|modus/);
  });
});

// Nacharbeit 54 (Ben, MAC5-04) · QUELLENPRÜFUNG, KEIN HOSTBELEG.
describe("Q9 · MAC-04/UI-05 — „Einstellungen …“ (⌘,) führt in den vorhandenen Klara-Bereich", () => {
  it("App- und Statusmenü tragen den Befehl; ⌘, wirkt auch am Fenster; die Webfläche öffnet ihn", () => {
    const steuerung = lies(`${APP}/Sources/Steuerung.swift`);
    expect(steuerung).toContain(
      'app.addItem(eintrag("Einstellungen …", #selector(einstellungenOeffnen), taste: ","))',
    );
    expect(steuerung).toContain(
      'menu.addItem(eintrag("Einstellungen …", #selector(einstellungenOeffnen), taste: ","))',
    );
    expect(steuerung).toMatch(
      /@objc func einstellungenOeffnen\(\) \{\s*gespraechOeffnen\(\)\s*befehl\("einstellungen-oeffnen"\)/,
    );
    // Nacharbeit 56 (MAC5-04-REST): zusätzlich der ZENTRALE Klara-Bereich (Profil › Klara) im
    // Browser — über den vorhandenen Direktweg, nur auf dem eingestellten Server.
    expect(steuerung).toMatch(
      /if let ziel = zentraleKlaraEinstellungen\(\) \{\s*NSWorkspace\.shared\.open\(ziel\)/,
    );
    expect(steuerung).toContain('teile?.path = "/profil"');
    expect(steuerung).toContain('URLQueryItem(name: "bereich", value: "klara")');
    expect(steuerung).toContain("guard let url = teile?.url, Einstellungen.erlaubt(url)");
    expect(steuerung).toContain('"vorgaenge-melden", "einstellungen-oeffnen",');
    expect(steuerung).toContain(
      "panel.beiEinstellungen = { [weak self] in self?.einstellungenOeffnen() }",
    );
    const fenster = lies(`${APP}/Sources/Fenster.swift`);
    expect(fenster).toMatch(/if zeichen == "," \{\s*beiEinstellungen\?\(\)\s*return true/);
    const bruecke = lies("apps/web/src/lib/begleiterBruecke.ts");
    expect(bruecke).toContain('"einstellungen-oeffnen",');
    const seite = lies("apps/web/src/pages/Begleiter.tsx");
    expect(seite).toMatch(
      /befehl === "einstellungen-oeffnen"\) \{[\s\S]*?setOffen\(true\);[\s\S]*?setMenueSeite\("einstellungen"\)/,
    );
  });
});

describe("Q7 · UI-MIN-15 — der persönliche Name in der Titelleiste", () => {
  it("Titel aus dem Profil über die Brücke; neutraler Rückfall; kein fester Titel „Klara“", () => {
    const fenster = lies(`${APP}/Sources/Fenster.swift`);
    expect(fenster).not.toContain('title = "Klara"');
    expect(fenster).toContain('static let neutralerName = "Deine Assistenz"');
    expect(fenster).toContain("title = anzeigeName");
    const steuerung = lies(`${APP}/Sources/Steuerung.swift`);
    expect(steuerung).toMatch(/case "name":[\s\S]*?panel\.setzeName\(n\["name"\] as\? String\)/);
    const bruecke = lies("apps/web/src/lib/begleiterBruecke.ts");
    expect(bruecke).toContain('{ art: "name"; name: string }');
  });
});

describe("Q8 · MAC-01/02 — übernommene Fensterkorrekturen aus Original 90314201", () => {
  it("Monitorwechsel begrenzt Grösse UND Lage; Wiederfinden auf dem Bildschirm des Zeigers", () => {
    const lage = lies(`${APP}/Sources/Lage.swift`);
    expect(lage).toContain(
      "static func vollstaendigSichtbar(_ rahmen: CGRect, in sichtbar: [CGRect]) -> CGRect",
    );
    expect(lage).toContain(
      "static func bildschirm(am punkt: CGPoint, in sichtbar: [CGRect]) -> CGRect?",
    );
    expect(lage).toMatch(
      /guard let ziel = bildschirm\(am: zeiger, in: sichtbar\)[\s\S]*?aufFlaeche\(r, ziel\)/,
    );
    const steuerung = lies(`${APP}/Sources/Steuerung.swift`);
    expect(steuerung).toMatch(
      /@objc private func bildschirmeGeaendert\(\) \{\s*setzeRahmen\(Lage\.vollstaendigSichtbar\(panel\.frame, in: flaechen\(\)\)\)/,
    );
    expect(steuerung).toContain("return Lage.vollstaendigSichtbar(r, in: flaechen())");
  });

  it("Wiederöffnen über den App-Start; geschlossen und eingeklappt bleiben bewusste Entscheidungen", () => {
    const steuerung = lies(`${APP}/Sources/Steuerung.swift`);
    expect(steuerung).toMatch(
      /func applicationShouldHandleReopen\([^)]*\) -> Bool \{[\s\S]*?gespraechOeffnen\(\)\s*return false/,
    );
    expect(steuerung).toContain('!UserDefaults.standard.bool(forKey: "klara.geschlossen")');
    expect(steuerung).toMatch(/if sichtbar \{\s*panel\.orderFrontRegardless\(\)\s*\}/);
    expect(steuerung).toMatch(
      /if neu == "gespraech" && nutzerEingeklappt && !durchPerson \{\s*[^\n]*\n\s*befehl\("gespraech-schliessen"\)\s*return/,
    );
    expect(steuerung).toContain(
      'setzeModus(n["modus"] as? String ?? "", durchPerson: panel.kuerzlichBedient)',
    );
  });

  it("Rechtsklick und ⌘W/⌘M wirken in jeder Lage; der Kürzelstatus ist ehrlich", () => {
    const fenster = lies(`${APP}/Sources/Fenster.swift`);
    expect(fenster).toContain("override func willOpenMenu(_ menu: NSMenu, with event: NSEvent)");
    expect(fenster).toContain("override func performKeyEquivalent(with event: NSEvent) -> Bool");
    const steuerung = lies(`${APP}/Sources/Steuerung.swift`);
    expect(steuerung).toContain(
      "webView.fensterEintraege = { [weak self] in self?.fensterEintraege() ?? [] }",
    );
    expect(steuerung).toContain('"Systemweiter Aufruf: nicht eingerichtet"');
    // Aktuelle Produktbasis: vorhandene Browserkarte und deren Sitzungsbindung erhalten.
    expect(swift()).toContain("BrowserKartenQuelle");
    expect(steuerung).toContain("anmeldungGewechselt()");
  });
});
