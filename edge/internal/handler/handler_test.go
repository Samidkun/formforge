package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type mockStore struct {
	formSlug          string
	formTitle         string
	versionID         string
	schemaJSON        string
	settingsJSON      string
	published         bool
	lastRecordedEvent *EventRecord
}

func (m *mockStore) GetPublishedForm(ctx context.Context, slug string) (*PublishedFormData, error) {
	if !m.published || slug != m.formSlug {
		return nil, ErrNotFound
	}
	return &PublishedFormData{
		FormID:       "00000000-0000-0000-0000-000000000001",
		Slug:         m.formSlug,
		Title:        m.formTitle,
		VersionID:    m.versionID,
		SchemaJSON:   []byte(m.schemaJSON),
		SettingsJSON: []byte(m.settingsJSON),
	}, nil
}

func (m *mockStore) UpsertSubmission(ctx context.Context, sub *SubmissionRecord, answers []AnswerRecord) (string, error) {
	return "sub-12345", nil
}

func (m *mockStore) RecordEvent(ctx context.Context, event *EventRecord) error {
	m.lastRecordedEvent = event
	return nil
}

func TestGetPublishedForm_NotFound(t *testing.T) {
	store := &mockStore{published: false}
	h := NewHandler(store)

	req := httptest.NewRequest(http.MethodGet, "/f/non-existent", nil)
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestGetPublishedForm_Success(t *testing.T) {
	store := &mockStore{
		formSlug:     "contact-us",
		formTitle:    "Contact Us",
		versionID:    "v-1",
		schemaJSON:   `{"fields":[{"key":"f_1","type":"text","label":"Name","required":true}]}`,
		settingsJSON: `{}`,
		published:    true,
	}
	h := NewHandler(store)

	req := httptest.NewRequest(http.MethodGet, "/f/contact-us", nil)
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var res struct {
		Success bool `json:"success"`
		Data    struct {
			Slug      string                 `json:"slug"`
			Title     string                 `json:"title"`
			VersionID string                 `json:"version_id"`
			Schema    map[string]interface{} `json:"schema"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatalf("invalid json response: %v", err)
	}
	if !res.Success || res.Data.Slug != "contact-us" {
		t.Errorf("unexpected response body: %+v", res)
	}
}

func TestSubmitForm_ValidationFailure(t *testing.T) {
	store := &mockStore{
		formSlug:     "survey",
		formTitle:    "Survey",
		versionID:    "v-1",
		schemaJSON:   `{"fields":[{"key":"f_1","type":"email","label":"Email","required":true}]}`,
		settingsJSON: `{}`,
		published:    true,
	}
	h := NewHandler(store)

	// Submit invalid email with complete status
	body := `{"session_id":"a3b4c5d6-0000-0000-0000-000000000001","status":"complete","answers":[{"field_key":"f_1","value":"not-an-email"}]}`
	req := httptest.NewRequest(http.MethodPost, "/f/survey/submit", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d: %s", w.Code, w.Body.String())
	}
}

func TestSubmitForm_Success(t *testing.T) {
	store := &mockStore{
		formSlug:     "survey",
		formTitle:    "Survey",
		versionID:    "v-1",
		schemaJSON:   `{"fields":[{"key":"f_1","type":"text","label":"Name","required":true}]}`,
		settingsJSON: `{}`,
		published:    true,
	}
	h := NewHandler(store)

	body := `{"session_id":"a3b4c5d6-0000-0000-0000-000000000001","status":"complete","answers":[{"field_key":"f_1","value":"Alice"}]}`
	req := httptest.NewRequest(http.MethodPost, "/f/survey/submit", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestSubmitForm_NotFound(t *testing.T) {
	store := &mockStore{published: false}
	h := NewHandler(store)

	body := `{"session_id":"a3b4c5d6-0000-0000-0000-000000000001","status":"complete","answers":[]}`
	req := httptest.NewRequest(http.MethodPost, "/f/non-existent/submit", bytes.NewBufferString(body))
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestSubmitForm_MissingSessionID(t *testing.T) {
	store := &mockStore{
		formSlug:     "survey",
		formTitle:    "Survey",
		versionID:    "v-1",
		schemaJSON:   `{"fields":[]}`,
		settingsJSON: `{}`,
		published:    true,
	}
	h := NewHandler(store)

	body := `{"status":"complete","answers":[]}`
	req := httptest.NewRequest(http.MethodPost, "/f/survey/submit", bytes.NewBufferString(body))
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d", w.Code)
	}
}

func TestSubmitForm_InvalidJSON(t *testing.T) {
	store := &mockStore{
		formSlug:     "survey",
		formTitle:    "Survey",
		versionID:    "v-1",
		schemaJSON:   `{"fields":[]}`,
		settingsJSON: `{}`,
		published:    true,
	}
	h := NewHandler(store)

	body := `{not valid json}`
	req := httptest.NewRequest(http.MethodPost, "/f/survey/submit", bytes.NewBufferString(body))
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestEvent_ValidEvents(t *testing.T) {
	types := []string{"view", "start", "complete", "field_focus", "field_blur"}
	for _, evtType := range types {
		t.Run(evtType, func(t *testing.T) {
			store := &mockStore{
				formSlug:  "test-slug",
				published: true,
			}
			h := NewHandler(store)

			var body string
			if strings.HasPrefix(evtType, "field_") {
				body = fmt.Sprintf(`{"session_id":"a3b4c5d6-0000-0000-0000-000000000001","type":"%s","field_key":"email"}`, evtType)
			} else {
				body = fmt.Sprintf(`{"session_id":"a3b4c5d6-0000-0000-0000-000000000001","type":"%s"}`, evtType)
			}

			req := httptest.NewRequest(http.MethodPost, "/f/test-slug/event", bytes.NewBufferString(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			h.ServeHTTP(w, req)

			if w.Code != http.StatusNoContent {
				t.Fatalf("expected 204, got %d: %s", w.Code, w.Body.String())
			}

			if store.lastRecordedEvent == nil {
				t.Fatalf("expected RecordEvent to be called")
			}
			if store.lastRecordedEvent.FormID != "00000000-0000-0000-0000-000000000001" {
				t.Errorf("expected form ID 00000000-0000-0000-0000-000000000001, got %s", store.lastRecordedEvent.FormID)
			}
			if store.lastRecordedEvent.SessionID != "a3b4c5d6-0000-0000-0000-000000000001" {
				t.Errorf("expected session ID a3b4c5d6-0000-0000-0000-000000000001, got %s", store.lastRecordedEvent.SessionID)
			}
			if store.lastRecordedEvent.Type != evtType {
				t.Errorf("expected event type %s, got %s", evtType, store.lastRecordedEvent.Type)
			}
			if strings.HasPrefix(evtType, "field_") {
				if store.lastRecordedEvent.FieldKey == nil || *store.lastRecordedEvent.FieldKey != "email" {
					t.Errorf("expected field_key email, got %v", store.lastRecordedEvent.FieldKey)
				}
			}
		})
	}
}

func TestEvent_InvalidSessionID(t *testing.T) {
	store := &mockStore{
		formSlug:  "test-slug",
		published: true,
	}
	h := NewHandler(store)

	body := `{"session_id":"invalid-session-uuid","type":"view"}`
	req := httptest.NewRequest(http.MethodPost, "/f/test-slug/event", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d", w.Code)
	}
}

func TestEvent_InvalidType(t *testing.T) {
	store := &mockStore{
		formSlug:  "test-slug",
		published: true,
	}
	h := NewHandler(store)

	body := `{"session_id":"a3b4c5d6-0000-0000-0000-000000000001","type":"invalid_type"}`
	req := httptest.NewRequest(http.MethodPost, "/f/test-slug/event", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d", w.Code)
	}
}

func TestEvent_FormNotFound(t *testing.T) {
	store := &mockStore{
		formSlug:  "test-slug",
		published: false,
	}
	h := NewHandler(store)

	body := `{"session_id":"a3b4c5d6-0000-0000-0000-000000000001","type":"view"}`
	req := httptest.NewRequest(http.MethodPost, "/f/test-slug/event", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestCORS_Options(t *testing.T) {
	store := &mockStore{}
	h := NewHandler(store)

	req := httptest.NewRequest(http.MethodOptions, "/f/survey", nil)
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if w.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Errorf("expected Access-Control-Allow-Origin *")
	}
}

func TestNotFound_InvalidPath(t *testing.T) {
	store := &mockStore{}
	h := NewHandler(store)

	req := httptest.NewRequest(http.MethodGet, "/f/", nil)
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}
