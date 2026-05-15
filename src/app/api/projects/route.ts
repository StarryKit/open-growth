import { createProject, deleteProject, listProjects } from "@/lib/project-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

export async function GET() {
  try {
    const projects = await listProjects();
    return Response.json({ projects });
  } catch {
    return Response.json({ error: "Unable to read projects." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { name?: string }
      | null;

    if (!body?.name?.trim()) {
      return badRequest("Project name is required.");
    }

    const project = await createProject({
      name: body.name,
    });

    return Response.json({ project }, { status: 201 });
  } catch {
    return Response.json({ error: "Unable to create project." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("id");

  if (!projectId) {
    return badRequest("Project ID is required.");
  }

  try {
    const removed = await deleteProject(projectId);

    if (!removed) {
      return Response.json({ error: "Project not found." }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Unable to delete project." }, { status: 500 });
  }
}
