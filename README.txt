Automated Job Pipeline
A full-stack job search automation tool built with React, TypeScript, FastAPI, and SQLAlchemy. The app eliminates the manual grind of job hunting by automatically aggregating listings from LinkedIn and Indeed, ranking them against your resume, and presenting them in a clean triage queue — so instead of spending hours searching, you spend minutes reviewing.

How It Works
You set up a profile with your target job titles, location, work arrangement preferences, minimum salary, and optionally a list of specific companies you want to target. The backend scrapes LinkedIn and Indeed every 30 minutes using those parameters, normalizing salary data, inferring remote status, and deduplicating results before storing them.

You upload your master resume once — either as a PDF or JSON. The app never uses it to filter jobs out, but uses it to re-rank the queue so the most relevant listings surface first.

The approval queue is where you spend most of your time. Jobs come in as cards showing the title, company, salary, location, and a direct link to the posting. You can approve, skip, or bookmark each one individually with a single click or keyboard shortcut, or bulk-approve a batch with checkboxes. Listings found through targeted company searches are visually flagged with a purple badge so you always know where they came from.

The pipeline is designed to scale — each listing tracks its status across a 12-state lifecycle from pending all the way through applied, interviewing, offered, and accepted, with downstream steps (resume tailoring, document generation, auto-apply) planned to plug directly into the same data.
