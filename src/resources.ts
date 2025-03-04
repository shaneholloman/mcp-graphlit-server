import { Graphlit } from "graphlit-client";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { 
    ContentTypes, 
    GetContentQuery, 
} from "graphlit-client/dist/generated/graphql-types.js";
  
export function registerResources(server: McpServer) {
    server.resource(
        "Feeds: Returns list of feed resources.",
        new ResourceTemplate("feeds://", {
          list: async (extra) => {
            const client = new Graphlit();
            
            try {
              const response = await client.queryFeeds();
              
              return {
                resources: (response.feeds?.results || [])
                  .filter(feed => feed !== null)
                  .map(feed => ({
                    name: feed.name,
                    uri: `feeds://${feed.id}`
                  }))
              };
            } catch (error) {
              console.error("Error fetching feed list:", error);
              return { resources: [] };
            }
          }
        }),
        async (uri, variables) => {
          return {
            contents: []
          };
        }
      );
      
      server.resource(
        "Feed: Returns feed metadata. Accepts content resource URI, i.e. feeds://{id}, where 'id' is a feed identifier.",
        new ResourceTemplate("feeds://{id}", { list: undefined }),
        async (uri: URL, variables) => {
          const id = variables.id as string;
          const client = new Graphlit();
          
          try {
            const response = await client.getFeed(id);
      
            return {
              contents: [
                {
                  uri: uri.toString(),
                  text: JSON.stringify({ 
                    id: response.feed?.id, 
                    name: response.feed?.name,
                    type: response.feed?.type,
                    readCount: response.feed?.readCount,
                    creationDate: response.feed?.creationDate,
                    lastReadDate: response.feed?.lastReadDate,
                    state: response.feed?.state,
                    error: response.feed?.error
                  }, null, 2),
                  mimeType: 'application/json'
                }
              ]
            };
          } catch (error) {
            console.error("Error fetching feed:", error);
            return {
              contents: []
            };
          }
        }
      );
      
      server.resource(
        "Collections: Returns list of collection resources.",
        new ResourceTemplate("collections://", {
          list: async (extra) => {
            const client = new Graphlit();
            
            try {
              const response = await client.queryCollections();
              
              return {
                resources: (response.collections?.results || [])
                  .filter(collection => collection !== null)
                  .map(collection => ({
                    name: collection.name,
                    uri: `collections://${collection.id}`
                  }))
              };
            } catch (error) {
              console.error("Error fetching collection list:", error);
              return { resources: [] };
            }
          }
        }),
        async (uri, variables) => {
          return {
            contents: []
          };
        }
      );
      
      server.resource(
        "Collection: Returns collection metadata and list of content resources. Accepts collection resource URI, i.e. collections://{id}, where 'id' is a collection identifier.",
        new ResourceTemplate("collections://{id}", { list: undefined }),
        async (uri: URL, variables) => {
          const id = variables.id as string;
          const client = new Graphlit();
          
          try {
            const response = await client.getCollection(id);
            return {
              contents: [
                {
                  uri: uri.toString(),
                  text: JSON.stringify({
                    id: response.collection?.id,
                    name: response.collection?.name,
                    contents: (response.collection?.contents || [])
                      .filter(content => content !== null)
                      .map(content => `contents://${content.id}`)
                  }, null, 2),
                  mimeType: 'application/json'
                }
              ]
            };
          } catch (error) {
            console.error("Error fetching collection:", error);
            return {
              contents: []
            };
          }
        }
      );
      
      server.resource(
        "Contents list: Returns list of content resources.",
        new ResourceTemplate("contents://", {
          list: async (extra) => {
            const client = new Graphlit();
            
            try {
              const response = await client.queryContents();
              
              return {
                resources: (response.contents?.results || [])
                  .filter(content => content !== null)
                  .map(content => ({
                    name: content.name,
                    description: content.description || '',
                    uri: `contents://${content.id}`,
                    mimeType: content.mimeType || 'text/markdown'
                  }))
              };
            } catch (error) {
              console.error("Error fetching content list:", error);
              return { resources: [] };
            }
          }
        }),
        async (uri, variables) => {
          return {
            contents: []
          };
        }
      );
      
      server.resource(
        "Content: Returns content metadata and complete Markdown text. Accepts content resource URI, i.e. contents://{id}, where 'id' is a content identifier.",
        new ResourceTemplate("contents://{id}", { list: undefined }),
        async (uri: URL, variables) => {
          const id = variables.id as string;
          const client = new Graphlit();
          
          try {
            const response = await client.getContent(id);
            return {
              contents: [
                {
                  uri: uri.toString(),
                  text: formatContent(response),
                  mimeType: 'text/markdown'
                }
              ]
            };
          } catch (error) {
            console.error("Error fetching content:", error);
            return {
              contents: []
            };
          }
        }
      );
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
