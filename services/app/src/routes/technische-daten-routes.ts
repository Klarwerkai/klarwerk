import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { AuditService } from "../../../audit";
import type { CaptureService, Draft, DraftPayload } from "../../../capture";
import type { KnowledgeObject, KoService } from "../../../knowledge-object";
import type { LifecycleService } from "../../../lifecycle";
import { type Guards, type SessionUser, sendError } from "../http";
import { darfSehen } from "../sichtbarkeit";
import {
  BEWERTUNG,
  BEWERTUNG_ERKLAERUNG,
  type ErfassterAbschnitt,
  GRENZEN,
  type Ziel,
  belegAdresse,
  belegFassung,
  entwurfHtml,
  fassungAusAuszug,
  fassungsMarke,
  fassungsUnterschied,
  pruefeAbschnitt,
  uebernahmeAufbauen,
  uebernahmeKennung,
} from "../technische-daten";
import {
  QUELLENBEOBACHTUNG_AKTION,
  QUELLENRECHTE_AKTION,
  QUELLRECHTE_VORHER_AKTION,
  type QuellLage,
  belegstellenGesperrt,
  letzteBeobachtung,
  quellKennungAus,
  quellKennungVon,
  quelleGesperrt,
} from "../technische-daten-quellen";

// ================================================================================================
// BPA-02 · ÜBERNAHME TECHNISCHER DATEN — ÜBER DEN VORHANDENEN ENTWURFSDIENST.
// ================================================================================================
//
//   POST /api/technische-daten/vorschau          Extraktion zeigen, nichts speichern; liefert den
//                                                signierten Vorschaubeleg.
//   POST /api/technische-daten/uebernahme        Geschützten Entwurf anlegen (idempotent) — nur mit
//                                                Vorschaubeleg und NEU gelesener Quelle.
//   POST /api/technische-daten/quellenabgleich   Pflege: eigene Entwürfe und sichtbare
//                                                Wissensobjekte aus diesem Abschnitt nennen,
//                                                Abweichung dauerhaft vermerken.
//   POST /api/technische-daten/quellenrechte     Rechteentzug/-erteilung der Quelle (ko.validate)
//                                                über den bestehenden Quellrechte-Weg.
//
// RECHTE GETRENNT (roles_rights): Lesen der Quelle tut der Browseradapter in der Sitzung des
// Menschen — der Server ruft keine Adresse ab, eine bloss genannte URL verschafft keinen Zugriff.
// Schreiben ins Ziel prüft `ko.create`. Die Rechte der Quelle selbst führt der bestehende Weg
// `KoService.setQuellrechte` (Leserkreis am Wissensobjekt, durchgesetzt von `darfSehen` und dem
// SQL-Sichtbarkeitsfilter der Suche); die Sperre der laufenden Verarbeitung steht hier.
//
// KEIN KI-AUFRUF: die Extraktion ist regelbasiert (`technische-daten.ts`).

export interface TechnischeDatenDeps {
  capture: CaptureService;
  ko: Pick<KoService, "list" | "setQuellrechte">;
  lifecycle: Pick<LifecycleService, "requestRevalidation">;
  audit: Pick<AuditService, "record" | "list">;
  /** Schlüssel des Vorschaubelegs; im Betrieb je Prozess zufällig (Neustart = neue Vorschau). */
  vorschauSchluessel?: Buffer;
  /** Zeitquelle (ms); im Betrieb `Date.now`. */
  uhr?: () => number;
}

const SCHUTZKLASSEN = ["intern", "vertraulich", "streng_vertraulich"] as const;
type Schutzklasse = (typeof SCHUTZKLASSEN)[number];

/** Vorläufige Stufe bei unbekannter Schutzklasse (P01): die strengste, privat, ohne Vorlage. */
const GESCHUETZTE_KLAERUNG: Schutzklasse = "streng_vertraulich";

/** So lange gilt ein Vorschaubeleg; danach ist eine neue Vorschau nötig. */
export const VORSCHAU_GUELTIG_MS = 30 * 60 * 1000;

// Die Protokollvorgänge und die Quellsperre wohnen in EINEM Modul, das auch die Entwurfs- und
// Wissensrouten lesen (`../technische-daten-quellen.ts`). Hier nur weitergereicht.
export { QUELLENBEOBACHTUNG_AKTION, QUELLENRECHTE_AKTION };

