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
  ressourcen: { pfad: string; startMs: number; endeMs: number; bytes: number }[];
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
      return {
        zustandMs: m.zustandMs,
        bildMs: m.bildMs,
        fuss: m.fuss,
        ids: m.ids,
        bilder: m.bilder,
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
  const db = await platz.wegwerfdatenbank("k1-erstanzeige");
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
  const erstanzeige = await erstanzeigeMessen(kontext, seite, instanz.basis, GESAMT);
  bericht.erstanzeigeMs = { ...erstanzeige, grenzeMs: 1000 };
  erstanzeigePruefen(erstanzeige, alle, GESAMT, "Erstanzeige 10.001");
  expect(
    erstanzeige.bildMs,
    `${K}: Erstanzeige ${Math.round(erstanzeige.bildMs)} ms (NFR-PERF-01 < 1000 ms)`,
  ).toBeLessThan(1000);
}, 60_000);
