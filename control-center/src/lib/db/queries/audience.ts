import { query, withTransaction } from '../client';
import { recordAuditLog } from './audit';

export interface AudienceRuleCondition {
  field:
    | 'country'
    | 'state'
    | 'city'
    | 'industry'
    | 'company'
    | 'employees'
    | 'seniority'
    | 'departments'
    | 'email_validation_status'
    | 'consent_status'
    | 'suppression_status'
    | 'bounce_status'
    | 'complaint_status'
    | 'eligibility_status'
    | 'search';
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'in'
    | 'not_in'
    | 'is_empty'
    | 'is_not_empty';
  value: string;
}

export interface AudienceRuleGroup {
  combinator: 'AND' | 'OR';
  conditions: AudienceRuleCondition[];
}

export interface AudienceRules {
  combinator: 'AND' | 'OR';
  groups: AudienceRuleGroup[];
}

export interface Audience {
  id: string;
  name: string;
  description: string | null;
  status: string;
  rules: AudienceRules;
  total_matching: number;
  eligible_count: number;
  blocked_count: number;
  suppressed_count: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AudiencePreviewResult {
  totalMatching: number;
  eligible: number;
  blocked: number;
  suppressed: number;
  unsubscribed: number;
  bounced: number;
  complained: number;
  missingConsent: number;
  invalidEmail: number;
  sampleContacts: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    title: string | null;
    country: string | null;
    industry: string | null;
    seniority: string | null;
    eligibilityStatus: string;
    eligibilityReason: string | null;
  }[];
}

const FIELD_MAP: Record<string, string> = {
  country: 'c.country',
  state: 'c.state',
  city: 'c.city',
  industry: 'c.industry',
  company: 'c.company',
  employees: 'c.employees',
  seniority: 'c.seniority',
  departments: 'c.departments',
  email_validation_status: 's.email_validation_status',
  consent_status: 's.consent_status',
  suppression_status: 's.suppression_status',
  bounce_status: 's.bounce_status',
  complaint_status: 's.complaint_status',
  eligibility_status: 's.eligibility_status',
};

export function buildAudienceWhereClause(
  rules: AudienceRules | null | undefined,
  startParamIdx = 1
): { whereSql: string; params: unknown[]; nextParamIdx: number } {
  if (!rules || !rules.groups || rules.groups.length === 0) {
    return { whereSql: '1=1', params: [], nextParamIdx: startParamIdx };
  }

  const params: unknown[] = [];
  let paramIdx = startParamIdx;
  const groupClauses: string[] = [];

  for (const group of rules.groups) {
    if (!group.conditions || group.conditions.length === 0) continue;

    const conditionClauses: string[] = [];
    for (const cond of group.conditions) {
      if (cond.field === 'search') {
        const val = cond.value?.trim();
        if (val) {
          conditionClauses.push(
            `(c.email ILIKE $${paramIdx} OR c.company ILIKE $${paramIdx} OR c.first_name ILIKE $${paramIdx} OR c.last_name ILIKE $${paramIdx})`
          );
          params.push(`%${val}%`);
          paramIdx++;
        }
        continue;
      }

      const col = FIELD_MAP[cond.field];
      if (!col) continue;

      const val = cond.value?.trim();

      switch (cond.operator) {
        case 'equals':
          conditionClauses.push(`LOWER(COALESCE(${col}, '')) = LOWER($${paramIdx})`);
          params.push(val);
          paramIdx++;
          break;
        case 'not_equals':
          conditionClauses.push(`LOWER(COALESCE(${col}, '')) != LOWER($${paramIdx})`);
          params.push(val);
          paramIdx++;
          break;
        case 'contains':
          conditionClauses.push(`${col} ILIKE $${paramIdx}`);
          params.push(`%${val}%`);
          paramIdx++;
          break;
        case 'not_contains':
          conditionClauses.push(`(${col} IS NULL OR ${col} NOT ILIKE $${paramIdx})`);
          params.push(`%${val}%`);
          paramIdx++;
          break;
        case 'in': {
          const items = val.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
          if (items.length > 0) {
            conditionClauses.push(`LOWER(${col}) = ANY($${paramIdx}::text[])`);
            params.push(items);
            paramIdx++;
          }
          break;
        }
        case 'not_in': {
          const items = val.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
          if (items.length > 0) {
            conditionClauses.push(`(${col} IS NULL OR LOWER(${col}) != ALL($${paramIdx}::text[]))`);
            params.push(items);
            paramIdx++;
          }
          break;
        }
        case 'is_empty':
          conditionClauses.push(`(${col} IS NULL OR TRIM(${col}) = '')`);
          break;
        case 'is_not_empty':
          conditionClauses.push(`(${col} IS NOT NULL AND TRIM(${col}) != '')`);
          break;
        default:
          break;
      }
    }

    if (conditionClauses.length > 0) {
      const glue = ` ${group.combinator || 'AND'} `;
      groupClauses.push(`(${conditionClauses.join(glue)})`);
    }
  }

  if (groupClauses.length === 0) {
    return { whereSql: '1=1', params: [], nextParamIdx: startParamIdx };
  }

  const topGlue = ` ${rules.combinator || 'AND'} `;
  return {
    whereSql: groupClauses.join(topGlue),
    params,
    nextParamIdx: paramIdx,
  };
}

