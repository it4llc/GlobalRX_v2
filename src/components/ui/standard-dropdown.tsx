// src/components/ui/standard-dropdown.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';

interface DropdownOption {
  id: string;
  label: string;
  value: string;
}

interface StandardDropdownProps {
  id: string;
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  className?: string;
  width?: string;
}

export function StandardDropdown({
  id,
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  required = false,
  error,
  className = '',
  width = '100%',
}: StandardDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Find the selected option based on value
  const selectedOption = options.find(option => option.value === value);
  
  // Handle clicking outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Toggle dropdown
  const handleToggleDropdown = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };
  
  // Select an option
  const handleSelectOption = (option: DropdownOption) => {
    onChange(option.value);
    setIsOpen(false);
  };
  
  return (
    <div 
      ref={dropdownRef} 
      className={`standard-dropdown ${className}`} 
      style={{ width, height: '28px' }}
    >
      <button
        type="button"
        id={id}
        onClick={handleToggleDropdown}
        className={`
          dropdown-trigger w-full h-7 flex items-center justify-between
          border rounded text-left bg-white
          ${disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400'}
          ${error ? 'border-red-500' : 'border-gray-300'}
          transition-colors
        `}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={`${id}-label`}
      >
        <span className="truncate text-sm">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg 
          width="12" 
          height="12" 
          viewBox="0 0 12 12" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      
      {isOpen && (
        <div 
          className="dropdown-menu"
          role="listbox"
          aria-labelledby={`${id}-label`}
          style={{ width: '100%' }}
        >
          {options.length > 0 ? (
            options.map((option) => (
              <div
                key={option.id}
                className={`
                  dropdown-item
                  ${option.value === value ? 'selected' : ''}
                `}
                onClick={() => handleSelectOption(option)}
                role="option"
                aria-selected={option.value === value}
              >
                <div className="flex items-center">
                  {option.value === value && (
                    <svg 
                      width="16" 
                      height="16" 
                      viewBox="0 0 16 16" 
                      fill="none" 
                      xmlns="http://www.w3.org/2000/svg"
                      className="check-icon mr-2 h-4 w-4 text-blue-600 flex-shrink-0"
                    >
                      <path 
                        d="M13.3334 4L6.00008 11.3333L2.66675 8" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                      />
                    </svg>
                  )}
                  <span className="truncate">{option.label}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="px-3 py-1 text-sm text-gray-500">
              No options available
            </div>
          )}
        </div>
      )}
      
      {error && (
        <p className="form-error text-red-500 text-xs mt-1">{error}</p>
      )}
    </div>
  );
}