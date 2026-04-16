import { Injectable } from '@nestjs/common';
import { UsersRepository } from './repositories/users.repository';
import { UserMapper } from './mapper/user.mapper';
import type { UserResponseDto } from './dto';
import { PaginationValidator } from './validators';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async listUsers(opts: {
    page: number;
    pageSize: number;
    search?: string;
  }): Promise<{ rows: UserResponseDto[]; total: number }> {
    // SECURITY: Validate pagination using PaginationValidator
    PaginationValidator.validatePagination(opts.page, opts.pageSize);

    const { rows, total } = await this.usersRepository.findAll(opts);
    return {
      rows: rows.map(UserMapper.toDto),
      total,
    };
  }
}
