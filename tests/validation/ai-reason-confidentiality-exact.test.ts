// AUFTRAG-mega9 Block E-3 (KW-E2E-007) → AUFTRAG-mega11 Block A (bens SB-1, sicherheitsrelevant).
//
// mega9 hatte einen echten Fehler geschlossen: ein ausdrücklich als „Öffentlich-intern" eingereichter
// Beitrag endete mit dem Grund „Vertraulich — die Cloud-KI ist ausgeschlossen …", obwohl `confidential`
// eine PAAR-Eigenschaft ist:
//   services/conflicts/src/service.ts:286          → subject.confidential || cand.confidential
//   services/conflicts/src/overlap-service.ts:200  → pairConfidential (dasselbe ODER)
// Die Sperre ist richtig (sonst reiste der vertrauliche Kandidatentext zur Cloud); falsch war der TEXT.
//
// mega9 ersetzte ihn aber durch „Am Vergleich war vertrauliches Wissen beteiligt …" — und damit erfuhr
// der Leser, dass zu SEINEM Beitrag ein vertraulicher Vergleichspartner EXISTIERT und thematisch
// RELEVANT war. Das ist ein Existenz- und Relevanzsignal über geschützten Bestand, ausgeliefert an ein
// Board, das serverseitig schon mit `ko.read` abrufbar ist
// (services/app/src/routes/validation-routes.ts:25-33), während die Bibliotheks-Exportgrenze
// vertrauliche Inhalte an `ko.validate` bindet (services/app/src/routes/library-routes.ts:111-120).
//
// Dieser Test hält deshalb ZWEI Dinge fest:
//   (1) die EIGENE, dem Leser ohnehin sichtbare Stufe darf weiterhin benannt werden;
//   (2) der unprivilegierte Pfad darf über fremden Bestand NICHTS sagen — und zwar geprüft als
//       VOKABULAR-Ausschluss, nicht als Wortlaut-Pin. Ein künftiger Textautor, der wieder
//       „vertraulich"/„beteiligt"/„Vergleichspartner" schreibt, lässt diesen Test fallen, auch wenn er
//       den heutigen Satz vollständig neu formuliert.
import { describe, expect, it } from "vitest";
import type { Confidentiality } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import {
  aiCheckCardState,
  aiCheckFailureReasonKey,
} from "../../apps/web/src/lib/aiCheckStatusCard";

const FAILED_CONFIDENTIAL = {
  status: "failed",
  requestedAt: "2026-07-25T10:00:00.000Z",
  fallbackReason: "confidential",
} as const;

const LANGS = ["de", "en", "nl"] as const;

// Der neutrale Grund, den ein Leser OHNE Recht auf vertraulichen Bestand zu sehen bekommt.
const NEUTRAL_KEY = "val.aiCheck.reason.privacy-no-cloud";

// Wörter, die im unprivilegierten Grund NICHT vorkommen dürfen — Vereinigung über DE/EN/NL, damit
// keine Sprache durchrutscht. Sie zerfallen in zwei Klassen:
//   • Einstufungswörter: behaupten geschützten Bestand als solchen.
//   • Beziehungswörter: behaupten, dass ein ZWEITES Objekt existiert / beteiligt / relevant war.
// Beides ist genau das Signal, das SB-1 verbietet.
const FORBIDDEN_TERMS = [
  // Einstufung
  "vertraulich",
  "vertrouwelijk",
  "confidential",
  "geheim",
  "secret",
  "classified",
  "verschluss",
  // Beziehung / Existenz eines zweiten Objekts
  "vergleichspartner",
  "gegenstück",
  "gegenstueck",
  "tegenhanger",
  "counterpart",
  "beteiligt",
  "involved",
  "betrokken",
  "anderer beitrag",
  "anderes objekt",
  "another entry",
  "other entry",
  "andere bijdrage",
] as const;

function forbiddenHitsIn(text: string): string[] {
  const haystack = text.toLowerCase();
  return FORBIDDEN_TERMS.filter((term) => haystack.includes(term));
}

