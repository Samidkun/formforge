# ADR 2: Canonical JSON Schema Form Contract & Backward-Only Logic

## Status
Accepted (Milestone 2 & 5)

## Context
Forms require flexible definition of fields (9 core types: `text`, `email`, `number`, `textarea`, `choice`, `multi_choice`, `rating`, `date`, `file_upload`), validation constraints, and conditional display logic. Hardcoding relational columns per form or generating dynamic SQL migrations per field is anti-pattern and brittle.

## Decision
Represent form definitions as a single canonical JSON document stored in `forms.draft_schema` and versioned in `form_versions.schema`:
1. **Field Structure:**
   Every field defines `{ key, type, label, required, options?, logic? }`.
2. **Backward-Only Conditional Logic:**
   A field's visibility rule (`show_if: { field, equals | not_equals | contains | greater_than | less_than, value }`) may **only reference fields defined earlier in the array**.
3. **Cross-Service Validation:**
   Both Laravel (via PHP unit validator) and Go (via `schema/validator.go`) share identical parsing rules to ensure that valid drafts in the builder always parse correctly in the edge service.

## Consequences
- **Positive:** Adding new field types requires zero database schema migrations. Backward-only logic rule mathematically guarantees absence of circular dependency loops.
- **Negative:** Schema migrations across major versions require backward-compatible JSON deserializers.
