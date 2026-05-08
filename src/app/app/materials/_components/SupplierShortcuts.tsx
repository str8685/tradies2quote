import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";

const SUPPLIERS = [
  { name: "Mitre 10", url: "https://www.mitre10.co.nz" },
  { name: "Bunnings", url: "https://www.bunnings.co.nz" },
  { name: "ITM", url: "https://www.itm.co.nz" },
  { name: "PlaceMakers", url: "https://www.placemakers.co.nz" },
] as const;

export function SupplierShortcuts() {
  return (
    <section
      data-testid="supplier-shortcuts"
      className="mt-2"
      aria-labelledby="supplier-shortcuts-label"
    >
      <p
        id="supplier-shortcuts-label"
        className="font-mono text-xs uppercase tracking-[0.2em] text-ink-400"
      >
        {"// quick access — suppliers"}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {SUPPLIERS.map((s) => (
          <a
            key={s.name}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`supplier-${s.name.toLowerCase().replace(/\s+/g, "-")}`}
            className="group flex items-center justify-between gap-2 rounded-sm border border-ink-700 bg-ink-800 px-3 py-2.5 transition-transform hover:-translate-y-[2px] hover:border-brand"
          >
            <span className="font-display text-xs uppercase tracking-tight text-white sm:text-sm">
              {s.name}
            </span>
            <ArrowSquareOut
              size={14}
              weight="bold"
              className="text-ink-400 group-hover:text-brand"
              aria-hidden="true"
            />
          </a>
        ))}
      </div>
    </section>
  );
}