describe("Block E-3/mega11-A: der Grund nennt die eigene Stufe — und verrät keinen fremden Bestand", () => {
  it("vertrauliches Objekt → der bisherige, hier zutreffende Grund", () => {
    for (const level of ["vertraulich", "streng_vertraulich"] as Confidentiality[]) {
      expect(aiCheckFailureReasonKey("confidential", level)).toBe(
        "val.aiCheck.reason.confidential",
      );
    }
  });

  it("'Öffentlich-intern' (intern) → der neutrale Grund, nicht der Paar-Grund", () => {
    expect(aiCheckFailureReasonKey("confidential", "intern")).toBe(NEUTRAL_KEY);
  });

  it("unbekannte Stufe → ebenfalls der neutrale Grund (nichts über die Einstufung behaupten)", () => {
    expect(aiCheckFailureReasonKey("confidential", undefined)).toBe(NEUTRAL_KEY);
    expect(aiCheckFailureReasonKey("confidential", null)).toBe(NEUTRAL_KEY);
  });

  it("die Bestätigungs-Karte reicht die Stufe durch", () => {
    expect(aiCheckCardState(FAILED_CONFIDENTIAL, "intern")).toEqual({
      kind: "failed",
      reasonKey: NEUTRAL_KEY,
    });
    expect(aiCheckCardState(FAILED_CONFIDENTIAL, "vertraulich")).toEqual({
      kind: "failed",
      reasonKey: "val.aiCheck.reason.confidential",
    });
  });

  it("alle anderen Ursachen bleiben von der Stufe unberührt", () => {
    for (const reason of [
      "no-model",
      "timeout",
      "model-timeout",
      "queue-overflow",
      "auth",
      "rate-limit",
      "unreachable",
      "bad-response",
      undefined,
    ]) {
      expect(aiCheckFailureReasonKey(reason, "intern")).toBe(
        aiCheckFailureReasonKey(reason, "vertraulich"),
      );
    }
  });

  // ---- SB-1: der Ausschluss-Test, wortlautunabhängig -------------------------------------------

  it("SB-1: der unprivilegierte Grund verrät in DE/EN/NL weder Einstufung noch Vergleichspartner", () => {
    // Nicht gegen die Konstante geprüft, sondern gegen das, was die Produktionsfunktion für einen
    // nicht-vertraulichen bzw. unbekannten Beitrag TATSÄCHLICH liefert.
    for (const level of ["intern", undefined, null] as (Confidentiality | undefined | null)[]) {
      const key = aiCheckFailureReasonKey("confidential", level);
      // Auch der Schlüssel selbst muss neutral sein: fehlt die Übersetzung, rendert i18next den
      // ROHEN Schlüssel — ein „…confidential-pair" stünde dann wörtlich auf dem Board.
      expect(forbiddenHitsIn(key), `Schlüssel ${key}`).toEqual([]);
      for (const lng of LANGS) {
        const text = String(i18n.getFixedT(lng)(key));
        expect(text, `${lng}: Schlüssel ohne Übersetzung`).not.toBe(key);
        expect(forbiddenHitsIn(text), `${lng}: „${text}"`).toEqual([]);
      }
    }
  });

  it("SB-1: der neutrale Grund bleibt trotzdem ehrlich und unterscheidbar", () => {
    for (const lng of LANGS) {
      const t = i18n.getFixedT(lng);
      const neutral = String(t(NEUTRAL_KEY));
      // Kein Leerlaufen in einen nichtssagenden Satz — die Wirkung wird weiterhin benannt.
      expect(neutral.length, lng).toBeGreaterThan(60);
      // Und er tarnt sich nicht als Modellfehler (RT-001-Grenze: jede Ursache bleibt eigenständig).
      expect(neutral, lng).not.toBe(String(t("val.aiCheck.reason.model-error")));
      expect(neutral, lng).not.toBe(String(t("val.aiCheck.reason.no-model")));
      // Der privilegierte Eigen-Stufen-Grund bleibt ein ANDERER Text …
      expect(neutral, lng).not.toBe(String(t("val.aiCheck.reason.confidential")));
    }
  });

  it("die eigene Stufe darf weiterhin ausdrücklich benannt werden", () => {
    // Gegenprobe zur Ausschlussregel: sie gilt NUR für den unprivilegierten Pfad. Wer selbst
    // vertraulich eingestuft hat, sieht diese Einstufung ohnehin am eigenen Objekt.
    const own = String(i18n.getFixedT("de")("val.aiCheck.reason.confidential"));
    expect(own.toLowerCase()).toContain("vertraulich");
  });
});
