// ================================================================================================
// produkt:20261011:assistenz-skills-werkzeuge (BPA-11) · GEGENPROBEN ZU BENS NACHARBEIT 2.
// ================================================================================================
//
// Agentenprüfung der Produktanbindung (`assistenz-faehigkeiten-anbindung.ts`) und der dauerhaften
// Ablage im Assistenzprofil — synthetische Daten, kein Netz, kein Modell:
//
//   N1  Die Lage kommt aus den vorhandenen Entscheidungen: KI-Abschaltung und Vertraulich-Freigabe
//       aus dem Reasoner, Stufe der externen Wissensabfrage aus ihrem Admin-Regler; Perplexity hat
//       keine Freigabe. Die Registry installiert nur den vorhandenen Suchweg als Adapter.
//   N2  Aufträge und Hintergrundwarteschlange liegen dauerhaft im Assistenzprofil; ein NEUER Prozess
//       nimmt wartende und unterbrochene Aufträge unter derselben Auftrags-/Wirkungsidentität auf —
//       ohne doppelte Wirkung; ein noch frischer fremder Lauf wird nicht doppelt gestartet.
//   N3  Ein Auftrag ändert die Profilfassung nicht: Name und Motiv bleiben ohne 409 änderbar.
//   N4  Vor jeder Rückgabe eines gespeicherten Ergebnisses gelten die AKTUELLEN Konto- und
//       Kontextrechte; entzogen → gesperrt, ohne die Wirkung zu wiederholen.
//   N5  Vor einer Hintergrundausführung gelten aktuelle Rechte UND die gebundene Kontextfassung.
//   N6  Der Kontext wird nur geladen, wenn das Konto jedes Objekt sehen darf; sonst ohne Hinweis.
import { beforeEach, describe, expect, it } from "vitest";
import {
  AUFBEWAHRTE_ABGESCHLOSSENE_AUFTRAEGE,
  type AdapterAntwort,
  type AdapterKontext,
  type AuftragsEintrag,
  type FaehigkeitsAdapter,
  FaehigkeitsAusfuehrung,
  type Faehigkeitsauftrag,
  type Faehigkeitsbindung,
  Faehigkeitsregistry,
  type Faehigkeitsvertrag,
  GEKUERZT_MELDUNG,
  LAUF_FRIST_MS,
  ProfilFaehigkeitsAblage,
  bindungsFingerabdruck,
} from "../../services/app/src/assistenz-faehigkeiten";
import {
  ladeKontext,
  produktFaehigkeitsLage,
  produktFaehigkeitsregistry,
  produktKontextPruefung,
} from "../../services/app/src/assistenz-faehigkeiten-anbindung";
import {
  AssistenzProfilDienst,
  InMemoryAssistenzProfilRepo,
} from "../../services/app/src/assistenz-profil";
import type { SessionUser } from "../../services/app/src/http";
import {
  ExternalSearchService,
  InMemoryExternalKnowledgePolicyRepo,
} from "../../services/external-search";

const SUCHE: Faehigkeitsvertrag = {
  id: "test-oeffentliche-suche",
  fassung: "1.0.0",
  name: "Testsuche öffentlich",
  beschreibung: "Synthetische Suche über den freigegebenen Wikimedia-Weg.",
  zwecke: ["oeffentliche_recherche"],
  datenempfaenger: {
    art: "extern",
    anbieter: "wikimedia",
    anbieterName: "Wikipedia (Wikimedia)",
    host: "wikipedia.org",
  },
  wirkung: "lesen",
  modell: false,
  aktionen: ["netz_anfrage_anbieter"],
  eingaben: [{ name: "suchbegriff", maxLaenge: 200, pflicht: true }],
  ergebnis: { art: "trefferliste", felder: ["titel", "url", "auszug"], quellenPflicht: true },
  hoechsteSchutzstufe: "oeffentlich",
  grenzen: { maxTreffer: 5, zeitlimitMs: 2_000, kostenJeAufrufCent: 0 },
  kostenzuordnung: null,
  credential: null,
  ruecknahme: "keine_wirkung",
  unterschritte: [],
  verantwortlich: "Testverantwortung",
};

