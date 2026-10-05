import { NextRequest, NextResponse } from 'next/server';
import { resolveServiceUrl } from '@/lib/runtime';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const start = Date.now();
  try {
    const body = await request.json().catch(() => ({}));
    const webhookUrl = body.webhookUrl || process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/first-client/execute';

    // Validate URL syntax
    try {
      new URL(webhookUrl);
    } catch {
      return NextResponse.json(
        {
          success: false,
          status: 400,
          error: 'Invalid Webhook URL format. Expected http:// or https://',
          latencyMs: 0,
        },
        { status: 400 }
      );
    }

    const targetWebhookUrl = resolveServiceUrl(webhookUrl, 'n8n', 5678);
    console.log('[ping-webhook] webhookUrl:', webhookUrl, '-> targetWebhookUrl:', targetWebhookUrl);

    const payload = {
      action: 'execute',
      campaign_id: body.campaignId ? Number(body.campaignId) : 11,
      execution_id: `ping-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      secret: process.env.N8N_EXECUTION_WEBHOOK_SECRET || '',
      event: 'control_center_handshake',
      source: 'control-center-listener',
      timestamp: new Date().toISOString(),
      test_mode: true,
      message: 'Ping handshake from Email Marketing Control Center',
      sample_recipient: body.sampleRecipient || {
        email: 'listener-test@firstclient.internal',
        first_name: 'Test',
        last_name: 'Contact',
        company: 'First Client Test Org',
      },
    };

    const abortCtrl = new AbortController();
    const timeout = setTimeout(() => abortCtrl.abort(), 6000);

    let res: Response;
    try {
      res = await fetch(targetWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Operator-Identity': 'control-center-handshake',
        },
        body: JSON.stringify(payload),
        signal: abortCtrl.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const latencyMs = Date.now() - start;
    const contentType = res.headers.get('content-type') || '';
    let responseData: any = null;
    let rawText = '';

    if (contentType.includes('application/json')) {
      responseData = await res.json().catch(() => null);
    } else {
      rawText = await res.text().catch(() => '');
    }

    if (res.ok) {
      return NextResponse.json({
        success: true,
        status: res.status,
        statusText: res.statusText || 'OK',
        webhookUrl,
        latencyMs,
        data: responseData || { text: rawText || 'OK' },
        message: 'n8n Webhook successfully received test handshake event!',
      });
    }

    // Handle n8n specific responses (e.g. 404 when test webhook is not actively listening)
    const n8nMessage = responseData?.message || rawText || res.statusText;
    const n8nHint = responseData?.hint || '';

    let hint = 'Make sure n8n is running and the webhook path matches your workflow node.';
    if (res.status === 404) {
      if (webhookUrl.includes('webhook-test')) {
        hint = "In n8n, click the orange 'Listen for test event' button in the Webhook node, then click 'Activate Listening & Ping' again here.";
      } else {
        hint = "For Production webhook URLs, make sure the workflow is switched to 'Active' on the n8n canvas.";
      }
    }

    return NextResponse.json({
      success: false,
      status: res.status,
      statusText: res.statusText,
      webhookUrl,
      latencyMs,
      error: `n8n returned HTTP ${res.status}: ${n8nMessage}`,
      hint: n8nHint || hint,
      data: responseData,
    });
  } catch (error: any) {
    console.error('[ping-webhook] Caught error:', error);
    const latencyMs = Date.now() - start;
    const isTimeout = error.name === 'AbortError' || error.message?.includes('timeout');
    const msg = isTimeout
      ? 'Webhook request timed out after 6 seconds'
      : error instanceof Error
      ? error.message
      : 'Network connection failed';

    return NextResponse.json({
      success: false,
      status: 0,
      latencyMs,
      error: msg,
      hint: 'Ensure n8n is running on http://localhost:5678 and reachable.',
    });
  }
}
