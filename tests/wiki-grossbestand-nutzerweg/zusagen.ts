// ================================================================================================
// JOB 4271 · DIE ZUSAGEN 3 BIS 6 — EINMAL AUSGESCHRIEBEN, VOM HAUPTLAUF UND VON DER KALIBRIERUNG
// GEFAHREN.
// ================================================================================================
//
// WARUM ES DIESE DATEI SEIT RUNDE 2 GIBT. BEN hat an Runde 1 zweierlei belegt:
//
//   1 Der Inhaltsnachweis sah eine sichtbar FALSCHE Anleitung nicht. Er verglich den Titel und
//     suchte das Suchwort — wer den Fliesstext durch sein Gegenteil ersetzt und das Suchwort stehen
//     lässt, kam durch.
//   2 Die Kalibrierung prüfte etwas ANDERES als der Hauptlauf. Sie war neben ihm nachgebaut; ob die
//     Fälle des Hauptlaufs unter einer Verstellung wirklich rot werden, war damit nicht gezeigt.
//     Für die Zusagen 4 und 6 gab es gar keine Verstellung, und für 5 stand Adminzugriff statt
//     einer Filtermutation.
//
// BENs Prüffrage wörtlich: „Kalibriere dieselben Assertions wie im Hauptlauf."
//
// Genau das ist der Zweck dieser Datei. Jede Zusage steht hier EINMAL als ausführbare Funktion.
// `findet-im-grossbestand.integration.test.ts` ruft sie am 10.000er-Bestand; `kalibrierung.
// integration.test.ts` ruft DIESELBE Funktion noch einmal, unter einer gezielten Verstellung, und
// belegt, dass sie dann wirft. Läge die Prüfung zweimal ausgeschrieben da, wäre die Kalibrierung
// wieder nur eine Aussage über sich selbst.
//
// JEDE FUNKTION BRINGT IHR EIGENES BROWSERPROFIL MIT (`frischeSeite`) und räumt es weg. Das ist
// keine Bequemlichkeit: eine Verstellung, die in einem Profil hängen bliebe, verfälschte die nächste
// Phase — und die Rücknahme wäre nicht mehr belegbar.
import type { Pool } from "pg";
import { expect } from "vitest";
import type { Kontext, Seite } from "../gast-nutzerweg/browserweg";
import {
  JOB,
  type Lesestand,
  type Listenstand,
  type Tastaturbefund,
  alsSichtbarerText,
  gelesen,
  klappeVorschauenAuf,
  lesestand,
  oeffneTreffer,
  rohantwort,
  seitentext,
  sucheMitTastatur,
  sucheOhneTreffer,
  suchpfad,
  tastaturBetaetigen,
  warteAufBestand,
} from "./nutzerweg";

export interface Sitzplatz {
  kontext: Kontext;
  seite: Seite;
}

/** Ein frisches, angemeldetes Profil in der Bibliothek — der Aufrufer bindet Browser und Instanz. */
export type FrischeSeite = () => Promise<Sitzplatz>;

// ------------------------------------------------------------------------------------------------
// DER ZIELBELEG — die unabhängige Lesung aus der Spalte.
// ------------------------------------------------------------------------------------------------
//
// Er wird NICHT aus dem Browser abgeleitet und nicht aus einem Suchergebnis: er kommt aus
// `SELECT data FROM kos WHERE id = …`. Gegen ihn wird gehalten, was auf der Fläche steht.

export interface Zielbeleg {
  id: string;
  titel: string;
  aussage: string;
  fassung: number;
  /** Der Fliesstext, in derselben Schreibweise, in der ihn der Browser zeigt. */
  fliesstext: string;
  quellen: string[];
  stufe: string;
}

export async function liesZielAusDerSpalte(pool: Pool, id: string): Promise<Zielbeleg> {
  const res = await pool.query<{
    data: {
      title: string;
      statement: string;
      bodyHtml: string | null;
      version: number;
      confidentiality?: string | null;
      sources?: { label: string }[];
    };
  }>("SELECT data FROM kos WHERE id = $1", [id]);
  const daten = res.rows[0]?.data;
  expect(daten, `${JOB}: das Zieldokument ${id} steht nicht in der Spalte`).toBeTruthy();
  const d = daten as NonNullable<typeof daten>;
  return {
    id,
    titel: d.title,
    aussage: d.statement,
    fassung: d.version,
    fliesstext: alsSichtbarerText(d.bodyHtml ?? ""),
    quellen: (d.sources ?? []).map((s) => s.label),
    stufe: d.confidentiality ?? "(keine)",
  };
}

