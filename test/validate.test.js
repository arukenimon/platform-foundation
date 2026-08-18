"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { validateRecord } = require("../lib/validate");

function loadClient(filename) {
  const p = path.join(__dirname, "..", "clients", filename);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

const clientA = loadClient("client-a-city-maintenance.json");
const clientB = loadClient("client-b-grant-foundation.json");
const clientC = loadClient("client-c-clinic.json");

// ---- Client A: infrastructure report ----------------------------------

test("client A: a fully valid record passes", () => {
  const record = {
    resident_name: "Maria Santos",
    resident_phone: "+63 917 555 0101",
    street_address: "12 Rizal St",
    district: "north",
    issue_type: "pothole",
    description: "Large pothole blocking half the lane.",
  };
  const result = validateRecord(clientA, record);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test("client A: missing a required field fails", () => {
  const record = {
    resident_phone: "+63 917 555 0101",
    street_address: "12 Rizal St",
    district: "north",
    issue_type: "pothole",
    description: "Large pothole blocking half the lane.",
  };
  const result = validateRecord(clientA, record);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "resident_name"));
});

test("client A: phone that doesn't match the pattern fails", () => {
  const record = {
    resident_name: "Maria Santos",
    resident_phone: "not-a-phone!!",
    street_address: "12 Rizal St",
    district: "north",
    issue_type: "pothole",
    description: "Large pothole blocking half the lane.",
  };
  const result = validateRecord(clientA, record);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "resident_phone"));
});

test("client A: issue_type outside the option list fails", () => {
  const record = {
    resident_name: "Maria Santos",
    resident_phone: "+63 917 555 0101",
    street_address: "12 Rizal St",
    district: "north",
    issue_type: "graffiti", // not in the allowed options
    description: "Not one of ours.",
  };
  const result = validateRecord(clientA, record);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "issue_type"));
});

test("client A: an optional field left out is fine", () => {
  const record = {
    resident_name: "Maria Santos",
    resident_phone: "+63 917 555 0101",
    street_address: "12 Rizal St",
    district: "north",
    issue_type: "pothole",
    description: "Large pothole blocking half the lane.",
    // photo omitted — optional
  };
  const result = validateRecord(clientA, record);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test("client A: photo with a disallowed extension fails", () => {
  const record = {
    resident_name: "Maria Santos",
    resident_phone: "+63 917 555 0101",
    street_address: "12 Rizal St",
    district: "north",
    issue_type: "pothole",
    description: "Large pothole blocking half the lane.",
    photo: { filename: "evidence.gif" },
  };
  const result = validateRecord(clientA, record);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "photo"));
});

// ---- Client B: grant application ---------------------------------------

test("client B: a fully valid record passes", () => {
  const record = {
    organisation_name: "River Basin Trust",
    registry_number: "RN-004821",
    contact_person: "Dana Cole",
    requested_amount: 25000,
    priority_areas: ["environment", "education"],
    project_description: "Riverbank restoration and youth education program.",
    project_start_date: "2027-01-15",
    project_end_date: "2027-12-15",
    budget_file: { filename: "budget.pdf" },
  };
  const result = validateRecord(clientB, record);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test("client B: negative requested_amount fails", () => {
  const record = {
    organisation_name: "River Basin Trust",
    registry_number: "RN-004821",
    contact_person: "Dana Cole",
    requested_amount: -500,
    priority_areas: ["environment"],
    project_description: "Riverbank restoration.",
    project_start_date: "2027-01-15",
    project_end_date: "2027-12-15",
    budget_file: { filename: "budget.pdf" },
  };
  const result = validateRecord(clientB, record);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "requested_amount"));
});

test("client B: priority_areas with too many selections fails", () => {
  const record = {
    organisation_name: "River Basin Trust",
    registry_number: "RN-004821",
    contact_person: "Dana Cole",
    requested_amount: 25000,
    priority_areas: ["environment", "education", "health", "housing"], // max_selected is 3
    project_description: "Riverbank restoration.",
    project_start_date: "2027-01-15",
    project_end_date: "2027-12-15",
    budget_file: { filename: "budget.pdf" },
  };
  const result = validateRecord(clientB, record);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "priority_areas"));
});

test("client B: priority_areas with an unknown option fails", () => {
  const record = {
    organisation_name: "River Basin Trust",
    registry_number: "RN-004821",
    contact_person: "Dana Cole",
    requested_amount: 25000,
    priority_areas: ["environment", "space_travel"],
    project_description: "Riverbank restoration.",
    project_start_date: "2027-01-15",
    project_end_date: "2027-12-15",
    budget_file: { filename: "budget.pdf" },
  };
  const result = validateRecord(clientB, record);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "priority_areas"));
});

