---
name: convex-react
description: Convex React integration - hooks, provider setup, optimistic updates, pagination, and real-time subscription patterns
---

# Convex React - Client Integration and Hooks

## Setup

### ConvexProvider
```typescript
// src/main.tsx
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </React.StrictMode>
);
```

## useQuery - Reactive Data Fetching

### Basic Usage
```typescript
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

function MessageList() {
  const messages = useQuery(api.messages.list);
  
  if (messages === undefined) return <div>Loading...</div>;
  
  return (
    <div>
      {messages.map(msg => (
        <div key={msg._id}>{msg.body}</div>
      ))}
    </div>
  );
}
```

### With Arguments
```typescript
function ChannelMessages({ channelId }: { channelId: string }) {
  const messages = useQuery(api.messages.byChannel, { channelId });
  
  // Component re-renders automatically when data changes
  return messages?.map(msg => <Message key={msg._id} message={msg} />);
}
```

### Conditional Queries (Skip)
```typescript
function UserProfile({ userId }: { userId: string | null }) {
  // Use "skip" to conditionally skip the query
  const user = useQuery(
    api.users.getById,
    userId ? { userId } : "skip"
  );
  
  if (!userId) return <div>No user selected</div>;
  if (user === undefined) return <div>Loading...</div>;
  
  return <div>{user.name}</div>;
}
```

## useMutation - Data Modifications

### Basic Usage
```typescript
import { useMutation } from "convex/react";

function CreateMessage() {
  const createMessage = useMutation(api.messages.create);
  const [text, setText] = useState("");
  
  const handleSubmit = async () => {
    await createMessage({ body: text });
    setText("");
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input value={text} onChange={e => setText(e.target.value)} />
      <button type="submit">Send</button>
    </form>
  );
}
```

### With Error Handling
```typescript
function CreateUser() {
  const createUser = useMutation(api.users.create);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async (data: FormData) => {
    try {
      await createUser({
        name: data.get("name") as string,
        email: data.get("email") as string,
      });
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}
      {/* form fields */}
    </form>
  );
}
```

### Optimistic Updates
```typescript
function LikeButton({ postId }: { postId: Id<"posts"> }) {
  const likePost = useMutation(api.posts.like).withOptimisticUpdate(
    (localStore, { postId }) => {
      const post = localStore.getQuery(api.posts.getById, { postId });
      if (post) {
        localStore.setQuery(api.posts.getById, { postId }, {
          ...post,
          likes: post.likes + 1,
        });
      }
    }
  );
  
  return <button onClick={() => likePost({ postId })}>Like</button>;
}
```

## useAction - External API Calls

```typescript
import { useAction } from "convex/react";

function ProcessPayment() {
  const processPayment = useAction(api.payments.process);
  const [loading, setLoading] = useState(false);
  
  const handlePayment = async () => {
    setLoading(true);
    try {
      const result = await processPayment({ amount: 1000 });
      console.log("Payment processed:", result);
    } catch (e) {
      console.error("Payment failed:", e);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <button onClick={handlePayment} disabled={loading}>
      {loading ? "Processing..." : "Pay $10"}
    </button>
  );
}
```

## usePaginatedQuery - Infinite Scroll

```typescript
import { usePaginatedQuery } from "convex/react";

function InfiniteMessageList() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.messages.list,
    {},
    { initialNumItems: 20 }
  );
  
  return (
    <div>
      {results.map(msg => (
        <div key={msg._id}>{msg.body}</div>
      ))}
      
      {status === "CanLoadMore" && (
        <button onClick={() => loadMore(20)}>Load More</button>
      )}
      
      {status === "LoadingMore" && <div>Loading...</div>}
    </div>
  );
}
```

## Authentication Integration

### With Clerk
```typescript
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";

function App() {
  return (
    <ClerkProvider publishableKey={CLERK_KEY}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <Main />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
```

### Protected Components
```typescript
import { useConvexAuth } from "convex/react";

function ProtectedContent() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  
  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Please sign in</div>;
  
  return <AuthenticatedApp />;
}
```

## Common Patterns

### Loading States
```typescript
function DataComponent() {
  const data = useQuery(api.data.get);
  
  // undefined = loading, null = no data
  if (data === undefined) return <Spinner />;
  if (data === null) return <EmptyState />;
  
  return <DataDisplay data={data} />;
}
```

### Real-time Updates
```typescript
// Data automatically updates across all clients
function LiveChat({ roomId }: { roomId: string }) {
  const messages = useQuery(api.messages.byRoom, { roomId });
  const sendMessage = useMutation(api.messages.send);
  
  // messages automatically updates when anyone sends a message
  return (
    <div>
      {messages?.map(msg => <Message key={msg._id} {...msg} />)}
      <MessageInput onSend={(text) => sendMessage({ roomId, text })} />
    </div>
  );
}
```

## Best Practices

1. **Handle loading states** - useQuery returns undefined while loading
2. **Use "skip"** for conditional queries, not conditional hooks
3. **Implement optimistic updates** for better UX
4. **Handle errors** in mutation callbacks
5. **Use usePaginatedQuery** for large datasets
6. **Wrap app with ConvexProvider** at the root level