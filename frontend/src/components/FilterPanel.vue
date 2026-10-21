<script setup lang="ts">
import { OperationSchema, PropertyTypeSchema, type Operation, type PropertyType } from '@portal/shared';
import { reactive, watch } from 'vue';
import type { ListingFilters } from '@/stores/listings';
import { OPERATION_LABEL, PROPERTY_TYPE_LABEL } from '@/utils/format';

const props = defineProps<{ modelValue: ListingFilters }>();
const emit = defineEmits<{ apply: [filters: ListingFilters] }>();

interface FormState {
  operation: Operation | '';
  propertyType: PropertyType | '';
  minPrice: number | '';
  maxPrice: number | '';
  minBedrooms: number | '';
}

const toForm = (f: ListingFilters): FormState => ({
  operation: f.operation ?? '',
  propertyType: f.propertyType ?? '',
  minPrice: f.minPrice ?? '',
  maxPrice: f.maxPrice ?? '',
  minBedrooms: f.minBedrooms ?? '',
});

const form = reactive<FormState>(toForm(props.modelValue));
watch(() => props.modelValue, (value) => Object.assign(form, toForm(value)));

const orUndefined = <T,>(value: T | '') => (value === '' ? undefined : value);

function apply() {
  emit('apply', {
    operation: orUndefined(form.operation),
    propertyType: orUndefined(form.propertyType),
    minPrice: orUndefined(form.minPrice),
    maxPrice: orUndefined(form.maxPrice),
    minBedrooms: orUndefined(form.minBedrooms),
  });
}

function reset() {
  Object.assign(form, toForm({}));
  apply();
}
</script>

<template>
  <form class="filters" @submit.prevent="apply">
    <select v-model="form.operation" aria-label="Operación">
      <option value="">Venta y arriendo</option>
      <option v-for="op in OperationSchema.options" :key="op" :value="op">{{ OPERATION_LABEL[op] }}</option>
    </select>
    <select v-model="form.propertyType" aria-label="Tipo de inmueble">
      <option value="">Todos los tipos</option>
      <option v-for="t in PropertyTypeSchema.options" :key="t" :value="t">{{ PROPERTY_TYPE_LABEL[t] }}</option>
    </select>
    <input v-model.number="form.minPrice" type="number" min="0" inputmode="numeric" placeholder="Precio mín." aria-label="Precio mínimo" />
    <input v-model.number="form.maxPrice" type="number" min="0" inputmode="numeric" placeholder="Precio máx." aria-label="Precio máximo" />
    <input
      v-model.number="form.minBedrooms"
      type="number"
      min="0"
      max="50"
      inputmode="numeric"
      placeholder="Habitaciones mín."
      aria-label="Habitaciones mínimas"
    />
    <button class="btn btn--primary" type="submit">Filtrar</button>
    <button class="btn btn--secondary" type="button" @click="reset">Limpiar</button>
  </form>
</template>
