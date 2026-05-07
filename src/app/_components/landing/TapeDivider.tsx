interface TapeDividerProps {
  label?: string;
  reverse?: boolean;
}

export default function TapeDivider({ label, reverse = false }: TapeDividerProps) {
  const fwdStyle: React.CSSProperties = {
    animation: `t2q-tape ${reverse ? "32s reverse" : "32s"} linear infinite`,
  };
  const revStyle: React.CSSProperties = {
    animation: `t2q-tape ${reverse ? "32s" : "32s reverse"} linear infinite`,
    transform: "scaleY(-1)",
  };
  return (
    <div className="relative overflow-hidden" aria-hidden="true">
      <div className="h-3 t2q-tape-mm" style={fwdStyle} />
      {label && (
        <div className="bg-ink-900 border-y-2 border-ink-700 py-3">
          <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.3em] text-ink-300">
            <span className="text-brand">// {label}</span>
            <span className="hidden sm:inline">site safe · in service · 24/7</span>
          </div>
        </div>
      )}
      <div className="h-3 t2q-tape-mm" style={revStyle} />
    </div>
  );
}
