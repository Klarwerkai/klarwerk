// ================================================================================================
// JOB 3801 · DIE STRECKE DES ERSTEN NUTZERWEGS — EINMAL AM STÜCK, AN DER ECHTEN APP.
// ================================================================================================
//
// WOZU DIESE DATEI. Jedes EINZELNE Stück des ersten Demo-Wegs ist geprüft: der Startvertrag in
// `tests/demo-zugang-start/**`, der Import in `tests/capture/**`, die Suche in `tests/bibliothek*`.
// Was nirgends geprüft war, sind die ÜBERGÄNGE — ob das, was Schritt 3 hinterlässt, für Schritt 4
// reicht. Genau das und nur das fährt diese Strecke.
//
// WIE SIE GEBAUT IST:
//   · ECHTE APP, EIN PROZESS, KEIN BROWSER: `buildApp(buildServices())` und `app.inject` — derselbe
//     Weg, den `tests/ka5/markierung-fundstelle-bleibt.test.ts:23,38` geht. Es gibt hier KEINE neue
//     Chromium-Startstelle (die müsste in `tests/tor-inventar/tor-bestand-vollstaendig.test.ts`
//     nachgetragen werden, und das ist Zielpfad von JOB 3591).
//   · ECHTE ROUTEN IN DER REIHENFOLGE DER OBERFLÄCHE. Welche Adresse wann fällt, ist nicht erfunden,
//     sondern aus `apps/web/src/pages/Capture.tsx:1729-1760` gelesen: liegt ein ANKERDOKUMENT vor,
//     geht das Einreichen über `POST /api/kos/from-document` (ein Vorgang, Inhalt und Herkunft
//     gemeinsam) und NICHT über den Promote. Eine Strecke, die hier den Promote nähme, prüfte einen
//     Weg, den kein Nutzer geht.
//   · ECHTE QUELLDATEI: `tests/fixtures/sample.docx`, die Datei, mit der auch
//     `tests/capture/job2671-d2-jszip-vorpruefung.test.ts:46` arbeitet. Kein Attrappen-Objekt, keine
//     von Hand gebaute HTML-Zeichenkette.
//   · JEDER SCHRITT GIBT SEINE MESSUNG ZURÜCK, statt sie selbst zu beurteilen. Die Zusicherungen
//     stehen GESAMMELT in `pruefeStrecke` (durchstich.test.ts) — nur deshalb lässt sich §8 erfüllen:
//     dieselbe Prüffolge gegen eine Strecke fahren, der ein Schritt fehlt, und zeigen, dass sie
//     dann rot wird.
//
// WAS DIESE DATEI NICHT IST: kein Word (ein Testprozess ist keine Office-Ausführung), keine
// Demo-Instanz (es wird nichts bereitgestellt), keine Gastverwaltung (die Kontobefristung hat keine
// Adminfläche) und keine Vollständigkeit (EIN Weg, der häufigste — die nicht gefahrenen Abzweigungen
// stehen in der Rückgabe).
//
// RUNDE 2 — WAS BEN AN RUNDE 1 ZU RECHT ZERRISSEN HAT, und was sich dadurch hier geändert hat:
//   (1) Die Fortsetzung lief aus dem ALTEN Sitzungszustand (`eigeneFelder` wurde nach dem
//       Sitzungswechsel einfach wieder gesendet). Damit überbrückte die Strecke genau den
//       Datenverlust, den sie messen soll: ein Server, der beim Wiederöffnen die eigene Aussage
//       verliert, blieb grün. JETZT wird Schritt 5 AUSSCHLIESSLICH aus WIEDERGELADENEN Daten
//       gebaut — aus dem Eintrag der Entwurfsliste, weil die Oberfläche genau daraus fortsetzt —
//       und wo das nicht möglich war, sagt `fortsetzungAus`/`ankerQuelle` es als Messwert.
//   (2) Das Original wurde nur auf HTTP 200 geprüft, nicht auf seine BYTES. Ein Server, der andere
//       Bytes ausliefert, blieb grün. JETZT werden Länge und SHA-256 der heruntergeladenen Bytes
//       gegen die eingelesene Datei gehalten.
//   (3) Die Leermessung las Listen über `alsListe`, das ein Fehlerobjekt in `[]` verwandelt — eine
//       500er-Bestandsroute sah aus wie ein leerer Bestand. JETZT werden Status UND Antwortform
//       der beiden Bestandsrouten eigene Messwerte.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { buildApp, buildServices } from "../../services/app/src/build-app";

/** Die echte Quelldatei aus dem Testbestand. Ihr einziger Satz steht in `QUELLSATZ`. */
export const QUELLDATEI = join(__dirname, "..", "fixtures", "sample.docx");
/**
 * Der Satz, der WIRKLICH in `sample.docx` steht (gemessen:
 * `unzip -p tests/fixtures/sample.docx word/document.xml`). Er ist der Faden durch die ganze
 * Strecke: was aus der Datei kommt, muss nach Speichern, Sitzungsneuaufbau und Anlage immer noch
 * dieser Satz sein — und nichts, was der Test selbst hineingeschrieben hat.
 */
