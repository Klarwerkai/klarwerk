// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · BPA-06 AC05 — ZEITPLAN EINER ROUTINE BEDIENEN.
// ================================================================================================
//
// Unter „Ausführen“ in „Meine Routinen“ (`RoutineLauf`): sofort einmal, einmal ab Datum oder jede
// Woche — mit Zeitzone (Vorgabe: die des Geräts) und Nachholregel. Gespeichert wird über den
// vorhandenen Weg (`PUT /api/me/vormachen/routinen/:id/zeitplan`) zusammen mit den Eingaben, die
// oben für diesen Lauf stehen; ausgeführt wird dann von der Zeitsteuerung des Servers über denselben
// Laufweg und Aktionskern. Eine pausierte Routine läuft auch nach Plan nicht.
//
// EQF-06-K05 — „bei einem Ereignis“: die Person sagt in eigenen Worten, wann (oder wählt aus der
// Rückfrage). Der Server übernimmt nur ein eindeutiges Ereignis und fragt sonst gezielt nach; die
// Wahl steht danach im Zeitplan der Routine. Ausgelöst wird im Takt derselben Zeitsteuerung.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type EreignisKlaerung,
  type Routine,
  type RoutinenEreignis,
  type RoutinenZeitplan,
  ereignisKlaerung,
  vormachenApi,
} from "../../api/vormachen";
import { Button, Field, TextInput } from "../ui";

type Art = RoutinenZeitplan["art"];
type Nachholen = "einmal_nachholen" | "auslassen";

const ARTEN: readonly Art[] = ["sofort", "ab_datum", "woechentlich", "bei_ereignis"];

/**
 * EQF-06-K05: liegt die eingegebene Startzeit (Ortszeit des Geräts) schon zurück? Dann läuft der
 * Termin beim nächsten Takt einmal nachgeholt — das steht sichtbar da, bevor gespeichert wird.
 */
export function startVergangen(start: string, jetzt: number = Date.now()): boolean {
  const ms = Date.parse(start);
  return start !== "" && Number.isFinite(ms) && ms < jetzt;
}
const TAGE = [1, 2, 3, 4, 5, 6, 7] as const;
const AUSWAHL =
  "h-10 w-full rounded-input border border-hairline bg-surface px-3 text-sm text-text outline-none";

function geraetezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin";
  } catch {
    return "Europe/Berlin";
  }
}

