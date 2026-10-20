// produkt:20261010:klara-eigener-kalender (AW-16) · die Zeitrechnung der Kalenderansichten.
//
// ZWEI ARTEN VON ZEIT, BEWUSST GETRENNT:
//   · Ein GANZTÄGIGER Eintrag (eine Frist) trägt ein Kalenderdatum `JJJJ-MM-TT`. Es wird NIE durch
//     eine Zeitzone geschoben: die Frist „30.11." steht in Berlin wie in New York am 30.11.
//   · Ein Termin mit Uhrzeit trägt einen UTC-Zeitpunkt. Angezeigt wird er in der LOKALEN Zeitzone
//     des Browsers — und diese Zone steht sichtbar über jeder Ansicht.
//
// Alles hier ist rein (keine Netz-, keine DOM-Zugriffe), damit es ohne Browser prüfbar bleibt.

/** Die Zeitzone dieses Browsers (IANA), z. B. `Europe/Berlin`. */
export function ortsZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** Der Kalendertag (`JJJJ-MM-TT`), auf den ein Zeitpunkt in `zone` fällt. */
export function tagVon(zeitpunkt: Date, zone: string): string {
  const teile = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(zeitpunkt);
  const wert = (typ: string): string => teile.find((t) => t.type === typ)?.value ?? "";
  return `${wert("year")}-${wert("month")}-${wert("day")}`;
}

function alsUtc(tag: string): Date {
  const [j, m, t] = tag.split("-").map(Number);
  return new Date(Date.UTC(j ?? 1970, (m ?? 1) - 1, t ?? 1));
}

/** Ein Kalendertag `tage` Tage später (negativ: früher). */
export function verschiebe(tag: string, tage: number): string {
  const d = alsUtc(tag);
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

/** Die sieben Tage der Woche (Montag bis Sonntag), in der `tag` liegt. */
export function wocheVon(tag: string): string[] {
  const wochentag = (alsUtc(tag).getUTCDay() + 6) % 7; // Montag = 0
  const montag = verschiebe(tag, -wochentag);
  return Array.from({ length: 7 }, (_, i) => verschiebe(montag, i));
}

export interface ZeitAngaben {
  ganztaegig: boolean;
  beginn: string;
  ende: string | null;
}

/** Die Kalendertage, an denen ein Eintrag in `zone` steht — höchstens 62, damit nichts ausufert. */
export function tageVon(e: ZeitAngaben, zone: string): string[] {
  const erster = e.ganztaegig ? e.beginn : tagVon(new Date(e.beginn), zone);
  const letzter = e.ende ? (e.ganztaegig ? e.ende : tagVon(new Date(e.ende), zone)) : erster;
  const tage = [erster];
  while (tage.length < 62) {
    const naechster = verschiebe(tage[tage.length - 1] as string, 1);
    if (naechster > letzter) {
      break;
    }
    tage.push(naechster);
  }
  return tage;
}

/** Uhrzeit eines Zeitpunkts in `zone`, z. B. `09:30`. */
export function uhrzeit(iso: string, zone: string, sprache: string): string {
  return new Intl.DateTimeFormat(sprache, {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Ein Kalendertag lesbar, z. B. `Mo., 12.10.2026` — ohne Zeitzone, er IST schon ein Tag. */
export function tagLesbar(tag: string, sprache: string): string {
  return new Intl.DateTimeFormat(sprache, {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(alsUtc(tag));
}

/** Die Zone mit ihrem Kurznamen zum gegebenen Augenblick, z. B. `Europe/Berlin (MESZ)`. */
export function zoneLesbar(zone: string, sprache: string, augenblick: Date): string {
  const kurz = new Intl.DateTimeFormat(sprache, { timeZone: zone, timeZoneName: "short" })
    .formatToParts(augenblick)
    .find((t) => t.type === "timeZoneName")?.value;
  return kurz ? `${zone} (${kurz})` : zone;
}

/** Ein `datetime-local`-Wert (Ortszeit des Browsers) als UTC-Zeitpunkt — leer bleibt leer. */
export function ortszeitZuIso(wert: string): string | null {
  if (!wert) {
    return null;
  }
  const d = new Date(wert);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Ein UTC-Zeitpunkt als `datetime-local`-Wert in der Ortszeit des Browsers. */
export function isoZuOrtszeit(iso: string): string {
  const d = new Date(iso);
  const zwei = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}T${zwei(
    d.getHours(),
  )}:${zwei(d.getMinutes())}`;
}
