// ================================================================================================
// JOB 3510 · DIE ZWEI WEGE ZUR MARKENWAHL — einer liest, einer schreibt.
// ================================================================================================
//
// WARUM DER LESEWEG OHNE ADMINRECHT AUSKOMMT — und sogar ohne Anmeldung: Er beantwortet genau eine
// Frage: „In welchem Erscheinungsbild läuft diese Instanz?" Das ist dieselbe Klasse wie die
// Oberflächentexte aus `/api/i18n` — Darstellungslage, kein Bestand, keine Nutzerdaten, kein
// Verwaltungswissen. Er MUSS so weit offen sein: Die drei Verbraucher sind KLARWERK, das
// Word-Taskpane und das Chrome-Panel, und die beiden letzten färben ihre eigene Oberfläche, bevor
// irgendjemand sich angemeldet hat. Eine Auskunft, die erst nach der Anmeldung antwortet, ließe die
// Anmeldemaske selbst ungefärbt zurück — genau die Fläche, die der Kunde am Freitag zuerst sieht.
//
// WARUM ES TROTZDEM NICHT `/api/features` IST: Der Kopf von `features-routes.ts` verlangt die
// Begründung, warum es eine WEITERE Auskunft gibt. Sie lautet: `/api/features` gibt AUSSCHLIESSLICH
// Ja/Nein je registriertem Schalter aus — keine Werte, keine Namen, keine Versionen; sein Sammler
// (`tests/app/mega46-schalter-auskunft.test.ts`) misst das an der Antwort. Die Markenwahl ist
// genau das Gegenteil: Sie trägt einen Namen, zwei Farbwerte, einen Pfad und eine Änderungszahl.
// Sie in jene Auskunft zu legen, hieße, ihren Vertrag zu brechen. Und sie ist kein Schalter aus der
// Umgebung, sondern eine gespeicherte, zur Laufzeit umschaltbare Wahl. Also EINE eigene, schmale
// Auskunft für die Marke — und danach keine weitere: Web, Word und Chrome lesen alle hier.
//
// WARUM DER SCHREIBWEG HIER STEHT UND NICHT IN `admin-routes.ts`: Jene Datei führt den Demo-Seed,
// die Demopakete und den Werksreset; ihr Dienstbündel ist `DemoSeedServices`. Das Markenprofil ist
// vom Demo-Datenpaket ausdrücklich UNABHÄNGIG (Auftrag, Lieferung 5) — es dort einzuhängen hieße,
// die Ablage der Markenwahl durch das Demo-Bündel zu fädeln und damit genau die Kopplung
// herzustellen, die der Auftrag ausschließt. Der Schutz ist derselbe wie an jedem Weg dort:
// `requirePermission("users.manage")`, im Rumpf der Registrierung, ausgeschrieben — beides
// erzwungen von `tests/security/route-guard-audit.test.ts`.
import type { FastifyPluginAsync } from "fastify";
import type { AuditService } from "../../../audit";
import {
  type BrandingSettingsRepo,
  brandingAntwort,
  normalisiereBrandingWahl,
} from "../branding-settings";
import type { Guards } from "../http";

export interface BrandingRouteDienste {
  branding: BrandingSettingsRepo;
  // Optional wie an den übrigen Adminwegen (`ko-routes.ts:1634`): direkte Test-Aufrufer bleiben
  // kompatibel, die verdrahtete App reicht ihn immer mit.
  audit?: AuditService;
}

export function brandingRoutes(dienste: BrandingRouteDienste, guards: Guards): FastifyPluginAsync {
  return async (app) => {
    // Die EINE Leseauskunft. Drei Oberflächen bedienen sich hier — und alle drei bekommen
    // denselben Stand, das ist der ganze Sinn.
    app.get("/api/branding", async (_request, reply) => {
      reply.code(200).send(brandingAntwort(await dienste.branding.lies()));
    });

    app.put<{ Body: { profil?: unknown; aktiv?: unknown } }>(
      "/api/admin/branding",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        const wahl = normalisiereBrandingWahl(request.body);
        if (!wahl) {
          reply.code(400).send({
            error: "UNKNOWN_PROFILE",
            message:
              'Erwartet wird { profil: "advisor" | null, aktiv: true | false }. Ein unbekanntes Profil wird nicht gespeichert.',
          });
          return;
        }
        // Setzen und Hochzählen in einem Schritt; der alte Stand kommt aus demselben Aufruf und
        // nicht aus einem zweiten Lesen davor.
        const { vorher, nachher } = await dienste.branding.setze(wahl);
        // Wer, wann, was — „wann" trägt der Prüfprotokoll-Eintrag selbst (`AuditService.record`
        // setzt `at`), „wer" ist die Benutzer-Id aus der Anmeldung, „was" ist alt → neu.
        await dienste.audit?.record({
          actor: user.id,
          action: "branding.set",
          target: "settings",
          // Inline-Literal (Record<string, unknown>) — wie bei den Upload-Grenzen: ein benannter
          // Typ ohne Index-Signatur ist nicht direkt zuweisbar (TS2322).
          payload: {
            vorherProfil: vorher.profil,
            vorherAktiv: vorher.aktiv,
            profil: nachher.profil,
            aktiv: nachher.aktiv,
            version: nachher.version,
          },
        });
        reply.code(200).send(brandingAntwort(nachher));
      },
    );
  };
}
