// ================================================================================================
// R-1420 · DER GEHEIMNIS-SCAN WIRD SELBST GEPRUEFT.
// ================================================================================================
//
// `tools/geheimnis-scan.ts` soll verhindern, dass Zugangsdaten versehentlich in den Quellcode
// gelangen. Dieser Test misst dieselben Funktionen, faehrt den Starter als Unterprozess (so, wie
// `tools/check` ihn ruft) und prueft zuletzt den ECHTEN Bestand — ein Scan, der nie etwas findet,
// waere sonst von einem Scan, der nichts liest, nicht zu unterscheiden.
//
// DIE ATTRAPPEN ENTSTEHEN ERST ZUR LAUFZEIT (`teil(...)`): stuenden sie als ganze Zeichenkette hier,
// wuerde der Scan diese Datei selbst sperren. Kein Wert unten ist ein echter Schluessel.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ERLAUBT_MARKE,
  INHALTSREGELN,
  istEnvDatei,
  istSchluesselDatei,
  kandidatenDateien,
  maskiere,
  pruefeBestand,
  pruefeDateiname,
  pruefeText,
} from "../../tools/geheimnis-scan";

const WURZEL = join(import.meta.dirname, "../..");

const teil = (...stuecke: string[]): string => stuecke.join("");

// Je Regel eine Attrappe in der Form, die das echte Format hat.
const ATTRAPPEN: Record<string, string> = {
  "privater-schluessel": teil("-----BEGIN ", "RSA PRIVATE", " KEY-----"),
  "aws-zugangsschluessel": teil("AK", "IA", "ABCDEFGHIJKLMNOP"),
  "github-token": teil("gh", "p_", "a1".repeat(18)),
  "anthropic-schluessel": teil("sk", "-ant-", "api03-", "x".repeat(24)),
  "openai-schluessel": teil("sk", "-proj-", "Ab3_".repeat(6)),
  "slack-token": teil("xo", "xb-", "1234567890-abc"),
  "google-api-schluessel": teil("AI", "za", "B".repeat(35)),
  "stripe-live-schluessel": teil("sk", "_live_", "c".repeat(20)),
  "npm-token": teil("np", "m_", "d".repeat(36)),
};

function bestand(dateien: Record<string, string>): string {
  const wurzel = mkdtempSync(join(tmpdir(), "kw-geheimnis-"));
  for (const [pfad, inhalt] of Object.entries(dateien)) {
    mkdirSync(dirname(join(wurzel, pfad)), { recursive: true });
    writeFileSync(join(wurzel, pfad), inhalt, "utf-8");
  }
  return wurzel;
}

