// ================================================================================================
// JOB 4076 — DIE ZWEI AUFRUFE DER SITZUNGSÜBERGABE, GENAU EINMAL VERDRAHTET
// ================================================================================================
//
// Drei Prüfdateien (S1 Vertrag, S2 ohne Cookie, S3 keine Auskunft) sprechen DIESELBEN zwei Routen
// an. Läge der `inject`-Aufruf dreimal da, könnten drei Dateien später still gegen verschieden
// gebaute Anfragen messen — und „alle drei Absagen sind gleich" (S3) wäre keine Aussage mehr über
// den Endpunkt, sondern über drei Testfassungen. Dieselbe Begründung, die
// `tests/demo-zugang-gaeste-route/draht.ts` für seine Verdrahtung aufschreibt.
//
// KEIN EIGENER AUFBAU: Uhr, Ablagen und Fastify-Draht kommen aus jenem Modul. Dieses hier setzt
// ausschliesslich die beiden Anfragen darüber.
import type { FastifyInstance, LightMyRequestResponse } from "fastify";

/**
 * Den Code holen. `sitzung === null` heisst: OHNE jeden Nachweis — genau der Fall, der 401 bekommen
 * muss. Sonst über den Bearer-Kopf, wie jede Routenprüfung dieses Hauses.
 */
export function codeHolen(
  app: FastifyInstance,
  sitzung: string | null,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: "POST",
    url: "/api/auth/office-handover",
    ...(sitzung === null ? {} : { headers: { authorization: `Bearer ${sitzung}` } }),
  });
}

/**
 * Den Code holen, aber MIT COOKIE statt Bearer — so ruft der Anmeldedialog wirklich: er ist
 * top-level auf der eigenen Herkunft, dort ist das Sitzungscookie erstklassig, und lesen kann er
 * es nicht (HttpOnly). Ohne diesen Weg wäre der Dialog auf ein Kennwort im Klartext angewiesen.
 */
export function codeHolenMitCookie(
  app: FastifyInstance,
  cookie: string,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: "POST",
    url: "/api/auth/office-handover",
    headers: { cookie },
  });
}

/**
 * Einlösen — OHNE Cookie und OHNE Authorization. Genau so ruft das Seitenfenster im
 * Office-Web-Rahmen: es hat beides nicht. Der Code IST der Nachweis.
 */
export function einloesen(app: FastifyInstance, code: unknown): Promise<LightMyRequestResponse> {
  return app.inject({
    method: "POST",
    url: "/api/auth/office-handover/redeem",
    payload: { code },
  });
}

/** Die eigene Auskunft, allein mit dem übergebenen Schlüssel — ohne Cookie. */
export function ichMitSchluessel(
  app: FastifyInstance,
  schluessel: string,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { authorization: `Bearer ${schluessel}` },
  });
}
