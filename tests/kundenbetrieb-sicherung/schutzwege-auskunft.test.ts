// ================================================================================================
// ADMIN-13 · DIE VIER SCHUTZWEGE AN `GET /api/admin/sicherungen` — an echten Dateien, echter Route.
// ================================================================================================
//
// Exportdatei, Backup-Lauf, Papierkorb und Restore-Nachweis sind verschiedene Schutzwege. Die
// Auskunft liest für jeden den Beleg, den es schon gibt (`letzter-lauf.json` von `backup.sh`,
// `letzter-drill.json` von `restore-drill.sh`, Audit, `trashed()`), und hält sie auseinander:
//
//   W1  ein vollständiges Drillprotokoll → `restore.zustand: "erfolg"` mit Datum, Sicherungsstand,
//       Ziel und vier Vergleichen
//   W2  Archiv + Prüfsummendatei OHNE Drillprotokoll → `unbekannt`, nie grün (K4)
//   W3  Exit 0, aber eine Kategorie nicht gemessen → `teilweise`; eine behauptete Gleichheit mit
//       abweichenden Zahlen → `abweichend`
//   W4  beschädigte Sicherung (Drill Exit 11) → `fehler` mit Exitcode und Prüfsummenbefund, während
//       dieselbe Datei in der Liste weiter nur „Prüfsummendatei vorhanden" trägt
//   W5  fehlendes Verzeichnis → Dateispuren `unbekannt` mit Grund; Export und Papierkorb antworten
//       trotzdem; die Quelle des Orts (`vorgabe`/`BACKUP_DIR`) steht dabei
//   W6  letzter Backup-Lauf (Fehler) mit Zeit, Exitcode und Grund
//   W7  Export und Papierkorb aus echtem Audit und echtem Papierkorb
//   W8  Rechte und Protokoll: 403 ohne `users.manage` ohne jede Auskunft; der Zugriff steht EINMAL
//       je Konto und Stunde in der Auditkette, die Verweigerung gar nicht
//   W9  keine Zugangsdaten: eine Anmeldung in einer Adresse im Protokoll wird maskiert
//
// Alle Daten sind fiktiv; jeder Fall legt sein eigenes temporäres Verzeichnis an.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const ADMIN = {
  name: "Ada Admin13",
  email: "ada-admin13@example.test",
  password: "geheim-admin13",
};
const OHNE_RECHT = { email: "bea-admin13@example.test", password: "geheim-admin13" };
const WEG = "/api/admin/sicherungen";
const DUMP = "klarwerk-20261009T030000Z.dump";
const HASH = "c".repeat(64);

let services: ReturnType<typeof buildServices>;
let app: ReturnType<typeof buildApp>;
let alsAdmin: Record<string, string>;
let ohneRecht: Record<string, string>;
let adminId = "";
const VORHER = process.env.BACKUP_DIR;
const ordner: string[] = [];

async function frischesVerzeichnis(): Promise<string> {
  const ort = await mkdtemp(join(tmpdir(), "klarwerk-admin13-"));
  ordner.push(ort);
  process.env.BACKUP_DIR = ort;
  return ort;
}

/** Eine Sicherung samt Sidecar, wie `backup.sh` sie veröffentlicht. */
async function sicherung(ort: string): Promise<void> {
  await writeFile(join(ort, DUMP), "fiktiver-dump");
  await writeFile(join(ort, `${DUMP}.sha256`), `${HASH}  ${DUMP}\n`);
}

function kategorie(tabellen: [string, number | null, number | null][], zustand = "gleich") {
  return {
    zustand,
    tabellen: tabellen.map(([tabelle, dump, datenbank]) => ({ tabelle, dump, datenbank })),
  };
}

