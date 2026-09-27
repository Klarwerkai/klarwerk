import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ALT,
  type Buehne,
  aufrufe,
  belegJson,
  buehne,
  datenbanken,
  fahre,
  neueAusgabe,
} from "./docker-attrappe";

// ==================================================================================================
// B3 · RUNDE 2 — DIE BEFUNDE B1, B7, B8, B9 DER UNABHÄNGIGEN PRÜFUNG, DOCKERFREI GEMESSEN.
// ==================================================================================================
//
// B1  Der Ernstfall (Sicherung in klarwerk_prod zurückspielen) arbeitete als Befehlsblock nach
//     gescheitertem Umbenennen und gescheitertem createdb weiter und endete mit 0. Jetzt ist er der
//     Schritt `zurueckspielen`: jeder Schritt geprüft, der alte Bestand umbenannt statt gelöscht und
//     bei JEDEM Fehlschlag wieder eingesetzt.
// B7  Eine Wiederherstellung ist an die Instanz gebunden (R-0811) — mit Gegenprobe gegen das falsche Ziel.
// B8  Die verschlüsselte, gestaffelte Zweitkopie (R-0839), nach dem Schreiben zurückgelesen.
// B9  Jeder Sicherungsweg dieses Werkzeugs trägt einen Herkunftsnachweis (R-0850).
//
// Grenze wie in compose-drill.test.ts: `docker` ist eine Attrappe. Dass PostgreSQL sich so verhält,
// belegt der Prüfplatz-Lauf; hier werden die ENTSCHEIDUNGEN des Skripts gemessen.
const buehnen: Buehne[] = [];
const ordner: string[] = [];
function neueBuehne(): Buehne {
  const b = buehne();
  buehnen.push(b);
  return b;
}
afterEach(() => {
  for (const b of buehnen.splice(0)) rmSync(b.ort, { recursive: true, force: true });
  for (const o of ordner.splice(0)) rmSync(o, { recursive: true, force: true });
});

const sha256 = (datei: string) => createHash("sha256").update(readFileSync(datei)).digest("hex");

/** Eine Sicherung über den täglichen Weg — mit Herkunftsnachweis. */
function sicherung(b: Buehne): string {
  const r = fahre(b, ["sicherung"]);
  expect(r.status, r.ausgabe).toBe(0);
  const ziel = join(b.arbeit, "sicherungen/taeglich");
  const dump = readdirSync(ziel)
    .filter((d) => d.endsWith(".dump"))
    .sort()
    .at(-1);
  expect(dump).toBeTruthy();
  return join(ziel, String(dump));
}

const BESTAETIGT = { ZURUECKSPIELEN_BESTAETIGT: "klarwerk_prod" };
const sql = (b: Buehne) =>
  aufrufe(b)
    .filter((a) => a.includes("psql"))
    .map((a) => a.at(-1) ?? "");
const restores = (b: Buehne) =>
  aufrufe(b).filter((a) => a.includes("pg_restore") && !a.includes("--list"));

describe("B9 · Herkunft je Sicherung (R-0850)", () => {
  it("H1 · der tägliche Weg schreibt zu jedem Dump einen Nachweis: Instanz, Stand, Systemkennung, SHA-256", () => {
    const b = neueBuehne();
    const dump = sicherung(b);
    const h = JSON.parse(readFileSync(`${dump}.herkunft.json`, "utf8"));
    expect(h.instanz_id).toBe(readFileSync(join(b.arbeit, "instanz.id"), "utf8").trim());
    expect(h.instanz_id).toMatch(/^klarwerk-instanz-[0-9a-f]{32}$/);
    expect(h.sha256).toBe(sha256(dump));
    expect(h.anwendung_health.commit).toBe(ALT);
    expect(h.instanz_stand).toBe(ALT);
    expect(h.db_systemkennung).toBe("7400000000000000001");
    expect(h.datenbank).toBe("klarwerk_prod");
    expect(belegJson(b, "sicherung.json").exit).toBe(0);
  });

  it("H2 · auch die Vorab-Sicherung einer Aktualisierung trägt ihren Nachweis", () => {
    const b = neueBuehne();
    const r = fahre(b, ["aktualisieren", neueAusgabe(b)]);
    expect(r.status, r.ausgabe).toBe(0);
    const ziel = join(b.arbeit, "sicherungen/vor-aktualisierung");
    const dumps = readdirSync(ziel).filter((d) => d.endsWith(".dump"));
    expect(dumps.length).toBeGreaterThan(0);
    for (const d of dumps) expect(existsSync(join(ziel, `${d}.herkunft.json`))).toBe(true);
  });
});

