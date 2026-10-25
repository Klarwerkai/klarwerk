// ================================================================================================
// KLARA POWERPOINT · PP-02 — GRENZEN DES HOSTABGLEICHS (`POST …/folien-abgleich`)
// ================================================================================================
//
// Unabhängige Prüfung 0001–0006, Befund B1 (18.10.2026): Der Abgleich nimmt eine fremde Datei an —
// die Präsentation, die PowerPoint gerade geöffnet hat — und darf das für JEDE lesende Rolle. Ohne
// Grenzen genügten wenige KB, um den Server festzuhalten oder seinen Speicher zu sprengen. Hier
// stehen die Grenzen, die VOR dem Lesen gelten; der Leser selbst ist linear
// (`praesentation-daten.ts`, „LINEARE ABTASTUNG“) und liest mehrfach genannte Folien nur einmal.
//
// WIEDERVERWENDET, nicht nachgebaut:
//   · die gestreamte Entpackprüfung des DOCX-Eingangs (`zaehleEchteExpansion`, JOB 2671,
//     capture-routes.ts) — Summe UND Verhältnis, Abbruch per `destroy()` während des Entpackens;
//   · der Rate-Begrenzer des PPTX-Eingangs `/api/capture/slides` (`createSlidesRateLimiter`,
//     slides-routes.ts) — je Nutzer und Minute, mit harter Kardinalitätsgrenze.
// Angepasst an „lesend“: kein Konverterprozess, deshalb zwei gleichzeitige Plätze statt einem.
//
// Nachprüfung 0007 (18.10.2026):
//   N3  Ein Platz wird erst belegt, wenn der Körper ganz da ist (im Handler, nicht im onRequest) —
//       ein langsamer Upload hält keinen Platz. Höchstens EIN Platz je Nutzer und zwei insgesamt:
//       insgesamt, weil jeder Abgleich bis zur Entpackgrenze Speicher bindet; je Nutzer, damit eine
//       lesende Rolle die Plätze nicht allein besetzt. Gehalten wird nur während des Lesens.
//   N4  Die Einträge werden im Zentralverzeichnis SELBST gezählt — Satz für Satz, bevor jszip für
//       jeden ein Objekt anlegt; ein Endsatz, der etwas anderes behauptet, macht die Datei unlesbar.

import JSZip from "jszip";
import { zaehleEchteExpansion } from "./routes/capture-routes";
import { type SlidesRateLimiter, createSlidesRateLimiter } from "./routes/slides-routes";

export interface FolienAbgleichGrenzen {
  /** Entpackt höchstens so viele Bytes (Summe aller Einträge, gemessen, nicht geglaubt). */
  readonly entpacktMax: number;
  /** Entpackt höchstens das n-fache der gepackten Größe. */
  readonly verhaeltnisMax: number;
  /** Höchstzahl der Einträge im Archiv (Zentralverzeichnis), geprüft vor dem Öffnen. */
  readonly eintraegeMax: number;
  /** Abgleiche je Nutzer und Minute. */
  readonly proMinute: number;
  /** Gleichzeitige Abgleiche im ganzen Prozess. */
  readonly gleichzeitig: number;
  /** Gleichzeitige Abgleiche je Nutzer. */
  readonly gleichzeitigJeNutzer: number;
}

/**
 * Vorgaben. Eine echte Präsentation bleibt weit darunter: Bilder sind schon gepackt, XML packt
 * höchstens etwa 20:1; 30 MiB gepackt ergeben selten mehr als 100 MiB.
 */
export const FOLIEN_ABGLEICH_GRENZEN: FolienAbgleichGrenzen = {
  entpacktMax: 160 * 1024 * 1024,
  verhaeltnisMax: 100,
  eintraegeMax: 20_000,
  proMinute: 20,
  gleichzeitig: 2,
  gleichzeitigJeNutzer: 1,
};

/**
 * Ein belegter Platz gilt höchstens so lange (Schutz gegen einen verwaisten Platz). Belegt wird erst
 * nach dem Empfang; gelesen wird innerhalb der Grenzen in Sekunden (Nachprüfung: ≈ 3 s an der
 * Entpackgrenze) — 30 s lassen zehnfachen Spielraum. Freigegeben wird im `finally` des Handlers.
 */
