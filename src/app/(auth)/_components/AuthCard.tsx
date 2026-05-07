export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 text-sm text-muted">{subtitle}</p>
      ) : null}
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function FormField({
  label,
  name,
  type = "text",
  autoComplete,
  required = true,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-ink shadow-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
      />
    </label>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="inline-flex h-11 w-full items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground shadow-sm hover:brightness-95 transition"
    >
      {children}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {message}
    </div>
  );
}

export function FormNotice({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
      {message}
    </div>
  );
}
