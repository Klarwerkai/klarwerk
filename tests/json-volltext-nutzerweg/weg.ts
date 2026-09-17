// ================================================================================================
// JOB 4293 · DER JSON-RUNDLAUF MIT VOLLTEXT — DER WEG, GENAU EINMAL BESCHRIEBEN.
// ================================================================================================
//
// PEDIS FALL: Ein Wissensobjekt wird exportiert, die Datei in einer frischen Instanz über die
// sichtbare Dateiauswahl in die Prüfwarteschlange gegeben, dort GELESEN, bewusst angenommen — und
// der lange Text soll danach unverändert im Bestand stehen. Bis zu diesem Auftrag verschwand er
// still: `apps/web/src/lib/importReview.ts` baute das Item aus sechs Feldern, `bodyHtml` war keines
// davon, und `apps/web/src/api/types.ts` konnte es nicht einmal transportieren.
//
// ------------------------------------------------------------------------------------------------
// WAS HIER ANDERS IST ALS IM BESTAND — und beide Nachbarn bleiben unverändert stehen.
// ------------------------------------------------------------------------------------------------
//
//   · `tests/library/job2703-datenweg-review-queue-mounted.test.tsx` misst den CONFLUENCE-Strang:
//     Mapper → `POST /api/library/import/candidates` → DTO → gemountete Karte. Er beginnt bei einem
//     bereits gebauten `ImportItem` und endet an der Karte. Weder Export noch Dateiauswahl noch
//     „Annehmen" noch der Zielbestand kommen darin vor — und `app.inject` ist kein Socket.
//   · `tests/import-volltext/pruefkarte-zeigt-volltext-und-quelle.test.tsx` (JOB 3288) misst die
//     ANZEIGE des Volltexts in jsdom. Dass überhaupt einer ankommt, misst sie nicht.
//
// Dieser Ordner setzt die Aussage DANEBEN, die beide nicht machen: die geschlossene Kette
// Export → Datei → Parser → Kandidat → Annehmen → Zielbestand → Reexport, über einen ECHTEN
// HTTP-Socket, und im Browserlauf mit echtem Chromium und der echten Dateiauswahl.
//
// ------------------------------------------------------------------------------------------------
// EINMAL BESCHRIEBEN, DREIMAL GEFAHREN — die Bauform von `tests/gast-nutzerweg/browserweg.ts:11-17`.
// ------------------------------------------------------------------------------------------------
//
//   · `rundlauf-am-echten-socket.test.ts`     → Speicherablagen, ohne Browser (läuft im Tor).
//   · `rundlauf-im-echten-browser.test.ts`    → echtes Chromium, echte Dateiauswahl (Browsergruppe).
//   · `rundlauf-pg.integration.test.ts`       → `buildPgServices(pool)`, echte PostgreSQL, Neustart.
//
// Verschieden ist EIN Argument (der Pool) bzw. EIN Zugang (Socket oder Browser); der Ablauf steht
// genau hier. `kalibrierung.test.ts` fährt denselben Weg mit gezielt gestörtem Server.
//
// ------------------------------------------------------------------------------------------------
// KEIN ZWEITER PARSER, KEIN ZWEITER ANZEIGEWEG, KEINE ZWEITE STRECKE.
// ------------------------------------------------------------------------------------------------
//
// Die Datei wird mit dem ECHTEN Produktparser gelesen (`parseImportItems`), nicht mit einer
// Testabschrift. Die Strecke (echter Port, Keksbeutel, Ersteinrichtung) kommt aus
// `tests/gast-nutzerweg/strecke.ts`, die Chromium- und Tastaturprimitiven aus
// `tests/gast-nutzerweg/browserweg.ts`, das Herstellen der gebauten Fläche und das Lesen im
// frischen Profil aus `tests/fassungsrueckholung-echter-browser/weg.ts` (JOB 4263). Alles vier wird
// IMPORTIERT und nicht nachgebaut — zwei Messstrecken nebeneinander wären zwei Aussagen, die nur
// heute übereinstimmen.
import type { FastifyInstance, FastifyReply } from "fastify";
import { expect } from "vitest";
import type { ImportItemInput } from "../../apps/web/src/api/types";
import { parseImportItems } from "../../apps/web/src/lib/importReview";
import { htmlToPlainText } from "../../apps/web/src/lib/richText";
import type { Antwort, Sitzung } from "../gast-nutzerweg/strecke";

export const JOB = "JOB 4293";

