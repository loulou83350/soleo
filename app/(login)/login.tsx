'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { signIn, signUp } from './actions';
import { ActionState } from '@/lib/auth/middleware';

export function Login({ mode = 'signin' }: { mode?: 'signin' | 'signup' }) {
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');
  const priceId = searchParams.get('priceId');
  const inviteId = searchParams.get('inviteId');
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    mode === 'signin' ? signIn : signUp,
    { error: '' }
  );

  return (
    <div className="min-h-[100dvh] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Branding Soleo */}
        <div className="flex justify-center">
          <span className="text-2xl font-semibold tracking-tight text-foreground">
            Soleo
          </span>
        </div>
        <h2 className="mt-6 text-center text-2xl font-semibold text-foreground">
          {mode === 'signin' ? 'Connexion' : 'Créer un compte'}
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {mode === 'signin'
            ? 'Accédez à votre espace de recherche'
            : 'Commencez à créer vos sessions de recherche'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface border border-border rounded-xl px-8 py-10 shadow-sm">
          <form className="space-y-5" action={formAction}>
            <input type="hidden" name="redirect" value={redirect || ''} />
            <input type="hidden" name="priceId" value={priceId || ''} />
            <input type="hidden" name="inviteId" value={inviteId || ''} />

            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-sm font-medium text-foreground"
              >
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={state.email}
                required
                maxLength={50}
                className="w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-foreground"
                placeholder="vous@exemple.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-sm font-medium text-foreground"
              >
                Mot de passe
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={
                  mode === 'signin' ? 'current-password' : 'new-password'
                }
                defaultValue={state.password}
                required
                minLength={8}
                maxLength={100}
                className="w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-foreground"
                placeholder={
                  mode === 'signin'
                    ? 'Votre mot de passe'
                    : 'Minimum 8 caractères'
                }
              />
            </div>

            {state?.error && (
              <div
                role="alert"
                className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2"
              >
                {state.error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
              disabled={pending}
            >
              {pending ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  Chargement…
                </>
              ) : mode === 'signin' ? (
                'Se connecter'
              ) : (
                "Créer mon compte"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {mode === 'signin'
                ? 'Pas encore de compte ?'
                : 'Déjà un compte ?'}{' '}
              <Link
                href={`${mode === 'signin' ? '/sign-up' : '/sign-in'}${
                  redirect ? `?redirect=${redirect}` : ''
                }${priceId ? `&priceId=${priceId}` : ''}`}
                className="font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
              >
                {mode === 'signin' ? 'Créer un compte' : 'Se connecter'}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
