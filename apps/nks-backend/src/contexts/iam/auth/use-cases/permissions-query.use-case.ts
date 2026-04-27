import { Injectable } from '@nestjs/common';
import { PermissionsService } from '../services/permissions/permissions.service';

/**
 * Orchestrates permission queries for offline caching and incremental sync.
 */
@Injectable()
export class PermissionsQueryUseCase {
  constructor(private readonly permissions: PermissionsService) {}

  getSnapshot(userId: number) {
    return this.permissions.buildPermissionsSnapshot(userId);
  }

  getDelta(userId: number, sinceVersion: string) {
    return this.permissions.calculateDelta(userId, sinceVersion);
  }
}
