// /GlobalRX_v2/src/components/ui/modal-dialog.test.tsx

import React, { useRef, useEffect } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModalDialog, DialogFooter, type DialogRef } from './modal-dialog';

describe('ModalDialog - Open Prop Support Bug Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('REGRESSION TEST: Declarative Open Prop Support', () => {
    // REGRESSION TEST: proves bug fix for modal dialog open prop support
    it('REGRESSION TEST: should respond to declarative open prop changes', async () => {
      let dialogRef: React.RefObject<DialogRef>;

      // Test component that uses the open prop declaratively
      const TestComponent = ({ open }: { open: boolean }) => {
        const ref = useRef<DialogRef>(null);
        dialogRef = ref;

        return (
          <ModalDialog
            ref={ref}
            title="Test Dialog"
            open={open}  // This prop should control visibility
            onClose={() => {}}
          >
            <div>Dialog content</div>
          </ModalDialog>
        );
      };

      // Initially closed
      const { rerender } = render(<TestComponent open={false} />);

      const dialog = screen.getByRole('dialog', { hidden: true });

      // Bug: Currently the dialog doesn't respond to open prop
      // After fix: Dialog should be closed when open=false
      expect(dialog).not.toHaveAttribute('open');

      // Change to open=true
      rerender(<TestComponent open={true} />);

      // Bug: Currently the dialog stays closed despite open=true
      // After fix: Dialog should automatically open when open=true
      expect(dialog).toHaveAttribute('open');

      // Change back to open=false
      rerender(<TestComponent open={false} />);

      // After fix: Dialog should automatically close when open=false
      expect(dialog).not.toHaveAttribute('open');
    });

    // REGRESSION TEST: proves bug fix for initial open state
    it('REGRESSION TEST: should open dialog immediately when initially rendered with open=true', () => {
      const TestComponent = () => {
        const ref = useRef<DialogRef>(null);

        return (
          <ModalDialog
            ref={ref}
            title="Test Dialog"
            open={true}  // Should be open from the start
            onClose={() => {}}
          >
            <div>Dialog content</div>
          </ModalDialog>
        );
      };

      render(<TestComponent />);

      const dialog = screen.getByRole('dialog');

      // Bug: Currently dialog is closed despite open=true on initial render
      // After fix: Dialog should be open immediately
      expect(dialog).toHaveAttribute('open');
    });

    // REGRESSION TEST: proves bug fix for rapid prop changes
    it('REGRESSION TEST: should handle rapid open prop changes correctly', () => {
      const TestComponent = ({ open }: { open: boolean }) => {
        const ref = useRef<DialogRef>(null);

        return (
          <ModalDialog
            ref={ref}
            title="Test Dialog"
            open={open}
            onClose={() => {}}
          >
            <div>Dialog content</div>
          </ModalDialog>
        );
      };

      const { rerender } = render(<TestComponent open={false} />);
      const dialog = screen.getByRole('dialog', { hidden: true });

      // Start closed
      expect(dialog).not.toHaveAttribute('open');

      // Rapid changes: false -> true -> false -> true
      rerender(<TestComponent open={true} />);
      expect(dialog).toHaveAttribute('open');

      rerender(<TestComponent open={false} />);
      expect(dialog).not.toHaveAttribute('open');

      rerender(<TestComponent open={true} />);
      expect(dialog).toHaveAttribute('open');
    });

    // REGRESSION TEST: proves bug fix for undefined open prop handling
    it('REGRESSION TEST: should handle undefined open prop gracefully', () => {
      const TestComponent = () => {
        const ref = useRef<DialogRef>(null);

        return (
          <ModalDialog
            ref={ref}
            title="Test Dialog"
            // open prop is undefined
            onClose={() => {}}
          >
            <div>Dialog content</div>
          </ModalDialog>
        );
      };

      render(<TestComponent />);
      const dialog = screen.getByRole('dialog', { hidden: true });

      // When open prop is undefined, dialog should remain closed by default
      expect(dialog).not.toHaveAttribute('open');
    });
  });

  describe('Backward Compatibility Tests', () => {
    it('should preserve existing imperative ref control behavior', () => {
      let dialogRef: React.RefObject<DialogRef>;

      const TestComponent = () => {
        const ref = useRef<DialogRef>(null);
        dialogRef = ref;

        return (
          <ModalDialog
            ref={ref}
            title="Test Dialog"
            onClose={() => {}}
          >
            <div>Dialog content</div>
          </ModalDialog>
        );
      };

      render(<TestComponent />);
      const dialog = screen.getByRole('dialog', { hidden: true });

      // Should start closed
      expect(dialog).not.toHaveAttribute('open');

      // Call showModal() via ref
      dialogRef.current?.showModal();
      expect(dialog).toHaveAttribute('open');

      // Call close() via ref
      dialogRef.current?.close();
      expect(dialog).not.toHaveAttribute('open');
    });

    it('should allow imperative control even when open prop is provided', () => {
      let dialogRef: React.RefObject<DialogRef>;

      const TestComponent = () => {
        const ref = useRef<DialogRef>(null);
        dialogRef = ref;

        return (
          <ModalDialog
            ref={ref}
            title="Test Dialog"
            open={false}  // Declarative prop says closed
            onClose={() => {}}
          >
            <div>Dialog content</div>
          </ModalDialog>
        );
      };

      render(<TestComponent />);
      const dialog = screen.getByRole('dialog', { hidden: true });

      // Should start closed due to open=false
      expect(dialog).not.toHaveAttribute('open');

      // Imperative showModal() should still work
      dialogRef.current?.showModal();
      expect(dialog).toHaveAttribute('open');

      // Imperative close() should still work
      dialogRef.current?.close();
      expect(dialog).not.toHaveAttribute('open');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle showModal() called on already-open dialog', () => {
      let dialogRef: React.RefObject<DialogRef>;

      const TestComponent = () => {
        const ref = useRef<DialogRef>(null);
        dialogRef = ref;

        return (
          <ModalDialog
            ref={ref}
            title="Test Dialog"
            open={true}  // Start open
            onClose={() => {}}
          >
            <div>Dialog content</div>
          </ModalDialog>
        );
      };

      render(<TestComponent />);
      const dialog = screen.getByRole('dialog');

      // Should be open initially
      expect(dialog).toHaveAttribute('open');

      // Calling showModal() on already-open dialog should not throw error
      // (In real browsers, this throws an error, so implementation needs try-catch)
      expect(() => {
        dialogRef.current?.showModal();
      }).not.toThrow();

      // Dialog should remain open
      expect(dialog).toHaveAttribute('open');
    });

    it('should handle close() called on already-closed dialog', () => {
      let dialogRef: React.RefObject<DialogRef>;

      const TestComponent = () => {
        const ref = useRef<DialogRef>(null);
        dialogRef = ref;

        return (
          <ModalDialog
            ref={ref}
            title="Test Dialog"
            open={false}  // Start closed
            onClose={() => {}}
          >
            <div>Dialog content</div>
          </ModalDialog>
        );
      };

      render(<TestComponent />);
      const dialog = screen.getByRole('dialog', { hidden: true });

      // Should be closed initially
      expect(dialog).not.toHaveAttribute('open');

      // Calling close() on already-closed dialog should not cause issues
      expect(() => {
        dialogRef.current?.close();
      }).not.toThrow();

      // Dialog should remain closed
      expect(dialog).not.toHaveAttribute('open');
    });

    it('should handle null dialogRef gracefully', () => {
      const TestComponent = () => {
        return (
          <ModalDialog
            ref={null}  // Null ref
            title="Test Dialog"
            open={true}
            onClose={() => {}}
          >
            <div>Dialog content</div>
          </ModalDialog>
        );
      };

      // Should render without crashing even with null ref
      expect(() => {
        render(<TestComponent />);
      }).not.toThrow();
    });

    it('should handle prop changes during component lifecycle', async () => {
      const TestComponent = ({ open, title }: { open: boolean; title: string }) => {
        const ref = useRef<DialogRef>(null);

        return (
          <ModalDialog
            ref={ref}
            title={title}
            open={open}
            onClose={() => {}}
          >
            <div>Dialog content</div>
          </ModalDialog>
        );
      };

      const { rerender } = render(<TestComponent open={false} title="Initial Title" />);
      const dialog = screen.getByRole('dialog', { hidden: true });

      // Should be closed initially
      expect(dialog).not.toHaveAttribute('open');
      expect(screen.getByText('Initial Title')).toBeInTheDocument();

      // Change both open state and title simultaneously
      rerender(<TestComponent open={true} title="Updated Title" />);

      expect(dialog).toHaveAttribute('open');
      expect(screen.getByText('Updated Title')).toBeInTheDocument();
    });
  });

  describe('Integration with onClose Callback', () => {
    it('should call onClose when dialog is closed via X button and open prop is true', async () => {
      const user = userEvent.setup();
      const onCloseMock = vi.fn();

      const TestComponent = () => {
        const ref = useRef<DialogRef>(null);

        return (
          <ModalDialog
            ref={ref}
            title="Test Dialog"
            open={true}  // Dialog is controlled to be open
            onClose={onCloseMock}
          >
            <div>Dialog content</div>
          </ModalDialog>
        );
      };

      render(<TestComponent />);

      // Find and click the close button
      const closeButton = screen.getByLabelText('Close dialog');
      await user.click(closeButton);

      // onClose should be called
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('should handle onClose being undefined', async () => {
      const user = userEvent.setup();

      const TestComponent = () => {
        const ref = useRef<DialogRef>(null);

        return (
          <ModalDialog
            ref={ref}
            title="Test Dialog"
            open={true}
            // onClose is undefined
          >
            <div>Dialog content</div>
          </ModalDialog>
        );
      };

      render(<TestComponent />);

      // Should not crash when clicking close button with undefined onClose
      const closeButton = screen.getByLabelText('Close dialog');
      expect(() => {
        user.click(closeButton);
      }).not.toThrow();
    });
  });

  // NOTE: Declarative (open prop) and imperative (ref.showModal/close) should not be mixed
  // on the same dialog instance. Each dialog should use one approach or the other.

  describe('Component Structure and Accessibility', () => {
    it('should render dialog with correct ARIA attributes', () => {
      const TestComponent = () => {
        const ref = useRef<DialogRef>(null);

        return (
          <ModalDialog
            ref={ref}
            title="Test Dialog"
            open={true}
            onClose={() => {}}
          >
            <div>Dialog content</div>
          </ModalDialog>
        );
      };

      render(<TestComponent />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title');

      const title = screen.getByText('Test Dialog');
      expect(title).toHaveAttribute('id', 'dialog-title');
    });

    it('should render with correct CSS classes and structure', () => {
      const TestComponent = () => {
        const ref = useRef<DialogRef>(null);

        return (
          <ModalDialog
            ref={ref}
            title="Test Dialog"
            maxWidth="lg"
            open={true}
            onClose={() => {}}
          >
            <div data-testid="dialog-content">Dialog content</div>
          </ModalDialog>
        );
      };

      render(<TestComponent />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('p-0', 'rounded-lg', 'shadow-lg', 'max-w-lg');

      const content = screen.getByTestId('dialog-content');
      expect(content).toBeInTheDocument();
    });

    it('should render with custom footer', () => {
      const TestComponent = () => {
        const ref = useRef<DialogRef>(null);

        return (
          <ModalDialog
            ref={ref}
            title="Test Dialog"
            open={true}
            footer={<button>Custom Button</button>}
            onClose={() => {}}
          >
            <div>Dialog content</div>
          </ModalDialog>
        );
      };

      render(<TestComponent />);

      expect(screen.getByRole('button', { name: 'Custom Button' })).toBeInTheDocument();
    });
  });
});

describe('DialogFooter Component', () => {
  it('should render with default button labels', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <DialogFooter
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('should render with custom button labels', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <DialogFooter
        onCancel={onCancel}
        onConfirm={onConfirm}
        cancelText="Go Back"
        confirmText="Save Changes"
      />
    );

    expect(screen.getByRole('button', { name: 'Go Back' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
  });

  it('should show loading state', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <DialogFooter
        onCancel={onCancel}
        onConfirm={onConfirm}
        loading={true}
      />
    );

    expect(screen.getByRole('button', { name: 'Loading...' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Loading...' })).toBeDisabled();
  });

  it('should handle disabled state', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <DialogFooter
        onCancel={onCancel}
        onConfirm={onConfirm}
        disabled={true}
      />
    );

    expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
  });

  it('should call callbacks when buttons are clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <DialogFooter
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});