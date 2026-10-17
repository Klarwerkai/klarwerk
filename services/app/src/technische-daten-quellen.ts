// ================================================================================================
// BPA-02 · QUELLENLAGE UND QUELLSPERRE DER TECHNISCHEN DATEN — EINE REGEL FÜR ALLE WEGE.
// ================================================================================================
//
// Eine Belegstelle aus der Übernahme technischer Daten trägt Adresse und Abschnitt ihrer Quelle
// (`url` + „Abschnitt: … · " im Auszug, `routes/technische-daten-routes.ts`). Daran hängen zwei
// dauerhafte Tatsachen, beide im Prüfprotokoll (persistiert, gesichert, ohne Adresse im Klartext):
//
//   · die RECHTELAGE der Quelle (`QUELLENRECHTE_AKTION`, Ziel = Quellkennung) — „entzogen" sperrt
//     jeden Weg zu Inhalten aus dieser Quelle: Vorschau, Übernahme, Papierkorb, Wiederherstellen,
//     Einreichen (Entwurfsrouten) und das Lesen der Wissensobjekte (Leserkreis „niemand");
//   · die BEOBACHTETE LAGE an einem Entwurf oder Wissensobjekt (`QUELLENBEOBACHTUNG_AKTION`, Ziel =
//     Kennung des Objekts, Nutzlast mit Quellkennung, Lage und betroffener Wissensfassung).
//
// Dieses Modul ist die EINE Lesestelle beider Tatsachen. Die Routen der Übernahme, der Entwürfe
// und der Wissensobjekte fragen hier — keine zweite Auslegung daneben.
import { createHash } from "node:crypto";
import type { FastifyReply } from "fastify";
import type { AuditEntry, AuditService } from "../../audit";

/** Prüfprotokoll: Rechtelage einer Quelle (Ziel = Quellkennung, Nutzlast ohne Adresse/Inhalt). */
export const QUELLENRECHTE_AKTION = "technische-daten.quellenrechte";
/** Prüfprotokoll: beobachtete Quellenlage an einem Entwurf oder Wissensobjekt. */
export const QUELLENBEOBACHTUNG_AKTION = "technische-daten.quelle-beobachtet";
/** Prüfprotokoll: Leserkreis eines Wissensobjekts VOR einer Quellsperre (für Wiedererteilung). */
export const QUELLRECHTE_VORHER_AKTION = "technische-daten.quellrechte-vorher";

export type QuellLage = "unveraendert" | "quelle_geaendert" | "quelle_nicht_mehr_erreichbar";

/** Eine Belegstelle, wie Entwurf (`pendingSources`) und Wissensobjekt (`sources`) sie tragen. */
export interface Belegstelle {
  url?: string | null | undefined;
  excerpt?: string | null | undefined;
}

/** Kennung einer Quelle: Hash über Adresse (samt Anker) und Abschnitt — keine Klartextangabe. */
export function quellKennungAus(adresse: string, abschnitt: string): string {
  const roh = `${adresse}\n${abschnitt}`;
  return `technische-daten-quelle:${createHash("sha256").update(roh, "utf8").digest("hex")}`;
}

/** Der Abschnitt einer Belegstelle aus der Übernahme technischer Daten — sonst `null`. */
export function abschnittAus(auszug: string | null | undefined): string | null {
  const treffer = /(?:^| · )Abschnitt: (.+?) · erfasst /.exec(auszug ?? "");
  return treffer ? (treffer[1] as string) : null;
}

/** Die Quellkennung einer Belegstelle — `null`, wenn sie nicht aus dieser Übernahme stammt. */
export function quellKennungVon(s: Belegstelle): string | null {
  const abschnitt = abschnittAus(s.excerpt);
  return s.url && abschnitt ? quellKennungAus(s.url, abschnitt) : null;
}

function juengster(eintraege: AuditEntry[]): AuditEntry | undefined {
  return eintraege.reduce<AuditEntry | undefined>(
    (bisher, e) => (!bisher || e.seq > bisher.seq ? e : bisher),
    undefined,
  );
}

type AuditLeser = Pick<AuditService, "list">;

