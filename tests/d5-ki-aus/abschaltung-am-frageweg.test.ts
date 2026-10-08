import type { Pool } from "pg";
// ================================================================================================
// D5 · KI AUS — DER FRAGEWEG LIEST NACH DER ADMINISTRATIVEN ABSCHALTUNG KEINEN KUNDENINHALT MEHR.
// ================================================================================================
//
// Dieselbe App wie im Betrieb (`buildServices` → `buildApp`), derselbe Bestand und dieselben
// Handgriffe wie der D5-Gesamtweg (`tests/klara-quellen-nutzerweg/kette.ts`), dazu die Zähler aus
// `./zaehler.ts` an den Ablagen (unterhalb der Dienste), am Antwortweg und am Modelldraht. Die
// Fläche und PostgreSQL misst
// `tests/d5-gesamtweg/ki-aus-pg-browser.integration.test.ts`; hier stehen die Fälle, die man nur
// von innen herstellen kann — eine ANGEHALTENE Ausführung und die Gegenproben am einzelnen Schritt.
//
// WAS „KI AUS" HIER IST (K1): der bestehende Adminweg `PUT /api/reasoner/config` mit
// `global: "deterministic"`, gespeichert in der Policyablage, abgelesen als
// `configStatus().kiAbschaltung` / `publicStatus().kiAbgeschaltet`. Die drei Nachbarlagen, in denen
// auch kein Modell rechnet, sind KEINE Abschaltung und werden in A2 einzeln dagegengehalten.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import d5kiaus from "../../apps/web/src/texte/d5kiaus";
import { type AppServices, buildServices } from "../../services/app/src/build-app";
import { PgAnswerSnapshotRepo, PgGapRepo } from "../../services/ask";
import { DeterministicProvider } from "../../services/reasoner/src/provider";
import type { ReasonerPolicyRepo } from "../../services/reasoner/src/reasoner-policy";
import { Reasoner } from "../../services/reasoner/src/service";
import { preisgabeImText, verboteneStuecke } from "../d5-gesamtweg/preisgabe";
import {
  type Aufbau,
  BELEGSTELLE,
  type Draht,
  FRAGE,
  type Konto,
  ORIGINALNAME,
  ORIGINALTEXT,
  adapterUmgebungSetzen,
  appAufbauen,
  drahtAufbauen,
  eintragMitOriginal,
  fragen,
  neuesKonto,
  originalLesen,
} from "../klara-quellen-nutzerweg/kette";
import {
  ALLE_GRENZEN,
  type Grenzen,
  type Pruefpunkt,
  differenz,
  frageAnfragenMarkieren,
  gelesen,
  grenzenZaehlen,
  modellplatzBelegen,
  ruhe,
  sperreEntfernen,
  zugriffsbefund,
} from "./zaehler";

adapterUmgebungSetzen();

const TITEL = "Zylinderkopfdichtung XQ42 wechseln (D5 KI aus)";
const PARTNER_TITEL = "Kühlmittelpumpe KP7 entlüften";
const PARTNER_AUSSAGE =
  "Kühlmittelpumpe KP7: Entlüftungsschraube öffnen, bis Kühlmittel blasenfrei austritt.";

let draht: Draht;
let aufbau: Aufbau | null = null;
let grenzen: Grenzen | null = null;

beforeAll(() => {
  draht = drahtAufbauen();
});

afterAll(() => {
  draht.abbauen();
});

afterEach(async () => {
  grenzen?.abbauen();
  grenzen = null;
  if (aufbau) {
    await aufbau.app.close();
    aufbau = null;
  }
  draht.setzeApp(null);
  draht.lage.generierungen = 0;
  draht.lage.vorlagen.length = 0;
});

interface Lage {
  aufbau: Aufbau;
  dienste: AppServices;
  leser: Konto;
  koId: string;
  objectId: string;
  grenzen: Grenzen;
}

/**
 * Die Kette der Ablagezugriffe einer getragenen Frage, in dieser Reihenfolge (als Teilfolge): die
 * Suche (gezählt beim Eintritt, darin Control-State, Bestand und Metadaten), das Nachladen der
 * Kandidaten, Objekt und Dokumenttext, der Beleg. Auf genau diese Punkte setzen die Haltefälle unten
 * — die Kalibrierung zeigt, dass es sie gibt und dass sie in dieser Reihenfolge durchlaufen werden.
 */
const KETTE = [
  "suchprojektion.findActive",
  "suchprojektion.controlState",
  "ko.listForSearch",
  "metadaten.findMany",
  "ko.listByIds",
  "ko.findById",
  "suchprojektion.find",
] as const;

function istTeilfolge(kette: readonly string[], folge: readonly string[]): boolean {
  let i = 0;
  for (const punkt of folge) {
    if (punkt === kette[i]) {
      i += 1;
    }
  }
  return i === kette.length;
}

/** Ausgangspunkt (K1): eigene synthetische Quelle, und eine Frage, die WIRKLICH getragen hat. */
async function vorrichtung(): Promise<Lage> {
  let dienste: AppServices | undefined;
  const a = await appAufbauen(
    false,
    () => {
      dienste = buildServices();
      return dienste;
    },
    frageAnfragenMarkieren,
  );
  aufbau = a;
  draht.setzeApp(a.app);
  const d = dienste as AppServices;
  const g = grenzenZaehlen(d, draht);
  grenzen = g;
  const eintrag = await eintragMitOriginal(a.app, a.admin, { titel: TITEL });
  // Bens Runde-3-Befund (Lauf 1): ein GESPEICHERTER, versionsgebundener Konflikt am Eintrag. Erst mit
  // ihm prüft die Route beim Konfliktabruf die aktuellen Fassungen beider Seiten — und liest dafür
  // die Wissensobjekte selbst (`ConflictService.unresolved` → `isBoundToCurrentVersions` → `ko.get`).
  // Der Partner teilt mit der Frage kein Wort, damit er weder Kandidat noch Quelle wird.
  const partner = await eintragMitOriginal(a.app, a.admin, {
    titel: PARTNER_TITEL,
    kernaussage: PARTNER_AUSSAGE,
    originaltext: PARTNER_AUSSAGE,
    quelle: { label: "Wartungsblatt KP7", excerpt: PARTNER_AUSSAGE },
  });
  const fassungA = (await d.ko.get(eintrag.koId))?.version;
  const fassungB = (await d.ko.get(partner.koId))?.version;
  expect(fassungA !== undefined && fassungB !== undefined, "Vorrichtung: Fassungen fehlen").toBe(
    true,
  );
  await d.conflicts.createAuto(
    {
      koA: eintrag.koId,
      koB: partner.koId,
      type: "truth",
      description: "D5-Vorrichtung: versionsgebundener Konflikt",
      koAVersion: fassungA as number,
      koBVersion: fassungB as number,
    },
    { trigger: "background", method: "deterministic" },
  );
  const leser = await neuesKonto(a.app, "d5-kiaus-leser", a.admin);

  const vorher = g.stand();
  const antwort = await fragen(a.app, leser);
  const d0 = differenz(vorher, g.stand());
  expect(antwort.status, `Ausgangspunkt: die Frage trug nicht — ${antwort.roh.slice(0, 300)}`).toBe(
    200,
  );
  expect(
    antwort.citedSources,
    "Ausgangspunkt: die eigene Quelle trägt die Antwort nicht",
  ).toContain(eintrag.koId);
  // KALIBRIERUNG: jede Grenze, deren Nullbleiben später etwas beweisen soll, hat hier gezählt —
  // und die Ablagen in der Reihenfolge, auf die die Haltefälle setzen.
  expect(
    istTeilfolge(KETTE, d0.folge),
    `Kalibrierung: die Ablagezugriffe der Ausgangsfrage folgen nicht der Kette ${KETTE.join(" → ")}; gezählt: ${d0.folge.join(" → ")}`,
  ).toBe(true);
  expect(
    d0.folge.some((p) => p.startsWith("belege.")),
    `Kalibrierung: der Antwortbeleg wurde nicht gezählt — ${d0.folge.join(" → ")}`,
  ).toBe(true);
  // Der Konfliktabruf der Route liest danach beide Konfliktseiten für die Versionsprüfung.
  const nachKonflikten = d0.folge.slice(d0.folge.indexOf("konflikte.all") + 1);
  expect(
    d0.folge.includes("konflikte.all") ? nachKonflikten : d0.folge,
    `Kalibrierung: die Versionsprüfung des Konfliktabrufs las die beiden Seiten nicht — ${d0.folge.join(" → ")}`,
  ).toEqual(["ko.findById", "ko.findById"]);
  expect(
    d0.folge.filter((p) => p === "ko.findById").length,
    `Kalibrierung: die Haltefälle zählen ko.findById 1 (Dokumenttext), 2 (Quelle der Route), 3–4 (Konfliktseiten) — ${d0.folge.join(" → ")}`,
  ).toBe(4);
  expect(d0.antwortweg, "Kalibrierung: der Antwortweg wurde nicht gezählt").toBeGreaterThan(0);
  expect(d0.modell, "Kalibrierung: der Modelldraht hat nicht generiert").toBeGreaterThan(0);
  return {
    aufbau: a,
    dienste: d,
    leser,
    koId: eintrag.koId,
    objectId: eintrag.objectId,
    grenzen: g,
  };
}