/** Den echten Starter fahren — wie `tools/check`: `bash tools/geheimnis-scan.sh`. */
function fahreStarter(wurzel: string) {
  const r = spawnSync("bash", ["tools/geheimnis-scan.sh", wurzel], {
    cwd: WURZEL,
    encoding: "utf-8",
  });
  return { code: r.status, aus: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

describe("R-1420 · der Scan erkennt Zugangsdaten an ihrem Format", () => {
  it("jede Regel hat eine Attrappe — keine Regel bleibt ungeprueft", () => {
    expect(Object.keys(ATTRAPPEN).sort()).toEqual(INHALTSREGELN.map((r) => r.kennung).sort());
  });

  for (const [regel, wert] of Object.entries(ATTRAPPEN)) {
    it(`${regel}: Fund mit Datei, Zeile und maskiertem Auszug`, () => {
      const text = `erste Zeile\nconst wert = "${wert}";\n`;
      const funde = pruefeText("src/konfig.ts", text);

      expect(funde.map((f) => [f.datei, f.zeile, f.regel])).toEqual([["src/konfig.ts", 2, regel]]);
      expect(funde[0]?.auszug, "der Wert darf nicht ausgegeben werden").not.toContain(wert);
    });
  }

  it("maskiert auf vier Zeichen und die Laenge", () => {
    expect(maskiere("abcdefghijkl")).toBe("abcd…(12 Zeichen)");
  });

  it("gewoehnlicher Quelltext und Platzhalter sind kein Fund", () => {
    const text = [
      'const apiKey = process.env.ANTHROPIC_API_KEY ?? "";',
      "ANTHROPIC_API_KEY=sk-ant-...",
      'password: "test-password-3244",',
      "const s = 'task-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456';",
    ].join("\n");
    expect(pruefeText("x.ts", text)).toEqual([]);
  });

  it("die Marke erlaubt eine bewusste Attrappe nur in IHRER Zeile", () => {
    const wert = ATTRAPPEN["aws-zugangsschluessel"] ?? "";
    const text = `"${wert}"; // ${ERLAUBT_MARKE} (Testfall)\n"${wert}";\n`;
    expect(pruefeText("x.ts", text).map((f) => f.zeile)).toEqual([2]);
  });
});

describe("R-1420 · Dateien, die ihrer Art nach Geheimnisse tragen", () => {
  it("Umgebungsdateien sperren, Vorlagen nicht", () => {
    for (const name of [".env", ".env.local", ".env.production", "prod.env"]) {
      expect(istEnvDatei(name), name).toBe(true);
    }
    for (const name of [".env.example", ".env.sample", "env.demo.beispiel", "environment.ts"]) {
      expect(istEnvDatei(name), name).toBe(false);
    }
  });

  it("Schluesseldateien sperren", () => {
    for (const name of ["server.pem", "tls.key", "zert.p12", "id_rsa", "id_ed25519"]) {
      expect(istSchluesselDatei(name), name).toBe(true);
    }
    for (const name of ["id_rsa.pub", "keys.ts", "monkey.md"]) {
      expect(istSchluesselDatei(name), name).toBe(false);
    }
  });

  it("der Dateinamen-Fund nennt die Datei ohne Zeile", () => {
    expect(pruefeDateiname("services/app/.env")).toMatchObject([
      { datei: "services/app/.env", zeile: 0, regel: "env-datei" },
    ]);
    expect(pruefeDateiname(".env.example")).toEqual([]);
  });
});

describe("R-1420 · der Bestand, den der Scan liest", () => {
  it("liest neue, nicht versionierte Dateien mit — und laesst Ignoriertes weg", () => {
    const wurzel = bestand({
      ".gitignore": "ignoriert.txt\n",
      "neu.ts": "export {};\n",
      "ignoriert.txt": "lokal\n",
    });
    const init = spawnSync("git", ["init", "-q"], { cwd: wurzel, encoding: "utf-8" });
    expect(init.status, init.stderr).toBe(0);

    const { dateien, quelle } = kandidatenDateien(wurzel);
    expect(quelle).toBe("git");
    expect(dateien).toContain("neu.ts");
    expect(dateien).not.toContain("ignoriert.txt");
  });

  it("findet die Attrappe im synthetischen Bestand, Binaerdateien bleiben aussen vor", () => {
    const wert = ATTRAPPEN["github-token"] ?? "";
    const wurzel = bestand({
      "src/a.ts": "export const a = 1;\n",
      "src/b.ts": `// Kopf\n\nexport const t = "${wert}";\n`,
      "bild.png": `\0\0${wert}`,
    });
    const { funde, gelesen } = pruefeBestand(wurzel);

    expect(gelesen).toBe(2);
    expect(funde.map((f) => `${f.datei}:${f.zeile}:${f.regel}`)).toEqual([
      "src/b.ts:3:github-token",
    ]);
  });
});

// Nacharbeit 1 (Bens Befund): Dateien über 5 MB wurden nur benannt, nicht gelesen — ein Schlüssel
// am Ende einer grossen JSON-Datei kam neben einer sauberen Datei mit Exit 0 durch. Die Attrappe
// steht deshalb HINTER sechs MB Text, und gemessen wird an Funktion UND Starter.
function grosserBestand(wert: string): string {
  const fuellung = '{"zeile":"unauffaelliger Text ohne Geheimnis"},\n'.repeat(130_000);
  expect(Buffer.byteLength(fuellung), "die Vorrichtung muss über 5 MB liegen").toBeGreaterThan(
    5 * 1024 * 1024,
  );
  return bestand({
    "sauber.ts": "export const a = 1;\n",
    "gross.json": `[\n${fuellung}{"schluessel":"${wert}"}\n]\n`,
  });
}

describe("R-1420 · grosse Textdateien werden vollständig gelesen", () => {
  it("findet die Attrappe hinter über 5 MB Text", () => {
    const wert = ATTRAPPEN["aws-zugangsschluessel"] ?? "";
    const { funde, gelesen } = pruefeBestand(grosserBestand(wert));

    expect(gelesen).toBe(2);
    expect(funde.map((f) => `${f.datei}:${f.zeile}:${f.regel}`)).toEqual([
      "gross.json:130002:aws-zugangsschluessel",
    ]);
  });

  it("der Starter sperrt mit Code 1 — kein Gruen neben der sauberen Datei", () => {
    const wert = ATTRAPPEN["aws-zugangsschluessel"] ?? "";
    const r = fahreStarter(grosserBestand(wert));

    expect(r.code, r.aus).toBe(1);
    expect(r.aus).toContain("gross.json:130002");
    expect(r.aus, "der Wert landet nie im Protokoll").not.toContain(wert);
  });
});

describe("R-1420 · der Starter, so wie das Tor ihn ruft", () => {
  it("Fund → Code 1, mit Ort, ohne den Wert", () => {
    const wert = ATTRAPPEN["anthropic-schluessel"] ?? "";
    const r = fahreStarter(bestand({ "konfig.ts": `export const k = "${wert}";\n` }));

    expect(r.code, r.aus).toBe(1);
    expect(r.aus).toContain("konfig.ts:1");
    expect(r.aus).toContain("anthropic-schluessel");
    expect(r.aus, "der Wert landet nie im Protokoll").not.toContain(wert);
  });

  it("sauberer Bestand → Code 0", () => {
    const r = fahreStarter(bestand({ "a.ts": "export {};\n" }));
    expect(r.code, r.aus).toBe(0);
    expect(r.aus).toContain("kein Fund");
  });

  it("nichts gelesen → Code 2, kein geschenktes Gruen", () => {
    const r = fahreStarter(mkdtempSync(join(tmpdir(), "kw-geheimnis-leer-")));
    expect(r.code, r.aus).toBe(2);
  });

  it("tools/check ruft den Starter, und zwar vor den Tests", () => {
    const tor = readFileSync(join(WURZEL, "tools/check"), "utf8");
    const scan = tor.indexOf("bash tools/geheimnis-scan.sh");
    expect(scan, "tools/check muss den Starter rufen").toBeGreaterThan(-1);
    expect(scan).toBeLessThan(tor.indexOf("./tools/test"));
  });
});

describe("R-1420 · der echte Bestand ist heute frei von erkennbaren Zugangsdaten", () => {
  it("kein Fund in allem, was uebernommen werden kann", () => {
    const { funde, gelesen } = pruefeBestand(WURZEL);

    expect(gelesen, "der Scan hat den Bestand nicht erreicht").toBeGreaterThan(100);
    expect(
      funde.map((f) => `${f.datei}:${f.zeile} ${f.regel} ${f.auszug}`),
      "Zugangsdaten im Repo — entfernen oder als Attrappe markieren",
    ).toEqual([]);
  });
});
