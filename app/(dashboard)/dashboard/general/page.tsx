'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, Check, CheckCircle2, AlertCircle, ExternalLink, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { updateAccount, saveFigmaTokenAction } from '@/app/(login)/actions';
import { User } from '@/lib/db/schema';
import useSWR from 'swr';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type ActionState = {
  name?: string;
  error?: string;
  success?: string;
};

type AccountFormProps = {
  state: ActionState;
  nameValue?: string;
  emailValue?: string;
};

function AccountForm({
  state,
  nameValue = '',
  emailValue = ''
}: AccountFormProps) {
  return (
    <>
      <div>
        <Label htmlFor="name" className="mb-2">
          Name
        </Label>
        <Input
          id="name"
          name="name"
          placeholder="Enter your name"
          defaultValue={state.name || nameValue}
          required
        />
      </div>
      <div>
        <Label htmlFor="email" className="mb-2">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="Enter your email"
          defaultValue={emailValue}
          required
        />
      </div>
    </>
  );
}

function AccountFormWithData({ state }: { state: ActionState }) {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  return (
    <AccountForm
      state={state}
      nameValue={user?.name ?? ''}
      emailValue={user?.email ?? ''}
    />
  );
}

const figmaFetcher = (url: string) => fetch(url).then((r) => r.json());

function FigmaLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 38 57" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 28.5C19 24.91 21.91 22 25.5 22C29.09 22 32 24.91 32 28.5C32 32.09 29.09 35 25.5 35C21.91 35 19 32.09 19 28.5Z" fill="#1ABCFE"/>
      <path d="M6 42.5C6 38.91 8.91 36 12.5 36H19V43H12.5C8.91 43 6 40.09 6 36.5V42.5Z" fill="#0ACF83"/>
      <path d="M19 1V15H25.5C29.09 15 32 12.09 32 8.5C32 4.91 29.09 2 25.5 2L19 1Z" fill="#FF7262"/>
      <path d="M6 8.5C6 12.09 8.91 15 12.5 15H19V2H12.5C8.91 2 6 4.91 6 8.5Z" fill="#F24E1E"/>
      <path d="M6 22C6 25.59 8.91 28.5 12.5 28.5H19V15H12.5C8.91 15 6 18.41 6 22Z" fill="#FF7262"/>
    </svg>
  );
}

function FigmaIntegrationCard() {
  const searchParams = useSearchParams();
  const oauthResult = searchParams.get('figma');

  const { data, isLoading, mutate } = useSWR<{ connected: boolean; expiresAt?: string }>(
    '/api/figma/status',
    figmaFetcher
  );

  const [disconnecting, setDisconnecting] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [manualState, manualFormAction, manualPending] = useActionState<
    { error?: string; success?: string },
    FormData
  >(saveFigmaTokenAction, {});

  async function handleDisconnect() {
    setDisconnecting(true);
    await fetch('/api/figma/status', { method: 'DELETE' });
    await mutate({ connected: false });
    setDisconnecting(false);
  }

  const connected = data?.connected ?? false;

  const expiresAt = data?.expiresAt
    ? new Date(data.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FigmaLogo />
          <CardTitle>Figma</CardTitle>
          {!isLoading && connected && (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              <CheckCircle2 className="h-3 w-3" />
              Connecté
            </span>
          )}
        </div>
        <CardDescription>
          Connectez votre compte Figma pour sélectionner visuellement les écrans de vos prototypes. La connexion est partagée avec toute votre équipe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* OAuth result banner */}
        {oauthResult === 'connected' && (
          <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            <Check className="h-4 w-4 shrink-0" />
            Figma connecté avec succès !
          </div>
        )}
        {(oauthResult === 'error' || oauthResult === 'token_error' || oauthResult === 'invalid_state') && (
          <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            La connexion a échoué. Réessayez ou vérifiez votre configuration.
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Vérification…
          </div>
        ) : connected ? (
          /* ── Connected via OAuth ── */
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <p className="font-medium text-foreground">Compte Figma connecté via OAuth</p>
              {expiresAt && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Token valide jusqu&apos;au {expiresAt}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="/api/figma/connect">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Reconnecter
                </a>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Déconnecter'}
              </Button>
            </div>
          </div>
        ) : (
          /* ── Not connected ── */
          <div className="space-y-4">
            {/* Primary: OAuth */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Autorisez Soleo à lire vos fichiers Figma en un clic. Aucun token à copier — Figma gère l&apos;authentification.
              </p>
              <Button asChild size="sm" className="bg-[#1ABCFE] hover:bg-[#0aabee] text-white">
                <a href="/api/figma/connect">
                  <FigmaLogo />
                  <span className="ml-2">Connecter avec Figma</span>
                </a>
              </Button>
            </div>

            {/* Separator */}
            <div className="flex items-center gap-2">
              <div className="flex-1 border-t" />
              <span className="text-xs text-muted-foreground">ou</span>
              <div className="flex-1 border-t" />
            </div>

            {/* Secondary: personal access token */}
            <div>
              <button
                type="button"
                onClick={() => setShowManual((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showManual ? 'rotate-180' : ''}`} />
                Utiliser un Personal Access Token
              </button>

              {showManual && (
                <form className="mt-3 space-y-3" action={manualFormAction}>
                  <div>
                    <Label htmlFor="figmaToken" className="text-xs">Token Figma</Label>
                    <div className="relative mt-1">
                      <Input
                        id="figmaToken"
                        name="figmaToken"
                        type={showToken ? 'text' : 'password'}
                        placeholder="figd_xxxxxxxxxxxxxxxxxxxx"
                        className="pr-10 font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showToken ? 'Masquer' : 'Afficher'}
                      >
                        {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Créez votre token sur{' '}
                      <a
                        href="https://www.figma.com/settings"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-foreground"
                      >
                        figma.com → Settings → Personal access tokens
                      </a>
                    </p>
                  </div>
                  {manualState.error && (
                    <p className="text-xs text-destructive">{manualState.error}</p>
                  )}
                  {manualState.success && (
                    <p className="flex items-center gap-1 text-xs text-green-600">
                      <Check className="h-3 w-3" />
                      {manualState.success}
                    </p>
                  )}
                  <Button type="submit" size="sm" variant="outline" disabled={manualPending}>
                    {manualPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
                  </Button>
                </form>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function GeneralPage() {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    updateAccount,
    {}
  );

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
        General Settings
      </h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" action={formAction}>
              <Suspense fallback={<AccountForm state={state} />}>
                <AccountFormWithData state={state} />
              </Suspense>
              {state.error && (
                <p className="text-red-500 text-sm">{state.error}</p>
              )}
              {state.success && (
                <p className="text-green-500 text-sm">{state.success}</p>
              )}
              <Button
                type="submit"
                className="bg-orange-500 hover:bg-orange-600 text-white"
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Figma integration */}
        <FigmaIntegrationCard />
      </div>
    </section>
  );
}
