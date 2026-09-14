// ================================================================================================
// JOB 4015 · LIEFERUNG 2 — DIE ABNAHMETABELLE: WAS JEDE ROLLE AN JEDER TÜR DARF.
// ================================================================================================
//
// DIE FRAGE, DIE HIER AN EINER STELLE BEANTWORTET STEHT, IST PEDIS: „Darf ein Gast das?" — für
// JEDE Routengruppe, die `build-app.ts` registriert, und für jede der vier Rollen plus den
// Unangemeldeten. Bis zu diesem Auftrag gab es die Antwort nur über das Tor („`requirePermission`
// sperrt"), nie über die Türen („diese Tür hängt am Tor").
//
// ================================================================================================
// DIE ERWARTUNGEN SIND GESCHRIEBEN, NICHT GERECHNET.
// ================================================================================================
//
// Keine Zeile dieser Datei liest `ROLE_PERMISSIONS`. Das ist der ganze Punkt: eine aus der Matrix
// ABGELEITETE Erwartung wäre gegen einen Fehler IN der Matrix blind — sie ginge genau dann mit, wenn
// sie widersprechen müsste. Die fünf Muster unten (`OEFFENTLICH`, `ANGEMELDET`, `NUR_LESEN`,
// `AB_EXPERTE`, `AB_CONTROLLER`, `NUR_ADMIN`) sind von Hand aufgeschrieben, aus dem Rollenmodell des
// Pflichtenhefts, und jede Zeile wählt ihr Muster nach dem Recht, das die Route fordert.
//
// ================================================================================================
// WAS „ERLAUBT" HIER BEDEUTET — UND WAS NICHT.
// ================================================================================================
//
// `erlaubt` heisst: DAS RECHTETOR HAT DURCHGELASSEN. Was der Handler danach antwortet (200, 400 mit
// unvollständigem Rumpf, 404 auf eine erfundene Kennung, 503 ohne konfigurierten Adapter), ist für
// diese Abnahme dasselbe Ergebnis — sie misst die Tür, nicht den Raum dahinter. Deshalb sind die
// Nutzlasten unten bewusst dünn: ein vollständiger Fachvorgang je Route wäre ein anderer Auftrag und
// würde die Aussage über die Tür nicht schärfer machen.
//
// AUSDRÜCKLICH NICHT „erlaubt" sind **429** und **500**. Ein 500 ist der Absturz, den Lieferung 6
// dieses Auftrags aus dem Rechtetor entfernt — er darf hier nie als „durchgelassen" durchgehen,
// sonst verstecke ich genau den Fehler, gegen den ich baue.
//
// ================================================================================================
// SOLL, IST UND DER BEFUND.
// ================================================================================================
//
// `soll` ist, was das Rollenmodell verlangt. Weicht die GEMESSENE Wirklichkeit davon ab, steht sie
// als `ist` daneben — mit ausgeschriebenem Grund und der Belegstelle. Sie wird NICHT ins `soll`
// hineingeschrieben: dann wäre die Abweichung verschwunden, und die Tabelle behauptete, alles sei
// in Ordnung. Der Wächter erzwingt den Grund; die Rückgabe dieses Jobs führt jede `ist`-Zeile
// einzeln auf. `nicht-geprueft` ist ebenfalls erlaubt und ebenfalls begründungspflichtig.
import type { Akteur } from "./buehne";

export type Erwartung = "erlaubt" | "401" | "403" | "429" | "500" | "nicht-geprueft";

export interface Eintrag {
  /** Was das Rollenmodell verlangt. */
  soll: Erwartung;
  /** Nur gesetzt, wenn die Messung abweicht — der BEFUND. Verlangt `grund`. */
  ist?: Erwartung;
  /** Pflicht bei `ist` und bei `soll: "nicht-geprueft"`; bei anonymem `erlaubt` ebenfalls. */
  grund?: string;
}

export type Erwartungen = Record<Akteur, Erwartung | Eintrag>;

