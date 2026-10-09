// ADMIN-15 · Unternehmensprofil und interne Richtlinien verwalten (`/unternehmen`).
//
// Die Route trägt kein Rollentor; jede Tür dahinter fordert `users.manage` am Server
// (`services/app/src/routes/unternehmen-routes.ts`). Ohne das Recht zeigt die Seite einen
// verständlichen Hinweis mit Rückweg statt leerer Karten.
//
// PROFIL: Name, Logo (PNG/JPEG) und eine Akzentfarbe aus einer festen, kontrastgeprüften Auswahl.
// VOR dem Speichern steht die Vorschau des Kopfes, den `/richtlinien` zeigt — in voller Breite und
// in 390 px. Jede Speicherung ist eine neue Fassung; eine frühere Fassung lässt sich als Vorlage
// übernehmen und mit Grund erneut speichern, ohne dass eine alte Fassung verloren geht.
//
// RICHTLINIEN: Fassung, Gültigkeitsdatum, Verantwortlichkeit, Geltung und die verlangte Handlung.
// Vor dem Veröffentlichen zeigt die Wirkungsvorschau, wer erneut zur Kenntnis nehmen oder zustimmen
// muss; der Server veröffentlicht nur mit genau dieser bestätigten Wirkung. Das Protokoll ist
// lesend — es gibt keinen Weg, Handlungen zu löschen.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { type ChangeEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { useDirectory } from "../api/hooks";
import {
  type AkzentId,
  type Anforderung,
  type LogoTyp,
  type ProfilFassung,
  type ProfilVerwaltung,
  RICHTLINIEN_PFAD,
  type RichtlinieEingabe,
  type RichtlinieImUeberblick,
  type Wirkung,
  unternehmenApi,
} from "../api/unternehmen";
import { GuardedLink } from "../app/NavGuardContext";
import { ROLES, type Role } from "../app/navigation";
import { Button, Card, Field, PageHeader, SectionLabel, TextInput } from "../components/ui";
import { UnternehmensKopf } from "../components/unternehmen/UnternehmensKopf";
import { adminHref } from "../lib/adminSections";

const FOKUS =
  "outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const FEHLER_NACH_CODE: Record<string, string> = {
  NAME_UNGUELTIG: "unternehmen.fehler.name",
  AKZENT_UNBEKANNT: "unternehmen.fehler.akzent",
  LOGO_TYP: "unternehmen.fehler.logoTyp",
  LOGO_INHALT: "unternehmen.fehler.logoInhalt",
  LOGO_ZU_GROSS: "unternehmen.fehler.logoGross",
  LOGO_MASSE: "unternehmen.fehler.logoMasse",
  LOGO_FORMAT: "unternehmen.fehler.logoFormat",
  LOGO_UNGUELTIG: "unternehmen.fehler.logoInhalt",
  VERSION_VERALTET: "unternehmen.fehler.veraltet",
  GRUND_FEHLT: "unternehmen.fehler.grund",
  TITEL_UNGUELTIG: "unternehmen.fehler.titel",
  TEXT_UNGUELTIG: "unternehmen.fehler.text",
  VERANTWORTLICH_UNGUELTIG: "unternehmen.fehler.verantwortlich",
  GELTUNG_UNGUELTIG: "unternehmen.fehler.geltung",
  ANFORDERUNG_UNGUELTIG: "unternehmen.fehler.anforderung",
  WIRKUNG_NICHT_BESTAETIGT: "unternehmen.fehler.wirkung",
  NICHT_HALTBAR: "unternehmen.fehler.nichtHaltbar",
};

function fehlerSchluessel(fehler: unknown): string {
  if (fehler instanceof ApiError) {
    const nachCode = FEHLER_NACH_CODE[fehler.code];
    if (nachCode) {
      return nachCode;
    }
    if (fehler.status === 401) {
      return "unternehmen.fehler.anmeldung";
    }
    if (fehler.status === 403) {
      return "unternehmen.fehler.recht";
    }
  }
  if (fehler instanceof LogoFehler) {
    return fehler.schluessel;
  }
  return "unternehmen.fehler.allgemein";
}

