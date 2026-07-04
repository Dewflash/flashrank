'use client';

import React from 'react';
import { Globe } from 'lucide-react';

const REGIONS = [
  { code: 'us', name: 'United States', flag: '🇺🇸' },
  { code: 'gb', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'ca', name: 'Canada', flag: '🇨🇦' },
  { code: 'au', name: 'Australia', flag: '🇦🇺' },
  { code: 'de', name: 'Germany', flag: '🇩🇪' },
  { code: 'fr', name: 'France', flag: '🇫🇷' },
  { code: 'it', name: 'Italy', flag: '🇮🇹' },
  { code: 'es', name: 'Spain', flag: '🇪🇸' },
  { code: 'jp', name: 'Japan', flag: '🇯🇵' },
  { code: 'kr', name: 'South Korea', flag: '🇰🇷' },
  { code: 'cn', name: 'China', flag: '🇨🇳' },
  { code: 'br', name: 'Brazil', flag: '🇧🇷' },
  { code: 'mx', name: 'Mexico', flag: '🇲🇽' },
  { code: 'in', name: 'India', flag: '🇮🇳' },
  { code: 'ru', name: 'Russia', flag: '🇷🇺' },
  { code: 'nl', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'se', name: 'Sweden', flag: '🇸🇪' },
  { code: 'no', name: 'Norway', flag: '🇳🇴' },
  { code: 'dk', name: 'Denmark', flag: '🇩🇰' },
  { code: 'fi', name: 'Finland', flag: '🇫🇮' },
  { code: 'pt', name: 'Portugal', flag: '🇵🇹' },
  { code: 'pl', name: 'Poland', flag: '🇵🇱' },
  { code: 'tr', name: 'Turkey', flag: '🇹🇷' },
  { code: 'sa', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'ae', name: 'UAE', flag: '🇦🇪' },
  { code: 'sg', name: 'Singapore', flag: '🇸🇬' },
  { code: 'hk', name: 'Hong Kong', flag: '🇭🇰' },
  { code: 'tw', name: 'Taiwan', flag: '🇹🇼' },
  { code: 'th', name: 'Thailand', flag: '🇹🇭' },
  { code: 'id', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'ph', name: 'Philippines', flag: '🇵🇭' },
  { code: 'my', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'za', name: 'South Africa', flag: '🇿🇦' },
  { code: 'il', name: 'Israel', flag: '🇮🇱' },
  { code: 'ie', name: 'Ireland', flag: '🇮🇪' },
  { code: 'at', name: 'Austria', flag: '🇦🇹' },
  { code: 'ch', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'be', name: 'Belgium', flag: '🇧🇪' },
];

interface RegionSelectorProps {
  value: string;
  onChange: (region: string) => void;
}

export default function RegionSelector({ value, onChange }: RegionSelectorProps) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <Globe size={14} style={{ position: 'absolute', left: '8px', color: 'var(--text-tertiary)', pointerEvents: 'none', zIndex: 1 }} />
      <select
        className="region-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ paddingLeft: '28px' }}
      >
        {REGIONS.map((region) => (
          <option key={region.code} value={region.code}>
            {region.flag} {region.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export { REGIONS };
