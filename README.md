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

## Making your first preset

1. Go to **Game Settings → Configure Settings**.
2. Find **Token Presets** in the list and click **Manage Presets**.
3. Click **+ New Preset** at the bottom.
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
**- None -** instead.

---

## Using a preset on actors you already have

Right-click any actor in the sidebar and you'll see **Set Token
Preset…** in the menu. Pick a preset, click Apply, and that actor is now
tagged. Future tokens from that actor will use the preset.

To do a whole folder of actors at once, right-click the folder and pick
**Set Token Preset for All Actors…** - same picker, but it tags every
actor in the folder (and any sub-folders) in one go. It asks for
confirmation first so you know how many actors will be affected.

---

## Using a preset on tokens already on the scene

Three ways, depending on what you want to update.

**Just these tokens right now.** Select one or more tokens on the canvas
(shift-click or drag a box to multi-select), then click the **user-gear
icon** in the left-hand toolbar under Token Controls. Pick a preset,
click Apply, done.

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

- **Sections fold up.** Each preset has Identity and Appearance
  sections. Click a section header to collapse it if it's in the way.
- **A preset applies *every* setting it has.** There's no "leave this
  alone" option - when you apply a preset, all of its values get written
  to the token. So if you want a preset that only changes disposition,
  make sure the other values are also what you'd want (I recomend applyingFoundries defaults first).
- **Make presets per actor type.** Most people end up with a few
  templates: one for monsters, one for friendly NPCs, one for the
  party. Pick the right one when you create the actor and you've saved
  yourself a lot of clicking.

---

## Future plans

-**Dynamic Token Ring.** Add Dynamic Token Ring settings to preset menu.
-**Vission.** Add Vision controls (Basic, Detection and Advcnaced) to the preset menu 

## Found a bug? Have an idea?

Open an issue at
[github.com/DeadPanMatt/token-presets/issues][issues] and let me know
what happened. The more detail the better - what you were trying to do,
what you saw instead, your Foundry version, and your game system (although this shou not really matter).

[issues]: https://github.com/DeadPanMatt/token-presets/issues

---

## Credits

Built by **DeadPanMatt**. MIT licensed.