export function RoutineZeitplan({
  routine,
  eingaben,
  onGeaendert,
}: {
  routine: Routine;
  /** Die Eingaben, mit denen fällige Läufe den Bericht anlegen (Titel, Kernaussage …). */
  eingaben: Record<string, string>;
  onGeaendert: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [art, setArt] = useState<Art>("woechentlich");
  const [start, setStart] = useState("");
  const [wochentag, setWochentag] = useState(1);
  const [uhrzeit, setUhrzeit] = useState("08:00");
  const [ab, setAb] = useState("");
  const [zeitzone, setZeitzone] = useState(geraetezone);
  const [nachholen, setNachholen] = useState<Nachholen>("einmal_nachholen");
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ereignisText, setEreignisText] = useState("");
  const [klaerung, setKlaerung] = useState<EreignisKlaerung | null>(null);

  // Eine Word-Routine braucht das geöffnete Word — sie startet nicht bei einem Ereignis.
  const arten = ARTEN.filter((a) => routine.host !== "word" || a !== "bei_ereignis");
  const aktuell = routine.zeitplan ?? null;
  const beschreibung = (z: RoutinenZeitplan): string => {
    if (z.art === "sofort") {
      return t("vormachen.zeitplan.aktuell.sofort");
    }
    if (z.art === "ab_datum") {
      return t("vormachen.zeitplan.aktuell.ab_datum", { start: z.start, zeitzone: z.zeitzone });
    }
    if (z.art === "bei_ereignis") {
      const ereignis = t(`vormachen.zeitplan.ereignis.${z.ereignis ?? "unklar"}`);
      return t("vormachen.zeitplan.aktuell.bei_ereignis", { ereignis });
    }
    const tag = t(`vormachen.zeitplan.tag.${z.wochentag}`);
    return t("vormachen.zeitplan.aktuell.woechentlich", {
      tag,
      uhrzeit: z.uhrzeit,
      zeitzone: z.zeitzone,
    });
  };

  const zeitplan = (): RoutinenZeitplan => {
    if (art === "sofort") {
      return { art };
    }
    if (art === "ab_datum") {
      return { art, start, zeitzone };
    }
    if (art === "bei_ereignis") {
      return { art, beschreibung: ereignisText.trim() };
    }
    return { art, wochentag, uhrzeit, zeitzone, nachholen, ...(ab ? { ab } : {}) };
  };

  const speichere = async (z: RoutinenZeitplan | null): Promise<void> => {
    setLaeuft(true);
    setFehler(null);
    setMeldung(null);
    setKlaerung(null);
    try {
      await vormachenApi.setzeZeitplan(routine.id, z, z ? eingaben : {});
      setMeldung(z ? t("vormachen.zeitplan.gespeichert") : t("vormachen.zeitplan.entfernt"));
      onGeaendert();
    } catch (e) {
      // EQF-06-K05: unklare Ereignisquelle — die Rückfrage des Servers mit ihrer Wahl zeigen.
      const k = ereignisKlaerung(e);
      if (k) {
        setKlaerung(k);
      } else {
        setFehler(t("vormachen.fehler", { grund: e instanceof Error ? e.message : String(e) }));
      }
    } finally {
      setLaeuft(false);
    }
  };

  const waehleEreignis = (ereignis: RoutinenEreignis): Promise<void> =>
    speichere({ art: "bei_ereignis", ereignis });

  const unvollstaendig =
    (eingaben.titel ?? "").trim() === "" ||
    (art === "ab_datum" && start === "") ||
    (art === "bei_ereignis" && ereignisText.trim() === "");

  return (
    <section className="space-y-2" data-testid="routine-zeitplan">
      <h4 className="font-medium">{t("vormachen.zeitplan.titel")}</h4>
      <output className="block" data-testid="routine-zeitplan-aktuell">
        {aktuell ? beschreibung(aktuell) : t("vormachen.zeitplan.keiner")}
      </output>
      <p className="text-muted">{t("vormachen.zeitplan.hinweis")}</p>
      <Field label={t("vormachen.zeitplan.art")}>
        <select
          className={AUSWAHL}
          value={art}
          onChange={(e) => setArt(e.target.value as Art)}
          data-testid="routine-zeitplan-art"
        >
          {arten.map((a) => (
            <option key={a} value={a}>
              {t(`vormachen.zeitplan.art.${a}`)}
            </option>
          ))}
        </select>
      </Field>
      {art === "ab_datum" ? (
        <Field label={t("vormachen.zeitplan.start")}>
          <TextInput
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            data-testid="routine-zeitplan-start"
          />
        </Field>
      ) : null}
      {/* EQF-06-K05: ein vergangenes Startdatum hat eine SICHTBARE Nachholregel. */}
      {art === "ab_datum" && startVergangen(start) ? (
        <p className="text-trust-warn-text" data-testid="routine-zeitplan-nachholen-hinweis">
          {t("vormachen.zeitplan.vergangen")}
        </p>
      ) : null}
      {art === "woechentlich" ? (
        <>
          <Field label={t("vormachen.zeitplan.wochentag")}>
            <select
              className={AUSWAHL}
              value={wochentag}
              onChange={(e) => setWochentag(Number(e.target.value))}
              data-testid="routine-zeitplan-wochentag"
            >
              {TAGE.map((n) => (
                <option key={n} value={n}>
                  {t(`vormachen.zeitplan.tag.${n}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("vormachen.zeitplan.uhrzeit")}>
            <TextInput
              type="time"
              value={uhrzeit}
              onChange={(e) => setUhrzeit(e.target.value)}
              data-testid="routine-zeitplan-uhrzeit"
            />
          </Field>
          <Field label={t("vormachen.zeitplan.ab")}>
            <TextInput
              type="date"
              value={ab}
              onChange={(e) => setAb(e.target.value)}
              data-testid="routine-zeitplan-ab"
            />
          </Field>
          <Field label={t("vormachen.zeitplan.nachholen")}>
            <select
              className={AUSWAHL}
              value={nachholen}
              onChange={(e) => setNachholen(e.target.value as Nachholen)}
              data-testid="routine-zeitplan-nachholen"
            >
              <option value="einmal_nachholen">
                {t("vormachen.zeitplan.nachholen.einmal_nachholen")}
              </option>
              <option value="auslassen">{t("vormachen.zeitplan.nachholen.auslassen")}</option>
            </select>
          </Field>
        </>
      ) : null}
      {art === "bei_ereignis" ? (
        <Field label={t("vormachen.zeitplan.ereignis.frage")}>
          <TextInput
            value={ereignisText}
            maxLength={300}
            placeholder={t("vormachen.zeitplan.ereignis.beispiel")}
            onChange={(e) => setEreignisText(e.target.value)}
            data-testid="routine-zeitplan-ereignis-text"
          />
        </Field>
      ) : null}
      {klaerung ? (
        <div className="space-y-1" data-testid="routine-zeitplan-ereignis-klaerung">
          <p>{klaerung.message}</p>
          <div className="flex flex-wrap gap-2">
            {klaerung.optionen.map((o) => (
              <Button
                key={o.ereignis}
                variant="outline"
                disabled={laeuft}
                data-testid={`routine-zeitplan-ereignis-${o.ereignis}`}
                onClick={() => void waehleEreignis(o.ereignis)}
              >
                {t(`vormachen.zeitplan.ereignis.${o.ereignis}`)}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
      {art !== "sofort" && art !== "bei_ereignis" ? (
        <Field label={t("vormachen.zeitplan.zeitzone")}>
          <TextInput
            value={zeitzone}
            maxLength={64}
            onChange={(e) => setZeitzone(e.target.value)}
            data-testid="routine-zeitplan-zeitzone"
          />
        </Field>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={laeuft || unvollstaendig}
          data-testid="routine-zeitplan-speichern"
          onClick={() => void speichere(zeitplan())}
        >
          {t("vormachen.zeitplan.speichern")}
        </Button>
        {aktuell ? (
          <Button
            variant="outline"
            disabled={laeuft}
            data-testid="routine-zeitplan-entfernen"
            onClick={() => void speichere(null)}
          >
            {t("vormachen.zeitplan.entfernen")}
          </Button>
        ) : null}
      </div>
      {meldung ? (
        <output className="block" data-testid="routine-zeitplan-meldung">
          {meldung}
        </output>
      ) : null}
      {fehler ? (
        <p role="alert" className="text-trust-crit-text" data-testid="routine-zeitplan-fehler">
          {fehler}
        </p>
      ) : null}
    </section>
  );
}
