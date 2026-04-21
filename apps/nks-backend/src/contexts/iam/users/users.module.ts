import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './repositories/users.repository';
import { UserPreferencesRepository } from './repositories/user-preferences.repository';
import { UserPreferencesService } from './user-preferences.service';
import { RolesModule } from '../roles/roles.module';
import { GuardsModule } from '../../../common/guards/guards.module';

@Module({
  imports:     [GuardsModule, RolesModule],
  controllers: [UsersController],
  providers:   [UsersService, UsersRepository, UserPreferencesRepository, UserPreferencesService],
  exports:     [UsersService, UsersRepository, UserPreferencesRepository, UserPreferencesService],
})
export class UsersModule {}
