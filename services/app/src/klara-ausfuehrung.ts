// ================================================================================================
// produkt:20261008:klara-aktionen (Klara 05) · Nacharbeit 2 — DIE GEBUNDENE AUSFÜHRUNG AM SERVER.
// ================================================================================================
//
// Bens Befund: „Die Auftragsgrenze kontrolliert Protokollübergänge, nicht die tatsächlichen
// Werkzeugaufrufe." Deshalb führt ab hier der SERVER jeden Schritt aus, der etwas ändert oder einen
// Erfolg behauptet — gebunden an Auftrag, Fassung, Planschritt und Ziel:
//
//   1. Der Planschritt (Aktion, Ziel, Inhalt) kommt aus dem gespeicherten Auftrag
//      (`klara-auftrag.ts`, `plan`). Aus dem Netz kommt nur die Schrittnummer und die Fassung.
//   2. Der Schritt wird am Server BEGONNEN — die Grenze prüft Aktion, Ziel, Fassung, Abbruch.
//   3. Ausgeführt wird über die VORHANDENEN Türen der Anwendung, mit der Anmeldung der Person
//      (`rufe` = `app.inject` mit ihren Kopfzeilen): `/api/drafts` (Rechte, Sichtbarkeit,
//      Vorgangsschlüssel, `expectedUpdatedAt`), `/api/kos/:id`, die Aufgabenquellen. Kein zweites
//      Rechte- oder Speichersystem.
//   4. Das Ergebnis wird am Server NACHGELESEN und erst dann „gespeichert“ eingetragen. Ein
//      Fehlschlag steht mit seinem Grundschlüssel da.
//
// Beim Öffnen (Objekt, Entwurf, Aufgabe) bestätigt der Server Zielidentität und aktuelle Berechtigung
// (`geprueft`). Den Bildschirm wechselt der Browser; abschliessen darf er den Schritt nur mit diesem
// bestätigten Ziel. Nacharbeit 4: „Aufgabe bearbeiten“ führt die im Plan GEKLÄRTE Fachaktion aus
// (Priorität/Zuweisung an einer Lücke, Eskalation an einem Konflikt) und liest sie nach; „nur
// öffnen“ bleibt der getrennte Öffnen-Weg.
//
// Rückgängig läuft ebenfalls hier: mit dem nachgelesenen Ergebnisstand als erwartetem Stand am
// vorhandenen Lösch- bzw. Speicherweg. Wurde der Entwurf inzwischen geändert, bleibt er erhalten.
//
// produkt:20261010:assistenz-aktionen-verlauf-ruecknahme (PV-02):
//   · Vor der Wirkung hält der Server den VORHERIGEN Stand des Ziels fest (`vorherStand`), nach einer
//     Rücknahme den neuen (`ruecknahmeStand`) — beides nachlesbar nach dem Neuladen.
//   · Vor einer Rücknahme liest er das Ziel mit den Rechten der Person: fehlt es oder das Recht, steht
//     das da (`ziel_fehlt`); weicht der Stand ab, erklärt der Konflikt eigenen und aktuellen Stand und
//     den Korrekturweg (`konflikt`). Der Standvergleich am Speicherweg bleibt die letzte Sicherung.
//   · Ausführung und Rücknahme DESSELBEN Schritts laufen in diesem Prozess nacheinander. Ein zweiter,
//     gleichzeitiger Versuch sieht danach den festgehaltenen Stand und antwortet `wiederholt` — er
//     wirkt nicht doppelt und meldet eine geschehene Wirkung nicht als gescheitert.
import { htmlToPlainText } from "../../structure";
import { aktionskennung, vertragFuer } from "./klara-aktionsverlauf";
import {
  KLARA_KOERPER_MAX,
  KLARA_WIEDERHOLBARE_FEHLER,
  type KlaraAufgabenaktion,
  type KlaraAuftrag,
  type KlaraAuftragErgebnis,
  type KlaraAuftragHerkunft,
  type KlaraAuftragSchritt,
  type KlaraAuftragZiel,
  type KlaraEntwurfsfeld,
  type KlaraPlanSchritt,
  type KlaraSchreibwirkung,
  zielErlaubt,
} from "./klara-auftrag";
import { liesAuftragsnotiz } from "./klara-auftragsnotiz";
import { type KlaraGespraechDienst, KlaraGespraechFehler } from "./klara-gespraech";

/** Ein Aufruf einer vorhandenen Tür der Anwendung — mit der Anmeldung der Person. */
export type KlaraRufe = (
  methode: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  rumpf?: unknown,
) => Promise<{ status: number; daten: unknown }>;

type Ergebnis = { auftrag: KlaraAuftrag; schritt: KlaraAuftragSchritt; wiederholt: boolean };

/** BPA-06: `null` = darf wirken; sonst der Grund, warum nicht. */
export type KlaraVorWirkung = (
  kontoId: string,
  herkunft: KlaraAuftragHerkunft,
) => Promise<string | null>;

interface Entwurf {
  id: string;
  createdAt?: string;
  updatedAt: string;
  createOperation?: { id: string; actor: string };
  payload: { title?: string; statement?: string; bodyHtml?: unknown } & EntwurfsOrdnung;
}

type EntwurfsOrdnung = Partial<Record<KlaraEntwurfsfeld, unknown>>;

/**
 * BPA-06 Nacharbeit 45: der Volltext als Körper — je Zeile ein Absatz, Zeichen maskiert. Derselbe
 * Entwurfsweg bereinigt ihn danach wie jeden Körper.
 */
export function koerperAlsHtml(koerper: string): string {
  const maskiert = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return koerper
    .split(/\r\n?|\n/)
    .map((zeile) => zeile.trim())
    .filter((zeile) => zeile !== "")
    .map((zeile) => `<p>${maskiert(zeile)}</p>`)
    .join("");
}

/** BPA-06 Nacharbeit 45: steht der Volltext (Leerraum gefaltet) im nachgelesenen Körper? */
export function koerperSteht(bodyHtml: unknown, koerper: string): boolean {
  const gelesen = typeof bodyHtml === "string" ? htmlToPlainText(bodyHtml) : "";
  return gelesen.includes(koerper.replace(/\s+/g, " ").trim());
}

/** BPA-06: stehen alle strukturiert gesetzten Ordnungsfelder genau so im nachgelesenen Entwurf? */
function felderStimmen(d: Entwurf, felder: KlaraPlanSchritt["felder"]): boolean {
  return Object.entries(felder ?? {}).every(
    ([name, wert]) => d.payload[name as KlaraEntwurfsfeld] === wert,
  );
}

/** Eine Zeile der vorhandenen Aufgabenquellen (Konflikte, Lücken) — nur, was hier gelesen wird. */
interface AufgabenZeile {
  id?: unknown;
  status?: unknown;
  priority?: unknown;
  assignee?: unknown;
}

function istEntwurf(roh: unknown): roh is Entwurf {
  return (
    typeof roh === "object" &&
    roh !== null &&
    typeof (roh as Entwurf).id === "string" &&
    typeof (roh as Entwurf).updatedAt === "string"
  );
}

function entwurfPfad(id: string): string {
  return `/erfassen?draft=${encodeURIComponent(id)}`;
}

/** produkt:20261008:klara-aufgaben: der Ort einer persönlichen Aufgabe — „Meine Aufgaben", geöffnet. */
function persoenlicheAufgabePfad(id: string): string {
  return `/aufgaben?persoenlich=${encodeURIComponent(id)}`;
}

