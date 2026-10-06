// ================================================================================================
// Fastify-Sicherheitsrest GHSA-3m5p-2c4r-xxw2 — Neubewertung am aktuellen Stand (README.md daneben).
// ================================================================================================
//
// Die Advisory (moderate, `>=5.8.3 <5.12.1`) betrifft `trustProxy` als HOP-ANZAHL. Dieser Test hält
// fest, worauf die Bewertung ruht:
//   1. Version: Lockdatei, laufende Instanz und Bewertung nennen dieselbe Version, und das Urteil
//      passt zu ihr; `package.json` lässt keine Auflösung in den betroffenen Bereich zu. Ändert sich
//      die gebundene Version, wird dieser Fall ROT — dann ist die Bewertung neu zu machen, nicht der
//      Test anzupassen.
//   2. Das Produkt reicht keine Hop-Anzahl an Fastify: mit `KLARWERK_TRUST_PROXY=1` bleibt
//      `request.ip` beim direkten Client die Socket-Adresse; mit IP-Liste wird derselbe Kopf vom
//      nicht vertrauten Client zurückgewiesen und nur über den vertrauten Proxy angenommen.
//   3. Ausgelieferte Konfiguration: `docker-compose.prod.yml` reicht die Variable nicht durch.
// Die Kalibrierung des Advisory-Falls auf 5.8.5 ist historisch (s. Kommentar im zweiten Block).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { resolveTrustProxy } from "../../services/app/src/addon-auth-throttle";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(HIER, "..", "..");

/** Der vertraute Proxy-Sprung vor dem Ursprung. */
const PROXY = "10.0.0.5";

/** Der gemeldete Bereich der Advisory: `>=5.8.3 <5.12.1`. */
const BETROFFEN_AB = [5, 8, 3] as const;
const BEHOBEN_AB = [5, 12, 1] as const;

function teile(version: string): number[] {
  return (version.split("-")[0] ?? "").split(".").map((t) => Number(t));
}

function vergleiche(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < 3; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) {
      return d;
    }
  }
  return 0;
}

function imBetroffenenBereich(version: string): boolean {
  const v = teile(version);
  return vergleiche(v, BETROFFEN_AB) >= 0 && vergleiche(v, BEHOBEN_AB) < 0;
}

function lockVersion(): string {
  const lock = JSON.parse(readFileSync(join(WURZEL, "package-lock.json"), "utf8")) as {
    packages: Record<string, { version?: string }>;
  };
  return lock.packages["node_modules/fastify"]?.version ?? "";
}

function bewertung(): { version: string; urteil: string } {
  const text = readFileSync(join(HIER, "README.md"), "utf8");
  return {
    version: /^\*\*Gebundene Version:\*\* (\S+)$/m.exec(text)?.[1] ?? "",
    urteil: /^\*\*Urteil:\*\* (.+)$/m.exec(text)?.[1]?.trim() ?? "",
  };
}

const ALT = process.env.KLARWERK_TRUST_PROXY;

afterEach(() => {
  if (ALT === undefined) {
    delete process.env.KLARWERK_TRUST_PROXY;
  } else {
    process.env.KLARWERK_TRUST_PROXY = ALT;
  }
});

/** Baut die echte Produktinstanz mit der gegebenen Einstellung und fragt `request.ip` ab. */
async function gemesseneIp(
  trustProxy: string | undefined,
  kopf: Record<string, string>,
  remoteAddress = PROXY,
): Promise<{ ip: string; version: string }> {
  if (trustProxy === undefined) {
    delete process.env.KLARWERK_TRUST_PROXY;
  } else {
    process.env.KLARWERK_TRUST_PROXY = trustProxy;
  }
  const app = buildApp(buildServices());
  app.get("/__pruefung/fastify-restbewertung/ip", async (request) => ({ ip: request.ip }));
  try {
    const res = await app.inject({
      method: "GET",
      url: "/__pruefung/fastify-restbewertung/ip",
      headers: kopf,
      remoteAddress,
    });
    expect(res.statusCode).toBe(200);
    return { ip: (res.json() as { ip: string }).ip, version: app.version };
  } finally {
    await app.close();
  }
}

/** Ein Weg über den vertrauten Proxy: der Proxy hat die echte Client-Adresse 203.0.113.7 angehängt. */
const GEFAELSCHTE_KETTE = { "x-forwarded-for": "198.51.100.66, 203.0.113.7" };
/** Ein Client, der den Ursprung DIREKT erreicht und eine Adresse seiner Wahl behauptet. */
const DIREKTER_CLIENT = "198.51.100.200";
const DIREKT_GEFAELSCHT = { "x-forwarded-for": "203.0.113.66" };