const ENTWURF: Faehigkeitsvertrag = {
  id: "test-entwurf",
  fassung: "1.0.0",
  name: "Testentwurf",
  beschreibung: "Legt einen privaten Entwurf an; idempotent über die Auftragskennung.",
  zwecke: ["entwurf_anlegen"],
  datenempfaenger: { art: "intern" },
  wirkung: "entwurf_schreiben",
  modell: false,
  aktionen: ["wissen_lesen", "entwurf_anlegen"],
  eingaben: [{ name: "titel", maxLaenge: 120, pflicht: true }],
  ergebnis: { art: "entwurf", felder: ["kennung", "titel"], quellenPflicht: false },
  hoechsteSchutzstufe: "streng_vertraulich",
  grenzen: { maxTreffer: 1, zeitlimitMs: 2_000, kostenJeAufrufCent: 0 },
  kostenzuordnung: null,
  credential: null,
  ruecknahme: "entwurf_verwerfen",
  unterschritte: [],
  verantwortlich: "Testverantwortung",
};

const MODELL: Faehigkeitsvertrag = {
  ...ENTWURF,
  id: "test-modell-entwurf",
  zwecke: ["ki_entwurf"],
  modell: true,
};

const TREFFER: AdapterAntwort = {
  status: "ok",
  eintraege: [
    { titel: "Kreiselpumpe", url: "https://de.wikipedia.org/wiki/Kreiselpumpe", auszug: "x" },
  ],
};

interface WissenEintrag {
  confidentiality: "intern" | "vertraulich" | "streng_vertraulich";
  author: string;
  version: number;
  title: string;
  statement: string;
}

let kiAus: boolean;
let vertraulichFrei: boolean;
let policy: InMemoryExternalKnowledgePolicyRepo;
let konten: {
  id: string;
  role: "viewer" | "experte" | "controller" | "admin";
  approved: boolean;
}[];
let wissen: Map<string, WissenEintrag>;
let profile: InMemoryAssistenzProfilRepo;
let suchaufrufe: number;
let entwuerfe: Map<string, string>;

const reasoner = {
  kiAbschaltung: () => ({ abgeschaltet: kiAus }),
  vertraulicheAusleitungFreigegeben: () => vertraulichFrei,
};

const deps = () => ({
  konten: async () => konten,
  wissen: { get: async (id: string) => wissen.get(id) },
  lesbareSpaces: async () => new Set<string>(),
});

function adapter(v: Faehigkeitsvertrag, f: (k: { auftragId: string }) => Promise<AdapterAntwort>) {
  const a: FaehigkeitsAdapter = {
    faehigkeitId: v.id,
    fassung: v.fassung,
    transport: "ersatz",
    fuehreAus: (_eingabe, kontext) => f(kontext),
  };
  return a;
}

function baue(instanz: string, jetzt: () => number = Date.now): FaehigkeitsAusfuehrung {
  const registry = new Faehigkeitsregistry();
  registry.registriere(SUCHE);
  registry.registriere(ENTWURF);
  registry.registriere(MODELL);
  registry.installiereAdapter(
    adapter(SUCHE, async () => {
      suchaufrufe += 1;
      return TREFFER;
    }),
  );
  // Ein schreibender Adapter, der die Auftragskennung als Wirkungsidentität nutzt: derselbe
  // Auftrag ergibt denselben Entwurf, auch nach einem unterbrochenen Lauf.
  const schreiber = async (k: { auftragId: string }): Promise<AdapterAntwort> => {
    const vorhanden = entwuerfe.get(k.auftragId);
    const kennung = vorhanden ?? `entwurf-${entwuerfe.size + 1}`;
    entwuerfe.set(k.auftragId, kennung);
    return { status: "ok", eintraege: [{ kennung, titel: "Notiz" }], wirkungKennung: kennung };
  };
  registry.installiereAdapter(adapter(ENTWURF, schreiber));
  registry.installiereAdapter(adapter(MODELL, schreiber));
  return new FaehigkeitsAusfuehrung({
    registry,
    lage: produktFaehigkeitsLage({ reasoner, externeWissensabfrage: policy }),
    geheimnisse: { hole: () => null },
    ablage: new ProfilFaehigkeitsAblage(profile),
    kontext: produktKontextPruefung(deps()),
    instanz,
    jetzt,
  });
}

