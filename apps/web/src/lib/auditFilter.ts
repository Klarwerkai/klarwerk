// produkt:20261009:admin-audit-verstaendlich (ADMIN-03) — DIE FILTER DES PROTOKOLLS ALS DATEN.
//
// DOM-frei und i18n-frei, damit die Regeln im Node-Tor prüfbar sind (wie `auditEventDetail.ts`):
// welche Kalendertage welchen Zeitraum meinen, wann ein Zeitraum verkehrt ist, welche Seitenanfrage
// zu Filterwerten und Zeiger gehört, und wie ein Zeitpunkt MIT Zeitzone gelesen wird. Die Fläche
// (`components/einstellungen/Auditprotokoll.tsx`) rendert nur.
import type { AuditSeitenAnfrage } from "../api/types";

/** Die Filterwerte, wie das Formular sie hält: Kennungen, Aktionscode, Kalendertage. */
export interface AuditFilterWerte {
  person: string;
  aktion: string;
  ziel: string;
  /** Kalendertag `JJJJ-MM-TT` (lokal), einschließlich. */
  von: string;
  /** Kalendertag `JJJJ-MM-TT` (lokal), einschließlich. */
  bis: string;
}

export const LEERE_AUDIT_FILTER: AuditFilterWerte = {
  person: "",
  aktion: "",
  ziel: "",
  von: "",
  bis: "",
};

const KALENDERTAG = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Der Beginn eines lokalen Kalendertags als ISO-Zeitpunkt in UTC — `versatz` Tage später. So meint
 * „bis 09.10." den ganzen 9. Oktober in der Zeitzone dessen, der filtert.
 */
export function tagesbeginnIso(tag: string, versatz = 0): string | undefined {
  const m = KALENDERTAG.exec(tag);
  if (!m) {
    return undefined;
  }
  const datum = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + versatz);
  return Number.isFinite(datum.getTime()) ? datum.toISOString() : undefined;
}

/** Endet der Zeitraum vor seinem Beginn? (Beide Tage gesetzt und lesbar.) */
export function zeitraumVerkehrt(werte: Pick<AuditFilterWerte, "von" | "bis">): boolean {
  return KALENDERTAG.test(werte.von) && KALENDERTAG.test(werte.bis) && werte.bis < werte.von;
}

/**
 * Die Seitenanfrage zu Filterwerten und Seitenzeiger. Leere Felder fehlen in der Anfrage — „kein
 * Filter" —, gesetzte werden kombiniert (UND). `bis` ist einschließlich: die Anfrage endet am
 * Beginn des Folgetags.
 */
export function auditAnfrage(werte: AuditFilterWerte, vor: number | undefined): AuditSeitenAnfrage {
  const from = tagesbeginnIso(werte.von);
  const to = tagesbeginnIso(werte.bis, 1);
  return {
    ...(werte.person ? { actor: werte.person } : {}),
    ...(werte.aktion ? { action: werte.aktion } : {}),
    ...(werte.ziel ? { target: werte.ziel } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(vor !== undefined ? { before: vor } : {}),
  };
}

/**
 * Datum und Uhrzeit in der Sprache der Oberfläche, MIT Zeitzone (`MESZ`, `CEST`, `GMT+2` …).
 *
 * Einzelne Bestandteile statt `dateStyle`/`timeStyle`: beide lassen sich mit `timeZoneName` nicht
 * kombinieren (Intl wirft dann). `zone` ist nur für Tests da — ohne sie gilt die Zeitzone des Geräts.
 */
export function zeitpunktMitZone(iso: string, sprache: string, zone?: string): string {
  const datum = new Date(iso);
  if (!Number.isFinite(datum.getTime())) {
    return iso;
  }
  try {
    return new Intl.DateTimeFormat(sprache, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
      ...(zone ? { timeZone: zone } : {}),
    }).format(datum);
  } catch {
    return datum.toISOString();
  }
}
