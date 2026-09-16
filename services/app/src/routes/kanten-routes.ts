// ================================================================================================
// JOB 4151 · WG-PERSISTENZ — DIE TÜR ZU DEN KURATIERTEN BEZIEHUNGEN.
// ================================================================================================
//
// DREI WEGE, ZWEI RECHTE. Lesen hängt an `ko.read` (jede Rolle trägt es), Schreiben an `ko.relate`
// (controller und admin, `services/rbac/src/policy.ts`). Die Trennung ist der ganze Punkt: ein
// Gast soll sehen, wie das Wissen zusammenhängt, und nicht darüber urteilen.
//
// ------------------------------------------------------------------------------------------------
// DREI ZUSAGEN, DIE DIESE DATEI EINHÄLT — und je eine Zeile, an der sie hängt.
// ------------------------------------------------------------------------------------------------
//
//  1. DER URHEBER IST DER ANGEMELDETE MENSCH. Er kommt aus `user.id` und NIE aus der Nutzlast.
//     Eine mitgeschickte `urheber`-Angabe wird schlicht nicht gelesen — nicht geprüft, nicht
//     abgewiesen, nicht beachtet. Eine Prüfung wäre die schwächere Bauart: sie verriete, dass es
//     das Feld gibt, und der nächste Umbau könnte sie vergessen.
//
//  2. UNSICHTBAR UND NICHT VORHANDEN SIND DIESELBE ANTWORT. Der Dienst wirft für alle vier
//     Endpunktgründe (unbekannt, Papierkorb, gelöscht, unsichtbar) denselben
//     `KantenError("FORBIDDEN")` mit derselben Meldung; diese Route reicht ihn unverändert weiter.
//     Es gibt hier KEINEN eigenen Fehlerzweig je Grund — er wäre selbst die Existenzauskunft, die
//     `kanten-service.ts:17-30` verbietet. Dass es 403 und nicht 404 ist, schreibt der API-Vertrag
//     der Steuerung vor und ist die stärkere Wahl: ein 404 träfe für die Kennungen, die es GIBT,
//     eine Aussage.
//
//  3. KEIN SCHNITTZÄHLER, KEINE QUOTE. Die Leseantwort ist zeichengleich die Ausgabe des
//     Lesedienstes (`total` zählt NACH dem Trimm). Diese Route rechnet nichts hinzu und lässt
//     nichts weg — eine Zahl über das Weggelassene wäre dieselbe Auskunft in leiser.
//
// ------------------------------------------------------------------------------------------------
// DREI TÜREN, UND WARUM DER WIDERRUF EIN `POST` IST UND KEIN `DELETE`.
// ------------------------------------------------------------------------------------------------
// Der Auftragstext nennt `DELETE /api/beziehungen/:id`; der verbindliche API-Vertrag der Steuerung
// (HINWEIS zu JOB 4151, 15.09. 17:30) hebt das auf und schreibt `POST /api/beziehungen/:id/widerruf`
// vor — mit der Begründung, die diese Datei teilt: **es wird nichts gelöscht**. Ein `DELETE`, das
// eine Zeile stehen lässt, sagt nach aussen etwas anderes, als innen geschieht, und lädt jede
// spätere Fläche dazu ein, „weg" zu schreiben, wo „zurückgenommen" richtig wäre (G5, G7).
//
// `PATCH /api/beziehungen/:id` (Art/Richtung ändern) ist im Vertrag ausdrücklich OPTIONAL und in
// dieser Runde NICHT gebaut — in der Rückgabe als offener Punkt benannt, nicht stillschweigend
// weggelassen. Wer eine Beziehung anders beurteilt, setzt sie erneut (`POST`, Dedup schreibt fort);
// wer sie zurücknimmt, widerruft sie.
import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import {
  KANTEN_ARTEN,
  KANTEN_RICHTUNGEN,
  type KantenArt,
  KantenError,
  type KantenKoLeser,
  KantenLeseService,
  type KantenRepo,
  type KantenRichtung,
  KantenSchreibService,
  ansichtNachSchreiben,
} from "../../../knowledge-object";
import { type Guards, sendError } from "../http";
import { sichtbarkeitsfilterFuer } from "../sichtbarkeit";

