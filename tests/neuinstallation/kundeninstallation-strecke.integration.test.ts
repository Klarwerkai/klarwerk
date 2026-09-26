import { randomBytes } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as B from "./kundeninstallation/browserweg";
import { sha256, synthetischesPng } from "./kundeninstallation/datei";
import {
  type Instanz,
  compose,
  containerId,
  dienstmessung,
  dokumentierterBlock,
  installationsordner,
  projektbestand,
  schreibeEnv,
  warteAufGesund,
} from "./kundeninstallation/installation";
import {
  type Dienstmessung,
  type Inhaltsstand,
  bewerteInhalt,
  bewerteNeustart,
  resetZiele,
  roteNachweise,
  schwaerze,
} from "./kundeninstallation/nachweise";
import {
  type Platzbefund,
  type Tlsausstattung,
  dockerBereitstellen,
  fuehreAus,
  httpsGet,
  mussGelingen,
  platzbefund,
  tlsErzeugen,
  vertrauenFuerChromium,
  warte,
  werkzeugeBereitstellen,
} from "./kundeninstallation/pruefplatz";

// ==================================================================================================
// DIE KUNDENINSTALLATION, ECHT GEFAHREN: LEER → COMPOSE → HTTPS-BROWSER → NEUSTART → WIEDERFINDEN.
// ==================================================================================================
//
// DIE LUECKE, DIE DIESE DATEI SCHLIESST. `erstinstallation.integration.test.ts` (JOB 4201) misst die
// Strecke an der API (N1, `buildApp`), am echten Prozess (N3, `server.ts`) und den Abbruch von
// `docker compose config` (N2). Was dort ausdruecklich NICHT gemessen ist, steht dort auch: der Aufbau
// ueber `docker compose` selbst, das gebaute Abbild, Browser und TLS, und ein Neustart der eigenen
// PostgreSQL ausserhalb eines Testcontainers. Genau diese Strecke faehrt diese Datei — auf einem
// Pruefplatz, so wie ein Betreiber sie nach `docs/operations/kundeninstanz-neuinstallation.md` faehrt.
//
// DER WEG, SCHRITT FUER SCHRITT (die Faelle unten tragen dieselben Kennzeichen wie der Auftrag):
//   K1  leerer Platz belegt → Installationsordner aus genau diesem Commit → `.env` →
//       `docker compose -f docker-compose.prod.yml up -d --build` → gebautes Abbild laeuft gesund;
//       TLS-Proxy (Caddy) mit eigener Test-CA davor.
//   K6  vorher: fehlende Pflichtwerte brechen `up` mit Namen ab, ohne dass etwas entsteht; das
//       gebaute Abbild verweigert den Start ohne Pflichtwerte; der Kennwort-Link zeigt auf DIESE
//       Instanz (gemessen an einer echten Mail in einer eigenen Mailfalle, keine echte Zustellung).
//   K2  frisches Chromium-Profil, HTTPS mit Zertifikatspruefung → Ersteinrichtung → Anmeldung; ein
//       zweiter Setup-Versuch scheitert; ein Betrachter entsteht ueber die Verwaltung.
//   K3  Dokument mit festem Unicode-Inhalt, Datei (SHA-256 vorab festgehalten) und Quelle — ueber
//       die Oberflaeche erfasst und nach Neuladen ueber die Oberflaeche wiedergelesen.
//   K5  Betrachter liest, darf nicht aendern, sieht den geschuetzten Kontrolleintrag nicht.
//   K4  Anwendung UND eigene PostgreSQL werden gestoppt und gestartet (Container-Lebenszyklus und
//       `pg_postmaster_start_time()` belegen es); neues Profil, neue Anmeldung, alles wieder da.
//   K7  Gegenproben: ausgelassener DB-Neustart und fehlende Datei nach Neustart machen GENAU den
//       zugehoerigen Nachweis rot; Ruecknahme, danach gruen.
//
// WO SIE PFLICHT IST: sobald sie AUSDRUECKLICH aufgerufen wird — ihr Dateiname auf der
// Vitest-Kommandozeile (der gezielte Pruefweg des Testservers) oder `KLARWERK_KUNDENINSTALLATION=pflicht`
// (`kundeninstallation/pflicht.ts`, ausgewertet in `vitest.integration.config.ts`). Dann gibt es KEINEN
// Uebersprung: ein Platz, der Docker, Compose, HTTPS oder den Browser nicht traegt, ist ROT. In einem
// allgemeinen Integrationslauf laeuft hier nichts, und das wird sichtbar gemeldet — ein solcher Lauf
// ist kein Nachweis.
//
// NUR EIGENE RESSOURCEN: ein eindeutiger Compose-Projektname, Container mit diesem Praefix, ein
// eigener Temporaerordner. Die Bereinigung entfernt genau das und prueft danach, dass nichts davon
// uebrig ist. Passwoerter werden je Lauf erzeugt und stehen in keinem Beleg (`schwaerze`).

const WURZEL = resolve(import.meta.dirname, "../..");
const PFLICHT = process.env.KLARWERK_KUNDENINSTALLATION === "pflicht";
const MARKE = "[KLARWERK · Kundeninstallation]";
const INSTANZNAME = "kundeninstanz.pruefplatz.test";
const BASIS = `https://${INSTANZNAME}`;
const PROXY_ABBILD = "caddy:2-alpine";
const MAILFALLE_ABBILD = "node:20-bookworm-slim";

