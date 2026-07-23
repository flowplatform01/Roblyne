const MARK = (
  <svg viewBox="0 0 100 100" fill="currentColor" className="h-full w-auto">
    <rect x="6" y="65" width="23" height="29" rx="2.5"/>
    <rect x="38.5" y="40" width="23" height="54" rx="2.5"/>
    <rect x="71" y="8" width="23" height="86" rx="2.5"/>
  </svg>
);

function NavBar({ dark = false }: { dark?: boolean }) {
  const bg = dark ? '#0B1F4A' : '#FFFFFF';
  const border = dark ? '#1E3060' : '#E0E8F2';
  const text = dark ? '#FFFFFF' : '#0B1F4A';
  const muted = dark ? 'rgba(255,255,255,0.5)' : '#5A7A9A';
  const accent = dark ? '#5B9BF0' : '#003785';

  return (
    <nav className="flex items-center px-5 h-14 gap-6" style={{ background: bg, borderBottom: `1px solid ${border}` }}>
      <div className="flex items-center gap-2.5" style={{ color: accent }}>
        <div className="h-7 w-7">{MARK}</div>
        <span className="font-bold text-lg tracking-[-0.04em]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: text }}>EVENUM</span>
      </div>
      <div className="flex-1" />
      {['Elections', 'Events', 'Campaigns'].map(item => (
        <span key={item} className="text-sm font-medium cursor-pointer" style={{ color: muted, fontFamily: 'Inter, sans-serif' }}>{item}</span>
      ))}
      <div className="flex items-center gap-2 ml-4">
        <button className="text-sm px-4 py-1.5 rounded-md font-medium" style={{ color: muted, fontFamily: 'Inter, sans-serif' }}>Log in</button>
        <button className="text-sm px-4 py-1.5 rounded-md font-semibold" style={{ background: '#003785', color: 'white', fontFamily: 'Inter, sans-serif' }}>Get started</button>
      </div>
    </nav>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  const colors: Record<string, [string, string]> = {
    blue: ['#EBF2FE', '#003785'],
    teal: ['#E8FAFA', '#065E55'],
    green: ['#DCFCE7', '#15803D'],
    amber: ['#FEF3C7', '#92400E'],
    red: ['#FEE2E2', '#991B1B'],
    purple: ['#EDE9FE', '#5B21B6'],
    gray: ['#F3F4F6', '#374151'],
  };
  const [bg, fg] = colors[color] || colors.gray;
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: bg, color: fg, fontFamily: 'Inter, sans-serif' }}>
      {label}
    </span>
  );
}

function ElectionCard() {
  return (
    <div className="bg-white rounded-2xl border border-[#DDE8F5] overflow-hidden shadow-sm">
      <div className="h-1.5 bg-[#003785]" />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="h-10 w-10 rounded-xl bg-[#EBF2FE] flex items-center justify-center">
            <div className="h-5 w-5 text-[#003785]">{MARK}</div>
          </div>
          <Pill label="Active" color="teal" />
        </div>
        <h3 className="font-semibold text-[#0B1F4A] text-[15px] leading-snug mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Board of Directors Election 2026
        </h3>
        <p className="text-sm text-[#5A7A9A] mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>City Council District 7 · 3 positions</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#8AAAC8]" style={{ fontFamily: 'Inter, sans-serif' }}>1,247 participants</span>
          <button className="text-sm font-semibold px-4 py-1.5 rounded-lg" style={{ background: '#003785', color: 'white', fontFamily: 'Inter, sans-serif' }}>Vote now</button>
        </div>
      </div>
    </div>
  );
}

function Buttons() {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <button className="px-5 py-2 rounded-lg text-sm font-semibold" style={{ background: '#003785', color: 'white', fontFamily: 'Inter, sans-serif' }}>Primary</button>
      <button className="px-5 py-2 rounded-lg text-sm font-semibold border" style={{ background: 'white', color: '#003785', borderColor: '#003785', fontFamily: 'Inter, sans-serif' }}>Outline</button>
      <button className="px-5 py-2 rounded-lg text-sm font-semibold" style={{ background: '#EBF2FE', color: '#003785', fontFamily: 'Inter, sans-serif' }}>Ghost</button>
      <button className="px-5 py-2 rounded-lg text-sm font-semibold" style={{ background: '#0FA99A', color: 'white', fontFamily: 'Inter, sans-serif' }}>Teal</button>
      <button className="px-5 py-2 rounded-lg text-sm font-semibold" style={{ background: '#DC2626', color: 'white', fontFamily: 'Inter, sans-serif' }}>Danger</button>
      <button className="px-5 py-2 rounded-lg text-sm font-semibold opacity-40 cursor-not-allowed" style={{ background: '#003785', color: 'white', fontFamily: 'Inter, sans-serif' }}>Disabled</button>
    </div>
  );
}

