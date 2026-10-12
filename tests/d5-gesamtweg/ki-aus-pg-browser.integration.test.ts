// ================================================================================================
// D5 · KI AUS — DER ABSCHALTWEG AM ECHTEN WEG: POSTGRESQL, ECHTER SOCKET, GEBAUTE FLÄCHE, CHROMIUM.
// ================================================================================================
//
// Derselbe Prüfplatz wie der D5-Gesamtweg (`./platz.ts`: Wegwerf-Datenbank je Fall, `buildPgServices`,
// `app.listen`, `apps/web/dist`, Chromium) und derselbe fachliche Ablauf (`kette.ts`). Neu ist allein
// der Zustand „KI aus" — der bestehende Adminweg `PUT /api/reasoner/config` mit `global:
// "deterministic"`, gespeichert in `reasoner_policy` — und die UNABHÄNGIGEN ZÄHLER an den Grenzen,
// an denen Kundeninhalt gelesen oder weitergegeben wird (`../d5-ki-aus/zaehler.ts`):
//
//   · Ablagen           JEDE Methode der Bestands-, Such-, Beleg- und Lückenablagen der laufenden
//                       Instanz, gezählt bei der Ausführung (unterhalb der Dienste),
//   · Antwortweg        `Reasoner.answer` / `answerRetrievalOnly`,
//   · Modelltransport   der instrumentierte lokale Modelldraht (`kette.ts`, nie ein realer Anbieter),
//   · Datenbank         jede SQL-Anweisung an eine Inhaltstabelle, mitgeschnitten am pg-Treiber.
//
// Ein leerer Antworttext oder ein ausgebliebener Anbieteraufruf gilt hier für sich NICHTS: jede
// Aussage „nichts gelesen" steht neben einer Kalibrierung, in der dieselben Zähler vorher gezählt
// haben, und neben einer Gegenprobe, in der sie ohne die Sperre wieder zählen.
//
// ABGRENZUNG, AUSDRÜCKLICH (K7): gemessen ist der D5-Frageweg (Fragefläche → `POST /api/ask`, dazu
// die Klara-Sitzung und `POST /api/reasoner` Aufgabe `ask`, die denselben Dienst rufen). Andere
// KI-Verbraucher (Strukturvorschlag, Assistenz, Konflikt-/Dublettenprüfung, Bildbeschreibung, …)
// sind NICHT Gegenstand dieses Nachweises und werden hier nicht als erfüllt geführt.
//
// SICHTBARER SKIP statt stillem Grün — dieselbe Regel und dieselbe Zählzeile wie im Gesamtweg.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import d5kiaus from "../../apps/web/src/texte/d5kiaus";
import {
  ALLE_GRENZEN,
  type Grenzen,
  type Grenzstand,
  type SqlMitschnitt,
  differenz,
  frageAnfragenMarkieren,
  gelesen,
  grenzenZaehlen,
  modellplatzBelegen,
  ruhe,
  sperreEntfernen,
  sqlMitschnitt,
  zugriffsbefund,
} from "../d5-ki-aus/zaehler";
import {
  BELEGSTELLE,
  type Draht,
  FRAGE,
  type Konto,
  ORIGINALNAME,
  ORIGINALTEXT,
  adapterUmgebungSetzen,
  drahtAufbauen,
  eintragMitOriginal,
  neuesKonto,
} from "../klara-quellen-nutzerweg/kette";

adapterUmgebungSetzen();

import {
  type Browser,
  type Instanz,
  type Klickfolge,
  type Kontext,
  MELDUNG_KEINE_DATENBANK,
  type Pruefplatz,
  type Seite,
  type Wegwerfdatenbank,
  abrufAusDerSeite,
  anmelden,
  antworttext,
  belegLinkBetaetigen,
  ergebnisAbwarten,
  flaecheNeuBauen,
  fn,
  frageStellen,
  fragenflaecheOeffnen,
  instanzStarten,
  profil,
  pruefplatzOeffnen,
  seitentext,
  starteChromium,
  warte,
} from "./platz";
import { preisgabeImText, verboteneStuecke } from "./preisgabe";

const JOB = "[KLARWERK] D5 KI-AUS";
const TITEL = "Zylinderkopfdichtung XQ42 wechseln (D5 KI aus)";

let platz: Pruefplatz | undefined;
let browser: Browser | undefined;
let draht: Draht;
let sql: SqlMitschnitt;
let revision = "(nicht gelesen)";
const bindung: {
  head?: string;
  baum?: string;
  sauber?: boolean;
  buendel?: string;
  pg?: string;
  policy: string[];
  faelle: { fall: string; ausgang: string }[];
  abweichend?: string[];
  abweichendNachOrdner?: Record<string, number>;
  quellenGleichHead?: boolean;
} = { policy: [], faelle: [] };

/**
 * Die Quellen, aus denen dieser Lauf misst: Produkt (Dienste, Fläche samt Bauvorgaben) und Tests.
 * Ihr Git-Baum im vorliegenden Stand muss dem von HEAD gleichen (s. `beforeAll`).
 */
const QUELLEN = [
  "services",
  "apps/web/src",
  "apps/web/index.html",
  "apps/web/vite.config.ts",
  "tests",
  "vitest.integration.config.ts",
  "package.json",
  "apps/web/package.json",
] as const;
const zaehlung = { bestanden: 0, fehlgeschlagen: 0, uebersprungen: 0 };

function ueberspringen(ctx: { skip: () => void }): void {
  zaehlung.uebersprungen += 1;
  ctx.skip();
}

