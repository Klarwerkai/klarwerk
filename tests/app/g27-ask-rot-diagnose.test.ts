// ================================================================================================
// G27 — DIAGNOSE DES ROTEN ASK-TESTS (tests/ask/ask-retrieval-topk-e2e.test.ts:87)
// ================================================================================================
//
// DER BEFUND, wie er im Auftrag steht: Zeile 87 erwartet `gesichert`, erhält im Teil-/Einzellauf
// reproduzierbar `ungeprueft`, war aber im Vollcheck desselben Tages grün.
//
// DIE URSACHE, gemessen und nicht vermutet: `buildServices()` baut den Cloud-Client über
// `createCappedCloudClientFromEnv(process.env, ...)` (services/app/src/build-app.ts). Fehlt
// `KLARWERK_SKIP_KEYCHAIN`, fällt die Schlüsselauflösung auf den macOS-Schlüsselbund zurück
// (`findCloudKeyInKeychain`, services/reasoner/src/model-client.ts). Auf einer Entwicklungs-
// maschine mit hinterlegtem Cloud-Schlüssel läuft der Vitest-Gate deshalb gegen ein ECHTES Modell.
//
// UND DANN GILT EINE ANDERE REGEL: der Modellweg (`ModelProvider.answer`) meldet ALLE
// herangezogenen Kandidaten als `sources` und leitet die Wissensklasse aus den vom Modell
// zurückgelesenen Marken ab (`answerStanding`, fail-closed: gesichert nur, wenn JEDE tragende
// Quelle validiert ist). Der Test legt neben dem validierten Ziel-KO eine inhaltsgleiche OFFENE
// Zwillingsfassung an — zitiert das Modell beide, ist die Klasse `ungeprueft`. Der deterministische
// Weg dagegen liefert genau EINE Quelle (`best`) und damit `gesichert`. Der Test kodiert die
// deterministische Zusage; er ist grün, WENN kein Modell verfügbar ist — und genau das erklärt
// beide beobachteten Zustände (Vollcheck grün = Modellaufruf fiel aus/lief nicht; Einzellauf rot =
// Modell antwortete).
//
// UND DAMIT IST DER BEFUND VOLLSTÄNDIG ERKLÄRT — ES IST DER AUFRUF, NICHT DER TEST:
//
//   · `./tools/test` (und damit `./tools/check`) setzt seit AUFTRAG-mega25 ausdrücklich
//     `export KLARWERK_SKIP_KEYCHAIN="${KLARWERK_SKIP_KEYCHAIN:-1}"` — der Lauf ist hermetisch,
//     der Reasoner deterministisch, und der Test ist GRÜN. Das ist der Vollcheck desselben Tages.
//   · Ein direktes `npx vitest run tests/ask/ask-retrieval-topk-e2e.test.ts` geht an `tools/test`
//     vorbei, die Variable fehlt, der Schlüsselbund wird befragt — und auf einer Maschine mit
//     hinterlegtem Schlüssel ist der Test ROT. Das ist der Teil-/Einzellauf.
//
// GEMESSEN (beide Richtungen, gleicher Arbeitsbaum, gleiche Minute):
//   rot:  npx vitest run tests/ask/ask-retrieval-topk-e2e.test.ts
//   grün: ./tools/test tests/ask/ask-retrieval-topk-e2e.test.ts
//   grün: npx vitest run --config _relay/messung/pro-g27-hermetisch.config.ts \
//           tests/ask/ask-retrieval-topk-e2e.test.ts
//
// ES WIRD DESHALB NICHTS GEÄNDERT: weder am Test (er kodiert die richtige, deterministische Zusage)
// noch am Produkt (es verhält sich korrekt). Die Korrektur ist eine Aussage über den AUFRUF —
// Teilläufe gehören durch `./tools/test`. Sie unübersehbar zu machen (z. B. `KLARWERK_SKIP_KEYCHAIN`
// in `tests/setup-env.ts`) wäre eine Harness-Entscheidung an Dateien AUSSERHALB des exklusiven
// Bereichs dieses Auftrags und steht als Empfehlung im Bericht.
//
// DIESE DATEI PRÜFT DEN MECHANISMUS, NICHT DIE MASCHINE: beide Zusicherungen gelten unabhängig
// davon, ob auf dem ausführenden Rechner ein Schlüssel im Schlüsselbund liegt.
import { describe, expect, it } from "vitest";
import { createCappedCloudClientFromEnv } from "../../services/reasoner/src/model-client";

