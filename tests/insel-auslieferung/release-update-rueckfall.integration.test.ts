// ================================================================================================
// JOB B4-INSEL-RELEASE — ECHTES INSEL-ZIP EINSPIELEN, AKTUALISIEREN UND NACH STARTFEHLER ZURÜCK.
// ================================================================================================
//
// DIE LÜCKE, GEGEN DIE DIESE DATEI STEHT. Die Teile gab es: Sicherung, Schema-Vertrag, Umschalten
// und Rückfall (JOB 4012, `tests/insel-update/` — gegen NACHGESTELLTE Releases aus `insel-probe.ts`),
// und den echten unverpackten Start (JOB 4315/4332, `tests/insel-echter-start/`). Nie gefahren war
// die STRECKE, die ein Betreiber geht: ein ausgeliefertes ZIP, ausgepackt auf einem Rechner ohne
// Repo, angemeldet im Browser, mit gespeicherten Inhalten — dann das nächste ZIP über
// `…/current/scripts/insel/update-einspielen.sh`, und ein ZIP, das beim Start scheitert.
//
// Genau diese Strecke hat einen Fehler gezeigt, den keine der Proben sehen konnte: über `current`
// gerufen, tat `schema-vertrag.mjs` NICHTS (Exit 0) — Vertragsprüfung, Stand und Versionsbeleg
// fielen still aus, und der Rückfall nach dem Startfehler endete mit Exit 9. Behoben in
// `scripts/insel/schema-vertrag.mjs`; die kleine Probe dazu steht in
// `tests/insel-update/aufruf-ueber-current.test.ts`.
//
// ------------------------------------------------------------------------------------------------
// DER ABLAUF (je Startweg einmal: `eigenstart` = ohne launchd-Agent, `launchd` = echter Agent)
// ------------------------------------------------------------------------------------------------
//   K1  Vier Pakete aus dem offiziellen Bauer, jedes in einem Klon seines eigenen Standes:
//       Vorgänger 1.0.0-beta.1.580 (fdeb3c04), Korrekturausgabe (dieser Stand), und zwei
//       Varianten davon — `startfehler` (die benannte Journal-Ausnahme fehlt im Startbefehl, der
//       Start bricht im Startvertrag ab, BEVOR ein Speicher geöffnet wird) und `nichtumkehrbar`
//       (eine zusätzlich als IRREVERSIBEL markierte Stufe). Übertragen, unabhängig gehasht,
//       entpackt; Abhängigkeiten nur aus dem Paket.
//   K2  Vorgänger über sein `install.command`; Browser: Ersteinrichtung, DOCX-Import, Speichern,
//       Einreichen, Wiederlesen (Inhalt, Quellenvermerk, heruntergeladene Originaldatei).
//   K3  Update auf die Korrekturausgabe; Sicherung vor dem Wechsel mit Laufkennung und Prüfsumme;
//       alter Prozess weg, neuer Prozess aus dem neuen Release; neue Anmeldung; Bestand gleich.
//   K4  Update auf `startfehler`: Health rot, Rückfall, Vorversion wieder da; die Sicherung dieses
//       Laufs, die Ergebniszeile, der Port und die Version gehören zum selben Vorgang; frischer
//       Browser liest den Bestand vollständig.
//   K5  Ohne `unzip`, beschädigtes ZIP, nicht umkehrbar, Wiederholung: Abbruch nach Vertrag,
//       nichts angefasst, Sicherungen und Bestand erhalten.
//   K7  Gegenproben in einer EIGENEN Zielumgebung: fehlende Originaldatei und ein ausgebliebener
//       realer Rückfall werden erkannt; die dokumentierte Rücknahme macht beide wieder grün.
//
// WAS HIER NICHT BEHAUPTET WIRD: PostgreSQL. Dieser Weg benutzt den vorhandenen Insel-
// Journalmodus (`start.command` ohne `DATABASE_URL`), und K2 weist nach, dass seine laute Warnung
// („… NICHT prod-tauglich …") im Serverprotokoll steht. Eine Sicherung/Wiederherstellung von
// PostgreSQL ist nicht Gegenstand und gilt hier nicht als erledigt. Auch kein Mac Studio und keine
// Kundeninstallation: gefahren wird in einer Wegwerf-Zielumgebung auf dem Prüfrechner.
//
// PFLICHTLAUF OHNE SKIP: Fehlt ein Werkzeug (`git`, `zip`, `unzip`, `lsof`, Chromium, auf dem
// Startweg `launchd` auch `launchctl`/macOS), wird der betroffene Fall ROT — nie übersprungen.
//
// Aufruf: `npx vitest run --config vitest.integration.config.ts tests/insel-auslieferung/`.
// Belege je Lauf: `.local/run/insel-auslieferung/<zeitstempel>/` (Beleg-JSON und Serverprotokolle).
// `KLARWERK_INSEL_ZIEL_BEHALTEN=1` lässt Zielumgebungen und Bauplatz zum Nachsehen liegen.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { arch, release } from "node:os";
import { basename, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  type Bestandsbefund,
  type Bestandserwartung,
  DOKUMENTSATZ,
  ERSTER_SATZ,
  KENNWORT,
  bestandsmaengel,
  bestandsvergleich,
} from "./bestand";
import {
  type Profil,
  bestandserwartung,
  hatSitzung,
  importiereUndReicheEin,
  liesBestand,
  meldeAn,
  neuesProfil,
  richteEinAnDerMaske,
} from "./browserweg";
import {
  type Aenderung,
  Bauplatz,
  type Betreiberlauf,
  type Paket,
  Pruefplatz,
  type Serverbild,
  type Stand,
  type Startweg,
  VORGAENGER,
  WURZEL,
  aktuellerStand,
  arbeitsbaumSha,
  fahreBefehl,
  freierPort,
  fremdverweise,
  gitZeile,
  lebt,
  offeneDateien,
  pfadOhneUnzip,
  sha256Datei,
} from "./pruefplatz";

const BEHALTEN = process.env.KLARWERK_INSEL_ZIEL_BEHALTEN === "1";
const BELEGORDNER = join(
  WURZEL,
  ".local",
  "run",
  "insel-auslieferung",
  new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z"),
);

