import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

let selectedIndex = -1;
let query = '';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
const title = document.querySelector('.projects-title');
const searchInput = document.querySelector('.searchBar');
const svg = d3.select('#projects-pie-plot');
const legend = d3.select('.legend');

if (title) {
  title.textContent = `Projects (${projects.length})`;
}

// Function to filter projects based on search and selected year
function filteredProjects() {
  return projects.filter((project) => {
    const values = Object.values(project).join('\n').toLowerCase();
    const matchesQuery = values.includes(query);
    const matchesYear =
      selectedIndex === -1 ||
      project.year === data[selectedIndex]?.label;
    return matchesQuery && matchesYear;
  });
}

// Global variable to track current pie chart data
let data = [];

// Function to render pie chart and legend
function renderPieChart(projectsGiven) {
  svg.selectAll('path').remove();
  legend.selectAll('li').remove();

  const rolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => d.year
  );

  data = rolledData.map(([year, count]) => ({
    label: year,
    value: count,
  }));

  const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
  const sliceGenerator = d3.pie().value((d) => d.value);
  const arcData = sliceGenerator(data);
  const colors = d3.scaleOrdinal(d3.schemeTableau10);

  // Draw pie slices
  arcData.forEach((d, i) => {
    svg.append('path')
      .attr('d', arcGenerator(d))
      .attr('fill', colors(i))
      .attr('class', selectedIndex === i ? 'selected' : '')
      .style('cursor', 'pointer')
      .on('click', () => {
        selectedIndex = selectedIndex === i ? -1 : i;
  
        // Filter projects based on selected year
        if (selectedIndex === -1) {
          renderProjects(projects, projectsContainer, 'h2');
        } else {
          const selectedYear = data[selectedIndex].label;
          const filteredByYear = projects.filter(
            (project) => project.year === selectedYear
          );
          renderProjects(filteredByYear, projectsContainer, 'h2');
        }
  
        // Re-render pie chart to apply selection styling
        renderPieChart(projects);
      });
  });

  // Draw legend
  data.forEach((d, i) => {
    legend
      .append('li')
      .attr('style', `--color:${colors(i)}`)
      .attr('class', selectedIndex === i ? 'selected' : '')
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`)
      .on('click', () => {
        selectedIndex = selectedIndex === i ? -1 : i;
        renderProjects(filteredProjects(), projectsContainer, 'h2');
        renderPieChart(filteredProjects());
      });
  });
}

// Initial page load
renderProjects(projects, projectsContainer, 'h2');
renderPieChart(projects);

// Search listener
searchInput.addEventListener('input', (event) => {
  query = event.target.value.toLowerCase();
  selectedIndex = -1; // reset pie selection when typing
  renderProjects(filteredProjects(), projectsContainer, 'h2');
  renderPieChart(filteredProjects());
});