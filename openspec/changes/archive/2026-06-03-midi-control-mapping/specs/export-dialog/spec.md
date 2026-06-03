## ADDED Requirements

### Requirement: Export the control mapping set as JSON

The Export dialog SHALL offer exporting the active control mapping set
(`ControlMapState`) as a JSON file, alongside its existing exports.

#### Scenario: User exports mappings

- **WHEN** the user chooses to export mappings from the Export dialog
- **THEN** a JSON file containing the active `ControlMapState` is produced

### Requirement: Import a control mapping set from JSON

The Export dialog SHALL offer importing a control mapping set from a JSON file.
Import SHALL validate the file against the current `version`, migrate older
versions where defined, and replace the active mapping set. Invalid files SHALL
be rejected with a message and SHALL leave the current mappings unchanged.

#### Scenario: User imports a valid mapping set

- **WHEN** the user imports a valid mapping JSON file
- **THEN** the active mapping set is replaced by the imported mappings

#### Scenario: Invalid import is rejected

- **WHEN** the user imports a malformed or version-incompatible file that cannot be migrated
- **THEN** the import is rejected with a message and the current mappings are unchanged