export const QUELLSATZ = "Ventil bei Überdruck schließen.";
/** Das Wort, mit dem am Ende gesucht wird. Es kommt NUR aus der Datei, nicht aus dem Titel. */
export const SUCHWORT = "Überdruck";

/**
 * DIE EIGENE ARBEIT DES MENSCHEN — der zweite Faden neben dem Dokumentinhalt, und der, den Runde 1
 * nicht verfolgt hat. Titel und Aussage tippt er selbst; sie stehen in KEINER Quelldatei. Wenn sie
 * den Sitzungswechsel nicht überleben, ist die Demo verloren, auch wenn der Dokumentinhalt zurückkommt.
 */
export const EIGENER_TITEL = "Ventil bei Überdruck";
export const EIGENE_AUSSAGE = "Bei Überdruck wird das Ventil geschlossen.";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Das Konto, das die Demo anlegt. Eine eigene Adresse, damit nichts aus anderen Läufen mitspricht. */
const KONTO = {
  name: "Demo Gast",
  email: "gast@job3801.test",
  password: "vorfuehrung12345",
} as const;

/**
 * DIE AUSLASSUNG FÜR §8 (Red-first). Kein Schalter für Produktverhalten, sondern für die MESSUNG:
 * so lässt sich ein Schritt aus der Strecke nehmen und zeigen, dass die Prüffolge das merkt.
 *   · `"import"`            — die Quelle wird NICHT hereingebracht; der Entwurf entsteht leer über
 *                             `POST /api/drafts`, mit eigenem Text statt Dokumentinhalt.
 *   · `"quellensicherung"`  — der Entwurf beruft sich auf ein Original, das NIE gesichert wurde
 *                             (erfundene Objektkennung). Prüft den Übergang 4→5 am Ankertor.
 */
export type Auslassung = "import" | "quellensicherung";

export interface Schrittmessung {
  /** Wie der Schritt im Auftrag heisst. */
  readonly schritt: string;
  /** Welche Adresse gefallen ist — damit eine rote Stelle ohne Rätselraten auffindbar ist. */
  readonly weg: string;
  readonly status: number;
}

/**
 * WAS VON EINEM WIEDERGEÖFFNETEN ENTWURF WIRKLICH ZURÜCKKAM. Gelesen wird ausschliesslich aus der
 * Antwort des Servers — nichts hiervon stammt aus dem Zustand der alten Sitzung. Genau deshalb
 * taugt es als Messung: fehlt ein Feld oder ist es verändert, steht es hier falsch drin.
 */
export interface Wiedersehen {
  readonly titel: string;
  readonly aussage: string;
  /** Steht der Satz aus der Quelldatei noch im übernommenen Body? */
  readonly quellsatzDa: boolean;
  /** Die Kennungen der gesicherten Originale, die der Entwurf noch trägt (`anchorDocuments`). */
  readonly ankerObjekte: readonly string[];
  readonly ankerName: string;
  /** Die Kennungen, auf die die wartenden Belegstellen zeigen (`pendingSources[].objectId`). */
  readonly belegObjekte: readonly string[];
  readonly belegZitat: string;
}

