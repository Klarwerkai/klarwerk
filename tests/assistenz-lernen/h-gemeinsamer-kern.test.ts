import { describe, expect, it } from "vitest";
import { beschaffungsTermin } from "../../services/app/src/beschaffung-lernzeit";
import {
  InMemoryKlaraGespraechRepo,
  KlaraGespraechDienst,
} from "../../services/app/src/klara-gespraech";
import {
  FunktionenDienst,
  RoutinenFunktionenRepo,
  entwirfFunktion,
} from "../../services/app/src/persoenliche-funktionen";
import {
  InMemoryRoutinenRepo,
  type Routine,
  VormachenDienst,
} from "../../services/app/src/vormachen";

import { hostDerAnfrage } from "../../services/app/src/vormachen-arbeitswege";

const JETZT = Date.parse("2026-10-20T09:00:00.000Z");
const KONTO = "h-eigene-testperson";
const CLIENT = "h-eigener-testclient";
const SATZ = "So möchte ich künftig Angebote für eine Verpackung einholen.";
function basis(): Routine {
  return {
    id: "h-funktion",
    kontoId: KONTO,
    titel: "Bericht",
    zweck: "Bericht",
    host: "klarwerk_web",
    modus: "ergebnis_zur_pruefung",
    fassung: 1,
    schritte: [],
    herkunft: { sitzungId: "h-sitzung", stand: "h-stand", beobachtet: 2, korrigiert: 0 },
    bestaetigtAm: new Date(JETZT).toISOString(),
    firmenuebergabe: null,
  };
}
function beschaffung(repo = new InMemoryRoutinenRepo()) {
  let nun = JETZT;
  let n = 0;
  const dienst = new FunktionenDienst({
    repo: new RoutinenFunktionenRepo(repo),
    jetzt: () => nun,
    neueId: () => `h-bes-${++n}`,
  });
  const lesen = async () => ({ fassung: 1, status: "validiert" });
  return {
    repo,
    dienst,
    lesen,
    zeit: (x: number) => {
      nun = x;
    },
  };
}

it("H1 · Lernfunktion und Beschaffung nutzen denselben Speicher und dieselbe Privatlöschung", async () => {
  const { repo, dienst, lesen } = beschaffung();
  await repo.lege(basis());
  const { funktion } = await dienst.speichern(
    KONTO,
    { text: SATZ, quellen: ["quelle-eigen"] },
    lesen,
  );
  expect((await repo.routinen(KONTO)).map((r) => r.id)).toEqual(
    expect.arrayContaining(["h-funktion", funktion.id]),
  );
  const vormachen = new VormachenDienst({ routinen: repo });
  expect((await vormachen.uebersicht(KONTO)).routinen.map((r) => r.id)).toEqual(["h-funktion"]);
  await expect(vormachen.routine(KONTO, funktion.id)).rejects.toMatchObject({ status: 404 });
  expect(
    (
      await new FunktionenDienst({ repo: new RoutinenFunktionenRepo(repo) }).hole(
        KONTO,
        funktion.id,
      )
    ).id,
  ).toBe(funktion.id);
  expect((await vormachen.privatLoeschen(KONTO)).routinen).toBe(2);
  expect(await repo.routinen(KONTO)).toEqual([]);
});

