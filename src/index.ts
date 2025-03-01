#!/usr/bin/env node
import { Graphlit } from "graphlit-client";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ContentFilter, ContentTypes, FeedServiceTypes, EmailListingTypes, SearchServiceTypes, FeedListingTypes, FeedTypes, NotionTypes, GetContentQuery, RerankingModelServiceTypes, RetrievalStrategyTypes } from "graphlit-client/dist/generated/graphql-types.js";

const server = new McpServer({
  name: "Graphlit MCP Server",
  version: "1.0.0"
});

server.tool(
  "retrieve",
  `Retrieve content from Graphlit knowledge base.
   Accepts a search prompt, optional recency filter (defaults to last 30 days), and optional content type filter.
   Content types: Email, Event, File, Issue, Message, Page, Post, Text.
   Format for 'inLast' should be ISO 8601: for example, 'PT1H' for last hour, 'P1D' for last day, 'P7D' for last week, 'P30D' for last month. Doesn't support weeks or months explicitly.
   Prompt should be optimized for vector search, via text embeddings. Rewrite prompt as appropriate for higher relevance to search results.
   Returns the content sources in XML format, including metadata and Markdown text.`,
  { 
    prompt: z.string(),
    inLast: z.string().optional().default("P30D"),
    contentType: z.nativeEnum(ContentTypes).optional()
  },
  async ({ prompt, contentType, inLast }) => {
    const client = new Graphlit();

    try {
      const filter: ContentFilter = { inLast: inLast, types: contentType ? [contentType] : null };

      const response = await client.retrieveSources(prompt, filter, undefined, { type: RetrievalStrategyTypes.Section }, { serviceType: RerankingModelServiceTypes.Cohere });
      
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
  "ingestNotion",
  `Ingests pages from Notion database into Graphlit knowledge base.
    Accepts an optional read limit for the number of messages to ingest.
    Executes asynchonously and returns the feed identifier.`,
  { 
    readLimit: z.number().optional()
  },
  async ({ readLimit }) => {
    const client = new Graphlit();

    try {
      const token = process.env.NOTION_API_KEY;
      if (!token) {
        console.error("Please set NOTION_API_KEY environment variable.");
        process.exit(1);
      }

      const databaseId = process.env.NOTION_DATABASE_ID;
      if (!databaseId) {
        console.error("Please set NOTION_DATABASE_ID environment variable.");
        process.exit(1);
      }

      const response = await client.createFeed({
        name: `Notion`,
        type: FeedTypes.Notion,
        notion: {
          type: NotionTypes.Database,
          identifiers: [databaseId],
          token: token,
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
  "ingestSlack",
  `Ingests messages from Slack channel into Graphlit knowledge base.
    Accepts Slack channel name and an optional read limit for the number of messages to ingest.
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
  "ingestDiscord",
  `Ingests messages from Discord channel into Graphlit knowledge base.
    Accepts Discord channel name and an optional read limit for the number of messages to ingest.
    Executes asynchonously and returns the feed identifier.`,
  { 
    channelName: z.string(),
    readLimit: z.number().optional()
  },
  async ({ channelName, readLimit }) => {
    const client = new Graphlit();

    try {
      const botToken = process.env.DISCORD_BOT_TOKEN;
      if (!botToken) {
        console.error("Please set DISCORD_BOT_TOKEN environment variable.");
        process.exit(1);
      }

      const response = await client.createFeed({
        name: `Discord [${channelName}]`,
        type: FeedTypes.Discord,
        discord: {
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
  "ingestReddit",
  `Ingests posts from Reddit subreddit into Graphlit knowledge base.
    Accepts a subreddit name and an optional read limit for the number of posts to ingest.
    Executes asynchonously and returns the feed identifier.`,
  { 
    subredditName: z.string(),
    readLimit: z.number().optional()
  },
  async ({ subredditName, readLimit }) => {
    const client = new Graphlit();

    try {
      const response = await client.createFeed({
        name: `Reddit [${subredditName}]`,
        type: FeedTypes.Reddit,
        reddit: {
          subredditName: subredditName,
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
  `Ingests emails from Google Email account into Graphlit knowledge base.
   Accepts an optional read limit for the number of emails to ingest.
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
  `Ingests issues from Linear project into Graphlit knowledge base.
   Accepts Linear project name and an optional read limit for the number of issues to ingest.
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
  `Ingests issues from GitHub repository into Graphlit knowledge base.
   Accepts GitHub repository owner and repository name and an optional read limit for the number of issues to ingest.
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
  `Crawls web pages from web site into Graphlit knowledge base.
   Accepts a URL and an optional read limit for the number of pages to crawl.
   Uses sitemap.xml to discover pages to be crawled from website.
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

server.tool(
  "webScrape",
  `Scrapes web page into Graphlit knowledge base.
   Returns Markdown text and metadata extracted from web page.`,
  { 
    url: z.string()
  },
  async ({ url }) => {
    const client = new Graphlit();

    try {
      const response = await client.ingestUri(url, undefined, undefined, true);

      const id = response.ingestUri?.id;

      if (id === undefined) {
        return {
          content: [{
            type: "text",
            text: "Error: Unable to scrape web page."
          }],
          isError: true
        };
      }

      const cresponse = await client.getContent(id);

      return {
        content: [{
          type: "text",
          text: formatContent(cresponse)
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
  "webMap",
  `Enumerates the web pages at or beneath the provided URL using web sitemap.
   Accepts web page URL as string.
   Returns list of mapped URIs from web site.`,
  { 
    url: z.string()
  },
  async ({ url }) => {
    const client = new Graphlit();

    try {
      const response = await client.mapWeb(url);

      return {
        content: [{
          type: "text",
          text: JSON.stringify(response.mapWeb?.results, null, 2)
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
  "webSearch",
  `Performs web search based on search query. Format the search query as what would be entered into a Google search.
   Accepts search query as string, and optional search service type.
   Search service types: Tavily, Exa. Defaults to Tavily.
   Returns URL, title and relevant Markdown text from resulting web pages.`,
  { 
    search: z.string(),
    searchService: z.nativeEnum(SearchServiceTypes).optional().default(SearchServiceTypes.Tavily)
  },
  async ({ search, searchService }) => {
    const client = new Graphlit();

    try {
      const response = await client.searchWeb(search, searchService);

      return {
        content: [{
          type: "text",
          text: JSON.stringify(response.searchWeb?.results, null, 2)
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
  "ingestRSS",
  `Ingests posts from RSS feed into Graphlit knowledge base.
   For podcast RSS feeds, audio will be downloaded, transcribed and ingested into Graphlit knowledge base.
   Accepts RSS URL and an optional read limit for the number of posts to read.
   Executes asynchonously and returns the feed identifier.`,
  { 
    url: z.string(),
    readLimit: z.number().optional()
  },
  async ({ url, readLimit }) => {
    const client = new Graphlit();

    try {
      const response = await client.createFeed({
        name: `RSS [${url}]`,
        type: FeedTypes.Rss,
        rss: {
          uri: url,
          readLimit: readLimit || 10
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
  "ingestUrl",
  `Ingests content from URL into Graphlit knowledge base.
   Can ingest individual Word documents, PDFs, audio recordings, videos, images, or any other unstructured data.
   Executes asynchonously and returns the content identifier.`,
  { 
    url: z.string()
  },
  async ({ url }) => {
    const client = new Graphlit();

    try {
      const response = await client.ingestUri(url);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ id: response.ingestUri?.id }, null, 2)
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

function formatContent(response: GetContentQuery): string {
  const results: string[] = [];

  const content = response.content;

  if (!content) {
    return "";
  }

  // Basic content details
  results.push(`**Content ID:** ${content.id}`);

  if (content.type === ContentTypes.File) {
    results.push(`**File Type:** [${content.fileType}]`);
    results.push(`**File Name:** ${content.fileName}`);
  } else {
    results.push(`**Type:** [${content.type}]`);
    if (content.type !== ContentTypes.Page && content.type !== ContentTypes.Email) {
      results.push(`**Name:** ${content.name}`);
    }
  }

  // Optional metadata
  if (content.uri) results.push(`**URI:** ${content.uri}`);
  if (content.creationDate) results.push(`**Ingestion Date:** ${content.creationDate}`);
  if (content.originalDate) results.push(`**Author Date:** ${content.originalDate}`);

  // Issue details
  if (content.issue) {
    const issue = content.issue;
    const issueAttributes = [
      ["Title", issue.title],
      ["Identifier", issue.identifier],
      ["Type", issue.type],
      ["Project", issue.project],
      ["Team", issue.team],
      ["Status", issue.status],
      ["Priority", issue.priority],
    ];
    results.push(...issueAttributes
      .filter(([_, value]) => value)
      .map(([label, value]) => `**${label}:** ${value}`));

    if (issue.labels?.length) {
      results.push(`**Labels:** ${issue.labels.join(', ')}`);
    }
  }

  // Email details
  if (content.email) {
    const email = content.email;
    const formatRecipient = (r: any) => `${r.name} <${r.email}>`;

    const emailAttributes = [
      ["Subject", email.subject],
      ["Sensitivity", email.sensitivity],
      ["Priority", email.priority],
      ["Importance", email.importance],
      ["Labels", email.labels?.join(', ')],
      ["To", email.to?.map(formatRecipient).join(', ')],
      ["From", email.from?.map(formatRecipient).join(', ')],
      ["CC", email.cc?.map(formatRecipient).join(', ')],
      ["BCC", email.bcc?.map(formatRecipient).join(', ')],
    ];
    results.push(...emailAttributes
      .filter(([_, value]) => value)
      .map(([label, value]) => `**${label}:** ${value}`));
  }

  // Document details
  if (content.document) {
    const doc = content.document;
    if (doc.title) results.push(`**Title:** ${doc.title}`);
    if (doc.author) results.push(`**Author:** ${doc.author}`);
  }

  // Audio details
  if (content.audio) {
    const audio = content.audio;
    if (audio.title) results.push(`**Title:** ${audio.title}`);
    if (audio.author) results.push(`**Host:** ${audio.author}`);
    if (audio.episode) results.push(`**Episode:** ${audio.episode}`);
    if (audio.series) results.push(`**Series:** ${audio.series}`);
  }

  // Image details
  if (content.image) {
    const image = content.image;
    if (image.description) results.push(`**Description:** ${image.description}`);
    if (image.software) results.push(`**Software:** ${image.software}`);
    if (image.make) results.push(`**Make:** ${image.make}`);
    if (image.model) results.push(`**Model:** ${image.model}`);
  }

  // Links
  if (content.links && content.type === ContentTypes.Page) {
    results.push(...content.links
      .slice(0, 100)
      .map(link => `**${link.linkType} Link:** ${link.uri}`));
  }

  // Content
  if (content.pages?.length) {
    content.pages.forEach(page => {
      if (page.chunks?.length) {
        results.push(`**Page #${(page.index || 0) + 1}:**`);
        results.push(...(page.chunks?.filter(chunk => chunk?.text).map(chunk => chunk?.text || '') || []));
        results.push("\n---\n");
      }
    });
  }

  if (content.segments?.length) {
    content.segments.forEach(segment => {
      results.push(`**Transcript Segment [${segment.startTime}-${segment.endTime}]:**`);
      results.push(segment.text || '');
      results.push("\n---\n");
    });
  }

  if (content.frames?.length) {
    content.frames.forEach(frame => {
      results.push(`**Frame #${(frame.index || 0) + 1}:**`);
      results.push(frame.text || '');
      results.push("\n---\n");
    });
  }

  if (!content.pages?.length && 
      !content.segments?.length && 
      !content.frames?.length && 
      content.markdown) {
    results.push(content.markdown);
    results.push("\n");
  }

  return results.join('\n');
}
