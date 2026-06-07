export type ApiUser = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  root_admin: boolean;
};

export type ApiNest = {
  id: number;
  name: string;
  description: string;
};

export type ApiEgg = {
  id: number;
  name: string;
  description: string;
};

export type ApiNode = {
  id: number;
  name: string;
  fqdn: string;
  memory: number;
  disk: number;
};

export type ApiLocation = {
  id: number;
  short: string;
  long: string;
};

type ApiList<T> = { data: { attributes: T }[] };
type ApiItem<T> = { attributes: T };

export type PanelClient = ReturnType<typeof createClient>;

const REQUEST_TIMEOUT_MS = 30000;

/** Creates and returns a Pterodactyl Application API client bound to `baseUrl` with `apiKey`. */
export function createClient(baseUrl: string, apiKey: string) {
  try {
    // An unparseable base URL otherwise surfaces as fetch() ERR_INVALID_URL
    // on every request; reject it here with the offending value.
    new URL(baseUrl);
  } catch {
    throw new Error(
      `Invalid panel URL "${baseUrl}". Expected an absolute URL like https://panel.example.com`
    );
  }
  const base = `${baseUrl}/api/application`;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  /** Sends an authenticated request to the panel API and returns the parsed JSON response. */
  async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${base}${path}`, {
        ...options,
        headers: { ...headers, ...options.headers },
        signal: options.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      // AbortSignal.timeout rejects with a TimeoutError; surface it with context.
      if (err instanceof Error && err.name === 'TimeoutError') {
        throw new Error(`Panel did not respond within ${REQUEST_TIMEOUT_MS / 1000}s (${baseUrl})`);
      }
      throw err;
    }
    if (!response.ok) {
      let errorMessage = `API error ${response.status}`;
      try {
        const body = (await response.json()) as { errors?: { detail?: string }[] };
        if (body.errors?.[0]?.detail) errorMessage += `: ${body.errors[0].detail}`;
      } catch {}
      throw new Error(errorMessage);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  return {
    // Users
    getUsers: () =>
      request<ApiList<ApiUser>>('/users').then(list => list.data.map(item => item.attributes)),
    createUser: (data: Partial<ApiUser> & { password: string }) =>
      request<ApiItem<ApiUser>>('/users', {
        method: 'POST',
        body: JSON.stringify(data),
      }).then(item => item.attributes),
    updateUser: (id: number, data: Partial<ApiUser> & { password?: string }) =>
      request<ApiItem<ApiUser>>(`/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }).then(item => item.attributes),
    deleteUser: (id: number) => request<void>(`/users/${id}`, { method: 'DELETE' }),

    // Nests
    getNests: () =>
      request<ApiList<ApiNest>>('/nests').then(list => list.data.map(item => item.attributes)),

    // Eggs
    getEggs: (nestId: number) =>
      request<ApiList<ApiEgg>>(`/nests/${nestId}/eggs`).then(list =>
        list.data.map(item => item.attributes)
      ),
    importEgg: (nestId: number, json: unknown) =>
      request<ApiItem<ApiEgg>>(`/nests/${nestId}/eggs`, {
        method: 'POST',
        body: JSON.stringify(json),
      }).then(item => item.attributes),
    updateEgg: (nestId: number, eggId: number, json: unknown) =>
      request<ApiItem<ApiEgg>>(`/nests/${nestId}/eggs/${eggId}`, {
        method: 'PUT',
        body: JSON.stringify(json),
      }).then(item => item.attributes),
    deleteEgg: (nestId: number, eggId: number) =>
      request<void>(`/nests/${nestId}/eggs/${eggId}`, { method: 'DELETE' }),

    // Locations
    getLocations: () =>
      request<ApiList<ApiLocation>>('/locations').then(list =>
        list.data.map(item => item.attributes)
      ),
    createLocation: (data: { short: string; long: string }) =>
      request<ApiItem<ApiLocation>>('/locations', {
        method: 'POST',
        body: JSON.stringify(data),
      }).then(item => item.attributes),

    // Nodes
    getNodes: () =>
      request<ApiList<ApiNode>>('/nodes').then(list => list.data.map(item => item.attributes)),
    createNode: (data: Record<string, unknown>) =>
      request<ApiItem<ApiNode>>('/nodes', {
        method: 'POST',
        body: JSON.stringify(data),
      }).then(item => item.attributes),
  };
}
