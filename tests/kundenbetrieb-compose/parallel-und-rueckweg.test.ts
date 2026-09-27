import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type Buehne, belegJson, buehne, fahre, fahreParallel } from "./docker-attrappe";

// ==================================================================================================
// B3 · RUNDE 3 — DIE BEFUNDE R2-1 BIS R2-5 DER UNABHÄNGIGEN PRÜFUNG, DOCKERFREI GEMESSEN.
// ==================================================================================================
//
// R2-1/R2-2  Zwei ECHTE, gleichzeitig laufende Erstläufe erzeugten je eine eigene Instanzkennung
//            bzw. einen eigenen Schlüssel; der zweite überschrieb den ersten. Danach war ein eigener
//            Dump nicht mehr an die Instanz gebunden, eine Zweitkopie nicht mehr entschlüsselbar.
//            Gemessen wird mit zwei parallelen Prozessen, die an genau dieser Stelle
//            (B3_PAUSE_VOR_VEROEFFENTLICHUNG) gleichzeitig stehen — nicht mit zwei nacheinander.
// R2-3       Ein gescheitertes `cp` der Wochenkopie wurde übergangen (Exit 0).
// R2-4       Wochen-/Monats-Sidecars nannten den Dateinamen der Tageskopie.
// R2-5       Ein gescheiterter Wiederanlauf nach dem Rückweg war 162 statt 163.
const buehnen: Buehne[] = [];
const ordner: string[] = [];
function neueBuehne(): Buehne {
  const b = buehne();
  buehnen.push(b);
  return b;
}
function neuerOrdner(praefix: string): string {
  const o = mkdtempSync(join(tmpdir(), praefix));
  ordner.push(o);
  return o;
}
afterEach(() => {
  for (const b of buehnen.splice(0)) rmSync(b.ort, { recursive: true, force: true });
  for (const o of ordner.splice(0)) rmSync(o, { recursive: true, force: true });
});

const sha256 = (datei: string) => createHash("sha256").update(readFileSync(datei)).digest("hex");
const PAUSE = { B3_PAUSE_VOR_VEROEFFENTLICHUNG: "1" };
const OPENSSL = spawnSync("/bin/sh", ["-c", "command -v openssl"]).status === 0;
if (!OPENSSL) {
  process.stderr.write("[KLARWERK] B3 R2-2/3/4 ÜBERSPRUNGEN: openssl fehlt in dieser Umgebung.\n");
}

function entschluessele(schluessel: string, datei: string, ziel: string) {
  return spawnSync(
    "/bin/sh",
    [
      "-c",
      'openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass "file:$1" -in "$2" | (cd "$3" && tar -xf -)',
      "sh",
      schluessel,
      datei,
      ziel,
    ],
    { encoding: "utf8" },
  );
}

describe("R2-1 · zwei gleichzeitige Erstläufe teilen EINE Instanzkennung", () => {
  it("beide Sicherungen gelingen, tragen dieselbe Kennung wie instanz.id und lassen sich zurückspielen", async () => {
    const b = neueBuehne();
    const [x, y] = await Promise.all([
      fahreParallel(b, ["sicherung"], PAUSE),
      fahreParallel(b, ["sicherung"], PAUSE),
    ]);
    expect(x.status, x.ausgabe).toBe(0);
    expect(y.status, y.ausgabe).toBe(0);
    const kennung = readFileSync(join(b.arbeit, "instanz.id"), "utf8").trim();
    expect(kennung).toMatch(/^klarwerk-instanz-[0-9a-f]{32}$/);
    // Keine liegengebliebene Zwischendatei der Veröffentlichung.
    expect(readdirSync(b.arbeit).filter((d) => d.startsWith(".neu."))).toEqual([]);
    const ziel = join(b.arbeit, "sicherungen/taeglich");
    const dumps = readdirSync(ziel)
      .filter((d) => d.endsWith(".dump"))
      .sort();
    expect(dumps).toHaveLength(2);
    for (const [i, d] of dumps.entries()) {
      const h = JSON.parse(readFileSync(join(ziel, `${d}.herkunft.json`), "utf8"));
      expect(h.instanz_id).toBe(kennung);
      // Die Bindung selbst: jede der beiden Sicherungen wird zum Zurückspielen angenommen.
      const r = fahre(b, ["zurueckspielen", join(ziel, d)], {
        ZURUECKSPIELEN_BESTAETIGT: "klarwerk_prod",
        B3_LAUF: `20260925T08000${i}Z`,
      });
      expect(r.status, r.ausgabe).toBe(0);
    }
  }, 120_000);
});

