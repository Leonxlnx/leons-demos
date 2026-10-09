import raw from "../../data/projects.json";

export interface Project {
  name: string;
  description: string;
  stars: number;
  url: string;
}

export const PROJECTS: Project[] = (raw as Project[])
  .map((p) => ({ ...p, description: p.description.trim() }))
  .sort((a, b) => b.stars - a.stars);