export interface KantenRoutesDeps {
  /** Der Kantenbestand — dieselbe Instanz, die die Kompositionswurzel gewählt hat. */
  kanten: KantenRepo;
  /**
   * Die Leseseite des KO-Bestands. Bewusst der SCHMALE Port `KantenKoLeser` und nicht `KoService`:
   * diese Route braucht genau `get`, und ein breiterer Typ hier wäre eine Einladung, den nächsten
   * Bedarf ebenfalls hier zu decken. Verdrahtet wird sie in `build-app.ts` mit `services.ko`.
   */
  kos: KantenKoLeser;
}

/** Die Nutzlast des Setzens, so wie sie vom Draht kommt: ungeprüft. */
interface SetzenRumpf {
  zielId?: unknown;
  art?: unknown;
  richtung?: unknown;
  beitragSchluessel?: unknown;
  gesehen?: unknown;
}

interface WiderrufRumpf {
  version?: unknown;
}

/**
 * Die Art, WENN sie eine ist. Geprüft gegen `KANTEN_ARTEN` — dieselbe Menge, aus der der Typ
 * besteht; eine abgeschriebene Liste hier wäre die zweite Wahrheit über die Wertmenge.
 */
function alsArt(wert: unknown): KantenArt {
  if (typeof wert === "string" && (KANTEN_ARTEN as readonly string[]).includes(wert)) {
    return wert as KantenArt;
  }
  throw new KantenError("VALIDATION", "Unbekannte Beziehungsart.");
}

function alsRichtung(wert: unknown): KantenRichtung {
  if (typeof wert === "string" && (KANTEN_RICHTUNGEN as readonly string[]).includes(wert)) {
    return wert as KantenRichtung;
  }
  throw new KantenError("VALIDATION", "Unbekannte Richtung der Beziehung.");
}

/**
 * Die erwartete Version. PFLICHT und ohne Vorgabewert: ein fehlender Wert dürfte nie als „egal"
 * durchgehen — dann nähme der zweite Bearbeiter still die Entscheidung des ersten zurück, und
 * genau davor schützt die Sperre. Nur eine nicht negative ganze Zahl zählt.
 */
function alsVersion(wert: unknown): number {
  if (typeof wert !== "number" || !Number.isInteger(wert) || wert < 0) {
    throw new KantenError(
      "VALIDATION",
      "Zu jeder Änderung gehört die Version, auf die sie sich bezieht.",
    );
  }
  return wert;
}

/**
 * Der Stand, den der Mensch beim Entscheiden vor sich hatte. PFLICHT und ohne Vorgabewert.
 *
 * Ein fehlendes `gesehen` als „dann eben der heutige Stand" zu lesen wäre die bequemste und die
 * gefährlichste Auslegung: der Server beurteilte dann in fremdem Namen zwei Texte, die der Mensch
 * nie gesehen hat — und die Beziehung trüge trotzdem SEINEN Namen als Urheber.
 */
function alsGesehen(wert: unknown): { quelleVersion: number; zielVersion: number } {
  const roh = (wert ?? {}) as { quelleVersion?: unknown; zielVersion?: unknown };
  const quelleVersion = roh.quelleVersion;
  const zielVersion = roh.zielVersion;
  if (
    typeof quelleVersion !== "number" ||
    !Number.isInteger(quelleVersion) ||
    typeof zielVersion !== "number" ||
    !Number.isInteger(zielVersion)
  ) {
    throw new KantenError(
      "VALIDATION",
      "Zu einer Verknüpfung gehört, welchen Stand beider Einträge du gesehen hast.",
    );
  }
  return { quelleVersion, zielVersion };
}

