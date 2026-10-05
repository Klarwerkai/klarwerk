// Aufnahme gesamt-auditprotokoll · FR-AUD-02 / R-0613 / R-2126 / R-2206 / R-0670.
//
// ZWEI AUSSAGEN, AM DRAHT GEMESSEN:
//
//  1. APPEND-ONLY ÜBER DIE SCHNITTSTELLE. R-2206 führte als Rest: „Append-only-Verweigerung über
//     sämtliche schreibenden API-Methoden nicht geprüft". Hier klopft der Admin — die stärkste
//     Rolle — mit POST, PUT, PATCH und DELETE an jede Adresse unter `/api/audit` (Sammlung, einzelner
//     Eintrag, Prüfung, Export). Keine Anfrage darf durchgehen, und die Kette ist danach Eintrag für
//     Eintrag dieselbe. Dazu die Ablagen selbst: weder die Speicher- noch die PostgreSQL-Ablage
//     bietet eine Methode zum Ändern oder Löschen an — hier nur am Methodennamen gemessen, auf der
//     Speicherbühne. Die Verweigerung an vorhandenen Einträgen AUF POSTGRESQL (jede Schreibmethode,
//     HTTP, Löschwege) steht in `append-only-verweigerung.integration.test.ts` (Lauf 5, BEN-L5-B2);
//     der statische Beleg unten zeigt, dass kein Produktcode ändernde SQL auf `audit` absetzt.
//
//  2. DER EXPORT (R-0613: „ein externer Anker und ein Export fehlen"). `GET /api/audit/export`
//     liefert die ganze Kette, ihren Prüfbericht und den Kopf (letzte Nummer + Hash). Der Kopf ist
//     der Wert, der außerhalb abgelegt wird: eine Datei, deren Einträge nachträglich geändert
//     wurden, fällt beim Nachrechnen auf; eine neu gebildete Kette hat einen anderen Kopf. Der
//     Abruf selbst wird als `audit.exported` angehängt.
//
// Was hier bewusst NICHT behauptet wird: dass eine Änderung direkt in der Datenbank verhindert wird.
// Wer die Datenbank beherrscht, kann die Kette neu bilden — erst der außerhalb abgelegte Kopf macht
// das sichtbar, und diese Ablage ist Betreiberhandlung, keine Produktfunktion.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  type AuditEntry,
  InMemoryAuditRepo,
  PgAuditRepo,
  hashEntryFuerVersion,
  verifyChain,
} from "../../services/audit";
import { baueFrischeBuehne, schliesseBuehnen } from "../beta-rollenabnahme/buehne";

afterEach(async () => {
  await schliesseBuehnen();
});

const METHODEN = ["POST", "PUT", "PATCH", "DELETE"] as const;

interface ExportDatei {
  format: string;
  formatVersion: number;
  exportedAt: string;
  count: number;
  head: { seq: number; hash: string } | null;
  inspection: { ok: boolean; count: number };
  entries: AuditEntry[];
}

describe("FR-AUD-02 · keine schreibende Methode am Protokoll (HTTP)", () => {
  it("POST/PUT/PATCH/DELETE auf jede /api/audit-Adresse wird abgewiesen, die Kette bleibt bitgleich", async () => {
    const b = await baueFrischeBuehne();
    const admin = { authorization: `Bearer ${b.sitzung.admin}` };
    const vorher = await b.services.audit.list();
    expect(vorher.length).toBeGreaterThan(0);
    const erster = vorher[0] as AuditEntry;

    const adressen = [
      "/api/audit",
      `/api/audit/${erster.seq}`,
      "/api/audit/verify",
      "/api/audit/export",
      `/api/audit/ko/${erster.target}/findings`,
      `/api/audit?seq=${erster.seq}`,
    ];
    for (const url of adressen) {
      for (const method of METHODEN) {
        const res = await b.app.inject({
          method,
          url,
          headers: admin,
          payload: { seq: erster.seq, actor: "jemand-anders", action: "ko.deleted" },
        });
        expect(
          [404, 405],
          `${method} ${url} → ${res.statusCode} ${res.body.slice(0, 200)}`,
        ).toContain(res.statusCode);
      }
    }

    const nachher = await b.services.audit.list();
    expect(nachher).toEqual(vorher);
    expect((await b.services.audit.verifyReport()).ok).toBe(true);
    await b.schliesse();
  });

  it("die Ablagen bieten weder Ändern noch Löschen an (Speicher und PostgreSQL)", () => {
    const verboten = /^(update|delete|remove|clear|truncate|set|put|replace|patch|rewrite)/i;
    for (const Ablage of [InMemoryAuditRepo, PgAuditRepo]) {
      const methoden = Object.getOwnPropertyNames(Ablage.prototype).filter(
        (n) => n !== "constructor",
      );
      expect(methoden).toContain("append");
      expect(
        methoden.filter((n) => verboten.test(n)),
        `${Ablage.name} bietet eine ändernde Methode an`,
      ).toEqual([]);
    }
  });
});

