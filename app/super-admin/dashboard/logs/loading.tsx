import { TableSkeleton } from "@/components/ui/table-skeleton";

export default function Loading() {
    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="animate-pulse flex items-center justify-between">
                <div className="h-8 w-48 bg-gray-200 rounded-xl" />
                <div className="h-9 w-32 bg-gray-200 rounded-xl" />
            </div>
            <TableSkeleton rows={8} cols={5} />
        </div>
    );
}