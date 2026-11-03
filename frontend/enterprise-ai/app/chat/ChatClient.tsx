"use client";

import dynamic from "next/dynamic";

const ChatPage = dynamic(() => import("@/features/chat/components/ChatPage"), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-[#f7f8fc]" />,
});

export default function ChatClient() {
  return <ChatPage />;
}
