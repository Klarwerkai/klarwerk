import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, CircleX } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type AssistentEntwurf,
  type Teamdefinition,
  type Teamwahl,
  type Urteil,
  teamFehler,
  teamassistenten,
} from "../../api/teamassistenten";
import { Button, Field, TextInput } from "../ui";
import { QuellenAuswahl } from "./QuellenAuswahl";
import { eingabestil, kartenstil } from "./teamKontext";

const urteile: readonly Urteil[] = ["belegt", "widerspruch", "offen"];
const leer: Teamdefinition = { name: "", aufgabe: "", quellen: [], beispiele: [] };
function mitBeispielzeilen(d: Teamdefinition) {
  return {
    ...d,
    sachfragen: d.sachfragen !== false,
    beispiele: [
      ...d.beispiele,
      ...urteile
        .filter((u) => !d.beispiele.some((b) => b.erwartet === u))
        .map((erwartet) => ({ frage: "", erwartet })),
    ].map((b) => ({ ...b, schluessel: crypto.randomUUID() })),
  };
}
function fuerServer(d: Teamdefinition): Teamdefinition {
  return {
    name: d.name.trim(),
    aufgabe: d.aufgabe.trim(),
    sachfragen: d.sachfragen !== false,
    quellen: d.quellen,
    beispiele: d.beispiele
      .filter((b) => b.frage.trim())
      .map((b) => ({ erwartet: b.erwartet, frage: b.frage.trim() })),
  };
}
type Aktion = "speichern" | "pruefen" | "freigeben" | "aktivieren" | "zurueckziehen" | "entfernen";
type Props = {
  aktuell: AssistentEntwurf | undefined;
  kontext: string;
  teams: Teamwahl[];
  nachBuchung: (a: AssistentEntwurf) => Promise<void>;
  nachEntfernen: () => Promise<void>;
  nachLaden: () => Promise<AssistentEntwurf | undefined>;
};

