// ================================================================================================
// JOB 3001 — DIE DURCHREICHUNG DES DEPLOY-COMMITS INS IMAGE, FESTGENAGELT.
// ================================================================================================
//
// DER BEFUND (am gebundenen Basisstand `cb91cc0` nachgemessen):
//   services/app/src/build-app.ts:855   BUILD_COMMIT_ENV = "KLARWERK_BUILD_COMMIT"
//   Dockerfile (Laufzeitstufe)          setzte NUR `NODE_ENV` und `PORT`
//
// JOB 1113 hat `/health` beigebracht, den Commit aus `KLARWERK_BUILD_COMMIT` zu melden. Nur setzte
// diese Variable niemand: die Laufzeitstufe des Images kannte sie nicht. Live stand deshalb
// zwangsläufig `"commit": "unbekannt"` — der Endpunkt war richtig, die Kette davor war nicht da.
//
// WAS DIESER WÄCHTER PRÜFT — UND WAS ER AUSDRÜCKLICH NICHT KANN.
//
// ER PRÜFT die **Kette im Repo**: dass das Dockerfile ein Build-Argument annimmt und es in der
// Laufzeitstufe an genau den Namen weitergibt, den `build-app.ts` liest. Das ist eine Aussage über
// den getrackten Baum — nachprüfbar, ohne Netz und ohne Docker.
//
// ER KANN NICHT prüfen, ob die Auslieferung dieses Argument wirklich reicht, und unter welchem
// Namen. Das ist Plattformzustand ausserhalb des Repos und im Baum NICHT gemessen (JOB 947 §5.1
// hält für dieselbe Frage ausdrücklich fest, dass dort nichts gemessen wurde). `SOURCE_COMMIT` ist
// deshalb eine ANNAHME; der Wächter nagelt sie fest, damit sie sichtbar bleibt und nicht still
// verschwindet — er erklärt sie nicht zur Messung.
//
// DIE ENV-NAMENSBINDUNG IST DER KERN: Der erwartete Name wird NICHT als zweites Literal in diesen
// Test geschrieben, sondern aus `BUILD_COMMIT_ENV` importiert. Sonst wäre der Test bei einer
// Umbenennung im Produkt weiter grün, während das Image ins Leere setzte.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUILD_COMMIT_ENV, BUILD_UNBEKANNT, buildCommit } from "../../services/app/src/build-app";
import { repoPfad } from "../support/repoPfad";

/** Der Name des Build-Arguments, unter dem die Auslieferung den Commit reichen soll. */
const BUILD_ARG = "SOURCE_COMMIT";

const dockerfile = readFileSync(repoPfad("Dockerfile"), "utf8");
const zeilen = dockerfile.split("\n");

/** Index der Zeile, die die Laufzeitstufe eröffnet — ab hier gilt, was im Betrieb ankommt. */
function laufzeitStufeAb(): number {
  const index = zeilen.findIndex((z) => /^\s*FROM\b.*\bAS\s+runtime\b/i.test(z));
  expect(
    index,
    "Das Dockerfile hat keine als `runtime` benannte Stufe mehr — dann ist unklar, welche Stufe im Betrieb läuft.",
  ).toBeGreaterThanOrEqual(0);
  return index;
}

/** Alle Anweisungszeilen (ohne Kommentare/Leerzeilen) ab der Laufzeitstufe. */
function laufzeitAnweisungen(): string[] {
  return zeilen
    .slice(laufzeitStufeAb())
    .map((z) => z.trim())
    .filter((z) => z !== "" && !z.startsWith("#"));
}

/** Der zusammenhängende Kommentarblock unmittelbar VOR einer Anweisungszeile. */
function kommentarVor(index: number): string {
  const gesammelt: string[] = [];
  for (let i = index - 1; i >= 0; i -= 1) {
    const zeile = (zeilen[i] ?? "").trim();
    if (zeile.startsWith("#")) {
      gesammelt.unshift(zeile);
      continue;
    }
    break;
  }
  return gesammelt.join("\n");
}

