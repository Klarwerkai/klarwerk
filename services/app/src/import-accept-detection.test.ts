import { afterEach, beforeEach, describe, expect, it } from "vitest";
// JOB 3050: die beiden Kennzahlen, an denen der Überschneidungsfall unten hängt — hier NUR gemessen
// (die Schwellen selbst liegen unverändert in `conflicts` bzw. der Kompositionswurzel).
import { coreText, lexicalOverlapScore, trigramSimilarity } from "../../conflicts";
import { buildApp, buildServices } from "./build-app";

// SCRUM-470 (S6, HTTP end-to-end): Ein akzeptierter Import-Kandidat, der einem bestehenden KO
// widerspricht, muss — wie ein promoteter Entwurf im Einreiche-Pfad — auf Widerspruch geprüft werden
// und darf NICHT still angenommen werden. Diskriminierend: bei ausgeschaltetem Feature-Flag entsteht
// KEIN Konflikt (Beweis, dass genau die neue Verdrahtung ihn erzeugt, nicht ein Nebeneffekt).
//
// Deterministisch ohne echtes Modell: der Reasoner ist ohne KI ein ehrlicher No-op (judgeConflict→null),
// deshalb wird judgeConflict für den Test mit einem festen „widerspruch"-Urteil überschrieben. Die
// Belegzitate sind wörtliche Teilstücke der jeweiligen Kerntexte (G-2-Gate greift echt).

const ENV_KEYS = ["KLARWERK_CONFLUENCE_IMPORT", "KLARWERK_SKIP_KEYCHAIN"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
  }
  // Keychain im Test aus (kein echter Model-Client, deterministisch). Das Import-Flag setzt jeder
  // Test selbst — genau das ist der diskriminierende Unterschied.
  process.env.KLARWERK_SKIP_KEYCHAIN = "1";
  delete process.env.KLARWERK_CONFLUENCE_IMPORT;
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = saved[k];
    }
  }
});

// Kerntexte so gewählt, dass die (festen) Belegzitate wörtlich enthalten sind.
const EXISTING = {
  title: "Urlaubsanspruch",
  statement: "Der Urlaub betraegt 28 Tage pro Jahr.",
  type: "best_practice" as const,
  category: "Personal",
};
const IMPORTED = {
  title: "Urlaubsregelung",
  statement: "Der Urlaub betraegt 30 Tage pro Jahr.",
  type: "best_practice" as const,
  category: "Personal",
  // SCRUM-509 R3: Import ist per Default „vertraulich" → vertrauliche KOs überspringen die (Cloud-)
  // Konflikt-/Duplikat-Erkennung (Schicht 1, SCRUM-502). Für diesen Erkennungs-Test bewusst „intern".
  confidentiality: "intern" as const,
};

async function setup() {
  const services = buildServices();
  // Festes „widerspruch"-Urteil: zitat_a aus A (Subjekt = akzeptiertes KO, „30 Tage"), zitat_b aus B
  // (Bestand, „28 Tage"). Beide sind wörtliche Teilstücke → das G-2-Gate lässt den Konflikt zu.
  //
  // AUFTRAG-mega29 A1: die Accept-Kante läuft seitdem über DENSELBEN Runner wie der Hintergrund-
  // Worker — und der befragt den strukturierten Ergebnis-Vertrag (judgeConflictOutcome), nicht die
  // Bestandsfassade. Der Fake bildet deshalb BEIDE Flächen ab, exakt wie der echte Reasoner
  // (die Fassade reicht nur `.verdict` weiter). Genau dieser Unterschied war bens M28-1.
  const verdict = {
    relation: "widerspruch" as const,
    older: null,
    confidence: 0.95,
    begruendung: "Test: 30 Tage widersprechen 28 Tage.",
    zitat_a: "30 Tage",
    zitat_b: "28 Tage",
  };
  services.reasoner.judgeConflictOutcome = async () => ({ verdict });
  services.reasoner.judgeConflict = async () => verdict;

  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  return { app, headers };
}

async function createExistingKo(
  app: Awaited<ReturnType<typeof setup>>["app"],
  headers: Record<string, string>,
) {
  const res = await app.inject({ method: "POST", url: "/api/kos", headers, payload: EXISTING });
  expect(res.statusCode).toBe(201);
}

async function acceptImportedCandidate(
  app: Awaited<ReturnType<typeof setup>>["app"],
  headers: Record<string, string>,
): Promise<string> {
  const created = await app.inject({
    method: "POST",
    url: "/api/library/import/candidates",
    headers,
    payload: { items: [IMPORTED] },
  });
  expect(created.statusCode).toBe(201);
  const candidate = created.json()[0];
  expect(candidate.duplicate).toBe(false);

  const accepted = await app.inject({
    method: "PUT",
    url: `/api/library/import/candidates/${candidate.id}`,
    headers,
    payload: { action: "accept" },
  });
  expect(accepted.statusCode).toBe(200);
  // Der Kandidat wird ordentlich angenommen — der Konflikt blockiert das Annehmen NIE.
  expect(accepted.json().status).toBe("angenommen");
  const koId = accepted.json().koId as string;
  expect(koId).toBeTruthy();
  return koId;
}

