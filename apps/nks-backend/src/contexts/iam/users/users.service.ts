import { Injectable } from '@nestjs/common';
import { NotFoundException } from '../../../common/exceptions';
import { ErrorCode, errPayload } from '../../../common/constants/error-codes.constants';
import { AuthUsersRepository } from '../auth/repositories/auth-users.repository';
import { UserMapper } from './mapper/user.mapper';
import { paginated } from '../../../common/utils/paginated-result';
import type { PaginatedResult } from '../../../common/utils/paginated-result';
import type { UserResponseDto } from './dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly authUsersRepository: AuthUsersRepository,
  ) {}

  async listUsers(opts: {
    page: number;
    pageSize: number;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    isActive?: boolean;
  }): Promise<PaginatedResult<UserResponseDto>> {
    const { rows, total } = await this.authUsersRepository.findAdminUserPage(opts);
    return paginated({ items: rows.map(UserMapper.buildUserDto), page: opts.page, pageSize: opts.pageSize, total });
  }

  /**
   * Fetch a single user by their external `iamUserId`. Mirrors ayphen's
   * `UsersServiceImpl.getUserProfile(String iamUserId)` — controller passes
   * the path variable through unchanged; service resolves to the domain DTO
   * and throws NotFound on miss or soft-delete.
   */
  async getByIamUserId(iamUserId: string): Promise<UserResponseDto> {
    const row = await this.authUsersRepository.findAdminUserByIamUserId(iamUserId);
    if (!row) {
      throw new NotFoundException(errPayload(ErrorCode.USER_NOT_FOUND));
    }
    return UserMapper.buildUserDto(row);
  }
}
