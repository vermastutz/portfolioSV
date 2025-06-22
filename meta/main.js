import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

let xScale, yScale;

async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: +row.line,
    depth: +row.depth,
    length: +row.length,
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));
  return data;
}

function processCommits(data) {
  return d3
    .groups(data, d => d.commit)
    .map(([commit, lines]) => {
      let first = lines[0];
      let { author, date, time, timezone, datetime } = first;

      let commitObj = {
        id: commit,
        url: 'https://github.com/vis-society/lab-7/commit/' + commit,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length
      };

      Object.defineProperty(commitObj, 'lines', {
        value: lines,
        enumerable: false,
        writable: false,
        configurable: false
      });

      return commitObj;
    });
}

function renderCommitInfo(data, commits) {
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');

  dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
  dl.append('dd').text(data.length);

  dl.append('dt').text('COMMITS');
  dl.append('dd').text(commits.length);

  dl.append('dt').text('FILES');
  dl.append('dd').text(d3.groups(data, d => d.file).length);

  const fileLengths = d3.rollups(data, v => d3.max(v, d => d.line), d => d.file);
  const maxFileLength = d3.max(fileLengths, d => d[1]);
  dl.append('dt').text('LONGEST FILE');
  dl.append('dd').text(maxFileLength);

  const workByDay = d3.rollups(
    data,
    v => v.length,
    d => new Date(d.datetime).toLocaleString('en', { weekday: 'long' })
  );
  const busiestDay = d3.greatest(workByDay, d => d[1])?.[0];
  dl.append('dt').text('MOST PRODUCTIVE DAY');
  dl.append('dd').text(busiestDay);

  const fileDepths = d3.rollups(data, v => d3.mean(v, d => d.depth), d => d.file);
  const avgFileDepth = d3.mean(fileDepths, d => d[1]);
  dl.append('dt').text('AVG FILE DEPTH');
  dl.append('dd').text(avgFileDepth.toFixed(2));
}

function renderTooltipContent(commit) {
  document.getElementById('commit-link').href = commit.url;
  document.getElementById('commit-link').textContent = commit.id;
  document.getElementById('commit-date').textContent = commit.date ?? commit.datetime.toLocaleDateString();
  document.getElementById('commit-time').textContent = commit.time ?? commit.datetime.toLocaleTimeString();
  document.getElementById('commit-author').textContent = commit.author;
  document.getElementById('commit-lines').textContent = commit.totalLines;
}

function updateTooltipVisibility(isVisible) {
  document.getElementById('commit-tooltip').hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.style.left = `${event.clientX + 10}px`;
  tooltip.style.top = `${event.clientY + 10}px`;
}

function isCommitSelected(selection, commit, xScale, yScale) {
  if (!selection) return false;
  const [[x0, y0], [x1, y1]] = selection;
  const cx = xScale(commit.datetime);
  const cy = yScale(commit.hourFrac);
  return x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
}

function brushed(event, commits, xScale, yScale) {
  const selection = event.selection;
  d3.selectAll('circle').classed('selected', d => isCommitSelected(selection, d, xScale, yScale));
  renderSelectionCount(selection, commits, xScale, yScale);
  renderLanguageBreakdown(selection, commits, xScale, yScale);
}

function renderSelectionCount(selection, commits, xScale, yScale) {
  const selected = selection ? commits.filter(d => isCommitSelected(selection, d, xScale, yScale)) : [];
  document.querySelector('#selection-count').textContent = `${selected.length || 'No'} commits selected`;
  return selected;
}

function renderLanguageBreakdown(selection, commits, xScale, yScale) {
  const selected = selection ? commits.filter(d => isCommitSelected(selection, d, xScale, yScale)) : [];
  const container = document.getElementById('language-breakdown');

  if (selected.length === 0) {
    container.innerHTML = '';
    return;
  }

  const lines = selected.flatMap(d => d.lines);
  const breakdown = d3.rollup(lines, v => v.length, d => d.type);

  container.innerHTML = '';
  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format('.1~%')(proportion);
    container.innerHTML += `<dt>${language}</dt><dd>${count} lines (${formatted})</dd>`;
  }
}

