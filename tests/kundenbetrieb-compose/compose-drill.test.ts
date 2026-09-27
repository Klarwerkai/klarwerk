import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ADAPTER,
  ALT,
  BILDNAME,
  type Buehne,
  KENNWORT,
  NEU,
  aufrufe,
  belegJson,
  buehne,
  fahre,
  neueAusgabe,
  setzeZustand,
  zustand,
} from "./docker-attrappe";

// ==================================================================================================
// B3 — DER VERTRAG DES COMPOSE-WEGS, DOCKERFREI GEMESSEN.
// ==================================================================================================
//
// Was hier gemessen wird, sind die ENTSCHEIDUNGEN von `scripts/backup/compose-drill.sh` und den
// Compose-Adaptern — mit dem echten Skript, dem echten `backup.sh` und einer `docker`-Attrappe
// (tests/kundenbetrieb-compose/docker-attrappe.ts). Dass Docker, Compose und PostgreSQL dabei
// mitspielen, belegt dieser Test NICHT; das belegt der Lauf auf dem Prüfplatz (K7). Dieser Test
// sorgt dafür, dass zwischen zwei Prüfplatzläufen niemand die Rückweg-Logik still verbiegt.
const buehnen: Buehne[] = [];
function neueBuehne(): Buehne {
  const b = buehne();
  buehnen.push(b);
  return b;
}
afterEach(() => {
  for (const b of buehnen.splice(0)) rmSync(b.ort, { recursive: true, force: true });
});

const sha256 = (datei: string) => createHash("sha256").update(readFileSync(datei)).digest("hex");

describe("K1 · Compose-Adapter: pg_dump im Datenbankcontainer, nie mit Kennwort", () => {
  it("A1 · eine Adresse MIT Kennwort wird abgewiesen, bevor docker gerufen wird", () => {
    const b = neueBuehne();
    const r = spawnSync(
      join(ADAPTER, "pg_dump"),
      [
        "--format=custom",
        "--file",
        join(b.ort, "x.dump"),
        `postgresql://klarwerk:${KENNWORT}@db/klarwerk_prod`,
      ],
      {
        encoding: "utf8",
        env: {
          ...b.env,
          KLARWERK_COMPOSE_PROJEKT: "b3test",
          KLARWERK_COMPOSE_VERZEICHNIS: b.stack,
        },
      },
    );
    expect(r.status).toBe(64);
    expect(`${r.stdout}${r.stderr}`).not.toContain(KENNWORT);
    expect(aufrufe(b)).toEqual([]);
  });

  it("A2 · ein unbekanntes Argument wird nicht geraten", () => {
    const b = neueBuehne();
    const r = spawnSync(
      join(ADAPTER, "pg_dump"),
      ["--clean", "--file", join(b.ort, "x.dump"), "postgresql://klarwerk@db/klarwerk_prod"],
      {
        encoding: "utf8",
        env: {
          ...b.env,
          KLARWERK_COMPOSE_PROJEKT: "b3test",
          KLARWERK_COMPOSE_VERZEICHNIS: b.stack,
        },
      },
    );
    expect(r.status).toBe(64);
    expect(aufrufe(b)).toEqual([]);
  });

  it("A3 · das UNVERÄNDERTE backup.sh sichert dreimal über docker compose exec, BACKUP_KEEP=2 hält", () => {
    const b = neueBuehne();
    const { status, ausgabe } = fahre(b, ["sichern"]);
    expect(status, ausgabe).toBe(0);

    const ordner = join(b.arbeit, "sicherungen/laufend");
    const dumps = readdirSync(ordner)
      .filter((d) => d.endsWith(".dump"))
      .sort();
    expect(dumps).toHaveLength(2);
    for (const d of dumps) {
      const sidecar = readFileSync(join(ordner, `${d}.sha256`), "utf8").split(/\s+/)[0];
      expect(sidecar).toBe(sha256(join(ordner, d)));
    }

    const beleg = belegJson(b, "sichern.json");
    expect(beleg.anzahl_danach).toBe(2);
    expect(beleg.backup_keep).toBe(2);
    expect(beleg.kennwort_im_log).toBe("nein");
    expect(beleg.pruefstand).toBeTypeOf("string");
    // Aus welchem Stand die Sicherungen stammen (R-0850): /health der laufenden Anwendung.
    expect((beleg.anwendung_health as { commit: string }).commit).toBe(ALT);
    const laeufe = beleg.laeufe as { exit: number; sha256: string; sidecar: string }[];
    expect(laeufe).toHaveLength(3);
    for (const l of laeufe) {
      expect(l.exit).toBe(0);
      expect(l.sha256).toBe(l.sidecar);
    }

    // Der Weg: jeder Dump ist ein `docker compose … exec -T db pg_dump -U klarwerk -d klarwerk_prod`,
    // jede Lesepruefung ein `pg_restore --list` im selben Container. Kein Argument trägt das Kennwort.
    const dumpAufrufe = aufrufe(b).filter((a) => a.includes("pg_dump"));
    expect(dumpAufrufe).toHaveLength(3);
    for (const a of dumpAufrufe) {
      const ab = a.indexOf("exec");
      expect(a.slice(ab, ab + 7)).toEqual(["exec", "-T", "db", "pg_dump", "-U", "klarwerk", "-d"]);
      expect(a).toContain("klarwerk_prod");
    }
    expect(aufrufe(b).filter((a) => a.includes("--list"))).toHaveLength(3);
    for (const a of aufrufe(b)) {
      expect(a.join(" ")).not.toContain(KENNWORT);
    }
    expect(ausgabe).not.toContain(KENNWORT);
  });
});