export async function previewAudience(rules: AudienceRules): Promise<AudiencePreviewResult> {
  const { whereSql, params, nextParamIdx } = buildAudienceWhereClause(rules);

  const metricsSql = `
    SELECT
      count(*)::int AS total_matching,
      count(*) FILTER (WHERE s.eligibility_status = 'eligible')::int AS eligible,
      count(*) FILTER (WHERE s.eligibility_status = 'blocked')::int AS blocked,
      count(*) FILTER (WHERE s.suppression_status = 'suppressed')::int AS suppressed,
      count(*) FILTER (WHERE s.unsubscribe_status = 'unsubscribed')::int AS unsubscribed,
      count(*) FILTER (WHERE s.bounce_status IN ('hard', 'soft'))::int AS bounced,
      count(*) FILTER (WHERE s.complaint_status = 'complaint')::int AS complained,
      count(*) FILTER (WHERE s.consent_status != 'explicit_opt_in' AND s.consent_status != 'opt_in')::int AS missing_consent,
      count(*) FILTER (WHERE s.email_validation_status IN ('invalid', 'failed'))::int AS invalid_email
    FROM contacts c
    LEFT JOIN contact_email_status s ON c.id = s.contact_id
    WHERE ${whereSql};
  `;

  const metricsRes = await query<{
    total_matching: number;
    eligible: number;
    blocked: number;
    suppressed: number;
    unsubscribed: number;
    bounced: number;
    complained: number;
    missing_consent: number;
    invalid_email: number;
  }>(metricsSql, params);

  const m = metricsRes.rows[0] || {
    total_matching: 0,
    eligible: 0,
    blocked: 0,
    suppressed: 0,
    unsubscribed: 0,
    bounced: 0,
    complained: 0,
    missing_consent: 0,
    invalid_email: 0,
  };

  const sampleSql = `
    SELECT
      c.id,
      c.email,
      c.first_name,
      c.last_name,
      c.company,
      c.title,
      c.country,
      c.industry,
      c.seniority,
      COALESCE(s.eligibility_status, 'unknown') AS eligibility_status,
      s.eligibility_reason
    FROM contacts c
    LEFT JOIN contact_email_status s ON c.id = s.contact_id
    WHERE ${whereSql}
    ORDER BY (s.eligibility_status = 'eligible') DESC, c.id ASC
    LIMIT 20;
  `;

  const sampleRes = await query<{
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
    title: string | null;
    country: string | null;
    industry: string | null;
    seniority: string | null;
    eligibility_status: string;
    eligibility_reason: string | null;
  }>(sampleSql, params);

  return {
    totalMatching: Number(m.total_matching) || 0,
    eligible: Number(m.eligible) || 0,
    blocked: Number(m.blocked) || 0,
    suppressed: Number(m.suppressed) || 0,
    unsubscribed: Number(m.unsubscribed) || 0,
    bounced: Number(m.bounced) || 0,
    complained: Number(m.complained) || 0,
    missingConsent: Number(m.missing_consent) || 0,
    invalidEmail: Number(m.invalid_email) || 0,
    sampleContacts: sampleRes.rows.map((r) => ({
      id: String(r.id),
      email: r.email,
      firstName: r.first_name,
      lastName: r.last_name,
      company: r.company,
      title: r.title,
      country: r.country,
      industry: r.industry,
      seniority: r.seniority,
      eligibilityStatus: r.eligibility_status,
      eligibilityReason: r.eligibility_reason,
    })),
  };
}

export async function getAudiences(): Promise<Audience[]> {
  const sql = `
    SELECT *
    FROM audiences
    ORDER BY created_at DESC;
  `;
  const res = await query<Audience>(sql);
  return res.rows;
}

