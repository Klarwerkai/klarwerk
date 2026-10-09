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
// WAS „ERLAUBT" HIER BEDEUTET — UND WAS NICHT (JOB 4061 hat diesen Abschnitt angeglichen).
// ================================================================================================
//
// `erlaubt` heisst: DIE TÜR GIBT ES, UND DAS RECHTETOR HAT DURCHGELASSEN. Was der Handler danach
// antwortet (200, 400 mit unvollständigem Rumpf, 404 auf eine erfundene Kennung, 503 ohne
// konfigurierten Adapter), ist für diese Abnahme dasselbe Ergebnis — sie misst die Tür, nicht den
// Raum dahinter. Deshalb sind die Nutzlasten unten bewusst dünn: ein vollständiger Fachvorgang je
// Route wäre ein anderer Auftrag und würde die Aussage über die Tür nicht schärfer machen.
//
// DER ERSTE HALBSATZ IST NEU, UND ER SCHLIESST DIE LÜCKE, DIE DER PRÜFER ZU JOB 4015 R2 GEFÜHRT HAT
// („`tabelle.ts:110` unterscheidet weiterhin fachliche 404 und fehlende Route nicht"). Bis hierher
// bildete `gemessen` JEDEN nicht ausdrücklich genannten Status auf `erlaubt` ab — auch den 404 einer
// Route, die es gar nicht gibt. Eine gelöschte, umbenannte oder nie registrierte Tür war damit von
// einer offenen nicht zu unterscheiden, und ausgerechnet der gefährlichere Fall sah grün aus. Der
// Unterschied ist NICHT der Status, sondern die REGISTRIERUNG: `gemessen` bekommt sie deshalb als
// zweites Argument und antwortet mit `nicht-registriert`, das zu keiner Erwartung passt. Die bewusst
// gemessene fachliche 404 (`/addin` ohne gebautes Bündel, erfundene Kennungen) bleibt `erlaubt` —
// ihre Tür ist registriert.
//
// AUSDRÜCKLICH NICHT „erlaubt" sind **429** und **500**. Ein 500 ist der Absturz, den Lieferung 6
// von JOB 4015 aus dem Rechtetor entfernt hat — er darf hier nie als „durchgelassen" durchgehen,
// sonst verstecke ich genau den Fehler, gegen den gebaut wurde.
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

/**
 * Was eine Messung ergeben kann. `nicht-registriert` ist bewusst KEINE `Erwartung`: keine Zeile darf
 * es erwarten, und jede Zeile, die es misst, wird rot.
 */
export type Messung = Erwartung | "nicht-registriert";

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
  // R-0556: PATCH für die Verzeichnispflege (SCIM ändert Konten per PatchOp).
  methode: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Die URL, die `app.inject` wirklich fährt — mit eingesetzter Kennung, wo die Route eine fordert. */
  pfad: string;
  /**
   * Das Muster, unter dem die Tür REGISTRIERT ist (`/api/kos/:id`), wenn es von `pfad` abweicht.
   *
   * Ohne diese Angabe liesse sich eine gefahrene URL nicht auf die Aufzählung aus der laufenden App
   * abbilden: `/api/kos/gibt-es-nicht` steht im Router nicht, `/api/kos/:id` schon. Beide Angaben
   * werden gegeneinander geprüft (`jede-registrierte-route-ist-abgenommen.test.ts`, E6), damit sie
   * nicht auseinanderlaufen.
   */
  route?: string;
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

/**
 * Der Fehlerschlüssel, den diese Zeile für dieses Ergebnis erwartet — oder `undefined`.
 *
 * JOB 4113: die Signatur nimmt nur noch das Feld, das sie wirklich liest (`codes`), statt eine ganze
 * `Zeile`. So können die LESENDEN Zeilen (`Zeile`) und die SCHREIBENDEN (`Schreibzeile`) dieselbe
 * eine Stelle benutzen — eine zweite Auslegung von „welcher Schlüssel gehört zu welcher Sperre"
 * wäre genau der Doppelvertrag, gegen den die Lehre aus JOB 3953 geschrieben ist.
 */
