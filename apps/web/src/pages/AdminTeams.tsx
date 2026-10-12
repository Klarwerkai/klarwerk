// ================================================================================================
// ADMIN-06 · TEAMS — Verwaltung › Benutzer und Rollen › Teams (produkt:20261009:admin-teams).
// ================================================================================================
//
// Zwei Karten: die Teamliste mit dem Anlegen (`detail=teams`) und die Teamkarte (`detail=team:<id>`)
// mit Bearbeiten, Mitgliedern, Archivieren und Verlauf. Jede Mitgliederänderung und das Archivieren
// zeigen ZUERST die Wirkung je Person und gebundenem Space — Recht vorher/nachher und alle Wege, die
// danach bleiben (zuständig, direkt, andere Teams, offen) — und gehen erst mit deren `grundlage` an
// den Server. Ändert sich die Lage dazwischen, kommt die neue Wirkung zurück und wird gezeigt.
//
// Rechte entscheidet der Server (`users.manage`); diese Seite ist ohnehin nur in der Verwaltung.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import { spacesApi } from "../api/spaces";
import {
  type TeamEingabe,
  type TeamSicht,
  type TeamWirkung,
  teamFehlerSchluessel,
  teamsApi,
} from "../api/teams";
import { Detailkarte } from "../components/einstellungen/Detailkarte";
import { Button, Field, SectionLabel, TextInput } from "../components/ui";

const FELD =
  "w-full rounded-input border border-hairline bg-surface px-3 py-2 text-sm text-text outline-none focus:border-ink/30";

function Fehlerzeile({ fehler, testId }: { fehler: unknown; testId: string }): JSX.Element {
  const { t } = useTranslation();
  return (
    <p role="alert" data-testid={testId} className="text-[12.5px] text-trust-crit-text">
      {t(teamFehlerSchluessel(fehler))}
    </p>
  );
}

function useKonten() {
  return useQuery({ queryKey: ["spaces", "konten"], queryFn: spacesApi.konten });
}

// ------------------------------------------------------------------------------------------------
// DIE TEAMLISTE UND DAS ANLEGEN
// ------------------------------------------------------------------------------------------------

function TeamZeile({ team, onOeffnen }: { team: TeamSicht; onOeffnen: () => void }) {
  const { t } = useTranslation();
  return (
    <li>
      <button
        type="button"
        data-testid="team-zeile"
        data-team={team.id}
        onClick={onOeffnen}
        className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-btn border border-hairline px-3 py-2 text-left hover:border-ink/30"
      >
        <span className="min-w-0 break-words text-[13.5px] font-semibold text-ink">
          {team.name}
        </span>
        <span className="min-w-0 break-words text-[12px] text-muted-2">
          {[
            t("teams.liste.mitglieder", { anzahl: team.mitglieder.length }),
            t("teams.liste.spaces", { anzahl: team.spaces.length }),
            team.archiviert ? t("teams.status.archiviert") : null,
          ]
            .filter((x): x is string => x !== null)
            .join(" · ")}
        </span>
      </button>
    </li>
  );
}

function TeamAnlegen({ onAngelegt }: { onAngelegt: (id: string) => void }): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const konten = useKonten();
  const [form, setForm] = useState<TeamEingabe>({
    name: "",
    zweck: "",
    verantwortlich: "",
    mitglieder: [],
  });
  const anlegen = useMutation({
    mutationFn: () => teamsApi.anlegen(form),
    onSuccess: async (team) => {
      await qc.invalidateQueries({ queryKey: ["teams"] });
      onAngelegt(team.id);
    },
  });
  const liste = konten.data?.konten ?? [];
  return (
    <form
      data-testid="team-anlegen"
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        anlegen.mutate();
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t("teams.feld.name")}>
          <TextInput
            data-testid="team-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label={t("teams.feld.verantwortlich")}>
          <select
            data-testid="team-verantwortlich"
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
      <Field label={t("teams.feld.zweck")}>
        <textarea
          data-testid="team-zweck"
          rows={2}
          className={FELD}
          value={form.zweck}
          onChange={(e) => setForm({ ...form, zweck: e.target.value })}
        />
      </Field>
      <fieldset className="space-y-1 rounded-btn border border-hairline p-3">
        <legend className="px-1 text-[12.5px] font-semibold text-ink">
          {t("teams.feld.mitglieder")}
        </legend>
        {liste.map((k) => (
          <label key={k.id} className="flex items-center gap-2 text-[13px] text-text">
            <input
              type="checkbox"
              data-testid="team-anlegen-mitglied"
              data-konto={k.id}
              className="accent-brand"
              checked={form.mitglieder.includes(k.id)}
              onChange={(e) =>
                setForm({
                  ...form,
                  mitglieder: e.target.checked
                    ? [...form.mitglieder, k.id]
                    : form.mitglieder.filter((m) => m !== k.id),
                })
              }
            />
            <span className="min-w-0 break-words">
              {k.name} · {t(`role.name.${k.role}`)}
            </span>
          </label>
        ))}
      </fieldset>
      <p className="text-[12px] text-muted-2">{t("teams.anlegen.hinweis")}</p>
      {anlegen.isError ? <Fehlerzeile fehler={anlegen.error} testId="team-fehler" /> : null}
      <Button
        type="submit"
        variant="primary"
        data-testid="team-anlegen-speichern"
        disabled={anlegen.isPending}
      >
        {t("teams.anlegen.speichern")}
      </Button>
    </form>
  );
}

