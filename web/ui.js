// Copyright 2026 FNG. Use, modification and redistribution are permitted under the conditions in LICENSE:
// credit the source, and visibly link to the site or repository if you use its outputs in a user-facing application.
// Shared page pieces: the type-ahead picker and the recipe result card, used by custom search and the build pages.
import { statAbbr, isSecondary, RANGE_STEMS, WEAPON_SLOTS, materials } from "./stats.js?v=35e09eb329";
import { matsHtml, stepsHtml, tooltipRows, supportsSanctify } from "./recipe.js?v=35e09eb329";

// ---------- keyboard-navigable autocomplete ----------
// source() -> [{html, value}] for the current text; Up/Down move, Enter (or click) picks, Escape closes.

export function combo(input, box, source, emptyText, onPick) {
  let items = [], active = -1;
  const paint = () => {
    box.innerHTML = items.length
      ? items.map((x, i) => `<div role="option" data-i="${i}">${x.html}</div>`).join("") +
        `<div class="keys" aria-hidden="true"><kbd>&uarr;</kbd><kbd>&darr;</kbd> move <kbd>&crarr;</kbd> select <kbd>esc</kbd> close</div>`
      : `<div class="empty">${emptyText}</div>`;
    setActive(active, false);
  };
  // One highlight only: the keyboard and the mouse pointer move the same marker (a resting pointer must not
  // look like a second, competing selection).
  const setActive = (i, scroll) => {
    active = i;
    box.querySelectorAll("[data-i]").forEach((el, k) => {
      el.classList.toggle("active", k === i);
      el.setAttribute("aria-selected", String(k === i));
    });
    const a = box.querySelector(".active");
    if (a && scroll) a.scrollIntoView({ block: "nearest" });
  };
  const open = () => { items = source(); active = items.length ? 0 : -1; paint(); box.hidden = false; input.setAttribute("aria-expanded", "true"); };
  const close = () => { box.hidden = true; input.setAttribute("aria-expanded", "false"); };
  const pick = (i) => { const x = items[i]; if (!x) return; input.value = ""; close(); onPick(x.value); };
  input.addEventListener("input", open);
  input.addEventListener("focus", open);
  input.addEventListener("keydown", (e) => {
    const down = e.key === "ArrowDown" || e.key === "Down", up = e.key === "ArrowUp" || e.key === "Up";
    if (down || up) {
      e.preventDefault();
      if (box.hidden) { open(); return; }
      if (!items.length) return;
      setActive(down ? Math.min(items.length - 1, active + 1) : Math.max(0, active - 1), true);
    } else if (e.key === "Enter") {
      if (!box.hidden && items.length) { e.preventDefault(); pick(Math.max(0, active)); }
    } else if (e.key === "Escape" || e.key === "Tab") {
      close();
    }
  });
  // mousedown (not click) so the pick lands before the input loses focus
  // Only a pointer that really moved counts: browsers also fire a phantom mousemove when the list scrolls or redraws under
  // a resting pointer, which must not steal the highlight back from the arrow keys.
  let px = -1, py = -1;
  box.addEventListener("mousemove", (e) => {
    if (e.clientX === px && e.clientY === py) return;
    px = e.clientX; py = e.clientY;
    const el = e.target.closest("[data-i]");
    if (el && +el.dataset.i !== active) setActive(+el.dataset.i, false);
  });
  box.addEventListener("mousedown", (e) => {
    const el = e.target.closest("[data-i]");
    if (el) { e.preventDefault(); pick(+el.dataset.i); }
  });
  document.addEventListener("click", (e) => { if (e.target !== input && !box.contains(e.target)) close(); });
  return { close };
}

const TAGS = {
  primal:  { best: ["Best", "t-best"], part: ["Finish at Mystic", "t-best"] },
  crafted: { best: ["Best · crafted primal", "t-best"], part: ["Crafted primal · finish at Mystic", "t-best"] },
  ancient: { best: ["Great ancient", "t-ancient"], part: ["Great ancient · finish at Mystic", "t-ancient"] },
  normal:  { best: ["Legendary", "t-normal"], part: ["Legendary · finish at Mystic", "t-normal"] },
};


// heroName(classIndex) -> the hero's display name, for hand-over steps.
export function hitHtml(h, tier, snap, item, cls, season, heroName) {
  const wantStems = new Set(snap);
  const matchedStems = new Set(h.matched.map((i) => snap[i]));
  const missing = snap.filter((_, i) => !h.matched.includes(i));
  const perfect = !missing.length;
  const [tagText, tagCls] = TAGS[tier][perfect ? "best" : "part"];
  // Headline: the requested stats the item rolls (highlighted), then any other PRIMARY stats it rolled; secondary stats only when
  // requested. A recipe that finishes at the Mystic ends with the stat the Mystic is to roll.
  const seen = new Set();
  const parts = [];
  for (const s of snap) {
    if (matchedStems.has(s)) { seen.add(s); parts.push(`<span class="want">${statAbbr(s)}</span>`); }
  }
  const onWeapon = WEAPON_SLOTS.has(item.slot);
  for (const l of h.lines) {
    if (l.stem === "item power" || seen.has(l.stem) || isSecondary(l.stem) || l.stem === "Sockets" || l.stem === "Indestructible") continue;
    if (wantStems.has(l.stem)) continue;
    if (onWeapon && RANGE_STEMS.has(l.stem)) continue;   // every weapon rolls its damage; it is a given, so it stays in the full tooltip
    seen.add(l.stem);
    parts.push(`<span class="extra">${statAbbr(l.stem)}</span>`);
  }
  if (!perfect) parts.push(`<span class="want">then Mystic: ${missing.map((m) => statAbbr(m)).join(" or ")}</span>`);
  const lines = tooltipRows(h.lines).map((r) => {
    const w = wantStems.has(r.stem);
    return `<span class="${w ? "want" : ""}">${r.label}</span><span class="v ${w ? "want" : ""}">${r.value}</span>`;
  }).join("");
  const mats = matsHtml(materials(h));
  const craftedNote = tier === "crafted" ? `<div class="small">Improve Legendary primals: only one can be worn per character.</div>` : "";
  const crucibleNote = tier === "crafted" && supportsSanctify(season)
    ? `<div class="small">Or use an Angelic Crucible for the last step to create a Sanctified item. Its seasonal power replaces an ordinary secondary affix on six-affix items. The listed cost and materials assume Improve Legendary with ashes.</div>` : "";
  return `<article class="hit"><div class="head"><span class="tag ${tagCls}">${tagText}</span><span class="aff">${parts.join(", ")}</span></div>
    ${stepsHtml(h, missing, wantStems, { cls, name: heroName })}${craftedNote}${crucibleNote}<div class="mats">${mats}</div>
    <details class="full"><summary>Full tooltip</summary><div class="lines">${lines}</div></details></article>`;
}
