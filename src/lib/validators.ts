import { z } from 'zod'

// Common weak passwords that should be rejected
const COMMON_PASSWORDS = [
    'password', '123456', '12345678', 'qwerty', 'abc123',
    '111111', '000000', '123123', 'iloveyou', 'admin',
]

// Password rules: min 8 chars, must have letters + digits, can't be common
export const passwordSchema = z
    .string()
    .min(8, 'رمز عبور باید حداقل ۸ کاراکتر باشد')
    .regex(/[a-zA-Z]/, 'رمز عبور باید شامل حرف و عدد باشد')
    .regex(/[0-9]/, 'رمز عبور باید شامل حرف و عدد باشد')
    .refine(
        (pwd) => !COMMON_PASSWORDS.includes(pwd.toLowerCase()),
        { message: 'رمز عبور بسیار رایج است' }
    )

// Signup form validation
export const signupSchema = z.object({
    name: z.string().trim().min(1, 'نام را وارد کنید'),
    email: z.string().trim().email('ایمیل معتبر وارد کنید'), // Removed .toLowerCase()
    password: passwordSchema,
    householdName: z.string().trim().optional(),
    inviteCode: z.string().trim().optional(), // Removed .toUpperCase()
}
)
// Login form validation (just needs a valid email format and a non-empty password)
export const loginSchema = z.object({
    email: z.string().trim().email('ایمیل معتبر وارد کنید'),
    password: z.string().min(1, 'ایمیل و رمز عبور را وارد کنید'),
})