// Client-side helper for consuming the SSE stream from /api/s/ai-followup.
//
// Usage:
//   const cancel = streamFollowup(body, {
//     onToken: (chunk) => setQuestion((q) => q + chunk),
//     onMeta: ({ turnId }) => setTurnId(turnId),
//     onDone: ({ fullText }) => setQuestion(fullText),
//     onError: (msg) => fallbackAdvance(),
//   });
//   // cancel() to abort the stream

export interface StreamFollowupBody {
  participantToken: string;
  blockId: number;
  parentResponseId: number;
  turnNumber: number;
}

export interface StreamFollowupHandlers {
  onToken: (chunk: string) => void;
  onMeta: (meta: { turnId: number }) => void;
  onDone: (final: { fullText: string }) => void;
  onError: (message: string) => void;
}

/** Returns a cancel function. */
export function streamFollowup(
  body: StreamFollowupBody,
  handlers: StreamFollowupHandlers,
  signal?: AbortSignal
): () => void {
  const controller = new AbortController();
  const composed = signal
    ? composeSignals([signal, controller.signal])
    : controller.signal;

  (async () => {
    try {
      const res = await fetch('/api/s/ai-followup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: composed,
      });
      if (!res.ok || !res.body) {
        const t = await res.text().catch(() => '');
        handlers.onError(t || `HTTP ${res.status}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by \n\n
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const rawEvent = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          let eventName = 'message';
          let data = '';
          for (const line of rawEvent.split('\n')) {
            if (line.startsWith('event: ')) eventName = line.slice(7);
            else if (line.startsWith('data: ')) data = line.slice(6);
          }

          switch (eventName) {
            case 'token':
              handlers.onToken(data);
              break;
            case 'meta':
              try {
                handlers.onMeta(JSON.parse(data));
              } catch {
                // ignore parse errors
              }
              break;
            case 'done':
              try {
                handlers.onDone(JSON.parse(data));
              } catch {
                handlers.onDone({ fullText: '' });
              }
              return;
            case 'error':
              try {
                const parsed = JSON.parse(data) as { message?: string };
                handlers.onError(parsed.message ?? 'AI follow-up failed');
              } catch {
                handlers.onError('AI follow-up failed');
              }
              return;
          }
        }
      }
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return;
      handlers.onError(
        e instanceof Error ? e.message : 'Network error'
      );
    }
  })();

  return () => controller.abort();
}

/** Submit the participant's answer (or skip) to a generated follow-up turn. */
export async function submitFollowupAnswer(params: {
  participantToken: string;
  turnId: number;
  action: 'answer' | 'skip';
  answer?: string;
}): Promise<{ ok: boolean }> {
  try {
    const res = await fetch('/api/s/ai-followup/answer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) return { ok: false };
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function composeSignals(signals: AbortSignal[]): AbortSignal {
  // Modern browsers expose AbortSignal.any; fall back to manual composition.
  const anyFn = (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any;
  if (typeof anyFn === 'function') {
    return anyFn(signals);
  }
  const ctrl = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      ctrl.abort(s.reason);
      break;
    }
    s.addEventListener('abort', () => ctrl.abort(s.reason), { once: true });
  }
  return ctrl.signal;
}
