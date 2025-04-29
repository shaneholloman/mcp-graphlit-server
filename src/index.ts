#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerResources } from "./resources.js";
import { registerTools } from './tools.js';

const DEFAULT_INSTRUCTIONS = `
You are provided a set of MCP tools and resources that integrate with the [Graphlit](https://www.graphlit.com) Platform.

To use each of the Graphlit MCP tools, there may be environment variables which are required to be configured in your MCP client. These are described in the description for each tool.
These must be configured in the MCP client YAML or JSON configuration file before you can use the tools. *Do not* set these directly in your Terminal or shell environment.

Graphlit is an LLM-enabled knowledge API platform, which supports these resources:
- project: container for ingested contents, which can be configured with a default workflow
- contents: all ingested files, web pages, messages, etc.; also includes short-term 'memory' contents
- feeds: data connectors which ingest contents
- collections: named groups of contents
- conversations: chat message history of LLM conversation, which uses RAG pipeline for content retrieval
- workflows: how content is handled during the ingestion process
- specifications: LLM configuration presets, used by workflows and conversations

You have access to one and only one Graphlit project, which can optionally be configured with a workflow to guide the document preparation and entity extraction of ingested content. 
The Graphlit project is non-deletable, but you can create and delete contents, feeds, collections, conversations, specifications and workflows within the project.

You can query the Graphlit project resource for the credits used, tokens used, and the available project quota.

With this Graphlit MCP Server, you can ingest anything from Slack, Discord, websites, Notion, Google Drive, email, Jira, Linear or GitHub into a Graphlit project - and then search and retrieve relevant knowledge within an MCP client like Cursor, Windsurf or Cline.

Documents (PDF, DOCX, PPTX, etc.) and HTML web pages will be extracted to Markdown upon ingestion. Audio and video files will be transcribed upon ingestion.

## Best Practices:
1. Always look for matching resources before you try to call any tools.
For example, "have i configured any graphlit workflows?", you should check for workflow resources before trying to call any other tools.
2. Don't use 'retrieveSources' to locate contents, when you have already added the contents into a collection. In that case, first retrieve the collection resource, which contains the content resources.
3. Only call the 'configureProject' tool when the user explicitly asks to configure their Graphlit project defaults.
4. Never infer, guess at or hallucinate any URLs. Always retrieve the latest content resources in order to get downloadable URLs.
5. Use 'ingestMemory' to save short-term memories, such as temporary notes or intermediate state for research. Use 'ingestText' to store long-term knowledge, such as Markdown results from research.
6. Always use 'PODSCAN' web search type when searching for podcast episodes, podcast appearances, etc.

## Short-term vs Long-term Memory:
You can perform scatter-gather operations where you save short-term memories after each workflow step, and then gather relevant memories prior to the moving onto the next step. 
Leverage short-term memories when evaluating the results of a workflow step, and then use long-term memories to store the final results of your workflow.
You can collect memories in collections, and then use the 'queryContents' tool to retrieve the 'memory' contents by the collection. This will help you to keep track of your progress and avoid losing any important information.

If you have any trouble with this Graphlit MCP Server, join our [Discord](https://discord.gg/ygFmfjy3Qx) community for support.
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