// ------------------------------------------------------------------------------------------------
// DIE MARKEN — je eine eigene Zeichenfolge, damit keine für eine andere einspringen kann.
// ------------------------------------------------------------------------------------------------
//
// Dieselbe Lehre wie in JOB 4263 (BEN, Runde 1): trügen Kernaussage und Volltext dieselbe Marke,
// dann erfüllte der Ersatztext den Nachweis des Ersetzten — und genau der Fehler, den dieser
// Auftrag behebt, bliebe unsichtbar. Der VOLLTEXT bekommt deshalb seine eigene Marke, und die
// Kernaussage enthält sie NICHT (Auftrag § 6, N1: „ein davon deutlich abweichender langer Text").
//
// Jede aus einem Unicode-Block, den im Bestand kein anderer Test benutzt (am Basisstand `b49f14b`
// gemessen: null Treffer für Cherokee U+13A0–13FF, Vai U+A500–A62B und Kyrillisch-Erweiterung-B
// U+A640–A69F unter `tests/`, `services/` und `apps/web/src/`). Eine Marke wie „alt"/„neu" träfe
// im Seitentext irgendwann auf sich selbst.
export const KERN_MARKE = "ᏦᎬᎡᏁ4293";
export const VOLLTEXT_MARKE = "ꖴꕮꘋ4293";
export const FREMD_MARKE = "ꙄꚂꚈ4293";
/** Die Marke des Eintrags, der AUSDRÜCKLICH keinen Volltext trägt — die ehrliche Grenze. */
export const OHNE_VOLLTEXT_MARKE = "ᏫᎣᏁᎬ4293";

/** Der Titel des Quellobjekts — er steht in der Liste, auf der Karte und in der Leseansicht. */
export const TITEL = `Dichtungswechsel Presse 7 mit Volltext (${JOB})`;
export const TITEL_OHNE = `Notiz ohne Volltext (${JOB})`;

/** Die Kernaussage: kurz, und ohne ein einziges Zeichen der Volltextmarke. */
export const KERNAUSSAGE = `Kurzfassung ${KERN_MARKE}: die Dichtung wird bei jedem Wechsel gegen die Prueflehre gemessen.`;

/**
 * ANFANG UND ENDE DES VOLLTEXTS, jeweils GENAU EINMAL im ganzen Text.
 *
 * WARUM DAS EIN EIGENES PAAR IST: Der Anzeigedeckel der Prüfkarte kürzt über CSS
 * (`max-h-64 overflow-hidden`) — geklemmter Text steht in Chromium weiterhin im `innerText`. Ein
 * „enthält den letzten Absatz" wäre deshalb schon vor „Mehr anzeigen" erfüllt und bewiese gar
 * nichts. Der Schlussabsatz belegt hier, dass der GANZE Text im Baum steht (und nicht nur ein
 * serverseitiger Anriss); dass er auch SICHTBAR wird, misst der Fall an der tatsächlichen Geometrie
 * (`scrollHeight`/`clientHeight`) und am Kürzungshinweis, nicht am Text.
 */
export const ERSTER_ABSATZ = `Anfang ${VOLLTEXT_MARKE}: Vor dem Ausbau wird die Presse stromlos geschaltet und gegen Wiedereinschalten gesichert.`;
export const LETZTER_ABSATZ = `Schluss ${VOLLTEXT_MARKE}-ENDE: Die ausgebaute Dichtung wird aufbewahrt, bis der Ursachenbericht abgeschlossen ist.`;

/**
 * Der lange Dokumenttext.
 *
 * ER MUSS DEUTLICH LÄNGER SEIN ALS DER ANRISS, und zwar messbar: `statement` ist seit JOB 2703 der
 * erste Absatz (höchstens `KERNAUSSAGE_MAX` Zeichen). Ein Volltext, der so kurz wäre wie die
 * Kernaussage, könnte von ihr vertreten werden, ohne dass es auffällt. Er liegt deshalb über dem
 * Anzeigedeckel der Prüfkarte (`VOLLTEXT_DECKEL_ZEICHEN` = 1200 Klartextzeichen,
 * `apps/web/src/lib/importTextVolltext.ts:53`) — so wird im Browserlauf zugleich der Weg
 * „Mehr anzeigen" gefahren und nicht nur der bequeme Kurzfall.
 *
 * NUR ALLOWLIST-TAGS: `<p>`/`<strong>` überleben `sanitizeHtml` unverändert. Der Rundlauf soll die
 * Frage „kommt der Text an?" beantworten und nicht die Frage „was macht der Sanitizer aus
 * exotischem Markup?" — die stellt `boeserVolltext()` weiter unten, getrennt und ausdrücklich.
 */
export function volltextHtml(): string {
  const mitte = [
    "<p>Der Restdruck im Hydraulikkreis wird am Manometer M4 abgelesen und schriftlich im Schichtbuch vermerkt.</p>",
    "<p>Die alte Dichtung wird vollstaendig entfernt, die Nut gereinigt und auf Riefen geprueft.</p>",
    "<p>Die neue Dichtung wird trocken eingelegt; Fett im Dichtsitz fuehrt zu Wanderung unter Last.</p>",
    "<p><strong>Erst nach Freigabe durch den Schichtleiter</strong> darf die Anlage wieder anfahren.</p>",
    "<p>Nach dem Anfahren wird der Dichtsitz zwei Stunden lang stuendlich auf Leckage kontrolliert.</p>",
    "<p>Auffaelligkeiten gehen als eigener Vorgang an die Instandhaltung, nicht als Randnotiz ins Schichtbuch.</p>",
  ];
  return [
    `<p>${ERSTER_ABSATZ}</p>`,
    // Dreimal wiederholt: sicher über dem Deckel, und der Text bleibt fachlich lesbar statt Fuellsel.
    ...mitte,
    ...mitte,
    ...mitte,
    `<p>${LETZTER_ABSATZ}</p>`,
  ].join("");
}