beforeAll(async () => {
  draht = drahtAufbauen();
  sql = sqlMitschnitt();
  // DIE MESSUNG BINDET AN DIE PRODUKTREVISION — Lauf 2 Runde 3 (Bens Befund: die Protokolle
  // banden „weder die ausgeführten Testdateien noch das Browserbündel eindeutig an den Commit"):
  //   · BAUM: der Git-Baum des GESAMTEN vorliegenden Stands (Produkt UND Tests, alles Nicht-
  //     Ignorierte), gebildet über einen Wegwerf-Index — der echte Index bleibt unberührt. Er ist
  //     gleich `git rev-parse <commit>^{tree}` jedes Commits, der genau diesen Stand festhält; bei
  //     sauberem Stand ist er HEAD^{tree} (`sauber=ja`).
  //   · BÜNDEL: die Fläche wird für diesen Lauf NEU aus demselben Baum gebaut (`flaecheNeuBauen`),
  //     ihr Inhalt als SHA-256 protokolliert — kein liegendes `dist` wird übernommen.
  //   · BELEG: am Ende eine JSON-Datei mit Baum, HEAD, PostgreSQL-Fassung, Bündel-Hash, gespeicherter
  //     Policy und dem Ausgang JEDES Fachfalls (Pfad: `KLARWERK_D5_BELEG`, sonst im Temp-Ordner).
  try {
    const kopf = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const kopfBaum = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim();
    const ordner = mkdtempSync(join(tmpdir(), "kw-d5-index-"));
    const umgebung = { ...process.env, GIT_INDEX_FILE: join(ordner, "index") };
    try {
      execFileSync("git", ["read-tree", "HEAD"], { env: umgebung });
      execFileSync("git", ["add", "-A", "--", "."], { env: umgebung });
      const baum = execFileSync("git", ["write-tree"], { env: umgebung, encoding: "utf8" }).trim();
      bindung.head = kopf;
      bindung.baum = baum;
      bindung.sauber = baum === kopfBaum;
      // Lauf 3 Runde 2 (Bens Befund: „sauber=nein" am Testserver, Abweichung nicht erklärt). Die
      // Abweichung wird jetzt BENANNT — jeder Pfad, in dem der vorliegende Stand von HEAD abweicht —
      // und die Quellen, aus denen gemessen wird, werden einzeln gegen HEAD verglichen. Weicht eine
      // Produkt- oder Testquelle ab, ist die Messung NICHT an den Commit gebunden: dann scheitert
      // der Lauf, statt eine fremde Fassung als diese Revision zu melden.
      bindung.abweichend = execFileSync(
        "git",
        ["diff-tree", "-r", "--name-status", kopfBaum, baum],
        {
          encoding: "utf8",
        },
      )
        .split("\n")
        .filter((zeile) => zeile.trim() !== "");
      bindung.quellenGleichHead = QUELLEN.every((pfad) => {
        const lies = (b: string) =>
          execFileSync("git", ["rev-parse", "--verify", "-q", `${b}:${pfad}`], {
            encoding: "utf8",
          }).trim();
        return lies(kopfBaum) === lies(baum);
      });
    } finally {
      rmSync(ordner, { recursive: true, force: true });
    }
    revision = `HEAD ${kopf} · Baum ${bindung.baum} · sauber=${bindung.sauber ? "ja" : "nein"} · Quellen=HEAD: ${bindung.quellenGleichHead ? "ja" : "NEIN"}`;
    // Nach oberstem Ordner gezählt, damit JEDER abweichende Pfad im Protokoll erklärt ist (am
    // Testserver z. B. `.b6-pg/` — dessen Wegwerf-PostgreSQL liegt im Arbeitsverzeichnis).
    const nachOrdner = new Map<string, number>();
    for (const zeile of bindung.abweichend ?? []) {
      const pfad = zeile.split("\t").slice(1).join("\t");
      const ordnerName = pfad.includes("/") ? `${pfad.split("/")[0]}/` : pfad;
      nachOrdner.set(ordnerName, (nachOrdner.get(ordnerName) ?? 0) + 1);
    }
    bindung.abweichendNachOrdner = Object.fromEntries(nachOrdner);
    process.stderr.write(
      `${JOB} ABWEICHUNG VOM HEAD-BAUM (${bindung.abweichend?.length ?? 0} Pfade, nach Ordner): ${JSON.stringify(bindung.abweichendNachOrdner)} · Quellen (${QUELLEN.join(", ")}) = HEAD: ${bindung.quellenGleichHead ? "ja" : "NEIN"}\n`,
    );
  } catch (fehler) {
    revision = `(kein Git-Stand lesbar: ${String(fehler).slice(0, 120)})`;
  }
  expect(
    bindung.quellenGleichHead,
    `Produkt-/Testquellen weichen von HEAD ab — die Messung wäre nicht an die Revision gebunden: ${revision}`,
  ).toBe(true);
  const ergebnis = await pruefplatzOeffnen();
  if (ergebnis.skipGrund !== undefined) {
    process.stderr.write(`${MELDUNG_KEINE_DATENBANK} ${ergebnis.skipGrund}\n`);
    return;
  }
  platz = ergebnis.platz;
  process.stderr.write(`${JOB} REVISION: ${revision} · PostgreSQL: ${platz.pgFassung}\n`);
  const buendel = flaecheNeuBauen();
  bindung.buendel = `${buendel.sha256} (${buendel.dateien} Dateien)`;
  bindung.pg = platz.pgFassung;
  process.stderr.write(
    `${JOB} FLÄCHE: neu gebaut in ${buendel.dauerMs} ms · Bündel sha256=${bindung.buendel}\n`,
  );
  browser = await starteChromium();
}, 900_000);

afterEach((ctx) => {
  const stand = ctx.task.result?.state;
  bindung.faelle.push({ fall: ctx.task.name, ausgang: stand ?? "unbekannt" });
  if (stand === "pass") {
    zaehlung.bestanden += 1;
  } else if (stand === "fail") {
    zaehlung.fehlgeschlagen += 1;
  }
});

afterAll(async () => {
  sql?.abbauen();
  draht?.abbauen();
  await browser?.close().catch(() => undefined);
  await platz?.abraeumen();
  process.stderr.write(
    `${JOB} FACHFÄLLE GETRENNT GEZÄHLT: bestanden=${zaehlung.bestanden} · fehlgeschlagen=${zaehlung.fehlgeschlagen} · übersprungen=${zaehlung.uebersprungen} · Revision=${revision}\n`,
  );
  const belegPfad =
    process.env.KLARWERK_D5_BELEG ??
    join(tmpdir(), `kw-d5-kiaus-beleg-${bindung.baum ?? "ohne-baum"}.json`);
  writeFileSync(
    belegPfad,
    `${JSON.stringify({ ...bindung, zaehlung, zeit: new Date().toISOString() }, null, 1)}\n`,
  );
  process.stderr.write(`${JOB} BELEG: ${belegPfad}\n`);
  if (zaehlung.uebersprungen > 0) {
    process.stderr.write(
      `${JOB} ACHTUNG: ein übersprungener Fachfall ist KEIN bestandener Fachfall — der Abschaltweg gilt dann als NICHT gemessen.\n`,
    );
  }
}, 180_000);

// ================================================================================================
// DIE LAGE EINES FACHFALLS
// ================================================================================================

interface Lage {
  db: Wegwerfdatenbank;
  instanz: Instanz;
  grenzen: Grenzen;
  admin: Konto;
  leser: Konto;
  kontext: Kontext;
  seite: Seite;
  koId: string;
  objectId: string;
  neuStarten(): Promise<void>;
  abbauen(): Promise<void>;
}

