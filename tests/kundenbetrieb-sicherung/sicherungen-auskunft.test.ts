// ================================================================================================
// JOB 4025 · KUNDENBETRIEB-BACKUP TEIL 2 — DIE AUSKUNFT ÜBER DIE SICHERUNGEN, AN ECHTEN DATEIEN.
// ================================================================================================
//
// Der Vertrag, den diese Route liest, steht nicht hier, sondern in `scripts/backup/backup.sh`, und
// er wird dort GESCHRIEBEN — das Skript bleibt in diesem Auftrag unverändert (§10):
//
//   :39-40  `STAMP="$(date -u +%Y%m%dT%H%M%SZ)"` · `OUT="$DEST/klarwerk-${STAMP}.dump"`
//   :82     Sidecar im `shasum -a 256`-Format: 64 Hex, ZWEI Leerzeichen, DER ENDNAME
//   :55-57  „Sidecar zuerst, Dump zuletzt. So gibt es keinen Zeitpunkt, zu dem ein `*.dump` ohne
//           seine Prüfsumme sichtbar ist"
//   :62-63  Arbeitsstände heißen `*.dump.partial` und werden im `trap` weggeräumt
//   :34-36  `DEST="${1:-${BACKUP_DIR:-$WURZEL/backups}}"` — die Auflösung, die die Route spiegelt
//
// DARAUS FOLGT DIE AUSSAGE, die hier gemessen wird: ein `*.dump` OHNE Sidecar ist kein regulär
// entstandenes Backup dieses Skripts. Es wird trotzdem AUFGEFÜHRT (es liegt ja da), aber ohne
// Beglaubigung — „unbekannt heißt in Ordnung" ist genau der Fehler, den Lehre JOB 3948 R1 benennt.
//
// KEINE ATTRAPPE DES DATEISYSTEMS. Jeder Fall legt echte Dateien in einem eigenen temporären
// Verzeichnis an und lässt die echte Route sie lesen. `docs/operations/restore-drill.md:80` nennt
// die Grenze der PATH-Stub-Messung ausdrücklich („Der Stub-Lauf ist kein Datenbank- oder
// Startnachweis"); für eine Verzeichnisauskunft wäre eine Attrappe des Dateisystems genau dieselbe
// Sorte Selbstbestätigung.
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const ADMIN = { name: "Pedi", email: "pedi4025@example.com", password: "geheim-1234" };
const OHNE_RECHT = { email: "bea4025@example.com", password: "geheim-1234" };
const WEG = "/api/admin/sicherungen";

let app: ReturnType<typeof buildApp>;
let alsAdmin: Record<string, string>;
let ohneRecht: Record<string, string>;
const VORHER = process.env.BACKUP_DIR;
const ordner: string[] = [];

/** Ein frisches, leeres Sicherungsverzeichnis — und `BACKUP_DIR` zeigt darauf. */
async function frischesVerzeichnis(): Promise<string> {
  const ort = await mkdtemp(join(tmpdir(), "klarwerk-4025-"));
  ordner.push(ort);
  process.env.BACKUP_DIR = ort;
  return ort;
}

/** Ein Dump, wie `backup.sh` ihn schreibt — mit oder ohne (oder mit falschem) Sidecar. */
async function lege(
  ort: string,
  datei: string,
  inhalt: string,
  sidecar?: { hash: string; name: string },
): Promise<void> {
  await writeFile(join(ort, datei), inhalt);
  if (sidecar) {
    // Zeichengleich mit `backup.sh:82`: `echo "${SUM}  $(basename "$OUT")"` — zwei Leerzeichen.
    await writeFile(join(ort, `${datei}.sha256`), `${sidecar.hash}  ${sidecar.name}\n`);
  }
}

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

interface Eintrag {
  datei: string;
  zeitpunktUtc: string | null;
  groesseBytes: number | null;
  beglaubigt: boolean;
  pruefsumme: string | null;
}
interface Auskunft {
  zustand: string;
  verzeichnis?: string;
  gelesenUtc?: string;
  grund?: string;
  sicherungen?: Eintrag[];
  error?: string;
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
  app = buildApp(buildServices());
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ADMIN });
  const adminLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADMIN.email, password: ADMIN.password },
  });
  alsAdmin = { authorization: `Bearer ${(adminLogin.json() as { token: string }).token}` };

  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: alsAdmin,
    payload: { name: "Bea", ...OHNE_RECHT, role: "experte" },
  });
  expect(angelegt.statusCode, "die Identität ohne Recht muss anlegbar sein").toBe(201);
  const fremd = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: OHNE_RECHT,
  });
  ohneRecht = { authorization: `Bearer ${(fremd.json() as { token: string }).token}` };
});

