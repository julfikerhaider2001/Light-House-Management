import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as z from 'zod/mini';
import { getSupabase } from '../supabase';
import { readStored, writeStored } from '../storage';

export const membershipsKey = ['memberships'] as const;

const MembershipSchema = z.object({
  id: z.string(),
  mess_id: z.string(),
  role: z.enum(['manager', 'member']),
  status: z.enum(['active', 'left']),
  display_name: z.string(),
  messes: z.object({ name: z.string(), deleted_at: z.nullable(z.string()) }),
});
export type Membership = z.infer<typeof MembershipSchema>;

/** The messes the signed-in user belongs to. */
export function useMemberships(userId: string | undefined) {
  return useQuery({
    queryKey: [...membershipsKey, userId],
    enabled: userId !== undefined,
    queryFn: async () => {
      const sb = await getSupabase();
      const { data, error } = await sb
        .from('mess_members')
        .select('id, mess_id, role, status, display_name, messes(name, deleted_at)')
        .eq('user_id', userId ?? '')
        .order('created_at');
      if (error) throw error;
      return z.array(MembershipSchema).parse(data);
    },
  });
}

const CURRENT_MESS = 'lh.currentMess';
export const rememberMess = (messId: string) => writeStored(CURRENT_MESS, messId);
export const rememberedMess = () => readStored(CURRENT_MESS);

const CreatedSchema = z.object({
  mess_id: z.string(),
  member_id: z.string(),
  period_id: z.string(),
  invite_code: z.string(),
});

export function useCreateMess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; displayName?: string }) => {
      const sb = await getSupabase();
      const { data, error } = await sb.rpc('create_mess', {
        p_name: input.name,
        ...(input.displayName ? { p_display_name: input.displayName } : {}),
      });
      if (error) throw error;
      return CreatedSchema.parse(data);
    },
    onSuccess: async (created) => {
      rememberMess(created.mess_id);
      await qc.invalidateQueries({ queryKey: membershipsKey });
    },
  });
}

const PreviewSchema = z.object({
  mess_id: z.string(),
  name: z.string(),
  placeholders: z.array(z.object({ id: z.string(), display_name: z.string() })),
});
export type InvitePreview = z.infer<typeof PreviewSchema>;

export async function previewInvite(code: string): Promise<InvitePreview | null> {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('preview_invite', { p_code: code });
  if (error) throw error;
  return data === null ? null : PreviewSchema.parse(data);
}

export function useJoinMess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { code: string; claimMemberId?: string }) => {
      const sb = await getSupabase();
      const { data, error } = await sb.rpc('join_mess', {
        p_code: input.code,
        ...(input.claimMemberId ? { p_claim_member: input.claimMemberId } : {}),
      });
      if (error) throw error;
      return z.object({ mess_id: z.string(), member_id: z.string() }).parse(data);
    },
    onSuccess: async (joined) => {
      rememberMess(joined.mess_id);
      await qc.invalidateQueries({ queryKey: membershipsKey });
    },
  });
}