/** Ein Drillprotokoll in der Form, die `restore-drill.sh` schreibt. */
function drillProtokoll(ueberschreiben: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    format: "klarwerk-restore-drill",
    formatVersion: 1,
    beginn: "2026-10-09T04:00:00Z",
    zeit: "2026-10-09T04:03:12Z",
    ergebnis: "erfolg",
    exitcode: 0,
    grund: "Drill bestanden: Restore in ein leeres Ziel.",
    sicherung: DUMP,
    pruefsumme: { zustand: "passt", sha256: HASH },
    ziel: "klarwerk_drill_test_20261009",
    vergleich: {
      beitraege: kategorie([
        ["kos", 3, 3],
        ["ko_versions", 4, 4],
      ]),
      anhaenge: {
        ...kategorie([
          ["objects", 1, 1],
          ["ko_evidence", 1, 1],
        ]),
        belegeOhneAnhang: 0,
      },
      beziehungen: kategorie([
        ["ko_kanten", 1, 1],
        ["ko_kanten_beitrag", 1, 1],
      ]),
      rechte: {
        ...kategorie([["users", 2, 2]]),
        rollenDump: "admin/t=1 experte/t=1",
        rollenDatenbank: "admin/t=1 experte/t=1",
      },
    },
    wissensnachweis: "Wissensobjekt ko-1 mit Beleg auf obj-1 (Belegzeile ev-1) zurueckgelesen.",
    ...ueberschreiben,
  };
}

interface Auskunft {
  zustand: string;
  sicherungen?: { datei: string; beglaubigt: boolean }[];
  error?: string;
  schutzwege?: {
    verzeichnisQuelle: string;
    letzterLauf: Record<string, unknown>;
    restore: Record<string, unknown> & {
      vergleich?: Record<string, { zustand: string }>;
      pruefsumme?: { zustand: string; sha256: string | null };
    };
    export: Record<string, unknown> & {
      bibliothek?: { zeitUtc: string; format: string | null; gesamt: number } | null;
      auditkette?: { gesamt: number } | null;
    };
    papierkorb: Record<string, unknown>;
  };
}

async function frage(headers: Record<string, string>): Promise<{
  status: number;
  koerper: Auskunft;
  roh: string;
}> {
  const antwort = await app.inject({ method: "GET", url: WEG, headers });
  return { status: antwort.statusCode, koerper: antwort.json() as Auskunft, roh: antwort.body };
}

beforeAll(async () => {
  services = buildServices();
  app = buildApp(services);
  const reg = await app.inject({ method: "POST", url: "/api/auth/register", payload: ADMIN });
  const angelegtesKonto = reg.json() as { id?: string; user?: { id: string } };
  adminId = angelegtesKonto.user?.id ?? angelegtesKonto.id ?? "";
  expect(adminId, "das Adminkonto trägt keine Kennung").not.toBe("");
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADMIN.email, password: ADMIN.password },
  });
  alsAdmin = { authorization: `Bearer ${(login.json() as { token: string }).token}` };
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: alsAdmin,
    payload: { name: "Bea Experte13", ...OHNE_RECHT, role: "experte" },
  });
  expect(angelegt.statusCode, "die Identität ohne Recht muss anlegbar sein").toBe(201);
  const fremd = await app.inject({ method: "POST", url: "/api/auth/login", payload: OHNE_RECHT });
  ohneRecht = { authorization: `Bearer ${(fremd.json() as { token: string }).token}` };
});

afterEach(() => {
  delete process.env.BACKUP_DIR;
});

afterAll(async () => {
  for (const ort of ordner) {
    await rm(ort, { recursive: true, force: true });
  }
  if (VORHER === undefined) {
    delete process.env.BACKUP_DIR;
  } else {
    process.env.BACKUP_DIR = VORHER;
  }
});

describe("ADMIN-13 · W1 · ein vollständiges Drillprotokoll ist ein belegter Restore", () => {
  it("Datum, Sicherungsstand, isoliertes Ziel und vier Vergleiche stehen in der Auskunft", async () => {
    const ort = await frischesVerzeichnis();
    await sicherung(ort);
    await writeFile(join(ort, "letzter-drill.json"), JSON.stringify(drillProtokoll()));

    const { status, koerper } = await frage(alsAdmin);
    expect(status).toBe(200);
    const restore = koerper.schutzwege?.restore;
    expect(restore?.zustand).toBe("erfolg");
    expect(restore?.exitcode).toBe(0);
    expect(restore?.beginnUtc).toBe("2026-10-09T04:00:00.000Z");
    expect(restore?.zeitUtc).toBe("2026-10-09T04:03:12.000Z");
    expect(restore?.sicherung).toBe(DUMP);
    expect(restore?.sicherungZeitpunktUtc).toBe("2026-10-09T03:00:00.000Z");
    expect(restore?.ziel).toBe("klarwerk_drill_test_20261009");
    expect(restore?.pruefsumme).toEqual({ zustand: "passt", sha256: HASH });
    for (const k of ["beitraege", "anhaenge", "beziehungen", "rechte"]) {
      expect(restore?.vergleich?.[k]?.zustand, k).toBe("gleich");
    }
    expect(koerper.schutzwege?.verzeichnisQuelle).toBe("BACKUP_DIR");
  });
});