export interface Streckenbefund {
  /** Schritt 1 — ist der Stand leer, und sagt das Produkt es? */
  readonly leer: {
    readonly statusVorAnmeldung: number;
    readonly needsSetup: boolean;
    readonly wissensobjekte: number;
    readonly entwuerfe: number;
    // BEN (Prüflücke 6): „0 Einträge" und „die Route antwortete mit einem Fehler" sahen gleich aus.
    // Status und Antwortform stehen deshalb neben der Zahl, und beide werden zugesichert.
    readonly bestandStatus: number;
    readonly entwuerfeStatus: number;
    readonly bestandIstListe: boolean;
    readonly entwuerfeIstListe: boolean;
  };
  /** Schritt 2 — das kontrolliert angelegte Konto. */
  readonly konto: {
    readonly status: number;
    readonly rolle: string;
    readonly freigegeben: boolean;
    readonly needsSetupDanach: boolean;
    readonly zweiteEinrichtung: number;
  };
  /** Schritt 3 — die echte Quelle kommt herein. */
  readonly quelle: {
    readonly entwurfStatus: number;
    readonly entwurfId: string;
    readonly quellsatzImEntwurf: boolean;
    readonly objektStatus: number;
    readonly objektId: string;
    readonly objektName: string;
    /** Länge und SHA-256 der EINGELESENEN Datei — die Vergleichsgrösse für den Download in Schritt 5. */
    readonly laenge: number;
    readonly abdruck: string;
  };
  /** Schritt 4 — speichern, Sitzung neu aufbauen, wiederöffnen. */
  readonly entwurf: {
    readonly speichernStatus: number;
    readonly abmeldenStatus: number;
    /** Die ALTE Sitzung nach dem Abmelden — ein Neuaufbau, der nichts aufbaut, wäre keiner. */
    readonly alteSitzung: number;
    readonly zweiteAnmeldung: number;
    /** Dieselbe Sitzungskennung zweimal wäre kein Neuaufbau. */
    readonly sitzungTauschte: boolean;
    readonly wiederoeffnenStatus: number;
    readonly listeStatus: number;
    /** Was `GET /api/drafts/:id` zurückgab. */
    readonly einzel: Wiedersehen;
    /** Was der EINTRAG DER LISTE zurückgab — der Weg, den die Oberfläche wirklich geht. */
    readonly liste: Wiedersehen;
    readonly ankerFehlend: readonly string[];
    /** Steht er auch in der LISTE, aus der die Oberfläche fortsetzt? */
    readonly inListe: boolean;
    /**
     * WORAUS SCHRITT 5 SEINEN INHALT NAHM. `"liste"` ist der einzige Wert, den die Strecke gelten
     * lässt: dann stammt jedes Feld der Anlage aus dem, was der Server nach dem Sitzungswechsel
     * herausgegeben hat. `"einzel"` heisst, der Listenweg trug den Entwurf nicht; `"alt"` heisst,
     * es kam überhaupt nichts zurück und nur der Zustand der alten Sitzung war noch da.
     */
    readonly fortsetzungAus: "liste" | "einzel" | "alt";
  };
  /** Schritt 5 — erlaubte Prüfung, Suche, Quellenwiederaufruf. */
  readonly fund: {
    readonly anlageStatus: number;
    /** Der Fehlercode, wenn die Anlage NICHT gelang — leer, wenn sie gelang. */
    readonly anlageFehler: string;
    readonly koId: string;
    /**
     * WAS IM BESTAND LANDETE. Nicht die Ladung, die hingeschickt wurde, sondern das, was der Server
     * zurückgibt — die eigene Arbeit des Menschen am Ende der ganzen Kette.
     */
    readonly koTitel: string;
    readonly koAussage: string;
    /**
     * Kam der Ankerbeleg der Anlage aus WIEDERGELADENEN Daten (`"wiedergeladen"`) oder musste die
     * Strecke auf den Zustand der alten Sitzung zurückfallen (`"alt"`), weil der Entwurf seine
     * Herkunft nicht mehr trug?
     */
    readonly ankerQuelle: "wiedergeladen" | "alt";
    readonly pruefungStatus: number;
    readonly pruefungOhneAnmeldung: number;
    /** Findet die Prüfung das eben Angelegte wieder? (`similar` des Live-Checks) */
    readonly pruefungTrifft: boolean;
    /** Was die Prüfung über sich selbst sagt — „done" oder ehrlich „pending". */
    readonly pruefungStand: string;
    readonly sucheStatus: number;
    readonly sucheTrifft: boolean;
    readonly belegObjektId: string;
    readonly quelleStatus: number;
    readonly quelleName: string;
    readonly rohbytesStatus: number;
    /**
     * DIE HERUNTERGELADENEN BYTES SELBST — Länge und SHA-256. BEN (Korrekturpflicht 2): ein
     * HTTP 200 sagt nur, dass irgendetwas kam. Erst der Vergleich mit `quelle.laenge`/`quelle.abdruck`
     * sagt, dass es DIE DATEI war, die der Mensch in Schritt 3 hereingebracht hat.
     */
    readonly rohLaenge: number;
    readonly rohAbdruck: string;
  };
  readonly verlauf: readonly Schrittmessung[];
}

interface Lauf {
  readonly app: FastifyInstance;
  readonly zweiteApp: FastifyInstance;
  readonly befund: Streckenbefund;
}

/**
 * Fährt die fünf Schritte am Stück. Sie URTEILT NICHT — sie misst und gibt zurück. Wirft nur, wenn
 * ein Schritt gar keine verwertbare Auskunft liefert (dann ist die Strecke an dieser Stelle zu Ende,
 * und das ist selbst die Auskunft).
 *
 * Der Aufrufer schliesst beide Apps (`schliesse`).
 */
