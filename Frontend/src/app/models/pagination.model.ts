//src/app/models/pagination.model.ts
export interface PaginationMeta {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    meta: PaginationMeta;
}