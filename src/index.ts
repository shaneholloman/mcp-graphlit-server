#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerResources } from "./resources.js";
import { registerTools } from './tools.js';

const DEFAULT_INSTRUCTIONS = `
You are provided a set of tools and resources that integrate with the [Graphlit](https://www.graphlit.com) Platform.

Graphlit is an LLM-enabled knowledge API platform, which supports these resources:
- contents
- feeds: data connectors which ingest contents
- collections: named groups of contents

Ingest anything from Slack to Gmail to podcast feeds, in addition to web crawling, into a Graphlit project - and then retrieve relevant content resources.

Documents (PDF, DOCX, PPTX, etc.) and HTML web pages will be extracted to Markdown upon ingestion. Audio and video files will be transcribed upon ingestion.
`

export const server = new McpServer({
  name: "Graphlit MCP Server",
  version: "1.0.0"
}, {
  instructions: DEFAULT_INSTRUCTIONS
});

registerResources(server);
registerTools(server);

async function runServer() {
  try {
    console.error('Attempting to start Graphlit MCP Server.');

    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error('Successfully started Graphlit MCP Server.');
  } 
  catch (error) {
    console.error('Failed to start Graphlit MCP Server.', error);

    process.exit(1);
  }
}

runServer().catch((error) => {
  console.error('Failed to start Graphlit MCP Server.', error);
  
  process.exit(1);
});