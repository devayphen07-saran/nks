import { Module } from '@nestjs/common';
import { StaffInviteController } from './staff-invite.controller';
import { StaffInviteService } from './staff-invite.service';
import { StaffInviteRepository } from './staff-invite.repository';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [RolesModule],
  controllers: [StaffInviteController],
  providers: [StaffInviteService, StaffInviteRepository],
})
export class StaffInviteModule {}
