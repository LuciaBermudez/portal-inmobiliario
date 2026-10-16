import type { AsyncStatus, CreateZoneRequestInput, GeoJsonPolygon, Notification, Zone } from '@portal/shared';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { notificationsApi, zonesApi } from '@/api/alerts';
import { messageOf } from '@/api/http';

export const useZonesStore = defineStore('zones', () => {
  const zones = ref<Zone[]>([]);
  const status = ref<AsyncStatus>('idle');
  const error = ref<string | null>(null);

  const draftPolygon = ref<GeoJsonPolygon | null>(null);

  async function fetchAll() {
    status.value = 'loading';
    error.value = null;
    try {
      zones.value = await zonesApi.list();
      status.value = 'success';
    } catch (e) {
      status.value = 'error';
      error.value = messageOf(e);
    }
  }

  async function create(body: CreateZoneRequestInput): Promise<Zone> {
    const zone = await zonesApi.create(body);
    zones.value = [zone, ...zones.value];
    draftPolygon.value = null;
    return zone;
  }

  async function remove(id: string) {
    const previous = zones.value;
    zones.value = zones.value.filter((z) => z.id !== id);
    try {
      await zonesApi.remove(id);
    } catch (e) {
      zones.value = previous;
      throw e;
    }
  }

  return { zones, status, error, draftPolygon, fetchAll, create, remove };
});

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<Notification[]>([]);
  const status = ref<AsyncStatus>('idle');
  const unreadCount = computed(() => items.value.filter((n) => n.readAt === null).length);

  async function fetchAll() {
    status.value = 'loading';
    try {
      items.value = await notificationsApi.list();
      status.value = 'success';
    } catch {
      status.value = 'error';
    }
  }

  function push(notification: Notification) {
    if (items.value.some((n) => n.id === notification.id)) return;
    items.value = [notification, ...items.value];
  }

  async function markAllRead() {
    const unread = items.value.filter((n) => n.readAt === null).map((n) => n.id);
    if (unread.length === 0) return;
    const now = new Date().toISOString();
    items.value = items.value.map((n) => (n.readAt === null ? { ...n, readAt: now } : n));
    await notificationsApi.markRead(unread);
  }

  function reset() {
    items.value = [];
    status.value = 'idle';
  }

  return { items, status, unreadCount, fetchAll, push, markAllRead, reset };
});
