// Copyright 2026 FNG. Use, modification and redistribution are permitted under the conditions in LICENSE:
// credit the source, and visibly link to the site or repository if you use its outputs in a user-facing application.
// Recipe rendering shared by the custom search (app.js) and the prepared builds (builds.js).
import { statName, statAbbr, isSecondary, RANGE_STEMS, fmtValue, materials, MATERIAL_ICONS, MATERIAL_GROUPS, SLOT_NAMES } from "./stats.js?v=f7f0c3826d";

const slotName = (s) => SLOT_NAMES[s] || s;

const PLURAL_FIX = { "Chest Armor": "chest armor pieces", Pants: "pants", Boots: "boots", Gloves: "gloves", Bracers: "bracers", Shoulders: "shoulders", Source: "sources" };
export function slotPlural(slot, n) {
  const s = slotName(slot);
  if (n === 1) {
    const one = s.replace(/^(.*) \((\dH)\)$/, "$2 $1");
    return one.toLowerCase().replace(/^(\dh)/, (m) => m.toUpperCase());
  }
  if (PLURAL_FIX[s]) return PLURAL_FIX[s];
  const m = /^(.*) \((\dH)\)$/.exec(s);
  const base = (m ? m[1] : s).toLowerCase();
  const pl = /(s|x)$/.test(base) ? base : base + "s";
  return m ? `${m[2]} ${pl}` : pl;
}

// The icons ship with the page; the coloured abbreviation tile underneath only shows if one fails to load.
const iconsPresent = true;

export function matIconHtml(name, qty) {
  const ic = MATERIAL_ICONS[name] || { file: "", abbr: name.slice(0, 2), color: "#666" };
  return `<span class="mat" title="${name}: ${qty.toLocaleString("en-US")}" aria-label="${name}: ${qty.toLocaleString("en-US")}">` +
    `<span class="fb" style="background:${ic.color}">${ic.abbr}</span>` +
    (ic.file && iconsPresent ? `<img src="icons/${ic.file}" alt="" onload="this.previousElementSibling.remove()" onerror="this.remove()">` : "") +
    `<span class="n">${qty.toLocaleString("en-US")}</span></span>`;
}

// One wide icon for a group of materials that all appear with the same count (the three crafting grades, the five legendary
// materials); anything else stays a single tile. `m` is materials(h): {name: quantity}.
export function matsHtml(m) {
  const out = [];
  const grouped = new Set();
  // Always the same order: Death's Breath, the three crafting grades, the five legendary materials, Forgotten Souls, Primordial Ashes.
  const ORDER = ["Death's Breath", ...MATERIAL_GROUPS[0].names, ...MATERIAL_GROUPS[1].names, "Forgotten Soul", "Primordial Ashes"];
  const rank = (n) => (ORDER.includes(n) ? ORDER.indexOf(n) : ORDER.length);
  for (const [name, qty] of Object.entries(m).sort((a, b) => rank(a[0]) - rank(b[0]))) {
    if (grouped.has(name)) continue;
    const g = MATERIAL_GROUPS.find((x) => x.names.includes(name) && x.names.every((n) => m[n] === qty));
    if (!g) { out.push(matIconHtml(name, qty)); continue; }
    g.names.forEach((n) => grouped.add(n));
    const label = `${g.names.join(", ")}: ${qty.toLocaleString("en-US")} each`;
    out.push(`<span class="mat wide" title="${label}" aria-label="${label}"><img src="icons/${g.file}" alt="">` +
      `<span class="n">${qty.toLocaleString("en-US")}</span></span>`);
  }
  return out.join("");
}

const OP_TEXT = { R: (n) => `Reforge &times;${n}`, P: (n) => `Improve with ashes &times;${n}`, C: (n) => `Convert &times;${n}` };

const MAIN = new Set(["Str", "Dex", "Int", "StrDex", "StrInt", "StrVit", "DexInt", "DexVit", "IntVit"]);

