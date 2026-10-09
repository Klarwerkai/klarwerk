// JOB 3065 H6 — DIE DETAILKARTEN DES REITERS „KONTEN".
//
// Ein Nutzer (Freigeben · Rolle · Passwort zurücksetzen · Löschen), das Anlegen, die Rollen-Vorschau
// („Ansicht als Rolle", vorher in der Seitenleiste) und je Rolle die Karte ihrer Freiheiten.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, UserPlus } from "lucide-react";
import { useEffect, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useAudit, useUsers } from "../api/hooks";
import type { AuditEntry, PublicUser, UebergabeVorschau } from "../api/types";
import { verantwortungApi } from "../api/verantwortung";
import { useRole } from "../app/RoleContext";
import { useToast } from "../app/ToastContext";
import { NAV_GROUPS, ROLES, type Role, roleAllows } from "../app/navigation";
// JOB 3670: die Seitenhilfe dieser vier Karten. `HelpTip` rendert nichts, er meldet Titel und Text
// beim Sammler an (`shell/SeitenhilfeContext.tsx`); gelesen wird im Zahnrad unter „Seitenhilfe".
// JE KARTE EIN EIGENER TEXT: die vier Karten sind vier Bildschirme, und ein gemeinsamer Satz an der
// Dateiwurzel stünde auf allen vieren gleich und erklärte keine.
import { HelpTip } from "../components/HelpTip";
import { VerantwortungUebergabe } from "../components/VerantwortungUebergabe";
import { VermaechtnisBuch } from "../components/VermaechtnisBuch";
import { UebergabeVorschauInhalt, Wissensuebergabe } from "../components/Wissensuebergabe";
import { Abfragehuelle } from "../components/einstellungen/Abfragehuelle";
import { Detailkarte } from "../components/einstellungen/Detailkarte";
import { freiheitenSchluessel, kiWahlFrei } from "../components/einstellungen/rollenFreiheiten";
import { Button, Field, TextInput } from "../components/ui";
import { isPasswordResetValid, newUserIssues, passwordRepeatMismatch } from "../lib/adminForms";
import { auditActionLabel } from "../lib/auditAction";
import { kontoZugang, rollenwirkung } from "../lib/nutzerliste";

const EMPTY_NEW_USER = { name: "", email: "", password: "", role: "experte" as Role };

// ================================================================================================
// JOB 4021 (ERSTEINRICHTUNG-GAST T2) — DIE BEFRISTUNG EINES ZUGANGS, ÜBERSETZT IN BEIDE RICHTUNGEN.
// ================================================================================================
//
// Der Server führt einen ZEITPUNKT (`services/auth/src/types.ts:51`, ISO-8601), der Admin denkt in
// TAGEN („bis Ende Oktober"). Die beiden Helfer darunter sind die einzige Stelle, an der zwischen
// den beiden umgerechnet wird — und sie sind zueinander invers, damit „setzen, anschauen, wieder
// öffnen" denselben Tag zeigt und nicht den davor oder danach.
//
// DER GEWÄHLTE TAG GEHÖRT NOCH DAZU. „Gültig bis 31.10." heisst, dass am 31.10. noch gearbeitet
// werden kann; gesendet wird deshalb der LETZTE AUGENBLICK dieses Tages, nicht sein Beginn. Und
// zwar in der Zeitzone des Admins: nähme man 23:59:59.999 UTC, läge der Zeitpunkt östlich von
// Greenwich schon am Folgetag, und die Karte zeigte nach dem Speichern einen anderen Tag an, als
// der Admin gewählt hat.

/** Der lokale Kalendertag eines Zeitpunkts in der Form des Datumsfeldes (`YYYY-MM-DD`). */
function tagDesZeitpunkts(wert: string | undefined): string {
  const zeitpunkt = lesbarerAblauf(wert);
  if (zeitpunkt === undefined) {
    return "";
  }
  const d = new Date(zeitpunkt);
  const zwei = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
}

/**
 * Der letzte Augenblick des gewählten Tages als ISO-Zeitpunkt — oder `null`, wenn dort kein Tag
 * steht, den es im Kalender gibt.
 *
 * DER ÜBERLAUF IST DER GRUND FÜR DIE ZWEITE PRÜFUNG: `new Date(2026, 1, 30, …)` ist kein `NaN`,
 * sondern der 2. März. Ohne die Nachrechnung ginge aus einem „30.02." ein PUT hinaus, das einen
 * ANDEREN Tag trägt als den gewählten — und die Karte zeigte danach ein Datum, das niemand gesetzt
 * hat. Eine regelkonforme Datumseingabe erzeugt einen solchen Wert nicht (sie bereinigt ihn selbst
 * zu ""), gemessen in `tests/gast-befristung-flaeche/…:„ein unmöglicher Tag verlässt die Karte gar
 * nicht erst als anderer Tag" — das hier ist also ein WÄCHTER und keine Bedienstufe: der Rückweg
 * ist derselbe wie beim leeren Feld, und es entsteht keine eigene Meldung für einen Zustand, den
 * der Admin nicht herstellen kann.
 *
 * ADMIN-04: exportiert für die Sammelbefristung (`components/Sammelbearbeitung.tsx`) — derselbe Tag,
 * dieselbe Umrechnung, kein zweiter Helfer.
 */
export function endeDesTages(tag: string): string | null {
  const form = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tag);
  if (form === null) {
    return null;
  }
  const jahr = Number(form[1]);
  const monat = Number(form[2]);
  const tagZahl = Number(form[3]);
  const d = new Date(jahr, monat - 1, tagZahl, 23, 59, 59, 999);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  if (d.getFullYear() !== jahr || d.getMonth() !== monat - 1 || d.getDate() !== tagZahl) {
    return null;
  }
  return d.toISOString();
}

/** Die Form, die der Server für einen Ablaufwert verlangt (`services/auth/src/service.ts:50-51`). */
const ISO_ZEITSTEMPEL =
  /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * Der Zeitpunkt eines Ablaufwertes — oder `undefined`, wenn der Wert keine lesbare Aussage ist.
 *
 * DERSELBE VERTRAG WIE IM DIENST (`services/auth/src/service.ts:52-67`, `ablaufZeitpunkt`), und er
 * ist bewusst abgeschrieben statt importiert: `apps/web` darf nicht in `services/auth` greifen
 * (Modulgrenzen, `.dependency-cruiser.cjs`). Er steht hier, damit die Karte nichts als Datum
 * ausgibt, woraus der Server gar keinen Ablauf ableitet — der Server sperrt mit einem unlesbaren
 * Wert NIEMANDEN aus, er vermerkt ihn nur (`service.ts:317-322`).
 *
 * ZWEI PRÜFUNGEN, ZWEI VERSCHIEDENE FEHLER:
 *   · Die FORM. `Date.parse` allein nimmt „09/12/2026" an und legt dabei selbst fest, welcher Tag
 *     gemeint ist; der Server nimmt es nicht (`service.ts:422-428`).
 *   · Der KALENDERTAG. `Date.parse("2026-02-30T12:00:00.000Z")` liefert KEIN `NaN`, sondern rechnet
 *     still auf den 2. März um. Runde 1 zeigte dafür „Abgelaufen am 2.3.2026" — ein Tag, der
 *     nirgends geschrieben steht, und eine Sperre, die der Server gar nicht durchsetzt
 *     (BEN-Korrekturpflicht 2 aus dieser Runde). `setUTCFullYear` statt `Date.UTC`, weil letzteres
 *     zweistellige Jahre ins 20. Jahrhundert legt — genau wie im Dienst.
 *
 * JOB 4103 R2: EXPORTIERT, weil die KONTENLISTE (`pages/Admin.tsx`) dieselbe Frage stellt — „ist
 * dieser Wert lesbar, und welcher Zeitpunkt ist es?". Sie bekommt die Antwort von HIER und rechnet
 * nicht selbst: zwei Auswertungen desselben Drahtfeldes wären zwei Wahrheiten, und die Liste zeigte
 * eines Tages einen Tag, den die Karte daneben nicht kennt (genau der Fehler, den F10 an der Karte
 * misst). Die WORTWAHL bleibt getrennt — die Karte urteilt über Gültigkeit, die Liste nennt die
 * Befristung; gemeinsam ist nur die Lesbarkeitsregel.
 */
export function lesbarerAblauf(wert: string | undefined): number | undefined {
  if (wert === undefined) {
    return undefined;
  }
  const form = ISO_ZEITSTEMPEL.exec(wert);
  if (form === null) {
    return undefined;
  }
  const zeitpunkt = Date.parse(wert);
  if (Number.isNaN(zeitpunkt)) {
    return undefined;
  }
  const jahr = Number(form[1]);
  const monat = Number(form[2]);
  const tag = Number(form[3]);
  const probe = new Date(0);
  probe.setUTCFullYear(jahr, monat - 1, tag);
  if (
    probe.getUTCFullYear() !== jahr ||
    probe.getUTCMonth() !== monat - 1 ||
    probe.getUTCDate() !== tag
  ) {
    return undefined;
  }
  return zeitpunkt;
}

