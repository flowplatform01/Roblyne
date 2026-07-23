const MARK = (
  <svg viewBox="0 0 100 100" fill="currentColor" aria-label="Evenum mark" className="h-full w-auto">
    <rect x="6" y="65" width="23" height="29" rx="2.5"/>
    <rect x="38.5" y="40" width="23" height="54" rx="2.5"/>
    <rect x="71" y="8" width="23" height="86" rx="2.5"/>
  </svg>
);

type ScaleItem = { name: string; size: string; weight: string; tracking: string; sample: string; font: string };

const TYPE_SCALE: ScaleItem[] = [
  { name: 'Display', size: '56px', weight: '800', tracking: '-0.04em', sample: 'Democracy runs on Evenum', font: 'jakarta' },
  { name: 'H1', size: '40px', weight: '700', tracking: '-0.03em', sample: 'Board of Directors Election', font: 'jakarta' },
  { name: 'H2', size: '30px', weight: '700', tracking: '-0.02em', sample: 'District 7 Annual Town Hall', font: 'jakarta' },
  { name: 'H3', size: '22px', weight: '600', tracking: '-0.01em', sample: 'Participation & Community Engagement', font: 'jakarta' },
  { name: 'H4', size: '18px', weight: '600', tracking: '0', sample: 'Register to attend this event', font: 'jakarta' },
  { name: 'Body', size: '16px', weight: '400', tracking: '0', sample: 'Evenum is a professional participation platform built for governments, enterprises, and communities.', font: 'inter' },
  { name: 'Small', size: '14px', weight: '400', tracking: '0', sample: 'Paid election · XAF 200 per vote · Active until Dec 31', font: 'inter' },
  { name: 'Caption', size: '12px', weight: '500', tracking: '0.02em', sample: 'ELECTIONS · EVENTS · CAMPAIGNS', font: 'inter' },
  { name: 'Mono', size: '13px', weight: '400', tracking: '0', sample: '#003785 · hsl(215 100% 26%)', font: 'mono' },
];

function fontFamily(font: string) {
  if (font === 'jakarta') return "'Plus Jakarta Sans', sans-serif";
  if (font === 'inter') return "Inter, sans-serif";
  return "ui-monospace, 'JetBrains Mono', monospace";
}

function fontLabel(font: string) {
  if (font === 'jakarta') return 'Plus Jakarta Sans';
  if (font === 'inter') return 'Inter';
  return 'Mono';
}

