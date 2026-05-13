## MODIFIED Requirements

### Requirement: Seeded default session has two channels

On first mount of `useChannels()`, the returned state SHALL be determined from the URL query’s `demo` parameters (see implementation: `URLSearchParams.getAll('demo')`).

An **instrument-demanding** token is any of: `instrument`, `marquee`, `note`. Each of these SHALL load the same channel/roll/param-lane fixture described below as the **instrument fixture** (because marquee and note demos require seeded notes on Lead).

**Baseline (no instrument-demanding token, or empty query):** exactly two channels SHALL be present with the identities below, **empty** rolls, and **`lanes` SHALL be the empty array**.

- `Channel { id: 1, name: "Lead", color: "oklch(72% 0.14 240)", collapsed: false, muted: false, soloed: false }`
  - Roll: `notes: []`, `muted: false`, `soloed: false`, `collapsed: false`
  - Lanes: none (`lanes` filtered by `channelId === 1` SHALL have length `0`)

- `Channel { id: 2, name: "Bass", color: "oklch(70% 0.16 30)", collapsed: false, muted: false, soloed: false }`
  - Roll: `notes: []`, `muted: false`, `soloed: false`, `collapsed: false`
  - Lanes: none (`lanes` filtered by `channelId === 2` SHALL have length `0`)

**Instrument fixture (at least one instrument-demanding token present):** the seeded session SHALL match the **prior** non-clean fixture (before this change):

- Channel 1 roll: `notes: makeNotes(22, 7)`, same channel fields as baseline
- Channel 1 lanes (in order): Mod Wheel (`cc` 1) using `ccModWheel(totalT)`, Pitch Bend (`pb`) using `ccPitchBend(totalT)`, with the same mute/solo/collapse defaults as today
- Channel 2 roll: `notes: makeNotes(16, 11)`, lanes: `[]`

The legacy `demo=clean` token **alone** (no `instrument`, `marquee`, or `note` token) SHALL yield the **same** channel/roll/lane payload as baseline: empty rolls and no lanes.

When `demo=clean` appears **together with** an instrument-demanding token, the **instrument fixture SHALL still apply** (marquee/note/instrument take precedence so the Lead roll is not empty).

The previously-seeded "Note Velocity" lane SHALL NOT appear in any seed output.

#### Scenario: Bare URL has two channels and empty content

- **WHEN** `useChannels()` initializes with no `demo` query flags that enable instrument demo
- **THEN** the returned `channels` array SHALL have length `2`
- **AND** both rolls SHALL have `notes.length === 0`
- **AND** the `lanes` array SHALL have length `0`

#### Scenario: demo=instrument restores instrument fixtures

- **WHEN** `useChannels()` initializes with `demo=instrument` present (possibly alongside other flags)
- **THEN** the Lead roll’s `notes` SHALL equal `makeNotes(22, 7)`
- **AND** the Bass roll’s `notes` SHALL equal `makeNotes(16, 11)`
- **AND** lanes for channel 1 SHALL include exactly two entries (`cc` Mod Wheel, `pb` Pitch Bend) as in the pre-change fixture

#### Scenario: demo=marquee alone implies instrument fixture

- **WHEN** `useChannels()` initializes with `demo=marquee` present and without `demo=instrument`
- **THEN** the Lead roll’s `notes` SHALL equal `makeNotes(22, 7)`
- **AND** lanes for channel 1 SHALL have length `2`

#### Scenario: demo=note alone implies instrument fixture

- **WHEN** `useChannels()` initializes with `demo=note` present and without `demo=instrument`
- **THEN** the Lead roll’s `notes` SHALL equal `makeNotes(22, 7)`
- **AND** lanes for channel 1 SHALL have length `2`

#### Scenario: demo=clean matches baseline empty seed

- **WHEN** `useChannels()` initializes with only `demo=clean` among demo flags
- **THEN** rolls SHALL be empty and `lanes` SHALL be empty (same as bare URL)
