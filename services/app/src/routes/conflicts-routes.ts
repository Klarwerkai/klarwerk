import type { FastifyPluginAsync } from "fastify";
import type { ConflictService } from "../../../conflicts";
import { type BefundPaar, eigeneBefunde } from "../duplicate-signal";
import { type Guards, type SessionUser, sendError } from "../http";
import {
  type KoSichtbarkeitsZugang,
  type SichtbarkeitsFakten,
  feldFreigabe,
  paarSichtbar,
  redigiereKonflikt,
  sichtbareFuer,
  sichtbarePaare,
} from "../sichtbarkeit";

/**
 * JOB 1546 D2 (A28): die beiden Lesezugaenge, die das Signal braucht — als PORTS, nicht als
 * Dienstimporte. Dieselbe Ueberlegung wie bei `KoSichtbarkeitsZugang` (sichtbarkeit.ts): die Route
 * braucht genau eine Methode, und ein Port haelt sie testbar, ohne den ganzen Dienst zu bauen.
 */
export interface OverlapLesezugang {
  unresolved: () => Promise<readonly BefundPaar[]>;
}

/** Ein Wissensobjekt, soweit A28 es braucht: Kennung + die Felder der Sichtbarkeitsregel. */
export interface EigenesKoFaktum extends SichtbarkeitsFakten {
  id: string;
}

export interface EigeneKoQuelle {
  list: () => Promise<readonly EigenesKoFaktum[]>;
}

/**
 * Die Kennungen der Objekte, deren AUTOR der Betrachter ist.
 *
 * Zwei Stufen, und die Reihenfolge ist Absicht:
 *   1. `sichtbareFuer` — das gemessene Zeilenrecht aus `../sichtbarkeit`. Es steht als
 *      `zeilenrecht` in der Audit-Matrix und ist hier bewusst KEIN No-op-Kommentar, sondern der
 *      benannte Weg: ein unsichtbares Objekt soll ueberall gleich verschwinden.
 *   2. die Autorschaft selbst — dieselbe Zeichenkettenpruefung wie `darfSehen` (sichtbarkeit.ts:76),
 *      samt derselben Leer-Vorsicht. `duplicate-signal.ts:165-168` verlangt ausdruecklich, dass der
 *      AUFRUFER sie entscheidet und es keine zweite Auslegung gibt.
 *
 * Stufe 1 kann die Menge nicht verbreitern: wer Autor ist, besteht `darfSehen` immer
 * (sichtbarkeit.ts:61 „ODER der Autor selbst"). Sie ist die zweite Linie, nicht die einzige.
 */
function eigeneKoIds(user: SessionUser, kos: readonly EigenesKoFaktum[]): string[] {
  return sichtbareFuer(user, kos)
    .filter((k) => typeof k.author === "string" && k.author.length > 0 && k.author === user.id)
    .map((k) => k.id)
    .filter((id) => typeof id === "string" && id.length > 0);
}

