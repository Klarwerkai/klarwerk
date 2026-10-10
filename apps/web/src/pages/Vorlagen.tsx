// ================================================================================================
// VORLAGEN — eigene Vorlagen, Teilen, Fassungen, persönlicher Standard, Space-Vorgaben und — für
// die Kontoverwaltung — Geltung, Nutzungsumfang und Begriffspflege
// (produkt:20261007:templates-default · ADMIN-08).
// ================================================================================================
//
// Rechte entscheidet der Server (`vorlagen-routes.ts`); diese Seite zeigt nur an, was er erlaubt
// (`darfBearbeiten`, `darf.*`, `vorgabenSpaces`). Jede Änderung zeigt VOR dem Speichern ihre
// Auswirkungen (Nutzung je Fassung und Space, neue Pflichtfelder); bestehende Beiträge behalten
// Werte und Fassungsbezug. Nichts wird gelöscht: Vorlagen werden mit Begründung ausgemustert.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type Aenderungswirkung,
  type BegriffsAuftrag,
  type BegriffsPlan,
  type EigeneGeltung,
  type SpaceVorgabeEingabe,
  type VorlageEingabe,
  type VorlageSicht,
  type VorlagenListe,
  neueVorschauAus,
  vorlagenApi,
  vorlagenFehlerSchluessel,
} from "../api/vorlagen";
import { Button, Card, Field, PageHeader, SectionLabel, TextInput } from "../components/ui";
import {
  FELD_ARTEN,
  type FeldArt,
  type StrukturFeld,
  feldText,
  vorlagenName,
  vorlagenSprache,
} from "../lib/vorlagenStruktur";

const FELD =
  "w-full rounded-input border border-hairline bg-surface px-3 py-2 text-sm text-text outline-none focus:border-ink/30";

function Fehlerzeile({ fehler, testId }: { fehler: unknown; testId: string }): JSX.Element {
  const { t } = useTranslation();
  return (
    <p role="alert" data-testid={testId} className="text-[12.5px] text-trust-crit-text">
      {t(vorlagenFehlerSchluessel(fehler))}
    </p>
  );
}

