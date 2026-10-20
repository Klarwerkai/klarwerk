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
import type { LoeschmarkierungsNachfuehrung } from "./loeschmarkierungen";
import {
  type WiederanlaufGrenze,
  type WissensereignisQuellen,
  setzeWiederanlaufGrenze,
} from "./wissensereignisse";

export const WIEDERANLAUF_ENV = "KLARWERK_WIEDERANLAUF";
export const AKTION_WIEDERANLAUF_BEGONNEN = "wiederanlauf.begonnen";
export const AKTION_WIEDERANLAUF_FREIGEGEBEN = "wiederanlauf.freigegeben";
/** Nachtrag des Sicherungsstands, wenn der erste Start ihn nicht kannte. */
export const AKTION_WIEDERANLAUF_SICHERUNGSSTAND = "wiederanlauf.sicherungsstand";
/** P06 · RF-17: die Löschmarkierungen persönlicher Routinen sind nachgeführt (nur Zahlen). */
export const AKTION_WIEDERANLAUF_LOESCHMARKIERUNGEN = "wiederanlauf.loeschmarkierungen";
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
  {
    id: "klara-erinnerungen",
    name: "Persönliche Erinnerungen, Zusammenfassungen und Routineberichte",
  },
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

/**
 * Ben, Nacharbeit 2 (P09-AC05): DIE NACHFÜHRUNGSGRENZE IST DER SICHERUNGSSTAND — nie ein Auditzeitpunkt.
 * Bis hierher galt der jüngste Eintrag der wiederhergestellten Kette als „Datenstand". Lief vorher der
 * Restore-Drill gegen dasselbe Ziel, war das dessen Anmeldung: wer „seit dem Datenstand" nachführte,
 * übersah Löschungen und Entzüge zwischen Sicherung und Drill. Der Stand kommt deshalb ausschließlich
 * aus der Sicherung selbst — dem Dateinamen von `backup.sh` (`klarwerk-<UTC>.dump`, auch mit Pfad oder
 * Folgenummer) oder einer ausdrücklichen UTC-Zeitangabe für Sicherungen ohne diesen Namen.
 */
export const SICHERUNGSSTAND_ENV = "KLARWERK_WIEDERANLAUF_SICHERUNG";

const DUMPNAME = /(?:^|\/)klarwerk-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z(?:_\d+)?\.dump$/;
const UTC_ZEIT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?Z$/;

/** Der Sicherungsstand als ISO-Zeitpunkt (UTC) — oder ein Wurf, wenn die Angabe keiner ist. */
export function sicherungsstandAus(roh: string): string {
  const wert = roh.trim();
  const name = DUMPNAME.exec(wert);
  const iso = name
    ? `${name[1]}-${name[2]}-${name[3]}T${name[4]}:${name[5]}:${name[6]}Z`
    : UTC_ZEIT.test(wert)
      ? wert
      : undefined;
  const zeit = iso === undefined ? Number.NaN : Date.parse(iso);
  if (Number.isNaN(zeit)) {
    throw new Error(
      `${SICHERUNGSSTAND_ENV} ist weder ein Sicherungsname von backup.sh (klarwerk-<UTC>.dump) noch eine UTC-Zeitangabe.`,
    );
  }
  return new Date(zeit).toISOString();
}

export interface Wiederanlauf {
  kennung: string;
  /** Sicherungsstand (ISO, UTC) — die Nachführungsgrenze. Fehlt er, gibt es keine Freigabe. */
  sicherungsstand?: string | undefined;
}

