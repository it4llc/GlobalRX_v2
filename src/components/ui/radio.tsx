// src/components/ui/radio.tsx
"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

const RadioGroup = React.forwardRef<
  HTMLDivElement,
  RadioGroupProps
>(({ className, value, onValueChange, disabled, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("grid gap-2", className)}
      {...props}
    />
  )
})
RadioGroup.displayName = "RadioGroup"

interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Radio = React.forwardRef<
  HTMLInputElement,
  RadioProps
>(({ className, value, checked, onCheckedChange, disabled, ...props }, ref) => {
  const groupContext = React.useContext(RadioGroupContext);
  
  const isChecked = groupContext 
    ? groupContext.value === value
    : checked;
    
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    
    if (groupContext) {
      groupContext.onValueChange(value);
    } else if (onCheckedChange) {
      onCheckedChange(e.target.checked);
    }
  };
  
  return (
    <span className="inline-flex items-center">
      <input
        type="radio"
        ref={ref}
        value={value}
        checked={isChecked}
        onChange={handleChange}
        disabled={disabled || groupContext?.disabled}
        className={cn(
          "h-4 w-4 rounded-full border border-primary text-primary shadow focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
      <span className="ml-1"></span>
    </span>
  )
})
Radio.displayName = "Radio"

// Create a context to share RadioGroup state with Radio children
interface RadioGroupContextType {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

const RadioGroupContext = React.createContext<RadioGroupContextType | undefined>(undefined);

// Update RadioGroup to provide context
const RadioGroupWithContext = React.forwardRef<
  HTMLDivElement,
  RadioGroupProps
>(({ className, value, onValueChange, disabled, ...props }, ref) => {
  const contextValue = React.useMemo(() => ({
    value,
    onValueChange,
    disabled
  }), [value, onValueChange, disabled]);

  return (
    <RadioGroupContext.Provider value={contextValue}>
      <div
        ref={ref}
        className={cn("grid gap-2", className)}
        {...props}
      />
    </RadioGroupContext.Provider>
  )
})
RadioGroupWithContext.displayName = "RadioGroup"

export { RadioGroupWithContext as RadioGroup, Radio }