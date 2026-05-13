## ADDED Requirements

### Requirement: Param lane plot width binds to layout horizon

Expanded `.mr-param-lane__plot`, collapsed minimap wrappers, SVG horizontal geometry, AND playhead lateral math SHALL derive inline width from `layoutHorizonBeats * pxPerBeat` matching sibling piano rolls fed from the orchestrator instead of shrinking to the narrower `totalT` window-length prop when the two diverge.

#### Scenario: Param lane plot equals roll width beneath same channel

- **WHEN** a `.mr-channel` stack passes `layoutHorizonBeats = H` identically into Track + ParamLane rows for the same channel
- **THEN** expanded plot `clientWidth - keysSpacerOffset` SHALL match the adjoining `.mr-roll__lanes` stripe width within ±1 px
