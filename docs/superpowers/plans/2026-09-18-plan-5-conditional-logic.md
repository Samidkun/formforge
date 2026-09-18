# Plan 5: Conditional Logic (Milestone 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the dynamic conditional logic engine: Laravel validates logic rules and prevents cycles/broken references in `FormSchema`, Go edge service evaluates visibility so hidden fields are exempted from `required` validation, Next.js FieldConfigPanel provides a rule builder for `showIf` conditions, and Next.js FormRenderer dynamically displays/hides fields in real-time as user inputs change.

**Architecture:**
- Schema Definition:
  Each field can declare an optional `logic` block:
  ```json
  "logic": {
    "showIf": {
      "field": "f_1",
      "op": "equals" | "not_equals" | "filled" | "empty" | "contains",
      "value": "Yes"
    }
  }
  ```
- Backend (Laravel):
  - `FormSchema::validate`: checks `logic.showIf.field` points to an existing prior field (no forward references, no self references), `op` is valid, and value type is compatible.
- Edge Service (Go):
  - `schema.EvaluateVisibility`: evaluates conditions against provided answers.
  - `schema.ValidateAnswers`: if a required field's condition evaluates to `false` (hidden), it is exempted from required checks.
- Frontend (Next.js):
  - `FieldConfigPanel`: "Syarat Tampil (Conditional Logic)" section allowing selection of prior fields, operator (`equals`, `not_equals`, `filled`, `empty`, `contains`), and target value.
  - `FormRenderer`: evaluates visibility dynamically via `evaluateFieldVisibility(field, answers)`; hidden fields are not rendered and their answers are stripped on submission.

**Tech Stack:** Laravel 12, PHPUnit 12, Go 1.27, Next.js 16 (React 19, TypeScript 5.9.3, Tailwind CSS v4), Vitest 5, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-17-formforge-design.md` §2, §4 (D4), §8 (Milestone 5)

## Global Constraints
- Only allow conditional rules referencing *prior* fields in the schema sequence (enforces DAG, preventing circular loops).
- Supported operators: `equals`, `not_equals`, `filled`, `empty`, `contains`.
- Rukun design tokens (`#16181C`, `#1E2228`, `#252A32`, `#2A2E35`, `#C7F53B`, `#4EE5B6`, `#FF4D4D`, `#F4F5F6`, JetBrains Mono).
- Strict TDD: failing tests first, confirmed failure, minimal code, verified pass, atomic commit.

---

### Task 1: Backend FormSchema Conditional Logic Validation

**Files:**
- Modify: `backend/app/Domain/FormSchema.php`
- Test: `backend/tests/Unit/FormSchemaTest.php`

**Interfaces:**
- Produces: Enhanced `FormSchema::validate(array $schema)` supporting `logic.showIf` rules:
  - Rejects `logic` referencing non-existent field
  - Rejects `logic` referencing self (`field === self.key`)
  - Rejects `logic` referencing a subsequent field (forward reference)
  - Rejects unknown operator (valid ops: `equals`, `not_equals`, `filled`, `empty`, `contains`)

- [x] **Step 1: Write failing unit tests for logic validation**

In `backend/tests/Unit/FormSchemaTest.php`:
```php
    public function test_rejects_logic_referencing_unknown_field(): void
    {
        $schema = [
            'fields' => [
                [
                    'key' => 'f_1',
                    'type' => 'text',
                    'label' => 'Name',
                    'logic' => [
                        'showIf' => ['field' => 'f_99', 'op' => 'filled'],
                    ],
                ],
            ],
        ];

        $errors = FormSchema::validate($schema);
        $this->assertArrayHasKey('fields.0.logic', $errors);
    }

    public function test_rejects_logic_referencing_self_or_forward_field(): void
    {
        $schema = [
            'fields' => [
                [
                    'key' => 'f_1',
                    'type' => 'text',
                    'label' => 'First',
                    'logic' => [
                        'showIf' => ['field' => 'f_2', 'op' => 'filled'],
                    ],
                ],
                [
                    'key' => 'f_2',
                    'type' => 'text',
                    'label' => 'Second',
                ],
            ],
        ];

        $errors = FormSchema::validate($schema);
        $this->assertArrayHasKey('fields.0.logic', $errors);
    }

    public function test_accepts_valid_backward_logic_reference(): void
    {
        $schema = [
            'fields' => [
                [
                    'key' => 'f_1',
                    'type' => 'choice',
                    'label' => 'Role',
                    'options' => ['Student', 'Teacher'],
                ],
                [
                    'key' => 'f_2',
                    'type' => 'text',
                    'label' => 'School Name',
                    'logic' => [
                        'showIf' => ['field' => 'f_1', 'op' => 'equals', 'value' => 'Student'],
                    ],
                ],
            ],
        ];

        $errors = FormSchema::validate($schema);
        $this->assertEmpty($errors);
    }
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd backend && php artisan test tests/Unit/FormSchemaTest.php`
Expected: FAIL (assertion fails or logic ignored).

