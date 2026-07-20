"use client";

import { Message, StatuStep } from "@/types/workspace";
import React, { useEffect, useRef, useState } from "react";
import { BlueTitle } from "./Reusable";
import PricingModal from "./PricingModal";
import { cn } from "@/lib/utils";
import Image from "next/image";
import ReactMarkdown from 'react-markdown'
import {
  ArrowUp,
  Check,
  Loader2,
  Paperclip,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import { useUser } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";
interface ChatPanelProps {
  messages: Message[];
  isGenerating: boolean;
  isImproving: boolean;
  statusLog: StatuStep[];
  credits: number;
  initialPrompt: string | null;
  onGenerate: (prompt: string, imageUrl?: string) => Promise<void>;
  userId: string;
  workspaceId: string | null;
  appTitle: string | null;
  onStop: () => void;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ChatPanel = ({
  messages,
  isGenerating,
  isImproving,
  statusLog,
  credits,
  initialPrompt,
  onGenerate,
  userId,
  workspaceId,
  appTitle,
  onStop,
}: ChatPanelProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [input, setInput] = useState("");


  const [pendingImageUrl,setPendingImageUrl]= useState<string| null >(null)
const[isUploading,setIsUploading] = useState(false)
const fileRef = useRef<HTMLInputElement>(null)

const hasAutoSubmittedRef = useRef(false);
  const noCredits = credits <= 0;

  const { user } = useUser();

  const canSubmit =
    input.trim().length > 0 && !isGenerating && !isImproving && !isUploading && !noCredits;


  // auto size
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isGenerating, isImproving]);

  // Auto sumbit initalprompt exaclty once on mount
  // Guard ref prevents double-fire in Teact StrictMode

  useEffect(() => {
    if (!initialPrompt || hasAutoSubmittedRef.current || messages.length > 0)
      return;

    hasAutoSubmittedRef.current = true;
    onGenerate(initialPrompt);
  }, [initialPrompt, messages.length, onGenerate]);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };
  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || isGenerating || isImproving || noCredits) return;

    setInput("");
    setPendingImageUrl(null)

    // img ulr
    await onGenerate(trimmed,pendingImageUrl?? undefined);
  };
  const handleFileChange = async(e:React.ChangeEvent<HTMLInputElement>)=>{

    const file = e.target.files?.[0]
    if(!file || !file.type.startsWith("image/"))return;
    setIsUploading(true)

    try {
      const ext = file.name.split(".").pop()
      // path : userId/workspaceId/Timestamp.ext
      // workspaceId may be "new " before first gereration
      const path  = `${userId}/${workspaceId ?? "new"}/${Date.now()}.${ext}`;

      const {error} = await supabase.storage.from("Forge-bucket")
      .upload(path,file,{upsert:true})



if(error) throw error;



const {data} = supabase.storage.from('Forge-bucket').
getPublicUrl(path);

setPendingImageUrl(data.publicUrl)





    } catch (error) {
      const message = error instanceof Error ? error.message :String(error)
      toast.error(message)

    }finally{
      setIsUploading(false);
      if(fileRef.current) fileRef.current.value =''
    }

  }

  return (
    <div className="flex w-[320px] shrink-0 flex-col bg-[#0d0d0d]">
      <div className="flex items-center justify-between border-b border-white/6 px-4 py-3">
        <BlueTitle>{appTitle}</BlueTitle>
        <PricingModal resion={noCredits ? "credits" : "upgrade"}>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] transition-colors",
              noCredits
                ? "bg-red-500/15 text-red-400/80 hover:bg-red-500/25"
                : "bg-white/6 text-white/30 hover:bg-white/10 hover:text-white/50",
            )}
          >
            {noCredits ? "No Credits. Upgrade" : `${credits !== 1 ? "s" : ""}`}
          </span>
        </PricingModal>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-4 [&::-webkit-scrollbar]:hidden"
      >
        {messages.length === 0 && !isGenerating && (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-sx text-white/20">
              Describe What you want to build...
            </p>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === "user" ? (
                <div className="max-w-[85%] space-y-1.5">
                  {/* show msg if present */}

                  {msg.imageUrl && (
                    <img
                      src={msg.imageUrl}
                      alt="Uploaded"
                      className="max-h-40 w-full rounded-lg object-cover"
                    />
                  )}

                  <div className="rounded-2xl rounded-br-sm bg-white/10  px-3.5 p-2.5">
                    <p className="text-[13px] leading-relaxed text-white/80 wrap-break-word">
                      {msg.content}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <Image
                    src={"/logo-short.jpeg"}
                    alt="Forge"
                    width={24}
                    height={24}
                    className="mt-0.5 h-6 w-6 shrink-0 rounded-md"
                  />
                  <div className=" prose prose-sm prose-invert
                  max-w-none text-[13px] leading-relaxed text-white/70 wrap-break-word
                  [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:text-blue-300/80 [&_code]:text-sx [&_li]:my-0.5  [&_p]:my-1 [&_ul]:my-1">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              )}

              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={user.fullName ?? "You "}
                  className="mt-0.5 h-6 w-6 shrink-0 rounded-full"
                />
              ) : (
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10  text-[10px] font-semibold text-white/50">
                  {user?.firstName?.[0] ?? "U"}
                </div>
              )}
            </div>
          ))}

          {/* statsu */}

          {isGenerating && (
            <div className=" flex items-start gap-2">
              <Image
                src={"/logo-short.jpeg"}
                alt="Forge"
                width={24}
                height={24}
                className="mt-0.5 h-6 w-6 shrink-0 rounded-md"
              />

              <div className="rounded-2xl rounded-tl-sm bg-white/5 px-3.5 py-3">
                <div className="space-y-2">
                  {statusLog.map((s, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className="flex h-4 w-4 shrink-0 items-center justify-center">
                        {s.status === "running" ? (
                          <Loader2 className="h-3 w-3 animate-spin text-blue-400/80" />
                        ) : (
                          <Check className="h-3 w-3 text-white/25" />
                        )}
                      </div>

                      <span
                        className={cn(
                          "text-[12px] transition-colors duration-300",
                          s.status === "running"
                            ? "text-white/75"
                            : "text-white/25",
                        )}
                      >
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        {/* todo? img secition */}
      </div>
      {noCredits &&  <div className="mx-3 mb-2 rounded-xl border border-red-500/15 bg-red-950/40 px-4 py-3">
        <p className="mb-2 text-[12px] font-medium text-red-400/80">
          ypu&apos;ve used all your credits</p>


          <PricingModal resion="credits">
            <span className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-white px-3 text-xs text-black active:scale-95">
              <Sparkles className="n-3 w-3"/>
              Upgrade plan
              </span>
              </PricingModal>
              </div>}

      <div className="border-t border-white/6 p-3">
      {pendingImageUrl && (
        <div className="relative mb-2 w-fit">
          <img
          src={pendingImageUrl}
          alt="pending"
          className="h-16 w-16 rounded-lg object-cover"/>
          <button
          onClick={() => setPendingImageUrl(null)}
          className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/80 hover:text-white">
            <X className="h-2.5 w-2.5"/>
          </button>
        </div>
      )}




        <div
          className={cn(
            "rounded-xl border bg-white/4 transition-colors ",
            isGenerating || isImproving || noCredits
              ? "border-white/4 opacity-60"
              : "border-white/8 hover:border-white/12",
          )}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isGenerating || isImproving || noCredits}
            placeholder={
              noCredits
                ? "Upgrade to keep building..."
                : isImproving
                  ? "cline is Imporoving your app..."
                  : isGenerating
                    ? "Generating..."
                    : "Ask AI to Modify"
            }
            rows={1}
            className="w-full resize-none bg-transparent px-3.5 pb-2 pt-3 text-[13px] text-white/80  placeholder:text-white/20 focus:outline-none"
            style={{ maxHeight: 160 }}
          />

          <div className="flex items-center justify-between px-2 pb-2">
            <Button
              variant={"ghost"}
              size={"icon"}
              onClick={()=> fileRef.current?.click()}
              disabled={isGenerating || isImproving || noCredits || isUploading}
              className={"h-7 w-7 rounded-lg text-white/25  hover:bg-white/6  hover:text-white/50 disabled:opacity-40"}
            >
              <Paperclip className="h-3.5 w-3.5" />

              {isUploading  ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowUp className="h-3.5 w-3.5" />
              )}
            </Button>


            <input ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}/>
            {isGenerating || isImproving ? (
              <Button
                size={"icon"}
                onClick={onStop}
                className={
                  "h-7 w-7  rounded-lg bg-white/10 text-white/60  hover:bg-white/20 hover:text-white active:scale-95 transition-all"
                }
              >
                <Square className=" h-3 w-3 fill-current" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                size={"icon"}
                disabled={!canSubmit}
                className={cn(
                  "h-7 rounded-lg transition-all ",
                  canSubmit
                    ? "bg-white text-black hover:bg-white/90 active:scale-95"
                    : "bg-white/8 text-white/20 shadow-none",
                )}
              >
                {isGenerating || isImproving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowUp className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
          </div>
        </div>

        <p className="mt-1.5 text-center text-[10px] text-white/20">
          {isGenerating || isImproving
            ? "click to stop genration"
            : " ↩️ to send . Shift+↩️ for new line "}{" "}
        </p>
      </div>
    </div>
  );
};

export default ChatPanel;
