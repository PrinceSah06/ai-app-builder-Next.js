"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import CodePanel from "./CodePanel";
import { FileData, Message, StatuStep, WorkspaceData } from "@/types/workspace";
import ChatPanel from "./ChatPanel";
import { MIN_CREDITS_TO_GENERATE } from "@/lib/constants";
import { toast } from "sonner";

interface workspaceClinetProps {
  initialPrompt: string | null;
  userCredits: number;
  userId: string;
  userPlan: string;
  workspace:WorkspaceData | null
}

function parseMessages(raw:unknown):Message[]{

  if(!Array.isArray(raw)) return []


  return raw.filter(
    (m):m is Message => typeof m === 'object'
    && m!== null
     && "role"  in m &&
      "content" in m)

}

function parseFileData(raw:unknown): FileData | null {
if(!raw || typeof raw !== "object") return null


const f = raw as Record<string ,unknown>;

if(!f.files || !f.dependencies){
  return null
}

return raw as FileData
}

const WorkspaceClient = ({
  initialPrompt,
  userCredits,
  userId,
  workspace
}: workspaceClinetProps) => {
  const [workspaceId, setWorkspaceId] = useState<string | null>(workspace?.id ?? null);
  const [messages, setMessages] = useState<Message[]>(parseMessages(workspace?.messages));
  const [credits, setCredits] = useState(userCredits);

  const [fileData, SetFileData] = useState<FileData | null>(parseFileData(workspace?.fileData));

  const [isGenerating, setIsGenerating] = useState(false);
  const [statusLog, setStatusLogs] = useState<StatuStep[]>([]);

  // Abortcontroller refs - used to cancel in-fight streams

  const generateAbortRef = useRef<AbortController |  null> (null)
  const improveAbortRef = useRef<AbortController |  null> (null)

  const messagesRef = useRef<Message[]>(messages);
  useEffect(()=>{
    messagesRef.current = messages
  },[messages])

  const fileDataRef = useRef<FileData | null>(fileData);

  useEffect(()=>{
    fileDataRef.current = fileData
  },[fileData])



  const workspaceIdRef = useRef<string | null>(workspaceId);

  useEffect(()=>{workspaceIdRef.current = workspaceId},[workspaceId])
  const pushSteps = useCallback((label: string) => {
    setStatusLogs((prev) => [
      ...prev.map((step, index) =>
        index === prev.length - 1 ? { ...step, status: "done" as const } : step,
      ),
      { label, status: "running" as const },
    ]);
  }, []);

  const completeSteps = useCallback(() => {
    setStatusLogs((prev) =>
      prev.map((step, index) =>
        index === prev.length - 1 ? { ...step, status: "done" as const } : step,
      ),
    );
  }, []);


  const handleFilePatch = useCallback((patches: FileData) => {
    SetFileData(patches);
  }, []);

  const handleGenerate = useCallback(
    async (prompt: string, imageUrl?: string) => {

      if(isGenerating) return;
      if(credits < MIN_CREDITS_TO_GENERATE) return

      const userMessage :Message ={
        role:'user',
        content:prompt,
        ...(imageUrl ? {imageUrl}:{})
      }

      const currentMessages = messagesRef.current;
      const currentWorkspaceId = workspaceIdRef.current;

      setMessages((prev)=>[...prev ,userMessage]);
      setIsGenerating(true)
      setStatusLogs([{label:'Thinking...',status:"running"}])

      // create a fresh AbortContoller for this request
      const abortController = new AbortController();
      generateAbortRef.current = abortController;




      try {
        const res = await fetch('/api/gen-ai-code',{
          method:"POST",
          signal:abortController.signal,
          headers:{"Content-type":"application/json"}
          ,body:JSON.stringify({
            workspaceId:currentWorkspaceId,
            userId,
            messages:[...currentMessages,userMessage],
            fileData:fileDataRef.current
          })
        });

        if(res.status=== 402
      )        {
        toast.error("Not enogh credits.");
        setMessages((prev)=>prev.slice(0,-1));
        return
      }

      if(res.status === 429){
        toast.error("Too many requests .Please slow down")
        setMessages((prev)=>prev.slice(0,-1))
        return
      }

      if(!res.ok  || !res.body) throw new Error("Generation Failed")

        const reader = res.body.getReader();
        const decoder = new TextDecoder()
        let buffer = ''


        while(true){

          const {done,value} = await reader.read()
          if(done){
            break
          }

          buffer += decoder.decode(value,{stream:true})

          const lines = buffer.split(`\n\n`)


          buffer = lines.pop() ??'';


          for(const line of lines){
            if(
              !line.startsWith("data:")
            ){

            continue;
            }
            try {
              const event  = JSON.parse(line.slice(6));

              if(event.type === "status"){
                pushSteps(event.message);
              }else if(event.type === "done"){
                completeSteps();
                setWorkspaceId(event.workspaceId);
                SetFileData(event.fileData);
                setCredits(event.creditsRemaining);
                setMessages((prev)=>[
                  ...prev,{role:'assistant',content:event.assistantMessage}
                ]);
                window.history.replaceState(null,"",`/workspace?id=${event.workspaceId}`)
              }
            } catch {
              // skip Malformed sse lines
            }
          }
        }
      } catch (error) {

        // User-initiated stop - silently roll back the user message

        if(error instanceof Error && error.name === "AbortError"){
          setMessages((prev)=> prev.slice(0,-1))
          return ;
        }

        toast.error(
          error instanceof Error ? error.message :'Something went wrong',
        );
          setMessages((prev)=> prev.slice(0,-1))

      }finally{

      generateAbortRef.current = null
        setIsGenerating(false)
        setStatusLogs([])
      }
    },
    [completeSteps, credits, isGenerating, pushSteps, userId],
  );

  const handleStop = useCallback(() => {
    generateAbortRef.current?.abort();
    improveAbortRef.current?.abort();
  }, []);


  return (
    <div className={`flex h-[calc(100vh-4rem)] overflow-hidden bg-[#0a0a0a]`}>
      <ChatPanel
        appTitle={fileData?.title ?? workspace?.title?? null}
        credits={credits}
        initialPrompt={initialPrompt}
        isGenerating={isGenerating}
        isImproving={false}
        messages={messages}
        onGenerate={handleGenerate}
        statusLog={statusLog}
        userId={userId}
        workspaceId={workspaceId}
        key={0}

onStop={handleStop}
      />
      <CodePanel
        fileData={fileData}
        inGenerating={isGenerating}
        statusLog={statusLog}
        onFilePatch={handleFilePatch}
      />
    </div>
  );
};

export default WorkspaceClient;