export async function fahreStrecke(opt: { ohne?: Auslassung } = {}): Promise<Lauf> {
  const verlauf: Schrittmessung[] = [];
  const merke = (schritt: string, weg: string, status: number): void => {
    verlauf.push({ schritt, weg, status });
  };

  // Ein EIGENER Dienstsatz je Lauf: der Bestand ist damit wirklich isoliert, und „leer" ist keine
  // Annahme über die Reihenfolge der Testdateien.
  const services = buildServices();
  const app = buildApp(services);
  await app.ready();

  // ---- SCHRITT 1 · DIE LEERE ERSTEINRICHTUNG ---------------------------------------------------
  // Die erste Auskunft kommt OHNE Anmeldung — anders ginge es auf einer leeren Installation auch
  // nicht, es gibt noch kein Konto. Genau das ist die Auskunft, die das Produkt geben muss.
  const status1 = await app.inject({ method: "GET", url: "/api/auth/status" });
  merke("1 leer", "GET /api/auth/status", status1.statusCode);
  const statusKörper = status1.json() as { needsSetup?: boolean };
  // Und die Gegenrichtung: ohne Konto gibt der Bestand NICHTS heraus. Ein leerer Bestand, der
  // unangemeldet lesbar wäre, wäre die schlechtere Leere.
  const bestandAnonym = await app.inject({ method: "GET", url: "/api/kos" });
  merke("1 leer", "GET /api/kos (ohne Anmeldung)", bestandAnonym.statusCode);

  // ---- SCHRITT 2 · DAS KONTO -------------------------------------------------------------------
  // `POST /api/auth/setup` ist die Ersteinrichtung des Produkts (services/auth/src/routes.ts:579) —
  // nicht `register`. Sie legt das erste Konto an UND startet die Sitzung in einem Zug.
  const einrichten = await app.inject({ method: "POST", url: "/api/auth/setup", payload: KONTO });
  merke("2 konto", "POST /api/auth/setup", einrichten.statusCode);
  const kontoKörper = einrichten.json() as { user?: { role?: string; approved?: boolean } };
  const keks = ersterKeks(einrichten.headers["set-cookie"]);
  const status2 = await app.inject({ method: "GET", url: "/api/auth/status" });
  // Die zweite Ersteinrichtung darf es nicht geben — sonst wäre „Konto kontrolliert angelegt" eine
  // Behauptung ohne Kontrolle.
  const zweiteEinrichtung = await app.inject({
    method: "POST",
    url: "/api/auth/setup",
    payload: { ...KONTO, email: "zweiter@job3801.test" },
  });
  merke("2 konto", "POST /api/auth/setup (zweites Mal)", zweiteEinrichtung.statusCode);
  const angemeldet = { cookie: keks };
  const bestand = await app.inject({ method: "GET", url: "/api/kos", headers: angemeldet });
  const entwuerfe = await app.inject({ method: "GET", url: "/api/drafts", headers: angemeldet });
  merke("1 leer", "GET /api/kos (angemeldet)", bestand.statusCode);
  merke("1 leer", "GET /api/drafts (angemeldet)", entwuerfe.statusCode);

  // ---- SCHRITT 3 · DIE ECHTE QUELLE KOMMT HEREIN -----------------------------------------------
  const bytes = readFileSync(QUELLDATEI);
  let entwurfStatus: number;
  let entwurfId: string;
  let quellsatzImEntwurf: boolean;
  if (opt.ohne === "import") {
    // DIE AUSLASSUNG FÜR §8: kein Dokument, nur ein leerer Entwurf mit eigenem Text. Alles Weitere
    // läuft unverändert — die Strecke soll an der MESSUNG scheitern, nicht an einem Abbruch.
    const ersatz = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: angemeldet,
      payload: { title: "Ohne Quelle", statement: "Von Hand getippt, ohne Dokument." },
    });
    entwurfStatus = ersatz.statusCode;
    entwurfId = String((ersatz.json() as { id?: string }).id ?? "");
    quellsatzImEntwurf = false;
    merke("3 quelle", "POST /api/drafts (Auslassung: kein Import)", ersatz.statusCode);
  } else {
    const aus = await app.inject({
      method: "POST",
      url: "/api/drafts/from-docx",
      headers: angemeldet,
      payload: { name: "sample.docx", data: bytes.toString("base64") },
    });
    entwurfStatus = aus.statusCode;
    const körper = aus.json() as { id?: string; payload?: { bodyHtml?: string | null } };
    entwurfId = String(körper.id ?? "");
    quellsatzImEntwurf = (körper.payload?.bodyHtml ?? "").includes(QUELLSATZ);
    merke("3 quelle", "POST /api/drafts/from-docx", aus.statusCode);
  }
  if (!entwurfId) {
    throw new Error(`Schritt 3 lieferte keine Entwurfskennung (Status ${entwurfStatus}).`);
  }

  // Das ORIGINAL wird gesichert — `purpose: "anchor"`, genau wie die Oberfläche es tut
  // (`apps/web/src/lib/captureAttachments.ts:284`). Ohne dieses Objekt gibt es später keine Quelle,
  // auf die man zurückgreifen kann.
  let objektStatus = 0;
  let objektId = "erfunden-nie-gesichert";
  let objektName = "";
  if (opt.ohne !== "quellensicherung") {
    const hoch = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers: angemeldet,
      payload: {
        name: "sample.docx",
        mime: DOCX_MIME,
        data: `data:${DOCX_MIME};base64,${bytes.toString("base64")}`,
        kind: "document",
        purpose: "anchor",
        draftId: entwurfId,
      },
    });
    objektStatus = hoch.statusCode;
    const ref = hoch.json() as { id?: string; name?: string };
    objektId = String(ref.id ?? "");
    objektName = String(ref.name ?? "");
    merke("3 quelle", "POST /api/objects (purpose anchor)", hoch.statusCode);
    if (!objektId) {
      throw new Error(`Die Quelle wurde nicht gesichert (Status ${objektStatus}).`);
    }
  } else {
    merke("3 quelle", "POST /api/objects (Auslassung: nicht gesichert)", 0);
  }

  // ---- SCHRITT 4 · SPEICHERN, WEGGEHEN, WIEDERKOMMEN -------------------------------------------
  // Der Mensch schreibt seine eigenen Felder dazu und verknüpft die Belegstelle mit dem Original.
  // `anchorKey` ist die Brücke INNERHALB des Entwurfs, `objectId` die einzige prüfbare Angabe
  // (services/capture/src/types.ts:52-81).
  const eigeneFelder = {
    title: EIGENER_TITEL,
    statement: EIGENE_AUSSAGE,
    type: "best_practice",
    category: "Wartung",
    confidentiality: "intern",
    pendingSources: [
      { label: "sample.docx", excerpt: QUELLSATZ, anchorKey: "anker-1", objectId: objektId },
    ],
    anchorDocuments: [{ key: "anker-1", objectId: objektId, name: "sample.docx", mime: DOCX_MIME }],
  };
  const speichern = await app.inject({
    method: "PUT",
    url: `/api/drafts/${entwurfId}`,
    headers: angemeldet,
    payload: eigeneFelder,
  });
  merke("4 entwurf", `PUT /api/drafts/${entwurfId}`, speichern.statusCode);

  // DER NEUAUFBAU DER SITZUNG, und er ist beides: die Sitzung wird ABGEMELDET (das Merkmal verfällt
  // wirklich) und die HTTP-Anwendung wird NEU GEBAUT. Dieselben Dienste bleiben stehen — sonst
  // messe ich nicht „der Entwurf überlebt die Sitzung", sondern „ein leerer Speicher ist leer".
  const abmelden = await app.inject({
    method: "POST",
    url: "/api/auth/logout",
    headers: angemeldet,
  });
  merke("4 entwurf", "POST /api/auth/logout", abmelden.statusCode);
  const alteSitzung = await app.inject({
    method: "GET",
    url: `/api/drafts/${entwurfId}`,
    headers: angemeldet,
  });
  merke("4 entwurf", `GET /api/drafts/${entwurfId} (alte Sitzung)`, alteSitzung.statusCode);

  const zweiteApp = buildApp(services);
  await zweiteApp.ready();
  const wiederAn = await zweiteApp.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: KONTO.email, password: KONTO.password },
  });
  merke("4 entwurf", "POST /api/auth/login (neue Sitzung)", wiederAn.statusCode);
  const keks2 = ersterKeks(wiederAn.headers["set-cookie"]);
  const wieder = { cookie: keks2 };
  const auf = await zweiteApp.inject({
    method: "GET",
    url: `/api/drafts/${entwurfId}`,
    headers: wieder,
  });
  merke("4 entwurf", `GET /api/drafts/${entwurfId} (neue Sitzung)`, auf.statusCode);
  const wiederKörper = auf.json() as Entwurfsantwort;
  const liste = await zweiteApp.inject({ method: "GET", url: "/api/drafts", headers: wieder });
  merke("4 entwurf", "GET /api/drafts (neue Sitzung)", liste.statusCode);
  const listeKörper = alsListe<Entwurfsantwort>(liste.json());
  const listenEintrag = listeKörper.find((d) => d.id === entwurfId);

  // ---- SCHRITT 5 · ERLAUBTE PRÜFUNG, SUCHE, QUELLENWIEDERAUFRUF --------------------------------
  // DIE FORTSETZUNG KOMMT AUS WIEDERGELADENEN DATEN — das ist die Korrektur aus Runde 2 und der
  // Kern der Sache. Runde 1 sendete hier `eigeneFelder`, also den Zustand der ALTEN Sitzung. Damit
  // hätte der Server beim Wiederöffnen Titel, Aussage und Herkunft verlieren können, ohne dass die
  // Strecke es merkt: der Test hätte die Lücke selbst zugeschüttet (BEN, Korrekturpflicht 1).
  //
  // Genommen wird der EINTRAG DER LISTE, weil die Oberfläche genau daraus fortsetzt
  // (CaptureDraftList → `onResume` mit dem Objekt aus `GET /api/drafts`, s. capture/src/service.ts
  // `listDraftsForResume`) — nicht die Einzeladresse. Wo der Listenweg nichts hergab, steht das als
  // MESSWERT (`fortsetzungAus`), damit ein Rückfall nie unbemerkt durchgeht.
  // AUCH DIE HERKUNFTSANGABE DER ANLAGE KOMMT AUS DEM WIEDERGELADENEN ENTWURF. Sie muss es, denn
  // `anchorDocuments`/`pendingSources` sind genau die Felder, die mega20 D in den Entwurf gelegt hat
  // — überlebten sie den Sitzungswechsel nicht, dürfte der Mensch die Quelle nicht mehr behaupten.
  const wiedergeladen = listenEintrag?.payload ?? wiederKörper.payload;
  const ankerAusWieder = wiedergeladen?.anchorDocuments ?? [];
  const belegeAusWieder = wiedergeladen?.pendingSources ?? [];

  // DIE EINE REGEL, UND SIE IST ABSICHTLICH UNBEQUEM: fortgesetzt wird der wiedergeladene Stand —
  // aber nur, wenn er seine Herkunft überhaupt noch trägt. Ein Entwurf ohne `anchorDocuments` ist
  // kein fortsetzbarer Dokumententwurf mehr; dann bleibt einem Client nur noch sein FORMULARZUSTAND,
  // und genau das steht dann als Messwert da (`"alt"`) statt still zu verschwinden.
  //
  // WARUM DER `"alt"`-ZWEIG NICHT WEGGELASSEN WERDEN DARF: er ist der echte Fall des Clients, der
  // die Quelle noch zu kennen glaubt, während der Server das Original verloren hat — und der
  // einzige, in dem das Entwurfs-Ankertor `MISSING_DRAFT_ANCHOR` (capture/src/service.ts:957)
  // überhaupt gefragt wird. Ohne ihn fiele Ü1 schon an der äusseren Objektprüfung der Route
  // (400 `BAD_REQUEST`, gemessen in Runde 2), und das schärfere der beiden Tore bliebe unbesehen.
  const ankerQuelle: "wiedergeladen" | "alt" = ankerAusWieder.length > 0 ? "wiedergeladen" : "alt";
  const fortsetzungAus: "liste" | "einzel" | "alt" =
    ankerQuelle === "alt" ? "alt" : listenEintrag?.payload ? "liste" : "einzel";
  const fortsetzung: unknown = fortsetzungAus === "alt" ? eigeneFelder : wiedergeladen;
  const dokumente =
    ankerQuelle === "wiedergeladen"
      ? ankerAusWieder.map((doc) => ({
          anchor: { objectId: doc.objectId, name: doc.name, mime: doc.mime },
          points: belegeAusWieder
            .filter((src) => src.anchorKey === undefined || src.anchorKey === doc.key)
            .map((src) => ({ label: src.label, excerpt: src.excerpt })),
        }))
      : [
          {
            anchor: { objectId: objektId, name: "sample.docx", mime: DOCX_MIME },
            points: [{ label: "sample.docx", excerpt: QUELLSATZ }],
          },
        ];

  // Der Weg der Oberfläche bei vorhandenem Ankerdokument: EIN Vorgang, Inhalt und Herkunft
  // gemeinsam (Capture.tsx:1729-1749). `operationId` ist Pflicht, `expectedUpdatedAt` beim
  // Fortsetzen ebenso (ko-routes.ts:1281-1292) — und er kommt ebenfalls aus dem wiedergeladenen
  // Stand, nicht aus einer Erinnerung.
  const gesehenerStand = listenEintrag?.updatedAt ?? wiederKörper.updatedAt;
  const anlage = await zweiteApp.inject({
    method: "POST",
    url: "/api/kos/from-document",
    headers: wieder,
    payload: {
      operationId: "job3801-erster-nutzerweg",
      draftId: entwurfId,
      draftPayload: fortsetzung,
      ...(gesehenerStand ? { expectedUpdatedAt: gesehenerStand } : {}),
      documents: dokumente,
    },
  });
  merke("5 fund", "POST /api/kos/from-document", anlage.statusCode);
  const anlageKörper = anlage.json() as {
    id?: string;
    error?: string;
    title?: string;
    statement?: string;
  };
  const koId = String(anlageKörper.id ?? "");

  // (a) DIE ERLAUBTE PRÜFUNG. `POST /api/knowledge/check` ist der Live-Check des Produkts
  //     (SCRUM-527, build-app.ts:2238): ein Text wird gegen den Bestand gehalten, Berechtigung
  //     `ko.read` (knowledge-check-routes.ts:126). Kein Modell nötig — ohne Modell läuft die
  //     deterministische Ähnlichkeit, und genau die soll das eben Angelegte finden.
  //
  //     NICHT `POST /api/check-text`: GEMESSEN, nicht vermutet — diese Adresse antwortet in der
  //     Vorgabe-Verdrahtung mit 404, weil sie nur bei aktivem Add-on-Schalter überhaupt registriert
  //     wird (`if (addonApiEnabled())`, build-app.ts:2258). Sie ist der Klara-Weg, nicht der Weg des
  //     Menschen im Browser, und ein Testprozess ist ohnehin kein Word.
  //
  //     Daneben steht dieselbe Anfrage OHNE Anmeldung: „erlaubt" ist nur dann eine Aussage, wenn es
  //     auch ein „nicht erlaubt" gibt.
  const pruefText = `${QUELLSATZ} Diese Regel gilt an allen Portalanlagen der Werkstatt und wird bei jeder Wartung erneut kontrolliert.`;
  const pruefung = await zweiteApp.inject({
    method: "POST",
    url: "/api/knowledge/check",
    headers: wieder,
    payload: { text: pruefText, source: "draft" },
  });
  merke("5 fund", "POST /api/knowledge/check (angemeldet)", pruefung.statusCode);
  const ohneAnmeldung = await zweiteApp.inject({
    method: "POST",
    url: "/api/knowledge/check",
    payload: { text: pruefText, source: "draft" },
  });
  merke("5 fund", "POST /api/knowledge/check (ohne Anmeldung)", ohneAnmeldung.statusCode);

  // (b) DIE SUCHE. Gesucht wird mit einem Wort, das NUR aus der Datei stammt.
  const suche = await zweiteApp.inject({
    method: "GET",
    url: `/api/library/search?q=${encodeURIComponent(SUCHWORT)}`,
    headers: wieder,
  });
  merke("5 fund", `GET /api/library/search?q=${SUCHWORT}`, suche.statusCode);
  const treffer = alsListe<{ id?: string }>(suche.json());

  // (c) DER QUELLENWIEDERAUFRUF. Vom Fund über den Beleg zurück auf das Original — die Kette, die
  //     einen Demo-Besucher überhaupt interessiert: „und woher steht das?"
  const belege = await zweiteApp.inject({
    method: "GET",
    url: `/api/kos/${koId}/evidence`,
    headers: wieder,
  });
  merke("5 fund", `GET /api/kos/${koId}/evidence`, belege.statusCode);
  const belegObjektId = String(
    alsListe<{ objectId?: string }>(belege.json()).find((b) => b.objectId)?.objectId ?? "",
  );
  const quelle = await zweiteApp.inject({
    method: "GET",
    url: `/api/objects/${belegObjektId}`,
    headers: wieder,
  });
  merke("5 fund", `GET /api/objects/${belegObjektId}`, quelle.statusCode);
  const roh = await zweiteApp.inject({
    method: "GET",
    url: `/api/objects/${belegObjektId}/raw`,
    headers: wieder,
  });
  merke("5 fund", `GET /api/objects/${belegObjektId}/raw`, roh.statusCode);

  return {
    app,
    zweiteApp,
    befund: {
      leer: {
        statusVorAnmeldung: status1.statusCode,
        needsSetup: statusKörper.needsSetup === true,
        wissensobjekte: alsListe<unknown>(bestand.json()).length,
        entwuerfe: alsListe<unknown>(entwuerfe.json()).length,
        bestandStatus: bestand.statusCode,
        entwuerfeStatus: entwuerfe.statusCode,
        bestandIstListe: Array.isArray(bestand.json()),
        entwuerfeIstListe: Array.isArray(entwuerfe.json()),
      },
      konto: {
        status: einrichten.statusCode,
        rolle: String(kontoKörper.user?.role ?? ""),
        freigegeben: kontoKörper.user?.approved === true,
        needsSetupDanach: (status2.json() as { needsSetup?: boolean }).needsSetup === true,
        zweiteEinrichtung: zweiteEinrichtung.statusCode,
      },
      quelle: {
        entwurfStatus,
        entwurfId,
        quellsatzImEntwurf,
        objektStatus,
        objektId,
        objektName,
        laenge: bytes.length,
        abdruck: abdruckVon(bytes),
      },
      entwurf: {
        speichernStatus: speichern.statusCode,
        abmeldenStatus: abmelden.statusCode,
        alteSitzung: alteSitzung.statusCode,
        zweiteAnmeldung: wiederAn.statusCode,
        sitzungTauschte: keks.length > 0 && keks2.length > 0 && keks !== keks2,
        wiederoeffnenStatus: auf.statusCode,
        listeStatus: liste.statusCode,
        einzel: liesWiedersehen(wiederKörper.payload),
        liste: liesWiedersehen(listenEintrag?.payload),
        ankerFehlend: wiederKörper.anchorsMissing ?? [],
        inListe: listenEintrag !== undefined,
        fortsetzungAus,
      },
      fund: {
        anlageStatus: anlage.statusCode,
        anlageFehler: String(anlageKörper.error ?? ""),
        koId,
        koTitel: String(anlageKörper.title ?? ""),
        koAussage: String(anlageKörper.statement ?? ""),
        ankerQuelle,
        pruefungStatus: pruefung.statusCode,
        pruefungOhneAnmeldung: ohneAnmeldung.statusCode,
        pruefungTrifft: alsListe<{ id?: string }>(
          (pruefung.json() as { similar?: unknown }).similar,
        ).some((s) => s.id === koId),
        pruefungStand: String((pruefung.json() as { status?: string }).status ?? ""),
        sucheStatus: suche.statusCode,
        sucheTrifft: treffer.some((t) => t.id === koId),
        belegObjektId,
        quelleStatus: quelle.statusCode,
        // `GET /api/objects/:id` liefert das ganze gespeicherte Objekt (`{ ref, data }`), nicht die
        // flache Referenz — der Name steht deshalb in `ref` (object-routes.ts:305).
        quelleName: String((quelle.json() as { ref?: { name?: string } }).ref?.name ?? ""),
        rohbytesStatus: roh.statusCode,
        // `rawPayload` ist der UNGEDEUTETE Rumpf der Antwort (Buffer) — `payload` wäre eine
        // Zeichenkette und machte aus Binärbytes stillschweigend etwas anderes.
        rohLaenge: roh.rawPayload.length,
        rohAbdruck: abdruckVon(roh.rawPayload),
      },
      verlauf,
    },
  };
}