/** Was die eigene Aufgabenablage beim Nachlesen liefert — nur, was hier gelesen wird. */
interface PersoenlicheAufgabe {
  id: string;
  titel: string;
  status: string;
  prioritaet: string;
  bezug: { art?: unknown; auftragId?: unknown; notizId?: unknown };
}

function persoenlicheAufgabeAus(roh: unknown): PersoenlicheAufgabe | null {
  const a = (roh as { aufgabe?: Partial<PersoenlicheAufgabe> | null } | null)?.aufgabe;
  if (
    typeof a !== "object" ||
    a === null ||
    typeof a.id !== "string" ||
    typeof a.titel !== "string" ||
    typeof a.status !== "string" ||
    typeof a.prioritaet !== "string" ||
    typeof a.bezug !== "object" ||
    a.bezug === null
  ) {
    return null;
  }
  return a as PersoenlicheAufgabe;
}

/** Der Grundschlüssel eines abgelehnten Aufrufs — dieselbe Einteilung wie in der Oberfläche. */
function codeAus(status: number): string {
  if (status === 401) {
    return "anmeldung";
  }
  if (status === 403) {
    return "recht";
  }
  if (status === 404) {
    return "nichtGefunden";
  }
  if (status === 409) {
    return "versionGeaendert";
  }
  return "server";
}

const GRUND: Record<string, string> = {
  anmeldung: "Die Anmeldung ist abgelaufen. Nichts geändert.",
  recht: "Dir fehlt das Recht dafür. Nichts geändert.",
  nichtGefunden: "Das Ziel ist nicht (mehr) vorhanden oder nicht sichtbar. Nichts geändert.",
  versionGeaendert: "Das Ziel wurde seit dem Auftrag geändert. Nichts überschrieben.",
  nichtNachgelesen: "Beim Nachlesen am Server stand die Änderung nicht da.",
  nichtVerfuegbar: "Die Aufgabe ist für dich nicht (mehr) verfügbar. Nichts geöffnet.",
  vorschritt: "Der vorige Schritt hat kein Ergebnis gespeichert — nichts zu öffnen.",
  // EQF-06-K02: keine Abschwächung einer Schutzstufe durch Übernahme in einen Bericht.
  schutzstufe:
    "Eine Quelle ist vertraulich eingestuft. Ihr Inhalt geht nicht in den Bericht. Nichts angelegt.",
  schutzstufeUngeklaert:
    "Eine Quelle ist nicht eingestuft. Sie bleibt geschützt, bis sie eingestuft ist. Nichts angelegt.",
  quellbindung:
    "Eine Quelle ist an Leser oder einen Space gebunden. Ihr Inhalt geht nicht in einen freien Berichtsentwurf. Nichts angelegt.",
  zuLang: "Der Bericht mit seinen Quellen ist zu lang für einen Entwurf. Nichts angelegt.",
  server: "Der Server hat abgelehnt.",
};

/** EQF-06-K02: eine jetzt gelesene Quelle — nur, was in den Bericht übernommen wird. */
export interface GeleseneQuelle {
  readonly id: string;
  readonly titel: string;
  readonly fassung: string;
  readonly pfad: string;
  readonly aussage: string;
}

type QuellFeld =
  | "title"
  | "statement"
  | "version"
  | "confidentiality"
  | "confidentialityProvenance"
  | "quellrechte"
  | "spaceId";
type QuellDaten = Partial<Record<QuellFeld, unknown>>;

const QUELLE_TITEL_MAX = 300;
const QUELLE_AUSSAGE_MAX = 2_000;

/**
 * EQF-06-K02 / G05 (Nacharbeit 52, Ben zu c52b0e61): darf der Inhalt dieser Quelle in einen
 * Bericht? Nur bei einer BEKANNTEN, zweckzulässigen Schutzklasse: ausdrücklich `intern`, am
 * Wissensobjekt selbst gespeichert (`confidentialityProvenance: "ko"`, `discloseConfidentiality`).
 *   · `vertraulich`/`streng_vertraulich` → `schutzstufe` (keine Abschwächung durch Übernahme).
 *   · fehlend, `null`, unbekannter Wert oder unbekannte Herkunft → `schutzstufeUngeklaert`: die
 *     bestehende geschützte Klärung (Entscheidung 16, `sichtbarkeit.ts`: ungeklärt wird wie
 *     vertraulich geschützt, bis jemand einstuft). Es entsteht kein Bericht.
 * H-1 / G05: Der freie Entwurf führt keine dynamischen Quellrechte fort. Deshalb schließen
 * Leserbindung und jeder führende Space die Kopie auch bei ausdrücklich `intern` aus. Die volle
 * vorhandene GET-Quelle trägt diese Fakten; ein aktuelles Leserecht ist keine Kopierbefugnis.
 */
export function quellSchutz(
  d: QuellDaten,
): "frei" | "schutzstufe" | "schutzstufeUngeklaert" | "quellbindung" {
  const rechte = d.quellrechte;
  if (
    typeof d.spaceId === "string" ||
    (rechte !== undefined &&
      (rechte === null ||
        typeof rechte !== "object" ||
        Array.isArray(rechte) ||
        "leser" in rechte ||
        "leserUnvollstaendig" in rechte))
  ) {
    return "quellbindung";
  }
  if (d.confidentiality === "vertraulich" || d.confidentiality === "streng_vertraulich") {
    return "schutzstufe";
  }
  return d.confidentiality === "intern" && d.confidentialityProvenance === "ko"
    ? "frei"
    : "schutzstufeUngeklaert";
}

/**
 * EQF-06-K02: jede Quelle JETZT über den vorhandenen Leseweg mit der Anmeldung der Person — nicht
 * sichtbar oder ohne Recht: der Grund wie bei jedem anderen Ziel, und es entsteht nichts. Übernommen
 * wird nur eine Quelle mit bekannter, zweckzulässiger Schutzklasse (`quellSchutz`).
 */
async function liesQuellen(
  ids: readonly string[],
  rufe: KlaraRufe,
): Promise<{ quellen: GeleseneQuelle[] } | { code: string }> {
  const quellen: GeleseneQuelle[] = [];
  for (const id of ids) {
    const r = await rufe("GET", `/api/kos/${encodeURIComponent(id)}`);
    if (r.status !== 200 || typeof r.daten !== "object" || r.daten === null) {
      return { code: r.status === 200 ? "server" : codeAus(r.status) };
    }
    const d = r.daten as QuellDaten;
    const schutz = quellSchutz(d);
    if (schutz !== "frei") {
      return { code: schutz };
    }
    const titel = typeof d.title === "string" && d.title.trim() ? d.title.trim() : id;
    const aussage = typeof d.statement === "string" ? d.statement.trim() : "";
    quellen.push({
      id,
      titel: titel.slice(0, QUELLE_TITEL_MAX),
      fassung: typeof d.version === "number" ? String(d.version) : "unbekannt",
      pfad: `/wissen/${encodeURIComponent(id)}`,
      aussage: aussage.slice(0, QUELLE_AUSSAGE_MAX),
    });
  }
  return { quellen };
}

/**
 * EQF-06-K02: der Körper mit seinen Quellen — je Quelle eine Zeile mit Titel, Fassung und Ort, darunter
 * ihre Kernaussage. Damit trägt das Ergebnis den Bezug auf genau die gelesenen Fassungen.
 */
