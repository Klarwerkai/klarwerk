// ================================================================================================
// JOB 3578 · DER STELLVERTRETER-POOL — EINE KLEINE, EHRLICHE NACHBILDUNG VON POSTGRES.
// ================================================================================================
//
// WARUM ÜBERHAUPT EIN STELLVERTRETER: Das Tor hat keine Datenbank (Integrationstests gegen echtes
// Postgres laufen getrennt über `test:integration`). Eine haltbare Ablage lässt sich hier trotzdem
// prüfen — wenn der Stellvertreter die Regeln nachbildet, auf die sich die Ablage beruft, statt
// einfach das zurückzugeben, was das Produkt gerade braucht.
//
// WARUM ER SEIT RUNDE 2 WIRKLICH AUSWERTET UND NICHT MEHR ERKENNT: In Runde 1 hat er die Anweisung
// nach Mustern abgetastet — „steht irgendwo `FROM branding_settings`" hiess „der Vorher-Stand ist
// gefragt", und geschrieben wurde immer, was in `VALUES` stand. Damit blieben ZWEI echte
// Produktverstellungen grün, die der Prüfer eingebaut hat: `aktiv = EXCLUDED.aktiv` aus dem
// `DO UPDATE SET` streichen, und alle drei Vorher-Projektionen durch `SELECT NULL` ersetzen. Beides
// sind Fehler, die eine Oberfläche sofort sähe — der Test hat sie nicht gesehen, weil der
// Stellvertreter ergänzt hat, was das SQL gar nicht sagte.
//
// DESHALB LIEST ER DIE ANWEISUNG JETZT WIRKLICH: zerlegen, zerteilen, auswerten. Was er zurückgibt,
// steht ausschliesslich in der Anweisung; was nicht dort steht, passiert nicht.
//
//   1. ER ZEICHNET JEDE ANWEISUNG AUF. Daran wird gemessen, dass `setze` mit EINER auskommt.
//   2. ER WEIST UNBEKANNTE ANWEISUNGEN AB. Was er nicht nachbilden kann (ein zweites `WHERE`, ein
//      `UPDATE`, eine andere Tabelle), wird zum Fehler statt zu einem gefälligen Ergebnis.
//   3. SEINE TABELLE KOMMT AUS DER DDL DES PRODUKTS (`BRANDING_SETTINGS_SCHEMA`) — Spaltennamen,
//      Typen, NOT NULL und der Primärschlüssel werden von dort gelesen. Es gibt hier also keine
//      zweite, von Hand gepflegte Wahrheit über die Tabelle, die still auseinanderlaufen könnte.
//
// DIE VIER REGELN, AUF DIE SICH DIE MARKENABLAGE BERUFT, und die er deshalb genau nachbildet:
//
//   · SCHNAPPSCHUSS: Jeder Lesezweig EINER Anweisung sieht die Tabelle so, wie sie zu deren Beginn
//     aussah — auch wenn ein anderer Zweig derselben Anweisung schon geschrieben hat. Nur deshalb
//     kann der `vorher`-Zweig den alten Stand liefern.
//   · ON CONFLICT DO UPDATE SET: Es werden GENAU die Spalten neu gesetzt, die dort zugewiesen sind.
//     Jede andere behält ihren gespeicherten Wert. (Fehlt `aktiv = EXCLUDED.aktiv`, bleibt `aktiv`
//     also stehen — und der Test wird rot, wie er soll.)
//   · AUSGEWERTETE AUSDRÜCKE: `branding_settings.version + 1` nimmt den GESPEICHERTEN Wert,
//     `EXCLUDED.x` den vom Aufrufer vorgeschlagenen, `$n` den Parameter, `NULL` nichts. Genau daran
//     scheidet sich „in SQL hochgezählt" von „in JavaScript hochgezählt".
//   · DER SCHLÜSSEL ZÄHLT: `WHERE key=$1` filtert wirklich, und `ON CONFLICT (key)` trifft nur die
//     Zeile mit demselben Schlüssel. Eine fremde Zeile beantwortet kein `lies()`.
//
// WAS ER NICHT KANN und was hier deshalb auch nicht behauptet wird: echte Zeilensperren unter
// echter Gleichzeitigkeit. Dafür braucht es ein echtes Postgres.
import type { Pool, PoolClient } from "pg";
import { BRANDING_SETTINGS_SCHEMA } from "../../services/app/src/branding-settings";

