import type {
  KnowledgeObject,
  KoVeroeffentlichung,
  VeroeffentlichungsMeldung,
} from "../../knowledge-object";
import type { AnforderungsStand } from "./kenntnisnahme";

// ================================================================================================
// VERÖFFENTLICHUNG MIT BENACHRICHTIGUNGSWAHL (produkt:20261007:veroeffentlichungsoptionen).
// ================================================================================================
//
// WAS DAS IST. Wer fachlich freigeben darf (`ko.validate`, Controller/Admin), veröffentlicht die
// GÜLTIGE Fassung eines Eintrags für die berechtigten Leser — intern, nicht im Internet — und wählt
// dabei, wie gemeldet wird:
//   · still         — keine Meldung. Der Eintrag bleibt für Berechtigte auffindbar, der Vermerk steht
//                     im Verlauf und im Prüfprotokoll (`ko.veroeffentlicht`).
//   · normal        — je ein Eintrag in der vorhandenen Glocke für jede Person, die den Eintrag lesen
//                     darf (ohne die veröffentlichende).
//   · hervorgehoben — derselbe Empfängerkreis; die Meldung ist markiert und steht in der Glocke oben,
//                     bis sie gelesen ist. Sie erweitert keine Rechte: der Kreis ist derselbe wie bei
//                     „normal".
//
// WER DIE MELDUNG BEKOMMT, entscheidet die Glocke beim Lesen: das Konto bestand zum
// Veröffentlichungszeitpunkt, es ist nicht die veröffentlichende Person, und es darf den Eintrag
// JETZT sehen (`sichtbareEintraege` in der Route — dieselbe Regel wie am Detailabruf). Am Eintrag
// steht nur die Anzahl der Benachrichtigten, keine Liste der Kollegen.
//
// DREI DINGE BLEIBEN GETRENNT. Sichtbarkeit entscheidet allein `sichtbarkeit.ts` (Stufe, Space,
// Autor) — das Veröffentlichen ändert sie nicht. Die fachliche Freigabe ist der Status `validiert`
// aus dem Prüfweg — das Veröffentlichen setzt sie voraus und ändert sie nicht. Die Meldungswirkung
// ist allein die Wahl oben.
//
// KENNTNISNAHME BLEIBT. Eine ausdrücklich angeforderte Kenntnisnahme hat ihren eigenen Weg
// (`kenntnisnahme.ts`) und ihre eigene Glockenmeldung. „still" berührt sie nicht; die Vorschau nennt
// die offenen und die durch eine neue Fassung überholten Anforderungen, damit ein stilles Update sie
// nicht unbemerkt ins Leere laufen lässt.

/** Die drei Meldungswahlen — eine geschlossene Menge. */
export const MELDUNGEN: readonly VeroeffentlichungsMeldung[] = ["still", "normal", "hervorgehoben"];

/** Wie viele Veröffentlichungsbelege die Glocke höchstens durchsieht (die jüngsten). */
export const VEROEFFENTLICHUNG_MELDUNGEN_FENSTER = 100;

/** Ein fachlicher Fehler dieses Vorgangs — `grund` ist die maschinenlesbare Ursache. */
export class VeroeffentlichungFehler extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    readonly grund: string,
    message: string,
    readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "VeroeffentlichungFehler";
  }
}

export interface VeroeffentlichungKoZugang {
  get(id: string): Promise<KnowledgeObject | undefined>;
  vermerkeVeroeffentlichung(
    id: string,
    bilde: (ko: KnowledgeObject) => KoVeroeffentlichung,
  ): Promise<{ ko: KnowledgeObject; vermerk: KoVeroeffentlichung }>;
}

export interface VeroeffentlichungDienstDeps {
  ko: VeroeffentlichungKoZugang;
  /**
   * Die Konten, die den Eintrag JETZT lesen dürfen — dieselbe Regel wie der Empfängerkreis einer
   * Kenntnisnahme (`KenntnisnahmeDienst.moeglicheEmpfaenger`): freigegeben, nicht abgelaufen,
   * `ko.read` und `darfSehen`. Eine zweite Auslegung gibt es hier nicht.
   */
  leser: (ko: KnowledgeObject) => Promise<Array<{ id: string; name: string }>>;
  kontoNamen: () => Promise<Map<string, string>>;
  /** Seit wann es dieses Konto gibt (ISO) — `undefined`: unbekannt (Altbestand). */
  kontoSeit: (nutzerId: string) => Promise<string | undefined>;
  /** Die Kenntnisnahme-Anforderungen dieses Eintrags (`KenntnisnahmeDienst.uebersicht`). */
  kenntnisnahmen: (ko: KnowledgeObject) => Promise<AnforderungsStand[]>;
  /** Die Belege `ko.veroeffentlicht` aus dem Prüfprotokoll, in Schreibreihenfolge. */
  belege: () => Promise<Array<{ target: string; payload: Record<string, unknown> }>>;
  jetzt: () => number;
  kennung: () => string;
}

