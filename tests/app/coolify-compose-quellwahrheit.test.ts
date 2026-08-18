// ================================================================================================
// JOB 1107 / D1 — DIE COMPOSE-DATEI BEHAUPTET NICHT LÄNGER, COOLIFYS DEPLOY-QUELLE ZU SEIN.
// ================================================================================================
//
// DER BEFUND (JOB 947 D1, `RUECKGABE-PRO2-…-COOLIFY-BELEG.md`, Widerspruch **W1**):
//
//   Seite A — `docker-compose.prod.yml:1`: „Produktions-Setup … **Für Coolify** oder einen
//             Ein-Befehl-Deploy"
//   Seite B — `docs/boss-assistant/contradictions.md:205-207`: „Coolify deployt über das
//             **Dockerfile** … die Compose-Datei ist **NICHT** die Deploy-Quelle"
//
// Und die Begründung, warum das nicht bloss unsauber ist (JOB 947 §2.4): „**W1 ist der praktisch
// gefährlichste:** wer die Compose-Datei ändert, um den Live-Betrieb zu beeinflussen, ändert
// nichts — und merkt es erst, wenn eine Erwartung nicht eintritt."
//
// BEN4 hat denselben Fall als Prüflücke (2) benannt: „Dokumentationstest/Lint für
// `docker-compose.prod.yml`, Fall Kopfkommentar darf Coolify-Deploy-Quelle nicht falsch behaupten,
// erwartetes Ergebnis: Compose ist als nicht maßgebliche Coolify-Quelle gekennzeichnet."
//
// ================================================================================================
// WAS DIESER WÄCHTER PRÜFT — UND WAS ER AUSDRÜCKLICH NICHT KANN.
// ================================================================================================
//
// ER PRÜFT die **Quellwahrheit im Repo**: dass der Kopf der Compose-Datei sich nicht als Coolifys
// Deploy-Quelle ausgibt, das Dockerfile als solche benennt, und dass beide Seiten von W1 dieselbe
// Aussage tragen. Das ist eine Aussage über den getrackten Baum — nachprüfbar, ohne Netz.
//
// ER KANN NICHT prüfen, worüber Coolify tatsächlich deployt. Das ist Laufzeit-/Plattformzustand
// ausserhalb des Repos; JOB 947 §5.1 hält ausdrücklich fest, dass dort nichts gemessen wurde.
// Dieser Wächter übernimmt die belegte Lage aus `contradictions.md` als **Repo-Wahrheit** und hält
// die Compose-Datei dagegen konsistent — er erklärt sie nicht zur Betriebsmessung.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Vitest läuft mit der Repo-Wurzel als Arbeitsverzeichnis (`vitest.config.ts`).
const COMPOSE = "docker-compose.prod.yml";
const CONTRADICTIONS = "docs/boss-assistant/contradictions.md";
const DOCKERFILE = "Dockerfile";

/** Der zusammenhängende Kommentarblock am Dateianfang — dort steht die Selbstbeschreibung. */
function kopfkommentar(inhalt: string): string {
  const zeilen: string[] = [];
  for (const zeile of inhalt.split("\n")) {
    if (!zeile.startsWith("#")) {
      break;
    }
    zeilen.push(zeile);
  }
  return zeilen.join("\n");
}

// ================================================================================================
// DIE REGEL, ALS REINE FUNKTION — damit sie kalibrierbar ist, ohne das Produkt zu mutieren.
// ================================================================================================
//
// Bewusst NICHT „der Kopf enthält Satz X". Ein fester Satz wäre in dem Moment wertlos, in dem
// jemand ihn umformuliert — und genau dann soll der Wächter noch tragen. Geprüft wird die
// AUSSAGE in drei Teilen:
//
//   1. Nennt der Kopf Coolify überhaupt? Wenn nein, behauptet er auch nichts — dann ist nur die
//      Dockerfile-Zuordnung offen (Teil 3 greift trotzdem, damit die Wahrheit nicht verschwindet).
//   2. Wenn ja, muss er Compose ausdrücklich VON der Deploy-Quelle trennen (eine Verneinung im
//      selben Kopf, die „Deploy-Quelle" betrifft).
//   3. Und er muss das Dockerfile als die Quelle benennen, über die Coolify baut.
interface Quellwahrheit {
  nenntCoolify: boolean;
  verneintComposeAlsQuelle: boolean;
  nenntDockerfileAlsQuelle: boolean;
}

function quellwahrheit(kopf: string): Quellwahrheit {
  const k = kopf.toLowerCase();
  const nenntCoolify = k.includes("coolify");
  // Eine Verneinung, die die Deploy-Quelle betrifft: „nicht … deploy-quelle" in beliebiger
  // Reihenfolge innerhalb desselben Kopfes, tolerant gegenüber Umbruch und Formulierung.
  const verneintComposeAlsQuelle =
    /\bnicht\b/.test(k) && /deploy-?quelle/.test(k) && !/\bist die deploy-?quelle\b/.test(k);
  const nenntDockerfileAlsQuelle = k.includes("dockerfile");
  return { nenntCoolify, verneintComposeAlsQuelle, nenntDockerfileAlsQuelle };
}

/** Trägt der Kopf eine wahrheitsgemässe Quellzuordnung? */
function istQuellwahr(kopf: string): boolean {
  const q = quellwahrheit(kopf);
  if (!q.nenntDockerfileAlsQuelle) {
    return false;
  }
  return q.nenntCoolify ? q.verneintComposeAlsQuelle : true;
}

