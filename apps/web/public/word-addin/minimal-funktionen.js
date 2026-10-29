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
          room.replaceChildren(node("p", "mini-meta", t("loading")));
          if (!ui.account) { room.replaceChildren(node("p", "", t("login"))); return; }
          await factory(room, stamp);
        });
      }, "mini-function"));
    }
    async function notes(room, stamp) {
      const data = await request(base + "/notizen");
      if (!stampGilt(stamp)) return;
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

    async function ki(room, stamp) {
      const capabilities = await request(base + "/ki-faehigkeiten");
      const jobs = ui.conversationId ? await request(
        base + "/gespraeche/" + encode(ui.conversationId) + "/ki-auftraege",
      ) : { auftraege: [] };
      if (!stampGilt(stamp)) return;
      room.replaceChildren();
      for (const capability of capabilities.faehigkeiten) {
        card(room, capability.faehigkeit + " · " + capability.status, capability.text);
      }
      if (capabilities.mcpText) room.append(node("p", "mini-meta", capabilities.mcpText));
      for (const result of jobs.auftraege) {
        const item = card(room, result.auftrag.ziel, result.job.status);
        const path = base + "/gespraeche/" + encode(ui.conversationId) +
          "/ki-auftraege/" + encode(result.job.jobId);
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
            await request(path + "/uebergabe", "POST", { erneutSendenBestaetigt: false });
            if (stampGilt(current)) await ki(room, current);
          }));
        }
        if (["vorbereitet", "gesendet", "unterbrochen"].includes(result.job.status)) {
          const stop = () => guarded(async (current) => {
            await request(path + "/stopp", "POST", {});
            if (stampGilt(current)) {
              ui.activity("ki-" + result.job.jobId, "", null);
              await ki(room, current);
            }
          });
          item.append(button("stop", stop));
          if (result.job.status === "gesendet") ui.activity("ki-" + result.job.jobId, result.auftrag.ziel, stop);
        }
      }
      if (capabilities.lage.keineKi) return;
      const form = node("section", "mini-record");
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
        if (stampGilt(current)) await ki(room, current);
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