// Lauf 5 (BEN-L5-B2): der Datenbankweg. Ändern oder Löschen in `audit` ginge nur über SQL; kein
// Produktquelltext (services/**, tools/**, ohne Tests) setzt ein UPDATE, DELETE, TRUNCATE oder DROP
// auf diese Tabelle ab. Kommentare werden vorher entfernt — erklärende Prosa nennt die Wörter.
function produktQuellen(verzeichnis: string): string[] {
  return readdirSync(verzeichnis, { withFileTypes: true }).flatMap((e) => {
    const pfad = join(verzeichnis, e.name);
    if (e.isDirectory()) {
      return e.name === "node_modules" ? [] : produktQuellen(pfad);
    }
    return /\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name) ? [pfad] : [];
  });
}

describe("FR-AUD-02 · kein Produktcode ändert oder löscht Zeilen in audit (statisch)", () => {
  it("services/** und tools/** enthalten kein UPDATE/DELETE/TRUNCATE/DROP auf audit", () => {
    const wurzel = new URL("../../", import.meta.url).pathname;
    const dateien = [
      ...produktQuellen(join(wurzel, "services")),
      ...produktQuellen(join(wurzel, "tools")),
    ];
    expect(dateien.length).toBeGreaterThan(100);
    const muster =
      /\b(UPDATE\s+audit|DELETE\s+FROM\s+audit|TRUNCATE\s+(TABLE\s+)?audit|DROP\s+TABLE\s+(IF\s+EXISTS\s+)?audit|ALTER\s+TABLE\s+audit\s+DROP)\b/i;
    // Kalibrierung: das Muster greift auf genau die Formen, die es ausschließen soll.
    for (const probe of [
      'q("UPDATE audit SET actor=$1")',
      "DELETE FROM audit WHERE seq = 1",
      "TRUNCATE TABLE audit",
      "DROP TABLE IF EXISTS audit",
    ]) {
      expect(muster.test(probe), probe).toBe(true);
    }
    expect(muster.test("SELECT * FROM audit; UPDATE audit_x SET a=1")).toBe(false);
    const treffer = dateien.filter((datei) => {
      const code = readFileSync(datei, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
      return muster.test(code);
    });
    expect(treffer).toEqual([]);
  });
});

describe("R-0613 · Export der Kette mit Kopf (HTTP)", () => {
  it("liefert Einträge, Prüfbericht und Kopf — und hängt den Abruf als audit.exported an", async () => {
    const b = await baueFrischeBuehne();
    const controller = { authorization: `Bearer ${b.sitzung.controller}` };
    const vorher = await b.services.audit.list();

    const res = await b.app.inject({
      method: "GET",
      url: "/api/audit/export",
      headers: controller,
    });
    expect(res.statusCode, res.body.slice(0, 200)).toBe(200);
    expect(res.headers["content-disposition"]).toMatch(
      /^attachment; filename="klarwerk-audit-.+\.json"$/,
    );
    const datei = res.json() as ExportDatei;

    expect(datei.format).toBe("klarwerk-audit-export");
    expect(datei.formatVersion).toBe(1);
    expect(datei.count).toBe(vorher.length);
    expect(datei.entries).toEqual(vorher);
    expect(datei.inspection.ok).toBe(true);
    expect(datei.inspection.count).toBe(vorher.length);
    const letzter = vorher.at(-1) as AuditEntry;
    expect(datei.head).toEqual({ seq: letzter.seq, hash: letzter.hash });

    // Die Datei ist ohne Anwendung nachrechenbar: jeder Hash aus seinem Material, jede Verkettung.
    expect(verifyChain(datei.entries)).toBe(true);
    for (const e of datei.entries) {
      const { hash, ...material } = e;
      expect(hashEntryFuerVersion(material)).toBe(hash);
    }

    // Der Abruf ist selbst belegt — hinter dem exportierten Kopf, mit dem Kopf im Payload.
    const nachher = await b.services.audit.list();
    const beleg = nachher.at(-1) as AuditEntry;
    expect(beleg.action).toBe("audit.exported");
    expect(beleg.actor).toBe(b.konto.controller.id);
    expect(beleg.seq).toBe(letzter.seq + 1);
    expect(beleg.prevHash).toBe(letzter.hash);
    expect(beleg.payload).toEqual({
      count: vorher.length,
      headSeq: letzter.seq,
      headHash: letzter.hash,
    });
    expect((await b.services.audit.verifyReport()).ok).toBe(true);
    await b.schliesse();
  });

  it("eine nachträglich geänderte Exportdatei fällt beim Nachrechnen auf", async () => {
    const b = await baueFrischeBuehne();
    const admin = { authorization: `Bearer ${b.sitzung.admin}` };
    const datei = (
      await b.app.inject({ method: "GET", url: "/api/audit/export", headers: admin })
    ).json() as ExportDatei;
    expect(verifyChain(datei.entries)).toBe(true);
    const manipuliert = datei.entries.map((e, i) =>
      i === 1 ? { ...e, actor: "jemand-anders" } : e,
    );
    expect(verifyChain(manipuliert)).toBe(false);
    await b.schliesse();
  });

  it("Betrachter und Experte bekommen den Export nicht (dieselbe Tür wie /api/audit)", async () => {
    const b = await baueFrischeBuehne();
    for (const rolle of ["viewer", "experte"] as const) {
      const res = await b.app.inject({
        method: "GET",
        url: "/api/audit/export",
        headers: { authorization: `Bearer ${b.sitzung[rolle]}` },
      });
      expect(res.statusCode, rolle).toBe(403);
    }
    expect(await b.services.audit.list({ action: "audit.exported" })).toEqual([]);
    await b.schliesse();
  });
});