- [x] **Step 3: Implement logic validation in FormSchema**

Update `backend/app/Domain/FormSchema.php`:
```php
        $seenKeys = [];
        $validOps = ['equals', 'not_equals', 'filled', 'empty', 'contains'];

        foreach ($fields as $index => $field) {
            // ... existing validations ...
            $key = $field['key'];

            if (isset($field['logic'])) {
                if (!is_array($field['logic']) || !isset($field['logic']['showIf']) || !is_array($field['logic']['showIf'])) {
                    $errors["fields.{$index}.logic"] = 'Logic must contain a valid showIf object.';
                } else {
                    $showIf = $field['logic']['showIf'];
                    $refField = $showIf['field'] ?? null;
                    $op = $showIf['op'] ?? null;

                    if (!$refField || !in_array($refField, $seenKeys, true)) {
                        $errors["fields.{$index}.logic"] = 'Conditional logic can only reference preceding fields in the form.';
                    } elseif (!$op || !in_array($op, $validOps, true)) {
                        $errors["fields.{$index}.logic"] = 'Invalid conditional logic operator.';
                    }
                }
            }

            $seenKeys[] = $key;
        }
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd backend && php artisan test tests/Unit/FormSchemaTest.php`
Expected: PASS.

- [x] **Step 5: Run full backend test suite and commit**

Run: `cd backend && php artisan test`
Expected: 77 passed.

```bash
git add backend/app/Domain/FormSchema.php backend/tests/Unit/FormSchemaTest.php
git commit -m "feat(backend): add conditional logic validation preventing circular and forward references"
```

---

### Task 2: Go Edge Service Conditional Visibility Evaluation

**Files:**
- Modify: `edge/internal/schema/validator.go`
- Modify: `edge/internal/schema/validator_test.go`

**Interfaces:**
- Consumes: `Field.Logic` (`ShowIf.Field`, `ShowIf.Op`, `ShowIf.Value`)
- Produces: `IsFieldVisible(f Field, answerMap map[string]interface{}) bool`
- Updates `ValidateAnswers`: only validates `Required` and format for visible fields!

- [x] **Step 1: Write failing unit test for visibility evaluation**

Add tests in `edge/internal/schema/validator_test.go`:
```go
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
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd edge && go test -v ./internal/schema`
Expected: FAIL (`expected 0 errors for hidden required field`).

- [x] **Step 3: Implement visibility evaluation in Go**

In `edge/internal/schema/validator.go`:
```go
type LogicRule struct {
	Field string      `json:"field"`
	Op    string      `json:"op"`
	Value interface{} `json:"value,omitempty"`
}

type Logic struct {
	ShowIf *LogicRule `json:"showIf,omitempty"`
}

// Add Logic *Logic to Field struct
```

Implement `IsFieldVisible`:
- If `f.Logic == nil || f.Logic.ShowIf == nil` -> return `true`
- Check `answerMap[f.Logic.ShowIf.Field]`
- Ops:
  - `filled`: value is not empty
  - `empty`: value is empty or missing
  - `equals`: `fmt.Sprintf("%v", val) == fmt.Sprintf("%v", rule.Value)`
  - `not_equals`: not equals
  - `contains`: string contains or array contains
In `ValidateAnswers`:
- If `!IsFieldVisible(f, answerMap)` -> skip required check and value type validation!

- [x] **Step 4: Run test to verify it passes**

Run: `cd edge && go test -v ./internal/schema`
Expected: PASS (all tests pass).

