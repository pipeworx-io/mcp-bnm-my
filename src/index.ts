interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Bank Negara Malaysia (BNM) Open API MCP. Keyless.
 *
 * Base: https://api.bnm.gov.my/public
 * Every request MUST send `Accept: application/vnd.BNM.API.v1+json` (the API
 * rejects plain application/json) — handled internally by bnmGet().
 * All payloads wrap the result under `data` (with a `meta` block).
 * Base currency for FX is MYR (Malaysian Ringgit). Dates are YYYY-MM-DD.
 */


const BASE = 'https://api.bnm.gov.my/public';
const UA = 'pipeworx-mcp-bnm-my/1.0 (+https://pipeworx.io)';

const tools: McpToolExport['tools'] = [
  {
    name: 'exchange_rates',
    description:
      'Foreign exchange rates against the Malaysian Ringgit (MYR) from Bank Negara Malaysia. ' +
      'Latest rates for all currencies (default), one currency, or one currency on a specific historical date. ' +
      'Rates are published per session (snapshot time) and quote basis. Returns buying/selling/middle rates per currency unit.',
    inputSchema: {
      type: 'object',
      properties: {
        currency: {
          type: 'string',
          description:
            'ISO currency code, e.g. "USD", "SGD", "EUR". Omit to get all currencies. Required if "date" is given.',
        },
        date: {
          type: 'string',
          description:
            'Historical date YYYY-MM-DD, e.g. "2026-05-28". Only valid together with a "currency". Omit for latest.',
        },
        session: {
          type: 'string',
          enum: ['0900', '1130', '1200', '1700'],
          description: 'Rate snapshot session time (24h). Defaults to BNM default if omitted.',
        },
        quote: {
          type: 'string',
          enum: ['rm', 'fx'],
          description: 'Quote basis: "rm" (units of MYR per 1 foreign) or "fx" (units of foreign per 1 MYR).',
        },
      },
    },
  },
  {
    name: 'gold_kijang_emas',
    description:
      'Kijang Emas — Malaysia\'s official gold bullion coin — buying and selling prices (in MYR) by coin size ' +
      '(one_oz, half_oz, quarter_oz). Latest prices by default, or every effective date within a given year+month.',
    inputSchema: {
      type: 'object',
      properties: {
        year: { type: 'integer', description: 'Four-digit year, e.g. 2026. Provide together with "month" for a historical month.' },
        month: { type: 'integer', description: 'Month 1-12. Requires "year".' },
      },
    },
  },
  {
    name: 'policy_rate_opr',
    description:
      "Overnight Policy Rate (OPR) — Bank Negara Malaysia's benchmark monetary policy interest rate. " +
      'Latest OPR decision by default, or every decision in a given year (with change_in_opr and new_opr_level).',
    inputSchema: {
      type: 'object',
      properties: {
        year: { type: 'integer', description: 'Four-digit year, e.g. 2025. Omit for the latest OPR level.' },
      },
    },
  },
  {
    name: 'base_rate',
    description:
      'Per-bank Base Rate (BR), Base Lending Rate (BLR) and indicative effective lending rate published by ' +
      'Malaysian financial institutions to Bank Negara Malaysia. Returns the latest values for every bank.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'bnm_endpoint',
    description:
      'Call any other confirmed Bank Negara Malaysia public endpoint by path and get its raw `data`. ' +
      'Confirmed live paths: "interest-rate" (interbank/money-market deposit rates by tenor), ' +
      '"interest-volume" (transaction volumes by tenor), "islamic-interbank-rate", ' +
      '"kl-usd-reference-rate" (KL USD/MYR reference rate), "usd-interbank-intraday-rate" (intraday hi/lo). ' +
      'Also accepts the documented sub-path forms (e.g. "exchange-rate/USD", "opr/year/2025") if you need a path not covered by a dedicated tool.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            'Endpoint path under https://api.bnm.gov.my/public/ — e.g. "interest-rate", "islamic-interbank-rate", "kl-usd-reference-rate". No leading slash needed.',
        },
        query: {
          type: 'object',
          description: 'Optional query parameters as key/value pairs, e.g. {"session":"1130","quote":"rm"}.',
        },
      },
      required: ['path'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'exchange_rates': {
      const currency = (args.currency as string | undefined)?.trim();
      const date = (args.date as string | undefined)?.trim();
      const qs = buildQuery({ session: args.session, quote: args.quote });
      if (date) {
        if (!currency) throw new Error('"date" requires a "currency" (e.g. {currency:"USD", date:"2026-05-28"}).');
        return bnmGet(`/exchange-rate/${encodeURIComponent(currency)}/date/${encodeURIComponent(date)}${qs}`);
      }
      if (currency) return bnmGet(`/exchange-rate/${encodeURIComponent(currency)}${qs}`);
      return bnmGet(`/exchange-rate${qs}`);
    }
    case 'gold_kijang_emas': {
      const year = args.year;
      const month = args.month;
      if (year != null || month != null) {
        if (year == null || month == null) throw new Error('Provide both "year" and "month" for historical kijang-emas, or neither for latest.');
        return bnmGet(`/kijang-emas/year/${asInt(year)}/month/${pad2(month)}`);
      }
      return bnmGet('/kijang-emas');
    }
    case 'policy_rate_opr': {
      const year = args.year;
      return year != null ? bnmGet(`/opr/year/${asInt(year)}`) : bnmGet('/opr');
    }
    case 'base_rate':
      return bnmGet('/base-rate');
    case 'bnm_endpoint': {
      const path = reqStr(args, 'path', '"interest-rate" or "islamic-interbank-rate"').replace(/^\/+/, '');
      const query = args.query;
      let qs = '';
      if (query && typeof query === 'object') {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(query as Record<string, unknown>)) {
          if (v != null) params.set(k, String(v));
        }
        const s = params.toString();
        if (s) qs = `?${s}`;
      }
      return bnmGet(`/${path}${qs}`);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function bnmGet(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/vnd.BNM.API.v1+json', 'User-Agent': UA },
  });
  if (!res.ok) throw new Error(`BNM: ${res.status} ${await res.text().then((t) => t.slice(0, 200))}`);
  return res.json();
}

function buildQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string' && v.trim()) sp.set(k, v.trim());
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

function asInt(v: unknown): string {
  const n = Number(v);
  if (!Number.isInteger(n)) throw new Error(`Expected an integer, got ${JSON.stringify(v)}.`);
  return String(n);
}

function pad2(v: unknown): string {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 12) throw new Error(`"month" must be an integer 1-12, got ${JSON.stringify(v)}.`);
  return String(n).padStart(2, '0');
}

function reqStr(args: Record<string, unknown>, key: string, example: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`Required argument "${key}" is missing. Pass a string like ${example}.`);
  return v;
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
