// ================================================================================================
// R-0432 (K3, BEN NACHARBEIT 8) — DIE ÄNDERUNGSÜBERSICHT SAGT „SCHLAGWÖRTER", NICHT „TAGS".
// ================================================================================================
// Gerendert wird die ECHTE Komponente `KoRevisionSummary` mit der ECHTEN deutschen i18n-Instanz
// über den vorhandenen serverseitigen Renderweg (`react-dom/server`), ohne Übersetzungsattrappe.
// Dieselbe Komponente zeigt die Bibliotheksbearbeitung (`BibliothekLesen.tsx`) für eingereichte und
// nicht eingereichte Änderungen.
//
// WARUM EINE EIGENE `.tsx`-DATEI NEBEN `ko-revision-summary.test.ts`: der Root-Typecheck ist
// Node-rein und ohne jsx (tsconfig.json schließt `tests/**/*.tsx` aus); ein Import der `.tsx`-
// Komponente aus der `.ts`-Datei wäre dort nicht typisierbar. Die `.tsx`-Tests laufen durch ihren
// eigenen Typecheck (tsconfig.tests-tsx.json). Die reine Datenlogik bleibt in der `.ts`-Datei.
import { beforeEach, describe, expect, it } from "vitest";

import { createElement } from "../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import { KoRevisionSummary } from "../../apps/web/src/components/KoRevisionSummary";
import i18n from "../../apps/web/src/i18n";
import type { KoRevisionFields } from "../../apps/web/src/lib/koRevisionSummary";

const ORIGINAL: KoRevisionFields = {
  title: "Titel",
  statement: "Aussage",
  bodyHtml: "<p>Inhalt</p>",
  type: "best_practice",
  category: "Montage",
  conditions: ["A"],
  measures: ["M1"],
  tags: ["x", "y"],
};

function zeichne(edit: KoRevisionFields): string {
  return renderToStaticMarkup(createElement(KoRevisionSummary, { original: ORIGINAL, edit }));
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

describe("R-0432 · Änderungsübersicht mit geänderten Schlagwörtern", () => {
  it("S1 · geänderte Schlagwörter: sichtbar „Schlagwörter“, nirgends „Tags“", () => {
    const html = zeichne({ ...ORIGINAL, tags: ["x", "z"] });
    expect(html).toContain("Schlagwörter");
    expect(html).not.toContain("Tags");
    // Es ist die Änderungsliste, nicht der Leersatz.
    expect(html).not.toContain(String(i18n.t("ko.revision.none")));
  });

  it("S2 · GEGENKONTROLLE: dieselbe Schlagwortmenge zeigt keine Schlagwortänderung", () => {
    const html = zeichne({ ...ORIGINAL, tags: ["y", "x"] });
    expect(html).not.toContain("Schlagwörter");
    expect(html).not.toContain("Tags");
    expect(html).toContain(String(i18n.t("ko.revision.none")));
  });
});
