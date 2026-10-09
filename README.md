# The National Observer

A fake online newspaper for the solo journaling game [Serious Reading](https://atypicalfaux.itch.io/serious-reading).

You play the journalist. You write absurd dispatches, publish them, and then read the paper as if a stranger had just picked it up. The journalists, the opinions, and the frogs are fictional. Please do not cite this in a real argument.

This is a small web app, vibe-coded for fun and immersion. It has no accounts, no server, and no interest in becoming a publishing platform.

## Run it locally

```bash
npm install
npm run dev
```

Open the address Vite prints. **The desk** is where you write. **The paper** is what a visitor sees.

`npm test` runs the checks. `npm run build` then `npm run preview` shows the public site, which is read-only.

## Writing, backups, and the public edition

Pieces live in this browser while you are writing. Drafts stay off the paper. A featured piece needs a short description before it can be published. Front-page order is the Move earlier / Move later list on the desk.

**Export backup** downloads everything in this browser: drafts, published pieces, authors, and images. **Import backup** replaces that local copy after you confirm. Use this when you want a private safety copy.

**Download published edition** downloads `edition.json` with only published pieces, the authors and images those pieces use, their tags, and their front-page order. It does not change anything stored in the browser.

To put that edition on the public site, replace `public/edition.json` with the file you downloaded, commit it, and update `main`. If nothing is published, the file is empty and the site still says that no dispatches have been published.

The production build does not include the desk. Local development does.

## GitHub Pages

The repository name this build expects is `national-observer`, so the public address is:

`https://<your-github-name>.github.io/national-observer/`

`.github/workflows/pages.yml` builds and deploys when `main` is updated. In the GitHub repository settings, set Pages to deploy with GitHub Actions. The first time, GitHub may ask you to allow the workflow.

Day to day, write on a `dev` branch. When an edition is ready, put the new `public/edition.json` on `main`. That push is what updates the live paper.

Creating the GitHub repository, pushing, and turning Pages on are manual steps. This folder does not do them by itself.