/** Die Werte, die in dieser Tabelle vorkommen können — mehr Typen bildet der Stellvertreter nicht. */
export type Zellwert = string | number | boolean | null;

/** Eine Zeile, so wie sie auf der Platte stünde. */
export interface Tabellenzeile {
  [spalte: string]: Zellwert;
}

/** Der Speicher — bewusst ein schlichtes Objekt, das der Test von außen lesen und setzen darf. */
export interface Speicher {
  zeilen: Tabellenzeile[];
}

export function leererSpeicher(): Speicher {
  return { zeilen: [] };
}

interface Ergebnis {
  rows: Record<string, unknown>[];
  rowCount: number;
}

const SPERRE = /pg_try_advisory_xact_lock/i;
const STEUERWORT = /^(BEGIN|COMMIT|ROLLBACK|END|START TRANSACTION)$/i;

// ================================================================================================
// ZERLEGEN — aus dem Anweisungstext werden Marken.
// ================================================================================================

type Markenart = "wort" | "zahl" | "text" | "parameter" | "zeichen";
interface Marke {
  art: Markenart;
  wert: string;
}

const EINZELZEICHEN = "(),.=+;";

function zerlege(sql: string): Marke[] {
  const marken: Marke[] = [];
  let i = 0;
  while (i < sql.length) {
    const zeichen = sql[i] as string;
    if (/\s/.test(zeichen)) {
      i += 1;
      continue;
    }
    if (zeichen === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") {
        i += 1;
      }
      continue;
    }
    if (/[A-Za-z_]/.test(zeichen)) {
      let j = i;
      while (j < sql.length && /[A-Za-z0-9_]/.test(sql[j] as string)) {
        j += 1;
      }
      marken.push({ art: "wort", wert: sql.slice(i, j) });
      i = j;
      continue;
    }
    if (/[0-9]/.test(zeichen)) {
      let j = i;
      while (j < sql.length && /[0-9]/.test(sql[j] as string)) {
        j += 1;
      }
      marken.push({ art: "zahl", wert: sql.slice(i, j) });
      i = j;
      continue;
    }
    if (zeichen === "$") {
      let j = i + 1;
      while (j < sql.length && /[0-9]/.test(sql[j] as string)) {
        j += 1;
      }
      if (j === i + 1) {
        throw new Error("Stellvertreter: `$` ohne Nummer");
      }
      marken.push({ art: "parameter", wert: sql.slice(i + 1, j) });
      i = j;
      continue;
    }
    if (zeichen === "'") {
      let j = i + 1;
      while (j < sql.length && sql[j] !== "'") {
        j += 1;
      }
      if (j >= sql.length) {
        throw new Error("Stellvertreter: nicht geschlossene Zeichenkette");
      }
      marken.push({ art: "text", wert: sql.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    if (EINZELZEICHEN.includes(zeichen)) {
      marken.push({ art: "zeichen", wert: zeichen });
      i += 1;
      continue;
    }
    throw new Error(`Stellvertreter: unbekanntes Zeichen „${zeichen}"`);
  }
  return marken;
}

/** Der Leser läuft über die Marken und kann für die zweite Auswertungsrunde zurückspringen. */
class Leser {
  private pos = 0;

  constructor(
    private readonly marken: readonly Marke[],
    private readonly quelle: string,
  ) {}

  get fertig(): boolean {
    return this.pos >= this.marken.length;
  }

  merke(): number {
    return this.pos;
  }

  springe(stelle: number): void {
    this.pos = stelle;
  }

  abschnitt(von: number, bis: number): readonly Marke[] {
    return this.marken.slice(von, bis);
  }

  schau(): Marke | undefined {
    return this.marken[this.pos];
  }

  nimm(): Marke {
    const marke = this.marken[this.pos];
    if (!marke) {
      throw this.fehler("unerwartetes Ende der Anweisung");
    }
    this.pos += 1;
    return marke;
  }

  istWort(wort: string): boolean {
    const marke = this.schau();
    return marke?.art === "wort" && marke.wert.toUpperCase() === wort.toUpperCase();
  }

  nimmWortWennDa(wort: string): boolean {
    if (!this.istWort(wort)) {
      return false;
    }
    this.pos += 1;
    return true;
  }

  erwarteWort(wort: string): void {
    if (!this.nimmWortWennDa(wort)) {
      throw this.fehler(`„${wort}" erwartet`);
    }
  }

  istZeichen(zeichen: string): boolean {
    const marke = this.schau();
    return marke?.art === "zeichen" && marke.wert === zeichen;
  }

  nimmZeichenWennDa(zeichen: string): boolean {
    if (!this.istZeichen(zeichen)) {
      return false;
    }
    this.pos += 1;
    return true;
  }

  erwarteZeichen(zeichen: string): void {
    if (!this.nimmZeichenWennDa(zeichen)) {
      throw this.fehler(`„${zeichen}" erwartet`);
    }
  }

  name(): string {
    const marke = this.nimm();
    if (marke.art !== "wort") {
      throw this.fehler(`Name erwartet, gesehen „${marke.wert}"`);
    }
    return marke.wert;
  }

  fehler(was: string): Error {
    const umfeld = this.marken
      .slice(Math.max(0, this.pos - 3), this.pos + 3)
      .map((m) => m.wert)
      .join(" ");
    return new Error(`Stellvertreter: ${was} — bei „${umfeld}" in: ${this.quelle}`);
  }
}

// ================================================================================================
// DIE TABELLE — gelesen aus der DDL DES PRODUKTS, nicht hier noch einmal behauptet.
// ================================================================================================

type Spaltentyp = "text" | "boolean" | "integer";

interface Spalte {
  name: string;
  typ: Spaltentyp;
  nichtNull: boolean;
}

interface Tabelle {
  name: string;
  spalten: Spalte[];
  schluessel: string;
}

function leseTabelle(ddl: string): Tabelle {
  const leser = new Leser(zerlege(ddl), ddl);
  leser.erwarteWort("CREATE");
  leser.erwarteWort("TABLE");
  if (leser.nimmWortWennDa("IF")) {
    leser.erwarteWort("NOT");
    leser.erwarteWort("EXISTS");
  }
  const name = leser.name().toLowerCase();
  leser.erwarteZeichen("(");
  const spalten: Spalte[] = [];
  let schluessel: string | undefined;
  do {
    const spaltenName = leser.name().toLowerCase();
    const typwort = leser.name().toLowerCase();
    if (typwort !== "text" && typwort !== "boolean" && typwort !== "integer") {
      throw leser.fehler(`unbekannter Spaltentyp „${typwort}"`);
    }
    let nichtNull = false;
    while (!leser.istZeichen(",") && !leser.istZeichen(")")) {
      if (leser.nimmWortWennDa("PRIMARY")) {
        leser.erwarteWort("KEY");
        schluessel = spaltenName;
        nichtNull = true;
        continue;
      }
      if (leser.nimmWortWennDa("NOT")) {
        leser.erwarteWort("NULL");
        nichtNull = true;
        continue;
      }
      throw leser.fehler("unbekannte Spaltenangabe");
    }
    spalten.push({ name: spaltenName, typ: typwort, nichtNull });
  } while (leser.nimmZeichenWennDa(","));
  leser.erwarteZeichen(")");
  if (!schluessel) {
    throw new Error("Stellvertreter: die DDL hat keinen PRIMARY KEY — ohne ihn gibt es kein Ziel");
  }
  return { name, spalten, schluessel };
}

const TABELLE = leseTabelle(BRANDING_SETTINGS_SCHEMA);

// ================================================================================================
// AUSWERTEN — eine Anweisung, ein Lauf.
// ================================================================================================

/** Was während der Auswertung eines Ausdrucks sichtbar ist. */
interface Umfeld {
  /** Die Zeile der aktuellen Quelle — Grundlage unqualifizierter Spaltenbezüge. */
  zeile: Tabellenzeile | undefined;
  /** Qualifizierte Bezüge: `EXCLUDED`, der Tabellenname, der Name der FROM-Quelle. */
  benannt: Map<string, Tabellenzeile>;
}

function hole(zeile: Tabellenzeile, spalte: string): Zellwert {
  const wert = zeile[spalte.toLowerCase()];
  if (wert === undefined) {
    throw new Error(
      `Stellvertreter: Spalte „${spalte}" gibt es in dieser Zeile nicht (${JSON.stringify(zeile)})`,
    );
  }
  return wert;
}

function alsZellwert(wert: unknown, herkunft: string): Zellwert {
  if (wert === null || wert === undefined) {
    return null;
  }
  if (typeof wert === "string" || typeof wert === "number" || typeof wert === "boolean") {
    return wert;
  }
  throw new Error(`Stellvertreter: ${herkunft} ist kein einfacher Wert (${String(wert)})`);
}

/** Der Name, den Postgres einer Projektion ohne `AS` gäbe: der Spaltenname, sonst keiner. */
function abgeleiteterName(marken: readonly Marke[]): string | undefined {
  if (marken.length === 1 && marken[0]?.art === "wort") {
    return marken[0].wert.toLowerCase();
  }
  if (
    marken.length === 3 &&
    marken[0]?.art === "wort" &&
    marken[1]?.wert === "." &&
    marken[2]?.art === "wort"
  ) {
    return marken[2].wert.toLowerCase();
  }
  return undefined;
}

class Lauf {
  /**
   * Die Quellen dieser einen Anweisung. Die Basistabelle steht hier als SCHNAPPSCHUSS (Kopien der
   * Zeilen zum Beginn der Anweisung) — geschrieben wird dagegen in `speicher`. Genau diese Trennung
   * ist es, die den `vorher`-Zweig der Markenablage überhaupt möglich macht.
   */
  private readonly quellen = new Map<string, Tabellenzeile[]>();

  constructor(
    private readonly tabelle: Tabelle,
    private readonly speicher: Speicher,
    private readonly werte: readonly unknown[],
  ) {
    this.quellen.set(
      tabelle.name,
      speicher.zeilen.map((zeile) => ({ ...zeile })),
    );
  }

  fuehre(leser: Leser): Tabellenzeile[] {
    const umfeld: Umfeld = { zeile: undefined, benannt: new Map() };
    let zeilen: Tabellenzeile[];
    if (leser.istWort("WITH")) {
      zeilen = this.mit(leser, umfeld);
    } else if (leser.istWort("INSERT")) {
      zeilen = this.insert(leser, umfeld);
    } else if (leser.istWort("SELECT")) {
      zeilen = this.select(leser, umfeld);
    } else {
      throw leser.fehler("nur SELECT, INSERT und WITH sind nachgebildet");
    }
    if (!leser.fertig) {
      throw leser.fehler("unerwarteter Rest nach der Anweisung");
    }
    return zeilen;
  }

  private mit(leser: Leser, umfeld: Umfeld): Tabellenzeile[] {
    leser.erwarteWort("WITH");
    do {
      const name = leser.name().toLowerCase();
      if (this.quellen.has(name)) {
        throw leser.fehler(`der Quellenname „${name}" ist schon vergeben`);
      }
      leser.erwarteWort("AS");
      leser.erwarteZeichen("(");
      const zeilen = leser.istWort("INSERT")
        ? this.insert(leser, umfeld)
        : this.select(leser, umfeld);
      leser.erwarteZeichen(")");
      this.quellen.set(name, zeilen);
    } while (leser.nimmZeichenWennDa(","));
    return this.select(leser, umfeld);
  }

  private select(leser: Leser, umfeld: Umfeld): Tabellenzeile[] {
    leser.erwarteWort("SELECT");
    // Die Projektionsliste wird ZWEIMAL gelesen: einmal übersprungen, um die Quelle zu finden, dann
    // je Zeile ausgewertet. Anders herum wüsste ein Spaltenbezug nicht, worauf er sich bezieht.
    const listenAnfang = leser.merke();
    this.ueberspringe(leser, ["FROM"]);
    let quellenName: string | undefined;
    let zeilen: Tabellenzeile[] = [{}];
    if (leser.nimmWortWennDa("FROM")) {
      quellenName = leser.name().toLowerCase();
      const gefunden = this.quellen.get(quellenName);
      if (!gefunden) {
        throw leser.fehler(`unbekannte Quelle „${quellenName}"`);
      }
      zeilen = gefunden;
      if (leser.nimmWortWennDa("WHERE")) {
        const spalte = leser.name().toLowerCase();
        leser.erwarteZeichen("=");
        const gesucht = this.ausdruck(leser, { zeile: undefined, benannt: umfeld.benannt });
        zeilen = zeilen.filter((zeile) => hole(zeile, spalte) === gesucht);
        if (leser.nimmWortWennDa("WHERE") || leser.nimmWortWennDa("AND")) {
          throw leser.fehler("nur EINE Gleichheitsbedingung ist nachgebildet");
        }
      }
    }
    const ende = leser.merke();
    const ergebnis = zeilen.map((zeile) => {
      leser.springe(listenAnfang);
      const benannt = new Map(umfeld.benannt);
      if (quellenName) {
        benannt.set(quellenName, zeile);
      }
      return this.projektionen(leser, { zeile, benannt });
    });
    leser.springe(ende);
    return ergebnis;
  }

  private insert(leser: Leser, umfeld: Umfeld): Tabellenzeile[] {
    leser.erwarteWort("INSERT");
    leser.erwarteWort("INTO");
    const name = leser.name().toLowerCase();
    if (name !== this.tabelle.name) {
      throw leser.fehler(`unbekannte Tabelle „${name}"`);
    }
    leser.erwarteZeichen("(");
    const spalten: string[] = [];
    do {
      spalten.push(this.spalte(leser, leser.name()));
    } while (leser.nimmZeichenWennDa(","));
    leser.erwarteZeichen(")");
    leser.erwarteWort("VALUES");
    leser.erwarteZeichen("(");
    const werte: Zellwert[] = [];
    do {
      werte.push(this.ausdruck(leser, { zeile: undefined, benannt: umfeld.benannt }));
    } while (leser.nimmZeichenWennDa(","));
    leser.erwarteZeichen(")");
    if (werte.length !== spalten.length) {
      throw leser.fehler("die VALUES-Liste passt nicht zur Spaltenliste");
    }
    // Die vorgeschlagene Zeile — das, was in einem `DO UPDATE SET` unter `EXCLUDED` steht.
    const vorschlag: Tabellenzeile = {};
    for (const spalte of this.tabelle.spalten) {
      vorschlag[spalte.name] = null;
    }
    spalten.forEach((spalte, i) => {
      vorschlag[spalte] = werte[i] ?? null;
    });

    let zuweisungenAb: number | undefined;
    if (leser.nimmWortWennDa("ON")) {
      leser.erwarteWort("CONFLICT");
      leser.erwarteZeichen("(");
      const ziel = leser.name().toLowerCase();
      leser.erwarteZeichen(")");
      if (ziel !== this.tabelle.schluessel) {
        throw leser.fehler(`nur „${this.tabelle.schluessel}" ist als Konfliktziel nachgebildet`);
      }
      leser.erwarteWort("DO");
      leser.erwarteWort("UPDATE");
      leser.erwarteWort("SET");
      // Die Zuweisungen werden nur ausgewertet, WENN es wirklich einen Konflikt gibt.
      zuweisungenAb = leser.merke();
      this.ueberspringe(leser, ["RETURNING"]);
    }

    const schluessel = vorschlag[this.tabelle.schluessel] ?? null;
    const bestand = this.speicher.zeilen.find(
      (zeile) => hole(zeile, this.tabelle.schluessel) === schluessel,
    );
    let ergebnis: Tabellenzeile;
    if (!bestand) {
      this.pruefeZeile(vorschlag);
      this.speicher.zeilen.push(vorschlag);
      ergebnis = vorschlag;
    } else if (zuweisungenAb === undefined) {
      throw new Error(
        `Stellvertreter: doppelter Schlüssel „${String(schluessel)}" und kein ON CONFLICT`,
      );
    } else {
      ergebnis = this.aktualisiere(leser, umfeld, zuweisungenAb, bestand, vorschlag);
    }

    if (leser.nimmWortWennDa("RETURNING")) {
      const benannt = new Map(umfeld.benannt);
      benannt.set(this.tabelle.name, ergebnis);
      return [this.projektionen(leser, { zeile: ergebnis, benannt })];
    }
    return [];
  }

  /**
   * Der Konfliktzweig. Hier steckt die Regel, an der Runde 1 gescheitert ist: Es werden GENAU die
   * Spalten neu gesetzt, die zugewiesen sind — alle anderen behalten ihren gespeicherten Wert. Und
   * die rechten Seiten werden ALLE gegen den ALTEN Stand ausgewertet, bevor irgendetwas geschrieben
   * wird; sonst sähe die zweite Zuweisung, was die erste angerichtet hat.
   */
  private aktualisiere(
    leser: Leser,
    umfeld: Umfeld,
    zuweisungenAb: number,
    bestand: Tabellenzeile,
    vorschlag: Tabellenzeile,
  ): Tabellenzeile {
    const weiter = leser.merke();
    leser.springe(zuweisungenAb);
    const benannt = new Map(umfeld.benannt);
    benannt.set("excluded", vorschlag);
    benannt.set(this.tabelle.name, bestand);
    const zuweisungen: [string, Zellwert][] = [];
    do {
      const spalte = this.spalte(leser, leser.name());
      leser.erwarteZeichen("=");
      zuweisungen.push([spalte, this.ausdruck(leser, { zeile: bestand, benannt })]);
    } while (leser.nimmZeichenWennDa(","));
    leser.springe(weiter);
    const neu: Tabellenzeile = { ...bestand };
    for (const [spalte, wert] of zuweisungen) {
      neu[spalte] = wert;
    }
    this.pruefeZeile(neu);
    this.speicher.zeilen[this.speicher.zeilen.indexOf(bestand)] = neu;
    return neu;
  }

  private projektionen(leser: Leser, umfeld: Umfeld): Tabellenzeile {
    const zeile: Tabellenzeile = {};
    let nummer = 0;
    for (;;) {
      const anfang = leser.merke();
      const wert = this.ausdruck(leser, umfeld);
      const bis = leser.merke();
      const name = leser.nimmWortWennDa("AS")
        ? leser.name().toLowerCase()
        : // Ein Ausdruck ohne Namen heisst bei Postgres `?column?` — wer ihn braucht, muss ihn
          // benennen. Das gilt auch für `SELECT NULL`, und deshalb liefert eine auf NULL
          // umgestellte Vorher-Projektion hier wirklich NULL statt eines Fehlers.
          (abgeleiteterName(leser.abschnitt(anfang, bis)) ?? `?column?${nummer}`);
      zeile[name] = wert;
      nummer += 1;
      if (!leser.nimmZeichenWennDa(",")) {
        return zeile;
      }
    }
  }

  private ausdruck(leser: Leser, umfeld: Umfeld): Zellwert {
    let wert = this.primaer(leser, umfeld);
    while (leser.istZeichen("+")) {
      leser.nimm();
      const rechts = this.primaer(leser, umfeld);
      if (wert === null || rechts === null) {
        wert = null;
        continue;
      }
      if (typeof wert !== "number" || typeof rechts !== "number") {
        throw leser.fehler("`+` verlangt Zahlen");
      }
      wert = wert + rechts;
    }
    return wert;
  }

  private primaer(leser: Leser, umfeld: Umfeld): Zellwert {
    if (leser.istZeichen("(")) {
      leser.nimm();
      if (!leser.istWort("SELECT")) {
        throw leser.fehler("in Klammern ist nur eine Unterabfrage nachgebildet");
      }
      const zeilen = this.select(leser, umfeld);
      leser.erwarteZeichen(")");
      if (zeilen.length > 1) {
        throw new Error("Stellvertreter: die Unterabfrage lieferte mehr als eine Zeile");
      }
      const erste = zeilen[0];
      if (!erste) {
        return null;
      }
      const spalten = Object.keys(erste);
      const einzige = spalten[0];
      if (spalten.length !== 1 || einzige === undefined) {
        throw new Error("Stellvertreter: die Unterabfrage muss genau eine Spalte liefern");
      }
      return erste[einzige] ?? null;
    }
    const marke = leser.nimm();
    if (marke.art === "zahl") {
      return Number(marke.wert);
    }
    if (marke.art === "text") {
      return marke.wert;
    }
    if (marke.art === "parameter") {
      return alsZellwert(this.werte[Number(marke.wert) - 1], `$${marke.wert}`);
    }
    if (marke.art !== "wort") {
      throw leser.fehler(`Ausdruck erwartet, gesehen „${marke.wert}"`);
    }
    const gross = marke.wert.toUpperCase();
    if (gross === "NULL") {
      return null;
    }
    if (gross === "TRUE") {
      return true;
    }
    if (gross === "FALSE") {
      return false;
    }
    if (leser.istZeichen(".")) {
      leser.nimm();
      const spalte = leser.name();
      const bezug = marke.wert.toLowerCase();
      const zeile = umfeld.benannt.get(bezug);
      if (!zeile) {
        throw leser.fehler(`der Bezug „${bezug}" ist hier nicht sichtbar`);
      }
      return hole(zeile, spalte);
    }
    if (!umfeld.zeile) {
      throw leser.fehler(`Spaltenbezug „${marke.wert}" ohne Zeile`);
    }
    return hole(umfeld.zeile, marke.wert);
  }

  /** Überspringt Marken bis zu einem der Halteworte, dem Ende oder der schliessenden Klammer. */
  private ueberspringe(leser: Leser, halte: readonly string[]): void {
    let tiefe = 0;
    for (;;) {
      const marke = leser.schau();
      if (!marke) {
        return;
      }
      if (tiefe === 0) {
        if (marke.art === "zeichen" && marke.wert === ")") {
          return;
        }
        if (
          marke.art === "wort" &&
          halte.some((wort) => wort.toUpperCase() === marke.wert.toUpperCase())
        ) {
          return;
        }
      }
      if (marke.art === "zeichen" && marke.wert === "(") {
        tiefe += 1;
      } else if (marke.art === "zeichen" && marke.wert === ")") {
        tiefe -= 1;
      }
      leser.nimm();
    }
  }

  private spalte(leser: Leser, name: string): string {
    const klein = name.toLowerCase();
    if (!this.tabelle.spalten.some((spalte) => spalte.name === klein)) {
      throw leser.fehler(`die Tabelle „${this.tabelle.name}" hat keine Spalte „${name}"`);
    }
    return klein;
  }

  /** Typen und NOT NULL, wie die DDL sie vorgibt — eine halbe Zeile kommt hier nicht durch. */
  private pruefeZeile(zeile: Tabellenzeile): void {
    for (const spalte of this.tabelle.spalten) {
      const wert = zeile[spalte.name] ?? null;
      if (wert === null) {
        if (spalte.nichtNull) {
          throw new Error(`Stellvertreter: Spalte „${spalte.name}" ist NOT NULL, bekam aber NULL`);
        }
        continue;
      }
      const passt =
        spalte.typ === "text"
          ? typeof wert === "string"
          : spalte.typ === "boolean"
            ? typeof wert === "boolean"
            : typeof wert === "number" && Number.isInteger(wert);
      if (!passt) {
        throw new Error(
          `Stellvertreter: Spalte „${spalte.name}" ist ${spalte.typ}, bekam aber ${JSON.stringify(wert)}`,
        );
      }
    }
  }
}

// ================================================================================================
// DER POOL, WIE IHN DAS PRODUKT SIEHT
// ================================================================================================

export class StellvertreterPool {
  /** JEDE Anweisung, die dieser Pool gesehen hat — in der Reihenfolge des Eingangs. */
  readonly anweisungen: { text: string; werte: readonly unknown[] }[] = [];
  /** Ist er gesetzt, wirft JEDE Anweisung auf die Markentabelle diesen Fehler (H5). */
  fehler: Error | undefined;

  constructor(readonly speicher: Speicher = leererSpeicher()) {}

  /** Nur die Anweisungen auf die Markentabelle — ohne Klammer, Sperre und Aufräumen. */
  get markenAnweisungen(): { text: string; werte: readonly unknown[] }[] {
    return this.anweisungen.filter((a) => new RegExp(TABELLE.name, "i").test(a.text));
  }

  query = async (erstes: unknown, werte: readonly unknown[] = []): Promise<Ergebnis> => {
    const text = typeof erstes === "string" ? erstes : String((erstes as { text: string }).text);
    return this.fuehreAus(text, werte);
  };

  /** Der Mehrquery-Weg: `gatedPool` holt sich eine Verbindung und klammert selbst. */
  connect = async (): Promise<PoolClient> => {
    const client = {
      query: async (erstes: unknown, werte: readonly unknown[] = []): Promise<Ergebnis> => {
        const text =
          typeof erstes === "string" ? erstes : String((erstes as { text: string }).text);
        return this.fuehreAus(text, werte);
      },
      release: () => undefined,
    };
    return client as unknown as PoolClient;
  };

  /** Der Pool, wie ihn das Produkt sieht. Die Umtypung ist der Sinn eines Stellvertreters. */
  alsPool(): Pool {
    return this as unknown as Pool;
  }

  private fuehreAus(text: string, werte: readonly unknown[]): Ergebnis {
    const rumpf = text.trim().replace(/;\s*$/, "").trim();
    // Die Klammer der Reset-Sperre (`db-tx/gated-pool.ts`) läuft hier durch, ohne aufgezeichnet zu
    // werden: sie gehört nicht zur Markenablage, und H3 zählt die Anweisungen DIESER Ablage.
    if (STEUERWORT.test(rumpf)) {
      return { rows: [], rowCount: 0 };
    }
    if (SPERRE.test(rumpf)) {
      return { rows: [{ erworben: true }], rowCount: 1 };
    }
    this.anweisungen.push({ text: rumpf, werte });
    if (this.fehler) {
      throw this.fehler;
    }
    const zeilen = new Lauf(TABELLE, this.speicher, werte).fuehre(new Leser(zerlege(rumpf), rumpf));
    return { rows: zeilen, rowCount: zeilen.length };
  }
}