function Fehlerzeile({ fehler, testId }: { fehler: unknown; testId: string }): JSX.Element {
  const { t } = useTranslation();
  const grenzen = fehler instanceof ApiError ? fehler.details : {};
  return (
    <p role="alert" data-testid={testId} className="text-[12.5px] text-trust-crit-text">
      {t(fehlerSchluessel(fehler), {
        maxKb: Math.round(Number(grenzen.maxBytes ?? 204800) / 1024),
        breite: grenzen.breite,
        hoehe: grenzen.hoehe,
      })}
    </p>
  );
}

// ------------------------------------------------------------------------------------------------
// PROFIL
// ------------------------------------------------------------------------------------------------

class LogoFehler extends Error {
  constructor(readonly schluessel: string) {
    super(schluessel);
  }
}

interface Profilformular {
  name: string;
  logo: { typ: LogoTyp; daten: string } | null;
  akzent: AkzentId;
  grund: string;
  uebernommenAus: number | null;
  /**
   * Die Fassung, auf der dieser Entwurf beruht — sie reist MIT dem Entwurf (BEN, Nacharbeit 5).
   * Eine Hintergrundaktualisierung der Abfrage ersetzt sie nicht: hat inzwischen jemand anders
   * gespeichert, sendet der Entwurf weiter seine alte Version, und der Server antwortet mit 409
   * statt die fremde Änderung still zu überschreiben.
   */
  basisVersion: number;
}

function formularAus(f: ProfilFassung | undefined): Profilformular {
  return {
    name: f?.name ?? "",
    logo: f?.logo ? { typ: f.logo.typ, daten: f.logo.daten } : null,
    akzent: f?.akzent ?? "neutral",
    grund: "",
    uebernommenAus: null,
    basisVersion: f?.version ?? 0,
  };
}

function liesLogo(datei: File, maxBytes: number): Promise<{ typ: LogoTyp; daten: string }> {
  if (datei.type !== "image/png" && datei.type !== "image/jpeg") {
    return Promise.reject(new LogoFehler("unternehmen.fehler.logoTyp"));
  }
  if (datei.size > maxBytes) {
    return Promise.reject(new LogoFehler("unternehmen.fehler.logoGross"));
  }
  const typ: LogoTyp = datei.type === "image/png" ? "image/png" : "image/jpeg";
  return new Promise((resolve, reject) => {
    const leser = new FileReader();
    leser.onerror = () => reject(new LogoFehler("unternehmen.fehler.logoInhalt"));
    leser.onload = () => {
      const url = String(leser.result ?? "");
      const daten = url.slice(url.indexOf(",") + 1);
      if (!daten) {
        reject(new LogoFehler("unternehmen.fehler.logoInhalt"));
        return;
      }
      resolve({ typ, daten });
    };
    leser.readAsDataURL(datei);
  });
}

