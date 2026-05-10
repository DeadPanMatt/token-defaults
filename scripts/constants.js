export const MODULE_ID = "token-defaults";

export const SETTINGS = {
  PRESETS: "presets",
  DEFAULT_PRESET_ID: "defaultPresetId"
};

export const FLAGS = {
  PRESET_ID: "presetId"
};

export const FIELD_DEFS = {
  displayName: {
    label: "TOKEN_DEFAULTS.Field.displayName",
    type: "select",
    path: "displayName",
    options: () => CONST.TOKEN_DISPLAY_MODES,
    default: 0
  },
  displayBars: {
    label: "TOKEN_DEFAULTS.Field.displayBars",
    type: "select",
    path: "displayBars",
    options: () => CONST.TOKEN_DISPLAY_MODES,
    default: 0
  },
  disposition: {
    label: "TOKEN_DEFAULTS.Field.disposition",
    type: "select",
    path: "disposition",
    options: () => CONST.TOKEN_DISPOSITIONS,
    default: 0
  },
  actorLink: {
    label: "TOKEN_DEFAULTS.Field.actorLink",
    type: "boolean",
    path: "actorLink",
    default: false
  },
  lockRotation: {
    label: "TOKEN_DEFAULTS.Field.lockRotation",
    type: "boolean",
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
