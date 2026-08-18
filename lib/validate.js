"use strict";

/**
 * Field-definition-driven record validator.
 *
 * A "definition" is:
 * {
 *   fields: [ { name, label, type, required, options?, constraints? }, ... ],
 *   cross_field_rules?: [
 *     { type: "compare", field, operator, other_field, message? }, ...
 *   ]
 * }
 * A "record" is a plain object of { fieldName: value }.
 *
 * validateRecord(definition, record) -> { valid: boolean, errors: [{ field, message }] }
 *
 * This module is deliberately client-agnostic: it knows nothing about any
 * particular client's field names or business rules. It only knows the
 * generic type/constraint vocabulary below.
 */

function isPresent(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

function fieldLabel(field) {
  return field.label || field.name;
}

function validateText(field, value, errors) {
  if (typeof value !== "string") {
    errors.push({ field: field.name, message: `${fieldLabel(field)} must be a string` });
    return;
  }
  const c = field.constraints || {};
  if (typeof c.min_length === "number" && value.length < c.min_length) {
    errors.push({ field: field.name, message: `${fieldLabel(field)} must be at least ${c.min_length} characters` });
  }
  if (typeof c.max_length === "number" && value.length > c.max_length) {
    errors.push({ field: field.name, message: `${fieldLabel(field)} must be at most ${c.max_length} characters` });
  }
  if (c.pattern) {
    const re = c.pattern instanceof RegExp ? c.pattern : new RegExp(c.pattern);
    if (!re.test(value)) {
      errors.push({ field: field.name, message: `${fieldLabel(field)} does not match the required format` });
    }
  }
}

function validateLongText(field, value, errors) {
  // long_text behaves like text but is not typically pattern-constrained.
  validateText(field, value, errors);
}

function validateNumber(field, value, errors) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push({ field: field.name, message: `${fieldLabel(field)} must be a number` });
    return;
  }
  const c = field.constraints || {};
  if (typeof c.min === "number" && value < c.min) {
    errors.push({ field: field.name, message: `${fieldLabel(field)} must be at least ${c.min}` });
  }
  if (typeof c.max === "number" && value > c.max) {
    errors.push({ field: field.name, message: `${fieldLabel(field)} must be at most ${c.max}` });
  }
}

function validateBoolean(field, value, errors) {
  if (typeof value !== "boolean") {
    errors.push({ field: field.name, message: `${fieldLabel(field)} must be true or false` });
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isCalendarDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1) return false;

  const daysByMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysByMonth[month - 1];
}

function validateDate(field, value, errors) {
  if (typeof value !== "string" || !DATE_RE.test(value)) {
    errors.push({ field: field.name, message: `${fieldLabel(field)} must be a date in YYYY-MM-DD format` });
    return;
  }
  if (!isCalendarDate(value)) {
    errors.push({ field: field.name, message: `${fieldLabel(field)} is not a valid date` });
  }
}

function validateChoice(field, value, errors) {
  if (typeof value !== "string") {
    errors.push({ field: field.name, message: `${fieldLabel(field)} must be one of the allowed options` });
    return;
  }
  const options = field.options || [];
  if (!options.includes(value)) {
    errors.push({ field: field.name, message: `${fieldLabel(field)} must be one of: ${options.join(", ")}` });
  }
}

function validateMultiChoice(field, value, errors) {
  if (!Array.isArray(value)) {
    errors.push({ field: field.name, message: `${fieldLabel(field)} must be a list of options` });
    return;
  }
  const options = field.options || [];
  const invalid = value.filter((v) => !options.includes(v));
  if (invalid.length > 0) {
    errors.push({ field: field.name, message: `${fieldLabel(field)} contains invalid option(s): ${invalid.join(", ")}` });
  }
  const c = field.constraints || {};
  if (typeof c.min_selected === "number" && value.length < c.min_selected) {
    errors.push({ field: field.name, message: `${fieldLabel(field)} requires at least ${c.min_selected} selection(s)` });
  }
  if (typeof c.max_selected === "number" && value.length > c.max_selected) {
    errors.push({ field: field.name, message: `${fieldLabel(field)} allows at most ${c.max_selected} selection(s)` });
  }
}

function validateFile(field, value, errors) {
  if (typeof value !== "object" || value === null || typeof value.filename !== "string") {
    errors.push({ field: field.name, message: `${fieldLabel(field)} must be a file with a filename` });
    return;
  }
  const c = field.constraints || {};
  if (Array.isArray(c.accepted) && c.accepted.length > 0) {
    const ext = value.filename.split(".").pop().toLowerCase();
    if (!c.accepted.map((e) => e.toLowerCase()).includes(ext)) {
      errors.push({ field: field.name, message: `${fieldLabel(field)} must be one of: ${c.accepted.join(", ")}` });
    }
  }
}

const TYPE_VALIDATORS = {
  text: validateText,
  long_text: validateLongText,
  number: validateNumber,
  boolean: validateBoolean,
  date: validateDate,
  choice: validateChoice,
  multi_choice: validateMultiChoice,
  file: validateFile,
};

