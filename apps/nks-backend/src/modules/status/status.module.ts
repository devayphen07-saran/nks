import { Module } from '@nestjs/common';
import { StatusController } from './status.controller';
import { StatusService } from './status.service';
import { StatusRepository } from './status.repository';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [RolesModule],
  controllers: [StatusController],
  providers:   [StatusService, StatusRepository],
  exports:     [StatusService, StatusRepository],
})
export class StatusModule {}