describe.skipIf(!OPENSSL)("R2-2 bis R2-4 · Zweitkopie: Schlüssel, Staffelkopien, Sidecars", () => {
  it("R2-2 · zwei gleichzeitige Erst-`taeglich`: EIN Schlüssel, und JEDE Tageskopie entschlüsselt zu ihrem Dump", async () => {
    const b = neueBuehne();
    const ort = neuerOrdner("klarwerk-b3-zweitort-");
    const [x, y] = await Promise.all([
      fahreParallel(b, ["taeglich"], { ...PAUSE, ZWEITER_ORT: ort }),
      fahreParallel(b, ["taeglich"], { ...PAUSE, ZWEITER_ORT: ort }),
    ]);
    expect(x.status, x.ausgabe).toBe(0);
    expect(y.status, y.ausgabe).toBe(0);
    const schluessel = join(b.arbeit, "geheim/auslagerung.schluessel");
    const tage = readdirSync(join(ort, "tage")).filter((d) => d.endsWith(".tar.enc"));
    expect(tage).toHaveLength(2);
    // Erst NACH dem Ende beider Prozesse, unabhängig: jede Kopie mit dem verbliebenen Schlüssel.
    for (const t of tage) {
      const aus = neuerOrdner("klarwerk-b3-entschl-");
      const e = entschluessele(schluessel, join(ort, "tage", t), aus);
      expect(e.status, `${t}: ${e.stderr}`).toBe(0);
      const dump = t.replace(/\.tar\.enc$/, "");
      expect(sha256(join(aus, dump))).toBe(sha256(join(b.arbeit, "sicherungen/taeglich", dump)));
    }
    // Und genau EINE Wochen- und EINE Monatskopie, obwohl beide Läufe denselben Zeitraum trafen.
    expect(readdirSync(join(ort, "wochen")).filter((d) => d.endsWith(".tar.enc"))).toHaveLength(1);
    expect(readdirSync(join(ort, "monate")).filter((d) => d.endsWith(".tar.enc"))).toHaveLength(1);
  }, 120_000);

  it("R2-3 · ein gescheitertes cp der Wochenkopie ist rot (170), nicht „nachgeprüft“", () => {
    const b = neueBuehne();
    const ort = neuerOrdner("klarwerk-b3-zweitort-");
    const bin = neuerOrdner("klarwerk-b3-cp-");
    writeFileSync(
      join(bin, "cp"),
      '#!/bin/sh\ncase "$*" in *"/wochen/"*) echo "cp: attrappe" >&2; exit 9;; esac\nexec /bin/cp "$@"\n',
      { mode: 0o755 },
    );
    const r = fahre(b, ["taeglich"], { ZWEITER_ORT: ort, PATH: `${bin}:${b.env.PATH}` });
    expect(r.status, r.ausgabe).toBe(170);
    const beleg = belegJson(b, "auslagern.json");
    expect(beleg.nachgeprueft).toBe("nein");
    expect(String(beleg.grund)).toContain("wochen");
  });

  // ================================================================================================
  // R3-1/R3-2 — NACH EINER GESCHEITERTEN PERIODENKOPIE MELDET DER NÄCHSTE LAUF KEINEN FALSCHEN ERFOLG.
  // ================================================================================================
  //
  // Gemessen von der unabhängigen Prüfung: erster Lauf mit gestörtem Wochen-`cp` → 170; zweiter Lauf
  // OHNE Störung → Exit 0, `nachgeprueft=ja` — und in `wochen/` lag ausschließlich die Reservierung.
  // Hier wird derselbe Zeitraum nach aufgehobener Störung erneut ausgelagert und eine VORHANDENE,
  // gültige Kopie samt Sidecar verlangt; für die Woche und für den Monat.
  function stoerendesCp(stufe: string): string {
    const bin = neuerOrdner("klarwerk-b3-cp-");
    writeFileSync(
      join(bin, "cp"),
      `#!/bin/sh\ncase "$*" in *"/${stufe}/"*) echo "cp: attrappe" >&2; exit 9;; esac\nexec /bin/cp "$@"\n`,
      { mode: 0o755 },
    );
    return bin;
  }
  function sha256sumC(ordner: string, sidecar: string) {
    return spawnSync(
      "/bin/sh",
      [
        "-c",
        'cd "$1" && if command -v sha256sum >/dev/null; then sha256sum -c "$2"; else shasum -a 256 -c "$2"; fi',
        "sh",
        ordner,
        sidecar,
      ],
      { encoding: "utf8" },
    );
  }

  for (const stufe of ["wochen", "monate"]) {
    it(`R3-1 · ${stufe}: nach gescheiterter Kopie holt der nächste Lauf sie nach — Erfolg nur mit gültiger Kopie`, () => {
      const b = neueBuehne();
      const ort = neuerOrdner("klarwerk-b3-zweitort-");
      const erst = fahre(b, ["taeglich"], {
        ZWEITER_ORT: ort,
        PATH: `${stoerendesCp(stufe)}:${b.env.PATH}`,
      });
      expect(erst.status, erst.ausgabe).toBe(170);
      // Der gescheiterte Lauf hinterlässt weder eine Teilkopie noch eine Reservierung.
      expect(readdirSync(join(ort, stufe))).toEqual([]);

      const zweit = fahre(b, ["taeglich"], { ZWEITER_ORT: ort });
      expect(zweit.status, zweit.ausgabe).toBe(0);
      const beleg = belegJson(b, "auslagern.json");
      expect(beleg.nachgeprueft).toBe("ja");
      const kopien = readdirSync(join(ort, stufe)).filter((d) => d.endsWith(".tar.enc"));
      expect(kopien, stufe).toHaveLength(1);
      const c = sha256sumC(join(ort, stufe), `${kopien[0]}.sha256`);
      expect(c.status, `${c.stdout}${c.stderr}`).toBe(0);
      expect((beleg.stufen as Record<string, number>)[stufe]).toBe(1);
    });
  }

  it("R3-1 · eine Reservierung OHNE gültige Kopie ist rot (170) und nennt die Reservierung — kein Exit 0", () => {
    const b = neueBuehne();
    const ort = neuerOrdner("klarwerk-b3-zweitort-");
    // Liegengeblieben z. B. nach einem `kill` mitten in der Kopie: Marke da, Kopie nicht.
    const woche = spawnSync("date", ["-u", "+%G-W%V"], { encoding: "utf8" }).stdout.trim();
    mkdirSync(join(ort, "wochen", `.${woche}.belegt`), { recursive: true });
    const r = fahre(b, ["taeglich"], { ZWEITER_ORT: ort, AUSLAGERUNG_WARTEN: "1" });
    expect(r.status, r.ausgabe).toBe(170);
    const beleg = belegJson(b, "auslagern.json");
    expect(beleg.nachgeprueft).toBe("nein");
    expect(String(beleg.grund)).toContain(`.${woche}.belegt`);
    expect(String(beleg.grund)).toContain("keine gueltige Kopie");
    // Die fremde Reservierung wird nie weggeräumt.
    expect(readdirSync(join(ort, "wochen"))).toContain(`.${woche}.belegt`);
  });

  it("R3-1 · eine Kopie, deren Sidecar nicht passt, zählt nicht als erledigter Zeitraum", () => {
    const b = neueBuehne();
    const ort = neuerOrdner("klarwerk-b3-zweitort-");
    const erst = fahre(b, ["taeglich"], { ZWEITER_ORT: ort });
    expect(erst.status, erst.ausgabe).toBe(0);
    const kopie = String(readdirSync(join(ort, "wochen")).find((d) => d.endsWith(".tar.enc")));
    // Die vorhandene Wochenkopie wird verfälscht — ihr Sidecar passt nicht mehr.
    writeFileSync(join(ort, "wochen", kopie), "verfaelscht");
    const zweit = fahre(b, ["taeglich"], { ZWEITER_ORT: ort, AUSLAGERUNG_WARTEN: "1" });
    expect(zweit.status, zweit.ausgabe).toBe(170);
    expect(String(belegJson(b, "auslagern.json").grund)).toContain("keine gueltige Kopie");
  });

  it("R2-3 · ist der Zeitraum nicht belegbar (mkdir scheitert nicht an „schon da“), ist das rot", () => {
    const b = neueBuehne();
    const ort = neuerOrdner("klarwerk-b3-zweitort-");
    mkdirSync(join(ort, "monate"), { recursive: true });
    // Ein gleichnamiger Eintrag, der KEIN Verzeichnis ist: mkdir scheitert, der Zeitraum ist nicht belegt.
    const monat = new Date().toISOString().slice(0, 7);
    writeFileSync(join(ort, "monate", `.${monat}.belegt`), "keine Marke");
    const r = fahre(b, ["taeglich"], { ZWEITER_ORT: ort });
    expect(r.status, r.ausgabe).toBe(170);
    expect(String(belegJson(b, "auslagern.json").grund)).toContain("nicht belegbar");
  });

  it("R2-4 · in tage/, wochen/ und monate/ besteht `sha256sum -c` am Sidecar der jeweiligen Kopie", () => {
    const b = neueBuehne();
    const ort = neuerOrdner("klarwerk-b3-zweitort-");
    const r = fahre(b, ["taeglich"], { ZWEITER_ORT: ort });
    expect(r.status, r.ausgabe).toBe(0);
    for (const stufe of ["tage", "wochen", "monate"]) {
      const sidecars = readdirSync(join(ort, stufe)).filter((d) => d.endsWith(".tar.enc.sha256"));
      expect(sidecars, stufe).toHaveLength(1);
      const c = spawnSync(
        "/bin/sh",
        [
          "-c",
          'cd "$1" && if command -v sha256sum >/dev/null; then sha256sum -c "$2"; else shasum -a 256 -c "$2"; fi',
          "sh",
          join(ort, stufe),
          String(sidecars[0]),
        ],
        { encoding: "utf8" },
      );
      expect(c.status, `${stufe}: ${c.stdout}${c.stderr}`).toBe(0);
    }
  });
});

