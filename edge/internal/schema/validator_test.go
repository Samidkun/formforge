package schema

import (
	"testing"
)

func TestValidateAnswers_CompleteSubmission_RequiredFields(t *testing.T) {
	schemaRaw := `{
		"fields": [
			{"key": "f_1", "type": "text", "label": "Name", "required": true},
			{"key": "f_2", "type": "email", "label": "Email", "required": true},
			{"key": "f_3", "type": "rating", "label": "Rating", "required": false},
			{"key": "f_4", "type": "file_upload", "label": "Resume", "required": true}
		]
	}`

	// Missing required f_2 and empty required f_4
	answers := []Answer{
		{FieldKey: "f_1", Value: "Alice"},
		{FieldKey: "f_4", Value: ""},
	}

	errs, err := ValidateAnswers([]byte(schemaRaw), true, answers)
	if err != nil {
		t.Fatalf("unexpected validator error: %v", err)
	}
	if len(errs) != 2 {
		t.Fatalf("expected 2 validation errors, got %d: %v", len(errs), errs)
	}
	if _, ok := errs["f_2"]; !ok {
		t.Errorf("expected error for missing field f_2, got: %v", errs)
	}
	if _, ok := errs["f_4"]; !ok {
		t.Errorf("expected error for empty field f_4, got: %v", errs)
	}
}

func TestValidateAnswers_PartialSubmission_AllowsMissingRequired(t *testing.T) {
	schemaRaw := `{
		"fields": [
			{"key": "f_1", "type": "text", "label": "Name", "required": true},
			{"key": "f_2", "type": "email", "label": "Email", "required": true}
		]
	}`

	// Partial submission can have incomplete required fields
	answers := []Answer{
		{FieldKey: "f_1", Value: "Alice"},
	}

	errs, err := ValidateAnswers([]byte(schemaRaw), false, answers)
	if err != nil {
		t.Fatalf("unexpected validator error: %v", err)
	}
	if len(errs) != 0 {
		t.Errorf("expected 0 errors on partial submission with missing fields, got: %v", errs)
	}
}

func TestValidateAnswers_FieldTypeValidation(t *testing.T) {
	schemaRaw := `{
		"fields": [
			{"key": "f_email", "type": "email", "label": "Email", "required": false},
			{"key": "f_num", "type": "number", "label": "Age", "required": false},
			{"key": "f_rate", "type": "rating", "label": "Rating", "required": false},
			{"key": "f_choice", "type": "choice", "label": "Option", "required": false, "options": ["A", "B"]},
			{"key": "f_multi", "type": "multi_choice", "label": "Tags", "required": false, "options": ["X", "Y"]},
			{"key": "f_date", "type": "date", "label": "Date", "required": false},
			{"key": "f_text", "type": "text", "label": "Text", "required": false},
			{"key": "f_area", "type": "textarea", "label": "Area", "required": false},
			{"key": "f_file", "type": "file_upload", "label": "File", "required": false},
			{"key": "f_num_bool", "type": "number", "label": "NumBool", "required": false},
			{"key": "f_email_type", "type": "email", "label": "EmailType", "required": false},
			{"key": "f_choice_type", "type": "choice", "label": "ChoiceType", "required": false, "options": ["A", "B"]},
			{"key": "f_multi_type", "type": "multi_choice", "label": "MultiType", "required": false, "options": ["X", "Y"]},
			{"key": "f_rate_float", "type": "rating", "label": "RateFloat", "required": false},
			{"key": "f_rate_nonnum", "type": "rating", "label": "RateNonNum", "required": false}
		]
	}`

	// Invalid values
	answers := []Answer{
		{FieldKey: "f_email", Value: "not-an-email"},
		{FieldKey: "f_num", Value: "not-a-number"},
		{FieldKey: "f_rate", Value: 6},            // rating must be 1-5
		{FieldKey: "f_choice", Value: "C"},         // not in options
		{FieldKey: "f_multi", Value: []interface{}{"X", "Z"}}, // Z not in options
		{FieldKey: "f_date", Value: "2026/09/18"},  // bad date format
		{FieldKey: "f_text", Value: 12345},         // must be string
		{FieldKey: "f_area", Value: true},          // must be string
		{FieldKey: "f_file", Value: 999},           // must be string or file ref
		{FieldKey: "f_num_bool", Value: true},      // number invalid type
		{FieldKey: "f_email_type", Value: 12345},   // email non-string
		{FieldKey: "f_choice_type", Value: 123},    // choice non-string
		{FieldKey: "f_multi_type", Value: "str"},   // multi_choice non-array
		{FieldKey: "f_rate_float", Value: 3.5},     // rating non-integer
		{FieldKey: "f_rate_nonnum", Value: "top"},  // rating non-number
		{FieldKey: "f_unknown", Value: "whatever"}, // unknown field key
	}

	errs, err := ValidateAnswers([]byte(schemaRaw), false, answers)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expectedFieldErrors := []string{
		"f_email", "f_num", "f_rate", "f_choice", "f_multi", "f_date",
		"f_text", "f_area", "f_file", "f_num_bool", "f_email_type", "f_choice_type",
		"f_multi_type", "f_rate_float", "f_rate_nonnum", "f_unknown",
	}
	for _, fieldKey := range expectedFieldErrors {
		if _, ok := errs[fieldKey]; !ok {
			t.Errorf("expected error for field %q, got errors: %v", fieldKey, errs)
		}
	}
}