export interface KenntnisnahmeLage {
  /** Offene Empfänger (ausstehend/überfällig) einer Anforderung der AKTUELLEN Fassung. */
  offen: number;
  /** Unbestätigte Empfänger früherer Fassungen — durch eine neuere Fassung überholt. */
  ueberholt: number;
}

export interface VerlaufEintrag {
  id: string;
  fassung: number;
  art: KoVeroeffentlichung["art"];
  meldung: VeroeffentlichungsMeldung;
  von: { id: string; name: string };
  am: string;
  empfaenger: number;
}

/** Was jeder Leser über den Veröffentlichungsstand erfährt. */
export interface VeroeffentlichungsStand {
  koId: string;
  aktuelleFassung: number;
  /** Ist die aktuelle Fassung fachlich freigegeben (`validiert`)? */
  gueltig: boolean;
  /** Die zuletzt veröffentlichte Fassung — `null`: nie veröffentlicht. */
  veroeffentlichteFassung: number | null;
  /** Ist genau die aktuelle Fassung die veröffentlichte? */
  aktuelleIstVeroeffentlicht: boolean;
  verlauf: VerlaufEintrag[];
}

/** Was nur sieht, wer veröffentlichen darf: die Wirkung jeder Wahl, vor dem Klick. */
export interface Veroeffentlichungsvorschau extends VeroeffentlichungsStand {
  art: KoVeroeffentlichung["art"];
  /** `null`: zulässig. Sonst der Grund, warum diese Fassung jetzt nicht veröffentlicht werden kann. */
  hinderungsgrund: "keine_gueltige_fassung" | "bereits_veroeffentlicht" | null;
  sichtbarkeit: {
    stufe: string | null;
    spaceId: string | null;
    /** Alle Konten, die den Eintrag lesen dürfen — einschliesslich der veröffentlichenden Person. */
    leser: number;
  };
  /** Die Empfänger bei „normal" und „hervorgehoben" (bei „still": niemand). */
  empfaenger: Array<{ id: string; name: string }>;
  kenntnisnahmen: KenntnisnahmeLage;
}

export interface VeroeffentlichungsErgebnis {
  vermerk: VerlaufEintrag;
  kenntnisnahmen: KenntnisnahmeLage;
}

/** Eine Veröffentlichungsmeldung für die Glocke — die Route filtert noch über die Sichtbarkeit. */
export interface VeroeffentlichungsMeldungFuerGlocke {
  vermerkId: string;
  koId: string;
  title: string;
  fassung: number;
  art: KoVeroeffentlichung["art"];
  hervorgehoben: boolean;
  at: string;
}

export class VeroeffentlichungDienst {
  constructor(private readonly deps: VeroeffentlichungDienstDeps) {}

  private async verlauf(ko: KnowledgeObject): Promise<VerlaufEintrag[]> {
    const namen = await this.deps.kontoNamen();
    return [...(ko.veroeffentlichungen ?? [])].reverse().map((v) => ({
      id: v.id,
      fassung: v.fassung,
      art: v.art,
      meldung: v.meldung,
      von: { id: v.von, name: namen.get(v.von) ?? "" },
      am: v.am,
      empfaenger: v.empfaenger,
    }));
  }

  /** Der Stand für jeden Leser: welche Fassung veröffentlicht ist und welche gerade gilt. */
  async stand(ko: KnowledgeObject): Promise<VeroeffentlichungsStand> {
    const letzte = (ko.veroeffentlichungen ?? []).at(-1);
    return {
      koId: ko.id,
      aktuelleFassung: ko.version,
      gueltig: ko.status === "validiert",
      veroeffentlichteFassung: letzte ? letzte.fassung : null,
      aktuelleIstVeroeffentlicht: letzte !== undefined && letzte.fassung === ko.version,
      verlauf: await this.verlauf(ko),
    };
  }

  private async kenntnisnahmeLage(ko: KnowledgeObject): Promise<KenntnisnahmeLage> {
    const lage: KenntnisnahmeLage = { offen: 0, ueberholt: 0 };
    for (const a of await this.deps.kenntnisnahmen(ko)) {
      if (a.fassung === ko.version) {
        lage.offen += a.zaehlung.ausstehend + a.zaehlung.ueberfaellig;
      } else {
        lage.ueberholt += a.zaehlung.ueberholt;
      }
    }
    return lage;
  }

  private async empfaengerOhne(
    ko: KnowledgeObject,
    veroeffentlicher: string,
  ): Promise<{ leser: number; empfaenger: Array<{ id: string; name: string }> }> {
    const leser = await this.deps.leser(ko);
    return { leser: leser.length, empfaenger: leser.filter((k) => k.id !== veroeffentlicher) };
  }

