import { Skeleton } from "@/components/ui/skeleton";

export default function TicketsLoading() {
  return (
    <div>
      <div className="px-8 pb-4 pt-7">
        <Skeleton className="h-7 w-24" />
      </div>
      <div className="divide-y divide-border border-t border-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-8 py-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-72" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
