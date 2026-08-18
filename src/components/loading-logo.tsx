export function LoadingLogo() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <div className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-zinc-900">
        <span className="text-xl font-bold text-white">T</span>
      </div>
      <p className="animate-pulse text-sm font-medium text-zinc-400">
        Tapd In
      </p>
    </div>
  );
}