function liste(text: string): string[] {
  return text
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

// ------------------------------------------------------------------------------------------------
// DAS FORMULAR: anlegen, ändern, teilen — mit Auswirkungen vor dem Speichern.
// ------------------------------------------------------------------------------------------------

function leeresFeld(): StrukturFeld {
  return { id: "", titel: "", hinweis: "", art: "absatz", pflicht: false };
}

function VorlagenFormular({
  basis,
  daten,
  kopie,
  onFertig,
}: {
  /** Bestehende Vorlage (ändern/teilen) — fehlt sie, wird angelegt. */
  basis?: VorlageSicht;
  daten: VorlagenListe;
  /** Als eigene Vorlage kopieren (z. B. aus einer Standardvorlage). */
  kopie?: VorlageSicht;
  onFertig: () => void;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const sprache = vorlagenSprache(i18n.language);
  const qc = useQueryClient();
  const quelle = basis ?? kopie;
  const [form, setForm] = useState<VorlageEingabe>(() => ({
    name: quelle ? (kopie ? `${vorlagenName(quelle, sprache)}` : quelle.name) : "",
    beschreibung: quelle?.beschreibung ?? "",
    geltung: basis && basis.geltung !== "standard" ? basis.geltung : "persoenlich",
    ...(basis?.spaceId ? { spaceId: basis.spaceId } : {}),
    felder: quelle
      ? quelle.felder.map((f) => ({
          // Eine Kopie übernimmt die Felder in der Sprache der Oberfläche, ohne Übersetzungen.
          id: f.id,
          titel: kopie ? feldText(f, sprache).titel : f.titel,
          hinweis: kopie ? feldText(f, sprache).hinweis : f.hinweis,
          art: f.art,
          pflicht: f.pflicht,
        }))
      : [leeresFeld()],
  }));
  const [wirkung, setWirkung] = useState<Aenderungswirkung | null>(null);

  const speichern = useMutation({
    mutationFn: async () => {
      if (basis) {
        return (await vorlagenApi.aendern(basis.id, basis.version, form)).vorlage;
      }
      return vorlagenApi.anlegen(form);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["vorlagen"] });
      await qc.invalidateQueries({ queryKey: ["vorlage"] });
      onFertig();
    },
  });
  const vorschau = useMutation({
    mutationFn: () => vorlagenApi.vorschau(basis?.id ?? "", form),
    onSuccess: (w) => setWirkung(w),
  });

  function feldAendern(i: number, teil: Partial<StrukturFeld>): void {
    setWirkung(null);
    setForm({ ...form, felder: form.felder.map((f, k) => (k === i ? { ...f, ...teil } : f)) });
  }

  function verschieben(i: number, um: -1 | 1): void {
    const j = i + um;
    if (j < 0 || j >= form.felder.length) {
      return;
    }
    const felder = [...form.felder];
    const a = felder[i] as StrukturFeld;
    felder[i] = felder[j] as StrukturFeld;
    felder[j] = a;
    setWirkung(null);
    setForm({ ...form, felder });
  }

  const geltungen: EigeneGeltung[] = [
    "persoenlich",
    ...(daten.spaces.length > 0 || form.geltung === "space" ? (["space"] as const) : []),
    ...(daten.darf.unternehmen || form.geltung === "unternehmen" ? (["unternehmen"] as const) : []),
  ];

  return (
    <form
      data-testid="vorlage-formular"
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (basis && !wirkung) {
          vorschau.mutate();
          return;
        }
        speichern.mutate();
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t("vorlagen.feld.name")}>
          <TextInput
            data-testid="vorlage-name"
            required
            maxLength={80}
            value={form.name}
            onChange={(e) => {
              setWirkung(null);
              setForm({ ...form, name: e.target.value });
            }}
          />
        </Field>
        <Field label={t("vorlagen.feld.geltung")}>
          <select
            data-testid="vorlage-geltung"
            className={FELD}
            value={form.geltung}
            onChange={(e) => {
              const geltung = e.target.value as EigeneGeltung;
              setWirkung(null);
              const { spaceId: _alt, ...ohne } = form;
              setForm(
                geltung === "space"
                  ? { ...ohne, geltung, spaceId: form.spaceId ?? daten.spaces[0]?.id ?? "" }
                  : { ...ohne, geltung },
              );
            }}
          >
            {geltungen.map((g) => (
              <option key={g} value={g}>
                {t(`vorlagen.geltung.${g}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {form.geltung === "space" ? (
        <Field label={t("vorlagen.feld.space")}>
          <select
            data-testid="vorlage-space"
            className={FELD}
            value={form.spaceId ?? ""}
            onChange={(e) => {
              setWirkung(null);
              setForm({ ...form, spaceId: e.target.value });
            }}
          >
            {daten.spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <p className="text-[12px] text-muted-2">{t(`vorlagen.geltung.erklaerung.${form.geltung}`)}</p>
      <Field label={t("vorlagen.feld.beschreibung")}>
        <textarea
          data-testid="vorlage-beschreibung"
          className={FELD}
          rows={2}
          maxLength={500}
          value={form.beschreibung}
          onChange={(e) => {
            setWirkung(null);
            setForm({ ...form, beschreibung: e.target.value });
          }}
        />
      </Field>
      <fieldset className="space-y-2">
        <legend className="text-[12.5px] font-medium text-muted">
          {t("vorlagen.feld.felder")}
        </legend>
        {form.felder.map((f, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: Feldzeilen haben vor dem Speichern keine Kennung.
            key={i}
            data-testid="vorlage-feldzeile"
            className="grid gap-2 rounded-btn border border-hairline p-2 md:grid-cols-[1fr_1fr_auto]"
          >
            <TextInput
              aria-label={t("vorlagen.feld.titel", { nummer: i + 1 })}
              data-testid="vorlage-feld-titel"
              required
              maxLength={80}
              value={f.titel}
              onChange={(e) => feldAendern(i, { titel: e.target.value })}
            />
            <TextInput
              aria-label={t("vorlagen.feld.hinweis", { nummer: i + 1 })}
              data-testid="vorlage-feld-hinweis"
              maxLength={300}
              value={f.hinweis}
              onChange={(e) => feldAendern(i, { hinweis: e.target.value })}
            />
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label={t("vorlagen.feld.art", { nummer: i + 1 })}
                className="rounded-input border border-hairline bg-surface px-2 py-1 text-[12px]"
                value={f.art}
                onChange={(e) => feldAendern(i, { art: e.target.value as FeldArt })}
              >
                {FELD_ARTEN.map((a) => (
                  <option key={a} value={a}>
                    {t(`vorlagen.art.${a}`)}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-1 text-[12px] text-muted">
                <input
                  type="checkbox"
                  data-testid="vorlage-feld-pflicht"
                  checked={f.pflicht}
                  onChange={(e) => feldAendern(i, { pflicht: e.target.checked })}
                />
                {t("vorlagen.pflicht.marke")}
              </label>
              <Button
                type="button"
                aria-label={t("vorlagen.feld.hoch", { nummer: i + 1 })}
                disabled={i === 0}
                onClick={() => verschieben(i, -1)}
              >
                ↑
              </Button>
              <Button
                type="button"
                aria-label={t("vorlagen.feld.runter", { nummer: i + 1 })}
                disabled={i === form.felder.length - 1}
                onClick={() => verschieben(i, 1)}
              >
                ↓
              </Button>
              <Button
                type="button"
                aria-label={t("vorlagen.feld.entfernen", { nummer: i + 1 })}
                disabled={form.felder.length === 1}
                onClick={() => {
                  setWirkung(null);
                  setForm({ ...form, felder: form.felder.filter((_, k) => k !== i) });
                }}
              >
                ×
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          data-testid="vorlage-feld-neu"
          disabled={form.felder.length >= 20}
          onClick={() => {
            setWirkung(null);
            setForm({ ...form, felder: [...form.felder, leeresFeld()] });
          }}
        >
          {t("vorlagen.feld.neu")}
        </Button>
      </fieldset>

      {wirkung ? <Wirkung w={wirkung} /> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          variant="primary"
          data-testid="vorlage-speichern"
          disabled={speichern.isPending || vorschau.isPending}
        >
          {basis
            ? wirkung
              ? t("vorlagen.formular.neueFassung")
              : t("vorlagen.formular.auswirkungen")
            : t("vorlagen.formular.anlegen")}
        </Button>
        <Button type="button" onClick={onFertig}>
          {t("vorlagen.abbrechen")}
        </Button>
      </div>
      {speichern.isError ? <Fehlerzeile fehler={speichern.error} testId="vorlage-fehler" /> : null}
      {vorschau.isError ? <Fehlerzeile fehler={vorschau.error} testId="vorlage-fehler" /> : null}
    </form>
  );
}

function Wirkung({ w }: { w: Aenderungswirkung }): JSX.Element {
  const { t } = useTranslation();
  const zeilen: string[] = [];
  if (w.felder.neu.length) {
    zeilen.push(t("vorlagen.wirkung.neu", { liste: w.felder.neu.join(", ") }));
  }
  if (w.felder.entfernt.length) {
    zeilen.push(t("vorlagen.wirkung.entfernt", { liste: w.felder.entfernt.join(", ") }));
  }
  for (const u of w.felder.umbenannt) {
    zeilen.push(t("vorlagen.wirkung.umbenannt", u));
  }
  if (w.felder.pflichtNeu.length) {
    zeilen.push(t("vorlagen.wirkung.pflichtNeu", { liste: w.felder.pflichtNeu.join(", ") }));
  }
  if (w.felder.pflichtEntfallen.length) {
    zeilen.push(
      t("vorlagen.wirkung.pflichtEntfallen", { liste: w.felder.pflichtEntfallen.join(", ") }),
    );
  }
  if (w.geltung.vorher !== w.geltung.nachher || w.geltung.spaceVorher !== w.geltung.spaceNachher) {
    zeilen.push(
      t("vorlagen.wirkung.geltung", {
        vorher: t(`vorlagen.geltung.${w.geltung.vorher}`),
        nachher: t(`vorlagen.geltung.${w.geltung.nachher}`),
      }),
    );
  }
  return (
    <div
      data-testid="vorlage-wirkung"
      className="rounded-btn bg-page p-2.5 text-[12.5px] text-muted"
    >
      <p className="font-semibold text-text">{t("vorlagen.wirkung.titel")}</p>
      <ul className="list-disc pl-5">
        {zeilen.map((z) => (
          <li key={z}>{z}</li>
        ))}
        <li data-testid="vorlage-wirkung-nutzung">
          {t("vorlagen.wirkung.nutzung", {
            anzahl: w.nutzung.gesamt,
            fassungen: w.nutzung.jeVersion
              .map((v) => t("vorlagen.wirkung.jeFassung", v))
              .join(", "),
          })}
        </li>
        {w.nutzung.jeSpace.length > 0 ? (
          <li>
            {t("vorlagen.wirkung.jeSpace", {
              liste: w.nutzung.jeSpace
                .map((s) => `${s.name ?? t("vorlagen.ohneSpace")}: ${s.anzahl}`)
                .join(", "),
            })}
          </li>
        ) : null}
        <li>{t("vorlagen.wirkung.standardBei", { anzahl: w.standardBei })}</li>
        {w.verbindlichIn.length > 0 ? (
          <li>
            {t("vorlagen.wirkung.verbindlichIn", {
              liste: w.verbindlichIn.map((s) => s.name).join(", "),
            })}
          </li>
        ) : null}
      </ul>
      <p className="mt-1" data-testid="vorlage-wirkung-bestand">
        {t("vorlagen.wirkung.bestand")}
      </p>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// EINE VORLAGE: Felder, Fassungsverlauf, Aktionen.
// ------------------------------------------------------------------------------------------------

function VorlagenKarte({
  v,
  daten,
}: {
  v: VorlageSicht;
  daten: VorlagenListe;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const sprache = vorlagenSprache(i18n.language);
  const qc = useQueryClient();
  const [modus, setModus] = useState<"" | "bearbeiten" | "kopie" | "verlauf" | "ausmustern">("");
  const [begruendung, setBegruendung] = useState("");
  const verlauf = useQuery({
    queryKey: ["vorlage", v.id],
    queryFn: () => vorlagenApi.eintrag(v.id),
    enabled: modus === "verlauf",
  });
  const standard = useMutation({
    mutationFn: (id: string | null) => vorlagenApi.standardSetzen(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["vorlagen"] });
    },
  });
  const ausmustern = useMutation({
    mutationFn: () => vorlagenApi.ausmustern(v.id, v.version, begruendung),
    onSuccess: async () => {
      setModus("");
      await qc.invalidateQueries({ queryKey: ["vorlagen"] });
      await qc.invalidateQueries({ queryKey: ["vorlage"] });
    },
  });
  return (
    <li
      data-testid="vorlage-karte"
      data-vorlage={v.id}
      className="rounded-btn border border-hairline p-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13.5px] font-semibold text-ink">
          {vorlagenName(v, sprache)}
          {v.istStandard ? (
            <span className="ml-2 text-[11.5px] font-medium text-trust-pos-text">
              {t("vorlagen.istStandard")}
            </span>
          ) : null}
          {v.ausgemustert ? (
            <span className="ml-2 text-[11.5px] font-medium text-muted-2">
              {t("vorlagen.ausgemustert")}
            </span>
          ) : null}
        </span>
        <span className="text-[12px] text-muted-2">
          {t(`vorlagen.geltung.${v.geltung}`)}
          {v.spaceName ? ` „${v.spaceName}“` : ""} · {t("vorlagen.fassung", { version: v.version })}
          {v.eigentuemerName ? ` · ${v.eigentuemerName}` : ""}
        </span>
      </div>
      <p className="mt-1 text-[12px] text-muted">
        {v.felder
          .map(
            (f) =>
              `${feldText(f, sprache).titel}${f.pflicht ? ` (${t("vorlagen.pflicht.marke")})` : ""}`,
          )
          .join(" · ")}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {v.darfAnwenden && !v.istStandard ? (
          <Button
            data-testid="vorlage-als-standard"
            disabled={standard.isPending}
            onClick={() => standard.mutate(v.id)}
          >
            {t("vorlagen.standard.setzen")}
          </Button>
        ) : null}
        {v.istStandard ? (
          <Button disabled={standard.isPending} onClick={() => standard.mutate(null)}>
            {t("vorlagen.standard.aufheben")}
          </Button>
        ) : null}
        {v.darfBearbeiten && !v.ausgemustert ? (
          <>
            <Button data-testid="vorlage-bearbeiten" onClick={() => setModus("bearbeiten")}>
              {t("vorlagen.bearbeiten")}
            </Button>
            <Button data-testid="vorlage-ausmustern" onClick={() => setModus("ausmustern")}>
              {t("vorlagen.ausmustern.knopf")}
            </Button>
          </>
        ) : null}
        {daten.darf.anlegen ? (
          <Button data-testid="vorlage-kopieren" onClick={() => setModus("kopie")}>
            {t("vorlagen.kopieren")}
          </Button>
        ) : null}
        <Button
          data-testid="vorlage-verlauf"
          onClick={() => setModus(modus === "verlauf" ? "" : "verlauf")}
        >
          {t("vorlagen.verlauf")}
        </Button>
      </div>
      {standard.isError ? <Fehlerzeile fehler={standard.error} testId="vorlage-fehler" /> : null}
      {modus === "bearbeiten" ? (
        <div className="mt-3">
          <VorlagenFormular basis={v} daten={daten} onFertig={() => setModus("")} />
        </div>
      ) : null}
      {modus === "kopie" ? (
        <div className="mt-3">
          <VorlagenFormular kopie={v} daten={daten} onFertig={() => setModus("")} />
        </div>
      ) : null}
      {modus === "ausmustern" ? (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            ausmustern.mutate();
          }}
        >
          <p className="text-[12.5px] text-muted">{t("vorlagen.ausmustern.erklaerung")}</p>
          <Field label={t("vorlagen.begruendung")}>
            <TextInput
              data-testid="vorlage-begruendung"
              required
              value={begruendung}
              onChange={(e) => setBegruendung(e.target.value)}
            />
          </Field>
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="danger"
              data-testid="vorlage-ausmustern-bestaetigen"
              disabled={ausmustern.isPending}
            >
              {t("vorlagen.ausmustern.knopf")}
            </Button>
            <Button type="button" onClick={() => setModus("")}>
              {t("vorlagen.abbrechen")}
            </Button>
          </div>
          {ausmustern.isError ? (
            <Fehlerzeile fehler={ausmustern.error} testId="vorlage-fehler" />
          ) : null}
        </form>
      ) : null}
      {modus === "verlauf" && verlauf.data ? (
        <ol data-testid="vorlage-fassungen" className="mt-3 space-y-1 text-[12px] text-muted">
          {verlauf.data.fassungen.map((f) => (
            <li key={f.version}>
              {t("vorlagen.fassung", { version: f.version })} · {t(`vorlagen.vorgang.${f.vorgang}`)}{" "}
              · {new Date(f.geaendertAm).toLocaleString(i18n.language)}
              {f.geaendertVonName ? ` · ${f.geaendertVonName}` : ""} ·{" "}
              {f.felder.map((x) => feldText(x, sprache).titel).join(", ")}
              {f.begruendung ? ` · ${f.begruendung}` : ""}
            </li>
          ))}
        </ol>
      ) : null}
    </li>
  );
}

// ------------------------------------------------------------------------------------------------
// SPACE-VORGABEN — für Spacezuständige und Kontoverwaltung.
// ------------------------------------------------------------------------------------------------

function SpaceVorgaben({ daten }: { daten: VorlagenListe }): JSX.Element | null {
  const { t, i18n } = useTranslation();
  const sprache = vorlagenSprache(i18n.language);
  const qc = useQueryClient();
  const [spaceId, setSpaceId] = useState(daten.vorgabenSpaces[0]?.id ?? "");
  const stand = useQuery({
    queryKey: ["vorlagen", "space-vorgaben", spaceId],
    queryFn: () => vorlagenApi.spaceVorgaben(spaceId),
    enabled: spaceId !== "",
  });
  if (daten.vorgabenSpaces.length === 0) {
    return null;
  }
  const letzte = stand.data?.fassungen.at(-1);
  const waehlbar = daten.vorlagen.filter(
    (v) =>
      !v.ausgemustert &&
      (v.geltung === "standard" ||
        v.geltung === "unternehmen" ||
        (v.geltung === "space" && v.spaceId === spaceId)),
  );
  return (
    <Card className="mb-4" data-testid="vorlagen-space-vorgaben">
      <SectionLabel>{t("vorlagen.vorgaben.titel")}</SectionLabel>
      <p className="mb-2 text-[12.5px] text-muted">{t("vorlagen.vorgaben.erklaerung")}</p>
      <Field label={t("vorlagen.feld.space")}>
        <select
          data-testid="vorgaben-space"
          className={FELD}
          value={spaceId}
          onChange={(e) => setSpaceId(e.target.value)}
        >
          {daten.vorgabenSpaces.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      {stand.data ? (
        <VorgabenFormular
          key={`${spaceId}-${letzte?.version ?? 0}`}
          spaceId={spaceId}
          version={letzte?.version ?? 0}
          start={{
            verbindlicheVorlageId: letzte?.verbindlicheVorlageId ?? null,
            kategorien: letzte?.kategorien ?? [],
            pflichtKategorie: letzte?.pflichtKategorie ?? false,
            mindestensTags: letzte?.mindestensTags ?? 0,
            tags: letzte?.tags ?? [],
            hinweis: letzte?.hinweis ?? "",
          }}
          optionen={waehlbar.map((v) => ({ id: v.id, name: vorlagenName(v, sprache) }))}
          onGespeichert={async () => {
            await qc.invalidateQueries({ queryKey: ["vorlagen"] });
          }}
        />
      ) : null}
      {stand.data && stand.data.fassungen.length > 0 ? (
        <p className="mt-2 text-[11.5px] text-muted-2" data-testid="vorgaben-verlauf">
          {t("vorlagen.vorgaben.verlauf", {
            anzahl: stand.data.fassungen.length,
            am: letzte ? new Date(letzte.geaendertAm).toLocaleString(i18n.language) : "",
          })}
        </p>
      ) : null}
    </Card>
  );
}

function VorgabenFormular({
  spaceId,
  version,
  start,
  optionen,
  onGespeichert,
}: {
  spaceId: string;
  version: number;
  start: SpaceVorgabeEingabe;
  optionen: { id: string; name: string }[];
  onGespeichert: () => Promise<void>;
}): JSX.Element {
  const { t } = useTranslation();
  const [form, setForm] = useState(start);
  const [kategorien, setKategorien] = useState(start.kategorien.join(", "));
  const [tags, setTags] = useState(start.tags.join(", "));
  const speichern = useMutation({
    mutationFn: () =>
      vorlagenApi.spaceVorgabenSetzen(spaceId, version, {
        ...form,
        kategorien: liste(kategorien),
        tags: liste(tags),
      }),
    onSuccess: onGespeichert,
  });
  return (
    <form
      data-testid="vorgaben-formular"
      className="mt-3 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        speichern.mutate();
      }}
    >
      <Field label={t("vorlagen.vorgaben.verbindlich")}>
        <select
          data-testid="vorgaben-verbindlich"
          className={FELD}
          value={form.verbindlicheVorlageId ?? ""}
          onChange={(e) => setForm({ ...form, verbindlicheVorlageId: e.target.value || null })}
        >
          <option value="">{t("vorlagen.vorgaben.keine")}</option>
          {optionen.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("vorlagen.vorgaben.kategorien")}>
        <TextInput
          data-testid="vorgaben-kategorien"
          value={kategorien}
          onChange={(e) => setKategorien(e.target.value)}
        />
      </Field>
      <label className="flex items-center gap-2 text-[12.5px] text-muted">
        <input
          type="checkbox"
          data-testid="vorgaben-pflicht-kategorie"
          checked={form.pflichtKategorie}
          onChange={(e) => setForm({ ...form, pflichtKategorie: e.target.checked })}
        />
        {t("vorlagen.vorgaben.pflichtKategorie")}
      </label>
      <Field label={t("vorlagen.vorgaben.mindestensTags")}>
        <TextInput
          data-testid="vorgaben-mindestens-tags"
          type="number"
          min={0}
          max={5}
          value={String(form.mindestensTags)}
          onChange={(e) => setForm({ ...form, mindestensTags: Number(e.target.value) || 0 })}
        />
      </Field>
      <Field label={t("vorlagen.vorgaben.tags")}>
        <TextInput
          data-testid="vorgaben-tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
      </Field>
      <Field label={t("vorlagen.vorgaben.hinweis")}>
        <textarea
          data-testid="vorgaben-hinweis"
          className={FELD}
          rows={2}
          value={form.hinweis}
          onChange={(e) => setForm({ ...form, hinweis: e.target.value })}
        />
      </Field>
      <p className="text-[12px] text-muted-2">{t("vorlagen.vorgaben.wirkung")}</p>
      <Button
        type="submit"
        variant="primary"
        data-testid="vorgaben-speichern"
        disabled={speichern.isPending}
      >
        {t("vorlagen.vorgaben.speichern")}
      </Button>
      {speichern.isSuccess ? (
        <output className="block text-[12.5px] text-trust-pos-text">
          {t("vorlagen.vorgaben.gespeichert")}
        </output>
      ) : null}
      {speichern.isError ? <Fehlerzeile fehler={speichern.error} testId="vorgaben-fehler" /> : null}
    </form>
  );
}

// ------------------------------------------------------------------------------------------------
// ADMIN-08 · VERWALTUNG — Geltung und Nutzungsumfang; Begriffe umbenennen/zusammenführen/ausmustern.
// ------------------------------------------------------------------------------------------------

function Verwaltung(): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const daten = useQuery({ queryKey: ["vorlagen", "verwaltung"], queryFn: vorlagenApi.verwaltung });
  const [auftrag, setAuftrag] = useState<BegriffsAuftrag>({
    art: "tag",
    vorgang: "umbenennen",
    name: "",
    ziel: "",
    spaceId: null,
    begruendung: "",
  });
  const [plan, setPlan] = useState<BegriffsPlan | null>(null);
  const vorschau = useMutation({
    mutationFn: () => vorlagenApi.begriffVorschau(auftrag),
    onSuccess: setPlan,
  });
  // Der ausgeführte Plan bleibt als Variable der Mutation erhalten: das Ergebnis nennt damit die
  // Spaces beim Namen, auch nachdem die Vorschau geschlossen ist.
  const ausfuehren = useMutation({
    mutationFn: (p: BegriffsPlan) => vorlagenApi.begriffAusfuehren(auftrag, p.grundlage),
    onSuccess: async () => {
      setPlan(null);
      await qc.invalidateQueries({ queryKey: ["vorlagen"] });
    },
    // Hat sich der Bestand seit der Vorschau geändert, zeigt der Server die neue Vorschau mit —
    // sie ersetzt die alte, damit nur bestätigt wird, was jetzt tatsächlich geschieht.
    onError: (fehler) => {
      const neu = neueVorschauAus(fehler);
      if (neu) {
        setPlan(neu);
      }
    },
  });
  if (daten.isPending) {
    return <p className="text-sm text-muted">{t("vorlagen.laedt")}</p>;
  }
  if (daten.isError) {
    return <Fehlerzeile fehler={daten.error} testId="verwaltung-fehler" />;
  }
  const d = daten.data;
  const aendere = (teil: Partial<BegriffsAuftrag>) => {
    setPlan(null);
    setAuftrag({ ...auftrag, ...teil });
  };
  return (
    <Card className="mb-4" data-testid="vorlagen-verwaltung">
      <SectionLabel>{t("vorlagen.verwaltung.titel")}</SectionLabel>
      <p className="mb-2 text-[12.5px] text-muted">{t("vorlagen.verwaltung.erklaerung")}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]" data-testid="verwaltung-vorlagen">
          <thead className="text-muted-2">
            <tr>
              <th className="py-1 pr-2">{t("vorlagen.feld.name")}</th>
              <th className="py-1 pr-2">{t("vorlagen.feld.geltung")}</th>
              <th className="py-1 pr-2">{t("vorlagen.verwaltung.nutzung")}</th>
              <th className="py-1 pr-2">{t("vorlagen.verwaltung.standardBei")}</th>
              <th className="py-1">{t("vorlagen.verwaltung.verbindlichIn")}</th>
            </tr>
          </thead>
          <tbody>
            {d.vorlagen.map((v) => (
              <tr key={v.id} className="border-t border-hairline align-top" data-vorlage={v.id}>
                <td className="py-1 pr-2">
                  {v.name} · {t("vorlagen.fassung", { version: v.version })}
                  {v.ausgemustert ? ` · ${t("vorlagen.ausgemustert")}` : ""}
                </td>
                <td className="py-1 pr-2">
                  {t(`vorlagen.geltung.${v.geltung}`)}
                  {v.spaceName ? ` „${v.spaceName}“` : ""}
                </td>
                <td className="py-1 pr-2" data-testid="verwaltung-nutzung">
                  {v.nutzung.gesamt}
                  {v.nutzung.jeVersion.length > 0
                    ? ` (${v.nutzung.jeVersion
                        .map((x) => t("vorlagen.wirkung.jeFassung", x))
                        .join(", ")})`
                    : ""}
                  {v.nutzung.jeSpace.length > 0
                    ? ` · ${v.nutzung.jeSpace
                        .map((s) => `${s.name ?? t("vorlagen.ohneSpace")}: ${s.anzahl}`)
                        .join(", ")}`
                    : ""}
                </td>
                <td className="py-1 pr-2">{v.standardBei}</td>
                <td className="py-1">{v.verbindlichIn.map((s) => s.name).join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12px] text-muted-2">
        {t("vorlagen.verwaltung.persoenlich", {
          vorlagen: d.persoenlich.vorlagen,
          beitraege: d.persoenlich.beitraege,
        })}
      </p>

      {(["kategorien", "tags"] as const).map((art) => (
        <div key={art} className="mt-3" data-testid={`verwaltung-${art}`}>
          <p className="text-[12.5px] font-semibold text-text">{t(`vorlagen.verwaltung.${art}`)}</p>
          <ul className="text-[12px] text-muted">
            {d[art].map((b) => (
              <li key={b.name}>
                {b.name}: {b.gesamt} (
                {b.jeSpace
                  .map((s) => `${s.name ?? t("vorlagen.ohneSpace")}: ${s.anzahl}`)
                  .join(", ")}
                )
                {b.vorgegebenIn.length > 0
                  ? ` · ${t("vorlagen.verwaltung.vorgegebenIn", {
                      liste: b.vorgegebenIn.map((s) => s.name ?? s.spaceId).join(", "),
                    })}`
                  : ""}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {d.nichtEinsehbar > 0 ? (
        <p className="mt-1 text-[11.5px] text-muted-2">
          {t("vorlagen.verwaltung.nichtEinsehbar", { anzahl: d.nichtEinsehbar })}
        </p>
      ) : null}

      <form
        data-testid="begriffe-formular"
        className="mt-4 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (plan) {
            ausfuehren.mutate(plan);
          } else {
            vorschau.mutate();
          }
        }}
      >
        <p className="text-[12.5px] font-semibold text-text">{t("vorlagen.begriffe.titel")}</p>
        <div className="grid gap-2 md:grid-cols-3">
          <Field label={t("vorlagen.begriffe.art")}>
            <select
              data-testid="begriff-art"
              className={FELD}
              value={auftrag.art}
              onChange={(e) => aendere({ art: e.target.value as BegriffsAuftrag["art"] })}
            >
              <option value="tag">{t("vorlagen.begriffe.tag")}</option>
              <option value="kategorie">{t("vorlagen.begriffe.kategorie")}</option>
            </select>
          </Field>
          <Field label={t("vorlagen.begriffe.vorgang")}>
            <select
              data-testid="begriff-vorgang"
              className={FELD}
              value={auftrag.vorgang}
              onChange={(e) => aendere({ vorgang: e.target.value as BegriffsAuftrag["vorgang"] })}
            >
              <option value="umbenennen">{t("vorlagen.begriffe.umbenennen")}</option>
              <option value="zusammenfuehren">{t("vorlagen.begriffe.zusammenfuehren")}</option>
              <option value="ausmustern">{t("vorlagen.begriffe.ausmustern")}</option>
            </select>
          </Field>
          <Field label={t("vorlagen.begriffe.bereich")}>
            <select
              data-testid="begriff-bereich"
              className={FELD}
              value={auftrag.spaceId ?? ""}
              onChange={(e) => aendere({ spaceId: e.target.value || null })}
            >
              <option value="">{t("vorlagen.begriffe.alle")}</option>
              {d.spaceVorgaben.map((s) => (
                <option key={s.spaceId} value={s.spaceId}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("vorlagen.begriffe.name")}>
            <TextInput
              data-testid="begriff-name"
              required
              value={auftrag.name}
              onChange={(e) => aendere({ name: e.target.value })}
            />
          </Field>
          {auftrag.vorgang !== "ausmustern" ? (
            <Field label={t("vorlagen.begriffe.ziel")}>
              <TextInput
                data-testid="begriff-ziel"
                required
                value={auftrag.ziel ?? ""}
                onChange={(e) => aendere({ ziel: e.target.value })}
              />
            </Field>
          ) : null}
          <Field label={t("vorlagen.begruendung")}>
            <TextInput
              data-testid="begriff-begruendung"
              required
              value={auftrag.begruendung}
              onChange={(e) => aendere({ begruendung: e.target.value })}
            />
          </Field>
        </div>
        {plan ? (
          <div
            data-testid="begriff-plan"
            className="rounded-btn bg-page p-2.5 text-[12.5px] text-muted"
          >
            <p>{t("vorlagen.begriffe.betroffen", { anzahl: plan.betroffen.length })}</p>
            <ul className="list-disc pl-5">
              {plan.jeSpace.map((s) => (
                <li key={s.spaceId ?? "-"}>
                  {t("vorlagen.begriffe.jeSpace", {
                    space: s.name ?? t("vorlagen.ohneSpace"),
                    betroffen: s.betroffen,
                    ausserhalb: s.ausserhalb,
                  })}
                </li>
              ))}
            </ul>
            {plan.unberuehrt > 0 ? (
              <p data-testid="begriff-unberuehrt">
                {t("vorlagen.begriffe.unberuehrt", { anzahl: plan.unberuehrt })}
              </p>
            ) : null}
            {plan.ansichten.length > 0 ? (
              <ul data-testid="begriff-ansichten" className="list-disc pl-5">
                {plan.ansichten.map((x) => (
                  <li key={`${x.spaceId}:${x.ansicht}`}>
                    {t(
                      x.archiviert || auftrag.vorgang === "ausmustern"
                        ? "vorlagen.begriffe.ansichtBleibt"
                        : "vorlagen.begriffe.ansichtZiehtMit",
                      { ansicht: x.ansicht, space: x.spaceName },
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
            {plan.vorgaben.length > 0 ? (
              <ul data-testid="begriff-vorgaben" className="list-disc pl-5">
                {plan.vorgaben.map((x) => (
                  <li key={x.spaceId} data-vorgabe={x.spaceId}>
                    {t(
                      auftrag.vorgang === "ausmustern"
                        ? "vorlagen.begriffe.vorgabeBleibt"
                        : x.archiviert
                          ? "vorlagen.begriffe.vorgabeArchiviert"
                          : "vorlagen.begriffe.vorgabeZiehtMit",
                      {
                        space: x.spaceName ?? x.spaceId,
                        vorher: x.vorher.join(", "),
                        nachher: x.nachher.join(", "),
                      },
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
            <ul className="mt-1 text-[12px]">
              {plan.betroffen.slice(0, 20).map((z) => (
                <li key={z.koId}>
                  {z.title ?? t("vorlagen.begriffe.nichtEinsehbar")}: {z.vorher.join(", ")} →{" "}
                  {z.nachher.join(", ")}
                </li>
              ))}
            </ul>
            <p className="mt-1">
              {auftrag.vorgang === "ausmustern"
                ? t("vorlagen.begriffe.wirkungAusmustern")
                : t("vorlagen.begriffe.wirkung")}
            </p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            variant={plan ? "primary" : "outline"}
            data-testid="begriff-absenden"
            disabled={vorschau.isPending || ausfuehren.isPending}
          >
            {plan ? t("vorlagen.begriffe.ausfuehren") : t("vorlagen.begriffe.vorschau")}
          </Button>
          {plan ? (
            <Button type="button" onClick={() => setPlan(null)}>
              {t("vorlagen.abbrechen")}
            </Button>
          ) : null}
        </div>
        {vorschau.isError ? <Fehlerzeile fehler={vorschau.error} testId="begriff-fehler" /> : null}
        {ausfuehren.isError ? (
          <Fehlerzeile fehler={ausfuehren.error} testId="begriff-fehler" />
        ) : null}
        {ausfuehren.isSuccess ? (
          <output
            data-testid="begriff-ergebnis"
            className="block text-[12.5px] text-trust-pos-text"
          >
            {t("vorlagen.begriffe.erledigt", {
              geaendert: ausfuehren.data.geaendert,
              fehlgeschlagen: ausfuehren.data.fehlgeschlagen,
            })}
          </output>
        ) : null}
        {ausfuehren.isSuccess &&
        (ausfuehren.data.spaceVorgabenGeaendert.length > 0 ||
          ausfuehren.data.spaceVorgabenUebersprungen.length > 0) ? (
          <ul data-testid="begriff-ergebnis-vorgaben" className="list-disc pl-5 text-[12.5px]">
            {ausfuehren.data.spaceVorgabenGeaendert.map((id) => (
              <li key={id} data-vorgabe={id} className="text-trust-pos-text">
                {t("vorlagen.begriffe.ergebnisVorgabeGeaendert", {
                  space:
                    ausfuehren.variables?.vorgaben.find((x) => x.spaceId === id)?.spaceName ?? id,
                })}
              </li>
            ))}
            {ausfuehren.data.spaceVorgabenUebersprungen.map((x) => (
              <li key={x.spaceId} data-vorgabe={x.spaceId} className="text-trust-warn-text">
                {t(
                  x.grund === "archiviert"
                    ? "vorlagen.begriffe.ergebnisVorgabeArchiviert"
                    : "vorlagen.begriffe.ergebnisVorgabeZwischendurch",
                  { space: x.spaceName ?? x.spaceId },
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </form>
      {d.begriffe.length > 0 ? (
        <ul className="mt-3 text-[12px] text-muted" data-testid="begriffe-register">
          {d.begriffe.map((b) => (
            <li key={b.schluessel}>
              {t(`vorlagen.begriffe.${b.art}`)} „{b.name}“ · {t(`vorlagen.begriffe.${b.vorgang}`)}
              {b.ersatz ? ` → „${b.ersatz}“` : ""} · {b.begruendung}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

// ------------------------------------------------------------------------------------------------
// DIE SEITE
// ------------------------------------------------------------------------------------------------

export function Vorlagen(): JSX.Element {
  const { t } = useTranslation();
  const daten = useQuery({ queryKey: ["vorlagen"], queryFn: vorlagenApi.liste });
  const [anlegen, setAnlegen] = useState(false);
  if (daten.isPending) {
    return <p className="text-sm text-muted">{t("vorlagen.laedt")}</p>;
  }
  if (daten.isError) {
    return <Fehlerzeile fehler={daten.error} testId="vorlagen-fehler" />;
  }
  const d = daten.data;
  const standard = d.vorlagen.find((v) => v.id === d.standardId);
  return (
    <div data-testid="vorlagen-seite" className="mx-auto max-w-4xl">
      <PageHeader
        pageKey="vorlagen"
        kicker={t("vorlagen.seite.kicker")}
        title={t("vorlagen.seite.titel")}
        lead={t("vorlagen.seite.lead")}
        actions={
          d.darf.anlegen && !anlegen ? (
            <Button variant="primary" data-testid="vorlage-neu" onClick={() => setAnlegen(true)}>
              {t("vorlagen.neu")}
            </Button>
          ) : null
        }
      />
      <Card className="mb-4">
        <SectionLabel>{t("vorlagen.standard.titel")}</SectionLabel>
        <p data-testid="vorlagen-mein-standard" className="text-[13px] text-text">
          {standard
            ? t("vorlagen.standard.ist", { name: standard.name })
            : d.standardId
              ? t("vorlagen.standard.nichtVerfuegbar")
              : t("vorlagen.standard.keiner")}
        </p>
        <p className="mt-1 text-[12px] text-muted-2">{t("vorlagen.vorrang.regel")}</p>
      </Card>
      {anlegen ? (
        <Card className="mb-4">
          <SectionLabel>{t("vorlagen.neu")}</SectionLabel>
          <VorlagenFormular daten={d} onFertig={() => setAnlegen(false)} />
        </Card>
      ) : null}
      <Card className="mb-4">
        <SectionLabel>{t("vorlagen.liste.titel")}</SectionLabel>
        <ul className="space-y-2" data-testid="vorlagen-alle">
          {d.vorlagen.map((v) => (
            <VorlagenKarte key={`${v.id}-${v.version}`} v={v} daten={d} />
          ))}
        </ul>
      </Card>
      <SpaceVorgaben daten={d} />
      {d.darf.verwalten ? <Verwaltung /> : null}
    </div>
  );
}
