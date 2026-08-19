// JOB 1113 · JOB-947-B3 — /health MACHT VERSION UND DEPLOY-COMMIT MASCHINENLESBAR.
//
// ================================================================================================
// DER BEFUND (JOB 947 D1, `RUECKGABE-PRO2-JOB-947-D1-COOLIFY-BELEG.md`, read-only gemessen)
// ================================================================================================
//
// JOB 947 nennt ihn **K-VAKUUM**, und der Satz trägt diesen ganzen Auftrag:
//
//   „Ein `/health`, das nur `{"status":"ok"}` liefert, kann NICHT unterscheiden, welcher Stand
//    antwortet. Eine Kalibrierung, die daran hängt, ist wertlos. Deshalb: die Positivprobe muss
//    den Commit oder die Version zurückgeben, sonst prüft sie nur, dass irgendetwas läuft."
//
// Dahinter steht ein konkreter, ungelöster Widerspruch (JOB 947 §2.4, W2): ein Dokument nennt als
// Livestand `v1.0.0-beta.1.4`, `apps/web/src/version.ts` trägt `1.0.0-beta.1.29` — und **es gibt
// keine Messung, die das entscheiden könnte.** Ebenso E1/E2/E5: „Coolify Success" belegt den
// Deploy-LAUF, nicht den Deploy-STAND. Nur bei Ship 9 (E3) wurde der ausgelieferte Commit einmal
// von Hand gegengelesen. Genau diesen Handgriff macht dieser Auftrag zur Abfrage.
//
// Ausgangslage, am gebundenen Base-Stand nachgemessen (nicht übernommen):
//   services/app/src/build-app.ts:921   app.get("/health", async () => ({ status: "ok" }));
//   package.json:3                      "version": "0.0.0"        ← Platzhalter, nicht der Stand
//   apps/web/src/version.ts:9           APP_VERSION = "1.0.0-beta.1.29"
//   Commit-Umgebungsvariable im Baum:   KEINE (0 Treffer für SOURCE_COMMIT/GIT_COMMIT/…)
//
// ================================================================================================
// WARUM DIE VERSION AUS `package.json` KOMMT UND NICHT AUS `version.ts` — GEMESSEN, NICHT GEWÄHLT
// ================================================================================================
//
// Der naheliegende Weg wäre, `APP_VERSION` direkt in den Server zu importieren. Das **bräche den
// Produktionscontainer**: `Dockerfile:37-38` kopiert in die Laufzeitstufe ausschliesslich
// `services` und `apps/web/dist` — **`apps/web/src` ist im Image nicht vorhanden.** `package.json`
// dagegen liegt dort (`Dockerfile:33`, davor `npm ci`). Die Quelle ist damit nicht Geschmack,
// sondern die einzige, die im Betrieb existiert.
//
// Der Preis ist eine zweite Stelle, an der eine Versionsnummer steht — und genau dagegen richtet
// sich A3 unten: die beiden müssen gleich sein, sonst wird die Suite rot. Ohne diesen Fall wäre
// `package.json` eine zweite Wahrheit statt einer Kopie.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { APP_VERSION } from "../../apps/web/src/version";
import { buildApp, buildServices } from "../../services/app/src/build-app";

/** Die im Produkt benannte Build-/Runtimequelle für den Deploy-Commit. */
const COMMIT_ENV = "KLARWERK_BUILD_COMMIT";

/** Was das Produkt ausgibt, wenn es den Commit NICHT kennt. Niemals ein erfundener Hash. */
const UNBEKANNT = "unbekannt";

interface HealthBody {
  status?: unknown;
  version?: unknown;
  commit?: unknown;
}

async function health(): Promise<{ code: number; body: HealthBody; roh: string }> {
  const app = buildApp(buildServices());
  const res = await app.inject({ method: "GET", url: "/health" });
  await app.close();
  return { code: res.statusCode, body: JSON.parse(res.body) as HealthBody, roh: res.body };
}