describe("K3 · Aktualisierung: neue Ausgabe, gleiche Daten, neue Version in /health", () => {
  it("U1 · Stand alt → neu: gebaut mit SOURCE_COMMIT, nur app neu erzeugt, /health meldet den neuen Commit", () => {
    const b = neueBuehne();
    const quelle = neueAusgabe(b);
    const { status, ausgabe } = fahre(b, ["aktualisieren", quelle]);
    expect(status, ausgabe).toBe(0);

    const beleg = belegJson(b, "aktualisieren.json");
    expect(beleg.stand_vorher).toBe(ALT);
    expect(beleg.stand_neu).toBe(NEU);
    expect((beleg.vorher as { health: { commit: string } }).health.commit).toBe(ALT);
    expect((beleg.nachher as { health: { commit: string } }).health.commit).toBe(NEU);
    expect(beleg.inhalt_vorher).toBe(beleg.inhalt_nachher);
    expect(beleg.vergleich).toBe("gleich");
    expect(beleg.rueckweg).toBe("nicht noetig");

    const a = aufrufe(b);
    expect(a.some((x) => x.includes("build") && x.includes(`SOURCE_COMMIT=${NEU}`))).toBe(true);
    const up = a.filter((x) => x.includes("up"));
    expect(up).toHaveLength(1);
    expect(up[0]!.slice(-4)).toEqual(["-d", "--no-deps", "--force-recreate", "app"]);
    // Die Datenhälfte: vor der Aktualisierung wurde gesichert.
    expect(
      readdirSync(join(b.arbeit, "sicherungen/vor-aktualisierung")).some((d) =>
        d.endsWith(".dump"),
      ),
    ).toBe(true);
    // .env der Instanz hat die neue Ausgabe überlebt.
    expect(readFileSync(join(b.stack, ".env"), "utf8")).toContain("APP_BASE_URL=");
  });

  it("U2 · ohne neuere Ausgabe ist K3 NICHT belegt (125), statt still grün", () => {
    const b = neueBuehne();
    const { status, ausgabe } = fahre(b, ["aktualisieren"]);
    expect(status, ausgabe).toBe(125);
    expect(String(belegJson(b, "aktualisieren.json").grund)).toContain("keine neuere Ausgabe");
  });
});