func TestValidateAnswers_ValidValues(t *testing.T) {
	schemaRaw := `{
		"fields": [
			{"key": "f_text", "type": "text", "label": "Text", "required": true},
			{"key": "f_area", "type": "textarea", "label": "Textarea", "required": true},
			{"key": "f_email", "type": "email", "label": "Email", "required": true},
			{"key": "f_num", "type": "number", "label": "Num", "required": true},
			{"key": "f_num_int", "type": "number", "label": "NumInt", "required": true},
			{"key": "f_num_float", "type": "number", "label": "NumFloat", "required": true},
			{"key": "f_num_str", "type": "number", "label": "NumStr", "required": true},
			{"key": "f_rate", "type": "rating", "label": "Rating", "required": true},
			{"key": "f_rate_float", "type": "rating", "label": "RatingFloat", "required": true},
			{"key": "f_choice", "type": "choice", "label": "Choice", "required": true, "options": ["Yes", "No"]},
			{"key": "f_multi", "type": "multi_choice", "label": "Multi", "required": false, "options": ["X", "Y"]},
			{"key": "f_date", "type": "date", "label": "Date", "required": false},
			{"key": "f_file", "type": "file_upload", "label": "File", "required": true},
			{"key": "f_file_obj", "type": "file_upload", "label": "FileObj", "required": true},
			{"key": "f_opt_empty_str", "type": "text", "label": "OptEmptyStr", "required": false},
			{"key": "f_opt_empty_arr", "type": "multi_choice", "label": "OptEmptyArr", "required": false, "options": ["A"]},
			{"key": "f_opt_nil", "type": "choice", "label": "OptNil", "required": false, "options": ["A"]}
		]
	}`

	answers := []Answer{
		{FieldKey: "f_text", Value: "Hello World"},
		{FieldKey: "f_area", Value: "Detailed comments here."},
		{FieldKey: "f_email", Value: "test@example.com"},
		{FieldKey: "f_num", Value: 42},
		{FieldKey: "f_num_int", Value: 100},
		{FieldKey: "f_num_float", Value: 99.5},
		{FieldKey: "f_num_str", Value: "3.14"},
		{FieldKey: "f_rate", Value: 5},
		{FieldKey: "f_rate_float", Value: 4.0},
		{FieldKey: "f_choice", Value: "Yes"},
		{FieldKey: "f_multi", Value: []interface{}{"X", "Y"}},
		{FieldKey: "f_date", Value: "2026-09-18"},
		{FieldKey: "f_file", Value: "https://storage.example.com/uploads/doc.pdf"},
		{FieldKey: "f_file_obj", Value: map[string]interface{}{"name": "doc.pdf", "size": 1024}},
		{FieldKey: "f_opt_empty_str", Value: "   "},
		{FieldKey: "f_opt_empty_arr", Value: []interface{}{}},
		{FieldKey: "f_opt_nil", Value: nil},
	}

	errs, err := ValidateAnswers([]byte(schemaRaw), true, answers)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(errs) != 0 {
		t.Errorf("expected 0 errors for valid answers, got: %v", errs)
	}
}

func TestValidateAnswers_InvalidSchema(t *testing.T) {
	_, err := ValidateAnswers([]byte(`invalid json`), true, []Answer{})
	if err == nil {
		t.Fatalf("expected error for invalid schema JSON, got nil")
	}
}
