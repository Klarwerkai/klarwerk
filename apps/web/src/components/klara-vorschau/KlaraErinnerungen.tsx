// ================================================================================================
// KLARA 10 (produkt:20261007:klara-erinnerungen-kalender) — DIE PERSÖNLICHEN ERINNERUNGEN, SO WIE
// SIE AM SERVER SIND.
// ================================================================================================
//
// Dieselbe Fläche in Klara und auf „Meine Aufgaben“ (`pages/MyTasks.tsx`):
//   · ENTWURF aus Gesprächsnachricht, Notiz, Aufgabe oder frei. Eine Freitextangabe („morgen um
//     neun“) deutet der Server; ist sie mehrdeutig, stehen die Möglichkeiten zur Wahl. Vor dem
//     Speichern zeigt die Vorschau Datum, lokale Uhrzeit, IANA-Zeitzone mit Versatz, die nächsten
//     Ausführungen, Serienende bzw. Frist, Sommerzeitlage, Ziel (Glocke) und erwartetes Ergebnis.
//     „Abbrechen“ speichert nichts — Schließen ist keine Zustimmung.
//   · LISTE mit der Lage aus den tatsächlichen Läufen (geplant, fällig, läuft, wartet auf Klärung,
//     teilweise erledigt, abgeschlossen, fehlgeschlagen …), getrennter Bedienung für die ganze
//     Erinnerung (erledigen, pausieren/fortsetzen, absagen, zurücknehmen, beenden, löschen), für EINEN
//     Termin (absagen, verschieben) und für „diesen und alle folgenden“ — sowie die Entscheidung zu
//     einem Lauf, der auf Klärung wartet.
//   · ÜBERGABE (AW18-K08) an eine heute aktive Person — nur für reine Erinnerungen; die Zuständige
//     sieht unter „Mir übergeben“ Titel und Termine, nie Notiz, Bezug oder Ergebnisse.
//   · EINRICHTUNGSASSISTENT (P07, Zauberhut): freiwillig, jederzeit erneut aufrufbar; Zeitzone und
//     Regeln werden Vorgaben für neue Erinnerungen. Schließen speichert nichts.
import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import {
  type ErinnerungAktion,
  type ErinnerungAnzeige,
  type ErinnerungLauf,
  type ErinnerungVorschau,
  type ErinnerungZeitplan,
  type ErinnerungZeitpunkt,
  type KlaraErinnerung,
  type RoutineAbschnitt,
  type RoutineErgebnis,
  type UebernommeneErinnerung,
  type VerpasstRegel,
  klaraErinnerungApi,
} from "../../api/klaraErinnerung";
import { useAssistenzT } from "../../lib/assistenzProfil";
import { vorgabeZeitzone } from "../../lib/persoenlicheZeitzone";
import {
  bediene,
  bezugAnzeige,
  deuteRoutine,
  erinnerungFehler,
  geraeteZeitzone,
  gibErinnerungZurueck,
  holeErinnerung,
  ladeEinstellungen,
  ladeErinnerungen,
  loescheErinnerung,
  nimmRoutineErgebnisZurueck,
  oeffneAssistent,
  schliesseAssistent,
  speichereEinstellungen,
  speichereEntwurf,
  starteEntwurf,
  uebernimmRoutine,
  useErinnerungen,
  verwirfEntwurf,
} from "./erinnerungen";
import { ruecklinkZiel } from "./notizen";

const KNOPF =
  "inline-flex h-8 items-center gap-1 rounded-btn border border-hairline bg-surface px-2.5 text-[12px] font-semibold text-text hover:border-ink/30 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const KNOPF_HAUPT =
  "inline-flex h-8 items-center rounded-btn border border-ink bg-ink px-2.5 text-[12px] font-semibold text-white hover:bg-ink/90 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const KLEINTITEL = "font-mono text-klein font-semibold uppercase tracking-wider text-muted-2";
const SCHILD = "rounded-pill px-1.5 py-0.5 font-mono text-klein font-semibold uppercase";
const FELD =
  "mt-0.5 w-full rounded-input border border-hairline bg-surface px-2 py-1.5 text-[12.5px] text-text outline-none focus:border-ink/30";
const AUSWAHL = "h-7 rounded-input border border-hairline bg-surface px-1.5 text-[12px] text-text";

const ZONEN_VORSCHLAG = [
  "Europe/Berlin",
  "Europe/Vienna",
  "Europe/Zurich",
  "Europe/Amsterdam",
  "Europe/London",
  "America/New_York",
  "Asia/Tokyo",
  "UTC",
];
const ROUTINE_ABSCHNITTE: readonly RoutineAbschnitt[] = [
  "offene_aufgaben",
  "erledigte_aufgaben",
  "neue_notizen",
];
const VERPASST: readonly VerpasstRegel[] = [
  "nachholen",
  "nur_melden",
  "zusammenfassen",
  "ueberspringen",
];

type T = ReturnType<typeof useAssistenzT>["t"];

function zonen(aktuell: string): string[] {
  return [...new Set([aktuell, geraeteZeitzone(), ...ZONEN_VORSCHLAG])];
}