async function fachlage(marke: string, sprache: "de" | "en" | "nl" = "de"): Promise<Lage> {
  // Ein Pool, auf den keine Anfrage wartet — Voraussetzung einer belastbaren SQL-Zuordnung (s. platz.ts).
  const db = await (platz as Pruefplatz).wegwerfdatenbank(`kiaus_${marke}`, 40);
  let instanz = await instanzStarten(db.pool, 0, {
    policyLaden: true,
    vorbereiten: frageAnfragenMarkieren,
  });
  draht.setzeApp(instanz.app);
  let grenzen = grenzenZaehlen(instanz.dienste, draht);
  const admin = await neuesKonto(instanz.app, `kiaus-${marke}-admin`);
  const leser = await neuesKonto(instanz.app, `kiaus-${marke}-leser`, admin);
  const eintrag = await eintragMitOriginal(instanz.app, admin, { titel: TITEL });
  const { kontext, seite } = await profil(
    browser as Browser,
    { width: 1280, height: 900 },
    sprache,
  );
  await anmelden(seite, instanz.basis, leser.email);
  const lage: Lage = {
    db,
    get instanz() {
      return instanz;
    },
    get grenzen() {
      return grenzen;
    },
    admin,
    leser,
    kontext,
    seite,
    koId: eintrag.koId,
    objectId: eintrag.objectId,
    // App-NEUSTART auf DERSELBEN Datenbank und DERSELBEN Adresse — mit dem Policy-Laden aus
    // `server.ts`. Die Sitzung des Browsers liegt in PostgreSQL und überlebt ihn.
    async neuStarten() {
      const port = instanz.port;
      grenzen.abbauen();
      await instanz.schliessen();
      instanz = await instanzStarten(db.pool, port, {
        policyLaden: true,
        vorbereiten: frageAnfragenMarkieren,
      });
      draht.setzeApp(instanz.app);
      grenzen = grenzenZaehlen(instanz.dienste, draht);
    },
    async abbauen() {
      grenzen.abbauen();
      await kontext.close().catch(() => undefined);
      await instanz.schliessen().catch(() => undefined);
      draht.setzeApp(null);
      await db.schliessen();
    },
  };
  return lage;
}

async function kiSchalten(lage: Lage, konto: Konto, global: string) {
  return lage.instanz.app.inject({
    method: "PUT",
    url: "/api/reasoner/config",
    headers: konto.kopf,
    payload: { global },
  });
}

/** K1: KI aus — über den bestehenden Adminweg, BESTÄTIGT an API und gespeicherter Zeile. */
async function kiAusBestaetigt(lage: Lage): Promise<void> {
  const res = await kiSchalten(lage, lage.admin, "deterministic");
  expect(res.statusCode, `die Abschaltung durch den Administrator scheiterte: ${res.body}`).toBe(
    200,
  );
  await abschaltungBestaetigen(lage);
}

async function abschaltungBestaetigen(lage: Lage): Promise<void> {
  const cfg = await lage.instanz.app.inject({
    method: "GET",
    url: "/api/reasoner/config",
    headers: lage.admin.kopf,
  });
  expect((cfg.json() as { kiAbschaltung: unknown }).kiAbschaltung).toEqual({
    abgeschaltet: true,
    wahl: "deterministic",
    quelle: "db",
  });
  const zeile = await lage.db.pool.query<{ data: { global: string } }>(
    "SELECT data FROM reasoner_policy WHERE id = 1",
  );
  expect(zeile.rows[0]?.data.global, "die Abschaltung steht nicht in reasoner_policy").toBe(
    "deterministic",
  );
  bindung.policy.push(`${lage.db.name}: ${JSON.stringify(zeile.rows[0]?.data)}`);
  process.stderr.write(
    `${JOB} GESPEICHERTE POLICY (${lage.db.name}): ${JSON.stringify(zeile.rows[0]?.data)} · Revision ${revision}\n`,
  );
}

/** Ein Messfenster: Zähler und SQL-Mitschnitt um genau einen Vorgang. */
async function gemessen<T>(
  lage: Lage,
  vorgang: () => Promise<T>,
): Promise<{ ergebnis: T; befund: string; sql: string[]; d: Grenzstand }> {
  const vorher = lage.grenzen.stand();
  sql.beginnen(lage.db.pool);
  let ergebnis: T;
  try {
    ergebnis = await vorgang();
  } finally {
    // Nachlauf abwarten: eine Anweisung, die der Vorgang noch angestossen hat, zählt mit.
    await new Promise((r) => setTimeout(r, 150));
  }
  const anweisungen = sql.beenden();
  const d = differenz(vorher, lage.grenzen.stand());
  return { ergebnis, befund: zugriffsbefund(d, ALLE_GRENZEN), sql: anweisungen, d };
}

function nullZugriffe(wo: string, m: { befund: string; sql: string[] }): void {
  expect(m.befund, `${wo}: nach der bestätigten Abschaltung KI-bedingter Zugriff`).toBe("");
  expect(m.sql, `${wo}: nach der bestätigten Abschaltung wurden Inhaltstabellen abgefragt`).toEqual(
    [],
  );
}

const POST_ASK = `(a) => fetch("/api/ask", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ question: a.frage, locale: a.sprache }),
}).then((r) => r.text().then((t) => ({ status: r.status, text: t })))
  .catch((e) => ({ status: -1, text: String(e) }))`;

// Der zweite D5-Eingang (`POST /api/reasoner`, Aufgabe `ask`) — aus derselben Seite, über denselben
// Socket und dieselbe Sitzung (Bens Befund Lauf 2 Runde 1: dieser Eingang sprach NL als DE).
const POST_REASONER_ASK = `(a) => fetch("/api/reasoner", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ task: "ask", text: a.frage, locale: a.sprache }),
}).then((r) => r.text().then((t) => ({ status: r.status, text: t })))
  .catch((e) => ({ status: -1, text: String(e) }))`;

function frageAusDerSeite(
  seite: Seite,
  sprache: "de" | "en" | "nl" = "de",
  frage = FRAGE,
): Promise<{ status: number; text: string }> {
  return seite.evaluate<{ status: number; text: string }>(fn(POST_ASK), { frage, sprache });
}

