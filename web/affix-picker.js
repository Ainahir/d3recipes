export function combo(input, box, source, emptyText, onPick) {
  const controller = new AbortController();
  const on = (target, type, listener) => target.addEventListener(type, listener, {signal:controller.signal});
  let items = [], active = -1;
  const paint = () => {
    const children = items.map((item, i) => {
      const option = document.createElement('div');
      option.setAttribute('role', 'option');option.dataset.i = String(i);option.textContent = item.label;
      return option;
    });
    const footer = document.createElement('div');
    if (items.length) {
      footer.className = 'keys';footer.setAttribute('aria-hidden', 'true');
      for (const [key, text] of [['↑',''],['↓',' move '],['↵',' select '],['esc',' close']]) {
        const kbd = document.createElement('kbd');kbd.textContent = key;footer.append(kbd, text);
      }
    } else {footer.className = 'empty';footer.textContent = emptyText;}
    box.replaceChildren(...children, footer);
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
  on(input, "input", open);
  on(input, "focus", open);
  on(input, "keydown", (e) => {
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
  on(box, "mousemove", (e) => {
    if (e.clientX === px && e.clientY === py) return;
    px = e.clientX; py = e.clientY;
    const el = e.target.closest("[data-i]");
    if (el && +el.dataset.i !== active) setActive(+el.dataset.i, false);
  });
  on(box, "mousedown", (e) => {
    const el = e.target.closest("[data-i]");
    if (el) { e.preventDefault(); pick(+el.dataset.i); }
  });
  on(document, "click", (e) => { if (e.target !== input && !box.contains(e.target)) close(); });
  return { close, dispose: () => {controller.abort();close();items=[];} };
}
