import {
  createProject,
  listProjects,
  getProjectById,
  updateProject,
  deleteProject,
} from '../services/projectService.js';

export async function create(req, res, next) {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'name is required' },
      });
    }

    const project = await createProject(req.userId, { name, description });
    res.status(201).json({ success: true, data: project });
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const projects = await listProjects(req.userId);
    res.status(200).json({ success: true, data: projects });
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const project = await getProjectById(req.userId, req.params.id);
    res.status(200).json({ success: true, data: project });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const { name, description } = req.body;
    const project = await updateProject(req.userId, req.params.id, { name, description });
    res.status(200).json({ success: true, data: project });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await deleteProject(req.userId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}