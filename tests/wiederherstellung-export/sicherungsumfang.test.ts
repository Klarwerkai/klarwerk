// ================================================================================================
// produkt:20261010:poc-wiederherstellung-export · PV-01-01 / PV-01-03 — DER SICHERUNGSUMFANG.
// ================================================================================================
//
//   U1  Jede Tabelle eines Bereichs „im Dump" legt die Migration an UND prüft der Restore-Drill —
//       sonst stünde ein Bereich als gesichert da, den keine Probe je anfasst.
//   U2  Die Kategorie `assistenz` im Drillprotokoll führt GENAU die Tabellen der privaten
//       Assistenzbereiche — eine Wahrheit, am Skripttext gelesen.
//   U3  Persönliche Gespräche, Aufgaben, Name und Avatare sind je einzeln eingeordnet; was diese
//       Fassung nicht hat, steht als `nicht_vorhanden` ohne Tabelle und ohne Beleg.
//   U4  Jeder Bereich hat Titel und Text (Grund, Folge) in DE/EN/NL.
//   U5  KEIN RÜCKWIRKENDER BELEG: ein grünes Drillprotokoll ohne Kategorie `assistenz` (ältere
//       Fassung des Drills) belegt die Assistenzbereiche NICHT; erst ein Protokoll mit beiden Zahlen
//       je Tabelle tut es. Eine abweichende Zahl ist ein Widerspruch. Alles an der echten Route.
//   U6  Die Auskunft ist an die laufende Fassung gebunden (Version, Commit, Tabellenzahl).
//
// Alle Daten sind fiktiv; jeder Fall legt sein eigenes temporäres Verzeichnis an.
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import sicherungsTexte from "../../apps/web/src/texte/sicherungsnachweise";
import { buildApp, buildServices, buildVersion } from "../../services/app/src/build-app";
import { DATENINVENTAR } from "../../services/app/src/dateninventar";
import { schemas } from "../../services/app/src/db";
import {
  SICHERUNGSUMFANG,
  assistenzTabellen,
  belegFuer,
  tabellenDerStufen,
} from "../../services/app/src/sicherungsumfang";
import { pflichttabellenAusDrill, tabellenAusSchemas } from "../backup-drill/pflichtsatz";

const WURZEL = resolve(import.meta.dirname, "../..");

describe("U1–U4 · der Umfang je Bereich, gebunden an Migration und Drill", () => {
  it("U1 · jede Tabelle eines Dump-Bereichs legt die Migration an und prüft der Drill", () => {
    const migriert = tabellenAusSchemas(schemas);
    const pflicht = pflichttabellenAusDrill();
    const tabellen = SICHERUNGSUMFANG.flatMap((b) => [...b.tabellen]);
    expect(tabellen.length, "Kalibrierung: der Umfang nennt überhaupt Tabellen").toBeGreaterThan(5);
    expect(tabellen.filter((t) => !migriert.includes(t))).toEqual([]);
    expect(tabellen.filter((t) => !pflicht.includes(t))).toEqual([]);
    // Dieselbe Lesung wie die Hilfe des Prüfstands — die Zahl in der Auskunft ist nicht abgeschrieben.
    expect(tabellenDerStufen(schemas)).toEqual(migriert);
  });

  it("U2 · `vergleich.assistenz` im Drill führt genau die Tabellen der Assistenzbereiche", () => {
    const skript = readFileSync(join(WURZEL, "scripts/backup/restore-drill.sh"), "utf8");
    const zeile = skript.split("\n").find((z) => z.includes('"assistenz":%s'));
    expect(zeile, "die Kategorie assistenz fehlt im Protokoll des Drills").toBeTruthy();
    const imDrill = (/vergleich_json "" ([a-z_ ]+)\)/.exec(zeile ?? "")?.[1] ?? "")
      .trim()
      .split(/\s+/);
    expect(imDrill).toEqual(assistenzTabellen());
    // Und jede davon ist im Dateninventar eine personenbezogene Datenart, also wirklich privat.
    for (const t of imDrill) {
      const art = DATENINVENTAR.find((d) => d.ablage.tabellen.includes(t));
      expect(art?.personenbezug, t).toBe("ja");
    }
  });

  it("U3 · Gespräche, Aufgaben, Name und Avatare stehen einzeln da — Nichtvorhandenes ohne Beleg", () => {
    const nach = new Map(SICHERUNGSUMFANG.map((b) => [b.id, b]));
    expect(nach.get("gespraeche")).toMatchObject({ zustand: "im_dump" });
    expect(nach.get("gespraeche")?.tabellen).toEqual(["klara_gespraeche"]);
    expect(nach.get("assistenzprofil")?.tabellen).toEqual(["assistenz_profile"]);
    expect(nach.get("avatarmotive")).toMatchObject({ zustand: "ausgeschlossen", tabellen: [] });
    expect(nach.get("eigeneavatare")).toMatchObject({ zustand: "nicht_vorhanden", tabellen: [] });
    expect(nach.get("aufgaben")).toMatchObject({ zustand: "nicht_vorhanden", tabellen: [] });
    expect(nach.get("endgeraet")).toMatchObject({ zustand: "ausgeschlossen", tabellen: [] });
    // Dump, Anhangsbytes und private Assistenzspeicher sind drei getrennte Einträge.
    expect(nach.get("datenbank")?.art).toBe("kern");
    expect(nach.get("anhangsbytes")?.tabellen).toEqual(["objects", "ko_evidence"]);
    for (const b of SICHERUNGSUMFANG.filter((x) => x.zustand !== "im_dump")) {
      expect(b.tabellen, b.id).toEqual([]);
      // Auch ein grünes Protokoll mit allen Zahlen belegt keinen Bereich außerhalb der Datenbank.
      expect(belegFuer(b, [{ tabelle: "kos", dump: 1, datenbank: 1 }], true), b.id).toBe(
        "kein_beleg",
      );
    }
  });

  it("U4 · jeder Bereich hat Titel und Text in DE, EN und NL", () => {
    for (const sprache of ["de", "en", "nl"] as const) {
      const block = sicherungsTexte[sprache] as Record<string, string>;
      for (const b of SICHERUNGSUMFANG) {
        for (const teil of ["titel", "text"]) {
          const schluessel = `sicherungsnachweise.bereiche.${b.id}.${teil}`;
          expect(block[schluessel]?.length ?? 0, `${sprache} ${schluessel}`).toBeGreaterThan(5);
        }
      }
      for (const z of ["im_dump", "ausgeschlossen", "nicht_vorhanden"]) {
        expect(block[`sicherungsnachweise.bereiche.zustand.${z}`], `${sprache} ${z}`).toBeTruthy();
      }
      for (const z of ["belegt", "abweichend", "nicht_gemessen", "kein_beleg"]) {
        expect(block[`sicherungsnachweise.bereiche.beleg.${z}`], `${sprache} ${z}`).toBeTruthy();
      }
    }
  });
});

