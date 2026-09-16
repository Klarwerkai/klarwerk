// ================================================================================================
// JOB 4223 · DIE EINE MESSSTRECKE DES GASTWEGS — echter Server, echter Socket, getrennte Sitzungen.
// ================================================================================================
//
// WAS HIER ANDERS IST ALS IN ALLEM, WAS ES SCHON GIBT. Der Gastweg ist heute auf sechs Ebenen
// einzeln gemessen und auf keiner durchgehend:
//
//   · `tests/demo-zugang-gaeste/**`        — der DIENST, mit gestellter Uhr und Speicherablagen.
//   · `tests/demo-zugang-gaeste-route/**`  — die ROUTE, über `app.inject` (kein Socket).
//   · `tests/gast-befristung/**`           — Anlegen und Lesbarkeit, ebenfalls über `inject`.
//   · `tests/gast-befristung-flaeche/**`   — die FLÄCHE in jsdom, mit GEFÄLSCHTEM `fetch`
//                                            (die Datei sagt es selbst, `:22-28`).
//   · `tests/gast-ablauf-anmeldemaske/**`  — die Maske in jsdom, `fetch` auf `app.inject` gelegt.
//   · `tests/einstieg-gastweg/**`          — die Hilfe, ohne Server.
//
// Sechs grüne Läufe auf sechs Ebenen sind genau das, was den Meilenstein D1 nicht geschlossen hat
// (`register/planung/MEILENSTEINE.json`, Kriterium 3: „Anmeldung, Ablauf und Abmeldung praktisch
// nachweisen"). Zwischen je zwei Ebenen liegt eine ANGENOMMENE Verbindung, und angenommene
// Verbindungen sind in diesem Produkt schon dreimal die Fundstelle gewesen (JOB 3665 D5, JOB 4011
// R3/R4). Diese Strecke nimmt die Annahmen heraus:
//
//   · EIN ECHTER SOCKET. `app.listen({ port: 0 })` und `fetch` über `http://127.0.0.1:<port>`.
//     `app.inject` (light-my-request) baut Anfrage und Antwort im Prozess nach; es sieht nie einen
//     Header-Parser, nie eine Cookie-Verarbeitung, nie eine Verbindung. Was hier läuft, läuft über
//     denselben Weg wie im Betrieb.
//   · ECHTE, GETRENNTE SITZUNGEN. Jede `Sitzung` unten hat ihren EIGENEN Keksbeutel — genau wie
//     zwei Browserprofile. Der Admin kann dem Gast seine Anmeldung damit nicht leihen, und der
//     Gast kann sich nicht versehentlich am Admin-Bearer bedienen. (Das ist die Lücke, die die
//     vorhandene Chromium-Vorrichtung `tests/design/h1-chromium.ts:239` baulich hat: sie setzt in
//     JEDE Anfrage denselben Bearer.)
//   · KEIN DOPPEL. Kein gefälschtes `fetch`, kein Dienstdoppel, keine gestellte Uhr. Der Ablauf
//     wird dadurch kontrolliert, dass der Admin über die ECHTE Route einen Zeitpunkt in der
//     VERGANGENHEIT setzt — das ist derselbe Handgriff, den ein Admin am Bildschirm macht, wenn er
//     einen Zugang sofort beendet, und er braucht weder ein `sleep` noch eine verstellte Uhr.
//
// WARUM DIESELBE DATEI ZWEI ABLAGEN TRÄGT (Speicher und PostgreSQL): weil sonst zwei Strecken
// nebeneinander stünden, die nur heute dasselbe messen — dasselbe Argument, mit dem
// `tests/demo-zugang-gaeste/aufbau.ts:7` seinen einen Aufbau begründet. Der schnelle Lauf im Tor
// nimmt die Speicherablagen (das Tor fährt bewusst ohne Docker, `vitest.config.ts:31-32`); der
// Integrationslauf daneben reicht einen echten `Pool` herein und fährt DIESELBEN Schritte.
import type { AddressInfo } from "node:net";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { buildApp, buildPgServices, buildServices } from "../../services/app/src/build-app";
import type { Sprache } from "../../services/auth/src/meldungen";
import type { PublicUser, Role } from "../../services/auth/src/types";

/** Alle Konten dieser Strecke teilen es sich — die Passwortstärke ist hier nicht der Gegenstand. */
export const PASSWORT = "gastweg-geheim-4223";

export interface Antwort {
  status: number;
  /** Der ROHE Rumpf. Fall 3 sucht darin nach geschütztem Inhalt — ein geparstes Objekt verspielte das. */
  text: string;
  json: unknown;
  kopf: Headers;
}

