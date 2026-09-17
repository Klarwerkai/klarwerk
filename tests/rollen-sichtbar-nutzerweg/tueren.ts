// ================================================================================================
// JOB 4326 · DIE FÜNF TÜREN — EINE ZEILE JE TÜR, DIE ERWARTUNG AUS DER ROLLENABNAHME IMPORTIERT.
// ================================================================================================
//
// WAS HIER NICHT STEHT UND WARUM. Kein `erwartet: { viewer: "403", … }` von Hand. Die Muster
// `AB_EXPERTE`, `AB_CONTROLLER` und `NUR_ADMIN` kommen aus `tests/beta-rollenabnahme/tabelle.ts`
// (`:599-623`) — derselbe Grundsatz, mit dem jene Datei selbst begründet, warum ihre Muster
// exportiert sind (`tabelle.ts:575-578`): „Sie dort abzuschreiben hiesse, zwei Auffassungen vom
// Rollenmodell zu führen — und die zweite ist die, die eines Tages nicht nachgezogen wird."
// Ebenso kommt der Fehlerschlüssel aus `erwarteterCode` und der Katalogsatz aus `meldung()`; eine
// zweite Textquelle entsteht an keiner Stelle.
//
// WARUM DIE BESCHRIFTUNGEN AUS `i18n.ts` KOMMEN. §5.3 des Auftrags: „den Sollwert liest du aus
// `i18n.ts` (`role.gate.title`), keine zweite Textquelle". Das gilt für den Sperrkartentitel genau
// so wie für „Endgültig löschen" und „Demodaten laden" — beide Knöpfe tragen keine Kennung im DOM
// (`AdminDatenDetails.tsx:536`, `:1000-1010`), also ist ihre Beschriftung der einzige Griff, und sie
// wird gelesen statt abgeschrieben.
//
// WAS DIESE FÜNF TÜREN NICHT SIND: eine neue Erwartungsquelle und keine zweite Abnahme. Die
// Drahtabnahme in `tests/beta-rollenabnahme/**` misst weiterhin ALLE Türen mit ALLEN fünf Akteuren
// über `app.inject`. Hier kommen für fünf davon die Fläche, der echte Socket, der echte Browser und
// die echte Datenbank hinzu.
import { createHash } from "node:crypto";
import type { Pool } from "pg";
import i18n from "../../apps/web/src/i18n";
import { SCHREIB_TABELLE } from "../beta-rollenabnahme/schreibende-tueren";
import {
  AB_CONTROLLER,
  AB_EXPERTE,
  type Erwartungen,
  NUR_ADMIN,
} from "../beta-rollenabnahme/tabelle";
import type { Knopf } from "./flaeche";

/** Ein Text aus dem Sprachkatalog des Produkts — die EINE Quelle, nie abgeschrieben. */
export function katalog(schluessel: string): string {
  const wert = String(i18n.t(schluessel));
  if (wert === "" || wert === schluessel) {
    throw new Error(
      `JOB 4326: der Sprachkatalog kennt „${schluessel}" nicht (gelesen: „${wert}") — der Sollwert dieses Nachweises ist damit nicht belegt.`,
    );
  }
  return wert;
}

/** Der Satz, an dem ein Mensch die Sperrkarte erkennt (`Stage2Notice.tsx:101`, `i18n.ts:4892`). */
export const SPERRSATZ = katalog("role.gate.title");

/** Die Kennungen, die erst zur Laufzeit entstehen — je Lauf frisch. */
export interface TuerAufbau {
  /** Das Wissensobjekt in der Prüfwarteschlange (T2). */
  pruefKo: string;
  /** Das Wissensobjekt im Papierkorb (T3). */
  papierkorbKo: string;
  /** Die Anschrift, unter der T4 ein Konto anlegen WÜRDE — eine eigene, keine der Prüfkonten. */
  neueAnschrift: string;
}

