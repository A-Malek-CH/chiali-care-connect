import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  Send,
  Sparkles,
  CalendarCheck,
  Clock,
  Stethoscope,
  MapPin,
  Phone,
  HelpCircle,
  Loader2,
  ChevronDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { CLINIC, SERVICES } from "@/lib/clinic-data";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [
      { title: "AI Health Assistant — Chiali Clinic" },
      {
        name: "description",
        content:
          "Chat with the Chiali Clinic AI assistant to learn about services, book appointments, and get quick answers.",
      },
      { property: "og:title", content: "AI Health Assistant — Chiali Clinic" },
      {
        property: "og:description",
        content: "Get instant answers about Chiali Clinic services and appointments.",
      },
    ],
  }),
  component: AssistantPage,
});

/* ─── Types ───────────────────────────────────────────────────────── */

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface QuickAction {
  label: string;
  icon: typeof Sparkles;
  prompt: string;
}

/* ─── Quick-action chips ──────────────────────────────────────────── */

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Services", icon: Stethoscope, prompt: "What services does the clinic offer?" },
  { label: "Opening hours", icon: Clock, prompt: "What are the clinic's opening hours?" },
  { label: "Book appointment", icon: CalendarCheck, prompt: "How do I book an appointment?" },
  { label: "Location", icon: MapPin, prompt: "Where is the clinic located?" },
  { label: "Contact", icon: Phone, prompt: "How can I contact the clinic?" },
  { label: "Prepare for visit", icon: HelpCircle, prompt: "How should I prepare for my first visit?" },
];

/* ─── Knowledge base (deterministic assistant logic) ──────────────── */

function generateReply(input: string): string {
  const q = input.toLowerCase().trim();

  /* Services */
  if (
    q.includes("service") ||
    q.includes("specialit") ||
    q.includes("department") ||
    q.includes("offer") ||
    q.includes("what do you do") ||
    q.includes("what can")
  ) {
    const list = SERVICES.map((s) => `• **${s.name}** — ${s.description}`).join("\n");
    return `We provide the following medical services:\n\n${list}\n\nWould you like to book an appointment for any of these?`;
  }

  /* Opening hours */
  if (q.includes("hour") || q.includes("open") || q.includes("close") || q.includes("schedule") || q.includes("when")) {
    const hours = CLINIC.hours.map((h) => `• **${h.day}:** ${h.time}`).join("\n");
    return `Our opening hours are:\n\n${hours}\n\nWe recommend arriving 10 minutes before your scheduled time.`;
  }

  /* Location & address */
  if (q.includes("address") || q.includes("location") || q.includes("where") || q.includes("map") || q.includes("direction")) {
    return `📍 We're located at:\n\n**${CLINIC.address}**\n\nYou can find us on [Google Maps](${CLINIC.mapUrl}). There's parking available on-site.`;
  }

  /* Contact */
  if (q.includes("contact") || q.includes("phone") || q.includes("call") || q.includes("email") || q.includes("reach")) {
    return `You can reach us through:\n\n📞 **Phone:** ${CLINIC.phone}\n📧 **Email:** ${CLINIC.email}\n\nOur reception team is available during opening hours.`;
  }

  /* Booking */
  if (
    q.includes("book") ||
    q.includes("appointment") ||
    q.includes("rendez") ||
    q.includes("schedule") ||
    q.includes("reserve")
  ) {
    return `Booking an appointment is easy! Here's how:\n\n1. Go to the **[Appointments](/appointments)** page\n2. Fill in your name and phone number\n3. Choose the medical service you need\n4. Pick your preferred date and time\n5. Submit your request\n\nOur reception team will call you to confirm within a few hours. Would you like me to help with anything else?`;
  }

  /* Prepare for visit */
  if (q.includes("prepare") || q.includes("first visit") || q.includes("bring") || q.includes("before")) {
    return `Great question! Here's what to bring for your visit:\n\n📋 **Documents to bring:**\n• Valid ID card\n• Health insurance card (if applicable)\n• Previous medical records or test results\n• List of current medications\n\n⏰ **On the day:**\n• Arrive 10 minutes early for registration\n• Wear comfortable clothing (especially for examinations)\n• Note down any symptoms or questions you have\n\nAnything else you'd like to know?`;
  }

  /* Pricing / cost */
  if (q.includes("price") || q.includes("cost") || q.includes("fee") || q.includes("pay") || q.includes("insurance")) {
    return `For pricing information:\n\n💰 Consultation fees vary by service and specialist. We accept most health insurance plans.\n\nPlease contact our reception for specific pricing:\n📞 ${CLINIC.phone}\n📧 ${CLINIC.email}\n\nWould you like to know about a specific service?`;
  }

  /* Emergency */
  if (q.includes("emergency") || q.includes("urgent") || q.includes("urgence")) {
    return `🚨 **For emergencies:**\n\nIf you have a life-threatening emergency, please call **115** (SAMU) or go to the nearest hospital emergency department immediately.\n\nFor urgent but non-life-threatening cases, call us at ${CLINIC.phone}. We handle emergencies on Fridays as well.`;
  }

  /* Lab / test results */
  if (q.includes("lab") || q.includes("result") || q.includes("test") || q.includes("blood") || q.includes("analyse")) {
    return `🔬 **Laboratory & Test Results:**\n\nOur on-site lab provides:\n• Blood work and analyses\n• Same-day results for most tests\n• Results delivered digitally or at reception\n\nFor existing results, please contact reception at ${CLINIC.phone}.`;
  }

  /* Imaging */
  if (q.includes("imaging") || q.includes("x-ray") || q.includes("xray") || q.includes("ultrasound") || q.includes("scanner") || q.includes("radio")) {
    return `🩻 **Medical Imaging:**\n\nWe offer the following imaging services on-site:\n• Ultrasound\n• X-ray\n• CT Scanner\n\nImaging appointments can be booked through our [appointments page](/appointments). Choose "Medical Imaging" as the service.`;
  }

  /* Greeting */
  if (q.includes("hello") || q.includes("hi") || q.includes("hey") || q.includes("bonjour") || q.includes("salam") || q.match(/^(yo|sup|good)\b/)) {
    return `Hello! 👋 I'm the Chiali Clinic AI assistant. I'm here to help you with:\n\n• Information about our **medical services**\n• **Opening hours** and location\n• **Booking** an appointment\n• **Preparing** for your visit\n\nWhat would you like to know?`;
  }

  /* Thanks */
  if (q.includes("thank") || q.includes("merci") || q.includes("shukran") || q.includes("great") || q.includes("helpful")) {
    return `You're welcome! 😊 I'm glad I could help. Don't hesitate to ask if you have more questions. We're here to make your healthcare experience as smooth as possible!`;
  }

  /* Goodbye */
  if (q.includes("bye") || q.includes("goodbye") || q.includes("see you") || q.includes("au revoir")) {
    return `Goodbye! 👋 Take care of your health, and don't hesitate to reach out whenever you need us. Have a wonderful day!`;
  }

  /* Fallback */
  return `I appreciate your question! While I may not have the specific answer, I can help you with:\n\n• 🏥 **Clinic services** and specialities\n• 🕐 **Opening hours** and scheduling\n• 📍 **Location** and directions\n• 📅 **Appointment booking** process\n• 📞 **Contact** information\n\nFor specific medical questions, I recommend speaking with our doctors directly. Would you like to try one of these topics?`;
}

