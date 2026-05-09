import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsService } from './permissions.service';

@Controller('permissions')
@UseGuards(JwtAuthGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) { }

  /**
   * Get current user's permissions for all resources
   */
  @Get('my-permissions')
  async getMyPermissions(@Request() req: any) {
    const userId = req.user.userId;
    const userRole = req.user.role;

    const permissions = await this.permissionsService.getAllUserPermissions(userId, userRole);

    return {
      userId,
      role: userRole,
      permissions,
    };
  }

  /**
   * Get permissions for a specific resource
   */
  @Get('check/:resource')
  async checkPermission(@Request() req: any, @Param('resource') resource: string) {
    const userId = req.user.userId;
    const userRole = req.user.role;

    const permissions = await this.permissionsService.getRolePermissions(userRole, resource);

    return {
      resource,
      ...permissions,
    };
  }

  /**
   * Get all role permissions (admin only)
   */
  @Get('roles')
  async getAllRolePermissions(@Request() req: any) {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return { error: 'Unauthorized' };
    }

    return await this.permissionsService.getAllRolePermissions();
  }

  /**
   * Update role permission (admin only)
   */
  @Put('roles/:role/:resource')
  async updateRolePermission(
    @Request() req: any,
    @Param('role') role: string,
    @Param('resource') resource: string,
    @Body() permissions: any,
  ) {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return { error: 'Unauthorized' };
    }

    return await this.permissionsService.updateRolePermission(role, resource, permissions);
  }

  /**
   * Set user-specific permission (admin only)
   */
  @Post('users/:userId/:resource')
  async setUserPermission(
    @Request() req: any,
    @Param('userId') userId: string,
    @Param('resource') resource: string,
    @Body() body: any,
  ) {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return { error: 'Unauthorized' };
    }

    return await this.permissionsService.setUserPermission(
      userId,
      resource,
      body.permissionName || 'Custom Permission',
      body.permissions,
    );
  }

  /**
   * Delete user-specific permission (admin only)
   */
  @Delete('users/:userId/:resource')
  async deleteUserPermission(
    @Request() req: any,
    @Param('userId') userId: string,
    @Param('resource') resource: string,
  ) {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return { error: 'Unauthorized' };
    }

    await this.permissionsService.deleteUserPermission(userId, resource);
    return { message: 'Permission deleted successfully' };
  }

  /**
   * Delete all permissions for a specific role (admin only)
   */
  @Delete('roles/:role')
  async deleteRole(@Request() req: any, @Param('role') role: string) {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return { error: 'Unauthorized' };
    }

    await this.permissionsService.deleteRole(role);
    return { message: 'Role deleted successfully' };
  }
}
