import { isDeepStrictEqual } from "node:util";
import { istZeitzone, lokalVon } from "./klara-erinnerung-zeit";
import type {
  FristArt,
  FristBeleg,
  FristDatum,
  FristQuellart,
  FristenQuelle,
} from "./klara-fristen-erkennung";
import {
  FRIST_ARTEN,
  fristHash,
  fristIdentitaet,
  fristBelegIdentitaet,
} from "./klara-fristen-erkennung";
import type { Normgeschichte } from "./klara-normereignisse";

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
    | "zeitgrenze"
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
  /** Enger Normereignisvertrag derselben beauftragten Quellpflege; keine zweite Normenablage. */
  normereignisse?: readonly Normgeschichte[];
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

/** Ablehnung desselben belegten Fakts, unabhängig davon, welche Quellenkopie ihn erneut nennt. */
function ablehnungsSignatur(id: string, b: FristBeleg): string {
  return fristHash(
    id,
    b.datum ? datumSchluessel(b.datum) : b.abschnitt.wortlaut.replace(/\s+/gu, " ").trim(),
  );
}

function zeitstand(datum: FristDatum, jetzt: string, zone = "UTC"): "historisch" | "erkannt" {
  // Vergangen ist keine Erledigung. Ein Ganztagesdatum bleibt ohne erfundene UTC-Uhrzeit.
  const vergangen =
    datum.art === "datum"
      ? datum.datum < lokalVon(Date.parse(jetzt), zone).datum
      : datum.utc < jetzt;
  return vergangen ? "historisch" : "erkannt";
}