const MELDUNG = {
  BELEG_FORM: "Der erfasste Abschnitt hat keine gültige Form.",
  BELEG_URL: "Die Quelle braucht eine absolute http(s)-Adresse.",
  QUELLABSCHNITT_FEHLT:
    "Die Quelle braucht einen genauen Abschnitt. Eine Seitenadresse allein genügt nicht.",
  BELEG_ZEIT: "Der Erfassungszeitpunkt fehlt oder hat keine Zeitzone.",
  BELEG_UMFANG: "Der erfasste Abschnitt ist leer oder zu gross.",
  BELEGE_FEHLEN: "Mindestens ein und höchstens fünf erfasste Abschnitte angeben.",
  ZIEL_FORM: "Ziel braucht ein Objekt als Text; die Variante ist optional.",
  SCHUTZKLASSE_FORM: "Unbekannte Schutzklasse-Angabe.",
  FASSUNGSABGLEICH_FEHLT:
    "Vor der Übernahme fehlt der Abgleich mit der geprüften Vorschau. Bitte zuerst die Vorschau öffnen und die Quelle danach neu lesen.",
  VORSCHAU_UNGUELTIG:
    "Die Vorschau gehört nicht zu diesem Auftrag oder ist abgelaufen. Bitte die Vorschau erneut öffnen.",
  QUELLE_NICHT_NEU_GELESEN:
    "Die Quelle wurde seit der Vorschau nicht neu gelesen. Es wurde nichts gespeichert.",
  QUELLE_GEAENDERT:
    "Die Quelle hat sich seit der Vorschau geändert. Bitte die neue Fassung prüfen und erneut übernehmen.",
  QUELLE_GESPERRT:
    "Für diese Quelle ist das Leserecht entzogen. Erfassung und Übernahme sind gesperrt.",
  KEINE_WERTE:
    "Für dieses Ziel wurde im Abschnitt kein Wert gefunden. Es wurde nichts gespeichert.",
  ZUSTAND_FORM: "Unbekannter Zustand der Quelle.",
} as const;

type Fehler = keyof typeof MELDUNG;

function ablehnen(reply: FastifyReply, status: number, code: Fehler, extra: object = {}): void {
  const message = MELDUNG[code];
  reply.code(status).send({ error: code, message, ...extra });
}

interface Eingang {
  belege: ErfassterAbschnitt[];
  ziel: Ziel;
}

function leseEingang(body: unknown, reply: FastifyReply): Eingang | undefined {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!Array.isArray(b.belege) || b.belege.length === 0 || b.belege.length > GRENZEN.belege) {
    ablehnen(reply, 400, "BELEGE_FEHLEN");
    return undefined;
  }
  for (const beleg of b.belege) {
    const fehler = pruefeAbschnitt(beleg);
    if (fehler) {
      ablehnen(reply, 400, fehler);
      return undefined;
    }
  }
  const ziel: unknown = b.ziel ?? {};
  if (typeof ziel !== "object" || ziel === null || Array.isArray(ziel)) {
    ablehnen(reply, 400, "ZIEL_FORM");
    return undefined;
  }
  const { objekt, variante } = ziel as { objekt?: unknown; variante?: unknown };
  const textOderLeer = (t: unknown) =>
    t === undefined || (typeof t === "string" && t.length <= 200);
  if (!textOderLeer(objekt) || !textOderLeer(variante)) {
    ablehnen(reply, 400, "ZIEL_FORM");
    return undefined;
  }
  return {
    belege: b.belege as ErfassterAbschnitt[],
    ziel: {
      ...(typeof objekt === "string" ? { objekt } : {}),
      ...(typeof variante === "string" ? { variante } : {}),
    },
  };
}

function vorschauAntwort(belege: ErfassterAbschnitt[], ziel: Ziel) {
  const u = uebernahmeAufbauen(belege, ziel);
  return {
    belege: u.extraktionen.map((e) => ({ ...e.beleg, fassung: e.fassung })),
    geraete: u.geraete,
    abweichungen: u.abweichungen,
    klaerungen: u.klaerungen,
    bewertung: { kriterien: BEWERTUNG, erklaerung: BEWERTUNG_ERKLAERUNG },
    verarbeitung: { art: "regelbasiert", kiAnbieter: null },
  };
}

/**
 * Ein Beleg als Quelle des Entwurfs. Die Fassungsmarke steht VORN im Auszug, damit die Kürzung auf
 * 500 Zeichen sie nie abschneidet; der Quellenabgleich liest sie von dort zurück.
 */
