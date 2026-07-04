import { label } from "motion/react-client";

export type MessageRole = "user" | "assistant"

export interface Message{
    role:MessageRole;
    content:string;
    imageUrl?:string;
}


//file + dependencies always travel together as  one unit
// this is what get saved to prisma as a  single json coulum

export interface FileData{
    files:Record<string,{code:string}>;
    dependencies:Record<string,string>;
    title?:string;
}

export interface StatuStep{
    label:string;
    status:"running"| "done";
}

export interface WorkspaceData{
    id:string;
    title:string|null;
    message:unknown;
    fileData:unknown;
}


export interface WorkspaceUser{
    id:string;
    credits:number;
    plan:string;
}