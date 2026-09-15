// ================================================================================================
// DIE EINE VERDRAHTUNG DER ROUTEN-FÄLLE — HTTP-Schicht über dem Kreis aus `demo-zugang-gaeste`.
// ================================================================================================
//
// JOB 3755 hat diese Verdrahtung in `befristung-ueber-die-schnittstelle.test.ts` aufgebaut, als sie
// nur eine Datei trug. JOB 3780 stellt eine zweite Datei daneben (die Formprüfung von `role`,
// `approve`, `password` an demselben Endpunkt) — und damit gilt hier dasselbe Argument, das
// `tests/demo-zugang-gaeste/aufbau.ts:7` für die Dienst-Fälle aufschreibt: Läge die Verdrahtung
// zweimal da, könnten zwei Dateien später still gegen verschiedene Fastify-Aufbauten messen, und
// zwei Aussagen über DENSELBEN Endpunkt wären nicht mehr vergleichbar.
//
// KEIN DRITTER KREIS. Uhr, Ablagen und Prüfprotokoll kommen unverändert aus
// `tests/demo-zugang-gaeste/aufbau` — dieses Modul setzt ausschließlich den Draht darüber.
//
// DER AUFRÄUM-HAKEN WIRD HIER NICHT REGISTRIERT, sondern nur bereitgestellt. Ein `afterEach` im
// Rumpf eines gemeinsamen Moduls hinge an der Sammelreihenfolge der Dateien (wer importiert zuerst)
// und schlösse im schlechten Fall die Instanzen einer FREMDEN Datei. Jede Testdatei ruft
// `schliesseOffeneDraehte` in ihrem eigenen `afterEach`.
import Fastify, { type FastifyInstance, type LightMyRequestResponse } from "fastify";
import { expect } from "vitest";
import type { SessionRepo, UserRepo } from "../../services/auth";
import { authRoutes } from "../../services/auth/src/routes";
import type { PublicUser } from "../../services/auth/src/types";
import { GAST_PASSWORT, type Kreis, baueKreis } from "../demo-zugang-gaeste/aufbau";

export interface Draht {
  k: Kreis;
  app: FastifyInstance;
}

const offen: FastifyInstance[] = [];

/** Schließt die in diesem Fall geöffneten Fastify-Instanzen. Aufruf gehört in jedes `afterEach`. */
export async function schliesseOffeneDraehte(): Promise<void> {
  for (const app of offen.splice(0)) {
    await app.close();
  }
}

/**
 * JOB 4011 R2: die Ablagen sind DURCHGEREICHT, nicht fest verdrahtet.
 *
 * `baueKreis` nimmt sie seit JOB 3665 R2 entgegen (`aufbau.ts`), der Draht darüber gab sie bis
 * hierher nicht weiter — und damit war am HTTP-Weg kein Fall messbar, in dem ein SCHREIBEN
 * scheitert. Genau den brauchte BEN in Runde 1, um zu zeigen, was der Anlageweg zurücklässt, wenn
 * die Ablage mitten im Vorgang nicht antwortet (F1/F2). Ein zweiter Draht daneben wäre der
 * teurere Weg gewesen: zwei Fastify-Aufbauten über DEMSELBEN Endpunkt sind zwei Aussagen, die nur
 * heute übereinstimmen.
 */
export async function baueDraht(
  ablagen: {
    sessions?: SessionRepo;
    users?: UserRepo;
    /**
     * JOB 4011 R4: die Laufzeitzeilen des Servers, mitgelesen.
     *
     * `Fastify()` protokolliert ohne Logger in nichts hinein — `request.log.error` ist dann ein
     * Leerlauf, und WAS der Anlageweg über einen zurückgebliebenen Rest schreibt, wäre nicht
     * prüfbar. BEN verlangt dafür einen Test des PROTOKOLLINHALTS (Korrekturpflicht 2 der Runde 3);
     * ohne diesen Hahn bliebe es beim Lesen des Quelltexts, und das ist keine Messung.
     */
    protokoll?: (zeile: Record<string, unknown>) => void;
  } = {},
): Promise<Draht> {
  const k = baueKreis(ablagen);
  const mitlesen = ablagen.protokoll;
  const app = mitlesen
    ? Fastify({
        logger: {
          level: "error",
          stream: {
            write: (zeile: string) => {
              mitlesen(JSON.parse(zeile) as Record<string, unknown>);
            },
          },
        },
      })
    : Fastify();
  await app.register(authRoutes(k.service));
  await app.ready();
  offen.push(app);
  return { k, app };
}

export function anmelden(app: FastifyInstance, email: string): Promise<LightMyRequestResponse> {
  return app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: GAST_PASSWORT },
  });
}

/** Die Anmeldung, die gelingen MUSS — sonst misst der Fall darunter nichts. */
export async function token(app: FastifyInstance, email: string): Promise<string> {
  const antwort = await anmelden(app, email);
  if (antwort.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${antwort.statusCode} ${antwort.body}`);
  }
  return antwort.json().token as string;
}

export function verwalte(
  app: FastifyInstance,
  sitzung: string,
  id: string,
  body: Record<string, unknown>,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: "PUT",
    url: `/api/users/${id}`,
    headers: { authorization: `Bearer ${sitzung}` },
    payload: body,
  });
}

/** Der Stand, den ein Mensch in der Nutzerliste sieht — nicht der aus der Antwort von eben. */
export async function ausDerListe(
  app: FastifyInstance,
  sitzung: string,
  id: string,
): Promise<PublicUser | undefined> {
  const antwort = await app.inject({
    method: "GET",
    url: "/api/users",
    headers: { authorization: `Bearer ${sitzung}` },
  });
  expect(antwort.statusCode, `GET /api/users: ${antwort.body}`).toBe(200);
  return (antwort.json() as PublicUser[]).find((u) => u.id === id);
}

export function ich(app: FastifyInstance, sitzung: string): Promise<LightMyRequestResponse> {
  return app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { authorization: `Bearer ${sitzung}` },
  });
}
