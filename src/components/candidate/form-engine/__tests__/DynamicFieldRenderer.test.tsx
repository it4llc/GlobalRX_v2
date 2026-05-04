// /GlobalRX_v2/src/components/candidate/form-engine/__tests__/DynamicFieldRenderer.test.tsx

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DynamicFieldRenderer } from '../DynamicFieldRenderer';

describe('DynamicFieldRenderer', () => {
  const mockProps = {
    requirementId: 'req-123',
    name: 'First Name',
    fieldKey: 'firstName',
    dataType: 'text',
    isRequired: true,
    value: '',
    onChange: vi.fn(),
    onBlur: vi.fn()
  };

  describe('text input rendering', () => {
    it('should render a text input field with label', () => {
      render(<DynamicFieldRenderer {...mockProps} />);

      expect(screen.getByText('First Name')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByTestId('field-firstName')).toBeInTheDocument();
    });

    it('should show required indicator when field is required', () => {
      render(<DynamicFieldRenderer {...mockProps} />);

      expect(screen.getByText('*')).toBeInTheDocument();
      expect(screen.getByText('*')).toHaveClass('required-indicator');
    });

    it('should not show required indicator when field is not required', () => {
      render(<DynamicFieldRenderer {...mockProps} isRequired={false} />);

      expect(screen.queryByText('*')).not.toBeInTheDocument();
    });

    it('should show required indicator when field is locked and required', () => {
      render(<DynamicFieldRenderer {...mockProps} locked={true} />);

      expect(screen.getByText('*')).toBeInTheDocument();
      expect(screen.getByText('*')).toHaveClass('required-indicator');
    });

    it('should display instructions when provided', () => {
      render(
        <DynamicFieldRenderer
          {...mockProps}
          instructions="Enter your legal first name"
        />
      );

      expect(screen.getByText('Enter your legal first name')).toBeInTheDocument();
    });

    it('should handle onChange events', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<DynamicFieldRenderer {...mockProps} value="" onChange={onChange} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'John');

      // Since value prop is controlled and stays empty, each character is typed individually
      expect(onChange).toHaveBeenCalledTimes(4);
      expect(onChange).toHaveBeenNthCalledWith(1, 'J');
      expect(onChange).toHaveBeenNthCalledWith(2, 'o');
      expect(onChange).toHaveBeenNthCalledWith(3, 'h');
      expect(onChange).toHaveBeenNthCalledWith(4, 'n');
    });

    it('should handle onBlur events', async () => {
      const user = userEvent.setup();
      const onBlur = vi.fn();

      render(<DynamicFieldRenderer {...mockProps} onBlur={onBlur} />);

      const input = screen.getByRole('textbox');
      await user.click(input);
      await user.tab();

      expect(onBlur).toHaveBeenCalled();
    });

    it('should render locked fields as read-only', () => {
      render(
        <DynamicFieldRenderer
          {...mockProps}
          value="John"
          locked={true}
        />
      );

      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input).toHaveAttribute('readonly');
      expect(input).toHaveAttribute('disabled');
      expect(input.value).toBe('John');
      expect(input).toHaveClass('bg-gray-100');
    });
  });

  describe('different field types', () => {
    it('should render date input for date type', () => {
      render(
        <DynamicFieldRenderer
          {...mockProps}
          dataType="date"
          name="Date of Birth"
          fieldKey="dateOfBirth"
        />
      );

      const input = screen.getByTestId('field-dateOfBirth') as HTMLInputElement;
      expect(input).toHaveAttribute('type', 'date');
    });

    it('should render email input for email type', () => {
      render(
        <DynamicFieldRenderer
          {...mockProps}
          dataType="email"
          name="Email Address"
          fieldKey="email"
        />
      );

      const input = screen.getByTestId('field-email') as HTMLInputElement;
      expect(input).toHaveAttribute('type', 'email');
    });

    it('should render phone input for phone type', () => {
      render(
        <DynamicFieldRenderer
          {...mockProps}
          dataType="phone"
          name="Phone Number"
          fieldKey="phone"
        />
      );

      const input = screen.getByTestId('field-phone') as HTMLInputElement;
      expect(input).toHaveAttribute('type', 'tel');
    });

    it('should render number input for number type', () => {
      render(
        <DynamicFieldRenderer
          {...mockProps}
          dataType="number"
          name="Age"
          fieldKey="age"
        />
      );

      const input = screen.getByTestId('field-age') as HTMLInputElement;
      expect(input).toHaveAttribute('type', 'number');
    });

    it('should render select dropdown for select type', () => {
      const fieldData = {
        options: [
          { value: 'us', label: 'United States' },
          { value: 'ca', label: 'Canada' },
          { value: 'uk', label: 'United Kingdom' }
        ]
      };

      render(
        <DynamicFieldRenderer
          {...mockProps}
          dataType="select"
          name="Country"
          fieldKey="country"
          fieldData={fieldData}
        />
      );

      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByText('Select Country')).toBeInTheDocument();
    });

    it('should render disabled dropdown when select has no options', () => {
      render(
        <DynamicFieldRenderer
          {...mockProps}
          dataType="select"
          name="Country"
          fieldKey="country"
          fieldData={{ options: [] }}
        />
      );

      expect(screen.getByText('No options available')).toBeInTheDocument();
    });

    it('should render single checkbox for checkbox type without options', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <DynamicFieldRenderer
          {...mockProps}
          dataType="checkbox"
          name="I agree to the terms"
          fieldKey="agreement"
          fieldData={{}}
          onChange={onChange}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      expect(screen.getByText('I agree to the terms')).toBeInTheDocument();

      await user.click(checkbox);
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('should render checkbox group for checkbox type with options', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const fieldData = {
        options: [
          { value: 'option1', label: 'Option 1' },
          { value: 'option2', label: 'Option 2' },
          { value: 'option3', label: 'Option 3' }
        ]
      };

      render(
        <DynamicFieldRenderer
          {...mockProps}
          dataType="checkbox"
          name="Select Options"
          fieldKey="options"
          fieldData={fieldData}
          value={[]}
          onChange={onChange}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(3);
      expect(screen.getByText('Option 1')).toBeInTheDocument();
      expect(screen.getByText('Option 2')).toBeInTheDocument();
      expect(screen.getByText('Option 3')).toBeInTheDocument();

      await user.click(checkboxes[0]);
      expect(onChange).toHaveBeenCalledWith(['option1']);
    });

    it('should render radio button group for radio type', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const fieldData = {
        options: [
          { value: 'male', label: 'Male' },
          { value: 'female', label: 'Female' },
          { value: 'other', label: 'Other' }
        ]
      };

      render(
        <DynamicFieldRenderer
          {...mockProps}
          dataType="radio"
          name="Gender"
          fieldKey="gender"
          fieldData={fieldData}
          onChange={onChange}
        />
      );

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(3);
      expect(screen.getByText('Male')).toBeInTheDocument();
      expect(screen.getByText('Female')).toBeInTheDocument();
      expect(screen.getByText('Other')).toBeInTheDocument();

      await user.click(radios[0]);
      expect(onChange).toHaveBeenCalledWith('male');
    });
  });

  describe('address block placeholder', () => {
    it('should render placeholder for address_block type', () => {
      render(
        <DynamicFieldRenderer
          {...mockProps}
          dataType="address_block"
          name="Home Address"
          fieldKey="homeAddress"
        />
      );

      expect(screen.getByText('Address fields coming soon')).toBeInTheDocument();
    });
  });

  describe('mobile touch targets', () => {
    it('should have minimum touch target size for inputs', () => {
      render(<DynamicFieldRenderer {...mockProps} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('min-h-[44px]', 'text-base');
    });

    it('should have minimum touch target size for checkboxes', () => {
      render(
        <DynamicFieldRenderer
          {...mockProps}
          dataType="checkbox"
          name="I agree"
          fieldKey="agree"
        />
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveClass('min-w-[44px]', 'min-h-[44px]');
    });

    it('should have minimum touch target size for radio buttons', () => {
      const fieldData = {
        options: [{ value: 'yes', label: 'Yes' }]
      };

      render(
        <DynamicFieldRenderer
          {...mockProps}
          dataType="radio"
          name="Question"
          fieldKey="question"
          fieldData={fieldData}
        />
      );

      const radio = screen.getByRole('radio');
      expect(radio).toHaveClass('min-w-[44px]', 'min-h-[44px]');
    });

    it('should have minimum touch target size for select dropdowns', () => {
      const fieldData = {
        options: [{ value: 'opt1', label: 'Option 1' }]
      };

      render(
        <DynamicFieldRenderer
          {...mockProps}
          dataType="select"
          name="Select"
          fieldKey="select"
          fieldData={fieldData}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toHaveClass('min-h-[44px]', 'text-base');
    });
  });

  describe('error display', () => {
    it('should display error message when provided', () => {
      render(
        <DynamicFieldRenderer
          {...mockProps}
          error="This field is required"
        />
      );

      expect(screen.getByText('This field is required')).toBeInTheDocument();
      expect(screen.getByText('This field is required')).toHaveClass('text-sm', 'text-red-500');
    });
  });

  describe('edge cases', () => {
    it('should handle null value gracefully', () => {
      render(<DynamicFieldRenderer {...mockProps} value={null} />);

      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('should handle undefined value gracefully', () => {
      render(<DynamicFieldRenderer {...mockProps} value={undefined} />);

      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('should handle select options with plain string values', async () => {
      const user = userEvent.setup();
      const fieldData = {
        options: ['Option 1', 'Option 2', 'Option 3']
      };

      render(
        <DynamicFieldRenderer
          {...mockProps}
          dataType="select"
          name="Select"
          fieldKey="select"
          fieldData={fieldData}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();

      // The options should be available even with plain string array
      fireEvent.click(select);
      expect(screen.getByText('Option 1')).toBeInTheDocument();
    });

    it('should default to text input for unknown data types', () => {
      render(
        <DynamicFieldRenderer
          {...mockProps}
          dataType="unknown-type"
        />
      );

      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input).toHaveAttribute('type', 'text');
    });
  });
});