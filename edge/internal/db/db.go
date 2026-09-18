package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"formforge/edge/internal/handler"

	_ "github.com/lib/pq"
)

type PostgresStore struct {
	db *sql.DB
}

func NewPostgresStore(connStr string) (*PostgresStore, error) {
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open db: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping db: %w", err)
	}

	return &PostgresStore{db: db}, nil
}

func (p *PostgresStore) GetPublishedForm(ctx context.Context, slug string) (*handler.PublishedFormData, error) {
	query := `
		SELECT f.id, f.slug, f.title, f.current_version_id, v.schema, COALESCE(f.settings, '{}'::jsonb)
		FROM forms f
		JOIN form_versions v ON f.current_version_id = v.id
		WHERE f.slug = $1 AND f.status = 'published'
		LIMIT 1
	`

	var formID, formSlug, title, versionID string
	var schemaBytes, settingsBytes []byte

	err := p.db.QueryRowContext(ctx, query, slug).Scan(
		&formID, &formSlug, &title, &versionID, &schemaBytes, &settingsBytes,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, handler.ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query published form: %w", err)
	}

	return &handler.PublishedFormData{
		FormID:       formID,
		Slug:         formSlug,
		Title:        title,
		VersionID:    versionID,
		SchemaJSON:   schemaBytes,
		SettingsJSON: settingsBytes,
	}, nil
}

func (p *PostgresStore) UpsertSubmission(ctx context.Context, sub *handler.SubmissionRecord, answers []handler.AnswerRecord) (string, error) {
	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	metaJSON, err := json.Marshal(sub.Meta)
	if err != nil {
		metaJSON = []byte("{}")
	}

	upsertQuery := `
		INSERT INTO submissions (id, form_id, form_version_id, session_id, status, started_at, completed_at, meta, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
		ON CONFLICT (form_id, session_id) DO UPDATE SET
			form_version_id = EXCLUDED.form_version_id,
			status = EXCLUDED.status,
			completed_at = CASE WHEN EXCLUDED.status = 'complete' THEN NOW() ELSE submissions.completed_at END,
			meta = EXCLUDED.meta,
			updated_at = NOW()
		RETURNING id
	`

	var submissionID string
	var completedAt *time.Time
	if sub.Status == "complete" {
		now := time.Now()
		completedAt = &now
	}

	startedAt := sub.StartedAt
	if startedAt == nil {
		now := time.Now()
		startedAt = &now
	}

	err = tx.QueryRowContext(ctx, upsertQuery,
		sub.FormID, sub.VersionID, sub.SessionID, sub.Status, startedAt, completedAt, metaJSON,
	).Scan(&submissionID)
	if err != nil {
		return "", fmt.Errorf("failed to upsert submission: %w", err)
	}

	// Insert or replace answers
	for _, ans := range answers {
		valJSON, err := json.Marshal(ans.Value)
		if err != nil {
			valJSON = []byte("null")
		}

		ansQuery := `
			INSERT INTO submission_answers (submission_id, field_key, value, created_at, updated_at)
			VALUES ($1, $2, $3, NOW(), NOW())
			ON CONFLICT (submission_id, field_key) DO UPDATE SET
				value = EXCLUDED.value,
				updated_at = NOW()
		`
		if _, err := tx.ExecContext(ctx, ansQuery, submissionID, ans.FieldKey, valJSON); err != nil {
			return "", fmt.Errorf("failed to upsert answer %s: %w", ans.FieldKey, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return "", err
	}

	return submissionID, nil
}

func (p *PostgresStore) RecordEvent(ctx context.Context, event *handler.EventRecord) error {
	// Table form_events is created in milestone 6 for analytics, placeholder for now
	return nil
}
