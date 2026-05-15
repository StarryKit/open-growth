import { setActiveProject } from "@/lib/project-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { projectId?: string } | null;

    if (body?.projectId === undefined) {
      return badRequest("Project ID is required.");
    }

    const project = await setActiveProject(body.projectId);

    if (!project) {
      return Response.json({ error: "Project not found." }, { status: 404 });
    }

    return Response.json({ project });
  } catch {
    return Response.json({ error: "Unable to switch project." }, { status: 500 });
  }
}
