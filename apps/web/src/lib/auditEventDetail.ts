// JOB 3140 · UX-11 — WAS EIN PROTOKOLLEINTRAG ÜBER MENSCHEN UND ROLLEN SAGEN DARF.
//
// Bis hierher rendert das Prüfprotokoll drei rohe Felder: Aktionscode, Ziel-UUID, Akteur-UUID
// (`pages/AdminSicherheitDetails.tsx:138-141`). Wer sie liest, braucht eine fremde
// Zuordnungstabelle. Diese Datei baut daraus beschriftete Zeilen — DOM-frei, i18n-frei (sie liefert
// Schlüssel, nicht Texte) und damit im Node-Tor prüfbar, genau wie `zeilenWert.ts` und
// `auditAction.ts`.
//
// DIE VIER REGELN, DIE HIER UND NIRGENDS SONST LEBEN:
//
// 0 NUR EIN KONTOFELD WIRD ALS KONTO GELESEN (JOB 3140 R2, BENs Korrekturpflicht 1). Das
//   Prüfprotokoll ist kein Kontoprotokoll: `services/knowledge-object/src/service.ts:2598` schreibt
//   `ko.created` mit `target: ko.id`, `services/conflicts/src/service.ts:98` eine Konflikt-Kennung,
//   `services/app/src/routes/external-routes.ts:52` sogar das Wort „settings". Wer jedes Ziel im
//   Kontoverzeichnis nachschlägt, findet es dort nie — und behauptet bei JEDEM Wissensobjekt eine
//   Kontolöschung, die nie stattgefunden hat (BENs gemountete Gegenprobe an Runde 1:
//   „Konto nicht mehr vorhandenko-existiert"). Dasselbe gilt für den Akteur `"system"`
//   (`services/ask/src/service.ts:1171`). Kontoziel ist deshalb NUR, was `services/auth/src/service.ts`
//   schreibt — eine ausdrückliche Liste; alles Unbekannte fällt auf die neutrale Objektzeile, die
//   gar nichts behauptet.
//
// 1 NAMEN NUR ÜBER DIE KENNUNG. Zuerst gilt der im Eintrag GESPEICHERTE Name (`actorName`/
//   `targetName`, seit Lieferung 1 dieses Auftrags) — er beschreibt den Stand von DAMALS und ist
//   unabhängig davon, ob das Konto heute noch existiert oder inzwischen umbenannt wurde. Fehlt er
//   (jeder Alteintrag), schlägt das Verzeichnis nach — über die Kennung, NIE über Position,
//   Reihenfolge oder Ähnlichkeit. Einer gelöschten Kennung den heutigen Namen einer fremden Person
//   anzukleben wäre die schlimmste Sorte Fehler, die ein Prüfprotokoll machen kann.
//
// 2 „KONTO NICHT MEHR VORHANDEN" IST EINE TATSACHENAUSSAGE (REGELN §7, Auftrag §9). Sie hängt an
//   ihrer Voraussetzung: eine ERFOLGREICH geladene Verzeichnisantwort, in der die Kennung fehlt.
//   Solange das Verzeichnis lädt, ruht oder nicht abrufbar ist, steht die schwächere Aussage da
//   („Name wird geladen" / „Name nicht abrufbar") — nie die starke.
//
// 3 FEHLENDES WIRD NICHT ERFUNDEN. Die alte Rolle wurde vor diesem Auftrag nicht gespeichert; jeder
//   Alteintrag hat sie nicht und bekommt sie nie. Dafür steht `kind: "missing"` → „nicht
//   gespeichert". Kein Strich, keine geratene Rolle, kein „viewer" als Vorgabe. Ein unbekannter
//   Rollenwert wird roh gezeigt statt auf eine bekannte Rolle gerundet.

/** Die Minimalsicht auf einen Protokolleintrag, die diese Auswertung braucht. */
export interface AuditEreignis {
  readonly action: string;
  readonly actor: string;
  readonly target: string;
  readonly payload: Record<string, unknown>;
}

/**
 * Wie belastbar ist das FEHLEN einer Kennung im geladenen Bestand?
 *
 * JOB 3140 R2 (BENs Korrekturpflicht 2): das war bis hierher ein `frisch: boolean` — und die Fläche
 * leitete ihn allein aus „Auffrischung gescheitert oder ruht" ab. Eine LAUFENDE Auffrischung ist
 * aber weder das eine noch das andere: der sichtbare Bestand ist dann ein alter Zwischenspeicher,
 * die aktuelle Antwort noch unterwegs. BENs Messung: 60 s alter, leerer Bestand + ausstehende
 * Antwort ⇒ „Konto nicht mehr vorhanden", obwohl das Konto in der gerade laufenden Antwort steht.
 * Drei Lagen, drei verschiedene Sätze:
 *
 *   frisch ...... erfolgreich abgeschlossen, nichts unterwegs → das Fehlen ist belegt.
 *   laeuftNach .. Bestand sichtbar, Auffrischung UNTERWEGS   → „Name wird geladen".
 *   veraltet .... Auffrischung gescheitert oder ruht         → „Name nicht abrufbar".
 */
