import { aj } from "@/app/lib/arcjet";
import { CREDIT_COST_PER_GENERATION } from "@/lib/constants";
import { db } from "@/lib/prisma";
import { FileData, Message } from "@/types/workspace";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenAI } from "@google/genai";
import { NextRequest } from "next/server";

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert React developer. Your job is to generate complete, working React applications based on user prompts.

RULES:
1. Always respond with a valid JSON object — no markdown fences, no extra text.
2. The JSON must match this exact shape:
{
  "assistantMessage": "<brief explanation of what you built/changed>",
  "title": "<short 2-4 word title for the app, e.g. 'Todo List App'>",
  "files": {
    "/App.js": { "code": "<full file content>" },
    "/components/SomeComponent.js": { "code": "<full file content>" }
  },
  "dependencies": {
    "some-package": "latest"
  }
}
3. Use React (functional components + hooks). Do NOT use TypeScript in generated files.
4. Use Tailwind CSS for all styling. Do not use CSS modules or inline styles unless absolutely necessary.
5. The entry point must always be /App.js and must export a default component.
6. All imports must reference files you include in "files" or packages in "dependencies".
7. Do not include react, react-dom, or tailwindcss in "dependencies" — they are always available.
8. When modifying existing code, include ALL files (both changed and unchanged) in "files".
9. Keep code clean, readable, and production-quality.
10. If the user attaches an image, use it as a design reference and match the layout/style as closely as possible.`;

// ─── Gemini contents builder ──────────────────────────────────────────────────

function extractThoughtLabel(text: string): string | null {
  // Try to grab **bold heading** at the start
  const boldMatch = text.match(/\*\*([^*]{4,60})\*\*/);
  if (boldMatch) return boldMatch[1].trim();

  // Fall back to first sentence (up to first . or \n), capped at 60 chars
  const sentence = text.split(/[.\n]/)[0].trim();
  if (sentence.length >= 8 && sentence.length <= 80) return sentence;

  return null;
}

function sseEvent(type: string, payload: unknown) {
  return `data: ${JSON.stringify({ type, ...(payload as object) })}\n\n`;
}

function trimHistory(messages: Message[]): Message[] {
  if (messages.length <= 10) return messages;
  return [messages[0], ...messages.slice(-8)];
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

function buildContents(message: Message[], fileData: FileData | null) {
  const trimmed = trimHistory(message);

  return trimmed.map((msg, idx) => {
    const role = msg.role === "assistant" ? "model" : "user";

    if (msg.role === "user") {
      const parts: object[] = [];

      let text = msg.content;

      if (msg.imageUrl) {
        text = `[the use has attched an image .Use this URL directly is the genrerated app where
                relevant (as img src,background-image,etc.) ${msg.imageUrl}]\n\n${text}`;
      }

      const isLast = idx === trimmed.length - 1;
      if (isLast && fileData) {
        text += `\n\nCurrent project files for context:\n${JSON.stringify(fileData, null, 2)}`;
      }

      parts.push({ text });
      return { role, parts };
    }
    return { role, parts: [{ text: msg.content }] };
  });
}

async function validateDependecies(
  deps: Record<string, string>,
): Promise<Record<string, string>> {
  const valid: Record<string, string> = {};

  await Promise.all(
    Object.entries(deps).map(async ([pkg, version]) => {
      try {
        const res = await fetch(`https://registry.npmjs.org/${pkg}/latest`, {
          signal: AbortSignal.timeout(1500),
        });

        if (res.ok) valid[pkg] = version;
      } catch (error) {}
    }),
  );
  return valid;
}

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return Response.json({ message: "Unauthorized " }, { status: 401 });
  }

  const body = await req.json();

  const { fileData, messages, userId, workspaceId } = body as {
    workspaceId: string | null;
    userId: string;
    messages: Message[];
    fileData: FileData | null;
  };

  if (!messages?.length) {
    return Response.json({ message: "NO messages provided" }, { status: 400 });
  }



  const arcjetReq = new Request(req.url,{
    method:req.method,
    headers:req.headers,
    body:JSON.stringify(body)
  })

  // arcjet
  const lastUserMessage = [
    ...messages
  ].reverse().find((m)=> m.role === "user")?.content?? "";

const decision = await aj.protect(arcjetReq,{
  requested:1,
  userId:clerkId,
  detectPromptInjectionMessage:lastUserMessage
})

