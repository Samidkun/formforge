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

func TestValidateAnswers_ConditionalLogic_ExemptsHiddenRequiredField(t *testing.T) {
	schemaRaw := `{
		"fields": [
			{"key": "f_subscribe", "type": "choice", "label": "Subscribe?", "required": true, "options": ["Yes", "No"]},
			{"key": "f_email", "type": "email", "label": "Email", "required": true, "logic": {"showIf": {"field": "f_subscribe", "op": "equals", "value": "Yes"}}}
		]
	}`

	// User answered "No" to subscribe, so email is hidden and should NOT fail required check
	answers := []Answer{
		{FieldKey: "f_subscribe", Value: "No"},
	}

	errs, err := ValidateAnswers([]byte(schemaRaw), true, answers)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(errs) != 0 {
		t.Errorf("expected 0 errors for hidden required field, got: %v", errs)
	}

	// User answered "Yes" to subscribe, so email is visible and MUST fail required check if omitted
	answersYes := []Answer{
		{FieldKey: "f_subscribe", Value: "Yes"},
	}

	errsYes, err := ValidateAnswers([]byte(schemaRaw), true, answersYes)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, ok := errsYes["f_email"]; !ok {
		t.Errorf("expected required error for f_email when condition is met")
	}
}

func TestIsFieldVisible(t *testing.T) {
	// 1. Without logic -> visible
	fNoLogic := Field{Key: "f_1", Type: "text"}
	if !IsFieldVisible(fNoLogic, map[string]interface{}{}) {
		t.Errorf("field without logic should be visible")
	}

	// 2. empty operator
	fEmpty := Field{
		Key:  "f_empty",
		Type: "text",
		Logic: &Logic{
			ShowIf: &LogicRule{Field: "trigger", Op: "empty"},
		},
	}
	if !IsFieldVisible(fEmpty, map[string]interface{}{}) {
		t.Errorf("missing trigger should satisfy 'empty'")
	}
	if !IsFieldVisible(fEmpty, map[string]interface{}{"trigger": ""}) {
		t.Errorf("empty string trigger should satisfy 'empty'")
	}
	if IsFieldVisible(fEmpty, map[string]interface{}{"trigger": "hello"}) {
		t.Errorf("non-empty trigger should NOT satisfy 'empty'")
	}

	// 3. filled operator
	fFilled := Field{
		Key:  "f_filled",
		Type: "text",
		Logic: &Logic{
			ShowIf: &LogicRule{Field: "trigger", Op: "filled"},
		},
	}
	if IsFieldVisible(fFilled, map[string]interface{}{}) {
		t.Errorf("missing trigger should NOT satisfy 'filled'")
	}
	if IsFieldVisible(fFilled, map[string]interface{}{"trigger": ""}) {
		t.Errorf("empty trigger should NOT satisfy 'filled'")
	}
	if !IsFieldVisible(fFilled, map[string]interface{}{"trigger": "hello"}) {
		t.Errorf("filled trigger should satisfy 'filled'")
	}

	// 4. equals operator
	fEquals := Field{
		Key:  "f_eq",
		Type: "text",
		Logic: &Logic{
			ShowIf: &LogicRule{Field: "role", Op: "equals", Value: "Student"},
		},
	}
	if IsFieldVisible(fEquals, map[string]interface{}{}) {
		t.Errorf("missing value should NOT satisfy 'equals'")
	}
	if IsFieldVisible(fEquals, map[string]interface{}{"role": "Teacher"}) {
		t.Errorf("different value should NOT satisfy 'equals'")
	}
	if !IsFieldVisible(fEquals, map[string]interface{}{"role": "Student"}) {
		t.Errorf("matching value should satisfy 'equals'")
	}

	// 5. not_equals operator
	fNotEquals := Field{
		Key:  "f_neq",
		Type: "text",
		Logic: &Logic{
			ShowIf: &LogicRule{Field: "role", Op: "not_equals", Value: "Student"},
		},
	}
	if IsFieldVisible(fNotEquals, map[string]interface{}{}) {
		t.Errorf("missing value should NOT satisfy 'not_equals'")
	}
	if IsFieldVisible(fNotEquals, map[string]interface{}{"role": "Student"}) {
		t.Errorf("matching value should NOT satisfy 'not_equals'")
	}
	if !IsFieldVisible(fNotEquals, map[string]interface{}{"role": "Teacher"}) {
		t.Errorf("different value should satisfy 'not_equals'")
	}

	// 6. contains operator (string and slice)
	fContains := Field{
		Key:  "f_contains",
		Type: "text",
		Logic: &Logic{
			ShowIf: &LogicRule{Field: "tags", Op: "contains", Value: "tech"},
		},
	}
	if IsFieldVisible(fContains, map[string]interface{}{}) {
		t.Errorf("missing value should NOT satisfy 'contains'")
	}
	if !IsFieldVisible(fContains, map[string]interface{}{"tags": "fintech company"}) {
		t.Errorf("string containing substring should satisfy 'contains'")
	}
	if IsFieldVisible(fContains, map[string]interface{}{"tags": "health care"}) {
		t.Errorf("string not containing substring should NOT satisfy 'contains'")
	}
	if !IsFieldVisible(fContains, map[string]interface{}{"tags": []interface{}{"design", "tech"}}) {
		t.Errorf("slice containing item should satisfy 'contains'")
	}
	if !IsFieldVisible(fContains, map[string]interface{}{"tags": []string{"design", "tech"}}) {
		t.Errorf("[]string containing item should satisfy 'contains'")
	}
	if IsFieldVisible(fContains, map[string]interface{}{"tags": []interface{}{"design", "marketing"}}) {
		t.Errorf("slice not containing item should NOT satisfy 'contains'")
	}
}

