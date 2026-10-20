// ================================================================================================
// OCR-E03 · BILDHAFTE TABELLEN BEARBEITEN UND ÜBERNEHMEN (Auftrag produkt:20261012:klara-ocr-tabellen).
// ================================================================================================
//
// Das Raster selbst entsteht in `lib/bildAutomatik.ts` (`bildTabelleAusWoertern`). Diese Datei ist
// das, was danach mit ihm geschieht — DOM-frei, damit sie ohne Browser prüfbar ist:
//   · Bearbeiten: Änderungen liegen NEBEN dem Befund, gebunden an die Inhaltskennung des Bildes.
//     Der Befund und das Originalbild bleiben unverändert; jede Zelle lässt sich auf den erkannten
//     Inhalt zurücksetzen. Ein anderes Bild (andere Bytes) übernimmt keine Änderung.
//   · Übernehmen: über die vorhandene Zwischenablage, als HTML-Tabelle (`<thead>`/`<th>` für die
//     Kopfzeile, leere Zellen als leere `<td>`) UND als tabulatorgetrennter Text. Das HTML ist genau
//     die Form, die der Editor beim Einfügen behält (`normalizePastedHtml`, `lib/richText.ts`).
//     Tabellenkalkulationen lesen den Text als Zeilen und Spalten.
//   · Nichts wird umgerechnet: Dezimalkomma, Vorzeichen, Einheiten und leere Zellen gehen so
//     hinaus, wie sie in der Zelle stehen. Unsichere Stellen tragen ihre Marke `[?…]` bzw.
//     `[unleserlich]` mit — auch in der Kopie.
//   · Nacharbeit 6 (Bens Befund, Elternlieferung OCR-E01/E02 integriert): eine gespeicherte
//     Berichtigung des Bildtexts (OCR-E02, je Quelle und Bildfassung) gilt auch in der Tabelle
//     (`tabelleMitBerichtigung`), und Tabellenänderungen werden als eben diese Berichtigung
//     gespeichert (`berichtigungsText`) — derselbe Speicher, dieselbe Bindung, dasselbe Rückgängig.
import type { BildFundstelle, BildTabelle, TabellenZelle, ZellZustand } from "./bildAutomatik";
import { textStellen } from "./bildFundstelle";
import type { WortPosition } from "./bildRahmen";

/** Änderungen des Nutzers je Zelle, Schlüssel `z:s` (Zeile, Spalte ab 0). */
export type ZellAenderungen = Readonly<Record<string, string>>;

export interface TabellenStand {
  /** Die Inhaltskennung des Bildes, zu dem die Änderungen gehören. */
  inhaltskennung: string | null;
  aenderungen: ZellAenderungen;
}

export function zellSchluessel(zeile: number, spalte: number): string {
  return `${zeile}:${spalte}`;
}

function ohne(aenderungen: ZellAenderungen, schluessel: string): Record<string, string> {
  const rest: Record<string, string> = {};
  for (const [k, v] of Object.entries(aenderungen)) {
    if (k !== schluessel) {
      rest[k] = v;
    }
  }
  return rest;
}

/**
 * Der Stand für ein Bild: die vorhandenen Änderungen nur, wenn sie zu DIESEM Bild gehören — sonst
 * ein leerer Stand. So wandert keine Änderung still auf ein anderes oder verändertes Bild. Ohne
 * Inhaltskennung (keine Bytes lesbar) gilt der Stand nur für dieselbe Ansicht, die ihn hält.
 */
export function standFuer(
  vorhanden: TabellenStand | null | undefined,
  inhaltskennung: string | null,
): TabellenStand {
  if (vorhanden && vorhanden.inhaltskennung === inhaltskennung) {
    return vorhanden;
  }
  return { inhaltskennung, aenderungen: {} };
}

