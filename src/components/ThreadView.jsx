import { useEffect, useState, useMemo, useCallback } from "react";
import { fetchReplies, buildReplyTree, updateRepliesCache } from "../lib/nostr";
import { ReplyComposer } from "./ReplyComposer";
import { ReplyItem } from "./ReplyItem";

function ReplyNode({ node, depth, onReply }) {
  const indentClass = depth > 0 ? "ml-4 border-l-2 border-gray-100 pl-3" : "";
  return (
    <div className={indentClass}>
      <ReplyItem event={node.event} onReply={() => onReply(node.event)} />
      {node.children.map((child) => (
        <ReplyNode
          key={child.event.id}
          node={child}
          depth={depth + 1}
          onReply={onReply}
        />
      ))}
    </div>
  );
}

export function ThreadView({ rootEvent }) {
  const [replies, setReplies] = useState([]);       // flat list
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const tree = useMemo(
    () => buildReplyTree(replies, rootEvent.id),
    [replies, rootEvent.id]
  );

  const loadReplies = useCallback(() => {
    setLoading(true);
    fetchReplies(rootEvent.id).then((events) => {
      setReplies(events);
      setLoading(false);
    });
  }, [rootEvent.id]);

  useEffect(() => {
    loadReplies();
  }, [loadReplies]);

  const handleNewReply = (publishedEvent) => {
    setComposerOpen(false);
    setReplyTo(null);

    if (publishedEvent) {
      setReplies((prev) => {
        // Deduplicate in case the reply somehow already exists
        if (prev.some((r) => r.id === publishedEvent.id)) return prev;

        const next = [...prev, publishedEvent];

        // Persist this updated list into the cache, so if the user
        // closes and reopens the thread before relays index the reply,
        // the cache still contains the new reply.
        updateRepliesCache(rootEvent.id, next);

        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="p-3 text-xs text-gray-400 text-center">
        উত্তর লোড হচ্ছে...
      </div>
    );
  }

  return (
    <div className="mt-2 ml-2">
      {tree.length === 0 && !composerOpen && (
        <p className="text-xs text-gray-400 py-2">এখনো কোনো উত্তর নেই</p>
      )}

      {tree.map((node) => (
        <ReplyNode
          key={node.event.id}
          node={node}
          depth={1}
          onReply={(ev) => {
            setReplyTo(ev);
            setComposerOpen(true);
          }}
        />
      ))}

      {composerOpen ? (
        <ReplyComposer
          parentEvent={replyTo || rootEvent}
          onPublished={handleNewReply}
          onCancel={() => {
            setComposerOpen(false);
            setReplyTo(null);
          }}
        />
      ) : (
        <button
          onClick={() => {
            setReplyTo(null);
            setComposerOpen(true);
          }}
          className="mt-2 text-xs text-blue-500 hover:text-blue-600"
        >
          + উত্তর লিখুন
        </button>
      )}
    </div>
  );
}