#!/usr/bin/env node
import { Graphlit } from "graphlit-client";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import dotenv from "dotenv";
import { ContentFilter, ContentTypes, FeedListingTypes, FeedTypes } from "graphlit-client/dist/generated/graphql-types.js";

dotenv.config({ path: '.env.local' });

const server = new McpServer({
  name: "Graphlit MCP Server",
  version: "1.0.0"
});

function formatResultsToXML(results: Array<Record<string, any>>): string {
  const xmlParts: string[] = [];
  xmlParts.push('<results>');

  results.forEach((result) => {
    let attributes = '';
    Object.keys(result).forEach((key) => {
      if (key === 'metadata') return;
      if (key === 'text') return;
      if (key === 'content' || key === '__typename') return;
      if (result[key] === null) return;
      const kebabKey = key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
      attributes += ` ${kebabKey}="${result[key]}"`;
    });
    const metadata = result.metadata || '';
    const text = result.text || '';
    xmlParts.push(`  <result${attributes}>\n${metadata}\n${text}\n</result>`);
  });
  
  xmlParts.push('</results>');
  
  return xmlParts.join('\n');
}

server.tool(
  "retrieveSlackMessages",
  `Retrieve Slack messages from Graphlit knowledge base.
   Accepts a search prompt and returns the messages in XML format.
   Prompt should be optimized for vector search, via text embeddings. Rewrite prompt as appropriate for higher relevance to search results.`,
  { 
    prompt: z.string()
  },
  async ({ prompt }) => {
    const client = new Graphlit();

    try {
      // TODO: should be able to filter by FeedTypes.Slack
      const filter: ContentFilter = { types: [ ContentTypes.Message ] };

      const response = await client.retrieveSources(prompt, filter);
      
      const results = response.retrieveSources?.results || [];
      const xml = formatResultsToXML(results.filter(result => result !== null));
      
      return {
        content: [{
          type: "text",
          text: xml
        }]
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        content: [{
          type: "text",
          text: `Error: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

server.tool(
  "ingestSlack",
  `Ingests messages from Slack channel into Graphlit knowledge base.
    Accepts Slack channel name.
    Executes asynchonously and returns the feed identifier.`,
  { 
    channelName: z.string(),
    readLimit: z.number().optional()
  },
  async ({ channelName, readLimit }) => {
    const client = new Graphlit();

    try {
      const botToken = process.env.SLACK_BOT_TOKEN;
      if (!botToken) {
        console.error("Please set SLACK_BOT_TOKEN environment variable.");
        process.exit(1);
      }

      const response = await client.createFeed({
        name: `Slack [${channelName}]`,
        type: FeedTypes.Slack,
        slack: {
          type: FeedListingTypes.Past,
          channel: channelName,
          token: botToken,
          includeAttachments: true,
          readLimit: readLimit || 100
        }
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ id: response.createFeed?.id }, null, 2)
        }]
      };
      
    } catch (err: unknown) {
      const error = err as Error;
      return {
        content: [{
          type: "text",
          text: `Error: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

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