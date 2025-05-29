// src/components/style-guide/color-card.tsx
'use client';

import { useState } from "react";
import { Card } from "@/components/ui/card";

interface ColorCardProps {
  name: string;
  hex: string;
  bg: string;
  text: string;
  border?: string;
}

export function ColorCard({ name, hex, bg, text, border = '' }: ColorCardProps) {
  const [copied, setCopied] = useState(false);

  // Function to copy hex value to clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(hex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="overflow-hidden">
      {/* Color swatch - This should display the actual color */}
      <div 
        className={`h-32 ${bg} ${text} ${border} cursor-pointer relative transition-all duration-200 hover:shadow-inner flex items-center justify-center`}
        onClick={copyToClipboard}
        style={{ backgroundColor: hex }}
      >
        {/* Display the hex value in white or black text depending on color brightness */}
        <span className={getBestTextColor(hex)}>
          {hex}
        </span>
        
        {copied && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white">
            Copied!
          </div>
        )}
      </div>
      <div className="p-3 border-t">
        <p className="font-semibold mb-1">{name}</p>
        <div className="flex flex-col text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">HEX:</span>
            <span className="font-mono">{hex}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-gray-500">Class:</span>
            <span className="font-mono">{bg.replace('bg-', '')}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Helper function to determine whether to use white or black text
// based on the brightness of the background color
function getBestTextColor(hexColor: string): string {
  // Convert hex to RGB
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  
  // Calculate brightness (YIQ formula)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  // Return appropriate text color class
  return brightness >= 128 ? 'text-black' : 'text-white';
}