/**
 * Hat der SERVER diese Befristung abgewiesen — oder ist der Ausgang offen geblieben?
 *
 * BEN-Korrekturpflicht 1 dieser Runde. Runde 1 hängte an JEDEN gescheiterten Schreibversuch den
 * Satz „Nichts wurde geändert." Gemessen wurde das Gegenteil: der Testserver SCHRIEB die
 * Befristung, erst die Antwort ging auf dem Rückweg verloren — und die Karte behauptete danach
 * unveränderte Daten, für die sie keinen Beleg hatte. Eine fehlende Bestätigung ist keine
 * Bestätigung des Gegenteils.
 *
 * Belegt ist „nichts geändert" nur bei einer ABLEHNUNG des Servers (4xx): der Dienst prüft die
 * Form VOR dem Schreiben (`services/auth/src/service.ts:422-428`), und die Route führt die
 * Befristung als letzten Schritt aus (`routes.ts:836-842`). Alles andere — eine verlorene Antwort,
 * ein abgebrochener Abruf, ein 5xx aus dem Innern — sagt über den Ausgang NICHTS. Dann steht der
 * offene Ausgang da, und der Stand kommt neu vom Server statt aus einer Behauptung.
 */
export function serverHatAbgewiesen(e: unknown): boolean {
  return e instanceof ApiError && e.status >= 400 && e.status < 500;
}

/**
 * Wie weit ein `setTimeout` gestellt werden darf, ohne sofort loszugehen.
 *
 * Über 2^31−1 ms läuft die Frist im Browser über und der Wecker feuert augenblicklich — aus einem
 * Wecker in drei Monaten würde eine Endlosschleife. Längere Fristen bekommen deshalb einen
 * Zwischenwecker, der beim Feuern den nächsten stellt (s. Effekt in `NutzerDetail`).
 */
const WECKER_MAX_MS = 2_000_000_000;

