// ================================================================================================
// JOB 4271 · DER GROSSBESTAND — 10.000 SYNTHETISCHE EINTRÄGE, EINMAL BESCHRIEBEN.
// ================================================================================================
//
// WAS HIER STEHT UND WAS NICHT. Diese Datei beschreibt den Bestand, gegen den der Nutzerweg
// gemessen wird, und sie legt ihn über den PRODUKTWEG an (`KoService.create` +
// `setValidationState`) — nicht mit `INSERT`. Das ist keine Bequemlichkeit, sondern die Antwort auf
// die Prüflücke des Auftrags (§8.6 b): ein Bestand, der an der Projektion, am Versionsschreiben und
// am Freigabetor vorbei in die Tabellen geschrieben wird, ist ein Bestand, den das Produkt gar
// nicht sieht. Gemessen (Cloud-Lauf 82c09ffa91d9aba67e2996d9, Arbeitsprüfung
// 9699ef1f3d8647c6ad3cc288688d2475): 8,1 ms je Anlage und 2,2 ms je Validierung auf dem
// Arbeitsprüfplatz — 10.000 Einträge über den Produktweg passen damit in eine Laufzeit, und der
// Umweg über direktes SQL ist nicht nötig.
//
// ================================================================================================
// DIE ZUSAMMENSETZUNG — jede Gruppe hat genau eine Aufgabe.
// ================================================================================================
//
//   1 ×      ZIELDOKUMENT           `VOLLTEXT_BEGRIFF` steht AUSSCHLIESSLICH im Fliesstext: nicht
//                                   im Titel, nicht in der Aussage, nicht in der Kategorie, nicht
//                                   in den Schlagwörtern. Trust 1, validiert — der Eintrag, den die
//                                   Vertrauensordnung als ERSTEN wegwirft, sobald der Deckel greift.
//  20 ×      ÄHNLICH BENANNTE       Titel dicht am Zieltitel, Dokumentnummern dicht an der
//            ABLENKER               Zielkennung — und OHNE den gesuchten Begriff. Sie messen, dass
//                                   die Suche nicht bloss „irgendetwas mit Presse" findet.
// 160 ×      DECKEL-ABLENKUNG       Trust 90, validiert, der Begriff NUR im Fliesstext. Sie füllen
//                                   den Kandidatendeckel des Fragewegs (50) weit über und pressen
//                                   den Bibliotheksdeckel (200) auf 161 von 200 Plätzen.
//  50 ×      FREMDE VERTRAULICHE     Eigentümer `FREMDER_EIGNER`, Stufe `vertraulich`, der gesuchte
//            EINTRÄGE               Begriff in Titel, Aussage UND Fliesstext, dazu ein
//                                   `GEHEIMWORT`. Sie sind die Negativkontrolle: sie MÜSSTEN oben
//                                   stehen, wenn die Abschirmung nicht trüge.
//  11 ×      HERKUNFTSGRUPPE        Dasselbe Schlagwort wie das Zieldokument (`HERKUNFT`) — der
//                                   dritte Suchweg trifft damit eine GRUPPE und nicht nur einen
//                                   Einzelfall.
// 9758 ×     FÜLLBESTAND            Trägt keinen der vier Begriffe. Er ist der Grund, warum
//                                   überhaupt 10.000 Zeilen entstehen: die Frage lautet nicht „wird
//                                   ein Treffer gefunden", sondern „wird er im GROSSEN Bestand
//                                   gefunden".
//
// ================================================================================================
// WARUM NUR EINE DECOY-GRUPPE UND NICHT ZWEI (Auftrag §2 d nennt zwei) — gemessen, nicht vermutet.
// ================================================================================================
//
// Das Muster mit zwei Gruppen stammt aus `tests/suchraum-deckel/deckel-waehlt-nach-treffergute.test.ts:18-22`
// und gilt dort dem FRAGEweg: `services/ask/src/service.ts` stellt JE FRAGEBEGRIFF eine eigene
// gedeckelte Abfrage, und ein dünn besetzter zweiter Begriff brächte das Objekt an der Deckelfrage
// vorbei herein. Die SICHTBARE Suche dieser Fläche tut das nicht: `LibraryService.search`
// (`services/library-analytics/src/service.ts:1789`) übergibt GENAU EINEN Term — die ganze,
// getrimmte, kleingeschriebene Suchzeile — an `findSearchHits`. Es gibt hier keinen zweiten Begriff,
// über den ein Treffer hereinkommen könnte; eine zweite Gruppe hätte nichts zu verhindern. Die
// Abweichung ist damit belegt und nicht übergangen.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { KoService } from "../../services/knowledge-object";
import type { CreateKoInput } from "../../services/knowledge-object/src/service";