export interface Tuer {
  nr: string;
  titel: string;
  /** Der Deep-Link, den ein Mensch eintippt (ohne Basis). */
  seite: string;
  /**
   * Der Navigationspunkt, über den ein Mensch diese Tür OHNE Deep-Link fände.
   *
   * `oeffnen` nennt den Auslöser, der ihn überhaupt erst rendert. Für T3–T5 ist das das Zahnrad:
   * die Zeile „Einstellungen" unter der Überschrift „Verwaltung" entsteht nur bei
   * `role === "admin"` (`ZahnradMenue.tsx:99-132`) und nur im GEÖFFNETEN Menü
   * (`Menue.tsx:144-146` gibt geschlossen `null` zurück). Ohne das Öffnen wäre „nicht sichtbar"
   * für jede Rolle wahr und der Nachweis wertlos.
   */
  menuepunkt?: { oeffnen?: string; sel: string; name: string };
  /** Das Bedienelement der Tür selbst. */
  knopf: Knopf;
  /**
   * Der Text, den ein Mensch an diesem Bedienelement WIRKLICH liest — aus dem Sprachkatalog.
   *
   * Er steht neben `knopf`, weil zwei Türen ein CONTAINER sind (T4 ist eine Karte) und REGELN.md 9
   * ausdrücklich sagt: „Ein sichtbarer Container belegt nicht, dass sein gesamter `innerText`
   * sichtbar ist." Der Gegenpol misst deshalb beides — das Element UND das Element, das diesen Satz
   * in eigenen Textknoten trägt.
   *
   * Er ist NICHT derselbe Schlüssel wie der Seitentitel: das Kopfband beschriftet „Erfassen"
   * (`kopfband.erfassen`), während `nav.capture` „Wissen erfassen" heisst — die Abweichung steht
   * ausgeschrieben in `navigation.ts:459-475` (`anzeigeNameKey`).
   */
  beschriftung: string;
  methode: "POST" | "PUT" | "DELETE";
  /** Die Route, die dieses Bedienelement absetzt — mit den Kennungen dieses Laufs. */
  route: (a: TuerAufbau) => string;
  /**
   * Das MUSTER, unter dem die Rollenabnahme diese Tür führt (`/api/kos/:id`, nicht die eingesetzte
   * Kennung). Es ist der Schlüssel, mit dem `erfolgsstatus` den Erfolgsstatus dort nachschlägt —
   * dieselbe Trennung wie `Zeile.route`/`Zeile.pfad` in `tabelle.ts:74-98`.
   */
  registrierteRoute: string;
  rumpf: (a: TuerAufbau) => Record<string, unknown> | null;
  /**
   * Der Rechtename, der im Katalogsatz „Recht fehlt: %s" stehen muss — oder `null`, wenn die Tür
   * ihren eigenen Wächter hat und den Rechtenamen nicht herausgibt (T4, `routes.ts:329-344`).
   */
  recht: string | null;
  /** Abweichende Fehlerschlüssel dieser Tür — dieselbe Form wie `Zeile.codes` der Rollenabnahme. */
  codes?: Partial<Record<"401" | "403", string>>;
  /** IMPORTIERT, nicht abgeschrieben. */
  erwartet: Erwartungen;
  /** Wie der Bestand in der Protokollzeile heisst. */
  bestandsname: string;
  /**
   * Die Grösse, die ein gelungener Aufruf verändern WÜRDE — vor und nach jedem Versuch gelesen.
   *
   * Liefert eine `Bestandslesung` und keinen Text: der Aufrufer muss `maengel` prüfen KÖNNEN, und
   * eine Funktion, die nur einen Text zurückgibt, nimmt ihm genau diese Möglichkeit (Runde 1).
   */
  bestand: (pool: Pool, a: TuerAufbau) => Promise<Bestandslesung>;
}