// ------------------------------------------------------------------------------------------------
// ZUSAGE 3 · ÜBER DIE SICHTBARE SUCHE GEFUNDEN UND MIT DER TASTATUR GEÖFFNET.
// ------------------------------------------------------------------------------------------------

export interface Zusage3Auftrag {
  /** Was in das sichtbare Suchfeld getippt wird. */
  begriff: string;
  zielKoId: string;
  zielTitel: string;
  gesamtbestand: number;
  /** Wenn gesetzt: so viele Treffer MUSS die Liste haben (vorab gerechnet, nicht abgelesen). */
  erwarteteTreffer?: number;
  /** Wie viele Tab-Anschläge der Weg zur Zeile höchstens brauchen darf. */
  tabDeckel?: number;
  /** Was an der Fehlermeldung über die Ursache steht, wenn der Treffer fehlt. */
  hinweis?: string;
  /**
   * Der Eingriff ZWISCHEN Suche und Öffnen — hier setzt die Kalibrierung ihre Tastaturmutation an.
   * Im Hauptlauf ist er nicht gesetzt.
   */
  zwischenSucheUndOeffnen?: (seite: Seite) => Promise<void>;
}

export interface Zusage3Befund {
  stand: Listenstand;
  tastaturschritte: number;
  oeffnungsschritte: number;
  adresse: string;
}

export async function zusage3FindetUndOeffnet(
  frischeSeite: FrischeSeite,
  a: Zusage3Auftrag,
): Promise<Zusage3Befund> {
  const p = await frischeSeite();
  try {
    await warteAufBestand(p.seite, 1);
    const { stand, tastaturschritte } = await sucheMitTastatur(p.seite, a.begriff, a.gesamtbestand);
    // Die negative wie die positive Aussage steht auf einer nachweislich FRISCHEN Grundlage: der
    // Fuss trägt eine Zahl. Ohne sie wäre jede Aussage über diese Liste eine über einen Fehler.
    expect(
      stand.zaehler,
      `die Bibliothek nennt zu „${a.begriff}" keine Zahl — dann war der Abruf nicht frisch`,
    ).not.toBeNull();
    if (a.erwarteteTreffer !== undefined) {
      expect(
        stand.zaehler,
        `die Suche nach „${a.begriff}" trifft nicht die vorab gerechnete Zahl`,
      ).toBe(a.erwarteteTreffer);
    }
    expect(
      stand.kennungen,
      `das Zieldokument ${a.zielKoId} steht NICHT in der sichtbaren Trefferliste zu „${a.begriff}" (${stand.zaehler} Treffer).${a.hinweis ? ` ${a.hinweis}` : ""}`,
    ).toContain(a.zielKoId);

    if (a.zwischenSucheUndOeffnen) {
      await a.zwischenSucheUndOeffnen(p.seite);
    }

    const oeffnungsschritte = await oeffneTreffer(p.seite, a.zielKoId, a.tabDeckel ?? 1200);
    const offen = await gelesen(p.seite);
    expect(offen.titel, "geöffnet wurde ein anderer Eintrag").toBe(a.zielTitel);
    // Die Adresse ist erst durch das Öffnen entstanden — angesteuert wurde sie nie.
    const adresse = p.seite.url();
    expect(adresse, "die Adresse trägt die Kennung des Ziels nicht").toContain(a.zielKoId);
    return { stand, tastaturschritte, oeffnungsschritte, adresse };
  } finally {
    await p.kontext.close();
  }
}

// ------------------------------------------------------------------------------------------------
// ZUSAGE 4 · GELESEN WIRD DIE RICHTIGE QUELLE, DIE RICHTIGE FASSUNG UND DER RICHTIGE INHALT.
// ------------------------------------------------------------------------------------------------

export interface Zusage4Auftrag {
  /** Der Suchweg zum Ziel — die Kennung, weil sie genau einen Treffer hat. */
  begriff: string;
  gesamtbestand: number;
  tabDeckel?: number;
  /**
   * Der Eingriff NACH dem Aufklappen und VOR dem Vergleich. Hier setzt die Kalibrierung ihre
   * Inhalts- und ihre Fassungsmutation an; im Hauptlauf ist er nicht gesetzt.
   */
  vorDerPruefung?: (seite: Seite) => Promise<void>;
}

export interface Zusage4Befund {
  mehrBefund: Tastaturbefund;
  stand: Lesestand;
}

/**
 * Ziel öffnen, „Mehr" und die beiden Abschnitte per Tastatur aufklappen, dann Zeile für Zeile
 * gegen die Spalte halten.
 *
 * Der Abschnitt „Provenienz" MUSS mit aufgeklappt werden: `Abschnitt` zeichnet seinen Inhalt erst
 * beim Aufklappen (`MehrAbschnitte.tsx:139-168`), und die Fassungszahl steht in ihm.
 */
