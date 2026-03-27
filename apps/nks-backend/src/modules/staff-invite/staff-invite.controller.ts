import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StaffInviteService } from './staff-invite.service';
import {
  InviteStaffDto,
  AcceptInviteDto,
  UpdateStaffPermissionsDto,
} from './dto/staff-invite.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponse } from '../../common/utils/api-response';

@ApiTags('Company / Staff')
@Controller('company')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class StaffInviteController {
  constructor(private readonly service: StaffInviteService) {}

  @Post('invite-staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite a staff member (STORE_OWNER only)' })
  async inviteStaff(
    @CurrentUser('userId') ownerId: number,
    @Body() dto: InviteStaffDto,
  ) {
    const result = await this.service.inviteStaff(ownerId, dto);
    return ApiResponse.ok(result, 'Invite created successfully');
  }

  @Post('accept-invite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a staff invite using a token' })
  async acceptInvite(
    @CurrentUser('userId') userId: number,
    @Body() dto: AcceptInviteDto,
  ) {
    const result = await this.service.acceptInvite(userId, dto);
    return ApiResponse.ok(
      result,
      'Invite accepted — role and permissions assigned',
    );
  }

  @Get('staff')
  @ApiOperation({ summary: 'List staff members (STORE_OWNER only)' })
  async listStaff(@CurrentUser('userId') ownerId: number) {
    const result = await this.service.listStaff(ownerId);
    return ApiResponse.ok(result, 'Staff list retrieved');
  }

  @Patch('staff/:userId/permissions')
  @ApiOperation({
    summary: 'Update staff member permissions (STORE_OWNER only)',
  })
  async updateStaffPermissions(
    @CurrentUser('userId') ownerId: number,
    @Param('userId', ParseIntPipe) staffUserId: number,
    @Body() dto: UpdateStaffPermissionsDto,
  ) {
    const result = await this.service.updateStaffPermissions(
      ownerId,
      staffUserId,
      dto,
    );
    return ApiResponse.ok(result, 'Staff permissions updated');
  }
}
