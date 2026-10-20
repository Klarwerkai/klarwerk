// H: Der erhaltene Funktionsvertrag wird auf die bereits vorhandenen D-Zeitregeln abgebildet.
// Kein eigener Timer und keine zweite DST-Rechnung. Auch die Kalenderdaten und Vorkommen kommen
// aus D; die dauerhafte Laufkennung bleibt im ursprünglichen P06-Funktionsspeicher.
import type { Zeitplan } from "./assistenz-lernen";
import { vorkommenVon } from "./klara-erinnerung";
import {
  type Zeitplan as DZeitplan,
  SOMMERZEIT_VORGABE,
  loeseMitRegel,
  lokalVon,
  plusTage,
} from "./klara-erinnerung-zeit";

export interface Termin {
  readonly kennung: string;
  readonly am: number;
}
export interface Lokal {
  readonly y: number;
  readonly mo: number;
  readonly d: number;
  readonly h: number;
  readonly mi: number;
}
const zwei = (n: number) => String(n).padStart(2, "0");

/** Kompatibilität für erhaltene Originalprüfungen; die Auflösung erledigt ausschließlich D. */
export function lokalZuUtc(zone: string, l: Lokal): number {
  const r = loeseMitRegel(
    { datum: `${l.y}-${zwei(l.mo)}-${zwei(l.d)}`, uhrzeit: `${zwei(l.h)}:${zwei(l.mi)}` },
    zone,
    SOMMERZEIT_VORGABE,
  );
  if (r.ms === null) throw new Error("Lokale Zeit konnte nicht aufgelöst werden.");
  return r.ms;
}

export function faelligerTermin(
  z: Zeitplan,
  seit: number,
  jetzt: number,
  erledigt: (kennung: string) => boolean,
  toleranzMs: number,
): Termin | null {
  if (jetzt < seit || z.art === "bei_ereignis") return null;
  let termin: Termin | null = null;
  if (z.art === "sofort") {
    termin = { kennung: `zeitplan-sofort-${seit}`, am: seit };
  } else {
    let plan: DZeitplan;
    if (z.art === "ab_datum") {
      const [datum = "", uhrzeit = ""] = z.start.split("T");
      plan = { art: "einmalig", datum, uhrzeit };
    } else {
      const heute = lokalVon(jetzt, z.zeitzone).datum;
      const datum =
        [plusTage(heute, -7), lokalVon(seit, z.zeitzone).datum, z.ab ?? ""].sort().at(-1) ?? heute;
      if (datum > heute) return null;
      plan = {
        art: "serie",
        datum,
        uhrzeit: z.uhrzeit,
        wiederholung: {
          takt: "woechentlich",
          intervall: 1,
          wochentage: [z.wochentag],
          bis: heute,
          anzahl: null,
        },
      };
    }
    const faellig = vorkommenVon({
      id: "persoenliche-funktion",
      zeitplan: plan,
      zeitzone: z.zeitzone,
      sommerzeit: SOMMERZEIT_VORGABE,
      ausnahmen: {},
    })
      .filter(
        (v): v is typeof v & { ms: number } =>
          v.ms !== null && v.ms <= jetzt && (z.art === "ab_datum" || v.ms >= seit),
      )
      .at(-1);
    if (faellig) {
      const auslassen =
        z.art === "woechentlich" && z.nachholen === "auslassen" && jetzt - faellig.ms > toleranzMs;
      if (!auslassen)
        termin = {
          kennung:
            z.art === "ab_datum"
              ? `zeitplan-ab-${z.start.replace(":", "-")}`
              : `zeitplan-w-${faellig.lokal.datum}`,
          am: faellig.ms,
        };
    }
  }
  return termin && !erledigt(termin.kennung) ? termin : null;
}
