# Starter package — Platform Foundation take-home

This is the material referenced in Parts 1 and 2 of the exercise brief.

```
review/
  handover-architecture.md   <- Part 1: the contractor's handover notes
lib/
  validate.js                <- the validation library (Part 2 starting point)
clients/
  client-a-city-maintenance.json
  client-b-grant-foundation.json
  client-c-clinic.json       <- field definitions for the three live clients
test/
  validate.test.js           <- the existing passing test suite
package.json
```

## Running it

Node 18+, no dependencies to install.

```
npm test
```

That runs the existing suite (`node --test test/validate.test.js`). It should pass as-is, out of the box, before you change anything.

## What's here

`lib/validate.js` exports `validateRecord(definition, record)`. A **definition** is a list of field descriptions (name, label, type, required, options for choice-like fields, and a `constraints` object); a **record** is the plain object of submitted values. It returns `{ valid, errors }`, where `errors` is a list of `{ field, message }`.

Supported field types today: `text`, `long_text`, `number`, `boolean`, `date` (`YYYY-MM-DD`), `choice`, `multi_choice`, `file`. Supported constraints vary by type: `min_length`/`max_length`/`pattern` for text, `min`/`max` for numbers, `min_selected`/`max_selected` for multi-choice, `accepted` (a list of extensions) for files. Look at `clients/*.json` for real examples of all of these in use, and `test/validate.test.js` for what each one rejects.

The three client definition files are the actual field lists for the three clients described in the brief (Client A / City maintenance, Client B / Grant-making foundation, Client C / Private clinic) — field names match what the brief describes. They're here so you have real, non-trivial definitions to test against rather than inventing your own.

Definitions may now include top-level `cross_field_rules`. These rules compare two declared fields after ordinary per-field validation has completed.

## Cross-field rule format

The supported rule type is `compare`:

```json
{
  "fields": [
    {
      "name": "project_start_date",
      "label": "Project start date",
      "type": "date",
      "required": true
    },
    {
      "name": "project_end_date",
      "label": "Project end date",
      "type": "date",
      "required": true
    }
  ],
  "cross_field_rules": [
    {
      "type": "compare",
      "field": "project_end_date",
      "operator": "gte",
      "other_field": "project_start_date",
      "message": "Project end date must not be before project start date"
    }
  ]
}
```

Each rule has the following properties:

- `type` — required; currently must be `"compare"`.
- `field` — required; the left-hand value in the comparison and the field that receives an error when the comparison fails.
- `operator` — required; one of `eq`, `neq`, `gt`, `gte`, `lt`, or `lte`.
- `other_field` — required; the right-hand value and dependency of `field`.
- `message` — optional; a non-empty error message. If omitted, the library builds a message from the two field labels and the operator.

The example reads as `project_end_date >= project_start_date`. A failed rule returns one error against `project_end_date`, not both fields. The value entered in the end-date field is the value the user needs to correct; attaching the same error to both inputs would add noise without identifying a second fault.

## Supported comparisons

Both referenced fields must exist in `fields` and have exactly the same type. Values are never coerced.

| Field type | `eq` / `neq` | `gt` / `gte` / `lt` / `lte` |
| --- | --- | --- |
| `number` | Yes | Yes |
| `date` | Yes | Yes |
| `text` | Yes | No |
| `long_text` | Yes | No |
| `boolean` | Yes | No |
| `choice` | Yes | No |
| `multi_choice` | No | No |
| `file` | No | No |

Dates are compared as validated `YYYY-MM-DD` calendar dates. Because the representation is fixed-width and ordered from year to day, lexical and chronological ordering are the same. Numbers must be finite JavaScript numbers. Equality comparisons use strict equality.

Rules are evaluated in declaration order. If multiple rules fail, each produces its own error in that order, including when more than one rule targets the same field.

## Missing and invalid dependencies

`validateRecord` performs all per-field validation first. A cross-field rule runs only when:

1. `field` is present and has no per-field error; and
2. `other_field` is present and has no per-field error.

If either value is absent, the rule is skipped. A required field still receives its normal required error; an absent optional field does not. If either value is present but invalid, its existing type or constraint error is returned and the comparison is skipped. This prevents a malformed date, for example, from also producing a misleading date-order error.

Skipping a rule does not mean that an invalid record passes: the per-field error still makes `valid` false. It only avoids cascading errors whose prerequisites were not met.

## Invalid rule definitions

Definitions are trusted configuration rather than user input, so malformed rules fail loudly with `TypeError` before record validation. This includes:

- a non-array `cross_field_rules` value;
- an unknown rule type or operator;
- missing, blank, identical, or unknown field references;
- different field types on the two sides;
- an operator that does not support the referenced type; and
- an empty or non-string custom message.

Silently ignoring a bad rule could admit records that the definition author intended to reject. Throwing makes a deployment or configuration mistake visible immediately.

## Deliberate boundary

The implementation is a comparison vocabulary, not a general expression language. It intentionally does not support arbitrary JavaScript, nested `and`/`or` expressions, arithmetic, constant operands, cross-type coercion, asynchronous lookups, or client-specific rule handlers. Existing per-field constraints already cover comparisons against constants.

This boundary covers common relationships such as date ranges, numeric minimum/maximum pairs, and confirmation fields while keeping definitions reviewable JSON. More complex workflow or scoring policy belongs in a separately versioned policy component, not in basic record validation.

## Compatibility and tests

Definitions without `cross_field_rules` behave as before, and none of the original tests were changed. The suite now contains 32 passing tests: the original 16 plus 16 tests for comparison success and failure, equality boundaries, missing and invalid dependencies, optional dependencies, default and custom messages, rule order, malformed definitions, impossible calendar dates, and non-finite numbers.

The implementation remains client-agnostic. No client names or client-specific field names appear in `lib/`.