/**
 * Liest den Schalter. Nicht gesetzt → `undefined`, der Start bleibt wie bisher. Ein Wert, der keine
 * Kennung ist, bricht den Start ab: ein Wiederanlauf, der still als Normalstart liefe, wäre genau der
 * Fall, den der Schalter verhindern soll. Ein ungültiger Sicherungsstand bricht ebenso ab; ein
 * fehlender lässt den Start in der Sperre zu, aber keine Freigabe.
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
  const sicherung = env[SICHERUNGSSTAND_ENV]?.trim();
  return { kennung: roh, sicherungsstand: sicherung ? sicherungsstandAus(sicherung) : undefined };
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
  /**
   * produkt:20261011:peter-p06 · RF-17: führt die Löschmarkierungen der Privatlöschung nach
   * (`loeschmarkierungen.ts`) — im `onReady`, also bevor eine Anfrage angenommen wird und damit vor
   * der Freigabe. Ein Fehler lässt die App nicht bereit werden (fail-closed). Ohne Angabe wie bisher.
   */
  loeschmarkierungen?: () => Promise<LoeschmarkierungsNachfuehrung>;
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
  // Die Nachführungsgrenze: AUSSCHLIESSLICH der Sicherungsstand (s. `SICHERUNGSSTAND_ENV`). Kein
  // Auditzeitpunkt ersetzt ihn — unbekannt bleibt unbekannt, und dann gibt es keine Freigabe.
  let sicherungsstand: string | null = deps.wiederanlauf.sicherungsstand ?? null;
  // P06 · RF-17: Ergebnis der Nachführung persönlicher Löschmarkierungen; `null` ohne Anschluss.
  let loeschmarkierungen: LoeschmarkierungsNachfuehrung | null = null;

  app.addHook("onReady", async () => {
    // ZUERST die Löschmarkierungen: was die Person nach dem Sicherungsstand privat gelöscht hat, ist
    // weg, bevor irgendjemand — auch die Verwaltung — eine Anfrage stellen kann.
    if (deps.loeschmarkierungen) {
      loeschmarkierungen = await deps.loeschmarkierungen();
      await deps.audit.recordOnce(`${AKTION_WIEDERANLAUF_LOESCHMARKIERUNGEN}:${kennung}`, {
        actor: WIEDERANLAUF_AKTEUR,
        action: AKTION_WIEDERANLAUF_LOESCHMARKIERUNGEN,
        target: "wiederanlauf",
        payload: {
          kennung,
          eingerichtet: loeschmarkierungen.ort !== null,
          markierungen: loeschmarkierungen.markierungen,
          entfernt: loeschmarkierungen.entfernt,
        },
      });
    }
    // DAUERHAFT: steht der Stand schon im Beginn-Eintrag dieses Wiederanlaufs, gilt er — auch nach
    // einem Neustart mit anderer oder fehlender Angabe. Erst ein unbekannter Stand nimmt die Angabe
    // dieses Starts an (und hält sie im Nachtrag fest).
    const begonnen = (await deps.audit.list({ action: AKTION_WIEDERANLAUF_BEGONNEN })).find(
      (e) => e.eventId === `${AKTION_WIEDERANLAUF_BEGONNEN}:${kennung}`,
    );
    const nachtrag = (await deps.audit.list({ action: AKTION_WIEDERANLAUF_SICHERUNGSSTAND })).find(
      (e) => e.eventId === `${AKTION_WIEDERANLAUF_SICHERUNGSSTAND}:${kennung}`,
    );
    const festgehalten = [begonnen, nachtrag]
      .map((e) => e?.payload.sicherungsstand)
      .find((wert): wert is string => typeof wert === "string");
    if (festgehalten) {
      sicherungsstand = festgehalten;
    } else if (begonnen && sicherungsstand) {
      await deps.audit.recordOnce(`${AKTION_WIEDERANLAUF_SICHERUNGSSTAND}:${kennung}`, {
        actor: WIEDERANLAUF_AKTEUR,
        action: AKTION_WIEDERANLAUF_SICHERUNGSSTAND,
        target: "wiederanlauf",
        payload: { kennung, sicherungsstand },
      });
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
        sicherungsstand,
        gestoppt: GESTOPPTE_AUSSENAKTIONEN.map((a) => a.id),
        replayGrenze: {
          unterdrueckt: grenze.unterdrueckt.length,
          geschlossen: grenze.geschlossen.length,
        },
      },
    });
    // Satz und Werte nach der Log-Positivliste (`log-positivliste.ts`).
    deps.log?.info(
      `Wiederanlauf ${kennung}: ${freigegeben ? "bereits freigegeben" : "Sperre aktiv bis zur Freigabe"}, Sicherungsstand ${sicherungsstand ?? "unbekannt"}, Replay-Grenze: ${grenze.unterdrueckt.length} Meldungen unterdrückt, ${grenze.geschlossen.length} offene Zustellungen geschlossen.`,
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
      // Ohne Sicherungsstand gibt es keine Grenze, gegen die „nachgeführt" bestätigt werden könnte.
      if (!sicherungsstand) {
        reply.code(409).send({
          error: "SICHERUNGSSTAND_UNBEKANNT",
          message: `Der Sicherungsstand ist unbekannt — die Nachführung hat keine Grenze. Mit ${SICHERUNGSSTAND_ENV}=<Sicherungsname oder UTC-Zeit> neu starten.`,
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
        payload: {
          kennung,
          bestaetigt: [...FREIGABE_BESTAETIGUNGEN],
          integritaet,
          nachfuehrungsgrenze: sicherungsstand,
        },
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
      // Alles NACH diesem Zeitpunkt fehlt dem Bestand und ist nachzuführen. `null` = unbekannt.
      nachfuehrungsgrenze: { sicherungsstand },
      schritte: FREIGABE_BESTAETIGUNGEN,
      gestoppt: GESTOPPTE_AUSSENAKTIONEN.map((a) => ({
        ...a,
        letzterBestaetigterPunkt: punkt[a.id] ?? null,
      })),
      weiterlaufend: WEITERLAUFENDE_FRISTLAEUFE,
      // P06 · RF-17: vor der Annahme der ersten Anfrage angewendet; `ort: null` = keine Ablage
      // eingerichtet (`KLARWERK_LOESCHMARKIERUNGEN`), dann ist nichts nachgeführt.
      persoenlicheLoeschmarkierungen: loeschmarkierungen,
      replayGrenze: grenze
        ? {
            unterdrueckt: grenze.unterdrueckt,
            geschlossen: grenze.geschlossen,
            letzteBestaetigteZustellung: grenze.letzteBestaetigteZustellung,
          }
        : null,
      naechsterSchritt: freigegeben
        ? `Ohne ${WIEDERANLAUF_ENV} neu starten — erst dann laufen die gestoppten Außenaktionen wieder, ab der Replay-Grenze.`
        : sicherungsstand
          ? `Integrität prüfen, Rechteentzüge und Löschmarkierungen seit dem Sicherungsstand ${sicherungsstand} nachführen, Außenaktionen prüfen, dann freigeben.`
          : `Sicherungsstand unbekannt — mit ${SICHERUNGSSTAND_ENV}=<Sicherungsname oder UTC-Zeit> neu starten; ohne ihn keine Freigabe.`,
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