export function TeamassistentenEditor({
  aktuell,
  teams,
  kontext,
  nachBuchung,
  nachEntfernen,
  nachLaden,
}: Props) {
  const { t, i18n } = useTranslation();
  const [basis, setBasis] = useState(aktuell);
  const [definition, setDefinition] = useState(() =>
    mitBeispielzeilen(aktuell?.definition ?? leer),
  );
  const [teamId, setTeamId] = useState(
    aktuell?.teamId ?? teams.find((team) => team.kannErstellen)?.id ?? "",
  );
  const [alt, setAlt] = useState("");
  const [bestatige, setBestatige] = useState<"entfernen" | "zurueckziehen" | null>(null);
  const [hinweis, setHinweis] = useState("");
  const wert = fuerServer(definition);
  const dirty = JSON.stringify(wert) !== JSON.stringify(fuerServer(basis?.definition ?? leer));
  const veraltet = Boolean(aktuell && basis && aktuell.revision !== basis.revision);
  const testbereit =
    wert.quellen.length > 0 && urteile.every((u) => wert.beispiele.some((b) => b.erwartet === u));
  const titelTeam = teams.find((team) => team.id === teamId)?.name;
  const bestanden = Boolean(basis?.pruefung?.bestanden && basis.pruefung.version === basis.entwurf);
  const akt = useMutation({
    mutationFn: async (art: Aktion) => {
      if (art === "speichern")
        return basis
          ? teamassistenten.speichern(basis.id, basis.revision, wert)
          : teamassistenten.erstellen(teamId, wert);
      if (!basis) throw new Error();
      switch (art) {
        case "pruefen":
          return teamassistenten.pruefen(basis.id, basis.revision, i18n.language);
        case "freigeben":
          return teamassistenten.freigeben(basis.id, basis.revision, basis.entwurf);
        case "aktivieren":
          return teamassistenten.freigeben(basis.id, basis.revision, Number(alt));
        case "zurueckziehen":
          return teamassistenten.zurueckziehen(basis.id, basis.revision);
        case "entfernen":
          await teamassistenten.entfernen(basis.id, basis.revision);
          return null;
      }
    },
  });
  const jetzt = (art: Aktion) => {
    setHinweis("");
    setBestatige(null);
    akt.mutate(art, {
      onSuccess: async (result) => {
        if (!result) {
          await nachEntfernen();
          return;
        }
        setBasis(result);
        setDefinition(mitBeispielzeilen(result.definition));
        setAlt("");
        setHinweis(
          art === "speichern"
            ? "gespeichert"
            : art === "pruefen"
              ? "geprueft"
              : art === "zurueckziehen"
                ? "zurueckgezogen"
                : "freigegeben",
        );
        await nachBuchung(result);
      },
    });
  };
  const aendere = (d: ReturnType<typeof mitBeispielzeilen>) => {
    setDefinition(d);
    setHinweis("");
    setBestatige(null);
    akt.reset();
  };
  const neuLaden = async () => {
    const a = await nachLaden();
    if (a) {
      setBasis(a);
      setDefinition(mitBeispielzeilen(a.definition));
      setAlt("");
      setBestatige(null);
      setHinweis("");
      akt.reset();
    }
  };
  const reload = veraltet || (akt.isError && teamFehler(akt.error) === "teamassistenten.veraltet");
  const sperre = akt.isPending || veraltet;
  const alteVersionen = basis?.freigegebeneVersionen.filter((v) => v !== basis.aktiv) ?? [];
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">{basis ? basis.name : t("teamassistenten.neu")}</h2>
        {basis ? (
          <p className="text-sm text-muted">
            {titelTeam} · {t("teamassistenten.entwurfsnummer", { version: basis.entwurf })} ·{" "}
            {basis.aktiv === null
              ? t("teamassistenten.privat")
              : t("teamassistenten.aktiv", { version: basis.aktiv })}
          </p>
        ) : null}
      </div>
      {reload ? (
        <div role="alert" className={kartenstil}>
          <p>{t("teamassistenten.veraltet")}</p>
          <Button onClick={() => void neuLaden()}>{t("teamassistenten.neuladen")}</Button>
        </div>
      ) : null}
      {akt.isError && !reload ? <p role="alert">{t(teamFehler(akt.error))}</p> : null}
      <output className="block text-sm text-muted">
        {hinweis ? t(`teamassistenten.${hinweis}`) : null}
      </output>
      <fieldset disabled={sperre} className="m-0 min-w-0 space-y-5 border-0 p-0">
        <section className={kartenstil}>
          <h3 className="font-semibold">{t("teamassistenten.aufbau")}</h3>
          {!basis ? (
            <Field label={t("teamassistenten.team")}>
              <select
                className={eingabestil}
                data-testid="teamassistent-team"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
              >
                {teams
                  .filter((team) => team.kannErstellen)
                  .map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
              </select>
            </Field>
          ) : null}
          <Field label={t("teamassistenten.name")}>
            <TextInput
              data-testid="teamassistent-name"
              value={definition.name}
              maxLength={100}
              required
              onChange={(e) => aendere({ ...definition, name: e.target.value })}
            />
          </Field>
          <Field label={t("teamassistenten.aufgabe")}>
            <textarea
              data-testid="teamassistent-aufgabe"
              className={eingabestil}
              rows={3}
              value={definition.aufgabe}
              required
              maxLength={2000}
              placeholder={t("teamassistenten.aufgabeHinweis")}
              onChange={(e) => aendere({ ...definition, aufgabe: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              data-testid="teamassistent-sachfragen"
              type="checkbox"
              checked={definition.sachfragen}
              onChange={(e) => aendere({ ...definition, sachfragen: e.target.checked })}
            />
            {t("teamassistenten.sachfragen")}
          </label>
        </section>
        <section className={kartenstil}>
          <h3 className="font-semibold">{t("teamassistenten.quellen")}</h3>
          <p className="text-sm text-muted">{t("teamassistenten.quellenHint")}</p>
          <QuellenAuswahl
            kontext={kontext}
            ids={definition.quellen}
            setIds={(quellen) => aendere({ ...definition, quellen })}
          />
        </section>
        <section className={kartenstil}>
          <h3 className="font-semibold">{t("teamassistenten.testfaelle")}</h3>
          <p className="text-sm text-muted">{t("teamassistenten.testHilfe")}</p>
          {definition.beispiele.map((b, index) => (
            <Field
              key={b.schluessel}
              label={t("teamassistenten.erwartet", { urteil: t(`teamassistenten.${b.erwartet}`) })}
            >
              <TextInput
                data-testid={`teamassistent-test-${b.erwartet}`}
                value={b.frage}
                maxLength={1000}
                placeholder={t(`teamassistenten.beispiel_${b.erwartet}`)}
                onChange={(e) =>
                  aendere({
                    ...definition,
                    beispiele: definition.beispiele.map((alt, i) =>
                      i === index ? { ...alt, frage: e.target.value } : alt,
                    ),
                  })
                }
              />
            </Field>
          ))}
          <Button
            variant="primary"
            data-testid="teamassistent-speichern"
            disabled={!teamId || !wert.name || !wert.aufgabe || (Boolean(basis) && !dirty)}
            onClick={() => jetzt("speichern")}
          >
            {t("teamassistenten.speichern")}
          </Button>
        </section>
        {basis ? (
          <section className={kartenstil}>
            <h3 className="font-semibold">{t("teamassistenten.testUndFreigabe")}</h3>
            <p className="text-sm text-muted">
              {t(
                dirty
                  ? "teamassistenten.erstSpeichern"
                  : !testbereit
                    ? "teamassistenten.pruefungFehlt"
                    : "teamassistenten.pruefHinweis",
                { team: titelTeam },
              )}
            </p>
            <Button
              data-testid="teamassistent-pruefen"
              disabled={dirty || !testbereit}
              onClick={() => jetzt("pruefen")}
            >
              {t("teamassistenten.pruefen")}
            </Button>
            {basis.pruefung && !dirty ? (
              <div data-testid="teamassistent-pruefergebnis" className="space-y-2">
                <h4 className="text-sm font-semibold">
                  {t(
                    basis.pruefung.bestanden
                      ? "teamassistenten.alleGruen"
                      : "teamassistenten.testRot",
                    { version: basis.pruefung.version },
                  )}
                </h4>
                <ul className="divide-y divide-hairline">
                  {basis.pruefung.faelle.map((f) => (
                    <li key={f.frage} className="flex gap-2 py-2 text-sm">
                      {f.bestanden ? (
                        <CheckCircle2
                          aria-label={t("teamassistenten.bestanden")}
                          size={16}
                          className="mt-0.5 shrink-0 text-trust-ok-text"
                        />
                      ) : (
                        <CircleX
                          aria-label={t("teamassistenten.fehlgeschlagen")}
                          size={16}
                          className="mt-0.5 shrink-0 text-trust-crit-text"
                        />
                      )}
                      <div>
                        <p>{f.frage}</p>
                        <p className="text-xs text-muted">
                          {t("teamassistenten.vergleich", {
                            erwartet: t(`teamassistenten.${f.erwartet}`),
                            ist: t(`teamassistenten.${f.ist}`),
                          })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Button
              variant="primary"
              data-testid="teamassistent-freigeben"
              disabled={dirty || !bestanden || basis.aktiv === basis.entwurf}
              onClick={() => jetzt("freigeben")}
            >
              {t("teamassistenten.freigeben", { version: basis.entwurf, team: titelTeam })}
            </Button>
          </section>
        ) : null}
        {basis ? (
          <div className={kartenstil}>
            <h3 className="font-semibold">{t("teamassistenten.versionen")}</h3>
            <p className="text-sm">
              {basis.aktiv === null
                ? t("teamassistenten.privat")
                : t("teamassistenten.aktiv", { version: basis.aktiv })}
            </p>
            {alteVersionen.length ? (
              <div className="flex flex-wrap items-end gap-2">
                <Field label={t("teamassistenten.fruehere")}>
                  <select
                    className={eingabestil}
                    value={alt}
                    onChange={(e) => setAlt(e.target.value)}
                  >
                    <option value="">{t("teamassistenten.waehlen")}</option>
                    {alteVersionen.map((v) => (
                      <option key={v} value={v}>
                        {t("teamassistenten.version", { version: v })}
                      </option>
                    ))}
                  </select>
                </Field>
                <Button disabled={!alt || dirty} onClick={() => jetzt("aktivieren")}>
                  {t("teamassistenten.aktivieren")}
                </Button>
              </div>
            ) : null}
            {basis.aktiv !== null ? (
              <Button disabled={dirty} onClick={() => setBestatige("zurueckziehen")}>
                {t("teamassistenten.zurueckziehen")}
              </Button>
            ) : basis.freigegebeneVersionen.length === 0 ? (
              <Button variant="ghost" onClick={() => setBestatige("entfernen")}>
                {t("teamassistenten.entwurfLoeschen")}
              </Button>
            ) : null}
            {bestatige ? (
              <div className="space-y-2 border-t border-hairline pt-3">
                <p className="text-sm">
                  {t(
                    bestatige === "entfernen"
                      ? "teamassistenten.loeschenFrage"
                      : "teamassistenten.zurueckFrage",
                    { name: basis.name, team: titelTeam },
                  )}
                </p>
                <div className="flex gap-2">
                  <Button variant="danger" onClick={() => jetzt(bestatige)}>
                    {t("teamassistenten.bestaetigen")}
                  </Button>
                  <Button onClick={() => setBestatige(null)}>
                    {t("teamassistenten.abbrechen")}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </fieldset>
    </div>
  );
}