// What to look for at a checkpoint: its main-stat roll (falls back to the first real line), plus the item's name when it
// changed (Convert Set Item) and "ancient"/"primal" when that is what the item is at that point.
export function stopOn(cp, prev) {
  const lines = cp.lines.filter((l) => l.stem !== "item power" && l.stem !== "Sockets" && l.stem !== "Indestructible");
  const main = lines.find((l) => MAIN.has(l.stem)) || lines[0];
  const val = main ? `${fmtValue(main.stem, main.value)} ${statAbbr(main.stem)}` : "";
  const prefix = !prev || cp.name !== prev.name ? cp.name : (cp.quality === "ancient" || cp.quality === "primal") ? cp.quality : "";
  return prefix && val ? `${prefix} w/ ${val}` : (prefix || val);
}

// Can the Mystic add every `missing` stat? It rerolls a line the player does not need, within the same kind: a primary
// target needs a spare primary, a secondary target a spare secondary (the real reroll pools are finer than this, so the
// check stays simple). The weapon-damage range is never counted: rolling off it is almost always a mistake.
export function mysticCanFinish(h, missing, wantStems) {
  const spare = h.lines.filter((l) => l.stem !== "item power" && l.stem !== "Indestructible" && !RANGE_STEMS.has(l.stem) && !wantStems.has(l.stem));
  const sec = spare.filter((l) => isSecondary(l.stem)).length;
  const need = { sec: missing.filter((m) => isSecondary(m)).length, pri: missing.filter((m) => !isSecondary(m)).length };
  return spare.length - sec >= need.pri && sec >= need.sec;
}

export function stepsHtml(h, missing, wantStems) {
  const out = [];
  const cps = h.checkpoints || [];
  // Long steps say what to stop on (any count above 7): a player may pass the same item several times on the way,
  // and the roll of its main stat tells the right one apart.
  const hopeNote = (h.hope > 7 || h.route.some(([op]) => op === "C") || h.root_name !== h.name) && cps[0]
    ? ` <span class="note">(stop on ${stopOn(cps[0], null)})</span>` : "";
  out.push(`Craft &amp; upgrade ${h.hope} ${slotPlural(h.slot, h.hope)}${hopeNote}`);
  h.route.forEach(([op, n], k) => {
    const last = k === h.route.length - 1;
    const cp = cps[k + 1];
    const note = n > 7 && !last && cp ? ` <span class="note">(stop on ${stopOn(cp, cps[k])})</span>` : "";
    out.push((OP_TEXT[op] || (() => op))(n) + note);
  });
  if (missing.length) {
    out.push(`Mystic: roll ${missing.map((m) => statName(m)).join(" or ")}`);
  }
  return `<ul class="steps">${out.map((s) => `<li>${s}</li>`).join("")}</ul>`;
}

// Full-tooltip rows. A weapon-damage roll arrives as two lines (minimum, then the spread added on top); show one "min–max" row.
export function tooltipRows(lines) {
  const rows = [];
  const num = (v) => Math.round(v).toLocaleString("en-US");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.stem === "item power") continue;
    if (RANGE_STEMS.has(l.stem) && lines[i + 1] && lines[i + 1].stem === l.stem) {
      rows.push({ stem: l.stem, label: statName(l.stem).replace(" (weapon)", ""), value: `${num(l.value)}–${num(l.value + lines[i + 1].value)}` });
      i += 1;
    } else {
      rows.push({ stem: l.stem, label: statName(l.stem), value: l.max === 0 && l.value === 0 ? "" : fmtValue(l.stem, l.value) });
    }
  }
  // Major affixes first: weapon damage, then main stats, then the other primaries, then the secondaries (gold find and the like).
  const rank = (r) => (RANGE_STEMS.has(r.stem) ? 0 : MAIN.has(r.stem) ? 1 : isSecondary(r.stem) ? 3 : 2);
  return rows.map((r, i) => [r, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map((x) => x[0]);
}