/** Aktuelle Lesesicht ohne Schreibwirkung oder erfundene neue Fassung. */
export function fristZeitstand(f: ErkannteFrist, am: string, zone = "UTC"): ErkannteFrist {
  if (!f.datum || (f.stand !== "erkannt" && f.stand !== "historisch")) return f;
  const stand = zeitstand(f.datum, am, zone);
  return stand === f.stand ? f : { ...f, stand };
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

/** Bereits gespeicherte Original-ID nur aus heutiger belegter Quellzuordnung fortführen. */
function importVorgang(
  stand: FristenStand,
  b: FristBeleg,
  quellen: readonly FristenQuelle[],
): string {
  const neu = fristIdentitaet(stand.kontoId, b);
  if (!b.quelle.importbeleg && !b.quelle.importIdentitaetUnklar) return neu;
  const kopien = new Set(
    quellen
      .filter(
        (q) =>
          (q.importbeleg || q.importIdentitaetUnklar) &&
          fristBelegIdentitaet(q) === b.quelle.belegId,
      )
      .map((q) => `${q.art}:${q.id}`),
  );
  const alte = stand.fristen.filter(
    (f) =>
      f.objekt.art.toLocaleLowerCase("de") === b.objekt.art.toLocaleLowerCase("de") &&
      f.objekt.kennung === b.objekt.kennung &&
      f.art === b.art &&
      f.herkunft.some(
        (h) =>
          h.beleg.quelle.belegId === b.quelle.belegId ||
          kopien.has(`${h.beleg.quelle.art}:${h.beleg.quelle.id}`),
      ),
  );
  if (alte.length === 0) return neu;
  const alt = alte[0];
  if (
    alte.length !== 1 ||
    !alt ||
    alt.herkunft.some((h) =>
      h.beleg.quelle.importbeleg || h.beleg.quelle.importIdentitaetUnklar
        ? h.beleg.quelle.belegId !== b.quelle.belegId
        : !kopien.has(`${h.beleg.quelle.art}:${h.beleg.quelle.id}`),
    )
  )
    throw new FristenFehler(
      409,
      "Die bisherige gemischte Fristherkunft ist nicht eindeutig derselben Importquelle zugeordnet. Originale zuerst klären.",
    );
  return alt.id;
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
  bekannteQuellen: readonly FristenQuelle[] = [],
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
    const id = importVorgang(stand, b, bekannteQuellen);
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
    const importVersionen = [...basis.herkunft.map((h) => h.beleg), ...neueBelege].flatMap((b) =>
      b.quelle.importbeleg ? [b.quelle.importbeleg.sourceVersion] : [],
    );
    const neuesteImportversion = importVersionen.length ? Math.max(...importVersionen) : null;
    const nochAktuelleVersion = (b: FristBeleg) =>
      !b.quelle.importbeleg ||
      neuesteImportversion === null ||
      b.quelle.importbeleg.sourceVersion >= neuesteImportversion;
    const herkunft: FristHerkunft[] = basis.herkunft.map((h) =>
      (h.beleg.quelle.art === quelle.art && h.beleg.quelle.id === quelle.id) ||
      !nochAktuelleVersion(h.beleg)
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
      if (i >= 0) herkunft[i] = { beleg: b, aktuell: nochAktuelleVersion(b) };
      else herkunft.push({ beleg: b, aktuell: nochAktuelleVersion(b) });
    }
    if (alt && isDeepStrictEqual(herkunft, alt.herkunft)) {
      const zeitlich = fristZeitstand(alt, am, regel.zeitzone);
      if (zeitlich !== alt) fristen.set(id, mitVerlauf(alt, zeitlich, am, "zeitgrenze"));
      continue;
    }
    const aktuell = herkunft.filter((h) => h.aktuell).map((h) => h.beleg);
    const daten = new Map<string, FristDatum>();
    for (const b of aktuell) if (b.datum) daten.set(datumSchluessel(b.datum), b.datum);
    const datum = daten.size === 1 ? ([...daten.values()][0] ?? null) : null;
    const abgelehnt =
      aktuell.length > 0 &&
      aktuell.every((b) => basis.ablehnungen.includes(ablehnungsSignatur(id, b)));
    const neueAktuelleBelege = neueBelege.filter(nochAktuelleVersion);
    const geaendert = Boolean(
      neueAktuelleBelege.length &&
        alt?.herkunft.some(
          (h) =>
            h.beleg.quelle.belegId === erster?.quelle.belegId &&
            !neueAktuelleBelege.some((b) => b.fingerabdruck === h.beleg.fingerabdruck),
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
      (neuesteImportversion !== null &&
        basis.manuell &&
        basis.klaerung.includes("relevante_quellaenderung")) ||
      (!abgelehnt && basis.ablehnungen.length > 0)
    )
      klaerung.push("relevante_quellaenderung");
    let zustand: FristStand;
    if (basis.stand === "erledigt") zustand = "erledigt";
    else if (abgelehnt && (!basis.manuell || basis.stand === "verworfen")) zustand = "verworfen";
    else if (aktuell.length === 0 || klaerung.includes("widerruf")) zustand = "nicht_verlaesslich";
    else if (klaerung.length > 0 || !datum) zustand = "klaerung";
    else
      zustand = zeitstand(basis.manuell && basis.datum ? basis.datum : datum, am, regel.zeitzone);
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
  const { kalenderDatum: _bisherigesKalenderdatum, ...ohneKalenderdatum } = f;
  return mitVerlauf(
    f,
    {
      ...ohneKalenderdatum,
      stand: "verworfen",
      ablehnungen: [
        ...new Set([
          ...f.ablehnungen,
          ...f.herkunft.filter((h) => h.aktuell).map((h) => ablehnungsSignatur(f.id, h.beleg)),
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
  const bewusstGeprueft = new Set(
    f.herkunft.filter((h) => h.aktuell).map((h) => ablehnungsSignatur(f.id, h.beleg)),
  );
  return mitVerlauf(
    f,
    {
      ...f,
      datum,
      kalenderDatum: datum,
      manuell: true,
      ablehnungen: f.ablehnungen.filter((m) => !bewusstGeprueft.has(m)),
      stand: erledigt ? "erledigt" : zeitstand(datum, am, zone),
      klaerung: [],
    },
    am,
    "manuell",
  );
}
