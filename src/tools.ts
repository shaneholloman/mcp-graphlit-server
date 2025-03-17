import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import { Graphlit, Types } from "graphlit-client";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { 
  CollectionFilter,
  ContentFilter, 
  ContentTypes, 
  FeedFilter,
  FeedServiceTypes, 
  EmailListingTypes, 
  SearchServiceTypes, 
  FeedListingTypes, 
  FeedTypes, 
  NotionTypes,
  RerankingModelServiceTypes, 
  RetrievalStrategyTypes, 
  SharePointAuthenticationTypes, 
  FileTypes,
  TextTypes,
  SearchTypes,
  ContentPublishingServiceTypes,
  ContentPublishingFormats,
  ElevenLabsModels,
  IntegrationServiceTypes
} from "graphlit-client/dist/generated/graphql-types.js";

export function registerTools(server: McpServer) {
    server.tool(
    "configureProject",
    `Configures the default content workflow for the Graphlit project. Only needed if user asks to configure the default workflow.
    Accepts whether to enable high-quality document preparation using a vision LLM. Defaults to using Azure AI Document Intelligence for document preparation, if not assigned.
    Accepts whether to enable entity extraction using LLM into the knowledge graph.
    Optionally accepts the preferred model provider service type, i.e. Anthropic, OpenAI, Google. Defaults to Anthropic if not provided.
    Returns the project identifier.`,
    { 
        enablePreparation: z.boolean().describe("Whether to enable high-quality document preparation using vision LLM."),
        enableExtraction: z.boolean().describe("Whether to enable entity extraction using LLM into the knowledge graph."),
        serviceType: z.nativeEnum(Types.ModelServiceTypes).optional().default(Types.ModelServiceTypes.Anthropic).describe("Preferred model provider service type, i.e. Anthropic, OpenAI, Google. Defaults to Anthropic if not provided.")
    },
    async ({ enablePreparation, enableExtraction, serviceType }) => {
        const client = new Graphlit();

        var preparationSpecificationId;
        var extractionSpecificationId;
        var workflowId;

        switch (serviceType)
        {
            case Types.ModelServiceTypes.Anthropic:
            case Types.ModelServiceTypes.Google:
            case Types.ModelServiceTypes.OpenAi:
                break;
            default:
                throw new Error(`Unsupported model service type [${serviceType}].`);
        }

        if (enablePreparation) {
            var sresponse = await client.upsertSpecification({
                name: "MCP Default Specification: Preparation",
                type: Types.SpecificationTypes.Preparation,
                serviceType: serviceType,
                anthropic: serviceType == Types.ModelServiceTypes.Anthropic ? {
                    model: Types.AnthropicModels.Claude_3_7Sonnet
                } : undefined,
                openAI: serviceType == Types.ModelServiceTypes.OpenAi ? {
                    model: Types.OpenAiModels.Gpt4O_128K
                } : undefined,
                google: serviceType == Types.ModelServiceTypes.Google ? {
                    model: Types.GoogleModels.Gemini_2_0ProExperimental
                } : undefined,
            });

            preparationSpecificationId = sresponse.upsertSpecification?.id;
        }

        if (enableExtraction) {
            var sresponse = await client.upsertSpecification({
                name: "MCP Default Specification: Extraction",
                type: Types.SpecificationTypes.Extraction,
                serviceType: serviceType,
                anthropic: serviceType == Types.ModelServiceTypes.Anthropic ? {
                    model: Types.AnthropicModels.Claude_3_7Sonnet
                } : undefined,
                openAI: serviceType == Types.ModelServiceTypes.OpenAi ? {
                    model: Types.OpenAiModels.Gpt4O_128K
                } : undefined,
                google: serviceType == Types.ModelServiceTypes.Google ? {
                    model: Types.GoogleModels.Gemini_2_0FlashThinkingExperimental
                } : undefined,
            });

            extractionSpecificationId = sresponse.upsertSpecification?.id;
        }

        const wresponse = await client.upsertWorkflow({ 
            name: "MCP Default Workflow", 
            preparation: preparationSpecificationId !== undefined ? {
                jobs: [ {
                    connector: {
                        type: Types.FilePreparationServiceTypes.ModelDocument,
                        modelDocument: {
                            specification: { id: preparationSpecificationId } 
                        }
                    }
                } ]
            } : undefined,
            extraction: extractionSpecificationId !== undefined ? { 
                jobs: [ { 
                    connector: { 
                        type: Types.EntityExtractionServiceTypes.ModelText, 
                        modelText: { 
                            specification: { id: extractionSpecificationId } 
                        } 
                    }
                }, { 
                    connector: { 
                        type: Types.EntityExtractionServiceTypes.ModelImage, 
                        modelImage: { 
                            specification: { id: extractionSpecificationId } 
                        } 
                    }
                } ]
            } : undefined
        });

        workflowId = wresponse.upsertWorkflow?.id;

        try {
        const response = await client.updateProject({ 
            workflow: workflowId !== undefined ? { id: workflowId } : undefined

        });

        return {
            content: [{
            type: "text",
            text: JSON.stringify({ id: response.updateProject?.id }, null, 2)
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
    "retrieveSources",
    `Retrieve relevant content sources from Graphlit knowledge base. Do *not* use for retrieving content by content identifier - retrieve content resource instead, with URI 'contents://{id}'.
    Accepts a search prompt, optional recency filter (defaults to all time), and optional content type and file type filters.
    Also accepts optional feed and collection identifiers to filter content by.
    Prompt should be optimized for vector search, via text embeddings. Rewrite prompt as appropriate for higher relevance to search results.
    Returns the ranked content sources, including their content resource URI to retrieve the complete Markdown text.`,
    { 
        prompt: z.string().describe("Search prompt for content retrieval."),
        inLast: z.string().optional().describe("Recency filter for content 'in last' timespan, optional. Should be ISO 8601 format, for example, 'PT1H' for last hour, 'P1D' for last day, 'P7D' for last week, 'P30D' for last month. Doesn't support weeks or months explicitly."),
        contentType: z.nativeEnum(ContentTypes).optional().describe("Content type filter, optional. One of: Email, Event, File, Issue, Message, Page, Post, Text."),
        fileType: z.nativeEnum(FileTypes).optional().describe("File type filter, optional. One of: Animation, Audio, Code, Data, Document, Drawing, Email, Geometry, Image, Package, PointCloud, Shape, Video."),
        feeds: z.array(z.string()).optional().describe("Feed identifiers to filter content by, optional."),
        collections: z.array(z.string()).optional().describe("Collection identifiers to filter content by, optional.")
    },
    async ({ prompt, contentType, fileType, inLast, feeds, collections }) => {
        const client = new Graphlit();

        try {
        const filter: ContentFilter = { 
            searchType: SearchTypes.Hybrid,
            feeds: feeds?.map(feed => ({ id: feed })),
            collections: collections?.map(collection => ({ id: collection })),
            inLast: inLast, 
            types: contentType ? [contentType] : null, 
            fileTypes: fileType ? [fileType] : null
        };

        const response = await client.retrieveSources(prompt, filter, undefined, { 
            type: RetrievalStrategyTypes.Chunk, 
            disableFallback: true 
        }, 
        { 
            serviceType: RerankingModelServiceTypes.Cohere 
        });
        
        const sources = response.retrieveSources?.results || [];
        
        return {
            content: sources
            .filter(source => source !== null)
            .map(source => ({
                type: "text",
                mimeType: "application/json",
                text: JSON.stringify({ 
                id: source.content?.id, 
                relevance: source.relevance,
                resourceUri: `contents://${source.content?.id}`, 
                text: source.text, 
                mimeType: "text/markdown"
                }, null, 2)
            }))
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

    const PointFilter = z.object({
        latitude: z.number().min(-90).max(90)
            .describe("The latitude, must be between -90 and 90."),
        longitude: z.number().min(-180).max(180)
            .describe("The longitude, must be between -180 and 180."),
        distance: z.number().optional()
            .describe("The distance radius (in meters)."),
    });

    //
    // REVIEW: MCP clients don't handle Base64-encoded data very well,
    // will often exceed the LLM context window to return from the tool
    // so, we only can support similar images by URL
    server.tool(
    "retrieveImages",
    `Retrieve images from Graphlit knowledge base. Provides image-specific retrieval when image similarity search is desired.
    Do *not* use for retrieving content by content identifier - retrieve content resource instead, with URI 'contents://{id}'.
    Accepts image URL. Image will be used for similarity search using image embeddings.
    Accepts optional geo-location filter for search by latitude, longitude and optional distance radius. Images taken with GPS enabled are searchable by geo-location.
    Also accepts optional recency filter (defaults to all time), and optional feed and collection identifiers to filter images by.
    Returns the matching images, including their content resource URI to retrieve the complete Markdown text.`,
    { 
        url: z.string().describe("URL of image which will be used for similarity search using image embeddings."),
        inLast: z.string().optional().describe("Recency filter for image 'in last' timespan, optional. Should be ISO 8601 format, for example, 'PT1H' for last hour, 'P1D' for last day, 'P7D' for last week, 'P30D' for last month. Doesn't support weeks or months explicitly."),
        feeds: z.array(z.string()).optional().describe("Feed identifiers to filter images by, optional."),
        collections: z.array(z.string()).optional().describe("Collection identifiers to filter images by, optional."),
        location: PointFilter.optional().describe("Geo-location filter for search by latitude, longitude and optional distance radius."),
        limit: z.number().optional().default(100).describe("Limit the number of images to be returned. Defaults to 100.")
    },
    async ({ url, inLast, feeds, collections, location, limit }) => {
        const client = new Graphlit();

        var data;
        var mimeType;

        if (url) {
            const fetchResponse = await fetch(url);
            if (!fetchResponse.ok) {
                throw new Error(`Failed to fetch data from ${url}: ${fetchResponse.statusText}`);
            }
            const arrayBuffer = await fetchResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
        
            data = buffer.toString('base64');
            mimeType = fetchResponse.headers.get('content-type') || 'application/octet-stream';
        }

        try {
        const filter: ContentFilter = { 
            imageData: data,
            imageMimeType: mimeType,
            searchType: SearchTypes.Vector,
            feeds: feeds?.map(feed => ({ id: feed })),
            collections: collections?.map(collection => ({ id: collection })),
            location: location,
            inLast: inLast, 
            types: [ContentTypes.File], 
            fileTypes: [FileTypes.Image],
            limit: limit
        };
        const response = await client.queryContents(filter);
        
        const contents = response.contents?.results || [];
        
        return {
            content: contents
            .filter(content => content !== null)
            .map(content => ({
                type: "text",
                mimeType: "application/json",
                text: JSON.stringify({ 
                    id: content.id, 
                    relevance: content.relevance,
                    fileName: content.fileName,                    
                    resourceUri: `contents://${content.id}`, 
                    uri: content.imageUri, 
                    mimeType: content.mimeType
                }, null, 2)
            }))
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
    "queryContents",
    `Query contents from Graphlit knowledge base. Do *not* use for retrieving content by content identifier - retrieve content resource instead, with URI 'contents://{id}'.
    Accepts optional content name, content type and file type for metadata filtering.
    Accepts optional recency filter (defaults to all time), and optional feed and collection identifiers to filter images by.
    Accepts optional geo-location filter for search by latitude, longitude and optional distance radius. Images and videos taken with GPS enabled are searchable by geo-location.
    Returns the matching contents, including their content resource URI to retrieve the complete Markdown text.`,
    { 
        name: z.string().optional().describe("Textual match on content name."),
        type: z.nativeEnum(ContentTypes).optional().describe("Filter by content type."),
        fileType: z.nativeEnum(FileTypes).optional().describe("Filter by file type."),
        inLast: z.string().optional().describe("Recency filter for image 'in last' timespan, optional. Should be ISO 8601 format, for example, 'PT1H' for last hour, 'P1D' for last day, 'P7D' for last week, 'P30D' for last month. Doesn't support weeks or months explicitly."),
        feeds: z.array(z.string()).optional().describe("Feed identifiers to filter images by, optional."),
        collections: z.array(z.string()).optional().describe("Collection identifiers to filter images by, optional."),
        location: PointFilter.optional().describe("Geo-location filter for search by latitude, longitude and optional distance radius."),
        limit: z.number().optional().default(100).describe("Limit the number of contents to be returned. Defaults to 100.")
    },
    async ({ name, type, fileType, inLast, feeds, collections, location, limit }) => {
        const client = new Graphlit();

        try {
        const filter: ContentFilter = { 
            name: name,
            types: type !== undefined ? [ type ] : undefined,
            fileTypes: fileType !== undefined ? [ fileType ] : undefined,
            feeds: feeds?.map(feed => ({ id: feed })),
            collections: collections?.map(collection => ({ id: collection })),
            location: location,
            inLast: inLast,
            limit: limit
        };
        const response = await client.queryContents(filter);
        
        const contents = response.contents?.results || [];
        
        return {
            content: contents
            .filter(content => content !== null)
            .map(content => ({
                type: "text",
                mimeType: "application/json",
                text: JSON.stringify({ 
                    id: content.id, 
                    relevance: content.relevance,
                    fileName: content.fileName,
                    resourceUri: `contents://${content.id}`, 
                    uri: content.imageUri, 
                    mimeType: content.mimeType
                }, null, 2)
            }))
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
    "extractText",
    `Extracts JSON data from text using LLM.
    Accepts text to be extracted, and JSON schema which describes the data which will be extracted. JSON schema needs be of type 'object' and include 'properties' and 'required' fields.
    Optionally accepts text prompt which is provided to LLM to guide data extraction. Defaults to 'Extract data using the tools provided'.
    Returns extracted JSON from text.`,
    { 
        text: z.string().describe("Text to be extracted with LLM."),
        schema: z.string().describe("JSON schema which describes the data which will be extracted. JSON schema needs be of type 'object' and include 'properties' and 'required' fields."),
        prompt: z.string().optional().describe("Text prompt which is provided to LLM to guide data extraction, optional.")
    },
    async ({ text, schema, prompt }) => {
        const client = new Graphlit();

        const DEFAULT_NAME = "extract_json"
        const DEFAULT_PROMPT = `
        Extract data using the tools provided.
        `

        try {           
            const response = await client.extractText(prompt || DEFAULT_PROMPT, text, [{ name: DEFAULT_NAME, schema: schema }]);

            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.extractText ? response.extractText.filter(item => item !== null).map(item => item.value) : [], null, 2)
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
    "createCollection",
    `Create a collection.
    Accepts a collection name, and optional list of content identifiers to add to collection.
    Returns the collection identifier`,
    { 
        name: z.string().describe("Collection name."),
        contents: z.array(z.string()).optional().describe("Content identifiers to add to collection, optional.")
    },
    async ({ name, contents }) => {
        const client = new Graphlit();

        try {
        const response = await client.createCollection({ 
            name: name, 
            contents: contents?.map(content => ({ id: content })), 
        });
                
        return {
            content: [{
            type: "text",
            text: JSON.stringify({ id: response.createCollection?.id }, null, 2)
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
    "addContentsToCollection",
    `Add contents to a collection.
    Accepts a collection identifier and a list of content identifiers to add to collection.
    Returns the collection identifier.`,
    { 
        id: z.string().describe("Collection identifier."),
        contents: z.array(z.string()).describe("Content identifiers to add to collection.")
    },
    async ({ id, contents }) => {
        const client = new Graphlit();

        try {
        const response = await client.addContentsToCollections(
            contents?.map(content => ({ id: content })),
            [{ id: id }]
        );
                
        return {
            content: [{
            type: "text",
            text: JSON.stringify({ id: id }, null, 2)
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
    "removeContentsFromCollection",
    `Remove contents from collection.
    Accepts a collection identifier and a list of content identifiers to remove from collection.
    Returns the collection identifier.`,
    { 
        id: z.string().describe("Collection identifier."),
        contents: z.array(z.string()).describe("Content identifiers to remove from collection.")
    },
    async ({ id, contents }) => {
        const client = new Graphlit();

        try {
        const response = await client.removeContentsFromCollection(
            contents?.map(content => ({ id: content })),
            { id: id }
        );
                
        return {
            content: [{
            type: "text",
            text: JSON.stringify({ id: response.removeContentsFromCollection?.id }, null, 2)
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
    "deleteCollection",
    `Delete a collection. Does *not* delete the content in the collection.
    Accepts a collection identifier.
    Returns the collection identifier and collection state, i.e. Deleted.`,
    { 
        id: z.string().describe("Collection identifier."),
    },
    async ({ id}) => {
        const client = new Graphlit();

        try {
        const response = await client.deleteCollection(id);
                
        return {
            content: [{
            type: "text",
            text: JSON.stringify(response.deleteCollection, null, 2)
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
    "queryCollections",
    `Query collections from Graphlit knowledge base. Do *not* use for retrieving collection by collection identifier - retrieve collection resource instead, with URI 'collections://{id}'.
    Accepts optional collection name for metadata filtering.
    Returns the matching collections, including their collection resource URI to retrieve the collection contents.`,
    { 
        name: z.string().optional().describe("Textual match on collection name."),
        limit: z.number().optional().default(100).describe("Limit the number of collections to be returned. Defaults to 100.")
    },
    async ({ name, limit }) => {
        const client = new Graphlit();

        try {
        const filter: CollectionFilter = { 
            name: name,
            limit: limit
        };
        const response = await client.queryCollections(filter);
        
        const collections = response.collections?.results || [];
        
        return {
            content: collections
            .filter(collection => collection !== null)
            .map(collection => ({
                type: "text",
                mimeType: "application/json",
                text: JSON.stringify({ 
                    id: collection.id, 
                    relevance: collection.relevance,
                    resourceUri: `collections://${collection.id}`
                }, null, 2)
            }))
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
    "deleteFeed",
    `Delete a feed and all of its ingested content.
    Accepts a feed identifier which was returned from one of the ingestion tools, like ingestGoogleDriveFiles.
    Content deletion will happen asynchronously.
    Returns the feed identifier and feed state, i.e. Deleted.`,
    { 
        id: z.string().describe("Feed identifier."),
    },
    async ({ id}) => {
        const client = new Graphlit();

        try {
        const response = await client.deleteFeed(id);
                
        return {
            content: [{
            type: "text",
            text: JSON.stringify(response.deleteFeed, null, 2)
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
    "deleteContent",
    `Delete content.
    Accepts a content identifier.
    Returns the content identifier and content state, i.e. Deleted.`,
    { 
        id: z.string().describe("Content identifier."),
    },
    async ({ id}) => {
        const client = new Graphlit();

        try {
        const response = await client.deleteContent(id);
                
        return {
            content: [{
            type: "text",
            text: JSON.stringify(response.deleteContent, null, 2)
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
        "deleteContents",
        `Deletes contents from Graphlit knowledge base.
        Accepts optional content type and file type filters to limit the contents which will be deleted.
        Also accepts optional limit of how many contents to delete, defaults to 1000.
        Returns the content identifiers and content state, i.e. Deleted.`,
        { 
            contentType: z.nativeEnum(ContentTypes).optional().describe("Content type filter, optional. One of: Email, Event, File, Issue, Message, Page, Post, Text."),
            fileType: z.nativeEnum(FileTypes).optional().describe("File type filter, optional. One of: Animation, Audio, Code, Data, Document, Drawing, Email, Geometry, Image, Package, PointCloud, Shape, Video."),
            limit: z.number().optional().default(1000)            
        },
        async ({ contentType, fileType, limit }) => {
            const client = new Graphlit();
    
            try {
            const filter: ContentFilter = { 
                types: contentType ? [contentType] : null, 
                fileTypes: fileType ? [fileType] : null,
                limit: limit
            };                

            const response = await client.deleteAllContents(filter);
                    
            return {
                content: [{
                type: "text",
                text: JSON.stringify(response.deleteAllContents, null, 2)
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
        "deleteFeeds",
        `Deletes feeds from Graphlit knowledge base.
        Accepts optional feed type filter to limit the feeds which will be deleted.
        Also accepts optional limit of how many feeds to delete, defaults to 100.
        Returns the feed identifiers and feed state, i.e. Deleted.`,
        { 
            feedType: z.nativeEnum(FeedTypes).optional().describe("Feed type filter, optional. One of: Discord, Email, Intercom, Issue, MicrosoftTeams, Notion, Reddit, Rss, Search, Site, Slack, Web, YouTube, Zendesk."),
            limit: z.number().optional().default(100)            
        },
        async ({ feedType, limit }) => {
            const client = new Graphlit();
    
            try {
            const filter: FeedFilter = { 
                types: feedType ? [feedType] : null, 
                limit: limit
            };                

            const response = await client.deleteAllFeeds(filter);
                    
            return {
                content: [{
                type: "text",
                text: JSON.stringify(response.deleteAllFeeds, null, 2)
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
    "isContentDone",
    `Check if content has completed asynchronous ingestion.
    Accepts a content identifier which was returned from one of the non-feed ingestion tools, like ingestUrl.
    Returns whether the content is done or not.`,
    { 
        id: z.string().describe("Content identifier."),
    },
    async ({ id}) => {
        const client = new Graphlit();

        try {
        const response = await client.isContentDone(id);
                
        return {
            content: [{
            type: "text",
            text: JSON.stringify({ done: response.isContentDone?.result }, null, 2)
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
    "isFeedDone",
    `Check if an asynchronous feed has completed ingesting all the available content.
    Accepts a feed identifier which was returned from one of the ingestion tools, like ingestGoogleDriveFiles.
    Returns whether the feed is done or not.`,
    { 
        id: z.string().describe("Feed identifier."),
    },
    async ({ id}) => {
        const client = new Graphlit();

        try {
        const response = await client.isFeedDone(id);
                
        return {
            content: [{
            type: "text",
            text: JSON.stringify({ done: response.isFeedDone?.result }, null, 2)
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
    "listMicrosoftTeamsTeams",
    `Lists available Microsoft Teams teams.
    Returns a list of Microsoft Teams teams, where the team identifier can be used with listMicrosoftTeamsChannels to enumerate Microsoft Teams channels.`,
    { 
    },
    async ({ }) => {
        const client = new Graphlit();

        try {
        const clientId = process.env.MICROSOFT_TEAMS_CLIENT_ID;
        if (!clientId) {
            console.error("Please set MICROSOFT_TEAMS_CLIENT_ID environment variable.");
            process.exit(1);
        }

        const clientSecret = process.env.MICROSOFT_TEAMS_CLIENT_SECRET;
        if (!clientSecret) {
            console.error("Please set MICROSOFT_TEAMS_CLIENT_SECRET environment variable.");
            process.exit(1);
        }

        const refreshToken = process.env.MICROSOFT_TEAMS_REFRESH_TOKEN;
        if (!refreshToken) {
            console.error("Please set MICROSOFT_TEAMS_REFRESH_TOKEN environment variable.");
            process.exit(1);
        }

        // REVIEW: client ID/secret not exposed in SDK
        const response = await client.queryMicrosoftTeamsTeams({
            //clientId: clientId,
            //clientSecret: clientSecret,
            refreshToken: refreshToken,
        });

        return {
            content: [{
            type: "text",
            text: JSON.stringify(response.microsoftTeamsTeams?.results, null, 2)
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
    "listMicrosoftTeamsChannels",
    `Lists available Microsoft Teams channels.
        Returns a list of Microsoft Teams channels, where the channel identifier can be used with ingestMicrosoftTeamsMessages to ingest messages into Graphlit knowledge base.`,
    { 
        teamId: z.string()
    },
    async ({ teamId }) => {
        const client = new Graphlit();

        try {
        const clientId = process.env.MICROSOFT_TEAMS_CLIENT_ID;
        if (!clientId) {
            console.error("Please set MICROSOFT_TEAMS_CLIENT_ID environment variable.");
            process.exit(1);
        }

        const clientSecret = process.env.MICROSOFT_TEAMS_CLIENT_SECRET;
        if (!clientSecret) {
            console.error("Please set MICROSOFT_TEAMS_CLIENT_SECRET environment variable.");
            process.exit(1);
        }

        const refreshToken = process.env.MICROSOFT_TEAMS_REFRESH_TOKEN;
        if (!refreshToken) {
            console.error("Please set MICROSOFT_TEAMS_REFRESH_TOKEN environment variable.");
            process.exit(1);
        }

        // REVIEW: client ID/secret not exposed in SDK
        const response = await client.queryMicrosoftTeamsChannels({
            //clientId: clientId,
            //clientSecret: clientSecret,
            refreshToken: refreshToken,
        }, teamId);

        return {
            content: [{
            type: "text",
            text: JSON.stringify(response.microsoftTeamsChannels?.results, null, 2)
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
    "listSlackChannels",
    `Lists available Slack channels.
        Returns a list of Slack channels, where the channel name can be used with ingestSlackMessages to ingest messages into Graphlit knowledge base.`,
    { 
    },
    async ({ }) => {
        const client = new Graphlit();

        try {
        const botToken = process.env.SLACK_BOT_TOKEN;
        if (!botToken) {
            console.error("Please set SLACK_BOT_TOKEN environment variable.");
            process.exit(1);
        }

        const response = await client.querySlackChannels({
            token: botToken
        });

        return {
            content: [{
            type: "text",
            text: JSON.stringify(response.slackChannels?.results, null, 2)
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
    "listSharePointLibraries",
    `Lists available SharePoint libraries.
    Returns a list of SharePoint libraries, where the selected libraryId can be used with listSharePointFolders to enumerate SharePoint folders in a library.`,
    { 
    },
    async ({ }) => {
        const client = new Graphlit();

        try {
        const clientId = process.env.SHAREPOINT_CLIENT_ID;
        if (!clientId) {
            console.error("Please set SHAREPOINT_CLIENT_ID environment variable.");
            process.exit(1);
        }

        const clientSecret = process.env.SHAREPOINT_CLIENT_SECRET;
        if (!clientSecret) {
            console.error("Please set SHAREPOINT_CLIENT_SECRET environment variable.");
            process.exit(1);
        }

        const refreshToken = process.env.SHAREPOINT_REFRESH_TOKEN;
        if (!refreshToken) {
            console.error("Please set SHAREPOINT_REFRESH_TOKEN environment variable.");
            process.exit(1);
        }

        const response = await client.querySharePointLibraries({
            authenticationType: SharePointAuthenticationTypes.User,
            clientId: clientId,
            clientSecret: clientSecret,
            refreshToken: refreshToken,
        });

        return {
            content: [{
            type: "text",
            text: JSON.stringify(response.sharePointLibraries?.results, null, 2)
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
    "listSharePointFolders",
    `Lists available SharePoint folders.
        Returns a list of SharePoint folders, which can be used with ingestSharePointFiles to ingest files into Graphlit knowledge base.`,
    { 
        libraryId: z.string()
    },
    async ({ libraryId }) => {
        const client = new Graphlit();

        try {
        const clientId = process.env.SHAREPOINT_CLIENT_ID;
        if (!clientId) {
            console.error("Please set SHAREPOINT_CLIENT_ID environment variable.");
            process.exit(1);
        }

        const clientSecret = process.env.SHAREPOINT_CLIENT_SECRET;
        if (!clientSecret) {
            console.error("Please set SHAREPOINT_CLIENT_SECRET environment variable.");
            process.exit(1);
        }

        const refreshToken = process.env.SHAREPOINT_REFRESH_TOKEN;
        if (!refreshToken) {
            console.error("Please set SHAREPOINT_REFRESH_TOKEN environment variable.");
            process.exit(1);
        }

        const response = await client.querySharePointFolders({
            authenticationType: SharePointAuthenticationTypes.User,
            clientId: clientId,
            clientSecret: clientSecret,
            refreshToken: refreshToken,
            }, libraryId);

        return {
            content: [{
            type: "text",
            text: JSON.stringify(response.sharePointFolders?.results, null, 2)
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
    "ingestSharePointFiles",
    `Ingests files from SharePoint library into Graphlit knowledge base.
    Accepts a SharePoint libraryId and an optional folderId to ingest files from a specific SharePoint folder.
    Libraries can be enumerated with listSharePointLibraries and library folders with listSharePointFolders.
    Accepts an optional read limit for the number of files to ingest.
    Executes asynchronously and returns the feed identifier.`,
    { 
        libraryId: z.string(),
        folderId: z.string().optional(),
        readLimit: z.number().optional().describe("Number of files to ingest, optional. Defaults to 100.")
    },
    async ({ libraryId, folderId, readLimit }) => {
        const client = new Graphlit();

        try {
        const accountName = process.env.SHAREPOINT_ACCOUNT_NAME;
        if (!accountName) {
            console.error("Please set SHAREPOINT_ACCOUNT_NAME environment variable.");
            process.exit(1);
        }

        const clientId = process.env.SHAREPOINT_CLIENT_ID;
        if (!clientId) {
            console.error("Please set SHAREPOINT_CLIENT_ID environment variable.");
            process.exit(1);
        }

        const clientSecret = process.env.SHAREPOINT_CLIENT_SECRET;
        if (!clientSecret) {
            console.error("Please set SHAREPOINT_CLIENT_SECRET environment variable.");
            process.exit(1);
        }

        const refreshToken = process.env.SHAREPOINT_REFRESH_TOKEN;
        if (!refreshToken) {
            console.error("Please set SHAREPOINT_REFRESH_TOKEN environment variable.");
            process.exit(1);
        }

        const response = await client.createFeed({
            name: `SharePoint`,
            type: FeedTypes.Site,
            site: {
            type: FeedServiceTypes.SharePoint,
            sharePoint: {
                authenticationType: SharePointAuthenticationTypes.User,
                accountName: accountName,
                clientId: clientId,
                clientSecret: clientSecret,
                refreshToken: refreshToken,
                libraryId: libraryId,
                folderId: folderId
            },
            isRecursive: true,
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
    "ingestOneDriveFiles",
    `Ingests files from OneDrive folder into Graphlit knowledge base.
    Accepts an optional read limit for the number of files to ingest.
    Executes asynchronously and returns the feed identifier.`,
    { 
        readLimit: z.number().optional().describe("Number of files to ingest, optional. Defaults to 100.")
    },
    async ({ readLimit }) => {
        const client = new Graphlit();

        try {
        const folderId = process.env.ONEDRIVE_FOLDER_ID;
        if (!folderId) {
            console.error("Please set ONEDRIVE_FOLDER_ID environment variable.");
            process.exit(1);
        }

        const clientId = process.env.ONEDRIVE_CLIENT_ID;
        if (!clientId) {
            console.error("Please set ONEDRIVE_CLIENT_ID environment variable.");
            process.exit(1);
        }

        const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET;
        if (!clientSecret) {
            console.error("Please set ONEDRIVE_CLIENT_SECRET environment variable.");
            process.exit(1);
        }

        const refreshToken = process.env.ONEDRIVE_REFRESH_TOKEN;
        if (!refreshToken) {
            console.error("Please set ONEDRIVE_REFRESH_TOKEN environment variable.");
            process.exit(1);
        }

        const response = await client.createFeed({
            name: `OneDrive`,
            type: FeedTypes.Site,
            site: {
            type: FeedServiceTypes.OneDrive,
            oneDrive: {
                folderId: folderId,
                clientId: clientId,
                clientSecret: clientSecret,
                refreshToken: refreshToken,
            },
            isRecursive: true,
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
    "ingestGoogleDriveFiles",
    `Ingests files from Google Drive folder into Graphlit knowledge base.
    Accepts an optional read limit for the number of files to ingest.
    Executes asynchronously and returns the feed identifier.`,
    { 
        readLimit: z.number().optional().describe("Number of files to ingest, optional. Defaults to 100.")
    },
    async ({ readLimit }) => {
        const client = new Graphlit();

        try {
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        if (!folderId) {
            console.error("Please set GOOGLE_DRIVE_FOLDER_ID environment variable.");
            process.exit(1);
        }

        const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
        if (!clientId) {
            console.error("Please set GOOGLE_DRIVE_CLIENT_ID environment variable.");
            process.exit(1);
        }

        const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
        if (!clientSecret) {
            console.error("Please set GOOGLE_DRIVE_CLIENT_SECRET environment variable.");
            process.exit(1);
        }

        const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
        if (!refreshToken) {
            console.error("Please set GOOGLE_DRIVE_REFRESH_TOKEN environment variable.");
            process.exit(1);
        }

        const response = await client.createFeed({
            name: `Google Drive`,
            type: FeedTypes.Site,
            site: {
            type: FeedServiceTypes.GoogleDrive,
            googleDrive: {
                folderId: folderId,
                clientId: clientId,
                clientSecret: clientSecret,
                refreshToken: refreshToken,
            },
            isRecursive: true,
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
    "ingestDropboxFiles",
    `Ingests files from Dropbox folder into Graphlit knowledge base.
    Accepts optional relative path to Dropbox folder (i.e. /Pictures), and an optional read limit for the number of files to ingest.
    If no path provided, ingests files from root Dropbox folder.
    Executes asynchronously and returns the feed identifier.`,
    { 
        path: z.string().optional(),
        readLimit: z.number().optional().describe("Number of files to ingest, optional. Defaults to 100.")
    },
    async ({ path, readLimit }) => {
        const client = new Graphlit();

        try {
        const appKey = process.env.DROPBOX_APP_KEY;
        if (!appKey) {
            console.error("Please set DROPBOX_APP_KEY environment variable.");
            process.exit(1);
        }

        const appSecret = process.env.DROPBOX_APP_SECRET;
        if (!appSecret) {
            console.error("Please set DROPBOX_APP_SECRET environment variable.");
            process.exit(1);
        }

        const redirectUri = process.env.DROPBOX_REDIRECT_URI;
        if (!redirectUri) {
            console.error("Please set DROPBOX_REDIRECT_URI environment variable.");
            process.exit(1);
        }

        const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
        if (!refreshToken) {
            console.error("Please set DROPBOX_REFRESH_TOKEN environment variable.");
            process.exit(1);
        }

        const response = await client.createFeed({
            name: `Dropbox`,
            type: FeedTypes.Site,
            site: {
            type: FeedServiceTypes.Dropbox,
            dropbox: {
                path: path,
                appKey: appKey,
                appSecret: appSecret,
                redirectUri: redirectUri,
                refreshToken: refreshToken,
            },
            isRecursive: true,
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
    "ingestBoxFiles",
    `Ingests files from Box folder into Graphlit knowledge base.
    Accepts optional Box folder identifier, and an optional read limit for the number of files to ingest.
    If no folder identifier provided, ingests files from root Box folder (i.e. "0").
    Folder identifier can be inferred from Box URL. https://app.box.com/folder/123456 -> folder identifier is "123456".
    Executes asynchronously and returns the feed identifier.`,
    { 
        folderId: z.string().optional().default("0"),
        readLimit: z.number().optional().describe("Number of files to ingest, optional. Defaults to 100.")
    },
    async ({ folderId, readLimit }) => {
        const client = new Graphlit();

        try {
        const clientId = process.env.BOX_CLIENT_ID;
        if (!clientId) {
            console.error("Please set BOX_CLIENT_ID environment variable.");
            process.exit(1);
        }

        const clientSecret = process.env.BOX_CLIENT_SECRET;
        if (!clientSecret) {
            console.error("Please set BOX_CLIENT_SECRET environment variable.");
            process.exit(1);
        }

        const redirectUri = process.env.BOX_REDIRECT_URI;
        if (!redirectUri) {
            console.error("Please set BOX_REDIRECT_URI environment variable.");
            process.exit(1);
        }

        const refreshToken = process.env.BOX_REFRESH_TOKEN;
        if (!refreshToken) {
            console.error("Please set BOX_REFRESH_TOKEN environment variable.");
            process.exit(1);
        }

        const response = await client.createFeed({
            name: `Box`,
            type: FeedTypes.Site,
            site: {
            type: FeedServiceTypes.Box,
            box: {
                folderId: folderId,
                clientId: clientId,
                clientSecret: clientSecret,
                redirectUri: redirectUri,
                refreshToken: refreshToken,
            },
            isRecursive: true,
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
    "ingestGitHubFiles",
    `Ingests files from GitHub repository into Graphlit knowledge base.
    Accepts GitHub repository owner and repository name and an optional read limit for the number of files to ingest.
    For example, for GitHub repository (https://github.com/openai/tiktoken), 'openai' is the repository owner, and 'tiktoken' is the repository name.
    Executes asynchronously and returns the feed identifier.`,
    { 
        repositoryName: z.string().describe("GitHub repository name."),
        repositoryOwner: z.string().describe("GitHub repository owner."),
        readLimit: z.number().optional().describe("Number of files to ingest, optional. Defaults to 100.")
    },
    async ({ repositoryOwner, repositoryName, readLimit }) => {
        const client = new Graphlit();

        try {
        const personalAccessToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
        if (!personalAccessToken) {
            console.error("Please set GITHUB_PERSONAL_ACCESS_TOKEN environment variable.");
            process.exit(1);
        }

        const response = await client.createFeed({
            name: `GitHub`,
            type: FeedTypes.Site,
            site: {
            type: FeedServiceTypes.GitHub,
            github: {
                repositoryOwner: repositoryOwner,
                repositoryName: repositoryName,
                personalAccessToken: personalAccessToken
            },
            isRecursive: true,
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
    "ingestNotionPages",
    `Ingests pages from Notion database into Graphlit knowledge base.
        Accepts an optional read limit for the number of messages to ingest.
        Executes asynchronously and returns the feed identifier.`,
    { 
        readLimit: z.number().optional().describe("Number of pages to ingest, optional. Defaults to 100.")
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
    "ingestMicrosoftTeamsMessages",
    `Ingests messages from Microsoft Teams channel into Graphlit knowledge base.
    Accepts Microsoft Teams team identifier and channel identifier, and an optional read limit for the number of messages to ingest.
    Executes asynchronously and returns the feed identifier.`,
    { 
        teamId: z.string(),
        channelId: z.string(),
        readLimit: z.number().optional().describe("Number of messages to ingest, optional. Defaults to 100.")
    },
    async ({ teamId, channelId, readLimit }) => {
        const client = new Graphlit();

        try {
        const clientId = process.env.MICROSOFT_TEAMS_CLIENT_ID;
        if (!clientId) {
            console.error("Please set MICROSOFT_TEAMS_CLIENT_ID environment variable.");
            process.exit(1);
        }

        const clientSecret = process.env.MICROSOFT_TEAMS_CLIENT_SECRET;
        if (!clientSecret) {
            console.error("Please set MICROSOFT_TEAMS_CLIENT_SECRET environment variable.");
            process.exit(1);
        }

        const refreshToken = process.env.MICROSOFT_TEAMS_REFRESH_TOKEN;
        if (!refreshToken) {
            console.error("Please set MICROSOFT_TEAMS_REFRESH_TOKEN environment variable.");
            process.exit(1);
        }

        const response = await client.createFeed({
            name: `Microsoft Teams [${teamId}/${channelId}]`,
            type: FeedTypes.MicrosoftTeams,
            microsoftTeams: {
            type: FeedListingTypes.Past,
            clientId: clientId,
            clientSecret: clientSecret,
            refreshToken: refreshToken,
            channelId: channelId,
            teamId: teamId,
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
    "ingestSlackMessages",
    `Ingests messages from Slack channel into Graphlit knowledge base.
        Accepts Slack channel name and an optional read limit for the number of messages to ingest.
        Executes asynchronously and returns the feed identifier.`,
    { 
        channelName: z.string(),
        readLimit: z.number().optional().describe("Number of messages to ingest, optional. Defaults to 100.")
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
    "ingestDiscordMessages",
    `Ingests messages from Discord channel into Graphlit knowledge base.
        Accepts Discord channel name and an optional read limit for the number of messages to ingest.
        Executes asynchronously and returns the feed identifier.`,
    { 
        channelName: z.string(),
        readLimit: z.number().optional().describe("Number of messages to ingest, optional. Defaults to 100.")
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
    "ingestRedditPosts",
    `Ingests posts from Reddit subreddit into Graphlit knowledge base.
        Accepts a subreddit name and an optional read limit for the number of posts to ingest.
        Executes asynchronously and returns the feed identifier.`,
    { 
        subredditName: z.string(),
        readLimit: z.number().optional().describe("Number of posts to ingest, optional. Defaults to 100.")
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
    Executes asynchronously and returns the feed identifier.`,
    { 
        readLimit: z.number().optional().describe("Number of emails to ingest, optional. Defaults to 100.")
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
    "ingestMicrosoftEmail",
    `Ingests emails from Microsoft Email account into Graphlit knowledge base.
    Accepts an optional read limit for the number of emails to ingest.
    Executes asynchronously and returns the feed identifier.`,
    { 
        readLimit: z.number().optional().describe("Number of emails to ingest, optional. Defaults to 100.")
    },
    async ({ readLimit }) => {
        const client = new Graphlit();

        try {
        const refreshToken = process.env.MICROSOFT_EMAIL_REFRESH_TOKEN;
        if (!refreshToken) {
            console.error("Please set MICROSOFT_EMAIL_REFRESH_TOKEN environment variable.");
            process.exit(1);
        }

        const clientId = process.env.MICROSOFT_EMAIL_CLIENT_ID;
        if (!clientId) {
            console.error("Please set MICROSOFT_EMAIL_CLIENT_ID environment variable.");
            process.exit(1);
        }

        const clientSecret = process.env.MICROSOFT_EMAIL_CLIENT_SECRET;
        if (!clientSecret) {
            console.error("Please set MICROSOFT_EMAIL_CLIENT_SECRET environment variable.");
            process.exit(1);
        }

        const response = await client.createFeed({
            name: `Microsoft Email`,
            type: FeedTypes.Email,
            email: {
            type: FeedServiceTypes.MicrosoftEmail,
            microsoft: {
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
    Executes asynchronously and returns the feed identifier.`,
    { 
        projectName: z.string(),
        readLimit: z.number().optional().describe("Number of issues to ingest, optional. Defaults to 100.")
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
    Executes asynchronously and returns the feed identifier.`,
    { 
        repositoryName: z.string().describe("GitHub repository name."),
        repositoryOwner: z.string().describe("GitHub repository owner."),
        readLimit: z.number().optional().describe("Number of issues to ingest, optional. Defaults to 100.")
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
    "ingestJiraIssues",
    `Ingests issues from Atlassian Jira repository into Graphlit knowledge base.
    Accepts Atlassian Jira server URL and project name, and an optional read limit for the number of issues to ingest.
    Executes asynchronously and returns the feed identifier.`,
    { 
        url: z.string(),
        projectName: z.string(),
        readLimit: z.number().optional().describe("Number of issues to ingest, optional. Defaults to 100.")
    },
    async ({ url, projectName, readLimit }) => {
        const client = new Graphlit();

        try {
        const email = process.env.JIRA_EMAIL;
        if (!email) {
            console.error("Please set JIRA_EMAIL environment variable.");
            process.exit(1);
        }

        const token = process.env.JIRA_TOKEN;
        if (!token) {
            console.error("Please set JIRA_TOKEN environment variable.");
            process.exit(1);
        }

        const response = await client.createFeed({
            name: `Jira [${projectName}]`,
            type: FeedTypes.Issue,
            issue: {
            type: FeedServiceTypes.AtlassianJira,
            jira: {
                uri: url,
                project: projectName,
                email: email,
                token: token,
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
    Executes asynchronously and returns the feed identifier.`,
    { 
        url: z.string(),
        readLimit: z.number().optional().describe("Number of web pages to ingest, optional. Defaults to 100.")
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
    "webMap",
    `Enumerates the web pages at or beneath the provided URL using web sitemap. 
    Does *not* ingest web pages into Graphlit knowledge base.
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
    Prefer calling this tool over using 'curl' directly for any web search.
    Does *not* ingest pages into Graphlit knowledge base.
    Accepts search query as string, and optional search service type.
    Can search for web pages or podcast episodes. Podcast episodes will be ingested as audio files and automatically transcribed.
    Search service types: Tavily (web pages), Exa (web pages) and Podscan (podcast episodes). Defaults to Tavily.
    Returns URL, title and relevant Markdown text from resulting web pages or podcast episode transcripts.`,
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
    Executes asynchronously and returns the feed identifier.`,
    { 
        url: z.string(),
        readLimit: z.number().optional().describe("Number of issues to posts, optional. Defaults to 25.")
    },
    async ({ url, readLimit }) => {
        const client = new Graphlit();

        try {
        const response = await client.createFeed({
            name: `RSS [${url}]`,
            type: FeedTypes.Rss,
            rss: {
            uri: url,
            readLimit: readLimit || 25
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
    Can scrape web pages, and can ingest individual Word documents, PDFs, audio recordings, videos, images, or any other unstructured data.
    Executes asynchronously and returns the content identifier.`,
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

    server.tool(
    "ingestText",
    `Ingests text as content into Graphlit knowledge base.
    Accepts a name for the content object, the text itself, and an optional text type (Plain, Markdown, Html). Defaults to Markdown text type.
    Can use for storing long-term textual memories or the output from LLM or other tools as content resources, which can be later searched or retrieved.
    Executes *synchronously* and returns the content identifier.`,
    { 
        name: z.string(),
        text: z.string(),
        textType: z.nativeEnum(TextTypes).optional().default(TextTypes.Markdown)
    },
    async ({ name, text, textType }) => {
        const client = new Graphlit();

        try {
        const response = await client.ingestText(name, text, textType, undefined, undefined, true);

        return {
            content: [{
            type: "text",
            text: JSON.stringify({ id: response.ingestText?.id }, null, 2)
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
    "ingestFile",
    `Ingests local file into Graphlit knowledge base.
    Accepts the path to the file in the local filesystem.
    Executes asynchronously and returns the content identifier.`,
    { 
        filePath: z.string()
    },
    async ({ filePath }) => {
        const client = new Graphlit();

        try {
        const fileName = path.basename(filePath);
        const mimeType = mime.lookup(fileName) || 'application/octet-stream';
        
        const fileData = fs.readFileSync(filePath);
        const base64Data = fileData.toString('base64');

        const response = await client.ingestEncodedFile(fileName, base64Data, mimeType);

        return {
            content: [{
            type: "text",
            text: JSON.stringify({ id: response.ingestEncodedFile?.id }, null, 2)
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
    "screenshotPage",
    `Screenshots web page from URL.
    Executes asynchronously and returns the content identifier.`,
    { 
        url: z.string()
    },
    async ({ url }) => {
        const client = new Graphlit();

        try {
        const response = await client.screenshotPage(url);
       
        return {
            content: [
            {
                type: "text",
                text: JSON.stringify({ id: response.screenshotPage?.id }, null, 2)
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
    "describeImageUrl",
    `Prompts vision LLM and returns completion. 
    Does *not* ingest image into Graphlit knowledge base.
    Accepts image URL as string.
    Returns Markdown text from LLM completion.`,
    { 
        prompt: z.string(),
        url: z.string()
    },
    async ({ prompt, url }) => {
        const client = new Graphlit();

        try {
        const response = await client.describeImage(prompt, url);

        return {
            content: [{
            type: "text",
            text: JSON.stringify({ message: response.describeImage?.message }, null, 2)
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
    "describeImageContent",
    `Prompts vision LLM and returns description of image content. 
    Accepts content identifier as string, and optional prompt for image description.
    Returns Markdown text from LLM completion.`,
    { 
        id: z.string(),
        prompt: z.string().optional(),
    },
    async ({ prompt, id }) => {
        const client = new Graphlit();

        const DEFAULT_PROMPT = `
        Conduct a thorough analysis of the screenshot, with a particular emphasis on the textual content and any included imagery. 
        Provide a detailed examination of the text, highlighting key points and dissecting technical terms, named entities, and data presentations that contribute to the understanding of the subject matter. 
        Discuss how the technical language and the named entities relate to the overarching topic and objectives of the webpage. 
        Also, describe how the visual elements, such as color schemes, imagery, and branding elements like logos and taglines, support the textual message and enhance the viewer's comprehension of the content. 
        Assess the readability and organization of the content, and evaluate how these aspects facilitate the visitor's navigation and learning experience. Refrain from delving into the specifics of the user interface design but focus on the communication effectiveness and coherence of visual and textual elements. 
        Finally, offer a comprehensive view of the website's ability to convey its message and fulfill its intended commercial, educational, or promotional role, considering the target audience's perspective and potential engagement with the content.

        Carefully examine the image for any text it contains and extract as Markdown text. 
        In cases where the image contains no extractable text or only text that is not useful for understanding, don't extract any text. 
        Focus on including text that contributes significantly to understanding the image, such as titles, headings, key phrases, important data points, or labels. 
        Exclude any text that is not relevant or does not add value to the comprehension of the image. 
        Ensure to transcribe the text completely, without truncating with ellipses.
        `;

        try {
        const cresponse = await client.getContent(id);
        const content = cresponse.content;

        if (content?.imageUri != null)
        {
            const response = await client.describeImage(prompt || DEFAULT_PROMPT, content.imageUri);

            return {
            content: [{
                type: "text",
                text: JSON.stringify({ message: response.describeImage?.message }, null, 2)
            }]
            };
        }
        else {
            return {
            content: [{
                type: "text",
                text: JSON.stringify({ }, null, 2)
            }]
            };
        }
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
    "publishAudio",
    `Publishes text as audio format, and ingests into Graphlit knowledge base.
    Accepts a name for the content object, the text itself, and an optional text type (Plain, Markdown, Html). Defaults to Markdown text type.
    Optionally accepts an ElevenLabs voice identifier.
    Executes *synchronously* and returns the content identifier.`,
    { 
        name: z.string(),
        text: z.string(),
        textType: z.nativeEnum(TextTypes).optional().default(TextTypes.Markdown),
        voice: z.string().optional().default("CYw3kZ02Hs0563khs1Fj"),
    },
    async ({ name, text, textType, voice }) => {
        const client = new Graphlit();

        const type = ContentPublishingServiceTypes.ElevenLabsAudio;
        const format = ContentPublishingFormats.Mp3;
        const model = ElevenLabsModels.MultilingualV2;

        try {
        const response = await client.publishText(text, textType, { type: type, format: format, elevenLabs: { model: model, voice: voice } }, name, undefined, true);

        return {
            content: [{
            type: "text",
            text: JSON.stringify({ id: response.publishText?.id }, null, 2)
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
    "sendWebHookNotification",
    `Sends a webhook notification to the provided URL.
    Accepts the webhook URL.
    Also accepts the text to be sent with the webhook, and an optional text type (Plain, Markdown, Html). Defaults to Markdown text type.
    Returns true if the notification was successfully sent, or false otherwise.`,
    { 
        url: z.string(),
        text: z.string(),
        textType: z.nativeEnum(TextTypes).optional().default(TextTypes.Markdown),
    },
    async ({ text, textType, url }) => {
        const client = new Graphlit();

        try {
        const response = await client.sendNotification({ type: IntegrationServiceTypes.WebHook, uri: url }, text, textType);

        return {
            content: [{
            type: "text",
            text: JSON.stringify({ success: response.sendNotification?.result }, null, 2)
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
    "sendSlackNotification",
    `Sends a Slack notification to the provided Slack channel.
    Accepts the Slack channel name.
    Also accepts the text for the Slack message, and an optional text type (Plain, Markdown, Html). Defaults to Markdown text type.
    Hint: In Slack Markdown, images are displayed by simply putting the URL in angle brackets like <https://example.com/image.jpg> instead of using the traditional Markdown image syntax ![alt text](url). 
    Returns true if the notification was successfully sent, or false otherwise.`,
    { 
        channelName: z.string(),
        text: z.string(),
        textType: z.nativeEnum(TextTypes).optional().default(TextTypes.Markdown),
    },
    async ({ text, textType, channelName }) => {
        const botToken = process.env.SLACK_BOT_TOKEN;
        if (!botToken) {
            console.error("Please set SLACK_BOT_TOKEN environment variable.");
            process.exit(1);
        }

        const client = new Graphlit();

        try {
        const response = await client.sendNotification({ type: IntegrationServiceTypes.Slack, slack: { token: botToken, channel: channelName } }, text, textType);

        return {
            content: [{
            type: "text",
            text: JSON.stringify({ success: response.sendNotification?.result }, null, 2)
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
    "sendEmailNotification",
    `Sends an email notification to the provided email address(es).
    Accepts the email subject and a list of email 'to' addresses.
    Email addresses should be in RFC 5322 format. i.e. Alice Wonderland <alice@wonderland.net>, or alice@wonderland.net
    Also accepts the text for the email, and an optional text type (Plain, Markdown, Html). Defaults to Markdown text type.
    Returns true if the notification was successfully sent, or false otherwise.`,
    { 
        subject: z.string(),
        to: z.array(z.string()),
        text: z.string(),
        textType: z.nativeEnum(TextTypes).optional().default(TextTypes.Markdown),
    },
    async ({ text, textType, subject, to }) => {
        const from = process.env.FROM_EMAIL_ADDRESS;
        if (!from) {
            console.error("Please set FROM_EMAIL_ADDRESS environment variable.");
            process.exit(1);
        }

        const client = new Graphlit();

        try {
        const response = await client.sendNotification({ type: IntegrationServiceTypes.Email, email: { subject, from, to } }, text, textType);

        return {
            content: [{
            type: "text",
            text: JSON.stringify({ success: response.sendNotification?.result }, null, 2)
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
}