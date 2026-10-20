// ================================================================================================
// KLARA 10 (produkt:20261007:klara-erinnerungen-kalender) · DIE ERINNERUNGSSTEUERUNG.
// ================================================================================================
//
// Gemessen an Dienst und Steuerung aus `services/app/src/klara-erinnerung.ts` über die echte
// Speicherablage, mit einer Uhr, die der Test stellt. „Gespräch geschlossen" ist hier der
// Normalfall: die Steuerung kennt weder Sitzung noch Gespräch. „Neustart" ist eine NEUE
// Steuerungsinstanz über derselben Ablage; „zwei Prozesse" sind zwei Instanzen gleichzeitig.
// Die Postgres-Fassung derselben Zusagen misst `erinnerung-pg.integration.test.ts`.
// ATTRAPPEN, ausdrücklich: Ablagen, die auf Kommando nach dem Schreiben bzw. beim Bestätigen
// „abstürzen", eine Aufgabenablage, die ausfällt, und die Kontolage (gesperrt, ausgeschieden).
//
//   S1 (K3, AW18-K12)  Fällige Erinnerung wird ohne Gespräch zugestellt — genau einmal, nur an sie.
//   S2 (AW18-K04)      Zwei Prozesse gleichzeitig: eine Wirkung; ein gehaltener Lauf wird nicht
//                      angefasst.
//   S3 (K4, AW18-K05, P07-AC07) Stillstand vor Fälligkeit, Neustart: nachholen / nur melden /
//                      zusammenfassen / überspringen — mehrere verpasste Läufe, Grenzzeit, keine
//                      doppelte Aktion, die Person wird in jedem Fall benachrichtigt.
//   S4 (AW18-K06)      Absturz nach Wirkung: Readback statt Wiederholung; unklarer Ausgang wartet.
//   S5 (AW18-K07)      Abhängige Prüfung fällt aus — die Erinnerung kommt trotzdem (teilweise).
//   S6 (AW18-K08, P07) Rechteentzug/Ausscheiden stoppt; gelöschte Quelle pausiert NUR diesen Lauf
//                      bis zur ausdrücklichen Entscheidung.
//   S7 (AW18-K09, K2, K5) Einzeltermin, folgende Termine und ganze Serie getrennt; Pausieren,
//                      Absagen, Rücknahme, Erledigen, Abbruch — nichts Vergangenes wird wiederbelebt.
//   S8 (AW18-K10/K11)  Lage aus Lauf statt Uhr; Überwachung mit Rückstau und Fehlschlägen.
//   S9 (AW18-K12)      Wiederherstellung aus einer Sicherung ohne Laufabschluss: keine Doppelmeldung.
//   S10 (K5, AW18-K08) Nacharbeit 2: Konto, Status und Termin werden vor JEDER Wirkung neu gelesen —
//                      zwischen zwei Zustellungen eines Takts, unmittelbar vor dem (bedingten)
//                      Schreiben, im Sammelweg und in der Wiederaufnahme.
//   S11 (AW18-K08)     Bewusste Übergabe: heutige Rechte der Zuständigen, nur Titel/Termine, Rücknahme.
//   S12 (AW-18)        Bestellte Zusammenfassung über den KI-Weg; Ausfall → teilweise, Erinnerung kommt.
//   S13 (P07)          Einrichtungsassistent: Vorgaben je Konto, erneut aufrufbar, nur für Neues.
//   S15 (EQF-07, K20–K29) Routinen über DIESELBE Steuerung: Einrichtung ohne Lauf, Bericht mit
//                      Fassungen, Änderung in Worten, Pause gegen spätes Signal/Restore, DST,
//                      Nachholregel, zwei Ausführer/verlorene Antwort/Readback, Teilfehler, Abbruch
//                      vs. Rücknahme, gelöschte Quelle und Kontosperre während des Lesens.
//   S14 (AW18-K08, K5) Nacharbeit 4: Modellantwort angehalten, währenddessen Konto gesperrt bzw.
//                      Quelle gelöscht, dann freigegeben → gestoppt bzw. wartet auf Klärung, keine
//                      Meldung; ohne Änderung wird dieselbe Antwort zugestellt.
//   S16 (EQF-07-K06/K07/K09) Nacharbeit 9: Pause/Ende/Löschung unmittelbar vor dem Speichern des
//                      Berichts; Quellenfassung vor der Wirkung; Fortsetzung des offenen Rests im
//                      selben Bericht (Neustart, Klärung, fremde Bearbeitung geschützt); eine
//                      Handlungsmeldung je Termin bei Fehlschlag.
import { beforeEach, describe, expect, it } from "vitest";
import {
  InMemoryKlaraAufgabeRepo,
  type KlaraAufgabe,
  KlaraAufgabeDienst,
} from "../../services/app/src/klara-aufgabe";
import {
  InMemoryKlaraErinnerungEinstellungRepo,
  InMemoryKlaraErinnerungLaufRepo,
  InMemoryKlaraErinnerungMeldungRepo,
  InMemoryKlaraErinnerungRepo,
  KLARA_ERINNERUNG_LEASE_MS,
  KLARA_ERINNERUNG_MAX_VERSUCHE,
  type KlaraErinnerung,
  type KlaraErinnerungAblage,
  KlaraErinnerungDienst,
  KlaraErinnerungFehler,
  type KlaraErinnerungLauf,
  type KlaraErinnerungMeldung,
  KlaraErinnerungSteuerung,
  type KontoLage,
  type MeldungBedingung,
  type MeldungSchreibergebnis,
  type PersonLage,
  lageVon,
} from "../../services/app/src/klara-erinnerung";
import { loeseMitRegel } from "../../services/app/src/klara-erinnerung-zeit";
import {
  InMemoryKlaraNotizRepo,
  KlaraNotizDienst,
  type NotizSchreibbedingung,
} from "../../services/app/src/klara-notiz";
import {
  deuteRoutinenAenderung,
  ergebnisVorgang,
  routineAus,
} from "../../services/app/src/klara-routine";

const ANNA = "u-erinnerung-anna";
const BERT = "u-erinnerung-bert";
const BERLIN = "Europe/Berlin";
const BEZUG = {
  pfad: "/wissen/ko-presse-4",
  seitenName: "Lesen",
  objekt: "Ölwechsel Presse 4",
  koId: "ko-presse-4",
  fassung: 3,
  absatz: 2,
};

/** Ein Zeitpunkt in Berlin — Oktober 2026 vor dem 25. ist MESZ (UTC+2). */
const um = (datum: string, uhrzeit: string): number =>
  loeseMitRegel({ datum, uhrzeit }, BERLIN, { luecke: "verschieben", doppelt: "erste" })
    .ms as number;

/**
 * Meldungsablage, die auf Kommando NACH dem Schreiben abbricht bzw. beim Zurücklesen ausfällt —
 * und mit `unmittelbarVorher` eine Änderung GENAU zwischen der letzten Prüfung und dem bedingten
 * Schreiben einschiebt (die Gleichzeitigkeit, die Ben verlangt).
 */
class StoerbareMeldungen extends InMemoryKlaraErinnerungMeldungRepo {
  nachSchreibenWerfen = 0;
  vorSchreibenWerfen = false;
  holeKaputt = false;
  unmittelbarVorher: (() => Promise<void>) | null = null;
  nachErfolg: (() => Promise<void>) | null = null;
  schreibversuche = 0;
  override async schreibe(
    m: KlaraErinnerungMeldung,
    bedingung?: MeldungBedingung,
  ): Promise<MeldungSchreibergebnis> {
    this.schreibversuche += 1;
    if (this.vorSchreibenWerfen) {
      throw new Error("Ablage nicht erreichbar");
    }
    const einschub = this.unmittelbarVorher;
    if (einschub) {
      this.unmittelbarVorher = null;
      await einschub();
    }
    const ok = await super.schreibe(m, bedingung);
    const danach = this.nachErfolg;
    if (ok === "geschrieben" && danach) {
      // Etwas ändert sich ZWISCHEN zwei Zustellungen desselben Takts.
      this.nachErfolg = null;
      await danach();
    }
    if (this.nachSchreibenWerfen > 0) {
      this.nachSchreibenWerfen -= 1;
      throw new Error("Verbindung nach dem Schreiben abgerissen");
    }
    return ok;
  }
  override async hole(id: string): Promise<KlaraErinnerungMeldung | null> {
    if (this.holeKaputt) {
      throw new Error("Zurücklesen nicht möglich");
    }
    return super.hole(id);
  }
}

/** Laufablage, deren Bestätigung einmal „abstürzt" — die Wirkung ist dann schon geschehen. */
class StoerbareLaeufe extends InMemoryKlaraErinnerungLaufRepo {
  bestaetigungWerfen = 0;
  /** Nacharbeit 12: der Prozess stirbt beim n-ten Festhalten am gehaltenen Lauf (0 = nie). */
  vermerkeStirbtBei = 0;
  vermerkeAufrufe = 0;
  override async vermerke(
    ...args: Parameters<InMemoryKlaraErinnerungLaufRepo["vermerke"]>
  ): Promise<boolean> {
    this.vermerkeAufrufe += 1;
    if (this.vermerkeStirbtBei > 0 && this.vermerkeAufrufe === this.vermerkeStirbtBei) {
      throw new Error("Prozess beim Festhalten beendet");
    }
    return super.vermerke(...args);
  }
  override async schliesse(
    ...args: Parameters<InMemoryKlaraErinnerungLaufRepo["schliesse"]>
  ): Promise<boolean> {
    if (this.bestaetigungWerfen > 0) {
      this.bestaetigungWerfen -= 1;
      throw new Error("Prozess vor der Bestätigung beendet");
    }
    return super.schliesse(...args);
  }
}

/** Aufgabenablage, die GENAU beim n-ten Lesen ausfällt — eine abhängige Komponente. */
class AusfallendeAufgaben extends InMemoryKlaraAufgabeRepo {
  aufrufe = 0;
  ausfallBei = Number.POSITIVE_INFINITY;
  /** EQF-07: die Aufgabenliste (Routinenabschnitte) ist nicht lesbar. */
  listeKaputt = false;
  /** EQF-07: geschieht WÄHREND die Routine ihre Quellen liest (z. B. Kontosperre). */
  nachListe: (() => void | Promise<void>) | null = null;
  override async liste(
    kontoId: string,
    status: KlaraAufgabe["status"] | null,
    limit: number,
  ): Promise<KlaraAufgabe[]> {
    if (this.listeKaputt) {
      throw new Error("Aufgabenablage nicht erreichbar");
    }
    const r = await super.liste(kontoId, status, limit);
    await this.nachListe?.();
    return r;
  }
  override async hole(kontoId: string, id: string): Promise<KlaraAufgabe | null> {
    this.aufrufe += 1;
    if (this.aufrufe === this.ausfallBei) {
      throw new Error("Aufgabenablage nicht erreichbar");
    }
    return super.hole(kontoId, id);
  }
}

let uhr = 0;
const jetzt = (): number => uhr;
let meldungsAblage: StoerbareMeldungen;
let laufAblage: StoerbareLaeufe;
let ablage: KlaraErinnerungAblage;
let notizen: InMemoryKlaraNotizRepo;
let aufgaben: AusfallendeAufgaben;
let konten: Map<string, KontoLage>;
let dienst: KlaraErinnerungDienst;
let zaehler = 0;
/** Die Zusammenfassung über den KI-Weg — Attrappe; `null`: der Weg fällt aus. */
let zusammenfassen: ((text: string) => Promise<{ text: string; ki: boolean }>) | undefined;

/** Die vorhandenen Konten für die Übergabe — heute gelesen aus `konten`. */
const ADRESSEN: Record<string, string> = {
  "anna@beispiel.test": ANNA,
  "bert@beispiel.test": BERT,
};
function person(id: string): PersonLage | undefined {
  const k = konten.get(id);
  return k ? { id, name: id === ANNA ? "Anna Beispiel" : "Bert Beispiel", ...k } : undefined;
}
const personen = {
  kontoPerAdresse: (email: string) => {
    const id = ADRESSEN[email];
    return Promise.resolve(id ? person(id) : undefined);
  },
  kontoLesen: (id: string) => Promise.resolve(person(id)),
};

const vorgang = (): string => {
  zaehler += 1;
  return `steuerung-${String(zaehler).padStart(4, "0")}`;
};

function steuerung(besitzer = "prozess-a"): KlaraErinnerungSteuerung {
  return new KlaraErinnerungSteuerung({
    ablage,
    konto: (id) => Promise.resolve(konten.get(id)),
    notizen,
    aufgaben,
    jetzt,
    besitzer,
    ...(zusammenfassen ? { zusammenfassen } : {}),
    ergebnisablage,
  });
}

/**
 * EQF-07: die Ergebnisablage „Meine Notizen“ — der echte Notizdienst über derselben Notizablage,
 * mit zwei Störungen auf Kommando: die Antwort nach dem Schreiben geht verloren, oder das
 * Zurücklesen (Readback) ist unmöglich.
 */
const stoerung: {
  antwortVerloren: number;
  readbackKaputt: boolean;
  vorSchreiben: (() => Promise<void>) | null;
  aendernAntwortVerloren: number;
} = { antwortVerloren: 0, readbackKaputt: false, vorSchreiben: null, aendernAntwortVerloren: 0 };
const ergebnisablage = {
  zuVorgang: (kontoId: string, v: string) => {
    if (stoerung.readbackKaputt) {
      return Promise.reject(new Error("Notizablage nicht lesbar"));
    }
    return notizen.zuVorgang(kontoId, v);
  },
  hole: (kontoId: string, id: string) => notizen.hole(kontoId, id),
  lege: async (
    kontoId: string,
    eingabe: Parameters<KlaraNotizDienst["lege"]>[1],
    bedingung?: NotizSchreibbedingung,
  ) => {
    // Nacharbeit 9: geschieht unmittelbar VOR dem tatsächlichen Speichern (Pause, Ende, Löschung).
    const einschub = stoerung.vorSchreiben;
    stoerung.vorSchreiben = null;
    await einschub?.();
    const r = await new KlaraNotizDienst({ repo: notizen, jetzt }).lege(
      kontoId,
      eingabe,
      bedingung,
    );
    if (stoerung.antwortVerloren > 0) {
      stoerung.antwortVerloren -= 1;
      throw new Error("Antwort nach dem Schreiben verloren");
    }
    return r;
  },
  aendere: async (
    kontoId: string,
    id: string,
    eingabe: Parameters<KlaraNotizDienst["aendere"]>[2],
    bedingung?: NotizSchreibbedingung,
  ) => {
    const r = await new KlaraNotizDienst({ repo: notizen, jetzt }).aendere(
      kontoId,
      id,
      eingabe,
      bedingung,
    );
    // Nacharbeit 11: die Berichtsänderung ist geschehen, die Antwort geht verloren.
    if (stoerung.aendernAntwortVerloren > 0) {
      stoerung.aendernAntwortVerloren -= 1;
      throw new Error("Antwort nach der Berichtsänderung verloren");
    }
    return r;
  },
};

beforeEach(() => {
  uhr = Date.parse("2026-10-12T08:00:00.000Z"); // Montag, 10:00 in Berlin
  const erinnerungen = new InMemoryKlaraErinnerungRepo();
  meldungsAblage = new StoerbareMeldungen(erinnerungen);
  laufAblage = new StoerbareLaeufe();
  // Nacharbeit 16: die bedingte Löschung sieht die Läufe desselben Bestands.
  erinnerungen.verbindeLaeufe(laufAblage);
  // Nacharbeit 17: und die Übernahme sieht, ob die Erinnerung noch besteht.
  laufAblage.verbindeErinnerungen(erinnerungen);
  ablage = {
    erinnerungen,
    laeufe: laufAblage,
    meldungen: meldungsAblage,
    einstellungen: new InMemoryKlaraErinnerungEinstellungRepo(),
  };
  notizen = new InMemoryKlaraNotizRepo();
  aufgaben = new AusfallendeAufgaben();
  konten = new Map<string, KontoLage>([
    [ANNA, { approved: true }],
    [BERT, { approved: true }],
  ]);
  zusammenfassen = undefined;
  stoerung.antwortVerloren = 0;
  stoerung.readbackKaputt = false;
  stoerung.vorSchreiben = null;
  stoerung.aendernAntwortVerloren = 0;
  dienst = new KlaraErinnerungDienst({ ablage, notizen, aufgaben, personen, jetzt });
});

async function einmalig(
  titel: string,
  datum: string,
  uhrzeit: string,
  extra: Record<string, unknown> = {},
): Promise<KlaraErinnerung> {
  const { eintrag } = await dienst.lege(ANNA, {
    vorgang: vorgang(),
    titel,
    zeitzone: BERLIN,
    zeitplan: { art: "einmalig", datum, uhrzeit },
    ...extra,
  });
  return eintrag.erinnerung;
}

async function taeglich(
  titel: string,
  datum: string,
  uhrzeit: string,
  anzahl: number,
  extra: Record<string, unknown> = {},
): Promise<KlaraErinnerung> {
  const { eintrag } = await dienst.lege(ANNA, {
    vorgang: vorgang(),
    titel,
    zeitzone: BERLIN,
    zeitplan: {
      art: "serie",
      datum,
      uhrzeit,
      wiederholung: { takt: "taeglich", intervall: 1, bis: null, anzahl },
    },
    ...extra,
  });
  return eintrag.erinnerung;
}

const meldungen = (konto = ANNA): Promise<KlaraErinnerungMeldung[]> =>
  ablage.meldungen.fuerKonto(konto, 1_000);

const meldungenVon = async (id: string): Promise<KlaraErinnerungMeldung[]> =>
  (await meldungen()).filter((m) => m.erinnerungId === id);

const laeufe = (id: string): Promise<KlaraErinnerungLauf[]> =>
  ablage.laeufe.fuerErinnerung(id, 1_000);

async function lage(id: string): Promise<string> {
  const e = await ablage.erinnerungen.holeSystem(id);
  if (!e) {
    throw new Error("Erinnerung fehlt");
  }
  return lageVon(e, await laeufe(id), uhr);
}

async function fassung(id: string): Promise<number> {
  return (await dienst.eintrag(ANNA, id)).erinnerung.fassung;
}