function quellenEintrag(b: ErfassterAbschnitt) {
  const name = b.titel?.trim() || new URL(b.url).hostname;
  const teile = [
    fassungsMarke(belegFassung(b)),
    `Abschnitt: ${b.abschnitt}`,
    `erfasst ${b.abgerufenAm}`,
    ...(b.stand ? [`Stand ${b.stand}`] : []),
  ];
  return {
    label: `${name} · ${b.abschnitt}`.slice(0, 300),
    url: belegAdresse(b),
    excerpt: teile.join(" · ").slice(0, 500),
    sourceProvider: b.art === "datenblatt" ? "Datenblatt" : "Webseite",
  };
}

// ------------------------------------------------------------------------------------------------
// Quellkennung und Zuordnung — dieselbe Regel für Entwürfe und eingereichte Wissensobjekte
// ------------------------------------------------------------------------------------------------

type QuellOrt = Pick<ErfassterAbschnitt, "url" | "abschnitt" | "anker">;

/** Kennung einer Quelle im Prüfprotokoll: Hash über Adresse und Abschnitt, keine Klartextangabe. */
export function quellKennung(q: QuellOrt): string {
  return quellKennungAus(belegAdresse(q), q.abschnitt);
}

/** Stammt diese Belegstelle (Entwurfsquelle oder Quellanker) aus genau diesem Abschnitt? */
function ausAbschnitt(
  s: { url?: string | null | undefined; excerpt?: string | null | undefined },
  q: QuellOrt,
): boolean {
  return quellKennungVon(s) === quellKennung(q);
}

const LAGE = / · Lage: .*$/;

/** Der Auszug mit dauerhaft vermerkter Lage — oder ohne Vermerk, wenn die Quelle wieder stimmt. */
function auszugMitLage(auszug: string, lage: string | null): string {
  const basis = auszug.replace(LAGE, "");
  return (lage ? `${basis} · Lage: ${lage}` : basis).slice(0, 500);
}

// ------------------------------------------------------------------------------------------------
// Der Vorschaubeleg (AC08): bindet Konto, Ziel, geprüfte Fassungen und deren Erfassungszeit
// ------------------------------------------------------------------------------------------------

interface Vorschaubeleg {
  konto: string;
  ziel: string;
  fassungen: string[];
  erfasst: string[];
  am: number;
}

/**
 * Wofür die Vorschau gilt: Ziel und die ORTE der Belege (Adresse, Abschnitt) — bewusst ohne
 * Inhalt, damit eine geänderte Quelle als Änderung erkannt wird und nicht als fremde Vorschau.
 */
function zielKennung(belege: ErfassterAbschnitt[], ziel: Ziel): string {
  const roh = JSON.stringify([
    (ziel.objekt ?? "").trim().toLowerCase(),
    (ziel.variante ?? "").trim().toLowerCase(),
    belege.map((b) => [belegAdresse(b), b.abschnitt]),
  ]);
  return createHash("sha256").update(roh, "utf8").digest("hex");
}

function signiere(beleg: Vorschaubeleg, schluessel: Buffer): string {
  const inhalt = Buffer.from(JSON.stringify(beleg), "utf8").toString("base64url");
  const signatur = createHmac("sha256", schluessel).update(inhalt).digest("base64url");
  return `${inhalt}.${signatur}`;
}

