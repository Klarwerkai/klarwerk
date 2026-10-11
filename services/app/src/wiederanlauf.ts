// ================================================================================================
// produkt:20261011:peter-p09 — DER WIEDERANLAUF NACH EINEM RESTORE (P09-AC04/05/06).
// ================================================================================================
//
// Peters Entscheidung 45: „Wiederanlauf beginnt mit gestoppten Außenaktionen. Zuerst Integrität,
// Rechteentzüge und Löschmarkierungen nachführen; anschließend Suche und Bibliothek öffnen.
// Kalender-/Routinejobs erst nach Prüfung ihres letzten bestätigten Ausführungspunkts freigeben.
// Keine wiederholte Mail, Freigabe oder Friständerung durch Replay."
//
// KEIN ZWEITES BETRIEBSSYSTEM. Der Wiederanlauf ist ein Schalter am bestehenden Serverstart
// (`KLARWERK_WIEDERANLAUF=<kennung>`), danach dieselbe Anwendung mit drei Unterschieden:
//
//   1. AUSSENAKTIONEN GESTOPPT. `server.ts` startet Wissensereignis-Meldungen, Hintergrundprüfung
//      und Lückenerkennung nicht (`GESTOPPTE_AUSSENAKTIONEN`). Die Fristläufe (Papierkorb,
//      Gedächtnis, Klara-Aufräumen) laufen weiter: sie führen Löschfristen nach und wirken nicht
//      nach außen.
//   2. SPERRE BIS ZUR FREIGABE. Bibliothek, Suche, Fragen, Exporte, Schnittstellenschlüssel und
//      Office-Zugriff sind gesperrt (503 `WIEDERANLAUF`); offen bleiben Anmeldung, der
//      Verzeichnisabgleich (SCIM — er führt Rechteentzüge des Identitätsanbieters nach) und alles für
//      Konten mit `users.manage`. Die Verwaltung führt mit den VORHANDENEN Wegen nach: Konto sperren
//      oder Rolle ändern (`PUT /api/users/:id`), Konto entfernen, Space-Mitgliedschaft, Objekt in den
//      Papierkorb (`DELETE /api/kos/:id`).
//   3. REPLAY-GRENZE. Vor jeder Außenaktion hält `setzeWiederanlaufGrenze` (wissensereignisse.ts) den
//      wiederhergestellten Stand der Meldungen fest; nach der Freigabe geht nichts davon ein zweites
//      Mal hinaus.
//
// DIE FREIGABE (`POST /api/admin/wiederanlauf/freigabe`) verlangt die vier Bestätigungen und prüft
// die Auditkette selbst — mit derselben Regel wie der Restore-Drill (Kettenbrüche, unerklärte und
// ungeprüfte Abweichungen = 0). Sie steht als `wiederanlauf.freigegeben` in der Kette und gilt damit
// auch nach einem Neustart mit derselben Kennung. Die Außenaktionen laufen erst wieder nach einem
// Neustart OHNE den Schalter — ab der gesetzten Grenze.
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AuditService } from "../../audit";
import type { AuthService } from "../../auth";
import { can } from "../../rbac";
import { HINTERGRUNDLAUF_AUDIT } from "./hintergrundpruefung";
import { makeGuards, tokenFromRequest } from "./http";
import {
  type WiederanlaufGrenze,
  type WissensereignisQuellen,
  setzeWiederanlaufGrenze,
} from "./wissensereignisse";

export const WIEDERANLAUF_ENV = "KLARWERK_WIEDERANLAUF";
export const AKTION_WIEDERANLAUF_BEGONNEN = "wiederanlauf.begonnen";
export const AKTION_WIEDERANLAUF_FREIGEGEBEN = "wiederanlauf.freigegeben";
export const WIEDERANLAUF_AKTEUR = "system:wiederanlauf";
export const WIEDERANLAUF_PFAD = "/api/admin/wiederanlauf";

const KENNUNG_FORM = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