// ------------------------------------------------------------------------------------------------
// DIE VORAB FESTGELEGTEN GRÖSSEN UND BEGRIFFE — sie stehen VOR jedem Lauf fest.
// ------------------------------------------------------------------------------------------------

/** Der Titel des Zieldokuments. Er trägt den gesuchten Begriff AUSDRÜCKLICH NICHT. */
export const ZIEL_TITEL = "Betriebsanweisung Kaltstart Presse 7";

/** Die fachliche Kennung, wie ein Mensch sie auf dem Blatt liest. Sie steht in der Aussage. */
export const ZIEL_KENNUNG = "BA-4271-07713";

/**
 * Der Begriff, der NUR im Fliesstext des Zieldokuments steht.
 *
 * Frei erfunden, damit er mit keinem Wort des Füllbestands und keinem Stoppwort zusammenfällt. Er
 * kommt im Zieldokument in KEINEM Kurzfeld vor — das ist die Lage, in der die Treffergüte des
 * Objekts `koerper` (0) ist und die Vertrauensordnung über sein Überleben im Deckel entscheidet.
 */
export const VOLLTEXT_BEGRIFF = "Zwirbelkopplung";

/** Die Herkunft, als Schlagwort geführt — der dritte Suchweg. */
export const HERKUNFT = "Werk-Nord Linie 3";

/** Die sichtbare Quelle des Zieldokuments. */
export const ZIEL_QUELLE = "Werksarchiv Ordner 12, Blatt 7 (JOB 4271)";

/** Steht AUSSCHLIESSLICH in den fremden vertraulichen Einträgen — die Spur, die nie auftauchen darf. */
export const GEHEIMWORT = "GEHEIMWORT-4271-XRAY";

/** Der Eigentümer der fremden vertraulichen Einträge. Nicht der Testnutzer, nicht der Zielautor. */
export const FREMDER_EIGNER = "fremd-eigner-4271";

/** Der Autor des Zieldokuments. */
export const ZIEL_AUTOR = "anna-4271";

export const GESAMT = 10_000;
export const ABLENKER = 20;
export const DECKEL_ABLENKUNG = 160;
export const FREMDE_VERTRAULICHE = 50;
export const HERKUNFTSGRUPPE = 11;
export const FUELLBESTAND =
  GESAMT - 1 - ABLENKER - DECKEL_ABLENKUNG - FREMDE_VERTRAULICHE - HERKUNFTSGRUPPE;

// ------------------------------------------------------------------------------------------------
// DER BAUPLAN — eine reine Funktion. Sie berührt keine Datenbank und ist deshalb im Tor prüfbar.
// ------------------------------------------------------------------------------------------------

export type Gruppe =
  | "ziel"
  | "ablenker"
  | "deckel"
  | "fremd-vertraulich"
  | "herkunftsgruppe"
  | "fuellbestand";

export interface Eintragsplan {
  gruppe: Gruppe;
  eingabe: CreateKoInput;
  /** `undefined` heisst: bleibt offen. Der Füllbestand wird bewusst nicht validiert. */
  validierung?: { trust: number; status: "validiert" };
}

const ART: CreateKoInput["type"] = "best_practice";

function fuellsatz(nr: string): string {
  return `Abschnitt ${nr}: Ablauf, Zustaendigkeit und Nachweis sind im Ordner hinterlegt.`;
}

