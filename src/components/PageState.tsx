import { AlertCircle, Loader2 } from "lucide-react";

export function PageSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center text-sm text-muted-foreground">
      <Loader2 className="mb-3 h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function PageError({
  title = "This page didn't load",
  message = "Please try again.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
      <AlertCircle className="mb-3 h-8 w-8 text-destructive" aria-hidden="true" />
      <h1 className="text-lg font-bold">{title}</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
        >
          Try again
        </button>
      )}
    </div>
  );
}