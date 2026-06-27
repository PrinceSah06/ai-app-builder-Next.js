import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { ArrowRight, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { Button } from "./ui/button";

const Header = () => {
  return (
    <header className="w-full fixed left-0 top-0 z-50 h-16 border-b border-white/6 bg-white/7 backdrop:-blur-md">
      <nav className="mx-auto flex h-full max-w-7xl  items-center justify-center px-4 sm:px-6">
        <Link href={"#"}>
          <Image
            loading="eager"
            src={`/logo-short.jpeg`}
            alt="Forge Logo"
            width={100}
            height={100}
            className="h-9 w-auto rounded-md"
          />
        </Link>
        <div className="flex items-center gap-5">
          <Show when="signed-in">
            <Link
              className="text-[13px] font-medium text-white/40 transition-colors hover:text-white/80"
              href={"/projects"}
            >
              Projects
            </Link>

            <span
              className="inline-flex h-8 items-center gap-1.5 rounded-full 
          border border-white/80 bg-white/5 text-sm text-white/70"
            >
              <Zap className=" h-3 w-3 fill-white/70"></Zap> 3 / 40 credits
            </span>

            <UserButton />
          </Show>

          <Show when={"signed-out"}>
            <SignInButton mode="modal">
              <Button
                className={" text-white/40 "}
                variant={"ghost"}
                size={"sm"}
              >
                Sign In
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button
                className={"h-8 rounded-full font-semibold active:scale-95 px-4 pt-0.5 "}
                variant={"ghost"}
                size={"sm"}
              >
                Get started
                <ArrowRight className="h-3 w-3 opacity-60" />
              </Button>
            </SignUpButton>
          </Show>
        </div>
      </nav>
    </header>
  );
};

export default Header;