/** Ist das Leserecht dieser Quelle entzogen? Maßgeblich ist der jüngste Rechtevermerk. */
export async function quelleGesperrt(audit: AuditLeser, kennung: string): Promise<boolean> {
  const vermerk = juengster(await audit.list({ action: QUELLENRECHTE_AKTION, target: kennung }));
  return vermerk?.payload.zustand === "entzogen";
}

/** Trägt eine dieser Belegstellen eine gesperrte Quelle? */
export async function belegstellenGesperrt(
  audit: AuditLeser,
  stellen: readonly Belegstelle[],
): Promise<boolean> {
  for (const s of stellen) {
    const kennung = quellKennungVon(s);
    if (kennung && (await quelleGesperrt(audit, kennung))) return true;
  }
  return false;
}

export interface Beobachtung {
  lage: QuellLage;
  am: string;
  aktuelleFassung: string | null;
  /** Die betroffene Wissensfassung, falls am Wissensobjekt beobachtet. */
  fassung?: number;
}

/** Die zuletzt beobachtete Lage einer Quelle an einem Objekt — samt Zeitpunkt und Fassung. */
export async function letzteBeobachtung(
  audit: AuditLeser,
  objektId: string,
  kennung: string,
): Promise<Beobachtung | null> {
  const alle = await audit.list({ action: QUELLENBEOBACHTUNG_AKTION, target: objektId });
  const letzter = juengster(alle.filter((e) => e.payload.quelle === kennung));
  if (!letzter) return null;
  const lage = letzter.payload.lage as QuellLage;
  const fassung = letzter.payload.wissensfassung;
  const aktuell = letzter.payload.aktuelleFassung;
  return {
    lage,
    am: letzter.at,
    aktuelleFassung: typeof aktuell === "string" ? aktuell : null,
    ...(typeof fassung === "number" ? { fassung } : {}),
  };
}

/**
 * Die Belegstellen eines Wissensobjekts, wie die Lesefläche sie zeigen soll: eine Quelle, deren
 * Abschnitt zuletzt als nicht mehr erreichbar beobachtet wurde, trägt `sourceRemovedAt` — dasselbe
 * Feld und dieselbe Bedeutung wie beim Abgleich importierter Seiten („ein Abgleich hat festgestellt,
 * dass die Quellseite gelöscht ist"). Die Oberfläche (`quellHinweise`, apps/web/src/lib/koSource.ts)
 * zeigt es bereits; der Import selbst bleibt unverändert erreichbar.
 */
export async function quellenMitLage<S extends Belegstelle & { sourceRemovedAt?: string }>(
  audit: AuditLeser,
  objektId: string,
  quellen: readonly S[],
): Promise<S[]> {
  const aus: S[] = [];
  for (const s of quellen) {
    const kennung = s.sourceRemovedAt ? null : quellKennungVon(s);
    const lage = kennung ? await letzteBeobachtung(audit, objektId, kennung) : null;
    const weg = lage?.lage === "quelle_nicht_mehr_erreichbar";
    aus.push(weg && lage ? { ...s, sourceRemovedAt: lage.am } : s);
  }
  return aus;
}

const QUELLE_GESPERRT_MELDUNG =
  "Für diese Quelle ist das Leserecht entzogen. Der Inhalt ist gesperrt, bis das Recht wieder erteilt ist.";

/** Die eine Abweisung einer Quellsperre — für jede Route gleich. */
export function sendeQuellsperre(reply: FastifyReply): void {
  const message = QUELLE_GESPERRT_MELDUNG;
  reply.code(403).send({ error: "QUELLE_GESPERRT", message });
}

/** Die Prüfung für die Entwurfsrouten — eingesetzt in `captureRoutes` (optional). */
export interface Quellsperre {
  gesperrt(stellen: readonly Belegstelle[]): Promise<boolean>;
}

export function quellsperreAus(audit: AuditLeser): Quellsperre {
  return { gesperrt: (stellen) => belegstellenGesperrt(audit, stellen) };
}

/** Die Anreicherung für den Detailweg der Wissensobjekte — eingesetzt in `koRoutes`. */
export interface Quellenlage {
  fuer<S extends Belegstelle & { sourceRemovedAt?: string }>(
    objektId: string,
    quellen: readonly S[],
  ): Promise<S[]>;
}

export function quellenlageAus(audit: AuditLeser): Quellenlage {
  return { fuer: (objektId, quellen) => quellenMitLage(audit, objektId, quellen) };
}