- [x] **Step 5: Run all Go tests and commit**

Run: `cd edge && go test -v ./... && go vet ./...`
Expected: PASS.

```bash
git add edge/internal/schema/
git commit -m "feat(edge): add conditional logic visibility evaluation in submission validation"
```

---

### Task 3: Frontend Schema Types & Conditional Logic Evaluator

**Files:**
- Modify: `frontend/src/builder/types.ts`
- Create: `frontend/src/builder/logic.ts`
- Test: `frontend/src/builder/logic.test.ts`

**Interfaces:**
- Produces:
  - Types: `LogicRule`, `FieldLogic` in `types.ts`
  - Function: `isFieldVisible(field: FormField, answers: Record<string, any>): boolean`
  - Function: `getAvailableTriggerFields(fields: FormField[], currentFieldKey: string): FormField[]`

- [x] **Step 1: Write unit tests for logic evaluator**

Create `frontend/src/builder/logic.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { isFieldVisible, getAvailableTriggerFields } from './logic'
import { FormField } from './types'

describe('conditional logic evaluator', () => {
  const fields: FormField[] = [
    { key: 'f_1', type: 'choice', label: 'Gender', required: true, options: ['Male', 'Female'] },
    { key: 'f_2', type: 'text', label: 'Maiden Name', required: false, logic: { showIf: { field: 'f_1', op: 'equals', value: 'Female' } } },
    { key: 'f_3', type: 'text', label: 'Other', required: false },
  ]

  it('returns available trigger fields strictly preceding current field', () => {
    const triggers = getAvailableTriggerFields(fields, 'f_2')
    expect(triggers.length).toBe(1)
    expect(triggers[0].key).toBe('f_1')
  })

  it('evaluates equals operator correctly', () => {
    expect(isFieldVisible(fields[1], { f_1: 'Female' })).toBe(true)
    expect(isFieldVisible(fields[1], { f_1: 'Male' })).toBe(false)
    expect(isFieldVisible(fields[1], {})).toBe(false)
  })

  it('evaluates filled and empty operators', () => {
    const filledField: FormField = {
      key: 'f_sub',
      type: 'text',
      label: 'Sub',
      required: false,
      logic: { showIf: { field: 'f_1', op: 'filled' } },
    }
    expect(isFieldVisible(filledField, { f_1: 'Male' })).toBe(true)
    expect(isFieldVisible(filledField, { f_1: '' })).toBe(false)
    expect(isFieldVisible(filledField, {})).toBe(false)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test src/builder/logic.test.ts`
Expected: FAIL (`logic.ts` not found).

- [x] **Step 3: Implement logic.ts and update types.ts**

Update `frontend/src/builder/types.ts`:
Add `LogicOperator = 'equals' | 'not_equals' | 'filled' | 'empty' | 'contains'`, `LogicRule`, `FieldLogic`.
Add `logic?: FieldLogic` to `FormField`.

Create `frontend/src/builder/logic.ts`:
Implement `isFieldVisible` and `getAvailableTriggerFields`.

