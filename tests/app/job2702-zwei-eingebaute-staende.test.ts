import { describe, expect, it } from "vitest";
import {
  ERLAUBTE_FEHLERCODES,
  ERLAUBTE_FEHLERTYPEN,
  ERR_TEXT_UNTERDRUECKT,
  ERR_UNBEKANNT,
  baueLoggerOptionen,
} from "../../services/app/src/build-app";
import { ConfluenceRequestError } from "../../services/confluence/src/rest-client";

// ================================================================================================
// JOB 2702 D1 — ZWEI EINGEBAUTE STAENDE, DIE SICH NICHT VERTRAGEN (Befund aus 2701 D1)
// ================================================================================================
//
// 2661 schliesst die Listen des Logger-Serializers; 2683 wirft eine Klasse, die dort nicht stand.
// Beide hatten recht. Die Abnahme (§5): ein Confluence-Timeout erscheint im Log mit seinem Code,
// ohne freien Fehlertext — und ein Fehlertyp, der NICHT auf der Liste steht, wird weiterhin
// zurueckgehalten. Dazu die Messung, die den Befund vor dem Einbau gefunden haette.

type ErrSerializer = (fehler: Error & { code?: unknown }) => {
  type: string;
  code: string;
  herkunft: string;
  message: string;
  stack: string;
};

function errSerializer(): ErrSerializer {
  const optionen = baueLoggerOptionen({ stufe: "warn" }) as {
    serializers?: { err?: ErrSerializer };
  };
  const err = optionen.serializers?.err;
  if (!err) {
    throw new Error("kein err-Serializer in den Logger-Optionen");
  }
  return err;
}

describe("JOB 2702 D1 · A · die zwei Eintraege", () => {
  it("A1 · ConfluenceRequestError steht auf der Typenliste, CONFLUENCE_TIMEOUT auf der Codeliste", () => {
    expect(ERLAUBTE_FEHLERTYPEN.has("ConfluenceRequestError")).toBe(true);
    expect(ERLAUBTE_FEHLERCODES.has("CONFLUENCE_TIMEOUT")).toBe(true);
  });

  it("A2 · ABNAHME: ein Confluence-Timeout erscheint im Log mit Typ und Code — und ohne seinen Text", () => {
    const fehler = new ConfluenceRequestError("timeout", 15_000);
    // Der Meldungstext traegt die Zahl der Frist — genau das, was NICHT ins Log darf.
    expect(fehler.message).toContain("15 s");
    const zeile = errSerializer()(fehler);
    expect(zeile.type).toBe("ConfluenceRequestError");
    expect(zeile.code).toBe("CONFLUENCE_TIMEOUT");
    expect(zeile.message).toBe(ERR_TEXT_UNTERDRUECKT);
    expect(zeile.stack).toBe(ERR_TEXT_UNTERDRUECKT);
    expect(JSON.stringify(zeile)).not.toContain("15 s");
    expect(JSON.stringify(zeile)).not.toContain("Zeitüberschreitung");
  });

  it("A3 · GEGENPROBE: ein Fehlertyp, der nicht auf der Liste steht, wird weiterhin zurueckgehalten", () => {
    class AnnaMeierError extends Error {
      readonly code = "ANNA_MEIER_KRANK";
      constructor() {
        super("Anna Meier ist krank");
        this.name = "AnnaMeierError";
      }
    }
    const zeile = errSerializer()(new AnnaMeierError());
    expect(zeile.type).toBe(ERR_UNBEKANNT);
    expect(zeile.code).toBe(ERR_UNBEKANNT);
    expect(JSON.stringify(zeile)).not.toContain("Anna");
    expect(JSON.stringify(zeile)).not.toContain("KRANK");
  });
});

describe("JOB 2702 D1 · B · die Messung: kennt der Serializer alles, was ConfluenceRequestError wirft?", () => {
  it("B1 · die Klasse hat genau drei Codes; die Liste kennt heute einen davon — gemessen, nicht geraten", () => {
    const codes = (["timeout", "zu_gross", "zeitbudget"] as const).map(
      (grund) => new ConfluenceRequestError(grund, 1_000).code,
    );
    expect(codes).toEqual([
      "CONFLUENCE_TIMEOUT",
      "CONFLUENCE_RESPONSE_TOO_LARGE",
      "CONFLUENCE_BUDGET",
    ]);
    const bekannt = codes.filter((c) => ERLAUBTE_FEHLERCODES.has(c));
    const unbekannt = codes.filter((c) => !ERLAUBTE_FEHLERCODES.has(c));
    // Der Stand NACH 2702 D1, ausdruecklich als Zahl: 1 bekannt, 2 offen (Rueckgabe 2702, Rest).
    // Wer die zwei eintraegt, zieht diese beiden Zeilen auf 3 und 0 — dann ist der Rest erledigt.
    expect(bekannt).toEqual(["CONFLUENCE_TIMEOUT"]);
    expect(unbekannt).toEqual(["CONFLUENCE_RESPONSE_TOO_LARGE", "CONFLUENCE_BUDGET"]);
  });

  it('B2 · warum der Waechter sie nicht sah: die zwei Codes stehen weder als Konstruktorargument noch als `code: "…"` im Quelltext', async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const quelle = readFileSync(
      join(process.cwd(), "services", "confluence", "src", "rest-client.ts"),
      "utf8",
    );
    // Die drei Setzformen des Waechters aus build-app.test.ts:684–688.
    const formen = [
      /new\s+[A-Za-z]*Error\(\s*"([A-Z_]{2,})"/g,
      /\bcode:\s*"([A-Z_]{2,})"/g,
      /\bcode\s*=\s*"([A-Z_]{2,})"/g,
    ];
    const gesehen = new Set<string>();
    for (const form of formen) {
      for (const m of quelle.matchAll(form)) {
        if (m[1]) {
          gesehen.add(m[1]);
        }
      }
    }
    expect(gesehen.has("CONFLUENCE_RESPONSE_TOO_LARGE")).toBe(false);
    expect(gesehen.has("CONFLUENCE_BUDGET")).toBe(false);
    // Und doch stehen sie im Quelltext — als Ternaer-Zweige.
    expect(quelle).toContain('"CONFLUENCE_RESPONSE_TOO_LARGE"');
    expect(quelle).toContain('"CONFLUENCE_BUDGET"');
  });
});
