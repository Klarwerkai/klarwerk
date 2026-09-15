// ================================================================================================
// JOB 4109 · SICHERUNGSLISTE-SUFFIXNAMEN — die Auskunft liest ALLE Namen, die das Skript schreibt.
// ================================================================================================
//
// DER BEFUND (Prüfer BEN zu JOB 4025 Runde 7, „Neufund an unverändertem Code"): seit JOB 4057 weicht
// `scripts/backup/backup.sh` bei mehreren Läufen IN DERSELBEN SEKUNDE auf `klarwerk-<STAMP>_02.dump`
// aus (`freien_endnamen_suchen`, `printf '%s_%02d.dump'`). Der Datumsparser der Route kannte nur den
// Grundnamen. Folge auf der Fläche des Betreibers: die JÜNGSTE Sicherung stand undatiert GANZ UNTEN,
// ohne Zeitpunkt und ohne Alter — wer oben nachsah, ob heute Nacht gesichert wurde, las ein Datum von
// gestern und hielt das Backup für stehengeblieben.
//
// GEMESSEN WIRD AN ECHTEN DATEIEN, wie in `sicherungen-auskunft.test.ts`: eigenes temporäres
// Verzeichnis über `BACKUP_DIR`, echte Route, keine Attrappe des Dateisystems.
//
// UND V1 LIEST DIE NAMENSREGEL AUS DEM SKRIPT SELBST, statt sie abzuschreiben (Promptverbesserung
// des Prüfers zu JOB 4025 R7). Gesucht wird per MUSTER, nie per Zeilennummer: `backup.sh` ist
// gleichzeitig Zielpfad von JOB 4097, und ein Zeilenbezug wäre nach dessen Einbau falsch. Findet V1
// die Muster nicht, SCHLÄGT er fehl — ein Vertragstest, der bei geänderter Regel stillschweigend
// durchläuft, bewacht nichts. `backup.sh` wird dabei ausschließlich GELESEN.
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const ADMIN = { name: "Pedi", email: "pedi4109@example.com", password: "geheim-1234" };
const WEG = "/api/admin/sicherungen";
const HASH_A = "a".repeat(64);

let app: ReturnType<typeof buildApp>;
let alsAdmin: Record<string, string>;
const VORHER = process.env.BACKUP_DIR;
const ordner: string[] = [];

interface Eintrag {
  datei: string;
  zeitpunktUtc: string | null;
  groesseBytes: number | null;
  beglaubigt: boolean;
  pruefsumme: string | null;
  folgeNummer: number | null;
}

async function frischesVerzeichnis(): Promise<string> {
  const ort = await mkdtemp(join(tmpdir(), "klarwerk-4109-"));
  ordner.push(ort);
  process.env.BACKUP_DIR = ort;
  return ort;
}

/** Ein vollständiges Paar, wie `backup.sh` es veröffentlicht: Dump plus formgerechte Sidecar. */
async function lege(ort: string, datei: string): Promise<void> {
  await writeFile(join(ort, datei), `inhalt von ${datei}`);
  // Zeichengleich mit `backup.sh:82`: 64 Hex, ZWEI Leerzeichen, der Endname.
  await writeFile(join(ort, `${datei}.sha256`), `${HASH_A}  ${datei}\n`);
}

async function liste(): Promise<Eintrag[]> {
  const antwort = await app.inject({ method: "GET", url: WEG, headers: alsAdmin });
  expect(antwort.statusCode).toBe(200);
  const koerper = antwort.json() as { zustand: string; sicherungen?: Eintrag[] };
  expect(koerper.zustand).toBe("gelesen");
  return koerper.sicherungen ?? [];
}

beforeAll(async () => {
  app = buildApp(buildServices());
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ADMIN });
  const angemeldet = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADMIN.email, password: ADMIN.password },
  });
  alsAdmin = { authorization: `Bearer ${(angemeldet.json() as { token: string }).token}` };
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