- [x] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test src/builder/logic.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add frontend/src/builder/types.ts frontend/src/builder/logic.ts frontend/src/builder/logic.test.ts
git commit -m "feat(frontend): add conditional logic rule types and visibility evaluator"
```

---

### Task 4: Frontend Builder FieldConfigPanel Conditional Logic Controls

**Files:**
- Modify: `frontend/src/builder/components/FieldConfigPanel.tsx`
- Test: `frontend/src/builder/components/FieldConfigPanel.test.tsx`

**Interfaces:**
- Consumes: `field: FormField`, `allFields: FormField[]`, `dispatch: React.Dispatch<SchemaAction>`
- Produces: UI section "Syarat Tampil (Logic)" allowing user to enable conditional display, select preceding field, select operator, and enter comparison value.

- [x] **Step 1: Write failing component tests for logic config UI**

In `frontend/src/builder/components/FieldConfigPanel.test.tsx`:
```tsx
  it('renders conditional logic configuration for fields with prior fields', () => {
    const priorField = { key: 'f_1', type: 'choice', label: 'Status', required: true, options: ['A', 'B'] }
    const currentField = { key: 'f_2', type: 'text', label: 'Detail', required: false }

    render(
      <FieldConfigPanel
        field={currentField}
        allFields={[priorField, currentField]}
        dispatch={vi.fn()}
      />
    )

    expect(screen.getByText(/Syarat Tampil/i)).toBeDefined()
  })

  it('dispatches updateField action when conditional logic is set', () => {
    const dispatch = vi.fn()
    const priorField = { key: 'f_1', type: 'text', label: 'Name', required: true }
    const currentField = { key: 'f_2', type: 'text', label: 'Nickname', required: false }

    render(
      <FieldConfigPanel
        field={currentField}
        allFields={[priorField, currentField]}
        dispatch={dispatch}
      />
    )

    const enableCheckbox = screen.getByLabelText(/Aktifkan syarat tampil/i)
    fireEvent.click(enableCheckbox)

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'UPDATE_FIELD',
      payload: expect.objectContaining({
        key: 'f_2',
        field: expect.objectContaining({
          logic: expect.any(Object),
        }),
      }),
    }))
  })
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test src/builder/components/FieldConfigPanel.test.tsx`
Expected: FAIL.

- [x] **Step 3: Implement conditional logic section in FieldConfigPanel**

Add `allFields?: FormField[]` to `FieldConfigPanelProps`.
In `FieldConfigPanel.tsx`:
- Compute `availableTriggers = getAvailableTriggerFields(allFields, field.key)`.
- If `availableTriggers.length > 0`:
  - Show "Syarat Tampil" section.
  - Checkbox to toggle logic on/off.
  - Dropdowns for Trigger Field and Operator.
  - Text/select input for comparison Value (hidden for `filled` and `empty` operators).
  - Update `field.logic` via `dispatch({ type: 'UPDATE_FIELD', payload: { key: field.key, field: { ...field, logic: newLogic } } })`.

Update `BuilderView.tsx` to pass `allFields={schema.fields}` to `FieldConfigPanel`.

- [x] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test`
Expected: PASS.

- [x] **Step 5: Run lint and typecheck**

Run: `cd frontend && npm run lint && npm run typecheck`
Expected: 0 errors.

- [x] **Step 6: Commit**

```bash
git add frontend/src/builder/components/FieldConfigPanel.tsx frontend/src/builder/components/FieldConfigPanel.test.tsx frontend/src/builder/components/BuilderView.tsx
git commit -m "feat(frontend): add conditional logic rule builder in FieldConfigPanel"
```

---

### Task 5: Frontend Public FormRenderer Real-Time Conditional Display

**Files:**
- Modify: `frontend/src/renderer/FormRenderer.tsx`
- Test: `frontend/src/renderer/FormRenderer.test.tsx`

**Interfaces:**
- Consumes: `field.logic`, form user input state `values`
- Produces: Dynamically hides fields when `isFieldVisible(field, values)` is false, ignores hidden fields during required validation, and filters out answers for hidden fields on submit.

- [ ] **Step 1: Write failing component tests for dynamic display**

In `frontend/src/renderer/FormRenderer.test.tsx`:
```tsx
  it('dynamically hides and shows fields based on conditional logic', async () => {
    const logicSchema = {
      fields: [
        { key: 'f_subscribe', type: 'choice', label: 'Subscribe Newsletter?', required: true, options: ['Yes', 'No'] },
        { key: 'f_email', type: 'email', label: 'Email Address', required: true, logic: { showIf: { field: 'f_subscribe', op: 'equals', value: 'Yes' } } },
      ],
    }

    const onSubmit = vi.fn()
    render(<FormRenderer schema={logicSchema} slug="logic-test" onSubmit={onSubmit} />)

    // Initially f_email should be hidden because f_subscribe is empty
    expect(screen.queryByLabelText(/Email Address/i)).toBeNull()

    // Select "Yes"
    const yesOption = screen.getByLabelText('Yes')
    fireEvent.click(yesOption)

    // f_email should now be visible
    expect(screen.getByLabelText(/Email Address/i)).toBeDefined()

    // Select "No"
    const noOption = screen.getByLabelText('No')
    fireEvent.click(noOption)

    // f_email should disappear again
    expect(screen.queryByLabelText(/Email Address/i)).toBeNull()
  })

  it('submits successfully when hidden field is required', async () => {
    const logicSchema = {
      fields: [
        { key: 'f_subscribe', type: 'choice', label: 'Subscribe Newsletter?', required: true, options: ['Yes', 'No'] },
        { key: 'f_email', type: 'email', label: 'Email Address', required: true, logic: { showIf: { field: 'f_subscribe', op: 'equals', value: 'Yes' } } },
      ],
    }

    const onSubmit = vi.fn().mockResolvedValue({ success: true })
    render(<FormRenderer schema={logicSchema} slug="logic-test" onSubmit={onSubmit} />)

    // Select "No"
    fireEvent.click(screen.getByLabelText('No'))

    // Submit form without email
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith([
        { field_key: 'f_subscribe', value: 'No' },
      ])
    })
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test src/renderer/FormRenderer.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement dynamic evaluation in FormRenderer**

In `frontend/src/renderer/FormRenderer.tsx`:
- Import `isFieldVisible` from `@/builder/logic`.
- In render loop: filter or conditionally render fields using `isFieldVisible(field, values)`.
- In `handleSubmit`:
  - Only validate `required` and type format for fields where `isFieldVisible(field, values) === true`.
  - Only include answers for visible fields in `answers` payload.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test`