let zaehler = 0;
function auftrag(teil: Partial<Faehigkeitsauftrag>): Faehigkeitsauftrag {
  zaehler += 1;
  return {
    auftragId: `n-auftrag-${zaehler}`,
    mandant: "instanz",
    nutzer: "ada",
    sitzung: "s1",
    arbeitsbereich: "projekt-pumpe",
    zweck: "oeffentliche_recherche",
    gewaehlt: null,
    eingabe: { suchbegriff: "Kreiselpumpe" },
    kontext: [],
    ausloeser: "nutzerauftrag",
    ...teil,
  };
}

async function binde(
  a: FaehigkeitsAusfuehrung,
  x: Faehigkeitsauftrag,
): Promise<Faehigkeitsbindung> {
  const v = await a.bereiteVor(x);
  if (v.art !== "gebunden") {
    throw new Error(`nicht gebunden: ${v.stand} ${v.erklaerung}`);
  }
  return v.bindung;
}

const KONTEXT_KO = { kennung: "ko-1", fassung: "1", schutz: "intern" as const, text: "Pumpe" };

beforeEach(() => {
  kiAus = false;
  vertraulichFrei = false;
  policy = new InMemoryExternalKnowledgePolicyRepo();
  konten = [{ id: "ada", role: "experte", approved: true }];
  wissen = new Map([
    [
      "ko-1",
      {
        confidentiality: "intern",
        author: "bert",
        version: 1,
        title: "Pumpe",
        statement: "Wartung",
      },
    ],
  ]);
  profile = new InMemoryAssistenzProfilRepo();
  suchaufrufe = 0;
  entwuerfe = new Map();
});

describe("N1 · die Lage kommt aus den vorhandenen Entscheidungen", () => {
  it("KI-Abschaltung, Vertraulich-Freigabe und Stufe der externen Abfrage werden je Aufruf frisch gelesen", async () => {
    const lage = produktFaehigkeitsLage({ reasoner, externeWissensabfrage: policy });
    expect(await lage({ mandant: "instanz", nutzer: "ada" })).toEqual({
      keineKi: false,
      externeWissensabfrage: "search_on_click",
      vertraulichNachExtern: false,
      freigegebeneAnbieter: ["wikimedia"],
    });
    kiAus = true;
    vertraulichFrei = true;
    await policy.setStage("blocked");
    expect(await lage({ mandant: "instanz", nutzer: "ada" })).toEqual({
      keineKi: true,
      externeWissensabfrage: "blocked",
      vertraulichNachExtern: true,
      freigegebeneAnbieter: [],
    });
    await policy.setStage("open");
    expect((await lage({ mandant: "instanz", nutzer: "ada" })).freigegebeneAnbieter).toEqual([
      "wikimedia",
    ]);
  });

  it("Keine KI aus dem Reasoner sperrt die Modellfähigkeit; gesperrte Stufe sperrt die externe Suche", async () => {
    const a = baue("A");
    kiAus = true;
    const ki = await a.bereiteVor(auftrag({ zweck: "ki_entwurf", eingabe: { titel: "x" } }));
    expect(ki.art === "offen" && ki.stand).toBe("gesperrt");
    expect(ki.art === "offen" && ki.voraussetzungen.map((v) => v.art)).toContain("keine_ki");
    // Die Suche nutzt kein Modell — sie bleibt unter Keine KI verfügbar.
    expect((await a.bereiteVor(auftrag({}))).art).toBe("gebunden");
    await policy.setStage("blocked");
    const extern = await a.bereiteVor(auftrag({}));
    expect(extern.art === "offen" && extern.voraussetzungen.map((v) => v.art).sort()).toEqual([
      "anbieter",
      "freigabe_extern",
    ]);
    expect(suchaufrufe).toBe(0);
  });

  it("die Produktregistry installiert nur den vorhandenen Suchweg; Perplexity bleibt ohne Adapter", async () => {
    const ohne = produktFaehigkeitsregistry(undefined);
    expect(ohne.eintrag("wikipedia-suche")?.adapter).toBeNull();
    expect(ohne.eintrag("perplexity-suche")?.adapter).toBeNull();
    const suche = new ExternalSearchService({
      provider: { name: "Wikipedia", search: async () => [] },
    });
    const mit = produktFaehigkeitsregistry(suche);
    expect(mit.eintrag("wikipedia-suche")?.adapter?.transport).toBe("echt");
    expect(mit.eintrag("perplexity-suche")?.adapter).toBeNull();
  });
});

