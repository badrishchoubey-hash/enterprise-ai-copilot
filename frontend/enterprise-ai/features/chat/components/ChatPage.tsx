"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Bot, FileText, LoaderCircle, Send, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Header from "@/components/layout/Header/Header";
import Sidebar from "@/components/layout/Sidebar/Sidebar";
import Button from "@/components/ui/button/button";
import Input from "@/components/ui/input/input";
import { askQuestion, getAskErrorMessage } from "@/services/api/ai";
import type { ChatMessage } from "@/features/chat/types";

const questionSchema = z.object({
  question: z.string().trim().min(1, "Enter a question").max(2000, "Questions can be up to 2000 characters"),
});
type QuestionValues = z.infer<typeof questionSchema>;

const suggestedQuestions = [
  "What is our work-from-home policy?",
  "How do I request IT support?",
  "What should I do if I suspect a security incident?",
];

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [requestError, setRequestError] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const latestMessageRef = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<QuestionValues>({
    resolver: zodResolver(questionSchema) as never,
    defaultValues: { question: "" },
  });
  const question = watch("question");
  const canAsk = useMemo(() => Boolean(question?.trim()) && !isAsking, [question, isAsking]);

  useEffect(() => {
    latestMessageRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, isAsking]);

  const submitQuestion = useCallback(async (values: QuestionValues) => {
    setRequestError("");
    setIsAsking(true);
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: values.question.trim() },
    ]);
    reset({ question: "" });

    try {
      const response = await askQuestion({
        question: values.question.trim(),
        ...(conversationId ? { conversationId } : {}),
      });
      setConversationId(response.conversationId);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.answer,
          sources: response.sources,
        },
      ]);
    } catch (error) {
      setRequestError(getAskErrorMessage(error));
    } finally {
      setIsAsking(false);
    }
  }, [conversationId, reset]);

  return (
    <div className="flex min-h-screen bg-[#f7f8fc] text-[#182230]">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isAdmin={false}
      />
      <main className="min-w-0 flex-1 pt-[72px] sm:pt-[86px]">
        <Header isAdmin={false} onOpenSidebar={() => setSidebarOpen(true)} />
        <div className="mx-auto flex min-h-[calc(100vh-72px)] max-w-[1050px] flex-col px-4 py-6 sm:min-h-[calc(100vh-86px)] sm:px-8 sm:py-8">
          <div className="mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#9ca5b2]">
              Employee workspace
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#263244] sm:text-3xl">
              Ask the knowledge base
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#7d899b]">
              Ask a question about company documents. Answers are grounded in documents your account is allowed to access and include source citations.
            </p>
          </div>

          <section aria-label="AI conversation" className="flex min-h-[430px] flex-1 flex-col overflow-hidden rounded-2xl border border-[#e5e8f0] bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-[#edf0f5] px-4 py-4 sm:px-6">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eeedff] text-[#5146e5]">
                <Bot size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-[#293548]">Nexa AI assistant</h2>
                <p className="text-xs text-[#8a94a4]">Answers from your authorized knowledge sources</p>
              </div>
              {conversationId && <span className="ml-auto hidden rounded-full bg-[#f3f4f8] px-3 py-1 text-[11px] text-[#718096] sm:inline">Conversation saved</span>}
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite" aria-relevant="additions text">
              {messages.length === 0 ? (
                <div className="mx-auto flex max-w-xl flex-col items-center py-7 text-center sm:py-12">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eeedff] text-[#5146e5]">
                    <Sparkles size={22} aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-[#293548]">What would you like to know?</h3>
                  <p className="mt-2 text-sm leading-6 text-[#8490a1]">Try a suggested question or type your own below.</p>
                  <div className="mt-5 flex w-full flex-col gap-2">
                    {suggestedQuestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setValue("question", suggestion, { shouldValidate: true })}
                        className="rounded-xl border border-[#e8eaf1] px-4 py-3 text-left text-sm text-[#5c687a] transition hover:border-[#c9c5ff] hover:bg-[#fafaff] hover:text-[#5146e5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5146e5]"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <article key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    {message.role === "assistant" && <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#eeedff] text-[#5146e5]"><Bot size={16} aria-hidden="true" /></span>}
                    <div className={`max-w-[88%] sm:max-w-[78%] ${message.role === "user" ? "rounded-2xl rounded-br-md bg-[#5146e5] px-4 py-3 text-white" : "min-w-0"}`}>
                      <p className={`whitespace-pre-wrap break-words text-sm leading-6 ${message.role === "assistant" ? "text-[#354155]" : ""}`}>{message.content}</p>
                      {!!message.sources?.length && (
                        <div className="mt-4 space-y-2 border-t border-[#edf0f5] pt-3">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-[#8490a1]">Sources</p>
                          {message.sources.map((source) => (
                            <div key={source.chunkId} className="flex gap-2 rounded-xl border border-[#e9ebf2] bg-white p-3">
                              <FileText size={16} className="mt-0.5 shrink-0 text-[#5146e5]" aria-hidden="true" />
                              <div className="min-w-0">
                                <p className="break-words text-xs font-semibold text-[#39465a]">[{source.sourceId}] {source.documentName}</p>
                                <p className="mt-1 text-[11px] text-[#8792a3]">
                                  {[source.page === null ? null : `Page ${source.page}`, source.section, `Relevance ${Math.round(source.score * 100)}%`].filter(Boolean).join(" · ")}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                ))
              )}
              {isAsking && (
                <div className="flex items-center gap-3 text-sm text-[#7d899b]" role="status">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#eeedff] text-[#5146e5]"><LoaderCircle size={16} className="animate-spin" aria-hidden="true" /></span>
                  Searching authorized documents and preparing an answer…
                </div>
              )}
              <div ref={latestMessageRef} />
            </div>

            {requestError && <p role="alert" className="mx-4 mb-3 rounded-xl border border-[#f4caca] bg-[#fff5f5] px-4 py-3 text-sm text-[#bd4242] sm:mx-6">{requestError}</p>}

            <form onSubmit={handleSubmit(submitQuestion)} className="border-t border-[#edf0f5] p-3 sm:p-5">
              <label htmlFor="chat-question" className="sr-only">Ask a question</label>
              <div className="flex items-end gap-2 sm:gap-3">
                <div className="min-w-0 flex-1">
                  <Input
                    id="chat-question"
                    placeholder="Ask a question about company knowledge…"
                    autoComplete="off"
                    aria-invalid={Boolean(errors.question)}
                    aria-describedby={errors.question ? "chat-question-error" : "chat-question-hint"}
                    className="min-h-12 w-full rounded-xl border border-[#e1e5ed] px-4 py-3 text-sm outline-none focus:border-[#716be8]"
                    {...register("question")}
                  />
                  {errors.question ? (
                    <p id="chat-question-error" className="mt-1 px-1 text-xs text-red-600">{errors.question.message}</p>
                  ) : (
                    <p id="chat-question-hint" className="mt-1 px-1 text-[11px] text-[#9aa3b1]">Answers can only use knowledge you’re authorized to access.</p>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={!canAsk}
                  aria-label="Send question"
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#5146e5] p-0 text-white hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send size={17} aria-hidden="true" />
                </Button>
              </div>
            </form>
          </section>
          <p className="mt-3 text-center text-[11px] text-[#9aa3b1]">AI responses may be incomplete. Check the cited source documents for important decisions.</p>
        </div>
      </main>
    </div>
  );
}