export interface Bauoptionen {
  /** Wie viele Deckel-Ablenker. Vorgabe: {@link DECKEL_ABLENKUNG}. */
  deckelAblenkung?: number;
  /**
   * Wie viele Füllzeilen. Vorgabe: so viele, dass {@link GESAMT} herauskommt.
   *
   * RUNDE 2: Der Kalibrierlauf braucht denselben Bestand — dasselbe Zieldokument, dieselben zwanzig
   * Ablenker, dieselben fünfzig fremden vertraulichen Einträge, dieselbe Herkunftsgruppe —, aber
   * nicht dieselbe LÄNGE: er verstellt und nimmt zurück, jede Phase ein eigener Browserlauf, und
   * 9758 Füllzeilen kosteten dabei nur Zeit, ohne an einer einzigen Aussage etwas zu ändern. Der
   * Füllbestand ist genau das, was die Grösse macht, und genau das, was der Kalibrierlauf nicht
   * braucht. Er wird deshalb hier klein gestellt — und NICHT durch einen zweiten, ähnlichen Bauplan
   * ersetzt, der dann neben diesem stünde und auseinanderliefe.
   */
  fuellbestand?: number;
}

/**
 * Der vollständige Bauplan des Bestands.
 *
 * DETERMINISTISCH: keine Uhr, kein Zufall. Zweimal mit denselben Optionen aufgerufen entsteht
 * Zeichen für Zeichen derselbe Plan — sonst wäre der Kennungshash im Manifest eine Aussage über
 * nichts.
 */
