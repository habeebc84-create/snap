import { useEffect, useRef, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  getAnalytics,
  getAuditLogs,
  getDocument,
  getModels,
  getSecurityStatus,
  getSettings,
  getStatus,
  listDocuments,
  loadDemoData,
  processDocument,
  reviewDocument,
  searchDocuments,
  updateSettings,
  uploadDocument,
  deleteDocument,
  type ReviewPayload,
} from "../api/endpoints";
import { ACTIVE_STATUSES, type AppSettings, type DocumentSummary } from "../types";

export function useDocuments(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ["documents", params],
    queryFn: () => listDocuments(params),
    refetchOnWindowFocus: false,
    // keep pipeline cards live while anything is still processing
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      return items.some((item) => ACTIVE_STATUSES.includes(item.status)) ? 1500 : false;
    },
  });
}

export function useSearch(params: Record<string, unknown>, enabled = true) {
  return useQuery({
    queryKey: ["search", params],
    queryFn: () => searchDocuments(params),
    enabled,
    refetchOnWindowFocus: false,
  });
}

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: ["document", id],
    queryFn: () => getDocument(id as string),
    enabled: Boolean(id),
  });
}

export function useDocumentStatus(id: string | undefined) {
  return useQuery({
    queryKey: ["status", id],
    queryFn: () => getStatus(id as string),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && ACTIVE_STATUSES.includes(status) ? 700 : false;
    },
  });
}

export function useAnalytics() {
  return useQuery({
    queryKey: ["analytics"],
    queryFn: getAnalytics,
    refetchOnWindowFocus: false,
  });
}

export function useSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: getSettings, staleTime: 60_000 });
}

export function useSecurityStatus() {
  return useQuery({
    queryKey: ["security"],
    queryFn: getSecurityStatus,
    refetchOnWindowFocus: false,
  });
}

export function useAuditLogs(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ["audit", params],
    queryFn: () => getAuditLogs(params),
    refetchOnWindowFocus: false,
  });
}

export function useModels() {
  return useQuery({ queryKey: ["models"], queryFn: getModels, staleTime: 300_000 });
}

export function useUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadDocument,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}

export function useProcess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: processDocument,
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      void queryClient.invalidateQueries({ queryKey: ["status", id] });
      void queryClient.invalidateQueries({ queryKey: ["document", id] });
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}

export function useDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, purgeOcr }: { id: string; purgeOcr?: boolean }) =>
      deleteDocument(id, purgeOcr ?? true),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      void queryClient.invalidateQueries({ queryKey: ["search"] });
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
      void queryClient.invalidateQueries({ queryKey: ["audit"] });
      void queryClient.invalidateQueries({ queryKey: ["security"] });
    },
  });
}

export function useReview(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReviewPayload) => reviewDocument(id, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(["document", id], data);
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      void queryClient.invalidateQueries({ queryKey: ["search"] });
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
      void queryClient.invalidateQueries({ queryKey: ["audit"] });
      void queryClient.invalidateQueries({ queryKey: ["status", id] });
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<AppSettings> & { consent?: boolean }) =>
      updateSettings(payload),
    onSuccess: (settings) => {
      queryClient.setQueryData(["settings"], settings);
      void queryClient.invalidateQueries({ queryKey: ["security"] });
      void queryClient.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export function useLoadDemo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: loadDemoData,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
      void queryClient.invalidateQueries({ queryKey: ["search"] });
    },
  });
}

/** Debounce a rapidly-changing value (e.g. search input). */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer.current);
  }, [value, delay]);
  return debounced;
}

export type { UseQueryResult, DocumentSummary };
