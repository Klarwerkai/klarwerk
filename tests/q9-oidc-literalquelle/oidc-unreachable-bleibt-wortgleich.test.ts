// ================================================================================================
// JOB 3562 · Q9-REST — WAS DER MENSCH LIEST, BLEIBT ZEICHEN FÜR ZEICHEN GLEICH.
// ================================================================================================
//
// Diese Datei ist AUSDRÜCKLICH KEIN Red-first-Nachweis: sie ist schon vor der Umstellung grün, und
// das ist ihr Zweck. Der Umbau verschiebt einen deutschen Satz von `oidc.ts` in `meldungen.ts` —
// eine Bewegung, bei der genau ein Fehler droht, den kein Wächter dieses Ordners sieht: ein
// Tippfehler, ein fehlender Punkt, ein anderes Anführungszeichen. Die Erwartungen unten sind die
// heutigen Zeichenketten, abgeschrieben vom Stand vor der Änderung; sie halten die Bewegung fest.
//
// Die Kette, an der dieser Satz hängt, ist unverändert und wird hier an ihren zwei Enden gemessen:
//   oidc.ts (Fehler entsteht) → routes.ts:116 (Schlüssel gewählt) → meldungen.ts (Fassung gewählt)
//   → HTTP-Feld `message` → SsoCallback.tsx (zeigt `e.message`).
// Gemessen werden das erste Ende (der Vorgabewert von `OidcUnreachableError`) und das dritte
// (`meldung()`). Die Mitte gehört `routes.ts` und ist nicht Teil dieses Auftrags; der laufende
// SSO-Rückweg über einen stummen Identitätsanbieter wird hier NICHT gefahren.
import { describe, expect, it } from "vitest";
import { MELDUNGEN, meldung } from "../../services/auth/src/meldungen";
import { OidcUnreachableError } from "../../services/auth/src/oidc";

const DE = "Anmeldedienst antwortet nicht.";
const EN = "The sign-in service is not responding.";
const NL = "De aanmelddienst reageert niet.";

describe("der eine Satz des stummen Anmeldedienstes", () => {
  it("D1 · meldung() gibt in de/en/nl genau die heutigen Sätze zurück", () => {
    expect(meldung("OIDC_UNREACHABLE", "de")).toBe(DE);
    expect(meldung("OIDC_UNREACHABLE", "en")).toBe(EN);
    expect(meldung("OIDC_UNREACHABLE", "nl")).toBe(NL);
  });

  it("D2 · eine unbekannte Sprache fällt auf Deutsch zurück, nicht auf eine leere Antwort", () => {
    expect(meldung("OIDC_UNREACHABLE", "fr")).toBe(DE);
    expect(meldung("OIDC_UNREACHABLE")).toBe(DE);
  });

  it("D3 · der Katalog trägt den Schlüssel selbst — sonst ist D1 nur der INTERNAL-Rückfall", () => {
    // Ohne diesen Fall wäre D1 grün zu machen, indem man `OIDC_UNREACHABLE` löscht und den
    // deutschen Satz nach INTERNAL schreibt: `meldung()` gibt für unbekannte Schlüssel INTERNAL
    // zurück, ohne zu klagen (meldungen.ts:149-152).
    expect(Object.hasOwn(MELDUNGEN, "OIDC_UNREACHABLE")).toBe(true);
    expect(meldung("OIDC_UNREACHABLE", "de")).not.toBe(meldung("INTERNAL", "de"));
  });

  it("D4 · new OidcUnreachableError() trägt ohne Argument denselben Satz und denselben Code", () => {
    // Die Klasse wird wirklich instanziiert, nicht nur der Vorgabewert gelesen: der Umbau bezieht
    // ihn aus einem anderen Modul, und ein Vorgabewert, der zur Ladezeit noch nicht steht, fiele
    // genau hier auf.
    const fehler = new OidcUnreachableError();
    expect(fehler.message).toBe(DE);
    expect(fehler.code).toBe("INVALID_CREDENTIALS");
    expect(fehler.name).toBe("OidcUnreachableError");
  });

  it("D5 · ein ausdrücklich übergebener Text schlägt den Vorgabewert weiterhin", () => {
    const fehler = new OidcUnreachableError("eigener Text");
    expect(fehler.message).toBe("eigener Text");
    expect(fehler.code).toBe("INVALID_CREDENTIALS");
  });
});
