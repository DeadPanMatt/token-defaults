export const MODULE_ID = "token-defaults";

export const SETTINGS = {
  PRESETS: "presets",
  DEFAULT_PRESET_ID: "defaultPresetId"
};

export const FLAGS = {
  PRESET_ID: "presetId"
};

/**
 * Section ids drive the collapsible groups in the preset manager UI.
 * Order here determines display order.
 */
export const SECTIONS = {
  identity:   { label: "TOKEN_DEFAULTS.Section.identity" },
  appearance: { label: "TOKEN_DEFAULTS.Section.appearance" }
};

// Mirror fields don't map to a single path — they sign-flip whatever
// scaleX/scaleY is, so they compose with the `scale` field.
function mirrorApply(axis) {
  const path = axis === "h" ? "texture.scaleX" : "texture.scaleY";
  return (value, updates, snapshot, doc) => {
    const inProgress = foundry.utils.getProperty(updates, path);
    const current = inProgress ?? foundry.utils.getProperty(doc, path) ?? 1;
    const magnitude = Math.abs(current);
    if (snapshot) snapshot[path] = foundry.utils.getProperty(doc, path);
    foundry.utils.setProperty(updates, path, value ? -magnitude : magnitude);
  };
}

export const FIELD_DEFS = {
  // --- Identity ---
  displayName: {
    label: "TOKEN_DEFAULTS.Field.displayName",
    type: "select",
    section: "identity",
    path: "displayName",
    options: () => CONST.TOKEN_DISPLAY_MODES,
    default: 0
  },
  displayBars: {
    label: "TOKEN_DEFAULTS.Field.displayBars",
    type: "select",
    section: "identity",
    path: "displayBars",
    options: () => CONST.TOKEN_DISPLAY_MODES,
    default: 0
  },
  disposition: {
    label: "TOKEN_DEFAULTS.Field.disposition",
    type: "select",
    section: "identity",
    path: "disposition",
    options: () => CONST.TOKEN_DISPOSITIONS,
    default: 0
  },
  actorLink: {
    label: "TOKEN_DEFAULTS.Field.actorLink",
    type: "boolean",
    section: "identity",
    path: "actorLink",
    default: false
  },

  // --- Appearance ---
  scale: {
    label: "TOKEN_DEFAULTS.Field.Scale",
    type: "number",
    section: "appearance",
    // Foundry's "scale" input is a UX convenience; the document schema has
    // separate scaleX/scaleY. Writing both keeps tokens uniformly scaled.
    paths: ["texture.scaleX", "texture.scaleY"],
    default: 1,
    min: 0.2,
    max: 3,
    step: 0.05
  },
  tint: {
    label: "TOKEN_DEFAULTS.Field.tint",
    type: "color",
    section: "appearance",
    path: "texture.tint",
    default: "#ffffff"
  },
  alpha: {
    label: "TOKEN_DEFAULTS.Field.alpha",
    type: "number",
    section: "appearance",
    path: "alpha",
    default: 1,
    min: 0,
    max: 1,
    step: 0.05
  },
  rotation: {
    label: "TOKEN_DEFAULTS.Field.rotation",
    type: "number",
    section: "appearance",
    path: "rotation",
    default: 0,
    min: 0,
    max: 360,
    step: 1
  },
  // Mirror must follow `scale` in declaration order so the sign flip
  // composes with any preset-driven scale value applied earlier.
  mirrorH: {
    label: "TOKEN_DEFAULTS.Field.mirrorH",
    type: "boolean",
    section: "appearance",
    apply: mirrorApply("h"),
    default: false
  },
  mirrorV: {
    label: "TOKEN_DEFAULTS.Field.mirrorV",
    type: "boolean",
    section: "appearance",
    apply: mirrorApply("v"),
    default: false
  },
  lockRotation: {
    label: "TOKEN_DEFAULTS.Field.lockRotation",
    type: "boolean",
    section: "appearance",
    path: "lockRotation",
    default: false
  }
};

export function emptyPreset(name = "New Preset") {
  const fields = {};
  for (const [key, def] of Object.entries(FIELD_DEFS)) {
    fields[key] = { enabled: false, value: def.default };
  }
  return {
    id: foundry.utils.randomID(),
    name,
    fields
  };
}

// Built-in read-only presets. These are not stored in settings; they're shipped with
// the module and shown alongside user presets. The "foundry-default" entry is what
// "None" reverts to on canvas surfaces.
export const BUILTIN_FOUNDRY_DEFAULT_ID = "builtin:foundry-default";

export const BUILTIN_PRESETS = {
  [BUILTIN_FOUNDRY_DEFAULT_ID]: {
    id: BUILTIN_FOUNDRY_DEFAULT_ID,
    name: "Foundry Default",
    builtin: true,
    fields: {
      // Identity
      displayName:         { enabled: true, value: 0 },
      displayBars:         { enabled: true, value: 0 },
      disposition:         { enabled: true, value: 0 },
      actorLink:           { enabled: true, value: false },
      // Appearance
      scale:               { enabled: true, value: 1 },
      tint:                { enabled: true, value: "#ffffff" },
      alpha:               { enabled: true, value: 1 },
      rotation:            { enabled: true, value: 0 },
      mirrorH:             { enabled: true, value: false },
      mirrorV:             { enabled: true, value: false },
      lockRotation:        { enabled: true, value: false }
    }
  }
};

/** Resolve a preset id against builtins first, then user-defined presets. */
export function getPresetById(id) {
  if (!id) return null;
  if (BUILTIN_PRESETS[id]) return BUILTIN_PRESETS[id];
  const user = game.settings.get(MODULE_ID, SETTINGS.PRESETS) ?? {};
  return user[id] ?? null;
}
