// ================================================================================================
// BPA-16 · GESPRÄCHSAUSSAGEN MIT FOLIEN VERBINDEN — die Fläche `/besprechungen` (Nacharbeit 6).
// ================================================================================================
//
// Der Nutzerweg über die vorhandenen Routen `/api/meetings/**`, erreichbar aus dem Dokumentweg
// (`/fragen/dokument`) und dem Fragenweg (`/fragen`):
//   · Besprechung anlegen; präsentierte Datei (optional mit Original) und Mitschrift über den
//     vorhandenen Objektweg hochladen und verbinden — Importweg mit MANUELLER Zuordnung: an einer
//     Gesprächsstelle wählt der Mensch die Folie, die ab dort zu sehen war;
//   · Rückmeldung an einer Gesprächsstelle erfassen;
//   · Rückmeldungen von BEIDEN Ausgangspunkten öffnen: aus der Folie und aus der Gesprächsstelle.
//     Jede Rückmeldung führt zur jeweils anderen Seite und zur tatsächlichen Quellfassung
//     (`quelleId` → `/api/objects/:id/raw`, dort prüft der Server erneut das Leserecht).
//
// Die Fläche entscheidet keine Rechte. Was der Server nicht liefert (Folie ohne Leserecht,
// Mitschrift ohne Leserecht, Ziel verborgen), erscheint nicht oder ausdrücklich als gesperrt.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ARTEN_AUS_GESPRAECH,
  BESPRECHUNGEN_PFAD,
  type Besprechung,
  type Folienziel,
  type Gespraechsstelle,
  PPTX_MIME,
  type RueckmeldungsArt,
  type RueckmeldungsSicht,
  SCHUTZSTUFEN,
  type Schutzstufe,
  VTT_MIME,
  besprechungenApi,
  objektAdresse,
} from "../api/besprechungen";
import { ApiError } from "../api/client";
import { Button, Card, PageHeader, SectionLabel } from "../components/ui";

const LISTE_KEY = ["besprechungen"] as const;
const linkKlasse = "text-[12.5px] font-semibold text-brand-text underline-offset-2 hover:underline";
const feldKlasse = "w-full rounded-btn border border-hairline px-2 py-1.5 text-[13px] text-text";

function fehlerSchluessel(fehler: unknown): string {
  if (fehler instanceof ApiError) {
    if (fehler.status === 404) {
      return "besprechungen.fehler.nichtGefunden";
    }
    if (fehler.status === 401) {
      return "besprechungen.fehler.anmeldung";
    }
    if (fehler.status === 403) {
      return "besprechungen.fehler.berechtigung";
    }
    if (fehler.status === 409) {
      return "besprechungen.fehler.veraltet";
    }
    if (fehler.status === 400) {
      return "besprechungen.fehler.datei";
    }
  }
  return "besprechungen.fehler.allgemein";
}

/** Millisekunden ab Aufnahmebeginn als `m:ss`. */
export function zeitText(ms: number): string {
  const sekunden = Math.floor(ms / 1000);
  return `${Math.floor(sekunden / 60)}:${String(sekunden % 60).padStart(2, "0")}`;
}

// ------------------------------------------------------------------------------------------------
// Liste und Anlage
// ------------------------------------------------------------------------------------------------