/**
 * Sendet die Antwort eines `KantenError` — und den EINEN Fall, den `sendError` nicht abbilden kann.
 *
 * `STAND_VERALTET` steht nicht in `STATUS_BY_CODE` (`services/app/src/http.ts:43-70`, ausserhalb
 * der Zielpfade dieses Auftrags) und ginge dort als 400 hinaus. Es ist aber ein KONFLIKT: die
 * Anfrage ist wohlgeformt, der Mensch hat nichts falsch gemacht — der Text unter ihm hat sich
 * bewegt. Und die Antwort trägt die heutigen Fassungsnummern mit, damit die Fläche sagen kann,
 * WOGEGEN neu zu entscheiden ist, statt „irgendetwas stimmt nicht".
 */
function sendeKantenfehler(reply: Parameters<typeof sendError>[0], fehler: unknown): void {
  if (fehler instanceof KantenError && fehler.code === "STAND_VERALTET") {
    reply.code(409).send({
      error: "STAND_VERALTET",
      message: fehler.message,
      ...(fehler.aktuell ? { aktuell: fehler.aktuell } : {}),
    });
    return;
  }
  sendError(reply, fehler);
}

export function kantenRoutes(deps: KantenRoutesDeps, guards: Guards): FastifyPluginAsync {
  // EIN Satz Abhängigkeiten für alle drei Wege. Lese- und Schreibdienst bekommen denselben, und
  // `ansichtNachSchreiben` ebenfalls — sonst könnten die Antworten der Wege auf verschiedene
  // Bestände zeigen, und das wäre an keiner Stelle sichtbar.
  const dienste = { repo: deps.kanten, kos: deps.kos };
  const lesen = new KantenLeseService(dienste);
  const schreiben = new KantenSchreibService(dienste);

  return async (app) => {
    // ============================================================================================
    // LESEN — `ko.read`.
    // ============================================================================================
    app.get<{ Params: { id: string } }>("/api/kos/:id/beziehungen", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        // Zeichengleich die Ausgabe des Lesedienstes. Kein zweiter Trimm, keine zweite Zahl.
        reply.code(200).send(
          await lesen.kantenFuer(request.params.id, {
            sichtbar: sichtbarkeitsfilterFuer(user),
          }),
        );
      } catch (error) {
        sendeKantenfehler(reply, error);
      }
    });

    // ============================================================================================
    // SETZEN — `ko.relate`. 201 für die erste Setzung, 200 für jede Wiederholung.
    // ============================================================================================
    //
    // WARUM ZWEI STATUSCODES UND NICHT EINER: Beim ersten Mal ENTSTEHT etwas, danach nicht mehr —
    // weder wenn derselbe Beitrag wiederholt ankommt (dann geschieht gar nichts, s.
    // `KantenSchreibService.setze`, Ausgang 1) noch wenn ein Zweiter dieselbe Beziehung setzt
    // (dann wird fortgeschrieben, Ausgang 2). Ein einheitliches 201 behauptete jedes Mal eine
    // Neuanlage; ein einheitliches 200 verschwiege die eine, die es gab. Der Unterschied steht in
    // der Antwort selbst (`version === 1`) und wird deshalb nicht geraten.
    app.post<{ Params: { id: string }; Body: SetzenRumpf }>(
      "/api/kos/:id/beziehungen",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.relate", request, reply);
        if (!user) {
          return;
        }
        try {
          const rumpf = request.body ?? {};
          const zielId = typeof rumpf.zielId === "string" ? rumpf.zielId : "";
          if (zielId.length === 0) {
            throw new KantenError("VALIDATION", "Eine Beziehung braucht ein zweites Ende.");
          }
          const beitragSchluessel =
            typeof rumpf.beitragSchluessel === "string" ? rumpf.beitragSchluessel : "";
          const { kante, ergebnis } = await schreiben.setze(
            {
              id: randomUUID(),
              quelleId: request.params.id,
              zielId,
              art: alsArt(rumpf.art),
              richtung: alsRichtung(rumpf.richtung),
              // Zusage 1: aus der Sitzung, nie aus der Nutzlast.
              urheber: user.id,
              jetzt: new Date().toISOString(),
              beitragSchluessel,
              gesehen: alsGesehen(rumpf.gesehen),
            },
            { sichtbar: sichtbarkeitsfilterFuer(user) },
          );
          // 201 NUR, wenn wirklich etwas entstanden ist. Der Dienst sagt es (`ergebnis`); es aus
          // `version === 1` zu erraten wäre falsch — eine WIEDERHOLUNG desselben Beitrags trägt
          // ebenfalls Version 1, und die Antwort behauptete dann eine Neuanlage, die es nicht gab.
          //
          // DIE ANTWORT IST DIE ANSICHT, NICHT DAS AGGREGAT (JOB 4151 R6). Bis hierher ging der
          // gespeicherte Stand roh hinaus — mit `quelleId`/`zielId` und ohne `gegenstueck`. Die
          // Anzeige (JOB 4153) liest von dieser Antwort aber `gegenstueck.id`, um zu erkennen, ob
          // die Antwort ihr eigener Auftrag ist; am echten Draht wäre das `undefined.id` gewesen,
          // und zwar genau im Erfolgsfall. Die Ansicht ist ausserdem die EINE Form, die der Vertrag
          // für eine Kante am Draht kennt — zwei Formen für dieselbe Sache wären die zweite Wahrheit.
          reply
            .code(ergebnis === "angelegt" ? 201 : 200)
            .send(await ansichtNachSchreiben(kante, request.params.id, dienste));
        } catch (error) {
          sendeKantenfehler(reply, error);
        }
      },
    );

    // ============================================================================================
    // WIDERRUFEN — `ko.relate`, mit erwarteter Version. Es wird NICHTS gelöscht.
    // ============================================================================================
    //
    // Der Bestand behält die Zeile mit `status: "widerrufen"` — wer sie entfernte, könnte später
    // nicht mehr unterscheiden, ob jemand zurückgenommen hat oder ob es die Beziehung nie gab
    // (`kanten-types.ts:30-36`). Die Antwort gibt den widerrufenen Stand zurück und behauptet
    // deshalb auch nach aussen keine Löschung. Deshalb steht hier `POST … /widerruf` und kein
    // `DELETE`: das Verb soll sagen, was geschieht.
    app.post<{ Params: { beziehungId: string }; Body: WiderrufRumpf }>(
      "/api/beziehungen/:beziehungId/widerruf",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.relate", request, reply);
        if (!user) {
          return;
        }
        try {
          const rumpf = request.body ?? {};
          const widerrufen = await schreiben.widerrufe(
            request.params.beziehungId,
            {
              urheber: user.id,
              jetzt: new Date().toISOString(),
              erwarteteVersion: alsVersion(rumpf.version),
            },
            { sichtbar: sichtbarkeitsfilterFuer(user) },
          );
          // DIESELBE FORM WIE DER SETZWEG (JOB 4151 R6) — mit `status: "widerrufen"`, `geaendertAm`
          // und dem Widerrufs-Urheber, wie der Vertrag es für diese Antwort verlangt.
          //
          // DIE ORIENTIERUNG IST `quelleId`, und sie ist eine WAHL, keine Selbstverständlichkeit:
          // anders als beim Setzen steht in dieser Adresse kein Wissenseintrag, nur die Kennung der
          // BEZIEHUNG. Es gibt hier also kein „angefragtes Objekt", aus dem sich das Gegenstück
          // ergäbe. Die kanonische Quelle ist die einzige Wahl, die nicht von der Aufrufseite
          // abhängt — damit ist die Antwort für dieselbe Beziehung immer dieselbe, egal von welcher
          // Seite der Mensch widerrufen hat. Die Fläche liest hier `status` (JOB 4153,
          // `widerrufAusfuehren`) und braucht die Orientierung nicht; erfunden wird sie trotzdem
          // nicht, sondern benannt.
          reply
            .code(200)
            .send(await ansichtNachSchreiben(widerrufen, widerrufen.quelleId, dienste));
        } catch (error) {
          sendeKantenfehler(reply, error);
        }
      },
    );
  };
}
