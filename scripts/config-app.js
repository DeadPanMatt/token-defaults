import {
  MODULE_ID,
  SETTINGS,
  FIELD_DEFS,
  SECTIONS,
  BUILTIN_PRESETS,
  BUILTIN_FOUNDRY_DEFAULT_ID,
  emptyPreset
} from "./constants.js";
import { applyConflictDisable } from "./conflict-detection.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class PresetManager extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "token-presets-preset-manager",
    tag: "form",
    classes: ["token-presets", "preset-manager"],
    window: {
      title: "TOKEN_PRESETS.Manager.title",
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

  #presets = null;

  #expandedIds = new Set();

  async _prepareContext(_options) {
    if (!this.#presets) {
      const stored = game.settings.get(MODULE_ID, SETTINGS.PRESETS) ?? {};
      this.#presets = foundry.utils.deepClone(stored);
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
      isOpen: this.#expandedIds.has(p.id),
      sections: this.#prepareSections(p)
    }));
    return {
      builtins,
      userPresets,
      buttons: [
        {
          type: "submit",
          icon: "fa-solid fa-save",
          label: "TOKEN_PRESETS.Manager.save"
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
      } else if (def.type === "flags") {
        const flagsMap = def.options?.() ?? {};
        let current = f.value;
        if (typeof current === "number") {
          const bitmask = current;
          current = Object.entries(flagsMap)
            .filter(([, bit]) => (bitmask & bit) === bit)
            .map(([n]) => n);
        }
        if (!Array.isArray(current)) current = [];
        choices = Object.entries(flagsMap).map(([name, bit]) => ({
          name,
          bit,
          label: localizeFlagLabel(name),
          selected: current.includes(name)
        }));
      }

      const fieldCtx = {
        key,
        label: def.label,
        type: def.type,
        plain: !!def.plain,
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
        hint: SECTIONS[id]?.hint ?? null,
        fields
      });
    }
    return out;
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    applyConflictDisable(this.element);
  }

  #captureFormState() {
    if (!this.element) return;
    const FDE = foundry.applications?.ux?.FormDataExtended ?? FormDataExtended;
    const data = new FDE(this.element).object;
    this.#applyFormData(data);
  }

  #captureExpandedState() {
    if (!this.element) return;
    this.#expandedIds.clear();
    for (const details of this.element.querySelectorAll("details.preset[data-preset-id]")) {
      if (details.open) this.#expandedIds.add(details.dataset.presetId);
    }
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

        target.fields[fk].enabled = true;

        if (def.type === "boolean") {
          target.fields[fk].value = !!f.value;
          continue;
        }

        if (def.type === "flags") {

          const flagsMap = def.options?.() ?? {};
          const submitted = f.flags ?? {};
          const selected = [];
          for (const name of Object.keys(flagsMap)) {
            if (submitted[name]) selected.push(name);
          }
          target.fields[fk].value = selected;
          continue;
        }

        if (f.value !== undefined) {
          let v = f.value;
          if (def.type === "select" || def.type === "number") {
            if (v === "") continue;
            if (def.valueType !== "string") v = Number(v);
          }
          target.fields[fk].value = v;
        }
      }
    }
  }

  static async #onCreate(_event, _target) {
    this.#captureExpandedState();
    this.#captureFormState();
    const preset = emptyPreset(game.i18n.localize("TOKEN_PRESETS.Manager.newDefaultName"));
    this.#presets[preset.id] = preset;
    this.#expandedIds.add(preset.id);
    this.render();
  }

  static async #onDelete(_event, target) {
    const id = target?.dataset?.presetId;
    if (!id) return;
    const preset = this.#presets[id];
    if (!preset) return;

    const safeName = Handlebars.escapeExpression(preset.name);
    const { DialogV2 } = foundry.applications.api;
    const confirmed = await DialogV2.confirm({
      window: { title: game.i18n.localize("TOKEN_PRESETS.Manager.deleteConfirmTitle") },
      content: `<p>${game.i18n.format("TOKEN_PRESETS.Manager.deleteConfirm", { name: safeName })}</p>`,
      rejectClose: false
    }).catch(() => false);
    if (!confirmed) return;

    this.#captureExpandedState();
    this.#captureFormState();
    delete this.#presets[id];
    this.#expandedIds.delete(id);
    this.render();
  }

  static async #onApplyDefaults(_event, target) {
    const id = target?.dataset?.presetId;
    if (!id || !this.#presets[id]) return;

    const preset = this.#presets[id];
    const { DialogV2 } = foundry.applications.api;
    const confirmed = await DialogV2.confirm({
      window: { title: game.i18n.localize("TOKEN_PRESETS.Manager.applyDefaultsConfirmTitle") },
      content: `<p>${game.i18n.format("TOKEN_PRESETS.Manager.applyDefaultsConfirm", { name: preset.name })}</p>`,
      rejectClose: false
    }).catch(() => false);
    if (!confirmed) return;

    this.#captureExpandedState();
    this.#captureFormState();
    const defaults = BUILTIN_PRESETS[BUILTIN_FOUNDRY_DEFAULT_ID];
    if (!defaults?.fields) return;
    this.#presets[id].fields = foundry.utils.deepClone(defaults.fields);
    this.#expandedIds.add(id);
    this.render();
  }

  static async #onSubmit(_event, _form, formData) {
    this.#applyFormData(formData.object);
    await game.settings.set(MODULE_ID, SETTINGS.PRESETS, this.#presets);
    ui.actors?.render();
  }
}

function localizeFlagLabel(name) {
  const candidates = [
    `TOKEN.RING.EFFECTS.${name}`,
    `TOKEN.RING_EFFECTS.${name}`,
    `TOKEN.RingEffects.${name}`,
    `TOKEN_RING.EFFECTS.${name}`,
    `TOKEN_RING.effects.${name}`,
    `TOKEN.Ring.Effects.${name}`,
    `CANVAS.TokenRing.Effects.${name}`
  ];
  for (const key of candidates) {
    const localized = game.i18n.localize(key);
    if (localized && localized !== key) return localized;
  }
  return name.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