if (!PFLICHT) {
  process.stderr.write(
    `${MARKE} NICHT gefahren: die Strecke wurde nicht ausdruecklich aufgerufen (Dateiname auf der Kommandozeile oder KLARWERK_KUNDENINSTALLATION=pflicht). Dieser Lauf ist fuer die Kundeninstallation KEIN Nachweis.\n`,
  );
}

const KENNUNG = `${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${randomBytes(3).toString("hex")}`;
const PROJEKT = `kn-kundeninst-${KENNUNG}`;

const GEHEIMNISSE: string[] = [];
function geheim(): string {
  const wert = randomBytes(18).toString("base64url");
  GEHEIMNISSE.push(wert);
  return wert;
}

const PG_PASSWORT = geheim();
const ADMIN: B.Konto = {
  name: "Kundin Verwaltung Prüfplatz",
  email: `verwaltung-${KENNUNG}@${INSTANZNAME}`,
  passwort: geheim(),
};
const BETRACHTER: B.Konto = {
  name: "Betrachter Prüfplatz",
  email: `betrachter-${KENNUNG}@${INSTANZNAME}`,
  passwort: geheim(),
};

/** Der vorab festgelegte Unicode-Inhalt — Umlaute, Anfuehrungen, fremde Schriften, Emoji, Mathematik. */
const DOKUMENT: B.Dokumententwurf = {
  titel: `Abnahme Kundeninstanz ${KENNUNG} — „Größe“ & Äquivalenz ✓`,
  text: "Prüfsatz für den Wiederanlauf: Grüße aus Köln – Maß ≠ Masse · 東京 · Ελληνικά · Привет · 😀 · ∑ x² ≤ ∞.",
  stufe: "Öffentlich-intern",
};
const DATEI: B.Datei = {
  name: `abnahmebeleg-${KENNUNG}.png`,
  mime: "image/png",
  bytes: synthetischesPng(`dokument-${KENNUNG}`),
};
/** Unabhaengig festgehalten, BEVOR die Anwendung die Datei je sieht. */
const DATEI_SHA256 = sha256(DATEI.bytes);
const QUELLE: B.Quelle = {
  bezeichnung: "Abnahmeprotokoll „Kundeninstanz“ – Prüfplatz",
  auszug: "Seite 1: Übergabe erfolgt ✓",
  anhang: DATEI.name,
};
const KONTROLLE: B.Dokumententwurf = {
  titel: `Geschützter Kontrolleintrag ${KENNUNG}`,
  text: "Vertraulich: Ein Betrachter darf diesen Eintrag und seine Datei weder sehen noch laden.",
  stufe: "Vertraulich",
};
const KONTROLLDATEI: B.Datei = {
  name: `kontrolle-${KENNUNG}.png`,
  mime: "image/png",
  bytes: synthetischesPng(`kontrolle-${KENNUNG}`),
};

/** Der Beleg dieses Laufs — ausgegeben am Ende, durch `schwaerze` geschickt. */
const BELEG: Record<string, unknown> = {
  art: "KLARWERK Kundeninstallations-Strecke",
  kennung: KENNUNG,
  projekt: PROJEKT,
  instanz: BASIS,
  beginn: new Date().toISOString(),
  datei: { name: DATEI.name, sha256Vorab: DATEI_SHA256, bytes: DATEI.bytes.length },
  schritte: [] as { zeit: string; schritt: string; befund: unknown }[],
};
function belege(schritt: string, befund: unknown): void {
  (BELEG.schritte as { zeit: string; schritt: string; befund: unknown }[]).push({
    zeit: new Date().toISOString(),
    schritt,
    befund,
  });
}