function renderScatterPlot(commits) {
  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 40 };
  const usable = { left: margin.left, right: width - margin.right, top: margin.top, bottom: height - margin.bottom, width: width - margin.left - margin.right, height: height - margin.top - margin.bottom };

  const svg = d3.select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  xScale = d3.scaleTime().domain(d3.extent(commits, d => d.datetime)).range([usable.left, usable.right]).nice();
  yScale = d3.scaleLinear().domain([0, 24]).range([usable.bottom, usable.top]);

  const [minLines, maxLines] = d3.extent(commits, d => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([3, 15]);

  const dots = svg.append('g').attr('class', 'dots');
  dots.selectAll('circle')
    .data(d3.sort(commits, d => -d.totalLines))
    .join('circle')
    .attr('cx', d => xScale(d.datetime))
    .attr('cy', d => yScale(d.hourFrac))
    .attr('r', d => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, d) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(d);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', updateTooltipPosition)
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });

  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3.axisLeft(yScale).tickFormat(d => String(d).padStart(2, '0') + ':00');

  svg.append('g').attr('transform', `translate(0,${usable.bottom})`).attr('class', 'x-axis').call(xAxis);
  svg.append('g').attr('transform', `translate(${usable.left},0)`).call(yAxis);

  svg.append('g')
    .attr('transform', `translate(${usable.left}, 0)`)
    .call(d3.axisLeft(yScale).tickFormat('').tickSize(-usable.width));

  svg.call(d3.brush().on('start brush end', (event) => brushed(event, commits, xScale, yScale)));
  svg.selectAll('.dots, .overlay ~ *').raise();
}

function updateScatterPlot(commitsToShow) {
  const svg = d3.select('#chart').select('svg');
  const xExtent = d3.extent(commitsToShow, d => d.datetime);
  xScale.domain(xExtent);

  const rExtent = d3.extent(commitsToShow, d => d.totalLines);
  const rScale = d3.scaleSqrt().domain(rExtent).range([3, 15]);

  const xAxis = d3.axisBottom(xScale);
  svg.select('g.x-axis').call(xAxis);

  const dots = svg.select('g.dots');
  const sorted = d3.sort(commitsToShow, d => -d.totalLines);

  dots.selectAll('circle')
    .data(sorted, d => d.id)
    .join(
      enter => enter.append('circle')
        .attr('r', 0)
        .attr('cx', d => xScale(d.datetime))
        .attr('cy', d => yScale(d.hourFrac))
        .attr('fill', 'steelblue')
        .style('fill-opacity', 0.7)
        .call(enter => enter.transition().duration(300).attr('r', d => rScale(d.totalLines))),
      update => update.transition().duration(300)
        .attr('cx', d => xScale(d.datetime))
        .attr('cy', d => yScale(d.hourFrac))
        .attr('r', d => rScale(d.totalLines)),
      exit => exit.transition().duration(200).attr('r', 0).remove()
    );
}

const data = await loadData();
const commits = processCommits(data);

renderCommitInfo(data, commits);
renderScatterPlot(commits);

let commitProgress = 100;
let timeScale = d3.scaleTime()
  .domain(d3.extent(commits, d => d.datetime))
  .range([0, 100]);

let commitMaxTime = timeScale.invert(commitProgress);
let filteredCommits = commits;

function onTimeSliderChange() {
  commitProgress = +document.getElementById('commit-progress').value;
  commitMaxTime = timeScale.invert(commitProgress);

  document.getElementById('commit-time').textContent =
    commitMaxTime.toLocaleString('en', {
      dateStyle: 'long',
      timeStyle: 'short',
    });

  filteredCommits = commits.filter(d => d.datetime <= commitMaxTime);
  updateScatterPlot(filteredCommits);
}

document.getElementById('commit-progress').addEventListener('input', onTimeSliderChange);
onTimeSliderChange();






