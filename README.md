<p align="center">
  <img src="docs/d3recipes-banner.png" alt="D3Recipes" width="720">
</p>

<p align="center">
  <b>Targeted crafting recipes for Diablo III on consoles.</b><br>
  Pick an item, get a primal.
</p>

<p align="center">
  <a href="https://fngarvin.github.io/d3recipes/">Open the site</a> &middot;
  <a href="#requesting-a-build-preset">Request a build</a> &middot;
  <a href="LICENSE">License</a>
</p>

---

A recipe finder for **Kanai's Cube** in offline Diablo III on consoles. Pick an item and the stats you care about and it attempts to create a recipe that can reliably produce it using a brand-new seasonal hero. You can, of course, use generated items on any hero.

The tool runs entirely in the browser (Rust compiled to WebAssembly), so it works even on a phone and needs no server.

## Using It

Open the site (`web/index.html` served by any static server, or the [GitHub Pages deployment](https://fngarvin.github.io/d3recipes/)), then:

1. Pick softcore or hardcore and season number (default: softcore, season 40).
2. Select a class, an item, and (optionally) a set of affixes.
3. Optionally, expand the Costs and Limits section to define the scope of the search. (todo: explain the cost ratio system and solicit input)
4. Press **Find Recipes**.

**IMPORTANT**: Recipes assume a fresh level-1 seasonal hero that has performed no previous transmutes and has gained no XP. Even just entering campaign before joining adventure mode or reading Haedrig's book can be enough to break a recipe.

## How It Works

This tool mimics the way the game generates items so that every result can be computed in advance.

## Requesting a Build Preset

Copy the block in `builds_template.toml`, fill in your collection of items (items per slot, stats best-first) and either open an issue with it or add it to the end of `builds.toml` in a pull request. Quality builds submitted in a format that can be pasted straight into that file will be considered and pull requests against it are welcome for good builds or useful collections of items.

## Layout

| path | what |
| --- | --- |
| `web/` | the static site (`index.html`, `app.js`, `worker.js`, `stats.js`), the game tables (`data.json`) and the compiled WebAssembly (`pkg/`) |
| `core/` | the Rust crate: model (`sim.rs`), search (`plan.rs`), table loading (`data.rs`), wasm interface (`lib.rs`) and tests |
| `testdata/` | expected results used by the tests |
| `docs/` | the README banner |
| `builds.toml` | the list of precomputed builds (items and stat priorities per slot) |
| `builds_template.toml` | copy-paste form for requesting a build |

Build the wasm after changing `core/`:

```
cd core
cargo test --release
wasm-pack build --release --target web --out-dir ../web/pkg
```

Serve locally: `python -m http.server 8765 -d web` and open `http://localhost:8765`.

## License

See [LICENSE](LICENSE). In short: use it however you like, credit the source, and if you use its outputs in a user-facing application, visibly link to the site or this repository. That applies to modified versions too.

## Thanks

Thank you to Blizzard Entertainment for thirty glorious years of Diablo; to jester, whose d3hack made it possible to test seasons offline; and to Maxroll, whose build guides the stat priorities in `builds.toml` are drawn from.
