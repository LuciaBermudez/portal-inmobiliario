import type { AsyncStatus, ImportJob, ImportRowErrorDto, ImportStatus } from '@portal/shared';
import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';
import { messageOf } from '@/api/http';
import { importsApi, uploadImport } from '@/api/imports';

const STATUS_RANK: Record<ImportStatus, number> = { queued: 0, processing: 1, completed: 2, failed: 2 };

export function isNewer(candidate: ImportJob, current: ImportJob | undefined): boolean {
  if (!current) return true;
  const rankDiff = STATUS_RANK[candidate.status] - STATUS_RANK[current.status];
  if (rankDiff !== 0) return rankDiff > 0;
  return candidate.processedRows >= current.processedRows;
}

export const useImportsStore = defineStore('imports', () => {
  const byId = ref<Record<string, ImportJob>>({});
  const order = ref<string[]>([]);
  const status = ref<AsyncStatus>('idle');
  const error = ref<string | null>(null);
  const errorsByJob = ref<Record<string, ImportRowErrorDto[]>>({});
  const upload = reactive({ active: false, progress: 0, error: null as string | null });

  const tilesVersion = ref(0);

  const jobs = computed(() => order.value.map((id) => byId.value[id]).filter((j): j is ImportJob => j !== undefined));

  function put(job: ImportJob) {
    const previous = byId.value[job.id];
    if (!isNewer(job, previous)) return;
    byId.value[job.id] = job;
    if (!order.value.includes(job.id)) order.value.unshift(job.id);
    if (job.status === 'completed' && previous?.status !== 'completed') tilesVersion.value++;
  }

  async function fetchAll() {
    status.value = 'loading';
    error.value = null;
    try {
      const list = await importsApi.list();
      for (const job of list) {
        byId.value[job.id] = job;
      }
      order.value = list.map((j) => j.id);
      status.value = 'success';
    } catch (e) {
      status.value = 'error';
      error.value = messageOf(e);
    }
  }

  async function start(file: File, idempotencyKey: string): Promise<ImportJob | null> {
    upload.active = true;
    upload.progress = 0;
    upload.error = null;
    try {
      const job = await uploadImport(file, idempotencyKey, (ratio) => {
        upload.progress = ratio;
      });
      put(job);
      return job;
    } catch (e) {
      upload.error = messageOf(e);
      return null;
    } finally {
      upload.active = false;
    }
  }

  async function fetchErrors(id: string) {
    errorsByJob.value[id] = await importsApi.errors(id);
  }

  return { byId, jobs, status, error, upload, errorsByJob, tilesVersion, fetchAll, start, fetchErrors, applyProgress: put };
});
