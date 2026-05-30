export const MODULE_ID = "token-presets";

export const SETTINGS = {
  PRESETS: "presets",
  DEFAULT_PRESET_ID: "defaultPresetId",
  MANAGED_FIELDS: "managedFields"
};

export const FLAGS = {
  PRESET_ID: "presetId"
};

export const SECTIONS = {
  identity:   { label: "TOKEN_PRESETS.Section.identity" },
  appearance: { label: "TOKEN_PRESETS.Section.appearance" },
  ring:       { label: "TOKEN_PRESETS.Section.ring" },
  vision:     { label: "TOKEN_PRESETS.Section.vision", hint: "TOKEN_PRESETS.Section.visionHint" }
};

export function getRingEffectFlags() {
  const ringClass =
    foundry?.canvas?.placeables?.tokens?.TokenRing ??
    CONFIG?.Token?.ring?.ringClass;
  const effects = ringClass?.effects ?? {};
  const HIDDEN = new Set(["DISABLED", "ENABLED"]);
  return Object.fromEntries(
    Object.entries(effects).filter(
      ([k, v]) => Number.isInteger(v) && v > 0 && !HIDDEN.has(k)
    )
  );
}

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
//Identity
export const FIELD_DEFS = {
  displayName: {
    label: "TOKEN_PRESETS.Field.displayName",
    type: "select",
    section: "identity",
    path: "displayName",
    options: () => CONST.TOKEN_DISPLAY_MODES,
    default: 0
  },
  displayBars: {
    label: "TOKEN_PRESETS.Field.displayBars",
    type: "select",
    section: "identity",
    path: "displayBars",
    options: () => CONST.TOKEN_DISPLAY_MODES,
    default: 0
  },
  disposition: {
    label: "TOKEN_PRESETS.Field.disposition",
    type: "select",
    section: "identity",
    path: "disposition",
    options: () => CONST.TOKEN_DISPOSITIONS,
    default: 0
  },
  actorLink: {
    label: "TOKEN_PRESETS.Field.actorLink",
    type: "boolean",
    section: "identity",
    path: "actorLink",
    default: false
  },
  //Appearance
  scale: {
    label: "TOKEN_PRESETS.Field.Scale",
    type: "number",
    section: "appearance",
    paths: ["texture.scaleX", "texture.scaleY"],
    read: (doc) => Math.abs(foundry.utils.getProperty(doc, "texture.scaleX") ?? 1),
    default: 1,
    min: 0.2,
    max: 3,
    step: 0.05
  },
  tint: {
    label: "TOKEN_PRESETS.Field.tint",
    type: "color",
    section: "appearance",
    path: "texture.tint",
    default: "#ffffff"
  },
  alpha: {
    label: "TOKEN_PRESETS.Field.alpha",
    type: "number",
    section: "appearance",
    path: "alpha",
    default: 1,
    min: 0,
    max: 1,
    step: 0.05
  },
  rotation: {
    label: "TOKEN_PRESETS.Field.rotation",
    type: "number",
    section: "appearance",
    path: "rotation",
    default: 0,
    min: 0,
    max: 360,
    step: 1
  },

  mirrorH: {
    label: "TOKEN_PRESETS.Field.mirrorH",
    type: "boolean",
    section: "appearance",
    apply: mirrorApply("h"),
    read: (doc) => (foundry.utils.getProperty(doc, "texture.scaleX") ?? 1) < 0,
    default: false
  },
  mirrorV: {
    label: "TOKEN_PRESETS.Field.mirrorV",
    type: "boolean",
    section: "appearance",
    apply: mirrorApply("v"),
    read: (doc) => (foundry.utils.getProperty(doc, "texture.scaleY") ?? 1) < 0,
    default: false
  },
  lockRotation: {
    label: "TOKEN_PRESETS.Field.lockRotation",
    type: "boolean",
    section: "appearance",
    path: "lockRotation",
    default: false
  },
  // Ring
  ringEnabled: {
    label: "TOKEN_PRESETS.Field.ringEnabled",
    type: "boolean",
    section: "ring",
    path: "ring.enabled",
    default: false
  },
  ringColor: {
    label: "TOKEN_PRESETS.Field.ringColor",
    type: "color",
    section: "ring",
    path: "ring.colors.ring",
    default: ""
  },
  ringBackground: {
    label: "TOKEN_PRESETS.Field.ringBackground",
    type: "color",
    section: "ring",
    path: "ring.colors.background",
    default: ""
  },
  ringSubjectTexture: {
    label: "TOKEN_PRESETS.Field.ringSubjectTexture",
    hint: "TOKEN_PRESETS.Field.ringSubjectTextureHint",
    type: "image",
    section: "ring",
    path: "ring.subject.texture",
    default: ""
  },
  ringEffects: {
    label: "TOKEN_PRESETS.Field.ringEffects",
    type: "flags",
    section: "ring",
    path: "ring.effects",
    options: getRingEffectFlags,
    default: []
  },
  ringSubjectScale: {
    label: "TOKEN_PRESETS.Field.ringSubjectScale",
    type: "number",
    section: "ring",
    path: "ring.subject.scale",
    default: 1,
    min: 0.5,
    max: 3,
    step: 0.02
  },

  // Vision
  visionEnabled: {
    label: "TOKEN_PRESETS.Field.visionEnabled",
    type: "boolean",
    section: "vision",
    path: "sight.enabled",
    default: false
  },
  visionRange: {
    label: "TOKEN_PRESETS.Field.visionRange",
    type: "number",
    section: "vision",
    path: "sight.range",
    plain: true,
    default: 0,
    min: 0
  },
  visionAngle: {
    label: "TOKEN_PRESETS.Field.visionAngle",
    type: "number",
    section: "vision",
    path: "sight.angle",
    plain: true,
    default: 360,
    min: 0,
    max: 360
  },
  visionMode: {
    label: "TOKEN_PRESETS.Field.visionMode",
    type: "select",
    section: "vision",
    path: "sight.visionMode",
    options: getVisionModeOptions,
    valueType: "string",
    default: "basic"
  }
};