describe("N2 · dauerhafte Aufträge und Wiederaufnahme nach Neustart", () => {
  it("ein Hintergrundauftrag liegt im Profil und wird von einem NEUEN Prozess ausgeführt", async () => {
    const alt = baue("prozess-alt");
    const b = await binde(alt, auftrag({}));
    expect((await alt.starteImHintergrund(b)).stand).toBe("wartet");
    const gespeichert = (await profile.hole("ada"))?.faehigkeitsAuftraege ?? [];
    expect(gespeichert.map((e) => [e.auftragId, e.zustand])).toEqual([[b.auftragId, "wartet"]]);
    expect(await profile.kontenMitOffenenFaehigkeitsauftraegen()).toEqual(["ada"]);

    // „Neustart": ein neues Ausführungsobjekt, dieselbe Ablage.
    const neu = baue("prozess-neu");
    const [r] = await neu.arbeiteWarteschlangeAb();
    expect(r?.stand).toBe("erfolgreich");
    expect(r?.versuch).toBe(1);
    expect(suchaufrufe).toBe(1);
    expect(await profile.kontenMitOffenenFaehigkeitsauftraegen()).toEqual([]);
    // Ein zweiter Durchlauf findet nichts mehr.
    expect(await neu.arbeiteWarteschlangeAb()).toEqual([]);
    expect(suchaufrufe).toBe(1);
  });

  it("ein unterbrochener schreibender Lauf wird unter derselben Wirkungsidentität fortgesetzt", async () => {
    const jetzt = Date.parse("2026-10-11T12:00:00.000Z");
    const alt = baue("prozess-alt", () => jetzt - LAUF_FRIST_MS - 1_000);
    const b = await binde(alt, auftrag({ zweck: "entwurf_anlegen", eingabe: { titel: "Notiz" } }));
    // Der alte Prozess hatte den Auftrag beansprucht und den Entwurf schon angelegt, bevor er
    // abbrach — der Ergebnisschreibvorgang fehlt.
    entwuerfe.set(b.auftragId, "entwurf-1");
    const unterbrochen: AuftragsEintrag = {
      auftragId: b.auftragId,
      fingerabdruck: bindungsFingerabdruck(b),
      bindung: b,
      zustand: "laeuft",
      versuch: 1,
      instanz: "prozess-alt",
      seit: new Date(jetzt - LAUF_FRIST_MS - 1_000).toISOString(),
      ergebnis: null,
    };
    expect(await profile.schreibeFaehigkeitsauftraege("ada", [], [unterbrochen])).toBe(true);

    const neu = baue("prozess-neu", () => jetzt);
    const [r] = await neu.arbeiteWarteschlangeAb();
    expect(r?.stand).toBe("erfolgreich");
    expect(r?.versuch).toBe(2);
    expect(r?.wirkungKennung).toBe("entwurf-1");
    expect(entwuerfe.size).toBe(1);
    // Wiederholung danach: gespeichertes Ergebnis, keine neue Wirkung.
    const wieder = await neu.fuehreAus(b);
    expect(wieder.wiederholt).toBe(true);
    expect(entwuerfe.size).toBe(1);
  });

  it("ein frischer Lauf eines anderen Prozesses wird nicht doppelt gestartet", async () => {
    const jetzt = Date.parse("2026-10-11T12:00:00.000Z");
    const neu = baue("prozess-neu", () => jetzt);
    const b = await binde(neu, auftrag({}));
    const fremd: AuftragsEintrag = {
      auftragId: b.auftragId,
      fingerabdruck: bindungsFingerabdruck(b),
      bindung: b,
      zustand: "laeuft",
      versuch: 1,
      instanz: "anderer-prozess",
      seit: new Date(jetzt - 1_000).toISOString(),
      ergebnis: null,
    };
    await profile.schreibeFaehigkeitsauftraege("ada", [], [fremd]);
    expect(await neu.arbeiteWarteschlangeAb()).toEqual([]);
    expect((await neu.fuehreAus(b)).stand).toBe("laeuft");
    expect(suchaufrufe).toBe(0);
  });
});