// import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// async function loadData() {
//     const data = await d3.csv('loc.csv', (row) => ({
//       ...row,
//       line: +row.line,
//       depth: +row.depth,
//       length: +row.length,
//       date: new Date(row.date + 'T00:00' + row.timezone),
//       datetime: new Date(row.datetime),
//     }));
//     return data;
//   }
  


//   function processCommits(data) {
//     return d3
//       .groups(data, d => d.commit) 
//       .map(([commit, lines]) => {
//         let first = lines[0];
//         let { author, date, time, timezone, datetime } = first;
  
//         let commitObj = {
//           id: commit,
//           url: 'https://github.com/vis-society/lab-7/commit/' + commit,
//           author,
//           date,
//           time,
//           timezone,
//           datetime,
//           hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
//           totalLines: lines.length
//         };

//         Object.defineProperty(commitObj, 'lines', {
//           value: lines,
//           enumerable: false,
//           writable: false,
//           configurable: false
//         });
  
//         return commitObj;
//       });
//   }

//   function updateScatterPlot(commitsToShow) {
//     const svg = d3.select('#chart').select('svg');
  
//     const xExtent = d3.extent(commitsToShow, d => d.datetime);
//     xScale.domain(xExtent);
  
//     const rExtent = d3.extent(commitsToShow, d => d.totalLines);
//     const rScale = d3.scaleSqrt().domain(rExtent).range([3, 15]);
  
//     const xAxis = d3.axisBottom(xScale);
//     svg.select('g.x-axis').call(xAxis);
  
//     const dots = svg.select('g.dots');
//     const sorted = d3.sort(commitsToShow, d => -d.totalLines);
  
//     dots
//       .selectAll('circle')
//       .data(sorted, d => d.id) // KEY FUNCTION: keep circle matching commit ID
//       .join(
//         enter =>
//           enter
//             .append('circle')
//             .attr('r', 0) // new circles start small
//             .attr('cx', d => xScale(d.datetime))
//             .attr('cy', d => yScale(d.hourFrac))
//             .attr('fill', 'steelblue')
//             .style('fill-opacity', 0.7)
//             .call(enter =>
//               enter
//                 .transition()
//                 .duration(300)
//                 .attr('r', d => rScale(d.totalLines))
//             ),
//         update =>
//           update
//             .transition()
//             .duration(300)
//             .attr('cx', d => xScale(d.datetime))
//             .attr('cy', d => yScale(d.hourFrac))
//             .attr('r', d => rScale(d.totalLines)),
//         exit =>
//           exit
//             .transition()
//             .duration(200)
//             .attr('r', 0)
//             .remove()
//       );
//   }
  
//   let xScale, yScale;

//   let data = await loadData();
//   let commits = processCommits(data);

//   let commitProgress = 100;

//   let timeScale = d3
//     .scaleTime()
//     .domain([
//       d3.min(commits, (d) => d.datetime),
//       d3.max(commits, (d) => d.datetime),
//     ])
//     .range([0, 100]);
  
//   let commitMaxTime = timeScale.invert(commitProgress);
//   let filteredCommits = commits;

//   function onTimeSliderChange() {
//     const slider = document.getElementById('commit-progress');
//     const timeDisplay = document.getElementById('commit-time');
  
//     // Get slider value
//     commitProgress = +document.getElementById('commit-progress').value;
//   commitMaxTime = timeScale.invert(commitProgress);

//   document.getElementById('commit-time').textContent =
//     commitMaxTime.toLocaleString('en', {
//       dateStyle: 'long',
//       timeStyle: 'short',
//     });

//   // Filter commits
//   filteredCommits = commits.filter(d => d.datetime <= commitMaxTime);

//   updateScatterPlot(filteredCommits);

  
  
// }
//     // // Display selected time
//     // timeDisplay.textContent = commitMaxTime.toLocaleString('en', {
//     //   dateStyle: 'long',
//     //   timeStyle: 'short'
//     // });
  
//     // OPTIONAL: you will later use this to update visuals
//     // updateScatterPlot(filteredCommits);
//     // updateCommitInfo(filteredCommits);
  

//   onTimeSliderChange();
//   d3.select('#commit-progress').on('input', onTimeSliderChange);


// // function to render stats

