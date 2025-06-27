import { Router, Request, Response } from "express";
import projectService from "../services/projectService";
import messageService from "../services/messageService";

const router = Router();

// Create project
router.post("/", async (req: Request, res: Response) => {
  try {
    const project = await projectService.createProject(req.body);
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get projects by user ID
router.get("/user/:userId", async (req: Request, res: Response) => {
  try {
    const projects = await projectService.getProjectsByUserId(
      parseInt(req.params.userId)
    );
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get project by ID
router.get("/:projectId", async (req: Request, res: Response) => {
  try {
    const project = await projectService.getProjectById(
      parseInt(req.params.projectId)
    );
    // if (!project) {
    //   return res.json();
    // }
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update project
router.put("/:projectId", async (req: Request, res: Response) => {
  try {
    const project = await projectService.updateProject(
      parseInt(req.params.projectId),
      req.body
    );
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete project
router.delete("/:projectId", async (req: Request, res: Response) => {
  try {
    await projectService.deleteProject(parseInt(req.params.projectId));
    res.json({ message: "Project deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get messages for a project
router.get("/:projectId/messages", async (req: Request, res: Response) => {
  try {
    const messages = await messageService.getMessagesByProjectId(
      parseInt(req.params.projectId)
    );
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