export function bauplan(optionen: Bauoptionen = {}): Eintragsplan[] {
  const deckelAblenkung = optionen.deckelAblenkung ?? DECKEL_ABLENKUNG;
  const fuellbestand = optionen.fuellbestand ?? FUELLBESTAND;
  const plan: Eintragsplan[] = [];

  // ── 1 · DAS ZIELDOKUMENT ───────────────────────────────────────────────────────────────────────
  plan.push({
    gruppe: "ziel",
    eingabe: {
      title: ZIEL_TITEL,
      statement: `Dokumentnummer ${ZIEL_KENNUNG}. Der Kaltstart folgt der Reihenfolge in Abschnitt 3.`,
      type: ART,
      category: "Handbuch",
      author: ZIEL_AUTOR,
      tags: [HERKUNFT],
      confidentiality: "intern",
      // Die sichtbare Quelle. `id` ist fest vergeben und nicht gewürfelt — der Bauplan ist
      // deterministisch, und eine zufällige Kennung machte den Kennungshash zur Aussage über nichts.
      sources: [
        {
          id: "quelle-4271-01",
          label: ZIEL_QUELLE,
          url: null,
          excerpt: null,
          kind: "external",
          peerValidated: false,
          author: ZIEL_AUTOR,
          // Ein FESTER Zeitpunkt, keine Uhr: der Bauplan muss deterministisch bleiben.
          at: "2026-09-17T00:00:00.000Z",
        },
      ],
      bodyHtml: `<p>Vor dem Kaltstart wird die ${VOLLTEXT_BEGRIFF} geloest und der Pruefstift entnommen.</p><p>Erst danach faehrt die Presse an; die Reihenfolge ist zwingend.</p>`,
    },
    // Trust 1: der Eintrag, den die Ordnung `validiert ↓, trust ↓, koId` als ERSTEN wegwirft.
    validierung: { trust: 1, status: "validiert" },
  });

  // ── 2 · 20 ÄHNLICH BENANNTE ABLENKER, OHNE den gesuchten Begriff ──────────────────────────────
  // Die Nummern 7701–7720 ohne 7713 — dicht an der Zielkennung, aber nie ihr Teilstring.
  let nummer = 7701;
  for (let i = 0; i < ABLENKER; i += 1) {
    if (nummer === 7713) {
      nummer += 1;
    }
    const presse = i < 6 ? i + 1 : i + 2; // Presse 1–6 und 8–21; „Presse 7" bleibt dem Ziel
    plan.push({
      gruppe: "ablenker",
      eingabe: {
        title: `Betriebsanweisung Kaltstart Presse ${presse}`,
        statement: `Dokumentnummer BA-4271-0${nummer}. Der Kaltstart folgt der Reihenfolge in Abschnitt 3.`,
        type: ART,
        category: "Handbuch",
        author: ZIEL_AUTOR,
        bodyHtml:
          "<p>Vor dem Kaltstart wird der Pruefstift entnommen und das Protokoll gezeichnet.</p>",
      },
      validierung: { trust: 90, status: "validiert" },
    });
    nummer += 1;
  }

  // ── 3 · DIE DECKEL-ABLENKUNG: Begriff NUR im Fliesstext, hoher Trust ──────────────────────────
  for (let i = 0; i < deckelAblenkung; i += 1) {
    const nr = String(i).padStart(4, "0");
    plan.push({
      gruppe: "deckel",
      eingabe: {
        title: `Sitzungsnotiz ${nr}`,
        statement: `Beschluss ${nr}.`,
        type: ART,
        category: "Protokoll",
        author: "protokoll-4271",
        bodyHtml: `<p>Im Protokoll wurde die ${VOLLTEXT_BEGRIFF} beilaeufig erwaehnt (${nr}).</p>`,
      },
      validierung: { trust: 90, status: "validiert" },
    });
  }

  // ── 4 · DIE FREMDEN VERTRAULICHEN EINTRÄGE — die Negativkontrolle ─────────────────────────────
  // Sie tragen den Begriff im TITEL und in der AUSSAGE und hätten damit die stärkste Treffergüte.
  // Erscheinen sie trotzdem nicht, ist das eine Aussage über die Abschirmung und nicht über den Zufall.
  for (let i = 0; i < FREMDE_VERTRAULICHE; i += 1) {
    const nr = String(i).padStart(2, "0");
    plan.push({
      gruppe: "fremd-vertraulich",
      eingabe: {
        title: `Vertrauliche Notiz zur ${VOLLTEXT_BEGRIFF} ${nr}`,
        statement: `${GEHEIMWORT}: die ${VOLLTEXT_BEGRIFF} wurde am Pruefstand ${nr} nachgemessen.`,
        type: ART,
        category: "Vertraulich",
        author: FREMDER_EIGNER,
        confidentiality: "vertraulich",
        bodyHtml: `<p>${GEHEIMWORT} — Messreihe zur ${VOLLTEXT_BEGRIFF}, Pruefstand ${nr}.</p>`,
      },
      validierung: { trust: 95, status: "validiert" },
    });
  }

  // ── 5 · DIE HERKUNFTSGRUPPE — dasselbe Schlagwort wie das Ziel ────────────────────────────────
  for (let i = 0; i < HERKUNFTSGRUPPE; i += 1) {
    const nr = String(i).padStart(2, "0");
    plan.push({
      gruppe: "herkunftsgruppe",
      eingabe: {
        title: `Linienbericht ${nr}`,
        statement: `Bericht ${nr} aus dem laufenden Betrieb.`,
        type: ART,
        category: "Handbuch",
        author: "linie-4271",
        tags: [HERKUNFT],
        bodyHtml: `<p>Der Bericht ${nr} haelt den Betriebsstand fest.</p>`,
      },
      validierung: { trust: 50, status: "validiert" },
    });
  }

  // ── 6 · DER FÜLLBESTAND ───────────────────────────────────────────────────────────────────────
  for (let i = 0; i < fuellbestand; i += 1) {
    const nr = String(i).padStart(5, "0");
    plan.push({
      gruppe: "fuellbestand",
      eingabe: {
        title: `Wissenseintrag ${nr}`,
        statement: fuellsatz(nr),
        type: ART,
        category: "Betrieb",
        author: "bestand-4271",
        bodyHtml: `<p>${fuellsatz(nr)}</p>`,
      },
    });
  }

  return plan;
}

// ------------------------------------------------------------------------------------------------
// DAS SEEDMANIFEST
// ------------------------------------------------------------------------------------------------

