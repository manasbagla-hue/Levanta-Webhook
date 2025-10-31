import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'webhook@yourdomain.com',
  to: 'manasbagla@vcommission.com',
  subject: `Levanta: ${event.type}`,
  text: message
});
