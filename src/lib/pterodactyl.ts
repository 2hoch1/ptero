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

  async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${base}${path}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    });
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
    getUsers: () => request<ApiList<ApiUser>>('/users').then(r => r.data.map(d => d.attributes)),
    createUser: (data: Partial<ApiUser> & { password: string }) =>
      request<ApiItem<ApiUser>>('/users', {
        method: 'POST',
        body: JSON.stringify(data),
      }).then(r => r.attributes),
    updateUser: (id: number, data: Partial<ApiUser> & { password?: string }) =>
      request<ApiItem<ApiUser>>(`/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }).then(r => r.attributes),
    deleteUser: (id: number) => request<void>(`/users/${id}`, { method: 'DELETE' }),

    // Nests
    getNests: () => request<ApiList<ApiNest>>('/nests').then(r => r.data.map(d => d.attributes)),

    // Eggs
    getEggs: (nestId: number) =>
      request<ApiList<ApiEgg>>(`/nests/${nestId}/eggs`).then(r => r.data.map(d => d.attributes)),
    importEgg: (nestId: number, json: unknown) =>
      request<ApiItem<ApiEgg>>(`/nests/${nestId}/eggs`, {
        method: 'POST',
        body: JSON.stringify(json),
      }).then(r => r.attributes),
    updateEgg: (nestId: number, eggId: number, json: unknown) =>
      request<ApiItem<ApiEgg>>(`/nests/${nestId}/eggs/${eggId}`, {
        method: 'PUT',
        body: JSON.stringify(json),
      }).then(r => r.attributes),
    deleteEgg: (nestId: number, eggId: number) =>
      request<void>(`/nests/${nestId}/eggs/${eggId}`, { method: 'DELETE' }),

    // Locations
    getLocations: () =>
      request<ApiList<ApiLocation>>('/locations').then(r => r.data.map(d => d.attributes)),
    createLocation: (data: { short: string; long: string }) =>
      request<ApiItem<ApiLocation>>('/locations', {
        method: 'POST',
        body: JSON.stringify(data),
      }).then(r => r.attributes),

    // Nodes
    createNode: (data: Record<string, unknown>) =>
      request<ApiItem<ApiNode>>('/nodes', {
        method: 'POST',
        body: JSON.stringify(data),
      }).then(r => r.attributes),
  };
}