export interface Seedmanifest {
  /** VOR dem Lauf festgelegt (Konstanten oben) — nie aus einem Ergebnis abgeleitet. */
  erwartet: {
    zielKennung: string;
    zielTitel: string;
    volltextBegriff: string;
    herkunft: string;
    geheimwort: string;
    anzahl: number;
    gruppen: Record<Gruppe, number>;
  };
  /**
   * Die TECHNISCHE Kennung des Zieldokuments.
   *
   * Sie kann vorab nicht festgelegt werden — `KoService.create` vergibt sie. Sie stammt deshalb aus
   * dem ANLEGEvorgang des Zieldokuments und wird VOR dem ersten Suchlauf festgeschrieben; der
   * Aufrufer hält sie zusätzlich gegen eine unabhängige Lesung über die vorab festgelegte fachliche
   * Kennung (`SELECT … WHERE data->>'statement' LIKE '%<Kennung>%'`). Sie stammt damit nie aus einem
   * Suchergebnis (Auftrag §5.1).
   */
  zielKoId: string;
  /** Aus `SELECT count(*) FROM kos` gelesen — nicht aus der Absicht. */
  gespeicherteAnzahl: number;
  /**
   * sha256 über alle erzeugten Kennungen — verkettet in der Reihenfolge {@link GRUPPEN_REIHENFOLGE}.
   *
   * RUNDE 3: Bis hierher war es die ERZEUGUNGSreihenfolge. Die steht aber nirgends im Manifest, und
   * damit war der Hash aus dem exportierten Manifest allein NICHT nachrechenbar — genau das hat BEN
   * verlangt („10.000 Kennungen und nachgerechneter Hash"). Die Gruppenreihenfolge ist eine feste,
   * hier abgelegte Konstante; wer das Manifest hat, hat damit alles, was er zum Nachrechnen braucht,
   * und es steht keine einzige Kennung doppelt in der Datei.
   */
  kennungsHash: string;
  /** Wie lange der Seed gebraucht hat. */
  dauerMs: { anlegen: number; validieren: number };
  erzeugtAm: string;
  /** Die technischen Kennungen je Gruppe — vollständig, damit das Manifest ohne den Lauf lesbar ist. */
  kennungenJeGruppe: Record<Gruppe, string[]>;
  /** Die tatsächlich gezählten Gruppengrössen aus den erzeugten Kennungen. */
  gezaehlteGruppen: Record<Gruppe, number>;
}

export function kennungsHash(ids: readonly string[]): string {
  return createHash("sha256").update(ids.join("\n"), "utf8").digest("hex");
}

/**
 * Die feste Reihenfolge, in der die Gruppen zum Hash verkettet werden.
 *
 * Sie ist Teil des Vertrags und darf sich nicht still ändern: der Torfall `B9` prüft, dass sie jede
 * Gruppe des Bauplans genau einmal nennt.
 */
export const GRUPPEN_REIHENFOLGE: readonly Gruppe[] = [
  "ziel",
  "ablenker",
  "deckel",
  "fremd-vertraulich",
  "herkunftsgruppe",
  "fuellbestand",
];

/** Der Hash, wie ihn jeder nachrechnen kann, der nur das Manifest hat. */
export function kennungsHashAusGruppen(nachGruppe: Record<Gruppe, string[]>): string {
  return kennungsHash(GRUPPEN_REIHENFOLGE.flatMap((g) => nachGruppe[g]));
}

/** Wie viele Kennungen das Manifest insgesamt führt. */
export function kennungsanzahl(nachGruppe: Record<Gruppe, string[]>): number {
  return GRUPPEN_REIHENFOLGE.reduce((summe, g) => summe + nachGruppe[g].length, 0);
}

