// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · BPA-06 — EINE ROUTINE AUSFÜHREN.
// ================================================================================================
//
// Unter jeder bestätigten Routine in „Meine Funktionen“ (P06, `VormachenFlaeche`):
//   · Zustand der Routine mit Pause/Fortsetzen — eine pausierte Routine läuft nicht.
//   · Eingaben dieses Laufs (Titel, Kernaussage) und „Ausführen“: ein Klick. Der Server prüft den
//     Lauf (`POST /api/me/vormachen/routinen/:id/lauf`) und legt einen gebundenen Auftrag im eigenen
//     Klara-Gespräch an; ausgeführt wird er über den vorhandenen Weg des Aktionskerns
//     (`klaraAuftragApi.fuehreAus`). Harmlose Schritte brauchen keine weitere Einzelbestätigung.
//   · Ergebnis: der angelegte Entwurf mit Link — oder der tatsächliche Grund, warum nichts entstand.
//   · AC05: der Zeitplan (`RoutineZeitplan`) mit denselben Eingaben für fällige Läufe.
// Ein erneuter Klick nach einem Abbruch nutzt dieselbe Laufkennung und dasselbe Gespräch; der Server
// legt dann nichts doppelt an. Ändert die Person die Eingaben, ist es ein neuer Lauf.
//
// EQF-06-K06 — DREI ÜBERGABEARTEN (`UebergabeWahl`, gespeichert in der Routine):
//   · selbstständig: „Ausführen“ führt den einen Planschritt (Anlegen) ohne weitere Rückfrage aus.
//   · Ergebnis zur Prüfung: dasselbe, danach steht der zweite Planschritt „Ergebnis öffnen“ offen;
//     ihn löst die Person aus — der Server bestätigt Ziel und Rechte, dann öffnet sich der Entwurf.
//   · gemeinsam schrittweise: „Lauf vorbereiten“ legt nur den Auftrag an; jeder Planschritt läuft
//     erst auf den Klick der Person. Kein Zeitplan.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { klaraAuftragApi } from "../../api/klaraAuftrag";
import { klaraGespraechApi } from "../../api/klaraGespraech";
import {
  AUSFUEHRUNGSMODI,
  type Ausfuehrungsmodus,
  type Routine,
  vormachenApi,
} from "../../api/vormachen";
import { Button, Field, TextInput } from "../ui";
import { KorrekturSatzFeld } from "./KorrekturSatzFeld";
import { RoutineZeitplan } from "./RoutineZeitplan";

/** Die Schrittschlüssel des Aktionskerns — dieselben wie in der Zeitsteuerung des Servers. */
const SCHRITT_BERICHT = "bericht-1";
const SCHRITT_PRUEFEN = "pruefen-2";

/** Ein angelegter Auftrag dieses Laufs, dessen Planschritte noch (teilweise) offen sind. */
interface OffenerLauf {
  gespraech: string;
  auftrag: string;
  fassung: number;
  plan: { nr: number; aktion: string; ausSchritt: number | null }[];
  erledigt: number[];
}

