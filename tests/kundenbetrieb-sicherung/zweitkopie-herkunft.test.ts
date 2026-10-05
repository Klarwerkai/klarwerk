import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
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
  type Buehne,
  belegJson,
  buehne,
  fahre,
  neueAusgabe,
} from "../kundenbetrieb-compose/docker-attrappe";

// ==================================================================================================
// B3 · LAUF 3 · BEFUND B1/B2 — DIE ZWEITKOPIE TRÄGT IHREN HERKUNFTSNACHWEIS, ODER SIE IST ROT.
// ==================================================================================================
//
// DER BEFUND (unabhängige Prüfung, Kandidat e8b9e934): `schritt_auslagern` kopierte den
// Herkunftsnachweis mit `[ ! -f herkunft ] || cp herkunft paket/`. Scheiterte dieses `cp`, lief
// der Schritt weiter: `taeglich` 0, `auslagern` 0, „nachgeprueft: ja" — die mit echtem openssl
// entschlüsselte Zweitkopie enthielt aber nur Dump und Prüfsumme. Zurückgespielt hätte sie der
// Betreiber nie: `wiederherstellen` verweigert einen Dump ohne Herkunftsnachweis mit 161.
// Die Anleitungen (restore-drill.md A, backup-disaster-recovery.md §13.2) sagten das Gegenteil zu.
//
// GEMESSEN WIRD, WAS DIE PRÜFUNG REPRODUZIERT HAT, MIT DERSELBEN STÖRUNG: ein `cp` auf dem PATH,
// das AUSSCHLIESSLICH das Kopieren einer `*.herkunft.json` scheitern lässt und alles andere an das
// echte `cp` weitergibt. `compose-drill.sh`, `backup.sh`, `openssl` und `tar` sind echt; `docker`
// ist die Attrappe aus `tests/kundenbetrieb-compose/docker-attrappe.ts` (Grenze wie dort: die
// ENTSCHEIDUNGEN des Skripts, nicht das Verhalten von Docker/PostgreSQL).
//
//   ZH1  `taeglich` mit gestörtem Kopieren → 170, und am zweiten Ort liegt KEINE Kopie.
//   ZH2  derselbe Fehler im vollständigen `ablauf` → Schritt `taeglich` 170 in ablauf.json, der
//        Ablauf ist nicht 0.
//   ZH3  eine Sicherung ohne Herkunftsnachweis wird nicht ausgelagert (170) — nie still ohne ihn.
//   ZH4  Gegenseite: ungestört enthält die ENTSCHLÜSSELTE Zweitkopie den Nachweis bytegleich, und
//        `wiederherstellen` nimmt den aus ihr zurückgeholten Dump an (kein 161).
const OPENSSL = spawnSync("/bin/sh", ["-c", "command -v openssl"]).status === 0;
const ECHTES_CP = spawnSync("/bin/sh", ["-c", "command -v cp"], { encoding: "utf8" }).stdout.trim();
if (!OPENSSL) {
  process.stderr.write(
    "[KLARWERK] B3 Zweitkopie-Herkunft ÜBERSPRUNGEN: openssl fehlt in dieser Umgebung.\n",
  );
}

const buehnen: Buehne[] = [];
const ordner: string[] = [];
afterEach(() => {
  for (const b of buehnen.splice(0)) rmSync(b.ort, { recursive: true, force: true });
  for (const o of ordner.splice(0)) rmSync(o, { recursive: true, force: true });
});

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

/** PATH-Vorsatz mit einem `cp`, das nur beim Herkunftsnachweis scheitert und es protokolliert. */
function gestoertesCp(): { pfad: string; protokoll: string } {
  const bin = neuerOrdner("klarwerk-b3-cp-");
  const protokoll = join(bin, "cp.protokoll");
  writeFileSync(
    join(bin, "cp"),
    `#!/bin/sh
for a in "$@"; do
  case "$a" in
    *.herkunft.json) echo "cp-stoerung $a" >>"${protokoll}"; echo "cp: Stoerung (Test)" >&2; exit 1 ;;
  esac
done
exec "${ECHTES_CP}" "$@"
`,
    { mode: 0o755 },
  );
  return { pfad: bin, protokoll };
}

function encKopien(ort: string): string[] {
  const r = spawnSync("/bin/sh", ["-c", `find "$1" -name '*.tar.enc' -type f`, "sh", ort], {
    encoding: "utf8",
  });
  return (r.stdout ?? "").split("\n").filter(Boolean);
}

const sha256 = (datei: string) => createHash("sha256").update(readFileSync(datei)).digest("hex");