/** Die laute Warnung des Speicherwächters (`services/app/src/storage-guard.ts`) — wörtlich. */
const JOURNAL_WARNUNG =
  "KLARWERK WARN: NODE_ENV=production, KLARWERK_ALLOW_INMEMORY_PROD=1, kein DATABASE_URL → Journal-Speicher";

/**
 * VARIANTE `startfehler`: die benannte Journal-Ausnahme fehlt im Startbefehl — genau der Stand vor
 * JOB 4332. Der Startvertrag (`server.ts`, erste Anweisung von `start()`) verlangt dann
 * `DATABASE_URL` und bricht ab, BEVOR ein Speicher geöffnet oder ein Journal gelesen wird.
 */
const STARTFEHLER: Aenderung = {
  datei: "scripts/insel/release-texte.mjs",
  vorher: "  export KLARWERK_ALLOW_INMEMORY_PROD=1\n",
  nachher: "  # Variante Startfehler: die benannte Journal-Ausnahme fehlt (Stand vor JOB 4332)\n",
};

/** VARIANTE `nichtumkehrbar`: eine zusätzliche, als IRREVERSIBEL markierte Stufe im Migrationsbeleg. */
const NICHT_UMKEHRBAR_STUFE = "INSELPROBE_B4_NICHT_UMKEHRBAR";
const NICHT_UMKEHRBAR: Aenderung = {
  datei: "services/app/src/migrationsbeleg.ts",
  vorher:
    '    grund: "hasht Tokens in-place und loescht abgelaufene Zeilen; ein Hash ist nicht umkehrbar",\n  },\n];',
  nachher: `    grund: "hasht Tokens in-place und loescht abgelaufene Zeilen; ein Hash ist nicht umkehrbar",
  },
  {
    stufe: "${NICHT_UMKEHRBAR_STUFE}",
    ort: "tests/insel-auslieferung",
    risiko: "IRREVERSIBEL",
    grund: "Paketvariante der Auslieferungsprobe: als nicht umkehrbar markiert",
  },
];`,
};

type Rolle = "vorgaenger" | "korrektur" | "startfehler" | "nichtumkehrbar";

let bauplatz: Bauplatz | undefined;
let stand: Stand | undefined;
let baufehler: unknown;
const pakete: Partial<Record<Rolle, Paket>> = {};
const bauzeiten: Record<string, number> = {};
/** Das Journal der Hauptstrecke `eigenstart` nach K4 — Grundlage der Gegenprobe G1. */
let journalNachK4 = "";
/** Die Kennung des in K2 eingereichten Eintrags derselben Strecke. */
let eintragNachK4 = "";
/** Der in K2 derselben Strecke festgestellte vollständige Bestand — Referenz der Gegenprobe G1. */
let referenzNachK4: Bestandsbefund | undefined;
/** Was das Bestandsurteil erwartet (Quellenzeile, Abdruck der Prüfdatei). */
let erwartung: Bestandserwartung | undefined;
/** Die Baum-SHA des geprüften Arbeitsbaums (`arbeitsbaumSha`). */
let baum = "";

function erwartet(): Bestandserwartung {
  return brauche(erwartung, "die Bestandserwartung");
}

function paket(rolle: Rolle): Paket {
  if (baufehler !== undefined) {
    throw new Error(`Der Paketbau ist gescheitert — ohne Pakete ist nichts messbar:\n${baufehler}`);
  }
  const p = pakete[rolle];
  if (p === undefined) {
    throw new Error(`Paket ${rolle} wurde nicht gebaut.`);
  }
  return p;
}

function brauche<T>(wert: T | undefined, was: string): T {
  if (wert === undefined) {
    throw new Error(`${was} fehlt — ein früherer Schritt ist nicht bis hierher gekommen.`);
  }
  return wert;
}

function ausgabe(lauf: Betreiberlauf): string {
  return `${lauf.befehl}\n--- stdout ---\n${lauf.stdout.slice(-6000)}\n--- stderr ---\n${lauf.stderr.slice(-4000)}`;
}

function zaehle(text: string, teil: string): number {
  return text.split(teil).length - 1;
}

function schreibeBeleg(name: string, inhalt: unknown): void {
  mkdirSync(BELEGORDNER, { recursive: true });
  writeFileSync(join(BELEGORDNER, `${name}.json`), `${JSON.stringify(inhalt, null, 2)}\n`);
}

function kurzbild(bild: Serverbild): Record<string, unknown> {
  return {
    zeit: bild.zeit,
    health: bild.health,
    lauscher: bild.lauscher,
    current: bild.current,
    aktiv: bild.aktiv,
    vorversion: bild.vorversion,
    prozesse: bild.prozesse.map((p) => ({ pid: p.pid, cwd: p.cwd })),
  };
}

interface Rueckfallerwartung {
  readonly code: number;
  readonly ergebnis: string;
  readonly release: string;
  readonly appVersion: string;
  readonly ordner: string;
  readonly altePids: readonly number[];
  readonly variante: string;
}

/**
 * DAS URTEIL ÜBER EINEN RÜCKFALL — EINE Stelle für K4 und die Gegenprobe G2. Kein Erfolg allein
 * aus Exitcode oder Symlink: verlangt wird zusätzlich ein Prozess, der WIRKLICH auf dem Port
 * lauscht, aus dem Ordner der Vorversion läuft und deren Version im Health meldet — und dass weder
 * ein alter Prozess noch einer der Variante übrig ist.
 */
function rueckfallmaengel(
  lauf: { code: number | null; ergebnis: string },
  bild: Serverbild,
  e: Rueckfallerwartung,
): string[] {
  const m: string[] = [];
  if (lauf.code !== e.code) {
    m.push(`Exit ${lauf.code} statt ${e.code}`);
  }
  if (lauf.ergebnis !== e.ergebnis) {
    m.push(`Ergebniszeile «${lauf.ergebnis}» statt «${e.ergebnis}»`);
  }
  if (bild.current !== e.release) {
    m.push(`current zeigt auf ${bild.current ?? "nichts"} statt auf ${e.release}`);
  }
  if (bild.health === null) {
    m.push("kein /health — auf dem Port antwortet niemand");
  } else if (bild.health.code !== 200 || bild.health.version !== e.appVersion) {
    m.push(
      `/health ${bild.health.code} mit Version «${bild.health.version}» statt ${e.appVersion}`,
    );
  }
  if (bild.lauscher.length === 0) {
    m.push("kein Prozess lauscht auf dem Port");
  }
  for (const l of bild.lauscher) {
    if (l.cwd !== e.ordner) {
      m.push(`der Lauscher ${l.pid} läuft aus ${l.cwd || "(unbekannt)"} statt aus ${e.ordner}`);
    }
  }
  for (const pid of e.altePids) {
    if (lebt(pid)) {
      m.push(`der Prozess ${pid} von vor dem Update lebt noch`);
    }
  }
  for (const p of bild.prozesse) {
    if (p.befehl.includes(e.variante) || p.cwd.includes(e.variante)) {
      m.push(`Prozess ${p.pid} der gescheiterten Variante läuft noch (${p.cwd})`);
    }
  }
  return m;
}