function ProfilBereich({ verwaltung }: { verwaltung: ProfilVerwaltung }): JSX.Element {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const verzeichnis = useDirectory();
  const aktuell = verwaltung.fassungen[verwaltung.fassungen.length - 1];
  const [form, setForm] = useState<Profilformular>(() => formularAus(aktuell));
  const [logoFehler, setLogoFehler] = useState<unknown>(null);
  const akzent = verwaltung.akzente.find((a) => a.id === form.akzent) ?? verwaltung.akzente[0];
  const speichern = useMutation({
    mutationFn: () =>
      unternehmenApi.profilSpeichern({
        version: form.basisVersion,
        name: form.name,
        logo: form.logo,
        akzent: form.akzent,
        ...(form.grund.trim() ? { grund: form.grund } : {}),
        ...(form.uebernommenAus !== null ? { uebernommenAus: form.uebernommenAus } : {}),
      }),
    onSuccess: async (gespeichert) => {
      setForm(formularAus(gespeichert));
      await qc.invalidateQueries({ queryKey: ["unternehmensprofil"] });
    },
  });
  const geaendert =
    !aktuell ||
    form.name.trim() !== aktuell.name ||
    form.akzent !== aktuell.akzent ||
    (form.logo?.daten ?? null) !== (aktuell.logo?.daten ?? null) ||
    form.uebernommenAus !== null;

  const vorschau =
    form.name.trim() && akzent
      ? {
          name: form.name.trim(),
          logo: form.logo ? { ...form.logo, breite: 0, hoehe: 0 } : null,
          akzent: { id: akzent.id, flaeche: akzent.flaeche, schrift: akzent.schrift },
        }
      : null;

  const name = (id: string): string =>
    (verzeichnis.data ?? []).find((u) => u.id === id)?.name ?? id;

  const logoGewaehlt = (e: ChangeEvent<HTMLInputElement>): void => {
    const datei = e.target.files?.[0];
    e.target.value = "";
    if (!datei) {
      return;
    }
    setLogoFehler(null);
    liesLogo(datei, verwaltung.grenzen.logo.bytes).then(
      (logo) => setForm((alt) => ({ ...alt, logo })),
      (fehler: unknown) => setLogoFehler(fehler),
    );
  };

  return (
    <Card interactive={false} className="mb-6" data-testid="unternehmen-profil">
      <SectionLabel>{t("unternehmen.profil.titel")}</SectionLabel>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          speichern.mutate();
        }}
      >
        <Field label={t("unternehmen.profil.name")}>
          <TextInput
            data-testid="profil-name"
            value={form.name}
            maxLength={verwaltung.grenzen.name.max}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>

        <Field label={t("unternehmen.profil.logo")} gruppe>
          <p className="text-[12px] text-muted-2">
            {t("unternehmen.profil.logoHinweis", {
              maxKb: Math.round(verwaltung.grenzen.logo.bytes / 1024),
              min: verwaltung.grenzen.logo.minKante,
              verhaeltnis: verwaltung.grenzen.logo.maxSeitenverhaeltnis,
            })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="profil-logo"
              data-testid="profil-logo"
              type="file"
              accept="image/png,image/jpeg"
              aria-label={t("unternehmen.profil.logoWaehlen")}
              onChange={logoGewaehlt}
              className={`max-w-full text-[13px] ${FOKUS}`}
            />
            {form.logo ? (
              <Button
                data-testid="profil-logo-entfernen"
                onClick={() => setForm({ ...form, logo: null })}
              >
                {t("unternehmen.profil.logoEntfernen")}
              </Button>
            ) : null}
          </div>
          {logoFehler ? <Fehlerzeile fehler={logoFehler} testId="profil-logo-fehler" /> : null}
        </Field>

        <Field label={t("unternehmen.profil.akzent")} gruppe>
          <div className="grid gap-2 sm:grid-cols-2" data-testid="profil-akzente">
            {verwaltung.akzente.map((a) => (
              <label
                key={a.id}
                className="flex items-center gap-2 rounded-btn border border-hairline px-3 py-2 text-[13px] text-text"
              >
                <input
                  type="radio"
                  name="akzent"
                  value={a.id}
                  data-testid={`profil-akzent-${a.id}`}
                  checked={form.akzent === a.id}
                  onChange={() => setForm({ ...form, akzent: a.id })}
                  className={FOKUS}
                />
                <span
                  aria-hidden="true"
                  className="grid h-6 w-10 shrink-0 place-items-center rounded-[4px] border border-hairline text-[11px] font-semibold"
                  style={{ backgroundColor: a.flaeche, color: a.schrift }}
                >
                  Aa
                </span>
                <span className="min-w-0">
                  {t(`unternehmen.akzent.${a.id}`)}
                  <span className="block text-[11.5px] text-muted-2">
                    {t("unternehmen.profil.kontrast", {
                      wert: a.kontrast.toLocaleString(i18n.language),
                    })}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </Field>

        {form.uebernommenAus !== null ? (
          <Field label={t("unternehmen.profil.grund", { fassung: form.uebernommenAus })}>
            <TextInput
              data-testid="profil-grund"
              value={form.grund}
              onChange={(e) => setForm({ ...form, grund: e.target.value })}
            />
          </Field>
        ) : null}

        <section aria-labelledby="profil-vorschau-titel" data-testid="profil-vorschau">
          <h3 id="profil-vorschau-titel" className="mb-1 text-[13px] font-semibold text-ink">
            {t("unternehmen.vorschau.titel")}
          </h3>
          <p className="mb-2 text-[12px] text-muted-2">
            {t(
              geaendert ? "unternehmen.vorschau.ungespeichert" : "unternehmen.vorschau.gespeichert",
            )}
          </p>
          {vorschau ? (
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-[11.5px] text-muted-2">
                  {t("unternehmen.vorschau.desktop")}
                </p>
                <UnternehmensKopf profil={vorschau} testId="vorschau-desktop" />
              </div>
              <div>
                <p className="mb-1 text-[11.5px] text-muted-2">{t("unternehmen.vorschau.mobil")}</p>
                <div className="w-[390px] max-w-full">
                  <UnternehmensKopf profil={vorschau} testId="vorschau-mobil" />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[12.5px] text-muted">{t("unternehmen.vorschau.leer")}</p>
          )}
        </section>

        {speichern.isError ? <Fehlerzeile fehler={speichern.error} testId="profil-fehler" /> : null}
        {speichern.isSuccess ? (
          <output data-testid="profil-gespeichert" className="block text-[12.5px] text-text">
            {t("unternehmen.profil.gespeichert", { version: speichern.data.version })}
          </output>
        ) : null}
        <Button
          type="submit"
          variant="primary"
          data-testid="profil-speichern"
          disabled={speichern.isPending || !geaendert}
        >
          {t("unternehmen.profil.speichern")}
        </Button>
      </form>

      <details className="mt-5" data-testid="profil-verlauf">
        <summary className={`cursor-pointer text-[13px] font-semibold text-ink ${FOKUS}`}>
          {t("unternehmen.profil.verlauf", { anzahl: verwaltung.fassungen.length })}
        </summary>
        <ol className="mt-2 space-y-2">
          {[...verwaltung.fassungen].reverse().map((f) => (
            <li
              key={f.version}
              data-testid="profil-fassung"
              data-version={f.version}
              className="rounded-btn border border-hairline p-2 text-[12.5px]"
            >
              <p className="text-text">
                {t("unternehmen.profil.fassung", {
                  version: f.version,
                  zeit: new Date(f.geaendertAm).toLocaleString(i18n.language),
                  wer: name(f.geaendertVon),
                })}
              </p>
              <p className="text-muted-2">
                {f.name} · {t(`unternehmen.akzent.${f.akzent}`)} ·{" "}
                {f.logo ? t("unternehmen.profil.mitLogo") : t("unternehmen.profil.ohneLogo")}
              </p>
              {f.uebernommenAus !== null ? (
                <p className="text-muted-2">
                  {t("unternehmen.profil.korrektur", {
                    fassung: f.uebernommenAus,
                    grund: f.grund ?? "",
                  })}
                </p>
              ) : null}
              {f.version !== aktuell?.version ? (
                <Button
                  className="mt-1"
                  data-testid="profil-uebernehmen"
                  onClick={() =>
                    // Die Vorlage ist eine ALTE Fassung; der Entwurf beruht weiter auf derselben
                    // Ausgangsversion wie bisher.
                    setForm((alt) => ({
                      ...formularAus(f),
                      uebernommenAus: f.version,
                      grund: "",
                      basisVersion: alt.basisVersion,
                    }))
                  }
                >
                  {t("unternehmen.profil.uebernehmen", { version: f.version })}
                </Button>
              ) : null}
            </li>
          ))}
        </ol>
      </details>
    </Card>
  );
}

// ------------------------------------------------------------------------------------------------
// RICHTLINIEN
// ------------------------------------------------------------------------------------------------

const ANFORDERUNGEN: readonly Anforderung[] = ["anzeige", "kenntnisnahme", "zustimmung"];

interface RichtlinienWerte extends RichtlinieEingabe {
  aenderungsgrund: string;
}

function heute(): string {
  return new Date().toISOString().slice(0, 10);
}

function richtlinienformularAus(r: RichtlinieImUeberblick | null): RichtlinienWerte {
  const a = r?.aktuell;
  return {
    titel: a?.titel ?? "",
    text: a?.text ?? "",
    verantwortlich: a?.verantwortlich ?? "",
    gueltigAb: heute(),
    rollen: a?.rollen ?? [],
    anforderung: a?.anforderung ?? "kenntnisnahme",
    aenderungsgrund: "",
  };
}

function wirkungsText(t: TFunction, w: Wirkung, neueFassung: number): string {
  if (w.verlangt === "anzeige") {
    return t("unternehmen.wirkung.anzeige", { betroffen: w.betroffen });
  }
  if (!w.erneut) {
    return t(`unternehmen.wirkung.erstmals.${w.verlangt}`, { betroffen: w.betroffen });
  }
  return t(`unternehmen.wirkung.erneut.${w.verlangt}`, {
    betroffen: w.betroffen,
    fassung: neueFassung,
    bisher: w.bisherigeFassung,
    alt: w.bisherigeHandlungen,
  });
}

function Richtlinienformular({
  vorlage,
  onFertig,
}: {
  vorlage: RichtlinieImUeberblick | null;
  onFertig: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState<RichtlinienWerte>(() => richtlinienformularAus(vorlage));
  const [wirkung, setWirkung] = useState<{ w: Wirkung; schluessel: string } | null>(null);
  const schluessel = `${form.anforderung}|${[...form.rollen].sort().join(",")}`;
  const gueltigeWirkung = wirkung && wirkung.schluessel === schluessel ? wirkung.w : null;
  const neueFassung = (vorlage?.aktuell.fassung ?? 0) + 1;

  const pruefen = useMutation({
    mutationFn: () =>
      unternehmenApi.wirkung(vorlage?.aktuell.id ?? null, form.anforderung, form.rollen),
    onSuccess: (w) => setWirkung({ w, schluessel }),
  });
  const veroeffentlichen = useMutation({
    mutationFn: () => {
      if (!gueltigeWirkung) {
        throw new Error("Wirkung fehlt");
      }
      const { aenderungsgrund, ...eingabe } = form;
      return vorlage
        ? unternehmenApi.neueFassung(
            vorlage.aktuell.id,
            vorlage.aktuell.fassung,
            eingabe,
            aenderungsgrund,
            gueltigeWirkung,
          )
        : unternehmenApi.anlegen(eingabe, gueltigeWirkung);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["richtlinien"] });
      onFertig();
    },
    onError: (e) => {
      // Die Wirkung hat sich zwischen Vorschau und Veröffentlichung geändert: die frische Wirkung
      // steht in der Antwort und wird gezeigt — veröffentlicht wird erst nach erneuter Bestätigung.
      if (e instanceof ApiError && e.code === "WIRKUNG_NICHT_BESTAETIGT" && e.details.wirkung) {
        setWirkung({ w: e.details.wirkung as Wirkung, schluessel });
      }
    },
  });

  const rolleUmschalten = (rolle: Role): void =>
    setForm((alt) => ({
      ...alt,
      rollen: alt.rollen.includes(rolle)
        ? alt.rollen.filter((r) => r !== rolle)
        : [...alt.rollen, rolle],
    }));

  return (
    <form
      data-testid="richtlinie-formular"
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        veroeffentlichen.mutate();
      }}
    >
      <Field label={t("unternehmen.richtlinie.titelFeld")}>
        <TextInput
          data-testid="richtlinie-titel"
          value={form.titel}
          onChange={(e) => setForm({ ...form, titel: e.target.value })}
        />
      </Field>
      <Field label={t("unternehmen.richtlinie.text")}>
        <textarea
          data-testid="richtlinie-text"
          value={form.text}
          rows={6}
          onChange={(e) => setForm({ ...form, text: e.target.value })}
          className="w-full rounded-input border border-hairline bg-surface px-3 py-2 text-sm text-text outline-none focus:border-ink/30"
        />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t("unternehmen.richtlinie.verantwortlich")}>
          <TextInput
            data-testid="richtlinie-verantwortlich"
            value={form.verantwortlich}
            onChange={(e) => setForm({ ...form, verantwortlich: e.target.value })}
          />
        </Field>
        <Field label={t("unternehmen.richtlinie.gueltigAb")}>
          <TextInput
            type="date"
            data-testid="richtlinie-gueltig-ab"
            value={form.gueltigAb}
            onChange={(e) => setForm({ ...form, gueltigAb: e.target.value })}
          />
        </Field>
      </div>
      <Field label={t("unternehmen.richtlinie.geltung")} gruppe>
        <p className="text-[12px] text-muted-2">{t("unternehmen.richtlinie.geltungHinweis")}</p>
        <div className="flex flex-wrap gap-3">
          {ROLES.map((rolle) => (
            <label key={rolle} className="flex items-center gap-1.5 text-[13px] text-text">
              <input
                type="checkbox"
                data-testid={`richtlinie-rolle-${rolle}`}
                checked={form.rollen.includes(rolle)}
                onChange={() => rolleUmschalten(rolle)}
                className={FOKUS}
              />
              {t(`role.name.${rolle}`)}
            </label>
          ))}
        </div>
      </Field>
      <Field label={t("unternehmen.richtlinie.anforderung")} gruppe>
        <div className="space-y-1.5">
          {ANFORDERUNGEN.map((a) => (
            <label key={a} className="flex items-start gap-2 text-[13px] text-text">
              <input
                type="radio"
                name="anforderung"
                value={a}
                data-testid={`richtlinie-anforderung-${a}`}
                checked={form.anforderung === a}
                onChange={() => setForm({ ...form, anforderung: a })}
                className={`mt-0.5 ${FOKUS}`}
              />
              <span>
                {t(`unternehmen.anforderung.${a}`)}
                <span className="block text-[11.5px] text-muted-2">
                  {t(`unternehmen.anforderung.${a}Erklaerung`)}
                </span>
              </span>
            </label>
          ))}
        </div>
      </Field>
      {vorlage ? (
        <Field label={t("unternehmen.richtlinie.aenderungsgrund")}>
          <TextInput
            data-testid="richtlinie-grund"
            value={form.aenderungsgrund}
            onChange={(e) => setForm({ ...form, aenderungsgrund: e.target.value })}
          />
        </Field>
      ) : null}

      <div className="space-y-2 rounded-btn border border-hairline p-3">
        <Button
          data-testid="richtlinie-wirkung-pruefen"
          disabled={pruefen.isPending}
          onClick={() => pruefen.mutate()}
        >
          {t("unternehmen.wirkung.pruefen")}
        </Button>
        {pruefen.isError ? (
          <Fehlerzeile fehler={pruefen.error} testId="richtlinie-wirkung-fehler" />
        ) : null}
        {gueltigeWirkung ? (
          <output data-testid="richtlinie-wirkung" className="block text-[13px] text-text">
            {wirkungsText(t, gueltigeWirkung, neueFassung)}
          </output>
        ) : (
          <p className="text-[12px] text-muted-2">{t("unternehmen.wirkung.fehlt")}</p>
        )}
      </div>

      {veroeffentlichen.isError ? (
        <Fehlerzeile fehler={veroeffentlichen.error} testId="richtlinie-fehler" />
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="primary"
          data-testid="richtlinie-veroeffentlichen"
          disabled={!gueltigeWirkung || veroeffentlichen.isPending}
        >
          {t("unternehmen.richtlinie.veroeffentlichen", { fassung: neueFassung })}
        </Button>
        <Button onClick={onFertig}>{t("unternehmen.abbrechen")}</Button>
      </div>
    </form>
  );
}

