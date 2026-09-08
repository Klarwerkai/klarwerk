// ================================================================================================
// JOB 3268 · D1-R · RUNDE 2 — „UNBEKANNT“ IST KEINE NEUE VERSION (gegen den ECHTEN Serverwert).
// ================================================================================================
//
// BENS BEFUND AN RUNDE 1 (Korrekturpflicht 1): der Wächter nahm jede nichtleere abweichende
// Zeichenkette als neue Lieferung. `/health` gibt aber einen ausdrücklichen ERSATZWERT aus, wenn
// der Server seine eigene Version nicht lesen kann — `buildVersion()` liefert dann
// `BUILD_UNBEKANNT` (`services/app/src/build-app.ts:966-979`). Aus „ich weiss es nicht“ wurde
// „es gibt eine neue Version“.
//
// WARUM DIESER TEST NEBEN DEN GEMOUNTETEN FÄLLEN STEHT: dort ist der Serverwert NACHGESTELLT — ein
// Testautor kann sich vertippen, und der Fall wäre trotzdem grün. Hier kommt der Wert aus der
// ECHTEN Quelle: der Test importiert die Serverkonstante selbst. Läuft der Server morgen auf einen
// anderen Ersatzwert, fällt DIESER Fall — nicht Pedis Tab.
//
// Das ist zugleich der Grund, warum in `apps/web/src/lib/versionswaechter.ts` KEIN abgeschriebenes
// `"unbekannt"` steht: `apps/web` darf `services/**` nicht importieren (dependency-cruiser), und
// eine Kopie wäre eine zweite Wahrheit. Die Regel dort ist eine FORMPRÜFUNG; dieser Test beweist,
// dass sie den echten Wert wirklich trifft.
//
// WARUM `.tsx` OHNE JSX (dieselbe Bauform wie `tests/m3-dokumentweg-panel/quellenfund-im-panel.tsx`,
// JOB 3243): die Wurzel-Typprüfung ist absichtlich Node-rein und schliesst `tests/**/*.tsx` aus
// (`tsconfig.json:23-27`). Eine `.ts`-Datei hier zöge `versionswaechter.ts` — das `document` und
// `fetch` benutzt — in genau diesen Node-reinen Lauf; gemessen: drei `TS2584: Cannot find name
// 'document'`. Der Lauf bleibt node (kein jsdom nötig, `versionsbefund` ist reine Rechnung).
import { describe, expect, it } from "vitest";
import { versionsbefund } from "../../apps/web/src/lib/versionswaechter";
import { APP_VERSION } from "../../apps/web/src/version";
import { BUILD_UNBEKANNT, buildVersion } from "../../services/app/src/build-app";

describe("JOB 3268 D1-R R2 · der Ersatzwert des Servers löst keinen Hinweis aus", () => {
  it("U1 · der ECHTE Serverwert für „unbekannt“ ergibt die Lage „unbekannt“, nicht „neu“", () => {
    expect(
      BUILD_UNBEKANNT,
      "der Ersatzwert des Servers ist leer — dann misst dieser Fall nichts",
    ).not.toBe("");
    expect(BUILD_UNBEKANNT).not.toBe(APP_VERSION);
    const befund = versionsbefund(APP_VERSION, BUILD_UNBEKANNT);
    expect(befund.lage, `„${BUILD_UNBEKANNT}“ wurde als neue Lieferung gelesen`).toBe("unbekannt");
  });

  it("U2 · die echte ausgelieferte Version des Servers ergibt „gleich“", () => {
    // Die Gegenrichtung, ohne die U1 auch dann grün wäre, wenn NIE etwas als „neu“ gilt: der Stand,
    // den dieser Server wirklich meldet (`package.json`), ist für die geladene Oberfläche
    // (`APP_VERSION`) derselbe. Dass beide Quellen dieselbe Nummer tragen, erzwingt
    // `tests/app/health-version-commit.test.ts`; hier wird das URTEIL des Wächters darüber gemessen.
    expect(buildVersion()).toBe(APP_VERSION);
    expect(versionsbefund(APP_VERSION, buildVersion()).lage).toBe("gleich");
  });

  it("U3 · eine echte, abweichende Versionsnummer ist weiterhin „neu“", () => {
    // Und die dritte Richtung: die Formprüfung darf den Normalfall nicht miterschlagen.
    const befund = versionsbefund(APP_VERSION, "1.0.0-beta.1.999");
    expect(befund.lage).toBe("neu");
    expect(befund.lage === "neu" ? befund.live : null).toBe("1.0.0-beta.1.999");
  });

  it("U4 · Platzhalter fremder Bauart fallen unter dieselbe Regel", () => {
    // Die Formprüfung ist keine Wortliste. Was eine Auslieferungskette sonst noch durchreicht —
    // ein uneingesetzter Ausdruck, ein Marken- oder Zweigname —, ist ebenfalls kein Stand.
    for (const platzhalter of ["unknown", "latest", "$VERSION", "main", "n/a", "   "]) {
      expect(
        versionsbefund(APP_VERSION, platzhalter).lage,
        `„${platzhalter}“ galt als Version`,
      ).toBe("unbekannt");
    }
    expect(versionsbefund(APP_VERSION, undefined).lage).toBe("unbekannt");
    expect(versionsbefund(APP_VERSION, 194).lage).toBe("unbekannt");
  });
});
