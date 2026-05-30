import { type ReactNode, Suspense } from "react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

type AsyncCardBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
  errorFallback: (error: string, retry: () => void) => ReactNode;
};

export function AsyncCardBoundary({ children, fallback, errorFallback }: AsyncCardBoundaryProps) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) => errorFallback(errorMessage(error), resetErrorBoundary)}
        >
          <Suspense fallback={fallback}>{children}</Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}
