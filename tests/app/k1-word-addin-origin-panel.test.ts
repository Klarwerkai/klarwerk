// ================================================================================================
// K1.1 (JOB 660) — DAS PANEL SAGT, WOHER DER ENTWURF KOMMT.
// ================================================================================================
//
// DER BEFUND, den dieser Wächter zuerst rot gemeldet hat: Entwürfe, die aus dem Word-Aufgaben-
// fenster gesendet werden, trugen im gespeicherten Herkunftsfeld `frontdoor` — dieselbe Herkunft
// wie ein Entwurf, den jemand in der Web-Vordertür anlegt. Der Server konnte beide danach nicht
// mehr unterscheiden, obwohl er `word_addin` als eigene Herkunft längst kennt und durchreicht
// (services/capture/src/service.test.ts, Blöcke „JOB 510 R10" und „JOB 510 D3").
//
// DIE UNTERSCHEIDUNG, DIE DIESER WÄCHTER ZIEHT — und sie ist der ganze Punkt:
//
//   HERKUNFT  ist ein gespeicherter Wert am Entwurf. Er gehört auf `word_addin`.
//   APP-ROUTE ist ein URL-Pfad der Web-Anwendung (`/capture/frontdoor?draft=<id>`, die
//             Entwurf-fortsetzen-Mechanik). Sie heißt zufällig auch „frontdoor" und bleibt
//             UNVERÄNDERT — sie ist kein Herkunftswert, sondern eine Adresse.
//
// Genau diese Verwechslung wäre bei einem Suchen-und-Ersetzen über die Datei passiert: In
// taskpane.html stehen SIEBEN `frontdoor`-Fundstellen, von denen nur VIER die Herkunft meinen.
// Der Wächter prüft deshalb beide Richtungen — die Herkunft MUSS gewandert sein, die Routen
// dürfen es NICHT sein.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");
const TASKPANE = join(WURZEL, "apps", "web", "public", "word-addin", "taskpane.html");
const WORDADDIN_LIB = join(WURZEL, "apps", "web", "src", "lib", "wordAddin.ts");

const panel = (): string => readFileSync(TASKPANE, "utf8");
const spiegel = (): string => readFileSync(WORDADDIN_LIB, "utf8");

// Zählt Vorkommen einer festen Zeichenfolge — bewusst kein Regex: die gesuchten Formen enthalten
// Klammern, Schrägstriche und Anführungszeichen, und eine Maskierungslücke würde hier still
// falsch zählen statt zu scheitern.
function zaehle(heuhaufen: string, nadel: string): number {
  let treffer = 0;
  let ab = 0;
  for (;;) {
    const stelle = heuhaufen.indexOf(nadel, ab);
    if (stelle === -1) {
      return treffer;
    }
    treffer += 1;
    ab = stelle + nadel.length;
  }
}

// Die beiden Herkunftszuweisungen im Panel stehen in unterschiedlicher Schreibweise (einmal am
// Ende eines JSON.stringify-Literals, einmal als eigene Objektzeile). Beide Formen werden
// getrennt geprüft, damit ein halber Umbau nicht durchrutscht.
const HERKUNFT_INLINE = 'origin: "word_addin" });';
const HERKUNFT_ZEILE = 'origin: "word_addin",';
const HERKUNFT_ALT_INLINE = 'origin: "frontdoor" });';
const HERKUNFT_ALT_ZEILE = 'origin: "frontdoor",';
const APP_ROUTE = '"/capture/frontdoor?draft=" + encodeURIComponent(draft.id)';

describe("K1.1 · Word-Panel: Herkunft ist word_addin, die App-Route bleibt frontdoor", () => {
  it("beide Panel-Payloads senden origin word_addin", () => {
    const html = panel();
    expect(
      zaehle(html, HERKUNFT_INLINE),
      "Panel-Payload 1 (Wissensseite senden) muss die Herkunft word_addin tragen",
    ).toBe(1);
    expect(
      zaehle(html, HERKUNFT_ZEILE),
      "Panel-Payload 2 (Wissenslücke) muss die Herkunft word_addin tragen",
    ).toBe(1);
  });

  it("keine Herkunftszuweisung steht mehr auf frontdoor", () => {
    const html = panel();
    expect(
      zaehle(html, HERKUNFT_ALT_INLINE) + zaehle(html, HERKUNFT_ALT_ZEILE),
      "Eine Herkunftszuweisung steht noch auf frontdoor — der Server kann Word dann nicht von der Vordertür unterscheiden.",
    ).toBe(0);
  });

  it("der Bibliotheksspiegel wordAddin.ts trägt dieselbe Herkunft", () => {
    const ts = spiegel();
    expect(
      zaehle(ts, 'origin: "word_addin"'),
      "wordAddin.ts#draftPostPayload muss den Panel-Vertrag spiegeln",
    ).toBe(1);
    expect(
      zaehle(ts, 'origin: "frontdoor"'),
      "wordAddin.ts darf keine frontdoor-Herkunft mehr senden",
    ).toBe(0);
  });

  // DIE GEGENRICHTUNG. Ohne sie wäre der Wächter nur die halbe Zusage: Ein Suchen-und-Ersetzen
  // über die Datei würde alle Prüfungen oben bestehen — und dabei die Entwurf-fortsetzen-Links
  // zerstören, ohne dass irgendetwas rot würde.
  it("die zwei Deep-Links bleiben unverändert auf der App-Route /capture/frontdoor", () => {
    const html = panel();
    expect(
      zaehle(html, APP_ROUTE),
      "Es müssen GENAU zwei Deep-Link-Stellen auf /capture/frontdoor?draft= zeigen — sie sind eine App-Route, keine Herkunft.",
    ).toBe(2);
  });

  // NEGATIVKALIBRIERUNG. Ein Wächter, der nie anschlägt, ist keine Prüfung. Gemessen wird an einer
  // synthetisch zurückgesetzten Fassung im Speicher — die Datei auf der Platte wird NICHT berührt.
  it("kalibriert: eine zurückgesetzte Herkunft würde erkannt", () => {
    const zurueckgesetzt = panel()
      .replace(HERKUNFT_INLINE, HERKUNFT_ALT_INLINE)
      .replace(HERKUNFT_ZEILE, HERKUNFT_ALT_ZEILE);
    expect(zaehle(zurueckgesetzt, HERKUNFT_INLINE)).toBe(0);
    expect(zaehle(zurueckgesetzt, HERKUNFT_ZEILE)).toBe(0);
    expect(
      zaehle(zurueckgesetzt, HERKUNFT_ALT_INLINE) + zaehle(zurueckgesetzt, HERKUNFT_ALT_ZEILE),
      "Die Kalibrierung muss die zurückgesetzte Herkunft sichtbar machen — sonst prüft der Wächter nichts.",
    ).toBe(2);
    // Und die Gegenrichtung bleibt auch in der zurückgesetzten Fassung unberührt: die Kalibrierung
    // darf die App-Routen nicht anfassen, sonst misst sie zwei Dinge auf einmal.
    expect(zaehle(zurueckgesetzt, APP_ROUTE)).toBe(2);
  });
});
