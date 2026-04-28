import { Suspense } from 'react';
import { listProjectsAction } from './projects/actions';
import { ProjectsClient } from './projects/projects-client';

export default async function DashboardPage() {
  const result = await listProjectsAction();
  const projects = result.success ? result.data : [];

  return (
    <div className="flex-1 p-6 lg:p-8">
      <Suspense fallback={<ProjectListSkeleton />}>
        <ProjectsClient initialProjects={projects} />
      </Suspense>
    </div>
  );
}

function ProjectListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="h-7 w-32 bg-muted rounded animate-pulse" />
        <div className="h-9 w-36 bg-muted rounded animate-pulse" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
      ))}
    </div>
  );
}
