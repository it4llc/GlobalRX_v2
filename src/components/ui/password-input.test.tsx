// /GlobalRX_v2/src/components/ui/password-input.test.tsx

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordInput } from './password-input';

describe('PasswordInput', () => {
  describe('rendering', () => {
    it('should render as password type by default', () => {
      const { container } = render(<PasswordInput />);

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input).toHaveAttribute('type', 'password');
    });

    it('should render show/hide toggle button by default', () => {
      render(<PasswordInput />);

      const toggleButton = screen.getByRole('button', { name: /show password/i });
      expect(toggleButton).toBeInTheDocument();
    });

    it('should hide toggle button when showToggle is false', () => {
      render(<PasswordInput showToggle={false} />);

      const toggleButton = screen.queryByRole('button', { name: /show password|hide password/i });
      expect(toggleButton).not.toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(<PasswordInput className="custom-class h-11" />);

      const input = container.querySelector('input');
      expect(input).toHaveClass('custom-class');
      expect(input).toHaveClass('h-11');
    });

    it('should forward props to input element', () => {
      const { container } = render(
        <PasswordInput
          placeholder="Enter password"
          disabled
          required
          autoComplete="new-password"
          id="password-field"
        />
      );

      const input = container.querySelector('input');
      expect(input).toHaveAttribute('placeholder', 'Enter password');
      expect(input).toBeDisabled();
      expect(input).toHaveAttribute('required');
      expect(input).toHaveAttribute('autocomplete', 'new-password');
      expect(input).toHaveAttribute('id', 'password-field');
    });

    it('should have pr-12 padding to accommodate toggle button', () => {
      const { container } = render(<PasswordInput />);

      const input = container.querySelector('input');
      expect(input).toHaveClass('pr-12');
    });
  });

  describe('toggle functionality', () => {
    it('should toggle password visibility when clicking toggle button', async () => {
      const user = userEvent.setup();
      const { container } = render(<PasswordInput />);

      const input = container.querySelector('input') as HTMLInputElement;
      const toggleButton = screen.getByRole('button', { name: /show password/i });

      // Initially password type
      expect(input).toHaveAttribute('type', 'password');
      expect(toggleButton).toHaveAttribute('aria-label', 'Show password');

      // Click to show
      await user.click(toggleButton);
      expect(input).toHaveAttribute('type', 'text');
      expect(toggleButton).toHaveAttribute('aria-label', 'Hide password');

      // Click to hide again
      await user.click(toggleButton);
      expect(input).toHaveAttribute('type', 'password');
      expect(toggleButton).toHaveAttribute('aria-label', 'Show password');
    });

    it('should show Eye icon when password is hidden', () => {
      render(<PasswordInput />);

      const eyeIcon = document.querySelector('.lucide-eye');
      expect(eyeIcon).toBeInTheDocument();
    });

    it('should show EyeOff icon when password is visible', async () => {
      const user = userEvent.setup();
      render(<PasswordInput />);

      const toggleButton = screen.getByRole('button', { name: /show password/i });
      await user.click(toggleButton);

      const eyeOffIcon = document.querySelector('.lucide-eye-off');
      expect(eyeOffIcon).toBeInTheDocument();
    });

    it('should have tabIndex -1 on toggle button to skip in tab order', () => {
      render(<PasswordInput />);

      const toggleButton = screen.getByRole('button', { name: /show password/i });
      expect(toggleButton).toHaveAttribute('tabIndex', '-1');
    });

    it('should not submit form when toggle button is clicked', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn((e: Event) => e.preventDefault());

      const { container } = render(
        <form onSubmit={mockSubmit}>
          <PasswordInput />
          <button type="submit">Submit</button>
        </form>
      );

      const form = container.querySelector('form');
      form?.addEventListener('submit', mockSubmit);

      const toggleButton = screen.getByRole('button', { name: /show password/i });
      await user.click(toggleButton);

      expect(mockSubmit).not.toHaveBeenCalled();
    });
  });

  describe('styling', () => {
    it('should apply ghost variant to toggle button', () => {
      render(<PasswordInput />);

      const toggleButton = screen.getByRole('button', { name: /show password/i });
      // The button should have hover:text-accent-foreground which is part of the ghost variant
      expect(toggleButton).toHaveClass('hover:text-accent-foreground');
    });

    it('should position toggle button absolutely at right side', () => {
      render(<PasswordInput />);

      const toggleButton = screen.getByRole('button', { name: /show password/i });
      expect(toggleButton).toHaveClass('absolute');
      expect(toggleButton).toHaveClass('right-0');
      expect(toggleButton).toHaveClass('top-0');
      expect(toggleButton).toHaveClass('h-full');
    });

    it('should style icons with gray color', () => {
      render(<PasswordInput />);

      const icon = document.querySelector('.lucide-eye');
      expect(icon).toHaveClass('text-gray-500');
      expect(icon).toHaveClass('h-4');
      expect(icon).toHaveClass('w-4');
    });

    it('should have hover state disabled on toggle button', () => {
      render(<PasswordInput />);

      const toggleButton = screen.getByRole('button', { name: /show password/i });
      expect(toggleButton).toHaveClass('hover:bg-transparent');
    });
  });

  describe('accessibility', () => {
    it('should have appropriate aria-label on toggle button', () => {
      render(<PasswordInput />);

      const toggleButton = screen.getByRole('button');
      expect(toggleButton).toHaveAttribute('aria-label', 'Show password');
    });

    it('should update aria-label when toggled', async () => {
      const user = userEvent.setup();
      render(<PasswordInput />);

      const toggleButton = screen.getByRole('button');

      expect(toggleButton).toHaveAttribute('aria-label', 'Show password');

      await user.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-label', 'Hide password');

      await user.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-label', 'Show password');
    });

    it('should maintain focus on input when typing', async () => {
      const user = userEvent.setup();
      const { container } = render(<PasswordInput />);

      const input = container.querySelector('input') as HTMLInputElement;

      await user.click(input);
      expect(input).toHaveFocus();

      await user.type(input, 'password123');
      expect(input).toHaveFocus();
      expect(input).toHaveValue('password123');
    });
  });

  describe('ref forwarding', () => {
    it('should forward ref to input element', () => {
      const ref = React.createRef<HTMLInputElement>();
      render(<PasswordInput ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLInputElement);
      expect(ref.current?.tagName).toBe('INPUT');
    });

    it('should allow programmatic focus via ref', () => {
      const ref = React.createRef<HTMLInputElement>();
      render(<PasswordInput ref={ref} />);

      ref.current?.focus();
      expect(ref.current).toHaveFocus();
    });

    it('should allow programmatic value setting via ref', () => {
      const ref = React.createRef<HTMLInputElement>();
      render(<PasswordInput ref={ref} />);

      if (ref.current) {
        ref.current.value = 'programmatic-value';
      }

      expect(ref.current?.value).toBe('programmatic-value');
    });
  });
});