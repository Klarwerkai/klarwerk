// Firmenwörterbuch — Nachschlagen für jede lesende Rolle, Pflege für die berechtigten Rollen.
//
// Erreichbar unter `/begriffe` und aus jedem Begriffshinweis im Editor (`Begriffshinweise.tsx`,
// mit `?begriff=<id>&fassung=<n>`: der Eintrag öffnet sich mit genau der Fassung, aus der der
// Hinweis stammt). Die Route trägt kein Rollentor; die Rechte entscheidet der Server
// (`ko.read` zum Lesen, `ko.validate` zum Pflegen) — dieselbe Bauform wie `/wissen/:id`.
//
// Jede Änderung ist eine neue Fassung; frühere Fassungen bleiben vollständig lesbar. Bestehende
// Wissensobjekte werden durch eine Änderung hier nicht angefasst.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  type BegriffEingabe,
  type BegriffFassung,
  type BegriffSprache,
  begriffeApi,
} from "../api/begriffe";
import { ApiError } from "../api/client";
import { useDirectory } from "../api/hooks";
import { useRole } from "../app/RoleContext";
import { ROLE_RANK } from "../app/navigation";
import { Button, Card, Field, PageHeader, SectionLabel, TextInput } from "../components/ui";
import { formatKoTimestamp } from "../lib/koDates";

const SPRACHEN: readonly BegriffSprache[] = ["de", "en"];

interface Sprachformular {
  vorzug: string;
  synonyme: string;
  unerwuenscht: string;
  definition: string;
}

interface Formular {
  geltungsbereich: string;
  verantwortlich: string;
  de: Sprachformular;
  en: Sprachformular;
}

const LEER: Sprachformular = { vorzug: "", synonyme: "", unerwuenscht: "", definition: "" };

function liste(text: string): string[] {
  return text
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

function formularAus(f: BegriffFassung | null): Formular {
  const sprache = (s: BegriffSprache): Sprachformular => {
    const b = f?.bezeichnungen[s];
    return b
      ? {
          vorzug: b.vorzug,
          synonyme: b.synonyme.join(", "),
          unerwuenscht: b.unerwuenscht.join(", "),
          definition: f?.definition[s] ?? "",
        }
      : { ...LEER };
  };
  return {
    geltungsbereich: f?.geltungsbereich ?? "",
    verantwortlich: f?.verantwortlich ?? "",
    de: sprache("de"),
    en: sprache("en"),
  };
}

function eingabeAus(form: Formular): BegriffEingabe {
  const eingabe: BegriffEingabe = {
    geltungsbereich: form.geltungsbereich,
    verantwortlich: form.verantwortlich,
    definition: {},
    bezeichnungen: {},
  };
  for (const s of SPRACHEN) {
    const f = form[s];
    if (f.vorzug.trim()) {
      eingabe.bezeichnungen[s] = {
        vorzug: f.vorzug,
        synonyme: liste(f.synonyme),
        unerwuenscht: liste(f.unerwuenscht),
      };
      if (f.definition.trim()) {
        eingabe.definition[s] = f.definition;
      }
    }
  }
  return eingabe;
}

function fehlerSchluessel(fehler: unknown): string {
  if (!(fehler instanceof ApiError)) {
    return "begriffe.fehler.allgemein";
  }
  const nachCode: Record<string, string> = {
    BEGRIFF_DOPPELT: "begriffe.fehler.doppelt",
    VERSION_VERALTET: "begriffe.fehler.veraltet",
    BEGRIFF_WIDERSPRUECHLICH: "begriffe.fehler.widerspruch",
    BEGRIFF_UNGUELTIG: "begriffe.fehler.ungueltig",
  };
  const nachStatus: Record<number, string> = {
    401: "begriffe.fehler.anmeldung",
    403: "begriffe.fehler.recht",
  };
  return nachCode[fehler.code] ?? nachStatus[fehler.status] ?? "begriffe.fehler.allgemein";
}

function Zeile({ label, werte }: { label: string; werte: string[] }): JSX.Element | null {
  if (werte.length === 0) {
    return null;
  }
  return (
    <p className="text-[12.5px] text-muted">
      <span className="font-medium text-text">{label}:</span> {werte.join(", ")}
    </p>
  );
}

function Fassungsinhalt({ f }: { f: BegriffFassung }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      {SPRACHEN.map((s) => {
        const b = f.bezeichnungen[s];
        if (!b) {
          return null;
        }
        const definition = f.definition[s];
        return (
          <div key={s} data-testid={`begriff-sprache-${s}`} className="space-y-0.5">
            <p className="text-[14px] font-semibold text-ink">
              <span data-testid="begriff-vorzug">{b.vorzug}</span>{" "}
              <span className="font-mono text-micro uppercase text-muted-2">{s}</span>
            </p>
            {definition ? <p className="text-[12.5px] text-text">{definition}</p> : null}
            <Zeile label={t("begriffe.feld.synonyme")} werte={b.synonyme} />
            <Zeile label={t("begriffe.feld.unerwuenscht")} werte={b.unerwuenscht} />
          </div>
        );
      })}
      <p className="text-[12px] text-muted-2">
        {t("begriffe.eintrag.meta", {
          bereich: f.geltungsbereich,
          verantwortlich: f.verantwortlich,
          version: f.version,
        })}
      </p>
    </div>
  );
}

