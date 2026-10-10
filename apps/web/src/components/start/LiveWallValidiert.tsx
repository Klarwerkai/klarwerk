import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useDeleteLiveWallPhoto,
  useLiveWallConsent,
  useSetLiveWallConsent,
  useSetLiveWallPhoto,
} from "../../api/hooks";
import type { LiveWall } from "../../api/types";
import { formatKoTimestamp } from "../../lib/koDates";
import { FOTO_TYPEN, fotoVorbereiten } from "../../lib/livewallFoto";
import { LIVEWALL_TAKT_MS, personenAktuell, useJetzt } from "../../lib/livewallTakt";
import { leerzustandsZeile } from "../EmptyStateCtas";
import { RoleLink } from "../RoleLink";

// ================================================================================================
// PMO-FEA-0003 — NEUES VALIDIERTES WISSEN, PERSONEN NUR MIT ZUSTIMMUNG.
// ================================================================================================
//
// Die Liste kommt aus derselben Antwort wie der Rest der Wand (`/api/livewall`, Zweig
// `validated`); die Sichtrechte hat der Server schon an der Grundmenge angewandt. Name und Foto
// liefert der Server nur für Konten, die zugestimmt (Name) bzw. selbst ein Foto hinterlegt haben —
// die Oberfläche erfindet nichts nach (kein Rückgriff aufs Verzeichnis). Keine Punkte, keine
// Rangliste.
//
// Personenangaben stehen nur aus einem FRISCHEN Stand (`personenAktuell`): ein inzwischen
// widerrufener Name darf nicht stehen bleiben, nur weil der nächste Abruf scheitert.
//
// Darunter die EIGENE Erklärung: freiwillig, voreingestellt aus, jederzeit widerrufbar.
export function LiveWallValidiert({
  daten,
  aktualisiertAm,
}: {
  daten: LiveWall;
  /** `dataUpdatedAt` der Wand-Abfrage — Grundlage für „Personenangaben noch frisch?". */
  aktualisiertAm: number;
}): JSX.Element {
  const { t } = useTranslation();
  // Die eigene Uhr prüft die Frische je Takt neu — auch wenn die Abfrage nichts Neues meldet.
  const jetzt = useJetzt(LIVEWALL_TAKT_MS);
  return (
    <>
      <div data-testid="livewall-validiert">
        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-2">
          {t("start.livewall.validated")}
        </div>
        <ValidiertListe
          eintraege={daten.validated ?? []}
          personen={personenAktuell(aktualisiertAm, Math.max(jetzt, Date.now()))}
        />
      </div>
      <WandZustimmung />
    </>
  );
}

