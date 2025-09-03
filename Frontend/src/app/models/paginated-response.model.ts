// src/app/models/paginated-response.model.ts
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
}