describe("ADMIN-13 · W2 · Archiv und Prüfsumme allein ergeben keine Restore-Aussage (K4)", () => {
  it("ohne Drillprotokoll ist der Restore `unbekannt` mit Grund — auch bei beglaubigter Sicherung", async () => {
    const ort = await frischesVerzeichnis();
    await sicherung(ort);

    const { koerper } = await frage(alsAdmin);
    expect(koerper.sicherungen?.[0]?.beglaubigt, "die Sicherung trägt ihre Prüfsummendatei").toBe(
      true,
    );
    expect(koerper.schutzwege?.restore).toEqual({ zustand: "unbekannt", grund: "fehlt" });
    expect(koerper.schutzwege?.letzterLauf).toEqual({ zustand: "unbekannt", grund: "fehlt" });
  });

  it("ein Protokoll fremder Form ist `ungueltig`, nicht grün", async () => {
    const ort = await frischesVerzeichnis();
    await sicherung(ort);
    await writeFile(join(ort, "letzter-drill.json"), JSON.stringify({ ergebnis: "erfolg" }));
    const { koerper } = await frage(alsAdmin);
    expect(koerper.schutzwege?.restore).toEqual({ zustand: "unbekannt", grund: "ungueltig" });

    await writeFile(join(ort, "letzter-drill.json"), "{kein json");
    const zweite = await frage(alsAdmin);
    expect(zweite.koerper.schutzwege?.restore).toEqual({
      zustand: "unbekannt",
      grund: "ungueltig",
    });
  });

  it("Exit 0 mit passender Prüfsumme, aber ohne Ziel ist nicht grün", async () => {
    const ort = await frischesVerzeichnis();
    await writeFile(
      join(ort, "letzter-drill.json"),
      JSON.stringify(drillProtokoll({ ziel: null })),
    );
    const { koerper } = await frage(alsAdmin);
    expect(koerper.schutzwege?.restore?.zustand).toBe("teilweise");
  });
});

describe("ADMIN-13 · W3 · Lücken und Widersprüche im Vergleich", () => {
  it("eine nicht gemessene Kategorie macht aus Exit 0 `teilweise`", async () => {
    const ort = await frischesVerzeichnis();
    const p = drillProtokoll();
    const vergleich = p.vergleich as Record<string, unknown>;
    vergleich.rechte = {
      ...kategorie([["users", 2, 2]], "nicht_gemessen"),
      rollenDump: null,
      rollenDatenbank: null,
    };
    await writeFile(join(ort, "letzter-drill.json"), JSON.stringify(p));

    const restore = (await frage(alsAdmin)).koerper.schutzwege?.restore;
    expect(restore?.zustand).toBe("teilweise");
    expect(restore?.vergleich?.rechte?.zustand).toBe("nicht_gemessen");
  });

  it("eine behauptete Gleichheit mit abweichenden Zahlen wird `abweichend` — nachgerechnet", async () => {
    const ort = await frischesVerzeichnis();
    const p = drillProtokoll();
    (p.vergleich as Record<string, unknown>).beziehungen = kategorie([
      ["ko_kanten", 3, 1],
      ["ko_kanten_beitrag", 1, 1],
    ]);
    await writeFile(join(ort, "letzter-drill.json"), JSON.stringify(p));

    const restore = (await frage(alsAdmin)).koerper.schutzwege?.restore;
    expect(restore?.vergleich?.beziehungen?.zustand).toBe("abweichend");
    expect(restore?.zustand, "ein Widerspruch darf nie grün werden").not.toBe("erfolg");
  });
});

