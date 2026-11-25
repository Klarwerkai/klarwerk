import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Teamwahl } from "../../api/teamassistenten";
import {
  type Definition,
  type Entwurf,
  type Schritt,
  workflowFehler,
  workflows,
} from "../../api/teamworkflows";
import { eingabestil, kartenstil, useTeamListe } from "../teamassistenten/teamKontext";
import { Button, Field, TextInput } from "../ui";
import { SchrittEditor, neuerSchritt } from "./SchrittEditor";

type Befehl = "speichern" | "pruefen" | "freigeben" | "entfernen" | "zurueckziehen" | "aktivieren";

export function WorkflowEditor({
  basis,
  teams,
  kontext,
  aktualisiere,
  entfernt,
  neuLaden,
}: {
  basis: Entwurf | undefined;
  teams: Teamwahl[];
  kontext: string;
  aktualisiere: (e: Entwurf) => Promise<void>;
  entfernt: () => Promise<void>;
  neuLaden: () => Promise<Entwurf | undefined>;
}) {
  const { t, i18n } = useTranslation();
  const teamListe = useTeamListe(kontext);
  const [team, setTeam] = useState(basis?.teamId ?? teams.find((x) => x.kannErstellen)?.id ?? "");
  const [edited, setEdited] = useState<Definition | null>(null);
  const start: Definition = { name: "", ausloeser: "", schritte: [] };
  const def = edited ?? basis?.definition ?? start;
  const [schluessel, setSchluessel] = useState(
    () => basis?.definition.schritte.map(() => crypto.randomUUID()) ?? [],
  );
  const [alt, setAlt] = useState("");
  const [sicher, setSicher] = useState<"zurueckziehen" | "entfernen" | null>(null);
  const [hinweis, setHinweis] = useState("");
  const available =
    teamListe.data?.assistenten.filter((a) => a.teamId === team && a.nutzbar && a.aktiv !== null) ??
    [];
  const dirty = edited !== null;
  const valid = Boolean(
    team &&
      def.name.trim() &&
      def.ausloeser.trim() &&
      def.schritte.length &&
      (!def.schritte.some((s) => s.typ === "assistent" && s.frage.includes("{{fall}}")) ||
        def.beispielfall?.trim()) &&
      def.schritte.every(
        (s) =>
          s.titel.trim() &&
          (s.typ !== "assistent" || (s.frage.trim() && s.assistentId && s.version > 0)),
      ),
  );
  const test = basis?.pruefung;
  const freigabefaehig = test?.bestanden && basis && test.version === basis.entwurf;
  const ops = useMutation({
    mutationFn: async (op: Befehl) => {
      if (op === "entfernen" && basis) {
        await workflows.entfernen(basis.id, basis.revision);
        return null;
      }
      if (op === "speichern")
        return basis
          ? workflows.speichern(basis.id, basis.revision, def)
          : workflows.erstellen(team, def);
      if (!basis) throw new Error();
      if (op === "pruefen") return workflows.pruefen(basis.id, basis.revision, i18n.language);
      if (op === "zurueckziehen") return workflows.zurueckziehen(basis.id, basis.revision);
      return workflows.freigeben(
        basis.id,
        basis.revision,
        op === "aktivieren" ? Number(alt) : basis.entwurf,
      );
    },
    onSuccess: async (r, op) => {
      setSicher(null);
      setHinweis(op);
      setAlt("");
      if (!r) {
        await entfernt();
        return;
      }
      setEdited(null);
      await aktualisiere(r);
    },
  });
  const edit = (d: Definition) => {
    setEdited(d);
    setHinweis("");
    setSicher(null);
    ops.reset();
  };
  const wechsel = (idx: number, richtung: number) => {
    const neu = [...def.schritte];
    const keys = [...schluessel];
    const ziel = idx + richtung;
    const a = neu[idx];
    const b = neu[ziel];
    const ka = keys[idx];
    const kb = keys[ziel];
    if (!a || !b || !ka || !kb) return;
    neu[idx] = b;
    neu[ziel] = a;
    keys[idx] = kb;
    keys[ziel] = ka;
    setSchluessel(keys);
    edit({ ...def, schritte: neu });
  };
  return (
    <div className="space-y-5" data-testid="workflow-editor">
      <div>
        <h2 className="text-xl font-semibold">{basis ? basis.name : t("workflows.erstellen")}</h2>
        {basis ? (
          <p className="mt-1 text-sm text-muted">
            {teams.find((x) => x.id === team)?.name} ·{" "}
            {t("workflows.entwurf", { v: basis.entwurf })} ·{" "}
            {basis.aktiv === null
              ? t("workflows.privat")
              : t("workflows.aktiv", { v: basis.aktiv })}
          </p>
        ) : null}
      </div>
      {ops.isError ? (
        <div role="alert" className={kartenstil}>
          <p>{t(workflowFehler(ops.error))}</p>
          {basis ? (
            <Button
              onClick={async () => {
                const neu = await neuLaden();
                if (!neu) return;
                setEdited(null);
                ops.reset();
                setSchluessel(neu.definition.schritte.map(() => crypto.randomUUID()));
              }}
            >
              {t("workflows.neuLaden")}
            </Button>
          ) : null}
        </div>
      ) : null}
      <fieldset className="m-0 min-w-0 space-y-5 border-0 p-0" disabled={ops.isPending}>
        <section className={kartenstil}>
          {!basis ? (
            <Field label={t("workflows.team")}>
              <select
                data-testid="workflow-team"
                className={eingabestil}
                value={team}
                onChange={(e) => {
                  setTeam(e.target.value);
                  edit({
                    ...def,
                    schritte: def.schritte.map((s) =>
                      s.typ === "assistent" ? { ...s, assistentId: "", version: 0 } : s,
                    ),
                  });
                }}
              >
                {teams
                  .filter((x) => x.kannErstellen)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
            </Field>
          ) : null}
          <Field label={t("workflows.name")}>
            <TextInput
              data-testid="workflow-name"
              value={def.name}
              maxLength={100}
              onChange={(e) => edit({ ...def, name: e.target.value })}
            />
          </Field>
          <Field label={t("workflows.ausloeser")}>
            <TextInput
              data-testid="workflow-ausloeser"
              value={def.ausloeser}
              maxLength={500}
              placeholder={t("workflows.ausloeserBeispiel")}
              onChange={(e) => edit({ ...def, ausloeser: e.target.value })}
            />
          </Field>
          <Field label={t("workflows.beispielfall")}>
            <textarea
              data-testid="workflow-beispielfall"
              className={eingabestil}
              rows={2}
              maxLength={500}
              value={def.beispielfall ?? ""}
              onChange={(e) => edit({ ...def, beispielfall: e.target.value })}
            />
          </Field>
        </section>
        <section className="space-y-3">
          <h3 className="font-semibold">{t("workflows.schritte")}</h3>
          {def.schritte.length ? (
            <ol className="space-y-2">
              {def.schritte.map((s, i) => (
                <SchrittEditor
                  key={schluessel[i] ?? i}
                  schritt={s}
                  index={i}
                  anzahl={def.schritte.length}
                  assistenten={available}
                  set={(value) =>
                    edit({
                      ...def,
                      schritte: def.schritte.map((item, n) => (n === i ? value : item)),
                    })
                  }
                  entfernen={() => {
                    setSchluessel((keys) => keys.filter((_, n) => n !== i));
                    edit({ ...def, schritte: def.schritte.filter((_, n) => n !== i) });
                  }}
                  verschieben={(richtung) => wechsel(i, richtung)}
                />
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">{t("workflows.waehleSchritt")}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {(["assistent", "entscheidung", "aktion"] as Schritt["typ"][]).map((typ) => (
              <Button
                key={typ}
                disabled={def.schritte.length >= 24}
                data-testid={`workflow-add-${typ}`}
                onClick={() => {
                  setSchluessel((keys) => [...keys, crypto.randomUUID()]);
                  edit({ ...def, schritte: [...def.schritte, neuerSchritt(typ)] });
                }}
              >
                <Plus aria-hidden size={14} />
                {t(`workflows.typ.${typ}`)}
              </Button>
            ))}
          </div>
          {teamListe.isError ? <p role="alert">{t(workflowFehler(teamListe.error))}</p> : null}
        </section>
        <Button
          variant="primary"
          data-testid="workflow-speichern"
          disabled={!valid || (!dirty && Boolean(basis))}
          onClick={() => ops.mutate("speichern")}
        >
          {t("workflows.speichern")}
        </Button>
        {basis ? (
          <section className={kartenstil}>
            <h3 className="font-semibold">{t("workflows.testFreigabe")}</h3>
            <p className="text-sm text-muted">
              {t(dirty ? "workflows.erstSpeichern" : "workflows.probeHinweis")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                data-testid="workflow-pruefen"
                disabled={dirty}
                onClick={() => ops.mutate("pruefen")}
              >
                {t("workflows.testen")}
              </Button>
              <Button
                variant="primary"
                data-testid="workflow-freigeben"
                disabled={dirty || !freigabefaehig || basis.aktiv === basis.entwurf}
                onClick={() => ops.mutate("freigeben")}
              >
                {t("workflows.freigeben", { v: basis.entwurf })}
              </Button>
            </div>
            {test && !dirty ? (
              <div aria-live="polite" className="space-y-2" data-testid="workflow-pruefergebnis">
                <p className="flex items-center gap-2 font-medium">
                  {test.bestanden ? (
                    <CheckCircle2 aria-hidden size={17} />
                  ) : (
                    <CircleAlert aria-hidden size={17} />
                  )}{" "}
                  {t(test.bestanden ? "workflows.bestanden" : "workflows.durchgefallen", {
                    v: test.version,
                  })}
                </p>
                <ol className="space-y-1 text-sm">
                  {test.schritte.map((p) => (
                    <li key={p.index}>
                      {p.index + 1}. {def.schritte[p.index]?.titel} ·{" "}
                      {t(p.bestanden ? "workflows.testOk" : "workflows.testFehler")}
                      {p.erwartet && p.ist
                        ? ` · ${t("workflows.vergleich", {
                            soll: t(`teamassistenten.${p.erwartet}`),
                            ist: t(`teamassistenten.${p.ist}`),
                          })}`
                        : null}
                      {p.code
                        ? ` · ${t(`workflows.probe.${p.code}`, {
                            defaultValue: t("workflows.schrittPruefen"),
                          })}`
                        : null}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </section>
        ) : null}
        {basis ? (
          <section className={kartenstil}>
            <h3 className="font-semibold">{t("workflows.teamfassung")}</h3>
            <p className="text-sm">
              {basis.aktiv === null
                ? t("workflows.privat")
                : t("workflows.aktiv", { v: basis.aktiv })}
            </p>
            {basis.freigegebeneVersionen.some((v) => v !== basis.aktiv) ? (
              <div className="flex flex-wrap items-end gap-2">
                <Field label={t("workflows.fruehere")}>
                  <select
                    className={eingabestil}
                    value={alt}
                    onChange={(e) => setAlt(e.target.value)}
                  >
                    <option value="">{t("workflows.waehlen")}</option>
                    {basis.freigegebeneVersionen
                      .filter((v) => v !== basis.aktiv)
                      .map((v) => (
                        <option value={v} key={v}>
                          {t("workflows.version", { v })}
                        </option>
                      ))}
                  </select>
                </Field>
                <Button disabled={!alt || dirty} onClick={() => ops.mutate("aktivieren")}>
                  {t("workflows.aktivieren")}
                </Button>
              </div>
            ) : null}
            {!sicher ? (
              basis.aktiv !== null ? (
                <Button disabled={dirty} onClick={() => setSicher("zurueckziehen")}>
                  {t("workflows.zurueckziehen")}
                </Button>
              ) : !basis.freigegebeneVersionen.length ? (
                <Button disabled={dirty} onClick={() => setSicher("entfernen")}>
                  {t("workflows.entfernen")}
                </Button>
              ) : null
            ) : (
              <div className="space-y-2">
                <p>{t(`workflows.bestaetigen.${sicher}`)}</p>
                <div className="flex gap-2">
                  <Button onClick={() => setSicher(null)}>{t("workflows.abbrechen")}</Button>
                  <Button onClick={() => ops.mutate(sicher)}>{t(`workflows.${sicher}`)}</Button>
                </div>
              </div>
            )}
          </section>
        ) : null}
      </fieldset>
      <output className="block text-sm text-muted">
        {ops.isPending ? t("workflows.warten") : hinweis ? t(`workflows.meldung.${hinweis}`) : ""}
      </output>
    </div>
  );
}
