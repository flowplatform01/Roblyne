import React from 'react';
import { PLATFORM_ACCENT_COLORS } from '@/lib/branding';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface AccentColorPickerProps {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}

export function AccentColorPicker({ value, onChange, className }: AccentColorPickerProps) {
  const isCustom = value && !PLATFORM_ACCENT_COLORS.includes(value.toUpperCase());
  
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap gap-2">
        {PLATFORM_ACCENT_COLORS.map(color => (
          <button
            key={color}
            type="button"
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all hover:scale-110",
              value?.toUpperCase() === color ? "border-foreground" : "border-transparent"
            )}
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
          >
            {value?.toUpperCase() === color && <Check className="w-4 h-4 text-white drop-shadow-md" />}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Custom:</span>
        <div className="relative flex items-center">
          <div 
            className="w-6 h-6 rounded border absolute left-2 z-10" 
            style={{ backgroundColor: isCustom ? value : 'transparent' }} 
          />
          <Input 
            type="text" 
            placeholder="#000000" 
            value={isCustom ? value : ''} 
            onChange={e => onChange(e.target.value)}
            className="pl-10 h-9 w-32 font-mono text-sm uppercase"
          />
        </div>
      </div>
    </div>
  );
}
