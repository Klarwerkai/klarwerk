// @vitest-environment jsdom
// ================================================================================================
// JOB 3420 · UX-10b — FALL 3: DER EIGENE LLM BEKOMMT KEINEN CLOUD-SCHLÜSSELTIPP.
// ================================================================================================
//
// DER BEFUND: `AdminKiDetails.tsx:292` schickte auch das Ergebnis des LOKALEN Schlüsseltests durch
// `adm.ai.testFail` — der eigene Server im eigenen Haus wurde also aufgefordert, einen Anthropic-
// Cloud-Schlüssel im Schlüsselbund zu erneuern. Danach sagt die Karte, was den lokalen Server
// betrifft, und bietet an, den Test zu wiederholen.
//
// WAS AM WIEDERHOLEN-KNOPF HIER GEMESSEN WIRD — und was NICHT (BENs Einwand zu Runde 1, wörtlich:
// „direktes `focus()` plus synthetischer Mausklick ersetzt diesen Nachweis nicht"): jsdom hat weder
// eine Tabreihenfolge noch die Standard-Aktivierung eines `<button>` durch Enter. Diese Datei belegt
// deshalb NUR die Bauform und die Verdrahtung: (1) natives, nicht deaktiviertes
// `<button type="button">`, (2) es steht unter den fokussierbaren Elementen der Karte und nimmt den
// Fokus an, (3) seine Aktivierung löst GENAU die zugehörige Mutation erneut aus (am Serverruf
// gezählt, nicht am Zustand behauptet); ein `keydown`-Enter darf unterwegs nichts verschlucken.
//
// DER VOLLSTÄNDIGE TASTATURWEG — echte Tab-Anschläge bis zum Knopf, echtes Enter, genau ein
// zusätzlicher Serverruf, danach der sichtbare Laufzustand — wird in Chromium gegangen:
// `tests/ki-fehlerhilfe/wiederholen-tastatur-chromium.test.ts`.
import { afterEach, describe, expect, it } from "vitest";
import { act } from "../../apps/web/node_modules/react";
import i18n from "../../apps/web/src/i18n";
import {
  ANTHROPIC,
  LOKAL,
  aufraeumen,
  druecken,
  durchlaufen,
  fehlerkasten,
  fetchSpion,
  karteMounten,
  knopfDruecken,
  knopfMit,
  konfig,
  spracheZurueck,
} from "./karte";

const LOKAL_TOT = {
  ok: false,
  provider: LOKAL,
  mode: "model",
  detail: "fetch failed: ECONNREFUSED 127.0.0.1:8000",
  at: "2026-09-09T10:00:00.000Z",
  fehlerklasse: "network",
};

const LOKALE_KONFIG = konfig({
  provider: ANTHROPIC,
  localConfigured: true,
  localProvider: LOKAL,
});

/** Die fokussierbar gebauten Elemente der Karte (jsdom kennt keine echte Tabreihenfolge). */
function fokussierbare(karte: HTMLDivElement): HTMLElement[] {
  return [
    ...karte.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [tabindex]"),
  ].filter(
    (el) =>
      !(el as HTMLButtonElement).disabled &&
      el.getAttribute("tabindex") !== "-1" &&
      el.getAttribute("aria-hidden") !== "true",
  );
}

afterEach(aufraeumen);

describe("JOB 3420 · Fall 3 — der lokale LLM-Server, ehrlich benannt", () => {
  it("DE: der Text spricht vom lokalen Server, nicht von einem Cloud-Schlüssel", async () => {
    fetchSpion({ config: LOKALE_KONFIG, testLocal: LOKAL_TOT });
    const karte = await karteMounten("de");
    await knopfDruecken(karte, i18n.t("adm.ai.testLocal"));

    const text = fehlerkasten(karte, "ki-fehler-local").textContent ?? "";
    expect(text).toContain(i18n.t("adm.ai.befund.lokal.nichtErreichbar"));
    expect(text).toContain(i18n.t("adm.ai.rat.lokal.nichtErreichbar"));
    // Kein Cloud-Schlüsseltipp — weder der eine noch der andere Anbieter.
    expect(karte.textContent ?? "").not.toContain("ANTHROPIC_API_KEY");
    expect(karte.textContent ?? "").not.toContain("OPENAI_API_KEY");
    // Und nicht der Cloud-Satz desselben Falls: die beiden Wege sind unterscheidbar.
    expect(text).not.toContain(i18n.t("adm.ai.befund.nichtErreichbar"));
  });

  it("EN: dieselbe Auskunft in der zweiten Sprache", async () => {
    fetchSpion({ config: LOKALE_KONFIG, testLocal: LOKAL_TOT });
    const karte = await karteMounten("en");
    await knopfDruecken(karte, i18n.t("adm.ai.testLocal"));

    const text = fehlerkasten(karte, "ki-fehler-local").textContent ?? "";
    expect(text).toContain(i18n.t("adm.ai.befund.lokal.nichtErreichbar"));
    expect(text).toContain(i18n.t("adm.ai.rat.lokal.nichtErreichbar"));
    expect(karte.textContent ?? "").not.toContain("ANTHROPIC_API_KEY");
    await spracheZurueck();
  });

  it("der Wiederholen-Knopf ist fokussierbar gebaut und löst GENAU diese Mutation erneut aus", async () => {
    const spion = fetchSpion({ config: LOKALE_KONFIG, testLocal: LOKAL_TOT });
    const karte = await karteMounten("de");
    await knopfDruecken(karte, i18n.t("adm.ai.testLocal"));

    const kasten = fehlerkasten(karte, "ki-fehler-local");
    const knopf = knopfMit(kasten, i18n.t("adm.ai.wiederholen"));

    // (1) natives, nicht deaktiviertes Bedienelement
    expect(knopf.tagName).toBe("BUTTON");
    expect(knopf.getAttribute("type")).toBe("button");
    expect(knopf.disabled).toBe(false);
    // (2) unter den fokussierbaren Elementen der Karte, und der Fokus kommt wirklich an
    //     (dass die TASTATUR ihn erreicht, misst der Chromium-Fall — s. Kopf)
    expect(fokussierbare(karte)).toContain(knopf);
    knopf.focus();
    expect(document.activeElement).toBe(knopf);
    // Ein Enter darf unterwegs nicht verschluckt werden (kein Handler ruft preventDefault).
    let enter: KeyboardEvent | undefined;
    await act(async () => {
      enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
      knopf.dispatchEvent(enter);
      await durchlaufen();
    });
    expect(enter?.defaultPrevented).toBe(false);

    // (3) die Aktivierung ruft den lokalen Test ein ZWEITES Mal — am Server gezählt.
    const vorher = spion.rufe.filter((p) => p.includes("/reasoner/test-local")).length;
    expect(vorher).toBe(1);
    await druecken(knopf);
    const nachher = spion.rufe.filter((p) => p.includes("/reasoner/test-local")).length;
    expect(nachher).toBe(2);
    // Und NUR diese Mutation: der Cloud-Test bleibt unangetastet.
    expect(spion.rufe.filter((p) => p.endsWith("/reasoner/test")).length).toBe(0);
  });
});
