/* Kleine Word-Ansichten der bestehenden persönlichen Dienste; Identität kommt nur aus der Sitzung. */
((root) => {
  "use strict";
  function attach(ui, functions, settings) {
    const { node, button, t, request, guarded } = ui;
    const base = "/api/me/klara";
    const encode = encodeURIComponent;
    const field = (parent, key, value = "", type = "text") => {
      const label = node("label", "mini-field");
      label.append(node("span", "", t(key)));
      const input = node(type === "textarea" ? "textarea" : "input");
      if (type !== "textarea") input.type = type;
      input.value = value;
      label.append(input); parent.append(label); return input;
    };
    const stampGilt = (stamp) => stamp === ui.generation;
    function action(key, work) {
      const el = button(key, () => {
        el.disabled = true;
        void guarded(work).finally(() => { el.disabled = false; });
      });
      return el;
    }
    function empty(parent, list) {
      if (!list.length) parent.append(node("p", "mini-meta", t("noEntries")));
    }
    function card(parent, title, text) {
      const el = node("article", "mini-record");
      el.append(node("h3", "", title), node("p", "mini-message-text", text || ""));
      parent.append(el); return el;
    }
    const factories = { notes: notes, tasks: tasks, reminders: reminders, overview: overview, ki: ki };
    for (const [name, factory] of Object.entries(factories)) {
      functions.append(button(name, () => {
        ui.show(name);
        void guarded(async (stamp) => {
          const room = ui.room(name);
          if (room.dataset.miniDraft === String(ui.generation)) return;
          room.replaceChildren(node("p", "mini-meta", t("loading")));
          if (!ui.account) { room.replaceChildren(node("p", "", t("login"))); return; }
          await factory(room, stamp);
        });
      }, "mini-function"));
    }
    async function notes(room, stamp) {
      const data = await request(base + "/notizen");
      if (!stampGilt(stamp)) return;
      delete room.dataset.miniDraft;
      room.replaceChildren();
      room.append(button("create", () => noteEditor(room, null)));
      empty(room, data.notizen);
      for (const note of data.notizen) {
        const item = card(room, note.titel, note.inhalt);
        item.append(node("p", "mini-meta", "v" + note.fassung));
        item.append(button("change", () => noteEditor(room, note)));
        item.append(action("taskFromNote", async (current) => {
          const result = await request(base + "/aufgaben", "POST", {
            vorgang: "word-notiz-aufgabe-" + note.id, weg: "notiz", quelle: { notizId: note.id },
          });
          if (stampGilt(current)) ui.notify(t("saved") + ": " + result.aufgabe.titel);
        }));
      }
    }
    function noteEditor(room, note) {
      room.dataset.miniDraft = String(ui.generation);
      room.replaceChildren();
      const title = field(room, "title", note?.titel || "");
      const content = field(room, "content", note?.inhalt || "", "textarea");
      const operation = root.crypto.randomUUID();
      room.append(action("save", async (stamp) => {
        const result = await request(base + "/notizen" + (note ? "/" + encode(note.id) : ""),
          note ? "PUT" : "POST", note ? {
            fassung: note.fassung, titel: title.value, inhalt: content.value,
            art: note.art, offeneFragen: note.offeneFragen,
          } : {
            vorgang: operation, weg: "geschrieben", titel: title.value,
            inhalt: content.value, objektbezug: ui.reference(),
          });
        if (!stampGilt(stamp)) return;
        ui.notify(t("saved") + ": " + result.notiz.titel);
        await notes(room, stamp);
      }));
      if (note) room.append(action("delete", async (stamp) => {
        if (!root.confirm(t("delete") + ": " + note.titel + "?")) return;
        await request(base + "/notizen/" + encode(note.id), "DELETE");
        if (stampGilt(stamp)) await notes(room, stamp);
      }));
      room.append(button("cancel", () => { void guarded((stamp) => notes(room, stamp)); }));
      content.focus();
    }
    async function tasks(room, stamp) {
      const data = await request(base + "/aufgaben");
      if (!stampGilt(stamp)) return;
      delete room.dataset.miniDraft;
      room.replaceChildren(); empty(room, data.aufgaben);
      for (const task of data.aufgaben) {
        const item = card(room, task.titel, task.inhalt);
        item.append(node("p", "mini-meta", t(task.status === "erledigt" ? "done" : "open") +
          " · " + task.prioritaet + " · v" + task.fassung));
        item.append(action(task.status === "offen" ? "done" : "open", async (current) => {
          await request(base + "/aufgaben/" + encode(task.id), "PUT", {
            fassung: task.fassung, status: task.status === "offen" ? "erledigt" : "offen",
          });
          if (stampGilt(current)) await tasks(room, current);
        }));
        item.append(button("change", () => {
          room.dataset.miniDraft = String(ui.generation);
          room.replaceChildren();
          const title = field(room, "title", task.titel);
          const content = field(room, "content", task.inhalt, "textarea");
          room.append(action("save", async (current) => {
            await request(base + "/aufgaben/" + encode(task.id), "PUT", {
              fassung: task.fassung, titel: title.value, inhalt: content.value,
            });
            if (stampGilt(current)) await tasks(room, current);
          }), button("cancel", () => { void guarded((current) => tasks(room, current)); }));
        }));
      }
    }
    async function reminders(room, stamp) {
      const data = await request(base + "/erinnerungen");
      if (!stampGilt(stamp)) return;
      delete room.dataset.miniDraft;
      room.replaceChildren(node("p", "mini-meta", t("reminderInfo")));
      room.append(button("create", () => reminderEditor(room)));
      empty(room, data.erinnerungen);
      for (const reminder of data.erinnerungen) {
        const item = card(room, reminder.titel, reminder.notiz);
        const date = reminder.anzeige?.naechste;
        item.append(node("p", "mini-meta", [reminder.lage || reminder.status,
          date ? date.datum + " " + date.uhrzeit : "", reminder.zeitzone].filter(Boolean).join(" · ")));
        for (const [key, command] of reminder.status === "pausiert"
          ? [["resume", "fortsetzen"], ["end", "beenden"]]
          : reminder.status === "aktiv" ? [["pause", "pausieren"], ["done", "erledigen"], ["end", "beenden"]] : []) {
          item.append(action(key, async (current) => {
            await request(base + "/erinnerungen/" + encode(reminder.id) + "/status", "POST", {
              fassung: reminder.fassung, aktion: command,
            });
            if (stampGilt(current)) await reminders(room, current);
          }));
        }
      }
    }
    function reminderEditor(room) {
      room.dataset.miniDraft = String(ui.generation);
      room.replaceChildren();
      const title = field(room, "title");
      const content = field(room, "content", "", "textarea");
      const date = field(room, "date", "", "date");
      const time = field(room, "time", "09:00", "time");
      const zone = field(room, "zone", Intl.DateTimeFormat().resolvedOptions().timeZone);
      const preview = node("div", "mini-preview");
      const operation = root.crypto.randomUUID();
      const payload = () => ({
        titel: title.value, notiz: content.value, bezug: { art: "frei" }, zeitzone: zone.value,
        zeitplan: { art: "einmalig", datum: date.value, uhrzeit: time.value }, aktion: "erinnern",
      });
      room.append(action("preview", async (stamp) => {
        const input = payload();
        const result = await request(base + "/erinnerungen/vorschau", "POST", {
          zeitplan: input.zeitplan, zeitzone: input.zeitzone, aktion: input.aktion,
        });
        if (!stampGilt(stamp)) return;
        preview.replaceChildren();
        const next = result.anzeige?.naechste;
        preview.append(node("p", "", next ? next.datum + " " + next.uhrzeit + " · " + result.zeitzone :
          t("error")));
        if (next) preview.append(action("confirm", async (current) => {
          await request(base + "/erinnerungen", "POST", { ...input, vorgang: operation });
          if (stampGilt(current)) await reminders(room, current);
        }));
      }), preview, button("cancel", () => { void guarded((stamp) => reminders(room, stamp)); }));
      // Die Bestätigung gehört exakt der geprüften Eingabe; jede Änderung nimmt sie zurück.
      for (const input of [title, content, date, time, zone]) input.addEventListener("input", () => {
        preview.replaceChildren();
      });
    }
    async function overview(room, stamp) {
      const [notesData, tasksData, remindersData] = await Promise.all([
        request(base + "/notizen"), request(base + "/aufgaben"), request(base + "/erinnerungen"),
      ]);
      if (!stampGilt(stamp)) return;
      room.replaceChildren();
      for (const [key, list, factory] of [
        ["tasks", tasksData.aufgaben, tasks], ["notes", notesData.notizen, notes],
        ["reminders", remindersData.erinnerungen, reminders],
      ]) {
        const section = node("section", "mini-record");
        section.append(node("h3", "", t(key)));
        for (const item of list) section.append(node("p", "", item.titel));
        empty(section, list);
        section.append(button("change", () => { ui.show(key); void guarded((s) => factory(ui.room(key), s)); }));
        room.append(section);
      }
    }

    const kiRuns = new Map();
    const terminalKi = (status) => ["gestoppt", "ersetzt", "antwort_erhalten", "fehler"].includes(status);
    function kiRun(gid, result) {
      const key = gid + ":" + result.job.jobId;
      let run = kiRuns.get(key);
      if (!run || run.generation !== ui.generation) {
        run = { key, gid, generation: ui.generation, jobId: result.job.jobId, epoch: 0,
          stopped: result.job.status === "gestoppt", stopping: false,
          label: result.auftrag.ziel, path: base + "/gespraeche/" + encode(gid) +
            "/ki-auftraege/" + encode(result.job.jobId) };
        kiRuns.set(key, run);
      }
      run.stop = () => guarded(async (stamp) => {
        if (run.stopping || stamp !== run.generation) return;
        run.stopping = true;
        run.stopped = true;
        run.epoch++;
        try {
          const confirmed = await request(run.path + "/stopp", "POST", {});
          if (!stampGilt(stamp)) return;
          if (terminalKi(confirmed.auftrag?.job?.status)) ui.activity(run.key, "", null);
          await refreshKi(run);
        } catch (error) {
          run.stopped = false;
          if (stampGilt(stamp)) ui.activity(run.key, run.label, run.stop);
          throw error;
        } finally { run.stopping = false; }
      });
      return run;
    }
    async function refreshKi(run) {
      const data = await request(base + "/gespraeche/" + encode(run.gid) + "/ki-auftraege");
      if (!stampGilt(run.generation)) return;
      const result = data.auftraege.find((a) => a.job.jobId === run.jobId);
      if (result && terminalKi(result.job.status)) {
        run.stopped = result.job.status === "gestoppt";
        ui.activity(run.key, "", null);
      } else if (result && ["gesendet", "unterbrochen"].includes(result.job.status)) {
        ui.activity(run.key, run.label, run.stop);
      }
      if (run.gid === ui.conversationId) await ki(ui.room("ki"), run.generation);
    }
    async function ki(room, stamp) {
      const gid = ui.conversationId;
      const capabilities = await request(base + "/ki-faehigkeiten");
      const jobs = gid ? await request(
        base + "/gespraeche/" + encode(gid) + "/ki-auftraege",
      ) : { auftraege: [] };
      if (!stampGilt(stamp) || gid !== ui.conversationId) return;
      const draft = room.dataset.miniDraft === String(stamp) ? room.querySelector("[data-ki-form]") : null;
      room.replaceChildren();
      for (const capability of capabilities.faehigkeiten) {
        card(room, capability.faehigkeit + " · " + capability.status, capability.text);
      }
      if (capabilities.mcpText) room.append(node("p", "mini-meta", capabilities.mcpText));
      for (const result of jobs.auftraege) {
        const run = kiRun(gid, result);
        const item = card(room, result.auftrag.ziel, result.job.status);
        if (result.wegGesperrt) item.append(node("p", "mini-meta", result.wegGesperrt));
        if (result.prompt) {
          const prompt = node("textarea");
          prompt.readOnly = true; prompt.value = result.prompt; prompt.setAttribute("aria-label", "Prompt");
          item.append(prompt);
        }
        for (const response of result.antworten) {
          item.append(node("p", "mini-message-text", response.inhalt || response.hinweis || ""));
        }
        if (!result.wegGesperrt && result.paketAktuell && result.job.status === "vorbereitet") {
          item.append(action("confirm", async (current) => {
            const ticket = ++run.epoch;
            run.stopped = false;
            // Der bekannte Job bleibt vor dem ersten await stoppbar, an SEINEM Gespräch.
            ui.activity(run.key, run.label, run.stop);
            await request(run.path + "/uebergabe", "POST", { erneutSendenBestaetigt: false });
            if (!stampGilt(current) || run.stopped || ticket !== run.epoch) return;
            await refreshKi(run);
          }));
        }
        if (["vorbereitet", "gesendet", "unterbrochen"].includes(result.job.status)) {
          item.append(button("stop", run.stop));
          if (result.job.status === "gesendet") ui.activity(run.key, run.label, run.stop);
        } else if (terminalKi(result.job.status)) {
          ui.activity(run.key, "", null);
        }
      }
      if (draft) { room.append(draft); return; }
      if (capabilities.lage.keineKi || !capabilities.lage.erlaubteAnbieter.length ||
        !capabilities.faehigkeiten.some((c) => ["verfuegbar", "verbunden"].includes(c.status))) return;
      const form = node("section", "mini-record");
      form.dataset.kiForm = "true";
      form.addEventListener("input", () => { room.dataset.miniDraft = String(ui.generation); });
      const goal = field(form, "content", "", "textarea");
      const provider = node("select");
      provider.setAttribute("aria-label", "KI");
      for (const name of capabilities.lage.erlaubteAnbieter) {
        const option = node("option", "", name); option.value = name; provider.append(option);
      }
      const ability = node("select"); ability.setAttribute("aria-label", t("functions"));
      for (const cap of capabilities.faehigkeiten.filter((c) => ["verfuegbar", "verbunden"].includes(c.status))) {
        const option = node("option", "", cap.faehigkeit); option.value = cap.faehigkeit; ability.append(option);
      }
      form.append(provider, ability, action("preview", async (current) => {
        const conversation = await ui.ensureConversation();
        if (!stampGilt(current)) return;
        await request(base + "/gespraeche/" + encode(conversation.id) + "/ki-auftraege", "POST", {
          ziel: goal.value, ergebnisformat: "fliesstext", offenePunkte: [],
          anbieter: provider.value, faehigkeit: ability.value, quellen: [], freigegebeneQuellen: [],
        });
        if (stampGilt(current)) { delete room.dataset.miniDraft; await ki(room, current); }
      }));
      room.append(form);
    }

    settings.append(button("profile", () => {
      ui.show("profile");
      void guarded(async (stamp) => {
        const data = await request("/api/me/assistenz");
        if (!stampGilt(stamp)) return;
        const room = ui.room("profile");
        room.replaceChildren();
        const name = field(room, "nameLabel", data.profil?.name || "");
        const avatar = node("select");
        avatar.setAttribute("aria-label", t("avatar"));
        for (const id of ["original", "lichtwesen", "roboter", "eule", "fuchs", "pinguin", "wolke",
          "kompass", "prisma", "wissensbuch", "verbindungsknoten", "monolith", "leuchtkreis"]) {
          const option = node("option", "", id); option.value = id; avatar.append(option);
        }
        avatar.value = data.profil?.avatar || "original";
        room.append(avatar, action("profileSave", async (current) => {
          await request("/api/me/assistenz", "PUT", {
            fassung: data.profil?.fassung || 0, name: name.value, avatar: avatar.value,
          });
          if (stampGilt(current)) {
            ui.refreshProfile();
            ui.notify(t("saved")); ui.show("home");
          }
        }));
      });
    }, "mini-function"));
  }
  root.KlarwerkWordFunktionen = { attach };
})(typeof window === "undefined" ? globalThis : window);
