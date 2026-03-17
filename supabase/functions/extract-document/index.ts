import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Note on implementation: 
// In a full implementation, you would:
// 1. Download the file from Supabase Storage using the provided 'document_path'.
// 2. Either process the PDF/DOCX locally (using a Deno PDF library) 
//    or pass the file (or a base64 encoded version) directly to the OpenAI API 
//    (using a vision-capable or strict OCR model like gpt-5-mini).
// 3. Ask the LLM to return structured outputs adhering to the DraftArtifactForm interface.

serve(async (req) => {
  try {
    const { profile_id, document_path, document_type } = await req.json()

    if (!document_path || !document_type) {
      return new Response(
        JSON.stringify({ error: "document_path and document_type are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      )
    }

    const isTranscript = document_type === 'transcript';

    // Mock response simulating the LLM's classification and extraction.
    const artifacts = isTranscript ? [
      {
        artifact_type: "coursework",
        artifact_data: {
          title: "Data Structures & Algorithms",
          course_code: "CS 201",
          course_title: "Data Structures & Algorithms",
          instructor_name: "Dr. Smith",
          impact_description: "Implemented custom hash maps, binary search trees, and graphs. Aided peer learning by organizing study groups.",
          source: "Transcript OCR",
          tags: ["Technical depth", "Systems thinking"]
        }
      }
    ] : [
      {
        artifact_type: "project",
        artifact_data: {
          title: "AI Artifact Extractor",
          description: "Built an automated pipeline utilizing OCR LLMs to extract resume and transcript data strictly into normalized JSON objects for student profiles.",
          project_demo_link: "https://github.com/student/ai-extractor",
          source: "Resume parsing",
          tags: ["Applied execution", "Communication signal"]
        }
      }
    ];

    return new Response(
      JSON.stringify({ artifacts }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (err: any) {
    console.error("Error in extract-document:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }
})
