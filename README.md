# Token Presets

Create multiple presets to speed up your actor / token creation.

If you've ever found yourself opening Token Config five times every time
you drop a new monster to set the same things - display name on hover,
disposition to hostile, link off - this module is for you.

---

## What you can save in a preset

Each preset can set any combination of:

- Display Name and Display Bars (when names and HP bars show)
- Disposition (Hostile, Neutral, Friendly, Secret)
- Link to actor data
- Lock rotation
- Scale, opacity, rotation
- Mirror horizontally / vertically
- Tint colour
- Dynamic Token Ring - enable on / off, ring and background colours,
  any combination of ring effects (Ring Pulse, Ring Gradient,
  Background Wave, Spectral Pulse, Color Over Subject), and a
  subject-scale slider
- Vision - vision enabled, vision range, vision angle, and vision
  mode (Basic Vision, Darkvision, Tremorsense, etc. — whatever your
  system / modules provide). *Heads up: if another module also
  manages token vision, the field will be disabled in the preset
  manager and that module's behaviour will take precedence.*

You can make as many presets as you like.

---

## Installing the module

1. In Foundry, open **Add-on Modules** → **Install Module**.
2. Paste this link into the box at the bottom:

   ```
   https://raw.githubusercontent.com/DeadPanMatt/token-presets/main/module.json
   ```

3. Click **Install**.
4. In your world, go to **Game Settings → Manage Modules**, tick
   **Token Presets**, and save.

You're ready.

---

## Making a preset

1. Go to **Game Settings → Configure Settings**.
2. Find **Token Presets** in the list and click **Manage Presets**.
3. Click **+ New Preset** at the bottom.
4. Give it a name (like *Hostile Monster*) and set the values you want.
5. Click **Save**.

**Or**

1. Under **Token Controls** Click on the user / Gear icon.
2. Click **Manage / create Presets**.
3. Click **+ New Preset**
4. Give it a name (like *Hostile Monster*) and set the values you want.
5. Click **Save**.

That's it. Your preset is ready to use (read on below for tips).

---

## Using a preset when creating a new actor

When you click **Create Actor** in the sidebar, a small **Token Preset**
dialog pops up. Pick the preset you want, click **Apply**, then fill
in the name and type as normal. The actor is now tagged with that preset,
and every time you drop it onto a scene the preset values are applied
automatically.

If you don't want to use a preset for a particular actor, pick
**- None -** instead. You can always tag the actor with a preset
later via right-click in the sidebar, or via the **Tag Actors with
a Preset** form in the Token Presets hub - see the next section.

---

## Using a preset on actors you already have

Right-click any actor in the sidebar and you'll see **Set Token
Preset…** in the menu. Pick a preset, click Apply, and that actor is now
tagged. Future tokens from that actor will use the preset.

To do a whole folder of actors at once, right-click the folder and pick
**Set Token Preset for All Actors…** - same picker, but it tags every
actor in the folder (and any sub-folders) in one go. It asks for
confirmation first so you know how many actors will be affected.

**Or**, to tag many actors at once across folders, via the Token
Presets hub:

1. Under **Token Controls** click on the user / Gear icon.
2. Click **Tag Actors with a Preset**.
3. *(Optional)* Click a folder in the left tree to narrow the list,
   or type in the search box to filter by name.
4. Click an actor to select. Ctrl-click for multi-select; Shift-click
   for a range; Ctrl+A for everything visible.
5. Pick a preset from the dropdown at the top.
6. Click **Apply** - every selected actor is tagged in one go.

---

## Using a preset on tokens already on the scene

Three ways, depending on what you want to update.

**Just these tokens, right now**, via the Token Presets hub:

1. Under **Token Controls** click on the user / Gear icon.
2. Click **Apply Preset to Canvas Tokens**.
3. *(Optional)* Use the filter buttons on the left (Disposition /
   Link State / Visibility) and/or the search box to narrow the
   list of tokens.
4. Tick the tokens you want. Anything you already had selected on
   the canvas is pre-ticked, so "select first, then click" still
   works.
5. Pick a preset from the dropdown at the top.
6. Click **Apply**.

**Every token of one actor.** Right-click the actor in the sidebar and
choose **Apply Preset to Placed Tokens**. This finds every copy of that
actor across all your scenes and updates them. (Only shows up if the
actor has a preset assigned.)

**Every token of every actor in a folder.** Right-click the folder and
choose **Apply Preset to Placed Tokens (Folder)**. Same idea, but
sweeping through everything in the folder at once.

All three ask for confirmation first and show you how many tokens are
about to change.

---

## Quick mass-edit without saving a preset

Sometimes you just want to change one or two fields on a handful of
tokens and don't want to make a whole preset for it. The **Edit
Selected Tokens (Live)** option does exactly that - one-off changes,
nothing saved (the chnages are only made to the tokens on the scene, not the actors themselves).

1. Select the tokens you want to change on the canvas.
2. Under **Token Controls** click on the user / Gear icon.
3. Click **Edit Selected Tokens (Live)**.
4. A form opens listing every preset field. For each one:
   - If all your selected tokens currently share the same value, that
     value is pre-filled - leave it as-is or change it.
   - If they differ, you'll see **- Mixed -** in the box (or a
     half-filled checkbox for tick-boxes). Leave it as Mixed to
     preserve each token's own value, or set a real value to make
     them all match.
5. Click **Apply**.

**Only the fields you actually change are written.** If you only
ticked Lock Rotation, your tokens' scales, colours and dispositions
stay exactly as they were - even on the ones with mixed values. So
you can mass-fix one thing without trampling everything else.

---

## "Foundry Default" - your reset button

Tucked at the top of the preset manager is a section called **View
Foundry Defaults**. Click to expand it. Inside is a read-only preset
that represents Foundry's vanilla token values - the default look of a
token straight out of the box.

You can't edit it, but you can:

- **Pick it from the picker** anywhere a preset is being chosen, to
  apply Foundry's defaults explicitly.
- **Pick *- None -* from the canvas toolbar surface** - it has the same
  effect, reverting selected tokens to vanilla values.
- **Reset a preset to it.** Each of your custom presets has a small
  **circular arrow** icon next to its name. Click it to overwrite that
  preset with Foundry's defaults - handy when you've made a mess and
  want to start over from a known-good baseline. Asks before
  overwriting.

---

## A few useful tips

- **Sections fold up.** Each preset has Identity, Appearance, Dynamic
  Token Ring, and Vision sections. Click a section header to collapse
  it if it's in the way.
- **A preset applies *every* setting it has.** There's no "leave this
  alone" option - when you apply a preset, all of its values get written
  to the token. So if you want a preset that only changes disposition,
  make sure the other values are also what you'd want (I recommend
  applying Foundry's defaults first).
- **Make presets per actor type.** Most people end up with a few
  templates: one for monsters, one for friendly NPCs, one for the
  party. Pick the right one when you create the actor and you've saved
  yourself a lot of clicking.

---

## Future plans

- **Detection modes and advanced vision.** Vision basics (enabled +
  range) are in; richer controls - detection modes, special vision
  modes, and the rest of the Advanced sight settings - could follow
  if there's interest.

## Found a bug? Have an idea?

Open an issue at
[github.com/DeadPanMatt/token-presets/issues][issues] and let me know
what happened. The more detail the better - what you were trying to do,
what you saw instead, your Foundry version, and your game system
(although that shouldn't really matter).

[issues]: https://github.com/DeadPanMatt/token-presets/issues

---

## Credits

Built by **DeadPanMatt**. MIT licensed.