export function Typography() {
  return (
    <div className="min-h-screen bg-[#F4F7FB] pb-16" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Header */}
      <div className="px-16 pt-14 pb-10 border-b border-[#E0E8F2]">
        <p className="text-xs font-semibold tracking-[0.12em] text-[#5A7A9A] uppercase mb-2">Evenum · Brand Identity System</p>
        <h1 className="text-4xl font-bold text-[#0B1F4A] tracking-tight">Typography</h1>
        <p className="text-base text-[#5A7A9A] mt-2 max-w-lg">
          Two typefaces. One voice. Plus Jakarta Sans for structure and authority. Inter for clarity and readability.
        </p>
      </div>

      <div className="px-16 pt-10 space-y-10">
        {/* Primary typeface showcase */}
        <div className="grid grid-cols-2 gap-5">
          <div className="bg-[#003785] rounded-2xl p-10">
            <p className="text-xs font-semibold tracking-[0.1em] uppercase text-white/50 mb-6" style={{ fontFamily: 'Inter, sans-serif' }}>Display — Plus Jakarta Sans</p>
            <p className="text-6xl font-extrabold text-white tracking-[-0.04em] leading-none mb-2">Aa</p>
            <p className="text-5xl font-bold text-white/30 tracking-tight leading-none">EVENUM</p>
            <div className="mt-8 flex gap-3">
              {['200', '400', '500', '600', '700', '800'].map(w => (
                <div key={w} className="flex flex-col items-center gap-1">
                  <span className="text-2xl text-white leading-none" style={{ fontWeight: parseInt(w) }}>Ee</span>
                  <span className="text-[10px] text-white/40" style={{ fontFamily: 'Inter, sans-serif' }}>{w}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-10 border border-[#DDE8F5]">
            <p className="text-xs font-semibold tracking-[0.1em] uppercase text-[#8AAAC8] mb-6" style={{ fontFamily: 'Inter, sans-serif' }}>Body — Inter</p>
            <p className="text-6xl font-bold text-[#0B1F4A] leading-none mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>Aa</p>
            <p className="text-base text-[#5A7A9A] leading-relaxed max-w-xs" style={{ fontFamily: 'Inter, sans-serif' }}>
              The quick brown fox jumps over the lazy dog. Elections, Events, and Campaigns all in one place.
            </p>
          </div>
        </div>

        {/* Wordmark specimen */}
        <div className="bg-white rounded-2xl p-12 border border-[#DDE8F5]">
          <p className="text-xs font-semibold tracking-[0.1em] uppercase text-[#8AAAC8] mb-8" style={{ fontFamily: 'Inter, sans-serif' }}>Wordmark Specimens</p>
          <div className="space-y-6">
            {[
              { size: '64px', bg: 'transparent', color: '#003785' },
              { size: '42px', bg: 'transparent', color: '#0B1F4A' },
              { size: '28px', bg: 'transparent', color: '#003785' },
            ].map(({ size, color }) => (
              <div key={size} className="flex items-center gap-5" style={{ color }}>
                <div style={{ height: size, aspectRatio: '1', flexShrink: 0 }}>
                  {MARK}
                </div>
                <span className="font-bold tracking-[-0.04em] leading-none" style={{ fontSize: size }}>
                  EVENUM
                </span>
              </div>
            ))}
          </div>
          <div className="mt-8 pt-8 border-t border-[#EEF3FA]">
            <p className="text-xs font-medium text-[#8AAAC8] mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>Wordmark specification</p>
            <div className="grid grid-cols-4 gap-3">
              {[
                { k: 'Typeface', v: 'Plus Jakarta Sans' },
                { k: 'Weight', v: 'Bold · 700' },
                { k: 'Tracking', v: '−0.04em' },
                { k: 'Case', v: 'All capitals' },
              ].map(({ k, v }) => (
                <div key={k} className="bg-[#F4F8FC] rounded-xl p-4">
                  <p className="text-[10px] uppercase tracking-widest text-[#8AAAC8] mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>{k}</p>
                  <p className="text-sm font-semibold text-[#0B1F4A]">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Type scale */}
        <div className="bg-white rounded-2xl border border-[#DDE8F5] overflow-hidden">
          <div className="px-10 py-6 border-b border-[#EEF3FA]">
            <p className="text-xs font-semibold tracking-[0.1em] uppercase text-[#8AAAC8]" style={{ fontFamily: 'Inter, sans-serif' }}>Type Scale</p>
          </div>
          {TYPE_SCALE.map((item, i) => (
            <div key={item.name} className={`flex items-start gap-8 px-10 py-5 ${i < TYPE_SCALE.length - 1 ? 'border-b border-[#F4F7FB]' : ''}`}>
              <div className="w-20 flex-shrink-0 pt-1">
                <p className="text-xs font-semibold text-[#0B1F4A]">{item.name}</p>
                <p className="text-[10px] font-mono text-[#8AAAC8] mt-0.5">{item.size} / {item.weight}</p>
                <p className="text-[9px] rounded px-1.5 py-0.5 mt-1 inline-block" style={{ background: '#EBF2FE', color: '#003785', fontFamily: 'Inter, sans-serif' }}>
                  {fontLabel(item.font)}
                </p>
              </div>
              <p
                className="text-[#0B1F4A] flex-1 leading-snug"
                style={{
                  fontSize: item.size,
                  fontWeight: parseInt(item.weight),
                  letterSpacing: item.tracking,
                  fontFamily: fontFamily(item.font),
                }}
              >
                {item.sample}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
