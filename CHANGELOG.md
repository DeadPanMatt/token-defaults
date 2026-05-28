# Changelog

What's new in **Token Presets** - a Foundry VTT module that lets you save
named token presets (display name, disposition, scale, tint, and more) and
apply them automatically to new actors, in bulk to existing ones, or
directly to tokens already on the canvas.

---

## 0.17.0 - Vision section, plus a couple of live-edit polishes

**New: Vision section in the preset manager.** Presets can now set:

- **Vision Enabled** - whether the token can see.
- **Vision Range** - in scene units, 0–500.

This appears as a fourth section in the preset manager (after Identity,
Appearance, and Dynamic Token Ring) and is also available in the live
edit form.

> **Heads up:** if another module also manages token vision (vision
> overhauls, dynamic-lighting suites, perception-system rewrites, etc.)
> its behaviour may override what this preset writes. Foundry-default
> vision is the only case guaranteed to work as you'd expect.

**Live-edit polishes:**

- The form body now **scrolls inside the window** if the field list is
  taller than the dialog. Previously it would just clip the bottom.
- If you click **Edit Selected Tokens (Live)** without anything
  selected, you now get a small pop-up explaining what to do (with an
  **OK** button) instead of a fleeting toast notification.

---

## 0.16.0 - Edit selected tokens directly, no preset needed

A new **Edit Selected Tokens (Live)** option in the Token Presets hub
opens a one-shot edit form for whatever tokens you have selected on the
canvas. Same field set as the preset manager (Identity, Appearance,
Dynamic Token Ring) but the values you enter go straight to the
selected tokens - no preset is saved.

The form shows the **current value** of each field when all selected
tokens agree on it, or **-Mixed-** when they differ:

- Drop-downs show "— Mixed —" at the top when tokens disagree on the
  value; pick a real option to set them all the same.
- Checkboxes (and individual Ring Effect bits) render in their native
  three-state mode: ticked / unticked / indeterminate. Leave one
  indeterminate to leave that field alone on each token.
- Numbers and colours show a "mixed" placeholder when tokens differ.

Only fields you actually change get written. So if you select five
tokens with different scales and just tick the **Lock Rotation** box,
the five different scales are preserved - only Lock Rotation flips.

Use it when:

- You want to recolour a handful of summons all at once without making
  a preset.
- You realised mid-session that your party tokens need their disposition
  fixed and don't want to right-click each one.
- You want a quick way to tweak ring effects on a group without
  visiting Token Config five times.

To open it: select your tokens on the canvas first, then click the
user-gear icon in Token Controls and pick **Edit Selected Tokens
(Live)**. If you forget to select anything, the option just warns and
bails.

---

## 0.15.1 - Filter dialogs now grow with the window

When you drag the **Apply Preset to Canvas Tokens** or **Tag Actors
with a Preset** dialog to be taller, the folder/filter pane on the left
and the actor / token list on the right now stretch with it, and the
Apply / Cancel buttons ride the bottom edge of the window. Before this,
making the dialog taller just left empty space below the buttons - the
contents stayed at their original height no matter how big the window
got.

---

## 0.15.0 - Dynamic Token Ring is back

A new **Dynamic Token Ring** section appears in the preset manager
(removed in 0.10.1, brought back now that Foundry V14 has settled on
its schema):

- **Ring Enabled** - toggle the ring on or off.
- **Ring Color** and **Background Color** - colour pickers for both.
- **Ring Effects** - tick any combination of Ring Pulse, Ring Gradient,
  Background Wave, Spectral Pulse, and Color Over Subject. Same options
  and the same labels as Foundry's own Token Config dialog.
- **Subject Scale Correction** - slider from 0.5× to 3×.

The subject texture path isn't a preset field; it's usually different
per actor so a shared preset wouldn't really help. Set it in Token
Config when you need to.

A couple of related visual changes that came along for the ride:

- Each preset section (Identity, Appearance, Dynamic Token Ring) now
  renders as a bordered fieldset with a header, so it's clearer at a
  glance which fields belong to which section.
- Effect labels are pulled from Foundry's own translations, so what
  you see in the preset manager matches Foundry's default Token Config
  dialog exactly - including V14's rename of one of the effects to
  "Spectral Pulse".

---

## 0.14.0 - Filter canvas tokens by disposition, link state, or visibility

The "Apply Preset to Canvas Tokens" dialog now uses a **token-attribute
filter** on its left pane instead of the folder tree. Folders don't
really apply to tokens already placed on the scene, so the filter
options are now things that *do* apply to placed tokens:

- **Disposition:** Hostile / Neutral / Friendly / Secret
- **Link State:** Linked / Unlinked
- **Visibility:** Visible / Hidden

