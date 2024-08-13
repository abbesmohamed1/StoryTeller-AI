"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Textarea } from "./ui/textarea";
import { Frame } from "@gptscript-ai/gptscript";
import renderEventMessage from "@/lib/renderEventMessage";

const storiesPath = "public/stories";

function StoryWriter() {
  const [story, setStory] = useState("");
  const [pages, setPages] = useState<number>();
  const [progress, setProgress] = useState("");
  const [runStarted, setRunStarted] = useState<boolean>(false);
  const [runFinished, setRunFinished] = useState<boolean | null>(null);
  const [currentTool, setCurrentTool] = useState("");
  const [events, setEvents] = useState<Frame[]>([]);

  async function runScript() {
    setRunStarted(true);
    setRunFinished(false);
    const response = await fetch("/api/run-script", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ story, pages, path: storiesPath }),
    });

    if (response.ok && response.body) {
      // Handle streams from theAPI

      console.log("Streaming started");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      handleStream(reader, decoder);
    } else {
      setRunStarted(false);
      setRunFinished(true);
      console.log("Failed to start streaming ");
    }
  }

  async function handleStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder
  ) {
    // Manage the stream from the API
    while (true) {
      const { done, value } = await reader.read();
      if (done) break; // break out the infinte loop!

      const chunk = decoder.decode(value, { stream: true });

      // Explanation: We split the chunk into events by splitting it by the events: keyword.

      const eventData = chunk
        .split("\n\n")
        .filter((line) => line.startsWith("event: "))
        .map((line) => line.replace(/^event: /, ""));

      // Explanation:  we parse the JSON data and update the state accordingly
      eventData.forEach((data) => {
        try {
          const parsedData = JSON.parse(data);
          if (parsedData.type === "callProgress") {
            setProgress(
              parsedData.output[parsedData.output.length - 1].content
            );

            setCurrentTool(parsedData.tool?.description || "");
          } else if (parsedData.type === "callStart") {
            setCurrentTool(parsedData.tool?.description || "");
          } else if (parsedData.type === "runFinish") {
            setRunFinished(true);
            setRunStarted(false);
          } else {
            setEvents((prevEvents) => [...prevEvents, parsedData]);
          }
        } catch (error) {
          console.error("Failed to parse JSON", error);
        }
      });
    }
  }

  return (
    <div className="flex flex-col container">
      <section className="flex-1 flex flex-col border border-purple-300 rounded-md p-10 space-y-2 ">
        <Textarea
          value={story}
          onChange={(e) => setStory(e.target.value)}
          className="flex-1 text-black "
          placeholder="Write a story about a robot and a human who became friends ..."
        />

        <Select onValueChange={(value) => setPages(parseInt(value))}>
          <SelectTrigger>
            <SelectValue placeholder="How many papers should the story be?"></SelectValue>
          </SelectTrigger>
          <SelectContent className="w-full">
            {Array.from({ length: 10 }, (_, i) => (
              <SelectItem key={i} value={String(i + 1)}>
                {i + 1}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={runScript}
          disabled={!story || !pages || runStarted}
          className="w-full"
          size={"lg"}
        >
          Generate Story
        </Button>
      </section>
      <section className="flex-1 pb-5 mt-5">
        <div className="flex flex-col-reverse w-full space-x-2 bg-gray-800 rounded-md text-gray-200 font-mono p-10 h-96 overflow-y-scroll">
          <div>
            {runFinished === null && (
              <>
                <p className="animate-pulse mr-5">
                  I&apos;m waiting for you to Generate a story above ...
                </p>
                <br />
              </>
            )}
            <span className="mr-5">{">>"}</span>
            {progress}
          </div>

          {/* Current Tool */}
          {currentTool && (
            <div className="py-10">
              <span className="mr-5">{"--- {Current Tool} ---"}</span>
              {currentTool}
            </div>
          )}
          {/* Render the events... */}
          <div className="space-y-5">
            {events.map((event, index) => (
              <div key={index}>
                <span className="mr-5">{">>"}</span>
                {renderEventMessage(event)}
              </div>
              
            ))}
          </div>

          {runStarted && (
            <div>
              <span className="mr-5 animate-in">
                {"--- {AI Storyteller HasStarted} ---"}
              </span>
              <br />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default StoryWriter;
