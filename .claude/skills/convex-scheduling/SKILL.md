---
name: convex-scheduling
description: Convex scheduling and cron jobs - scheduled functions, background tasks, intervals, and recurring job patterns
---

# Convex Scheduling - Scheduled Functions and Cron Jobs

## Scheduling Fundamentals

Convex provides two scheduling mechanisms:
- **Scheduled Functions** - Run once at a specific time or after a delay
- **Cron Jobs** - Run on recurring schedules

## Scheduled Functions

### Schedule from Mutation
```typescript
import { mutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const createReminder = mutation({
  args: { 
    userId: v.id("users"), 
    message: v.string(), 
    delayMinutes: v.number() 
  },
  handler: async (ctx, { userId, message, delayMinutes }) => {
    // Create reminder record
    const reminderId = await ctx.db.insert("reminders", {
      userId,
      message,
      scheduledFor: Date.now() + (delayMinutes * 60 * 1000),
      status: "scheduled",
    });
    
    // Schedule the notification
    await ctx.scheduler.runAfter(
      delayMinutes * 60 * 1000, // delay in milliseconds
      internal.notifications.sendReminder,
      { reminderId }
    );
    
    return reminderId;
  },
});

export const sendReminder = internalAction({
  args: { reminderId: v.id("reminders") },
  handler: async (ctx, { reminderId }) => {
    const reminder = await ctx.runQuery(internal.reminders.getById, { reminderId });
    if (!reminder) return;
    
    // Send notification via external service
    await fetch("https://api.push-service.com/send", {
      method: "POST",
      body: JSON.stringify({ 
        userId: reminder.userId, 
        message: reminder.message 
      }),
    });
    
    // Update status
    await ctx.runMutation(internal.reminders.updateStatus, {
      reminderId,
      status: "sent",
    });
  },
});
```

### Schedule at Specific Time
```typescript
export const scheduleReport = mutation({
  args: { reportTime: v.number() },
  handler: async (ctx, { reportTime }) => {
    const delay = reportTime - Date.now();
    if (delay <= 0) throw new Error("Time must be in the future");
    
    await ctx.scheduler.runAfter(
      delay,
      internal.reports.generate,
      {}
    );
  },
});
```

## Cron Jobs

### Cron Configuration
```typescript
// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run every minute
crons.interval(
  "check pending orders",
  { minutes: 1 },
  internal.orders.checkPending
);

// Run every hour
crons.interval(
  "sync analytics",
  { hours: 1 },
  internal.analytics.sync
);

// Run daily at specific time (UTC)
crons.daily(
  "send daily digest",
  { hourUTC: 9, minuteUTC: 0 }, // 9:00 AM UTC
  internal.emails.sendDailyDigest
);

// Run weekly
crons.weekly(
  "weekly report",
  { dayOfWeek: "monday", hourUTC: 10, minuteUTC: 0 },
  internal.reports.generateWeekly
);

// Run monthly
crons.monthly(
  "monthly cleanup",
  { day: 1, hourUTC: 2, minuteUTC: 0 },
  internal.cleanup.monthly
);

// Traditional cron syntax
crons.cron(
  "backup database",
  "0 2 * * *", // 2 AM UTC daily
  internal.backup.create
);

export default crons;
```

### Cron Job Implementations
```typescript
// convex/cleanup.ts
import { internalMutation } from "./_generated/server";

export const monthly = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Delete old records
    const oldRecords = await ctx.db
      .query("logs")
      .withIndex("by_timestamp")
      .filter(q => q.lt(q.field("timestamp"), Date.now() - 30 * 24 * 60 * 60 * 1000))
      .take(1000);
    
    for (const record of oldRecords) {
      await ctx.db.delete(record._id);
    }
    
    console.log(`Deleted ${oldRecords.length} old log records`);
  },
});
```

## Long-Running Tasks Pattern

```typescript
// For long-running tasks, use actions
export const processLargeDataset = internalAction({
  args: {},
  handler: async (ctx) => {
    // Get batch of items to process
    const items = await ctx.runQuery(internal.items.getPendingBatch, { limit: 100 });
    
    for (const item of items) {
      try {
        // Process each item (can take time)
        const result = await processItem(item);
        
        // Update status
        await ctx.runMutation(internal.items.updateStatus, {
          itemId: item._id,
          status: "processed",
          result,
        });
      } catch (error) {
        await ctx.runMutation(internal.items.updateStatus, {
          itemId: item._id,
          status: "failed",
          error: error.message,
        });
      }
    }
    
    // Schedule next batch if more items exist
    const remaining = await ctx.runQuery(internal.items.countPending);
    if (remaining > 0) {
      await ctx.scheduler.runAfter(
        0, // Run immediately
        internal.items.processLargeDataset,
        {}
      );
    }
  },
});
```

## Error Handling in Scheduled Jobs

```typescript
export const robustCronJob = internalMutation({
  args: {},
  handler: async (ctx) => {
    try {
      // Main job logic
      await processData(ctx);
      
      // Log success
      await ctx.db.insert("jobLogs", {
        job: "robustCronJob",
        status: "success",
        timestamp: Date.now(),
      });
    } catch (error) {
      // Log failure
      await ctx.db.insert("jobLogs", {
        job: "robustCronJob",
        status: "failed",
        error: error.message,
        timestamp: Date.now(),
      });
      
      // Optionally schedule retry
      await ctx.scheduler.runAfter(
        5 * 60 * 1000, // 5 minutes
        internal.jobs.robustCronJob,
        {}
      );
    }
  },
});
```

## Best Practices

1. **Use internal functions** for scheduled jobs (not exposed to clients)
2. **Handle errors gracefully** with logging and optional retries
3. **Break up long jobs** into smaller batches
4. **Use actions** for jobs that need external API calls
5. **Log job execution** for debugging and monitoring
6. **Test cron schedules** carefully before deploying
7. **Consider time zones** - cron times are in UTC