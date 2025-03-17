[![npm version](https://badge.fury.io/js/graphlit-mcp-server.svg)](https://badge.fury.io/js/graphlit-mcp-server)
[![smithery badge](https://smithery.ai/badge/@graphlit/graphlit-mcp-server)](https://smithery.ai/server/@graphlit/graphlit-mcp-server)

# Model Context Protocol (MCP) Server for Graphlit Platform

## Overview

The Model Context Protocol (MCP) Server enables integration between MCP clients and the Graphlit service. This document outlines the setup process and provides a basic example of using the client.

Ingest anything from Slack, Discord, websites, Google Drive, email, Jira, Linear or GitHub into a Graphlit project - and then search and retrieve relevant knowledge within an MCP client like Cursor, Windsurf or Cline.

Documents (PDF, DOCX, PPTX, etc.) and HTML web pages will be extracted to Markdown upon ingestion. 

Audio and video files will be transcribed upon ingestion.

Web crawling and web search are available as MCP tools, with no need to integrate Firecrawl, Exa, etc. separately.

You can read more about the MCP Server use cases and features on our [blog](https://www.graphlit.com/blog/graphlit-mcp-server).

<a href="https://glama.ai/mcp/servers/fscrivteod">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/fscrivteod/badge" alt="graphlit-mcp-server MCP server" />
</a>

## Tools

### Retrieval

- Query Contents
- Query Collections
- Retrieve Relevant Sources
- Retrieve Similar Images
- Visually Describe Image

### Extraction

- Extract Structured JSON from Text

### Ingestion

- Files
- Web Pages
- Text

### Data Connectors
- Microsoft Outlook email
- Google Mail
- Notion
- Reddit
- Linear
- Jira
- GitHub Issues
- Google Drive
- OneDrive
- SharePoint
- Dropbox
- Box
- GitHub
- Slack
- Microsoft Teams
- Discord
- Podcasts (RSS)

### Web
- Web Crawling
- Web Search (including Podcast Search)
- Web Mapping
- Screenshot Page

### Notifications
- Slack
- Email
- Webhook

### Operations

- Configure Project
- Create Collection
- Add Contents to Collection
- Remove Contents from Collection
- Delete Collection
- Delete Feed(s)
- Delete Content(s)
- Is Feed Done?
- Is Content Done?

### Enumerations

- List Slack Channels
- List Microsoft Teams Teams
- List Microsoft Teams Channels
- List SharePoint Libraries
- List SharePoint Folders
- List Linear Projects

## Resources

- Project
- Contents
- Feeds
- Collections (of Content)
- Workflows
- Specifications

## Prerequisites

Before you begin, ensure you have the following:

- Node.js installed on your system (recommended version 18.x or higher).
- An active account on the [Graphlit Platform](https://portal.graphlit.dev) with access to the API settings dashboard.

## Installation

### Installing via Smithery

To install graphlit-mcp-server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@graphlit/graphlit-mcp-server):

```bash
npx -y @smithery/cli install @graphlit/graphlit-mcp-server --client claude
```

### Installing manually for Claude Desktop
To use the Graphlit MCP Server in Claude Desktop application, use:

```
{
    "mcpServers": {
        "graphlit-mcp-server": {
            "command": "npx",
            "args": [
                "-y",
                "graphlit-mcp-server"
            ],
            "env": {
                "GRAPHLIT_ORGANIZATION_ID": "your-organization-id",
                "GRAPHLIT_ENVIRONMENT_ID": "your-environment-id",
                "GRAPHLIT_JWT_SECRET": "your-jwt-secret",
            }
        }
    }
}
```

Optionally, you can configure the credentials for data connectors, such as Slack, Google Email and Notion.

```
{
    "mcpServers": {
        "graphlit-mcp-server": {
            "command": "npx",
            "args": [
                "-y",
                "graphlit-mcp-server"
            ],
            "env": {
                "GRAPHLIT_ORGANIZATION_ID": "your-organization-id",
                "GRAPHLIT_ENVIRONMENT_ID": "your-environment-id",
                "GRAPHLIT_JWT_SECRET": "your-jwt-secret",
                "SLACK_BOT_TOKEN": "your-slack-bot-token",
                "DISCORD_BOT_TOKEN": "your-discord-bot-token",
                "GOOGLE_EMAIL_REFRESH_TOKEN": "your-google-refresh-token",
                "GOOGLE_EMAIL_CLIENT_ID": "your-google-client-id",
                "GOOGLE_EMAIL_CLIENT_SECRET": "your-google-client-secret",
                "LINEAR_API_KEY": "your-linear-api-key",
                "GITHUB_PERSONAL_ACCESS_TOKEN": "your-github-pat",
                "JIRA_EMAIL": "your-jira-email",
                "JIRA_TOKEN": "your-jira-token",
                "NOTION_API_KEY": "your-notion-api-key",
                "NOTION_DATABASE_ID": "your-notion-database-id"
            }
        }
    }
}
```

### Installing manually via terminal
To install the Graphlit MCP Server, use npx:

```bash
npx install graphlit-mcp-server
```


## Configuration

The Graphlit MCP Server supports environment variables to be set for authentication and configuration:

- `GRAPHLIT_ENVIRONMENT_ID`: Your environment ID.
- `GRAPHLIT_ORGANIZATION_ID`: Your organization ID.
- `GRAPHLIT_JWT_SECRET`: Your JWT secret for signing the JWT token.

You can find these values in the API settings dashboard on the [Graphlit Platform](https://portal.graphlit.dev).

## Support

Please refer to the [Graphlit API Documentation](https://docs.graphlit.dev/).

For support with the Graphlit MCP Server, please submit a [GitHub Issue](https://github.com/graphlit/graphlit-mcp-server/issues).  

For further support with the Graphlit Platform, please join our [Discord](https://discord.gg/ygFmfjy3Qx) community.