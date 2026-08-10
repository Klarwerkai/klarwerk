import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthService, Role } from "../../auth";
import { type Permission, can } from "../../rbac";

// Gemeinsamer HTTP-Baustein der App: Auth-Guard, RBAC-Guard und einheitliches
// Fehler-Mapping für alle modulübergreifenden Routen (FR-RBAC-04: serverseitig).

const SESSION_COOKIE = "kw_session";

export interface SessionUser {
  id: string;
  role: Role;
}

export interface Guards {
  requireUser(request: FastifyRequest, reply: FastifyReply): Promise<SessionUser | undefined>;
  requirePermission(
    permission: Permission,
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<SessionUser | undefined>;
}

export function tokenFromRequest(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.slice("Bearer ".length);
  }
  const cookie = request.headers.cookie;
  if (!cookie) {
    return undefined;
  }
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) {
      return rest.join("=");
    }
  }
  return undefined;
}

// Domänenfehler (KoError, ValidationError, …) tragen einen string `code`.
const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  NOT_APPROVED: 403,
  // SCRUM-509 R2: Herabstufung der Vertraulichkeit ohne Prüfer-/Admin-Rolle → 403.
  DOWNGRADE_FORBIDDEN: 403,
  INVALID_CREDENTIALS: 401,
  EMAIL_TAKEN: 409,
  // WP-SHIP8-FIX (bens F2): Aufräum-Bestätigung passt nicht mehr zur Vorschau-Zielmenge → Konflikt.
  CLEANUP_DRIFT: 409,
  // WP-SHIP8-CLOSE-2 (bens F1): Persistenz-Write traf 0 Zeilen (Objekt zwischenzeitlich weg).
  CONFLICT: 409,
  // AUFTRAG-mega20 Block A: die Erzeugungs-Kennung gehört zu einem fremden Vorgang — Konflikt,
  // nicht „ungültige Eingabe": die Anfrage ist wohlgeformt, der Schlüssel ist nur belegt.
  CREATE_ANCHOR_TAKEN: 409,
  // AUFTRAG-mega20 Block A: Anlage UND Rücknahme sind gescheitert — ein serverseitiger Restzustand,
  // der eine Reparatur braucht. Ein 400 würde dem Aufrufer suggerieren, er habe etwas falsch
  // gemacht und könne es besser machen; genau das kann er hier nicht.
  CREATE_ROLLBACK_FAILED: 500,
  // AUFTRAG-mega21 Block A: derselbe Vorgangsschlüssel, ABWEICHENDER Inhalt. 409 und nicht 400:
  // die Anfrage ist wohlgeformt und der Aufrufer hat nichts falsch gemacht — es ist ein Konflikt
  // mit einem bereits abgeschlossenen Vorgang, und der Weg zurück ist ein NEUER Vorgang.
  IDEMPOTENCY_PAYLOAD_MISMATCH: 409,
  // AUFTRAG-mega21 Block A: der Vorgang steht auf `repair_required`. Auch das ist ein Konflikt mit
  // einem Zustand, nicht ein Serverfehler dieser Anfrage — der Aufrufer bekommt eine wahre
  // Auskunft samt Objektkennung und keinen nichtssagenden 500.
  CREATE_REPAIR_REQUIRED: 409,
};

// G27 R1 (KW-ARCH-G27-HTTP-MASKIERUNG-07 §1): Fehlercodes, die REIN INTERN sind — technische
// Betriebslogik der Suchinfrastruktur, kein Fachvertrag nach außen. Ihre Meldung trägt den
// Control-State im Klartext (`UNINITIALIZED`, `V2_BUILDING`, `V2_READY`, `FAILED`); genau das
// benennt §4 der Entscheidung als No-Go. Sie werden deshalb auf die bestehende generische interne
// Antwort abgebildet, statt über `/^[A-Z_]+$/` samt Zustandsmeldung hinauszugehen.
//
// Als String-LITERAL und nicht als Import aus `knowledge-object`: `http.ts` hat heute nur Kanten zu
// `auth` und `rbac`; eine Fehlerabbildung ist kein Grund, eine neue Modulkante zu ziehen, die
// `npm run arch` bewerten müsste. Als MENGE und nicht als `code === …`, damit eine spätere zweite
// Maskierung eine Zeile ist und keine Umstrukturierung. Ausdrücklich KEIN Regex-, Präfix- oder
// Großbuchstabenmuster — eine Musterfreigabe wäre die Rückseite genau des Lecks, das hier
// geschlossen wird.
const INTERNAL_ONLY_CODES: ReadonlySet<string> = new Set(["SEARCH_PROJECTION_NOT_READY"]);

