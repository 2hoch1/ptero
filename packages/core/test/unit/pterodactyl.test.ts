import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createClient } from '@core/panel/client';

function makeResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

const mockFetch = mock(() => makeResponse({ data: [] }));

beforeEach(() => {
  mockFetch.mockClear();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

describe('createClient', () => {
  const client = createClient('https://panel.example.com', 'ptla_testkey');

  it('throws on an unparseable base URL', () => {
    expect(() => createClient('not-a-valid-url', 'ptla_testkey')).toThrow('Invalid panel URL');
  });

  it('sends Authorization header on every request', async () => {
    mockFetch.mockImplementation(() => makeResponse({ data: [] }));
    await client.getUsers();
    const [, options] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer ptla_testkey');
  });

  it('sends Accept and Content-Type headers', async () => {
    mockFetch.mockImplementation(() => makeResponse({ data: [] }));
    await client.getUsers();
    const [, options] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Accept']).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('getUsers calls GET /api/application/users', async () => {
    mockFetch.mockImplementation(() =>
      makeResponse({ data: [{ attributes: { id: 1, username: 'admin', email: 'a@b.com', first_name: 'A', last_name: 'B', root_admin: true } }] })
    );
    const users = await client.getUsers();
    expect(users).toHaveLength(1);
    expect(users[0].username).toBe('admin');
    const [url] = mockFetch.mock.calls[0] as unknown as [string];
    expect(url).toContain('/api/application/users');
  });

  it('deleteUser calls DELETE with correct URL', async () => {
    mockFetch.mockImplementation(() => makeResponse(null, 204));
    await client.deleteUser(42);
    const [url, options] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/users/42');
    expect(options.method).toBe('DELETE');
  });

  it('throws a descriptive error on non-2xx response', async () => {
    mockFetch.mockImplementation(() =>
      makeResponse({ errors: [{ detail: 'User not found' }] }, 404)
    );
    await expect(client.deleteUser(999)).rejects.toThrow('API error 404: User not found');
  });

  it('throws generic error when no detail in error body', async () => {
    mockFetch.mockImplementation(() => makeResponse({}, 500));
    await expect(client.getUsers()).rejects.toThrow('API error 500');
  });

  it('getNests maps data to attributes', async () => {
    mockFetch.mockImplementation(() =>
      makeResponse({ data: [{ attributes: { id: 1, name: 'Default', description: '' } }] })
    );
    const nests = await client.getNests();
    expect(nests[0].name).toBe('Default');
  });

  it('createNode sends POST with body', async () => {
    mockFetch.mockImplementation(() =>
      makeResponse({ attributes: { id: 5, name: 'node1', fqdn: 'node1.example.com', memory: 1024, disk: 10240 } })
    );
    const node = await client.createNode({ name: 'node1', fqdn: 'node1.example.com' });
    expect(node.name).toBe('node1');
    const [, options] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body as string)).toMatchObject({ name: 'node1' });
  });
});
