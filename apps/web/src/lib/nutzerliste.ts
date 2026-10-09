// ================================================================================================
// ADMIN-04 · DIE KONTENLISTE — Zugangsstand, Suche, Filter, Rollenwirkung, Sammelvorschau. DOM-frei.
// ================================================================================================
//
// produkt:20261009:admin-nutzer-uebersicht. Beobachtete Ausgangslage (09.10.2026): „Nutzerzeilen
// zeigen Namen und Rolle, aber Zugangszustand, Befristung und übertragbare Verantwortung werden erst
// im Detail sichtbar."
//
// NUR BELEGTE ZUSTÄNDE. Der Zugangsstand ist derselbe wie im Dienst (`services/app/src/
// verantwortung.ts`, `zugangsstand`): ohne Freigabe „gesperrt", ohne lesbares Ende „aktiv", mit
// Ende in der Zukunft „befristet", sonst „abgelaufen". Einladungen und letzte Anmeldung führt das
// Konto nicht (`services/auth/src/types.ts`) — sie werden deshalb weder gezeigt noch gefiltert.
//
// DIE FILTER STEHEN IN DER ADRESSE (`/admin?bereich=konten&suche=…&rolle=…&filter=…`). `filter=wartet`
// ist der Wert, den die Aufgabe „Konten warten auf Freigabe" seit ADMIN-01 setzt; er bleibt der Name
// für „gesperrt", damit alte Links und der Zähler unverändert dieselbe Liste öffnen.
import { ROLES, type Role } from "../app/navigation";
import { freiheitenSchluessel } from "../components/einstellungen/rollenFreiheiten";
import { KONTEN_FILTER_PARAM, KONTEN_FILTER_WARTET } from "./adminUebersicht";

export type KontoZugang = "aktiv" | "befristet" | "abgelaufen" | "gesperrt";

/** Die Reihenfolge in der Auswahl „Zugang". */
export const ZUGAENGE: readonly KontoZugang[] = ["aktiv", "befristet", "abgelaufen", "gesperrt"];

export const SUCHE_PARAM = "suche";
export const ROLLE_PARAM = "rolle";

/**
 * Der Zugangsstand eines Kontos. `ablauf` ist der LESBARE Ablaufzeitpunkt (`lesbarerAblauf` aus
 * `pages/AdminKontenDetails.tsx`) — ein unlesbarer Wert sperrt niemanden aus (`service.ts`) und
 * gilt deshalb wie im Dienst als „aktiv"; die Zeile benennt ihn trotzdem eigens.
 */
export function kontoZugang(
  approved: boolean,
  ablauf: number | undefined,
  jetzt: number,
): KontoZugang {
  if (!approved) {
    return "gesperrt";
  }
  if (ablauf === undefined) {
    return "aktiv";
  }
  return ablauf <= jetzt ? "abgelaufen" : "befristet";
}

/** URL-Wert ↔ Zugang. `wartet` ist der bestehende Name für „gesperrt" (ADMIN-01). */
function zugangAusParam(wert: string | null): KontoZugang | null {
  if (wert === KONTEN_FILTER_WARTET) {
    return "gesperrt";
  }
  return (ZUGAENGE as readonly string[]).includes(wert ?? "") && wert !== "gesperrt"
    ? (wert as KontoZugang)
    : null;
}

export function zugangAlsParam(zugang: KontoZugang): string {
  return zugang === "gesperrt" ? KONTEN_FILTER_WARTET : zugang;
}

export interface KontenFilter {
  suche: string;
  rolle: Role | null;
  zugang: KontoZugang | null;
}

/** Die Filter aus der Adresse — was nicht erlaubt ist, gilt als „nicht gesetzt". */
export function kontenFilterAus(params: URLSearchParams): KontenFilter {
  const rolle = params.get(ROLLE_PARAM);
  return {
    suche: params.get(SUCHE_PARAM) ?? "",
    rolle: (ROLES as readonly string[]).includes(rolle ?? "") ? (rolle as Role) : null,
    zugang: zugangAusParam(params.get(KONTEN_FILTER_PARAM)),
  };
}

export function filterAktiv(f: KontenFilter): boolean {
  return f.suche.trim() !== "" || f.rolle !== null || f.zugang !== null;
}

/** Die Filter als Adressteil (ohne `bereich`/`detail`) — leer, wenn keiner gesetzt ist. */
export function kontenFilterQuery(f: KontenFilter): string {
  const teile: string[] = [];
  if (f.suche.trim() !== "") {
    teile.push(`${SUCHE_PARAM}=${encodeURIComponent(f.suche)}`);
  }
  if (f.rolle !== null) {
    teile.push(`${ROLLE_PARAM}=${f.rolle}`);
  }
  if (f.zugang !== null) {
    teile.push(`${KONTEN_FILTER_PARAM}=${zugangAlsParam(f.zugang)}`);
  }
  return teile.join("&");
}

function normal(s: string): string {
  return s.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("de");
}