// ------------------------------------------------------------------------------------------------
// R1 · DER FALL DES BETREIBERS — drei Läufe in derselben Sekunde, einer von gestern.
// ------------------------------------------------------------------------------------------------
describe("JOB 4109 · R1 · Suffixnamen tragen ihren Zeitpunkt und stehen vorn", () => {
  it("die Reihenfolge ist _03, _02, Grundname, gestern — jeder mit Zeitpunkt und Folgenummer", async () => {
    const ort = await frischesVerzeichnis();
    // Bewusst in einer Reihenfolge angelegt, aus der weder Anlege- noch Verzeichnisreihenfolge
    // zufällig die richtige Antwort ergäbe.
    await lege(ort, "klarwerk-20260915T093000Z_02.dump");
    await lege(ort, "klarwerk-20260914T030000Z.dump");
    await lege(ort, "klarwerk-20260915T093000Z.dump");
    await lege(ort, "klarwerk-20260915T093000Z_03.dump");

    const eintraege = await liste();
    expect(
      eintraege.map((e) => e.datei),
      "die jüngste Sicherung steht nicht oben",
    ).toEqual([
      "klarwerk-20260915T093000Z_03.dump",
      "klarwerk-20260915T093000Z_02.dump",
      "klarwerk-20260915T093000Z.dump",
      "klarwerk-20260914T030000Z.dump",
    ]);
    expect(
      eintraege.map((e) => e.zeitpunktUtc),
      "eine vom Skript erzeugte Sicherung ohne Zeitpunkt",
    ).toEqual([
      "2026-09-15T09:30:00.000Z",
      "2026-09-15T09:30:00.000Z",
      "2026-09-15T09:30:00.000Z",
      "2026-09-14T03:00:00.000Z",
    ]);
    expect(eintraege.map((e) => e.folgeNummer)).toEqual([3, 2, 1, 1]);
    // Kein Eintrag verliert dabei seine übrigen Aussagen.
    expect(eintraege.map((e) => e.beglaubigt)).toEqual([true, true, true, true]);
  });

  it("R1b · zwei Aufrufe am selben Bestand liefern dieselbe Reihenfolge", async () => {
    const ort = await frischesVerzeichnis();
    await lege(ort, "klarwerk-20260915T093000Z.dump");
    await lege(ort, "klarwerk-20260915T093000Z_02.dump");

    const erste = (await liste()).map((e) => e.datei);
    const zweite = (await liste()).map((e) => e.datei);
    expect(erste).toEqual(["klarwerk-20260915T093000Z_02.dump", "klarwerk-20260915T093000Z.dump"]);
    expect(zweite, "die Reihenfolge schwankt zwischen zwei Aufrufen").toEqual(erste);
  });
});

// ------------------------------------------------------------------------------------------------
// R2 · DIE GRENZEN BLEIBEN — die Gegenprobe gegen einen zu weit geöffneten Ausdruck.
// ------------------------------------------------------------------------------------------------
//
// Dieser Fall ist HEUTE SCHON GRÜN und muss grün bleiben. Er ist der Beleg dafür, dass Lieferung 1
// genau eine Form dazunimmt (`_NN`, zwei Ziffern) und nicht die Strenge aufgibt.
describe("JOB 4109 · R2 · was der Form nicht entspricht, bleibt unbekannt", () => {
  it("falsches Datum, eine Ziffer, drei Ziffern, Buchstaben: alle `null` und alle hinten", async () => {
    const ort = await frischesVerzeichnis();
    // Der 31. Februar existiert nicht — auch mit gültigem Suffix bleibt der Name unparsbar.
    await lege(ort, "klarwerk-20260231T000000Z_02.dump");
    await lege(ort, "klarwerk-20260915T093000Z_2.dump");
    await lege(ort, "klarwerk-20260915T093000Z_002.dump");
    await lege(ort, "klarwerk-20260915T093000Z_ab.dump");
    await lege(ort, "klarwerk-20260915T093000Z.dump");
    await lege(ort, "klarwerk-20260915T093000Z_02.dump");

    const eintraege = await liste();
    expect(eintraege).toHaveLength(6);

    const gueltig = ["klarwerk-20260915T093000Z_02.dump", "klarwerk-20260915T093000Z.dump"];
    expect(
      eintraege.slice(0, 2).map((e) => e.datei),
      "die gültigen Namen stehen nicht vorn",
    ).toEqual(gueltig);

    const ungueltig = eintraege.slice(2);
    expect(
      [...ungueltig.map((e) => e.datei)].sort(),
      "ein unparsbarer Name ist nach vorn gerutscht",
    ).toEqual(
      [
        "klarwerk-20260231T000000Z_02.dump",
        "klarwerk-20260915T093000Z_002.dump",
        "klarwerk-20260915T093000Z_2.dump",
        "klarwerk-20260915T093000Z_ab.dump",
      ].sort(),
    );
    expect(
      ungueltig.map((e) => e.zeitpunktUtc),
      "ein unparsbarer Name hat ein Datum erfunden",
    ).toEqual([null, null, null, null]);
    // Unbekanntes wird NIE zu „1": über die Reihenfolge innerhalb einer Sekunde ist hier nichts
    // bekannt (dieselbe Regel, die `groesseBytes: null` trägt).
    expect(
      ungueltig.map((e) => e.folgeNummer),
      "eine unbekannte Folge wurde als „1“ behauptet",
    ).toEqual([null, null, null, null]);
  });
});

