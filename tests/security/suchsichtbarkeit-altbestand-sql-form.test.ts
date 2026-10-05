// ================================================================================================
// AUFNAHME 20260922 · DIE SQL-FORM DER BEIDEN BEFUNDE AUS BENS CODEPRÜFUNG (Runde 1).
// ================================================================================================
//
// B1 — ein Autor, der im JSON keine Zeichenfolge ist (`author: 4359`), begründet keine Autorschaft.
//      `author_key = data->>'author'` macht daraus den Text '4359'; der Trim verlangt deshalb
//      zusätzlich `jsonb_typeof(data->'author') = 'string'` — der Spiegel von
//      `typeof ko.author === "string"` in `darfSehen`.
// B2 — `deletedAt: null` oder `""` ist kein Papierkorb (`!ko.deletedAt`). Trim und Such-JOIN
//      ergänzen ihre Prüfung um `sqlDeletedAtLeer`.
//
// Diese Datei braucht keine Datenbank und prüft nur, dass beide Bedingungen im erzeugten SQL
// stehen. OB PostgreSQL damit dieselbe Menge liefert wie der Speicher, entscheidet allein
// `suchsichtbarkeit-altbestand-paritaet.integration.test.ts` gegen echtes PostgreSQL.
import { describe, expect, it } from "vitest";
import type { SessionUser } from "../../services/app/src/http";
import { sqlSichtbarkeitFuer } from "../../services/app/src/sichtbarkeit";
import { sqlDeletedAtLeer } from "../../services/knowledge-object";
import { ZAHLKENNUNG } from "./suchsichtbarkeit-altbestand-fixture";

const BETRACHTER_4359 = { id: ZAHLKENNUNG, role: "viewer" } as SessionUser;

describe("Aufnahme 20260922 · SQL-Form der Befunde B1/B2", () => {
  it("B1 · die Autorausnahme verlangt eine JSON-Zeichenfolge am lebenden Objekt", () => {
    const sql = sqlSichtbarkeitFuer(BETRACHTER_4359).sql("k", 1);
    expect(sql).toContain("jsonb_typeof(k.data->'author') = 'string'");
    // Die Typprüfung steht in DERSELBEN Klammer wie der Kennungsvergleich — nicht als lose
    // Alternative, die die Autorausnahme wieder öffnen würde.
    expect(sql).toMatch(
      /\(COALESCE\(k\.author_key, ''\) <> '' AND jsonb_typeof\(k\.data->'author'\) = 'string' AND k\.author_key = \$2\)/,
    );
  });

  it('B2 · der Papierkorb im Trim wertet null/""/false/0 wie `!ko.deletedAt` als lebend', () => {
    const sql = sqlSichtbarkeitFuer(BETRACHTER_4359).sql("kos", 1);
    expect(
      sql.startsWith(`((kos.deleted_at_key IS NULL OR ${sqlDeletedAtLeer("kos")}) AND (`),
    ).toBe(true);
    expect(sqlDeletedAtLeer("k")).toBe(
      `k.data->'deletedAt' IN ('null'::jsonb, '""'::jsonb, 'false'::jsonb, '0'::jsonb)`,
    );
  });

  it("die Referenz bleibt: ein gesetzter Zeitpunkt ist Papierkorb, ein Zahlenautor keine Autorschaft", () => {
    const trim = sqlSichtbarkeitFuer(BETRACHTER_4359);
    expect(
      trim.trifftZu({ confidentiality: "intern", deletedAt: "2026-09-22T00:00:00.000Z" }),
    ).toBe(false);
    for (const leer of [undefined, null, ""]) {
      expect(trim.trifftZu({ confidentiality: "intern", deletedAt: leer })).toBe(true);
    }
    const zahlAutor = { confidentiality: "vertraulich", author: 4359 } as unknown as Parameters<
      typeof trim.trifftZu
    >[0];
    expect(trim.trifftZu(zahlAutor)).toBe(false);
  });
});
