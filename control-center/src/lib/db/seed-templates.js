const { Client } = require('pg');

async function seed() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await c.connect();

  const existing = await c.query('SELECT count(*) from email_templates;');
  if (parseInt(existing.rows[0].count, 10) === 0) {
    const t1 = await c.query(`
      INSERT INTO email_templates (template_key, name, description, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, now(), now())
      RETURNING id;
    `, ['exec-intro-v1', 'Executive Direct Introduction', 'Direct cold outreach for C-level & VP personas with personalized problem statement', 'active']);
    
    const t1Id = t1.rows[0].id;
    const v1 = await c.query(`
      INSERT INTO template_versions (template_id, version_number, subject, html_content, text_content, variables, created_by, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, now())
      RETURNING id;
    `, [
      t1Id,
      1,
      'Quick question regarding operations at {{company}}',
      '<p>Hi {{first_name}},</p><p>I noticed your leadership at {{company}} in the {{industry}} space. We recently helped a similar team streamline outreach delivery by over 40% while preserving strict domain reputation.</p><p>Would you be open to a brief 10-minute introductory conversation next Tuesday or Thursday?</p><p>Best regards,<br/>First Client Team</p><hr/><p style="font-size:11px;color:#888;">To opt out from future communications, reply with UNSUBSCRIBE or click here.</p>',
      'Hi {{first_name}},\n\nI noticed your leadership at {{company}} in the {{industry}} space. We recently helped a similar team streamline outreach delivery by over 40% while preserving strict domain reputation.\n\nWould you be open to a brief 10-minute introductory conversation next Tuesday or Thursday?\n\nBest regards,\nFirst Client Team\n\n---\nTo opt out from future communications, reply with UNSUBSCRIBE.',
      JSON.stringify(['first_name', 'company', 'industry', 'title']),
      'system_init'
    ]);

    await c.query('UPDATE email_templates SET current_version_id = $1 WHERE id = $2;', [v1.rows[0].id, t1Id]);

    const t2 = await c.query(`
      INSERT INTO email_templates (template_key, name, description, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, now(), now())
      RETURNING id;
    `, ['followup-nudge-v1', 'Follow-Up Value Add Nudge', 'Second-touch follow up after initial no-reply with resource asset', 'active']);

    const t2Id = t2.rows[0].id;
    const v2 = await c.query(`
      INSERT INTO template_versions (template_id, version_number, subject, html_content, text_content, variables, created_by, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, now())
      RETURNING id;
    `, [
      t2Id,
      1,
      'Following up / resources for {{company}}',
      '<p>Hi {{first_name}},</p><p>Following up on my previous note. Thought you might find our recent benchmark report on outbound deliverability trends useful for {{company}}.</p><p>Let me know if this aligns with your current priorities this quarter.</p><p>Best,<br/>First Client Team</p><hr/><p style="font-size:11px;color:#888;">To opt out, reply with UNSUBSCRIBE.</p>',
      'Hi {{first_name}},\n\nFollowing up on my previous note. Thought you might find our recent benchmark report on outbound deliverability trends useful for {{company}}.\n\nLet me know if this aligns with your current priorities this quarter.\n\nBest,\nFirst Client Team\n\n---\nTo opt out, reply with UNSUBSCRIBE.',
      JSON.stringify(['first_name', 'company']),
      'system_init'
    ]);

    await c.query('UPDATE email_templates SET current_version_id = $1 WHERE id = $2;', [v2.rows[0].id, t2Id]);
    console.log('Seeded 2 default templates successfully.');
  } else {
    console.log('Templates already present in database:', existing.rows[0].count);
  }

  await c.end();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
