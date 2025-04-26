console.log('IT’S ALIVE!');

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}
// let navLinks = $$("nav a");

// let currentLink = navLinks.find(
//   (a) => a.host === location.host && a.pathname === location.pathname
// );

// currentLink?.classList.add("current");


let pages = [
  { url: "", title: "Home" },
  { url: "projects/", title: "Projects" },
  { url: "contact/", title: "Contact" },
  { url: "resume/", title: "Resume" },
  { url: "https://github.com/vermastutz", title: "GitHub" }
];

document.body.insertAdjacentHTML(
    'afterbegin',
    `
    <label class="color-scheme">
      Theme:
      <select>
        <option value="light dark">Automatic</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
    `
  );

const BASE_PATH =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "/"
    : "/portfolioSV/"; 

// nav
let nav = document.createElement("nav");
document.body.prepend(nav);

// links
for (let p of pages) {
  let url = p.url.startsWith("http") ? p.url : BASE_PATH + p.url;

  let a = document.createElement("a");
  a.href = url;
  a.textContent = p.title;

  // Highlight current page
  a.classList.toggle(
    "current",
    a.host === location.host && a.pathname === location.pathname
  );

  if (a.host !== location.host) {
    a.target = "_blank";
  }

  nav.append(a);
}

let select = document.querySelector(".color-scheme select");


function setColorScheme(value) {
  document.documentElement.style.setProperty("color-scheme", value);
  select.value = value;
}

if ("colorScheme" in localStorage) {
    setColorScheme(localStorage.colorScheme);
  } else {
    // Force "automatic" to behave as light mode unless OS is dark
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const defaultScheme = prefersDark ? "dark" : "light";
    setColorScheme(defaultScheme);
  }

// On user change
select.addEventListener("input", function (event) {
  const newScheme = event.target.value;
  setColorScheme(newScheme);
  localStorage.colorScheme = newScheme;
});


// contact form 
const form = document.querySelector('#contact-form');

form?.addEventListener('submit', function (event) {
  event.preventDefault(); // stop default form behavior

  const data = new FormData(form);
  const params = [];

  for (let [key, value] of data) {
    params.push(`${key}=${encodeURIComponent(value)}`);
  }

  const mailtoURL = `${form.action}?${params.join('&')}`;
  location.href = mailtoURL;
});

export async function fetchJSON(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching or parsing JSON data:', error);
  }
}

export function renderProjects(projects, containerElement, headingLevel = 'h2') {
  containerElement.innerHTML = ''; // Clear existing content

  for (const project of projects) {
    const article = document.createElement('article');
    article.innerHTML = `
      <${headingLevel}>${project.title}</${headingLevel}>
      <img src="${project.image}" alt="${project.title}">
      <p>${project.description}</p>
    `;
    containerElement.appendChild(article);
  }
}

export async function fetchGitHubData(username) {
  return fetchJSON(`https://api.github.com/users/${vermastutz}`);
}