// ------------------------------------------------------------------------------------------------
// RUNDE 2 · KORREKTURPFLICHT 1 — EINE BESTANDSLESUNG OHNE ZEILE IST KEIN BESTAND.
// ------------------------------------------------------------------------------------------------
//
// BENs GEGENPROBE ZU RUNDE 1, wörtlich nachgestellt: er hat in der T2-Bestandsabfrage die Kennung
// auf `00000000-0000-0000-0000-000000000000` gesetzt. Die Abfrage fand nichts, die damalige
// Fassung gab dafür den ERSATZTEXT „(keine Zeile)" zurück — vorher wie nachher derselbe —, und der
// Gleichheitsvergleich blieb GRÜN mit Exit 0. Der Nachweis „danach steht dieselbe Zeile in der
// Datenbank" war damit für ein Objekt erbracht, das die Abfrage überhaupt nicht gesehen hat.
//
// DIE URSACHE IST DER ERSATZWERT, nicht die Abfrage. Deshalb gibt es ab jetzt keinen mehr: jede
// Lesung liefert eine `Bestandslesung`, und die trägt ihre MÄNGEL mit. Der Aufrufer sichert
// `maengel` VOR dem Vergleich einzeln zu — für den Vorher- UND für den Nachherwert getrennt
// (REGELN: „Vorher- und Nachherwerte vor dem Vergleich jeweils unabhängig … prüfen"). Eine Lesung
// mit Mängeln kommt nie in einen Vergleich, und zwei gleiche Fehlanzeigen können nicht mehr als
// „unverändert" durchgehen.
//
// DREI STUFEN, jede einzeln benannt, weil jede einzeln ausfallen kann:
//   1. GENAU EINE ZEILE (`eineZeile`) — keine, zwei oder `rowCount === null` sind Mängel.
//   2. PFLICHTFELDER NICHT LEER — `null`, `undefined` und "" sind Mängel, nicht Werte.
//   3. INHALTSZUSAGE — der gelesene Bestand muss der sein, über den die Zusage spricht: T2 prüft
//      `data.id` gegen das Prüfobjekt DIESES Laufs, jeder Zähler seine Untergrenze bzw. seinen
//      genauen Sollwert. Ohne Stufe 3 bliebe „0 → 0" an T3 grün, obwohl die Papierkorbzeile, über
//      die T3 spricht, gar nicht existiert — dieselbe Krankheit an einer zweiten Tür.

export interface Bestandslesung {
  /** Der Vergleichswert. Nur aussagekräftig, wenn `maengel` leer ist. */
  wert: string;
  /** Jede verletzte Pflicht, ausgeschrieben. LEER heisst: gültige Bestandslesung. */
  maengel: string[];
  /** Was wirklich aus der Datenbank kam — für Protokoll und Fehlermeldung. */
  gelesen: string;
}

/**
 * Eine Abfrage, die GENAU EINE Zeile mit gefüllten Pflichtfeldern liefern muss.
 *
 * `rowCount` und nicht `rows.length`: der Treiber meldet beides, und ein `null` in `rowCount`
 * (Abfrage ohne Ergebnismenge) soll ein Mangel sein und nicht stillschweigend zu 0 werden.
 */
async function eineZeile<T extends Record<string, unknown>>(
  pool: Pool,
  sql: string,
  werte: unknown[],
  pflichtfelder: readonly (keyof T & string)[],
): Promise<{ zeile: T | undefined; maengel: string[]; gelesen: string }> {
  const antwort = await pool.query<T>(sql, werte);
  const maengel: string[] = [];
  if (antwort.rowCount !== 1) {
    maengel.push(
      `die Abfrage lieferte ${String(antwort.rowCount)} Zeilen statt genau einer — „${sql}" mit [${werte.map((w) => String(w)).join(", ")}]`,
    );
  }
  const zeile = antwort.rows[0];
  if (zeile) {
    for (const feld of pflichtfelder) {
      const wert = zeile[feld];
      if (wert === null || wert === undefined || String(wert) === "") {
        maengel.push(`das Pflichtfeld „${feld}" ist leer (gelesen: ${String(wert)})`);
      }
    }
  }
  return { zeile, maengel, gelesen: JSON.stringify(zeile ?? null).slice(0, 400) };
}

/** Was ein Zähler inhaltlich hergeben MUSS, damit er ein gültiger Bestand ist. */
interface Zaehlzusage {
  /** Der Satz, der im Mangel steht, wenn die Zusage nicht gilt. */
  name: string;
  gilt: (anzahl: number) => boolean;
}

/**
 * Ein Zähler als Bestand — genau eine Zeile, Pflichtfeld `anzahl`, echte Zahl, Inhaltszusage.
 *
 * Die Inhaltszusage ist Stufe 3 und keine Zierde: ohne sie wäre „0 → 0" ein gültiger Bestand, und
 * genau damit hat BEN die T2-Fassung der Runde 1 widerlegt.
 */