export function mitQuellen(koerper: string, quellen: readonly GeleseneQuelle[]): string {
  const zeilen = quellen.flatMap((q, i) => [
    `Quelle ${i + 1}: ${q.titel} · Fassung ${q.fassung} · ${q.pfad}`,
    ...(q.aussage ? [q.aussage] : []),
  ]);
  return [koerper.trim(), ...zeilen].filter((z) => z !== "").join("\n");
}

/** EQF-06-K02: die Zeile, an der der Bezug einer Quelle im Ergebnis erkennbar ist. */
export function quellZeile(id: string, fassung?: string): string {
  const ort = `/wissen/${encodeURIComponent(id)}`;
  return fassung === undefined ? ort : `Fassung ${fassung} · ${ort}`;
}

function anwenden(payload: Entwurf["payload"], plan: KlaraPlanSchritt): Entwurf["payload"] {
  const a = plan.aenderung;
  if (a?.art === "ergaenzen") {
    return { statement: `${(payload.statement ?? "").trim()} ${a.text}`.trim() };
  }
  return { title: a?.art === "umbenennen" ? a.titel : (payload.title ?? "") };
}

function angewandt(payload: Entwurf["payload"], plan: KlaraPlanSchritt): boolean {
  const a = plan.aenderung;
  if (!a) {
    return false;
  }
  return a.art === "ergaenzen"
    ? (payload.statement ?? "").includes(a.text)
    : (payload.title ?? "") === a.titel;
}

function gleich(a: KlaraAuftragZiel, b: KlaraAuftragZiel): boolean {
  return a.art === b.art && (a.id === null && b.id === null ? a.titel === b.titel : a.id === b.id);
}

export class KlaraAusfuehrung {
  /** PV-02-06: je Schritt die gerade laufende Ausführung oder Rücknahme in diesem Prozess. */
  private readonly laufend = new Map<string, Promise<unknown>>();

  /**
   * `vorWirkung` (BPA-06): für einen Auftrag mit Routinenherkunft die Prüfung des AKTUELLEN Stands
   * der Routine unmittelbar vor der Wirkung — pausiert, gelöscht oder in anderer Fassung gibt einen
   * Grund zurück, und es geschieht nichts. Fehlt die Prüfung, wird ein solcher Auftrag nicht
   * ausgeführt (fail-closed). Aufträge ohne Herkunft sind davon unberührt.
   */
  constructor(
    private readonly dienst: KlaraGespraechDienst,
    private readonly vorWirkung?: KlaraVorWirkung,
  ) {}

  /** Arbeiten an DEMSELBEN Schritt nacheinander — ein zweiter Versuch wartet auf den ersten. */
  private async nacheinander<T>(schluessel: string, f: () => Promise<T>): Promise<T> {
    const vorher = this.laufend.get(schluessel) ?? Promise.resolve();
    const jetzt = vorher.then(f, f);
    const gemerkt = jetzt.catch(() => undefined);
    this.laufend.set(schluessel, gemerkt);
    try {
      return await jetzt;
    } finally {
      if (this.laufend.get(schluessel) === gemerkt) {
        this.laufend.delete(schluessel);
      }
    }
  }

  /**
   * Führt den Planschritt `nr` aus. Derselbe Schlüssel ist derselbe Schritt: ist er schon
   * gespeichert, abgeschlossen oder gescheitert, antwortet der Server mit dem festgehaltenen Stand
   * (`wiederholt`) und führt nichts erneut aus.
   */
  fuehreAus(
    kontoId: string,
    gespraechId: string,
    auftragId: string,
    schluessel: string,
    eingabe: { nr?: unknown; auftragFassung?: unknown },
    rufe: KlaraRufe,
    /**
     * BPA-06 (Nacharbeit 36): nur die Zeitsteuerung der Routinen setzt `wiederholeVoruebergehend`
     * — ein mit `server`/`anmeldung` gescheiterter Schritt beginnt dann unter demselben Schlüssel
     * neu. Ohne Angabe gilt unverändert: gescheitert ist endgültig.
     */
    optionen: { wiederholeVoruebergehend?: boolean } = {},
  ): Promise<Ergebnis> {
    return this.nacheinander(`${kontoId}|${gespraechId}|${auftragId}|${schluessel}`, () =>
      this.fuehreAusAllein(kontoId, gespraechId, auftragId, schluessel, eingabe, rufe, optionen),
    );
  }

