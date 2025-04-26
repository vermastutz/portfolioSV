import { fetchJSON, renderProjects } from '../global.js';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
const title = document.querySelector('.projects-title');

renderProjects(projects, projectsContainer, 'h2');

if (title) {
  title.textContent = `Projects (${projects.length})`;
}