// ------------------------------------------------------------------------------------------------
// V1 · DER GEMEINSAME VERTRAG — die Namensregel kommt aus `backup.sh`, nicht aus diesem Test.
// ------------------------------------------------------------------------------------------------
const SKRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "scripts",
  "backup",
  "backup.sh",
);

/**
 * Der Nachsatz jeder Meldung dieses Vertrags — er sagt, was zu tun ist, statt nur zu scheitern.
 * Ein Vertragstest, der bei geänderter Namensregel still durchliefe, bewachte nichts.
 */
const NACHFUEHREN =
  "Dieser Vertragstest darf nicht stillschweigend durchlaufen — Muster im Test und Parser in `admin-routes.ts` gehören gemeinsam nachgeführt.";

/** Ein Muster im Skript, oder ein Fehlschlag, der sagt, dass die Namensregel sich geändert hat. */
function ausSkript(quelle: string, muster: RegExp, was: string): string {
  const treffer = muster.exec(quelle);
  if (!treffer || treffer[1] === undefined) {
    throw new Error(
      `Die Namensregel in scripts/backup/backup.sh hat sich geändert: ${was} ist dort nicht mehr zu finden (gesucht: ${muster}). ${NACHFUEHREN}`,
    );
  }
  return treffer[1];
}

/** Das `date -u`-Format des Skripts auf einen festen Zeitpunkt angewandt — nur der genutzte Umfang. */
function stempel(format: string, zeit: Date): string {
  const teile: Record<string, string> = {
    "%Y": String(zeit.getUTCFullYear()).padStart(4, "0"),
    "%m": String(zeit.getUTCMonth() + 1).padStart(2, "0"),
    "%d": String(zeit.getUTCDate()).padStart(2, "0"),
    "%H": String(zeit.getUTCHours()).padStart(2, "0"),
    "%M": String(zeit.getUTCMinutes()).padStart(2, "0"),
    "%S": String(zeit.getUTCSeconds()).padStart(2, "0"),
  };
  const gebaut = format.replace(/%./g, (platzhalter) => {
    const wert = teile[platzhalter];
    if (wert === undefined) {
      throw new Error(
        `Die Namensregel in scripts/backup/backup.sh nutzt den Zeitplatzhalter ${platzhalter}, den dieser Vertragstest nicht abbilden kann. ${NACHFUEHREN}`,
      );
    }
    return wert;
  });
  return gebaut;
}

/** Die `printf`-Vorlage des Skripts für den Suffixnamen, auf Basisname und Nummer angewandt. */
function suffixname(vorlage: string, basisname: string, nummer: number): string {
  if (!/^%s_%02d\.dump$/.test(vorlage)) {
    throw new Error(
      `Die Namensregel in scripts/backup/backup.sh hat sich geändert: die printf-Vorlage lautet jetzt „${vorlage}“ statt „%s_%02d.dump“. ${NACHFUEHREN}`,
    );
  }
  return `${basisname}_${String(nummer).padStart(2, "0")}.dump`;
}