// Die EINE generische interne Antwort. Maskierungszweig und Auffangzweig senden bytegleich dieselbe
// Gestalt — zwei getrennte Literale könnten auseinanderlaufen und den maskierten Fall von außen
// wieder unterscheidbar machen. Ein Orakel „dieser Fehler ist der Projektionsfehler" wäre nur eine
// leisere Form desselben Lecks. Der Meldungstext selbst bleibt unverändert (§1: „bestehende
// generische interne Fehlermeldung").
const INTERNAL_ERROR_STATUS = 500;
const INTERNAL_ERROR_BODY = { error: "INTERNAL", message: "Unerwarteter Fehler." } as const;

/**
 * G27 R1 (KW-ARCH-G27-HTTP-MASKIERUNG-07): wahr genau dann, wenn `error` einen rein internen
 * Betriebsfehlercode trägt, der nach außen generisch maskiert werden muss.
 *
 * Exportiert als der gemeinsame Prädikatbaustein: der globale Fastify-Fehlerbehandler in
 * `build-app.ts` erreicht `sendError` nicht (die Suchrouten fangen nicht ab und laufen über
 * Fastifys Standardweg), muss aber denselben Vertrag erfüllen. Er prüft deshalb dieses Prädikat,
 * statt die Codekenntnis zu duplizieren — es gibt genau eine Wahrheit darüber, was intern bleibt.
 */
export function isInternalOnlyError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }
  return INTERNAL_ONLY_CODES.has(String((error as { code: unknown }).code));
}

export function sendError(reply: FastifyReply, error: unknown): void {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code: unknown }).code);
    // Diese Prüfung MUSS vor dem Regex-Test stehen: `SEARCH_PROJECTION_NOT_READY` erfüllt
    // `/^[A-Z_]+$/` und ginge dort über `?? 400` mit Code UND Zustandsmeldung nach außen. Hinter
    // der Regex wäre der Zweig tot — das ist die einzige Stelle, an der die Maskierung lautlos
    // wirkungslos werden kann.
    //
    // Intern bleibt der Vorfall vollständig: `reply.log` ist der request-gebundene Logger, die
    // Zeile trägt damit dieselbe Request-ID wie die 500er-Antwort und ist in Traces demselben
    // Vorgang zuordenbar. Der technische Code steht als EIGENES Feld (nicht in einen Satz
    // einformuliert), damit Monitoring darauf filtern kann; `err` reicht Originalmeldung und Stack
    // an den Serializer. Nach der Maskierung ist diese Zeile die einzige Diagnosequelle — sie darf
    // nicht wegoptimiert werden.
    if (isInternalOnlyError(error)) {
      reply.log.error(
        { err: error, code },
        "Interner Betriebsfehler maskiert (HTTP 500 INTERNAL).",
      );
      reply.code(INTERNAL_ERROR_STATUS).send(INTERNAL_ERROR_BODY);
      return;
    }
    // SCRUM-496: NUR Domänen-Fehlercodes (KoError/LibraryError/… — GROSSBUCHSTABEN_MIT_UNTERSTRICH,
    // keine Ziffern) tragen ihre nutzerlesbare Meldung nach außen. Infrastruktur-Fehler — insbesondere
    // Postgres-SQLSTATE (z. B. "42P01" relation-not-exists, "42601" syntax-error, enthalten Ziffern) —
    // dürfen ihre ROHE Meldung NIE lecken. Sonst zeigte das Board eine nackte DB-Fehlermeldung.
    if (/^[A-Z_]+$/.test(code)) {
      const message = "message" in error ? String((error as { message: unknown }).message) : code;
      reply.code(STATUS_BY_CODE[code] ?? 400).send({ error: code, message });
      return;
    }
  }
  reply.code(INTERNAL_ERROR_STATUS).send(INTERNAL_ERROR_BODY);
}

export function makeGuards(auth: AuthService): Guards {
  const requireUser = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<SessionUser | undefined> => {
    const token = tokenFromRequest(request);
    const user = token ? await auth.authenticate(token) : undefined;
    if (!user) {
      reply.code(401).send({ error: "UNAUTHENTICATED", message: "Nicht angemeldet." });
      return undefined;
    }
    return { id: user.id, role: user.role };
  };

  const requirePermission = async (
    permission: Permission,
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<SessionUser | undefined> => {
    const user = await requireUser(request, reply);
    if (!user) {
      return undefined;
    }
    if (!can(user.role, permission)) {
      reply.code(403).send({ error: "FORBIDDEN", message: `Recht fehlt: ${permission}` });
      return undefined;
    }
    return user;
  };

  return { requireUser, requirePermission };
}
