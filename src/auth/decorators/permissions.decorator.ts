import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (resource: string, action: 'create' | 'read' | 'update' | 'delete') =>
    SetMetadata(PERMISSIONS_KEY, { resource, action });
