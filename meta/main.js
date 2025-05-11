import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

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



// function to render stats

function renderCommitInfo(data, commits) {
    const dl = d3.select('#stats').append('dl').attr('class', 'stats');
  
    // Total LOC
    dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
    dl.append('dd').text(data.length);
  
    // Total commits
    dl.append('dt').text('COMMITS');
    dl.append('dd').text(commits.length);
  
    // Number of distinct files
    dl.append('dt').text('FILES');
    dl.append('dd').text(d3.groups(data, d => d.file).length);
  
    // Maximum file length
    const fileLengths = d3.rollups(
      data,
      v => d3.max(v, d => d.line),
      d => d.file
    );
    const maxFileLength = d3.max(fileLengths, d => d[1]);
    dl.append('dt').text('LONGEST FILE');
    dl.append('dd').text(maxFileLength);
  
    // Day of the week with most work
    const workByDay = d3.rollups(
    data,
    v => v.length,
    d => new Date(d.datetime).toLocaleString('en', { weekday: 'long' })
  );
  
  const busiestDay = d3.greatest(workByDay, d => d[1])?.[0];
  
  dl.append('dt').text('MOST PRODUCTIVE DAY');
  dl.append('dd').text(busiestDay);

  // Average file depth
    const fileDepths = d3.rollups(
        data,
        v => d3.mean(v, d => d.depth),
        d => d.file
    );
    const avgFileDepth = d3.mean(fileDepths, d => d[1]);
    dl.append('dt').text('AVG FILE DEPTH');
    dl.append('dd').text(avgFileDepth.toFixed(2));

}
  
function renderScatterPlot(commits) {
    const width = 1000;
    const height = 600;
    const margin = { top: 10, right: 10, bottom: 30, left: 40 };

    const usableArea = {
        top: margin.top,
        right: width - margin.right,
        bottom: height - margin.bottom,
        left: margin.left,
        width: width - margin.left - margin.right,
        height: height - margin.top - margin.bottom,
        };
  
    const svg = d3
      .select('#chart')
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('overflow', 'visible');
  
    
    const xScale = d3
      .scaleTime()
      .domain(d3.extent(commits, d => d.datetime))
      .range([usableArea.left, usableArea.right])
      .nice();
  
    const yScale = d3
      .scaleLinear()
      .domain([0, 24])
      .range([usableArea.bottom, usableArea.top]);

    const [minLines, maxLines] = d3.extent(commits, d => d.totalLines);

    const rScale = d3.scaleSqrt()
        .domain([minLines, maxLines])
        .range([3, 15]);
      
  
    
    const dots = svg.append('g').attr('class', 'dots');
    dots.selectAll('circle')
        .data(d3.sort(commits, d => -d.totalLines))
        .join('circle')
        .attr('cx', d => xScale(d.datetime))
        .attr('cy', d => yScale(d.hourFrac))
        .attr('r', d => rScale(d.totalLines))
        .attr('fill', 'steelblue')
        .style('fill-opacity', 0.7)
        .on('mouseenter', (event, commit) => {
        d3.select(event.currentTarget).style('fill-opacity', 1);
        renderTooltipContent(commit);
        updateTooltipVisibility(true);
        updateTooltipPosition(event);
        })
        .on('mousemove', updateTooltipPosition)
        .on('mouseleave', (event) => {
        d3.select(event.currentTarget).style('fill-opacity', 0.7); 
        updateTooltipVisibility(false);
        });

      const gridlines = svg
        .append('g')
        .attr('class', 'gridlines')
        .attr('transform', `translate(${usableArea.left}, 0)`);

        gridlines.call(
        d3.axisLeft(yScale)
            .tickFormat('')  
            .tickSize(-usableArea.width) 
        );
    
        
        
    
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3
    .axisLeft(yScale)
    .tickFormat(d => String(d % 24).padStart(2, '0') + ':00');

    svg
    .append('g')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .call(xAxis);

    svg
    .append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(yAxis);

    svg.call(d3.brush()
    .on('start brush end', (event) => brushed(event, commits, xScale, yScale))
    );
    svg.selectAll('.dots, .overlay ~ *').raise();

    // createBrushSelector(svg);
    // svg.selectAll('.dots, .overlay ~ *').raise();



  
  }
  

  function renderTooltipContent(commit) {
    document.getElementById('commit-link').href = commit.url;
    document.getElementById('commit-link').textContent = commit.id;
  
    document.getElementById('commit-date').textContent =
      commit.date ?? commit.datetime.toLocaleDateString();
  
    document.getElementById('commit-time').textContent =
      commit.time ?? commit.datetime.toLocaleTimeString();
  
    document.getElementById('commit-author').textContent = commit.author;
    document.getElementById('commit-lines').textContent = commit.totalLines;
  }
  
  function updateTooltipVisibility(isVisible) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.hidden = !isVisible;
  }
  
  function updateTooltipPosition(event) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.style.left = `${event.clientX + 10}px`;
    tooltip.style.top = `${event.clientY + 10}px`;
  }
  

  function createBrushSelector(svg) {
    svg.call(d3.brush());
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
  
    d3.selectAll('circle').classed('selected', (d) =>
      isCommitSelected(selection, d, xScale, yScale)
    );

    renderSelectionCount(selection, commits, xScale, yScale);
    renderLanguageBreakdown(selection, commits, xScale, yScale);
  }

  function renderSelectionCount(selection, commits, xScale, yScale) {
    const selectedCommits = selection
      ? commits.filter((d) => isCommitSelected(selection, d, xScale, yScale))
      : [];
  
    const countElement = document.querySelector('#selection-count');
    countElement.textContent = `${
      selectedCommits.length || 'No'
    } commits selected`;
  
    return selectedCommits;
  }

  function renderLanguageBreakdown(selection, commits, xScale, yScale) {
    const selectedCommits = selection
      ? commits.filter((d) => isCommitSelected(selection, d, xScale, yScale))
      : [];
  
    const container = document.getElementById('language-breakdown');
  
    if (selectedCommits.length === 0) {
      container.innerHTML = '';
      return;
    }
  
    const lines = selectedCommits.flatMap((d) => d.lines);
  
    const breakdown = d3.rollup(
      lines,
      (v) => v.length,
      (d) => d.type
    );
  
    container.innerHTML = '';
  
    for (const [language, count] of breakdown) {
      const proportion = count / lines.length;
      const formatted = d3.format('.1~%')(proportion);
  
      container.innerHTML += `
        <dt>${language}</dt>
        <dd>${count} lines (${formatted})</dd>
      `;
    }
  }
  


let data = await loadData();
let commits = processCommits(data);
renderCommitInfo(data, commits);
renderScatterPlot(commits); 
  