async function zaehle(
  pool: Pool,
  sql: string,
  werte: unknown[],
  zusage: Zaehlzusage,
): Promise<Bestandslesung> {
  const { zeile, maengel, gelesen } = await eineZeile<{ anzahl: string }>(pool, sql, werte, [
    "anzahl",
  ]);
  const roh = zeile?.anzahl ?? "";
  if (roh !== "") {
    if (!/^\d+$/.test(roh)) {
      maengel.push(`„${roh}" ist keine Zahl — ein Zähler ohne Zahl ist kein Bestand`);
    } else if (!zusage.gilt(Number(roh))) {
      maengel.push(`${zusage.name} — gelesen: ${roh}`);
    }
  }
  return { wert: roh === "" ? "(kein Wert)" : roh, maengel, gelesen };
}

/**
 * Der Bestand von T2: Status UND der vollständige JSONB-Rumpf, bytegenau.
 *
 * Der Rumpf geht als SHA-256 über `data::text` in den Vergleich und nicht als Ausschnitt: ein
 * Vergleich „status gleich" bliebe grün, wenn der Versuch eine Stimme, einen Zeitstempel oder eine
 * Version geschrieben hätte. Der Hash ist der Byte-Vergleich in einer Zeile, die auch in ein
 * Protokoll passt; die Länge steht daneben, damit eine Abweichung sofort ihre Richtung zeigt.
 *
 * RUNDE 2: Es gibt keinen Ersatzwert mehr. Fehlt die Zeile, fehlt ein Pflichtfeld, ist `data` kein
 * gültiges JSON oder trägt es eine ANDERE Kennung als das Prüfobjekt dieses Laufs, dann ist das ein
 * Mangel — und der Aufrufer vergleicht nichts.
 */
async function pruefstand(pool: Pool, a: TuerAufbau): Promise<Bestandslesung> {
  const { zeile, maengel, gelesen } = await eineZeile<{
    status: string | null;
    titel: string | null;
    daten: string;
  }>(
    pool,
    "SELECT data->>'status' AS status, data->>'title' AS titel, data::text AS daten FROM kos WHERE id = $1",
    [a.pruefKo],
    ["status", "titel", "daten"],
  );
  if (!zeile) {
    return { wert: "(kein Wert)", maengel, gelesen };
  }
  let kennung: unknown;
  try {
    kennung = (JSON.parse(zeile.daten) as { id?: unknown }).id;
  } catch (fehler) {
    maengel.push(`\`data\` ist kein gültiges JSON (${String(fehler).slice(0, 140)})`);
  }
  if (kennung !== a.pruefKo) {
    maengel.push(
      `\`data.id\` ist „${String(kennung)}" statt „${a.pruefKo}" — gelesen wurde nicht das Prüfobjekt dieses Laufs`,
    );
  }
  const hash = createHash("sha256").update(zeile.daten, "utf8").digest("hex").slice(0, 16);
  return {
    wert: `status=${String(zeile.status)} bytes=${Buffer.byteLength(zeile.daten, "utf8")} sha=${hash}`,
    maengel,
    gelesen,
  };
}

/**
 * Der Erfolgsstatus dieser Tür — AUS DER ROLLENABNAHME gelesen, nicht abgeschrieben.
 *
 * Die Kalibrierung 5a braucht ihn: nach der Rollenerhöhung muss der Draht den Vorgang WIRKLICH
 * ausführen (201 bzw. 200), und „irgendein 2xx" wäre genau die Unschärfe, gegen die
 * `schreibende-tueren.ts:109-126` geschrieben ist. Eine eigene Liste hier wäre die zweite
 * Auffassung darüber, wie Gelingen an dieser Tür aussieht.
 */
export function erfolgsstatus(methode: string, registrierteRoute: string): number[] {
  const zeile = SCHREIB_TABELLE.find((z) => z.methode === methode && z.route === registrierteRoute);
  if (!zeile) {
    throw new Error(
      `JOB 4326: die Rollenabnahme führt keine schreibende Zeile für ${methode} ${registrierteRoute} — der Erfolgsstatus dieser Tür ist damit nicht belegt.`,
    );
  }
  return zeile.erfolg;
}

/**
 * DIE FÜNF TÜREN. Reihenfolge wie im Auftrag §5.2.
 *
 * T1 und T2 liegen an Kopfbandpunkten (`navigation.ts:121-125`, `:260-264`), T3–T5 hinter dem
 * Zahnrad. Für T1 IST der Kopfbandpunkt zugleich das Bedienelement — der Auftrag nennt für diese
 * Tür genau ihn („Kopfbandpunkt ‚Erfassen' / Deep-Link `/erfassen`"), deshalb steht er einmal und
 * wird einmal gemessen statt zweimal unter zwei Namen.
 */