/** Eine Zelle ändern. Gleicht der Wert wieder dem erkannten Inhalt, entfällt die Änderung. */
export function aendereZelle(
  tabelle: BildTabelle,
  stand: TabellenStand,
  zeile: number,
  spalte: number,
  wert: string,
): TabellenStand {
  const erkannt = tabelle.zeilen[zeile]?.[spalte];
  if (!erkannt) {
    return stand;
  }
  const schluessel = zellSchluessel(zeile, spalte);
  const rest = ohne(stand.aenderungen, schluessel);
  return {
    inhaltskennung: stand.inhaltskennung,
    aenderungen: wert === erkannt.text ? rest : { ...rest, [schluessel]: wert },
  };
}

/** Eine Zelle auf den erkannten Inhalt zurücksetzen. */
export function setzeZelleZurueck(
  stand: TabellenStand,
  zeile: number,
  spalte: number,
): TabellenStand {
  return {
    inhaltskennung: stand.inhaltskennung,
    aenderungen: ohne(stand.aenderungen, zellSchluessel(zeile, spalte)),
  };
}

export interface ZellAnsicht {
  /** Die Position als Kennung (`z:s`) — Zellen haben keine andere. */
  schluessel: string;
  wert: string;
  /** Der Inhalt, wie die Erkennung ihn geliefert hat. */
  erkannt: string;
  zustand: ZellZustand;
  mehrdeutig: boolean;
  bearbeitet: boolean;
  /** Die Zelle zeigt eine gespeicherte Berichtigung; `roh` ist, was die Erkennung geliefert hatte. */
  berichtigt: boolean;
  roh: string | null;
}

/** Die Tabelle, wie sie jetzt dasteht: erkannte Zellen, darüber die Änderungen des Nutzers. */
export function aktuelleZellen(tabelle: BildTabelle, stand: TabellenStand): ZellAnsicht[][] {
  return tabelle.zeilen.map((zeile, z) =>
    zeile.map((zelle, s) => {
      const schluessel = zellSchluessel(z, s);
      const geaendert = stand.aenderungen[schluessel];
      return {
        schluessel,
        wert: geaendert ?? zelle.text,
        erkannt: zelle.text,
        zustand: zelle.zustand,
        mehrdeutig: zelle.mehrdeutig,
        bearbeitet: geaendert !== undefined,
        berichtigt: zelle.berichtigt !== undefined,
        roh: zelle.berichtigt?.roh ?? null,
      };
    }),
  );
}

// ------------------------------------------------------------------------------------------------
// OCR-E02-Anbindung: gespeicherte Berichtigungen übernehmen, Tabellenänderungen speichern
// ------------------------------------------------------------------------------------------------
//
// Eine Berichtigung ist der Bildtext, den das Konto für GENAU diese Quelle und Bildfassung
// gespeichert hat (`lib/bildKorrektur.ts`). Für die Tabelle gibt es zwei Formen:
//   · Aus der Tabelle gespeichert: die Tabellenzeilen stehen im Text als Block — eine Zeile je
//     Tabellenzeile, die Zellen durch Tabulator getrennt. Der Block wird Zelle für Zelle gelesen.
//   · Als freier Text berichtigt (OCR-E02 „Text berichtigen“): jedes Wort der Berichtigung wird über
//     die Wortfolge (dieselbe Ausrichtung wie die Fundstellen, `textStellen`) dem erkannten Wort an
//     seiner Stelle zugeordnet und landet in dessen Zelle. Was keinem erkannten Wort eindeutig
//     entspricht, wird NICHT in eine Zelle geraten — es steht als „ohne Tabellenplatz“ da.

/** Ein Wert im Tabellenblock: Tabulator und Zeilenumbruch würden die Struktur brechen. */
function blockWert(wert: string): string {
  return wert.replace(/[\t\r\n]+/g, " ").trim();
}

/** Die Tabelle als Block des Berichtigungstexts: eine Zeile je Tabellenzeile, Zellen per Tabulator. */
export function tabellenBlock(werte: readonly (readonly string[])[]): string[] {
  return werte.map((zeile) => zeile.map(blockWert).join("\t"));
}

function tabulatoren(zeile: string): number {
  return zeile.split("\t").length - 1;
}