export interface Zeile {
  /**
   * Der Registrar aus `build-app.ts` — der Name, unter dem die Erhebung diese Gruppe führt. Für die
   * vier Routen, die `buildApp` selbst anlegt, steht hier `DIREKT`.
   */
  gruppe: string;
  methode: "GET" | "POST" | "PUT" | "DELETE";
  pfad: string;
  /** Wo die Route steht: Datei und Zeile, zum Nachschlagen ohne Suche. */
  belegstelle: string;
  /** Das Recht, das die Route fordert — oder wie sie sonst schützt. */
  tor: string;
  payload?: Record<string, unknown>;
  erwartet: Erwartungen;
  /**
   * Der Fehlerschlüssel im Feld `error`, den eine Sperre an DIESER Tür trägt — abweichend von den
   * Vorgaben `CODE_401`/`CODE_403`.
   *
   * WARUM DAS NICHT OPTIONAL IST, SONDERN MITGEMESSEN WIRD (Codex-Lehre aus JOB 3953 R1,
   * `LEHREN.md`: „bei geführtem Fehlerschlüssel das JSON-Feld `error` exakt vergleichen"): eine 403
   * belegt für sich genommen NICHT, dass das Rechtetor entschieden hat. `STATUS_BY_CODE`
   * (`http.ts:43-70`) bildet auch `NOT_APPROVED` und `DOWNGRADE_FORBIDDEN` auf 403 ab, und jede
   * Route darf ihren eigenen 403 senden. Ohne den Schlüsselvergleich hiesse „403" nur „irgendwer hat
   * nein gesagt" — die Abnahme soll aber belegen, dass DAS TOR nein gesagt hat.
   */
  codes?: Partial<Record<"401" | "403", string>>;
}

/** Was `requireUser` sendet, wenn keine gültige Sitzung mitkommt (`http.ts:177-180`). */
export const CODE_401 = "UNAUTHENTICATED";
/** Was `requirePermission` sendet, wenn das Recht fehlt (`http.ts:203-206`). */
export const CODE_403 = "FORBIDDEN";

/** Der Fehlerschlüssel, den diese Zeile für dieses Ergebnis erwartet — oder `undefined`. */
export function erwarteterCode(zeile: Zeile, ergebnis: Erwartung): string | undefined {
  if (ergebnis === "401") {
    return zeile.codes?.["401"] ?? CODE_401;
  }
  if (ergebnis === "403") {
    return zeile.codes?.["403"] ?? CODE_403;
  }
  return undefined;
}

/** Der Platzhalter für die Routen, die `buildApp` unmittelbar selbst anlegt. */
export const DIREKT = "DIREKT";

export function eintrag(wert: Erwartung | Eintrag): Eintrag {
  return typeof wert === "string" ? { soll: wert } : wert;
}

/** Was gemessen wurde, in der Sprache der Tabelle. */
export function gemessen(status: number): Erwartung {
  if (status === 401) {
    return "401";
  }
  if (status === 403) {
    return "403";
  }
  if (status === 429) {
    return "429";
  }
  if (status === 500) {
    return "500";
  }
  return "erlaubt";
}

// ------------------------------------------------------------------------------------------------
// DIE MUSTER — von Hand aus dem Rollenmodell geschrieben, nicht aus `ROLE_PERMISSIONS` gerechnet.
// ------------------------------------------------------------------------------------------------

/** `requireUser`: jede Anmeldung genügt, keine Anmeldung nicht. */
const ANGEMELDET: Erwartungen = {
  anonym: "401",
  viewer: "erlaubt",
  experte: "erlaubt",
  controller: "erlaubt",
  admin: "erlaubt",
};

/** `ko.read` — das Recht, das alle vier Rollen tragen. */
const NUR_LESEN: Erwartungen = {
  anonym: "401",
  viewer: "erlaubt",
  experte: "erlaubt",
  controller: "erlaubt",
  admin: "erlaubt",
};

/** `ko.create` — der Gast (viewer) darf lesen, nicht anlegen. Das ist Pedis „begrenzte Rechte". */
const AB_EXPERTE: Erwartungen = {
  anonym: "401",
  viewer: "403",
  experte: "erlaubt",
  controller: "erlaubt",
  admin: "erlaubt",
};