/** Bösartiges HTML IM VOLLTEXT — Lieferung 7. Es darf niemals ausführbar beim Leser ankommen. */
export function boeserVolltext(): string {
  return [
    `<p>Harmloser Vorspann ${VOLLTEXT_MARKE}.</p>`,
    '<script>window.__klarwerk4293 = "ausgefuehrt";</script>',
    '<img src="x" onerror="window.__klarwerk4293 = \'ausgefuehrt\'">',
    "<a href=\"javascript:window.__klarwerk4293='ausgefuehrt'\">Klick</a>",
    '<iframe src="https://example.invalid/4293"></iframe>',
  ].join("");
}

/** Die Zeichenfolgen, die nach der Bereinigung NIRGENDS mehr stehen dürfen. */
export const BOESE_SPUREN = ["<script", "onerror", "javascript:", "<iframe"] as const;

// ------------------------------------------------------------------------------------------------
// JEDE ERHOBENE ANTWORT WIRD GEPRÜFT, BEVOR SIE VERGLICHEN WIRD.
// ------------------------------------------------------------------------------------------------
//
// Lehre JOB 4275/4270 (17.09.): ein Ersatzwert gilt NIE als gültiger Bestand, und ein Fehler muss
// Objekt UND Status nennen. Deshalb gibt es hier keinen Zugriff auf `antwort.json` ohne diesen
// Durchgang: Status geprüft, Rumpf geparst, Art geprüft — und bei Abweichung eine Meldung, aus der
// hervorgeht, WAS gefragt wurde, WAS geantwortet wurde und WIE der Rumpf aussah.
export function mussAntwort(was: string, antwort: Antwort, erwartet = 200): unknown {
  expect(
    antwort.status,
    `${JOB}: ${was} → HTTP ${antwort.status} (erwartet ${erwartet}). Rumpf: ${antwort.text.slice(0, 600)}`,
  ).toBe(erwartet);
  expect(
    antwort.json,
    `${JOB}: ${was} → HTTP ${erwartet}, aber der Rumpf ist kein JSON: ${antwort.text.slice(0, 600)}`,
  ).not.toBeUndefined();
  return antwort.json;
}

/** Wie `mussAntwort`, aber mit der zusätzlichen Zusicherung „eine Liste von Objekten". */
export function mussListe(
  was: string,
  antwort: Antwort,
  erwartet = 200,
): Record<string, unknown>[] {
  const roh = mussAntwort(was, antwort, erwartet);
  expect(Array.isArray(roh), `${JOB}: ${was} → der Rumpf ist keine Liste: ${typeof roh}`).toBe(
    true,
  );
  const liste = roh as unknown[];
  for (const [i, eintrag] of liste.entries()) {
    expect(
      eintrag !== null && typeof eintrag === "object",
      `${JOB}: ${was} → Eintrag ${i} ist kein Objekt (${JSON.stringify(eintrag)?.slice(0, 200)}).`,
    ).toBe(true);
  }
  return liste as Record<string, unknown>[];
}

/**
 * Ein Feld, das einen VOLLTEXT tragen muss — und zwar diesen.
 *
 * Drei Fragen, getrennt gestellt, damit die Meldung sagt, WELCHE gescheitert ist: Ist es überhaupt
 * ein nicht-leerer String? Trägt es die Volltextmarke? Ist es lang genug, um nicht die Kernaussage
 * zu sein? Die dritte ist keine Förmlichkeit — sie ist genau die Kalibrierung (ii) aus dem Auftrag:
 * ein aus `statement` gebauter Ersatz wäre kurz und trüge die Volltextmarke nie.
 */
export function mussVolltextTragen(was: string, wert: unknown): string {
  // JEDE Meldung nennt die Volltextmarke, und das ist keine Kosmetik: die Kalibrierung (i) prüft,
  // dass das Rot AM VOLLTEXT hängt. Stünde die Marke nur in einer der vier Meldungen, wäre der
  // häufigste Fall (das Feld ist gar nicht da) genau der, an dem der Nachweis nicht mehr sagt,
  // worum es ging.
  const woran = `${JOB}: ${was} → erwartet war der Volltext mit ${VOLLTEXT_MARKE}`;
  expect(typeof wert, `${woran}, angekommen ist kein String, sondern ${typeof wert}.`).toBe(
    "string",
  );
  const text = wert as string;
  expect(text.trim().length, `${woran}, angekommen ist ein leeres Feld.`).toBeGreaterThan(0);
  // DIE ERFINDUNG WIRD ZUERST GEFRAGT, und das ist eine gemessene Korrektur (Arbeitsprüfung
  // 0ff6fee3…): Stand sie hinter „die Marke fehlt", meldete ein aus `statement` gebauter Ersatz
  // bloss eine fehlende Marke — richtig, aber ohne die Diagnose. Ein Rot soll die KRANKHEIT
  // benennen, nicht nur ihr Symptom.
  expect(
    text,
    `${woran}, angekommen ist ein Text mit der KERNaussagenmarke ${KERN_MARKE} — ein aus statement gebauter Ersatz, kein Volltext.`,
  ).not.toContain(KERN_MARKE);
  expect(text, `${woran}, die Marke fehlt im Angekommenen.`).toContain(VOLLTEXT_MARKE);
  expect(
    htmlToPlainText(text).length,
    `${woran}, angekommen sind nur ${htmlToPlainText(text).length} Klartextzeichen; ein Volltext dieses Prüfstands ist laenger als der Anzeigedeckel (1200).`,
  ).toBeGreaterThan(1200);
  return text;
}