/**
 * Wo der Text einen Tabellenblock genau dieser Form trägt: `anzahl` Zeilen am Stück mit je
 * `spalten - 1` Tabulatoren, davor und danach keine weitere solche Zeile. Mehrdeutig ⇒ `null`.
 */
function findeBlock(zeilen: readonly string[], anzahl: number, spalten: number): number | null {
  const passt = (i: number): boolean => tabulatoren(zeilen[i] ?? "") === spalten - 1;
  let gefunden: number | null = null;
  for (let i = 0; i + anzahl <= zeilen.length; i += 1) {
    let alle = true;
    for (let k = 0; k < anzahl && alle; k += 1) {
      alle = passt(i + k);
    }
    if (!alle || (i > 0 && passt(i - 1)) || (i + anzahl < zeilen.length && passt(i + anzahl))) {
      continue;
    }
    if (gefunden !== null) {
      return null;
    }
    gefunden = i;
  }
  return gefunden;
}

/** Die Zelle mit berichtigtem Wert — oder unverändert, wenn sich nichts geändert hat. */
function berichtigteZelle(zelle: TabellenZelle, wert: string): TabellenZelle {
  if (wert === zelle.text) {
    return zelle;
  }
  const rahmen = zelle.rahmen ?? zelle.bereich;
  return {
    text: wert,
    zustand: wert.trim().length === 0 ? "leer" : "sicher",
    mehrdeutig: false,
    ...(rahmen ? { rahmen } : {}),
    ...(zelle.woerter ? { woerter: zelle.woerter } : {}),
    berichtigt: { roh: zelle.text, rohZustand: zelle.zustand },
  };
}

interface ZugeordneteStelle {
  text: string;
  wort: number | null;
  zeile: number;
}

/** Jede Stelle des Textes mit dem erkannten Wort an ihrer Position und ihrer Textzeile. */
function stellenMitZeile(
  text: string,
  woerter: readonly WortPosition[] | undefined,
): ZugeordneteStelle[] {
  const umbrueche: number[] = [];
  for (let i = text.indexOf("\n"); i >= 0; i = text.indexOf("\n", i + 1)) {
    umbrueche.push(i);
  }
  return textStellen(text, woerter).map((s) => ({
    text: s.text,
    wort: s.wort,
    zeile: umbrueche.filter((u) => u < s.start).length,
  }));
}

/** Die Textzeilen, deren zugeordnete Wörter alle zur Tabelle gehören (mindestens eines). */
function tabellenTextzeilen(
  stellen: readonly ZugeordneteStelle[],
  tabellenWoerter: ReadonlySet<number>,
): Set<number> {
  const innen = new Set<number>();
  const aussen = new Set<number>();
  for (const s of stellen) {
    if (s.wort === null) {
      continue;
    }
    (tabellenWoerter.has(s.wort) ? innen : aussen).add(s.zeile);
  }
  return new Set([...innen].filter((z) => !aussen.has(z)));
}

function woerterDerTabelle(tabelle: BildTabelle): Set<number> {
  return new Set(tabelle.zeilen.flat().flatMap((z) => z.woerter ?? []));
}

export interface TabellenAbgleich {
  /** Die Tabelle mit der wirksamen Berichtigung (berichtigte Zellen gekennzeichnet). */
  tabelle: BildTabelle;
  /** Teile der Berichtigung in Tabellenzeilen, die keiner Zelle eindeutig zuzuordnen sind. */
  nichtZugeordnet: string[];
}

/**
 * Die Tabelle, wie die gespeicherte Berichtigung `text` sie zeigt. `woerter` sind die Wörter der
 * Erkennung (`BildBefund.woerter`), auf die sich die Zellen beziehen.
 */