/** `ko.validate`, `ko.assign`, `conflict.resolve` — Prüf- und Zuweisungsrechte. */
const AB_CONTROLLER: Erwartungen = {
  anonym: "401",
  viewer: "403",
  experte: "403",
  controller: "erlaubt",
  admin: "erlaubt",
};

/** `users.manage` — allein der Admin. */
const NUR_ADMIN: Erwartungen = {
  anonym: "401",
  viewer: "403",
  experte: "403",
  controller: "403",
  admin: "erlaubt",
};

/**
 * Eine Tür ohne Tor. Sie ist erlaubt — aber nur mit ausgeschriebenem Grund: eine öffentliche Route
 * ist genau das, was eine Abnahme benennen muss, statt sie unter „grün" zu verbuchen.
 */
function OEFFENTLICH(grund: string): Erwartungen {
  return {
    anonym: { soll: "erlaubt", grund },
    viewer: "erlaubt",
    experte: "erlaubt",
    controller: "erlaubt",
    admin: "erlaubt",
  };
}

// ------------------------------------------------------------------------------------------------
// DIE TABELLE. Eine Zeile je geprüftem Endpunkt; jede Routengruppe der Erhebung kommt vor.
// ------------------------------------------------------------------------------------------------

export const TABELLE: Zeile[] = [
  {
    gruppe: "addinStaticRoutes",
    methode: "GET",
    pfad: "/addin",
    belegstelle: "services/app/src/routes/addin-static-routes.ts:197",
    tor: "keines — statischer Namensraum des Klara-Add-ins",
    erwartet: OEFFENTLICH(
      "Das Add-in-Bündel ist bewusst ohne Schlüssel lesbar (`build-app.ts:1922-1924`): Word lädt es, bevor irgendjemand angemeldet ist. Gemessen wird hier die statische 404-Antwort — im Prüfaufbau liegt kein gebautes Bündel; belegt ist damit, dass an dieser Tür weder 401 noch 403 steht.",
    ),
  },
  {
    gruppe: "adminRoutes",
    methode: "GET",
    pfad: "/api/admin/factory-reset",
    belegstelle: "services/app/src/routes/admin-routes.ts:280",
    tor: "users.manage",
    erwartet: NUR_ADMIN,
  },
  {
    gruppe: "aiCheckCoverageRoutes",
    methode: "GET",
    pfad: "/api/ai-check/coverage-summary",
    belegstelle: "services/app/src/routes/ai-check-coverage-routes.ts:27",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "askRoutes",
    methode: "GET",
    pfad: "/api/gaps",
    belegstelle: "services/app/src/routes/ask-routes.ts:484",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "auditRoutes",
    methode: "GET",
    pfad: "/api/audit",
    belegstelle: "services/app/src/routes/audit-routes.ts:8",
    tor: "ko.validate",
    erwartet: AB_CONTROLLER,
  },
  {
    gruppe: "authRoutes",
    methode: "GET",
    pfad: "/api/users",
    belegstelle: "services/auth/src/routes.ts:623",
    tor: "requireAdmin (eigener Guard des auth-Moduls, `routes.ts:211-226`)",
    erwartet: NUR_ADMIN,
    // ============================================================================================
    // DER BEFUND DIESER ZEILE: DAS auth-MODUL HAT SEIN EIGENES TOR, UND ES NENNT SICH ANDERS.
    // ============================================================================================
    //
    // `authRoutes` läuft NICHT über `makeGuards`. Es baut in `routes.ts:194-226` ein eigenes
    // `requireUser`/`requireAdmin` — und dessen 401 trägt den Schlüssel `INVALID_CREDENTIALS`
    // (`routes.ts:201-204`), nicht `UNAUTHENTICATED` wie das zentrale Tor (`http.ts:177-180`).
    // Derselbe Zustand („nicht angemeldet") heisst am Draht also je nach Tür anders.
    //
    // ES IST KEIN LOCH: die Sperre greift, und `requireAdmin` vergleicht `user.role !== "admin"`
    // unmittelbar, kommt also gar nicht erst an der Rechtematrix vorbei — ein unbekannter
    // Rollenname sperrt dort schon immer. Es ist eine UNEINHEITLICHKEIT am Vertrag nach aussen, und
    // sie steht hier als gemessener Wert statt als Prosa: verschwindet sie eines Tages (weil
    // `authRoutes` an das zentrale Tor kommt), wird DIESE Zeile rot und muss nachgeführt werden.
    // Der Umbau selbst liegt ausserhalb der Zielpfade (`services/auth/src/routes.ts`, JOB 4011).
    codes: { "401": "INVALID_CREDENTIALS" },
  },
  {
    gruppe: "brandingRoutes",
    methode: "GET",
    pfad: "/api/branding",
    belegstelle: "services/app/src/routes/branding-routes.ts:49",
    tor: "keines — die Marke der Instanz",
    erwartet: OEFFENTLICH(
      "Die Anmeldemaske selbst ist gefärbt; eine Markenauskunft hinter der Anmeldung käme zu spät (`build-app.ts:2608-2611`). Sie gibt Profilname und Aktivzustand preis, keine Bestands- oder Personendaten.",
    ),
  },
  {
    gruppe: "brandingRoutes",
    methode: "PUT",
    pfad: "/api/admin/branding",
    belegstelle: "services/app/src/routes/branding-routes.ts:53",
    tor: "users.manage",
    payload: {},
    erwartet: NUR_ADMIN,
  },
  {
    gruppe: "captureRoutes",
    methode: "GET",
    pfad: "/api/drafts",
    belegstelle: "services/app/src/routes/capture-routes.ts:861",
    tor: "ko.create",
    erwartet: AB_EXPERTE,
  },
  {
    gruppe: "categoryRoutes",
    methode: "GET",
    pfad: "/api/categories",
    belegstelle: "services/app/src/routes/category-routes.ts:12",
    tor: "requireUser",
    erwartet: ANGEMELDET,
  },
  {
    gruppe: "checkTextRoutes",
    methode: "POST",
    pfad: "/api/check-text",
    belegstelle: "services/app/src/routes/check-text-routes.ts:537",
    tor: "ko.read (in `preValidation`, also VOR der Rumpfprüfung)",
    payload: { text: "Ein Satz zur Abnahme des Rechtetors." },
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "conflictRoutes",
    methode: "GET",
    pfad: "/api/conflicts",
    belegstelle: "services/app/src/routes/conflicts-routes.ts:222",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "conflictRoutes",
    methode: "POST",
    pfad: "/api/conflicts/gibt-es-nicht/escalate",
    belegstelle: "services/app/src/routes/conflicts-routes.ts:260",
    tor: "conflict.resolve",
    payload: {},
    erwartet: AB_CONTROLLER,
  },
  {
    gruppe: "confluenceImportRoutes",
    methode: "POST",
    pfad: "/api/admin/import/confluence/explore",
    belegstelle: "services/app/src/routes/confluence-import-routes.ts:774",
    tor: "users.manage",
    payload: {},
    erwartet: NUR_ADMIN,
  },
  {
    gruppe: "externalRoutes",
    methode: "GET",
    pfad: "/api/external/policy",
    belegstelle: "services/app/src/routes/external-routes.ts:27",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "featuresRoutes",
    methode: "GET",
    pfad: "/api/features",
    belegstelle: "services/app/src/routes/features-routes.ts:59",
    tor: "requireUser — aber nur, wenn ein Token mitkommt",
    erwartet: OEFFENTLICH(
      "Ohne Token antwortet die Route bewusst mit der TEILMENGE, deren Flächen vor der Anmeldung erreichbar sind (Impressum, Datenschutz) — `features-routes.ts:40-58`. Ein ABGELAUFENER Token bleibt ein 401 und wird nicht stillschweigend herabgestuft; das ist der Unterschied zu einer offenen Route.",
    ),
  },
  {
    gruppe: "helpRoutes",
    methode: "POST",
    pfad: "/api/help/explain",
    belegstelle: "services/app/src/routes/help-routes.ts:78",
    tor: "ko.read",
    payload: {},
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "i18nRoutes",
    methode: "GET",
    pfad: "/api/i18n/locales",
    belegstelle: "services/app/src/routes/i18n-routes.ts:7",
    tor: "keines — Oberflächentexte",
    erwartet: OEFFENTLICH(
      "Die Anmeldemaske braucht ihre eigenen Texte, bevor es eine Sitzung gibt (`i18n-routes.ts:4`). Ausgeliefert werden Sprachkennungen und Oberflächentexte, keine Bestandsdaten.",
    ),
  },
  {
    gruppe: "impactRoutes",
    methode: "GET",
    pfad: "/api/me/impact",
    belegstelle: "services/app/src/routes/impact-routes.ts:15",
    tor: "requireUser",
    erwartet: ANGEMELDET,
  },
  {
    gruppe: "importAccessRoutes",
    methode: "GET",
    pfad: "/api/import/confluence/zugang",
    belegstelle: "services/app/src/routes/import-access-routes.ts:69",
    tor: "users.manage",
    erwartet: NUR_ADMIN,
  },
  {
    gruppe: "importRunRoutes",
    methode: "GET",
    pfad: "/api/admin/import/runs/gibt-es-nicht",
    belegstelle: "services/app/src/routes/import-run-routes.ts:117",
    tor: "users.manage",
    erwartet: NUR_ADMIN,
  },
  {
    gruppe: "klaraAiRoutes",
    methode: "GET",
    pfad: "/api/klara/ai-status",
    belegstelle: "services/app/src/routes/klara-ai-routes.ts:86",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "klaraAnswerExplanationRoutes",
    methode: "GET",
    pfad: "/api/klara/answers/gibt-es-nicht/explanation",
    belegstelle: "services/app/src/routes/klara-answer-explanation-routes.ts:87",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "klaraZurufRoutes",
    methode: "POST",
    pfad: "/api/klara/sessions/gibt-es-nicht/zuruf",
    belegstelle: "services/app/src/routes/klara-session-routes.ts:208",
    tor: "ko.read",
    payload: {},
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "knowledgeCheckRoutes",
    methode: "POST",
    pfad: "/api/knowledge/check",
    belegstelle: "services/app/src/routes/knowledge-check-routes.ts:113",
    tor: "ko.read",
    payload: { text: "Ein Satz zur Abnahme des Rechtetors." },
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "koRoutes",
    methode: "GET",
    pfad: "/api/kos",
    belegstelle: "services/app/src/routes/ko-routes.ts:821",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "koRoutes",
    methode: "GET",
    pfad: "/api/kos/trash",
    belegstelle: "services/app/src/routes/ko-routes.ts:1717",
    tor: "users.manage",
    erwartet: NUR_ADMIN,
  },
  {
    gruppe: "lesevariantenRoutes",
    methode: "GET",
    pfad: "/api/lesevarianten",
    belegstelle: "services/app/src/routes/lesevarianten-routes.ts:93",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "libraryRoutes",
    methode: "GET",
    pfad: "/api/analytics/expertise",
    belegstelle: "services/app/src/routes/library-routes.ts:904",
    tor: "ko.assign",
    erwartet: AB_CONTROLLER,
  },
  {
    gruppe: "lifecycleRoutes",
    methode: "GET",
    pfad: "/api/lifecycle/pending",
    belegstelle: "services/app/src/routes/lifecycle-routes.ts:98",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "livewallRoutes",
    methode: "GET",
    pfad: "/api/livewall",
    belegstelle: "services/app/src/routes/livewall-routes.ts:17",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "managementRoutes",
    methode: "GET",
    pfad: "/api/management/snapshot",
    belegstelle: "services/app/src/routes/management-routes.ts:12",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "mediaRoutes",
    methode: "GET",
    pfad: "/api/media/status",
    belegstelle: "services/app/src/routes/media-routes.ts:41",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "modelRunRoutes",
    methode: "GET",
    pfad: "/api/model-runs",
    belegstelle: "services/app/src/routes/model-runs-routes.ts:34",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "notificationsRoutes",
    methode: "GET",
    pfad: "/api/notifications",
    belegstelle: "services/app/src/routes/notifications-routes.ts:116",
    tor: "requireUser",
    erwartet: ANGEMELDET,
  },
  {
    gruppe: "objectRoutes",
    methode: "GET",
    pfad: "/api/objects/gibt-es-nicht",
    belegstelle: "services/app/src/routes/object-routes.ts:284",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "outputRoutes",
    methode: "GET",
    pfad: "/api/output/sources",
    belegstelle: "services/app/src/routes/output-routes.ts:9",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "overlapRoutes",
    methode: "GET",
    pfad: "/api/duplicates",
    belegstelle: "services/app/src/routes/overlap-routes.ts:42",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "overlapRoutes",
    methode: "PUT",
    pfad: "/api/duplicates/settings",
    belegstelle: "services/app/src/routes/overlap-routes.ts:89",
    tor: "users.manage",
    payload: {},
    erwartet: NUR_ADMIN,
  },
  {
    gruppe: "provenanceRoutes",
    methode: "GET",
    pfad: "/api/kos/gibt-es-nicht/provenance",
    belegstelle: "services/app/src/routes/provenance-routes.ts:89",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "reasonerRoutes",
    methode: "GET",
    pfad: "/api/reasoner/config",
    belegstelle: "services/app/src/routes/reasoner-routes.ts:728",
    tor: "users.manage",
    erwartet: NUR_ADMIN,
  },
  {
    gruppe: "slidesRoutes",
    methode: "GET",
    pfad: "/api/capture/slides/availability",
    belegstelle: "services/app/src/routes/slides-routes.ts:285",
    tor: "ko.create",
    erwartet: AB_EXPERTE,
  },
  {
    gruppe: "validationRoutes",
    methode: "GET",
    pfad: "/api/validation/board",
    belegstelle: "services/app/src/routes/validation-routes.ts:26",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  // ----------------------------------------------------------------------------------------------
  // Die vier Routen, die `buildApp` unmittelbar selbst anlegt — ohne Gruppe darum. Ohne sie wäre die
  // Abnahme über die Gruppen vollständig und über die App trotzdem lückenhaft.
  // ----------------------------------------------------------------------------------------------
  {
    gruppe: DIREKT,
    methode: "GET",
    pfad: "/health",
    belegstelle: "services/app/src/build-app.ts:1938",
    tor: "keines — Betriebsauskunft",
    erwartet: OEFFENTLICH(
      "Der Container-Healthcheck (`Dockerfile:42-43`) fragt sie, bevor es eine Sitzung geben kann. Sie nennt Zustand, Version und Deploy-Commit — Betriebsdaten, keine Bestandsdaten (`build-app.ts:1928-1937`).",
    ),
  },
  {
    gruppe: DIREKT,
    methode: "GET",
    pfad: "/api/reasoner/status",
    belegstelle: "services/app/src/build-app.ts:1957",
    tor: "keines — abstrakter KI-Status",
    erwartet: OEFFENTLICH(
      "Bewusst öffentlich und bewusst ABSTRAHIERT: kein Anbieter- und kein Modellname (`build-app.ts:1943-1953`, WP-VIP2-GATE). Die Anbietersicht liegt hinter `GET /api/reasoner/config` mit `users.manage` — diese Tabelle misst beide.",
    ),
  },
  {
    gruppe: DIREKT,
    methode: "GET",
    pfad: "/api/ai-status",
    belegstelle: "services/app/src/build-app.ts:1961",
    tor: "keines — abstrakter KI-Status",
    erwartet: OEFFENTLICH(
      "Dieselbe abstrahierte Auskunft wie `/api/reasoner/status`, nur in der Hülle `{ ai: … }` (§2.1 des Pflichtenhefts). Derselbe Grund, dieselbe Grenze.",
    ),
  },
  {
    gruppe: DIREKT,
    methode: "GET",
    pfad: "/api/analytics/impact",
    belegstelle: "services/app/src/build-app.ts:2667",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
];
