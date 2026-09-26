// ==================================================================================================
// DIE NACHWEISE DER KUNDENINSTALLATIONS-STRECKE — JEDER EINZELN BENANNT, JEDER EINZELN ROT-FAEHIG.
// ==================================================================================================
//
// Die Strecke (`kundeninstallation-strecke.integration.test.ts`) misst am laufenden Pruefplatz und
// legt ihre Messungen hier zur Bewertung vor. Die Bewertung ist absichtlich eine reine Funktion:
// Die Gegenproben (K7) verstellen den eigenen Testaufbau echt und zeigen, dass GENAU der zugehoerige
// Nachweis rot wird und die uebrigen gruen bleiben. Das geht nur, wenn jeder Nachweis ein eigenes
// Feld ist und nicht in einem Sammel-`expect` verschwindet.

/** Lebenszyklus eines Containers, gelesen ueber `docker inspect`. */
export interface Containerstand {
  id: string;
  status: string;
  startedAt: string;
  pid: number;
}

/** Was vor und nach einem Neustart gemessen wird. */
export interface Dienstmessung {
  app: Containerstand;
  db: Containerstand;
  /** `pg_postmaster_start_time()` der eigenen PostgreSQL — der Startzeitpunkt des Serverprozesses. */
  pgStart: string;
  /** Das Datenvolume der Instanz: Name und Anlagezeitpunkt. Ein ersetztes Volume hat einen neuen. */
  volume: { name: string; createdAt: string };
}

export interface Neustartbewertung {
  /** Der Anwendungscontainer lief neu an: neue Startzeit, neuer Prozess. */
  appNeustart: boolean;
  /** Der Datenbankcontainer lief neu an UND der PostgreSQL-Serverprozess hat eine neue Startzeit. */
  dbNeustart: boolean;
  /** Dieselben Container (kein Neuaufbau, der Zustand ersetzt haette). */
  containerErhalten: boolean;
  /** Dasselbe Datenvolume, nicht ersetzt. */
  volumeErhalten: boolean;
}

export function bewerteNeustart(vorher: Dienstmessung, nachher: Dienstmessung): Neustartbewertung {
  const neuGestartet = (a: Containerstand, b: Containerstand): boolean =>
    b.status === "running" && a.startedAt !== b.startedAt && a.pid !== b.pid && b.pid > 0;
  return {
    appNeustart: neuGestartet(vorher.app, nachher.app),
    dbNeustart: neuGestartet(vorher.db, nachher.db) && vorher.pgStart !== nachher.pgStart,
    containerErhalten: vorher.app.id === nachher.app.id && vorher.db.id === nachher.db.id,
    volumeErhalten:
      vorher.volume.name === nachher.volume.name &&
      vorher.volume.createdAt === nachher.volume.createdAt,
  };
}

/** Was ein Nutzer ueber die Oberflaeche von seinem Dokument sieht und herunterlaedt. */
export interface Inhaltsstand {
  kennung: string;
  fassung: string;
  titel: string;
  text: string;
  quellen: string[];
  /** SHA-256 der ueber den Benutzerweg heruntergeladenen Datei; `null`, wenn der Abruf scheiterte. */
  dateiSha256: string | null;
}

export interface Inhaltsbewertung {
  kennung: boolean;
  fassung: boolean;
  text: boolean;
  quelle: boolean;
  datei: boolean;
}

export function bewerteInhalt(soll: Inhaltsstand, ist: Inhaltsstand): Inhaltsbewertung {
  return {
    kennung: soll.kennung === ist.kennung,
    fassung: soll.fassung === ist.fassung,
    text: soll.titel === ist.titel && soll.text === ist.text,
    quelle:
      soll.quellen.length === ist.quellen.length &&
      soll.quellen.every((q, i) => ist.quellen[i] === q),
    datei: soll.dateiSha256 !== null && soll.dateiSha256 === ist.dateiSha256,
  };
}

/** Die Namen der Nachweise, die in einer Bewertung NICHT erfuellt sind — sortiert, fuer Vergleiche. */
export function roteNachweise(bewertung: Neustartbewertung | Inhaltsbewertung): string[] {
  return Object.entries(bewertung)
    .filter(([, erfuellt]) => !erfuellt)
    .map(([name]) => name)
    .sort();
}

// --------------------------------------------------------------------------------------------------
// Kennwort-Mail: worauf zeigt der Link?
// --------------------------------------------------------------------------------------------------

/** Quoted-Printable (RFC 2045) zurueck in Text — nodemailer bricht lange Zeilen weich um. */
export function entferneQuotedPrintable(text: string): string {
  const ohneUmbruch = text.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < ohneUmbruch.length; i++) {
    const zeichen = ohneUmbruch[i] as string;
    const hex = ohneUmbruch.slice(i + 1, i + 3);
    if (zeichen === "=" && /^[0-9A-Fa-f]{2}$/.test(hex)) {
      bytes.push(Number.parseInt(hex, 16));
      i += 2;
    } else {
      bytes.push(...Buffer.from(zeichen, "utf8"));
    }
  }
  return Buffer.from(bytes).toString("utf8");
}

/**
 * Die Zuruecksetzen-Adressen einer Rohmail — OHNE Token. Der Token ist ein Geheimnis und gehoert in
 * keinen Beleg; bewertet wird nur, wohin der Link fuehrt.
 */
export function resetZiele(rohmail: string): { origin: string; pfad: string }[] {
  const text = entferneQuotedPrintable(rohmail);
  const ziele: { origin: string; pfad: string }[] = [];
  for (const treffer of text.matchAll(/https?:\/\/[^\s"'<>]+/g)) {
    try {
      const url = new URL(treffer[0]);
      if (url.searchParams.has("token")) {
        ziele.push({ origin: url.origin, pfad: url.pathname });
      }
    } catch {
      // kein gueltiger Link — gehoert nicht zu den Zielen.
    }
  }
  return ziele;
}

// --------------------------------------------------------------------------------------------------
// Belege ohne Geheimnisse
// --------------------------------------------------------------------------------------------------

/**
 * Schwaerzt jedes der genannten Geheimnisse in einem Text. Belege werden vor der Ausgabe hierdurch
 * geschickt; ein Geheimnis, das es trotzdem hineinschafft, wird so zur Zeichenkette `‹geschwaerzt›`.
 */
export function schwaerze(text: string, geheimnisse: readonly string[]): string {
  let ergebnis = text;
  for (const geheimnis of geheimnisse) {
    if (geheimnis.length >= 6) {
      ergebnis = ergebnis.split(geheimnis).join("‹geschwaerzt›");
    }
  }
  return ergebnis;
}
