import * as z from 'zod/mini';

// Shapes returned by the server-side API (see supabase/migrations/*_api.sql).
// numeric columns arrive as JSON numbers.

const uuid = z.string();
const date = z.string();
const nullableString = z.nullable(z.string());

export const MessSchema = z.object({
  id: uuid,
  name: z.string(),
  currency: z.string(),
  timezone: z.string(),
  invite_code: z.string(),
  meal_cutoff_time: z.string(),
  created_by: z.nullable(uuid),
});

export const PeriodSchema = z.object({
  id: uuid,
  mess_id: uuid,
  month: date,
  status: z.enum(['open', 'closed']),
  closed_at: nullableString,
  snapshot: z.nullable(z.unknown()),
  reopened_at: nullableString,
  reopen_reason: nullableString,
});

export const MemberSchema = z.object({
  id: uuid,
  mess_id: uuid,
  user_id: z.nullable(uuid),
  display_name: z.string(),
  role: z.enum(['manager', 'member']),
  status: z.enum(['active', 'left']),
  joined_on: date,
  left_on: z.nullable(date),
});

export const MealSchema = z.object({
  id: uuid,
  member_id: uuid,
  date,
  meals: z.number(),
  note: nullableString,
  updated_at: z.string(),
});

export const ExpenseItemSchema = z.object({ name: z.string(), amount: z.number() });

export const ExpenseSchema = z.object({
  id: uuid,
  member_id: uuid,
  date,
  amount: z.number(),
  kind: z.enum(['bazar', 'initial']),
  items: z.array(ExpenseItemSchema),
  receipt_path: nullableString,
  note: nullableString,
  created_by: z.nullable(uuid),
  created_at: z.string(),
});

export const BillKindSchema = z.enum([
  'khala',
  'house_rent',
  'wifi',
  'gas',
  'electricity',
  'extra',
  'other',
]);

export const BillSchema = z.object({
  id: uuid,
  kind: BillKindSchema,
  label: nullableString,
  amount: z.number(),
});

export const RentShareSchema = z.object({ member_id: uuid, fixed_amount: z.nullable(z.number()) });
export const DueSchema = z.object({ member_id: uuid, amount: z.number() });

export const PaymentSchema = z.object({
  id: uuid,
  member_id: uuid,
  amount: z.number(),
  method: z.enum(['cash', 'bkash', 'nagad', 'bank']),
  date,
  note: nullableString,
  created_at: z.string(),
});

export const BundleSchema = z.object({
  mess: MessSchema,
  period: PeriodSchema,
  me: z.nullable(uuid),
  is_manager: z.boolean(),
  periods: z.array(z.object({ id: uuid, month: date, status: z.enum(['open', 'closed']) })),
  members: z.array(MemberSchema),
  meals: z.array(MealSchema),
  expenses: z.array(ExpenseSchema),
  bills: z.array(BillSchema),
  rent_shares: z.array(RentShareSchema),
  previous_dues: z.array(DueSchema),
  payments: z.array(PaymentSchema),
});

export const ActivitySchema = z.object({
  id: z.number(),
  mess_id: uuid,
  actor: z.nullable(uuid),
  action: z.string(),
  entity: z.string(),
  entity_id: nullableString,
  payload: z.record(z.string(), z.unknown()),
  created_at: z.string(),
});

export type Mess = z.infer<typeof MessSchema>;
export type Period = z.infer<typeof PeriodSchema>;
export type Member = z.infer<typeof MemberSchema>;
export type Meal = z.infer<typeof MealSchema>;
export type Expense = z.infer<typeof ExpenseSchema>;
export type ExpenseItem = z.infer<typeof ExpenseItemSchema>;
export type BillKind = z.infer<typeof BillKindSchema>;
export type Bill = z.infer<typeof BillSchema>;
export type Payment = z.infer<typeof PaymentSchema>;
export type Bundle = z.infer<typeof BundleSchema>;
export type Activity = z.infer<typeof ActivitySchema>;
