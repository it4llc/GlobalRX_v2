// src/components/ui/checkbox.tsx
"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// Add indeterminate to the type definition
interface CheckboxProps extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  indeterminate?: boolean;
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, style, indeterminate, ...props }, ref) => {
  // Use a ref to access the DOM element
  const innerRef = React.useRef<HTMLButtonElement>(null);
  
  // Combine refs
  React.useEffect(() => {
    if (typeof ref === 'function') {
      ref(innerRef.current);
    } else if (ref) {
      ref.current = innerRef.current;
    }
  }, [ref]);
  
  // Apply indeterminate state using CSS
  const indeterminateClass = indeterminate ? "after:content-[''] after:block after:w-2/3 after:h-0.5 after:bg-current after:absolute after:top-1/2 after:-translate-y-1/2" : "";
  
  return (
    <CheckboxPrimitive.Root
      ref={innerRef}
      className={cn(
        "peer relative rounded-sm border border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
        indeterminateClass,
        className
      )}
      style={{
        height: '16px',
        width: '16px',
        minHeight: '16px',
        minWidth: '16px',
        maxHeight: '16px',
        maxWidth: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxSizing: 'border-box',
        ...style
      }}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn("flex items-center justify-center text-current")}
      >
        <CheckIcon className="h-3 w-3" style={{ margin: 0, padding: 0 }} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
})
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }