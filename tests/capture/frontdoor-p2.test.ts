import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { editorFileButtonVisible } from "../../apps/web/src/lib/editorFiles";

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const frontDoor = read("../../apps/web/src/pages/CaptureFrontDoor.tsx");
const editor = read("../../apps/web/src/components/RichTextEditor.tsx");

// SCRUM-488 (Nullschulung, FrontDoor-P2): kein toter Klick-Pfad + Migrationssprache raus.
describe("SCRUM-488: FrontDoor-P2", () => {
  it("editorFileButtonVisible: nur sichtbar, wenn Upload möglich ODER Dateien einfügbar", () => {
    expect(editorFileButtonVisible(false, 0)).toBe(false); // FrontDoor-Fall: toter Klick vermieden
    expect(editorFileButtonVisible(true, 0)).toBe(true); // Upload verdrahtet
    expect(editorFileButtonVisible(false, 3)).toBe(true); // einfügbare Object-Store-Dateien
  });

  it("RichTextEditor rendert den Datei-Button hinter der Sichtbarkeits-Regel (kein toter Klick)", () => {
    expect(editor).toContain('import { editorFileButtonVisible } from "../lib/editorFiles"');
    expect(editor).toContain("editorFileButtonVisible(onAttachFiles !== undefined, files.length)");
  });

  it("Migrationssprache ist ersetzt — kein „Bisheriges Erfassen“, kein Fallback-Jargon", () => {
    expect(frontDoor).not.toContain("Bisheriges Erfassen");
    expect(frontDoor).not.toContain("Der bisherige Erfassen-Weg bleibt erreichbar");
    // Stattdessen nutzerverständliche Sprache:
    expect(frontDoor).toContain("Alle Erfassungs-Modi");
    expect(frontDoor).toContain("Mehr Erfassungswege");
  });

  it("Status-Aside erklärt den Einreichen-Zustand (HelpTip + Klartext statt „Entwurf / fortsetzen“)", () => {
    expect(frontDoor).toContain("Was beim Speichern passiert");
    expect(frontDoor).toContain('chelp("savedNext")');
    expect(frontDoor).not.toContain(">Entwurf / fortsetzen<");
  });
});
