import { Injectable } from '@nestjs/common';
import { StaffInviteRepository } from './staff-invite.repository';
import { RolesRepository } from '../roles/roles.repository';
import { TransactionService } from '../../core/database/transaction.service';
import { AuthService } from '../auth/services/auth.service';
import {
  InviteStaffDto,
  AcceptInviteDto,
  UpdateStaffPermissionsDto,
} from './dto/staff-invite.dto';
import { userRoleMapping, userSession } from '../../core/database/schema';
import { eq } from 'drizzle-orm';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '../../common/exceptions';
import { ErrorCode } from '../../common/constants/error-codes.constants';

@Injectable()
export class StaffInviteService {
  constructor(
    private readonly staffInviteRepository: StaffInviteRepository,
    private readonly rolesRepository: RolesRepository,
    private readonly txService: TransactionService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Store owner invites a staff member.
   * Returns the invite token (owner shares it with the staff member).
   */
  async inviteStaff(ownerId: number, dto: InviteStaffDto) {
    // 1. Verify caller is STORE_OWNER and get their store
    const storeFk = await this.staffInviteRepository.findOwnerStore(ownerId);
    if (storeFk == null) {
      throw new ForbiddenException({
        errorCode: ErrorCode.FORBIDDEN,
        message: 'Only store owners can invite staff',
      });
    }

    // 2. Validate role
    const role = await this.rolesRepository.findByCode(dto.roleCode);
    if (!role) {
      throw new BadRequestException({
        errorCode: ErrorCode.ROLE_NOT_FOUND,
        message: `Role '${dto.roleCode}' not found`,
      });
    }

    // 3. Validate permission IDs exist (bulk check avoids N+1)
    if (dto.permissionIds.length > 0) {
      for (const permId of dto.permissionIds) {
        const perm = await this.rolesRepository.findPermissionById(permId);
        if (!perm) {
          throw new BadRequestException({
            errorCode: ErrorCode.VALIDATION_ERROR,
            message: `Permission ID ${permId} not found`,
          });
        }
      }
    }

    // 4. Pre-link inviteeFk if the invitee already has an account
    const existingUser = await this.staffInviteRepository.findUserByEmail(
      dto.inviteeEmail,
    );

    // 5. Generate token (UUID without dashes = 32 chars) and expiry
    const token = crypto.randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // 6. Create invite + permission rows atomically
    const invite = await this.txService.run(async (tx) => {
      const created = await this.staffInviteRepository.create(
        {
          storeFk,
          invitedByFk: ownerId,
          inviteeEmail: dto.inviteeEmail.toLowerCase(),
          inviteeFk: existingUser?.id ?? undefined,
          roleFk: role.id,
          token,
          status: 'PENDING',
          expiresAt,
          createdBy: ownerId,
        },
        tx,
      );

      // Insert permissions into staff_invite_permission junction table
      if (dto.permissionIds.length > 0) {
        await this.staffInviteRepository.createPermissions(
          created.id,
          dto.permissionIds,
          tx,
        );
      }

      return created;
    });

    return {
      token: invite.token,
      inviteeEmail: invite.inviteeEmail,
      expiresAt: invite.expiresAt,
    };
  }

  /**
   * Staff member accepts an invite by token.
   * Assigns role + direct permissions, marks invite accepted.
   *
   * Permission set is read from staff_invite_permission at acceptance time.
   * Any permissions deleted after the invite was created are silently absent
   * (CASCADE on permissionFk cleaned them up) — no ghost IDs.
   */
  async acceptInvite(userId: number, dto: AcceptInviteDto) {
    // 1. Find invite
    const invite = await this.staffInviteRepository.findByToken(dto.token);
    if (!invite) {
      throw new NotFoundException({
        errorCode: ErrorCode.NOT_FOUND,
        message: 'Invite not found or already used / expired',
      });
    }

    // 2. Validate the accepting user is the intended recipient
    if (invite.inviteeFk != null) {
      // Invitee was known at creation — hard FK check
      if (invite.inviteeFk !== userId) {
        throw new ForbiddenException({
          errorCode: ErrorCode.FORBIDDEN,
          message: 'This invite was issued to a different account',
        });
      }
    } else {
      // Invitee registered after the invite was created — fall back to email check
      const userEmail =
        await this.staffInviteRepository.findUserEmailById(userId);
      if (
        !userEmail ||
        userEmail.toLowerCase() !== invite.inviteeEmail.toLowerCase()
      ) {
        throw new ForbiddenException({
          errorCode: ErrorCode.FORBIDDEN,
          message: 'This invite was not issued to your email address',
        });
      }
    }

    // 3. Fetch the live permission IDs from the junction table (FKs guarantee these exist)
    const permissionIds = await this.staffInviteRepository.findPermissionIds(
      invite.id,
    );

    // 4. Execute atomically
    await this.txService.run(async (tx) => {
      // a. Insert role mapping scoped to the store
      await tx
        .insert(userRoleMapping)
        .values({
          userFk: userId,
          roleFk: invite.roleFk,
          storeFk: invite.storeFk,
          assignedBy: invite.invitedByFk ?? userId,
        })
        .onConflictDoNothing();

      // b. Assign direct permissions (only those still alive in the DB)
      if (permissionIds.length > 0 && invite.storeFk != null) {
        await this.rolesRepository.setUserDirectPermissions(
          userId,
          invite.storeFk,
          permissionIds,
          invite.invitedByFk ?? userId,
          tx,
        );
      }

      // c. Backfill inviteeFk if the invitee was not yet registered at invite creation
      if (invite.inviteeFk == null) {
        await this.staffInviteRepository.backfillInviteeFk(
          invite.id,
          userId,
          tx,
        );
      }

      // d. Mark invite as accepted
      await this.staffInviteRepository.markAccepted(invite.id, userId, tx);

      // e. Initialize session with the store context
      await tx
        .update(userSession)
        .set({ activeStoreFk: invite.storeFk })
        .where(eq(userSession.userId, userId));
    });

    // 5. Return updated permission context
    return this.authService.getUserPermissions(userId);
  }

  /**
   * List all accepted staff for the owner's store.
   */
  async listStaff(ownerId: number) {
    const storeFk = await this.staffInviteRepository.findOwnerStore(ownerId);
    if (storeFk == null) {
      throw new ForbiddenException({
        errorCode: ErrorCode.FORBIDDEN,
        message: 'Only store owners can view staff',
      });
    }
    return this.staffInviteRepository.findStaffByStore(storeFk);
  }

  /**
   * Update the permissions of a staff member.
   */
  async updateStaffPermissions(
    ownerId: number,
    staffUserId: number,
    dto: UpdateStaffPermissionsDto,
  ) {
    const storeFk = await this.staffInviteRepository.findOwnerStore(ownerId);
    if (storeFk == null) {
      throw new ForbiddenException({
        errorCode: ErrorCode.FORBIDDEN,
        message: 'Only store owners can update staff permissions',
      });
    }

    if (dto.permissionIds.length > 0) {
      for (const permId of dto.permissionIds) {
        const perm = await this.rolesRepository.findPermissionById(permId);
        if (!perm) {
          throw new BadRequestException({
            errorCode: ErrorCode.VALIDATION_ERROR,
            message: `Permission ID ${permId} not found`,
          });
        }
      }
    }

    await this.rolesRepository.setUserDirectPermissions(
      staffUserId,
      storeFk,
      dto.permissionIds,
      ownerId,
    );
    return { updated: true, staffUserId, permissionIds: dto.permissionIds };
  }
}
