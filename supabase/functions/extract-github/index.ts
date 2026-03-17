import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  try {
    const { profile_id, github_username } = await req.json()

    if (!github_username) {
      return new Response(
        JSON.stringify({ error: "github_username is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      )
    }

    // 1. Fetch public repos for the user from GitHub API
    const reposRes = await fetch(`https://api.github.com/users/${github_username}/repos?sort=updated&per_page=10`);
    if (!reposRes.ok) {
      throw new Error(`Failed to fetch GitHub repos for user ${github_username}.`);
    }
    
    const repos = await reposRes.json();
    
    // 2. Filter repos: exclude forks, take top 3 most recently updated
    const filteredRepos = repos.filter((r: any) => !r.fork).slice(0, 3);
    
    // 3. Map filtered repos to our artifact shape
    // Note: In an LLM pipeline, we'd fetch the READMEs and send to gpt-5-mini here to extract deeper insights.
    const artifacts = filteredRepos.map((repo: any) => {
      const tags = ['Applied execution'];
      if (repo.language === 'TypeScript' || repo.language === 'Rust') tags.push('Technical depth');
      if (repo.stargazers_count > 0) tags.push('Collaboration signal');

      return {
        artifact_type: "project",
        artifact_data: {
          title: repo.name,
          description: repo.description || `Software project built.`,
          project_demo_link: repo.html_url,
          tags: tags,
          source: "GitHub sync"
        }
      }
    });

    return new Response(
      JSON.stringify({ artifacts }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (err: any) {
    console.error("Error in extract-github:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }
})
