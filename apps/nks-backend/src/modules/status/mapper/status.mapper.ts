import type { StatusListResponse, StatusSingleResponse } from '../dto/status.dto';

export class StatusMapper {
  static toListResponse<T>(items: T[]): StatusListResponse {
    return items as StatusListResponse;
  }

  static toSingleResponse<T>(item: T): StatusSingleResponse {
    return item as StatusSingleResponse;
  }
}