// function renderCommitInfo(data, commits) {
//     const dl = d3.select('#stats').append('dl').attr('class', 'stats');
  
//     // Total LOC
//     dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
//     dl.append('dd').text(data.length);
  
//     // Total commits
//     dl.append('dt').text('COMMITS');
//     dl.append('dd').text(commits.length);
  
//     // Number of distinct files
//     dl.append('dt').text('FILES');
//     dl.append('dd').text(d3.groups(data, d => d.file).length);
  
//     // Maximum file length
//     const fileLengths = d3.rollups(
//       data,
//       v => d3.max(v, d => d.line),
//       d => d.file
//     );
//     const maxFileLength = d3.max(fileLengths, d => d[1]);
//     dl.append('dt').text('LONGEST FILE');
//     dl.append('dd').text(maxFileLength);
  
//     // Day of the week with most work
//     const workByDay = d3.rollups(
//     data,
//     v => v.length,
//     d => new Date(d.datetime).toLocaleString('en', { weekday: 'long' })
//   );
  
//   const busiestDay = d3.greatest(workByDay, d => d[1])?.[0];
  
//   dl.append('dt').text('MOST PRODUCTIVE DAY');
//   dl.append('dd').text(busiestDay);

//   // Average file depth
//     const fileDepths = d3.rollups(
//         data,
//         v => d3.mean(v, d => d.depth),
//         d => d.file
//     );
//     const avgFileDepth = d3.mean(fileDepths, d => d[1]);
//     dl.append('dt').text('AVG FILE DEPTH');
//     dl.append('dd').text(avgFileDepth.toFixed(2));

// }
  
// function renderScatterPlot(commits) {
//     const width = 1000;
//     const height = 600;
//     const margin = { top: 10, right: 10, bottom: 30, left: 40 };

//     const usableArea = {
//         top: margin.top,
//         right: width - margin.right,
//         bottom: height - margin.bottom,
//         left: margin.left,
//         width: width - margin.left - margin.right,
//         height: height - margin.top - margin.bottom,
//         };
  
//     const svg = d3
//       .select('#chart')
//       .append('svg')
//       .attr('viewBox', `0 0 ${width} ${height}`)
//       .style('overflow', 'visible');
  
    
//     const xScale = d3
//       .scaleTime()
//       .domain(d3.extent(commits, d => d.datetime))
//       .range([usableArea.left, usableArea.right])
//       .nice();
  
//     const yScale = d3
//       .scaleLinear()
//       .domain([0, 24])
//       .range([usableArea.bottom, usableArea.top]);

//     const [minLines, maxLines] = d3.extent(commits, d => d.totalLines);

//     const rScale = d3.scaleSqrt()
//         .domain([minLines, maxLines])
//         .range([3, 15]);
      
  
    
//     const dots = svg.append('g').attr('class', 'dots');
//     dots.selectAll('circle')
//         .data(d3.sort(commits, d => -d.totalLines))
//         .join('circle')
//         .attr('cx', d => xScale(d.datetime))
//         .attr('cy', d => yScale(d.hourFrac))
//         .attr('r', d => rScale(d.totalLines))
//         .attr('fill', 'steelblue')
//         .style('fill-opacity', 0.7)
//         .on('mouseenter', (event, commit) => {
//         d3.select(event.currentTarget).style('fill-opacity', 1);
//         renderTooltipContent(commit);
//         updateTooltipVisibility(true);
//         updateTooltipPosition(event);
//         })
//         .on('mousemove', updateTooltipPosition)
//         .on('mouseleave', (event) => {
//         d3.select(event.currentTarget).style('fill-opacity', 0.7); 
//         updateTooltipVisibility(false);
//         });

//       const gridlines = svg
//         .append('g')
//         .attr('class', 'gridlines')
//         .attr('transform', `translate(${usableArea.left}, 0)`);

//         gridlines.call(
//         d3.axisLeft(yScale)
//             .tickFormat('')  
//             .tickSize(-usableArea.width) 
//         );
    
        
        
    
//     const xAxis = d3.axisBottom(xScale);
//     const yAxis = d3
//     .axisLeft(yScale)
//     .tickFormat(d => String(d % 24).padStart(2, '0') + ':00');

