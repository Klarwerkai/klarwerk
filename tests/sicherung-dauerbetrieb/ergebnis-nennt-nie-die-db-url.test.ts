// ================================================================================================
// JOB 4057 · L3b — DIE ERGEBNISSPUR IST EINE NEUE STELLE, AN DER EIN GEHEIMNIS AUSTRETEN KÖNNTE.
// ================================================================================================
//
// `scripts/backup/backup.sh:9-10` sagt zu: „die DB-URL wird NICHT geloggt/ausgegeben", und `:66`
// begründet, warum sie nur im Argument von `pg_dump` steht. `letzter-lauf.json` ist die erste
// Datei, die dieses Skript DAUERHAFT neben den Dumps ablegt — sie darf die Zusage nicht brechen.
//
// Gemessen wird mit einer URL, die ein erkennbares Passwort UND einen erkennbaren Hostnamen trägt:
// in der Datei darf keines von beiden vorkommen, und auf stdout/stderr ebenso wenig.
import { describe, expect, it } from "vitest";
import { lauf } from "./lauf";

const PASSWORT = "GEHEIM-passwort-4057";
const HOST = "db-geheim.beispiel.invalid";
const URL = `postgres://klarwerk:${PASSWORT}@${HOST}:5432/klarwerk_prod`;

describe("L3b · die Ergebnisspur nennt nie die DB-URL", () => {
  it("erfolgreicher Lauf: Exit 0 und ergebnis=erfolg", () => {
    const r = lauf({ dbUrl: URL });
    expect(r.code, r.ausgabe).toBe(0);
    expect(r.ergebnis().ergebnis).toBe("erfolg");
  });

  it("weder Passwort noch Hostname stehen in letzter-lauf.json", () => {
    const r = lauf({ dbUrl: URL });
    const roh = String(r.ergebnisRoh);
    expect(roh).not.toContain(PASSWORT);
    expect(roh).not.toContain(HOST);
    expect(roh).not.toContain("postgres://");
  });

  it("Gegenprobe: dieselbe Suche über stdout und stderr des Laufs", () => {
    const r = lauf({ dbUrl: URL });
    expect(r.ausgabe).not.toContain(PASSWORT);
    expect(r.ausgabe).not.toContain(HOST);
    expect(r.ausgabe).not.toContain("postgres://");
  });

  it("auch keine andere Datei im Zielverzeichnis trägt die URL", () => {
    const r = lauf({ dbUrl: URL });
    for (const [name, inhalt] of Object.entries(r.inhalt)) {
      expect(inhalt, `Datei ${name}`).not.toContain(PASSWORT);
      expect(inhalt, `Datei ${name}`).not.toContain(HOST);
    }
  });

  it("die Suche ist scharf: das Passwort war wirklich im Spiel", () => {
    // Ohne diesen Fall wäre die Negativzusicherung wertlos — sie wäre auch grün, wenn das Skript
    // die URL nie erhalten hätte. Die Attrappe belegt: `pg_dump` bekam genau diese URL.
    const r = lauf({ dbUrl: URL });
    const dumpaufruf = r.aufrufe.find((a) => a[0] === "pg_dump");
    expect(dumpaufruf?.at(-1), JSON.stringify(r.aufrufe)).toBe(URL);
  });

  it("auch der gescheiterte Lauf mit URL schweigt über sie", () => {
    const r = lauf({ dbUrl: URL, modus: "unlesbar" });
    expect(r.code, r.ausgabe).toBe(4);
    expect(String(r.ergebnisRoh)).not.toContain(PASSWORT);
    expect(r.ausgabe).not.toContain(PASSWORT);
  });
});
