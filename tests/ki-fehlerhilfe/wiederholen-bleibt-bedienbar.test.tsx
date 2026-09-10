// @vitest-environment jsdom
// ================================================================================================
// JOB 3420 · RUNDE 2 — DER WIEDERHOLEN-KNOPF VERSCHWINDET NICHT UNTER DER HAND.
// ================================================================================================
//
// DER BEFUND, GEGEN DEN DIESE DATEI STEHT (BENs Korrekturpflicht 1 an Runde 1, gemessen mit einer
// verzögerten zweiten Antwort: `BEN_PENDING {"kastenVorhanden":false,…}`): Runde 1 hat den
// Wiederholen-Knopf an `mutation.data`/`mutation.isError` gehängt. TanStack Query räumt beides beim
// erneuten `mutate()` ab — der Kasten samt Knopf verschwand also GENAU in dem Augenblick, in dem
// der Knopf gedrückt wurde. Der zugesagte Laufzustand („teste …", deaktiviert) war damit
// unerreichbar, und Runde 1 hat ihn trotzdem als erfüllt gemeldet.
//
// WAS HIER GEMESSEN WIRD — und zwar an einer WIRKLICH offenen Antwort, nicht an einem Zustandsfeld:
// die zweite Serverantwort wird über die Bremse des Spions angehalten. In diesem Fenster muss
//   · der Fehlerkasten stehen bleiben, ausgewiesen als der ÄLTERE Befund (Auftrag §9),
//   · der Wiederholen-Knopf DA sein, deaktiviert, mit der Aufschrift „teste …",
//   · ein weiteres Drücken KEINEN zusätzlichen Serverruf erzeugen (am Spion gezählt),
// und nach dem Öffnen der Bremse trägt der Kasten den neuen Befund ohne Älter-Hinweis.
//
// DER TASTATURWEG (Tab bis zum Knopf, Enter löst aus) steht NICHT hier: jsdom kennt weder eine
// Tabreihenfolge noch die Standardaktivierung eines `<button>`. Er wird in Chromium gegangen —
// `tests/ki-fehlerhilfe/wiederholen-tastatur-chromium.test.ts`.
import { afterEach, describe, expect, it } from "vitest";
import { act } from "../../apps/web/node_modules/react";
import i18n from "../../apps/web/src/i18n";
import { anbieterUndModell } from "../../apps/web/src/lib/aiOverview";
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

const LOKAL_LEBT = {
  ok: true,
  provider: LOKAL,
  mode: "model",
  detail: "ok",
  at: "2026-09-09T10:05:00.000Z",
};

const LOKALE_KONFIG = konfig({
  provider: ANTHROPIC,
  localConfigured: true,
  localProvider: LOKAL,
});