it("H2 · Originalwerte mit Zugangsmustern erreichen weder Trace noch Beschaffungsparameter", async () => {
  const geheim = "Bearer NUR_SYNTHETISCHER_TESTWERT";
  const d = new VormachenDienst();
  const s = d.starte(KONTO, {
    host: "klarwerk_web",
    vorgaenge: ["entwurf_anlegen"],
    zweck: "Bericht",
  });
  d.meldeSichtbar(KONTO, "klarwerk_web", CLIENT);
  d.beobachteArbeitsweg(
    KONTO,
    {
      host: "klarwerk_web",
      vorgang: "entwurf_anlegen",
      beschreibung: "Entwurf anlegen",
      rohwert: geheim,
      felder: { title: geheim, password: "NUR_FIKTIV", statement: "Erlaubter Bericht" },
    },
    CLIENT,
  );
  const roh = (await d.uebersicht(KONTO)).sitzungen.find((x) => x.id === s.id);
  expect(JSON.stringify(roh)).not.toContain(geheim);
  expect(JSON.stringify(roh)).not.toContain("NUR_FIKTIV");
  expect(JSON.stringify(roh)).toContain("Erlaubter Bericht");
  expect(() => entwirfFunktion(`${SATZ} Passwort: NUR_FIKTIV`, "text")).toThrow(/Zugangsdaten/);
  const b = beschaffung();
  const { funktion } = await b.dienst.speichern(
    KONTO,
    { text: SATZ, quellen: ["quelle"] },
    b.lesen,
  );
  await expect(
    b.dienst.laufVorbereiten(
      KONTO,
      funktion.id,
      { parameter: { produkt: geheim, menge: "50 Stück", termin: "2026-11-01" } },
      { rolle: "experte", quelleLesen: b.lesen },
    ),
  ).rejects.toThrow(/Zugangsdaten/);
});

it("H3 · zwei Dienstinstanzen reservieren dieselbe Laufkennung atomar; zweiter Versuch wirkt nicht", async () => {
  const repo = new InMemoryRoutinenRepo();
  await repo.lege(basis());
  const a = new VormachenDienst({ routinen: repo });
  const b = new VormachenDienst({ routinen: repo });
  let beginne!: () => void;
  let ende!: () => void;
  const begonnen = new Promise<void>((r) => {
    beginne = r;
  });
  const warten = new Promise<void>((r) => {
    ende = r;
  });
  let wirkungen = 0;
  const wege = {
    finde: async () => null,
    erzeuge: async () => {
      wirkungen++;
      beginne();
      await warten;
      return "auftrag-einmal";
    },
  };
  const lauf = {
    kennung: "identischer-lauf",
    fassung: 1,
    abdruck: "identischer-abdruck",
    gespraech: "eigenes-gespraech",
  };
  const erster = a.einmalJeLauf(KONTO, "h-funktion", lauf, wege);
  await begonnen;
  await expect(b.einmalJeLauf(KONTO, "h-funktion", lauf, wege)).rejects.toMatchObject({
    status: 409,
  });
  ende();
  expect((await erster).auftragId).toBe("auftrag-einmal");
  expect((await b.einmalJeLauf(KONTO, "h-funktion", lauf, wege)).wiederholt).toBe(true);
  expect(wirkungen).toBe(1);
});

describe("H4 · Beschaffungsserie im D-Takt bleibt ehrlich vorbereitet", () => {
  it("neue Quellenfassung, heutige Rolle, keine alten Parameter, Pause/Reload und keine Doppelwirkung", async () => {
    const b = beschaffung();
    const { funktion } = await b.dienst.speichern(
      KONTO,
      { text: SATZ, quellen: ["quelle"] },
      b.lesen,
    );
    const { funktion: mitSerie } = await b.dienst.setzeZeitauftrag(KONTO, funktion.id, {
      rev: funktion.rev,
      rhythmus: "woechentlich",
      beginn: "2026-10-13",
      uhrzeit: "09:00",
      zeitzone: "UTC",
      nachholen: "einmal",
    });
    expect(mitSerie.laeufe).toEqual([]);
    const jetztLesen = async () => ({
      rolle: "leser",
      quelleLesen: async () => ({ fassung: 7, status: "validiert" }),
    });
    const r = await b.repo.routine(KONTO, funktion.id);
    expect(r).not.toBeNull();
    const ausgelöst = await beschaffungsTermin(r!, JETZT, b.dienst, jetztLesen);
    expect(ausgelöst?.stand).toBe("offen");
    const danach = await b.dienst.hole(KONTO, funktion.id);
    expect(danach.laeufe).toHaveLength(1);
    expect(danach.laeufe[0]).toMatchObject({
      ausloeser: "zeitplan",
      stand: "klaerung_noetig",
      parameterwerte: {},
      rechte: { rolle: "leser" },
      quellen: [{ koId: "quelle", fassung: 7 }],
      aussenwirkung: "keine",
    });
    expect(danach.laeufe[0]?.klaerung).toEqual(
      expect.arrayContaining([expect.objectContaining({ art: "parameter_fehlen" })]),
    );
    const neu = new FunktionenDienst({ repo: new RoutinenFunktionenRepo(b.repo) });
    expect(
      await beschaffungsTermin((await b.repo.routine(KONTO, funktion.id))!, JETZT, neu, jetztLesen),
    ).toBeNull();
    const pausiert = await neu.aendere(
      KONTO,
      funktion.id,
      { rev: danach.rev, stand: "pausiert" },
      b.lesen,
    );
    expect(
      await beschaffungsTermin(
        (await b.repo.routine(KONTO, funktion.id))!,
        JETZT + 7 * 86400_000,
        neu,
        jetztLesen,
      ),
    ).toBeNull();
    expect((await neu.hole(KONTO, funktion.id)).laeufe).toEqual(pausiert.laeufe);
  });
  it("fehlendes heutiges Kontorecht löst keinen Lauf aus", async () => {
    const b = beschaffung();
    const { funktion } = await b.dienst.speichern(
      KONTO,
      { text: SATZ, quellen: ["quelle"] },
      b.lesen,
    );
    await b.dienst.setzeZeitauftrag(KONTO, funktion.id, {
      rev: funktion.rev,
      rhythmus: "monatlich",
      beginn: "2026-09-20",
      uhrzeit: "09:00",
      zeitzone: "UTC",
      nachholen: "einmal",
    });
    expect(
      await beschaffungsTermin(
        (await b.repo.routine(KONTO, funktion.id))!,
        JETZT,
        b.dienst,
        async () => null,
      ),
    ).toBeNull();
    expect((await b.dienst.hole(KONTO, funktion.id)).laeufe).toEqual([]);
  });
});