export function erwarteterCode(
  zeile: Pick<Zeile, "codes">,
  ergebnis: Erwartung,
): string | undefined {
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

/** Das registrierte Muster dieser Zeile — die eine Stelle, die `route` und `pfad` zusammenführt. */
export function registrierteRoute(zeile: Zeile): string {
  return zeile.route ?? zeile.pfad;
}

/** Die URL, die für diese Zeile wirklich gefahren wird. */
export function gefahrenerPfad(zeile: Zeile): string {
  return zeile.pfad;
}

/**
 * Was gemessen wurde, in der Sprache der Tabelle — die EINZIGE Stelle, die eine Antwort in ein
 * Abnahmeergebnis übersetzt.
 *
 * `registriert` kommt aus der Aufzählung der laufenden App (`registrierte-routen.ts`). Ist es
 * `false`, wird gar nicht erst auf den Status geschaut: eine Tür, die es nicht gibt, hat niemanden
 * durchgelassen, und ihr 404 darf nicht als `erlaubt` durchgehen (siehe Kopfabschnitt).
 */
export function gemessen(status: number, registriert: boolean): Messung {
  if (!registriert) {
    return "nicht-registriert";
  }
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
// JOB 4061 · LIEFERUNG 6 — DIE RESTLISTE: WAS DIESE ABNAHME (NOCH) NICHT MISST, UND WARUM.
// ------------------------------------------------------------------------------------------------
//
// Eine Abnahme, die ihre eigene Unvollständigkeit nicht benennt, ist keine Abnahme. Jede registrierte
// Route ohne Tabellenzeile steht hier — mit Methode, Pfad und einem eigenen, sachlichen Grund. Kein
// Sammelgrund: „ist ein Schreibweg" erklärt nichts, wenn daneben zwanzig andere Schreibwege stehen,
// die sehr wohl gemessen werden. Der Wächter erzwingt beides (E4/E5): kein Eintrag ohne Grund, und
// kein Eintrag auf eine Route, die es gar nicht gibt.

// ------------------------------------------------------------------------------------------------
// JOB 4113 · LIEFERUNG 2 — DIE RESTLISTE SAGT, WELCHE ART VON GRUND SIE FÜHRT.
// ------------------------------------------------------------------------------------------------
//
// Bis hierher stand in dieser Liste zweierlei nebeneinander, ohne dass die Maschine es
// unterscheiden konnte: eine Tür, an der eine Rollenzeile BAULICH unmöglich ist (der Anmeldeweg,
// über den die Abnahme selbst misst; ein Code, der genau einmal gilt), und eine Tür, deren Messung
// nur AUFGESCHOBEN war (sie brauchte einen frischen Bestand oder eine echte Nutzlast). `E5` prüft
// bis heute nur, dass ein Grund länger als 20 Zeichen ist — eine Prüfschuld war damit von einer
// Unmöglichkeit nicht zu unterscheiden, und die Restliste konnte still wachsen.
//
// `art` trennt beides, und zwar so, dass der Unterschied Folgen hat: `zurueckgestellt` ist eine
// SCHULD und wird von `E9` gegen eine Obergrenze gehalten; `baulich` ist ein Beweis und bleibt.
export type Nichtabnahmeart = "baulich" | "zurueckgestellt";

export interface Nichtabnahme {
  methode: string;
  /** Das registrierte Muster, so wie es die Aufzählung führt. */
  pfad: string;
  /**
   * `baulich`: an dieser Tür ist eine Rollenzeile unmöglich — zirkulär (der Anmeldeweg, mit dem
   * gemessen wird), ein Einmalcode, der sich nicht als feste Nutzlast führen lässt, eine Antwort,
   * über die gar kein Rechtetor entscheidet, oder eine serverseitig unerreichbare Tür.
   *
   * `zurueckgestellt`: eine Prüfschuld, die eingelöst werden KANN. Wer eine Tür so führt, sagt
   * damit, dass sie eines Tages gemessen wird — und `E9` hält die Gesamtzahl dieser Zusagen fest.
   */
  art: Nichtabnahmeart;
  grund: string;
}

export const NICHT_ABGENOMMEN: Nichtabnahme[] = [
  // --- Eine Route, die keine Routengruppe angelegt hat -------------------------------------------
  {
    methode: "OPTIONS",
    pfad: "/*",
    art: "baulich",
    grund:
      "Der CORS-Vorflug von `@fastify/cors` (`build-app.ts:1904-1921`), nicht von einer Routengruppe angelegt. Was er antwortet, entscheidet die Ursprungsregel des Add-in-Pfads, nicht das Rechtetor — eine Rollenmessung daran sagte über Rechte nichts. Er ist zugleich der Beleg, dass `cors` ENTGEGEN dem Vermerk in `routengruppen.ts` sehr wohl eine Route registriert; die eigene Abnahme des Ursprungsvertrags ist ein eigener Auftrag.",
  },

  // --- Anmeldung, Konto, Nutzerverwaltung (authRoutes) -------------------------------------------
  {
    methode: "POST",
    pfad: "/api/auth/register",
    art: "zurueckgestellt",
    grund:
      "Legt ein Konto an. JOB 4113 hat die eine Hälfte dieses Grundes eingelöst — an einer frischen Bühne verändert die Anlage keinen Bestand mehr, gegen den andere Zeilen messen. Was bleibt, ist die SCHALTERLAGE: `routes.ts:351` prüft `selfRegistrationEnabled()` VOR allem anderen und antwortet bei ausgeschaltetem Schalter allen fünf Akteuren gleich mit 403 `REGISTRATION_DISABLED` — ein 403, der nicht aus dem Rechtetor kommt. Die Bühne dieses Auftrags setzt den Schalter bewusst nicht (sie setzt vier Schalter über der ANWESENHEIT von Routen, keinen über dem Verhalten einer einzelnen); ihn hier zu setzen wäre eine fünfte Schalterlage, die alle anderen Zeilen mitträfen.",
  },
  {
    methode: "POST",
    pfad: "/api/auth/login",
    art: "baulich",
    grund:
      "Erzeugt die Sitzung, mit der diese Abnahme überhaupt misst (`buehne.ts:94-108`). Eine Rollenzeile darüber wäre zirkulär; die Route ist durch den Aufbau der Bühne bereits jede Runde gefahren.",
  },
  {
    methode: "POST",
    pfad: "/api/auth/forgot",
    art: "zurueckgestellt",
    grund:
      "Fordert eine Zurücksetzung an und antwortet absichtlich immer gleich (keine Kontoerkennung). Die Aussage dieser Route ist die Gleichförmigkeit, nicht die Rolle — ein eigener Prüfgegenstand.",
  },
  {
    methode: "POST",
    pfad: "/api/auth/reset",
    art: "zurueckgestellt",
    grund:
      "Setzt ein Passwort per Einmal-Token. Ohne echtes Token misst sie nur die Tokenprüfung; ein echtes Token herzustellen ist ein Fachvorgang.",
  },
  {
    methode: "POST",
    pfad: "/api/auth/oidc",
    art: "zurueckgestellt",
    grund:
      "Der SSO-Rückweg. Er prüft state, nonce und PKCE gegen kurzlebige Cookies aus `GET /api/auth/oidc/start`; ohne diesen Ablauf misst er keine Rechte, sondern die Ablaufprüfung.",
  },
  {
    methode: "POST",
    pfad: "/api/auth/setup",
    art: "baulich",
    grund:
      "Die Ersteinrichtung des ersten Admins. Sie ist serverseitig durch `needsSetup()` abgeriegelt und an einer Bühne, die bereits vier Konten trägt, gar nicht mehr erreichbar.",
  },
  {
    methode: "POST",
    pfad: "/api/auth/office-handover/redeem",
    art: "baulich",
    grund:
      "Löst den EINMALIGEN Übergabecode aus dem Word-Anmeldedialog ein (JOB 4076) und ist bewusst öffentlich: der Aufruf kommt aus einem Rahmen fremder Herkunft und kann kein Sitzungscookie mitbringen — der Code IST der Nachweis, nicht die Rolle. Eine Rollenzeile ist hier baulich unmöglich, und zwar in beiden Richtungen: ohne gültigen Code antwortet die Route ALLEN fünf Akteuren gleich mit 401, und dieser 401 kommt aus der Codeprüfung, nicht aus einem Rechtetor — er als `erlaubt` oder als Sperre zu führen wäre in beiden Fällen eine Unwahrheit über den Grund; ein GÜLTIGER Code lässt sich nicht als feste Nutzlast (`payload`) führen, weil er genau einmal gilt und die fünf Messungen ihn nacheinander verbrauchen würden. Abgenommen ist diese Tür deshalb am echten Fastify-Draht in `tests/office-web-anmeldung/uebergabe-vertrag.test.ts` (Ausgabe nur mit Sitzung, Einlösen genau einmal, Frist 120 s, Bindung an die erzeugende Sitzung), in `uebergabe-ohne-cookie.test.ts` (der Schlüssel öffnet `GET /api/auth/me` OHNE jedes Cookie) und in `uebergabe-keine-auskunft.test.ts` (unbekannt, abgelaufen und verbraucht sind von aussen nicht unterscheidbar). Der öffentliche Leckweg steht zusätzlich in `tests/demo-zugang-gaeste/kein-offener-zugang.test.ts` (D2f) mit abgelesenem Vertragsrumpf und gemessenem Kontaktstatus.",
  },
  // JOB 4141: die vier Konten-Türen (`DELETE /api/auth/users/:id`, `POST /api/users`,
  // `PUT /api/users/:id`, `DELETE /api/users/:id`) standen hier mit vier eigenen Gründen, die alle
  // dasselbe sagten: die Nutzlast wäre eine Kennung aus der Bühne, und der Aufruf verstellte oder
  // entfernte genau das Konto, mit dem gemessen wird. Sie sind seit diesem Auftrag GEMESSEN
  // (`schreibende-tueren.ts`) — an einer je Messung frischen Bühne und an einem eigens dafür
  // angelegten Zielkonto, das keine Messung als Akteur benutzt. Ihre Gründe leben nicht als
  // Kommentar weiter; was von ihnen bleibt, steht in der Vorbereitung der Zeilen selbst.

  // --- Wissensobjekte (koRoutes) -----------------------------------------------------------------
  {
    methode: "POST",
    pfad: "/api/kos/from-document",
    art: "zurueckgestellt",
    grund:
      "Erstanlage AUS einem Dokument — Inhalt, Anker und Belegstellen in einem Vorgang. Die Nutzlast ist ein vollständiges Dokumentmodell samt eines zuvor über `POST /api/objects` hochgeladenen Ankerdokuments; JOB 4113 hat den einfachen Anlageweg (`POST /api/kos`) gemessen und diesen bewusst nicht mitgenommen, weil `POST /api/objects` selbst zurückgestellt ist.",
  },

  // --- Entwürfe (captureRoutes) ------------------------------------------------------------------
  {
    methode: "POST",
    pfad: "/api/drafts/from-docx",
    art: "zurueckgestellt",
    grund:
      "Übernimmt eine .docx-Datei als Entwurf. Die Nutzlast ist ein echtes Dokument von bis zu 30 MiB; ohne sie misst die Zeile die Parserprüfung.",
  },

  // --- Fragen, Lücken, Prüfung (askRoutes, validationRoutes, conflictRoutes, overlapRoutes) -------
  {
    methode: "POST",
    pfad: "/api/ask",
    art: "zurueckgestellt",
    grund:
      "Die Frage an den Bestand. Sie hat zwei Zweige (Sitzung und Add-on-Schlüssel) mit unterschiedlichem Rechteweg; eine Zeile könnte nur einen messen und verschwiege den anderen. (Gefahren wird sie in JOB 4113 sehr wohl — als Vorbereitung der Zeilen zu `POST /api/ask/helpful` und `PUT|DELETE /api/gaps/:id`; abgenommen ist damit nicht sie, sondern was aus ihr entsteht.)",
  },
  // JOB 4141: die sechs Urteils-Türen (`POST /api/conflicts/:id/dismiss|second-opinion`,
  // `POST /api/duplicates/:id/dismiss|keep-separate|link-related|status`) standen hier mit derselben
  // Voraussetzung: „setzt ein echtes Paar voraus, das erst aus zwei angelegten Objekten entsteht".
  // Genau das stellt die Vorbereitung dieser Zeilen jetzt her (`schreibende-tueren.ts`) — die
  // Dubletten am echten Produktweg über die Erkennung, der Widerspruch am Dienst, weil der
  // Konfliktweg ohne Modell gar nicht erkennt und keine Route ihn von Hand anlegt. Was damit NICHT
  // gemessen ist, steht dort ausgeschrieben.

  // --- Klara-Sitzungen (klaraAiRoutes) -----------------------------------------------------------
  {
    methode: "POST",
    pfad: "/api/klara/sessions",
    art: "zurueckgestellt",
    grund:
      "Registriert die Zuordnung von Add-in-Instanz und Dokument und vergibt die opake Dokumentkennung. Alle übrigen Klara-Wege setzen genau diese Zuordnung voraus.",
  },
  {
    methode: "POST",
    pfad: "/api/klara/sessions/:sessionId/document-context",
    art: "zurueckgestellt",
    grund:
      "Hängt den Dokumentkontext um (temporär → gespeichert) und entwertet dabei eine bestehende Zustimmung. Braucht eine echte Sitzung aus dem Weg darüber.",
  },
  {
    methode: "POST",
    pfad: "/api/klara/sessions/:sessionId/consent",
    art: "zurueckgestellt",
    grund:
      "Erteilt die Zustimmung zur externen KI. Ihre Wirkung ist die Aufhebung einer Sperre, deren Zustand nur an einer echten Sitzung sichtbar wird.",
  },
  {
    methode: "DELETE",
    pfad: "/api/klara/sessions/:sessionId/consent",
    art: "zurueckgestellt",
    grund:
      "Widerruft dieselbe Zustimmung sofort. Der Prüfgegenstand ist die Sofortwirkung des Widerrufs, nicht die Rolle.",
  },
  {
    methode: "POST",
    pfad: "/api/klara/sessions/:sessionId/close",
    art: "zurueckgestellt",
    grund:
      "Schliesst die eigene Sitzung; jeder Folgeaufruf ist danach ein Konflikt. Setzt eine offene, echte Sitzung voraus.",
  },
  // R-0700: `POST /api/klara/sessions/:sessionId/execute` steht NICHT hier, sondern gemessen in
  // `TABELLE` (Gruppe `klaraAusfuehrungRoutes`): das Rechtetor (`ko.read`) entscheidet VOR der
  // Sitzungsbindung, und genau diese Tür misst die Zeile.

  // --- Bibliothek, Import, Lebenszyklus, Ausgabe -------------------------------------------------
  {
    methode: "POST",
    pfad: "/api/lifecycle/couple",
    art: "zurueckgestellt",
    grund:
      "Koppelt ein Wissensobjekt an ein Betriebsmittel. Braucht beide Kennungen echt, sonst misst die Zeile die Existenzprüfung.",
  },
  {
    methode: "POST",
    pfad: "/api/lifecycle/asset-changed",
    art: "zurueckgestellt",
    grund:
      "Meldet die Änderung eines Betriebsmittels und stösst die Neuprüfung aller gekoppelten Objekte an — ein Vorgang mit Breitenwirkung auf den Bestand der Bühne.",
  },
  {
    methode: "POST",
    pfad: "/api/learning-paths",
    art: "zurueckgestellt",
    grund:
      "Legt einen Lernpfad mit Schritten an. Die Nutzlast ist der Pfad selbst; ohne ihn misst die Zeile die Rumpfprüfung.",
  },
  {
    methode: "POST",
    pfad: "/api/learning-paths/:pathId/complete",
    art: "zurueckgestellt",
    grund:
      "Hakt einen Schritt eines Lernpfads ab. Setzt einen angelegten Pfad und eine gültige Schrittkennung voraus.",
  },
  {
    methode: "POST",
    pfad: "/api/output/generate",
    art: "zurueckgestellt",
    grund:
      "Erzeugt ein Ausgabedokument aus ausgewählten Quellen. Die Nutzlast ist die Quellenauswahl; der Vorgang ist ein Erzeugungslauf, kein Türtest.",
  },
  {
    methode: "POST",
    pfad: "/api/capture/slides",
    art: "zurueckgestellt",
    grund:
      "Wandelt eine hochgeladene PPTX-Datei um. Die Nutzlast ist eine echte Präsentationsdatei; der Auth-Riegel läuft vor dem Rumpfparsen und ist eine eigene Prüffläche.",
  },
  {
    methode: "POST",
    pfad: "/api/objects",
    art: "zurueckgestellt",
    grund:
      "Legt einen Anhang an. Die anonyme Parserfläche dieser Route hat eine eigene Abnahme (`tests/security/objects-auth-vor-parsing.test.ts`), die mehr misst als eine Rollenzeile.",
  },
  {
    methode: "POST",
    pfad: "/api/media/analyze",
    art: "zurueckgestellt",
    grund:
      "Lässt einen vorhandenen Anhang durch die Medienanalyse laufen. Braucht einen echten Anhang, sonst ist die Antwort eine Existenzauskunft.",
  },
  {
    methode: "POST",
    pfad: "/api/notifications/seen",
    art: "zurueckgestellt",
    grund:
      "Markiert den eigenen Meldungsstand als gelesen. Der Vorgang schreibt an der Sicht des Prüfkontos, gegen das die nächste Zeile misst.",
  },

  // --- KI-Verdrahtung (reasonerRoutes) -----------------------------------------------------------
  {
    methode: "POST",
    pfad: "/api/reasoner",
    art: "zurueckgestellt",
    grund:
      "Der Text-Verteiler der KI-Unterstützung. Er ruft echte Modelle auf; eine Rollenzeile darüber löste bei jedem Lauf einen Modellaufruf aus.",
  },
  {
    methode: "POST",
    pfad: "/api/reasoner/describe",
    art: "zurueckgestellt",
    grund:
      "Erzeugt eine Bildbeschreibung. Die Nutzlast ist ein Bild mit grossem Rumpflimit, und der Vorgang ist ein Modellaufruf.",
  },
  {
    methode: "POST",
    pfad: "/api/reasoner/enrich",
    art: "zurueckgestellt",
    grund:
      "Reichert ein Objekt öffentlich an und prüft zusätzlich die Vertraulichkeitsstufe — zwei Entscheidungen in einem Vorgang.",
  },
  {
    methode: "POST",
    pfad: "/api/reasoner/test",
    art: "zurueckgestellt",
    grund:
      "Der Schlüsseltest gegen den konfigurierten Anbieter. Er ist ein echter, kostenpflichtiger Mini-Aufruf nach aussen.",
  },
  {
    methode: "POST",
    pfad: "/api/reasoner/test-local",
    art: "zurueckgestellt",
    grund:
      "Derselbe Test gegen das lokale Modell. Er braucht einen erreichbaren lokalen Dienst, den die Prüfbühne nicht stellt.",
  },
  {
    methode: "POST",
    pfad: "/api/reasoner/conflict-self-test",
    art: "zurueckgestellt",
    grund:
      "Fährt die vollständige Widerspruchserkennung als Selbsttest — ein Ablauf über den ganzen Bestand, nicht eine Tür.",
  },
  {
    methode: "POST",
    pfad: "/api/reasoner/duplicate-self-test",
    art: "zurueckgestellt",
    grund:
      "Dasselbe für die Dublettenerkennung: ein Erkennungslauf über den Bestand mit eigener Laufzeit.",
  },
  {
    methode: "PUT",
    pfad: "/api/reasoner/config",
    art: "zurueckgestellt",
    grund:
      "Setzt Anbieter, Modell und Schlüssel der Instanz. Eine Verstellung veränderte den KI-Status, den `GET /api/reasoner/status` und `GET /api/ai-status` in dieser Tabelle messen.",
  },
  {
    methode: "PUT",
    pfad: "/api/reasoner/assist-presets",
    art: "zurueckgestellt",
    grund:
      "Pflegt die Vorlagen der KI-Unterstützung. Die Nutzlast ist die vollständige Vorlagenliste; sie ersetzt den bisherigen Stand.",
  },

  // --- Betrieb und Verwaltung (adminRoutes, confluenceImportRoutes, libraryRoutes, externalRoutes)
  //
  // JOB 4270 — HIER STANDEN SECHS DEMO-TÜREN, UND SIE STEHEN JETZT IN `SCHREIB_TABELLE`.
  //
  // `POST|DELETE /api/admin/demo-seed`, `POST /api/admin/demo-packages/:id/load|reset`,
  // `DELETE /api/admin/demo-packages/:id` und `POST /api/admin/examples/load` waren mit zwei
  // Gründen zurückgestellt: „der Vorgang füllt genau den Bestand, gegen den die Lesezeilen dieser
  // Tabelle messen" und „setzt eine gültige Paketkennung voraus". Beide sind weggefallen — der
  // erste durch die frische Bühne je Messung (`schreibende-tueren.ts:14-17`), der zweite durch das
  // `ruesten`, das die Kennung aus der laufenden Instanz HOLT statt sie zu erfinden. Genau mit
  // dieser Begründung hat JOB 4141 zehn Türen von hier in die Messung geholt.
  //
  // WAS BLEIBT, BLEIBT MIT GRUND: `POST /api/admin/sim-corpus` (ausdrücklich nie automatisch zu
  // fahren) und `POST /api/admin/factory-reset` (löscht die Instanz samt der vier Prüfkonten, mit
  // denen gemessen wird). Beide sind eine Entscheidung, kein Vergessen.
  {
    methode: "POST",
    pfad: "/api/admin/sim-corpus",
    art: "zurueckgestellt",
    grund:
      "Lädt einen Simulationskorpus. Er ist ausdrücklich nie automatisch zu fahren und erzeugt eine grosse Datenmenge.",
  },
  {
    methode: "POST",
    pfad: "/api/admin/factory-reset",
    art: "zurueckgestellt",
    grund:
      "Der Werksreset. Er löscht die gesamte Instanz — an einer Bühne, die vier angemeldete Prüfkonten trägt, wäre jede folgende Zeile danach bedeutungslos.",
  },
  {
    methode: "POST",
    pfad: "/api/admin/lesevarianten/laden",
    art: "zurueckgestellt",
    grund:
      "Lädt Übersetzungen für ein Paket und liest dafür den ganzen Bestand, um Anker zuzuordnen. Ein Ladelauf, kein Türtest.",
  },
  {
    methode: "POST",
    pfad: "/api/admin/import/cleanup",
    art: "zurueckgestellt",
    grund:
      "Räumt Testdaten zweistufig auf (Vorschau, dann Bestätigung). Die zweite Stufe ist unumkehrbar und braucht den Prüfsummenwert aus der ersten.",
  },
  {
    methode: "POST",
    pfad: "/api/admin/import/confluence",
    art: "zurueckgestellt",
    grund:
      "Startet den Confluence-Import. Er spricht einen externen Dienst an, den die Prüfbühne nicht stellt.",
  },
  {
    methode: "POST",
    pfad: "/api/admin/import/confluence/select",
    art: "zurueckgestellt",
    grund:
      "Erzeugt die gefilterte Auswahlvorschau aus einem Erkundungslauf. Setzt genau dessen Ergebnis als Nutzlast voraus.",
  },
  {
    methode: "POST",
    pfad: "/api/admin/import/confluence/group",
    art: "zurueckgestellt",
    grund:
      "Gruppiert die ausgewählten Seiten mit KI-Hilfe. Braucht die Auswahl aus dem Weg darüber und einen erreichbaren Modellanbieter.",
  },
  {
    methode: "POST",
    pfad: "/api/admin/import/confluence/apply",
    art: "zurueckgestellt",
    grund:
      "Übernimmt die Gruppierung in die Prüf-Warteschlange und braucht dafür den Momentaufnahme-Schlüssel aus dem Gruppierungslauf.",
  },
  {
    methode: "PUT",
    pfad: "/api/external/policy",
    art: "zurueckgestellt",
    grund:
      "Setzt den Regler für die externe Wissensabfrage. Sein Wert entscheidet, was `GET /api/external/policy` in dieser Tabelle meldet.",
  },
];

// ------------------------------------------------------------------------------------------------
// DIE MUSTER — von Hand aus dem Rollenmodell geschrieben, nicht aus `ROLE_PERMISSIONS` gerechnet.
// ------------------------------------------------------------------------------------------------

// JOB 4113: die sechs Muster sind EXPORTIERT, seit die schreibenden Türen in einer zweiten Datei
// gemessen werden (`schreibende-tueren.ts`). Sie dort abzuschreiben hiesse, zwei Auffassungen vom
// Rollenmodell zu führen — und die zweite ist die, die eines Tages nicht nachgezogen wird.

/** `requireUser`: jede Anmeldung genügt, keine Anmeldung nicht. */
export const ANGEMELDET: Erwartungen = {
  anonym: "401",
  viewer: "erlaubt",
  experte: "erlaubt",
  controller: "erlaubt",
  admin: "erlaubt",
};

/** `ko.read` — das Recht, das alle vier Rollen tragen. */
export const NUR_LESEN: Erwartungen = {
  anonym: "401",
  viewer: "erlaubt",
  experte: "erlaubt",
  controller: "erlaubt",
  admin: "erlaubt",
};

/** `ko.create` — der Gast (viewer) darf lesen, nicht anlegen. Das ist Pedis „begrenzte Rechte". */
export const AB_EXPERTE: Erwartungen = {
  anonym: "401",
  viewer: "403",
  experte: "erlaubt",
  controller: "erlaubt",
  admin: "erlaubt",
};

/** `ko.validate`, `ko.assign`, `conflict.resolve` — Prüf- und Zuweisungsrechte. */
export const AB_CONTROLLER: Erwartungen = {
  anonym: "401",
  viewer: "403",
  experte: "403",
  controller: "erlaubt",
  admin: "erlaubt",
};

/** `users.manage` — allein der Admin. */
export const NUR_ADMIN: Erwartungen = {
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
export function OEFFENTLICH(grund: string): Erwartungen {
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
  // Aufnahme 20260922 · Paarpflichten-dauerhaft (G2): die gewählten Prüfläufe über alle Aussagepaare.
  // Gemessen wird das Tor, nicht der Fachvorgang: die leere Auswahl antwortet hinter dem Tor 400,
  // ein unbekannter Lauf 404 — beides legt nichts an und stößt nichts an.
  {
    gruppe: "paarpflichtenRoutes",
    methode: "POST",
    pfad: "/api/paarpflichten/laeufe",
    belegstelle: "services/app/src/routes/paarpflichten-routes.ts:80",
    tor: "ko.validate",
    payload: {},
    erwartet: AB_CONTROLLER,
  },
  {
    gruppe: "paarpflichtenRoutes",
    methode: "GET",
    pfad: "/api/paarpflichten/laeufe/gibt-es-nicht",
    route: "/api/paarpflichten/laeufe/:laufId",
    belegstelle: "services/app/src/routes/paarpflichten-routes.ts:117",
    tor: "ko.validate",
    erwartet: AB_CONTROLLER,
  },
  {
    gruppe: "paarpflichtenRoutes",
    methode: "POST",
    pfad: "/api/paarpflichten/laeufe/gibt-es-nicht/fortsetzen",
    route: "/api/paarpflichten/laeufe/:laufId/fortsetzen",
    belegstelle: "services/app/src/routes/paarpflichten-routes.ts:139",
    tor: "ko.validate",
    payload: {},
    erwartet: AB_CONTROLLER,
  },
  {
    gruppe: "askRoutes",
    methode: "GET",
    pfad: "/api/gaps",
    belegstelle: "services/app/src/routes/ask-routes.ts:484",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  // R-1663 / R-2178: hinter demselben Schalter wie `GET /api/analytics/expertise` (an dieser Bühne
  // gesetzt). Eine erfundene Kennung ergibt nach dem Tor die fachliche 404 — die Tür ist registriert.
  {
    gruppe: "askRoutes",
    methode: "GET",
    pfad: "/api/gaps/gibt-es-nicht/ansprechpartner",
    route: "/api/gaps/:id/ansprechpartner",
    belegstelle: "services/app/src/routes/ask-routes.ts:867",
    tor: "ko.assign",
    erwartet: AB_CONTROLLER,
  },
  {
    gruppe: "auditRoutes",
    methode: "GET",
    pfad: "/api/audit",
    belegstelle: "services/app/src/routes/audit-routes.ts:17",
    tor: "ko.validate",
    erwartet: AB_CONTROLLER,
  },
  {
    gruppe: "authRoutes",
    methode: "GET",
    pfad: "/api/users",
    belegstelle: "services/auth/src/routes.ts:831",
    tor: "requireAdmin (eigener Guard des auth-Moduls, `routes.ts:329-344`)",
    erwartet: NUR_ADMIN,
    // ============================================================================================
    // DER BEFUND DIESER ZEILE: DAS auth-MODUL HAT SEIN EIGENES TOR, UND ES NENNT SICH ANDERS.
    // ============================================================================================
    //
    // `authRoutes` läuft NICHT über `makeGuards`. Es baut in `routes.ts:312-344` ein eigenes
    // `requireUser`/`requireAdmin` — und dessen 401 trägt den Schlüssel `INVALID_CREDENTIALS`
    // (`routes.ts:319-322`), nicht `UNAUTHENTICATED` wie das zentrale Tor (`http.ts:177-180`).
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
  // WIKI-BEARBEITUNGSRESERVIERUNG · der Bearbeitungshinweis. Lesen hängt an `ko.read`, Beginnen,
  // Erneuern und Beenden an `ko.create` — dieselben Rechte wie Lesen und Bearbeiten des Eintrags;
  // kein neues Recht. Die URLs sind zustandsfrei (erfundene Kennung): hinter dem Tor endet jede
  // Tür im 404 „nicht gefunden" — das ist „durchgelassen" und legt nichts an.
  {
    gruppe: "bearbeitungRoutes",
    methode: "GET",
    pfad: "/api/kos/gibt-es-nicht/bearbeitungen",
    route: "/api/kos/:id/bearbeitungen",
    belegstelle: "services/app/src/routes/bearbeitung-routes.ts:99",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "bearbeitungRoutes",
    methode: "PUT",
    pfad: "/api/kos/gibt-es-nicht/bearbeitungen/abnahme-sitzung-1",
    route: "/api/kos/:id/bearbeitungen/:sitzung",
    belegstelle: "services/app/src/routes/bearbeitung-routes.ts:116",
    tor: "ko.create",
    erwartet: AB_EXPERTE,
  },
  {
    gruppe: "bearbeitungRoutes",
    methode: "DELETE",
    pfad: "/api/kos/gibt-es-nicht/bearbeitungen/abnahme-sitzung-1",
    route: "/api/kos/:id/bearbeitungen/:sitzung",
    belegstelle: "services/app/src/routes/bearbeitung-routes.ts:139",
    tor: "ko.create",
    erwartet: AB_EXPERTE,
  },
  // Kenntnisnahme einer gültigen Fassung. Anfordern, Übersicht und Erinnern hängen am vorhandenen
  // Zuweisungsrecht `ko.assign` (Controller/Admin), die eigenen Anforderungen und das Bestätigen
  // am Leserecht. Die URLs sind zustandsfrei (erfundene Kennung): hinter dem Tor endet jede Tür im
  // 404 bzw. 400 — das ist „durchgelassen" und legt nichts an.
  {
    gruppe: "kenntnisnahmeRoutes",
    methode: "GET",
    pfad: "/api/kos/gibt-es-nicht/kenntnisnahmen",
    route: "/api/kos/:id/kenntnisnahmen",
    belegstelle: "services/app/src/routes/kenntnisnahme-routes.ts:110",
    tor: "ko.assign",
    erwartet: AB_CONTROLLER,
  },
  {
    gruppe: "kenntnisnahmeRoutes",
    methode: "POST",
    pfad: "/api/kos/gibt-es-nicht/kenntnisnahmen",
    route: "/api/kos/:id/kenntnisnahmen",
    belegstelle: "services/app/src/routes/kenntnisnahme-routes.ts:133",
    tor: "ko.assign",
    erwartet: AB_CONTROLLER,
  },
  {
    gruppe: "kenntnisnahmeRoutes",
    methode: "POST",
    pfad: "/api/kenntnisnahmen/gibt-es-nicht/erinnern",
    route: "/api/kenntnisnahmen/:anforderungId/erinnern",
    belegstelle: "services/app/src/routes/kenntnisnahme-routes.ts:170",
    tor: "ko.assign",
    erwartet: AB_CONTROLLER,
  },
  {
    gruppe: "kenntnisnahmeRoutes",
    methode: "GET",
    pfad: "/api/kenntnisnahmen/meine",
    belegstelle: "services/app/src/routes/kenntnisnahme-routes.ts:191",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "kenntnisnahmeRoutes",
    methode: "POST",
    pfad: "/api/kenntnisnahmen/gibt-es-nicht/bestaetigen",
    route: "/api/kenntnisnahmen/:anforderungId/bestaetigen",
    belegstelle: "services/app/src/routes/kenntnisnahme-routes.ts:205",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  // produkt:20261007:veroeffentlichungsoptionen. Der Stand hängt am Leserecht, das Veröffentlichen
  // am vorhandenen Freigaberecht `ko.validate` (Controller/Admin). Zustandsfreie URLs: hinter dem
  // Tor endet der Stand im 404, das Veröffentlichen ohne Rumpf im 400 — „durchgelassen", nichts
  // wird angelegt.
  {
    gruppe: "veroeffentlichungRoutes",
    methode: "GET",
    pfad: "/api/kos/gibt-es-nicht/veroeffentlichung",
    route: "/api/kos/:id/veroeffentlichung",
    belegstelle: "services/app/src/routes/veroeffentlichung-routes.ts:79",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "veroeffentlichungRoutes",
    methode: "POST",
    pfad: "/api/kos/gibt-es-nicht/veroeffentlichung",
    route: "/api/kos/:id/veroeffentlichung",
    belegstelle: "services/app/src/routes/veroeffentlichung-routes.ts:107",
    tor: "ko.validate",
    erwartet: AB_CONTROLLER,
  },
  // R-1644 · Wissensauskunft zum Zeitpunkt. Dieselbe Einsichtsstufe wie das Audit-Protokoll
  // (`ko.validate`, Controller/Admin). Ohne Zeitpunkt endet die Tür hinter dem Tor im 400.
  {
    gruppe: "wissensauskunftRoutes",
    methode: "GET",
    pfad: "/api/kos/gibt-es-nicht/wissensauskunft",
    route: "/api/kos/:id/wissensauskunft",
    belegstelle: "services/app/src/routes/wissensauskunft-routes.ts:31",
    tor: "ko.validate",
    erwartet: AB_CONTROLLER,
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
    route: "/api/conflicts/:id/escalate",
    belegstelle: "services/app/src/routes/conflicts-routes.ts:260",
    tor: "conflict.resolve",
    payload: {},
    erwartet: AB_CONTROLLER,
  },
  // Aufnahme gesamt-konfliktklassifikation · R-0252 (Nacharbeit 5): der Einordnungsweg — dasselbe
  // Recht wie Eskalieren und Entscheiden. Die Nutzlast ist formgerecht, damit die Zeile das Tor
  // misst und nicht die Rumpfprüfung.
  {
    gruppe: "conflictRoutes",
    methode: "POST",
    pfad: "/api/conflicts/gibt-es-nicht/arbeitsart",
    route: "/api/conflicts/:id/arbeitsart",
    belegstelle: "services/app/src/routes/conflicts-routes.ts:316",
    tor: "conflict.resolve",
    payload: { arbeitsart: "regel" },
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
    belegstelle: "services/app/src/routes/i18n-routes.ts:44",
    tor: "keines — Oberflächentexte",
    erwartet: OEFFENTLICH(
      "Die Anmeldemaske braucht ihre eigenen Texte, bevor es eine Sitzung gibt (`i18n-routes.ts:4`). Ausgeliefert werden Sprachkennungen und Oberflächentexte, keine Bestandsdaten.",
    ),
  },
  // R-1034 / FR-I18N-02 · die Übersetzungspflege: ein öffentlicher Leseweg, drei Adminwege.
  {
    gruppe: "i18nRoutes",
    methode: "GET",
    pfad: "/api/i18n/de",
    route: "/api/i18n/:locale",
    belegstelle: "services/app/src/routes/i18n-routes.ts:61",
    tor: "keines — Oberflächentexte",
    erwartet: OEFFENTLICH(
      "Die im Betrieb gepflegten Texte einer Sprache: dieselben Oberflächentexte wie `/api/i18n/locales`, die die Anmeldemaske vor jeder Sitzung braucht. Keine Bestandsdaten.",
    ),
  },
  {
    gruppe: "i18nRoutes",
    methode: "PUT",
    pfad: "/api/admin/i18n/de/gibt-es-nicht",
    route: "/api/admin/i18n/:locale/:key",
    belegstelle: "services/app/src/routes/i18n-routes.ts:81",
    tor: "users.manage",
    payload: {},
    erwartet: NUR_ADMIN,
  },
  {
    gruppe: "i18nRoutes",
    methode: "DELETE",
    pfad: "/api/admin/i18n/de/gibt-es-nicht",
    route: "/api/admin/i18n/:locale/:key",
    belegstelle: "services/app/src/routes/i18n-routes.ts:121",
    tor: "users.manage",
    erwartet: NUR_ADMIN,
  },
  {
    gruppe: "i18nRoutes",
    methode: "PUT",
    pfad: "/api/admin/i18n-sprachen/fr",
    route: "/api/admin/i18n-sprachen/:locale",
    belegstelle: "services/app/src/routes/i18n-routes.ts:151",
    tor: "users.manage",
    payload: {},
    erwartet: NUR_ADMIN,
  },
  {
    gruppe: "impactRoutes",
    methode: "GET",
    pfad: "/api/me/impact",
    belegstelle: "services/app/src/routes/impact-routes.ts:15",
    tor: "requireUser",
    erwartet: ANGEMELDET,
  },
  // Betroffenenrechte (R-0661, R-0663): die EIGENEN Daten und der EIGENE Löschantrag — jede
  // angemeldete Rolle, auch der Gast. Die Nutzlasten sind so gewählt, dass nichts angelegt wird: eine
  // Begründung, die kein Text ist, endet nach dem Tor mit 400; eine erfundene Antragskennung mit 404.
  {
    gruppe: "datenschutzRoutes",
    methode: "GET",
    pfad: "/api/me/daten",
    belegstelle: "services/app/src/routes/datenschutz-routes.ts:114",
    tor: "requireUser",
    erwartet: ANGEMELDET,
  },
  {
    gruppe: "datenschutzRoutes",
    methode: "GET",
    pfad: "/api/me/loeschantrag",
    belegstelle: "services/app/src/routes/datenschutz-routes.ts:135",
    tor: "requireUser",
    erwartet: ANGEMELDET,
  },
  {
    gruppe: "datenschutzRoutes",
    methode: "POST",
    pfad: "/api/me/loeschantrag",
    belegstelle: "services/app/src/routes/datenschutz-routes.ts:148",
    tor: "requireUser",
    payload: { begruendung: 7 },
    erwartet: ANGEMELDET,
  },
  {
    gruppe: "datenschutzRoutes",
    methode: "POST",
    pfad: "/api/me/loeschantrag/gibt-es-nicht/zurueckziehen",
    route: "/api/me/loeschantrag/:id/zurueckziehen",
    belegstelle: "services/app/src/routes/datenschutz-routes.ts:182",
    tor: "requireUser",
    erwartet: ANGEMELDET,
  },
  // Fremde Konten, Entscheidungen und das Verzeichnis: dieselbe Schranke wie das Löschen eines
  // Kontos (`users.manage`). Ablehnen ohne Grund endet nach dem Tor mit 400, eine erfundene Kennung
  // mit 404 — es wird nichts entschieden.
  {
    gruppe: "datenschutzRoutes",
    methode: "GET",
    pfad: "/api/datenschutz/loeschantraege",
    belegstelle: "services/app/src/routes/datenschutz-routes.ts:220",
    tor: "users.manage",
    erwartet: NUR_ADMIN,
  },
  {
    gruppe: "datenschutzRoutes",
    methode: "POST",
    pfad: "/api/datenschutz/loeschantraege/gibt-es-nicht/erledigen",
    route: "/api/datenschutz/loeschantraege/:id/erledigen",
    belegstelle: "services/app/src/routes/datenschutz-routes.ts:239",
    tor: "users.manage",
    erwartet: NUR_ADMIN,
  },
  {
    gruppe: "datenschutzRoutes",
    methode: "POST",
    pfad: "/api/datenschutz/loeschantraege/gibt-es-nicht/ablehnen",
    route: "/api/datenschutz/loeschantraege/:id/ablehnen",
    belegstelle: "services/app/src/routes/datenschutz-routes.ts:319",
    tor: "users.manage",
    erwartet: NUR_ADMIN,
  },
  {
    gruppe: "datenschutzRoutes",
    methode: "GET",
    pfad: "/api/datenschutz/auskunft/gibt-es-nicht",
    route: "/api/datenschutz/auskunft/:nutzerId",
    belegstelle: "services/app/src/routes/datenschutz-routes.ts:366",
    tor: "users.manage",
    erwartet: NUR_ADMIN,
  },
  {
    gruppe: "datenschutzRoutes",
    methode: "GET",
    pfad: "/api/datenschutz/verarbeitungsverzeichnis",
    belegstelle: "services/app/src/routes/datenschutz-routes.ts:390",
    tor: "users.manage",
    erwartet: NUR_ADMIN,
  },
  // R-0466: das eigene Interaktionsgedächtnis. Jede angemeldete Rolle führt ihr eigenes; die
  // schreibenden Türen stehen in `schreibende-tueren.ts`.
  {
    gruppe: "gedaechtnisRoutes",
    methode: "GET",
    pfad: "/api/me/gedaechtnis",
    belegstelle: "services/app/src/routes/gedaechtnis-routes.ts:80",
    tor: "requireUser",
    erwartet: ANGEMELDET,
  },
  // R-1064: der Supportweg der Installation. Jede angemeldete Rolle braucht ihn (Hilfeseite
  // `minRole: "viewer"`), deshalb bewusst kein Recht über die Anmeldung hinaus.
  {
    gruppe: "supportRoutes",
    methode: "GET",
    pfad: "/api/support",
    belegstelle: "services/app/src/routes/support-routes.ts:150",
    tor: "requireUser",
    erwartet: ANGEMELDET,
  },
  {
    gruppe: "importAccessRoutes",
    methode: "GET",
    pfad: "/api/import/confluence/zugang",
    belegstelle: "services/app/src/routes/import-access-routes.ts:70",
    tor: "users.manage",
    erwartet: NUR_ADMIN,
  },
  // JOB 4086: dieselbe Auskunft für die zweite Quelle — und dieselbe Tür. Eine weichere Tür für den
  // Zustand eines admin-gebundenen Imports wäre eine Rechte-Ausweitung durch die Hintertür.
  {
    gruppe: "importAccessRoutes",
    methode: "GET",
    pfad: "/api/import/sharepoint/zugang",
    belegstelle: "services/app/src/routes/import-access-routes.ts:138",
    tor: "users.manage",
    erwartet: NUR_ADMIN,
  },
  // ADMIN-02: der Verbindungstest. Auf der Bühne stehen keine SharePoint-Angaben; er endet deshalb
  // LOKAL („ausgeschaltet" bzw. „nicht eingerichtet"), ohne Abruf an eine Gegenstelle — gemessen
  // wird genau das Rechtetor.
  {
    gruppe: "importAccessRoutes",
    methode: "POST",
    pfad: "/api/import/sharepoint/verbindungstest",
    belegstelle: "services/app/src/routes/import-access-routes.ts:170",
    tor: "users.manage",
    payload: {},
    erwartet: NUR_ADMIN,
  },
  // ADMIN-02: derselbe Verbindungstest für Confluence. Ohne hinterlegte Confluence-Angaben endet er
  // lokal, ohne Abruf — gemessen wird das Rechtetor.
  {
    gruppe: "importAccessRoutes",
    methode: "POST",
    pfad: "/api/import/confluence/verbindungstest",
    belegstelle: "services/app/src/routes/import-access-routes.ts:181",
    tor: "users.manage",
    payload: {},
    erwartet: NUR_ADMIN,
  },
  // ADMIN-02: die Importliste — die jüngsten Läufe, nur für Verwaltende.
  {
    // Nacharbeit 3: eigene, unbedingt registrierte Gruppe (die übrigen Laufwege hängen am Schalter).
    gruppe: "importLaufListeRoutes",
    methode: "GET",
    pfad: "/api/admin/import/runs",
    belegstelle: "services/app/src/routes/import-run-routes.ts:204",
    tor: "users.manage",
    erwartet: NUR_ADMIN,
  },
  // JOB 4086 · die zwei Türen des SharePoint-Imports. Sie stehen hier VOLLSTÄNDIG in der Abnahme
  // und nicht in der Restliste, und das geht, weil beide OHNE hinterlegte Zugangsdaten gar nichts
  // anrichten: der Adapter kommt nicht zustande, die Antwort ist ein 503 vor jedem Effekt. Die
  // Bühne misst damit genau das, was sie messen soll — das Rechtetor.
  {
    gruppe: "sharepointImportRoutes",
    methode: "POST",
    pfad: "/api/admin/import/sharepoint/files",
    belegstelle: "services/app/src/routes/sharepoint-import-routes.ts:190",
    tor: "users.manage",
    payload: {},
    erwartet: NUR_ADMIN,
  },
  {
    gruppe: "sharepointImportRoutes",
    methode: "POST",
    pfad: "/api/admin/import/sharepoint/apply",
    belegstelle: "services/app/src/routes/sharepoint-import-routes.ts:229",
    tor: "users.manage",
    payload: {},
    erwartet: NUR_ADMIN,
  },
  // R-0145/R-0190: die Ordnerübernahme in Losen. Ohne Zugangsdaten ebenso ein 503 vor jedem Effekt.
  {
    gruppe: "sharepointImportRoutes",
    methode: "POST",
    pfad: "/api/admin/import/sharepoint/folder-apply",
    belegstelle: "services/app/src/routes/sharepoint-import-routes.ts:554",
    tor: "users.manage",
    payload: {},
    erwartet: NUR_ADMIN,
  },
  // R-0170: die Zugangsauskunft und die drei Türen des Jira-Imports. Wie bei SharePoint stehen sie
  // vollständig in der Abnahme: die Bühne setzt keine Jira-Zugangsdaten, der Adapter kommt nicht
  // zustande, und die Türen antworten mit 503 vor jedem Effekt. Gemessen wird das Rechtetor.
  {
    gruppe: "importAccessRoutes",
    methode: "GET",
    pfad: "/api/import/jira/zugang",
    belegstelle: "services/app/src/routes/import-access-routes.ts:149",
    tor: "users.manage",
    erwartet: NUR_ADMIN,
  },
  {
    gruppe: "jiraImportRoutes",
    methode: "POST",
    pfad: "/api/admin/import/jira/issues",
    belegstelle: "services/app/src/routes/jira-import-routes.ts:155",
    tor: "users.manage",
    payload: {},
    erwartet: NUR_ADMIN,
  },
  {
    gruppe: "jiraImportRoutes",
    methode: "POST",
    pfad: "/api/admin/import/jira/apply",
    belegstelle: "services/app/src/routes/jira-import-routes.ts:182",
    tor: "users.manage",
    payload: {},
    erwartet: NUR_ADMIN,
  },
  {
    gruppe: "jiraImportRoutes",
    methode: "POST",
    pfad: "/api/admin/import/jira/project-apply",
    belegstelle: "services/app/src/routes/jira-import-routes.ts:243",
    tor: "users.manage",
    payload: {},
    erwartet: NUR_ADMIN,
  },
  {
    gruppe: "importRunRoutes",
    methode: "GET",
    pfad: "/api/admin/import/runs/gibt-es-nicht",
    route: "/api/admin/import/runs/:importId",
    belegstelle: "services/app/src/routes/import-run-routes.ts:117",
    tor: "users.manage",
    erwartet: NUR_ADMIN,
  },
  // ------------------------------------------------------------------------------------------------
  // JOB 4156/4357 (WIKI-GESAMTANWEISUNG) — DIE ELF TÜREN DER ZUSAMMENGESETZTEN ANWEISUNG.
  // ------------------------------------------------------------------------------------------------
  //
  // DREI RECHTE, EHRLICH GETRENNT, und die Zuordnung ist nicht gewählt, sondern aus dem
  // Startvertrag übernommen („direkte Freigabe durch Berechtigte, Einreichen ohne Freigaberecht"):
  //   · LESEN (Lesestand, Ständeliste, Vergleich)     → `ko.read`     — jede angemeldete Rolle.
  //   · ANLEGEN, ÄNDERN, AUFNEHMEN, ORDNEN, VORLEGEN  → `ko.create`   — ab experte („einreichen").
  //   · ENTSCHEIDEN                                   → `ko.validate` — ab controller („freigeben").
  // Dass Vorlegen und Entscheiden AUSEINANDERFALLEN, ist der Kern: ein Experte darf einreichen und
  // NICHT entscheiden. Stünde bei `/entscheiden` `AB_EXPERTE`, wäre der Startvertrag gebrochen und
  // niemand sähe es — deshalb steht die Zeile hier und nicht in der Restliste.
  //
  // KEINE ZEILE WIRD ZURÜCKGESTELLT. Alle elf Türen sind hier gemessen; in `NICHT_ABGENOMMEN`
  // steht keine davon.
  //
  // JOB 4357 · DIE ELFTE TÜR IST `GET /api/gesamtanweisungen` — der gespeicherte BESTAND. Sie steht
  // als LETZTE Zeile dieser Gruppe, weil die Route selbst als letzte registriert ist; so bleiben die
  // zehn Belegstellen darüber wahr (Begründung im Quelltext der Route). Ihr Tor ist `ko.read` wie bei
  // jedem anderen Leseweg — und das ist keine Bequemlichkeit: die Liste gibt über eine Anweisung
  // GENAU das heraus, was `GET /api/gesamtanweisungen/:id` über sie herausgibt (Kopf, Zahl der
  // sichtbaren und der verborgenen Bausteine), nur ohne die Bausteine selbst.
  //
  // SIE IST ZUSTANDSFREI WIE DIE ÜBRIGEN ZEHN, und das ist hier ausdrücklich nachgesehen: sie ist ein
  // reiner Leseweg ohne Kennung und ohne Nutzlast. Sie liest, was auf der gemeinsamen Bühne gerade
  // steht (in der Regel nichts), und ändert daran nichts — die folgenden Zeilen finden denselben
  // Bestand vor wie ohne sie.
  //
  // DIE GEFAHRENEN URLs SIND ZUSTANDSFREI, und das ist bei dieser Gruppe ausdrücklich nachgesehen
  // und nicht angenommen: die Messungen laufen gegen EINE gemeinsame Bühne, und ein wirklich
  // angelegter Vorgang verschöbe die Grundlage der folgenden Zeilen.
  //   · Die neun Zeilen mit Kennung tragen eine erfundene (`gibt-es-nicht`) und enden im 404 des
  //     Dienstes — er lädt die Anweisung VOR jeder Änderung (`geladen`, gesamtanweisung-service.ts).
  //   · `POST /api/gesamtanweisungen` hat KEINE Kennung und ist der einzige Weg, der wirklich etwas
  //     anlegen KÖNNTE. Mit leerer Nutzlast tut er es nicht: `anweisungAnlegen`
  //     (`gesamtanweisung-service.ts:164`) fordert `titel` über `pflichttext` und wirft `INVALID`,
  //     BEVOR die Ablage gerufen wird — 400, und der Bestand bleibt unberührt. Für die Abnahme ist
  //     das „durchgelassen": das Rechtetor hat entschieden, die Rumpfprüfung danach abgelehnt.
  {
    gruppe: "gesamtanweisungRoutes",
    methode: "POST",
    pfad: "/api/gesamtanweisungen",
    belegstelle: "services/app/src/routes/gesamtanweisung-routes.ts:274",
    tor: "ko.create",
    payload: {},
    erwartet: AB_EXPERTE,
  },
  {
    gruppe: "gesamtanweisungRoutes",
    methode: "GET",
    pfad: "/api/gesamtanweisungen/gibt-es-nicht",
    route: "/api/gesamtanweisungen/:id",
    belegstelle: "services/app/src/routes/gesamtanweisung-routes.ts:286",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "gesamtanweisungRoutes",
    methode: "PUT",
    pfad: "/api/gesamtanweisungen/gibt-es-nicht",
    route: "/api/gesamtanweisungen/:id",
    belegstelle: "services/app/src/routes/gesamtanweisung-routes.ts:300",
    tor: "ko.create",
    payload: {},
    erwartet: AB_EXPERTE,
  },
  {
    gruppe: "gesamtanweisungRoutes",
    methode: "POST",
    pfad: "/api/gesamtanweisungen/gibt-es-nicht/bausteine",
    route: "/api/gesamtanweisungen/:id/bausteine",
    belegstelle: "services/app/src/routes/gesamtanweisung-routes.ts:322",
    tor: "ko.create",
    payload: {},
    erwartet: AB_EXPERTE,
  },
  {
    gruppe: "gesamtanweisungRoutes",
    methode: "PUT",
    pfad: "/api/gesamtanweisungen/gibt-es-nicht/reihenfolge",
    route: "/api/gesamtanweisungen/:id/reihenfolge",
    belegstelle: "services/app/src/routes/gesamtanweisung-routes.ts:360",
    tor: "ko.create",
    payload: {},
    erwartet: AB_EXPERTE,
  },
  {
    gruppe: "gesamtanweisungRoutes",
    methode: "PUT",
    pfad: "/api/gesamtanweisungen/gibt-es-nicht/bausteine/gibt-es-auch-nicht/voraussetzung",
    route: "/api/gesamtanweisungen/:id/bausteine/:bausteinId/voraussetzung",
    belegstelle: "services/app/src/routes/gesamtanweisung-routes.ts:393",
    tor: "ko.create",
    payload: {},
    erwartet: AB_EXPERTE,
  },
  {
    gruppe: "gesamtanweisungRoutes",
    methode: "GET",
    pfad: "/api/gesamtanweisungen/gibt-es-nicht/staende",
    route: "/api/gesamtanweisungen/:id/staende",
    belegstelle: "services/app/src/routes/gesamtanweisung-routes.ts:423",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "gesamtanweisungRoutes",
    methode: "GET",
    // MIT `von`/`bis`: ohne sie antwortet die Route 400 `VALIDATION`, bevor der Dienst überhaupt
    // gerufen wird (`:449`). Das wäre für die Abnahme ebenfalls „erlaubt" — aber es hätte die
    // Rumpfprüfung gemessen und nicht den Weg, um den es geht. So endet die Zeile im 404 des
    // Dienstes, also hinter dem Rechtetor.
    pfad: "/api/gesamtanweisungen/gibt-es-nicht/vergleich?von=1&bis=2",
    route: "/api/gesamtanweisungen/:id/vergleich",
    belegstelle: "services/app/src/routes/gesamtanweisung-routes.ts:440",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "gesamtanweisungRoutes",
    methode: "POST",
    pfad: "/api/gesamtanweisungen/gibt-es-nicht/vorlegen",
    route: "/api/gesamtanweisungen/:id/vorlegen",
    belegstelle: "services/app/src/routes/gesamtanweisung-routes.ts:465",
    tor: "ko.create",
    payload: {},
    erwartet: AB_EXPERTE,
  },
  {
    gruppe: "gesamtanweisungRoutes",
    methode: "POST",
    // DIE ZEILE, DIE DEN STARTVERTRAG HÄLT: `AB_CONTROLLER` und nicht `AB_EXPERTE`. Wer einreichen
    // darf, darf deshalb noch nicht entscheiden — „Einreichen ohne Freigaberecht" ist wörtlich der
    // Vertrag, und ohne diese Zeile wäre seine Verletzung unsichtbar.
    pfad: "/api/gesamtanweisungen/gibt-es-nicht/entscheiden",
    route: "/api/gesamtanweisungen/:id/entscheiden",
    belegstelle: "services/app/src/routes/gesamtanweisung-routes.ts:486",
    tor: "ko.validate",
    payload: {},
    erwartet: AB_CONTROLLER,
  },
  {
    // JOB 4357 · DER BESTAND. Keine Kennung, keine Nutzlast — es gibt an dieser Tür keine Eingabe,
    // die unbrauchbar sein könnte, und deshalb auch keine eigene 400.
    gruppe: "gesamtanweisungRoutes",
    methode: "GET",
    pfad: "/api/gesamtanweisungen",
    belegstelle: "services/app/src/routes/gesamtanweisung-routes.ts:539",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    // QUELLENÄNDERUNGEN (aufnahme:20260928) · DIE ZWÖLFTE TÜR: eine neuere Quellenfassung bewusst
    // übernehmen. Erfundene Kennungen wie die übrigen Zeilen; mit leerer Nutzlast endet sie hinter
    // dem Rechtetor in der 400 `VALIDATION` der Route — der Bestand bleibt unberührt.
    gruppe: "gesamtanweisungRoutes",
    methode: "POST",
    pfad: "/api/gesamtanweisungen/gibt-es-nicht/bausteine/gibt-es-auch-nicht/uebernehmen",
    route: "/api/gesamtanweisungen/:id/bausteine/:bausteinId/uebernehmen",
    belegstelle: "services/app/src/routes/gesamtanweisung-routes.ts:567",
    tor: "ko.create",
    payload: {},
    erwartet: AB_EXPERTE,
  },
  // ------------------------------------------------------------------------------------------------
  // JOB 4151 (WG-PERSISTENZ) — DIE VIER TÜREN DER KURATIERTEN BEZIEHUNGEN.
  // ------------------------------------------------------------------------------------------------
  //
  // ZWEI RECHTE, EHRLICH GETRENNT: Lesen hängt an `ko.read` (jede angemeldete Rolle trägt es),
  // Schreiben an `ko.relate` — dem Recht, das dieser Auftrag neu einträgt und das controller und
  // admin bekommen (`services/rbac/src/policy.ts`). Ein Gast soll sehen, wie das Wissen
  // zusammenhängt, und nicht darüber urteilen; deshalb steht bei den beiden Schreibzeilen
  // `AB_CONTROLLER` und nicht `AB_EXPERTE`.
  //
  // KEINE ZEILE WIRD ZURÜCKGESTELLT. Alle drei Türen sind hier gemessen; in `NICHT_ABGENOMMEN`
  // steht keine davon. Die gefahrenen URLs sind bewusst ZUSTANDSFREI (erfundene Kennungen): die
  // Messungen dieser Tabelle laufen gegen EINE gemeinsame Bühne, und ein wirklich angelegter
  // Vorgang verschöbe die Grundlage der folgenden Zeilen.
  {
    gruppe: "kantenRoutes",
    methode: "GET",
    pfad: "/api/kos/gibt-es-nicht/beziehungen",
    route: "/api/kos/:id/beziehungen",
    belegstelle: "services/app/src/routes/kanten-routes.ts:128",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "kantenRoutes",
    methode: "POST",
    pfad: "/api/kos/gibt-es-nicht/beziehungen",
    route: "/api/kos/:id/beziehungen",
    belegstelle: "services/app/src/routes/kanten-routes.ts:155",
    tor: "ko.relate",
    // Leere Nutzlast: die Abnahme misst die TÜR, nicht den Raum dahinter. Für controller und admin
    // endet sie im 400 der Rumpfprüfung — das ist „durchgelassen" und legt nichts an.
    payload: {},
    erwartet: AB_CONTROLLER,
  },
  {
    gruppe: "kantenRoutes",
    methode: "POST",
    pfad: "/api/beziehungen/gibt-es-nicht/widerruf",
    route: "/api/beziehungen/:beziehungId/widerruf",
    belegstelle: "services/app/src/routes/kanten-routes.ts:213",
    tor: "ko.relate",
    payload: {},
    erwartet: AB_CONTROLLER,
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
    route: "/api/klara/answers/:answerId/explanation",
    belegstelle: "services/app/src/routes/klara-answer-explanation-routes.ts:87",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "klaraZurufRoutes",
    methode: "POST",
    pfad: "/api/klara/sessions/gibt-es-nicht/zuruf",
    route: "/api/klara/sessions/:sessionId/zuruf",
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
    belegstelle: "services/app/src/routes/lifecycle-routes.ts:100",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  // R-0554 / R-2128: die Wissensübergabe beim Ausscheiden. Gemessen wird das Rechtetor mit einem
  // LEEREN Rumpf: der Admin kommt durch und bekommt 400 (`INVALID`, kein Paar) — vor jedem Lesen
  // und Schreiben, also ohne Wirkung auf die Bühne. Vorschau und Zug mit echten Konten misst
  // `tests/wissen-verantwortung/routen.test.ts`.
  {
    gruppe: "lifecycleRoutes",
    methode: "POST",
    pfad: "/api/lifecycle/handover/preview",
    belegstelle: "services/app/src/routes/lifecycle-routes.ts:178",
    tor: "users.manage",
    payload: {},
    erwartet: NUR_ADMIN,
  },
  {
    gruppe: "lifecycleRoutes",
    methode: "POST",
    pfad: "/api/lifecycle/handover",
    belegstelle: "services/app/src/routes/lifecycle-routes.ts:193",
    tor: "users.manage",
    payload: {},
    erwartet: NUR_ADMIN,
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
    belegstelle: "services/app/src/routes/management-routes.ts:19",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  // R-1639 / R-2183 (Nacharbeit 3): der Bereichsblick (jede lesende Rolle, gefiltert auf die eigenen
  // Bereiche) und die drei Pflegetüren seiner Eingänge (nur Admin).
  {
    gruppe: "managementRoutes",
    methode: "GET",
    pfad: "/api/management/risk-horizon",
    belegstelle: "services/app/src/routes/management-routes.ts:33",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "managementRoutes",
    methode: "GET",
    pfad: "/api/management/profiles",
    belegstelle: "services/app/src/routes/management-routes.ts:45",
    tor: "users.manage",
    erwartet: NUR_ADMIN,
  },
  {
    gruppe: "managementRoutes",
    methode: "PUT",
    pfad: "/api/management/profiles/category",
    belegstelle: "services/app/src/routes/management-routes.ts:57",
    tor: "users.manage",
    payload: {},
    erwartet: NUR_ADMIN,
  },
  {
    gruppe: "managementRoutes",
    methode: "PUT",
    pfad: "/api/management/profiles/retirement/gibt-es-nicht",
    route: "/api/management/profiles/retirement/:userId",
    belegstelle: "services/app/src/routes/management-routes.ts:69",
    tor: "users.manage",
    payload: {},
    erwartet: NUR_ADMIN,
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
    // Aufnahme gesamt-ki-laufprotokoll (V9, R-2071): die Zeitraum-Auswertung, dieselbe Lesestufe.
    gruppe: "modelRunRoutes",
    methode: "GET",
    pfad: "/api/model-runs/auswertung",
    belegstelle: "services/app/src/routes/model-runs-routes.ts:53",
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
    route: "/api/objects/:id",
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
  // RECHERCHE:pmo-fea-0004 — das Wissensupdate fürs Teamgespräch: lesen, auf Abruf, kein Versand.
  {
    gruppe: "outputRoutes",
    methode: "GET",
    pfad: "/api/output/wochenupdate",
    belegstelle: "services/app/src/routes/output-routes.ts:32",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  // produkt:wettbewerb:20261003:lernplattform — die leere Nutzlast endet für jede Rolle in der
  // Rumpfprüfung (400 BAD_REQUEST), also HINTER dem Rechtetor; anonym bleibt 401.
  {
    gruppe: "lmsExportRoutes",
    methode: "POST",
    pfad: "/api/output/scorm/pruefen",
    belegstelle: "services/app/src/routes/lms-export-routes.ts:25",
    tor: "ko.read",
    payload: {},
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "lmsExportRoutes",
    methode: "POST",
    pfad: "/api/output/scorm/paket",
    belegstelle: "services/app/src/routes/lms-export-routes.ts:37",
    tor: "ko.read",
    payload: {},
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
    route: "/api/kos/:id/provenance",
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
    // R-0599: die KI-Lage der Kopfzeile (Modus, Anbieter, Herkunft) — anders als die zwei Zeilen
    // darüber NICHT öffentlich, sondern für jede Rolle mit Leserecht.
    gruppe: DIREKT,
    methode: "GET",
    pfad: "/api/ki-lage",
    belegstelle: "services/app/src/build-app.ts:2781",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    // R-0700: Klaras eigener, sitzungsgebundener Ausführungszugang. Gemessen wird die TÜR: das
    // Rechtetor (`ko.read`, ein Add-on-Schlüssel bekommt 403) entscheidet in `preValidation`, VOR
    // jeder Sitzungsprüfung. Die Kennung ist erfunden und die Bindungskopfzeilen fehlen — der
    // Berechtigte bekommt deshalb die fachliche 404 der Sitzungszuordnung (`erlaubt`: registriert,
    // Tor durchgelassen); was die Bindung dahinter prüft, misst `ask-routes.test.ts`.
    gruppe: "klaraAusfuehrungRoutes",
    methode: "POST",
    pfad: "/api/klara/sessions/abnahme-ohne-sitzung/execute",
    route: "/api/klara/sessions/:sessionId/execute",
    belegstelle: "services/app/src/routes/ask-routes.ts:984",
    tor: "ko.read",
    payload: { question: "Rollenabnahme", locale: "de" },
    erwartet: NUR_LESEN,
  },
  {
    gruppe: DIREKT,
    methode: "GET",
    pfad: "/api/analytics/impact",
    belegstelle: "services/app/src/build-app.ts:2667",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },

  // ==============================================================================================
  // JOB 4061 · LIEFERUNG 5 — DIE ÜBRIGEN LESE-TÜREN: JEDE REGISTRIERTE GET-ROUTE WIRD BEFRAGT.
  // ==============================================================================================
  //
  // Bis hierher stand EINE stellvertretende Zeile je Routengruppe (47 Zeilen über 39 Gruppen). Das
  // war eine vollständige GRUPPENabnahme und ausdrücklich keine Endpunktabnahme
  // (`archiv/4015/runde-2/RUECKGABE.md:65`). Die Zeilen unten schliessen die Lücke für die LESEWEGE:
  // jede GET-Route, die die Aufzählung aus der laufenden App findet, wird mit allen fünf Akteuren
  // gefahren. Die Schreibwege stehen mit Grund in `NICHT_ABGENOMMEN`.
  //
  // DIE ERWARTUNGEN SIND AUCH HIER GESCHRIEBEN, NICHT GERECHNET (s. Kopf dieser Datei). Gelesen
  // wurde je Route ihr Handler; eingetragen ist das Muster, das zum geforderten Recht gehört. Weicht
  // die Messung ab, kommt die Abweichung als `ist` mit Grund daneben — nie ins `soll`.
  {
    gruppe: "addinStaticRoutes",
    methode: "GET",
    pfad: "/addin/gibt-es-nicht.js",
    route: "/addin/*",
    belegstelle: "services/app/src/routes/addin-static-routes.ts:181",
    tor: "keines — statischer Namensraum des Klara-Add-ins",
    erwartet: OEFFENTLICH(
      "Der Wildcard-Zweig desselben Bündels wie `GET /addin`: Word lädt Taskpane, CSS und Skript, bevor irgendjemand angemeldet ist. Er liefert ausschliesslich aus einer expliziten Datei-Map (traversal-sicher, kein Verzeichnislisting); gemessen wird hier die statische 404 auf einen Namen, der nicht in der Map steht.",
    ),
  },
  {
    gruppe: "adminRoutes",
    methode: "GET",
    pfad: "/api/admin/demo-seed",
    belegstelle: "services/app/src/routes/admin-routes.ts:87",
    tor: "users.manage",
    erwartet: NUR_ADMIN,
  },
  {
    gruppe: "adminRoutes",
    methode: "GET",
    pfad: "/api/admin/demo-packages",
    belegstelle: "services/app/src/routes/admin-routes.ts:169",
    tor: "users.manage",
    erwartet: NUR_ADMIN,
  },
  {
    gruppe: "adminRoutes",
    methode: "GET",
    pfad: "/api/admin/demo-packages/gibt-es-nicht/preview",
    route: "/api/admin/demo-packages/:id/preview",
    belegstelle: "services/app/src/routes/admin-routes.ts:187",
    tor: "users.manage",
    erwartet: NUR_ADMIN,
  },
  {
    // JOB 4025 — die Auskunft über die Sicherungen des Betreibers. Eine reine Lesetür: sie zählt
    // auf, was im Sicherungsverzeichnis liegt, und schreibt nichts. Sie hängt an demselben Tor wie
    // die übrigen Admin-Auskünfte (`users.manage`), deshalb dasselbe Muster — geschrieben, nicht
    // aus der Rechtematrix gerechnet. Ob im Prüfaufbau ein Sicherungsverzeichnis existiert, ändert
    // an dieser Zeile nichts: gemessen wird die TÜR, und der Handler antwortet in beiden Lagen 200
    // (`zustand: "gelesen"` bzw. `"kein_verzeichnis"`).
    gruppe: "adminRoutes",
    methode: "GET",
    pfad: "/api/admin/sicherungen",
    belegstelle: "services/app/src/routes/admin-routes.ts:443",
    tor: "users.manage",
    erwartet: NUR_ADMIN,
  },
  {
    gruppe: "askRoutes",
    methode: "GET",
    pfad: "/api/gaps/summary",
    belegstelle: "services/app/src/routes/ask-routes.ts:471",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "auditRoutes",
    methode: "GET",
    pfad: "/api/audit/verify",
    belegstelle: "services/app/src/routes/audit-routes.ts:27",
    tor: "ko.validate",
    erwartet: AB_CONTROLLER,
  },
  // Aufnahme gesamt-auditprotokoll (R-0613): der Export der Kette. Er hängt beim Abruf einen
  // `audit.exported`-Eintrag an; die Tür ist dieselbe wie bei `/api/audit`.
  {
    gruppe: "auditRoutes",
    methode: "GET",
    pfad: "/api/audit/export",
    belegstelle: "services/app/src/routes/audit-routes.ts:62",
    tor: "ko.validate",
    erwartet: AB_CONTROLLER,
  },
  // Aufnahme gesamt-auditprotokoll, Lauf 2 (R-0766): Kennungen der Konflikte und Überschneidungen
  // eines Objekts für dessen Kette — dieselbe Tür wie `/api/audit`.
  {
    gruppe: "auditRoutes",
    methode: "GET",
    pfad: "/api/audit/ko/:koId/findings",
    belegstelle: "services/app/src/routes/audit-routes.ts:39",
    tor: "ko.validate",
    erwartet: AB_CONTROLLER,
  },
  // ----------------------------------------------------------------------------------------------
  // `authRoutes` läuft nicht über `makeGuards`, sondern über sein eigenes `requireUser`
  // (`services/auth/src/routes.ts:312-326`). Dessen 401 trägt `INVALID_CREDENTIALS` statt
  // `UNAUTHENTICATED` — derselbe Befund wie bei `GET /api/users` oben, hier für jede weitere Tür des
  // Moduls einzeln gemessen statt einmal behauptet.
  // ----------------------------------------------------------------------------------------------
  {
    gruppe: "authRoutes",
    methode: "GET",
    pfad: "/api/auth/me",
    belegstelle: "services/auth/src/routes.ts:456",
    tor: "requireUser (eigener Guard des auth-Moduls, `routes.ts:312-326`)",
    erwartet: ANGEMELDET,
    codes: { "401": "INVALID_CREDENTIALS" },
  },
  {
    gruppe: "authRoutes",
    methode: "GET",
    pfad: "/api/auth/notice",
    belegstelle: "services/auth/src/routes.ts:563",
    tor: "requireUser (eigener Guard des auth-Moduls, `routes.ts:312-326`)",
    erwartet: ANGEMELDET,
    codes: { "401": "INVALID_CREDENTIALS" },
  },
  {
    gruppe: "authRoutes",
    methode: "GET",
    pfad: "/api/directory",
    belegstelle: "services/auth/src/routes.ts:841",
    tor: "requireUser (eigener Guard des auth-Moduls, `routes.ts:312-326`)",
    erwartet: ANGEMELDET,
    codes: { "401": "INVALID_CREDENTIALS" },
  },
  {
    gruppe: "authRoutes",
    methode: "GET",
    pfad: "/api/auth/status",
    belegstelle: "services/auth/src/routes.ts:800",
    tor: "keines — der Zustand VOR der Anmeldung",
    erwartet: OEFFENTLICH(
      "Die Anmeldemaske muss wissen, ob diese Instanz überhaupt schon eingerichtet ist und ob SSO angeboten wird — beides, bevor es eine Sitzung geben kann. Sie nennt keine Kontodaten und keinen Bestand.",
    ),
  },
  {
    gruppe: "authRoutes",
    methode: "GET",
    pfad: "/api/auth/oidc/start",
    belegstelle: "services/auth/src/routes.ts:680",
    tor: "keines — der Einstieg in den SSO-Ablauf",
    erwartet: OEFFENTLICH(
      "Der Authorization-Code-Ablauf beginnt notwendig unangemeldet. Ohne konfiguriertes OIDC antwortet die Route allen fünf Akteuren gleich mit 501 `OIDC_DISABLED` (`routes.ts:681-686`) — gemessen ist damit, dass an dieser Tür weder 401 noch 403 steht.",
    ),
  },
  // R-0556 / R-0571: die Verzeichnispflege (SCIM). Ihr Tor ist der Verzeichnisschlüssel, KEIN
  // Rollenrecht — keine der fünf Sitzungen, auch nicht die des Admins, öffnet sie. Gemessen an
  // ALLEN sieben Türen, lesend wie schreibend: die Schlüsselprüfung steht vor jedem Lesen und
  // Schreiben (`requireVerzeichnisSchluessel`), eine abgewiesene Messung ändert also nichts. Das
  // Anlegen, Ändern und Sperren MIT Schlüssel fährt `tests/firmenanmeldung/verzeichnis-pflege.test.ts`.
  ...(
    [
      ["GET", "/scim/v2/ServiceProviderConfig", undefined, 357],
      ["GET", "/scim/v2/Users", undefined, 375],
      ["GET", "/scim/v2/Users/gibt-es-nicht", "/scim/v2/Users/:id", 407],
      ["POST", "/scim/v2/Users", undefined, 417],
      ["PUT", "/scim/v2/Users/gibt-es-nicht", "/scim/v2/Users/:id", 437],
      ["PATCH", "/scim/v2/Users/gibt-es-nicht", "/scim/v2/Users/:id", 457],
      ["DELETE", "/scim/v2/Users/gibt-es-nicht", "/scim/v2/Users/:id", 478],
    ] as const
  ).map(
    ([methode, pfad, route, zeile]): Zeile => ({
      gruppe: "verzeichnisRoutes",
      methode,
      pfad,
      ...(route ? { route } : {}),
      belegstelle: `services/app/src/routes/verzeichnis-routes.ts:${zeile}`,
      tor: "Verzeichnisschlüssel (KLARWERK_SCIM_TOKEN) — kein Rollenrecht",
      codes: { "401": "SCIM_UNAUTHORIZED" },
      erwartet: {
        anonym: "401",
        viewer: "401",
        experte: "401",
        controller: "401",
        admin: "401",
      },
    }),
  ),
  // R-0560: die zwei lesenden SAML-Türen — dieselbe Lage wie der OIDC-Einstieg darüber.
  {
    gruppe: "authRoutes",
    methode: "GET",
    pfad: "/api/auth/saml/start",
    belegstelle: "services/auth/src/routes.ts:906",
    tor: "keines — der Einstieg in den SAML-Ablauf",
    erwartet: OEFFENTLICH(
      "Die SAML-Anmeldung beginnt notwendig unangemeldet. Ohne SAML-Konfiguration antwortet die Route allen fünf Akteuren gleich mit 501 `SAML_DISABLED` — gemessen ist damit, dass an dieser Tür weder 401 noch 403 steht.",
    ),
  },
  {
    gruppe: "authRoutes",
    methode: "GET",
    pfad: "/api/auth/saml/metadata",
    belegstelle: "services/auth/src/routes.ts:928",
    tor: "keines — die Metadaten für die Einrichtung beim Anbieter",
    erwartet: OEFFENTLICH(
      "Die Dienstanbieter-Metadaten trägt die IT beim Anbieter ein, bevor es irgendeine Anmeldung gibt. Sie nennen nur Kennung und Rücksprungadresse dieser Instanz; ohne SAML-Konfiguration antwortet die Route allen gleich mit 501 `SAML_DISABLED`.",
    ),
  },
  // Der SAML-Rücksprung: der Anbieter schickt ihn als Seitennavigation, notwendig ohne Sitzung.
  // Gemessen ist hier, dass keine Rolle ihn öffnet oder sperrt — ohne Konfiguration antwortet er
  // allen fünf gleich 501 `SAML_DISABLED`. Die Signaturprüfung misst `saml-anmeldung.test.ts`.
  {
    gruppe: "authRoutes",
    methode: "POST",
    pfad: "/api/auth/saml/acs",
    belegstelle: "services/auth/src/routes.ts:982",
    tor: "keines — der Nachweis ist die signierte Antwort des Anbieters",
    payload: { SAMLResponse: "keine-echte-saml-antwort" },
    erwartet: OEFFENTLICH(
      "Der Rücksprung des SAML-Anbieters kommt notwendig ohne Klarwerk-Sitzung (fremd ausgelöster Formular-POST). Ohne SAML-Konfiguration antwortet er allen fünf Akteuren gleich mit 501 `SAML_DISABLED`; die Prüfung der signierten Antwort selbst steht in `tests/firmenanmeldung/saml-anmeldung.test.ts`.",
    ),
  },
  // Der SAML-Abschluss: erst hier entsteht die Sitzung, und nur mit dem Nachweis des startenden
  // Browsers (S10/S13 in `saml-anmeldung.test.ts`). Ohne Konfiguration allen fünf gleich 501.
  {
    gruppe: "authRoutes",
    methode: "GET",
    pfad: "/api/auth/saml/abschluss",
    belegstelle: "services/auth/src/routes.ts:1031",
    tor: "keines — der Nachweis sind Abschlusscode und Browsernachweis des startenden Browsers",
    erwartet: OEFFENTLICH(
      "Der Abschluss folgt unmittelbar auf den Rücksprung des Anbieters, also notwendig vor jeder Klarwerk-Sitzung. Ohne SAML-Konfiguration antwortet er allen fünf Akteuren gleich mit 501 `SAML_DISABLED`; die Bindung an den startenden Browser steht in `tests/firmenanmeldung/saml-anmeldung.test.ts` (S10, S13).",
    ),
  },
  // ----------------------------------------------------------------------------------------------
  // JOB 4076 (OFFICE-WEB-ANMELDUNG) — DIE AUSGABE DES ÜBERGABECODES, UND WARUM JEDE ROLLE DARF.
  // ----------------------------------------------------------------------------------------------
  //
  // Word für das Web lädt das Klara-Seitenfenster in einem Rahmen FREMDER Herkunft; das
  // Sitzungscookie erreicht es dort nicht. Der Anmeldedialog ist dagegen top-level auf der eigenen
  // Herkunft — dort entsteht die Anmeldung, und von dort gibt DIESE Tür einen einmaligen,
  // 120 s gültigen Verweis auf die EIGENE Sitzung heraus, den das Seitenfenster einlöst.
  //
  // DAS SOLL IST `ANGEMELDET`, und das ist die tragende Aussage dieser Zeile: der Code entsteht NIE
  // ohne vorherige Anmeldung (unangemeldet 401), und er ist an KEIN Recht gebunden — auch die
  // Betrachterin darf ihre eigene Sitzung in das Word-Fenster übergeben. Eine Rollenstufe hier wäre
  // falsch: die Tür verteilt keine Befugnis, sie reicht die bestehende weiter. Was der Code danach
  // öffnet, ist genau die Sitzung, die ihn erzeugt hat, mit deren Rechten und deren Frist.
  //
  // ZUSTANDSFREI wie jede Zeile dieser Tabelle: die vier Messungen legen vier Einträge in eine
  // Ablage im Arbeitsspeicher, die nach 120 s verfällt und die niemand einlöst. Keine Sitzung wird
  // entwertet, kein Konto verändert.
  {
    gruppe: "authRoutes",
    methode: "POST",
    pfad: "/api/auth/office-handover",
    belegstelle: "services/auth/src/routes.ts:476",
    tor: "requireUser (eigener Guard des auth-Moduls, `routes.ts:312-326`)",
    payload: {},
    erwartet: ANGEMELDET,
    codes: { "401": "INVALID_CREDENTIALS" },
  },
  {
    gruppe: "captureRoutes",
    methode: "GET",
    pfad: "/api/drafts/gibt-es-nicht",
    route: "/api/drafts/:id",
    belegstelle: "services/app/src/routes/capture-routes.ts:1161",
    tor: "ko.create",
    erwartet: AB_EXPERTE,
  },
  {
    gruppe: "captureRoutes",
    methode: "GET",
    pfad: "/api/drafts/gibt-es-nicht/naechster-schritt",
    route: "/api/drafts/:id/naechster-schritt",
    belegstelle: "services/app/src/routes/capture-routes.ts:1218",
    tor: "ko.create",
    erwartet: AB_EXPERTE,
  },
  // R-1133: die Duplikatsfrage über den Entwurfsindex — dasselbe Tor wie die Nachbarzeile.
  {
    gruppe: "captureRoutes",
    methode: "GET",
    pfad: "/api/drafts/gibt-es-nicht/gleicher-inhalt",
    route: "/api/drafts/:id/gleicher-inhalt",
    belegstelle: "services/app/src/routes/capture-routes.ts:1515",
    tor: "ko.create",
    erwartet: AB_EXPERTE,
  },
  {
    gruppe: "captureRoutes",
    methode: "GET",
    pfad: "/api/drafts/trash",
    belegstelle: "services/app/src/routes/capture-routes.ts:1310",
    tor: "ko.create",
    erwartet: AB_EXPERTE,
  },
  {
    gruppe: "conflictRoutes",
    methode: "GET",
    pfad: "/api/duplicate-signal",
    belegstelle: "services/app/src/routes/conflicts-routes.ts:189",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "conflictRoutes",
    methode: "GET",
    pfad: "/api/conflicts/gibt-es-nicht",
    route: "/api/conflicts/:id",
    belegstelle: "services/app/src/routes/conflicts-routes.ts:240",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  // Aufnahme gesamt-konfliktklassifikation · R-0263: der festgelegte Vorrang am einzelnen Punkt.
  // Ein Lesetor wie die Konfliktliste; ein unbekannter Punkt bekommt eine leere Liste.
  {
    gruppe: "conflictRoutes",
    methode: "GET",
    pfad: "/api/conflicts/vorrang/gibt-es-nicht",
    route: "/api/conflicts/vorrang/:id",
    belegstelle: "services/app/src/routes/conflicts-routes.ts:254",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "externalRoutes",
    methode: "GET",
    pfad: "/api/external/search",
    belegstelle: "services/app/src/routes/external-routes.ts:61",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "i18nRoutes",
    methode: "GET",
    pfad: "/api/i18n/de/gibt-es-nicht",
    route: "/api/i18n/:locale/:key",
    belegstelle: "services/app/src/routes/i18n-routes.ts:70",
    tor: "keines — Oberflächentexte",
    erwartet: OEFFENTLICH(
      "Der Einzelabruf derselben Oberflächentexte wie `/api/i18n/locales`: die Anmeldemaske braucht sie, bevor es eine Sitzung gibt. Ausgeliefert werden Textbausteine, keine Bestandsdaten.",
    ),
  },
  {
    gruppe: "importRunRoutes",
    methode: "GET",
    pfad: "/api/admin/import/runs/gibt-es-nicht/result",
    route: "/api/admin/import/runs/:importId/result",
    belegstelle: "services/app/src/routes/import-run-routes.ts:135",
    tor: "users.manage",
    erwartet: NUR_ADMIN,
  },
  {
    gruppe: "importRunRoutes",
    methode: "GET",
    pfad: "/api/admin/import/source-records/gibt-es-nicht",
    route: "/api/admin/import/source-records/:sourceRecordId",
    belegstelle: "services/app/src/routes/import-run-routes.ts:164",
    tor: "users.manage",
    erwartet: NUR_ADMIN,
  },
  {
    gruppe: "klaraAiRoutes",
    methode: "GET",
    pfad: "/api/klara/sessions/gibt-es-nicht",
    route: "/api/klara/sessions/:sessionId",
    belegstelle: "services/app/src/routes/klara-ai-routes.ts:169",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "koRoutes",
    methode: "GET",
    pfad: "/api/wissensnetz/luecken",
    belegstelle: "services/app/src/routes/ko-routes.ts:800",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "koRoutes",
    methode: "GET",
    pfad: "/api/kos/gibt-es-nicht",
    route: "/api/kos/:id",
    belegstelle: "services/app/src/routes/ko-routes.ts:879",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "koRoutes",
    methode: "GET",
    pfad: "/api/kos/gibt-es-nicht/versions",
    route: "/api/kos/:id/versions",
    belegstelle: "services/app/src/routes/ko-routes.ts:947",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "koRoutes",
    methode: "GET",
    pfad: "/api/kos/gibt-es-nicht/evidence",
    route: "/api/kos/:id/evidence",
    belegstelle: "services/app/src/routes/ko-routes.ts:964",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "koRoutes",
    methode: "GET",
    pfad: "/api/evidence",
    belegstelle: "services/app/src/routes/ko-routes.ts:982",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "koRoutes",
    methode: "GET",
    pfad: "/api/upload-limits",
    belegstelle: "services/app/src/routes/ko-routes.ts:1675",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "lesevariantenRoutes",
    methode: "GET",
    pfad: "/api/kos/gibt-es-nicht/lesevariante/en",
    route: "/api/kos/:id/lesevariante/:lang",
    belegstelle: "services/app/src/routes/lesevarianten-routes.ts:67",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "lesevariantenRoutes",
    methode: "GET",
    pfad: "/api/library/import/candidates/gibt-es-nicht/lesevariante/en",
    route: "/api/library/import/candidates/:id/lesevariante/:lang",
    belegstelle: "services/app/src/routes/lesevarianten-routes.ts:152",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "libraryRoutes",
    methode: "GET",
    pfad: "/api/library/search",
    belegstelle: "services/app/src/routes/library-routes.ts:538",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "libraryRoutes",
    methode: "GET",
    pfad: "/api/library/images",
    belegstelle: "services/app/src/routes/library-routes.ts:587",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "libraryRoutes",
    methode: "GET",
    pfad: "/api/library/export",
    belegstelle: "services/app/src/routes/library-routes.ts:696",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "libraryRoutes",
    methode: "GET",
    pfad: "/api/library/import/candidates",
    belegstelle: "services/app/src/routes/library-routes.ts:772",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "libraryRoutes",
    methode: "GET",
    pfad: "/api/analytics",
    belegstelle: "services/app/src/routes/library-routes.ts:882",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "libraryRoutes",
    methode: "GET",
    pfad: "/api/analytics/busfactor",
    belegstelle: "services/app/src/routes/library-routes.ts:892",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "libraryRoutes",
    methode: "GET",
    pfad: "/api/graph",
    belegstelle: "services/app/src/routes/library-routes.ts:916",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "libraryRoutes",
    methode: "GET",
    pfad: "/api/kos/gibt-es-nicht/neighbors",
    route: "/api/kos/:id/neighbors",
    belegstelle: "services/app/src/routes/library-routes.ts:943",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "lifecycleRoutes",
    methode: "GET",
    pfad: "/api/lifecycle/couplings/gibt-es-nicht",
    route: "/api/lifecycle/couplings/:koId",
    belegstelle: "services/app/src/routes/lifecycle-routes.ts:49",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "lifecycleRoutes",
    methode: "GET",
    pfad: "/api/learning-paths/gibt-es-nicht",
    route: "/api/learning-paths/:role",
    belegstelle: "services/app/src/routes/lifecycle-routes.ts:125",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "lifecycleRoutes",
    methode: "GET",
    pfad: "/api/learning-paths/gibt-es-nicht/progress",
    route: "/api/learning-paths/:pathId/progress",
    belegstelle: "services/app/src/routes/lifecycle-routes.ts:157",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "objectRoutes",
    methode: "GET",
    pfad: "/api/objects/gibt-es-nicht/raw",
    route: "/api/objects/:id/raw",
    belegstelle: "services/app/src/routes/object-routes.ts:310",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "overlapRoutes",
    methode: "GET",
    pfad: "/api/duplicates/settings",
    belegstelle: "services/app/src/routes/overlap-routes.ts:77",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "overlapRoutes",
    methode: "GET",
    pfad: "/api/duplicates/gibt-es-nicht",
    route: "/api/duplicates/:id",
    belegstelle: "services/app/src/routes/overlap-routes.ts:112",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "reasonerRoutes",
    methode: "GET",
    pfad: "/api/reasoner/assist-presets",
    belegstelle: "services/app/src/routes/reasoner-routes.ts:870",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "validationRoutes",
    methode: "GET",
    pfad: "/api/validation/overview",
    belegstelle: "services/app/src/routes/validation-routes.ts:74",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
  {
    gruppe: "validationRoutes",
    methode: "GET",
    pfad: "/api/validation/settings",
    belegstelle: "services/app/src/routes/validation-routes.ts:85",
    tor: "ko.read",
    erwartet: NUR_LESEN,
  },
];