export async function getAudienceById(id: string): Promise<Audience | null> {
  const sql = `SELECT * FROM audiences WHERE id = $1;`;
  const res = await query<Audience>(sql, [id]);
  return res.rows[0] || null;
}

export async function createAudience(input: {
  name: string;
  description?: string;
  rules: AudienceRules;
  operator?: string;
}): Promise<Audience> {
  const preview = await previewAudience(input.rules);

  const sql = `
    INSERT INTO audiences (
      name,
      description,
      status,
      rules,
      total_matching,
      eligible_count,
      blocked_count,
      suppressed_count,
      version,
      created_at,
      updated_at
    ) VALUES (
      $1,
      $2,
      'active',
      $3::jsonb,
      $4,
      $5,
      $6,
      $7,
      1,
      now(),
      now()
    ) RETURNING *;
  `;

  const res = await query<Audience>(sql, [
    input.name.trim(),
    input.description?.trim() || null,
    JSON.stringify(input.rules),
    preview.totalMatching,
    preview.eligible,
    preview.blocked,
    preview.suppressed,
  ]);

  const audience = res.rows[0];

  await recordAuditLog({
    actor_reference: input.operator || 'operator',
    action: 'audience_created',
    entity_type: 'audience',
    entity_id: String(audience.id),
    after_state: audience as unknown as Record<string, unknown>,
    result: 'success',
  });

  return audience;
}

export async function updateAudience(
  id: string,
  input: {
    name?: string;
    description?: string;
    rules?: AudienceRules;
    operator?: string;
  }
): Promise<Audience> {
  const current = await getAudienceById(id);
  if (!current) {
    throw new Error(`Audience ${id} not found`);
  }

  const newRules = input.rules || current.rules;
  const preview = await previewAudience(newRules);

  const sql = `
    UPDATE audiences
    SET
      name = COALESCE($2, name),
      description = COALESCE($3, description),
      rules = $4::jsonb,
      total_matching = $5,
      eligible_count = $6,
      blocked_count = $7,
      suppressed_count = $8,
      version = version + 1,
      updated_at = now()
    WHERE id = $1
    RETURNING *;
  `;

  const res = await query<Audience>(sql, [
    id,
    input.name?.trim() || null,
    input.description !== undefined ? input.description.trim() || null : null,
    JSON.stringify(newRules),
    preview.totalMatching,
    preview.eligible,
    preview.blocked,
    preview.suppressed,
  ]);

  const updated = res.rows[0];

  await recordAuditLog({
    actor_reference: input.operator || 'operator',
    action: 'audience_updated',
    entity_type: 'audience',
    entity_id: String(id),
    before_state: current as unknown as Record<string, unknown>,
    after_state: updated as unknown as Record<string, unknown>,
    result: 'success',
  });

  return updated;
}

export async function deleteAudience(id: string, operator?: string): Promise<{ success: boolean }> {
  const current = await getAudienceById(id);
  if (!current) {
    throw new Error(`Audience ${id} not found`);
  }

  // Check if active campaign is using it
  const checkSql = `
    SELECT count(*)::int AS count
    FROM campaigns
    WHERE audience_id = $1 AND status IN ('scheduled', 'running');
  `;
  const checkRes = await query<{ count: number }>(checkSql, [id]);
  if (Number(checkRes.rows[0]?.count) > 0) {
    throw new Error('Cannot delete audience currently assigned to scheduled or running campaigns.');
  }

  await query('DELETE FROM audiences WHERE id = $1;', [id]);

  await recordAuditLog({
    actor_reference: operator || 'operator',
    action: 'audience_deleted',
    entity_type: 'audience',
    entity_id: String(id),
    before_state: current as unknown as Record<string, unknown>,
    result: 'success',
  });

  return { success: true };
}

