import { Graphlit } from "graphlit-client";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { 
    ContentTypes, 
    FileTypes, 
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
        "Content: Returns content metadata and complete Markdown text or Base64-encoded image data. Accepts content resource URI, i.e. contents://{id}, where 'id' is a content identifier.",
        new ResourceTemplate("contents://{id}", { list: undefined }),
        async (uri: URL, variables) => {
          const id = variables.id as string;
          const client = new Graphlit();
          
          try {
            const response = await client.getContent(id);

            if (response.content?.fileType == FileTypes.Image) {
              const imageUri = response.content?.uri;
        
              if (imageUri) {
                const fetchResponse = await fetch(imageUri);
                if (!fetchResponse.ok) {
                    throw new Error(`Failed to fetch image from ${imageUri}: ${fetchResponse.statusText}`);
                }
  
                const arrayBuffer = await fetchResponse.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
        
                const data = buffer.toString('base64');
                const mimeType = fetchResponse.headers.get('content-type') || 'application/octet-stream';
  
                return {
                  contents: [
                    {
                      uri: uri.toString(),
                      text: formatContent(response),
                      mimeType: 'text/markdown'
                    },
                    {
                      uri: uri.toString(),
                      blob: data,
                      mimeType: mimeType
                    }
                  ]
                };
              }
              else {
                return {
                  contents: [
                    {
                      uri: uri.toString(),
                      text: formatContent(response),
                      mimeType: 'text/markdown'
                    }
                  ]
                };
              }
              }
              else {
                return {
                  contents: [
                    {
                      uri: uri.toString(),
                      text: formatContent(response),
                      mimeType: 'text/markdown'
                    }
                  ]
                };    
              }
          } catch (error) {
            console.error("Error fetching content:", error);
            return {
              contents: []
            };
          }
        }
      );

      server.resource(
        "Workflows: Returns list of workflow resources.",
        new ResourceTemplate("workflows://", {
          list: async (extra) => {
            const client = new Graphlit();
            
            try {
              const response = await client.queryWorkflows();
              
              return {
                resources: (response.workflows?.results || [])
                  .filter(workflow => workflow !== null)
                  .map(workflow => ({
                    name: workflow.name,
                    uri: `workflows://${workflow.id}`
                  }))
              };
            } catch (error) {
              console.error("Error fetching workflow list:", error);
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
        "Workflow: Returns workflow metadata. Accepts workflow resource URI, i.e. workflows://{id}, where 'id' is a workflow identifier.",
        new ResourceTemplate("workflows://{id}", { list: undefined }),
        async (uri: URL, variables) => {
          const id = variables.id as string;
          const client = new Graphlit();
          
          try {
            const response = await client.getWorkflow(id);
            return {
              contents: [
                {
                  uri: uri.toString(),
                  text: JSON.stringify({
                    id: response.workflow?.id,
                    name: response.workflow?.name
                  }, null, 2),
                  mimeType: 'application/json'
                }
              ]
            };
          } catch (error) {
            console.error("Error fetching workflow:", error);
            return {
              contents: []
            };
          }
        }
      );

      server.resource(
        "Specifications: Returns list of specification resources.",
        new ResourceTemplate("specifications://", {
          list: async (extra) => {
            const client = new Graphlit();
            
            try {
              const response = await client.querySpecifications();
              
              return {
                resources: (response.specifications?.results || [])
                  .filter(specification => specification !== null)
                  .map(specification => ({
                    name: specification.name,
                    uri: `specifications://${specification.id}`
                  }))
              };
            } catch (error) {
              console.error("Error fetching specification list:", error);
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
        "Specification: Returns specification metadata. Accepts specification resource URI, i.e. specifications://{id}, where 'id' is a specification identifier.",
        new ResourceTemplate("specifications://{id}", { list: undefined }),
        async (uri: URL, variables) => {
          const id = variables.id as string;
          const client = new Graphlit();
          
          try {
            const response = await client.getSpecification(id);
            return {
              contents: [
                {
                  uri: uri.toString(),
                  text: JSON.stringify({
                    id: response.specification?.id,
                    name: response.specification?.name
                  }, null, 2),
                  mimeType: 'application/json'
                }
              ]
            };
          } catch (error) {
            console.error("Error fetching specification:", error);
            return {
              contents: []
            };
          }
        }
      );

      server.resource(
        "Projects: Returns list of project resources.",
        new ResourceTemplate("projects://", {
          list: async (extra) => {
            const client = new Graphlit();
            
            try {
              // NOTE: only ever one project
              const response = await client.getProject();
              const project = response.project;

              return {
                resources: project !== undefined && project !== null ? [
                  {
                    name: project.name,
                    uri: `projects://${project.id}`
                  }
                ] : []
              };
            } catch (error) {
              console.error("Error fetching project:", error);
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
        "Project: Returns project metadata including credits used, available quota, and default content workflow. Accepts project resource URI, i.e. projects://{id}, where 'id' is a project identifier.",
        new ResourceTemplate("projects://{id}", { list: undefined }),
        async (uri: URL, variables) => {
          const id = variables.id as string;
          const client = new Graphlit();
          
          try {
            const response = await client.getProject();
            return {
              contents: [
                {
                  uri: uri.toString(),
                  text: JSON.stringify({
                    id: response.project?.id,
                    name: response.project?.name,
                    credits: response.project?.credits,
                    workflow: response.project?.workflow,
                    quota: response.project?.quota
                  }, null, 2),
                  mimeType: 'application/json'
                }
              ]
            };
          } catch (error) {
            console.error("Error fetching project:", error);
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

  if (content.imageUri) results.push(`**Image URI:** ${content.imageUri}`);
  if (content.audioUri) results.push(`**Audio URI:** ${content.audioUri}`);

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