async function notiz(titel: string): Promise<string> {
  const { notiz: n } = await new KlaraNotizDienst({ repo: notizen, jetzt }).lege(ANNA, {
    vorgang: vorgang(),
    weg: "geschrieben",
    inhalt: `${titel} – Inhalt`,
    titel,
    objektbezug: BEZUG,
  });
  return n.id;
}

// ================================================================================================
describe("S1 · K3 / AW18-K12 — zugestellt ohne offenes Gespräch, genau einmal, nur an die Person", () => {
  it("vor dem Termin nichts, zum Termin eine Meldung in ANNAs Glocke — und keine zweite", async () => {
    const e = await einmalig("Filter Presse 4 bestellen", "2026-10-13", "09:00");
    expect((await steuerung().lauf()).zugestellt).toBe(0);
    expect(await lage(e.id)).toBe("geplant");

    uhr = um("2026-10-13", "09:00") + 30_000;
    const bericht = await steuerung().lauf();
    expect(bericht.zugestellt).toBe(1);
    const [m, ...rest] = await meldungen();
    expect(rest).toEqual([]);
    expect(m).toMatchObject({
      kontoId: ANNA,
      erinnerungId: e.id,
      art: "erinnerung",
      titel: "Filter Presse 4 bestellen",
      nachgeholt: false,
      vorkommen: ["2026-10-13T07:00:00.000Z"],
    });
    // Persönlich: niemand sonst bekommt sie.
    expect(await meldungen(BERT)).toEqual([]);

    // Derselbe und ein neuer Prozess (Neustart) liefern nichts nach.
    expect((await steuerung().lauf()).zugestellt).toBe(0);
    expect((await steuerung("prozess-nach-neustart").lauf()).zugestellt).toBe(0);
    expect(await meldungen()).toHaveLength(1);
    const [l] = await laeufe(e.id);
    expect(l).toMatchObject({
      status: "zugestellt",
      versuch: 1,
      vorkommenId: `${e.id}@2026-10-13T09:00`,
    });
    expect(await lage(e.id)).toBe("abgeschlossen");
  });
});

// ================================================================================================
describe("S2 · AW18-K04 — atomare Laufübernahme bei mehreren Prozessen", () => {
  it("zwei Prozesse im selben Augenblick: eine Meldung, ein Lauf, der andere ist belegt", async () => {
    const e = await einmalig("Wochenprüfung Anlage", "2026-10-13", "09:00");
    uhr = um("2026-10-13", "09:00") + 5_000;
    const [a, b] = await Promise.all([
      steuerung("prozess-a").lauf(),
      steuerung("prozess-b").lauf(),
    ]);
    expect(a.zugestellt + b.zugestellt).toBe(1);
    expect(a.belegt + b.belegt).toBe(1);
    expect(await meldungen()).toHaveLength(1);
    const [l] = await laeufe(e.id);
    expect(["prozess-a", "prozess-b"]).toContain(l?.besitzer);
  });

  it("ein Lauf mit gültiger Laufberechtigung eines anderen Prozesses wird nicht angefasst", async () => {
    const e = await einmalig("Gehaltener Lauf", "2026-10-13", "09:00");
    uhr = um("2026-10-13", "09:00") + 5_000;
    const gehalten = await ablage.laeufe.uebernimm({
      vorkommenId: `${e.id}@2026-10-13T09:00`,
      erinnerungId: e.id,
      kontoId: ANNA,
      geplantFuer: um("2026-10-13", "09:00"),
      besitzer: "prozess-langsam",
      jetzt: uhr,
      leaseMs: KLARA_ERINNERUNG_LEASE_MS,
      art: "erinnerung",
      meldungId: `ke-${e.id}@2026-10-13T09:00`,
    });
    expect(gehalten?.versuch).toBe(1);
    const bericht = await steuerung("prozess-b").lauf();
    expect(bericht.belegt).toBe(1);
    expect(await meldungen()).toEqual([]);
    expect((await laeufe(e.id))[0]?.besitzer).toBe("prozess-langsam");
  });
});

// ================================================================================================
describe("S3 · K4 / AW18-K05 / P07-AC07 — Stillstand vor Fälligkeit, Neustart, Regeln", () => {
  it("drei verpasste Läufe je Regel: nachholen, nur melden, zusammenfassen, überspringen", async () => {
    const regeln = ["nachholen", "nur_melden", "zusammenfassen", "ueberspringen"] as const;
    const serien = new Map<string, KlaraErinnerung>();
    for (const regel of regeln) {
      serien.set(
        regel,
        await taeglich(`Täglich (${regel})`, "2026-10-13", "09:00", 5, {
          verpasst: { regel, grenzeMinuten: 30 },
        }),
      );
    }
    // Der Dienst läuft einmal VOR der Fälligkeit und steht dann bis Freitag 09:10.
    expect((await steuerung("vor-dem-halt").lauf()).zugestellt).toBe(0);
    uhr = um("2026-10-16", "09:10");
    const neu = steuerung("nach-dem-neustart");
    const bericht = await neu.lauf();

    const nachholen = await meldungenVon(serien.get("nachholen")?.id ?? "");
    expect(nachholen).toHaveLength(4);
    expect(nachholen.filter((m) => m.nachgeholt)).toHaveLength(3);
    expect(nachholen.every((m) => m.art === "erinnerung")).toBe(true);

    const nurMelden = await meldungenVon(serien.get("nur_melden")?.id ?? "");
    expect(nurMelden.map((m) => m.art).sort()).toEqual([
      "erinnerung",
      "verpasst",
      "verpasst",
      "verpasst",
    ]);

    const zusammen = await meldungenVon(serien.get("zusammenfassen")?.id ?? "");
    const sammel = zusammen.find((m) => m.art === "zusammenfassung");
    expect(zusammen).toHaveLength(2);
    expect(sammel?.vorkommen).toEqual([
      "2026-10-13T07:00:00.000Z",
      "2026-10-14T07:00:00.000Z",
      "2026-10-15T07:00:00.000Z",
    ]);

    const ueber = await meldungenVon(serien.get("ueberspringen")?.id ?? "");
    const hinweis = ueber.find((m) => m.art === "uebersprungen");
    expect(ueber).toHaveLength(2);
    expect(hinweis?.vorkommen).toHaveLength(3);

    // Jeder Lauf trägt sein Ergebnis — je Regel ein eigener Status.
    const status = async (regel: (typeof regeln)[number]) =>
      (await laeufe(serien.get(regel)?.id ?? "")).map((l) => l.status).sort();
    expect(await status("nachholen")).toEqual(Array(4).fill("zugestellt"));
    expect(await status("nur_melden")).toEqual([
      "verpasst_gemeldet",
      "verpasst_gemeldet",
      "verpasst_gemeldet",
      "zugestellt",
    ]);
    expect(await status("zusammenfassen")).toEqual([
      "zugestellt",
      "zusammengefasst",
      "zusammengefasst",
      "zusammengefasst",
    ]);
    expect(await status("ueberspringen")).toEqual([
      "uebersprungen",
      "uebersprungen",
      "uebersprungen",
      "zugestellt",
    ]);
    expect(bericht).toMatchObject({
      nachgeholt: 3,
      verpasstGemeldet: 3,
      zusammengefasst: 3,
      uebersprungen: 3,
      zugestellt: 4,
    });

    // Keine doppelte Aktion: derselbe Prozess, ein weiterer Neustart.
    const vorher = (await meldungen()).length;
    await neu.lauf();
    await steuerung("zweiter-neustart").lauf();
    expect(await meldungen()).toHaveLength(vorher);

    // Am nächsten Morgen geht es regulär weiter — je Serie genau eine neue Meldung.
    uhr = um("2026-10-17", "09:00") + 10_000;
    expect((await steuerung().lauf()).zugestellt).toBe(4);
    expect(await meldungen()).toHaveLength(vorher + 4);
  });

  it("Grenzzeit: genau an der Grenze ist pünktlich, eine Minute darüber verpasst", async () => {
    const puenktlich = await einmalig("An der Grenze", "2026-10-13", "09:00", {
      verpasst: { regel: "nur_melden", grenzeMinuten: 30 },
    });
    const knapp = await einmalig("Knapp darüber", "2026-10-13", "08:59", {
      verpasst: { regel: "nur_melden", grenzeMinuten: 30 },
    });
    uhr = um("2026-10-13", "09:30"); // 30 bzw. 31 Minuten nach dem Termin
    await steuerung().lauf();
    expect((await meldungenVon(puenktlich.id))[0]).toMatchObject({
      art: "erinnerung",
      nachgeholt: false,
    });
    expect((await meldungenVon(knapp.id))[0]).toMatchObject({ art: "verpasst", nachgeholt: true });
  });
});

// ================================================================================================
describe("S4 · AW18-K06 — Absturz nach der Wirkung: Readback statt Wiederholung", () => {
  it("Verbindung reißt NACH dem Schreiben: der nächste Versuch liest zurück — eine Meldung", async () => {
    const e = await einmalig("Nach dem Schreiben", "2026-10-13", "09:00");
    uhr = um("2026-10-13", "09:00") + 10_000;
    meldungsAblage.nachSchreibenWerfen = 1;
    const bericht = await steuerung().lauf();
    // Erst gescheitert, im selben Takt übernommen und per Readback bestätigt — ohne zweite Meldung.
    expect(bericht.fehlgeschlagen).toBe(1);
    expect(bericht.dedupliziert).toBe(1);
    expect(await meldungen()).toHaveLength(1);
    expect((await laeufe(e.id))[0]).toMatchObject({
      status: "zugestellt",
      versuch: 2,
      ergebnis: { dedupliziert: true },
    });
  });

  it("Prozess stirbt vor der Bestätigung: niemand wiederholt blind; nach Ablauf der Berechtigung Readback", async () => {
    const e = await einmalig("Vor der Bestätigung", "2026-10-13", "09:00");
    uhr = um("2026-10-13", "09:00") + 10_000;
    laufAblage.bestaetigungWerfen = 1;
    const erster = await steuerung("prozess-a").lauf();
    expect(erster.fehler).toBe(1);
    expect(await meldungen()).toHaveLength(1);
    expect((await laeufe(e.id))[0]?.status).toBe("laeuft");

    // Solange die Berechtigung gilt, fasst auch ein anderer Prozess den Lauf nicht an.
    const zweiter = await steuerung("prozess-b").lauf();
    expect(zweiter.dedupliziert + zweiter.zugestellt).toBe(0);
    expect(await meldungen()).toHaveLength(1);

    uhr += KLARA_ERINNERUNG_LEASE_MS + 1_000;
    const dritter = await steuerung("prozess-b").lauf();
    expect(dritter.dedupliziert).toBe(1);
    expect(await meldungen()).toHaveLength(1);
    expect((await laeufe(e.id))[0]).toMatchObject({
      status: "zugestellt",
      besitzer: "prozess-b",
      ergebnis: { dedupliziert: true },
    });
  });

  it("lässt sich der Ausgang nicht zurücklesen, bleibt der Lauf unklar — bis die Person entscheidet", async () => {
    const e = await einmalig("Unklarer Ausgang", "2026-10-13", "09:00");
    uhr = um("2026-10-13", "09:00") + 10_000;
    meldungsAblage.nachSchreibenWerfen = 1;
    meldungsAblage.holeKaputt = true;
    const bericht = await steuerung().lauf();
    expect(bericht.unklar).toBe(1);
    expect((await laeufe(e.id))[0]).toMatchObject({
      status: "unklar",
      ergebnis: { grund: "readback_unmoeglich" },
    });
    expect(await lage(e.id)).toBe("wartet_auf_klaerung");

    // Weitere Takte versuchen NICHTS — kein unbelegtes „genau einmal".
    uhr += 3_600_000;
    await steuerung().lauf();
    expect(await meldungen()).toHaveLength(1);
    expect((await laeufe(e.id))[0]?.status).toBe("unklar");

    // Die Person führt fort; der neue Versuch liest zurück und findet die Meldung.
    meldungsAblage.holeKaputt = false;
    await dienst.klaere(ANNA, e.id, `${e.id}@2026-10-13T09:00`, {
      entscheidung: "fortfuehren",
      fassung: await fassung(e.id),
    });
    expect((await steuerung().lauf()).dedupliziert).toBe(1);
    expect(await meldungen()).toHaveLength(1);
    expect(await lage(e.id)).toBe("abgeschlossen");
  });
});

// ================================================================================================
describe("S5 · AW18-K07 — eine ausgefallene abhängige Prüfung blockiert nicht die Erinnerung", () => {
  it("mit lesbarer Aufgabe: Stand in der Meldung; ohne: Meldung trotzdem, Lauf teilweise", async () => {
    const notizId = await notiz("Prüfprotokoll Halle 2");
    const { aufgabe } = await new KlaraAufgabeDienst({ repo: aufgaben, notizen, jetzt }).lege(
      ANNA,
      {
        vorgang: vorgang(),
        weg: "notiz",
        quelle: { notizId },
      },
    );
    const mitPruefung = (uhrzeit: string) =>
      einmalig("Prüfung Halle 2", "2026-10-13", uhrzeit, {
        bezug: { art: "aufgabe", aufgabeId: aufgabe.id },
        aktion: "aufgabe_pruefen",
      });
    const gut = await mitPruefung("09:00");
    const gestoert = await mitPruefung("10:00");
    const frei = await einmalig("Ohne Abhängigkeit", "2026-10-13", "10:00");

    uhr = um("2026-10-13", "09:00") + 10_000;
    await steuerung().lauf();
    expect((await meldungenVon(gut.id))[0]?.pruefung).toEqual({ art: "aufgabe", status: "offen" });

    // Die Aufgabenablage fällt GENAU beim DRITTEN Lesen aus: das erste ist die Quellenprüfung des
    // Stapels, das zweite die erneute Quellenprüfung vor den abhängigen Schritten (Nacharbeit 2),
    // das dritte die abhängige Prüfung des Aufgabenstands; das vierte (Quellenprüfung NACH dem
    // abhängigen Schritt, Nacharbeit 4) liest wieder.
    aufgaben.aufrufe = 0;
    aufgaben.ausfallBei = 3;
    uhr = um("2026-10-13", "10:00") + 10_000;
    const bericht = await steuerung().lauf();
    expect(bericht.teilweise).toBe(1);
    expect((await meldungenVon(gestoert.id))[0]?.pruefung).toEqual({
      art: "aufgabe",
      status: "nicht_verfuegbar",
    });
    expect((await laeufe(gestoert.id))[0]?.status).toBe("teilweise");
    expect(await lage(gestoert.id)).toBe("teilweise_erledigt");
    // Was nicht davon abhängt, läuft unberührt.
    expect(await meldungenVon(frei.id)).toHaveLength(1);
  });
});

// ================================================================================================
describe("S6 · AW18-K08 / P07 — Rechte heute, und eine gelöschte Quelle pausiert nur ihren Lauf", () => {
  it("gesperrt, ausgeschieden, abgelaufen: keine Wirkung; nach neuer Freigabe nur Kommendes", async () => {
    const e = await taeglich("Tägliche Prüfung", "2026-10-13", "09:00", 4);
    const tag = async (datum: string, lage_: KontoLage) => {
      if (lage_ === undefined) {
        konten.delete(ANNA);
      } else {
        konten.set(ANNA, lage_);
      }
      uhr = um(datum, "09:00") + 10_000;
      return steuerung().lauf();
    };
    expect((await tag("2026-10-13", { approved: false })).gestoppt).toBe(1);
    expect((await tag("2026-10-14", undefined)).gestoppt).toBe(1);
    expect(
      (await tag("2026-10-15", { approved: true, accessExpiresAt: "2026-10-15T00:00:00.000Z" }))
        .gestoppt,
    ).toBe(1);
    expect(await meldungen()).toEqual([]);
    expect((await tag("2026-10-16", { approved: true })).zugestellt).toBe(1);
    // Die gestoppten Termine werden NICHT nachgereicht.
    expect(await meldungen()).toHaveLength(1);
    const status = (await laeufe(e.id)).map((l) => [l.status, l.ergebnis.grund ?? null]);
    expect(status).toEqual([
      ["zugestellt", null],
      ["gestoppt", "konto_gesperrt"],
      ["gestoppt", "konto_gesperrt"],
      ["gestoppt", "konto_gesperrt"],
    ]);
  });

  it("gelöschte Notiz: nur dieser Lauf wartet; Schweigen ist keine Zustimmung; „fortführen“ stellt EINMAL zu", async () => {
    const notizId = await notiz("Lieferant anrufen");
    const betroffen = await einmalig("Lieferant anrufen", "2026-10-13", "09:00", {
      bezug: { art: "notiz", notizId },
    });
    const daneben = await einmalig("Unabhängig", "2026-10-13", "09:00");
    await notizen.entferne(ANNA, notizId);

    uhr = um("2026-10-13", "09:00") + 10_000;
    const bericht = await steuerung().lauf();
    expect(bericht.unklar).toBe(1);
    expect(await meldungenVon(betroffen.id)).toEqual([]);
    expect(await meldungenVon(daneben.id)).toHaveLength(1);
    expect((await laeufe(betroffen.id))[0]).toMatchObject({
      status: "unklar",
      ergebnis: { grund: "quelle_geloescht" },
    });
    expect(await lage(betroffen.id)).toBe("wartet_auf_klaerung");

    // Keine Entscheidung (Dialog geschlossen): Stunden später ist immer noch nichts geschehen.
    uhr += 5 * 3_600_000;
    await steuerung().lauf();
    expect(await meldungenVon(betroffen.id)).toEqual([]);

    await dienst.klaere(ANNA, betroffen.id, `${betroffen.id}@2026-10-13T09:00`, {
      entscheidung: "fortfuehren",
      fassung: await fassung(betroffen.id),
    });
    expect((await dienst.eintrag(ANNA, betroffen.id)).erinnerung.quelleFehltAkzeptiert).toBe(true);
    await steuerung().lauf();
    await steuerung().lauf();
    expect(await meldungenVon(betroffen.id)).toHaveLength(1);
  });

  it("„beenden“ bricht den wartenden Lauf ab und beendet die Erinnerung — ohne Meldung", async () => {
    const notizId = await notiz("Wird gelöscht");
    const e = await einmalig("Wird gelöscht", "2026-10-13", "09:00", {
      bezug: { art: "notiz", notizId },
    });
    await notizen.entferne(ANNA, notizId);
    uhr = um("2026-10-13", "09:00") + 10_000;
    await steuerung().lauf();
    const nach = await dienst.klaere(ANNA, e.id, `${e.id}@2026-10-13T09:00`, {
      entscheidung: "beenden",
      fassung: await fassung(e.id),
    });
    expect(nach.erinnerung.status).toBe("beendet");
    expect((await laeufe(e.id))[0]).toMatchObject({
      status: "abgebrochen",
      ergebnis: { grund: "verworfen" },
    });
    await steuerung().lauf();
    expect(await meldungenVon(e.id)).toEqual([]);
  });
});

