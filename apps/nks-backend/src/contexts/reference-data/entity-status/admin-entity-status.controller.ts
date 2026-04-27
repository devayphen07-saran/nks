import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EntityStatusCommandService } from './entity-status-command.service';
import { AssignStatusDto } from './dto/entity-status.dto';
import type { EntityStatusResponse } from './dto/entity-status.dto';
import { RBACGuard } from '../../../common/guards/rbac.guard';
import { RequireEntityPermission } from '../../../common/decorators/require-entity-permission.decorator';
import { EntityResource } from '../../../common/decorators/entity-resource.decorator';
import { EntityCodes, PermissionActions } from '../../../common/constants/entity-codes.constants';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';
import type { SessionUser } from '../../iam/auth/interfaces/session-user.interface';

@ApiTags('Admin / Entity Status')
@Controller('admin/entity-status')
@UseGuards(RBACGuard)
@EntityResource(EntityCodes.ENTITY_STATUS)
@ApiBearerAuth()
export class AdminEntityStatusController {
  constructor(private readonly entityStatusCommand: EntityStatusCommandService) {}

  @Post(':entityCode')
  @RequireEntityPermission({ action: PermissionActions.CREATE, scope: 'PLATFORM' })
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Status assigned successfully')
  @ApiOperation({ summary: 'Assign a status to an entity' })
  async assignStatus(
    @Param('entityCode') entityCode: string,
    @Body() dto: AssignStatusDto,
    @CurrentUser() user: SessionUser,
  ): Promise<EntityStatusResponse> {
    return this.entityStatusCommand.assignStatus(entityCode, dto, user.userId);
  }

  @Delete(':entityCode/:statusGuuid')
  @RequireEntityPermission({ action: PermissionActions.DELETE, scope: 'PLATFORM' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a status from an entity' })
  async removeStatus(
    @Param('entityCode') entityCode: string,
    @Param('statusGuuid', ParseUUIDPipe) statusGuuid: string,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    await this.entityStatusCommand.removeStatus(entityCode, statusGuuid, user.userId);
  }
}
