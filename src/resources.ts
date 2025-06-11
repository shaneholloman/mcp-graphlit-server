import { Graphlit } from "graphlit-client";
import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ContentTypes,
  ContentFilter,
  ConversationFilter,
  EntityState,
  GetContentQuery,
  GetConversationQuery,
} from "graphlit-client/dist/generated/graphql-types";

export function registerResources(server: McpServer) {
  server.resource(
    "Conversations list: Returns list of conversation resources.",
    new ResourceTemplate("conversations://", {
      list: async (extra) => {
        const client = new Graphlit();

        const filter: ConversationFilter = {};

        try {
          const response = await client.queryConversations(filter);

          return {
            resources: (response.conversations?.results || [])
              .filter((content) => content !== null)
              .map((conversation) => ({
                name: conversation.name,
                uri: `conversations://${conversation.id}`,
                mimeType: "text/markdown",
              })),
          };
        } catch (error) {
          console.error("Error fetching conversation list:", error);
          return { resources: [] };
        }
      },
    }),
    async (uri, variables) => {
      return {
        contents: [],
      };
    }
  );

  server.resource(
    "Conversation: Returns LLM conversation messages. Accepts conversation resource URI, i.e. conversations://{id}, where 'id' is a conversation identifier.",
    new ResourceTemplate("conversations://{id}", { list: undefined }),
    async (uri: URL, variables) => {
      const id = variables.id as string;
      const client = new Graphlit();

      try {
        const response = await client.getConversation(id);

        const content = response.conversation;

        return {
          contents: [
            {
              uri: uri.toString(),
              text: formatConversation(response),
              mimeType: "text/markdown",
            },
          ],
        };
      } catch (error) {
        console.error("Error fetching conversation:", error);
        return {
          contents: [],
        };
      }
    }
  );

  server.resource(
    "Feeds: Returns list of feed resources.",
    new ResourceTemplate("feeds://", {
      list: async (extra) => {
        const client = new Graphlit();

        try {
          const response = await client.queryFeeds();

          return {
            resources: (response.feeds?.results || [])
              .filter((feed) => feed !== null)
              .map((feed) => ({
                name: feed.name,
                uri: `feeds://${feed.id}`,
              })),
          };
        } catch (error) {
          console.error("Error fetching feed list:", error);
          return { resources: [] };
        }
      },
    }),
    async (uri, variables) => {
      return {
        contents: [],
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
              text: JSON.stringify(
                {
                  id: response.feed?.id,
                  name: response.feed?.name,
                  type: response.feed?.type,
                  readCount: response.feed?.readCount,
                  creationDate: response.feed?.creationDate,
                  lastReadDate: response.feed?.lastReadDate,
                  state: response.feed?.state,
                  error: response.feed?.error,
                },
                null,
                2
              ),
              mimeType: "application/json",
            },
          ],
        };
      } catch (error) {
        console.error("Error fetching feed:", error);
        return {
          contents: [],
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
              .filter((collection) => collection !== null)
              .map((collection) => ({
                name: collection.name,
                uri: `collections://${collection.id}`,
              })),
          };
        } catch (error) {
          console.error("Error fetching collection list:", error);
          return { resources: [] };
        }
      },
    }),
    async (uri, variables) => {
      return {
        contents: [],
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
              text: JSON.stringify(
                {
                  id: response.collection?.id,
                  name: response.collection?.name,
                  contents: (response.collection?.contents || [])
                    .filter((content) => content !== null)
                    .map((content) => `contents://${content.id}`),
                },
                null,
                2
              ),
              mimeType: "application/json",
            },
          ],
        };
      } catch (error) {
        console.error("Error fetching collection:", error);
        return {
          contents: [],
        };
      }
    }
  );

  server.resource(
    "Contents list: Returns list of content resources.",
    new ResourceTemplate("contents://", {
      list: async (extra) => {
        const client = new Graphlit();

        const filter: ContentFilter = {
          states: [EntityState.Finished], // filter on finished contents only
        };

        try {
          const response = await client.queryContents(filter);

          return {
            resources: (response.contents?.results || [])
              .filter((content) => content !== null)
              .map((content) => ({
                name: content.name,
                description: content.description || "",
                uri: `contents://${content.id}`,
                mimeType: content.mimeType || "text/markdown",
              })),
          };
        } catch (error) {
          console.error("Error fetching content list:", error);
          return { resources: [] };
        }
      },
    }),
    async (uri, variables) => {
      return {
        contents: [],
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

        const content = response.content;

        return {
          contents: [
            {
              uri: uri.toString(),
              text: formatContent(response),
              mimeType: "text/markdown",
            },
          ],
        };
      } catch (error) {
        console.error("Error fetching content:", error);
        return {
          contents: [],
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
              .filter((workflow) => workflow !== null)
              .map((workflow) => ({
                name: workflow.name,
                uri: `workflows://${workflow.id}`,
              })),
          };
        } catch (error) {
          console.error("Error fetching workflow list:", error);
          return { resources: [] };
        }
      },
    }),
    async (uri, variables) => {
      return {
        contents: [],
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
              text: JSON.stringify(response.workflow, null, 2),
              mimeType: "application/json",
            },
          ],
        };
      } catch (error) {
        console.error("Error fetching workflow:", error);
        return {
          contents: [],
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
              .filter((specification) => specification !== null)
              .map((specification) => ({
                name: specification.name,
                uri: `specifications://${specification.id}`,
              })),
          };
        } catch (error) {
          console.error("Error fetching specification list:", error);
          return { resources: [] };
        }
      },
    }),
    async (uri, variables) => {
      return {
        contents: [],
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
              text: JSON.stringify(response.specification, null, 2),
              mimeType: "application/json",
            },
          ],
        };
      } catch (error) {
        console.error("Error fetching specification:", error);
        return {
          contents: [],
        };
      }
    }
  );

  server.resource(
    "Project: Returns current Graphlit project metadata including credits and LLM tokens used in the last day, available quota, and default content workflow. Accepts project resource URI, i.e. projects://{id}, where 'id' is a project identifier.",
    new ResourceTemplate("projects://", { list: undefined }),
    async (uri: URL, variables) => {
      const id = variables.id as string;
      const client = new Graphlit();

      try {
        const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
        const duration = "P1D"; // ISO duration for 1 day

        const cresponse = await client.queryProjectCredits(
          startDate.toISOString(),
          duration
        );
        const credits = cresponse?.credits;

        const tresponse = await client.queryProjectTokens(
          startDate.toISOString(),
          duration
        );
        const tokens = tresponse?.tokens;

        const response = await client.getProject();

        return {
          contents: [
            {
              uri: uri.toString(),
              text: JSON.stringify(
                {
                  name: response.project?.name,
                  workflow: response.project?.workflow,
                  quota: response.project?.quota,
                  credits: credits,
                  tokens: tokens,
                },
                null,
                2
              ),
              mimeType: "application/json",
            },
          ],
        };
      } catch (error) {
        console.error("Error fetching project:", error);
        return {
          contents: [],
        };
      }
    }
  );
}

