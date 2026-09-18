package handler

import (
	"context"
	"encoding/json"
	"regexp"
	"errors"
	"net/http"
	"strings"
	"time"

	"formforge/edge/internal/schema"
)

var ErrNotFound = errors.New("not found")
var uuidRegex = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

type PublishedFormData struct {
	FormID       string
	Slug         string
	Title        string
	VersionID    string
	SchemaJSON   []byte
	SettingsJSON []byte
}

type SubmissionRecord struct {
	FormID    string
	VersionID string
	SessionID string
	Status    string
	StartedAt *time.Time
	Meta      map[string]interface{}
}

type AnswerRecord struct {
	FieldKey string
	Value    interface{}
}

type EventRecord struct {
	FormID    string
	SessionID string
	Type      string
	FieldKey  *string
}

type Store interface {
	GetPublishedForm(ctx context.Context, slug string) (*PublishedFormData, error)
	UpsertSubmission(ctx context.Context, sub *SubmissionRecord, answers []AnswerRecord) (string, error)
	RecordEvent(ctx context.Context, event *EventRecord) error
}

type Handler struct {
	store Store
}

func NewHandler(store Store) *Handler {
	return &Handler{store: store}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if !strings.HasPrefix(r.URL.Path, "/f/") {
		http.NotFound(w, r)
		return
	}

	path := strings.Trim(strings.TrimPrefix(r.URL.Path, "/f/"), "/")
	parts := strings.Split(path, "/")

	if len(parts) == 0 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}

	slug := parts[0]

	if len(parts) == 1 {
		if r.Method == http.MethodGet {
			h.handleGetForm(w, r, slug)
			return
		}
	} else if len(parts) == 2 {
		if parts[1] == "submit" && r.Method == http.MethodPost {
			h.handleSubmit(w, r, slug)
			return
		}
		if parts[1] == "event" && r.Method == http.MethodPost {
			w.WriteHeader(http.StatusNoContent)
			return
		}
	}

	http.NotFound(w, r)
}

func (h *Handler) handleGetForm(w http.ResponseWriter, r *http.Request, slug string) {
	form, err := h.store.GetPublishedForm(r.Context(), slug)
	if errors.Is(err, ErrNotFound) {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{
			"success": false,
			"error": map[string]string{
				"code":    "NOT_FOUND",
				"message": "Form not found or not published.",
			},
			"meta": map[string]string{},
		})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error": map[string]string{
				"code":    "SERVER_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	var schemaObj interface{}
	var settingsObj interface{}
	_ = json.Unmarshal(form.SchemaJSON, &schemaObj)
	_ = json.Unmarshal(form.SettingsJSON, &settingsObj)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"slug":       form.Slug,
			"title":      form.Title,
			"version_id": form.VersionID,
			"schema":     schemaObj,
			"settings":   settingsObj,
		},
		"meta": map[string]string{},
	})
}

type submitPayload struct {
	SessionID string                 `json:"session_id"`
	Status    string                 `json:"status"`
	Answers   []schema.Answer        `json:"answers"`
	Meta      map[string]interface{} `json:"meta"`
}

func (h *Handler) handleSubmit(w http.ResponseWriter, r *http.Request, slug string) {
	form, err := h.store.GetPublishedForm(r.Context(), slug)
	if errors.Is(err, ErrNotFound) {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{
			"success": false,
			"error":   map[string]string{"code": "NOT_FOUND", "message": "Form not found."},
		})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   map[string]string{"code": "SERVER_ERROR", "message": err.Error()},
		})
		return
	}

	var p submitPayload
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   map[string]string{"code": "BAD_REQUEST", "message": "Invalid JSON body."},
		})
		return
	}

	if p.SessionID == "" {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]interface{}{
			"success": false,
			"error":   map[string]string{"code": "VALIDATION_FAILED", "message": "session_id is required."},
		})
		return
	}

	if !uuidRegex.MatchString(p.SessionID) {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]interface{}{
			"success": false,
			"error":   map[string]string{"code": "VALIDATION_FAILED", "message": "session_id must be a valid UUID."},
		})
		return
	}

	if p.Status != "partial" && p.Status != "complete" {
		p.Status = "complete"
	}

	isComplete := p.Status == "complete"
	valErrs, err := schema.ValidateAnswers(form.SchemaJSON, isComplete, p.Answers)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   map[string]string{"code": "SCHEMA_ERROR", "message": err.Error()},
		})
		return
	}

	if len(valErrs) > 0 {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]interface{}{
			"success": false,
			"error": map[string]interface{}{
				"code":    "VALIDATION_FAILED",
				"message": "Submission validation failed.",
				"details": valErrs,
			},
			"meta": map[string]string{},
		})
		return
	}

	var answerRecords []AnswerRecord
	for _, a := range p.Answers {
		answerRecords = append(answerRecords, AnswerRecord{
			FieldKey: a.FieldKey,
			Value:    a.Value,
		})
	}

	subRecord := &SubmissionRecord{
		FormID:    form.FormID,
		VersionID: form.VersionID,
		SessionID: p.SessionID,
		Status:    p.Status,
		Meta:      p.Meta,
	}

	subID, err := h.store.UpsertSubmission(r.Context(), subRecord, answerRecords)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   map[string]string{"code": "DB_ERROR", "message": err.Error()},
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"submission_id": subID,
			"status":        p.Status,
		},
		"meta": map[string]string{},
	})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
