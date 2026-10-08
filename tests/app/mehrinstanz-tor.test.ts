// ================================================================================================
// R-0824 — DAS MEHRINSTANZ-TOR: WAS ERFÜLLT SEIN MUSS, BEVOR EINE ZWEITE INSTANZ LAUFEN DARF.
// ================================================================================================
//
// `docs/operations/mehrinstanz-tor.md` führt jede Stelle, an der das Produkt auf genau EINER
// laufenden Instanz beruht, mit Datei, Merkmal, Folge und Aufhebungsbedingung. Dieser Wächter hält
// die Form fest, die das Tor prüfbar macht:
//   · jede Zeile zeigt auf eine Datei, die es gibt, und auf ein Merkmal, das darin noch steht —
//     verschwindet der Code oder wandert er, wird der Wächter rot statt das Tor still zu entwerten;
//   · `ERFÜLLT` gibt es nur mit Beleg, und die Freigabe gibt es nur ohne eine `OFFEN`-Zeile;
//   · solange gesperrt ist, beschreibt `docker-compose.prod.yml` keine zweite App-Instanz;
//   · der `DEPLOY-VERTRAG` im Anmeldedienst verweist auf dieses Tor.
//
// Was er NICHT tut: er stellt nicht fest, wie viele Instanzen auf der Plattform laufen. Das ist eine
// Owner-Auskunft (JOB 947, O-1) und bleibt unbelegt — ebenso wie in
// `single-instance-annahme-evidenz.test.ts`, dessen Fälle hier nicht wiederholt werden.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const WURZEL = new URL("../../", import.meta.url);
const TOR_PFAD = "docs/operations/mehrinstanz-tor.md";

function lies(pfad: string): string {
  return readFileSync(new URL(pfad, WURZEL), "utf8");
}

interface Bedingung {
  readonly kennung: string;
  readonly status: string;
  readonly datei: string;
  readonly merkmal: string;
  readonly heute: string;
  readonly aufhebung: string;
}

/** Die Zeilen `| T… |` der Bedingungstabelle. */
function bedingungen(tor: string): Bedingung[] {
  return tor
    .split("\n")
    .filter((z) => /^\| T\d+ \|/.test(z))
    .map((z) => {
      // Vor dem ersten `|` steht nichts — die erste Spalte ist deshalb leer und wird übersprungen.
      const spalten = z.split("|").map((s) => s.trim());
      const [, kennung = "", status = "", stelle = "", heute = "", aufhebung = ""] = spalten;
      const teile = /^`([^`]+)` · `([^`]+)`$/.exec(stelle);
      return {
        kennung,
        status,
        datei: teile?.[1] ?? "",
        merkmal: teile?.[2] ?? "",
        heute,
        aufhebung,
      };
    });
}

function freigabe(tor: string): string | undefined {
  return /^\*\*Freigabe: (GESPERRT|ERTEILT)\*\*$/m.exec(tor)?.[1];
}

const TOR = lies(TOR_PFAD);
const ZEILEN = bedingungen(TOR);

describe("R-0824 · das Tor existiert und ist lesbar", () => {
  it("es nennt seine Freigabe ausdrücklich", () => {
    expect(freigabe(TOR), "keine Zeile **Freigabe: GESPERRT|ERTEILT**").toBeDefined();
  });

  it("es führt Bedingungen, und jede hat eine eindeutige Kennung", () => {
    expect(ZEILEN.length).toBeGreaterThan(0);
    const kennungen = ZEILEN.map((b) => b.kennung);
    expect(new Set(kennungen).size).toBe(kennungen.length);
  });

  it("der DEPLOY-VERTRAG des Anmeldediensts ist darunter", () => {
    expect(ZEILEN.map((b) => b.datei)).toContain("services/auth/src/repo-pg.ts");
  });
});

describe("R-0824 · jede Bedingung zeigt auf lebenden Code", () => {
  for (const b of ZEILEN) {
    it(`${b.kennung}: \`${b.datei}\` enthält \`${b.merkmal}\``, () => {
      expect(b.datei, `${b.kennung}: Stelle unlesbar`).not.toBe("");
      expect(existsSync(new URL(b.datei, WURZEL)), `${b.kennung}: ${b.datei} fehlt`).toBe(true);
      expect(lies(b.datei), `${b.kennung}: Merkmal nicht mehr in ${b.datei}`).toContain(b.merkmal);
    });
  }
});

describe("R-0824 · Status und Freigabe passen zusammen", () => {
  it("jede Zeile ist OFFEN oder ERFÜLLT und nennt Folge und Aufhebung", () => {
    for (const b of ZEILEN) {
      expect(["OFFEN", "ERFÜLLT"], b.kennung).toContain(b.status);
      expect(b.heute.length, `${b.kennung}: Folge leer`).toBeGreaterThan(20);
      expect(b.aufhebung.length, `${b.kennung}: Aufhebung/Beleg leer`).toBeGreaterThan(20);
    }
  });

  it("ERFÜLLT gibt es nur mit Beleg", () => {
    for (const b of ZEILEN.filter((x) => x.status === "ERFÜLLT")) {
      expect(b.aufhebung, `${b.kennung}: ERFÜLLT ohne „Beleg:"`).toMatch(/^Beleg: /);
    }
  });

  it("solange eine Bedingung OFFEN ist, ist die Freigabe GESPERRT", () => {
    const offen = ZEILEN.filter((b) => b.status === "OFFEN").map((b) => b.kennung);
    if (offen.length > 0) {
      expect(freigabe(TOR), `offen: ${offen.join(", ")}`).toBe("GESPERRT");
    }
  });

  it("KALIBRIERUNG: der Zeilenleser findet eine OFFEN-Zeile und die Freigabe ERTEILT", () => {
    // Ohne diesen Fall wäre der Fall darüber auch dann grün, wenn der Leser nichts fände.
    const probe = [
      "**Freigabe: ERTEILT**",
      "| T1 | OFFEN | `a.ts` · `b` | eine Folge, die lang genug ist | eine Aufhebung, lang genug |",
    ].join("\n");
    expect(freigabe(probe)).toBe("ERTEILT");
    expect(bedingungen(probe)).toEqual([
      {
        kennung: "T1",
        status: "OFFEN",
        datei: "a.ts",
        merkmal: "b",
        heute: "eine Folge, die lang genug ist",
        aufhebung: "eine Aufhebung, lang genug",
      },
    ]);
  });
});

describe("R-0824 · die Sperre gilt heute", () => {
  it("solange gesperrt, beschreibt docker-compose.prod.yml keine zweite App-Instanz", () => {
    if (freigabe(TOR) !== "GESPERRT") {
      return;
    }
    const compose = lies("docker-compose.prod.yml");
    expect(compose).toMatch(/^ {2}app:$/m);
    expect(compose, "replicas/scale vor der Freigabe").not.toMatch(/^\s+(replicas|scale):/m);
  });

  it("der DEPLOY-VERTRAG in services/auth/src/repo-pg.ts verweist auf dieses Tor", () => {
    const quelle = lies("services/auth/src/repo-pg.ts");
    const start = quelle.indexOf("DEPLOY-VERTRAG");
    const ende = quelle.indexOf("export async function migrateAuthTokensAtRest");
    expect(start).toBeGreaterThan(-1);
    expect(quelle.slice(start, ende)).toContain(TOR_PFAD);
  });
});