/** Ein Konto: alles, was der Admin an diesem Nutzer tun darf. */
export function NutzerDetail({
  nutzerId,
  onZurueck,
}: {
  nutzerId: string;
  onZurueck: () => void;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { push } = useToast();
  const users = useUsers();
  const nutzer = users.data?.find((u) => u.id === nutzerId);
  const invalidate = (): void => void qc.invalidateQueries({ queryKey: ["users"] });
  const fail = (e: unknown): void =>
    push("error", e instanceof ApiError ? e.message : t("state.error"));

  // ADMIN-04: nach jeder Kontoänderung kommen auch Protokoll und Zugangsstand neu vom Server.
  const invalidateBelege = (): void => {
    void qc.invalidateQueries({ queryKey: ["audit"] });
    void qc.invalidateQueries({ queryKey: ["verantwortung"] });
  };
  const approve = useMutation({
    mutationFn: (id: string) => endpoints.users.approve(id),
    onSuccess: () => {
      invalidate();
      invalidateBelege();
    },
    onError: fail,
  });
  // ================================================================================================
  // ADMIN-04 · DIE ROLLE WIRD ERST NACH SICHTBARER WIRKUNG GEÄNDERT — und bestätigt vom Server.
  // ================================================================================================
  // Bis hierher schrieb schon das Wählen im Auswahlfeld (`onChange` → PUT). Jetzt wählt das Feld
  // nur VOR; darunter steht, welche Fähigkeiten hinzukommen und wegfallen (`rollenwirkung`, aus
  // dem bestehenden Rollenmodell). Erst „Rolle übernehmen" sendet. Die Bestätigung nennt die Rolle
  // aus der ANTWORT des Servers; der Bestand wird damit überschrieben und danach neu geholt —
  // nach einem Neuladen steht dieselbe Rolle da, und das Prüfprotokoll unten trägt den Vermerk.
  const [rolleWahl, setRolleWahl] = useState<Role | null>(null);
  const [rolleStand, setRolleStand] = useState<
    | { art: "ok"; rolle: Role | null }
    | { art: "fehler"; meldung: string; abgewiesen: boolean }
    | null
  >(null);
  const setRole = useMutation({
    mutationFn: (v: { id: string; role: Role }) => endpoints.users.setRole(v.id, v.role),
    onSuccess: (stand) => {
      if (stand?.id) {
        qc.setQueryData<PublicUser[]>(["users"], (alt) =>
          alt?.map((u) => (u.id === stand.id ? stand : u)),
        );
      }
      invalidate();
      invalidateBelege();
      setRolleWahl(null);
      setRolleStand({ art: "ok", rolle: stand?.role ?? null });
    },
    onError: (e) => {
      const abgewiesen = serverHatAbgewiesen(e);
      setRolleStand({
        art: "fehler",
        meldung: e instanceof ApiError ? e.message : t("state.error"),
        abgewiesen,
      });
      if (!abgewiesen) {
        invalidate();
      }
      fail(e);
    },
  });
  // ADMIN-04: die Verantwortung dieses Kontos — dieselbe Abfrage wie an der Listenzeile.
  const verantwortung = useQuery({
    queryKey: ["verantwortung", "uebersicht"],
    queryFn: verantwortungApi.uebersicht,
  });
  const meineVerantwortung = verantwortung.data?.personen?.find((p) => p.id === nutzerId);
  const [beitraegeOffen, setBeitraegeOffen] = useState(false);
  const [vorgaengeOffen, setVorgaengeOffen] = useState(false);
  const vorgaenge = useQuery({
    queryKey: ["verantwortung", "vorgaenge", nutzerId],
    queryFn: () => verantwortungApi.vorgaenge(nutzerId),
    enabled: vorgaengeOffen,
  });
  // ADMIN-04: die Vermerke DIESES Kontos aus dem Prüfprotokoll — der Beleg, dass eine Änderung so
  // gespeichert wurde, wie die Karte sie bestätigt.
  const audit = useAudit();
  // R-0554: entfernt mit Nachfolger, läuft vorher serverseitig die Wissensübergabe.
  const remove = useMutation({
    mutationFn: (v: { id: string; nachfolger: string }) =>
      endpoints.users.remove(v.id, v.nachfolger || undefined),
    onSuccess: () => {
      invalidate();
      onZurueck();
    },
    onError: fail,
  });
  const reset = useMutation({
    mutationFn: (v: { id: string; password: string }) =>
      endpoints.users.resetPassword(v.id, v.password),
    onSuccess: () => {
      setResetOffen(false);
      setResetPw("");
      setResetPw2("");
      push("success", t("adm.resetDone"));
    },
    onError: fail,
  });
  const zweiFaktorEntfernen = useMutation({
    mutationFn: (id: string) => endpoints.users.resetSecondFactor(id),
    onSuccess: () => push("success", t("zweifaktor.admin.entfernt")),
    onError: fail,
  });
  /**
   * JOB 4021: Befristung setzen, verlängern und beenden — EIN Weg, EIN Aufruf.
   *
   * Der neue Stand kommt aus der ANTWORT (`routes.ts:843-847`) und wird in den Bestand geschrieben,
   * bevor die Auffrischung läuft. Anders wäre zwischen „gespeichert" und dem nachgeholten Abruf ein
   * Fenster, in dem die Karte den Stand von VORHER zeigt und dabei Erfolg meldet — genau die
   * Halbheit, gegen die die Route ihren Schreibvorgang eigens zuletzt ausführt. `invalidate()`
   * bleibt trotzdem: die Antwort ist der Anfang der Wahrheit, die Bestätigung kommt vom Server.
   */
  const befristen = useMutation({
    mutationFn: (v: { id: string; bis: string | null }) =>
      endpoints.users.setAccessExpiry(v.id, v.bis),
    onSuccess: (stand, v) => {
      qc.setQueryData<PublicUser[]>(["users"], (alt) =>
        alt?.map((u) => (u.id === stand.id ? stand : u)),
      );
      invalidate();
      invalidateBelege();
      setFristOffen(false);
      setFristHilfe(null);
      push("success", v.bis === null ? t("adm.gastfrist.beendet") : t("adm.gastfrist.gespeichert"));
    },
    onError: (e) => {
      // Der Satz des SERVERS, nicht ein eigener erfundener (`routes.ts:805-812` antwortet auf ein
      // unlesbares Datum mit 403). Daneben steht der nächste Schritt — ein Fehler, der nur
      // aufblitzt, lässt den Admin im Unklaren darüber, was jetzt gilt.
      //
      // WELCHER nächste Schritt, entscheidet der Beleg (s. `serverHatAbgewiesen`): hat der Server
      // abgelehnt, steht fest, dass nichts geändert wurde. Blieb der Ausgang offen, wird das
      // gesagt — und der Stand wird geholt, statt ihn zu behaupten. Die Auffrischung ist hier der
      // ehrlichere Teil der Antwort: sie ersetzt eine Vermutung durch eine Auskunft, und scheitert
      // auch sie, markiert die `Abfragehuelle` den Stand als nicht aktualisiert.
      const abgewiesen = serverHatAbgewiesen(e);
      setFristHilfe({ meldung: e instanceof ApiError ? e.message : t("state.error"), abgewiesen });
      if (!abgewiesen) {
        invalidate();
      }
      fail(e);
    },
  });

  const [resetOffen, setResetOffen] = useState(false);
  const [resetPw, setResetPw] = useState("");
  // SCRUM-455: Wiederholung des neuen Passworts (Vertipper-Schutz).
  const [resetPw2, setResetPw2] = useState("");
  // JOB 3065: Löschen bekommt die Rückfrage, die es auf der alten Kartenwand nie hatte (mega45:
  // genau EIN Knopf trägt die Warnfarbe, keiner die neutrale Vorgabe).
  const [confirmRemove, setConfirmRemove] = useState(false);
  // R-0554: wer das Wissen beim Entfernen übernimmt — leer heisst „ohne Übergabe" (wie bisher).
  const [nachfolgerBeimEntfernen, setNachfolgerBeimEntfernen] = useState("");
  // R-0554 · BEN (Nacharbeit 3): die Vorschau GENAU dieses Paars (Konto → Nachfolger). Sie gilt nur,
  // solange derselbe Nachfolger gewählt ist; ein Wechsel verwirft sie (onChange der Auswahl).
  const [entfernenVorschau, setEntfernenVorschau] = useState<UebergabeVorschau | null>(null);
  const entfernenVorschauHolen = useMutation({
    mutationFn: (an: string) => endpoints.lifecycle.uebergabeVorschau(nutzerId, an),
    onSuccess: (v) => setEntfernenVorschau(v),
    onError: fail,
  });
  const vorschauPasst =
    entfernenVorschau !== null &&
    nachfolgerBeimEntfernen !== "" &&
    entfernenVorschau.von === nutzerId &&
    entfernenVorschau.an === nachfolgerBeimEntfernen;
  // Mit Nachfolger, aber ohne passende Vorschau: „Ja, entfernen" bleibt gesperrt.
  const vorschauFehlt = nachfolgerBeimEntfernen !== "" && !vorschauPasst;
  // JOB 4021: die Datumseingabe der Befristung. Sie steht ZU, bis der Admin sie öffnet — ein leeres
  // Feld ist keine Aussage über den Zugang (Auftrag §9), und eine Vorgabedauer („+30 Tage") gibt es
  // ausdrücklich nicht: „kein Ablauf" ist der gültige Normalzustand.
  const [fristOffen, setFristOffen] = useState(false);
  const [fristTag, setFristTag] = useState("");
  /**
   * Die Auskunft zum zuletzt gescheiterten Schreibversuch — sie bleibt stehen, der Toast nicht.
   *
   * `abgewiesen` trägt den BELEG mit: nur eine Ablehnung des Servers rechtfertigt den Satz „Nichts
   * wurde geändert." Ohne dieses Feld gäbe es nur den einen Satz, und er wäre in der Hälfte der
   * Fälle eine Tatsachenaussage über fremde Daten ohne Grundlage.
   */
  const [fristHilfe, setFristHilfe] = useState<{ meldung: string; abgewiesen: boolean } | null>(
    null,
  );

  // ================================================================================================
  // JOB 4021 · DER ABLAUF TRITT EIN, WÄHREND DIE KARTE OFFEN STEHT — UND DIE UHR, DIE DARÜBER URTEILT.
  // ================================================================================================
  // ZWEI BEFUNDE AUS ZWEI RUNDEN, UND SIE SIND DIE BEIDEN HÄLFTEN EINER SACHE. Keine der beiden
  // Hälften genügt allein; deshalb stehen sie hier nebeneinander:
  //
  //   Runde 1 (BEN) · Der Vergleich las `Date.now()` nur BEIM RENDERN — und ohne Anlass rendert
  //     React nicht neu. Eine geöffnete Karte, deren Ablaufzeitpunkt verstrich, zeigte unverändert
  //     „Gültig bis …" und behauptete eine Gültigkeit, die der Server in derselben Sekunde nicht
  //     mehr gewährt (`services/auth/src/service.ts:288`, `<=`). FEHLTE: der Anlass.
  //   Runde 2 (BEN) · Die Reparatur fror dafür die Uhrzeit des Kartenaufschlags in einem Zustand ein
  //     und maß ALLES gegen sie. Solange der Ablaufwert von Anfang an dastand, ging das gut. Trifft
  //     er SPÄTER ein (Auffrischung, Nachladen, zweite Antwort), lag er auch dann noch „in der
  //     Zukunft", wenn er längst vorbei war — und die Restfrist wurde um die bisherige Verweildauer
  //     zu lang gerechnet. FEHLTE: die laufende Uhr.
  //
  // Also beides, und jedes für das, was nur es kann:
  //   · Die AUSSAGE liest die Uhr in dem Augenblick, in dem sie entsteht (`abgelaufen` unten). Damit
  //     ist sie in JEDEM Rendern wahr — gleich, woher der Wert kam und wie lange die Karte schon
  //     offen steht. Eine gespeicherte Uhrzeit kann das nicht, denn sie altert.
  //   · Der WECKER erzeugt nur den ANLASS, neu zu zeichnen, und er rechnet seine Frist ebenfalls
  //     gegen die laufende Uhr (`fristZeitpunkt - Date.now()`, nicht gegen den Aufschlag). Er steht
  //     auf dem ZEITPUNKT, nicht auf einem Takt: ein Sekundentakt würde die Karte 86400-mal am Tag
  //     neu zeichnen, um einmal etwas zu ändern.
  //   · Fristen jenseits von `WECKER_MAX_MS` bekommen einen Zwischenwecker, der beim Feuern selbst
  //     den nächsten stellt (`stellen` ruft sich wieder auf) — deshalb hängt der Haken nur an
  //     `fristZeitpunkt` und braucht keinen Zählerstand in seiner Abhängigkeitsliste.
  //
  // Gemessen: F11 (Übergang bei offener Karte) und F13 (später eingetroffener Wert) in
  // `tests/gast-befristung-flaeche/befristung-ist-bedienbar.test.tsx`.
  //
  // Beides steht VOR dem frühen Ausstieg für „Konto gibt es nicht", weil Haken dort stehen müssen;
  // fehlt der Nutzer, ist `fristZeitpunkt` schlicht `undefined` und es wird kein Wecker gestellt.
  const [, neuZeichnen] = useReducer((n: number) => n + 1, 0);
  const fristWert = nutzer?.accessExpiresAt;
  const fristZeitpunkt = lesbarerAblauf(fristWert);
  const abgelaufen = fristZeitpunkt !== undefined && fristZeitpunkt <= Date.now();
  useEffect(() => {
    if (fristZeitpunkt === undefined) {
      return undefined;
    }
    let wecker: ReturnType<typeof setTimeout> | undefined;
    const stellen = (): void => {
      const rest = fristZeitpunkt - Date.now();
      if (rest <= 0) {
        return;
      }
      wecker = setTimeout(
        () => {
          neuZeichnen();
          stellen();
        },
        Math.min(rest, WECKER_MAX_MS),
      );
    };
    stellen();
    return () => {
      if (wecker !== undefined) {
        clearTimeout(wecker);
      }
    };
  }, [fristZeitpunkt]);

  /**
   * JOB 3670: die Seitenhilfe DIESER Karte — und sie steht in BEIDEN Zweigen.
   *
   * Sie beschreibt den Bildschirm, nicht seinen Inhalt: welche Handgriffe hier wohnen und was sie
   * bewirken. Das gilt auch, solange die Kontenliste noch lädt oder ihr Abruf gescheitert ist —
   * hinge sie am geladenen Nutzer, stünde im Zahnrad genau dann die Leermeldung, wenn jemand
   * wissen will, wo er gelandet ist. Ein Bauteil, zwei Ausgänge; keine zweite Fassung.
   */
  const seitenhilfe = (
    <HelpTip
      title={t("seitenhilfe.admin.nutzer.titel")}
      body={t("seitenhilfe.admin.nutzer.text")}
    />
  );

  // JOB 3065 R2: „Dieses Konto gibt es nicht mehr" ist eine Tatsachenaussage. Sie darf NUR aus
  // einer erfolgreichen Antwort entstehen, in der das Konto fehlt — nicht daraus, dass die Liste
  // gerade lädt oder ihr Abruf gescheitert ist (dieselbe Klasse wie LEHREN 3002/3027).
  if (!nutzer) {
    return (
      <Detailkarte titel={t("adm.sec.konten")} onZurueck={onZurueck} testId="detail-nutzer">
        {seitenhilfe}
        <Abfragehuelle abfrage={users}>
          {() => <p className="text-[12.5px] text-muted-2">{t("einst.konten.nutzerWeg")}</p>}
        </Abfragehuelle>
      </Detailkarte>
    );
  }

  // JOB 4021: DIE EINE AUSSAGE ZUR BEFRISTUNG — je Zustand genau eine, und keine davon geraten.
  //
  //   Feld fehlt ......... „unbefristet". Das ist die BELEGTE Bedeutung des fehlenden Feldes
  //                        (`services/auth/src/types.ts:42-45`), keine Annahme.
  //   Wert unlesbar ...... gesagt wird genau das — und dass er niemanden aussperrt
  //                        (`services/auth/src/service.ts:317-322`). Weder ein Datum noch
  //                        „unbefristet" wäre hier wahr.
  //   Zeitpunkt erreicht . „abgelaufen". `<=` wie im Dienst (`service.ts:288`): der Ablaufzeitpunkt
  //                        selbst gilt schon als abgelaufen. Ein Datum in der Vergangenheit ist
  //                        keine Gültigkeit — und der Übergang dorthin passiert auch bei OFFENER
  //                        Karte, dafür steht der Wecker oben.
  //   sonst .............. „gültig bis <Datum>".
  //
  // Der Ladezustand kommt NICHT hierher: solange der Bestand lädt oder sein Abruf gescheitert ist,
  // rendert die `Abfragehuelle` unten gar keinen Inhalt — dann steht hier auch keine Aussage.
  // (`fristWert`, `fristZeitpunkt` und `abgelaufen` stehen weiter oben, beim Wecker.)
  const fristSatz = (): string => {
    if (fristWert === undefined) {
      return t("adm.gastfrist.unbefristet");
    }
    if (fristZeitpunkt === undefined) {
      return t("adm.gastfrist.unlesbar");
    }
    const datum = new Date(fristZeitpunkt).toLocaleDateString(i18n.language);
    return abgelaufen
      ? t("adm.gastfrist.abgelaufen", { datum })
      : t("adm.gastfrist.gueltigBis", { datum });
  };
  // ADMIN-04: derselbe Zugangsstand wie an der Listenzeile und im Dienst — mit derselben Uhr wie
  // `abgelaufen` (der Wecker oben zeichnet beim Ablauf neu).
  const zugang = kontoZugang(nutzer.approved, fristZeitpunkt, Date.now());
  // Entwürfe + Lücken + Prüfaufgaben — `null`, solange der Server sie nicht erhoben hat.
  const vorgaengeZahlen = meineVerantwortung?.vorgaenge ?? null;
  const vorgaengeSumme =
    vorgaengeZahlen === null
      ? null
      : vorgaengeZahlen.entwuerfe + vorgaengeZahlen.luecken + vorgaengeZahlen.pruefaufgaben;
  // Die Wirkung einer gewählten, noch nicht gespeicherten Befristung.
  const fristVorschau = fristOffen ? endeDesTages(fristTag) : null;
  // Die Vermerke dieses Kontos, jüngste zuerst (Benutzer-, Übergabe- und Verantwortungsvorgänge).
  const kontoVermerke: AuditEntry[] = (Array.isArray(audit.data) ? audit.data : [])
    .filter(
      (e) =>
        e.target === nutzer.id &&
        (e.action.startsWith("user.") ||
          e.action === "verantwortung.uebergabe" ||
          e.action === "lifecycle.handover"),
    )
    .slice(-5)
    .reverse();

  // JOB 3135 H6-D1 R1: HIER STAND DER EINZIGE ABFRAGEGESTÜTZTE ZWEIG DIESER DATEI OHNE HÜLLE.
  //
  // Codex hat es live gemessen (R-1563, 06.09. 07:27, Live 1.0.0-beta.1.124): eigenes Kontodetail
  // öffnen, Browser offline schalten — `navigator.onLine=false`, aber Rolle, E-Mail und alle
  // Verwaltungsknöpfe standen unverändert da, „ohne Offline-/Stand-/nicht-aktualisiert-Hinweis",
  // während die Kontenübersicht eine Ebene höher denselben Zustand ausdrücklich als veraltet
  // markierte. Die Rolle ist eine Tatsachenaussage; ohne frische Grundlage darf sie nicht
  // unmarkiert dastehen (REGELN §7).
  //
  // Die Hülle liegt INNEN, die Karte bleibt außen: der Kartentitel ist die Überschrift dieser
  // Karte und muss den Rückweg tragen, auch wenn die Auffrischung ruht. Alles andere — E-Mail,
  // Rolle, Freigeben, Passwort, Löschen — liegt jetzt in der Hülle und trägt deren Auskunft.
  return (
    <Detailkarte titel={nutzer.name} onZurueck={onZurueck} testId="detail-nutzer">
      {seitenhilfe}
      <Abfragehuelle abfrage={users} testId="huelle-nutzer">
        {() => (
          <>
            <div className="font-mono text-[12px] text-muted-2">{nutzer.email}</div>

            {/* ADMIN-04 · DER ZUGANG IN EINEM SATZ — nur aus belegten Feldern. Anlage: `createdAt`.
                Letzte Anmeldung und Einladungen führt das Konto nicht; das wird gesagt, statt einen
                Wert zu schätzen. */}
            <div data-testid="konto-zugang" className="space-y-0.5 text-[12.5px]">
              <div data-zugang={zugang} className="font-medium text-text">
                {t(`nutzerliste.konto.zustand.${zugang}`)}
              </div>
              <div className="text-muted-2">
                {Number.isNaN(Date.parse(nutzer.createdAt))
                  ? t("nutzerliste.konto.angelegtUnbekannt")
                  : t("nutzerliste.konto.angelegt", {
                      datum: new Date(nutzer.createdAt).toLocaleDateString(i18n.language),
                    })}
              </div>
              <div className="text-muted-2">{t("nutzerliste.konto.nichtErfasst")}</div>
            </div>

            {/* ADMIN-04 · VERANTWORTUNG — Beiträge und andere offene Vorgänge getrennt gezählt, und
                jede Zahl öffnet ihren Bestand: die Beiträge in der Übergabefläche, die Vorgänge als
                Liste darunter. */}
            <div data-testid="konto-verantwortung" className="space-y-1.5 text-[12.5px]">
              {meineVerantwortung === undefined ? (
                <div className="text-muted-2">
                  {t("nutzerliste.verantwortung")}:{" "}
                  {verantwortung.isError
                    ? t("einst.wert.nichtAbrufbar")
                    : t("einst.wert.unbekannt")}
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span data-testid="konto-beitraege" data-anzahl={meineVerantwortung.beitraege}>
                      {t("nutzerliste.konto.beitraege", { anzahl: meineVerantwortung.beitraege })}
                    </span>
                    {meineVerantwortung.beitraege > 0 ? (
                      <Button
                        variant="ghost"
                        data-testid="konto-beitraege-oeffnen"
                        onClick={() => setBeitraegeOffen(true)}
                      >
                        {t("nutzerliste.konto.beitraegeOeffnen")}
                      </Button>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span data-testid="konto-vorgaenge" data-anzahl={vorgaengeSumme ?? ""}>
                      {meineVerantwortung.vorgaenge === null
                        ? `${t("nutzerliste.konto.vorgaengeTitel")}: ${t("einst.wert.nichtAbrufbar")}`
                        : t("nutzerliste.konto.vorgaenge", meineVerantwortung.vorgaenge)}
                    </span>
                    {vorgaengeSumme !== null && vorgaengeSumme > 0 ? (
                      <Button
                        variant="ghost"
                        data-testid="konto-vorgaenge-oeffnen"
                        aria-expanded={vorgaengeOffen}
                        onClick={() => setVorgaengeOffen((v) => !v)}
                      >
                        {t("nutzerliste.konto.vorgaengeOeffnen")}
                      </Button>
                    ) : null}
                  </div>
                </>
              )}
              {vorgaengeOffen ? (
                <div data-testid="konto-vorgaenge-liste" className="rounded-input bg-page p-2">
                  {vorgaenge.data === undefined ? (
                    <span className="text-muted-2">
                      {vorgaenge.isError ? t("einst.wert.nichtAbrufbar") : t("state.loading")}
                    </span>
                  ) : (
                    <ul className="space-y-0.5">
                      {vorgaenge.data.pruefaufgaben.map((p) => (
                        <li key={`p-${p.koId}`} data-art="pruefaufgabe">
                          {t("nutzerliste.konto.pruefaufgabe")}{" "}
                          <Link to={`/wissen/${encodeURIComponent(p.koId)}`} className="underline">
                            {p.titel ?? t("nutzerliste.konto.nichtEinsehbar")}
                          </Link>
                        </li>
                      ))}
                      {vorgaenge.data.luecken.map((l) => (
                        <li key={`l-${l.id}`} data-art="luecke">
                          {t("nutzerliste.konto.luecke")}{" "}
                          <span className="font-mono text-[11px]">{l.id}</span>
                        </li>
                      ))}
                      {vorgaenge.data.entwuerfe.map((d) => (
                        <li key={`d-${d.id}`} data-art="entwurf">
                          {t("nutzerliste.konto.entwurf")}{" "}
                          <span className="font-mono text-[11px]">{d.id}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>

            {nutzer.approved ? (
              <>
                <Field label={t("adm.role")}>
                  <select
                    data-testid="konto-rolle"
                    value={rolleWahl ?? nutzer.role}
                    onChange={(e) => {
                      const r = e.target.value as Role;
                      setRolleWahl(r === nutzer.role ? null : r);
                      setRolleStand(null);
                    }}
                    className="h-9 rounded-input border border-hairline bg-surface px-2 text-[13px]"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {t(`role.name.${r}`)}
                      </option>
                    ))}
                  </select>
                </Field>
                {rolleWahl === null ? null : (
                  <RollenWirkung
                    von={nutzer.role}
                    nach={rolleWahl}
                    sendet={setRole.isPending}
                    onUebernehmen={() => setRole.mutate({ id: nutzer.id, role: rolleWahl })}
                    onAbbrechen={() => setRolleWahl(null)}
                  />
                )}
                {rolleStand === null ? null : rolleStand.art === "ok" ? (
                  <output
                    data-testid="rolle-bestaetigt"
                    className="block text-[12px] text-trust-pos-text"
                  >
                    {rolleStand.rolle === null
                      ? t("nutzerliste.rolle.gespeichertOhneStand")
                      : t("nutzerliste.rolle.bestaetigt", {
                          rolle: t(`role.name.${rolleStand.rolle}`),
                        })}
                  </output>
                ) : (
                  <p
                    role="alert"
                    data-testid="rolle-fehler"
                    className="text-[12px] text-trust-crit-text"
                  >
                    {rolleStand.meldung}{" "}
                    {rolleStand.abgewiesen
                      ? t("nutzerliste.rolle.unveraendert")
                      : t("nutzerliste.rolle.ausgangOffen")}
                  </p>
                )}

                {/* ==================================================================================
                    JOB 4021 · BIS WANN GILT DIESER ZUGANG — UND DIE DREI HANDGRIFFE DARAN.
                    ==================================================================================
                    Sehen, setzen/verlängern und beenden liegen an EINER Stelle, neben der Rolle.
                    Eine zweite Stelle, an der man eine Befristung setzen kann, entsteht ausdrücklich
                    nicht; und dies ist auch kein zweiter Freigabeweg neben `approved` — die
                    Befristung ist eine zusätzliche Bedingung, über die allein der Server urteilt
                    (`services/auth/src/service.ts:312-343`). Die Karte zeigt und sendet. */}
                <div className="space-y-2 border-t border-hairline pt-4">
                  <div className="text-[12.5px] font-medium text-muted">
                    {t("adm.gastfrist.titel")}
                  </div>
                  <div data-einst="gastfrist-stand" className="text-[13px] text-text">
                    {fristSatz()}
                  </div>
                  <p className="text-[12px] text-muted-2">{t("adm.gastfrist.hinweis")}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        // Vorbelegt wird der GELTENDE Wert (verlängern), sonst nichts: eine
                        // Vorgabedauer würde eine Befristung vorschlagen, die niemand beschlossen
                        // hat.
                        setFristTag(tagDesZeitpunkts(fristWert));
                        setFristOffen(true);
                      }}
                    >
                      {fristWert === undefined
                        ? t("adm.gastfrist.setzen")
                        : t("adm.gastfrist.verlaengern")}
                    </Button>
                    {fristWert === undefined ? null : (
                      // Das Beenden ist als Beenden BENANNT und sendet `null` — nicht ein leeres
                      // Feld, über das der Server hinwegginge (`routes.ts:836/839`).
                      <Button
                        variant="ghost"
                        disabled={befristen.isPending}
                        onClick={() => befristen.mutate({ id: nutzer.id, bis: null })}
                      >
                        {t("adm.gastfrist.beenden")}
                      </Button>
                    )}
                  </div>
                  {fristOffen ? (
                    <div className="space-y-2 rounded-input bg-page p-2">
                      <Field label={t("adm.gastfrist.datum")}>
                        <TextInput
                          type="date"
                          value={fristTag}
                          onChange={(e) => setFristTag(e.target.value)}
                          className="h-9"
                        />
                      </Field>
                      {/* ADMIN-04: die Wirkung, BEVOR gespeichert wird — ab wann die Anmeldung
                          endet und welche Bedingung der Server stellt. */}
                      {fristVorschau === null ? null : (
                        <p data-testid="frist-wirkung" className="text-[12px] text-text">
                          {t("nutzerliste.frist.wirkung", {
                            name: nutzer.name,
                            datum: new Date(fristVorschau).toLocaleDateString(i18n.language),
                          })}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="primary"
                          disabled={befristen.isPending}
                          onClick={() => {
                            // SCRUM-463: nicht stumm deaktivieren — ein Klick ohne gewählten Tag
                            // sagt ehrlich, was fehlt, statt nichts zu tun.
                            const bis = endeDesTages(fristTag);
                            if (bis === null) {
                              push("error", t("adm.gastfrist.datumFehlt"));
                              return;
                            }
                            befristen.mutate({ id: nutzer.id, bis });
                          }}
                        >
                          {t("adm.gastfrist.speichern")}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setFristOffen(false);
                            setFristTag("");
                          }}
                        >
                          {t("adm.gastfrist.abbrechen")}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {fristHilfe === null ? null : (
                    // ZWEI AUSGÄNGE, ZWEI SÄTZE — und der zweite ist keine schwächere Fassung des
                    // ersten, sondern die einzige, die ohne Beleg zulässig ist.
                    <p role="alert" className="text-[12px] text-trust-crit-text">
                      {fristHilfe.meldung}{" "}
                      {fristHilfe.abgewiesen
                        ? t("adm.gastfrist.fehlerHilfe")
                        : t("adm.gastfrist.fehlerOffen")}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => approve.mutate(nutzer.id)}
                className="rounded-btn bg-trust-pos-bg px-3 py-1.5 text-[12.5px] font-semibold text-trust-pos-text hover:opacity-80"
              >
                {t("adm.approve")}
              </button>
            )}

            {/* produkt:20261007:ownership-uebergabe — Hauptverantwortung einzeln oder gesammelt an
                Nachfolger übergeben, mit Vorschau; Zugang erst ohne Restbestand beenden. Für jedes
                Konto, auch ein gesperrtes: gerade dort liegt Bestand, der eine Vertretung braucht. */}
            <VerantwortungUebergabe
              personId={nutzer.id}
              personName={nutzer.name}
              offen={beitraegeOffen}
              onOffen={setBeitraegeOffen}
            />

            {/* aufnahme:20260922:gesamt-wissensvermaechtnis — die Beiträge dieser Person als
                Wissens-Vermächtnis-Buch, digital oder gedruckt. Ändert kein Wissen. */}
            <VermaechtnisBuch personId={nutzer.id} />

            {/* R-0554 / R-2128: bevor ein Konto geht, wandert sein Wissen — Autorschaft, Entwürfe,
                offene Lücken und Prüfaufgaben, nicht nur die Hauptverantwortung. Nachfolger kann nur
                ein freigeschaltetes Konto sein. */}
            <Wissensuebergabe
              von={nutzer.id}
              kandidaten={(users.data ?? []).filter((u) => u.approved && u.id !== nutzer.id)}
            />

            <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
              <Button
                variant="ghost"
                onClick={() => {
                  setResetOffen((v) => !v);
                  setResetPw("");
                  setResetPw2("");
                }}
              >
                <KeyRound size={15} />
                {t("adm.reset")}
              </Button>
              {/* R-0562: der Weg zurück bei verlorenem zweiten Gerät. Der Server antwortet mit
                  „nicht eingerichtet", wenn es nichts zu entfernen gibt — die Meldung zeigt `fail`. */}
              <Button
                variant="ghost"
                data-testid="admin-zweifaktor-entfernen"
                disabled={zweiFaktorEntfernen.isPending}
                onClick={() => zweiFaktorEntfernen.mutate(nutzer.id)}
              >
                {t("zweifaktor.admin.entfernen")}
              </Button>
              {confirmRemove ? (
                <span className="inline-flex flex-wrap items-center gap-2 rounded-card border border-hairline bg-page px-2.5 py-1.5">
                  <span className="text-[12px] font-semibold text-text">{t("adm.removeQ")}</span>
                  <select
                    data-entfernen-nachfolger
                    aria-label={t("verantwortung.entfernenNachfolger")}
                    value={nachfolgerBeimEntfernen}
                    onChange={(e) => {
                      // Ein anderer Nachfolger ist eine andere Übergabe: die Vorschau verfällt.
                      setNachfolgerBeimEntfernen(e.target.value);
                      setEntfernenVorschau(null);
                    }}
                    className="h-8 rounded-input border border-hairline bg-surface px-2 text-[12px]"
                  >
                    <option value="">{t("verantwortung.entfernenOhneUebergabe")}</option>
                    {(users.data ?? [])
                      .filter((u) => u.approved && u.id !== nutzer.id)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {t("verantwortung.entfernenAn", { name: u.name })}
                        </option>
                      ))}
                  </select>
                  {/* R-0554 · BEN (Nacharbeit 3): mit Nachfolger erst die Vorschau desselben
                      Personenpaars — „Ja, entfernen" wird erst danach möglich. */}
                  {nachfolgerBeimEntfernen && !vorschauPasst ? (
                    <Button
                      data-entfernen-vorschau-holen
                      variant="ghost"
                      disabled={entfernenVorschauHolen.isPending}
                      onClick={() => entfernenVorschauHolen.mutate(nachfolgerBeimEntfernen)}
                    >
                      {t("verantwortung.uebergabe.vorschau")}
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setConfirmRemove(false);
                      setNachfolgerBeimEntfernen("");
                      setEntfernenVorschau(null);
                    }}
                  >
                    {t("adm.removeKeep")}
                  </Button>
                  <Button
                    variant="danger"
                    disabled={remove.isPending || vorschauFehlt}
                    onClick={() =>
                      remove.mutate({ id: nutzer.id, nachfolger: nachfolgerBeimEntfernen })
                    }
                  >
                    {t("adm.removeYes")}
                  </Button>
                  {vorschauPasst && entfernenVorschau ? (
                    <span
                      data-entfernen-vorschau
                      className="block w-full space-y-2 rounded-input bg-surface p-2"
                    >
                      <UebergabeVorschauInhalt vorschau={entfernenVorschau} />
                    </span>
                  ) : null}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmRemove(true)}
                  className="rounded-btn px-3 py-2 text-[12.5px] font-semibold text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
                >
                  {t("adm.remove")}
                </button>
              )}
            </div>

            {resetOffen ? (
              <div className="rounded-input bg-page p-2">
                {/* SCRUM-455: Passwort + Wiederholung — ein Vertipper würde den Nutzer aussperren. */}
                <div className="flex flex-wrap items-center gap-2">
                  <TextInput
                    type="password"
                    minLength={8}
                    placeholder={t("adm.newPassword")}
                    value={resetPw}
                    onChange={(e) => setResetPw(e.target.value)}
                    className="h-9 flex-1"
                  />
                  <TextInput
                    type="password"
                    minLength={8}
                    placeholder={t("adm.newPasswordRepeat")}
                    value={resetPw2}
                    onChange={(e) => setResetPw2(e.target.value)}
                    className="h-9 flex-1"
                  />
                  <Button
                    variant="primary"
                    disabled={reset.isPending || !isPasswordResetValid(resetPw, resetPw2)}
                    onClick={() => reset.mutate({ id: nutzer.id, password: resetPw })}
                  >
                    {t("adm.resetConfirm")}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setResetOffen(false);
                      setResetPw("");
                      setResetPw2("");
                    }}
                  >
                    {t("adm.resetCancel")}
                  </Button>
                </div>
                {/* Ehrlicher Grund erst, wenn im Wiederholfeld etwas steht (kein Fehler beim Tippen). */}
                {passwordRepeatMismatch(resetPw, resetPw2) ? (
                  <p className="mt-1.5 text-[12px] text-trust-crit-text">
                    {t("adm.passwordMismatch")}
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* ADMIN-04 · WAS DAS PRÜFPROTOKOLL ZU DIESEM KONTO FESTHÄLT — die letzten fünf
                Vermerke, mit dem Wert, den der Server geschrieben hat (Rolle vorher → nachher,
                Ablauf). Ohne Antwort steht „nicht abrufbar", nie eine leere Liste. */}
            <div data-testid="konto-protokoll" className="space-y-1 border-t border-hairline pt-4">
              <div className="text-[12.5px] font-medium text-muted">
                {t("nutzerliste.konto.protokoll")}
              </div>
              {audit.data === undefined ? (
                <p className="text-[12px] text-muted-2">
                  {audit.isError ? t("einst.wert.nichtAbrufbar") : t("state.loading")}
                </p>
              ) : kontoVermerke.length === 0 ? (
                <p className="text-[12px] text-muted-2">{t("nutzerliste.konto.protokollLeer")}</p>
              ) : (
                <ul className="space-y-0.5 text-[12px]">
                  {kontoVermerke.map((e) => (
                    <li key={e.seq} data-testid="konto-vermerk" data-action={e.action}>
                      <span className="font-mono text-[11px] text-muted-2">
                        {new Date(e.at).toLocaleString(i18n.language)}
                      </span>{" "}
                      <span className="text-text">{auditActionLabel(e.action, t)}</span>
                      {vermerkDetail(e, t, i18n.language)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </Abfragehuelle>
    </Detailkarte>
  );
}

/** Der geschriebene Wert eines Vermerks, soweit er für die Verwaltung lesbar ist. */
function vermerkDetail(
  e: AuditEntry,
  t: Parameters<typeof auditActionLabel>[1],
  sprache: string,
): string {
  const p = e.payload ?? {};
  if (e.action === "user.role-change" && typeof p.role === "string") {
    const vorher = typeof p.previousRole === "string" ? t(`role.name.${p.previousRole}`) : "?";
    return ` · ${vorher} → ${t(`role.name.${p.role}`)}`;
  }
  // `services/auth/src/service.ts`, `setAccessExpiry`: `{ expiresAt }` oder `{ entfernt: true }`.
  if (e.action === "user.access-expiry-set") {
    if (p.entfernt === true) {
      return ` · ${t("nutzerliste.konto.vermerkUnbefristet")}`;
    }
    const bis = typeof p.expiresAt === "string" ? Date.parse(p.expiresAt) : Number.NaN;
    return Number.isNaN(bis)
      ? ""
      : ` · ${t("nutzerliste.konto.vermerkBis", { datum: new Date(bis).toLocaleDateString(sprache) })}`;
  }
  return "";
}

/**
 * ADMIN-04 · Die Wirkung eines gewählten Rollenwechsels — vor dem Senden.
 *
 * Die Fähigkeiten stammen aus `rollenFreiheiten.ts` (dieselbe Quelle wie die Rollenkarte); was die
 * Rolle tatsächlich darf, entscheidet weiter der Server. Der Wechsel selbst ist umkehrbar, deshalb
 * reicht hier eine Bestätigung ohne zweite Rückfrage.
 */
function RollenWirkung({
  von,
  nach,
  sendet,
  onUebernehmen,
  onAbbrechen,
}: {
  von: Role;
  nach: Role;
  sendet: boolean;
  onUebernehmen: () => void;
  onAbbrechen: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const w = rollenwirkung(von, nach);
  const liste = (keys: string[]): string =>
    keys.length === 0 ? t("einst.wert.keine") : keys.map((k) => t(k)).join(", ");
  return (
    <div
      data-testid="rolle-wirkung"
      className="space-y-1.5 rounded-input bg-page p-2 text-[12.5px]"
    >
      <div className="font-medium text-text">
        {t("nutzerliste.rolle.wirkungKopf", {
          von: t(`role.name.${von}`),
          nach: t(`role.name.${nach}`),
        })}
      </div>
      <div data-testid="rolle-wirkung-dazu">
        {t("nutzerliste.rolle.dazu")}: {liste(w.dazu)}
      </div>
      <div data-testid="rolle-wirkung-weg">
        {t("nutzerliste.rolle.weg")}: {liste(w.weg)}
      </div>
      <p className="text-[12px] text-muted-2">{t("nutzerliste.rolle.hinweis")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          data-testid="rolle-uebernehmen"
          disabled={sendet}
          onClick={onUebernehmen}
        >
          {t("nutzerliste.rolle.uebernehmen", { rolle: t(`role.name.${nach}`) })}
        </Button>
        <Button variant="ghost" data-testid="rolle-abbrechen" onClick={onAbbrechen}>
          {t("adm.gastfrist.abbrechen")}
        </Button>
      </div>
    </div>
  );
}

/** SCRUM-147: Nutzer anlegen. */
export function NutzerAnlegenDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { push } = useToast();
  const [newUser, setNewUser] = useState({ ...EMPTY_NEW_USER });
  // Sicherheit: Passwort-Bestätigung bei der Nutzeranlage (Vertipper-Schutz, analog Reset).
  const [newUserPw2, setNewUserPw2] = useState("");
  // ================================================================================================
  // JOB 4103 (ERSTEINRICHTUNG-GAST T3) — DIE BEFRISTUNG GEHÖRT IN DEN VORGANG, DER DAS KONTO ANLEGT.
  // ================================================================================================
  //
  // Bis hierher war „einen Gastzugang anlegen, der von selbst endet" für den Admin ein Vorgang in
  // ZWEI Handgriffen: hier anlegen, dann das Konto in der Liste wiederfinden und in seiner Karte
  // (`NutzerDetail` oben, JOB 4021) die Befristung setzen. Zwischen beiden stand ein freigegebenes,
  // UNBEFRISTETES Konto; unterblieb der zweite Handgriff, blieb es für immer dort. Der Server kann
  // es seit JOB 4011 in EINEM Aufruf — er prüft die Form VOR `register` und legt bei unlesbarem
  // Wert gar nichts an (`services/auth/src/routes.ts`, Wache 1 und 2).
  //
  // DER SCHALTER IST DIE AUSSAGE, NICHT DAS LEERE FELD. „Kein Ablauf" bleibt der gültige
  // Normalzustand, und ein leeres Datumsfeld kann zweierlei heissen: „ich will keine Befristung"
  // und „ich wollte eine, mein Tag war nur unbrauchbar". Eine regelkonforme Datumseingabe LÖSCHT
  // einen unmöglichen Tag nämlich selbst (HTML-Wertbereinigung; nachgemessen: `2026-02-30` und
  // `2026-13-01` werden zu `""`, `2028-02-29` bleibt stehen). Stünde das Feld ohne Schalter da,
  // entstünde nach einem solchen Tag still ein Zugang OHNE ENDE — also genau das Konto, gegen das
  // dieser Weg gebaut ist. Mit dem Schalter ist beides unterscheidbar: geschlossen ⇒ das Feld geht
  // gar nicht mit; offen ⇒ ohne brauchbaren Tag wird NICHT gesendet. Dieselbe Bauart wie in der
  // Frist-Karte oben („Befristung setzen" öffnet die Eingabe), derselbe Wortschatz, kein zweiter.
  const [fristOffen, setFristOffen] = useState(false);
  const [fristTag, setFristTag] = useState("");
  /**
   * Die Auskunft zum zuletzt gescheiterten Anlageversuch — sie bleibt stehen, der Toast nicht.
   *
   * `abgewiesen` trägt denselben BELEG wie in `NutzerDetail` (s. `serverHatAbgewiesen`): „Es wurde
   * kein Konto angelegt." ist eine Tatsachenaussage über fremde Daten und nur nach einer Ablehnung
   * des Servers (4xx) gedeckt. Bei offenem Ausgang — verlorene Antwort, abgebrochenes Netz, 5xx —
   * steht der offene Ausgang da, und der Bestand wird geholt statt behauptet.
   */
  const [anlageHilfe, setAnlageHilfe] = useState<{ meldung: string; abgewiesen: boolean } | null>(
    null,
  );
  const create = useMutation({
    // Der Ablauf kommt als VARIABLE herein und nicht aus dem Zustand: gesendet wird genau der Wert,
    // den der Knopf unten geprüft hat. Läse die Mutation `fristTag` selbst, läge zwischen Prüfung
    // und Senden ein zweiter Zustandsstand.
    mutationFn: (accessExpiresAt: string | undefined) =>
      endpoints.users.create(
        newUser.name.trim(),
        newUser.email.trim(),
        newUser.password,
        newUser.role,
        accessExpiresAt,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["users"] });
      setNewUser({ ...EMPTY_NEW_USER });
      setNewUserPw2("");
      setFristOffen(false);
      setFristTag("");
      setAnlageHilfe(null);
      push("success", t("adm.created"));
      onZurueck();
    },
    onError: (e) => {
      // Der Satz des SERVERS (bei unlesbarem Ablaufdatum `ACCESS_EXPIRY_UNREADABLE`,
      // `services/auth/src/meldungen.ts`), daneben der nächste Schritt — und WELCHER, entscheidet
      // der Beleg. Die Eingaben bleiben dabei stehen: niemand tippt Name, E-Mail und Passwort
      // erneut, nur weil ein Tag nicht gelesen werden konnte.
      const abgewiesen = serverHatAbgewiesen(e);
      setAnlageHilfe({
        meldung: e instanceof ApiError ? e.message : t("state.error"),
        abgewiesen,
      });
      if (!abgewiesen) {
        void qc.invalidateQueries({ queryKey: ["users"] });
      }
      push("error", e instanceof ApiError ? e.message : t("state.error"));
    },
  });

  return (
    <Detailkarte
      titel={t("adm.createTitle")}
      onZurueck={onZurueck}
      testId="detail-nutzer-neu"
      hilfe={[{ titel: t("adm.createTitle"), text: t("adm.createHint") }]}
    >
      {/* JOB 3670: Das „?"-Menü der Karte (`hilfe` oben) und die Seitenhilfe im Zahnrad sind zwei
          Orte mit zwei Umfängen, keine zwei Mechaniken: `adm.createHint` erklärt seit JOB 3065 das
          FORMULAR dieser Karte, der Eintrag hier erklärt den BILDSCHIRM — Folge der Anlage
          (sofort freigegeben) und nächster Schritt. Eine zweite Hilfemechanik entsteht dadurch
          nicht; `HelpTip` bleibt der eine Weg in die Seitenhilfe. */}
      <HelpTip
        title={t("seitenhilfe.admin.nutzerNeu.titel")}
        body={t("seitenhilfe.admin.nutzerNeu.text")}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("adm.name")}>
          <TextInput
            value={newUser.name}
            onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))}
          />
        </Field>
        <Field label={t("adm.email")}>
          <TextInput
            type="email"
            value={newUser.email}
            onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
          />
        </Field>
        <Field label={t("adm.password")}>
          <TextInput
            type="password"
            minLength={8}
            value={newUser.password}
            onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
          />
        </Field>
        {/* Ein Vertipper würde den neuen Nutzer sonst aussperren. */}
        <Field label={t("adm.newPasswordRepeat")}>
          <TextInput
            type="password"
            minLength={8}
            value={newUserPw2}
            onChange={(e) => setNewUserPw2(e.target.value)}
          />
          {passwordRepeatMismatch(newUser.password, newUserPw2) ? (
            <p className="mt-1.5 text-[12px] text-trust-crit-text">{t("adm.passwordMismatch")}</p>
          ) : null}
        </Field>
        <Field label={t("adm.role")}>
          <select
            value={newUser.role}
            onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value as Role }))}
            className="h-10 w-full rounded-input border border-hairline bg-surface px-2 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`role.name.${r}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {/* ==============================================================================================
          JOB 4103 · BIS WANN SOLL DIESER ZUGANG GELTEN — GEFRAGT, BEVOR ES IHN GIBT.
          ==============================================================================================
          Derselbe Wortschatz wie in der Frist-Karte oben (`adm.gastfrist.*`) und dieselbe Bauart:
          ein Knopf öffnet dieselbe Datumseingabe, ohne Vorgabedauer. Ein zweiter Weg, eine
          Befristung zu setzen, entsteht dadurch nicht — dies ist der Weg für die ANLAGE, die Karte
          oben bleibt der Weg für BESTEHENDE Konten. */}
      <div className="space-y-2 border-t border-hairline pt-4">
        <div className="text-[12.5px] font-medium text-muted">{t("adm.gastfrist.titel")}</div>
        <p className="text-[12px] text-muted-2">{t("adm.gastfrist.anlageHinweis")}</p>
        {fristOffen ? (
          <div className="space-y-2 rounded-input bg-page p-2">
            <Field label={t("adm.gastfrist.datum")}>
              <TextInput
                type="date"
                value={fristTag}
                onChange={(e) => setFristTag(e.target.value)}
                className="h-9"
              />
            </Field>
            <Button
              variant="ghost"
              onClick={() => {
                setFristOffen(false);
                setFristTag("");
              }}
            >
              {t("adm.gastfrist.abbrechen")}
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setFristOffen(true)}>
            {t("adm.gastfrist.setzen")}
          </Button>
        )}
      </div>
      {/* SCRUM-463: Knopf nicht stumm deaktivieren. Fehlt etwas, sagt ein Klick ehrlich, was —
          sonst „passiert nichts" ohne jede Rückmeldung. Die Auskunft kommt als Meldung mit den
          FEHLENDEN Feldern beim Namen (`adm.createInvalid` + `adm.field.*`), nicht als stehender
          Absatz: JOB 3065 R2 (BENs Korrekturpflicht 1) — `adm.createHint` ist ein verlegter
          Hilfetext und lebt im „?"-Menü dieser Karte, nicht im Sichtfeld. */}
      <div>
        <Button
          variant="primary"
          disabled={create.isPending}
          onClick={() => {
            const issues = newUserIssues(newUser);
            if (issues.length > 0) {
              push(
                "error",
                `${t("adm.createInvalid")} ${issues.map((i) => t(`adm.field.${i}`)).join(", ")}`,
              );
              return;
            }
            if (newUser.password !== newUserPw2) {
              push("error", t("adm.passwordMismatch"));
              return;
            }
            // JOB 4103: BEFRISTET ODER GAR NICHT. Steht die Eingabe zu, geht das Feld gar nicht
            // mit (`undefined` verschwindet in `JSON.stringify`) und es entsteht ein Zugang ohne
            // Ende — der gültige Normalzustand. Steht sie offen, MUSS ein Tag da sein, den es im
            // Kalender gibt: `endeDesTages` rechnet ihn in das Ende dieses Tages um (derselbe
            // Helfer wie in der Frist-Karte, damit die Liste danach denselben Tag zeigt) und gibt
            // `null` zurück, wenn dort kein solcher Tag steht. Dann wird nicht gesendet, und es
            // entsteht kein Konto — statt eines unbefristeten, das niemand wollte.
            let bis: string | undefined;
            if (fristOffen) {
              const ende = endeDesTages(fristTag);
              if (ende === null) {
                push("error", t("adm.gastfrist.datumFehlt"));
                return;
              }
              bis = ende;
            }
            setAnlageHilfe(null);
            create.mutate(bis);
          }}
        >
          <UserPlus size={15} />
          {t("adm.create")}
        </Button>
      </div>
      {anlageHilfe === null ? null : (
        // ZWEI AUSGÄNGE, ZWEI SÄTZE — und der zweite ist keine schwächere Fassung des ersten,
        // sondern die einzige, die ohne Beleg zulässig ist (s. `serverHatAbgewiesen`).
        <p role="alert" className="text-[12px] text-trust-crit-text">
          {anlageHilfe.meldung}{" "}
          {anlageHilfe.abgewiesen
            ? t("adm.gastfrist.anlageFehlerHilfe")
            : t("adm.gastfrist.anlageFehlerOffen")}
        </p>
      )}
    </Detailkarte>
  );
}

/**
 * Die Rollen-Vorschau. Bug (Pedi 04.07.): Ein Admin darf die ANSICHT als jede Rolle prüfen; die
 * echte Session (Backend-RBAC) bleibt Admin. Bis JOB 3060 stand dieser Schalter in der
 * Seitenleiste — hier ist sein neuer Ort.
 */
export function AnsichtAlsRolleDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  const { role, setRole } = useRole();
  return (
    <Detailkarte titel={t("role.viewAs")} onZurueck={onZurueck} testId="detail-ansicht-rolle">
      {/* JOB 3670: Diese Karte hat die überraschendste Folge der ganzen Verwaltung — eine fremde
          Rolle nimmt die Verwaltung weg (Kommentar unten, `routes.tsx:184-187`). Genau das steht im
          Hilfetext, samt dem Rückweg, der die Sperre überlebt (`shell/RollenVorschau.tsx:104`). */}
      <HelpTip
        title={t("seitenhilfe.admin.ansichtRolle.titel")}
        body={t("seitenhilfe.admin.ansichtRolle.text")}
      />
      {/* ============================================================================================
          JOB 3124 UX-12 · EIN NAME JE ROLLE — UND ER PASST AUCH AUF DIE SCHMALE FLÄCHE.
          ============================================================================================
          Bis hierher stand hier die KURZFORM (`role.short.*`: „Viewer", „Contr."), während die Zeile
          „Ansicht als Rolle" (`pages/Admin.tsx`), das Rollenverzeichnis darunter und die Sperrkarte
          (`components/Stage2Notice.tsx`) den vollen Namen zeigten (`role.name.*`: „Betrachter",
          „Controller"). Wer hier „Viewer" wählte, las anderswo einen anderen Wortlaut und konnte die
          gewählte Rolle nicht wiedererkennen. Die Kurzform ist an dieser Stelle GELÖSCHT, nicht
          danebengestellt.

          DIE NAMEN SIND LÄNGER, ALSO TRÄGT DAS RASTER SIE ANDERS — und zwar nach einer MESSUNG,
          nicht nach einer Rechnung (`tests/rollenvorschau-sperre/rollenraster-schmal-chromium.test.ts`,
          gebaute App in Chromium):
            · EINE Spalte unterhalb von `sm`. Bei 320 px lässt der Seitenrahmen (200-px-Reiterspalte
              in `components/einstellungen/Seite.tsx` plus Polster) dem Raster 30 px. Zweispaltig
              waren die Knöpfe dort 12 px breit und der Text lief bis 10,7 px aus ihnen heraus, dem
              Nachbarknopf entgegen — gemessen, nicht vermutet. Einspaltig steht jeder Name
              vollständig im eigenen Knopf. Bei 390 px trägt die eine Spalte 100 statt 47 px, und
              die Namen brauchen keinen Umbruch mehr.
            · Zwei Spalten ab `sm`, vier ab `lg` (dort misst `tests/design/h6-funktionsinventar.test.ts`
              bei 1280 px) — an der breiten Fläche ändert sich nichts.
          Kein Kürzungsmerkmal an den Knöpfen (kein `truncate`, kein `text-ellipsis`, kein
          `whitespace-nowrap`), dafür `break-words`: ein Name bricht im Engpass UM statt
          abgeschnitten zu werden. Gehütet von `tests/rollenvorschau-sperre/rollenraster-namen.test.tsx`
          (Bauart) und der Chromium-Messung oben (Wirkung bei 320 und 390 px). */}
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* ============================================================================================
            JOB 3337 · EINE FREMDE ROLLE SCHLIESST DIESE KARTE — WEIL SIE SIE WEGNIMMT.
            ============================================================================================
            Seit die Verwaltung ihren Zustand in der Adresse trägt (`/admin?bereich=…&detail=…`),
            überlebt eine offene Karte das Neuladen, den Zurück-Knopf — und eben auch den Ausflug in
            eine Vorschaurolle. Genau dort war das falsch: Wer hier „Betrachter" wählt, dem nimmt der
            Rollen-Guard `/admin` im selben Atemzug weg (`routes.tsx`, `RoleNotice`). Die Adresse
            zeigte danach weiter auf eine Karte, die es in dieser Rolle gar nicht gibt, und nach dem
            Rückweg „Zur Admin-Ansicht" stand man wieder mitten in ihr statt auf der Übersicht.

            GEMESSEN, NICHT VERMUTET: `tests/design/h1-funktionsinventar.test.ts` (Z-vorschau-rueckweg)
            durchläuft drei Vorschaurollen nacheinander und fand ab der zweiten Runde die Zeile
            „Ansicht als Rolle" nicht mehr — sie steht auf der ÜBERSICHT, und die war nie wieder da.

            Deshalb: eine FREMDE Rolle schließt die Karte (`onZurueck`, also zurück auf das Thema),
            die eigene Rolle „Administrator" nicht — dort ist die Karte ja bedienbar und man bleibt
            in ihr. Es ist derselbe Rückweg, den auch der Knopf oben nimmt; kein zweiter Weg. */}
        {ROLES.map((r: Role) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setRole(r);
              if (r !== "admin") {
                onZurueck();
              }
            }}
            aria-pressed={role === r}
            className={`break-words rounded-pill px-1.5 py-1.5 text-[12px] font-semibold transition-colors ${
              role === r ? "bg-brand text-white" : "bg-hairline-soft text-muted hover:text-text"
            }`}
          >
            {t(`role.name.${r}`)}
          </button>
        ))}
      </div>
      {/* ============================================================================================
          JOB 3065 H6 R10: HIER STAND EIN RÜCKWEG, DER NIE ERREICHBAR WAR.
          ============================================================================================
          Der Hinweis „Vorschau als … — du bleibst Admin" samt Knopf „Zur Admin-Ansicht" hing an
          `previewActive`, also an „eine Fremdrolle ist aktiv". Genau dann aber nimmt der Rollen-Guard
          dem Admin diese Seite weg (`routes.tsx` → `RoleNotice` statt `/admin`), und diese Karte
          wird gar nicht gerendert. Der Knopf war damit sichtbar, solange man ihn nicht braucht, und
          weg, sobald man ihn braucht — eine Scheinfunktion.
          Der echte Rückweg hängt in der Hülle, wo er die Sperre überlebt:
          `apps/web/src/shell/RollenVorschau.tsx` (Zahnrad-Menü, „Zur Admin-Ansicht"). Gemessen im
          Rundweg B1 von `tests/design/h6-funktionsinventar.test.ts`. */}
    </Detailkarte>
  );
}