// ------------------------------------------------------------------------------------------------
// DAS LAUFARTEFAKT — RUNDE 3, BENs EINZIGE KORREKTURPFLICHT.
// ------------------------------------------------------------------------------------------------
//
// WAS RUNDE 2 FALSCH GEMACHT HAT. Das Manifest wurde zwar geschrieben — aber nach `tmpdir()` INNEN
// IM PRÜFCONTAINER. Der Container wird nach dem Lauf weggeräumt; BEN hat nachgemessen und nur
// „tor.out, tor.err, setup.log" exportiert vorgefunden, „kennungenJeGruppe im exportierten Manifest:
// False". Ein Beleg, den nach dem Lauf niemand mehr abrufen kann, ist kein Beleg. Dazu kam, dass die
// stderr-Ausgabe `kennungenJeGruppe` AUSDRÜCKLICH entfernt hat, während Rückgabe und README
// „vollständig auf stderr" behaupteten — der Formfehler, den BEN zu Recht rot genannt hat.
//
// WAS JETZT GILT, und warum genau dieser Ordner:
//
//   `<Arbeitsbaum>/test-results/klarwerk-4271/`
//
// Das ist der VORHANDENE Artefakttransport der Cloudvorrichtung, kein neuer:
//   · `register/cloud/remote_job.py:181-184` packt `<repo>/test-results` nach `test-artifacts.tar.gz`,
//   · `:185` nimmt das Archiv in die gehashte Belegliste auf,
//   · `register/cloud/runner.py:266-269` holt es herüber und prüft seinen sha256.
// Und der Ordner steht in `.gitignore:21` — der Nachlauf-Prüfung „Prüfstand nach Lauf verändert"
// (`remote_job.py:165-167`, `git status --porcelain -uall`) kommt er deshalb nicht in die Quere und
// hinterlässt im Arbeitsbaum keinen Diff.
//
// `KLARWERK_4271_BERICHTE` bleibt als Übersteuerung erhalten.
export const BERICHTORDNER =
  process.env.KLARWERK_4271_BERICHTE?.trim() ||
  join(resolve(process.cwd()), "test-results", "klarwerk-4271");

/** Schreibt ein Laufartefakt als JSON und liefert seinen Pfad zurück. */
export function schreibeBericht(dateiname: string, inhalt: unknown): string {
  mkdirSync(BERICHTORDNER, { recursive: true });
  const pfad = join(BERICHTORDNER, dateiname);
  writeFileSync(pfad, `${JSON.stringify(inhalt, null, 2)}\n`, "utf8");
  return pfad;
}

// ------------------------------------------------------------------------------------------------
// DER ZWEITE WEG: DAS MANIFEST VOLLSTÄNDIG IM GESICHERTEN LOG.
// ------------------------------------------------------------------------------------------------
//
// BEN lässt beides zu: „über den vorhandenen Artefakttransport ODER vollständig im gesicherten Log".
// Hier steht beides — der Transport ist der Hauptweg, das Log der Rückfall, falls ein Prüfplatz das
// Archiv einmal nicht mitbringt. Damit eine 400 KB grosse Zeile unterwegs nicht abgeschnitten wird
// und trotzdem maschinell lesbar bleibt, geht das Manifest in NUMMERIERTEN Stücken hinaus:
//
//   4271-MANIFEST BEGINN <stücke> <zeichen> <sha256 des JSON-Textes>
//   4271-MANIFEST 0001/0104 <stück>
//   …
//   4271-MANIFEST ENDE <sha256 des JSON-Textes>
//
// `manifestAusZeilen` setzt sie wieder zusammen, prüft den Hash und wirft bei jeder Lücke. Der
// Torfall `B9` fährt diesen Rundweg an einem Manifest mit 10.000 Kennungen — und belegt mit einer
// verstellten Stelle, dass die Prüfung die Lücke wirklich sieht.
export const MANIFEST_MARKE = "4271-MANIFEST";
const STUECKGROESSE = 3800;

export function manifestZeilen(manifest: Seedmanifest): string[] {
  const text = JSON.stringify(manifest);
  const pruefsumme = createHash("sha256").update(text, "utf8").digest("hex");
  const stuecke: string[] = [];
  for (let i = 0; i < text.length; i += STUECKGROESSE) {
    stuecke.push(text.slice(i, i + STUECKGROESSE));
  }
  const gesamt = String(stuecke.length).padStart(4, "0");
  return [
    `${MANIFEST_MARKE} BEGINN ${stuecke.length} ${text.length} ${pruefsumme}`,
    ...stuecke.map((s, i) => `${MANIFEST_MARKE} ${String(i + 1).padStart(4, "0")}/${gesamt} ${s}`),
    `${MANIFEST_MARKE} ENDE ${pruefsumme}`,
  ];
}

