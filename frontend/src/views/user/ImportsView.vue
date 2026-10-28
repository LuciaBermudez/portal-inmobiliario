<script setup lang="ts">
import { CSV_COLUMNS, type ImportJob } from '@portal/shared';
import { onMounted, ref } from 'vue';
import { useImportsStore } from '@/stores/imports';
import { useToastStore } from '@/stores/toasts';
import { formatDate, formatNumber, IMPORT_STATUS_LABEL } from '@/utils/format';

const imports = useImportsStore();
const toasts = useToastStore();

const file = ref<File | null>(null);
const idempotencyKey = ref<string | null>(null);
const expanded = ref<string | null>(null);

onMounted(() => void imports.fetchAll());

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  file.value = input.files?.[0] ?? null;
  idempotencyKey.value = file.value ? crypto.randomUUID() : null;
}

async function upload() {
  if (!file.value || !idempotencyKey.value) return;
  const job = await imports.start(file.value, idempotencyKey.value);
  if (job) {
    toasts.push('info', `"${job.originalName}" en cola. Puedes seguir navegando.`);
    file.value = null;
    idempotencyKey.value = null;
  }
}

async function toggleErrors(job: ImportJob) {
  expanded.value = expanded.value === job.id ? null : job.id;
  if (expanded.value) await imports.fetchErrors(job.id);
}

const percent = (ratio: number) => `${Math.round(ratio * 100)}%`;
</script>

<template>
  <div class="stack">
    <h1 class="h1">Carga masiva de propiedades</h1>

    <section class="card">
      <h2 class="h2">Subir catálogo CSV</h2>
      <p class="muted">
        Columnas: <code>{{ CSV_COLUMNS.join(',') }}</code>. El archivo se procesa en segundo plano; las filas con errores se
        reportan sin detener la carga y re-importar el mismo catálogo actualiza en lugar de duplicar.
      </p>
      <form class="upload" @submit.prevent="upload">
        <input type="file" accept=".csv,text/csv" :disabled="imports.upload.active" @change="onFileChange" />
        <button class="btn btn--primary" type="submit" :disabled="!file || imports.upload.active">
          {{ imports.upload.active ? 'Subiendo…' : 'Importar' }}
        </button>
      </form>
      <div v-if="imports.upload.active" class="progress" role="progressbar" :aria-valuenow="Math.round(imports.upload.progress * 100)">
        <div class="progress__bar" :style="{ width: percent(imports.upload.progress) }" />
        <span class="progress__label">Subiendo {{ percent(imports.upload.progress) }}</span>
      </div>
      <p v-if="imports.upload.error" class="error" role="alert">
        {{ imports.upload.error }}
        <button v-if="file" class="btn btn--small" type="button" @click="upload">Reintentar</button>
      </p>
    </section>

    <section class="card">
      <h2 class="h2">Importaciones recientes</h2>
      <div v-if="imports.status === 'loading' && imports.jobs.length === 0" class="skeleton skeleton--block" />
      <p v-else-if="imports.status === 'error'" class="error">{{ imports.error }}</p>
      <p v-else-if="imports.jobs.length === 0" class="muted">Todavía no hay importaciones.</p>

      <ul v-else class="jobs">
        <li v-for="job in imports.jobs" :key="job.id" class="job">
          <div class="job__row">
            <strong class="ellipsis">{{ job.originalName }}</strong>
            <span class="badge" :class="`badge--${job.status}`">{{ IMPORT_STATUS_LABEL[job.status] }}</span>
          </div>
          <div v-if="job.status === 'processing' || job.status === 'queued'" class="progress progress--indeterminate">
            <div class="progress__bar" />
          </div>
          <p class="muted job__stats">
            {{ formatNumber(job.processedRows) }} filas procesadas · {{ formatNumber(job.insertedRows) }} nuevas ·
            {{ formatNumber(job.updatedRows) }} actualizadas · {{ formatNumber(job.failedRows) }} con error ·
            {{ formatDate(job.createdAt) }}
          </p>
          <p v-if="job.errorMessage" class="error">{{ job.errorMessage }}</p>
          <button v-if="job.failedRows > 0" class="btn btn--small" type="button" @click="toggleErrors(job)">
            {{ expanded === job.id ? 'Ocultar errores' : 'Ver errores por fila' }}
          </button>
          <table v-if="expanded === job.id && imports.errorsByJob[job.id]" class="table">
            <thead><tr><th>Fila</th><th>Error</th></tr></thead>
            <tbody>
              <tr v-for="rowError in imports.errorsByJob[job.id]" :key="rowError.rowNumber">
                <td>{{ rowError.rowNumber }}</td>
                <td>{{ rowError.message }}</td>
              </tr>
            </tbody>
          </table>
        </li>
      </ul>
    </section>
  </div>
</template>