describe("JOB 3001 · das Image nimmt den Deploy-Commit an und reicht ihn an die Laufzeit", () => {
  it(`die Laufzeitstufe deklariert \`ARG ${BUILD_ARG}=""\``, () => {
    // ARG gilt in Docker JE STUFE. Stünde die Deklaration nur global vor dem ersten FROM, wäre sie
    // in der Laufzeitstufe nicht in Reichweite und das ENV bekäme einen leeren Wert — grün im Text,
    // wirkungslos im Betrieb. Deshalb wird die Lage mitgeprüft, nicht nur das Vorkommen.
    const treffer = laufzeitAnweisungen().filter((z) =>
      new RegExp(`^ARG\\s+${BUILD_ARG}=""$`).test(z),
    );
    expect(
      treffer,
      `Die Laufzeitstufe des Dockerfile deklariert \`ARG ${BUILD_ARG}=""\` nicht — dann kann die Auslieferung keinen Commit hineinreichen und /health meldet dauerhaft "${BUILD_UNBEKANNT}".`,
    ).toHaveLength(1);
  });

  it(`die Laufzeitstufe setzt \`ENV ${BUILD_COMMIT_ENV}=$${BUILD_ARG}\``, () => {
    // Der Name links ist der Vertrag aus `build-app.ts` (importiert, nicht abgeschrieben); der Name
    // rechts ist das Build-Argument von oben. Beide zusammen sind die Durchreichung.
    const treffer = laufzeitAnweisungen().filter((z) =>
      new RegExp(`^ENV\\s+${BUILD_COMMIT_ENV}=\\$\\{?${BUILD_ARG}\\}?$`).test(z),
    );
    expect(
      treffer,
      `Die Laufzeitstufe setzt \`${BUILD_COMMIT_ENV}\` nicht aus \`${BUILD_ARG}\` — genau hier reisst die Kette zwischen Auslieferung und /health.`,
    ).toHaveLength(1);
  });

  it("die beiden Zeilen stehen in der richtigen Reihenfolge — erst ARG, dann ENV", () => {
    // Umgekehrt löste Docker `$SOURCE_COMMIT` gegen ein noch nicht deklariertes Argument auf: leer.
    const anweisungen = laufzeitAnweisungen();
    const arg = anweisungen.findIndex((z) => z.startsWith(`ARG ${BUILD_ARG}`));
    const env = anweisungen.findIndex((z) => z.startsWith(`ENV ${BUILD_COMMIT_ENV}=`));
    expect(arg, `\`ARG ${BUILD_ARG}\` fehlt in der Laufzeitstufe`).toBeGreaterThanOrEqual(0);
    expect(env, `\`ENV ${BUILD_COMMIT_ENV}\` fehlt in der Laufzeitstufe`).toBeGreaterThanOrEqual(0);
    expect(
      arg,
      "Das ENV steht vor dem ARG — Docker setzte dann einen leeren Wert ein.",
    ).toBeLessThan(env);
  });

  it("der Commit-Name taucht im Dockerfile nur an dieser einen Stelle auf", () => {
    // Zwei Stellen wären zwei Wahrheiten: die zweite überschriebe stumm die erste.
    const gesetzt = zeilen.filter(
      (z) => !z.trim().startsWith("#") && z.includes(`${BUILD_COMMIT_ENV}=`),
    );
    expect(gesetzt, `\`${BUILD_COMMIT_ENV}\` wird mehrfach gesetzt`).toHaveLength(1);
  });
});

describe("JOB 3001 · der Kommentar sagt, dass der Argumentname eine Annahme ist", () => {
  const argIndex = zeilen.findIndex((z) => new RegExp(`^\\s*ARG\\s+${BUILD_ARG}=`).test(z));

  it("vor der ARG-Zeile steht überhaupt ein Kommentar", () => {
    expect(argIndex, `\`ARG ${BUILD_ARG}\` fehlt im Dockerfile`).toBeGreaterThanOrEqual(0);
    expect(
      kommentarVor(argIndex).length,
      "Die Zeilen stehen unkommentiert da — der nächste Leser hielte den Namen für gemessen.",
    ).toBeGreaterThan(0);
  });

  it("er benennt den Namen ausdrücklich als Annahme über die Auslieferung", () => {
    const kommentar = kommentarVor(argIndex).toLowerCase();
    expect(
      kommentar.includes("annahme"),
      `Der Kommentar nennt \`${BUILD_ARG}\` nicht als Annahme — dann behauptet das Dockerfile Plattformverhalten, das im Baum nicht gemessen ist.`,
    ).toBe(true);
    expect(kommentar).toContain(BUILD_ARG.toLowerCase());
  });

  it("er sagt, was bei fehlendem oder unbrauchbarem Wert geschieht", () => {
    const kommentar = kommentarVor(argIndex).toLowerCase();
    expect(
      kommentar.includes(BUILD_UNBEKANNT),
      `Der Kommentar sagt nicht, dass ein fehlender oder unbrauchbarer Wert zu "${BUILD_UNBEKANNT}" wird.`,
    ).toBe(true);
    expect(
      kommentar.includes("buildcommit"),
      "Der Kommentar nennt die Stelle nicht, die den Wert prüft (`buildCommit()` in build-app.ts).",
    ).toBe(true);
  });
});

// ================================================================================================
// DIE GEGENPROBE ZUR LEEREN KETTE — die Annahme darf nicht in eine Falschaussage kippen.
// ================================================================================================
//
// Reicht die Auslieferung nichts (oder reicht sie den Namen uneingesetzt durch, weil sie das
// Argument gar nicht kennt), setzt das ENV oben einen leeren bzw. wörtlichen Wert. Genau dann muss
// `buildCommit()` bei `unbekannt` bleiben. Über `/health` steht derselbe Nachweis bereits in
// `tests/app/health-version-commit.test.ts` (A5, Fälle „eine leere Quelle zählt als nicht gesetzt"
// und „$SOURCE_COMMIT"); hier steht er an der Funktion — mit dem exakt LEEREN Wert, den ein
// unbesetztes `ARG SOURCE_COMMIT=""` erzeugt.
describe("JOB 3001 · eine leere oder uneingesetzte Durchreichung bleibt ehrlich unbekannt", () => {
  it("der leere Wert aus einem unbesetzten Build-Argument liefert `unbekannt`", () => {
    expect(buildCommit({ [BUILD_COMMIT_ENV]: "" })).toBe(BUILD_UNBEKANNT);
  });

  it("ein uneingesetztes `$SOURCE_COMMIT` wird nicht als Commit ausgegeben", () => {
    expect(buildCommit({ [BUILD_COMMIT_ENV]: `$${BUILD_ARG}` })).toBe(BUILD_UNBEKANNT);
  });

  it("ein echter Hash aus derselben Kette kommt dagegen unverändert an", () => {
    // Ohne diesen Fall wären die beiden oben auch für ein `buildCommit()` grün, das immer
    // `unbekannt` liefert — die Kette wäre dann nachweisfrei tot.
    expect(buildCommit({ [BUILD_COMMIT_ENV]: "cb91cc0" })).toBe("cb91cc0");
  });
});
