const MARK = (
  <svg viewBox="0 0 100 100" fill="currentColor" aria-label="Evenum mark" className="h-full w-auto">
    <rect x="6" y="65" width="23" height="29" rx="2.5"/>
    <rect x="38.5" y="40" width="23" height="54" rx="2.5"/>
    <rect x="71" y="8" width="23" height="86" rx="2.5"/>
  </svg>
);

function LogoHorizontal({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${dark ? 'text-white' : 'text-[#003785]'}`}>
      <div className="h-10 w-10 flex-shrink-0">{MARK}</div>
      <span className="font-bold text-3xl tracking-[-0.04em] leading-none" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        EVENUM
      </span>
    </div>
  );
}

function LogoStacked({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-2 ${dark ? 'text-white' : 'text-[#003785]'}`}>
      <div className="h-12 w-12">{MARK}</div>
      <span className="font-bold text-2xl tracking-[-0.04em] leading-none" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        EVENUM
      </span>
    </div>
  );
}

function MarkOnly({ color = '#003785', size = 64 }: { color?: string; size?: number }) {
  return (
    <div style={{ height: size, width: size, color }} className="flex-shrink-0">
      {MARK}
    </div>
  );
}

function SizeRow({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <div className="flex items-center gap-6 px-6 py-3" style={{ background: bg }}>
      <span className="w-20 text-xs font-medium opacity-50" style={{ color: fg, fontFamily: 'Inter, sans-serif' }}>{label}</span>
      {[80, 48, 32, 24, 16].map(s => (
        <div key={s} style={{ height: s, width: s, color: fg, flexShrink: 0 }}>
          {MARK}
        </div>
      ))}
    </div>
  );
}

export function LogoConcepts() {
  return (
    <div className="min-h-screen bg-[#F4F7FB]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Header */}
      <div className="px-16 pt-14 pb-10 border-b border-[#E0E8F2]">
        <p className="text-xs font-semibold tracking-[0.12em] text-[#5A7A9A] uppercase mb-2">Evenum · Brand Identity System</p>
        <h1 className="text-4xl font-bold text-[#0B1F4A] tracking-tight">Logo &amp; Mark</h1>
        <p className="text-base text-[#5A7A9A] mt-2 max-w-lg">
          The Evenum mark is built from three ascending geometric bars — each representing one of the platform's three pillars: Elections, Events, and Campaigns.
        </p>
      </div>

      {/* Primary logo — dark */}
      <div className="mx-16 mt-10 rounded-2xl overflow-hidden" style={{ background: '#003785' }}>
        <div className="px-12 py-10">
          <p className="text-xs font-semibold tracking-[0.1em] text-white/50 uppercase mb-8" style={{ fontFamily: 'Inter, sans-serif' }}>Primary — on brand</p>
          <LogoHorizontal dark />
        </div>
        <div className="border-t border-white/10 px-12 py-10">
          <p className="text-xs font-semibold tracking-[0.1em] text-white/50 uppercase mb-8" style={{ fontFamily: 'Inter, sans-serif' }}>Stacked — on brand</p>
          <LogoStacked dark />
        </div>
      </div>

      {/* Primary logo — light */}
      <div className="mx-16 mt-6 rounded-2xl overflow-hidden border border-[#DDE8F5]" style={{ background: '#FFFFFF' }}>
        <div className="px-12 py-10">
          <p className="text-xs font-semibold tracking-[0.1em] text-[#8AAAC8] uppercase mb-8" style={{ fontFamily: 'Inter, sans-serif' }}>Primary — on light</p>
          <LogoHorizontal />
        </div>
        <div className="border-t border-[#EEF3FA] px-12 py-10">
          <p className="text-xs font-semibold tracking-[0.1em] text-[#8AAAC8] uppercase mb-8" style={{ fontFamily: 'Inter, sans-serif' }}>Stacked — on light</p>
          <LogoStacked />
        </div>
      </div>

      {/* Mark only */}
      <div className="mx-16 mt-6 grid grid-cols-4 gap-4">
        {[
          { bg: '#003785', fg: 'white', label: 'On brand' },
          { bg: '#0B1F4A', fg: 'white', label: 'On dark' },
          { bg: '#FFFFFF', fg: '#003785', label: 'On light' },
          { bg: '#F4F7FB', fg: '#003785', label: 'On surface' },
        ].map(({ bg, fg, label }) => (
          <div key={label} className="rounded-2xl flex flex-col items-center justify-center py-10 gap-4" style={{ background: bg }}>
            <MarkOnly color={fg} size={64} />
            <span className="text-xs font-medium" style={{ color: fg + '80', fontFamily: 'Inter, sans-serif' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Scalability */}
      <div className="mx-16 mt-6 mb-14 rounded-2xl overflow-hidden border border-[#DDE8F5]">
        <div className="px-12 py-6 bg-white border-b border-[#EEF3FA]">
          <p className="text-xs font-semibold tracking-[0.1em] text-[#8AAAC8] uppercase" style={{ fontFamily: 'Inter, sans-serif' }}>Scalability · 80px · 48px · 32px · 24px · 16px</p>
        </div>
        <SizeRow bg="white" fg="#003785" label="On light" />
        <SizeRow bg="#003785" fg="white" label="On brand" />
        <SizeRow bg="#0B1F4A" fg="white" label="On dark" />
      </div>
    </div>
  );
}