func TestValidateAnswers_HiddenField_SkipsTypeValidation(t *testing.T) {
	schemaRaw := `{
		"fields": [
			{"key": "f_subscribe", "type": "choice", "label": "Subscribe?", "required": true, "options": ["Yes", "No"]},
			{"key": "f_email", "type": "email", "label": "Email", "required": true, "logic": {"showIf": {"field": "f_subscribe", "op": "equals", "value": "Yes"}}}
		]
	}`

	// User answered "No" to subscribe, but also supplied an invalid email.
	// Since the field is hidden, the answer should be ignored and not produce type validation errors.
	answers := []Answer{
		{FieldKey: "f_subscribe", Value: "No"},
		{FieldKey: "f_email", Value: "not-an-email"},
	}

	errs, err := ValidateAnswers([]byte(schemaRaw), true, answers)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(errs) != 0 {
		t.Errorf("expected 0 errors for hidden field with invalid answer, got: %v", errs)
	}
}

func TestValidateAnswers_FileTypeValidation(t *testing.T) {
	schemaRaw := `{
		"fields": [
			{"key": "f_resume", "type": "file", "label": "Resume File", "required": true}
		]
	}`

	// 1. Valid string answer (URL or filename)
	validStrAnswers := []Answer{
		{FieldKey: "f_resume", Value: "/storage/uploads/resume.pdf"},
	}
	errs, err := ValidateAnswers([]byte(schemaRaw), true, validStrAnswers)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(errs) != 0 {
		t.Errorf("expected 0 errors for valid file string answer, got: %v", errs)
	}

	// 2. Valid map answer (metadata object)
	validMapAnswers := []Answer{
		{
			FieldKey: "f_resume",
			Value: map[string]interface{}{
				"id":       "upl-123",
				"filename": "resume.pdf",
				"url":      "/storage/uploads/resume.pdf",
			},
		},
	}
	errs, err = ValidateAnswers([]byte(schemaRaw), true, validMapAnswers)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(errs) != 0 {
		t.Errorf("expected 0 errors for valid file map answer, got: %v", errs)
	}

	// 3. Invalid answer (integer)
	invalidAnswers := []Answer{
		{FieldKey: "f_resume", Value: 12345},
	}
	errs, err = ValidateAnswers([]byte(schemaRaw), true, invalidAnswers)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(errs) == 0 {
		t.Errorf("expected validation error for invalid file type answer (number), got 0 errors")
	}
}