/** Was im Wiederanlauf nicht startet — jede dieser Aufgaben wirkt nach außen oder verbraucht Budget. */
export const GESTOPPTE_AUSSENAKTIONEN = [
  {
    id: "wissensereignisse",
    name: "Wissensereignis-Meldungen an Fremdwerkzeuge (KLARWERK_WEBHOOKS)",
  },
  { id: "hintergrundpruefung", name: "Hintergrundprüfung (Modellvergleiche)" },
  { id: "lueckenerkennung", name: "Lückenerkennung über den Reasoner" },
] as const;

/** Was weiterläuft — reine Fristläufe innerhalb der Instanz. */
export const WEITERLAUFENDE_FRISTLAEUFE = [
  "Papierkorb-Endlöschung (Wissensobjekte und Entwürfe)",
  "Gedächtnis-Aufräumlauf",
  "Klara-Aufräumlauf",
] as const;

/** Die vier Bestätigungen der Freigabe — in dieser Reihenfolge nach Peters Entscheidung 45. */
export const FREIGABE_BESTAETIGUNGEN = [
  "integritaet",
  "rechteentzuege",
  "loeschmarkierungen",
  "aussenaktionen",
] as const;
export type FreigabeBestaetigung = (typeof FREIGABE_BESTAETIGUNGEN)[number];

export interface Wiederanlauf {
  kennung: string;
}

/**
 * Liest den Schalter. Nicht gesetzt → `undefined`, der Start bleibt wie bisher. Ein Wert, der keine
 * Kennung ist, bricht den Start ab: ein Wiederanlauf, der still als Normalstart liefe, wäre genau der
 * Fall, den der Schalter verhindern soll.
 */
export function leseWiederanlauf(
  env: Record<string, string | undefined> = process.env,
): Wiederanlauf | undefined {
  const roh = env[WIEDERANLAUF_ENV]?.trim();
  if (!roh) {
    return undefined;
  }
  if (!KENNUNG_FORM.test(roh)) {
    throw new Error(
      `${WIEDERANLAUF_ENV} ist keine gültige Kennung (Buchstaben, Ziffern, . _ : -, höchstens 64 Zeichen).`,
    );
  }
  return { kennung: roh };
}

// GET-Auskünfte ohne Bestandsinhalt, die die Anmeldeseite braucht (dieselben, die JOB 4015 als
// bewusst offen gemessen hat).
const OFFENE_AUSKUENFTE = new Set([
  "/api/features",
  "/api/branding",
  "/api/i18n/locales",
  "/api/ai-status",
  "/api/reasoner/status",
]);

/** Ist dieser Weg während der Sperre nur der Verwaltung offen? */
export function gesperrterWeg(methode: string, pfad: string): boolean {
  if (pfad.startsWith("/api/auth/") || pfad.startsWith(WIEDERANLAUF_PFAD)) {
    return false;
  }
  if (methode === "GET" && OFFENE_AUSKUENFTE.has(pfad)) {
    return false;
  }
  return pfad.startsWith("/api/") || pfad.startsWith("/wopi/");
}

export const SPERRSATZ =
  "Klarwerk läuft nach einer Wiederherstellung wieder an. Bibliothek, Suche und Schnittstellen öffnen, sobald die Verwaltung Rechteentzüge und Löschungen nachgeführt hat.";

export interface WiederanlaufDeps {
  wiederanlauf: Wiederanlauf;
  audit: AuditService;
  auth: AuthService;
  quellen: WissensereignisQuellen;
  log?: { info: (text: string) => void };
}

export interface WiederanlaufLage {
  readonly kennung: string;
  freigegeben(): boolean;
  grenze(): WiederanlaufGrenze | undefined;
}

/**
 * Hängt Sperre, Auskunft und Freigabe an die App. MUSS vor `app.ready()`/`listen` gerufen werden:
 * die Grenze wird im `onReady` gesetzt — nach dem Bereitschaftslauf der App (Suchprojektion) und
 * bevor eine Anfrage angenommen wird. Scheitert sie, wird die App nicht bereit (fail-closed).
 */
