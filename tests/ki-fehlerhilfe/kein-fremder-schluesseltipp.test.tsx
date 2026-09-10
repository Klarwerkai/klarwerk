// @vitest-environment jsdom
// ================================================================================================
// JOB 3420 · UX-10b — FALL 2: BEI CHATGPT STEHT NICHT DER ANTHROPIC-SCHLÜSSEL DA.
// ================================================================================================
//
// DER BEFUND, GEGEN DEN DIESER FALL STEHT: `adm.ai.testFail` hängte den Satz „Tipp: Schlüssel …
// Account ANTHROPIC_API_KEY … erneuern" BEDINGUNGSLOS an jedes Scheitern — auch an ein 400 von
// OpenAI, bei dem ein neuer Schlüssel nichts ändert, und auch an einen Anbieter, der gar nicht
// Anthropic ist. Gemessen wird am SICHTBAREN TEXT der gemounteten Karte, nicht an einer Variablen.
//
// ZWEI SPRACHEN, weil der Tipp in beiden gleich falsch war (`i18n.ts:1172` de, `:6753` en).
import { afterEach, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  OPENAI,
  aufraeumen,
  fehlerkasten,
  fetchSpion,
  karteMounten,
  knopfDruecken,
  konfig,
  spracheZurueck,
} from "./karte";

const GRUND = "unknown parameter: max_tokens";

/** Genau das Ergebnis aus Fall 1 — die Kette endet hier, sie beginnt am echten Router. */
const VIERHUNDERT = {
  ok: false,
  provider: OPENAI,
  mode: "model",
  detail: "Modell-API antwortete mit 400",
  at: "2026-09-09T10:00:00.000Z",
  anbieter: "openai",
  fehlerklasse: "http",
  status: 400,
  anbieterGrund: GRUND,
};

afterEach(aufraeumen);

describe("JOB 3420 · Fall 2 — die Karte nennt, was OpenAI geantwortet hat", () => {
  it("DE: die Begründung von OpenAI steht wörtlich da, ANTHROPIC_API_KEY nirgends", async () => {
    fetchSpion({ config: konfig({ provider: OPENAI }), test: VIERHUNDERT });
    const karte = await karteMounten("de");
    await knopfDruecken(karte, i18n.t("adm.ai.test"));

    const kasten = fehlerkasten(karte, "ki-fehler-cloud");
    const text = kasten.textContent ?? "";
    expect(text).toContain(GRUND);
    expect(text).toContain(i18n.t("adm.ai.befund.abgelehnt", { status: 400 }));
    expect(text).toContain(i18n.t("adm.ai.rat.abgelehnt"));
    // Der Kern des Auftrags: kein Schlüsseltipp, und schon gar nicht der eines fremden Anbieters.
    expect(karte.textContent ?? "").not.toContain("ANTHROPIC_API_KEY");
    expect(karte.textContent ?? "").not.toContain("OPENAI_API_KEY");
  });

  it("EN: derselbe Fall, dieselbe Zusage — auch ohne die deutsche Fassung", async () => {
    fetchSpion({ config: konfig({ provider: OPENAI }), test: VIERHUNDERT });
    const karte = await karteMounten("en");
    await knopfDruecken(karte, i18n.t("adm.ai.test"));

    const kasten = fehlerkasten(karte, "ki-fehler-cloud");
    expect(kasten.textContent ?? "").toContain(GRUND);
    expect(kasten.textContent ?? "").toContain(i18n.t("adm.ai.rat.abgelehnt"));
    expect(karte.textContent ?? "").not.toContain("ANTHROPIC_API_KEY");
    await spracheZurueck();
  });

  it("401 desselben Anbieters: HIER steht ein Schlüsseltipp — und er nennt OPENAI_API_KEY", async () => {
    // Die Gegenrichtung derselben Zusage: der Tipp verschwindet nicht, er wandert an die Stelle,
    // an der die Messung ihn trägt — mit dem Konto des GEPRÜFTEN Anbieters.
    fetchSpion({
      config: konfig({ provider: OPENAI }),
      test: {
        ...VIERHUNDERT,
        detail: "Modell-API antwortete mit 401",
        status: 401,
        anbieterGrund: undefined,
      },
    });
    const karte = await karteMounten("de");
    await knopfDruecken(karte, i18n.t("adm.ai.test"));

    const text = fehlerkasten(karte, "ki-fehler-cloud").textContent ?? "";
    expect(text).toContain(i18n.t("adm.ai.rat.zugangKonto.openai"));
    expect(text).toContain("OPENAI_API_KEY");
    expect(text).not.toContain("ANTHROPIC_API_KEY");
  });

  it("401 ohne bekannten Anbieter: KEIN Kontoname — geraten wird nicht", async () => {
    fetchSpion({
      config: konfig({ provider: OPENAI }),
      test: {
        ok: false,
        provider: OPENAI,
        mode: "model",
        detail: "Modell-API antwortete mit 401",
        at: "2026-09-09T10:00:00.000Z",
        fehlerklasse: "http",
        status: 401,
      },
    });
    const karte = await karteMounten("de");
    await knopfDruecken(karte, i18n.t("adm.ai.test"));

    const text = fehlerkasten(karte, "ki-fehler-cloud").textContent ?? "";
    expect(text).toContain(i18n.t("adm.ai.rat.zugang"));
    expect(text).not.toContain("OPENAI_API_KEY");
    expect(text).not.toContain("ANTHROPIC_API_KEY");
  });
});
