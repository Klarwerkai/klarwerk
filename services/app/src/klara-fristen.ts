import { istZeitzone, lokalVon } from "./klara-erinnerung-zeit";
import type { FristArt, FristBeleg, FristDatum, FristQuellart } from "./klara-fristen-erkennung";
import { FRIST_ARTEN, fristHash, fristIdentitaet } from "./klara-fristen-erkennung";

export interface FristenRegel {
  aktiv: boolean;
  /** Bewusst ausgewählte Quellen, keine implizite Überwachung des ganzen Wissensbestands. */
  quellen: readonly { art: FristQuellart; id: string }[];
  arten: readonly FristArt[];
  bereich: "persoenlich";
  /** Tagesgrenze für „vergangen“; ein ganztägiges Quelldatum wird dadurch nicht umgerechnet. */
  zeitzone: string;
  /** Alte Ablehnung/manuelle Arbeit wird auch bei neuer Fassung niemals automatisch überschrieben. */
  aenderung: "aktualisieren" | "klaeren";
  widerruf: "unzuverlaessig_ohne_vorlauf";
  wiederpruefung: "relevante_aenderung_klaeren";
  /** Der erste Fach-Sollbestand ist vor Aktivierung zu bestehen, kein Modell-Konfidenzwert. */
  pruefstand: string;
}

export type FristStand =
  | "erkannt"
  | "klaerung"
  | "verworfen"
  | "nicht_verlaesslich"
  | "historisch"
  | "erledigt";

export interface FristHerkunft {
  beleg: FristBeleg;
  aktuell: boolean;
}

export interface FristVerlauf {
  am: string;
  grund:
    | "erkannt"
    | "beleg_ergaenzt"
    | "quelle_geaendert"
    | "quelle_zurueckgezogen"
    | "verworfen"
    | "manuell";
  stand: FristStand;
  datum: FristDatum | null;
  /** Nur Kennungen/Prüfsummen; der volle Wortlaut bleibt am zugehörigen Herkunftsbeleg. */
  belege: readonly string[];
}

export interface ErkannteFrist {
  id: string;
  kontoId: string;
  objekt: FristBeleg["objekt"];
  art: FristArt;
  stand: FristStand;
  datum: FristDatum | null;
  /** Nur ein tatsächlich übernommener eindeutiger Stand darf im Kalender stehen. */
  kalenderDatum?: FristDatum;
  ausgeblendet?: boolean;
  /** Die Zuständigkeit stammt aus dem Beleg, nicht aus dem Besitz des persönlichen Kalenders. */
  verantwortlich: string | null;
  herkunft: readonly FristHerkunft[];
  ablehnungen: readonly string[];
  manuell: boolean;
  klaerung: readonly string[];
  verlauf: readonly FristVerlauf[];
  fassung: number;
  angelegtAm: string;
  geaendertAm: string;
}

export interface FristenStand {
  kontoId: string;
  fassung: number;
  regel: FristenRegel | null;
  fristen: readonly ErkannteFrist[];
}

export class FristenFehler extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
    this.name = "FristenFehler";
  }
}

export const FRISTEN_PRUEFSTAND = "aw19-sollbestand-1";
export const FRISTEN_GRENZEN = { quellen: 100, fristen: 2000, quelltext: 100_000 } as const;

export function fristenRegelAus(roh: unknown): FristenRegel {
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) {
    throw new FristenFehler(400, "Eine Fristenregel ist erforderlich.");
  }
  const r = roh as Record<string, unknown>;
  const erlaubt = new Set([
    "aktiv",
    "quellen",
    "arten",
    "bereich",
    "zeitzone",
    "aenderung",
    "widerruf",
    "wiederpruefung",
    "pruefstand",
  ]);
  if (Object.keys(r).some((k) => !erlaubt.has(k))) {
    throw new FristenFehler(
      400,
      "Die Fristenregel erlaubt nur die angebotenen internen Wirkungen.",
    );
  }
  if (
    typeof r.aktiv !== "boolean" ||
    r.bereich !== "persoenlich" ||
    !istZeitzone(r.zeitzone) ||
    !["aktualisieren", "klaeren"].includes(String(r.aenderung)) ||
    r.widerruf !== "unzuverlaessig_ohne_vorlauf" ||
    r.wiederpruefung !== "relevante_aenderung_klaeren" ||
    r.pruefstand !== FRISTEN_PRUEFSTAND
  ) {
    throw new FristenFehler(
      400,
      "Bereich, Änderungs-, Widerrufs- und Wiederprüfregel sowie Prüfstand ausdrücklich wählen.",
    );
  }
  if (
    !Array.isArray(r.quellen) ||
    r.quellen.length === 0 ||
    r.quellen.length > FRISTEN_GRENZEN.quellen
  ) {
    throw new FristenFehler(400, "Eine bis 100 konkrete Quellen auswählen.");
  }
  const quellen = new Map<string, { art: FristQuellart; id: string }>();
  for (const q of r.quellen) {
    if (
      !q ||
      typeof q !== "object" ||
      !["wissensobjekt", "notiz", "gespraech", "anhang"].includes(q.art) ||
      typeof q.id !== "string" ||
      q.id.length === 0 ||
      q.id.length > 200
    ) {
      throw new FristenFehler(400, "Jede Quelle braucht eine Quellenart und die Originalkennung.");
    }
    quellen.set(fristHash(q.art, q.id), { art: q.art as FristQuellart, id: q.id });
  }
  if (
    !Array.isArray(r.arten) ||
    r.arten.length === 0 ||
    r.arten.some((a) => !(FRIST_ARTEN as readonly unknown[]).includes(a))
  ) {
    throw new FristenFehler(400, "Mindestens eine der angebotenen Fristarten auswählen.");
  }
  return {
    aktiv: r.aktiv,
    bereich: "persoenlich",
    zeitzone: r.zeitzone as string,
    quellen: [...quellen.values()],
    arten: [...new Set(r.arten as FristArt[])],
    aenderung: r.aenderung as FristenRegel["aenderung"],
    widerruf: "unzuverlaessig_ohne_vorlauf",
    wiederpruefung: "relevante_aenderung_klaeren",
    pruefstand: FRISTEN_PRUEFSTAND,
  };
}