export function Besprechungen(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const liste = useQuery({ queryKey: LISTE_KEY, queryFn: besprechungenApi.liste });
  const [titel, setTitel] = useState("");
  const [zeitbasis, setZeitbasis] = useState("aufnahme");
  const [teilnehmer, setTeilnehmer] = useState("");
  const anlegen = useMutation({
    mutationFn: () =>
      besprechungenApi.anlegen(
        titel.trim(),
        zeitbasis.trim(),
        teilnehmer
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      ),
    onSuccess: (r) => navigate(`${BESPRECHUNGEN_PFAD}/${encodeURIComponent(r.meetingId)}`),
  });
  const absenden = (e: FormEvent): void => {
    e.preventDefault();
    if (titel.trim() && zeitbasis.trim()) {
      anlegen.mutate();
    }
  };
  return (
    <div className="mx-auto w-[800px] max-w-full pb-8 pt-9">
      <PageHeader
        kicker={t("besprechungen.kicker")}
        title={t("besprechungen.titel")}
        lead={t("besprechungen.lead")}
        pageKey="besprechungen"
        actions={
          <Link to="/fragen/dokument" className={linkKlasse}>
            {t("besprechungen.zurueckDokument")}
          </Link>
        }
      />
      <Card interactive={false} className="mb-4 space-y-2">
        <SectionLabel>{t("besprechungen.liste.titel")}</SectionLabel>
        {liste.isPending ? <p className="text-sm text-muted">{t("besprechungen.laedt")}</p> : null}
        {liste.isError ? (
          <p role="alert" className="text-sm text-trust-crit-text">
            {t(fehlerSchluessel(liste.error))}
          </p>
        ) : null}
        {liste.data && liste.data.meetings.length === 0 ? (
          <p className="text-sm text-muted">{t("besprechungen.leer")}</p>
        ) : null}
        <ul className="space-y-1">
          {(liste.data?.meetings ?? []).map((m) => (
            <li key={m.meetingId}>
              <Link
                data-testid="besprechungen-eintrag"
                to={`${BESPRECHUNGEN_PFAD}/${encodeURIComponent(m.meetingId)}`}
                className={linkKlasse}
              >
                {m.titel}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <Card interactive={false} className="space-y-3">
        <h2 className="text-[16px] font-semibold text-ink">{t("besprechungen.anlegen.titel")}</h2>
        <form onSubmit={absenden} className="space-y-3">
          <label className="block text-[13px] text-text">
            {t("besprechungen.anlegen.feldTitel")}
            <input
              data-testid="besprechungen-titel"
              className={feldKlasse}
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
            />
          </label>
          <label className="block text-[13px] text-text">
            {t("besprechungen.anlegen.feldZeitbasis")}
            <input
              data-testid="besprechungen-zeitbasis"
              className={feldKlasse}
              value={zeitbasis}
              onChange={(e) => setZeitbasis(e.target.value)}
            />
            <span className="block text-[12px] text-muted-2">
              {t("besprechungen.anlegen.zeitbasisHinweis")}
            </span>
          </label>
          <label className="block text-[13px] text-text">
            {t("besprechungen.anlegen.feldTeilnehmer")}
            <input
              data-testid="besprechungen-teilnehmer"
              className={feldKlasse}
              value={teilnehmer}
              onChange={(e) => setTeilnehmer(e.target.value)}
            />
            <span className="block text-[12px] text-muted-2">
              {t("besprechungen.anlegen.teilnehmerHinweis")}
            </span>
          </label>
          <Button
            type="submit"
            variant="primary"
            data-testid="besprechungen-anlegen"
            disabled={anlegen.isPending || !titel.trim() || !zeitbasis.trim()}
          >
            {t("besprechungen.anlegen.knopf")}
          </Button>
          {anlegen.isError ? (
            <p role="alert" className="text-sm text-trust-crit-text">
              {t(fehlerSchluessel(anlegen.error))}
            </p>
          ) : null}
        </form>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Eine Besprechung
// ------------------------------------------------------------------------------------------------

/** Woher die angezeigten Rückmeldungen kommen — aus einer Folie oder aus einer Gesprächsstelle. */
type Treffer =
  | { von: "folie"; dateiId: string; sldId: string; position: number; titel: string }
  | { von: "stelle"; zeitMs: number };

function zielSchluessel(z: Folienziel): string {
  return JSON.stringify([z.dateiId, z.fassung, z.sldId]);
}

function zielAus(schluessel: string): Folienziel | null {
  try {
    const [dateiId, fassung, sldId] = JSON.parse(schluessel) as [string, string, string];
    return { dateiId, fassung, sldId };
  } catch {
    return null;
  }
}

function RueckmeldungsKarte({
  r,
  zurStelle,
  zurFolie,
}: {
  r: RueckmeldungsSicht;
  zurStelle: (startMs: number) => void;
  zurFolie: (dateiId: string, sldId: string, position: number, titel: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const sprecher = r.stelle.sprecher ?? t("besprechungen.sprecherUnbekannt");
  return (
    <li
      data-testid="besprechung-rueckmeldung"
      data-rueckmeldung={r.id}
      className="space-y-1.5 border-b border-hairline py-3 last:border-b-0"
    >
      <p className="text-[13px] font-semibold text-ink">
        {t(`besprechungen.art.${r.art}`)}: {r.text}
      </p>
      <p data-testid="besprechung-rueckmeldung-stelle" className="text-[12.5px] text-muted">
        {t("besprechungen.treffer.stelle", {
          zeit: zeitText(r.stelle.startMs),
          sprecher,
          text: r.stelle.text,
        })}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button data-testid="besprechung-zur-stelle" onClick={() => zurStelle(r.stelle.startMs)}>
          {t("besprechungen.zurStelle")}
        </Button>
        {r.folie?.lesbar ? (
          <>
            <span data-testid="besprechung-rueckmeldung-folie" className="text-[12.5px] text-text">
              {t("besprechungen.folienZeile", {
                position: r.folie.position,
                titel: r.folie.titel,
              })}
            </span>
            <Button
              data-testid="besprechung-zur-folie"
              onClick={() => {
                if (r.folie?.lesbar) {
                  zurFolie(r.folie.dateiId, r.folie.sldId, r.folie.position, r.folie.titel);
                }
              }}
            >
              {t("besprechungen.zurFolie")}
            </Button>
            <a
              data-testid="besprechung-quelle"
              href={objektAdresse(r.folie.quelleId)}
              className={linkKlasse}
            >
              {t("besprechungen.praesentierteFassung")}
            </a>
          </>
        ) : r.folie ? (
          <span data-testid="besprechung-folie-gesperrt" className="text-[12.5px] text-muted-2">
            {t("besprechungen.folieGesperrt")}
          </span>
        ) : (
          <span data-testid="besprechung-zuordnung-offen" className="text-[12.5px] text-muted-2">
            {t("besprechungen.zuordnungOffen")}
            {r.grund ? ` — ${t(`besprechungen.grund.${r.grund}`)}` : ""}
          </span>
        )}
      </div>
      {r.aenderung ? (
        <p className="flex flex-wrap items-center gap-3 text-[12.5px] text-muted">
          <span data-testid="besprechung-aenderung" data-status={r.aenderung.status}>
            {t(`besprechungen.aenderung.${r.aenderung.status}`)}
          </span>
          {r.aenderung.zielQuelleId ? (
            <a
              data-testid="besprechung-ziel-quelle"
              href={objektAdresse(r.aenderung.zielQuelleId)}
              className={linkKlasse}
            >
              {t("besprechungen.zielQuelle")}
            </a>
          ) : null}
        </p>
      ) : null}
    </li>
  );
}

function DateienVerbinden({
  meetingId,
  zeitbasis,
}: {
  meetingId: string;
  zeitbasis: string;
}): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [stufe, setStufe] = useState<Schutzstufe | "">("");
  const [praesentation, setPraesentation] = useState<File | null>(null);
  const [original, setOriginal] = useState<File | null>(null);
  const [mitschrift, setMitschrift] = useState<File | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const neuLaden = () => qc.invalidateQueries({ queryKey: ["besprechung", meetingId] });
  const praesentationVerbinden = useMutation({
    mutationFn: async () => {
      if (!praesentation) {
        return;
      }
      const id = await besprechungenApi.hochladen(praesentation, PPTX_MIME, stufe);
      const originalId = original
        ? await besprechungenApi.hochladen(original, PPTX_MIME, stufe)
        : undefined;
      await besprechungenApi.praesentation(meetingId, id, originalId);
    },
    onSuccess: async () => {
      setMeldung(t("besprechungen.dateien.verbunden"));
      await neuLaden();
    },
  });
  const mitschriftVerbinden = useMutation({
    mutationFn: async () => {
      if (!mitschrift) {
        return;
      }
      const id = await besprechungenApi.hochladen(mitschrift, VTT_MIME, stufe);
      await besprechungenApi.mitschrift(meetingId, id, zeitbasis);
    },
    onSuccess: async () => {
      setMeldung(t("besprechungen.dateien.mitschriftVerbunden"));
      await neuLaden();
    },
  });
  const fehler = praesentationVerbinden.error ?? mitschriftVerbinden.error;
  return (
    <Card interactive={false} className="mb-4 space-y-3" data-testid="besprechung-dateien">
      <h2 className="text-[16px] font-semibold text-ink">{t("besprechungen.dateien.titel")}</h2>
      <p className="text-[12.5px] text-muted">{t("besprechungen.dateien.erklaerung")}</p>
      <label className="block text-[13px] text-text">
        {t("besprechungen.dateien.stufe")}
        <select
          data-testid="besprechung-stufe"
          className={feldKlasse}
          value={stufe}
          onChange={(e) => setStufe(e.target.value as Schutzstufe | "")}
        >
          <option value="">{t("besprechungen.dateien.stufeUnbekannt")}</option>
          {SCHUTZSTUFEN.map((s) => (
            <option key={s} value={s}>
              {t(`besprechungen.stufe.${s}`)}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[13px] text-text">
          {t("besprechungen.dateien.praesentation")}
          <input
            data-testid="besprechung-datei-praesentation"
            type="file"
            accept=".pptx"
            className="block text-[12.5px]"
            onChange={(e) => setPraesentation(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="block text-[13px] text-text">
          {t("besprechungen.dateien.original")}
          <input
            data-testid="besprechung-datei-original"
            type="file"
            accept=".pptx"
            className="block text-[12.5px]"
            onChange={(e) => setOriginal(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      <Button
        data-testid="besprechung-praesentation-verbinden"
        disabled={!praesentation || praesentationVerbinden.isPending}
        onClick={() => praesentationVerbinden.mutate()}
      >
        {t("besprechungen.dateien.praesentationVerbinden")}
      </Button>
      <label className="block text-[13px] text-text">
        {t("besprechungen.dateien.mitschrift")}
        <input
          data-testid="besprechung-datei-mitschrift"
          type="file"
          accept=".vtt,text/vtt"
          className="block text-[12.5px]"
          onChange={(e) => setMitschrift(e.target.files?.[0] ?? null)}
        />
      </label>
      <Button
        data-testid="besprechung-mitschrift-verbinden"
        disabled={!mitschrift || mitschriftVerbinden.isPending}
        onClick={() => mitschriftVerbinden.mutate()}
      >
        {t("besprechungen.dateien.mitschriftVerbinden")}
      </Button>
      {meldung ? (
        <output data-testid="besprechung-meldung" className="block text-[12.5px] text-text">
          {meldung}
        </output>
      ) : null}
      {fehler ? (
        <p role="alert" className="text-sm text-trust-crit-text">
          {t(fehlerSchluessel(fehler))}
        </p>
      ) : null}
    </Card>
  );
}

function StelleBearbeiten({
  b,
  mitschriftId,
  stelle,
}: {
  b: Besprechung;
  mitschriftId: string;
  stelle: Gespraechsstelle;
}): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [folie, setFolie] = useState("");
  const [art, setArt] = useState<RueckmeldungsArt>("vorschlag");
  const [text, setText] = useState("");
  const [meldung, setMeldung] = useState<string | null>(null);
  const neuLaden = () => qc.invalidateQueries({ queryKey: ["besprechung", b.meetingId] });
  const zuordnen = useMutation({
    mutationFn: async () => {
      const ziel = zielAus(folie);
      if (ziel) {
        await besprechungenApi.folieAb(b.meetingId, stelle.startMs, b.zeitbasis, ziel);
      }
    },
    onSuccess: async () => {
      setMeldung(t("besprechungen.zuordnung.gespeichert"));
      await neuLaden();
    },
  });
  const speichern = useMutation({
    mutationFn: () =>
      besprechungenApi.rueckmeldung(b.meetingId, {
        mitschriftId,
        stelleId: stelle.id,
        art,
        text: text.trim(),
      }),
    onSuccess: async () => {
      setText("");
      setMeldung(t("besprechungen.rueckmeldung.gespeichert"));
      await neuLaden();
    },
  });
  const fehler = zuordnen.error ?? speichern.error;
  return (
    <Card interactive={false} className="mb-4 space-y-3" data-testid="besprechung-bearbeiten">
      <h2 className="text-[16px] font-semibold text-ink">
        {t("besprechungen.bearbeiten.titel", { zeit: zeitText(stelle.startMs) })}
      </h2>
      <p className="text-[12.5px] text-muted">{stelle.text}</p>
      <label className="block text-[13px] text-text">
        {t("besprechungen.zuordnung.folie")}
        <select
          data-testid="besprechung-zuordnung-folie"
          className={feldKlasse}
          value={folie}
          onChange={(e) => setFolie(e.target.value)}
        >
          <option value="">{t("besprechungen.zuordnung.waehlen")}</option>
          {b.praesentationen.flatMap((p) =>
            p.folien.map((f) => (
              <option
                key={`${p.dateiId}-${p.fassung}-${f.sldId}`}
                value={zielSchluessel({ dateiId: p.dateiId, fassung: p.fassung, sldId: f.sldId })}
              >
                {t("besprechungen.folienZeile", { position: f.position, titel: f.titel })}
              </option>
            )),
          )}
        </select>
      </label>
      <Button
        data-testid="besprechung-zuordnung-speichern"
        disabled={!folie || zuordnen.isPending}
        onClick={() => zuordnen.mutate()}
      >
        {t("besprechungen.zuordnung.knopf")}
      </Button>
      <label className="block text-[13px] text-text">
        {t("besprechungen.rueckmeldung.art")}
        <select
          data-testid="besprechung-art"
          className={feldKlasse}
          value={art}
          onChange={(e) => setArt(e.target.value as RueckmeldungsArt)}
        >
          {ARTEN_AUS_GESPRAECH.map((a) => (
            <option key={a} value={a}>
              {t(`besprechungen.art.${a}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[13px] text-text">
        {t("besprechungen.rueckmeldung.text")}
        <textarea
          data-testid="besprechung-text"
          className={feldKlasse}
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <Button
        data-testid="besprechung-rueckmeldung-speichern"
        variant="primary"
        disabled={!text.trim() || speichern.isPending}
        onClick={() => speichern.mutate()}
      >
        {t("besprechungen.rueckmeldung.knopf")}
      </Button>
      {meldung ? (
        <output data-testid="besprechung-bearbeiten-meldung" className="block text-[12.5px]">
          {meldung}
        </output>
      ) : null}
      {fehler ? (
        <p role="alert" className="text-sm text-trust-crit-text">
          {t(fehlerSchluessel(fehler))}
        </p>
      ) : null}
    </Card>
  );
}

export function BesprechungAnsicht(): JSX.Element {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const besprechung = useQuery({
    queryKey: ["besprechung", id],
    queryFn: () => besprechungenApi.lesen(id),
  });
  const [treffer, setTreffer] = useState<Treffer | null>(null);
  // Jedes Öffnen ist ein eigener Abruf (Zähler im Schlüssel) — ein Rechteentzug wirkt sofort, auch
  // wenn dieselbe Folie oder Stelle zweimal geöffnet wird.
  const [abruf, setAbruf] = useState(0);
  const [gewaehlt, setGewaehlt] = useState<{ mitschriftId: string; stelleId: string } | null>(null);
  const liste = useQuery({
    queryKey: ["besprechung", id, "treffer", treffer, abruf],
    enabled: treffer !== null,
    queryFn: () => {
      if (treffer?.von === "folie") {
        return besprechungenApi.ausFolie(id, treffer.dateiId, treffer.sldId);
      }
      return besprechungenApi.ausZeitstelle(id, treffer?.von === "stelle" ? treffer.zeitMs : 0);
    },
  });
  const oeffnen = (ziel: Treffer): void => {
    setAbruf((n) => n + 1);
    setTreffer(ziel);
  };
  const zurStelle = (zeitMs: number): void => oeffnen({ von: "stelle", zeitMs });
  const zurFolie = (dateiId: string, sldId: string, position: number, titel: string): void =>
    oeffnen({ von: "folie", dateiId, sldId, position, titel });

  const b = besprechung.data;
  const gewaehlteStelle =
    b && gewaehlt
      ? b.mitschriften
          .find((m) => m.id === gewaehlt.mitschriftId)
          ?.stellen.find((s) => s.id === gewaehlt.stelleId)
      : undefined;

  return (
    <div className="mx-auto w-[960px] max-w-full pb-8 pt-9">
      <PageHeader
        kicker={t("besprechungen.kicker")}
        title={b?.titel ?? t("besprechungen.titel")}
        lead={t("besprechungen.lead")}
        pageKey="besprechung"
        actions={
          <Link to={BESPRECHUNGEN_PFAD} className={linkKlasse}>
            {t("besprechungen.zurueckListe")}
          </Link>
        }
      />
      {besprechung.isPending ? (
        <p className="text-sm text-muted">{t("besprechungen.laedt")}</p>
      ) : null}
      {besprechung.isError ? (
        <p role="alert" className="text-sm text-trust-crit-text">
          {t(fehlerSchluessel(besprechung.error))}
        </p>
      ) : null}
      {b ? (
        <>
          <DateienVerbinden meetingId={b.meetingId} zeitbasis={b.zeitbasis} />

          <Card interactive={false} className="mb-4 space-y-3" data-testid="besprechung-folien">
            <h2 className="text-[16px] font-semibold text-ink">
              {t("besprechungen.folien.titel")}
            </h2>
            {b.praesentationen.length === 0 ? (
              <p className="text-sm text-muted">{t("besprechungen.folien.leer")}</p>
            ) : null}
            {b.praesentationen.map((p) => (
              <div key={`${p.dateiId}-${p.fassung}`} data-testid="besprechung-praesentation">
                <div className="mb-1 flex flex-wrap items-center gap-3 text-[12.5px] text-muted">
                  <span data-testid="besprechung-abgleich" data-status={p.abgleich.status}>
                    {t(`besprechungen.abgleich.${p.abgleich.status}`)}
                  </span>
                  <a href={objektAdresse(p.quelleId)} className={linkKlasse}>
                    {t("besprechungen.praesentierteFassung")}
                  </a>
                </div>
                <ul className="space-y-1">
                  {p.folien.map((f) => (
                    <li key={f.sldId} className="flex flex-wrap items-center gap-3">
                      <span className="text-[13px] text-text">
                        {t("besprechungen.folienZeile", { position: f.position, titel: f.titel })}
                        {f.versteckt ? ` (${t("besprechungen.folie.versteckt")})` : ""}
                      </span>
                      <Button
                        data-testid="besprechung-folie-oeffnen"
                        data-datei={p.dateiId}
                        data-sld={f.sldId}
                        onClick={() => zurFolie(p.dateiId, f.sldId, f.position, f.titel)}
                      >
                        {t("besprechungen.folie.oeffnen")}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Card>

          <Card interactive={false} className="mb-4 space-y-3" data-testid="besprechung-gespraech">
            <h2 className="text-[16px] font-semibold text-ink">
              {t("besprechungen.gespraech.titel")}
            </h2>
            {b.mitschriften.length === 0 ? (
              <p className="text-sm text-muted">{t("besprechungen.gespraech.leer")}</p>
            ) : null}
            {b.mitschriften.map((m) => (
              <ul key={m.id} className="space-y-2">
                {m.stellen.map((s) => (
                  <li
                    key={s.id}
                    data-testid="besprechung-stelle"
                    data-stelle={s.id}
                    className="space-y-1 border-b border-hairline py-2 last:border-b-0"
                  >
                    <p className="text-[12px] text-muted-2">
                      {t("besprechungen.stelleKopf", {
                        zeit: zeitText(s.startMs),
                        sprecher: s.sprecher ?? t("besprechungen.sprecherUnbekannt"),
                      })}
                    </p>
                    <p className="text-[13px] text-text">{s.text}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        data-testid="besprechung-stelle-oeffnen"
                        data-stelle={s.id}
                        onClick={() => zurStelle(s.startMs)}
                      >
                        {t("besprechungen.stelle.oeffnen")}
                      </Button>
                      <Button
                        data-testid="besprechung-stelle-waehlen"
                        data-stelle={s.id}
                        variant="ghost"
                        onClick={() => setGewaehlt({ mitschriftId: m.id, stelleId: s.id })}
                      >
                        {t("besprechungen.stelle.waehlen")}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ))}
          </Card>

          {gewaehlt && gewaehlteStelle ? (
            <StelleBearbeiten
              key={`${gewaehlt.mitschriftId}-${gewaehlt.stelleId}`}
              b={b}
              mitschriftId={gewaehlt.mitschriftId}
              stelle={gewaehlteStelle}
            />
          ) : null}

          {treffer ? (
            <Card interactive={false} className="space-y-2" data-testid="besprechung-treffer">
              <h2
                data-testid="besprechung-treffer-titel"
                data-von={treffer.von}
                className="text-[16px] font-semibold text-ink"
              >
                {treffer.von === "folie"
                  ? t("besprechungen.treffer.titelFolie", {
                      position: treffer.position,
                      titel: treffer.titel,
                    })
                  : t("besprechungen.treffer.titelStelle", { zeit: zeitText(treffer.zeitMs) })}
              </h2>
              <div aria-live="polite">
                {liste.isPending ? (
                  <p className="text-sm text-muted">{t("besprechungen.laedt")}</p>
                ) : null}
                {liste.isError ? (
                  <p role="alert" className="text-sm text-trust-crit-text">
                    {t(fehlerSchluessel(liste.error))}
                  </p>
                ) : null}
                {liste.data && liste.data.rueckmeldungen.length === 0 ? (
                  <p data-testid="besprechung-treffer-leer" className="text-sm text-muted">
                    {t("besprechungen.treffer.leer")}
                  </p>
                ) : null}
                <ul>
                  {(liste.data?.rueckmeldungen ?? []).map((r) => (
                    <RueckmeldungsKarte
                      key={r.id}
                      r={r}
                      zurStelle={zurStelle}
                      zurFolie={zurFolie}
                    />
                  ))}
                </ul>
              </div>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