/** EQF-06-K06: die Übergabeart der Routine wählen. Word kennt kein „schrittweise“. */
export function UebergabeWahl({
  routine,
  onGeaendert,
}: {
  routine: Routine;
  onGeaendert: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const aktuell = routine.ausfuehrung ?? "selbststaendig";
  const arten = AUSFUEHRUNGSMODI.filter((m) => routine.host !== "word" || m !== "schrittweise");
  const waehle = async (art: Ausfuehrungsmodus): Promise<void> => {
    setLaeuft(true);
    setFehler(null);
    try {
      await vormachenApi.setzeAusfuehrung(routine.id, art);
      onGeaendert();
    } catch (e) {
      setFehler(t("vormachen.fehler", { grund: e instanceof Error ? e.message : String(e) }));
    } finally {
      setLaeuft(false);
    }
  };
  return (
    <div className="space-y-1" data-testid="routine-uebergabe" data-art={aktuell}>
      <Field label={t("vormachen.uebergabe.label")}>
        <select
          className="rounded-btn border border-hairline bg-surface px-2 py-1"
          value={aktuell}
          disabled={laeuft}
          onChange={(e) => void waehle(e.target.value as Ausfuehrungsmodus)}
          data-testid="routine-uebergabe-art"
        >
          {arten.map((m) => (
            <option key={m} value={m}>
              {t(`vormachen.uebergabe.${m}`)}
            </option>
          ))}
        </select>
      </Field>
      <p className="text-muted" data-testid="routine-uebergabe-erklaerung">
        {t(`vormachen.uebergabe.erklaerung.${aktuell}`)}
      </p>
      {fehler ? (
        <p role="alert" className="text-trust-crit-text" data-testid="routine-uebergabe-fehler">
          {fehler}
        </p>
      ) : null}
    </div>
  );
}

/** Nur Routinen in Klarwerk, die einen Entwurf anlegen, laufen über diesen Weg. */
export function laeuftHier(r: Routine): boolean {
  return r.host === "klarwerk_web" && r.schritte.some((s) => s.vorgang === "entwurf_anlegen");
}

/** Nacharbeit 41: Word-Routinen, die eine Markierung als Entwurf übernehmen, laufen in Word. */
export function laeuftInWord(r: Routine): boolean {
  return (
    r.host === "word" &&
    r.schritte.some(
      (s) => s.vorgang === "word_auswahl_uebernehmen" || s.vorgang === "word_dokument_uebernehmen",
    )
  );
}

function neueLaufkennung(): string {
  const zufall = Math.random().toString(36).slice(2, 10);
  return `lauf-${Date.now().toString(36)}-${zufall}`;
}

type Ergebnis =
  | { art: "angelegt"; titel: string; pfad: string; wiederholt: boolean }
  | { art: "nicht"; grund: string };

export function RoutineLauf({
  routine,
  onGeaendert,
}: {
  routine: Routine;
  onGeaendert: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [titel, setTitel] = useState("");
  const [inhalt, setInhalt] = useState("");
  // BPA-06: weitere Eingaben einer aus mehreren Vorführungen abgeleiteten Routine (etwa Prüfer).
  const [weitere, setWeitere] = useState<Record<string, string>>({});
  const weitereParameter = (routine.ableitung?.parameter ?? []).filter(
    (p) => p.name !== "titel" && p.name !== "inhalt",
  );
  const [laeuft, setLaeuft] = useState(false);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  // Laufkennung und Gespräch bleiben, bis der Lauf gelungen ist oder sich die Eingaben ändern.
  const [lauf, setLauf] = useState<{ kennung: string; gespraech: string | null } | null>(null);
  // EQF-06-K06: der angelegte Auftrag, solange einer seiner Planschritte offen ist.
  const [offen, setOffen] = useState<OffenerLauf | null>(null);
  const [geprueft, setGeprueft] = useState(false);
  const navigate = useNavigate();
  const pausiert = routine.zustand === "pausiert";
  const art = routine.ausfuehrung ?? "selbststaendig";

  if (!laeuftHier(routine) && !laeuftInWord(routine)) {
    return (
      <p className="text-muted" data-testid="routine-lauf-anderer-host">
        {t("vormachen.lauf.andererHost")}
      </p>
    );
  }

  const eingabeAendern = (setze: (wert: string) => void, wert: string) => {
    setze(wert);
    setLauf(null);
    setErgebnis(null);
    setOffen(null);
    setGeprueft(false);
  };

  const zustandWechseln = async (): Promise<void> => {
    setLaeuft(true);
    setFehler(null);
    try {
      await vormachenApi.setzeRoutinenZustand(routine.id, pausiert ? "aktiv" : "pausiert");
      onGeaendert();
    } catch (e) {
      setFehler(t("vormachen.fehler", { grund: e instanceof Error ? e.message : String(e) }));
    } finally {
      setLaeuft(false);
    }
  };

  // Nacharbeit 41: eine Word-Routine läuft im Word-Fenster (Markierung, Bindung an dieses Word).
  // Hier: wohin, an welches Word gebunden, Pause und Zeitplan — ein fälliger Termin wartet in Word.
  if (laeuftInWord(routine)) {
    const hb = routine.hostbindung ?? null;
    return (
      <section className="space-y-2" data-testid="routine-lauf-word">
        <p className="text-muted">{t("vormachen.lauf.word")}</p>
        <p data-testid="routine-lauf-word-bindung">
          {hb
            ? t("vormachen.lauf.wordGebunden", { fassung: hb.hostVersion })
            : t("vormachen.lauf.wordUngebunden")}
        </p>
        <output
          className="block"
          data-testid="routine-lauf-zustand"
          data-zustand={pausiert ? "pausiert" : "aktiv"}
        >
          {pausiert ? t("vormachen.lauf.pausiert") : t("vormachen.lauf.aktiv")}
        </output>
        <Button
          variant="outline"
          disabled={laeuft}
          data-testid="routine-lauf-pause"
          onClick={() => void zustandWechseln()}
        >
          {pausiert ? t("vormachen.fortsetzen") : t("vormachen.pause")}
        </Button>
        {fehler ? (
          <p role="alert" className="text-trust-crit-text" data-testid="routine-lauf-fehler">
            {fehler}
          </p>
        ) : null}
        <Field label={t("vormachen.lauf.titel")}>
          <TextInput
            value={titel}
            maxLength={300}
            onChange={(e) => setTitel(e.target.value)}
            data-testid="routine-lauf-titel"
          />
        </Field>
        <UebergabeWahl routine={routine} onGeaendert={onGeaendert} />
        {/* AC05: der Titel fälliger Läufe; die Markierung liefert Word beim Start. */}
        <RoutineZeitplan routine={routine} eingaben={{ titel }} onGeaendert={onGeaendert} />
      </section>
    );
  }

  /** Prüft den Lauf am Server und legt seinen gebundenen Auftrag an — ausgeführt wird noch nichts. */
  const legeAuftragAn = async (): Promise<OffenerLauf> => {
    const aktuell = lauf ?? { kennung: neueLaufkennung(), gespraech: null };
    let gespraech = aktuell.gespraech;
    if (!gespraech) {
      const bezug = {
        pfad: window.location.pathname || "/",
        seitenName: t("vormachen.titel"),
        objekt: routine.titel,
      };
      gespraech = (await klaraGespraechApi.beginne(bezug)).gespraech.id;
    }
    setLauf({ kennung: aktuell.kennung, gespraech });
    const r = await vormachenApi.laufe(routine.id, {
      gespraech,
      lauf: aktuell.kennung,
      fassung: routine.fassung,
      eingaben: { ...weitere, titel, inhalt },
    });
    const plan = r.auftrag.plan ?? [{ nr: 1, aktion: "entwurf_erstellen", ausSchritt: null }];
    return { gespraech, auftrag: r.auftrag.id, fassung: r.auftrag.fassung, plan, erledigt: [] };
  };

  /** Planschritt 1 über den Aktionskern: den Bericht anlegen und nachlesen. */
  const legeBerichtAn = async (o: OffenerLauf): Promise<boolean> => {
    const s = await klaraAuftragApi.fuehreAus(o.gespraech, o.auftrag, SCHRITT_BERICHT, {
      nr: 1,
      auftragFassung: o.fassung,
    });
    const e = s.schritt.ergebnis;
    if ((s.schritt.stand === "gespeichert" || s.schritt.stand === "abgeschlossen") && e) {
      setErgebnis({ art: "angelegt", titel: e.titel, pfad: e.pfad, wiederholt: s.wiederholt });
      return true;
    }
    setErgebnis({ art: "nicht", grund: s.schritt.grund ?? t("vormachen.lauf.ohneGrund") });
    return false;
  };

  /**
   * Planschritt 2 („Ergebnis zur Prüfung öffnen“): der Server bestätigt Ziel und Rechte JETZT, erst
   * danach schließt das Öffnen den Schritt ab und der Entwurf öffnet sich.
   */
  const oeffneZurPruefung = async (o: OffenerLauf): Promise<boolean> => {
    const s = await klaraAuftragApi.fuehreAus(o.gespraech, o.auftrag, SCHRITT_PRUEFEN, {
      nr: 2,
      auftragFassung: o.fassung,
    });
    const ziel = s.schritt.geprueft ?? null;
    if (s.schritt.stand === "fehlgeschlagen" || !ziel) {
      setErgebnis({ art: "nicht", grund: s.schritt.grund ?? t("vormachen.lauf.ohneGrund") });
      return false;
    }
    if (s.schritt.stand !== "abgeschlossen") {
      await klaraAuftragApi.schritt(o.gespraech, o.auftrag, SCHRITT_PRUEFEN, {
        nr: 2,
        aktion: "oeffnen",
        ziel: s.schritt.ziel,
        auftragFassung: o.fassung,
        stand: "abgeschlossen",
      });
    }
    setGeprueft(true);
    navigate(ziel.pfad);
    return true;
  };

  /** Führt genau den Planschritt `nr` aus und merkt ihn als erledigt. */
  const schritt = async (o: OffenerLauf, nr: number): Promise<OffenerLauf | null> => {
    const gelungen = nr === 1 ? await legeBerichtAn(o) : await oeffneZurPruefung(o);
    if (!gelungen) {
      return o;
    }
    const weiter = { ...o, erledigt: [...o.erledigt, nr] };
    // Alle Planschritte erledigt: der Lauf ist fertig, ein neuer Klick ist ein neuer Lauf.
    if (weiter.plan.every((p) => weiter.erledigt.includes(p.nr))) {
      setLauf(null);
      return null;
    }
    return weiter;
  };

  const tu = async (f: () => Promise<void>): Promise<void> => {
    setLaeuft(true);
    setFehler(null);
    try {
      await f();
    } catch (e) {
      setFehler(t("vormachen.fehler", { grund: e instanceof Error ? e.message : String(e) }));
    } finally {
      setLaeuft(false);
    }
  };

  const ausfuehren = (): Promise<void> =>
    tu(async () => {
      setErgebnis(null);
      setGeprueft(false);
      const o = offen ?? (await legeAuftragAn());
      // Gemeinsam schrittweise: nur anlegen — jeden Schritt löst die Person unten aus.
      if (art === "schrittweise") {
        setOffen(o);
        return;
      }
      // Selbstständig und Ergebnis zur Prüfung: der Anlageschritt ohne weitere Rückfrage. Bei
      // „Ergebnis zur Prüfung“ bleibt danach das Öffnen für die Person offen.
      setOffen(o.erledigt.includes(1) ? o : await schritt(o, 1));
    });

  const naechster = offen?.plan.find((p) => !offen.erledigt.includes(p.nr)) ?? null;
  // Ein angelegter Lauf geht über seine Schritte weiter (schrittweise bzw. zur Prüfung offen).
  const angelegt = offen !== null && (art === "schrittweise" || offen.erledigt.length > 0);
  const schrittText = (p: OffenerLauf["plan"][number]): string =>
    p.aktion === "oeffnen"
      ? t("vormachen.lauf.schritt.pruefen")
      : t("vormachen.lauf.schritt.entwurf", { titel });

  return (
    <section className="space-y-2" data-testid="routine-lauf">
      <output
        className="block"
        data-testid="routine-lauf-zustand"
        data-zustand={pausiert ? "pausiert" : "aktiv"}
      >
        {pausiert ? t("vormachen.lauf.pausiert") : t("vormachen.lauf.aktiv")}
      </output>
      <Button
        variant="outline"
        disabled={laeuft}
        data-testid="routine-lauf-pause"
        onClick={() => void zustandWechseln()}
      >
        {pausiert ? t("vormachen.fortsetzen") : t("vormachen.pause")}
      </Button>
      <p className="text-muted">{t("vormachen.lauf.hinweis")}</p>
      <Field label={t("vormachen.lauf.titel")}>
        <TextInput
          value={titel}
          maxLength={300}
          onChange={(e) => eingabeAendern(setTitel, e.target.value)}
          data-testid="routine-lauf-titel"
        />
      </Field>
      <Field label={t("vormachen.lauf.inhalt")}>
        <TextInput
          value={inhalt}
          maxLength={2000}
          onChange={(e) => eingabeAendern(setInhalt, e.target.value)}
          data-testid="routine-lauf-inhalt"
        />
      </Field>
      {weitereParameter.map((p) => (
        <Field key={p.name} label={t("vormachen.lauf.eingabe", { name: p.beschriftung })}>
          <TextInput
            value={weitere[p.name] ?? ""}
            maxLength={300}
            onChange={(e) => {
              const wert = e.target.value;
              eingabeAendern((w) => setWeitere((alt) => ({ ...alt, [p.name]: w })), wert);
            }}
            data-testid={`routine-lauf-eingabe-${p.name}`}
          />
        </Field>
      ))}
      {/* Eine andere Übergabeart ist ein neuer Lauf: der offene bleibt bei seiner Art stehen. */}
      <UebergabeWahl
        routine={routine}
        onGeaendert={() => {
          setOffen(null);
          setLauf(null);
          setErgebnis(null);
          setGeprueft(false);
          onGeaendert();
        }}
      />
      <Button
        variant="primary"
        disabled={laeuft || pausiert || titel.trim() === "" || angelegt}
        data-testid="routine-lauf-ausfuehren"
        onClick={() => void ausfuehren()}
      >
        {art === "schrittweise" ? t("vormachen.lauf.vorbereiten") : t("vormachen.lauf.ausfuehren")}
      </Button>
      {fehler ? (
        <p role="alert" className="text-trust-crit-text" data-testid="routine-lauf-fehler">
          {fehler}
        </p>
      ) : null}
      {/* EQF-06-K06: die Planschritte des Aktionskerns, solange einer offen ist. */}
      {offen && art === "schrittweise" ? (
        <ol className="list-decimal space-y-1 pl-5" data-testid="routine-lauf-schritte">
          {offen.plan.map((p) => (
            <li
              key={p.nr}
              data-testid={`routine-lauf-schritt-${p.nr}`}
              data-erledigt={offen.erledigt.includes(p.nr) ? "ja" : "nein"}
            >
              {schrittText(p)}
              {offen.erledigt.includes(p.nr) ? ` · ${t("vormachen.lauf.schritt.erledigt")}` : ""}
            </li>
          ))}
        </ol>
      ) : null}
      {offen && naechster && art === "schrittweise" ? (
        <Button
          variant="outline"
          disabled={laeuft || pausiert}
          data-testid="routine-lauf-naechster"
          onClick={() => void tu(async () => setOffen(await schritt(offen, naechster.nr)))}
        >
          {t("vormachen.lauf.schritt.ausfuehren", { schritt: schrittText(naechster) })}
        </Button>
      ) : null}
      {offen && naechster?.aktion === "oeffnen" && art === "zur_pruefung" ? (
        <span className="block space-y-1">
          <output className="block" data-testid="routine-lauf-wartet-pruefung">
            {t("vormachen.lauf.wartetPruefung")}
          </output>
          <Button
            variant="outline"
            disabled={laeuft}
            data-testid="routine-lauf-pruefen"
            onClick={() => void tu(async () => setOffen(await schritt(offen, naechster.nr)))}
          >
            {t("vormachen.lauf.pruefen")}
          </Button>
        </span>
      ) : null}
      {geprueft ? (
        <output className="block" data-testid="routine-lauf-geprueft">
          {t("vormachen.lauf.geprueft")}
        </output>
      ) : null}
      {ergebnis?.art === "angelegt" ? (
        <output className="block" data-testid="routine-lauf-ergebnis">
          {t("vormachen.lauf.angelegt", { titel: ergebnis.titel })}{" "}
          <a href={ergebnis.pfad} data-testid="routine-lauf-ergebnis-link">
            {t("vormachen.lauf.oeffnen")}
          </a>
        </output>
      ) : null}
      {ergebnis?.art === "nicht" ? (
        <output className="block text-trust-warn-text" data-testid="routine-lauf-nicht">
          {t("vormachen.lauf.nicht", { grund: ergebnis.grund })}
        </output>
      ) : null}
      {/* EQF-06-K10: „Beachte meine Korrektur künftig“ — die nächste Fassung, mit Quelle. */}
      {routine.ableitung ? (
        <section className="space-y-2" data-testid="routine-korrektur">
          <p data-testid="routine-fassung">
            {t("vormachen.korrektur.fassung", { fassung: routine.fassung })}
          </p>
          {(routine.versionen ?? []).length > 0 ? (
            <ul className="list-disc pl-5" data-testid="routine-versionen">
              {(routine.versionen ?? []).map((v) => (
                <li key={v.fassung}>
                  {t("vormachen.korrektur.version", {
                    fassung: v.fassung,
                    am: v.am.slice(0, 10),
                    worte: v.quelle?.wortlaut ?? v.art,
                  })}
                </li>
              ))}
            </ul>
          ) : null}
          <KorrekturSatzFeld
            testid="routine-korrektur-satz"
            schritte={routine.ableitung.schritte.map((x) => ({
              nr: x.nr,
              text: x.ziel?.name ?? x.frage ?? x.art,
            }))}
            sende={async (k) => {
              const antwort = await vormachenApi.korrigiereRoutine(routine.id, routine.fassung, k);
              onGeaendert();
              return t("vormachen.korrektur.neueFassung", { fassung: antwort.routine.fassung });
            }}
          />
        </section>
      ) : null}
      {/* AC05: dieselben Eingaben für fällige Läufe aus dem Zeitplan — nicht bei „schrittweise“. */}
      {art === "schrittweise" ? null : (
        <RoutineZeitplan
          routine={routine}
          eingaben={{ ...weitere, titel, inhalt }}
          onGeaendert={onGeaendert}
        />
      )}
    </section>
  );
}