/** Setzt das Manifest aus den Logzeilen zusammen — und weist jede Lücke aus, statt sie zu glätten. */
export function manifestAusZeilen(zeilen: readonly string[]): Seedmanifest {
  const marken = zeilen.filter((z) => z.includes(MANIFEST_MARKE));
  const beginn = marken.find((z) => z.includes(`${MANIFEST_MARKE} BEGINN `));
  if (!beginn) {
    throw new Error(`${MANIFEST_MARKE}: keine BEGINN-Zeile im Protokoll.`);
  }
  const kopf = beginn.slice(beginn.indexOf(`${MANIFEST_MARKE} BEGINN `)).split(" ");
  const erwarteteStuecke = Number(kopf[2]);
  const erwarteteZeichen = Number(kopf[3]);
  const erwarteterHash = kopf[4] ?? "";
  const teile = new Map<number, string>();
  for (const zeile of marken) {
    const ab = zeile.indexOf(`${MANIFEST_MARKE} `);
    const rest = zeile.slice(ab + MANIFEST_MARKE.length + 1);
    const treffer = /^(\d{4})\/(\d{4}) /.exec(rest);
    if (!treffer) {
      continue;
    }
    teile.set(Number(treffer[1]), rest.slice(treffer[0].length));
  }
  if (teile.size !== erwarteteStuecke) {
    throw new Error(
      `${MANIFEST_MARKE}: ${teile.size} von ${erwarteteStuecke} Stücken im Protokoll — das Manifest ist unvollständig.`,
    );
  }
  let text = "";
  for (let i = 1; i <= erwarteteStuecke; i += 1) {
    const stueck = teile.get(i);
    if (stueck === undefined) {
      throw new Error(`${MANIFEST_MARKE}: Stück ${i} fehlt.`);
    }
    text += stueck;
  }
  if (text.length !== erwarteteZeichen) {
    throw new Error(
      `${MANIFEST_MARKE}: ${text.length} Zeichen statt ${erwarteteZeichen} — das Manifest ist verstümmelt.`,
    );
  }
  const gerechnet = createHash("sha256").update(text, "utf8").digest("hex");
  if (gerechnet !== erwarteterHash) {
    throw new Error(
      `${MANIFEST_MARKE}: Prüfsumme stimmt nicht (gerechnet ${gerechnet}, angekündigt ${erwarteterHash}).`,
    );
  }
  return JSON.parse(text) as Seedmanifest;
}

export function gruppenzaehlung(plan: readonly Eintragsplan[]): Record<Gruppe, number> {
  const leer: Record<Gruppe, number> = {
    ziel: 0,
    ablenker: 0,
    deckel: 0,
    "fremd-vertraulich": 0,
    herkunftsgruppe: 0,
    fuellbestand: 0,
  };
  for (const eintrag of plan) {
    leer[eintrag.gruppe] += 1;
  }
  return leer;
}

/**
 * Wie viele Anlagen gleichzeitig laufen — EINE. Das ist gemessen und nicht vorsichtshalber gewählt.
 *
 * Sechs gleichzeitige `KoService.create` gegen dieselbe PostgreSQL brechen den Seed ab:
 * `duplicate key value violates unique constraint "audit_pkey"` aus `PgAuditRepo.appendOnce`
 * (`services/audit/src/repo-pg.ts:149`, über `KoService.finishCreated`) — gemessen im Cloud-Lauf
 * f87d247ac90e63ee0eff87b3 (Arbeitsprüfung eba074d88be24e5a836dac625929b446).
 *
 * DAS IST EIN BEFUND ÜBER DAS PRODUKT UND WIRD ALS SOLCHER GEMELDET, nicht hier repariert
 * (Auftrag §4): zwei gleichzeitige Anlagen können sich am Prüfprotokoll gegenseitig abschiessen.
 * Der Seed dieses Auftrags geht ihm aus dem Weg, statt ihn zu verdecken — er ist in der Rückgabe
 * unter „PRODUKTFEHLER GEFUNDEN — NICHT REPARIERT" beschrieben.
 *
 * Die Kosten sind tragbar: 8,1 ms je Anlage und 2,2 ms je Validierung (Cloud-Lauf
 * 82c09ffa91d9aba67e2996d9) ergeben für 10.000 Einträge rund 85 Sekunden.
 */
