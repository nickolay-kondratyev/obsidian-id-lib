Feature: Doc id

  The thin restatement of the domain feature through a REAL Obsidian: the
  wiring a consumer writes really persists an id with Obsidian's own vault.
  Behaviour lives in features/domain/doc-id.feature — never duplicate its
  assertions here.

  Scenario: A document without a doc id is given one
    Given a note "bdd-note.md" without a doc id
    When the user ensures the note has a doc id
    Then the note's doc id is on disk