describe("ADMIN-13 · W4 · beschädigte Sicherung: sichtbarer Fehlbefund (K5)", () => {
  it("Drill Exit 11 → `fehler` mit Exitcode, Grund und Prüfsummenbefund `abweichend`", async () => {
    const ort = await frischesVerzeichnis();
    await sicherung(ort);
    await writeFile(
      join(ort, "letzter-drill.json"),
      JSON.stringify(
        drillProtokoll({
          ergebnis: "fehler",
          exitcode: 11,
          grund:
            "Pruefsumme passt nicht zum Dump - die Sicherung ist beschaedigt, es wurde nichts wiederhergestellt.",
          pruefsumme: { zustand: "abweichend", sha256: "d".repeat(64) },
          vergleich: {
            beitraege: kategorie(
              [
                ["kos", null, null],
                ["ko_versions", null, null],
              ],
              "nicht_gemessen",
            ),
            anhaenge: { ...kategorie([], "nicht_gemessen"), belegeOhneAnhang: null },
            beziehungen: kategorie([], "nicht_gemessen"),
            rechte: { ...kategorie([], "nicht_gemessen"), rollenDump: null, rollenDatenbank: null },
          },
          wissensnachweis: null,
        }),
      ),
    );

    const { koerper } = await frage(alsAdmin);
    const restore = koerper.schutzwege?.restore;
    expect(restore?.zustand).toBe("fehler");
    expect(restore?.exitcode).toBe(11);
    expect(String(restore?.grund)).toContain("beschaedigt");
    expect(restore?.pruefsumme?.zustand).toBe("abweichend");
    // Getrennte Nachweise: die Liste sagt weiter nur, dass die Prüfsummendatei daneben liegt.
    expect(koerper.sicherungen?.[0]?.beglaubigt).toBe(true);
  });
});

describe("ADMIN-13 · W5 · fehlendes Verzeichnis: unbekannt mit Grund, kein Rückschluss", () => {
  it("die Dateispuren sind `kein_verzeichnis`, Export und Papierkorb antworten trotzdem", async () => {
    const ort = await frischesVerzeichnis();
    process.env.BACKUP_DIR = join(ort, "gibt-es-nicht");

    const { koerper } = await frage(alsAdmin);
    expect(koerper.zustand).toBe("kein_verzeichnis");
    expect(koerper.schutzwege?.letzterLauf).toEqual({
      zustand: "unbekannt",
      grund: "kein_verzeichnis",
    });
    expect(koerper.schutzwege?.restore).toEqual({
      zustand: "unbekannt",
      grund: "kein_verzeichnis",
    });
    expect(koerper.schutzwege?.papierkorb?.zustand).toBe("gelesen");
    expect(["vorhanden", "keiner"]).toContain(koerper.schutzwege?.export?.zustand);
  });

  it("ohne BACKUP_DIR nennt die Auskunft die Vorgabe als Quelle des Orts", async () => {
    delete process.env.BACKUP_DIR;
    const { koerper } = await frage(alsAdmin);
    expect(koerper.schutzwege?.verzeichnisQuelle).toBe("vorgabe");
  });
});

describe("ADMIN-13 · W6 · der letzte Backup-Lauf mit Zeit, Exitcode und Grund", () => {
  it("ein gescheiterter Lauf aus `letzter-lauf.json` ist `fehler` — die Zeit im Namensformat gelesen", async () => {
    const ort = await frischesVerzeichnis();
    await writeFile(
      join(ort, "letzter-lauf.json"),
      JSON.stringify({
        zeit: "20261009T030001Z",
        ergebnis: "fehler",
        grund: "pg_dump endete mit Exit 1.",
        exitcode: 1,
        datei: null,
        bytes: null,
        sha256: null,
      }),
    );
    const lauf = (await frage(alsAdmin)).koerper.schutzwege?.letzterLauf;
    expect(lauf).toEqual({
      zustand: "fehler",
      zeitUtc: "2026-10-09T03:00:01.000Z",
      exitcode: 1,
      grund: "pg_dump endete mit Exit 1.",
      datei: null,
    });
  });
});

