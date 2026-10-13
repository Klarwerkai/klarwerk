// ================================================================================================
// AUFNAHME 20260922 · GLEICHZEITIGES BEARBEITEN (R-0109) — DIE KLÄRUNG ZEIGT AUF VORHANDENES.
// ================================================================================================
//
// `docs/entscheidungen/aufnahme-20260922-gesamt-gleichzeitiges-bearbeiten.md` ordnet R-0109 dem
// heutigen Bestand zu und baut selbst nichts. Diese Datei hält fest:
//   · Z   jede Datei, die das Dokument nennt, liegt im Bestand;
//   · F   jede tragende Aussage über den Code steht in der genannten Datei (Konfliktschutz der
//         Erfassungsentwürfe, Abruftakt des gemeinsamen Artikelentwurfs, Takt des
//         Bearbeitungshinweises, gemeinsame Office-Sitzung);
//   · E   „keine Echtzeit im Klarwerk-Editor“: keine Echtzeitbibliothek in den Abhängigkeiten, kein
//         WebSocket- oder Server-Sent-Event-Kanal in Web und Diensten;
//   · S   das Nicht-Ziel v1 steht unverändert in beiden Spezifikationen, mit Verweis auf die Klärung.
//
// WAS DIESE DATEI NICHT BELEGT: das Verhalten der zugeordneten Wege. Das messen die im Dokument
// genannten Tests ihrer eigenen Lieferungen.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOKUMENT = "docs/entscheidungen/aufnahme-20260922-gesamt-gleichzeitiges-bearbeiten.md";

const lies = (pfad: string): string => readFileSync(pfad, "utf8");

const PFADANGABE = /`((?:services|tests|apps|docs)\/[^`\s]+)`/g;

/** Alle Pfadangaben in Backticks, ohne Zeilenzusatz (`datei.ts:38-45` → `datei.ts`). */
function genanntePfade(): string[] {
  const pfade = new Set<string>();
  for (const treffer of lies(DOKUMENT).matchAll(PFADANGABE)) {
    pfade.add((treffer[1] ?? "").replace(/:[\d-]+$/, ""));
  }
  return [...pfade].sort();
}

// Datei → was das Dokument dort verortet. Wörtliche Zeichenfolgen, keine Zeilennummern.
const FUNDSTELLEN: ReadonlyArray<readonly [string, readonly string[]]> = [
  [
    "services/capture/src/service.ts",
    [
      "private pruefeStand(draft: Draft, expectedUpdatedAt: string | undefined): void",
      "throw new DraftStaleError(draft.updatedAt);",
      "await this.repo.updateWennStand(updated, draft.updatedAt)",
      "OHNE `expectedUpdatedAt` (Mobil, Offline-Warteschlange",
    ],
  ],
  ["apps/web/src/pages/GemeinsamerEntwurf.tsx", ["const ABRUF_MS = 5_000;", "basisRevision"]],
  ["services/app/src/gemeinsamer-entwurf.ts", ["ABSCHNITTSWEISE", "`basisRevision`"]],
  [
    "services/app/src/bearbeitungshinweis.ts",
    [
      "export const BEARBEITUNG_ABLAUF_SEKUNDEN = 120;",
      "export const BEARBEITUNG_ERNEUERN_SEKUNDEN = 30;",
      "ein HINWEIS, keine Sperre",
    ],
  ],
  [
    "docs/entscheidungen/office-im-artikel-integrationsweg.md",
    ["Gearbeitet wird gemeinsam in Echtzeit", "## 9 · Umsetzung im Artikel"],
  ],
  ["tests/office-artikel-editor/office-routes.test.ts", ["O4  Zwei Nutzer in einer Sitzung"]],
  [
    "tests/entwurf-datenerhalt/README.md",
    ["R-0074 überholter Entwurf als eigener Fehlerfall", "c393f26d", "1.0.0-beta.1.539"],
  ],
];

// Was eine Echtzeitbearbeitung im Klarwerk-Editor brauchen würde (Alternative D des Dokuments).
const ECHTZEIT_PAKETE = [
  "ws",
  "socket.io",
  "socket.io-client",
  "yjs",
  "y-websocket",
  "y-prosemirror",
  "automerge",
  "@automerge/automerge",
  "@fastify/websocket",
  "sharedb",
  "@hocuspocus/server",
  "@hocuspocus/provider",
  "@tiptap/extension-collaboration",
];
const ECHTZEIT_KANAL = /new WebSocket\(|new EventSource\(|text\/event-stream/;

// Spezifikation → das Nicht-Ziel v1, wörtlich wie vor dieser Klärung.
const NICHT_ZIEL: ReadonlyArray<readonly [string, string]> = [
  [
    "specs/stories/capture.md",
    "Echtzeit-Kollaboration am selben Entwurf (gleichzeitiges Editieren).",
  ],
  ["specs/stories/structure.md", "Versionsdiff im Editor, kollaboratives Live-Editing."],
];
const VERWEIS = `Einordnung von R-0109 offen; Stand und Alternativen: \`${DOKUMENT}\`.`;

function quelldateien(wurzel: string): string[] {
  const gefunden: string[] = [];
  for (const name of readdirSync(wurzel)) {
    if (name === "node_modules" || name === "dist") {
      continue;
    }
    const pfad = join(wurzel, name);
    if (statSync(pfad).isDirectory()) {
      gefunden.push(...quelldateien(pfad));
    } else if (/\.(ts|tsx)$/.test(name)) {
      gefunden.push(pfad);
    }
  }
  return gefunden;
}

describe("R-0109 · die Klärung zeigt auf vorhandenen Bestand", () => {
  it("Z: jede genannte Datei liegt im Bestand", () => {
    const pfade = genanntePfade();
    expect(pfade.length).toBeGreaterThan(5);
    expect(pfade.filter((pfad) => !existsSync(pfad))).toEqual([]);
  });

  it.each(FUNDSTELLEN)("F: %s trägt, was das Dokument dort verortet", (pfad, stellen) => {
    const text = lies(pfad);
    expect(stellen.filter((stelle) => !text.includes(stelle))).toEqual([]);
  });

  it("F: das Dokument nennt die Werte, die der Code trägt", () => {
    const dokument = lies(DOKUMENT);
    expect(dokument).toContain("alle 5 s");
    expect(dokument).toContain("Erneuerung 30 s, Ablauf 120 s");
  });

  it("E: keine Echtzeitbibliothek in den Abhängigkeiten", () => {
    for (const datei of ["package.json", "apps/web/package.json"]) {
      const paket = JSON.parse(lies(datei)) as Record<string, Record<string, string> | undefined>;
      const namen = Object.keys({ ...paket.dependencies, ...paket.devDependencies });
      expect(
        namen.filter((name) => ECHTZEIT_PAKETE.includes(name)),
        datei,
      ).toEqual([]);
    }
  });

  it("E: kein WebSocket- oder Server-Sent-Event-Kanal in Web und Diensten", () => {
    const dateien = [...quelldateien("apps/web/src"), ...quelldateien("services")];
    expect(dateien.length).toBeGreaterThan(100);
    expect(dateien.filter((pfad) => ECHTZEIT_KANAL.test(lies(pfad)))).toEqual([]);
  });

  it.each(NICHT_ZIEL)("S: %s führt das Nicht-Ziel v1 mit Verweis", (pfad, satz) => {
    const text = lies(pfad);
    expect(text).toContain(`${satz}\n${VERWEIS}\n`);
  });
});