  private async fuehreAusAllein(
    kontoId: string,
    gespraechId: string,
    auftragId: string,
    schluessel: string,
    eingabe: { nr?: unknown; auftragFassung?: unknown },
    produktRufe: KlaraRufe,
    optionen: { wiederholeVoruebergehend?: boolean },
  ): Promise<Ergebnis> {
    const a = await this.dienst.auftrag(kontoId, gespraechId, auftragId);
    const plan = a.plan ?? [];
    if (plan.length === 0) {
      throw new KlaraGespraechFehler(
        409,
        "ohne_plan",
        "Dieser Auftrag hat keinen gebundenen Plan — der Server führt ihn nicht aus.",
      );
    }
    const nr = typeof eingabe.nr === "number" ? eingabe.nr : Number.NaN;
    const p = plan.find((x) => x.nr === nr);
    if (!p) {
      throw new KlaraGespraechFehler(
        409,
        "ausserhalb_auftrag",
        "Dieser Schritt steht nicht (mehr) im Plan des Auftrags.",
      );
    }
    const vorhanden = a.schritte.find((s) => s.schluessel === schluessel);
    const erneut =
      optionen.wiederholeVoruebergehend === true &&
      vorhanden?.stand === "fehlgeschlagen" &&
      KLARA_WIEDERHOLBARE_FEHLER.includes(vorhanden.fehlerCode ?? "");
    if (vorhanden && vorhanden.nr !== nr) {
      throw new KlaraGespraechFehler(
        409,
        "schluessel_belegt",
        "Dieser Schlüssel gehört zu einem anderen Planschritt.",
      );
    }

    if (
      vorhanden &&
      !erneut &&
      (vorhanden.stand !== "begonnen" ||
        (vorhanden.geprueft && (p.aktion === "oeffnen" || p.aktion === "aufgabe_bearbeiten")))
    ) {
      return { auftrag: a, schritt: vorhanden, wiederholt: true };
    }
    // Neue Wirkungen bleiben an die heutige Routine gebunden; ein bereits begonnener
    // unbekannter Ausgang darf sein tatsächliches Original weiterhin rein lesend klären.
    const pruefeHerkunft = async () => {
      if (a.herkunft) {
        const grund = this.vorWirkung
          ? await this.vorWirkung(kontoId, a.herkunft)
          : "Die Herkunft dieses Auftrags lässt sich nicht prüfen. Nichts geändert.";
        if (grund) throw new KlaraGespraechFehler(409, "herkunft_gesperrt", grund);
      }
    };
    if (!vorhanden || erneut) await pruefeHerkunft();

    // Das Ziel: aus dem Plan — bei „… und öffne ihn“ das NACHGELESENE Ergebnis des Vorschritts.
    let ziel: KlaraAuftragZiel | null = p.ziel;
    if (p.ausSchritt !== null) {
      const quelle = a.schritte.find((s) => s.nr === p.ausSchritt);
      const e = quelle?.ergebnis;
      // Klara 07: eine persönliche Aufgabe ist kein Ziel dieses Öffnen-Wegs (`bestaetige` kennt
      // Wissensobjekt, Entwurf und gemeinsame Aufgabe) — sie wird an ihrem Ort geöffnet.
      ziel =
        e &&
        e.art !== "erinnerung" &&
        (p.aktion === "erinnerung_anlegen"
          ? e.art === "persoenliche_aufgabe"
          : e.art !== "persoenliche_aufgabe") &&
        (quelle?.stand === "gespeichert" || quelle?.stand === "abgeschlossen")
          ? { art: e.art, id: e.id, titel: e.titel, stand: e.stand, pfad: e.pfad }
          : null;
    }
    const zielZumBeginn: KlaraAuftragZiel = ziel ?? {
      art: "neuer_entwurf",
      id: null,
      titel: plan.find((x) => x.nr === p.ausSchritt)?.ziel?.titel ?? "?",
      stand: null,
      pfad: null,
    };
    const basis = { nr: p.nr, aktion: p.aktion, ziel: zielZumBeginn };
    const begonnen = await this.dienst.setzeAuftragsschritt(
      kontoId,
      gespraechId,
      auftragId,
      schluessel,
      { ...basis, auftragFassung: eingabe.auftragFassung, stand: "begonnen" },
      "server",
      erneut ? { wiederholen: true } : {},
    );
    // PV-02-06: hat ein anderer Versuch (etwa eine zweite Instanz) den Schritt eben begonnen, wirkt
    // dieser nicht noch einmal — er antwortet mit dem festgehaltenen Stand.
    if (begonnen.wiederholt && !vorhanden) {
      return { ...begonnen, wiederholt: true };
    }
    const fassung = begonnen.schritt.auftragFassung;
    const notizQuelle =
      p.notizQuelle ??
      (p.aktion === "erinnerung_anlegen"
        ? plan.find((s) => s.nr === p.ausSchritt)?.notizQuelle
        : undefined);

    const rufe: KlaraRufe = async (methode, url, rumpf) => {
      if (methode !== "GET") {
        if (notizQuelle) await liesAuftragsnotiz(notizQuelle, produktRufe);
        // Nach asynchronem Quellenlesen muss auch die Routine noch gelten. Der Stop-/Grenzreadback
        // folgt nach dieser Prüfung, unmittelbar vor dem bestehenden Produktaufruf.
        await pruefeHerkunft();
        const aktuell = await this.dienst.auftrag(kontoId, gespraechId, auftragId);
        if (aktuell.abgebrochenAm || aktuell.unterbrochenAm) {
          throw new KlaraGespraechFehler(
            409,
            aktuell.abgebrochenAm ? "abgebrochen" : "unterbrochen",
            "Der Auftrag wurde angehalten. Keine weitere Änderung begonnen; bereits ausgelöste Wirkungen bleiben erhalten.",
          );
        }
        if (
          !aktuell.erlaubteAktionen.includes(p.aktion) ||
          !zielErlaubt(aktuell, zielZumBeginn) ||
          (notizQuelle && !aktuell.erlaubteQuellen.includes(`notiz:${notizQuelle.id}`))
        ) {
          throw new KlaraGespraechFehler(
            409,
            "ausserhalb_auftrag",
            "Die aktuelle Auftragsgrenze erlaubt diese Änderung nicht mehr.",
          );
        }
      }
      return produktRufe(methode, url, rumpf);
    };

    const melde = (
      stand: "gespeichert" | "abgeschlossen" | "fehlgeschlagen",
      zusatz: {
        ergebnis?: KlaraAuftragErgebnis;
        ruecknehmbar?: boolean;
        code?: string;
        hinweis?: string;
      } = {},
    ): Promise<Ergebnis> =>
      this.dienst.setzeAuftragsschritt(
        kontoId,
        gespraechId,
        auftragId,
        schluessel,
        {
          ...basis,
          auftragFassung: fassung,
          stand,
          ...(zusatz.ergebnis ? { ergebnis: zusatz.ergebnis } : {}),
          ...(zusatz.ruecknehmbar ? { ruecknehmbar: true } : {}),
          ...(stand === "fehlgeschlagen"
            ? { grund: GRUND[zusatz.code ?? "server"] ?? GRUND.server }
            : {}),
        },
        "server",
        stand === "fehlgeschlagen"
          ? { fehlerCode: zusatz.code ?? "server" }
          : zusatz.hinweis
            ? { fehlerCode: zusatz.hinweis }
            : {},
      );
    const scheitert = (code: string): Promise<Ergebnis> => melde("fehlgeschlagen", { code });
    // Nacharbeit 4 (Ben): die Schreibwirkung ist bekannt, das Nachlesen gelang (noch) nicht. Der
    // Schritt bleibt „begonnen“ mit seiner Ergebniskennung (`schreibwirkung`) — ungeklärt, nicht
    // gescheitert. Eine Wiederholung liest nur nach.
    const merke = (wirkung: KlaraSchreibwirkung) =>
      this.dienst.merkeSchreibwirkung(kontoId, gespraechId, auftragId, schluessel, wirkung);
    // Nacharbeit 5 (Ben): nachgelesen wird gegen den vom Schreibweg BESTÄTIGTEN eigenen Stand. Steht
    // inzwischen ein anderer Stand da (fremde Änderung zwischen Speichern und Nachlesen) oder ist der
    // eigene unbekannt, ist die Wirkung gespeichert, aber NICHT rücknehmbar: der fremde Stand wird nie
    // Rücknahmebasis — Rückgängig könnte sonst eine fremde Änderung überschreiben oder löschen.
    const fremdstand = (id: string, titel: string, eigenerStand: string | null) =>
      melde("gespeichert", {
        ergebnis: { art: "entwurf", id, titel, stand: eigenerStand, pfad: entwurfPfad(id) },
        hinweis: "fremdstand",
      });
    const ungeklaert = async (): Promise<Ergebnis> => {
      await this.dienst.merkeStaende(kontoId, gespraechId, auftragId, schluessel, {
        ausgangUnklar: true,
      });
      const jetzt = await this.dienst.auftrag(kontoId, gespraechId, auftragId);
      const schritt = jetzt.schritte.find((s) => s.schluessel === schluessel);
      if (!schritt) {
        throw new KlaraGespraechFehler(404, "unbekannt", "Schritt nicht gefunden.");
      }
      return { auftrag: jetzt, schritt, wiederholt: false };
    };
    const bekannt = vorhanden?.schreibwirkung ?? null;
    // PV-02-03 (Nacharbeit 3): der nachgelesene Inhalt am eigenen Stand — neben `vorher` der
    // vergleichbare neue Inhalt. Nur im eigenen Gespräch, nie im Prüfprotokoll.
    const merkeNachher = (d: Entwurf) =>
      this.dienst.merkeStaende(kontoId, gespraechId, auftragId, schluessel, {
        nachher: { title: d.payload.title ?? "", statement: d.payload.statement ?? "" },
      });

    if (!ziel) {
      return scheitert("vorschritt");
    }

    if (p.aktion === "entwurf_erstellen") {
      let entwurfId = bekannt?.id ?? null;
      let eigenerStand = bekannt?.stand ?? null;
      // Der Körper, der nachgelesen wird. EQF-06-K02: mit Quellen der beim Anlegen geschriebene —
      // eine Wiederholung nach bekannter Wirkung liest nur nach, gegen den Text des Plans.
      let koerper = p.koerper ?? "";
      const operationId = `klara-auftrag-${auftragId}-${p.nr}`;
      const liesAnlage = async () => {
        const liste = await rufe("GET", "/api/drafts");
        if (liste.status !== 200 || !Array.isArray(liste.daten)) return null;
        return (
          liste.daten.find(
            (d): d is Entwurf =>
              istEntwurf(d) &&
              d.createOperation?.id === operationId &&
              d.createOperation.actor === kontoId,
          ) ?? null
        );
      };
      if (!entwurfId) {
        // Der tatsächliche Vorgang wird zuerst nachgelesen. Nur eine neue Anlage kopiert Quellen.
        const gelesen = vorhanden ? await liesAnlage() : null;
        if (!gelesen && p.quellen && p.quellen.length > 0) {
          const quellen = await liesQuellen(p.quellen, rufe);
          if ("code" in quellen) return scheitert(quellen.code);
          koerper = mitQuellen(koerper, quellen.quellen);
          if (koerper.length > KLARA_KOERPER_MAX) return scheitert("zuLang");
        }
        const angelegt = gelesen
          ? { status: 200, daten: gelesen }
          : await rufe("POST", "/api/drafts", {
              title: ziel.titel,
              ...(p.inhalt ? { statement: p.inhalt } : {}),
              ...(p.felder ?? {}),
              ...(koerper ? { bodyHtml: koerperAlsHtml(koerper) } : {}),
              operationId,
              expectedOwner: kontoId,
            });
        if (angelegt.status >= 500) {
          const bestaetigt = await liesAnlage();
          if (!bestaetigt) return ungeklaert();
          angelegt.status = 200;
          angelegt.daten = bestaetigt;
        }
        if ((angelegt.status !== 201 && angelegt.status !== 200) || !istEntwurf(angelegt.daten)) {
          return scheitert(codeAus(angelegt.status));
        }
        entwurfId = angelegt.daten.id;
        // Eigener Stand nur, wenn die Antwort die frische Anlage ist (Anlage setzt createdAt =
        // updatedAt). Liefert der Vorgangsschlüssel einen inzwischen bearbeiteten Entwurf zurück,
        // ist dessen Stand nicht der eigene.
        const frisch =
          typeof angelegt.daten.createdAt === "string" &&
          angelegt.daten.createdAt === angelegt.daten.updatedAt;
        eigenerStand = frisch ? angelegt.daten.updatedAt : null;
        await merke({
          art: "entwurf",
          id: entwurfId,
          pfad: entwurfPfad(entwurfId),
          stand: eigenerStand,
        });
      }
      const gelesen = await rufe("GET", `/api/drafts/${encodeURIComponent(entwurfId)}`);
      if (gelesen.status === 404) {
        return scheitert("nichtGefunden");
      }
      if (gelesen.status !== 200 || !istEntwurf(gelesen.daten)) {
        return ungeklaert();
      }
      if (eigenerStand === null || gelesen.daten.updatedAt !== eigenerStand) {
        return fremdstand(entwurfId, ziel.titel, eigenerStand);
      }
      if ((gelesen.daten.payload.title ?? "") !== ziel.titel) {
        return scheitert("nichtNachgelesen");
      }
      // BPA-06: jedes gesetzte Ordnungsfeld einzeln nachgelesen — ein anders oder gar nicht
      // übernommener Wert ist kein Erfolg.
      if (!felderStimmen(gelesen.daten, p.felder)) {
        return scheitert("nichtNachgelesen");
      }
      // Nacharbeit 45: der ganze Volltext steht im Körper — sonst kein Erfolg. EQF-06-K02: mit den
      // übernommenen Quellen (Titel, Fassung, Ort, Kernaussage).
      if (koerper && !koerperSteht(gelesen.daten.payload.bodyHtml, koerper)) {
        return scheitert("nichtNachgelesen");
      }
      await merkeNachher(gelesen.daten);
      return melde("gespeichert", {
        ergebnis: {
          art: "entwurf",
          id: gelesen.daten.id,
          titel: ziel.titel,
          stand: gelesen.daten.updatedAt,
          pfad: entwurfPfad(gelesen.daten.id),
        },
        ruecknehmbar: true,
      });
    }

    if (p.aktion === "entwurf_bearbeiten") {
      const id = ziel.id as string;
      // Der gebundene Stand ist der der GRENZE — nicht, was ein Browser jetzt behauptet.
      const gebunden =
        a.erlaubteZiele.find((z) => gleich(z, ziel as KlaraAuftragZiel))?.stand ?? ziel.stand;
      let eigenerStand = bekannt?.stand ?? null;
      if (!bekannt) {
        const jetzt = await rufe("GET", `/api/drafts/${encodeURIComponent(id)}`);
        if (jetzt.status !== 200 || !istEntwurf(jetzt.daten)) {
          return scheitert(codeAus(jetzt.status));
        }
        const schonGeschrieben = Boolean(vorhanden?.vorher) && angewandt(jetzt.daten.payload, p);
        if (!schonGeschrieben) {
          if (!gebunden || jetzt.daten.updatedAt !== gebunden) {
            return scheitert("versionGeaendert");
          }
          await this.dienst.merkeVorher(kontoId, gespraechId, auftragId, schluessel, {
            title: jetzt.daten.payload.title ?? "",
            statement: jetzt.daten.payload.statement ?? "",
          });
          // PV-02-03: der vorherige Stand (Fassungszeit) — nachvollziehbar neben dem neuen.
          await this.dienst.merkeStaende(kontoId, gespraechId, auftragId, schluessel, {
            vorherStand: jetzt.daten.updatedAt,
          });
          const geschrieben = await rufe("PUT", `/api/drafts/${encodeURIComponent(id)}`, {
            ...anwenden(jetzt.daten.payload, p),
            expectedUpdatedAt: gebunden,
          });
          if (geschrieben.status !== 200) {
            return scheitert(codeAus(geschrieben.status));
          }
          // Der vom Speicherweg (Standvergleich) bestätigte eigene Stand.
          eigenerStand = istEntwurf(geschrieben.daten) ? geschrieben.daten.updatedAt : null;
        }
        // Schon geschrieben (frühere, abgerissene Ausführung): der eigene Stand ist unbekannt.
        await merke({ art: "entwurf", id, pfad: entwurfPfad(id), stand: eigenerStand });
      }
      const gelesen = await rufe("GET", `/api/drafts/${encodeURIComponent(id)}`);
      if (gelesen.status === 404) {
        return scheitert("nichtGefunden");
      }
      if (gelesen.status !== 200 || !istEntwurf(gelesen.daten)) {
        return ungeklaert();
      }
      if (eigenerStand === null || gelesen.daten.updatedAt !== eigenerStand) {
        return fremdstand(id, gelesen.daten.payload.title ?? ziel.titel, eigenerStand);
      }
      if (!angewandt(gelesen.daten.payload, p)) {
        return scheitert("nichtNachgelesen");
      }
      await merkeNachher(gelesen.daten);
      return melde("gespeichert", {
        ergebnis: {
          art: "entwurf",
          id,
          titel: gelesen.daten.payload.title ?? ziel.titel,
          stand: gelesen.daten.updatedAt,
          pfad: entwurfPfad(id),
        },
        ruecknehmbar: true,
      });
    }

    // G: derselbe gespeicherte Plan nutzt den freigegebenen D-Dienst; keine zweite Zeitsteuerung.
    if (p.aktion === "erinnerung_anlegen") {
      if (ziel.art !== "persoenliche_aufgabe" || !ziel.id || !p.erinnerung)
        return scheitert("vorschritt");
      const vorgang = aktionskennung(auftragId, p.nr);
      const pfad = (id: string) => `/aufgaben?erinnerung=${encodeURIComponent(id)}`;
      type Erinnerung = {
        id: string;
        titel: string;
        fassung: number;
        vorgang: string;
        bezug: { art: string; aufgabeId?: string };
      };
      const aus = (roh: unknown): Erinnerung | null => {
        const e = (roh as { erinnerung?: Erinnerung } | null)?.erinnerung;
        return e &&
          typeof e.id === "string" &&
          typeof e.titel === "string" &&
          typeof e.fassung === "number" &&
          e.vorgang === vorgang &&
          e.bezug?.art === "aufgabe" &&
          e.bezug.aufgabeId === ziel.id
          ? e
          : null;
      };
      const nachVorgang = async (): Promise<Erinnerung | null> => {
        const r = await rufe("GET", "/api/me/klara/erinnerungen");
        const liste = (r.daten as { erinnerungen?: unknown[] } | null)?.erinnerungen;
        if (r.status !== 200 || !Array.isArray(liste)) return null;
        return liste.map((e) => aus({ erinnerung: e })).find((e) => e !== null) ?? null;
      };
      let e: Erinnerung | null = null;
      if (bekannt?.art === "erinnerung") {
        const r = await rufe("GET", `/api/me/klara/erinnerungen/${encodeURIComponent(bekannt.id)}`);
        e = r.status === 200 ? aus(r.daten) : null;
        if (!e) return ungeklaert();
      } else {
        e = vorhanden ? await nachVorgang() : null;
        if (!e) {
          const r = await rufe("POST", "/api/me/klara/erinnerungen", {
            vorgang,
            titel: ziel.titel,
            bezug: { art: "aufgabe", aufgabeId: ziel.id },
            zeitzone: p.erinnerung.zeitzone,
            zeitplan: { art: "einmalig", datum: p.erinnerung.datum, uhrzeit: p.erinnerung.uhrzeit },
            aktion: "erinnern",
          });
          if (r.status >= 500) e = await nachVorgang();
          else if (r.status !== 201 && r.status !== 200) return scheitert(codeAus(r.status));
          else e = aus(r.daten);
          if (!e) return ungeklaert();
        }
        await merke({ art: "erinnerung", id: e.id, pfad: pfad(e.id), stand: String(e.fassung) });
        const r = await rufe("GET", `/api/me/klara/erinnerungen/${encodeURIComponent(e.id)}`);
        e = r.status === 200 ? aus(r.daten) : null;
        if (!e) return ungeklaert();
      }
      return melde("gespeichert", {
        ergebnis: {
          art: "erinnerung",
          id: e.id,
          titel: e.titel,
          stand: String(e.fassung),
          pfad: pfad(e.id),
        },
      });
    }

    // produkt:20261008:klara-aufgaben (Klara 07): eine persönliche Aufgabe aus diesem Auftrag — über
    // die eigene Ablage (`/api/me/klara/aufgaben`) mit der Anmeldung der Person. Der Vorgangsschlüssel
    // ist die Aktionskennung (Auftrag + Planschritt): eine Wiederholung legt keine zweite Aufgabe an.
    // Den Bezug liest die Ablage selbst aus dem eigenen Gespräch; hier wird nur nachgelesen, dass die
    // Aufgabe wirklich da ist und zu DIESEM Auftrag gehört. Erst dann steht „gespeichert" da.
    if (p.aktion === "persoenliche_aufgabe_anlegen") {
      let aufgabeId = bekannt?.id ?? null;
      if (!aufgabeId) {
        const vorgang = aktionskennung(auftragId, p.nr);
        const nachVorgang = async () => {
          const gelesen = await rufe("GET", "/api/me/klara/aufgaben");
          const liste = (gelesen.daten as { aufgaben?: { vorgang?: unknown }[] } | null)?.aufgaben;
          const bekannt =
            gelesen.status === 200 && Array.isArray(liste)
              ? liste.find((a) => a.vorgang === vorgang)
              : null;
          return bekannt ? { status: 200, daten: { aufgabe: bekannt } } : null;
        };
        let angelegt: Awaited<ReturnType<KlaraRufe>> | null = vorhanden
          ? await nachVorgang()
          : null;
        // Ein begonnener Notizversuch kann bereits geschrieben haben. Ein fehlender Readback
        // beweist keine Nichtanlage; nur weiter lesen, nicht aus der Lücke neu anlegen.
        if (vorhanden && p.notizQuelle && !angelegt) return ungeklaert();
        if (!angelegt)
          angelegt = await rufe("POST", "/api/me/klara/aufgaben", {
            vorgang,
            weg: p.notizQuelle ? "notiz" : "auftrag",
            quelle: p.notizQuelle ? { notizId: p.notizQuelle.id } : { gespraechId, auftragId },
            ...(p.notizQuelle ? { notizFassung: p.notizQuelle.fassung } : {}),
            titel: ziel.titel,
            ...(!p.notizQuelle && p.inhalt ? { inhalt: p.inhalt } : {}),
          });
        if (angelegt.status >= 500) {
          const gelesen = await nachVorgang();
          if (!gelesen) return ungeklaert();
          angelegt = gelesen;
        }
        const neu = persoenlicheAufgabeAus(angelegt.daten);
        if ((angelegt.status !== 201 && angelegt.status !== 200) || !neu) {
          return scheitert(codeAus(angelegt.status));
        }
        aufgabeId = neu.id;
        await merke({
          art: "persoenliche_aufgabe",
          id: aufgabeId,
          pfad: persoenlicheAufgabePfad(aufgabeId),
          stand: null,
        });
      }
      const gelesen = await rufe("GET", `/api/me/klara/aufgaben/${encodeURIComponent(aufgabeId)}`);
      if (gelesen.status === 404) {
        return scheitert("nichtGefunden");
      }
      const aufgabe = persoenlicheAufgabeAus(gelesen.daten);
      if (gelesen.status !== 200 || !aufgabe) {
        return ungeklaert();
      }
      if (
        p.notizQuelle
          ? aufgabe.bezug.art !== "notiz" || aufgabe.bezug.notizId !== p.notizQuelle.id
          : aufgabe.bezug.art !== "auftrag" || aufgabe.bezug.auftragId !== auftragId
      ) {
        return scheitert("nichtNachgelesen");
      }
      return melde("gespeichert", {
        ergebnis: {
          art: "persoenliche_aufgabe",
          id: aufgabe.id,
          titel: aufgabe.titel,
          // Der TATSÄCHLICHE Stand am Server — Status und Priorität, nie Inhalt.
          stand: `status:${aufgabe.status} prioritaet:${aufgabe.prioritaet}`,
          pfad: persoenlicheAufgabePfad(aufgabe.id),
        },
        // Nicht rücknehmbar (Vertrag `persoenliche_aufgabe_anlegen`): korrigiert wird am Ort.
      });
    }

    // Nacharbeit 4 (Ben): an einer verfügbaren Aufgabe die geklärte Fachaktion AUSFÜHREN — über den
    // vorhandenen Weg mit den Rechten der Person — und das Ergebnis nachlesen. „Nur öffnen“ bleibt
    // der getrennte Weg darunter.
    const aufgabenaktion = p.aktion === "aufgabe_bearbeiten" ? (p.aufgabenaktion ?? null) : null;
    if (aufgabenaktion && aufgabenaktion.art !== "nur_oeffnen") {
      const id = ziel.id as string;
      let pfad = bekannt?.pfad ?? ziel.pfad ?? "";
      if (!bekannt) {
        let vorherStand: string | null = null;
        const verfuegbar = await this.bestaetige(ziel, rufe, (s) => {
          vorherStand = s;
        });
        if ("code" in verfuegbar) {
          return scheitert(verfuegbar.code);
        }
        pfad = verfuegbar.pfad;
        // PV-02-03: der Stand der Aufgabe VOR der Fachaktion, am selben Lesweg gelesen.
        await this.dienst.merkeStaende(kontoId, gespraechId, auftragId, schluessel, {
          vorherStand,
        });
        const geschrieben =
          aufgabenaktion.art === "eskalieren"
            ? await rufe("POST", `/api/conflicts/${encodeURIComponent(id)}/escalate`)
            : await rufe(
                "PUT",
                `/api/gaps/${encodeURIComponent(id)}`,
                aufgabenaktion.art === "prioritaet"
                  ? { priority: aufgabenaktion.wert }
                  : { expertId: aufgabenaktion.personId },
              );
        if (geschrieben.status !== 200 && geschrieben.status !== 201) {
          return scheitert(codeAus(geschrieben.status));
        }
        await merke({ art: "aufgabe", id, pfad, stand: null });
      }
      const nachgelesen = await this.liesAufgabeNach(id, aufgabenaktion, rufe);
      if (nachgelesen === "ungeklaert") {
        return ungeklaert();
      }
      if (nachgelesen === "abweichend") {
        return scheitert("nichtNachgelesen");
      }
      return melde("gespeichert", {
        ergebnis: { art: "aufgabe", id, titel: ziel.titel, stand: nachgelesen, pfad },
        // Eine Fachaktion an einer Aufgabe nimmt Klara nicht zurück — das steht als solches da.
      });
    }

    // Öffnen und Aufgabe (nur öffnen): Zielidentität und aktuelle Berechtigung am Server bestätigen.
    const geprueft = await this.bestaetige(ziel, rufe);
    if ("code" in geprueft) {
      return scheitert(geprueft.code);
    }
    return this.dienst.setzeAuftragsschritt(
      kontoId,
      gespraechId,
      auftragId,
      schluessel,
      { ...basis, auftragFassung: fassung, stand: "begonnen" },
      "server",
      { geprueft },
    );
  }