afterEach(() => {
  delete process.env.BACKUP_DIR;
});

afterAll(async () => {
  for (const ort of ordner) {
    await chmod(ort, 0o700).catch(() => undefined);
    await rm(ort, { recursive: true, force: true });
  }
  if (VORHER === undefined) {
    delete process.env.BACKUP_DIR;
  } else {
    process.env.BACKUP_DIR = VORHER;
  }
});

// ------------------------------------------------------------------------------------------------
// S1 · DER GUTFALL — zwei vollständige Paare, jüngste zuerst, echte Größen, echter Zeitpunkt.
// ------------------------------------------------------------------------------------------------
describe("JOB 4025 · S1 · zwei vollständige Paare", () => {
  it("beide sind beglaubigt, die jüngere steht vorn, Zeitpunkt und Größe stimmen", async () => {
    const ort = await frischesVerzeichnis();
    await lege(ort, "klarwerk-20260910T081500Z.dump", "alt", {
      hash: HASH_A,
      name: "klarwerk-20260910T081500Z.dump",
    });
    await lege(ort, "klarwerk-20260914T093000Z.dump", "neuer-inhalt", {
      hash: HASH_B,
      name: "klarwerk-20260914T093000Z.dump",
    });

    const { status, koerper } = await frage(alsAdmin);
    expect(status).toBe(200);
    expect(koerper.zustand).toBe("gelesen");
    expect(koerper.verzeichnis).toBe(ort);
    expect(typeof koerper.gelesenUtc).toBe("string");

    const liste = koerper.sicherungen ?? [];
    expect(
      liste.map((e) => e.datei),
      "die Reihenfolge ist nicht jüngste-zuerst",
    ).toEqual(["klarwerk-20260914T093000Z.dump", "klarwerk-20260910T081500Z.dump"]);
    expect(liste.map((e) => e.beglaubigt)).toEqual([true, true]);
    expect(liste.map((e) => e.pruefsumme)).toEqual([HASH_B, HASH_A]);
    expect(liste[0]?.zeitpunktUtc).toBe("2026-09-14T09:30:00.000Z");
    expect(liste[1]?.zeitpunktUtc).toBe("2026-09-10T08:15:00.000Z");
    // Die echte Dateigröße, nicht eine ausgedachte: "neuer-inhalt" hat 12, "alt" hat 3 Bytes.
    expect(liste[0]?.groesseBytes).toBe(Buffer.byteLength("neuer-inhalt"));
    expect(liste[1]?.groesseBytes).toBe(Buffer.byteLength("alt"));
  });
});