describe("N3 · ein Auftrag ändert die Profilfassung nicht", () => {
  it("ohne Profil bleibt die Einrichtung offen; Name und Motiv sind danach ohne Konflikt speicherbar", async () => {
    const a = baue("A");
    await a.fuehreAus(await binde(a, auftrag({})));
    const dienst = new AssistenzProfilDienst({ repo: profile });
    expect(await dienst.hole("ada")).toBeNull();
    const p = await dienst.aendere("ada", {
      name: "Klara",
      avatar: "eule",
      einrichtungAbschliessen: true,
      fassung: 0,
    });
    expect(p.fassung).toBe(1);
    // Ein weiterer Auftrag dazwischen — die Fassung, die der Client kennt, bleibt gültig.
    await a.fuehreAus(await binde(a, auftrag({})));
    expect((await dienst.aendere("ada", { name: "Klara 2", fassung: 1 })).name).toBe("Klara 2");
    // Und die Aufträge sind beim Profilschreiben nicht verloren gegangen.
    expect((await profile.hole("ada"))?.faehigkeitsAuftraege).toHaveLength(2);
  });
});

describe("N4 · gespeicherte Ergebnisse nur mit aktuellen Rechten", () => {
  it("entzogenes Kontextrecht sperrt die Rückgabe, ohne die Wirkung zu wiederholen", async () => {
    const a = baue("A");
    const b = await binde(a, auftrag({ kontext: [KONTEXT_KO] }));
    expect((await a.fuehreAus(b)).stand).toBe("erfolgreich");
    expect(suchaufrufe).toBe(1);

    // Das Kontextobjekt wird vertraulich (fremder Autor) — ein Experte darf es nicht mehr sehen.
    wissen.set("ko-1", {
      ...(wissen.get("ko-1") as WissenEintrag),
      confidentiality: "vertraulich",
    });
    const wieder = await a.fuehreAus(b);
    expect(wieder.stand).toBe("gesperrt");
    expect(wieder.eintraege).toEqual([]);
    expect(wieder.voraussetzungen.map((v) => v.art)).toEqual(["kontextrecht"]);
    expect(JSON.stringify(wieder)).not.toContain("Pumpe");
    expect(suchaufrufe).toBe(1);
    const sicht = await a.auftrag("ada", b.auftragId);
    expect(sicht?.ergebnis?.stand).toBe("gesperrt");
    expect(sicht?.ergebnis?.eintraege).toEqual([]);
    expect((await a.auftraege("ada"))[0]?.ergebnis?.eintraege).toEqual([]);
    // Der gespeicherte Stand ist unverändert — die Sperre ist eine Rückgabeentscheidung.
    const gespeichert = (await profile.hole("ada"))?.faehigkeitsAuftraege?.[0];
    expect(gespeichert?.ergebnis?.stand).toBe("erfolgreich");

    // Recht wieder da → das Ergebnis ist wieder lesbar, weiterhin ohne neue Wirkung.
    wissen.set("ko-1", { ...(wissen.get("ko-1") as WissenEintrag), confidentiality: "intern" });
    expect((await a.fuehreAus(b)).eintraege).toHaveLength(1);
    expect(suchaufrufe).toBe(1);
  });

  it("ein gesperrtes Konto oder ein gelöschtes Objekt sperrt ebenso", async () => {
    const a = baue("A");
    const b = await binde(a, auftrag({ kontext: [KONTEXT_KO] }));
    await a.fuehreAus(b);
    konten = [{ id: "ada", role: "experte", approved: false }];
    expect((await a.fuehreAus(b)).stand).toBe("gesperrt");
    konten = [{ id: "ada", role: "experte", approved: true }];
    wissen.delete("ko-1");
    expect((await a.auftrag("ada", b.auftragId))?.ergebnis?.stand).toBe("gesperrt");
    expect(suchaufrufe).toBe(1);
  });

  it("fremde Konten sehen den Auftrag nicht", async () => {
    const a = baue("A");
    const b = await binde(a, auftrag({}));
    await a.fuehreAus(b);
    expect(await a.auftrag("erik", b.auftragId)).toBeNull();
    expect(await a.auftraege("erik")).toEqual([]);
    expect(await a.brecheAb("erik", b.auftragId)).toBe(false);
  });
});

