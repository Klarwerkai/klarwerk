// AW19-K02/K03/K04: genau zwei neue API-Falldefinitionen; Quellvorbereitung ohne Ausführung.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { assembleServices, inMemoryRepos } from "../../services/app/src/build-app";
import { type ErkannteFrist, FRISTEN_PRUEFSTAND } from "../../services/app/src/klara-fristen";
import { Reasoner } from "../../services/reasoner";
import { type Aufbau, type Konto, appAufbauen, neuesKonto } from "../klara-quellen-nutzerweg/kette";

type Notiz = { id: string; fassung: number; inhalt: string };
type KalenderSicht = { id: string; fristId: string | null };
let aufbau: Aufbau;
let ich: Konto;
const netz = vi.fn(async () => {
  throw new Error("Kein äußerer Transport in der synthetischen Fristenprobe");
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-21T08:00:00.000Z"));
  netz.mockClear();
  vi.stubGlobal("fetch", netz);
  aufbau = await appAufbauen(true, () => {
    const services = assembleServices(inMemoryRepos());
    services.reasoner = new Reasoner();
    services.mailer = { send: async () => {} };
    delete services.push;
    return services;
  });
  ich = await neuesKonto(aufbau.app, "bis-datum-gueltig", aufbau.admin);
});
afterEach(async () => {
  try {
    await aufbau?.app.close();
  } finally {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  }
});

async function notiz(inhalt: string): Promise<Notiz> {
  const r = await aufbau.app.inject({
    method: "POST",
    url: "/api/me/klara/notizen",
    headers: ich.kopf,
    payload: {
      vorgang: `bis-datum-${crypto.randomUUID()}`,
      weg: "geschrieben",
      titel: "Synthetische Lizenz und Zertifikat",
      inhalt,
      objektbezug: { pfad: "/kalender", seitenName: "Mein Kalender", objekt: "Fristenbelege" },
    },
  });
  expect(r.statusCode, r.body).toBe(201);
  return r.json<{ notiz: Notiz }>().notiz;
}

async function auswaehlen(n: Notiz) {
  const r = await aufbau.app.inject({
    method: "PUT",
    url: "/api/me/klara/fristen/regel",
    headers: ich.kopf,
    payload: {
      fassung: 0,
      regel: {
        aktiv: true,
        quellen: [{ art: "notiz", id: n.id }],
        arten: ["ablauf"],
        bereich: "persoenlich",
        zeitzone: "Europe/Berlin",
        aenderung: "aktualisieren",
        widerruf: "unzuverlaessig_ohne_vorlauf",
        wiederpruefung: "relevante_aenderung_klaeren",
        pruefstand: FRISTEN_PRUEFSTAND,
      },
    },
  });
  expect(r.statusCode, r.body).toBe(200);
  return r.json<{ fristen: ErkannteFrist[] }>().fristen;
}

async function kalender(): Promise<KalenderSicht[]> {
  const r = await aufbau.app.inject({ url: "/api/me/kalender", headers: ich.kopf });
  expect(r.statusCode, r.body).toBe(200);
  return r.json<{ eintraege: KalenderSicht[] }>().eintraege;
}

function belegPruefen(f: ErkannteFrist, n: Notiz, wortlaut: string) {
  expect(f.herkunft).toHaveLength(1);
  const herkunft = f.herkunft[0];
  if (!herkunft) throw new Error("Herkunft fehlt");
  expect(herkunft.aktuell).toBe(true);
  expect(herkunft.beleg.quelle).toMatchObject({
    art: "notiz",
    id: n.id,
    fassung: String(n.fassung),
    belegId: `notiz:${n.id}`,
  });
  const von = n.inhalt.indexOf(wortlaut);
  expect(von).toBeGreaterThanOrEqual(0);
  expect(herkunft.beleg.abschnitt).toEqual({ von, bis: von + wortlaut.length, wortlaut });
  expect(n.inhalt.slice(von, von + wortlaut.length)).toBe(wortlaut);
}