function paketVersion(): string {
  const roh = readFileSync(resolve(process.cwd(), "package.json"), "utf8");
  return String((JSON.parse(roh) as { version?: unknown }).version ?? "");
}

let vorher: string | undefined;

beforeEach(() => {
  vorher = process.env[COMMIT_ENV];
});

afterEach(() => {
  if (vorher === undefined) {
    delete process.env[COMMIT_ENV];
  } else {
    process.env[COMMIT_ENV] = vorher;
  }
});

describe("JOB 1113 · A1 · Kalibrierung: die Vorrichtung trifft wirklich /health", () => {
  it("der Endpunkt antwortet und trägt weiterhin seinen Status", async () => {
    // Ohne diesen Fall wären alle folgenden überbestimmt: ein 404 erfüllte „kein erfundener Hash"
    // mühelos, ohne dass irgendetwas geleistet wäre.
    delete process.env[COMMIT_ENV];
    const { code, body } = await health();
    expect(code).toBe(200);
    expect(body.status, "Der bestehende Vertrag `status: ok` ist gebrochen").toBe("ok");
  });
});

describe("JOB 1113 · A2 · SHAPE: die Antwort trägt Version und Commit", () => {
  it("beide Felder sind da und sind Zeichenketten", async () => {
    delete process.env[COMMIT_ENV];
    const { body } = await health();
    expect(
      typeof body.version,
      "/health nennt keine Version — dann kann niemand sagen, welcher Stand antwortet (JOB 947, K-VAKUUM)",
    ).toBe("string");
    expect(
      typeof body.commit,
      "/health nennt keinen Deploy-Commit — „Success“ belegt dann weiter nur den Lauf, nicht den Stand",
    ).toBe("string");
  });

  it("die Version ist nie leer", async () => {
    delete process.env[COMMIT_ENV];
    const { body } = await health();
    expect(String(body.version ?? "").trim()).not.toBe("");
  });
});

describe("JOB 1113 · A3 · QUELLE: die Version kommt aus package.json — und ist die EINE Wahrheit", () => {
  it("/health meldet genau die Version aus package.json", async () => {
    delete process.env[COMMIT_ENV];
    const { body } = await health();
    expect(body.version, "Die gemeldete Version stammt nicht aus der benannten Quelle").toBe(
      paketVersion(),
    );
  });

  it("package.json und apps/web/src/version.ts tragen dieselbe Version", async () => {
    // DER FALL, DER DIE ZWEITE WAHRHEIT VERHINDERT. `package.json` ist die einzige Quelle, die im
    // Produktionsimage existiert (Dockerfile:33 gegen :37-38); `version.ts` ist die, die der
    // Ship-Lauf hochzählt. Laufen sie auseinander, meldet /health einen Stand, den niemand pflegt.
    expect(
      paketVersion(),
      `package.json (${paketVersion()}) und APP_VERSION (${APP_VERSION}) sind auseinandergelaufen — /health meldete dann eine Version, die die Oberfläche nicht zeigt.`,
    ).toBe(APP_VERSION);
  });

  it("die Version ist nicht mehr der Platzhalter 0.0.0", async () => {
    expect(
      paketVersion(),
      "package.json trägt weiterhin den Platzhalter statt des Standes",
    ).not.toBe("0.0.0");
  });
});

describe("JOB 1113 · A4 · COMMIT: aus einer benannten Quelle, kontrolliert gesetzt", () => {
  it("der Wert aus der benannten Umgebungsvariablen erscheint unverändert", async () => {
    process.env[COMMIT_ENV] = "81ba93d";
    const { body } = await health();
    expect(body.commit, `Der Wert aus ${COMMIT_ENV} erreicht /health nicht`).toBe("81ba93d");
  });

  it("auch ein voller 40-stelliger Hash kommt unverändert an", async () => {
    const voll = "b7f3da71dabe6bdec9e231ac99de47e59b684e7a";
    process.env[COMMIT_ENV] = voll;
    const { body } = await health();
    expect(body.commit).toBe(voll);
  });
});

