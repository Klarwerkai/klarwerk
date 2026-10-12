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
  /**
   * Bei `kind: "id"`: warum hier kein Name steht. Bei `kind: "text"` nur für einen Namen aus dem
   * Protokoll, dessen Konto im frisch geladenen Verzeichnis fehlt („Konto nicht mehr vorhanden").
   */
  readonly hinweisKey?: string;
  /**
   * produkt:20261009:admin-audit-verstaendlich (K3) — WOHER EIN NAME STAMMT, bei `kind: "text"`
   * mit wörtlichem Namen:
   *
   *   gespeichert .. im Eintrag selbst gespeichert (`actorName`/`targetName`) — der Stand von damals;
   *   protokoll .... von einem ANDEREN Eintrag derselben Kette gespeichert (etwa bei der Löschung);
   *   verzeichnis .. HEUTE aus dem Verzeichnis aufgelöst — der Eintrag selbst kennt keinen Namen.
   *
   * Die Fläche kennzeichnet die beiden letzten, damit ein heute aufgelöster Name nie wie ein
   * historisch gespeicherter aussieht.
   */
  readonly herkunft?: "gespeichert" | "protokoll" | "verzeichnis";
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
  // R-0582: Berichtigung von Name/E-Mail — `correctAccountData(userId, …)`.
  "user.account-corrected",
  "user.approve",
  "user.created",
  "user.delete",
  // R-0556: Anlage, Sperre und Rollenwechsel aus dem Unternehmensverzeichnis (Ziel: das Konto).
  "user.directory-sync",
  "user.oidc-linked",
  "user.oidc-linked-unverified",
  "user.oidc-provisioned",
  "user.password-changed",
  "user.password-reset",
  "user.password-reset-email",
  "user.role-change",
  "user.role-claim-missing",
  "user.role-synced",
  // produkt:20261009:admin-audit-verstaendlich: mit dem Basisstand hinzugekommen — jeder dieser
  // Aufrufe in `services/auth/src/service.ts` schreibt die Kontokennung als Ziel.
  "auth.second-factor-failed",
  "user.second-factor-enabled",
  "user.second-factor-disabled",
  "user.directory-sync",
]);

/**
 * Der einzige Akteur, der kein Konto ist: die Maschine selbst (`services/ask/src/service.ts:1171`,
 * `:1234`, `services/conflicts/src/service.ts:613`, `overlap-service.ts:968`). Im Kontoverzeichnis
 * steht „system" nie — als Konto gelesen wäre es dauerhaft „gelöscht".
 */
const SYSTEM_AKTEUR = "system";

/**
 * produkt:20261009:admin-audit-verstaendlich (K1): ein Dienstschlüssel handelt als Akteur
 * `dienst:<id>` (`services/app/src/dienst-schluessel.ts`). Er ist kein Konto und steht deshalb nie im
 * Verzeichnis — als Konto gelesen hieße er dauerhaft „Konto nicht mehr vorhanden", was nie stimmt.
 */
const DIENST_PRAEFIX = "dienst:";

/** Die Antwort von `GET /api/directory` als Zuordnung über die Kennung — nie über die Position. */
export function verzeichnisNamen(
  eintraege: readonly { id: string; name: string }[] | undefined,
): ReadonlyMap<string, string> {
  return new Map((eintraege ?? []).map((e) => [e.id, e.name]));
}

/**
 * Verwalteransicht (N-0027, „gelöschte Konten weiterhin benennen"): die Namen, die das Protokoll
 * SELBST über Konten gespeichert hat — `actorName` zum Akteur, `targetName` zum Kontoziel.
 *
 * Ein gelöschtes Konto steht in keinem Verzeichnis mehr. Seit `user.delete` und `user.role-change`
 * den Namen von damals mitschreiben, kennt die Kette ihn aber — und damit lässt sich auch eine
 * frühere Anmeldung desselben Kontos benennen. Zugeordnet wird ausschließlich über die Kennung
 * (Regel 1); bei mehreren Einträgen gilt der jüngste.
 */
