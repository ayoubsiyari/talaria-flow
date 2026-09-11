/**
 * zod schemas for every API input. Shared by api/* functions and tests.
 */
import { z } from 'zod';

export const email = z.string().trim().toLowerCase().email().max(254);
export const password = z.string().min(8).max(128);
export const lang = z.enum(['en', 'ar']).default('en');
export const turnstileToken = z.string().max(4096).optional().default('');

/** Free text typed by a member/admin; length-capped, rendered escaped everywhere. */
export const shortText = z.string().trim().max(120);
export const noteText = z.string().trim().max(1000);

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
  turnstileToken,
});

export const signupSchema = z.object({
  email,
  password,
  first_name: shortText.min(1),
  last_name: shortText.min(1),
  country: z.string().trim().regex(/^[A-Z]{2}$/),
  lang,
  redirectTo: z.string().url().optional(),
  turnstileToken,
});

export const resetSchema = z.object({
  email,
  redirectTo: z.string().url().optional(),
  turnstileToken,
});

export const sessionSchema = z.object({
  access_token: z.string().min(20).max(8192),
  expires_at: z.number().int().positive().optional(),
});

export const waitlistSchema = z.object({
  email,
  source: z.enum(['suite', 'home', 'tools', 'website']).default('website'),
  lang,
  turnstileToken,
});

export const PROOF_MAX_FILES = 4;
export const PROOF_MAX_BYTES = 5 * 1024 * 1024;
export const PROOF_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** Finish a proof submission, or retry the receipt email for an already-pending one. */
export const proofFinishSchema = z.union([
  z.object({ resend: z.literal(true) }),
  z.object({
    note: noteText.optional().default(''),
    files: z
      .array(
        z.object({
          path: z.string().regex(/^[0-9a-f-]{36}\/incoming\/[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$/i),
          name: z.string().trim().min(1).max(160),
        }),
      )
      .min(1)
      .max(PROOF_MAX_FILES),
  }),
]);

/** A template spec as stored in emails/templates.json / email_templates.spec (loosely validated). */
export const templateSpecSchema = z
  .object({
    id: z.string().trim().max(64).optional(),
    file: z.string().trim().max(64).optional(),
    name: z.string().max(120).optional(),
    subject: z.string().max(300),
    preheader: z.string().max(300).optional(),
    eyebrow: z.string().max(120).optional(),
    title: z.string().max(300),
    accent: z.string().max(32).optional(),
    unsubscribe: z.boolean().optional(),
    blocks: z.array(z.any()).max(60),
    ar: z.object({}).passthrough().optional(),
  })
  .passthrough();

/** POST /api/admin/emails/test: a saved template by id, or an unsaved spec from the editor. */
export const adminTestEmailSchema = z
  .object({
    id: z.string().trim().regex(/^[0-9a-z-]{1,64}$/i).optional(),
    spec: templateSpecSchema.optional(),
    lang,
    to: email,
  })
  .refine((v) => Boolean(v.id || v.spec), { message: 'id or spec is required', path: ['id'] });

export const uuid = z.string().uuid();

/** POST /api/admin/submission */
export const adminDecisionSchema = z
  .object({
    action: z.enum(['approve', 'reject']),
    // Not `uuid`: the route looks the row up server-side (unknown ids -> 404) and the local mock
    // seeds fixture submissions with ids like `s-<member uuid>`.
    id: z.string().trim().min(1).max(80),
    reason: z.string().trim().max(600).optional(),
  })
  .refine((v) => v.action !== 'reject' || (v.reason && v.reason.length >= 1), { message: 'reason is required when rejecting', path: ['reason'] });

export const campaignAudience = z.enum(['approved', 'submitted', 'rejected', 'none', 'all', 'waitlist']);
export const campaignLang = z.enum(['all', 'en', 'ar']);
export const campaignTemplateId = z
  .string()
  .trim()
  .regex(/^(0?6|0?8|0?9)(-[a-z-]+)?$|^(course-ready|newsletter|tools-suite-launch)$/i);

const campaignFilter = {
  audience: campaignAudience,
  lang: campaignLang.default('all'),
  skipRecent: z.boolean().optional().default(false),
  memberIds: z.array(uuid).max(5000).optional(),
};

/** POST /api/admin/campaigns */
export const adminCampaignSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    templateId: campaignTemplateId,
    subject: z.string().trim().max(200).optional(),
    scheduledFor: z.string().datetime({ offset: true }).optional(),
    note: z.string().trim().max(2000).optional(),
    ...campaignFilter,
  }),
  z.object({ action: z.literal('count'), templateId: campaignTemplateId.optional(), ...campaignFilter }),
  z.object({ action: z.literal('cancel'), id: z.string().trim().min(1).max(64) }),
  z.object({ action: z.literal('run-due') }),
]);

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ProofFinishInput = z.infer<typeof proofFinishSchema>;

/** Magic-byte sniffing so a renamed file cannot pass as an image. */
export function sniffImage(bytes: Uint8Array): (typeof PROOF_MIME)[number] | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'image/webp';
  return null;
}
