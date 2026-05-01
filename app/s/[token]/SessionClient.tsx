'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ParticipantBlock } from './ParticipantBlock';
import {
  startSessionAction,
  resumeSessionAction,
  saveBlockResponseAction,
  completeSessionAction,
  checkPasswordAction,
  recordConsentAction,
} from './actions';
import type { SessionWithBlocks, SessionBlock } from '@/lib/db/schema';
import { ANCHOR_BLOCK_TYPES } from '@/lib/domain/blocks';
import type { BlockType } from '@/lib/db/schema';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'soleo_participant_token';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isAnchor(block: SessionBlock): boolean {
  return ANCHOR_BLOCK_TYPES.includes(block.blockType as BlockType);
}

function isNonAnchor(block: SessionBlock): boolean {
  return !isAnchor(block);
}

function isValueEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Client-side device check — returns true if the device matches the restriction */
function passesDeviceCheck(restriction: string): boolean {
  if (restriction === 'any') return true;
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  return restriction === 'mobile' ? isMobile : !isMobile;
}

// ─── Gate config ──────────────────────────────────────────────────────────────

export interface GateConfig {
  passwordRequired: boolean;
  deviceRestriction: string;
  gdprEnabled: boolean;
  gdprMessage?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

type GatePhase =
  | 'loading'
  | 'device-blocked'
  | 'password'
  | 'consent'
  | 'running'
  | 'error';

interface SessionClientProps {
  sessionToken: string;
  session: SessionWithBlocks;
  gateConfig: GateConfig;
}

export function SessionClient({ sessionToken, session, gateConfig }: SessionClientProps) {
  const blocks = session.blocks; // sorted by position

  const [gatePhase, setGatePhase] = useState<GatePhase>('loading');
  const [participantToken, setParticipantToken] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [responses, setResponses] = useState<Map<number, unknown>>(new Map());
  const [requiredError, setRequiredError] = useState(false);
  const [savingNext, setSavingNext] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  // Gate-specific state
  const [passwordValue, setPasswordValue] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordChecking, setPasswordChecking] = useState(false);
  const [consentDeclined, setConsentDeclined] = useState(false);

  const initRef = useRef(false);

  // ─── Init: device check → start/resume session → gate phases ──────────────

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    // Device check (synchronous, client-side)
    if (!passesDeviceCheck(gateConfig.deviceRestriction)) {
      setGatePhase('device-blocked');
      return;
    }

    // If password required, show password screen before creating session
    if (gateConfig.passwordRequired) {
      setGatePhase('password');
      return;
    }

    // Otherwise, start/resume session immediately
    startOrResume();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startOrResume() {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);

      if (stored) {
        const result = await resumeSessionAction(sessionToken, stored);
        if (result.success) {
          setParticipantToken(stored);
          // Still need to show consent if not yet given (check via GDPR flag + no consent stored)
          advanceFromSession(stored);
          return;
        }
        sessionStorage.removeItem(STORAGE_KEY);
      }

      const result = await startSessionAction(sessionToken);
      if (!result.success) {
        setErrorMsg(result.error ?? 'Impossible de démarrer la session');
        setGatePhase('error');
        return;
      }