function getVisionModeOptions() {
  const modes = CONFIG?.Canvas?.visionModes ?? {};
  const out = {};
  for (const [id, mode] of Object.entries(modes)) {
    const raw = mode?.label;
    const label = raw ? game.i18n.localize(raw) : id;
    out[label] = id;
  }
  return out;
}

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
      lockRotation:        { enabled: true, value: false },
      // Ring
      ringEnabled:         { enabled: true, value: false },
      ringColor:           { enabled: true, value: "" },
      ringBackground:      { enabled: true, value: "" },
      ringSubjectTexture:  { enabled: true, value: "" },
      ringEffects:         { enabled: true, value: [] },
      ringSubjectScale:    { enabled: true, value: 1 },
      // Vision
      visionEnabled:       { enabled: true, value: false },
      visionRange:         { enabled: true, value: 0 },
      visionAngle:         { enabled: true, value: 360 },
      visionMode:          { enabled: true, value: "basic" }
    }
  }
};

export function getPresetById(id) {
  if (!id) return null;
  if (BUILTIN_PRESETS[id]) return BUILTIN_PRESETS[id];
  const user = game.settings.get(MODULE_ID, SETTINGS.PRESETS) ?? {};
  return user[id] ?? null;
}


export function fieldPaths(def) {
  return def.paths ?? (def.path ? [def.path] : []);
}

export function applyField(def, value, updates, snapshot, doc) {
  if (typeof def.apply === "function") {
    def.apply(value, updates, snapshot, doc);
    return;
  }
  let writeValue = value;
  if ((def.type === "color" || def.type === "image") && writeValue === "") {
    writeValue = null;
  } else if (def.type === "flags") {
    const flagsMap = def.options?.() ?? {};
    let bitmask = 0;
    if (typeof writeValue === "number") {
      bitmask = writeValue;
    } else if (Array.isArray(writeValue) || writeValue instanceof Set) {
      for (const name of writeValue) {
        const bit = flagsMap[name];
        if (typeof bit === "number") bitmask |= bit;
      }
    }
    bitmask |= 1;
    writeValue = bitmask;
  }
  for (const path of fieldPaths(def)) {
    if (snapshot) snapshot[path] = foundry.utils.getProperty(doc, path);
    foundry.utils.setProperty(updates, path, writeValue);
  }
}

export function readFieldValue(def, doc) {
  if (typeof def.read === "function") return def.read(doc);
  const path = def.path ?? def.paths?.[0];
  if (!path) return def.default;
  const v = foundry.utils.getProperty(doc, path);
  return v === undefined ? def.default : v;
}