describe("ADMIN-13 · W7 · Export und Papierkorb aus echtem Bestand", () => {
  it("ein Bibliotheksexport und ein Papierkorbgang erscheinen mit Zeitpunkt und Zahl", async () => {
    await frischesVerzeichnis();
    const exportiert = await app.inject({
      method: "GET",
      url: "/api/library/export?format=markdown",
      headers: alsAdmin,
    });
    expect(exportiert.statusCode).toBe(200);

    const ko = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: alsAdmin,
      payload: {
        confidentiality: "intern",
        title: "Fiktives Ventil 13",
        statement: "Bei Überdruck das fiktive Ventil schließen.",
        type: "best_practice",
        category: "Probeanlage",
      },
    });
    expect(ko.statusCode, ko.body).toBe(201);
    const koId = (ko.json() as { id: string }).id;
    const geloescht = await app.inject({
      method: "DELETE",
      url: `/api/kos/${koId}`,
      headers: alsAdmin,
    });
    expect(geloescht.statusCode, geloescht.body).toBeLessThan(300);

    const nachLoeschen = (await frage(alsAdmin)).koerper.schutzwege;
    expect(nachLoeschen?.export?.zustand).toBe("vorhanden");
    expect(nachLoeschen?.export?.bibliothek?.format).toBe("markdown");
    expect(nachLoeschen?.export?.bibliothek?.gesamt).toBeGreaterThanOrEqual(1);
    expect(nachLoeschen?.papierkorb?.zustand).toBe("gelesen");
    expect(nachLoeschen?.papierkorb?.anzahl).toBeGreaterThanOrEqual(1);
    expect(nachLoeschen?.papierkorb?.aufbewahrungTage).toBe(30);
    expect(typeof nachLoeschen?.papierkorb?.naechsteEndloeschungUtc).toBe("string");
    expect(nachLoeschen?.papierkorb?.ereignisseProtokolliert).toBe(true);

    const zurueck = await app.inject({
      method: "POST",
      url: `/api/kos/${koId}/restore`,
      headers: alsAdmin,
    });
    expect(zurueck.statusCode, zurueck.body).toBeLessThan(300);
    const nachWiederherstellen = (await frage(alsAdmin)).koerper.schutzwege?.papierkorb;
    expect(typeof nachWiederherstellen?.letzteWiederherstellungUtc).toBe("string");
  });
});

describe("ADMIN-13 · W8 · berechtigt, protokolliert, gegen eine unberechtigte Rolle geprüft", () => {
  it("ohne `users.manage`: 403 ohne jede Schutzwegauskunft und ohne Protokolleintrag", async () => {
    const ort = await frischesVerzeichnis();
    await writeFile(join(ort, "letzter-drill.json"), JSON.stringify(drillProtokoll()));
    const vorher = (await services.audit.list({ action: "admin.sicherungen.gelesen" })).length;

    const { status, koerper, roh } = await frage(ohneRecht);
    expect(status).toBe(403);
    expect(koerper.error).toBe("FORBIDDEN");
    expect(koerper.schutzwege).toBeUndefined();
    expect(roh).not.toContain("klarwerk_drill_test_20261009");
    const nachher = (await services.audit.list({ action: "admin.sicherungen.gelesen" })).length;
    expect(nachher, "die Verweigerung hat nichts herausgegeben und steht nicht im Protokoll").toBe(
      vorher,
    );
  });

  it("der berechtigte Zugriff steht in der Auditkette — einmal je Konto und Stunde", async () => {
    await frischesVerzeichnis();
    const stunde = new Date().toISOString().slice(0, 13);
    await frage(alsAdmin);
    await frage(alsAdmin);
    const eintraege = await services.audit.list({ action: "admin.sicherungen.gelesen" });
    const dieseStunde = eintraege.filter(
      (e) => e.actor === adminId && e.eventId?.endsWith(`:${stunde}`),
    );
    expect(dieseStunde, "Zugriff nicht protokolliert").toHaveLength(1);
    expect(dieseStunde[0]?.target).toBe("sicherungen");
  });
});

