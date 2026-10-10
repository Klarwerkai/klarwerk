// ================================================================================================
// EDITOR-EINHEITLICH (produkt:20261007:editor-einheitlich) · K1 — DERSELBE BEITRAG, DIESELBEN WÖRTER.
// ================================================================================================
//
// BEN-BEFUND (Nacharbeit 6): Beim Erstellen im Expertenformular (`Capture.tsx`) hiess das Titelfeld
// „Kernaussage", beim Bearbeiten (`BibliothekLesen.tsx`) „Titel". Hier wird der VERGLEICH beider
// Wege gezogen: Titel- und Aussagefeld müssen an beiden Stellen mit DEMSELBEN Schlüssel beschriftet
// sein, und der Titel heisst wie im Blatt (`fd.fieldTitle`). Gelesen wird der Quelltext, weil die
// Frage „welcher Schlüssel beschriftet das Feld an `draft.title`/`edit.title`" eine Quellfrage ist;
// gerendert sind beide Felder in `bearbeiten-einheitlich-mounted.test.tsx` (B1) und
// `tests/expertenformular-entwurf/experten-draft-mounted.test.tsx`.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { repoPfad } from "../support/repoPfad";

const ERSTELLEN = readFileSync(repoPfad("apps/web/src/pages/Capture.tsx"), "utf8");
const BEARBEITEN = readFileSync(
  repoPfad("apps/web/src/components/bibliothek/BibliothekLesen.tsx"),
  "utf8",
);

/** Der Schlüssel des `Field`, das das erste Eingabefeld mit `wert` umschliesst. */
function beschriftungVor(quelle: string, wert: string): string {
  const stelle = quelle.indexOf(wert);
  expect(stelle, `${wert} steht nicht im Quelltext`).toBeGreaterThan(-1);
  const davor = quelle.slice(0, stelle);
  const treffer = [...davor.matchAll(/<Field label=\{t\("([^"]+)"\)\}/g)].pop();
  expect(treffer, `vor ${wert} steht kein Field`).toBeDefined();
  return treffer?.[1] ?? "";
}

describe("EDITOR-EINHEITLICH · K1 — Erstellen (Expertenformular) und Bearbeiten im Vergleich", () => {
  it("V1 · das Titelfeld trägt an beiden Stellen denselben Schlüssel — „Titel“ wie im Blatt", async () => {
    await i18n.changeLanguage("de");
    const erstellen = beschriftungVor(ERSTELLEN, "value={draft.title}");
    const bearbeiten = beschriftungVor(BEARBEITEN, "value={edit.title}");
    expect(erstellen).toBe(bearbeiten);
    expect(i18n.t(erstellen)).toBe(i18n.t("fd.fieldTitle"));
    expect(i18n.t(erstellen)).toBe("Titel");
  });

  it("V2 · das Aussagefeld trägt an beiden Stellen denselben Schlüssel", () => {
    expect(beschriftungVor(ERSTELLEN, "value={draft.statement}")).toBe(
      beschriftungVor(BEARBEITEN, "value={edit.statement}"),
    );
  });
});
