"use client";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4">
            <h1 className="text-4xl font-bold">Something went wrong</h1>
            <p className="text-muted-foreground">{error.message}</p>
            <button
                onClick={reset}
                className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
            >
                Try again
            </button>
        </div>
    );
}