beforeAll(async () => {
  await i18n.changeLanguage("de");
  erwartung = await bestandserwartung();
  baum = arbeitsbaumSha();
  process.stderr.write(`[insel-auslieferung] Arbeitsbaum ${baum} · HEAD ${gitZeile("HEAD")}\n`);
  const platz = new Bauplatz();
  bauplatz = platz;
  try {
    stand = aktuellerStand();
    const alt = platz.klone("vorgaenger", VORGAENGER.commit);
    bauzeiten.webVorgaenger = await platz.webBauen(alt);
    pakete.vorgaenger = await platz.paketBauen(alt, "vorgaenger");
    const neu = platz.klone("korrektur", stand.stand);
    bauzeiten.webKorrektur = await platz.webBauen(neu);
    pakete.korrektur = await platz.paketBauen(neu, "korrektur");
    platz.veraendere(neu, {
      ausgehendVon: stand.stand,
      aenderungen: [STARTFEHLER],
      versionszusatz: "-startfehler",
      nachricht: "Inselprobe: Paketvariante mit Startfehler",
    });
    pakete.startfehler = await platz.paketBauen(neu, "startfehler");
    platz.veraendere(neu, {
      ausgehendVon: stand.stand,
      aenderungen: [NICHT_UMKEHRBAR],
      versionszusatz: "-nichtumkehrbar",
      nachricht: "Inselprobe: Paketvariante mit nicht umkehrbarer Stufe",
    });
    pakete.nichtumkehrbar = await platz.paketBauen(neu, "nichtumkehrbar");
  } catch (fehler) {
    baufehler = fehler instanceof Error ? fehler.message : String(fehler);
  }
  schreibeBeleg("bau", {
    plattform: `${process.platform} ${release()} ${arch()}`,
    node: process.version,
    stand,
    // Zuordnung zur Revision: gleich `git rev-parse <commit>^{tree}` des festgehaltenen Commits.
    arbeitsbaum: baum,
    standZeile: stand === undefined ? null : gitZeile(stand.head),
    vorgaenger: { ...VORGAENGER, zeile: gitZeile(VORGAENGER.commit) },
    pakete,
    bauzeiten,
    baufehler: baufehler ?? null,
  });
}, 3_600_000);

afterAll(() => {
  if (!BEHALTEN) {
    bauplatz?.raeumeAuf();
  }
});

