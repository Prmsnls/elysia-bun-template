---
name: convex-file-storage
description: Convex file storage for uploads, downloads, and serving files - storage APIs, metadata, and integration patterns
---

# Convex File Storage - Upload, Download, and Serving Files

## File Storage Fundamentals

Convex File Storage provides:
- **Upload** files from client or server
- **Store** files generated or fetched from APIs
- **Serve** files via URL
- **Delete** files when no longer needed
- All file types supported with CDN delivery

## Uploading Files

### Client-Side Upload with Mutation
```typescript
// convex/files.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveFile = mutation({
  args: { 
    storageId: v.id("_storage"),
    filename: v.string(),
    contentType: v.string(),
  },
  handler: async (ctx, { storageId, filename, contentType }) => {
    return await ctx.db.insert("files", {
      storageId,
      filename,
      contentType,
      uploadedAt: Date.now(),
    });
  },
});
```

### React Upload Component
```typescript
// src/FileUpload.tsx
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

export function FileUpload() {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const saveFile = useMutation(api.files.saveFile);
  
  const handleUpload = async (file: File) => {
    // Step 1: Get upload URL
    const uploadUrl = await generateUploadUrl();
    
    // Step 2: Upload to storage
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    
    const { storageId } = await response.json();
    
    // Step 3: Save file metadata
    await saveFile({
      storageId,
      filename: file.name,
      contentType: file.type,
    });
  };
  
  return (
    <input 
      type="file" 
      onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} 
    />
  );
}
```

### HTTP Action Upload
```typescript
// convex/http.ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/upload",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const blob = await request.blob();
    const filename = request.headers.get("x-filename") || "upload";
    const contentType = request.headers.get("content-type") || "application/octet-stream";
    
    // Store file
    const storageId = await ctx.storage.store(blob);
    
    // Save metadata
    const fileId = await ctx.runMutation(api.files.saveFile, {
      storageId,
      filename,
      contentType,
    });
    
    return new Response(
      JSON.stringify({ fileId, storageId }),
      { 
        status: 201,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }),
});

export default http;
```

## Serving Files

### Get File URL (Query)
```typescript
export const getFileUrl = query({
  args: { fileId: v.id("files") },
  handler: async (ctx, { fileId }) => {
    const file = await ctx.db.get(fileId);
    if (!file) return null;
    
    return await ctx.storage.getUrl(file.storageId);
  },
});
```

### Serve via HTTP Action
```typescript
http.route({
  pathPrefix: "/files/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const fileId = url.pathname.replace("/files/", "");
    
    const file = await ctx.runQuery(api.files.getById, { fileId });
    if (!file) {
      return new Response("Not found", { status: 404 });
    }
    
    const blob = await ctx.storage.get(file.storageId);
    if (!blob) {
      return new Response("File data not found", { status: 404 });
    }
    
    return new Response(blob, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `inline; filename="${file.filename}"`,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  }),
});
```

## Storing Files from Actions

```typescript
// Store file fetched from external API
export const fetchAndStoreImage = action({
  args: { url: v.string() },
  handler: async (ctx, { url }) => {
    // Fetch from external source
    const response = await fetch(url);
    const blob = await response.blob();
    
    // Store in Convex
    const storageId = await ctx.storage.store(blob);
    
    // Save metadata
    const fileId = await ctx.runMutation(internal.files.create, {
      storageId,
      filename: url.split("/").pop() || "image",
      contentType: response.headers.get("content-type") || "image/jpeg",
      source: url,
    });
    
    return fileId;
  },
});
```

## File Processing with Node.js

```typescript
// convex/imageProcessing.ts
"use node";

import { action } from "./_generated/server";
import sharp from "sharp";

export const createThumbnail = action({
  args: { 
    storageId: v.id("_storage"),
    width: v.number(),
    height: v.number(),
  },
  handler: async (ctx, { storageId, width, height }) => {
    // Get original image
    const imageBuffer = await ctx.storage.get(storageId);
    if (!imageBuffer) throw new Error("Image not found");
    
    // Process with Sharp
    const thumbnail = await sharp(imageBuffer)
      .resize(width, height, { fit: "cover" })
      .jpeg({ quality: 80 })
      .toBuffer();
    
    // Store thumbnail
    const thumbnailId = await ctx.storage.store(thumbnail);
    
    return thumbnailId;
  },
});
```

## Deleting Files

```typescript
export const deleteFile = mutation({
  args: { fileId: v.id("files") },
  handler: async (ctx, { fileId }) => {
    const file = await ctx.db.get(fileId);
    if (!file) throw new Error("File not found");
    
    // Delete from storage
    await ctx.storage.delete(file.storageId);
    
    // Delete metadata
    await ctx.db.delete(fileId);
  },
});
```

## Best Practices

1. **Store metadata separately** from file content
2. **Generate temporary URLs** for secure access
3. **Handle upload errors** gracefully on client
4. **Set appropriate content types** for correct rendering
5. **Use HTTP actions** for webhook-based uploads
6. **Process large files** in actions with Node.js runtime
7. **Clean up orphaned files** with scheduled jobs