// ------------------------------------------------------------------------------------------------
// DIE GLIEDER DER KETTE — je eines je Schritt, jedes mit eigener Aussage.
// ------------------------------------------------------------------------------------------------

export interface Quelltext {
  titel: string;
  kern: string;
  /** `undefined` heisst ausdrücklich „dieser Eintrag trägt keinen Volltext". */
  volltext?: string;
  tags: string[];
}

/** Das Quellobjekt, das später exportiert wird — angelegt über die ECHTE öffentliche Route. */
export async function legeQuellobjektAn(admin: Sitzung, quelle: Quelltext): Promise<string> {
  const angelegt = mussAntwort(
    `POST /api/kos (${quelle.titel})`,
    await admin.sende("POST", "/api/kos", {
      title: quelle.titel,
      statement: quelle.kern,
      type: "best_practice",
      category: "Wartung",
      tags: quelle.tags,
      // Die Stufe ist am öffentlichen Schreibweg PFLICHT (JOB 3429) — „intern" ist die Stufe des
      // Quellobjekts. Dass der Re-Import daraus konservativ „vertraulich" macht, ist die bekannte
      // und ausdrücklich NICHT abgesenkte Abweichung (Auftrag § 5.8/§ 10); sie wird gemessen.
      confidentiality: "intern",
      ...(quelle.volltext === undefined ? {} : { bodyHtml: quelle.volltext }),
    }),
    201,
  ) as { id?: unknown };
  expect(typeof angelegt.id, `${JOB}: POST /api/kos nennt keine Kennung.`).toBe("string");
  return angelegt.id as string;
}

/**
 * Freigeben — ohne das gibt es keinen Export.
 *
 * `GET /api/library/export` liefert AUSSCHLIESSLICH validierte Objekte (SCRUM-506,
 * `services/library-analytics/src/service.ts`, `exportJson`). Das ist keine Hürde dieses Prüfstands,
 * sondern die Egress-Regel des Produkts; sie wird hier bedient und nicht umgangen.
 */
export async function freigeben(admin: Sitzung, koId: string): Promise<void> {
  mussAntwort(
    `PUT /api/kos/${koId} (admin-validate)`,
    await admin.sende("PUT", `/api/kos/${koId}`, { action: "admin-validate" }),
  );
}

export interface Exportlage {
  /** Der rohe Rumpf — das, was ein Mensch als Datei auf der Platte hätte. */
  roh: string;
  eintraege: Record<string, unknown>[];
}

/** Der echte Export, Standardformat JSON. */
export async function exportiere(wer: Sitzung): Promise<Exportlage> {
  const antwort = await wer.sende("GET", "/api/library/export");
  const eintraege = mussListe("GET /api/library/export", antwort);
  return { roh: antwort.text, eintraege };
}

/** Genau der Eintrag mit diesem Titel — fehlt er, sagt die Meldung, was stattdessen da war. */
export function exportEintrag(lage: Exportlage, titel: string): Record<string, unknown> {
  const treffer = lage.eintraege.filter((e) => e.title === titel);
  expect(
    treffer.length,
    `${JOB}: „${titel}" steht nicht genau einmal im Export. Enthalten: ${lage.eintraege
      .map((e) => String(e.title))
      .join(" · ")}`,
  ).toBe(1);
  return treffer[0] as Record<string, unknown>;
}

/**
 * Die Datei, die ein Mensch weiterreicht.
 *
 * Es ist BEWUSST der unveränderte Exporteintrag und keine eigens gebaute Mindestvorlage: der
 * Auftrag fragt nach dem RUNDLAUF, und ein handgeschriebenes Testdokument wäre eine andere Frage.
 */
export function exportdatei(eintraege: Record<string, unknown>[]): string {
  return JSON.stringify(eintraege, null, 2);
}

/** Der echte Produktparser der Dateiauswahl — keine Abschrift. */
export function auswahlLesen(dateiInhalt: string): ImportItemInput[] {
  return parseImportItems(dateiInhalt);
}

export interface Kandidat {
  id: string;
  item: Record<string, unknown>;
  status: string;
  koId: string | null;
  duplicate: boolean;
}

