import { Resend } from 'resend';

// Lazy factory — avoids crash when RESEND_API_KEY is not set
function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not configured');
  return new Resend(key);
}

export async function sendInvitationEmail({
  to,
  teamName,
  role,
  inviteId,
}: {
  to: string;
  teamName: string;
  role: string;
  inviteId: number;
}): Promise<void> {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const signUpUrl = `${baseUrl}/sign-up?inviteId=${inviteId}`;
  const roleFr = role === 'owner' ? 'Admin' : 'Membre';

  await getResend().emails.send({
    from: 'Soleo <onboarding@resend.dev>',
    to,
    subject: `Invitation à rejoindre ${teamName} sur Soleo`,
    html: `
      <!DOCTYPE html>
      <html lang="fr">
      <body style="font-family:system-ui,sans-serif;background:#fafafa;padding:40px 20px;color:#0a0a0a">
        <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:40px">
          <h1 style="font-size:20px;font-weight:600;margin:0 0 8px">Invitation à rejoindre ${teamName}</h1>
          <p style="color:#666;margin:0 0 24px">
            Vous avez été invité(e) à rejoindre l'espace <strong>${teamName}</strong> sur Soleo en tant que <strong>${roleFr}</strong>.
          </p>
          <a href="${signUpUrl}"
             style="display:inline-block;background:#0a0a0a;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">
            Accepter l'invitation
          </a>
          <p style="margin-top:24px;color:#999;font-size:12px">
            Si vous avez déjà un compte, créez-en un nouveau avec cet email — vous serez automatiquement ajouté(e) à l'espace.
          </p>
          <p style="color:#999;font-size:12px">
            Ce lien n'expire pas. Si vous ne souhaitez pas rejoindre cet espace, ignorez cet email.
          </p>
        </div>
      </body>
      </html>
    `,
  });
}