describe("B7 · Instanzbindung (R-0811)", () => {
  it("I1 · Sicherung einer FREMDEN Instanz: wiederherstellen und zurueckspielen verweigern mit 161", () => {
    const b = neueBuehne();
    const dump = sicherung(b);
    const h = `${dump}.herkunft.json`;
    writeFileSync(
      h,
      readFileSync(h, "utf8").replace(
        /"instanz_id": "[^"]*"/,
        '"instanz_id": "klarwerk-instanz-fremd"',
      ),
    );
    const w = fahre(b, ["wiederherstellen", dump]);
    expect(w.status, w.ausgabe).toBe(161);
    expect(w.ausgabe).toContain("klarwerk-instanz-fremd");
    const z = fahre(b, ["zurueckspielen", dump], BESTAETIGT);
    expect(z.status, z.ausgabe).toBe(161);
    // Nichts angefasst: keine Datenbank angelegt, kein Restore, App nicht angehalten.
    expect(datenbanken(b).datenbanken).toEqual(["postgres", "klarwerk_prod"]);
    expect(restores(b)).toEqual([]);
    expect(aufrufe(b).some((a) => a.includes("stop"))).toBe(false);
  });

  it("I2 · Sicherung OHNE Herkunftsnachweis ist an keine Instanz gebunden → 161", () => {
    const b = neueBuehne();
    const dump = sicherung(b);
    rmSync(`${dump}.herkunft.json`);
    expect(fahre(b, ["wiederherstellen", dump]).status).toBe(161);
  });

  it("I3 · ein Nachweis, der zu einem ANDEREN Dump gehört, bindet nichts → 161", () => {
    const b = neueBuehne();
    const dump = sicherung(b);
    const h = `${dump}.herkunft.json`;
    writeFileSync(
      h,
      readFileSync(h, "utf8").replace(/"sha256": "[0-9a-f]{64}"/, `"sha256": "${"0".repeat(64)}"`),
    );
    expect(fahre(b, ["wiederherstellen", dump]).status).toBe(161);
  });

  it("I4 · ein bewusster Umzug geht nur mit genau der Instanzkennung der Sicherung", () => {
    const b = neueBuehne();
    const dump = sicherung(b);
    const h = `${dump}.herkunft.json`;
    writeFileSync(
      h,
      readFileSync(h, "utf8").replace(
        /"instanz_id": "[^"]*"/,
        '"instanz_id": "klarwerk-instanz-alt"',
      ),
    );
    expect(
      fahre(b, ["zurueckspielen", dump], { ...BESTAETIGT, FREMDE_SICHERUNG_BESTAETIGT: "falsch" })
        .status,
    ).toBe(161);
    const r = fahre(b, ["zurueckspielen", dump], {
      ...BESTAETIGT,
      FREMDE_SICHERUNG_BESTAETIGT: "klarwerk-instanz-alt",
    });
    expect(r.status, r.ausgabe).toBe(0);
  });
});