//     svg
//     .append('g')
//     .attr('transform', `translate(0, ${usableArea.bottom})`)
//     .call(xAxis);

//     svg
//     .append('g')
//     .attr('transform', `translate(${usableArea.left}, 0)`)
//     .call(yAxis);

//     svg.call(d3.brush()
//     .on('start brush end', (event) => brushed(event, commits, xScale, yScale))
//     );
//     svg.selectAll('.dots, .overlay ~ *').raise();

//     // createBrushSelector(svg);
//     // svg.selectAll('.dots, .overlay ~ *').raise();



  
//   }
  

//   function renderTooltipContent(commit) {
//     document.getElementById('commit-link').href = commit.url;
//     document.getElementById('commit-link').textContent = commit.id;
  
//     document.getElementById('commit-date').textContent =
//       commit.date ?? commit.datetime.toLocaleDateString();
  
//     document.getElementById('commit-time').textContent =
//       commit.time ?? commit.datetime.toLocaleTimeString();
  
//     document.getElementById('commit-author').textContent = commit.author;
//     document.getElementById('commit-lines').textContent = commit.totalLines;
//   }
  
//   function updateTooltipVisibility(isVisible) {
//     const tooltip = document.getElementById('commit-tooltip');
//     tooltip.hidden = !isVisible;
//   }
  
//   function updateTooltipPosition(event) {
//     const tooltip = document.getElementById('commit-tooltip');
//     tooltip.style.left = `${event.clientX + 10}px`;
//     tooltip.style.top = `${event.clientY + 10}px`;
//   }
  

//   function createBrushSelector(svg) {
//     svg.call(d3.brush());
//   }

//   function isCommitSelected(selection, commit, xScale, yScale) {
//     if (!selection) return false;
  
//     const [[x0, y0], [x1, y1]] = selection;
  
//     const cx = xScale(commit.datetime);
//     const cy = yScale(commit.hourFrac);
  
//     return x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
//   }

//   function brushed(event, commits, xScale, yScale) {
//     const selection = event.selection;
  
//     d3.selectAll('circle').classed('selected', (d) =>
//       isCommitSelected(selection, d, xScale, yScale)
//     );

//     renderSelectionCount(selection, commits, xScale, yScale);
//     renderLanguageBreakdown(selection, commits, xScale, yScale);
//   }

//   function renderSelectionCount(selection, commits, xScale, yScale) {
//     const selectedCommits = selection
//       ? commits.filter((d) => isCommitSelected(selection, d, xScale, yScale))
//       : [];
  
//     const countElement = document.querySelector('#selection-count');
//     countElement.textContent = `${
//       selectedCommits.length || 'No'
//     } commits selected`;
  
//     return selectedCommits;
//   }

//   function renderLanguageBreakdown(selection, commits, xScale, yScale) {
//     const selectedCommits = selection
//       ? commits.filter((d) => isCommitSelected(selection, d, xScale, yScale))
//       : [];
  
//     const container = document.getElementById('language-breakdown');
  
//     if (selectedCommits.length === 0) {
//       container.innerHTML = '';
//       return;
//     }
  
//     const lines = selectedCommits.flatMap((d) => d.lines);
  
//     const breakdown = d3.rollup(
//       lines,
//       (v) => v.length,
//       (d) => d.type
//     );
  
//     container.innerHTML = '';
  
//     for (const [language, count] of breakdown) {
//       const proportion = count / lines.length;
//       const formatted = d3.format('.1~%')(proportion);
  
//       container.innerHTML += `
//         <dt>${language}</dt>
//         <dd>${count} lines (${formatted})</dd>
//       `;
//     }

//     document
//   .getElementById('commit-progress')
//   .addEventListener('input', onTimeSliderChange);

// // Call once on load
// onTimeSliderChange();
//   }


  


  


// // let data = await loadData();
// // let commits = processCommits(data);
// renderCommitInfo(data, commits);
// renderScatterPlot(commits); 

  