      const token = result.data.participantToken;
      sessionStorage.setItem(STORAGE_KEY, token);
      setParticipantToken(token);
      advanceFromSession(token);
    } catch {
      setErrorMsg('Une erreur est survenue. Veuillez réessayer.');
      setGatePhase('error');
    }
  }

  function advanceFromSession(token: string) {
    void token; // token is stored, used in later actions
    if (gateConfig.gdprEnabled) {
      setGatePhase('consent');
    } else {
      setGatePhase('running');
    }
  }

  // ─── Password gate handler ─────────────────────────────────────────────────

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordValue.trim()) return;

    setPasswordChecking(true);
    setPasswordError(null);

    const result = await checkPasswordAction(sessionToken, passwordValue);

    setPasswordChecking(false);

    if (!result.success) {
      setPasswordError(result.error ?? 'Mot de passe incorrect');
      return;
    }

    // Password OK → start/resume session
    await startOrResume();
  }

  // ─── Consent gate handler ──────────────────────────────────────────────────

  async function handleConsentAccept() {
    if (!participantToken) return;
    // Best-effort: record consent; if it fails, we still let them proceed
    await recordConsentAction(participantToken, null).catch(() => {});
    setGatePhase('running');
  }

  function handleConsentDecline() {
    setConsentDeclined(true);
  }

  // ─── Auto-complete when thank_you block is reached ────────────────────────

  const currentBlock = blocks[stepIdx];
  const isThankYou = currentBlock?.blockType === 'thank_you';

  useEffect(() => {
    if (!isThankYou || !participantToken || completed) return;

    completeSessionAction(participantToken)
      .then(() => setCompleted(true))
      .catch(() => setCompleted(true));
  }, [isThankYou, participantToken, completed]);

  // ─── Progress calculation ─────────────────────────────────────────────────

  const nonAnchorBlocks = blocks.filter(isNonAnchor);
  const totalQuestions = nonAnchorBlocks.length;
  const currentQuestion =
    currentBlock && !isAnchor(currentBlock)
      ? nonAnchorBlocks.findIndex((b) => b.id === currentBlock.id) + 1
      : null;

  // ─── Navigation ───────────────────────────────────────────────────────────

  const isFirstBlock = stepIdx === 0;
  const isWelcome = currentBlock?.blockType === 'welcome';

  async function handleNext() {
    if (!participantToken || !currentBlock) return;

    const value = responses.get(currentBlock.id) ?? null;

    if (!isAnchor(currentBlock) && currentBlock.required && isValueEmpty(value)) {
      setRequiredError(true);
      return;
    }

    setRequiredError(false);
    setSavingNext(true);

    try {
      if (!isWelcome) {
        await saveBlockResponseAction(participantToken, currentBlock.id, value);
      }
      setStepIdx((prev) => prev + 1);
    } catch {
      setStepIdx((prev) => prev + 1);
    } finally {
      setSavingNext(false);
    }
  }

  function handleBack() {
    if (isFirstBlock) return;
    setRequiredError(false);
    setStepIdx((prev) => prev - 1);
  }

  function handleResponse(blockId: number, value: unknown) {
    setResponses((prev) => new Map(prev).set(blockId, value));
    if (requiredError && !isValueEmpty(value)) {
      setRequiredError(false);
    }
  }

  // ─── Gate render states ────────────────────────────────────────────────────

  if (gatePhase === 'loading') {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (gatePhase === 'device-blocked') {
    const isDesktopOnly = gateConfig.deviceRestriction === 'desktop';
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-4">
          <p className="text-3xl">{isDesktopOnly ? '🖥️' : '📱'}</p>
          <p className="text-lg font-semibold text-foreground">
            {isDesktopOnly ? 'Cette étude nécessite un ordinateur' : 'Cette étude nécessite un appareil mobile'}
          </p>
          <p className="text-sm text-muted-foreground">
            {isDesktopOnly
              ? 'Veuillez ouvrir ce lien sur votre ordinateur pour participer.'
              : 'Veuillez ouvrir ce lien sur votre téléphone pour participer.'}
          </p>
        </div>
      </div>
    );
  }

  if (gatePhase === 'password') {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center p-6">
        <div className="max-w-sm w-full space-y-6">
          <div className="text-center space-y-2">
            <p className="text-2xl font-bold text-foreground">🔒 Accès protégé</p>
            <p className="text-sm text-muted-foreground">
              Entrez le mot de passe pour accéder à cette étude.
            </p>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <input
              type="password"
              value={passwordValue}
              onChange={(e) => setPasswordValue(e.target.value)}
              placeholder="Mot de passe"
              autoFocus
              className="w-full px-4 py-2.5 border border-input rounded-lg text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {passwordError && (
              <p className="text-sm text-destructive" role="alert">{passwordError}</p>
            )}
            <Button type="submit" className="w-full" disabled={passwordChecking}>
              {passwordChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Accéder'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (gatePhase === 'consent') {
    if (consentDeclined) {
      return (
        <div className="min-h-dvh bg-background flex items-center justify-center p-6">
          <div className="max-w-sm text-center space-y-3">
            <p className="text-lg font-semibold text-foreground">Participation refusée</p>
            <p className="text-sm text-muted-foreground">
              Vous avez choisi de ne pas participer. Aucune donnée n'a été enregistrée.
            </p>
          </div>
        </div>
      );
    }

    const defaultMessage =
      'En participant à cette étude, vous acceptez que vos réponses soient utilisées à des fins de recherche. Vous pouvez vous arrêter à tout moment. Vos données sont traitées de manière confidentielle.';

    return (
      <div className="min-h-dvh bg-background flex items-center justify-center p-6">
        <div className="max-w-lg w-full space-y-6">
          <div className="space-y-2">
            <p className="text-2xl font-bold text-foreground">Consentement à la participation</p>
          </div>
          <div className="bg-muted/40 border border-border rounded-lg p-4">
            <p className="text-sm text-foreground leading-relaxed">
              {gateConfig.gdprMessage || defaultMessage}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <Button onClick={handleConsentAccept} className="flex-1">
              J'accepte et je participe
            </Button>
            <Button variant="ghost" onClick={handleConsentDecline} className="flex-1">
              Je refuse
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            En cliquant sur "J'accepte", votre consentement sera enregistré avec la date et l'heure.
          </p>
        </div>
      </div>
    );
  }

  if (gatePhase === 'error') {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <p className="text-lg font-medium text-foreground">Ce lien n'est plus actif</p>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
        </div>
      </div>
    );
  }

  // ─── Running phase ────────────────────────────────────────────────────────

  if (!currentBlock) return null;

  const showProgress = currentQuestion !== null && totalQuestions > 0;
  const showBackButton = !isFirstBlock && !isThankYou;
  const showNextButton = !isThankYou;

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Progress header */}
      {showProgress && (
        <header className="w-full px-6 py-4 flex items-center justify-between border-b border-border/50">
          <div className="w-8" />
          <span className="text-sm text-muted-foreground font-medium">
            Question {currentQuestion} de {totalQuestions}
          </span>
          <div className="w-8" />
        </header>
      )}

      {/* Block content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-10 w-full">
        <div className="w-full max-w-2xl">
          <ParticipantBlock
            block={currentBlock}
            value={responses.get(currentBlock.id) ?? null}
            onChange={(value) => handleResponse(currentBlock.id, value)}
            onNext={savingNext ? undefined : handleNext}
            requiredError={requiredError}
          />
        </div>
      </main>

      {/* Navigation */}
      {showNextButton && (
        <footer className="w-full px-6 py-4 flex items-center justify-between border-t border-border/50">
          <div>
            {showBackButton && (
              <Button variant="ghost" onClick={handleBack} disabled={savingNext} className="gap-1">
                <ChevronLeft className="h-4 w-4" />
                Retour
              </Button>
            )}
          </div>

          {!isWelcome && (
            <Button onClick={handleNext} disabled={savingNext} className="gap-1 min-w-24">
              {savingNext ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </footer>
      )}
    </div>
  );
}