/* ─── Component ───────────────────────────────────────────────────── */

function AssistantPage() {
  const { user } = useAuth();
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] ?? "there";

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hi ${firstName}! 👋 I'm your **Chiali Clinic** AI assistant. I can help you with appointment booking, clinic information, services, and more.\n\nWhat can I help you with today?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  /* Auto-scroll to bottom on new messages */
  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  /* Detect if user scrolled up */
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 80;
    setShowScrollBtn(!isNearBottom);
  }, []);

  /* Send message */
  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isTyping) return;

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsTyping(true);

      /* Simulate a short "thinking" delay for realism */
      const delay = 600 + Math.random() * 800;
      setTimeout(() => {
        const reply = generateReply(trimmed);
        const botMsg: Message = {
          id: `bot-${Date.now()}`,
          role: "assistant",
          content: reply,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMsg]);
        setIsTyping(false);
      }, delay);
    },
    [isTyping],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickAction = (prompt: string) => {
    sendMessage(prompt);
  };

  /* ── Render ────────────────────────────────────────────────── */

  return (
    <div className="surface-soft flex min-h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="border-b border-border/50 bg-background/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="relative">
            <Avatar className="size-10 border-2 border-primary/20">
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
                <Bot className="size-5" />
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background bg-green-500" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold tracking-tight">Chiali AI Assistant</h1>
            <p className="text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Sparkles className="size-3 text-primary" />
                Always available to help
              </span>
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/appointments">
              <CalendarCheck className="size-4" />
              Book now
            </Link>
          </Button>
        </div>
      </div>

      {/* Messages area */}
      <div className="relative flex-1 overflow-hidden">
        <ScrollArea
          className="h-full"
          style={{ height: "calc(100vh - 4rem - 3.5rem - 4.5rem)" }}
          onScrollCapture={handleScroll}
        >
          <div ref={scrollRef} className="mx-auto max-w-3xl space-y-1 px-4 py-6">
            {messages.map((msg, i) => (
              <ChatBubble key={msg.id} message={msg} isLast={i === messages.length - 1} />
            ))}

            {isTyping && <TypingIndicator />}

            {/* Quick actions — show only when first message and no user messages yet */}
            {messages.length === 1 && !isTyping && (
              <div className="animate-in fade-in slide-in-from-bottom-4 pt-2 duration-500">
                <p className="mb-3 text-xs font-medium text-muted-foreground">Quick questions</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => handleQuickAction(action.prompt)}
                      className="group inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/80 px-3.5 py-2 text-sm font-medium shadow-card backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-primary/5 hover:shadow-soft active:scale-[0.97]"
                    >
                      <action.icon className="size-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Scroll-to-bottom FAB */}
        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card p-2 shadow-soft transition-all hover:bg-accent animate-in fade-in zoom-in-75"
          >
            <ChevronDown className="size-4" />
          </button>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-border/50 bg-background/80 backdrop-blur-md">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3"
        >
          <Input
            ref={inputRef}
            id="assistant-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me about services, hours, booking…"
            disabled={isTyping}
            className="flex-1 rounded-full border-border/60 bg-card/80 pl-4 shadow-card backdrop-blur-sm transition-shadow focus:shadow-soft"
            autoComplete="off"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isTyping}
            className="size-10 shrink-0 rounded-full shadow-card transition-all hover:shadow-soft disabled:opacity-40"
          >
            {isTyping ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </form>
        <p className="mx-auto max-w-3xl px-4 pb-2 text-center text-[10px] text-muted-foreground/60">
          This assistant provides general clinic information only — not medical advice.
        </p>
      </div>
    </div>
  );
}