/** Die Zeit, die der Älter-Hinweis nennt — DERSELBE Ausdruck wie in `AdminKiDetails.tsx`. */
const ZEIT_DES_BEFUNDES = new Date(LOKAL_TOT.at).toLocaleTimeString(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

/** Ein Tor, das eine Antwort so lange offen hält, bis der Test sie durchlässt. */
function tor(): { warten: Promise<void>; oeffnen: () => Promise<void> } {
  let durchlassen: () => void = () => {};
  const warten = new Promise<void>((aufloesen) => {
    durchlassen = (): void => aufloesen();
  });
  return {
    warten,
    oeffnen: async (): Promise<void> => {
      await act(async () => {
        durchlassen();
        await durchlaufen();
      });
      await act(durchlaufen);
    },
  };
}

/** Wie oft der lokale Prüfweg wirklich gerufen wurde. */
const lokaleRufe = (rufe: readonly string[]): number =>
  rufe.filter((p) => p.includes("/reasoner/test-local")).length;

afterEach(aufraeumen);

describe("JOB 3420 Runde 2 · der Wiederholen-Knopf während seines eigenen Laufs", () => {
  it("DE: der Kasten bleibt, der Knopf ist deaktiviert und trägt „teste …“", async () => {
    const zweite = tor();
    const spion = fetchSpion({
      config: LOKALE_KONFIG,
      testLocal: LOKAL_TOT,
      bremse: (pfad, nr) =>
        pfad.includes("/reasoner/test-local") && nr >= 2 ? zweite.warten : undefined,
    });
    const karte = await karteMounten("de");
    await knopfDruecken(karte, i18n.t("adm.ai.testLocal"));
    expect(lokaleRufe(spion.rufe)).toBe(1);

    await druecken(knopfMit(fehlerkasten(karte, "ki-fehler-local"), i18n.t("adm.ai.wiederholen")));
    expect(lokaleRufe(spion.rufe)).toBe(2);

    // Die zweite Antwort steht noch offen — GENAU hier war Runde 1 blind.
    const kasten = fehlerkasten(karte, "ki-fehler-local");
    const laufend = knopfMit(kasten, i18n.t("adm.ai.testRunning"));
    expect(laufend.disabled, "der Knopf ist während seines Laufs nicht gesperrt").toBe(true);
    // Der alte Befund steht weiter da — aber ausdrücklich als der ältere (Auftrag §9).
    expect(kasten.textContent ?? "").toContain(i18n.t("adm.ai.befund.lokal.nichtErreichbar"));
    const aelter = kasten.querySelector('[data-testid="ki-fehler-local-aelter"]');
    expect(aelter?.textContent).toBe(i18n.t("adm.ai.befund.aelter", { zeit: ZEIT_DES_BEFUNDES }));

    // Ein zweites Drücken des gesperrten Knopfes darf nichts auslösen.
    await druecken(laufend);
    expect(lokaleRufe(spion.rufe), "der gesperrte Knopf hat trotzdem gerufen").toBe(2);

    // Und wenn die Antwort kommt: neuer Befund, kein Älter-Hinweis, Knopf wieder bedienbar.
    await zweite.oeffnen();
    const danach = fehlerkasten(karte, "ki-fehler-local");
    expect(danach.querySelector('[data-testid="ki-fehler-local-aelter"]')).toBeNull();
    const wieder = knopfMit(danach, i18n.t("adm.ai.wiederholen"));
    expect(wieder.disabled).toBe(false);
    expect(lokaleRufe(spion.rufe)).toBe(2);
  });

  it("EN: derselbe Laufzustand in der zweiten Sprache", async () => {
    const zweite = tor();
    fetchSpion({
      config: LOKALE_KONFIG,
      testLocal: LOKAL_TOT,
      bremse: (pfad, nr) =>
        pfad.includes("/reasoner/test-local") && nr >= 2 ? zweite.warten : undefined,
    });
    const karte = await karteMounten("en");
    await knopfDruecken(karte, i18n.t("adm.ai.testLocal"));
    await druecken(knopfMit(fehlerkasten(karte, "ki-fehler-local"), i18n.t("adm.ai.wiederholen")));

    const kasten = fehlerkasten(karte, "ki-fehler-local");
    expect(knopfMit(kasten, i18n.t("adm.ai.testRunning")).disabled).toBe(true);
    expect(kasten.querySelector('[data-testid="ki-fehler-local-aelter"]')?.textContent).toBe(
      i18n.t("adm.ai.befund.aelter", { zeit: ZEIT_DES_BEFUNDES }),
    );
    await zweite.oeffnen();
    await spracheZurueck();
  });

  it("ein geglückter zweiter Versuch räumt den alten Befund weg statt ihn stehen zu lassen", async () => {
    const zweite = tor();
    const spion = fetchSpion({
      config: LOKALE_KONFIG,
      // Erster Ruf: tot. Zweiter Ruf: der Server antwortet.
      testLocal: (nr: number) => (nr === 1 ? LOKAL_TOT : LOKAL_LEBT),
      bremse: (pfad, nr) =>
        pfad.includes("/reasoner/test-local") && nr >= 2 ? zweite.warten : undefined,
    });
    const karte = await karteMounten("de");
    await knopfDruecken(karte, i18n.t("adm.ai.testLocal"));
    await druecken(knopfMit(fehlerkasten(karte, "ki-fehler-local"), i18n.t("adm.ai.wiederholen")));
    // Während des Laufs steht der alte Befund noch, als älterer.
    expect(
      fehlerkasten(karte, "ki-fehler-local").querySelector(
        '[data-testid="ki-fehler-local-aelter"]',
      ),
    ).not.toBeNull();

    await zweite.oeffnen();
    // Danach ist er weg — er gälte sonst für eine Messung, die es nicht mehr gibt.
    expect(karte.querySelector('[data-testid="ki-fehler-local"]')).toBeNull();
    expect(karte.textContent ?? "").toContain(
      i18n.t("adm.ai.testLocalOk", { provider: anbieterUndModell(LOKAL_LEBT.provider) }),
    );
    expect(lokaleRufe(spion.rufe)).toBe(2);
  });

  it("auch der gescheiterte Anfrageweg behält seinen Knopf — ohne Zeitstempel, den es nicht gibt", async () => {
    const zweite = tor();
    const spion = fetchSpion({
      // `/reasoner/test` ist NICHT hinterlegt: der Spion antwortet 500, die Mutation steht auf
      // `isError`. Es liegt kein Prüfergebnis vor, also auch kein `at`.
      config: konfig({ provider: ANTHROPIC }),
      bremse: (pfad, nr) =>
        pfad.endsWith("/reasoner/test") && nr >= 2 ? zweite.warten : undefined,
    });
    const karte = await karteMounten("de");
    await knopfDruecken(karte, i18n.t("adm.ai.test"));
    await druecken(
      knopfMit(fehlerkasten(karte, "ki-fehler-cloud-anfrage"), i18n.t("adm.ai.wiederholen")),
    );

    const kasten = fehlerkasten(karte, "ki-fehler-cloud-anfrage");
    expect(knopfMit(kasten, i18n.t("adm.ai.testRunning")).disabled).toBe(true);
    expect(
      kasten.querySelector('[data-testid="ki-fehler-cloud-anfrage-aelter"]')?.textContent,
    ).toBe(i18n.t("adm.ai.befund.aelterOhneZeit"));
    expect(kasten.textContent ?? "").toContain(i18n.t("adm.ai.befund.anfrage"));

    await zweite.oeffnen();
    expect(spion.rufe.filter((p) => p.endsWith("/reasoner/test")).length).toBe(2);
  });
});