export async function zusage4RichtigeQuelleFassungInhalt(
  frischeSeite: FrischeSeite,
  beleg: Zielbeleg,
  a: Zusage4Auftrag,
): Promise<Zusage4Befund> {
  const p = await frischeSeite();
  try {
    await warteAufBestand(p.seite, 1);
    const { stand } = await sucheMitTastatur(p.seite, a.begriff, a.gesamtbestand);
    expect(stand.kennungen, `„${a.begriff}" führt nicht zum Zieldokument`).toContain(beleg.id);
    await oeffneTreffer(p.seite, beleg.id, a.tabDeckel ?? 1200);

    const mehrBefund = await tastaturBetaetigen(p.seite, '[data-testid="bib-mehr"]', "Mehr");
    await zeichenzyklus();
    for (const [schluessel, was] of [
      ["quellen", "Quellen und Belege"],
      ["provenienz", "Provenienz"],
      ["historie", "Historie"],
    ] as const) {
      await tastaturBetaetigen(p.seite, `[data-bib-abschnitt="${schluessel}"] > summary`, was);
      await zeichenzyklus();
    }

    if (a.vorDerPruefung) {
      await a.vorDerPruefung(p.seite);
      await zeichenzyklus();
    }

    const gesehen = await lesestand(p.seite);
    pruefeGegenDieSpalte(gesehen, beleg);
    return { mehrBefund, stand: gesehen };
  } finally {
    await p.kontext.close();
  }
}

/**
 * DER VERGLEICH SELBST — „ist", nicht „enthält".
 *
 * Genau hier ist Runde 1 durchgefallen: ein Fliesstext, der das Gegenteil anordnet und das Suchwort
 * behält, kam durch. Verglichen wird deshalb der GANZE sichtbare Fliesstext gegen den Fliesstext
 * der Spalte, die GANZE Quellenliste gegen die Quellenliste der Spalte und die Fassung als ZAHL.
 */
export function pruefeGegenDieSpalte(gesehen: Lesestand, beleg: Zielbeleg): void {
  expect(gesehen.titel, "der sichtbare Titel ist nicht der Titel aus der Spalte").toBe(beleg.titel);
  expect(
    gesehen.fliesstext,
    `der SICHTBARE Fliesstext ist nicht der Fliesstext aus der Spalte.\n  sichtbar: ${gesehen.fliesstext.slice(0, 400)}\n  Spalte  : ${beleg.fliesstext.slice(0, 400)}`,
  ).toBe(beleg.fliesstext);
  expect(
    gesehen.quellenChips,
    "die sichtbaren Quellen sind nicht die Quellen aus der Spalte",
  ).toEqual(beleg.quellen);
  for (const quelle of beleg.quellen) {
    expect(
      gesehen.quellenAbschnitt,
      `der aufgeklappte Abschnitt „Quellen und Belege" nennt „${quelle}" nicht`,
    ).toContain(quelle);
  }
  expect(
    gesehen.fassung,
    `im Abschnitt „Provenienz" steht nicht die aktive Fassung v${beleg.fassung} — gelesen: „${gesehen.provenienz.slice(0, 200)}"`,
  ).toBe(beleg.fassung);
}

// ------------------------------------------------------------------------------------------------
// ZUSAGE 5 · FREMDE VERTRAULICHE EINTRÄGE BLEIBEN DRAUSSEN — LISTE, TRANSPORT UND VORSCHAU.
// ------------------------------------------------------------------------------------------------

export interface Zusage5Auftrag {
  begriff: string;
  gesamtbestand: number;
  /** Die technischen Kennungen der fremden vertraulichen Einträge. */
  fremde: readonly string[];
  geheimwort: string;
  /** Wie viele Vorschauen aufgeklappt werden. */
  vorschauen?: number;
}

export interface Zusage5Befund {
  stand: Listenstand;
  geoeffneteVorschauen: number;
  rumpflaenge: number;
}