describe("K4 · Rückweg bei fehlgeschlagener Aktualisierung", () => {
  it("R1 · kaputtes Abbild: startet nicht → vorheriges Abbild wird erneut ausgerollt (122)", () => {
    const b = neueBuehne();
    const altBild = zustand(b).container.c1!.bild;
    const { status, ausgabe } = fahre(b, ["aktualisieren"], { STOERUNG: "kaputtes-abbild" });
    expect(status, ausgabe).toBe(122);

    const z = zustand(b);
    expect(z.container[z.aktuell.app!]!.bild).toBe(altBild);
    expect(z.tags[BILDNAME]).toBe(altBild);
    const a = aufrufe(b);
    const rueckTag = a.findIndex((x) => x[0] === "tag" && x[1] === `${BILDNAME}:rueckfall`);
    expect(rueckTag).toBeGreaterThan(-1);
    expect(a.slice(rueckTag).some((x) => x.includes("up") && x.includes("--force-recreate"))).toBe(
      true,
    );

    const beleg = belegJson(b, "aktualisieren-kaputtes-abbild.json");
    expect(String(beleg.grund)).toContain("startet nicht");
    expect(String(beleg.grund)).toContain("Exitcode 3");
    expect(String(beleg.rueckweg)).toMatch(/^ausgefuehrt/);
    expect((beleg.rueckweg_health as { commit: string }).commit).toBe(ALT);
    expect(beleg.vergleich).toBe("gleich");
  });

  it("R2 · fehlende Pflichtvariable: Compose nennt sie, NICHTS wird gebaut oder ausgerollt (121)", () => {
    const b = neueBuehne();
    const vorher = zustand(b);
    const { status, ausgabe } = fahre(b, ["aktualisieren"], { STOERUNG: "fehlende-variable" });
    expect(status, ausgabe).toBe(121);

    const a = aufrufe(b);
    expect(a.some((x) => x.includes("up"))).toBe(false);
    expect(a.some((x) => x.includes("build"))).toBe(false);
    const z = zustand(b);
    expect(z.aktuell.app).toBe(vorher.aktuell.app);
    expect(z.container.c1!.gestartet).toBe(vorher.container.c1!.gestartet);

    const beleg = belegJson(b, "aktualisieren-fehlende-variable.json");
    expect(String(beleg.grund)).toContain("APP_BASE_URL");
    expect(String(beleg.rueckweg)).toContain("ununterbrochen");
    // Die gekürzte Kopie der .env (sie trägt das Kennwort) ist wieder weg.
    expect(existsSync(join(b.arbeit, "geheim/env-ohne-app-base-url"))).toBe(false);
    expect(ausgabe).not.toContain(KENNWORT);
  });

  it("R3 · /health meldet nicht den neuen Stand → Rückweg (124), nie ein falsches Grün", () => {
    const b = neueBuehne();
    const altBild = zustand(b).container.c1!.bild;
    const { status, ausgabe } = fahre(b, ["aktualisieren", neueAusgabe(b)], {
      STUB_FALSCHER_COMMIT: "1",
    });
    expect(status, ausgabe).toBe(124);
    const z = zustand(b);
    expect(z.container[z.aktuell.app!]!.bild).toBe(altBild);
  });

  it("R4 · der Schritt `rueckweg` fährt beide Störungen und verlangt genau 122 und 121", () => {
    const b = neueBuehne();
    const { status, ausgabe } = fahre(b, ["rueckweg"]);
    expect(status, ausgabe).toBe(0);
    const beleg = belegJson(b, "rueckweg.json");
    expect(beleg.kaputtes_abbild).toEqual({ erwartet: 122, gemessen: 122 });
    expect(beleg.fehlende_variable).toEqual({ erwartet: 121, gemessen: 121 });
  });
});

