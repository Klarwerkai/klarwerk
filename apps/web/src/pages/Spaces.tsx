// Spaces — Arbeitsräume mit Zweck, Mitgliedern, Zuständigkeit und Rechten (produkt:20261007:spaces).
//
// `/spaces` zeigt die Spaces, die das Konto sehen darf, `/spaces/:id` einen Space mit seinen
// Artikeln (führender Space) und seinen gespeicherten Ansichten (Tag über alle Spaces). Die Route
// trägt kein Rollentor; die Rechte entscheidet der Server (`spaces-routes.ts`) — dieselbe Bauform
// wie `/begriffe` und `/wissen/:id`. Jede Artikelzeile führt auf `/wissen/:id`: dasselbe Objekt,
// keine Kopie.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  type ArtikelZeile,
  type SpaceEingabe,
  type SpaceRecht,
  type SpaceSicht,
  type SpaceZugang,
  spaceFehlerSchluessel,
  spacesApi,
} from "../api/spaces";
import { leerzustandsZeile } from "../components/EmptyStateCtas";
import { Button, Card, Field, PageHeader, SectionLabel, TextInput } from "../components/ui";
import { formatKoTimestamp } from "../lib/koDates";

const FELD =
  "w-full rounded-input border border-hairline bg-surface px-3 py-2 text-sm text-text outline-none focus:border-ink/30";

function leereEingabe(): SpaceEingabe {
  return {
    name: "",
    zweck: "",
    verantwortlich: "",
    zugang: "mitglieder",
    mitglieder: [],
    ansichten: [],
  };
}

function eingabeAus(s: SpaceSicht): SpaceEingabe {
  return {
    name: s.name,
    zweck: s.zweck,
    verantwortlich: s.verantwortlich,
    zugang: s.zugang,
    mitglieder: s.mitglieder.map((m) => ({ nutzer: m.nutzer, recht: m.recht })),
    ansichten: s.ansichten.map((a) => ({ id: a.id, name: a.name, tag: a.tag })),
  };
}