function datumSchluessel(d: FristDatum | null): string {
  return d === null ? "offen" : d.art === "datum" ? `datum:${d.datum}` : `zeitpunkt:${d.utc}`;
}

function zeitstand(datum: FristDatum, jetzt: string, zone = "UTC"): "historisch" | "erkannt" {
  // Vergangen ist keine Erledigung. Ein Ganztagesdatum bleibt ohne erfundene UTC-Uhrzeit.
  const vergangen =
    datum.art === "datum"
      ? datum.datum < lokalVon(Date.parse(jetzt), zone).datum
      : datum.utc < jetzt;
  return vergangen ? "historisch" : "erkannt";
}

function mitVerlauf(
  alt: ErkannteFrist,
  neu: ErkannteFrist,
  am: string,
  grund: FristVerlauf["grund"],
): ErkannteFrist {
  return {
    ...neu,
    fassung: alt.fassung + 1,
    geaendertAm: am,
    verlauf: [
      ...alt.verlauf,
      {
        am,
        grund,
        stand: neu.stand,
        datum: neu.datum,
        belege: neu.herkunft.filter((h) => h.aktuell).map((h) => h.beleg.fingerabdruck),
      },
    ],
  };
}

/**
 * Faltet eine vollständig gelesene aktuelle Quelle in den Bestand. Wiederholung ist wirkungslos;
 * verschwundene Belege werden zurückgezogen. Die Quelle muss vor dem Aufruf autoritativ lesbar sein.
 * Fehler/unlesbare Quelle dürfen NICHT als leerer erfolgreicher Quellenabruf übergeben werden.
 */