describe("JOB 1113 · A5 · EHRLICHKEIT: unbekannt bleibt unbekannt", () => {
  it("ohne gesetzte Quelle meldet /health `unbekannt`, nicht einen erfundenen Hash", async () => {
    delete process.env[COMMIT_ENV];
    const { body, roh } = await health();
    expect(body.commit, "Ein fehlender Commit wird nicht ehrlich als unbekannt gemeldet").toBe(
      UNBEKANNT,
    );
    // Und es steht auch nirgends sonst ein Hash-artiger Wert in der Antwort, der als Commit
    // durchgehen könnte — die Ehrlichkeit gilt für die ganze Antwort, nicht nur für ein Feld.
    expect(
      roh,
      "Die Antwort trägt eine hash-artige Zeichenkette, obwohl der Commit unbekannt ist",
    ).not.toMatch(/\b[0-9a-f]{7,40}\b/);
  });

  it("eine leere Quelle zählt als nicht gesetzt", async () => {
    process.env[COMMIT_ENV] = "   ";
    const { body } = await health();
    expect(body.commit).toBe(UNBEKANNT);
  });

  it("etwas, das kein Commit ist, wird nicht als Commit ausgegeben", async () => {
    // Ein Branchname, ein Tag oder ein Platzhalter aus einer halb verdrahteten Pipeline darf nicht
    // als Deploy-Commit erscheinen — das wäre derselbe Fehler wie ein erfundener Hash, nur
    // unauffälliger.
    for (const müll of ["main", "$SOURCE_COMMIT", "latest", "HEAD"]) {
      process.env[COMMIT_ENV] = müll;
      const { body } = await health();
      expect(body.commit, `„${müll}“ wird als Deploy-Commit ausgegeben`).toBe(UNBEKANNT);
    }
  });
});

describe("JOB 1113 · A6 · ZWEI BAUSTÄNDE SIND UNTERSCHEIDBAR", () => {
  it("zwei Builds mit verschiedenen Commits liefern verschiedene Antworten", async () => {
    // Das ist die eigentliche Zusage von JOB-947-B3: nach dem Deploy `/health` lesen und gegen den
    // gepushten Commit vergleichen. Kann die Antwort zwei Stände nicht unterscheiden, ist der
    // Vergleich wertlos — genau K-VAKUUM.
    process.env[COMMIT_ENV] = "aaaaaaa";
    const eins = await health();
    process.env[COMMIT_ENV] = "bbbbbbb";
    const zwei = await health();

    expect(eins.body.commit).toBe("aaaaaaa");
    expect(zwei.body.commit).toBe("bbbbbbb");
    expect(
      eins.body.commit === zwei.body.commit,
      "Zwei verschiedene Baustände liefern dieselbe Antwort — /health kann sie nicht unterscheiden",
    ).toBe(false);
    expect(eins.roh, "Die ganzen Antwortkörper sind identisch").not.toBe(zwei.roh);
  });

  it("die Version bleibt dabei stabil — sie hängt nicht am Commit", async () => {
    process.env[COMMIT_ENV] = "aaaaaaa";
    const eins = await health();
    process.env[COMMIT_ENV] = "bbbbbbb";
    const zwei = await health();
    // Die Nichtleerheit steht hier VOR dem Vergleich, und das ist kein Zierat: fehlten beide
    // Versionen, wäre `undefined === undefined` wahr und der Fall am Base-Stand grün, obwohl
    // /health gar keine Version kennt. Ein Fall, der ohne die Wirkung grün bleibt, zählt nicht.
    expect(String(eins.body.version ?? "").trim()).not.toBe("");
    expect(eins.body.version).toBe(zwei.body.version);
  });
});
