# mcp-bnm-my

Bank Negara Malaysia (BNM) Open API MCP. Keyless.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1679+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `bnm_exchange_rates` | Foreign exchange rates against the Malaysian Ringgit (MYR) from Bank Negara Malaysia. Latest rates for all currencies (default), one currency, or one currency on a specific historical date. Rates are published per session (snapshot time) and quote basis. Returns buying/selling/middle rates per currency unit. |
| `bnm_gold_kijang_emas` | Kijang Emas — Malaysia's official gold bullion coin — buying and selling prices (in MYR) by coin size (one_oz, half_oz, quarter_oz). Latest prices by default, or every effective date within a given year+month. |
| `bnm_policy_rate_opr` | Overnight Policy Rate (OPR) — Bank Negara Malaysia's benchmark monetary policy interest rate. Latest OPR decision by default, or every decision in a given year (with change_in_opr and new_opr_level). |
| `bnm_base_rate` | Fetch the latest Base Rate (BR), Base Lending Rate (BLR), and indicative effective lending rate for every Malaysian financial institution, as published to Bank Negara Malaysia. Returns an array of bank entries with their current rate levels. No parameters required.Malaysian financial institutions to Bank Negara Malaysia. Returns the latest values for every bank. |
| `bnm_endpoint` | Call any other confirmed Bank Negara Malaysia public endpoint by path and get its raw `data`. Confirmed live paths: "interest-rate" (interbank/money-market deposit rates by tenor), "interest-volume" (transaction volumes by tenor), "islamic-interbank-rate", "kl-usd-reference-rate" (KL USD/MYR reference rate), "usd-interbank-intraday-rate" (intraday hi/lo). Also accepts the documented sub-path forms (e.g. "exchange-rate/USD", "opr/year/2025") if you need a path not covered by a dedicated tool. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "bnm-my": {
      "url": "https://gateway.pipeworx.io/bnm-my/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/bnm-my/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1679+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## No MCP client? Call it over HTTP

```bash
curl -X POST https://gateway.pipeworx.io/v1/tools/bnm_exchange_rates \
  -H 'Content-Type: application/json' \
  -d '{"currency":"USD"}'
```

No account needed for the first calls. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/bnm_exchange_rates`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.

## Standalone (no gateway account)

This package also runs as a local stdio MCP server — no Pipeworx account, no
gateway round-trip:

```json
{
  "mcpServers": {
    "bnm-my": {
      "command": "npx",
      "args": ["-y", "@pipeworx/mcp-bnm-my"]
    }
  }
}
```

Or run it directly to confirm it starts:

```bash
npx -y @pipeworx/mcp-bnm-my
```

It speaks MCP over stdin/stdout and answers `initialize`/`tools/list`/`tools/call`
for **only** this pack's tools — none of the shared meta-tools the gateway
connection above adds. Same source, same tools, no ask_pipeworx routing.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Bnm My data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
