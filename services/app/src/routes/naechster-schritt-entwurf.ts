// ================================================================================================
// JOB 1494 · D1 · KA8 STUFE 1b (SERVERSEITE) — DER ENDPUNKT ZUR ABLEITENDEN AUSKUNFT.
// ================================================================================================
//
// WAS HIER NEU IST — und was ausdruecklich NICHT:
//
// NICHT NEU ist die Ableitung. Sie steht seit JOB 1171 D1 (KA8 Stufe 1a) im Bestand:
// `CaptureService.naechsterSchrittFuerEntwurf` (`services/capture/src/service.ts:561`), gespeist von
// `leiteNaechstenSchrittAb` (`:113-131`), verbuergt durch 14 Faelle in
// `tests/capture/job1171-naechster-schritt-auskunft.test.ts`. Diese Datei erfindet KEINE zweite
// Ableitung — ein zweiter Ort, an dem entschieden wird, was der naechste Schritt ist, waere genau
// die Doppelung, die der Sammler `tests/app/mega54-ein-naechster-schritt-sammler.test.ts` fuer die
// Lueckenflaechen verbietet („zwei widersprechende naechste Schritte auf einem Bildschirm sind
// schlechter als einer").
//
// NEU ist allein der DRAHT. Die Ableitung war bis heute ueber HTTP nicht erreichbar — sie lag im
// Dienst und niemand konnte sie abrufen. Das ist derselbe Zustand, den JOB 1171 fuer KA3
// protokolliert hat: „Eine Karte ohne Datenlieferanten zeigt nie etwas." Hier ist der umgekehrte
// Fall: ein Datenlieferant ohne Draht wird nie gesehen.
//
// ------------------------------------------------------------------------------------------------
// WARUM DER LEERFALL 204 IST UND NICHT 200 MIT EINEM LEEREN FELD
// ------------------------------------------------------------------------------------------------
// KA8 verlangt eine BELEGTE Karte. Der Auftrag sagt dazu: „Gibt es keinen sinnvollen naechsten
// Schritt, ist die richtige Antwort KEINE Karte — nicht eine allgemeine."
//
// Ein `200 {}` oder `200 {"art": null}` zwingt jeden Aufrufer, den Leerfall an einem Feldwert zu
// erkennen — und der erste, der das vergisst, rendert eine leere Karte. `204 No Content` kann man
// nicht versehentlich rendern: es gibt keinen Rumpf, aus dem eine Karte entstehen koennte.
//
// Der Dienst unterscheidet den Leerfall bereits ehrlich (`service.ts:101-109`): beruft sich ein
// Entwurf auf ein Original, dessen Existenz NICHT geprueft werden konnte, ist unbekannt, ob das
// Einreichen gelaenge — dann kommt nichts. Diese Ehrlichkeit wird hier durchgereicht, nicht
// eingeebnet.
//
// ------------------------------------------------------------------------------------------------
// WARUM 404 UND 204 GETRENNT BLEIBEN MUESSEN
// ------------------------------------------------------------------------------------------------
// `naechsterSchrittFuerEntwurf` liefert `undefined` fuer ZWEI verschiedene Lagen: „Entwurf gibt es
// nicht" und „Schritt ist nicht ableitbar". Wer nur diese Methode aufruft, kann beides nicht
// trennen und muesste raten. Deshalb wird der Entwurf hier ZUERST geladen (`getDraft`) — das
// trennt 404 sauber von 204 und ist zugleich die Grundlage der Sichtbarkeitspruefung.
//
// ------------------------------------------------------------------------------------------------
// DIE SICHTBARKEIT KOMMT AUS DER BESTEHENDEN REGEL, NICHT AUS EINER ZWEITEN
// ------------------------------------------------------------------------------------------------
// `canSeeDraft` wird aus `capture-routes.ts` importiert, wo es genau dafuer exportiert ist
// (`:20-25`: „damit die Composition-Root den Entwurfs-Zugang ... aus DERSELBEN Regel bildet. Zwei
// Auffassungen davon, wer einen Entwurf sehen darf, waeren eine zu viel"). Eine eigene Kopie waere
// die dritte.
import type { FastifyPluginAsync } from "fastify";
import type { CaptureService } from "../../../capture";
import { type Guards, sendError } from "../http";
import { canSeeDraft } from "./capture-routes";

/**
 * Die Antwortform ist an den Dienstvertrag GEBUNDEN, nicht abgeschrieben.
 *
 * `NaechsterSchritt` steht nicht in der Modulfassade `services/capture/index.ts`, und diese Datei
 * aendert die Fassade nicht (sie liegt ausserhalb der Lease dieses Durchgangs). Der Typ wird
 * deshalb aus der Signatur des Dienstes abgeleitet: Aendert sich dort `art` oder `herkunft`,
 * aendert sich diese Antwort mit — ein abgeschriebenes Interface waere ab der ersten Erweiterung
 * eine zweite, stille Wahrheit.
 */
export type NaechsterSchrittAntwort = NonNullable<
  Awaited<ReturnType<CaptureService["naechsterSchrittFuerEntwurf"]>>
>;

export interface NaechsterSchrittRoutesDeps {
  capture: CaptureService;
}

/**
 * Der Pfad steht als Konstante, damit Test und Registrierung dieselbe Zeichenkette benutzen.
 * Er haengt bewusst UNTER der Entwurfsressource: die Auskunft ist eine Sicht auf genau diesen
 * Entwurf, kein eigener Gegenstand — und sie wird nirgends gespeichert (`types.ts:114-117`).
 */
export const NAECHSTER_SCHRITT_PFAD = "/api/drafts/:id/naechster-schritt";

export function naechsterSchrittEntwurfRoutes(
  deps: NaechsterSchrittRoutesDeps,
  guards: Guards,
): FastifyPluginAsync {
  const { capture } = deps;

  return async (app) => {
    app.get<{ Params: { id: string } }>(NAECHSTER_SCHRITT_PFAD, async (request, reply) => {
      // Dieselbe Berechtigung wie jede andere Entwurfsroute (`capture-routes.ts:140`). Wer keine
      // Entwuerfe anlegen darf, hat auch keine, ueber die eine Auskunft sinnvoll waere.
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }

      try {
        const draft = await capture.getDraft(request.params.id);
        if (!draft) {
          reply.code(404).send({ error: "NOT_FOUND", message: "Entwurf nicht gefunden." });
          return;
        }
        if (!canSeeDraft(user, draft)) {
          reply.code(403).send({ error: "FORBIDDEN", message: "Entwurf nicht verfuegbar." });
          return;
        }

        const schritt = await capture.naechsterSchrittFuerEntwurf(draft.id);
        if (!schritt) {
          // Der ehrliche Leerfall. Kein Rumpf — und damit keine Karte.
          reply.code(204).send();
          return;
        }

        // Unveraendert durchgereicht: `art` sagt WAS, `herkunft` sagt WORAUS. Die Beschriftung ist
        // Sache der Flaeche (i18n), nicht des Endpunkts — ein hier formulierter Satz waere ein
        // zweiter Naechster-Schritt-Text neben dem Woerterbuch.
        reply.code(200).send({ art: schritt.art, herkunft: [...schritt.herkunft] });
      } catch (error) {
        sendError(reply, error);
      }
    });
  };
}