/**
 * EIN Browserprofil: eigener Keksbeutel, eigene Sprache, sonst nichts.
 *
 * WARUM KEKSE UND NICHT BEARER. Die Fläche spricht über den Keks (`apps/web/src/api/client.ts:27`,
 * `credentials: "include"`); der Bearer ist der Weg der Add-ins und der Bestandstests. Wer den
 * Gastweg messen will, den ein Mensch geht, muss den Weg nehmen, den die Fläche nimmt — sonst
 * bliebe die gesamte Keksverarbeitung (Setzen bei der Anmeldung, Mitsenden, Ablaufen) ungemessen,
 * und genau sie ist der Unterschied zwischen `inject` und einem echten Socket.
 */
export class Sitzung {
  private readonly kekse = new Map<string, string>();

  constructor(
    private readonly basis: string,
    /** Für Fehlermeldungen: „gast" sagt mehr als ein Port. */
    readonly name: string,
    private readonly sprache: Sprache = "de",
  ) {}

  /** Ist an dieser Sitzung überhaupt ein Sitzungskeks gesetzt? (Nach der Abmeldung: nein.) */
  hatSitzungskeks(): boolean {
    return (this.kekse.get("kw_session") ?? "") !== "";
  }

  async sende(verfahren: string, pfad: string, rumpf?: unknown): Promise<Antwort> {
    const kopf: Record<string, string> = { "accept-language": this.sprache };
    const keks = [...this.kekse].map(([k, v]) => `${k}=${v}`).join("; ");
    if (keks !== "") {
      kopf.cookie = keks;
    }
    if (rumpf !== undefined) {
      kopf["content-type"] = "application/json";
    }
    // `exactOptionalPropertyTypes` ist an: ein `body: undefined` ist nicht dasselbe wie kein Feld.
    const anfrage: RequestInit = { method: verfahren, headers: kopf, redirect: "manual" };
    if (rumpf !== undefined) {
      anfrage.body = JSON.stringify(rumpf);
    }
    const antwort = await fetch(`${this.basis}${pfad}`, anfrage);
    this.nimmKekse(antwort.headers);
    const text = await antwort.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { status: antwort.status, text, json, kopf: antwort.headers };
  }

  /**
   * Der Beutel nimmt auf, was der Server schickt — einschliesslich der LÖSCHUNG.
   *
   * Ein `Max-Age=0` (so meldet `POST /api/auth/logout` ab) muss den Keks wirklich entfernen. Würde
   * er hier bloss mit leerem Wert überschrieben und weiter mitgeschickt, sähe eine beendete Sitzung
   * aus wie eine bestehende mit ungültigem Wert — beides ergibt 401, und der Fall bewiese dann
   * nicht mehr, was er behauptet.
   */
  private nimmKekse(kopf: Headers): void {
    const roh: string[] =
      typeof (kopf as { getSetCookie?: () => string[] }).getSetCookie === "function"
        ? (kopf as unknown as { getSetCookie: () => string[] }).getSetCookie()
        : (kopf.get("set-cookie") ?? "") === ""
          ? []
          : [kopf.get("set-cookie") as string];
    for (const zeile of roh) {
      const erstes = zeile.split(";")[0] ?? "";
      const trenner = erstes.indexOf("=");
      if (trenner <= 0) {
        continue;
      }
      const name = erstes.slice(0, trenner).trim();
      const wert = erstes.slice(trenner + 1).trim();
      const geloescht = /(?:^|;)\s*max-age\s*=\s*0\s*(?:;|$)/i.test(zeile) || wert === "";
      if (geloescht) {
        this.kekse.delete(name);
      } else {
        this.kekse.set(name, wert);
      }
    }
  }
}

export interface Strecke {
  app: FastifyInstance;
  basis: string;
  /** Eine neue, LEERE Sitzung — das Gegenstück zu „frisches Browserprofil". */
  profil(name: string, sprache?: Sprache): Sitzung;
  schliessen(): Promise<void>;
}

/**
 * Startet die ECHTE Anwendung auf einem echten Port.
 *
 * `port: 0` und nicht eine geratene Nummer: der Prüfstand ist geteilt, und eine feste Nummer wäre
 * die eine Stelle, an der zwei gleichzeitige Läufe einander abschiessen.
 *
 * `pool` entscheidet über die Ablagen und über NICHTS SONST — dieselbe `buildApp`, dieselben
 * Routen, dieselbe Uhr. Ohne Pool laufen die Speicherfassungen (Tor-Lauf, kein Docker); mit Pool
 * die echte PostgreSQL (Integrationslauf).
 *
 * `vorListen` läuft NACH `buildApp` und VOR `listen` — das ist das einzige Fenster, in dem noch
 * Routen dazukommen dürfen (Fastify friert den Router beim Bereitwerden ein). Genau EIN Verbraucher
 * nutzt es: der Browserlauf, der die gebaute Fläche ausliefern muss (`registerWebStatic`, derselbe
 * Aufruf wie in `services/app/src/server.ts:66`). Die übrigen Fälle brauchen sie nicht, und ein
 * fehlendes `apps/web/dist` dürfte sie nicht rot machen.
 */
