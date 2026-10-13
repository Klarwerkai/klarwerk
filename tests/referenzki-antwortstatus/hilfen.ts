// ================================================================================================
// produkt:20261009:referenzki-antwortstatus (REF-04) — GEMEINSAME VORRICHTUNG DER PRÜFUNGEN.
// ================================================================================================
//
// Ein fiktiver Bestand im Speicher (Fassungen, Sichtbarkeit) und ein Prüfer-Doppelgänger, der jeden
// Aufruf zählt und nach einem festen Urteiler antwortet. Der Doppelgänger beweist nichts über ein
// echtes Modell; die echte Beobachtung steht getrennt (`tests-smoke/referenzki-antwortstatus-modell
// .spec.ts`). Alle Inhalte sind erfunden.
import {
  type AufloesbaresObjekt,
  type FundstellenLeser,
  type ObjektFassung,
  REFERENZ_PRUEF_RICHTLINIE,
  type ReferenzProtokollEintrag,
  ReferenzPruefdienst,
} from "../../services/ask";
import type { ReferenzPruefer, ReferenzPrueferWahl, ReferenzRolle } from "../../services/reasoner";

export const ANTWORT_ROLLE: ReferenzRolle = {
  anbieter: "cloud:openai:antwort-attrappe",
  modell: "antwort-modell-a",
  stufe: "cloud",
};
export const PRUEF_ROLLE: ReferenzRolle = {
  anbieter: "anthropic:pruef-attrappe",
  modell: "pruef-modell-b",
  stufe: "cloud",
};
export const PRUEF_ROLLE_NEU: ReferenzRolle = {
  anbieter: "anthropic:pruef-attrappe",
  modell: "pruef-modell-c",
  stufe: "cloud",
};

export interface Objekt extends AufloesbaresObjekt {
  confidentiality?: string;
}

/** Ein Bestand im Speicher: aktuelle Objekte und ihre unveränderlichen Fassungen. */
export function bestand(quellen: readonly { id: string; version: number; statement: string }[]) {
  const aktuell = new Map<string, Objekt>();
  const fassungen = new Map<string, Map<number, ObjektFassung>>();
  for (const q of quellen) {
    aktuell.set(q.id, {
      id: q.id,
      version: q.version,
      originalAuthor: "autor-fiktiv",
      confidentiality: "intern",
      statement: q.statement,
    });
    fassungen.set(q.id, new Map([[q.version, { statement: q.statement }]]));
  }
  const leser: FundstellenLeser<Objekt> = {
    aktuell: async (id) => aktuell.get(id),
    imPapierkorb: async () => undefined,
    fassung: async (id, v) => fassungen.get(id)?.get(v),
  };
  return {
    leser,
    /** Eine neue Fassung — die alte bleibt lesbar. */
    revidiere(id: string, statement: string) {
      const alt = aktuell.get(id);
      if (!alt) {
        throw new Error(id);
      }
      const neu = { ...alt, version: alt.version + 1, statement };
      aktuell.set(id, neu);
      fassungen.get(id)?.set(neu.version, { statement });
    },
  };
}

export interface DatenPosten {
  teilId: string;
  fundstellen: { fundstelleId: string; auszug: string }[];
}

function datenAus(user: string): DatenPosten[] {
  return (JSON.parse(user.slice(user.indexOf("\n") + 1)) as { posten: DatenPosten[] }).posten;
}

export type Urteiler = (posten: DatenPosten[]) => string | Error | Promise<string>;

/** Ein Prüfer-Doppelgänger: zählt jeden Aufruf und urteilt nach `urteiler`. */
export function doppelgaenger(urteiler: Urteiler, rolle: ReferenzRolle = PRUEF_ROLLE) {
  const zaehler = { aufrufe: 0 };
  const pruefer: ReferenzPruefer = {
    rolle,
    extern: false,
    pruefe: async (_system, user) => {
      zaehler.aufrufe += 1;
      const text = await urteiler(datenAus(user));
      if (text instanceof Error) {
        throw text;
      }
      return { text, dauerMs: 7, verbrauch: { eingabe: 410, ausgabe: 90 } };
    },
  };
  return { pruefer, zaehler };
}

/** Urteilt jeden Posten gleich — mit seiner ersten Fundstelle. */
export function alle(zustand: string, begruendung = "Die Fundstelle trägt die Aussage."): Urteiler {
  return (posten) =>
    JSON.stringify({
      richtlinie: REFERENZ_PRUEF_RICHTLINIE,
      ergebnisse: posten.map((p) => ({
        teilId: p.teilId,
        zustand,
        fundstelleId: p.fundstellen[0]?.fundstelleId ?? null,
        begruendung,
      })),
    });
}

/** Ein Urteiler, der nie antwortet — das Zeitlimit des Dienstes greift. */
export const nieFertig: Urteiler = () => new Promise<string>(() => undefined);

/** Der Dienst mit wechselbarer Prüferwahl (`wahl.jetzt`) und mitgeschriebenem Protokoll. */
export function dienstMit(wahl: { jetzt: ReferenzPrueferWahl }) {
  const protokoll: ReferenzProtokollEintrag[] = [];
  const dienst = new ReferenzPruefdienst({
    waehlePruefer: () => wahl.jetzt,
    externErlaubt: () => true,
    istVertraulich: (ko) => (ko as Objekt).confidentiality === "vertraulich",
    protokolliere: async (e) => {
      protokoll.push(e);
    },
    zeitlimitMs: 60,
  });
  return { dienst, protokoll };
}