describe("SCRUM-470 (S6): Erkennung am Import-Accept-Pfad (HTTP end-to-end)", () => {
  it("Flag AN: akzeptierter, widersprechender Import-Kandidat erzeugt einen Konflikt", async () => {
    process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
    const { app, headers } = await setup();

    await createExistingKo(app, headers);
    const koId = await acceptImportedCandidate(app, headers);

    // Der Konflikt ist end-to-end unter /api/conflicts sichtbar und bezieht das akzeptierte KO ein.
    const list = await app.inject({ method: "GET", url: "/api/conflicts", headers });
    expect(list.statusCode).toBe(200);
    const conflicts = list.json() as { koA: string; koB: string; status: string }[];
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts.some((c) => c.koA === koId || c.koB === koId)).toBe(true);
    await app.close();
  });

  it("Flag AUS: derselbe akzeptierte Kandidat erzeugt KEINEN Konflikt (diskriminierend)", async () => {
    delete process.env.KLARWERK_CONFLUENCE_IMPORT;
    const { app, headers } = await setup();

    await createExistingKo(app, headers);
    await acceptImportedCandidate(app, headers);

    // Ohne Flag bleibt der Import-Accept-Pfad ohne Erkennung — kein Konflikt (heutiges Verhalten).
    const list = await app.inject({ method: "GET", url: "/api/conflicts", headers });
    expect(list.statusCode).toBe(200);
    expect((list.json() as unknown[]).length).toBe(0);
    await app.close();
  });

  // Analog für Duplikate: der Import-Accept-Pfad reicht auch die (deterministische, modellfreie)
  // Überschneidungs-Erkennung durch → Überschneidung unter /api/duplicates.
  //
  // ==============================================================================================
  // JOB 3050 · NACHGEFÜHRT — DIE VORBEDINGUNG DIESES FALLS WAR EIN PRODUKTFEHLER.
  // ==============================================================================================
  //
  // Bis JOB 3050 lautete sie: „Kandidat mit INHALTSGLEICHER Aussage (anderer Titel → NICHT als
  // Kandidat-Dublette markiert, es entsteht also ein echtes KO)". Genau das ist der Defekt, gegen
  // den JOB 3050 steht: `createImportCandidates` entschied „Dublette" über Zeichengleichheit von
  // `title|statement`, also ging derselbe Text unter umgestelltem Titel als NEU durch und der
  // `accept` legte die zweite Karteikarte an. Seither prüft der Kandidatenweg mit derselben Regel
  // wie der direkte Import (`coreText` + `trigramSimilarity`, Schwelle 0,85) — ein wortgleicher
  // Text mit umgestelltem Titel IST eine Dublette und erzeugt kein KO mehr.
  //
  // DER FALL BLEIBT DERSELBE, nur mit einer Vorbedingung, die das Produkt hergibt: gleicher Titel,
  // ERWEITERTE Aussage. Das klassische Überschneidungsmuster — dieselbe Sache, ein Satzteil mehr —
  // liegt ÜBER der Überschneidungsschwelle (lexicalOverlapScore 0,865 ≥ 0,85 → deterministischer
  // Eintrag ohne Modell) und UNTER der Re-Import-Schwelle (0,766 < 0,85 → keine Dublette, der
  // Kandidat trägt echten Zusatzinhalt). Beide Werte sind unten gepinnt: verschiebt jemand eine
  // der zwei Schwellen, wird HIER mit Namen rot, statt dass der Fall still nichts mehr prüft.
  it("Flag AN: akzeptierter, ueberschneidender Import-Kandidat erzeugt eine Überschneidung", async () => {
    process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
    const { app, headers } = await setup();

    const TITEL = "Pumpe entlueften";
    const BESTAND = "Nach dem Anfahren zehn Sekunden warten, danach die Pumpe entlueften.";
    const KANDIDAT =
      "Nach dem Anfahren zehn Sekunden warten, danach die Pumpe entlueften und den Befund vermerken.";
    const alsSubjekt = (statement: string) => ({
      refId: "job3050-messung",
      title: TITEL,
      statement,
      conditions: [] as string[],
      measures: [] as string[],
      tags: [] as string[],
    });
    // DIE ZWEI SCHWELLEN, an denen dieser Fall hängt — gemessen, nicht geglaubt.
    expect(
      lexicalOverlapScore(alsSubjekt(BESTAND), alsSubjekt(KANDIDAT)),
      "Über der Überschneidungsschwelle (DUP_DETERMINISTIC_THRESHOLD) — sonst entsteht kein Eintrag.",
    ).toBeGreaterThanOrEqual(0.85);
    expect(
      trigramSimilarity(coreText(alsSubjekt(BESTAND)), coreText(alsSubjekt(KANDIDAT))),
      "Unter der Re-Import-Schwelle (RE_IMPORT_DUBLETTE_AB) — sonst wäre der Kandidat eine Dublette.",
    ).toBeLessThan(0.85);

    const base = { type: "best_practice" as const, category: "Wartung" };
    const createdKo = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: { ...base, title: TITEL, statement: BESTAND },
    });
    expect(createdKo.statusCode).toBe(201);

    const cand = await app.inject({
      method: "POST",
      url: "/api/library/import/candidates",
      headers,
      // SCRUM-509 R3: bewusst „intern", damit die Duplikat-Erkennung läuft (vertraulich → übersprungen).
      payload: {
        items: [{ ...base, title: TITEL, statement: KANDIDAT, confidentiality: "intern" }],
      },
    });
    expect(cand.statusCode).toBe(201);
    expect(
      cand.json()[0].duplicate,
      "Der Kandidat trägt echten Zusatzinhalt — er ist keine Dublette und wird ein KO.",
    ).toBe(false);
    const accepted = await app.inject({
      method: "PUT",
      url: `/api/library/import/candidates/${cand.json()[0].id}`,
      headers,
      payload: { action: "accept" },
    });
    expect(accepted.json().status).toBe("angenommen");
    expect(accepted.json().koId).toBeTruthy();

    const list = await app.inject({ method: "GET", url: "/api/duplicates", headers });
    expect(list.statusCode).toBe(200);
    expect((list.json() as unknown[]).length).toBeGreaterThan(0);
    await app.close();
  });
});
