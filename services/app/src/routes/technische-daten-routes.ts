import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { CaptureService, Draft, DraftPayload } from "../../../capture";
import { type Guards, type SessionUser, sendError } from "../http";
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

// ================================================================================================
// BPA-02 · ÜBERNAHME TECHNISCHER DATEN — DREI WEGE ÜBER DEN VORHANDENEN ENTWURFSDIENST.
// ================================================================================================
//
//   POST /api/technische-daten/vorschau          Extraktion zeigen, nichts speichern.
//   POST /api/technische-daten/uebernahme        Geschützten Entwurf anlegen (idempotent).
//   POST /api/technische-daten/quellenabgleich   Eigene Übernahmen aus diesem Abschnitt nennen,
//                                                deren Fassung von der jetzt gelesenen abweicht.
//
// RECHTE GETRENNT (roles_rights): Lesen der Quelle hat der Adapter in der Sitzung des Menschen
// getan — der Server ruft keine Adresse ab. Schreiben ins Ziel prüft hier `ko.create`, dieselbe
// Berechtigung wie jeder Entwurf. Fachliche Freigabe und Übernahme ins Wissen bleiben beim
// bestehenden Einreich-/Validierungsweg; diese Routen setzen keines von beiden.
//
// KEIN KI-AUFRUF: die Extraktion ist regelbasiert (`technische-daten.ts`). Keine Schutzstufe, kein
// „Keine KI"-Schalter und kein Anbieter wird dadurch berührt.

export interface TechnischeDatenDeps {
  capture: CaptureService;
}

const SCHUTZKLASSEN = ["intern", "vertraulich", "streng_vertraulich"] as const;
type Schutzklasse = (typeof SCHUTZKLASSEN)[number];

/** Vorläufige Stufe bei unbekannter Schutzklasse (P01): die strengste, privat, ohne Vorlage. */
const GESCHUETZTE_KLAERUNG: Schutzklasse = "streng_vertraulich";

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
  QUELLE_GEAENDERT:
    "Die Quelle hat sich seit der Vorschau geändert. Bitte die neue Fassung prüfen und erneut übernehmen.",
  KEINE_WERTE:
    "Für dieses Ziel wurde im Abschnitt kein Wert gefunden. Es wurde nichts gespeichert.",
  ZUSTAND_FORM: "Zustand muss „vorhanden“ oder „geloescht“ sein.",
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

export function technischeDatenRoutes(
  deps: TechnischeDatenDeps,
  guards: Guards,
): FastifyPluginAsync {
  const { capture } = deps;

  return async (app) => {
    app.post("/api/technische-daten/vorschau", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) return;
      const eingang = leseEingang(request.body, reply);
      if (!eingang) return;
      reply.code(200).send(vorschauAntwort(eingang.belege, eingang.ziel));
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

      // Fassungsabgleich (AC08): hat sich ein Beleg seit der Vorschau geändert, wird nichts
      // gespeichert; die Antwort trägt die neue Vorschau und — wenn die alte Fassung mitkam —
      // die zellgenauen Änderungen.
      const erwartet = body.erwarteteFassungen;
      if (erwartet !== undefined) {
        if (!Array.isArray(erwartet) || erwartet.length !== eingang.belege.length) {
          ablehnen(reply, 400, "BELEG_FORM");
          return;
        }
        const vorher = Array.isArray(body.vorschauBelege) ? body.vorschauBelege : [];
        const geaendert = eingang.belege
          .map((b, i) => ({ b, i, aktuell: belegFassung(b), erwartet: erwartet[i] }))
          .filter((x) => x.aktuell !== x.erwartet)
          .map((x) => {
            const alt = vorher[x.i] as unknown;
            const altGueltig =
              pruefeAbschnitt(alt) === null &&
              belegFassung(alt as ErfassterAbschnitt) === x.erwartet;
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
          ablehnen(reply, 409, "QUELLE_GEAENDERT", {
            geaendert,
            vorschau: vorschauAntwort(eingang.belege, eingang.ziel),
          });
          return;
        }
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
      reply.code(200).send(await abgleichen(capture, user, beleg, zustand));
    });
  };
}

/**
 * Pflege (AC08/AC09): welche EIGENEN Übernahmen stammen aus genau diesem Abschnitt, und mit welcher
 * Fassung? Gelesen wird die Quellenliste der Entwürfe — dieselbe, die beim Einreichen zur Herkunft
 * des Wissensobjekts wird. Eine gewöhnliche Quellenlöschung löscht hier nichts: die Übernahme
 * bleibt mit Herkunft erhalten und wird nur als „Quelle nicht mehr erreichbar" gekennzeichnet.
 */
async function abgleichen(
  capture: CaptureService,
  user: SessionUser,
  beleg: ErfassterAbschnitt,
  zustand: "vorhanden" | "geloescht",
) {
  const adresse = belegAdresse(beleg);
  const aktuell = zustand === "vorhanden" ? belegFassung(beleg) : null;
  const eigene = await capture.listDraftsForResume(user.id);
  const treffer = [];
  for (const { draft } of eigene) {
    for (const quelle of draft.payload.pendingSources ?? []) {
      if (quelle.url !== adresse || !quelle.excerpt?.includes(`Abschnitt: ${beleg.abschnitt}`)) {
        continue;
      }
      const erfasst = fassungAusAuszug(quelle.excerpt);
      treffer.push({
        entwurfId: draft.id,
        titel: draft.payload.title ?? "",
        erfassteFassung: erfasst,
        aktuelleFassung: aktuell,
        lage:
          zustand === "geloescht"
            ? "quelle_nicht_mehr_erreichbar"
            : erfasst === aktuell
              ? "unveraendert"
              : "quelle_geaendert",
      });
    }
  }
  return {
    zustand,
    aktuelleFassung: aktuell,
    betroffen: treffer.filter((t) => t.lage !== "unveraendert"),
    unveraendert: treffer.filter((t) => t.lage === "unveraendert"),
  };
}
