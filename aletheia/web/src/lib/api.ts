import type { RemoteInput } from "./remoteInput.ts";
import { browserPlace } from "./plan.ts";
import type {
  AuditPublic,
  AuditSummary,
  AuditView,
  PlanView,
  SignInAction,
  SignInView,
} from "./types.ts";

export class ApiFailure extends Error {
  readonly code: string;
  readonly status: number | null;

  constructor(code: string, message: string, status: number | null = null) {
    super(message);
    this.name = "ApiFailure";
    this.code = code;
    this.status = status;
  }
}

async function failureFrom(response: Response): Promise<ApiFailure> {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
    message?: string;
  } | null;
  return new ApiFailure(
    body?.error ?? "unknown",
    body?.message ?? "The server did not answer properly. Please try again.",
    response.status,
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiFailure(
      "offline",
      "Could not reach Aletheia. Check your connection and try again.",
    );
  }
  if (!response.ok) throw await failureFrom(response);
  return (response.status === 204 ? undefined : await response.json()) as T;
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
}

export async function listAudits(): Promise<AuditSummary[]> {
  const { audits } = await request<{ audits: AuditSummary[] }>("/audits");
  return audits;
}

export function getAudit(id: string): Promise<AuditView> {
  return request(`/audits/${encodeURIComponent(id)}`);
}

export function getSharedAudit(token: string): Promise<AuditPublic> {
  return request(`/shared/${encodeURIComponent(token)}`);
}

export interface NewAudit {
  task: string;
  flow?: "checkout" | "subscription";
  /** Left out, the server works it out from the visitor. */
  country?: string;
  /** Left out, the server picks the sites itself. */
  sites?: { url: string; signInId?: string }[];
}

export function startAudit(audit: NewAudit): Promise<AuditView> {
  return post("/audits", { ...audit, ...browserPlace() });
}

export function planAudit(task: string): Promise<PlanView> {
  return post("/plan", { task, ...browserPlace() });
}

export function deleteAudit(id: string): Promise<void> {
  return request(`/audits/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function deleteSite(auditId: string, siteId: string): Promise<void> {
  return request(`/audits/${encodeURIComponent(auditId)}/sites/${encodeURIComponent(siteId)}`, {
    method: "DELETE",
  });
}

export async function shareAudit(id: string): Promise<string> {
  const { token } = await post<{ token: string }>(`/audits/${encodeURIComponent(id)}/share`);
  return token;
}

export function auditEventsUrl(id: string): string {
  return `/api/audits/${encodeURIComponent(id)}/events`;
}

export type ReportScope = { kind: "owner"; auditId: string } | { kind: "shared"; token: string };

export function screenshotUrl(scope: ReportScope, siteId: string, stepId: string): string {
  const base =
    scope.kind === "owner" ? `/api/audits/${scope.auditId}` : `/api/shared/${scope.token}`;
  return `${base}/sites/${siteId}/steps/${stepId}/screenshot`;
}

export async function getExamples(): Promise<string[]> {
  const { examples } = await post<{ examples: string[] }>("/examples", browserPlace());
  return examples;
}

export function startSignIn(url: string, country: string | null): Promise<SignInView> {
  return post("/signin", { url, ...(country ? { country } : {}), ...browserPlace() });
}

export function getSignIn(id: string): Promise<SignInView> {
  return request(`/signin/${id}`);
}

export function actOnSignIn(id: string, action: SignInAction): Promise<SignInView> {
  return post(`/signin/${id}/act`, action);
}

export function signOut(id: string): Promise<void> {
  return request(`/signin/${id}`, { method: "DELETE" });
}

export function sendSignInInput(id: string, input: RemoteInput): Promise<void> {
  return post(`/signin/${id}/input`, input);
}

export function signInScreenUrl(id: string): string {
  return `/api/signin/${id}/screen`;
}
