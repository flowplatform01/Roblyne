const MARK = (
  <svg viewBox="0 0 100 100" fill="currentColor" className="h-full w-auto">
    <rect x="6" y="65" width="23" height="29" rx="2.5"/>
    <rect x="38.5" y="40" width="23" height="54" rx="2.5"/>
    <rect x="71" y="8" width="23" height="86" rx="2.5"/>
  </svg>
);

const BRAND_BLUES = ['#020B22','#041645','#072269','#0A318E','#0D41B2','#003785','#2B73F0','#6299F5','#A3C2FA','#D1E3FD','#EBF2FE'];
const TEALS = ['#065E55','#0A8C81','#0FA99A','#4DDACF','#C0F2EF','#E8FAFA'];
const NEUTRALS = ['#0A0E18','#111827','#1F2937','#374151','#4B5563','#6B7280','#9CA3AF','#D1D5DB','#E5E7EB','#F3F4F6','#F9FAFB'];

export function BrandOverview() {
  return (
    <div className="min-h-screen" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#F4F7FB' }}>

      {/* Hero — the mark */}
      <div className="flex flex-col items-center justify-center py-24 px-16" style={{ background: '#003785' }}>
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-white/40 mb-12" style={{ fontFamily: 'Inter, sans-serif' }}>Evenum · Official Brand Identity System · 2025</p>
        <div className="h-32 w-32 text-white mb-8">{MARK}</div>
        <h1 className="text-7xl font-extrabold text-white tracking-[-0.05em] leading-none">EVENUM</h1>
        <p className="text-white/60 text-lg mt-6 max-w-md text-center" style={{ fontFamily: 'Inter, sans-serif' }}>
          The professional participation platform for Elections, Events, and Campaigns.
        </p>
        <div className="flex gap-4 mt-10">
          {['Elections & Voting', 'Events & Ticketing', 'Campaigns & Engagement'].map((p, i) => (
            <div key={p} className="px-4 py-2 rounded-full text-sm font-medium" style={{ background: 'rgba(255,255,255,0.12)', color: 'white', fontFamily: 'Inter, sans-serif' }}>
              {p}
            </div>
          ))}
        </div>
      </div>

      {/* The concept */}
      <div className="px-16 py-14 border-b border-[#E0E8F2] bg-white">
        <div className="max-w-5xl mx-auto grid grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] uppercase text-[#5A7A9A] mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>Brand Concept</p>
            <h2 className="text-3xl font-bold text-[#0B1F4A] tracking-tight mb-4">The Ascent</h2>
            <p className="text-[#5A7A9A] text-base leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              Three ascending geometric bars — each representing one of Evenum's three pillars. They read simultaneously as signal bars (reach, connection), a rising chart (growth, momentum), and three unified elements forming one system. Bold, scalable, and instantly recognizable at any size.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-4">
              {['Elections', 'Events', 'Campaigns'].map((p, i) => (
                <div key={p} className="text-center">
                  <div className="h-12 flex items-end justify-center gap-0.5 mb-3">
                    {[0,1,2].map(j => (
                      <div key={j} className="w-3 rounded-sm" style={{ height: `${(j <= i ? (i === 0 ? 33 : i === 1 ? 60 : 100) : 20)}%`, background: j <= i ? '#003785' : '#DDE8F5' }} />
                    ))}
                  </div>
                  <p className="text-xs font-semibold text-[#0B1F4A]">{p}</p>
                  <p className="text-[10px] text-[#8AAAC8]" style={{ fontFamily: 'Inter, sans-serif' }}>Pillar {i + 1}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-5">
            {[
              { bg: '#003785', fg: 'white', label: 'Primary — on brand' },
              { bg: '#0B1F4A', fg: 'white', label: 'On dark' },
              { bg: '#FFFFFF', fg: '#003785', label: 'On light' },
            ].map(({ bg, fg, label }) => (
              <div key={label} className="flex items-center gap-5 px-6 py-5 rounded-2xl" style={{ background: bg }}>
                <div className="h-12 w-12 flex-shrink-0" style={{ color: fg }}>{MARK}</div>
                <span className="font-bold text-2xl tracking-[-0.04em]" style={{ color: fg }}>EVENUM</span>
                <span className="ml-auto text-xs font-medium" style={{ color: fg + '80', fontFamily: 'Inter, sans-serif' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Color system */}
      <div className="px-16 py-14 bg-[#F4F7FB]">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold tracking-[0.12em] uppercase text-[#5A7A9A] mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>Color System</p>
          <h2 className="text-3xl font-bold text-[#0B1F4A] tracking-tight mb-8">Purposeful Palette</h2>
          
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { hex: '#003785', name: 'Brand Primary', desc: 'Trust · Action · Authority' },
              { hex: '#0B1F4A', name: 'Brand Dark', desc: 'Depth · Premium · Structure' },
              { hex: '#0FA99A', name: 'Brand Teal', desc: 'Participation · Growth · Community' },
            ].map(c => (
              <div key={c.hex} className="rounded-2xl overflow-hidden shadow-sm">
                <div className="h-20" style={{ background: c.hex }} />
                <div className="bg-white p-4 border border-t-0 border-[#EEF3FA] rounded-b-2xl">
                  <p className="font-semibold text-[#0B1F4A] text-sm">{c.name}</p>
                  <p className="text-[11px] font-mono text-[#8AAAC8]">{c.hex}</p>
                  <p className="text-[11px] text-[#8AAAC8] mt-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>{c.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {[
            { title: 'Brand Blue', swatches: BRAND_BLUES },
            { title: 'Brand Teal', swatches: TEALS },
            { title: 'Neutral', swatches: NEUTRALS },
          ].map(({ title, swatches }) => (
            <div key={title} className="mb-4">
              <p className="text-xs font-medium text-[#8AAAC8] mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>{title}</p>
              <div className="flex h-10 rounded-xl overflow-hidden shadow-sm">
                {swatches.map(hex => <div key={hex} className="flex-1" style={{ background: hex }} />)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Typography */}
      <div className="px-16 py-14 bg-white border-y border-[#E0E8F2]">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold tracking-[0.12em] uppercase text-[#5A7A9A] mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>Typography</p>
          <h2 className="text-3xl font-bold text-[#0B1F4A] tracking-tight mb-8">Two Typefaces. One Voice.</h2>
          <div className="grid grid-cols-2 gap-8">
            <div className="border border-[#EEF3FA] rounded-2xl p-8">
              <p className="text-xs uppercase tracking-widest text-[#8AAAC8] mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>Display · Plus Jakarta Sans</p>
              <p className="text-5xl font-extrabold text-[#0B1F4A] tracking-[-0.04em] mb-2">Democracy</p>
              <p className="text-3xl font-bold text-[#003785] tracking-[-0.03em] mb-2">runs on</p>
              <p className="text-2xl font-bold text-[#5A7A9A] tracking-[-0.02em]">Evenum.</p>
            </div>
            <div className="border border-[#EEF3FA] rounded-2xl p-8">
              <p className="text-xs uppercase tracking-widest text-[#8AAAC8] mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>Body · Inter</p>
              <p className="text-base text-[#374151] leading-relaxed mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
                Evenum is a professional participation platform built for governments, enterprises, universities, and communities. Run transparent elections, host events, and collect community feedback.
              </p>
              <p className="text-sm text-[#6B7280]" style={{ fontFamily: 'Inter, sans-serif' }}>
                Paid election · XAF 200 per vote · Active until December 31, 2026
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Brand personality */}
      <div className="px-16 py-14" style={{ background: '#0B1F4A' }}>
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold tracking-[0.12em] uppercase text-white/40 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>Brand Personality</p>
          <h2 className="text-3xl font-bold text-white tracking-tight mb-8">Built for Trust at Scale</h2>
          <div className="grid grid-cols-4 gap-4">
            {[
              'Trust', 'Integrity', 'Authority', 'Professionalism',
              'Participation', 'Community', 'Growth', 'Technology',
            ].map(trait => (
              <div key={trait} className="px-4 py-3 rounded-xl text-sm font-semibold" style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.9)', fontFamily: 'Inter, sans-serif' }}>
                {trait}
              </div>
            ))}
          </div>
          <div className="mt-10 pt-10 border-t border-white/10">
            <p className="text-xs font-medium text-white/40 mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>Suitable for</p>
            <p className="text-white/70 text-base" style={{ fontFamily: 'Inter, sans-serif' }}>
              Governments · Universities · Enterprises · NGOs · Corporations · Communities · Large Organizations
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-16 py-8 border-t border-[#E0E8F2] bg-white">
        <div className="flex items-center gap-3 text-[#003785]">
          <div className="h-7 w-7">{MARK}</div>
          <span className="font-bold text-lg tracking-[-0.04em]">EVENUM</span>
        </div>
        <p className="text-sm text-[#8AAAC8]" style={{ fontFamily: 'Inter, sans-serif' }}>Brand Identity System · Confidential</p>
        <p className="text-sm font-medium text-[#003785]" style={{ fontFamily: 'Inter, sans-serif' }}>evenum.com</p>
      </div>
    </div>
  );
}
