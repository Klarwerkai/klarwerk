// JOB 3065 H6 — DIE DETAILKARTEN DES REITERS „KONTEN".
//
// Ein Nutzer (Freigeben · Rolle · Passwort zurücksetzen · Löschen), das Anlegen, die Rollen-Vorschau
// („Ansicht als Rolle", vorher in der Seitenleiste) und je Rolle die Karte ihrer Freiheiten.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, UserPlus } from "lucide-react";
import { useEffect, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useUsers } from "../api/hooks";
import type { PublicUser } from "../api/types";
import { useRole } from "../app/RoleContext";
import { useToast } from "../app/ToastContext";
import { NAV_GROUPS, ROLES, type Role, roleAllows } from "../app/navigation";
// JOB 3670: die Seitenhilfe dieser vier Karten. `HelpTip` rendert nichts, er meldet Titel und Text
// beim Sammler an (`shell/SeitenhilfeContext.tsx`); gelesen wird im Zahnrad unter „Seitenhilfe".
// JE KARTE EIN EIGENER TEXT: die vier Karten sind vier Bildschirme, und ein gemeinsamer Satz an der
// Dateiwurzel stünde auf allen vieren gleich und erklärte keine.
import { HelpTip } from "../components/HelpTip";
import { Abfragehuelle } from "../components/einstellungen/Abfragehuelle";
import { Detailkarte } from "../components/einstellungen/Detailkarte";
import { freiheitenSchluessel, kiWahlFrei } from "../components/einstellungen/rollenFreiheiten";
import { Button, Field, TextInput } from "../components/ui";
import { isPasswordResetValid, newUserIssues, passwordRepeatMismatch } from "../lib/adminForms";

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
 */
function endeDesTages(tag: string): string | null {
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
 */
function lesbarerAblauf(wert: string | undefined): number | undefined {
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
function serverHatAbgewiesen(e: unknown): boolean {
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

  const approve = useMutation({
    mutationFn: (id: string) => endpoints.users.approve(id),
    onSuccess: invalidate,
    onError: fail,
  });
  const setRole = useMutation({
    mutationFn: (v: { id: string; role: Role }) => endpoints.users.setRole(v.id, v.role),
    onSuccess: invalidate,
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (id: string) => endpoints.users.remove(id),
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

            {nutzer.approved ? (
              <>
                <Field label={t("adm.role")}>
                  <select
                    value={nutzer.role}
                    onChange={(e) =>
                      setRole.mutate({ id: nutzer.id, role: e.target.value as Role })
                    }
                    className="h-9 rounded-input border border-hairline bg-surface px-2 text-[13px]"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {t(`role.name.${r}`)}
                      </option>
                    ))}
                  </select>
                </Field>

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
              {confirmRemove ? (
                <span className="inline-flex flex-wrap items-center gap-2 rounded-card border border-hairline bg-page px-2.5 py-1.5">
                  <span className="text-[12px] font-semibold text-text">{t("adm.removeQ")}</span>
                  <Button variant="ghost" onClick={() => setConfirmRemove(false)}>
                    {t("adm.removeKeep")}
                  </Button>
                  <Button
                    variant="danger"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(nutzer.id)}
                  >
                    {t("adm.removeYes")}
                  </Button>
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
          </>
        )}
      </Abfragehuelle>
    </Detailkarte>
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
  const create = useMutation({
    mutationFn: () =>
      endpoints.users.create(
        newUser.name.trim(),
        newUser.email.trim(),
        newUser.password,
        newUser.role,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["users"] });
      setNewUser({ ...EMPTY_NEW_USER });
      setNewUserPw2("");
      push("success", t("adm.created"));
      onZurueck();
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
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
            create.mutate();
          }}
        >
          <UserPlus size={15} />
          {t("adm.create")}
        </Button>
      </div>
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
