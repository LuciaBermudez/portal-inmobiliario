<script setup lang="ts">
import { canEditListing, ListingStatusSchema, type AsyncStatus, type Listing, type ListingStatus } from '@portal/shared';
import { computed, reactive, ref, watch } from 'vue';
import { ApiError, messageOf } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { useListingsStore } from '@/stores/listings';
import { useToastStore } from '@/stores/toasts';
import { formatDate, formatPrice, OPERATION_LABEL, PROPERTY_TYPE_LABEL } from '@/utils/format';

const props = defineProps<{ id: string }>();

const listings = useListingsStore();
const auth = useAuthStore();
const toasts = useToastStore();

const status = ref<AsyncStatus>('idle');
const error = ref<string | null>(null);
const saving = ref(false);
const conflict = ref(false);
const listing = computed<Listing | undefined>(() => listings.byId[props.id]);
const canEdit = computed(() => listing.value !== undefined && canEditListing(auth.user, listing.value));

const form = reactive({ title: '', price: 0, status: 'active' as ListingStatus, description: '' });

function fillForm(l: Listing) {
  Object.assign(form, { title: l.title, price: l.price, status: l.status, description: l.description });
}

async function load() {
  status.value = 'loading';
  error.value = null;
  conflict.value = false;
  try {
    fillForm(await listings.fetchOne(props.id));
    status.value = 'success';
  } catch (e) {
    status.value = 'error';
    error.value = e instanceof ApiError && e.status === 404 ? 'Esta propiedad no existe' : messageOf(e);
  }
}

watch(() => props.id, load, { immediate: true });

async function save() {
  if (!listing.value) return;
  saving.value = true;
  conflict.value = false;
  try {
    const updated = await listings.update(listing.value.id, {
      version: listing.value.version, // bloqueo optimista
      title: form.title,
      price: form.price,
      status: form.status,
      description: form.description,
    });
    fillForm(updated);
    toasts.push('success', 'Cambios guardados');
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) conflict.value = true;
    else toasts.push('error', messageOf(e));
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="detail">
    <RouterLink to="/" class="muted">← Volver a la búsqueda</RouterLink>

    <div v-if="status === 'loading' && !listing" class="skeleton skeleton--block" aria-busy="true" />

    <div v-else-if="status === 'error'" class="list-state list-state--error" role="alert">
      <p>{{ error }}</p>
      <button class="btn" type="button" @click="load">Reintentar</button>
    </div>

    <template v-else-if="listing">
      <header class="detail__header">
        <span class="badge" :class="`badge--${listing.operation}`">{{ OPERATION_LABEL[listing.operation] }}</span>
        <h1 class="h1">{{ listing.title }}</h1>
        <p class="detail__price">{{ formatPrice(listing.price, listing.currency) }}</p>
        <p class="muted">
          {{ PROPERTY_TYPE_LABEL[listing.propertyType] }} · {{ listing.address }} · Actualizado {{ formatDate(listing.updatedAt) }}
        </p>
      </header>

      <dl class="facts">
        <div><dt>Habitaciones</dt><dd>{{ listing.bedrooms ?? '—' }}</dd></div>
        <div><dt>Baños</dt><dd>{{ listing.bathrooms ?? '—' }}</dd></div>
        <div><dt>Superficie</dt><dd>{{ listing.areaM2 ? `${listing.areaM2} m²` : '—' }}</dd></div>
        <div><dt>Código</dt><dd>{{ listing.externalId }}</dd></div>
      </dl>
      <p class="detail__description">{{ listing.description || 'Sin descripción.' }}</p>

      <section v-if="canEdit" class="card">
        <h2 class="h2">Editar aviso</h2>
        <div v-if="conflict" class="banner banner--warning" role="alert">
          Otra persona modificó este aviso mientras lo editabas.
          <button class="btn btn--small" type="button" @click="load">Cargar la última versión</button>
        </div>
        <form class="form" @submit.prevent="save">
          <label>Título <input v-model.trim="form.title" required minlength="3" maxlength="200" /></label>
          <label>Precio ({{ listing.currency }}) <input v-model.number="form.price" type="number" min="1" required /></label>
          <label>
            Estado
            <select v-model="form.status">
              <option v-for="s in ListingStatusSchema.options" :key="s" :value="s">{{ s === 'active' ? 'Publicado' : 'Pausado' }}</option>
            </select>
          </label>
          <label>Descripción <textarea v-model.trim="form.description" rows="4" maxlength="5000" /></label>
          <button class="btn btn--primary" type="submit" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar' }}</button>
        </form>
      </section>
    </template>
  </div>
</template>
