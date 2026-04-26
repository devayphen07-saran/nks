import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { SelfUsersController } from './self-users.controller';
import { UsersService } from './users.service';
import { UserPreferencesRepository } from './repositories/user-preferences.repository';
import { UserPreferencesService } from './user-preferences.service';
import { RolesModule } from '../roles/roles.module';
import { GuardsModule } from '../../../common/guards/guards.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports:     [GuardsModule, RolesModule, AuthModule],
  controllers: [UsersController, SelfUsersController],
  providers:   [UsersService, UserPreferencesRepository, UserPreferencesService],
  exports:     [UsersService, UserPreferencesRepository, UserPreferencesService],
})
export class UsersModule {}