  /**
   * Nacharbeit 4: liest die Wirkung einer Aufgabenaktion am vorhandenen Lesweg nach. Antwort: der
   * nachgelesene Stand („prioritaet:hoch“, „zugewiesen:…“, „eskaliert“), `abweichend` oder
   * `ungeklaert` (Lesen gelang nicht).
   */
  private async liesAufgabeNach(
    id: string,
    aktion: Exclude<KlaraAufgabenaktion, { art: "nur_oeffnen" }>,
    rufe: KlaraRufe,
  ): Promise<string> {
    if (aktion.art === "eskalieren") {
      const r = await rufe("GET", `/api/conflicts/${encodeURIComponent(id)}`);
      if (r.status !== 200) {
        return "ungeklaert";
      }
      return (r.daten as { status?: unknown }).status === "eskaliert" ? "eskaliert" : "abweichend";
    }
    const r = await rufe("GET", "/api/gaps");
    if (r.status !== 200 || !Array.isArray(r.daten)) {
      return "ungeklaert";
    }
    const g = r.daten.find((x) => x?.id === id) as
      | { priority?: unknown; assignee?: unknown }
      | undefined;
    if (!g) {
      return "abweichend";
    }
    if (aktion.art === "prioritaet") {
      return g.priority === aktion.wert ? `prioritaet:${aktion.wert}` : "abweichend";
    }
    return g.assignee === aktion.personId ? `zugewiesen:${aktion.personName}` : "abweichend";
  }