  /** Die Vorschau für die veröffentlichende Person — Zustand, Sichtbarkeit und Empfänger. */
  async vorschau(
    ko: KnowledgeObject,
    veroeffentlicher: string,
  ): Promise<Veroeffentlichungsvorschau> {
    const stand = await this.stand(ko);
    const { leser, empfaenger } = await this.empfaengerOhne(ko, veroeffentlicher);
    const bisher = ko.veroeffentlichungen ?? [];
    return {
      ...stand,
      art: bisher.length > 0 ? "aktualisierung" : "neu",
      hinderungsgrund: !stand.gueltig
        ? "keine_gueltige_fassung"
        : stand.aktuelleIstVeroeffentlicht
          ? "bereits_veroeffentlicht"
          : null,
      sichtbarkeit: {
        stufe: ko.confidentiality ?? null,
        spaceId: typeof ko.spaceId === "string" ? ko.spaceId : null,
        leser,
      },
      empfaenger,
      kenntnisnahmen: await this.kenntnisnahmeLage(ko),
    };
  }

  /**
   * Veröffentlicht die gültige Fassung `fassung` mit der gewählten Meldung. Die Zulässigkeit wird
   * unter dem KO-Lock am frisch gelesenen Objekt entschieden (`vermerkeVeroeffentlichung`).
   */
  async veroeffentlichen(
    ko: KnowledgeObject,
    eingabe: { fassung: number; meldung: VeroeffentlichungsMeldung },
    veroeffentlicher: string,
  ): Promise<VeroeffentlichungsErgebnis> {
    const empfaenger =
      eingabe.meldung === "still"
        ? 0
        : (await this.empfaengerOhne(ko, veroeffentlicher)).empfaenger.length;
    const id = this.deps.kennung();
    const am = new Date(this.deps.jetzt()).toISOString();
    const { ko: danach, vermerk } = await this.deps.ko.vermerkeVeroeffentlichung(
      ko.id,
      (frisch) => {
        if (frisch.status !== "validiert") {
          throw new VeroeffentlichungFehler(
            409,
            "keine_gueltige_fassung",
            "Nur eine gültige (geprüfte) Fassung kann veröffentlicht werden.",
          );
        }
        if (frisch.version !== eingabe.fassung) {
          throw new VeroeffentlichungFehler(
            409,
            "fassung_veraltet",
            "Die angezeigte Fassung ist nicht mehr die aktuelle.",
            { aktuelleFassung: frisch.version },
          );
        }
        const bisher = frisch.veroeffentlichungen ?? [];
        if (bisher.some((v) => v.fassung === eingabe.fassung)) {
          throw new VeroeffentlichungFehler(
            409,
            "bereits_veroeffentlicht",
            "Diese Fassung ist bereits veröffentlicht.",
          );
        }
        return {
          id,
          fassung: frisch.version,
          art: bisher.length > 0 ? "aktualisierung" : "neu",
          meldung: eingabe.meldung,
          von: veroeffentlicher,
          am,
          empfaenger,
        };
      },
    );
    const namen = await this.deps.kontoNamen();
    return {
      vermerk: {
        id: vermerk.id,
        fassung: vermerk.fassung,
        art: vermerk.art,
        meldung: vermerk.meldung,
        von: { id: vermerk.von, name: namen.get(vermerk.von) ?? "" },
        am: vermerk.am,
        empfaenger: vermerk.empfaenger,
      },
      kenntnisnahmen: await this.kenntnisnahmeLage(danach),
    };
  }

  /**
   * Die Veröffentlichungsmeldungen dieses Kontos für die vorhandene Glocke. Gelesen wird aus den
   * jüngsten Belegen; maßgeblich ist der Vermerk am Eintrag (Meldungswahl, Zeitpunkt). „still"
   * erzeugt hier nie etwas, die eigene Veröffentlichung meldet sich nicht selbst, und ein Konto,
   * das erst danach angelegt wurde, bekommt keine Meldung über Früheres. Ob das Konto den Eintrag
   * sehen darf, prüft die Route (`sichtbareEintraege`) — hier wird keine zweite Regel geschrieben.
   */
  async meldungenFuer(nutzerId: string): Promise<VeroeffentlichungsMeldungFuerGlocke[]> {
    const belege = (await this.deps.belege()).slice(-VEROEFFENTLICHUNG_MELDUNGEN_FENSTER);
    if (belege.length === 0) {
      return [];
    }
    const seit = await this.deps.kontoSeit(nutzerId);
    const kos = new Map<string, KnowledgeObject | undefined>();
    const meldungen: VeroeffentlichungsMeldungFuerGlocke[] = [];
    for (const beleg of belege) {
      if (beleg.payload.meldung === "still" || typeof beleg.payload.vermerkId !== "string") {
        continue;
      }
      if (!kos.has(beleg.target)) {
        kos.set(beleg.target, await this.deps.ko.get(beleg.target));
      }
      const ko = kos.get(beleg.target);
      const vermerk = ko?.veroeffentlichungen?.find((v) => v.id === beleg.payload.vermerkId);
      if (!ko || !vermerk || vermerk.meldung === "still" || vermerk.von === nutzerId) {
        continue;
      }
      if (seit !== undefined && Date.parse(seit) > Date.parse(vermerk.am)) {
        continue;
      }
      meldungen.push({
        vermerkId: vermerk.id,
        koId: ko.id,
        title: ko.title,
        fassung: vermerk.fassung,
        art: vermerk.art,
        hervorgehoben: vermerk.meldung === "hervorgehoben",
        at: vermerk.am,
      });
    }
    return meldungen;
  }
}