// ================================================================================================
describe("S7 · AW18-K09 / K2 / K5 — Einzeltermin, folgende Termine, ganze Serie; Status getrennt", () => {
  async function tick(datum: string, uhrzeit: string): Promise<void> {
    uhr = um(datum, uhrzeit) + 10_000;
    await steuerung().lauf();
  }

  it("absagen und verschieben EINES Termins, „ab hier“ neu — jeweils nur das Gewählte", async () => {
    const e = await taeglich("Rundgang", "2026-10-13", "09:00", 5);
    const id = e.id;
    await dienst.vorkommen(ANNA, id, "2026-10-14T09:00", {
      fassung: await fassung(id),
      aktion: "absagen",
    });
    await dienst.vorkommen(ANNA, id, "2026-10-15T09:00", {
      fassung: await fassung(id),
      aktion: "verschieben",
      datum: "2026-10-15",
      uhrzeit: "18:00",
    });
    const { bisher, neu } = await dienst.abHier(ANNA, id, "2026-10-16T09:00", {
      fassung: await fassung(id),
      zeitplan: {
        art: "serie",
        datum: "2026-10-16",
        uhrzeit: "07:00",
        wiederholung: { takt: "taeglich", intervall: 1, bis: null, anzahl: 5 },
      },
    });
    expect(bisher.erinnerung.zeitplan).toMatchObject({
      wiederholung: { bis: "2026-10-15", anzahl: 3 },
    });
    expect(neu.erinnerung).toMatchObject({
      serieVon: { erinnerungId: id, ab: "2026-10-16T09:00" },
      zeitplan: { datum: "2026-10-16", uhrzeit: "07:00", wiederholung: { anzahl: 2 } },
    });

    for (const [datum, uhrzeit] of [
      ["2026-10-13", "09:00"],
      ["2026-10-14", "09:00"],
      ["2026-10-15", "09:00"],
      ["2026-10-15", "18:00"],
      ["2026-10-16", "07:00"],
      ["2026-10-16", "09:00"],
      ["2026-10-17", "07:00"],
      ["2026-10-17", "09:00"],
      ["2026-10-18", "07:00"],
    ] as const) {
      await tick(datum, uhrzeit);
    }
    const alt = await meldungenVon(id);
    expect(alt.map((m) => m.vorkommen[0]).sort()).toEqual([
      "2026-10-13T07:00:00.000Z",
      "2026-10-15T16:00:00.000Z",
    ]);
    // Der verschobene Termin behält seine Kennung (nominal 09:00).
    expect((await laeufe(id)).map((l) => l.vorkommenId).sort()).toEqual([
      `${id}@2026-10-13T09:00`,
      `${id}@2026-10-15T09:00`,
    ]);
    expect((await meldungenVon(neu.erinnerung.id)).map((m) => m.vorkommen[0]).sort()).toEqual([
      "2026-10-16T05:00:00.000Z",
      "2026-10-17T05:00:00.000Z",
    ]);
    // Vergangenes wird nicht wiederbelebt — weder zugestellt noch abgesagt.
    for (const termin of ["2026-10-13T09:00", "2026-10-14T09:00"]) {
      await expect(
        dienst.vorkommen(ANNA, id, termin, { fassung: await fassung(id), aktion: "zuruecknehmen" }),
      ).rejects.toMatchObject({ status: 409, grund: "zustand" });
    }
  });

  it("die ganze Serie ändern wirkt ab jetzt; Vergangenes bleibt", async () => {
    const e = await taeglich("Morgenrunde", "2026-10-13", "09:00", 3);
    await tick("2026-10-13", "09:00");
    uhr = um("2026-10-13", "12:00");
    await dienst.aendere(ANNA, e.id, {
      fassung: await fassung(e.id),
      zeitplan: {
        art: "serie",
        datum: "2026-10-13",
        uhrzeit: "08:00",
        wiederholung: { takt: "taeglich", intervall: 1, bis: null, anzahl: 3 },
      },
    });
    await tick("2026-10-14", "08:00");
    await tick("2026-10-15", "08:00");
    expect((await meldungenVon(e.id)).map((m) => m.vorkommen[0]).sort()).toEqual([
      "2026-10-13T07:00:00.000Z",
      "2026-10-14T06:00:00.000Z",
      "2026-10-15T06:00:00.000Z",
    ]);
  });

  it("pausieren, fortsetzen, absagen, zurücknehmen, erledigen — ohne Wiederbelebung", async () => {
    const e = await taeglich("Lagerliste", "2026-10-13", "09:00", 7);
    const status = async (aktion: string, datum: string, uhrzeit: string) => {
      uhr = um(datum, uhrzeit);
      return dienst.status(ANNA, e.id, { fassung: await fassung(e.id), aktion });
    };
    await tick("2026-10-13", "09:00");
    await status("pausieren", "2026-10-13", "10:00");
    expect(await lage(e.id)).toBe("pausiert");
    await tick("2026-10-14", "09:00");
    await status("fortsetzen", "2026-10-15", "10:00");
    await tick("2026-10-15", "10:01");
    await tick("2026-10-16", "09:00");
    await status("absagen", "2026-10-16", "10:00");
    await tick("2026-10-17", "09:00");
    await status("zuruecknehmen", "2026-10-17", "10:00");
    await tick("2026-10-17", "10:01");
    await tick("2026-10-18", "09:00");
    await status("erledigen", "2026-10-18", "10:00");
    await tick("2026-10-19", "09:00");
    expect((await meldungenVon(e.id)).map((m) => m.vorkommen[0]).sort()).toEqual([
      "2026-10-13T07:00:00.000Z",
      "2026-10-16T07:00:00.000Z",
      "2026-10-18T07:00:00.000Z",
    ]);
    expect(await lage(e.id)).toBe("erledigt");
    // Ein Status, der nicht passt, wird abgelehnt statt still übergangen.
    await expect(
      dienst.status(ANNA, e.id, { fassung: await fassung(e.id), aktion: "pausieren" }),
    ).rejects.toBeInstanceOf(KlaraErinnerungFehler);
  });
});

// ================================================================================================
describe("S8 · AW18-K10 / K11 — Lage aus dem Lauf, Überwachung mit Rückstau", () => {
  it("geplant → fällig (Zeit vorbei, kein Lauf) → abgeschlossen; Rückstau sichtbar", async () => {
    const e = await einmalig("Lage aus dem Lauf", "2026-10-13", "09:00");
    expect(await lage(e.id)).toBe("geplant");
    expect((await dienst.ueberwachung(ANNA)).rueckstau.anzahl).toBe(0);
    uhr = um("2026-10-13", "09:05");
    // Die Kalenderzeit allein schließt nichts ab.
    expect(await lage(e.id)).toBe("faellig");
    expect((await dienst.ueberwachung(ANNA)).rueckstau).toEqual({
      anzahl: 1,
      aelteste: "2026-10-13T07:00:00.000Z",
    });
    const s = steuerung();
    await s.lauf();
    expect(await lage(e.id)).toBe("abgeschlossen");
    const u = await dienst.ueberwachung(ANNA);
    expect(u.rueckstau.anzahl).toBe(0);
    expect(u.laeufe.zugestellt).toBe(1);
    expect(s.letzterBericht()?.zugestellt).toBe(1);
  });

  it("dauerhaft gestörte Zustellung: begrenzte Versuche, Lage fehlgeschlagen, sichtbar gezählt", async () => {
    const e = await einmalig("Gestört", "2026-10-13", "09:00");
    meldungsAblage.vorSchreibenWerfen = true;
    uhr = um("2026-10-13", "09:00") + 10_000;
    for (let i = 0; i < KLARA_ERINNERUNG_MAX_VERSUCHE + 2; i++) {
      uhr += 60_000;
      await steuerung().lauf();
    }
    expect((await laeufe(e.id))[0]).toMatchObject({
      status: "fehlgeschlagen",
      versuch: KLARA_ERINNERUNG_MAX_VERSUCHE,
    });
    expect(await lage(e.id)).toBe("fehlgeschlagen");
    expect((await dienst.ueberwachung(ANNA)).laeufe.fehlgeschlagen).toBe(1);
    expect(await meldungen()).toEqual([]);
    // Behoben und bewusst fortgeführt: genau eine Meldung.
    meldungsAblage.vorSchreibenWerfen = false;
    await dienst.klaere(ANNA, e.id, `${e.id}@2026-10-13T09:00`, {
      entscheidung: "fortfuehren",
      fassung: await fassung(e.id),
    });
    await steuerung().lauf();
    expect(await meldungen()).toHaveLength(1);
  });
});

// ================================================================================================
describe("S9 · AW18-K12 — Wiederherstellung ohne Laufabschluss stellt nicht doppelt zu", () => {
  it("Sicherung enthält Erinnerung und Meldung, aber keinen Lauf: nach dem Restore eine Meldung", async () => {
    const e = await einmalig("Vor der Sicherung", "2026-10-13", "09:00");
    const vorher = await ablage.erinnerungen.holeSystem(e.id);
    uhr = um("2026-10-13", "09:00") + 10_000;
    await steuerung().lauf();
    const [zugestellt] = await meldungen();

    // „Restore": eine neue Ablage aus dem gesicherten Stand — Erinnerung VOR dem Lauf, die Meldung
    // schon darin, die Laufzeile fehlt.
    const wiederErinnerungen = new InMemoryKlaraErinnerungRepo();
    const wieder: KlaraErinnerungAblage = {
      erinnerungen: wiederErinnerungen,
      laeufe: new InMemoryKlaraErinnerungLaufRepo(),
      meldungen: new InMemoryKlaraErinnerungMeldungRepo(wiederErinnerungen),
      einstellungen: new InMemoryKlaraErinnerungEinstellungRepo(),
    };
    if (!vorher || !zugestellt) {
      throw new Error("Ausgangsstand fehlt");
    }
    await wieder.erinnerungen.lege(vorher.erinnerung, vorher.steuer);
    await wieder.meldungen.schreibe(zugestellt);
    ablage = wieder;
    uhr += 60_000;
    const bericht = await steuerung("nach-restore").lauf();
    expect(bericht.dedupliziert).toBe(1);
    expect(bericht.zugestellt).toBe(0);
    expect(await meldungen()).toHaveLength(1);
    expect((await laeufe(e.id))[0]).toMatchObject({
      status: "zugestellt",
      ergebnis: { dedupliziert: true },
    });
  });
});

// ================================================================================================
// NACHARBEIT 2 (Ben) — Rechte, Status und Termin werden vor JEDER Wirkung neu gelesen.
// ================================================================================================

/** Ein ANDERER Schreiber (zweiter Prozess, zweites Gerät) ändert die Erinnerung in der Ablage. */
async function fremdAendern(
  id: string,
  f: (e: KlaraErinnerung) => Partial<KlaraErinnerung>,
): Promise<void> {
  const alt = await ablage.erinnerungen.holeSystem(id);
  if (!alt) {
    throw new Error("Erinnerung fehlt");
  }
  const neu: KlaraErinnerung = {
    ...alt.erinnerung,
    ...f(alt.erinnerung),
    fassung: alt.erinnerung.fassung + 1,
  };
  expect(await ablage.erinnerungen.ersetze(neu, alt.steuer)).toBe(true);
}

const NACHHOLEN = { regel: "nachholen", grenzeMinuten: 30 };
const SAMMELN = { regel: "zusammenfassen", grenzeMinuten: 30 };

/** Status je Termin (Schlüssel) mit Grund — unabhängig von der Reihenfolge. */
async function laufStatus(id: string): Promise<Record<string, [string, string | undefined]>> {
  return Object.fromEntries(
    (await laeufe(id)).map((l) => [
      l.vorkommenId.split("@")[1] ?? "",
      [l.status, l.ergebnis.grund] as [string, string | undefined],
    ]),
  );
}

describe("S10 · K5 / AW18-K08 — Prüfung vor JEDER Wirkung, auch zwischen zwei Zustellungen", () => {
  it("Konto wird ZWISCHEN zwei Zustellungen desselben Takts gesperrt: die weiteren stoppen", async () => {
    const e = await taeglich("Rundgang Halle 3", "2026-10-13", "09:00", 5, {
      verpasst: NACHHOLEN,
    });
    meldungsAblage.nachErfolg = async () => {
      konten.set(ANNA, { approved: false });
    };
    uhr = um("2026-10-15", "09:00") + 10_000;
    const bericht = await steuerung().lauf();
    // Erst der pünktliche Termin, dann die beiden nachzuholenden — nach der ersten Meldung gesperrt.
    expect(bericht.zugestellt).toBe(1);
    expect(bericht.gestoppt).toBe(2);
    expect((await meldungen()).map((m) => m.vorkommen[0])).toEqual(["2026-10-15T07:00:00.000Z"]);
    expect(await laufStatus(e.id)).toEqual({
      "2026-10-13T09:00": ["gestoppt", "konto_gesperrt"],
      "2026-10-14T09:00": ["gestoppt", "konto_gesperrt"],
      "2026-10-15T09:00": ["zugestellt", undefined],
    });
  });

  it("Pause ZWISCHEN zwei Zustellungen: die weiteren brechen ab und leben nach „fortsetzen“ nicht auf", async () => {
    const e = await taeglich("Lagerrunde", "2026-10-13", "09:00", 5, { verpasst: NACHHOLEN });
    meldungsAblage.nachErfolg = async () => {
      await dienst.status(ANNA, e.id, { fassung: await fassung(e.id), aktion: "pausieren" });
    };
    uhr = um("2026-10-15", "09:00") + 10_000;
    const bericht = await steuerung().lauf();
    expect(bericht.zugestellt).toBe(1);
    expect(bericht.abgebrochen).toBe(2);
    expect(await meldungenVon(e.id)).toHaveLength(1);
    expect(await laufStatus(e.id)).toEqual({
      "2026-10-13T09:00": ["abgebrochen", "status_geaendert"],
      "2026-10-14T09:00": ["abgebrochen", "status_geaendert"],
      "2026-10-15T09:00": ["zugestellt", undefined],
    });

    uhr = um("2026-10-15", "10:00");
    await dienst.status(ANNA, e.id, { fassung: await fassung(e.id), aktion: "fortsetzen" });
    await steuerung().lauf();
    await steuerung("prozess-nach-neustart").lauf();
    expect(await meldungenVon(e.id)).toHaveLength(1);
  });

  it("Pause UNMITTELBAR vor dem Schreiben: das bedingte Schreiben greift — keine Meldung", async () => {
    const e = await einmalig("Kurz vor knapp", "2026-10-13", "09:00");
    meldungsAblage.unmittelbarVorher = async () => {
      await dienst.status(ANNA, e.id, { fassung: await fassung(e.id), aktion: "pausieren" });
    };
    uhr = um("2026-10-13", "09:00") + 10_000;
    const bericht = await steuerung().lauf();
    expect(bericht.zugestellt).toBe(0);
    expect(bericht.abgebrochen).toBe(1);
    expect(await meldungen()).toEqual([]);
    expect((await laeufe(e.id))[0]).toMatchObject({
      status: "abgebrochen",
      ergebnis: { grund: "status_geaendert" },
    });
    expect(await lage(e.id)).toBe("pausiert");
  });

  it("Erledigt UNMITTELBAR vor dem Schreiben einer Wiederaufnahme: keine Meldung", async () => {
    const e = await einmalig("Nach Störung erledigt", "2026-10-13", "09:00");
    meldungsAblage.vorSchreibenWerfen = true;
    uhr = um("2026-10-13", "09:00") + 10_000;
    await steuerung().lauf();
    expect((await laeufe(e.id))[0]?.status).toBe("fehlgeschlagen");
    meldungsAblage.vorSchreibenWerfen = false;
    meldungsAblage.unmittelbarVorher = async () => {
      await dienst.status(ANNA, e.id, { fassung: await fassung(e.id), aktion: "erledigen" });
    };
    uhr += 60_000;
    const bericht = await steuerung("prozess-b").lauf();
    expect(bericht.abgebrochen).toBe(1);
    expect(await meldungen()).toEqual([]);
    expect((await laeufe(e.id))[0]).toMatchObject({
      status: "abgebrochen",
      ergebnis: { grund: "status_geaendert" },
    });
  });

  it("Sammelweg: EIN Termin wird anderswo kurz vor dem Schreiben abgesagt — nur er fehlt", async () => {
    const e = await taeglich("Wochenliste", "2026-10-13", "09:00", 5, { verpasst: SAMMELN });
    meldungsAblage.unmittelbarVorher = () =>
      fremdAendern(e.id, (x) => ({
        ausnahmen: {
          ...x.ausnahmen,
          "2026-10-14T09:00": { art: "abgesagt", am: new Date(uhr).toISOString() },
        } as KlaraErinnerung["ausnahmen"],
      }));
    uhr = um("2026-10-15", "12:00");
    const bericht = await steuerung().lauf();
    expect(bericht.abgebrochen).toBe(1);
    expect(bericht.zusammengefasst).toBe(2);
    const [m, ...rest] = await meldungenVon(e.id);
    expect(rest).toEqual([]);
    expect(m).toMatchObject({
      art: "zusammenfassung",
      vorkommen: ["2026-10-13T07:00:00.000Z", "2026-10-15T07:00:00.000Z"],
    });
    expect(await laufStatus(e.id)).toEqual({
      "2026-10-13T09:00": ["zusammengefasst", undefined],
      "2026-10-14T09:00": ["abgebrochen", "termin_geaendert"],
      "2026-10-15T09:00": ["zusammengefasst", undefined],
    });
  });

  it("Termin wird kurz vor dem Schreiben in die Zukunft verlegt: Lauf freigegeben, später EINMAL", async () => {
    const e = await einmalig("Verlegt", "2026-10-13", "09:00");
    meldungsAblage.unmittelbarVorher = () =>
      fremdAendern(e.id, (x) => ({
        ausnahmen: {
          ...x.ausnahmen,
          "2026-10-13T09:00": {
            art: "verschoben",
            datum: "2026-10-13",
            uhrzeit: "18:00",
            am: new Date(uhr).toISOString(),
          },
        } as KlaraErinnerung["ausnahmen"],
      }));
    uhr = um("2026-10-13", "09:00") + 10_000;
    const bericht = await steuerung().lauf();
    expect(bericht.zugestellt + bericht.abgebrochen).toBe(0);
    expect(await laeufe(e.id)).toEqual([]);
    expect(await meldungen()).toEqual([]);

    uhr = um("2026-10-13", "18:00") + 10_000;
    await steuerung().lauf();
    await steuerung("prozess-b").lauf();
    const [m, ...rest] = await meldungen();
    expect(rest).toEqual([]);
    expect(m?.vorkommen).toEqual(["2026-10-13T16:00:00.000Z"]);
    expect((await laeufe(e.id))[0]).toMatchObject({
      vorkommenId: `${e.id}@2026-10-13T09:00`,
      status: "zugestellt",
    });
  });
});