export async function zusage5FremdeBleibenDraussen(
  frischeSeite: FrischeSeite,
  a: Zusage5Auftrag,
): Promise<Zusage5Befund> {
  const p = await frischeSeite();
  try {
    await warteAufBestand(p.seite, 1);
    const { stand } = await sucheMitTastatur(p.seite, a.begriff, a.gesamtbestand);

    // (a) NICHT IN DER LISTE — auf einer nachweislich FRISCHEN Grundlage.
    expect(stand.zaehler, "ohne frische Zahl wäre eine leere Liste kein Beleg").not.toBeNull();
    for (const id of a.fremde) {
      expect(
        stand.kennungen,
        `der fremde vertrauliche Eintrag ${id} steht in der Trefferliste`,
      ).not.toContain(id);
    }

    // (b) NICHT IM TRANSPORT: der Rumpf, den dieser Mensch mit SEINEN Keksen wirklich bekommt.
    const antwort = await rohantwort(p.seite, suchpfad(a.begriff));
    expect(antwort.status, "der Suchabruf aus dem Profil des Nutzers scheiterte").toBe(200);
    expect(antwort.rumpf, "das Geheimwort reist im Rumpf der Suchantwort mit").not.toContain(
      a.geheimwort,
    );
    for (const id of a.fremde) {
      expect(antwort.rumpf, `die Kennung ${id} reist im Rumpf mit`).not.toContain(id);
    }

    // (c) NICHT IN DER VORSCHAU. „Nicht in der Liste" ist keine Aussage über den Trefferauszug: die
    // Vorschau ist erst nach dem Aufklappen im Baum. Und es wird zuerst belegt, dass das Aufklappen
    // überhaupt Text erzeugt hat — sonst wäre die Aussage leer.
    const vorher = (await seitentext(p.seite)).length;
    const geoeffneteVorschauen = await klappeVorschauenAuf(p.seite, a.vorschauen ?? 10);
    const nachher = await seitentext(p.seite);
    expect(geoeffneteVorschauen, "kein einziger Vorschau-Aufklapper ging auf").toBeGreaterThan(0);
    expect(nachher.length, "das Aufklappen hat keinen zusätzlichen Text erzeugt").toBeGreaterThan(
      vorher,
    );
    expect(
      nachher,
      "ein Ausschnitt eines fremden vertraulichen Eintrags steht in der Vorschau",
    ).not.toContain(a.geheimwort);

    return { stand, geoeffneteVorschauen, rumpflaenge: antwort.rumpf.length };
  } finally {
    await p.kontext.close();
  }
}

// ------------------------------------------------------------------------------------------------
// ZUSAGE 6 · NACH DEM RECHTEENTZUG FÜHRT DERSELBE BEDIENWEG NICHT MEHR ZUM DOKUMENT.
// ------------------------------------------------------------------------------------------------

export interface Zusage6Auftrag {
  /** Der Weg über die Kennung: er hatte genau einen Treffer und darf jetzt keinen mehr haben. */
  kennung: string;
  /** Der Weg über die Herkunft: über ihn wurde das Dokument WIRKLICH geöffnet. */
  herkunft: string;
  zielKoId: string;
  zielTitel: string;
  gesamtbestand: number;
  /** Wie gross die Herkunftsgruppe nach dem Entzug sein muss. */
  herkunftsgruppeNachEntzug: number;
  /** Wie lange auf den Leersatz gewartet wird. Gleich in Hauptlauf und Kalibrierung. */
  frist?: number;
}

export async function zusage6EntzugSperrt(
  frischeSeite: FrischeSeite,
  a: Zusage6Auftrag,
): Promise<void> {
  // (a) ÜBER DIE KENNUNG: gelesen wird der LEERSATZ, nicht das Fehlen von Zeilen.
  const p = await frischeSeite();
  try {
    await warteAufBestand(p.seite, 1);
    const leer = await sucheOhneTreffer(p.seite, a.kennung, a.frist ?? 120_000);
    expect(leer.leerSatz, "der Leersatz fehlt").toContain("Nichts gefunden");
    expect(leer.offline, "die leere Liste stammt aus einer angehaltenen Verbindung").toBe(false);
  } finally {
    await p.kontext.close();
  }

  // (b) ÜBER DIE HERKUNFT: die Gruppe ist um genau diesen einen Eintrag kleiner, seine Zeile ist
  //     weg, und sein Titel steht auch sonst nicht mehr auf der Seite.
  const q = await frischeSeite();
  try {
    await warteAufBestand(q.seite, 1);
    const { stand } = await sucheMitTastatur(q.seite, a.herkunft, a.gesamtbestand);
    expect(stand.zaehler, "die Herkunftsgruppe ist durch den Entzug nicht kleiner geworden").toBe(
      a.herkunftsgruppeNachEntzug,
    );
    expect(
      stand.kennungen,
      "die Zeile des entzogenen Dokuments steht weiter in der Liste",
    ).not.toContain(a.zielKoId);
    expect(
      await seitentext(q.seite),
      "der Titel des entzogenen Dokuments steht noch auf der Seite",
    ).not.toContain(a.zielTitel);
  } finally {
    await q.kontext.close();
  }
}

/** Nach dem Aufklappen eines Abschnitts braucht React einen Zeichenzyklus. */
export function zeichenzyklus(): Promise<void> {
  return new Promise((r) => setTimeout(r, 250));
}