function alsKandidat(was: string, roh: Record<string, unknown>): Kandidat {
  expect(typeof roh.id, `${JOB}: ${was} → Kandidat ohne Kennung.`).toBe("string");
  expect(
    roh.item !== null && typeof roh.item === "object",
    `${JOB}: ${was} → Kandidat ohne Eintrag.`,
  ).toBe(true);
  return {
    id: roh.id as string,
    item: roh.item as Record<string, unknown>,
    status: String(roh.status),
    koId: typeof roh.koId === "string" ? roh.koId : null,
    duplicate: roh.duplicate === true,
  };
}

/** Dateiauswahl → Prüfwarteschlange (`POST /api/library/import/candidates`). */
export async function einreihen(wer: Sitzung, items: ImportItemInput[]): Promise<Kandidat[]> {
  const liste = mussListe(
    "POST /api/library/import/candidates",
    await wer.sende("POST", "/api/library/import/candidates", { items }),
    201,
  );
  return liste.map((roh) => alsKandidat("POST /api/library/import/candidates", roh));
}

/** Die Warteschlange, wie die Fläche sie liest (`GET /api/library/import/candidates`). */
export async function warteschlange(wer: Sitzung): Promise<Kandidat[]> {
  const liste = mussListe(
    "GET /api/library/import/candidates",
    await wer.sende("GET", "/api/library/import/candidates"),
  );
  return liste.map((roh) => alsKandidat("GET /api/library/import/candidates", roh));
}

export function kandidatMitTitel(kandidaten: Kandidat[], titel: string): Kandidat {
  const treffer = kandidaten.filter((k) => k.item.title === titel);
  expect(
    treffer.length,
    `${JOB}: „${titel}" steht nicht genau einmal in der Warteschlange. Enthalten: ${kandidaten
      .map((k) => String(k.item.title))
      .join(" · ")}`,
  ).toBe(1);
  return treffer[0] as Kandidat;
}

/** Das bewusste „Annehmen" — dieselbe Route, die der Knopf der Prüfkarte aufruft. */
export async function entscheiden(
  wer: Sitzung,
  id: string,
  action: "accept" | "reject",
): Promise<Kandidat> {
  const roh = mussAntwort(
    `PUT /api/library/import/candidates/${id} (${action})`,
    await wer.sende("PUT", `/api/library/import/candidates/${id}`, { action }),
  ) as Record<string, unknown>;
  return alsKandidat(`PUT /api/library/import/candidates/${id}`, roh);
}

/** Der Zielbestand, unabhängig gelesen (`GET /api/kos/:id`). */
export async function koLesen(wer: Sitzung, koId: string): Promise<Record<string, unknown>> {
  return mussAntwort(`GET /api/kos/${koId}`, await wer.sende("GET", `/api/kos/${koId}`)) as Record<
    string,
    unknown
  >;
}

export interface Importbefund {
  imported: number;
  skipped: number;
}

/**
 * DER ZWEITE WEG, ohne Oberfläche: `POST /api/library/import` (`library-routes.ts:731` →
 * `LibraryService.importJson`, `services/library-analytics/src/service.ts:2000`).
 *
 * ER IST NICHT ERFUNDEN, sondern im Router gefunden — Auftrag § 5, Lieferung 1. Er ist auch nicht
 * derselbe wie der Kandidatenweg: er legt SOFORT an, ohne Warteschlange und ohne Prüfkarte, und
 * genau dort (und nur dort) fiel der Volltext bis zu diesem Auftrag serverseitig weg.
 */
export async function direktImportieren(
  wer: Sitzung,
  items: ImportItemInput[],
): Promise<Importbefund> {
  const roh = mussAntwort(
    "POST /api/library/import",
    await wer.sende("POST", "/api/library/import", { items }),
  ) as Record<string, unknown>;
  expect(typeof roh.imported, `${JOB}: POST /api/library/import nennt kein imported.`).toBe(
    "number",
  );
  return { imported: roh.imported as number, skipped: Number(roh.skipped ?? -1) };
}

/** Die Bibliotheks-Suche — hier nur als GRENZE: ihre Antwort trägt bewusst keinen Volltext. */
export async function suchen(wer: Sitzung, q: string): Promise<Record<string, unknown>[]> {
  return mussListe(
    `GET /api/library/search?q=${q}`,
    await wer.sende("GET", `/api/library/search?q=${encodeURIComponent(q)}`),
  );
}