  /**
   * `vorher` (PV-02-03) erhält bei einer Aufgabe ihren gelesenen Stand: „prioritaet:…“ und
   * „zugewiesen“/„nicht_zugewiesen“ an einer Lücke, „status:…“ an einem Konflikt.
   */
  private async bestaetige(
    ziel: KlaraAuftragZiel,
    rufe: KlaraRufe,
    vorher?: (stand: string) => void,
  ): Promise<KlaraAuftragErgebnis | { code: string }> {
    const id = ziel.id;
    if (!id) {
      return { code: "nichtGefunden" };
    }
    if (ziel.art === "wissensobjekt") {
      const r = await rufe("GET", `/api/kos/${encodeURIComponent(id)}`);
      if (r.status !== 200) {
        return { code: codeAus(r.status) };
      }
      const version = (r.daten as { version?: unknown }).version;
      return {
        art: "wissensobjekt",
        id,
        // Nur der Titel, den die Person im Auftrag selbst gewählt hat — kein neuer Inhalt.
        titel: ziel.titel,
        stand: typeof version === "number" ? String(version) : null,
        pfad: `/wissen/${encodeURIComponent(id)}`,
      };
    }
    if (ziel.art === "entwurf") {
      const r = await rufe("GET", `/api/drafts/${encodeURIComponent(id)}`);
      if (r.status !== 200 || !istEntwurf(r.daten)) {
        return { code: codeAus(r.status) };
      }
      return {
        art: "entwurf",
        id,
        titel: ziel.titel,
        stand: r.daten.updatedAt,
        pfad: entwurfPfad(id),
      };
    }
    if (ziel.art === "aufgabe") {
      // Dieselben Quellen und Regeln wie „Meine Aufgaben“: Prüfung (Board), offener Konflikt,
      // offene Lücke — welche, sagt der Arbeitsort aus dem Auftrag.
      const pfad = ziel.pfad ?? "";
      let verfuegbar = false;
      if (pfad.startsWith("/wissen/")) {
        const r = await rufe("GET", "/api/validation/board");
        verfuegbar =
          r.status === 200 && Array.isArray(r.daten) && r.daten.some((k) => k?.id === id);
      } else if (pfad.startsWith("/konflikte")) {
        const r = await rufe("GET", "/api/conflicts");
        const liste: AufgabenZeile[] = Array.isArray(r.daten) ? r.daten : [];
        const c = liste.find((x) => x?.id === id);
        verfuegbar = r.status === 200 && c !== undefined && c.status !== "geloest";
        if (verfuegbar && typeof c?.status === "string") {
          vorher?.(`status:${c.status}`);
        }
      } else if (pfad.startsWith("/risiko")) {
        const r = await rufe("GET", "/api/gaps");
        const liste: AufgabenZeile[] = Array.isArray(r.daten) ? r.daten : [];
        const g = liste.find((x) => x?.id === id);
        verfuegbar = r.status === 200 && g !== undefined && g.status === "offen";
        if (verfuegbar && g) {
          const teile = [g.assignee ? "zugewiesen" : "nicht_zugewiesen"];
          if (typeof g.priority === "string") {
            teile.unshift(`prioritaet:${g.priority}`);
          }
          vorher?.(teile.join(" "));
        }
      }
      if (!verfuegbar) {
        return { code: "nichtVerfuegbar" };
      }
      return { art: "aufgabe", id, titel: ziel.titel, stand: null, pfad };
    }
    return { code: "nichtGefunden" };
  }

