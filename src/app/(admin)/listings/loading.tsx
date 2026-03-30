import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-48" />
      <Card><CardContent className="p-4"><div className="grid gap-4 md:grid-cols-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div></CardContent></Card>
      <Card><CardContent className="p-0"><TableSkeleton rows={8} cols={9} /></CardContent></Card>
    </div>
  );
}