const GLEICHZEITIG = 1;

async function inGruppen<T>(
  aufgaben: readonly (() => Promise<T>)[],
  gleichzeitig: number,
): Promise<T[]> {
  const ergebnis: T[] = new Array(aufgaben.length);
  let naechste = 0;
  const arbeiter = Array.from({ length: Math.min(gleichzeitig, aufgaben.length) }, async () => {
    for (;;) {
      const i = naechste;
      naechste += 1;
      const aufgabe = aufgaben[i];
      if (!aufgabe) {
        return;
      }
      ergebnis[i] = await aufgabe();
    }
  });
  await Promise.all(arbeiter);
  return ergebnis;
}

export interface Seedergebnis {
  manifest: Seedmanifest;
  /** Die technischen Kennungen je Gruppe — für die Messungen, nicht für die Suche. */
  nachGruppe: Record<Gruppe, string[]>;
}

/**
 * Legt den Bestand über den PRODUKTWEG an und liefert das Manifest.
 *
 * `zaehle` liest die tatsächlich gespeicherte Zahl aus der Datenbank; der Aufrufer reicht sie
 * herein, damit diese Datei kein `pg` kennen muss (Modulgrenze wie überall im Haus).
 */
export async function seedeGrossbestand(
  ko: KoService,
  zaehle: () => Promise<number>,
  plan: readonly Eintragsplan[] = bauplan(),
): Promise<Seedergebnis> {
  const t0 = Date.now();
  const ids = await inGruppen(
    plan.map((eintrag) => async () => (await ko.create(eintrag.eingabe)).id),
    GLEICHZEITIG,
  );
  const anlegen = Date.now() - t0;

  const t1 = Date.now();
  const zuValidieren = plan
    .map((eintrag, i) => ({ eintrag, id: ids[i] as string }))
    .filter((p) => p.eintrag.validierung !== undefined);
  await inGruppen(
    zuValidieren.map(
      (p) => () =>
        ko.setValidationState(
          p.id,
          p.eintrag.validierung as { trust: number; status: "validiert" },
        ),
    ),
    GLEICHZEITIG,
  );
  const validieren = Date.now() - t1;

  const nachGruppe: Record<Gruppe, string[]> = {
    ziel: [],
    ablenker: [],
    deckel: [],
    "fremd-vertraulich": [],
    herkunftsgruppe: [],
    fuellbestand: [],
  };
  plan.forEach((eintrag, i) => {
    nachGruppe[eintrag.gruppe].push(ids[i] as string);
  });

  const zielKoId = nachGruppe.ziel[0];
  if (!zielKoId) {
    throw new Error("JOB 4271: der Bauplan hat kein Zieldokument erzeugt.");
  }

  return {
    nachGruppe,
    manifest: {
      erwartet: {
        zielKennung: ZIEL_KENNUNG,
        zielTitel: ZIEL_TITEL,
        volltextBegriff: VOLLTEXT_BEGRIFF,
        herkunft: HERKUNFT,
        geheimwort: GEHEIMWORT,
        anzahl: plan.length,
        gruppen: gruppenzaehlung(plan),
      },
      zielKoId,
      gespeicherteAnzahl: await zaehle(),
      // Aus den GRUPPEN gerechnet, nicht aus `ids`: nur so kann jeder, der das exportierte Manifest
      // liest, denselben Hash nachrechnen (Runde 3, BENs Korrekturpflicht).
      kennungsHash: kennungsHashAusGruppen(nachGruppe),
      dauerMs: { anlegen, validieren },
      erzeugtAm: new Date().toISOString(),
      kennungenJeGruppe: nachGruppe,
      gezaehlteGruppen: {
        ziel: nachGruppe.ziel.length,
        ablenker: nachGruppe.ablenker.length,
        deckel: nachGruppe.deckel.length,
        "fremd-vertraulich": nachGruppe["fremd-vertraulich"].length,
        herkunftsgruppe: nachGruppe.herkunftsgruppe.length,
        fuellbestand: nachGruppe.fuellbestand.length,
      },
    },
  };
}