// ------------------------------------------------------------------------------------------------
// U5/U6 — an der echten Route `GET /api/admin/sicherungen`.
// ------------------------------------------------------------------------------------------------

const ADMIN = { name: "Ada Umfang", email: "ada-umfang@example.test", password: "geheim-umfang-1" };
const DUMP = "klarwerk-20261010T030000Z.dump";
const HASH = "d".repeat(64);
const VORHER = process.env.BACKUP_DIR;
const ordner: string[] = [];
let app: ReturnType<typeof buildApp>;
let alsAdmin: Record<string, string>;

function kategorie(tabellen: [string, number | null, number | null][]) {
  return {
    zustand: "gleich",
    tabellen: tabellen.map(([tabelle, dump, datenbank]) => ({ tabelle, dump, datenbank })),
  };
}

/** Ein grünes Protokoll in der Form von ADMIN-13 — OHNE die Kategorie `assistenz`. */
function protokollOhneAssistenz(): Record<string, unknown> {
  return {
    format: "klarwerk-restore-drill",
    formatVersion: 1,
    beginn: "2026-10-10T04:00:00Z",
    zeit: "2026-10-10T04:02:00Z",
    ergebnis: "erfolg",
    exitcode: 0,
    grund: "Drill bestanden.",
    sicherung: DUMP,
    pruefsumme: { zustand: "passt", sha256: HASH },
    ziel: "klarwerk_ziel_test_umfang",
    vergleich: {
      beitraege: kategorie([
        ["kos", 3, 3],
        ["ko_versions", 5, 5],
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
        ...kategorie([["users", 3, 3]]),
        rollenDump: "admin/t=1 experte/t=2",
        rollenDatenbank: "admin/t=1 experte/t=2",
      },
    },
    wissensnachweis: "Wissensobjekt ko-1 zurueckgelesen.",
  };
}

function mitAssistenz(dbProfile = 2): Record<string, unknown> {
  const p = protokollOhneAssistenz();
  return {
    ...p,
    vergleich: {
      ...(p.vergleich as Record<string, unknown>),
      assistenz: kategorie([
        ["assistenz_profile", 2, dbProfile],
        ["klara_gespraeche", 1, 1],
        ["interaktions_gedaechtnis", 0, 0],
        ["klara_sessions", 0, 0],
        ["klara_session_consents", 0, 0],
      ]),
    },
  };
}

interface Bereich {
  id: string;
  zustand: string;
  beleg: string;
}
interface Antwort {
  umfang?: {
    produkt: { version: string; commit: string };
    tabellenImDump: number;
    bereiche: Bereich[];
  };
  schutzwege?: { restore: { zustand: string; widersprueche?: string[]; luecken?: string[] } };
}

async function auskunftMit(protokoll: Record<string, unknown> | null): Promise<Antwort> {
  const ort = await mkdtemp(join(tmpdir(), "klarwerk-umfang-"));
  ordner.push(ort);
  process.env.BACKUP_DIR = ort;
  await writeFile(join(ort, DUMP), "fiktiver-dump");
  await writeFile(join(ort, `${DUMP}.sha256`), `${HASH}  ${DUMP}\n`);
  if (protokoll) {
    await writeFile(join(ort, "letzter-drill.json"), JSON.stringify(protokoll));
  }
  const res = await app.inject({ method: "GET", url: "/api/admin/sicherungen", headers: alsAdmin });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Antwort;
}

const belegVon = (a: Antwort, id: string) => a.umfang?.bereiche.find((b) => b.id === id)?.beleg;

beforeAll(async () => {
  app = buildApp(buildServices());
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ADMIN });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADMIN.email, password: ADMIN.password },
  });
  alsAdmin = { authorization: `Bearer ${(login.json() as { token: string }).token}` };
});