function keinKundeninhalt(wo: string, text: string): void {
  const durch = preisgabeImText(
    text,
    verboteneStuecke({
      name: ORIGINALNAME,
      titel: TITEL,
      auszug: BELEGSTELLE,
      original: Buffer.from(ORIGINALTEXT, "utf8"),
      bereitsErhalten: [],
    }),
  );
  expect(durch.map((s) => s.was).join(" · "), `${wo}: Kundeninhalt in der Auskunft`).toBe("");
}

function abschaltauskunft(wo: string, a: { status: number; text: string }): void {
  expect(a.status, `${wo}: statt der Abschaltauskunft kam ${a.text.slice(0, 300)}`).toBe(503);
  expect((JSON.parse(a.text) as { error: string }).error).toBe("KI_ABGESCHALTET");
  keinKundeninhalt(wo, a.text);
}

const SICHTBAR = (testid: string) => `() => {
  const el = document.querySelector('[data-testid="${testid}"]');
  return el ? (el.textContent || "").trim() : null;
}`;

async function textVon(seite: Seite, testid: string): Promise<string | null> {
  return seite.evaluate<string | null>(fn(SICHTBAR(testid)));
}

/** Die Ausgangsfrage über die Fläche — die Kalibrierung aller Zähler (K1). */
async function ausgangsfrage(lage: Lage): Promise<void> {
  await fragenflaecheOeffnen(lage.seite, lage.instanz.basis);
  const m = await gemessen(lage, async () => {
    expect(await frageStellen(lage.seite, FRAGE)).toBe("gestellt");
    await ergebnisAbwarten(lage.seite);
  });
  const karte = await antworttext(lage.seite);
  expect(karte ?? "", "Ausgangspunkt: die Antwortkarte trägt die Quelle nicht").toContain(
    BELEGSTELLE,
  );
  expect(gelesen(m.d), "Kalibrierung: die Ablagen zählten die Ausgangsfrage nicht").toBeGreaterThan(
    0,
  );
  expect(m.d.folge, "Kalibrierung: das Nachladen der Kandidaten fehlt").toContain("ko.listByIds");
  expect(m.d.antwortweg, "Kalibrierung: der Antwortweg zählte nicht").toBeGreaterThan(0);
  expect(m.d.modell, "Kalibrierung: der Modelldraht zählte nicht").toBeGreaterThan(0);
  expect(
    m.sql.length,
    "Kalibrierung: der SQL-Mitschnitt sah die Ausgangsfrage nicht",
  ).toBeGreaterThan(0);
}