export const TUEREN: Tuer[] = [
  {
    nr: "T1",
    titel: "Anlegen",
    seite: "/erfassen",
    knopf: {
      art: "selektor",
      sel: '[data-kopfband-punkt="erfassen"]',
      name: `Kopfbandpunkt „${katalog("nav.capture")}" (KopfbandPunkte.tsx:56-57, navigation.ts:121-125)`,
    },
    beschriftung: katalog("kopfband.erfassen"),
    methode: "POST",
    route: () => "/api/kos",
    registrierteRoute: "/api/kos",
    rumpf: () => ({
      confidentiality: "intern",
      title: "Versuch eines gesperrten Akteurs (JOB 4326)",
      statement: "Diese Zeile darf nie entstehen — sie belegt sonst eine offene Tuer.",
      type: "best_practice",
      category: "Wartung",
    }),
    recht: "ko.create",
    erwartet: AB_EXPERTE,
    bestandsname: "Wissensobjekte",
    // Inhaltszusage: die zwei Objekte dieses Laufs (Prüfobjekt und Papierkorbobjekt) stehen im
    // Bestand. Ohne sie wäre eine leergeräumte Tabelle („0 → 0") ein gültiger Bestand.
    bestand: (pool) =>
      zaehle(pool, "SELECT count(*)::text AS anzahl FROM kos", [], {
        name: "der Bestand führt weniger als die zwei Wissensobjekte dieses Laufs",
        gilt: (n) => n >= 2,
      }),
  },
  {
    nr: "T2",
    titel: "Freigeben",
    seite: "/validierung",
    menuepunkt: {
      sel: '[data-kopfband-punkt="validierung"]',
      name: `Kopfbandpunkt „${katalog("nav.validation")}"`,
    },
    knopf: {
      art: "selektor",
      sel: '[data-testid="pruefen-entscheidung-up"]',
      // Das ist der Knopf, der die URTEILSAKTION aus `Validation.tsx:425` absetzt
      // (`freigabeStarten(k, "rate")`, `Validation.tsx:1776` → `endpoints.ko.act(id, {action:"rate",
      // verdict:"up"})`). Der Menüeintrag „Als wahr kennzeichnen" (`val.markTrue`,
      // `Validation.tsx:1397`) ist NICHT dieser Weg: er sendet `admin-validate` und hängt an
      // `users.manage` — eine andere Tür mit einem anderen Tor (s. RUECKGABE, ABWEICHUNGEN).
      name: `Freigabeknopf „${katalog("val.actionApprove")}" (Validation.tsx:1763-1776)`,
    },
    beschriftung: katalog("val.actionApprove"),
    methode: "PUT",
    route: (a) => `/api/kos/${a.pruefKo}`,
    registrierteRoute: "/api/kos/:id",
    rumpf: () => ({ action: "rate", verdict: "up" }),
    recht: "ko.validate",
    erwartet: AB_CONTROLLER,
    bestandsname: "Prüfobjekt",
    bestand: pruefstand,
  },
  {
    nr: "T3",
    titel: "Endgültig löschen",
    seite: "/admin?detail=papierkorb",
    menuepunkt: {
      oeffnen: '[data-testid="kopfband-zahnrad"]',
      sel: '[data-testid="zahnrad-einstellungen"]',
      name: `Zahnrad → „${katalog("gliederung.verwaltung")}" → Einstellungen (ZahnradMenue.tsx:99-132)`,
    },
    knopf: {
      art: "text",
      text: katalog("adm.trash.purge"),
      raum: '[data-testid="detail-papierkorb"]',
      name: `Knopf „${katalog("adm.trash.purge")}" im Papierkorb (AdminDatenDetails.tsx:1000-1010)`,
    },
    beschriftung: katalog("adm.trash.purge"),
    methode: "DELETE",
    route: (a) => `/api/kos/trash/${a.papierkorbKo}`,
    registrierteRoute: "/api/kos/trash/:id",
    rumpf: () => null,
    recht: "users.manage",
    erwartet: NUR_ADMIN,
    bestandsname: "Papierkorbzeile",
    // Inhaltszusage GENAU 1 und nicht „mindestens 0“: die Zusage dieser Tür lautet „die
    // Papierkorbzeile ist noch da“. Ohne diese Stufe wäre „0 → 0“ ein gültiger Bestand — dieselbe
    // Krankheit, die BEN an T2 gefunden hat, nur an einem Zähler.
    bestand: (pool, a) =>
      zaehle(
        pool,
        "SELECT count(*)::text AS anzahl FROM kos WHERE id = $1 AND deleted_at_key IS NOT NULL",
        [a.papierkorbKo],
        {
          name: "die Papierkorbzeile dieses Laufs liegt nicht (mehr) im Papierkorb",
          gilt: (n) => n === 1,
        },
      ),
  },
  {
    nr: "T4",
    titel: "Nutzer anlegen",
    seite: "/admin?bereich=konten&detail=nutzerNeu",
    menuepunkt: {
      oeffnen: '[data-testid="kopfband-zahnrad"]',
      sel: '[data-testid="zahnrad-einstellungen"]',
      name: `Zahnrad → „${katalog("gliederung.verwaltung")}" → Einstellungen`,
    },
    knopf: {
      art: "selektor",
      sel: '[data-testid="detail-nutzer-neu"]',
      name: 'Anlegekarte [data-testid="detail-nutzer-neu"] (Admin.tsx:442)',
    },
    beschriftung: katalog("adm.createTitle"),
    methode: "POST",
    route: () => "/api/users",
    registrierteRoute: "/api/users",
    rumpf: (a) => ({
      name: "Versuch eines gesperrten Akteurs",
      email: a.neueAnschrift,
      password: "Rollen-sichtbar-4326!",
      role: "viewer",
    }),
    // `null`: `requireAdmin` des auth-Moduls gibt keinen Rechtenamen heraus, sondern
    // `ADMIN_REQUIRED` (`routes.ts:337-340`). Der Auftrag verlangt hier 403 mit lesbarer Meldung,
    // ohne „Internal Server Error" und ohne SQLSTATE-Ziffern — genau das wird gemessen.
    recht: null,
    // Derselbe abweichende 401-Schlüssel, den die Rollenabnahme an dieser Gruppe führt
    // (`tabelle.ts:708`): das auth-Modul sendet `INVALID_CREDENTIALS` statt `UNAUTHENTICATED`.
    codes: { "401": "INVALID_CREDENTIALS" },
    erwartet: NUR_ADMIN,
    bestandsname: "Konten",
    // Inhaltszusage: die vier Prüfkonten dieses Laufs (Admin + drei Rollen) stehen im Bestand.
    bestand: (pool) =>
      zaehle(pool, "SELECT count(*)::text AS anzahl FROM users", [], {
        name: "der Bestand führt weniger als die vier Prüfkonten dieses Laufs",
        gilt: (n) => n >= 4,
      }),
  },
  {
    nr: "T5",
    titel: "Demo-Seed",
    seite: "/admin?bereich=vorfuehrdaten&detail=demo",
    menuepunkt: {
      oeffnen: '[data-testid="kopfband-zahnrad"]',
      sel: '[data-testid="zahnrad-einstellungen"]',
      name: `Zahnrad → „${katalog("gliederung.verwaltung")}" → Einstellungen`,
    },
    knopf: {
      art: "text",
      text: katalog("adm.seedButton"),
      raum: '[data-testid="detail-demodaten"]',
      name: `Knopf „${katalog("adm.seedButton")}" (AdminDatenDetails.tsx:528-538)`,
    },
    beschriftung: katalog("adm.seedButton"),
    methode: "POST",
    route: () => "/api/admin/demo-seed",
    registrierteRoute: "/api/admin/demo-seed",
    rumpf: () => ({ locale: "de" }),
    recht: "users.manage",
    erwartet: NUR_ADMIN,
    bestandsname: "Wissensobjekte",
    bestand: (pool) =>
      zaehle(pool, "SELECT count(*)::text AS anzahl FROM kos", [], {
        name: "der Bestand führt weniger als die zwei Wissensobjekte dieses Laufs",
        gilt: (n) => n >= 2,
      }),
  },
];