// LAUF 2 R1 · BEFUND B1 — DAUERWÄCHTER. `local name` ohne Wert lässt die Variable ab bash 4 UNGESETZT;
// unter `set -u` endet dann jeder Zweig, der sie vor der ersten Zuweisung liest (gemessen: Zeile 906,
// `nachher_health: unbound variable`, R1/R2/R4 rot auf Linux). macOS-bash 3.2 behandelt sie als leer —
// dort war es grün. Dieser Test hält die Regel an der Datei, unabhängig von der Bash-Fassung.
it("L1 · compose-drill.sh deklariert keine lokale Variable ohne Anfangswert (set -u, bash ≥ 4)", () => {
  const text = readFileSync(
    join(import.meta.dirname, "../../scripts/backup/compose-drill.sh"),
    "utf8",
  );
  const blank: string[] = [];
  for (const [i, zeile] of text.split("\n").entries()) {
    const m = zeile.match(/^\s*local\s+(.*)$/);
    if (!m || zeile.includes("(")) continue;
    for (const wort of String(m[1]).match(/(?:[^\s"]+|"[^"]*")+/g) ?? []) {
      if (/^[a-z_][a-z0-9_]*$/.test(wort)) blank.push(`${i + 1}: ${wort}`);
    }
  }
  expect(blank).toEqual([]);
});

// ==================================================================================================
// LAUF 2 R1 · BEFUND B2 — EIN GESCHEITERTER ANWENDUNGSVERGLEICH NACH DEM RÜCKFALL IST ROT.
// ==================================================================================================
//
// Gemessen von der unabhängigen Prüfung: kaputtes Abbild → Rückweg ausgeführt, `vergleich=abweichung`
// — und trotzdem Exit 122, also genau der Code, den `rueckweg` erwartet. Der Schritt `rueckweg` endete
// mit 0, weil der spätere Vergleich nach dem Rückweg wieder grün war. Hier wird ausschließlich dieser
// eine Vergleich gestört (die übrigen bleiben grün); eine spätere gelungene Prüfung hebt ihn nicht auf.
describe("B2 (Lauf 2) · der Datenbestand nach einem Rückfall zählt — auch wenn der Code „erwartet“ ist", () => {
  it("kaputtes Abbild, nur der Rückfallvergleich weicht ab → 110 statt 122, und der Beleg nennt den Vergleich", () => {
    const b = neueBuehne();
    const { status, ausgabe } = fahre(b, ["aktualisieren"], {
      STOERUNG: "kaputtes-abbild",
      STUB_VERGLEICH_ROT_NUR: "aktualisieren-kaputtes-abbild",
    });
    expect(status, ausgabe).toBe(110);
    const beleg = belegJson(b, "aktualisieren-kaputtes-abbild.json");
    expect(beleg.vergleich).toBe("abweichung");
    expect(String(beleg.rueckweg)).toMatch(/^ausgefuehrt/);
    expect(String(beleg.grund)).toContain("startet nicht");
    expect(String(beleg.grund)).toContain("Vergleich abweichung");
  });

  it("fehlende Pflichtvariable, nur dieser Vergleich weicht ab → 110 statt 121", () => {
    const b = neueBuehne();
    const { status, ausgabe } = fahre(b, ["aktualisieren"], {
      STOERUNG: "fehlende-variable",
      STUB_VERGLEICH_ROT_NUR: "aktualisieren-fehlende-variable",
    });
    expect(status, ausgabe).toBe(110);
    expect(belegJson(b, "aktualisieren-fehlende-variable.json").vergleich).toBe("abweichung");
  });

  for (const stoerung of ["kaputtes-abbild", "fehlende-variable"]) {
    it(`Schritt rueckweg: ist nur der Vergleich nach „${stoerung}“ rot, ist der ganze Nachweis rot (150), obwohl der Schlussvergleich grün ist`, () => {
      const b = neueBuehne();
      const { status, ausgabe } = fahre(b, ["rueckweg"], {
        STUB_VERGLEICH_ROT_NUR: `aktualisieren-${stoerung}`,
      });
      expect(status, ausgabe).toBe(150);
      const beleg = belegJson(b, "rueckweg.json");
      expect(beleg.bestand_danach).toBe("gleich");
      const feld = stoerung === "kaputtes-abbild" ? "kaputtes_abbild" : "fehlende_variable";
      expect((beleg[feld] as { gemessen: number }).gemessen).toBe(110);
    });
  }
});

describe("K5 · Neustart: ein ausgelassener echter Datenbank-Neustart ist rot", () => {
  it("N1 · echter Neustart: Postmaster-Startzeit ändert sich, Bestand gleich → 0", () => {
    const b = neueBuehne();
    const { status, ausgabe } = fahre(b, ["neustart"]);
    expect(status, ausgabe).toBe(0);
    const beleg = belegJson(b, "neustart.json");
    expect(beleg.postmaster_vorher).not.toBe(beleg.postmaster_nachher);
  });

  it("N2 · Gegenprobe: Neustart ausgelassen → 130, und der Beleg sagt es", () => {
    const b = neueBuehne();
    const { status, ausgabe } = fahre(b, ["neustart"], { NEUSTART_AUSLASSEN: "1" });
    expect(status, ausgabe).toBe(130);
    const beleg = belegJson(b, "neustart-ausgelassen.json");
    expect(beleg.postmaster_vorher).toBe(beleg.postmaster_nachher);
    expect(String(beleg.grund)).toContain("keinen echten Datenbank-Neustart");
    expect(aufrufe(b).some((x) => x.includes("restart"))).toBe(false);
  });

  it("N3 · ein Bestand, der nach dem Neustart abweicht, ist ein Befund (110)", () => {
    const b = neueBuehne();
    const { status, ausgabe } = fahre(b, ["neustart"], { STUB_VERGLEICH_ROT: "1" });
    expect(status, ausgabe).toBe(110);
  });
});

describe("Befunde der Prüfung Runde 1 (B2–B5)", () => {
  it("B2 · eine gescheiterte Inhaltsmessung VOR der Aktualisierung ist 111 — nichts gebaut, nichts ausgerollt", () => {
    const b = neueBuehne();
    const { status, ausgabe } = fahre(b, ["aktualisieren", neueAusgabe(b)], {
      STUB_SQL_ROT: "md5",
    });
    expect(status, ausgabe).toBe(111);
    const a = aufrufe(b);
    expect(a.some((x) => x.includes("build"))).toBe(false);
    expect(a.some((x) => x.includes("up"))).toBe(false);
  });

  it("B2 · auch der Neustart verlangt die Messung vorher: 111 statt eines Grüns ohne Vergleichsbasis", () => {
    const b = neueBuehne();
    const { status, ausgabe } = fahre(b, ["neustart"], { STUB_SQL_ROT: "md5" });
    expect(status, ausgabe).toBe(111);
    expect(aufrufe(b).some((x) => x.includes("restart"))).toBe(false);
  });

  it("B3 · eine instanzeigene Override-Datei überlebt die neue Ausgabe — in der Fassung der Instanz", () => {
    const b = neueBuehne();
    const override = "docker-compose.pruefplatz-b3.override.yml";
    writeFileSync(join(b.stack, override), "# Fassung der Instanz\nservices: {}\n");
    setzeZustand(b, {
      configFiles: `${join(b.stack, "docker-compose.prod.yml")},${join(b.stack, override)}`,
    });
    const quelle = neueAusgabe(b);
    const { status, ausgabe } = fahre(b, ["aktualisieren", quelle], {
      COMPOSE_DATEIEN: `docker-compose.prod.yml ${override}`,
    });
    expect(status, ausgabe).toBe(0);
    expect(readFileSync(join(b.stack, override), "utf8")).toContain("Fassung der Instanz");
    // Und jeder Compose-Aufruf nannte sie weiter.
    const build = aufrufe(b).find((x) => x.includes("build") && x[0] === "compose");
    expect(build).toContain(join(b.stack, override));
  });

  it("B3 · bringt das Release eine gleichnamige Datei mit, gilt trotzdem die der Instanz", () => {
    const b = neueBuehne();
    const override = "docker-compose.pruefplatz-b3.override.yml";
    writeFileSync(join(b.stack, override), "# Fassung der Instanz\n");
    setzeZustand(b, {
      configFiles: `${join(b.stack, "docker-compose.prod.yml")},${join(b.stack, override)}`,
    });
    const quelle = neueAusgabe(b);
    writeFileSync(join(quelle, override), "# Fassung des Release\n");
    const { status, ausgabe } = fahre(b, ["aktualisieren", quelle], {
      COMPOSE_DATEIEN: `docker-compose.prod.yml ${override}`,
    });
    expect(status, ausgabe).toBe(0);
    expect(readFileSync(join(b.stack, override), "utf8")).toContain("Fassung der Instanz");
  });

  it("B5 · COMPOSE_DATEIEN ungleich den Dateien, mit denen die Instanz läuft → Abbruch vor jedem Bau", () => {
    const b = neueBuehne();
    setzeZustand(b, {
      configFiles: `${join(b.stack, "docker-compose.prod.yml")},${join(b.stack, "docker-compose.pruefplatz.override.yml")}`,
    });
    writeFileSync(join(b.stack, "docker-compose.pruefplatz-b3.override.yml"), "services: {}\n");
    const { status, ausgabe } = fahre(b, ["aktualisieren", neueAusgabe(b)], {
      COMPOSE_DATEIEN: "docker-compose.prod.yml docker-compose.pruefplatz-b3.override.yml",
    });
    expect(status, ausgabe).toBe(1);
    expect(ausgabe).toContain("nicht die Dateien, mit denen die Instanz laeuft");
    expect(aufrufe(b).some((x) => x.includes("build"))).toBe(false);
  });

  it("B4 · der Prüfschritt hängt Tests schreibgeschützt unter /b3quelle ein und kopiert sie ins beschreibbare /app", () => {
    const b = neueBuehne();
    const { status, ausgabe } = fahre(b, ["pruefen"]);
    expect(status, ausgabe).toBe(0);
    const laeufe = aufrufe(b).filter((x) => x[0] === "run" && x.join(" ").includes("vitest"));
    expect(laeufe).toHaveLength(2);
    for (const l of laeufe) {
      const text = l.join(" ");
      expect(text).toContain(":/b3quelle/tests:ro");
      expect(text).not.toContain(":/app/tests");
      expect(text).toContain("cp -R /b3quelle/. /app/");
    }
  });

  // Lauf 2 R3 · am echten Compose-Lauf gemessen: ohne Init-Prozess blieb die abgeräumte Anwendung
  // als Zombie stehen (PID 1 = `npx vitest` sammelt nicht ein), und der Drill meldete 80.
  it("R3 · jeder Werkzeugcontainer (Prüfen UND Drill) läuft mit --init — tini sammelt abgeräumte Prozesse ein", () => {
    const b = neueBuehne();
    expect(fahre(b, ["pruefen"]).status).toBe(0);
    const laeufe = aufrufe(b).filter((x) => x[0] === "run" && x.join(" ").includes("/b3quelle"));
    expect(laeufe.length).toBeGreaterThan(0);
    for (const l of laeufe) {
      expect(l.slice(0, 4), l.join(" ")).toContain("--init");
    }
  });

  it("B4 · ein übersprungener Test ist rot (141), kein Grün", () => {
    const b = neueBuehne();
    const { status, ausgabe } = fahre(b, ["pruefen"], { STUB_VITEST_SKIP: "1" });
    expect(status, ausgabe).toBe(141);
  });
});

describe("Ehrlichkeit ohne Bestand", () => {
  it("O1 · ohne angelegten Bestand steht „nicht gemessen“ im Beleg — weder Befund noch „gleich“", () => {
    const b = neueBuehne();
    rmSync(join(b.arbeit, "austausch/bestand.json"));
    const { status, ausgabe } = fahre(b, ["neustart"]);
    expect(status, ausgabe).toBe(0);
    expect(ausgabe).toContain("NICHT gemessen");
    expect(aufrufe(b).some((x) => x.includes("/b3/nutzlast.mjs"))).toBe(false);
    expect(fahre(b, ["vergleichen"]).status).toBe(2);
  });
});

describe("Aufruf", () => {
  it("ohne PROJEKT oder mit unbekanntem Schritt: Exit 1, nichts gerufen", () => {
    const b = neueBuehne();
    expect(fahre(b, ["sichern"], { PROJEKT: "" }).status).toBe(1);
    expect(fahre(b, ["unbekannt"]).status).toBe(1);
    expect(aufrufe(b)).toEqual([]);
  });
});