const COMPARISON_OPERATORS = new Set(["eq", "neq", "gt", "gte", "lt", "lte"]);
const ORDERED_TYPES = new Set(["number", "date"]);
const EQUALITY_TYPES = new Set(["text", "long_text", "number", "boolean", "date", "choice"]);

function definitionError(index, message) {
  throw new TypeError(`Invalid cross_field_rules[${index}]: ${message}`);
}

function prepareCrossFieldRules(definition, fields) {
  const rules = definition && definition.cross_field_rules;
  if (rules === undefined) return [];
  if (!Array.isArray(rules)) {
    throw new TypeError("Invalid cross_field_rules: expected an array");
  }

  const fieldsByName = new Map(fields.map((field) => [field.name, field]));

  return rules.map((rule, index) => {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
      definitionError(index, "expected an object");
    }
    if (rule.type !== "compare") {
      definitionError(index, 'type must be "compare"');
    }
    if (typeof rule.field !== "string" || rule.field.trim() === "") {
      definitionError(index, "field must be a non-empty string");
    }
    if (typeof rule.other_field !== "string" || rule.other_field.trim() === "") {
      definitionError(index, "other_field must be a non-empty string");
    }
    if (rule.field === rule.other_field) {
      definitionError(index, "field and other_field must be different");
    }
    if (!COMPARISON_OPERATORS.has(rule.operator)) {
      definitionError(index, `unsupported operator "${rule.operator}"`);
    }
    if (rule.message !== undefined && (typeof rule.message !== "string" || rule.message.trim() === "")) {
      definitionError(index, "message must be a non-empty string when provided");
    }

    const field = fieldsByName.get(rule.field);
    const otherField = fieldsByName.get(rule.other_field);
    if (!field) definitionError(index, `unknown field "${rule.field}"`);
    if (!otherField) definitionError(index, `unknown other_field "${rule.other_field}"`);
    if (field.type !== otherField.type) {
      definitionError(index, `fields must have the same type; got "${field.type}" and "${otherField.type}"`);
    }

    const isEquality = rule.operator === "eq" || rule.operator === "neq";
    const allowedType = isEquality ? EQUALITY_TYPES.has(field.type) : ORDERED_TYPES.has(field.type);
    if (!allowedType) {
      definitionError(index, `operator "${rule.operator}" does not support field type "${field.type}"`);
    }

    return { ...rule, fieldDefinition: field, otherFieldDefinition: otherField };
  });
}

function comparisonPasses(operator, value, otherValue) {
  switch (operator) {
    case "eq": return value === otherValue;
    case "neq": return value !== otherValue;
    case "gt": return value > otherValue;
    case "gte": return value >= otherValue;
    case "lt": return value < otherValue;
    case "lte": return value <= otherValue;
    default: return false;
  }
}

function comparisonMessage(rule) {
  if (rule.message) return rule.message;

  const datePhrases = { eq: "the same as", neq: "different from", gt: "after", gte: "on or after", lt: "before", lte: "on or before" };
  const generalPhrases = { eq: "equal to", neq: "different from", gt: "greater than", gte: "greater than or equal to", lt: "less than", lte: "less than or equal to" };
  const phrases = rule.fieldDefinition.type === "date" ? datePhrases : generalPhrases;

  return `${fieldLabel(rule.fieldDefinition)} must be ${phrases[rule.operator]} ${fieldLabel(rule.otherFieldDefinition)}`;
}

/**
 * Validate a record against a field definition list.
 * Per-field validation runs first. Cross-field comparison rules run only when
 * both participating fields are present and individually valid.
 */
function validateRecord(definition, record) {
  const errors = [];
  const fields = (definition && definition.fields) || [];
  const invalidFields = new Set();
  const crossFieldRules = prepareCrossFieldRules(definition, fields);

  for (const field of fields) {
    const value = record ? record[field.name] : undefined;
    const present = isPresent(value);

    if (!present) {
      if (field.required) {
        errors.push({ field: field.name, message: `${fieldLabel(field)} is required` });
        invalidFields.add(field.name);
      }
      continue; // optional and absent: nothing further to check
    }

    const validator = TYPE_VALIDATORS[field.type];
    if (!validator) {
      errors.push({ field: field.name, message: `Unknown field type "${field.type}" for ${fieldLabel(field)}` });
      invalidFields.add(field.name);
      continue;
    }

    const previousErrorCount = errors.length;
    validator(field, value, errors);
    if (errors.length > previousErrorCount) invalidFields.add(field.name);
  }

  for (const rule of crossFieldRules) {
    const value = record ? record[rule.field] : undefined;
    const otherValue = record ? record[rule.other_field] : undefined;

    if (!isPresent(value) || !isPresent(otherValue)) continue;
    if (invalidFields.has(rule.field) || invalidFields.has(rule.other_field)) continue;

    if (!comparisonPasses(rule.operator, value, otherValue)) {
      errors.push({ field: rule.field, message: comparisonMessage(rule) });
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateRecord, TYPE_VALIDATORS };
