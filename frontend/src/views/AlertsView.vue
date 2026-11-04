<script setup lang="ts">
import {
  AlertFrequencySchema,
  OperationSchema,
  PropertyTypeSchema,
  type AlertFrequency,
  type GeoJsonPolygon,
  type Operation,
  type PropertyType,
  type Zone,
} from '@portal/shared';
import { computed, onMounted, reactive, ref } from 'vue';
import { messageOf } from '@/api/http';
import MapView from '@/components/MapView.vue';
import { useNotificationsStore, useZonesStore } from '@/stores/alerts';
import { useToastStore } from '@/stores/toasts';
import { formatDate, formatPrice, OPERATION_LABEL, PROPERTY_TYPE_LABEL } from '@/utils/format';

const zones = useZonesStore();
const notifications = useNotificationsStore();
const toasts = useToastStore();

const polygon = ref<GeoJsonPolygon | null>(zones.draftPolygon);
const saving = ref(false);
const form = reactive({
  name: '',
  frequency: 'instant' as AlertFrequency,
  operation: '' as Operation | '',
  propertyType: '' as PropertyType | '',
  maxPrice: '' as number | '',
  minBedrooms: '' as number | '',
});

const overlays = computed(() => zones.zones.map((z) => z.polygon));
const FREQUENCY_LABEL: Record<AlertFrequency, string> = { instant: 'Al instante', daily: 'Resumen diario por email' };

onMounted(() => {
  void zones.fetchAll();
  void notifications.fetchAll();
});

async function create() {
  if (!polygon.value) return;
  saving.value = true;
  try {
    await zones.create({
      name: form.name,
      polygon: polygon.value,
      frequency: form.frequency,
      filters: {
        operation: form.operation || undefined,
        propertyType: form.propertyType || undefined,
        maxPrice: form.maxPrice === '' ? undefined : form.maxPrice,
        minBedrooms: form.minBedrooms === '' ? undefined : form.minBedrooms,
      },
    });
    toasts.push('success', `Alerta "${form.name}" creada`);
    polygon.value = null;
    form.name = '';
  } catch (e) {
    toasts.push('error', messageOf(e));
  } finally {
    saving.value = false;
  }
}

async function remove(zone: Zone) {
  try {
    await zones.remove(zone.id);
    toasts.push('success', `Alerta "${zone.name}" eliminada`);
  } catch (e) {
    toasts.push('error', messageOf(e));
  }
}
</script>

<template>
  <div class="alerts-layout">
    <section class="stack">
      <h1 class="h1">Alertas por zona</h1>

      <form class="card form" @submit.prevent="create">
        <h2 class="h2">Nueva alerta</h2>
        <p class="muted">Dibuja la zona en el mapa. Te avisaremos cuando se publiquen propiedades dentro de ella.</p>
        <label>Nombre <input v-model.trim="form.name" required minlength="2" maxlength="80" placeholder="Ej: Cerca del trabajo" /></label>
        <label>
          Frecuencia
          <select v-model="form.frequency">
            <option v-for="f in AlertFrequencySchema.options" :key="f" :value="f">{{ FREQUENCY_LABEL[f] }}</option>
          </select>
        </label>
        <div class="form__grid">
          <label>
            Operación
            <select v-model="form.operation">
              <option value="">Todas</option>
              <option v-for="op in OperationSchema.options" :key="op" :value="op">{{ OPERATION_LABEL[op] }}</option>
            </select>
          </label>
          <label>
            Tipo
            <select v-model="form.propertyType">
              <option value="">Todos</option>
              <option v-for="t in PropertyTypeSchema.options" :key="t" :value="t">{{ PROPERTY_TYPE_LABEL[t] }}</option>
            </select>
          </label>
          <label>Precio máx. <input v-model.number="form.maxPrice" type="number" min="1" /></label>
          <label>Habitaciones mín. <input v-model.number="form.minBedrooms" type="number" min="0" /></label>
        </div>
        <p v-if="!polygon" class="muted">⬅ Falta dibujar la zona en el mapa.</p>
        <button class="btn btn--primary" type="submit" :disabled="!polygon || saving">
          {{ saving ? 'Guardando…' : 'Crear alerta' }}
        </button>
      </form>

      <section class="card">
        <h2 class="h2">Mis zonas</h2>
        <div v-if="zones.status === 'loading' && zones.zones.length === 0" class="skeleton skeleton--block" />
        <p v-else-if="zones.status === 'error'" class="error">{{ zones.error }}</p>
        <p v-else-if="zones.zones.length === 0" class="muted">Aún no tienes zonas guardadas.</p>
        <ul v-else class="zones">
          <li v-for="zone in zones.zones" :key="zone.id" class="zone">
            <div>
              <strong>{{ zone.name }}</strong>
              <p class="muted">{{ FREQUENCY_LABEL[zone.frequency] }}</p>
            </div>
            <button class="btn btn--ghost btn--small" type="button" @click="remove(zone)">Eliminar</button>
          </li>
        </ul>
      </section>

      <section class="card">
        <div class="card__header">
          <h2 class="h2">Notificaciones</h2>
          <button v-if="notifications.unreadCount > 0" class="btn btn--small" type="button" @click="notifications.markAllRead">
            Marcar todo como leído
          </button>
        </div>
        <p v-if="notifications.items.length === 0" class="muted">Sin notificaciones por ahora.</p>
        <ul v-else class="notifications">
          <li v-for="n in notifications.items" :key="n.id" :class="{ unread: n.readAt === null }">
            <RouterLink :to="{ name: 'listing', params: { id: n.listing.id } }">{{ n.listing.title }}</RouterLink>
            <span class="muted">
              {{ formatPrice(n.listing.price, n.listing.currency) }} · zona "{{ n.zoneName }}" · {{ formatDate(n.createdAt) }}
            </span>
          </li>
        </ul>
      </section>
    </section>

    <section class="alerts-layout__map">
      <MapView v-model:polygon="polygon" :overlays="overlays" draw-label="Dibujar zona de alerta" />
    </section>
  </div>
</template>
