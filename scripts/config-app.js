import {
  MODULE_ID,
  SETTINGS,
  FIELD_DEFS,
  SECTIONS,
  BUILTIN_PRESETS,
  BUILTIN_FOUNDRY_DEFAULT_ID,
  emptyPreset
} from "./constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class PresetManager extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "token-defaults-preset-manager",
    tag: "form",
    classes: ["token-defaults", "preset-manager"],
    window: {
      title: "TOKEN_DEFAULTS.Manager.title",
      icon: "fa-solid fa-user-gear",
      resizable: true
    },
    position: { width: 640, height: 600 },
    form: {
      handler: PresetManager.#onSubmit,
      closeOnSubmit: true,
      submitOnChange: false
    },
    actions: {
      createPreset: PresetManager.#onCreate,
      deletePreset: PresetManager.#onDelete,
      applyDefaults: PresetManager.#onApplyDefaults
    }
  };

  static PARTS = {
    body: {
      template: `modules/${MODULE_ID}/templates/presets.hbs`,
      scrollable: [".presets"]
    },
    footer: { template: "templates/generic/form-footer.hbs" }
  };

  /** Working copy of presets edited in the form. Persisted on submit. */
  #presets = null;

  async _prepareContext(_options) {
    if (!this.#presets) {
      const stored = game.settings.get(MODULE_ID, SETTINGS.PRESETS) ?? {};
      this.#presets = foundry.utils.deepClone(stored);
      // Normalize: every field is always managed in the new model. Old presets
      // with enabled:false get upgraded in-memory; saving persists the change.
      for (const preset of Object.values(this.#presets)) {
        for (const f of Object.values(preset.fields ?? {})) {
          f.enabled = true;
        }
      }
    }
    const builtins = Object.values(BUILTIN_PRESETS).map((p) => ({
      id: p.id,
      name: p.name,
      sections: this.#prepareSections(p)
    }));
    const userPresets = Object.values(this.#presets).map((p) => ({
      id: p.id,
      name: p.name,
      sections: this.#prepareSections(p)
    }));
    return {
      builtins,
      userPresets,
      buttons: [
        {
          type: "submit",
          icon: "fa-solid fa-save",
          label: "TOKEN_DEFAULTS.Manager.save"
        }
      ]
    };
  }

  #prepareSections(preset) {
    const grouped = new Map();
    for (const id of Object.keys(SECTIONS)) grouped.set(id, []);

    for (const [key, def] of Object.entries(FIELD_DEFS)) {
      const f = preset.fields?.[key] ?? { enabled: false, value: def.default };

      let choices = null;
      if (def.type === "select") {
        const constMap = def.options();
        choices = Object.entries(constMap).map(([name, val]) => ({
          value: val,
          label: name,
          selected: val === f.value
        }));
      }

      const fieldCtx = {
        key,
        label: def.label,
        type: def.type,
        value: f.value,
        choices,
        min: def.min,
        max: def.max,
        step: def.step
      };

      const sectionId = def.section ?? "appearance";
      if (!grouped.has(sectionId)) grouped.set(sectionId, []);
      grouped.get(sectionId).push(fieldCtx);
    }

    const out = [];
    for (const [id, fields] of grouped) {
      if (!fields.length) continue;
      out.push({
        id,
        label: SECTIONS[id]?.label ?? id,
        fields
      });
    }
    return out;
  }

  /** Capture in-flight form edits into the working copy so re-render keeps them. */
  #captureFormState() {
    if (!this.element) return;
    const FDE = foundry.applications?.ux?.FormDataExtended ?? FormDataExtended;
    const data = new FDE(this.element).object;
    this.#applyFormData(data);
  }

  #applyFormData(data) {
    const expanded = foundry.utils.expandObject(data ?? {});
    const formPresets = expanded.presets ?? {};
    for (const [id, p] of Object.entries(formPresets)) {
      const target = this.#presets[id];
      if (!target) continue;
      if (typeof p.name === "string") target.name = p.name;
      for (const [fk, f] of Object.entries(p.fields ?? {})) {
        const def = FIELD_DEFS[fk];
        if (!def || !target.fields[fk]) continue;

        // Every field is always managed in the new model.
        target.fields[fk].enabled = true;

        if (def.type === "boolean") {
          target.fields[fk].value = !!f.value;
          continue;
        }

        if (f.value !== undefined) {
          let v = f.value;
          if (def.type === "select" || def.type === "number") {
            if (v === "") continue;
            v = Number(v);
          }
          // color stays as a string (empty string applied as null in main.js)
          target.fields[fk].value = v;
        }
      }
    }
  }

  static async #onCreate(_event, _target) {
    this.#captureFormState();
    const preset = emptyPreset(game.i18n.localize("TOKEN_DEFAULTS.Manager.newDefaultName"));
    this.#presets[preset.id] = preset;
    this.render();
  }

  static async #onDelete(_event, target) {
    this.#captureFormState();
    const id = target?.dataset?.presetId;
    if (id) delete this.#presets[id];
    this.render();
  }

  static async #onApplyDefaults(_event, target) {
    const id = target?.dataset?.presetId;
    if (!id || !this.#presets[id]) return;

    const preset = this.#presets[id];
    const { DialogV2 } = foundry.applications.api;
    const confirmed = await DialogV2.confirm({
      window: { title: game.i18n.localize("TOKEN_DEFAULTS.Manager.applyDefaultsConfirmTitle") },
      content: `<p>${game.i18n.format("TOKEN_DEFAULTS.Manager.applyDefaultsConfirm", { name: preset.name })}</p>`,
      rejectClose: false
    }).catch(() => false);
    if (!confirmed) return;

    this.#captureFormState();
    const defaults = BUILTIN_PRESETS[BUILTIN_FOUNDRY_DEFAULT_ID];
    if (!defaults?.fields) return;
    this.#presets[id].fields = foundry.utils.deepClone(defaults.fields);
    this.render();
  }

  static async #onSubmit(_event, _form, formData) {
    this.#applyFormData(formData.object);
    await game.settings.set(MODULE_ID, SETTINGS.PRESETS, this.#presets);
    ui.actors?.render();
  }
}
