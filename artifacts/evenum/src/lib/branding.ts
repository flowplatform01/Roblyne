import { useMemo } from 'react';

export const PLATFORM_ACCENT_COLORS = [
  "#4F46E5", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", 
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#6366F1"
];

export function hexToHsl(hex: string): string {
  if (!hex) return "221 83% 53%";
  
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  } else {
    return "221 83% 53%"; // Default primary
  }
  
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function getBrandingStyles(entity: any): React.CSSProperties {
  if (!entity) return {};
  const accentColor = entity.accentColor || "#4F46E5";
  const theme = entity.theme || "evenum";
  
  const hslAccent = hexToHsl(accentColor);
  
  const styles: Record<string, string> = {
    "--primary": hslAccent,
    "--ring": hslAccent,
  };
  
  if (theme === "evenum") {
    styles["--background"] = "215 60% 10%"; // #0A1628
    styles["--foreground"] = "210 40% 98%";
    styles["--card"] = "215 50% 14%";
    styles["--card-foreground"] = "210 40% 98%";
    styles["--border"] = "215 40% 20%";
    styles["--muted"] = "215 40% 16%";
    styles["--muted-foreground"] = "215 20% 65%";
  } else if (theme === "dark") {
    styles["--background"] = "220 10% 10%"; // dark gray
    styles["--foreground"] = "0 0% 98%";
    styles["--card"] = "220 10% 14%";
    styles["--card-foreground"] = "0 0% 98%";
    styles["--border"] = "220 10% 20%";
    styles["--muted"] = "220 10% 16%";
    styles["--muted-foreground"] = "220 10% 65%";
  } else if (theme === "light") {
    styles["--background"] = "0 0% 100%"; // white
    styles["--foreground"] = "220 10% 10%";
    styles["--card"] = "0 0% 100%";
    styles["--card-foreground"] = "220 10% 10%";
    styles["--border"] = "220 10% 90%";
    styles["--muted"] = "220 10% 96%";
    styles["--muted-foreground"] = "220 10% 40%";
  }
  
  return styles as React.CSSProperties;
}

export function useOrgBranding(entity: any) {
  return useMemo(() => getBrandingStyles(entity), [entity?.accentColor, entity?.theme]);
}