function pruefeSignatur(roh: unknown, schluessel: Buffer): Vorschaubeleg | null {
  if (typeof roh !== "string" || roh.length > 8192) return null;
  const [inhalt, signatur] = roh.split(".");
  if (!inhalt || !signatur) return null;
  const erwartet = createHmac("sha256", schluessel).update(inhalt).digest();
  const erhalten = Buffer.from(signatur, "base64url");
  if (erhalten.length !== erwartet.length || !timingSafeEqual(erhalten, erwartet)) return null;
  try {
    const b = JSON.parse(Buffer.from(inhalt, "base64url").toString("utf8")) as Vorschaubeleg;
    const texte = (x: unknown) => Array.isArray(x) && x.every((t) => typeof t === "string");
    return typeof b.konto === "string" &&
      typeof b.ziel === "string" &&
      texte(b.fassungen) &&
      texte(b.erfasst) &&
      typeof b.am === "number"
      ? b
      : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------------------------------------

export function technischeDatenRoutes(
  deps: TechnischeDatenDeps,
  guards: Guards,
): FastifyPluginAsync {
  const { capture, ko, lifecycle, audit } = deps;
  const schluessel = deps.vorschauSchluessel ?? randomBytes(32);
  const uhr = deps.uhr ?? Date.now;

  /** Ist das Leserecht dieser Quelle entzogen? Maßgeblich ist der jüngste Rechtevermerk. */
  async function gesperrt(belege: QuellOrt[]): Promise<boolean> {
    for (const b of belege) {
      if (await quelleGesperrt(audit, quellKennung(b))) return true;
    }
    return false;
  }

  /** Der beim letzten Übergang in die Sperre festgehaltene Leserkreis — oder `null` (keiner). */
  async function leserkreisVorDerSperre(koId: string): Promise<Record<string, unknown> | null> {
    const eintraege = await audit.list({ action: QUELLRECHTE_VORHER_AKTION, target: koId });
    const letzter = eintraege.reduce<(typeof eintraege)[number] | undefined>(
      (bisher, e) => (!bisher || e.seq > bisher.seq ? e : bisher),
      undefined,
    );
    const vorher = letzter?.payload.vorher;
    return vorher && typeof vorher === "object" ? (vorher as Record<string, unknown>) : null;
  }

  /** Eingereichte Wissensobjekte mit einem Quellanker aus diesem Abschnitt — ohne Sichtfilter. */
  async function wissenAusQuelle(q: QuellOrt): Promise<KnowledgeObject[]> {
    const alle = await ko.list();
    return alle.filter((k) => (k.sources ?? []).some((s) => ausAbschnitt(s, q)));
  }

  const plugin: FastifyPluginAsync = async (app) => {
    app.post("/api/technische-daten/vorschau", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) return;
      const eingang = leseEingang(request.body, reply);
      if (!eingang) return;
      if (await gesperrt(eingang.belege)) {
        ablehnen(reply, 403, "QUELLE_GESPERRT");
        return;
      }
      const beleg: Vorschaubeleg = {
        konto: user.id,
        ziel: zielKennung(eingang.belege, eingang.ziel),
        fassungen: eingang.belege.map(belegFassung),
        erfasst: eingang.belege.map((b) => b.abgerufenAm),
        am: uhr(),
      };
      reply.code(200).send({
        ...vorschauAntwort(eingang.belege, eingang.ziel),
        vorschaubeleg: signiere(beleg, schluessel),
      });
    });

    app.post("/api/technische-daten/uebernahme", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) return;
      const eingang = leseEingang(request.body, reply);
      if (!eingang) return;
      const body = request.body as Record<string, unknown>;

      // Schutzklasse: angegeben oder unbekannt. Unbekannt führt in die geschützte Klärung (P01) —
      // vorläufig strengste Stufe, privat, ohne Vorlage. Sie wird nie aus dem Inhalt geraten.
      const roh = body.schutzklasse;
      if (roh !== undefined && roh !== null && !SCHUTZKLASSEN.includes(roh as Schutzklasse)) {
        ablehnen(reply, 400, "SCHUTZKLASSE_FORM");
        return;
      }
      const unbekannt = roh === undefined || roh === null;
      const stufe: Schutzklasse = unbekannt ? GESCHUETZTE_KLAERUNG : (roh as Schutzklasse);

      // ==========================================================================================
      // AC08 — DER FASSUNGSABGLEICH IST PFLICHT, UND ER VERGLEICHT GEGEN DIE GEPRÜFTE VORSCHAU.
      // ==========================================================================================
      //
      // Der Vorschaubeleg ist vom Server signiert und bindet Konto, Ziel, die geprüften Fassungen
      // und deren Erfassungszeiten. Ohne ihn keine Übernahme. Die Belege dieser Anfrage müssen vom
      // Adapter NACH der Vorschau neu gelesen sein (spätere Erfassungszeit als der geprüfte Stand):
      // ein erneut gesendeter alter Beleg ist kein Abgleich mit der Quelle. Weicht die neu gelesene
      // Fassung ab, wird nichts gespeichert; die Antwort trägt die neue Vorschau samt Beleg.
      if (body.vorschaubeleg === undefined) {
        ablehnen(reply, 428, "FASSUNGSABGLEICH_FEHLT");
        return;
      }
      const vorschau = pruefeSignatur(body.vorschaubeleg, schluessel);
      if (
        !vorschau ||
        vorschau.konto !== user.id ||
        vorschau.ziel !== zielKennung(eingang.belege, eingang.ziel) ||
        vorschau.fassungen.length !== eingang.belege.length ||
        uhr() - vorschau.am > VORSCHAU_GUELTIG_MS
      ) {
        ablehnen(reply, 409, "VORSCHAU_UNGUELTIG");
        return;
      }
      const nichtNeu = eingang.belege.some(
        (b, i) => !(Date.parse(b.abgerufenAm) > Date.parse(vorschau.erfasst[i] ?? "")),
      );
      if (nichtNeu) {
        ablehnen(reply, 409, "QUELLE_NICHT_NEU_GELESEN");
        return;
      }
      if (await gesperrt(eingang.belege)) {
        ablehnen(reply, 403, "QUELLE_GESPERRT");
        return;
      }
      const vorher = Array.isArray(body.vorschauBelege) ? body.vorschauBelege : [];
      const geaendert = eingang.belege
        .map((b, i) => ({ b, i, aktuell: belegFassung(b), erwartet: vorschau.fassungen[i] }))
        .filter((x) => x.aktuell !== x.erwartet)
        .map((x) => {
          const alt = vorher[x.i] as unknown;
          const altGueltig =
            pruefeAbschnitt(alt) === null && belegFassung(alt as ErfassterAbschnitt) === x.erwartet;
          return {
            url: x.b.url,
            abschnitt: x.b.abschnitt,
            erwarteteFassung: x.erwartet,
            aktuelleFassung: x.aktuell,
            ...(altGueltig
              ? { aenderungen: fassungsUnterschied(alt as ErfassterAbschnitt, x.b) }
              : {}),
          };
        });
      if (geaendert.length > 0) {
        const neu: Vorschaubeleg = {
          konto: user.id,
          ziel: vorschau.ziel,
          fassungen: eingang.belege.map(belegFassung),
          erfasst: eingang.belege.map((b) => b.abgerufenAm),
          am: uhr(),
        };
        ablehnen(reply, 409, "QUELLE_GEAENDERT", {
          geaendert,
          vorschau: {
            ...vorschauAntwort(eingang.belege, eingang.ziel),
            vorschaubeleg: signiere(neu, schluessel),
          },
        });
        return;
      }

      const u = uebernahmeAufbauen(eingang.belege, eingang.ziel);
      if (u.geraete.length === 0) {
        ablehnen(reply, 422, "KEINE_WERTE", { klaerungen: u.klaerungen });
        return;
      }
      const objekt =
        eingang.ziel.objekt?.trim() ||
        u.geraete
          .map((g) => g.modell)
          .filter(Boolean)
          .join(", ");
      const variante = eingang.ziel.variante?.trim();
      const offen = u.klaerungen.length + u.abweichungen.length + (unbekannt ? 1 : 0);
      const payload: DraftPayload = {
        title: `Technische Daten · ${objekt}${variante ? ` / ${variante}` : ""}`.slice(0, 200),
        statement:
          offen > 0
            ? `Technische Daten aus ${eingang.belege.length} Beleg(en); ${offen} Klärung(en) offen.`
            : `Technische Daten aus ${eingang.belege.length} Beleg(en); keine Klärung offen.`,
        type: "technik",
        bodyHtml: entwurfHtml(u, unbekannt),
        confidentiality: stufe,
        pendingSources: eingang.belege.map(quellenEintrag),
      };
      const kennung = uebernahmeKennung(eingang.belege, eingang.ziel);
      try {
        // AC06/AC10 NACH DEM EINREICHEN: der Entwurf ist dann verbraucht, seine Vorgangskennung
        // trägt nicht mehr. Steht dieselbe Übernahme (gleicher Titel, jede Belegfassung gleich)
        // schon als sichtbares Wissensobjekt im Bestand, wird es genannt — kein zweiter Entwurf.
        const erster = eingang.belege[0] as ErfassterAbschnitt;
        const imWissen = (await wissenAusQuelle(erster)).find(
          (k) =>
            darfSehen(user, k) &&
            k.title === payload.title &&
            eingang.belege.every((b) =>
              (k.sources ?? []).some(
                (s) =>
                  ausAbschnitt(s, b) &&
                  fassungAusAuszug(s.excerpt ?? undefined) === belegFassung(b),
              ),
            ),
        );
        if (imWissen) {
          reply.code(200).send({
            wiederholung: true,
            wissensobjekt: { id: imWissen.id, fassung: imWissen.version },
            stand: {
              entwurf: "nicht_angelegt",
              uebernahmeInsWissen: "erfolgt",
              fachlicheFreigabe: imWissen.status === "validiert" ? "erteilt" : "nicht_erteilt",
            },
            geschuetzteKlaerung: unbekannt,
            ...vorschauAntwort(eingang.belege, eingang.ziel),
          });
          return;
        }
        let ergebnis: { draft: Draft; angelegt: boolean };
        try {
          ergebnis = await capture.createDraftVorgang(payload, user.id, kennung);
        } catch (error) {
          // Dieselben Belegfassungen für dasselbe Ziel, nur später erneut erfasst (anderer
          // Erfassungszeitpunkt oder andere Stufe): das ist dieselbe Übernahme, keine neue. Der
          // vorhandene eigene Entwurf wird genannt; es entsteht keine Dublette (AC06).
          const code = (error as { code?: unknown } | null)?.code;
          const vorhanden =
            code === "IDEMPOTENCY_PAYLOAD_MISMATCH"
              ? (await capture.listDraftsForResume(user.id)).find(
                  (e) => e.draft.createOperation?.id === kennung,
                )
              : undefined;
          if (!vorhanden) throw error;
          ergebnis = { draft: vorhanden.draft, angelegt: false };
        }
        const { draft, angelegt } = ergebnis;
        reply.code(angelegt ? 201 : 200).send({
          entwurf: {
            id: draft.id,
            eigentuemer: draft.originalAuthor,
            schutzklasse: draft.payload.confidentiality ?? null,
            privat: draft.imPool !== true,
            angelegtAm: draft.createdAt,
          },
          wiederholung: !angelegt,
          // AC10: drei getrennte Zustände — nur der erste ist hier erreicht.
          stand: {
            entwurf: "gespeichert",
            uebernahmeInsWissen: "nicht_erfolgt",
            fachlicheFreigabe: "nicht_erteilt",
          },
          geschuetzteKlaerung: unbekannt,
          ...vorschauAntwort(eingang.belege, eingang.ziel),
        });
      } catch (error) {
        sendError(reply, error);
      }
    });

    // ============================================================================================
    // PFLEGE (AC08/AC09) — EIGENE ENTWÜRFE UND EINGEREICHTE WISSENSFASSUNGEN.
    // ============================================================================================
    //
    // Der Adapter liest den Abschnitt neu (oder findet ihn nicht mehr: `zustand: "geloescht"`).
    // Betroffen ist jede eigene Übernahme und jedes für diese Person sichtbare Wissensobjekt mit
    // einer Belegstelle aus genau diesem Abschnitt. Die Wirkung bleibt in den vorhandenen Wegen:
    //   · Entwurf: die Lage steht DAUERHAFT an seiner Quelle („Lage: …"), über `continueDraft`.
    //   · Wissensobjekt: der vorhandene Merker „Stimmt das noch?" (`requestRevalidation`) — er
    //     benachrichtigt Autor bzw. Nachfolger und erscheint in Bibliothek und Qualitätsaufgaben.
    //   · Beide: ein Prüfprotokolleintrag mit Kennung, Zustand und Fassungen (ohne Adresse).
    // Eine gewöhnliche Quellenlöschung löscht und sperrt nichts: der Import bleibt mit Herkunft
    // erhalten und trägt den Vermerk „Quelle nicht mehr erreichbar".
    app.post("/api/technische-daten/quellenabgleich", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) return;
      const body = (request.body ?? {}) as Record<string, unknown>;
      const fehler = pruefeAbschnitt(body.beleg);
      if (fehler) {
        ablehnen(reply, 400, fehler);
        return;
      }
      const zustand = body.zustand ?? "vorhanden";
      if (zustand !== "vorhanden" && zustand !== "geloescht") {
        ablehnen(reply, 400, "ZUSTAND_FORM");
        return;
      }
      const beleg = body.beleg as ErfassterAbschnitt;
      try {
        reply.code(200).send(await abgleichen(user, beleg, zustand));
      } catch (error) {
        sendError(reply, error);
      }
    });

    // ============================================================================================
    // RECHTEENTZUG (AC09) — ÜBER DEN BESTEHENDEN QUELLRECHTE-WEG, NUR FÜR DIE FACHPRÜFUNG.
    // ============================================================================================
    //
    // `entzogen`: jedes Wissensobjekt mit Belegstelle aus diesem Abschnitt bekommt den Leserkreis
    // „niemand" (`setQuellrechte`, leer) — damit sperren `darfSehen`, die Suche (SQL-Filter) und
    // jede Ableitung über dieselbe Regel. Entwürfe aus der Quelle gehen in den Papierkorb ihrer
    // Autorin (umkehrbar, kein Löschen). Der Rechtevermerk sperrt Vorschau und Übernahme, auch eine
    // laufende: die Übernahme prüft ihn unmittelbar vor dem Speichern.
    // `erteilt`: die Sperre fällt NUR, wenn keine andere Herkunftsquelle des Objekts noch gesperrt
    // ist (Nacharbeit 5, Ben). Dann gilt wieder der Leserkreis von VOR der ersten Sperre — er wurde
    // beim Übergang in die Sperre festgehalten (`QUELLRECHTE_VORHER_AKTION`); eine bestehende
    // Leserbeschränkung, etwa aus einem Confluence-Import, bleibt so erhalten. Entwürfe im Papierkorb
    // stellt ihre Autorin selbst wieder her — erst jetzt lässt der Papierkorb es zu.
    app.post("/api/technische-daten/quellenrechte", async (request, reply) => {
      const user = await guards.requirePermission("ko.validate", request, reply);
      if (!user) return;
      const body = (request.body ?? {}) as Record<string, unknown>;
      const ort = {
        art: "html",
        url: body.url,
        abschnitt: body.abschnitt,
        ...(body.anker !== undefined ? { anker: body.anker } : {}),
        abgerufenAm: new Date(uhr()).toISOString(),
        kopf: ["-"],
        zeilen: [["-"]],
      };
      const fehler = pruefeAbschnitt(ort);
      if (fehler) {
        ablehnen(reply, 400, fehler);
        return;
      }
      const zustand = body.zustand;
      if (zustand !== "entzogen" && zustand !== "erteilt") {
        ablehnen(reply, 400, "ZUSTAND_FORM");
        return;
      }
      const q = ort as unknown as QuellOrt;
      try {
        const am = new Date(uhr()).toISOString();
        let wissensobjekte = 0;
        let weiterhinGesperrt = 0;
        let entwuerfe = 0;
        for (const k of await wissenAusQuelle(q)) {
          const stufe = k.confidentiality ?? "intern";
          const quellen = k.sources ?? [];
          const andereGesperrt = await belegstellenGesperrt(
            audit,
            quellen.filter((s) => !ausAbschnitt(s, q)),
          );
          wissensobjekte += 1;
          if (zustand === "entzogen") {
            // Übergang in die Sperre (noch keine Quelle des Objekts gesperrt): den bisherigen
            // Leserkreis festhalten, bevor er durch „niemand" ersetzt wird.
            if (!(await belegstellenGesperrt(audit, quellen))) {
              await audit.record({
                actor: user.id,
                action: QUELLRECHTE_VORHER_AKTION,
                target: k.id,
                payload: { vorher: k.quellrechte ?? null },
              });
            }
            await ko.setQuellrechte(k.id, { stufe, leser: [], beobachtetAm: am }, user.id);
            continue;
          }
          if (andereGesperrt) {
            // Eine andere Herkunftsquelle ist weiter gesperrt — die Sperre bleibt, wie sie ist.
            weiterhinGesperrt += 1;
            continue;
          }
          const vorher = await leserkreisVorDerSperre(k.id);
          await ko.setQuellrechte(
            k.id,
            vorher ? { ...vorher, beobachtetAm: am } : { stufe, beobachtetAm: am },
            user.id,
          );
        }
        if (zustand === "entzogen") {
          for (const { draft } of await capture.listDraftsForResume(undefined, { mitPool: true })) {
            if ((draft.payload.pendingSources ?? []).some((s) => ausAbschnitt(s, q))) {
              await capture.deleteDraft(draft.id, user.id);
              entwuerfe += 1;
            }
          }
        }
        await audit.record({
          actor: user.id,
          action: QUELLENRECHTE_AKTION,
          target: quellKennung(q),
          payload: { zustand, wissensobjekte, weiterhinGesperrt, entwuerfe },
        });
        // Nur Anzahlen — keine Kennungen oder Titel gesperrter Inhalte (P05/G05).
        reply.code(200).send({ zustand, wissensobjekte, weiterhinGesperrt, entwuerfe });
      } catch (error) {
        sendError(reply, error);
      }
    });
  };

  /** Pflege einer Quelle für diese Person: eigene Entwürfe und für sie sichtbare Wissensobjekte. */
  async function abgleichen(
    user: SessionUser,
    beleg: ErfassterAbschnitt,
    zustand: "vorhanden" | "geloescht",
  ) {
    const aktuell = zustand === "vorhanden" ? belegFassung(beleg) : null;
    const am = new Date(uhr()).toISOString();
    const lageVon = (erfasst: string | null): QuellLage => {
      if (zustand === "geloescht") return "quelle_nicht_mehr_erreichbar";
      return erfasst === aktuell ? "unveraendert" : "quelle_geaendert";
    };
    const vermerk = (lage: string) => {
      if (lage === "quelle_nicht_mehr_erreichbar") {
        return `Quelle nicht mehr erreichbar (festgestellt ${am})`;
      }
      if (lage === "quelle_geaendert") {
        const kurz = (aktuell ?? "").slice(0, 12);
        return `Quelle geändert, aktuelle Fassung sha256:${kurz} (festgestellt ${am})`;
      }
      return null;
    };
    const kennung = quellKennung(beleg);
    const protokolliere = (
      ziel: string,
      art: "entwurf" | "wissensobjekt",
      lage: QuellLage,
      erfasst: string | null,
      wissensfassung?: number,
    ) =>
      audit.record({
        actor: user.id,
        action: QUELLENBEOBACHTUNG_AKTION,
        target: ziel,
        payload: {
          art,
          quelle: kennung,
          lage,
          erfassteFassung: erfasst,
          aktuelleFassung: aktuell,
          // Die betroffene Wissensfassung — welche Fassung des Objekts aus dieser Quelle stammt.
          ...(wissensfassung !== undefined ? { wissensfassung } : {}),
        },
      });

    const treffer: {
      art: "entwurf" | "wissensobjekt";
      id: string;
      titel: string;
      fassung?: number;
      erfassteFassung: string | null;
      aktuelleFassung: string | null;
      lage: string;
    }[] = [];

    for (const { draft } of await capture.listDraftsForResume(user.id)) {
      const quellen = draft.payload.pendingSources ?? [];
      const passend = quellen.find((s) => ausAbschnitt(s, beleg));
      if (!passend) continue;
      const erfasst = fassungAusAuszug(passend.excerpt);
      const lage = lageVon(erfasst);
      const neuerAuszug = auszugMitLage(passend.excerpt ?? "", vermerk(lage));
      if (neuerAuszug !== passend.excerpt) {
        await capture.continueDraft(
          draft.id,
          {
            pendingSources: quellen.map((s) =>
              s === passend ? { ...s, excerpt: neuerAuszug } : s,
            ),
          },
          user.id,
        );
        await protokolliere(draft.id, "entwurf", lage, erfasst);
      }
      treffer.push({
        art: "entwurf",
        id: draft.id,
        titel: draft.payload.title ?? "",
        erfassteFassung: erfasst,
        aktuelleFassung: aktuell,
        lage,
      });
    }

    // Nur Wissensobjekte, die diese Person JETZT sehen darf — dieselbe Regel wie jeder Leseweg.
    for (const k of (await wissenAusQuelle(beleg)).filter((x) => darfSehen(user, x))) {
      const anker = (k.sources ?? []).find((s) => ausAbschnitt(s, beleg));
      const erfasst = fassungAusAuszug(anker?.excerpt ?? undefined);
      const lage = lageVon(erfasst);
      // DIE LAGE STEHT DAUERHAFT AM OBJEKT (Nacharbeit 5, Ben): jeder Wechsel — auch zurück zu
      // „unverändert", wenn die Quelle wieder da ist — wird mit der betroffenen Wissensfassung
      // vermerkt. Die Detailansicht liest daraus den Vermerk am Quellenbeleg (`sourceRemovedAt`,
      // `quellenMitLage`); ein Wechsel in eine Abweichung setzt zusätzlich den vorhandenen Merker.
      const zuletzt = await letzteBeobachtung(audit, k.id, kennung);
      const neueLage =
        (zuletzt?.lage ?? "unveraendert") !== lage ||
        (lage === "quelle_geaendert" && zuletzt?.aktuelleFassung !== aktuell);
      if (neueLage) {
        if (lage !== "unveraendert") await lifecycle.requestRevalidation(k.id, user.id);
        await protokolliere(k.id, "wissensobjekt", lage, erfasst, k.version);
      }
      treffer.push({
        art: "wissensobjekt",
        id: k.id,
        titel: k.title,
        fassung: k.version,
        erfassteFassung: erfasst,
        aktuelleFassung: aktuell,
        lage,
      });
    }

    return {
      zustand,
      aktuelleFassung: aktuell,
      betroffen: treffer.filter((t) => t.lage !== "unveraendert"),
      unveraendert: treffer.filter((t) => t.lage === "unveraendert"),
    };
  }

  return plugin;
}