// Konflikt-API (§2.3/FR-CON). Erstellen/Auflösen auch über den KO-Dispatcher möglich;
// hier zusätzlich Liste, Detail, Eskalation und Zweitmeinung.
//
// AUFTRAG-mega74 BLOCK D (G5): der Konflikt trägt `description` und `detector.quotes.a/b` —
// wörtliche Belegzitate BEIDER Objekte. Ohne den Zugang unten gab diese Datei sie jedem
// `ko.read`-Inhaber heraus, auch wenn er keins der beiden Objekte öffnen durfte. Der Zugang wird
// injiziert (Kompositionswurzel), nicht importiert: die Regel wohnt in ../sichtbarkeit, hier steht
// nur ihre Anwendung.
//
// AUFTRAG-mega76 BLOCK A: `kos` war OPTIONAL und ist jetzt PFLICHT. Der Grund steht in
// ../sichtbarkeit über `zugangTauglich`: ein fehlender Zugang lieferte hier nicht fail-closed,
// sondern `offen` — die ungefilterte Konfliktliste mit allen wörtlichen Belegzitaten. Ein
// Pflichtparameter war an dieser Stelle ohne Umbau möglich, weil die Kompositionswurzel der
// EINZIGE Aufrufer ist (build-app.ts:937); es gab also keinen zweiten Bauweg zu versorgen.
//
// JOB 1546 D2 (A28, OFFEN.md:165) — DER AUFRUFER FÜR DAS DAUERHAFTE SIGNAL AM EIGENEN OBJEKT.
//
// `7fb6ace` (JOB 1500 D1) hat die Regel gebaut — `services/app/src/duplicate-signal.ts`, BEN GRÜN.
// Sie hatte bis heute KEINEN Aufrufer: gemessen in JOB 1546 D1, der einzige Treffer war ihr eigener
// Test. Damit war OFFEN.md:165 „Der Dublettenbefund bleibt am Objekt" eine Zusage über Code, den
// niemand aufruft. Diese Datei ist der Aufrufer.
//
// WARUM HIER UND NICHT IN EINER EIGENEN ROUTENDATEI: der bestehende `register`-Aufruf genügt
// (build-app.ts:1233) und bekommt zwei Argumente mehr. Eine eigene Plugin-Datei wäre ein zweiter
// Aufrufweg — und, gemessen in JOB 1500 D8, säße sie außerdem außerhalb der Scanfläche von
// `tests/security/routeGuardAudit.ts` (`routeSourceFiles`), wo eine neue Route nie einen
// Matrixeintrag bräuchte. Genau das soll dieser Wächter verhindern.
//
// DIE GRENZE, die A28 verlangt, wird NICHT hier gezogen, sondern trägt sich aus dem Typ:
// `EigenerBefund` hat kein Feld für die Gegenseite. Diese Route reicht durch, was der Kern liefert,
// und kann deshalb gar nichts über die Gegenseite sagen — belegt in
// `tests/ko/a28-signal-route.test.ts` gegen die ECHTE Antwort dieser Route.
export function conflictRoutes(
  conflicts: ConflictService,
  guards: Guards,
  kos: KoSichtbarkeitsZugang,
  overlaps?: OverlapLesezugang,
  ko?: EigeneKoQuelle,
): FastifyPluginAsync {
  return async (app) => {
    // Warum OPTIONAL und nicht Pflicht wie `kos` seit mega76: `kos` wurde Pflicht, weil sein
    // Fehlen FAIL-OPEN war — die ungefilterte Konfliktliste mit allen Belegzitaten. Hier ist das
    // Gegenteil der Fall. Fehlt ein Port, wird die Route GAR NICHT REGISTRIERT: sie antwortet 404,
    // die Flaeche existiert nicht. Das ist fail-closed und ausserdem ehrlicher als eine leere
    // Liste — „keine Befunde" waere genau die Aussage, gegen die A28 gebaut ist.
    // (Gemessen: zwei weitere Aufrufer dieser Funktion stehen in tests/security/ — mega76 und
    // nebenweg-feldredaktion. Ein Pflichtparameter haette sie gebrochen, ohne ihre Zusagen zu
    // verbessern.)
    const overlapZugang = overlaps;
    const koQuelle = ko;
    // ------------------------------------------------------------------------------------------
    // A28 · DAS DAUERHAFTE SIGNAL AM EIGENEN OBJEKT — die EINE Leseflaeche.
    // ------------------------------------------------------------------------------------------
    // Sie liefert `EigenerBefund[]`: je eigenem Objekt MIT offenem Befund die Kennung DIESES
    // Objekts und die Art. Kein Eintrag ohne Befund (das Signal ist eine Meldung, keine
    // Bestandsliste), und nichts ueber die Gegenseite — der Typ traegt kein Feld dafuer.
    //
    // Die GESPERRTE Richtung („ein fremdes Objekt dupliziert meines") entsteht hier nicht, weil der
    // Kern sie nicht erzeugt: `duplicate-signal.ts:111-114`, Zweig `if (bIstMeins) return null;`.
    // Sie bleibt gesperrt, bis Pedi `OF-1546-1` entschieden hat.
    if (overlapZugang && koQuelle) {
      app.get("/api/duplicate-signal", async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        try {
          const eigene = eigeneKoIds(user, await koQuelle.list());
          reply
            .code(200)
            .send(
              eigeneBefunde(eigene, await overlapZugang.unresolved(), await conflicts.unresolved()),
            );
        } catch (error) {
          sendError(reply, error);
        }
      });
    }

    app.get("/api/conflicts", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const offen = await conflicts.unresolved();
      // JOB 1125: erste Stufe Existenz (Paar), zweite Stufe Inhalt (Feld je Seite). Siehe die
      // ausführliche Begründung in ../sichtbarkeit über `feldFreigabe`.
      const sichtbar = await sichtbarePaare(user, offen, kos);
      const sichten = [];
      for (const konflikt of sichtbar) {
        sichten.push(
          redigiereKonflikt(konflikt, await feldFreigabe(user, konflikt.koA, konflikt.koB, kos)),
        );
      }
      reply.code(200).send(sichten);
    });

    app.get<{ Params: { id: string } }>("/api/conflicts/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const conflict = await conflicts.get(request.params.id);
      // Nicht sichtbar sieht aus wie nicht vorhanden — dieselbe Form wie am Wissensobjekt.
      // JOB 1125, Pflicht 3: das bleibt ein 404 und wird NICHT zur leeren Redaktion. Fehlendes
      // Paar und zurückgehaltener Inhalt sind zwei verschiedene Aussagen.
      if (!conflict || !(await paarSichtbar(user, conflict.koA, conflict.koB, kos))) {
        reply.code(404).send({ error: "NOT_FOUND", message: "Konflikt nicht gefunden." });
        return;
      }
      reply
        .code(200)
        .send(
          redigiereKonflikt(conflict, await feldFreigabe(user, conflict.koA, conflict.koB, kos)),
        );
    });

    app.post<{ Params: { id: string } }>("/api/conflicts/:id/escalate", async (request, reply) => {
      const user = await guards.requirePermission("conflict.resolve", request, reply);
      if (!user) {
        return;
      }
      try {
        reply.code(200).send(await conflicts.escalate(request.params.id, user.id));
      } catch (error) {
        sendError(reply, error);
      }
    });

    // Berater-Konzept 04.07. (Stufe 4): „Fehlalarm — kein Widerspruch" schließt einen (meist
    // automatisch erkannten) Konflikt bewusst als falsch-positiv. Menschlicher Entscheider (⚑).
    app.post<{ Params: { id: string }; Body: { note?: string } | null }>(
      "/api/conflicts/:id/dismiss",
      async (request, reply) => {
        const user = await guards.requirePermission("conflict.resolve", request, reply);
        if (!user) {
          return;
        }
        try {
          reply
            .code(200)
            .send(await conflicts.dismiss(request.params.id, user.id, request.body?.note));
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    app.post<{ Params: { id: string }; Body: { opinion: string } }>(
      "/api/conflicts/:id/second-opinion",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        try {
          reply
            .code(200)
            .send(await conflicts.secondOpinion(request.params.id, request.body.opinion, user.id));
        } catch (error) {
          sendError(reply, error);
        }
      },
    );
  };
}
