package schema

import (
	"encoding/json"
	"fmt"
	"net/mail"
	"regexp"
	"strconv"
	"strings"
)

type Field struct {
	Key      string   `json:"key"`
	Type     string   `json:"type"`
	Label    string   `json:"label"`
	Required bool     `json:"required"`
	Options  []string `json:"options,omitempty"`
}

type Schema struct {
	Fields []Field `json:"fields"`
}

type Answer struct {
	FieldKey string      `json:"field_key"`
	Value    interface{} `json:"value"`
}

var dateRegex = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

func ValidateAnswers(schemaJSON []byte, isComplete bool, answers []Answer) (map[string]string, error) {
	var s Schema
	if err := json.Unmarshal(schemaJSON, &s); err != nil {
		return nil, fmt.Errorf("invalid schema json: %w", err)
	}

	errors := make(map[string]string)
	fieldMap := make(map[string]Field)
	for _, f := range s.Fields {
		fieldMap[f.Key] = f
	}

	answerMap := make(map[string]interface{})
	for _, a := range answers {
		answerMap[a.FieldKey] = a.Value
	}

	// 1. Check required fields if submission is complete
	if isComplete {
		for _, f := range s.Fields {
			if f.Required {
				val, exists := answerMap[f.Key]
				if !exists || isEmptyValue(val) {
					errors[f.Key] = fmt.Sprintf("%s is required.", f.Label)
				}
			}
		}
	}

	// 2. Validate types of provided values
	for _, a := range answers {
		f, ok := fieldMap[a.FieldKey]
		if !ok {
			errors[a.FieldKey] = "Unknown field key."
			continue
		}

		if isEmptyValue(a.Value) {
			continue
		}

		switch f.Type {
		case "text", "textarea":
			if _, ok := a.Value.(string); !ok {
				errors[f.Key] = "Value must be a string."
			}

		case "file_upload":
			switch a.Value.(type) {
			case string, map[string]interface{}:
				// valid file reference or metadata
			default:
				errors[f.Key] = "Invalid file upload value."
			}

		case "email":
			strVal, ok := a.Value.(string)
			if !ok {
				errors[f.Key] = "Email must be a string."
				break
			}
			addr, err := mail.ParseAddress(strVal)
			if err != nil || addr.Address != strVal || !strings.Contains(strVal, "@") || !strings.Contains(strVal, ".") {
				errors[f.Key] = "Invalid email address format."
			}

		case "number":
			switch v := a.Value.(type) {
			case float64:
				// valid json number
			case int:
				// valid
			case string:
				if _, err := strconv.ParseFloat(v, 64); err != nil {
					errors[f.Key] = "Value must be a valid number."
				}
			default:
				errors[f.Key] = "Value must be a valid number."
			}

		case "rating":
			var numVal int
			validNum := false
			switch v := a.Value.(type) {
			case float64:
				// Check if float is an integer
				if v == float64(int(v)) {
					numVal = int(v)
					validNum = true
				}
			case int:
				numVal = v
				validNum = true
			}
			if !validNum || numVal < 1 || numVal > 5 {
				errors[f.Key] = "Rating must be an integer between 1 and 5."
			}

		case "choice":
			strVal, ok := a.Value.(string)
			if !ok {
				errors[f.Key] = "Choice must be a string."
				break
			}
			found := false
			for _, opt := range f.Options {
				if opt == strVal {
					found = true
					break
				}
			}
			if !found {
				errors[f.Key] = "Selected option is not valid."
			}

		case "multi_choice":
			arr, ok := a.Value.([]interface{})
			if !ok {
				errors[f.Key] = "Multi choice must be an array of selected options."
				break
			}
			optSet := make(map[string]bool)
			for _, opt := range f.Options {
				optSet[opt] = true
			}
			for _, item := range arr {
				itemStr, ok := item.(string)
				if !ok || !optSet[itemStr] {
					errors[f.Key] = "One or more selected options are invalid."
					break
				}
			}

		case "date":
			strVal, ok := a.Value.(string)
			if !ok || !dateRegex.MatchString(strVal) {
				errors[f.Key] = "Date must be formatted as YYYY-MM-DD."
			}
		}
	}

	return errors, nil
}

func isEmptyValue(v interface{}) bool {
	if v == nil {
		return true
	}
	switch val := v.(type) {
	case string:
		return strings.TrimSpace(val) == ""
	case []interface{}:
		return len(val) == 0
	case map[string]interface{}:
		return len(val) == 0
	}
	return false
}