test("client B: malformed date fails", () => {
  const record = {
    organisation_name: "River Basin Trust",
    registry_number: "RN-004821",
    contact_person: "Dana Cole",
    requested_amount: 25000,
    priority_areas: ["environment"],
    project_description: "Riverbank restoration.",
    project_start_date: "15/01/2027", // wrong format
    project_end_date: "2027-12-15",
    budget_file: { filename: "budget.pdf" },
  };
  const result = validateRecord(clientB, record);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "project_start_date"));
});

// ---- Client C: patient referral -----------------------------------------

test("client C: a fully valid record passes", () => {
  const record = {
    patient_name: "J. Almeida",
    national_id: "123456789",
    date_of_birth: "1990-04-02",
    phone: "+972 50 555 1234",
    referring_physician: "Dr. Rivka Cohen",
    physician_licence_number: "LIC-00921",
    service_line: "cardiology",
    priority_level: "routine",
  };
  const result = validateRecord(clientC, record);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test("client C: national_id that isn't 9 digits fails", () => {
  const record = {
    patient_name: "J. Almeida",
    national_id: "12345",
    date_of_birth: "1990-04-02",
    phone: "+972 50 555 1234",
    referring_physician: "Dr. Rivka Cohen",
    physician_licence_number: "LIC-00921",
    service_line: "cardiology",
    priority_level: "routine",
  };
  const result = validateRecord(clientC, record);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "national_id"));
});

test("client C: priority_level outside the option list fails", () => {
  const record = {
    patient_name: "J. Almeida",
    national_id: "123456789",
    date_of_birth: "1990-04-02",
    phone: "+972 50 555 1234",
    referring_physician: "Dr. Rivka Cohen",
    physician_licence_number: "LIC-00921",
    service_line: "cardiology",
    priority_level: "asap", // not a valid option
  };
  const result = validateRecord(clientC, record);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "priority_level"));
});

