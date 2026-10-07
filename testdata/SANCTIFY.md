# Sanctification fixtures

- `sanctify_6_affix.json`: Season 40 softcore, Demon Hunter, Helm #1, Accursed Visage.
- `sanctify_5_affix.json`: Season 40 softcore, Demon Hunter, Dagger #1, Karlei's Point.

Each file contains 15 consecutive Sanctifications of the same starting item.
The expected outcomes were generated from `Sim::sanctify`. On 2026-10-07, the
user confirmed that all 15 consecutive ordinary-affix results in each file match
the game. Numeric values are modeled maxima; the internal seeds are inferred
from the matching sequences. Amend `outcomes` for further game observations and
update `source` to describe what was verified. Tests compare every roll's stats
and input/next seeds; stat ordering does not matter.

Stat names use the simulator's stems. Percentage values are fractions, so `0.15`
means 15%. `Sockets` with value `0` indicates that the socket affix is present.
Built-in item damage and power lines appear as `item power`; they do not count
toward the five/six affixes. The fixtures retain all ordinary affixes and do not
predict the Sanctification power or remove the affix it replaces.

Run the checks from the repository root:

```powershell
cargo test --release --manifest-path core/Cargo.toml --test sanctify
```

The example prints regenerated traces without modifying fixtures by default:

```powershell
cargo run --release --manifest-path core/Cargo.toml --example sanctify_trace
```

Only use the following command when you intend to overwrite manual amendments:

```powershell
cargo run --release --manifest-path core/Cargo.toml --example sanctify_trace -- --write-fixtures
```
