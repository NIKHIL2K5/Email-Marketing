import { query } from '../client';
import {
  createListmonkTemplate,
  updateListmonkTemplate,
  ListmonkTemplate,
  ListmonkTemplatePayload,
} from '@/lib/listmonk';

interface TemplateVersionSyncRecord {
  id: string;
  template_id: string;
  version_number: number;
  subject: string;
  html_content: string | null;
  text_content: string | null;
  variables: unknown;
  created_by: string | null;
  created_at: string;
  listmonk_template_id: number | null;
  template_key: string;
  template_name: string;
}

export interface SyncTemplateResult {
  version_id: string;
  listmonk_template_id: number;
  template: ListmonkTemplate;
  is_new: boolean;
}

/**
 * Map supported Control Center template variables to Listmonk transactional variables.
 * Supported variables:
 *   {{first_name}} -> {{ .Tx.Data.first_name }}
 *   {{last_name}}  -> {{ .Tx.Data.last_name }}
 *   {{company}}    -> {{ .Tx.Data.company }}
 *   {{title}}      -> {{ .Tx.Data.title }}
 *   {{industry}}   -> {{ .Tx.Data.industry }}
 */
export function mapVariablesToListmonkTx(content: string): string {
  if (!content) return content;
  return content
    .replace(/\{\{\s*first_name\s*\}\}/gi, '{{ .Tx.Data.first_name }}')
    .replace(/\{\{\s*last_name\s*\}\}/gi, '{{ .Tx.Data.last_name }}')
    .replace(/\{\{\s*company\s*\}\}/gi, '{{ .Tx.Data.company }}')
    .replace(/\{\{\s*title\s*\}\}/gi, '{{ .Tx.Data.title }}')
    .replace(/\{\{\s*industry\s*\}\}/gi, '{{ .Tx.Data.industry }}');
}

/**
 * Synchronize a Control Center template version to Listmonk.
 *
 * Requirements:
 * 1. Read version details from template_versions joined with email_templates.
 * 2. Validate subject and body content (prefer html_content, fallback to text_content).
 * 3. Type: 'tx'.
 * 4. Name format: 'Control Center - {template_key} - v{version_number}'.
 * 5. If listmonk_template_id is null: POST /api/templates.
 * 6. If listmonk_template_id already exists: PUT /api/templates/{id}.
 * 7. Save returned listmonk_template_id to template_versions.
 * 8. Return the Listmonk template result.
 */
export async function syncTemplateVersionToListmonk(
  versionId: string | number
): Promise<SyncTemplateResult> {
  const selectSql = `
    SELECT
      v.id::text,
      v.template_id::text,
      v.version_number,
      v.subject,
      v.html_content,
      v.text_content,
      v.variables,
      v.created_by,
      v.created_at::text,
      v.listmonk_template_id,
      t.template_key,
      t.name AS template_name
    FROM template_versions v
    JOIN email_templates t ON v.template_id = t.id
    WHERE v.id = $1;
  `;

  const res = await query<TemplateVersionSyncRecord>(selectSql, [versionId]);
  if (res.rows.length === 0) {
    throw new Error(`Template version not found: ${versionId}`);
  }

  const version = res.rows[0];

  // Validate subject
  const subject = (version.subject || '').trim();
  if (!subject) {
    throw new Error(
      `Cannot synchronize template version ${version.version_number}: subject is empty`
    );
  }

  // Determine body: prefer html_content, fallback to text_content
  const htmlContent = version.html_content ? version.html_content.trim() : '';
  const textContent = version.text_content ? version.text_content.trim() : '';

  let body = '';
  if (htmlContent.length > 0) {
    body = version.html_content!;
  } else if (textContent.length > 0) {
    body = version.text_content!;
  } else {
    throw new Error(
      `Cannot synchronize template version ${version.version_number}: both html_content and text_content are empty`
    );
  }

  const templateName = `Control Center - ${version.template_key} - v${version.version_number}`;

  const payload: ListmonkTemplatePayload = {
    name: templateName,
    type: 'tx',
    subject: mapVariablesToListmonkTx(subject),
    body: mapVariablesToListmonkTx(body),
  };

  let listmonkTemplate: ListmonkTemplate;
  const isNew = !version.listmonk_template_id;

  if (isNew) {
    // Create new Listmonk transactional template
    listmonkTemplate = await createListmonkTemplate(payload);
  } else {
    // Update existing Listmonk template (for explicit repair/resync)
    listmonkTemplate = await updateListmonkTemplate(
      version.listmonk_template_id!,
      payload
    );
  }

  // Persist returned Listmonk template ID
  await query(
    'UPDATE template_versions SET listmonk_template_id = $1 WHERE id = $2;',
    [listmonkTemplate.id, version.id]
  );

  return {
    version_id: version.id,
    listmonk_template_id: listmonkTemplate.id,
    template: listmonkTemplate,
    is_new: isNew,
  };
}