describe("B1 · Ernstfall: zurueckspielen prüft jeden Schritt und setzt den alten Bestand wieder ein", () => {
  it("E1 · ohne ausdrückliche Bestätigung passiert nichts (Exit 1)", () => {
    const b = neueBuehne();
    const dump = sicherung(b);
    const vorher = aufrufe(b).length;
    expect(fahre(b, ["zurueckspielen", dump]).status).toBe(1);
    expect(aufrufe(b).length).toBe(vorher);
  });

  it("E2 · Erfolg: anhalten → umbenennen → leer anlegen → Leere prüfen → pg_restore --exit-on-error → starten", () => {
    const b = neueBuehne();
    const dump = sicherung(b);
    const r = fahre(b, ["zurueckspielen", dump], BESTAETIGT);
    expect(r.status, r.ausgabe).toBe(0);
    const s = sql(b);
    const umbenennen = s.findIndex((x) =>
      /ALTER DATABASE "klarwerk_prod" RENAME TO "klarwerk_prod_vor_/.test(x),
    );
    const anlegen = s.findIndex((x) => x === 'CREATE DATABASE "klarwerk_prod"');
    const leer = s.findIndex((x) => x.includes("information_schema.tables"));
    expect(umbenennen).toBeGreaterThan(-1);
    expect(anlegen).toBeGreaterThan(umbenennen);
    expect(leer).toBeGreaterThan(anlegen);
    const rs = restores(b);
    expect(rs).toHaveLength(1);
    expect(rs[0]).toContain("--exit-on-error");
    expect(rs[0]!.slice(-2)).toEqual(["-d", "klarwerk_prod"]);
    // Der alte Bestand ist NICHT gelöscht, sondern liegt umbenannt da.
    expect(datenbanken(b).datenbanken.some((d) => d.startsWith("klarwerk_prod_vor_"))).toBe(true);
    const beleg = belegJson(b, "zurueckspielen.json");
    expect(beleg.exit).toBe(0);
    expect(beleg.ausfall_sekunden).toBeTypeOf("number");
    expect(beleg.stand_alter_sekunden).toBeTypeOf("number");
  });

  it("E3 · Umbenennen scheitert → 162, KEIN createdb, KEIN pg_restore, App wieder gestartet", () => {
    const b = neueBuehne();
    const dump = sicherung(b);
    const r = fahre(b, ["zurueckspielen", dump], { ...BESTAETIGT, STUB_SQL_ROT: "RENAME TO" });
    expect(r.status, r.ausgabe).toBe(162);
    expect(sql(b).some((x) => x.startsWith("CREATE DATABASE"))).toBe(false);
    expect(restores(b)).toEqual([]);
    const a = aufrufe(b);
    const stop = a.findIndex((x) => x.includes("stop"));
    expect(a.slice(stop).some((x) => x.includes("up") && x.includes("app"))).toBe(true);
    expect(datenbanken(b).datenbanken).toEqual(["postgres", "klarwerk_prod"]);
  });

  it("E4 · createdb scheitert → 162, der alte Bestand wird zurückbenannt, KEIN pg_restore", () => {
    const b = neueBuehne();
    const dump = sicherung(b);
    const r = fahre(b, ["zurueckspielen", dump], {
      ...BESTAETIGT,
      STUB_SQL_ROT: "CREATE DATABASE",
    });
    expect(r.status, r.ausgabe).toBe(162);
    expect(restores(b)).toEqual([]);
    expect(datenbanken(b).datenbanken).toEqual(["postgres", "klarwerk_prod"]);
    expect(datenbanken(b).tabellen.klarwerk_prod).toBe(45);
    expect(String(belegJson(b, "zurueckspielen.json").rueckweg)).toContain(
      "wieder als klarwerk_prod",
    );
  });

  it("E5 · pg_restore scheitert → 162, neues Ziel verworfen, alter Bestand wieder eingesetzt", () => {
    const b = neueBuehne();
    const dump = sicherung(b);
    const r = fahre(b, ["zurueckspielen", dump], { ...BESTAETIGT, STUB_RESTORE_ROT: "1" });
    expect(r.status, r.ausgabe).toBe(162);
    expect(sql(b).some((x) => x.startsWith('DROP DATABASE IF EXISTS "klarwerk_prod"'))).toBe(true);
    expect(datenbanken(b).datenbanken).toEqual(["postgres", "klarwerk_prod"]);
  });

  it("E6 · die Rücknahme selbst scheitert → 163, und der Beleg sagt, wo der alte Bestand liegt", () => {
    const b = neueBuehne();
    const dump = sicherung(b);
    const r = fahre(b, ["zurueckspielen", dump], {
      ...BESTAETIGT,
      STUB_RESTORE_ROT: "1",
      STUB_SQL_ROT: "DROP DATABASE",
    });
    expect(r.status, r.ausgabe).toBe(163);
    expect(String(belegJson(b, "zurueckspielen.json").rueckweg)).toMatch(
      /NICHT WIEDER EINGESETZT.*klarwerk_prod_vor_/,
    );
  });

  it("E7 · veränderte Prüfsumme → 160, nichts angehalten, nichts umbenannt", () => {
    const b = neueBuehne();
    const dump = sicherung(b);
    writeFileSync(dump, `${readFileSync(dump, "utf8")}x`);
    const r = fahre(b, ["zurueckspielen", dump], BESTAETIGT);
    expect(r.status, r.ausgabe).toBe(160);
    expect(aufrufe(b).some((a) => a.includes("stop"))).toBe(false);
    expect(sql(b).some((x) => x.includes("RENAME"))).toBe(false);
  });

  it("E8 · RPO-Ziel überschritten → 164 (gemessen gegen den Zeitpunkt der Sicherung)", () => {
    const b = neueBuehne();
    const dump = sicherung(b);
    const r = fahre(b, ["zurueckspielen", dump], { ...BESTAETIGT, RPO_ZIEL_SEKUNDEN: "-1" });
    expect(r.status, r.ausgabe).toBe(164);
  });
});

const OPENSSL = spawnSync("/bin/sh", ["-c", "command -v openssl"]).status === 0;
if (!OPENSSL) {
  process.stderr.write("[KLARWERK] B3 auslagern ÜBERSPRUNGEN: openssl fehlt in dieser Umgebung.\n");
}