function Protokoll({ id }: { id: string }): JSX.Element {
  const { t, i18n } = useTranslation();
  const protokoll = useQuery({
    queryKey: ["richtlinien", "protokoll", id],
    queryFn: () => unternehmenApi.protokoll(id),
  });
  if (protokoll.isPending) {
    return <p className="text-[12px] text-muted">{t("unternehmen.protokoll.laedt")}</p>;
  }
  if (protokoll.isError) {
    return <Fehlerzeile fehler={protokoll.error} testId="protokoll-fehler" />;
  }
  return (
    <div data-testid="richtlinie-protokoll" className="mt-2 space-y-2">
      <p className="text-[12px] text-muted-2">{t("unternehmen.protokoll.hinweis")}</p>
      {protokoll.data.eintraege.length === 0 ? (
        <p className="text-[12.5px] text-muted">{t("unternehmen.protokoll.leer")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="text-muted-2">
                <th scope="col" className="py-1 pr-3 font-medium">
                  {t("unternehmen.protokoll.person")}
                </th>
                <th scope="col" className="py-1 pr-3 font-medium">
                  {t("unternehmen.protokoll.fassung")}
                </th>
                <th scope="col" className="py-1 pr-3 font-medium">
                  {t("unternehmen.protokoll.handlung")}
                </th>
                <th scope="col" className="py-1 font-medium">
                  {t("unternehmen.protokoll.zeit")}
                </th>
              </tr>
            </thead>
            <tbody>
              {protokoll.data.eintraege.map((e) => (
                <tr
                  key={`${e.personId}-${e.fassung}-${e.handlung}`}
                  data-testid="protokoll-eintrag"
                  data-fassung={e.fassung}
                  data-handlung={e.handlung}
                  className="border-t border-hairline"
                >
                  <td className="py-1 pr-3">{e.personName}</td>
                  <td className="py-1 pr-3">{e.fassung}</td>
                  <td className="py-1 pr-3">{t(`unternehmen.art.${e.handlung}`)}</td>
                  <td className="py-1">{new Date(e.am).toLocaleString(i18n.language)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function geltungText(t: TFunction, rollen: Role[]): string {
  return rollen.length === 0
    ? t("unternehmen.richtlinie.alle")
    : rollen.map((r) => t(`role.name.${r}`)).join(", ");
}

function RichtlinienBereich(): JSX.Element {
  const { t, i18n } = useTranslation();
  const liste = useQuery({
    queryKey: ["richtlinien", "verwaltung"],
    queryFn: unternehmenApi.richtlinien,
  });
  const [bearbeitet, setBearbeitet] = useState<RichtlinieImUeberblick | "neu" | null>(null);
  const [protokollOffen, setProtokollOffen] = useState<string | null>(null);

  return (
    <Card interactive={false} data-testid="unternehmen-richtlinien">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <SectionLabel>{t("unternehmen.richtlinien.verwaltungTitel")}</SectionLabel>
        {bearbeitet === null ? (
          <Button
            variant="primary"
            data-testid="richtlinie-neu"
            onClick={() => setBearbeitet("neu")}
          >
            {t("unternehmen.richtlinie.neu")}
          </Button>
        ) : null}
      </div>
      <p className="mb-3 text-[12px] text-muted-2">
        {t("unternehmen.richtlinien.trennung")}{" "}
        <GuardedLink to={RICHTLINIEN_PFAD} className="underline" data-testid="richtlinien-ansicht">
          {t("unternehmen.richtlinien.ansicht")}
        </GuardedLink>
      </p>
      {bearbeitet !== null ? (
        <div
          className="mb-4 rounded-btn border border-hairline p-3"
          data-testid="richtlinie-pflege"
        >
          <h3 className="mb-2 text-[13px] font-semibold text-ink">
            {bearbeitet === "neu"
              ? t("unternehmen.richtlinie.neu")
              : t("unternehmen.richtlinie.neueFassungVon", { titel: bearbeitet.aktuell.titel })}
          </h3>
          <Richtlinienformular
            key={
              bearbeitet === "neu"
                ? "neu"
                : `${bearbeitet.aktuell.id}-${bearbeitet.aktuell.fassung}`
            }
            vorlage={bearbeitet === "neu" ? null : bearbeitet}
            onFertig={() => setBearbeitet(null)}
          />
        </div>
      ) : null}
      {liste.isPending ? (
        <p className="text-[12.5px] text-muted">{t("unternehmen.richtlinien.laedt")}</p>
      ) : null}
      {liste.isError ? <Fehlerzeile fehler={liste.error} testId="richtlinien-fehler" /> : null}
      {liste.isSuccess && liste.data.richtlinien.length === 0 ? (
        <p className="text-[12.5px] text-muted">{t("unternehmen.richtlinien.verwaltungLeer")}</p>
      ) : null}
      <ul className="space-y-3">
        {(liste.data?.richtlinien ?? []).map((r) => (
          <li
            key={r.aktuell.id}
            data-testid="verwaltung-richtlinie"
            data-richtlinie={r.aktuell.id}
            className="rounded-btn border border-hairline p-3"
          >
            <p className="text-[14px] font-semibold text-ink">{r.aktuell.titel}</p>
            <p className="text-[12px] text-muted-2" data-testid="verwaltung-richtlinie-meta">
              {t("unternehmen.richtlinie.metaVerwaltung", {
                fassung: r.aktuell.fassung,
                datum: new Date(`${r.aktuell.gueltigAb}T00:00:00`).toLocaleDateString(
                  i18n.language,
                ),
                verantwortlich: r.aktuell.verantwortlich,
                geltung: geltungText(t, r.aktuell.rollen),
                anforderung: t(`unternehmen.anforderung.${r.aktuell.anforderung}`),
              })}
            </p>
            <p className="text-[12px] text-text" data-testid="verwaltung-richtlinie-stand">
              {r.aktuell.anforderung === "anzeige"
                ? t("unternehmen.richtlinie.standAnzeige", { betroffen: r.stand.betroffen })
                : t(`unternehmen.richtlinie.stand.${r.aktuell.anforderung}`, {
                    erledigt: r.stand.erledigt,
                    betroffen: r.stand.betroffen,
                    fassung: r.aktuell.fassung,
                  })}
            </p>
            {r.aktuell.aenderungsgrund ? (
              <p className="text-[12px] text-muted-2">
                {t("unternehmen.richtlinie.grundAnzeige", { grund: r.aktuell.aenderungsgrund })}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                data-testid="richtlinie-neue-fassung"
                onClick={() => setBearbeitet(r)}
                disabled={bearbeitet !== null}
              >
                {t("unternehmen.richtlinie.neueFassung")}
              </Button>
              <Button
                data-testid="richtlinie-protokoll-knopf"
                aria-expanded={protokollOffen === r.aktuell.id}
                onClick={() =>
                  setProtokollOffen(protokollOffen === r.aktuell.id ? null : r.aktuell.id)
                }
              >
                {t("unternehmen.protokoll.titel")}
              </Button>
            </div>
            <details className="mt-2">
              <summary className={`cursor-pointer text-[12.5px] text-muted ${FOKUS}`}>
                {t("unternehmen.richtlinie.fassungen", { anzahl: r.fassungen.length })}
              </summary>
              <ol className="mt-1 space-y-1 text-[12px] text-muted-2">
                {[...r.fassungen].reverse().map((f) => (
                  <li key={f.fassung} data-testid="verwaltung-fassung" data-fassung={f.fassung}>
                    {t("unternehmen.richtlinie.fassungZeile", {
                      fassung: f.fassung,
                      zeit: new Date(f.veroeffentlichtAm).toLocaleString(i18n.language),
                      verantwortlich: f.verantwortlich,
                      anforderung: t(`unternehmen.anforderung.${f.anforderung}`),
                    })}
                  </li>
                ))}
              </ol>
            </details>
            {protokollOffen === r.aktuell.id ? <Protokoll id={r.aktuell.id} /> : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ------------------------------------------------------------------------------------------------
// DIE SEITE
// ------------------------------------------------------------------------------------------------

export function Unternehmen(): JSX.Element {
  const { t } = useTranslation();
  const verwaltung = useQuery({
    queryKey: ["unternehmensprofil", "verwaltung"],
    queryFn: unternehmenApi.profilVerwaltung,
  });
  const ohneRecht = verwaltung.error instanceof ApiError && verwaltung.error.status === 403;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        pageKey="unternehmen"
        title={t("unternehmen.seite.titel")}
        lead={t("unternehmen.seite.lead")}
      />
      <p className="mb-4 text-[12.5px]">
        <GuardedLink
          to={adminHref("system")}
          className="underline"
          data-testid="unternehmen-zurueck"
        >
          {t("unternehmen.seite.zurueck")}
        </GuardedLink>
      </p>
      {verwaltung.isPending ? (
        <p className="text-sm text-muted">{t("unternehmen.seite.laedt")}</p>
      ) : null}
      {ohneRecht ? (
        <p role="alert" data-testid="unternehmen-ohne-recht" className="text-sm text-text">
          {t("unternehmen.fehler.recht")}
        </p>
      ) : null}
      {verwaltung.isError && !ohneRecht ? (
        <Fehlerzeile fehler={verwaltung.error} testId="unternehmen-fehler" />
      ) : null}
      {verwaltung.isSuccess ? (
        <>
          <ProfilBereich verwaltung={verwaltung.data} />
          <RichtlinienBereich />
        </>
      ) : null}
    </div>
  );
}