describe("R2-5 · ein gescheiterter Wiederanlauf nach dem Rückweg ist 163, mit Grund", () => {
  function sicherung(b: Buehne): string {
    const r = fahre(b, ["sicherung"]);
    expect(r.status, r.ausgabe).toBe(0);
    const ziel = join(b.arbeit, "sicherungen/taeglich");
    return join(ziel, String(readdirSync(ziel).find((d) => d.endsWith(".dump"))));
  }

  it("pg_restore scheitert, Rückbenennung gelingt, `up` scheitert → 163 und der Beleg nennt den Neustart", () => {
    const b = neueBuehne();
    const dump = sicherung(b);
    const r = fahre(b, ["zurueckspielen", dump], {
      ZURUECKSPIELEN_BESTAETIGT: "klarwerk_prod",
      STUB_RESTORE_ROT: "1",
      STUB_UP_ROT: "1",
    });
    expect(r.status, r.ausgabe).toBe(163);
    const beleg = belegJson(b, "zurueckspielen.json");
    expect(String(beleg.rueckweg)).toContain("wieder als klarwerk_prod eingesetzt");
    expect(String(beleg.rueckweg)).toContain("WIEDERANLAUF GESCHEITERT");
  });

  it("gelingt der Wiederanlauf, bleibt es 162 — der Unterschied ist genau der Neustart", () => {
    const b = neueBuehne();
    const dump = sicherung(b);
    const r = fahre(b, ["zurueckspielen", dump], {
      ZURUECKSPIELEN_BESTAETIGT: "klarwerk_prod",
      STUB_RESTORE_ROT: "1",
    });
    expect(r.status, r.ausgabe).toBe(162);
    expect(String(belegJson(b, "zurueckspielen.json").rueckweg)).not.toContain("WIEDERANLAUF");
  });
});