describe.skipIf(!OPENSSL)("B8 · verschlüsselte, gestaffelte Zweitkopie (R-0839)", () => {
  function zweiterOrt(): string {
    const o = mkdtempSync(join(tmpdir(), "klarwerk-b3-zweitort-"));
    ordner.push(o);
    return o;
  }

  it("Z1 · taeglich: Sicherung + verschlüsselte Kopie in tage/wochen/monate, zurückgelesen gleich dem Dump", () => {
    const b = neueBuehne();
    const ort = zweiterOrt();
    const r = fahre(b, ["taeglich"], { ZWEITER_ORT: ort });
    expect(r.status, r.ausgabe).toBe(0);
    const tage = readdirSync(join(ort, "tage")).filter((d) => d.endsWith(".tar.enc"));
    expect(tage).toHaveLength(1);
    expect(readdirSync(join(ort, "wochen")).filter((d) => d.endsWith(".tar.enc"))).toHaveLength(1);
    expect(readdirSync(join(ort, "monate")).filter((d) => d.endsWith(".tar.enc"))).toHaveLength(1);
    const enc = join(ort, "tage", tage[0]!);
    // Verschlüsselt: der Klartext des Dumps steht nicht in der Zweitkopie.
    expect(readFileSync(enc).includes(Buffer.from("PGDMP"))).toBe(false);
    // Unabhängig zurückgelesen: mit dem Schlüssel aus dem Arbeitsordner entschlüsseln und vergleichen.
    const aus = mkdtempSync(join(tmpdir(), "klarwerk-b3-entschl-"));
    ordner.push(aus);
    const schluessel = join(b.arbeit, "geheim/auslagerung.schluessel");
    const d = spawnSync(
      "/bin/sh",
      [
        "-c",
        `openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass "file:$1" -in "$2" | (cd "$3" && tar -xf -)`,
        "sh",
        schluessel,
        enc,
        aus,
      ],
      { encoding: "utf8" },
    );
    expect(d.status, d.stderr).toBe(0);
    const dumpName = tage[0]!.replace(/\.tar\.enc$/, "");
    const original = join(b.arbeit, "sicherungen/taeglich", dumpName);
    expect(sha256(join(aus, dumpName))).toBe(sha256(original));
    expect(existsSync(join(aus, `${dumpName}.herkunft.json`))).toBe(true);
    // Der Schlüssel liegt NICHT am zweiten Ort.
    const alles = spawnSync("/bin/sh", ["-c", `find "$1" -type f`, "sh", ort], {
      encoding: "utf8",
    }).stdout;
    expect(alles).not.toContain("schluessel");
    const beleg = belegJson(b, "auslagern.json");
    expect(beleg.nachgeprueft).toBe("ja");
  });

  it("Z2 · gestaffelte Aufbewahrung: AUSLAGERUNG_TAGE=2 hält nach drei Läufen genau zwei Tageskopien", () => {
    const b = neueBuehne();
    const ort = zweiterOrt();
    for (let i = 0; i < 3; i++) {
      const r = fahre(b, ["taeglich"], { ZWEITER_ORT: ort, AUSLAGERUNG_TAGE: "2" });
      expect(r.status, r.ausgabe).toBe(0);
    }
    expect(readdirSync(join(ort, "tage")).filter((d) => d.endsWith(".tar.enc"))).toHaveLength(2);
    // Woche und Monat: je EINE Kopie — die erste des Zeitraums.
    expect(readdirSync(join(ort, "wochen")).filter((d) => d.endsWith(".tar.enc"))).toHaveLength(1);
    expect(readdirSync(join(ort, "monate")).filter((d) => d.endsWith(".tar.enc"))).toHaveLength(1);
  });

  it("Z3 · ein „zweiter Ort“ im Arbeitsordner oder ohne absoluten Pfad wird abgewiesen", () => {
    const b = neueBuehne();
    mkdirSync(join(b.arbeit, "kopie"), { recursive: true });
    expect(fahre(b, ["taeglich"], { ZWEITER_ORT: join(b.arbeit, "kopie") }).status).toBe(1);
    expect(fahre(b, ["auslagern"], { ZWEITER_ORT: "relativ/ort" }).status).toBe(1);
  });

  it("Z4 · eine Sicherung, die nicht zu ihrer Prüfsumme passt, wird nicht ausgelagert (170)", () => {
    const b = neueBuehne();
    const ort = zweiterOrt();
    const dump = sicherung(b);
    const kopie = `${dump}.orig`;
    cpSync(dump, kopie);
    writeFileSync(dump, `${readFileSync(dump, "utf8")}x`);
    expect(fahre(b, ["auslagern"], { ZWEITER_ORT: ort }).status).toBe(170);
    expect(existsSync(join(ort, "tage"))).toBe(false);
  });
});