export type VerzeichnisStand = "frisch" | "laeuftNach" | "veraltet";

/**
 * Der Zustand der NACHRANGIGEN Quelle „Verzeichnis" (`GET /api/directory`, `useDirectory`).
 *
 * Sie ist bewusst als Lage modelliert und nicht als „Zuordnung oder undefined": eine leere
 * Zuordnung und ein gescheiterter Abruf sehen im Ergebnis gleich aus, bedeuten aber das Gegenteil
 * voneinander (Regel 2).
 */
export type VerzeichnisLage =
  | {
      readonly art: "geladen";
      readonly namen: ReadonlyMap<string, string>;
      /**
       * Ein Bestand aus dem Zwischenspeicher bleibt IMMER sichtbar — seine Namen gelten weiter.
       * Aber die negative Aussage „Konto nicht mehr vorhanden" trägt nur der Stand `frisch`: eine
       * Kennung, die in einer alten oder noch nicht abgeschlossenen Liste fehlt, kann seither
       * angelegt worden sein (§9).
       */
      readonly stand: VerzeichnisStand;
    }
  | { readonly art: "laedt" }
  | { readonly art: "nichtAbrufbar" };

/**
 * Eine beschriftete Detailzeile.
 *
 * `kind` sagt, WAS dasteht: ein Wert (`text`), nur eine Kennung mit dem Grund, warum kein Name
 * dabeisteht (`id`), oder die ehrliche Auskunft, dass es den Wert nicht gibt (`missing`).
 * `value` ist ein wörtlicher Anzeigewert (Name, roher Rollenwert), `valueKey` ein i18n-Schlüssel
 * (Rollenname). Beide zugleich gibt es nie.
 */
export interface DetailZeile {
  readonly labelKey: string;
  readonly kind: "text" | "id" | "missing";
  readonly value?: string;
  readonly valueKey?: string;
  /** Die Kennung — sie bleibt IMMER erreichbar, auch wenn ein Name danebensteht. */
  readonly id?: string;
  /** Nur bei `kind: "id"`: warum hier kein Name steht. */
  readonly hinweisKey?: string;
}

/** Die vier gültigen Rollenwerte (`services/auth/src/routes.ts`, Rollennamen aus JOB 3124). */
const ROLLEN = new Set(["viewer", "experte", "controller", "admin"]);

/**
 * Regel 0: die Aktionen, deren `target` NACHWEISLICH eine Kontokennung ist — abschließend aus
 * `services/auth/src/service.ts` gelesen, wo jeder dieser Aufrufe `record(…, userId)` schreibt
 * (Zeilen 198, 258, 284, 342/347, 381, 393, 437, 490, 545, 581, 601, 619, 673, 688).
 *
 * Eine LISTE, kein Präfix: ein künftiges `user.*` mit anderer Zielsorte fiele sonst still in die
 * Kontoauflösung. So fällt Unbekanntes auf die neutrale Objektzeile — die Seite, die nichts
 * behauptet.
 */
const KONTO_ZIEL_AKTIONEN: ReadonlySet<string> = new Set([
  "auth.login",
  "auth.logout",
  "notice.acknowledged",
  "user.approve",
  "user.delete",
  "user.oidc-linked",
  "user.oidc-linked-unverified",
  "user.oidc-provisioned",
  "user.password-changed",
  "user.password-reset",
  "user.password-reset-email",
  "user.role-change",
  "user.role-claim-missing",
  "user.role-synced",
]);

/**
 * Der einzige Akteur, der kein Konto ist: die Maschine selbst (`services/ask/src/service.ts:1171`,
 * `:1234`, `services/conflicts/src/service.ts:613`, `overlap-service.ts:968`). Im Kontoverzeichnis
 * steht „system" nie — als Konto gelesen wäre es dauerhaft „gelöscht".
 */
const SYSTEM_AKTEUR = "system";

/** Die Antwort von `GET /api/directory` als Zuordnung über die Kennung — nie über die Position. */
export function verzeichnisNamen(
  eintraege: readonly { id: string; name: string }[] | undefined,
): ReadonlyMap<string, string> {
  return new Map((eintraege ?? []).map((e) => [e.id, e.name]));
}

