import { MODULE_ID, SETTINGS, FIELD_DEFS, emptyPreset } from "./constants.js";

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
      deletePreset: PresetManager.#onDelete
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
    }
    return {
      presets: Object.values(this.#presets).map((p) => ({
        id: p.id,
        name: p.name,
        fields: this.#prepareFields(p)
      })),
      buttons: [
        {
          type: "submit",
          icon: "fa-solid fa-save",
          label: "TOKEN_DEFAULTS.Manager.save"
        }
      ]
    };
  }

  #prepareFields(preset) {
    const out = [];
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
      out.push({
        key,
        label: def.label,
        type: def.type,
        enabled: !!f.enabled,
        value: f.value,
        choices
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
        target.fields[fk].enabled = !!f.enabled;
        if (f.value !== undefined && f.value !== "") {
          let v = f.value;
          if (def.type === "select") v = Number(v);
          if (def.type === "boolean") v = !!v;
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

  static async #onSubmit(_event, _form, formData) {
    this.#applyFormData(formData.object);
    await game.settings.set(MODULE_ID, SETTINGS.PRESETS, this.#presets);
    ui.actors?.render();
  }
}