  /**
   * Rückgängig — mit dem nachgelesenen Ergebnisstand als erwartetem Stand am vorhandenen Weg. Wurde
   * der Entwurf inzwischen geändert, antwortet der Server 409 und der Entwurf bleibt erhalten.
   */
  nimmZurueck(
    kontoId: string,
    gespraechId: string,
    auftragId: string,
    schluessel: string,
    rufe: KlaraRufe,
  ): Promise<Ergebnis> {
    return this.nacheinander(`${kontoId}|${gespraechId}|${auftragId}|${schluessel}`, async () => {
      try {
        return await this.nimmZurueckAllein(kontoId, gespraechId, auftragId, schluessel, rufe);
      } catch (fehler) {
        // PV-02-06: hat ein anderer Weg (zweite Instanz) inzwischen zurückgenommen, ist das der
        // tatsächliche Stand — kein Fehler, der eine geschehene Rücknahme als gescheitert zeigt.
        const jetzt = await this.dienst.auftrag(kontoId, gespraechId, auftragId).catch(() => null);
        const s = jetzt?.schritte.find((x) => x.schluessel === schluessel);
        if (jetzt && s?.stand === "zurueckgenommen") {
          return { auftrag: jetzt, schritt: s, wiederholt: true };
        }
        throw fehler;
      }
    });
  }