export const FOLIEN_ABGLEICH_PLATZ_MS = 30_000;

export interface KoerperBefund {
  readonly status: 400 | 413;
  readonly error: "KEINE_PRAESENTATION" | "PAYLOAD_TOO_LARGE";
  readonly message: string;
}

function alsMib(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MiB`;
}

export type VerzeichnisBefund =
  | { readonly art: "ohne" }
  | { readonly art: "zip64" }
  | { readonly art: "zu_viele"; readonly gezaehlt: number }
  | { readonly art: "widerspruch"; readonly laut: number; readonly gezaehlt: number }
  | { readonly art: "ok"; readonly eintraege: number };

/**
 * Nachprüfung N4: zählt die Sätze des Zentralverzeichnisses SELBST — vom Verzeichnisanfang bis zum
 * Endsatz, je Satz Signatur und Länge (46 + Name + Extra + Kommentar), abgebrochen bei `max + 1`.
 * Kein Objekt je Eintrag, linear in der Verzeichnisgröße. Der Endsatz wird wie bei jszip von hinten
 * gesucht; das Verzeichnis endet unmittelbar davor (vorangestellte Bytes verschieben nur den Versatz).
 * „widerspruch“: Signatur fehlt, Länge geht nicht auf oder die Zahl weicht vom Endsatz ab.
 * „zip64“: Platzhalter im Endsatz — eine Präsentation unter 41 MiB braucht das nicht.
 */
export function zentralverzeichnisZaehlen(bytes: Buffer, max: number): VerzeichnisBefund {
  let ende = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i -= 1) {
    if (bytes.readUInt32LE(i) === 0x06054b50) {
      ende = i;
      break;
    }
  }
  if (ende < 0) {
    return { art: "ohne" };
  }
  const laut = bytes.readUInt16LE(ende + 10);
  const groesse = bytes.readUInt32LE(ende + 12);
  if (laut === 0xffff || groesse === 0xffffffff || bytes.readUInt32LE(ende + 16) === 0xffffffff) {
    return { art: "zip64" };
  }
  let p = ende - groesse;
  let gezaehlt = 0;
  while (p >= 0 && p < ende) {
    if (p + 46 > ende || bytes.readUInt32LE(p) !== 0x02014b50) {
      return { art: "widerspruch", laut, gezaehlt };
    }
    gezaehlt += 1;
    if (gezaehlt > max) {
      return { art: "zu_viele", gezaehlt };
    }
    p += 46 + bytes.readUInt16LE(p + 28) + bytes.readUInt16LE(p + 30) + bytes.readUInt16LE(p + 32);
  }
  if (p !== ende || gezaehlt !== laut) {
    return { art: "widerspruch", laut, gezaehlt };
  }
  return { art: "ok", eintraege: gezaehlt };
}

/**
 * Prüft den Körper des Abgleichs, bevor ein Parser ihn sieht: Einträge, echte Entpackgröße (Summe
 * und Verhältnis). `undefined` heißt: darf gelesen werden.
 */
export async function pruefeAbgleichKoerper(
  bytes: Buffer,
  g: FolienAbgleichGrenzen,
): Promise<KoerperBefund | undefined> {
  const unlesbar: KoerperBefund = {
    status: 400,
    error: "KEINE_PRAESENTATION",
    message: "Die geöffnete Datei ist keine lesbare PowerPoint-Datei (.pptx).",
  };
  const zuViele = (anzahl: number): KoerperBefund => ({
    status: 413,
    error: "PAYLOAD_TOO_LARGE",
    message: `Die geöffnete Präsentation hat zu viele Teile für den Abgleich (${anzahl}, erlaubt sind ${g.eintraegeMax}).`,
  });
  const verzeichnis = zentralverzeichnisZaehlen(bytes, g.eintraegeMax);
  if (verzeichnis.art === "zu_viele") {
    return zuViele(verzeichnis.gezaehlt);
  }
  if (verzeichnis.art === "widerspruch" || verzeichnis.art === "zip64") {
    return {
      ...unlesbar,
      message:
        verzeichnis.art === "zip64"
          ? "Die geöffnete Datei ist ein Zip64-Archiv — das liest der Abgleich nicht (eine .pptx unter 41 MiB braucht es nicht)."
          : "Das Archivverzeichnis der geöffneten Datei ist widersprüchlich; sie wird nicht gelesen.",
    };
  }
  let archiv: JSZip;
  try {
    archiv = await JSZip.loadAsync(bytes);
  } catch {
    return unlesbar;
  }
  const anzahl = Object.keys(archiv.files).length;
  if (anzahl > g.eintraegeMax) {
    return zuViele(anzahl);
  }
  // Beide vorhandenen Grenzen gelten schon während des Entpackens, nicht erst an dessen Ende.
  const verhaeltnisGrenze = bytes.length * g.verhaeltnisMax;
  const entpackGrenze = Math.min(g.entpacktMax, verhaeltnisGrenze);
  const expansion = await zaehleEchteExpansion(archiv, entpackGrenze);
  if (expansion.art === "ueber_grenze") {
    return {
      status: 413,
      error: "PAYLOAD_TOO_LARGE",
      message:
        verhaeltnisGrenze < g.entpacktMax
          ? `Die geöffnete Präsentation ist entpackt zu groß für den Abgleich — mehr als das ${g.verhaeltnisMax}-fache der gepackten Größe.`
          : `Die geöffnete Präsentation ist entpackt zu groß für den Abgleich (mehr als ${alsMib(g.entpacktMax)}).`,
    };
  }
  if (expansion.art === "strom_kaputt") {
    return unlesbar;
  }
  if (bytes.length > 0 && expansion.summe / bytes.length > g.verhaeltnisMax) {
    return {
      status: 413,
      error: "PAYLOAD_TOO_LARGE",
      message: `Die geöffnete Präsentation ist entpackt zu groß für den Abgleich: ${alsMib(expansion.summe)} aus ${alsMib(bytes.length)} gepackt — mehr als das ${g.verhaeltnisMax}-fache.`,
    };
  }
  return undefined;
}

/** Takt und Plätze des Abgleichs EINER Routen-Instanz. */
export interface AbgleichEinlass {
  /** `true` = über dem Takt dieses Nutzers (der Aufruf zählt mit, auch wenn er abgewiesen wird). */
  ueberTakt(nutzerId: string, jetztMs: number): boolean;
  /**
   * Belegt einen Platz für `halter` (Nutzer `nutzerId`); `false`, wenn insgesamt oder für diesen
   * Nutzer alle belegt sind. Synchron, also atomar.
   */
  belege(halter: object, nutzerId: string, jetztMs: number): boolean;
  /** Gibt den Platz von `halter` frei (ohne Platz: nichts). */
  gibFrei(halter: object): void;
  belegt(): number;
}

export function abgleichEinlass(g: FolienAbgleichGrenzen): AbgleichEinlass {
  const takt: SlidesRateLimiter = createSlidesRateLimiter(g.proMinute, 60_000);
  const plaetze = new Map<object, { readonly nutzerId: string; readonly seit: number }>();
  return {
    ueberTakt: (nutzerId, jetztMs) => takt.hit(nutzerId, jetztMs),
    belege(halter, nutzerId, jetztMs) {
      let eigene = 0;
      for (const [h, platz] of plaetze) {
        if (jetztMs - platz.seit > FOLIEN_ABGLEICH_PLATZ_MS) {
          plaetze.delete(h);
        } else if (platz.nutzerId === nutzerId) {
          eigene += 1;
        }
      }
      if (plaetze.size >= g.gleichzeitig || eigene >= g.gleichzeitigJeNutzer) {
        return false;
      }
      plaetze.set(halter, { nutzerId, seit: jetztMs });
      return true;
    },
    gibFrei(halter) {
      plaetze.delete(halter);
    },
    belegt: () => plaetze.size,
  };
}