afterEach(() => {
  delete process.env.BACKUP_DIR;
});

afterAll(async () => {
  for (const ort of ordner) {
    await rm(ort, { recursive: true, force: true });
  }
  if (VORHER !== undefined) {
    process.env.BACKUP_DIR = VORHER;
  }
});

describe("U5 · kein rückwirkender Sicherungsbeleg für später gelieferte Assistenzdaten", () => {
  it("ein grünes Protokoll ohne Kategorie `assistenz` belegt die Assistenzbereiche nicht", async () => {
    const a = await auskunftMit(protokollOhneAssistenz());
    // Die ADMIN-13-Probe selbst bleibt grün — ihre vier Kategorien sind belegt.
    expect(a.schutzwege?.restore.zustand).toBe("erfolg");
    expect(belegVon(a, "datenbank")).toBe("belegt");
    expect(belegVon(a, "anhangsbytes")).toBe("belegt");
    for (const id of ["assistenzprofil", "gespraeche", "gedaechtnis", "sitzungen"]) {
      expect(belegVon(a, id), id).toBe("nicht_gemessen");
    }
    for (const id of ["avatarmotive", "eigeneavatare", "aufgaben", "endgeraet"]) {
      expect(belegVon(a, id), id).toBe("kein_beleg");
    }
  });

  it("ein Protokoll mit beiden Zahlen je Assistenztabelle belegt die Bereiche", async () => {
    const a = await auskunftMit(mitAssistenz());
    expect(a.schutzwege?.restore.zustand).toBe("erfolg");
    for (const id of ["assistenzprofil", "gespraeche", "gedaechtnis", "sitzungen"]) {
      expect(belegVon(a, id), id).toBe("belegt");
    }
    expect(belegVon(a, "eigeneavatare")).toBe("kein_beleg");
  });

  it("eine abweichende Assistenzzahl ist ein Widerspruch — der Restore ist dann nicht grün", async () => {
    const a = await auskunftMit(mitAssistenz(1));
    expect(a.schutzwege?.restore.zustand).toBe("fehler");
    expect(a.schutzwege?.restore.widersprueche).toContain("assistenz");
    expect(belegVon(a, "assistenzprofil")).toBe("abweichend");
    expect(belegVon(a, "datenbank")).toBe("nicht_gemessen");
  });

  it("ohne Drillprotokoll ist kein Bereich belegt", async () => {
    const a = await auskunftMit(null);
    for (const b of a.umfang?.bereiche ?? []) {
      expect(["nicht_gemessen", "kein_beleg"], b.id).toContain(b.beleg);
    }
  });
});

describe("U6 · die Auskunft ist an die laufende Fassung gebunden", () => {
  it("Version aus package.json, Tabellenzahl aus der Migration", async () => {
    const a = await auskunftMit(null);
    expect(a.umfang?.produkt.version).toBe(buildVersion());
    expect(a.umfang?.produkt.version).not.toBe("");
    expect(typeof a.umfang?.produkt.commit).toBe("string");
    expect(a.umfang?.tabellenImDump).toBe(tabellenAusSchemas(schemas).length);
    expect(a.umfang?.bereiche.map((b) => b.id)).toEqual(SICHERUNGSUMFANG.map((b) => b.id));
  });
});
