'use client'

import { useState, type FormEvent } from 'react'
import { AtSign, KeyRound, User } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useJoinHousehold, useLogin, useSignup } from '@/hooks/use-auth'
import { useUserStore } from '@/lib/store'

function FieldError({ children }: { children: string | null }) {
  if (!children) return null
  return <p className="text-destructive text-xs">{children}</p>
}

function LoginForm() {
  const login = useLogin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!email || !password) { setErr('ایمیل و رمز را وارد کنید'); return }
    login.mutate({ email, password })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="login-email">ایمیل</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          dir="ltr"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="login-password">رمز عبور</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          dir="ltr"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <FieldError>{err}</FieldError>
      <Button type="submit" className="w-full" disabled={login.isPending}>
        {login.isPending ? 'در حال ورود…' : 'ورود'}
      </Button>
    </form>
  )
}

function SignupForm() {
  const signup = useSignup()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // Toggle: 'create' = create new household, 'join' = join with invite code
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [householdName, setHouseholdName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!name || !email || !password) { setErr('همه فیلدها را پر کنید'); return }
    if (password.length < 6) { setErr('رمز حداقل ۶ کاراکتر باشد'); return }
    if (mode === 'create' && !householdName) { setErr('نام خانه را وارد کنید'); return }
    if (mode === 'join' && !inviteCode) { setErr('کد دعوت را وارد کنید'); return }

    signup.mutate(
      mode === 'create'
        ? { name, email, password, householdName }
        : { name, email, password, inviteCode: inviteCode.toUpperCase().trim() },
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="signup-name">نام نمایشی</Label>
        <Input
          id="signup-name"
          type="text"
          autoComplete="name"
          placeholder="نام شما"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-email">ایمیل</Label>
        <Input
          id="signup-email"
          type="email"
          autoComplete="email"
          dir="ltr"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-password">رمز عبور</Label>
        <Input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          dir="ltr"
          placeholder="حداقل ۶ کاراکتر"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <div className="flex rounded-lg bg-muted p-1 text-xs">
        <button
          type="button"
          onClick={() => setMode('create')}
          className={`flex-1 rounded-md py-1.5 transition-colors ${
            mode === 'create' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'
          }`}
        >
          ساخت خانه
        </button>
        <button
          type="button"
          onClick={() => setMode('join')}
          className={`flex-1 rounded-md py-1.5 transition-colors ${
            mode === 'join' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'
          }`}
        >
          پیوستن با کد
        </button>
      </div>

      {mode === 'create' ? (
        <div className="space-y-1.5">
          <Label htmlFor="signup-house">نام خانه</Label>
          <Input
            id="signup-house"
            type="text"
            placeholder="مثلاً خانه دوستی"
            value={householdName}
            onChange={(e) => setHouseholdName(e.target.value)}
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="signup-invite">کد دعوت</Label>
          <Input
            id="signup-invite"
            type="text"
            dir="ltr"
            placeholder="ABC123"
            className="tracking-widest uppercase"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
          />
        </div>
      )}

      <FieldError>{err}</FieldError>
      <Button type="submit" className="w-full" disabled={signup.isPending}>
        {signup.isPending ? 'در حال ساخت حساب…' : 'ساخت حساب'}
      </Button>
    </form>
  )
}

function JoinForm() {
  const join = useJoinHousehold()
  const [inviteCode, setInviteCode] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!inviteCode) { setErr('کد دعوت را وارد کنید'); return }
    join.mutate({ inviteCode: inviteCode.toUpperCase().trim(), name: name || undefined })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-muted-foreground text-xs">
        اگر حساب کاربری دارید و فقط می‌خواهید به خانه‌ی جدیدی بپیوندید، اینجا کد دعوت را وارد کنید.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="join-name">نام نمایشی (اختیاری)</Label>
        <Input
          id="join-name"
          type="text"
          placeholder="نام شما در این خانه"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="join-invite">کد دعوت</Label>
        <Input
          id="join-invite"
          type="text"
          dir="ltr"
          placeholder="ABC123"
          className="tracking-widest uppercase"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
        />
      </div>
      <FieldError>{err}</FieldError>
      <Button type="submit" className="w-full" disabled={join.isPending}>
        {join.isPending ? 'در حال پیوستن…' : 'پیوستن به خانه'}
      </Button>
    </form>
  )
}

/**
 * RTL auth screen with three tabs — login, signup and join. The signup tab
 * itself has an inner toggle for "create a new household" vs "join with an
 * invite code". A fallback "demo mode" button at the bottom lets visitors
 * explore the app without signing up.
 */
export function AuthScreen() {
  const setDemoMode = useUserStore((s) => s.setDemoMode)

  return (
    <div className="app-shell mx-auto items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <header className="space-y-2 text-center">
          <div className="text-4xl" role="img" aria-label="سبد خرید">🛒</div>
          <h1 className="text-2xl font-bold">هم‌خانه‌یاب</h1>
          <p className="text-muted-foreground text-sm">
            مدیریت سبک خریدهای مصرفی خانه بین هم‌خانه‌ها با تراز امتیاز.
          </p>
        </header>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="login">ورود</TabsTrigger>
            <TabsTrigger value="signup">ثبت‌نام</TabsTrigger>
            <TabsTrigger value="join">پیوستن</TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="pt-4">
            <LoginForm />
          </TabsContent>
          <TabsContent value="signup" className="pt-4">
            <SignupForm />
          </TabsContent>
          <TabsContent value="join" className="pt-4">
            <JoinForm />
          </TabsContent>
        </Tabs>

        <div className="space-y-2">
          <div className="text-muted-foreground flex items-center gap-2 text-[11px] before:flex-1 before:border-t before:border-border after:flex-1 after:border-t after:border-border">
            <span>یا</span>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setDemoMode(true)}
          >
            <AtSign className="size-4" />
            کاوش به‌صورت دمو
          </Button>
          <p className="text-muted-foreground flex items-center justify-center gap-1 text-[11px]">
            <KeyRound className="size-3" />
            <User className="size-3" />
            بدون ثبت‌نام، با پروفایل‌های نمونه
          </p>
        </div>
      </div>
    </div>
  )
}