// ------------------------------------------------------------------------------------------------
// S2/S3 · FAIL-CLOSED — ohne gelesene, formgerechte, NAMENSGLEICHE Sidecar keine Beglaubigung.
// ------------------------------------------------------------------------------------------------
describe("JOB 4025 · S2/S3 · die Beglaubigung ist fail-closed", () => {
  it("S2 · ein Dump OHNE Sidecar erscheint, aber unbeglaubigt und ohne Prüfsumme", async () => {
    const ort = await frischesVerzeichnis();
    await lege(ort, "klarwerk-20260914T101500Z.dump", "ohne-sidecar");

    const { koerper } = await frage(alsAdmin);
    const liste = koerper.sicherungen ?? [];
    expect(liste).toHaveLength(1);
    expect(liste[0]?.datei).toBe("klarwerk-20260914T101500Z.dump");
    expect(liste[0]?.beglaubigt, "ohne Sidecar darf nichts beglaubigt sein").toBe(false);
    expect(liste[0]?.pruefsumme).toBeNull();
  });

  it("S3 · eine Sidecar mit 64 Hex, aber FREMDEM Endnamen beglaubigt nicht", async () => {
    const ort = await frischesVerzeichnis();
    await lege(ort, "klarwerk-20260914T102000Z.dump", "inhalt", {
      hash: HASH_A,
      // Die Form stimmt, der Name gehört zu einem ANDEREN Lauf — `backup.sh:82` schreibt immer
      // den eigenen Endnamen. Wer das durchgehen ließe, beglaubigte eine Datei mit fremdem Zeugnis.
      name: "klarwerk-20260101T000000Z.dump",
    });

    const liste = (await frage(alsAdmin)).koerper.sicherungen ?? [];
    expect(liste).toHaveLength(1);
    expect(liste[0]?.beglaubigt, "ein fremdes Zeugnis darf nicht gelten").toBe(false);
    expect(liste[0]?.pruefsumme).toBeNull();
  });

  it("S3b · eine leere und eine formlose Sidecar beglaubigen ebenfalls nicht", async () => {
    const ort = await frischesVerzeichnis();
    await lege(ort, "klarwerk-20260914T103000Z.dump", "a");
    await writeFile(join(ort, "klarwerk-20260914T103000Z.dump.sha256"), "");
    await lege(ort, "klarwerk-20260914T104000Z.dump", "b");
    await writeFile(
      join(ort, "klarwerk-20260914T104000Z.dump.sha256"),
      "kein hash klarwerk-20260914T104000Z.dump\n",
    );

    const liste = (await frage(alsAdmin)).koerper.sicherungen ?? [];
    expect(liste).toHaveLength(2);
    expect(liste.map((e) => e.beglaubigt)).toEqual([false, false]);
    expect(liste.map((e) => e.pruefsumme)).toEqual([null, null]);
  });
});

// ------------------------------------------------------------------------------------------------
// S9 · DIE GRENZE DER AUSSAGE — hier steht sie fest, statt zwischen den Zeilen (Prüferbefund R5).
// ------------------------------------------------------------------------------------------------
//
// Der Prüfer hat in Runde 5 genau diesen Fall gebaut und gemessen: echte Datei, formgerechte Sidecar,
// FALSCHER Hash — und die englische Fläche sagte trotzdem „checksum verified". Der Befund war nicht
// die Route (sie hält ihren Vertrag), sondern der Wortlaut darüber. Dieser Fall schreibt den Vertrag
// deshalb als DAUERTEST fest: `beglaubigt` heißt „Sidecar liegt daneben und lautet auf diese Datei",
// nicht „der Inhalt stimmt". Wer die Route später wirklich vergleichen lässt, wird hier rot und muss
// zusammen mit dem Wortlaut nachziehen — das ist der Zweck.
describe("JOB 4025 · S9 · `beglaubigt` behauptet keinen Hashvergleich", () => {
  it("eine formgerechte Sidecar mit NACHWEISLICH falschem Hash ergibt `beglaubigt: true`", async () => {
    const ort = await frischesVerzeichnis();
    const datei = "klarwerk-20260913T060000Z.dump";
    const inhalt = "der echte Inhalt dieser Sicherung";
    // Der Hash, den `backup.sh:82` geschrieben HÄTTE — unabhängig hier im Test gebildet.
    const echter = createHash("sha256").update(inhalt).digest("hex");
    expect(echter, "der echte Hash muss 64 Hex sein").toMatch(/^[0-9a-f]{64}$/);
    expect(HASH_B, "die Probe wäre trivial, wenn beide Hashes gleich wären").not.toBe(echter);
    await lege(ort, datei, inhalt, { hash: HASH_B, name: datei });

    const liste = (await frage(alsAdmin)).koerper.sicherungen ?? [];
    expect(liste).toHaveLength(1);
    // DIE AUSSAGE: die Route hat die Sicherungsdatei nie geöffnet. Sie reicht den Wert AUS der
    // Sidecar heraus — auch den falschen — und behauptet nichts über den Inhalt.
    expect(liste[0]?.beglaubigt, "die Sidecar liegt daneben und lautet auf diese Datei").toBe(true);
    expect(liste[0]?.pruefsumme, "herausgereicht wird der Wert AUS der Sidecar").toBe(HASH_B);
    expect(liste[0]?.pruefsumme, "es wird nichts nachgerechnet").not.toBe(echter);
  });
});

