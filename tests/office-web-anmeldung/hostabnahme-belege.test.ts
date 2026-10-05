// ================================================================================================
// AUFNAHME m365-anmeldung · DIE ZWEI HOST-BELEGE STEHEN GETRENNT, EHRLICH UND OHNE GEHEIMNISSE
// ================================================================================================
//
// Die Auftragsquelle nennt zwei Zielorte: `docs/operations/word-web-hostabnahme` und
// `docs/operations/word-mac-hostabnahme`. Solange niemand die Läufe geführt hat, dürfen beide Belege
// keinen Lauf behaupten — und wenn sie ausgefüllt werden, darf nichts hinein, was ein Geheimnis
// ist. Dieser Fall hält beides fest:
//   H1  beide Belege existieren, verweisen aufeinander und auf den gemeinsamen Teil
//   H2  jeder Beleg führt seine vollständige Schrittliste (Web W1–W19, Mac M1–M10)
//   H3  solange eine Ergebniszelle leer ist, sagt der Beleg „Offen" und „Kein Lauf ist belegt"
//   H4  keine E-Mail-Adresse, kein Bearer-Wert, kein Sitzungscookie-Wert in den Belegen
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = resolve(__dirname, "..", "..");
const WEB = "docs/operations/word-web-hostabnahme/README.md";
const MAC = "docs/operations/word-mac-hostabnahme/README.md";
const GEMEINSAM = "docs/word-addin/ABNAHME-M365.md";

function lies(rel: string): string {
  return readFileSync(resolve(WURZEL, rel), "utf8");
}

/** Die Ablaufzeilen `| W1 | … | Ergebnis |` — die letzte Zelle ist das Ergebnis. */
function ablauf(text: string, praefix: "W" | "M"): Map<string, string> {
  const zeilen = new Map<string, string>();
  for (const zeile of text.split("\n")) {
    const zellen = zeile.split("|").map((z) => z.trim());
    const kennung = zellen[1] ?? "";
    if (new RegExp(`^${praefix}\\d+$`).test(kennung)) {
      zeilen.set(kennung, zellen[zellen.length - 2] ?? "");
    }
  }
  return zeilen;
}

describe("Aufnahme m365-anmeldung · Host-Belege Word für das Web und Word für Mac", () => {
  it("H1 — beide Belege existieren getrennt und verweisen auf den gemeinsamen Teil", () => {
    const web = lies(WEB);
    const mac = lies(MAC);
    expect(web).toContain("Word für das Web");
    expect(mac).toContain("Word für Mac");
    expect(web).toContain(MAC);
    expect(mac).toContain(WEB);
    expect(web).toContain(GEMEINSAM);
    expect(mac).toContain(GEMEINSAM);
    const gemeinsam = lies(GEMEINSAM);
    expect(gemeinsam).toContain(WEB);
    expect(gemeinsam).toContain(MAC);
  });

  it("H2 — jeder Beleg führt seine vollständige Schrittliste", () => {
    const web = ablauf(lies(WEB), "W");
    const mac = ablauf(lies(MAC), "M");
    expect([...web.keys()]).toEqual(Array.from({ length: 19 }, (_, i) => `W${i + 1}`));
    expect([...mac.keys()]).toEqual(Array.from({ length: 10 }, (_, i) => `M${i + 1}`));
  });

  it("H3 — mit leerer Ergebniszelle behauptet kein Beleg einen Lauf", () => {
    for (const [datei, praefix] of [
      [WEB, "W"],
      [MAC, "M"],
    ] as const) {
      const text = lies(datei);
      const offen = [...ablauf(text, praefix).values()].some((ergebnis) => ergebnis === "");
      if (offen) {
        expect(text, datei).toContain("Kein Lauf ist belegt.");
        expect(text, datei).toMatch(/## Ergebnis dieses Belegs\s+\*\*Offen\.\*\*/);
      }
    }
  });

  it("H4 — keine E-Mail-Adresse, kein Bearer-Wert, kein Sitzungscookie-Wert", () => {
    for (const datei of [WEB, MAC, GEMEINSAM]) {
      const text = lies(datei);
      expect(text, datei).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/);
      expect(text, datei).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{8,}/);
      expect(text, datei).not.toMatch(/kw_session=[^\s;`|]+/);
    }
  });
});