/**
 * Was eine Rolle darf — die Bereiche, die ihr `minRole` freigibt. Die Liste stammt aus
 * `app/navigation.ts`; die Karte behauptet nichts eigenes.
 */
export function RolleDetail({
  rolle,
  onZurueck,
}: {
  rolle: Role;
  onZurueck: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const worte = freiheitenSchluessel(rolle).map((k) => t(k));
  return (
    <Detailkarte titel={t(`role.name.${rolle}`)} onZurueck={onZurueck} testId="detail-rolle">
      {/* JOB 3670: Der Hilfetext nennt die Ursache, an der JOB 3741 gescheitert ist — ein „·2"
          markiert einen Bereich, den `canSee` (`app/navigation.ts:492-497`) auch bei AUSREICHENDER
          Rolle ausblendet, solange Stufe 2 aus ist. Nicht die Rolle ist dann der Grund. */}
      <HelpTip
        title={t("seitenhilfe.admin.rolle.titel")}
        body={t("seitenhilfe.admin.rolle.text")}
      />
      <div className="text-[13px] text-muted">
        {worte.length > 0 ? worte.join(", ") : t("einst.wert.keine")}
        {kiWahlFrei(rolle) ? ` · ${t("einst.rollen.kiWahl")}` : ""}
      </div>
      <ul className="space-y-3">
        {NAV_GROUPS.map((gruppe) => {
          const eintraege = gruppe.items.filter((i) => roleAllows(i, rolle));
          if (eintraege.length === 0) {
            return null;
          }
          return (
            <li key={gruppe.id}>
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
                {t(gruppe.titleKey)}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {eintraege.map((i) => (
                  <span
                    key={i.id}
                    className="rounded-pill border border-hairline px-2 py-0.5 text-[12px] text-text"
                  >
                    {t(i.labelKey)}
                    {i.stufe2 ? <span className="ml-1 text-brand-text">·2</span> : null}
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </Detailkarte>
  );
}
