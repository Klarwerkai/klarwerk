// produkt:20261010:klara-eigener-kalender (AW-16) · „Mein Kalender" (`/kalender`).
//
// Eigene Termine, Fristen und Aufgaben OHNE externen Dienst: angelegt, geöffnet, geändert und
// gelöscht im internen Kalenderobjekt des Servers (`/api/me/kalender…`). Die Route trägt kein
// Rollentor; jede Tür dahinter verlangt die Anmeldung, und welche Einträge jemand sieht, entscheidet
// der Server mit heutigen Rechten.
//
// DREI ANSICHTEN, EIN EINTRAG: Tag, Woche und Agenda zeigen dieselben Einträge mit derselben
// Kennung (`data-event-id`). Ganztägige Fristen stehen als Datum ohne Uhrzeit; Termine mit Uhrzeit
// erscheinen in der lokalen Zeitzone, die über jeder Ansicht steht.
//
// EINTRAG, AUFTRAG UND ERGEBNIS sind drei getrennt beschriftete, untereinander verlinkte Abschnitte.
// Diese Seite löst nichts aus: Aktionen zeigen zuerst ihre Folgen und wirken erst nach Bestätigung,
// und sie halten nur die Entscheidung am Kalenderobjekt fest.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type KeyboardEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import {
  type ExternerTermin,
  KALENDER_ARTEN,
  KALENDER_STATUS,
  type KalenderAktion,
  type KalenderArt,
  type KalenderBereich,
  type KalenderEingabe,
  type KalenderFolgen,
  type KalenderSicht,
  type KalenderStatus,
  SICHTMODI,
  type Sichtmodus,
  eigenerKalenderApi,
} from "../api/eigenerKalender";
import { useSession } from "../app/AuthContext";
import { Button, Card, Field, PageHeader, TextInput } from "../components/ui";
import {
  isoZuOrtszeit,
  ortsZone,
  ortszeitZuIso,
  tagLesbar,
  tagVon,
  tageVon,
  uhrzeit,
  verschiebe,
  wocheVon,
  zoneLesbar,
} from "../lib/kalenderZeit";

type Ansicht = "tag" | "woche" | "agenda";
const ANSICHTEN: readonly Ansicht[] = ["tag", "woche", "agenda"];
const AGENDA_TAGE = 60;

function fehlerSchluessel(fehler: unknown): string {
  if (fehler instanceof ApiError) {
    if (fehler.status === 401) {
      return "kalender.fehler.anmeldung";
    }
    if (fehler.status === 404) {
      return "kalender.fehler.weg";
    }
    if (fehler.status === 403) {
      return "kalender.fehler.steuerung";
    }
    if (fehler.status === 409) {
      return "kalender.fehler.konflikt";
    }
    if (fehler.status === 400) {
      return "kalender.fehler.eingabe";
    }
  }
  return "kalender.fehler.allgemein";
}

/** Sortierung innerhalb eines Tages: ganztägige Fristen zuerst, dann nach Beginn. */
function vorher(a: KalenderSicht, b: KalenderSicht): number {
  if (a.ganztaegig !== b.ganztaegig) {
    return a.ganztaegig ? -1 : 1;
  }
  return a.beginn.localeCompare(b.beginn) || a.id.localeCompare(b.id);
}

