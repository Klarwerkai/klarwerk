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
    expect(installieren).toContain('ditto --noextattr --noqtn "$QUELLE" "$ZIEL"');
    expect(installieren).toContain('/usr/bin/xattr -cr "$ZIEL"');
    const streng = installieren.indexOf('codesign --verify --strict --deep --verbose=2 "$ZIEL"');
    expect(streng).toBeGreaterThan(installieren.indexOf('/usr/bin/xattr -cr "$ZIEL"'));
    expect(streng).toBeLessThan(installieren.indexOf('open "$ZIEL"'));
    expect(installieren).toContain("set -euo pipefail");
    expect(installieren).not.toMatch(/xattr -cr "\$HOME|xattr -cr "\$ZIELORDNER"/);
    // Beenden geht NUR an diese App (über ihre Kennung), nicht an Word oder andere Fenster.
    expect(installieren).toContain('tell application id \\"$KENNUNG\\" to quit');
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

  it("Bildschirmwechsel, Ziehen und Tastaturschritte enden eingepasst; Wiederfinden per Kürzel", () => {
    const quelle = swift();
    expect(quelle).toContain("NSApplication.didChangeScreenParametersNotification");
    expect(quelle).toContain("Lage.eingepasst(panel.frame, in: flaechen())");
    expect(quelle).toContain("Lage.verschoben(panel.frame");
    expect(quelle).toContain("NSScreen.screens.map(\\.visibleFrame)");
    expect(quelle).toContain("UInt32(kVK_ANSI_K)");
    expect(quelle).toContain("UInt32(controlKey | optionKey)");
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