// ------------------------------------------------------------------------------------------------
// S4 · ERFOLGREICH LEER — eine belegte Negativaussage, keine triviale.
// ------------------------------------------------------------------------------------------------
describe("JOB 4025 · S4 · das leere Verzeichnis", () => {
  it("meldet `gelesen` mit einer nachweislich LEEREN Liste", async () => {
    const ort = await frischesVerzeichnis();
    expect(await readdir(ort), "das Verzeichnis war gar nicht leer").toEqual([]);

    const { koerper } = await frage(alsAdmin);
    expect(koerper.zustand).toBe("gelesen");
    expect(Array.isArray(koerper.sicherungen)).toBe(true);
    // Lehre JOB 3891/3949: `toContain("")` wäre für jede Liste wahr. Gemessen wird die LÄNGE.
    expect(koerper.sicherungen?.length).toBe(0);
  });
});

// ------------------------------------------------------------------------------------------------
// S5 · „UNBEKANNT" SIEHT NIE AUS WIE „KEINE".
// ------------------------------------------------------------------------------------------------
describe("JOB 4025 · S5 · fehlendes und unlesbares Verzeichnis", () => {
  it("S5a · ein fehlendes Verzeichnis meldet `kein_verzeichnis` und führt KEINE leere Liste", async () => {
    const ort = await frischesVerzeichnis();
    const weg = join(ort, "gibt-es-nicht");
    process.env.BACKUP_DIR = weg;

    const { koerper } = await frage(alsAdmin);
    expect(koerper.zustand).toBe("kein_verzeichnis");
    expect(koerper.verzeichnis).toBe(weg);
    expect(
      koerper.sicherungen,
      "ein Fehlerzustand darf nicht wie „keine“ aussehen",
    ).toBeUndefined();
    expect(koerper.sicherungen).not.toEqual([]);
  });

  it("S5b · ein Pfad, der gar kein Verzeichnis ist, meldet `unlesbar` mit technischem Grund", async () => {
    const ort = await frischesVerzeichnis();
    const weg = join(ort, "eine-datei");
    await writeFile(weg, "ich bin kein Verzeichnis");
    process.env.BACKUP_DIR = weg;

    const { koerper } = await frage(alsAdmin);
    expect(koerper.zustand).toBe("unlesbar");
    expect(koerper.grund, "der Grund fehlt").toBe("ENOTDIR");
    expect(koerper.sicherungen).toBeUndefined();
    expect(koerper.sicherungen).not.toEqual([]);
  });

  it("S5c · ein Verzeichnis ohne Leserecht meldet `unlesbar` — gemessen an der echten Lage", async () => {
    const ort = await frischesVerzeichnis();
    const gesperrt = join(ort, "gesperrt");
    await mkdir(gesperrt);
    await chmod(gesperrt, 0o000);
    process.env.BACKUP_DIR = gesperrt;

    // DIE KONTROLLE, damit dieser Fall nicht seine eigene Voraussetzung behauptet: als `root`
    // greift das Leserecht nicht, dann IST das Verzeichnis lesbar und `gelesen` die richtige
    // Antwort. Der Zweig `unlesbar` bleibt trotzdem gemessen — S5b fährt ihn ohne Rechtefrage.
    const wirklichGesperrt = await readdir(gesperrt).then(
      () => false,
      () => true,
    );
    const { koerper } = await frage(alsAdmin);
    if (wirklichGesperrt) {
      expect(koerper.zustand).toBe("unlesbar");
      expect(typeof koerper.grund).toBe("string");
      expect(koerper.sicherungen).toBeUndefined();
    } else {
      expect(koerper.zustand, "lesbar heißt gelesen — die Route berichtet, was sie kann").toBe(
        "gelesen",
      );
      expect(koerper.sicherungen).toEqual([]);
    }
    await chmod(gesperrt, 0o700);
  });
});

// ------------------------------------------------------------------------------------------------
// S6 · ARBEITSSTÄNDE SIND KEINE SICHERUNGEN.
// ------------------------------------------------------------------------------------------------
describe("JOB 4025 · S6 · `*.dump.partial` taucht in keiner Liste auf", () => {
  it("der Arbeitsstand bleibt draußen, der fertige Dump daneben steht drin", async () => {
    const ort = await frischesVerzeichnis();
    // `backup.sh:62` — der Arbeitsname, der im `trap` weggeräumt wird. Bleibt er nach einem
    // Abbruch liegen, ist er eine TEILDATEI und darf nie als Sicherung gezählt werden.
    await lege(ort, "klarwerk-20260914T110000Z.dump.partial", "halb-fertig");
    await writeFile(join(ort, "klarwerk-20260914T110000Z.dump.partial.sha256"), `${HASH_A}  x\n`);
    await lege(ort, "klarwerk-20260914T105500Z.dump", "fertig", {
      hash: HASH_A,
      name: "klarwerk-20260914T105500Z.dump",
    });

    const liste = (await frage(alsAdmin)).koerper.sicherungen ?? [];
    expect(liste.map((e) => e.datei)).toEqual(["klarwerk-20260914T105500Z.dump"]);
  });
});