// ------------------------------------------------------------------------------------------------
// DER GANZE RUNDLAUF — EINMAL, UND MIT GETRENNTER PRÜFUNG.
// ------------------------------------------------------------------------------------------------
//
// ZWEI FUNKTIONEN UND NICHT EINE, und das ist der Kern der Kalibrierbarkeit: `fahreDenRundlauf`
// FÄHRT den Weg und prüft dabei ausschliesslich das Handwerkliche (HTTP-Status, Art des Rumpfs,
// vorhandene Kennungen). `pruefeVolltextZusage` prüft die fachliche ZUSAGE — Glied für Glied. Nur
// weil beide getrennt sind, kann die Kalibrierung sagen: der Weg lief durch UND die Zusage ist
// gebrochen, benannt am Volltext. Stünde alles in einer Funktion, wäre jedes Rot gleich viel wert.
export interface Rundlaufbefund {
  quellKoId: string;
  /** Der Eintrag, wie er im Export steht — die Ausgangsdatei in einem Feld. */
  quellExport: Record<string, unknown>;
  dateiInhalt: string;
  gelesen: ImportItemInput[];
  /** Der Kandidat, wie ihn die Einreihung meldet. */
  kandidat: Kandidat;
  /** DERSELBE Kandidat, unabhängig über `GET .../candidates` frisch gelesen. */
  frischGelesen: Kandidat;
  angenommen: Kandidat;
  zielKoId: string;
  /** Der Zielbestand NACH dem Neuladen (eigener Abruf, nicht die Antwort des Schreibwegs). */
  zielKo: Record<string, unknown>;
  /** Der Eintrag desselben Inhalts im ERNEUTEN Export. */
  reexport: Record<string, unknown>;
}

export interface Rundlaufplan {
  titel: string;
  kern: string;
  volltext?: string;
  tags: string[];
}

/**
 * ZWEI INSTANZEN, UND DAS IST KEINE BEQUEMLICHKEIT — es ist der Fall des Auftrags.
 *
 * Pedis Satz lautet: „Dieselbe Datei nimmt er in einer FRISCHEN INSTANZ über die sichtbare
 * Dateiauswahl in die Prüfwarteschlange." Der erste Entwurf dieses Prüfstands hat Quelle und Ziel
 * in DERSELBEN Instanz gefahren — und ist daran gescheitert, nicht am Volltext: der eingereihte
 * Kandidat trug denselben Titel und dieselbe Kernaussage wie das Objekt, aus dem er exportiert
 * wurde, wurde deshalb richtigerweise als Dublette erkannt (`kandidatErzeugtWissensobjekt`,
 * JOB 3050) und legte gar kein Wissensobjekt an (gemessen: Arbeitsprüfung 13291110…,
 * „der angenommene Kandidat nennt kein Zielobjekt"). Ein Prüfstand, der den Dublettenschutz
 * ausgelöst hätte und das als Volltextbefund gemeldet hätte, wäre irreführend gewesen; den Schutz
 * dafür abzustellen wäre schlimmer.
 *
 * Deshalb: `quelle` exportiert, `ziel` importiert. Es sind zwei echte Anwendungen auf zwei echten
 * Ports mit eigenen Ablagen — genau die Lage, in der ein Mensch eine Sicherung einspielt.
 */
export interface Rundlaufinstanzen {
  /** Die Instanz, aus der exportiert wird. */
  quelle: Sitzung;
  /** Die FRISCHE Instanz, in die die Datei geht. */
  ziel: Sitzung;
}

export async function fahreDenRundlauf(
  instanzen: Rundlaufinstanzen,
  plan: Rundlaufplan,
): Promise<Rundlaufbefund> {
  const { quelle, ziel } = instanzen;
  // ── Glied 1+2: das Quellobjekt, freigegeben (sonst kein Export — SCRUM-506). ────────────────
  const quellKoId = await legeQuellobjektAn(quelle, {
    titel: plan.titel,
    kern: plan.kern,
    tags: plan.tags,
    ...(plan.volltext === undefined ? {} : { volltext: plan.volltext }),
  });
  await freigeben(quelle, quellKoId);
  // ── Glied 3: der echte Export. ─────────────────────────────────────────────────────────────
  const quellExport = exportEintrag(await exportiere(quelle), plan.titel);
  // ── Glied 4: die Datei, und der echte Parser der Dateiauswahl. ──────────────────────────────
  const dateiInhalt = exportdatei([quellExport]);
  const gelesen = auswahlLesen(dateiInhalt);
  expect(gelesen.length, `${JOB}: der Parser hat nicht genau einen Eintrag gelesen.`).toBe(1);
  // ── Glied 5: die Prüfwarteschlange DER ZIELINSTANZ — eingereiht und unabhängig wieder gelesen. ─
  const kandidat = kandidatMitTitel(await einreihen(ziel, gelesen), plan.titel);
  const frischGelesen = kandidatMitTitel(await warteschlange(ziel), plan.titel);
  // ── Glied 6: das bewusste Annehmen. ────────────────────────────────────────────────────────
  const angenommen = await entscheiden(ziel, kandidat.id, "accept");
  expect(
    angenommen.koId,
    `${JOB}: der angenommene Kandidat nennt kein Zielobjekt (Status ${angenommen.status}, Dublette ${angenommen.duplicate}).`,
  ).not.toBeNull();
  const zielKoId = angenommen.koId as string;
  // ── Glied 7: Neuladen aus dem Zielbestand, eigener Abruf. ──────────────────────────────────
  const zielKo = await koLesen(ziel, zielKoId);
  // ── Glied 8: der Reexport AUS DER ZIELINSTANZ. Er braucht die Freigabe des NEUEN Objekts — ein
  //    frisch angenommener Import ist „offen" (Auftrag § 5.8: kein Defekt), und der Export ist ein
  //    Egress-Kanal für validierte Objekte. Das ist ein Schritt des Weges, keine Umgehung.
  await freigeben(ziel, zielKoId);
  const reexportLage = await exportiere(ziel);
  const reexport = (() => {
    const treffer = reexportLage.eintraege.filter((e) => e.id === zielKoId);
    expect(
      treffer.length,
      `${JOB}: das Zielobjekt ${zielKoId} steht nicht genau einmal im Reexport. Enthalten: ${reexportLage.eintraege
        .map((e) => `${String(e.id)}/${String(e.title)}`)
        .join(" · ")}`,
    ).toBe(1);
    return treffer[0] as Record<string, unknown>;
  })();
  return {
    quellKoId,
    quellExport,
    dateiInhalt,
    gelesen,
    kandidat,
    frischGelesen,
    angenommen,
    zielKoId,
    zielKo,
    reexport,
  };
}

