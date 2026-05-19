# Changelog

What's new in **Token Defaults** - a Foundry VTT module that lets you save
named token presets (display name, disposition, scale, tint, and more) and
apply them automatically to new actors, in bulk to existing ones, or
directly to tokens already on the canvas.

---

## 0.11.1 - Fix: dispositions (and other fields) not applying

Presets created before the 0.11.0 control-style change carried a leftover
"Don't change" flag in the saved data on some fields, even though the
manager no longer shows it. The apply path was honouring that flag and
silently skipping those fields when you applied a preset to existing
tokens - so e.g. picking a preset with disposition set to Hostile
wouldn't actually change the token's disposition.

Fixed. Existing presets now apply every field they have a value for,
matching what the manager shows.

---

## 0.11.0 - Foundry-style field controls

The preset manager now uses controls that match Foundry's own Token Config
dialog:

- **Booleans** (Lock Rotation, Mirror H/V, Link Actor Data) are now a
  single Foundry-style checkbox: ticked = on, unticked = off.
- **Drop-downs** (Display Name, Disposition, etc.) appear on their own
  with no separate "enable" tick-box - same as Foundry.
- **Sliders and colour pickers** likewise drop the side-checkbox.

**What this means for your presets:** every field in a preset now always
applies. Previously you could mark a field as "Don't change" so the preset
left it alone - that option is gone. If you have older presets where you
relied on that, those fields will now apply whatever value was stored
(usually Foundry's default). Opening and saving an existing preset
upgrades it to the new model.

If you find yourself wanting "don't change this field" back, the simplest
workaround is just to make a second preset.

---

## 0.10.1 - Trimmed Token Ring

The **Token Ring** options (enable, subject texture, colors, effects) have
been removed. In practice these settings vary too much per-actor to be
useful as a shared default - better handled in the Token Config dialog
case by case.

Any presets you saved that included ring values will keep working; the ring
data just sits ignored until you next save the preset, at which point it's
cleaned up.

---

## 0.10.0 - Bigger preset manager

Big visual update to the preset manager.

- Each preset's fields are now **grouped into collapsible sections** -
  *Identity* and *Appearance* - so the list isn't a flat wall of controls.
- **New Appearance fields**:
  - **Tint Color** (with a colour picker)
  - **Alpha / Opacity** (slider 0–1)
  - **Rotation** (slider 0–360°)
  - **Mirror Horizontal** and **Mirror Vertical** (tri-state)
- The preset list now **scrolls properly** inside the window. No more
  controls running off the bottom of the dialog.
- Mirror works correctly alongside Scale - if a preset sets both, the
  mirror flips whatever scale value would have been written.

---

## 0.9.0 - Better boolean controls

Boolean fields (Lock Rotation, Link Actor Data, Mirror, etc.) now show a
clear three-option drop-down:

- **Don't change** - leave whatever the token already has
- **Force on**
- **Force off**

This replaces the old single-checkbox UI, which couldn't tell the
difference between "force off" and "ignore this field." If you had presets
where these settings looked wrong (e.g. all checkboxes ticked after using
Apply Foundry Defaults), this fixes them - open each preset, pick the
state you actually want, and save.

---

## 0.8.0 - View and apply defaults

- The built-in **Foundry Default** preset is now tucked behind a
  **"View Foundry Defaults"** disclosure at the top of the manager.
  Click to expand and see what values it forces; collapse it when you're
  done.
- Each of your custom presets has a new **rotate-left icon** in its
  header. Click it to overwrite that preset's values with the Foundry
  defaults - useful if you want to start fresh from a known-good baseline.
  A confirmation dialog asks before overwriting.

---

## 0.7.0 - Scale field

- New **Scale** field with a proper slider + numeric input, matching the
  control you see in Foundry's own Token Config dialog. Ranges from 0.2×
  to 3× in 0.05 steps.
- Behind the scenes, Scale writes to both axes so tokens scale uniformly
  the way you'd expect.

---

## 0.6.0 - A built-in "Foundry Default" preset

- The module now ships with a read-only **Foundry Default** preset that
  represents Foundry's vanilla token values.
- When you use the **Apply Preset to Selection** toolbar button and pick
  **"- None -"**, your selected tokens now get reverted to those vanilla
  values, instead of nothing happening. This is the answer to "how do I
  undo a preset I applied" until a dedicated undo lands.
- The preset picker now organises options into **Built-in** and **Custom**
  groups so the built-ins are clearly distinct from your own presets.

---

## 0.5.1 - Fix: toolbar applied twice

The "Apply Token Preset to Selection" toolbar button fired its picker
dialog twice per click on Foundry V13/V14. Fixed.

---

## 0.5.0 - Apply presets to tokens already on the canvas

Until now, presets only affected tokens **when they were placed**. This
release adds three ways to update tokens that are already on a scene:

- **Token Controls toolbar**: select one or more tokens, click the new
  user-gear icon under the token tools, pick a preset, done. Doesn't
  require the actor to be tagged with anything.
- **Right-click an actor** in the sidebar → **Apply Preset to Placed
  Tokens**. Finds every placement of that actor across all your scenes and
  updates them to match the actor's tagged preset. Confirmation dialog
  shows the total count before any changes are made. *(Only appears for
  actors that have a preset assigned.)*
- **Right-click a folder** → **Apply Preset to Placed Tokens (Folder)** -
  bulk version. Walks every tagged actor in the folder and updates all
  their placements at once.

The previous values are saved on each updated token, so a future "Undo
last push" button will be able to restore them.

---

## 0.4.0 - Picker appears first, plus retroactive tagging

Two changes:

**Preset picker now comes before the actor dialog.** When you click
*Create Actor*, the preset picker appears first; you pick a preset (or
cancel to abort); then Foundry's normal name/type dialog runs; then you
fill in the sheet. This way the preset choice is out of the way *before*
you start working, instead of being the last thing you do (and forgetting).

**Tag existing actors.** Two new context-menu options:

- **Right-click any actor** → **Set Token Preset…** opens the picker with
  the actor's current preset pre-selected. Pick something else to change
  it, pick "- None -" to clear, or cancel to leave it alone.
- **Right-click any actor folder** → **Set Token Preset for All Actors…**
  applies the same picker to every actor in the folder (and any
  sub-folders), with a count-based confirmation before saving.

Note: these only affect **future** token placements. Tokens already on
scenes are not touched - that's the v0.5 feature above.

---

## 0.3.0 - Preset picker dialog

The Actors sidebar **default-preset dropdown was removed**. It was too
easy to forget about, and most users never noticed it.

In its place: when you click **Create Actor**, a preset picker dialog now
appears as part of the flow. The picker remembers your last choice, so
creating a batch of similar actors is one extra click each.

Compendium imports and scripted/D&D-Beyond-importer actor creations don't
hit the picker - those bypass the manual create path. To preset those
actors, right-click them and use *Set Token Preset…* (added in 0.4.0).

---

## 0.2.0 - Simpler boolean controls

Boolean fields (Lock Rotation, Link Actor Data) used to have **two**
checkboxes - one to "enable" the field and another for the value. This
was confusing. Replaced with a single checkbox per field. (Later replaced
again with a three-option drop-down in 0.9.0 to handle "force off"
properly.)

---

## 0.1.2 - Fix: preset edits not saving

Most of what you edited in the preset manager - checkbox states, dropdown
selections - wasn't actually saving. Only the preset name persisted. This
release fixes the underlying template bug that caused it.

---

## 0.1.1 - Fix: preset manager wouldn't open

Clicking *Manage Presets* threw a console error and the window never
appeared. Fixed.

---

## 0.1.0 - First working version

The module's core loop is in place:

- **Preset manager** in module settings. Create, name, edit, and delete
  presets.
- **Five fields per preset**: Display Name, Display Bars, Disposition,
  Link Actor Data, Lock Rotation. Each field can be individually enabled
  or left alone, so a preset can manage only the bits you care about.
- **Default preset dropdown** in the Actors sidebar header (later
  replaced).
- **Automatic application**: actors tagged with a preset get the preset's
  values applied to their token every time they're placed on a scene.

---

## 0.0.1 - Initial release

Module skeleton - manifest and empty file structure. Nothing functional
yet; first usable version is 0.1.0.
