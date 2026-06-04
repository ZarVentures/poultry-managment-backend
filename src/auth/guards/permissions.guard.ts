import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PermissionsService } from '../../permissions/permissions.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private permissionsService: PermissionsService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requiredPermission = this.reflector.getAllAndOverride<{
            resource: string;
            action: 'create' | 'read' | 'update' | 'delete';
        }>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

        if (!requiredPermission) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user || !user.userId || !user.role) {
            return false;
        }

        // Admins have full access to everything
        if (user.role === 'admin') {
            return true;
        }

        const { resource, action } = requiredPermission;
        const permissions = await this.permissionsService.getUserPermissions(
            user.userId,
            resource,
            user.role,  // ← pass role for role-based fallback
        );

        switch (action) {
            case 'create':
                return permissions.canCreate;
            case 'read':
                return permissions.canRead;
            case 'update':
                return permissions.canUpdate;
            case 'delete':
                return permissions.canDelete;
            default:
                return false;
        }
    }
}
