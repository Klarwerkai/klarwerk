// @vitest-environment jsdom
// ================================================================================================
// JOB 3420 · UX-10b — FALL 5: SCHEITERT DIE ANFRAGE, GIBT ES GAR KEINEN MODELLBEFUND.
// ================================================================================================
//
// DER BEFUND: an vier Stellen (`AdminKiDetails.tsx:273`, `:297`, `:328`, `:357`) stand
// `t("adm.ai.testFail", { detail: t("state.error") })` — also „Test fehlgeschlagen … Tipp:
// Schlüssel erneuern", OBWOHL nie ein Modell geantwortet hat. Die Anfrage an KLARWERK selbst kam
// nicht durch; es liegt kein Prüfergebnis vor, und über Modell, Anbieter oder Schlüssel ist damit
// nichts bekannt.
//
// HERMETIK: der Weg `/reasoner/test` ist im Spion NICHT hinterlegt und antwortet 500 — genau der
// Zustand `isError` der Mutation.
import { afterEach, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  ANTHROPIC,
  LOKAL,
  aufraeumen,
  druecken,
  fehlerkasten,
  fetchSpion,
  karteMounten,
  knopfDruecken,
  knopfMit,
  konfig,
} from "./karte";

afterEach(aufraeumen);

describe("JOB 3420 · Fall 5 — der gescheiterte Anfrageweg sagt genau das", () => {
  it("Cloud-Test: Aussage über die Anfrage, kein Satz über Modell oder Schlüssel", async () => {
    fetchSpion({ config: konfig({ provider: ANTHROPIC }) });
    const karte = await karteMounten("de");
    await knopfDruecken(karte, i18n.t("adm.ai.test"));

    const text = fehlerkasten(karte, "ki-fehler-cloud-anfrage").textContent ?? "";
    expect(text).toContain(i18n.t("adm.ai.befund.anfrage"));
    expect(text).toContain(i18n.t("adm.ai.rat.anfrage"));
    // Kein Ursachensatz, der ein Modellverhalten behauptet — es hat keines geantwortet.
    expect(text).not.toContain(i18n.t("adm.ai.befund.unbestimmt"));
    expect(text).not.toContain(i18n.t("adm.ai.befund.zugang", { status: 401 }));
    expect(text).not.toContain(i18n.t("adm.ai.rat.zugang"));
    expect(karte.textContent ?? "").not.toContain("ANTHROPIC_API_KEY");
    // Und der neutrale Rahmen „Test fehlgeschlagen: …" steht hier NICHT: es gibt kein Ergebnis,
    // dessen Rohmeldung er tragen könnte.
    expect(text).not.toContain(i18n.t("adm.ai.testFail", { detail: i18n.t("state.error") }));
  });

  it("der Wiederholen-Knopf startet genau diese Anfrage erneut", async () => {
    const spion = fetchSpion({ config: konfig({ provider: ANTHROPIC }) });
    const karte = await karteMounten("de");
    await knopfDruecken(karte, i18n.t("adm.ai.test"));

    const kasten = fehlerkasten(karte, "ki-fehler-cloud-anfrage");
    expect(spion.rufe.filter((p) => p.endsWith("/reasoner/test")).length).toBe(1);
    await druecken(knopfMit(kasten, i18n.t("adm.ai.wiederholen")));
    expect(spion.rufe.filter((p) => p.endsWith("/reasoner/test")).length).toBe(2);
  });

  it("lokaler Test: derselbe Fall, und weiterhin kein Cloud-Schlüsseltipp", async () => {
    fetchSpion({
      config: konfig({ provider: ANTHROPIC, localConfigured: true, localProvider: LOKAL }),
    });
    const karte = await karteMounten("de");
    await knopfDruecken(karte, i18n.t("adm.ai.testLocal"));

    const text = fehlerkasten(karte, "ki-fehler-local-anfrage").textContent ?? "";
    expect(text).toContain(i18n.t("adm.ai.befund.anfrage"));
    expect(karte.textContent ?? "").not.toContain("ANTHROPIC_API_KEY");
  });

  it("die beiden Selbsttests: auch ihr Fehlerkasten redet nicht über Schlüssel", async () => {
    const spion = fetchSpion({ config: konfig({ provider: ANTHROPIC }) });
    const karte = await karteMounten("de");
    await knopfDruecken(karte, i18n.t("adm.selfTest.button"));

    for (const testId of ["ki-fehler-konflikt-anfrage", "ki-fehler-duplikat-anfrage"]) {
      const text = fehlerkasten(karte, testId).textContent ?? "";
      expect(text).toContain(i18n.t("adm.ai.befund.anfrage"));
      expect(text).not.toContain(i18n.t("adm.ai.rat.zugang"));
    }
    expect(karte.textContent ?? "").not.toContain("ANTHROPIC_API_KEY");

    // Jeder Kasten wiederholt SEINE eigene Prüfung, nicht beide.
    const konflikte = (): number =>
      spion.rufe.filter((p) => p.includes("/reasoner/conflict-self-test")).length;
    const duplikate = (): number =>
      spion.rufe.filter((p) => p.includes("/reasoner/duplicate-self-test")).length;
    expect([konflikte(), duplikate()]).toEqual([1, 1]);
    await druecken(
      knopfMit(fehlerkasten(karte, "ki-fehler-konflikt-anfrage"), i18n.t("adm.ai.wiederholen")),
    );
    expect([konflikte(), duplikate()]).toEqual([2, 1]);
  });
});