export function tabelleMitBerichtigung(
  tabelle: BildTabelle,
  text: string,
  woerter: readonly WortPosition[] | undefined,
): TabellenAbgleich {
  const zeilen = text.split("\n");
  const start = findeBlock(zeilen, tabelle.zeilen.length, tabelle.spalten);
  if (start !== null) {
    const neu = tabelle.zeilen.map((zeile, z) => {
      const werte = (zeilen[start + z] ?? "").split("\t");
      return zeile.map((zelle, s) => berichtigteZelle(zelle, werte[s] ?? ""));
    });
    return { tabelle: { ...tabelle, zeilen: neu }, nichtZugeordnet: [] };
  }
  const stellen = stellenMitZeile(text, woerter);
  const tabellenWoerter = woerterDerTabelle(tabelle);
  const tabellenZeilen = tabellenTextzeilen(stellen, tabellenWoerter);
  const jeWort = new Map<number, string[]>();
  const nichtZugeordnet: string[] = [];
  for (const s of stellen) {
    if (s.wort !== null && tabellenWoerter.has(s.wort)) {
      jeWort.set(s.wort, [...(jeWort.get(s.wort) ?? []), s.text]);
    } else if (s.wort === null && tabellenZeilen.has(s.zeile)) {
      nichtZugeordnet.push(s.text);
    }
  }
  const neu = tabelle.zeilen.map((zeile) =>
    zeile.map((zelle) =>
      zelle.woerter && zelle.woerter.length > 0
        ? berichtigteZelle(zelle, zelle.woerter.flatMap((i) => jeWort.get(i) ?? []).join(" "))
        : zelle,
    ),
  );
  return { tabelle: { ...tabelle, zeilen: neu }, nichtZugeordnet };
}

/**
 * Der Berichtigungstext, wenn die Tabelle so gespeichert wird, wie sie jetzt dasteht (`werte`).
 * `text` ist der wirksame Bildtext (Rohbefund mit Kennzeichnung oder die bisherige Berichtigung).
 * Die Textzeilen der Tabelle werden durch den Tabellenblock ersetzt; alle übrigen Zeilen bleiben.
 * Steht schon ein Block im Text, wird genau er ersetzt. Wörter einer Tabellenzeile ohne eindeutige
 * Zelle gehen nicht verloren — sie stehen als eigene Zeile hinter dem Block.
 */
export function berichtigungsText(
  text: string,
  woerter: readonly WortPosition[] | undefined,
  tabelle: BildTabelle,
  werte: readonly (readonly string[])[],
): string {
  const zeilen = text.split("\n");
  const block = tabellenBlock(werte);
  const start = findeBlock(zeilen, tabelle.zeilen.length, tabelle.spalten);
  if (start !== null) {
    return [
      ...zeilen.slice(0, start),
      ...block,
      ...zeilen.slice(start + tabelle.zeilen.length),
    ].join("\n");
  }
  const stellen = stellenMitZeile(text, woerter);
  const tabellenZeilen = tabellenTextzeilen(stellen, woerterDerTabelle(tabelle));
  if (tabellenZeilen.size === 0) {
    // Die Tabelle ist im Text nicht auffindbar: nichts ersetzen, den Block anhängen.
    return [...zeilen, ...block].join("\n");
  }
  const rest = stellen
    .filter((s) => s.wort === null && tabellenZeilen.has(s.zeile))
    .map((s) => s.text);
  const erste = Math.min(...tabellenZeilen);
  const aus: string[] = [];
  zeilen.forEach((zeile, i) => {
    if (i === erste) {
      aus.push(...block);
      if (rest.length > 0) {
        aus.push(rest.join(" "));
      }
    }
    if (!tabellenZeilen.has(i)) {
      aus.push(zeile);
    }
  });
  return aus.join("\n");
}

// ------------------------------------------------------------------------------------------------
// Übernahme: HTML und tabulatorgetrennter Text
// ------------------------------------------------------------------------------------------------

function htmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Die Tabelle als HTML für die Zwischenablage. `beschriftung` (Quelle und Fundstelle) wird zur
 * `<caption>` — so trägt die übernommene Tabelle ihre Herkunft mit.
 */