export function registriereWiederanlauf(
  app: FastifyInstance,
  deps: WiederanlaufDeps,
): WiederanlaufLage {
  const { kennung } = deps.wiederanlauf;
  const guards = makeGuards(deps.auth);
  let freigegeben = false;
  let grenze: WiederanlaufGrenze | undefined;
  let datenstand: string | null = null;

  app.addHook("onReady", async () => {
    // Der Datenstand ist der jüngste Eintrag der wiederhergestellten Kette — gelesen, BEVOR der
    // Wiederanlauf selbst etwas anhängt. Ein zweiter Start derselben Kennung liest ihn aus dem
    // Beginn-Eintrag, sonst wäre es der eigene Eintrag des ersten Starts.
    const begonnen = (await deps.audit.list({ action: AKTION_WIEDERANLAUF_BEGONNEN })).find(
      (e) => e.eventId === `${AKTION_WIEDERANLAUF_BEGONNEN}:${kennung}`,
    );
    if (begonnen) {
      datenstand =
        typeof begonnen.payload.datenstand === "string" ? begonnen.payload.datenstand : null;
    } else {
      datenstand = (await deps.audit.page({ limit: 1 })).entries[0]?.at ?? null;
    }
    freigegeben = (await deps.audit.list({ action: AKTION_WIEDERANLAUF_FREIGEGEBEN })).some(
      (e) => e.eventId === `${AKTION_WIEDERANLAUF_FREIGEGEBEN}:${kennung}`,
    );
    grenze = await setzeWiederanlaufGrenze({
      quellen: deps.quellen,
      audit: deps.audit,
      wiederanlauf: kennung,
    });
    await deps.audit.recordOnce(`${AKTION_WIEDERANLAUF_BEGONNEN}:${kennung}`, {
      actor: WIEDERANLAUF_AKTEUR,
      action: AKTION_WIEDERANLAUF_BEGONNEN,
      target: "wiederanlauf",
      payload: {
        kennung,
        datenstand,
        gestoppt: GESTOPPTE_AUSSENAKTIONEN.map((a) => a.id),
        replayGrenze: {
          unterdrueckt: grenze.unterdrueckt.length,
          geschlossen: grenze.geschlossen.length,
        },
      },
    });
    // Satz und Werte nach der Log-Positivliste (`log-positivliste.ts`).
    deps.log?.info(
      `Wiederanlauf ${kennung}: ${freigegeben ? "bereits freigegeben" : "Sperre aktiv bis zur Freigabe"}, Datenstand ${datenstand ?? "unbekannt"}, Replay-Grenze: ${grenze.unterdrueckt.length} Meldungen unterdrückt, ${grenze.geschlossen.length} offene Zustellungen geschlossen.`,
    );
  });

  app.addHook("onRequest", async (request, reply) => {
    if (freigegeben) {
      return;
    }
    const pfad = request.routeOptions?.url ?? request.url.split("?")[0] ?? "";
    if (!gesperrterWeg(request.method, pfad) || (await istVerwaltung(deps.auth, request))) {
      return;
    }
    reply
      .code(503)
      .header("retry-after", "300")
      .send({ error: "WIEDERANLAUF", message: SPERRSATZ, wiederanlauf: kennung });
    return reply;
  });

  app.get(WIEDERANLAUF_PFAD, async (request, reply) => {
    const user = await guards.requirePermission("users.manage", request, reply);
    if (!user) {
      return;
    }
    reply.code(200).send(await auskunft());
  });

  app.post<{ Body: Record<string, unknown> | null }>(
    `${WIEDERANLAUF_PFAD}/freigabe`,
    async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      const body = request.body && typeof request.body === "object" ? request.body : {};
      const fehlend = FREIGABE_BESTAETIGUNGEN.filter((b) => body[b] !== true);
      if (fehlend.length > 0) {
        reply.code(400).send({
          error: "BESTAETIGUNG_FEHLT",
          message:
            "Die Freigabe braucht alle vier Bestätigungen: Integrität geprüft, Rechteentzüge und Löschmarkierungen nachgeführt, Außenaktionen geprüft.",
          fehlend,
        });
        return;
      }
      const bericht = await deps.audit.verifyReport();
      const integritaet = {
        eintraege: bericht.count,
        linkageBreaks: bericht.linkageBreaks,
        unresolvedDeviations: bericht.unresolvedDeviations,
        uncheckedDeviations: bericht.uncheckedDeviations,
      };
      if (
        bericht.linkageBreaks !== 0 ||
        bericht.unresolvedDeviations !== 0 ||
        bericht.uncheckedDeviations !== 0
      ) {
        reply.code(409).send({
          error: "INTEGRITAET",
          message:
            "Die Auditkette trägt nicht (Kettenbruch oder unerklärte/ungeprüfte Abweichung) — keine Freigabe.",
          integritaet,
        });
        return;
      }
      await deps.audit.recordOnce(`${AKTION_WIEDERANLAUF_FREIGEGEBEN}:${kennung}`, {
        actor: user.id,
        action: AKTION_WIEDERANLAUF_FREIGEGEBEN,
        target: "wiederanlauf",
        payload: { kennung, bestaetigt: [...FREIGABE_BESTAETIGUNGEN], integritaet, datenstand },
      });
      freigegeben = true;
      reply.code(200).send(await auskunft());
    },
  );

  async function auskunft() {
    const hintergrund = await deps.audit.list({ action: HINTERGRUNDLAUF_AUDIT });
    const letzterHintergrundlauf = hintergrund.reduce<string | null>(
      (j, e) => (j === null || e.at > j ? e.at : j),
      null,
    );
    const punkt: Record<string, string | null> = {
      wissensereignisse: grenze?.letzteBestaetigteZustellung ?? null,
      hintergrundpruefung: letzterHintergrundlauf,
      lueckenerkennung: null,
    };
    return {
      kennung,
      zustand: freigegeben ? "freigegeben" : "gesperrt",
      datenstand,
      schritte: FREIGABE_BESTAETIGUNGEN,
      gestoppt: GESTOPPTE_AUSSENAKTIONEN.map((a) => ({
        ...a,
        letzterBestaetigterPunkt: punkt[a.id] ?? null,
      })),
      weiterlaufend: WEITERLAUFENDE_FRISTLAEUFE,
      replayGrenze: grenze
        ? {
            unterdrueckt: grenze.unterdrueckt,
            geschlossen: grenze.geschlossen,
            letzteBestaetigteZustellung: grenze.letzteBestaetigteZustellung,
          }
        : null,
      naechsterSchritt: freigegeben
        ? `Ohne ${WIEDERANLAUF_ENV} neu starten — erst dann laufen die gestoppten Außenaktionen wieder, ab der Replay-Grenze.`
        : "Integrität prüfen, Rechteentzüge und Löschmarkierungen seit dem Datenstand nachführen, Außenaktionen prüfen, dann freigeben.",
    };
  }

  return { kennung, freigegeben: () => freigegeben, grenze: () => grenze };
}

/**
 * Darf diese Anfrage während der Sperre durch? Nur ein angemeldetes Konto mit `users.manage`.
 * Schlüsselzugänge (Add-in, Dienst-Schlüssel) sind ausdrücklich NICHT die Verwaltung.
 */
async function istVerwaltung(auth: AuthService, request: FastifyRequest): Promise<boolean> {
  const kontext = (request as { authContext?: { authKind?: string } | null }).authContext;
  if (kontext?.authKind === "addon") {
    return false;
  }
  const token = tokenFromRequest(request);
  const user = token ? await auth.authenticate(token) : undefined;
  return user ? can(user.role, "users.manage") : false;
}
