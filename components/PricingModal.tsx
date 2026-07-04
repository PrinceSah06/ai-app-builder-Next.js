import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Bluetooth } from 'lucide-react';
import { BlueTitle } from './Reusable';
import { PricingTable } from '@clerk/nextjs';
interface PricingModalProps{
    children:React.ReactNode;
    resion?:"credits" | "upgrade"
}

const PricingModal = ({children,resion="upgrade"}:PricingModalProps) => {
    const title = resion === "credits"?"you're out of credit" : "Upgrade your plan";
    const description = resion=== "credits" ? "You 've used all your credits.Upgrade to keep building." :
    "Choose a plan that fits how much you build.";




    return (
 <Dialog>
  <DialogTrigger className={"cursor-pointer"}>{children}</DialogTrigger>
  <DialogContent className={' border-white/8 bg-[#0f0f0f] p-0 text-white sm:max-w-6xl max-h-[9-dvh] overflow-y-auto'}>
    <DialogHeader className={`text-4xl `}>
      <DialogTitle>
        <BlueTitle>
    {title}</BlueTitle></DialogTitle>
      <DialogDescription className={`text-sm text-white/35`}>
        {description}
      </DialogDescription>
    </DialogHeader>

    <div className={`px-6 pb-6`}>
     <PricingTable
            checkoutProps={{
              appearance: {
                elements: {
                  drawerRoot: {
                    zIndex: 2000,
                  },
                },
              },
            }}
          ></PricingTable>
    </div>
  </DialogContent>
</Dialog>
  )
}

export default PricingModal
