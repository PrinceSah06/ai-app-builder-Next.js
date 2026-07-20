
import { getWorkspaceById, getWorkspaceUser } from '@/actions/workspace';
import WorkspaceClinet from '@/components/workspaceClinet';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import React from 'react'

interface WorkspacePageProps{
  searchParams : Promise<{prompt?:string ;id?:string}>
}

const page =  async({searchParams}:WorkspacePageProps) => {
 

  const user = await getWorkspaceUser()
 const {userId} = await auth();
 if(!userId) redirect('/')
 
  const {prompt,id }= await searchParams;
  let workspace = null;

  if(id){
    workspace = await getWorkspaceById(id,user.id)
  }




//2.48.



  return (
    <div>
      <WorkspaceClinet
      initialPrompt={prompt ?? null}
      userCredits={user.credits}
      userId={user.id}
      userPlan={user.plan}
      workspace={workspace}
      />
    </div>
  )
}

export default page