export function protokollNamen(
  eintraege: readonly AuditEreignis[] | undefined,
): ReadonlyMap<string, string> {
  const namen = new Map<string, string>();
  for (const e of eintraege ?? []) {
    const payload = e.payload ?? {};
    const akteurName = textfeld(payload, "actorName");
    if (akteurName !== undefined && e.actor !== "" && e.actor !== SYSTEM_AKTEUR) {
      namen.set(e.actor, akteurName);
    }
    const zielName = textfeld(payload, "targetName");
    if (zielName !== undefined && e.target !== "" && KONTO_ZIEL_AKTIONEN.has(e.action)) {
      namen.set(e.target, zielName);
    }
  }
  return namen;
}

/**
 * produkt:20261009:admin-audit-verstaendlich (K1, Bens Befund Nacharbeit 3) — WELCHE KENNUNGEN
 * NACHWEISLICH KONTEN WAREN.
 *
 * Das Fehlen im heutigen Verzeichnis allein belegt keine frühere Kontoexistenz. Ein Kontobeleg ist
 * ein Eintrag des Kontodienstes mit dieser Kennung als ZIEL (`KONTO_ZIEL_AKTIONEN`: Anlage,
 * Anmeldung, Rollenwechsel, Löschung …) oder ein Name, den die Kette zu ihr als Konto gespeichert
 * hat. Nur mit einem solchen Beleg sagt die Fläche „Konto nicht mehr vorhanden"; ohne ihn heißt die
 * Kennung „unbekannte Kennung" (`auditprotokoll.detail.unbekannt`). Bloßes Auftreten als Akteur
 * zählt NICHT — daraus folgt nicht, welche Art Identität dahinterstand.
 */
export function kontoBelege(eintraege: readonly AuditEreignis[] | undefined): ReadonlySet<string> {
  const belegt = new Set<string>();
  for (const e of eintraege ?? []) {
    if (e.target !== "" && KONTO_ZIEL_AKTIONEN.has(e.action)) {
      belegt.add(e.target);
    }
    if (
      e.actor !== "" &&
      e.actor !== SYSTEM_AKTEUR &&
      textfeld(e.payload ?? {}, "actorName") !== undefined
    ) {
      belegt.add(e.actor);
    }
  }
  return belegt;
}

/**
 * produkt:20261009:admin-audit-verstaendlich (K1): Namen, die zu MEHR ALS EINER Kennung gehören —
 * aus dem Verzeichnis und aus den von der Kette gespeicherten Namen zusammen. Steht ein solcher Name
 * in einer Spalte, zeigt die Fläche eine Kurzkennung daneben, damit zwei „Anna Meier“ unterscheidbar
 * bleiben. Zugeordnet wird auch hier nur über die Kennung.
 */
