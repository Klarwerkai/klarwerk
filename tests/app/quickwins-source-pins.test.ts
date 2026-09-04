// AUFTRAG-mega1: Quelltext-/i18n-Belege für die Quick-Wins, deren Verhalten anderswo bereits
// gemountet geprüft ist bzw. die reine Anzeige-/Schema-Fixes sind.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";

const web = (p: string): string => readFileSync(join(__dirname, "../../apps/web/src", p), "utf8");

function inAllLangs(key: string): void {
  for (const lng of ["de", "en", "nl"] as const) {
    const v = String(i18n.getResource(lng, "translation", key));
    expect(v.length).toBeGreaterThan(0);
    expect(v).not.toBe(key);
  }
}

describe("Block D2 (Client): leeres Formular sperrt „Als Entwurf speichern“", () => {
  it("beide Save-Knöpfe sind bei fehlendem Inhalt deaktiviert", () => {
    const src = web("pages/Capture.tsx");
    const matches = src.match(/disabled=\{busy \|\| !canSaveDraft\}/g) ?? [];
    expect(matches.length).toBe(2);
    expect(src).toContain("const canSaveDraft =");
  });
});

describe("Block D4 (Client): Reviewer-Minimum 1", () => {
  it("Admin markiert 0/ungültig (aria-invalid) und sperrt Speichern", () => {
    const src = web("pages/Admin.tsx");
    expect(src).toContain("aria-invalid={!neededValid}");
    expect(src).toContain("|| !neededValid");
    expect(src).toContain("neededParsed >= 1 && neededParsed <= 5");
  });
  it("deutsche Fehlermeldung existiert in allen Sprachen", () => {
    inAllLangs("adm.val.invalid");
  });
});

describe("Block D6 (A11y): zugängliche Namen", () => {
  it("RichTextEditor-Editorhost hat role/aria-multiline/aria-label", () => {
    const src = web("components/RichTextEditor.tsx");
    expect(src).toContain('role="textbox"');
    expect(src).toContain('aria-multiline="true"');
    expect(src).toContain('aria-label={t("editor.bodyLabel")}');
    inAllLangs("editor.bodyLabel");
  });
  it("die Validierungs-Selects tragen aria-label", () => {
    const src = web("pages/Validation.tsx");
    expect(src).toContain('aria-label={t("val.filterAllTypes")}');
    expect(src).toContain('aria-label={t("val.filterAllCategories")}');
    expect(src).toContain('aria-label={t("val.filterAllTags")}');
    expect(src).toContain('aria-label={t("val.assign")}');
    // E2E-012/013: die Prüfkarte darf keinen Sammel-Accessible-Name und keinen verschachtelten
    // Knopf tragen. JOB 3061 · H2: sie ist gar keine `Card` mit Flächen-Klick mehr (`interactive`
    // gibt es hier nicht mehr) — sie ist ein schlichter Container, und bedient wird über Titel-Link,
    // Warteschlangen-Knöpfe und das Fußband. Dieselbe Zusage, ohne die Ausnahme zu brauchen.
    expect(src).toContain('data-testid="pruefen-karte"');
    expect(src).not.toContain('role="button"');
    expect(src).not.toContain("interactive=");
  });
});

describe("Block D9: Kennzahlen-Ladezustand (unbekannt ≠ 0)", () => {
  it("Analytics zeigt „—“ statt echter 0, solange die Quelle lädt", () => {
    const src = web("pages/Analytics.tsx");
    expect(src).toContain('loading ? "—" : value');
    expect((src.match(/loading=\{execLoading\}/g) ?? []).length).toBe(4);
  });
});

describe("Block D10: Import-Grund erklären (nur JSON)", () => {
  // AUFTRAG-mega32 H2: der JSON-Kasten ist aus pages/Stufe2.tsx in ein eigenes Bauteil im Cockpit
  // gezogen (er stand vorher AUSSERHALB des Providers und wurde deshalb immer gerendert). Der Satz
  // ist unverändert — nur seine Datei ist es nicht.
  it("der JSON-Kasten rendert den ehrlichen Import-Grund-Hinweis", () => {
    const src = web("components/ImportJsonUpload.tsx");
    expect(src).toContain('t("imp.jsonOnlyReason")');
    inAllLangs("imp.jsonOnlyReason");
  });
});