function formatConversation(response: GetConversationQuery): string {
  const results: string[] = [];

  const conversation = response.conversation;

  if (!conversation) {
    return "";
  }

  // Basic conversation details
  results.push(`**Conversation ID:** ${conversation.id}`);

  // Messages
  if (conversation.messages?.length) {
    conversation.messages.forEach((message) => {
      results.push(`${message?.role}:\n${message?.message}` || "");

      if (message?.citations?.length) {
        message.citations.forEach((citation) => {
          results.push(
            `**Cited Source [${citation?.index}]**: contents://${citation?.content?.id}`
          );
          results.push(`**Cited Text**:\n${citation?.text || ""}`);
        });
      }

      results.push("\n---\n");
    });
  }

  return results.join("\n");
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
    if (
      content.type !== ContentTypes.Page &&
      content.type !== ContentTypes.Email
    ) {
      results.push(`**Name:** ${content.name}`);
    }
  }

  // Optional metadata

  //
  // REVIEW: Not sure if source URI is useful for MCP client
  //
  //if (content.uri) results.push(`**URI:** ${content.uri}`);

  if (content.masterUri)
    results.push(`**Downloadable Original:** ${content.masterUri}`);
  if (content.imageUri)
    results.push(`**Downloadable Image:** ${content.imageUri}`);
  if (content.audioUri)
    results.push(`**Downloadable Audio:** ${content.audioUri}`);

  if (content.creationDate)
    results.push(`**Ingestion Date:** ${content.creationDate}`);
  if (content.originalDate)
    results.push(`**Author Date:** ${content.originalDate}`);

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
    results.push(
      ...issueAttributes
        .filter(([_, value]) => value)
        .map(([label, value]) => `**${label}:** ${value}`)
    );

    if (issue.labels?.length) {
      results.push(`**Labels:** ${issue.labels.join(", ")}`);
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
      ["Labels", email.labels?.join(", ")],
      ["To", email.to?.map(formatRecipient).join(", ")],
      ["From", email.from?.map(formatRecipient).join(", ")],
      ["CC", email.cc?.map(formatRecipient).join(", ")],
      ["BCC", email.bcc?.map(formatRecipient).join(", ")],
    ];
    results.push(
      ...emailAttributes
        .filter(([_, value]) => value)
        .map(([label, value]) => `**${label}:** ${value}`)
    );
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
    if (image.description)
      results.push(`**Description:** ${image.description}`);
    if (image.software) results.push(`**Software:** ${image.software}`);
    if (image.make) results.push(`**Make:** ${image.make}`);
    if (image.model) results.push(`**Model:** ${image.model}`);
  }

  // Collections
  if (content.collections) {
    results.push(
      ...content.collections
        .filter((collection) => collection !== null)
        .slice(0, 100)
        .map(
          (collection) =>
            `**Collection [${collection.name}]:** collections://${collection.id}`
        )
    );
  }

  // Parent Content
  if (content.parent) {
    results.push(`**Parent Content:** contents://${content.parent.id}`);
  }

  // Child Content(s)
  if (content.children) {
    results.push(
      ...content.children
        .filter((child) => child !== null)
        .slice(0, 100)
        .map((child) => `**Child Content:** contents://${child.id}`)
    );
  }

  // Links
  if (content.links && content.type === ContentTypes.Page) {
    results.push(
      ...content.links
        .slice(0, 1000)
        .map((link) => `**${link.linkType} Link:** ${link.uri}`)
    );
  }

  // Observations
  if (content.observations) {
    results.push(
      ...content.observations
        .filter((observation) => observation !== null)
        .filter((observation) => observation.observable !== null)
        .slice(0, 100)
        .map(
          (observation) =>
            `**${observation.type}:** ${observation.type.toLowerCase()}s://${observation.observable.id}`
        )
    );
  }

  // Content
  if (content.pages?.length) {
    content.pages.forEach((page) => {
      if (page.chunks?.length) {
        results.push(`**Page #${(page.index || 0) + 1}:**`);
        results.push(
          ...(page.chunks
            ?.filter((chunk) => chunk?.text)
            .map((chunk) => chunk?.text || "") || [])
        );
        results.push("\n---\n");
      }
    });
  }

  if (content.segments?.length) {
    content.segments.forEach((segment) => {
      results.push(
        `**Transcript Segment [${segment.startTime}-${segment.endTime}]:**`
      );
      results.push(segment.text || "");
      results.push("\n---\n");
    });
  }

  if (content.frames?.length) {
    content.frames.forEach((frame) => {
      results.push(`**Frame #${(frame.index || 0) + 1}:**`);
      results.push(frame.text || "");
      results.push("\n---\n");
    });
  }

  if (
    !content.pages?.length &&
    !content.segments?.length &&
    !content.frames?.length &&
    content.markdown
  ) {
    results.push(content.markdown);
    results.push("\n");
  }

  return results.join("\n");
}