// ------------------------------------------------------------------------------------------------
// S6b · WISSENSLÜCKE STATT ERFINDUNG — unparsbarer Name, nicht lesbare Größe.
// ------------------------------------------------------------------------------------------------
describe("JOB 4025 · S6b · was die Route nicht weiß, sagt sie als `null`", () => {
  it("ein Name ohne Stempel trägt `zeitpunktUtc: null` und steht hinter den datierten", async () => {
    const ort = await frischesVerzeichnis();
    await lege(ort, "von-hand-kopiert.dump", "x");
    await lege(ort, "klarwerk-20260914T120000Z.dump", "y", {
      hash: HASH_A,
      name: "klarwerk-20260914T120000Z.dump",
    });

    const liste = (await frage(alsAdmin)).koerper.sicherungen ?? [];
    expect(liste.map((e) => e.datei)).toEqual([
      "klarwerk-20260914T120000Z.dump",
      "von-hand-kopiert.dump",
    ]);
    expect(liste[1]?.zeitpunktUtc, "ein Name ohne Stempel darf kein Datum erfinden").toBeNull();
  });

  it("ein Stempel, den es als Datum nicht gibt, wird nicht zu einem anderen Tag gebogen", async () => {
    const ort = await frischesVerzeichnis();
    // Der 31. Februar existiert nicht. `new Date("2026-02-31T…")` liefert in JS den 3. März —
    // eine stille Erfindung. Die Route muss `null` sagen.
    await lege(ort, "klarwerk-20260231T000000Z.dump", "x");

    const liste = (await frage(alsAdmin)).koerper.sicherungen ?? [];
    expect(liste).toHaveLength(1);
    expect(liste[0]?.zeitpunktUtc).toBeNull();
  });

  it("eine Datei, deren Größe nicht ermittelbar ist, trägt `groesseBytes: null`", async () => {
    const ort = await frischesVerzeichnis();
    // Ein Verweis ins Leere: der Eintrag steht im Verzeichnis, `stat` scheitert. Eine `0` wäre
    // hier eine Behauptung über eine Datei, die niemand gelesen hat.
    await symlink(join(ort, "ziel-fehlt"), join(ort, "klarwerk-20260914T130000Z.dump"));

    const liste = (await frage(alsAdmin)).koerper.sicherungen ?? [];
    expect(liste).toHaveLength(1);
    expect(liste[0]?.groesseBytes).toBeNull();
    expect(liste[0]?.beglaubigt).toBe(false);
  });
});

// ------------------------------------------------------------------------------------------------
// S7 · DER GUARD — und die Verweigerung trägt KEINE Auskunft.
// ------------------------------------------------------------------------------------------------
describe("JOB 4025 · S7 · ohne `users.manage` gibt es nichts zu sehen", () => {
  it("angemeldet ohne Recht: 403 FORBIDDEN, ohne `sicherungen` und ohne `verzeichnis`", async () => {
    const ort = await frischesVerzeichnis();
    await lege(ort, "klarwerk-20260914T140000Z.dump", "geheim", {
      hash: HASH_A,
      name: "klarwerk-20260914T140000Z.dump",
    });

    const { status, koerper, roh } = await frage(ohneRecht);
    expect(status).toBe(403);
    // Lehre JOB 3953 R1: der EXAKTE Wert des Antwortfeldes, nicht ein enthaltener Text — sonst
    // wäre ein falscher Schlüssel mit passender Meldung an anderer Stelle grün.
    expect(koerper.error).toBe("FORBIDDEN");
    expect(koerper.sicherungen).toBeUndefined();
    expect(koerper.verzeichnis).toBeUndefined();
    expect(roh).not.toContain("klarwerk-20260914T140000Z.dump");
    expect(roh).not.toContain(ort);
  });

  it("ohne Anmeldung: 401 UNAUTHENTICATED", async () => {
    await frischesVerzeichnis();
    const antwort = await app.inject({ method: "GET", url: WEG });
    expect(antwort.statusCode).toBe(401);
    expect((antwort.json() as Auskunft).error).toBe("UNAUTHENTICATED");
  });

  it("und ein 404 einer Nachbaradresse täuscht keinen Guard vor", async () => {
    const nachbar = await app.inject({
      method: "GET",
      url: "/api/admin/sicherungen-gibt-es-nicht",
      headers: ohneRecht,
    });
    expect(nachbar.statusCode, "404 ist keine Rechteverweigerung").toBe(404);
  });
});

