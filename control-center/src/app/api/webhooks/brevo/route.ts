import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction, recordAuditLog } from '@/lib/db';

export const dynamic = 'force-dynamic';

const VALID_BREVO_EVENTS = new Set([
  'request',
  'delivered',
  'hard_bounce',
  'hardbounce',
  'soft_bounce',
  'softbounce',
  'blocked',
  'spam',
  'complaint',
  'unsubscribe',
  'unsubscribed',
  'click',
  'opened',
  'deferred',
  'error',
]);

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

  // 1. Authenticate webhook request
  const configuredSecret = process.env.BREVO_WEBHOOK_SECRET || 'FirstClient_Brevo_Sec_2026_z78w';
  const urlToken = request.nextUrl.searchParams.get('token');
  const headerToken =
    request.headers.get('x-brevo-webhook-secret') ||
    request.headers.get('x-webhook-token') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  const providedSecret = urlToken || headerToken;

  if (!providedSecret || providedSecret !== configuredSecret) {
    console.warn(`[webhooks/brevo] Rejected unauthorized webhook attempt from IP ${ip}`);
    await recordAuditLog({
      actor_type: 'webhook_caller',
      actor_reference: ip,
      action: 'brevo_webhook_rejected',
      entity_type: 'security_event',
      entity_id: 'brevo_webhook',
      before_state: null,
      after_state: { reason: 'Unauthorized: invalid or missing secret token', ip },
      result: 'unauthorized',
      ip_address: ip,
    }).catch((e) => console.error('[audit:error]', e));

    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing webhook token' },
      { status: 401 }
    );
  }

  try {
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== 'object') {
      await recordAuditLog({
        actor_type: 'webhook_caller',
        actor_reference: ip,
        action: 'brevo_webhook_rejected',
        entity_type: 'security_event',
        entity_id: 'brevo_webhook',
        after_state: { reason: 'Invalid JSON payload' },
        result: 'invalid_json',
        ip_address: ip,
      }).catch(console.error);

      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const eventType = (payload.event || payload.event_type || 'unknown').toLowerCase();
    const email = (payload.email || payload['recipient-email'] || '').trim().toLowerCase();
    const messageId = payload['message-id'] || payload.messageId || null;
    const eventId = payload.id ? String(payload.id) : null;

    if (!email || !email.includes('@')) {
      await recordAuditLog({
        actor_type: 'webhook_caller',
        actor_reference: ip,
        action: 'brevo_webhook_rejected',
        entity_type: 'security_event',
        entity_id: 'brevo_webhook',
        after_state: { reason: 'Missing or malformed recipient email', payload },
        result: 'invalid_email',
        ip_address: ip,
      }).catch(console.error);

      return NextResponse.json({ error: 'Valid recipient email required' }, { status: 400 });
    }

    if (!VALID_BREVO_EVENTS.has(eventType)) {
      await recordAuditLog({
        actor_type: 'webhook_caller',
        actor_reference: ip,
        action: 'brevo_webhook_rejected',
        entity_type: 'security_event',
        entity_id: 'brevo_webhook',
        after_state: { reason: `Unrecognized event type: ${eventType}`, payload },
        result: 'unknown_event_type',
        ip_address: ip,
      }).catch(console.error);

      return NextResponse.json({ error: `Unrecognized event type: ${eventType}` }, { status: 400 });
    }

    await withTransaction(async (client) => {
      // 1. Look up contact and campaign if possible
      const contactRes = await client.query<{ id: string }>(
        'SELECT id FROM contacts WHERE email_normalized = $1 LIMIT 1;',
        [email]
      );
      const contactId = contactRes.rows[0]?.id || null;

      // 2. Insert into delivery_events
      await client.query(
        `INSERT INTO delivery_events (
          contact_id,
          email_normalized,
          event_type,
          provider,
          provider_event_id,
          provider_message_id,
          event_at,
          event_data,
          created_at
        ) VALUES ($1, $2, $3, 'brevo', $4, $5, now(), $6::jsonb, now());`,
        [contactId, email, eventType, eventId, messageId, JSON.stringify(payload)]
      );

      // 3. Update contact_email_status based on verified event
      if (['hard_bounce', 'hardbounce', 'error', 'blocked'].includes(eventType)) {
        await client.query(
          `UPDATE contact_email_status
           SET bounce_status = 'hard',
               eligibility_status = 'blocked',
               suppression_status = 'suppressed',
               eligibility_reason = 'Permanent hard bounce recorded from verified Brevo webhook',
               last_evaluated_at = now()
           WHERE email_normalized = $1;`,
          [email]
        );
      } else if (['soft_bounce', 'softbounce'].includes(eventType)) {
        await client.query(
          `UPDATE contact_email_status
           SET bounce_status = 'soft',
               last_evaluated_at = now()
           WHERE email_normalized = $1;`,
          [email]
        );
      } else if (['spam', 'complaint'].includes(eventType)) {
        await client.query(
          `UPDATE contact_email_status
           SET complaint_status = 'complaint',
               eligibility_status = 'blocked',
               suppression_status = 'suppressed',
               eligibility_reason = 'Spam complaint recorded from verified Brevo webhook',
               last_evaluated_at = now()
           WHERE email_normalized = $1;`,
          [email]
        );
      } else if (['unsubscribe', 'unsubscribed'].includes(eventType)) {
        await client.query(
          `UPDATE contact_email_status
           SET unsubscribe_status = 'unsubscribed',
               eligibility_status = 'blocked',
               suppression_status = 'suppressed',
               eligibility_reason = 'Opt-out/Unsubscribe recorded from verified Brevo webhook',
               last_evaluated_at = now()
           WHERE email_normalized = $1;`,
          [email]
        );
      }
    });

    await recordAuditLog({
      actor_type: 'provider_webhook',
      actor_reference: 'brevo',
      action: `brevo_${eventType}`,
      entity_type: 'contact',
      entity_id: email,
      after_state: { eventType, messageId, email },
      result: 'success',
      ip_address: ip,
    }).catch(console.error);

    return NextResponse.json({
      received: true,
      event: eventType,
      email,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[api/webhooks/brevo:error]', error);
    return NextResponse.json({ error: 'Failed to ingest Brevo webhook' }, { status: 500 });
  }
}
