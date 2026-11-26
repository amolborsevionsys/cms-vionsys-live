# Vionsys CMS: Architecture Overview

This document describes the architectural layout of the standalone Vionsys Content Management System (CMS) hosted at `cms.vionsys.com` publishing content to `vionsys.com`.

## System Architecture

```mermaid
graph TD
    subgraph CMS Workspace ("cms.vionsys.com")
        EditorCanvas["Editor Writing Canvas"]
        MediaLib["Media Library Explorer"]
        PrismaORM["Prisma Client ORM"]
        Mongo["MongoDB Database"]
        AdminAPI["Private CMS API Middleware"]
        PublicAPI["Public API v1 /api/v1/public/"]
    end

    subgraph Public Website ("vionsys.com")
        NextFrontend["Next.js Frontend"]
        CachePurge["Cache Revalidation Endpoint"]
    end

    EditorCanvas --> AdminAPI
    MediaLib --> AdminAPI
    AdminAPI --> PrismaORM
    PrismaORM --> Mongo
    
    NextFrontend -- "Fetch Content" --> PublicAPI
    AdminAPI -- "POST Revalidation Webhook" --> CachePurge
```

---

## Technical Stack

1. **Backend & Frontend framework**: Next.js App Router (Next.js 16.2.10, React 19.2.4).
2. **Database Persistence**: MongoDB mapped through Prisma ORM (v5). Transactions require a replica set.
3. **Rich Editor Canvas**: Editor.js with a custom block inserter (FAQ, Stats, CTA, Testimonial, Key Takeaways), inserted as Raw HTML blocks.
4. **Authentication**: Cookie-based JWT session. `src/middleware.ts` does an optimistic redirect only; pages and route handlers verify the session and permissions on the server.
5. **Media Storage**: AWS S3.
6. **Aesthetics & Styling**: Vanilla CSS alongside Tailwind CSS (v4) with high-caliber enterprise Blue accents.

---

## Role-Based Access Control (RBAC)

The central RBAC configuration is mapped inside [permissions.ts](../src/config/permissions.ts):

*   **SUPER_ADMIN**: Full system settings, database management, user settings, API keys, delete/publish commands.
*   **CONTENT_MANAGER**: Edit content, publish/unpublish, media management, folder organisation, redirects settings, schema settings.
*   **EDITOR**: Write and edit drafts, upload media. (There is no approval workflow yet. See [rule.md §12 V5](../rule.md#12-known-violations-in-this-repo): the API does not currently stop an EDITOR from setting `status` to `PUBLISHED`.)
*   **VIEWER**: Read-only access for proofreading.
