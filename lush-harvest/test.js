const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const html = fs.readFileSync('c:/Users/WarpGamesHD/.gemini/antigravity/scratch/lush-harvest/index.html', 'utf8');

const dom = new JSDOM(html, {
    url: "http://localhost/",
    runScripts: "dangerously",
    resources: "usable"
});

dom.window.document.addEventListener('error', event => {
    console.error("DOM error:", event.error || event.message);
});

dom.window.addEventListener('error', event => {
    console.error("Window error:", event.error || event.message);
});

// Since it's a module, JSDOM might not execute it perfectly out of the box without some tweaks if it imports.
// Let's set a timeout to check.
setTimeout(() => {
    console.log("JSDOM finished waiting");
}, 2000);
