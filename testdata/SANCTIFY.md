# Sanctification fixtures

`ashes_cross_class_helm.json` records three consecutive ashes upgrades of
Demon Hunter Helm #1 by a Barbarian, supplied from game observations on
2026-10-08. The regression compares all six affix families without numeric
values or predicted next seeds.

`ashes_cross_class_dagger.json` records three game-observed Barbarian ashes
upgrades of Demon Hunter Dagger #1 (Karlei's Point), a non-set five-affix item.
It also records the reported starting item's values. The unreported common
weapon damage affix is excluded from the ashes comparison.

`ashes_cross_class_quiver.json` records three game-observed Barbarian ashes
upgrades of Demon Hunter Quiver #1 (Dead Man's Legacy), plus its starting
715 Dexterity. All six reported affix families are checked on each upgrade;
"attack" in the observation is interpreted as attack speed.

- `sanctify_6_affix.json`: Season 40 softcore, Demon Hunter, Helm #1, Accursed Visage.
- `sanctify_5_affix.json`: Season 40 softcore, Demon Hunter, Dagger #1, Karlei's Point.

`sanctify_cross_class_helm.json` records four consecutive Sanctifications of
Demon Hunter Helm #1 by a Barbarian. On 2026-10-08 the user verified all four
affix outcomes in game. Only those four are included; subsequent predictions
are not game-verified. This fixture lists the five observed ordinary affixes,
excluding the affix replaced by seasonal power. Values were not checked and
internal seeds are model predictions. A separate regression covers the observed
Barbarian Sanctification of Cage of the Hellborn at seed 3464113595 and the
following Demon Hunter Convert to Fiendish Grips.

`sanctify_cross_class_route.json` records the complete game-verified route from
Demon Hunter Pants #2 to primal Hell Walkers, including both initial upgrades
and all seven operations with their performing classes. The user confirmed all
steps reproduced on 2026-10-08. The test checks every item, quality, ordinary
stat/value and inferred seed. Seasonal powers and the secondaries they replace
are excluded from Sanctify observations.

Each same-class file contains 15 consecutive Sanctifications of the same starting item.
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
