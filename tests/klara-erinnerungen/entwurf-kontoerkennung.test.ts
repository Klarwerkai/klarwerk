// @vitest-environment jsdom
// ================================================================================================
// KLARA 10 (produkt:20261007:klara-erinnerungen-kalender) · Nacharbeit 14 — ein offener
// Erinnerungsentwurf überlebt, dass Klara das Konto erst NACH dem Seitenaufbau erfährt.
// ================================================================================================
//
// Ursache des roten U2 (`erinnerungen-am-server.test.tsx`): Klara liest beim ersten Bekanntwerden
// des Kontos das eigene Gespräch (`ladeEcht`). Bisher galt schon „Konto noch unbekannt → jetzt
// bekannt“ als Kontowechsel und verwarf über `vergiss()` auch den Erinnerungsentwurf DESSELBEN
// Kontos — auf einem langsamen Prüfrechner genau dann, wenn die Person ihn schon geöffnet hatte.
// Hier deterministisch, ohne Zeitabhängigkeit: Entwurf offen, dann wird das Konto bekannt.
// Gegenprobe: ein echter Wechsel zu einem ANDEREN Konto und das Abmelden verwerfen weiterhin.
// Typcheck: wie die übrigen DOM-Tests über `tsconfig.tests-tsx.json` (window, und über `echt.ts`
// auch `bezug.ts` mit DOMParser) — im Node-reinen Root-Check ausgenommen.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ladeEcht, leseEcht, vergiss } from "../../apps/web/src/components/klara-vorschau/echt";
import {
  leseErinnerungen,
  starteEntwurf,
} from "../../apps/web/src/components/klara-vorschau/erinnerungen";
import i18n from "../../apps/web/src/i18n";

let echterFetch: typeof globalThis.fetch;
const t = i18n.getFixedT("de");

beforeEach(() => {
  echterFetch = globalThis.fetch;
  // Das eigene Gespräch: noch keines (die Antwort ist für diese Probe unerheblich).
  const antwort = () =>
    Promise.resolve(
      new Response(JSON.stringify({ gespraech: null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  globalThis.fetch = antwort as typeof globalThis.fetch;
  window.fetch = antwort as typeof globalThis.fetch;
  vergiss();
});

afterEach(() => {
  globalThis.fetch = echterFetch;
  window.fetch = echterFetch;
  vergiss();
});

describe("Nacharbeit 14 · K2 — Entwurf bleibt, wenn das Konto erst nach dem Öffnen bekannt wird", () => {
  it("erstes Bekanntwerden des Kontos verwirft den offenen Entwurf NICHT", async () => {
    starteEntwurf({ art: "frei" }, "Ohne Bezug", "Zähler ablesen");
    expect(leseErinnerungen().entwurf?.titel).toBe("Zähler ablesen");
    await ladeEcht("konto-nora", t);
    expect(leseEcht().kontoId).toBe("konto-nora");
    expect(leseErinnerungen().entwurf).toMatchObject({ titel: "Zähler ablesen", stand: "offen" });
  });

  it("Gegenprobe: ein ECHTER Wechsel zu einem anderen Konto verwirft weiterhin alles", async () => {
    await ladeEcht("konto-nora", t);
    starteEntwurf({ art: "frei" }, "Ohne Bezug", "Noras Entwurf");
    await ladeEcht("konto-otto", t);
    expect(leseEcht().kontoId).toBe("konto-otto");
    expect(leseErinnerungen().entwurf).toBeNull();
  });

  it("Gegenprobe: Abmelden verwirft weiterhin alles", async () => {
    await ladeEcht("konto-nora", t);
    starteEntwurf({ art: "frei" }, "Ohne Bezug", "Noras Entwurf");
    vergiss();
    expect(leseEcht().kontoId).toBeNull();
    expect(leseErinnerungen().entwurf).toBeNull();
  });
});