// ------------------------------------------------------------------------------------------------
// W10 · NACHARBEIT 2 (Bens Befund): behaupteter Erfolg ohne Nachweis oder mit Widerspruch.
// ------------------------------------------------------------------------------------------------
describe("ADMIN-13 · W10 · Erfolg nur mit vollständigem, widerspruchsfreiem Protokoll", () => {
  async function restoreAus(p: Record<string, unknown>) {
    const ort = await frischesVerzeichnis();
    await writeFile(join(ort, "letzter-drill.json"), JSON.stringify(p));
    return (await frage(alsAdmin)).koerper.schutzwege?.restore;
  }

  it("W1-Protokoll ohne beginn, zeit, sicherung und sha256 ist `teilweise` mit benannten Lücken", async () => {
    const p = drillProtokoll({ pruefsumme: { zustand: "passt", sha256: null } });
    p.beginn = undefined;
    p.zeit = undefined;
    p.sicherung = undefined;
    const restore = await restoreAus(p);
    expect(restore?.zustand).toBe("teilweise");
    expect(restore?.luecken).toEqual(["beginn", "zeit", "sicherung", "sha256"]);
    expect(restore?.widersprueche).toEqual([]);
  });

  it("abweichende Rollenverteilung bei behauptetem `gleich` ist ein Fehler, kein Grün", async () => {
    const p = drillProtokoll();
    (p.vergleich as Record<string, unknown>).rechte = {
      ...kategorie([["users", 2, 2]]),
      rollenDump: "admin/t=1 experte/t=1",
      rollenDatenbank: "admin/t=2",
    };
    const restore = await restoreAus(p);
    expect(restore?.zustand).toBe("fehler");
    expect(restore?.vergleich?.rechte?.zustand).toBe("abweichend");
    expect(restore?.widersprueche).toEqual(["rechte", "rollen"]);
  });

  it("fehlende Rollenverteilung bei behauptetem `gleich` ist eine Lücke", async () => {
    const p = drillProtokoll();
    (p.vergleich as Record<string, unknown>).rechte = {
      ...kategorie([["users", 2, 2]]),
      rollenDump: null,
      rollenDatenbank: null,
    };
    const restore = await restoreAus(p);
    expect(restore?.zustand).toBe("teilweise");
    expect(restore?.luecken).toEqual(["rechte", "rollen"]);
  });

  it("belegeOhneAnhang > 0 bei behauptetem `gleich` ist ein Fehler", async () => {
    const p = drillProtokoll();
    (p.vergleich as Record<string, unknown>).anhaenge = {
      ...kategorie([
        ["objects", 1, 1],
        ["ko_evidence", 1, 1],
      ]),
      belegeOhneAnhang: 2,
    };
    const restore = await restoreAus(p);
    expect(restore?.zustand).toBe("fehler");
    expect(restore?.vergleich?.anhaenge?.zustand).toBe("abweichend");
    expect(restore?.widersprueche).toEqual(["anhaenge", "belege_ohne_anhang"]);
  });

  it("`erfolg` mit Exitcode ≠ 0 und abweichender Prüfsumme sind Widersprüche", async () => {
    const restore = await restoreAus(
      drillProtokoll({ exitcode: 3, pruefsumme: { zustand: "abweichend", sha256: HASH } }),
    );
    expect(restore?.zustand).toBe("fehler");
    expect(restore?.widersprueche).toEqual(["exitcode", "pruefsumme"]);
  });

  it("das vollständige Protokoll bleibt grün und ohne Lücken", async () => {
    const restore = await restoreAus(drillProtokoll());
    expect(restore?.zustand).toBe("erfolg");
    expect(restore?.luecken).toEqual([]);
    expect(restore?.widersprueche).toEqual([]);
  });
});

describe("ADMIN-13 · W9 · Nachweise enthalten keine Zugangsdaten", () => {
  it("eine Anmeldung in einer Adresse im Protokoll wird maskiert", async () => {
    const ort = await frischesVerzeichnis();
    await writeFile(
      join(ort, "letzter-drill.json"),
      JSON.stringify(
        drillProtokoll({
          ziel: "postgres://drill:streng-geheim-13@db.intern:5432/klarwerk_drill_test",
          grund: "Verbindung postgres://drill:streng-geheim-13@db.intern scheiterte.",
        }),
      ),
    );
    const { roh, koerper } = await frage(alsAdmin);
    expect(koerper.schutzwege?.restore?.zustand, "ohne Protokoll misst der Fall nichts").toBe(
      "erfolg",
    );
    expect(roh).not.toContain("streng-geheim-13");
    expect(roh).not.toContain("drill:");
    expect(String(koerper.schutzwege?.restore?.ziel)).toContain("postgres://***@");
  });
});
