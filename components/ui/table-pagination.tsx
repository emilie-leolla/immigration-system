"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TablePaginationProps {
    page: number;
    totalItems: number;
    pageSize?: number;
    onPageChange: (page: number) => void;

    labels?: {
        showing?: string;
        previous?: string;
        next?: string;
    };
}

export function TablePagination({
    page,
    totalItems,
    pageSize = 10,
    onPageChange,
    labels = {},
}: TablePaginationProps) {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    if (totalItems <= pageSize) {
        return null;
    }

    const startItem = (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, totalItems);

    const showingLabel = labels.showing ?? "Showing";
    const previousLabel = labels.previous ?? "Previous";
    const nextLabel = labels.next ?? "Next";

    /**
     * Pagination:
     *
     * 1 2 3 4 5 ... 100
     *
     * When moving forward:
     *
     * 1 ... 4 5 6 ... 100
     *
     * Near the end:
     *
     * 1 ... 96 97 98 99 100
     */
    const getPageNumbers = () => {
        const pages: (number | "ellipsis")[] = [];

        // Small number of pages: show everything
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }

            return pages;
        }

        // Always show first page
        pages.push(1);

        // Beginning
        if (page <= 4) {
            pages.push(2, 3, 4, 5);
            pages.push("ellipsis");
            pages.push(totalPages);

            return pages;
        }

        // End
        if (page >= totalPages - 3) {
            pages.push("ellipsis");
            pages.push(
                totalPages - 4,
                totalPages - 3,
                totalPages - 2,
                totalPages - 1,
                totalPages
            );

            return pages;
        }

        // Middle
        pages.push("ellipsis");
        pages.push(page - 1, page, page + 1);
        pages.push("ellipsis");
        pages.push(totalPages);

        return pages;
    };

    return (
        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Result information */}
            <p className="text-sm text-muted-foreground">
                {showingLabel} {startItem}–{endItem} of {totalItems}
            </p>

            {/* Pagination controls */}
            <div className="flex items-center gap-1">
                {/* Previous */}
                <Button
                    type="button"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page === 1}
                    aria-label={previousLabel}
                    className="h-9"
                >
                    <ChevronLeft className="h-4 w-4" />

                    <span className="hidden sm:inline">
                        {previousLabel}
                    </span>
                </Button>

                {/* Page numbers */}
                <div className="flex items-center gap-1">
                    {getPageNumbers().map((item, index) =>
                        item === "ellipsis" ? (
                            <span
                                key={`ellipsis-${index}`}
                                className="flex h-9 w-9 items-center justify-center text-sm text-muted-foreground"
                            >
                                …
                            </span>
                        ) : (
                            <Button
                                key={item}
                                type="button"
                                onClick={() => onPageChange(item)}
                                aria-label={`Go to page ${item}`}
                                aria-current={
                                    page === item ? "page" : undefined
                                }
                                className={`h-9 w-9 p-0 ${
                                    page === item
                                        ? "bg-primary text-primary-foreground"
                                        : ""
                                }`}
                            >
                                {item}
                            </Button>
                        )
                    )}
                </div>

                {/* Next */}
                <Button
                    type="button"
                    onClick={() => onPageChange(page + 1)}
                    disabled={page === totalPages}
                    aria-label={nextLabel}
                    className="h-9"
                >
                    <span className="hidden sm:inline">
                        {nextLabel}
                    </span>

                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}