export async function assignAudienceToCampaign(input: {
  campaignId: string;
  audienceId: string;
  operator?: string;
}): Promise<{
  campaignId: string;
  audienceId: string;
  version: number;
  snapshotId: string;
  totalMatching: number;
  eligibleCount: number;
  recipientsAssigned: number;
}> {
  return withTransaction(async (client) => {
    // 1. Verify campaign
    const campRes = await client.query<{
      id: string;
      status: string;
      name: string;
      max_recipients: number | null;
      audience_id: string | null;
    }>('SELECT id, status, name, max_recipients, audience_id FROM campaigns WHERE id = $1;', [
      input.campaignId,
    ]);

    if (campRes.rows.length === 0) {
      throw new Error(`Campaign ${input.campaignId} not found`);
    }

    const campaign = campRes.rows[0];
    if (['completed', 'cancelled'].includes(campaign.status.toLowerCase())) {
      throw new Error(`Cannot assign audience to campaign in "${campaign.status}" state.`);
    }

    // 2. Fetch audience
    const audRes = await client.query<Audience>('SELECT * FROM audiences WHERE id = $1;', [
      input.audienceId,
    ]);
    if (audRes.rows.length === 0) {
      throw new Error(`Audience ${input.audienceId} not found`);
    }
    const audience = audRes.rows[0];

    // 3. Build WHERE clause from audience rules
    const { whereSql, params } = buildAudienceWhereClause(audience.rules, 2);

    // 4. Calculate actual metrics at snapshot time
    const countSql = `
      SELECT
        count(*)::int AS total_matching,
        count(*) FILTER (WHERE s.eligibility_status = 'eligible')::int AS eligible_count
      FROM contacts c
      LEFT JOIN contact_email_status s ON c.id = s.contact_id
      WHERE ${whereSql};
    `;
    const countRes = await client.query<{ total_matching: number; eligible_count: number }>(
      countSql,
      params
    );
    const totalMatching = Number(countRes.rows[0]?.total_matching) || 0;
    const eligibleCount = Number(countRes.rows[0]?.eligible_count) || 0;

    // 5. Determine insertion limit based on campaigns.max_recipients
    let limitClause = '';
    const insertParams: unknown[] = [input.campaignId, ...params];
    if (campaign.max_recipients && campaign.max_recipients > 0) {
      // Check already assigned recipients count
      const existingRes = await client.query<{ count: number }>(
        'SELECT count(*)::int AS count FROM campaign_recipients WHERE campaign_id = $1;',
        [input.campaignId]
      );
      const existingCount = Number(existingRes.rows[0]?.count) || 0;
      const remainingSlots = Math.max(0, campaign.max_recipients - existingCount);
      limitClause = `LIMIT ${remainingSlots}`;
    }

    // 6. Insert eligible contacts into campaign_recipients
    const insertSql = `
      INSERT INTO campaign_recipients (
        campaign_id,
        contact_id,
        email_normalized,
        status,
        eligibility_reason,
        attempt_count,
        created_at,
        updated_at
      )
      SELECT
        $1::bigint,
        c.id,
        c.email_normalized,
        'queued',
        COALESCE(s.eligibility_reason, 'eligible'),
        0,
        now(),
        now()
      FROM contacts c
      JOIN contact_email_status s ON c.id = s.contact_id
      WHERE s.eligibility_status = 'eligible' AND (${whereSql})
      ORDER BY c.id ASC
      ${limitClause}
      ON CONFLICT (campaign_id, contact_id) DO NOTHING
      RETURNING id;
    `;

    const insertRes = await client.query(insertSql, insertParams);
    const recipientsAssigned = insertRes.rows.length;

    // 7. Create deterministic audience snapshot
    const snapRes = await client.query<{ id: string }>(
      `INSERT INTO audience_snapshots (
        audience_id,
        campaign_id,
        version,
        rules_snapshot,
        total_matching,
        eligible_count,
        recipient_count,
        created_at
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, now())
      RETURNING id;`,
      [
        audience.id,
        campaign.id,
        audience.version,
        JSON.stringify(audience.rules),
        totalMatching,
        eligibleCount,
        recipientsAssigned,
      ]
    );
    const snapshotId = snapRes.rows[0].id;

    // 8. Update campaign with audience binding
    await client.query(
      `UPDATE campaigns
       SET audience_id = $1,
           audience_version = $2,
           audience_snapshot_at = now(),
           updated_at = now()
       WHERE id = $3;`,
      [audience.id, audience.version, campaign.id]
    );

    // 9. Record audit trail
    await client.query(
      `INSERT INTO audit_logs (
        actor_type,
        actor_reference,
        action,
        entity_type,
        entity_id,
        after_state,
        result,
        created_at
      ) VALUES (
        'operator',
        $1,
        'campaign_audience_assigned',
        'campaign',
        $2,
        $3::jsonb,
        'success',
        now()
      );`,
      [
        input.operator || 'operator',
        input.campaignId,
        JSON.stringify({
          audience_id: audience.id,
          audience_name: audience.name,
          audience_version: audience.version,
          snapshot_id: snapshotId,
          recipients_assigned: recipientsAssigned,
        }),
      ]
    );

    return {
      campaignId: input.campaignId,
      audienceId: String(audience.id),
      version: audience.version,
      snapshotId: String(snapshotId),
      totalMatching,
      eligibleCount,
      recipientsAssigned,
    };
  });
}
