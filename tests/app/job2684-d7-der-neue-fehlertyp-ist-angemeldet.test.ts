import { describe, expect, it } from "vitest";
import {
  ERLAUBTE_FEHLERCODES,
  ERLAUBTE_FEHLERTYPEN,
  ERR_TEXT_UNTERDRUECKT,
  ERR_UNBEKANNT,
  baueLoggerOptionen,
} from "../../services/app/src/build-app";
import { DraftStaleError } from "../../services/capture/src/service";

// ================================================================================================
// JOB 2684 D7 — DER NEUE FEHLERTYP MUSS ANGEMELDET WERDEN (dasselbe Muster wie 2701/2702)
// ================================================================================================
//
// 2661 schliesst die Listen des Logger-Serializers; 2684 wirft mit `DraftStaleError` eine Klasse,
// die dort nicht stand. Abnahme: ein DRAFT_STALE-Fehler erscheint im Log mit Typ und Code — und
// ohne freien Fehlertext; und der Stand (`currentUpdatedAt`), den der Fehler traegt, reist nicht mit.

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

describe("JOB 2684 D7 · der Standkonflikt ist im Logger angemeldet", () => {
  it("A1 · DraftStaleError steht auf der Typenliste, DRAFT_STALE und DRAFT_WRITE_CONTENDED auf der Codeliste", () => {
    expect(ERLAUBTE_FEHLERTYPEN.has("DraftStaleError")).toBe(true);
    expect(ERLAUBTE_FEHLERCODES.has("DRAFT_STALE")).toBe(true);
    expect(ERLAUBTE_FEHLERCODES.has("DRAFT_WRITE_CONTENDED")).toBe(true);
  });

  it("B1 · MESSUNG: der Waechter (build-app.test.ts, drei Setzformen) sieht in service.ts DRAFT_WRITE_CONTENDED, aber NICHT DRAFT_STALE — der steht in super(…)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const quelle = readFileSync(
      join(process.cwd(), "services", "capture", "src", "service.ts"),
      "utf8",
    );
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
    expect(gesehen.has("DRAFT_WRITE_CONTENDED")).toBe(true);
    expect(gesehen.has("DRAFT_STALE")).toBe(false);
    // Und doch wird DRAFT_STALE geworfen — als erstes Argument von super(…) in DraftStaleError.
    expect(quelle).toMatch(/super\(\s*"DRAFT_STALE"/);
  });

  it("A2 · ABNAHME: ein DRAFT_STALE-Fehler erscheint im Log mit seinem Code — ohne seinen Text und ohne den Stand", () => {
    const stand = "2026-08-29T12:00:00.000Z";
    const fehler = new DraftStaleError(stand);
    expect(fehler.name).toBe("DraftStaleError");
    expect(fehler.code).toBe("DRAFT_STALE");
    expect(fehler.message).toContain("neu laden");
    const zeile = errSerializer()(fehler);
    expect(zeile.type).toBe("DraftStaleError");
    expect(zeile.code).toBe("DRAFT_STALE");
    expect(zeile.message).toBe(ERR_TEXT_UNTERDRUECKT);
    expect(zeile.stack).toBe(ERR_TEXT_UNTERDRUECKT);
    const roh = JSON.stringify(zeile);
    expect(roh).not.toContain("neu laden");
    expect(roh).not.toContain(stand);
  });

  it("A3 · GEGENPROBE: eine Klasse, die nicht auf der Liste steht, bleibt UNBEKANNT", () => {
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
  });
});