describe("N5 · Hintergrundausführung mit aktuellen Rechten und gebundener Kontextfassung", () => {
  it("geänderte Kontextfassung → neu vorbereiten; entzogenes Recht → gesperrt; ohne Aufruf", async () => {
    const a = baue("A");
    const b1 = await binde(a, auftrag({ kontext: [KONTEXT_KO] }));
    await a.starteImHintergrund(b1);
    wissen.set("ko-1", { ...(wissen.get("ko-1") as WissenEintrag), version: 2 });
    const [r1] = await a.arbeiteWarteschlangeAb();
    expect(r1?.stand).toBe("voraussetzung_fehlt");
    expect(r1?.voraussetzungen.map((v) => v.art)).toContain("kontext_geaendert");

    const b2 = await binde(a, auftrag({ kontext: [{ ...KONTEXT_KO, fassung: "2" }] }));
    await a.starteImHintergrund(b2);
    wissen.set("ko-1", {
      ...(wissen.get("ko-1") as WissenEintrag),
      confidentiality: "vertraulich",
    });
    const [r2] = await a.arbeiteWarteschlangeAb();
    expect(r2?.stand).toBe("gesperrt");
    expect(suchaufrufe).toBe(0);
  });
});

describe("N6 · der Kontext wird mit den Rechten des Kontos geladen", () => {
  it("sichtbar → Kennung, Fassung, Stufe und Text; verborgen oder unbekannt → null ohne Hinweis", async () => {
    const ada: SessionUser = { id: "ada", role: "experte", spaceLesbar: new Set() };
    expect(await ladeKontext(deps(), ada, ["ko-1"])).toEqual([
      { kennung: "ko-1", fassung: "1", schutz: "intern", text: "Pumpe\nWartung" },
    ]);
    expect(await ladeKontext(deps(), ada, ["ko-1", "gibt-es-nicht"])).toBeNull();
    wissen.set("ko-1", {
      ...(wissen.get("ko-1") as WissenEintrag),
      confidentiality: "vertraulich",
    });
    expect(await ladeKontext(deps(), ada, ["ko-1"])).toBeNull();
  });
});

// ------------------------------------------------------------------------------------------------
// Ben Nacharbeit 5 — Befunde 2 bis 4.
//
//   N7  Vor jedem abhängigen Unterschritt gelten die AKTUELLEN Kontextrechte und -fassungen; die
//       tatsächlich weitergegebenen Daten werden gegen die Grenzen des Empfängers geprüft.
//   N8  Die Aufbewahrungsgrenze entfernt Ergebnisinhalte, nicht die Auftragsidentität: eine
//       Wiederholung einer alten Kennung löst keine zweite Wirkung aus.
//   N9  Ein Abbruch ist dauerhaft: ein wartender Auftrag startet auch in einem anderen Prozess nicht,
//       ein laufender startet keinen abhängigen Unterschritt mehr.
// ------------------------------------------------------------------------------------------------

const KETTE: Faehigkeitsvertrag = {
  ...SUCHE,
  id: "test-kette",
  zwecke: ["kette"],
  unterschritte: [{ id: "nachsuche", datenempfaenger: SUCHE.datenempfaenger, modell: false }],
};