export function tabelleAlsHtml(
  werte: readonly (readonly string[])[],
  kopfzeilen: number,
  beschriftung?: string,
): string {
  const zeile = (zellen: readonly string[], tag: "th" | "td"): string =>
    `<tr>${zellen.map((z) => `<${tag}>${htmlText(z)}</${tag}>`).join("")}</tr>`;
  const kopf = werte.slice(0, kopfzeilen);
  const rumpf = werte.slice(kopfzeilen);
  return [
    "<table>",
    beschriftung ? `<caption>${htmlText(beschriftung)}</caption>` : "",
    kopf.length > 0 ? `<thead>${kopf.map((z) => zeile(z, "th")).join("")}</thead>` : "",
    rumpf.length > 0 ? `<tbody>${rumpf.map((z) => zeile(z, "td")).join("")}</tbody>` : "",
    "</table>",
  ].join("");
}

/**
 * Die Tabelle als tabulatorgetrennter Text (eine Zeile je Tabellenzeile). Eine Zelle mit Tabulator,
 * Zeilenumbruch oder Anführungszeichen steht in Anführungszeichen (`"` verdoppelt) — die übliche
 * Form, die Tabellenkalkulationen als EINE Zelle lesen.
 */
export function tabelleAlsTsv(werte: readonly (readonly string[])[]): string {
  const zelle = (z: string): string => (/[\t\n\r"]/.test(z) ? `"${z.replace(/"/g, '""')}"` : z);
  return werte.map((zeile) => zeile.map(zelle).join("\t")).join("\n");
}

/** Die Beschriftung der übernommenen Tabelle: Quelle und Stelle im Original. */
export function fundstellenText(f: BildFundstelle): {
  quelle: string;
  folie?: number;
  bild: number;
} {
  return f.folie !== undefined
    ? { quelle: f.quelle, folie: f.folie, bild: f.bildAufFolie ?? f.bild }
    : { quelle: f.quelle, bild: f.bild };
}

/** Was die Zwischenablage tatsächlich aufgenommen hat. */
export type KopierErgebnis =
  /** HTML-Tabelle und tabulatorgetrennter Text. */
  | "tabelle"
  /** Nur der tabulatorgetrennte Text — der Browser nimmt kein HTML an. */
  | "nur-text"
  | "nicht-verfuegbar"
  | "fehlgeschlagen";

/**
 * Strukturell getippt: im Browser `navigator.clipboard`, im Test eine Attrappe. Als Methoden
 * deklariert — so passt `Clipboard.write(data: ClipboardItem[])` des Browsers, obwohl hier die
 * Einträge nur als `unknown[]` bekannt sind (die DOM-Klasse kommt als `Eintrag` herein).
 */
export interface Zwischenablage {
  write?(eintraege: unknown[]): Promise<void>;
  writeText?(text: string): Promise<void>;
}

export type ZwischenablageEintrag = new (daten: Record<string, Blob>) => unknown;

/**
 * Legt die Tabelle in die Zwischenablage — als HTML UND als Text, wenn der Browser beides annimmt,
 * sonst als Text. Das Ergebnis sagt ehrlich, welche Form angekommen ist.
 */
export async function kopiereTabelle(
  ablage: Zwischenablage | null | undefined,
  inhalt: { html: string; text: string },
  Eintrag?: ZwischenablageEintrag,
): Promise<KopierErgebnis> {
  if (!ablage) {
    return "nicht-verfuegbar";
  }
  if (typeof ablage.write === "function" && Eintrag) {
    try {
      await ablage.write([
        new Eintrag({
          "text/html": new Blob([inhalt.html], { type: "text/html" }),
          "text/plain": new Blob([inhalt.text], { type: "text/plain" }),
        }),
      ]);
      return "tabelle";
    } catch {
      // weiter mit dem Text — manche Browser lehnen HTML in der Zwischenablage ab
    }
  }
  if (typeof ablage.writeText === "function") {
    try {
      await ablage.writeText(inhalt.text);
      return "nur-text";
    } catch {
      return "fehlgeschlagen";
    }
  }
  return "nicht-verfuegbar";
}