/** Die Liste selbst — auch von der Beamer-Ansicht benutzt (`gross`). */
export function ValidiertListe({
  eintraege,
  personen,
  gross = false,
}: {
  eintraege: NonNullable<LiveWall["validated"]>;
  personen: boolean;
  gross?: boolean;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  if (eintraege.length === 0) {
    return (
      <>
        <p className={gross ? "text-[22px] text-muted" : "text-[12.5px] text-muted"}>
          {t("start.livewall.validatedEmpty")}
        </p>
        {/* R-0956 (Nacharbeit 7): die leere Liste ordnet in den Wissenskreis ein. */}
        {leerzustandsZeile(t, "start")}
      </>
    );
  }
  const foto = gross ? "h-14 w-14" : "h-6 w-6";
  return (
    <ul className={gross ? "space-y-4" : "space-y-1"}>
      {eintraege.map((v) => (
        <li key={v.koId} className={gross ? "flex items-center gap-4" : "flex items-center gap-2"}>
          {personen && v.foto ? (
            <img
              data-testid="livewall-validiert-foto"
              src={v.foto}
              alt={v.name ?? t("start.livewall.photoAlt")}
              className={`${foto} shrink-0 rounded-full object-cover`}
            />
          ) : null}
          <RoleLink
            to={`/wissen/${v.koId}`}
            className={
              gross
                ? "min-w-0 flex-1 truncate text-[28px] font-semibold text-ink"
                : "min-w-0 flex-1 truncate text-[13px] font-medium text-text"
            }
            hoverClassName="hover:text-ink"
          >
            {() => v.title}
          </RoleLink>
          {personen && v.name ? (
            <span
              data-testid="livewall-validiert-name"
              className={
                gross ? "shrink-0 text-[22px] text-muted" : "shrink-0 text-[12px] text-muted"
              }
            >
              {v.name}
            </span>
          ) : null}
          <span
            className={
              gross
                ? "shrink-0 font-mono text-[18px] text-muted-2"
                : "shrink-0 font-mono text-[10.5px] text-muted-2"
            }
          >
            {formatKoTimestamp(v.at, i18n.language)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function WandZustimmung(): JSX.Element | null {
  const { t } = useTranslation();
  const stand = useLiveWallConsent();
  const setzen = useSetLiveWallConsent();
  const fotoSetzen = useSetLiveWallPhoto();
  const fotoLoeschen = useDeleteLiveWallPhoto();
  const [fotoFehler, setFotoFehler] = useState(false);
  // Ohne gelesenen Stand kein Schalter: ein Kästchen, das „aus" zeigt, weil nichts geladen ist,
  // wäre eine falsche Auskunft über die eigene Erklärung.
  if (!stand.data) {
    return null;
  }
  // Das Entwerten in den Hooks trifft Wand UND Erklärung (gemeinsamer Schlüssel „livewall") —
  // nach dem Umschalten sind beide neu gelesen, ein Widerruf wirkt sofort.
  const an = setzen.isPending
    ? (setzen.variables ?? stand.data.nameConsent)
    : stand.data.nameConsent;
  const beschaeftigt = fotoSetzen.isPending || fotoLoeschen.isPending;
  return (
    <div className="space-y-2">
      <label className="flex items-start gap-2 text-[12.5px] leading-relaxed text-muted">
        <input
          type="checkbox"
          data-testid="livewall-namenszustimmung"
          className="mt-0.5"
          checked={an}
          disabled={setzen.isPending}
          onChange={(e) => setzen.mutate(e.target.checked)}
        />
        <span>{t("start.livewall.nameConsent")}</span>
      </label>
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] leading-relaxed text-muted">
        {stand.data.photo ? (
          <img
            data-testid="livewall-eigenes-foto"
            src={stand.data.photo}
            alt={t("start.livewall.photoOwnAlt")}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : null}
        <span className="flex-1">{t("start.livewall.photoConsent")}</span>
        <label className="cursor-pointer underline underline-offset-2">
          {stand.data.photoConsent
            ? t("start.livewall.photoReplace")
            : t("start.livewall.photoAdd")}
          <input
            type="file"
            data-testid="livewall-foto-wahl"
            accept={FOTO_TYPEN.join(",")}
            className="sr-only"
            disabled={beschaeftigt}
            onChange={(e) => {
              const datei = e.target.files?.[0];
              e.target.value = "";
              if (!datei) {
                return;
              }
              setFotoFehler(false);
              fotoVorbereiten(datei)
                .then((foto) => fotoSetzen.mutate(foto, { onError: () => setFotoFehler(true) }))
                .catch(() => setFotoFehler(true));
            }}
          />
        </label>
        {stand.data.photoConsent ? (
          <button
            type="button"
            data-testid="livewall-foto-widerruf"
            className="underline underline-offset-2"
            disabled={beschaeftigt}
            onClick={() => fotoLoeschen.mutate()}
          >
            {t("start.livewall.photoRevoke")}
          </button>
        ) : null}
      </div>
      {fotoFehler ? (
        <p role="alert" className="text-[12px] text-trust-warn-text">
          {t("start.livewall.photoError")}
        </p>
      ) : null}
      {/* R-0953 (Bestandsabgleich, Nacharbeit 4): Umschalten der Namenszustimmung und Widerruf des
          Fotos scheiterten bis hierher still — das Kästchen sprang zurück, das Foto blieb. Bei
          einer Zustimmung muss der Mensch wissen, dass sein Widerruf NICHT wirkte. */}
      {setzen.isError ? (
        <p role="alert" className="text-[12px] text-trust-warn-text">
          {t("start.livewall.consentError")}
        </p>
      ) : null}
      {fotoLoeschen.isError ? (
        <p role="alert" className="text-[12px] text-trust-warn-text">
          {t("start.livewall.photoRevokeError")}
        </p>
      ) : null}
    </div>
  );
}