async function kiSetzen(l: Lage, konto: Konto, global: string) {
  return l.aufbau.app.inject({
    method: "PUT",
    url: "/api/reasoner/config",
    headers: konto.kopf,
    payload: { global },
  });
}

async function kiAus(l: Lage): Promise<void> {
  const res = await kiSetzen(l, l.aufbau.admin, "deterministic");
  expect(res.statusCode, `die Abschaltung durch den Administrator scheiterte: ${res.body}`).toBe(
    200,
  );
  const cfg = await l.aufbau.app.inject({
    method: "GET",
    url: "/api/reasoner/config",
    headers: l.aufbau.admin.kopf,
  });
  // BESTÄTIGT, nicht angenommen: der gespeicherte Zustand meldet die Abschaltung.
  expect((cfg.json() as { kiAbschaltung: unknown }).kiAbschaltung).toEqual({
    abgeschaltet: true,
    wahl: "deterministic",
    quelle: "db",
  });
}

/** Die Absage muss VERSTÄNDLICH sein und darf nichts aus dem Bestand tragen. */
function abschaltauskunftPruefen(status: number, rumpf: string, sprache: "de" | "en" | "nl"): void {
  expect(status, `statt der Abschaltauskunft kam: ${rumpf.slice(0, 300)}`).toBe(503);
  const koerper = JSON.parse(rumpf) as { error: string; message: string };
  expect(koerper.error).toBe("KI_ABGESCHALTET");
  const erwartet = { de: "Administrator", en: "administrator", nl: "beheerder" }[sprache];
  expect(koerper.message, "die Auskunft nennt nicht, wer abgeschaltet hat").toContain(erwartet);
  const durch = preisgabeImText(
    rumpf,
    verboteneStuecke({
      name: ORIGINALNAME,
      titel: TITEL,
      auszug: BELEGSTELLE,
      original: Buffer.from(ORIGINALTEXT, "utf8"),
      bereitsErhalten: [],
    }),
  );
  expect(durch.map((s) => s.was).join(" · "), "die Abschaltauskunft trägt Kundeninhalt").toBe("");
}

describe("D5 · KI aus — K1 · der benannte Adminzustand und seine Abgrenzung", () => {
  it("A1 · Name, API und gespeicherte Policy: PUT deterministic → kiAbschaltung, öffentlicher Status", async () => {
    const l = await vorrichtung();
    await kiAus(l);
    const oeffentlich = await l.aufbau.app.inject({
      method: "GET",
      url: "/api/reasoner/status",
      headers: l.leser.kopf,
    });
    expect(oeffentlich.statusCode).toBe(200);
    expect((oeffentlich.json() as { kiAbgeschaltet?: boolean }).kiAbgeschaltet).toBe(true);
    // Die Policy steht in der Ablage — nicht nur in der Laufzeit.
    const gespeichert = await (
      l.dienste as unknown as { reasoner: { policyRepo: ReasonerPolicyRepo } }
    ).reasoner.policyRepo.get();
    expect(gespeichert?.global).toBe("deterministic");
  });

  it("A2 · KEINE Abschaltung: fehlende Freigabe, kein Modell, Ladefehler, Deploy-Vorgabe", async () => {
    // Fehlende Freigabe für öffentliche KI und ein laufender lokaler Adapter: das ist der
    // Ausgangszustand der Vorrichtung — die Frage trägt, und niemand hat abgeschaltet. Dass hier
    // keine Freigabe erteilt ist, belegt der Freigabe-Wächter (JOB 3550, F1/F2) für den ganzen Baum;
    // diese Datei nennt die Freigabefelder deshalb bewusst nicht.
    const l = await vorrichtung();
    expect(l.dienste.reasoner.kiAbschaltung().abgeschaltet).toBe(false);

    // Kein Modell eingerichtet („auto" fällt auf den Ersatz): keine Abschaltung.
    const ohneModell = new Reasoner(undefined, new DeterministicProvider());
    expect(ohneModell.status().mode).toBe("deterministic");
    expect(ohneModell.kiAbschaltung()).toEqual({
      abgeschaltet: false,
      wahl: "auto",
      quelle: "default",
    });

    // Ladefehler beim Start (fail-closed auf deterministic): eine Störung, keine Adminentscheidung.
    const kaputt: ReasonerPolicyRepo = {
      get: () => Promise.reject(new Error("db read down")),
      set: async () => undefined,
    };
    const geladen = new Reasoner(
      undefined,
      new DeterministicProvider(),
      undefined,
      undefined,
      undefined,
      kaputt,
    );
    expect((await geladen.loadPersistedPolicy()).source).toBe("load-error");
    expect(geladen.kiAbschaltung()).toEqual({
      abgeschaltet: false,
      wahl: "deterministic",
      quelle: "default",
    });

    // Deploy-Vorgabe über die Umgebung: steht nicht in der gespeicherten Adminwahl.
    const deploy = new Reasoner(undefined, new DeterministicProvider());
    expect((await deploy.loadPersistedPolicy({ envGlobal: "deterministic" })).source).toBe("env");
    expect(deploy.kiAbschaltung().abgeschaltet).toBe(false);
  });
});

