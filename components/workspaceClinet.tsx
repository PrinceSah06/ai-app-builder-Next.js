"use client";
import React, { use, useCallback, useState } from "react";
import CodePanel from "./CodePanel";
import { FileData, Message, StatuStep } from "@/types/workspace";
import { stat } from "fs";
import ChatPanel from "./ChatPanel";
import { CREDIT_COST_PER_GENERATION } from "@/lib/constants";









interface workspaceClinetProps{
  initialPrompt:string | null;
  userCredits : number;
  userId:string;
  userPlan:string
}




const workspaceClinet = ({initialPrompt,userCredits,userId,userPlan}:workspaceClinetProps) => {
  const [workspaceId,setWorkspaceId]=useState<string | null>(null)
const [messages,setMessages]=useState<Message[]>([])
const [credits,setCredits]=useState(userCredits)



  const [fileData, SetFileData] = useState<FileData | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [statusLog, setStatusLogs] = useState<StatuStep[]>([]);

  const handleFilePatch = useCallback((patches: FileData) => {
    SetFileData(patches);
  }, []);

  const handleGenerate = useCallback(async(prompt:string,imageUrl?:string)=>{

},[credits,isGenerating,userId])


  return (
    <div className={`flex h-[calc(100vh-4rem)] overflow-hidden bg-[#0a0a0a]`}>
      <ChatPanel
      appTitle={"Test Title"}
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

export default workspaceClinet;
