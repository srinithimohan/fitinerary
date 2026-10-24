import { expect, it, vi } from 'vitest';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/app/lib/supabase';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

it('forwards the Clerk access token using the publishable client rather than an admin key', async () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.invalid');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'synthetic-publishable-key');
  const getToken = vi.fn().mockResolvedValue('synthetic-token');
  vi.mocked(auth).mockResolvedValue({ getToken } as unknown as Awaited<ReturnType<typeof auth>>);
  createServerSupabaseClient();
  const [url, key, options] = vi.mocked(createClient).mock.calls[0];
  expect(url).toBe('https://supabase.invalid');
  expect(key).toBe('synthetic-publishable-key');
  expect(await (options!.accessToken as () => Promise<string>)()).toBe('synthetic-token');
  expect(getToken).toHaveBeenCalledOnce();
  vi.unstubAllEnvs();
});