describe("K1 · vier echte ZIP-Erzeugnisse aus dem offiziellen Releasebauer", () => {
  it("K1a · jedes Paket ist verpackt, aus seinem eigenen Stand gebaut und in sich unversehrt", () => {
    const vorg = paket("vorgaenger");
    const korr = paket("korrektur");
    const start = paket("startfehler");
    const irr = paket("nichtumkehrbar");
    const aktuell = brauche(stand, "der Stand der Korrekturausgabe");
    const version = (
      JSON.parse(readFileSync(join(WURZEL, "package.json"), "utf8")) as {
        version: string;
      }
    ).version;

    expect(vorg.commit).toBe(VORGAENGER.commit);
    expect(vorg.appVersion).toBe(VORGAENGER.appVersion);
    expect(korr.commit).toBe(aktuell.stand);
    expect(korr.appVersion).toBe(version);
    expect(start.appVersion).toBe(`${version}-startfehler`);
    expect(irr.appVersion).toBe(`${version}-nichtumkehrbar`);
    const namen = new Set([vorg, korr, start, irr].map((p) => p.releaseName));
    expect(namen.size, "zwei Pakete tragen denselben Releasenamen").toBe(4);

    for (const p of [vorg, korr, start, irr]) {
      expect(basename(p.zip)).toBe(`${p.releaseName}.zip`);
      expect(sha256Datei(p.zip), `${p.rolle}: Abdruck am Bauplatz`).toBe(p.sha256);
      const probe = fahreBefehl("unzip", ["-tq", p.zip], { cwd: WURZEL });
      expect(probe.code, `${p.rolle}: unzip -t\n${probe.stdout}${probe.stderr}`).toBe(0);
      const liste = fahreBefehl("unzip", ["-Z1", p.zip], { cwd: WURZEL }).stdout.split("\n");
      for (const pflicht of [
        "start.command",
        "install.command",
        "SCHEMA-VERTRAG",
        "BUILD_INFO",
        "scripts/insel/update-einspielen.sh",
        "scripts/insel/rueckfall.sh",
        "scripts/insel/schema-vertrag.mjs",
        "apps/web/dist/index.html",
        "services/app/src/server.ts",
        "node_modules/tsx/dist/cli.mjs",
        "node_modules/fastify/package.json",
      ]) {
        expect(liste, `${p.rolle}: ${pflicht} fehlt im Zip`).toContain(
          `${p.releaseName}/${pflicht}`,
        );
      }
      expect(
        liste.filter(
          (z) => z.includes("/node_modules/vitest/") || z.includes("/node_modules/vite/"),
        ),
        `${p.rolle}: Entwicklungswerkzeuge im Paket`,
      ).toEqual([]);
    }
    const vertragIrr = fahreBefehl("unzip", ["-p", irr.zip, `${irr.releaseName}/SCHEMA-VERTRAG`], {
      cwd: WURZEL,
    }).stdout;
    expect(vertragIrr).toContain(`${NICHT_UMKEHRBAR_STUFE}:IRREVERSIBEL`);
    const startVariante = fahreBefehl(
      "unzip",
      ["-p", start.zip, `${start.releaseName}/start.command`],
      { cwd: WURZEL },
    ).stdout;
    expect(startVariante).not.toContain("export KLARWERK_ALLOW_INMEMORY_PROD=1");
    const startKorrektur = fahreBefehl(
      "unzip",
      ["-p", korr.zip, `${korr.releaseName}/start.command`],
      { cwd: WURZEL },
    ).stdout;
    expect(startKorrektur).toContain("export KLARWERK_ALLOW_INMEMORY_PROD=1");
    // DER TATSÄCHLICHE ÜBERGANG VORGÄNGER → KORREKTURAUSGABE (Grundlage der Aussage in
    // `scripts/insel/README.md` zur Grenze beim Update aus alter Fassung). Die Korrekturausgabe darf
    // Stufen HINZUFÜGEN, aber nur additive: jede Stufe des Vorgängers steht unverändert (Name UND
    // Risikoklasse, in derselben Reihenfolge) auch im neuen Vertrag — sonst wäre es ein Downgrade —,
    // und keine hinzugekommene Stufe ist TRANSFORMIEREND oder IRREVERSIBEL.
    const vertrag = (q: Paket) =>
      fahreBefehl("unzip", ["-p", q.zip, `${q.releaseName}/SCHEMA-VERTRAG`], { cwd: WURZEL })
        .stdout;
    const stufen = (q: Paket) =>
      (/^stufen=(.*)$/m.exec(vertrag(q))?.[1] ?? "").split(" ").filter((s) => s !== "");
    const alt = stufen(vorg);
    const neu = stufen(korr);
    expect(alt.length).toBeGreaterThan(0);
    const altNamen = new Set(alt.map((s) => s.split(":")[0]));
    const hinzu = neu.filter((s) => !altNamen.has(s.split(":")[0]));
    // Die Gleichheit bleibt — gemessen an dem Teil, den beide kennen.
    expect(
      neu.filter((s) => !hinzu.includes(s)),
      "eine Stufe des Vorgängers fehlt oder hat ihre Risikoklasse geändert (Downgrade)",
    ).toEqual(alt);
    expect(
      hinzu.filter((s) => !s.endsWith(":ADDITIV")),
      "die Korrekturausgabe bringt eine nicht additive Stufe mit",
    ).toEqual([]);
    // Und der BESTEHENDE Vertragsprüfer sagt dasselbe: Stand des Vorgängers gegen den neuen Vertrag
    // ergibt „verträglich" (Exit 0) und nennt jede hinzugekommene Stufe beim Namen.
    const ablage = brauche(bauplatz, "der Bauplatz").ordner;
    const standPfad = join(ablage, "stand-vorgaenger");
    const vertragPfad = join(ablage, "vertrag-korrektur");
    writeFileSync(standPfad, `${vertrag(vorg).trimEnd()}\nbestaetigt=ja\n`);
    writeFileSync(vertragPfad, vertrag(korr));
    const pruefung = fahreBefehl(
      "node",
      [join(WURZEL, "scripts/insel/schema-vertrag.mjs"), "pruefen", standPfad, vertragPfad],
      { cwd: WURZEL },
    );
    const urteil = `${pruefung.stdout}${pruefung.stderr}`;
    expect(pruefung.code, urteil).toBe(0);
    for (const stufe of hinzu) {
      expect(urteil, `die neue Stufe ${stufe} wird nicht benannt`).toContain(stufe.split(":")[0]);
    }
  });
});

