Feature: Doc id

  Every eligible document carries a persistent doc id, and an id that is
  already there is honored as-is — the document is never rewritten to "fix" it.

  Scenario: A document without a doc id is given one
    Given a note "notes/meeting.md" without a doc id
    When the user ensures the note has a doc id
    Then the note has a doc id

  Scenario: A document keeps a doc id it already has
    Given a note "notes/meeting.md" with the doc id "docid_MintedByOldTooling_E"
    When the user ensures the note has a doc id
    Then the note's doc id is "docid_MintedByOldTooling_E"

  Scenario: A document whose format cannot carry a doc id gets none
    Given a note "drawings/sketch.excalidraw" without a doc id
    When the user ensures the note has a doc id
    Then the note has no doc id
