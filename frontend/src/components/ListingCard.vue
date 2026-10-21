<script setup lang="ts">
import type { Listing } from '@portal/shared';
import { formatPrice, OPERATION_LABEL, PROPERTY_TYPE_LABEL } from '@/utils/format';

defineProps<{ listing: Listing; favorite: boolean }>();
const emit = defineEmits<{ open: []; toggleFavorite: [] }>();
</script>

<template>
  <article class="listing-card" tabindex="0" @click="emit('open')" @keydown.enter="emit('open')">
    <div class="listing-card__head">
      <span class="badge" :class="`badge--${listing.operation}`">{{ OPERATION_LABEL[listing.operation] }}</span>
      <span class="muted">{{ PROPERTY_TYPE_LABEL[listing.propertyType] }}</span>
      <button
        type="button"
        class="fav"
        :aria-pressed="favorite"
        :aria-label="favorite ? 'Quitar de favoritos' : 'Guardar en favoritos'"
        @click.stop="emit('toggleFavorite')"
      >
        {{ favorite ? '★' : '☆' }}
      </button>
    </div>
    <h3 class="listing-card__title">{{ listing.title }}</h3>
    <p class="listing-card__price">{{ formatPrice(listing.price, listing.currency) }}</p>
    <p class="muted listing-card__meta">
      <span v-if="listing.bedrooms !== null">{{ listing.bedrooms }} hab.</span>
      <span v-if="listing.bathrooms !== null">{{ listing.bathrooms }} baños</span>
      <span v-if="listing.areaM2 !== null">{{ listing.areaM2 }} m²</span>
      <span class="ellipsis">{{ listing.address }}</span>
    </p>
  </article>
</template>
