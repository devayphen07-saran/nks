import { Injectable } from '@nestjs/common';
import { UsersRepository } from './repositories/users.repository';
import { UserMapper } from './mapper/user.mapper';
import type { UserResponseDto } from './dto';
@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async listUsers(opts: {
    page: number;
    pageSize: number;
    search?: string;
  }): Promise<{ rows: UserResponseDto[]; total: number }> {
    const { rows, total } = await this.usersRepository.findPage(opts);
    return {
      rows: rows.map(UserMapper.toDto),
      total,
    };
  }
}