/** Datum und Uhrzeit IN DER ZONE der Erinnerung, mit Wochentag. */
function zeitText(z: ErinnerungZeitpunkt, zone: string, sprache: string): string {
  if (!z.zeitpunkt) {
    return `${datumText(z.datum, sprache)} ${z.uhrzeit}`;
  }
  return new Date(z.zeitpunkt).toLocaleString(sprache, {
    timeZone: zone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Ein ganztägiges Datum — bewusst ohne Zone gerechnet, damit es sich nie um einen Tag verschiebt. */
function datumText(datum: string, sprache: string): string {
  return new Date(`${datum}T12:00:00Z`).toLocaleDateString(sprache, {
    timeZone: "UTC",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function wiederholungText(p: ErinnerungZeitplan, t: T): string {
  if (p.art === "einmalig") {
    return t("klaraerinnerung.plan.einmalig");
  }
  if (p.art === "frist") {
    return t("klaraerinnerung.plan.frist", { tage: p.vorlaufTage });
  }
  return t(`klaraerinnerung.takt.${p.wiederholung.takt}`, { n: p.wiederholung.intervall });
}

function serienendeText(a: ErinnerungAnzeige, sprache: string, t: T): string {
  const s = a.serienende;
  if (s.art === "einmalig") {
    return t("klaraerinnerung.ende.einmalig");
  }
  if (s.art === "datum") {
    return t("klaraerinnerung.ende.datum", { datum: datumText(s.bis, sprache) });
  }
  if (s.art === "anzahl") {
    return t("klaraerinnerung.ende.anzahl", { anzahl: s.anzahl });
  }
  return t("klaraerinnerung.ende.offen", { anzahl: s.hoechstens });
}

/** AW18-K01: alles, was eine Erinnerung zusagt — vor dem Speichern UND danach dieselbe Darstellung. */
function Zeitanzeige({
  anzeige,
  zone,
  plan,
}: {
  anzeige: ErinnerungAnzeige;
  zone: string;
  plan: ErinnerungZeitplan;
}): JSX.Element {
  const { t, i18n } = useAssistenzT();
  const sprache = i18n.language;
  const naechste = anzeige.naechste;
  return (
    <dl data-testid="klara-erinnerung-anzeige" className="mt-1 space-y-0.5 text-[11.5px] text-text">
      <div className="flex flex-wrap gap-1">
        <dt className="text-muted">{t("klaraerinnerung.anzeige.naechste")}</dt>
        <dd data-testid="klara-erinnerung-naechste" data-zeitpunkt={naechste?.zeitpunkt ?? ""}>
          {naechste ? zeitText(naechste, zone, sprache) : t("klaraerinnerung.anzeige.keine")}
        </dd>
      </div>
      <div className="flex flex-wrap gap-1">
        <dt className="text-muted">{t("klaraerinnerung.anzeige.zone")}</dt>
        <dd data-testid="klara-erinnerung-zone">
          {naechste
            ? t("klaraerinnerung.anzeige.zoneMitVersatz", { zone, versatz: naechste.versatz })
            : zone}
        </dd>
      </div>
      <div className="flex flex-wrap gap-1">
        <dt className="text-muted">{t("klaraerinnerung.anzeige.wiederholung")}</dt>
        <dd data-testid="klara-erinnerung-wiederholung">
          {wiederholungText(plan, t)} · {serienendeText(anzeige, sprache, t)}
        </dd>
      </div>
      {anzeige.frist ? (
        <div className="flex flex-wrap gap-1">
          <dt className="text-muted">{t("klaraerinnerung.anzeige.frist")}</dt>
          <dd data-testid="klara-erinnerung-frist" data-datum={anzeige.frist.datum}>
            {t("klaraerinnerung.anzeige.fristText", {
              datum: datumText(anzeige.frist.datum, sprache),
              tage: anzeige.frist.vorlaufTage,
            })}
          </dd>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-1">
        <dt className="text-muted">{t("klaraerinnerung.anzeige.ziel")}</dt>
        <dd data-testid="klara-erinnerung-ziel" data-ziel={anzeige.ziel}>
          {t("klaraerinnerung.ziel.glocke")}
        </dd>
      </div>
      <div className="flex flex-wrap gap-1">
        <dt className="text-muted">{t("klaraerinnerung.anzeige.ergebnis")}</dt>
        <dd data-testid="klara-erinnerung-ergebnis">
          {t(`klaraerinnerung.ergebnis.${anzeige.erwartetesErgebnis}`)}
        </dd>
      </div>
      {anzeige.kommende.length > 1 ? (
        <div className="flex flex-wrap gap-1">
          <dt className="text-muted">{t("klaraerinnerung.anzeige.kommende")}</dt>
          <dd>
            <ul data-testid="klara-erinnerung-kommende">
              {anzeige.kommende.slice(1).map((k) => (
                <li key={k.vorkommenId}>{zeitText(k, zone, sprache)}</li>
              ))}
            </ul>
          </dd>
        </div>
      ) : null}
      {anzeige.sommerzeitHinweise.length > 0 ? (
        <ul
          data-testid="klara-erinnerung-sommerzeit"
          className="rounded-btn bg-trust-warn-bg px-2 py-1 text-trust-warn-text"
        >
          {anzeige.sommerzeitHinweise.map((h) => (
            <li key={h.vorkommenId} data-hinweis={h.hinweis ?? ""}>
              {t(`klaraerinnerung.sommerzeit.${h.hinweis ?? "luecke_verschoben"}`, {
                termin: zeitText(h, zone, sprache),
              })}
            </li>
          ))}
        </ul>
      ) : null}
    </dl>
  );
}

// ------------------------------------------------------------------------------------------------
// Der Entwurf
// ------------------------------------------------------------------------------------------------

type PlanArt = "einmalig" | "serie" | "frist";

function zeitplanAusFeldern(f: {
  art: PlanArt;
  datum: string;
  uhrzeit: string;
  takt: "taeglich" | "woechentlich" | "monatlich";
  intervall: number;
  ende: "offen" | "datum" | "anzahl";
  bis: string;
  anzahl: number;
  fristDatum: string;
  vorlaufTage: number;
}): ErinnerungZeitplan | null {
  const datumOk = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (!/^\d{2}:\d{2}$/.test(f.uhrzeit)) {
    return null;
  }
  if (f.art === "frist") {
    return datumOk(f.fristDatum)
      ? { art: "frist", fristDatum: f.fristDatum, vorlaufTage: f.vorlaufTage, uhrzeit: f.uhrzeit }
      : null;
  }
  if (!datumOk(f.datum)) {
    return null;
  }
  if (f.art === "einmalig") {
    return { art: "einmalig", datum: f.datum, uhrzeit: f.uhrzeit };
  }
  if (f.ende === "datum" && !datumOk(f.bis)) {
    return null;
  }
  return {
    art: "serie",
    datum: f.datum,
    uhrzeit: f.uhrzeit,
    wiederholung: {
      takt: f.takt,
      intervall: f.intervall,
      wochentage: [],
      bis: f.ende === "datum" ? f.bis : null,
      anzahl: f.ende === "anzahl" ? f.anzahl : null,
    },
  };
}

function EntwurfFormular(): JSX.Element | null {
  const { t, i18n } = useAssistenzT();
  const richtung = i18n.dir(i18n.language);
  const id = useId();
  const s = useErinnerungen();
  const entwurf = s.entwurf;
  const [titel, setTitel] = useState(entwurf?.titel ?? "");
  const [text, setText] = useState("");
  const [art, setArt] = useState<PlanArt>("einmalig");
  const [datum, setDatum] = useState("");
  const [uhrzeit, setUhrzeit] = useState("");
  const [takt, setTakt] = useState<"taeglich" | "woechentlich" | "monatlich">("woechentlich");
  const [intervall, setIntervall] = useState(1);
  const [ende, setEnde] = useState<"offen" | "datum" | "anzahl">("offen");
  const [bis, setBis] = useState("");
  const [anzahl, setAnzahl] = useState(10);
  const [fristDatum, setFristDatum] = useState("");
  const [vorlaufTage, setVorlaufTage] = useState(1);
  const [zone, setZone] = useState(vorgabeZeitzone());
  const [luecke, setLuecke] = useState<"verschieben" | "auslassen">("verschieben");
  const [doppelt, setDoppelt] = useState<"erste" | "zweite">("erste");
  const [regel, setRegel] = useState<VerpasstRegel>("nachholen");
  const [grenze, setGrenze] = useState(30);
  const [aktion, setAktion] = useState<ErinnerungAktion>("erinnern");
  // EQF-07: die Abschnitte eines Routinenberichts.
  const [abschnitte, setAbschnitte] = useState<RoutineAbschnitt[]>([
    "offene_aufgaben",
    "erledigte_aufgaben",
  ]);
  const [deutung, setDeutung] = useState<ErinnerungVorschau["deutung"]>(null);
  const [vorschau, setVorschau] = useState<ErinnerungVorschau | null>(null);
  const [vorschauFehler, setVorschauFehler] = useState<string | null>(null);

  const vorgang = entwurf?.vorgang ?? "";
  // Ein neuer Entwurf (anderer Vorgang) beginnt mit seinem eigenen Titelvorschlag — und mit den im
  // Einrichtungsassistenten gewählten Vorgaben (P07: Zeitzone, Sommerzeit- und Verpasst-Regel).
  // biome-ignore lint/correctness/useExhaustiveDependencies: der Vorgangswechsel ist der Auslöser.
  useEffect(() => {
    setTitel(entwurf?.titel ?? "");
    setDeutung(null);
    setAktion("erinnern");
    const v = s.einstellungen;
    if (v) {
      setZone(v.zeitzone ?? vorgabeZeitzone());
      setLuecke(v.sommerzeit.luecke);
      setDoppelt(v.sommerzeit.doppelt);
      setRegel(v.verpasst.regel);
      setGrenze(v.verpasst.grenzeMinuten);
    }
  }, [vorgang]);

  const plan = zeitplanAusFeldern({
    art,
    datum,
    uhrzeit,
    takt,
    intervall,
    ende,
    bis,
    anzahl,
    fristDatum,
    vorlaufTage,
  });
  const planSchluessel = JSON.stringify(plan);
  // Jede Änderung des Zeitplans zeigt sofort, was der Server daraus macht — nichts wird gespeichert.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `planSchluessel` vertritt den Zeitplan.
  useEffect(() => {
    if (!plan) {
      setVorschau(null);
      return;
    }
    let gilt = true;
    klaraErinnerungApi
      .vorschau({ zeitplan: plan, zeitzone: zone, sommerzeit: { luecke, doppelt }, aktion })
      .then((v) => {
        if (gilt) {
          setVorschau(v);
          setVorschauFehler(null);
        }
      })
      .catch((fehler: unknown) => {
        if (gilt) {
          setVorschau(null);
          setVorschauFehler(erinnerungFehler(fehler, t));
        }
      });
    return () => {
      gilt = false;
    };
  }, [planSchluessel, zone, luecke, doppelt, aktion]);

  if (!entwurf) {
    return null;
  }
  const deuten = async (): Promise<void> => {
    try {
      const v = await klaraErinnerungApi.vorschau({ text, zeitzone: zone });
      setDeutung(v.deutung);
      if (v.deutung?.art === "eindeutig") {
        setArt("einmalig");
        setDatum(v.deutung.datum);
        setUhrzeit(v.deutung.uhrzeit);
      }
      setVorschauFehler(null);
    } catch (fehler) {
      setVorschauFehler(erinnerungFehler(fehler, t));
    }
  };
  const waehle = (o: { datum: string; uhrzeit: string }): void => {
    setArt("einmalig");
    setDatum(o.datum);
    setUhrzeit(o.uhrzeit);
    setDeutung(null);
  };
  const laeuft = entwurf.stand === "laeuft";
  const routine = aktion === "routine_bericht";
  const bereit =
    plan !== null &&
    vorschau?.anzeige?.naechste != null &&
    titel.trim().length > 0 &&
    (!routine || abschnitte.length > 0);
  const speichern = (): void => {
    if (!plan) {
      return;
    }
    void speichereEntwurf(
      {
        titel: titel.trim(),
        zeitzone: zone,
        zeitplan: plan,
        sommerzeit: { luecke, doppelt },
        verpasst: { regel, grenzeMinuten: grenze },
        aktion,
        ...(routine ? { routine: { abschnitte } } : {}),
      },
      t,
    );
  };

  return (
    <div
      data-testid="klara-erinnerung-entwurf"
      data-stand={entwurf.stand}
      className="space-y-1.5 rounded-btn border border-ai/40 bg-ai-surface-2 px-2 py-1.5"
    >
      <p data-testid="klara-erinnerung-entwurf-bezug" className="text-[11px] text-muted">
        {entwurf.bezugText}
      </p>
      <label htmlFor={`${id}-titel`} className={`${KLEINTITEL} block`}>
        {t("klaraerinnerung.feld.titel")}
      </label>
      <input
        id={`${id}-titel`}
        data-testid="klara-erinnerung-titel"
        value={titel}
        maxLength={200}
        onChange={(e) => setTitel(e.target.value)}
        className={`${FELD} h-8`}
      />

      <label htmlFor={`${id}-text`} className={`${KLEINTITEL} block`}>
        {t("klaraerinnerung.feld.wann")}
      </label>
      <div className="flex flex-wrap gap-1.5">
        <input
          id={`${id}-text`}
          data-testid="klara-erinnerung-wann"
          value={text}
          maxLength={500}
          placeholder={t("klaraerinnerung.feld.wannBeispiel")}
          onChange={(e) => setText(e.target.value)}
          className={`${FELD} h-8 flex-1`}
        />
        <button
          type="button"
          data-testid="klara-erinnerung-deuten"
          disabled={!text.trim()}
          onClick={() => void deuten()}
          className={KNOPF}
        >
          {t("klaraerinnerung.deuten")}
        </button>
      </div>
      {deutung?.art === "klaerung" ? (
        <div
          role="alert"
          data-testid="klara-erinnerung-klaerung"
          data-grund={deutung.grund}
          className="rounded-btn bg-trust-warn-bg px-2 py-1 text-[11.5px] text-trust-warn-text"
        >
          <p>{t(`klaraerinnerung.klaerung.${deutung.grund}`)}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {deutung.optionen.map((o) => (
              <button
                key={`${o.datum}T${o.uhrzeit}`}
                type="button"
                data-testid="klara-erinnerung-option"
                data-datum={o.datum}
                data-uhrzeit={o.uhrzeit}
                onClick={() => waehle(o)}
                className={KNOPF}
              >
                {t("klaraerinnerung.klaerung.option", { datum: o.datum, uhrzeit: o.uhrzeit })}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* P07: Kalenderfelder folgen der Leserichtung der Sprache (logische Abstände `ms-`). */}
      <div
        data-testid="klara-erinnerung-kalenderfelder"
        dir={richtung}
        className="flex flex-wrap items-end gap-1.5"
      >
        <label className={KLEINTITEL}>
          {t("klaraerinnerung.feld.art")}
          <select
            data-testid="klara-erinnerung-art"
            value={art}
            onChange={(e) => setArt(e.target.value as PlanArt)}
            className={`${AUSWAHL} ms-1`}
          >
            {(["einmalig", "serie", "frist"] as const).map((a) => (
              <option key={a} value={a}>
                {t(`klaraerinnerung.art.${a}`)}
              </option>
            ))}
          </select>
        </label>
        {art === "frist" ? (
          <>
            <label className={KLEINTITEL}>
              {t("klaraerinnerung.feld.fristDatum")}
              <input
                type="date"
                data-testid="klara-erinnerung-frist-datum"
                value={fristDatum}
                onChange={(e) => setFristDatum(e.target.value)}
                className={`${AUSWAHL} ms-1`}
              />
            </label>
            <label className={KLEINTITEL}>
              {t("klaraerinnerung.feld.vorlaufTage")}
              <input
                type="number"
                min={0}
                max={365}
                data-testid="klara-erinnerung-vorlauf"
                value={vorlaufTage}
                onChange={(e) => setVorlaufTage(Math.max(0, Number(e.target.value) || 0))}
                className={`${AUSWAHL} ms-1 w-16`}
              />
            </label>
          </>
        ) : (
          <label className={KLEINTITEL}>
            {t("klaraerinnerung.feld.datum")}
            <input
              type="date"
              data-testid="klara-erinnerung-datum"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              className={`${AUSWAHL} ms-1`}
            />
          </label>
        )}
        <label className={KLEINTITEL}>
          {t("klaraerinnerung.feld.uhrzeit")}
          <input
            type="time"
            data-testid="klara-erinnerung-uhrzeit"
            value={uhrzeit}
            onChange={(e) => setUhrzeit(e.target.value)}
            className={`${AUSWAHL} ms-1`}
          />
        </label>
        <label className={KLEINTITEL}>
          {t("klaraerinnerung.feld.zone")}
          <select
            data-testid="klara-erinnerung-zone-wahl"
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            className={`${AUSWAHL} ms-1`}
          >
            {zonen(zone).map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
      </div>

      {art === "serie" ? (
        <div className="flex flex-wrap items-end gap-1.5">
          <label className={KLEINTITEL}>
            {t("klaraerinnerung.feld.takt")}
            <select
              data-testid="klara-erinnerung-takt"
              value={takt}
              onChange={(e) => setTakt(e.target.value as typeof takt)}
              className={`${AUSWAHL} ms-1`}
            >
              {(["taeglich", "woechentlich", "monatlich"] as const).map((x) => (
                <option key={x} value={x}>
                  {t(`klaraerinnerung.taktWahl.${x}`)}
                </option>
              ))}
            </select>
          </label>
          <label className={KLEINTITEL}>
            {t("klaraerinnerung.feld.intervall")}
            <input
              type="number"
              min={1}
              max={52}
              value={intervall}
              onChange={(e) => setIntervall(Math.min(52, Math.max(1, Number(e.target.value) || 1)))}
              className={`${AUSWAHL} ms-1 w-14`}
            />
          </label>
          <label className={KLEINTITEL}>
            {t("klaraerinnerung.feld.ende")}
            <select
              data-testid="klara-erinnerung-ende"
              value={ende}
              onChange={(e) => setEnde(e.target.value as typeof ende)}
              className={`${AUSWAHL} ms-1`}
            >
              {(["offen", "datum", "anzahl"] as const).map((x) => (
                <option key={x} value={x}>
                  {t(`klaraerinnerung.endeWahl.${x}`)}
                </option>
              ))}
            </select>
          </label>
          {ende === "datum" ? (
            <input
              type="date"
              aria-label={t("klaraerinnerung.endeWahl.datum")}
              value={bis}
              onChange={(e) => setBis(e.target.value)}
              className={AUSWAHL}
            />
          ) : null}
          {ende === "anzahl" ? (
            <input
              type="number"
              min={1}
              max={2000}
              aria-label={t("klaraerinnerung.endeWahl.anzahl")}
              value={anzahl}
              onChange={(e) => setAnzahl(Math.min(2000, Math.max(1, Number(e.target.value) || 1)))}
              className={`${AUSWAHL} w-16`}
            />
          ) : null}
        </div>
      ) : null}

      <details className="text-[11.5px]">
        <summary className="cursor-pointer font-semibold text-ink">
          {t("klaraerinnerung.regeln.titel")}
        </summary>
        <div className="mt-1 flex flex-wrap items-end gap-1.5">
          <label className={KLEINTITEL}>
            {t("klaraerinnerung.regeln.luecke")}
            <select
              data-testid="klara-erinnerung-luecke"
              value={luecke}
              onChange={(e) => setLuecke(e.target.value as typeof luecke)}
              className={`${AUSWAHL} ms-1`}
            >
              <option value="verschieben">{t("klaraerinnerung.regeln.verschieben")}</option>
              <option value="auslassen">{t("klaraerinnerung.regeln.auslassen")}</option>
            </select>
          </label>
          <label className={KLEINTITEL}>
            {t("klaraerinnerung.regeln.doppelt")}
            <select
              data-testid="klara-erinnerung-doppelt"
              value={doppelt}
              onChange={(e) => setDoppelt(e.target.value as typeof doppelt)}
              className={`${AUSWAHL} ms-1`}
            >
              <option value="erste">{t("klaraerinnerung.regeln.erste")}</option>
              <option value="zweite">{t("klaraerinnerung.regeln.zweite")}</option>
            </select>
          </label>
          <label className={KLEINTITEL}>
            {t("klaraerinnerung.regeln.verpasst")}
            <select
              data-testid="klara-erinnerung-verpasst"
              value={regel}
              onChange={(e) => setRegel(e.target.value as VerpasstRegel)}
              className={`${AUSWAHL} ms-1`}
            >
              {VERPASST.map((r) => (
                <option key={r} value={r}>
                  {t(`klaraerinnerung.verpasst.${r}`)}
                </option>
              ))}
            </select>
          </label>
          <label className={KLEINTITEL}>
            {t("klaraerinnerung.regeln.grenze")}
            <input
              type="number"
              min={0}
              max={1440}
              value={grenze}
              onChange={(e) => setGrenze(Math.min(1440, Math.max(0, Number(e.target.value) || 0)))}
              className={`${AUSWAHL} ms-1 w-16`}
            />
          </label>
        </div>
      </details>

      {/* Was zum Termin geschieht — Prüfung und Zusammenfassung brauchen eine eigene Quelle; eine
          Routine (EQF-07) liest ihre Quellen aus der eigenen Definition. */}
      <label className={`${KLEINTITEL} block`}>
        {t("klaraerinnerung.regeln.aktion")}
        <select
          data-testid="klara-erinnerung-aktion"
          value={aktion}
          onChange={(e) => setAktion(e.target.value as ErinnerungAktion)}
          className={`${AUSWAHL} ms-1`}
        >
          <option value="erinnern">{t("klaraerinnerung.aktion.erinnern")}</option>
          {entwurf.bezug.art === "aufgabe" ? (
            <option value="aufgabe_pruefen">{t("klaraerinnerung.aktion.aufgabe_pruefen")}</option>
          ) : null}
          {entwurf.bezug.art !== "frei" ? (
            <option value="inhalt_zusammenfassen">
              {t("klaraerinnerung.aktion.inhalt_zusammenfassen")}
            </option>
          ) : (
            <option value="routine_bericht">{t("klaraerinnerung.aktion.routine_bericht")}</option>
          )}
        </select>
        {aktion === "inhalt_zusammenfassen" ? (
          <span
            data-testid="klara-erinnerung-zusammenfassung-hinweis"
            className="mt-0.5 block normal-case tracking-normal text-muted"
          >
            {t("klaraerinnerung.aktion.zusammenfassenHinweis")}
          </span>
        ) : null}
      </label>
      {routine ? (
        <fieldset
          data-testid="klara-erinnerung-routine-abschnitte"
          className="space-y-0.5 rounded-btn border border-hairline px-2 py-1"
        >
          <legend className={KLEINTITEL}>{t("klaraerinnerung.routine.abschnitte")}</legend>
          {ROUTINE_ABSCHNITTE.map((a) => (
            <label key={a} className="flex items-center gap-1.5 text-[11.5px] normal-case">
              <input
                type="checkbox"
                data-testid={`klara-erinnerung-routine-abschnitt-${a}`}
                checked={abschnitte.includes(a)}
                onChange={(ev) =>
                  setAbschnitte((alt) =>
                    ev.target.checked ? [...alt, a] : alt.filter((x) => x !== a),
                  )
                }
              />
              {t(`klaraerinnerung.routine.abschnitt.${a}`)}
            </label>
          ))}
          <p className="text-[11px] text-muted">
            {t("klaraerinnerung.routine.einrichtungHinweis")}
          </p>
        </fieldset>
      ) : null}

      {vorschau?.anzeige && plan ? (
        <div data-testid="klara-erinnerung-vorschau" className="rounded-btn bg-surface px-2 py-1">
          <p className={KLEINTITEL}>{t("klaraerinnerung.vorschau.titel")}</p>
          <Zeitanzeige anzeige={vorschau.anzeige} zone={zone} plan={plan} />
        </div>
      ) : null}
      {vorschauFehler ? (
        <p
          role="alert"
          data-testid="klara-erinnerung-vorschau-fehler"
          className="text-[11.5px] text-trust-crit-text"
        >
          {vorschauFehler}
        </p>
      ) : null}
      {entwurf.stand === "fehler" ? (
        <p
          role="alert"
          data-testid="klara-erinnerung-entwurf-fehler"
          className="text-[11.5px] text-trust-crit-text"
        >
          {t("klaraerinnerung.nichtGespeichert", { grund: entwurf.fehler ?? "" })}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          data-testid="klara-erinnerung-speichern"
          disabled={!bereit || laeuft}
          onClick={speichern}
          className={KNOPF_HAUPT}
        >
          {laeuft
            ? t("klaraerinnerung.speichertGerade")
            : entwurf.stand === "fehler"
              ? t("klaraerinnerung.nochmal")
              : t("klaraerinnerung.speichern")}
        </button>
        <button
          type="button"
          data-testid="klara-erinnerung-abbrechen"
          disabled={laeuft}
          onClick={verwirfEntwurf}
          className={KNOPF}
        >
          {t("klaraerinnerung.abbrechen")}
        </button>
      </div>
      <p className="text-[11px] text-muted">{t("klaraerinnerung.abbrechenHinweis")}</p>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Eine gespeicherte Erinnerung
// ------------------------------------------------------------------------------------------------

const LAGE_FARBE: Record<string, string> = {
  abgeschlossen: "bg-trust-pos-bg text-trust-pos-text",
  erledigt: "bg-trust-pos-bg text-trust-pos-text",
  fehlgeschlagen: "bg-trust-crit-bg text-trust-crit-text",
  gestoppt: "bg-trust-crit-bg text-trust-crit-text",
  wartet_auf_klaerung: "bg-trust-warn-bg text-trust-warn-text",
  teilweise_erledigt: "bg-trust-warn-bg text-trust-warn-text",
  faellig: "bg-ai-surface-1 text-ai",
  laeuft: "bg-ai-surface-1 text-ai",
};

type RoutinenDeutungSicht = { art: string; wochentag?: number; abschnitt?: string };

/** EQF-07: Ergebnis eines Routinenlaufs — mit Rücknahme, solange der Bericht unverändert ist. */
function RoutineLaufErgebnis({
  e,
  l,
  r,
}: {
  e: KlaraErinnerung;
  l: ErinnerungLauf;
  r: RoutineErgebnis;
}): JSX.Element {
  const { t } = useAssistenzT();
  const s = useErinnerungen();
  return (
    <span
      data-testid="klara-erinnerung-routine-ergebnis"
      data-status={r.zurueckgenommenAm ? "zurueckgenommen" : r.status}
      data-notiz={r.notizId}
      className="mt-0.5 block rounded-btn bg-ai-surface-2 px-2 py-1 text-[11.5px] text-text"
    >
      {r.zurueckgenommenAm
        ? t("klaraerinnerung.routine.ergebnisZurueckgenommen")
        : t(`klaraerinnerung.routine.ergebnis.${r.status}`, {
            fassung: r.routineFassung,
            quellen: r.quellen.length,
          })}
      {r.offen.length > 0 ? (
        <span data-testid="klara-erinnerung-routine-offen" className="block text-trust-warn-text">
          {t("klaraerinnerung.routine.offen")}{" "}
          {r.offen.map((o) => `${o.was} (${t(`klaraerinnerung.grund.${o.grund}`)})`).join(", ")}
        </span>
      ) : null}
      {r.zurueckgenommenAm ? null : (
        <button
          type="button"
          data-testid="klara-erinnerung-routine-zuruecknehmen"
          disabled={s.laufend[e.id] === true}
          onClick={() => void nimmRoutineErgebnisZurueck(e.id, l.vorkommenId, t)}
          className={`${KNOPF} mt-1`}
        >
          {t("klaraerinnerung.routine.zuruecknehmen")}
        </button>
      )}
    </span>
  );
}

/**
 * EQF-07: was eine Routine ist und tut — Beginn, Zeitzone, Wiederholung und nächster Lauf (über
 * `Zeitanzeige`), dazu Quellen, Ziel, erlaubte Wirkung, Ausführungsmodus und Funktionsfassung. Eine
 * Änderung in Worten wird erst gedeutet und gezeigt, dann bewusst übernommen.
 */
function RoutineBereich({ e }: { e: KlaraErinnerung }): JSX.Element | null {
  const { t } = useAssistenzT();
  const s = useErinnerungen();
  const id = useId();
  const [text, setText] = useState("");
  const [gedeutet, setGedeutet] = useState<RoutinenDeutungSicht | null>(null);
  const r = e.routine;
  if (!r) {
    return null;
  }
  const fest =
    r.notizIds.length > 0
      ? [t("klaraerinnerung.routine.festeNotizen", { n: r.notizIds.length })]
      : [];
  const quellen = [
    ...r.abschnitte.map((a) => t(`klaraerinnerung.routine.abschnitt.${a}`)),
    ...fest,
  ].join(", ");
  const beschreibung = (d: RoutinenDeutungSicht): string =>
    d.art === "wochentag"
      ? t("klaraerinnerung.routine.deutung.wochentag", {
          tag: t(`klaraerinnerung.routine.wochentag.${d.wochentag ?? 1}`),
        })
      : d.art === "abschnitt_dazu" || d.art === "abschnitt_weg"
        ? t(`klaraerinnerung.routine.deutung.${d.art}`, {
            abschnitt: t(`klaraerinnerung.routine.abschnitt.${d.abschnitt ?? "offene_aufgaben"}`),
          })
        : t(`klaraerinnerung.routine.deutung.${d.art}`);
  return (
    <div data-testid="klara-erinnerung-routine" data-fassung={r.fassung} className="space-y-0.5">
      <p className={KLEINTITEL}>{t("klaraerinnerung.routine.titel")}</p>
      <p className="text-[11.5px]">
        {t("klaraerinnerung.routine.quellen")} {quellen}
      </p>
      <p className="text-[11.5px]">
        {t("klaraerinnerung.routine.ziel")} {t("klaraerinnerung.routine.zielNotizen")}
      </p>
      <p data-testid="klara-erinnerung-routine-wirkung" className="text-[11.5px]">
        {t("klaraerinnerung.routine.wirkung")}
      </p>
      <p className="text-[11.5px]">{t("klaraerinnerung.routine.modus", { fassung: r.fassung })}</p>
      {e.status === "aktiv" || e.status === "pausiert" ? (
        <form
          className="flex flex-wrap items-center gap-1.5"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!text.trim()) {
              return;
            }
            void deuteRoutine(e.id, text.trim(), t).then(setGedeutet);
          }}
        >
          <label htmlFor={`${id}-aendern`} className="sr-only">
            {t("klaraerinnerung.routine.aendern")}
          </label>
          <input
            id={`${id}-aendern`}
            data-testid="klara-erinnerung-routine-text"
            value={text}
            maxLength={500}
            placeholder={t("klaraerinnerung.routine.aendernBeispiel")}
            onChange={(ev) => {
              setText(ev.target.value);
              setGedeutet(null);
            }}
            className={`${FELD} mt-0 max-w-[18rem]`}
          />
          <button type="submit" data-testid="klara-erinnerung-routine-deuten" className={KNOPF}>
            {t("klaraerinnerung.routine.deuten")}
          </button>
        </form>
      ) : null}
      {gedeutet ? (
        <p
          data-testid="klara-erinnerung-routine-deutung"
          data-art={gedeutet.art}
          className="flex flex-wrap items-center gap-1.5 text-[11.5px]"
        >
          {beschreibung(gedeutet)}
          {gedeutet.art === "unklar" ? null : (
            <button
              type="button"
              data-testid="klara-erinnerung-routine-uebernehmen"
              disabled={s.laufend[e.id] === true}
              onClick={() =>
                void uebernimmRoutine(e.id, text.trim(), t).then((ok) => {
                  if (ok) {
                    setText("");
                    setGedeutet(null);
                  }
                })
              }
              className={KNOPF}
            >
              {t("klaraerinnerung.routine.uebernehmen")}
            </button>
          )}
        </p>
      ) : null}
    </div>
  );
}

function LaufZeile({ e, l }: { e: KlaraErinnerung; l: ErinnerungLauf }): JSX.Element {
  const { t, i18n } = useAssistenzT();
  const s = useErinnerungen();
  const offen = l.status === "unklar" || l.status === "fehlgeschlagen";
  const entscheide = (entscheidung: "fortfuehren" | "verwerfen" | "beenden"): void => {
    void bediene(
      e.id,
      (fassung) => klaraErinnerungApi.klaere(e.id, l.vorkommenId, fassung, entscheidung),
      t(`klaraerinnerung.klaeren.erledigt.${entscheidung}`),
      t,
    );
  };
  return (
    <li
      data-testid="klara-erinnerung-lauf"
      data-status={l.status}
      data-vorkommen={l.vorkommenId}
      className="text-[11px] text-muted"
    >
      {new Date(l.geplantFuer).toLocaleString(i18n.language, { timeZone: e.zeitzone })} ·{" "}
      {t(`klaraerinnerung.lauf.${l.status}`)}
      {l.ergebnis.nachgeholt ? ` · ${t("klaraerinnerung.lauf.nachgeholt")}` : ""}
      {l.ergebnis.dedupliziert ? ` · ${t("klaraerinnerung.lauf.dedupliziert")}` : ""}
      {l.ergebnis.grund ? ` · ${t(`klaraerinnerung.grund.${l.ergebnis.grund}`)}` : ""}
      {l.ergebnis.pruefung
        ? ` · ${t(`klaraerinnerung.pruefung.${l.ergebnis.pruefung.status}`)}`
        : ""}
      {l.ergebnis.empfaenger ? ` · ${t("klaraerinnerung.uebergabe.anZugestellt")}` : ""}
      {/* AW-18: die bestellte Zusammenfassung — dauerhaft am Lauf, mit Herkunft. */}
      {l.ergebnis.zusammenfassung ? (
        <span
          data-testid="klara-erinnerung-zusammenfassung"
          data-status={l.ergebnis.zusammenfassung.status}
          className="mt-0.5 block whitespace-pre-line rounded-btn bg-ai-surface-2 px-2 py-1 text-[11.5px] text-text"
        >
          {l.ergebnis.zusammenfassung.status === "erstellt"
            ? `${t(
                l.ergebnis.zusammenfassung.ki
                  ? "klaraerinnerung.zusammenfassung.ki"
                  : "klaraerinnerung.zusammenfassung.ersatz",
              )}: ${l.ergebnis.zusammenfassung.text}`
            : t("klaraerinnerung.zusammenfassung.nichtVerfuegbar")}
        </span>
      ) : null}
      {/* EQF-07: das tatsächliche Routinenergebnis — Bericht, Fassungen, offener Rest. */}
      {l.ergebnis.routine ? <RoutineLaufErgebnis e={e} l={l} r={l.ergebnis.routine} /> : null}
      {/* EQF-07-K06: offener Rest eines Teilberichts — im selben Bericht fortsetzen oder bewusst
          nicht mehr nachholen. Fortgesetzt wird vom Dienst, nicht von dieser Ansicht. */}
      {l.status === "teilweise" &&
      e.status === "aktiv" &&
      l.ergebnis.routine &&
      l.ergebnis.routine.offen.length > 0 &&
      l.ergebnis.routine.fortsetzbar !== undefined &&
      !l.ergebnis.routine.zurueckgenommenAm ? (
        <span data-testid="klara-erinnerung-routine-rest" className="mt-0.5 flex flex-wrap gap-1">
          {l.ergebnis.routine.fortsetzbar ? (
            <span className="w-full text-muted">{t("klaraerinnerung.routine.fortsetzbar")}</span>
          ) : null}
          {/* Auch nach ausgeschöpften automatischen Versuchen: eine neue Versuchsreihe. */}
          <button
            type="button"
            data-testid="klara-erinnerung-routine-fortsetzen"
            disabled={s.laufend[e.id] === true}
            onClick={() => entscheide("fortfuehren")}
            className={KNOPF}
          >
            {t("klaraerinnerung.routine.restFortsetzen")}
          </button>
          {l.ergebnis.routine.fortsetzbar ? (
            <button
              type="button"
              data-testid="klara-erinnerung-routine-rest-verwerfen"
              disabled={s.laufend[e.id] === true}
              onClick={() => entscheide("verwerfen")}
              className={KNOPF}
            >
              {t("klaraerinnerung.routine.restVerwerfen")}
            </button>
          ) : null}
        </span>
      ) : null}
      {offen && e.status !== "beendet" ? (
        <span data-testid="klara-erinnerung-lauf-klaeren" className="mt-0.5 flex flex-wrap gap-1">
          <span className="w-full text-trust-warn-text">{t("klaraerinnerung.klaeren.frage")}</span>
          <button
            type="button"
            data-testid="klara-erinnerung-fortfuehren"
            disabled={s.laufend[e.id] === true}
            onClick={() => entscheide("fortfuehren")}
            className={KNOPF}
          >
            {t("klaraerinnerung.klaeren.fortfuehren")}
          </button>
          <button
            type="button"
            data-testid="klara-erinnerung-verwerfen"
            disabled={s.laufend[e.id] === true}
            onClick={() => entscheide("verwerfen")}
            className={KNOPF}
          >
            {t("klaraerinnerung.klaeren.verwerfen")}
          </button>
          <button
            type="button"
            data-testid="klara-erinnerung-beenden-lauf"
            disabled={s.laufend[e.id] === true}
            onClick={() => entscheide("beenden")}
            className={KNOPF}
          >
            {t("klaraerinnerung.klaeren.beenden")}
          </button>
        </span>
      ) : null}
    </li>
  );
}

function TerminZeile({ e, z }: { e: KlaraErinnerung; z: ErinnerungZeitpunkt }): JSX.Element {
  const { t, i18n } = useAssistenzT();
  const s = useErinnerungen();
  const [verschieben, setVerschieben] = useState(false);
  const [datum, setDatum] = useState(z.datum);
  const [uhrzeit, setUhrzeit] = useState(z.uhrzeit);
  const laeuft = s.laufend[e.id] === true;
  const einzeln = (
    aktion: "absagen" | "verschieben",
    extra: { datum?: string; uhrzeit?: string } = {},
  ) =>
    void bediene(
      e.id,
      (fassung) => klaraErinnerungApi.vorkommen(e.id, z.schluessel, { fassung, aktion, ...extra }),
      t(`klaraerinnerung.termin.erledigt.${aktion}`),
      t,
    );
  const abHier = () =>
    void bediene(
      e.id,
      (fassung) =>
        klaraErinnerungApi.abHier(e.id, z.schluessel, {
          fassung,
          zeitplan:
            e.zeitplan.art === "serie"
              ? { ...e.zeitplan, datum: z.schluessel.slice(0, 10), uhrzeit }
              : e.zeitplan,
        }),
      t("klaraerinnerung.termin.erledigt.abHier"),
      t,
    );
  return (
    <li
      data-testid="klara-erinnerung-termin"
      data-schluessel={z.schluessel}
      className="text-[11.5px]"
    >
      <span>{zeitText(z, e.zeitzone, i18n.language)}</span>
      {z.verschoben ? (
        <span className="ml-1 text-muted">{t("klaraerinnerung.termin.verschoben")}</span>
      ) : null}
      <span className="ml-1 inline-flex flex-wrap gap-1">
        <button
          type="button"
          data-testid="klara-erinnerung-termin-absagen"
          disabled={laeuft}
          onClick={() => einzeln("absagen")}
          className={KNOPF}
        >
          {t("klaraerinnerung.termin.absagen")}
        </button>
        <button
          type="button"
          data-testid="klara-erinnerung-termin-verschieben"
          disabled={laeuft}
          onClick={() => setVerschieben((v) => !v)}
          className={KNOPF}
        >
          {t("klaraerinnerung.termin.verschieben")}
        </button>
      </span>
      {verschieben ? (
        <span className="mt-0.5 flex flex-wrap items-center gap-1">
          <input
            type="date"
            aria-label={t("klaraerinnerung.feld.datum")}
            value={datum}
            onChange={(ev) => setDatum(ev.target.value)}
            className={AUSWAHL}
          />
          <input
            type="time"
            aria-label={t("klaraerinnerung.feld.uhrzeit")}
            value={uhrzeit}
            onChange={(ev) => setUhrzeit(ev.target.value)}
            className={AUSWAHL}
          />
          <button
            type="button"
            data-testid="klara-erinnerung-termin-nur-diesen"
            disabled={laeuft}
            onClick={() => einzeln("verschieben", { datum, uhrzeit })}
            className={KNOPF}
          >
            {t("klaraerinnerung.termin.nurDiesen")}
          </button>
          {e.zeitplan.art === "serie" ? (
            <button
              type="button"
              data-testid="klara-erinnerung-termin-ab-hier"
              disabled={laeuft}
              onClick={abHier}
              className={KNOPF}
            >
              {t("klaraerinnerung.termin.abHier")}
            </button>
          ) : null}
        </span>
      ) : null}
    </li>
  );
}

/**
 * AW18-K08: bewusste Übergabe an eine heute aktive Person (per Adresse). Nur reine Erinnerungen —
 * Prüfung und Zusammenfassung lesen persönliche Quellen und bleiben beim Eigentümer.
 */
function UebergabeBereich({ e }: { e: KlaraErinnerung }): JSX.Element | null {
  const { t } = useAssistenzT();
  const s = useErinnerungen();
  const id = useId();
  const [an, setAn] = useState("");
  const laeuft = s.laufend[e.id] === true;
  if (e.status !== "aktiv" && e.status !== "pausiert") {
    return null;
  }
  if (e.uebergabe) {
    return (
      <div
        data-testid="klara-erinnerung-uebergabe"
        data-zustaendig="uebergeben"
        className="space-y-1"
      >
        <p className="text-[11.5px] text-text">
          {t("klaraerinnerung.uebergabe.an", {
            name: e.uebergabe.anName ?? t("klaraerinnerung.uebergabe.unbekannt"),
          })}
        </p>
        <button
          type="button"
          data-testid="klara-erinnerung-uebergabe-zuruecknehmen"
          disabled={laeuft}
          onClick={() =>
            void bediene(
              e.id,
              (fassung) => klaraErinnerungApi.uebergib(e.id, fassung, null),
              t("klaraerinnerung.uebergabe.zurueckgenommen"),
              t,
            )
          }
          className={KNOPF}
        >
          {t("klaraerinnerung.uebergabe.zuruecknehmen")}
        </button>
      </div>
    );
  }
  if (e.aktion !== "erinnern") {
    return (
      <p data-testid="klara-erinnerung-uebergabe-nicht" className="text-[11px] text-muted">
        {t("klaraerinnerung.uebergabe.nurErinnern")}
      </p>
    );
  }
  return (
    <form
      data-testid="klara-erinnerung-uebergabe"
      data-zustaendig="selbst"
      className="space-y-1"
      onSubmit={(ev) => {
        ev.preventDefault();
        const adresse = an.trim();
        if (!adresse) {
          return;
        }
        void bediene(
          e.id,
          (fassung) => klaraErinnerungApi.uebergib(e.id, fassung, adresse),
          t("klaraerinnerung.uebergabe.erledigt", { titel: e.titel }),
          t,
        ).then((ok) => {
          if (ok) {
            setAn("");
          }
        });
      }}
    >
      <label htmlFor={`${id}-an`} className={KLEINTITEL}>
        {t("klaraerinnerung.uebergabe.titel")}
      </label>
      <p className="text-[11px] text-muted">{t("klaraerinnerung.uebergabe.hinweis")}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          id={`${id}-an`}
          type="email"
          data-testid="klara-erinnerung-uebergabe-an"
          value={an}
          onChange={(ev) => setAn(ev.target.value)}
          placeholder={t("klaraerinnerung.uebergabe.adresse")}
          className={`${FELD} mt-0 max-w-[16rem]`}
        />
        <button
          type="submit"
          data-testid="klara-erinnerung-uebergeben"
          disabled={laeuft || an.trim() === ""}
          className={KNOPF}
        >
          {t("klaraerinnerung.uebergabe.uebergeben")}
        </button>
      </div>
    </form>
  );
}

/** Eine mir übergebene Erinnerung: nur Titel, Termine und Lage — und „Zurückgeben“. */
function UebernommenZeile({ u }: { u: UebernommeneErinnerung }): JSX.Element {
  const { t } = useAssistenzT();
  return (
    <li
      data-testid="klara-erinnerung-uebernommen"
      data-erinnerung={u.id}
      data-lage={u.lage}
      className="rounded-btn border border-hairline bg-surface px-2 py-1.5"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-text">{u.titel}</span>
        <span className={`${SCHILD} ${LAGE_FARBE[u.lage] ?? "border border-hairline text-muted"}`}>
          {t(`klaraerinnerung.lage.${u.lage}`)}
        </span>
      </div>
      <p className="mt-0.5 text-[11px] text-muted">
        {t("klaraerinnerung.uebergabe.von", {
          name: u.vonName ?? t("klaraerinnerung.uebergabe.unbekannt"),
        })}
      </p>
      <Zeitanzeige anzeige={u.anzeige} zone={u.zeitzone} plan={u.zeitplan} />
      <button
        type="button"
        data-testid="klara-erinnerung-zurueckgeben"
        onClick={() => void gibErinnerungZurueck(u.id, t)}
        className={`${KNOPF} mt-1`}
      >
        {t("klaraerinnerung.uebergabe.zurueckgeben")}
      </button>
    </li>
  );
}

/**
 * P07 · Einrichtungsassistent mit Zauberhut: freiwillig, jederzeit erneut aufrufbar. Schritt 1
 * Zeitzone (Gerät als Vorschlag), Schritt 2 Sommerzeit- und Verpasst-Regeln. „Übernehmen“
 * speichert Vorgaben für NEUE Erinnerungen; Schließen speichert nichts. Die Feldreihenfolge folgt
 * der Leserichtung der Sprache (`dir`), damit spätere RTL-Sprachen ohne Umbau passen.
 */
function Einrichtungsassistent(): JSX.Element | null {
  const s = useErinnerungen();
  // Bei jedem Öffnen frisch aus den gespeicherten Vorgaben — Schließen verwirft die Auswahl.
  return s.assistentOffen ? <AssistentSchritte vorgabe={s.einstellungen} /> : null;
}

function AssistentSchritte({
  vorgabe,
}: {
  vorgabe: ReturnType<typeof useErinnerungen>["einstellungen"];
}): JSX.Element {
  const { t, i18n } = useAssistenzT();
  const id = useId();
  const [schritt, setSchritt] = useState(1);
  const [zone, setZone] = useState(vorgabe?.zeitzone ?? vorgabeZeitzone());
  const [luecke, setLuecke] = useState<"verschieben" | "auslassen">(
    vorgabe?.sommerzeit.luecke ?? "verschieben",
  );
  const [doppelt, setDoppelt] = useState<"erste" | "zweite">(
    vorgabe?.sommerzeit.doppelt ?? "erste",
  );
  const [regel, setRegel] = useState<VerpasstRegel>(vorgabe?.verpasst.regel ?? "nachholen");
  const [grenze, setGrenze] = useState(vorgabe?.verpasst.grenzeMinuten ?? 30);
  const [speichert, setSpeichert] = useState(false);
  const richtung = i18n.dir(i18n.language);
  return (
    <section
      data-testid="klara-erinnerung-assistent-dialog"
      aria-labelledby={`${id}-titel`}
      dir={richtung}
      className="space-y-1.5 rounded-btn border border-ink/20 bg-ai-surface-2 px-2.5 py-2"
    >
      <h4 id={`${id}-titel`} className="text-[12.5px] font-semibold text-ink">
        <span aria-hidden="true">🎩 </span>
        {t("klaraerinnerung.assistent.titel")}
      </h4>
      <p className="text-[11px] text-muted">
        {t("klaraerinnerung.assistent.schritt", { n: schritt, von: 2 })} ·{" "}
        {t("klaraerinnerung.assistent.freiwillig")}
      </p>
      {schritt === 1 ? (
        <div data-testid="klara-erinnerung-assistent-zone" className="space-y-1">
          <label htmlFor={`${id}-zone`} className={KLEINTITEL}>
            {t("klaraerinnerung.assistent.zoneFrage")}
          </label>
          <select
            id={`${id}-zone`}
            data-testid="klara-erinnerung-assistent-zeitzone"
            value={zone}
            onChange={(ev) => setZone(ev.target.value)}
            className={AUSWAHL}
          >
            {zonen(zone).map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted">
            {t("klaraerinnerung.assistent.geraet", { zone: geraeteZeitzone() })}
          </p>
        </div>
      ) : (
        <div data-testid="klara-erinnerung-assistent-regeln" className="space-y-1">
          <label className="block text-[11.5px]">
            {t("klaraerinnerung.regeln.luecke")}{" "}
            <select
              data-testid="klara-erinnerung-assistent-luecke"
              value={luecke}
              onChange={(ev) => setLuecke(ev.target.value as typeof luecke)}
              className={AUSWAHL}
            >
              <option value="verschieben">{t("klaraerinnerung.regeln.verschieben")}</option>
              <option value="auslassen">{t("klaraerinnerung.regeln.auslassen")}</option>
            </select>
          </label>
          <label className="block text-[11.5px]">
            {t("klaraerinnerung.regeln.doppelt")}{" "}
            <select
              data-testid="klara-erinnerung-assistent-doppelt"
              value={doppelt}
              onChange={(ev) => setDoppelt(ev.target.value as typeof doppelt)}
              className={AUSWAHL}
            >
              <option value="erste">{t("klaraerinnerung.regeln.erste")}</option>
              <option value="zweite">{t("klaraerinnerung.regeln.zweite")}</option>
            </select>
          </label>
          <label className="block text-[11.5px]">
            {t("klaraerinnerung.regeln.verpasst")}{" "}
            <select
              data-testid="klara-erinnerung-assistent-verpasst"
              value={regel}
              onChange={(ev) => setRegel(ev.target.value as VerpasstRegel)}
              className={AUSWAHL}
            >
              {VERPASST.map((r) => (
                <option key={r} value={r}>
                  {t(`klaraerinnerung.verpasst.${r}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[11.5px]">
            {t("klaraerinnerung.regeln.grenze")}{" "}
            <input
              type="number"
              min={0}
              max={1440}
              data-testid="klara-erinnerung-assistent-grenze"
              value={grenze}
              onChange={(e) => setGrenze(Math.min(1440, Math.max(0, Number(e.target.value) || 0)))}
              className={`${AUSWAHL} w-24`}
            />
          </label>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {schritt === 1 ? (
          <button
            type="button"
            data-testid="klara-erinnerung-assistent-weiter"
            onClick={() => setSchritt(2)}
            className={KNOPF}
          >
            {t("klaraerinnerung.assistent.weiter")}
          </button>
        ) : (
          <>
            <button type="button" onClick={() => setSchritt(1)} className={KNOPF}>
              {t("klaraerinnerung.assistent.zurueck")}
            </button>
            <button
              type="button"
              data-testid="klara-erinnerung-assistent-uebernehmen"
              disabled={speichert}
              onClick={() => {
                setSpeichert(true);
                void speichereEinstellungen(
                  {
                    zeitzone: zone,
                    sommerzeit: { luecke, doppelt },
                    verpasst: { regel, grenzeMinuten: grenze },
                  },
                  t,
                ).finally(() => setSpeichert(false));
              }}
              className={KNOPF_HAUPT}
            >
              {t("klaraerinnerung.assistent.uebernehmen")}
            </button>
          </>
        )}
        <button
          type="button"
          data-testid="klara-erinnerung-assistent-schliessen"
          onClick={() => schliesseAssistent()}
          className={KNOPF}
        >
          {t("klaraerinnerung.assistent.schliessen")}
        </button>
      </div>
    </section>
  );
}

function ErinnerungZeile({ e, istZiel }: { e: KlaraErinnerung; istZiel: boolean }): JSX.Element {
  const { t } = useAssistenzT();
  const s = useErinnerungen();
  const [offen, setOffen] = useState(istZiel);
  const [loeschenFragen, setLoeschenFragen] = useState(false);
  useEffect(() => {
    if (istZiel) {
      setOffen(true);
    }
  }, [istZiel]);
  const laeuft = s.laufend[e.id] === true;
  const status = (aktion: string) =>
    void bediene(
      e.id,
      (fassung) => klaraErinnerungApi.status(e.id, fassung, aktion),
      t(`klaraerinnerung.status.erledigt.${aktion}`, { titel: e.titel }),
      t,
    );
  const aktiv = e.status === "aktiv";
  const ort = e.objektbezug
    ? [e.objektbezug.seitenName, e.objektbezug.objekt].filter(Boolean).join(" · ")
    : "";

  return (
    <li
      data-testid="klara-erinnerung-eintrag"
      data-erinnerung={e.id}
      data-status={e.status}
      data-lage={e.lage}
      data-fassung={e.fassung}
      className="rounded-btn border border-hairline bg-surface px-2 py-1.5"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          data-testid="klara-erinnerung-oeffnen"
          aria-expanded={offen}
          onClick={() => setOffen((v) => !v)}
          className="min-w-0 flex-1 text-left text-[12.5px] font-semibold text-text hover:underline"
        >
          {e.titel}
        </button>
        <span
          data-testid="klara-erinnerung-lage"
          className={`${SCHILD} ${LAGE_FARBE[e.lage] ?? "border border-hairline text-muted"}`}
        >
          {laeuft ? t("klaraerinnerung.speichertGerade") : t(`klaraerinnerung.lage.${e.lage}`)}
        </span>
      </div>
      <p data-testid="klara-erinnerung-bezug" className="mt-0.5 text-[11px] text-muted">
        {t("klaraerinnerung.persoenlich")} · {bezugAnzeige(e.bezug, t)}
      </p>
      <Zeitanzeige anzeige={e.anzeige} zone={e.zeitzone} plan={e.zeitplan} />
      <p className="mt-0.5 text-[11px] text-muted">
        {t("klaraerinnerung.regeln.kurz", {
          verpasst: t(`klaraerinnerung.verpasst.${e.verpasst.regel}`),
          grenze: e.verpasst.grenzeMinuten,
        })}
      </p>

      {s.fehler[e.id] ? (
        <p
          role="alert"
          data-testid="klara-erinnerung-fehler"
          className="mt-1 rounded-btn bg-trust-crit-bg px-2 py-1 text-[11.5px] text-trust-crit-text"
        >
          {t("klaraerinnerung.aenderungNichtGespeichert", { grund: s.fehler[e.id] ?? "" })}
        </p>
      ) : null}

      <div className="mt-1 flex flex-wrap gap-1.5">
        {aktiv || e.status === "pausiert" ? (
          <button
            type="button"
            data-testid="klara-erinnerung-erledigen"
            disabled={laeuft}
            onClick={() => status("erledigen")}
            className={KNOPF}
          >
            {t("klaraerinnerung.aktion.erledigen")}
          </button>
        ) : null}
        {aktiv ? (
          <button
            type="button"
            data-testid="klara-erinnerung-pausieren"
            disabled={laeuft}
            onClick={() => status("pausieren")}
            className={KNOPF}
          >
            {t("klaraerinnerung.aktion.pausieren")}
          </button>
        ) : null}
        {e.status === "pausiert" ? (
          <button
            type="button"
            data-testid="klara-erinnerung-fortsetzen"
            disabled={laeuft}
            onClick={() => status("fortsetzen")}
            className={KNOPF}
          >
            {t("klaraerinnerung.aktion.fortsetzen")}
          </button>
        ) : null}
        {aktiv || e.status === "pausiert" ? (
          <button
            type="button"
            data-testid="klara-erinnerung-absagen"
            disabled={laeuft}
            onClick={() => status("absagen")}
            className={KNOPF}
          >
            {t("klaraerinnerung.aktion.absagen")}
          </button>
        ) : null}
        {e.status === "abgesagt" || e.status === "erledigt" ? (
          <button
            type="button"
            data-testid="klara-erinnerung-zuruecknehmen"
            disabled={laeuft}
            onClick={() => status("zuruecknehmen")}
            className={KNOPF}
          >
            {t("klaraerinnerung.aktion.zuruecknehmen")}
          </button>
        ) : null}
        {aktiv || e.status === "pausiert" ? (
          <button
            type="button"
            data-testid="klara-erinnerung-beenden"
            disabled={laeuft}
            onClick={() => status("beenden")}
            className={KNOPF}
          >
            {t("klaraerinnerung.aktion.beenden")}
          </button>
        ) : null}
        {loeschenFragen ? (
          <>
            <button
              type="button"
              data-testid="klara-erinnerung-loeschen-bestaetigen"
              onClick={() => void loescheErinnerung(e.id, t)}
              className={KNOPF}
            >
              {t("klaraerinnerung.loeschenBestaetigen")}
            </button>
            <button type="button" onClick={() => setLoeschenFragen(false)} className={KNOPF}>
              {t("klaraerinnerung.loeschenAbbrechen")}
            </button>
          </>
        ) : (
          <button
            type="button"
            data-testid="klara-erinnerung-loeschen"
            onClick={() => setLoeschenFragen(true)}
            className={KNOPF}
          >
            {t("klaraerinnerung.loeschen")}
          </button>
        )}
      </div>

      {offen ? (
        <div
          data-testid="klara-erinnerung-offen"
          className="mt-1.5 space-y-1 border-t border-hairline pt-1.5"
        >
          {e.objektbezug ? (
            <Link
              to={ruecklinkZiel(e.objektbezug)}
              data-testid="klara-erinnerung-ruecklink"
              className="inline-flex text-[12px] font-semibold text-brand-text hover:underline"
            >
              {t("klaraerinnerung.ruecklink", { ort })}
            </Link>
          ) : null}
          {e.notiz ? <p className="whitespace-pre-line text-[11.5px]">{e.notiz}</p> : null}
          {aktiv && e.anzeige.kommende.length > 0 ? (
            <>
              <p className={KLEINTITEL}>{t("klaraerinnerung.termin.titel")}</p>
              <ul className="space-y-1">
                {e.anzeige.kommende.map((z) => (
                  <TerminZeile key={z.vorkommenId} e={e} z={z} />
                ))}
              </ul>
            </>
          ) : null}
          <RoutineBereich e={e} />
          <UebergabeBereich e={e} />
          <p className={KLEINTITEL}>{t("klaraerinnerung.lauf.titel")}</p>
          {e.laeufe.length === 0 ? (
            <p className="text-[11px] text-muted">{t("klaraerinnerung.lauf.keine")}</p>
          ) : (
            <ul className="space-y-0.5">
              {e.laeufe.slice(0, 10).map((l) => (
                <LaufZeile key={l.vorkommenId} e={e} l={l} />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </li>
  );
}

export function KlaraErinnerungen({ offenId = null }: { offenId?: string | null }): JSX.Element {
  const { t } = useAssistenzT();
  const id = useId();
  const s = useErinnerungen();
  const laden = s.laden;
  const generation = s.generation;
  useEffect(() => {
    if (laden === "aus") {
      void ladeErinnerungen(t, generation);
    }
  }, [laden, generation, t]);
  const eingestellt = s.einstellungen !== null;
  useEffect(() => {
    if (laden === "bereit" && !eingestellt) {
      void ladeEinstellungen(t);
    }
  }, [laden, eingestellt, t]);
  const zielFehlt =
    offenId !== null &&
    laden === "bereit" &&
    !s.liste.some((e) => e.id === offenId) &&
    !s.uebernommen.some((e) => e.id === offenId);
  useEffect(() => {
    if (zielFehlt && offenId) {
      void holeErinnerung(offenId, t);
    }
  }, [zielFehlt, offenId, t]);
  const aktive = s.liste.filter((e) => e.status === "aktiv").length;

  return (
    <section
      data-testid="klara-erinnerungen"
      aria-labelledby={`${id}-titel`}
      className="space-y-1.5 rounded-card border border-hairline px-3 py-2.5"
    >
      <h3 id={`${id}-titel`} className="text-[12.5px] font-semibold text-ink">
        {t("klaraerinnerung.titel")}
        {s.laden === "bereit" ? (
          <span data-testid="klara-erinnerungen-zahl" className="ml-1.5 font-normal text-muted">
            {t("klaraerinnerung.zahl", { aktiv: aktive, alle: s.liste.length })}
          </span>
        ) : null}
      </h3>
      <p data-testid="klara-erinnerungen-privat" className="text-[11px] leading-relaxed text-muted">
        {t("klaraerinnerung.privat.hinweis")}
      </p>
      <output
        data-testid="klara-erinnerung-meldung"
        aria-live="polite"
        className="block text-[11px]"
      >
        {s.meldung ?? ""}
      </output>
      <div className="flex flex-wrap gap-1.5">
        {s.entwurf ? null : (
          <button
            type="button"
            data-testid="klara-erinnerung-neu"
            onClick={() => starteEntwurf({ art: "frei" }, t("klaraerinnerung.bezug.frei"), "")}
            className={KNOPF}
          >
            {t("klaraerinnerung.neu")}
          </button>
        )}
        {/* P07: jederzeit erneut aufrufbar — auch nach dem ersten Einrichten. */}
        <button
          type="button"
          data-testid="klara-erinnerung-assistent"
          aria-expanded={s.assistentOffen}
          onClick={() => (s.assistentOffen ? schliesseAssistent() : oeffneAssistent())}
          className={KNOPF}
        >
          <span aria-hidden="true">🎩</span>
          {s.einstellungen?.eingerichtetAm
            ? t("klaraerinnerung.assistent.erneut")
            : t("klaraerinnerung.assistent.oeffnen")}
        </button>
      </div>
      <Einrichtungsassistent />
      <EntwurfFormular />
      {s.laden === "aus" || s.laden === "laedt" ? (
        <p className="text-[11.5px] text-muted-2">{t("klaraerinnerung.laden")}</p>
      ) : s.laden === "fehler" ? (
        <p
          role="alert"
          className="flex flex-wrap items-center gap-1.5 rounded-btn bg-trust-crit-bg px-2 py-1 text-[11.5px] text-trust-crit-text"
        >
          {t("klaraerinnerung.ladeFehler", { grund: s.ladeFehler ?? "" })}
          <button type="button" onClick={() => void ladeErinnerungen(t)} className={KNOPF}>
            {t("klaraerinnerung.nochmalLaden")}
          </button>
        </p>
      ) : s.liste.length === 0 ? (
        <p data-testid="klara-erinnerungen-leer" className="text-[11.5px] text-muted-2">
          {t("klaraerinnerung.leer")}
        </p>
      ) : (
        <ul className="space-y-1" data-testid="klara-erinnerungen-liste">
          {s.liste.map((e) => (
            <ErinnerungZeile key={e.id} e={e} istZiel={e.id === offenId} />
          ))}
        </ul>
      )}
      {s.laden === "bereit" && s.uebernommen.length > 0 ? (
        <>
          <p className={KLEINTITEL}>{t("klaraerinnerung.uebergabe.mirUebergeben")}</p>
          <ul className="space-y-1" data-testid="klara-erinnerungen-uebernommen">
            {s.uebernommen.map((u) => (
              <UebernommenZeile key={u.id} u={u} />
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
