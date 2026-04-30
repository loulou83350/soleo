'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { updateSessionGateAction } from '@/app/(dashboard)/dashboard/projects/[id]/sessions/actions';
import type { GateConfig } from '@/lib/repositories/sessions';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GatePanelProps {
  sessionId: number;
  /** Current gate values (from session row) */
  initial: {
    passwordEnabled: boolean;
    deviceRestriction: 'any' | 'desktop' | 'mobile';
    gdprEnabled: boolean;
    gdprMessage: string;
  };
  onClose: () => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ─── Component ────────────────────────────────────────────────────────────────

export function GatePanel({ sessionId, initial, onClose }: GatePanelProps) {
  const [passwordEnabled, setPasswordEnabled] = useState(initial.passwordEnabled);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [deviceRestriction, setDeviceRestriction] = useState<'any' | 'desktop' | 'mobile'>(
    initial.deviceRestriction
  );
  const [gdprEnabled, setGdprEnabled] = useState(initial.gdprEnabled);
  const [gdprMessage, setGdprMessage] = useState(initial.gdprMessage);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);

  const save = useCallback(async () => {
    setSaveStatus('saving');
    const config: GateConfig = {
      password: passwordEnabled && password ? password : null,
      deviceRestriction,
      gdprEnabled,
      gdprMessage: gdprEnabled && gdprMessage ? gdprMessage : null,
    };
    const result = await updateSessionGateAction(sessionId, config);
    setSaveStatus(result.success ? 'saved' : 'error');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, [sessionId, passwordEnabled, password, deviceRestriction, gdprEnabled, gdprMessage]);

  // Debounced auto-save
  useEffect(() => {
    if (!isDirtyRef.current) {
      isDirtyRef.current = true;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      save();
    }, 1000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [passwordEnabled, password, deviceRestriction, gdprEnabled, gdprMessage, save]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Paramètres de la session</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${saveStatus === 'saving' ? 'text-muted-foreground' : saveStatus === 'saved' ? 'text-green-600' : saveStatus === 'error' ? 'text-destructive' : 'text-transparent'}`}>
            {saveStatus === 'saving' ? 'Sauvegarde…' : saveStatus === 'saved' ? 'Sauvegardé' : saveStatus === 'error' ? 'Erreur' : '—'}
          </span>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 px-2 text-xs">
            Fermer
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">

        {/* ── Password gate ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Mot de passe</p>
              <p className="text-xs text-muted-foreground">Protéger l'accès par un mot de passe</p>
            </div>
            <Switch
              checked={passwordEnabled}
              onCheckedChange={setPasswordEnabled}
              aria-label="Activer le mot de passe"
            />
          </div>

          {passwordEnabled && (
            <div className="space-y-1.5">
              <Label className="text-xs">Mot de passe</Label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Entrez un mot de passe…"
                  className="w-full px-3 py-2 pr-9 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Masquer' : 'Afficher'}
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Le mot de passe sera haché avant d'être stocké. Laissez vide pour conserver le mot de passe actuel.
              </p>
            </div>
          )}
        </section>

        <div className="border-t border-border" />

        {/* ── Device restriction ── */}
        <section className="space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">Appareil autorisé</p>
            <p className="text-xs text-muted-foreground">Bloquer l'accès selon le type d'appareil</p>
          </div>
          <div className="space-y-1.5">
            {(['any', 'desktop', 'mobile'] as const).map((option) => (
              <label
                key={option}
                className="flex items-center gap-2.5 cursor-pointer"
              >
                <input
                  type="radio"
                  name="deviceRestriction"
                  value={option}
                  checked={deviceRestriction === option}
                  onChange={() => setDeviceRestriction(option)}
                  className="accent-foreground"
                />
                <span className="text-sm text-foreground">
                  {option === 'any' ? 'Tous les appareils' : option === 'desktop' ? 'Ordinateur uniquement' : 'Mobile uniquement'}
                </span>
              </label>
            ))}
          </div>
        </section>

        <div className="border-t border-border" />

        {/* ── GDPR consent ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Consentement RGPD</p>
              <p className="text-xs text-muted-foreground">Demander le consentement avant de démarrer</p>
            </div>
            <Switch
              checked={gdprEnabled}
              onCheckedChange={setGdprEnabled}
              aria-label="Activer le consentement RGPD"
            />
          </div>

          {gdprEnabled && (
            <div className="space-y-1.5">
              <Label className="text-xs">Message de consentement (optionnel)</Label>
              <textarea
                value={gdprMessage}
                onChange={(e) => setGdprMessage(e.target.value)}
                rows={4}
                placeholder="En participant à cette étude, vous acceptez que vos réponses soient utilisées à des fins de recherche…"
                className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
              <p className="text-[11px] text-muted-foreground">
                Laissez vide pour utiliser le message par défaut.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
