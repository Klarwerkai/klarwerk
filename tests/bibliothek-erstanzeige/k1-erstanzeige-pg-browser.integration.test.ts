// K1-Erstanzeige separat: derselbe 10.001er-Bauplan und Dokumentbegin/rAF-Vertrag.
// Die sieben Definitionen der ursprünglichen K1/K10/K16-Datei bleiben vollständig unverändert.
import { afterAll, beforeAll, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { LIBRARY_RESULT_LIMIT } from "../../apps/web/src/lib/libraryDisplay";
import { buildPgServices } from "../../services/app/src/build-app";
import type { CreateKoInput } from "../../services/knowledge-object/src/service";
import {
  type Instanz,
  type Kontext,
  MELDUNG_KEINE_DATENBANK,
  type Pruefplatz,
  type Seite,
  adminAnlegen,
  anmelden,
  flaecheBereitstellen,
  fn,
  instanzStarten,
  profil,
  pruefplatzOeffnen,
  starteChromium,
  warte,
} from "../wiki-einordnung-konflikt/platz";
import {
  type Eintragsplan,
  kennungsHash,
  schreibeBericht,
  seedeGrossbestand,
} from "../wiki-grossbestand-nutzerweg/bestand";

const K = "[KLARWERK] K1-Erstanzeige · 10.001 reale PG-KOs";
const FRIST = 60_000;

const GESAMT = 10_001;
/** Steht NUR in den vier Suchgruppen (Titel und Aussage), nie im Füllbestand. */
const SUCHWORT = "Kettenspannung";
const WARTUNG = "K10 Wartung";
const MONTAGE = "K10 Montage";
const KATEGORIEN = [
  MONTAGE,
  WARTUNG,
  "K10 Qualität",
  "K10 Logistik",
  "K10 Einkauf",
  "K10 Schulung",
] as const;
const PUMPE = "k10-pumpe";
const VENTIL = "k10-ventil";
const NORM = "k10-norm";
const SCHLAGWORTE = [PUMPE, VENTIL, "k10-lager", NORM, "k10-audit", "k10-sicherheit"] as const;
const FREMDE_AUTOREN = ["k10-autor-b", "k10-autor-c", "k10-autor-d"] as const;

type Gruppe = "ziel" | "wartung" | "montage" | "ventil" | "fuell";
const GRUPPEN: readonly Gruppe[] = ["ziel", "wartung", "montage", "ventil", "fuell"];

interface Eintrag {
  gruppe: Gruppe;
  eingabe: CreateKoInput;
  validiert: boolean;
}

/** Titelpräfix je Gruppe — darüber ordnet die SQL-Rücklesung jede Zeile ihrer Gruppe zu. */
const PRAEFIX: Record<Gruppe, string> = {
  ziel: `K10 ${SUCHWORT} Zielbericht`,
  wartung: `K10 ${SUCHWORT} Wartungsnotiz`,
  montage: `K10 ${SUCHWORT} Montagenotiz`,
  ventil: `K10 ${SUCHWORT} Ventilnotiz`,
  fuell: "K10 Bestandseintrag",
};

const ART: CreateKoInput["type"] = "best_practice";

function suchgruppe(
  gruppe: Gruppe,
  anzahl: number,
  merkmale: Pick<CreateKoInput, "category" | "tags" | "author" | "confidentiality">,
  validiert: boolean,
): Eintrag[] {
  return Array.from({ length: anzahl }, (_, i) => {
    const nr = String(i).padStart(3, "0");
    return {
      gruppe,
      eingabe: {
        title: `${PRAEFIX[gruppe]} ${nr}`,
        statement: `${SUCHWORT} an Linie ${nr} nachgestellt.`,
        type: ART,
        ...merkmale,
      },
      validiert,
    };
  });
}

/**
 * Der vollständige Plan. Vier kleine Suchgruppen (93 Einträge) und 9.908 Füllzeilen über sechs
 * Kategorien, sechs Schlagwörter, vier Autoren und zwei Zustände.
 *
 * Vertrauliche Einträge stammen AUSSCHLIESSLICH vom angemeldeten Administrator selbst — so bleibt die
 * vorhandene Vertraulichkeitsregel unberührt, und kein Zähler hängt an einer Rechtefrage (K11).
 */
function bauplan(adminId: string): Eintrag[] {
  // `NonNullable`: das Feld ist in `CreateKoInput` optional, unter `exactOptionalPropertyTypes`
  // darf der gesetzte Wert deshalb nicht `undefined` einschliessen.
  type Stufe = NonNullable<CreateKoInput["confidentiality"]>;
  const vertraulich: Stufe = "vertraulich";
  const intern: Stufe = "intern";
  const plan: Eintrag[] = [
    ...suchgruppe(
      "ziel",
      37,
      { category: WARTUNG, tags: [PUMPE, NORM], author: adminId, confidentiality: vertraulich },
      true,
    ),
    ...suchgruppe(
      "wartung",
      23,
      { category: WARTUNG, tags: [PUMPE], author: adminId, confidentiality: intern },
      false,
    ),
    ...suchgruppe(
      "montage",
      19,
      { category: MONTAGE, tags: [PUMPE, NORM], author: "k10-autor-b", confidentiality: intern },
      false,
    ),
    ...suchgruppe(
      "ventil",
      14,
      { category: WARTUNG, tags: [VENTIL], author: adminId, confidentiality: vertraulich },
      true,
    ),
  ];
  const fuell = GESAMT - plan.length;
  for (let i = 0; i < fuell; i += 1) {
    const nr = String(i).padStart(5, "0");
    plan.push({
      gruppe: "fuell",
      eingabe: {
        title: `${PRAEFIX.fuell} ${nr}`,
        statement: `Abschnitt ${nr}: Ablauf und Nachweis sind im Ordner hinterlegt.`,
        type: ART,
        category: KATEGORIEN[i % KATEGORIEN.length] as string,
        tags: [SCHLAGWORTE[i % 6] as string, SCHLAGWORTE[(i + 2) % 6] as string],
        author: FREMDE_AUTOREN[i % FREMDE_AUTOREN.length] as string,
        confidentiality: intern,
      },
      validiert: i % 4 === 0,
    });
  }
  return plan;
}

function kategorienzahl(plan: readonly Eintrag[]): Map<string, number> {
  const zahl = new Map<string, number>();
  for (const e of plan) {
    const k = e.eingabe.category ?? "";
    zahl.set(k, (zahl.get(k) ?? 0) + 1);
  }
  return zahl;
}

/** Einmal-Marke im Sitzungsspeicher: nur die NÄCHSTE Navigation dieses Tabs wird gemessen. */
const ERSTANZEIGE_MARKE = "k1k10.erstanzeige.messen";

/**
 * Läuft als Init-Skript VOR jedem Seitenskript. Ohne Marke tut es nichts. Mit Marke prüft es je
 * Bild (`requestAnimationFrame`), ob der Listenfuss den vollen Bestand nennt und das erste Fenster
 * vollständig steht, und hält dann den Zeitpunkt und das nächste Bild fest — gelesen, nie gesetzt.
 */
const ERSTANZEIGE_SKRIPT = `(() => {
  let soll = null;
  try {
    const roh = sessionStorage.getItem(${JSON.stringify(ERSTANZEIGE_MARKE)});
    if (roh !== null) {
      sessionStorage.removeItem(${JSON.stringify(ERSTANZEIGE_MARKE)});
      soll = JSON.parse(roh);
    }
  } catch (e) {
    soll = null;
  }
  if (!soll) return;
  const m = { zustandMs: null, bildMs: null, fuss: null, ids: null, bilder: 0 };
  window.__k1k10Erstanzeige = m;
  const pruefe = () => {
    m.bilder += 1;
    const fuss = document.querySelector('[data-testid="bib-fuss"]');
    const zahl = fuss ? Number((fuss.textContent || "").replace(/[^0-9]/g, "")) : -1;
    const zeilen = document.querySelectorAll('[data-testid="bib-zeile"]');
    if (zahl === soll.zahl && zeilen.length === soll.fenster) {
      m.zustandMs = performance.now();
      m.fuss = zahl;
      m.ids = Array.from(zeilen, (e) => e.getAttribute("data-bib-id"));
      requestAnimationFrame(() => {
        m.bildMs = performance.now();
      });
      return;
    }
    requestAnimationFrame(pruefe);
  };
  requestAnimationFrame(pruefe);
})();`;

// Rein lesende Ergänzung: keine Marken, DOM-Eingriffe oder Änderung des Erstanzeige-Beobachters.
const PHASENDIAGNOSE_SKRIPT = `(() => {
  const diagnose = { unterstuetzt: false, grund: null, eintraege: [] };
  window.__k1Longtasks = diagnose;
  if (typeof PerformanceObserver !== "function") {
    diagnose.grund = "PerformanceObserver fehlt";
    return;
  }
  if (!PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
    diagnose.grund = "longtask wird nicht unterstützt";
    return;
  }
  try {
    const beobachter = new PerformanceObserver((liste) => {
      for (const eintrag of liste.getEntries()) {
        diagnose.eintraege.push({ startMs: eintrag.startTime, dauerMs: eintrag.duration });
      }
    });
    beobachter.observe({ type: "longtask", buffered: true });
    window.__k1LongtaskBeobachter = beobachter;
    diagnose.unterstuetzt = true;
  } catch (fehler) {
    diagnose.grund = String(fehler);
  }
})();`;

interface Erstanzeige {
  /** Navigationsbeginn → erstes Bild, in dem Fuss und erstes Fenster stimmten. */
  zustandMs: number;
  /** Navigationsbeginn → nächstes Bild danach (Framebeobachtung, kein Pixelnachweis). */
  bildMs: number;
  fuss: number;
  ids: string[];
  bilder: number;
  navigation: { responseEndMs: number; domContentLoadedMs: number; loadMs: number };
  /**
   * Nacharbeit 27: die Ladekette bis zur Erstanzeige — Skriptteile und API-Aufrufe aus der
   * Resource-Timing-Schnittstelle des Browsers (nur gelesen), damit eine Überschreitung zeigt, WO
   * die Zeit liegt: im Laden, in der Antwort oder im Rechnen danach.
   */
  ressourcen: {
    pfad: string;
    startMs: number;
    endeMs: number;
    bytes: number;
    requestStartMs: number | null;
    responseStartMs: number | null;
    responseEndMs: number | null;
    transferSize: number | null;
    decodedBodySize: number | null;
  }[];
  longtasks: {
    unterstuetzt: boolean;
    grund: string | null;
    eintraege: { startMs: number; dauerMs: number }[];
  };
}

/**
 * Marke setzen (auf der aktuellen Seite derselben Herkunft), Init-Skript am Profil anmelden, die
 * Bibliothek öffnen und den Beobachter auslesen. Die Navigation selbst ist ein gewöhnliches `goto`.
 */
async function erstanzeigeMessen(
  k: Kontext,
  s: Seite,
  basis: string,
  gesamt: number,
  frist: number = FRIST,
): Promise<Erstanzeige> {
  const herkunft = await s.evaluate<string>(fn("() => location.origin"));
  expect(herkunft, `${K}: Erstanzeige — Marke auf der Herkunft der Instanz`).toBe(
    new URL(basis).origin,
  );
  await k.addInitScript(PHASENDIAGNOSE_SKRIPT);
  await k.addInitScript(ERSTANZEIGE_SKRIPT);
  const soll = { zahl: gesamt, fenster: Math.min(gesamt, LIBRARY_RESULT_LIMIT) };
  await s.evaluate<void>(fn("([k, wert]) => { sessionStorage.setItem(k, wert); }"), [
    ERSTANZEIGE_MARKE,
    JSON.stringify(soll),
  ]);
  await s.goto(`${basis}/bibliothek`, { waitUntil: "load" });
  const fertig = "() => !!window.__k1k10Erstanzeige && window.__k1k10Erstanzeige.bildMs !== null";
  await warte(s, fertig, `${K}: Erstanzeige — Sollzustand beobachtet`, undefined, frist);
  return s.evaluate<Erstanzeige>(
    fn(`() => {
      const m = window.__k1k10Erstanzeige;
      const n = performance.getEntriesByType("navigation")[0];
      const diagnose = window.__k1Longtasks || {
        unterstuetzt: false, grund: "Longtask-Initdaten fehlen", eintraege: [],
      };
      const beobachter = window.__k1LongtaskBeobachter;
      if (beobachter) {
        for (const eintrag of beobachter.takeRecords()) {
          diagnose.eintraege.push({ startMs: eintrag.startTime, dauerMs: eintrag.duration });
        }
      }
      const zahl = (wert) => typeof wert === "number" && Number.isFinite(wert) ? wert : null;
      return {
        zustandMs: m.zustandMs,
        bildMs: m.bildMs,
        fuss: m.fuss,
        ids: m.ids,
        bilder: m.bilder,
        longtasks: {
          unterstuetzt: diagnose.unterstuetzt,
          grund: diagnose.grund,
          eintraege: diagnose.eintraege.filter((e) => e.startMs <= m.bildMs),
        },
        navigation: {
          responseEndMs: n ? n.responseEnd : -1,
          domContentLoadedMs: n ? n.domContentLoadedEventEnd : -1,
          loadMs: n ? n.loadEventEnd : -1,
        },
        ressourcen: performance
          .getEntriesByType("resource")
          .filter((r) => r.startTime <= m.bildMs)
          .map((r) => ({
            pfad: new URL(r.name).pathname + new URL(r.name).search,
            startMs: Math.round(r.startTime),
            endeMs: Math.round(r.responseEnd),
            bytes: r.encodedBodySize || 0,
            requestStartMs: zahl(r.requestStart),
            responseStartMs: zahl(r.responseStart),
            responseEndMs: zahl(r.responseEnd),
            transferSize: zahl(r.transferSize),
            decodedBodySize: zahl(r.decodedBodySize),
          }))
          .filter((r) => r.pfad.startsWith("/api/") || r.pfad.endsWith(".js")),
      };
    }`),
  );
}

/** Das erste Fenster: voller Fuss, genau das erste Fenster, eindeutig, nur Kennungen aus dem Seed. */
function erstanzeigePruefen(
  e: Erstanzeige,
  seed: ReadonlySet<string>,
  gesamt: number,
  was: string,
): void {
  const fenster = Math.min(gesamt, LIBRARY_RESULT_LIMIT);
  expect(e.fuss, `${K}: ${was} — Listenfuss`).toBe(gesamt);
  expect(e.ids.length, `${K}: ${was} — Zeilen im ersten Fenster`).toBe(fenster);
  expect(new Set(e.ids).size, `${K}: ${was} — eindeutige Kennungen`).toBe(fenster);
  const fremd = e.ids.filter((id) => !seed.has(id));
  expect(fremd, `${K}: ${was} — Kennungen ausserhalb des Seeds`).toEqual([]);
}

// Öffentliche CPU-Sampling-Diagnose; verändert weder Anzeige noch Messkriterium.
type CpuSitzung = Awaited<ReturnType<NonNullable<Kontext["newCDPSession"]>>>;
interface CpuFrame {
  functionName: string;
  scriptId: string;
  url: string;
  lineNumber: number;
  columnNumber: number;
}
interface CpuLauf {
  sitzung: CpuSitzung;
  laeuft: boolean;
  herkunft: string;
  diagnose: Record<string, unknown>;
}

async function cpuStarten(k: Kontext, s: Seite, basis: string): Promise<CpuLauf | undefined> {
  const diagnose: Record<string, unknown> = {
    status: "nicht_gestartet",
    angefordertesIntervallUs: 1000,
    fenster: "unveränderter erstanzeigeMessen-Aufruf einschließlich Auslesen",
    hinweis: "Sampling verursacht Aufwand; Samplegewichte sind keine isolierten Laufzeiten.",
  };
  bericht.cpuProfil = diagnose;
  let sitzung: CpuSitzung | undefined;
  let gestartet = false;
  let schritt = "newCDPSession";
  try {
    if (!k.newCDPSession) {
      diagnose.status = "nicht_unterstuetzt";
      diagnose.grund = "Öffentlicher CDP-Port fehlt am eigenen Kontext";
      return;
    }
    const herkunft = new URL(basis).origin;
    sitzung = await k.newCDPSession(s);
    schritt = "Profiler.enable";
    await sitzung.send("Profiler.enable");
    schritt = "Profiler.setSamplingInterval";
    await sitzung.send("Profiler.setSamplingInterval", { interval: 1000 });
    diagnose.konfiguriertesIntervallUs = 1000;
    schritt = "Profiler.start";
    await sitzung.send("Profiler.start");
    gestartet = true;
    diagnose.status = "laeuft";
    return { sitzung, laeuft: true, herkunft, diagnose };
  } catch (fehler) {
    diagnose.status = "beobachtungsfehler";
    diagnose.fehler = { schritt, grund: String(fehler) };
    return;
  } finally {
    if (sitzung && !gestartet) {
      try {
        await sitzung.detach();
        diagnose.sessionGetrennt = true;
      } catch (fehler) {
        diagnose.trennfehler = String(fehler);
      }
    }
  }
}

function cpuAssetPfad(frame: CpuFrame, herkunft: string): string | undefined {
  try {
    const url = new URL(frame.url);
    if (url.origin === herkunft && url.pathname.startsWith("/assets/")) return url.pathname;
  } catch {
    // Leere, native oder fremde Frames erhalten keinen Quelltextabruf.
  }
  return;
}

async function cpuQuellausschnitte(lauf: CpuLauf, frames: CpuFrame[]): Promise<void> {
  if (frames.length === 0) {
    lauf.diagnose.quellzuordnung = "Keine teuren eigenen Frames mit kurzem/minifiziertem Namen";
    return;
  }
  let aktiv = false;
  const ausschnitte: Record<string, unknown>[] = [];
  const quellen = new Map<string, string>();
  try {
    // Erst nach Profiler.stop und dem unveränderten Messende, niemals Pause oder Ausführung.
    await lauf.sitzung.send("Debugger.enable");
    aktiv = true;
    for (const frame of frames.slice(0, 15)) {
      try {
        let quelle = quellen.get(frame.scriptId);
        if (quelle === undefined) {
          const antwort = await lauf.sitzung.send("Debugger.getScriptSource", {
            scriptId: frame.scriptId,
          });
          quelle = antwort.scriptSource;
          quellen.set(frame.scriptId, quelle);
        }
        const zeile = quelle.split("\n")[frame.lineNumber];
        if (zeile === undefined || frame.columnNumber > zeile.length) {
          ausschnitte.push({ frame, grund: "Beobachtete Quellposition nicht verfügbar" });
          continue;
        }
        const von = Math.max(0, frame.columnNumber - 180);
        ausschnitte.push({
          frame,
          pfad: cpuAssetPfad(frame, lauf.herkunft),
          positionenAbNull: true,
          ausschnittSpalteAb: von,
          ausschnitt: zeile.slice(von, frame.columnNumber + 300),
        });
      } catch (fehler) {
        ausschnitte.push({ frame, grund: String(fehler) });
      }
    }
    lauf.diagnose.quellausschnitte = ausschnitte;
  } catch (fehler) {
    lauf.diagnose.quellzuordnungFehler = String(fehler);
  } finally {
    if (aktiv) {
      try {
        await lauf.sitzung.send("Debugger.disable");
      } catch (fehler) {
        lauf.diagnose.debuggerAbschlussfehler = String(fehler);
      }
    }
  }
}

async function cpuStoppen(
  lauf: CpuLauf | undefined,
  messaufrufAbgeschlossen: boolean,
): Promise<void> {
  if (!lauf?.laeuft) return;
  lauf.laeuft = false;
  try {
    const { profile } = await lauf.sitzung.send("Profiler.stop");
    lauf.diagnose.status = "gestoppt";
    lauf.diagnose.messaufrufAbgeschlossen = messaufrufAbgeschlossen;
    lauf.diagnose.rohprofil = profile;
    const { samples, timeDeltas } = profile;
    if (!samples || !timeDeltas || samples.length !== timeDeltas.length) {
      lauf.diagnose.auswertung = "Samples/Zeitdeltas fehlen oder haben verschiedene Längen";
      return;
    }
    const knoten = new Map(profile.nodes.map((knoten) => [knoten.id, knoten]));
    const eltern = new Map<number, number[]>();
    for (const knoten of profile.nodes) {
      for (const kind of knoten.children ?? []) {
        const ids = eltern.get(kind) ?? [];
        ids.push(knoten.id);
        eltern.set(kind, ids);
      }
    }
    const gewichte = new Map<number, { samples: number; sampleGewichtUs: number }>();
    for (const [i, id] of samples.entries()) {
      const delta = timeDeltas[i];
      if (typeof delta !== "number" || !Number.isFinite(delta) || delta < 0 || !knoten.has(id)) {
        lauf.diagnose.auswertung = "Ungültiges Sample, Zeitdelta oder unbekannte Knotenkennung";
        return;
      }
      const gewicht = gewichte.get(id) ?? { samples: 0, sampleGewichtUs: 0 };
      gewicht.samples += 1;
      gewicht.sampleGewichtUs += delta;
      gewichte.set(id, gewicht);
    }
    const sortiert = [...gewichte.entries()].sort(
      ([, a], [, b]) => b.sampleGewichtUs - a.sampleGewichtUs,
    );
    lauf.diagnose.auswertung = {
      regel: "timeDeltas[i] dem Blatt samples[i] zugeordnet; keine isolierte Funktionslaufzeit",
      samples: samples.length,
      sampleGewichtUs: timeDeltas.reduce((summe, delta) => summe + delta, 0),
      topSelf: sortiert.slice(0, 15).map(([id, gewicht]) => ({
        id,
        ...gewicht,
        callFrame: knoten.get(id)?.callFrame,
        aufruferAnzahl: eltern.get(id)?.length ?? 0,
        aufrufer: (eltern.get(id) ?? []).slice(0, 15).map((elternId) => ({
          id: elternId,
          callFrame: knoten.get(elternId)?.callFrame,
        })),
      })),
    };
    if (messaufrufAbgeschlossen) {
      const frames = sortiert.flatMap(([id, gewicht]) => {
        const frame = knoten.get(id)?.callFrame;
        if (!frame || gewicht.sampleGewichtUs <= 0) return [];
        if (!cpuAssetPfad(frame, lauf.herkunft)) return [];
        if (!Number.isInteger(frame.lineNumber) || frame.lineNumber < 0) return [];
        if (!Number.isInteger(frame.columnNumber) || frame.columnNumber < 0) return [];
        if (frame.functionName === "" || /^[A-Za-z_$][\w$]{0,3}$/.test(frame.functionName)) {
          return [frame];
        }
        return [];
      });
      await cpuQuellausschnitte(lauf, frames.slice(0, 15));
    }
  } catch (fehler) {
    lauf.diagnose.status = "beobachtungsfehler";
    lauf.diagnose.stopOderAuswertungsfehler = String(fehler);
  }
}

async function cpuAufraeumen(lauf: CpuLauf | undefined): Promise<void> {
  if (!lauf) return;
  try {
    if (lauf.laeuft) await cpuStoppen(lauf, false);
  } finally {
    try {
      await lauf.sitzung.detach();
      lauf.diagnose.sessionGetrennt = true;
    } catch (fehler) {
      lauf.diagnose.trennfehler = String(fehler);
    }
  }
}

let platz: Pruefplatz | undefined;
let instanz: Instanz | undefined;
let browser: Awaited<ReturnType<typeof starteChromium>> | undefined;
let kontext: Kontext | undefined;
let seite: Seite | undefined;
let alle = new Set<string>();
let skipGrund = "";
const bericht: Record<string, unknown> = { massstab: "NFR-PERF-01 < 1000 ms", gesamt: GESAMT };

beforeAll(async () => {
  await i18n.changeLanguage("de");
  const ergebnis = await pruefplatzOeffnen();
  if (ergebnis.skipGrund !== undefined) {
    skipGrund = ergebnis.skipGrund;
    process.stderr.write(`${MELDUNG_KEINE_DATENBANK} ${skipGrund}\n`);
    return;
  }
  platz = ergebnis.platz;
  flaecheBereitstellen();
  const db = await platz.wegwerfdatenbank("k1_erstanzeige");
  instanz = await instanzStarten(db.pool);
  const admin = await adminAnlegen(instanz.app, "k1-erstanzeige");
  await instanz.schliessen();
  instanz = undefined;
  const plan = bauplan(admin.id);
  const gruppen: Record<Gruppe, Eintragsplan["gruppe"]> = {
    ziel: "ziel",
    wartung: "ablenker",
    montage: "deckel",
    ventil: "herkunftsgruppe",
    fuell: "fuellbestand",
  };
  const seedPlan = plan.map<Eintragsplan>((e) => ({
    gruppe: gruppen[e.gruppe],
    eingabe: e.eingabe,
    ...(e.validiert ? { validierung: { trust: 70, status: "validiert" as const } } : {}),
  }));
  const services = buildPgServices(db.pool);
  const seed = await seedeGrossbestand(
    services.ko,
    async () => {
      const n = await db.pool.query<{ n: string }>("SELECT count(*)::text AS n FROM kos");
      return Number(n.rows[0]?.n);
    },
    seedPlan,
  );
  expect(seed.manifest.gespeicherteAnzahl).toBe(GESAMT);
  const zeilen = await db.pool.query<{ id: string; category: string; titel: string }>(
    "SELECT id, category, data->>'title' AS titel FROM kos",
  );
  expect(zeilen.rowCount).toBe(GESAMT);
  alle = new Set(zeilen.rows.map((z) => z.id));
  expect(alle.size).toBe(GESAMT);
  const kategorien = new Map<string, number>();
  const hashes: Record<string, string> = {};
  for (const g of GRUPPEN) {
    const ids = zeilen.rows.filter((z) => z.titel.startsWith(`${PRAEFIX[g]} `)).map((z) => z.id);
    hashes[g] = kennungsHash([...ids].sort());
    expect(hashes[g]).toBe(kennungsHash([...seed.nachGruppe[gruppen[g]]].sort()));
  }
  for (const zeile of zeilen.rows) {
    expect(GRUPPEN.some((g) => zeile.titel.startsWith(`${PRAEFIX[g]} `))).toBe(true);
    kategorien.set(zeile.category, (kategorien.get(zeile.category) ?? 0) + 1);
  }
  expect(kategorien).toEqual(kategorienzahl(plan));
  bericht.bestand = { anzahl: zeilen.rowCount, gruppen: hashes, dauerMs: seed.manifest.dauerMs };

  // Regulärer Kaltstart auf dem ganzen Bestand, ohne Projektion oder Suchroute vorzuwärmen.
  instanz = await instanzStarten(db.pool);
  browser = await starteChromium();
  const profilLage = await profil(browser, { width: 1440, height: 900 });
  kontext = profilLage.kontext;
  seite = profilLage.seite;
  await anmelden(seite, instanz.basis, admin.email);
}, 240_000);

afterAll(async () => {
  const datei = schreibeBericht("k1-erstanzeige-10001.json", bericht);
  process.stderr.write(`${K} BERICHT (${datei}): ${JSON.stringify(bericht)}\n`);
  await kontext?.close().catch(() => undefined);
  await instanz?.schliessen().catch(() => undefined);
  await browser?.close().catch(() => undefined);
  await platz?.abraeumen();
}, 60_000);

it("K1: 10.001 KOs und 200 Zeilen ab Dokumentbeginn unter 1000 ms", async (ctx) => {
  if (!instanz || !kontext || !seite) {
    process.stderr.write(`${MELDUNG_KEINE_DATENBANK} ${skipGrund}\n`);
    ctx.skip();
    return;
  }
  expect(LIBRARY_RESULT_LIMIT).toBe(200);
  const cpu = await cpuStarten(kontext, seite, instanz.basis);
  try {
    const erstanzeige = await erstanzeigeMessen(kontext, seite, instanz.basis, GESAMT);
    await cpuStoppen(cpu, true);
    bericht.erstanzeigeMs = { ...erstanzeige, grenzeMs: 1000 };
    erstanzeigePruefen(erstanzeige, alle, GESAMT, "Erstanzeige 10.001");
    expect(
      erstanzeige.bildMs,
      `${K}: Erstanzeige ${Math.round(erstanzeige.bildMs)} ms (NFR-PERF-01 < 1000 ms)`,
    ).toBeLessThan(1000);
  } finally {
    await cpuAufraeumen(cpu);
  }
}, 60_000);
