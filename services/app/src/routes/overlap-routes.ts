import type { FastifyPluginAsync } from "fastify";
import type { AuditService } from "../../../audit";
import {
  DEFAULT_OVERLAP_SETTINGS,
  OverlapError,
  type OverlapService,
  type OverlapSettingsRepo,
  isHumanOverlapCloseReason,
  normalizeOverlapSettings,
} from "../../../conflicts";
import { type Guards, sendError } from "../http";
import {
  type KoSichtbarkeitsZugang,
  feldFreigabe,
  paarSichtbar,
  redigiereUeberschneidung,
  sichtbarePaare,
} from "../sichtbarkeit";

// Berater-Konzept Duplikate 04.07. (Stufe D3b): Überschneidungs-API (/api/duplicates). Liste +
// Detail lesen alle Leseberechtigten; die menschlichen Abschlüsse (Fehlalarm / getrennt lassen /
// verwandt verlinken) sind kuratorische Entscheidungen (ko.validate). Bewusst schlank: kein
// Eskalieren/Zweitmeinung — es geht um Redaktion, nicht um Wahrheit. Merge folgt in D5.
// Pedi 04.07.: zusätzlich die einstellbare Anzeige-Schwelle (lesen: alle; setzen: Admin).
export interface OverlapRoutesDeps {
  overlaps: OverlapService;
  settings: OverlapSettingsRepo;
  audit?: AuditService;
  // AUFTRAG-mega74 BLOCK D (G5): Zugang zur Sichtbarkeit der beiden beteiligten Wissensobjekte.
  // Injiziert, nicht importiert — die Regel wohnt in ../sichtbarkeit.
  //
  // AUFTRAG-mega76 BLOCK A: von `kos?` auf PFLICHT. Fehlte er, gab `/api/duplicates` die
  // ungefilterte Liste mit `aspects`, `eigenanteilA` und `eigenanteilB` heraus — also gerade das,
  // was NUR in je einem der beiden Objekte steht. Pflichtparameter ohne Umbau möglich: einziger
  // Aufrufer ist die Kompositionswurzel (build-app.ts:944).
  kos: KoSichtbarkeitsZugang;
}