function SpaceFormular({
  vorlage,
  onFertig,
}: {
  vorlage: SpaceSicht | null;
  onFertig: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const konten = useQuery({ queryKey: ["spaces", "konten"], queryFn: spacesApi.konten });
  const [form, setForm] = useState<SpaceEingabe>(() =>
    vorlage ? eingabeAus(vorlage) : leereEingabe(),
  );
  const [neuesMitglied, setNeuesMitglied] = useState("");
  const speichern = useMutation({
    mutationFn: () =>
      vorlage ? spacesApi.aendern(vorlage.id, vorlage.version, form) : spacesApi.anlegen(form),
    onSuccess: async (space) => {
      await qc.invalidateQueries({ queryKey: ["spaces"] });
      await qc.invalidateQueries({ queryKey: ["space", space.id] });
      onFertig();
    },
  });
  const liste = konten.data?.konten ?? [];
  const name = (id: string): string => liste.find((k) => k.id === id)?.name ?? id;

  return (
    <form
      data-testid="space-formular"
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        speichern.mutate();
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t("spaces.feld.name")}>
          <TextInput
            data-testid="space-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label={t("spaces.feld.verantwortlich")}>
          <select
            data-testid="space-verantwortlich"
            className={FELD}
            value={form.verantwortlich}
            onChange={(e) => setForm({ ...form, verantwortlich: e.target.value })}
          >
            <option value="">—</option>
            {liste.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={t("spaces.feld.zweck")}>
        <textarea
          data-testid="space-zweck"
          rows={2}
          className={FELD}
          value={form.zweck}
          onChange={(e) => setForm({ ...form, zweck: e.target.value })}
        />
      </Field>
      <Field label={t("spaces.feld.zugang")}>
        <select
          data-testid="space-zugang"
          className={FELD}
          value={form.zugang}
          onChange={(e) => setForm({ ...form, zugang: e.target.value as SpaceZugang })}
        >
          <option value="mitglieder">{t("spaces.feld.zugangMitglieder")}</option>
          <option value="alle">{t("spaces.feld.zugangAlle")}</option>
        </select>
      </Field>
      <fieldset className="space-y-2 rounded-btn border border-hairline p-3">
        <legend className="px-1 text-[12.5px] font-semibold text-ink">
          {t("spaces.feld.mitglieder")}
        </legend>
        <ul className="space-y-1">
          {form.mitglieder.map((m, i) => (
            <li key={m.nutzer} data-testid="space-mitglied" className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[13px] text-text">
                {name(m.nutzer)}
              </span>
              <select
                aria-label={t("spaces.feld.mitglieder")}
                data-testid="space-mitglied-recht"
                className="rounded-input border border-hairline bg-surface px-2 py-1 text-[12.5px]"
                value={m.recht}
                onChange={(e) =>
                  setForm({
                    ...form,
                    mitglieder: form.mitglieder.map((x, j) =>
                      j === i ? { ...x, recht: e.target.value as SpaceRecht } : x,
                    ),
                  })
                }
              >
                <option value="lesen">{t("spaces.recht.lesen")}</option>
                <option value="schreiben">{t("spaces.recht.schreiben")}</option>
              </select>
              <Button
                onClick={() =>
                  setForm({ ...form, mitglieder: form.mitglieder.filter((_, j) => j !== i) })
                }
              >
                {t("spaces.feld.entfernen")}
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <select
            aria-label={t("spaces.feld.mitgliedWaehlen")}
            data-testid="space-mitglied-waehlen"
            className={FELD}
            value={neuesMitglied}
            onChange={(e) => setNeuesMitglied(e.target.value)}
          >
            <option value="">{t("spaces.feld.mitgliedWaehlen")}</option>
            {liste
              .filter((k) => !form.mitglieder.some((m) => m.nutzer === k.id))
              .map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
          </select>
          <Button
            data-testid="space-mitglied-hinzu"
            disabled={!neuesMitglied}
            onClick={() => {
              setForm({
                ...form,
                mitglieder: [...form.mitglieder, { nutzer: neuesMitglied, recht: "lesen" }],
              });
              setNeuesMitglied("");
            }}
          >
            {t("spaces.feld.mitgliedHinzu")}
          </Button>
        </div>
      </fieldset>
      <fieldset className="space-y-2 rounded-btn border border-hairline p-3">
        <legend className="px-1 text-[12.5px] font-semibold text-ink">
          {t("spaces.feld.ansichten")}
        </legend>
        {form.ansichten.map((a, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: neue Ansichten haben noch keine Kennung.
          <div key={i} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <TextInput
              aria-label={t("spaces.feld.ansichtName")}
              placeholder={t("spaces.feld.ansichtName")}
              data-testid="space-ansicht-name"
              value={a.name}
              onChange={(e) =>
                setForm({
                  ...form,
                  ansichten: form.ansichten.map((x, j) =>
                    j === i ? { ...x, name: e.target.value } : x,
                  ),
                })
              }
            />
            <TextInput
              aria-label={t("spaces.feld.ansichtTag")}
              placeholder={t("spaces.feld.ansichtTag")}
              data-testid="space-ansicht-tag"
              value={a.tag}
              onChange={(e) =>
                setForm({
                  ...form,
                  ansichten: form.ansichten.map((x, j) =>
                    j === i ? { ...x, tag: e.target.value } : x,
                  ),
                })
              }
            />
            <Button
              onClick={() =>
                setForm({ ...form, ansichten: form.ansichten.filter((_, j) => j !== i) })
              }
            >
              {t("spaces.feld.entfernen")}
            </Button>
          </div>
        ))}
        <Button
          data-testid="space-ansicht-hinzu"
          onClick={() =>
            setForm({ ...form, ansichten: [...form.ansichten, { name: "", tag: "" }] })
          }
        >
          {t("spaces.feld.ansichtHinzu")}
        </Button>
      </fieldset>
      <p className="text-[12px] text-muted-2">{t("spaces.formular.hinweis")}</p>
      {speichern.isError ? (
        <p role="alert" data-testid="space-fehler" className="text-[12.5px] text-trust-crit-text">
          {t(spaceFehlerSchluessel(speichern.error))}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="primary"
          data-testid="space-speichern"
          disabled={speichern.isPending}
        >
          {t("spaces.formular.speichern")}
        </Button>
        <Button onClick={onFertig}>{t("spaces.formular.abbrechen")}</Button>
      </div>
    </form>
  );
}

function SpaceKopf({ s }: { s: SpaceSicht }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="space-y-1">
      <p className="text-[13px] text-text" data-testid="space-zweck-anzeige">
        {s.zweck}
      </p>
      <p className="text-[12.5px] text-muted" data-testid="space-zustaendig">
        {t("spaces.detail.zustaendig", { name: s.verantwortlichName ?? s.verantwortlich })}
      </p>
      <p className="text-[12px] text-muted-2">
        {t(`spaces.zugang.${s.zugang}`)} · {t(`spaces.eigenesRecht.${s.eigenesRecht}`)} ·{" "}
        {t("spaces.detail.fassung", { version: s.version })}
      </p>
      {s.mitglieder.length > 0 ? (
        <p className="text-[12px] text-muted-2" data-testid="space-mitglieder-anzeige">
          {t("spaces.feld.mitglieder")}:{" "}
          {s.mitglieder
            .map((m) => `${m.name ?? m.nutzer} (${t(`spaces.recht.${m.recht}`)})`)
            .join(", ")}
        </p>
      ) : null}
    </div>
  );
}

function Artikelliste({ artikel }: { artikel: ArtikelZeile[] }): JSX.Element {
  const { t } = useTranslation();
  if (artikel.length === 0) {
    return (
      <p data-testid="space-keine-artikel" className="text-[12.5px] text-muted">
        {t("spaces.detail.keineArtikel")}
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {artikel.map((a) => (
        <li key={a.id} data-testid="space-artikel" data-ko={a.id} data-version={a.version}>
          <Link
            to={`/wissen/${encodeURIComponent(a.id)}`}
            className="block rounded-btn border border-hairline px-3 py-2 hover:border-ink/30"
          >
            <span className="block text-[13.5px] font-semibold text-ink">{a.title}</span>
            <span className="block text-[12px] text-muted-2">
              {a.spaceName
                ? t("spaces.detail.ausSpace", { name: a.spaceName })
                : t("spaces.detail.ohneSpace")}{" "}
              · {t("spaces.detail.fassung", { version: a.version })}
              {a.tags.length > 0 ? ` · ${a.tags.join(", ")}` : ""}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SpaceDetail({ id }: { id: string }): JSX.Element {
  const { t, i18n } = useTranslation();
  const [parameter, setParameter] = useSearchParams();
  const ansicht = parameter.get("ansicht") ?? undefined;
  const [bearbeiten, setBearbeiten] = useState(false);
  const [verlauf, setVerlauf] = useState(false);
  const eintrag = useQuery({ queryKey: ["space", id], queryFn: () => spacesApi.eintrag(id) });
  const artikel = useQuery({
    queryKey: ["space", id, "artikel", ansicht ?? ""],
    queryFn: () => spacesApi.artikel(id, ansicht),
    enabled: eintrag.isSuccess && eintrag.data.space.darfInhalteLesen,
  });

  if (eintrag.isPending) {
    return <p className="text-sm text-muted">{t("spaces.seite.laedt")}</p>;
  }
  if (eintrag.isError) {
    return (
      <p role="alert" data-testid="space-nicht-gefunden" className="text-sm text-muted">
        {t("spaces.detail.nichtGefunden")}
      </p>
    );
  }
  const s = eintrag.data.space;
  const gewaehlt = s.ansichten.find((a) => a.id === ansicht);
  return (
    <div data-testid="space-detail" data-space={s.id}>
      <PageHeader
        pageKey="space"
        kicker={t("spaces.seite.titel")}
        title={s.name}
        actions={
          <>
            <Link
              to="/spaces"
              className="text-[12.5px] font-semibold text-brand-text hover:underline"
            >
              {t("spaces.seite.zurueck")}
            </Link>
            {s.darfBearbeiten && !bearbeiten ? (
              <Button data-testid="space-bearbeiten" onClick={() => setBearbeiten(true)}>
                {t("spaces.seite.bearbeiten")}
              </Button>
            ) : null}
          </>
        }
      />
      {bearbeiten ? (
        <Card className="mb-4" data-testid="space-pflege">
          <SectionLabel>{t("spaces.seite.bearbeiten")}</SectionLabel>
          <SpaceFormular
            key={`${s.id}-${s.version}`}
            vorlage={s}
            onFertig={() => setBearbeiten(false)}
          />
        </Card>
      ) : null}
      <Card className="mb-4">
        <SpaceKopf s={s} />
        <div className="mt-2">
          <Button
            data-testid="space-verlauf-knopf"
            aria-expanded={verlauf}
            onClick={() => setVerlauf((v) => !v)}
          >
            {t("spaces.detail.verlauf")}
          </Button>
        </div>
        {verlauf ? (
          <ol data-testid="space-verlauf" className="mt-2 space-y-1 border-t border-hairline pt-2">
            {[...eintrag.data.fassungen].reverse().map((f) => (
              <li key={f.version} data-testid="space-fassung" className="text-[12px] text-muted-2">
                {t("spaces.detail.verlaufEintrag", {
                  version: f.version,
                  zeit: formatKoTimestamp(f.geaendertAm, i18n.language) ?? "—",
                  wer: f.geaendertVonName ?? f.geaendertVon,
                })}
              </li>
            ))}
          </ol>
        ) : null}
      </Card>
      {s.darfInhalteLesen ? (
        <Card>
          <div className="mb-3 flex flex-wrap gap-2">
            <Button
              data-testid="space-reiter-artikel"
              variant={gewaehlt ? "outline" : "primary"}
              onClick={() => setParameter({})}
            >
              {t("spaces.detail.artikel")}
            </Button>
            {s.ansichten.map((a) => (
              <Button
                key={a.id}
                data-testid="space-reiter-ansicht"
                data-ansicht={a.id}
                variant={gewaehlt?.id === a.id ? "primary" : "outline"}
                onClick={() => setParameter({ ansicht: a.id })}
              >
                {a.name}
              </Button>
            ))}
          </div>
          <SectionLabel>
            {gewaehlt
              ? t("spaces.detail.ansicht", { name: gewaehlt.name, tag: gewaehlt.tag })
              : t("spaces.detail.artikel")}
          </SectionLabel>
          {artikel.isSuccess ? <Artikelliste artikel={artikel.data.artikel} /> : null}
          {artikel.isError ? (
            <p role="alert" className="text-[12.5px] text-muted">
              {t(spaceFehlerSchluessel(artikel.error))}
            </p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function SpaceUebersicht(): JSX.Element {
  const { t } = useTranslation();
  const [neu, setNeu] = useState(false);
  const liste = useQuery({ queryKey: ["spaces"], queryFn: spacesApi.liste });
  return (
    <div>
      <PageHeader
        pageKey="spaces"
        title={t("spaces.seite.titel")}
        lead={t("spaces.seite.lead")}
        actions={
          liste.data?.darfAnlegen && !neu ? (
            <Button variant="primary" data-testid="space-neu" onClick={() => setNeu(true)}>
              {t("spaces.seite.neu")}
            </Button>
          ) : null
        }
      />
      <p className="mb-4 text-[12px] text-muted-2">{t("spaces.seite.grenze")}</p>
      {neu ? (
        <Card className="mb-4" data-testid="space-pflege">
          <SectionLabel>{t("spaces.seite.neu")}</SectionLabel>
          <SpaceFormular vorlage={null} onFertig={() => setNeu(false)} />
        </Card>
      ) : null}
      {liste.isPending ? <p className="text-sm text-muted">{t("spaces.seite.laedt")}</p> : null}
      {liste.isError ? (
        <p role="alert" className="text-sm text-muted">
          {t(spaceFehlerSchluessel(liste.error))}
        </p>
      ) : null}
      {liste.isSuccess && liste.data.spaces.length === 0 ? (
        <>
          <p data-testid="spaces-leer" className="text-sm text-muted">
            {t("spaces.seite.leer")}
          </p>
          {/* R-0956 (Nacharbeit 7): die leere Liste ordnet in den Wissenskreis ein. */}
          {leerzustandsZeile(t, "spaces")}
        </>
      ) : null}
      <ul className="space-y-3">
        {(liste.data?.spaces ?? []).map((s) => (
          <li key={s.id}>
            <Card interactive={false} data-testid="space-eintrag" data-space={s.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-ink">{s.name}</p>
                  <SpaceKopf s={s} />
                  {s.darfInhalteLesen ? (
                    <p className="mt-1 text-[12px] text-muted-2">
                      {t("spaces.seite.artikelZahl", { anzahl: s.artikelSichtbar ?? 0 })}
                    </p>
                  ) : null}
                </div>
                <Link
                  to={`/spaces/${encodeURIComponent(s.id)}`}
                  data-testid="space-oeffnen"
                  className="shrink-0 text-[12.5px] font-semibold text-brand-text hover:underline"
                >
                  {t("spaces.seite.oeffnen")}
                </Link>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Spaces(): JSX.Element {
  const { id } = useParams();
  return (
    <div className="mx-auto max-w-4xl" data-testid="page-spaces-flaeche">
      {id ? <SpaceDetail id={id} /> : <SpaceUebersicht />}
    </div>
  );
}
