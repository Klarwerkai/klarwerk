// @vitest-environment jsdom
// ================================================================================================
// JOB 3420 · UX-10b — FALL 4: WAS NICHT EINGEORDNET IST, WIRD NICHT EINGEORDNET.
// ================================================================================================
//
// Dies ist der Fall, den man beim Bauen wegoptimiert: ein Ergebnis OHNE `fehlerklasse` (älterer
// Server, ein Weg ohne Messung) darf keinen Ratschlag bekommen, der eine Ursache behauptet. Die
// Karte sagt „Grund nicht eingeordnet" und stellt die unveränderte Rohmeldung daneben — dieselbe
// Haltung wie `model-errors.ts:130-132` („unknown" wird nicht als „network" verkleidet").
//
// GEMESSEN WIRD AUCH DAS FEHLEN: kein einziger der acht anderen Ratsätze steht da. Ein Test, der
// nur „der Satz ist da" prüfte, bliebe grün, wenn zusätzlich ein erfundener Rat erschiene.
import { afterEach, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  ANTHROPIC,
  aufraeumen,
  fehlerkasten,
  fetchSpion,
  karteMounten,
  knopfDruecken,
  konfig,
} from "./karte";

const ROHMELDUNG = "Modell-Client meldete: SomethingWeird(17)";

/** Alle Ratschläge des Hauses — hier darf keiner davon stehen. */
const ALLE_RATSCHLAEGE = [
  "adm.ai.rat.zugang",
  "adm.ai.rat.zugangKonto.openai",
  "adm.ai.rat.zugangKonto.anthropic",
  "adm.ai.rat.kontingent",
  "adm.ai.rat.abgelehnt",
  "adm.ai.rat.nichtErreichbar",
  "adm.ai.rat.zeitlimit",
  "adm.ai.rat.unbrauchbar",
  "adm.ai.rat.anfrage",
  "adm.ai.rat.lokal.zugang",
  "adm.ai.rat.lokal.kontingent",
  "adm.ai.rat.lokal.abgelehnt",
  "adm.ai.rat.lokal.nichtErreichbar",
  "adm.ai.rat.lokal.zeitlimit",
  "adm.ai.rat.lokal.unbrauchbar",
] as const;

afterEach(aufraeumen);

describe("JOB 3420 · Fall 4 — ohne Fehlerklasse bleibt die Karte ehrlich unbestimmt", () => {
  it("Grund nicht eingeordnet, plus unveränderte Rohmeldung — und KEIN Ratschlag", async () => {
    fetchSpion({
      config: konfig({ provider: ANTHROPIC }),
      test: {
        ok: false,
        provider: ANTHROPIC,
        mode: "model",
        detail: ROHMELDUNG,
        at: "2026-09-09T10:00:00.000Z",
        anbieter: "anthropic",
      },
    });
    const karte = await karteMounten("de");
    await knopfDruecken(karte, i18n.t("adm.ai.test"));

    const text = fehlerkasten(karte, "ki-fehler-cloud").textContent ?? "";
    expect(text).toContain(i18n.t("adm.ai.befund.unbestimmt"));
    // Die Rohmeldung bleibt WÖRTLICH stehen — sie ist das Einzige, was hier wirklich vorliegt.
    expect(text).toContain(ROHMELDUNG);
    for (const schluessel of ALLE_RATSCHLAEGE) {
      expect(text, `unbelegter Ratschlag ${schluessel} steht im unbestimmten Fall`).not.toContain(
        i18n.t(schluessel),
      );
    }
    expect(karte.textContent ?? "").not.toContain("ANTHROPIC_API_KEY");
  });

  it('ein Ergebnis mit `fehlerklasse: "unknown"` wird genauso behandelt', async () => {
    fetchSpion({
      config: konfig({ provider: ANTHROPIC }),
      test: {
        ok: false,
        provider: ANTHROPIC,
        mode: "model",
        detail: ROHMELDUNG,
        at: "2026-09-09T10:00:00.000Z",
        anbieter: "anthropic",
        fehlerklasse: "unknown",
      },
    });
    const karte = await karteMounten("de");
    await knopfDruecken(karte, i18n.t("adm.ai.test"));

    const text = fehlerkasten(karte, "ki-fehler-cloud").textContent ?? "";
    expect(text).toContain(i18n.t("adm.ai.befund.unbestimmt"));
    expect(text).toContain(ROHMELDUNG);
    expect(text).not.toContain(i18n.t("adm.ai.rat.nichtErreichbar"));
  });
});
