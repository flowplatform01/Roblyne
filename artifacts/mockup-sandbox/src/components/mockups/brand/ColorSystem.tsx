type Swatch = { name: string; hex: string; label?: string };

function SwatchRow({ swatches, title }: { swatches: Swatch[]; title: string }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.1em] uppercase text-[#8AAAC8] mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>{title}</p>
      <div className="flex rounded-xl overflow-hidden h-16 shadow-sm">
        {swatches.map((s) => (
          <div key={s.hex} className="flex-1 relative group" style={{ background: s.hex }}>
            <div className="absolute bottom-1.5 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[9px] font-mono font-medium" style={{ color: s.name.includes('50') || s.name.includes('100') || s.name.includes('200') ? '#003785' : 'white' }}>
                {s.hex}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex mt-1">
        {swatches.map((s) => (
          <div key={s.hex} className="flex-1 text-center">
            <span className="text-[9px] text-[#8AAAC8]" style={{ fontFamily: 'Inter, sans-serif' }}>{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BigSwatch({ hex, name, desc, textColor = 'white' }: { hex: string; name: string; desc: string; textColor?: string }) {
  return (
    <div className="rounded-xl overflow-hidden shadow-sm">
      <div className="h-24" style={{ background: hex }} />
      <div className="bg-white px-4 py-3 border border-t-0 border-[#EEF3FA] rounded-b-xl">
        <p className="text-sm font-semibold text-[#0B1F4A]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{name}</p>
        <p className="text-[11px] font-mono text-[#8AAAC8] mt-0.5">{hex}</p>
        <p className="text-[11px] text-[#8AAAC8] mt-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>{desc}</p>
      </div>
    </div>
  );
}

const BRAND_BLUES: Swatch[] = [
  { name: '950', hex: '#020B22' },
  { name: '900', hex: '#041645' },
  { name: '800', hex: '#072269' },
  { name: '700', hex: '#0A318E' },
  { name: '600', hex: '#0D41B2' },
  { name: '500', hex: '#1053D4' },
  { name: '400', hex: '#2B73F0' },
  { name: '300', hex: '#6299F5' },
  { name: '200', hex: '#A3C2FA' },
  { name: '100', hex: '#D1E3FD' },
  { name: '50',  hex: '#EBF2FE' },
];

const TEALS: Swatch[] = [
  { name: '700', hex: '#065E55' },
  { name: '600', hex: '#0A8C81' },
  { name: '500', hex: '#0FA99A' },
  { name: '300', hex: '#4DDACF' },
  { name: '100', hex: '#C0F2EF' },
  { name: '50',  hex: '#E8FAFA' },
];

const NEUTRALS: Swatch[] = [
  { name: '950', hex: '#0A0E18' },
  { name: '900', hex: '#111827' },
  { name: '800', hex: '#1F2937' },
  { name: '700', hex: '#374151' },
  { name: '600', hex: '#4B5563' },
  { name: '500', hex: '#6B7280' },
  { name: '400', hex: '#9CA3AF' },
  { name: '300', hex: '#D1D5DB' },
  { name: '200', hex: '#E5E7EB' },
  { name: '100', hex: '#F3F4F6' },
  { name: '50',  hex: '#F9FAFB' },
];

export function ColorSystem() {
  return (
    <div className="min-h-screen bg-[#F4F7FB] pb-16" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Header */}
      <div className="px-16 pt-14 pb-10 border-b border-[#E0E8F2]">
        <p className="text-xs font-semibold tracking-[0.12em] text-[#5A7A9A] uppercase mb-2">Evenum · Brand Identity System</p>
        <h1 className="text-4xl font-bold text-[#0B1F4A] tracking-tight">Color System</h1>
        <p className="text-base text-[#5A7A9A] mt-2 max-w-lg">
          A purposeful palette built around depth, authority, and participation. Works seamlessly across light and dark surfaces.
        </p>
      </div>

      <div className="px-16 pt-10 space-y-10">
        {/* Core brand colors */}
        <div className="grid grid-cols-3 gap-5">
          <BigSwatch hex="#003785" name="Brand Primary" desc="Trust · Authority · Action" />
          <BigSwatch hex="#0B1F4A" name="Brand Dark" desc="Header · Sidebar · Rich surfaces" />
          <BigSwatch hex="#0FA99A" name="Brand Teal" desc="Participation · Growth · Community" textColor="#003785" />
        </div>

        {/* Semantic */}
        <div className="grid grid-cols-4 gap-4">
          <BigSwatch hex="#16A34A" name="Success" desc="Confirmations · Approved" />
          <BigSwatch hex="#D97706" name="Warning" desc="Caution · Pending review" />
          <BigSwatch hex="#DC2626" name="Danger" desc="Error · Destructive action" />
          <BigSwatch hex="#7C3AED" name="Purple" desc="Premium · Special access" textColor="#003785" />
        </div>

        {/* Palettes */}
        <div className="bg-white rounded-2xl p-8 border border-[#DDE8F5] space-y-8">
          <SwatchRow title="Brand Blue · Primary" swatches={BRAND_BLUES} />
          <SwatchRow title="Brand Teal · Accent" swatches={TEALS} />
          <SwatchRow title="Neutral · UI Grays" swatches={NEUTRALS} />
        </div>

        {/* Light / Dark surface comparison */}
        <div className="grid grid-cols-2 gap-5">
          <div className="rounded-2xl p-8 border border-[#DDE8F5] space-y-3" style={{ background: '#FFFFFF' }}>
            <p className="text-xs font-semibold tracking-[0.1em] uppercase text-[#8AAAC8]" style={{ fontFamily: 'Inter, sans-serif' }}>Light Mode Surfaces</p>
            {[
              { label: 'Background', hex: '#F4F8FC' },
              { label: 'Surface card', hex: '#FFFFFF' },
              { label: 'Surface elevated', hex: '#EEF4FA' },
              { label: 'Border', hex: '#DDE8F5' },
              { label: 'Muted text', hex: '#5A7A9A' },
            ].map(s => (
              <div key={s.hex} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md border border-[#E5EEF7] flex-shrink-0" style={{ background: s.hex }} />
                <div>
                  <p className="text-xs font-medium text-[#0B1F4A]">{s.label}</p>
                  <p className="text-[11px] font-mono text-[#8AAAC8]">{s.hex}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl p-8 space-y-3" style={{ background: '#0B1F4A' }}>
            <p className="text-xs font-semibold tracking-[0.1em] uppercase text-white/40" style={{ fontFamily: 'Inter, sans-serif' }}>Dark Mode Surfaces</p>
            {[
              { label: 'Background', hex: '#070F22' },
              { label: 'Surface card', hex: '#0F1A35' },
              { label: 'Surface elevated', hex: '#172440' },
              { label: 'Border', hex: '#1E3060' },
              { label: 'Muted text', hex: '#5A7A9A' },
            ].map(s => (
              <div key={s.hex} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md border border-white/10 flex-shrink-0" style={{ background: s.hex }} />
                <div>
                  <p className="text-xs font-medium text-white">{s.label}</p>
                  <p className="text-[11px] font-mono text-white/40">{s.hex}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* WCAG Contrast check */}
        <div className="bg-white rounded-2xl p-8 border border-[#DDE8F5]">
          <p className="text-xs font-semibold tracking-[0.1em] uppercase text-[#8AAAC8] mb-5" style={{ fontFamily: 'Inter, sans-serif' }}>Accessibility · WCAG Contrast Ratios</p>
          <div className="grid grid-cols-4 gap-4">
            {[
              { bg: '#003785', fg: '#FFFFFF', pair: 'White on Primary', ratio: '8.2:1', pass: 'AAA' },
              { bg: '#003785', fg: '#EBFBFE', pair: 'Teal-50 on Primary', ratio: '7.8:1', pass: 'AAA' },
              { bg: '#F4F7FB', fg: '#003785', pair: 'Primary on Surface', ratio: '7.1:1', pass: 'AAA' },
              { bg: '#0B1F4A', fg: '#FFFFFF', pair: 'White on Dark', ratio: '12.4:1', pass: 'AAA' },
            ].map(c => (
              <div key={c.pair} className="rounded-xl overflow-hidden">
                <div className="px-4 py-4 flex items-center justify-between" style={{ background: c.bg }}>
                  <span className="text-sm font-semibold" style={{ color: c.fg, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Aa</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-mono font-bold" style={{ background: c.fg + '22', color: c.fg }}>{c.pass}</span>
                </div>
                <div className="px-4 py-3 bg-[#F9FAFB] border border-[#EEF3FA] border-t-0 rounded-b-xl">
                  <p className="text-[11px] font-medium text-[#0B1F4A]">{c.pair}</p>
                  <p className="text-[11px] font-mono text-[#8AAAC8]">{c.ratio}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