Expected: PASS.

- [ ] **Step 5: Run lint and typecheck**

Run: `cd frontend && npm run lint && npm run typecheck`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/renderer/FormRenderer.tsx frontend/src/renderer/FormRenderer.test.tsx
git commit -m "feat(frontend): support real-time conditional field visibility in FormRenderer"
```

---

### Task 6: Gerbang Milestone 5 — Local-CI & Playwright E2E Conditional Logic Test

**Files:**
- Create: `frontend/e2e/conditional-logic.spec.ts`
- Test: `scripts/local-ci.sh --tier t0 --fast`

**Interfaces:**
- Produces: Playwright test verifying conditional logic in public form renderer: selecting trigger option reveals dependent field, and submitting without hidden field succeeds.

- [ ] **Step 1: Write Playwright E2E test for conditional logic**

Create `frontend/e2e/conditional-logic.spec.ts`:
```ts
import { test, expect } from '@playwright/test'

test.describe('Conditional Logic E2E', () => {
  test('dynamically shows dependent field and submits successfully', async ({ page }) => {
    // Mock Edge GET /f/logic-survey
    await page.route('**/f/logic-survey', async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              slug: 'logic-survey',
              title: 'Membership Form',
              version_id: 'v-logic-1',
              schema: {
                fields: [
                  {
                    key: 'f_member',
                    type: 'choice',
                    label: 'Do you have membership?',
                    required: true,
                    options: ['Yes', 'No'],
                  },
                  {
                    key: 'f_card_num',
                    type: 'text',
                    label: 'Member ID Number',
                    required: true,
                    logic: {
                      showIf: { field: 'f_member', op: 'equals', value: 'Yes' },
                    },
                  },
                ],
              },
              settings: {},
            },
          }),
        })
      }
      return route.continue()
    })

    // Mock Edge POST /f/logic-survey/submit
    await page.route('**/f/logic-survey/submit', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { submission_id: 'sub-logic-1', status: 'complete' },
        }),
      })
    })

    await page.goto('/f/logic-survey')

    // Member ID Number should be hidden initially
    await expect(page.getByLabel('Member ID Number')).not.toBeVisible()

    // Click "Yes"
    await page.getByLabel('Yes').click()

    // Member ID Number should now be visible
    await expect(page.getByLabel('Member ID Number')).toBeVisible()

    // Fill in Member ID Number
    await page.getByLabel('Member ID Number').fill('MEM-999')

    // Submit
    await page.getByRole('button', { name: /submit/i }).click()

    // Success screen
    await expect(page.getByText(/terima kasih/i)).toBeVisible()
  })
})
```

- [ ] **Step 2: Run Playwright tests and Local-CI**

Run: `cd frontend && npx playwright test e2e/conditional-logic.spec.ts`
Expected: 1 passed.

Run: `bash scripts/local-ci.sh --tier t0 --fast`
Expected: ALL GREEN (all 11 gates pass).

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/conditional-logic.spec.ts
git commit -m "ci: add playwright conditional logic e2e test and verify all local-ci gates for milestone 5"
```
