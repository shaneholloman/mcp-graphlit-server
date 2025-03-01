#!/usr/bin/env node
import { Graphlit } from "graphlit-client";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ContentFilter, ContentTypes, FeedServiceTypes, EmailListingTypes, FeedListingTypes, FeedTypes } from "graphlit-client/dist/generated/graphql-types.js";

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
  "retrieve",
  `Retrieve content from Graphlit knowledge base.
   Accepts a search prompt and optional content type filter.
   Content types: Email, Event, File, Issue, Message, Page, Post, Text.
   Prompt should be optimized for vector search, via text embeddings. Rewrite prompt as appropriate for higher relevance to search results.
   Returns the content sources in XML format, including metadata and Markdown text.`,
  { 
    prompt: z.string(),
    contentType: z.nativeEnum(ContentTypes).optional()
  },
  async ({ prompt, contentType }) => {
    const client = new Graphlit();

    try {
      const filter: ContentFilter = { types: contentType ? [contentType] : null };

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

server.tool(
  "ingestGoogleEmail",
  `Ingests emails from Google Email account into knowledge base.
   Executes asynchonously and returns the feed identifier.`,
  { 
    readLimit: z.number().optional()
  },
  async ({ readLimit }) => {
    const client = new Graphlit();

    try {
      const refreshToken = process.env.GOOGLE_EMAIL_REFRESH_TOKEN;
      if (!refreshToken) {
        console.error("Please set GOOGLE_EMAIL_REFRESH_TOKEN environment variable.");
        process.exit(1);
      }

      const clientId = process.env.GOOGLE_EMAIL_CLIENT_ID;
      if (!clientId) {
        console.error("Please set GOOGLE_EMAIL_CLIENT_ID environment variable.");
        process.exit(1);
      }

      const clientSecret = process.env.GOOGLE_EMAIL_CLIENT_SECRET;
      if (!clientSecret) {
        console.error("Please set GOOGLE_EMAIL_CLIENT_SECRET environment variable.");
        process.exit(1);
      }

      const response = await client.createFeed({
        name: `Google Email`,
        type: FeedTypes.Email,
        email: {
          type: FeedServiceTypes.GoogleEmail,
          google: {
            type: EmailListingTypes.Past,
            refreshToken: refreshToken,
            clientId: clientId,
            clientSecret: clientSecret,
          },
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

server.tool(
  "ingestLinearIssues",
  `Ingests issues from Linear project into knowledge base.
  Accepts Linear project name.
   Executes asynchonously and returns the feed identifier.`,
  { 
    projectName: z.string(),
    readLimit: z.number().optional()
  },
  async ({ projectName, readLimit }) => {
    const client = new Graphlit();

    try {
      const apiKey = process.env.LINEAR_API_KEY;
      if (!apiKey) {
        console.error("Please set LINEAR_API_KEY environment variable.");
        process.exit(1);
      }

      const response = await client.createFeed({
        name: `Linear [${projectName}]`,
        type: FeedTypes.Issue,
        issue: {
          type: FeedServiceTypes.Linear,
          linear: {
            project: projectName,
            key: apiKey
          },
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

server.tool(
  "ingestGitHubIssues",
  `Ingests issues from GitHub repository into knowledge base.
   Accepts GitHub repository owner and repository name.
   For example, for GitHub repository (https://github.com/openai/tiktoken), 'openai' is the repository owner, and 'tiktoken' is the repository name.
   Executes asynchonously and returns the feed identifier.`,
  { 
    repositoryName: z.string(),
    repositoryOwner: z.string(),
    readLimit: z.number().optional()
  },
  async ({ repositoryName, repositoryOwner, readLimit }) => {
    const client = new Graphlit();

    try {
      const personalAccessToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      if (!personalAccessToken) {
        console.error("Please set GITHUB_PERSONAL_ACCESS_TOKEN environment variable.");
        process.exit(1);
      }

      const response = await client.createFeed({
        name: `GitHub [${repositoryOwner}/${repositoryName}]`,
        type: FeedTypes.Issue,
        issue: {
          type: FeedServiceTypes.GitHubIssues,
          github: {
            repositoryName: repositoryName,
            repositoryOwner: repositoryOwner,
            personalAccessToken: personalAccessToken
          },
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

server.tool(
  "webCrawl",
  `Crawls web pages from web site into knowledge base.
   Executes asynchonously and returns the feed identifier.`,
  { 
    url: z.string(),
    readLimit: z.number().optional()
  },
  async ({ url, readLimit }) => {
    const client = new Graphlit();

    try {
      const response = await client.createFeed({
        name: `Web [${url}]`,
        type: FeedTypes.Web,
        web: {
          uri: url,
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