const composeInhalt = readFileSync(COMPOSE, "utf8");
const kopf = kopfkommentar(composeInhalt);

describe("JOB 1107 D1 · die Compose-Datei sagt die Wahrheit über Coolifys Deploy-Quelle", () => {
  it("der Kopfkommentar existiert überhaupt — sonst wäre jede Aussage darunter wertlos", () => {
    expect(kopf.length).toBeGreaterThan(0);
    expect(kopf.startsWith("#")).toBe(true);
  });

  it("er benennt das Dockerfile als die Quelle, über die Coolify baut", () => {
    expect(
      quellwahrheit(kopf).nenntDockerfileAlsQuelle,
      "Der Kopf nennt das Dockerfile nicht — dann steht nirgends, was die Deploy-Quelle wirklich ist.",
    ).toBe(true);
  });

  it("er bezeichnet die Compose-Datei NICHT als massgebliche Coolify-Quelle", () => {
    expect(
      istQuellwahr(kopf),
      "Der Kopf nennt Coolify, ohne die Compose-Datei ausdrücklich von der Deploy-Quelle zu trennen — " +
        "genau der Widerspruch W1 aus JOB 947. Wer die Datei dann ändert, um den Live-Betrieb zu " +
        "beeinflussen, ändert nichts.",
    ).toBe(true);
  });

  it("die belegte Gegenseite steht unverändert im Baum — W1 bleibt zweiseitig geprüft", () => {
    // Ohne diesen Fall könnte jemand `contradictions.md` umschreiben und den Widerspruch von der
    // anderen Seite her wieder aufreissen, ohne dass hier etwas rot würde.
    const belegt = readFileSync(CONTRADICTIONS, "utf8");
    expect(belegt).toContain("Coolify deployt über das **Dockerfile**");
    expect(belegt).toContain("die Compose-Datei ist NICHT die Deploy-Quelle");
  });

  it("das Dockerfile existiert wirklich und bezeichnet sich als Produktions-Image", () => {
    // Der Kopf der Compose-Datei verweist auf das Dockerfile. Zeigt der Verweis ins Leere, ist die
    // Korrektur nur eine andere Behauptung.
    const df = readFileSync(DOCKERFILE, "utf8");
    expect(df.toLowerCase()).toContain("produktions-image");
    expect(df.toLowerCase()).toContain("coolify");
  });
});

// ================================================================================================
// DIE KALIBRIERUNG — ohne sie wäre nicht zu unterscheiden, ob die Regel wirklich etwas verlangt.
// ================================================================================================
//
// Jeder Fall führt die Regel auf einem SYNTHETISCHEN Kopf aus. Das Produkt wird dabei nicht
// angefasst; geprüft wird die Regel selbst.
describe("JOB 1107 D1 · die Regel schlägt an — kalibriert an synthetischen Köpfen", () => {
  it("der ALTE Kopf (Stand vor diesem Durchgang) wird als unwahr erkannt", () => {
    // Wörtlich der Befund aus JOB 947 W1, Seite A.
    const alt = [
      "# Produktions-Setup: App + Postgres. Für Coolify oder einen Ein-Befehl-Deploy",
      "# (`docker compose -f docker-compose.prod.yml up -d --build`). Werte aus .env.",
    ].join("\n");
    expect(istQuellwahr(alt)).toBe(false);
    expect(quellwahrheit(alt).nenntCoolify).toBe(true);
    expect(quellwahrheit(alt).verneintComposeAlsQuelle).toBe(false);
  });

  it("ein Kopf, der Coolify nennt und das Dockerfile — aber die Verneinung weglässt — ist unwahr", () => {
    // Die gefährliche Halbheit: das Dockerfile steht da, die Zuordnung bleibt trotzdem offen.
    const halb = "# Produktions-Setup für Coolify. Siehe auch Dockerfile.";
    expect(quellwahrheit(halb).nenntDockerfileAlsQuelle).toBe(true);
    expect(istQuellwahr(halb)).toBe(false);
  });

  it("ein Kopf, der die Umkehrung behauptet, ist ebenfalls unwahr", () => {
    // „ist die Deploy-Quelle" darf nicht durch das blosse Vorkommen des Wortes „nicht" an anderer
    // Stelle grün werden.
    const umgekehrt =
      "# Diese Compose-Datei ist die Deploy-Quelle für Coolify; das Dockerfile wird nicht benutzt.";
    expect(istQuellwahr(umgekehrt)).toBe(false);
  });

  it("ein wahrer Kopf wird angenommen — die Regel ist erfüllbar, nicht bloss streng", () => {
    const wahr = [
      "# Produktions-Setup: App + Postgres — NICHT die Coolify-Deploy-Quelle.",
      "# Coolify baut über das Dockerfile; diese Datei ist ein separates Ein-Befehl-Setup.",
    ].join("\n");
    expect(istQuellwahr(wahr)).toBe(true);
  });

  it("der Kopfleser nimmt nur den führenden Kommentarblock, nicht die ganze Datei", () => {
    // Sonst würde ein `# ...`-Kommentar irgendwo unten im Dienstbaum die Aussage tragen.
    const datei = "# oben\n# zweite\nservices:\n  db:\n    # unten steht Dockerfile\n";
    expect(kopfkommentar(datei)).toBe("# oben\n# zweite");
    expect(kopfkommentar(datei)).not.toContain("Dockerfile");
  });
});