export function mehrdeutigeNamen(
  ...quellen: readonly ReadonlyMap<string, string>[]
): ReadonlySet<string> {
  const kennungenJeName = new Map<string, Set<string>>();
  for (const quelle of quellen) {
    for (const [id, name] of quelle) {
      const schluessel = name.trim();
      if (schluessel === "") {
        continue;
      }
      const ids = kennungenJeName.get(schluessel) ?? new Set<string>();
      ids.add(id);
      kennungenJeName.set(schluessel, ids);
    }
  }
  return new Set([...kennungenJeName].filter(([, ids]) => ids.size > 1).map(([name]) => name));
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
  protokoll: ReadonlyMap<string, string>,
  istKonto: boolean,
): DetailZeile {
  if (gespeicherterName !== undefined) {
    // Der Stand von DAMALS schlägt jedes heutige Verzeichnis — und kennt keinen Ladezustand.
    return {
      labelKey,
      kind: "text",
      value: gespeicherterName,
      herkunft: "gespeichert",
      ...(id === "" ? {} : { id }),
    };
  }
  if (id === "") {
    return { labelKey, kind: "missing" };
  }
  const heutigerName = verzeichnis.art === "geladen" ? verzeichnis.namen.get(id) : undefined;
  const protokollName = protokoll.get(id);
  if (protokollName !== undefined && (heutigerName === undefined || heutigerName.trim() === "")) {
    // Das heutige Verzeichnis kennt die Kennung nicht (oder ist noch nicht da) — ein anderer
    // Eintrag der Kette hat den Namen aber gespeichert. Die Löschaussage bleibt an Regel 2
    // gebunden: nur bei erfolgreich und abgeschlossen geladenem Verzeichnis.
    const belegtWeg = verzeichnis.art === "geladen" && verzeichnis.stand === "frisch";
    return {
      labelKey,
      kind: "text",
      value: protokollName,
      id,
      herkunft: "protokoll",
      ...(belegtWeg ? { hinweisKey: "audit.detail.accountGone" } : {}),
    };
  }
  if (verzeichnis.art === "laedt") {
    return { labelKey, kind: "id", id, hinweisKey: "audit.detail.nameLoading" };
  }
  if (verzeichnis.art === "nichtAbrufbar") {
    return { labelKey, kind: "id", id, hinweisKey: "audit.detail.nameUnavailable" };
  }
  const name = verzeichnis.namen.get(id);
  if (name !== undefined && name.trim() !== "") {
    // K3: der HEUTIGE Name — der Eintrag selbst hat keinen gespeichert. Die Herkunft reist mit.
    return { labelKey, kind: "text", value: name, id, herkunft: "verzeichnis" };
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
  // Erfolgreich UND abgeschlossen geladen, Kennung fehlt. „Konto nicht mehr vorhanden" nur mit
  // Kontobeleg (Bens Befund Nacharbeit 3) — sonst ist die Identität schlicht unbekannt.
  if (!istKonto) {
    return { labelKey, kind: "id", id, hinweisKey: "auditprotokoll.detail.unbekannt" };
  }
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
  protokoll: ReadonlyMap<string, string> = new Map(),
  belege: ReadonlySet<string> = new Set(),
): DetailZeile[] {
  const payload = eintrag.payload ?? {};
  // Kontobelege: aus der Kette (`kontoBelege` über Seite und Namensbelege), aus gespeicherten
  // Namen — und aus diesem Eintrag selbst (ein Kontovorgang belegt sein Ziel als Konto).
  const ausEintrag = kontoBelege([eintrag]);
  const istKonto = (id: string): boolean =>
    belege.has(id) || protokoll.has(id) || ausEintrag.has(id);
  const akteur: DetailZeile =
    eintrag.actor === SYSTEM_AKTEUR
      ? {
          labelKey: "audit.detail.actor",
          kind: "text",
          valueKey: "audit.detail.systemActor",
        }
      : eintrag.actor.startsWith(DIENST_PRAEFIX)
        ? {
            labelKey: "audit.detail.actor",
            kind: "text",
            valueKey: "auditprotokoll.akteur.dienst",
            id: eintrag.actor,
          }
        : kontoZeile(
            "audit.detail.actor",
            eintrag.actor,
            textfeld(payload, "actorName"),
            verzeichnis,
            protokoll,
            istKonto(eintrag.actor),
          );
  const ziel = KONTO_ZIEL_AKTIONEN.has(eintrag.action)
    ? kontoZeile(
        "audit.detail.target",
        eintrag.target,
        textfeld(payload, "targetName"),
        verzeichnis,
        protokoll,
        istKonto(eintrag.target),
      )
    : objektZeile(eintrag.target);
  const zeilen: DetailZeile[] = [akteur, ziel];
  if (eintrag.action === "user.role-change") {
    zeilen.push(rollenZeile("audit.detail.roleBefore", textfeld(payload, "previousRole")));
    zeilen.push(rollenZeile("audit.detail.roleAfter", textfeld(payload, "role")));
  }
  return zeilen;
}