describe("D5 · KI aus — am echten Weg (PostgreSQL · Socket · gebaute Fläche · Chromium)", () => {
  // ==============================================================================================
  // H1 · K1 · K2 · K4 — vorbereitete Fläche, direkte Wiederholung, Klara-Sitzung, frische Fläche,
  //      und das menschliche Leserecht daneben.
  // ==============================================================================================
  it("H1 · nach bestätigtem KI-aus: Auskunft ohne Kundeninhalt, null Zugriffe — und Bibliothek/Original bleiben lesbar", async (ctx) => {
    if (!platz || !browser) {
      ueberspringen(ctx);
      return;
    }
    const lage = await fachlage("h1");
    try {
      await ausgangsfrage(lage);

      // VORBEREITET, solange die KI an ist: eine Klara-Sitzung, einmal erfolgreich benutzt.
      const angelegt = await lage.instanz.app.inject({
        method: "POST",
        url: "/api/klara/sessions",
        headers: lage.leser.kopf,
        payload: {
          addinInstanceId: "d5-kiaus-h1",
          documentDescriptor: { kind: "saved", hostDocumentId: "d5-kiaus-h1-doc" },
        },
      });
      expect(angelegt.statusCode, angelegt.body).toBe(201);
      const sitzung = angelegt.json() as { sessionId: string; documentContextId: string };
      // R-0700: die Klara-Frage geht über Klaras eigenen, sitzungsgebundenen Zugang.
      const klaraFrage = () =>
        lage.instanz.app.inject({
          method: "POST",
          url: `/api/klara/sessions/${sitzung.sessionId}/execute`,
          headers: {
            ...lage.leser.kopf,
            "content-type": "application/json",
            "x-klara-session": sitzung.sessionId,
            "x-klara-instance": "d5-kiaus-h1",
            "x-klara-document": sitzung.documentContextId,
          },
          payload: { question: FRAGE, locale: "de" },
        });
      expect((await klaraFrage()).statusCode, "die vorbereitete Klara-Sitzung trug nicht").toBe(
        200,
      );

      await kiAusBestaetigt(lage);

      // ── 1. DIE VORBEREITETE FLÄCHE: die Seite steht noch mit der Antwort da und weiss nichts
      //       von der Abschaltung. Der Mensch drückt erneut auf Senden.
      const vorbereitet = await gemessen(lage, async () => {
        const knopf = await frageStellen(lage.seite, FRAGE);
        // Die vorbereitete Seite weiss noch nichts: der Knopf MUSS offen sein, sonst misst dieser
        // Schritt die frische Seite ein zweites Mal statt der vorbereiteten.
        expect(knopf, "die vorbereitete Fläche liess nicht absenden").toBe("gestellt");
        await warte(
          lage.seite,
          `() => !!document.querySelector('[data-testid="ask-ki-abgeschaltet"]')`,
          "die vorbereitete Fläche zeigt die Abschaltauskunft",
          undefined,
          30_000,
        );
        return knopf;
      });
      nullZugriffe("vorbereitete Fläche", vorbereitet);
      expect(await textVon(lage.seite, "ask-ki-abgeschaltet")).toBe(d5kiaus.de["d5kiaus.text"]);

      // ── 2. DIE DIREKTE WIEDERHOLUNG DESSELBEN D5-API-AUFRUFS aus derselben Seite — zweimal.
      const wiederholt = await gemessen(lage, async () => [
        await frageAusDerSeite(lage.seite),
        await frageAusDerSeite(lage.seite),
      ]);
      nullZugriffe("direkte Wiederholung", wiederholt);
      for (const a of wiederholt.ergebnis) {
        abschaltauskunft("direkte Wiederholung", a);
      }
      expect(wiederholt.ergebnis[0]?.text).toBe(wiederholt.ergebnis[1]?.text);

      // ── 3. DIE VORBEREITETE KLARA-SITZUNG.
      const klara = await gemessen(lage, klaraFrage);
      nullZugriffe("vorbereitete Klara-Sitzung", klara);
      abschaltauskunft("vorbereitete Klara-Sitzung", {
        status: klara.ergebnis.statusCode,
        text: klara.ergebnis.body,
      });

      // ── 4. DIE FRISCHE FLÄCHE: neu geladen, sie sagt „abgeschaltet" — nicht „nicht verfügbar".
      await fragenflaecheOeffnen(lage.seite, lage.instanz.basis);
      await warte(
        lage.seite,
        `() => !!document.querySelector('[data-testid="ask-ki-abgeschaltet-hinweis"]')`,
        "die frische Fläche nennt die Abschaltung",
      );
      expect(await textVon(lage.seite, "ask-ki-abgeschaltet-hinweis")).toBe(
        d5kiaus.de["d5kiaus.hinweis"],
      );
      const frisch = await gemessen(lage, () => frageStellen(lage.seite, FRAGE));
      expect(frisch.ergebnis, "die frische Fläche liess die Frage trotz Abschaltung zu").toBe(
        "gesperrt",
      );
      nullZugriffe("frische Fläche", frisch);
      const seite = await seitentext(lage.seite);
      expect(seite, "die Fläche verwechselt Abschaltung und Störung").not.toContain(
        "KI nicht verfügbar — für diese Aufgabe ist kein Modell aktiv.",
      );

      // ── 5. K4 · DASSELBE LESERECHT, DERSELBE MENSCH: Eintrag und Original bleiben lesbar — über
      //       den bestehenden Bedienweg der Bibliothek: Leseansicht, Abschnitt „Anhänge" aufklappen,
      //       Anhang drücken (`MehrAbschnitte.tsx`, `data-bib-anhang` → `window.open` auf die
      //       Rohbyteroute). Der Klickhelfer und die Absagemessung sind die aus JOB 4304
      //       (`belegLinkBetaetigen`, `abrufAusDerSeite`); neu ist nur die Verknüpfung mit KI aus.
      //       RUNDE 2: der Klick ist PFLICHT. In Runde 1 stand er unter `if (hatAnhang)` und wurde
      //       übersprungen — der Abschnitt ist ein zugeklapptes `<details>`, dessen Inhalt erst beim
      //       Aufklappen entsteht.
      await lage.seite.goto(`${lage.instanz.basis}/wissen/${lage.koId}`, { waitUntil: "load" });
      await warte(
        lage.seite,
        `() => (document.body.innerText || "").includes(${JSON.stringify(BELEGSTELLE)})`,
        "die Leseansicht zeigt den freigegebenen Inhalt",
        undefined,
        45_000,
      );
      // Der Kopf der Leseansicht führt zu den Anhängen (`bib-sprung-anhaenge`): er klappt „Mehr"
      // auf und springt zum Abschnitt. Bleibt der Abschnitt zu, klappt der Mensch ihn selbst auf.
      await lage.seite.click('[data-testid="bib-sprung-anhaenge"]');
      await warte(
        lage.seite,
        `() => !!document.querySelector('[data-bib-abschnitt="anhaenge"]')`,
        "der Sprung „Anhänge“ führt zum Abschnitt",
      );
      // Der Sprung klappt den Abschnitt ASYNCHRON auf. Lauf 2 Runde 2 gemessen: ein sofortiges
      // Ablesen sah ihn noch zu, der eigene Klick auf `summary` schloss ihn dann wieder, und der
      // Anhangknopf verschwand beim Klicken aus dem DOM. Deshalb erst auf das Aufklappen warten; nur
      // wenn es ausbleibt, klappt der Mensch selbst auf — und es wird auf den OFFENEN Zustand gewartet.
      const offen = `() => document.querySelector('[data-bib-abschnitt="anhaenge"]')?.open === true`;
      const vonSelbstOffen = await warte(
        lage.seite,
        offen,
        "der Sprung klappt den Abschnitt auf",
        undefined,
        3_000,
      ).then(
        () => true,
        () => false,
      );
      if (!vonSelbstOffen) {
        await lage.seite.click('[data-bib-abschnitt="anhaenge"] > summary');
        await warte(lage.seite, offen, "der Abschnitt „Anhänge“ ist aufgeklappt");
      }
      const anhangKnopf = "[data-bib-anhang]";
      await warte(
        lage.seite,
        `() => !!document.querySelector('${anhangKnopf}')`,
        "der aufgeklappte Abschnitt „Anhänge“ zeigt den Anhang",
      );
      const klick = await belegLinkBetaetigen(lage.kontext, lage.seite, anhangKnopf);
      const geoeffnet = klick.art === "download" ? klick.inhalt : klick.neueFenster.join(" | ");
      process.stderr.write(
        `${JOB} H1 ANHANG GEDRÜCKT (KI aus): ${klick.art} · ${klick.abrufe.map((r) => `${r.url.replace(lage.instanz.basis, "")} → ${r.status}`).join(", ")}\n`,
      );
      expect(
        geoeffnet,
        "der Anhangknopf führte bei KI aus nicht zum vollständigen Original",
      ).toContain(ORIGINALTEXT);
      const roh = await abrufAusDerSeite(lage.seite, `/api/objects/${lage.objectId}/raw`);
      expect(roh.status, "die KI-Abschaltung hat nebenbei das Leserecht geschlossen").toBe(200);
      expect(roh.text).toBe(ORIGINALTEXT);

      // ── 6. DER AUSDRÜCKLICHE RECHTEENTZUG IST EIN ANDERER ZUSTAND. Er sperrt den Direktabruf UND
      //       den schon angezeigten Anhangknopf derselben, nicht neu geladenen Seite (der vorhandene
      //       Link) — und die KI-Abschaltung bleibt, was sie war.
      const hoch = await lage.instanz.app.inject({
        method: "PUT",
        url: `/api/kos/${lage.koId}`,
        headers: lage.admin.kopf,
        payload: { action: "confidentiality", level: "vertraulich" },
      });
      expect(hoch.statusCode, hoch.body).toBe(200);
      const gesperrt = await abrufAusDerSeite(lage.seite, `/api/objects/${lage.objectId}/raw`);
      const erfunden = await abrufAusDerSeite(lage.seite, "/api/objects/gibt-es-nicht-d5kiaus/raw");
      expect(gesperrt.status).toBe(404);
      expect(gesperrt.text).toBe(erfunden.text);
      const nachEntzug: Klickfolge = await belegLinkBetaetigen(
        lage.kontext,
        lage.seite,
        anhangKnopf,
        4_000,
      );
      const rohAbrufe = nachEntzug.abrufe.filter((r) =>
        r.url.includes(`/api/objects/${lage.objectId}/raw`),
      );
      process.stderr.write(
        `${JOB} H1 ANHANG NACH ENTZUG: ${nachEntzug.art} · ${rohAbrufe.map((r) => r.status).join(", ")}\n`,
      );
      expect(nachEntzug.art, "nach dem Entzug lieferte der vorhandene Knopf noch eine Datei").toBe(
        "kein-download",
      );
      expect(
        rohAbrufe.length,
        "der vorhandene Knopf löste keinen Abruf aus — dann misst der Klick nichts",
      ).toBeGreaterThan(0);
      for (const r of rohAbrufe) {
        expect(r.status, "nach dem Entzug antwortete die Rohbyteroute nicht mit der Absage").toBe(
          404,
        );
        expect(r.koerper.toString("utf8")).not.toContain(ORIGINALTEXT);
      }
      expect(
        (nachEntzug as Extract<Klickfolge, { art: "kein-download" }>).neueFenster.join(" | "),
      ).not.toContain(ORIGINALTEXT);
      await abschaltungBestaetigen(lage);
      process.stderr.write(`${JOB} H1 GRÜN · ${lage.db.name}\n`);
    } finally {
      await lage.abbauen();
    }
  }, 600_000);

  // ==============================================================================================
  // H2 · K3 — Bens Probe am echten Weg: die Frage aus der Fläche steht mit FERTIGEN SUCHTREFFERN
  //      (angehalten auf SQL-Ebene, NACH der Suchabfrage), der Administrator schaltet ab, dann läuft
  //      sie weiter. Danach: keine Anweisung an eine Inhaltstabelle, kein Ablagezugriff, keine
  //      Übergabe. Gegenprobe: ohne die Sperre der Vorauswahl erscheint genau das Nachladen der
  //      Kandidaten (`SELECT data FROM kos …`, `ko.listByIds`) — der Befund aus Runde 1.
  // ==============================================================================================
  const SUCHABFRAGE = /ko_search_projections[\s\S]*ILIKE/i;
  // Die Vorauswahl sucht je Begriff einzeln; angehalten wird die Abfrage des Begriffs, der den
  // Eintrag trägt — sonst folgt auf eine trefferlose Abfrage kein Nachladen, und die Gegenprobe
  // bewiese nichts.
  const TRAGENDER_BEGRIFF = /%xq42%/i;

  async function angehaltenAnDerSuche(lage: Lage, zyklus = false) {
    await fragenflaecheOeffnen(lage.seite, lage.instanz.basis);
    const halt = sql.anhaltenNach(SUCHABFRAGE, TRAGENDER_BEGRIFF);
    expect(await frageStellen(lage.seite, FRAGE)).toBe("gestellt");
    await halt.erreicht;
    await kiAusBestaetigt(lage);
    if (zyklus) {
      // K5 (Runde 3, Bens Befund): bestätigt WIEDER EIN, bevor die alte Frage weiterläuft.
      const an = await kiSchalten(lage, lage.admin, "auto");
      expect(an.statusCode, an.body).toBe(200);
      expect(lage.instanz.dienste.reasoner.kiAbschaltung().abgeschaltet).toBe(false);
    }
    return gemessen(lage, async () => {
      halt.freigeben();
      await ergebnisAbwarten(lage.seite);
      await ruhe(300);
    });
  }

  it("H2 · angehaltene Frage (Suchtreffer fertig): Abschaltung während sie steht → kein weiteres Lesen, Auskunft auf der Fläche (mit Gegenprobe)", async (ctx) => {
    if (!platz || !browser) {
      ueberspringen(ctx);
      return;
    }
    const lage = await fachlage("h2");
    try {
      await ausgangsfrage(lage);

      const nachAus = await angehaltenAnDerSuche(lage);
      process.stderr.write(
        `${JOB} H2 NACH FREIGABE: befund="${nachAus.befund}" · sql=${nachAus.sql.length}\n`,
      );
      nullZugriffe("angehaltene Frage nach der Freigabe", nachAus);
      expect(await textVon(lage.seite, "ask-ki-abgeschaltet")).toBe(
        `${d5kiaus.de["d5kiaus.titel"]}${d5kiaus.de["d5kiaus.text"]}`,
      );

      // DIE GEGENPROBE: dieselbe Lage, die Sperre der Vorauswahl heraus.
      await kiSchalten(lage, lage.admin, "auto");
      const rueckbau = sperreEntfernen(lage.instanz.dienste, new Set(["vorauswahl"]));
      let gegen: Awaited<ReturnType<typeof angehaltenAnDerSuche>>;
      try {
        gegen = await angehaltenAnDerSuche(lage);
      } finally {
        rueckbau();
      }
      process.stderr.write(
        `${JOB} H2 GEGENPROBE: befund="${gegen.befund}" · sql=${gegen.sql.slice(0, 2).join(" | ")}\n`,
      );
      expect(
        gegen.d.folge[0],
        "Gegenprobe: ohne Sperre der Vorauswahl las die angehaltene Frage nicht als Nächstes die Kandidaten",
      ).toBe("ko.listByIds");
      expect(
        gegen.sql.some((a) => /from kos\b/i.test(a)),
        "Gegenprobe: ohne Sperre sah der SQL-Mitschnitt das Nachladen der Kandidaten nicht",
      ).toBe(true);
      process.stderr.write(`${JOB} H2 GRÜN · ${lage.db.name}\n`);
    } finally {
      await lage.abbauen();
    }
  }, 600_000);

  // ==============================================================================================
  // H3 · K6 — Gegenprobe VOR DEM RETRIEVAL am echten Socket, mit Datenbankmitschnitt.
  // ==============================================================================================
  it("H3 · Gegenproben: ohne die Sperre vor dem Retrieval zählen Ablagen und PostgreSQL, ohne die vor der Übertragung der Modelldraht — mit ihnen nichts", async (ctx) => {
    if (!platz || !browser) {
      ueberspringen(ctx);
      return;
    }
    const lage = await fachlage("h3");
    try {
      await ausgangsfrage(lage);
      await kiAusBestaetigt(lage);
      // Lauf 5 Runde 2: `diensteinstieg` (die Route vor dem Dienst) liegt ebenfalls VOR dem Retrieval.
      const rueckbau = sperreEntfernen(
        lage.instanz.dienste,
        new Set(["diensteinstieg", "vorauswahl", "suchprojektion"]),
      );
      let gegen: Awaited<ReturnType<typeof gemessen<{ status: number; text: string }>>>;
      try {
        gegen = await gemessen(lage, () => frageAusDerSeite(lage.seite));
      } finally {
        rueckbau();
      }
      expect(
        gelesen(gegen.d),
        "Gegenprobe: ohne Sperre vor dem Retrieval blieben die Ablagen still",
      ).toBeGreaterThan(0);
      expect(gegen.befund, "Gegenprobe: die übrigen Sperren greifen weiter").not.toMatch(
        /antwortweg|modell/,
      );
      expect(
        gegen.sql.length,
        "Gegenprobe: ohne Sperre sah der SQL-Mitschnitt keinen Lesezugriff",
      ).toBeGreaterThan(0);
      process.stderr.write(`${JOB} H3 GEGENPROBE SQL: ${gegen.sql.slice(0, 3).join(" | ")}\n`);
      // Zurückgebaut: derselbe Aufruf, nichts gelesen.
      const wieder = await gemessen(lage, () => frageAusDerSeite(lage.seite));
      nullZugriffe("nach dem Rückbau der Gegenprobe", wieder);
      abschaltauskunft("nach dem Rückbau der Gegenprobe", wieder.ergebnis);

      // VOR DER ÜBERTRAGUNG: die Frage wartet auf den einzigen Modellplatz, als abgeschaltet wird.
      // Mit Sperre geht nichts an den Modelldraht — ohne sie (Gegenprobe) wohl.
      for (const gegenprobe of [false, true]) {
        await kiSchalten(lage, lage.admin, "auto");
        const modellplatz = modellplatzBelegen();
        const zurueck = gegenprobe
          ? sperreEntfernen(lage.instanz.dienste, new Set(["uebertragung"]))
          : () => undefined;
        try {
          const vorFrage = lage.grenzen.stand();
          const laufend = frageAusDerSeite(lage.seite);
          await vi.waitFor(
            () => {
              expect(lage.grenzen.stand().antwortweg).toBeGreaterThan(vorFrage.antwortweg);
            },
            { timeout: 30_000 },
          );
          await ruhe(100);
          expect(lage.grenzen.stand().modell, "die Frage wartete nicht vor der Übertragung").toBe(
            vorFrage.modell,
          );
          await kiAusBestaetigt(lage);
          const m = await gemessen(lage, async () => {
            modellplatz.freigeben();
            return laufend;
          });
          process.stderr.write(
            `${JOB} H3 ÜBERTRAGUNG${gegenprobe ? " (GEGENPROBE)" : ""}: befund="${m.befund}" · status=${m.ergebnis.status}\n`,
          );
          if (gegenprobe) {
            expect(
              m.d.modell,
              "Gegenprobe: ohne Sperre am Chokepoint blieb der Modelldraht still",
            ).toBeGreaterThan(0);
          } else {
            nullZugriffe("vor der Übertragung angehaltene Frage", m);
            abschaltauskunft("vor der Übertragung angehaltene Frage", m.ergebnis);
          }
        } finally {
          zurueck();
          modellplatz.abbauen();
        }
      }
      process.stderr.write(`${JOB} H3 GRÜN · ${lage.db.name}\n`);
    } finally {
      await lage.abbauen();
    }
  }, 600_000);

  // ==============================================================================================
  // H4 · K5 — Neustart erhält die Abschaltung; Unberechtigte schalten nicht; Wiedereinschalten
  //      holt nichts nach und öffnet nur den neuen Frageweg.
  // ==============================================================================================
  it("H4 · App-Neustart, unberechtigter Umschaltversuch, bewusstes Wiedereinschalten ohne Nachholzugriffe", async (ctx) => {
    if (!platz || !browser) {
      ueberspringen(ctx);
      return;
    }
    const lage = await fachlage("h4");
    try {
      await ausgangsfrage(lage);
      await kiAusBestaetigt(lage);
      // Eine Frage, die WÄHREND der Abschaltung abgewiesen wurde — sie darf später nicht nachlaufen.
      abschaltauskunft("vor dem Neustart", await frageAusDerSeite(lage.seite));

      await lage.neuStarten();
      await abschaltungBestaetigen(lage);
      const status = await lage.instanz.app.inject({
        method: "GET",
        url: "/api/reasoner/status",
        headers: lage.leser.kopf,
      });
      expect((status.json() as { kiAbgeschaltet?: boolean }).kiAbgeschaltet).toBe(true);
      await fragenflaecheOeffnen(lage.seite, lage.instanz.basis);
      await warte(
        lage.seite,
        `() => !!document.querySelector('[data-testid="ask-ki-abgeschaltet-hinweis"]')`,
        "nach dem Neustart nennt die Fläche die Abschaltung",
      );
      const nachNeustart = await gemessen(lage, () => frageAusDerSeite(lage.seite));
      nullZugriffe("nach dem Neustart", nachNeustart);
      abschaltauskunft("nach dem Neustart", nachNeustart.ergebnis);

      // Unberechtigt: der Leser kann die KI nicht wieder einschalten.
      const versuch = await kiSchalten(lage, lage.leser, "auto");
      expect(versuch.statusCode, "ein Leser konnte umschalten").toBe(403);
      await abschaltungBestaetigen(lage);

      // Bewusstes Wiedereinschalten durch den Administrator — und danach: NICHTS läuft nach.
      const still = await gemessen(lage, async () => {
        const an = await kiSchalten(lage, lage.admin, "auto");
        expect(an.statusCode, an.body).toBe(200);
        await new Promise((r) => setTimeout(r, 1_000));
      });
      expect(still.befund, "das Wiedereinschalten hat eine alte Frage still nachgeholt").toBe("");
      expect(still.sql, "das Wiedereinschalten hat Inhaltstabellen gelesen").toEqual([]);
      expect(lage.instanz.dienste.reasoner.kiAbschaltung().abgeschaltet).toBe(false);

      // Erst eine NEUE Frage über die Fläche geht den Weg wieder — nach den bestehenden Regeln.
      await ausgangsfrage(lage);

      // K5 · DIE ALTE, NOCH WARTENDE FRAGE (Bens Befund aus Runde 2): angehalten nach der
      // Suchabfrage, bestätigt aus- UND wieder eingeschaltet, dann freigegeben. Sie bleibt entwertet:
      // keine Anweisung an eine Inhaltstabelle, kein Ablagezugriff, keine Quelle auf der Fläche.
      const alt = await angehaltenAnDerSuche(lage, true);
      process.stderr.write(
        `${JOB} H4 ALTE FRAGE NACH AUS/EIN: befund="${alt.befund}" · sql=${alt.sql.length}\n`,
      );
      nullZugriffe("alte Frage nach Aus- und Wiedereinschalten", alt);
      expect(await textVon(lage.seite, "ask-ki-abgeschaltet")).not.toBeNull();
      // Und die KI ist an: die nächste NEUE Frage trägt wieder.
      await ausgangsfrage(lage);
      process.stderr.write(`${JOB} H4 GRÜN · ${lage.db.name}\n`);
    } finally {
      await lage.abbauen();
    }
  }, 600_000);

  // ==============================================================================================
  // H5 · K6 — die Auskunft auf Englisch und Niederländisch, an Fläche und Server.
  // ==============================================================================================
  for (const sprache of ["en", "nl"] as const) {
    it(`H5 · ${sprache.toUpperCase()}: die Fläche und der Server sagen die Abschaltung verständlich`, async (ctx) => {
      if (!platz || !browser) {
        ueberspringen(ctx);
        return;
      }
      const lage = await fachlage(`h5${sprache}`, sprache);
      try {
        await ausgangsfrage(lage);
        await kiAusBestaetigt(lage);
        await fragenflaecheOeffnen(lage.seite, lage.instanz.basis);
        await warte(
          lage.seite,
          `() => !!document.querySelector('[data-testid="ask-ki-abgeschaltet-hinweis"]')`,
          `die Fläche (${sprache}) nennt die Abschaltung`,
        );
        expect(await textVon(lage.seite, "ask-ki-abgeschaltet-hinweis")).toBe(
          d5kiaus[sprache]["d5kiaus.hinweis"],
        );
        const m = await gemessen(lage, () => frageAusDerSeite(lage.seite, sprache));
        nullZugriffe(`Server (${sprache})`, m);
        abschaltauskunft(`Server (${sprache})`, m.ergebnis);
        expect((JSON.parse(m.ergebnis.text) as { message: string }).message).toContain(
          sprache === "en" ? "administrator" : "beheerder",
        );
        const zweiter = await gemessen(lage, () =>
          lage.seite.evaluate<{ status: number; text: string }>(fn(POST_REASONER_ASK), {
            frage: FRAGE,
            sprache,
          }),
        );
        nullZugriffe(`zweiter Eingang /api/reasoner (${sprache})`, zweiter);
        abschaltauskunft(`zweiter Eingang /api/reasoner (${sprache})`, zweiter.ergebnis);
        expect(zweiter.ergebnis.text, "beide Eingänge geben dieselbe Auskunft").toBe(
          m.ergebnis.text,
        );
        process.stderr.write(`${JOB} H5 ${sprache} GRÜN · ${lage.db.name}\n`);
      } finally {
        await lage.abbauen();
      }
    }, 600_000);
  }

  // ==============================================================================================
  // H6 · K3 · K5 — INNERHALB der PostgreSQL-Beleg- und Lückenablage (Lauf 3, Bens Befund R1).
  // ==============================================================================================
  // `appendSnapshot` führt vier Anweisungen aus, `insertOrIncrement` zwei — mit Warten dazwischen.
  // Angehalten wird NACH einer Anweisung (auf SQL-Ebene, `sql.anhaltenNach`), dann bestätigt aus
  // (bzw. aus UND wieder ein), dann freigegeben: danach darf keine Inhaltstabelle mehr berührt
  // werden. Die Gegenprobe ohne die Sperre „ergebnis" zeigt genau die nächste Anweisung.
  it("H6 · angehalten zwischen den Anweisungen der Beleg- und Lückenablage: nach KI-aus (auch Aus/Ein) keine weitere Anweisung — mit Gegenproben", async (ctx) => {
    if (!platz || !browser) {
      ueberspringen(ctx);
      return;
    }
    const lage = await fachlage("h6");
    const FAELLE = [
      { nach: /SELECT data FROM answer_records/, frage: FRAGE, naechste: /^SELECT count\(\*\)/i },
      {
        nach: /SELECT count\(\*\)::text AS n FROM answer_snapshots/,
        frage: FRAGE,
        naechste: /^SELECT data FROM answer_snapshots/i,
      },
      {
        nach: /SELECT data FROM answer_snapshots WHERE answer_id = \$1$/,
        frage: FRAGE,
        naechste: /^INSERT INTO answer_snapshots/i,
      },
      { nach: /INSERT INTO gaps/, frage: "XQ42", naechste: /^UPDATE gaps/i },
    ] as const;
    try {
      await ausgangsfrage(lage);
      // Die offene Lücke, die der Lückenfall danach hochzählen würde (Zweig nach dem Konflikt).
      await kiSchalten(lage, lage.admin, "auto");
      expect((await frageAusDerSeite(lage.seite, "de", "XQ42")).status).toBe(200);
      const vorhanden = await lage.db.pool.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM gaps WHERE (data->>'status') = 'offen'",
      );
      expect(Number(vorhanden.rows[0]?.n), "Vorrichtung: keine offene Lücke").toBeGreaterThan(0);

      for (const fall of FAELLE) {
        for (const art of ["aus", "aus-ein", "gegenprobe"] as const) {
          await kiSchalten(lage, lage.admin, "auto");
          const rueckbau =
            art === "gegenprobe"
              ? sperreEntfernen(lage.instanz.dienste, new Set(["ergebnis"]))
              : () => undefined;
          try {
            const halt = sql.anhaltenNach(fall.nach);
            const laufend = frageAusDerSeite(lage.seite, "de", fall.frage);
            await halt.erreicht;
            await kiAusBestaetigt(lage);
            if (art === "aus-ein") {
              const an = await kiSchalten(lage, lage.admin, "auto");
              expect(an.statusCode, an.body).toBe(200);
            }
            const m = await gemessen(lage, async () => {
              halt.freigeben();
              return laufend;
            });
            process.stderr.write(
              `${JOB} H6 ${fall.nach.source} · ${art}: status=${m.ergebnis.status} · sql=${m.sql.slice(0, 2).join(" | ")}\n`,
            );
            if (art === "gegenprobe") {
              expect(
                m.sql[0] ?? "(keine Anweisung)",
                `Gegenprobe: ohne die Sperre „ergebnis" lief nach ${fall.nach.source} nicht die nächste Anweisung`,
              ).toMatch(fall.naechste);
            } else {
              expect(
                m.sql,
                `nach ${fall.nach.source} (${art}) wurden Inhaltstabellen weiter berührt`,
              ).toEqual([]);
              abschaltauskunft(`H6 ${fall.nach.source} (${art})`, m.ergebnis);
            }
          } finally {
            rueckbau();
          }
        }
      }
      process.stderr.write(`${JOB} H6 GRÜN · ${lage.db.name}\n`);
    } finally {
      await lage.abbauen();
    }
  }, 600_000);
});