export async function starteStrecke(
  opts: { pool?: Pool; vorListen?: (app: FastifyInstance) => Promise<void> } = {},
): Promise<Strecke> {
  const services = opts.pool ? buildPgServices(opts.pool) : buildServices();
  const app = buildApp(services);
  if (opts.vorListen) {
    await opts.vorListen(app);
  }
  await app.listen({ port: 0, host: "127.0.0.1" });
  const adresse = app.server.address() as AddressInfo | null;
  if (adresse === null || typeof adresse === "string") {
    await app.close();
    throw new Error("JOB 4223: der Server hat keinen Port gemeldet — die Strecke steht nicht.");
  }
  const basis = `http://127.0.0.1:${adresse.port}`;
  return {
    app,
    basis,
    profil: (name, sprache) => new Sitzung(basis, name, sprache),
    schliessen: () => app.close(),
  };
}

/** Wirft mit Status UND Rumpf, wenn ein Schritt der Vorbereitung nicht durchkommt. */
export function mussGelingen(was: string, antwort: Antwort, erwartet = 200): Antwort {
  if (antwort.status !== erwartet) {
    throw new Error(`JOB 4223: ${was} → ${antwort.status} (erwartet ${erwartet}): ${antwort.text}`);
  }
  return antwort;
}

/**
 * Der erste Administrator einer LEEREN Instanz — über `POST /api/auth/setup`.
 *
 * Nicht über `POST /api/auth/register`: der öffentliche Registrierweg ist in Produktion
 * fail-closed AUS und nur in der Testumgebung freigeschaltet (`tests/setup-env.ts:6`). Die
 * Ersteinrichtung ist der Weg, den ein Betreiber wirklich geht.
 */
export async function ersteinrichtung(
  strecke: Strecke,
  email = "admin@gastweg-4223.test",
): Promise<{ sitzung: Sitzung; admin: PublicUser }> {
  const sitzung = strecke.profil("admin");
  const antwort = mussGelingen(
    "Ersteinrichtung",
    await sitzung.sende("POST", "/api/auth/setup", { name: "Admin", email, password: PASSWORT }),
    201,
  );
  return { sitzung, admin: (antwort.json as { user: PublicUser }).user };
}

/** Der Anlegeweg in EINEM Schritt: Rolle und Ende gehen mit, nicht hinterher (JOB 4011). */
export function gastAnlegen(
  admin: Sitzung,
  gast: { name: string; email: string; role?: Role; accessExpiresAt?: string | null },
): Promise<Antwort> {
  return admin.sende("POST", "/api/users", { ...gast, password: PASSWORT });
}

/** Der Stand, den ein Mensch in der Kontenliste sieht — nicht der aus der Antwort von eben. */
export async function ausDerListe(admin: Sitzung, id: string): Promise<PublicUser | undefined> {
  const antwort = mussGelingen("GET /api/users", await admin.sende("GET", "/api/users"));
  return (antwort.json as PublicUser[]).find((u) => u.id === id);
}

/** Befristung setzen, verlängern (String) oder nehmen (`null`) — der Änderungsweg der Fläche. */
export function befristen(admin: Sitzung, id: string, bis: string | null): Promise<Antwort> {
  return admin.sende("PUT", `/api/users/${id}`, { accessExpiresAt: bis });
}

/**
 * Ein Wissensobjekt mit BEKANNTEM Titel — der geschützte Inhalt, nach dem Fall 3 im Rumpf sucht.
 *
 * Er wird vom Admin angelegt, nicht vom Gast: ein `viewer` darf lesen und nicht schreiben
 * (`services/rbac/src/policy.ts:14`), und der erste erlaubte Arbeitsweg des Gastes ist genau dieses
 * Lesen.
 */
export async function wissensobjektAnlegen(admin: Sitzung, titel: string): Promise<string> {
  const antwort = mussGelingen(
    `POST /api/kos (${titel})`,
    await admin.sende("POST", "/api/kos", {
      confidentiality: "intern",
      title: titel,
      statement: `${titel} — Kurzfassung fuer den Pruefstand.`,
      type: "best_practice",
      category: "Wartung",
    }),
    201,
  );
  return (antwort.json as { id: string }).id;
}

/** Der erste erlaubte Arbeitsweg eines Gastes mit der Rolle `viewer`: `ko.read`. */
export function arbeitsweg(wer: Sitzung): Promise<Antwort> {
  return wer.sende("GET", "/api/kos");
}

/** Ein Zeitpunkt, der an jedem Tag vorbei ist, an dem dieser Lauf startet. */
export function vergangen(): string {
  return new Date(Date.now() - 60_000).toISOString();
}

/** Ein Zeitpunkt, der weit genug in der Zukunft liegt, um einen ganzen Lauf zu überdauern. */
export function kuenftig(tage = 7): string {
  return new Date(Date.now() + tage * 24 * 60 * 60 * 1000).toISOString();
}