/** Ein Zeichenkettenfeld aus der Nutzlast — leer oder falsch getippt zählt als nicht vorhanden. */
function textfeld(payload: Record<string, unknown>, feld: string): string | undefined {
  const wert = payload[feld];
  return typeof wert === "string" && wert.trim() !== "" ? wert : undefined;
}

/** Die Zeile zu einem beteiligten Konto (Regel 1 und 2). */
function kontoZeile(
  labelKey: string,
  id: string,
  gespeicherterName: string | undefined,
  verzeichnis: VerzeichnisLage,
): DetailZeile {
  if (gespeicherterName !== undefined) {
    // Der Stand von DAMALS schlägt jedes heutige Verzeichnis — und kennt keinen Ladezustand.
    return { labelKey, kind: "text", value: gespeicherterName, ...(id === "" ? {} : { id }) };
  }
  if (id === "") {
    return { labelKey, kind: "missing" };
  }
  if (verzeichnis.art === "laedt") {
    return { labelKey, kind: "id", id, hinweisKey: "audit.detail.nameLoading" };
  }
  if (verzeichnis.art === "nichtAbrufbar") {
    return { labelKey, kind: "id", id, hinweisKey: "audit.detail.nameUnavailable" };
  }
  const name = verzeichnis.namen.get(id);
  if (name !== undefined && name.trim() !== "") {
    return { labelKey, kind: "text", value: name, id };
  }
  if (verzeichnis.stand === "laeuftNach") {
    // Bestand sichtbar, aber die aktuelle Antwort ist noch unterwegs — sie kann die Kennung
    // mitbringen. Derselbe Satz wie beim Erstabruf: der Name wird geladen.
    return { labelKey, kind: "id", id, hinweisKey: "audit.detail.nameLoading" };
  }
  if (verzeichnis.stand === "veraltet") {
    // Bestand da, aber nicht aktuell: der Name ist unbekannt, das Konto deshalb nicht abwesend.
    return { labelKey, kind: "id", id, hinweisKey: "audit.detail.nameUnavailable" };
  }
  // Erst HIER ist die negative Aussage belegt: erfolgreich UND abgeschlossen geladen, Kennung fehlt.
  return { labelKey, kind: "id", id, hinweisKey: "audit.detail.accountGone" };
}

/**
 * Die Zeile zu einem Ziel, das KEIN Konto ist (Regel 0).
 *
 * Sie nennt die Kennung und sonst nichts — kein Nachschlagen, kein Hinweis, keine Vermutung. Was
 * das Objekt ist, sagt bereits das Ereignis daneben („Angelegt", „Konflikt eröffnet").
 */
function objektZeile(id: string): DetailZeile {
  if (id === "") {
    return { labelKey: "audit.detail.targetObject", kind: "missing" };
  }
  return { labelKey: "audit.detail.targetObject", kind: "id", id };
}

/** Die Zeile zu einer Rolle (Regel 3). */
function rollenZeile(labelKey: string, wert: string | undefined): DetailZeile {
  if (wert === undefined) {
    return { labelKey, kind: "missing" };
  }
  if (ROLLEN.has(wert)) {
    return { labelKey, kind: "text", valueKey: `role.name.${wert}` };
  }
  return { labelKey, kind: "text", value: wert };
}

/**
 * Die beschrifteten Detailzeilen eines Protokolleintrags.
 *
 * Jeder Eintrag nennt die beiden Beteiligten; ein Rollenwechsel zusätzlich die Rolle vorher und
 * nachher. Andere Aktionen bekommen ausdrücklich KEINE Rollenzeilen — eine leere „Rolle vorher"
 * bei einer Anmeldung wäre eine erfundene Frage.
 */
export function auditEventDetail(
  eintrag: AuditEreignis,
  verzeichnis: VerzeichnisLage,
): DetailZeile[] {
  const payload = eintrag.payload ?? {};
  const akteur =
    eintrag.actor === SYSTEM_AKTEUR
      ? ({
          labelKey: "audit.detail.actor",
          kind: "text",
          valueKey: "audit.detail.systemActor",
        } as const)
      : kontoZeile(
          "audit.detail.actor",
          eintrag.actor,
          textfeld(payload, "actorName"),
          verzeichnis,
        );
  const ziel = KONTO_ZIEL_AKTIONEN.has(eintrag.action)
    ? kontoZeile(
        "audit.detail.target",
        eintrag.target,
        textfeld(payload, "targetName"),
        verzeichnis,
      )
    : objektZeile(eintrag.target);
  const zeilen: DetailZeile[] = [akteur, ziel];
  if (eintrag.action === "user.role-change") {
    zeilen.push(rollenZeile("audit.detail.roleBefore", textfeld(payload, "previousRole")));
    zeilen.push(rollenZeile("audit.detail.roleAfter", textfeld(payload, "role")));
  }
  return zeilen;
}