describe("D5 · KI aus — K2 · frische, vorbereitete und wiederholte Frage", () => {
  it("B1 · frische Frage, Wiederholung desselben Aufrufs, Klara-Sitzung und Reasoner-Weg: Auskunft, null Zugriffe", async () => {
    const l = await vorrichtung();
    // VORBEREITET, solange die KI noch an ist: eine Klara-Sitzung mit Bindung, einmal benutzt.
    const angelegt = await l.aufbau.app.inject({
      method: "POST",
      url: "/api/klara/sessions",
      headers: l.leser.kopf,
      payload: {
        addinInstanceId: "d5-kiaus-instanz",
        documentDescriptor: { kind: "saved", hostDocumentId: "d5-kiaus-doc" },
      },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const sitzung = angelegt.json() as { sessionId: string; documentContextId: string };
    const bindung = {
      ...l.leser.kopf,
      "content-type": "application/json",
      "x-klara-session": sitzung.sessionId,
      "x-klara-instance": "d5-kiaus-instanz",
      "x-klara-document": sitzung.documentContextId,
    };
    // R-0700: die Klara-Frage geht über Klaras eigenen, sitzungsgebundenen Zugang.
    const klaraFrage = () =>
      l.aufbau.app.inject({
        method: "POST",
        url: `/api/klara/sessions/${sitzung.sessionId}/execute`,
        headers: bindung,
        payload: { question: FRAGE, locale: "de" },
      });
    const vorbereitet = await klaraFrage();
    expect(vorbereitet.statusCode, `die vorbereitete Sitzung trug nicht: ${vorbereitet.body}`).toBe(
      200,
    );

    await kiAus(l);
    const vorher = l.grenzen.stand();

    // Frisch, dann DERSELBE Aufruf zweimal direkt wiederholt.
    const antworten = [];
    for (let i = 0; i < 3; i += 1) {
      antworten.push(
        await l.aufbau.app.inject({
          method: "POST",
          url: "/api/ask",
          headers: { ...l.leser.kopf, "content-type": "application/json" },
          payload: { question: FRAGE, locale: "de" },
        }),
      );
    }
    // Die vorbereitete Klara-Sitzung und der zweite Eingang (`POST /api/reasoner`, Aufgabe ask).
    antworten.push(await klaraFrage());
    antworten.push(
      await l.aufbau.app.inject({
        method: "POST",
        url: "/api/reasoner",
        headers: { ...l.leser.kopf, "content-type": "application/json" },
        payload: { task: "ask", text: FRAGE, locale: "de" },
      }),
    );
    for (const a of antworten) {
      abschaltauskunftPruefen(a.statusCode, a.body, "de");
    }
    // Wiederholung ist BYTEGLEICH — und unabhängig vom Fragetext.
    const andere = await l.aufbau.app.inject({
      method: "POST",
      url: "/api/ask",
      headers: { ...l.leser.kopf, "content-type": "application/json" },
      payload: { question: "Welche Schrauben hat die XQ42?", locale: "de" },
    });
    expect(new Set([...antworten.slice(0, 3), andere].map((a) => a.body)).size).toBe(1);

    expect(
      zugriffsbefund(differenz(vorher, l.grenzen.stand()), ALLE_GRENZEN),
      "nach der bestätigten Abschaltung wurde trotzdem Kundeninhalt gelesen oder weitergegeben",
    ).toBe("");
  });

  it("B2 · DE/EN/NL: die Auskunft ist in jeder Sprache verständlich und passt zur Fläche", async () => {
    const l = await vorrichtung();
    await kiAus(l);
    for (const sprache of ["de", "en", "nl"] as const) {
      const res = await l.aufbau.app.inject({
        method: "POST",
        url: "/api/ask",
        headers: { ...l.leser.kopf, "content-type": "application/json" },
        payload: { question: FRAGE, locale: sprache },
      });
      abschaltauskunftPruefen(res.statusCode, res.body, sprache);
      // Der zweite Eingang sagt dasselbe in derselben Sprache — auch NL, obwohl er die Antwort
      // selbst nur auf DE/EN führt (Bens Befund Lauf 2 Runde 1).
      const zweiter = await fragenUeberReasoner(l, FRAGE, sprache);
      abschaltauskunftPruefen(zweiter.status, zweiter.roh, sprache);
      expect(zweiter.roh, "beide Eingänge geben dieselbe Auskunft").toBe(res.body);
      // Die Fläche hat ihre eigenen Sätze; beide sagen dasselbe Wesentliche.
      expect(d5kiaus[sprache]["d5kiaus.text"]).toContain(
        { de: "Administrator", en: "administrator", nl: "beheerder" }[sprache],
      );
    }
  });
});

// ================================================================================================
// K3 · ANGEHALTENE AUSFÜHRUNGEN — AN JEDEM WARTEPUNKT DES FRAGEWEGS.
// ================================================================================================
//
// Jeder Haltepunkt ist ein Ablagezugriff (oder die Antwort), NACH dem der Frageweg wartet. Die Frage
// liest dort, bleibt stehen, der Administrator schaltet ab (bestätigt), dann läuft sie weiter. Was
// danach noch gelesen, übergeben oder übertragen wird, geschah nach der bestätigten Abschaltung —
// es muss null sein. Zu JEDEM Haltepunkt gehört eine Gegenprobe: ohne die benannte Sperre erscheint
// genau der nächste Zugriff, den sie verhindert (`naechster`). Der zweite Fall ist Bens Probe aus
// Runde 1 (Suchtreffer angehalten → danach `listByIds`).
/**
 * Eine Frage, die den Eintrag FINDET, aber keine Antwort trägt (gemessen: ein einzelner Begriff
 * genügt dem Antwortweg nicht). Sie läuft über Torlage, Beleg und Lücke — die Schritte nach der
 * Antwort, die eine getragene Frage nicht alle berührt.
 */
const UNBEANTWORTET = "XQ42";

interface Haltefall {
  punkt: string;
  /** Das wievielte Auftreten des Punktes in dieser Frage (Vorgabe: das erste). */
  mal?: number;
  /** Die Frage — Vorgabe `FRAGE` (getragen); `UNBEANTWORTET` für den Weg über Torlage und Lücke. */
  frage?: string;
  wo: string;
  sperre: readonly Pruefpunkt[];
  /**
   * Nur `/api/ask`: der Haltepunkt liegt im Nachlesen der Route (Quellen, Konflikte) oder im
   * Volltext-Blick der Torlage, den nur diese Route anfordert (`verschlossenSichtbarFuer`, ask-
   * routes.ts). `POST /api/reasoner` (Aufgabe `ask`) hat diese Schritte nicht — gemessen: dort tritt
   * kein zweites `suchprojektion.find` auf, der Halt würde nie erreicht.
   */
  nurRoute?: true;
  /** Woran die Gegenprobe den durchgelassenen nächsten Schritt erkennt. */
  naechster: { lesen: RegExp } | { antwortweg: true } | { ausgeliefert: true };
}

const HALTEFAELLE: readonly Haltefall[] = [
  {
    punkt: "suchprojektion.controlState",
    wo: "in der Suche, nach dem Control-State",
    sperre: ["vorauswahl"],
    naechster: { lesen: /^ko\.listForSearch$/ },
  },
  {
    punkt: "suchprojektion.findActive",
    wo: "mit fertigen Suchtreffern (Bens Probe)",
    sperre: ["vorauswahl"],
    naechster: { lesen: /^ko\.listByIds$/ },
  },
  // Lauf 3: seit der Prüfbasis-Aktualität (AUFNAHME 20260922) liest die Lesefassung der Kandidaten
  // nach `listByIds` noch den Schreibstand der Ablage (und bei verändertem Stand den ganzen Bestand,
  // `KoService.pruefbestandStempel`). Die Sperre „vorauswahl" steht deshalb auch dort.
  {
    punkt: "ko.listByIds",
    wo: "mit nachgeladenen Kandidaten, vor ihrer Lesefassung",
    sperre: ["vorauswahl"],
    naechster: { lesen: /^ko\.anhangSchreibstand$/ },
  },
  {
    // Das dritte Auftreten: die letzte der drei parallelen Begriffsabfragen — danach geht die Frage
    // geschlossen zum Dokumenttext weiter.
    punkt: "ko.anhangSchreibstand",
    mal: 3,
    wo: "mit gestempelten Kandidaten, vor dem Dokumenttext",
    sperre: ["vorauswahl", "suchprojektion"],
    naechster: { lesen: /^ko\.findById$/ },
  },
  {
    punkt: "ko.findById",
    wo: "zwischen Objekt und Dokumenttext",
    sperre: ["suchprojektion"],
    naechster: { lesen: /^suchprojektion\.find$/ },
  },
  {
    punkt: "suchprojektion.find",
    wo: "mit gelesenem Dokumenttext, vor der Übergabe",
    sperre: ["antwortweg"],
    naechster: { antwortweg: true },
  },
  {
    punkt: "antwort",
    wo: "mit fertiger Antwort, vor Beleg und Auslieferung",
    sperre: ["ergebnis", "auslieferung"],
    naechster: { lesen: /^belege\./ },
  },
  // Runde 3, Bens Befund: zwischen den beiden Schreibaufrufen des Belegs liegt ein Warten.
  {
    punkt: "belege.createRecord",
    wo: "zwischen den beiden Schreibaufrufen des Belegs",
    sperre: ["ergebnis"],
    naechster: { lesen: /^belege\.appendSnapshot$/ },
  },
  {
    punkt: "belege.listSnapshots",
    // Lauf 3 Runde 2: dieser Halt liegt IN `appendSnapshot` (Revisionskette gelesen, noch nicht
    // eingefügt) — dort greift seitdem die mitgereiste Sperre „ergebnis" vor dem Einfügen, danach
    // die Route mit „auslieferung". Die Gegenprobe nimmt deshalb beide heraus.
    wo: "im Beleg nach der Revisionskette, vor Einfügen und Nachlesen der Quellen in der Route",
    sperre: ["ergebnis", "auslieferung"],
    naechster: { lesen: /^ko\.findById$/ },
  },
  // Runde 3, Bens Befund: die Route liest nach den Quellen die offenen Konflikte — und liefert aus.
  {
    punkt: "ko.findById",
    mal: 2,
    nurRoute: true,
    wo: "beim Quellenlesen der Route, vor der Lesefassung der Quelle",
    sperre: ["auslieferung"],
    naechster: { lesen: /^ko\.anhangSchreibstand$/ },
  },
  {
    punkt: "ko.anhangSchreibstand",
    mal: 4,
    nurRoute: true,
    wo: "in der Lesefassung der Quelle, vor dem Konfliktabruf",
    sperre: ["auslieferung"],
    naechster: { lesen: /^konflikte\./ },
  },
  // Bens Runde-3-Befund (Lauf 1): nach dem Konfliktabruf liest die Versionsprüfung noch beide
  // Konfliktseiten (`ko.findById` Nr. 3 und 4) — erst danach wird ausgeliefert.
  {
    punkt: "konflikte.all",
    nurRoute: true,
    wo: "nach dem Konfliktabruf, vor der Versionsprüfung der Konfliktseiten",
    sperre: ["auslieferung"],
    naechster: { lesen: /^ko\.findById$/ },
  },
  {
    punkt: "ko.findById",
    mal: 3,
    nurRoute: true,
    wo: "in der Versionsprüfung, zwischen den beiden Konfliktseiten",
    sperre: ["auslieferung"],
    naechster: { lesen: /^ko\.findById$/ },
  },
  {
    punkt: "ko.findById",
    mal: 4,
    nurRoute: true,
    wo: "nach der Versionsprüfung, vor der Auslieferung",
    sperre: ["auslieferung"],
    naechster: { ausgeliefert: true },
  },
  // Der Weg einer UNBEANTWORTETEN Frage: nach der Antwort liest der Dienst für die Torlage
  // (`verschlossen`) ein zweites Mal Objekt und Dokumenttext, legt den Beleg ab und dann die Lücke.
  {
    punkt: "suchprojektion.find",
    mal: 2,
    nurRoute: true,
    frage: UNBEANTWORTET,
    wo: "nach dem Volltext-Blick der Torlage, vor dem Beleg",
    sperre: ["ergebnis"],
    naechster: { lesen: /^belege\./ },
  },
  {
    punkt: "belege.listSnapshots",
    frage: UNBEANTWORTET,
    wo: "nach dem Beleg einer unbeantworteten Frage, vor der Lücke",
    sperre: ["ergebnis"],
    naechster: { lesen: /^luecken\./ },
  },
];

/** Die beiden D5-Eingänge desselben Fragedienstes. */
type Eingang = "ask" | "reasoner";

/**
 * Der zweite Eingang: `POST /api/reasoner` mit Aufgabe `ask` (reasoner-routes.ts) — derselbe
 * `AskService.ask`, aber ohne das Nachlesen der Route. Bens Befund Lauf 2 Runde 1: die Haltefälle
 * liefen nur über `/api/ask`, und dieser Eingang lieferte eine angehaltene Frage nach KI-aus aus.
 */
async function fragenUeberReasoner(
  l: Lage,
  frage: string,
  locale = "de",
): Promise<{ status: number; roh: string; citedSources: string[] }> {
  const res = await l.aufbau.app.inject({
    method: "POST",
    url: "/api/reasoner",
    headers: { ...l.leser.kopf, "content-type": "application/json" },
    payload: { task: "ask", text: frage, locale },
  });
  const citedSources =
    res.statusCode === 200
      ? ((res.json() as { result: { citedSources?: string[] } }).result.citedSources ?? [])
      : [];
  return { status: res.statusCode, roh: res.body, citedSources };
}

/** Bewusstes Wiedereinschalten durch den Administrator — bestätigt. */
async function kiAn(l: Lage): Promise<void> {
  const an = await kiSetzen(l, l.aufbau.admin, "auto");
  expect(an.statusCode, an.body).toBe(200);
  expect(l.dienste.reasoner.kiAbschaltung().abgeschaltet).toBe(false);
}

/**
 * Frage stellen, am Punkt anhalten, bestätigt abschalten (mit `zyklus`: und bestätigt wieder
 * einschalten), freigeben — und was danach geschah.
 */
async function angehalten(l: Lage, fall: Haltefall, zyklus = false, eingang: Eingang = "ask") {
  const halt = l.grenzen.anhalten(fall.punkt, fall.mal);
  const laufend =
    eingang === "ask"
      ? fragen(l.aufbau.app, l.leser, fall.frage ?? FRAGE)
      : fragenUeberReasoner(l, fall.frage ?? FRAGE);
  await halt.erreicht;
  await kiAus(l);
  if (zyklus) {
    await kiAn(l);
  }
  const vorher = l.grenzen.stand();
  halt.freigeben();
  const antwort = await laufend;
  await ruhe();
  return { antwort, d: differenz(vorher, l.grenzen.stand()) };
}

describe("D5 · KI aus — K3 · angehaltene Ausführungen und keine Hintergrundwege", () => {
  for (const fall of HALTEFAELLE) {
    it(`C · angehalten ${fall.wo} (${fall.punkt}): nach der Abschaltung nichts mehr gelesen, übergeben oder übertragen`, async () => {
      const l = await vorrichtung();
      const { antwort, d } = await angehalten(l, fall);
      abschaltauskunftPruefen(antwort.status, antwort.roh, "de");
      expect(
        zugriffsbefund(d, ALLE_GRENZEN),
        `die bei ${fall.punkt} angehaltene Frage hat nach der Abschaltung weitergearbeitet`,
      ).toBe("");
    });

    it(`G · Gegenprobe zu ${fall.punkt}: ohne die Sperre „${fall.sperre.join(" + ")}" erscheint genau der nächste Schritt`, async () => {
      const l = await vorrichtung();
      const rueckbau = sperreEntfernen(l.dienste, new Set(fall.sperre));
      try {
        const { antwort, d } = await angehalten(l, fall);
        if ("ausgeliefert" in fall.naechster) {
          expect(
            antwort.status,
            `Gegenprobe: ohne Sperre vor der Auslieferung kam trotzdem die Abschaltauskunft (${antwort.roh.slice(0, 200)})`,
          ).toBe(200);
          expect(antwort.roh).toContain("XQ42");
        } else if ("antwortweg" in fall.naechster) {
          expect(
            d.antwortweg,
            `Gegenprobe: ohne Sperre blieb der Antwortweg still (${zugriffsbefund(d, ALLE_GRENZEN)})`,
          ).toBeGreaterThan(0);
        } else {
          expect(
            d.folge[0] ?? "(nichts gelesen)",
            `Gegenprobe: ohne Sperre „${fall.sperre.join(" + ")}" las die Frage nicht den erwarteten nächsten Schritt — ${zugriffsbefund(d, ALLE_GRENZEN)}`,
          ).toMatch(fall.naechster.lesen);
        }
      } finally {
        rueckbau();
      }
      // Zurückgebaut: dieselbe Lage zählt wieder nichts.
      const vorher = l.grenzen.stand();
      abschaltauskunftPruefen(
        ...(await fragen(l.aufbau.app, l.leser).then((a) => [a.status, a.roh, "de"] as const)),
      );
      expect(zugriffsbefund(differenz(vorher, l.grenzen.stand()), ALLE_GRENZEN)).toBe("");
    });
  }

  it("C · angehalten VOR DER ÜBERTRAGUNG (Modellplatz belegt): nach der Abschaltung geht nichts an das Modell", async () => {
    const l = await vorrichtung();
    const platz = modellplatzBelegen();
    try {
      const vorFrage = l.grenzen.stand();
      const laufend = fragen(l.aufbau.app, l.leser);
      // Die Frage steht, sobald sie den Antwortweg betreten hat und auf den Modellplatz wartet.
      await vi.waitFor(() => {
        expect(l.grenzen.stand().antwortweg).toBeGreaterThan(vorFrage.antwortweg);
      });
      await ruhe(50);
      expect(l.grenzen.stand().modell, "die Frage wartete nicht vor der Übertragung").toBe(
        vorFrage.modell,
      );
      await kiAus(l);
      const vorher = l.grenzen.stand();
      platz.freigeben();
      const antwort = await laufend;
      await ruhe();
      abschaltauskunftPruefen(antwort.status, antwort.roh, "de");
      expect(
        zugriffsbefund(differenz(vorher, l.grenzen.stand()), ALLE_GRENZEN),
        "die vor der Übertragung wartende Frage hat nach der Abschaltung übertragen oder gelesen",
      ).toBe("");
    } finally {
      platz.abbauen();
    }
  });

  it("G · Gegenprobe VOR DER ÜBERTRAGUNG: ohne die Sperre am Chokepoint zählt der Modelldraht", async () => {
    const l = await vorrichtung();
    const platz = modellplatzBelegen();
    const rueckbau = sperreEntfernen(l.dienste, new Set(["uebertragung"]));
    try {
      const vorFrage = l.grenzen.stand();
      const laufend = fragen(l.aufbau.app, l.leser);
      await vi.waitFor(() => {
        expect(l.grenzen.stand().antwortweg).toBeGreaterThan(vorFrage.antwortweg);
      });
      await ruhe(50);
      await kiAus(l);
      const vorher = l.grenzen.stand();
      platz.freigeben();
      await laufend;
      await ruhe();
      expect(
        differenz(vorher, l.grenzen.stand()).modell,
        "Gegenprobe: ohne die Sperre am Chokepoint blieb der Modelldraht still",
      ).toBeGreaterThan(0);
    } finally {
      rueckbau();
      platz.abbauen();
    }
  });

  it("C3 · es gibt keinen D5-Hintergrund- oder Wiederholungsweg: alle Aufrufer von AskService.ask sind synchron", async () => {
    // Aus der ECHTEN Aufrufstruktur, nicht aus einer Behauptung: jede Produktdatei unter
    // `services/` wird gelesen und jeder Aufruf `<…ask…>.ask(` gezählt — auch über Zeilenumbrüche
    // hinweg. Drei Stellen gibt es: zwei HTTP-Routen, die im Anfragekontext antworten, und das
    // Beispielpaket, das ein Administrator ausdrücklich auslöst. Keine Queue, kein Timer, kein
    // Wiederholungsspeicher. Taucht ein weiterer Aufrufer auf, wird dieser Fall rot und verlangt,
    // ihn einzeln nachzuweisen.
    const { execFileSync } = await import("node:child_process");
    const { readFileSync } = await import("node:fs");
    const dateien = execFileSync("git", ["ls-files", "--", "services/*.ts"], { encoding: "utf8" })
      .trim()
      .split("\n")
      .filter((d) => !d.endsWith(".test.ts"));
    const treffer: string[] = [];
    for (const datei of dateien) {
      const zahl = readFileSync(datei, "utf8").match(/\b\w*ask\w*\s*\.\s*ask\s*\(/gi)?.length ?? 0;
      for (let i = 0; i < zahl; i += 1) {
        treffer.push(datei);
      }
    }
    expect(treffer.sort()).toEqual([
      "services/app/src/routes/ask-routes.ts",
      "services/app/src/routes/reasoner-routes.ts",
      "services/app/src/routes/reasoner-routes.ts",
      "services/app/src/seed-demo.ts",
    ]);
    // Und die Fläche wiederholt eine Frage nie selbst: Mutationen laufen ohne `retry`
    // (`apps/web/src/main.tsx` setzt `retry` nur für Abfragen).
    const haupt = readFileSync("apps/web/src/main.tsx", "utf8");
    expect(haupt).toMatch(/defaultOptions:\s*\{\s*queries:\s*\{[^}]*retry: 1\s*\}\s*\}/);
    expect(haupt).not.toMatch(/mutations:\s*\{[^}]*retry/);
  });
});

// ================================================================================================
// K5 · EINE ALTE AUSFÜHRUNG BLEIBT ENTWERTET — AUCH NACH AUS- UND WIEDEREINSCHALTEN.
// ================================================================================================
//
// Bens Befund aus Runde 2: eine nach der Suche angehaltene Frage, dann bestätigt aus- UND wieder
// eingeschaltet, dann freigegeben — sie las weiter und lieferte eine Quelle. Geprüft wurde nur der
// AKTUELLE Zustand. Jetzt hält jede Frage die Abschalt-Epoche zu Beginn fest; an JEDEM Haltepunkt
// oben muss eine solche alte Frage nach dem Zyklus stehen bleiben. Die Gegenprobe nimmt die Epoche
// heraus (nur noch der aktuelle Zustand zählt) und zeigt genau Bens Lage: Nachladen der Kandidaten
// und eine ausgelieferte Quelle.
describe("D5 · KI aus — K5 · alte Ausführungen nach Aus- und Wiedereinschalten", () => {
  for (const fall of HALTEFAELLE) {
    it(`Z · angehalten ${fall.wo} (${fall.punkt}), aus UND wieder ein: kein Nachholzugriff`, async () => {
      const l = await vorrichtung();
      const { antwort, d } = await angehalten(l, fall, true);
      abschaltauskunftPruefen(antwort.status, antwort.roh, "de");
      expect(
        zugriffsbefund(d, ALLE_GRENZEN),
        `die alte, bei ${fall.punkt} angehaltene Frage hat nach Aus- und Wiedereinschalten weitergearbeitet`,
      ).toBe("");
    });
  }

  it("Z · Gegenprobe (Bens Lage): ohne Epoche liest die alte Frage nach dem Zyklus weiter und liefert eine Quelle", async () => {
    const l = await vorrichtung();
    const rueckbau = sperreEntfernen(l.dienste, new Set(["epoche"]));
    try {
      const { antwort, d } = await angehalten(
        l,
        {
          punkt: "suchprojektion.findActive",
          wo: "mit fertigen Suchtreffern",
          sperre: ["epoche"],
          naechster: { lesen: /^ko\.listByIds$/ },
        },
        true,
      );
      expect(d.folge[0], "Gegenprobe: ohne Epoche lud die alte Frage keine Kandidaten nach").toBe(
        "ko.listByIds",
      );
      expect(
        antwort.status,
        "Gegenprobe: ohne Epoche wurde die alte Frage nicht ausgeliefert",
      ).toBe(200);
      expect(antwort.citedSources).toContain(l.koId);
    } finally {
      rueckbau();
    }
  });

  for (const gegenprobe of [false, true]) {
    it(`Z · vor der Übertragung wartend, aus UND wieder ein${gegenprobe ? " — Gegenprobe ohne Übertragungssperre: der Modelldraht zählt" : ": nichts geht an das Modell"}`, async () => {
      const l = await vorrichtung();
      const platz = modellplatzBelegen();
      const rueckbau = gegenprobe
        ? sperreEntfernen(l.dienste, new Set(["uebertragung"]))
        : () => undefined;
      try {
        const vorFrage = l.grenzen.stand();
        const laufend = fragen(l.aufbau.app, l.leser);
        await vi.waitFor(() => {
          expect(l.grenzen.stand().antwortweg).toBeGreaterThan(vorFrage.antwortweg);
        });
        await ruhe(50);
        await kiAus(l);
        await kiAn(l);
        const vorher = l.grenzen.stand();
        platz.freigeben();
        const antwort = await laufend;
        await ruhe();
        const d = differenz(vorher, l.grenzen.stand());
        if (gegenprobe) {
          expect(
            d.modell,
            "Gegenprobe: ohne Übertragungssperre blieb der Modelldraht still",
          ).toBeGreaterThan(0);
        } else {
          abschaltauskunftPruefen(antwort.status, antwort.roh, "de");
          expect(zugriffsbefund(d, ALLE_GRENZEN)).toBe("");
        }
      } finally {
        rueckbau();
        platz.abbauen();
      }
    });
  }
});

// ================================================================================================
// K3/K5 · DER ZWEITE EINGANG — `POST /api/reasoner`, Aufgabe `ask`.
// ================================================================================================
//
// Jeder Haltefall, der im Fragedienst selbst liegt, noch einmal über diesen Eingang: nach bestätigter
// Abschaltung und nach Aus-/Wiedereinschalten keine Auslieferung, kein Lesen, keine Übergabe. Die
// Gegenprobe nimmt die abschliessende Prüfung vor der Auslieferung heraus und zeigt genau Bens Lage:
// die nach dem Beleg angehaltene Frage geht mit ihrer Quelle als 200 hinaus.
describe("D5 · KI aus — K3/K5 · zweiter Eingang /api/reasoner (Aufgabe ask)", () => {
  for (const fall of HALTEFAELLE.filter((f) => !f.nurRoute)) {
    for (const zyklus of [false, true]) {
      it(`R · angehalten ${fall.wo} (${fall.punkt})${zyklus ? ", aus UND wieder ein" : ""}: Abschaltauskunft, kein Zugriff danach`, async () => {
        const l = await vorrichtung();
        const { antwort, d } = await angehalten(l, fall, zyklus, "reasoner");
        abschaltauskunftPruefen(antwort.status, antwort.roh, "de");
        expect(
          zugriffsbefund(d, ALLE_GRENZEN),
          `die über /api/reasoner bei ${fall.punkt} angehaltene Frage hat nach der Abschaltung weitergearbeitet`,
        ).toBe("");
      });
    }
  }

  for (const zyklus of [false, true]) {
    it(`R · Gegenprobe (Bens Lage${zyklus ? ", aus UND wieder ein" : ""}): ohne die Prüfung vor der Auslieferung geht die angehaltene Frage mit Quelle hinaus`, async () => {
      const l = await vorrichtung();
      const rueckbau = sperreEntfernen(l.dienste, new Set(["ergebnis", "auslieferung"]));
      try {
        const { antwort } = await angehalten(
          l,
          {
            punkt: "belege.listSnapshots",
            wo: "im Beleg nach der Revisionskette",
            sperre: ["ergebnis", "auslieferung"],
            naechster: { ausgeliefert: true },
          },
          zyklus,
          "reasoner",
        );
        expect(
          antwort.status,
          `Gegenprobe: ohne Prüfung vor der Auslieferung kam trotzdem die Abschaltauskunft (${antwort.roh.slice(0, 200)})`,
        ).toBe(200);
        expect(antwort.citedSources).toContain(l.koId);
      } finally {
        rueckbau();
      }
      // Zurückgebaut: derselbe Eingang weist wieder ab.
      if (!zyklus) {
        const wieder = await fragenUeberReasoner(l, FRAGE);
        abschaltauskunftPruefen(wieder.status, wieder.roh, "de");
      }
    });
  }
});

describe("D5 · KI aus — K5 · Wiedereinschalten und Unberechtigte", () => {
  it("D1 · ein Leser kann nicht umschalten; der Administrator schaltet bewusst wieder ein — ohne Nachholzugriffe", async () => {
    const l = await vorrichtung();
    await kiAus(l);
    const versuch = await kiSetzen(l, l.leser, "auto");
    expect(versuch.statusCode, "ein Leser konnte die KI umschalten").toBe(403);
    expect(l.dienste.reasoner.kiAbschaltung().abgeschaltet).toBe(true);

    // Eine abgewiesene Frage während der Abschaltung …
    const abgewiesen = await fragen(l.aufbau.app, l.leser);
    expect(abgewiesen.status).toBe(503);

    const vorher = l.grenzen.stand();
    const an = await kiSetzen(l, l.aufbau.admin, "auto");
    expect(an.statusCode, an.body).toBe(200);
    expect(l.dienste.reasoner.kiAbschaltung().abgeschaltet).toBe(false);
    // … wird durch das Wiedereinschalten NICHT nachgeholt.
    await new Promise((r) => setTimeout(r, 200));
    expect(
      zugriffsbefund(differenz(vorher, l.grenzen.stand()), ALLE_GRENZEN),
      "das Wiedereinschalten hat eine alte Frage still nachgeholt",
    ).toBe("");
    // Erst eine NEUE Frage geht den Weg wieder — nach den bestehenden Regeln.
    const neu = await fragen(l.aufbau.app, l.leser);
    expect(neu.status).toBe(200);
    expect(neu.citedSources).toContain(l.koId);
  });
});

describe("D5 · KI aus — K4 · das menschliche Leserecht bleibt", () => {
  it("E1 · derselbe Leser liest Eintrag und Original weiter; erst der Rechteentzug sperrt — ein anderer Zustand", async () => {
    const l = await vorrichtung();
    await kiAus(l);
    const roh = await originalLesen(l.aufbau.app, l.leser, l.objectId);
    expect(roh.statusCode, "die KI-Abschaltung hat nebenbei das Leserecht geschlossen").toBe(200);
    expect(roh.body).toBe(ORIGINALTEXT);
    const eintrag = await l.aufbau.app.inject({
      method: "GET",
      url: `/api/kos/${l.koId}`,
      headers: l.leser.kopf,
    });
    expect(eintrag.statusCode).toBe(200);
    expect(eintrag.body).toContain(BELEGSTELLE);

    // Der AUSDRÜCKLICHE Rechteentzug ist ein eigener Zustand mit eigener Wirkung.
    const hoch = await l.aufbau.app.inject({
      method: "PUT",
      url: `/api/kos/${l.koId}`,
      headers: l.aufbau.admin.kopf,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(hoch.statusCode, hoch.body).toBe(200);
    expect((await originalLesen(l.aufbau.app, l.leser, l.objectId)).statusCode).toBe(404);
    // Und die KI-Abschaltung ist davon unberührt geblieben — die beiden Zustände hängen nicht aneinander.
    expect(l.dienste.reasoner.kiAbschaltung().abgeschaltet).toBe(true);
  });
});

describe("D5 · KI aus — K6 · Gegenprobe an der frischen Frage", () => {
  it("G1 · Sperre VOR dem Retrieval entfernt → die Ablagen zählen, der Antwortweg bleibt zu", async () => {
    const l = await vorrichtung();
    await kiAus(l);
    // Lauf 5 Runde 2: `diensteinstieg` (die Route vor dem Dienst) liegt ebenfalls VOR dem Retrieval.
    const rueckbau = sperreEntfernen(
      l.dienste,
      new Set(["diensteinstieg", "vorauswahl", "suchprojektion"]),
    );
    try {
      const vorher = l.grenzen.stand();
      const antwort = await fragen(l.aufbau.app, l.leser);
      const d = differenz(vorher, l.grenzen.stand());
      expect(
        gelesen(d),
        "Gegenprobe: ohne Sperre vor dem Retrieval blieben die Ablagen still",
      ).toBeGreaterThan(0);
      expect(d.folge).toContain("ko.listByIds");
      // Die übrigen Prüfpunkte greifen weiter: der Antwortweg bleibt zu.
      expect(zugriffsbefund(d, ["antwortweg", "modell"])).toBe("");
      expect(antwort.status).toBe(503);
    } finally {
      rueckbau();
    }
    // Rückgebaut: derselbe Aufruf zählt wieder nichts.
    const vorher = l.grenzen.stand();
    await fragen(l.aufbau.app, l.leser);
    expect(zugriffsbefund(differenz(vorher, l.grenzen.stand()), ALLE_GRENZEN)).toBe("");
  });
});

// ================================================================================================
// K3/K5 · DIE INNEREN ANWEISUNGEN DER POSTGRESQL-BELEG- UND LÜCKENABLAGE (Lauf 3, Bens Befund R1).
// ================================================================================================
//
// Die Haltefälle oben halten an den METHODEN der Ablagen an. In PostgreSQL liegen INNERHALB von
// `appendSnapshot` (Antwortsatz → Idempotenz → Revisionskette → Einfügen) und `insertOrIncrement`
// (Einfügeversuch → Hochzählen der vorhandenen Lücke) weitere Wartepunkte. Hier laufen die echten
// Adapter (`PgAnswerSnapshotRepo`, `PgGapRepo`) des echten `AskService` über einem instrumentierten
// SQL-Ersatz: jede Anweisung wird gezählt, und nach einer benannten wird angehalten. Den Lauf mit
// echter Datenbank führt `tests/d5-gesamtweg/ki-aus-pg-browser.integration.test.ts` (H6).

interface SqlErsatz {
  pool: unknown;
  anweisungen: string[];
  anhaltenNach(muster: RegExp): { erreicht: Promise<void>; freigeben(): void };
}

/** Ein minimaler Ersatz genau für die Anweisungen der beiden Adapter — nichts darüber hinaus. */
function sqlErsatz(): SqlErsatz {
  const records = new Map<string, unknown>();
  const snapshots = new Map<string, { answerId: string; data: unknown }>();
  const gaps = new Map<string, Record<string, unknown>>();
  const anweisungen: string[] = [];
  let halt: { muster: RegExp; erreicht: () => void; warten: Promise<void> } | null = null;
  const ausfuehren = (text: string, p: unknown[]): { rows: unknown[]; rowCount: number } => {
    const t = text.replace(/\s+/g, " ").trim();
    if (t.startsWith("INSERT INTO answer_records")) {
      if (records.has(p[0] as string)) return { rows: [], rowCount: 0 };
      records.set(p[0] as string, JSON.parse(p[1] as string));
      return { rows: [{ answer_id: p[0] }], rowCount: 1 };
    }
    if (t.startsWith("SELECT data FROM answer_records")) {
      const data = records.get(p[0] as string);
      return data ? { rows: [{ data }], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    if (t.startsWith("SELECT count(*)")) {
      return { rows: [{ n: snapshots.has(p[0] as string) ? "1" : "0" }], rowCount: 1 };
    }
    if (t.startsWith("SELECT data FROM answer_snapshots WHERE answer_id = $1")) {
      const rows = [...snapshots.values()]
        .filter((s) => s.answerId === p[0])
        .map((s) => ({ data: s.data }));
      return { rows, rowCount: rows.length };
    }
    if (t.startsWith("INSERT INTO answer_snapshots")) {
      const data = JSON.parse(p[1] as string) as { answerId: string };
      snapshots.set(p[0] as string, { answerId: data.answerId, data });
      return { rows: [{ snapshot_key: p[0] }], rowCount: 1 };
    }
    if (t.startsWith("INSERT INTO gaps")) {
      const gap = JSON.parse(p[1] as string) as Record<string, unknown>;
      const offen = [...gaps.values()].find(
        (g) =>
          g.status === "offen" && g.compareKey !== undefined && g.compareKey === gap.compareKey,
      );
      if (offen && t.includes("ON CONFLICT")) return { rows: [], rowCount: 0 };
      gaps.set(p[0] as string, gap);
      return { rows: [{ data: gap }], rowCount: 1 };
    }
    if (t.startsWith("UPDATE gaps SET data = jsonb_set")) {
      const offen = [...gaps.values()].find((g) => g.status === "offen" && g.compareKey === p[0]);
      if (!offen) return { rows: [], rowCount: 0 };
      offen.askCount = Number(offen.askCount ?? 1) + 1;
      return { rows: [{ data: offen }], rowCount: 1 };
    }
    throw new Error(`D5-SQL-Ersatz: unbekannte Anweisung ${t.slice(0, 80)}`);
  };
  const pool = {
    query(text: string, p: unknown[] = []) {
      anweisungen.push(text.replace(/\s+/g, " ").trim().slice(0, 60));
      const ergebnis = Promise.resolve().then(() => ausfuehren(text, p));
      const h = halt;
      if (h?.muster.test(text.replace(/\s+/g, " "))) {
        halt = null;
        return ergebnis.then(async (wert) => {
          h.erreicht();
          await h.warten;
          return wert;
        });
      }
      return ergebnis;
    },
  };
  return {
    pool,
    anweisungen,
    anhaltenNach(muster) {
      let erreicht!: () => void;
      let freigeben!: () => void;
      const e = new Promise<void>((r) => {
        erreicht = r;
      });
      const warten = new Promise<void>((r) => {
        freigeben = r;
      });
      halt = { muster, erreicht, warten };
      return { erreicht: e, freigeben };
    },
  };
}

/** Die beiden Adapter in den laufenden Fragedienst — genau die Ablagen, die `AskService` nutzt. */
function pgAdapterEinsetzen(l: Lage): SqlErsatz {
  const ersatz = sqlErsatz();
  const ask = l.dienste.ask as unknown as { answerSnapshots: unknown; gaps: unknown };
  ask.answerSnapshots = new PgAnswerSnapshotRepo(ersatz.pool as Pool);
  ask.gaps = new PgGapRepo(ersatz.pool as Pool);
  return ersatz;
}

interface AdapterHalt {
  /** Nach dieser Anweisung wird angehalten. */
  nach: RegExp;
  frage: string;
  /** Die Anweisung, die ohne Sperre als nächste liefe (Gegenprobe). */
  naechste: RegExp;
  wo: string;
  /** Vorher einmal fragen: legt die offene Lücke an, die dann hochgezählt würde. */
  vorfrage?: true;
}

const ADAPTER_HALTE: readonly AdapterHalt[] = [
  {
    nach: /^INSERT INTO answer_records/,
    frage: FRAGE,
    naechste: /^SELECT data FROM answer_records/,
    wo: "nach dem Antwortsatz",
  },
  {
    nach: /^SELECT data FROM answer_records/,
    frage: FRAGE,
    naechste: /^SELECT count\(\*\)/,
    wo: "im Beleg nach findRecord (Bens Probe)",
  },
  {
    nach: /^SELECT count\(\*\)/,
    frage: FRAGE,
    naechste: /^SELECT data FROM answer_snapshots/,
    wo: "im Beleg nach der Idempotenzprüfung",
  },
  {
    nach: /^SELECT data FROM answer_snapshots/,
    frage: FRAGE,
    naechste: /^INSERT INTO answer_snapshots/,
    wo: "im Beleg nach der Revisionskette",
  },
  {
    nach: /^\s*INSERT INTO gaps/,
    frage: UNBEANTWORTET,
    vorfrage: true,
    naechste: /^UPDATE gaps/,
    wo: "in der Lücke nach dem Einfügeversuch, vor dem Hochzählen (Bens Probe)",
  },
];

describe("D5 · KI aus — K3/K5 · innere Anweisungen der PostgreSQL-Beleg- und Lückenablage", () => {
  for (const fall of ADAPTER_HALTE) {
    for (const zyklus of [false, true]) {
      it(`P · angehalten ${fall.wo}${zyklus ? ", aus UND wieder ein" : ""}: danach keine Anweisung mehr`, async () => {
        const l = await vorrichtung();
        const sql = pgAdapterEinsetzen(l);
        if (fall.vorfrage) {
          expect((await fragen(l.aufbau.app, l.leser, fall.frage)).status).toBe(200);
          expect(sql.anweisungen.some((a) => /^INSERT INTO gaps/.test(a))).toBe(true);
        }
        const halt = sql.anhaltenNach(fall.nach);
        const laufend = fragen(l.aufbau.app, l.leser, fall.frage);
        await halt.erreicht;
        await kiAus(l);
        if (zyklus) {
          await kiAn(l);
        }
        const ab = sql.anweisungen.length;
        halt.freigeben();
        const antwort = await laufend;
        await ruhe();
        abschaltauskunftPruefen(antwort.status, antwort.roh, "de");
        expect(
          sql.anweisungen.slice(ab),
          `nach ${fall.nach} lief die Ablage nach der Abschaltung weiter`,
        ).toEqual([]);
      });
    }

    it(`P · Gegenprobe ${fall.wo}: ohne die Sperre „ergebnis" läuft genau die nächste Anweisung`, async () => {
      const l = await vorrichtung();
      const sql = pgAdapterEinsetzen(l);
      if (fall.vorfrage) {
        expect((await fragen(l.aufbau.app, l.leser, fall.frage)).status).toBe(200);
      }
      const rueckbau = sperreEntfernen(l.dienste, new Set<Pruefpunkt>(["ergebnis"]));
      try {
        const halt = sql.anhaltenNach(fall.nach);
        const laufend = fragen(l.aufbau.app, l.leser, fall.frage);
        await halt.erreicht;
        await kiAus(l);
        const ab = sql.anweisungen.length;
        halt.freigeben();
        await laufend;
        await ruhe();
        expect(sql.anweisungen[ab] ?? "(keine Anweisung)").toMatch(fall.naechste);
      } finally {
        rueckbau();
      }
    });
  }
});