/**
 * DIE ZUSAGE, Glied für Glied.
 *
 * Je Glied EINE Aussage, damit ein Bruch benennt, WO er liegt (Bauform:
 * `tests/library/job2703-datenweg-review-queue-mounted.test.tsx`). Und ausdrücklich AM VOLLTEXT:
 * jede Meldung nennt die Volltextmarke, damit die Kalibrierung (i) nicht an irgendeinem Rot
 * vorbeikommt, sondern an diesem.
 */
export function pruefeVolltextZusage(befund: Rundlaufbefund, plan: Rundlaufplan): void {
  const imExport = mussVolltextTragen(
    "Glied 3 · der Export des Quellobjekts",
    befund.quellExport.bodyHtml,
  );
  expect(
    befund.dateiInhalt,
    `${JOB}: Glied 4 · die Exportdatei traegt die Volltextmarke nicht.`,
  ).toContain(VOLLTEXT_MARKE);
  mussVolltextTragen("Glied 4 · der Parser der Dateiauswahl", befund.gelesen[0]?.bodyHtml);
  mussVolltextTragen("Glied 5a · der eingereihte Kandidat", befund.kandidat.item.bodyHtml);
  mussVolltextTragen("Glied 5b · der frisch gelesene Kandidat", befund.frischGelesen.item.bodyHtml);
  const imZiel = mussVolltextTragen(
    "Glied 7 · der Zielbestand nach Neuladen",
    befund.zielKo.bodyHtml,
  );
  // Der Volltext ist ZEICHENGLEICH angekommen — nicht bloss „irgendwie vorhanden". Verglichen wird
  // Gespeichertes mit Gespeichertem: beide Seiten sind schon durch `sanitizeHtml` gelaufen.
  expect(
    imZiel,
    `${JOB}: Glied 7 · der Volltext im Zielbestand ist nicht zeichengleich der Ausgangsdatei.`,
  ).toBe(imExport);
  // Was NEBEN dem Volltext erhalten bleiben muss (Auftrag § 5.5).
  expect(befund.zielKo.title, `${JOB}: Glied 7 · der Titel ist nicht erhalten.`).toBe(plan.titel);
  expect(befund.zielKo.statement, `${JOB}: Glied 7 · die Kernaussage ist nicht erhalten.`).toBe(
    plan.kern,
  );
  expect(
    [...((befund.zielKo.tags as string[] | undefined) ?? [])].sort(),
    `${JOB}: Glied 7 · die Schlagworte sind nicht erhalten.`,
  ).toEqual([...plan.tags].sort());
  // Glied 8 · der Kreis schliesst sich: derselbe Volltext, feldweise verglichen.
  const imReexport = mussVolltextTragen("Glied 8 · der Reexport", befund.reexport.bodyHtml);
  expect(
    imReexport,
    `${JOB}: Glied 8 · der Reexport traegt einen ANDEREN Volltext als die Ausgangsdatei.`,
  ).toBe(imExport);
}

// ------------------------------------------------------------------------------------------------
// DIE MUTATION — NUR für die Kalibrierung, und nur im Prüfstand.
// ------------------------------------------------------------------------------------------------
//
// Sie sitzt als Haken VOR bzw. HINTER der echten Route und lässt den Produktionscode unberührt
// (Bauform: `tests/fassungsrueckholung-echter-browser/weg.ts`, Abschnitt „DIE MUTATION"). Vier
// Arten, jede genau eine Krankheit:
//
//   · `volltext-weg`      — nur `bodyHtml` fällt beim Einreihen aus; Titel, Kernaussage und Tags
//                           bleiben RICHTIG. Das ist Kalibrierung (i): der Nachweis muss
//                           ausdrücklich AM VOLLTEXT scheitern und nicht irgendwo.
//   · `volltext-erfunden` — `bodyHtml` wird aus `statement` „rekonstruiert". Das ist Kalibrierung
//                           (ii): genau die Scheinerfüllung, die § 5.3 verbietet.
//   · `messweg-blockiert` — die Warteschlange antwortet 503. Das ist Kalibrierung (iii): der Weg
//                           muss rot werden und darf nicht still grün bleiben (Lehre JOB 4281).
//   · `ohne-bereinigung`  — die Antwort des Zielobjekts trägt den ROHEN Volltext, als wäre nie
//                           sanitisiert worden. Das ist Kalibrierung (iv): der Sicherheitsfall muss
//                           das merken.
export type Mutationsart =
  | "keine"
  | "volltext-weg"
  | "volltext-erfunden"
  | "messweg-blockiert"
  | "ohne-bereinigung";