/** Beide Anwendungen schliessen — der Lauf hält zwei offene Fastify-Instanzen über denselben Bestand. */
export async function schliesse(lauf: Lauf): Promise<void> {
  await lauf.zweiteApp.close();
  await lauf.app.close();
}

/** Das Sitzungsmerkmal aus der `set-cookie`-Kopfzeile — dieselbe Lesart wie im Bestand (job2671 D2). */
function ersterKeks(kopf: string | string[] | undefined): string {
  const rohe = Array.isArray(kopf) ? (kopf[0] ?? "") : (kopf ?? "");
  return String(rohe).split(";")[0] ?? "";
}

/**
 * Eine Liste aus einer Antwort, die auch ein Fehlerobjekt sein kann. Die Strecke MUSS bis zum Ende
 * durchlaufen, selbst wenn ein Schritt gescheitert ist — sonst steht am Ende ein Absturz statt eines
 * lesbaren Befunds, und der Absturz sagt weniger als die Messung. (Gelernt beim Lauf mit Auslassung
 * `quellensicherung`: dort antwortet die Belegstellen-Route mit `{error: …}`, nicht mit einem Feld.)
 */
function alsListe<T>(rohe: unknown): T[] {
  return Array.isArray(rohe) ? (rohe as T[]) : [];
}