export function verarbeiteFristenQuelle(
  stand: FristenStand,
  quelle: { art: FristQuellart; id: string; fassung: string },
  belege: readonly FristBeleg[],
  am: string,
): FristenStand {
  const regel = stand.regel;
  if (!regel?.aktiv || !regel.quellen.some((q) => q.art === quelle.art && q.id === quelle.id)) {
    throw new FristenFehler(
      409,
      "Diese Quelle ist nicht für die aktive Fristenerfassung ausgewählt.",
    );
  }
  if (
    belege.some(
      (b) =>
        b.quelle.art !== quelle.art ||
        b.quelle.id !== quelle.id ||
        b.quelle.fassung !== quelle.fassung,
    )
  ) {
    throw new FristenFehler(400, "Die Belege gehören nicht zum gelesenen Quellenstand.");
  }
  const gruppen = new Map<string, FristBeleg[]>();
  for (const b of belege) {
    if (!regel.arten.includes(b.art)) continue;
    const id = fristIdentitaet(stand.kontoId, b);
    const gruppe = gruppen.get(id) ?? [];
    if (!gruppe.some((x) => x.fingerabdruck === b.fingerabdruck)) gruppe.push(b);
    gruppen.set(id, gruppe);
  }
  const fristen = new Map(stand.fristen.map((f) => [f.id, f]));
  const betroffen = new Set([
    ...gruppen.keys(),
    ...stand.fristen
      .filter((f) =>
        f.herkunft.some(
          (h) => h.aktuell && h.beleg.quelle.art === quelle.art && h.beleg.quelle.id === quelle.id,
        ),
      )
      .map((f) => f.id),
  ]);
  for (const id of betroffen) {
    const alt = fristen.get(id);
    const neueBelege = gruppen.get(id) ?? [];
    const erster = neueBelege[0];
    if (!alt && !erster) continue;
    let basis = alt;
    if (!basis) {
      if (!erster) continue;
      basis = {
        id,
        kontoId: stand.kontoId,
        objekt: erster.objekt,
        art: erster.art,
        stand: "klaerung",
        datum: null,
        verantwortlich: erster.verantwortlich,
        herkunft: [],
        ablehnungen: [],
        manuell: false,
        klaerung: [],
        verlauf: [],
        fassung: 0,
        angelegtAm: am,
        geaendertAm: am,
      };
    }
    const herkunft: FristHerkunft[] = basis.herkunft.map((h) =>
      h.beleg.quelle.art === quelle.art && h.beleg.quelle.id === quelle.id
        ? { ...h, aktuell: false }
        : h,
    );
    for (const b of neueBelege) {
      const i = herkunft.findIndex(
        (h) =>
          h.beleg.quelle.art === b.quelle.art &&
          h.beleg.quelle.id === b.quelle.id &&
          h.beleg.quelle.fassung === b.quelle.fassung &&
          h.beleg.fingerabdruck === b.fingerabdruck,
      );
      if (i >= 0) herkunft[i] = { beleg: b, aktuell: true };
      else herkunft.push({ beleg: b, aktuell: true });
    }
    if (alt && isDeepStrictEqual(herkunft, alt.herkunft)) continue;
    const aktuell = herkunft.filter((h) => h.aktuell).map((h) => h.beleg);
    const daten = new Map<string, FristDatum>();
    for (const b of aktuell) if (b.datum) daten.set(datumSchluessel(b.datum), b.datum);
    const datum = daten.size === 1 ? ([...daten.values()][0] ?? null) : null;
    const abgelehnt =
      aktuell.length > 0 && aktuell.every((b) => basis.ablehnungen.includes(b.fingerabdruck));
    const geaendert = Boolean(
      alt?.herkunft.some(
        (h) =>
          h.beleg.quelle.belegId === erster?.quelle.belegId &&
          !neueBelege.some((b) => b.fingerabdruck === h.beleg.fingerabdruck),
      ),
    );
    const klaerung = [...new Set(aktuell.flatMap((b) => b.klaerung))] as string[];
    const verantwortliche = new Set(
      aktuell.flatMap((b) => (b.verantwortlich ? [b.verantwortlich] : [])),
    );
    if (verantwortliche.size > 1) klaerung.push("zustaendigkeit_unklar");
    if (daten.size > 1) klaerung.push("widerspruch");
    if (
      (geaendert && (basis.manuell || regel.aenderung === "klaeren")) ||
      (!abgelehnt && basis.ablehnungen.length > 0)
    )
      klaerung.push("relevante_quellaenderung");
    let zustand: FristStand;
    if (basis.stand === "erledigt") zustand = "erledigt";
    else if (abgelehnt) zustand = "verworfen";
    else if (aktuell.length === 0 || klaerung.includes("widerruf")) zustand = "nicht_verlaesslich";
    else if (klaerung.length > 0 || !datum) zustand = "klaerung";
    else zustand = zeitstand(datum, am, regel.zeitzone);
    const neu = mitVerlauf(
      basis,
      {
        ...basis,
        herkunft,
        stand: zustand,
        verantwortlich: verantwortliche.size === 1 ? ([...verantwortliche][0] ?? null) : null,
        klaerung,
        // Manuelle Korrektur und abgeschlossene Arbeit niemals durch einen Quellenabruf ersetzen.
        datum:
          basis.manuell ||
          basis.stand === "erledigt" ||
          (geaendert && regel.aenderung === "klaeren")
            ? basis.datum
            : datum,
      },
      am,
      !alt
        ? "erkannt"
        : aktuell.length === 0
          ? "quelle_zurueckgezogen"
          : geaendert
            ? "quelle_geaendert"
            : "beleg_ergaenzt",
    );
    fristen.set(id, neu);
  }
  if (fristen.size > FRISTEN_GRENZEN.fristen)
    throw new FristenFehler(409, "Höchstens 2000 persönliche Fristvorgänge.");
  const neu = [...fristen.values()];
  return isDeepStrictEqual(neu, stand.fristen)
    ? stand
    : { ...stand, fassung: stand.fassung + 1, fristen: neu };
}

export function fristVerwerfen(f: ErkannteFrist, am: string): ErkannteFrist {
  if (f.stand === "verworfen") return f;
  return mitVerlauf(
    f,
    {
      ...f,
      stand: "verworfen",
      ablehnungen: [
        ...new Set([
          ...f.ablehnungen,
          ...f.herkunft.filter((h) => h.aktuell).map((h) => h.beleg.fingerabdruck),
        ]),
      ],
    },
    am,
    "verworfen",
  );
}

export function fristManuell(
  f: ErkannteFrist,
  datum: FristDatum,
  erledigt: boolean,
  am: string,
  zone = "UTC",
): ErkannteFrist {
  return mitVerlauf(
    f,
    {
      ...f,
      datum,
      kalenderDatum: datum,
      manuell: true,
      stand: erledigt ? "erledigt" : zeitstand(datum, am, zone),
      klaerung: [],
    },
    am,
    "manuell",
  );
}
import { isDeepStrictEqual } from "node:util";
