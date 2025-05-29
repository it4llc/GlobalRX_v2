'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface DropdownOption {
  label: string;
  onClick: (() => void) | undefined;
  color?: string;
}

interface DropdownPortalProps {
  options: DropdownOption[];
}

export function DropdownPortal({ options }: DropdownPortalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const dropdownHeight = options.length * 35 + 20; // Approximate height
      
      let top = rect.bottom + 4;
      let showAbove = false;
      
      // Check if dropdown would go off screen bottom
      if (top + dropdownHeight > viewportHeight && rect.top > dropdownHeight) {
        // Show above instead
        top = rect.top - dropdownHeight - 4;
        showAbove = true;
      }
      
      setPosition({
        top: top + window.scrollY,
        left: rect.right - 120 + window.scrollX // Align to right edge
      });
    }
  }, [isOpen, options.length]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleOptionClick = (optionFn: (() => void) | undefined) => {
    if (optionFn) {
      optionFn();
    }
    setIsOpen(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
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
      
      {isOpen && createPortal(
        <div 
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            zIndex: 9999,
            backgroundColor: 'white',
            border: '1px solid rgb(229, 231, 235)',
            borderRadius: '4px',
            boxShadow: 'rgba(0, 0, 0, 0.1) 0px 2px 5px',
            minWidth: '120px'
          }}
        >
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
                cursor: option.onClick ? 'pointer' : 'not-allowed',
                opacity: option.onClick ? 1 : 0.5
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleOptionClick(option.onClick);
              }}
              disabled={!option.onClick}
            >
              {option.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}