/**
 * VERÄNDERLICH, und das mit Absicht: EIN Prüfstand trägt nacheinander den ungestörten Lauf und alle
 * Mutationen. Der Haken liest die Art bei jeder Anfrage neu.
 */
export interface Mutation {
  art: Mutationsart;
  /** Was `ohne-bereinigung` in die Antwort legt — der rohe, nie bereinigte Volltext. */
  rohtext: string;
}

export function neueMutation(): Mutation {
  return { art: "keine", rohtext: "" };
}

interface Einreihrumpf {
  items?: { statement?: unknown; bodyHtml?: unknown }[];
}

/**
 * Die Mutation vor das Horchen hängen — und danach, wenn der Aufrufer noch etwas braucht, sein
 * eigenes `vorListen` (im Browserlauf ist das die gebaute Fläche, `mitFlaeche()` aus
 * `tests/gast-nutzerweg/browserweg.ts`). `vorListen` ist das einzige Fenster, in dem noch etwas
 * dazukommen darf (`tests/gast-nutzerweg/strecke.ts:160-165`).
 *
 * WARUM DIE FLÄCHE HIER NICHT SELBST GEHOLT WIRD: `browserweg.ts` ist die eine STARTSTELLE des
 * Chromium (`require("playwright")`, dort :295-299). Ein Import von hier zöge JEDE Datei dieses
 * Ordners in die serielle Browsergruppe des Tors (`tests/tor-inventar/browser-gruppe.ts`) — auch
 * den reinen Socket-Lauf und die Kalibrierung, die keinen Browser brauchen. Der Browserlauf
 * bringt seine Fläche deshalb selbst mit.
 */
export function mitMutation(
  mutation?: Mutation,
  zusaetzlich?: (app: FastifyInstance) => Promise<void>,
): { vorListen: (app: FastifyInstance) => Promise<void> } {
  return {
    vorListen: async (app: FastifyInstance): Promise<void> => {
      if (mutation) {
        app.addHook("preHandler", async (request, reply): Promise<FastifyReply | undefined> => {
          if (mutation.art === "keine") {
            return undefined;
          }
          if (
            mutation.art === "messweg-blockiert" &&
            request.method === "GET" &&
            request.url.startsWith("/api/library/import/candidates")
          ) {
            return reply.code(503).send({ error: "MUTIERT", message: "Messweg blockiert (K3)." });
          }
          if (
            request.method !== "POST" ||
            !request.url.startsWith("/api/library/import/candidates")
          ) {
            return undefined;
          }
          const rumpf = request.body as Einreihrumpf | undefined;
          if (!Array.isArray(rumpf?.items)) {
            return undefined;
          }
          for (const item of rumpf.items) {
            if (mutation.art === "volltext-weg") {
              // Nur der Volltext fällt aus. Kernaussage, Titel und Tags bleiben unangetastet —
              // sonst wüsste der Lauf am Ende nicht, WORAN er gescheitert ist.
              item.bodyHtml = undefined;
            }
            if (mutation.art === "volltext-erfunden") {
              item.bodyHtml = `<p>${String(item.statement ?? "")}</p>`;
            }
          }
          return undefined;
        });
        app.addHook("onSend", async (request, reply, payload) => {
          if (
            mutation.art !== "ohne-bereinigung" ||
            request.method !== "GET" ||
            !request.url.startsWith("/api/kos/") ||
            typeof payload !== "string"
          ) {
            return payload;
          }
          try {
            const objekt = JSON.parse(payload) as Record<string, unknown>;
            if (typeof objekt.bodyHtml !== "string") {
              return payload;
            }
            const ersetzt = JSON.stringify({ ...objekt, bodyHtml: mutation.rohtext });
            // Die Länge MUSS mitwandern: Fastify hat sie beim Serialisieren schon gesetzt, und ein
            // stehen gebliebener `content-length` schneidet die Antwort ab. Dann scheiterte der Fall
            // an einem abgebrochenen Rumpf statt an der fehlenden Bereinigung — ein Rot am falschen
            // Ort ist so wertlos wie ein Grün am falschen Ort.
            reply.header("content-length", String(Buffer.byteLength(ersetzt)));
            return ersetzt;
          } catch {
            return payload;
          }
        });
      }
      if (zusaetzlich) {
        await zusaetzlich(app);
      }
    },
  };
}