function rahmen(hervorgehoben: boolean): string {
  return hervorgehoben ? "border-ink/40 bg-page" : "border-hairline";
}

function Fassungsverlauf({
  id,
  hervorgehoben,
}: {
  id: string;
  hervorgehoben: number | null;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const verzeichnis = useDirectory();
  const eintrag = useQuery({ queryKey: ["begriff", id], queryFn: () => begriffeApi.eintrag(id) });
  if (eintrag.isPending) {
    return <p className="text-[12px] text-muted">{t("begriffe.verlauf.laedt")}</p>;
  }
  if (eintrag.isError) {
    return <p className="text-[12px] text-muted">{t("begriffe.verlauf.fehler")}</p>;
  }
  const name = (nutzer: string): string =>
    (verzeichnis.data ?? []).find((u) => u.id === nutzer)?.name ?? nutzer;
  return (
    <ol data-testid="begriff-verlauf" className="mt-2 space-y-2 border-t border-hairline pt-2">
      {[...eintrag.data.fassungen].reverse().map((f) => (
        <li
          key={f.version}
          data-testid="begriff-fassung"
          data-version={f.version}
          className={`rounded-btn border p-2 ${rahmen(f.version === hervorgehoben)}`}
        >
          <p className="mb-1 text-[11.5px] text-muted-2">
            {t("begriffe.verlauf.fassung", {
              version: f.version,
              zeit: formatKoTimestamp(f.geaendertAm, i18n.language) ?? "—",
              wer: name(f.geaendertVon),
            })}
          </p>
          <Fassungsinhalt f={f} />
        </li>
      ))}
    </ol>
  );
}

function Pflegeformular({
  vorlage,
  onFertig,
}: {
  vorlage: BegriffFassung | null;
  onFertig: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState<Formular>(() => formularAus(vorlage));
  const speichern = useMutation({
    mutationFn: () =>
      vorlage
        ? begriffeApi.aendern(vorlage.id, vorlage.version, eingabeAus(form))
        : begriffeApi.anlegen(eingabeAus(form)),
    onSuccess: async (fassung) => {
      await qc.invalidateQueries({ queryKey: ["begriffe"] });
      await qc.invalidateQueries({ queryKey: ["begriff", fassung.id] });
      onFertig();
    },
  });
  const sprachfeld = (s: BegriffSprache, feld: keyof Sprachformular, wert: string): void =>
    setForm((alt) => ({ ...alt, [s]: { ...alt[s], [feld]: wert } }));

  return (
    <form
      data-testid="begriff-formular"
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        speichern.mutate();
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t("begriffe.feld.geltungsbereich")}>
          <TextInput
            data-testid="begriff-geltungsbereich"
            value={form.geltungsbereich}
            onChange={(e) => setForm({ ...form, geltungsbereich: e.target.value })}
          />
        </Field>
        <Field label={t("begriffe.feld.verantwortlich")}>
          <TextInput
            data-testid="begriff-verantwortlich"
            value={form.verantwortlich}
            onChange={(e) => setForm({ ...form, verantwortlich: e.target.value })}
          />
        </Field>
      </div>
      {SPRACHEN.map((s) => (
        <fieldset key={s} className="space-y-2 rounded-btn border border-hairline p-3">
          <legend className="px-1 text-[12.5px] font-semibold text-ink">
            {t(`begriffe.sprache.${s}`)}
          </legend>
          <Field label={t("begriffe.feld.vorzug")}>
            <TextInput
              data-testid={`begriff-${s}-vorzug`}
              value={form[s].vorzug}
              onChange={(e) => sprachfeld(s, "vorzug", e.target.value)}
            />
          </Field>
          <Field label={t("begriffe.feld.definition")}>
            <textarea
              data-testid={`begriff-${s}-definition`}
              value={form[s].definition}
              onChange={(e) => sprachfeld(s, "definition", e.target.value)}
              rows={2}
              className="w-full rounded-input border border-hairline bg-surface px-3 py-2 text-sm text-text outline-none focus:border-ink/30"
            />
          </Field>
          <Field label={t("begriffe.feld.synonymeEingabe")}>
            <TextInput
              data-testid={`begriff-${s}-synonyme`}
              value={form[s].synonyme}
              onChange={(e) => sprachfeld(s, "synonyme", e.target.value)}
            />
          </Field>
          <Field label={t("begriffe.feld.unerwuenschtEingabe")}>
            <TextInput
              data-testid={`begriff-${s}-unerwuenscht`}
              value={form[s].unerwuenscht}
              onChange={(e) => sprachfeld(s, "unerwuenscht", e.target.value)}
            />
          </Field>
        </fieldset>
      ))}
      <p className="text-[12px] text-muted-2">{t("begriffe.formular.hinweis")}</p>
      {speichern.isError ? (
        <p role="alert" data-testid="begriff-fehler" className="text-[12.5px] text-trust-crit-text">
          {t(fehlerSchluessel(speichern.error))}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="primary"
          data-testid="begriff-speichern"
          disabled={speichern.isPending}
        >
          {t("begriffe.formular.speichern")}
        </Button>
        <Button onClick={onFertig}>{t("begriffe.formular.abbrechen")}</Button>
      </div>
    </form>
  );
}

export function Firmenwoerterbuch(): JSX.Element {
  const { t } = useTranslation();
  const { role } = useRole();
  const darfPflegen = ROLE_RANK[role] >= ROLE_RANK.controller;
  const [suche, setSuche] = useState("");
  const [parameter] = useSearchParams();
  const zielId = parameter.get("begriff");
  const zielFassung = Number(parameter.get("fassung")) || null;
  const [offen, setOffen] = useState<string | null>(zielId);
  const [bearbeitet, setBearbeitet] = useState<BegriffFassung | "neu" | null>(null);
  const katalog = useQuery({ queryKey: ["begriffe"], queryFn: begriffeApi.liste });

  const treffer = (katalog.data?.begriffe ?? []).filter((b) => {
    const q = suche.trim().toLocaleLowerCase();
    if (!q) {
      return true;
    }
    const worte = [
      b.geltungsbereich,
      ...SPRACHEN.flatMap((s) => {
        const x = b.bezeichnungen[s];
        return x ? [x.vorzug, ...x.synonyme, ...x.unerwuenscht] : [];
      }),
    ];
    return worte.some((w) => w.toLocaleLowerCase().includes(q));
  });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        pageKey="begriffe"
        title={t("begriffe.seite.titel")}
        lead={t("begriffe.seite.lead")}
        actions={
          darfPflegen && bearbeitet === null ? (
            <Button
              variant="primary"
              data-testid="begriff-neu"
              onClick={() => setBearbeitet("neu")}
            >
              {t("begriffe.seite.neu")}
            </Button>
          ) : null
        }
      />
      <p className="mb-4 text-[12px] text-muted-2">{t("begriffe.seite.grenze")}</p>
      {bearbeitet !== null ? (
        <Card className="mb-4" data-testid="begriff-pflege">
          <SectionLabel>
            {bearbeitet === "neu" ? t("begriffe.seite.neu") : t("begriffe.seite.bearbeiten")}
          </SectionLabel>
          <Pflegeformular
            key={bearbeitet === "neu" ? "neu" : `${bearbeitet.id}-${bearbeitet.version}`}
            vorlage={bearbeitet === "neu" ? null : bearbeitet}
            onFertig={() => setBearbeitet(null)}
          />
        </Card>
      ) : null}
      <div className="mb-3">
        <TextInput
          data-testid="begriffe-suche"
          aria-label={t("begriffe.seite.suche")}
          placeholder={t("begriffe.seite.suche")}
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
        />
      </div>
      {katalog.isPending ? (
        <p className="text-sm text-muted" data-testid="begriffe-laedt">
          {t("begriffe.seite.laedt")}
        </p>
      ) : null}
      {katalog.isError ? (
        <p role="alert" className="text-sm text-muted">
          {t(fehlerSchluessel(katalog.error))}
        </p>
      ) : null}
      {katalog.isSuccess && katalog.data.begriffe.length === 0 ? (
        <p data-testid="begriffe-leer" className="text-sm text-muted">
          {t(darfPflegen ? "begriffe.seite.leerPflege" : "begriffe.seite.leer")}
        </p>
      ) : null}
      <ul className="space-y-3">
        {treffer.map((b) => (
          <li key={b.id}>
            <Card interactive={false} data-testid="begriff-eintrag" data-begriff={b.id}>
              <Fassungsinhalt f={b} />
              <div className="mt-2 flex gap-2">
                <Button
                  data-testid="begriff-verlauf-knopf"
                  aria-expanded={offen === b.id}
                  onClick={() => setOffen(offen === b.id ? null : b.id)}
                >
                  {t("begriffe.seite.verlauf")}
                </Button>
                {darfPflegen ? (
                  <Button data-testid="begriff-bearbeiten" onClick={() => setBearbeitet(b)}>
                    {t("begriffe.seite.bearbeiten")}
                  </Button>
                ) : null}
              </div>
              {offen === b.id ? (
                <Fassungsverlauf id={b.id} hervorgehoben={b.id === zielId ? zielFassung : null} />
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