export function TeamsDetail({
  onZurueck,
  onOeffnen,
}: {
  onZurueck: () => void;
  onOeffnen: (id: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const teams = useQuery({ queryKey: ["teams"], queryFn: teamsApi.liste });
  const [neu, setNeu] = useState(false);
  const aktiv = (teams.data?.teams ?? []).filter((x) => !x.archiviert);
  const archiv = (teams.data?.teams ?? []).filter((x) => x.archiviert);
  return (
    <Detailkarte
      titel={t("teams.titel")}
      onZurueck={onZurueck}
      testId="detail-teams"
      hilfe={[{ titel: t("teams.wege.titel"), text: t("teams.wege.text") }]}
    >
      <div className="space-y-4">
        <p className="text-[12.5px] text-muted">{t("teams.wege.kurz")}</p>
        {teams.isPending ? <p className="text-sm text-muted">{t("teams.laedt")}</p> : null}
        {teams.isError ? (
          <div className="space-y-2">
            <Fehlerzeile fehler={teams.error} testId="teams-fehler" />
            <Button onClick={() => void teams.refetch()}>{t("teams.erneut")}</Button>
          </div>
        ) : null}
        {teams.isSuccess && teams.data.teams.length === 0 ? (
          <p data-testid="teams-leer" className="text-sm text-muted">
            {t("teams.leer")}
          </p>
        ) : null}
        {aktiv.length > 0 ? (
          <section aria-labelledby="teams-aktiv">
            <SectionLabel>
              <span id="teams-aktiv">{t("teams.liste.aktiv")}</span>
            </SectionLabel>
            <ul className="space-y-2" data-testid="teams-aktiv">
              {aktiv.map((team) => (
                <TeamZeile key={team.id} team={team} onOeffnen={() => onOeffnen(team.id)} />
              ))}
            </ul>
          </section>
        ) : null}
        {archiv.length > 0 ? (
          <section aria-labelledby="teams-archiv">
            <SectionLabel>
              <span id="teams-archiv">{t("teams.liste.archiv")}</span>
            </SectionLabel>
            <ul className="space-y-2" data-testid="teams-archiv">
              {archiv.map((team) => (
                <TeamZeile key={team.id} team={team} onOeffnen={() => onOeffnen(team.id)} />
              ))}
            </ul>
          </section>
        ) : null}
        {neu ? (
          <div className="space-y-2 border-t border-hairline pt-4">
            <SectionLabel>{t("teams.anlegen.titel")}</SectionLabel>
            <TeamAnlegen onAngelegt={onOeffnen} />
            <Button onClick={() => setNeu(false)}>{t("teams.abbrechen")}</Button>
          </div>
        ) : (
          <Button variant="primary" data-testid="team-neu" onClick={() => setNeu(true)}>
            {t("teams.anlegen.titel")}
          </Button>
        )}
      </div>
    </Detailkarte>
  );
}

// ------------------------------------------------------------------------------------------------
// DIE WIRKUNG — vor jeder Bestätigung
// ------------------------------------------------------------------------------------------------

function WirkungAnzeige({
  wirkung,
  art,
  onBestaetigen,
  onAbbrechen,
  laeuft,
  fehler,
}: {
  wirkung: TeamWirkung;
  art: "mitglieder" | "archiv";
  onBestaetigen: () => void;
  onAbbrechen: () => void;
  laeuft: boolean;
  fehler: unknown;
}): JSX.Element {
  const { t } = useTranslation();
  const kopf = useRef<HTMLHeadingElement | null>(null);
  // Die Vorschau bekommt den Fokus: wer per Tastatur „Entfernen" gewählt hat, liest als Nächstes
  // die Wirkung — nicht den Knopf, den er gerade gedrückt hat.
  useEffect(() => {
    kopf.current?.focus();
  }, []);
  return (
    <section
      data-testid="team-wirkung"
      data-grundlage={wirkung.grundlage}
      aria-labelledby="team-wirkung-titel"
      className="space-y-3 rounded-btn border border-hairline bg-hairline-soft p-3"
    >
      <h3
        id="team-wirkung-titel"
        ref={kopf}
        tabIndex={-1}
        className="text-[13.5px] font-semibold text-ink outline-none"
      >
        {art === "archiv" ? t("teams.wirkung.titelArchiv") : t("teams.wirkung.titel")}
      </h3>
      {wirkung.spaces.length === 0 ? (
        <p data-testid="team-wirkung-ohne-space" className="text-[12.5px] text-muted">
          {t("teams.wirkung.keinSpace")}
        </p>
      ) : (
        <ul className="space-y-1" data-testid="team-wirkung-spaces">
          {wirkung.spaces.map((s) => (
            <li key={s.id} className="text-[12.5px] text-text">
              {t("teams.wirkung.space", {
                name: s.name,
                recht: t(`spaces.recht.${s.recht}`),
                anzahl: s.verlieren,
              })}
            </li>
          ))}
        </ul>
      )}
      <ul className="space-y-2">
        {wirkung.personen.map((p) => (
          <li
            key={p.nutzer}
            data-testid="team-wirkung-person"
            data-konto={p.nutzer}
            className="rounded-btn border border-hairline bg-surface p-2"
          >
            <p className="break-words text-[13px] font-semibold text-ink">
              {t(`teams.wirkung.aenderung.${p.aenderung}`, { name: p.name })}
            </p>
            <p data-testid="team-wirkung-rolle" className="text-[12px] text-muted-2">
              {t("teams.wirkung.rolle", { rolle: t(`role.name.${p.role}`) })}
            </p>
            <ul className="mt-1 space-y-1">
              {p.spaces.map((s) => (
                <li
                  key={s.spaceId}
                  data-testid="team-wirkung-zeile"
                  data-space={s.spaceId}
                  data-vorher={s.vorher}
                  data-nachher={s.nachher}
                  className="break-words text-[12.5px] text-text"
                >
                  <span className="font-semibold">{s.spaceName}</span>:{" "}
                  {t("teams.wirkung.vorherNachher", {
                    vorher: t(`teams.recht.${s.vorher}`),
                    nachher: t(`teams.recht.${s.nachher}`),
                  })}
                  <span className="block text-[12px] text-muted-2" data-testid="team-wirkung-wege">
                    {s.wegeNachher.length === 0
                      ? t("teams.weg.keiner")
                      : t("teams.wirkung.wege", {
                          wege: s.wegeNachher
                            .map((w) =>
                              t(`teams.weg.${w.art}`, {
                                team: w.teamName ?? w.team ?? "",
                                recht: t(`spaces.recht.${w.recht}`),
                              }),
                            )
                            .join(" · "),
                        })}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {art === "archiv" ? (
        <p className="text-[12px] text-muted-2">{t("teams.wirkung.archivBleibt")}</p>
      ) : null}
      {fehler ? <Fehlerzeile fehler={fehler} testId="team-wirkung-fehler" /> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          data-testid="team-wirkung-bestaetigen"
          disabled={laeuft}
          onClick={onBestaetigen}
        >
          {art === "archiv" ? t("teams.archiv.bestaetigen") : t("teams.wirkung.bestaetigen")}
        </Button>
        <Button data-testid="team-wirkung-abbrechen" onClick={onAbbrechen}>
          {t("teams.abbrechen")}
        </Button>
      </div>
    </section>
  );
}

/** Eine 409-Antwort mit neuer Wirkung (`VORSCHAU_VERALTET`) — sonst `undefined`. */
function neueWirkungAus(fehler: unknown): TeamWirkung | undefined {
  if (fehler instanceof ApiError && fehler.code === "VORSCHAU_VERALTET") {
    const v = fehler.details.vorschau;
    return v && typeof v === "object" ? (v as TeamWirkung) : undefined;
  }
  return undefined;
}

// ------------------------------------------------------------------------------------------------
// DIE TEAMKARTE
// ------------------------------------------------------------------------------------------------

export function TeamDetail({
  teamId,
  onZurueck,
}: {
  teamId: string;
  onZurueck: () => void;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const eintrag = useQuery({ queryKey: ["team", teamId], queryFn: () => teamsApi.eintrag(teamId) });
  const konten = useKonten();
  const [stamm, setStamm] = useState<Omit<TeamEingabe, "mitglieder"> | null>(null);
  const [neuesMitglied, setNeuesMitglied] = useState("");
  /** Die vorgeschlagene Änderung samt ihrer gezeigten Wirkung. */
  const [vorschlag, setVorschlag] = useState<
    | { art: "mitglieder"; mitglieder: string[]; wirkung: TeamWirkung }
    | { art: "archiv"; wirkung: TeamWirkung }
    | null
  >(null);

  const neuLaden = async (): Promise<void> => {
    await qc.invalidateQueries({ queryKey: ["teams"] });
    await qc.invalidateQueries({ queryKey: ["team", teamId] });
    await qc.invalidateQueries({ queryKey: ["spaces"] });
  };

  const vorschau = useMutation({
    mutationFn: async (
      ziel: { art: "mitglieder"; mitglieder: string[] } | { art: "archiv" },
    ): Promise<NonNullable<typeof vorschlag>> =>
      ziel.art === "archiv"
        ? { art: "archiv", wirkung: await teamsApi.vorschauArchiv(teamId) }
        : {
            art: "mitglieder",
            mitglieder: ziel.mitglieder,
            wirkung: await teamsApi.vorschauMitglieder(teamId, ziel.mitglieder),
          },
    onSuccess: (v) => setVorschlag(v),
  });

  const bestaetigen = useMutation({
    mutationFn: async () => {
      const team = eintrag.data?.team;
      if (!team || !vorschlag) {
        throw new Error("kein Vorschlag");
      }
      if (vorschlag.art === "archiv") {
        return teamsApi.archivieren(team.id, team.version, vorschlag.wirkung.grundlage);
      }
      return teamsApi.aendern(
        team.id,
        team.version,
        {
          name: team.name,
          zweck: team.zweck,
          verantwortlich: team.verantwortlich,
          mitglieder: vorschlag.mitglieder,
        },
        vorschlag.wirkung.grundlage,
      );
    },
    onSuccess: async () => {
      setVorschlag(null);
      setNeuesMitglied("");
      await neuLaden();
    },
    onError: (e) => {
      // Die Lage hat sich geändert: die NEUE Wirkung wird gezeigt, bestätigt wird erst danach.
      const neu = neueWirkungAus(e);
      if (neu && vorschlag) {
        setVorschlag({ ...vorschlag, wirkung: neu });
      }
    },
  });

  const stammSpeichern = useMutation({
    mutationFn: async () => {
      const team = eintrag.data?.team;
      if (!team || !stamm) {
        throw new Error("kein Team");
      }
      return teamsApi.aendern(team.id, team.version, {
        ...stamm,
        mitglieder: team.mitglieder.map((m) => m.nutzer),
      });
    },
    onSuccess: async () => {
      setStamm(null);
      await neuLaden();
    },
  });

  // Die Teamkarte ist die Karte „Teams" mit einem gewählten Team — derselbe Behälter wie die Liste
  // (`detail-teams`), damit das Sprach- und Detailinventar der Verwaltung sie als EINE Karte führt.
  if (eintrag.isPending) {
    return (
      <Detailkarte titel={t("teams.titel")} onZurueck={onZurueck} testId="detail-teams">
        <p className="text-sm text-muted">{t("teams.laedt")}</p>
      </Detailkarte>
    );
  }
  if (eintrag.isError) {
    return (
      <Detailkarte titel={t("teams.titel")} onZurueck={onZurueck} testId="detail-teams">
        <Fehlerzeile fehler={eintrag.error} testId="team-nicht-gefunden" />
      </Detailkarte>
    );
  }
  const team = eintrag.data.team;
  const verlauf = eintrag.data.verlauf;
  const aktuelleIds = team.mitglieder.map((m) => m.nutzer);
  const waehlbar = (konten.data?.konten ?? []).filter((k) => !aktuelleIds.includes(k.id));
  const gesperrt = vorschlag !== null || vorschau.isPending;

  return (
    <Detailkarte
      titel={team.name}
      onZurueck={onZurueck}
      testId="detail-teams"
      hilfe={[{ titel: t("teams.wege.titel"), text: t("teams.wege.text") }]}
    >
      <div
        className="space-y-5"
        data-testid="team-karte"
        data-team={team.id}
        data-version={team.version}
      >
        <div className="space-y-1">
          <p data-testid="team-status" className="text-[12.5px] font-semibold text-ink">
            {team.archiviert ? t("teams.status.archiviert") : t("teams.status.aktiv")} ·{" "}
            {t("teams.fassung", { version: team.version })}
          </p>
          <p data-testid="team-zweck-anzeige" className="break-words text-[13px] text-text">
            {team.zweck}
          </p>
          <p data-testid="team-zustaendig" className="text-[12.5px] text-muted">
            {t("teams.zustaendig", { name: team.verantwortlichName ?? team.verantwortlich })}
          </p>
          <p className="text-[12px] text-muted-2">{t("teams.keineKopie")}</p>
        </div>

        {/* Gebundene Spaces — die Bindung pflegt der Space selbst (Spacepflege). */}
        <section aria-labelledby="team-spaces" className="space-y-2">
          <SectionLabel>
            <span id="team-spaces">{t("teams.spaces.titel")}</span>
          </SectionLabel>
          {team.spaces.length === 0 ? (
            <p className="text-[12.5px] text-muted">{t("teams.spaces.keine")}</p>
          ) : (
            <ul className="space-y-1" data-testid="team-spaces">
              {team.spaces.map((s) => (
                <li key={s.id} className="text-[12.5px] text-text">
                  <Link
                    to={`/spaces/${encodeURIComponent(s.id)}`}
                    className="font-semibold text-brand-text hover:underline"
                  >
                    {s.name}
                  </Link>{" "}
                  · {t(`spaces.recht.${s.recht}`)}
                </li>
              ))}
            </ul>
          )}
          <p className="text-[12px] text-muted-2">{t("teams.spaces.hinweis")}</p>
        </section>

        <section aria-labelledby="team-mitglieder" className="space-y-2">
          <SectionLabel>
            <span id="team-mitglieder">{t("teams.feld.mitglieder")}</span>
          </SectionLabel>
          {team.mitglieder.length === 0 ? (
            <p className="text-[12.5px] text-muted">{t("teams.mitglieder.keine")}</p>
          ) : (
            <ul className="space-y-1" data-testid="team-mitglieder">
              {team.mitglieder.map((m) => (
                <li
                  key={m.nutzer}
                  data-testid="team-mitglied"
                  data-konto={m.nutzer}
                  className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-text"
                >
                  <span className="min-w-0 break-words">
                    {m.name ?? m.nutzer}
                    {m.role ? ` · ${t(`role.name.${m.role}`)}` : ""}
                  </span>
                  {team.archiviert ? null : (
                    <Button
                      data-testid="team-mitglied-entfernen"
                      aria-label={t("teams.mitglieder.entfernenFuer", { name: m.name ?? m.nutzer })}
                      disabled={gesperrt}
                      onClick={() =>
                        vorschau.mutate({
                          art: "mitglieder",
                          mitglieder: aktuelleIds.filter((id) => id !== m.nutzer),
                        })
                      }
                    >
                      {t("teams.mitglieder.entfernen")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {team.archiviert ? (
            <p data-testid="team-archiviert-hinweis" className="text-[12.5px] text-muted">
              {t("teams.archiv.keineMitglieder")}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <select
                aria-label={t("teams.mitglieder.waehlen")}
                data-testid="team-mitglied-waehlen"
                className={`${FELD} max-w-full sm:w-auto`}
                value={neuesMitglied}
                disabled={gesperrt}
                onChange={(e) => setNeuesMitglied(e.target.value)}
              >
                <option value="">{t("teams.mitglieder.waehlen")}</option>
                {waehlbar.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name} · {t(`role.name.${k.role}`)}
                  </option>
                ))}
              </select>
              <Button
                data-testid="team-mitglied-hinzu"
                disabled={!neuesMitglied || gesperrt}
                onClick={() =>
                  vorschau.mutate({
                    art: "mitglieder",
                    mitglieder: [...aktuelleIds, neuesMitglied],
                  })
                }
              >
                {t("teams.mitglieder.hinzu")}
              </Button>
            </div>
          )}
          {vorschau.isError ? (
            <Fehlerzeile fehler={vorschau.error} testId="team-vorschau-fehler" />
          ) : null}
        </section>

        {vorschlag ? (
          <WirkungAnzeige
            wirkung={vorschlag.wirkung}
            art={vorschlag.art}
            laeuft={bestaetigen.isPending}
            fehler={bestaetigen.isError ? bestaetigen.error : null}
            onBestaetigen={() => bestaetigen.mutate()}
            onAbbrechen={() => {
              setVorschlag(null);
              bestaetigen.reset();
            }}
          />
        ) : null}

        {team.archiviert ? null : (
          <section aria-labelledby="team-stamm" className="space-y-2">
            <SectionLabel>
              <span id="team-stamm">{t("teams.bearbeiten.titel")}</span>
            </SectionLabel>
            {stamm ? (
              <form
                data-testid="team-bearbeiten"
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  stammSpeichern.mutate();
                }}
              >
                <Field label={t("teams.feld.name")}>
                  <TextInput
                    data-testid="team-name"
                    value={stamm.name}
                    onChange={(e) => setStamm({ ...stamm, name: e.target.value })}
                  />
                </Field>
                <Field label={t("teams.feld.zweck")}>
                  <textarea
                    data-testid="team-zweck"
                    rows={2}
                    className={FELD}
                    value={stamm.zweck}
                    onChange={(e) => setStamm({ ...stamm, zweck: e.target.value })}
                  />
                </Field>
                <Field label={t("teams.feld.verantwortlich")}>
                  <select
                    data-testid="team-verantwortlich"
                    className={FELD}
                    value={stamm.verantwortlich}
                    onChange={(e) => setStamm({ ...stamm, verantwortlich: e.target.value })}
                  >
                    {(konten.data?.konten ?? []).map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {stammSpeichern.isError ? (
                  <Fehlerzeile fehler={stammSpeichern.error} testId="team-fehler" />
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    variant="primary"
                    data-testid="team-speichern"
                    disabled={stammSpeichern.isPending}
                  >
                    {t("teams.bearbeiten.speichern")}
                  </Button>
                  <Button onClick={() => setStamm(null)}>{t("teams.abbrechen")}</Button>
                </div>
              </form>
            ) : (
              <Button
                data-testid="team-bearbeiten-knopf"
                disabled={gesperrt}
                onClick={() =>
                  setStamm({
                    name: team.name,
                    zweck: team.zweck,
                    verantwortlich: team.verantwortlich,
                  })
                }
              >
                {t("teams.bearbeiten.titel")}
              </Button>
            )}
          </section>
        )}

        {team.archiviert ? null : (
          <section aria-labelledby="team-archiv" className="space-y-2">
            <SectionLabel>
              <span id="team-archiv">{t("teams.archiv.titel")}</span>
            </SectionLabel>
            <p className="text-[12px] text-muted-2">{t("teams.archiv.hinweis")}</p>
            <Button
              data-testid="team-archivieren"
              disabled={gesperrt}
              onClick={() => vorschau.mutate({ art: "archiv" })}
            >
              {t("teams.archiv.pruefen")}
            </Button>
          </section>
        )}

        <section aria-labelledby="team-verlauf" className="space-y-2">
          <SectionLabel>
            <span id="team-verlauf">{t("teams.verlauf.titel")}</span>
          </SectionLabel>
          <ol data-testid="team-verlauf" className="space-y-1">
            {[...verlauf].reverse().map((v) => (
              <li
                key={v.version}
                data-testid="team-verlauf-eintrag"
                className="break-words text-[12px] text-muted-2"
              >
                {t(`teams.verlauf.${v.vorgang}`, {
                  version: v.version,
                  zeit: new Date(v.geaendertAm).toLocaleString(i18n.language),
                  wer: v.geaendertVonName ?? v.geaendertVon,
                })}
                {v.hinzugefuegt.length > 0
                  ? ` · ${t("teams.verlauf.hinzu", {
                      namen: v.hinzugefuegt.map((x) => x.name ?? x.id).join(", "),
                    })}`
                  : ""}
                {v.entfernt.length > 0
                  ? ` · ${t("teams.verlauf.entfernt", {
                      namen: v.entfernt.map((x) => x.name ?? x.id).join(", "),
                    })}`
                  : ""}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Detailkarte>
  );
}
