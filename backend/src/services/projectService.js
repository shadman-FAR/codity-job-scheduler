import prisma from '../utils/prismaClient.js';

/**
 * Finds the organization the user belongs to.
 * For our MVP, each user has exactly one (their default personal org),
 * so we just grab the first membership. This keeps things simple while
 * still being structurally ready for multi-org support later.
 */
async function getUserOrganizationId(userId) {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    select: { organizationId: true },
  });

  if (!membership) {
    const error = new Error('User does not belong to any organization');
    error.statusCode = 403;
    error.code = 'NO_ORGANIZATION';
    throw error;
  }

  return membership.organizationId;
}

export async function createProject(userId, { name, description }) {
  const organizationId = await getUserOrganizationId(userId);

  return prisma.project.create({
    data: { name, description, organizationId },
  });
}

export async function listProjects(userId) {
  const organizationId = await getUserOrganizationId(userId);

  return prisma.project.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { queues: true } },
    },
  });
}

export async function getProjectById(userId, projectId) {
  const organizationId = await getUserOrganizationId(userId);

  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId }, // scoping check happens right here
    include: {
      queues: { select: { id: true, name: true, isActive: true } },
    },
  });

  if (!project) {
    const error = new Error('Project not found');
    error.statusCode = 404;
    error.code = 'PROJECT_NOT_FOUND';
    throw error;
  }

  return project;
}

export async function updateProject(userId, projectId, { name, description }) {
  // getProjectById already enforces ownership — reuse it instead of duplicating the check
  await getProjectById(userId, projectId);

  return prisma.project.update({
    where: { id: projectId },
    data: { name, description },
  });
}

export async function deleteProject(userId, projectId) {
  await getProjectById(userId, projectId);

  await prisma.project.delete({ where: { id: projectId } });
}