if(decision.isDenied()){
  return Response.json({message:decision.reason?.type ?? "Request blocked"},
    {status:429},
  )
}





  const user = await db.user.findUnique({
    where: { id: userId, clerkId },
    select: { id: true, credits: true },
  });

  if (!user) {
    return Response.json({ message: "User not Found" }, { status: 404 });
  }
  if (user.credits < CREDIT_COST_PER_GENERATION) {
    return Response.json(
      {
        message: "Insufficient credits",
      },
      { status: 402 },
    );
  }

  const encoder = new TextEncoder();

  const strem = new ReadableStream({
    async start(contorller) {
      const enqueue = (chunk: string) => {
        contorller.enqueue(encoder.encode(chunk));
      };

      try {
        const contents = buildContents(messages, fileData);
        let parsed: {
          assistantMessage: string;
          files: Record<string, { code: string }>;
          title?: string;
          dependencies?: Record<string, string>;
        };

        const geminiStream = await ai.models.generateContentStream({
          model: "gemini-3.5-flash",
          contents,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            temperature: 0.6,
            responseMimeType: "application/json",
            thinkingConfig: {
              includeThoughts: true,
            },
          },
        });

        let accumulated = "";
        let lastEmitTime = 0;

        for await (const chunk of geminiStream) {
          const parts = chunk.candidates?.[0]?.content?.parts ?? [];

          for (const part of parts) {
            if (!part.text) continue;

            if (part.thought) {
              // Thought chunks are Gemini status text; throttle them so the UI stays clean.
              const now = Date.now();
              if (now - lastEmitTime > 600) {
                const label = extractThoughtLabel(part.text);

                if (label) {
                  enqueue(sseEvent("status", { message: label }));
                  lastEmitTime = now;
                }
              }
            } else {
              accumulated += part.text;
            }
          }
        }

        // --------------------Parse Json--------------------
        // If Gemini returns malformed JSON, abort here without deducting credit.
        try {
          parsed = JSON.parse(accumulated);
        } catch (error) {
          enqueue(
            sseEvent("error", {
              message: "AI returned invalid JSON. Please try again.",
            }),
          );
          return;
        }

        const {
          assistantMessage,
          title: aiTitle,
          files,
          dependencies,
        } = parsed;

        if (!files || typeof files !== "object") {
          enqueue(
            sseEvent("error", {
              messages: "Ai  response mising files .please try agian",
            }),
          );
          return;
        }

        // ---validate namp packages
        // AI sontimes can hallucinates package names that don't exist on npm
        // we hit the npm registry for each dep and silentl frop any fakes.
        //Real pacages pass through unchanged

        enqueue(sseEvent("status", { message: "Validating packages..." }));
        const validateDeps = await validateDependecies(dependencies ?? {});

        const newFileData: FileData = {
          files,
          dependencies: validateDeps,
          title: aiTitle,
        };

        // ---Upsert worspace + deduct credit(single transaction)
        // Atomic : if either the db write or the vredit deductions fails,
        // neither happens -user never loses a credit on a failded save.
        // worspacId is null n first generation => vreate,strign=> update//

        enqueue(sseEvent("status", { message: "saving..." }));

        const lastMessages = messages[messages.length - 1];

        const updatedMessage: Message[] = [
          ...messages,
          { role: "assistant", content: assistantMessage },
        ];

        const workspace = await db.$transaction(async (tx)=>{
           const ws = workspaceId
             ? await tx.workspace.update({
                where: { id: workspaceId, userId },
                data: {
                  messages: updatedMessage as never,
                  fileData: newFileData as never,
                }              })
            : await tx.workspace.create({
                data: {
                  userId,
                  // Use ai genrated title if avialable ,fall back to first 80
                  //chars of user's prompt
                  title: aiTitle ?? lastMessages.content.slice(0, 80),
                  messages: updatedMessage as never,
                  fileData: newFileData as never,
                },
              })
           await tx.user.update({
            where: { id: userId },
            data: { credits: { decrement: CREDIT_COST_PER_GENERATION } },
          })

          return ws
        },{timeout:20000});

        // Re fetch updated credit balance to return accurate value to the client .
        // the client updates its local credits state form this -- no page refersh needed//

        const updateUser = await db.user.findUnique({
          where: { id: userId },
          select: { credits: true },
        });

        enqueue(
          sseEvent("done", {
            workspaceId: workspace.id,
            assistantMessage,
            fileData: newFileData,
            creditsRemaining:
              updateUser?.credits ?? user.credits - CREDIT_COST_PER_GENERATION,
          }),
        );
      } catch (error) {
        console.error("[gen-ai-code ] stream error :", error);
        enqueue(
          sseEvent("error", {
            message: "something went wronge .Please try again",
          }),
        );
      } finally {
        // always  close  stream
        contorller.close();
      }
    },
  });

  return new Response(strem, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export const runtime = "nodejs";
export const maxDuration = 300;