/**
 * Trifft die Suche dieses Konto? Gesucht wird in Name und E-Mail-Adresse (das Kontokennzeichen,
 * das die Verwaltung ohnehin sieht). Mehrere Wörter müssen ALLE vorkommen, je in Name oder Adresse.
 */
export function sucheTrifft(konto: { name: string; email: string }, suche: string): boolean {
  const woerter = normal(suche).split(/\s+/).filter(Boolean);
  if (woerter.length === 0) {
    return true;
  }
  const name = normal(konto.name);
  const adresse = normal(konto.email);
  return woerter.every((w) => name.includes(w) || adresse.includes(w));
}

/** Suche, Rolle und Zugang GEMEINSAM — ein Konto muss alle gesetzten Bedingungen erfüllen. */
export function filtereKonten<T extends { name: string; email: string; role: Role }>(
  konten: readonly T[],
  f: KontenFilter,
  zugangVon: (k: T) => KontoZugang,
): T[] {
  return konten.filter(
    (k) =>
      sucheTrifft(k, f.suche) &&
      (f.rolle === null || k.role === f.rolle) &&
      (f.zugang === null || zugangVon(k) === f.zugang),
  );
}

// ------------------------------------------------------------------------------------------------
// DIE WIRKUNG EINES ROLLENWECHSELS — aus dem bestehenden Rollenmodell, kein neues.
// ------------------------------------------------------------------------------------------------

/** Alle Fähigkeiten einer Rolle: ihre eigenen und die aller Rollen darunter (Rang). */
export function faehigkeitenVon(rolle: Role): string[] {
  const bis = ROLES.indexOf(rolle);
  return [...new Set(ROLES.slice(0, bis + 1).flatMap((r) => freiheitenSchluessel(r)))];
}

export interface Rollenwirkung {
  dazu: string[];
  weg: string[];
}

export function rollenwirkung(von: Role, nach: Role): Rollenwirkung {
  const alt = new Set(faehigkeitenVon(von));
  const neu = new Set(faehigkeitenVon(nach));
  return {
    dazu: [...neu].filter((k) => !alt.has(k)),
    weg: [...alt].filter((k) => !neu.has(k)),
  };
}

// ------------------------------------------------------------------------------------------------
// SAMMELAKTIONEN — nur, was es je Konto schon gibt, und je Konto mit eigenem Ergebnis.
// ------------------------------------------------------------------------------------------------

/**
 * Zwei vorhandene Einzelaktionen, mehrfach ausgeführt: Freigeben (`POST /api/auth/users/:id/approve`)
 * und Befristen (`PUT /api/users/:id`). Rolle und Löschen gibt es bewusst NICHT gesammelt — beide
 * haben in der Kontokarte eine eigene Rückfrage (Wirkung bzw. Übergabe), die je Person anders ist.
 */
export type Sammelaktion = "freigeben" | "befristen";

export type Vorschauzeile =
  | { id: string; name: string; art: "wirkt" }
  | { id: string; name: string; art: "entfaellt"; grund: "schonFrei" | "gesperrt" | "selbst" };

/**
 * Was die Aktion je ausgewähltem Konto tun WÜRDE — vor dem Ausführen. „Entfällt" ist kein Fehler,
 * sondern eine Zeile, für die die Aktion nicht gilt; sie wird nicht gesendet.
 */
export function sammelvorschau(
  aktion: Sammelaktion,
  auswahl: readonly { id: string; name: string; approved: boolean }[],
  selbstId: string | null,
): Vorschauzeile[] {
  return auswahl.map((k): Vorschauzeile => {
    if (aktion === "freigeben") {
      return k.approved
        ? { id: k.id, name: k.name, art: "entfaellt", grund: "schonFrei" }
        : { id: k.id, name: k.name, art: "wirkt" };
    }
    if (k.id === selbstId) {
      return { id: k.id, name: k.name, art: "entfaellt", grund: "selbst" };
    }
    // Eine Befristung an einem nicht freigegebenen Konto beendet nichts — es kommt ohnehin nicht
    // herein. Sie würde erst mit der Freigabe wirken; das ist eine andere Entscheidung.
    return k.approved
      ? { id: k.id, name: k.name, art: "wirkt" }
      : { id: k.id, name: k.name, art: "entfaellt", grund: "gesperrt" };
  });
}

export type Sammelergebnis =
  | { id: string; name: string; ok: true }
  | { id: string; name: string; ok: false; meldung: string; abgewiesen: boolean };

/** Die Zusammenfassung — nie „erfolgreich", solange auch nur eine Zeile gescheitert ist. */
export function sammelbilanz(ergebnisse: readonly Sammelergebnis[]): {
  ok: number;
  fehler: number;
  vollstaendig: boolean;
} {
  const ok = ergebnisse.filter((e) => e.ok).length;
  const fehler = ergebnisse.length - ok;
  return { ok, fehler, vollstaendig: fehler === 0 };
}