it("H5 · unter derselben Herkunft entsteht auch nach Ablauf einer Reservierung nur ein Gesprächsauftrag", async () => {
  const repo = new InMemoryKlaraGespraechRepo();
  const a = new KlaraGespraechDienst({ repo });
  const b = new KlaraGespraechDienst({ repo });
  const g = await a.beginne(KONTO, { pfad: "/start", seitenName: "Start", objekt: "Bericht" });
  const ziel = {
    art: "neuer_entwurf",
    id: null,
    titel: "Fiktiver Bericht",
    stand: null,
    pfad: null,
  };
  const eingabe = {
    wortlaut: "Fiktiven Bericht anlegen",
    quelle: "getippt",
    ziel: "Bericht anlegen",
    erlaubteAktionen: ["entwurf_erstellen"],
    erlaubteZiele: [ziel],
    erlaubteQuellen: ["Eigene Testeingabe"],
    ergebnis: "Bericht",
    geplanteSchritte: 1,
    plan: [{ aktion: "entwurf_erstellen", ziel, inhalt: "Fiktiver Bericht" }],
  };
  const h = {
    art: "routine" as const,
    eigentuemer: KONTO,
    routineId: "h-funktion",
    fassung: 1,
    lauf: "einmal",
    abdruck: "gleich",
  };
  // Der echte Auftragseingabetyp wird in den erhaltenen API-Proben geprüft. Hier geht es nur um
  // die zusätzliche Herkunftsidentität; einen gültigen kompakten Auftrag liefert der Dienstparser.
  const erster = await a.legeAuftragAn(KONTO, g.id, eingabe, h);
  expect((await b.legeAuftragAn(KONTO, g.id, eingabe, h)).id).toBe(erster.id);
  expect(await a.auftraege(KONTO, g.id)).toHaveLength(1);
});

it("H6 · ausdrücklicher Webkanal funktioniert ohne Referer; Word und unbekannte Hosts bleiben getrennt", () => {
  expect(hostDerAnfrage({ "x-klarwerk-host": "klarwerk_web" }, {})).toBe("klarwerk_web");
  expect(hostDerAnfrage({ "x-klarwerk-host": "anderes_fenster" }, {})).toBeNull();
  expect(hostDerAnfrage({}, {})).toBeNull();
  expect(
    hostDerAnfrage({ "x-klarwerk-host": "klarwerk_web", "x-klara-session": "eigenes-word" }, {}),
  ).toBe("word");
});
