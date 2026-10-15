"use client";

import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  AlertCircle,
  RotateCcw,
  Bot,
  User,
  ChevronDown,
  Check,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SuggestedActivity {
  title: string;
  cost: number;
  time_slot?: string;
  day_index?: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  suggestedActivity?: SuggestedActivity | null;
  added?: boolean;
}

interface TripAssistantDrawerProps {
  tripId: string;
  tripTitle: string;
}

const QUICK_PROMPTS = [
  "What kind of clothes should I pack for this trip?",
  "Tell me a fun fact about this destination",
  "What is my total cost and budget status?",
  "Recommend a unique local food experience",
];

export function TripAssistantDrawer({
  tripId,
  tripTitle,
}: TripAssistantDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Hello! I am your GlobeTrotter Copilot for **${tripTitle}**. Ask me any question about your trip, packing tips, local culture, daily schedules, or recommendations!`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [addingIdx, setAddingIdx] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  async function handleSendMessage(textToSend?: string) {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    setErrorMsg(null);
    setInput("");

    const updatedMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Copilot failed with status ${res.status}`);
      }

      const replyText = data.replyText || data.message || data.reply;
      if (!replyText) {
        throw new Error(data.error || "No response received from Copilot.");
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: replyText,
          suggestedActivity: data.suggestedActivity || null,
        },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error contacting Copilot";
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddSuggestedActivity(act: SuggestedActivity, msgIdx: number) {
    setAddingIdx(msgIdx);
    setErrorMsg(null);

    try {
      let startTime: string | null = null;
      let endTime: string | null = null;

      if (act.time_slot && act.time_slot.includes("-")) {
        const parts = act.time_slot.split("-");
        startTime = parts[0]?.trim() || null;
        endTime = parts[1]?.trim() || null;
      }

      const res = await fetch(`/api/trips/${tripId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: act.title,
          category: "Sightseeing",
          day_number: act.day_index || 1,
          estimated_cost: act.cost || 0,
          start_time: startTime,
          end_time: endTime,
          notes: "Added via AI Copilot recommendation",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to add activity to itinerary");
      }

      setMessages((prev) =>
        prev.map((m, i) => (i === msgIdx ? { ...m, added: true } : m))
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error saving activity");
    } finally {
      setAddingIdx(null);
    }
  }

  function handleResetChat() {
    setMessages([
      {
        role: "assistant",
        content: `Chat reset! I am ready to help you with **${tripTitle}**. What would you like to ask?`,
      },
    ]);
    setErrorMsg(null);
  }

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-3 text-xs font-bold text-white shadow-lg hover:bg-indigo-700 hover:shadow-xl transition-all"
        >
          <Sparkles className="h-4 w-4 text-indigo-200" />
          <span>Ask Trip Copilot</span>
          <Badge className="bg-indigo-500 text-[10px] text-white py-0 px-1.5 font-normal">
            Gemini
          </Badge>
        </button>
      )}

      {/* Chat Drawer Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-4 sm:right-6 z-50 flex h-[540px] w-[calc(100vw-2rem)] max-w-sm sm:max-w-md flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="leading-tight">
                <h4 className="text-xs font-bold text-slate-900 truncate max-w-[170px] sm:max-w-[210px]">
                  {tripTitle} Copilot
                </h4>
                <span className="text-[10px] text-slate-500">
                  Powered by Google Gemini
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleResetChat}
                title="Clear conversation"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30 text-xs">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-2.5 ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {m.role === "assistant" && (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 mt-0.5">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                )}

                <div className="max-w-[85%] space-y-2">
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-xs shadow-xs leading-relaxed whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-indigo-600 text-white rounded-br-xs"
                        : "bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs"
                    }`}
                  >
                    {m.content}
                  </div>

                  {/* Actionable Structured Recommendation */}
                  {m.suggestedActivity && (
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 p-3 shadow-xs space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">
                            Suggested Activity
                          </span>
                          <span className="font-bold text-slate-900 text-xs">
                            {m.suggestedActivity.title}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-[10px] bg-white text-slate-700 shrink-0">
                          {m.suggestedActivity.cost > 0 ? `$${m.suggestedActivity.cost}` : "Free"}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-600">
                        {m.suggestedActivity.time_slot && (
                          <span>⏰ {m.suggestedActivity.time_slot}</span>
                        )}
                        {m.suggestedActivity.day_index && (
                          <span>📅 Day {m.suggestedActivity.day_index}</span>
                        )}
                      </div>

                      <div className="pt-1">
                        {m.added ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                            <Check className="h-3.5 w-3.5 stroke-[3]" /> Added to Itinerary
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            disabled={addingIdx === idx}
                            onClick={() => handleAddSuggestedActivity(m.suggestedActivity!, idx)}
                            className="h-7 text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-1 shadow-xs"
                          >
                            {addingIdx === idx ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Adding...
                              </>
                            ) : (
                              <>
                                <Plus className="h-3 w-3" />
                                Add to Itinerary
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {m.role === "user" && (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600 mt-0.5">
                    <User className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                <span>Copilot is thinking...</span>
              </div>
            )}

            {errorMsg && (
              <div className="flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[11px] text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold block">Copilot Error</span>
                  <span className="leading-snug">{errorMsg}</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Bar */}
          <div className="border-t border-slate-100 bg-white px-3 py-2 overflow-x-auto flex items-center gap-1.5 no-scrollbar">
            {QUICK_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSendMessage(prompt)}
                disabled={isLoading}
                className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <div className="border-t border-slate-100 bg-white p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask any travel, packing, or itinerary question..."
                disabled={isLoading}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!input.trim() || isLoading}
                className="h-8.5 w-8.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 p-0 text-white shrink-0 shadow-xs"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