describe("JOB 4109 · V1 · jeder Name, den das Skript erzeugen kann, erscheint mit Zeitpunkt", () => {
  it("Grundname und Suffixname werden aus backup.sh gelesen und von der Route datiert", async () => {
    const quelle = await readFile(SKRIPT, "utf8");

    // Gesucht wird per MUSTER, nie per Zeilennummer (JOB 4097 arbeitet an derselben Datei).
    const format = ausSkript(quelle, /STAMP="\$\(date -u \+([^)"\s]+)\)"/, "das `date -u`-Format");
    const basisVorlage = ausSkript(quelle, /BASISNAME="([^"]+)"/, "die Vorlage für BASISNAME");
    const endVorlage = ausSkript(quelle, /ENDNAME="([^"]+)"/, "die Vorlage für ENDNAME");
    const printfVorlage = ausSkript(
      quelle,
      /kandidat="\$\(printf '([^']+)'/,
      "die printf-Vorlage des Suffixnamens",
    );

    // Die Vorlagen des Skripts sind Shell-Einsetzungen über `$STAMP`. Aus ihnen entstehen echte
    // Namen, indem genau diese eine Variable ersetzt wird.
    const zeit = new Date("2026-09-15T09:30:00.000Z");
    const STAMP = stempel(format, zeit);
    expect(STAMP, "der gebaute Stempel ist leer").not.toBe("");
    const einsetzen = (vorlage: string): string => {
      const gebaut = vorlage.replaceAll("${STAMP}", STAMP);
      if (gebaut.includes("$")) {
        throw new Error(
          `Die Namensregel in scripts/backup/backup.sh hat sich geändert: „${vorlage}“ enthält eine Variable, die dieser Vertragstest nicht kennt. ${NACHFUEHREN}`,
        );
      }
      return gebaut;
    };
    const basisname = einsetzen(basisVorlage);
    const grundname = einsetzen(endVorlage);
    const zweiter = suffixname(printfVorlage, basisname, 2);

    // Ohne diese Kontrolle prüfte V1 im schlimmsten Fall zweimal denselben Namen.
    expect(grundname, "der Grundname trägt keinen Stempel").toContain(STAMP);
    expect(zweiter, "Grund- und Suffixname sind gleich — der Vergleich wäre trivial").not.toBe(
      grundname,
    );

    const ort = await frischesVerzeichnis();
    await lege(ort, grundname);
    await lege(ort, zweiter);

    const eintraege = await liste();
    expect(eintraege).toHaveLength(2);
    expect(
      eintraege.map((e) => e.zeitpunktUtc),
      `ein vom Skript erzeugter Name trägt keinen Zeitpunkt: ${JSON.stringify(eintraege)}`,
    ).toEqual([zeit.toISOString(), zeit.toISOString()]);
    // Jüngste zuerst: der Suffixname ist der SPÄTERE Lauf derselben Sekunde.
    expect(
      eintraege.map((e) => e.datei),
      "die spätere Sicherung derselben Sekunde steht nicht oben",
    ).toEqual([zweiter, grundname]);
    expect(eintraege.map((e) => e.folgeNummer)).toEqual([2, 1]);
  });

  it("V1b · fehlt das Muster im Skript, schlägt dieser Vertrag fehl statt still durchzulaufen", () => {
    // Die Gegenprobe zur Mustersuche selbst: an einer Quelle ohne die Regel MUSS es krachen.
    expect(() =>
      ausSkript("kein Skript", /BASISNAME="([^"]+)"/, "die Vorlage für BASISNAME"),
    ).toThrowError(/Namensregel .* hat sich geändert/);
    expect(() => suffixname("%s-%d.dump", "klarwerk-x", 2)).toThrowError(
      /Namensregel .* hat sich geändert/,
    );
  });
});