describe("GHSA-3m5p-2c4r-xxw2 · K1: Version am heutigen Stand", () => {
  it("Lockdatei und Bewertung nennen dieselbe Version, und das Urteil passt zum gemeldeten Bereich", () => {
    const lock = lockVersion();
    const { version, urteil } = bewertung();
    expect(lock, "node_modules/fastify fehlt in package-lock.json").not.toBe("");
    expect(
      version,
      `Die Bewertung nennt ${version}, die Lockdatei ${lock} — Bewertung neu machen`,
    ).toBe(lock);
    expect(urteil).toBe(
      imBetroffenenBereich(lock) ? "im betroffenen Bereich" : "außerhalb des betroffenen Bereichs",
    );
  });

  it("gebunden ist eine behobene Version, und package.json verlangt mindestens 5.12.1", () => {
    const lock = lockVersion();
    expect(imBetroffenenBereich(lock), `fastify ${lock} ist betroffen`).toBe(false);
    const pkg = JSON.parse(readFileSync(join(WURZEL, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    const spanne = pkg.dependencies.fastify ?? "";
    expect(spanne, "package.json erlaubt eine Auflösung in den betroffenen Bereich").toMatch(
      /^\^\d+\.\d+\.\d+$/,
    );
    expect(vergleiche(teile(spanne.slice(1)), BEHOBEN_AB)).toBeGreaterThanOrEqual(0);
  });

  it("die laufende Instanz meldet die Version aus der Lockdatei", async () => {
    const { version } = await gemesseneIp(undefined, {});
    expect(version, "Laufzeit und Lockdatei sind auseinandergelaufen").toBe(lockVersion());
  });
});

describe("GHSA-3m5p-2c4r-xxw2 · K2/K3: Konfiguration, direkter Zugriff am Proxy vorbei", () => {
  it("eine Zahl ergibt keine Hop-Anzahl mehr — nur IP-/CIDR-Listen ergeben Vertrauen", () => {
    expect(resolveTrustProxy({})).toBe(false);
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "" })).toBe(false);
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "true" })).toBe(false);
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "0" })).toBe(false);
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "1" })).toBe(false);
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "2" })).toBe(false);
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "10.0.0.5" })).toEqual(["10.0.0.5"]);
  });

  // KALIBRIERUNG AUF 5.8.5 — HISTORISCH. Solange 5.8.5 gebunden war, stand hier ein Fall mit nackter
  // Fastify-Instanz und `trustProxy: 1`: ein NICHT vertrauter, direkt verbundener Client bestimmte
  // mit seinem eigenen X-Forwarded-For `request.ip` (Ergebnis 203.0.113.66). Bestanden im Kandidaten
  // c277165b, Beleg `HISTORIE/nacharbeit-2/PRUEFUNG/fastify-restbewertung.json`. Mit der Hebung auf
  // 5.12.1 misst er nichts mehr über die gebundene Version und ist entfallen; die Aussage über das
  // Produkt tragen die Fälle unten, die von keiner numerischen Fastify-Einstellung abhängen.

  it("Produkt mit KLARWERK_TRUST_PROXY=1: der direkte Client kann request.ip NICHT mehr fälschen", async () => {
    const { ip } = await gemesseneIp("1", DIREKT_GEFAELSCHT, DIREKTER_CLIENT);
    expect(ip, "eine Hop-Anzahl wirkt wieder — GHSA-3m5p-2c4r-xxw2 ist erreichbar").toBe(
      DIREKTER_CLIENT,
    );
  });

  it("Produkt mit IP-Liste: derselbe Kopf vom nicht vertrauten direkten Client wird zurückgewiesen", async () => {
    const { ip } = await gemesseneIp(PROXY, DIREKT_GEFAELSCHT, DIREKTER_CLIENT);
    expect(ip).toBe(DIREKTER_CLIENT);
  });

  it("Produkt mit IP-Liste: über den vertrauten Proxy gilt die von ihm angehängte Adresse", async () => {
    const { ip } = await gemesseneIp(PROXY, GEFAELSCHTE_KETTE, PROXY);
    expect(ip).toBe("203.0.113.7");
  });

  it("Produkt ohne Einstellung: kein Weiterleitungskopf entscheidet über request.ip", async () => {
    expect((await gemesseneIp(undefined, GEFAELSCHTE_KETTE, PROXY)).ip).toBe(PROXY);
    expect((await gemesseneIp(undefined, DIREKT_GEFAELSCHT, DIREKTER_CLIENT)).ip).toBe(
      DIREKTER_CLIENT,
    );
  });

  it("docker-compose.prod.yml reicht KLARWERK_TRUST_PROXY nicht durch und lädt kein env_file", () => {
    const compose = readFileSync(join(WURZEL, "docker-compose.prod.yml"), "utf8");
    const app = /^ {2}app:\n([\s\S]*?)^ {4}ports:/m.exec(compose)?.[1] ?? "";
    expect(app, "Dienst app ohne environment-Block gefunden").toContain("environment:");
    expect(app).not.toMatch(/^\s+KLARWERK_TRUST_PROXY:/m);
    expect(compose).not.toMatch(/^\s*env_file:/m);
  });
});
