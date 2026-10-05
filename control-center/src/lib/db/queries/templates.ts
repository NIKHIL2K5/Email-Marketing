import { query, withTransaction } from '../client';
import { DbTemplate, DbTemplateVersion } from '../types';

export async function getTemplates(): Promise<DbTemplate[]> {
  const sql = `
    SELECT
      t.id::text,
      t.template_key,
      t.name,
      t.description,
      t.status,
      t.current_version_id::text,
      t.created_at::text,
      t.updated_at::text,
      v.id::text AS version_id,
      v.version_number,
      v.subject,
      v.html_content,
      v.text_content,
      v.variables,
      v.created_by AS version_created_by,
      v.created_at::text AS version_created_at,
      v.listmonk_template_id
    FROM email_templates t
    LEFT JOIN template_versions v ON t.current_version_id = v.id
    ORDER BY t.created_at DESC;
  `;

  const res = await query(sql);

  return res.rows.map((row) => ({
    id: row.id,
    template_key: row.template_key,
    name: row.name,
    description: row.description,
    status: row.status,
    current_version_id: row.current_version_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    current_version: row.version_id
      ? {
          id: row.version_id,
          template_id: row.id,
          version_number: row.version_number,
          subject: row.subject,
          html_content: row.html_content,
          text_content: row.text_content,
          variables: Array.isArray(row.variables) ? row.variables : [],
          created_by: row.version_created_by,
          created_at: row.version_created_at,
          listmonk_template_id: row.listmonk_template_id ?? null,
        }
      : null,
  }));
}

export async function getTemplateById(id: string): Promise<(DbTemplate & { versions: DbTemplateVersion[] }) | null> {
  const templateSql = `
    SELECT
      t.id::text,
      t.template_key,
      t.name,
      t.description,
      t.status,
      t.current_version_id::text,
      t.created_at::text,
      t.updated_at::text
    FROM email_templates t
    WHERE t.id = $1;
  `;

  const templateRes = await query<DbTemplate>(templateSql, [id]);
  if (templateRes.rows.length === 0) {
    return null;
  }
  const template = templateRes.rows[0];

  const versionsSql = `
    SELECT
      id::text,
      template_id::text,
      version_number,
      subject,
      html_content,
      text_content,
      variables,
      created_by,
      created_at::text,
      listmonk_template_id
    FROM template_versions
    WHERE template_id = $1
    ORDER BY version_number DESC;
  `;

  const versionsRes = await query(versionsSql, [id]);
  const versions: DbTemplateVersion[] = versionsRes.rows.map((row) => ({
    id: row.id,
    template_id: row.template_id,
    version_number: row.version_number,
    subject: row.subject,
    html_content: row.html_content,
    text_content: row.text_content,
    variables: Array.isArray(row.variables) ? row.variables : [],
    created_by: row.created_by,
    created_at: row.created_at,
    listmonk_template_id: row.listmonk_template_id ?? null,
  }));

  const currentVersion = versions.find((v) => v.id === template.current_version_id) || versions[0] || null;

  return {
    ...template,
    current_version: currentVersion,
    versions,
  };
}

export interface CreateTemplateInput {
  template_key: string;
  name: string;
  description?: string;
  subject: string;
  html_content?: string;
  text_content?: string;
  variables?: string[];
  created_by?: string;
}

export async function createTemplate(data: CreateTemplateInput): Promise<DbTemplate> {
  return withTransaction(async (client) => {
    // 1. Insert template container
    const templateSql = `
      INSERT INTO email_templates (template_key, name, description, status, created_at, updated_at)
      VALUES ($1, $2, $3, 'active', now(), now())
      RETURNING id::text, template_key, name, description, status, created_at::text, updated_at::text;
    `;
    const templateRes = await client.query(templateSql, [
      data.template_key.trim(),
      data.name.trim(),
      data.description ? data.description.trim() : null,
    ]);
    const template = templateRes.rows[0];

    // 2. Insert initial version
    const versionSql = `
      INSERT INTO template_versions (
        template_id,
        version_number,
        subject,
        html_content,
        text_content,
        variables,
        created_by,
        created_at
      )
      VALUES ($1, 1, $2, $3, $4, $5::jsonb, $6, now())
      RETURNING id::text, template_id::text, version_number, subject, html_content, text_content, variables, created_by, created_at::text, listmonk_template_id;
    `;
    const versionRes = await client.query(versionSql, [
      template.id,
      data.subject.trim(),
      data.html_content || null,
      data.text_content || null,
      JSON.stringify(data.variables || []),
      data.created_by || 'operator',
    ]);
    const version = versionRes.rows[0];

    // 3. Link current version
    await client.query('UPDATE email_templates SET current_version_id = $1 WHERE id = $2;', [
      version.id,
      template.id,
    ]);

    return {
      ...template,
      current_version_id: version.id,
      current_version: {
        ...version,
        variables: Array.isArray(version.variables) ? version.variables : [],
        listmonk_template_id: version.listmonk_template_id ?? null,
      },
    };
  });
}

export interface CreateTemplateVersionInput {
  template_id: string;
  subject: string;
  html_content?: string;
  text_content?: string;
  variables?: string[];
  created_by?: string;
  set_as_current?: boolean;
}

export async function createTemplateVersion(data: CreateTemplateVersionInput): Promise<DbTemplateVersion> {
  return withTransaction(async (client) => {
    // Get highest version number
    const maxVerRes = await client.query<{ max: number | null }>(
      'SELECT max(version_number) AS max FROM template_versions WHERE template_id = $1;',
      [data.template_id]
    );
    const nextVer = (maxVerRes.rows[0]?.max || 0) + 1;

    const versionSql = `
      INSERT INTO template_versions (
        template_id,
        version_number,
        subject,
        html_content,
        text_content,
        variables,
        created_by,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, now())
      RETURNING id::text, template_id::text, version_number, subject, html_content, text_content, variables, created_by, created_at::text, listmonk_template_id;
    `;

    const versionRes = await client.query(versionSql, [
      data.template_id,
      nextVer,
      data.subject.trim(),
      data.html_content || null,
      data.text_content || null,
      JSON.stringify(data.variables || []),
      data.created_by || 'operator',
    ]);
    const version = versionRes.rows[0];

    if (data.set_as_current !== false) {
      await client.query('UPDATE email_templates SET current_version_id = $1, updated_at = now() WHERE id = $2;', [
        version.id,
        data.template_id,
      ]);
    }

    return {
      ...version,
      variables: Array.isArray(version.variables) ? version.variables : [],
      listmonk_template_id: version.listmonk_template_id ?? null,
    };
  });
}