function baueKette(
  instanz: string,
  fuehreAus: (k: AdapterKontext) => Promise<AdapterAntwort>,
): FaehigkeitsAusfuehrung {
  const registry = new Faehigkeitsregistry();
  registry.registriere(KETTE);
  registry.installiereAdapter({
    faehigkeitId: KETTE.id,
    fassung: KETTE.fassung,
    transport: "ersatz",
    fuehreAus: (_eingabe, k) => fuehreAus(k),
  });
  return new FaehigkeitsAusfuehrung({
    registry,
    lage: produktFaehigkeitsLage({ reasoner, externeWissensabfrage: policy }),
    geheimnisse: { hole: () => null },
    ablage: new ProfilFaehigkeitsAblage(profile),
    kontext: produktKontextPruefung(deps()),
    instanz,
  });
}

describe("N7 · abhängige Unterschritte mit aktuellen Rechten, Fassungen und Empfängergrenzen", () => {
  let nachsuche: number;
  beforeEach(() => {
    nachsuche = 0;
  });

  it("Rechteentzug während des Adapters sperrt den folgenden Unterschritt", async () => {
    const a = baueKette("A", async (k) => {
      wissen.set("ko-1", {
        ...(wissen.get("ko-1") as WissenEintrag),
        confidentiality: "vertraulich",
      });
      await k.unterschritt("nachsuche", async () => {
        nachsuche += 1;
      });
      return TREFFER;
    });
    const r = await a.fuehreAus(await binde(a, auftrag({ zweck: "kette", kontext: [KONTEXT_KO] })));
    expect(r.stand).toBe("gesperrt");
    expect(r.voraussetzungen.map((v) => v.art)).toContain("kontextrecht");
    expect(nachsuche).toBe(0);
  });

  it("eine während des Adapters geänderte Kontextfassung sperrt den Unterschritt", async () => {
    const a = baueKette("A", async (k) => {
      wissen.set("ko-1", { ...(wissen.get("ko-1") as WissenEintrag), version: 2 });
      await k.unterschritt("nachsuche", async () => {
        nachsuche += 1;
      });
      return TREFFER;
    });
    const r = await a.fuehreAus(await binde(a, auftrag({ zweck: "kette", kontext: [KONTEXT_KO] })));
    expect(r.voraussetzungen.map((v) => v.art)).toContain("kontext_geaendert");
    expect(r.stand).not.toBe("erfolgreich");
    expect(nachsuche).toBe(0);
  });

  it("weitergegebene Daten mit geschütztem Kontextinhalt gehen nicht an den externen Empfänger", async () => {
    wissen.set("ko-2", {
      confidentiality: "intern",
      author: "bert",
      version: 1,
      title: "Wartungsplan",
      statement: "Das Wartungsintervall beträgt 400 Stunden laut Hausnorm",
    });
    const ko2 = { kennung: "ko-2", fassung: "1", schutz: "intern" as const, text: "x" };
    let daten: Record<string, string> = { q: "Wartungsintervall beträgt 400 Stunden" };
    const a = baueKette("A", async (k) => {
      await k.unterschritt(
        "nachsuche",
        async () => {
          nachsuche += 1;
        },
        daten,
      );
      return TREFFER;
    });
    const leck = await a.fuehreAus(await binde(a, auftrag({ zweck: "kette", kontext: [ko2] })));
    expect(leck.stand).toBe("gesperrt");
    expect(leck.voraussetzungen.map((v) => v.art)).toContain("vertraulich");
    expect(JSON.stringify(leck)).not.toContain("400 Stunden");
    expect(nachsuche).toBe(0);

    daten = { q: "Kreiselpumpe Herstellerangaben" };
    const neutral = await a.fuehreAus(await binde(a, auftrag({ zweck: "kette", kontext: [ko2] })));
    expect(neutral.stand).toBe("erfolgreich");
    expect(nachsuche).toBe(1);
  });
});

