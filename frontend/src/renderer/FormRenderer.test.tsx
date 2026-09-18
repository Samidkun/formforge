import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FormRenderer } from './FormRenderer';

describe('FormRenderer', () => {
  const basicSchema = {
    fields: [
      { key: 'f_name', type: 'text', label: 'Full Name', required: true },
      { key: 'f_email', type: 'email', label: 'Email Address', required: true },
      { key: 'f_rate', type: 'rating', label: 'Satisfaction', required: false },
      { key: 'f_choice', type: 'choice', label: 'Plan', required: false, options: ['Free', 'Pro'] },
    ],
  };

  const all9TypesSchema = {
    fields: [
      { key: 'f_text', type: 'text', label: 'Full Name', required: true },
      { key: 'f_email', type: 'email', label: 'Email Address', required: true },
      { key: 'f_number', type: 'number', label: 'Age', required: false },
      { key: 'f_textarea', type: 'textarea', label: 'Bio', required: false },
      { key: 'f_choice', type: 'choice', label: 'Role', required: false, options: ['Admin', 'Editor'] },
      { key: 'f_multi', type: 'multi_choice', label: 'Skills', required: false, options: ['React', 'Go', 'PHP'] },
      { key: 'f_rating', type: 'rating', label: 'Rating', required: false },
      { key: 'f_date', type: 'date', label: 'Birth Date', required: false },
      { key: 'f_file', type: 'file_upload', label: 'Resume', required: false },
    ],
  };

  it('renders all fields from schema', () => {
    render(<FormRenderer schema={basicSchema} slug="test-form" onSubmit={vi.fn()} />);
    expect(screen.getByText('Full Name')).toBeDefined();
    expect(screen.getByText('Email Address')).toBeDefined();
    expect(screen.getByText('Satisfaction')).toBeDefined();
    expect(screen.getByText('Plan')).toBeDefined();
  });

  it('renders all 9 field types properly', () => {
    render(<FormRenderer schema={all9TypesSchema} slug="all-types-form" onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/Full Name/i)).toBeDefined();
    expect(screen.getByLabelText(/Email Address/i)).toBeDefined();
    expect(screen.getByLabelText(/Age/i)).toBeDefined();
    expect(screen.getByLabelText(/Bio/i)).toBeDefined();
    expect(screen.getByText('Role')).toBeDefined();
    expect(screen.getByLabelText('Admin')).toBeDefined();
    expect(screen.getByLabelText('Editor')).toBeDefined();
    expect(screen.getByText('Skills')).toBeDefined();
    expect(screen.getByLabelText('React')).toBeDefined();
    expect(screen.getByLabelText('Go')).toBeDefined();
    expect(screen.getByText('Rating')).toBeDefined();
    expect(screen.getByRole('button', { name: '4' })).toBeDefined();
    expect(screen.getByLabelText(/Birth Date/i)).toBeDefined();
    expect(screen.getByLabelText(/Resume/i)).toBeDefined();
  });

  it('supports alias types long_text and file', () => {
    const aliasSchema = {
      fields: [
        { key: 'f_lt', type: 'long_text', label: 'Long Description', required: false },
        { key: 'f_fl', type: 'file', label: 'Attachment', required: false },
      ],
    };
    render(<FormRenderer schema={aliasSchema} slug="alias-form" onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/Long Description/i)).toBeDefined();
    expect(screen.getByLabelText(/Attachment/i)).toBeDefined();
  });

  it('validates required fields before submitting', async () => {
    const onSubmit = vi.fn();
    render(<FormRenderer schema={basicSchema} slug="test-form" onSubmit={onSubmit} />);

    const submitBtn = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(submitBtn);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText(/Full Name is required/i)).toBeDefined();
  });

  it('validates email format before submitting', async () => {
    const onSubmit = vi.fn();
    render(<FormRenderer schema={basicSchema} slug="test-form" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'not-an-email' } });

    const submitBtn = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(submitBtn);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText(/Invalid email address format/i)).toBeDefined();
  });

  it('calls onSubmit with answers when valid', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ success: true });
    render(<FormRenderer schema={basicSchema} slug="test-form" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'alice@example.com' } });

    const submitBtn = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.arrayContaining([
          { field_key: 'f_name', value: 'Alice' },
          { field_key: 'f_email', value: 'alice@example.com' },
        ])
      );
    });
  });

  it('handles interactive inputs for choice, multi_choice, rating, date, and file', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ success: true });
    render(<FormRenderer schema={all9TypesSchema} slug="all-types-form" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Bob' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'bob@example.com' } });
    fireEvent.change(screen.getByLabelText(/Age/i), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText(/Bio/i), { target: { value: 'Hello world' } });

    // Choice
    fireEvent.click(screen.getByLabelText('Admin'));

    // Multi choice
    fireEvent.click(screen.getByLabelText('React'));
    fireEvent.click(screen.getByLabelText('Go'));

    // Rating
    fireEvent.click(screen.getByRole('button', { name: '5' }));

    // Date
    fireEvent.change(screen.getByLabelText(/Birth Date/i), { target: { value: '1995-05-15' } });

    // File
    const file = new File(['dummy content'], 'resume.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/Resume/i), { target: { files: [file] } });

    const submitBtn = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.arrayContaining([
          { field_key: 'f_text', value: 'Bob' },
          { field_key: 'f_email', value: 'bob@example.com' },
          { field_key: 'f_number', value: 30 },
          { field_key: 'f_textarea', value: 'Hello world' },
          { field_key: 'f_choice', value: 'Admin' },
          { field_key: 'f_multi', value: ['React', 'Go'] },
          { field_key: 'f_rating', value: 5 },
          { field_key: 'f_date', value: '1995-05-15' },
          { field_key: 'f_file', value: 'resume.pdf' },
        ])
      );
    });
  });

  it('shows success screen after submission', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ success: true });
    render(<FormRenderer schema={basicSchema} slug="test-form" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'alice@example.com' } });

    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    expect(await screen.findByText(/Thank You!/i)).toBeDefined();
    expect(screen.getByText(/Your response has been recorded/i)).toBeDefined();
  });

  it('displays submission error if onSubmit fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Network error during submission'));
    render(<FormRenderer schema={basicSchema} slug="test-form" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'alice@example.com' } });

    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    expect(await screen.findByText(/Network error during submission/i)).toBeDefined();
  });

  it('shows submitting state and disables submit button', () => {
    render(<FormRenderer schema={basicSchema} slug="test-form" submitting={true} onSubmit={vi.fn()} />);

    const submitBtn = screen.getByRole('button', { name: /submitting\.\.\./i });
    expect(submitBtn).toBeDefined();
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('dynamically hides and shows fields based on conditional logic', async () => {
    const logicSchema = {
      fields: [
        { key: 'f_subscribe', type: 'choice', label: 'Subscribe Newsletter?', required: true, options: ['Yes', 'No'] },
        { key: 'f_email', type: 'email', label: 'Email Address', required: true, logic: { showIf: { field: 'f_subscribe', op: 'equals' as const, value: 'Yes' } } },
      ],
    };

    const onSubmit = vi.fn();
    render(<FormRenderer schema={logicSchema} slug="logic-test" onSubmit={onSubmit} />);

    // Initially f_email should be hidden because f_subscribe is empty
    expect(screen.queryByLabelText(/Email Address/i)).toBeNull();

    // Select "Yes"
    const yesOption = screen.getByLabelText('Yes');
    fireEvent.click(yesOption);

    // f_email should now be visible
    expect(screen.getByLabelText(/Email Address/i)).toBeDefined();

    // Select "No"
    const noOption = screen.getByLabelText('No');
    fireEvent.click(noOption);

    // f_email should disappear again
    expect(screen.queryByLabelText(/Email Address/i)).toBeNull();
  });

  it('submits successfully when hidden field is required', async () => {
    const logicSchema = {
      fields: [
        { key: 'f_subscribe', type: 'choice', label: 'Subscribe Newsletter?', required: true, options: ['Yes', 'No'] },
        { key: 'f_email', type: 'email', label: 'Email Address', required: true, logic: { showIf: { field: 'f_subscribe', op: 'equals' as const, value: 'Yes' } } },
      ],
    };

    const onSubmit = vi.fn().mockResolvedValue({ success: true });
    render(<FormRenderer schema={logicSchema} slug="logic-test" onSubmit={onSubmit} />);

    // Select "No"
    fireEvent.click(screen.getByLabelText('No'));

    // Submit form without email
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith([
        { field_key: 'f_subscribe', value: 'No' },
      ]);
    });
  });

  it('strips hidden fields from answers payload when submitting if field was previously filled', async () => {
    const logicSchema = {
      fields: [
        { key: 'f_subscribe', type: 'choice', label: 'Subscribe Newsletter?', required: true, options: ['Yes', 'No'] },
        { key: 'f_email', type: 'email', label: 'Email Address', required: true, logic: { showIf: { field: 'f_subscribe', op: 'equals' as const, value: 'Yes' } } },
      ],
    };

    const onSubmit = vi.fn().mockResolvedValue({ success: true });
    render(<FormRenderer schema={logicSchema} slug="logic-test" onSubmit={onSubmit} />);

    // Select "Yes"
    fireEvent.click(screen.getByLabelText('Yes'));
    // Enter email
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'alice@example.com' } });

    // Switch to "No" -> email becomes hidden
    fireEvent.click(screen.getByLabelText('No'));

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith([
        { field_key: 'f_subscribe', value: 'No' },
      ]);
    });
  });

  describe('telemetry events', () => {
    it('fires onEvent("start") on first field interaction (focus or change)', () => {
      const onEvent = vi.fn();
      render(<FormRenderer schema={basicSchema} slug="test-form" onEvent={onEvent} />);

      const nameInput = screen.getByLabelText(/Full Name/i);
      fireEvent.focus(nameInput);

      expect(onEvent).toHaveBeenCalledTimes(1);
      expect(onEvent).toHaveBeenCalledWith('start');

      // Subsequent interaction on another field should NOT trigger 'start' again
      const emailInput = screen.getByLabelText(/Email Address/i);
      fireEvent.focus(emailInput);
      fireEvent.change(emailInput, { target: { value: 'alice@example.com' } });

      expect(onEvent).toHaveBeenCalledTimes(1);
    });

    it('fires onEvent("field_blur", fieldKey) on field blur', () => {
      const onEvent = vi.fn();
      render(<FormRenderer schema={basicSchema} slug="test-form" onEvent={onEvent} />);

      const nameInput = screen.getByLabelText(/Full Name/i);
      fireEvent.blur(nameInput);

      expect(onEvent).toHaveBeenCalledWith('field_blur', 'f_name');

      const emailInput = screen.getByLabelText(/Email Address/i);
      fireEvent.blur(emailInput);

      expect(onEvent).toHaveBeenCalledWith('field_blur', 'f_email');
    });

    it('fires onEvent("complete") on successful form submission', async () => {
      const onEvent = vi.fn();
      const onSubmit = vi.fn().mockResolvedValue({ success: true });
      render(<FormRenderer schema={basicSchema} slug="test-form" onSubmit={onSubmit} onEvent={onEvent} />);

      fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Alice' } });
      fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'alice@example.com' } });

      const submitBtn = screen.getByRole('button', { name: /submit/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
        expect(onEvent).toHaveBeenCalledWith('complete');
      });
    });
  });
});