function strecke(startweg: Startweg): void {
  describe(`Startweg ${startweg} · Einspielen, Update und Rückfall am echten Paket`, () => {
    let platz: Pruefplatz | undefined;
    let basis = "";
    let koId = "";
    let ersterBefund: Bestandsbefund | undefined;
    const uebertragen: Partial<Record<Rolle, { pfad: string; sha256: string }>> = {};
    const beleg: Record<string, unknown> = { startweg };
    const offen: Profil[] = [];

    const p = () => brauche(platz, "die Zielumgebung");
    const zip = (rolle: Rolle) =>
      brauche(uebertragen[rolle], `das übertragene Paket ${rolle}`).pfad;

    async function profil(name: string): Promise<Profil> {
      const neu = await neuesProfil(join(p().wurzel, "browser", name));
      offen.push(neu);
      return neu;
    }

    beforeAll(async () => {
      const port = await freierPort();
      platz = new Pruefplatz(startweg, port, startweg);
      basis = `http://127.0.0.1:${port}`;
      beleg.zielumgebung = platz.wurzel;
      beleg.port = port;
      beleg.label = platz.label;
      if (startweg === "launchd") {
        platz.ladeAgent();
        beleg.plist = readFileSync(platz.plist, "utf8");
      }
    }, 120_000);

    afterAll(async () => {
      for (const o of offen) {
        await o.kontext.close().catch(() => undefined);
      }
      if (platz !== undefined) {
        beleg.serverprotokollZeichen = platz.log().length;
        mkdirSync(BELEGORDNER, { recursive: true });
        if (existsSync(platz.logDatei)) {
          copyFileSync(platz.logDatei, join(BELEGORDNER, `server-${startweg}.log`));
        }
        schreibeBeleg(`strecke-${startweg}`, beleg);
        await platz.raeumeAuf(BEHALTEN);
      }
    }, 180_000);

    it("K1 · übertragen, in der Zielumgebung unabhängig gehasht und entpackt — Abhängigkeiten nur aus dem Paket", () => {
      for (const rolle of ["vorgaenger", "korrektur", "startfehler", "nichtumkehrbar"] as const) {
        const q = paket(rolle);
        const ueb = p().uebertrage(q);
        expect(ueb.sha256, `${rolle}: Abdruck nach der Übertragung`).toBe(q.sha256);
        uebertragen[rolle] = ueb;
      }
      const vorg = paket("vorgaenger");
      const release = p().entpacke(zip("vorgaenger"), vorg.releaseName);
      expect(existsSync(join(release, "install.command"))).toBe(true);
      expect(readFileSync(join(release, "BUILD_INFO"), "utf8")).toContain(
        `commit=${VORGAENGER.commit}`,
      );
      expect(existsSync(join(release, "node_modules", "tsx", "dist", "cli.mjs"))).toBe(true);
      expect(fremdverweise(release), "Symlinks, die aus dem Paket herauszeigen").toEqual([]);
      beleg.k1 = { uebertragen, entpackt: release };
    });

    it("K2 · die Vorgängerversion startet über ihr install.command; im Browser: Ersteinrichtung, DOCX-Import, Speichern, Wiederlesen", async () => {
      const vorg = paket("vorgaenger");
      expect((await p().beobachte()).lauscher, "der Port ist schon vor dem Start belegt").toEqual(
        [],
      );
      const install = join(
        p().eingang,
        `entpackt-${vorg.releaseName}`,
        vorg.releaseName,
        "install.command",
      );
      const lauf = await p().fahre(install, []);
      expect(lauf.code, ausgabe(lauf)).toBe(0);
      expect(lauf.ergebnis).toBe(
        `Update auf ${vorg.appVersion} aktiv, Sicherung (keine — Erstinstallation, es gibt noch keine Daten)`,
      );
      if (startweg === "launchd") {
        expect(lauf.stdout, "der Start lief nicht über launchd").toContain(
          `kickstart gui/${p().uid}/${p().label}`,
        );
      } else {
        expect(lauf.stdout).not.toContain("launchd fuehrt");
      }
      const bild = await p().beobachte();
      expect(bild.health).toEqual({ code: 200, version: vorg.appVersion });
      expect(bild.current).toBe(vorg.releaseName);
      expect(bild.lauscher.length, "niemand lauscht auf dem Port").toBeGreaterThan(0);
      const verboten = [WURZEL, brauche(bauplatz, "der Bauplatz").ordner];
      for (const l of bild.lauscher) {
        expect(l.cwd).toBe(p().releaseOrdner(vorg.releaseName));
        const fremd = offeneDateien(l.pid).filter((d) => verboten.some((v) => d.startsWith(v)));
        expect(fremd, "der Serverprozess hat Dateien aus Entwicklerbaum/Bauplatz offen").toEqual(
          [],
        );
      }
      // Die Journal-/Inselwarnung bleibt sichtbar, und nichts verspricht PostgreSQL.
      const log = p().log();
      expect(log).toContain(JOURNAL_WARNUNG);
      expect(log).toContain("[start] Datenhaltung: Journal");
      expect(log).not.toContain("Datenhaltung: Postgres");

      const k2 = await profil("k2-betreiber");
      expect(await hatSitzung(k2)).toBe(false);
      await richteEinAnDerMaske(k2, basis);
      expect(await hatSitzung(k2), "die Ersteinrichtung hat keine Sitzung ergeben").toBe(true);
      const imp = await importiereUndReicheEin(k2, basis);
      koId = imp.koId;
      const befund = await liesBestand(k2, basis, koId, join(p().wurzel, "downloads", "k2"));
      // VOLLSTÄNDIG (Titel, jeder Absatz, Quelle, Datei) — und DIESER Befund ist ab hier die
      // Referenz: K3, K4 und K5 vergleichen den ganzen Rumpftext mit ihm.
      expect(bestandsmaengel(befund, erwartet())).toEqual([]);
      expect(befund.inselmarke).toContain(vorg.releaseName);
      ersterBefund = befund;
      await k2.kontext.close();

      const journal = readFileSync(p().journal, "utf8");
      expect(journal, "der Dokumentinhalt steht nicht im Journal").toContain(KENNWORT);
      expect(journal, "die Originaldatei steht nicht im Journal").toContain('"repo":"objects"');
      beleg.k2 = {
        befehl: lauf.befehl,
        ergebnis: lauf.ergebnis,
        bild: kurzbild(bild),
        import: imp,
        befund,
        chromium: k2.version,
        journalSha256: sha256Datei(p().journal),
      };
    }, 600_000);

    it("K3 · Update über current/scripts/insel/update-einspielen.sh: Sicherung vorher, alter Prozess weg, neuer da, neue Anmeldung, Bestand gleich", async () => {
      const vorg = paket("vorgaenger");
      const korr = paket("korrektur");
      const erster = brauche(ersterBefund, "der Bestand aus K2");
      const vorher = await p().beobachte();
      const altePids = vorher.prozesse.map((x) => x.pid);
      expect(altePids.length).toBeGreaterThan(0);
      const journalVorher = sha256Datei(p().journal);
      const warnungenVorher = zaehle(p().log(), JOURNAL_WARNUNG);

      const lauf = await p().fahre(p().updateSkript, [zip("korrektur")]);
      expect(lauf.code, ausgabe(lauf)).toBe(0);
      const treffer = /^Update auf (\S+) aktiv, Sicherung (\S+)$/.exec(lauf.ergebnis);
      expect(treffer, `Ergebniszeile «${lauf.ergebnis}»`).not.toBeNull();
      expect(treffer?.[1]).toBe(korr.appVersion);
      const sicherung = treffer?.[2] ?? "";
      // Laufkennung (eigenes Verzeichnis je Lauf) und Prüfsumme — und es IST der Stand von vorher.
      const laufkennung = basename(join(sicherung, ".."));
      expect(sicherung).toBe(join(p().shared, "backups", laufkennung, "state.jsonl"));
      expect(laufkennung).toMatch(/^\d{8}T\d{6}Z-[A-Za-z0-9]{6}$/);
      expect(sha256Datei(sicherung)).toBe(journalVorher);
      expect(readFileSync(`${sicherung}.sha256`, "utf8")).toBe(`${journalVorher}  state.jsonl\n`);
      const gesichert = lauf.stdout.indexOf("[update] Sicherung (journal): ");
      const umgeschaltet = lauf.stdout.indexOf("[update] current -> ");
      expect(gesichert, "keine Sicherungszeile").toBeGreaterThanOrEqual(0);
      expect(gesichert, "die Sicherung lag nicht VOR dem Wechsel").toBeLessThan(umgeschaltet);

      const nachher = await p().beobachte();
      expect(nachher.health).toEqual({ code: 200, version: korr.appVersion });
      expect(nachher.current).toBe(korr.releaseName);
      expect(nachher.aktiv).toBe(korr.releaseName);
      expect(nachher.vorversion).toBe(vorg.releaseName);
      for (const pid of altePids) {
        expect(lebt(pid), `der alte Prozess ${pid} lebt noch`).toBe(false);
      }
      expect(nachher.lauscher.length).toBeGreaterThan(0);
      for (const l of nachher.lauscher) {
        expect(altePids).not.toContain(l.pid);
        expect(l.cwd).toBe(p().releaseOrdner(korr.releaseName));
      }
      expect(zaehle(p().log(), JOURNAL_WARNUNG), "der neue Start verschweigt die Warnung").toBe(
        warnungenVorher + 1,
      );

      const k3 = await profil("k3-neue-anmeldung");
      expect(await hatSitzung(k3)).toBe(false);
      await meldeAn(k3, basis);
      expect(await hatSitzung(k3)).toBe(true);
      const befund = await liesBestand(k3, basis, koId, join(p().wurzel, "downloads", "k3"));
      expect(bestandsmaengel(befund, erwartet())).toEqual([]);
      expect(bestandsvergleich(erster, befund), "Bestand nach dem Update ≠ Bestand aus K2").toEqual(
        [],
      );
      expect(befund.inselmarke).toContain(korr.releaseName);
      await k3.kontext.close();
      beleg.k3 = {
        befehl: lauf.befehl,
        ergebnis: lauf.ergebnis,
        stdout: lauf.stdout,
        sicherung: { pfad: sicherung, laufkennung, sha256: journalVorher },
        vorher: kurzbild(vorher),
        nachher: kurzbild(nachher),
        befund,
      };
    }, 600_000);

    it("K4 · die Startfehler-Variante scheitert vor jeder Datenänderung; der Rückfall stellt die Korrekturausgabe her; ein frischer Browser liest den Bestand", async () => {
      const korr = paket("korrektur");
      const variante = paket("startfehler");
      const vorher = await p().beobachte();
      const altePids = vorher.prozesse.map((x) => x.pid);
      const journalVorher = sha256Datei(p().journal);
      const sicherungenVorher = p().sicherungen();
      const logVorher = p().log().length;

      const lauf = await p().fahre(p().updateSkript, [zip("startfehler")]);
      const ergebnis = `Update abgebrochen, Vorversion ${korr.appVersion} läuft wieder, Grund: health`;
      const nachher = await p().beobachte();
      const maengel = rueckfallmaengel(lauf, nachher, {
        code: 7,
        ergebnis,
        release: korr.releaseName,
        appVersion: korr.appVersion,
        ordner: p().releaseOrdner(korr.releaseName),
        altePids,
        variante: variante.releaseName,
      });
      expect(maengel, ausgabe(lauf)).toEqual([]);
      expect(nachher.aktiv).toBe(korr.releaseName);

      // Die Variante ist WIRKLICH gestartet und im Startvertrag gescheitert.
      const neuesLog = p().log().slice(logVorher);
      expect(neuesLog).toContain("Serverstart fehlgeschlagen: StartvertragError");
      expect(lauf.stdout).toContain(
        `[update] current -> ${p().releaseOrdner(variante.releaseName)}`,
      );
      // Der Rückfall nennt die Version, auf die er zurückgeht, und bestätigt sie.
      expect(lauf.stdout).toContain(
        `[rueckfall] Ziel: ${korr.releaseName} (App-Version ${korr.appVersion})`,
      );
      expect(lauf.stdout).toContain(`Vorversion ${korr.appVersion} aktiv`);

      // Die Sicherung DIESES Laufs: neu, mit Prüfsumme, und sie ist der unveränderte Bestand.
      const sicherung = /\[update\] Sicherung \(journal\): (\S+)/.exec(lauf.stdout)?.[1] ?? "";
      const laufkennung = basename(join(sicherung, ".."));
      expect(Object.keys(sicherungenVorher)).not.toContain(`${laufkennung}/state.jsonl`);
      expect(sha256Datei(sicherung)).toBe(journalVorher);
      expect(readFileSync(`${sicherung}.sha256`, "utf8")).toBe(`${journalVorher}  state.jsonl\n`);
      expect(
        sha256Datei(p().journal),
        "die gescheiterte Variante oder der Rückfall hat den Bestand verändert",
      ).toBe(journalVorher);
      for (const [datei, abdruck] of Object.entries(sicherungenVorher)) {
        expect(p().sicherungen()[datei], `Sicherung ${datei}`).toBe(abdruck);
      }

      const k4 = await profil("k4-frischer-browser");
      await meldeAn(k4, basis);
      const befund = await liesBestand(k4, basis, koId, join(p().wurzel, "downloads", "k4"));
      expect(bestandsmaengel(befund, erwartet())).toEqual([]);
      expect(
        bestandsvergleich(brauche(ersterBefund, "der Bestand aus K2"), befund),
        "Bestand nach dem Rückfall ≠ Bestand aus K2",
      ).toEqual([]);
      expect(befund.inselmarke).toContain(korr.releaseName);
      await k4.kontext.close();

      if (startweg === "eigenstart") {
        journalNachK4 = join(brauche(bauplatz, "der Bauplatz").ordner, "journal-nach-k4.jsonl");
        copyFileSync(p().journal, journalNachK4);
        eintragNachK4 = koId;
        referenzNachK4 = ersterBefund;
      }
      beleg.k4 = {
        befehl: lauf.befehl,
        exit: lauf.code,
        ergebnis: lauf.ergebnis,
        stdout: lauf.stdout,
        sicherung: { pfad: sicherung, laufkennung, sha256: journalVorher },
        vorher: kurzbild(vorher),
        nachher: kurzbild(nachher),
        variantenprotokoll: neuesLog
          .split("\n")
          .filter((z) => z.startsWith("[start]") || z.startsWith("Serverstart")),
        befund,
      };
    }, 900_000);

    it("K5 · ohne unzip, beschädigtes ZIP, nicht umkehrbar, Wiederholung: sicherer Abbruch nach Vertrag, nichts angefasst", async () => {
      const korr = paket("korrektur");
      const stillstand = async () => {
        const bild = await p().beobachte();
        return {
          health: bild.health,
          lauscher: bild.lauscher.map((l) => l.pid).sort(),
          current: bild.current,
          aktiv: bild.aktiv,
          vorversion: bild.vorversion,
          journal: sha256Datei(p().journal),
          releases: p().releases(),
        };
      };
      const vorher = await stillstand();
      const sicherungenVorher = p().sicherungen();
      const unveraendert = async (was: string) => {
        expect(await stillstand(), `${was}: die Insel wurde angefasst`).toEqual(vorher);
        const jetzt = p().sicherungen();
        for (const [datei, abdruck] of Object.entries(sicherungenVorher)) {
          expect(jetzt[datei], `${was}: Sicherung ${datei}`).toBe(abdruck);
        }
      };
      const weiter = (grund: string) =>
        `Update abgebrochen, Vorversion ${korr.appVersion} läuft weiter, Grund: ${grund}`;

      const pfad = pfadOhneUnzip(join(p().wurzel, "pfad-ohne-unzip"));
      const a = await p().fahre(p().updateSkript, [zip("nichtumkehrbar")], pfad);
      expect(a.code, ausgabe(a)).toBe(1);
      expect(a.stderr).toContain("unzip nicht gefunden");
      await unveraendert("ohne unzip");

      const kaputt = join(p().eingang, `beschaedigt-${basename(zip("nichtumkehrbar"))}`);
      const roh = readFileSync(zip("nichtumkehrbar"));
      writeFileSync(kaputt, roh.subarray(0, Math.floor(roh.byteLength / 2)));
      const b = await p().fahre(p().updateSkript, [kaputt]);
      expect(b.code, ausgabe(b)).toBe(1);
      expect(b.ergebnis).toBe(weiter("paket"));
      expect(b.stderr).toContain("liess sich nicht auspacken");
      await unveraendert("beschädigtes ZIP");

      const c = await p().fahre(p().updateSkript, [zip("nichtumkehrbar")]);
      expect(c.code, ausgabe(c)).toBe(4);
      expect(c.ergebnis).toBe(weiter("vertrag"));
      expect(`${c.stdout}${c.stderr}`).toContain(NICHT_UMKEHRBAR_STUFE);
      await unveraendert("nicht umkehrbare Aktualisierung");

      const d = await p().fahre(p().updateSkript, [zip("vorgaenger")]);
      expect(d.code, ausgabe(d)).toBe(6);
      expect(d.ergebnis).toBe(weiter("kollision"));
      await unveraendert("Wiederholung der Vorgängerversion");

      const k5 = await profil("k5-nach-den-abbruechen");
      await meldeAn(k5, basis);
      const befund = await liesBestand(k5, basis, koId, join(p().wurzel, "downloads", "k5"));
      expect(bestandsmaengel(befund, erwartet())).toEqual([]);
      expect(
        bestandsvergleich(brauche(ersterBefund, "der Bestand aus K2"), befund),
        "Bestand nach den Abbrüchen ≠ Bestand aus K2",
      ).toEqual([]);
      await k5.kontext.close();
      beleg.k5 = {
        ohneUnzip: { exit: a.code, stderr: a.stderr.trim() },
        beschaedigt: { exit: b.code, ergebnis: b.ergebnis },
        nichtUmkehrbar: { exit: c.code, ergebnis: c.ergebnis, ausgabe: `${c.stdout}${c.stderr}` },
        wiederholung: { exit: d.code, ergebnis: d.ergebnis },
        stillstand: vorher,
        sicherungen: p().sicherungen(),
      };
    }, 600_000);
  });
}