describe("G27 · Diagnose: woher der Cloud-Schlüssel im Testlauf kommt", () => {
  it("ohne ENV-Schlüssel wird der Schlüsselbund befragt — MIT Treffer entsteht ein echter Cloud-Client", () => {
    // Injizierter Schlüsselbund (kein Zugriff auf den echten): der Aufruf fragt ihn, obwohl in der
    // Umgebung KEIN Schlüssel steht. Genau dieser Rückfall macht den Gate nicht-hermetisch.
    const befragt: string[] = [];
    const client = createCappedCloudClientFromEnv({} as NodeJS.ProcessEnv, (service, account) => {
      befragt.push(`${service}/${account}`);
      return "sk-ant-test-schluessel";
    });
    expect(befragt.length).toBeGreaterThan(0);
    expect(client, "mit Schlüsselbund-Treffer entsteht ein Cloud-Client").toBeDefined();
  });

  it("ohne Schlüsselbund-Treffer entsteht KEIN Cloud-Client (deterministischer Betrieb)", () => {
    const ohne = createCappedCloudClientFromEnv({} as NodeJS.ProcessEnv, () => undefined);
    expect(ohne).toBeUndefined();
  });

  it("die Kompositionswurzel schaltet den Schlüsselbund NUR über KLARWERK_SKIP_KEYCHAIN ab", async () => {
    const { readFileSync } = await import("node:fs");
    const build = readFileSync("services/app/src/build-app.ts", "utf8");
    expect(build).toContain("createCappedCloudClientFromEnv(");
    expect(build).toContain("process.env.KLARWERK_SKIP_KEYCHAIN");
  });

  it("der KANONISCHE Testlauf ist hermetisch — ein direktes `npx vitest run` ist es NICHT", async () => {
    const { readFileSync } = await import("node:fs");
    // `tools/test` (und über `tools/check` auch der Vollcheck) setzt den Schalter …
    expect(readFileSync("tools/test", "utf8")).toContain('export KLARWERK_SKIP_KEYCHAIN="${');
    // … die Vitest-Setup-Datei, die JEDER Lauf lädt, setzt ihn NICHT. Genau diese Lücke ist der
    // Unterschied zwischen „Vollcheck grün" und „Einzellauf rot".
    expect(readFileSync("tests/setup-env.ts", "utf8")).not.toContain("KLARWERK_SKIP_KEYCHAIN");
  });
});

describe("G27 · Diagnose: die zwei Regeln, zwischen denen der Test schwankt", () => {
  it("deterministisch ⇒ genau EINE Quelle und `gesichert`; Modellweg ⇒ alle Kandidaten als Quellen", async () => {
    const { answerStanding } = await import("../../services/reasoner/src/provider");
    const validiert = { status: "validiert" as const, trust: 90 };
    const offen = { status: "offen" as const, trust: 0 };
    // Deterministischer Weg: tragende Quelle ist genau `best` (das validierte Ziel-KO).
    expect(answerStanding([validiert]).knowledgeClass).toBe("gesichert");
    // Modellweg: zitiert das Modell auch die inhaltsgleiche OFFENE Zwillingsfassung, ist die
    // Klasse fail-closed `ungeprueft` — exakt der beobachtete Wert in Zeile 87.
    expect(answerStanding([validiert, offen]).knowledgeClass).toBe("ungeprueft");
  });

  it("der deterministische Provider meldet genau EINE Quelle, der Modellweg ALLE herangezogenen", async () => {
    const { readFileSync } = await import("node:fs");
    const deterministisch = readFileSync("services/reasoner/src/provider.ts", "utf8");
    const modell = readFileSync("services/reasoner/src/provider-model.ts", "utf8");
    expect(deterministisch).toContain("sources: [best.id]");
    expect(modell).toContain("sources: relevant.map((r) => r.id)");
  });
});