/* ─── Chat bubble ─────────────────────────────────────────────────── */

function ChatBubble({ message, isLast }: { message: Message; isLast: boolean }) {
  const isUser = message.role === "user";
  const time = message.timestamp.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={`flex gap-2.5 py-1.5 ${isUser ? "flex-row-reverse" : ""} ${
        isLast ? "animate-in fade-in slide-in-from-bottom-2 duration-300" : ""
      }`}
    >
      {/* Avatar */}
      {!isUser && (
        <Avatar className="mt-0.5 size-8 shrink-0 border border-primary/10">
          <AvatarFallback className="bg-gradient-to-br from-primary/90 to-primary/60 text-xs text-primary-foreground">
            <Bot className="size-3.5" />
          </AvatarFallback>
        </Avatar>
      )}

      {/* Bubble */}
      <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-card ${
            isUser
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "rounded-bl-md border border-border/40 bg-card"
          }`}
        >
          <RenderedContent content={message.content} />
        </div>
        <p
          className={`mt-1 text-[10px] text-muted-foreground/50 ${isUser ? "text-right" : ""}`}
        >
          {time}
        </p>
      </div>
    </div>
  );
}

/* ─── Minimal markdown-ish renderer ──────────────────────────────── */

function RenderedContent({ content }: { content: string }) {
  /* Split content into lines and render basic markdown */
  const parts = content.split("\n");
  return (
    <div className="space-y-1">
      {parts.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;

        /* Bold */
        let html = line.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');

        /* Links */
        html = html.replace(
          /\[([^\]]+)\]\(([^)]+)\)/g,
          '<a href="$2" class="underline underline-offset-2 hover:opacity-80 transition-opacity">$1</a>',
        );

        /* Bullet points */
        if (html.startsWith("• ") || html.startsWith("- ")) {
          html = html.replace(/^[•\-]\s/, "");
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-current opacity-40" />
              <span dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          );
        }

        /* Numbered list */
        const numMatch = html.match(/^(\d+)\.\s/);
        if (numMatch) {
          html = html.replace(/^\d+\.\s/, "");
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="mt-0 w-5 shrink-0 text-right font-semibold opacity-50">
                {numMatch[1]}.
              </span>
              <span dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          );
        }

        return <p key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}

/* ─── Typing indicator ────────────────────────────────────────────── */

function TypingIndicator() {
  return (
    <div className="flex gap-2.5 py-1.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <Avatar className="mt-0.5 size-8 shrink-0 border border-primary/10">
        <AvatarFallback className="bg-gradient-to-br from-primary/90 to-primary/60 text-xs text-primary-foreground">
          <Bot className="size-3.5" />
        </AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-border/40 bg-card px-4 py-3 shadow-card">
        <span className="size-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0ms]" />
        <span className="size-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:150ms]" />
        <span className="size-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:300ms]" />
      </div>
    </div>
  );
}
