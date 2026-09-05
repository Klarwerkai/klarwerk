import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { editorFileButtonVisible } from "../../apps/web/src/lib/editorFiles";

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const frontDoor = read("../../apps/web/src/components/erfassen/Blatt.tsx");
const editor = read("../../apps/web/src/components/RichTextEditor.tsx");
const i18n = read("../../apps/web/src/i18n.ts");

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
    // ==========================================================================================
    // JOB 3062 · H3 — „ALLE ERFASSUNGS-MODI" UND „MEHR ERFASSUNGSWEGE" SIND EIN MENÜ GEWORDEN.
    // ==========================================================================================
    // Die beiden Überschriften standen für den Kopf-Link und die rechte Karte der Vordertür. Beide
    // Flächen sind gelöscht (Auftrag §5); die WEGE liegen jetzt an EINEM Ort, dem Menü „Datei ▾"
    // der Werkzeugzeile, und werden dort aus `BLATT_WEGE` abgeleitet.
    //
    // Die Zusicherung dieses Falls bleibt dieselbe: keine Migrationssprache, und die Wege sind
    // über lokalisierte Schlüssel benannt statt über hart eingebauten Text.
    expect(frontDoor).toContain("BLATT_WEGE");
    expect(frontDoor).toContain("blattWegLabelKey");
    expect(i18n).toContain("Datei importieren");
    expect(i18n).toContain("Interview führen");
    expect(i18n).toContain("Formular (Experten)");
  });

  it("Status-Aside erklärt den Einreichen-Zustand (HelpTip + Klartext statt „Entwurf / fortsetzen“)", () => {
    // JOB 3062 · H3: Die Status-Karte der rechten Spalte ist eine MENÜFLÄCHE geworden („…" →
    // „Status", Auftrag §5a). Ihr Inhalt ist unverändert — Titel beim Speichern, Autor, was beim
    // Speichern passiert —, und der ausführliche Text des früheren `HelpTip` steht jetzt offen
    // darin statt hinter einem Fragezeichen (`chelp.savedNext.*`, dieselben Schlüssel).
    expect(frontDoor).toContain("fd.whatOnSave");
    expect(i18n).toContain("Was beim Speichern passiert");
    expect(frontDoor).toContain("chelp.savedNext.title");
    expect(frontDoor).toContain("erfassen.mehr.status");
    expect(frontDoor).not.toContain(">Entwurf / fortsetzen<");
  });
});
