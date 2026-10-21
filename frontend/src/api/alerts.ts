import { NotificationSchema, ZoneSchema, type CreateZoneRequestInput } from '@portal/shared';
import { z } from 'zod';
import { request, requestParsed } from './http';

export const zonesApi = {
  list: () => requestParsed(z.array(ZoneSchema), '/zones'),
  create: (body: CreateZoneRequestInput) => requestParsed(ZoneSchema, '/zones', { method: 'POST', json: body }),
  remove: (id: string) => request<void>(`/zones/${id}`, { method: 'DELETE' }),
};

export const notificationsApi = {
  list: () => requestParsed(z.array(NotificationSchema), '/notifications'),
  markRead: (ids: string[]) => request<void>('/notifications/read', { method: 'POST', json: { ids } }),
};