export function overlapRoutes(deps: OverlapRoutesDeps, guards: Guards): FastifyPluginAsync {
  const { overlaps, settings, audit, kos } = deps;
  return async (app) => {
    app.get("/api/duplicates", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      // SCRUM-496: DB-/Serverfehler NICHT roh durchreichen (das Board zeigte sonst die nackte
      // Postgres-Meldung). sendError generalisiert Infrastruktur-Fehler zu einem sauberen 500.
      try {
        // AUFTRAG-mega74 BLOCK D (G5): der Eintrag trägt `aspects` (wörtliche gemeinsame Aussagen),
        // `eigenanteilA` und `eigenanteilB` — also gerade das, was NUR in je einem der beiden
        // Objekte steht. Ohne dieses Tor las jeder `ko.read`-Inhaber den Kern eines vertraulichen
        // Objekts, ohne es je zu öffnen.
        const offen = await overlaps.unresolved();
        // JOB 1125: zwei Stufen, nicht eine. `sichtbarePaare` entscheidet, ob der Fund überhaupt
        // EXISTIERT; die Feldredaktion danach entscheidet je Seite über den INHALT. Die zweite
        // Stufe läuft auch dann, wenn die erste alles durchgelassen hat — sonst wäre sie nur ein
        // Kommentar (die Lehre aus mega76 Block A: ein Schutz, der nur manchmal greift, ist keiner).
        const sichtbar = await sichtbarePaare(user, offen, kos);
        const sichten = [];
        for (const eintrag of sichtbar) {
          sichten.push(
            redigiereUeberschneidung(
              eintrag,
              await feldFreigabe(user, eintrag.koA, eintrag.koB, kos),
            ),
          );
        }
        reply.code(200).send(sichten);
      } catch (error) {
        sendError(reply, error);
      }
    });

    // Pedi 04.07.: Anzeige-Schwelle der Duplikat-Erkennung. Lesen dürfen alle Leseberechtigten
    // (Anzeige im Board/Admin), setzen nur die Nutzerverwaltung (Admin). Änderung landet im Audit.
    app.get("/api/duplicates/settings", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        reply.code(200).send((await settings.get()) ?? DEFAULT_OVERLAP_SETTINGS);
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.put<{ Body: { minConfidence?: number } }>(
      "/api/duplicates/settings",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        try {
          const next = normalizeOverlapSettings(request.body);
          await settings.set(next);
          await audit?.record({
            actor: user.id,
            action: "overlap.settings.set",
            target: "settings",
            payload: { minConfidence: next.minConfidence },
          });
          reply.code(200).send(next);
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    app.get<{ Params: { id: string } }>("/api/duplicates/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        const entry = await overlaps.get(request.params.id);
        // mega74 D: nicht sichtbar sieht aus wie nicht vorhanden.
        //
        // JOB 1125, Pflicht 3 — die beiden Zustände bleiben VERSCHIEDEN: hier steht weiter das
        // 404 (kein Paar, kein Existenzsignal), NICHT eine leere Redaktion. Ein redigierter
        // Eintrag sagt „es gibt etwas, du liest den Inhalt nicht"; das 404 sagt „hier ist nichts".
        // Diese beiden Sätze dürfen nie zusammenfallen — sonst wäre das 404 selbst eine Auskunft.
        if (!entry || !(await paarSichtbar(user, entry.koA, entry.koB, kos))) {
          reply.code(404).send({ error: "NOT_FOUND", message: "Überschneidung nicht gefunden." });
          return;
        }
        reply
          .code(200)
          .send(
            redigiereUeberschneidung(entry, await feldFreigabe(user, entry.koA, entry.koB, kos)),
          );
      } catch (error) {
        sendError(reply, error);
      }
    });

    // „Fehlalarm — kein Duplikat" schließt einen (meist automatisch erkannten) Eintrag bewusst als
    // falsch-positiv. Menschlicher Entscheider (⚑).
    app.post<{ Params: { id: string }; Body: { note?: string } | null }>(
      "/api/duplicates/:id/dismiss",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        try {
          reply
            .code(200)
            .send(await overlaps.dismiss(request.params.id, user.id, request.body?.note));
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    // „Getrennt lassen" — bewusste Entscheidung, beide Beiträge nebeneinander zu behalten.
    app.post<{ Params: { id: string }; Body: { note?: string } | null }>(
      "/api/duplicates/:id/keep-separate",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        try {
          reply
            .code(200)
            .send(await overlaps.keepSeparate(request.params.id, user.id, request.body?.note));
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    // ==========================================================================================
    // JOB 3061 · H2 (bens Korrekturpflicht 1, Runde 5) — „STATUS SETZEN" ALS EIGENER WEG.
    // ==========================================================================================
    //
    // Die drei Routen darüber sind ENTSCHEIDUNGEN: sie sagen, wie das Paar zu lesen ist, und
    // schliessen es als Nebenwirkung. Diese Route ist etwas anderes — sie setzt den ZUSTAND des
    // Vorgangs, und zwar in beide Richtungen des Auftrags (§5.5): „In Bearbeitung" (jemand
    // kümmert sich, nichts ist entschieden) und „Geschlossen" mit einem AUSDRÜCKLICH gewählten
    // Abschlussgrund. Ein Abschluss über einen Fussband-Knopf ersetzt sie nicht: dort wählt der
    // Knopf den Grund, hier wählt ihn der Mensch.
    //
    // EIN Endpunkt und nicht zwei, weil der Aufrufer EINE Frage stellt („welcher Zustand?") und
    // die Antwort in beiden Fällen derselbe Eintrag ist. Der Zielzustand steht im Rumpf, nicht im
    // Pfad — sonst wäre „welche Zustände gibt es?" auf mehrere Routen verstreut.
    //
    // WAS HIER NICHT GEHT, und warum das Absicht ist:
    //  · „offen" ist kein Ziel. Ein Zurückdrehen wäre eine eigene Zusage (wer darf das? was wird
    //    aus dem Audit?) und steht in keinem Auftrag — lieber gar nicht als halb.
    //  · Systemische Abschlussgründe (`merged`, `participant_deleted`, `superseded`) sind nicht
    //    wählbar; `isHumanOverlapCloseReason` prüft den ROHEN Drahtwert, bevor er den Dienst
    //    erreicht. Sonst behauptete das Protokoll einen Vorgang, den es nicht gab.
    //  · Ein fehlender/unbekannter Zielzustand ist ein 400 (INVALID_STATUS ist in `http.ts`
    //    absichtlich nicht auf einen Sonderstatus abgebildet), kein stiller 200.
    //
    // Existenz-Leck (JOB 972 D3, Prüflücke 6): dieselbe Lage wie bei den drei Aktionen darüber —
    // `ko.validate` ist zugleich einer der beiden Sichtwege der Paaransicht, ein Akteur, der
    // handeln darf ohne sehen zu dürfen, existiert nicht. Darum wie dort ohne `paarSichtbar`.
    app.post<{
      Params: { id: string };
      Body: { status?: string; reason?: string; note?: string } | null;
    }>("/api/duplicates/:id/status", async (request, reply) => {
      const user = await guards.requirePermission("ko.validate", request, reply);
      if (!user) {
        return;
      }
      try {
        const { status, reason, note } = request.body ?? {};
        // Leerer/nur-weisser Vermerk ist KEIN Vermerk — sonst stünde im Protokoll ein Grund,
        // der aus einem versehentlich fokussierten Feld stammt.
        const vermerk = typeof note === "string" && note.trim() !== "" ? note.trim() : undefined;
        if (status === "in_bearbeitung") {
          reply.code(200).send(await overlaps.takeInProgress(request.params.id, user.id, vermerk));
          return;
        }
        if (status === "geschlossen") {
          if (!isHumanOverlapCloseReason(reason)) {
            throw new OverlapError(
              "INVALID_STATUS",
              "Abschlussgrund fehlt oder ist nicht wählbar.",
            );
          }
          reply
            .code(200)
            .send(await overlaps.closeWithReason(request.params.id, user.id, reason, vermerk));
          return;
        }
        throw new OverlapError("INVALID_STATUS", "Zielzustand nicht setzbar.");
      } catch (error) {
        sendError(reply, error);
      }
    });

    // „Als verwandt verlinken" — kein Duplikat, aber sachlich verbunden.
    app.post<{ Params: { id: string }; Body: { note?: string } | null }>(
      "/api/duplicates/:id/link-related",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        try {
          reply
            .code(200)
            .send(await overlaps.linkRelated(request.params.id, user.id, request.body?.note));
        } catch (error) {
          sendError(reply, error);
        }
      },
    );
  };
}
