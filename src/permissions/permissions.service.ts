import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolePermission } from './entities/role-permission.entity';
import { UserPermission } from './entities/user-permission.entity';

export interface PermissionCheck {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(RolePermission)
    private rolePermissionRepository: Repository<RolePermission>,
    @InjectRepository(UserPermission)
    private userPermissionRepository: Repository<UserPermission>,
  ) { }

  /**
   * Get permissions for a user on a specific resource
   * First checks user-specific permissions, then falls back to role-based permissions
   */
  async getUserPermissions(userId: string, resource: string, userRole?: string): Promise<PermissionCheck> {
    // Check for user-specific permissions first
    const userPerm = await this.userPermissionRepository.findOne({
      where: { userId, resource },
    });

    if (userPerm) {
      return {
        canCreate: userPerm.canCreate,
        canRead: userPerm.canRead,
        canUpdate: userPerm.canUpdate,
        canDelete: userPerm.canDelete,
      };
    }

    // Fall back to role-based permissions if role is available
    if (userRole) {
      return this.getRolePermissions(userRole, resource);
    }

    // Default deny-all if no role info available
    return {
      canCreate: false,
      canRead: false,
      canUpdate: false,
      canDelete: false,
    };
  }

  /**
   * Get permissions for a role on a specific resource
   */
  async getRolePermissions(role: string, resource: string): Promise<PermissionCheck> {
    const rolePerm = await this.rolePermissionRepository.findOne({
      where: { role, resource },
    });

    if (rolePerm) {
      return {
        canCreate: rolePerm.canCreate,
        canRead: rolePerm.canRead,
        canUpdate: rolePerm.canUpdate,
        canDelete: rolePerm.canDelete,
      };
    }

    // Default permissions if not found
    return {
      canCreate: false,
      canRead: true,
      canUpdate: false,
      canDelete: false,
    };
  }

  /**
   * Get all permissions for a user across all resources
   */
  async getAllUserPermissions(userId: string, userRole: string): Promise<Record<string, PermissionCheck>> {
    // Get user-specific permissions
    const userPerms = await this.userPermissionRepository.find({
      where: { userId },
    });

    // Get role-based permissions
    const rolePerms = await this.rolePermissionRepository.find({
      where: { role: userRole },
    });

    // Merge permissions (user-specific overrides role-based)
    const permissions: Record<string, PermissionCheck> = {};

    // First, add all role-based permissions
    rolePerms.forEach(perm => {
      permissions[perm.resource] = {
        canCreate: perm.canCreate,
        canRead: perm.canRead,
        canUpdate: perm.canUpdate,
        canDelete: perm.canDelete,
      };
    });

    // Then, override with user-specific permissions
    userPerms.forEach(perm => {
      permissions[perm.resource] = {
        canCreate: perm.canCreate,
        canRead: perm.canRead,
        canUpdate: perm.canUpdate,
        canDelete: perm.canDelete,
      };
    });

    return permissions;
  }

  /**
   * Get all role permissions
   */
  async getAllRolePermissions(): Promise<RolePermission[]> {
    return await this.rolePermissionRepository.find({
      order: {
        role: 'ASC',
        resource: 'ASC',
      },
    });
  }

  /**
   * Update role permission
   */
  async updateRolePermission(
    role: string,
    resource: string,
    permissions: Partial<PermissionCheck>,
  ): Promise<RolePermission> {
    let rolePerm = await this.rolePermissionRepository.findOne({
      where: { role, resource },
    });

    if (!rolePerm) {
      rolePerm = this.rolePermissionRepository.create({
        role,
        resource,
        ...permissions,
      });
    } else {
      Object.assign(rolePerm, permissions);
    }

    return await this.rolePermissionRepository.save(rolePerm);
  }

  /**
   * Create or update user-specific permission
   */
  async setUserPermission(
    userId: string,
    resource: string,
    permissionName: string,
    permissions: Partial<PermissionCheck>,
  ): Promise<UserPermission> {
    let userPerm = await this.userPermissionRepository.findOne({
      where: { userId, resource },
    });

    if (!userPerm) {
      userPerm = this.userPermissionRepository.create({
        userId,
        resource,
        permissionName,
        ...permissions,
      });
    } else {
      Object.assign(userPerm, permissions);
    }

    return await this.userPermissionRepository.save(userPerm);
  }

  /**
   * Delete user-specific permission (falls back to role-based)
   */
  async deleteUserPermission(userId: string, resource: string): Promise<void> {
    await this.userPermissionRepository.delete({ userId, resource });
  }

  async deleteRole(role: string): Promise<void> {
    await this.rolePermissionRepository.delete({ role });
  }
}