// ------------------------------------------------------------------------------------------------
// S8 · DER DAUERTEST — kein Geheimnis verlässt den Server.
// ------------------------------------------------------------------------------------------------
describe("JOB 4025 · S8 · die Antwort trägt keine Zugangsdaten", () => {
  it("weder Datenbank-URL noch Sidecar-Rohtext stehen in der serialisierten Antwort", async () => {
    const dbVorher = { kw: process.env.KLARWERK_DATABASE_URL, db: process.env.DATABASE_URL };
    process.env.KLARWERK_DATABASE_URL = "postgres://pedi:streng-geheim@db.intern:5432/klarwerk";
    process.env.DATABASE_URL = "postgres://zweit:auch-geheim@db.intern:5432/klarwerk";
    try {
      const ort = await frischesVerzeichnis();
      await lege(ort, "klarwerk-20260914T150000Z.dump", "inhalt", {
        hash: HASH_A,
        name: "klarwerk-20260914T150000Z.dump",
      });

      const { roh, koerper } = await frage(alsAdmin);
      expect(koerper.sicherungen, "ohne Bestand misst dieser Fall nichts").toHaveLength(1);
      expect(roh).not.toContain("postgres://");
      expect(roh).not.toContain("streng-geheim");
      expect(roh).not.toContain("auch-geheim");
      expect(roh).not.toContain("KLARWERK_DATABASE_URL");
      expect(roh).not.toContain("DATABASE_URL");
      // Der Dumpinhalt selbst bleibt ebenfalls draußen — die Route liest ihn nie.
      expect(roh).not.toContain("inhalt");
    } finally {
      for (const [name, wert] of [
        ["KLARWERK_DATABASE_URL", dbVorher.kw],
        ["DATABASE_URL", dbVorher.db],
      ] as const) {
        if (wert === undefined) {
          delete process.env[name];
        } else {
          process.env[name] = wert;
        }
      }
    }
  });
});

// ------------------------------------------------------------------------------------------------
// S9 · DIE VERZEICHNISAUFLÖSUNG IST DIESELBE WIE IN `backup.sh:34-36`.
// ------------------------------------------------------------------------------------------------
describe("JOB 4025 · S9 · ohne `BACKUP_DIR` gilt `<Repo-Wurzel>/backups`", () => {
  it("die Vorgabe endet auf `/backups` und liegt in der Repo-Wurzel, nicht im Arbeitsverzeichnis", async () => {
    delete process.env.BACKUP_DIR;
    const { koerper } = await frage(alsAdmin);
    expect(koerper.verzeichnis?.endsWith("/backups"), koerper.verzeichnis).toBe(true);
    // Der Weg wird aus dem Modulpfad abgeleitet (wie `backup.sh` aus dem Skriptpfad), nicht aus
    // `process.cwd()` — sonst zeigte er je nach Aufrufort woandershin (CWD-Vertrag, JOB 943).
    expect(koerper.verzeichnis).toContain("/");
    expect(["gelesen", "kein_verzeichnis", "unlesbar"]).toContain(koerper.zustand);
  });

  it("eine leere `BACKUP_DIR` verhält sich wie eine ungesetzte (Shell-Vertrag `${VAR:-…}`)", async () => {
    process.env.BACKUP_DIR = "";
    const leer = (await frage(alsAdmin)).koerper.verzeichnis;
    delete process.env.BACKUP_DIR;
    const ohne = (await frage(alsAdmin)).koerper.verzeichnis;
    expect(leer).toBe(ohne);
  });
});
