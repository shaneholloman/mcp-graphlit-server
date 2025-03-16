#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerResources } from "./resources.js";
import { registerTools } from './tools.js';

const DEFAULT_INSTRUCTIONS = `
You are provided a set of tools and resources that integrate with the [Graphlit](https://www.graphlit.com) Platform.

Graphlit is an LLM-enabled knowledge API platform, which supports these resources:
- project: container for ingested contents, which can be configured with a default workflow
- contents: all ingested files, web pages, messages, etc.
- feeds: data connectors which ingest contents
- collections: named groups of contents
- workflows: how content is handled during the ingestion process
- specifications: LLM configuration presets, used by workflows

With this Graphlit MCP Server, you can ingest anything from Slack, Discord, websites, Google Drive, email, Jira, Linear or GitHub into a Graphlit project - and then search and retrieve relevant knowledge within an MCP client like Cursor, Windsurf or Cline.

Documents (PDF, DOCX, PPTX, etc.) and HTML web pages will be extracted to Markdown upon ingestion. Audio and video files will be transcribed upon ingestion.

Hints:
1. Always look for matching resources before you try to call any tools.
For example, "have i configured any graphlit workflows?", you should check for workflow resources before trying to call any other tools.
2. Prioritize accessing content directly through collection IDs or content IDs when the content has already been organized
3. Avoid redundant searches with 'retrieveSources' for content that's already been cataloged into a collection
4. Only call the 'configureProject' tool when the user explicitly asks to configure their Graphlit project defaults.
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