describe("N8 · Aufbewahrungsgrenze ohne Verlust der Auftragsidentität", () => {
  it("die älteste Kennung bleibt erkannt — gekürzt, ohne zweite Wirkung", async () => {
    let uhr = Date.parse("2026-10-11T08:00:00.000Z");
    const a = baue("A", () => {
      uhr += 1_000;
      return uhr;
    });
    const bindungen: Faehigkeitsbindung[] = [];
    for (let i = 0; i <= AUFBEWAHRTE_ABGESCHLOSSENE_AUFTRAEGE; i++) {
      const b = await binde(a, auftrag({}));
      bindungen.push(b);
      expect((await a.fuehreAus(b)).stand).toBe("erfolgreich");
    }
    expect(suchaufrufe).toBe(AUFBEWAHRTE_ABGESCHLOSSENE_AUFTRAEGE + 1);
    const gespeichert = (await profile.hole("ada"))?.faehigkeitsAuftraege ?? [];
    expect(gespeichert).toHaveLength(AUFBEWAHRTE_ABGESCHLOSSENE_AUFTRAEGE + 1);
    const erste = bindungen[0] as Faehigkeitsbindung;
    const alt = gespeichert.find((e) => e.auftragId === erste.auftragId);
    expect(alt?.gekuerzt).toBe(true);
    expect(alt?.ergebnis?.eintraege).toEqual([]);
    expect(alt?.bindung.eingabe).toEqual({});
    expect(alt?.fingerabdruck).toBe(bindungsFingerabdruck(erste));

    const wieder = await a.fuehreAus(erste);
    expect(wieder.wiederholt).toBe(true);
    expect(wieder.stand).toBe("erfolgreich");
    expect(wieder.meldung).toBe(GEKUERZT_MELDUNG);
    expect(suchaufrufe).toBe(AUFBEWAHRTE_ABGESCHLOSSENE_AUFTRAEGE + 1);
  });
});

describe("N9 · dauerhafter Abbruch", () => {
  it("ein wartender Auftrag, abgebrochen von einem anderen Prozess, startet nirgends mehr", async () => {
    const einsteller = baue("prozess-einsteller");
    const b = await binde(einsteller, auftrag({}));
    await einsteller.starteImHintergrund(b);
    // Ein zweiter Prozess ohne lokalen Lauf vermerkt den Abbruch dauerhaft.
    expect(await baue("prozess-abbruch").brecheAb("ada", b.auftragId)).toBe(true);
    // Ein dritter Prozess arbeitet die Warteschlange ab (Wiederanlauf).
    const [r] = await baue("prozess-neu").arbeiteWarteschlangeAb();
    expect(r?.stand).toBe("abgebrochen");
    expect(suchaufrufe).toBe(0);
    expect(await profile.kontenMitOffenenFaehigkeitsauftraegen()).toEqual([]);
    // Der Abbruch ist für diese Kennung endgültig.
    const wieder = await baue("prozess-vier").fuehreAus(b);
    expect(wieder.stand).toBe("abgebrochen");
    expect(suchaufrufe).toBe(0);
    // Ein fertiger oder unbekannter Auftrag ist nicht abbrechbar.
    expect(await baue("prozess-vier").brecheAb("ada", b.auftragId)).toBe(false);
    expect(await baue("prozess-vier").brecheAb("ada", "gibt-es-nicht")).toBe(false);
  });

  it("ein in Prozess A laufender Auftrag, abgebrochen in Prozess B, startet keinen Unterschritt", async () => {
    let weiter: () => void = () => undefined;
    const bereit = new Promise<void>((r) => {
      weiter = r;
    });
    let nachsuche = 0;
    const a = baueKette("prozess-a", async (k) => {
      await bereit;
      await k.unterschritt("nachsuche", async () => {
        nachsuche += 1;
      });
      return TREFFER;
    });
    const b = await binde(a, auftrag({ zweck: "kette" }));
    const lauf = a.fuehreAus(b);
    await new Promise((r) => setTimeout(r, 10));
    expect(await baueKette("prozess-b", async () => TREFFER).brecheAb("ada", b.auftragId)).toBe(
      true,
    );
    weiter();
    const r = await lauf;
    expect(r.stand).toBe("abgebrochen");
    expect(nachsuche).toBe(0);
  });
});
