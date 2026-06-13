import appIcon from "@/app/assets/easy-github-icon.png";

export function AppBrand() {
  return (
    <div className="flex items-center gap-3">
      <img
        src={appIcon}
        alt=""
        aria-hidden="true"
        className="h-9 w-9 rounded-md object-contain"
        draggable={false}
      />
      <div className="min-w-0">
        <div className="truncate text-base font-semibold tracking-tight">Easy Github</div>
        <div className="truncate text-xs text-muted-foreground">Local Git workspace</div>
      </div>
    </div>
  );
}
