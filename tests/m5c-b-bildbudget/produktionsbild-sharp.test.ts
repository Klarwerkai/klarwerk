// ================================================================================================
// AUFNAHME gesamt-bildbudget · M5c-b-R2 — SHARP IM PRODUKTIONSBILD: PAKET, LOCKDATEI, PLATTFORMEN
// ================================================================================================
//
// DIE ENTSCHEIDUNG VOM 09.09. (14:42) verlangt für `sharp` „Paket und Lockfile gehören zur
// Prüfkette; Mac ARM64 und Linux x64 berücksichtigen (optionale Plattformpakete)" UND „ein realer
// Nachweis von Installation und Import im Produktions-Docker".
//
// WAS DIESE DATEI BELEGT — UND WAS AUSDRÜCKLICH NICHT. Sie liest die Dateien, aus denen das
// Produktionsbild entsteht (`Dockerfile`, `package.json`, `package-lock.json`), und hält fest, dass
// der Weg dorthin für beide Plattformen geschlossen ist. Sie BAUT KEIN Bild, installiert nichts und
// importiert nichts im Container. Der reale Nachweis im Produktions-Docker bleibt damit OFFEN; diese
// Datei ersetzt ihn nicht, sie macht nur jede Abweichung der Bauvorlage sofort sichtbar.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");

interface LockEintrag {
  version?: string;
  dev?: boolean;
  optional?: boolean;
  os?: string[];
  cpu?: string[];
  libc?: string[];
  engines?: { node?: string };
  optionalDependencies?: Record<string, string>;
}

const paket = JSON.parse(readFileSync(join(WURZEL, "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const lock = JSON.parse(readFileSync(join(WURZEL, "package-lock.json"), "utf8")) as {
  packages: Record<string, LockEintrag & { dependencies?: Record<string, string> }>;
};
const dockerfile = readFileSync(join(WURZEL, "Dockerfile"), "utf8");

/** Die Laufzeitstufe des Bildes — alles ab `FROM … AS runtime`. */
function laufzeitstufe(): string {
  const start = dockerfile.search(/^FROM\s+\S+\s+AS\s+runtime\s*$/m);
  expect(start, "keine Laufzeitstufe `AS runtime` im Dockerfile").toBeGreaterThanOrEqual(0);
  return dockerfile.slice(start);
}

function eintrag(name: string): LockEintrag {
  const e = lock.packages[`node_modules/${name}`];
  expect(e, `${name} fehlt in package-lock.json`).toBeDefined();
  return e as LockEintrag;
}

describe("M5c-b-R2 · sharp gehört zum Betrieb, nicht zur Werkzeugkette", () => {
  it("P1 · sharp ist Laufzeitabhängigkeit in package.json UND in der Wurzel der Lockdatei", () => {
    expect(paket.dependencies?.sharp, "sharp steht nicht unter dependencies").toBeDefined();
    expect(paket.devDependencies?.sharp, "sharp darf nicht dev-only sein").toBeUndefined();
    expect(lock.packages[""]?.dependencies?.sharp).toBe(paket.dependencies?.sharp);
    const sharp = eintrag("sharp");
    expect(sharp.dev, "sharp ist in der Lockdatei als dev markiert").not.toBe(true);
    expect(sharp.engines?.node).toBeDefined();
  });
});

describe("M5c-b-R2 · beide verlangten Plattformen sind in der Lockdatei gebunden", () => {
  const plattformen = [
    { name: "Linux x64 (Produktionsbild)", os: "linux", cpu: "x64", libc: "glibc" },
    { name: "Mac ARM64", os: "darwin", cpu: "arm64", libc: undefined },
  ] as const;

  it.each(plattformen)("P2 · $name: Binärpaket und libvips sind gebunden und optional", (p) => {
    const sharp = eintrag("sharp");
    const binaer = `@img/sharp-${p.os}-${p.cpu}`;
    const libvips = `@img/sharp-libvips-${p.os}-${p.cpu}`;
    for (const name of [binaer, libvips]) {
      expect(sharp.optionalDependencies?.[name], `${name} fehlt bei sharp`).toBeDefined();
      const e = eintrag(name);
      expect(e.version).toBe(sharp.optionalDependencies?.[name]);
      expect(e.optional, `${name} ist nicht optional`).toBe(true);
      expect(e.dev, `${name} ist als dev markiert`).not.toBe(true);
      expect(e.os).toEqual([p.os]);
      expect(e.cpu).toEqual([p.cpu]);
      if (p.libc) {
        expect(e.libc, `${name} passt nicht zur C-Bibliothek des Bildes`).toEqual([p.libc]);
      }
    }
  });
});

describe("M5c-b-R2 · die Bauvorlage des Produktionsbildes installiert genau diese Bindung", () => {
  it("P3 · Debian-Laufzeit (glibc), Node-Hauptversion erfüllt die sharp-Untergrenze", () => {
    const basis = /^FROM\s+node:(\d+)-(\S+?)\s+AS\s+runtime\s*$/m.exec(laufzeitstufe());
    expect(basis, "Laufzeitbasis ist kein offizielles node-Bild").not.toBeNull();
    const haupt = Number(basis?.[1]);
    // Die Untergrenze steht in der Lockdatei (`>=20.9.0`), nicht hier abgeschrieben.
    const untergrenze = Number(/>=\s*(\d+)/.exec(eintrag("sharp").engines?.node ?? "")?.[1]);
    expect(haupt).toBeGreaterThanOrEqual(untergrenze);
    // bookworm/bullseye = Debian = glibc. Ein alpine-Bild (musl) bräuchte die linuxmusl-Pakete.
    expect(basis?.[2]).toMatch(/^(bookworm|bullseye)(-slim)?$/);
  });

  it("P4 · Lockdatei wird kopiert und mit `npm ci --omit=dev` installiert — optionale Pakete bleiben", () => {
    const stufe = laufzeitstufe();
    expect(stufe).toMatch(/^COPY\s+package\.json\s+package-lock\.json\s+\.\/\s*$/m);
    const install = /^RUN\s+(npm ci[^\n]*)$/m.exec(stufe)?.[1] ?? "";
    expect(install).toContain("--omit=dev");
    // Wer optionale Pakete auslässt, installiert sharp OHNE seine Plattformbinärdatei.
    expect(install).not.toMatch(/--omit=optional|--no-optional/);
    // Das Modul, das sharp lädt, kommt mit `services` ins Bild.
    expect(stufe).toMatch(/^COPY\s+services\s+services\s*$/m);
  });
});