  private async nimmZurueckAllein(
    kontoId: string,
    gespraechId: string,
    auftragId: string,
    schluessel: string,
    rufe: KlaraRufe,
  ): Promise<Ergebnis> {
    const a = await this.dienst.auftrag(kontoId, gespraechId, auftragId);
    const s = a.schritte.find((x) => x.schluessel === schluessel);
    if (!s) {
      throw new KlaraGespraechFehler(404, "unbekannt", "Schritt nicht gefunden.");
    }
    if (s.stand === "zurueckgenommen") {
      return { auftrag: a, schritt: s, wiederholt: true };
    }
    const e = s.ergebnis;
    // PV-02-04/05: die tatsächliche Aktionswirkung zuerst — ist sie laut Vertrag nicht rücknehmbar
    // (Fachaktion an einer Aufgabe, Öffnen) oder nicht mit eigenem Stand gespeichert, sagt die
    // Ablehnung das samt Weg zum Korrigieren am vorhandenen Arbeitsort.
    const plan = (a.plan ?? []).find((p) => p.nr === s.nr);
    const vertrag = vertragFuer(s.aktion, plan?.aufgabenaktion);
    if (!s.ruecknehmbar || !e || s.stand !== "gespeichert") {
      throw new KlaraGespraechFehler(
        409,
        "nicht_ruecknehmbar",
        "Dieser Schritt ist nicht rücknehmbar — seine Wirkung bleibt bestehen.",
        {
          aktionskennung: aktionskennung(a.id, s.nr),
          vertrag: vertrag.schluessel,
          fuerAndereSichtbar: vertrag.fuerAndereSichtbar,
          korrekturweg: vertrag.korrekturweg,
          pfad: e?.pfad ?? s.ziel.pfad,
          fremdstand: s.fehlerCode === "fremdstand",
        },
      );
    }
    const url = `/api/drafts/${encodeURIComponent(e.id)}`;
    const eigenerStand = e.stand;
    const ergebnisPfad = e.pfad;
    /** Der Konflikt: eigener und aktueller Stand, Weg zum Korrigieren — nur an die Person. */
    const geaendert = (aktuell: string | null): never => {
      throw new KlaraGespraechFehler(
        409,
        "geaendert",
        "Der Entwurf wurde seitdem weiter geändert. Klara nimmt nichts über eine spätere Änderung hinweg zurück.",
        {
          aktionskennung: aktionskennung(a.id, s.nr),
          eigenerStand,
          aktuellerStand: aktuell,
          korrekturweg: "entwurf",
          pfad: ergebnisPfad,
        },
      );
    };
    const aktuellerStand = async (): Promise<string | null> => {
      const r = await rufe("GET", url);
      return r.status === 200 && istEntwurf(r.daten) ? r.daten.updatedAt : null;
    };
    // PV-02-04: vor der Rücknahme aktuelle Rechte und Zielversion — mit der Anmeldung der Person.
    const vorab = await rufe("GET", url);
    if (vorab.status !== 200 || !istEntwurf(vorab.daten)) {
      throw new KlaraGespraechFehler(
        409,
        "ziel_fehlt",
        GRUND[codeAus(vorab.status)] ?? GRUND.server ?? "",
        { aktionskennung: aktionskennung(a.id, s.nr), korrekturweg: "entwurf", pfad: null },
      );
    }
    if (vorab.daten.updatedAt !== e.stand) {
      geaendert(vorab.daten.updatedAt);
    }
    if (s.aktion === "entwurf_bearbeiten" && plan && !angewandt(vorab.daten.payload, plan)) {
      // Gleicher Stand, aber Klaras Änderung steht nicht da: nichts zurückzunehmen.
      geaendert(vorab.daten.updatedAt);
    }
    if (s.aktion === "entwurf_erstellen") {
      const geloescht = await rufe(
        "DELETE",
        `${url}?expectedUpdatedAt=${encodeURIComponent(e.stand ?? "")}`,
      );
      if (geloescht.status === 409) {
        geaendert(await aktuellerStand());
      }
      if (geloescht.status !== 204) {
        throw new KlaraGespraechFehler(409, "geaendert", GRUND[codeAus(geloescht.status)] ?? "");
      }
      const danach = await rufe("GET", url);
      if (danach.status !== 404) {
        throw new KlaraGespraechFehler(409, "geaendert", GRUND.nichtNachgelesen ?? "");
      }
      await this.dienst.merkeStaende(kontoId, gespraechId, auftragId, schluessel, {
        ruecknahmeStand: "papierkorb",
      });
    } else {
      const vorher = s.vorher;
      if (!vorher) {
        throw new KlaraGespraechFehler(
          409,
          "nicht_ruecknehmbar",
          "Der Stand vor der Änderung ist nicht festgehalten.",
        );
      }
      const geschrieben = await rufe("PUT", url, {
        title: vorher.title,
        statement: vorher.statement,
        expectedUpdatedAt: e.stand ?? "",
      });
      if (geschrieben.status === 409) {
        geaendert(await aktuellerStand());
      }
      if (geschrieben.status !== 200) {
        throw new KlaraGespraechFehler(409, "geaendert", GRUND[codeAus(geschrieben.status)] ?? "");
      }
      const gelesen = await rufe("GET", url);
      // Dieselbe Regel wie der Speicherweg: eine leere Kernaussage nimmt dort den Titel an.
      const erwartet = vorher.statement || vorher.title;
      if (
        gelesen.status !== 200 ||
        !istEntwurf(gelesen.daten) ||
        (gelesen.daten.payload.title ?? "") !== vorher.title ||
        (gelesen.daten.payload.statement ?? "") !== erwartet
      ) {
        throw new KlaraGespraechFehler(409, "geaendert", GRUND.nichtNachgelesen ?? "");
      }
      // Der neue Stand nach der Rückänderung: eine NEUE Fassung, keine Wiederherstellung der alten.
      await this.dienst.merkeStaende(kontoId, gespraechId, auftragId, schluessel, {
        ruecknahmeStand: gelesen.daten.updatedAt,
      });
    }
    return this.dienst.setzeAuftragsschritt(
      kontoId,
      gespraechId,
      auftragId,
      schluessel,
      {
        nr: s.nr,
        aktion: s.aktion,
        ziel: s.ziel,
        auftragFassung: s.auftragFassung,
        stand: "zurueckgenommen",
      },
      "server",
    );
  }
}