// ================================================================================================
describe("S11 · AW18-K08 — bewusste Übergabe mit HEUTIGEN Rechten, persönliche Inhalte bleiben", () => {
  it("übergeben: Meldungen gehen an die Zuständige, nur mit Titel; der Eigentümer bekommt keine", async () => {
    const e = await einmalig("Schlüssel abgeben", "2026-10-13", "09:00", {
      notiz: "Privat: Tresorcode 4711",
    });
    const { eintrag, an } = await dienst.uebergib(ANNA, e.id, {
      fassung: await fassung(e.id),
      an: " Bert@Beispiel.test ",
    });
    expect(an?.id).toBe(BERT);
    expect(eintrag.erinnerung.zustaendig).toMatchObject({ kontoId: BERT, von: ANNA });
    expect((await dienst.uebernommene(BERT)).map((x) => x.erinnerung.id)).toEqual([e.id]);
    expect(await dienst.uebernommene(ANNA)).toEqual([]);

    uhr = um("2026-10-13", "09:00") + 10_000;
    await steuerung().lauf();
    await steuerung("prozess-b").lauf();
    expect(await meldungen(ANNA)).toEqual([]);
    const [m, ...rest] = await meldungen(BERT);
    expect(rest).toEqual([]);
    expect(m).toMatchObject({ kontoId: BERT, titel: "Schlüssel abgeben" });
    expect(JSON.stringify(m)).not.toContain("Tresorcode");
    expect((await laeufe(e.id))[0]).toMatchObject({
      status: "zugestellt",
      ergebnis: { empfaenger: BERT },
    });
  });

  it("Zuständige verliert heute den Zugang: Stopp statt altem Recht; Rücknahme liefert wieder an Anna", async () => {
    const e = await taeglich("Übergebene Runde", "2026-10-13", "09:00", 3);
    await dienst.uebergib(ANNA, e.id, { fassung: await fassung(e.id), an: "bert@beispiel.test" });
    uhr = um("2026-10-13", "09:00") + 10_000;
    await steuerung().lauf();
    expect(await meldungen(BERT)).toHaveLength(1);

    konten.set(BERT, { approved: false });
    uhr = um("2026-10-14", "09:00") + 10_000;
    expect((await steuerung().lauf()).gestoppt).toBe(1);
    // Kein stilles Umleiten an den Eigentümer, keine Meldung an das gesperrte Konto.
    expect(await meldungen(ANNA)).toEqual([]);
    expect(await meldungen(BERT)).toHaveLength(1);

    uhr = um("2026-10-14", "12:00");
    await dienst.uebergib(ANNA, e.id, { fassung: await fassung(e.id), an: null });
    uhr = um("2026-10-15", "09:00") + 10_000;
    await steuerung().lauf();
    expect((await meldungen(ANNA)).map((m) => m.vorkommen[0])).toEqual([
      "2026-10-15T07:00:00.000Z",
    ]);
  });

  it("Zuständige wird ZWISCHEN zwei Zustellungen gesperrt: die weiteren stoppen", async () => {
    const e = await taeglich("Übergabe nachholen", "2026-10-13", "09:00", 5, {
      verpasst: NACHHOLEN,
    });
    await dienst.uebergib(ANNA, e.id, { fassung: await fassung(e.id), an: "bert@beispiel.test" });
    meldungsAblage.nachErfolg = async () => {
      konten.set(BERT, { approved: true, accessExpiresAt: new Date(uhr).toISOString() });
    };
    uhr = um("2026-10-15", "09:00") + 10_000;
    const bericht = await steuerung().lauf();
    expect(bericht.zugestellt).toBe(1);
    expect(bericht.gestoppt).toBe(2);
    expect(await meldungen(BERT)).toHaveLength(1);
    expect(await meldungen(ANNA)).toEqual([]);
  });

  it("nicht übergebbar: Inhaltsaufträge, unbekannte, nicht aktive oder eigene Adresse", async () => {
    const notizId = await notiz("Vertrag Lieferant");
    const inhalt = await einmalig("Vertrag zusammenfassen", "2026-10-13", "09:00", {
      bezug: { art: "notiz", notizId },
      aktion: "inhalt_zusammenfassen",
    });
    await expect(
      dienst.uebergib(ANNA, inhalt.id, {
        fassung: await fassung(inhalt.id),
        an: "bert@beispiel.test",
      }),
    ).rejects.toMatchObject({ status: 409, grund: "zustand" });

    const e = await einmalig("Reine Erinnerung", "2026-10-13", "09:00");
    for (const adresse of ["niemand@beispiel.test", "anna@beispiel.test"]) {
      await expect(
        dienst.uebergib(ANNA, e.id, { fassung: await fassung(e.id), an: adresse }),
      ).rejects.toMatchObject({ status: 409, grund: "empfaenger" });
    }
    konten.set(BERT, { approved: false });
    await expect(
      dienst.uebergib(ANNA, e.id, { fassung: await fassung(e.id), an: "bert@beispiel.test" }),
    ).rejects.toMatchObject({ status: 409, grund: "empfaenger" });
    // Eine fremde Person kann nicht übergeben und erfährt nichts.
    await expect(
      dienst.uebergib(BERT, e.id, { fassung: await fassung(e.id), an: "bert@beispiel.test" }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("die Zuständige gibt zurück; wer nicht zuständig ist, kann nicht zurückgeben", async () => {
    const e = await einmalig("Zurückgeben", "2026-10-13", "09:00");
    await dienst.uebergib(ANNA, e.id, { fassung: await fassung(e.id), an: "bert@beispiel.test" });
    await expect(dienst.gibZurueck(ANNA, e.id)).rejects.toMatchObject({ status: 404 });
    await dienst.gibZurueck(BERT, e.id);
    expect((await dienst.eintrag(ANNA, e.id)).erinnerung.zustaendig).toBeNull();
    expect(await dienst.uebernommene(BERT)).toEqual([]);
    uhr = um("2026-10-13", "09:00") + 10_000;
    await steuerung().lauf();
    expect(await meldungen(ANNA)).toHaveLength(1);
    expect(await meldungen(BERT)).toEqual([]);
  });
});

// ================================================================================================
describe("S12 · AW-18 — bestellte einmalige Zusammenfassung über den vorhandenen KI-Weg", () => {
  it("aus der EIGENEN Quelle, dauerhaft an Meldung und Lauf; ein Neustart ruft die KI nicht erneut", async () => {
    const notizId = await notiz("Angebot Kühlanlage");
    const gelesen: string[] = [];
    zusammenfassen = (text) => {
      gelesen.push(text);
      return Promise.resolve({ text: "Kurzfassung: Angebot bis Freitag prüfen.", ki: true });
    };
    const e = await einmalig("Angebot zusammenfassen", "2026-10-13", "09:00", {
      bezug: { art: "notiz", notizId },
      aktion: "inhalt_zusammenfassen",
    });
    expect(
      dienst.vorschau({ zeitzone: BERLIN, zeitplan: e.zeitplan, aktion: "inhalt_zusammenfassen" })
        .anzeige?.erwartetesErgebnis,
    ).toBe("meldung_mit_zusammenfassung");

    uhr = um("2026-10-13", "09:00") + 10_000;
    expect((await steuerung().lauf()).zugestellt).toBe(1);
    expect(gelesen).toEqual(["Angebot Kühlanlage\n\nAngebot Kühlanlage – Inhalt"]);
    const erstellt = {
      status: "erstellt",
      text: "Kurzfassung: Angebot bis Freitag prüfen.",
      ki: true,
    };
    expect((await meldungenVon(e.id))[0]?.zusammenfassung).toEqual(erstellt);
    expect((await laeufe(e.id))[0]).toMatchObject({
      status: "zugestellt",
      ergebnis: { zusammenfassung: erstellt },
    });
    await steuerung("prozess-nach-neustart").lauf();
    expect(gelesen).toHaveLength(1);
    expect(await meldungenVon(e.id)).toHaveLength(1);
  });

  it("KI fällt aus oder fehlt: die Erinnerung kommt trotzdem, Lauf teilweise", async () => {
    const notizId = await notiz("Protokoll Werkstatt");
    zusammenfassen = () => Promise.reject(new Error("KI nicht erreichbar"));
    const e = await einmalig("Protokoll zusammenfassen", "2026-10-13", "09:00", {
      bezug: { art: "notiz", notizId },
      aktion: "inhalt_zusammenfassen",
    });
    uhr = um("2026-10-13", "09:00") + 10_000;
    const bericht = await steuerung().lauf();
    expect(bericht.teilweise).toBe(1);
    expect((await meldungenVon(e.id))[0]?.zusammenfassung).toEqual({ status: "nicht_verfuegbar" });
    expect((await laeufe(e.id))[0]?.status).toBe("teilweise");
    expect(await lage(e.id)).toBe("teilweise_erledigt");

    zusammenfassen = undefined;
    const ohne = await einmalig("Ohne KI-Weg", "2026-10-13", "10:00", {
      bezug: { art: "notiz", notizId },
      aktion: "inhalt_zusammenfassen",
    });
    uhr = um("2026-10-13", "10:00") + 10_000;
    await steuerung().lauf();
    expect((await meldungenVon(ohne.id))[0]?.zusammenfassung).toEqual({
      status: "nicht_verfuegbar",
    });
  });

  it("ohne eigene Quelle keine Zusammenfassung; gelöschte Quelle wartet, die KI wird nicht gefragt", async () => {
    await expect(
      einmalig("Frei", "2026-10-13", "09:00", { aktion: "inhalt_zusammenfassen" }),
    ).rejects.toMatchObject({ status: 400 });
    const notizId = await notiz("Wird gelöscht");
    let aufrufe = 0;
    zusammenfassen = () => {
      aufrufe += 1;
      return Promise.resolve({ text: "x", ki: true });
    };
    const e = await einmalig("Gelöschte Quelle", "2026-10-13", "09:00", {
      bezug: { art: "notiz", notizId },
      aktion: "inhalt_zusammenfassen",
    });
    await notizen.entferne(ANNA, notizId);
    uhr = um("2026-10-13", "09:00") + 10_000;
    expect((await steuerung().lauf()).unklar).toBe(1);
    expect(aufrufe).toBe(0);
    expect(await meldungenVon(e.id)).toEqual([]);
  });
});

// ================================================================================================
describe("S14 · AW18-K08 / K5 — Sperre oder Quellenlöschung WÄHREND der abhängigen Aktion", () => {
  /** Ein Modellaufruf, dessen Antwort der Test zurückhält und erst später freigibt. */
  function angehalteneKi(): { gerufen: Promise<void>; freigeben: () => void } {
    let meldeGerufen: () => void = () => undefined;
    let freigabe: () => void = () => undefined;
    const gerufen = new Promise<void>((r) => {
      meldeGerufen = r;
    });
    const antwort = new Promise<void>((r) => {
      freigabe = r;
    });
    zusammenfassen = async () => {
      meldeGerufen();
      await antwort;
      return { text: "Kurzfassung, erst nach der Änderung geliefert.", ki: true };
    };
    return { gerufen, freigeben: () => freigabe() };
  }

  async function zusammenfassungsErinnerung(
    titel: string,
  ): Promise<{ id: string; notizId: string }> {
    const notizId = await notiz(titel);
    const e = await einmalig(titel, "2026-10-13", "09:00", {
      bezug: { art: "notiz", notizId },
      aktion: "inhalt_zusammenfassen",
    });
    return { id: e.id, notizId };
  }

  it("Konto wird gesperrt, während das Modell rechnet: keine Meldung, Lauf gestoppt", async () => {
    const ki = angehalteneKi();
    const { id } = await zusammenfassungsErinnerung("Angebot während Sperre");
    uhr = um("2026-10-13", "09:00") + 10_000;
    const lauf = steuerung().lauf();
    await ki.gerufen;
    konten.set(ANNA, { approved: false }); // Sperre bestätigt, BEVOR die Antwort kommt
    ki.freigeben();
    const bericht = await lauf;
    expect(bericht.zugestellt + bericht.teilweise).toBe(0);
    expect(bericht.gestoppt).toBe(1);
    expect(await meldungen()).toEqual([]);
    expect((await laeufe(id))[0]).toMatchObject({
      status: "gestoppt",
      ergebnis: { grund: "konto_gesperrt" },
    });
    // Auch ein späterer Takt (Neustart) liefert nichts nach.
    konten.set(ANNA, { approved: true });
    uhr += 120_000;
    await steuerung("prozess-nach-neustart").lauf();
    expect(await meldungen()).toEqual([]);
  });

  it("Quelle wird gelöscht, während das Modell rechnet: keine Meldung, Lauf wartet auf Klärung", async () => {
    const ki = angehalteneKi();
    const { id, notizId } = await zusammenfassungsErinnerung("Notiz während Löschung");
    uhr = um("2026-10-13", "09:00") + 10_000;
    const lauf = steuerung().lauf();
    await ki.gerufen;
    expect(await notizen.entferne(ANNA, notizId)).toBe(true); // Löschung bestätigt
    ki.freigeben();
    const bericht = await lauf;
    expect(bericht.unklar).toBe(1);
    expect(bericht.zugestellt + bericht.teilweise).toBe(0);
    expect(await meldungen()).toEqual([]);
    expect((await laeufe(id))[0]).toMatchObject({
      status: "unklar",
      ergebnis: { grund: "quelle_geloescht" },
    });
    expect(await lage(id)).toBe("wartet_auf_klaerung");
  });

  it("ohne Änderung währenddessen: dieselbe angehaltene Antwort wird zugestellt (Gegenprobe)", async () => {
    const ki = angehalteneKi();
    const { id } = await zusammenfassungsErinnerung("Angebot ohne Änderung");
    uhr = um("2026-10-13", "09:00") + 10_000;
    const lauf = steuerung().lauf();
    await ki.gerufen;
    ki.freigeben();
    expect((await lauf).zugestellt).toBe(1);
    expect((await meldungenVon(id))[0]?.zusammenfassung).toMatchObject({ status: "erstellt" });
  });
});

// ================================================================================================
describe("S13 · P07 — Einrichtungsassistent: freiwillig, erneut aufrufbar, Vorgaben für Neues", () => {
  it("ohne Einrichtung Werkvorgaben; gespeichert gelten Zone und Regeln für NEUE Erinnerungen", async () => {
    const vorher = await einmalig("Vor der Einrichtung", "2026-10-13", "09:00");
    expect(await dienst.einstellungen(ANNA)).toMatchObject({
      zeitzone: null,
      eingerichtetAm: null,
      fassung: 0,
    });
    // Ohne Einrichtung und ohne Zone bleibt die Zeitzone Pflicht — nichts wird geraten.
    await expect(
      dienst.lege(ANNA, {
        vorgang: vorgang(),
        titel: "Ohne Zone",
        zeitplan: { art: "einmalig", datum: "2026-10-13", uhrzeit: "09:00" },
      }),
    ).rejects.toMatchObject({ status: 400 });

    const gesetzt = await dienst.setzeEinstellungen(ANNA, {
      fassung: 0,
      zeitzone: "America/New_York",
      sommerzeit: { luecke: "auslassen", doppelt: "zweite" },
      verpasst: { regel: "zusammenfassen", grenzeMinuten: 90 },
      abschliessen: true,
    });
    expect(gesetzt).toMatchObject({ zeitzone: "America/New_York", fassung: 1 });
    expect(gesetzt.eingerichtetAm).not.toBeNull();

    const { eintrag } = await dienst.lege(ANNA, {
      vorgang: vorgang(),
      titel: "Nach der Einrichtung",
      zeitplan: { art: "einmalig", datum: "2026-10-13", uhrzeit: "09:00" },
    });
    expect(eintrag.erinnerung).toMatchObject({
      zeitzone: "America/New_York",
      sommerzeit: { luecke: "auslassen", doppelt: "zweite" },
      verpasst: { regel: "zusammenfassen", grenzeMinuten: 90 },
    });
    // Ausdrückliche Angaben gehen vor; Bestehendes bleibt unverändert; andere Konten unberührt.
    expect((await einmalig("Ausdrücklich Berlin", "2026-10-13", "09:00")).zeitzone).toBe(BERLIN);
    expect((await dienst.eintrag(ANNA, vorher.id)).erinnerung).toEqual(vorher);
    expect((await dienst.einstellungen(BERT)).zeitzone).toBeNull();
  });

  it("erneut aufrufbar mit Fassung; veraltete Fassung und unbekannte Zone werden abgelehnt", async () => {
    await dienst.setzeEinstellungen(ANNA, { fassung: 0, zeitzone: BERLIN, abschliessen: true });
    const zweite = await dienst.setzeEinstellungen(ANNA, {
      fassung: 1,
      zeitzone: "Europe/Vienna",
      abschliessen: true,
    });
    expect(zweite).toMatchObject({ zeitzone: "Europe/Vienna", fassung: 2 });
    await expect(
      dienst.setzeEinstellungen(ANNA, { fassung: 1, zeitzone: BERLIN }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      dienst.setzeEinstellungen(ANNA, { fassung: 2, zeitzone: "Mars/Olympus" }),
    ).rejects.toMatchObject({ status: 400 });
    expect((await dienst.einstellungen(ANNA)).fassung).toBe(2);
  });
});

// ================================================================================================
// EQF-07 (K20–K29) — PERSÖNLICHE ROUTINEN ÜBER DIESELBE STEUERUNG. Deterministische Testzeit.
// ================================================================================================

/** Eine eigene Aufgabe (aus einer eigenen Notiz), wahlweise erledigt am angegebenen Zeitpunkt. */
async function aufgabe(titel: string, erledigtAm: string | null = null): Promise<KlaraAufgabe> {
  const notizId = await notiz(titel);
  const { aufgabe: a } = await new KlaraAufgabeDienst({ repo: aufgaben, notizen, jetzt }).lege(
    ANNA,
    { vorgang: vorgang(), weg: "notiz", quelle: { notizId } },
  );
  if (!erledigtAm) {
    return a;
  }
  const erledigt: KlaraAufgabe = {
    ...a,
    status: "erledigt",
    erledigtAm,
    geaendertAm: erledigtAm,
    fassung: a.fassung + 1,
  };
  expect(await aufgaben.ersetze(erledigt)).toBe(true);
  return erledigt;
}

/** Eine wöchentliche Routine, montags 09:00 Berlin, ab dem 19.10.2026. */
async function wochenbericht(extra: Record<string, unknown> = {}): Promise<KlaraErinnerung> {
  const { eintrag } = await dienst.lege(ANNA, {
    vorgang: vorgang(),
    titel: "Wochenbericht Halle 2",
    zeitzone: BERLIN,
    zeitplan: {
      art: "serie",
      datum: "2026-10-19",
      uhrzeit: "09:00",
      wiederholung: { takt: "woechentlich", intervall: 1, bis: null, anzahl: 6 },
    },
    aktion: "routine_bericht",
    routine: { abschnitte: ["offene_aufgaben", "erledigte_aufgaben"] },
    ...extra,
  });
  return eintrag.erinnerung;
}

/** Die Ergebnisnotiz eines Termins — über ihren festen Vorgangsschlüssel. */
const bericht = (id: string, schluessel: string) =>
  notizen.zuVorgang(ANNA, ergebnisVorgang(`${id}@${schluessel}`));

/** Alle Routinenberichte in „Meine Notizen“. */
async function berichte(): Promise<number> {
  const alle = await notizen.liste(ANNA, { woerter: [], art: null, limit: 500 });
  return alle.filter((n) => n.vorgang.startsWith("routine-")).length;
}

describe("S15 · EQF-07 — persönliche Routinen dauerhaft und nachvollziehbar ausführen", () => {
  it("K01/K08: Definition ist sichtbar; Einrichtung führt NICHTS aus; nur die Erstellung ist erlaubt", async () => {
    const e = await wochenbericht();
    expect(e.routine).toEqual({
      fassung: 1,
      abschnitte: ["offene_aufgaben", "erledigte_aufgaben"],
      notizIds: [],
      ziel: "meine_notizen",
      wirkungen: ["bericht_erstellen"],
      modus: "automatisch",
    });
    const { erinnerung } = await dienst.eintrag(ANNA, e.id);
    const anzeige = dienst.vorschau({
      zeitzone: BERLIN,
      zeitplan: erinnerung.zeitplan,
      aktion: "routine_bericht",
    }).anzeige;
    expect(anzeige).toMatchObject({
      naechste: { datum: "2026-10-19", uhrzeit: "09:00" },
      serienende: { art: "anzahl", anzahl: 6 },
      erwartetesErgebnis: "bericht_in_notizen",
    });
    // Einrichtung ohne Sofortlauf: kein Bericht, keine Meldung, kein Lauf.
    await steuerung().lauf();
    expect(await berichte()).toBe(0);
    expect(await meldungen()).toEqual([]);
    expect(await laeufe(e.id)).toEqual([]);

    // Versand/Export ist KEINE Wirkung dieser Routine — und wird nicht erfunden.
    await expect(
      wochenbericht({ routine: { abschnitte: ["offene_aufgaben"], wirkungen: ["versenden"] } }),
    ).rejects.toMatchObject({ status: 400, grund: "wirkung_nicht_beauftragt" });
    await expect(wochenbericht({ routine: { notizIds: ["gibt-es-nicht"] } })).rejects.toMatchObject(
      { status: 404 },
    );
    // Eine Routine liest ihre Quellen aus der Definition, ist nicht übergebbar.
    await expect(
      dienst.uebergib(ANNA, e.id, { fassung: await fassung(e.id), an: "bert@beispiel.test" }),
    ).rejects.toMatchObject({ status: 409, grund: "zustand" });
    expect(routineAus(undefined).abschnitte).toEqual(["offene_aufgaben", "erledigte_aufgaben"]);
  });

  it("K02/K09: fälliger Lauf legt den Bericht an — Ergebnis-ID, Funktions-/Quellenfassung, Zeitpunkt", async () => {
    const offen = await aufgabe("Filter Presse 4 bestellen");
    const fertig = await aufgabe("Prüfprotokoll Halle 2", "2026-10-15T10:00:00.000Z");
    const alt = await aufgabe("Alter Vorgang", "2026-10-01T10:00:00.000Z");
    const fest = await notiz("Wochenziel Halle 2");
    const e = await wochenbericht({
      routine: { abschnitte: ["offene_aufgaben", "erledigte_aufgaben"], notizIds: [fest] },
    });
    uhr = um("2026-10-19", "09:00") + 10_000;
    const b = await steuerung().lauf();
    expect(b.zugestellt).toBe(1);

    const n = await bericht(e.id, "2026-10-19T09:00");
    expect(n).not.toBeNull();
    expect(n?.inhalt).toContain("Funktionsfassung 1.");
    expect(n?.inhalt).toContain(`[aufgabe ${offen.id}, Fassung ${offen.fassung}]`);
    expect(n?.inhalt).toContain(`[aufgabe ${fertig.id}, Fassung ${fertig.fassung}]`);
    expect(n?.inhalt).not.toContain(alt.id); // außerhalb der 7 Tage
    expect(n?.inhalt).toContain(`[notiz ${fest}, Fassung 1]`);

    const [l] = await laeufe(e.id);
    expect(l).toMatchObject({
      status: "zugestellt",
      ergebnis: {
        routine: {
          status: "erstellt",
          notizId: n?.id,
          notizFassung: 1,
          routineFassung: 1,
          erstelltAm: new Date(uhr).toISOString(),
          offen: [],
        },
      },
    });
    expect(l?.ergebnis.routine?.quellen).toEqual(
      expect.arrayContaining([
        { art: "aufgabe", id: offen.id, fassung: offen.fassung },
        { art: "aufgabe", id: fertig.id, fassung: fertig.fassung },
        { art: "notiz", id: fest, fassung: 1 },
      ]),
    );
    // Die Meldung zeigt das tatsächliche Ergebnis, nicht den geplanten Lauf.
    expect((await meldungenVon(e.id))[0]?.routine).toMatchObject({
      status: "erstellt",
      notizId: n?.id,
    });
  });

  it("K03: Änderung in Worten — künftig dienstags, Abschnitt dazu, pausieren; Pause übersteht Signal und Restore", async () => {
    const e = await wochenbericht();
    expect(deuteRoutinenAenderung("Bitte künftig dienstags")).toEqual({
      art: "wochentag",
      wochentag: 2,
    });
    expect(deuteRoutinenAenderung("irgendwas anders")).toEqual({ art: "unklar" });
    // Nur deuten ändert nichts; unklar ändert nichts.
    const vorschau = await dienst.aendereRoutine(ANNA, e.id, {
      fassung: await fassung(e.id),
      text: "künftig dienstags",
    });
    expect(vorschau).toMatchObject({ angewendet: false, deutung: { art: "wochentag" } });
    const unklar = await dienst.aendereRoutine(ANNA, e.id, {
      fassung: await fassung(e.id),
      text: "mach was",
      anwenden: true,
    });
    expect(unklar.angewendet).toBe(false);
    expect((await dienst.eintrag(ANNA, e.id)).erinnerung.fassung).toBe(e.fassung);

    await dienst.aendereRoutine(ANNA, e.id, {
      fassung: await fassung(e.id),
      text: "künftig dienstags",
      anwenden: true,
    });
    await dienst.aendereRoutine(ANNA, e.id, {
      fassung: await fassung(e.id),
      text: "nimm die neuen Notizen dazu",
      anwenden: true,
    });
    const nach = (await dienst.eintrag(ANNA, e.id)).erinnerung;
    expect(nach.zeitplan).toMatchObject({
      art: "serie",
      datum: "2026-10-13",
      wiederholung: { takt: "woechentlich", wochentage: [2] },
    });
    expect(nach.routine).toMatchObject({
      fassung: 2,
      abschnitte: ["offene_aufgaben", "erledigte_aufgaben", "neue_notizen"],
    });

    // Dienstag: Bericht mit Funktionsfassung 2.
    uhr = um("2026-10-13", "09:00") + 10_000;
    await steuerung().lauf();
    expect((await bericht(e.id, "2026-10-13T09:00"))?.inhalt).toContain("Funktionsfassung 2.");

    // Pausieren in Worten — und ein VERSPÄTETES altes Signal hebt die Pause nicht auf.
    uhr = um("2026-10-14", "12:00");
    const altFassung = await fassung(e.id);
    await dienst.aendereRoutine(ANNA, e.id, {
      fassung: altFassung,
      text: "pausieren",
      anwenden: true,
    });
    await expect(
      dienst.aendereRoutine(ANNA, e.id, {
        fassung: altFassung,
        text: "fortsetzen",
        anwenden: true,
      }),
    ).rejects.toMatchObject({ status: 409, grund: "konflikt" });
    // „Restore": dieselbe Erinnerung samt Pause in eine neue Ablage, ein neuer Prozess.
    const gesichert = await ablage.erinnerungen.holeSystem(e.id);
    const wiederErinnerungen = new InMemoryKlaraErinnerungRepo();
    if (!gesichert) {
      throw new Error("Ausgangsstand fehlt");
    }
    await wiederErinnerungen.lege(gesichert.erinnerung, gesichert.steuer);
    ablage = {
      erinnerungen: wiederErinnerungen,
      laeufe: new InMemoryKlaraErinnerungLaufRepo(),
      meldungen: new InMemoryKlaraErinnerungMeldungRepo(wiederErinnerungen),
      einstellungen: new InMemoryKlaraErinnerungEinstellungRepo(),
    };
    uhr = um("2026-10-20", "09:00") + 10_000;
    await steuerung("nach-restore").lauf();
    expect(await bericht(e.id, "2026-10-20T09:00")).toBeNull();
    expect((await ablage.erinnerungen.holeSystem(e.id))?.erinnerung.status).toBe("pausiert");
  });

  it("K04: lokale Serie über Sommerzeitende (doppelte 02:30, Regel „zweite“) — genau ein Bericht", async () => {
    const { eintrag } = await dienst.lege(ANNA, {
      vorgang: vorgang(),
      titel: "Sonntagsbericht",
      zeitzone: BERLIN,
      sommerzeit: { luecke: "verschieben", doppelt: "zweite" },
      zeitplan: {
        art: "serie",
        datum: "2026-10-18",
        uhrzeit: "02:30",
        wiederholung: { takt: "woechentlich", intervall: 1, bis: null, anzahl: 3 },
      },
      aktion: "routine_bericht",
      routine: { abschnitte: ["offene_aufgaben"] },
    });
    const id = eintrag.erinnerung.id;
    for (const iso of [
      "2026-10-18T00:30:10.000Z",
      "2026-10-25T00:30:10.000Z", // erste 02:30 (MESZ) — nach Regel NICHT
      "2026-10-25T01:30:10.000Z", // zweite 02:30 (MEZ) — hier
      "2026-10-25T01:31:10.000Z",
    ]) {
      uhr = Date.parse(iso);
      await steuerung().lauf();
    }
    expect(await berichte()).toBe(2);
    const lauf = (await laeufe(id)).find((l) => l.vorkommenId === `${id}@2026-10-25T02:30`);
    expect(lauf).toMatchObject({ geplantFuer: "2026-10-25T01:30:00.000Z", status: "zugestellt" });
  });

  it("K04/P07-AC07: Nachholregel — „nachholen“ legt jeden verpassten Bericht an, „nur melden“ keinen", async () => {
    const nach = await wochenbericht({ verpasst: { regel: "nachholen", grenzeMinuten: 30 } });
    const melden = await wochenbericht({ verpasst: { regel: "nur_melden", grenzeMinuten: 30 } });
    uhr = um("2026-11-02", "12:00"); // 19.10., 26.10. und 02.11. verpasst
    await steuerung().lauf();
    for (const s of ["2026-10-19T09:00", "2026-10-26T09:00", "2026-11-02T09:00"]) {
      expect(await bericht(nach.id, s)).not.toBeNull();
      expect(await bericht(melden.id, s)).toBeNull();
    }
    expect((await meldungenVon(melden.id)).map((m) => m.art)).toEqual([
      "verpasst",
      "verpasst",
      "verpasst",
    ]);
    // Ein Neustart wiederholt nichts.
    await steuerung("neustart").lauf();
    expect(await berichte()).toBe(3);
  });

  it("K05: zwei Ausführer, verlorene Antwort → ein Bericht (Readback); Readback unmöglich → unklar", async () => {
    const e = await wochenbericht();
    uhr = um("2026-10-19", "09:00") + 10_000;
    const [a, b] = await Promise.all([steuerung("p-a").lauf(), steuerung("p-b").lauf()]);
    expect(a.zugestellt + b.zugestellt).toBe(1);
    expect(await berichte()).toBe(1);

    // Die erste Routine endet hier — die folgenden Fälle gelten je EINER fälligen Routine.
    await dienst.status(ANNA, e.id, { fassung: await fassung(e.id), aktion: "beenden" });

    // Verlorene Antwort: der Bericht ist geschrieben, die Antwort kam nicht an. Die Wiederaufnahme
    // (im selben Takt) liest zurück und schreibt KEINEN zweiten.
    const zwei = await wochenbericht();
    uhr = um("2026-10-26", "09:00") + 10_000;
    stoerung.antwortVerloren = 1;
    const takt = await steuerung("p-a").lauf();
    expect(takt.fehlgeschlagen).toBe(1);
    const schluessel = "2026-10-26T09:00";
    const l = (await laeufe(zwei.id)).find((x) => x.vorkommenId.endsWith(schluessel));
    expect(l).toMatchObject({
      status: "zugestellt",
      versuch: 2,
      ergebnis: { routine: { wiederholt: true, status: "erstellt" } },
    });
    expect(await bericht(zwei.id, schluessel)).not.toBeNull();
    const vorgaenge = (await notizen.liste(ANNA, { woerter: [], art: null, limit: 500 }))
      .map((n) => n.vorgang)
      .filter((v) => v === ergebnisVorgang(`${zwei.id}@${schluessel}`));
    expect(vorgaenge).toHaveLength(1);

    // Readback unmöglich: kein blinder zweiter Bericht, der Ausgang bleibt ausdrücklich unklar.
    await dienst.status(ANNA, zwei.id, { fassung: await fassung(zwei.id), aktion: "beenden" });
    const drei = await wochenbericht();
    uhr = um("2026-11-02", "09:00") + 10_000;
    stoerung.readbackKaputt = true;
    await steuerung("p-d").lauf();
    stoerung.readbackKaputt = false;
    expect(
      (await laeufe(drei.id)).find((x) => x.vorkommenId.endsWith("2026-11-02T09:00")),
    ).toMatchObject({ status: "unklar", ergebnis: { grund: "readback_unmoeglich" } });
    expect(await bericht(drei.id, "2026-11-02T09:00")).toBeNull();
    expect(e.id).not.toBe(drei.id);
  });

  it("K06: Teilfehler behält das Fertige und zeigt den offenen Rest; ganz unlesbar → kein leerer Bericht, später fortgesetzt", async () => {
    const fest = await notiz("Feste Quelle");
    const teil = await wochenbericht({
      routine: { abschnitte: ["offene_aufgaben"], notizIds: [fest] },
    });
    const ganz = await wochenbericht({ routine: { abschnitte: ["offene_aufgaben"] } });
    aufgaben.listeKaputt = true;
    uhr = um("2026-10-19", "09:00") + 10_000;
    const b = await steuerung().lauf();
    expect(b.teilweise).toBe(1);
    const t = await bericht(teil.id, "2026-10-19T09:00");
    expect(t?.inhalt).toContain(`[notiz ${fest}, Fassung 1]`);
    expect(t?.inhalt).toContain("## Noch offen");
    expect((await laeufe(teil.id))[0]).toMatchObject({
      status: "teilweise",
      ergebnis: { routine: { status: "teilweise", offen: [{ grund: "quelle_unlesbar" }] } },
    });
    // Nichts lesbar: KEIN Bericht, Lauf sichtbar fehlgeschlagen — ohne Erfolgssiegel.
    expect(await bericht(ganz.id, "2026-10-19T09:00")).toBeNull();
    expect((await laeufe(ganz.id))[0]).toMatchObject({
      status: "fehlgeschlagen",
      ergebnis: { grund: "quelle_unlesbar" },
    });
    // Nacharbeit 9 (EQF-07-K09): die Glocke sagt es — als Handlungsbedarf mit Grund, kein Erfolg.
    expect(await meldungenVon(ganz.id)).toEqual([
      expect.objectContaining({
        art: "handlung",
        grund: "quelle_unlesbar",
        laufStatus: "fehlgeschlagen",
      }),
    ]);
    expect((await meldungenVon(ganz.id))[0]?.routine).toBeUndefined();
    // Weitere gescheiterte Versuche verdoppeln die Meldung nicht.
    uhr += 60_000;
    await steuerung("zweiter-versuch").lauf();
    expect((await meldungenVon(ganz.id)).filter((m) => m.art === "handlung")).toHaveLength(1);
    // Ablage wieder lesbar — die Wiederaufnahme (neuer Prozess) setzt fort.
    aufgaben.listeKaputt = false;
    uhr += 60_000;
    await steuerung("nach-neustart").lauf();
    expect(await bericht(ganz.id, "2026-10-19T09:00")).not.toBeNull();
    expect((await laeufe(ganz.id))[0]?.status).toBe("zugestellt");
    expect((await meldungenVon(ganz.id)).map((m) => m.art).sort()).toEqual([
      "erinnerung",
      "handlung",
    ]);
  });

  it("K06: Abbruch nimmt nichts zurück; Rücknahme nur des unveränderten Berichts, bearbeiteter bleibt", async () => {
    const e = await wochenbericht();
    uhr = um("2026-10-19", "09:00") + 10_000;
    await steuerung().lauf();
    uhr = um("2026-10-26", "09:00") + 10_000;
    await steuerung().lauf();
    // Abbruch (beenden): beide Berichte bleiben.
    await dienst.status(ANNA, e.id, { fassung: await fassung(e.id), aktion: "beenden" });
    expect(await berichte()).toBe(2);

    // Den Bericht vom 26.10. hat die Person bearbeitet: Rücknahme würde fremde Arbeit löschen.
    const bearbeitet = await bericht(e.id, "2026-10-26T09:00");
    if (!bearbeitet) {
      throw new Error("Bericht fehlt");
    }
    await new KlaraNotizDienst({ repo: notizen, jetzt }).aendere(ANNA, bearbeitet.id, {
      fassung: 1,
      inhalt: `${bearbeitet.inhalt}\nEigene Ergänzung.`,
    });
    await expect(
      dienst.nimmRoutineErgebnisZurueck(ANNA, e.id, `${e.id}@2026-10-26T09:00`),
    ).rejects.toMatchObject({ status: 409, grund: "fremd_geaendert" });
    expect(await bericht(e.id, "2026-10-26T09:00")).not.toBeNull();

    // Der unveränderte vom 19.10. lässt sich zurücknehmen — der Lauf vermerkt es.
    const neunzehnter = `${e.id}@2026-10-19T09:00`;
    const lauf = await dienst.nimmRoutineErgebnisZurueck(ANNA, e.id, neunzehnter);
    expect(lauf.ergebnis.routine?.zurueckgenommenAm).toBeDefined();
    expect(await bericht(e.id, "2026-10-19T09:00")).toBeNull();
    // Fremde Person: nichts.
    await expect(
      dienst.nimmRoutineErgebnisZurueck(BERT, e.id, `${e.id}@2026-10-26T09:00`),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("K07: gelöschte feste Quelle zeigt den Grund; Kontosperre WÄHREND des Lesens → kein Bericht", async () => {
    const fest = await notiz("Wird gelöscht");
    const e = await wochenbericht({
      routine: { abschnitte: ["offene_aufgaben"], notizIds: [fest] },
    });
    await notizen.entferne(ANNA, fest);
    uhr = um("2026-10-19", "09:00") + 10_000;
    await steuerung().lauf();
    expect((await laeufe(e.id))[0]).toMatchObject({
      status: "teilweise",
      ergebnis: {
        routine: { offen: [{ was: `Notiz ${fest}`, grund: "quelle_geloescht" }] },
      },
    });
    expect((await meldungenVon(e.id))[0]?.routine).toMatchObject({ status: "teilweise" });

    // Konto wird gesperrt, während die Routine ihre Quellen liest.
    aufgaben.nachListe = () => {
      konten.set(ANNA, { approved: false });
    };
    uhr = um("2026-10-26", "09:00") + 10_000;
    const b = await steuerung().lauf();
    aufgaben.nachListe = null;
    expect(b.gestoppt).toBe(1);
    expect(await bericht(e.id, "2026-10-26T09:00")).toBeNull();
    expect(
      (await laeufe(e.id)).find((l) => l.vorkommenId.endsWith("2026-10-26T09:00")),
    ).toMatchObject({ status: "gestoppt", ergebnis: { grund: "konto_gesperrt" } });
  });
});

// ================================================================================================
// S16 · Nacharbeit 9 (Ben): Berichtsanlage als eigene bedingte Wirkung, Quellenfassung vor der
// Wirkung, Fortsetzung des offenen Rests im selben Bericht, Meldung bei Fehlschlag.
// Die Rechte-/Quellenbedingung IM Speicherbefehl misst die PostgreSQL-Fassung (P14); die
// Speicherablage prüft beim Speichern synchron „Routine aktiv in dieser Fassung“.
// ================================================================================================

const TERMIN = "2026-10-19T09:00";
const notizDienst = () => new KlaraNotizDienst({ repo: notizen, jetzt });

describe("S16 · EQF-07-K06/K07/K09 — bedingte Anlage, Quellenfassung, Fortsetzung, Meldung", () => {
  // Jede Variante beginnt mit der frischen Testuhr aus beforeEach, vor dem ersten Termin.
  it.each(["pausieren", "beenden", "loeschen"] as const)(
    "Befund 1: %s unmittelbar VOR dem Speichern → kein Bericht",
    async (aktion) => {
      const e = await wochenbericht();
      uhr = um("2026-10-19", "09:00") + 10_000;
      stoerung.vorSchreiben = async () => {
        if (aktion === "loeschen") {
          await dienst.loesche(ANNA, e.id);
        } else {
          await dienst.status(ANNA, e.id, { fassung: await fassung(e.id), aktion });
        }
      };
      await steuerung(`vor-speichern-${aktion}`).lauf();
      expect(stoerung.vorSchreiben).toBeNull(); // der Einschub lag wirklich vor dem Speichern
      expect(await bericht(e.id, TERMIN)).toBeNull();
      expect((await meldungenVon(e.id)).filter((m) => m.art !== "handlung")).toEqual([]);
      if (aktion !== "loeschen") {
        expect((await laeufe(e.id))[0]).toMatchObject({
          status: "abgebrochen",
          ergebnis: { grund: aktion === "beenden" ? "abbruch" : "status_geaendert" },
        });
      } else {
        expect(await laeufe(e.id)).toEqual([]);
      }
      expect(await berichte()).toBe(0);
    },
  );

  it("Befund 1: ein schon angelegter Bericht wird weiter per Readback übernommen", async () => {
    const e = await wochenbericht();
    uhr = um("2026-10-19", "09:00") + 10_000;
    stoerung.antwortVerloren = 1;
    await steuerung("verlorene-antwort").lauf();
    expect(await berichte()).toBe(1);
    expect((await laeufe(e.id))[0]).toMatchObject({
      status: "zugestellt",
      ergebnis: { routine: { wiederholt: true } },
    });
    // Die verlorene Antwort war kein Fehlschlag: keine Handlungsmeldung.
    expect((await meldungenVon(e.id)).map((m) => m.art)).toEqual(["erinnerung"]);
  });

  it("Befund 2: Aufgabe zwischen Lesen und Schreiben geändert → neu gelesen, Bericht mit neuer Fassung", async () => {
    const a = await aufgabe("Filter Presse 4 bestellen");
    const e = await wochenbericht({ routine: { abschnitte: ["offene_aufgaben"] } });
    aufgaben.nachListe = async () => {
      aufgaben.nachListe = null;
      expect(
        await aufgaben.ersetze({
          ...a,
          titel: "Filter Presse 4 (2 Stück)",
          fassung: a.fassung + 1,
        }),
      ).toBe(true);
    };
    uhr = um("2026-10-19", "09:00") + 10_000;
    await steuerung().lauf();
    const n = await bericht(e.id, TERMIN);
    expect(n?.inhalt).toContain(`[aufgabe ${a.id}, Fassung ${a.fassung + 1}]`);
    expect(n?.inhalt).toContain("Filter Presse 4 (2 Stück)");
    expect(n?.inhalt).not.toContain(`[aufgabe ${a.id}, Fassung ${a.fassung}]`);
    expect(await berichte()).toBe(1);
    expect((await laeufe(e.id))[0]?.ergebnis.routine?.quellen).toEqual([
      { art: "aufgabe", id: a.id, fassung: a.fassung + 1 },
    ]);
  });

  it("Befund 2: feste Notiz nach dem Lesen geändert bzw. gelöscht → neu entschieden", async () => {
    const geaendert = await notiz("Wochenziel Halle 2");
    const geloescht = await notiz("Wird gleich gelöscht");
    const e = await wochenbericht({
      routine: { abschnitte: ["offene_aufgaben"], notizIds: [geaendert, geloescht] },
    });
    const original = notizen.hole.bind(notizen);
    const erledigt = new Set<string>();
    notizen.hole = async (kontoId: string, id: string) => {
      const n = await original(kontoId, id);
      if (n && !erledigt.has(id)) {
        // Nach dem Lesen, vor dem Schreiben: die Person ändert die eine und löscht die andere.
        erledigt.add(id);
        if (id === geaendert) {
          await notizDienst().aendere(ANNA, id, { fassung: n.fassung, inhalt: "Neues Wochenziel" });
        } else if (id === geloescht) {
          await notizen.entferne(ANNA, id);
        }
      }
      return n;
    };
    uhr = um("2026-10-19", "09:00") + 10_000;
    await steuerung().lauf();
    notizen.hole = original;
    const n = await bericht(e.id, TERMIN);
    expect(n?.inhalt).toContain(`[notiz ${geaendert}, Fassung 2]`);
    expect(n?.inhalt).not.toContain(`[notiz ${geaendert}, Fassung 1]`);
    expect(n?.inhalt).not.toContain(`[notiz ${geloescht},`);
    expect((await laeufe(e.id))[0]).toMatchObject({
      status: "teilweise",
      ergebnis: {
        routine: { offen: [{ was: `Notiz ${geloescht}`, grund: "quelle_geloescht" }] },
      },
    });
    expect(await berichte()).toBe(1);
  });

  it("Befund 2/4: Quelle ändert sich in jeder Runde → kein Bericht, EINE Handlungsmeldung, später fertig", async () => {
    const a = await aufgabe("Dauernd geändert");
    const e = await wochenbericht({ routine: { abschnitte: ["offene_aufgaben"] } });
    let fassungJetzt = a.fassung;
    aufgaben.nachListe = async () => {
      fassungJetzt += 1;
      await aufgaben.ersetze({ ...a, fassung: fassungJetzt });
    };
    uhr = um("2026-10-19", "09:00") + 10_000;
    await steuerung().lauf();
    uhr += 60_000;
    await steuerung("zweiter-takt").lauf();
    expect(await bericht(e.id, TERMIN)).toBeNull();
    expect((await laeufe(e.id))[0]).toMatchObject({
      status: "fehlgeschlagen",
      ergebnis: { grund: "quelle_geaendert" },
    });
    const handlung = (await meldungenVon(e.id)).filter((m) => m.art === "handlung");
    expect(handlung).toHaveLength(1);
    expect(handlung[0]).toMatchObject({ grund: "quelle_geaendert", laufStatus: "fehlgeschlagen" });
    expect(handlung[0]?.routine).toBeUndefined();

    aufgaben.nachListe = null;
    uhr += 60_000;
    await steuerung("ruhig").lauf();
    expect((await bericht(e.id, TERMIN))?.inhalt).toContain(`Fassung ${fassungJetzt}]`);
    expect((await laeufe(e.id))[0]?.status).toBe("zugestellt");
    expect((await meldungenVon(e.id)).filter((m) => m.art === "handlung")).toHaveLength(1);
  });

  it("Befund 3: Teilbericht wird nach Verfügbarkeit/Neustart im SELBEN Bericht fortgesetzt", async () => {
    const fest = await notiz("Feste Quelle");
    const a = await aufgabe("Filter Presse 4 bestellen");
    const e = await wochenbericht({
      routine: { abschnitte: ["offene_aufgaben"], notizIds: [fest] },
    });
    aufgaben.listeKaputt = true;
    uhr = um("2026-10-19", "09:00") + 10_000;
    await steuerung().lauf();
    const vorher = await bericht(e.id, TERMIN);
    expect(vorher?.fassung).toBe(1);
    expect(vorher?.inhalt).toContain("## Noch offen");
    expect((await laeufe(e.id))[0]).toMatchObject({
      status: "teilweise",
      ergebnis: { routine: { status: "teilweise", fortsetzbar: true } },
    });
    // Weiter nicht lesbar: der Teilbericht bleibt, wie er ist.
    uhr += 60_000;
    await steuerung("noch-kaputt").lauf();
    expect((await bericht(e.id, TERMIN))?.fassung).toBe(1);

    // Ablage wieder da, neuer Prozess: derselbe Bericht wird vervollständigt.
    aufgaben.listeKaputt = false;
    uhr += 60_000;
    await steuerung("nach-neustart").lauf();
    const nachher = await bericht(e.id, TERMIN);
    expect(nachher?.id).toBe(vorher?.id);
    expect(nachher?.fassung).toBe(2);
    expect(nachher?.inhalt).toContain(`[aufgabe ${a.id}, Fassung ${a.fassung}]`);
    expect(nachher?.inhalt).toContain(`[notiz ${fest}, Fassung 1]`);
    expect(nachher?.inhalt).not.toContain("## Noch offen");
    expect(nachher?.inhalt).not.toContain("nicht lesbar");
    expect(await berichte()).toBe(1);
    const [l] = await laeufe(e.id);
    expect(l).toMatchObject({
      status: "zugestellt",
      ergebnis: {
        routine: { status: "erstellt", notizId: vorher?.id, notizFassung: 2, offen: [] },
      },
    });
    expect(l?.ergebnis.routine?.fortsetzbar).toBe(false);
    expect(l?.ergebnis.routine?.fortgesetztAm).toBeDefined();
    // Die Glocke zeigt das neue tatsächliche Ergebnis — einmal.
    const fortgesetzt = (await meldungenVon(e.id)).filter((m) => m.id.endsWith("-fortgesetzt-2"));
    expect(fortgesetzt).toHaveLength(1);
    expect(fortgesetzt[0]?.routine).toMatchObject({ status: "erstellt", notizFassung: 2 });

    // Weitere Takte ändern nichts mehr.
    uhr += 60_000;
    await steuerung("danach").lauf();
    expect((await bericht(e.id, TERMIN))?.fassung).toBe(2);
    expect(await berichte()).toBe(1);
  });

  it("Befund 3: hat die Person den Teilbericht bearbeitet, bleibt er unangetastet", async () => {
    const e = await wochenbericht({
      routine: { abschnitte: ["offene_aufgaben"], notizIds: [await notiz("Fest")] },
    });
    aufgaben.listeKaputt = true;
    uhr = um("2026-10-19", "09:00") + 10_000;
    await steuerung().lauf();
    const vorher = await bericht(e.id, TERMIN);
    if (!vorher) {
      throw new Error("Teilbericht fehlt");
    }
    await notizDienst().aendere(ANNA, vorher.id, {
      fassung: 1,
      inhalt: `${vorher.inhalt}\nEigene Ergänzung.`,
    });
    aufgaben.listeKaputt = false;
    uhr += 60_000;
    await steuerung("nach-neustart").lauf();
    const nachher = await bericht(e.id, TERMIN);
    expect(nachher?.fassung).toBe(2);
    expect(nachher?.inhalt).toContain("Eigene Ergänzung.");
    expect(nachher?.inhalt).toContain("## Noch offen");
    expect((await laeufe(e.id))[0]).toMatchObject({
      status: "teilweise",
      ergebnis: { grund: "bericht_geaendert", routine: { fortsetzbar: false } },
    });
    uhr += 60_000;
    await steuerung("danach").lauf();
    expect((await bericht(e.id, TERMIN))?.fassung).toBe(2);
  });

  it("Befund 3: nach ausgeschöpften Versuchen setzt die Klärung „fortführen“ fort; „verwerfen“ nicht", async () => {
    const fest = await notiz("Fest");
    const definition = { routine: { abschnitte: ["offene_aufgaben"], notizIds: [fest] } };
    const fort = await wochenbericht(definition);
    const weg = await wochenbericht(definition);
    aufgaben.listeKaputt = true;
    uhr = um("2026-10-19", "09:00") + 10_000;
    for (let i = 0; i < KLARA_ERINNERUNG_MAX_VERSUCHE + 1; i += 1) {
      await steuerung(`takt-${i}`).lauf();
      uhr += 60_000;
    }
    const [lf] = await laeufe(fort.id);
    expect(lf).toMatchObject({ status: "teilweise", versuch: KLARA_ERINNERUNG_MAX_VERSUCHE });
    aufgaben.listeKaputt = false;
    await steuerung("ohne-klaerung").lauf();
    expect((await bericht(fort.id, TERMIN))?.fassung).toBe(1); // Versuche ausgeschöpft

    if (!lf) {
      throw new Error("Lauf fehlt");
    }
    await dienst.klaere(ANNA, fort.id, lf.vorkommenId, {
      entscheidung: "fortfuehren",
      fassung: await fassung(fort.id),
    });
    const [lw] = await laeufe(weg.id);
    if (!lw) {
      throw new Error("Lauf fehlt");
    }
    await dienst.klaere(ANNA, weg.id, lw.vorkommenId, {
      entscheidung: "verwerfen",
      fassung: await fassung(weg.id),
    });
    uhr += 60_000;
    await steuerung("nach-klaerung").lauf();
    expect((await bericht(fort.id, TERMIN))?.fassung).toBe(2);
    expect((await laeufe(fort.id))[0]?.status).toBe("zugestellt");
    // Verworfen: der Teilbericht bleibt, wie er ist; nichts wird nachgetragen.
    expect((await bericht(weg.id, TERMIN))?.fassung).toBe(1);
    expect((await laeufe(weg.id))[0]).toMatchObject({
      status: "teilweise",
      ergebnis: { routine: { fortsetzbar: false } },
    });
    // Fremde Person kann nichts klären.
    await expect(
      dienst.klaere(BERT, fort.id, lf.vorkommenId, { entscheidung: "fortfuehren", fassung: 1 }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

// ================================================================================================
// S17 · Nacharbeit 11 (Ben): Fortsetzung eines Teilberichts — historische Belege fertiger
// Abschnitte gegenüber frisch gelesenen Quellen des Rests; Absturzfenster unmittelbar nach der
// Berichtsänderung (Readback ohne die nachgelagerte Meldung); unklarer Ausgang; fremde Arbeit.
// ================================================================================================

describe("S17 · EQF-07-K05/K06, AW18-K06 — Fortsetzung: historische Belege, Absturz, Readback", () => {
  /** Ein Teilbericht: feste Notiz fertig, Abschnitt „offene Aufgaben“ unlesbar. */
  async function teilbericht() {
    const fest = await notiz("Wochenziel Halle 2");
    const a = await aufgabe("Filter Presse 4 bestellen");
    const e = await wochenbericht({
      routine: { abschnitte: ["offene_aufgaben"], notizIds: [fest] },
    });
    aufgaben.listeKaputt = true;
    uhr = um("2026-10-19", "09:00") + 10_000;
    await steuerung().lauf();
    aufgaben.listeKaputt = false;
    const n = await bericht(e.id, TERMIN);
    expect(n?.fassung).toBe(1);
    expect(n?.inhalt).toContain("## Noch offen");
    return { fest, a, e };
  }

  /** Fortsetzung, bei der der Prozess NACH der Berichtsänderung stirbt — vor Meldung und Abschluss. */
  async function fortsetzungStirbt(e: KlaraErinnerung): Promise<void> {
    // Nacharbeit 12: der früheste Punkt NACH der Berichtsänderung ist das Festhalten
    // „Bericht fertig, Meldung ausstehend“ (zweites `vermerke` dieses Takts) — dort stirbt der
    // Prozess; Meldung und Laufabschluss fehlen.
    laufAblage.vermerkeAufrufe = 0;
    laufAblage.vermerkeStirbtBei = 2;
    uhr += 60_000;
    await steuerung("stirbt").lauf();
    laufAblage.vermerkeStirbtBei = 0;
    expect((await bericht(e.id, TERMIN))?.fassung).toBe(2); // die Wirkung ist geschehen
    expect((await laeufe(e.id))[0]).toMatchObject({
      status: "laeuft",
      ergebnis: { routine: { fortsetzung: { vonFassung: 1, nachFassung: 2 } } },
    });
    expect((await meldungenVon(e.id)).filter((m) => m.id.includes("-fortgesetzt-"))).toEqual([]);
  }

  it("Befund 1: geänderte Quelle eines FERTIGEN Abschnitts verhindert die Fortsetzung nicht", async () => {
    const { fest, a, e } = await teilbericht();
    // Nach dem Teilbericht bearbeitet die Person die Quelle des fertigen Abschnitts.
    await notizDienst().aendere(ANNA, fest, {
      fassung: 1,
      inhalt: "Wochenziel: geändert nach dem Bericht.",
    });
    uhr += 60_000;
    await steuerung("nach-neustart").lauf();
    const n = await bericht(e.id, TERMIN);
    expect(n?.fassung).toBe(2);
    // Der fertige Abschnitt bleibt der historische Beleg seines Laufs.
    expect(n?.inhalt).toContain(`[notiz ${fest}, Fassung 1]`);
    expect(n?.inhalt).not.toContain(`[notiz ${fest}, Fassung 2]`);
    expect(n?.inhalt).toContain(`[aufgabe ${a.id}, Fassung ${a.fassung}]`);
    expect(n?.inhalt).not.toContain("## Noch offen");
    const [l] = await laeufe(e.id);
    expect(l).toMatchObject({
      status: "zugestellt",
      ergebnis: { routine: { status: "erstellt", notizFassung: 2, offen: [] } },
    });
    expect(l?.ergebnis.routine?.quellen).toEqual(
      expect.arrayContaining([
        { art: "notiz", id: fest, fassung: 1 },
        { art: "aufgabe", id: a.id, fassung: a.fassung },
      ]),
    );
    expect(await berichte()).toBe(1);
  });

  it("Befund 1: eine FRISCH gelesene Quelle des Rests wird weiter geprüft — geändert → neu gelesen", async () => {
    const { a, e } = await teilbericht();
    aufgaben.nachListe = async () => {
      aufgaben.nachListe = null;
      expect(await aufgaben.ersetze({ ...a, fassung: a.fassung + 1 })).toBe(true);
    };
    uhr += 60_000;
    await steuerung("liest-ueberholt").lauf();
    // Gelesen, dann geändert: nichts nachgetragen.
    expect((await bericht(e.id, TERMIN))?.fassung).toBe(1);
    expect((await laeufe(e.id))[0]?.status).toBe("teilweise");
    uhr += 60_000;
    await steuerung("liest-neu").lauf();
    const n = await bericht(e.id, TERMIN);
    expect(n?.fassung).toBe(2);
    expect(n?.inhalt).toContain(`[aufgabe ${a.id}, Fassung ${a.fassung + 1}]`);
    expect((await laeufe(e.id))[0]?.status).toBe("zugestellt");
  });

  it("Befund 2: Absturz nach der Berichtsänderung → Readback erkennt die EIGENE Fassung, keine dritte", async () => {
    const { e } = await teilbericht();
    await fortsetzungStirbt(e);
    uhr += KLARA_ERINNERUNG_LEASE_MS + 60_000;
    await steuerung("nach-absturz").lauf();
    const n = await bericht(e.id, TERMIN);
    expect(n?.fassung).toBe(2);
    expect(n?.inhalt).not.toContain("## Noch offen");
    expect(await berichte()).toBe(1);
    const [l] = await laeufe(e.id);
    expect(l).toMatchObject({
      status: "zugestellt",
      ergebnis: { routine: { status: "erstellt", notizFassung: 2, offen: [] } },
    });
    expect(l?.ergebnis.routine?.fortsetzung).toBeUndefined();
    expect(l?.ergebnis.grund).toBeUndefined();
    // Die nachgelagerte Meldung wird jetzt einmal geschrieben.
    const fortgesetzt = (await meldungenVon(e.id)).filter((m) => m.id.endsWith("-fortgesetzt-2"));
    expect(fortgesetzt).toHaveLength(1);
    expect(fortgesetzt[0]?.routine).toMatchObject({ status: "erstellt", notizFassung: 2 });
  });

  it("Befund 2: Absturz, danach bearbeitet die Person den Bericht → fremde Arbeit bleibt geschützt", async () => {
    const { e } = await teilbericht();
    await fortsetzungStirbt(e);
    const eigen = await bericht(e.id, TERMIN);
    if (!eigen) {
      throw new Error("Bericht fehlt");
    }
    await notizDienst().aendere(ANNA, eigen.id, {
      fassung: 2,
      inhalt: `${eigen.inhalt}\nEigene Ergänzung.`,
    });
    uhr += KLARA_ERINNERUNG_LEASE_MS + 60_000;
    await steuerung("nach-absturz").lauf();
    const n = await bericht(e.id, TERMIN);
    expect(n?.fassung).toBe(3);
    expect(n?.inhalt).toContain("Eigene Ergänzung.");
    expect((await laeufe(e.id))[0]).toMatchObject({
      status: "teilweise",
      ergebnis: { grund: "bericht_geaendert", routine: { fortsetzbar: false } },
    });
  });

  it("Befund 2: Antwort nach der Berichtsänderung verloren → Ausgang ausdrücklich offen, dann Readback", async () => {
    const { e } = await teilbericht();
    stoerung.aendernAntwortVerloren = 1;
    uhr += 60_000;
    await steuerung("antwort-weg").lauf();
    expect((await bericht(e.id, TERMIN))?.fassung).toBe(2);
    expect((await laeufe(e.id))[0]).toMatchObject({
      status: "teilweise",
      ergebnis: {
        grund: "zustellung_gescheitert",
        routine: { fortsetzbar: true, fortsetzung: { nachFassung: 2 } },
      },
    });
    uhr += 60_000;
    await steuerung("readback").lauf();
    expect((await bericht(e.id, TERMIN))?.fassung).toBe(2);
    expect(await berichte()).toBe(1);
    expect((await laeufe(e.id))[0]).toMatchObject({
      status: "zugestellt",
      ergebnis: { routine: { status: "erstellt", notizFassung: 2 } },
    });
    expect((await meldungenVon(e.id)).filter((m) => m.id.endsWith("-fortgesetzt-2"))).toHaveLength(
      1,
    );
  });

  // ---- Nacharbeit 12 (Ben, EQF-07-K09, AW18-K06/K10): Fortsetzungsmeldung getrennt geführt ----

  const fortgesetzt = async (id: string) =>
    (await meldungenVon(id)).filter((m) => m.id.includes("-fortgesetzt-"));

  it("Nacharbeit 12: Meldung scheitert → Bericht fertig, Meldung AUSSTEHEND, nächster Takt holt nur sie nach", async () => {
    const { e } = await teilbericht();
    meldungsAblage.vorSchreibenWerfen = true;
    uhr += 60_000;
    await steuerung("meldung-kaputt").lauf();
    meldungsAblage.vorSchreibenWerfen = false;
    expect((await bericht(e.id, TERMIN))?.fassung).toBe(2);
    expect((await laeufe(e.id))[0]).toMatchObject({
      status: "teilweise",
      ergebnis: {
        grund: "zustellung_gescheitert",
        routine: { status: "erstellt", notizFassung: 2, offen: [], meldungAusstehend: true },
      },
    });
    expect(await fortgesetzt(e.id)).toEqual([]);
    uhr += 60_000;
    await steuerung("nachholen").lauf();
    expect((await bericht(e.id, TERMIN))?.fassung).toBe(2); // keine erneute Berichtsänderung
    const [l] = await laeufe(e.id);
    expect(l).toMatchObject({ status: "zugestellt", ergebnis: { routine: { notizFassung: 2 } } });
    expect(l?.ergebnis.routine?.meldungAusstehend).toBeUndefined();
    expect(l?.ergebnis.grund).toBeUndefined();
    const ids = (await fortgesetzt(e.id)).map((m) => m.id);
    expect(ids).toEqual([`${l?.meldungId}-fortgesetzt-2`]);
  });

  it("Nacharbeit 12: Antwort nach dem Meldungsschreiben verloren → Readback über die feste Kennung, keine zweite", async () => {
    const { e } = await teilbericht();
    meldungsAblage.nachSchreibenWerfen = 1;
    uhr += 60_000;
    await steuerung("antwort-weg").lauf();
    expect((await laeufe(e.id))[0]).toMatchObject({
      status: "teilweise",
      ergebnis: { routine: { meldungAusstehend: true } },
    });
    expect(await fortgesetzt(e.id)).toHaveLength(1); // sie ist tatsächlich angekommen
    uhr += 60_000;
    await steuerung("readback").lauf();
    expect((await laeufe(e.id))[0]?.status).toBe("zugestellt");
    expect(await fortgesetzt(e.id)).toHaveLength(1);
    expect((await bericht(e.id, TERMIN))?.fassung).toBe(2);
  });

  it("Nacharbeit 12: veraltet durch Pause unmittelbar vor der Meldung → keine Meldung, Lauf mit Grund, Bericht bleibt", async () => {
    const { e } = await teilbericht();
    meldungsAblage.unmittelbarVorher = async () => {
      await dienst.status(ANNA, e.id, { fassung: await fassung(e.id), aktion: "pausieren" });
    };
    uhr += 60_000;
    await steuerung("pause").lauf();
    expect(await fortgesetzt(e.id)).toEqual([]);
    expect((await bericht(e.id, TERMIN))?.fassung).toBe(2);
    expect((await laeufe(e.id))[0]).toMatchObject({
      status: "teilweise",
      ergebnis: { grund: "status_geaendert", routine: { notizFassung: 2, fortsetzbar: false } },
    });
    uhr += 60_000;
    await steuerung("danach").lauf();
    expect(await fortgesetzt(e.id)).toEqual([]);
  });

  it("Nacharbeit 12: veraltet nur durch eine neue Fassung (Titel) → mit der heutigen Fassung gemeldet", async () => {
    const { e } = await teilbericht();
    meldungsAblage.unmittelbarVorher = async () => {
      await dienst.aendere(ANNA, e.id, {
        fassung: await fassung(e.id),
        titel: "Wochenbericht Halle 2 (neu)",
      });
    };
    uhr += 60_000;
    await steuerung("titel").lauf();
    const m = await fortgesetzt(e.id);
    expect(m).toHaveLength(1);
    expect(m[0]?.titel).toBe("Wochenbericht Halle 2 (neu)");
    expect((await laeufe(e.id))[0]?.status).toBe("zugestellt");
  });

  it("Nacharbeit 12: Absturz nach „Meldung ausstehend“ festgehalten → nach Ablauf der Berechtigung nur die Meldung", async () => {
    const { e } = await teilbericht();
    meldungsAblage.vorSchreibenWerfen = true;
    laufAblage.bestaetigungWerfen = 1;
    uhr += 60_000;
    await steuerung("stirbt").lauf();
    meldungsAblage.vorSchreibenWerfen = false;
    laufAblage.bestaetigungWerfen = 0;
    expect((await laeufe(e.id))[0]).toMatchObject({
      status: "laeuft",
      ergebnis: { routine: { meldungAusstehend: true, notizFassung: 2 } },
    });
    uhr += KLARA_ERINNERUNG_LEASE_MS + 60_000;
    await steuerung("nach-absturz").lauf();
    expect((await laeufe(e.id))[0]?.status).toBe("zugestellt");
    expect(await fortgesetzt(e.id)).toHaveLength(1);
    expect((await bericht(e.id, TERMIN))?.fassung).toBe(2);
  });

  it("Nacharbeit 12: Meldung scheitert dauerhaft → begrenzte Versuche, Bericht unverändert; Klärung holt sie nach", async () => {
    const { e } = await teilbericht();
    meldungsAblage.vorSchreibenWerfen = true;
    for (let i = 0; i < KLARA_ERINNERUNG_MAX_VERSUCHE + 2; i += 1) {
      uhr += 60_000;
      await steuerung(`versuch-${i}`).lauf();
    }
    meldungsAblage.vorSchreibenWerfen = false;
    const [l] = await laeufe(e.id);
    expect(l).toMatchObject({
      status: "teilweise",
      versuch: KLARA_ERINNERUNG_MAX_VERSUCHE,
      ergebnis: { routine: { meldungAusstehend: true } },
    });
    expect((await bericht(e.id, TERMIN))?.fassung).toBe(2);
    uhr += 60_000;
    await steuerung("ohne-klaerung").lauf();
    expect(await fortgesetzt(e.id)).toEqual([]);
    if (!l) {
      throw new Error("Lauf fehlt");
    }
    await dienst.klaere(ANNA, e.id, l.vorkommenId, {
      entscheidung: "fortfuehren",
      fassung: await fassung(e.id),
    });
    uhr += 60_000;
    await steuerung("nach-klaerung").lauf();
    expect((await laeufe(e.id))[0]?.status).toBe("zugestellt");
    expect(await fortgesetzt(e.id)).toHaveLength(1);
    expect((await bericht(e.id, TERMIN))?.fassung).toBe(2);
  });
});

// ================================================================================================
// S18 · Nacharbeit 12 (Ben, AW18-K06/K09, EQF-07-K03/K05): Serienteilung absturzsicher. Die
// Folgeserie mit ihrer Herkunft ist der ERSTE und einzige Schritt, der wirksam werden kann; die
// bisherige Serie wirkt ab dem Teilungstermin nicht mehr, auch wenn ihre Begrenzung fehlt.
// ================================================================================================

describe("S18 · AW18-K06/K09 — Serienteilung: Absturz zwischen den Schritten, Wiederholung", () => {
  async function tick(datum: string, uhrzeit: string): Promise<void> {
    uhr = um(datum, uhrzeit) + 10_000;
    await steuerung().lauf();
  }
  const ab = "2026-10-16T09:00";
  const folgePlan = {
    art: "serie",
    datum: "2026-10-16",
    uhrzeit: "07:00",
    wiederholung: { takt: "taeglich", intervall: 1, bis: null, anzahl: 2 },
  };

  /** Zustand nach einem Absturz NACH dem ersten Schritt von `abHier`: Folgeserie gespeichert,
   *  bisherige Serie noch unbegrenzt (genau das, was der erste Schreibvorgang hinterlässt). */
  async function absturzNachSchritt1(vorgang: string): Promise<KlaraErinnerung> {
    const e = await taeglich("Rundgang", "2026-10-13", "09:00", 5);
    await dienst.lege(
      ANNA,
      { vorgang, titel: "Rundgang", zeitzone: BERLIN, zeitplan: folgePlan },
      { serieVon: { erinnerungId: e.id, ab } },
    );
    expect((await ablage.erinnerungen.holeSystem(e.id))?.erinnerung.zeitplan).toMatchObject({
      wiederholung: { bis: null, anzahl: 5 },
    });
    return e;
  }

  const folgeserien = async (id: string) =>
    (await ablage.erinnerungen.liste(ANNA, 500)).filter(
      (x) => x.erinnerung.serieVon?.erinnerungId === id,
    );

  it("Absturz vor der Begrenzung: keine doppelte Wirkung ab dem Teilungstermin; Begrenzung nachgeholt", async () => {
    const e = await absturzNachSchritt1("teilung-absturz-0001");
    for (const [d, u] of [
      ["2026-10-13", "09:00"],
      ["2026-10-14", "09:00"],
      ["2026-10-15", "09:00"],
      ["2026-10-16", "07:00"],
      ["2026-10-16", "09:00"],
      ["2026-10-17", "07:00"],
      ["2026-10-17", "09:00"],
    ] as const) {
      await tick(d, u);
    }
    // Die bisherige Serie wirkt nur VOR dem Teilungstermin.
    expect((await meldungenVon(e.id)).map((m) => m.vorkommen[0]).sort()).toEqual([
      "2026-10-13T07:00:00.000Z",
      "2026-10-14T07:00:00.000Z",
      "2026-10-15T07:00:00.000Z",
    ]);
    expect((await laeufe(e.id)).map((l) => l.vorkommenId).sort()).toEqual([
      `${e.id}@2026-10-13T09:00`,
      `${e.id}@2026-10-14T09:00`,
      `${e.id}@2026-10-15T09:00`,
    ]);
    // Die Folgeserie trägt die Termine ab dort — je Termin genau eine Meldung.
    const [folge] = await folgeserien(e.id);
    const folgeMeldungen = await meldungenVon(folge?.erinnerung.id ?? "");
    expect(folgeMeldungen.map((m) => m.vorkommen[0]).sort()).toEqual([
      "2026-10-16T05:00:00.000Z",
      "2026-10-17T05:00:00.000Z",
    ]);
    // Die Steuerung hat die Begrenzung der bisherigen Serie nachgeholt (bedingt auf ihre Fassung).
    expect((await ablage.erinnerungen.holeSystem(e.id))?.erinnerung.zeitplan).toMatchObject({
      wiederholung: { bis: "2026-10-15", anzahl: 3 },
    });
  });

  it("Wiederholung durch die Person nach dem Absturz: idempotent — eine Folgeserie, bisherige begrenzt", async () => {
    const vorgang = "teilung-wiederholt-0001";
    const e = await absturzNachSchritt1(vorgang);
    const { bisher, neu } = await dienst.abHier(ANNA, e.id, ab, {
      fassung: await fassung(e.id),
      vorgang,
      zeitplan: { ...folgePlan, wiederholung: { ...folgePlan.wiederholung, anzahl: 5 } },
    });
    expect(await folgeserien(e.id)).toHaveLength(1);
    expect(neu.erinnerung).toMatchObject({ vorgang, serieVon: { erinnerungId: e.id, ab } });
    expect(bisher.erinnerung.zeitplan).toMatchObject({
      wiederholung: { bis: "2026-10-15", anzahl: 3 },
    });
    // Ein fremder Vorgang derselben Kennung teilt nichts.
    const anders = await taeglich("Anderer Rundgang", "2026-10-13", "09:00", 5);
    await expect(
      dienst.abHier(ANNA, anders.id, ab, { fassung: await fassung(anders.id), vorgang }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await folgeserien(anders.id)).toEqual([]);
  });

  // ---- Nacharbeit 13 (Ben): Readback vor Kompensation; Einzelzustände gehen mit ----------------

  type Ersetze = KlaraErinnerungAblage["erinnerungen"]["ersetze"];
  /** Störung an der Begrenzung der bisherigen Serie `id` (genau EIN Aufruf). */
  function stoereBegrenzung(
    id: string,
    art: { vorher?: () => Promise<void>; antwortVerloren?: boolean; scheitert?: boolean },
  ): void {
    const repo = ablage.erinnerungen;
    const original: Ersetze = repo.ersetze.bind(repo);
    let einmal = true;
    repo.ersetze = async (x, s) => {
      if (x.id !== id || !einmal) {
        return original(x, s);
      }
      einmal = false;
      await art.vorher?.();
      if (art.scheitert) {
        throw new Error("Ablage beim Begrenzen nicht erreichbar");
      }
      const ok = await original(x, s);
      if (art.antwortVerloren) {
        throw new Error("Antwort nach dem Begrenzen verloren");
      }
      return ok;
    };
  }

  /** Was alle Takte bis zum 19.10. tatsächlich gemeldet haben, je Serie. */
  async function bis19(e: KlaraErinnerung): Promise<{ alt: string[]; folge: string[] }> {
    for (const tag of ["13", "14", "15", "16", "17", "18", "19"]) {
      await tick(`2026-10-${tag}`, "07:00");
      await tick(`2026-10-${tag}`, "09:00");
    }
    const [folge, ...mehr] = await folgeserien(e.id);
    expect(mehr).toEqual([]);
    const m = async (id: string) =>
      (await meldungenVon(id)).map((x) => x.vorkommen[0] ?? "").sort();
    return { alt: await m(e.id), folge: folge ? await m(folge.erinnerung.id) : [] };
  }

  it("Nacharbeit 13: Antwort nach GESPEICHERTER Begrenzung verloren → Teilung übernommen, Folgeserie bleibt", async () => {
    const e = await taeglich("Rundgang", "2026-10-13", "09:00", 5);
    stoereBegrenzung(e.id, { antwortVerloren: true });
    const { bisher, neu } = await dienst.abHier(ANNA, e.id, ab, {
      fassung: await fassung(e.id),
      titel: "Rundgang (neu)",
    });
    expect(bisher.erinnerung.zeitplan).toMatchObject({ wiederholung: { bis: "2026-10-15" } });
    expect(await ablage.erinnerungen.holeSystem(neu.erinnerung.id)).not.toBeNull();
    const r = await bis19(e);
    expect(r.alt).toEqual([
      "2026-10-13T07:00:00.000Z",
      "2026-10-14T07:00:00.000Z",
      "2026-10-15T07:00:00.000Z",
    ]);
    expect(r.folge).toEqual(["2026-10-16T07:00:00.000Z", "2026-10-17T07:00:00.000Z"]);
  });

  it("Nacharbeit 13: Begrenzung inzwischen von der Steuerung gespeichert → Teilung übernommen", async () => {
    const e = await taeglich("Rundgang", "2026-10-13", "09:00", 5);
    stoereBegrenzung(e.id, {
      // Wie `bearbeite`: dieselbe Begrenzung, bedingt auf die gelesene Fassung — vor unserer.
      vorher: async () => {
        const x = await ablage.erinnerungen.holeSystem(e.id);
        if (!x || x.erinnerung.zeitplan.art !== "serie") {
          throw new Error("Serie fehlt");
        }
        const wiederholung = {
          ...x.erinnerung.zeitplan.wiederholung,
          bis: "2026-10-15",
          anzahl: 3,
        };
        const begrenzt = {
          ...x.erinnerung,
          zeitplan: { ...x.erinnerung.zeitplan, wiederholung },
          fassung: x.erinnerung.fassung + 1,
        };
        // Die gestörte Begrenzung ist schon „verbraucht“: dieser Aufruf geht ungestört durch.
        expect(await ablage.erinnerungen.ersetze(begrenzt, x.steuer)).toBe(true);
      },
    });
    const { bisher, neu } = await dienst.abHier(ANNA, e.id, ab, { fassung: await fassung(e.id) });
    expect(bisher.erinnerung.zeitplan).toMatchObject({ wiederholung: { bis: "2026-10-15" } });
    expect(await ablage.erinnerungen.holeSystem(neu.erinnerung.id)).not.toBeNull();
    const r = await bis19(e);
    expect(r.alt).toHaveLength(3);
    expect(r.folge).toEqual(["2026-10-16T07:00:00.000Z", "2026-10-17T07:00:00.000Z"]);
  });

  it("Nacharbeit 13: Begrenzung scheitert, Readback unmöglich → Folgeserie bleibt, Steuerung vollendet", async () => {
    const e = await taeglich("Rundgang", "2026-10-13", "09:00", 5);
    const repo = ablage.erinnerungen;
    const hole = repo.hole.bind(repo);
    stoereBegrenzung(e.id, {
      scheitert: true,
      vorher: async () => {
        repo.hole = () => Promise.reject(new Error("Ablage nicht lesbar"));
      },
    });
    await expect(dienst.abHier(ANNA, e.id, ab, { fassung: await fassung(e.id) })).rejects.toThrow(
      "Ablage beim Begrenzen nicht erreichbar",
    );
    repo.hole = hole;
    expect(await folgeserien(e.id)).toHaveLength(1); // die Teilungsabsicht ist erhalten
    const r = await bis19(e);
    expect(r.alt).toHaveLength(3);
    expect(r.folge).toEqual(["2026-10-16T07:00:00.000Z", "2026-10-17T07:00:00.000Z"]);
    expect((await ablage.erinnerungen.holeSystem(e.id))?.erinnerung.zeitplan).toMatchObject({
      wiederholung: { bis: "2026-10-15" },
    });
  });

  it("Nacharbeit 13: nachweislich anderswo geändert → Abbruch; frische, wirkungslose Folgeserie entfernt", async () => {
    const e = await taeglich("Rundgang", "2026-10-13", "09:00", 5);
    stoereBegrenzung(e.id, {
      vorher: async () => {
        await dienst.aendere(ANNA, e.id, { fassung: await fassung(e.id), titel: "Anderswo" });
      },
    });
    await expect(
      dienst.abHier(ANNA, e.id, ab, { fassung: await fassung(e.id) }),
    ).rejects.toMatchObject({ status: 409, grund: "konflikt" });
    expect(await folgeserien(e.id)).toEqual([]);
    expect((await ablage.erinnerungen.holeSystem(e.id))?.erinnerung).toMatchObject({
      titel: "Anderswo",
      zeitplan: { wiederholung: { bis: null, anzahl: 5 } },
    });
  });

  it("Nacharbeit 16: fremde Uhrzeitänderung lässt den Teilungstermin entfallen → Konflikt, KEIN Erfolg", async () => {
    const e = await taeglich("Rundgang", "2026-10-13", "09:00", 5);
    stoereBegrenzung(e.id, {
      // Parallel: die ganze Serie auf 08:00 — der Schlüssel 16T09:00 existiert danach nicht mehr,
      // die Serie ist aber NICHT begrenzt.
      vorher: async () => {
        await dienst.aendere(ANNA, e.id, {
          fassung: await fassung(e.id),
          zeitplan: {
            art: "serie",
            datum: "2026-10-13",
            uhrzeit: "08:00",
            wiederholung: { takt: "taeglich", intervall: 1, bis: null, anzahl: 5 },
          },
        });
      },
    });
    await expect(
      dienst.abHier(ANNA, e.id, ab, { fassung: await fassung(e.id), titel: "Rundgang (neu)" }),
    ).rejects.toMatchObject({ status: 409, grund: "konflikt" });
    expect(await folgeserien(e.id)).toEqual([]);
    expect((await ablage.erinnerungen.holeSystem(e.id))?.erinnerung.zeitplan).toMatchObject({
      uhrzeit: "08:00",
      wiederholung: { bis: null, anzahl: 5 },
    });
  });

  it("Nacharbeit 16: Folgeserie inzwischen geändert → bedingtes Entfernen greift nicht, sie bleibt", async () => {
    const e = await taeglich("Rundgang", "2026-10-13", "09:00", 5);
    stoereBegrenzung(e.id, {
      vorher: async () => {
        await dienst.aendere(ANNA, e.id, { fassung: await fassung(e.id), titel: "Anderswo" });
        // Die Person bearbeitet die eben entstandene Folgeserie bereits (andere Sitzung).
        const [folge] = await folgeserien(e.id);
        if (!folge) {
          throw new Error("Folgeserie fehlt");
        }
        await dienst.aendere(ANNA, folge.erinnerung.id, {
          fassung: folge.erinnerung.fassung,
          titel: "Folge, schon bearbeitet",
        });
      },
    });
    await expect(
      dienst.abHier(ANNA, e.id, ab, { fassung: await fassung(e.id) }),
    ).rejects.toMatchObject({ status: 409, grund: "konflikt" });
    const [folge, ...mehr] = await folgeserien(e.id);
    expect(mehr).toEqual([]);
    expect(folge?.erinnerung).toMatchObject({ titel: "Folge, schon bearbeitet", fassung: 2 });
  });

  it("Nacharbeit 16: bedingtes Entfernen — Fassung und Lauf gelten im selben Schritt", async () => {
    const frisch = await einmalig("Frisch", "2026-10-20", "09:00"); // noch kein Lauf
    const geaendert = await einmalig("Geändert", "2026-10-13", "09:00");
    await dienst.aendere(ANNA, geaendert.id, { fassung: 1, titel: "Geändert 2" });
    const gelaufen = await einmalig("Gelaufen", "2026-10-13", "09:00");
    await tick("2026-10-13", "09:00");
    expect(await laeufe(gelaufen.id)).toHaveLength(1);
    const r = ablage.erinnerungen;
    expect(await r.entferneBedingt(ANNA, geaendert.id, 1)).toBe(false);
    expect(await r.entferneBedingt(ANNA, gelaufen.id, 1)).toBe(false);
    expect(await r.entferneBedingt(BERT, frisch.id, 1)).toBe(false);
    expect(await r.holeSystem(geaendert.id)).not.toBeNull();
    expect(await r.holeSystem(gelaufen.id)).not.toBeNull();
    expect(await laeufe(frisch.id)).toEqual([]);
    expect(await r.entferneBedingt(ANNA, frisch.id, 1)).toBe(true);
    expect(await r.holeSystem(frisch.id)).toBeNull();
    // Nacharbeit 17: eine Übernahme NACH dem Entfernen legt keinen verwaisten Lauf an.
    const schluessel = "2026-10-20T09:00";
    expect(
      await ablage.laeufe.uebernimm({
        vorkommenId: `${frisch.id}@${schluessel}`,
        erinnerungId: frisch.id,
        kontoId: ANNA,
        geplantFuer: um("2026-10-20", "09:00"),
        besitzer: "nach-dem-entfernen",
        jetzt: uhr,
        leaseMs: KLARA_ERINNERUNG_LEASE_MS,
        art: "erinnerung",
        meldungId: `ke-${frisch.id}@${schluessel}`,
      }),
    ).toBeNull();
    expect(await laeufe(frisch.id)).toEqual([]);
  });

  it("Nacharbeit 13: abgesagte und erledigte FOLGENDE Termine bleiben — Titeländerung ab hier", async () => {
    const e = await taeglich("Rundgang", "2026-10-13", "09:00", 7); // 13.–19.
    for (const [termin, aktion] of [
      ["2026-10-17T09:00", "absagen"],
      ["2026-10-18T09:00", "erledigen"],
    ] as const) {
      await dienst.vorkommen(ANNA, e.id, termin, { fassung: await fassung(e.id), aktion });
    }
    const { neu } = await dienst.abHier(ANNA, e.id, ab, {
      fassung: await fassung(e.id),
      titel: "Rundgang (neu)",
    });
    expect(neu.erinnerung.ausnahmen).toMatchObject({
      "2026-10-17T09:00": { art: "abgesagt" },
      "2026-10-18T09:00": { art: "erledigt" },
    });
    const r = await bis19(e);
    expect(r.alt).toHaveLength(3);
    expect(r.folge).toEqual(["2026-10-16T07:00:00.000Z", "2026-10-19T07:00:00.000Z"]);
  });

  it("Nacharbeit 13: bei geändertem Zeitplan der Reihenfolge nach zugeordnet; Wiederanlauf erhält sie", async () => {
    const e = await taeglich("Rundgang", "2026-10-13", "09:00", 7);
    await dienst.vorkommen(ANNA, e.id, "2026-10-17T09:00", {
      fassung: await fassung(e.id),
      aktion: "absagen",
    });
    // Die Begrenzung „stirbt“ ohne Rücklesen: die Folgeserie (mit Einzelzuständen) bleibt stehen.
    const repo = ablage.erinnerungen;
    const hole = repo.hole.bind(repo);
    stoereBegrenzung(e.id, {
      scheitert: true,
      vorher: async () => {
        repo.hole = () => Promise.reject(new Error("Ablage nicht lesbar"));
      },
    });
    await expect(
      dienst.abHier(ANNA, e.id, ab, {
        fassung: await fassung(e.id),
        zeitplan: {
          art: "serie",
          datum: "2026-10-16",
          uhrzeit: "07:00",
          wiederholung: { takt: "taeglich", intervall: 1, bis: null, anzahl: 4 },
        },
      }),
    ).rejects.toThrow();
    repo.hole = hole;
    const [folge] = await folgeserien(e.id);
    expect(folge?.erinnerung.ausnahmen).toMatchObject({ "2026-10-17T07:00": { art: "abgesagt" } });
    // Der Termin der bisherigen Serie ab dem Teilungstermin ist dort nicht mehr änderbar.
    await expect(
      dienst.vorkommen(ANNA, e.id, "2026-10-18T09:00", {
        fassung: await fassung(e.id),
        aktion: "absagen",
      }),
    ).rejects.toMatchObject({ status: 409, grund: "zustand" });
    // „Neustart“: neue Steuerungsinstanzen über derselben Ablage.
    const r = await bis19(e);
    expect(r.alt).toHaveLength(3);
    expect(r.folge).toEqual([
      "2026-10-16T05:00:00.000Z",
      "2026-10-18T05:00:00.000Z",
      "2026-10-19T05:00:00.000Z",
    ]);
  });

  it("Nacharbeit 13: ganze Serie neu geplant → kommende Absage bleibt, der Reihenfolge nach", async () => {
    const e = await taeglich("Rundgang", "2026-10-13", "09:00", 4); // 13.–16.
    await dienst.vorkommen(ANNA, e.id, "2026-10-15T09:00", {
      fassung: await fassung(e.id),
      aktion: "absagen",
    });
    const neu = await dienst.aendere(ANNA, e.id, {
      fassung: await fassung(e.id),
      zeitplan: {
        art: "serie",
        datum: "2026-10-13",
        uhrzeit: "08:00",
        wiederholung: { takt: "taeglich", intervall: 1, bis: null, anzahl: 4 },
      },
    });
    expect(neu.erinnerung.ausnahmen).toEqual({
      "2026-10-15T08:00": expect.objectContaining({ art: "abgesagt" }),
    });
  });

  it("Nacharbeit 13: eine zweite, andere Teilung ab einem fortgeführten Termin wird abgelehnt", async () => {
    const e = await absturzNachSchritt1("teilung-erste-0001");
    await expect(
      dienst.abHier(ANNA, e.id, "2026-10-17T09:00", {
        fassung: await fassung(e.id),
        vorgang: "teilung-zweite-0001",
      }),
    ).rejects.toMatchObject({ status: 409, grund: "zustand" });
    expect(await folgeserien(e.id)).toHaveLength(1);
  });

  it("regulär: die Folgeserie entsteht MIT ihrer Herkunft in einem Schritt (Fassung 1)", async () => {
    const e = await taeglich("Rundgang", "2026-10-13", "09:00", 5);
    const { neu } = await dienst.abHier(ANNA, e.id, ab, { fassung: await fassung(e.id) });
    expect(neu.erinnerung).toMatchObject({ fassung: 1, serieVon: { erinnerungId: e.id, ab } });
  });
});