function Badges() {
  const items = [
    { label: 'Election', color: 'blue' }, { label: 'Event', color: 'purple' },
    { label: 'Campaign', color: 'teal' }, { label: 'Active', color: 'green' },
    { label: 'Draft', color: 'gray' }, { label: 'Ended', color: 'red' },
    { label: 'Paid', color: 'amber' }, { label: 'Free', color: 'green' },
  ];
  return <div className="flex flex-wrap gap-2">{items.map(i => <Pill key={i.label} {...i} />)}</div>;
}

export function ApplicationUsage() {
  return (
    <div className="min-h-screen bg-[#F4F7FB] pb-16" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Header */}
      <div className="px-16 pt-14 pb-10 border-b border-[#E0E8F2]">
        <p className="text-xs font-semibold tracking-[0.12em] text-[#5A7A9A] uppercase mb-2">Evenum · Brand Identity System</p>
        <h1 className="text-4xl font-bold text-[#0B1F4A] tracking-tight">Application Usage</h1>
        <p className="text-base text-[#5A7A9A] mt-2 max-w-lg">
          The brand in context — how the visual system applies across navigation, components, and interactive elements.
        </p>
      </div>

      <div className="px-16 pt-10 space-y-8">
        {/* Navigation */}
        <div>
          <p className="text-xs font-semibold tracking-[0.1em] uppercase text-[#8AAAC8] mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>Navigation · Light &amp; Dark</p>
          <div className="rounded-2xl overflow-hidden border border-[#DDE8F5]">
            <NavBar dark={false} />
            <NavBar dark={true} />
          </div>
        </div>

        {/* Mobile navigation */}
        <div>
          <p className="text-xs font-semibold tracking-[0.1em] uppercase text-[#8AAAC8] mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>Mobile Application Icon</p>
          <div className="flex gap-4 items-end">
            {[80, 60, 48, 32, 20].map(s => (
              <div key={s} className="flex flex-col items-center gap-2">
                <div className="rounded-[22%] flex items-center justify-center" style={{ width: s, height: s, background: '#003785' }}>
                  <div style={{ width: s * 0.6, height: s * 0.6, color: 'white' }}>{MARK}</div>
                </div>
                <span className="text-[10px] text-[#8AAAC8]" style={{ fontFamily: 'Inter, sans-serif' }}>{s}px</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cards */}
        <div>
          <p className="text-xs font-semibold tracking-[0.1em] uppercase text-[#8AAAC8] mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>Cards</p>
          <div className="grid grid-cols-3 gap-4">
            <ElectionCard />
            <ElectionCard />
            <div className="bg-[#003785] rounded-2xl p-5 text-white flex flex-col justify-between">
              <div>
                <Pill label="Premium" color="amber" />
                <h3 className="font-bold text-xl mt-4 mb-1 tracking-tight">Town Hall Registration</h3>
                <p className="text-sm text-white/70" style={{ fontFamily: 'Inter, sans-serif' }}>District 7 Community Event</p>
              </div>
              <button className="mt-6 w-full py-2.5 rounded-xl font-semibold text-sm bg-white text-[#003785]" style={{ fontFamily: 'Inter, sans-serif' }}>Register now</button>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="bg-white rounded-2xl p-8 border border-[#DDE8F5]">
          <p className="text-xs font-semibold tracking-[0.1em] uppercase text-[#8AAAC8] mb-5" style={{ fontFamily: 'Inter, sans-serif' }}>Buttons</p>
          <Buttons />
        </div>

        {/* Badges */}
        <div className="bg-white rounded-2xl p-8 border border-[#DDE8F5]">
          <p className="text-xs font-semibold tracking-[0.1em] uppercase text-[#8AAAC8] mb-5" style={{ fontFamily: 'Inter, sans-serif' }}>Status Badges</p>
          <Badges />
        </div>

        {/* Loading state */}
        <div className="bg-[#003785] rounded-2xl p-12 flex flex-col items-center justify-center gap-4">
          <div className="h-14 w-14 text-white">{MARK}</div>
          <span className="text-white font-bold text-xl tracking-[-0.04em]">EVENUM</span>
          <div className="flex gap-1.5 mt-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/40" style={{ animation: 'none' }} />
            ))}
          </div>
          <p className="text-white/50 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>Loading screen example</p>
        </div>
      </div>
    </div>
  );
}
