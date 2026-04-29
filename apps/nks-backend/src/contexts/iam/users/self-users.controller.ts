import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { OwnershipGuard } from '../../../common/guards/ownership.guard';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';
import { NoEntityPermissionRequired } from '../../../common/decorators/no-entity-permission-required.decorator';
import type { UserResponseDto } from './dto';

/**
 * Self-service user endpoints.
 *
 * Every route here is protected by `OwnershipGuard`, which rejects requests
 * where the URL `iamUserId` does not match `req.user.iamUserId` (SUPER_ADMIN bypasses).
 *
 * For admin-scoped lookup of any user, see UsersController at /admin/users.
 */
@ApiTags('Users')
@Controller('users')
@UseGuards(OwnershipGuard)
@ApiBearerAuth()
export class SelfUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':iamUserId')
  @NoEntityPermissionRequired('self-service: user reading only their own profile via OwnershipGuard')
  @ResponseMessage('User retrieved successfully')
  @ApiOperation({
    summary: 'Get the authenticated user by iamUserId',
    description:
      'Returns the user identified by the URL `iamUserId`. Caller must be the same user (or SUPER_ADMIN).',
  })
  @ApiParam({ name: 'iamUserId', description: 'External user identifier' })
  async getSelf(
    @Param('iamUserId') iamUserId: string,
  ): Promise<UserResponseDto> {
    return this.usersService.getByIamUserId(iamUserId);
  }
}
