import { useQuery } from '@tanstack/react-query';
import * as z from 'zod/mini';
import { compressImage } from '../image';
import { getSupabase } from '../supabase';
import type { Bundle } from './schemas';

export const AVATAR_MAX_BYTES = 200 * 1024;

const ProfileSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  avatar_path: z.nullable(z.string()),
  phone: z.nullable(z.string()),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const profileKey = (userId: string) => ['profile', userId] as const;

export function useMyProfile(userId: string | undefined) {
  return useQuery({
    queryKey: profileKey(userId ?? ''),
    enabled: userId !== undefined,
    queryFn: async () => {
      const sb = await getSupabase();
      const { data, error } = await sb
        .from('profiles')
        .select('id, display_name, avatar_path, phone')
        .eq('id', userId ?? '')
        .single();
      if (error) throw error;
      return ProfileSchema.parse(data);
    },
  });
}

/** Compresses on the device (≤ 200 KB, 512 px), uploads to avatars/<user>/, records the path. */
export async function uploadAvatar(userId: string, file: Blob): Promise<string> {
  const blob = await compressImage(file, AVATAR_MAX_BYTES, 512);
  const sb = await getSupabase();
  const path = `${userId}/${crypto.randomUUID()}.webp`;
  const up = await sb.storage.from('avatars').upload(path, blob, { contentType: 'image/webp' });
  if (up.error) throw up.error;
  const { error } = await sb.from('profiles').update({ avatar_path: path }).eq('id', userId);
  if (error) throw error;
  return path;
}

/** Signed URLs (1 h) for every photo in the bundle, keyed by user id. */
export function useAvatarUrls(bundle: Bundle | null | undefined): Map<string, string> {
  const avatars = bundle?.avatars ?? [];
  const paths = avatars.map((a) => a.avatar_path);
  const query = useQuery({
    queryKey: ['avatar-urls', ...paths],
    enabled: paths.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const sb = await getSupabase();
      const { data, error } = await sb.storage.from('avatars').createSignedUrls(paths, 3600);
      if (error) throw error;
      return new Map(
        data.flatMap((d) => {
          const owner = avatars.find((a) => a.avatar_path === d.path);
          return owner && d.signedUrl ? [[owner.user_id, d.signedUrl] as const] : [];
        }),
      );
    },
  });
  return query.data ?? new Map<string, string>();
}

/** Signed URL for one photo path (e.g. the signed-in user's own). */
export function useAvatarUrl(path: string | null | undefined): string | undefined {
  const query = useQuery({
    queryKey: ['avatar-url', path],
    enabled: Boolean(path),
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const sb = await getSupabase();
      const { data, error } = await sb.storage.from('avatars').createSignedUrl(path ?? '', 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  return query.data;
}
