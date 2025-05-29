'use client';

import React, { useState } from 'react';

interface SimpleDropdownOption {
  label: string;
  onClick: () => void;
}

interface SimpleDropdownProps {
  options: SimpleDropdownOption[];
}

export function SimpleDropdown({ options }: SimpleDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '4px 8px',
          borderRadius: '4px',
          border: '1px solid #ccc',
          background: '#f5f5f5',
          cursor: 'pointer'
        }}
      >
        Actions
      </button>
      
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            minWidth: '120px',
            zIndex: 9999
          }}
        >
          {options.map((option, index) => (
            <button
              key={index}
              type="button"
              onClick={() => {
                option.onClick();
                setIsOpen(false);
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                textAlign: 'left',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                borderBottom: index < options.length - 1 ? '1px solid #eee' : 'none'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}