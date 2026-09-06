// ================================================================================================
// JOB 3133 · UX-22 — DER ANKER MUSS IM RUMPF ANKOMMEN, SONST IST DAS AUSWAHLFELD ZIERDE.
// ================================================================================================
//
// DER GEMESSENE AUSGANGSZUSTAND (Stand 27d281e): der Server kann die verankerte Belegstelle
// vollständig — `decideExternalAttach` (services/external-search/src/attach-policy.ts:197-211)
// erlaubt `reach === "unaddressed"` auf `blocked`/`search_on_click`, sobald der Anker gegen die
// EIGENE Anhangsliste bestätigt ist (services/app/src/routes/ko-routes.ts:1925-1932). Der
// Client-Vertrag kennt das Feld ebenfalls (`AddSourceRequest.objectId`, koSource.ts:79-84).
//
// Unterbrochen ist die Kette an GENAU EINER Stelle: `toSourcePayload` (koSource.ts:106-115) baut
// den Rumpf aus `label`, `url`, `excerpt` — `objectId` kommt darin nicht vor. Das ist die eine
// Stelle, über die das Bibliotheksformular absendet (`MehrAbschnitte.tsx:204`). Deshalb misst
// dieser Fall den RUMPF, nicht die Anwesenheit eines Feldes: ein Auswahlfeld, dessen Wahl nicht
// gesendet wird, wäre die reine Wortlaut-Erfüllung.
import { describe, expect, it } from "vitest";
import {
  EMPTY_SOURCE_FORM,
  isSourceFormDirty,
  toSourcePayload,
} from "../../apps/web/src/lib/koSource";

describe("JOB 3133 · Lieferung 1+2: der gewählte Anhang steht im abgesendeten Rumpf", () => {
  it("R1 · adresslose Belegstelle mit Anker → { label, objectId }, ohne leere Optionalfelder", () => {
    expect(toSourcePayload({ label: "Seite 4", url: "", excerpt: "", objectId: "obj-1" })).toEqual({
      label: "Seite 4",
      objectId: "obj-1",
    });
  });

  it("R2 · der Anker steht neben Adresse und Auszug, wenn beide getippt sind", () => {
    expect(
      toSourcePayload({
        label: "  Prüfbericht  ",
        url: " https://x.example/a ",
        excerpt: " Kapitel 3 ",
        objectId: " obj-7 ",
      }),
    ).toEqual({
      label: "Prüfbericht",
      url: "https://x.example/a",
      excerpt: "Kapitel 3",
      objectId: "obj-7",
    });
  });

  it("R3 · KALIBRIERUNG: ohne Anker bleibt der Rumpf exakt der alte — kein leeres Feld", () => {
    // Ein `objectId: ""` im Rumpf wäre eine Behauptung ohne Deckung; der Server schlüge sie in
    // seiner Anhangsliste nach und fände nichts. Weglassen ist die ehrliche Form (wie url/excerpt).
    expect(toSourcePayload({ label: "Norm", url: "", excerpt: "" })).toEqual({ label: "Norm" });
    expect(toSourcePayload({ label: "Norm", url: "", excerpt: "", objectId: "   " })).toEqual({
      label: "Norm",
    });
  });

  it("R4 · Lieferung 3: eine getroffene Auswahl macht das Formular „schmutzig“", () => {
    // Sonst verwürfe der Navigations-/Verwerfen-Weg (Capture.tsx:1918/2420, dasselbe Prädikat)
    // eine Auswahl still, weil kein Zeichen getippt wurde.
    expect(isSourceFormDirty(EMPTY_SOURCE_FORM)).toBe(false);
    expect(isSourceFormDirty({ label: "", url: "", excerpt: "", objectId: "obj-1" })).toBe(true);
    expect(isSourceFormDirty({ label: "", url: "", excerpt: "", objectId: "  " })).toBe(false);
  });
});
