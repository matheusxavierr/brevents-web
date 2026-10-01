type ApiOptions = Omit<RequestInit, "body"> & { body?: unknown };

export class ApiError extends Error {
  constructor(public status: number, public details: unknown) {
    super(readError(details));
  }
}

export async function apiClient<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await fetch(`/api/backend/${path.replace(/^\//, "")}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, data);
  return data as T;
}

export function readError(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(readError).join(" ");
  if (value && typeof value === "object") {
    const messages = Object.values(value).flatMap((item) => (Array.isArray(item) ? item : [item]));
    return messages.map(readError).join(" ");
  }
  return "Não foi possível concluir a operação.";
}