strecke("eigenstart");
strecke("launchd");

describe("K7 · Gegenproben in einer eigenen Zielumgebung, mit Rücknahme", () => {
  let g: Pruefplatz | undefined;
  let basis = "";
  const beleg: Record<string, unknown> = {};
  const offen: Profil[] = [];
  const platz = () => brauche(g, "die Zielumgebung der Gegenproben");

  async function profil(name: string): Promise<Profil> {
    const neu = await neuesProfil(join(platz().wurzel, "browser", name));
    offen.push(neu);
    return neu;
  }

  beforeAll(async () => {
    const port = await freierPort();
    g = new Pruefplatz("eigenstart", port, "gegenprobe");
    basis = `http://127.0.0.1:${port}`;
    beleg.zielumgebung = g.wurzel;
  }, 120_000);

  afterAll(async () => {
    for (const o of offen) {
      await o.kontext.close().catch(() => undefined);
    }
    if (g !== undefined) {
      schreibeBeleg("gegenproben", beleg);
      await g.raeumeAuf(BEHALTEN);
    }
  }, 180_000);

  it("G1 · fehlt die Originaldatei oder ein anderer Absatz im Bestand, schlägt die Bestandsprüfung an — mit vollem Journal wieder grün", async () => {
    const korr = paket("korrektur");
    const voll = brauche(journalNachK4 === "" ? undefined : journalNachK4, "das Journal aus K4");
    const referenz = brauche(referenzNachK4, "der Bestand aus K2 der Strecke eigenstart");
    const ueb = platz().uebertrage(korr);
    const release = platz().entpacke(ueb.pfad, korr.releaseName);
    const install = await platz().fahre(join(release, "install.command"), []);
    expect(install.code, ausgabe(install)).toBe(0);

    const zeilen = readFileSync(voll, "utf8").split("\n");
    const ohneDatei = zeilen.filter((z) => !z.includes('"repo":"objects"'));
    expect(
      zeilen.length - ohneDatei.length,
      "das Journal trägt keine Originaldatei",
    ).toBeGreaterThan(0);
    const manipuliert = join(platz().eingang, "ohne-originaldatei.jsonl");
    writeFileSync(manipuliert, ohneDatei.join("\n"));
    const vollKopie = join(platz().eingang, "voll.jsonl");
    copyFileSync(voll, vollKopie);

    const r1 = await platz().fahre(platz().rueckfallSkript, [
      korr.releaseName,
      "--daten-zurueck",
      manipuliert,
    ]);
    expect(r1.code, ausgabe(r1)).toBe(0);
    expect(r1.ergebnis).toBe(`Vorversion ${korr.appVersion} aktiv`);
    const eintrag = brauche(eintragNachK4 === "" ? undefined : eintragNachK4, "der Eintrag aus K2");

    const rot = await profil("g1-ohne-datei");
    await meldeAn(rot, basis);
    const befundRot = await liesBestand(
      rot,
      basis,
      eintrag,
      join(platz().wurzel, "downloads", "g1"),
    );
    const maengelRot = bestandsmaengel(befundRot, erwartet());
    expect(befundRot.text, "Gegenprobe greift zu weit: auch der Inhalt fehlt").toContain(
      DOKUMENTSATZ,
    );
    expect(
      maengelRot.some((m) => m.startsWith("Originaldatei:")),
      `die fehlende Datei blieb unerkannt: ${JSON.stringify(maengelRot)}`,
    ).toBe(true);
    // Der Grund ist die FEHLENDE Datei, nicht eine fehlende Anmeldung: der Server sagt 404.
    expect(befundRot.downloadFehler).toContain("→ HTTP 404");
    await rot.kontext.close();

    // RUNDE 2 (Bens Befund): ein ANDERER Absatz als `DOKUMENTSATZ` fehlt. Die Prüfung aus Runde 1
    // sah nur `DOKUMENTSATZ` und hätte diesen Bestand für vollständig gehalten.
    const vollText = readFileSync(voll, "utf8");
    expect(vollText.includes(ERSTER_SATZ), "der erste Absatz steht nicht im Journal").toBe(true);
    const ohneAbsatz = join(platz().eingang, "ohne-ersten-absatz.jsonl");
    writeFileSync(ohneAbsatz, vollText.split(ERSTER_SATZ).join(""));
    const rAbsatz = await platz().fahre(platz().rueckfallSkript, [
      korr.releaseName,
      "--daten-zurueck",
      ohneAbsatz,
    ]);
    expect(rAbsatz.code, ausgabe(rAbsatz)).toBe(0);
    const lueckig = await profil("g1-ohne-absatz");
    await meldeAn(lueckig, basis);
    const befundAbsatz = await liesBestand(
      lueckig,
      basis,
      eintrag,
      join(platz().wurzel, "downloads", "g1-absatz"),
    );
    await lueckig.kontext.close();
    expect(befundAbsatz.text, "Gegenprobe greift zu weit: der Dokumentsatz fehlt mit").toContain(
      DOKUMENTSATZ,
    );
    expect(befundAbsatz.text).not.toContain(ERSTER_SATZ);
    const maengelAbsatz = bestandsmaengel(befundAbsatz, erwartet());
    expect(maengelAbsatz, "der fehlende erste Absatz blieb unerkannt").toContain(
      `Inhalt: der Absatz «${ERSTER_SATZ}» fehlt im Rumpf`,
    );
    const unterschiedeAbsatz = bestandsvergleich(referenz, befundAbsatz);
    expect(
      unterschiedeAbsatz.some((u) => u.startsWith("Rumpftext:")),
      "der Vergleich mit K2 sah den fehlenden Absatz nicht",
    ).toBe(true);

    const r2 = await platz().fahre(platz().rueckfallSkript, [
      korr.releaseName,
      "--daten-zurueck",
      vollKopie,
    ]);
    expect(r2.code, ausgabe(r2)).toBe(0);
    const gruen = await profil("g1-ruecknahme");
    await meldeAn(gruen, basis);
    const befundGruen = await liesBestand(
      gruen,
      basis,
      eintrag,
      join(platz().wurzel, "downloads", "g1-ruecknahme"),
    );
    expect(bestandsmaengel(befundGruen, erwartet())).toEqual([]);
    expect(bestandsvergleich(referenz, befundGruen)).toEqual([]);
    await gruen.kontext.close();
    beleg.g1 = {
      entfernteZeilen: zeilen.length - ohneDatei.length,
      rot: { ergebnis: r1.ergebnis, maengel: maengelRot },
      ohneAbsatz: {
        ergebnis: rAbsatz.ergebnis,
        maengel: maengelAbsatz,
        unterschiede: unterschiedeAbsatz,
      },
      ruecknahme: { ergebnis: r2.ergebnis, maengel: [] },
    };
  }, 900_000);

  it("G2 · ein ausgebliebener realer Rückfall wird erkannt, auch wenn Exitcode, Ergebniszeile und Symlink stimmen — die Rücknahme über rueckfall.sh macht ihn wieder grün", async () => {
    const korr = paket("korrektur");
    const variante = paket("startfehler");
    const ueb = platz().uebertrage(variante);
    const vorher = await platz().beobachte();
    expect(vorher.health?.version, "G1 hat die Korrekturausgabe nicht laufend hinterlassen").toBe(
      korr.appVersion,
    );
    const lauf = await platz().fahre(platz().updateSkript, [ueb.pfad]);
    const erwartung: Rueckfallerwartung = {
      code: 7,
      ergebnis: `Update abgebrochen, Vorversion ${korr.appVersion} läuft wieder, Grund: health`,
      release: korr.releaseName,
      appVersion: korr.appVersion,
      ordner: platz().releaseOrdner(korr.releaseName),
      altePids: vorher.prozesse.map((x) => x.pid),
      variante: variante.releaseName,
    };
    const echt = await platz().beobachte();
    expect(rueckfallmaengel(lauf, echt, erwartung), ausgabe(lauf)).toEqual([]);

    // Der Rückfall bleibt AUS: derselbe Lauf, dieselbe Ergebniszeile, derselbe Symlink — nur läuft
    // nichts mehr. Das Urteil darf daran nicht vorbeisehen.
    const beendet = await platz().beendeAlles();
    const ohne = await platz().beobachte();
    expect(ohne.current).toBe(korr.releaseName);
    const maengelOhne = rueckfallmaengel(lauf, ohne, erwartung);
    expect(maengelOhne, "der ausgebliebene Rückfall blieb unerkannt").toContain(
      "kein /health — auf dem Port antwortet niemand",
    );
    expect(maengelOhne).toContain("kein Prozess lauscht auf dem Port");

    const r = await platz().fahre(platz().rueckfallSkript, []);
    expect(r.code, ausgabe(r)).toBe(0);
    expect(r.ergebnis).toBe(`Vorversion ${korr.appVersion} aktiv`);
    const wieder = await platz().beobachte();
    expect(
      rueckfallmaengel(lauf, wieder, {
        ...erwartung,
        altePids: [...erwartung.altePids, ...beendet],
      }),
    ).toEqual([]);
    beleg.g2 = {
      update: { exit: lauf.code, ergebnis: lauf.ergebnis },
      echt: kurzbild(echt),
      ohneProzess: { bild: kurzbild(ohne), maengel: maengelOhne },
      ruecknahme: { ergebnis: r.ergebnis, bild: kurzbild(wieder) },
    };
  }, 900_000);
});