test("client C: optional clinical_notes left out is fine", () => {
  const record = {
    patient_name: "J. Almeida",
    national_id: "123456789",
    date_of_birth: "1990-04-02",
    phone: "+972 50 555 1234",
    referring_physician: "Dr. Rivka Cohen",
    physician_licence_number: "LIC-00921",
    service_line: "cardiology",
    priority_level: "urgent",
  };
  const result = validateRecord(clientC, record);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

// ---- Generic / cross-client behavior ------------------------------------

test("an unknown field type produces an error rather than a crash", () => {
  const definition = {
    fields: [{ name: "mystery", label: "Mystery field", type: "holoscan", required: true }],
  };
  const result = validateRecord(definition, { mystery: "anything" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "mystery"));
});

// ---- Cross-field comparison rules ----------------------------------------

function grantDefinitionWithDateRule(overrides = {}) {
  return {
    ...clientB,
    cross_field_rules: [
      {
        type: "compare",
        field: "project_end_date",
        operator: "gte",
        other_field: "project_start_date",
        message: "Project end date must not be before project start date",
        ...overrides,
      },
    ],
  };
}

function validGrantRecord(overrides = {}) {
  return {
    organisation_name: "River Basin Trust",
    registry_number: "RN-004821",
    contact_person: "Dana Cole",
    requested_amount: 25000,
    priority_areas: ["environment"],
    project_description: "Riverbank restoration.",
    project_start_date: "2027-01-15",
    project_end_date: "2027-12-15",
    budget_file: { filename: "budget.pdf" },
    ...overrides,
  };
}

test("cross-field: a passing date comparison produces no error", () => {
  const result = validateRecord(grantDefinitionWithDateRule(), validGrantRecord());
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test("cross-field: a failing date comparison reports against field", () => {
  const result = validateRecord(
    grantDefinitionWithDateRule(),
    validGrantRecord({ project_end_date: "2026-12-15" }),
  );

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, [
    {
      field: "project_end_date",
      message: "Project end date must not be before project start date",
    },
  ]);
});

test("cross-field: gte accepts equal date values", () => {
  const result = validateRecord(
    grantDefinitionWithDateRule(),
    validGrantRecord({ project_end_date: "2027-01-15" }),
  );
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test("cross-field: a missing dependency leaves the required error to field validation", () => {
  const record = validGrantRecord();
  delete record.project_start_date;

  const result = validateRecord(grantDefinitionWithDateRule(), record);
  assert.equal(result.valid, false);
  assert.deepEqual(result.errors.map((error) => error.field), ["project_start_date"]);
});

test("cross-field: an invalid dependency does not create a second error", () => {
  const result = validateRecord(
    grantDefinitionWithDateRule(),
    validGrantRecord({ project_start_date: "15/01/2027" }),
  );

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors.map((error) => error.field), ["project_start_date"]);
});

test("cross-field: an invalid target does not create a duplicate error", () => {
  const result = validateRecord(
    grantDefinitionWithDateRule(),
    validGrantRecord({ project_end_date: "not-a-date" }),
  );

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors.map((error) => error.field), ["project_end_date"]);
});

test("cross-field: an absent optional dependency skips the rule", () => {
  const definition = {
    fields: [
      { name: "minimum", label: "Minimum", type: "number", required: false },
      { name: "maximum", label: "Maximum", type: "number", required: true },
    ],
    cross_field_rules: [
      { type: "compare", field: "maximum", operator: "gte", other_field: "minimum" },
    ],
  };

  const result = validateRecord(definition, { maximum: 10 });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test("cross-field: number comparisons use the default message", () => {
  const definition = {
    fields: [
      { name: "minimum", label: "Minimum amount", type: "number", required: true },
      { name: "maximum", label: "Maximum amount", type: "number", required: true },
    ],
    cross_field_rules: [
      { type: "compare", field: "maximum", operator: "gte", other_field: "minimum" },
    ],
  };

  const result = validateRecord(definition, { minimum: 20, maximum: 10 });
  assert.deepEqual(result.errors, [
    { field: "maximum", message: "Maximum amount must be greater than or equal to Minimum amount" },
  ]);
});

test("cross-field: equality rules support scalar fields", () => {
  const definition = {
    fields: [
      { name: "email", label: "Email", type: "text", required: true },
      { name: "confirm_email", label: "Confirm email", type: "text", required: true },
    ],
    cross_field_rules: [
      { type: "compare", field: "confirm_email", operator: "eq", other_field: "email" },
    ],
  };

  const result = validateRecord(definition, { email: "person@example.com", confirm_email: "other@example.com" });
  assert.deepEqual(result.errors, [
    { field: "confirm_email", message: "Confirm email must be equal to Email" },
  ]);
});

test("cross-field: multiple rules run in declaration order", () => {
  const definition = {
    fields: [
      { name: "low", label: "Low", type: "number", required: true },
      { name: "middle", label: "Middle", type: "number", required: true },
      { name: "high", label: "High", type: "number", required: true },
    ],
    cross_field_rules: [
      { type: "compare", field: "middle", operator: "gte", other_field: "low" },
      { type: "compare", field: "high", operator: "gte", other_field: "middle" },
    ],
  };

  const result = validateRecord(definition, { low: 10, middle: 5, high: 1 });
  assert.deepEqual(result.errors.map((error) => error.field), ["middle", "high"]);
});

test("cross-field: malformed rule containers fail loudly", () => {
  assert.throws(
    () => validateRecord({ fields: [], cross_field_rules: {} }, {}),
    /Invalid cross_field_rules: expected an array/,
  );
});

test("cross-field: unknown field references fail loudly", () => {
  const definition = grantDefinitionWithDateRule({ other_field: "missing_date" });
  assert.throws(
    () => validateRecord(definition, validGrantRecord()),
    /unknown other_field "missing_date"/,
  );
});

test("cross-field: unsupported operators fail loudly", () => {
  const definition = grantDefinitionWithDateRule({ operator: "approximately" });
  assert.throws(
    () => validateRecord(definition, validGrantRecord()),
    /unsupported operator "approximately"/,
  );
});

test("cross-field: incompatible field types fail loudly", () => {
  const definition = {
    fields: [
      { name: "amount", label: "Amount", type: "number", required: true },
      { name: "date", label: "Date", type: "date", required: true },
    ],
    cross_field_rules: [
      { type: "compare", field: "amount", operator: "gte", other_field: "date" },
    ],
  };

  assert.throws(
    () => validateRecord(definition, { amount: 10, date: "2027-01-01" }),
    /fields must have the same type/,
  );
});

test("dates: impossible calendar dates are rejected", () => {
  const definition = { fields: [{ name: "date", label: "Date", type: "date", required: true }] };
  const result = validateRecord(definition, { date: "2027-02-30" });
  assert.equal(result.valid, false);
  assert.equal(result.errors[0].field, "date");
});

test("numbers: non-finite values are rejected", () => {
  const definition = { fields: [{ name: "amount", label: "Amount", type: "number", required: true }] };
  for (const value of [Infinity, -Infinity]) {
    const result = validateRecord(definition, { amount: value });
    assert.equal(result.valid, false);
    assert.equal(result.errors[0].field, "amount");
  }
});
