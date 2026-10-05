import dns from 'dns';

export interface DomainDnsCheckResult {
  domain: string;
  spf: {
    status: 'verified' | 'missing' | 'invalid' | 'unknown';
    record: string | null;
    details: string;
  };
  dkim: {
    status: 'verified' | 'missing' | 'invalid' | 'unknown';
    selector: string;
    record: string | null;
    details: string;
  };
  dmarc: {
    status: 'verified' | 'missing' | 'invalid' | 'unknown';
    record: string | null;
    details: string;
  };
  mx: {
    status: 'verified' | 'missing' | 'invalid' | 'unknown';
    records: Array<{ exchange: string; priority: number }>;
    details: string;
  };
  overallStatus: 'ready' | 'warning' | 'not_ready';
  checkedAt: string;
}

export async function checkDomainReadiness(
  domain: string,
  dkimSelector = 'mail'
): Promise<DomainDnsCheckResult> {
  const cleanDomain = domain.trim().toLowerCase();
  const checkedAt = new Date().toISOString();

  const result: DomainDnsCheckResult = {
    domain: cleanDomain,
    spf: { status: 'unknown', record: null, details: 'Checking...' },
    dkim: { status: 'unknown', selector: dkimSelector, record: null, details: 'Checking...' },
    dmarc: { status: 'unknown', record: null, details: 'Checking...' },
    mx: { status: 'unknown', records: [], details: 'Checking...' },
    overallStatus: 'not_ready',
    checkedAt,
  };

  const resolver = dns.promises;

  // 1. Check MX records
  try {
    const mxRecords = await resolver.resolveMx(cleanDomain);
    if (mxRecords && mxRecords.length > 0) {
      result.mx = {
        status: 'verified',
        records: mxRecords.map((m) => ({ exchange: m.exchange, priority: m.priority })),
        details: `Found ${mxRecords.length} MX record(s): ${mxRecords.map((m) => m.exchange).join(', ')}`,
      };
    } else {
      result.mx = {
        status: 'missing',
        records: [],
        details: 'No MX records found for domain.',
      };
    }
  } catch (err: any) {
    result.mx = {
      status: err.code === 'ENODATA' || err.code === 'ENOTFOUND' ? 'missing' : 'invalid',
      records: [],
      details: err.message || 'DNS MX resolution failed',
    };
  }

  // 2. Check SPF (TXT records on root domain)
  try {
    const txtRecords = await resolver.resolveTxt(cleanDomain);
    const flatRecords = txtRecords.map((chunks) => chunks.join(''));
    const spfRecord = flatRecords.find((r) => r.startsWith('v=spf1'));

    if (spfRecord) {
      const isValid = spfRecord.includes('~all') || spfRecord.includes('-all') || spfRecord.includes('+all');
      result.spf = {
        status: isValid ? 'verified' : 'invalid',
        record: spfRecord,
        details: isValid
          ? 'Valid SPF policy found.'
          : 'SPF record found but missing valid all directive.',
      };
    } else {
      result.spf = {
        status: 'missing',
        record: null,
        details: 'No v=spf1 TXT record configured on root domain.',
      };
    }
  } catch (err: any) {
    result.spf = {
      status: err.code === 'ENODATA' || err.code === 'ENOTFOUND' ? 'missing' : 'unknown',
      record: null,
      details: err.message || 'DNS TXT lookup failed',
    };
  }

  // 3. Check DMARC (_dmarc.domain)
  try {
    const dmarcHost = `_dmarc.${cleanDomain}`;
    const dmarcTxt = await resolver.resolveTxt(dmarcHost);
    const flatDmarc = dmarcTxt.map((chunks) => chunks.join(''));
    const dmarcRecord = flatDmarc.find((r) => r.startsWith('v=DMARC1'));

    if (dmarcRecord) {
      result.dmarc = {
        status: 'verified',
        record: dmarcRecord,
        details: 'Valid DMARC policy record configured.',
      };
    } else {
      result.dmarc = {
        status: 'missing',
        record: null,
        details: 'No v=DMARC1 record found at _dmarc host.',
      };
    }
  } catch (err: any) {
    result.dmarc = {
      status: err.code === 'ENODATA' || err.code === 'ENOTFOUND' ? 'missing' : 'unknown',
      record: null,
      details: err.message || 'DMARC TXT lookup failed',
    };
  }

  // 4. Check DKIM (selector._domainkey.domain)
  const selectorsToTry = [dkimSelector, 'mail', 'brevo', 'google', 'default'];
  let foundDkim = false;

  for (const sel of selectorsToTry) {
    try {
      const dkimHost = `${sel}._domainkey.${cleanDomain}`;
      const dkimTxt = await resolver.resolveTxt(dkimHost);
      const flatDkim = dkimTxt.map((chunks) => chunks.join(''));
      const dkimRecord = flatDkim.find((r) => r.includes('v=DKIM1') || r.includes('p='));

      if (dkimRecord) {
        result.dkim = {
          status: 'verified',
          selector: sel,
          record: dkimRecord,
          details: `Valid DKIM key found at selector "${sel}".`,
        };
        foundDkim = true;
        break;
      }
    } catch {
      // Try next selector
    }
  }

  if (!foundDkim) {
    result.dkim = {
      status: 'missing',
      selector: dkimSelector,
      record: null,
      details: `No DKIM public key found at tested selectors: ${selectorsToTry.join(', ')}`,
    };
  }

  // Overall status
  if (result.spf.status === 'verified' && result.dkim.status === 'verified' && result.dmarc.status === 'verified') {
    result.overallStatus = 'ready';
  } else if (result.spf.status === 'verified' || result.mx.status === 'verified') {
    result.overallStatus = 'warning';
  } else {
    result.overallStatus = 'not_ready';
  }

  return result;
}