/**
 * Die Form, in der ein Entwurf vom Server zurückkommt — Einzeladresse und Listeneintrag tragen
 * dieselbe (capture-routes: `{ ...draft, anchorsMissing }`). Alles optional, weil ein Server, der
 * Felder verliert, genau das tun würde und der Test das MESSEN soll statt daran abzustürzen.
 */
interface Entwurfsantwort {
  readonly id?: string;
  readonly updatedAt?: string;
  readonly payload?: {
    readonly title?: string;
    readonly statement?: string;
    readonly bodyHtml?: string | null;
    readonly pendingSources?: readonly {
      readonly label?: string;
      readonly excerpt?: string;
      readonly anchorKey?: string;
      readonly objectId?: string;
    }[];
    readonly anchorDocuments?: readonly {
      readonly key?: string;
      readonly objectId?: string;
      readonly name?: string;
      readonly mime?: string;
    }[];
  };
  readonly anchorsMissing?: string[];
}

/** Was von einem wiedergeöffneten Entwurf zurückkam — ohne Urteil, nur gelesen. */
function liesWiedersehen(p: Entwurfsantwort["payload"]): Wiedersehen {
  const anker = p?.anchorDocuments ?? [];
  const belege = p?.pendingSources ?? [];
  return {
    titel: String(p?.title ?? ""),
    aussage: String(p?.statement ?? ""),
    quellsatzDa: (p?.bodyHtml ?? "").includes(QUELLSATZ),
    ankerObjekte: anker.map((doc) => String(doc.objectId ?? "")),
    ankerName: String(anker[0]?.name ?? ""),
    belegObjekte: belege.filter((src) => src.objectId).map((src) => String(src.objectId)),
    belegZitat: String(belege[0]?.excerpt ?? ""),
  };
}

/** SHA-256, hex. Der Vergleichswert für „es sind DIESELBEN Bytes", nicht „es kamen Bytes". */
function abdruckVon(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