describe.skipIf(!OPENSSL)("B3 Lauf 3 · B1/B2 — Herkunftsnachweis in der Zweitkopie", () => {
  it("ZH1 · gescheitertes Kopieren des Herkunftsnachweises → taeglich 170, keine Zweitkopie", () => {
    const b = neueBuehne();
    const ort = neuerOrdner("klarwerk-b3-zweitort-");
    const cp = gestoertesCp();
    const r = fahre(b, ["taeglich"], {
      ZWEITER_ORT: ort,
      PATH: `${cp.pfad}:${b.env.PATH ?? ""}`,
    });
    // Die Störung hat wirklich gegriffen — sonst misst dieser Fall nichts.
    expect(readFileSync(cp.protokoll, "utf8")).toContain(".herkunft.json");
    expect(r.status, r.ausgabe).toBe(170);
    expect(r.ausgabe).toContain("ABBRUCH (170)");
    expect(r.ausgabe).not.toContain("nachgeprueft: ja");
    expect(encKopien(ort)).toEqual([]);
  });

  it("ZH2 · derselbe Fehler im vollständigen ablauf: Schritt taeglich 170, Ablauf nicht 0", () => {
    const b = neueBuehne();
    const ort = neuerOrdner("klarwerk-b3-zweitort-");
    const cp = gestoertesCp();
    const r = fahre(b, ["ablauf", neueAusgabe(b)], {
      ZWEITER_ORT: ort,
      ZURUECKSPIELEN_BESTAETIGT: "klarwerk_prod",
      PATH: `${cp.pfad}:${b.env.PATH ?? ""}`,
    });
    const ablauf = belegJson(b, "ablauf.json") as unknown as {
      schritte: { schritt: string; exit: number }[];
      exit: number;
    };
    const taeglich = ablauf.schritte.find((s) => s.schritt === "taeglich");
    expect(taeglich, r.ausgabe).toBeDefined();
    expect(taeglich?.exit, r.ausgabe).toBe(170);
    expect(ablauf.exit).not.toBe(0);
    expect(r.status).not.toBe(0);
    expect(encKopien(ort)).toEqual([]);
  }, 180_000);

  it("ZH3 · eine Sicherung ohne Herkunftsnachweis wird nicht ausgelagert (170)", () => {
    const b = neueBuehne();
    const ort = neuerOrdner("klarwerk-b3-zweitort-");
    const s = fahre(b, ["sicherung"]);
    expect(s.status, s.ausgabe).toBe(0);
    const ziel = join(b.arbeit, "sicherungen/taeglich");
    const dump = readdirSync(ziel)
      .filter((d) => d.endsWith(".dump"))
      .sort()
      .at(-1);
    expect(dump).toBeTruthy();
    rmSync(join(ziel, `${dump}.herkunft.json`));
    const r = fahre(b, ["auslagern", join(ziel, String(dump))], { ZWEITER_ORT: ort });
    expect(r.status, r.ausgabe).toBe(170);
    expect(r.ausgabe).toContain("kein Herkunftsnachweis");
    expect(encKopien(ort)).toEqual([]);
  });

  it("ZH4 · ungestört: entschlüsselte Zweitkopie enthält den Nachweis bytegleich, Wiederherstellung nimmt sie an", () => {
    const b = neueBuehne();
    const ort = neuerOrdner("klarwerk-b3-zweitort-");
    const r = fahre(b, ["taeglich"], { ZWEITER_ORT: ort });
    expect(r.status, r.ausgabe).toBe(0);
    expect(belegJson(b, "auslagern.json").nachgeprueft).toBe("ja");
    const tage = readdirSync(join(ort, "tage")).filter((d) => d.endsWith(".tar.enc"));
    expect(tage).toHaveLength(1);
    const dumpName = String(tage[0]).replace(/\.tar\.enc$/, "");
    const original = join(b.arbeit, "sicherungen/taeglich", dumpName);

    // Unabhängig entschlüsselt — in einen eigenen Ordner, wie es der Betreiber im Ernstfall tut.
    const aus = neuerOrdner("klarwerk-b3-entschl-");
    const d = spawnSync(
      "/bin/sh",
      [
        "-c",
        `openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass "file:$1" -in "$2" | (cd "$3" && tar -xf -)`,
        "sh",
        join(b.arbeit, "geheim/auslagerung.schluessel"),
        join(ort, "tage", String(tage[0])),
        aus,
      ],
      { encoding: "utf8" },
    );
    expect(d.status, d.stderr).toBe(0);
    const herkunft = join(aus, `${dumpName}.herkunft.json`);
    expect(existsSync(herkunft)).toBe(true);
    expect(sha256(herkunft)).toBe(sha256(`${original}.herkunft.json`));
    expect(sha256(join(aus, dumpName))).toBe(sha256(original));

    // Der zurückgeholte Dump ist an diese Instanz gebunden: `wiederherstellen` verweigert ihn NICHT.
    const zurueck = join(b.arbeit, "aus-zweitkopie");
    mkdirSync(zurueck, { recursive: true });
    for (const f of [dumpName, `${dumpName}.sha256`, `${dumpName}.herkunft.json`]) {
      writeFileSync(join(zurueck, f), readFileSync(join(aus, f)));
    }
    const w = fahre(b, ["wiederherstellen", join(zurueck, dumpName)]);
    expect(w.ausgabe).not.toContain("ABBRUCH (161)");
    expect(w.status, w.ausgabe).not.toBe(161);
  });
});