Click one to filter, click "All Tokens" at the top to clear. Combines
with the search box on the right as before.

The "Tag Actors with a Preset" dialog keeps its folder tree, since
that one really is operating on actors.

---

## 0.13.5 - Fix: hint text in the filter dialogs overflowing

The little grey hint paragraph under the actor/token list ("Ctrl-click
or Shift-click…") wasn't wrapping correctly and could push off the
right side of the dialog. It now wraps cleanly inside its pane, and
the hint text itself has been shortened to be a bit easier to read at
a glance.

---

## 0.13.4 - Right-click to create folders, plus an overflow fix

- **Right-click any folder row** in the tree to get a small "New Folder
  here" pop-up. Clicking it creates a sub-folder under the one you
  right-clicked, via Foundry's standard folder dialog.
- **Fix:** the preset drop-down at the top of the filter dialogs could
  overflow the dialog's width when preset names were long, pushing text
  out of view. The form rows are now properly constrained to the dialog
  width.

---

## 0.13.3 - Resizable dialog, draggable splitter, search box

Three quality-of-life additions to the filter dialogs:

- **The dialog is now resizable.** Drag the bottom-right corner to make
  it bigger if long actor or token names are being cut off.
- **A draggable splitter** sits between the folder tree and the list -
  click and drag it left/right to give either pane more room.
- **A search box** above the list filters by name as you type. Combines
  with the folder filter, so you can pick a folder and then narrow
  further by typing part of a name.

---

## 0.13.2 - Explorer-style layout for the filter dialogs

The "Apply Preset to Canvas Tokens" and "Tag Actors with a Preset"
dialogs are now laid out like a small Windows Explorer window: the
folder tree sits on the left, the actor / token list takes the rest of
the width on the right. Picking a folder filters the right pane.

Scales much better when you have a deep folder hierarchy - you can see
both the tree and the list contents at the same time without scrolling
back and forth. Dialog width bumped to 720px to fit comfortably.

---

## 0.13.1 - Folder filter is now a proper tree

The folder filter in both "Apply Preset to Canvas Tokens" and "Tag
Actors with a Preset" has been replaced with a small tree view, the way
Foundry's own Actors sidebar works:

- Each folder has its own chevron - click to expand or collapse.
- Click a folder name to filter the list to that folder (and its
  sub-folders).
- A **+ New Folder** button at the top of the tree creates a new actor
  folder via Foundry's standard folder dialog. If a folder is selected
  when you click it, the new folder is created inside that one;
  otherwise it goes at the root.
- The tree refreshes automatically when folders are created, renamed,
  or deleted - whether from the dialog or from the sidebar.

---

## 0.13.0 - Landing window and folder filters

The user-gear button in Token Controls now opens a small **Token
Presets** hub window instead of jumping straight into a single action.
From the hub you can:

- **Manage Presets** - opens the preset manager.
- **Apply Preset to Canvas Tokens** - opens the multi-token picker.
- **Tag Actors with a Preset** - opens a new dialog where you can
  multi-select actors from anywhere in your world and tag them all with
  one preset in one go.

The hub window stays open while you work, so you can run a few actions
in sequence without re-opening it. Close it with the X when you're done.

Both the canvas-tokens picker and the tag-actors picker also get a
**Folder** drop-down at the top that mirrors your Actors sidebar
hierarchy. Pick a folder and the list filters down to actors (or tokens
of actors) in that folder or any of its sub-folders. "(Uncategorized)"
catches anything without a folder; "All folders" is the default.

---

## 0.12.1 - Collapsible presets and delete confirmation

Two small manager tweaks for users who keep a lot of presets:

- **Each saved preset can now be collapsed** with a chevron next to its
  name. Useful when you're tweaking one preset and don't want the others
  filling the window. The header (name + reset + delete) stays visible
  when collapsed.
- **The delete button now asks for confirmation** before removing a
  preset, with a "Delete preset 'X'? This cannot be undone." dialog.

---

## 0.12.0 - Renamed to "Token Presets" and a friendlier toolbar dialog

The module's id and name changed from **Token Defaults** to **Token
Presets**. There was already a separate "Token Defaults" module in
Foundry's ecosystem, so the rename avoids confusion. If you're upgrading
from a previous version, you'll need to re-tag any actors and re-create
any presets - the world data was tied to the old module id.

Alongside the rename, the toolbar button now opens a dialog that shows
**every token currently on the scene** in a multi-select list, instead
of silently operating on whatever's selected on the canvas. You can
Ctrl/Cmd-click to toggle individual tokens, Shift-click for a range,
Ctrl+A for everything. Whatever you already had selected on the canvas
is pre-checked when the dialog opens, so the old workflow (select first,
then click toolbar) still works.

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
