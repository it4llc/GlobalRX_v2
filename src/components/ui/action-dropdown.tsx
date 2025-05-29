// src/components/ui/action-dropdown.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';

interface ActionOption {
  label: string;
  onClick: () => void;
  color?: string; // Optional color for specific actions like "Disable"
}

interface ActionDropdownProps {
  options: ActionOption[];
}

export function ActionDropdown({ options }: ActionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
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
  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  // Handle option click
  const handleOptionClick = (optionFn: () => void) => {
    optionFn();
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={handleToggle}
        style={{
          backgroundColor: 'rgb(243, 244, 246)',
          color: 'rgb(55, 65, 81)',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <span style={{ marginRight: '4px' }}>Actions</span>
        <span>▼</span>
      </button>
      
      {isOpen && (
        <div 
          style={{
            position: 'absolute',
            top: '100%',
            right: '0px',
            marginTop: '4px',
            zIndex: '50',
            backgroundColor: 'white',
            border: '1px solid rgb(229, 231, 235)',
            borderRadius: '4px',
            boxShadow: 'rgba(0, 0, 0, 0.1) 0px 2px 5px',
            width: '80px'
          }}
        >
          <div>
            {options.map((option, index) => (
              <button
                key={index}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 8px',
                  fontSize: '12px',
                  color: option.color || 'rgb(37, 99, 235)',
                  backgroundColor: 'white',
                  borderTop: 'none',
                  borderRight: 'none',
                  borderBottom: index < options.length - 1 ? '1px solid rgb(243, 244, 246)' : 'none',
                  borderLeft: 'none',
                  borderImage: 'initial',
                  cursor: 'pointer'
                }}
                onClick={() => handleOptionClick(option.onClick)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}