function normalisiere(text: string): string {
  return text.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

describe.skipIf(!PFLICHT)("Kundeninstallation · Compose + HTTPS + Neustart, echt gefahren", () => {
  let arbeit = "";
  let instanz: Instanz | undefined;
  let tls: Tlsausstattung | undefined;
  let platz: Platzbefund | undefined;
  let commit = "";
  let abbildId = "";
  let profilaufbau: B.Profilaufbau | undefined;
  let dokumentId = "";
  let kontrollId = "";
  let kontrollObjekt = "";
  let dokumentObjekt = "";
  let soll: Inhaltsstand | undefined;

  const I = (): Instanz => {
    if (!instanz) {
      throw new Error("Pruefplatz nicht vorbereitet — siehe beforeAll.");
    }
    return instanz;
  };
  const P = (): B.Profilaufbau => {
    if (!profilaufbau) {
      throw new Error("TLS/Browser nicht vorbereitet — siehe K1.");
    }
    return profilaufbau;
  };
  const SOLL = (): Inhaltsstand => {
    if (!soll) {
      throw new Error("Kein erfasstes Dokument — siehe K3.");
    }
    return soll;
  };

  const vollerNeustart = async (
    was: string,
  ): Promise<{ vorher: Dienstmessung; nachher: Dienstmessung }> => {
    const i = I();
    const vorher = await dienstmessung(i);
    const gestoppt = await compose(i, ["stop"], 300_000);
    expect(gestoppt.code, gestoppt.stderr).toBe(0);
    const zwischen = {
      app: (
        await fuehreAus([...i.docker, "inspect", "--format", "{{.State.Status}}", vorher.app.id])
      ).stdout.trim(),
      db: (
        await fuehreAus([...i.docker, "inspect", "--format", "{{.State.Status}}", vorher.db.id])
      ).stdout.trim(),
      https: await httpsGet(INSTANZNAME, "/health", tls?.caPem ?? "").then(
        (a) => a.status,
        (f: unknown) => String(f).slice(0, 80),
      ),
    };
    expect(zwischen.app, "Anwendung nach `stop` nicht beendet").toBe("exited");
    expect(zwischen.db, "PostgreSQL nach `stop` nicht beendet").toBe("exited");
    const gestartet = await compose(i, ["start"], 300_000);
    expect(gestartet.code, gestartet.stderr).toBe(0);
    await warteAufGesund(i);
    await warteAufHttps();
    const nachher = await dienstmessung(i);
    belege(was, {
      vorher,
      zwischenStopp: zwischen,
      nachher,
      bewertung: bewerteNeustart(vorher, nachher),
    });
    return { vorher, nachher };
  };

  const warteAufHttps = async (): Promise<void> => {
    const ende = Date.now() + 180_000;
    let zuletzt = "";
    while (Date.now() < ende) {
      try {
        const a = await httpsGet(INSTANZNAME, "/health", tls?.caPem ?? "");
        zuletzt = `${a.status} ${a.text.slice(0, 80)}`;
        if (a.status === 200) {
          return;
        }
      } catch (fehler) {
        zuletzt = String(fehler).slice(0, 200);
      }
      await warte(1_000);
    }
    throw new Error(`HTTPS ueber den TLS-Proxy nicht bereit: ${zuletzt}`);
  };

  // ------------------------------------------------------------------------------------------------
  // Pruefplatz: Werkzeuge, Befund, leerer Ausgangszustand
  // ------------------------------------------------------------------------------------------------
  beforeAll(async () => {
    const zugang = await dockerBereitstellen();
    await werkzeugeBereitstellen(zugang);
    const browser = await B.chromiumBereitstellen();
    if (browser) {
      zugang.eingerichtet.push(browser);
    }
    platz = await platzbefund(zugang.docker);
    commit = (await mussGelingen(["git", "-C", WURZEL, "rev-parse", "HEAD"], "Commit")).trim();
    const baum = (
      await mussGelingen(["git", "-C", WURZEL, "rev-parse", "HEAD^{tree}"], "Tree")
    ).trim();
    arbeit = mkdtempSync(join(tmpdir(), "kn-kundeninst-"));
    instanz = { docker: zugang.docker, projekt: PROJEKT, ordner: join(arbeit, "klarwerk") };
    await installationsordner(WURZEL, commit, instanz.ordner);
    const leer = await projektbestand(instanz);
    Object.assign(BELEG, {
      platz,
      einrichtung: zugang.eingerichtet,
      produkt: { commit, tree: baum },
      arbeitsordner: arbeit,
      leerVorher: leer,
    });
    expect(
      leer,
      "Der Pruefplatz traegt schon Ressourcen dieses Projekts — dann ist er nicht leer.",
    ).toEqual({
      container: [],
      volumes: [],
      netze: [],
      abbild: false,
    });
  }, 1_800_000);

  afterAll(async () => {
    const i = instanz;
    let rest: Awaited<ReturnType<typeof projektbestand>> | undefined;
    if (i && process.env.KLARWERK_KUNDENINSTALLATION_BEHALTEN !== "1") {
      // NUR die eigenen Ressourcen: zwei Container mit dem Projektpraefix, dann das Compose-Projekt
      // samt eigenem Volume und eigenem Abbild. Fremde Abbilder (postgres, caddy, node) bleiben.
      await fuehreAus([...i.docker, "rm", "-f", `${PROJEKT}-tls`, `${PROJEKT}-mailfalle`]);
      await compose(i, ["down", "-v", "--remove-orphans", "--rmi", "local"], 300_000);
      rest = await projektbestand(i);
      let ordner = "entfernt";
      try {
        rmSync(arbeit, { recursive: true, force: true });
      } catch (fehler) {
        ordner = `nicht vollstaendig entfernt: ${String(fehler).slice(0, 200)}`;
      }
      BELEG.bereinigung = { nachher: rest, arbeitsordner: ordner };
    } else if (i) {
      BELEG.bereinigung = "ausgesetzt (KLARWERK_KUNDENINSTALLATION_BEHALTEN=1)";
    }
    BELEG.ende = new Date().toISOString();
    const text = schwaerze(JSON.stringify(BELEG, null, 2), GEHEIMNISSE);
    const ablage = join(WURZEL, ".local", "logs", "kundeninstallation");
    mkdirSync(ablage, { recursive: true });
    const datei = join(ablage, `${KENNUNG}.json`);
    writeFileSync(datei, `${text}\n`);
    console.log(`${MARKE} BELEG ${datei}\n${text}\n${MARKE} BELEG ENDE`);
    if (rest) {
      expect(rest, "Nach der Bereinigung ist eigener Bestand uebrig").toEqual({
        container: [],
        volumes: [],
        netze: [],
        abbild: false,
      });
    }
  }, 600_000);

  // ------------------------------------------------------------------------------------------------
  it("K6a · fehlende Pflichtwerte brechen `up` mit Namen ab — und es entsteht nichts", async () => {
    const i = I();
    const beispiel = readFileSync(join(i.ordner, ".env.example"), "utf8");
    const faelle: { fall: string; env: string; erwartet: string }[] = [
      {
        fall: "ohne APP_BASE_URL",
        env: `POSTGRES_PASSWORD=${PG_PASSWORT}\n`,
        erwartet: "APP_BASE_URL",
      },
      {
        fall: "ohne POSTGRES_PASSWORD",
        env: `APP_BASE_URL=${BASIS}\n`,
        erwartet: "POSTGRES_PASSWORD",
      },
      {
        fall: ".env unveraendert aus .env.example (plus Kennwort)",
        env: `${beispiel}\nPOSTGRES_PASSWORD=${PG_PASSWORT}\n`,
        erwartet: "APP_BASE_URL",
      },
    ];
    const befunde: unknown[] = [];
    for (const f of faelle) {
      writeFileSync(join(i.ordner, ".env"), f.env, { mode: 0o600 });
      const r = await compose(i, ["up", "-d", "--build"], 300_000);
      const ausgabe = `${r.stdout}${r.stderr}`;
      const bestand = await projektbestand(i);
      befunde.push({
        fall: f.fall,
        exit: r.code,
        meldung: ausgabe.trim().split("\n").slice(-2),
        bestand,
      });
      expect(
        r.code,
        `${f.fall}: \`up\` gelang — dann startet eine Instanz ohne Pflichtwert.\n${ausgabe}`,
      ).not.toBe(0);
      expect(ausgabe, `${f.fall}: der Abbruch nennt den fehlenden Wert nicht`).toContain(
        f.erwartet,
      );
      expect(bestand, `${f.fall}: trotz Abbruch ist etwas entstanden`).toEqual({
        container: [],
        volumes: [],
        netze: [],
        abbild: false,
      });
    }
    belege("K6a Pflichtwerte vor dem Start", befunde);
  }, 900_000);

  // ------------------------------------------------------------------------------------------------
  it("K1 · die dokumentierte Installation: `up -d --build`, gesund, eigenes Volume, TLS-Proxy davor", async () => {
    const i = I();
    schreibeEnv(i.ordner, {
      POSTGRES_PASSWORD: PG_PASSWORT,
      APP_BASE_URL: BASIS,
      SMTP_HOST: "mailfalle",
      SMTP_PORT: "2525",
      SMTP_FROM: `klarwerk@${INSTANZNAME}`,
    });
    const beginn = Date.now();
    const auf = await compose(i, ["up", "-d", "--build"], 2_700_000, "[kundeninstallation · bau]");
    expect(auf.code, `docker compose up scheiterte:\n${auf.stderr.slice(-4000)}`).toBe(0);
    const bauSekunden = Math.round((Date.now() - beginn) / 1000);
    await warteAufGesund(i);

    // Die Pruefung aus der Anleitung (§3), woertlich: /health am veroeffentlichten Port.
    const gesund = await fetch("http://127.0.0.1:3001/health");
    const gesundText = await gesund.text();
    expect(gesund.status, gesundText).toBe(200);
    expect((JSON.parse(gesundText) as { status?: string }).status).toBe("ok");
    const protokoll = await compose(i, ["logs", "--no-color", "app"], 60_000);
    expect(
      `${protokoll.stdout}${protokoll.stderr}`,
      "Die Anwendung laeuft nicht auf Postgres",
    ).toContain("Datenhaltung: Postgres");

    const app = await containerId(i, "app");
    abbildId = (
      await mussGelingen([...i.docker, "inspect", "--format", "{{.Image}}", app], "Abbild")
    ).trim();
    const gebaut = (
      await mussGelingen(
        [...i.docker, "image", "inspect", "--format", "{{.Id}}|{{.Created}}", `${PROJEKT}-app`],
        "Abbild",
      )
    )
      .trim()
      .split("|");
    expect(gebaut[0], "Der laufende Container nutzt nicht das eben gebaute Abbild").toBe(abbildId);
    const umgebung = (
      await mussGelingen(
        [...i.docker, "inspect", "--format", "{{json .Config.Env}}", app],
        "Umgebung",
      )
    ).trim();
    const env = new Map(
      (JSON.parse(umgebung) as string[]).map((e) => [
        e.slice(0, e.indexOf("=")),
        e.slice(e.indexOf("=") + 1),
      ]),
    );
    const datenbank = (
      await compose(i, [
        "exec",
        "-T",
        "db",
        "psql",
        "-U",
        "klarwerk",
        "-d",
        "klarwerk_prod",
        "-Atc",
        "select current_database()",
      ])
    ).stdout.trim();
    const bestand = await projektbestand(i);
    expect(bestand.volumes).toEqual([`${PROJEKT}_pgdata`]);
    expect(datenbank).toBe("klarwerk_prod");
    expect(env.get("COOKIE_SECURE")).toBe("true");
    expect(env.get("NODE_ENV")).toBe("production");
    expect(env.get("APP_BASE_URL")).toBe(BASIS);

    // TLS: eigene Test-CA, Serverzertifikat fuer den Instanznamen, Caddy als Proxy vor `app:3001`.
    // Die Caddy-Konfiguration kommt WOERTLICH aus der Anleitung (§5.2) — nicht aus einer Kopie hier.
    tls = await tlsErzeugen(join(arbeit, "tls"), INSTANZNAME, KENNUNG);
    const caddyfile = join(arbeit, "Caddyfile");
    const anleitung = readFileSync(
      join(i.ordner, "docs/operations/kundeninstanz-neuinstallation.md"),
      "utf8",
    );
    writeFileSync(caddyfile, dokumentierterBlock(anleitung, "caddyfile-eigenes-zertifikat"));
    await mussGelingen(
      [
        ...i.docker,
        "run",
        "-d",
        "--name",
        `${PROJEKT}-tls`,
        "--restart",
        "unless-stopped",
        "--network",
        `${PROJEKT}_default`,
        "-p",
        "127.0.0.1:443:443",
        "-v",
        `${tls.zertifikatsordner}:/certs:ro`,
        "-v",
        `${caddyfile}:/etc/caddy/Caddyfile:ro`,
        PROXY_ABBILD,
      ],
      "TLS-Proxy",
    );
    await warteAufHttps();

    // Die Mailfalle: ein eigener SMTP-Empfaenger im Compose-Netz (`SMTP_HOST=mailfalle`).
    const falle = join(arbeit, "mailfalle.mjs");
    copyFileSync(join(import.meta.dirname, "kundeninstallation", "mailfalle.mjs"), falle);
    await mussGelingen(
      [
        ...i.docker,
        "run",
        "-d",
        "--name",
        `${PROJEKT}-mailfalle`,
        "--network",
        `${PROJEKT}_default`,
        "--network-alias",
        "mailfalle",
        "-v",
        `${falle}:/mailfalle.mjs:ro`,
        MAILFALLE_ABBILD,
        "node",
        "/mailfalle.mjs",
      ],
      "Mailfalle",
    );

    const abbilder: Record<string, string> = {};
    for (const a of [PROXY_ABBILD, MAILFALLE_ABBILD, "postgres:16-alpine"]) {
      abbilder[a] = (
        await fuehreAus([...i.docker, "image", "inspect", "--format", "{{.Id}}", a])
      ).stdout.trim();
    }
    belege("K1 Installation", {
      befehl: `docker compose -p ${PROJEKT} -f docker-compose.prod.yml up -d --build`,
      bauSekunden,
      abbild: { id: abbildId, erstellt: gebaut[1], name: `${PROJEKT}-app` },
      health: gesundText,
      datenbank,
      volumes: bestand.volumes,
      netze: bestand.netze,
      umgebung: {
        NODE_ENV: env.get("NODE_ENV"),
        COOKIE_SECURE: env.get("COOKIE_SECURE"),
        APP_BASE_URL: env.get("APP_BASE_URL"),
        CANONICAL_HOST: env.get("CANONICAL_HOST"),
        KI_SCHLUESSEL_GESETZT: Boolean(env.get("ANTHROPIC_API_KEY") || env.get("OPENAI_API_KEY")),
      },
      tls: {
        weg: "eigene Test-CA → Serverzertifikat fuer den Instanznamen → Caddy (TLS) → app:3001",
        caSha256: tls.caFingerabdruck,
        serverSha256: tls.serverFingerabdruck,
      },
      fremdabbilder: abbilder,
    });
    expect(env.get("ANTHROPIC_API_KEY") ?? "").toBe("");
    expect(env.get("OPENAI_API_KEY") ?? "").toBe("");

    profilaufbau = {
      ordner: join(arbeit, "browser"),
      instanzname: INSTANZNAME,
      vertrauen: (home) =>
        vertrauenFuerChromium(home, join(tls?.zertifikatsordner ?? "", "ca.pem")),
    };
  }, 3_000_000);

  // ------------------------------------------------------------------------------------------------
  it("K6b · das gebaute Abbild verweigert den Start ohne Pflichtwerte und nennt sie", async () => {
    const i = I();
    const lauf = async (name: string, zusatz: string[]): Promise<string> => {
      const r = await fuehreAus(
        [
          ...i.docker,
          "run",
          "--rm",
          "--name",
          `${PROJEKT}-vertrag-${name}`,
          "--network",
          "none",
          "-e",
          "NODE_ENV=production",
          ...zusatz,
          abbildId,
        ],
        { zeitMs: 300_000 },
      );
      expect(r.code, `Das Abbild startete ohne Pflichtwerte (${name}).`).not.toBe(0);
      return `${r.stdout}${r.stderr}`;
    };
    const ohneBeide = await lauf("leer", []);
    const nurDb = await lauf("ohne-basis", [
      "-e",
      "DATABASE_URL=postgresql://nirgends.invalid:5432/klarwerk_prod",
    ]);
    const liste = (text: string): string =>
      /Pflichtwert\(e\) aus dem Startvertrag fehlen — ([^.]+)\./.exec(text)?.[1] ??
      `(keine Liste) ${text.slice(-400)}`;
    expect(liste(ohneBeide)).toContain("DATABASE_URL");
    expect(liste(ohneBeide)).toContain("APP_BASE_URL");
    expect(liste(nurDb)).toBe("APP_BASE_URL");
    belege("K6b Startvertrag im gebauten Abbild", {
      ohneBeide: liste(ohneBeide),
      nurDatenbank: liste(nurDb),
    });
  }, 900_000);

  // ------------------------------------------------------------------------------------------------
  it("K2 · frisches Chromium, gueltiges HTTPS: Ersteinrichtung, Anmeldung, kein zweiter Admin, Betrachter", async () => {
    const aufbau = P();
    const ohneVertrauen = await B.tlsGegenprobe(aufbau, BASIS);
    expect(
      ohneVertrauen,
      "Ein Profil OHNE die Test-CA hat die Seite geladen — dann prueft niemand das Zertifikat.",
    ).toBe("ERR_CERT_AUTHORITY_INVALID");

    const admin = await B.oeffneProfil("verwaltung-1", aufbau);
    try {
      const maske = await B.ersteMaske(admin.seite, BASIS);
      expect(maske, "Die leere Instanz zeigt keine Ersteinrichtung").toBe("Ersteinrichtung");
      await B.ersteinrichtung(admin.seite, ADMIN);
      const keks = await B.sitzungscookie(admin.kontext);
      expect(keks).toMatchObject({ vorhanden: true, secure: true, httpOnly: true });

      const zweit = await B.oeffneProfil("zweiter-versuch", aufbau);
      let zweiterVersuch: { maske: string; status: number; fehler: string };
      try {
        const maskeZwei = await B.ersteMaske(zweit.seite, BASIS);
        const r = await B.imSeitenkontext(zweit.seite, "POST", "/api/auth/setup", {
          name: "Zweiter Versuch",
          email: `zweiter-${KENNUNG}@${INSTANZNAME}`,
          password: geheim(),
        });
        zweiterVersuch = {
          maske: maskeZwei,
          status: r.status,
          fehler: (JSON.parse(r.text) as { error?: string }).error ?? "",
        };
      } finally {
        await zweit.schliessen();
      }
      expect(zweiterVersuch).toEqual({ maske: "Anmelden", status: 409, fehler: "ALREADY_SETUP" });

      await B.betrachterAnlegen(admin.seite, BASIS, BETRACHTER);
      const nutzer = await B.imSeitenkontext(admin.seite, "GET", "/api/users");
      expect(nutzer.status, nutzer.text).toBe(200);
      const konten = JSON.parse(nutzer.text) as { email: string; role: string }[];
      const rollen = konten.map((k) => k.role).sort();
      expect(
        rollen,
        "Nach Ersteinrichtung und einem Betrachter gibt es genau diese zwei Konten",
      ).toEqual(["admin", "viewer"]);
      expect(konten.find((k) => k.email === BETRACHTER.email)?.role).toBe("viewer");
      belege("K2 HTTPS-Ersteinrichtung", {
        profilOhneTestCa: ohneVertrauen,
        ersteMaske: maske,
        sitzungscookie: keks,
        zweiterVersuch,
        rollen,
      });
    } finally {
      await admin.schliessen();
    }
  }, 900_000);

  // ------------------------------------------------------------------------------------------------
  it("K3 · Dokument mit Unicode-Inhalt, Datei und Quelle — erfasst und wiedergelesen ueber die Oberflaeche", async () => {
    const aufbau = P();
    const admin = await B.oeffneProfil("verwaltung-2", aufbau);
    try {
      expect(await B.anmelden(admin.seite, BASIS, ADMIN)).toBe("Anmelden");
      dokumentId = await B.dokumentErfassen(admin.seite, BASIS, DOKUMENT);
      await B.anhangHochladen(admin.seite, BASIS, dokumentId, DATEI);
      await B.quelleHinzufuegen(admin.seite, BASIS, dokumentId, QUELLE);

      kontrollId = await B.dokumentErfassen(admin.seite, BASIS, KONTROLLE);
      await B.anhangHochladen(admin.seite, BASIS, kontrollId, KONTROLLDATEI);

      const gelesen = await B.lese(admin.seite, BASIS, dokumentId);
      const kontrolle = await B.lese(admin.seite, BASIS, kontrollId);
      dokumentObjekt = gelesen.dateiObjekt ?? "";
      kontrollObjekt = kontrolle.dateiObjekt ?? "";
      soll = {
        kennung: dokumentId,
        fassung: gelesen.fassung,
        titel: DOKUMENT.titel,
        text: normalisiere(DOKUMENT.text),
        quellen: [`${QUELLE.bezeichnung} ⟶ ${DATEI.name} ⟶ ${QUELLE.auszug}`],
        dateiSha256: DATEI_SHA256,
      };
      belege("K3 Dokument erfasst und neu geladen", {
        dokument: dokumentId,
        dateiObjekt: dokumentObjekt,
        gelesen,
        kontrolle: {
          kennung: kontrollId,
          dateiObjekt: kontrollObjekt,
          dateiSha256: kontrolle.dateiSha256,
        },
      });
      expect(gelesen.fassung, "Keine Fassung ueber die Historie lesbar").toMatch(/^\d+$/);
      expect(bewerteInhalt(SOLL(), gelesen)).toEqual({
        kennung: true,
        fassung: true,
        text: true,
        quelle: true,
        datei: true,
      });
      expect(kontrolle.dateiSha256).toBe(sha256(KONTROLLDATEI.bytes));
      expect(dokumentObjekt).toMatch(/^[0-9a-f-]{36}$/);
      expect(kontrollObjekt).toMatch(/^[0-9a-f-]{36}$/);
    } finally {
      await admin.schliessen();
    }
  }, 900_000);

  // ------------------------------------------------------------------------------------------------
  const betrachterPruefung = async (profilname: string, schritt: string): Promise<void> => {
    const b = await B.oeffneProfil(profilname, P());
    try {
      expect(await B.anmelden(b.seite, BASIS, BETRACHTER)).toBe("Anmelden");
      const vorher = await B.lese(b.seite, BASIS, dokumentId);
      const ziel = `/api/kos/${dokumentId}`;
      const versuch = await B.imSeitenkontext(b.seite, "PUT", ziel, {
        action: "add-source",
        source: { label: `Unerlaubte Änderung ${profilname}` },
      });
      const nachher = await B.lese(b.seite, BASIS, dokumentId);
      const liste = await B.imSeitenkontext(b.seite, "GET", "/api/kos");
      const kontrolle = {
        objekt: (await B.imSeitenkontext(b.seite, "GET", `/api/kos/${kontrollId}`)).status,
        dateiRef: (await B.imSeitenkontext(b.seite, "GET", `/api/objects/${kontrollObjekt}`))
          .status,
        dateiRoh: (await B.imSeitenkontext(b.seite, "GET", `/api/objects/${kontrollObjekt}/raw`))
          .status,
        inListe: liste.text.includes(kontrollId),
        seiteGesperrt: await B.objektseiteGesperrt(b.seite, BASIS, kontrollId),
      };
      const verwaltung = (await B.imSeitenkontext(b.seite, "GET", "/api/users")).status;
      // EXAKT das Erlaubte: die Liste des Betrachters traegt genau das synthetische Dokument.
      const sichtbar =
        liste.status === 200
          ? (JSON.parse(liste.text) as { id: string }[]).map((k) => k.id).sort()
          : [`HTTP ${liste.status}`];
      belege(schritt, {
        sichtbareEintraege: sichtbar,
        vorher: bewerteInhalt(SOLL(), vorher),
        aenderungsversuch: {
          ziel: `PUT ${ziel} add-source`,
          status: versuch.status,
          antwort: versuch.text.slice(0, 120),
        },
        nachher: bewerteInhalt(SOLL(), nachher),
        kontrolleintrag: kontrolle,
        verwaltung,
      });
      const alleGruen = { kennung: true, fassung: true, text: true, quelle: true, datei: true };
      expect(bewerteInhalt(SOLL(), vorher), "Betrachter liest nicht, was ihm erlaubt ist").toEqual(
        alleGruen,
      );
      expect(
        versuch.status,
        "Der unerlaubte Aenderungsversuch scheitert nicht auf HTTP-Ebene",
      ).toBe(403);
      expect(bewerteInhalt(SOLL(), nachher), "Nach dem Aenderungsversuch ist etwas anders").toEqual(
        alleGruen,
      );
      expect(kontrolle).toEqual({
        objekt: 404,
        dateiRef: 404,
        dateiRoh: 404,
        inListe: false,
        seiteGesperrt: true,
      });
      expect(verwaltung).toBe(403);
      expect(sichtbar, "Der Betrachter sieht mehr oder anderes als das erlaubte Dokument").toEqual([
        dokumentId,
      ]);
    } finally {
      await b.schliessen();
    }
  };

  it("K5 · Betrachter vor dem Neustart: liest, darf nicht aendern, sieht den Kontrolleintrag nicht", async () => {
    await betrachterPruefung("betrachter-1", "K5 Betrachter vor dem Neustart");
  }, 600_000);

  // ------------------------------------------------------------------------------------------------
  it("K6c · der Kennwort-Link zeigt auf DIESE Instanz, keine Umleitung auf eine fremde", async () => {
    const i = I();
    const f = await B.oeffneProfil("kennwort", P());
    try {
      await B.kennwortVergessen(f.seite, BASIS, BETRACHTER.email);
    } finally {
      await f.schliessen();
    }
    let mail: { an: string[]; roh: string } | undefined;
    const ende = Date.now() + 60_000;
    while (!mail && Date.now() < ende) {
      const logs = await fuehreAus([...i.docker, "logs", `${PROJEKT}-mailfalle`]);
      for (const zeile of logs.stdout.split("\n")) {
        if (!zeile.startsWith("{")) {
          continue;
        }
        const eintrag = JSON.parse(zeile) as { an?: string[]; roh?: string };
        if (eintrag.roh && eintrag.an?.some((a) => a.includes(BETRACHTER.email))) {
          mail = { an: eintrag.an, roh: Buffer.from(eintrag.roh, "base64").toString("latin1") };
        }
      }
      if (!mail) {
        await warte(1_000);
      }
    }
    expect(mail, "Keine Kennwort-Mail in der Mailfalle angekommen").toBeDefined();
    const ziele = resetZiele(mail?.roh ?? "");
    const wurzel = await httpsGet(INSTANZNAME, "/", tls?.caPem ?? "");
    belege("K6c Kennwort-Link und Kanonik", {
      linkziele: ziele,
      wurzelStatus: wurzel.status,
      umleitung: wurzel.kopf.location ?? null,
    });
    expect(ziele.length).toBeGreaterThan(0);
    expect(ziele.every((z) => z.origin === BASIS && z.pfad === "/reset")).toBe(true);
    expect(wurzel.status, "Die eigene Adresse wird umgeleitet").toBe(200);
  }, 600_000);

  // ------------------------------------------------------------------------------------------------
  it("K4 · Anwendung UND eigene PostgreSQL gestoppt und gestartet; neues Profil findet alles wieder", async () => {
    const { vorher, nachher } = await vollerNeustart("K4 Neustart beider Dienste");
    expect(bewerteNeustart(vorher, nachher)).toEqual({
      appNeustart: true,
      dbNeustart: true,
      containerErhalten: true,
      volumeErhalten: true,
    });
    const admin = await B.oeffneProfil("verwaltung-3", P());
    try {
      const maske = await B.anmelden(admin.seite, BASIS, ADMIN);
      expect(maske, "Nach dem Neustart wird erneut eine Ersteinrichtung verlangt").toBe("Anmelden");
      const gelesen = await B.lese(admin.seite, BASIS, dokumentId);
      belege("K4 nach dem Neustart gelesen", {
        maske,
        gelesen,
        bewertung: bewerteInhalt(SOLL(), gelesen),
      });
      expect(bewerteInhalt(SOLL(), gelesen)).toEqual({
        kennung: true,
        fassung: true,
        text: true,
        quelle: true,
        datei: true,
      });
    } finally {
      await admin.schliessen();
    }
  }, 1_200_000);

  it("K5 · Betrachter nach dem Neustart: dieselben Rechte, derselbe Inhalt", async () => {
    await betrachterPruefung("betrachter-2", "K5 Betrachter nach dem Neustart");
  }, 600_000);

  // ------------------------------------------------------------------------------------------------
  it("K7a · Gegenprobe: ausgelassener Datenbankneustart macht genau den DB-Nachweis rot", async () => {
    const i = I();
    const vorher = await dienstmessung(i);
    const nurApp = await compose(i, ["restart", "app"], 300_000);
    expect(nurApp.code, nurApp.stderr).toBe(0);
    await warteAufGesund(i);
    await warteAufHttps();
    const nachher = await dienstmessung(i);
    const rot = roteNachweise(bewerteNeustart(vorher, nachher));
    belege("K7a Verstellung: nur `restart app`", { vorher, nachher, rot });
    expect(
      rot,
      "Ein Neustart ohne Datenbank faellt nicht (oder nicht nur) am DB-Nachweis auf",
    ).toEqual(["dbNeustart"]);

    // Ruecknahme: der echte Neustart beider Dienste — danach wieder gruen.
    const echt = await vollerNeustart("K7a Ruecknahme: Neustart beider Dienste");
    const nachRuecknahme = roteNachweise(bewerteNeustart(echt.vorher, echt.nachher));
    belege("K7a nach Ruecknahme", { rot: nachRuecknahme });
    expect(nachRuecknahme).toEqual([]);
  }, 1_200_000);

  // ------------------------------------------------------------------------------------------------
  it("K7b · Gegenprobe: fehlende Datei nach Neustart macht genau den Datei-Nachweis rot", async () => {
    const i = I();
    expect(dokumentObjekt).toMatch(/^[0-9a-f-]{36}$/);
    const psql = async (sql: string): Promise<string> => {
      const r = await compose(i, [
        "exec",
        "-T",
        "db",
        "psql",
        "-v",
        "ON_ERROR_STOP=1",
        "-U",
        "klarwerk",
        "-d",
        "klarwerk_prod",
        "-Atc",
        sql,
      ]);
      expect(r.code, r.stderr).toBe(0);
      return r.stdout.trim();
    };
    const lies = async (profil: string): Promise<B.Gelesen> => {
      const a = await B.oeffneProfil(profil, P());
      try {
        expect(await B.anmelden(a.seite, BASIS, ADMIN)).toBe("Anmelden");
        return await B.lese(a.seite, BASIS, dokumentId);
      } finally {
        await a.schliessen();
      }
    };

    // Verstellung NUR im eigenen Testaufbau: die Dateizeile wird beiseitegelegt (nicht geloescht).
    await psql(
      `BEGIN; CREATE TABLE kn_gegenprobe_datei AS SELECT * FROM objects WHERE id='${dokumentObjekt}'; DELETE FROM objects WHERE id='${dokumentObjekt}'; COMMIT;`,
    );
    await vollerNeustart("K7b Neustart mit fehlender Datei");
    const verstellt = await lies("verwaltung-gegenprobe");
    const rot = roteNachweise(bewerteInhalt(SOLL(), verstellt));
    belege("K7b Verstellung: Datei nach Neustart nicht vorhanden", { gelesen: verstellt, rot });
    expect(rot, "Fehlende Datei faellt nicht (oder nicht nur) am Datei-Nachweis auf").toEqual([
      "datei",
    ]);

    // Ruecknahme: die Zeile kommt zurueck, der Beiseite-Bestand verschwindet; Neustart; gruen.
    await psql(
      "BEGIN; INSERT INTO objects SELECT * FROM kn_gegenprobe_datei; DROP TABLE kn_gegenprobe_datei; COMMIT;",
    );
    await vollerNeustart("K7b Ruecknahme: Neustart mit zurueckgelegter Datei");
    const zurueck = await lies("verwaltung-ruecknahme");
    const nachRuecknahme = roteNachweise(bewerteInhalt(SOLL(), zurueck));
    belege("K7b nach Ruecknahme", { gelesen: zurueck, rot: nachRuecknahme });
    expect(nachRuecknahme).toEqual([]);
  }, 1_800_000);
});