function EintragKnopf({
  e,
  zone,
  aktiv,
  onOeffnen,
}: {
  e: KalenderSicht;
  zone: string;
  aktiv: boolean;
  onOeffnen: (id: string) => void;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  return (
    <button
      type="button"
      data-testid="kalender-eintrag"
      data-event-id={e.id}
      data-art={e.art}
      aria-pressed={aktiv}
      onClick={() => onOeffnen(e.id)}
      className="block w-full rounded-btn border border-hairline px-2 py-1.5 text-left text-[12.5px] hover:bg-hairline-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
    >
      <span className="block font-medium text-ink">
        {e.geschuetzt ? t("kalender.geschuetztKurz") : e.titel}
      </span>
      <span className="block text-muted" data-testid="kalender-eintrag-meta">
        {e.ganztaegig ? t("kalender.ganztaegig") : uhrzeit(e.beginn, zone, i18n.language)}
        {" · "}
        {t(`kalender.art.${e.art}`)}
        {" · "}
        {t(`kalender.status.${e.status}`)}
        {" · "}
        {t(`kalender.herkunft.${e.herkunft.art}`)}
        {e.zugeordnet ? null : (
          <>
            {" · "}
            <span data-testid="kalender-unzugeordnet">{t("kalender.unzugeordnet")}</span>
          </>
        )}
        {e.ausgeblendet ? (
          <>
            {" · "}
            {t("kalender.ausgeblendet")}
          </>
        ) : null}
      </span>
    </button>
  );
}

/** Ein Termin des vorhandenen Kalenders — nur gelesen, ohne Aktion, als solcher gekennzeichnet. */
function ExternerEintrag({ x, zone }: { x: ExternerTermin; zone: string }): JSX.Element {
  const { t, i18n } = useTranslation();
  return (
    <div
      data-testid="kalender-extern"
      data-extern-id={x.id}
      className="rounded-btn border border-dashed border-hairline px-2 py-1.5 text-[12.5px]"
    >
      <span className="block font-medium text-ink">{x.titel}</span>
      <span className="block text-muted">
        {x.ganztaegig ? t("kalender.ganztaegig") : uhrzeit(x.beginn, zone, i18n.language)}
        {" · "}
        {t("kalender.herkunft.vorhanden")}
      </span>
    </div>
  );
}

function Tagesliste({
  eintraege,
  externe,
  zone,
  offen,
  onOeffnen,
}: {
  eintraege: KalenderSicht[];
  externe: ExternerTermin[];
  zone: string;
  offen: string | null;
  onOeffnen: (id: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  if (eintraege.length === 0 && externe.length === 0) {
    return <p className="text-[12.5px] text-muted-2">{t("kalender.leer")}</p>;
  }
  return (
    <ul className="space-y-1.5">
      {[...eintraege].sort(vorher).map((e) => (
        <li key={e.id}>
          <EintragKnopf e={e} zone={zone} aktiv={offen === e.id} onOeffnen={onOeffnen} />
        </li>
      ))}
      {externe.map((x) => (
        <li key={`extern-${x.id}`}>
          <ExternerEintrag x={x} zone={zone} />
        </li>
      ))}
    </ul>
  );
}

const FOLGEN_AKTIONEN: readonly KalenderAktion[] = [
  "anzeige_entfernen",
  "anzeige_zeigen",
  "lauf_absagen",
  "serie_pausieren",
  "serie_fortsetzen",
  "arbeit_abbrechen",
];

/** Welche Aktionen an diesem Eintrag überhaupt angeboten werden. */
function angeboten(e: KalenderSicht): KalenderAktion[] {
  return FOLGEN_AKTIONEN.filter((a) => {
    switch (a) {
      case "anzeige_entfernen":
        return !e.ausgeblendet;
      case "anzeige_zeigen":
        return e.ausgeblendet;
      case "lauf_absagen":
        return e.lauf?.status === "geplant";
      case "arbeit_abbrechen":
        return e.lauf?.status === "laeuft";
      case "serie_pausieren":
        // Nur ein NACHGEWIESENER Stand bietet eine Aktion an (`pausiert: null` = unbekannt).
        return e.serie?.pausiert === false;
      case "serie_fortsetzen":
        return e.serie?.pausiert === true;
    }
  });
}

function FolgenPanel({
  folgen,
  laeuft,
  fehler,
  onBestaetigen,
  onAbbrechen,
}: {
  folgen: KalenderFolgen;
  laeuft: boolean;
  fehler: unknown;
  onBestaetigen: () => void;
  onAbbrechen: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      data-testid="kalender-folgen"
      data-aktion={folgen.aktion}
      className="mt-3 space-y-2 rounded-btn border border-hairline p-3 text-[12.5px]"
    >
      <h4 className="font-semibold text-ink">
        {t("kalender.folgen.titel", { aktion: t(`kalender.aktion.${folgen.aktion}`) })}
      </h4>
      {folgen.moeglich ? (
        <>
          <p data-testid="kalender-folgen-wirkung">
            {t(`kalender.folgen.wirkung.${folgen.aktion}`, {
              anzahl: folgen.betroffeneEintraege,
            })}
          </p>
          <p>{t("kalender.folgen.bleibtTitel")}</p>
          <ul className="list-disc pl-5" data-testid="kalender-folgen-bleibt">
            {folgen.bleibt.map((b) => (
              <li key={b}>{t(`kalender.folgen.bleibt.${b}`)}</li>
            ))}
          </ul>
          <p className="text-muted">
            {t(folgen.umkehrbar ? "kalender.folgen.umkehrbar" : "kalender.folgen.endgueltig")}
          </p>
          {folgen.ausfuehrung ? (
            <p className="text-muted" data-testid="kalender-folgen-ausfuehrung">
              {t("kalender.folgen.ausfuehrung")}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              variant="primary"
              data-testid="kalender-folgen-bestaetigen"
              disabled={laeuft}
              onClick={onBestaetigen}
            >
              {t("kalender.folgen.bestaetigen")}
            </Button>
            <Button data-testid="kalender-folgen-abbrechen" onClick={onAbbrechen}>
              {t("kalender.folgen.abbrechen")}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p data-testid="kalender-folgen-nicht">
            {t(`kalender.folgen.nicht.${folgen.hinderung ?? "allgemein"}`)}
          </p>
          <Button data-testid="kalender-folgen-abbrechen" onClick={onAbbrechen}>
            {t("kalender.folgen.abbrechen")}
          </Button>
        </>
      )}
      {fehler ? (
        <p role="alert" className="text-trust-crit-text">
          {t(fehlerSchluessel(fehler))}
        </p>
      ) : null}
    </div>
  );
}

function Detail({
  e,
  zone,
  meineId,
  onBearbeiten,
  onSchliessen,
}: {
  e: KalenderSicht;
  zone: string;
  meineId: string | undefined;
  onBearbeiten: (e: KalenderSicht) => void;
  onSchliessen: () => void;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [folgen, setFolgen] = useState<KalenderFolgen | null>(null);
  const [loeschfrage, setLoeschfrage] = useState(false);
  const neuLaden = (): Promise<void> => qc.invalidateQueries({ queryKey: ["kalender"] });
  const zeigeFolgen = useMutation({
    mutationFn: (aktion: KalenderAktion) => eigenerKalenderApi.folgen(e.id, aktion),
    onSuccess: (antwort) => setFolgen(antwort.folgen),
  });
  const handeln = useMutation({
    mutationFn: (aktion: KalenderAktion) => eigenerKalenderApi.handeln(e.id, aktion),
    onSuccess: async () => {
      setFolgen(null);
      await neuLaden();
    },
  });
  const loeschen = useMutation({
    mutationFn: () => eigenerKalenderApi.loeschen(e.id),
    onSuccess: async () => {
      onSchliessen();
      await neuLaden();
    },
  });
  const datum = (iso: string): string =>
    `${tagLesbar(tagVon(new Date(iso), zone), i18n.language)} ${uhrzeit(iso, zone, i18n.language)}`;
  const zeit = e.ganztaegig
    ? `${tagLesbar(e.beginn, i18n.language)}${e.ende && e.ende !== e.beginn ? ` – ${tagLesbar(e.ende, i18n.language)}` : ""}`
    : `${datum(e.beginn)}${e.ende ? ` – ${datum(e.ende)}` : ""}`;
  const verantwortlich =
    e.verantwortlich === null
      ? t("kalender.unzugeordnet")
      : e.verantwortlich === meineId
        ? t("kalender.detail.verantwortlichIch")
        : e.verantwortlich;

  return (
    <Card interactive={false} data-testid="kalender-detail" data-event-id={e.id}>
      <div className="space-y-4 text-[13px]">
        <section id={`eintrag-${e.id}`} aria-labelledby={`eintrag-titel-${e.id}`}>
          <div className="flex items-start justify-between gap-2">
            <h2 id={`eintrag-titel-${e.id}`} className="text-[16px] font-semibold text-ink">
              {t("kalender.detail.eintrag")}
              {": "}
              {e.geschuetzt ? t("kalender.geschuetzt") : e.titel}
            </h2>
            <Button variant="ghost" data-testid="kalender-detail-schliessen" onClick={onSchliessen}>
              {t("kalender.detail.schliessen")}
            </Button>
          </div>
          <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
            <dt className="text-muted">{t("kalender.detail.kennung")}</dt>
            <dd data-testid="kalender-detail-id" className="font-mono">
              {e.id}
            </dd>
            <dt className="text-muted">{t("kalender.detail.art")}</dt>
            <dd>{t(`kalender.art.${e.art}`)}</dd>
            <dt className="text-muted">{t("kalender.detail.zeit")}</dt>
            <dd data-testid="kalender-detail-zeit">
              {zeit}
              {e.ganztaegig ? ` (${t("kalender.ganztaegig")})` : null}
            </dd>
            {e.ganztaegig ? null : (
              <>
                <dt className="text-muted">{t("kalender.detail.zone")}</dt>
                <dd data-testid="kalender-detail-zone">
                  {t("kalender.detail.zoneWert", {
                    anzeige: zoneLesbar(zone, i18n.language, new Date(e.beginn)),
                    angelegt: e.zeitzone,
                  })}
                </dd>
              </>
            )}
            <dt className="text-muted">{t("kalender.detail.herkunft")}</dt>
            <dd data-testid="kalender-detail-herkunft">
              {t(`kalender.herkunft.${e.herkunft.art}`)}
              {e.herkunft.koId ? ` (${e.herkunft.koId})` : null}
              {e.teamName ? ` · ${t("kalender.detail.team", { team: e.teamName })}` : null}
            </dd>
            <dt className="text-muted">{t("kalender.detail.status")}</dt>
            <dd data-testid="kalender-detail-status">{t(`kalender.status.${e.status}`)}</dd>
            <dt className="text-muted">{t("kalender.detail.verantwortlich")}</dt>
            <dd data-testid="kalender-detail-verantwortlich">{verantwortlich}</dd>
            {e.fristId ? (
              <>
                <dt className="text-muted">{t("kalender.detail.frist")}</dt>
                <dd className="font-mono">{e.fristId}</dd>
              </>
            ) : null}
            {e.serie ? (
              <>
                <dt className="text-muted">{t("kalender.detail.serie")}</dt>
                <dd data-testid="kalender-detail-serie">
                  {e.serie.seriesId}
                  {" · "}
                  {t(
                    e.serie.pausiert === null
                      ? "kalender.nichtNachgewiesen"
                      : e.serie.pausiert
                        ? "kalender.serie.pausiert"
                        : "kalender.serie.aktiv",
                  )}
                </dd>
              </>
            ) : null}
          </dl>
          {e.geschuetzt ? (
            <p data-testid="kalender-detail-geschuetzt" className="mt-2 text-muted">
              {t("kalender.geschuetztErklaerung")}
            </p>
          ) : null}
        </section>

        <section
          id={`auftrag-${e.id}`}
          aria-labelledby={`auftrag-titel-${e.id}`}
          data-testid="kalender-auftrag"
        >
          <h3 id={`auftrag-titel-${e.id}`} className="font-semibold text-ink">
            {t("kalender.auftrag.titel")}
          </h3>
          {e.auftrag ? (
            <p>
              {t("kalender.auftrag.kennung")}
              {": "}
              <span className="font-mono">{e.auftrag.taskId}</span>
              {e.auftrag.titel ? ` · ${e.auftrag.titel}` : null}
              {e.auftrag.aufgeloest ? null : (
                <>
                  {" · "}
                  <span data-testid="kalender-auftrag-unaufgeloest">
                    {t("kalender.auftrag.nichtAufgeloest")}
                  </span>
                </>
              )}
              {" · "}
              <a className="underline" href={`#eintrag-${e.id}`}>
                {t("kalender.auftrag.zumEintrag")}
              </a>
              {" · "}
              <a className="underline" href={`#ergebnis-${e.id}`}>
                {t("kalender.auftrag.zumErgebnis")}
              </a>
            </p>
          ) : (
            <p data-testid="kalender-auftrag-keiner" className="text-muted">
              {t(e.zugeordnet ? "kalender.auftrag.keiner" : "kalender.auftrag.unzugeordnet")}
            </p>
          )}
        </section>

        <section
          id={`ergebnis-${e.id}`}
          aria-labelledby={`ergebnis-titel-${e.id}`}
          data-testid="kalender-ergebnis"
        >
          <h3 id={`ergebnis-titel-${e.id}`} className="font-semibold text-ink">
            {t("kalender.ergebnis.titel")}
          </h3>
          {e.lauf ? (
            <p data-testid="kalender-lauf" data-lauf-status={e.lauf.status ?? "unbekannt"}>
              {t("kalender.ergebnis.lauf", {
                id: e.lauf.runId,
                status: t(
                  e.lauf.status === null
                    ? "kalender.nichtNachgewiesen"
                    : `kalender.lauf.${e.lauf.status}`,
                ),
              })}
              {e.auftrag ? (
                <>
                  {" · "}
                  <a className="underline" href={`#auftrag-${e.id}`}>
                    {t("kalender.ergebnis.zumAuftrag", { id: e.auftrag.taskId })}
                  </a>
                </>
              ) : null}
            </p>
          ) : (
            <p className="text-muted">{t("kalender.ergebnis.keinLauf")}</p>
          )}
          {e.ergebnis ? (
            <div data-testid="kalender-ergebnis-art" data-ergebnis={e.ergebnis.art}>
              <p>{t(`kalender.ergebnis.${e.ergebnis.art}`, { am: datum(e.ergebnis.am) })}</p>
              {e.ergebnis.art === "erinnerung_zugestellt" ? (
                <p data-testid="kalender-erinnerung-grenze" className="text-muted">
                  {t("kalender.ergebnis.erinnerungGrenze")}
                </p>
              ) : null}
            </div>
          ) : e.lauf ? (
            <p className="text-muted">{t("kalender.ergebnis.keins")}</p>
          ) : null}
        </section>

        <div className="flex flex-wrap gap-2">
          {e.geschuetzt ? null : (
            <Button data-testid="kalender-bearbeiten" onClick={() => onBearbeiten(e)}>
              {t("kalender.bearbeiten")}
            </Button>
          )}
          {angeboten(e).map((a) => (
            <Button
              key={a}
              data-testid={`kalender-aktion-${a}`}
              disabled={zeigeFolgen.isPending}
              onClick={() => zeigeFolgen.mutate(a)}
            >
              {t(`kalender.aktion.${a}`)}
            </Button>
          ))}
          {e.darfSteuern ? (
            <Button
              variant="danger"
              data-testid="kalender-loeschen"
              onClick={() => setLoeschfrage(true)}
            >
              {t("kalender.loeschen")}
            </Button>
          ) : null}
        </div>
        {zeigeFolgen.isError ? (
          <p role="alert" className="text-trust-crit-text">
            {t(fehlerSchluessel(zeigeFolgen.error))}
          </p>
        ) : null}
        {folgen ? (
          <FolgenPanel
            folgen={folgen}
            laeuft={handeln.isPending}
            fehler={handeln.error}
            onBestaetigen={() => handeln.mutate(folgen.aktion)}
            onAbbrechen={() => {
              setFolgen(null);
              handeln.reset();
            }}
          />
        ) : null}
        {loeschfrage ? (
          <div data-testid="kalender-loeschfrage" className="space-y-2 rounded-btn border p-3">
            <p>{t("kalender.loeschenFrage")}</p>
            <div className="flex gap-2">
              <Button
                variant="danger"
                data-testid="kalender-loeschen-ja"
                disabled={loeschen.isPending}
                onClick={() => loeschen.mutate()}
              >
                {t("kalender.loeschenJa")}
              </Button>
              <Button onClick={() => setLoeschfrage(false)}>
                {t("kalender.folgen.abbrechen")}
              </Button>
            </div>
            {loeschen.isError ? (
              <p role="alert" className="text-trust-crit-text">
                {t(fehlerSchluessel(loeschen.error))}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

interface FormStand {
  titel: string;
  art: KalenderArt;
  ganztaegig: boolean;
  beginn: string;
  ende: string;
  notiz: string;
  status: KalenderStatus;
  teamId: string;
  /** `bleibt`: eine andere Person ist verantwortlich — das Formular ändert daran nichts. */
  verantwortlich: "ich" | "offen" | "bleibt";
}

function verantwortungIm(
  vorlage: KalenderSicht,
  meineId: string | undefined,
): FormStand["verantwortlich"] {
  if (vorlage.verantwortlich === null) {
    return "offen";
  }
  return vorlage.verantwortlich === meineId ? "ich" : "bleibt";
}

function Formular({
  bereich,
  teams,
  vorlage,
  tag,
  meineId,
  onFertig,
}: {
  bereich: KalenderBereich;
  teams: { id: string; name: string }[];
  vorlage: KalenderSicht | null;
  tag: string;
  meineId: string | undefined;
  onFertig: (id: string | null) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [f, setF] = useState<FormStand>(() =>
    vorlage
      ? {
          titel: vorlage.titel ?? "",
          art: vorlage.art,
          ganztaegig: vorlage.ganztaegig,
          beginn: vorlage.ganztaegig ? vorlage.beginn : isoZuOrtszeit(vorlage.beginn),
          ende: vorlage.ende
            ? vorlage.ganztaegig
              ? vorlage.ende
              : isoZuOrtszeit(vorlage.ende)
            : "",
          notiz: vorlage.notiz ?? "",
          status: vorlage.status,
          teamId: vorlage.teamId ?? "",
          verantwortlich: verantwortungIm(vorlage, meineId),
        }
      : {
          titel: "",
          art: "termin",
          ganztaegig: false,
          beginn: `${tag}T09:00`,
          ende: "",
          notiz: "",
          status: "offen",
          teamId: teams[0]?.id ?? "",
          verantwortlich: "ich",
        },
  );
  const setze = <K extends keyof FormStand>(k: K, v: FormStand[K]): void =>
    setF((alt) => ({ ...alt, [k]: v }));
  const speichern = useMutation({
    mutationFn: async () => {
      const eingabe: KalenderEingabe = {
        art: f.art,
        titel: f.titel,
        notiz: f.notiz.trim() ? f.notiz : null,
        ganztaegig: f.ganztaegig,
        beginn: f.ganztaegig ? f.beginn : (ortszeitZuIso(f.beginn) ?? ""),
        ende: f.ganztaegig ? f.ende || null : ortszeitZuIso(f.ende),
        zeitzone: ortsZone(),
        status: f.status,
      };
      const team = vorlage ? vorlage.bereich === "team" : bereich === "team";
      if (team && (!vorlage || vorlage.darfSteuern) && f.verantwortlich !== "bleibt") {
        eingabe.verantwortlich = f.verantwortlich === "ich" ? (meineId ?? null) : null;
      }
      if (vorlage) {
        return eigenerKalenderApi.aendern(vorlage.id, { ...eingabe, fassung: vorlage.fassung });
      }
      return eigenerKalenderApi.anlegen(
        bereich === "team" ? { ...eingabe, bereich, teamId: f.teamId } : eingabe,
      );
    },
    onSuccess: async (antwort) => {
      await qc.invalidateQueries({ queryKey: ["kalender"] });
      onFertig(antwort.eintrag.id);
    },
  });
  const istTeam = vorlage ? vorlage.bereich === "team" : bereich === "team";

  return (
    <Card interactive={false} data-testid="kalender-formular">
      <form
        className="space-y-3"
        onSubmit={(ev) => {
          ev.preventDefault();
          speichern.mutate();
        }}
      >
        <h2 className="text-[16px] font-semibold text-ink">
          {t(vorlage ? "kalender.form.bearbeiten" : "kalender.form.neu")}
        </h2>
        <Field label={t("kalender.form.titel")}>
          <TextInput
            data-testid="kalender-form-titel"
            required
            maxLength={200}
            value={f.titel}
            onChange={(ev) => setze("titel", ev.target.value)}
          />
        </Field>
        <Field label={t("kalender.form.art")}>
          <select
            data-testid="kalender-form-art"
            className="h-10 w-full rounded-input border border-hairline bg-surface px-3 text-sm"
            value={f.art}
            onChange={(ev) => setze("art", ev.target.value as KalenderArt)}
          >
            {KALENDER_ARTEN.map((a) => (
              <option key={a} value={a}>
                {t(`kalender.art.${a}`)}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-[12.5px]">
          <input
            type="checkbox"
            data-testid="kalender-form-ganztaegig"
            checked={f.ganztaegig}
            onChange={(ev) => {
              const ganz = ev.target.checked;
              setF((alt) => ({
                ...alt,
                ganztaegig: ganz,
                beginn: ganz ? alt.beginn.slice(0, 10) : `${alt.beginn.slice(0, 10)}T09:00`,
                ende: "",
              }));
            }}
          />
          {t("kalender.form.ganztaegig")}
        </label>
        <Field label={t("kalender.form.beginn")}>
          <TextInput
            data-testid="kalender-form-beginn"
            type={f.ganztaegig ? "date" : "datetime-local"}
            required
            value={f.beginn}
            onChange={(ev) => setze("beginn", ev.target.value)}
          />
        </Field>
        <Field label={t("kalender.form.ende")}>
          <TextInput
            data-testid="kalender-form-ende"
            type={f.ganztaegig ? "date" : "datetime-local"}
            value={f.ende}
            onChange={(ev) => setze("ende", ev.target.value)}
          />
        </Field>
        <p className="text-[12px] text-muted-2" data-testid="kalender-form-zone">
          {t("kalender.form.zone", { zone: ortsZone() })}
        </p>
        <Field label={t("kalender.form.notiz")}>
          <textarea
            data-testid="kalender-form-notiz"
            className="min-h-[72px] w-full rounded-input border border-hairline bg-surface px-3 py-2 text-sm"
            maxLength={2000}
            value={f.notiz}
            onChange={(ev) => setze("notiz", ev.target.value)}
          />
        </Field>
        <Field label={t("kalender.form.status")}>
          <select
            data-testid="kalender-form-status"
            className="h-10 w-full rounded-input border border-hairline bg-surface px-3 text-sm"
            value={f.status}
            onChange={(ev) => setze("status", ev.target.value as KalenderStatus)}
          >
            {KALENDER_STATUS.map((s) => (
              <option key={s} value={s}>
                {t(`kalender.status.${s}`)}
              </option>
            ))}
          </select>
        </Field>
        {istTeam && !vorlage ? (
          <Field label={t("kalender.form.team")}>
            <select
              data-testid="kalender-form-team"
              className="h-10 w-full rounded-input border border-hairline bg-surface px-3 text-sm"
              value={f.teamId}
              onChange={(ev) => setze("teamId", ev.target.value)}
            >
              {teams.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {istTeam && (!vorlage || vorlage.darfSteuern) ? (
          <Field label={t("kalender.form.verantwortlich")}>
            <select
              data-testid="kalender-form-verantwortlich"
              className="h-10 w-full rounded-input border border-hairline bg-surface px-3 text-sm"
              value={f.verantwortlich}
              onChange={(ev) =>
                setze("verantwortlich", ev.target.value as FormStand["verantwortlich"])
              }
            >
              {vorlage && verantwortungIm(vorlage, meineId) === "bleibt" ? (
                <option value="bleibt">{t("kalender.form.verantwortlichBleibt")}</option>
              ) : null}
              <option value="ich">{t("kalender.form.verantwortlichIch")}</option>
              <option value="offen">{t("kalender.form.verantwortlichOffen")}</option>
            </select>
          </Field>
        ) : null}
        <div className="flex gap-2">
          <Button
            type="submit"
            variant="primary"
            data-testid="kalender-form-speichern"
            disabled={speichern.isPending}
          >
            {t("kalender.form.speichern")}
          </Button>
          <Button type="button" onClick={() => onFertig(vorlage?.id ?? null)}>
            {t("kalender.form.abbrechen")}
          </Button>
        </div>
        {speichern.isError ? (
          <p role="alert" data-testid="kalender-form-fehler" className="text-trust-crit-text">
            {t(fehlerSchluessel(speichern.error))}
          </p>
        ) : null}
      </form>
    </Card>
  );
}

export function EigenerKalender(): JSX.Element {
  const { t, i18n } = useTranslation();
  const { user } = useSession();
  const qc = useQueryClient();
  const zone = ortsZone();
  const heute = tagVon(new Date(), zone);
  const [bereich, setBereich] = useState<KalenderBereich>("persoenlich");
  const [ansicht, setAnsicht] = useState<Ansicht>("woche");
  const [tag, setTag] = useState(heute);
  const [mitAusgeblendeten, setMitAusgeblendeten] = useState(false);
  const [offen, setOffen] = useState<string | null>(null);
  const [formular, setFormular] = useState<{ vorlage: KalenderSicht | null } | null>(null);

  const daten = useQuery({
    queryKey: ["kalender", bereich, mitAusgeblendeten],
    queryFn: () => eigenerKalenderApi.ansicht(bereich, mitAusgeblendeten),
  });
  const sichtWaehlen = useMutation({
    mutationFn: (modus: Sichtmodus) => eigenerKalenderApi.sichtWaehlen(modus),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kalender"] }),
  });

  const sichtmodus = daten.data?.sichtmodus ?? "eigen";
  // K04: im Modus „vorhandener Kalender" bleiben interne Fristen und zeitgesteuerte Einträge
  // sichtbar — die externe Ansicht ersetzt weder die interne Fristablage noch die Zeitsteuerung.
  const eintraege = useMemo(() => {
    const alle = daten.data?.eintraege ?? [];
    return sichtmodus === "vorhanden"
      ? alle.filter((e) => e.art === "frist" || e.lauf !== null || e.serie !== null)
      : alle;
  }, [daten.data, sichtmodus]);
  const jeTag = useMemo(() => {
    const karte = new Map<string, KalenderSicht[]>();
    for (const e of eintraege) {
      for (const d of tageVon(e, zone)) {
        karte.set(d, [...(karte.get(d) ?? []), e]);
      }
    }
    return karte;
  }, [eintraege, zone]);
  // K04: die Termine des vorhandenen Kalenders — gelesen vom Server über den Kalenderzugang, nur
  // in den Modi „vorhanden" und „beide", und nur gelesen.
  const externJeTag = useMemo(() => {
    const karte = new Map<string, ExternerTermin[]>();
    const termine = sichtmodus === "eigen" ? [] : (daten.data?.vorhandenerKalender.termine ?? []);
    for (const x of termine) {
      for (const d of tageVon(x, zone)) {
        karte.set(d, [...(karte.get(d) ?? []), x]);
      }
    }
    return karte;
  }, [daten.data, sichtmodus, zone]);
  const offenerEintrag = eintraege.find((e) => e.id === offen) ?? null;

  const schritt = ansicht === "woche" ? 7 : 1;
  const tastatur = (ev: KeyboardEvent<HTMLElement>): void => {
    const ziel = ev.target as HTMLElement;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(ziel.tagName)) {
      return;
    }
    if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
      ev.preventDefault();
      setTag((d) => verschiebe(d, ev.key === "ArrowLeft" ? -schritt : schritt));
    } else if (ev.key === "PageUp" || ev.key === "PageDown") {
      ev.preventDefault();
      setTag((d) => verschiebe(d, ev.key === "PageUp" ? -7 : 7));
    } else if (ev.key === "Escape") {
      setOffen(null);
      setFormular(null);
    }
  };
  const woche = wocheVon(tag);
  const agendaTage = Array.from({ length: AGENDA_TAGE }, (_, i) => verschiebe(tag, i)).filter(
    (d) => (jeTag.get(d) ?? []).length > 0 || (externJeTag.get(d) ?? []).length > 0,
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        pageKey="kalender"
        title={t("kalender.titel")}
        lead={t("kalender.lead")}
        actions={
          <Button
            variant="primary"
            data-testid="kalender-neu"
            disabled={bereich === "team" && (daten.data?.teams.length ?? 0) === 0}
            onClick={() => {
              setOffen(null);
              setFormular({ vorlage: null });
            }}
          >
            {t("kalender.neu")}
          </Button>
        }
      />
      <p className="mb-1 text-[12.5px] text-muted" data-testid="kalender-ohne-konto">
        {t("kalender.ohneKonto")}
      </p>
      <p className="mb-4 text-[12.5px] text-muted" data-testid="kalender-zone">
        {t("kalender.zone", { zone: zoneLesbar(zone, i18n.language, new Date()) })}
      </p>

      <div className="mb-4 flex flex-wrap gap-6">
        <fieldset className="m-0 border-0 p-0" data-testid="kalender-sicht">
          <legend className="mb-1 text-[12.5px] font-medium text-muted">
            {t("kalender.sicht.legende")}
          </legend>
          <div className="flex gap-3">
            {SICHTMODI.map((m) => (
              <label key={m} className="flex items-center gap-1.5 text-[13px]">
                <input
                  type="radio"
                  name="kalender-sicht"
                  data-testid={`kalender-sicht-${m}`}
                  checked={sichtmodus === m}
                  disabled={sichtWaehlen.isPending || !daten.isSuccess}
                  onChange={() => sichtWaehlen.mutate(m)}
                />
                {t(`kalender.sicht.${m}`)}
              </label>
            ))}
          </div>
          <p className="mt-1 text-[12px] text-muted-2">{t("kalender.sicht.hinweis")}</p>
        </fieldset>
        <fieldset className="m-0 border-0 p-0" data-testid="kalender-bereich">
          <legend className="mb-1 text-[12.5px] font-medium text-muted">
            {t("kalender.bereich.legende")}
          </legend>
          <div className="flex gap-2">
            {(["persoenlich", "team"] as const).map((b) => (
              <Button
                key={b}
                variant={bereich === b ? "primary" : "outline"}
                aria-pressed={bereich === b}
                data-testid={`kalender-bereich-${b}`}
                onClick={() => {
                  setBereich(b);
                  setOffen(null);
                  setFormular(null);
                }}
              >
                {t(`kalender.bereich.${b}`)}
              </Button>
            ))}
          </div>
          <p className="mt-1 text-[12px] text-muted-2">
            {bereich === "persoenlich"
              ? t("kalender.bereich.privat")
              : (daten.data?.teams.length ?? 0) === 0
                ? t("kalender.bereich.keinTeam")
                : t("kalender.bereich.teamHinweis")}
          </p>
        </fieldset>
      </div>

      {sichtmodus !== "eigen" ? (
        <Card interactive={false} data-testid="kalender-vorhanden">
          <h2 className="text-[14px] font-semibold text-ink">{t("kalender.vorhanden.titel")}</h2>
          <p className="text-[12.5px] text-muted" data-testid="kalender-vorhanden-stand">
            {t(
              daten.data?.vorhandenerKalender.verbunden
                ? "kalender.vorhanden.verbunden"
                : "kalender.vorhanden.nichtVerbunden",
            )}
          </p>
          {sichtmodus === "vorhanden" ? (
            <p className="mt-1 text-[12.5px] text-muted" data-testid="kalender-intern-bleibt">
              {t("kalender.vorhanden.internBleibt")}
            </p>
          ) : null}
        </Card>
      ) : null}

      {daten.isPending ? <p className="text-sm text-muted">{t("kalender.laedt")}</p> : null}
      {daten.isError ? (
        <p role="alert" className="text-sm text-trust-crit-text">
          {t(fehlerSchluessel(daten.error))}
        </p>
      ) : null}

      <section
        aria-labelledby="kalender-zeitraum"
        aria-keyshortcuts="ArrowLeft ArrowRight PageUp PageDown Escape"
        data-testid="kalender-flaeche"
        data-ansicht={ansicht}
        data-tag={tag}
        className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]"
        onKeyDown={tastatur}
      >
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <fieldset className="m-0 flex gap-1 border-0 p-0">
              <legend className="sr-only">{t("kalender.ansicht.legende")}</legend>
              {ANSICHTEN.map((a) => (
                <Button
                  key={a}
                  variant={ansicht === a ? "primary" : "outline"}
                  aria-pressed={ansicht === a}
                  data-testid={`kalender-ansicht-${a}`}
                  onClick={() => setAnsicht(a)}
                >
                  {t(`kalender.ansicht.${a}`)}
                </Button>
              ))}
            </fieldset>
            <div className="flex items-center gap-1">
              <Button
                data-testid="kalender-zurueck"
                onClick={() => setTag((d) => verschiebe(d, -schritt))}
              >
                {t("kalender.nav.zurueck")}
              </Button>
              <Button data-testid="kalender-heute" onClick={() => setTag(heute)}>
                {t("kalender.nav.heute")}
              </Button>
              <Button
                data-testid="kalender-weiter"
                onClick={() => setTag((d) => verschiebe(d, schritt))}
              >
                {t("kalender.nav.weiter")}
              </Button>
            </div>
          </div>
          <h2
            id="kalender-zeitraum"
            className="mb-1 text-[15px] font-semibold text-ink"
            data-testid="kalender-zeitraum"
          >
            {ansicht === "woche"
              ? t("kalender.zeitraum.woche", {
                  von: tagLesbar(woche[0] as string, i18n.language),
                  bis: tagLesbar(woche[6] as string, i18n.language),
                })
              : ansicht === "agenda"
                ? t("kalender.zeitraum.agenda", { von: tagLesbar(tag, i18n.language) })
                : tagLesbar(tag, i18n.language)}
          </h2>
          <p className="mb-3 text-[12px] text-muted-2">{t("kalender.nav.tastatur")}</p>

          {ansicht === "tag" ? (
            <div data-testid="kalender-tag" data-tag={tag}>
              <Tagesliste
                eintraege={jeTag.get(tag) ?? []}
                externe={externJeTag.get(tag) ?? []}
                zone={zone}
                offen={offen}
                onOeffnen={setOffen}
              />
            </div>
          ) : null}
          {ansicht === "woche" ? (
            <ol className="grid gap-2 md:grid-cols-7" data-testid="kalender-woche">
              {woche.map((d) => (
                <li
                  key={d}
                  data-tag={d}
                  data-heute={d === heute ? "1" : undefined}
                  className="min-h-[96px] rounded-btn border border-hairline p-2"
                >
                  <h3 className="mb-1.5 text-[12px] font-semibold text-muted">
                    {tagLesbar(d, i18n.language)}
                  </h3>
                  <Tagesliste
                    eintraege={jeTag.get(d) ?? []}
                    externe={externJeTag.get(d) ?? []}
                    zone={zone}
                    offen={offen}
                    onOeffnen={setOffen}
                  />
                </li>
              ))}
            </ol>
          ) : null}
          {ansicht === "agenda" ? (
            <div data-testid="kalender-agenda">
              {agendaTage.length === 0 ? (
                <p className="text-[12.5px] text-muted-2">{t("kalender.agenda.leer")}</p>
              ) : (
                <ol className="space-y-3">
                  {agendaTage.map((d) => (
                    <li key={d} data-tag={d}>
                      <h3 className="mb-1.5 text-[12px] font-semibold text-muted">
                        {tagLesbar(d, i18n.language)}
                      </h3>
                      <Tagesliste
                        eintraege={jeTag.get(d) ?? []}
                        externe={externJeTag.get(d) ?? []}
                        zone={zone}
                        offen={offen}
                        onOeffnen={setOffen}
                      />
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ) : null}
          {(daten.data?.ausgeblendet ?? 0) > 0 || mitAusgeblendeten ? (
            <label className="mt-3 flex items-center gap-2 text-[12.5px] text-muted">
              <input
                type="checkbox"
                data-testid="kalender-ausgeblendete"
                checked={mitAusgeblendeten}
                onChange={(ev) => setMitAusgeblendeten(ev.target.checked)}
              />
              {t("kalender.ausgeblendeteZeigen", { anzahl: daten.data?.ausgeblendet ?? 0 })}
            </label>
          ) : null}
        </div>
        <div>
          {formular ? (
            <Formular
              key={formular.vorlage?.id ?? "neu"}
              bereich={bereich}
              teams={daten.data?.teams ?? []}
              vorlage={formular.vorlage}
              tag={tag}
              meineId={user?.id}
              onFertig={(id) => {
                setFormular(null);
                setOffen(id);
              }}
            />
          ) : offenerEintrag ? (
            <Detail
              key={offenerEintrag.id}
              e={offenerEintrag}
              zone={zone}
              meineId={user?.id}
              onBearbeiten={(e) => setFormular({ vorlage: e })}
              onSchliessen={() => setOffen(null)}
            />
          ) : (
            <p className="text-[12.5px] text-muted-2">{t("kalender.detail.waehlen")}</p>
          )}
        </div>
      </section>
    </div>
  );
}