async function notizUnveraendert(n: Notiz) {
  const r = await aufbau.app.inject({
    url: `/api/me/klara/notizen/${n.id}`,
    headers: ich.kopf,
  });
  expect(r.statusCode, r.body).toBe(200);
  expect(r.json<{ notiz: Notiz }>().notiz).toMatchObject(n);
  expect(netz).not.toHaveBeenCalled();
}

it("A: übernimmt bis-zum-Datum und bis-ISO-Datum gültige eigene Belege je einmal mit Originalabschnitt", async () => {
  const saetze = [
    {
      text: "Lizenz L-17 ist bis zum 31.12.2026 gültig.",
      art: "Lizenz",
      id: "L-17",
      datum: "2026-12-31",
    },
    {
      text: "Zertifikat Z-8 ist bis 2027-06-30 gültig.",
      art: "Zertifikat",
      id: "Z-8",
      datum: "2027-06-30",
    },
  ];
  const n = await notiz(saetze.map((s) => s.text).join("\n"));
  expect(await kalender()).toEqual([]);
  const fristen = await auswaehlen(n);
  const eintraege = await kalender();
  expect(fristen).toHaveLength(2);
  expect(eintraege).toHaveLength(2);
  for (const s of saetze) {
    const f = fristen.find((f) => f.objekt.kennung === s.id);
    if (!f) throw new Error(`Frist für ${s.id} fehlt`);
    expect(f).toMatchObject({
      objekt: { art: s.art, kennung: s.id },
      art: "ablauf",
      stand: "erkannt",
      datum: { art: "datum", datum: s.datum },
      klaerung: [],
      verantwortlich: null,
    });
    belegPruefen(f, n, s.text);
    const eigene = eintraege.filter((e) => e.fristId === f.id);
    expect(eigene).toHaveLength(1);
    expect(eigene[0]).toMatchObject({
      art: "frist",
      bereich: "persoenlich",
      titel: `${s.art} ${s.id}`,
      beginn: s.datum,
      ganztaegig: true,
      zeitzone: "UTC",
      herkunft: { art: "information" },
      erkennung: { art: "ablauf", stand: "erkannt", manuell: false },
      auftrag: null,
      lauf: null,
      verantwortlich: null,
    });
  }
  await notizUnveraendert(n);
});

it("B: hält Negation, unbekannte Geltung und widersprüchliche Daten als Klärung ohne Kalendertermin fest", async () => {
  const saetze = [
    {
      id: "L-17",
      text: "Lizenz L-17 ist nicht bis zum 31.12.2026 gültig.",
      grund: "geltung_unklar",
    },
    {
      id: "Z-8",
      text: "Zertifikat Z-8 ist bis 2027-06-30 gültig, unter Vorbehalt.",
      grund: "geltung_unklar",
    },
    {
      id: "L-19",
      text: "Lizenz L-19 ist bis zum 31.12.2026 gültig, abweichend bis 2027-06-30 gültig.",
      grund: "widerspruch",
    },
  ];
  const n = await notiz(saetze.map((s) => s.text).join("\n"));
  const fristen = await auswaehlen(n);
  expect(fristen).toHaveLength(3);
  for (const s of saetze) {
    const f = fristen.find((f) => f.objekt.kennung === s.id);
    if (!f) throw new Error(`Klärung für ${s.id} fehlt`);
    expect(f).toMatchObject({ art: "ablauf", stand: "klaerung", datum: null });
    expect(f.kalenderDatum).toBeUndefined();
    expect(f.klaerung).toContain(s.grund);
    belegPruefen(f, n, s.text);
    expect(f.herkunft[0]?.beleg).toMatchObject({ datum: null, klaerung: [s.grund] });
  }
  expect(await kalender()).toEqual([]);
  await notizUnveraendert(n);
});
