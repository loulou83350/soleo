// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn().mockResolvedValue({ data: { id: 'email-123' }, error: null });

// Mock resend module — Resend must be a class (constructor)
vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: mockSend };
  },
}));

describe('sendInvitationEmail', () => {
  beforeEach(() => {
    mockSend.mockClear();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('throws when RESEND_API_KEY is not set', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const { sendInvitationEmail } = await import('./resend');
    await expect(
      sendInvitationEmail({ to: 'a@b.com', teamName: 'Test', role: 'member', inviteId: 1 })
    ).rejects.toThrow('RESEND_API_KEY not configured');
  });

  it('calls resend.emails.send with correct params', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('BASE_URL', 'https://app.soleo.fr');

    const { sendInvitationEmail } = await import('./resend');

    await sendInvitationEmail({
      to: 'invite@example.com',
      teamName: 'ACME Corp',
      role: 'member',
      inviteId: 42,
    });

    expect(mockSend).toHaveBeenCalledOnce();
    const call = mockSend.mock.calls[0][0];
    expect(call.to).toBe('invite@example.com');
    expect(call.subject).toContain('ACME Corp');
    expect(call.html).toContain('https://app.soleo.fr/sign-up?inviteId=42');
    expect(call.html).toContain('Membre');
  });

  it('uses "Admin" label for owner role', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('BASE_URL', 'https://app.soleo.fr');

    const { sendInvitationEmail } = await import('./resend');

    await sendInvitationEmail({
      to: 'admin@example.com',
      teamName: 'ACME Corp',
      role: 'owner',
      inviteId: 7,
    });

    const call = mockSend.mock.calls[0][0];
    expect(call.html).toContain('Admin');
  });

  it('falls back to localhost:3000 when BASE_URL is not set', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('BASE_URL', ''); // empty string → || fallback kicks in

    const { sendInvitationEmail } = await import('./resend');

    await sendInvitationEmail({
      to: 'test@example.com',
      teamName: 'Team',
      role: 'member',
      inviteId: 1,
    });

    const call = mockSend.mock.calls[0][0];
    expect(call.html).toContain('http://localhost:3000/sign-up?inviteId=1');
  });
});
