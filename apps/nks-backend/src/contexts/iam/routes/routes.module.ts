import { Module } from '@nestjs/common';
import { RoutesService } from './routes.service';
import { RoutesController } from './routes.controller';
import { RoutesRepository } from './repositories/routes.repository';
import { RolesModule } from '../roles/roles.module';
import { GuardsModule } from '../../../common/guards/guards.module';

@Module({
  imports: [GuardsModule, RolesModule],
  controllers: [RoutesController],
  providers: [RoutesService, RoutesRepository],
  exports: [RoutesService, RoutesRepository],
})
export class RoutesModule {}
